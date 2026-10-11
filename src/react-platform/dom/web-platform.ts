import type {TargetMeasurement} from '../../shared/engine/tour-adapter.type.js';
import type {ExternalValue, PlatformAdapter, ScrollContainer} from '../../shared/platform/platform.type.js';
import type {TourTarget} from '../../shared/types/tour-step.type.js';
import {hasLayout, isRendered, resolveTarget, toBox} from './elements.util.js';
import {clearOccluderCache, findOccluders, occludersOver} from './occluders.util.js';
import {pageOverflow} from './scroll-lock.util.js';
import {elementContainer, inspectAncestors, pageContainer} from './scroll.util.js';
import {readViewport} from './viewport.util.js';

export type WebPlatform = PlatformAdapter & {
  /**
   * Adds the element the tour is drawn into at the end of `<body>`. Its changes are ignored, it is
   * skipped when looking for elements covering the target, and its pointer, focus and key events
   * stay inside it. Returns the element to render into and the cleanup.
   */
  readonly mountHost: () => {readonly container: HTMLElement; readonly unmount: () => void};
};

/**
 * Events that must not reach the app's listeners on `<body>`, `document` or `window`: "click
 * outside" handlers of menus and popovers (which would close the menu a step highlights), focus
 * traps of the app's own dialogs, and keyboard shortcuts. The page is inert while the tour is
 * open, so nothing in it expects them.
 */
const isolatedEvents = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'focusin',
  'focusout',
  'keydown',
  'keyup',
] as const;

/** Where a target is reported in documents without layout (jsdom), so tours still run in tests: at the top of the screen. */
const placeholderRect = {x: 0, y: 0, width: 1, height: 1};

function measureElement(element: Element, host: Element | undefined): TargetMeasurement | undefined {
  if (!element.isConnected || !isRendered(element)) {
    return undefined;
  }

  if (!hasLayout()) {
    return {rect: placeholderRect, clip: undefined, occluders: []};
  }

  const rect = toBox(element.getBoundingClientRect());
  return {rect, clip: inspectAncestors(element).clip, occluders: occludersOver(rect, findOccluders(element, host))};
}

/** `prefers-reduced-motion`, live. */
function reducedMotionQuery(): ExternalValue<boolean> {
  const query =
    typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  return {
    get: () => query?.matches ?? false,
    subscribe(listener) {
      query?.addEventListener('change', listener);
      return () => {
        query?.removeEventListener('change', listener);
      };
    },
  };
}

/** The web's raw facts for the tour: measuring elements, layout events, scroll containers, the visible area. */
export function createWebPlatform(): WebPlatform {
  let host: HTMLElement | undefined;
  const isOwnNode = (node: Node): boolean => host?.contains(node) ?? false;
  const measureTarget = (target: TourTarget): TargetMeasurement | undefined => {
    const element = resolveTarget(target);
    return element ? measureElement(element, host) : undefined;
  };

  return {
    async measure(target): Promise<TargetMeasurement | undefined> {
      return measureTarget(target);
    },

    subscribe(target, onChange): () => void {
      // Size changes of the page and of the target (also elements that exist but have no size yet:
      // expanding drawers, entrance transitions). Selector targets can be replaced by a new element.
      const resize =
        typeof ResizeObserver === 'function'
          ? new ResizeObserver(() => {
              onChange();
            })
          : undefined;
      resize?.observe(document.documentElement);
      let observed: Element | undefined;
      const follow = (): void => {
        const next = target === undefined ? undefined : resolveTarget(target);
        if (next !== observed) {
          if (observed) {
            resize?.unobserve(observed);
          }

          observed = next;
          if (next) {
            resize?.observe(next);
          }
        }
      };

      const notify = (): void => {
        follow();
        onChange();
      };

      follow();
      // Content inserted, removed or restyled anywhere (except the tour itself) can move the target.
      const mutations = new MutationObserver((records) => {
        if (records.some((record) => !isOwnNode(record.target))) {
          notify();
        }
      });
      mutations.observe(document.documentElement, {childList: true, subtree: true, attributes: true});
      const visual = globalThis.visualViewport;
      globalThis.addEventListener('scroll', notify, {capture: true, passive: true});
      globalThis.addEventListener('resize', notify, {passive: true});
      visual?.addEventListener('resize', notify, {passive: true});
      visual?.addEventListener('scroll', notify, {passive: true});
      document.addEventListener('transitionend', notify, true);
      document.addEventListener('animationend', notify, true);
      return () => {
        resize?.disconnect();
        mutations.disconnect();
        globalThis.removeEventListener('scroll', notify, {capture: true});
        globalThis.removeEventListener('resize', notify);
        visual?.removeEventListener('resize', notify);
        visual?.removeEventListener('scroll', notify);
        document.removeEventListener('transitionend', notify, true);
        document.removeEventListener('animationend', notify, true);
        clearOccluderCache();
      };
    },

    // Layout is always announced: by the ResizeObserver above (or, without one, by the other events).
    isAwaitingLayout: () => false,

    async scrollContainers(target): Promise<readonly ScrollContainer[]> {
      const element = resolveTarget(target);
      if (!element || !hasLayout()) {
        return [];
      }

      const occluders = (): ReturnType<typeof findOccluders> => findOccluders(element, host);
      const ancestors = inspectAncestors(element);
      const containers = ancestors.scrollers.map((scroller) =>
        elementContainer(scroller.element, scroller.axes, occluders),
      );
      // Inside a `position: fixed` element, scrolling the page does not move the target.
      return ancestors.fixed ? containers : [...containers, pageContainer(occluders, pageOverflow())];
    },

    getViewport: readViewport,

    reducedMotion: reducedMotionQuery(),

    measuresWhileScrolling: true,

    getPixelRatio: (): number => globalThis.devicePixelRatio || 1,

    mountHost(): {readonly container: HTMLElement; readonly unmount: () => void} {
      const element = document.createElement('div');
      element.dataset.rtkHost = '';
      // No box of its own: the page's layout (flex or grid `<body>`, `:last-child` rules) stays as it is.
      element.style.display = 'contents';
      // React listens for events on the element it renders into: keep that one inside, so the tour's
      // own handlers run before the events are stopped here.
      const container = document.createElement('div');
      container.style.display = 'contents';
      element.append(container);
      const stop = (event: Event): void => {
        event.stopPropagation();
      };

      for (const type of isolatedEvents) {
        element.addEventListener(type, stop);
      }

      document.body.append(element);
      host = element;
      return {
        container,
        unmount(): void {
          for (const type of isolatedEvents) {
            element.removeEventListener(type, stop);
          }

          element.remove();
          if (host === element) {
            host = undefined;
          }

          clearOccluderCache();
        },
      };
    },
  };
}
