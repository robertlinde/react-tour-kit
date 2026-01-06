// React Native entry point
// Import from '@robertlinde/react-tour-kit/react-native'

// Main exports

export {TourProvider, type TourProviderProps} from './react-native-platform';

export {TourContext, useTour} from './shared';

export {useTourTarget} from './react-native-platform';

// Components (for customization)

export {TourOverlay, TourTooltip} from './react-native-platform';

// Types
export type {TourStep, TourContextType, TourTooltipProps, TourOverlayProps, TourTheme, TourI18n} from './shared';

// Platform types
export type {Rect, TourTarget} from './shared';

// Utilities (for custom implementations)

export {calculateTooltipPosition} from './shared';

// Platform adapter (for advanced customization)

export {nativePlatformAdapter, targetRegistry} from './react-native-platform';
