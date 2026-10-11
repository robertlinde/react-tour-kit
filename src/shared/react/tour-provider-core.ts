import {type ComponentType, type ReactNode, useMemo, useState, useSyncExternalStore} from 'react';
import type {TourEngine} from '../engine/tour-engine.js';
import {createTourAdapter} from '../platform/create-tour-adapter.js';
import type {PlatformAdapter} from '../platform/platform.type.js';
import {DefaultTooltip} from '../renderer/default-tooltip.js';
import type {TourRenderer} from '../renderer/renderer.type.js';
import type {TourOverlayProps} from '../renderer/tour-overlay.js';
import type {TourEndCallback} from '../types/tour-end-info.type.js';
import type {TourI18n} from '../types/tour-i18n.type.js';
import type {TourTheme} from '../types/tour-theme.type.js';
import type {TourTooltipProps} from '../types/tour-tooltip-props.type.js';
import {resolveI18n} from '../utils/i18n.util.js';
import {resolveTheme} from '../utils/theme.util.js';
import {useTourEngine} from './tour-root.js';

/** Props of `TourProvider` on every platform. Platforms may add their own (React Native: `insets`). */
export type TourProviderBaseProps = {
  readonly children?: ReactNode;
  /** Colours of the built-in tooltip and overlay. */
  readonly theme?: TourTheme;
  /** Texts of the built-in tooltip. */
  readonly i18n?: TourI18n;
  /** Called once whenever a tour ends, after the tour's own `onTourEnd`. */
  readonly onTourEnd?: TourEndCallback;
  /**
   * Whether clicking or tapping the dimmed area ends the tour (with the reason `'blur'`).
   * @defaultValue `true`
   */
  readonly closeOnOverlayClick?: boolean;
  /**
   * Replaces the content of the tooltip card. The tour still measures, positions, animates and
   * focuses it, and keeps it on screen.
   */
  readonly TooltipComponent?: ComponentType<TourTooltipProps>;
};

export type TourCore = {
  readonly engine: TourEngine;
  /** Everything the overlay needs; the platform renders `<TourOverlay {...overlay} />` where the tour is drawn. */
  readonly overlay: TourOverlayProps;
};

const neverReduced = (): boolean => false;

/**
 * What every `TourProvider` does, whatever the platform: creates the engine on top of the
 * platform's facts, resolves theme and texts, and prepares the overlay. `platform` and `renderer`
 * must keep their identity for the lifetime of the provider.
 */
export function useTourCore(props: TourProviderBaseProps, platform: PlatformAdapter, renderer: TourRenderer): TourCore {
  const [adapter] = useState(() => createTourAdapter(platform));
  const engine = useTourEngine(adapter, props.onTourEnd);
  const isReducedMotion = useSyncExternalStore(
    platform.reducedMotion.subscribe,
    platform.reducedMotion.get,
    neverReduced,
  );
  const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
  const i18n = useMemo(() => resolveI18n(props.i18n), [props.i18n]);
  const Tooltip = props.TooltipComponent ?? DefaultTooltip;
  const isOverlayDismissible = props.closeOnOverlayClick ?? true;
  const overlay = useMemo<TourOverlayProps>(
    () => ({engine, renderer, theme, i18n, Tooltip, isOverlayDismissible, isReducedMotion}),
    [engine, renderer, theme, i18n, Tooltip, isOverlayDismissible, isReducedMotion],
  );
  return {engine, overlay};
}
