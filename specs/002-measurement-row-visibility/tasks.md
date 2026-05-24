# Tasks: Measurement Row Visibility

**Input**: Design documents from `specs/002-measurement-row-visibility/`
**Branch**: `002-measurement-row-visibility`
**Constitution**: TDD is **NON-NEGOTIABLE** — every implementation task is preceded by a test task that must be written first and confirmed failing before implementation begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies within the phase)
- **[US#]**: Which user story this task belongs to
- All commands run in WSL (`bash` tool), from `frontend/`

---

## Phase 1: Foundational (Blocking Prerequisite)

**Purpose**: Type update that all rendering tasks depend on.

**⚠️ CRITICAL**: No rendering work can begin until this phase is complete.

- [ ] T001 Add `show_min?: boolean`, `show_avg?: boolean`, `show_max?: boolean` to `EntityRowConfig` in `frontend/src/types/card-config.ts` (after `show_zero`; do NOT add to `ExpressionRowConfig`)

**Checkpoint**: `npx tsc --noEmit` passes; existing tests still pass (`npm test`)

---

## Phase 2: User Story 1 — Measurement Sub-Row Visibility (Priority: P1) 🎯 MVP

**Goal**: Each of the three measurement sub-rows (min/avg/max) can be individually hidden via config; rowspan adjusts dynamically; all-hidden produces a label-only row.

**Independent Test**: Configure a measurement entity with `show_min: false, show_max: false`. Open dashboard, verify only the avg row is visible; min and max sub-rows absent; summary shows only avg value. Other entities unaffected.

> **TDD**: Write and confirm test FAILS before implementing.

- [ ] T002 [P] [US1] Write failing component tests for measurement sub-row visibility in `frontend/tests/component/year-table.test.ts`:
  - `show_min: false` → min `<tr>` absent; avg and max rows present
  - `show_avg: false` → avg row absent; min and max rows present
  - `show_max: false` → max row absent; min and avg rows present
  - `show_min: false, show_max: false` → only avg row rendered; label cell has `rowspan="1"`
  - `show_min: false, show_avg: false, show_max: false` → single label-only `<tr>` with no day cells and no summary values
  - `show_min: false` → summary column for that entity shows no min value; avg and max summary values still present
  - Default (no flags set) → all 3 sub-rows present and summary shows all three values (regression guard)

- [ ] T003 [P] [US1] Write failing component tests for measurement sub-row visibility in `frontend/tests/component/monthly-table.test.ts` (same scenarios as T002)

- [ ] T004 [US1] Implement measurement sub-row visibility in `frontend/src/components/year-table.ts`:
  - Compute `visibleRows = [cfg.show_min, cfg.show_avg, cfg.show_max].filter(v => v !== false).length`
  - Label cell `rowspan = Math.max(visibleRows, 1)` (dynamic, replacing hard-coded `rowspan="3"`)
  - Wrap each `<tr>` block in conditional: `cfg.show_min !== false`, `cfg.show_avg !== false`, `cfg.show_max !== false`
  - When `visibleRows === 0`: render single `<tr>` with label cell spanning label + sub-label + day columns and summary cell; no data content
  - Summary cell value for each row only rendered when that row is visible (already gated by conditional `<tr>`)

- [ ] T005 [US1] Implement measurement sub-row visibility in `frontend/src/components/monthly-table.ts` (same logic as T004; `monthly-table.ts` uses the same 3-`<tr>` pattern)

**Checkpoint**: US1 acceptance scenarios 1–5 verifiable; T002–T003 tests pass

---

## Phase 3: User Story 2 — Cumulative Summary Visibility (Priority: P1)

**Goal**: For cumulative entities, `show_min/avg/max` hide the corresponding values from the summary column; day column and total are always shown.

**Independent Test**: Configure a cumulative entity with `show_min: false, show_avg: false`. Verify summary column shows only `↑max` and total; day cells unchanged.

> **TDD**: Write and confirm test FAILS before implementing.

- [ ] T006 [P] [US2] Write failing component tests for cumulative summary visibility in `frontend/tests/component/year-table.test.ts`:
  - `show_min: false` on cumulative → `↓min` absent from `div.cumul-summary`; `↑max` and mean still present; total cell unchanged; day cells unchanged
  - `show_avg: false` → mean value absent from `div.cumul-summary`; min/max arrows still present; total cell unchanged
  - `show_max: false` → `↑max` absent from `div.cumul-summary`; mean and min still present; total cell unchanged
  - `show_min: false, show_max: false` → `div.cumul-minmax` absent entirely; mean still present; total shown
  - `show_min: false, show_avg: false, show_max: false` → `div.cumul-summary` absent or empty; total cell still shows value
  - Default (no flags) → mean + `↓min ↑max` all present (regression guard)

- [ ] T007 [P] [US2] Write failing component tests for cumulative summary visibility in `frontend/tests/component/monthly-table.test.ts` (same scenarios as T006; adjust for `monthly-table.ts`'s inline slash-separated summary format)

- [ ] T008 [US2] Implement cumulative summary visibility in `frontend/src/components/year-table.ts` (`renderEntityRows()`, cumulative branch, lines ~244–252):
  - Mean div: render when `cfg.show_avg !== false`
  - Min span (`↓`): render when `cfg.show_min !== false`
  - Max span (`↑`): render when `cfg.show_max !== false`
  - `div.cumul-minmax`: render only when `cfg.show_min !== false || cfg.show_max !== false`
  - If all three hidden: set `summaryContent = ''` (empty string); `totalContent` and day cells unaffected

- [ ] T009 [US2] Implement cumulative summary visibility in `frontend/src/components/monthly-table.ts` (cumulative summary uses slash-separated inline format; apply same conditional flags)

**Checkpoint**: US2 acceptance scenarios 1–7 verifiable; T006–T007 tests pass

---

## Phase 4: Polish

- [ ] T010 [P] Run full test suite (`npm test`) and confirm all tests pass; run `npm run build` and confirm `frontend/dist/tabularizer-card.js` produced without errors; verify no TypeScript errors (`npx tsc --noEmit`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 (type must be defined before rendering logic)
- **US2 (Phase 3)**: Depends on Phase 1; can run in parallel with US2 (different code path — cumulative vs measurement rendering)
- **Polish (Phase 4)**: Depends on all phases complete

### Within Each Phase

1. Tests written and **confirmed FAILING**
2. Implementation written until tests pass
3. Red-Green-Refactor: clean up implementation once green
4. Run `npm test` before moving to next task

### Parallel Opportunities Within Phases

**Phase 2**: T002 and T003 can run in parallel (different test files); T004 after T002 passes; T005 after T003 passes

**Phase 3**: T006 and T007 can run in parallel (different test files); T008 after T006 passes; T009 after T007 passes

**Phases 2 and 3**: Can start in parallel after Phase 1 — measurement rendering (Phase 2) and cumulative rendering (Phase 3) touch different code branches

---

## Parallel Example: Phase 2

```
Parallel batch — write failing tests:
  T002 — year-table measurement sub-row tests
  T003 — monthly-table measurement sub-row tests

Sequential implementation (same-file changes):
  T004 → year-table implementation
  T005 → monthly-table implementation
```

## Parallel Example: Phase 3

```
Parallel batch — write failing tests:
  T006 — year-table cumulative summary tests
  T007 — monthly-table cumulative summary tests

Sequential implementation:
  T008 → year-table cumulative implementation
  T009 → monthly-table cumulative implementation
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: US1 → verify measurement sub-row hiding works
3. **STOP and VALIDATE**: one measurement entity with partial row visibility renders correctly

### Incremental Delivery

1. Phase 1 → types ready
2. Phase 2 → measurement row hiding complete (US1 done)
3. Phase 3 → cumulative summary hiding added (US2 done)
4. Phase 4 → build verified

---

## Notes

- `[P]` tasks: different files, no blocking same-phase dependencies
- `[US#]` maps task to user story for traceability
- All npm commands in WSL via `bash` tool, from `frontend/`
- Conventional Commits: `type(scope): subject`
- TDD is the only accepted workflow: Red → Green → Refactor, no exceptions
- Estimated test count: Phase 2 ≈ 14 tests (7 scenarios × 2 components); Phase 3 ≈ 12 tests (6 scenarios × 2 components)
