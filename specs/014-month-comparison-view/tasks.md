# Tasks: Month Comparison View

**Input**: Design documents from `/specs/014-month-comparison-view/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Included and mandatory — Constitution II (Test-First) requires failing tests before any implementation code.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths are repository-relative; commands run in WSL2 from `frontend/`

## Phase 1: Setup

**Purpose**: Confirm a green baseline before any new work (TDD prerequisite).

- [ ] T001 Run `npm test` and `npm run lint` in `frontend/` and confirm both pass; stop and report if any pre-existing failure exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and translation keys every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Add `comparisonMonth: number | null` to `ViewState` and the `ComparisonEntry` / `ComparisonSeries` interfaces (per data-model.md) in `frontend/src/types/statistics.ts`
- [ ] T003 [P] Add the `comparison.*` keys (back, prev_month, next_month, diff_prev, diff_avg, incomplete, no_data, compare_month) to `frontend/src/translations/en.json` and `frontend/src/translations/de.json`

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Compare one month across years at a glance (Priority: P1) 🎯 MVP

**Goal**: Click a month label in the yearly view's header rows to open the comparison; cross-year summary table (rows = entities, columns = years) with value + prev-year diff + average deviation (+ % on cumulative totals); month prev/next controls with Dec↔Jan wrap and empty-state handling.

**Independent Test**: With a multi-year yearly range, click a data-bearing month label; verify the summary table shows every year with values matching the yearly view and arithmetically correct diffs; step through all twelve months via next and confirm the wrap and empty-state behavior (spec US1 scenarios 1–6).

### Tests for User Story 1 (write first, confirm they FAIL)

- [ ] T004 [P] [US1] Write failing unit tests for `buildComparisonSeries` (value sourcing per row type, `diffPrev` omission at range start / missing prev year, `crossYearAvg` exclusions for empty years and the incomplete current month, `diffAvg`, percentage only on cumulative/expression totals with zero/missing-baseline guard, single-year range → `diffAvg` 0) and `wrapMonth` (±1 steps, 1↔12 wrap) in `frontend/tests/unit/services/data-transform-comparison.test.ts`
- [ ] T005 [P] [US1] Write failing component tests for `year-summary-table` month headers (data-bearing month renders as keyboard-focusable button and click emits `calendar-stats-month-select {month}`; data-less month stays inert per FR-016; localized aria-label) in `frontend/tests/component/year-summary-table-month-select.test.ts`
- [ ] T006 [P] [US1] Write failing component tests for `month-comparison-table` (rows = entities with measurement sub-rows per show_min/avg/max; one column per segment year, chronological; values equal injected `MonthlySummary` components; diff rendering incl. omission rules; percentages per FR-006a; incomplete marker via injected `now`; threshold colors on values but not diffs; `thresholds-applied` emitted; de/en labels) in `frontend/tests/component/month-comparison-table.test.ts`
- [ ] T007 [P] [US1] Write failing card wiring tests (month click in yearly view opens the comparison; header shows localized month name with prev/next controls; twelve `next` clicks cycle back to the start month with unchanged years per SC-008; all-empty month shows the `comparison.no_data` empty state; range navigator and view-mode toggle hidden while open; range or view-mode change closes the comparison; zero websocket calls from open/navigate) in `frontend/tests/component/card-month-comparison.test.ts`

### Implementation for User Story 1

- [ ] T008 [US1] Implement `buildComparisonSeries` and `wrapMonth` (pure, per data-model.md derivation rules) in `frontend/src/services/data-transform.ts` until T004 passes
- [ ] T009 [US1] Make month header cells interactive (button when the month has data in ≥1 segment, dispatch `calendar-stats-month-select`, inert otherwise) in `frontend/src/components/year-summary-table.ts` until T005 passes
- [ ] T010 [US1] Create the `month-comparison-table` component (contracts/ui-contracts.md: props month/segments/entityConfigs/entityErrors/now/lang; formatting via precision/factor/unit + `Intl.NumberFormat`; threshold coloring via existing resolver; dense HA-token styling; sticky label column) in `frontend/src/components/month-comparison-table.ts` until T006 passes
- [ ] T011 [US1] Wire the host: `comparisonMonth` state, `calendar-stats-month-select` handler, comparison render branch (header chrome with prev/next month controls + localized month name, `month-comparison-table` fed from `statisticsByYear`, empty state), hide range-navigator/view-mode-toggle while open, reset `comparisonMonth` on range/view-mode change, no new fetches, in `frontend/src/calendar-stats-card.ts` until T007 passes

**Checkpoint**: User Story 1 fully functional — comparison opens, compares, navigates months; MVP deliverable.

---

## Phase 4: User Story 2 - Inspect the daily values of the compared months (Priority: P2)

**Goal**: Below the summary table, one monthly-view daily table per compared year (chronological, year-labeled), reusing `year-table` unchanged with `visibleMonths = [comparisonMonth]`; empty note for years without data.

**Independent Test**: Open a comparison for a month with data in ≥2 years; verify one labeled daily table per year appears below the summary with values, per-row settings, and threshold colors identical to the monthly view (spec US2 scenarios 1–3).

### Tests for User Story 2 (write first, confirm they FAIL)

- [ ] T012 [US2] Write failing card tests for the daily section (one `year-table` per compared year, chronological, each preceded by its year label; each instance receives `visibleMonths = [comparisonMonth]` and the year's cached data; a year without data for the month renders a localized empty note instead of a table) in `frontend/tests/component/card-month-comparison.test.ts`

### Implementation for User Story 2

- [ ] T013 [US2] Render the daily section in the comparison branch (per-year `year-table` instances / empty notes, chronological, labeled) in `frontend/src/calendar-stats-card.ts` until T012 passes

**Checkpoint**: User Stories 1 and 2 work together — summary plus drill-down.

---

## Phase 5: User Story 3 - Return to the yearly view (Priority: P3)

**Goal**: Back control in the comparison header restores the yearly view with its range and entities untouched; the comparison survives re-renders until explicitly closed.

**Independent Test**: Open a comparison, click back, and verify the yearly view returns with the previous range/entities; trigger a data refresh while open and confirm the comparison persists (spec US3 scenarios 1–2).

### Tests for User Story 3 (write first, confirm they FAIL)

- [ ] T014 [US3] Write failing card tests for the back control (back button present with `comparison.back` label; click resets to the yearly view with unchanged range and entities per SC-007; a re-render/hass update while open keeps the comparison visible) in `frontend/tests/component/card-month-comparison.test.ts`

### Implementation for User Story 3

- [ ] T015 [US3] Add the back button to the comparison header and its handler (`comparisonMonth = null`) in `frontend/src/calendar-stats-card.ts` until T014 passes

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T016 Run the full verification suite in `frontend/`: `npm test`, `npm run lint`, `npm run build`; confirm the bundle builds and no suite regressed
- [ ] T017 Execute the manual walkthrough in `specs/014-month-comparison-view/quickstart.md` against a live HA instance and record any deviations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: after T001 — blocks all stories.
- **User Stories (Phases 3–5)**: after Phase 2.
  - US2 (T012–T013) and US3 (T014–T015) extend the US1 render branch and test file, so they follow US1 sequentially.
- **Polish (Phase 6)**: after all desired stories.

### Within Each User Story

- Tests are written and confirmed failing before their implementation task (Constitution II).
- T008 (helpers) before T010/T011 consume them; T009 (event) before T011 handles it.

### Parallel Opportunities

- T002 ∥ T003 (different files).
- T004 ∥ T005 ∥ T006 ∥ T007 (four separate new test files).
- T008 ∥ T009 ∥ T010 after their respective tests exist (three different source files); T011 last in US1 (depends on T008–T010).
- US2/US3 tasks are sequential (shared `calendar-stats-card.ts` and shared test file).

## Parallel Example: User Story 1

```bash
# All US1 test files together (must fail):
Task: "Unit tests buildComparisonSeries + wrapMonth in frontend/tests/unit/services/data-transform-comparison.test.ts"
Task: "Component tests month-select headers in frontend/tests/component/year-summary-table-month-select.test.ts"
Task: "Component tests month-comparison-table in frontend/tests/component/month-comparison-table.test.ts"
Task: "Card wiring tests in frontend/tests/component/card-month-comparison.test.ts"

# Then three implementation files in parallel, host wiring last:
Task: "Helpers in frontend/src/services/data-transform.ts"
Task: "Clickable headers in frontend/src/components/year-summary-table.ts"
Task: "New component frontend/src/components/month-comparison-table.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (baseline) → Phase 2 (types + i18n).
2. Phase 3 complete → **stop and validate**: comparison opens from the yearly view, values match, diffs correct, month navigation wraps.
3. That alone answers the user's core question and is demoable.

### Incremental Delivery

1. US1 → MVP (summary comparison + month navigation).
2. US2 → daily drill-down under the summary.
3. US3 → polished round trip via back control.
4. Phase 6 → full suite, build, quickstart walkthrough.
