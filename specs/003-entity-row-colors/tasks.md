# Tasks: Entity Row Color Configuration

**Input**: Design documents from `specs/003-entity-row-colors/`
**Branch**: `003-entity-row-colors`
**Constitution**: TDD is **NON-NEGOTIABLE** — every implementation task is preceded by a test task that must be written first and confirmed failing before implementation begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies within the phase)
- **[US#]**: Which user story this task belongs to
- All npm commands run in WSL (`bash` tool), from `frontend/`

---

## Phase 1: Foundational (Blocking Prerequisite)

**Purpose**: Type extension that all rendering tasks depend on. Expression rows (`ExpressionRowConfig`) share the same cumulative-branch render site as cumulative entity rows — both are covered once the type is extended and the cumulative site reads `cfg.text_color`/`cfg.background_color` directly from `EntityConfig`.

**⚠️ CRITICAL**: No rendering work can begin until this phase is complete.

- [ ] T001 Add `text_color?: string` and `background_color?: string` to both `EntityRowConfig` and `ExpressionRowConfig` in `frontend/src/types/card-config.ts`

**Checkpoint**: `npx tsc --noEmit` passes; existing tests still pass (`npm test`)

---

## Phase 2: TDD — Write All Failing Tests

**Purpose**: Write and confirm ALL tests fail before any implementation code is written. Both US1 (EntityRowConfig) and US2 (ExpressionRowConfig) test tasks are written here because expression rows share the cumulative render branch — US2 tests would pass trivially if written after US1 implementation.

> **TDD**: Confirm each test block FAILS (`npm test`) before moving to Phase 3.

- [ ] T002 [P] [US1] Write failing component tests for EntityRowConfig label cell colors in `frontend/tests/component/year-table.test.ts`:
  - `text_color: "red"` on measurement entity → label cell `style` attribute contains `color:red`; data cells have no `style` attribute
  - `background_color: "#e0f0ff"` on measurement entity → label cell `style` contains `background-color:#e0f0ff`
  - Both `text_color` and `background_color` set → label cell `style` contains both properties
  - Neither `text_color` nor `background_color` set → label cell has no `style` attribute (FR-004)
  - Measurement entity with `rowspan > 1` (default all 3 sub-rows visible): spanned label cell (`td[rowspan]`) has color; sub-label cells have no `style`
  - `text_color` on cumulative entity → `td.label-column` has color style
  - Two entities: only the configured one has `style`; the other's label cell has no `style` attribute (FR-008)

- [ ] T003 [P] [US1] Write failing component tests for EntityRowConfig label cell colors in `frontend/tests/component/monthly-table.test.ts` (same 7 scenarios as T002)

- [ ] T004 [P] [US2] Write failing component tests for ExpressionRowConfig label cell colors in `frontend/tests/component/year-table.test.ts`:
  - `text_color: "green"` on expression row → label cell `style` contains `color:green`
  - `background_color: "#ffe0e0"` on expression row → label cell `style` contains `background-color:#ffe0e0`
  - Neither field set on expression row → label cell has no `style` attribute

- [ ] T005 [P] [US2] Write failing component tests for ExpressionRowConfig label cell colors in `frontend/tests/component/monthly-table.test.ts` (same 3 scenarios as T004)

**Checkpoint**: All 4 test blocks confirmed FAILING before any implementation begins. T002–T005 failing verifies types exist but render sites do not yet apply color styles.

---

## Phase 3: User Story 1 — EntityRowConfig Label Cell Colors (Priority: P1) 🎯 MVP

**Goal**: Apply `text_color`/`background_color` inline styles to all label cells for entity rows. Expression rows (US2) share the cumulative fall-through branch — T004/T005 will also pass once this phase completes.

**Independent Test**: Configure one measurement entity with `background_color: "var(--primary-color)"`, a second with no color. Verify only the first entity's label cell has the background style; data cells unaffected.

> **TDD**: T002 and T003 must be confirmed failing before T006/T007 begin.

- [ ] T006 [P] [US1] Implement label cell color in `frontend/src/components/year-table.ts`:
  - Add `import { ifDefined } from 'lit/directives/if-defined.js';` to imports
  - Compute before each entity render: `const colorParts: string[] = []; if (cfg.text_color) colorParts.push(\`color:${cfg.text_color}\`); if (cfg.background_color) colorParts.push(\`background-color:${cfg.background_color}\`); const labelStyle = colorParts.length ? colorParts.join(';') : undefined;`
  - Apply `style=${ifDefined(labelStyle)}` to all 3 `td.label-column` sites:
    1. Measurement label-only row (`visibleRows.length === 0`) — line ~216
    2. Measurement spanned label cell (`idx === 0`, `rowspan`) — line ~231
    3. Cumulative/expression single row (`colspan`) — line ~276

- [ ] T007 [P] [US1] Implement label cell color in `frontend/src/components/monthly-table.ts` (identical approach; 3 label-cell sites at lines ~166, ~181, ~225)

**Checkpoint**: T002–T005 (all four test blocks including US2) pass. Site 3 (cumulative branch) covers ExpressionRowConfig fall-through — no separate implementation for US2 is required.

---

## Phase 4: Polish

- [ ] T008 [P] Run full test suite (`npm test`) and confirm all tests pass; run `npm run build` and confirm `frontend/dist/tabularizer-card.js` produced without errors; verify no TypeScript errors (`npx tsc --noEmit`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **TDD — Tests (Phase 2)**: Depends on Phase 1 (types must exist before tests reference them)
- **US1 (Phase 3)**: Depends on Phase 2 (tests confirmed failing before implementation)
- **US2**: No separate phase — covered by US1 implementation (expression rows fall through to cumulative branch)
- **Polish (Phase 4)**: Depends on Phase 3

### Within Each Phase

1. Tests written and **confirmed FAILING**
2. Implementation written until tests pass
3. Red-Green-Refactor: clean up implementation once green
4. Run `npm test` before moving to next phase

### Parallel Opportunities Within Phases

**Phase 2**: T002, T003, T004, T005 all [P] — different test files, write in parallel

**Phase 3**: T006 and T007 can run in parallel — different component files

---

## Parallel Example: Phase 2 (All Tests)

```
Parallel batch — write all failing tests:
  T002 — year-table EntityRowConfig tests
  T003 — monthly-table EntityRowConfig tests
  T004 — year-table ExpressionRowConfig tests
  T005 — monthly-table ExpressionRowConfig tests

Confirm all 4 test blocks fail before proceeding.
```

## Parallel Example: Phase 3 (Implementation)

```
Parallel batch — implement both components:
  T006 — year-table: 3 label-cell sites + ifDefined import
  T007 — monthly-table: 3 label-cell sites + ifDefined import
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1: Types ready
2. Complete Phase 2: All tests confirmed failing (both US1 and US2)
3. Complete Phase 3: US1 + US2 implementation (shared branch covers both)
4. **STOP and VALIDATE**: verify `text_color`/`background_color` on one entity renders correctly; other entities unaffected
5. Complete Phase 4: build verified

### US2 Coverage via Shared Branch

ExpressionRowConfig entities fall through to the cumulative rendering branch in `renderEntityRows`/`renderEntityRow` in both components. Once T006/T007 apply `style=${ifDefined(labelStyle)}` to the cumulative `td.label-column` site, expression row colors are automatically covered — no additional implementation required.

---

## Notes

- `[P]` tasks: different files, no blocking same-phase dependencies
- `[US#]` maps task to user story for traceability
- All npm commands in WSL via `bash` tool, from `frontend/`
- Conventional Commits: `type(scope): subject`
- TDD is the only accepted workflow: Red → Green → Refactor, no exceptions
- Estimated test count: Phase 2 ≈ 17 tests (7 + 7 + 3 + 3 scenarios across 4 test blocks / 2 components)
- `ifDefined` is part of `lit/directives/if-defined.js` — no new dependencies needed (Lit 3.2 already installed)
