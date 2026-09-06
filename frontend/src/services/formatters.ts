/**
 * Cached `Intl` formatters. Constructing one costs far more than formatting
 * with it, and a table renders thousands of cells from a handful of distinct
 * (language, precision) pairs — so build each formatter once and keep it.
 */

const numberFormatters = new Map<string, Intl.NumberFormat>();
const monthNameFormatters = new Map<string, Intl.DateTimeFormat>();
const monthShortFormatters = new Map<string, Intl.DateTimeFormat>();

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

/** Formatter for abbreviated month names ("Jan", "Jän"). */
export function monthShortFormatter(lang: string): Intl.DateTimeFormat {
  let formatter = monthShortFormatters.get(lang);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, { month: 'short' });
    monthShortFormatters.set(lang, formatter);
  }
  return formatter;
}
