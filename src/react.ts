'use client';

// Web entry point: import from '@robertlinde/react-tour-kit/react'.

export {TourProvider, type TourProviderProps} from './react-platform/tour-provider.js';
export {useTour} from './shared/react/use-tour.hook.js';
export {getTruncatedDots, type DotItem} from './shared/utils/get-truncated-dots.util.js';
export type {TourContextType} from './shared/types/tour-context.type.js';
export type {StartTourOptions, TourEndCallback, TourEndInfo, TourEndReason} from './shared/types/tour-end-info.type.js';
export type {TourI18n} from './shared/types/tour-i18n.type.js';
export type {TourPlacement, TourStep, TourStepContext, TourTarget} from './shared/types/tour-step.type.js';
export type {TourTheme} from './shared/types/tour-theme.type.js';
export type {TourTooltipProps} from './shared/types/tour-tooltip-props.type.js';
