// React Web entry point
// Import from 'react-tour-kit/react'

// Main exports

export {TourProvider, type TourProviderProps} from './react-platform';

export {TourContext, useTour} from './shared';

// Components (for customization)

export {TourOverlay, TourTooltip} from './react-platform';

// Types
export type {TourStep, TourContextType, TourTooltipProps, TourOverlayProps, TourTheme} from './shared';

// Platform types
export type {Rect, TourTarget} from './shared';

// Utilities (for custom implementations)

export {calculateTooltipPosition} from './shared';

export {findVisibleElement} from './react-platform';

// Platform adapter (for advanced customization)

export {webPlatformAdapter} from './react-platform';
