import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {bottom, deflate, inflate, intersect, right, sanitizeBox} from '../../../../src/shared/geometry/box.util.js';
import {
  computeTooltipLayout,
  fitTolerance,
  getSafeArea,
  type TooltipLayout,
  type TooltipLayoutInput,
} from '../../../../src/shared/geometry/compute-tooltip-layout.util.js';
import type {Box, Side, Viewport} from '../../../../src/shared/geometry/geometry.type.js';

const epsilon = 1e-6;
const numRuns = 5000;
const sides: Side[] = ['top', 'right', 'bottom', 'left'];

const defaults = {gap: 12, highlightPadding: 8, viewportPadding: 12, arrowPadding: 12} as const;

function layout(overrides: Partial<TooltipLayoutInput> & Pick<TooltipLayoutInput, 'target'>): TooltipLayout {
  return computeTooltipLayout({
    tooltip: {width: 300, height: 150},
    viewport: {rect: {x: 0, y: 0, width: 1280, height: 800}, insets: {top: 0, right: 0, bottom: 0, left: 0}},
    placement: 'bottom',
    ...defaults,
    ...overrides,
  });
}

function boxOf(result: TooltipLayout): Box {
  return {x: result.x, y: result.y, width: result.width, height: result.height};
}

function inside(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    right(inner) <= right(outer) + epsilon &&
    bottom(inner) <= bottom(outer) + epsilon
  );
}

/** Independent re-statement of "this side has room", used to check the preference and overlap properties. */
function oracleFits(input: TooltipLayoutInput, side: Side): boolean {
  const safe = getSafeArea(input.viewport, input.viewportPadding);
  if (!input.target) {
    return false;
  }

  const anchor = inflate(sanitizeBox(input.target), input.highlightPadding);
  const visible = intersect(anchor, safe);
  const clampTo = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
  const effective: Box = visible ?? {
    x: clampTo(anchor.x, safe.x, right(safe)),
    y: clampTo(anchor.y, safe.y, bottom(safe)),
    width: clampTo(right(anchor), safe.x, right(safe)) - clampTo(anchor.x, safe.x, right(safe)),
    height: clampTo(bottom(anchor), safe.y, bottom(safe)) - clampTo(anchor.y, safe.y, bottom(safe)),
  };
  const width = Math.min(input.tooltip.width, safe.width);
  const height = Math.min(input.tooltip.height, safe.height);
  switch (side) {
    case 'top': {
      return effective.y - safe.y - input.gap >= height - fitTolerance;
    }

    case 'bottom': {
      return bottom(safe) - bottom(effective) - input.gap >= height - fitTolerance;
    }

    case 'left': {
      return effective.x - safe.x - input.gap >= width - fitTolerance;
    }

    case 'right': {
      return right(safe) - right(effective) - input.gap >= width - fitTolerance;
    }
  }
}

const opposite: Record<Side, Side> = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

const small = fc.oneof(fc.integer({min: 0, max: 60}), fc.double({min: 0, max: 4000, noNaN: true}));
const coordinate = fc.double({min: -8000, max: 8000, noNaN: true});

const viewportArb: fc.Arbitrary<Viewport> = fc.record({
  rect: fc.record({
    x: fc.double({min: -2000, max: 2000, noNaN: true}),
    y: fc.double({min: -2000, max: 2000, noNaN: true}),
    width: small,
    height: small,
  }),
  insets: fc.record({
    top: fc.double({min: 0, max: 600, noNaN: true}),
    right: fc.double({min: 0, max: 600, noNaN: true}),
    bottom: fc.double({min: 0, max: 600, noNaN: true}),
    left: fc.double({min: 0, max: 600, noNaN: true}),
  }),
});

const targetArb: fc.Arbitrary<Box | undefined> = fc.option(
  fc.record({
    x: coordinate,
    y: coordinate,
    width: fc.oneof(fc.constant(0), fc.double({min: 0, max: 8000, noNaN: true})),
    height: fc.oneof(fc.constant(0), fc.double({min: 0, max: 8000, noNaN: true})),
  }),
  {nil: undefined, freq: 8},
);

const inputArb: fc.Arbitrary<TooltipLayoutInput> = fc.record({
  target: targetArb,
  tooltip: fc.record({
    width: fc.double({min: 0, max: 6000, noNaN: true}),
    height: fc.double({min: 0, max: 6000, noNaN: true}),
  }),
  viewport: viewportArb,
  placement: fc.constantFrom(...sides),
  gap: fc.double({min: 0, max: 64, noNaN: true}),
  highlightPadding: fc.double({min: 0, max: 64, noNaN: true}),
  viewportPadding: fc.double({min: 0, max: 64, noNaN: true}),
  arrowPadding: fc.double({min: 0, max: 64, noNaN: true}),
});

const anyNumber = fc.oneof(
  fc.double(),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, Number.MAX_VALUE),
);

const garbageInputArb: fc.Arbitrary<TooltipLayoutInput> = fc.record({
  target: fc.option(fc.record({x: anyNumber, y: anyNumber, width: anyNumber, height: anyNumber}), {nil: undefined}),
  tooltip: fc.record({width: anyNumber, height: anyNumber}),
  viewport: fc.record({
    rect: fc.record({x: anyNumber, y: anyNumber, width: anyNumber, height: anyNumber}),
    insets: fc.record({top: anyNumber, right: anyNumber, bottom: anyNumber, left: anyNumber}),
  }),
  placement: fc.constantFrom(...sides),
  previousPlacement: fc.option(fc.constantFrom<Side | 'center'>(...sides, 'center'), {nil: undefined}),
  gap: anyNumber,
  highlightPadding: anyNumber,
  viewportPadding: anyNumber,
  arrowPadding: anyNumber,
  pixelRatio: fc.option(anyNumber, {nil: undefined}),
});

// ---------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------

describe('computeTooltipLayout (properties)', () => {
  it('P1: the tooltip always lies inside the safe area and the viewport', () => {
    fc.assert(
      fc.property(inputArb, fc.option(fc.constantFrom(1, 2, 3, 1.5), {nil: undefined}), (input, pixelRatio) => {
        const result = computeTooltipLayout({...input, pixelRatio});
        const safe = getSafeArea(input.viewport, input.viewportPadding);
        expect(inside(safe, boxOf(result))).toBe(true);
        expect(inside(sanitizeBox(input.viewport.rect), boxOf(result))).toBe(true);
      }),
      {numRuns},
    );
  });

  it('P2: the rendered size never exceeds the limits, and the limits are the safe area', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = computeTooltipLayout(input);
        const safe = getSafeArea(input.viewport, input.viewportPadding);
        expect(result.maxWidth).toBe(safe.width);
        expect(result.maxHeight).toBe(safe.height);
        expect(result.width).toBe(Math.min(input.tooltip.width, result.maxWidth));
        expect(result.height).toBe(Math.min(input.tooltip.height, result.maxHeight));
      }),
      {numRuns},
    );
  });

  it('P3: the size limits do not depend on the tooltip size', () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.record({
          width: fc.double({min: 0, max: 6000, noNaN: true}),
          height: fc.double({min: 0, max: 6000, noNaN: true}),
        }),
        (input, otherSize) => {
          const a = computeTooltipLayout(input);
          const b = computeTooltipLayout({...input, tooltip: otherSize});
          expect(b.maxWidth).toBe(a.maxWidth);
          expect(b.maxHeight).toBe(a.maxHeight);
        },
      ),
      {numRuns},
    );
  });

  it('P4: every output is a finite number', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = computeTooltipLayout(input);
        for (const value of [result.x, result.y, result.width, result.height, result.maxWidth, result.maxHeight]) {
          expect(Number.isFinite(value)).toBe(true);
        }

        if (result.arrowOffset !== undefined) {
          expect(Number.isFinite(result.arrowOffset)).toBe(true);
        }
      }),
      {numRuns},
    );
  });

  it('P5: the preferred side wins when it fits, then the opposite side', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        fc.pre(input.target !== undefined);
        const result = computeTooltipLayout(input);
        if (oracleFits(input, input.placement)) {
          expect(result.placement).toBe(input.placement);
        } else if (oracleFits(input, opposite[input.placement])) {
          expect(result.placement).toBe(opposite[input.placement]);
        }
      }),
      {numRuns},
    );
  });

  it('P6: when any side has room, the tooltip keeps the gap to the visible highlighted area', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        fc.pre(input.target !== undefined);
        fc.pre(sides.some((side) => oracleFits(input, side)));
        const result = computeTooltipLayout(input);
        const safe = getSafeArea(input.viewport, input.viewportPadding);
        const anchor = intersect(inflate(sanitizeBox(input.target), input.highlightPadding), safe);
        fc.pre(anchor !== undefined);
        const tooltip = boxOf(result);
        const separation = Math.max(
          anchor.x - right(tooltip),
          tooltip.x - right(anchor),
          anchor.y - bottom(tooltip),
          tooltip.y - bottom(anchor),
        );
        expect(separation).toBeGreaterThanOrEqual(input.gap - fitTolerance - epsilon);
      }),
      {numRuns},
    );
  });

  it('P7: the arrow stays away from the corners and only appears for visible targets', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = computeTooltipLayout(input);
        if (result.arrowOffset === undefined) {
          return;
        }

        expect(result.placement).not.toBe('center');
        const edge = result.placement === 'top' || result.placement === 'bottom' ? result.width : result.height;
        const inset = Math.min(input.arrowPadding, edge / 2);
        expect(result.arrowOffset).toBeGreaterThanOrEqual(inset - epsilon);
        expect(result.arrowOffset).toBeLessThanOrEqual(edge - inset + epsilon);
      }),
      {numRuns},
    );
  });

  it('P8: moving the viewport and target together moves the tooltip by the same amount', () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.integer({min: -3000, max: 3000}),
        fc.integer({min: -3000, max: 3000}),
        (input, dx, dy) => {
          const a = computeTooltipLayout(input);
          const shift = (box: Box): Box => ({...box, x: box.x + dx, y: box.y + dy});
          const b = computeTooltipLayout({
            ...input,
            target: input.target ? shift(input.target) : undefined,
            viewport: {...input.viewport, rect: shift(input.viewport.rect)},
          });
          const tolerance = 1e-6 * (1 + Math.abs(dx) + Math.abs(dy) + Math.abs(a.x) + Math.abs(a.y));
          expect(Math.abs(b.x - (a.x + dx))).toBeLessThanOrEqual(tolerance);
          expect(Math.abs(b.y - (a.y + dy))).toBeLessThanOrEqual(tolerance);
          expect(b.placement).toBe(a.placement);
        },
      ),
      {numRuns},
    );
  });

  it('P9: measuring again with the returned size reaches a fixed point', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const first = computeTooltipLayout(input);
        const second = computeTooltipLayout({...input, tooltip: {width: first.width, height: first.height}});
        expect(second).toEqual(first);
      }),
      {numRuns},
    );
  });

  it('P10: targets that are not visible get no arrow, and off-screen targets keep the tooltip on screen', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        fc.pre(input.target !== undefined);
        const result = computeTooltipLayout(input);
        const visibleScreen = deflate(sanitizeBox(input.viewport.rect), input.viewport.insets);
        if (intersect(sanitizeBox(input.target), visibleScreen) === undefined) {
          expect(result.arrowOffset).toBeUndefined();
        }

        const safe = getSafeArea(input.viewport, input.viewportPadding);
        if (intersect(inflate(sanitizeBox(input.target), input.highlightPadding), safe) === undefined) {
          expect(inside(safe, boxOf(result))).toBe(true);
        }
      }),
      {numRuns},
    );
  });

  it('P11: garbage input never throws and still yields a finite box inside the viewport', () => {
    fc.assert(
      fc.property(garbageInputArb, (input) => {
        const result = computeTooltipLayout(input);
        for (const value of [result.x, result.y, result.width, result.height, result.maxWidth, result.maxHeight]) {
          expect(Number.isFinite(value)).toBe(true);
        }

        const safe = getSafeArea(input.viewport, input.viewportPadding);
        const tolerance = 1e-6 * (1 + Math.abs(safe.x) + Math.abs(safe.y) + safe.width + safe.height);
        expect(result.x).toBeGreaterThanOrEqual(safe.x - tolerance);
        expect(result.y).toBeGreaterThanOrEqual(safe.y - tolerance);
        expect(result.x + result.width).toBeLessThanOrEqual(right(safe) + tolerance);
        expect(result.y + result.height).toBeLessThanOrEqual(bottom(safe) + tolerance);
      }),
      {numRuns},
    );
  });

  it('P12: a previous side is kept while it still fits, so the tooltip does not flip-flop', () => {
    fc.assert(
      fc.property(inputArb, fc.constantFrom(...sides), (input, previous) => {
        fc.pre(input.target !== undefined);
        fc.pre(oracleFits(input, previous));
        expect(computeTooltipLayout({...input, previousPlacement: previous}).placement).toBe(previous);
      }),
      {numRuns},
    );
  });
});

describe('computeTooltipLayout (exhaustive grid)', () => {
  it('keeps every combination of viewport, insets, target, tooltip and placement on screen', () => {
    let cases = 0;
    for (const size of [0, 1, 40, 320, 1024]) {
      for (const offset of [0, 137]) {
        for (const inset of [0, 20, 700]) {
          const viewport: Viewport = {
            rect: {x: offset, y: offset, width: size, height: size},
            insets: {top: inset, right: inset, bottom: inset, left: inset},
          };
          const safe = getSafeArea(viewport, defaults.viewportPadding);
          for (let tx = -1.5; tx <= 1.5; tx += 0.5) {
            for (let ty = -1.5; ty <= 1.5; ty += 0.5) {
              for (const targetScale of [0, 10, size / 2, size, size * 2]) {
                for (const tooltipScale of [0, 10, size / 2, size, size * 2]) {
                  for (const placement of sides) {
                    const result = computeTooltipLayout({
                      ...defaults,
                      viewport,
                      placement,
                      target: {x: offset + tx * size, y: offset + ty * size, width: targetScale, height: targetScale},
                      tooltip: {width: tooltipScale, height: tooltipScale / 2},
                    });
                    cases++;
                    if (!inside(safe, boxOf(result))) {
                      throw new Error(
                        `Out of sight: ${JSON.stringify({size, offset, inset, tx, ty, targetScale, tooltipScale, placement, result})}`,
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(cases).toBeGreaterThan(100_000);
  });
});

describe('computeTooltipLayout (examples)', () => {
  const target: Box = {x: 600, y: 300, width: 80, height: 40};

  it('places the tooltip below the target, centred, with the arrow pointing at the target', () => {
    const result = layout({target});
    expect(result.placement).toBe('bottom');
    expect(result.y).toBe(300 + 40 + 8 + 12);
    expect(result.x).toBe(640 - 150);
    expect(result.arrowOffset).toBe(150);
  });

  it('flips to the top when there is no room below', () => {
    const result = layout({target: {...target, y: 700}});
    expect(result.placement).toBe('top');
    expect(result.y + result.height).toBe(700 - 8 - 12);
  });

  it('flips left and right', () => {
    expect(layout({target: {...target, x: 1150}, placement: 'right'}).placement).toBe('left');
    expect(layout({target: {...target, x: 20}, placement: 'left'}).placement).toBe('right');
  });

  it('falls back to a perpendicular side when neither the preferred nor the opposite side fits', () => {
    const tall = {x: 100, y: 0, width: 200, height: 800};
    expect(layout({target: tall, placement: 'bottom'}).placement).toBe('right');
  });

  it('shifts along the edge near the screen border and keeps the arrow on the target', () => {
    const result = layout({target: {x: 10, y: 300, width: 40, height: 40}});
    expect(result.x).toBe(12);
    // Points at the target centre (x = 30), not at the centre of the clipped highlight.
    expect(result.arrowOffset).toBe(30 - 12);
  });

  it('pins an oversized tooltip inside the safe area', () => {
    const result = layout({target, tooltip: {width: 5000, height: 5000}});
    expect(boxOf(result)).toEqual({x: 12, y: 12, width: 1256, height: 776});
    expect(result.arrowOffset).toBeUndefined();
  });

  it('centres steps without a target', () => {
    const result = layout({target: undefined});
    expect(result).toMatchObject({placement: 'center', x: 490, y: 325, arrowOffset: undefined});
  });

  it('respects insets such as a notch or an on-screen keyboard', () => {
    const viewport: Viewport = {
      rect: {x: 0, y: 0, width: 390, height: 844},
      insets: {top: 59, right: 0, bottom: 34 + 300, left: 0},
    };
    const result = layout({
      target: {x: 20, y: 70, width: 100, height: 40},
      viewport,
      tooltip: {width: 300, height: 200},
    });
    expect(result.y).toBeGreaterThanOrEqual(59 + 12);
    expect(result.y + result.height).toBeLessThanOrEqual(844 - 334 - 12);
  });

  it('snaps to device pixels without leaving the safe area', () => {
    const result = layout({target: {...target, x: 600.3}, pixelRatio: 2});
    expect((result.x * 2) % 1).toBe(0);
  });
});

describe('getSafeArea', () => {
  it('drops padding before insets when the viewport is tiny, and never leaves the viewport', () => {
    expect(
      getSafeArea({rect: {x: 0, y: 0, width: 30, height: 30}, insets: {top: 10, right: 10, bottom: 10, left: 10}}, 12),
    ).toEqual({x: 10, y: 10, width: 10, height: 10});
    expect(
      getSafeArea({rect: {x: 0, y: 0, width: 30, height: 30}, insets: {top: 20, right: 20, bottom: 20, left: 20}}, 12),
    ).toEqual({x: 0, y: 0, width: 30, height: 30});
  });
});
