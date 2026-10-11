import {
  boxesEqual,
  containsBox,
  deflate,
  intersect,
  projectOnto,
  sanitizeBox,
  sanitizeInsets,
  sanitizeSize,
  sizesEqual,
} from '../geometry/box.util.js';
import {computeTooltipLayout, getSafeArea, type TooltipLayout} from '../geometry/compute-tooltip-layout.util.js';
import type {Box, Side, Size, Viewport} from '../geometry/geometry.type.js';
import {buildRevealMargins} from '../geometry/reveal.util.js';
import {getTargetVisibility, type TargetVisibility} from '../geometry/target-visibility.util.js';
import type {TourContextType} from '../types/tour-context.type.js';
import type {StartTourOptions, TourEndCallback, TourEndInfo, TourEndReason} from '../types/tour-end-info.type.js';
import type {TourPlacement, TourStep, TourTarget} from '../types/tour-step.type.js';
import {withTimeout} from './abort.util.js';
import {devWarn, reportError, safeInvoke} from './report.util.js';
import type {TargetMeasurement, TourAdapter} from './tour-adapter.type.js';

/** Spacing used for layout, shared by both platforms. */
export const tourLayout = {
  /** Distance between the highlighted area and the tooltip (arrows are at most this long). */
  gap: 12,
  /** Space between the target and the edge of the highlighted area. */
  highlightPadding: 8,
  /** Minimum distance between the tooltip and the edge of the safe area. */
  viewportPadding: 12,
  /** Minimum distance between an arrow and the tooltip's corners. */
  arrowPadding: 16,
} as const;

/** How long to wait for a step's target to appear before skipping it. */
export const targetTimeoutMs = 5000;
/** Safety cap for the renderer to report a tooltip's size; it normally reports within the same frame. */
const measureTimeoutMs = 1000;
/** Safety cap for scrolling a target into view. */
const revealTimeoutMs = 2000;
/**
 * Animations can move a target without any event (React Native's native-driver animations, such as
 * a screen sliding in, and the Web Animations API): until one ends, the target is measured where it
 * started. So right after a step appears, and before a target out of sight is skipped, the target is
 * checked every frame until it has not moved for this long...
 */
export const silentMoveQuietMs = 1000;
/** ...or for this long at most. */
export const silentMoveMaxMs = 3000;
/**
 * Safety cap for `onBeforeStep`. The tour covers the app meanwhile, so it cannot be waiting for the
 * user; one that never settles would otherwise leave a dimmed screen with no way out.
 */
export const beforeStepTimeoutMs = 30_000;
/** How many tours started from `onTourEnd` callbacks are ended before a new tour starts. */
const maxChainedEnds = 10;
/** Size assumed when the renderer never reports one (for example in a test environment without layout). */
const fallbackTooltipSize: Size = {width: 320, height: 180};

export type TourPhase = 'idle' | 'preparing' | 'revealing' | 'showing';

/** The step currently on screen. */
export type ShownStep = {
  /** Changes only when a step is (re)shown: renderers animate when it changes and apply everything else instantly. */
  readonly transitionId: number;
  readonly stepIndex: number;
  readonly step: TourStep;
  /** The highlighted part of the target in layer coordinates, or `undefined` for a centred step. */
  readonly highlight: Box | undefined;
  readonly layout: TooltipLayout;
};

/** Asks the renderer to render the pending step's tooltip invisibly and report its size. */
export type MeasureRequest = {
  readonly id: number;
  readonly stepIndex: number;
  readonly step: TourStep;
  readonly maxWidth: number;
  readonly maxHeight: number;
};

/** Everything a renderer needs. Changes only on structural events, never while idle. */
export type TourViewState = {
  readonly phase: TourPhase;
  /**
   * While `phase` is `'revealing'`: where the next target currently is, updated every frame while it
   * is scrolled into view, so the highlight can travel with the content.
   */
  readonly revealHighlight: Box | undefined;
  /**
   * How `revealHighlight` moves: frame by frame with the target (`true`), or straight to where the
   * target will end up (`false`, on platforms whose measurements lag behind scrolling).
   */
  readonly followsScroll: boolean;
  /** Changes for every tour, so renderers can tell a new tour from a step change. */
  readonly tourKey: number;
  readonly steps: readonly TourStep[];
  readonly shown: ShownStep | undefined;
  readonly measure: MeasureRequest | undefined;
};

export type TourPublicState = Pick<TourContextType, 'isActive' | 'currentStep' | 'steps' | 'currentTourId'>;

export type TourActions = Pick<TourContextType, 'startTour' | 'endTour' | 'nextStep' | 'prevStep' | 'goToStep'>;

export type TourEngineOptions = {
  readonly adapter: TourAdapter;
  readonly onTourEnd?: TourEndCallback | undefined;
};

export type TourEngine = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getPublicState: () => TourPublicState;
  readonly getViewState: () => TourViewState;
  /** Stable for the lifetime of the engine. */
  readonly actions: TourActions;
  /** Replaces the options (latest props). Never restarts anything. */
  readonly configure: (options: TourEngineOptions) => void;
  /** Call on mount; returns the cleanup. Tolerates StrictMode's simulated unmount. */
  readonly mount: () => () => void;
  /** Reports the rendered size of a measured tooltip (`MeasureRequest.id`) or of the shown one (`transitionId`). */
  readonly reportTooltipSize: (id: number, size: Size) => void;
  /** Ends the tour because of user input in the renderer. */
  readonly dismiss: (reason: Extract<TourEndReason, 'closed' | 'blur' | 'escape'>) => void;
};

type Session = {
  readonly key: number;
  readonly tourId: string | undefined;
  readonly steps: readonly TourStep[];
  /** The array passed to `startTour`, to recognise repeated starts of the same tour. */
  readonly source: readonly TourStep[];
  readonly onTourEnd: TourEndCallback | undefined;
};

type State = {
  readonly phase: TourPhase;
  readonly session: Session | undefined;
  /** The step on screen, or the start index while the first step is prepared. */
  readonly currentStep: number;
  readonly pendingStepIndex: number | undefined;
  readonly shown: ShownStep | undefined;
  readonly measure: MeasureRequest | undefined;
  /** Where the target being revealed currently is (only meaningful while revealing). */
  readonly revealHighlight: Box | undefined;
};

type ShownDetails = {
  readonly measurement: TargetMeasurement | undefined;
  readonly size: Size;
};

const emptySteps: readonly TourStep[] = Object.freeze([]);

const sideOrder: Record<TourPlacement, Side[]> = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'bottom', 'top'],
  right: ['right', 'left', 'bottom', 'top'],
};

/** The part of the viewport that is not covered by insets (notch, keyboard, system bars). */
function unobstructed(viewport: Viewport): Box {
  return deflate(sanitizeBox(viewport.rect), sanitizeInsets(viewport.insets));
}

/** The visible part of the target: clipped by its scroll containers. */
/**
 * The visible part of the target: clipped by its scroll containers. A target scrolled completely out
 * of its container collapses onto the container's nearest edge, where it will appear.
 */
function highlightOf(measurement: TargetMeasurement): Box {
  if (!measurement.clip) {
    return measurement.rect;
  }

  return intersect(measurement.rect, measurement.clip) ?? projectOnto(measurement.rect, measurement.clip);
}

/**
 * How much of the target the user can see: inside its scroll containers and the screen, and not
 * covered by elements that stay put (sticky headers, floating buttons). Covered completely counts as
 * not visible; covered partly as partly visible.
 */
function visibilityOf(measurement: TargetMeasurement, screen: Box): TargetVisibility {
  const area = measurement.clip ? intersect(measurement.clip, screen) : screen;
  const visibility = area ? getTargetVisibility(measurement.rect, area) : 'none';
  const occluders = measurement.occluders ?? [];
  if (visibility === 'none' || occluders.length === 0) {
    return visibility;
  }

  if (occluders.some((occluder) => containsBox(occluder, measurement.rect))) {
    return 'none';
  }

  return occluders.some((occluder) => intersect(occluder, measurement.rect) !== undefined) ? 'partial' : visibility;
}

function layoutsEqual(a: TooltipLayout, b: TooltipLayout): boolean {
  return (
    a.placement === b.placement &&
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.width - b.width) < 0.01 &&
    Math.abs(a.height - b.height) < 0.01 &&
    Math.abs(a.maxWidth - b.maxWidth) < 0.01 &&
    Math.abs(a.maxHeight - b.maxHeight) < 0.01 &&
    (a.arrowOffset === b.arrowOffset ||
      (a.arrowOffset !== undefined && b.arrowOffset !== undefined && Math.abs(a.arrowOffset - b.arrowOffset) < 0.01))
  );
}

/**
 * Creates the platform-independent tour engine: a small store plus the step lifecycle
 * (`onBeforeStep` → wait for target → measure tooltip → scroll into view → verify → show).
 *
 * Every step change is driven by an action, never by a re-render, so user callbacks run exactly
 * once per navigation no matter how often React renders. Every asynchronous step is cancellable.
 */
export function createTourEngine(initialOptions: TourEngineOptions): TourEngine {
  let options = initialOptions;
  const listeners = new Set<() => void>();

  let state: State = {
    phase: 'idle',
    session: undefined,
    currentStep: 0,
    pendingStepIndex: undefined,
    shown: undefined,
    measure: undefined,
    revealHighlight: undefined,
  };
  let publicState: TourPublicState = {isActive: false, currentStep: 0, steps: emptySteps, currentTourId: undefined};
  let viewState: TourViewState = {
    phase: 'idle',
    revealHighlight: undefined,
    followsScroll: initialOptions.adapter.measuresWhileScrolling,
    tourKey: 0,
    steps: emptySteps,
    shown: undefined,
    measure: undefined,
  };

  let sessionCounter = 0;
  let idCounter = 0;
  /** Preparation of a step in flight. */
  let transition: AbortController | undefined;
  /** Observation of the step on screen. */
  let stepScope: AbortController | undefined;
  let shownDetails: ShownDetails | undefined;
  let measureSequence = 0;
  /** A scroll that brings the shown target back into view is running. */
  let isKeepingInView = false;
  /** The target moved again while keepInView was scrolling: check once more when it is done. */
  let isKeepInViewStale = false;
  /** The scroll of keepInView in flight, stopped when the next step is prepared. */
  let keepInViewScope: AbortController | undefined;
  let lastTooltipSize: Size | undefined;
  const reportedSizes = new Map<number, Size>();
  const sizeWaiters = new Map<number, (size: Size) => void>();
  let lifecycle: 'live' | 'unmounting' | 'suspended' = 'live';

  // -------------------------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------------------------

  /** The public state for `useTour()`; the previous object while nothing in it changed. */
  function derivePublicState(previous: TourPublicState): TourPublicState {
    const next: TourPublicState = {
      isActive: state.phase !== 'idle',
      currentStep: state.currentStep,
      steps: state.session?.source ?? emptySteps,
      currentTourId: state.session?.tourId,
    };
    const isUnchanged =
      next.isActive === previous.isActive &&
      next.currentStep === previous.currentStep &&
      next.steps === previous.steps &&
      next.currentTourId === previous.currentTourId;
    return isUnchanged ? previous : next;
  }

  /** The state the renderer draws; the previous object while nothing in it changed. */
  function deriveViewState(previous: TourViewState): TourViewState {
    const next: TourViewState = {
      phase: state.phase,
      revealHighlight: state.phase === 'revealing' ? state.revealHighlight : undefined,
      followsScroll: options.adapter.measuresWhileScrolling,
      tourKey: state.session?.key ?? previous.tourKey,
      steps: state.session?.steps ?? emptySteps,
      shown: state.shown,
      measure: state.measure,
    };
    const isUnchanged =
      next.phase === previous.phase &&
      next.revealHighlight === previous.revealHighlight &&
      next.followsScroll === previous.followsScroll &&
      next.tourKey === previous.tourKey &&
      next.steps === previous.steps &&
      next.shown === previous.shown &&
      next.measure === previous.measure;
    return isUnchanged ? previous : next;
  }

  function setState(patch: Partial<State>): void {
    state = {...state, ...patch};
    const nextPublic = derivePublicState(publicState);
    const nextView = deriveViewState(viewState);
    if (nextPublic === publicState && nextView === viewState) {
      return;
    }

    publicState = nextPublic;
    viewState = nextView;
    // Snapshot: listeners may subscribe or unsubscribe while being notified.
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      listener();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------------------------

  function computeLayout(
    step: TourStep,
    highlight: Box | undefined,
    size: Size,
    previous: TooltipLayout | undefined,
  ): TooltipLayout {
    return computeTooltipLayout({
      ...tourLayout,
      target: highlight,
      tooltip: size,
      viewport: options.adapter.getViewport(step.target),
      placement: step.placement ?? 'bottom',
      previousPlacement: previous?.placement,
      pixelRatio: options.adapter.getPixelRatio?.(),
    });
  }

  function updateShown(measurement: TargetMeasurement | undefined, size: Size): void {
    const {shown} = state;
    if (!shown) {
      return;
    }

    shownDetails = {measurement, size};
    const highlight = measurement ? highlightOf(measurement) : undefined;
    const layout = computeLayout(shown.step, highlight, size, shown.layout);
    if (boxesEqual(highlight, shown.highlight) && layoutsEqual(layout, shown.layout)) {
      return;
    }

    setState({shown: {...shown, highlight, layout}});
  }

  // -------------------------------------------------------------------------------------------
  // Step lifecycle
  // -------------------------------------------------------------------------------------------

  async function waitForTooltipSize(id: number, signal: AbortSignal): Promise<Size | undefined> {
    const reported = reportedSizes.get(id);
    if (reported) {
      return reported;
    }

    return new Promise<Size | undefined>((resolve) => {
      sizeWaiters.set(id, resolve);
      signal.addEventListener('abort', () => {
        sizeWaiters.delete(id);
        resolve(undefined);
      });
    });
  }

  async function measureTooltip(index: number, step: TourStep, signal: AbortSignal): Promise<{id: number; size: Size}> {
    const id = ++idCounter;
    const safe = getSafeArea(options.adapter.getViewport(step.target), tourLayout.viewportPadding);
    setState({measure: {id, stepIndex: index, step, maxWidth: safe.width, maxHeight: safe.height}});
    const size = await withTimeout(
      async (childSignal) => waitForTooltipSize(id, childSignal),
      signal,
      measureTimeoutMs,
    );
    reportedSizes.delete(id);
    return {id, size: size ?? lastTooltipSize ?? fallbackTooltipSize};
  }

  type RevealInput = {
    readonly step: TourStep;
    readonly target: TourTarget;
    readonly measurement: TargetMeasurement;
    readonly size: Size;
    readonly signal: AbortSignal;
  };

  /** Waits up to `ms` for the target to move away from `from`; resolves `undefined` if it does not. */
  async function waitForMove(
    target: TourTarget,
    from: TargetMeasurement | undefined,
    signal: AbortSignal,
    ms: number,
  ): Promise<{readonly to: TargetMeasurement | undefined} | undefined> {
    return withTimeout(
      async (childSignal) => {
        const to = await options.adapter.waitForMove(target, from, childSignal);
        return childSignal.aborted ? undefined : {to};
      },
      signal,
      ms,
    );
  }

  /** Scrolls the target into view and returns its measurement if it is (at least partly) visible. */
  async function reveal(input: RevealInput): Promise<TargetMeasurement | undefined> {
    const {target, signal} = input;
    // While scrolling, the highlight follows the target frame by frame so the user sees where the tour goes.
    const following = new AbortController();
    const stopFollowing = (): void => {
      following.abort();
    };

    signal.addEventListener('abort', stopFollowing);
    let hasStarted = false;
    const startFollowing = (): void => {
      if (!hasStarted && !signal.aborted) {
        hasStarted = true;
        followTarget(target, following.signal).catch(reportError);
      }
    };

    try {
      let outcome = await scrollIntoViewAndVerify({...input, startFollowing});
      // Out of sight, the target may still be on its way (see `silentMoveQuietMs`): give it a moment
      // to arrive before it is skipped.
      const deadline = Date.now() + silentMoveMaxMs;
      while (outcome && !outcome.isInSight && Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop -- each attempt starts where the target moved to
        const move = await waitForMove(
          target,
          outcome.measurement,
          signal,
          Math.min(silentMoveQuietMs, deadline - Date.now()),
        );
        if (!move?.to || signal.aborted) {
          return undefined;
        }

        // eslint-disable-next-line no-await-in-loop -- see above
        outcome = await scrollIntoViewAndVerify({...input, measurement: move.to, startFollowing});
      }

      return outcome?.isInSight ? outcome.measurement : undefined;
    } finally {
      signal.removeEventListener('abort', stopFollowing);
      stopFollowing();
    }
  }

  /** Moves the reveal highlight with the target, once per frame, until `signal` aborts. */
  async function followTarget(target: TourTarget, signal: AbortSignal): Promise<void> {
    const {adapter} = options;
    while (!signal.aborted) {
      // eslint-disable-next-line no-await-in-loop -- one measurement per frame
      await adapter.nextFrame(signal);
      // eslint-disable-next-line no-await-in-loop -- see above
      const current = signal.aborted ? undefined : await adapter.measure(target);
      if (!signal.aborted && state.phase === 'revealing' && current) {
        const highlight = highlightOf(current);
        if (!boxesEqual(highlight, state.revealHighlight)) {
          setState({revealHighlight: highlight});
        }
      }
    }
  }

  type RevealOutcome = {
    /** Where the target is once scrolling has finished. */
    readonly measurement: TargetMeasurement;
    /** Fully visible, or partly visible after the instant correction: the step can be shown. */
    readonly isInSight: boolean;
  };

  /** Resolves `undefined` when aborted, or when the target is gone. */
  async function scrollIntoViewAndVerify({
    step,
    target,
    measurement,
    size,
    signal,
    startFollowing,
  }: RevealInput & {readonly startFollowing: () => void}): Promise<RevealOutcome | undefined> {
    const {adapter} = options;
    const margins = buildRevealMargins({
      ...tourLayout,
      target: highlightOf(measurement),
      tooltip: size,
      area: unobstructed(adapter.getViewport(target)),
      sides: sideOrder[step.placement ?? 'bottom'],
    });
    // Where the target is now: the second attempt starts where the first one ended.
    const latest = {measurement};
    for (const behavior of ['smooth', 'instant'] as const) {
      // eslint-disable-next-line no-await-in-loop -- the retry depends on the first attempt's outcome
      await withTimeout(
        async (childSignal) => {
          await adapter.reveal(target, {
            margins,
            behavior,
            signal: childSignal,
            onScrollStart(destination) {
              if (signal.aborted) {
                return;
              }

              if (adapter.measuresWhileScrolling) {
                setState({phase: 'revealing', revealHighlight: highlightOf(latest.measurement)});
                startFollowing();
              } else {
                // Positions only update once scrolling ends: move the highlight to where the target is
                // going, together with the scroll.
                const screen = unobstructed(adapter.getViewport(target));
                setState({phase: 'revealing', revealHighlight: highlightOf({rect: destination, clip: screen})});
              }
            },
          });
          return true;
        },
        signal,
        revealTimeoutMs,
      );
      if (signal.aborted) {
        return undefined;
      }

      // eslint-disable-next-line no-await-in-loop -- see above
      const current = await adapter.measure(target);
      if (signal.aborted || !current) {
        return undefined;
      }

      latest.measurement = current;
      const visibility = visibilityOf(current, unobstructed(adapter.getViewport(target)));
      if (visibility === 'full') {
        return {measurement: current, isInSight: true};
      }

      // The first attempt can be cut short (the user scrolled, or the page moved while scrolling);
      // the second one is instant. Partly visible targets are shown, invisible ones are not.
      if (behavior === 'instant') {
        return {measurement: current, isInSight: visibility === 'partial'};
      }
    }

    return undefined;
  }

  type PrepareOptions = {
    /** Where the user came from; going back past the first step returns there. */
    readonly origin?: number | undefined;
    /** Skip `onBeforeStep` for this index (used to re-find a target that disappeared). */
    readonly skipBeforeStepFor?: number | undefined;
  };

  function beginTransition(): AbortController {
    transition?.abort();
    // The step on screen stays observed (and laid out) until the next one is shown; only an
    // automatic scroll of it stops, so it cannot fight the next step's.
    keepInViewScope?.abort();
    keepInViewScope = undefined;
    const controller = new AbortController();
    transition = controller;
    return controller;
  }

  /**
   * Prepares the steps from `requested` on, in the direction of travel, until one can be shown.
   * Steps whose target cannot be found or brought into view are skipped.
   */
  async function prepare(
    requested: number,
    initialDirection: 1 | -1,
    prepareOptions: PrepareOptions = {},
  ): Promise<void> {
    const {session} = state;
    if (!session || lifecycle === 'suspended') {
      return;
    }

    const controller = beginTransition();
    let index = requested;
    let direction = initialDirection;
    let returnedToOrigin = false;
    while (!controller.signal.aborted) {
      if (index < 0 || index >= session.steps.length) {
        if (direction === -1 && prepareOptions.origin !== undefined && !returnedToOrigin) {
          // Nothing to show before this step: go back to where the user came from.
          returnedToOrigin = true;
          index = prepareOptions.origin;
          direction = 1;
          continue;
        }

        finish('target-missing', {stepIndex: Math.min(Math.max(index - direction, 0), session.steps.length - 1)});
        return;
      }

      // eslint-disable-next-line no-await-in-loop -- steps are tried one after another
      const result = await prepareStep(controller, index, prepareOptions.skipBeforeStepFor !== index);
      if (result === 'done') {
        return;
      }

      index += direction;
    }
  }

  /**
   * Runs a step's `onBeforeStep`. Resolves `true` once it has finished, `false` if it did not within
   * {@link beforeStepTimeoutMs} (its signal is then aborted); rejects with what it throws.
   */
  async function callBeforeStep(
    step: TourStep,
    onBeforeStep: NonNullable<TourStep['onBeforeStep']>,
    parent: AbortSignal,
  ): Promise<boolean> {
    const child = new AbortController();
    const abortChild = (): void => {
      child.abort();
    };

    parent.addEventListener('abort', abortChild);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => {
        child.abort();
        resolve(false);
      }, beforeStepTimeoutMs);
    });
    try {
      const finished = (async (): Promise<true> => {
        await onBeforeStep(step.target, {signal: child.signal});
        return true;
      })();
      return await Promise.race([finished, timedOut]);
    } finally {
      clearTimeout(timer);
      parent.removeEventListener('abort', abortChild);
    }
  }

  /** Runs one step's lifecycle. Resolves `'skip'` when its target cannot be found or shown. */
  async function prepareStep(
    controller: AbortController,
    index: number,
    runBeforeStep: boolean,
  ): Promise<'done' | 'skip'> {
    const {signal} = controller;
    const step = state.session?.steps[index];
    if (!step) {
      return 'done';
    }

    setState({phase: 'preparing', pendingStepIndex: index});
    try {
      if (runBeforeStep && step.onBeforeStep) {
        const isSettled = await callBeforeStep(step, step.onBeforeStep, signal);
        if (signal.aborted) {
          return 'done';
        }

        if (!isSettled) {
          finish('error', {
            stepIndex: index,
            error: new Error(
              `onBeforeStep of step ${index + 1} did not finish within ${beforeStepTimeoutMs / 1000} seconds.`,
            ),
          });
          return 'done';
        }
      }

      const {adapter} = options;
      const {target} = step;
      let measurement: TargetMeasurement | undefined;
      if (target !== undefined) {
        measurement = await withTimeout(
          async (childSignal) => adapter.waitForTarget(target, childSignal),
          signal,
          targetTimeoutMs,
        );
        if (signal.aborted) {
          return 'done';
        }

        if (!measurement) {
          devWarn(`Skipping step ${index + 1}: its target was not found within ${targetTimeoutMs / 1000} seconds.`);
          return 'skip';
        }
      }

      const {id, size} = await measureTooltip(index, step, signal);
      if (signal.aborted) {
        return 'done';
      }

      if (target !== undefined && measurement) {
        measurement = await reveal({step, target, measurement, size, signal});
        if (signal.aborted) {
          return 'done';
        }

        if (!measurement) {
          devWarn(`Skipping step ${index + 1}: its target could not be scrolled into view.`);
          return 'skip';
        }
      }

      show({controller, id, index, step, measurement, size});
      return 'done';
    } catch (error) {
      if (!signal.aborted) {
        finish('error', {stepIndex: index, error});
      }

      return 'done';
    }
  }

  type ShowInput = {
    readonly controller: AbortController;
    readonly id: number;
    readonly index: number;
    readonly step: TourStep;
    readonly measurement: TargetMeasurement | undefined;
    readonly size: Size;
  };

  function show({controller, id, index, step, measurement, size}: ShowInput): void {
    if (transition === controller) {
      transition = undefined;
    }

    shownDetails = {measurement, size};
    lastTooltipSize = size;
    const highlight = measurement ? highlightOf(measurement) : undefined;
    setState({
      phase: 'showing',
      currentStep: index,
      pendingStepIndex: undefined,
      measure: undefined,
      shown: {
        transitionId: id,
        stepIndex: index,
        step,
        highlight,
        layout: computeLayout(step, highlight, size, undefined),
      },
    });
    observeShown();
  }

  function observeShown(): AbortSignal | undefined {
    stepScope?.abort();
    const {shown} = state;
    if (!shown) {
      return undefined;
    }

    const scope = new AbortController();
    stepScope = scope;
    const {target} = shown.step;
    options.adapter.observe(
      target,
      () => {
        void remeasure(scope.signal);
      },
      scope.signal,
    );
    if (target !== undefined) {
      followSilentMoves(target, shownDetails?.measurement, scope.signal).catch(reportError);
    }

    return scope.signal;
  }

  /** Follows the shown target while it moves without any event (see `silentMoveQuietMs`). */
  async function followSilentMoves(
    target: TourTarget,
    from: TargetMeasurement | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    const deadline = Date.now() + silentMoveMaxMs;
    let last = from;
    while (!signal.aborted && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop -- one move at a time
      const move = await waitForMove(target, last, signal, Math.min(silentMoveQuietMs, deadline - Date.now()));
      if (!move || signal.aborted) {
        return;
      }

      last = move.to;
      void remeasure(signal);
    }
  }

  /** `canKeepInView: false` only follows the target (after keepInView's own scroll: no second attempt). */
  async function remeasure(signal: AbortSignal, {canKeepInView = true}: {canKeepInView?: boolean} = {}): Promise<void> {
    const sequence = ++measureSequence;
    const {shown} = state;
    // While the next step is prepared, the step on screen still follows layout changes (rotation,
    // resizing), but is neither scrolled back into view nor looked for again: it is about to go.
    const isShowing = state.phase === 'showing';
    if (!shown || !shownDetails || (!isShowing && state.phase !== 'preparing')) {
      return;
    }

    const {target} = shown.step;
    if (target === undefined) {
      updateShown(undefined, shownDetails.size);
      return;
    }

    const measurement = await options.adapter.measure(target);
    // The tooltip may have reported a new size meanwhile: use the latest.
    const size = shownDetails?.size;
    if (signal.aborted || sequence !== measureSequence || !size || state.shown !== shown) {
      return;
    }

    if (!measurement) {
      if (state.phase === 'showing') {
        // The target disappeared (re-mounted, for example): find it again without re-running onBeforeStep.
        void prepare(shown.stepIndex, 1, {skipBeforeStepFor: shown.stepIndex});
      }

      return;
    }

    updateShown(measurement, size);
    if (state.phase === 'showing' && canKeepInView) {
      void keepInView({step: shown.step, target, measurement, size, signal});
    }
  }

  type KeepInViewInput = {
    readonly step: TourStep;
    readonly target: TourTarget;
    readonly measurement: TargetMeasurement;
    readonly size: Size;
    readonly signal: AbortSignal;
  };

  /**
   * When the app moves the shown target out of view (content inserted above it, a resize), scrolls
   * it back. The step stays on screen and follows the target while it scrolls; nothing is re-run.
   * Users cannot scroll the page themselves during a tour, so this never fights the user.
   */
  async function keepInView({step, target, measurement, size, signal}: KeepInViewInput): Promise<void> {
    if (isKeepingInView) {
      isKeepInViewStale = true;
      return;
    }

    const {adapter} = options;
    const screen = unobstructed(adapter.getViewport(target));
    // Only targets that can be seen whole are brought back (larger ones would be scrolled to and fro).
    // Measured against the screen, not against what is left on screen of the lists around the
    // target: after a rotation, a list can lie entirely off screen, and that is what scrolling fixes.
    const fits = measurement.rect.width <= screen.width && measurement.rect.height <= screen.height;
    if (!fits || visibilityOf(measurement, screen) === 'full') {
      return;
    }

    isKeepingInView = true;
    isKeepInViewStale = false;
    let hasScrolled = false;
    const scope = new AbortController();
    keepInViewScope = scope;
    const stop = (): void => {
      scope.abort();
    };

    signal.addEventListener('abort', stop);
    try {
      const margins = buildRevealMargins({
        ...tourLayout,
        target: highlightOf(measurement),
        tooltip: size,
        area: screen,
        sides: sideOrder[step.placement ?? 'bottom'],
      });
      await withTimeout(
        async (childSignal) => {
          await adapter.reveal(target, {
            margins,
            behavior: 'smooth',
            signal: childSignal,
            onScrollStart() {
              hasScrolled = true;
            },
          });
          return true;
        },
        scope.signal,
        revealTimeoutMs,
      );
    } finally {
      signal.removeEventListener('abort', stop);
      isKeepingInView = false;
      if (keepInViewScope === scope) {
        keepInViewScope = undefined;
      }

      if (!scope.signal.aborted) {
        if (isKeepInViewStale) {
          // Pushed out again while scrolling (more content loaded): check once more.
          isKeepInViewStale = false;
          void remeasure(signal);
        } else if (hasScrolled) {
          // Where the target ended up: platforms whose scrolling reports no layout events (React
          // Native) would otherwise keep the highlight where the target was.
          void remeasure(signal, {canKeepInView: false});
        }
      }
    }
  }

  function finish(reason: TourEndReason, extra: {stepIndex?: number; error?: unknown} = {}): void {
    const {session} = state;
    if (!session) {
      return;
    }

    const stepIndex = extra.stepIndex ?? state.shown?.stepIndex ?? state.pendingStepIndex ?? state.currentStep;
    const step = session.steps[stepIndex] ?? session.steps[0];
    if (!step) {
      return;
    }

    const info: TourEndInfo = {
      reason,
      stepIndex,
      step,
      totalSteps: session.steps.length,
      ...('error' in extra ? {error: extra.error} : {}),
    };
    transition?.abort();
    transition = undefined;
    stepScope?.abort();
    stepScope = undefined;
    shownDetails = undefined;
    for (const resolve of sizeWaiters.values()) {
      resolve(lastTooltipSize ?? fallbackTooltipSize);
    }

    sizeWaiters.clear();
    reportedSizes.clear();
    // Reset before running user code, so a throwing callback can never leave the tour half-open.
    setState({
      phase: 'idle',
      session: undefined,
      currentStep: 0,
      pendingStepIndex: undefined,
      shown: undefined,
      measure: undefined,
    });
    safeInvoke(() => session.onTourEnd?.(session.tourId, info));
    safeInvoke(() => options.onTourEnd?.(session.tourId, info));
  }

  // -------------------------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------------------------

  const actions: TourActions = {
    startTour(steps: readonly TourStep[], tourId?: string, startOptions?: StartTourOptions): void {
      if (lifecycle === 'suspended') {
        return;
      }

      if (steps.length === 0) {
        devWarn('startTour was called without steps; nothing to show.');
        return;
      }

      const current = state.session;
      if (current && (tourId === undefined ? steps === current.source : tourId === current.tourId)) {
        return;
      }

      // End the running tour, and any tour its onTourEnd starts, before starting this one.
      for (let ended = 0; state.session && ended < maxChainedEnds; ended++) {
        finish('closed');
      }

      if (state.session) {
        devWarn('onTourEnd keeps starting new tours; the last one is replaced without ending it.');
      }

      const session: Session = {
        key: ++sessionCounter,
        tourId,
        steps: [...steps],
        source: steps,
        onTourEnd: startOptions?.onTourEnd,
      };
      lastTooltipSize = undefined;
      setState({
        session,
        phase: 'preparing',
        currentStep: 0,
        pendingStepIndex: 0,
        shown: undefined,
        measure: undefined,
      });
      void prepare(0, 1);
    },

    endTour(): void {
      finish('closed');
    },

    nextStep(): void {
      if (lifecycle === 'suspended') {
        return;
      }

      const {session} = state;
      if (!session || state.phase !== 'showing') {
        return;
      }

      if (state.currentStep >= session.steps.length - 1) {
        finish('completed');
        return;
      }

      void prepare(state.currentStep + 1, 1, {origin: state.currentStep});
    },

    prevStep(): void {
      if (lifecycle === 'suspended') {
        return;
      }

      if (!state.session || state.phase !== 'showing' || state.currentStep === 0) {
        return;
      }

      void prepare(state.currentStep - 1, -1, {origin: state.currentStep});
    },

    goToStep(index: number): void {
      if (lifecycle === 'suspended') {
        return;
      }

      const {session} = state;
      if (!session || !Number.isInteger(index) || index < 0 || index >= session.steps.length) {
        return;
      }

      if (state.phase === 'showing' ? index === state.currentStep : index === state.pendingStepIndex) {
        return;
      }

      const from = state.shown?.stepIndex ?? state.currentStep;
      void prepare(index, index >= from ? 1 : -1, {origin: state.shown ? from : undefined});
    },
  };

  // -------------------------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------------------------

  function suspend(): void {
    lifecycle = 'suspended';
    transition?.abort();
    transition = undefined;
    stepScope?.abort();
    stepScope = undefined;
  }

  function resume(): void {
    lifecycle = 'live';
    if (state.phase === 'showing') {
      const signal = observeShown();
      if (signal) {
        void remeasure(signal);
      }
    } else if (state.phase !== 'idle') {
      void prepare(state.pendingStepIndex ?? state.currentStep, 1);
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPublicState: () => publicState,
    getViewState: () => viewState,
    actions,
    configure(next): void {
      options = next;
    },
    mount() {
      if (lifecycle === 'unmounting') {
        lifecycle = 'live';
      } else if (lifecycle === 'suspended') {
        resume();
      }

      return () => {
        lifecycle = 'unmounting';
        void Promise.resolve().then(() => {
          if (lifecycle === 'unmounting') {
            suspend();
          }
        });
      };
    },
    reportTooltipSize(id, rawSize): void {
      const size = sanitizeSize(rawSize);
      if (state.measure?.id === id) {
        reportedSizes.set(id, size);
        sizeWaiters.get(id)?.(size);
        sizeWaiters.delete(id);
        return;
      }

      if (state.shown?.transitionId === id && shownDetails && !sizesEqual(shownDetails.size, size)) {
        lastTooltipSize = size;
        updateShown(shownDetails.measurement, size);
      }
    },
    dismiss(reason): void {
      finish(reason);
    },
  };
}
