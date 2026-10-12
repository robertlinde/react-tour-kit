import type {ComponentType, ReactNode} from 'react';
import type {TourPhase} from '../engine/tour-engine.js';
import type {TooltipLayout} from '../geometry/compute-tooltip-layout.util.js';
import type {Box, Point, Side, Size} from '../geometry/geometry.type.js';
import type {TourPlacement} from '../types/tour-step.type.js';
import type {ResolvedTheme} from '../utils/theme.util.js';

/**
 * How a platform draws the tour: primitives only. Every decision — what is visible, when and how
 * things animate, which texts are shown, what a press means — is made by the shared overlay
 * (`TourOverlay`) and default tooltip (`DefaultTooltip`), so all platforms behave the same.
 *
 * Every primitive is required: a platform that lacks one does not compile. A new feature either
 * lives in the shared code (and every platform gets it), or needs a new primitive here (and every
 * platform has to draw it).
 */
export type TourRenderer = {
  /** The full-screen layer everything else is drawn in. */
  readonly Layer: ComponentType<LayerProps>;
  /** The area behind the spotlight that receives presses on the dimmed part of the screen. */
  readonly Backdrop: ComponentType<BackdropProps>;
  /** The dimmed overlay with a hole over the target. */
  readonly Spotlight: ComponentType<SpotlightProps>;
  /** Places the tooltip, plays its entrance, reports its size and takes focus. */
  readonly TooltipFrame: ComponentType<TooltipFrameProps>;
  /** Renders a tooltip invisibly with given size limits and reports its size. */
  readonly MeasureFrame: ComponentType<MeasureFrameProps>;
  /** The pieces of the built-in tooltip card. */
  readonly card: CardParts;
};

/** What the user asked for through platform input (keys, gestures, system buttons). */
export type TourIntent =
  /** Go to the next step. */
  | 'next'
  /** Go to the previous step. */
  | 'previous'
  /** Leave the tour like Escape does (ends with `'escape'`). */
  | 'escape'
  /** Leave the tour with a system back action (ends with `'closed'`). */
  | 'back';

export type LayerProps = {
  readonly children: ReactNode;
  readonly state: TourPhase | 'closing';
  /** Faded in (`true`) or out, over `fadeMs`. */
  readonly isVisible: boolean;
  readonly fadeMs: number;
  /** False while fading out: input is no longer handled. */
  readonly isInteractive: boolean;
  readonly theme: ResolvedTheme;
  /** Id of the element showing the step's title, `undefined` while no step is shown. */
  readonly titleId: string | undefined;
  /** Id of the element showing the step's content, `undefined` while no step is shown. */
  readonly descriptionId: string | undefined;
  /** Accessible name for when a custom tooltip renders no element with `titleId`. */
  readonly fallbackLabel: string;
  /** Text for screen readers when the step changes; empty when there is nothing to announce. */
  readonly announcement: string;
  /** Changes whenever a step is shown. */
  readonly stepKey: number | undefined;
  readonly onIntent: (intent: TourIntent) => void;
};

export type BackdropProps = {
  /** Whether a press closes the tour (to show it with a pointer cursor, for example). */
  readonly isDismissible: boolean;
  /** A press on the dimmed area, at a point in layer coordinates. */
  readonly onPress: (point: Point) => void;
};

export type SpotlightProps = {
  /** The hole over the target, or `undefined`: no hole, everything dimmed (shrunk to the layer's centre). */
  readonly hole: Box | undefined;
  /** How changes are animated; `undefined`: applied instantly. */
  readonly transition: SpotlightTransition | undefined;
  readonly theme: ResolvedTheme;
};

export type SpotlightTransition = {
  readonly durationMs: number;
  readonly easing: 'standard' | 'linear';
};

export type TooltipFrameProps = {
  readonly children: ReactNode;
  readonly layout: TooltipLayout;
  /** Played once, when the frame mounts. */
  readonly entrance: Entrance;
  /** A step change is being prepared: ignore presses. */
  readonly isBusy: boolean;
  /** The step change has taken a moment: show that the tour is working (dim the tooltip to `motion.waitingOpacity`). */
  readonly isWaiting: boolean;
  /** The next target is being scrolled into view: hide the tooltip (keep its size). */
  readonly isHidden: boolean;
  readonly onSize: (size: Size) => void;
  readonly onIntent: (intent: TourIntent) => void;
};

/** The tooltip's entrance: from this offset, scale and transparency to its place, after `delayMs`. */
export type Entrance = {
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
  readonly durationMs: number;
  readonly delayMs: number;
};

export type MeasureFrameProps = {
  readonly children: ReactNode;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly onSize: (size: Size) => void;
};

/** The pieces of the built-in tooltip, put together by the shared `DefaultTooltip`. */
export type CardParts = {
  readonly Card: ComponentType<CardProps>;
  readonly Arrow: ComponentType<ArrowProps>;
  readonly Header: ComponentType<ContainerProps>;
  readonly Counter: ComponentType<CounterProps>;
  readonly CloseButton: ComponentType<CloseButtonProps>;
  /** Scrolls when the content is taller than the space available. */
  readonly Body: ComponentType<ContainerProps>;
  readonly Title: ComponentType<TextPartProps>;
  readonly Content: ComponentType<TextPartProps>;
  readonly Footer: ComponentType<ContainerProps>;
  readonly Button: ComponentType<ButtonProps>;
  readonly Dots: ComponentType<DotsProps>;
  readonly Dot: ComponentType<DotProps>;
  readonly Ellipsis: ComponentType<EllipsisProps>;
};

export type CardProps = {
  readonly placement: TourPlacement | 'center';
  readonly children: ReactNode;
};

export type ArrowProps = {
  readonly side: Side;
  /** Distance from the card's left edge (top/bottom) or top edge (left/right) to the arrow's tip. */
  readonly offset: number;
};

export type ContainerProps = {
  readonly children: ReactNode;
};

export type CounterProps = {
  readonly text: string;
};

export type CloseButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
};

/** The title or the content: any React content, with the id screen readers find it by. */
export type TextPartProps = {
  readonly id: string;
  readonly children: ReactNode;
};

export type ButtonProps = {
  readonly kind: 'previous' | 'next';
  readonly label: string;
  readonly isDisabled: boolean;
  readonly onPress: () => void;
};

export type DotsProps = {
  /** Describes the group, for example "2 of 5". */
  readonly label: string;
  readonly children: ReactNode;
};

export type DotProps = {
  readonly label: string;
  readonly isCurrent: boolean;
  readonly onPress: () => void;
};

export type EllipsisProps = {
  readonly children?: never;
};
