import {describe, expect, it} from 'vitest';
import type {TourTooltipProps} from '../../../../src/shared/types/tour-tooltip-props.type.js';
import {defaultI18n} from '../../../../src/shared/utils/i18n.util.js';
import {entranceFor, fadeDuration, motion} from '../../../../src/shared/renderer/motion.js';
import {tooltipModel} from '../../../../src/shared/renderer/tooltip-model.js';

function props(overrides: Partial<TourTooltipProps>): TourTooltipProps {
  const noop = (): void => {};
  return {
    step: {title: 'Title', content: 'Content'},
    currentStep: 0,
    totalSteps: 3,
    placement: 'bottom',
    arrowOffset: 40,
    titleId: 't',
    descriptionId: 'd',
    onNext: noop,
    onPrev: noop,
    onClose: noop,
    onGoToStep: noop,
    ...overrides,
  };
}

describe('tooltipModel', () => {
  it('describes the first step: counter, disabled Back, Next, an arrow and a dot per step', () => {
    const model = tooltipModel(props({}), defaultI18n);
    expect(model.counter).toBe('1 of 3');
    expect(model.previous).toEqual({label: 'Back', isDisabled: true});
    expect(model.next).toEqual({label: 'Next'});
    expect(model.arrow).toEqual({side: 'bottom', offset: 40});
    expect(model.dots).toEqual([
      {kind: 'dot', index: 0, label: 'Go to step 1', isCurrent: true},
      {kind: 'dot', index: 1, label: 'Go to step 2', isCurrent: false},
      {kind: 'dot', index: 2, label: 'Go to step 3', isCurrent: false},
    ]);
  });

  it('offers Finish on the last step', () => {
    const model = tooltipModel(props({currentStep: 2}), defaultI18n);
    expect(model.next.label).toBe('Finish');
    expect(model.previous.isDisabled).toBe(false);
  });

  it('has no dots for a single step and no arrow for a centred one', () => {
    const model = tooltipModel(props({totalSteps: 1, placement: 'center', arrowOffset: undefined}), defaultI18n);
    expect(model.dots).toBeUndefined();
    expect(model.arrow).toBeUndefined();
  });

  it('uses the texts it is given', () => {
    const i18n = {...defaultI18n, nextLabel: 'Weiter', stepCounterTemplate: 'Schritt {current}/{total}'};
    const model = tooltipModel(props({}), i18n);
    expect(model.counter).toBe('Schritt 1/3');
    expect(model.next.label).toBe('Weiter');
  });

  it('shortens long tours with ellipses', () => {
    const model = tooltipModel(props({currentStep: 5, totalSteps: 12}), defaultI18n);
    expect(model.dots).toHaveLength(7);
    expect(model.dots?.filter((dot) => dot.kind === 'ellipsis')).toHaveLength(2);
  });
});

describe('motion', () => {
  it('enters from the side of the target, delayed while the spotlight moves', () => {
    expect(entranceFor('top', {isDelayed: false, isReducedMotion: false})).toEqual({
      dx: 0,
      dy: motion.enterOffset,
      scale: motion.enterScale,
      durationMs: motion.enterMs,
      delayMs: 0,
    });
    expect(entranceFor('left', {isDelayed: true, isReducedMotion: false})).toMatchObject({
      dx: motion.enterOffset,
      dy: 0,
      delayMs: motion.enterDelayMs,
    });
  });

  it('only fades, briefly, with reduced motion', () => {
    expect(entranceFor('right', {isDelayed: true, isReducedMotion: true})).toEqual({
      dx: 0,
      dy: 0,
      scale: 1,
      durationMs: motion.reducedMs,
      delayMs: 0,
    });
    expect(fadeDuration(false, true)).toBe(motion.reducedMs);
    expect(fadeDuration(true, false)).toBe(motion.fadeOutMs);
    expect(fadeDuration(false, false)).toBe(motion.fadeInMs);
  });
});
