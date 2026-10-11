import type {TourPlacement, TourStep} from './tour-step.type.js';

/**
 * Props of a custom `TooltipComponent`. The component only renders the card's content: the tour
 * measures, positions, animates and focuses it, and keeps it on screen.
 */
export type TourTooltipProps = {
  readonly step: TourStep;
  /** Zero-based index of the step. */
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly onClose: () => void;
  readonly onGoToStep: (index: number) => void;
  /** Side of the target the tooltip ended up on, or `'center'` for steps without a target. Use it to draw an arrow. */
  readonly placement: TourPlacement | 'center';
  /**
   * Distance in pixels from the tooltip's left edge (for `top`/`bottom`) or top edge (for
   * `left`/`right`) to where an arrow should point. `undefined` when no arrow should be drawn.
   */
  readonly arrowOffset: number | undefined;
  /** Put `id={titleId}` on the element showing the title so screen readers announce it. */
  readonly titleId: string;
  /** Put `id={descriptionId}` on the element showing the content. */
  readonly descriptionId: string;
};
