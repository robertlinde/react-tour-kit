import {type ComponentType, type ReactNode} from 'react';
import {type PlatformAdapter, type TourOverlayProps, type TourTheme, type TourTooltipProps} from 'src/shared';

export type TourProviderProps = {
  readonly children: ReactNode;
  /**
   * Custom tooltip component to render instead of the default.
   */
  readonly TooltipComponent?: ComponentType<TourTooltipProps>;
  /**
   * Custom overlay component to render instead of the default.
   */
  readonly OverlayComponent?: ComponentType<TourOverlayProps>;
  /**
   * Callback fired when a tour ends (whether completed or closed early).
   */
  readonly onTourEnd?: (tourId: string | undefined) => void;
  /**
   * Theme configuration for customizing tooltip and overlay appearance.
   */
  readonly theme?: TourTheme;
  /**
   * Platform adapter for measurements and events.
   * Defaults to the native platform adapter.
   */
  readonly platform?: PlatformAdapter;
};
