// React Native entry point: import from '@robertlinde/react-tour-kit/react-native'.

export {TourProvider, type TourProviderProps} from './react-native-platform/tour-provider.js';
export {TourHost} from './react-native-platform/layer/tour-host.js';
export {useTourTarget} from './react-native-platform/hooks/use-tour-target.hook.js';
export {useTourScrollView} from './react-native-platform/hooks/use-tour-scroll-view.hook.js';
export {useTour} from './shared/react/use-tour.hook.js';
export {getTruncatedDots, type DotItem} from './shared/utils/get-truncated-dots.util.js';
export type {TourInsets} from './react-native-platform/insets.util.js';
export type {TourContextType} from './shared/types/tour-context.type.js';
export type {StartTourOptions, TourEndCallback, TourEndInfo, TourEndReason} from './shared/types/tour-end-info.type.js';
export type {TourI18n} from './shared/types/tour-i18n.type.js';
export type {TourPlacement, TourStep, TourStepContext, TourTarget} from './shared/types/tour-step.type.js';
export type {TourTheme} from './shared/types/tour-theme.type.js';
export type {TourTooltipProps} from './shared/types/tour-tooltip-props.type.js';
