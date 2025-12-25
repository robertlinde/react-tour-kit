// React Native entry point
// Import from 'react-tour-kit/react-native'

// Main exports
// eslint-disable-next-line import-x/extensions
export {TourProvider, type TourProviderProps} from './react-native-platform';
// eslint-disable-next-line import-x/extensions
export {TourContext, useTour} from './shared';
// eslint-disable-next-line import-x/extensions
export {useTourTarget} from './react-native-platform';

// Components (for customization)
// eslint-disable-next-line import-x/extensions
export {TourOverlay, TourTooltip} from './react-native-platform';

// Types
export type {TourStep, TourContextType, TourTooltipProps, TourOverlayProps, TourTheme} from './shared';

// Platform types
export type {Rect, TourTarget} from './shared';

// Utilities (for custom implementations)
// eslint-disable-next-line import-x/extensions
export {calculateTooltipPosition} from './shared';

// Platform adapter (for advanced customization)
// eslint-disable-next-line import-x/extensions
export {nativePlatformAdapter, targetRegistry} from './react-native-platform';
