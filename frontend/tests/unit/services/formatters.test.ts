import { describe, it, expect } from 'vitest';
import { numberFormatter, monthNameFormatter, monthShortFormatter, zonedDateString, signedNumberFormatter, percentFormatter } from '../../../src/services/formatters';

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

describe('zonedDateString', () => {
  /** Counts DateTimeFormat constructions while `work` runs. */
  function countDateTimeFormats(work: () => void): number {
    const Real = Intl.DateTimeFormat;
    let count = 0;
    // @ts-expect-error test double for a constructor count
    Intl.DateTimeFormat = function (...args: unknown[]) {
      count++;
      return new (Real as unknown as new (...a: unknown[]) => Intl.DateTimeFormat)(...args);
    };
    try {
      work();
    } finally {
      Intl.DateTimeFormat = Real;
    }
    return count;
  }

  it('formats a timestamp as YYYY-MM-DD in the given time zone', () => {
    // 2025-06-15T23:30Z is already the 16th in Vienna (UTC+2 in summer).
    expect(zonedDateString(Date.UTC(2025, 5, 15, 23, 30), 'Europe/Vienna')).toBe('2025-06-16');
    expect(zonedDateString(Date.UTC(2025, 5, 15, 23, 30), 'UTC')).toBe('2025-06-15');
  });

  it('builds at most one formatter per time zone, however many timestamps it converts', () => {
    const constructions = countDateTimeFormats(() => {
      for (let d = 1; d <= 28; d++) {
        zonedDateString(Date.UTC(2031, 0, d), 'Europe/Berlin');
        zonedDateString(Date.UTC(2031, 0, d), 'America/New_York');
      }
    });

    expect(constructions).toBeLessThanOrEqual(2);
  });

  /** Counts `format` calls on any DateTimeFormat built while `work` runs. */
  function countFormatCalls(work: () => void): number {
    const Real = Intl.DateTimeFormat;
    let calls = 0;
    // @ts-expect-error test double for a call count
    Intl.DateTimeFormat = function (...args: unknown[]) {
      const instance = new (Real as unknown as new (...a: unknown[]) => Intl.DateTimeFormat)(...args);
      const format = instance.format.bind(instance);
      // `format` is a prototype getter, so it cannot be patched on the instance;
      // callers only ever call it, so a stand-in carrying it is enough.
      return { format: (date?: Date | number) => { calls++; return format(date); } } as unknown as Intl.DateTimeFormat;
    };
    try {
      work();
    } finally {
      Intl.DateTimeFormat = Real;
    }
    return calls;
  }

  it('still hits for a working set larger than one cache generation', () => {
    // A cache that empties itself at the cap drops to a zero hit rate as soon
    // as the working set outgrows it — the opposite of what it is there for.
    const TZ = 'Pacific/Chatham';
    const DAY = 86_400_000;
    const base = Date.UTC(1990, 0, 1);
    const OVERFLOW = 25_000; // above the cap

    const calls = countFormatCalls(() => {
      for (let i = 0; i < OVERFLOW; i++) zonedDateString(base + i * DAY, TZ);
      // Re-read the oldest keys: they must not all have been thrown away.
      for (let i = 0; i < 1000; i++) zonedDateString(base + i * DAY, TZ);
    });

    // The cold pass is unavoidable; the 1000 re-reads must cost nothing.
    expect(calls).toBe(OVERFLOW);
  });

  it('converts a repeated timestamp without formatting it again', () => {
    const stamp = Date.UTC(2032, 2, 3, 10);
    const first = zonedDateString(stamp, 'Europe/Vienna');

    const constructions = countDateTimeFormats(() => {
      for (let i = 0; i < 100; i++) zonedDateString(stamp, 'Europe/Vienna');
    });

    expect(zonedDateString(stamp, 'Europe/Vienna')).toBe(first);
    expect(constructions).toBe(0);
  });
});

describe('signedNumberFormatter', () => {
  it('returns the same instance for the same language and precision', () => {
    expect(signedNumberFormatter('de', 1)).toBe(signedNumberFormatter('de', 1));
  });

  it('shows a sign for non-zero values only', () => {
    const f = signedNumberFormatter('en', 1);
    expect(f.format(2)).toBe('+2.0');
    expect(f.format(-2)).toBe('-2.0');
    expect(f.format(0)).toBe('0.0');
  });

  it('is distinct from the plain number formatter', () => {
    expect(signedNumberFormatter('en', 1)).not.toBe(numberFormatter('en', 1));
  });
});

describe('percentFormatter', () => {
  it('returns the same instance for the same language', () => {
    expect(percentFormatter('de')).toBe(percentFormatter('de'));
  });

  it('formats a signed whole-number percentage', () => {
    expect(percentFormatter('en').format(0.25)).toBe('+25%');
  });
});
