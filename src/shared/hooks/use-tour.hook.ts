'use client';

import {use} from 'react';
// eslint-disable-next-line import-x/extensions
import {TourContext} from '../context';
// eslint-disable-next-line import-x/extensions
import {type TourContextType} from '../types';

export function useTour(): TourContextType {
  return use(TourContext);
}
