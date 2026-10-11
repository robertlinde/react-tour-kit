import {type ReactNode, useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import type {TourAdapter} from '../engine/tour-adapter.type.js';
import {createTourEngine, type TourEngine} from '../engine/tour-engine.js';
import type {TourContextType} from '../types/tour-context.type.js';
import type {TourEndCallback} from '../types/tour-end-info.type.js';
import {TourContext, TourEngineContext} from './tour-context.js';
import {useIsomorphicLayoutEffect} from './use-isomorphic-layout-effect.hook.js';

/** Creates the engine once and keeps its options in sync with the latest props. */
export function useTourEngine(adapter: TourAdapter, onTourEnd: TourEndCallback | undefined): TourEngine {
  const [engine] = useState(() => createTourEngine({adapter, onTourEnd}));
  // Latest props: callback identity never matters, so inline callbacks cannot restart anything.
  useIsomorphicLayoutEffect(() => {
    engine.configure({adapter, onTourEnd});
  });
  useEffect(() => engine.mount(), [engine]);
  return engine;
}

type TourRootProps = {
  readonly engine: TourEngine;
  readonly children: ReactNode;
};

/** Provides the public tour context (for `useTour`) and the engine (for the renderer). */
export function TourRoot({engine, children}: TourRootProps): ReactNode {
  const state = useSyncExternalStore(engine.subscribe, engine.getPublicState, engine.getPublicState);
  const value = useMemo<TourContextType>(() => ({...state, ...engine.actions}), [state, engine]);
  return (
    <TourEngineContext.Provider value={engine}>
      <TourContext.Provider value={value}>{children}</TourContext.Provider>
    </TourEngineContext.Provider>
  );
}
