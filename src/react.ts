// React Web entry point
// Import from 'react-tour-kit/react'

// Main exports
// eslint-disable-next-line import-x/extensions
export {TourProvider, type TourProviderProps} from './react-platform';
// eslint-disable-next-line import-x/extensions
export {TourContext, useTour} from './shared';

// Components (for customization)
// eslint-disable-next-line import-x/extensions
export {TourOverlay, TourTooltip} from './react-platform';

// Types
export type {TourStep, TourContextType, TourTooltipProps, TourOverlayProps, TourTheme} from './shared';

// Platform types
export type {Rect, TourTarget} from './shared';

// Utilities (for custom implementations)
// eslint-disable-next-line import-x/extensions
export {calculateTooltipPosition} from './shared';
// eslint-disable-next-line import-x/extensions
export {findVisibleElement} from './react-platform';

// Platform adapter (for advanced customization)
// eslint-disable-next-line import-x/extensions
export {webPlatformAdapter} from './react-platform';
