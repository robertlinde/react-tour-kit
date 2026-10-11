import type {TourTheme} from '../types/tour-theme.type.js';

export type ResolvedTheme = Required<TourTheme>;

export const defaultTheme: ResolvedTheme = {
  primaryColor: '#2563eb',
  primaryTextColor: '#ffffff',
  tooltipBackground: '#ffffff',
  titleColor: '#111827',
  contentColor: '#4b5563',
  overlayColor: 'rgba(0, 0, 0, 0.5)',
};

const themeKeys = [
  'primaryColor',
  'primaryTextColor',
  'tooltipBackground',
  'titleColor',
  'contentColor',
  'overlayColor',
] as const satisfies ReadonlyArray<keyof TourTheme>;

/** Fills in defaults for missing (or `undefined`) keys. */
export function resolveTheme(theme: TourTheme | undefined): ResolvedTheme {
  if (!theme) {
    return defaultTheme;
  }

  const resolved = {...defaultTheme};
  for (const key of themeKeys) {
    const value = theme[key];
    if (typeof value === 'string' && value.length > 0) {
      resolved[key] = value;
    }
  }

  return resolved;
}
