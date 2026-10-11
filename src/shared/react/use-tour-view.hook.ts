import {useContext, useSyncExternalStore} from 'react';
import type {TourEngine, TourViewState} from '../engine/tour-engine.js';
import {TourEngineContext} from './tour-context.js';

export function useTourEngineContext(): TourEngine {
  const engine = useContext(TourEngineContext);
  if (!engine) {
    throw new Error('[react-tour-kit] This component must be rendered inside <TourProvider>.');
  }

  return engine;
}

/** What the renderer draws. Re-renders only on structural changes (step, phase, layout). */
export function useTourView(engine: TourEngine): TourViewState {
  return useSyncExternalStore(engine.subscribe, engine.getViewState, engine.getViewState);
}
