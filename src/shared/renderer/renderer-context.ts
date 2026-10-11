import {createContext, useContext} from 'react';
import type {ResolvedI18n} from '../utils/i18n.util.js';
import type {ResolvedTheme} from '../utils/theme.util.js';
import type {TourRenderer} from './renderer.type.js';

export type RendererContextValue = {
  readonly renderer: TourRenderer;
  readonly theme: ResolvedTheme;
  readonly i18n: ResolvedI18n;
};

/** The platform's primitives, the theme and the texts, for everything drawn inside the tour. Internal. */
export const RendererContext = createContext<RendererContextValue | undefined>(undefined);
RendererContext.displayName = 'TourRendererContext';

export function useRendererContext(): RendererContextValue {
  const value = useContext(RendererContext);
  if (!value) {
    throw new Error('[react-tour-kit] The built-in tooltip can only be rendered by the tour.');
  }

  return value;
}

export type TooltipLimits = {
  readonly maxWidth: number;
  readonly maxHeight: number;
};

/** Size limits of the tooltip being rendered; platforms that cannot express them in styles size the card with them. */
const defaultLimits: TooltipLimits = {maxWidth: 380, maxHeight: 600};
export const TooltipLimitsContext = createContext(defaultLimits);
TooltipLimitsContext.displayName = 'TourTooltipLimitsContext';
