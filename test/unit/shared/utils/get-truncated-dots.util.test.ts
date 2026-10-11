import {describe, expect, it} from 'vitest';
import {type DotItem, getTruncatedDots} from '../../../../src/shared/utils/get-truncated-dots.util.js';

const render = (items: DotItem[]): string =>
  items.map((item) => (item.type === 'dot' ? String(item.index) : '…')).join(' ');

describe('getTruncatedDots', () => {
  it('shows every step up to seven steps', () => {
    expect(render(getTruncatedDots(0, 1))).toBe('0');
    expect(render(getTruncatedDots(3, 7))).toBe('0 1 2 3 4 5 6');
  });

  it('truncates longer tours around the current step', () => {
    expect(render(getTruncatedDots(0, 10))).toBe('0 1 2 3 4 … 9');
    expect(render(getTruncatedDots(3, 10))).toBe('0 1 2 3 4 … 9');
    expect(render(getTruncatedDots(4, 10))).toBe('0 … 3 4 5 … 9');
    expect(render(getTruncatedDots(5, 10))).toBe('0 … 4 5 6 … 9');
    expect(render(getTruncatedDots(6, 10))).toBe('0 … 5 6 7 8 9');
    expect(render(getTruncatedDots(9, 10))).toBe('0 … 5 6 7 8 9');
    expect(render(getTruncatedDots(10, 20))).toBe('0 … 9 10 11 … 19');
  });

  it('handles empty and out-of-range input', () => {
    expect(getTruncatedDots(0, 0)).toEqual([]);
    expect(getTruncatedDots(0, -3)).toEqual([]);
    expect(getTruncatedDots(0, Number.NaN)).toEqual([]);
    expect(render(getTruncatedDots(99, 10))).toBe('0 … 5 6 7 8 9');
    expect(render(getTruncatedDots(-5, 10))).toBe('0 1 2 3 4 … 9');
  });

  it('keeps its invariants for every tour length and position', () => {
    for (let total = 1; total <= 40; total++) {
      for (let current = 0; current < total; current++) {
        const items = getTruncatedDots(current, total);
        const indices = items.flatMap((item) => (item.type === 'dot' ? [item.index] : []));
        // Constant width once truncation kicks in.
        expect(items).toHaveLength(Math.min(total, 7));
        // First, last and current step are always reachable.
        expect(indices).toContain(0);
        expect(indices).toContain(total - 1);
        expect(indices).toContain(current);
        // Strictly increasing dots; every ellipsis hides at least two steps.
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          if (item.type === 'ellipsis') {
            const before = items[i - 1];
            const after = items[i + 1];
            expect(before?.type).toBe('dot');
            expect(after?.type).toBe('dot');
            if (before?.type === 'dot' && after?.type === 'dot') {
              expect(after.index - before.index - 1).toBeGreaterThanOrEqual(2);
            }
          }
        }

        expect([...indices].sort((a, b) => a - b)).toEqual(indices);
        expect(new Set(indices).size).toBe(indices.length);
      }
    }
  });
});
