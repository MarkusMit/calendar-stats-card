---
description: "Task list for Yearly Summary View (013)"
---

# Tasks: Yearly Summary View

**Input**: Design documents from `/specs/013-yearly-summary-view/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md

**Tests**: REQUIRED. Constitution II (Test-First, NON-NEGOTIABLE) — every implementation task has a failing Vitest test written and confirmed red first.

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3). Each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Paths are repository-relative; all source under `frontend/`.

## Path Conventions

- Source: `frontend/src/`, Tests: `frontend/tests/` (Vitest). Run commands in WSL2 from `frontend/`.

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before any change (TDD gate).

- [ ] T001 Run `npm test` in `frontend/` and confirm a fully green baseline (record pass count) before starting.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types every story compiles against.

**⚠️ CRITICAL**: Must complete before any user story.

- [ ] T002 Add `ViewMode = 'monthly' | 'yearly'`, add `viewMode: ViewMode` (default `'monthly'`) to `ViewState`, and add the `YearlyRollup` interface in `frontend/src/types/statistics.ts`.
- [ ] T003 Initialize `_viewState.viewMode = 'monthly'` in `frontend/src/calendar-stats-card.ts` so existing behavior is unchanged.

**Checkpoint**: Types in place; monthly view still behaves exactly as before.

---

## Phase 3: User Story 1 - Year at a glance, one column per month (Priority: P1) 🎯 MVP

**Goal**: A per-year grid with 12 month columns and one row per entity; each cell is that month's summary (measurement min/avg/max sub-rows; cumulative monthly total), colored by thresholds.

**Independent Test**: Render `calendar-stats-year-summary-table` with cached `monthlySummaries` for a past year and confirm 12 month columns, correct per-row cells matching the monthly view, and threshold coloring — verifiable via component tests without the toggle (host renders it when `viewMode` is set to `'yearly'` in state).

### Tests for User Story 1 (write first, confirm RED) ⚠️

- [ ] T004 [P] [US1] Component test: `year-summary-table` renders 12 month columns (Jan–Dec) and one row per entity; measurement entity → 3 sub-rows (min/avg/max) honoring show_min/avg/max; cumulative entity → month totals; a no-data month → empty cell (not zero); each cell value sourced from `monthlySummaries`. File `frontend/tests/component/year-summary-table.test.ts`.
- [ ] T005 [P] [US1] Component test: threshold rules color each yearly cell (per cell's displayed value) and the table emits `thresholds-applied`. File `frontend/tests/component/year-summary-table.thresholds.test.ts`.
- [ ] T006 [P] [US1] Component test: card renders one `calendar-stats-year-summary-table` per non-empty year segment when `viewMode='yearly'` (state set directly), fed from `statisticsByYear`. File `frontend/tests/component/calendar-stats-card.yearly-render.test.ts`.

### Implementation for User Story 1

- [ ] T007 [US1] Create `calendar-stats-year-summary-table` in `frontend/src/components/year-summary-table.ts`: props per contract (`year`, `visibleMonths`, `entityConfigs`, `monthlySummaries`, `dailyValues`, `entityMetadata`, `entityErrors`, `lang`); render 12 month-name headers via `Intl`, measurement 3 sub-rows / cumulative single row, cells from `monthlySummaries` (`rowSummaryKey`), per-row precision/factor/unit, dense CSS with HA tokens. (Makes T004 pass.)
- [ ] T008 [US1] In `year-summary-table.ts`, color cells via `resolveThreshold` + `buildCellStyle` + `autoContrastText` and dispatch `thresholds-applied` (reuse `year-table` pattern). (Makes T005 pass.)
- [ ] T009 [US1] Wire host render in `frontend/src/calendar-stats-card.ts`: when `viewMode==='yearly'`, map `rangeYears(range)` (filtered by `visibleMonthsForYear`) to `calendar-stats-year-summary-table` blocks fed from `statisticsByYear.get(year)`; keep the `year-table` branch for `'monthly'`. Import the new component. (Makes T006 pass.)

**Checkpoint**: Yearly grid renders correctly (month cells) and is independently testable.

---

## Phase 4: User Story 2 - Per-row yearly Summary and Total (Priority: P2)

**Goal**: Each row shows a yearly Summary (min/avg/max) and, for cumulative rows, a yearly Total, aggregating the months in view.

**Independent Test**: Given a year of data, the row's Summary/Total cells equal the derivation rules in data-model.md (measurement extremes + day-weighted avg; cumulative Σ totals and stats over monthly totals).

### Tests for User Story 2 (write first, confirm RED) ⚠️

- [ ] T010 [P] [US2] Unit test `computeMeasurementYearRollup`: year min = min of monthly mins, year max = max of monthly maxes, year avg = day-weighted mean from daily values; empty months excluded. File `frontend/tests/unit/services/data-transform.year-rollup.test.ts`.
- [ ] T011 [P] [US2] Unit test `computeCumulativeYearRollup`: total = Σ monthly totals; min/avg/max over monthly totals; zero-total months excluded when `show_zero=false`. File `frontend/tests/unit/services/data-transform.cumulative-rollup.test.ts`.
- [ ] T012 [P] [US2] Component test: `year-summary-table` renders a yearly Summary column for every row and a yearly Total column when any cumulative row is present, with values matching the roll-up helpers. File `frontend/tests/component/year-summary-table.rollup.test.ts`.

### Implementation for User Story 2

- [ ] T013 [US2] Implement `computeMeasurementYearRollup(entityId, year, visibleMonths, monthlySummaries, dailyValues)` in `frontend/src/services/data-transform.ts` (reuse the measurement daily-summary code path over the 12-month span). (Makes T010 pass.)
- [ ] T014 [US2] Implement `computeCumulativeYearRollup(rowIndex, entityId, year, visibleMonths, monthlySummaries, excludeZero)` in `frontend/src/services/data-transform.ts`. (Makes T011 pass; same file as T013 → sequential.)
- [ ] T015 [US2] Add the yearly Summary column (all rows) and yearly Total column (cumulative rows) to `frontend/src/components/year-summary-table.ts` using the two helpers, colored by the same threshold path. (Makes T012 pass; depends on T007.)

**Checkpoint**: Yearly grid now shows correct per-row roll-ups.

---

## Phase 5: User Story 3 - Switch views + year-granular navigation + earliest-data floor (Priority: P3)

**Goal**: A Monthly | Yearly segmented control switches views (preserving entities and span, expanded to whole years for yearly); the range navigator becomes year-granular in yearly mode; navigation can no longer scroll before the first recorded data point (FR-015, also fixes the monthly view).

**Independent Test**: Toggle switches the rendered table; entering yearly snaps the range to full years; prev/next in either mode stop at the earliest-data period.

### Tests for User Story 3 (write first, confirm RED) ⚠️

- [ ] T016 [P] [US3] Unit test date-range year helpers: `yearPresetToRange`, year-granular `stepRange`, `snapRangeToYears` (→ Jan..Dec), `clampRangeToFloor` (month- and year-aware, prevents start before earliest). File `frontend/tests/unit/services/date-range.year.test.ts`.
- [ ] T017 [P] [US3] Component test `view-mode-toggle`: renders two labeled segments, marks the active one, emits `calendar-stats-view-mode-select` with the other mode on click; de/en labels. File `frontend/tests/component/view-mode-toggle.test.ts`.
- [ ] T018 [P] [US3] Component test `range-navigator` year granularity: year presets + year-only From/To picker, `YYYY`/`YYYY–YYYY` label, whole-year prev/next; `atStart` reflects the earliest-data floor. File `frontend/tests/component/range-navigator.year.test.ts`.
- [ ] T019 [P] [US3] Component test card view-switch: toggling emits → `viewMode` changes → correct table renders; switching to yearly snaps range to full years; prev is clamped/disabled at the earliest-data floor in BOTH monthly and yearly modes. File `frontend/tests/component/calendar-stats-card.view-switch.test.ts`.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Add `yearPresetToRange`, year-granular stepping (`granularity` param on `stepRange` or a `stepRangeByYear`), `snapRangeToYears`, and `clampRangeToFloor` in `frontend/src/services/date-range.ts`. (Makes T016 pass.)
- [ ] T021 [P] [US3] Create `calendar-stats-view-mode-toggle` segmented control in `frontend/src/components/view-mode-toggle.ts` (props `mode`, `lang`; emits `calendar-stats-view-mode-select`; HA-token styling). (Makes T017 pass.)
- [ ] T022 [P] [US3] Add i18n keys `view.monthly`, `view.yearly`, `range.last_year`, `range.last_3_years`, `range.last_5_years` to `frontend/src/translations/en.json` and `frontend/src/translations/de.json`.
- [ ] T023 [US3] Enhance `frontend/src/components/range-navigator.ts`: add `granularity: 'month' | 'year'`; in year mode use year presets + year-only picker, `YYYY`/`YYYY–YYYY` label, and whole-year steps. (Makes T018 pass; depends on T020, T022.)
- [ ] T024 [US3] Wire host in `frontend/src/calendar-stats-card.ts`: render `view-mode-toggle` in `.bottom-bar`; handle `view-mode-select` (set `viewMode`; on → yearly apply `snapRangeToYears` then `_fetchRange`); pass `granularity` to the navigator; apply `clampRangeToFloor` in the prev/next handlers; update `getCardSize()` for the active view. (Makes T019 pass; depends on T020–T023, T009.)

**Checkpoint**: All three stories functional; navigation floor enforced everywhere.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T025 [P] Update `README.md` (and any docs describing views) to document the yearly view and the Monthly | Yearly toggle.
- [ ] T026 [P] Verify SC-002: all 12 month columns fit without horizontal scroll on desktop; adjust dense CSS in `frontend/src/components/year-summary-table.ts` if needed.
- [ ] T027 Run `npm run lint`, `npm test`, and `npm run build` in `frontend/`; confirm all green and a clean bundle.
- [ ] T028 Execute `specs/013-yearly-summary-view/quickstart.md` end-to-end against a live HA instance (both locales, threshold coloring, floor behavior).

---

## Dependencies & Execution Order

### Phase order

- Setup (P1) → Foundational (P2, blocks all stories) → US1 (P3) → US2 (P4) → US3 (P5) → Polish (P6).
- Priority order P1 → P2 → P3; US2 builds on the US1 table; US3 is independent of US2 but shares the US1 table for the yearly render branch.

### Story dependencies

- **US1**: needs Foundational (T002–T003). No dependency on US2/US3.
- **US2**: needs US1's `year-summary-table` (T007) to add columns; roll-up helpers themselves are independent.
- **US3**: needs Foundational; its card wiring (T024) depends on US1's yearly render branch (T009). The toggle, date helpers, and i18n are independent.

### Within a story

- Tests (T004–T006, T010–T012, T016–T019) written and RED before their implementation tasks.
- `data-transform.ts` roll-up tasks T013→T014 are sequential (same file).
- `calendar-stats-card.ts` tasks T009 (US1) and T024 (US3) touch the same file → sequential across stories.

### Parallel opportunities

- All `[P]` test tasks within a story run together.
- US3's T020 (date-range), T021 (toggle), T022 (i18n) are different files → parallel.
- US1's three tests (T004–T006) are different files → parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first (all fail), in parallel:
Task: "Component test year-summary-table grid in frontend/tests/component/year-summary-table.test.ts"
Task: "Component test yearly threshold coloring in frontend/tests/component/year-summary-table.thresholds.test.ts"
Task: "Component test card yearly render in frontend/tests/component/calendar-stats-card.yearly-render.test.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. STOP and validate: the yearly grid renders month cells correctly (component + card tests green). Demoable via a temporary `viewMode='yearly'`.

### Incremental delivery

1. US1 → yearly grid (MVP).
2. US2 → per-row Summary/Total roll-ups.
3. US3 → user-facing toggle, year-granular navigation, and the earliest-data floor fix.

---

## Notes

- `[P]` = different files, no incomplete dependency.
- Confirm each test FAILS before writing implementation (Constitution II).
- Commit after each task or logical group (Conventional Commits; hooks handle Speckit commits).
- Reuse over new code (Constitution V): `monthlySummaries`, `rowSummaryKey`, `resolveThreshold`/`buildCellStyle`, `autoContrastText`, `localize`, `rangeYears`/`visibleMonthsForYear`, `stepRange`/`presetToRange`.
- No new config options; no new runtime dependency; UTF-8/LF only.
