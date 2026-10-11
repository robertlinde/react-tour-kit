import type {Box} from '../../shared/geometry/geometry.type.js';
import type {TourTarget} from '../../shared/types/tour-step.type.js';

export function toBox(rect: DOMRectReadOnly): Box {
  return {x: rect.left, y: rect.top, width: rect.width, height: rect.height};
}

/**
 * False in documents without a layout engine (jsdom, happy-dom in test suites): every size there is
 * zero. A real page always has a size, also a zero-sized frame (its window is zero-sized too).
 */
export function hasLayout(): boolean {
  const root = document.documentElement;
  return root.clientWidth > 0 || root.clientHeight > 0 || globalThis.innerWidth === 0 || globalThis.innerHeight === 0;
}

type VisibilityCheck = (options?: {visibilityProperty?: boolean; opacityProperty?: boolean}) => boolean;

/** `checkVisibility()` where the browser has it. */
export function checkVisibility(
  element: Element,
  options: {visibilityProperty?: boolean; opacityProperty?: boolean},
): boolean | undefined {
  const check = (element as Element & {checkVisibility?: VisibilityCheck}).checkVisibility;
  return typeof check === 'function' ? check.call(element, options) : undefined;
}

/** True when the element takes up space and is not hidden (`display: none`, `visibility: hidden`, closed `<details>`). */
export function isRendered(element: Element): boolean {
  if (!hasLayout()) {
    // Nothing has a size: count every element that is not explicitly hidden.
    return element.isConnected && !element.closest('[hidden]') && getComputedStyle(element).display !== 'none';
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    return false;
  }

  return checkVisibility(element, {visibilityProperty: true}) ?? getComputedStyle(element).visibility !== 'hidden';
}

/**
 * Resolves a target to an element. For selectors, the first rendered match wins, which handles
 * layouts that duplicate markup (for example a mobile and a desktop navigation).
 */
export function resolveTarget(target: TourTarget): Element | undefined {
  if (typeof target === 'string') {
    let matches: NodeListOf<Element>;
    try {
      matches = document.querySelectorAll(target);
    } catch {
      return undefined;
    }

    for (const element of matches) {
      if (isRendered(element)) {
        return element;
      }
    }

    return matches[0] ?? undefined;
  }

  const {current} = target;
  return current instanceof Element ? current : undefined;
}

/** The parent element, crossing shadow-root boundaries. */
export function parentOf(element: Element): Element | undefined {
  if (element.parentElement) {
    return element.parentElement;
  }

  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : undefined;
}

/** `ancestor.contains(element)`, also for elements inside shadow roots of the ancestor's descendants. */
export function containsComposed(ancestor: Element, element: Element): boolean {
  for (let current: Element | undefined = element; current; current = parentOf(current)) {
    if (current === ancestor) {
      return true;
    }
  }

  return false;
}

/**
 * The page's direction. Browsers take it from `<body>` (CSS calls it the principal writing mode),
 * so `<body dir="rtl">` turns the page right-to-left even when `<html>` is left-to-right.
 */
export function pageDirection(): 'ltr' | 'rtl' {
  const element = document.body ?? document.documentElement;
  return getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

const textInputTypes = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
]);

/** Inputs that a space press activates or toggles. */
const pressableInputTypes = new Set(['button', 'submit', 'reset', 'image', 'checkbox', 'file', 'color']);

const arrowKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const rangeKeys = new Set([...arrowKeys, 'PageUp', 'PageDown', 'Home', 'End']);

/** Widgets whose arrow, page, Home and End keys move a selection or change a value. */
const keyedWidgetSelector = [
  'slider',
  'spinbutton',
  'radio',
  'radiogroup',
  'tab',
  'tablist',
  'listbox',
  'option',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tree',
  'treeitem',
  'treegrid',
  'grid',
  'gridcell',
  'combobox',
  'textbox',
  'searchbox',
  'scrollbar',
]
  .map((role) => `[role="${role}"]`)
  .join(', ');

/** Widgets that a space press activates (links do not: space scrolls the page there). */
const pressableSelector =
  'button, summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="option"], [role="tab"], [role="treeitem"], [role^="menuitem"]';

/**
 * True when the focused element handles `key` itself (typing, toggling, choosing, adjusting a
 * value), so the tour neither navigates nor blocks scrolling with it.
 */
export function handlesKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    ((target instanceof HTMLAudioElement || target instanceof HTMLVideoElement) && target.controls)
  ) {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    if (textInputTypes.has(target.type)) {
      return true;
    }

    if (target.type === 'radio') {
      return key === ' ' || arrowKeys.has(key);
    }

    if (target.type === 'range') {
      return rangeKeys.has(key);
    }

    return key === ' ' && pressableInputTypes.has(target.type);
  }

  if (key === ' ') {
    return target.closest(pressableSelector) !== null;
  }

  return rangeKeys.has(key) && target.closest(keyedWidgetSelector) !== null;
}
