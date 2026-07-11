# Phase 0 Research: Month Comparison View

No external or unknown technologies — the feature composes the existing card stack (Lit, Vitest, the `statisticsByYear` pipeline).
"Research" records the design decisions that resolve how the comparison is built from existing parts.
All spec ambiguities were resolved via `/speckit-clarify`.

## D1 — Entry point: clickable month headers in `year-summary-table`

**Decision**: The month `<th>` cells in each year segment's header row (`year-summary-table.ts`, currently plain headers) become buttons when that calendar month has data in **at least one** compared year; clicking dispatches `calendar-stats-month-select { month }` (bubbling, composed).
Months with no data in any compared year stay plain headers (FR-016).

**Rationale**: The spec mandates opening from the header rows of every year; a bubbled event keeps the table presentation-only and lets the host own the state, consistent with every existing component (`view-mode-toggle`, `range-navigator`).

**Alternatives considered**: per-cell click anywhere in a month column — rejected, conflicts with future cell-level interactions and is not what the spec asks.

## D2 — Comparison state: one nullable field on `ViewState`

**Decision**: Add `comparisonMonth: number | null` (1–12, session-only) to `ViewState`.
The comparison view renders when `viewMode === 'yearly' && comparisonMonth !== null`; back sets it to `null`.
The compared years are derived at render time from the yearly view's current `range` — no second copy of the year set is stored.

**Rationale**: Smallest possible state (FR-002 says the yearly range is the single source of the year span); no new view mode keeps the `view-mode-toggle` contract untouched.

**Alternatives considered**: `viewMode: 'comparison'` as a third mode — rejected: the toggle, range snapping, and navigator granularity all key off `viewMode`, and the comparison is conceptually a drill-down of the yearly view, not a sibling mode.

## D3 — Range/view changes close the comparison

**Decision**: While the comparison is open, the bottom bar hides the range navigator and view-mode toggle; only back (and the legend) are available.
Any programmatic range or view-mode change (e.g. config update) resets `comparisonMonth` to `null`.

**Rationale**: The compared year set mirrors the yearly range (FR-002); letting the user mutate the range mid-comparison would silently change the comparison subject.
Hiding the controls is simpler and less error-prone than keeping them live and re-deriving.

**Alternatives considered**: keep the navigator active and re-derive the comparison on range change — rejected as scope creep with confusing semantics (Constitution V).

## D4 — Summary values read from `monthlySummaries`; diffs are pure arithmetic

**Decision**: Each summary cell reads the existing `MonthlySummary` via `rowSummaryKey(rowIndex, key, year, month)` — identical to the yearly view's month cells.
New pure helpers in `data-transform.ts` build, per row and per summary component (min/mean/max for measurement, total for cumulative/expression), the cross-year series: per year the value, `diffPrev = value(y) − value(prevYearInRange)` (omitted when the preceding year lacks data), and `diffAvg = value(y) − avg` where `avg` is the mean over compared years with data, excluding the incomplete current month (FR-005/006/007/008).

**Rationale**: Reading the stored summaries guarantees SC-002 (comparison == yearly view) by construction; pure helpers make the diff math trivially unit-testable (Constitution II) and keep components presentation-only.

**Alternatives considered**: recomputing month summaries from `dailyValues` — rejected (duplicate work, drift risk — same reasoning as 013 D1).

## D5 — Percentage on cumulative/expression totals only

**Decision** (from clarification): For cumulative and expression **totals**, each diff additionally carries `pct = diff / baseline` (baseline = previous year's total for `diffPrev`, cross-year average for `diffAvg`), omitted when the baseline is `0`, `null`, or missing.
Measurement min/mean/max show no percentages.

**Rationale**: Ratios are meaningful on ratio-scale totals (rainfall, energy) but undefined on interval scales (°C) and unstable near zero; the guard makes the rule total.

## D6 — Incomplete current month

**Decision**: A compared cell is *incomplete* iff `year === now.year && month === now.month`.
It renders with its data-to-date value plus a visible marker (localized, e.g. superscript `*` with `title`), participates in `diffPrev`, and is excluded from the cross-year average (FR-007).
The value itself comes from the existing current-month fallback already in the host (`computeMonthlySummaryFromDailyValues` when the HA monthly bucket is missing).

**Rationale**: Calendar-position check is deterministic and matches how the monthly/yearly views treat the current month; the exclusion rule was fixed in clarification Q3 (all row types).

## D7 — Daily section reuses `year-table` unchanged

**Decision**: Below the summary table the host renders one existing `calendar-stats-year-table` per compared year in chronological order, fed the year's cached data with `visibleMonths = [comparisonMonth]`, each labeled with its year.
A year with no data for the month renders a localized empty note instead of a table.

**Rationale**: `year-table` already renders one table per visible month with all per-row settings, threshold coloring, and the summary/total columns (FR-009/010 for free); SC-004 (daily values == monthly view) holds by construction.

**Alternatives considered**: a new single "aligned days across years" table — explicitly out of scope (spec assumption: stacked per-year tables).

## D8 — Month navigation chrome in the host

**Decision**: The comparison header (rendered by the host card) shows: back button, previous-month button, localized month name (via `Intl`, no year), next-month button.
Prev/next compute `((month + 11) % 12) + 1` / `(month % 12) + 1` — pure wrap, never disabled, walking all twelve months; an all-empty month renders the empty-state comparison (clarification Q1).
No new component: the host already renders bar buttons directly, and the controls are three buttons plus a label.

**Rationale**: A dedicated navigator component would duplicate `range-navigator` plumbing for three buttons (YAGNI, Constitution V); wrap math is trivial and unit-tested via the card tests.

**Alternatives considered**: reusing `range-navigator` — rejected: its model is a `DateRange` with clamping and presets, the comparison needs a cyclic month-of-year with fixed years — opposite semantics.

## D9 — Threshold coloring on summary cells

**Decision**: Summary values in the comparison table are colored via the existing `resolveThreshold`/`buildCellStyle`/`autoContrastText` with the existing summary cell roles (`summary-min`/`summary-avg`/`summary-max`, scalar/total for cumulative), exactly like the yearly view; diffs themselves are not threshold-colored.
The component emits the same `thresholds-applied` event so the shared legend works unchanged (FR-011).

**Rationale**: Full reuse; diffs are derived deltas, not row values — coloring them against row thresholds would be semantically wrong.

## D10 — No new data fetching

**Decision**: The comparison consumes only `statisticsByYear` entries the yearly view has already fetched for its range; opening, month navigation, and back trigger zero websocket calls.
`StatisticsService` is untouched.

**Rationale**: The compared year set equals the yearly range, which is fetched before the yearly view renders; month-of-year navigation never changes the year set (performance goal, D8).
