---
description: "Task list — Default Entity Precision of 1"
---

# Tasks: Default Entity Precision of 1

**Input**: Design documents from `/specs/012-default-entity-precision/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/precision-default.md, quickstart.md

**Tests**: REQUIRED — Constitution II (Test-First, NON-NEGOTIABLE). Every implementation task is preceded by a failing test.

**Organization**: Grouped by user story. US1 (default = 1) is the MVP; US2 (override preserved) is a regression guard.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2
- File paths are repo-relative; all dev commands run in WSL2 from `frontend/`.

## Path Conventions

Single frontend project (HA Lovelace card):
- Source: `frontend/src/`
- Tests: `frontend/tests/`
- Docs: `docs/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a green baseline before any change (TDD requires a known-good starting point).

- [X] T001 Run `npm test` in `frontend/` and confirm the full suite passes; record the baseline (do not start work on a red suite — ask before fixing any pre-existing failure).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Single-source the precision default so both user stories build on one helper.

**⚠️ CRITICAL**: Blocks all user-story implementation. T002 (test) is authored first per TDD; T003 (helper) is the foundational unblocker.

- [X] T002 [P] Write failing unit test for `resolvePrecision` and `DEFAULT_PRECISION` in `frontend/tests/unit/components/year-table.precision.test.ts`: assert `DEFAULT_PRECISION === 1`, `resolvePrecision({}) === 1`, `resolvePrecision({ precision: 2 }) === 2`, `resolvePrecision({ precision: 0 }) === 0`. Confirm RED (symbols not yet exported).
- [X] T003 Add `export const DEFAULT_PRECISION = 1;` and `export function resolvePrecision(cfg: { precision?: number }): number { return cfg.precision ?? DEFAULT_PRECISION; }` at module scope in `frontend/src/components/year-table.ts`. Confirm T002 GREEN.

**Checkpoint**: Helper exists and is unit-tested; the shared formatter can now adopt it.

---

## Phase 3: User Story 1 - Clean default decimals (Priority: P1) 🎯 MVP

**Goal**: Rows without `precision` render every numeric cell at a fixed 1 decimal place.

**Independent Test**: Render `year-table` with one row and no `precision`; daily value `1.234` → `1.2`, summary min/avg/max → one decimal, whole number `5` → `5.0`.

### Tests for User Story 1 ⚠️ (write first, confirm RED)

- [X] T004 [US1] Add failing component test(s) in `frontend/tests/component/year-table.test.ts`: with a cumulative entity row and no `precision`, a day value of `1.234` renders `1.2`; the monthly summary (min/avg/max) renders one decimal each; a whole-number value renders with a trailing `.0`. Confirm RED (current default emits native precision).

### Implementation for User Story 1

- [X] T005 [US1] Replace the shared `nf` formatter default in `frontend/src/components/year-table.ts` (~L196): set both `minimumFractionDigits` and `maximumFractionDigits` to `resolvePrecision(cfg)`, replacing `cfg.precision ?? 20` / `cfg.precision ?? 0`. This single `nf` constant formats every numeric cell (daily L247/256/265, summary L285-287, cumulative summary L359-362, total L366), so the one edit covers all cells for both entity and expression rows.
- [X] T006 [US1] Run `npm test` — confirm T004 and T002 GREEN and no prior test regressed (notably existing `year-table` and editor tests). Investigate any newly-failing baseline test before proceeding.

**Checkpoint**: Unset-precision rows display one decimal everywhere; MVP functional and independently testable.

---

## Phase 4: User Story 2 - Per-row override preserved (Priority: P2)

**Goal**: An explicit `precision` still wins over the new default.

**Independent Test**: Row with `precision: 2` → `1.234` renders `1.23`; row with `precision: 0` → `1.6` renders `2`.

### Tests for User Story 2 ⚠️ (write first, confirm RED or document why already covered)

- [X] T007 [US2] Add component test(s) in `frontend/tests/component/year-table.test.ts`: a row with `precision: 2` renders `1.234` as `1.23`; a row with `precision: 0` renders `1.6` as `2`; a second row with no `precision` in the same render still shows one decimal (mixed-row isolation). Confirm test state (RED if not yet covered).

### Implementation for User Story 2

- [X] T008 [US2] No source change expected — `resolvePrecision` already passes explicit values through the single `nf`. Run `npm test`; if T007 fails, fix the L196 formatter so explicit `precision` (including `0`) is honored. Confirm GREEN.

**Checkpoint**: Override behavior proven intact alongside the new default.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation alignment (FR-006, FR-007, SC-004) and final validation.

- [X] T009 Update `docs/README.md` entity-row table (~L92): change `precision` Default cell from `native` to `1` and reword the description to "Decimal digits shown in day cells and summary columns. Omit to use the default of 1." (remove the "HA's native precision (no rounding)" wording).
- [X] T010 Update `docs/README.md` expression-row table (~L114): change `precision` Default cell from `full` to `1` and reword to "Decimal digits in displayed values. Omit to use the default of 1."
- [X] T011 Audit `docs/README.md` example snippets (~L192–234) for any contradiction with the new default; explicit `precision` examples stay as-is (no change expected per research Finding 4). Note result.
- [X] T012 Run `npm run lint` and `npm run build` in `frontend/`; confirm clean lint and a successful bundle to `frontend/dist/calendar-stats-card.js`.
- [X] T013 Execute `quickstart.md` acceptance mapping (SC-001..SC-004) and confirm each row passes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none — start immediately.
- **Foundational (T002–T003)**: after Setup. T003 blocks the rendering edit; T002 (test) precedes T003.
- **US1 (T004–T006)**: after Foundational. T004 (test) → T005 (impl) → T006 (verify).
- **US2 (T007–T008)**: after Foundational; independently testable. Cleanest after US1 but does not depend on US1 source changes.
- **Polish (T009–T013)**: docs tasks after behavior is final; T012/T013 last.

### Within Each User Story

- Test task written and RED before implementation (Constitution II).
- US1 needs only a single source edit (T005) at the shared `nf`; no same-file conflict.

### Parallel Opportunities

- T002 [P]: independent test file from any other in-flight work.
- T009 and T010 edit the same file (`docs/README.md`, different rows) → run sequentially; not marked [P].

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 baseline → T002/T003 helper → T004 test → T005 impl → T006 verify.
2. STOP and validate: unset rows show one decimal. Demo-ready.

### Incremental Delivery

1. Foundational + US1 → MVP (default = 1).
2. US2 → regression guard for overrides.
3. Polish → README + lint/build + quickstart validation.

---

## Notes

- [P] = different files, no dependencies.
- Verify each test RED before its implementation; verify suite GREEN after.
- No new i18n strings (uses existing `this.lang` in `Intl.NumberFormat`).
- Commit handling is via Speckit hooks; do not commit manually mid-workflow.
