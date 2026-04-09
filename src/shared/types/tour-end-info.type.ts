import {type TourStep} from './tour-step.type';

/**
 * Reason a tour ended.
 * - `completed` — user clicked Finish on the last step.
 * - `closed` — user clicked the close (✕) button in the tooltip, or `endTour()` was called programmatically.
 * - `blur` — user clicked/tapped the overlay outside the highlighted element.
 * - `escape` — user pressed the Escape key (web only).
 * - `target-missing` — the step's target element could not be measured and the tour had to end.
 */
export type TourEndReason = 'completed' | 'closed' | 'blur' | 'escape' | 'target-missing';

/**
 * Details about how and where a tour ended.
 * Passed as the second argument to end callbacks.
 */
export type TourEndInfo = {
  readonly reason: TourEndReason;
  /** Zero-based index of the step the user was on when the tour ended. */
  readonly stepIndex: number;
  /** The step object the user was on when the tour ended. */
  readonly step: TourStep;
  /** Total number of steps in the tour. */
  readonly totalSteps: number;
};

/**
 * Callback fired when a tour ends.
 * The second argument provides context about why and where the tour ended.
 */
export type TourEndCallback = (tourId: string | undefined, info: TourEndInfo) => void;

/**
 * Per-tour options passed to `startTour`.
 */
export type StartTourOptions = {
  /**
   * Callback fired when this specific tour ends.
   * Fires before the provider-level `onTourEnd`.
   */
  readonly onTourEnd?: TourEndCallback;
};
