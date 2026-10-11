import type {Insets, Size} from '../shared/geometry/geometry.type.js';
import {resolveInsets, type TourInsets} from './insets.util.js';

/**
 * Values the native platform reads at measuring time (outside React rendering): safe-area insets
 * and the on-screen keyboard. Updated by the provider in effects.
 */
export type NativeEnvironment = {
  readonly setInsets: (insets: TourInsets | undefined) => void;
  /** How much of the layer the keyboard covers. Returns whether that changed. */
  readonly setKeyboardOverlap: (overlap: number) => boolean;
  readonly getInsets: (layer: Size) => Insets;
};

export function createNativeEnvironment(): NativeEnvironment {
  let insets: TourInsets | undefined;
  let keyboardOverlap = 0;
  return {
    setInsets(value): void {
      insets = value;
    },
    setKeyboardOverlap(overlap): boolean {
      const next = Number.isFinite(overlap) ? Math.max(0, overlap) : 0;
      if (Math.abs(next - keyboardOverlap) < 0.5) {
        return false;
      }

      keyboardOverlap = next;
      return true;
    },
    getInsets: (layer) => resolveInsets(insets, layer, keyboardOverlap),
  };
}
