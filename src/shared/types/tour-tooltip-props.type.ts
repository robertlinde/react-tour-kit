import {type TourTheme} from './tour-theme.type';

export type TourTooltipProps = {
  readonly title: string;
  readonly content: string;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly position: {top: number; left: number};
  readonly isPositioned: boolean;
  readonly onClose: () => void;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly onGoToStep: (step: number) => void;
  readonly theme: Required<TourTheme>;
};
