import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Box} from '../../../src/shared/geometry/geometry.type.js';
import {createTourAdapter} from '../../../src/shared/platform/create-tour-adapter.js';
import {createNativePlatform} from '../../../src/react-native-platform/native-platform.js';
import {createRegistry} from '../../../src/react-native-platform/registry.js';

// Edge cases found in review: views next to scroll views, content that rests away from offset 0,
// and views the Old Architecture cannot measure on screen.

type FakeView = {
  readonly parent: FakeView | undefined;
  readonly box: () => Box;
  readonly getBoundingClientRect?: () => Box;
  readonly measure?: (callback: (...values: number[]) => void) => void;
  readonly measureLayout: (ancestor: unknown, onSuccess: (...values: number[]) => void, onFail: () => void) => void;
};

/** A view in a fake hierarchy; `measureLayout` fails for views that are not ancestors, like React Native's. */
function fakeView(box: () => Box, parent?: FakeView, options: {measurable?: boolean} = {}): FakeView {
  const self: FakeView = {
    parent,
    box,
    // The Old Architecture on Android: `measure` reports nothing for views it cannot find on screen.
    ...((options.measurable ?? true)
      ? {getBoundingClientRect: box}
      : {
          measure(callback: () => void) {
            callback();
          },
        }),
    measureLayout(ancestor, onSuccess, onFail) {
      for (let current = self.parent; current; current = current.parent) {
        if (current === ancestor) {
          const own = box();
          const origin = current.box();
          onSuccess(own.x - origin.x, own.y - origin.y, own.width, own.height);
          return;
        }
      }

      onFail();
    },
  };
  return self;
}

const host = fakeView(() => ({x: 0, y: 0, width: 390, height: 844}));

const noInsets = {top: 0, right: 0, bottom: 0, left: 0};

function setup(page: {readonly instance: unknown}, target: unknown, insets = noInsets) {
  const registry = createRegistry();
  registry.registerScrollView({current: page.instance});
  registry.registerTarget('t', {current: target});
  const platform = createNativePlatform({
    registry,
    getHost: () => ({instance: host, size: {width: 390, height: 844}}),
    getInsets: () => insets,
    subscribeLayout: () => () => {},
    reducedMotion: {get: () => false, subscribe: () => () => {}},
    getPixelRatio: () => 3,
  });
  return {platform, adapter: createTourAdapter(platform)};
}

/**
 * A page scroll view (visible from y 100 to 750, content 2000 high). Its content can rest away
 * from the viewport's origin (`contentContainerStyle` margins, iOS content insets).
 */
function pageScrollView(options: {offset?: number; restX?: number; restY?: number} = {}) {
  const state = {offset: options.offset ?? 0, requested: [] as Array<{x?: number; y?: number}>};
  const restX = options.restX ?? 0;
  const restY = options.restY ?? 0;
  const screen = fakeView(() => ({x: 0, y: 0, width: 390, height: 844}));
  const viewport = fakeView(() => ({x: 0, y: 100, width: 390, height: 650}), screen);
  const content = fakeView(
    () => ({x: restX, y: 100 + restY - state.offset, width: 390 - 2 * restX, height: 2000}),
    viewport,
  );
  const instance = {
    getNativeScrollRef: () => viewport,
    getInnerViewRef: () => content,
    scrollTo({x, y = 0, animated = true}: {x?: number; y?: number; animated?: boolean}) {
      state.requested.push({x, y});
      setTimeout(
        () => {
          // The content keeps its margin: offsets are measured from the viewport to the content.
          state.offset = Math.max(0, Math.min(y + restY, 2000 - 650));
        },
        animated ? 300 : 0,
      );
    },
  };
  return {state, screen, content, instance};
}

const margins = [{top: 20, right: 20, bottom: 20, left: 20}];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal('cancelAnimationFrame', (handle: ReturnType<typeof setTimeout>) => {
    clearTimeout(handle);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('native platform: edge cases', () => {
  it('does not count a header button above a scrolled page as inside the page', async () => {
    const page = pageScrollView({offset: 500});
    // Geometrically inside the page's content (which reaches far above the screen), but not in the page.
    const header = fakeView(() => ({x: 300, y: 50, width: 40, height: 40}), page.screen);
    const {platform, adapter} = setup(page, header);
    const measurement = await platform.measure('t');
    expect(measurement?.clip).toBeUndefined();
    const reveal = adapter.reveal('t', {
      margins,
      behavior: 'smooth',
      signal: new AbortController().signal,
      onScrollStart() {},
    });
    await vi.advanceTimersByTimeAsync(2000);
    await reveal;
    expect(page.state.requested).toEqual([]);
  });

  it('does not count a tab bar button below the page as inside it (views with `contains`)', async () => {
    const page = pageScrollView();
    const tab = fakeView(() => ({x: 150, y: 770, width: 90, height: 40}), page.screen);
    const content = Object.assign(page.content, {contains: (other: unknown) => other !== tab});
    const {platform} = setup({instance: {...page.instance, getInnerViewRef: () => content}}, tab);
    const measurement = await platform.measure('t');
    expect(measurement?.clip).toBeUndefined();
  });

  it('measures a view the Old Architecture cannot find on screen through the scroll view it is in', async () => {
    const page = pageScrollView({offset: 200});
    const card = fakeView(() => ({x: 20, y: 100 + 1200 - 200, width: 200, height: 80}), page.content, {
      measurable: false,
    });
    const {platform} = setup(page, card);
    const measurement = await platform.measure('t');
    expect(measurement?.rect).toEqual({x: 20, y: 1100, width: 200, height: 80});
    expect(measurement?.clip).toEqual({x: 0, y: 100, width: 390, height: 650});
  });

  it('does not scroll a visible target in content with side margins, nor wait for a scroll', async () => {
    const page = pageScrollView({restX: 16});
    const card = fakeView(() => ({x: 36, y: 400, width: 200, height: 80}), page.content);
    const {adapter} = setup(page, card);
    let isDone = false;
    void adapter
      .reveal('t', {margins, behavior: 'smooth', signal: new AbortController().signal, onScrollStart() {}})
      .then(() => {
        isDone = true;
      });
    await vi.advanceTimersByTimeAsync(50);
    expect(isDone).toBe(true);
    expect(page.state.requested).toEqual([]);
  });

  it('does not scroll content resting below a translucent header (iOS content inset) to offset 0', async () => {
    const page = pageScrollView({restY: 100});
    const card = fakeView(() => ({x: 20, y: 500, width: 200, height: 80}), page.content);
    const {adapter} = setup(page, card);
    const reveal = adapter.reveal('t', {
      margins,
      behavior: 'smooth',
      signal: new AbortController().signal,
      onScrollStart() {},
    });
    await vi.advanceTimersByTimeAsync(2000);
    await reveal;
    expect(page.state.requested).toEqual([]);
  });

  it('scrolls a target above the keyboard when the scroll view reaches behind it (edge to edge)', async () => {
    const page = pageScrollView();
    // The page scroll view runs to the bottom of the screen; the keyboard covers its lower part.
    const field = fakeView(() => ({x: 20, y: 100 + 1000 - page.state.offset, width: 300, height: 48}), page.content);
    const {adapter, platform} = setup(page, field, {top: 0, right: 0, bottom: 400, left: 0});
    const reveal = adapter.reveal('t', {
      margins,
      behavior: 'smooth',
      signal: new AbortController().signal,
      onScrollStart() {},
    });
    await vi.advanceTimersByTimeAsync(2000);
    await reveal;
    const measurement = await platform.measure('t');
    expect(measurement!.rect.y + measurement!.rect.height).toBeLessThanOrEqual(844 - 400 - 20);
  });

  it('finishes a scroll that stops a little short of the requested offset as soon as it has stopped', async () => {
    // Content with a top margin: scrolling to an offset ends 16 points short of it.
    const page = pageScrollView({restY: 16, restX: 16});
    const card = fakeView(
      () => ({x: 36, y: 100 + 16 + 1500 - page.state.offset, width: 200, height: 80}),
      page.content,
    );
    const {adapter} = setup(page, card);
    let doneAt: number | undefined;
    const startedAt = Date.now();
    void adapter
      .reveal('t', {margins, behavior: 'smooth', signal: new AbortController().signal, onScrollStart() {}})
      .then(() => {
        doneAt = Date.now() - startedAt;
      });
    await vi.advanceTimersByTimeAsync(3000);
    expect(page.state.requested).toHaveLength(1);
    // The animation takes 300 ms; then a few still frames. Not the 1.5 s safety cap.
    expect(doneAt).toBeLessThan(600);
  });
});
