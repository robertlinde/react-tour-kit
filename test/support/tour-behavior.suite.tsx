import {type ComponentType, type ReactNode, useEffect, useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {page} from 'vitest/browser';
import type {Insets} from '../../src/shared/geometry/geometry.type.js';
import type {TourProviderBaseProps} from '../../src/shared/react/tour-provider-core.js';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import type {TourEndInfo, TourEndReason} from '../../src/shared/types/tour-end-info.type.js';
import type {TourStep, TourTarget} from '../../src/shared/types/tour-step.type.js';
import type {TourTooltipProps} from '../../src/shared/types/tour-tooltip-props.type.js';
import {deferred} from './deferred.js';

/**
 * What every platform's tour does, tested the same way on each. A platform takes part by
 * implementing this harness (how to render, how to create a target, how to press things); the
 * scenarios are shared. Add new behaviour here, and it is tested on every platform.
 */
export type TourBehaviorHarness = {
  readonly platform: string;
  /** Renders `children` inside the platform's `TourProvider`, on a phone-sized screen. */
  readonly render: (children: ReactNode, props?: TourProviderBaseProps, options?: RenderOptions) => Promise<void>;
  /** Safe-area insets the harness passes to the tour. */
  readonly insets: Insets;
  /** The screen the tour is drawn on, in page coordinates. */
  readonly screenRect: () => DOMRect;
  /** An element steps can point to (160 × 44). */
  readonly Target: ComponentType<{readonly id: string; readonly style?: TargetStyle}>;
  readonly targetOf: (id: string) => TourTarget;
  readonly rectOf: (id: string) => DOMRect;
  /** A scrollable area (registered with the tour where the platform needs that). */
  readonly Scroller: ComponentType<{readonly height: number; readonly children: ReactNode}>;
  readonly Spacer: ComponentType<{readonly height: number}>;
  /** Plain building blocks for custom tooltips. */
  readonly ui: {
    readonly Box: ComponentType<{readonly children: ReactNode}>;
    readonly Heading: ComponentType<{readonly id: string; readonly children: ReactNode}>;
    readonly Button: ComponentType<{readonly label: string; readonly onPress: () => void}>;
  };
  /** The tooltip on screen, or `null`. */
  readonly tooltip: () => HTMLElement | null;
  /** Waits until the step titled `title` is on screen and has finished entering; returns the tooltip. */
  readonly waitForStep: (title: string) => Promise<HTMLElement>;
  /**
   * Moves a target by an offset from where it is laid out, the way an animation does that no event
   * reports (React Native: a native-driver animation, such as a screen sliding in; the web: the Web
   * Animations API).
   */
  readonly moveSilently: (id: string, offset: {readonly x: number; readonly y: number}) => void;
  /** Presses whatever is on screen at a point of the page (the dimmed area, the tooltip), as a finger or mouse would. */
  readonly pressAt: (point: {readonly x: number; readonly y: number}) => Promise<void>;
  /** The platform's own way of leaving the tour (Escape on the web, the back button on Android). */
  readonly dismiss: {readonly reason: TourEndReason; readonly perform: () => Promise<void>};
};

export type RenderOptions = {
  /** Called for every React commit inside the provider. */
  readonly onCommit?: () => void;
};

export type TargetStyle = {
  readonly marginLeft?: number;
};

const padding = 12;
const highlightPadding = 8;
const tolerance = 0.5;

let tour: TourContextType | undefined;
function Capture(): ReactNode {
  tour = useTour();
  return null;
}

function startedTour(): TourContextType {
  if (!tour) {
    throw new Error('The tour is not rendered');
  }

  return tour;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isDisabled(element: Element): boolean {
  return (element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true';
}

export function describeTourBehavior(harness: TourBehaviorHarness): void {
  const {Target, Spacer, Scroller, ui} = harness;
  const steps: TourStep[] = [
    {target: harness.targetOf('first'), title: 'First step', content: 'Hello'},
    {target: harness.targetOf('second'), title: 'Second step', content: 'Middle'},
    {target: harness.targetOf('third'), title: 'Third step', content: 'Bye', placement: 'top'},
  ];

  function Screen(): ReactNode {
    return (
      <>
        <Spacer height={120} />
        <Target id="first" style={{marginLeft: 20}} />
        <Spacer height={120} />
        <Target id="second" style={{marginLeft: 200}} />
        <Spacer height={120} />
        <Target id="third" style={{marginLeft: 20}} />
      </>
    );
  }

  async function renderScreen(props?: TourProviderBaseProps, options?: RenderOptions): Promise<void> {
    await harness.render(
      <>
        <Capture />
        <Screen />
      </>,
      props,
      options,
    );
  }

  /** The area the tooltip must stay in: the screen without safe areas and padding. */
  function expectInSafeArea(box: DOMRect): void {
    const screen = harness.screenRect();
    const {insets} = harness;
    expect(box.left).toBeGreaterThanOrEqual(screen.left + insets.left + padding - tolerance);
    expect(box.top).toBeGreaterThanOrEqual(screen.top + insets.top + padding - tolerance);
    expect(box.right).toBeLessThanOrEqual(screen.right - insets.right - padding + tolerance);
    expect(box.bottom).toBeLessThanOrEqual(screen.bottom - insets.bottom - padding + tolerance);
  }

  afterEach(() => {
    tour = undefined;
  });

  describe(`tour behaviour (${harness.platform})`, () => {
    it('shows the first step next to its target, inside the safe area', async () => {
      await renderScreen();
      startedTour().startTour(steps, 'intro');
      const tooltip = await harness.waitForStep('First step');
      const box = tooltip.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(harness.rectOf('first').bottom + highlightPadding - tolerance);
      expectInSafeArea(box);
      await expect.element(page.getByText('1 of 3')).toBeVisible();
    });

    it('navigates with Next, Back and the dots, and completes once with Finish', async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      startedTour().startTour(steps, 'intro');
      await harness.waitForStep('First step');
      expect(isDisabled(page.getByRole('button', {name: 'Back'}).element())).toBe(true);
      await page.getByRole('button', {name: 'Next'}).click();
      await harness.waitForStep('Second step');
      await page.getByRole('button', {name: 'Back'}).click();
      await harness.waitForStep('First step');
      await page.getByRole('button', {name: 'Go to step 3'}).click();
      const third = await harness.waitForStep('Third step');
      // Asked for the top: above the target.
      expect(third.getBoundingClientRect().bottom).toBeLessThanOrEqual(harness.rectOf('third').top + tolerance);
      await page.getByRole('button', {name: 'Finish'}).click();
      await vi.waitFor(() => {
        expect(onTourEnd).toHaveBeenCalledWith('intro', expect.objectContaining({reason: 'completed', stepIndex: 2}));
      });
      expect(onTourEnd).toHaveBeenCalledOnce();
    });

    it('closes with the close button', async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      startedTour().startTour(steps, 'intro');
      await harness.waitForStep('First step');
      await page.getByRole('button', {name: 'Close tour'}).click();
      await vi.waitFor(() => {
        expect(onTourEnd).toHaveBeenCalledWith('intro', expect.objectContaining({reason: 'closed'}));
      });
    });

    it("closes with the platform's own gesture", async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      startedTour().startTour(steps, 'intro');
      await harness.waitForStep('First step');
      await harness.dismiss.perform();
      await vi.waitFor(() => {
        expect(onTourEnd).toHaveBeenCalledWith('intro', expect.objectContaining({reason: harness.dismiss.reason}));
      });
    });

    it('closes when the dimmed area is pressed, but not when the highlighted element is', async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      startedTour().startTour(steps, 'intro');
      await harness.waitForStep('First step');
      const target = harness.rectOf('first');
      await harness.pressAt({x: target.left + 10, y: target.top + 10});
      await sleep(100);
      expect(startedTour().isActive).toBe(true);
      const screen = harness.screenRect();
      await harness.pressAt({x: screen.left + 10, y: screen.bottom - harness.insets.bottom - 10});
      await vi.waitFor(() => {
        expect(onTourEnd).toHaveBeenCalledWith('intro', expect.objectContaining({reason: 'blur'}));
      });
    });

    it('stays open when the dimmed area is pressed before the tour has appeared (a double press on the button that started it)', async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      const gate = deferred();
      startedTour().startTour([{...steps[0]!, onBeforeStep: async () => gate.promise}], 'intro');
      await sleep(50);
      const screen = harness.screenRect();
      await harness.pressAt({x: screen.left + 10, y: screen.bottom - harness.insets.bottom - 10});
      gate.resolve();
      await harness.waitForStep('First step');
      expect(onTourEnd).not.toHaveBeenCalled();
    });

    it('stays open when Next is pressed again while the next step is being prepared', async () => {
      const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
      await renderScreen({onTourEnd});
      const gate = deferred();
      startedTour().startTour([steps[0]!, {...steps[1]!, onBeforeStep: async () => gate.promise}], 'intro');
      await harness.waitForStep('First step');
      const next = page.getByRole('button', {name: 'Next'}).element().getBoundingClientRect();
      await page.getByRole('button', {name: 'Next'}).click();
      await sleep(50);
      await harness.pressAt({x: next.left + next.width / 2, y: next.top + next.height / 2});
      await sleep(100);
      expect(onTourEnd).not.toHaveBeenCalled();
      gate.resolve();
      await harness.waitForStep('Second step');
      expect(startedTour().currentStep).toBe(1);
    });

    it('stays open when the dimmed area is pressed with closeOnOverlayClick={false}', async () => {
      await renderScreen({closeOnOverlayClick: false});
      startedTour().startTour(steps);
      await harness.waitForStep('First step');
      const screen = harness.screenRect();
      await harness.pressAt({x: screen.left + 10, y: screen.bottom - harness.insets.bottom - 10});
      await sleep(100);
      expect(startedTour().isActive).toBe(true);
    });

    it('shows a step without a target in the centre of the safe area', async () => {
      await renderScreen();
      startedTour().startTour([{title: 'Centred', content: 'No target'}]);
      const tooltip = await harness.waitForStep('Centred');
      const box = tooltip.getBoundingClientRect();
      const screen = harness.screenRect();
      const {insets} = harness;
      const centreX = (screen.left + insets.left + screen.right - insets.right) / 2;
      const centreY = (screen.top + insets.top + screen.bottom - insets.bottom) / 2;
      expect(Math.abs(box.left + box.width / 2 - centreX)).toBeLessThan(1.5);
      expect(Math.abs(box.top + box.height / 2 - centreY)).toBeLessThan(1.5);
    });

    it('renders a custom tooltip as content only, with working actions', async () => {
      const received: TourTooltipProps[] = [];
      function Custom(props: TourTooltipProps): ReactNode {
        received.push(props);
        return (
          <ui.Box>
            <ui.Heading id={props.titleId}>{props.step.title}</ui.Heading>
            <ui.Button label="Continue" onPress={props.onNext} />
          </ui.Box>
        );
      }

      await renderScreen({TooltipComponent: Custom});
      startedTour().startTour(steps);
      const tooltip = await harness.waitForStep('First step');
      expect(received.at(-1)).toMatchObject({currentStep: 0, totalSteps: 3, placement: 'bottom'});
      expect(received.at(-1)?.arrowOffset).toEqual(expect.any(Number));
      expectInSafeArea(tooltip.getBoundingClientRect());
      await page.getByRole('button', {name: 'Continue'}).click();
      await harness.waitForStep('Second step');
    });

    it('uses the theme and the texts', async () => {
      await renderScreen({
        theme: {primaryColor: 'rgb(255, 0, 0)'},
        i18n: {nextLabel: 'Weiter', prevLabel: 'Zurück', stepCounterTemplate: 'Schritt {current}/{total}'},
      });
      startedTour().startTour(steps);
      await harness.waitForStep('First step');
      await expect.element(page.getByText('Schritt 1/3')).toBeVisible();
      await expect.element(page.getByRole('button', {name: 'Zurück'})).toBeVisible();
      const next = page.getByRole('button', {name: 'Weiter'}).element();
      expect(getComputedStyle(next).backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('waits for a target that appears after onBeforeStep, then shows it', async () => {
      let showLate: (() => void) | undefined;
      function Late(): ReactNode {
        const [isVisible, setIsVisible] = useState(false);
        useEffect(() => {
          showLate = () => {
            setIsVisible(true);
          };
        }, []);
        return isVisible ? <Target id="late" /> : null;
      }

      await harness.render(
        <>
          <Capture />
          <Spacer height={200} />
          <Late />
        </>,
      );
      startedTour().startTour([
        {
          target: harness.targetOf('late'),
          title: 'Late',
          content: 'Arrived',
          onBeforeStep() {
            setTimeout(() => showLate?.(), 300);
          },
        },
      ]);
      await harness.waitForStep('Late');
    });

    it('waits for a target that slides in from off screen', async () => {
      await renderScreen();
      startedTour().startTour([
        {
          ...steps[0]!,
          onBeforeStep() {
            // A screen sliding in: its content is measured where the animation started, off screen,
            // until the animation ends.
            harness.moveSilently('first', {x: -500, y: 0});
            setTimeout(() => {
              harness.moveSilently('first', {x: 0, y: 0});
            }, 500);
          },
        },
      ]);
      const tooltip = await harness.waitForStep('First step');
      expect(tooltip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        harness.rectOf('first').bottom + highlightPadding - tolerance,
      );
    });

    it('scrolls a target inside a scrollable area into view', async () => {
      await harness.render(
        <>
          <Capture />
          <Spacer height={60} />
          <Scroller height={400}>
            <Spacer height={1500} />
            <Target id="deep" />
            <Spacer height={800} />
          </Scroller>
        </>,
      );
      startedTour().startTour([{target: harness.targetOf('deep'), title: 'Deep', content: 'Far down'}]);
      const tooltip = await harness.waitForStep('Deep');
      const target = harness.rectOf('deep');
      const screen = harness.screenRect();
      expect(target.top).toBeGreaterThanOrEqual(screen.top + harness.insets.top - tolerance);
      expect(target.bottom).toBeLessThanOrEqual(screen.bottom - harness.insets.bottom + tolerance);
      expectInSafeArea(tooltip.getBoundingClientRect());
    });

    it('follows a target that an animation moves after the step appears', async () => {
      await renderScreen();
      startedTour().startTour(steps);
      const tooltip = await harness.waitForStep('First step');
      const before = tooltip.getBoundingClientRect().top;
      harness.moveSilently('first', {x: 0, y: 60});
      await vi.waitFor(
        () => {
          expect(harness.tooltip()!.getBoundingClientRect().top).toBeCloseTo(before + 60, 0);
        },
        {timeout: 1500},
      );
    });

    it('keeps the last step on screen while the tour fades out', async () => {
      await renderScreen();
      startedTour().startTour(steps);
      const shown = await harness.waitForStep('First step');
      startedTour().endTour();
      await sleep(50);
      // The same tooltip, still there: not unmounted and mounted again (which would skip the fade).
      expect(harness.tooltip()).toBe(shown);
      expect(shown.textContent).toContain('First step');
      await vi.waitFor(() => {
        expect(harness.tooltip()).toBeNull();
      });
    });

    it('does no work at all while a step is on screen and nothing changes', async () => {
      let commits = 0;
      await renderScreen(undefined, {
        onCommit() {
          commits++;
        },
      });
      startedTour().startTour(steps);
      await harness.waitForStep('First step');
      // Right after a step appears, the tour checks its target for a moment (animations can move it unannounced).
      await sleep(1300);
      const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect');
      const frames = vi.spyOn(globalThis, 'requestAnimationFrame');
      const before = commits;
      await sleep(1000);
      expect({
        commits: commits - before,
        measurements: measure.mock.calls.length,
        frames: frames.mock.calls.length,
      }).toEqual({commits: 0, measurements: 0, frames: 0});
    });
  });
}
