# Phase 1 UI Contracts: Yearly Summary View

The card exposes no external API; its "contracts" are the LitElement component boundaries (properties in, custom events out). Events use `bubbles: true, composed: true` to cross shadow-DOM, consistent with existing components.

## `calendar-stats-view-mode-toggle` (NEW)

Compact view-mode dropdown in the bottom bar (trigger button + two-option popover; revised from a segmented control for portrait-mobile width).

**Properties (in)**

| Property | Type | Notes |
|----------|------|-------|
| `mode` | `'monthly' \| 'yearly'` | Currently active view. |
| `lang` | `string` | HA language for labels. |

**Events (out)**

| Event | Detail | When |
|-------|--------|------|
| `calendar-stats-view-mode-select` | `{ mode: 'monthly' \| 'yearly' }` | User clicks a segment (only fires on change). |

**Behavior**: two buttons; the active one is visually marked (`aria-pressed`); labels `view.monthly` / `view.yearly`; HA-token styling matching the legend/range controls.

## `calendar-stats-year-summary-table` (NEW)

Renders one year's yearly grid: 12 month columns + yearly Summary (+ Total for cumulative), one row (or 3 sub-rows for measurement) per entity/expression.

**Properties (in)**

| Property | Type | Notes |
|----------|------|-------|
| `year` | `number` | The calendar year this block renders. |
| `visibleMonths` | `number[]` | Months (1–12) with data to show; others render blank (future/pre-data clamp). |
| `entityConfigs` | `EntityConfig[]` | Same row config as the monthly table. |
| `monthlySummaries` | `Map<string, MonthlySummary>` | From `YearStatistics`; source of every month cell (D1). |
| `dailyValues` | `Map<string, DailyValue>` | Needed for measurement day-weighted yearly avg (D2). |
| `entityMetadata` | `Map<string, EntityMetadata>` | State class / unit / friendly name. |
| `entityErrors` | `Set<string>` | Reused error styling. |
| `lang` | `string` | HA language. |

**Events (out)**

| Event | Detail | When |
|-------|--------|------|
| `thresholds-applied` | `{ groups: ThresholdLegendGroup[] }` | After render, so the shared legend popover lists triggered rules (same contract as `year-table`). |

**Behavior**: column headers = localized month short names + a Summary header (+ Total header when any cumulative row present); each cell colored via `resolveThreshold`/`buildCellStyle` + `autoContrastText` (D8); precision/factor/unit per row; dense layout.

## `calendar-stats-range-navigator` (ENHANCED)

Add year granularity and the earliest-data floor.

**New/changed properties (in)**

| Property | Type | Notes |
|----------|------|-------|
| `granularity` | `'month' \| 'year'` | `'year'` in the yearly view: year presets, year-only From/To picker, whole-year steps, `YYYY` / `YYYY–YYYY` label. Default `'month'` (unchanged). |
| `range`, `now`, `earliest`, `atStart`, `atEnd`, `lang` | (existing) | `atStart` now reflects the earliest-data floor clamp (FR-015). |

**Events (out)** — unchanged names:

| Event | Detail |
|-------|--------|
| `calendar-stats-prev-range` / `calendar-stats-next-range` | (none) — host steps + clamps |
| `calendar-stats-range-select` | `{ preset }` or `{ start, end }` (year-aligned anchors in year mode) |

## Host: `calendar-stats-card` (ENHANCED)

- Adds `viewMode` state and renders `view-mode-toggle` in `.bottom-bar`.
- When `viewMode === 'yearly'`: renders one `calendar-stats-year-summary-table` per year segment (from `rangeYears(range)` filtered to non-empty `visibleMonthsForYear`), fed from `statisticsByYear.get(year)`; passes `granularity="year"` to the navigator.
- When `viewMode === 'monthly'`: unchanged (`year-table` per year segment).
- Handles `calendar-stats-view-mode-select`: sets `viewMode`; on switch to yearly, applies `snapRangeToYears` then `_fetchRange`.
- Prev/next handlers apply `clampRangeToFloor` (FR-015) in both modes.
- `getCardSize()` accounts for the active view (yearly blocks are shorter).

## Contract test obligations (Vitest, TDD)

- `view-mode-toggle`: renders two segments; click emits `view-mode-select` with the other mode; active segment marked; de/en labels.
- `year-summary-table`: 12 month columns; measurement row → 3 sub-rows with month min/avg/max; cumulative row → month totals; Summary/Total cells match roll-up rules; empty month → empty cell; threshold color applied; emits `thresholds-applied`.
- `range-navigator` (year mode): year presets + year-only picker; prev/next emit; `atStart` reflects floor.
- `card`: toggling emits and re-renders the correct table; switch to yearly snaps range to full years; earliest-data floor disables prev / prevents crossing.
