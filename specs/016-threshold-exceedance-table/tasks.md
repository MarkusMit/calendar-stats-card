---

description: "Task list for feature 016: threshold exceedance table"
---

# Tasks: Threshold Exceedance Table

**Input**: Design documents from `/specs/016-threshold-exceedance-table/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui-contracts.md](contracts/ui-contracts.md)

**Tests**: Mandatory. Constitution Principle II (NON-NEGOTIABLE) requires every test written and confirmed failing before its implementation code.

**Organization**: Grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 — maps to the user stories in spec.md
- Every task names its exact file path

## Path Conventions

Frontend-only project. Sources in `frontend/src/`, tests in `frontend/tests/`.
All commands run from `frontend/`.

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before any new work.

- [X] T001 Run `npm test` and `npm run lint` from `frontend/` and confirm the baseline: 37 files / 646 tests passing, lint exit 0. Do not start T002 on a red baseline.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pieces every user story depends on. No user story can start until this phase is complete.

- [X] T002 [P] Add failing tests for `matchingThresholds` in `frontend/tests/unit/services/threshold-resolver.test.ts`: returns every applicable rule (not just the winner), excludes rules without a period value, excludes rules with neither `text_color` nor `background_color`, honours the `not-below`/`not-above` cell-role exclusions, and filters by `cellScope` (a `value_month`-only rule is inert for `'day'`).
- [X] T003 Export `matchingThresholds(cellValue, thresholds, cellRole, cellScope?)` from `frontend/src/services/threshold-resolver.ts` and rebuild `resolveThreshold` on top of it, keeping its signature and its closest-wins / highest-value / first-defined tie-break. All pre-existing assertions in `threshold-resolver.test.ts` must still pass unmodified.
- [X] T004 [P] Add failing tests for `rowLabel` in `frontend/tests/unit/services/row-label.test.ts`: `cfg.name` wins over the metadata friendly name, friendly name wins over the raw entity id, `cfg.unit` wins over the metadata unit, the unit is appended as ` [unit]`, and no bracket is emitted when neither source has a unit.
- [X] T005 Create `frontend/src/services/row-label.ts` exporting `rowLabel(cfg, meta)`, then replace the inline label composition in `frontend/src/components/year-table.ts` (the legend group label) with a call to it. Existing legend tests must pass unmodified.
- [X] T006 [P] Add the `exceedance` translation group to `frontend/src/translations/en.json` and `frontend/src/translations/de.json` with keys `title`, `band` and `total`, using the values in [contracts/ui-contracts.md](contracts/ui-contracts.md) and matching the existing flat two-level structure and key ordering.

**Checkpoint**: `npm test` green, `matchingThresholds` and `rowLabel` available, translation keys in place.

---

## Phase 3: User Story 1 — Count the days a threshold was reached (Priority: P1) 🎯 MVP

**Goal**: A named threshold appears below the tables with the number of days of the viewed range it applied to.

**Independent test**: Configure one named threshold on a row, open a range of past months, and verify the number shown equals the days colored by that threshold in the tables above.

- [X] T007 [P] [US1] Add failing tests for `countExceedances` in `frontend/tests/unit/services/threshold-exceedance.test.ts` covering the cumulative count only: a cumulative row with one named rule over one month; days of kind `'empty'` (today and future) not counted; the row `factor` applied before comparison; a zero-value day still counted for a cumulative row; rules without a `name` and rules without a day `value` producing no row; a row whose rules all fail those filters producing no group at all.
- [X] T008 [US1] Create `frontend/src/services/threshold-exceedance.ts` exporting `ExceedanceRow`, `ExceedanceGroup` and `countExceedances(entities, segments, statisticsByYear, metadata)`, implementing the scalar (cumulative and expression row) path per [data-model.md](data-model.md): day lookup by `<rowKey>::YYYY-MM-DD`, empty-kind skip, factor application, `matchingThresholds` for the cumulative count, name/day-value filtering, group labels from `rowLabel`, rows sorted by day value ascending, empty groups dropped.
- [X] T009 [P] [US1] Add failing tests for the component in `frontend/tests/component/exceedance-table.test.ts`: renders one group header per group with its label, one row per rule with the rule name and its counts, applies the rule's colors to the name cell, and renders nothing when `groups` is empty.
- [X] T010 [US1] Create `frontend/src/components/exceedance-table.ts` — `@customElement('calendar-stats-exceedance-table')` with `groups` (`attribute: false`) and `lang` properties, following `frontend/src/components/year-summary-table.ts` for style ordering, dense cell padding, border tokens and the closing `HTMLElementTagNameMap` declaration. Column headers come from `localize('exceedance.*', lang)`; rule colors are applied with the shared cell-style builder and contrast resolver.
- [X] T011 [US1] Add failing tests in `frontend/tests/component/calendar-stats-card.test.ts`: the exceedance table renders in the monthly view after the data tables when a qualifying rule exists, and is absent when no rule qualifies.
- [X] T012 [US1] Wire it into `frontend/src/calendar-stats-card.ts`: side-effect import beside the other components, compute the groups in `render()` from the visible month segments already derived there, and render the element after the view ternary inside `.card-content` when the groups are non-empty.

**Checkpoint**: MVP — one count column, correct in the monthly view. `npm test`, `npm run lint`, `npm run build` all green.

---

## Phase 4: User Story 2 — Separate the band from the running total (Priority: P1)

**Goal**: Each threshold shows both its own band count and its cumulative count.

**Independent test**: Two named thresholds on one row over a range with days in each band — band counts are disjoint and each cumulative count equals the sum of the band counts at and beyond it.

- [X] T013 [P] [US2] Add failing tests for the band count in `frontend/tests/unit/services/threshold-exceedance.test.ts`: two stacked `equals-above` rules split the days into disjoint bands (28 lands in the 25 band, 32 in the 30 band) while both count toward the 25 cumulative; a `below`-family rule's band holds the days it colors; a row mixing directions counts each day under whichever rule colors it; band counts sum to the lowest rule's cumulative count.
- [X] T014 [US2] Extend `countExceedances` in `frontend/src/services/threshold-exceedance.ts` with the band count: per day candidate, add the `resolveThreshold` winner to the day's band set, and increment once per set member after the day. A rule filtered out for having no name still participates in the resolution that decides another rule's band.
- [X] T015 [P] [US2] Add failing tests for the measurement row path in `frontend/tests/unit/services/threshold-exceedance.test.ts`: a measurement row yields `min`/`avg`/`max` candidates gated by `show_min`/`show_avg`/`show_max`; a day counts once for a rule that applies to more than one of them; a value of exactly `0` is skipped when `show_zero` is `false` but counted when it is `true` or omitted.
- [X] T016 [US2] Add the measurement row path to `countExceedances` in `frontend/src/services/threshold-exceedance.ts` per [data-model.md](data-model.md), mirroring the renderer's per-role and zero-suppression behaviour exactly.
- [X] T017 [US2] Add the band column to `frontend/src/components/exceedance-table.ts` and extend `frontend/tests/component/exceedance-table.test.ts` to assert both counts render in the documented column order.

**Checkpoint**: Both columns correct for cumulative, expression and measurement rows.

---

## Phase 5: User Story 3 — Consistent counts across views and ranges (Priority: P2)

**Goal**: The same range yields the same numbers in the monthly and the yearly view, across multi-year ranges, and no table in the comparison view.

**Independent test**: Note the counts in the monthly view for a multi-year range, switch to the yearly view without changing the range, and verify every number is unchanged.

- [X] T018 [P] [US3] Add failing tests in `frontend/tests/unit/services/threshold-exceedance.test.ts`: segments spanning two years sum their counts; a year present in `segments` but missing from `statisticsByYear` contributes zero instead of throwing; months excluded from a segment contribute nothing.
- [X] T019 [US3] Confirm or adjust `countExceedances` in `frontend/src/services/threshold-exceedance.ts` so the multi-year and missing-year cases pass without special-casing either view.
- [X] T020 [P] [US3] Add failing tests in `frontend/tests/component/calendar-stats-card.test.ts`: the table renders in the yearly view, is absent while the month comparison is open, and produces identical counts in the monthly and yearly views for the same range.
- [X] T021 [US3] Adjust the render condition in `frontend/src/calendar-stats-card.ts` so the element is emitted in the yearly view and suppressed while the comparison is open.

**Checkpoint**: All three stories complete; FR-014 and SC-004 demonstrably satisfied.

---

## Phase 6: Polish & Cross-Cutting

- [X] T022 [P] Document the table in `docs/README.md` next to the existing threshold and legend documentation, including a short example matching [quickstart.md](quickstart.md).
- [X] T023 Run `npm test`, `npm run lint` and `npm run build` from `frontend/` and confirm all green with no new build warnings beyond the pre-existing `threshold-list-editor.ts:137` TS2352 notice.
- [X] T024 Deploy with `wsl -e bash -lc "cd /mnt/c/Dev/HomeAssistant/tabularizer && ./scripts/deploy.sh"`, verify the deployed bundle's md5 matches the local build, and check against real data per [quickstart.md](quickstart.md): band counts equal the visibly colored days, band counts sum to the lowest threshold's total, and the numbers are unchanged after switching to the yearly view.

---

## Dependencies

```text
Phase 1 (T001)
   └─> Phase 2 (T002–T006)      blocking for everything
          └─> Phase 3 US1 (T007–T012)      MVP
                 └─> Phase 4 US2 (T013–T017)   extends the service and the component from US1
                        └─> Phase 5 US3 (T018–T021)
                               └─> Phase 6 (T022–T024)
```

- US2 and US3 build on the service and component created in US1, so the stories are sequential rather than independent. Each still ends in a shippable, separately verifiable state.
- Within Phase 2, T002/T004/T006 are independent; T003 requires T002 and T005 requires T004.
- Within each story phase, the test task precedes its implementation task — that ordering is non-negotiable (Constitution II).

## Parallel Execution

- **Phase 2**: T002, T004 and T006 touch three different files and can be written together, then T003 and T005 in either order.
- **Phase 3**: T007 and T009 are independent test files; T011 touches a third. Implementation (T008, T010, T012) follows in order because T012 consumes both.
- **Phase 4**: T013 and T015 are separate test additions to the same file — write them together only if edits are coordinated, otherwise sequence them.
- **Phase 5**: T018 and T020 are independent files.

## Implementation Strategy

**MVP**: Phase 1 → Phase 2 → Phase 3. That already delivers a working table with the cumulative count in the monthly view, which answers the user's core question ("how often did this happen?").

**Increments**: Phase 4 makes the answer unambiguous by splitting band from total and covers measurement rows. Phase 5 turns the correctness guarantees into tests and extends the table to the yearly view. Phase 6 documents, verifies and deploys.

**Commit points**: manually after each phase — auto-commit hooks are disabled in this repo (`auto_commit.default: false`).
