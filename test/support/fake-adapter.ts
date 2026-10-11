import {boxesEqual} from '../../src/shared/geometry/box.util.js';
import type {Box, Viewport} from '../../src/shared/geometry/geometry.type.js';
import type {RevealRequest, TargetMeasurement, TourAdapter} from '../../src/shared/engine/tour-adapter.type.js';
import type {TourTarget} from '../../src/shared/types/tour-step.type.js';

type Observer = {readonly target: TourTarget | undefined; readonly onChange: () => void; readonly signal: AbortSignal};
type Waiter = {readonly key: string; readonly resolve: (value: TargetMeasurement | undefined) => void};
type Mover = Waiter & {readonly from: TargetMeasurement | undefined};

export type FakeAdapter = {
  readonly adapter: TourAdapter;
  readonly calls: {
    measure: number;
    waitForTarget: number;
    waitForMove: number;
    reveal: RevealRequest[];
    observe: number;
  };
  /** Signals passed to `waitForTarget`, to assert that abandoned waits are aborted. */
  readonly waitSignals: AbortSignal[];
  /** Places, moves or removes a target. No observer is called (see `triggerObservers`), as for an animation. */
  setTarget: (id: string, rect: Box | undefined, clip?: Box, occluders?: readonly Box[]) => void;
  /** Simulates a layout change: calls every active observer. */
  triggerObservers: () => void;
  activeObservers: () => number;
  setViewport: (viewport: Viewport) => void;
  /**
   * Controls what `reveal` does. Default: does nothing (the target is already in view).
   * Return a rect to move the target there (as if it was scrolled), calling onScrollStart first.
   */
  onReveal: (handler: (target: string, request: RevealRequest) => Box | undefined) => void;
  /** Like `onReveal`, for scrolls that take several frames: `onScrollStart` is called first, then the handler runs. */
  onRevealAsync: (handler: (target: string) => Promise<void>) => void;
  /**
   * Makes the next `measure` call wait. Returns a function that resolves it with the target's
   * state at the time `release` is called (or with an explicit rect).
   */
  holdNextMeasure: () => (rect?: Box) => void;
};

const keyOf = (target: TourTarget): string => (typeof target === 'string' ? target : 'ref');
const hasMoved = (from: TargetMeasurement | undefined, to: TargetMeasurement | undefined): boolean =>
  !boxesEqual(from?.rect, to?.rect);

const desktopViewport: Viewport = {
  rect: {x: 0, y: 0, width: 1280, height: 800},
  insets: {top: 0, right: 0, bottom: 0, left: 0},
};

export function createFakeAdapter(
  viewport: Viewport = desktopViewport,
  {measuresWhileScrolling = true}: {measuresWhileScrolling?: boolean} = {},
): FakeAdapter {
  const targets = new Map<string, TargetMeasurement>();
  const observers = new Set<Observer>();
  const waiters = new Set<Waiter>();
  const movers = new Set<Mover>();
  let currentViewport = viewport;
  let revealHandler: ((target: string, request: RevealRequest) => Box | undefined) | undefined;
  let asyncRevealHandler: ((target: string) => Promise<void>) | undefined;
  const calls: FakeAdapter['calls'] = {measure: 0, waitForTarget: 0, waitForMove: 0, reveal: [], observe: 0};
  const heldMeasures: Array<(resolve: (value: TargetMeasurement | undefined) => void, key: string) => void> = [];
  const waitSignals: AbortSignal[] = [];

  const adapter: TourAdapter = {
    async measure(target) {
      calls.measure++;
      const hold = heldMeasures.shift();
      if (hold) {
        return new Promise((resolve) => {
          hold(resolve, keyOf(target));
        });
      }

      return targets.get(keyOf(target));
    },
    async waitForTarget(target, signal) {
      calls.waitForTarget++;
      waitSignals.push(signal);
      const existing = targets.get(keyOf(target));
      if (existing) {
        return existing;
      }

      return new Promise((resolve) => {
        const waiter: Waiter = {key: keyOf(target), resolve};
        waiters.add(waiter);
        signal.addEventListener('abort', () => {
          waiters.delete(waiter);
          resolve(undefined);
        });
      });
    },
    // Event-driven here: resolves when `setTarget` moves the target (no frames to count in tests).
    async waitForMove(target, from, signal) {
      calls.waitForMove++;
      const current = targets.get(keyOf(target));
      if (hasMoved(from, current)) {
        return current;
      }

      return new Promise((resolve) => {
        const mover: Mover = {key: keyOf(target), from, resolve};
        movers.add(mover);
        signal.addEventListener('abort', () => {
          movers.delete(mover);
          resolve(undefined);
        });
      });
    },
    getViewport: () => currentViewport,
    measuresWhileScrolling,
    async reveal(target, request) {
      calls.reveal.push(request);
      if (asyncRevealHandler) {
        const handler = asyncRevealHandler;
        asyncRevealHandler = undefined;
        // The destination is not known up front here; tests of the destination use `onReveal`.
        request.onScrollStart(targets.get(keyOf(target))?.rect ?? {x: 0, y: 0, width: 0, height: 0});
        await handler(keyOf(target));
        return;
      }

      const moved = revealHandler?.(keyOf(target), request);
      if (moved) {
        request.onScrollStart(moved);
        const current = targets.get(keyOf(target));
        targets.set(keyOf(target), {rect: moved, clip: current?.clip});
      }
    },
    observe(target, onChange, signal) {
      calls.observe++;
      const observer: Observer = {target, onChange, signal};
      observers.add(observer);
      signal.addEventListener('abort', () => {
        observers.delete(observer);
      });
    },
    getPixelRatio: () => 1,
    // A "frame" is a macrotask in tests (works with fake timers).
    async nextFrame() {
      await new Promise((resolve) => {
        setTimeout(resolve, 16);
      });
    },
  };

  return {
    adapter,
    calls,
    waitSignals,
    setTarget(id, rect, clip, occluders) {
      if (rect) {
        targets.set(id, {rect, clip, ...(occluders ? {occluders} : {})});
        const pending = [...waiters];
        for (const waiter of pending) {
          if (waiter.key === id) {
            waiters.delete(waiter);
            waiter.resolve(targets.get(id));
          }
        }
      } else {
        targets.delete(id);
      }

      const moved = [...movers].filter((mover) => mover.key === id && hasMoved(mover.from, targets.get(id)));
      for (const mover of moved) {
        movers.delete(mover);
        mover.resolve(targets.get(id));
      }
    },
    triggerObservers() {
      const active = [...observers];
      for (const observer of active) {
        if (!observer.signal.aborted) {
          observer.onChange();
        }
      }
    },
    activeObservers: () => observers.size,
    setViewport(next) {
      currentViewport = next;
    },
    onReveal(handler) {
      revealHandler = handler;
    },
    onRevealAsync(handler) {
      asyncRevealHandler = handler;
    },
    holdNextMeasure() {
      let release: ((rect?: Box) => void) | undefined;
      heldMeasures.push((resolve, key) => {
        release = (rect) => {
          resolve(rect ? {rect, clip: undefined} : targets.get(key));
        };
      });
      return (rect) => {
        release?.(rect);
      };
    },
  };
}
