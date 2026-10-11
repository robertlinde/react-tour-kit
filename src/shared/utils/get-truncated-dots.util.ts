/** One item in the step indicator: a dot for a step, or an ellipsis standing in for several steps. */
export type DotItem =
  {readonly type: 'dot'; readonly index: number} | {readonly type: 'ellipsis'; readonly position: 'start' | 'end'};

const maxVisible = 7;
const siblings = (maxVisible - 5) / 2;

function range(from: number, to: number): DotItem[] {
  return Array.from({length: to - from + 1}, (_, offset) => ({type: 'dot', index: from + offset}));
}

/**
 * The step indicator for `totalSteps` steps with `currentStep` (zero-based) selected.
 *
 * Up to 7 steps every step gets a dot. Above that the result always has exactly 7 items, so the
 * indicator keeps a constant width: the first and last step, the current step and its neighbours,
 * and ellipses for the rest. An ellipsis always stands for at least two steps.
 */
export function getTruncatedDots(currentStep: number, totalSteps: number): DotItem[] {
  const total = Number.isFinite(totalSteps) ? Math.max(0, Math.floor(totalSteps)) : 0;
  if (total === 0) {
    return [];
  }

  if (total <= maxVisible) {
    return range(0, total - 1);
  }

  const last = total - 1;
  const current = Math.min(Math.max(Number.isFinite(currentStep) ? Math.floor(currentStep) : 0, 0), last);
  if (current <= maxVisible - 3 - siblings) {
    return [...range(0, maxVisible - 3), {type: 'ellipsis', position: 'end'}, {type: 'dot', index: last}];
  }

  if (current >= total - (maxVisible - 2) + siblings) {
    return [{type: 'dot', index: 0}, {type: 'ellipsis', position: 'start'}, ...range(total - (maxVisible - 2), last)];
  }

  return [
    {type: 'dot', index: 0},
    {type: 'ellipsis', position: 'start'},
    ...range(current - siblings, current + siblings),
    {type: 'ellipsis', position: 'end'},
    {type: 'dot', index: last},
  ];
}
