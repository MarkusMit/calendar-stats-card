import type { MonthAnchor, RangePreset, DateRange } from '../types/statistics';

/** Absolute month index (year * 12 + monthIndex) for comparison / arithmetic. */
function toIndex(anchor: MonthAnchor): number {
  return anchor.year * 12 + (anchor.month - 1);
}

function fromIndex(index: number): MonthAnchor {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Add `n` months to an anchor (n may be negative), rolling across year boundaries. */
export function addMonths(anchor: MonthAnchor, n: number): MonthAnchor {
  return fromIndex(toIndex(anchor) + n);
}

/** Negative if `l` before `r`, 0 if equal, positive if after. */
export function compareAnchors(l: MonthAnchor, r: MonthAnchor): number {
  return toIndex(l) - toIndex(r);
}

/** Length of a range in months (inclusive). */
function rangeLength(range: DateRange): number {
  return toIndex(range.end) - toIndex(range.start) + 1;
}

/** Number of months in a preset's stepping unit; null for rolling/custom windows. */
function alignedUnit(preset: RangePreset): number | null {
  switch (preset) {
    case 'this_month':
      return 1;
    case 'this_quarter':
      return 3;
    case 'this_year':
      return 12;
    default:
      return null;
  }
}

/** Quarter-aligned first month (1, 4, 7, 10) for a given month. */
function quarterStartMonth(month: number): number {
  return 3 * Math.floor((month - 1) / 3) + 1;
}

/** Build a concrete range for a preset relative to `now` (the current month). */
export function presetToRange(preset: RangePreset, now: MonthAnchor): DateRange {
  switch (preset) {
    case 'this_month':
      return { start: now, end: now, preset };
    case 'this_quarter':
      return { start: { year: now.year, month: quarterStartMonth(now.month) }, end: now, preset };
    case 'this_year':
      return { start: { year: now.year, month: 1 }, end: now, preset };
    case 'last_3_months':
      return { start: addMonths(now, -2), end: now, preset };
    case 'last_12_months':
      return { start: addMonths(now, -11), end: now, preset };
    case 'last_year':
    case 'last_3_years':
    case 'last_5_years':
    case 'all':
      return yearPresetToRange(preset, now.year);
    case 'custom':
      return { start: now, end: now, preset };
  }
}

/**
 * Build a whole-calendar-year range for a year-granular preset (FR-016).
 * `earliestYear` (first year with recorded data) anchors the 'all' preset;
 * when unknown, 'all' falls back to the current year.
 */
export function yearPresetToRange(preset: RangePreset, nowYear: number, earliestYear?: number | null): DateRange {
  const fullYears = (fromYear: number, toYear: number): DateRange => ({
    start: { year: fromYear, month: 1 },
    end: { year: toYear, month: 12 },
    preset,
  });
  switch (preset) {
    case 'last_year':
      return fullYears(nowYear - 1, nowYear - 1);
    case 'last_3_years':
      return fullYears(nowYear - 2, nowYear);
    case 'last_5_years':
      return fullYears(nowYear - 4, nowYear);
    case 'all':
      return fullYears(earliestYear ?? nowYear, nowYear);
    case 'this_year':
    default:
      return fullYears(nowYear, nowYear);
  }
}

/** Expand a range to the enclosing full calendar years (FR-016 snap on view switch). */
export function snapRangeToYears(range: DateRange): DateRange {
  return {
    start: { year: range.start.year, month: 1 },
    end: { year: range.end.year, month: 12 },
    preset: range.preset,
  };
}

/** Step a whole-years range back/forward by its own span in years (yearly view). */
export function stepRangeByYears(range: DateRange, dir: -1 | 1): DateRange {
  const span = range.end.year - range.start.year + 1;
  return {
    start: { year: range.start.year + dir * span, month: 1 },
    end: { year: range.end.year + dir * span, month: 12 },
    preset: range.preset,
  };
}

/**
 * Clamp a range so its start never precedes the earliest-data floor (FR-015).
 * In year granularity the floor is January of the earliest-data year (the
 * within-year months are handled by the display clamp). If clamping pushes the
 * start past the end, the end is lifted to keep a valid range.
 */
export function clampRangeToFloor(
  range: DateRange,
  earliest: MonthAnchor | null,
  granularity: 'month' | 'year' = 'month',
): DateRange {
  if (earliest === null) return range;
  const floor: MonthAnchor = granularity === 'year' ? { year: earliest.year, month: 1 } : earliest;
  if (compareAnchors(range.start, floor) >= 0) return range;
  const start = { ...floor };
  const end = compareAnchors(range.end, start) < 0
    ? (granularity === 'year' ? { year: start.year, month: 12 } : { ...start })
    : range.end;
  return { start, end, preset: range.preset };
}

/**
 * Step a range to the previous (`dir = -1`) or next (`dir = 1`) period.
 * Calendar-aligned presets move by their aligned unit (and re-clamp the end to
 * `now` when landing on the current period); rolling/custom windows shift by
 * their own length in months.
 */
export function stepRange(range: DateRange, dir: -1 | 1, now: MonthAnchor): DateRange {
  const unit = alignedUnit(range.preset);
  if (unit === null) {
    const len = rangeLength(range);
    return {
      start: addMonths(range.start, dir * len),
      end: addMonths(range.end, dir * len),
      preset: range.preset,
    };
  }

  const start = addMonths(range.start, dir * unit);
  const fullEnd = addMonths(start, unit - 1);
  // Clamp the end to `now` when the stepped period contains the current month
  // (e.g. stepping forward into the current, still-incomplete year/quarter/month).
  const end = compareAnchors(fullEnd, now) > 0 ? now : fullEnd;
  return { start, end, preset: range.preset };
}

/** True when the range end is at or past the current month (cannot advance further). */
export function atRangeEnd(range: DateRange, now: MonthAnchor): boolean {
  return compareAnchors(range.end, now) >= 0;
}

/** True when the range start is at or before the earliest available month. */
export function atRangeStart(range: DateRange, earliest: MonthAnchor | null): boolean {
  return earliest !== null && compareAnchors(range.start, earliest) <= 0;
}

/** Years the range spans, inclusive, ascending. */
export function rangeYears(range: DateRange): number[] {
  const years: number[] = [];
  for (let y = range.start.year; y <= range.end.year; y++) years.push(y);
  return years;
}

/**
 * Months of `year` visible for the range, clamped so nothing after `now` and
 * nothing before `earliest` shows. Returns an empty array for years fully
 * outside the available window.
 *
 * `nowDay` is today's day-of-month in the HA server timezone. On the 1st the
 * current month has no completed day yet (day cells only ever show days
 * strictly before today), so it is dropped instead of rendered empty.
 */
export function visibleMonthsForYear(
  range: DateRange,
  year: number,
  now: MonthAnchor,
  earliest: MonthAnchor | null,
  nowDay: number,
): number[] {
  if (year > now.year) return [];
  if (earliest !== null && year < earliest.year) return [];

  let lo = year === range.start.year ? range.start.month : 1;
  let hi = year === range.end.year ? range.end.month : 12;

  if (year === now.year) hi = Math.min(hi, nowDay <= 1 ? now.month - 1 : now.month);
  if (earliest !== null && year === earliest.year) lo = Math.max(lo, earliest.month);

  const months: number[] = [];
  for (let m = lo; m <= hi; m++) months.push(m);
  return months;
}
