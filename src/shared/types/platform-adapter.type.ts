import {type RefObject} from 'react';
import {type Rect, type TourTarget} from './rect.type';

/**
 * Keyboard event handlers for tour navigation.
 */
export type KeyboardHandlers = {
  readonly onEscape: () => void;
  readonly onNext: () => void;
  readonly onPrev: () => void;
};

/**
 * Platform adapter interface that abstracts DOM/native-specific operations.
 * Each platform (web, native) provides its own implementation.
 */
export type PlatformAdapter = {
  /**
   * Measures an element's position and dimensions.
   * @param target - CSS selector (web) or ref/ID (native)
   * @returns Promise resolving to Rect or null if element not found
   */
  readonly measureElement: (target: TourTarget) => Promise<Rect | undefined>;

  /**
   * Gets the dimensions of the tooltip element for positioning calculations.
   * @param ref - Reference to the tooltip element
   * @returns Width and height of the tooltip
   */
  readonly measureTooltip: (ref: RefObject<unknown>) => {width: number; height: number};

  /**
   * Gets the current viewport dimensions.
   * @returns Width and height of the viewport
   */
  readonly getViewportDimensions: () => {width: number; height: number};

  /**
   * Scrolls the viewport to make the target element visible.
   * @param target - Element to scroll into view
   */
  readonly scrollToElement: (target: TourTarget) => Promise<void>;

  /**
   * Subscribes to keyboard events for tour navigation.
   * @param handlers - Callbacks for escape, next, and previous actions
   * @returns Cleanup function to unsubscribe
   */
  readonly subscribeToKeyboard: (handlers: KeyboardHandlers) => () => void;

  /**
   * Subscribes to layout changes (resize, scroll) to update positioning.
   * @param callback - Function to call when layout changes
   * @returns Cleanup function to unsubscribe
   */
  readonly subscribeToLayout: (callback: () => void) => () => void;

  /**
   * Schedules a callback to run on the next animation frame.
   * @param callback - Function to execute
   * @returns Frame ID for cancellation
   */
  readonly scheduleFrame: (callback: () => void) => number;

  /**
   * Cancels a scheduled animation frame.
   * @param id - Frame ID returned by scheduleFrame
   */
  readonly cancelFrame: (id: number) => void;

  /**
   * Finds the first visible element matching the target.
   * @param target - CSS selector (web) or ref/ID (native)
   * @returns The element or null if not found/visible
   */
  readonly findElement: (target: TourTarget) => unknown | undefined;
};
