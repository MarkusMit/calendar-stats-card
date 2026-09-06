/**
 * Cached `Intl` formatters. Constructing one costs far more than formatting
 * with it, and a table renders thousands of cells from a handful of distinct
 * (language, precision) pairs — so build each formatter once and keep it.
 */

const numberFormatters = new Map<string, Intl.NumberFormat>();
const monthNameFormatters = new Map<string, Intl.DateTimeFormat>();
const monthShortFormatters = new Map<string, Intl.DateTimeFormat>();
const zonedDateFormatters = new Map<string, Intl.DateTimeFormat>();
const zonedDateStrings = new Map<string, string>();

/** Above this many cached conversions the map is dropped rather than grown. */
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
 */
export function zonedDateString(timestampMs: number, timeZone: string): string {
  const key = `${timeZone}:${timestampMs}`;
  const cached = zonedDateStrings.get(key);
  if (cached !== undefined) return cached;

  const value = zonedDateFormatter(timeZone).format(new Date(timestampMs));
  if (zonedDateStrings.size >= MAX_CACHED_DATES) zonedDateStrings.clear();
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
