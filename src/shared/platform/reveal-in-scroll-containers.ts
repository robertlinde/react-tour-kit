import {withTimeout} from '../engine/abort.util.js';
import {clamp} from '../geometry/box.util.js';
import type {Box, Insets, Point} from '../geometry/geometry.type.js';
import {computeRevealDelta} from '../geometry/reveal.util.js';
import type {ScrollContainer} from './platform.type.js';

export type RevealOptions = {
  /** Innermost container first. */
  readonly containers: readonly ScrollContainer[];
  readonly measureTarget: () => Promise<Box | undefined>;
  /** Space to keep around the target, most generous first (see `buildRevealMargins`). */
  readonly margins: readonly Insets[];
  readonly animated: boolean;
  readonly signal: AbortSignal;
  /**
   * Called once, right before the first container scrolls, with where the target will be once
   * everything has scrolled. Not called if nothing needs to scroll.
   */
  readonly onScrollStart?: (destination: Box) => void;
};

const minimumScroll = 0.5;
/** Safety cap: a scroll that never reports finishing (interrupted, snapped elsewhere) does not hold the tour up longer. */
export const settleTimeoutMs = 1500;

/**
 * Scrolls every container around the target just enough to bring it (plus margin) into view, all
 * at once: each container's scroll is computed innermost first, on the position the target will
 * have after the inner containers have scrolled (an inner scroll moves the target by exactly the
 * scrolled distance), and then all containers scroll together as one movement. Resolves once every
 * container has finished scrolling.
 */
export async function revealInScrollContainers(options: RevealOptions): Promise<boolean> {
  const metrics = await Promise.all(options.containers.map(async (container) => container.measure()));
  let predicted = await options.measureTarget();
  if (options.signal.aborted || !predicted) {
    return false;
  }

  const moves: Array<{readonly container: ScrollContainer; readonly offset: Point}> = [];
  for (const [index, container] of options.containers.entries()) {
    const current = metrics[index];
    if (!current) {
      continue;
    }

    const delta = computeRevealDelta(predicted, current.area, options.margins, current.obstacles);
    const offset: Point = {
      x: clamp(current.offset.x + delta.x, current.minOffset.x, Math.max(current.minOffset.x, current.maxOffset.x)),
      y: clamp(current.offset.y + delta.y, current.minOffset.y, Math.max(current.minOffset.y, current.maxOffset.y)),
    };
    const applied: Point = {x: offset.x - current.offset.x, y: offset.y - current.offset.y};
    if (Math.abs(applied.x) < minimumScroll && Math.abs(applied.y) < minimumScroll) {
      continue;
    }

    moves.push({container, offset});
    // Scrolling by `applied` moves the content (and the target) the other way.
    predicted = {...predicted, x: predicted.x - applied.x, y: predicted.y - applied.y};
  }

  if (moves.length === 0) {
    return false;
  }

  options.onScrollStart?.(predicted);
  await withTimeout(
    async (signal) => {
      await Promise.all(
        moves.map(async (move) => move.container.scrollTo(move.offset, {animated: options.animated, signal})),
      );
      return true;
    },
    options.signal,
    settleTimeoutMs,
  );
  return true;
}
