import {Platform, StatusBar} from 'react-native';
import type {Insets, Size} from '../shared/geometry/geometry.type.js';

/** Insets the app can pass in (for example from `useSafeAreaInsets()`); missing sides use the defaults. */
export type TourInsets = Partial<Insets>;

/**
 * Conservative safe-area defaults for when the app does not pass `insets`: large enough that the
 * notch, Dynamic Island, home indicator and system bars of current devices are never covered.
 */
export function defaultInsets(layer: Size): Insets {
  const landscape = layer.width > layer.height;
  if (Platform.OS === 'ios') {
    if ((Platform as {isPad?: boolean}).isPad) {
      return {top: 24, right: 0, bottom: 20, left: 0};
    }

    return landscape ? {top: 0, right: 62, bottom: 21, left: 62} : {top: 62, right: 0, bottom: 34, left: 0};
  }

  if (Platform.OS === 'android') {
    const statusBar = Math.max(StatusBar.currentHeight ?? 0, 24);
    // In landscape the camera cutout and the 3-button bar can be on either side (the device can
    // be turned either way), and the gesture handle stays at the bottom.
    return landscape
      ? {top: statusBar, right: 48, bottom: 24, left: 48}
      : {top: statusBar, right: 0, bottom: 48, left: 0};
  }

  return {top: 0, right: 0, bottom: 0, left: 0};
}

/** `keyboardOverlap`: how much of the layer the on-screen keyboard covers. */
export function resolveInsets(provided: TourInsets | undefined, layer: Size, keyboardOverlap: number): Insets {
  const base = provided
    ? {top: provided.top ?? 0, right: provided.right ?? 0, bottom: provided.bottom ?? 0, left: provided.left ?? 0}
    : defaultInsets(layer);
  return {...base, bottom: Math.max(base.bottom, keyboardOverlap)};
}
