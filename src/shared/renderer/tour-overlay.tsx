import {
  type ComponentType,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type MeasureRequest,
  type ShownStep,
  type TourEngine,
  tourLayout,
  type TourViewState,
} from '../engine/tour-engine.js';
import {boxesEqual, containsPoint, inflate} from '../geometry/box.util.js';
import type {Box, Point, Size} from '../geometry/geometry.type.js';
import {useTourView} from '../react/use-tour-view.hook.js';
import type {TourTooltipProps} from '../types/tour-tooltip-props.type.js';
import {formatTemplate, type ResolvedI18n} from '../utils/i18n.util.js';
import type {ResolvedTheme} from '../utils/theme.util.js';
import {entranceFor, fadeDuration, motion} from './motion.js';
import {RendererContext, type RendererContextValue, TooltipLimitsContext} from './renderer-context.js';
import type {SpotlightTransition, TourIntent, TourRenderer} from './renderer.type.js';

export type TourOverlayProps = {
  readonly engine: TourEngine;
  readonly renderer: TourRenderer;
  readonly theme: ResolvedTheme;
  readonly i18n: ResolvedI18n;
  readonly Tooltip: ComponentType<TourTooltipProps>;
  readonly isOverlayDismissible: boolean;
  readonly isReducedMotion: boolean;
};

function noop(): void {
  // Intentionally empty.
}

/**
 * The tour on screen, for every platform: decides what is visible, how it animates, what it
 * says and what input means, and draws it with the platform's primitives ({@link TourRenderer}).
 * Keeps the last step on screen while the tour fades out.
 */
export function TourOverlay(props: TourOverlayProps): ReactNode {
  const view = useTourView(props.engine);
  // When the tour ends, the last view stays on screen while it fades out. Worked out during render
  // (not in an effect), so the overlay is never unmounted in between and the fade really plays.
  const [tracked, setTracked] = useState<{view: TourViewState; closing: TourViewState | undefined}>(() => ({
    view,
    closing: undefined,
  }));
  let {closing} = tracked;
  if (tracked.view !== view) {
    const before = tracked.view;
    closing = view.phase === 'idle' ? (before.phase === 'idle' ? closing : before) : undefined;
    setTracked({view, closing});
  }

  const onClosed = useCallback((): void => {
    setTracked((current) => ({...current, closing: undefined}));
  }, []);
  const isClosing = view.phase === 'idle' && closing !== undefined;
  const rendered = view.phase === 'idle' ? closing : view;
  return rendered ? <OverlayContent {...props} view={rendered} isClosing={isClosing} onClosed={onClosed} /> : null;
}

type OverlayContentProps = TourOverlayProps & {
  readonly view: TourViewState;
  readonly isClosing: boolean;
  readonly onClosed: () => void;
};

function OverlayContent({
  engine,
  renderer,
  theme,
  i18n,
  Tooltip,
  isOverlayDismissible,
  isReducedMotion,
  view,
  isClosing,
  onClosed,
}: OverlayContentProps): ReactNode {
  const {Layer, Backdrop, Spotlight, Waiting} = renderer;
  const id = useId();
  const titleId = `${id}title`;
  const descriptionId = `${id}description`;
  const {shown, phase, measure} = view;
  const totalSteps = view.steps.length;
  // The first step can take a while (navigation in onBeforeStep): dim the screen after a moment.
  const isWaitingDimmed = useDelayedFlag(!shown && !isClosing, motion.waitingDelayMs);
  const {isPreparing, isWaiting, isShownGone} = usePreparation(view, isClosing);
  // Once on screen, the overlay stays until the tour ends (also when another tour takes over).
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const isShowingSomething = shown !== undefined || isWaitingDimmed;
  if (isShowingSomething && !isClosing && !hasBeenVisible) {
    setHasBeenVisible(true);
  }

  const isVisible = !isClosing && (isShowingSomething || hasBeenVisible);
  // When the overlay became visible: presses on the dimmed area only count once it has faded in.
  const visibleSince = useRef<number | undefined>(undefined);
  useEffect(() => {
    visibleSince.current = isVisible ? Date.now() : undefined;
  }, [isVisible]);
  const spotlight = useSpotlight(view, isVisible, isReducedMotion, isWaiting || isShownGone);
  const announcement = useAnnouncement(view, i18n, isClosing, isWaiting);

  // Fade out, then unmount.
  useEffect(() => {
    if (!isClosing) {
      return undefined;
    }

    const timer = setTimeout(onClosed, fadeDuration(true, isReducedMotion) + 20);
    return (): void => {
      clearTimeout(timer);
    };
  }, [isClosing, isReducedMotion, onClosed]);

  const onIntent = useCallback(
    (intent: TourIntent): void => {
      if (isClosing) {
        return;
      }

      switch (intent) {
        case 'next': {
          engine.actions.nextStep();
          break;
        }

        case 'previous': {
          engine.actions.prevStep();
          break;
        }

        case 'escape': {
          engine.dismiss('escape');
          break;
        }

        case 'back': {
          engine.dismiss('closed');
          break;
        }
      }
    },
    [engine, isClosing],
  );

  const onBackdropPress = (point: Point): void => {
    // Not while the overlay is still appearing (a double click on the button that started the
    // tour), nor right after a step change began (a second tap on Next falls through the busy
    // tooltip). Once the tour shows that it is waiting, a press leaves it.
    const since = visibleSince.current;
    const hasFadedIn = since !== undefined && Date.now() - since >= motion.fadeInMs;
    const isChangingStep = shown !== undefined && phase !== 'showing' && !isWaiting;
    if (!isOverlayDismissible || isClosing || !hasFadedIn || isChangingStep) {
      return;
    }

    // Presses on the highlighted element go nowhere; presses on the dimmed area close the tour.
    if (spotlight.hole === undefined || !containsPoint(spotlight.hole, point)) {
      engine.dismiss('blur');
    }
  };

  const context = useMemo<RendererContextValue>(() => ({renderer, theme, i18n}), [renderer, theme, i18n]);

  return (
    <RendererContext.Provider value={context}>
      <Layer
        state={isClosing ? 'closing' : phase}
        isVisible={isVisible}
        fadeMs={fadeDuration(isClosing, isReducedMotion)}
        isInteractive={!isClosing}
        theme={theme}
        titleId={shown ? titleId : undefined}
        descriptionId={shown ? descriptionId : undefined}
        fallbackLabel={fallbackLabelOf(shown, totalSteps, i18n)}
        announcement={announcement}
        stepKey={shown?.transitionId}
        onIntent={onIntent}
      >
        <Backdrop isDismissible={isOverlayDismissible} onPress={onBackdropPress} />
        <Spotlight hole={spotlight.hole} transition={spotlight.transition} theme={theme} />
        {shown ? (
          <ShownTooltip
            key={shown.transitionId}
            engine={engine}
            renderer={renderer}
            Tooltip={Tooltip}
            shown={shown}
            totalSteps={totalSteps}
            isBusy={isPreparing}
            isHidden={phase === 'revealing' || isWaiting || isShownGone}
            isDelayed={spotlight.isMorphing}
            isReducedMotion={isReducedMotion}
            titleId={titleId}
            descriptionId={descriptionId}
            onIntent={onIntent}
          />
        ) : null}
        {isWaiting ? <Waiting label={i18n.loadingAriaLabel} theme={theme} /> : null}
        {measure && !isClosing ? (
          <MeasuredTooltip
            key={measure.id}
            engine={engine}
            renderer={renderer}
            Tooltip={Tooltip}
            request={measure}
            totalSteps={totalSteps}
          />
        ) : null}
      </Layer>
    </RendererContext.Provider>
  );
}

type ShownTooltipProps = {
  readonly engine: TourEngine;
  readonly renderer: TourRenderer;
  readonly Tooltip: ComponentType<TourTooltipProps>;
  readonly shown: ShownStep;
  readonly totalSteps: number;
  readonly isBusy: boolean;
  readonly isHidden: boolean;
  /** Enters a moment later, while the spotlight is still moving to the target. */
  readonly isDelayed: boolean;
  readonly isReducedMotion: boolean;
  readonly titleId: string;
  readonly descriptionId: string;
  readonly onIntent: (intent: TourIntent) => void;
};

/** The step on screen: its tooltip in the platform's frame. Mounted once per shown step. */
function ShownTooltip({
  engine,
  renderer,
  Tooltip,
  shown,
  totalSteps,
  isBusy,
  isHidden,
  isDelayed,
  isReducedMotion,
  titleId,
  descriptionId,
  onIntent,
}: ShownTooltipProps): ReactNode {
  const {TooltipFrame} = renderer;
  const {transitionId, layout} = shown;
  const onSize = useCallback(
    (size: Size): void => {
      engine.reportTooltipSize(transitionId, size);
    },
    [engine, transitionId],
  );
  const onClose = useCallback((): void => {
    engine.dismiss('closed');
  }, [engine]);
  // The entrance is played once, when the step appears.
  const [entrance] = useState(() => entranceFor(layout.placement, {isDelayed, isReducedMotion}));
  return (
    <TooltipFrame
      layout={layout}
      entrance={entrance}
      isBusy={isBusy}
      isHidden={isHidden}
      onSize={onSize}
      onIntent={onIntent}
    >
      <TooltipLimitsContext.Provider value={layout}>
        <Tooltip
          step={shown.step}
          currentStep={shown.stepIndex}
          totalSteps={totalSteps}
          placement={layout.placement}
          arrowOffset={layout.arrowOffset}
          titleId={titleId}
          descriptionId={descriptionId}
          onNext={engine.actions.nextStep}
          onPrev={engine.actions.prevStep}
          onClose={onClose}
          onGoToStep={engine.actions.goToStep}
        />
      </TooltipLimitsContext.Provider>
    </TooltipFrame>
  );
}

type MeasuredTooltipProps = {
  readonly engine: TourEngine;
  readonly renderer: TourRenderer;
  readonly Tooltip: ComponentType<TourTooltipProps>;
  readonly request: MeasureRequest;
  readonly totalSteps: number;
};

/** The next step's tooltip, rendered invisibly with the same limits to learn its size: same content, no actions. */
function MeasuredTooltip({engine, renderer, Tooltip, request, totalSteps}: MeasuredTooltipProps): ReactNode {
  const {MeasureFrame} = renderer;
  const id = useId();
  const onSize = useCallback(
    (size: Size): void => {
      engine.reportTooltipSize(request.id, size);
    },
    [engine, request.id],
  );
  return (
    <MeasureFrame maxWidth={request.maxWidth} maxHeight={request.maxHeight} onSize={onSize}>
      <TooltipLimitsContext.Provider value={request}>
        <Tooltip
          step={request.step}
          currentStep={request.stepIndex}
          totalSteps={totalSteps}
          placement={request.step.target === undefined ? 'center' : (request.step.placement ?? 'bottom')}
          arrowOffset={undefined}
          titleId={`${id}title`}
          descriptionId={`${id}description`}
          onNext={noop}
          onPrev={noop}
          onClose={noop}
          onGoToStep={noop}
        />
      </TooltipLimitsContext.Provider>
    </MeasureFrame>
  );
}

/**
 * While the next step is prepared. Preparing it takes a while (`isWaiting`): the highlight closes and
 * a spinner shows that the tour is waiting. The app moved on before the next step is ready (the step
 * on screen's target is gone, `isShownGone`): the step goes at once rather than stay over what is
 * there now, and the spinner still waits for its delay.
 */
function usePreparation(
  view: TourViewState,
  isClosing: boolean,
): {readonly isPreparing: boolean; readonly isWaiting: boolean; readonly isShownGone: boolean} {
  const isPreparing = view.phase === 'preparing' && !isClosing;
  const isWaiting = useDelayedFlag(isPreparing, motion.waitingDelayMs);
  return {isPreparing, isWaiting, isShownGone: isPreparing && view.isShownTargetGone};
}

/** True once `isWaiting` has been true for `delayMs`, as long as it stays true. */
function useDelayedFlag(isWaiting: boolean, delayMs: number): boolean {
  const [isDue, setIsDue] = useState(false);
  const [wasWaiting, setWasWaiting] = useState(isWaiting);
  if (wasWaiting !== isWaiting) {
    setWasWaiting(isWaiting);
    setIsDue(false);
  }

  useEffect(() => {
    if (!isWaiting) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsDue(true);
    }, delayMs);
    return (): void => {
      clearTimeout(timer);
    };
  }, [isWaiting, delayMs]);
  return isWaiting && isDue;
}

type SpotlightState = {
  readonly hole: Box | undefined;
  readonly transition: SpotlightTransition | undefined;
  /** Gliding to a new target (the tooltip waits a moment before entering). */
  readonly isMorphing: boolean;
};

/** What the spotlight marks, and the key under which a move there is animated. */
function spotlightTarget(
  view: TourViewState,
  isWaiting: boolean,
): {readonly hole: Box | undefined; readonly key: string} {
  const {shown, phase, revealHighlight} = view;
  const shownKey = shown?.transitionId ?? 'none';
  // While the tour waits for a step, nothing is highlighted: the hole closes.
  if (isWaiting) {
    return {hole: undefined, key: `waiting:${shownKey}`};
  }

  if (phase === 'revealing') {
    return {
      hole: revealHighlight ? inflate(revealHighlight, tourLayout.highlightPadding) : undefined,
      key: `reveal:${shownKey}`,
    };
  }

  const hole = shown?.highlight ? inflate(shown.highlight, tourLayout.highlightPadding) : undefined;
  return {hole, key: `${shownKey}:${hole ? 'open' : 'closed'}`};
}

/**
 * Where the spotlight's hole is and how it gets there. While the next target is scrolled into
 * view, the hole goes with it (frame by frame, or straight to where it will end up); otherwise it
 * marks the step on screen. Moving to another step is animated; following a target that moves on
 * its own (layout changes, resizing) is instant, like the tooltip, also while the spotlight is
 * still on its way. While the tour waits for a step, the hole closes. Nothing animates before the
 * overlay has appeared.
 */
function useSpotlight(
  view: TourViewState,
  isVisible: boolean,
  isReducedMotion: boolean,
  isWaiting: boolean,
): SpotlightState {
  const {phase, followsScroll} = view;
  const isRevealing = phase === 'revealing';
  const {hole, key} = spotlightTarget(view, isWaiting);

  // The key at which the overlay appeared: it appears in place, later changes animate.
  const [appearedAtKey, setAppearedAtKey] = useState<string | undefined>(undefined);
  if (isVisible && appearedAtKey === undefined) {
    setAppearedAtKey(key);
  }

  // A new key glides to its hole; once the hole changes again, the glide is over.
  const [glide, setGlide] = useState({key, hole, isOver: false});
  if (glide.key !== key) {
    setGlide({key, hole, isOver: false});
  } else if (!glide.isOver && !boxesEqual(glide.hole, hole)) {
    setGlide({...glide, isOver: true});
  }

  const hasAppeared = appearedAtKey !== undefined;
  const isMorphing = hasAppeared && key !== appearedAtKey && !glide.isOver;
  let transition: SpotlightTransition | undefined;
  if (hasAppeared && !isReducedMotion) {
    if (isRevealing && followsScroll) {
      transition = {durationMs: motion.chaseMs, easing: 'linear'};
    } else if (isMorphing) {
      transition = {durationMs: motion.morphMs, easing: 'standard'};
    }
  }

  return {hole, transition, isMorphing};
}

/** "2 of 5: Title" when the step changes (the first step is announced by the tour appearing). */
function useAnnouncement(view: TourViewState, i18n: ResolvedI18n, isClosing: boolean, isWaiting: boolean): string {
  const {shown, phase} = view;
  const [firstKey, setFirstKey] = useState<number | undefined>(undefined);
  if (shown && firstKey === undefined) {
    setFirstKey(shown.transitionId);
  }

  // While the tour waits for a step, that is what is said; a step once it is on screen.
  if (isWaiting) {
    return i18n.loadingAriaLabel;
  }

  if (!shown || isClosing || phase !== 'showing' || shown.transitionId === firstKey) {
    return '';
  }

  const counter = formatTemplate(i18n.stepCounterTemplate, {current: shown.stepIndex + 1, total: view.steps.length});
  const title = textOf(shown.step.title);
  return title ? `${counter}: ${title}` : counter;
}

/** Name of the tour dialog for a custom tooltip without a title element: the step's title, or its counter. */
function fallbackLabelOf(shown: ShownStep | undefined, totalSteps: number, i18n: ResolvedI18n): string {
  if (!shown) {
    return '';
  }

  const counter = formatTemplate(i18n.stepCounterTemplate, {current: shown.stepIndex + 1, total: totalSteps});
  return textOf(shown.step.title) || counter;
}

/** The plain text of React content (strings, numbers, arrays and the children of elements). */
export function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child: ReactNode) => textOf(child)).join('');
  }

  if (isValidElement<{children?: ReactNode}>(node)) {
    return textOf(node.props.children);
  }

  return '';
}
