import {
  bottom,
  centerX,
  centerY,
  clamp,
  deflate,
  finiteOr,
  inflate,
  intersect,
  projectOnto,
  right,
  sanitizeBox,
  sanitizeInsets,
  sanitizeLength,
  sanitizeSize,
} from './box.util.js';
import type {Box, Side, Size, Viewport} from './geometry.type.js';

export type LayoutPlacement = Side | 'center';

export type TooltipLayoutInput = {
  /** The target in layer coordinates, or `undefined` for a centred step. */
  readonly target: Box | undefined;
  /** The tooltip's measured size (already rendered with `maxWidth`/`maxHeight` applied). */
  readonly tooltip: Size;
  readonly viewport: Viewport;
  /** Preferred side. */
  readonly placement: Side;
  /** Side used for the same step before; kept while it still fits so the tooltip does not flip-flop. */
  readonly previousPlacement?: LayoutPlacement | undefined;
  /** Distance between the highlighted area and the tooltip. Arrows must not be longer than this. */
  readonly gap: number;
  /** Space between the target and the edge of the highlighted area. */
  readonly highlightPadding: number;
  /** Minimum distance between the tooltip and the edge of the safe area. */
  readonly viewportPadding: number;
  /** Minimum distance between the arrow and the tooltip's corners. */
  readonly arrowPadding: number;
  /** When set, the position is snapped to device pixels without leaving the safe area. */
  readonly pixelRatio?: number;
};

export type TooltipLayout = {
  readonly x: number;
  readonly y: number;
  /** The size the tooltip occupies; the box `x, y, width, height` always lies inside the safe area. */
  readonly width: number;
  readonly height: number;
  /** Side the tooltip was placed on, or `'center'` for steps without a target. */
  readonly placement: LayoutPlacement;
  /** Size limits the tooltip must be rendered with. Independent of the tooltip's size, so measuring again with them is stable. */
  readonly maxWidth: number;
  readonly maxHeight: number;
  /** Offset of the arrow along the tooltip edge facing the target, or `undefined` when no arrow should be drawn. */
  readonly arrowOffset: number | undefined;
};

const sides: readonly Side[] = ['top', 'right', 'bottom', 'left'];
const knownSides = new Set<string>(sides);

/**
 * Sub-pixel slack when deciding whether a side has room. Without it, floating-point noise (for
 * example from scrolling) could flip the tooltip between sides for differences of 1e-15 px.
 */
export const fitTolerance = 1e-7;

const opposite: Record<Side, Side> = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};

const perpendicular: Record<Side, readonly [Side, Side]> = {
  top: ['right', 'left'],
  bottom: ['right', 'left'],
  left: ['top', 'bottom'],
  right: ['top', 'bottom'],
};

function isVertical(side: Side): boolean {
  return side === 'top' || side === 'bottom';
}

/**
 * The area the tooltip may occupy: the viewport minus obstructed insets minus padding. On an axis
 * where that would leave less than one pixel, the padding is dropped first and then the insets, so
 * the result is never empty while the viewport itself has room. The result is always inside the
 * viewport rect.
 */
export function getSafeArea(viewport: Viewport, viewportPadding: number): Box {
  const rect = sanitizeBox(viewport.rect);
  const insets = sanitizeInsets(viewport.insets);
  const padding = sanitizeLength(viewportPadding);

  const axis = (start: number, size: number, insetStart: number, insetEnd: number): [number, number] => {
    const candidates: Array<[number, number]> = [
      [start + insetStart + padding, start + size - insetEnd - padding],
      [start + insetStart, start + size - insetEnd],
    ];
    for (const [from, to] of candidates) {
      if (to - from >= 1) {
        return [from, to];
      }
    }

    return [start, start + size];
  };

  const [x1, x2] = axis(rect.x, rect.width, insets.left, insets.right);
  const [y1, y2] = axis(rect.y, rect.height, insets.top, insets.bottom);
  return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
}

/**
 * Where to put the tooltip so it never leaves the visible, unobstructed part of the screen.
 *
 * Guarantees, for any input (including non-finite numbers):
 * - the returned box lies inside the safe area (see {@link getSafeArea}), and therefore inside the viewport;
 * - `maxWidth`/`maxHeight` depend only on the viewport, so re-measuring with them reaches a fixed point;
 * - when any side has room, the tooltip does not overlap the highlighted area;
 * - the preferred side wins whenever it fits, then the opposite side, then the roomier perpendicular side.
 */
export function computeTooltipLayout(input: TooltipLayoutInput): TooltipLayout {
  const safe = getSafeArea(input.viewport, input.viewportPadding);
  const gap = sanitizeLength(input.gap);
  const tooltip = sanitizeSize(input.tooltip);
  const width = Math.min(tooltip.width, safe.width);
  const height = Math.min(tooltip.height, safe.height);
  const base = {width, height, maxWidth: safe.width, maxHeight: safe.height};

  const finish = (x: number, y: number, placement: LayoutPlacement, arrowOffset: number | undefined): TooltipLayout => {
    const snapped = snap(x, y, input.pixelRatio);
    return {
      ...base,
      x: clamp(snapped.x, safe.x, right(safe) - width),
      y: clamp(snapped.y, safe.y, bottom(safe) - height),
      placement,
      arrowOffset,
    };
  };

  const rawTarget = input.target ? sanitizeBox(input.target) : undefined;
  if (!rawTarget) {
    return finish(safe.x + (safe.width - width) / 2, safe.y + (safe.height - height) / 2, 'center', undefined);
  }

  const anchor = inflate(rawTarget, sanitizeLength(input.highlightPadding));
  const visible = intersect(anchor, safe);
  const effective = visible ?? projectOnto(anchor, safe);

  const space: Record<Side, number> = {
    top: effective.y - safe.y - gap,
    bottom: bottom(safe) - bottom(effective) - gap,
    left: effective.x - safe.x - gap,
    right: right(safe) - right(effective) - gap,
  };
  const room = (side: Side): number => space[side] - (isVertical(side) ? height : width);
  const fits = (side: Side): boolean => room(side) >= -fitTolerance;

  const preferred: Side = knownSides.has(input.placement) ? input.placement : 'bottom';
  const order: Side[] = [preferred, opposite[preferred], ...roomiestFirst(perpendicular[preferred], room)];
  const previous = input.previousPlacement;
  if (previous && previous !== 'center' && previous !== preferred) {
    order.unshift(previous);
  }

  const chosen = order.find((side) => fits(side));
  const side = chosen ?? roomiestFirst(order, room)[0] ?? preferred;
  const position = placeOnSide({side, anchor: effective, size: {width, height}, gap, safe});

  // The arrow points at the centre of the part of the actual target the user can see.
  const visibleTarget = intersect(
    rawTarget,
    deflate(sanitizeBox(input.viewport.rect), sanitizeInsets(input.viewport.insets)),
  );
  let arrowOffset: number | undefined;
  if (chosen && visibleTarget) {
    const edge = isVertical(side) ? width : height;
    const inset = Math.min(sanitizeLength(input.arrowPadding), edge / 2);
    const target = isVertical(side) ? centerX(visibleTarget) - position.x : centerY(visibleTarget) - position.y;
    arrowOffset = clamp(target, inset, edge - inset);
  }

  return finish(position.x, position.y, side, arrowOffset);
}

/**
 * Sorts sides by available room, largest first. Sides whose room differs by less than
 * {@link fitTolerance} keep their given order, so the result does not depend on rounding noise.
 */
function roomiestFirst(candidates: readonly Side[], room: (side: Side) => number): Side[] {
  const result: Side[] = [];
  for (const side of candidates) {
    const index = result.findIndex((other) => room(side) > room(other) + fitTolerance);
    if (index === -1) {
      result.push(side);
    } else {
      result.splice(index, 0, side);
    }
  }

  return result;
}

type PlaceOnSideInput = {
  readonly side: Side;
  readonly anchor: Box;
  readonly size: Size;
  readonly gap: number;
  readonly safe: Box;
};

function placeOnSide({side, anchor, size, gap, safe}: PlaceOnSideInput): {x: number; y: number} {
  const crossX = clamp(centerX(anchor) - size.width / 2, safe.x, right(safe) - size.width);
  const crossY = clamp(centerY(anchor) - size.height / 2, safe.y, bottom(safe) - size.height);
  switch (side) {
    case 'top': {
      return {x: crossX, y: anchor.y - gap - size.height};
    }

    case 'bottom': {
      return {x: crossX, y: bottom(anchor) + gap};
    }

    case 'left': {
      return {x: anchor.x - gap - size.width, y: crossY};
    }

    case 'right': {
      return {x: right(anchor) + gap, y: crossY};
    }
  }
}

function snap(x: number, y: number, pixelRatio: number | undefined): {x: number; y: number} {
  const ratio = finiteOr(pixelRatio ?? 0, 0);
  if (ratio <= 0) {
    return {x, y};
  }

  return {x: Math.round(x * ratio) / ratio, y: Math.round(y * ratio) / ratio};
}
