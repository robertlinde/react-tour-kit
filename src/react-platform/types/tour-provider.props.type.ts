import {type ComponentType, type ForwardRefExoticComponent, type ReactNode, type RefAttributes} from 'react';
import {type PlatformAdapter, type TourOverlayProps, type TourTheme, type TourTooltipProps} from 'src/shared';

export type TourProviderProps = {
  readonly children: ReactNode;
  /**
   * Custom tooltip component to render instead of the default.
   * Must be a forwardRef component that accepts TourTooltipProps.
   */
  readonly TooltipComponent?: ForwardRefExoticComponent<TourTooltipProps & RefAttributes<HTMLDivElement>>;
  /**
   * Custom overlay component to render instead of the default.
   */
  readonly OverlayComponent?: ComponentType<TourOverlayProps>;
  /**
   * Callback fired when a tour ends (whether completed or closed early).
   * Useful for persisting tour completion status.
   */
  readonly onTourEnd?: (tourId: string | undefined) => void;
  /**
   * Theme configuration for customizing tooltip and overlay appearance.
   */
  readonly theme?: TourTheme;
  /**
   * Platform adapter for measurements and events.
   * Defaults to the web platform adapter.
   */
  readonly platform?: PlatformAdapter;
};
