import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import type {Box} from '../../../../src/shared/geometry/geometry.type.js';
import {getTargetVisibility, type TargetVisibility} from '../../../../src/shared/geometry/target-visibility.util.js';

const area: Box = {x: 0, y: 0, width: 400, height: 800};
const rank: Record<TargetVisibility, number> = {none: 0, partial: 1, full: 2};

describe('getTargetVisibility', () => {
  it('classifies typical cases', () => {
    expect(getTargetVisibility({x: 10, y: 10, width: 100, height: 40}, area)).toBe('full');
    expect(getTargetVisibility({x: 350, y: 10, width: 100, height: 40}, area)).toBe('partial');
    expect(getTargetVisibility({x: 380, y: 10, width: 100, height: 40}, area)).toBe('none');
    expect(getTargetVisibility({x: 10, y: 900, width: 100, height: 40}, area)).toBe('none');
    // Larger than the area: "full" means it covers the area.
    expect(getTargetVisibility({x: -10, y: -10, width: 500, height: 900}, area)).toBe('full');
    expect(getTargetVisibility({x: 10, y: 10, width: 500, height: 40}, area)).toBe('partial');
    // Zero-size targets are visible exactly when they are inside.
    expect(getTargetVisibility({x: 10, y: 10, width: 0, height: 0}, area)).toBe('full');
    expect(getTargetVisibility({x: -1, y: 10, width: 0, height: 0}, area)).toBe('none');
    // Nothing is visible in an empty area.
    expect(getTargetVisibility({x: 0, y: 0, width: 10, height: 10}, {x: 0, y: 0, width: 0, height: 0})).toBe('none');
  });

  it('never improves when the target moves further away from the area', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.double({min: -2000, max: 2000, noNaN: true}),
          y: fc.double({min: -2000, max: 2000, noNaN: true}),
          width: fc.double({min: 0, max: 2000, noNaN: true}),
          height: fc.double({min: 0, max: 2000, noNaN: true}),
        }),
        fc.double({min: 0, max: 2000, noNaN: true}),
        (target, distance) => {
          const direction = target.x + target.width / 2 >= area.x + area.width / 2 ? 1 : -1;
          const moved = {...target, x: target.x + direction * distance};
          expect(rank[getTargetVisibility(moved, area)]).toBeLessThanOrEqual(rank[getTargetVisibility(target, area)]);
        },
      ),
      {numRuns: 5000},
    );
  });
});
