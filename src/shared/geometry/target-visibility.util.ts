import type {Box} from './geometry.type.js';

/**
 * How much of a target the user can see:
 * - `full`: the whole target is visible, or, for targets larger than the area, it covers the area.
 * - `partial`: at least half of what could be visible is visible on both axes.
 * - `none`: anything less.
 */
export type TargetVisibility = 'full' | 'partial' | 'none';

function axisVisibility(start: number, size: number, areaStart: number, areaSize: number): TargetVisibility {
  const end = start + size;
  const areaEnd = areaStart + areaSize;
  if (areaSize <= 0) {
    return 'none';
  }

  if (size === 0) {
    return start >= areaStart && start <= areaEnd ? 'full' : 'none';
  }

  const fullyInside = start >= areaStart && end <= areaEnd;
  const covers = start <= areaStart && end >= areaEnd;
  if (size <= areaSize ? fullyInside : covers) {
    return 'full';
  }

  const visible = Math.max(0, Math.min(end, areaEnd) - Math.max(start, areaStart));
  if (visible === 0 || visible < Math.min(size, areaSize) / 2) {
    return 'none';
  }

  return 'partial';
}

export function getTargetVisibility(target: Box, area: Box): TargetVisibility {
  const horizontal = axisVisibility(target.x, target.width, area.x, area.width);
  const vertical = axisVisibility(target.y, target.height, area.y, area.height);
  if (horizontal === 'none' || vertical === 'none') {
    return 'none';
  }

  return horizontal === 'full' && vertical === 'full' ? 'full' : 'partial';
}
