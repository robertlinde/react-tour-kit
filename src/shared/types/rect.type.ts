import {type RefObject} from 'react';

/**
 * Platform-agnostic rectangle representing element position and dimensions.
 * Compatible with DOMRect on web and measure() results on React Native.
 */
export type Rect = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly bottom: number;
  readonly right: number;
};

/**
 * Tour target identifier.
 * - Web: CSS selector string (e.g., '#my-button', '.welcome-card')
 * - React Native: RefObject or string ID registered via useTourTarget
 */
export type TourTarget = string | RefObject<unknown>;

/**
 * Tooltip placement relative to the target element.
 */
export type Placement = 'top' | 'bottom' | 'left' | 'right';
