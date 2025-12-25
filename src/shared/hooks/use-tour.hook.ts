'use client';

import {use} from 'react';
import {TourContext} from '../context';
import {type TourContextType} from '../types';

export function useTour(): TourContextType {
  return use(TourContext);
}
