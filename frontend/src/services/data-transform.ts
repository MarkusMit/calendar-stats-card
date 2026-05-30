import type {
  DailyValue,
  MeasurementDailyValue,
  CumulativeDailyValue,
  EmptyDailyValue,
  EntityMetadata,
  MonthlySummary,
} from '../types/statistics';
import type { EntityConfig } from '../types/card-config';
import type { RawStats } from './statistics-service';

function dateStringInTz(timestampMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestampMs));
}

function todayStringInTz(timeZone: string, nowMs: number): string {
  return dateStringInTz(nowMs, timeZone);
}

type HourlyEntry = { start: number; end: number };

function hourInTz(timestampMs: number, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(
      new Date(timestampMs),
    ),
  );
}

function computePartialCoverage(
  dateStr: string,
  entityId: string,
  stateClass: string,
  timeZone: string,
  hourlyStats: Record<string, HourlyEntry[]>,
): boolean {
  const entityHourly = hourlyStats[entityId];
  if (!entityHourly || entityHourly.length === 0) return false;

  const dayEntries = entityHourly.filter(
    (e) => dateStringInTz(e.start, timeZone) === dateStr,
  );

  if (dayEntries.length === 0) return false;

  if (stateClass === 'measurement') {
    return dayEntries.length < 24;
  }

  // Cumulative: check day-boundary gaps only
  const hours = dayEntries.map((e) => hourInTz(e.start, timeZone));
  const hasFirstHour = hours.includes(0);
  const hasLastHour = hours.includes(23);
  return !hasFirstHour || !hasLastHour;
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
  hourlyStats: Record<string, HourlyEntry[]>,
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
        const partial = computePartialCoverage(dateStr, entityId, meta.stateClass, timeZone, hourlyStats);
        const dayVal: MeasurementDailyValue = {
          kind: 'measurement',
          entityId,
          date: dateStr,
          min: entry.min ?? 0,
          mean: entry.mean ?? 0,
          max: entry.max ?? 0,
          partialCoverage: partial,
        };
        result.set(key, dayVal);
      } else {
        // Cumulative
        const prevEntry = sorted[i - 1];
        const prevSum = prevEntry != null ? (prevEntry.sum ?? 0) : null;
        const currentSum = entry.sum ?? 0;
        let delta = prevSum === null ? currentSum : currentSum - prevSum;

        if (isTotalIncreasing && delta < 0) delta = 0;

        const partial = computePartialCoverage(dateStr, entityId, meta.stateClass, timeZone, hourlyStats);
        const dayVal: CumulativeDailyValue = {
          kind: 'cumulative',
          entityId,
          date: dateStr,
          sum: delta,
          partialCoverage: partial,
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
): Map<string, MonthlySummary> {
  const result = new Map<string, MonthlySummary>();

  // Iterate per row (not per entityId) so duplicate entity rows with different show_zero each
  // produce an independent summary keyed by row index.
  entityConfigs.forEach((cfg, rowIndex) => {
    if (!('entity' in cfg)) return; // expression rows handled by caller
    const entityId = cfg.entity;
    const meta = metadataMap[entityId];
    if (!meta) return;
    const entries = rawStats[entityId];
    if (!entries) return;

    const isMeasurement = meta.stateClass === 'measurement';
    const excludeZero = cfg.show_zero === false;
    const sorted = [...entries].sort((a, b) => a.start - b.start);

    for (const entry of sorted) {
      const date = new Date(entry.start);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = rowSummaryKey(rowIndex, entityId, year, month);

      const summary = computeMonthlySummaryFromDailyValues(entityId, year, month, isMeasurement, excludeZero, dailyValues);
      result.set(key, summary ?? { entityId, year, month, min: null, mean: null, max: null, total: null });
    }
  });

  return result;
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
