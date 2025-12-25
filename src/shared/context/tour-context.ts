import {createContext} from 'react';
import {type TourContextType} from '../types';

/**
 * Default context value with no-op functions.
 * Used when components are rendered outside of TourProvider.
 */
export const defaultTourContext: TourContextType = {
  isActive: false,
  currentStep: 0,
  steps: [],
  currentTourId: undefined,
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Default context placeholder
  startTour() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Default context placeholder
  endTour() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Default context placeholder
  nextStep() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Default context placeholder
  prevStep() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Default context placeholder
  goToStep() {},
};

/**
 * React context for tour state and controls.
 * Shared between web and React Native implementations.
 */

export const TourContext = createContext<TourContextType>(defaultTourContext);
