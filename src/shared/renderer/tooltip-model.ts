import type {Side} from '../geometry/geometry.type.js';
import type {TourTooltipProps} from '../types/tour-tooltip-props.type.js';
import {getTruncatedDots} from '../utils/get-truncated-dots.util.js';
import {formatTemplate, type ResolvedI18n} from '../utils/i18n.util.js';

export type TooltipDot =
  | {readonly kind: 'dot'; readonly index: number; readonly label: string; readonly isCurrent: boolean}
  | {readonly kind: 'ellipsis'; readonly key: string};

/** Everything the built-in tooltip shows, worked out once for every platform. */
export type TooltipModel = {
  readonly counter: string;
  readonly closeLabel: string;
  readonly arrow: {readonly side: Side; readonly offset: number} | undefined;
  readonly previous: {readonly label: string; readonly isDisabled: boolean};
  readonly next: {readonly label: string};
  /** `undefined` for a single step. */
  readonly dots: readonly TooltipDot[] | undefined;
};

export function tooltipModel(props: TourTooltipProps, i18n: ResolvedI18n): TooltipModel {
  const {currentStep, totalSteps, placement, arrowOffset} = props;
  const isLast = currentStep >= totalSteps - 1;
  return {
    counter: formatTemplate(i18n.stepCounterTemplate, {current: currentStep + 1, total: totalSteps}),
    closeLabel: i18n.closeAriaLabel,
    arrow: arrowOffset === undefined || placement === 'center' ? undefined : {side: placement, offset: arrowOffset},
    previous: {label: i18n.prevLabel, isDisabled: currentStep === 0},
    next: {label: isLast ? i18n.finishLabel : i18n.nextLabel},
    dots:
      totalSteps > 1
        ? getTruncatedDots(currentStep, totalSteps).map((item): TooltipDot =>
            item.type === 'ellipsis'
              ? {kind: 'ellipsis', key: `ellipsis-${item.position}`}
              : {
                  kind: 'dot',
                  index: item.index,
                  label: formatTemplate(i18n.dotAriaLabelTemplate, {step: item.index + 1, total: totalSteps}),
                  isCurrent: item.index === currentStep,
                },
          )
        : undefined,
  };
}
