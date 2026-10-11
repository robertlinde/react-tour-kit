import type {TargetMeasurement} from '../engine/tour-adapter.type.js';
import type {Box, Point, Viewport} from '../geometry/geometry.type.js';
import type {TourTarget} from '../types/tour-step.type.js';

/**
 * What the tour needs from a platform (web, React Native): raw facts about the screen and the
 * app's views, and nothing else. Everything built on them — waiting for targets, following them,
 * scrolling them into view, deciding when scrolling has finished — is shared (see
 * `createTourAdapter`), so it behaves the same everywhere.
 *
 * Every member is required: a platform that lacks one does not compile.
 */
export type PlatformAdapter = {
  /** Where the target is, in the tour layer's coordinates, or `undefined` when it is not rendered. */
  readonly measure: (target: TourTarget) => Promise<TargetMeasurement | undefined>;
  /**
   * Calls `onChange` whenever the target, the layout around it or the viewport may have changed.
   * Event-driven: no calls while nothing changes. Calling too often is fine (calls are coalesced
   * per frame and results compared). Returns the unsubscribe function.
   */
  readonly subscribe: (target: TourTarget | undefined, onChange: () => void) => () => void;
  /**
   * True when the target exists but cannot be measured yet, and no event will announce when it
   * can (React Native: registered, but not laid out yet). The tour then checks every frame.
   */
  readonly isAwaitingLayout: (target: TourTarget) => boolean;
  /** The scroll containers around the target, innermost first, including the page where it scrolls. */
  readonly scrollContainers: (target: TourTarget) => Promise<readonly ScrollContainer[]>;
  /**
   * The visible area of the tour layer and what covers its edges (safe areas, the on-screen
   * keyboard). Pass the step's target so that a bar containing it does not count as covering it.
   */
  readonly getViewport: (target?: TourTarget) => Viewport;
  /** Whether the user asked the system to reduce motion. */
  readonly reducedMotion: ExternalValue<boolean>;
  /**
   * Whether `measure` sees targets move while a scroll animation runs. When it does not (React
   * Native: on the New Architecture, measurements only catch up once a scroll has finished), the
   * highlight moves straight to where the target will end up instead of following it.
   */
  readonly measuresWhileScrolling: boolean;
  /** Device pixel ratio, used to place the tooltip on whole device pixels. */
  readonly getPixelRatio: () => number;
};

/** A value that can change outside React (a system setting), readable with `useSyncExternalStore`. */
export type ExternalValue<T> = {
  readonly get: () => T;
  readonly subscribe: (listener: () => void) => () => void;
};

/** One scrollable area between the target and the screen (a nested scroller, a list, or the page itself). */
export type ScrollContainer = {
  /** Current geometry, or `undefined` when the container is not rendered. */
  readonly measure: () => Promise<ScrollContainerMetrics | undefined>;
  /**
   * Scrolls to `offset` and resolves once this container has finished scrolling (or cannot get
   * further). Stops waiting as soon as `signal` is aborted.
   */
  readonly scrollTo: (offset: Point, options: ScrollOptions) => Promise<void>;
};

export type ScrollOptions = {
  readonly animated: boolean;
  readonly signal: AbortSignal;
};

export type ScrollContainerMetrics = {
  /** The part of the container's viewport content should be revealed in (scroll-padding already applied), in layer coordinates. */
  readonly area: Box;
  readonly offset: Point;
  /**
   * The range the tour may scroll in, per axis. Usually `0` to the end of the content; on an axis
   * the tour must not scroll (the app's own `overflow: hidden`), both are the current offset. Offsets
   * can be negative at rest (content insets, centred content).
   */
  readonly minOffset: Point;
  readonly maxOffset: Point;
  /** Elements over this area that do not scroll with its content (sticky headers, floating buttons), in layer coordinates. */
  readonly obstacles?: readonly Box[];
};
