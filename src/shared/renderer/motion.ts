import type {TourPlacement} from '../types/tour-step.type.js';
import type {Entrance} from './renderer.type.js';

/** Timing of every animation, the same on every platform. */
export const motion = {
  fadeInMs: 200,
  fadeOutMs: 150,
  /** With reduced motion turned on: short fades, no movement. */
  reducedMs: 100,
  /** The spotlight moving from one target to the next. */
  morphMs: 250,
  /** The spotlight following a target that is being scrolled into view, frame by frame. */
  chaseMs: 120,
  enterMs: 200,
  /** The tooltip starts entering while the spotlight is still on its way. */
  enterDelayMs: 100,
  /** Distance (from the target's side) and scale the tooltip enters from. */
  enterOffset: 6,
  enterScale: 0.96,
  /**
   * If a step takes longer than this to prepare (navigation, data, a target that is still
   * rendering), the tour shows that it is waiting: the highlight closes and a spinner appears.
   */
  waitingDelayMs: 300,
  /** Control points of the standard easing curve (`cubic-bezier`). */
  easing: [0.2, 0, 0, 1],
} as const;

export function fadeDuration(isClosing: boolean, isReducedMotion: boolean): number {
  if (isReducedMotion) {
    return motion.reducedMs;
  }

  return isClosing ? motion.fadeOutMs : motion.fadeInMs;
}

const entranceDirection: Record<TourPlacement | 'center', readonly [number, number]> = {
  // Above the target: comes down towards it; below: comes up; and so on.
  top: [0, 1],
  bottom: [0, -1],
  left: [1, 0],
  right: [-1, 0],
  center: [0, 0],
};

export function entranceFor(
  placement: TourPlacement | 'center',
  {isDelayed, isReducedMotion}: {readonly isDelayed: boolean; readonly isReducedMotion: boolean},
): Entrance {
  if (isReducedMotion) {
    return {dx: 0, dy: 0, scale: 1, durationMs: motion.reducedMs, delayMs: 0};
  }

  const [x, y] = entranceDirection[placement];
  return {
    dx: x * motion.enterOffset,
    dy: y * motion.enterOffset,
    scale: motion.enterScale,
    durationMs: motion.enterMs,
    delayMs: isDelayed ? motion.enterDelayMs : 0,
  };
}
