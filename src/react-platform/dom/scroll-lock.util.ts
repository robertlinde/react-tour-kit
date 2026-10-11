import {handlesKey, hasLayout} from './elements.util.js';
import {readPageOverflow} from './scroll.util.js';

function canScroll(element: Element, deltaX: number, deltaY: number): boolean {
  const style = getComputedStyle(element);
  const scrollsY = /auto|scroll|overlay/u.test(style.overflowY) && element.scrollHeight > element.clientHeight;
  const scrollsX = /auto|scroll|overlay/u.test(style.overflowX) && element.scrollWidth > element.clientWidth;
  if (scrollsY && deltaY !== 0) {
    const atTop = element.scrollTop <= 0;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
      return true;
    }
  }

  if (scrollsX && deltaX !== 0) {
    const max = element.scrollWidth - element.clientWidth;
    const position = Math.abs(element.scrollLeft);
    if ((deltaX < 0 && position > 0) || (deltaX > 0 && position < max - 1)) {
      return true;
    }
  }

  return false;
}

/** True when `from` or one of its ancestors (up to `boundary`) can scroll further in the given direction. */
function canScrollWithin(from: EventTarget | null, boundary: Element, deltaX: number, deltaY: number): boolean {
  for (
    let element = from instanceof Element ? from : null;
    element && element !== boundary;
    element = element.parentElement
  ) {
    if (canScroll(element, deltaX, deltaY)) {
      return true;
    }
  }

  return false;
}

/**
 * The scrollable part of the tooltip (the built-in card's body, or a custom tooltip that does not
 * fit) that can scroll in the given direction, when the focus is on the tooltip itself: browsers
 * only scroll the focused element's ancestors with the keyboard, never its descendants.
 */
function scrollableInTooltip(from: EventTarget | null, layer: Element, deltaY: number): Element | undefined {
  const frame =
    from === layer
      ? layer.querySelector('[data-rtk-tooltip]:not([data-hidden])')
      : from instanceof Element
        ? from.closest('[data-rtk-tooltip]')
        : null;
  if (!frame || !(from instanceof Element) || (from !== layer && !frame.contains(from))) {
    return undefined;
  }

  return [frame, ...frame.querySelectorAll('*')].find((element) => canScroll(element, 0, deltaY));
}

/** How far each scrolling key scrolls: pixels, or `page` / `end`. */
function keyScroll(event: KeyboardEvent): {readonly direction: -1 | 1; readonly amount: number | 'page' | 'end'} {
  // Ctrl/Cmd with an arrow goes all the way.
  const arrowAmount = event.ctrlKey || event.metaKey ? 'end' : 40;
  switch (event.key) {
    case 'ArrowUp': {
      return {direction: -1, amount: arrowAmount};
    }

    case 'ArrowDown': {
      return {direction: 1, amount: arrowAmount};
    }

    case 'PageUp': {
      return {direction: -1, amount: 'page'};
    }

    case 'Home': {
      return {direction: -1, amount: 'end'};
    }

    case 'End': {
      return {direction: 1, amount: 'end'};
    }

    default: {
      // PageDown, and the space bar (with Shift: up).
      return {direction: event.key === ' ' && event.shiftKey ? -1 : 1, amount: 'page'};
    }
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const scrollKeys = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);

/** Where smooth keyboard scrolls are heading, so quick presses add up like the browser's own. */
const keyScrollDestinations = new WeakMap<Element, {readonly top: number; readonly at: number}>();
const smoothScrollMs = 400;

function scrollByKey(element: Element, direction: -1 | 1, amount: number | 'page' | 'end'): void {
  const max = element.scrollHeight - element.clientHeight;
  const pending = keyScrollDestinations.get(element);
  const from = pending && performance.now() - pending.at < smoothScrollMs ? pending.top : element.scrollTop;
  const distance = amount === 'end' ? max : amount === 'page' ? element.clientHeight * 0.875 : amount;
  const top = Math.min(max, Math.max(0, from + direction * distance));
  const isSmooth = !prefersReducedMotion();
  keyScrollDestinations.set(element, {top, at: performance.now()});
  element.scrollTo({top, behavior: isSmooth ? 'smooth' : 'instant'});
}

type PageLock = {readonly overflow: {readonly x: string; readonly y: string}; readonly release: () => void};
let pageLock: PageLock | undefined;
let pageLockUsers = 0;

/** The page's own overflow, also while the tour has locked it. */
export function pageOverflow(): {readonly x: string; readonly y: string} {
  return pageLock?.overflow ?? readPageOverflow();
}

/**
 * Hides the page's scrollbar (`overflow: hidden` on `<html>`), so it cannot be dragged while the
 * tour is open; programmatic scrolling still works. Only where that cannot move anything: with
 * overlay scrollbars, which take no space (macOS, mobile). Hiding a classic scrollbar would widen
 * the page (browsers drop the space of styled scrollbars even with `scrollbar-gutter: stable`), and
 * pages cannot block it (the wheel over it scrolls the page whatever its listeners do), so it stays
 * usable; the tour keeps the target in view when it is used. Pages whose `<body>` has an overflow of
 * its own, and pinch-zoomed pages, are left alone too.
 */
function lockPage(): PageLock {
  const overflow = readPageOverflow();
  const root = document.documentElement;
  const body = document.body ? getComputedStyle(document.body) : undefined;
  const isRootOverflow =
    getComputedStyle(root).overflowY !== 'visible' ||
    !body ||
    (body.overflowX === 'visible' && body.overflowY === 'visible');
  const hasClassicScrollbar =
    globalThis.innerWidth - root.clientWidth > 0.5 || globalThis.innerHeight - root.clientHeight > 0.5;
  const isZoomed = Math.abs((globalThis.visualViewport?.scale ?? 1) - 1) >= 0.01;
  if (!hasLayout() || !isRootOverflow || hasClassicScrollbar || isZoomed) {
    return {
      overflow,
      release(): void {
        // Nothing was changed.
      },
    };
  }

  const hadStyle = root.hasAttribute('style');
  const previous = ['overflow-x', 'overflow-y'].map(
    (property) => [property, root.style.getPropertyValue(property), root.style.getPropertyPriority(property)] as const,
  );
  root.style.setProperty('overflow-x', 'hidden');
  root.style.setProperty('overflow-y', 'hidden');
  return {
    overflow,
    release(): void {
      for (const [property, value, priority] of previous) {
        if (value) {
          root.style.setProperty(property, value, priority);
        } else {
          root.style.removeProperty(property);
        }
      }

      if (!hadStyle && !root.getAttribute('style')) {
        root.removeAttribute('style');
      }
    },
  };
}

function acquirePageLock(): () => void {
  pageLockUsers++;
  pageLock ??= lockPage();
  let isReleased = false;
  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    pageLockUsers--;
    if (pageLockUsers === 0) {
      pageLock?.release();
      pageLock = undefined;
    }
  };
}

/**
 * Keeps the page from scrolling while the tour is open (wheel, touch, keyboard, overlay scrollbars), so
 * the user cannot scroll the highlighted element out of view. Scrolling inside the tooltip still
 * works, with the keyboard too, and so do keys that controls in the tooltip use themselves.
 * Programmatic scrolling (the tour's own, or the app's) is not affected. Returns the cleanup.
 */
export function lockScroll(layer: HTMLElement): () => void {
  let touchX = 0;
  let touchY = 0;
  const releasePage = acquirePageLock();
  const onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey && !canScrollWithin(event.target, layer, event.deltaX, event.deltaY)) {
      event.preventDefault();
    }
  };

  const onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (touch) {
      touchX = touch.clientX;
      touchY = touch.clientY;
    }
  };

  const onTouchMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    // Two fingers: pinch-zoom stays available.
    if (!touch || event.touches.length > 1) {
      return;
    }

    if (!canScrollWithin(event.target, layer, touchX - touch.clientX, touchY - touch.clientY)) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!scrollKeys.has(event.key) || event.defaultPrevented || handlesKey(event.target, event.key)) {
      return;
    }

    const {direction, amount} = keyScroll(event);
    if (canScrollWithin(event.target, layer, 0, direction)) {
      // The browser scrolls the focused element's scrollable ancestor.
      return;
    }

    event.preventDefault();
    const scrollable = scrollableInTooltip(event.target, layer, direction);
    if (scrollable) {
      scrollByKey(scrollable, direction, amount);
    }
  };

  layer.addEventListener('wheel', onWheel, {passive: false});
  layer.addEventListener('touchstart', onTouchStart, {passive: true});
  layer.addEventListener('touchmove', onTouchMove, {passive: false});
  layer.addEventListener('keydown', onKeyDown);
  return () => {
    releasePage();
    layer.removeEventListener('wheel', onWheel);
    layer.removeEventListener('touchstart', onTouchStart);
    layer.removeEventListener('touchmove', onTouchMove);
    layer.removeEventListener('keydown', onKeyDown);
  };
}
