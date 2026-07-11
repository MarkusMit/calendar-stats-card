# Tasks: Threshold Aggregation Scope

**Input**: Design documents from `/specs/015-threshold-scope/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/card-config.md, quickstart.md

**Tests**: Included — TDD is mandatory (constitution Principle II).
Every test task MUST be written and confirmed failing before its implementation task starts.

**Organization**: Tasks are grouped by user story; the resolver/type change is foundational because every story depends on scope-aware resolution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md
- All paths relative to repo root; all commands run in WSL2 from `frontend/`

## Phase 1: Setup

- [X] T001 Confirm green test baseline with `npm test` in `frontend/` (572 tests passing as of 2026-07-11); stop and report if not green

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scope-aware `resolveThreshold` — every user story builds on it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Write failing unit tests for scope filtering in `frontend/tests/unit/services/threshold-resolver.test.ts`: scope-less rule matches only `day` cells; `month`/`year` rules match only their scope; closest-wins and tie-breaks rank within the cell's scope only (mixed-scope list, ≥3 value bands per scope); invalid scope string behaves as `day`; `not-below`/`not-above` role exclusions unchanged within each scope
- [X] T003 [P] Add `ThresholdScope` type and `ThresholdRule.scope?: ThresholdScope` in `frontend/src/types/card-config.ts` per data-model.md
- [X] T004 Add `cellScope: ThresholdScope` parameter, scope normalization (unknown → `'day'`), and scope pre-filter to `resolveThreshold` in `frontend/src/services/threshold-resolver.ts` (filter joins the existing colorless-rule filter, before distance ranking)
- [X] T005 Update every existing `resolveThreshold` call site to pass explicit `'day'` (compile-green, behavior identical for day cells) in `frontend/src/components/year-table.ts`, `frontend/src/components/year-summary-table.ts`, `frontend/src/components/month-comparison-table.ts`
- [X] T006 Run `npm test` — T002 tests green, no regressions

**Checkpoint**: Resolver is scope-aware; all cells still evaluate as `day` (no behavior change yet).

---

## Phase 3: User Story 1 - Daily thresholds stop firing on monthly totals (Priority: P1) 🎯 MVP

**Goal**: Scope-less (day) rules no longer color month-scale cells in the yearly and comparison views.

**Independent Test**: Cumulative row with `above: 10` (no scope), monthly totals ~100: yearly view month cells, cumulative year rollup, and comparison value/average cells show NO threshold coloring; monthly-view daily cells and all measurement cells keep their coloring.

- [X] T007 [P] [US1] Write failing component tests in `frontend/tests/component/year-summary-table.thresholds.test.ts`: day rule does not color cumulative month cells (spec US1-AS1) nor the cumulative year rollup (US1-AS4); measurement month cells keep day-rule coloring (US1-AS5)
- [X] T008 [P] [US1] Write failing component tests in `frontend/tests/component/month-comparison-table.test.ts`: day rule does not color cumulative summary values or the cross-year average (US1-AS3); measurement cells keep day-rule coloring
- [X] T009 [US1] Pass `'month'` as cell scope for cumulative month cells and the cumulative year rollup in `frontend/src/components/year-summary-table.ts` (sites at former lines 408 and 435)
- [X] T010 [US1] Pass `'month'` (cumulative/expression rows) vs `'day'` (measurement rows) for summary values and cross-year average in `frontend/src/components/month-comparison-table.ts` (sites at former lines 256 and 284)
- [X] T011 [US1] Run `npm test` — T007/T008 green, monthly-view tests unchanged (US1-AS2 covered by existing suite)

**Checkpoint**: The reported defect is fixed; MVP deliverable.

---

## Phase 4: User Story 2 - Flag notable months with month-scope thresholds (Priority: P2)

**Goal**: `scope: month` rules color monthly-total cells everywhere, including the monthly view's Total column (newly colorable).

**Independent Test**: Cumulative row with `above: 150, scope: month`: yearly-view month cells >150 colored, ≤150 not; comparison values >150 colored; monthly-view Total column colored when the month qualifies; daily cells never colored by the month rule.

- [X] T012 [P] [US2] Write failing component tests in `frontend/tests/component/year-summary-table.thresholds.test.ts`: month rule colors exactly qualifying month cells (US2-AS1/AS2) and the cumulative rollup; named month rule appears in triggered legend groups; and in `frontend/tests/component/month-comparison-table.test.ts`: month rule colors qualifying comparison cells (US2-AS4)
- [X] T013 [P] [US2] Write failing component tests for the monthly view in `frontend/tests/component/` (extend the existing year-table test file or create `year-table.thresholds.test.ts`): Total column colored by month rule (US2-AS3), never by day rule; daily cells never colored by month rule (US2-AS5)
- [X] T014 [US2] Evaluate the Total column in `frontend/src/components/year-table.ts` (replace static-only `cumulTotalStyle` with `resolveThreshold(total, thresholds, 'scalar', 'month')` + `buildCellStyle` + `_addTriggered`, mirroring the neighboring summary cell)
- [X] T015 [US2] Run `npm test` — T012/T013 green (yearly/comparison month-scope behavior flows from the T009/T010 sites; verify, don't re-implement)

**Checkpoint**: Month-scope rules fully functional across all three views.

---

## Phase 5: User Story 3 - Flag notable years with year-scope thresholds (Priority: P3)

**Goal**: `scope: year` rules color the yearly view's Total column (newly colorable); nothing else.

**Independent Test**: Cumulative row with `above: 1200, scope: year`: yearly Total 1300 colored, 900 not; no month or daily cell ever colored by it.

- [X] T016 [P] [US3] Write failing component tests in `frontend/tests/component/year-summary-table.thresholds.test.ts`: year rule colors qualifying yearly Total cells only (US3-AS1/AS2); year rule never colors month cells; month/day rules never color the yearly Total (US3-AS3)
- [X] T017 [US3] Evaluate the yearly Total column in `frontend/src/components/year-summary-table.ts` (replace static-only `cumulTotalStyle` with `resolveThreshold(total, thresholds, 'scalar', 'year')` + `buildCellStyle` + `_addTriggered`)
- [X] T018 [US3] Run `npm test` — T016 green, no regressions

**Checkpoint**: All three scopes gate correctly in every view.

---

## Phase 6: User Story 4 - Configure the scope in the visual editor (Priority: P3)

**Goal**: Per-rule scope dropdown (Day/Month/Year, default Day, en+de) in the threshold editor.

**Independent Test**: Open editor, rule without scope shows Day; select Month → change event carries `scope: 'month'`; German UI shows Tag/Monat/Jahr.

- [ ] T019 [P] [US4] Write failing component tests in `frontend/tests/component/threshold-list-editor.test.ts`: scope `select` with `data-field="scope"` present per rule; displays Day for scope-less rules; change dispatches `thresholds-changed` with updated `scope`; option labels localized (en: Day/Month/Year, de: Tag/Monat/Jahr)
- [ ] T020 [P] [US4] Add translation keys `editor.threshold_scope` and `threshold.scopes.day|month|year` to `frontend/src/translations/en.json` and `frontend/src/translations/de.json`
- [ ] T021 [US4] Add the scope dropdown to `frontend/src/components/threshold-list-editor.ts` (same field markup as the operator select; localized via `threshold.scopes.*`)
- [ ] T022 [US4] Run `npm test` — T019 green, no regressions

**Checkpoint**: All user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Document the `scope` field in `README.md` threshold configuration section (YAML example per contracts/card-config.md)
- [ ] T024 Run `npm run lint` and `npm run build` in `frontend/`; fix any findings
- [ ] T025 Execute quickstart.md verification: full `npm test`, then manual HA dashboard check with a day+month+year rule set on a precipitation row

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; BLOCKS all user stories (resolver signature change touches every component).
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after Phase 2; the yearly/comparison assertions reuse the sites changed in US1, so run after Phase 3.
- **US3 (Phase 5)**: after Phase 2; independent of US1/US2 (own column, own site).
- **US4 (Phase 6)**: after Phase 2; independent of US1–US3 (editor only).
- **Polish (Phase 7)**: after all desired stories.

### Within Each Story

- Test task(s) first, confirmed failing, then implementation, then suite run.
- T003 may run parallel to T002 (different files); T004 depends on both; T005 depends on T004.

### Parallel Opportunities

- T007 + T008 (different test files); T012 + T013; T019 + T020.
- After Phase 3: US3 (T016–T018) and US4 (T019–T022) can proceed in parallel with US2.

---

## Implementation Strategy

MVP = Phases 1–3 (the bug fix).
Each later phase is an independently testable increment: US2 (month rules + monthly Total), US3 (year rules + yearly Total), US4 (editor).
Commit after each phase (manual conventional commits — auto-commit hooks are disabled).
