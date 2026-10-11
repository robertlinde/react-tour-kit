import {nextFrame} from '../shared/engine/abort.util.js';
import type {TargetMeasurement} from '../shared/engine/tour-adapter.type.js';
import {containsBox, intersect, narrowClip} from '../shared/geometry/box.util.js';
import type {Box, Insets, Size, Viewport} from '../shared/geometry/geometry.type.js';
import type {
  ExternalValue,
  PlatformAdapter,
  ScrollContainer,
  ScrollContainerMetrics,
} from '../shared/platform/platform.type.js';
import type {TourTarget} from '../shared/types/tour-step.type.js';
import {isDescendant, measureLayoutIn, measureView, relativeTo} from './measure.util.js';
import type {TourRegistry} from './registry.js';

export type NativePlatformOptions = {
  readonly registry: TourRegistry;
  /** The view the tour is drawn in (the provider's root layer, or the newest `TourHost`). */
  readonly getHost: () => {readonly instance: unknown; readonly size: Size} | undefined;
  readonly getInsets: () => Insets;
  /** Subscribes to anything that can move targets: layer size, keyboard, safe-area changes. */
  readonly subscribeLayout: (listener: () => void) => () => void;
  readonly reducedMotion: ExternalValue<boolean>;
  readonly getPixelRatio: () => number;
};

/** What the tour uses of a `ScrollView` instance. */
type ScrollViewInstance = {
  getNativeScrollRef?: () => unknown;
  getInnerViewRef?: () => unknown;
  getScrollResponder?: () => unknown;
  scrollTo?: (params: {x?: number; y?: number; animated?: boolean}) => void;
};

type ScrollViewGeometry = {
  readonly scrollView: ScrollViewInstance;
  /** The visible area of the scroll view, in layer coordinates. */
  readonly viewport: Box;
  /** The scrollable content, in layer coordinates. */
  readonly content: Box;
};

/** A target found on screen: the view, and where it is in layer coordinates. */
type LocatedTarget = {
  readonly instance: unknown;
  readonly rect: Box;
  /** The registered scroll views, when they were already measured to find the target. */
  readonly geometries: readonly ScrollViewGeometry[] | undefined;
};

const area = (box: Box): number => box.width * box.height;

function isObject(value: unknown): value is ScrollViewInstance {
  return typeof value === 'object' && value !== null;
}

/**
 * The `ScrollView` behind a registered ref. Lists (`FlatList`, `SectionList`, `VirtualizedList`)
 * expose theirs as the scroll responder; a `ScrollView` is its own.
 */
function scrollViewOf(registered: unknown): ScrollViewInstance | undefined {
  if (!isObject(registered)) {
    return undefined;
  }

  if (typeof registered.scrollTo === 'function') {
    return registered;
  }

  const responder = registered.getScrollResponder?.();
  return isObject(responder) && typeof responder.scrollTo === 'function' ? responder : undefined;
}

/** Scroll offsets are rounded to physical pixels: up to one point off still counts as arrived. */
const arrivalTolerance = 1;
/** Frames without movement after which a scroll that moved but stopped short counts as finished. */
const stillFramesAfterMoving = 3;

/** Which axes a scroll view can scroll: those where its content is bigger than the view. */
function scrollAxes(geometry: ScrollViewGeometry): {readonly x: boolean; readonly y: boolean} {
  return {
    x: geometry.content.width > geometry.viewport.width + arrivalTolerance,
    y: geometry.content.height > geometry.viewport.height + arrivalTolerance,
  };
}

/**
 * Orders scroll views that all contain the target innermost first: a scroll view inside another
 * one lies within that one's content.
 */
function innermostFirst(geometries: readonly ScrollViewGeometry[]): ScrollViewGeometry[] {
  const depth = (geometry: ScrollViewGeometry): number =>
    geometries.filter((other) => other !== geometry && containsBox(other.content, geometry.viewport, 1)).length;
  // Not `toSorted`: ES2023 is not available on every supported React Native version.
  // eslint-disable-next-line unicorn/no-array-sort
  return [...geometries].sort((a, b) => depth(b) - depth(a) || area(a.content) - area(b.content));
}

/** React Native's raw facts for the tour: measuring views, registered targets and scroll views, the host layer. */
export function createNativePlatform(env: NativePlatformOptions): PlatformAdapter {
  async function hostOrigin(): Promise<Box | undefined> {
    const host = env.getHost();
    return host ? measureView(host.instance) : undefined;
  }

  function candidates(target: TourTarget): unknown[] {
    if (typeof target === 'string') {
      return env.registry.targets(target).map((ref) => ref.current);
    }

    return [target.current];
  }

  async function registeredScrollViews(origin: Box): Promise<ScrollViewGeometry[]> {
    const geometries = await Promise.all(
      env.registry.scrollViews().map(async (ref) => scrollViewGeometry(ref.current, origin)),
    );
    return geometries.filter((geometry): geometry is ScrollViewGeometry => geometry !== undefined);
  }

  async function scrollViewGeometry(registered: unknown, origin: Box): Promise<ScrollViewGeometry | undefined> {
    const scrollView = scrollViewOf(registered);
    if (!scrollView) {
      return undefined;
    }

    const [viewport, content] = await Promise.all([
      measureView(scrollView.getNativeScrollRef?.() ?? scrollView),
      measureView(scrollView.getInnerViewRef?.()),
    ]);
    if (!viewport || !content) {
      return undefined;
    }

    return {scrollView, viewport: relativeTo(viewport, origin), content: relativeTo(content, origin)};
  }

  /**
   * The scroll views around the target, innermost first. A scroll view counts when the target is
   * one of its descendants, where React Native can tell: a header button above a page that has
   * been scrolled is not inside the page, even though the page's content reaches behind it.
   * Otherwise it counts when its content contains the target, or another scroll view around it (a
   * target at the end of a horizontal list below the fold is inside the list, the list inside the page).
   */
  async function containingScrollViews(
    located: LocatedTarget,
    geometries: readonly ScrollViewGeometry[],
  ): Promise<ScrollViewGeometry[]> {
    const ancestry = await Promise.all(
      geometries.map(async (geometry) => isDescendant(located.instance, geometry.scrollView.getInnerViewRef?.())),
    );
    const around = new Set(geometries.filter((_geometry, index) => ancestry[index] === true));
    const unknown = geometries.filter((_geometry, index) => ancestry[index] === undefined);
    let isGrowing = true;
    while (isGrowing) {
      isGrowing = false;
      for (const geometry of unknown) {
        const contains =
          !around.has(geometry) &&
          (containsBox(geometry.content, located.rect, 1) ||
            [...around].some((inner) => containsBox(geometry.content, inner.viewport, 1)));
        if (contains) {
          around.add(geometry);
          isGrowing = true;
        }
      }
    }

    return innermostFirst([...around]);
  }

  /** The part of `box` not covered by insets (system bars, the keyboard); all of it when nothing of it is uncovered. */
  function unobstructedPart(box: Box): Box {
    const size = env.getHost()?.size ?? {width: 0, height: 0};
    const insets = env.getInsets();
    const screen = {
      x: insets.left,
      y: insets.top,
      width: size.width - insets.left - insets.right,
      height: size.height - insets.top - insets.bottom,
    };
    const visible = intersect(box, screen);
    return visible && visible.width > 0 && visible.height > 0 ? visible : box;
  }

  async function scrollViewMetrics(scrollView: ScrollViewInstance): Promise<ScrollContainerMetrics | undefined> {
    const origin = await hostOrigin();
    const current = origin ? await scrollViewGeometry(scrollView, origin) : undefined;
    if (!current) {
      return undefined;
    }

    const offset = {x: current.viewport.x - current.content.x, y: current.viewport.y - current.content.y};
    const axes = scrollAxes(current);
    const end = {
      x: current.content.width - current.viewport.width,
      y: current.content.height - current.viewport.height,
    };
    return {
      // The part the user can see: scroll views of edge-to-edge apps reach behind the keyboard and
      // the system bars, and a target scrolled there would still be hidden.
      area: unobstructedPart(current.viewport),
      offset,
      // Content can rest away from offset 0 (content insets under a translucent header, margins,
      // content centred on a tablet), so the offset can be negative. An axis the scroll view does
      // not scroll stays where it is.
      minOffset: {x: axes.x ? Math.min(0, offset.x) : offset.x, y: axes.y ? Math.min(0, offset.y) : offset.y},
      maxOffset: {x: axes.x ? Math.max(offset.x, end.x) : offset.x, y: axes.y ? Math.max(offset.y, end.y) : offset.y},
    };
  }

  function scrollContainer(scrollView: ScrollViewInstance): ScrollContainer {
    return {
      measure: async () => scrollViewMetrics(scrollView),
      async scrollTo(offset, {animated, signal}): Promise<void> {
        const start = await scrollViewMetrics(scrollView);
        scrollView.scrollTo?.({x: offset.x, y: offset.y, animated});
        if (!start) {
          return;
        }

        // Scroll views report no "scroll end" for programmatic scrolls, and measurements cannot be
        // trusted to move either: on the New Architecture they come from the shadow tree, which iOS
        // only updates when a scroll animation has finished. So wait until the scroll view measures
        // at the offset it was sent to, on the axes it was asked to move. Content that rests away
        // from offset 0 can stop a little short: then it counts as done once it moved and stopped.
        const moves = {
          x: Math.abs(offset.x - start.offset.x) > arrivalTolerance,
          y: Math.abs(offset.y - start.offset.y) > arrivalTolerance,
        };
        let previous = start.offset;
        let stillFrames = 0;
        let hasMoved = false;
        while (!signal.aborted) {
          // eslint-disable-next-line no-await-in-loop -- frame by frame
          await nextFrame(signal);
          // eslint-disable-next-line no-await-in-loop -- see above
          const current = await scrollViewMetrics(scrollView);
          if (signal.aborted || !current) {
            return;
          }

          const hasArrived =
            (!moves.x || Math.abs(current.offset.x - offset.x) <= arrivalTolerance) &&
            (!moves.y || Math.abs(current.offset.y - offset.y) <= arrivalTolerance);
          const isStill =
            Math.abs(current.offset.x - previous.x) < 0.5 && Math.abs(current.offset.y - previous.y) < 0.5;
          hasMoved ||= !isStill;
          stillFrames = isStill ? stillFrames + 1 : 0;
          previous = current.offset;
          if (hasArrived || (hasMoved && stillFrames >= stillFramesAfterMoving)) {
            return;
          }
        }
      },
    };
  }

  /**
   * Measures a target that cannot be measured directly through a scroll view's content: on the
   * Old Architecture, views the layout flattened away and list items scrolled out of the visible
   * window cannot be measured on screen, but their position in the content is known.
   */
  async function measureThroughScrollViews(
    instance: unknown,
    geometries: readonly ScrollViewGeometry[],
  ): Promise<Box | undefined> {
    for (const geometry of geometries) {
      // eslint-disable-next-line no-await-in-loop -- the first scroll view that knows the target is enough
      const position = await measureLayoutIn(instance, geometry.scrollView.getInnerViewRef?.());
      if (position && (position.width > 0 || position.height > 0)) {
        return {...position, x: geometry.content.x + position.x, y: geometry.content.y + position.y};
      }
    }

    return undefined;
  }

  async function locateTarget(target: TourTarget, origin: Box): Promise<LocatedTarget | undefined> {
    const screen = {x: 0, y: 0, width: origin.width, height: origin.height};
    let geometries: ScrollViewGeometry[] | undefined;
    // Several components can register the same id (tabs that stay mounted, two screens during a
    // transition): prefer the newest one that is actually on screen.
    let fallback: LocatedTarget | undefined;
    for (const instance of candidates(target)) {
      // eslint-disable-next-line no-await-in-loop -- candidates are checked in priority order
      const measured = await measureView(instance);
      let rect = measured ? relativeTo(measured, origin) : undefined;
      if (!rect) {
        // eslint-disable-next-line no-await-in-loop -- only when measuring directly failed
        geometries ??= await registeredScrollViews(origin);
        // eslint-disable-next-line no-await-in-loop -- see above
        rect = await measureThroughScrollViews(instance, geometries);
      }

      if (!rect) {
        continue;
      }

      if (intersect(rect, screen)) {
        return {instance, rect, geometries};
      }

      fallback ??= {instance, rect, geometries};
    }

    return fallback;
  }

  async function measureTarget(target: TourTarget): Promise<TargetMeasurement | undefined> {
    const origin = await hostOrigin();
    const located = origin ? await locateTarget(target, origin) : undefined;
    if (!origin || !located) {
      return undefined;
    }

    const containers = await containingScrollViews(
      located,
      located.geometries ?? (await registeredScrollViews(origin)),
    );
    let clip: Box | undefined;
    for (const container of containers) {
      clip = narrowClip(clip, container.viewport);
    }

    return {rect: located.rect, clip};
  }

  return {
    measure: measureTarget,

    subscribe(_target, onChange): () => void {
      // Views report no layout events to the outside; registrations, the host layer, the keyboard
      // and safe-area changes do.
      const unsubscribeLayout = env.subscribeLayout(onChange);
      const unsubscribeRegistry = env.registry.subscribe(onChange);
      return () => {
        unsubscribeLayout();
        unsubscribeRegistry();
      };
    },

    // A registered view (or a ref) that cannot be measured yet has not been laid out: nothing
    // announces when it is, so the tour checks every frame.
    isAwaitingLayout: (target) => typeof target !== 'string' || env.registry.targets(target).length > 0,

    async scrollContainers(target): Promise<readonly ScrollContainer[]> {
      const origin = await hostOrigin();
      const located = origin ? await locateTarget(target, origin) : undefined;
      if (!origin || !located) {
        return [];
      }

      const chain = await containingScrollViews(located, located.geometries ?? (await registeredScrollViews(origin)));
      return chain.map(({scrollView}) => scrollContainer(scrollView));
    },

    getViewport(): Viewport {
      const size = env.getHost()?.size ?? {width: 0, height: 0};
      return {rect: {x: 0, y: 0, width: size.width, height: size.height}, insets: env.getInsets()};
    },

    reducedMotion: env.reducedMotion,

    measuresWhileScrolling: false,

    getPixelRatio: env.getPixelRatio,
  };
}
