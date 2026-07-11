# Phase 1 Data Model: Month Comparison View

All types live in `frontend/src/types/statistics.ts` unless noted.
No persisted storage — everything is session state or derived at render time.

## Changed: `ViewState`

One new field (session-only, never written to card config — FR-013):

```ts
export interface ViewState {
  // ...existing fields...
  range: DateRange;
  viewMode: ViewMode;                  // 'monthly' | 'yearly' — unchanged
  comparisonMonth: number | null;      // NEW — 1–12 while the comparison is open, else null
  earliestDataYear: number | null;
  earliestDataMonth: number | null;
  isLoading: boolean;
  statisticsByYear: Map<number, YearStatistics>;
  entityErrors: Set<string>;
}
```

- Default `comparisonMonth: null` (yearly view renders as today).
- The comparison renders iff `viewMode === 'yearly' && comparisonMonth !== null`.
- Compared years = the years of the current yearly `range`, derived at render time (never stored separately — FR-002).

## Reused unchanged

- **`MonthlySummary`** `{ entityId, year, month, min, mean, max, total }` — source of every comparison summary value, read via `rowSummaryKey(rowIndex, key, year, month)` (research D4).
- **`YearStatistics`** `{ dailyValues, monthlySummaries, entityMetadata }` — one cached record per compared year; also feeds the daily `year-table` instances.
- **`DailyValue`** — consumed only indirectly through the reused `year-table`.
- **`DateRange`** — untouched; the comparison only reads its year span.

## New: comparison series (derived, not stored)

Computed at render time per row and per summary component by the new pure helpers:

```ts
export interface ComparisonEntry {
  year: number;
  value: number | null;        // MonthlySummary component (min | mean | max | total) or null when no data
  diffPrev: number | null;     // value − value(previous year in range); null at range start or when prev has no data
  diffAvg: number | null;      // value − crossYearAvg; null when value or avg is null
  pctPrev: number | null;      // cumulative/expression totals only; null when baseline is 0/null (else always null)
  pctAvg: number | null;       // same rule against the cross-year average
  incomplete: boolean;         // true iff year === now.year && month === now.month
}

export interface ComparisonSeries {
  component: 'min' | 'mean' | 'max' | 'total';
  crossYearAvg: number | null; // mean over entries with value !== null && !incomplete; null when none qualify
  entries: ComparisonEntry[];  // one per compared year, chronological
}
```

### Derivation rules

**Value** (all row types): the stored `MonthlySummary` component for (rowIndex, year, comparisonMonth); `null` when no summary exists (FR-004, FR-008).

**Measurement rows**: series for `min`, `mean`, `max`, filtered by the row's `show_min`/`show_avg`/`show_max`; no `total` series; `pctPrev`/`pctAvg` always `null` (FR-003, FR-006a).

**Cumulative and expression rows**: single `total` series; percentages per FR-006a with zero/missing-baseline guard.

**`crossYearAvg`**: arithmetic mean over entries whose `value !== null` and `incomplete === false` (FR-006, FR-007, FR-008).

**`diffPrev`**: `value(y) − value(y−1)` where `y−1` is the immediately preceding year **in the range**; `null` when `y` is the range start, either value is `null` (FR-005).
An incomplete entry still receives `diffPrev` (clarification Q3).

**`diffAvg`**: `value(y) − crossYearAvg`; `null` when either operand is `null`.
Computed for incomplete entries too (they are excluded only from the average itself).

**Zero-day handling**: already baked into the stored `MonthlySummary` values per row `show_zero`; the comparison performs no additional zero filtering (spec Edge Cases).

### Empty / boundary handling

- Year without data for the month → entry with `value: null`, all diffs `null`; rendered as empty cells, distinct from zero (FR-008).
- Month with no data in **any** compared year → empty-state comparison view; month headers for such months are not clickable, but the month remains reachable via prev/next (FR-016, FR-017).
- Single-year range → `diffPrev` always `null`; `diffAvg` is `0` for the lone complete value (Edge Cases).

## New helpers (pure, unit-tested)

In `frontend/src/services/data-transform.ts`:

- `buildComparisonSeries(rowIndex, key, component, month, years, summariesByYear, now): ComparisonSeries` — implements every derivation rule above.
- `wrapMonth(month, step): number` — `((month − 1 + step + 12) % 12) + 1` for the prev/next controls (FR-017).

## State transitions

```text
open:      yearly view, click month m (has data in ≥1 year)  → comparisonMonth := m
navigate:  next → comparisonMonth := wrapMonth(m, +1)   (Dec → Jan)
           prev → comparisonMonth := wrapMonth(m, −1)   (Jan → Dec)
           compared years unchanged in both cases (FR-017)
close:     back control                                  → comparisonMonth := null
           any range change or viewMode change           → comparisonMonth := null (research D3)
```

## Validation rules (traceable to FRs)

| Rule | FR |
|------|----|
| Month header click opens the comparison for that month | FR-001 |
| Compared years = yearly view's range, read-only | FR-002 |
| Summary table rows = entities, columns = years, cell = value(s) + both diffs | FR-003 |
| Comparison value == yearly-view cell value | FR-004 / SC-002 |
| `diffPrev` vs immediately preceding in-range year, omitted when absent | FR-005 |
| `diffAvg` vs cross-year average over data-bearing years | FR-006 |
| Absolute diffs everywhere; % only on cumulative/expression totals, baseline-guarded | FR-006a |
| Incomplete current month: shown, marked, excluded from avg | FR-007 |
| No-data year: empty cells, excluded from avg | FR-008 |
| Daily section: one monthly-view table per year, chronological, labeled | FR-009 |
| Daily tables honor all per-row settings | FR-010 |
| Threshold coloring on summary values (not diffs) | FR-011 |
| Back restores the yearly view unchanged | FR-012 |
| `comparisonMonth` never persisted to config | FR-013 |
| All new strings via localize (en/de) | FR-014 |
| Dense layout | FR-015 |
| Data-less months not clickable | FR-016 |
| Prev/next walk all 12 months with Dec↔Jan wrap; empty month → empty state | FR-017 |
