import {describe, expect, it} from 'vitest';
import {narrowClip} from '../../../../src/shared/geometry/box.util.js';

describe('narrowClip', () => {
  const page = {x: 0, y: 96, width: 390, height: 748};

  it('is the box itself when nothing clipped before', () => {
    expect(narrowClip(undefined, page)).toEqual(page);
  });

  it('is the overlap of both areas', () => {
    expect(narrowClip({x: 0, y: 700, width: 390, height: 300}, page)).toEqual({x: 0, y: 700, width: 390, height: 144});
  });

  it('keeps the direction when the areas do not overlap: an empty box on the nearest edge', () => {
    // A list below the fold.
    expect(narrowClip({x: 0, y: 946, width: 390, height: 88}, page)).toEqual({x: 0, y: 844, width: 390, height: 0});
    // A list above the top.
    expect(narrowClip({x: 0, y: -200, width: 390, height: 88}, page)).toEqual({x: 0, y: 96, width: 390, height: 0});
  });
});
