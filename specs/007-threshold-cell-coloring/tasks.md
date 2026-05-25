---
description: "Task list for threshold-based cell coloring"
---

# Tasks: Threshold-Based Cell Coloring

**Input**: Design documents from `/specs/007-threshold-cell-coloring/`  
**Branch**: `007-threshold-cell-coloring`  
**TDD**: Tests MUST be written and confirmed failing before any implementation code.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New types and the threshold resolver service. All user story phases depend on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Add `ThresholdOperator`, `CellRole`, `ThresholdRule` interfaces/types and `thresholds?` field to `EntityRowConfig` and `ExpressionRowConfig` in `frontend/src/types/card-config.ts`
- [ ] T002 [P] Write failing unit tests for `resolveThreshold` in `frontend/tests/unit/services/threshold-resolver.test.ts`: all 6 operators (≥5 distinct value bands per operator combination), all 8 cell roles, `not-below`/`not-above` filtered for wrong roles, no matching rules returns `undefined`, empty thresholds list, rules with no color fields excluded, closest-wins with 3+ matching rules, tie-break (higher value wins), secondary tie-break (same distance AND same threshold value → first-defined wins)
- [ ] T003 [P] [US4] Write failing unit tests for `buildCellStyle` in `frontend/tests/unit/services/threshold-resolver.test.ts`: static color only (no threshold), threshold overrides both colors, threshold overrides text only (background stays static), threshold overrides background only (text stays static), no static + no threshold → `undefined`, both undefined → `undefined`
- [ ] T004 Implement `frontend/src/services/threshold-resolver.ts` with `resolveThreshold` and `buildCellStyle` until T002 and T003 pass

**Checkpoint**: `npm test` — all resolver unit tests green. No rendering changes yet.

---

## Phase 3: User Story 1 — Single-Level Threshold, Scalar Entity (Priority: P1) 🎯 MVP

**Goal**: Daily value cells for cumulative/expression entities are colored when a threshold matches; static color applies when no threshold matches; missing/pad cells unaffected.

**Independent Test**: Configure a precipitation entity with `above: 10, background_color: "red"` and a static `background_color: "gray"`. Verify: day with value 12 → red; day with value 5 → gray; pad cell → gray; missing data cell → gray.

### Tests

> **Write first. Confirm failing before T007/T008.**

- [ ] T005 [P] [US1] [US4] Write failing component tests for scalar threshold coloring in `frontend/tests/component/year-table.test.ts`: `above`/`below`/`equals-above`/`equals-below` operators fire correctly at boundary values; non-matching threshold → static color; no threshold → static color; missing data → static color; pad cells → static color; threshold partial override (only `background_color` set → static `text_color` preserved)
- [ ] T006 [P] [US1] [US4] Write failing component tests for scalar threshold coloring in `frontend/tests/component/monthly-table.test.ts`: same coverage as T005

### Implementation

- [ ] T007 [US1] Update scalar (cumulative/expression) cell rendering in `frontend/src/components/year-table.ts`: split current single `labelStyle` into `staticStyle` (for label/sub-label/pad cells) and per-cell `buildCellStyle(cfg.text_color, cfg.background_color, resolveThreshold(cellValue, cfg.thresholds ?? [], 'scalar'))` for daily data cells; apply `'summary-scalar'` role to cumulative summary cells; accumulate triggered ThresholdRule objects and dispatch `thresholds-applied` CustomEvent after render
- [ ] T008 [US1] Update scalar (cumulative/expression) cell rendering in `frontend/src/components/monthly-table.ts`: identical changes to T007 (including `thresholds-applied` event dispatch)

**Checkpoint**: `npm test` — T005 + T006 green. Scalar entities show threshold coloring in both year-table and monthly-table.

---

## Phase 4: User Stories 2 + 3 — Multi-Level + Min/Max Special Thresholds (Priority: P2)

**Goal**: Measurement entity cells (min/avg/max sub-rows) are colored per threshold and per cell role. Multiple matching thresholds → closest wins. `not-below` fires only on min cells; `not-above` fires only on max cells; avg cells are unaffected by both.

**Independent Test**: Configure a temperature entity with `above: 20` (orange), `above: 30` (red), `not-below: 20` (background: pink on min cells). Verify: avg cell 22 → orange; max cell 35 → red; min cell 21 → pink (not-below fires) and orange (above: 20 fires) — closest wins; avg cell 5 → no threshold; min cell 5 → no threshold (not-below 20 not met).

### Tests

> **Write first. Confirm failing before T011/T012.**

- [ ] T009 [P] [US2] [US3] Write failing component tests for measurement cell threshold coloring in `frontend/tests/component/year-table.test.ts`: multi-level `above` thresholds on max row (closest wins); `not-below` fires on min cells, not on avg or max; `not-above` fires on max cells, not on avg or min; avg cells evaluate standard operators only; summary-min/summary-avg/summary-max roles follow same role rules; tie-break (equidistant → higher value wins)
- [ ] T010 [P] [US2] [US3] Write failing component tests for measurement cell threshold coloring in `frontend/tests/component/monthly-table.test.ts`: same coverage as T009

### Implementation

- [ ] T011 [US2] [US3] Update measurement (min/avg/max) cell rendering in `frontend/src/components/year-table.ts`: assign `'min'`/`'avg'`/`'max'` roles to daily sub-row cells and `'summary-min'`/`'summary-avg'`/`'summary-max'` to summary cells; call `resolveThreshold` + `buildCellStyle` per cell; label and sub-label cells continue using `staticStyle`; merge measurement triggered rules into the same `thresholds-applied` event dispatched after render
- [ ] T012 [US2] [US3] Update measurement (min/avg/max) cell rendering in `frontend/src/components/monthly-table.ts`: identical changes to T011

**Checkpoint**: `npm test` — T009 + T010 green. All threshold types work for measurement entities.

---

## Phase 5: User Story 5 — Named Thresholds and Card Legend (Priority: P2)

**Goal**: When at least one threshold rule has a `name` field (and has a color), a legend strip appears at the bottom of the card showing all named thresholds in definition order.

**Independent Test**: Configure a temperature entity with named thresholds "Summer day" (above: 25) and "Heat day" (above: 30), plus one unnamed threshold. Verify: legend appears with exactly two entries ("Summer day", "Heat day") in definition order; unnamed threshold absent from legend; removing all names makes legend disappear.

### Tests

> **Write first. Confirm failing before T014/T015.**

- [ ] T013 [US5] Add `"legend": { "title": "Legend" }` to `frontend/src/translations/en.json` and `"legend": { "title": "Legende" }` to `frontend/src/translations/de.json`
- [ ] T014 [US5] Write failing component tests for legend in `frontend/tests/component/tabularizer-card.test.ts`: legend present when ≥1 named threshold fires; absent when named thresholds configured but none triggered; absent when all named rules have no color fields; definition order preserved across triggered rules; name deduplication (first-defined triggered wins); swatch rendered for `background_color`; no swatch when only `text_color` set; `text_color` applied to label; both colors → swatch + colored label; i18n title rendered; `thresholds-applied` event drives legend update

### Implementation

- [ ] T015 [US5] Implement `_buildLegend(triggeredRules: ThresholdRule[])` helper and legend HTML/CSS in `frontend/src/components/tabularizer-card.ts`: listen for `thresholds-applied` CustomEvent from year-table/monthly-table; store triggered rules in `@state() _triggeredThresholds`; pass to `_buildLegend` which filters for named valid rules and deduplicates by name (first-seen); render legend strip with swatch + label after `<year-table>` inside `<ha-card>`; add legend CSS to static styles

**Checkpoint**: `npm test` — T014 green. Legend appears only when ≥1 named threshold fires; absent when none triggered; correct entries in first-triggered order.

---

## Phase 6: Polish & Regression

**Purpose**: Verify no regressions in existing color behavior (spec 003 `text_color`/`background_color` on entity rows still works unchanged).

- [ ] T016 [P] Verify all pre-existing `year-table` tests still pass with no changes required (existing `text_color`/`background_color` path unbroken)
- [ ] T017 [P] Verify all pre-existing `monthly-table` tests still pass (same check)
- [ ] T018 Run full test suite: `npm test` — 0 failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Requires Phase 2 complete
- **US2+US3 (Phase 4)**: Requires Phase 2 complete; independent of Phase 3 (different code paths)
- **US5 (Phase 5)**: Requires Phase 2 complete; T015 also requires T007/T008 for `thresholds-applied` event; T013 must precede T014
- **Polish (Phase 6)**: Requires Phases 3+4+5 complete

### Within Each Phase

- Tests (T002/T003, T005/T006, T009/T010, T014) MUST be written and **confirmed failing** before implementation
- T002 and T003 can run in parallel (same file, different functions — write sequentially or as one test file)
- T005 and T006 can run in parallel (different component files)
- T007 depends on T005 passing; T008 depends on T006 passing
- T009 and T010 can run in parallel
- T011 depends on T009; T012 depends on T010
- T013 must complete before T014 (T014 tests reference i18n keys added in T013)
- T015 depends on T013, T014, and T007/T008 (legend requires `thresholds-applied` event from year-table/monthly-table)

### User Story Independence

- **US1 (Phase 3)**: Independently testable after Phase 2 — scalar entities only
- **US2+US3 (Phase 4)**: Independently testable after Phase 2 — measurement entities only; does not require US1
- **US5 (Phase 5)**: Independently testable after Phase 2 — legend only; does not require Phases 3+4

---

## Parallel Execution Examples

### Phase 2 (Foundational)

```
T001 (sequential — types must exist before tests)
  → T002 [P] resolver tests (resolveThreshold)
  → T003 [P] resolver tests (buildCellStyle)
  → T004 (after T002 + T003 both written and failing)
```

### Phase 3 (US1)

```
T005 [P] year-table scalar tests
T006 [P] monthly-table scalar tests
  → T007 year-table implementation (after T005 failing)
  → T008 monthly-table implementation (after T006 failing)
```

### Phases 3+4+5 in parallel (after Phase 2)

```
Phase 3 (US1):  T005 → T006 → T007 → T008
Phase 4 (US2+US3): T009 → T010 → T011 → T012
Phase 5 (US5):  T013 → T014 → T015 (T015 also requires T007/T008)
```

---

## Implementation Strategy

### MVP (Phase 2 + Phase 3 only)

1. Complete Phase 2: types + resolver
2. Complete Phase 3: scalar entity threshold coloring
3. **Validate**: precipitation entity with `above: 10, background_color: "red"` shows colored cells
4. Ship scalar threshold coloring as functional subset

### Full Feature

1. Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
2. Each phase adds independently testable value
3. Legend (Phase 5) can be shipped before or after measurement coloring (Phase 4)

---

## Notes

- [P] = different files, no incomplete-task dependencies — launch in parallel
- TDD is non-negotiable (Constitution Principle II): red → green → refactor
- `staticStyle` applies to label, sub-label, and pad cells in all phases — do not call `resolveThreshold` on cells without a numeric value
- `CellRole` values are internal to `threshold-resolver.ts` + rendering components — never appear in YAML config
- Existing `text_color`/`background_color` on entity rows (spec 003) must remain fully functional throughout
