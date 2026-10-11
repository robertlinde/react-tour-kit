import {describe, expect, it, vi} from 'vitest';
import {bottom} from '../../../../src/shared/geometry/box.util.js';
import type {Box, Insets, Point} from '../../../../src/shared/geometry/geometry.type.js';
import type {ScrollContainer} from '../../../../src/shared/platform/platform.type.js';
import {
  revealInScrollContainers,
  settleTimeoutMs,
} from '../../../../src/shared/platform/reveal-in-scroll-containers.js';

const uniform = (value: number): Insets => ({top: value, right: value, bottom: value, left: value});
const shift = (box: Box, delta: Point): Box => ({...box, x: box.x - delta.x, y: box.y - delta.y});

describe('revealInScrollContainers', () => {
  type FakeContainer = ScrollContainer & {offset: Point; calls: Point[]};

  /** A container whose area is fixed and whose scrolling moves `target` (shared between nested containers). */
  function fakeContainer(area: Box, maxOffset: Point, target: {box: Box}): FakeContainer {
    const container: FakeContainer = {
      offset: {x: 0, y: 0},
      calls: [],
      async measure() {
        return {area, offset: container.offset, minOffset: {x: 0, y: 0}, maxOffset};
      },
      async scrollTo(next) {
        target.box = shift(target.box, {x: next.x - container.offset.x, y: next.y - container.offset.y});
        container.offset = next;
        container.calls.push(next);
      },
    };
    return container;
  }

  it('scrolls nested containers together, as one movement, and reports that it scrolled', async () => {
    const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
    const inner = fakeContainer({x: 0, y: 900, width: 400, height: 300}, {x: 0, y: 5000}, target);
    const outer = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 5000}, target);
    const onScrollStart = vi.fn();
    const scrolled = await revealInScrollContainers({
      containers: [inner, outer],
      measureTarget: async () => target.box,
      margins: [uniform(20)],
      animated: true,
      signal: new AbortController().signal,
      onScrollStart,
    });
    expect(scrolled).toBe(true);
    expect(onScrollStart).toHaveBeenCalledOnce();
    // It was told where the target ends up, before anything moved.
    expect(onScrollStart).toHaveBeenCalledWith(target.box);
    expect(inner.calls).toHaveLength(1);
    expect(outer.calls).toHaveLength(1);
    // The prediction was exact: the target ends up inside both containers.
    expect(target.box.y).toBeGreaterThanOrEqual(900 + 20 - outer.offset.y);
    expect(bottom(target.box)).toBeLessThanOrEqual(900 + 300 - 20 - outer.offset.y);
    expect(target.box.y).toBeGreaterThanOrEqual(20);
    expect(bottom(target.box)).toBeLessThanOrEqual(800 - 20);
  });

  it('stays within the range each container allows: from where content rests, and not at all on a locked axis', async () => {
    // Content resting 100 points down (a content inset), with a horizontal axis the tour must not scroll.
    const target = {box: {x: 900, y: -300, width: 100, height: 40}};
    const range = {minOffset: {x: 50, y: -100}, maxOffset: {x: 50, y: 5000}};
    const calls: Point[] = [];
    const container: ScrollContainer = {
      async measure() {
        return {area: {x: 0, y: 0, width: 400, height: 800}, offset: {x: 50, y: 0}, ...range};
      },
      async scrollTo(next) {
        calls.push(next);
      },
    };
    await revealInScrollContainers({
      containers: [container],
      measureTarget: async () => target.box,
      margins: [uniform(20)],
      animated: false,
      signal: new AbortController().signal,
    });
    expect(calls).toEqual([{x: 50, y: -100}]);
  });

  it('does nothing (and does not call onScrollStart) when the target is already in view', async () => {
    const target = {box: {x: 20, y: 100, width: 100, height: 40}};
    const page = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 5000}, target);
    const onScrollStart = vi.fn();
    const scrolled = await revealInScrollContainers({
      containers: [page],
      measureTarget: async () => target.box,
      margins: [uniform(20)],
      animated: true,
      signal: new AbortController().signal,
      onScrollStart,
    });
    expect(scrolled).toBe(false);
    expect(onScrollStart).not.toHaveBeenCalled();
    expect(page.calls).toEqual([]);
  });

  it('never scrolls beyond the scrollable range', async () => {
    const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
    const page = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 300}, target);
    await revealInScrollContainers({
      containers: [page],
      measureTarget: async () => target.box,
      margins: [uniform(20)],
      animated: false,
      signal: new AbortController().signal,
    });
    expect(page.calls).toEqual([{x: 0, y: 300}]);
  });

  it('does not scroll when aborted before it starts', async () => {
    const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
    const page = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 5000}, target);
    const controller = new AbortController();
    const reveal = revealInScrollContainers({
      containers: [page],
      async measureTarget() {
        controller.abort();
        return target.box;
      },
      margins: [uniform(20)],
      animated: true,
      signal: controller.signal,
    });
    expect(await reveal).toBe(false);
    expect(page.calls).toEqual([]);
  });

  it('skips containers that are not rendered', async () => {
    const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
    const page = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 5000}, target);
    const detached: ScrollContainer = {measure: async () => undefined, scrollTo: vi.fn(async () => {})};
    await revealInScrollContainers({
      containers: [detached, page],
      measureTarget: async () => target.box,
      margins: [uniform(20)],
      animated: true,
      signal: new AbortController().signal,
    });
    expect(detached.scrollTo).not.toHaveBeenCalled();
    expect(page.calls).toHaveLength(1);
  });

  it('resolves once every container has finished scrolling', async () => {
    vi.useFakeTimers();
    try {
      const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
      const inner = fakeContainer({x: 0, y: 900, width: 400, height: 300}, {x: 0, y: 5000}, target);
      const outer = fakeContainer({x: 0, y: 0, width: 400, height: 800}, {x: 0, y: 5000}, target);
      const slow = (container: FakeContainer, ms: number): ScrollContainer => ({
        measure: container.measure,
        async scrollTo(offset, options) {
          await container.scrollTo(offset, options);
          await new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
        },
      });
      let isDone = false;
      void revealInScrollContainers({
        containers: [slow(inner, 100), slow(outer, 400)],
        measureTarget: async () => target.box,
        margins: [uniform(20)],
        animated: true,
        signal: new AbortController().signal,
      }).then(() => {
        isDone = true;
      });
      await vi.advanceTimersByTimeAsync(300);
      expect(isDone).toBe(false);
      await vi.advanceTimersByTimeAsync(150);
      expect(isDone).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops waiting for a scroll that never reports finishing', async () => {
    vi.useFakeTimers();
    try {
      const target = {box: {x: 20, y: 1500, width: 100, height: 40}};
      const stuck: ScrollContainer = {
        async measure() {
          return {
            area: {x: 0, y: 0, width: 400, height: 800},
            offset: {x: 0, y: 0},
            minOffset: {x: 0, y: 0},
            maxOffset: {x: 0, y: 5000},
          };
        },
        scrollTo: async () =>
          new Promise(() => {
            // Never resolves.
          }),
      };
      let isDone = false;
      void revealInScrollContainers({
        containers: [stuck],
        measureTarget: async () => target.box,
        margins: [uniform(20)],
        animated: true,
        signal: new AbortController().signal,
      }).then(() => {
        isDone = true;
      });
      await vi.advanceTimersByTimeAsync(settleTimeoutMs - 10);
      expect(isDone).toBe(false);
      await vi.advanceTimersByTimeAsync(20);
      expect(isDone).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
