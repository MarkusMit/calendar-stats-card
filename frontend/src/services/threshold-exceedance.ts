import type { CellRole, EntityConfig, ThresholdRule } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, YearStatistics } from '../types/statistics';
import { matchingThresholds, resolveThreshold } from './threshold-resolver';
import { rowLabel } from './row-label';

/** One named day threshold with its day counts over the viewed range. */
export interface ExceedanceRow {
  rule: ThresholdRule;
  /** Days where this rule is the one that colors the cell. */
  band: number;
  /** Days where this rule applies at all, whether or not it colors the cell. */
  cumulative: number;
}

/** The exceedance rows of one configured row, under that row's display label. */
export interface ExceedanceGroup {
  label: string;
  rows: ExceedanceRow[];
}

/** Visible months per year, as the card already derives them for rendering. */
export interface MonthSpan {
  year: number;
  months: number[];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The (value, role) pairs a day contributes, mirroring what year-table renders:
 * measurement rows expose up to three sub-rows, everything else a single scalar
 * cell. Hidden sub-rows and zero values suppressed by show_zero are left out,
 * because no cell is coloured for them either.
 */
function dayCandidates(
  val: DailyValue,
  cfg: EntityConfig,
  factor: number,
): Array<[number, CellRole]> {
  if (val.kind === 'measurement') {
    const showZero = ('show_zero' in cfg ? cfg.show_zero : undefined) !== false;
    const roles: Array<[number, CellRole]> = [];
    if (cfg.show_min !== false) roles.push([val.min * factor, 'min']);
    if (cfg.show_avg !== false) roles.push([val.mean * factor, 'avg']);
    if (cfg.show_max !== false) roles.push([val.max * factor, 'max']);
    return showZero ? roles : roles.filter(([v]) => v !== 0);
  }
  if (val.kind === 'cumulative') return [[val.sum * factor, 'scalar']];
  return [];
}

/**
 * Counts, per named day threshold, how many days of the viewed range it applies to.
 *
 * Pure and independent of rendering: the yearly view shows no day cells, yet its
 * counts must match the monthly view's for the same range.
 */
export function countExceedances(
  entities: EntityConfig[],
  segments: MonthSpan[],
  statisticsByYear: Map<number, YearStatistics>,
): ExceedanceGroup[] {
  const groups: ExceedanceGroup[] = [];

  for (const cfg of entities) {
    const thresholds = cfg.thresholds ?? [];
    if (thresholds.length === 0) continue;

    const key = rowKey(cfg);
    const factor = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const cumulative = new Map<ThresholdRule, number>();
    const band = new Map<ThresholdRule, number>();
    let meta;

    for (const seg of segments) {
      const yearStats = statisticsByYear.get(seg.year);
      if (!yearStats) continue;
      meta ??= yearStats.entityMetadata.get(key);

      for (const month of seg.months) {
        for (let d = 1; d <= daysInMonth(seg.year, month); d++) {
          const val = yearStats.dailyValues.get(`${key}::${dateKey(seg.year, month, d)}`);
          if (!val || val.kind === 'empty') continue;

          const dayCumulative = new Set<ThresholdRule>();
          const dayBand = new Set<ThresholdRule>();

          for (const [value, role] of dayCandidates(val, cfg, factor)) {
            for (const rule of matchingThresholds(value, thresholds, role, 'day')) dayCumulative.add(rule);
            const winner = resolveThreshold(value, thresholds, role, 'day');
            if (winner) dayBand.add(winner);
          }

          // Sets first, counts after: a day contributes at most 1 to each rule.
          for (const rule of dayCumulative) cumulative.set(rule, (cumulative.get(rule) ?? 0) + 1);
          for (const rule of dayBand) band.set(rule, (band.get(rule) ?? 0) + 1);
        }
      }
    }

    // Rules without a name or a day value can still decide another rule's band,
    // but they have nothing to label a row with.
    const rows = thresholds
      .filter((r) => r.name && r.value != null && (r.text_color || r.background_color))
      .sort((a, b) => a.value! - b.value!)
      .map((rule) => ({ rule, band: band.get(rule) ?? 0, cumulative: cumulative.get(rule) ?? 0 }));

    if (rows.length > 0) groups.push({ label: rowLabel(cfg, meta), rows });
  }

  return groups;
}
