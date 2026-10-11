import type {ReactNode, RefObject} from 'react';

/**
 * Preferred side of the target for the tooltip. If there is not enough room on that side, the
 * tooltip moves to the opposite side, then to the roomier of the remaining sides.
 */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * What a step highlights.
 * - Web: a CSS selector such as `'[data-tour="settings"]'`, or a ref to a DOM element.
 * - React Native: an id registered with `useTourTarget`, or a ref to a native view.
 */
export type TourTarget = string | RefObject<unknown>;

/** Second argument of {@link TourStep.onBeforeStep}. */
export type TourStepContext = {
  /**
   * Aborted when the step is abandoned before it is shown (the user navigates elsewhere or the
   * tour ends). Pass it to `fetch` or check `signal.aborted` in long-running work.
   */
  readonly signal: AbortSignal;
};

export type TourStep = {
  /** The element to highlight. Leave it out for a step that is shown in the centre of the screen. */
  readonly target?: TourTarget;
  readonly title: ReactNode;
  readonly content: ReactNode;
  /** @defaultValue `'bottom'` */
  readonly placement?: TourPlacement;
  /**
   * Runs before the step is shown, for example to navigate to another page or open a menu.
   * The tour then waits (up to 5 seconds) for the target to appear, so there is no need to poll.
   *
   * Make it idempotent: it runs again if the user comes back to this step.
   * If it throws or rejects, the tour ends with the reason `'error'`.
   */
  readonly onBeforeStep?: (target: TourTarget | undefined, context: TourStepContext) => void | Promise<void>;
};
