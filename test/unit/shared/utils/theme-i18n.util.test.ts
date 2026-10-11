import {describe, expect, it} from 'vitest';
import {defaultI18n, formatTemplate, resolveI18n} from '../../../../src/shared/utils/i18n.util.js';
import {defaultTheme, resolveTheme} from '../../../../src/shared/utils/theme.util.js';

describe('resolveTheme', () => {
  it('fills in defaults and ignores undefined or empty values', () => {
    expect(resolveTheme(undefined)).toBe(defaultTheme);
    expect(resolveTheme({primaryColor: 'hotpink', titleColor: undefined, contentColor: ''})).toEqual({
      ...defaultTheme,
      primaryColor: 'hotpink',
    });
  });
});

describe('resolveI18n', () => {
  it('fills in defaults and keeps intentionally empty strings', () => {
    expect(resolveI18n(undefined)).toBe(defaultI18n);
    expect(resolveI18n({nextLabel: 'Weiter', prevLabel: ''})).toEqual({
      ...defaultI18n,
      nextLabel: 'Weiter',
      prevLabel: '',
    });
  });
});

describe('formatTemplate', () => {
  it('replaces every occurrence and leaves unknown placeholders alone', () => {
    expect(formatTemplate('{current} of {total} ({current})', {current: 2, total: 5})).toBe('2 of 5 (2)');
    expect(formatTemplate('Step {step} {unknown}', {step: 3})).toBe('Step 3 {unknown}');
  });
});
