// Types

export type {
  Rect,
  TourTarget,
  Placement,
  PlatformAdapter,
  KeyboardHandlers,
  TourTheme,
  TourStep,
  TourContextType,
  TourOverlayProps,
  TourTooltipProps,
  TourI18n,
  TourEndReason,
  TourEndInfo,
  TourEndCallback,
  StartTourOptions,
} from './types';

export {defaultTheme, resolveTheme} from './types';

// Context

export {TourContext, defaultTourContext} from './context';

// Hooks

export {useTour} from './hooks';

// Utils

export {calculateTooltipPosition} from './utils';

export {getTruncatedDots, MAX_VISIBLE_DOTS, DOT_SIZE, DOT_GAP, DOTS_CONTAINER_WIDTH} from './utils';

export type {DotItem} from './utils';
