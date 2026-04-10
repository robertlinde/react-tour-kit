export const MAX_VISIBLE_DOTS = 7;
export const DOT_SIZE = 8;
export const DOT_GAP = 6;
export const DOTS_CONTAINER_WIDTH = MAX_VISIBLE_DOTS * DOT_SIZE + (MAX_VISIBLE_DOTS - 1) * DOT_GAP;

export type DotItem = {type: 'dot'; index: number} | {type: 'ellipsis'};

export function getTruncatedDots(currentStep: number, totalSteps: number): DotItem[] {
  if (totalSteps <= MAX_VISIBLE_DOTS) {
    return Array.from({length: totalSteps}, (_, i) => ({type: 'dot' as const, index: i}));
  }

  const dots: DotItem[] = [];
  const indices = new Set<number>([0, totalSteps - 1, currentStep]);

  // Add neighbors of current step, expanding outward until we fill slots.
  // Ellipsis markers also take a slot each, so we account for gaps.
  for (let offset = 1; indices.size < MAX_VISIBLE_DOTS - countGaps(indices); offset++) {
    if (currentStep - offset >= 0) indices.add(currentStep - offset);
    if (currentStep + offset < totalSteps) indices.add(currentStep + offset);
    if (offset > totalSteps) break;
  }

  // eslint-disable-next-line unicorn/no-array-sort
  const sorted = [...indices].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      dots.push({type: 'ellipsis'});
    }

    dots.push({type: 'dot', index: sorted[i]});
  }

  return dots;
}

function countGaps(indices: Set<number>): number {
  // eslint-disable-next-line unicorn/no-array-sort
  const sorted = [...indices].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) gaps++;
  }

  return gaps;
}
