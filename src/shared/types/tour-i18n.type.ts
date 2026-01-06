/**
 * Internationalization options for tour text strings.
 * All properties are optional and have sensible defaults.
 */
export type TourI18n = {
  /**
   * Label for the "Next" button.
   * @default 'Next'
   */
  readonly nextLabel?: string;
  /**
   * Label for the "Back" button.
   * @default 'Back'
   */
  readonly prevLabel?: string;
  /**
   * Label for the "Finish" button (shown on last step).
   * @default 'Finish' (React) or 'Done' (React Native)
   */
  readonly finishLabel?: string;
  /**
   * Template string for the step counter. Use `{current}` and `{total}` as placeholders.
   * @example 'Step {current} of {total}'
   * @default '{current} / {total}' (React) or 'Step {current} of {total}' (React Native)
   */
  readonly stepCounterTemplate?: string;
  /**
   * Accessibility label for the close button.
   * @default 'Close tour'
   */
  readonly closeAriaLabel?: string;
  /**
   * Template for step dot accessibility labels. Use `{step}` as placeholder.
   * @example 'Go to step {step}'
   * @default 'Go to step {step}'
   */
  readonly dotAriaLabelTemplate?: string;
};
