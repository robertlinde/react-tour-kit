import {nextFrame, nextFrameOrAfter} from '../engine/abort.util.js';
import type {TargetMeasurement, TourAdapter} from '../engine/tour-adapter.type.js';
import {boxesEqual} from '../geometry/box.util.js';
import type {Box} from '../geometry/geometry.type.js';
import type {TourTarget} from '../types/tour-step.type.js';
import {requestFrame} from '../utils/frame.util.js';
import type {PlatformAdapter} from './platform.type.js';
import {revealInScrollContainers} from './reveal-in-scroll-containers.js';

/** A found target counts as settled once it has not moved for this many frames (screens slide in, drawers expand)... */
const stableFramesNeeded = 2;
/** ...or after this many frames, so a target that never stops moving (a pulsing button) is still shown... */
const maxSettleFrames = 12;
/** ...or after this long: frames stop in background tabs, timers only slow down. */
const maxSettleMs = 300;
/** Longest wait for a frame while settling or watching, for the same reason. */
const settleFrameMs = 50;

function sameMeasurement(a: TargetMeasurement | undefined, b: TargetMeasurement | undefined): boolean {
  return boxesEqual(a?.rect, b?.rect, 0.5) && boxesEqual(a?.clip, b?.clip, 0.5);
}

/**
 * The tour's behaviour on top of a platform: waiting for targets, following them, and scrolling
 * them into view. Shared by every platform, so they behave the same; platforms only provide the
 * raw facts ({@link PlatformAdapter}).
 */
export function createTourAdapter(platform: PlatformAdapter): TourAdapter {
  return {
    measure: platform.measure,

    async waitForTarget(target, signal): Promise<TargetMeasurement | undefined> {
      // Subscribed for the whole wait, so a change between measuring and waiting is never missed.
      let hasChanged = false;
      let wake: (() => void) | undefined;
      const unsubscribe = platform.subscribe(target, () => {
        hasChanged = true;
        wake?.();
      });
      const onAbort = (): void => {
        wake?.();
      };

      const sleepUntilChange = async (): Promise<void> =>
        new Promise<void>((resolve) => {
          wake = resolve;
        });
      signal.addEventListener('abort', onAbort);
      try {
        let previous: Box | undefined;
        let stableFrames = 0;
        let settleFrames = 0;
        let firstSeenAt = 0;
        while (!signal.aborted) {
          hasChanged = false;
          // eslint-disable-next-line no-await-in-loop -- measuring until the target is there and settled
          const current = await platform.measure(target);
          if (signal.aborted) {
            return undefined;
          }

          if (current) {
            stableFrames = previous && boxesEqual(current.rect, previous, 0.5) ? stableFrames + 1 : 0;
            firstSeenAt = settleFrames === 0 ? Date.now() : firstSeenAt;
            settleFrames++;
            const isSettled =
              stableFrames >= stableFramesNeeded ||
              settleFrames > maxSettleFrames ||
              Date.now() - firstSeenAt >= maxSettleMs;
            if (isSettled) {
              return current;
            }

            previous = current.rect;
            // eslint-disable-next-line no-await-in-loop -- see above
            await nextFrameOrAfter(signal, settleFrameMs);
            continue;
          }

          previous = undefined;
          stableFrames = 0;
          settleFrames = 0;
          if (platform.isAwaitingLayout(target)) {
            // eslint-disable-next-line no-await-in-loop -- see above
            await nextFrame(signal);
          } else if (!hasChanged) {
            // Not there yet: sleep until something changes instead of polling.
            // eslint-disable-next-line no-await-in-loop -- see above
            await sleepUntilChange();
            wake = undefined;
          }
        }

        return undefined;
      } finally {
        signal.removeEventListener('abort', onAbort);
        unsubscribe();
      }
    },

    async waitForMove(target, from, signal): Promise<TargetMeasurement | undefined> {
      while (!signal.aborted) {
        // eslint-disable-next-line no-await-in-loop -- one measurement per frame
        await nextFrameOrAfter(signal, settleFrameMs);
        // eslint-disable-next-line no-await-in-loop -- see above
        const current = signal.aborted ? undefined : await platform.measure(target);
        if (!signal.aborted && !sameMeasurement(from, current)) {
          return current;
        }
      }

      return undefined;
    },

    getViewport: platform.getViewport,

    measuresWhileScrolling: platform.measuresWhileScrolling,

    async reveal(target, request): Promise<void> {
      const containers = await platform.scrollContainers(target);
      if (request.signal.aborted) {
        return;
      }

      await revealInScrollContainers({
        containers,
        async measureTarget() {
          const measurement = await platform.measure(target);
          return measurement?.rect;
        },
        margins: request.margins,
        animated: request.behavior === 'smooth' && !platform.reducedMotion.get(),
        signal: request.signal,
        onScrollStart: request.onScrollStart,
      });
    },

    observe(target: TourTarget | undefined, onChange, signal): void {
      if (signal.aborted) {
        return;
      }

      // At most one call per frame, however many events arrive.
      let cancelFrame: (() => void) | undefined;
      const schedule = (): void => {
        if (cancelFrame !== undefined || signal.aborted) {
          return;
        }

        cancelFrame = requestFrame(() => {
          cancelFrame = undefined;
          if (!signal.aborted) {
            onChange();
          }
        });
      };

      const unsubscribe = platform.subscribe(target, schedule);
      signal.addEventListener('abort', () => {
        cancelFrame?.();
        unsubscribe();
      });
    },

    getPixelRatio: platform.getPixelRatio,

    nextFrame,
  };
}
