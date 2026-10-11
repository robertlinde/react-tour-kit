import type {Box, Insets, Viewport} from '../geometry/geometry.type.js';
import type {TourTarget} from '../types/tour-step.type.js';

/** Where a target is, in the tour layer's coordinate space. */
export type TargetMeasurement = {
  readonly rect: Box;
  /**
   * The area the target can be seen through: the intersection of the scroll containers and
   * clipping ancestors around it. `undefined` when nothing clips it.
   */
  readonly clip: Box | undefined;
  /** Elements that stay put while the content scrolls (sticky headers, floating buttons) and overlap the target. */
  readonly occluders?: readonly Box[];
};

export type RevealRequest = {
  /** Space to keep around the target, most generous first. */
  readonly margins: readonly Insets[];
  /** `'smooth'` is downgraded to `'instant'` by the adapter when the user prefers reduced motion. */
  readonly behavior: 'smooth' | 'instant';
  readonly signal: AbortSignal;
  /**
   * Must be called right before the first scroll starts, and not at all if nothing scrolls, with
   * where the target will be once scrolling has finished.
   */
  readonly onScrollStart: (destination: Box) => void;
};

/**
 * Everything platform-specific the engine needs. Adapters never own timeouts; they only have to
 * stop work promptly when a signal is aborted.
 */
export type TourAdapter = {
  /** Measures a target, or resolves `undefined` when it is not rendered. */
  readonly measure: (target: TourTarget) => Promise<TargetMeasurement | undefined>;
  /** Resolves as soon as the target is rendered and measurable. Event-driven where the platform allows; never busy-polls. */
  readonly waitForTarget: (target: TourTarget, signal: AbortSignal) => Promise<TargetMeasurement | undefined>;
  /**
   * The visible area of the tour layer and what covers its edges (safe areas, the on-screen
   * keyboard, stuck navigation bars). Pass the step's target so that a bar containing it does not
   * count as covering it.
   */
  readonly getViewport: (target?: TourTarget) => Viewport;
  /**
   * Whether `measure` sees targets move while a scroll animation runs. When it does not (React
   * Native: on the New Architecture, measurements only catch up once a scroll has finished), the
   * highlight moves straight to where the target will end up instead of following it.
   */
  readonly measuresWhileScrolling: boolean;
  /** Scrolls every container around the target just enough to show it with the given margin, and resolves once scrolling has settled. */
  readonly reveal: (target: TourTarget, request: RevealRequest) => Promise<void>;
  /**
   * Calls `onChange` (at most once per frame) whenever the target's position or size, or the
   * viewport, may have changed. Over-notifying is fine; the engine compares values. Stops when
   * `signal` is aborted. `target` is `undefined` for centred steps (viewport changes only).
   */
  readonly observe: (target: TourTarget | undefined, onChange: () => void, signal: AbortSignal) => void;
  /** Device pixel ratio, used to place the tooltip on whole device pixels. */
  readonly getPixelRatio?: () => number;
  /** Resolves on the next frame (or right away when `signal` is aborted). */
  readonly nextFrame: (signal: AbortSignal) => Promise<void>;
};
