import {type RefObject} from 'react';
import {type PlatformAdapter, type Rect, type TourTarget, type KeyboardHandlers} from '../shared/index.js';
import {targetRegistry} from './target-registry';

/**
 * Resolves a tour target to a React ref.
 * Supports both direct refs and string IDs registered via useTourTarget.
 */
function resolveTarget(target: TourTarget): RefObject<unknown> | undefined {
  if (typeof target === 'string') {
    return targetRegistry.get(target);
  }

  return target;
}

/**
 * Measures a React Native component using the measure() API.
 * Returns a promise since RN measurements are async.
 */
async function measureNativeElement(ref: RefObject<unknown>): Promise<Rect | undefined> {
  return new Promise((resolve) => {
    const component = ref.current;
    if (!component) {
      resolve(undefined);
      return;
    }

    // React Native components with measure() method
    type Measureable = {
      measure: (
        callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void,
      ) => void;
    };

    const measureable = component as unknown as Measureable;
    if (typeof measureable.measure !== 'function') {
      resolve(undefined);
      return;
    }

    measureable.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      resolve({
        top: pageY,
        left: pageX,
        width,
        height,
        bottom: pageY + height,
        right: pageX + width,
      });
    });
  });
}

/**
 * React Native platform adapter implementation.
 * Uses RN-specific APIs for measurements, events, and rendering.
 */
export const nativePlatformAdapter: PlatformAdapter = {
  async measureElement(target: TourTarget): Promise<Rect | undefined> {
    const ref = resolveTarget(target);
    if (!ref) {
      return undefined;
    }

    return measureNativeElement(ref);
  },

  measureTooltip(): {width: number; height: number} {
    // In React Native, we typically use onLayout to get dimensions
    // For initial render, return defaults - actual dimensions come from onLayout
    // This is a limitation compared to web, but works with the retry logic
    return {width: 0, height: 0};
  },

  getViewportDimensions(): {width: number; height: number} {
    // Dynamic import to avoid bundling issues

    const {Dimensions} = require('react-native') as typeof import('react-native');
    const {width, height} = Dimensions.get('window');
    return {width, height};
  },

  async scrollToElement(): Promise<void> {
    // React Native scrolling depends on the parent ScrollView
    // This is a no-op by default - users can implement custom scrolling
    // via onBeforeStep in their tour steps
    await Promise.resolve();
  },

  subscribeToKeyboard(handlers: KeyboardHandlers): () => void {
    // React Native keyboard handling is different - typically done via
    // hardware back button on Android or custom UI buttons
    // For now, this is a no-op - navigation is done via UI buttons

    const {BackHandler, Platform} = require('react-native') as typeof import('react-native');

    // Handle Android back button as "escape"
    if (Platform.OS === 'android') {
      const backHandler = (): boolean => {
        handlers.onEscape();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', backHandler);
      return (): void => {
        subscription.remove();
      };
    }

    return (): void => {
      // No cleanup needed for iOS
    };
  },

  subscribeToLayout(callback: () => void): () => void {
    const {Dimensions} = require('react-native') as typeof import('react-native');

    const subscription = Dimensions.addEventListener('change', callback);

    return (): void => {
      subscription.remove();
    };
  },

  scheduleFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  },

  cancelFrame(id: number): void {
    cancelAnimationFrame(id);
  },

  findElement(target: TourTarget): unknown | undefined {
    const ref = resolveTarget(target);
    return ref?.current ?? undefined;
  },
};
