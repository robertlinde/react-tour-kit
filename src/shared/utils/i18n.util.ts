import type {TourI18n} from '../types/tour-i18n.type.js';

export type ResolvedI18n = Required<TourI18n>;

export const defaultI18n: ResolvedI18n = {
  nextLabel: 'Next',
  prevLabel: 'Back',
  finishLabel: 'Finish',
  stepCounterTemplate: '{current} of {total}',
  closeAriaLabel: 'Close tour',
  dotAriaLabelTemplate: 'Go to step {step}',
};

const i18nKeys = [
  'nextLabel',
  'prevLabel',
  'finishLabel',
  'stepCounterTemplate',
  'closeAriaLabel',
  'dotAriaLabelTemplate',
] as const satisfies ReadonlyArray<keyof TourI18n>;

export function resolveI18n(i18n: TourI18n | undefined): ResolvedI18n {
  if (!i18n) {
    return defaultI18n;
  }

  const resolved = {...defaultI18n};
  for (const key of i18nKeys) {
    const value = i18n[key];
    if (typeof value === 'string') {
      resolved[key] = value;
    }
  }

  return resolved;
}

/** Replaces every `{name}` placeholder with its value; unknown placeholders are left as they are. */
export function formatTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
