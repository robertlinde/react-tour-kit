import {createContext} from 'react';
import {devWarn} from '../engine/report.util.js';
import type {TourEngine} from '../engine/tour-engine.js';
import type {TourContextType} from '../types/tour-context.type.js';

function outsideProvider(): void {
  devWarn('useTour() was called outside of <TourProvider>; the call has no effect.');
}

const defaultTourContext: TourContextType = {
  isActive: false,
  currentStep: 0,
  steps: [],
  currentTourId: undefined,
  startTour: outsideProvider,
  endTour: outsideProvider,
  nextStep: outsideProvider,
  prevStep: outsideProvider,
  goToStep: outsideProvider,
};

/** Public tour state and actions (what `useTour()` returns). */
export const TourContext = createContext(defaultTourContext);
TourContext.displayName = 'TourContext';

/** The engine, for the built-in renderer and platform hooks. Not part of the public API. */
export const TourEngineContext = createContext<TourEngine | undefined>(undefined);
TourEngineContext.displayName = 'TourEngineContext';
