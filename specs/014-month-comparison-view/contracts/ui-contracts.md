# Phase 1 UI Contracts: Month Comparison View

The card exposes no external API; its "contracts" are the LitElement component boundaries (properties in, custom events out).
Events use `bubbles: true, composed: true` to cross shadow DOM, consistent with existing components.

## `calendar-stats-year-summary-table` (ENHANCED)

Month header cells in each year segment's header row become interactive.

**New behavior**

- A month `<th>` whose calendar month has data in at least one rendered segment renders as a button (keyboard-focusable, `aria-label` = localized "compare {month}").
- Clicking it dispatches `calendar-stats-month-select` with `{ month: number /* 1–12 */ }`.
- A month with no data in any segment stays a plain header — no button, no event (FR-016).

**Everything else** (properties, rollups, `thresholds-applied`) — unchanged.

## `calendar-stats-month-comparison-table` (NEW)

Renders the cross-year summary comparison: rows = configured entities/expressions (measurement rows as min/avg/max sub-rows per visibility), columns = compared years, sticky label column with unit.

**Properties (in)**

| Property | Type | Notes |
|----------|------|-------|
| `month` | `number` | Compared calendar month (1–12). |
| `segments` | `{ year, monthlySummaries, dailyValues, entityMetadata }[]` | One per compared year, chronological — same shape the yearly view passes. |
| `entityConfigs` | `EntityConfig[]` | Same row config as the other tables. |
| `entityErrors` | `Set<string>` | Reused error styling. |
| `now` | `{ year: number; month: number }` | For the incomplete-current-month rule (D6). |
| `lang` | `string` | HA language. |

**Events (out)**

| Event | Detail | When |
|-------|--------|------|
| `thresholds-applied` | `{ groups: ThresholdLegendGroup[] }` | After render — same contract as the other tables, feeds the shared legend. |

**Behavior**

- Header row: first cell names the compared month; one colspan-3 header per compared year; a trailing average-column header.
- Each year renders three aligned sub-columns per (sub-)row: value (threshold-colored via `resolveThreshold`/`buildCellStyle`/`autoContrastText`, roles as in the yearly view), `Δ` prev-year diff, `Ø` average deviation — each signed; cumulative/expression totals append the percentage when defined (FR-006a); diff cells never get threshold styling.
- The trailing average cell shows the row's cross-year average, threshold-colored via the summary role (`summary-min`/`summary-avg`/`summary-max`/`summary-scalar`), styled like the monthly view's Summary column.
- All visual styles (padding, header row, data-cell borders, summary borders, label/sub-label columns) mirror `year-table` so the comparison table looks identical to the monthly tables.
- Values/diffs come from `buildComparisonSeries` (data-model) — the component computes nothing itself beyond formatting (precision/factor/unit per row, `Intl.NumberFormat`).
- Incomplete current-month cell carries the localized incomplete marker (D6).
- Empty value → empty cell; diffs omitted (FR-008).
- Dense layout, HA tokens, sticky label column.

## `calendar-stats-year-table` (ENHANCED — cross-year section mode)

**New property**: `monthSegments: Array<{ year, month, dailyValues, monthlySummaries, entityMetadata }> | null` (default `null`).
When set, the component renders one thead/tbody section per segment inside its single `<table>` (aligned day columns across years), each section header naming the month AND its year; `year`/`visibleMonths`/`dailyValues`/`monthlySummaries`/`entityMetadata` are ignored.
When `null`, behavior is exactly the pre-014 monthly view (single year, `visibleMonths`).
**Sticky scrollbar**: the component renders a viewport-sticky horizontal scrollbar below (and synced with) its scrollbar-less table container, so wide tables stay scrollable without reaching the table's bottom edge.
The comparison's daily section is ONE such instance fed a section per data-bearing compared year, chronological (FR-009/010); years without data get no section.

## Host: `calendar-stats-card` (ENHANCED)

- Adds `comparisonMonth: number | null` to its view state (data-model).
- Handles `calendar-stats-month-select`: sets `comparisonMonth` (yearly view only).
- Render branch `viewMode === 'yearly' && comparisonMonth !== null` (no top bar):
  - The month name lives in the summary table's first header cell (header-row styling) and in the bottom-bar nav.
  - `month-comparison-table` with the segments of every year in the yearly range; diffs render beside the value.
  - Daily section: ONE `year-table` in `monthSegments` mode, one section per data-bearing year, chronological.
  - All-empty month: localized empty state (`comparison.no_data`) instead of the tables; controls stay usable.
- Bottom bar while the comparison is open: range navigator and view-mode toggle hidden; in their place the back button plus the month prev/next controls with the localized month name (`wrapMonth`, Dec↔Jan, never disabled — FR-017); legend stays (D3).
- Back sets `comparisonMonth = null`; any range or view-mode change also resets it (D3, FR-012).
- No fetching from any comparison interaction (D10).

## i18n additions (`en.json` / `de.json`)

`comparison.back`, `comparison.prev_month`, `comparison.next_month` (aria), `comparison.diff_prev`, `comparison.diff_avg`, `comparison.incomplete`, `comparison.no_data`, `comparison.compare_month` (header-button aria).
Exact wording fixed during implementation; keys are the contract.

## Contract test obligations (Vitest, TDD)

- `year-summary-table`: data-bearing month header is a button and click emits `calendar-stats-month-select {month}`; data-less month header is inert (FR-016); keyboard accessible.
- `month-comparison-table`: rows = entities with measurement sub-rows per visibility; one column per segment year, chronological; values equal the injected `MonthlySummary` components (SC-002); `diffPrev`/`diffAvg` rendering incl. omission rules (range start, missing prev, empty year); percentage only on cumulative/expression totals with zero-baseline omission (FR-006a); incomplete marker on current month and its exclusion from the average (via injected `now`); threshold colors on values, none on diffs; emits `thresholds-applied`; de/en labels.
- `data-transform` unit: `buildComparisonSeries` full rule matrix (average exclusions, diff omissions, single-year range → diffAvg 0, percentages, guards); `wrapMonth` (1↔12 wrap, ±1 steps).
- `card`: month click in yearly view opens the comparison; twelve `next` clicks cycle back to the start month with unchanged years (SC-008); empty month shows empty state; back restores the yearly view with range/entities intact (SC-007); range/view-mode change closes the comparison; no websocket calls from open/navigate/back (D10).
