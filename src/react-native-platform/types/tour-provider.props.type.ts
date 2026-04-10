import {type ComponentType, type ReactNode} from 'react';
import {
  type PlatformAdapter,
  type TourEndCallback,
  type TourI18n,
  type TourOverlayProps,
  type TourTheme,
  type TourTooltipProps,
} from '../../shared';

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
   * The second argument provides the reason the tour ended (`completed`, `closed`, `blur`,
   * or `target-missing`) along with the step the user was on.
   *
   * If the tour was started with a per-tour `onTourEnd` option, that callback fires first,
   * then this provider-level callback.
   */
  readonly onTourEnd?: TourEndCallback;
  /**
   * Theme configuration for customizing tooltip and overlay appearance.
   */
  readonly theme?: TourTheme;
  /**
   * Platform adapter for measurements and events.
   * Defaults to the native platform adapter.
   */
  readonly platform?: PlatformAdapter;
  /**
   * Internationalization options for customizing text strings.
   */
  readonly i18n?: TourI18n;
  /**
   * Whether clicking the overlay (outside the highlighted element) closes the tour.
   * When `false`, users must use the close (✕) button in the tooltip.
   * @default true
   */
  readonly closeOnOverlayClick?: boolean;
};
