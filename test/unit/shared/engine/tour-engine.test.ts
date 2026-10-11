import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFakeAdapter, type FakeAdapter} from '../../../support/fake-adapter.js';
import {deferred} from '../../../support/deferred.js';
import type {TourEndInfo} from '../../../../src/shared/types/tour-end-info.type.js';
import type {TourStep} from '../../../../src/shared/types/tour-step.type.js';
import {
  createTourEngine,
  silentMoveMaxMs,
  silentMoveQuietMs,
  targetTimeoutMs,
  type TourEngine,
  type TourEngineOptions,
} from '../../../../src/shared/engine/tour-engine.js';

const rect = (y: number) => ({x: 100, y, width: 120, height: 40});

function steps(count: number, extra: (index: number) => Partial<TourStep> = () => ({})): TourStep[] {
  return Array.from({length: count}, (_, index) => ({
    target: `#t${index}`,
    title: `Step ${index}`,
    content: `Content ${index}`,
    ...extra(index),
  }));
}

/** Lets pending promises and zero-delay timers run. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
}

type Harness = {
  engine: TourEngine;
  fake: FakeAdapter;
  onTourEnd: ReturnType<typeof vi.fn<(tourId: string | undefined, info: TourEndInfo) => void>>;
  notifications: () => number;
};

/** Creates an engine plus a stand-in renderer that reports a tooltip size whenever one is requested. */
function setup(
  options: {size?: {width: number; height: number}; targets?: number; measuresWhileScrolling?: boolean} = {},
): Harness {
  const fake = createFakeAdapter(undefined, {measuresWhileScrolling: options.measuresWhileScrolling});
  for (let index = 0; index < (options.targets ?? 5); index++) {
    fake.setTarget(`#t${index}`, rect(100 + index * 50));
  }

  const onTourEnd = vi.fn<(tourId: string | undefined, info: TourEndInfo) => void>();
  const engine = createTourEngine({adapter: fake.adapter, onTourEnd});
  let count = 0;
  engine.subscribe(() => {
    count++;
    const {measure} = engine.getViewState();
    if (measure) {
      engine.reportTooltipSize(measure.id, options.size ?? {width: 300, height: 150});
    }
  });
  return {engine, fake, onTourEnd, notifications: () => count};
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tour engine: basic lifecycle', () => {
  it('starts synchronously, then shows the first step without any timer delay', async () => {
    const {engine} = setup();
    engine.actions.startTour(steps(3), 'tour');
    expect(engine.getPublicState()).toMatchObject({isActive: true, currentStep: 0, currentTourId: 'tour'});
    expect(engine.getViewState().phase).toBe('preparing');

    // Only microtasks (fake timers are never advanced): the step is shown without waiting for any timeout.
    for (let i = 0; i < 100 && engine.getViewState().phase !== 'showing'; i++) {
      await Promise.resolve();
    }

    const view = engine.getViewState();
    expect(view.phase).toBe('showing');
    expect(view.shown).toMatchObject({stepIndex: 0, highlight: rect(100)});
    expect(view.shown?.layout.placement).toBe('bottom');
  });

  it('ignores startTour without steps', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine} = setup();
    engine.actions.startTour([]);
    expect(engine.getPublicState().isActive).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('navigates with nextStep, prevStep and goToStep, and completes on the last step', async () => {
    const {engine, onTourEnd} = setup();
    const tour = steps(3);
    engine.actions.startTour(tour, 'tour');
    await flush();
    engine.actions.nextStep();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(1);
    engine.actions.prevStep();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(0);
    engine.actions.prevStep();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(0);
    engine.actions.goToStep(2);
    await flush();
    expect(engine.getPublicState().currentStep).toBe(2);
    engine.actions.nextStep();
    await flush();
    expect(onTourEnd).toHaveBeenCalledOnce();
    expect(onTourEnd).toHaveBeenCalledWith('tour', {reason: 'completed', stepIndex: 2, step: tour[2], totalSteps: 3});
    expect(engine.getPublicState()).toMatchObject({
      isActive: false,
      currentStep: 0,
      steps: [],
      currentTourId: undefined,
    });
  });

  it('ignores invalid goToStep indices and the current step', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(3));
    await flush();
    const waits = fake.calls.waitForTarget;
    for (const index of [-1, 3, 1.5, Number.NaN, 0]) {
      engine.actions.goToStep(index);
    }

    await flush();
    expect(fake.calls.waitForTarget).toBe(waits);
    expect(engine.getPublicState().currentStep).toBe(0);
  });

  it('reports how the tour ended', async () => {
    for (const end of ['endTour', 'blur', 'escape'] as const) {
      const {engine, onTourEnd} = setup();
      engine.actions.startTour(steps(2), 'tour');
      await flush();
      if (end === 'endTour') {
        engine.actions.endTour();
      } else {
        engine.dismiss(end);
      }

      expect(onTourEnd).toHaveBeenCalledWith(
        'tour',
        expect.objectContaining({reason: end === 'endTour' ? 'closed' : end, stepIndex: 0}),
      );
    }
  });

  it('calls the per-tour onTourEnd before the provider one, with the same info', async () => {
    const order: string[] = [];
    const {engine, onTourEnd} = setup();
    onTourEnd.mockImplementation(() => order.push('provider'));
    const perTour = vi.fn(() => order.push('tour'));
    engine.actions.startTour(steps(1), 'tour', {onTourEnd: perTour});
    await flush();
    engine.actions.endTour();
    expect(order).toEqual(['tour', 'provider']);
    expect(perTour.mock.calls[0]).toEqual(onTourEnd.mock.calls[0]);
  });

  it('reports the step the user was on when the tour ends while a step is being prepared', async () => {
    const {engine, fake, onTourEnd} = setup();
    fake.setTarget('#t1', undefined);
    engine.actions.startTour(steps(3), 'tour');
    await flush();
    engine.actions.nextStep();
    await flush();
    engine.actions.endTour();
    expect(onTourEnd.mock.calls[0]?.[1]).toMatchObject({reason: 'closed', stepIndex: 0});
  });
});

describe('tour engine: onBeforeStep', () => {
  it('runs exactly once per navigation, with the target and an abort signal', async () => {
    const onBeforeStep = vi.fn();
    const {engine, fake} = setup();
    engine.actions.startTour(steps(2, () => ({onBeforeStep})));
    await flush();
    expect(onBeforeStep).toHaveBeenCalledOnce();
    expect(onBeforeStep).toHaveBeenCalledWith('#t0', {signal: expect.any(AbortSignal)});

    // New callback identities (inline props), layout changes and size reports never re-run it.
    for (let i = 0; i < 10; i++) {
      engine.configure({adapter: fake.adapter, onTourEnd() {}});
      fake.triggerObservers();
      engine.reportTooltipSize(engine.getViewState().shown?.transitionId ?? -1, {width: 300 + i, height: 150});
    }

    await flush();
    expect(onBeforeStep).toHaveBeenCalledOnce();

    engine.actions.nextStep();
    await flush();
    expect(onBeforeStep).toHaveBeenCalledTimes(2);
  });

  it('waits for onBeforeStep before looking for the target', async () => {
    const gate = deferred();
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1, () => ({onBeforeStep: async () => gate.promise})));
    await flush();
    expect(fake.calls.waitForTarget).toBe(0);
    expect(engine.getViewState().phase).toBe('preparing');
    gate.resolve();
    await flush();
    expect(fake.calls.waitForTarget).toBe(1);
    expect(engine.getViewState().phase).toBe('showing');
  });

  it('ends the tour with "error" when onBeforeStep throws or rejects', async () => {
    for (const failure of ['throw', 'reject'] as const) {
      const error = new Error(failure);
      const {engine, onTourEnd} = setup();
      engine.actions.startTour(
        steps(2, () => ({
          onBeforeStep:
            failure === 'throw'
              ? () => {
                  throw error;
                }
              : async () => {
                  throw error;
                },
        })),
        'tour',
      );
      await flush();
      expect(onTourEnd).toHaveBeenCalledWith('tour', expect.objectContaining({reason: 'error', error, stepIndex: 0}));
      expect(engine.getPublicState().isActive).toBe(false);
    }
  });

  it('never shows the step when the tour ends during onBeforeStep', async () => {
    const gate = deferred();
    const {engine, fake} = setup();
    let signal: AbortSignal | undefined;
    engine.actions.startTour(
      steps(1, () => ({
        async onBeforeStep(_target, context) {
          signal = context.signal;
          await gate.promise;
        },
      })),
    );
    await flush();
    engine.actions.endTour();
    expect(signal?.aborted).toBe(true);
    gate.resolve();
    await flush();
    expect(fake.calls.waitForTarget).toBe(0);
    expect(engine.getViewState().phase).toBe('idle');
  });

  it('makes no state change at all once the tour has ended, even for steps without a target', async () => {
    const gate = deferred();
    const {engine, notifications} = setup();
    engine.actions.startTour([{title: 'Centred', content: 'x', onBeforeStep: async () => gate.promise}]);
    await flush();
    engine.actions.endTour();
    const after = notifications();
    gate.resolve();
    await flush();
    expect(notifications()).toBe(after);
    expect(engine.getViewState()).toMatchObject({phase: 'idle', measure: undefined, shown: undefined});
  });

  it('does not show a step when the tour ends while its tooltip is being measured', async () => {
    const fake = createFakeAdapter();
    // No renderer reports a size, so measuring waits for its safety timeout.
    const engine = createTourEngine({adapter: fake.adapter});
    engine.actions.startTour([{title: 'Centred', content: 'x'}]);
    await flush();
    expect(engine.getViewState().measure).toBeDefined();
    engine.actions.endTour();
    await vi.advanceTimersByTimeAsync(5000);
    expect(engine.getViewState()).toMatchObject({phase: 'idle', shown: undefined});
  });

  it('lets onBeforeStep redirect the tour with goToStep', async () => {
    const {engine} = setup();
    let firstSignal: AbortSignal | undefined;
    const tour = steps(3, (index) =>
      index === 0
        ? {
            onBeforeStep(_target, {signal}) {
              firstSignal = signal;
              engine.actions.goToStep(2);
            },
          }
        : {},
    );
    engine.actions.startTour(tour);
    await flush();
    expect(firstSignal?.aborted).toBe(true);
    expect(engine.getPublicState().currentStep).toBe(2);
  });
});

describe('tour engine: races', () => {
  it('advances exactly one step on a double click, preparing it only once', async () => {
    const onBeforeStep = vi.fn();
    const {engine, fake} = setup();
    engine.actions.startTour(steps(4, () => ({onBeforeStep})));
    await flush();
    const waits = fake.calls.waitForTarget;
    engine.actions.nextStep();
    engine.actions.nextStep();
    engine.actions.nextStep();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(1);
    expect(onBeforeStep).toHaveBeenCalledTimes(2);
    expect(fake.calls.waitForTarget).toBe(waits + 1);
  });

  it('ignores next and previous while a step is being prepared', async () => {
    const gate = deferred();
    const onBeforeStep = vi.fn(async () => gate.promise);
    const {engine} = setup();
    engine.actions.startTour(steps(4, (index) => (index === 1 ? {onBeforeStep} : {})));
    await flush();
    engine.actions.nextStep();
    await flush();
    engine.actions.nextStep();
    engine.actions.prevStep();
    gate.resolve();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(1);
    expect(onBeforeStep).toHaveBeenCalledOnce();
  });

  it('retargets when goToStep is called while another step is being prepared', async () => {
    const gate = deferred();
    let abandoned: AbortSignal | undefined;
    const {engine} = setup();
    engine.actions.startTour(
      steps(4, (index) =>
        index === 1
          ? {
              async onBeforeStep(_target, {signal}) {
                abandoned = signal;
                await gate.promise;
              },
            }
          : {},
      ),
    );
    await flush();
    engine.actions.nextStep();
    await flush();
    engine.actions.goToStep(3);
    await flush();
    gate.resolve();
    await flush();
    expect(abandoned?.aborted).toBe(true);
    expect(engine.getPublicState().currentStep).toBe(3);
  });

  it('calls onTourEnd exactly once even when ending repeatedly', async () => {
    const {engine, onTourEnd} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    engine.actions.endTour();
    engine.actions.endTour();
    engine.dismiss('blur');
    engine.actions.nextStep();
    expect(onTourEnd).toHaveBeenCalledOnce();
  });

  it('ignores starting the running tour again, and replaces it with a different one', async () => {
    const onBeforeStep = vi.fn();
    const {engine, onTourEnd} = setup();
    const tour = steps(2, () => ({onBeforeStep}));
    engine.actions.startTour(tour, 'a');
    await flush();
    engine.actions.startTour(steps(2), 'a');
    await flush();
    expect(onBeforeStep).toHaveBeenCalledOnce();
    expect(onTourEnd).not.toHaveBeenCalled();

    engine.actions.startTour(steps(2), 'b');
    await flush();
    expect(onTourEnd).toHaveBeenCalledOnce();
    expect(onTourEnd).toHaveBeenCalledWith('a', expect.objectContaining({reason: 'closed'}));
    expect(engine.getPublicState().currentTourId).toBe('b');
  });

  it('treats the same steps array without an id as the same tour (StrictMode double effects)', async () => {
    const {engine, onTourEnd} = setup();
    const tour = steps(2);
    engine.actions.startTour(tour);
    engine.actions.startTour(tour);
    await flush();
    expect(onTourEnd).not.toHaveBeenCalled();
    expect(engine.getPublicState().steps).toBe(tour);
  });

  it('allows starting another tour from onTourEnd', async () => {
    const {engine, onTourEnd} = setup();
    onTourEnd.mockImplementationOnce(() => {
      engine.actions.startTour(steps(1), 'next');
    });
    engine.actions.startTour(steps(1), 'first');
    await flush();
    engine.actions.endTour();
    await flush();
    expect(engine.getPublicState()).toMatchObject({isActive: true, currentTourId: 'next'});
    expect(engine.getViewState().phase).toBe('showing');
  });
});

describe('tour engine: missing and hidden targets', () => {
  it('waits for a target that appears later, without polling', async () => {
    const {engine, fake} = setup({targets: 0});
    engine.actions.startTour(steps(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(engine.getViewState().phase).toBe('preparing');
    fake.setTarget('#t0', rect(100));
    await flush();
    expect(engine.getViewState().phase).toBe('showing');
    expect(fake.calls.waitForTarget).toBe(1);
  });

  it('skips a step whose target never appears, and warns in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    fake.setTarget('#t1', undefined);
    engine.actions.startTour(steps(3));
    await flush();
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(targetTimeoutMs);
    await flush();
    expect(engine.getPublicState().currentStep).toBe(2);
    expect(fake.waitSignals.at(-2)?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping step 2'));
  });

  it('ends with "target-missing" when no remaining step can be shown', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake, onTourEnd} = setup();
    fake.setTarget('#t1', undefined);
    fake.setTarget('#t2', undefined);
    engine.actions.startTour(steps(3), 'tour');
    await flush();
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(targetTimeoutMs * 2);
    await flush();
    expect(onTourEnd).toHaveBeenCalledWith('tour', expect.objectContaining({reason: 'target-missing', stepIndex: 2}));
  });

  it('skips backwards over missing targets, and returns to where the user came from at the start', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    engine.actions.startTour(steps(3));
    await flush();
    engine.actions.goToStep(2);
    await flush();
    fake.setTarget('#t1', undefined);
    engine.actions.prevStep();
    await vi.advanceTimersByTimeAsync(targetTimeoutMs);
    await flush();
    expect(engine.getPublicState().currentStep).toBe(0);

    fake.setTarget('#t0', undefined);
    engine.actions.goToStep(2);
    await flush();
    engine.actions.prevStep();
    await vi.advanceTimersByTimeAsync(targetTimeoutMs * 3);
    await flush();
    // Nothing before step 2 can be shown: back to step 2 instead of ending the tour.
    expect(engine.getPublicState()).toMatchObject({isActive: true, currentStep: 2});
  });

  it('shows steps without a target in the centre without looking for anything', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour([{title: 'Welcome', content: 'Hi'}]);
    await flush();
    expect(fake.calls.waitForTarget).toBe(0);
    expect(fake.calls.reveal).toEqual([]);
    expect(engine.getViewState().shown).toMatchObject({highlight: undefined, layout: {placement: 'center'}});
  });

  it('finds a target again when it is re-mounted, without re-running onBeforeStep', async () => {
    const onBeforeStep = vi.fn();
    const {engine, fake} = setup();
    engine.actions.startTour(steps(2, () => ({onBeforeStep})));
    await flush();
    const firstTransition = engine.getViewState().shown?.transitionId;
    fake.setTarget('#t0', undefined);
    fake.triggerObservers();
    await flush();
    fake.setTarget('#t0', rect(300));
    await flush();
    expect(onBeforeStep).toHaveBeenCalledOnce();
    expect(engine.getViewState().shown).toMatchObject({stepIndex: 0, highlight: rect(300)});
    expect(engine.getViewState().shown?.transitionId).not.toBe(firstTransition);
  });
});

describe('tour engine: bringing targets into view', () => {
  it('asks the adapter to reveal each step once, with room for the tooltip', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    expect(fake.calls.reveal).toHaveLength(1);
    expect(fake.calls.reveal[0]).toMatchObject({behavior: 'smooth'});
    // Room below the target for the tooltip (gap 12 + height 150), plus padding.
    expect(fake.calls.reveal[0]?.margins[0]).toEqual({top: 20, right: 20, bottom: 20 + 12 + 150, left: 20});
  });

  it('switches to "revealing" while scrolling and shows the target where it ended up', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#t0', rect(2000));
    const phases: string[] = [];
    engine.subscribe(() => phases.push(engine.getViewState().phase));
    fake.onReveal(() => rect(300));
    engine.actions.startTour(steps(1));
    await flush();
    expect(phases).toContain('revealing');
    expect(engine.getViewState().shown?.highlight).toEqual(rect(300));
  });

  it('follows the next target frame by frame while scrolling it into view', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#t1', rect(2000));
    engine.actions.startTour(steps(2));
    await flush();
    const highlights: unknown[] = [];
    engine.subscribe(() => {
      const view = engine.getViewState();
      if (view.phase === 'revealing') {
        highlights.push(view.revealHighlight);
      }
    });
    // A slow scroll: the target moves up over several frames.
    fake.onRevealAsync(async () => {
      for (const y of [1500, 1000, 600, 400]) {
        fake.setTarget('#t1', rect(y));
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      }
    });
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(highlights[0]).toEqual(rect(2000));
    expect(highlights.length).toBeGreaterThan(2);
    expect(highlights.at(-1)).toEqual(rect(400));
    expect(engine.getViewState()).toMatchObject({
      phase: 'showing',
      revealHighlight: undefined,
      shown: {highlight: rect(400)},
    });
  });

  it('moves the highlight straight to where the target is going when positions lag behind the scroll', async () => {
    // React Native: measurements only catch up once scrolling has finished.
    const {engine, fake} = setup({measuresWhileScrolling: false});
    fake.setTarget('#t1', rect(2000));
    engine.actions.startTour(steps(2));
    await flush();
    const highlights: unknown[] = [];
    engine.subscribe(() => {
      const view = engine.getViewState();
      if (view.phase === 'revealing') {
        highlights.push(view.revealHighlight);
      }
    });
    fake.onReveal(() => rect(400));
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(highlights.length).toBeGreaterThan(0);
    for (const highlight of highlights) {
      expect(highlight).toEqual(rect(400));
    }

    expect(engine.getViewState().shown?.highlight).toEqual(rect(400));
  });

  it('does not follow stale positions frame by frame while scrolling when they lag behind', async () => {
    const {engine, fake} = setup({measuresWhileScrolling: false});
    fake.setTarget('#t1', rect(2000));
    engine.actions.startTour(steps(2));
    await flush();
    const highlights: unknown[] = [];
    engine.subscribe(() => {
      const view = engine.getViewState();
      if (view.phase === 'revealing') {
        highlights.push(view.revealHighlight);
      }
    });
    fake.onRevealAsync(async () => {
      for (const y of [1500, 1000, 600, 400]) {
        fake.setTarget('#t1', rect(y));
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      }
    });
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(new Set(highlights.map((highlight) => JSON.stringify(highlight))).size).toBe(1);
    expect(engine.getViewState().shown?.highlight).toEqual(rect(400));
  });

  it('places a target hidden inside its scroll container on the container edge', async () => {
    const {engine, fake} = setup();
    // The scroller shows y 0..300; the target is further down inside it.
    fake.setTarget('#t0', rect(600), {x: 0, y: 0, width: 1280, height: 300});
    fake.onRevealAsync(async () => {
      fake.setTarget('#t0', rect(100), {x: 0, y: 0, width: 1280, height: 300});
    });
    const highlights: unknown[] = [];
    engine.subscribe(() => {
      const view = engine.getViewState();
      if (view.phase === 'revealing') {
        highlights.push(view.revealHighlight);
      }
    });
    engine.actions.startTour(steps(1));
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(highlights[0]).toEqual({x: 100, y: 300, width: 120, height: 0});
    expect(engine.getViewState().shown?.highlight).toEqual(rect(100));
  });

  it('skips targets that cannot be scrolled into view, once they have not moved for a moment', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    fake.setTarget('#t1', rect(5000));
    engine.actions.startTour(steps(3));
    await flush();
    engine.actions.nextStep();
    await flush();
    expect(engine.getViewState().phase).toBe('preparing');
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs);
    expect(fake.calls.reveal.map((request) => request.behavior)).toEqual(['smooth', 'smooth', 'instant', 'smooth']);
    expect(engine.getPublicState().currentStep).toBe(2);
  });

  it('waits for a target out of sight to arrive, as when a screen slides in', async () => {
    const {engine, fake} = setup();
    // Until the animation ends, the target is measured where it started: off screen.
    fake.setTarget('#t0', {x: -500, y: 100, width: 120, height: 40});
    engine.actions.startTour(steps(1));
    await flush();
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs / 2);
    expect(engine.getViewState().shown).toBeUndefined();
    // The animation ends: the target jumps into view, and no event says so.
    fake.setTarget('#t0', rect(100));
    await flush();
    expect(engine.getViewState().shown?.highlight).toEqual(rect(100));
  });

  it('skips a target that keeps moving out of sight after a few seconds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    let x = -500;
    fake.setTarget('#t0', {x, y: 100, width: 120, height: 40});
    const drift = setInterval(() => {
      x -= 10;
      fake.setTarget('#t0', {x, y: 100, width: 120, height: 40});
    }, 100);
    engine.actions.startTour(steps(2));
    await flush();
    await vi.advanceTimersByTimeAsync(silentMoveMaxMs - 500);
    expect(engine.getViewState().shown).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    clearInterval(drift);
    expect(engine.getPublicState().currentStep).toBe(1);
  });

  it('shows partly visible targets after an instant correction', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#t0', {x: 100, y: 780, width: 120, height: 40});
    engine.actions.startTour(steps(1));
    await flush();
    expect(fake.calls.reveal.map((request) => request.behavior)).toEqual(['smooth', 'instant']);
    expect(engine.getViewState().phase).toBe('showing');
  });

  it('treats a target covered by a sticky header as not fully visible, and scrolls again', async () => {
    const {engine, fake} = setup();
    const header = {x: 0, y: 0, width: 1280, height: 64};
    // In view but under the sticky header.
    fake.setTarget('#t0', rect(30), undefined, [header]);
    fake.onReveal(() => rect(300));
    engine.actions.startTour(steps(1));
    await flush();
    expect(fake.calls.reveal.length).toBeGreaterThanOrEqual(1);
    expect(engine.getViewState().shown?.highlight).toEqual(rect(300));
  });

  it('still shows a target that stays partly covered, and skips one that stays completely covered', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    const banner = {x: 0, y: 110, width: 1280, height: 20};
    const wall = {x: 0, y: 0, width: 1280, height: 400};
    fake.setTarget('#t0', rect(100), undefined, [banner]);
    fake.setTarget('#t1', rect(200), undefined, [wall]);
    engine.actions.startTour(steps(3));
    await flush();
    expect(engine.getPublicState().currentStep).toBe(0);
    engine.actions.nextStep();
    await flush();
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs);
    expect(engine.getPublicState().currentStep).toBe(2);
  });

  it('only counts the part of the target its scroll container shows', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {engine, fake} = setup();
    // Inside a scroller that only shows y 0..200: the target at y 400 is clipped away.
    fake.setTarget('#t0', rect(400), {x: 0, y: 0, width: 1280, height: 200});
    engine.actions.startTour(steps(2));
    await flush();
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs);
    expect(engine.getPublicState().currentStep).toBe(1);
  });
});

describe('tour engine: layout updates and idle', () => {
  it('does nothing at all while nothing changes', async () => {
    const {engine, fake, notifications} = setup();
    engine.actions.startTour(steps(2));
    await flush();
    const before = {notifications: notifications(), measure: fake.calls.measure, reveal: fake.calls.reveal.length};
    await vi.advanceTimersByTimeAsync(10_000);
    expect({notifications: notifications(), measure: fake.calls.measure, reveal: fake.calls.reveal.length}).toEqual(
      before,
    );
  });

  it('does not notify when a layout change leaves everything where it was', async () => {
    const {engine, fake, notifications} = setup();
    engine.actions.startTour(steps(2));
    await flush();
    const before = notifications();
    fake.triggerObservers();
    await flush();
    expect(notifications()).toBe(before);
    expect(fake.calls.reveal).toHaveLength(1);
  });

  it('follows the target instantly (same transition) when it moves', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(2));
    await flush();
    const {transitionId} = engine.getViewState().shown!;
    fake.setTarget('#t0', rect(130));
    fake.triggerObservers();
    await flush();
    expect(engine.getViewState().shown).toMatchObject({transitionId, highlight: rect(130)});
  });

  it('follows a target that an animation moves right after the step appears, then only reacts to events', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(2));
    await flush();
    const {transitionId} = engine.getViewState().shown!;
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs / 2);
    // The animation ends: the target jumps, and no event says so (no `triggerObservers`).
    fake.setTarget('#t0', rect(130));
    await flush();
    expect(engine.getViewState().shown).toMatchObject({transitionId, highlight: rect(130)});
    // Once it has not moved for a moment, it is no longer checked.
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs);
    const waits = fake.calls.waitForMove;
    fake.setTarget('#t0', rect(160));
    await vi.advanceTimersByTimeAsync(silentMoveQuietMs);
    expect(engine.getViewState().shown?.highlight).toEqual(rect(130));
    expect(fake.calls.waitForMove).toBe(waits);
  });

  it('stops checking a target that never stops moving after a few seconds', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    let y = 100;
    const pulse = setInterval(() => {
      y = y === 100 ? 101 : 100;
      fake.setTarget('#t0', rect(y));
    }, 400);
    await vi.advanceTimersByTimeAsync(silentMoveMaxMs);
    const waits = fake.calls.waitForMove;
    await vi.advanceTimersByTimeAsync(2000);
    clearInterval(pulse);
    expect(fake.calls.waitForMove).toBe(waits);
  });

  it('ignores a slow measurement that finishes after a newer one', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    const releaseOld = fake.holdNextMeasure();
    fake.triggerObservers();
    fake.setTarget('#t0', rect(140));
    fake.triggerObservers();
    await flush();
    expect(engine.getViewState().shown?.highlight).toEqual(rect(140));
    releaseOld(rect(100));
    await flush();
    expect(engine.getViewState().shown?.highlight).toEqual(rect(140));
  });

  it('keeps the tooltip on the same side while following a moving target', async () => {
    const {engine, fake} = setup();
    // Near the bottom edge: the preferred bottom side has no room, so the tooltip goes on top.
    fake.setTarget('#t0', rect(700));
    engine.actions.startTour(steps(1));
    await flush();
    expect(engine.getViewState().shown?.layout.placement).toBe('top');
    // Now both sides have room; the tooltip stays on top instead of flipping back.
    fake.setTarget('#t0', rect(400));
    fake.triggerObservers();
    await flush();
    expect(engine.getViewState().shown?.layout.placement).toBe('top');
  });

  it('re-lays out when the shown tooltip changes size, and ignores stale or unchanged sizes', async () => {
    const {engine, notifications} = setup();
    engine.actions.startTour(steps(2));
    await flush();
    const shown = engine.getViewState().shown!;
    const before = notifications();
    engine.reportTooltipSize(shown.transitionId, {width: 300, height: 150});
    engine.reportTooltipSize(shown.transitionId - 100, {width: 10, height: 10});
    expect(notifications()).toBe(before);
    engine.reportTooltipSize(shown.transitionId, {width: 300, height: 400});
    expect(engine.getViewState().shown?.layout.height).toBe(400);
  });

  it('scrolls the target back into view when the app moves it out of sight, without restarting the step', async () => {
    const onBeforeStep = vi.fn();
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1, () => ({onBeforeStep})));
    await flush();
    const {transitionId} = engine.getViewState().shown!;
    const revealsBefore = fake.calls.reveal.length;
    fake.onReveal(() => rect(400));
    // Content inserted above the target pushes it below the screen.
    fake.setTarget('#t0', rect(900));
    fake.triggerObservers();
    await flush();
    expect(fake.calls.reveal).toHaveLength(revealsBefore + 1);
    expect(fake.calls.reveal.at(-1)).toMatchObject({behavior: 'smooth'});
    fake.triggerObservers();
    await flush();
    expect(engine.getViewState()).toMatchObject({phase: 'showing', shown: {transitionId, highlight: rect(400)}});
    expect(onBeforeStep).toHaveBeenCalledOnce();
  });

  it('leaves targets that cannot fit on screen where they are', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#t0', {x: 0, y: 0, width: 1280, height: 2000});
    engine.actions.startTour(steps(1));
    await flush();
    const reveals = fake.calls.reveal.length;
    fake.setTarget('#t0', {x: 0, y: -100, width: 1280, height: 2000});
    fake.triggerObservers();
    await flush();
    expect(fake.calls.reveal).toHaveLength(reveals);
  });

  it('stops observing when the tour ends', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    expect(fake.activeObservers()).toBe(1);
    engine.actions.endTour();
    expect(fake.activeObservers()).toBe(0);
  });

  it('keeps the tooltip inside the viewport when the viewport shrinks', async () => {
    const {engine, fake} = setup();
    engine.actions.startTour(steps(1));
    await flush();
    fake.setViewport({rect: {x: 0, y: 0, width: 320, height: 200}, insets: {top: 0, right: 0, bottom: 0, left: 0}});
    fake.triggerObservers();
    await flush();
    const {layout} = engine.getViewState().shown!;
    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.width).toBeLessThanOrEqual(320);
    expect(layout.y + layout.height).toBeLessThanOrEqual(200);
  });
});

describe('tour engine: mounting', () => {
  it('survives StrictMode’s simulated unmount without restarting anything', async () => {
    const onBeforeStep = vi.fn();
    const {engine} = setup();
    const cleanup = engine.mount();
    engine.actions.startTour(steps(1, () => ({onBeforeStep})));
    cleanup();
    engine.mount();
    await flush();
    expect(onBeforeStep).toHaveBeenCalledOnce();
    expect(engine.getViewState().phase).toBe('showing');
  });

  it('stops all work on a real unmount and ignores commands while unmounted', async () => {
    const gate = deferred();
    let signal: AbortSignal | undefined;
    const {engine, fake, onTourEnd} = setup();
    const cleanup = engine.mount();
    engine.actions.startTour(
      steps(2, () => ({
        async onBeforeStep(_target, context) {
          signal = context.signal;
          await gate.promise;
        },
      })),
    );
    await flush();
    cleanup();
    await flush();
    expect(signal?.aborted).toBe(true);
    gate.resolve();
    await flush();
    expect(fake.calls.waitForTarget).toBe(0);
    engine.actions.startTour(steps(1), 'other');
    expect(engine.getPublicState().currentTourId).toBeUndefined();
    expect(onTourEnd).not.toHaveBeenCalled();
  });

  it('resumes where it was when mounted again', async () => {
    const {engine, fake} = setup();
    const cleanup = engine.mount();
    engine.actions.startTour(steps(2));
    await flush();
    cleanup();
    await flush();
    expect(fake.activeObservers()).toBe(0);
    engine.mount();
    await flush();
    expect(fake.activeObservers()).toBe(1);
    engine.actions.nextStep();
    await flush();
    expect(engine.getPublicState().currentStep).toBe(1);
  });
});

describe('tour engine: error isolation', () => {
  it('resets the tour and still runs the other callback when onTourEnd throws', async () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const failure = new Error('analytics down');
    const fake = createFakeAdapter();
    fake.setTarget('#t0', rect(100));
    const provider = vi.fn();
    const options: TourEngineOptions = {adapter: fake.adapter, onTourEnd: provider};
    const engine = createTourEngine(options);
    engine.subscribe(() => {
      const {measure} = engine.getViewState();
      if (measure) {
        engine.reportTooltipSize(measure.id, {width: 300, height: 150});
      }
    });
    engine.actions.startTour(steps(1), 'tour', {
      onTourEnd() {
        throw failure;
      },
    });
    await flush();
    engine.actions.endTour();
    expect(engine.getPublicState().isActive).toBe(false);
    expect(provider).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(failure);
    vi.unstubAllGlobals();
  });
});
