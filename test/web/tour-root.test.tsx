import {type ReactNode, StrictMode, useEffect, useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-react';
import {createFakeAdapter, type FakeAdapter} from '../support/fake-adapter.js';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import type {TourEndCallback} from '../../src/shared/types/tour-end-info.type.js';
import type {TourStep} from '../../src/shared/types/tour-step.type.js';
import {TourRoot, useTourEngine} from '../../src/shared/react/tour-root.js';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import {useTourEngineContext, useTourView} from '../../src/shared/react/use-tour-view.hook.js';

const rect = (y: number) => ({x: 100, y, width: 120, height: 40});

/** Stand-in renderer: reports a tooltip size whenever the engine asks for one. */
function FakeRenderer(): ReactNode {
  const engine = useTourEngineContext();
  const view = useTourView(engine);
  useEffect(() => {
    if (view.measure) {
      engine.reportTooltipSize(view.measure.id, {width: 300, height: 150});
    }
  }, [engine, view.measure]);
  return null;
}

function TestProvider({
  fake,
  onTourEnd,
  children,
}: {
  readonly fake: FakeAdapter;
  readonly onTourEnd?: TourEndCallback;
  readonly children: ReactNode;
}): ReactNode {
  const engine = useTourEngine(fake.adapter, onTourEnd);
  return (
    <TourRoot engine={engine}>
      {children}
      <FakeRenderer />
    </TourRoot>
  );
}

function makeSteps(onBeforeStep?: TourStep['onBeforeStep']): TourStep[] {
  return [0, 1, 2].map((index) => ({target: `#t${index}`, title: `Step ${index}`, content: 'x', onBeforeStep}));
}

function fakeWithTargets(): FakeAdapter {
  const fake = createFakeAdapter();
  for (let index = 0; index < 3; index++) {
    fake.setTarget(`#t${index}`, rect(100 + index * 60));
  }

  return fake;
}

describe('TourRoot (React bindings)', () => {
  it('runs onBeforeStep once when a tour is auto-started in StrictMode', async () => {
    const onBeforeStep = vi.fn();
    const steps = makeSteps(onBeforeStep);
    function AutoStart(): ReactNode {
      const {startTour} = useTour();
      useEffect(() => {
        startTour(steps, 'welcome');
      }, [startTour]);
      return null;
    }

    const fake = fakeWithTargets();
    await render(
      <StrictMode>
        <TestProvider fake={fake}>
          <AutoStart />
        </TestProvider>
      </StrictMode>,
    );
    await vi.waitFor(() => {
      expect(fake.calls.observe).toBeGreaterThan(0);
    });
    expect(onBeforeStep).toHaveBeenCalledOnce();
  });

  it('never re-runs onBeforeStep when the parent re-renders with inline callbacks, and uses the latest callback', async () => {
    const onBeforeStep = vi.fn();
    const steps = makeSteps(onBeforeStep);
    const ends: number[] = [];
    let api: TourContextType | undefined;
    function Capture(): ReactNode {
      api = useTour();
      return null;
    }

    function Parent(): ReactNode {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        if (tick < 20) {
          const timer = setTimeout(() => {
            setTick(tick + 1);
          }, 5);
          return () => {
            clearTimeout(timer);
          };
        }

        return undefined;
      }, [tick]);
      return (
        <TestProvider
          fake={fake}
          onTourEnd={() => {
            ends.push(tick);
          }}
        >
          <Capture />
          <span>tick {tick}</span>
        </TestProvider>
      );
    }

    const fake = fakeWithTargets();
    const screen = await render(<Parent />);
    api?.startTour(steps);
    await expect.element(screen.getByText('tick 20')).toBeInTheDocument();
    expect(onBeforeStep).toHaveBeenCalledOnce();
    api?.endTour();
    expect(ends).toEqual([20]);
  });

  it('keeps the action functions stable across renders and steps', async () => {
    const seen: TourContextType[] = [];
    function Capture(): ReactNode {
      seen.push(useTour());
      return null;
    }

    const fake = fakeWithTargets();
    await render(
      <TestProvider fake={fake}>
        <Capture />
      </TestProvider>,
    );
    seen.at(-1)?.startTour(makeSteps());
    await vi.waitFor(() => {
      expect(seen.at(-1)?.isActive).toBe(true);
    });
    seen.at(-1)?.nextStep();
    await vi.waitFor(() => {
      expect(seen.at(-1)?.currentStep).toBe(1);
    });
    const [first] = seen;
    for (const value of seen) {
      for (const key of ['startTour', 'endTour', 'nextStep', 'prevStep', 'goToStep'] as const) {
        expect(value[key]).toBe(first?.[key]);
      }
    }
  });

  it('does not re-render useTour() consumers when only the layout changes', async () => {
    let renders = 0;
    let api: TourContextType | undefined;
    function Consumer(): ReactNode {
      renders++;
      api = useTour();
      return null;
    }

    const fake = fakeWithTargets();
    await render(
      <TestProvider fake={fake}>
        <Consumer />
      </TestProvider>,
    );
    api?.startTour(makeSteps());
    await vi.waitFor(() => {
      expect(fake.activeObservers()).toBe(1);
    });
    const before = renders;
    for (let i = 0; i < 10; i++) {
      fake.setTarget('#t0', rect(100 + i));
      fake.triggerObservers();
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(renders).toBe(before);
  });

  it('returns an inert default outside a provider and warns when it is used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let api: TourContextType | undefined;
    function Lonely(): ReactNode {
      api = useTour();
      return null;
    }

    await render(<Lonely />);
    expect(api?.isActive).toBe(false);
    api?.startTour(makeSteps());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('outside of <TourProvider>'));
  });
});
