import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useInsertionEffect,
  useRef,
  useState,
} from 'react';
import {clamp} from '../../shared/geometry/box.util.js';
import type {Box} from '../../shared/geometry/geometry.type.js';
import {useIsomorphicLayoutEffect} from '../../shared/react/use-isomorphic-layout-effect.hook.js';
import {motion} from '../../shared/renderer/motion.js';
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
  TextPartProps,
  TooltipFrameProps,
  TourRenderer,
} from '../../shared/renderer/renderer.type.js';
import {handlesKey, pageDirection} from '../dom/elements.util.js';
import {keepReachable} from '../dom/keep-reachable.util.js';
import {lockScroll} from '../dom/scroll-lock.util.js';
import {injectTourStyles} from './styles.js';

/** Custom properties (`--rtk-*`) in inline styles. */
type StyleWithVariables = CSSProperties & Record<`--rtk-${string}`, string>;

const [x1, y1, x2, y2] = motion.easing;
const standardEasing = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

// ---------------------------------------------------------------------------------------------
// Layer: a modal <dialog> in the top layer
// ---------------------------------------------------------------------------------------------

/** Elements made inert by the fallback below, so they can be restored. */
const inertedByTour = new WeakMap<HTMLDialogElement, Element[]>();

/**
 * Opens the dialog as a modal: top layer, rest of the page inert, focus restored on close.
 * Without `showModal` (very old browsers, jsdom) the dialog is shown with a high z-index
 * (`--rtk-z-index`) and the rest of the page is made inert manually.
 */
function openModal(dialog: HTMLDialogElement): void {
  if (dialog.open || dialog.hasAttribute('open')) {
    return;
  }

  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal();
      return;
    } catch {
      // Not connected or not allowed: fall through to the fallback.
    }
  }

  dialog.setAttribute('open', '');
  const others = [...document.body.children].filter(
    (element) => element !== dialog && !element.contains(dialog) && !element.hasAttribute('inert'),
  );
  for (const element of others) {
    element.setAttribute('inert', '');
  }

  inertedByTour.set(dialog, others);
}

function closeModal(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }

  for (const element of inertedByTour.get(dialog) ?? []) {
    element.removeAttribute('inert');
  }

  inertedByTour.delete(dialog);
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/** The tooltip on screen, to put focus on. */
function shownTooltip(dialog: HTMLDialogElement): HTMLElement | null {
  return dialog.querySelector<HTMLElement>('[data-rtk-tooltip]:not([data-hidden])');
}

/**
 * Returns focus to where it was when the tour opened. Browsers do this when a modal dialog closes,
 * but forget where it was once the dialog has been re-opened over one of the app's own.
 */
function restoreFocus(trigger: Element | null, dialog: HTMLDialogElement): void {
  if (!(trigger instanceof HTMLElement) || trigger === document.body || !trigger.isConnected) {
    return;
  }

  const active = document.activeElement;
  if (!active || active === document.body || dialog.contains(active)) {
    trigger.focus({preventScroll: true});
  }
}

/**
 * A modal `<dialog>` in the top layer: above any z-index, with the page inert, focus restored on
 * close and the page kept from scrolling. Keys and the dialog's own close requests become intents.
 */
function Layer({
  children,
  state,
  isVisible,
  fadeMs,
  isInteractive,
  theme,
  titleId,
  descriptionId,
  fallbackLabel,
  announcement,
  stepKey,
  onIntent,
}: LayerProps): ReactNode {
  const layerRef = useRef<HTMLDialogElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const reopening = useRef(false);
  const [direction] = useState(pageDirection);

  useInsertionEffect(() => {
    injectTourStyles(document);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const dialog = layerRef.current;
    if (!dialog) {
      return undefined;
    }

    const trigger = document.activeElement;
    openModal(dialog);
    const unlock = lockScroll(dialog);
    const stopKeepingReachable = keepReachable(dialog);
    return (): void => {
      stopKeepingReachable();
      unlock();
      reopening.current = true;
      closeModal(dialog);
      restoreFocus(trigger, dialog);
    };
  }, []);

  // Escape belongs to the topmost modal, the tour. Modal libraries underneath listen for it on the
  // document before it reaches the tour (Radix, in the capture phase): take it on the window first.
  useEffect(() => {
    if (!isInteractive) {
      return undefined;
    }

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      onIntent('escape');
    };

    globalThis.addEventListener('keydown', onEscape, {capture: true});
    return (): void => {
      globalThis.removeEventListener('keydown', onEscape, {capture: true});
    };
  }, [isInteractive, onIntent]);

  // If the app opened its own modal (in onBeforeStep), move the tour back on top of it.
  useEffect(() => {
    const dialog = layerRef.current;
    if (!dialog || stepKey === undefined) {
      return;
    }

    const other = [...document.querySelectorAll('dialog')].find(
      (element) => element !== dialog && element.open && safeMatches(element, ':modal'),
    );
    if (other && dialog.open && safeMatches(dialog, ':modal')) {
      const focused = document.activeElement;
      // `close` fires asynchronously; the handler consumes this flag.
      reopening.current = true;
      closeModal(dialog);
      openModal(dialog);
      // Opening focuses the first button: keep focus where it was in the tour.
      const refocus = focused instanceof HTMLElement && dialog.contains(focused) ? focused : shownTooltip(dialog);
      refocus?.focus({preventScroll: true});
    }
  }, [stepKey]);

  // A custom tooltip may not render an element with the title id: then label the dialog directly.
  useEffect(() => {
    const dialog = layerRef.current;
    if (!dialog || titleId === undefined) {
      return;
    }

    // `getElementById`: ids from useId() contain characters that would need escaping in selectors.
    // eslint-disable-next-line unicorn/prefer-query-selector
    if (document.getElementById(titleId)) {
      dialog.removeAttribute('aria-label');
    } else {
      dialog.setAttribute('aria-label', fallbackLabel);
    }
  }, [stepKey, titleId, fallbackLabel]);

  useEffect(() => {
    if (announcement && liveRef.current) {
      liveRef.current.textContent = announcement;
    }
  }, [announcement, stepKey]);

  const style: StyleWithVariables = {
    '--rtk-primary': theme.primaryColor,
    '--rtk-on-primary': theme.primaryTextColor,
    '--rtk-bg': theme.tooltipBackground,
    '--rtk-title': theme.titleColor,
    '--rtk-text': theme.contentColor,
    '--rtk-overlay': theme.overlayColor,
    '--rtk-fade-duration': `${fadeMs}ms`,
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>): void => {
    const {nativeEvent, key} = event;
    if (
      !isInteractive ||
      event.defaultPrevented ||
      nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    if ((key === 'ArrowRight' || key === 'ArrowLeft') && !handlesKey(event.target, key)) {
      event.preventDefault();
      // In right-to-left pages, the arrow pointing to the start goes forward.
      const isForward = (key === 'ArrowRight') !== (direction === 'rtl');
      onIntent(isForward ? 'next' : 'previous');
    }
  };

  return (
    <dialog
      ref={layerRef}
      className="rtk-root"
      data-rtk-root=""
      data-state={state}
      data-visible={isVisible ? '' : undefined}
      dir={direction === 'rtl' ? 'rtl' : undefined}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      style={style}
      onKeyDown={onKeyDown}
      onCancel={(event): void => {
        // Escape (and the Android back gesture) fire `cancel`; the tour decides how to close.
        event.preventDefault();
        onIntent('escape');
      }}
      onClose={(): void => {
        if (reopening.current) {
          reopening.current = false;
          return;
        }

        // The browser closed the dialog by force (for example a second Escape press).
        onIntent('escape');
      }}
    >
      {children}
      <div ref={liveRef} className="rtk-sr-only" aria-live="polite" aria-atomic="true" />
    </dialog>
  );
}

function Backdrop({isDismissible, onPress}: BackdropProps): ReactNode {
  return (
    <div
      className="rtk-backdrop"
      data-rtk-backdrop=""
      data-closable={isDismissible ? '' : undefined}
      onClick={(event): void => {
        onPress({x: event.clientX, y: event.clientY});
      }}
    />
  );
}

const spotlightProperties = ['left', 'top', 'width', 'height', 'border-radius'];

/** How far off screen a hole may be: past the ring around it. */
const offScreenMargin = 16;

/**
 * Keeps a hole that is far off screen (a target still to be scrolled to) just past the screen's
 * edge: the dim is the hole's shadow, which only reaches so far.
 */
function nearScreen(hole: Box): Box {
  const width = document.documentElement.clientWidth || globalThis.innerWidth;
  const height = document.documentElement.clientHeight || globalThis.innerHeight;
  return {
    ...hole,
    x: clamp(hole.x, -offScreenMargin - hole.width, width + offScreenMargin),
    y: clamp(hole.y, -offScreenMargin - hole.height, height + offScreenMargin),
  };
}

/** The dimmed overlay with a rounded hole, drawn with a single box-shadow. */
function Spotlight({hole: requested, transition}: SpotlightProps): ReactNode {
  const hole = requested ? nearScreen(requested) : undefined;
  const style: CSSProperties = hole
    ? {
        left: hole.x,
        top: hole.y,
        width: hole.width,
        height: hole.height,
        borderRadius: `min(var(--rtk-spotlight-radius), ${hole.width / 2}px, ${hole.height / 2}px)`,
      }
    : {left: '50%', top: '50%', width: 0, height: 0, borderRadius: 0};
  if (transition) {
    const easing = transition.easing === 'linear' ? 'linear' : standardEasing;
    style.transition = spotlightProperties
      .map((property) => `${property} ${transition.durationMs}ms ${easing}`)
      .join(', ');
  }

  return (
    <div
      aria-hidden="true"
      className="rtk-spotlight"
      data-rtk-spotlight=""
      data-collapsed={hole ? undefined : ''}
      style={style}
    />
  );
}

function isVerticalWritingMode(element: Element): boolean {
  return getComputedStyle(element).writingMode.startsWith('vertical');
}

/**
 * True when the tooltip's content is bigger than its frame (it reached the size limits), so the
 * frame has to scroll. Decorations sticking out of the content (the arrow) do not count.
 */
function overflowsFrame(frame: HTMLElement): boolean {
  const children = [...frame.children].filter((child) => child instanceof HTMLElement);
  if (children.length === 0 || children.length < frame.children.length) {
    return frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1;
  }

  let left = 0;
  let top = 0;
  let right = 0;
  let bottom = 0;
  for (const child of children) {
    left = Math.min(left, child.offsetLeft);
    top = Math.min(top, child.offsetTop);
    right = Math.max(right, child.offsetLeft + child.offsetWidth);
    bottom = Math.max(bottom, child.offsetTop + child.offsetHeight);
  }

  return left < -1 || top < -1 || right > frame.clientWidth + 1 || bottom > frame.clientHeight + 1;
}

/** Positions the tooltip (with `translate`, so the entrance's `transform` never moves it), reports its size and takes focus. */
function TooltipFrame({children, layout, entrance, isBusy, isWaiting, isHidden, onSize}: TooltipFrameProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isEntering, setIsEntering] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Report size changes (late-loading fonts or images, content changes); keep scrolling available
  // when the content does not fit. Sizes come from ResizeObserver's border box: unlike
  // getBoundingClientRect it ignores the entrance animation's scale. The content is observed too:
  // it can keep growing once the frame has reached its size limits.
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const report = (box: ResizeObserverSize | undefined): void => {
      const isVertical = isVerticalWritingMode(element);
      const width = box ? (isVertical ? box.blockSize : box.inlineSize) : element.offsetWidth;
      const height = box ? (isVertical ? box.inlineSize : box.blockSize) : element.offsetHeight;
      onSize({width, height});
    };

    if (typeof ResizeObserver !== 'function') {
      // No ResizeObserver (jsdom): report the size once.
      report(undefined);
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      setIsOverflowing(overflowsFrame(element));
      const own = entries.find((entry) => entry.target === element);
      if (own) {
        report(own.borderBoxSize?.[0]);
      }
    });
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }

    return (): void => {
      observer.disconnect();
    };
  }, [onSize]);

  // Move focus into the tooltip so screen readers read it and keyboard users can act on it.
  useEffect(() => {
    ref.current?.focus({preventScroll: true});
  }, []);

  const style: StyleWithVariables = {
    translate: `${layout.x}px ${layout.y}px`,
    maxWidth: layout.maxWidth,
    maxHeight: layout.maxHeight,
    '--rtk-max-height': `${layout.maxHeight}px`,
    '--rtk-enter-x': `${entrance.dx}px`,
    '--rtk-enter-y': `${entrance.dy}px`,
    '--rtk-enter-scale': String(entrance.scale),
    '--rtk-enter-duration': `${entrance.durationMs}ms`,
    '--rtk-enter-delay': `${entrance.delayMs}ms`,
    '--rtk-waiting-opacity': String(motion.waitingOpacity),
  };

  return (
    <div
      ref={ref}
      className="rtk-tooltip"
      data-rtk-tooltip=""
      data-placement={layout.placement}
      data-entering={isEntering ? '' : undefined}
      data-hidden={isHidden ? '' : undefined}
      data-waiting={isWaiting ? '' : undefined}
      data-overflowing={isOverflowing ? '' : undefined}
      aria-busy={isBusy ? 'true' : undefined}
      tabIndex={-1}
      style={style}
      onAnimationEnd={(event): void => {
        // Animations inside a custom tooltip bubble up here too.
        if (event.target === event.currentTarget) {
          setIsEntering(false);
        }
      }}
    >
      {children}
    </div>
  );
}

function MeasureFrame({children, maxWidth, maxHeight, onSize}: MeasureFrameProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      onSize({width: rect.width, height: rect.height});
    }
  }, [onSize]);

  const style: StyleWithVariables = {maxWidth, maxHeight, '--rtk-max-height': `${maxHeight}px`};
  return (
    <div ref={ref} aria-hidden="true" className="rtk-measure" style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Card parts
// ---------------------------------------------------------------------------------------------

function CloseIcon(): ReactNode {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Card({placement, children}: CardProps): ReactNode {
  return (
    <div className="rtk-card" data-placement={placement}>
      {children}
    </div>
  );
}

function Arrow({side, offset}: ArrowProps): ReactNode {
  const style: StyleWithVariables = {'--rtk-arrow-offset': `${offset}px`};
  return <div aria-hidden="true" className="rtk-arrow" data-side={side} style={style} />;
}

function Header({children}: ContainerProps): ReactNode {
  return <div className="rtk-header">{children}</div>;
}

function Counter({text}: CounterProps): ReactNode {
  return <span className="rtk-counter">{text}</span>;
}

function CloseButton({label, onPress}: CloseButtonProps): ReactNode {
  return (
    <button type="button" className="rtk-close" aria-label={label} onClick={onPress}>
      <CloseIcon />
    </button>
  );
}

function Body({children}: ContainerProps): ReactNode {
  return <div className="rtk-body">{children}</div>;
}

/** A heading by role rather than an `<h2>`: global heading styles (resets, typography) do not reach it. */
function Title({id, children}: TextPartProps): ReactNode {
  return (
    <div id={id} role="heading" aria-level={2} className="rtk-title">
      {children}
    </div>
  );
}

function Content({id, children}: TextPartProps): ReactNode {
  return (
    <div id={id} className="rtk-content">
      {children}
    </div>
  );
}

function Footer({children}: ContainerProps): ReactNode {
  return <div className="rtk-footer">{children}</div>;
}

function Button({kind, label, isDisabled, onPress}: ButtonProps): ReactNode {
  return (
    <button
      type="button"
      className={kind === 'next' ? 'rtk-button rtk-button--next' : 'rtk-button rtk-button--prev'}
      disabled={isDisabled}
      onClick={onPress}
    >
      {label}
    </button>
  );
}

function Dots({label, children}: DotsProps): ReactNode {
  return (
    <div className="rtk-dots" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Dot({label, isCurrent, onPress}: DotProps): ReactNode {
  return (
    <button
      type="button"
      className="rtk-dot"
      aria-label={label}
      aria-current={isCurrent ? 'step' : undefined}
      onClick={onPress}
    />
  );
}

function Ellipsis(): ReactNode {
  return <span aria-hidden="true" className="rtk-ellipsis" />;
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

/** How the web draws the tour. */
export const webRenderer: TourRenderer = {Layer, Backdrop, Spotlight, TooltipFrame, MeasureFrame, card};
