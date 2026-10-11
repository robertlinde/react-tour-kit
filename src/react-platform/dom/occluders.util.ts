import {intersect} from '../../shared/geometry/box.util.js';
import type {Box} from '../../shared/geometry/geometry.type.js';
import {checkVisibility, containsComposed, toBox} from './elements.util.js';

/**
 * Elements that stay put while the page scrolls (`position: fixed` or `sticky`): navigation bars,
 * headers, floating buttons, chat widgets, cookie banners, toasts. Anything scrolled underneath
 * them is hidden, so the tour scrolls targets clear of them where it can.
 *
 * Hit-testing (`elementsFromPoint`) cannot find them while the tour is open: the tour is a modal
 * dialog and the inert page is excluded from hit-testing. They are found by computed style instead,
 * also inside open shadow roots (web components). The list is cached briefly so following a
 * scrolling target does not rescan the page every frame.
 */
const rescanAfterMs = 500;
let cache: {readonly at: number; readonly elements: readonly Element[]} | undefined;

/** Forgets the cached elements, so a page that has been navigated away from is not kept in memory. */
export function clearOccluderCache(): void {
  cache = undefined;
}

function stayingPutElements(layer: Element | undefined): readonly Element[] {
  const now = performance.now();
  if (cache && now - cache.at < rescanAfterMs) {
    return cache.elements;
  }

  const elements: Element[] = [];
  const scan = (root: ParentNode): void => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) {
        scan(element.shadowRoot);
      }

      const {position} = getComputedStyle(element);
      if (position === 'fixed' || position === 'sticky') {
        elements.push(element);
      }
    }
  };

  scan(document.body);
  const found = elements.filter((element) => !layer?.contains(element) && !element.matches('[data-rtk-probe]'));
  cache = {at: now, elements: found};
  return found;
}

/** False for elements that are there but cannot be seen: closed menus faded out with `visibility` or `opacity`. */
function isSeen(element: Element): boolean {
  const checked = checkVisibility(element, {visibilityProperty: true, opacityProperty: true});
  if (checked !== undefined) {
    return checked;
  }

  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Rectangles (viewport coordinates) of elements that can cover the target. Excluded: elements
 * containing the target (highlighting a link in a sticky navigation) or inside it, empty or
 * invisible ones, and ones covering more than half the screen (app shells, full-screen
 * backgrounds), which cannot be scrolled away from.
 */
export function findOccluders(target: Element | undefined, layer: Element | undefined): Box[] {
  const screen = {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight};
  const occluders: Box[] = [];
  for (const element of stayingPutElements(layer)) {
    if (!element.isConnected || (target && (containsComposed(element, target) || containsComposed(target, element)))) {
      continue;
    }

    const rect = toBox(element.getBoundingClientRect());
    const isCovering =
      rect.width > 0 && rect.height > 0 && rect.width * rect.height <= (screen.width * screen.height) / 2;
    if (isCovering && isSeen(element)) {
      occluders.push(rect);
    }
  }

  return occluders;
}

/** The occluders overlapping `box`. */
export function occludersOver(box: Box, occluders: readonly Box[]): Box[] {
  return occluders.filter((occluder) => intersect(occluder, box) !== undefined);
}
