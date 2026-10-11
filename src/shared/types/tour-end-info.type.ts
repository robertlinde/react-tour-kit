import type {TourStep} from './tour-step.type.js';

/**
 * Why a tour ended.
 * - `completed`: the user finished the last step.
 * - `closed`: the close button, `endTour()`, the Android back button, or another tour was started.
 * - `blur`: the user clicked or tapped the dimmed area (see `closeOnOverlayClick`).
 * - `escape`: Escape on the web, the VoiceOver escape gesture on iOS.
 * - `target-missing`: no remaining step had a target that could be found and shown.
 * - `error`: a step's `onBeforeStep` threw or rejected; see {@link TourEndInfo.error}.
 */
export type TourEndReason = 'completed' | 'closed' | 'blur' | 'escape' | 'target-missing' | 'error';

/** Details about how and where a tour ended. */
export type TourEndInfo = {
  readonly reason: TourEndReason;
  /** Zero-based index of the step the user was on (for `target-missing`: the last step that was tried). */
  readonly stepIndex: number;
  readonly step: TourStep;
  readonly totalSteps: number;
  /** The error thrown by `onBeforeStep` when `reason` is `'error'`. */
  readonly error?: unknown;
};

/** Called once when a tour ends. */
export type TourEndCallback = (tourId: string | undefined, info: TourEndInfo) => void;

/** Options for a single tour, passed to `startTour`. */
export type StartTourOptions = {
  /** Called when this tour ends, before the provider's `onTourEnd`. */
  readonly onTourEnd?: TourEndCallback;
};
