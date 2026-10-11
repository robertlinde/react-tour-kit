import {deflate, narrowClip} from '../../shared/geometry/box.util.js';
import type {Box, Insets, Point} from '../../shared/geometry/geometry.type.js';
import type {ScrollContainer, ScrollContainerMetrics, ScrollOptions} from '../../shared/platform/platform.type.js';
import {requestFrame} from '../../shared/utils/frame.util.js';
import {pageDirection, parentOf} from './elements.util.js';
import {occludersOver} from './occluders.util.js';
import {readViewport} from './viewport.util.js';

const clippingOverflow = new Set(['hidden', 'scroll', 'auto', 'overlay', 'clip']);
/**
 * Overflow the user can scroll. `hidden` only clips: what it shows is up to the app (carousels,
 * sliders, off-canvas menus), so the tour never scrolls it.
 */
const userScrollable = new Set(['scroll', 'auto', 'overlay']);

/** Which axes of a scroll container the tour may scroll. */
export type ScrollAxes = {readonly x: boolean; readonly y: boolean};

/**
 * True for elements whose overflow is the page's (CSS overflow propagation): `<html>`, and `<body>`
 * unless `<html>` has an overflow of its own (then `<body>` is a scroll container like any other).
 */
function holdsPageOverflow(element: Element): boolean {
  if (element === document.documentElement) {
    return true;
  }

  return element === document.body && getComputedStyle(document.documentElement).overflowY === 'visible';
}

/** The page's own overflow per axis (from `<html>`, or from `<body>` when `<html>` has none). */
export function readPageOverflow(): {readonly x: string; readonly y: string} {
  const root = getComputedStyle(document.documentElement);
  const style = root.overflowY === 'visible' && document.body ? getComputedStyle(document.body) : root;
  return {x: style.overflowX, y: style.overflowY};
}

function isSet(value: string): boolean {
  return value !== '' && value !== 'none';
}

/**
 * True when an element with `style` is the containing block of `position: absolute` (or `fixed`)
 * descendants: their position, clipping and scrolling come from it, not from the elements between.
 */
function isContainingBlock(style: CSSStyleDeclaration, of: 'absolute' | 'fixed'): boolean {
  if (of === 'absolute' && style.position !== 'static') {
    return true;
  }

  return (
    ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter', 'backdrop-filter'].some((property) =>
      isSet(style.getPropertyValue(property)),
    ) ||
    /layout|paint|strict|content/u.test(style.getPropertyValue('contain')) ||
    /transform|translate|rotate|scale|perspective|filter/u.test(style.getPropertyValue('will-change')) ||
    !['', 'normal'].includes(style.getPropertyValue('container-type')) ||
    style.getPropertyValue('content-visibility') === 'auto'
  );
}

function escapeOf(position: string): 'absolute' | 'fixed' | undefined {
  return position === 'absolute' || position === 'fixed' ? position : undefined;
}

function paddingBox(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + element.clientLeft,
    y: rect.top + element.clientTop,
    width: element.clientWidth,
    height: element.clientHeight,
  };
}

/** A computed length (`20px`, `10%`, `calc(10% + 20px)`) in pixels; percentages refer to `basis`. */
export function resolveLength(value: string, basis: number): number {
  const expression = value.startsWith('calc(') && value.endsWith(')') ? value.slice(5, -1) : value;
  let total = 0;
  let sign = 1;
  for (const token of expression.trim().split(/\s+/u)) {
    if (token === '+' || token === '-') {
      sign = token === '-' ? -1 : 1;
      continue;
    }

    const match = /^(-?[\d.]+(?:e[+-]?\d+)?)(px|%)$/iu.exec(token);
    if (!match?.[1]) {
      // `auto`, or an expression this does not understand.
      return Number.parseFloat(value) || 0;
    }

    const amount = Number(match[1]);
    total += sign * (match[2] === '%' ? (amount / 100) * basis : amount);
  }

  return Number.isFinite(total) ? total : 0;
}

function scrollPadding(element: Element, size: {readonly width: number; readonly height: number}): Insets {
  const style = getComputedStyle(element);
  return {
    top: resolveLength(style.scrollPaddingTop, size.height),
    right: resolveLength(style.scrollPaddingRight, size.width),
    bottom: resolveLength(style.scrollPaddingBottom, size.height),
    left: resolveLength(style.scrollPaddingLeft, size.width),
  };
}

type Ancestors = {
  /** Scroll containers that move the target, innermost first (the page itself is not included). */
  readonly scrollers: ReadonlyArray<{readonly element: Element; readonly axes: ScrollAxes}>;
  /** Intersection of every clipping ancestor's padding box, or `undefined` when nothing clips. */
  readonly clip: Box | undefined;
  /** True when the target sits inside a `position: fixed` element, so scrolling the page does not move it. */
  readonly fixed: boolean;
};

/**
 * Walks up from `element`, collecting the scroll containers and clipping that apply to it. An
 * absolutely positioned element escapes the overflow of the ancestors between it and its
 * containing block (a dropdown sticking out of a navigation bar); a fixed one escapes everything
 * up to the page.
 */
export function inspectAncestors(element: Element): Ancestors {
  const scrollers: Array<{element: Element; axes: ScrollAxes}> = [];
  let clip: Box | undefined;
  let escaping = escapeOf(getComputedStyle(element).position);
  for (let current = parentOf(element); current && current !== document.documentElement; current = parentOf(current)) {
    if (holdsPageOverflow(current)) {
      continue;
    }

    const style = getComputedStyle(current);
    if (escaping) {
      if (!isContainingBlock(style, escaping)) {
        continue;
      }

      escaping = undefined;
    }

    const clips = clippingOverflow.has(style.overflowX) || clippingOverflow.has(style.overflowY);
    // `display: contents` elements have no box, so their overflow does nothing.
    if (clips && style.display !== 'contents') {
      clip = narrowClip(clip, paddingBox(current));
      const axes = {
        x: userScrollable.has(style.overflowX) && current.scrollWidth > current.clientWidth + 1,
        y: userScrollable.has(style.overflowY) && current.scrollHeight > current.clientHeight + 1,
      };
      if (axes.x || axes.y) {
        scrollers.push({element: current, axes});
      }
    }

    escaping = escapeOf(style.position);
  }

  return {scrollers, clip, fixed: escaping === 'fixed'};
}

function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === 'rtl';
}

/** Where the tour may scroll on each axis: from 0 to the end where it may, nowhere where it must not. */
function scrollRange(
  offset: Point,
  max: Point,
  axes: ScrollAxes,
): Pick<ScrollContainerMetrics, 'minOffset' | 'maxOffset'> {
  return {
    minOffset: {x: axes.x ? 0 : offset.x, y: axes.y ? 0 : offset.y},
    maxOffset: {x: axes.x ? max.x : offset.x, y: axes.y ? max.y : offset.y},
  };
}

/** A nested scroll container. Horizontal offsets are normalised to [0, max] in right-to-left containers too. */
export function elementContainer(element: Element, axes: ScrollAxes, occluders: () => readonly Box[]): ScrollContainer {
  const maxX = (): number => Math.max(0, element.scrollWidth - element.clientWidth);
  const read = (): Point => ({
    x: isRtl(element) ? element.scrollLeft + maxX() : element.scrollLeft,
    y: element.scrollTop,
  });
  return {
    async measure(): Promise<ScrollContainerMetrics | undefined> {
      if (!element.isConnected) {
        return undefined;
      }

      const box = paddingBox(element);
      const area = deflate(box, scrollPadding(element, box));
      const offset = read();
      return {
        area,
        obstacles: occludersOver(area, occluders()),
        offset,
        ...scrollRange(offset, {x: maxX(), y: Math.max(0, element.scrollHeight - element.clientHeight)}, axes),
      };
    },
    async scrollTo(offset, options): Promise<void> {
      element.scrollTo({
        left: isRtl(element) ? offset.x - maxX() : offset.x,
        top: offset.y,
        behavior: options.animated ? 'smooth' : 'instant',
      });
      await waitForScrollEnd(element, read, offset, options);
    },
  };
}

/**
 * The page itself; its visible area is the visual viewport minus safe areas and the page's
 * scroll-padding. `overflow` is the page's own (see `readPageOverflow`), not the tour's scroll lock.
 */
export function pageContainer(
  occluders: () => readonly Box[],
  overflow: {readonly x: string; readonly y: string},
): ScrollContainer {
  const root = (): Element => document.scrollingElement ?? document.documentElement;
  const maxX = (): number => Math.max(0, root().scrollWidth - root().clientWidth);
  const read = (): Point => ({
    x: pageDirection() === 'rtl' ? globalThis.scrollX + maxX() : globalThis.scrollX,
    y: globalThis.scrollY,
  });
  // The page scrolls unless the app keeps an axis from scrolling (`overflow-x: hidden` against
  // stray horizontal overflow, off-canvas menus): then the tour leaves that axis alone too.
  const axes = {x: !['hidden', 'clip'].includes(overflow.x), y: !['hidden', 'clip'].includes(overflow.y)};
  return {
    async measure(): Promise<ScrollContainerMetrics | undefined> {
      const viewport = readViewport();
      const visible = deflate(viewport.rect, viewport.insets);
      const size = {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight};
      const offset = read();
      return {
        area: deflate(visible, scrollPadding(document.documentElement, size)),
        // Sticky headers, floating buttons, banners: the target is scrolled clear of them where possible.
        obstacles: occluders(),
        offset,
        ...scrollRange(offset, {x: maxX(), y: Math.max(0, root().scrollHeight - root().clientHeight)}, axes),
      };
    },
    async scrollTo(offset, options): Promise<void> {
      globalThis.scrollTo({
        left: pageDirection() === 'rtl' ? offset.x - maxX() : offset.x,
        top: offset.y,
        behavior: options.animated ? 'smooth' : 'instant',
      });
      await waitForScrollEnd(globalThis, read, offset, options);
    },
  };
}

/** Frames without movement after which a smooth scroll counts as finished (it moved, or it never started). */
const stillFramesAfterMoving = 3;
const stillFramesWithoutMoving = 8;

/**
 * Resolves once a scroll of `scroller` has finished: at `scrollend` where browsers support it, or
 * once the offset has reached `requested`, or has stopped changing (scroll snapping can end the
 * scroll elsewhere). Instant scrolls finish on the next frame.
 */
async function waitForScrollEnd(
  scroller: EventTarget,
  read: () => Point,
  requested: Point,
  {animated, signal}: ScrollOptions,
): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    let cancelFrame: () => void;
    let previous = read();
    let stillFrames = 0;
    let hasMoved = false;
    const finish = (): void => {
      cancelFrame();
      scroller.removeEventListener('scrollend', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };

    const tick = (): void => {
      const current = read();
      const isStill = Math.abs(current.x - previous.x) < 0.5 && Math.abs(current.y - previous.y) < 0.5;
      hasMoved ||= !isStill;
      stillFrames = isStill ? stillFrames + 1 : 0;
      previous = current;
      const hasArrived = Math.abs(current.x - requested.x) <= 1 && Math.abs(current.y - requested.y) <= 1;
      const isDone =
        !animated ||
        (hasArrived && isStill) ||
        stillFrames >= (hasMoved ? stillFramesAfterMoving : stillFramesWithoutMoving);
      if (isDone) {
        finish();
      } else {
        cancelFrame = requestFrame(tick);
      }
    };

    if (animated) {
      scroller.addEventListener('scrollend', finish);
    }

    signal.addEventListener('abort', finish);
    cancelFrame = requestFrame(tick);
  });
}
