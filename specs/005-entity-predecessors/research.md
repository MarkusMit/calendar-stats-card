# Research: Entity Predecessor Configuration

**Branch**: `005-entity-predecessors` | **Date**: 2026-05-25

## Finding 1 — Stats fetch is entity-ID list driven

`StatisticsService.fetchDailyStats` / `fetchMonthlyStats` / `getStatisticsMetadata` all accept `string[]` of entity IDs. Adding predecessor IDs to this list is sufficient to fetch their data — no API changes needed.

- Decision: Include all predecessor entity IDs in the `entityIds` array before every fetch call.
- Rationale: Zero-overhead reuse of existing fetch infrastructure.
- Alternatives: Lazy-fetch per predecessor on demand → rejected (complicates abort logic, double round-trips).

## Finding 2 — Daily values map is keyed `${entityId}::${date}`

`transformDailyStats` returns `Map<string, DailyValue>` with keys like `sensor.temp::2024-11-01`. Downstream rendering and summary code (`computeMonthlySummaryFromDailyValues`, `collectDailySums`) all look up values via `${entityId}::${dateStr}`.

- Decision: Merge predecessor data under the **main entity's** key (`${mainEntityId}::${date}`), not the predecessor's key.
- Rationale: All downstream code stays unchanged — rendering and monthly summaries automatically pick up predecessor data without modification.
- Alternatives: Pass predecessor info to rendering layer → rejected (invasive, requires changes in year-table, monthly-table, data-transform).

## Finding 3 — Hourly stats currently passed as `{}`

`transformDailyStats` is called with `{}` for hourlyStats, so `computePartialCoverage` always returns `false`. Partial coverage is not yet active in production. Predecessor data will have the same behaviour (partialCoverage: false) — consistent with FR-014 which says "same logic as main entity days."

- Decision: No change to partial coverage behaviour for this feature.
- Rationale: Pre-existing limitation applies equally to main and predecessor entities.

## Finding 4 — Metadata built from `hass.states`

Entity metadata (`stateClass`, `unitOfMeasurement`, `deviceClass`) is built from `hass.states[entityId]?.attributes` in `calendar-stats-card.ts`. Predecessor entity IDs included in `entityIds` will automatically have their metadata built.

- Decision: Use `metadataMap` (already built by the time `resolvePredecessorData` is called) for the FR-011 compatibility check.
- Rationale: No additional API calls needed.

## Finding 5 — Current-month summary uses `computeMonthlySummaryFromDailyValues` directly

The current-month summary block (added in spec 004) reads from `dailyValues` keyed under `entityId`. After the resolver merges predecessor data into main entity keys, this computation automatically includes predecessor days in the current month summary — satisfying FR-013.

## Finding 6 — Warned predecessors must be per-card-instance

`CalendarStatsCard` is a custom element; multiple instances can exist per dashboard. Warning state (`_warnedPredecessors: Set<string>`) must be an instance variable, not a module-level singleton.

- Decision: Add `private _warnedPredecessors = new Set<string>()` to `CalendarStatsCard`.
- Rationale: Prevents cross-card state pollution.

## Resolution algorithm (date range logic)

For an entity row with dated predecessors sorted ascending by `replaced_on`:

```
activePredecessor(date) =
  sortedDated.find(p => p.replaced_on > date)
  ?? null  // → main entity range
```

Example: predecessors [P2(2023-01-01), P1(2024-06-01)] sorted ascending:
- date 2022-12-31 → P2 (first with replaced_on > date)
- date 2023-06-15 → P1
- date 2024-06-15 → null (main entity)

For undated predecessors (fallback only): tried in config list order when main has no data and no dated predecessor covers the date.
