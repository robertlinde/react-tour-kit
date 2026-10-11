import type {Box, Insets, Point, Size} from './geometry.type.js';

export const zeroInsets: Insets = {top: 0, right: 0, bottom: 0, left: 0};

/** Returns `value` if it is a finite number, otherwise `fallback`. */
export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Finite and non-negative, otherwise 0. */
export function nonNegative(value: number): number {
  return Math.max(0, finiteOr(value, 0));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function right(box: Box): number {
  return box.x + box.width;
}

export function bottom(box: Box): number {
  return box.y + box.height;
}

export function centerX(box: Box): number {
  return box.x + box.width / 2;
}

export function centerY(box: Box): number {
  return box.y + box.height / 2;
}

/**
 * Coordinates beyond this magnitude are clamped so that sums of coordinates and sizes can never
 * overflow to `Infinity`. No real screen comes anywhere near it.
 */
const coordinateLimit = 1e9;

function coordinate(value: number): number {
  return clamp(finiteOr(value, 0), -coordinateLimit, coordinateLimit);
}

export function sanitizeLength(value: number): number {
  return Math.min(nonNegative(value), coordinateLimit);
}

/** Replaces non-finite coordinates with 0, negative sizes with 0 and clamps absurd magnitudes. */
export function sanitizeBox(box: Box): Box {
  return {
    x: coordinate(box.x),
    y: coordinate(box.y),
    width: sanitizeLength(box.width),
    height: sanitizeLength(box.height),
  };
}

export function sanitizeSize(size: Size): Size {
  return {width: sanitizeLength(size.width), height: sanitizeLength(size.height)};
}

export function sanitizeInsets(insets: Insets): Insets {
  return {
    top: sanitizeLength(insets.top),
    right: sanitizeLength(insets.right),
    bottom: sanitizeLength(insets.bottom),
    left: sanitizeLength(insets.left),
  };
}

export function isFiniteBox(box: Box): boolean {
  return Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height);
}

export function inflate(box: Box, amount: number): Box {
  return {x: box.x - amount, y: box.y - amount, width: box.width + amount * 2, height: box.height + amount * 2};
}

export function deflate(box: Box, insets: Insets): Box {
  return {
    x: box.x + insets.left,
    y: box.y + insets.top,
    width: Math.max(0, box.width - insets.left - insets.right),
    height: Math.max(0, box.height - insets.top - insets.bottom),
  };
}

/**
 * Intersection of two boxes, or `undefined` when they do not overlap. Touching edges count as an
 * empty (zero-area) intersection and also return `undefined`, except when one of the boxes is
 * itself degenerate (a zero-size target is "visible" when it lies inside the other box).
 */
export function intersect(a: Box, b: Box): Box | undefined {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(right(a), right(b));
  const y2 = Math.min(bottom(a), bottom(b));
  if (x2 < x1 || y2 < y1) {
    return undefined;
  }

  const degenerate = a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0;
  if (!degenerate && (x2 === x1 || y2 === y1)) {
    return undefined;
  }

  return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
}

/** Collapses `box` onto the nearest edge of `area` when the two do not overlap (a zero-size box on that edge). */
export function projectOnto(box: Box, area: Box): Box {
  const x1 = clamp(box.x, area.x, right(area));
  const x2 = clamp(right(box), area.x, right(area));
  const y1 = clamp(box.y, area.y, bottom(area));
  const y2 = clamp(bottom(box), area.y, bottom(area));
  return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
}

/**
 * Narrows a clip area by another clipping box. When the two do not overlap, the result is an empty
 * box on the edge of `box` nearest to `clip`, so it still tells in which direction the content is.
 */
export function narrowClip(clip: Box | undefined, box: Box): Box {
  if (!clip) {
    return box;
  }

  return intersect(clip, box) ?? projectOnto(clip, box);
}

export function containsPoint(box: Box, point: Point): boolean {
  return point.x >= box.x && point.x <= right(box) && point.y >= box.y && point.y <= bottom(box);
}

export function containsBox(outer: Box, inner: Box, epsilon = 0): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    right(inner) <= right(outer) + epsilon &&
    bottom(inner) <= bottom(outer) + epsilon
  );
}

export function boxesEqual(a: Box | undefined, b: Box | undefined, epsilon = 0.01): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.width - b.width) <= epsilon &&
    Math.abs(a.height - b.height) <= epsilon
  );
}

export function sizesEqual(a: Size | undefined, b: Size | undefined, epsilon = 0.01): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return Math.abs(a.width - b.width) <= epsilon && Math.abs(a.height - b.height) <= epsilon;
}

export function insetsEqual(a: Insets, b: Insets, epsilon = 0.01): boolean {
  return (
    Math.abs(a.top - b.top) <= epsilon &&
    Math.abs(a.right - b.right) <= epsilon &&
    Math.abs(a.bottom - b.bottom) <= epsilon &&
    Math.abs(a.left - b.left) <= epsilon
  );
}

export function pointsEqual(a: Point, b: Point, epsilon = 0.01): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}
