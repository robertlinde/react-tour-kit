/** Colours of the built-in tooltip and overlay. Every key is optional. */
export type TourTheme = {
  /**
   * Buttons, the step badge, the active dot and the highlight ring.
   * @defaultValue `'#2563eb'`
   */
  readonly primaryColor?: string;
  /**
   * Text on `primaryColor` (the Next button and the step badge).
   * @defaultValue `'#ffffff'`
   */
  readonly primaryTextColor?: string;
  /** @defaultValue `'#ffffff'` */
  readonly tooltipBackground?: string;
  /** @defaultValue `'#111827'` */
  readonly titleColor?: string;
  /**
   * Body text. Muted elements (inactive dots, dividers, the Back button) are derived from it, so a
   * dark theme only needs a dark `tooltipBackground` and light text colours.
   * @defaultValue `'#4b5563'`
   */
  readonly contentColor?: string;
  /**
   * The dimmed area around the highlighted element. Include transparency.
   * @defaultValue `'rgba(0, 0, 0, 0.5)'`
   */
  readonly overlayColor?: string;
};
