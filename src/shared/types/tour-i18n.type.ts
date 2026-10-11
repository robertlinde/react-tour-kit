/** Texts of the built-in tooltip. Every key is optional. */
export type TourI18n = {
  /** @defaultValue `'Next'` */
  readonly nextLabel?: string;
  /** @defaultValue `'Back'` */
  readonly prevLabel?: string;
  /** Label of the Next button on the last step. @defaultValue `'Finish'` */
  readonly finishLabel?: string;
  /** Step counter; `{current}` and `{total}` are replaced. @defaultValue `'{current} of {total}'` */
  readonly stepCounterTemplate?: string;
  /** Accessible name of the close button. @defaultValue `'Close tour'` */
  readonly closeAriaLabel?: string;
  /** Accessible name of each step dot; `{step}` and `{total}` are replaced. @defaultValue `'Go to step {step}'` */
  readonly dotAriaLabelTemplate?: string;
};
