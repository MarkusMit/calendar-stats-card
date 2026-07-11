# Phase 0 Research: Yearly Summary View

No external/unknown technologies — the feature is built entirely on the existing card stack (Lit, Vitest, the `statisticsByYear` pipeline). "Research" here records the design decisions that resolve how the yearly view is composed from existing parts. All spec ambiguities were already resolved via `/speckit-clarify`.

## D1 — Source of the month cells

**Decision**: Each month cell in the yearly grid reads directly from the per-year `monthlySummaries` map already stored in `ViewState.statisticsByYear` (keyed by `rowSummaryKey(rowIndex, entityId, year, month)`), the same values the monthly view renders in its per-month Summary/Total columns.

**Rationale**: Guarantees SC-001 (yearly cell == monthly-view value) by construction and adds zero new aggregation for the cells. These values are already constitution-compliant (measurement min/max are card-computed true extremes; cumulative totals are HA-sum-delta).

**Alternatives considered**: Recomputing month cells from `dailyValues` — rejected as duplicate work and a risk of drift from the monthly view.

## D2 — Measurement yearly Summary (roll-up) math

**Decision** (from clarification): `year min = min over the monthly mins`, `year max = max over the monthly maxes`, `year avg = day-weighted mean over the year` — computed as the mean of all recorded daily values in the year (equivalent to weighting each month's mean by its number of contributing days). Compute from `dailyValues` for the year (already cached), reusing the same code path that produces monthly measurement summaries but over the 12-month span.

**Rationale**: Extremes-of-extremes gives the true yearly min/max; a simple mean of monthly means would bias months with fewer data days. Matches the monthly view's meaning of "avg = mean over the period's days."

**Alternatives considered**: unweighted mean of monthly averages (simpler, biased — rejected); stats over monthly averages for all three (loses true extremes — rejected).

## D3 — Cumulative yearly Summary/Total (roll-up) math

**Decision**: The yearly grid row for a cumulative entity is its twelve **monthly totals**. The yearly **Total** = sum of the monthly totals (FR-006). The yearly **Summary** min/avg/max is computed over those twelve monthly-total values (min month, mean of months, max month), honoring the row's `show_zero` for whether zero-total months count (FR-009).

**Rationale**: The displayed cell granularity in the yearly view is the month, so the roll-up must aggregate the displayed monthly values, not daily values. "Which month had the most rain" (max of monthly totals) is the meaningful yearly summary at this granularity, and it keeps the Summary consistent with the cells above it.

**Alternatives considered**: min/avg/max of daily values (as the monthly view's cumulative Summary does) — rejected: it would not aggregate the values actually shown in the yearly row and would confuse users comparing the Summary against the month cells.

## D4 — Measurement rows rendered as three sub-rows

**Decision**: A measurement entity renders as three stacked sub-rows (min / avg / max), exactly like the monthly view, with the twelve month columns holding that sub-row's monthly value. Cumulative entities render as a single row. Per-row `show_min` / `show_avg` / `show_max` visibility applies (FR-002).

**Rationale**: Reuses the established monthly-view layout and the existing sub-label pattern; keeps 12 columns (< 31 day columns) so no horizontal-scroll concern (SC-002). No new "3 values per cell" idiom.

## D5 — View toggle

**Decision** (from clarification): A `view-mode-toggle` segmented control with two labeled options (Monthly | Yearly) in the bottom bar, sitting alongside the legend toggle and range navigator. `viewMode: 'monthly' | 'yearly'` is added to `ViewState` (session-only, not persisted to card config).

**Rationale**: Both options visible and one-tap; self-describing; fits the dense bottom bar and existing button styling.

## D6 — Year-granular range + snap on switch

**Decision** (from clarification): In the yearly view the range is whole-years only. The `range-navigator` gains a `granularity: 'month' | 'year'` input:
- `year`: prev/next step by whole years; the popover presets are This year / Last year / Last 3 years / Last 5 years and a custom **year** From/To (year selects, no month); the label shows `YYYY` or `YYYY–YYYY`.
- `month`: unchanged existing behavior.

Switching monthly→yearly expands the active `DateRange` to full calendar years: `start → {start.year, 1}`, `end → {end.year, 12}` (then clamped by the current-month and earliest-data rules for display). The `DateRange` month-anchor model is unchanged; year mode just constrains anchors to January/December boundaries. Switching back retains the year-spanning range.

**Rationale**: Satisfies FR-016 with the smallest change — one adaptive navigator instead of a second component, reusing the existing `DateRange`, `stepRange`, and `presetToRange` helpers with year-step variants.

**Alternatives considered**: a separate `year-navigator` component — rejected (duplicates arrows/popover/label plumbing already in `range-navigator`, violates YAGNI).

## D7 — Earliest-data navigation floor (FR-015, fixes current defect)

**Decision**: Add a pure `clampRangeToFloor(range, earliest)` (or extend `stepRange`) so a "previous" step can never move `range.start` before the earliest-data anchor: if a step would cross the floor, the start is clamped to the earliest-data period and "previous" is disabled there. Applies in both `month` and `year` granularity (in year mode the floor is the earliest-data **year**). This corrects the current monthly-view behavior where a rolling/custom step could jump entirely before the first data point.

**Rationale**: The user observed the monthly view scrolls "way past" the first data. FR-015 makes the floor binding for the shared navigation; clamping the stepped result (not just disabling after the fact) is the fix.

## D8 — Threshold coloring & legend reuse

**Decision** (from clarification): Each yearly-view cell is colored by the row's threshold rules evaluated against that cell's displayed value, via the existing `resolveThreshold` / `buildCellStyle` (threshold-resolver) and `autoContrastText` (readable-text). The yearly table emits the same `thresholds-applied` event as `year-table` so the existing legend popover works unchanged.

**Rationale**: Consistency with the monthly view; full reuse of shipped services; no new coloring logic.

## D9 — No new data fetching

**Decision**: The yearly view needs, per year, exactly what the card already fetches and caches (`monthlySummaries` + `dailyValues` + `entityMetadata`). Because yearly ranges are whole years and the card already fetches per year, switching to the yearly view for already-loaded years triggers no new websocket calls; newly-in-range years use the existing `_fetchRange` loop.

**Rationale**: Instant view switching (performance goal); zero change to `StatisticsService`.
