import {type TourStep} from './tour-step.type';

export type TourContextType = {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  currentTourId: string | undefined;
  startTour: (steps: TourStep[], tourId?: string) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
};
