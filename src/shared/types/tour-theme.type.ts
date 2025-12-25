/**
 * Theme configuration for customizing tour tooltip and overlay appearance.
 */
export type TourTheme = {
  /**
   * Primary color used for buttons, step badge, and highlight border.
   * @default '#3b82f6'
   */
  readonly primaryColor?: string;

  /**
   * Tooltip background color.
   * @default '#ffffff'
   */
  readonly tooltipBackground?: string;

  /**
   * Title text color.
   * @default '#1f2937'
   */
  readonly titleColor?: string;

  /**
   * Content/body text color.
   * @default '#4b5563'
   */
  readonly contentColor?: string;

  /**
   * Overlay background color (should include alpha for transparency).
   * @default 'rgba(0, 0, 0, 0.5)'
   */
  readonly overlayColor?: string;
};

/**
 * Default theme values.
 */
export const defaultTheme: Required<TourTheme> = {
  primaryColor: '#3b82f6',
  tooltipBackground: '#ffffff',
  titleColor: '#1f2937',
  contentColor: '#4b5563',
  overlayColor: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Merge user theme with defaults.
 */
export function resolveTheme(theme?: TourTheme): Required<TourTheme> {
  if (!theme) {
    return defaultTheme;
  }

  return {
    ...defaultTheme,
    ...theme,
  };
}
