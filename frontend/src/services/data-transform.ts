import type {
  DailyValue,
  MeasurementDailyValue,
  CumulativeDailyValue,
  EmptyDailyValue,
  EntityMetadata,
  MonthlySummary,
  YearlyRollup,
  ComparisonComponent,
  ComparisonSeries,
} from '../types/statistics';
import type { EntityConfig } from '../types/card-config';
import type { RawStats } from './statistics-service';
import { zonedDateString } from './formatters';

function dateStringInTz(timestampMs: number, timeZone: string): string {
  return zonedDateString(timestampMs, timeZone);
}

function todayStringInTz(timeZone: string, nowMs: number): string {
  return dateStringInTz(nowMs, timeZone);
}

function yearMonthInTz(timestampMs: number, timeZone: string): { year: number; month: number } {
  const [y, m] = zonedDateString(timestampMs, timeZone).split('-').map(Number);
  return { year: y!, month: m! };
}

/**
 * Transform raw HA daily-period statistics into a map of DailyValue entries.
 * Key format: `${entityId}::${date}` (date in HA server timezone, YYYY-MM-DD)
 */
export function transformDailyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  timeZone: string,
  nowMs: number,
): Map<string, DailyValue> {
  const result = new Map<string, DailyValue>();
  const todayStr = todayStringInTz(timeZone, nowMs);

  for (const [entityId, entries] of Object.entries(rawStats)) {
    const meta = metadataMap[entityId];
    if (!meta) continue;

    const isMeasurement = meta.stateClass === 'measurement';
    const isTotalIncreasing = meta.stateClass === 'total_increasing';

    const sorted = [...entries].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i]!;
      const dateStr = dateStringInTz(entry.start, timeZone);
      const key = `${entityId}::${dateStr}`;

      // Today and future → empty
      if (dateStr >= todayStr) {
        const empty: EmptyDailyValue = { kind: 'empty', entityId, date: dateStr };
        result.set(key, empty);
        continue;
      }

      if (isMeasurement) {
        const dayVal: MeasurementDailyValue = {
          kind: 'measurement',
          entityId,
          date: dateStr,
          min: entry.min ?? 0,
          mean: entry.mean ?? 0,
          max: entry.max ?? 0,
        };
        result.set(key, dayVal);
      } else {
        // Cumulative. HA's `change` is the delta against the previous row even when
        // that row lies before the fetch window (sparse imported statistics); the
        // in-window sum difference is only a fallback for responses without `change`.
        const prevEntry = sorted[i - 1];
        const prevSum = prevEntry != null ? (prevEntry.sum ?? 0) : null;
        const currentSum = entry.sum ?? 0;
        let delta = entry.change ?? (prevSum === null ? currentSum : currentSum - prevSum);

        if (isTotalIncreasing && delta < 0) delta = 0;

        const dayVal: CumulativeDailyValue = {
          kind: 'cumulative',
          entityId,
          date: dateStr,
          sum: delta,
        };
        result.set(key, dayVal);
      }
    }
  }

  return result;
}

export function computeMonthlySummaryFromDailyValues(
  entityId: string,
  year: number,
  month: number,
  isMeasurement: boolean,
  excludeZero: boolean,
  dailyValues: Map<string, DailyValue>,
): MonthlySummary | null {
  if (isMeasurement) {
    // HA monthly stats return min/max of period means, not true min/max of the month.
    // Recompute from daily values so summary is consistent with displayed daily cells.
    const mins: number[] = [];
    const means: number[] = [];
    const maxes: number[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayVal = dailyValues.get(`${entityId}::${dateStr}`);
      if (dayVal?.kind === 'measurement') {
        mins.push(dayVal.min);
        means.push(dayVal.mean);
        maxes.push(dayVal.max);
      }
    }
    if (mins.length === 0) return null;
    return {
      entityId,
      year,
      month,
      min: Math.min(...mins),
      mean: means.reduce((a, b) => a + b, 0) / means.length,
      max: Math.max(...maxes),
      total: null,
    };
  } else {
    // Cumulative: min/mean/max optionally exclude zero-value days per row's show_zero;
    // total is always the sum of ALL days (zero days contribute 0 anyway).
    const filteredSums = collectDailySums(entityId, year, month, dailyValues, excludeZero);
    const allSums = excludeZero
      ? collectDailySums(entityId, year, month, dailyValues, false)
      : filteredSums;

    if (allSums.length === 0) return null;

    return {
      entityId,
      year,
      month,
      min: filteredSums.length > 0 ? Math.min(...filteredSums) : null,
      mean: filteredSums.length > 0 ? filteredSums.reduce((a, b) => a + b, 0) / filteredSums.length : null,
      max: filteredSums.length > 0 ? Math.max(...filteredSums) : null,
      total: allSums.reduce((a, b) => a + b, 0),
    };
  }
}

/**
 * Transform raw HA monthly-period statistics into a map of MonthlySummary entries.
 * Key format: `${entityId}::${year}-${month}`
 */
/**
 * Build the summary-map key for a row. Includes row index so duplicate entity rows with
 * different show_zero settings each get their own summary (no first-write-wins collision).
 */
export function rowSummaryKey(rowIndex: number, rowKey: string, year: number, month: number): string {
  return `${rowIndex}::${rowKey}::${year}-${month}`;
}

export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
  entityConfigs: EntityConfig[],
  viewingYear: number,
  timeZone: string,
  nowMs: number,
): Map<string, MonthlySummary> {
  const result = new Map<string, MonthlySummary>();
  const { year: nowYear, month: nowMonth } = yearMonthInTz(nowMs, timeZone);

  // Iterate per row (not per entityId) so duplicate entity rows with different show_zero each
  // produce an independent summary keyed by row index.
  entityConfigs.forEach((cfg, rowIndex) => {
    if (!('entity' in cfg)) return; // expression rows handled by caller
    const entityId = cfg.entity;
    const meta = metadataMap[entityId];
    if (!meta) return;
    // No HA bucket at all in this year (entity did not exist yet) is fine: months
    // stitched in from a predecessor still get a daily-derived summary below.
    const entries = rawStats[entityId] ?? [];

    const isMeasurement = meta.stateClass === 'measurement';
    const excludeZero = cfg.show_zero === false;
    const sorted = [...entries].sort((a, b) => a.start - b.start);

    // HA monthly buckets of the viewing year, by month. Buckets start at LOCAL
    // midnight in the server timezone — derive year/month in that zone, not UTC,
    // or every bucket east of UTC shifts back a month. Lookup-only entries from
    // before the viewing year (Dec-of-prior-year for January's cross-year delta)
    // MUST NOT produce a summary entry (FR-007); they stay reachable via `sorted`.
    const bucketIndexByMonth = new Map<number, number>();
    sorted.forEach((entry, i) => {
      const { year, month } = yearMonthInTz(entry.start, timeZone);
      if (year === viewingYear) bucketIndexByMonth.set(month, i);
    });

    // Every month of the viewing year: a month has a summary when the entity has an
    // HA bucket for it OR when daily values exist — e.g. months stitched in from a
    // predecessor before the entity itself had statistics.
    for (let month = 1; month <= 12; month++) {
      const year = viewingYear;
      const bucketIndex = bucketIndexByMonth.get(month);
      // min/mean/max always derive from daily values (feature 010 behaviour preserved).
      const fromDaily = computeMonthlySummaryFromDailyValues(entityId, year, month, isMeasurement, excludeZero, dailyValues);
      if (bucketIndex === undefined && !fromDaily) continue;

      const key = rowSummaryKey(rowIndex, entityId, year, month);

      // total: HA monthly sum delta for cumulative rows (feature 011); null for measurement rows.
      let total: number | null = null;
      if (!isMeasurement) {
        if (year === nowYear && month === nowMonth) {
          // Current month: HA's monthly bucket already includes today's elapsed hours,
          // but the day cells stop at yesterday (FR-003). Sum the completed daily deltas
          // instead — today is stored as an `empty` DailyValue and drops out on its own.
          total = fromDaily?.total ?? null;
        } else if (bucketIndex === undefined || sorted[bucketIndex]!.sum === undefined) {
          // No HA bucket (predecessor-only month) or FR-002 missing-sum edge case:
          // render empty rather than fall back to daily-sum arithmetic.
          total = null;
        } else {
          const entry = sorted[bucketIndex]!;
          // Look up immediately-preceding-month entry for the delta.
          let prevSum: number | undefined;
          if (bucketIndex > 0) {
            const prev = sorted[bucketIndex - 1]!;
            if (prev.sum !== undefined) {
              const { year: prevYear, month: prevMonth } = yearMonthInTz(prev.start, timeZone);
              const expectedPrevYear = month === 1 ? year - 1 : year;
              const expectedPrevMonth = month === 1 ? 12 : month - 1;
              if (prevYear === expectedPrevYear && prevMonth === expectedPrevMonth) {
                prevSum = prev.sum;
              }
            }
          }
          if (prevSum === undefined) {
            // FR-006 first-tracked-month fallback OR gap-handling (Research Q2).
            total = entry.sum!;
          } else {
            const delta = entry.sum! - prevSum;
            // FR-002a negative-delta clamp: total_increasing clamps to 0; total passes through.
            total = meta.stateClass === 'total_increasing' ? Math.max(0, delta) : delta;
          }
        }
      }

      const summary: MonthlySummary = fromDaily
        ? { ...fromDaily, total }
        : { entityId, year, month, min: null, mean: null, max: null, total };
      result.set(key, summary);
    }
  });

  return result;
}

/**
 * Yearly roll-up for a measurement row (FR-005): year min = lowest monthly min,
 * year max = highest monthly max (from the cached monthly summaries), and
 * year avg = day-weighted mean over the year — the mean of all recorded daily
 * means in the visible months. `show_zero` never affects measurement summaries.
 */
export function computeMeasurementYearRollup(
  rowIndex: number,
  entityId: string,
  year: number,
  visibleMonths: number[],
  monthlySummaries: Map<string, MonthlySummary>,
  dailyValues: Map<string, DailyValue>,
): YearlyRollup {
  const mins: number[] = [];
  const maxes: number[] = [];
  const dayMeans: number[] = [];

  for (const month of visibleMonths) {
    const summary = monthlySummaries.get(rowSummaryKey(rowIndex, entityId, year, month));
    if (summary?.min != null) mins.push(summary.min);
    if (summary?.max != null) maxes.push(summary.max);

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayVal = dailyValues.get(`${entityId}::${dateStr}`);
      if (dayVal?.kind === 'measurement') dayMeans.push(dayVal.mean);
    }
  }

  return {
    min: mins.length > 0 ? Math.min(...mins) : null,
    mean: dayMeans.length > 0 ? dayMeans.reduce((a, b) => a + b, 0) / dayMeans.length : null,
    max: maxes.length > 0 ? Math.max(...maxes) : null,
    total: null,
  };
}

/**
 * Yearly roll-up for a cumulative/expression row (FR-006, FR-018): total is the
 * sum of the monthly totals; min/avg/max are statistics over those monthly
 * totals, with zero-total months excluded when `excludeZero` (row show_zero:
 * false) — the total always includes every month (zeros contribute 0 anyway).
 */
export function computeCumulativeYearRollup(
  rowIndex: number,
  entityId: string,
  year: number,
  visibleMonths: number[],
  monthlySummaries: Map<string, MonthlySummary>,
  excludeZero: boolean,
): YearlyRollup {
  const totals: number[] = [];
  for (const month of visibleMonths) {
    const summary = monthlySummaries.get(rowSummaryKey(rowIndex, entityId, year, month));
    if (summary?.total != null) totals.push(summary.total);
  }
  if (totals.length === 0) return { min: null, mean: null, max: null, total: null };

  const filtered = excludeZero ? totals.filter((t) => t !== 0) : totals;
  return {
    min: filtered.length > 0 ? Math.min(...filtered) : null,
    mean: filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null,
    max: filtered.length > 0 ? Math.max(...filtered) : null,
    total: totals.reduce((a, b) => a + b, 0),
  };
}

/** Cyclic month-of-year step for the comparison view's prev/next controls (spec 014 FR-017). */
export function wrapMonth(month: number, step: number): number {
  return ((((month - 1 + step) % 12) + 12) % 12) + 1;
}

/**
 * Cross-year comparison series for one row and one monthly-summary component
 * (spec 014). Values are read verbatim from the stored monthly summaries;
 * diffPrev compares against the immediately preceding in-range year (FR-005),
 * diffAvg against the mean over complete data-bearing years (FR-006/007/008).
 * Percentages exist only on 'total' series and only for non-zero baselines
 * (FR-006a). The incomplete current month keeps its diffs but never counts
 * toward the average (FR-007).
 */
export function buildComparisonSeries(
  rowIndex: number,
  key: string,
  component: ComparisonComponent,
  month: number,
  years: number[],
  summariesByYear: Map<number, Map<string, MonthlySummary>>,
  now: { year: number; month: number },
): ComparisonSeries {
  const points = years.map((year) => {
    const summary = summariesByYear.get(year)?.get(rowSummaryKey(rowIndex, key, year, month));
    return {
      year,
      value: summary ? (summary[component] ?? null) : null,
      incomplete: year === now.year && month === now.month,
    };
  });

  const completeValues = points
    .filter((p) => p.value !== null && !p.incomplete)
    .map((p) => p.value as number);
  const crossYearAvg = completeValues.length > 0
    ? completeValues.reduce((a, b) => a + b, 0) / completeValues.length
    : null;

  const pct = (diff: number | null, baseline: number | null): number | null =>
    component === 'total' && diff !== null && baseline !== null && baseline !== 0
      ? diff / baseline
      : null;

  const entries = points.map((p, idx) => {
    const prev = idx > 0 && points[idx - 1]!.year === p.year - 1 ? points[idx - 1]! : undefined;
    const diffPrev = p.value !== null && prev?.value != null ? p.value - prev.value : null;
    const diffAvg = p.value !== null && crossYearAvg !== null ? p.value - crossYearAvg : null;
    return {
      year: p.year,
      value: p.value,
      diffPrev,
      diffAvg,
      pctPrev: pct(diffPrev, prev?.value ?? null),
      pctAvg: pct(diffAvg, crossYearAvg),
      incomplete: p.incomplete,
    };
  });

  return { component, crossYearAvg, entries };
}

export function collectDailySums(
  entityId: string,
  year: number,
  month: number,
  dailyValues: Map<string, DailyValue>,
  excludeZero: boolean,
): number[] {
  const sums: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = dailyValues.get(`${entityId}::${dateStr}`);
    if (entry?.kind === 'cumulative') {
      if (!excludeZero || entry.sum !== 0) {
        sums.push(entry.sum);
      }
    }
  }

  return sums;
}
