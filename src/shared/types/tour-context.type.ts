import type {StartTourOptions} from './tour-end-info.type.js';
import type {TourStep} from './tour-step.type.js';

/** What `useTour()` returns. The functions keep their identity for the lifetime of the provider. */
export type TourContextType = {
  /** `true` from `startTour` until the tour ends. */
  readonly isActive: boolean;
  /** Zero-based index of the step on screen. */
  readonly currentStep: number;
  readonly steps: readonly TourStep[];
  readonly currentTourId: string | undefined;
  /**
   * Starts a tour. Starting the tour that is already running (same id, or same steps array without
   * an id) does nothing; starting a different one ends the current tour with the reason `'closed'`.
   */
  readonly startTour: (steps: readonly TourStep[], tourId?: string, options?: StartTourOptions) => void;
  /** Ends the tour with the reason `'closed'`. */
  readonly endTour: () => void;
  /** Goes to the next step, or completes the tour on the last step. */
  readonly nextStep: () => void;
  readonly prevStep: () => void;
  readonly goToStep: (index: number) => void;
};
