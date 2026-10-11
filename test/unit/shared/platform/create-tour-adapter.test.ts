import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TargetMeasurement} from '../../../../src/shared/engine/tour-adapter.type.js';
import type {Box, Point} from '../../../../src/shared/geometry/geometry.type.js';
import {createTourAdapter} from '../../../../src/shared/platform/create-tour-adapter.js';
import type {PlatformAdapter, ScrollOptions} from '../../../../src/shared/platform/platform.type.js';

const frameMs = 16;
const rect = (y: number): Box => ({x: 100, y, width: 120, height: 40});

/** A platform whose facts the test controls. */
function createFakePlatform() {
  const state = {
    target: undefined as Box | undefined,
    awaitingLayout: false,
    reducedMotion: false,
    measures: 0,
    listeners: new Set<() => void>(),
    scrolls: [] as Array<{offset: Point; options: ScrollOptions}>,
  };
  const platform: PlatformAdapter = {
    async measure(): Promise<TargetMeasurement | undefined> {
      state.measures++;
      return state.target ? {rect: state.target, clip: undefined} : undefined;
    },
    subscribe(_target, onChange) {
      state.listeners.add(onChange);
      return () => {
        state.listeners.delete(onChange);
      };
    },
    isAwaitingLayout: () => state.awaitingLayout,
    async scrollContainers() {
      return [
        {
          async measure() {
            return {
              area: {x: 0, y: 0, width: 800, height: 600},
              offset: {x: 0, y: 0},
              minOffset: {x: 0, y: 0},
              maxOffset: {x: 0, y: 5000},
            };
          },
          async scrollTo(offset, options) {
            state.scrolls.push({offset, options});
          },
        },
      ];
    },
    getViewport: () => ({rect: {x: 0, y: 0, width: 800, height: 600}, insets: {top: 0, right: 0, bottom: 0, left: 0}}),
    reducedMotion: {get: () => state.reducedMotion, subscribe: () => () => {}},
    measuresWhileScrolling: true,
    getPixelRatio: () => 1,
  };
  const emit = (): void => {
    // Snapshot: listeners unsubscribe while being notified.
    const snapshot = [...state.listeners];
    for (const listener of snapshot) {
      listener();
    }
  };

  return {platform, adapter: createTourAdapter(platform), state, emit};
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, frameMs));
  vi.stubGlobal('cancelAnimationFrame', (handle: ReturnType<typeof setTimeout>) => {
    clearTimeout(handle);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createTourAdapter: waiting for a target', () => {
  it('returns a target once it has stopped moving', async () => {
    const {adapter, state} = createFakePlatform();
    state.target = rect(500);
    let result: TargetMeasurement | undefined;
    void adapter.waitForTarget('t', new AbortController().signal).then((value) => {
      result = value;
    });
    // Sliding in: still moving for a few frames.
    for (const y of [400, 300, 200]) {
      await vi.advanceTimersByTimeAsync(frameMs);
      state.target = rect(y);
    }

    await vi.advanceTimersByTimeAsync(frameMs);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(frameMs * 3);
    expect(result?.rect).toEqual(rect(200));
  });

  it('does not wait forever for a target that never stops moving (a pulsing button)', async () => {
    const {adapter, state} = createFakePlatform();
    let tick = 0;
    state.target = rect(100);
    let result: TargetMeasurement | undefined;
    void adapter.waitForTarget('t', new AbortController().signal).then((value) => {
      result = value;
    });
    for (let frame = 0; frame < 20; frame++) {
      if (result) {
        break;
      }

      tick++;
      state.target = rect(100 + (tick % 2));
      await vi.advanceTimersByTimeAsync(frameMs);
    }

    expect(result).toBeDefined();
  });

  it('finds a target in a background tab, where browsers stop animation frames but not timers', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const {adapter, state} = createFakePlatform();
    state.target = rect(100);
    let result: TargetMeasurement | undefined;
    void adapter.waitForTarget('t', new AbortController().signal).then((value) => {
      result = value;
    });
    // Background tabs run timers about once a second.
    await vi.advanceTimersByTimeAsync(1000);
    expect(result?.rect).toEqual(rect(100));
  });

  it('sleeps until the platform reports a change, instead of measuring every frame', async () => {
    const {adapter, state, emit} = createFakePlatform();
    let result: TargetMeasurement | undefined;
    void adapter.waitForTarget('t', new AbortController().signal).then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.measures).toBe(1);
    state.target = rect(100);
    emit();
    await vi.advanceTimersByTimeAsync(frameMs * 4);
    expect(result?.rect).toEqual(rect(100));
    // Done waiting: no longer subscribed.
    expect(state.listeners.size).toBe(0);
  });

  it('checks every frame while the target awaits layout (nothing announces it)', async () => {
    const {adapter, state} = createFakePlatform();
    state.awaitingLayout = true;
    let result: TargetMeasurement | undefined;
    void adapter.waitForTarget('t', new AbortController().signal).then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(frameMs * 5);
    expect(state.measures).toBeGreaterThanOrEqual(5);
    state.target = rect(100);
    await vi.advanceTimersByTimeAsync(frameMs * 4);
    expect(result?.rect).toEqual(rect(100));
  });

  it('stops waiting and unsubscribes when aborted', async () => {
    const {adapter, state} = createFakePlatform();
    const controller = new AbortController();
    const wait = adapter.waitForTarget('t', controller.signal);
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    expect(await wait).toBeUndefined();
    expect(state.listeners.size).toBe(0);
  });
});

describe('createTourAdapter: following', () => {
  it('reports changes at most once per frame, and nothing while nothing changes', async () => {
    const {adapter, emit} = createFakePlatform();
    const onChange = vi.fn();
    const controller = new AbortController();
    adapter.observe('t', onChange, controller.signal);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).not.toHaveBeenCalled();
    emit();
    emit();
    emit();
    await vi.advanceTimersByTimeAsync(frameMs);
    expect(onChange).toHaveBeenCalledOnce();
    controller.abort();
    emit();
    await vi.advanceTimersByTimeAsync(frameMs);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('createTourAdapter: revealing', () => {
  const request = (behavior: 'smooth' | 'instant') => ({
    margins: [{top: 20, right: 20, bottom: 20, left: 20}],
    behavior,
    signal: new AbortController().signal,
    onScrollStart() {},
  });

  it('scrolls smoothly, or instantly when the user prefers reduced motion', async () => {
    const {adapter, state} = createFakePlatform();
    state.target = rect(2000);
    await adapter.reveal('t', request('smooth'));
    expect(state.scrolls.at(-1)?.options.animated).toBe(true);
    state.reducedMotion = true;
    await adapter.reveal('t', request('smooth'));
    expect(state.scrolls.at(-1)?.options.animated).toBe(false);
  });
});
