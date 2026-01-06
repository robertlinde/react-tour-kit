import {type TourI18n} from './tour-i18n.type';
import {type TourTheme} from './tour-theme.type';

/**
 * Props for the tooltip component displayed during a tour.
 */
export type TourTooltipProps = {
  /** Title text for the current step. */
  readonly title: string;
  /** Content/description text for the current step. */
  readonly content: string;
  /** Zero-based index of the current step. */
  readonly currentStep: number;
  /** Total number of steps in the tour. */
  readonly totalSteps: number;
  /** Calculated position for the tooltip. */
  readonly position: {top: number; left: number};
  /** Whether the tooltip position has been calculated and is ready to display. */
  readonly isPositioned: boolean;
  /** Callback to close/end the tour. */
  readonly onClose: () => void;
  /** Callback to advance to the next step. */
  readonly onNext: () => void;
  /** Callback to go back to the previous step. */
  readonly onPrev: () => void;
  /** Callback to jump to a specific step by index. */
  readonly onGoToStep: (step: number) => void;
  /** Theme configuration for styling. */
  readonly theme: Required<TourTheme>;
  /** Internationalization options for customizing text strings. */
  readonly i18n?: TourI18n;
};
