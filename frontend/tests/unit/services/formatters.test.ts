import { describe, it, expect } from 'vitest';
import { numberFormatter, monthNameFormatter, monthShortFormatter } from '../../../src/services/formatters';

describe('numberFormatter', () => {
  it('returns the same instance for the same language and precision', () => {
    expect(numberFormatter('de', 2)).toBe(numberFormatter('de', 2));
  });

  it('returns different instances for different precisions', () => {
    expect(numberFormatter('de', 1)).not.toBe(numberFormatter('de', 2));
  });

  it('returns different instances for different languages', () => {
    expect(numberFormatter('de', 1)).not.toBe(numberFormatter('en', 1));
  });

  it('formats with the requested fixed precision', () => {
    expect(numberFormatter('en', 2).format(1.5)).toBe('1.50');
  });
});

describe('monthNameFormatter', () => {
  it('returns the same instance for the same language', () => {
    expect(monthNameFormatter('de')).toBe(monthNameFormatter('de'));
  });

  it('returns different instances for different languages', () => {
    expect(monthNameFormatter('de')).not.toBe(monthNameFormatter('en'));
  });

  it('formats a full month name', () => {
    expect(monthNameFormatter('en').format(new Date(2020, 0, 1))).toBe('January');
  });
});

describe('monthShortFormatter', () => {
  it('returns the same instance for the same language', () => {
    expect(monthShortFormatter('de')).toBe(monthShortFormatter('de'));
  });

  it('formats an abbreviated month name', () => {
    expect(monthShortFormatter('en').format(new Date(2020, 0, 1))).toBe('Jan');
  });
});
