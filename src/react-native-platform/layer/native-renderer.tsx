import {
  type ComponentRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  type GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  processColor,
  View,
} from 'react-native';
import {tourLayout} from '../../shared/engine/tour-engine.js';
import {clamp} from '../../shared/geometry/box.util.js';
import type {Box, Point, Size} from '../../shared/geometry/geometry.type.js';
import {useIsomorphicLayoutEffect} from '../../shared/react/use-isomorphic-layout-effect.hook.js';
import {motion} from '../../shared/renderer/motion.js';
import {TooltipLimitsContext, useRendererContext} from '../../shared/renderer/renderer-context.js';
import type {
  ArrowProps,
  BackdropProps,
  ButtonProps,
  CardParts,
  CardProps,
  CloseButtonProps,
  ContainerProps,
  CounterProps,
  DotProps,
  DotsProps,
  LayerProps,
  MeasureFrameProps,
  SpotlightProps,
  SpotlightTransition,
  TextPartProps,
  TooltipFrameProps,
  TourRenderer,
  WaitingProps,
} from '../../shared/renderer/renderer.type.js';

const emptySize: Size = {width: 0, height: 0};

/** Size of the host view the tour is drawn in. Internal. */
export const LayerSizeContext = createContext(emptySize);

const useNativeDriver = Platform.OS !== 'web';
const standardEasing = Easing.bezier(...motion.easing);
const ringWidth = 2;
const cornerRadius = 8;

function easingOf(easing: SpotlightTransition['easing']): (value: number) => number {
  return easing === 'linear' ? Easing.linear : standardEasing;
}

// ---------------------------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------------------------

type AnnounceWithOptions = (announcement: string, options: {queue?: boolean}) => void;

/**
 * Fades the tour in and out on the UI thread, lets the Android back button close the tour instead
 * of navigating underneath it, and announces step changes. Screen readers label the step through
 * the tooltip, which takes accessibility focus (`TooltipFrame`); React Native has no
 * `aria-labelledby`, so `titleId` and `fallbackLabel` are not needed here.
 */
function Layer({children, isVisible, fadeMs, isInteractive, announcement, stepKey, onIntent}: LayerProps): ReactNode {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: fadeMs,
      easing: standardEasing,
      useNativeDriver,
    });
    animation.start();
    return (): void => {
      animation.stop();
    };
  }, [opacity, isVisible, fadeMs]);

  // Subscribed again for every step: React Native asks the newest listener first, and a screen
  // opened by onBeforeStep may have added its own since.
  useEffect(() => {
    if (!isInteractive) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onIntent('back');
      return true;
    });
    return (): void => {
      subscription.remove();
    };
  }, [isInteractive, onIntent, stepKey]);

  useEffect(() => {
    if (!announcement || Platform.OS === 'web') {
      return;
    }

    // Queued: the screen reader first reads the tooltip it moved to.
    const announceWithOptions = (AccessibilityInfo as {announceForAccessibilityWithOptions?: AnnounceWithOptions})
      .announceForAccessibilityWithOptions;
    if (announceWithOptions) {
      announceWithOptions(announcement, {queue: true});
    } else {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement, stepKey]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, {opacity}]} pointerEvents={isInteractive ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

/** Touch position relative to the full-layer pressable: `locationX/Y` on iOS and Android, `offsetX/Y` on react-native-web. */
function touchPoint(event: GestureResponderEvent): Point {
  const native: GestureResponderEvent['nativeEvent'] & {offsetX?: number; offsetY?: number} = event.nativeEvent;
  return {
    x: Number.isFinite(native.locationX) ? native.locationX : (native.offsetX ?? Number.NaN),
    y: Number.isFinite(native.locationY) ? native.locationY : (native.offsetY ?? Number.NaN),
  };
}

function Backdrop({onPress}: BackdropProps): ReactNode {
  return (
    <Pressable
      accessible={false}
      style={StyleSheet.absoluteFill}
      onPress={(event): void => {
        onPress(touchPoint(event));
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------------------------

type HoleEdges = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly radius: number;
};

const edgeKeys = ['left', 'top', 'right', 'bottom'] as const;

/**
 * The hole's edges, kept within the layer (plus padding): the panels around the hole only reach so
 * far, so a hole far off screen is drawn just past the edge. Without a hole, a point in the middle.
 */
function holeEdges(size: Size, hole: Box | undefined): HoleEdges {
  if (!hole) {
    const x = size.width / 2;
    const y = size.height / 2;
    return {left: x, top: y, right: x, bottom: y, radius: 0};
  }

  const pad = tourLayout.highlightPadding;
  const left = clamp(hole.x, -pad, size.width + pad);
  const top = clamp(hole.y, -pad, size.height + pad);
  const right = Math.max(left, clamp(hole.x + hole.width, -pad, size.width + pad));
  const bottom = Math.max(top, clamp(hole.y + hole.height, -pad, size.height + pad));
  return {left, top, right, bottom, radius: Math.min(cornerRadius, (right - left) / 2, (bottom - top) / 2)};
}

/**
 * The overlay colour, split into an opaque colour and an opacity: the overlay is drawn with opaque
 * pieces that may overlap, faded as one group, so overlaps never show as darker seams.
 */
function splitColor(color: string): {readonly opaque: string; readonly alpha: number} {
  const processed = processColor(color);
  if (typeof processed !== 'number') {
    return {opaque: color, alpha: 1};
  }

  // ARGB, as a signed integer on Android.
  const argb = processed < 0 ? processed + 2 ** 32 : processed;
  const channel = (shift: number): number => Math.floor(argb / 2 ** shift) % 256;
  return {
    opaque: `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`,
    alpha: channel(24) / 255,
  };
}

type Edges = Record<(typeof edgeKeys)[number], Animated.Value>;

/**
 * The ring's bars are views this long, scaled down to the length they need. (Starting long keeps
 * them exact: Android rounds view sizes to whole pixels, which a tiny view scaled up would magnify.)
 */
const barLength = 1000;

/** Scale for a bar of `length`, never below (almost) zero. */
function barScale(length: ReturnType<typeof Animated.add>): Animated.AnimatedInterpolation<number> {
  return Animated.multiply(length, 1 / barLength).interpolate({
    inputRange: [0.001, 1],
    outputRange: [0.001, 1],
    extrapolateLeft: 'clamp',
  });
}

/**
 * The dimmed area with a rounded hole and a ring around it, made of plain views that only move:
 * four large panels around the hole, four small corner pieces rounding it off, and the ring as four
 * bars and four arcs. Every animation is a transform on the UI thread — nothing is laid out or
 * redrawn while it runs, so it stays smooth however busy JavaScript is. (No react-native-svg needed.)
 */
function Spotlight({hole, transition, theme}: SpotlightProps): ReactNode {
  const size = useContext(LayerSizeContext);
  const target = holeEdges(size, hole);
  const [edges] = useState<Edges>(() => ({
    left: new Animated.Value(target.left),
    top: new Animated.Value(target.top),
    right: new Animated.Value(target.right),
    bottom: new Animated.Value(target.bottom),
  }));

  // The animation moving the edges, until it has finished.
  const running = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const durationMs = transition?.durationMs;
  const easingKind = transition?.easing;
  useIsomorphicLayoutEffect(() => {
    // Instant changes are set directly, unless an animation is still running: a stopped native
    // animation reports where it stopped only afterwards, and that report would put the edges back
    // there. A zero-length animation replaces it instead, and reports last.
    if (durationMs === undefined && running.current === undefined) {
      for (const key of edgeKeys) {
        edges[key].setValue(target[key]);
      }

      return;
    }

    const animation = Animated.parallel(
      edgeKeys.map((key) =>
        Animated.timing(edges[key], {
          toValue: target[key],
          duration: durationMs ?? 0,
          easing: easingKind === undefined ? undefined : easingOf(easingKind),
          useNativeDriver,
        }),
      ),
    );
    running.current = animation;
    animation.start(() => {
      if (running.current === animation) {
        running.current = undefined;
      }
    });
  }, [edges, durationMs, easingKind, target.left, target.top, target.right, target.bottom]);

  useEffect(
    () => (): void => {
      running.current?.stop();
    },
    [],
  );

  const {radius} = target;
  const span = 2 * Math.max(size.width, size.height) + 4 * tourLayout.highlightPadding;
  const overlay = useMemo(() => splitColor(theme.overlayColor), [theme.overlayColor]);
  // Animated nodes are created once per size: new nodes on every render would be re-attached each time.
  const pieces = useMemo(() => {
    const centerX = Animated.multiply(Animated.add(edges.left, edges.right), 0.5);
    const centerY = Animated.multiply(Animated.add(edges.top, edges.bottom), 0.5);
    const outer = radius + ringWidth;
    return {
      panels: [
        // Above, below, left of and right of the hole; they overlap at the corners.
        [{translateX: (size.width - span) / 2}, {translateY: Animated.add(edges.top, -span)}],
        [{translateX: (size.width - span) / 2}, {translateY: edges.bottom}],
        [{translateX: Animated.add(edges.left, -span)}, {translateY: (size.height - span) / 2}],
        [{translateX: edges.right}, {translateY: (size.height - span) / 2}],
      ],
      // Each corner: where its box goes, and where the rounded view sits inside the box.
      corners: [
        {x: edges.left, y: edges.top, inner: {left: -radius, top: -radius}},
        {x: Animated.add(edges.right, -radius), y: edges.top, inner: {left: -2 * radius, top: -radius}},
        {x: edges.left, y: Animated.add(edges.bottom, -radius), inner: {left: -radius, top: -2 * radius}},
        {
          x: Animated.add(edges.right, -radius),
          y: Animated.add(edges.bottom, -radius),
          inner: {left: -2 * radius, top: -2 * radius},
        },
      ],
      bars: [
        [
          {translateX: Animated.add(centerX, -barLength / 2)},
          {translateY: Animated.add(edges.top, -ringWidth)},
          {scaleX: barScale(Animated.add(Animated.subtract(edges.right, edges.left), -2 * radius))},
        ],
        [
          {translateX: Animated.add(centerX, -barLength / 2)},
          {translateY: edges.bottom},
          {scaleX: barScale(Animated.add(Animated.subtract(edges.right, edges.left), -2 * radius))},
        ],
        [
          {translateX: Animated.add(edges.left, -ringWidth)},
          {translateY: Animated.add(centerY, -barLength / 2)},
          {scaleY: barScale(Animated.add(Animated.subtract(edges.bottom, edges.top), -2 * radius))},
        ],
        [
          {translateX: edges.right},
          {translateY: Animated.add(centerY, -barLength / 2)},
          {scaleY: barScale(Animated.add(Animated.subtract(edges.bottom, edges.top), -2 * radius))},
        ],
      ],
      arcs: [
        {x: Animated.add(edges.left, -ringWidth), y: Animated.add(edges.top, -ringWidth), inner: {left: 0, top: 0}},
        {x: Animated.add(edges.right, -radius), y: Animated.add(edges.top, -ringWidth), inner: {left: -outer, top: 0}},
        {
          x: Animated.add(edges.left, -ringWidth),
          y: Animated.add(edges.bottom, -radius),
          inner: {left: 0, top: -outer},
        },
        {
          x: Animated.add(edges.right, -radius),
          y: Animated.add(edges.bottom, -radius),
          inner: {left: -outer, top: -outer},
        },
      ],
    };
  }, [edges, radius, size.width, size.height, span]);
  const outer = radius + ringWidth;
  const ringColor = hole ? theme.primaryColor : 'transparent';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View needsOffscreenAlphaCompositing style={[StyleSheet.absoluteFill, {opacity: overlay.alpha}]}>
        {pieces.panels.map((transform, index) => (
          <Animated.View
            key={index}
            style={[styles.piece, {width: span, height: span, backgroundColor: overlay.opaque, transform}]}
          />
        ))}
        {radius > 0
          ? pieces.corners.map((corner, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.piece,
                  styles.clip,
                  {width: radius, height: radius, transform: [{translateX: corner.x}, {translateY: corner.y}]},
                ]}
              >
                <View
                  style={[
                    styles.piece,
                    corner.inner,
                    {
                      width: 4 * radius,
                      height: 4 * radius,
                      borderWidth: radius,
                      borderRadius: 2 * radius,
                      borderColor: overlay.opaque,
                    },
                  ]}
                />
              </Animated.View>
            ))
          : null}
      </View>
      {pieces.bars.map((transform, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            index < 2 ? styles.horizontalBar : styles.verticalBar,
            {backgroundColor: ringColor, transform},
          ]}
        />
      ))}
      {pieces.arcs.map((arc, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            styles.clip,
            {width: outer, height: outer, transform: [{translateX: arc.x}, {translateY: arc.y}]},
          ]}
        >
          <View
            style={[
              styles.piece,
              arc.inner,
              {
                width: 2 * outer,
                height: 2 * outer,
                borderWidth: ringWidth,
                borderRadius: outer,
                borderColor: ringColor,
              },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Tooltip frames
// ---------------------------------------------------------------------------------------------

/** Positions the tooltip with native-driven transforms, plays its entrance, reports its size and takes accessibility focus. */
function TooltipFrame({children, layout, entrance, isBusy, isHidden, onSize, onIntent}: TooltipFrameProps): ReactNode {
  const [values] = useState(() => ({
    x: new Animated.Value(layout.x),
    y: new Animated.Value(layout.y),
    progress: new Animated.Value(0),
  }));
  const containerRef = useRef<ComponentRef<typeof Animated.View> | null>(null);

  // Follow layout changes instantly.
  useIsomorphicLayoutEffect(() => {
    values.x.setValue(layout.x);
    values.y.setValue(layout.y);
  }, [values, layout.x, layout.y]);

  // Entrance (played once: the entrance never changes for a mounted frame), then move screen-reader
  // focus to the step (once it can be seen: screen readers may skip elements that are still transparent).
  useEffect(() => {
    const animation = Animated.timing(values.progress, {
      toValue: 1,
      duration: entrance.durationMs,
      delay: entrance.delayMs,
      easing: standardEasing,
      useNativeDriver,
    });
    animation.start(({finished}) => {
      const container = containerRef.current;
      if (finished && container && Platform.OS !== 'web') {
        AccessibilityInfo.sendAccessibilityEvent(container, 'focus');
      }
    });
    return (): void => {
      animation.stop();
    };
  }, [values, entrance]);

  // Animated nodes are created once: new nodes on every render would be re-attached each time.
  const animatedStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      opacity: values.progress,
      transform: [
        {
          translateX: Animated.add(
            values.x,
            values.progress.interpolate({inputRange: [0, 1], outputRange: [entrance.dx, 0]}),
          ),
        },
        {
          translateY: Animated.add(
            values.y,
            values.progress.interpolate({inputRange: [0, 1], outputRange: [entrance.dy, 0]}),
          ),
        },
        {scale: values.progress.interpolate({inputRange: [0, 1], outputRange: [entrance.scale, 1]})},
      ],
    }),
    [values, entrance],
  );

  // Busy (the next step is being prepared): the tooltip still takes taps, so they cannot fall
  // through to the dimmed area, but its buttons do not. Hidden (the next target is being scrolled
  // to): neither taps nor screen readers reach it.
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, isHidden ? styles.hidden : undefined]}>
      <Animated.View
        ref={containerRef}
        // TalkBack only moves to views it can focus: on Android the tooltip is one, read as a whole
        // (its buttons stay separate). On iOS it must not be one, or VoiceOver could not reach the buttons.
        accessible={Platform.OS === 'android' && !isHidden}
        accessibilityViewIsModal={!isHidden}
        accessibilityElementsHidden={isHidden}
        importantForAccessibility={isHidden ? 'no-hide-descendants' : 'auto'}
        pointerEvents={isHidden ? 'none' : isBusy ? 'box-only' : 'auto'}
        testID="rtk-tooltip"
        style={[animatedStyle, {maxWidth: layout.maxWidth, maxHeight: layout.maxHeight}]}
        onAccessibilityEscape={(): void => {
          onIntent('escape');
        }}
        onLayout={(event): void => {
          const {width, height} = event.nativeEvent.layout;
          onSize({width, height});
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** A spinner in the middle of the layer, faded in on the UI thread; presses go through to the dimmed area. */
function Waiting({label, theme}: WaitingProps): ReactNode {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.fadeInMs,
      easing: standardEasing,
      useNativeDriver,
    });
    animation.start();
    return (): void => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.waitingLayer]}>
      <Animated.View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={[styles.card, styles.waitingCard, {backgroundColor: theme.tooltipBackground, opacity}]}
      >
        <ActivityIndicator color={theme.primaryColor} />
      </Animated.View>
    </View>
  );
}

function MeasureFrame({children, maxWidth, maxHeight, onSize}: MeasureFrameProps): ReactNode {
  return (
    <View
      accessibilityElementsHidden
      pointerEvents="none"
      testID="rtk-measure"
      importantForAccessibility="no-hide-descendants"
      style={[styles.measure, {maxWidth, maxHeight}]}
      onLayout={(event): void => {
        const {width, height} = event.nativeEvent.layout;
        onSize({width, height});
      }}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Card parts
// ---------------------------------------------------------------------------------------------

const preferredWidth = 340;
const arrowSize = 10;

/** Plain strings in `<Text>`; other content as given. `nativeID` connects it to the step for screen readers. */
function TextOrContent({
  children,
  nativeID,
  style,
  isHeading,
}: {
  readonly children: ReactNode;
  readonly nativeID: string;
  readonly style: object;
  readonly isHeading: boolean;
}): ReactNode {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <Text nativeID={nativeID} style={style} accessibilityRole={isHeading ? 'header' : undefined}>
        {children}
      </Text>
    );
  }

  return <View nativeID={nativeID}>{children}</View>;
}

function Card({children}: CardProps): ReactNode {
  const {theme} = useRendererContext();
  const {maxWidth, maxHeight} = useContext(TooltipLimitsContext);
  return (
    <View
      style={[
        styles.card,
        {backgroundColor: theme.tooltipBackground, width: Math.min(preferredWidth, maxWidth), maxHeight},
      ]}
    >
      {children}
    </View>
  );
}

function Arrow({side, offset}: ArrowProps): ReactNode {
  const {theme} = useRendererContext();
  const half = arrowSize / 2;
  const position = {
    bottom: {top: -half, left: offset - half},
    top: {bottom: -half, left: offset - half},
    right: {left: -half, top: offset - half},
    left: {right: -half, top: offset - half},
  }[side];
  return <View pointerEvents="none" style={[styles.arrow, {backgroundColor: theme.tooltipBackground}, position]} />;
}

function Header({children}: ContainerProps): ReactNode {
  return <View style={styles.header}>{children}</View>;
}

function Counter({text}: CounterProps): ReactNode {
  const {theme} = useRendererContext();
  return (
    <View style={[styles.counter, {backgroundColor: theme.primaryColor}]}>
      <Text style={[styles.counterText, {color: theme.primaryTextColor}]}>{text}</Text>
    </View>
  );
}

function CloseButton({label, onPress}: CloseButtonProps): ReactNode {
  const {theme} = useRendererContext();
  return (
    <Pressable
      testID="rtk-close"
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({pressed}) => [styles.close, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.closeBar, {backgroundColor: theme.contentColor, transform: [{rotate: '45deg'}]}]} />
      <View style={[styles.closeBar, {backgroundColor: theme.contentColor, transform: [{rotate: '-45deg'}]}]} />
    </Pressable>
  );
}

function Body({children}: ContainerProps): ReactNode {
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
      {children}
    </ScrollView>
  );
}

function Title({id, children}: TextPartProps): ReactNode {
  const {theme} = useRendererContext();
  return (
    <TextOrContent isHeading nativeID={id} style={[styles.title, {color: theme.titleColor}]}>
      {children}
    </TextOrContent>
  );
}

function Content({id, children}: TextPartProps): ReactNode {
  const {theme} = useRendererContext();
  return (
    <TextOrContent nativeID={id} isHeading={false} style={[styles.content, {color: theme.contentColor}]}>
      {children}
    </TextOrContent>
  );
}

function Footer({children}: ContainerProps): ReactNode {
  return <View style={styles.footer}>{children}</View>;
}

function Button({kind, label, isDisabled, onPress}: ButtonProps): ReactNode {
  const {theme} = useRendererContext();
  const isNext = kind === 'next';
  return (
    <Pressable
      testID={isNext ? 'rtk-next' : 'rtk-prev'}
      accessibilityRole="button"
      accessibilityState={{disabled: isDisabled}}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.button,
        isNext && {backgroundColor: theme.primaryColor},
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {isNext ? null : (
        <View style={[StyleSheet.absoluteFill, styles.buttonTint, {backgroundColor: theme.contentColor}]} />
      )}
      <Text style={[styles.buttonText, {color: isNext ? theme.primaryTextColor : theme.contentColor}]}>{label}</Text>
    </Pressable>
  );
}

function Dots({label, children}: DotsProps): ReactNode {
  return (
    <View style={styles.dots} accessibilityLabel={label}>
      {children}
    </View>
  );
}

function Dot({label, isCurrent, onPress}: DotProps): ReactNode {
  const {theme} = useRendererContext();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: isCurrent}}
      style={styles.dotHit}
      onPress={onPress}
    >
      <View
        style={[
          styles.dot,
          isCurrent
            ? {backgroundColor: theme.primaryColor, transform: [{scale: 1.15}]}
            : {backgroundColor: theme.contentColor, opacity: 0.3},
        ]}
      />
    </Pressable>
  );
}

function Ellipsis(): ReactNode {
  const {theme} = useRendererContext();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dotHit}>
      <Text style={[styles.ellipsis, {color: theme.contentColor}]}>…</Text>
    </View>
  );
}

const card: CardParts = {
  Card,
  Arrow,
  Header,
  Counter,
  CloseButton,
  Body,
  Title,
  Content,
  Footer,
  Button,
  Dots,
  Dot,
  Ellipsis,
};

/** How React Native draws the tour. */
export const nativeRenderer: TourRenderer = {Layer, Backdrop, Spotlight, TooltipFrame, MeasureFrame, Waiting, card};

const styles = StyleSheet.create({
  piece: {position: 'absolute', top: 0, left: 0},
  clip: {overflow: 'hidden'},
  horizontalBar: {width: barLength, height: ringWidth},
  verticalBar: {width: ringWidth, height: barLength},
  hidden: {opacity: 0},
  measure: {position: 'absolute', top: 0, left: 0, opacity: 0},
  waitingLayer: {alignItems: 'center', justifyContent: 'center'},
  waitingCard: {width: 56, height: 56, alignItems: 'center', justifyContent: 'center'},
  card: {
    borderRadius: 14,
    ...Platform.select({
      ios: {shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: {width: 0, height: 8}},
      android: {elevation: 8},
      default: {},
    }),
  },
  arrow: {position: 'absolute', width: arrowSize, height: arrowSize, transform: [{rotate: '45deg'}]},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingLeft: 16,
    paddingRight: 8,
  },
  counter: {borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2},
  counterText: {fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums']},
  close: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8},
  closeBar: {position: 'absolute', width: 14, height: 1.75, borderRadius: 1},
  body: {flexShrink: 1},
  bodyContent: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16},
  title: {fontSize: 17, fontWeight: '600', lineHeight: 23, marginBottom: 4},
  content: {fontSize: 14, lineHeight: 21},
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  button: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonTint: {opacity: 0.08},
  buttonText: {fontSize: 14, fontWeight: '500'},
  disabled: {opacity: 0.4},
  pressed: {opacity: 0.7},
  dots: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1},
  dotHit: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
  dot: {width: 8, height: 8, borderRadius: 4},
  ellipsis: {fontSize: 12, opacity: 0.5},
});
