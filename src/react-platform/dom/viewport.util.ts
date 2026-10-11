import {zeroInsets} from '../../shared/geometry/box.util.js';
import type {Box, Insets, Viewport} from '../../shared/geometry/geometry.type.js';

let probe: HTMLElement | undefined;

/**
 * Safe-area insets (notch, home indicator) via `env(safe-area-inset-*)`. They are only non-zero
 * when the page opts in with `viewport-fit=cover`.
 */
export function readSafeAreaInsets(): Insets {
  if (typeof document === 'undefined' || !document.body) {
    return zeroInsets;
  }

  if (!probe?.isConnected) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.dataset.rtkProbe = '';
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.append(probe);
  }

  const style = getComputedStyle(probe);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
}

let probeUsers = 0;

/** Registers a user of the safe-area probe; the returned function releases it and removes the probe when unused. */
export function acquireSafeAreaProbe(): () => void {
  probeUsers++;
  return () => {
    probeUsers--;
    if (probeUsers === 0) {
      probe?.remove();
      probe = undefined;
    }
  };
}

/**
 * The part of the page the user sees, in the coordinate space of `position: fixed` elements
 * (the layout viewport): the visual viewport (pinch-zoom, on-screen keyboard), without scrollbars.
 */
export function readVisibleRect(): Box {
  const root = document.documentElement;
  const layoutWidth = root.clientWidth || window.innerWidth;
  const layoutHeight = root.clientHeight || window.innerHeight;
  const visual = window.visualViewport;
  if (!visual) {
    return {x: 0, y: 0, width: layoutWidth, height: layoutHeight};
  }

  const x = Math.max(0, visual.offsetLeft);
  const y = Math.max(0, visual.offsetTop);
  return {
    x,
    y,
    width: Math.max(0, Math.min(visual.width, layoutWidth - x)),
    height: Math.max(0, Math.min(visual.height, layoutHeight - y)),
  };
}

/** The visible area and its safe-area insets (notch, home indicator). */
export function readViewport(): Viewport {
  return {rect: readVisibleRect(), insets: readSafeAreaInsets()};
}
