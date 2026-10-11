import {bottom, right, zeroInsets} from './box.util.js';
import type {Box, Insets, Point, Side, Size} from './geometry.type.js';

const fitSlack = 1e-6;

/**
 * How far a container has to scroll (positive: further down/right) so that the target plus a
 * margin is inside `area` and clear of `obstacles` (elements that stay put while the content
 * scrolls: sticky headers, floating buttons, cookie banners, any number of them).
 *
 * Per axis, the obstacles in the target's column (row) cut the area into free gaps. The target is
 * moved into the gap that needs the least scrolling, so scrolling up and down behave the same. The
 * first margin that fits is used (preferring one that fits on both axes). A target that only fits
 * without margin is centred in the nearest gap that can hold it; a target that fits in no gap is
 * aligned to the start of the largest one, keeping the smallest margin.
 */
export function computeRevealDelta(
  target: Box,
  area: Box,
  margins: readonly Insets[],
  obstacles: readonly Box[] = [],
): Point {
  const candidates = margins.length > 0 ? margins : [zeroInsets];
  const smallest = candidates.at(-1) ?? zeroInsets;
  // Pages scroll vertically: the vertical gaps depend on the obstacles in the target's column, the
  // horizontal ones on the obstacles in the row the target ends up in.
  const ySegments = freeSegments(
    area.y,
    bottom(area),
    obstacles.filter((o) => o.x < right(target) && right(o) > target.x).map((o) => [o.y, bottom(o)] as const),
  );
  const xSegmentsAfter = (dy: number): Segment[] =>
    freeSegments(
      area.x,
      right(area),
      obstacles
        .filter((o) => o.y < bottom(target) - dy && bottom(o) > target.y - dy)
        .map((o) => [o.x, right(o)] as const),
    );
  const yAxis = {start: target.y, size: target.height};
  const xAxis = {start: target.x, size: target.width};

  // The first margin that fits on both axes (it may leave room for the tooltip on one side).
  for (const margin of candidates) {
    const y = fitDelta(yAxis, ySegments, [margin.top, margin.bottom]);
    const x = y === undefined ? undefined : fitDelta(xAxis, xSegmentsAfter(y), [margin.left, margin.right]);
    if (y !== undefined && x !== undefined) {
      return {x, y};
    }
  }

  // Otherwise each axis on its own.
  const y =
    firstDefined(candidates, (m) => fitDelta(yAxis, ySegments, [m.top, m.bottom])) ??
    fallbackDelta(yAxis, ySegments, smallest.top);
  const xSegments = xSegmentsAfter(y);
  const x =
    firstDefined(candidates, (m) => fitDelta(xAxis, xSegments, [m.left, m.right])) ??
    fallbackDelta(xAxis, xSegments, smallest.left);
  return {x, y};
}

function firstDefined<T>(items: readonly T[], map: (item: T) => number | undefined): number | undefined {
  for (const item of items) {
    const value = map(item);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

type Segment = {readonly from: number; readonly to: number};

/** The parts of `[from, to]` not covered by `blocked`. Fully blocked: the whole range (nothing can be avoided). */
export function freeSegments(from: number, to: number, blocked: ReadonlyArray<readonly [number, number]>): Segment[] {
  const sorted = [...blocked]
    .map(([a, b]) => [Math.max(a, from), Math.min(b, to)] as const)
    .filter(([a, b]) => b > a)
    // eslint-disable-next-line unicorn/no-array-sort -- sorting a fresh copy (ES2023 `toSorted` is not available on every supported React Native version)
    .sort((a, b) => a[0] - b[0]);
  const segments: Segment[] = [];
  let cursor = from;
  for (const [a, b] of sorted) {
    if (a > cursor) {
      segments.push({from: cursor, to: a});
    }

    cursor = Math.max(cursor, b);
  }

  if (to > cursor) {
    segments.push({from: cursor, to});
  }

  return segments.length > 0 ? segments : [{from, to}];
}

type Axis = {readonly start: number; readonly size: number};

/** Smallest movement that puts `[from, to]` inside `segment`. */
function deltaInto(from: number, to: number, segment: Segment): number {
  if (from < segment.from) {
    return from - segment.from;
  }

  return to > segment.to ? to - segment.to : 0;
}

function smallestBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const value = score(item);
    if (value < bestScore) {
      best = item;
      bestScore = value;
    }
  }

  return best;
}

/** The smallest movement that puts the target plus margin into a gap that can hold it, if any. */
function fitDelta(
  {start, size}: Axis,
  segments: readonly Segment[],
  [before, after]: readonly [number, number],
): number | undefined {
  const from = start - before;
  const to = start + size + after;
  // Sub-pixel slack: gap widths computed from coordinates lose their last bits of precision.
  const fitting = segments.filter((segment) => segment.to - segment.from >= to - from - fitSlack);
  const best = smallestBy(fitting, (segment) => Math.abs(deltaInto(from, to, segment)));
  return best ? deltaInto(from, to, best) : undefined;
}

/**
 * When no margin fits: centre the target in the nearest gap that can hold it, or align it to the
 * start of the largest gap (keeping `leadingMargin`) when it fits nowhere.
 */
function fallbackDelta({start, size}: Axis, segments: readonly Segment[], leadingMargin: number): number {
  const centreDelta = (segment: Segment): number => start + size / 2 - (segment.from + segment.to) / 2;
  const holding = segments.filter((segment) => segment.to - segment.from >= size);
  const nearest = smallestBy(holding, (segment) => Math.abs(centreDelta(segment)));
  if (nearest) {
    return centreDelta(nearest);
  }

  const largest = smallestBy(segments, (segment) => -(segment.to - segment.from)) ?? {from: start, to: start};
  return start - Math.min(leadingMargin, (largest.to - largest.from) / 2) - largest.from;
}

export type RevealMarginInput = {
  readonly target: Box;
  readonly tooltip: Size;
  /** The visible, unobstructed part of the screen. */
  readonly area: Box;
  /** Sides in the order the tooltip would try them. */
  readonly sides: readonly Side[];
  readonly gap: number;
  readonly highlightPadding: number;
  readonly viewportPadding: number;
};

/**
 * Margins to keep around the target while scrolling it into view. The first entry also leaves
 * room for the tooltip on the first side (in the given order) where target and tooltip fit on
 * screen together. The last entry only keeps the highlight padding and viewport padding.
 */
export function buildRevealMargins(input: RevealMarginInput): Insets[] {
  const base = input.highlightPadding + input.viewportPadding;
  const baseMargin: Insets = {top: base, right: base, bottom: base, left: base};
  for (const side of input.sides) {
    const vertical = side === 'top' || side === 'bottom';
    const room = input.gap + (vertical ? input.tooltip.height : input.tooltip.width);
    const mainFits = vertical
      ? input.target.height + base * 2 + room <= input.area.height
      : input.target.width + base * 2 + room <= input.area.width;
    const crossFits = vertical
      ? input.tooltip.width + input.viewportPadding * 2 <= input.area.width
      : input.tooltip.height + input.viewportPadding * 2 <= input.area.height;
    if (mainFits && crossFits) {
      return [{...baseMargin, [side]: base + room}, baseMargin];
    }
  }

  return [baseMargin];
}
