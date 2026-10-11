import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {bottom, right} from '../../../../src/shared/geometry/box.util.js';
import type {Box, Insets, Point} from '../../../../src/shared/geometry/geometry.type.js';
import {buildRevealMargins, computeRevealDelta} from '../../../../src/shared/geometry/reveal.util.js';

const uniform = (value: number): Insets => ({top: value, right: value, bottom: value, left: value});
const shift = (box: Box, delta: Point): Box => ({...box, x: box.x - delta.x, y: box.y - delta.y});

const boxArb = (maxSize: number): fc.Arbitrary<Box> =>
  fc.record({
    x: fc.double({min: -5000, max: 5000, noNaN: true}),
    y: fc.double({min: -5000, max: 5000, noNaN: true}),
    width: fc.double({min: 0, max: maxSize, noNaN: true}),
    height: fc.double({min: 0, max: maxSize, noNaN: true}),
  });
const marginArb = fc.record({
  top: fc.double({min: 0, max: 400, noNaN: true}),
  right: fc.double({min: 0, max: 400, noNaN: true}),
  bottom: fc.double({min: 0, max: 400, noNaN: true}),
  left: fc.double({min: 0, max: 400, noNaN: true}),
});
const tolerance = 1e-6;

function fitsWith(target: Box, area: Box, margin: Insets): boolean {
  return (
    target.x - margin.left >= area.x - tolerance &&
    target.y - margin.top >= area.y - tolerance &&
    right(target) + margin.right <= right(area) + tolerance &&
    bottom(target) + margin.bottom <= bottom(area) + tolerance
  );
}

describe('computeRevealDelta', () => {
  it('brings the target plus the first margin that can fit into the area', () => {
    fc.assert(
      fc.property(
        boxArb(1000),
        boxArb(3000),
        fc.array(marginArb, {minLength: 1, maxLength: 3}),
        (target, area, margins) => {
          const delta = computeRevealDelta(target, area, margins);
          const moved = shift(target, delta);
          const fitting = margins.find(
            // "Fits" allows the same sub-pixel slack as the implementation.
            (m) =>
              target.width + m.left + m.right <= area.width + 1e-6 &&
              target.height + m.top + m.bottom <= area.height + 1e-6,
          );
          if (fitting) {
            expect(fitsWith(moved, area, fitting)).toBe(true);
          }
        },
      ),
      {numRuns: 5000},
    );
  });

  it('does not scroll when the target is already in place', () => {
    fc.assert(
      fc.property(boxArb(1000), boxArb(3000), marginArb, (target, area, margin) => {
        fc.pre(fitsWith(target, area, margin));
        fc.pre(
          target.width + margin.left + margin.right <= area.width &&
            target.height + margin.top + margin.bottom <= area.height,
        );
        const delta = computeRevealDelta(target, area, [margin]);
        expect(Math.abs(delta.x)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(delta.y)).toBeLessThanOrEqual(tolerance);
      }),
      {numRuns: 5000},
    );
  });

  it('scrolls as little as possible', () => {
    fc.assert(
      fc.property(boxArb(1000), boxArb(3000), marginArb, (target, area, margin) => {
        fc.pre(target.height + margin.top + margin.bottom <= area.height);
        const delta = computeRevealDelta(target, area, [margin]).y;
        const moved = shift(target, {x: 0, y: delta});
        if (delta > 0) {
          // Scrolled down: the bottom edge (plus margin) ends exactly at the bottom of the area.
          expect(Math.abs(bottom(moved) + margin.bottom - bottom(area))).toBeLessThan(1e-6 * (1 + Math.abs(target.y)));
        } else if (delta < 0) {
          expect(Math.abs(moved.y - margin.top - area.y)).toBeLessThan(1e-6 * (1 + Math.abs(target.y)));
        }
      }),
      {numRuns: 5000},
    );
  });

  it('aligns targets larger than the area to its start and centres targets that only fit without margin', () => {
    const area: Box = {x: 0, y: 0, width: 400, height: 600};
    // Larger than the area: its start lands just inside the area, keeping the margin, scrolling down or up.
    expect(computeRevealDelta({x: 0, y: 1000, width: 100, height: 2000}, area, [uniform(20)]).y).toBe(1000 - 20);
    expect(computeRevealDelta({x: 0, y: -3000, width: 100, height: 2000}, area, [uniform(20)]).y).toBe(-3000 - 20);
    expect(computeRevealDelta({x: 0, y: 1000, width: 100, height: 590}, area, [uniform(20)]).y).toBe(1000 + 295 - 300);
  });

  it('falls back to the smaller margin when the generous one does not fit', () => {
    const area: Box = {x: 0, y: 0, width: 400, height: 600};
    const target: Box = {x: 0, y: 1000, width: 100, height: 300};
    const generous = {...uniform(20), bottom: 400};
    expect(computeRevealDelta(target, area, [generous, uniform(20)]).y).toBe(1000 + 300 + 20 - 600);
  });
});

describe('computeRevealDelta with obstacles (sticky headers, floating buttons, banners)', () => {
  const area: Box = {x: 0, y: 0, width: 1280, height: 800};
  const header: Box = {x: 0, y: 0, width: 1280, height: 64};
  const footer: Box = {x: 0, y: 740, width: 1280, height: 60};
  const margin = [uniform(20)];

  it('scrolling up: the target ends below a sticky header', () => {
    const target: Box = {x: 100, y: -300, width: 400, height: 200};
    const moved = shift(target, computeRevealDelta(target, area, margin, [header]));
    expect(moved.y).toBe(64 + 20);
  });

  it('scrolling down: the target ends above a sticky footer', () => {
    const target: Box = {x: 100, y: 1200, width: 400, height: 200};
    const moved = shift(target, computeRevealDelta(target, area, margin, [header, footer]));
    expect(bottom(moved)).toBe(740 - 20);
  });

  it('ignores obstacles outside the target’s column, like a floating button in the corner', () => {
    const button: Box = {x: 1200, y: 700, width: 60, height: 60};
    const target: Box = {x: 100, y: 1200, width: 400, height: 200};
    const moved = shift(target, computeRevealDelta(target, area, margin, [button]));
    expect(bottom(moved)).toBe(800 - 20);
  });

  it('moves the target into the nearest free gap between several obstacles', () => {
    const banner: Box = {x: 0, y: 380, width: 1280, height: 40};
    // Coming from below: the gap between the banner and the footer is the nearest one that fits.
    const fromBelow: Box = {x: 100, y: 1200, width: 400, height: 200};
    const movedUp = shift(fromBelow, computeRevealDelta(fromBelow, area, margin, [header, banner, footer]));
    expect(movedUp.y).toBeGreaterThanOrEqual(420 + 20);
    expect(bottom(movedUp)).toBe(740 - 20);
    // Coming from above: the gap between the header and the banner.
    const fromAbove: Box = {x: 100, y: -1200, width: 400, height: 200};
    const movedDown = shift(fromAbove, computeRevealDelta(fromAbove, area, margin, [header, banner, footer]));
    expect(movedDown.y).toBe(64 + 20);
    expect(bottom(movedDown)).toBeLessThanOrEqual(380 - 20);
  });

  it('aligns a target too large for any gap to the start of the largest one, in both directions', () => {
    for (const y of [-3000, 3000]) {
      const target: Box = {x: 100, y, width: 400, height: 1500};
      const moved = shift(target, computeRevealDelta(target, area, margin, [header, footer]));
      expect(moved.y).toBe(64 + 20);
    }
  });

  it('does its best when an obstacle cannot be avoided', () => {
    const wall: Box = {x: 0, y: 0, width: 1280, height: 800};
    const target: Box = {x: 100, y: 1200, width: 400, height: 200};
    const moved = shift(target, computeRevealDelta(target, area, margin, [wall]));
    // Nothing is free: placed as if there were no obstacle (it will be reported as covered).
    expect(bottom(moved)).toBe(800 - 20);
  });

  it('keeps the target and its margin clear of every obstacle in its column whenever a gap can hold it', () => {
    const obstacleArb = fc.record({
      x: fc.double({min: -200, max: 1400, noNaN: true}),
      y: fc.double({min: -200, max: 1000, noNaN: true}),
      width: fc.double({min: 1, max: 1400, noNaN: true}),
      height: fc.double({min: 1, max: 300, noNaN: true}),
    });
    fc.assert(
      fc.property(
        fc.record({
          x: fc.double({min: 0, max: 1000, noNaN: true}),
          y: fc.double({min: -5000, max: 5000, noNaN: true}),
          width: fc.double({min: 1, max: 280, noNaN: true}),
          height: fc.double({min: 0, max: 900, noNaN: true}),
        }),
        fc.array(obstacleArb, {maxLength: 4}),
        fc.double({min: 0, max: 60, noNaN: true}),
        (target, obstacles, space) => {
          const margins = [uniform(space)];
          const column = obstacles.filter((o) => o.x < right(target) && right(o) > target.x);
          // Independent oracle: is there a vertical gap that can hold target plus margin?
          const covered = column
            .map((o) => [Math.max(o.y, area.y), Math.min(bottom(o), bottom(area))] as const)
            .filter(([a, b]) => b > a);
          covered.sort((a, b) => a[0] - b[0]);
          let cursor = area.y;
          let largestGap = 0;
          for (const [a, b] of covered) {
            largestGap = Math.max(largestGap, a - cursor);
            cursor = Math.max(cursor, b);
          }

          largestGap = Math.max(largestGap, bottom(area) - cursor);
          fc.pre(largestGap >= target.height + 2 * space + 1e-6);
          const moved = shift(target, computeRevealDelta(target, area, margins, obstacles));
          const from = moved.y - space;
          const to = bottom(moved) + space;
          expect(from).toBeGreaterThanOrEqual(area.y - 1e-6);
          expect(to).toBeLessThanOrEqual(bottom(area) + 1e-6);
          for (const o of column) {
            const overlap = Math.min(to, bottom(o)) - Math.max(from, o.y);
            expect(overlap).toBeLessThanOrEqual(1e-6);
          }
        },
      ),
      {numRuns: 5000},
    );
  });
});

describe('buildRevealMargins', () => {
  const base = {gap: 12, highlightPadding: 8, viewportPadding: 12, area: {x: 0, y: 0, width: 390, height: 800}};

  it('leaves room for the tooltip on the first side where target and tooltip fit together', () => {
    const margins = buildRevealMargins({
      ...base,
      target: {x: 0, y: 0, width: 100, height: 40},
      tooltip: {width: 300, height: 200},
      sides: ['bottom', 'top', 'right', 'left'],
    });
    expect(margins).toEqual([{...uniform(20), bottom: 20 + 12 + 200}, uniform(20)]);
  });

  it('only keeps padding when nothing fits', () => {
    const margins = buildRevealMargins({
      ...base,
      target: {x: 0, y: 0, width: 380, height: 700},
      tooltip: {width: 300, height: 200},
      sides: ['bottom', 'top', 'right', 'left'],
    });
    expect(margins).toEqual([uniform(20)]);
  });
});
