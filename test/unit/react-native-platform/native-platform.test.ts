import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Box} from '../../../src/shared/geometry/geometry.type.js';
import {createTourAdapter} from '../../../src/shared/platform/create-tour-adapter.js';
import {createNativePlatform} from '../../../src/react-native-platform/native-platform.js';
import {createRegistry} from '../../../src/react-native-platform/registry.js';

/**
 * A screen like the demo's home screen, as React Native's New Architecture reports it on iOS:
 * measurements come from the shadow tree, which only learns a scroll view's new offset once the
 * scroll animation has finished.
 *
 * - The page scrolls vertically: visible from y 96 to 844, content 1700 high.
 * - Inside the page, at content y 850 (below the fold), a horizontal list 88 high, content 1412 wide.
 * - The target is the list's last card, at list content x 1228.
 */
const animationMs = 300;

function view(box: () => Box) {
  return {getBoundingClientRect: () => box()};
}

/** How the horizontal list exposes itself: like a `FlatList`, or like a `SectionList` (scroll responder only). */
type ListShape = 'flat-list' | 'section-list';

function createScene(listShape: ListShape = 'flat-list') {
  const page = {offset: 0, requested: [] as number[]};
  const list = {offset: 0, requested: [] as number[]};
  const pageViewport: Box = {x: 0, y: 96, width: 390, height: 748};
  const listTop = (): number => pageViewport.y + 850 - page.offset;

  const scrollPage = (y: number, animated: boolean): void => {
    page.requested.push(y);
    setTimeout(
      () => {
        page.offset = y;
      },
      animated ? animationMs : 0,
    );
  };

  const scrollList = (x: number, animated: boolean): void => {
    list.requested.push(x);
    setTimeout(
      () => {
        list.offset = x;
      },
      animated ? animationMs : 0,
    );
  };

  const pageInstance = {
    getNativeScrollRef: () => view(() => pageViewport),
    getInnerViewRef: () => view(() => ({x: 0, y: pageViewport.y - page.offset, width: 390, height: 1700})),
    scrollTo({y = 0, animated = true}: {x?: number; y?: number; animated?: boolean}) {
      scrollPage(y, animated);
    },
  };
  // The ScrollView inside the list, which lists expose as their scroll responder.
  const listScrollView = {
    getNativeScrollRef: () => view(() => ({x: 0, y: listTop(), width: 390, height: 88})),
    getInnerViewRef: () => view(() => ({x: -list.offset, y: listTop(), width: 1412, height: 88})),
    scrollTo({x = 0, animated = true}: {x?: number; y?: number; animated?: boolean}) {
      scrollList(x, animated);
    },
  };
  const listInstance =
    listShape === 'flat-list'
      ? {
          getNativeScrollRef: listScrollView.getNativeScrollRef,
          getScrollResponder: () => listScrollView,
          scrollToOffset({offset, animated = true}: {offset: number; animated?: boolean}) {
            scrollList(offset, animated);
          },
        }
      : {getScrollResponder: () => listScrollView, scrollToLocation() {}};
  const target = view(() => ({x: 1228 - list.offset, y: listTop(), width: 160, height: 88}));
  const host = view(() => ({x: 0, y: 0, width: 390, height: 844}));

  const registry = createRegistry();
  registry.registerScrollView({current: pageInstance});
  registry.registerScrollView({current: listInstance});
  registry.registerTarget('card', {current: target});

  const adapter = createTourAdapter(
    createNativePlatform({
      registry,
      getHost: () => ({instance: host, size: {width: 390, height: 844}}),
      getInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
      subscribeLayout: () => () => {},
      reducedMotion: {get: () => false, subscribe: () => () => {}},
      getPixelRatio: () => 3,
    }),
  );
  return {adapter, page, list};
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

describe('native platform: revealing a target', () => {
  it.each<ListShape>(['flat-list', 'section-list'])(
    'scrolls a horizontal list (%s) below the fold and the page around it',
    async (shape) => {
      const {adapter, page, list} = createScene(shape);
      const reveal = adapter.reveal('card', {
        margins,
        behavior: 'smooth',
        signal: new AbortController().signal,
        onScrollStart() {},
      });
      await vi.advanceTimersByTimeAsync(1000);
      await reveal;
      expect(list.requested).toHaveLength(1);
      expect(page.requested).toHaveLength(1);
      const measurement = await adapter.measure('card');
      expect(measurement?.rect.x).toBeGreaterThanOrEqual(20);
      expect((measurement?.rect.x ?? 0) + 160).toBeLessThanOrEqual(390 - 20);
      expect(measurement?.rect.y).toBeGreaterThanOrEqual(96 + 20);
      expect((measurement?.rect.y ?? 0) + 88).toBeLessThanOrEqual(844 - 20);
    },
  );

  it('waits until the measurements have caught up with the scroll, not just until they stop changing', async () => {
    const {adapter} = createScene();
    let isDone = false;
    void adapter
      .reveal('card', {margins, behavior: 'smooth', signal: new AbortController().signal, onScrollStart() {}})
      .then(() => {
        isDone = true;
      });
    // The measurements stay the same during the animation: that must not count as settled.
    await vi.advanceTimersByTimeAsync(animationMs - 50);
    expect(isDone).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(isDone).toBe(true);
  });

  it('tells where the target will end up when scrolling starts', async () => {
    const {adapter} = createScene();
    const onScrollStart = vi.fn();
    const reveal = adapter.reveal('card', {
      margins,
      behavior: 'smooth',
      signal: new AbortController().signal,
      onScrollStart,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await reveal;
    expect(onScrollStart).toHaveBeenCalledOnce();
    const measurement = await adapter.measure('card');
    expect(onScrollStart).toHaveBeenCalledWith(measurement?.rect);
  });

  it('measures the target as clipped by the list and the page', async () => {
    const {adapter} = createScene();
    const measurement = await adapter.measure('card');
    // The list is below the fold: nothing of it is visible, and the clip says where it is (below).
    expect(measurement?.clip).toEqual({x: 0, y: 844, width: 390, height: 0});
  });
});
