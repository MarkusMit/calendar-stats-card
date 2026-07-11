# Phase 1 Data Model: Yearly Summary View

All types live in `frontend/src/types/statistics.ts` unless noted. No persisted storage — everything is in-memory session state or derived at render time.

## Changed: `ViewState`

Add one field (session-only, not written to card config):

```ts
export type ViewMode = 'monthly' | 'yearly';

export interface ViewState {
  // ...existing fields...
  range: DateRange;
  viewMode: ViewMode;          // NEW — default 'monthly'
  earliestDataYear: number | null;
  earliestDataMonth: number | null;
  isLoading: boolean;
  statisticsByYear: Map<number, YearStatistics>;
  entityErrors: Set<string>;
}
```

- Default `viewMode: 'monthly'` (preserves current behavior).
- Toggling to `'yearly'` also snaps `range` to whole years (see State Transitions).

## Reused unchanged

- **`MonthlySummary`** `{ entityId, year, month, min, mean, max, total }` — the yearly grid's month cells read these from `YearStatistics.monthlySummaries` (keyed by `rowSummaryKey`). No shape change.
- **`DateRange`** `{ start: MonthAnchor, end: MonthAnchor, preset }` — reused as-is; yearly (`year` granularity) constrains anchors to `{year,1}`…`{year,12}`.
- **`YearStatistics`** `{ dailyValues, monthlySummaries, entityMetadata }` — the yearly view consumes the same per-year record.

## New: yearly roll-up (derived, not stored)

Computed at render time per row per year; no new persisted type required. Represented as a plain shape returned by the new helpers:

```ts
export interface YearlyRollup {
  min: number | null;   // measurement: min of monthly mins | cumulative: min of monthly totals
  mean: number | null;  // measurement: day-weighted yearly mean | cumulative: mean of monthly totals
  max: number | null;   // measurement: max of monthly maxes  | cumulative: max of monthly totals
  total: number | null; // cumulative: sum of monthly totals   | measurement: null (no total)
}
```

### Derivation rules

**Measurement row** (from clarification / research D2):

- `min` = minimum over the in-range months' `MonthlySummary.min`.
- `max` = maximum over the in-range months' `MonthlySummary.max`.
- `mean` = day-weighted mean over the year = mean of all recorded daily values for the entity in that year (computed from `YearStatistics.dailyValues`, reusing the monthly measurement-summary code path over a 12-month span). `show_zero` MUST NOT affect measurement summaries (Constitution III).
- `total` = null.

**Cumulative row** (research D3):

- The twelve month cells are `MonthlySummary.total` per month.
- `total` = sum of the in-range months' totals (FR-006).
- `min`/`mean`/`max` = statistics over those monthly totals; zero-total months excluded when the row's `show_zero` is `false`, included otherwise (FR-009).

**Expression row**: treated as its configured cumulative-style monthly totals already present in `monthlySummaries`; same rules as cumulative.

### Empty / boundary handling

- A month with no `MonthlySummary` entry (or outside the earliest-data / future clamp) contributes no cell value and is excluded from the roll-up; the cell renders empty, not zero (FR-008).
- A year whose visible-month set is empty is not rendered (mirrors the monthly-view "skip empty year" behavior).

## New helpers (pure, unit-tested)

In `frontend/src/services/data-transform.ts`:

- `computeMeasurementYearRollup(entityId, year, visibleMonths, monthlySummaries, dailyValues): YearlyRollup`
- `computeCumulativeYearRollup(rowIndex, entityId, year, visibleMonths, monthlySummaries, excludeZero): YearlyRollup`

In `frontend/src/services/date-range.ts` (year granularity + floor):

- `yearPresetToRange(preset, nowYear)` and year-step logic for `stepRange` (or a `granularity` param).
- `snapRangeToYears(range): DateRange` — `{start.year,1}`…`{end.year,12}`.
- `clampRangeToFloor(range, earliest): DateRange` — prevents start crossing the earliest-data anchor (FR-015), month- and year-aware.

## State Transitions

```text
viewMode: 'monthly' ⇄ 'yearly'   (via view-mode-toggle)

on 'monthly' → 'yearly':
    range := snapRangeToYears(range)      // expand to full calendar years (FR-016)
    navigator granularity := 'year'
    fetch any newly-in-range years (existing _fetchRange)

on 'yearly' → 'monthly':
    range retained (year-spanning)         // no re-snap
    navigator granularity := 'month'

navigation (either mode):
    prev/next → step by unit (month|year), then clampRangeToFloor(range, earliest)   // FR-015
    'previous' disabled when range.start is at/before the earliest-data anchor
    'next' disabled when range.end is at/after the current period (existing rule, FR-007)
```

## Validation rules (traceable to FRs)

| Rule | FR |
|------|----|
| Yearly grid = 12 month columns per year, one row per entity/expression | FR-001 |
| Measurement cell = month min/avg/max (respect show_min/avg/max) | FR-002 |
| Cumulative cell = month total | FR-003 |
| Yearly cell value == monthly-view value for same entity/month | FR-004 / SC-001 |
| Measurement yearly Summary (extremes + day-weighted avg) | FR-005 |
| Cumulative yearly Total = Σ monthly totals | FR-006 |
| No future-month data | FR-007 |
| No-data month renders empty, not zero | FR-008 |
| Zero-month inclusion follows row show_zero | FR-009 |
| One labeled block per year, chronological | FR-010 |
| Monthly\|Yearly segmented toggle preserves entities + span (year-expanded) | FR-011 |
| Label+unit column as monthly view | FR-012 |
| Dense layout | FR-013 |
| en/de labels | FR-014 |
| Earliest-data navigation floor (shared) | FR-015 |
| Year-granular range + snap on switch | FR-016 |
| Threshold coloring + legend on cells | FR-017 |
| Cumulative yearly Summary over monthly totals | FR-018 |
