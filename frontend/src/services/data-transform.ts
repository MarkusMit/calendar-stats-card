import type {
  DailyValue,
  MeasurementDailyValue,
  CumulativeDailyValue,
  EmptyDailyValue,
  EntityMetadata,
  MonthlySummary,
} from '../types/statistics';
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

/**
 * Transform raw HA monthly-period statistics into a map of MonthlySummary entries.
 * Key format: `${entityId}::${year}-${month}`
 */
export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
): Map<string, MonthlySummary> {
  const result = new Map<string, MonthlySummary>();

  for (const [entityId, entries] of Object.entries(rawStats)) {
    const meta = metadataMap[entityId];
    if (!meta) continue;

    const isMeasurement = meta.stateClass === 'measurement';
    const isPrecipitation = meta.deviceClass === 'precipitation';

    const sorted = [...entries].sort((a, b) => a.start - b.start);

    for (const entry of sorted) {
      const date = new Date(entry.start);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = `${entityId}::${year}-${month}`;

      if (isMeasurement) {
        result.set(key, {
          entityId,
          year,
          month,
          min: entry.min ?? null,
          mean: entry.mean ?? null,
          max: entry.max ?? null,
          total: null,
        });
      } else {
        // Cumulative: all stats computed from daily values (correctly handles year boundary)
        const filteredSums = collectDailySums(entityId, year, month, dailyValues, isPrecipitation);
        const allSums = isPrecipitation
          ? collectDailySums(entityId, year, month, dailyValues, false)
          : filteredSums;

        const minVal = filteredSums.length > 0 ? Math.min(...filteredSums) : null;
        const maxVal = filteredSums.length > 0 ? Math.max(...filteredSums) : null;
        const meanVal = filteredSums.length > 0 ? filteredSums.reduce((a, b) => a + b, 0) / filteredSums.length : null;
        const total = allSums.length > 0 ? allSums.reduce((a, b) => a + b, 0) : null;

        result.set(key, {
          entityId,
          year,
          month,
          min: minVal,
          mean: meanVal,
          max: maxVal,
          total,
        });
      }
    }
  }

  return result;
}

function collectDailySums(
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
