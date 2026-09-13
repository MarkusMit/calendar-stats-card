import type { EntityConfig } from '../types/card-config';

/**
 * Row fields that no statistics fetch or transform reads: `_fetchOneYear`,
 * `transformDailyStats`, `transformMonthlyStats` and `resolvePredecessorData`
 * take only entity/expression, name, unit, state_class, show_zero and
 * predecessors off a row. Everything else is applied while rendering.
 *
 * The list is a denial, not an allowance, so a field added later counts as
 * data-relevant until it is proven otherwise.
 */
const RENDER_ONLY_FIELDS: ReadonlySet<string> = new Set([
  'precision', 'factor', 'text_color', 'background_color',
  'thresholds', 'show_min', 'show_avg', 'show_max',
]);

/**
 * Identity of everything in the row list that fetched and derived statistics
 * depend on. Row order is part of it — monthly summaries are keyed by row
 * index — so a reorder invalidates the cache just like an edited entity id.
 */
export function statisticsSignature(entities: EntityConfig[]): string {
  return JSON.stringify(entities.map((cfg) => {
    const fields = cfg as unknown as Record<string, unknown>;
    const relevant: Record<string, unknown> = {};
    for (const key of Object.keys(fields).sort()) {
      if (RENDER_ONLY_FIELDS.has(key)) continue;
      if (fields[key] !== undefined) relevant[key] = fields[key];
    }
    return relevant;
  }));
}
