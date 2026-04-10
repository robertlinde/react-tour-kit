import {type Rect} from '../types';

const tooltipWidthDesktop = 400;
const tooltipWidthMobile = 320;
const mobileBreakpoint = 640;
const defaultTooltipHeight = 200;
const tooltipPadding = 16;

type TooltipDimensions = {
  readonly width: number;
  readonly height: number;
};

type ViewportDimensions = {
  readonly width: number;
  readonly height: number;
};

/**
 * Calculates the optimal position for the tooltip relative to the target element.
 * Automatically adjusts position to stay within viewport bounds.
 * Platform-agnostic: works with any Rect implementation.
 */
export function calculateTooltipPosition(
  targetRect: Rect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  tooltipDimensions: TooltipDimensions,
  viewportDimensions: ViewportDimensions,
): {top: number; left: number} {
  const viewportWidth = viewportDimensions.width;
  const viewportHeight = viewportDimensions.height;
  const isMobile = viewportWidth < mobileBreakpoint;
  const defaultWidth = isMobile
    ? Math.min(tooltipWidthMobile, viewportWidth - tooltipPadding * 2)
    : tooltipWidthDesktop;
  const tooltipWidth = tooltipDimensions.width > 0 ? tooltipDimensions.width : defaultWidth;
  const tooltipHeight = tooltipDimensions.height > 0 ? tooltipDimensions.height : defaultTooltipHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top': {
      top = targetRect.top - tooltipHeight - tooltipPadding;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    }

    case 'bottom': {
      top = targetRect.bottom + tooltipPadding;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    }

    case 'left': {
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - tooltipWidth - tooltipPadding;
      break;
    }

    case 'right': {
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.right + tooltipPadding;
      break;
    }
  }

  // Flip tooltip to opposite side if it overflows the viewport
  if (top < tooltipPadding) {
    top = targetRect.bottom + tooltipPadding;
  }

  if (top + tooltipHeight > viewportHeight - tooltipPadding) {
    top = targetRect.top - tooltipHeight - tooltipPadding;
  }

  // Final clamp — ensure tooltip is always reachable within the viewport
  top = Math.max(tooltipPadding, Math.min(top, viewportHeight - tooltipHeight - tooltipPadding));
  left = Math.max(tooltipPadding, Math.min(left, viewportWidth - tooltipWidth - tooltipPadding));

  return {top, left};
}
