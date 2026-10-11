import {useContext} from 'react';
import type {TourContextType} from '../types/tour-context.type.js';
import {TourContext} from './tour-context.js';

/**
 * The current tour's state and the functions to control it. The functions keep their identity for
 * the lifetime of the `TourProvider`, so they are safe to use in effect dependencies.
 */
export function useTour(): TourContextType {
  return useContext(TourContext);
}
