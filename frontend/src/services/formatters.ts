/**
 * Cached `Intl` formatters. Constructing one costs far more than formatting
 * with it, and a table renders thousands of cells from a handful of distinct
 * (language, precision) pairs — so build each formatter once and keep it.
 */

const numberFormatters = new Map<string, Intl.NumberFormat>();
const signedNumberFormatters = new Map<string, Intl.NumberFormat>();
const percentFormatters = new Map<string, Intl.NumberFormat>();
const monthNameFormatters = new Map<string, Intl.DateTimeFormat>();
const monthShortFormatters = new Map<string, Intl.DateTimeFormat>();
const zonedDateFormatters = new Map<string, Intl.DateTimeFormat>();
/** Converted dates, newest generation first; see `zonedDateString`. */
let zonedDateStrings = new Map<string, string>();
let previousZonedDateStrings = new Map<string, string>();

/** Conversions held per generation; two are kept, so twice this at most. */
const MAX_CACHED_DATES = 20000;

/** Number formatter with a fixed number of decimals. */
export function numberFormatter(lang: string, precision: number): Intl.NumberFormat {
  const key = `${lang}:${precision}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(lang, {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    });
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/** Formatter for full month names ("January", "Januar"). */
export function monthNameFormatter(lang: string): Intl.DateTimeFormat {
  let formatter = monthNameFormatters.get(lang);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, { month: 'long' });
    monthNameFormatters.set(lang, formatter);
  }
  return formatter;
}

/** Number formatter that prefixes non-zero values with their sign. */
export function signedNumberFormatter(lang: string, precision: number): Intl.NumberFormat {
  const key = `${lang}:${precision}`;
  let formatter = signedNumberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(lang, {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
      signDisplay: 'exceptZero',
    });
    signedNumberFormatters.set(key, formatter);
  }
  return formatter;
}

/** Signed whole-number percentage formatter ("+25%"). */
export function percentFormatter(lang: string): Intl.NumberFormat {
  let formatter = percentFormatters.get(lang);
  if (!formatter) {
    formatter = new Intl.NumberFormat(lang, {
      style: 'percent',
      maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    });
    percentFormatters.set(lang, formatter);
  }
  return formatter;
}

/** Formatter producing `YYYY-MM-DD` in a given time zone. */
export function zonedDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zonedDateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    zonedDateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Calendar date (`YYYY-MM-DD`) of a timestamp in the given time zone.
 *
 * Statistics arrive as thousands of timestamps that share a handful of day
 * boundaries, and zone-aware formatting is expensive, so both the formatter
 * and the converted strings are cached.
 *
 * The cache keeps two generations rather than emptying itself at the cap:
 * dropping everything at once means a working set just over the cap misses
 * every single time, which is worse than having no cache at all.
 */
export function zonedDateString(timestampMs: number, timeZone: string): string {
  const key = `${timeZone}:${timestampMs}`;
  const cached = zonedDateStrings.get(key);
  if (cached !== undefined) return cached;

  const older = previousZonedDateStrings.get(key);
  if (older !== undefined) {
    zonedDateStrings.set(key, older);
    return older;
  }

  const value = zonedDateFormatter(timeZone).format(new Date(timestampMs));
  if (zonedDateStrings.size >= MAX_CACHED_DATES) {
    previousZonedDateStrings = zonedDateStrings;
    zonedDateStrings = new Map();
  }
  zonedDateStrings.set(key, value);
  return value;
}

/** Formatter for abbreviated month names ("Jan", "Jän"). */
export function monthShortFormatter(lang: string): Intl.DateTimeFormat {
  let formatter = monthShortFormatters.get(lang);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, { month: 'short' });
    monthShortFormatters.set(lang, formatter);
  }
  return formatter;
}
