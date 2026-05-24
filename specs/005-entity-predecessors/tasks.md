# Tasks: Entity Predecessor Configuration

**Input**: Design documents from `specs/005-entity-predecessors/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Tests**: Mandatory per project constitution (Principle II — Test-First is NON-NEGOTIABLE).
Tests MUST be written and confirmed FAILING before any implementation code.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no inter-task dependency)
- **[Story]**: Maps to user story from spec.md (US1/US2/US3)

---

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Add type definitions and create new file stubs. No behavior yet — these unblock all story phases.

- [x] T001 Add `PredecessorConfig` interface and `predecessors?: PredecessorConfig[]` field to `frontend/src/types/card-config.ts`
- [x] T002 Create `frontend/src/services/predecessor-resolver.ts` with exported `resolvePredecessorData` function stub (returns input `dailyValues` map unchanged; types only, no logic)
- [x] T003 Create `frontend/tests/unit/services/predecessor-resolver.test.ts` with test helper functions (`makeEntityMeta`, `makeDailyValue`) and empty `describe` blocks per story — no test cases yet

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire predecessor support into `tabularizer-card.ts` at the call sites — required before any story's integration is testable.

**⚠️ CRITICAL**: Must complete before story integration tasks (T008) can be verified end-to-end.

- [x] T004 Add `private _warnedPredecessors = new Set<string>()` instance variable to `frontend/src/tabularizer-card.ts`

**Checkpoint**: Scaffolding complete. Story phases can now begin.

---

## Phase 3: User Story 1 — Date-Based Predecessor (Priority: P1) 🎯 MVP

**Goal**: Configure a predecessor with `replaced_on: 'YYYY-MM-DD'`; predecessor data shown strictly before that date, main entity data on and after.

**Independent Test**: Configure one entity with one predecessor and a `replaced_on` date. Confirm predecessor data appears before the date and main entity data appears from the date onwards.

### Tests for User Story 1

> **Write these tests FIRST — confirm they FAIL before implementing T006/T007/T008**

- [x] T005 [US1] Write failing unit tests for date-based resolution in `frontend/tests/unit/services/predecessor-resolver.test.ts`:
  - predecessor data returned for date strictly before `replaced_on`
  - main entity data returned for date equal to `replaced_on` (main wins on exchange date)
  - main entity data returned for date after `replaced_on`
  - cell empty (no predecessor consulted) when main has no data on/after `replaced_on`
  - resolved `DailyValue.entityId` equals main entity ID (not predecessor ID)
  - predecessor data from dates before `replaced_on` is included in monthly summary: verify `computeMonthlySummaryFromDailyValues` for a month spanning the exchange date returns min/max/mean reflecting merged daily values, not main-entity-only days (FR-013/SC-007)
  - all date-based assertions above also pass when entity type is `total_increasing` (cumulative) — predecessor `CumulativeDailyValue` merged correctly (FR-009)

### Implementation for User Story 1

- [x] T006 [US1] Implement date-based predecessor logic in `frontend/src/services/predecessor-resolver.ts`: sort dated predecessors ascending by `replaced_on`; for each date find active predecessor via `sortedDated.find(p => p.replaced_on > date)` algorithm; store resolved value under `${mainEntityId}::${date}` key with `entityId` field rewritten to main entity ID
- [x] T007 [US1] Write failing component test in `frontend/tests/component/tabularizer-card.test.ts` verifying predecessor entity IDs appear in the `statistic_ids` array of the statistics fetch call when `predecessors` is configured
- [x] T008 [US1] Update `frontend/src/tabularizer-card.ts`: (a) include predecessor entity IDs in `entityIds` collection; (b) replace `transformDailyStats(...)` assignment with `resolvePredecessorData(entityConfigs, transformDailyStats(...), metadataMap, _warnedPredecessors)`

**Checkpoint**: User Story 1 fully functional. Entity with one dated predecessor shows continuous data across the replacement date.

---

## Phase 4: User Story 2 — Fallback Predecessor (Priority: P2)

**Goal**: Configure a predecessor without `replaced_on`; predecessor data fills any day where main entity has no data.

**Independent Test**: Configure one entity with one predecessor and no `replaced_on`. Confirm predecessor fills days where main has no data; main wins when both have data.

### Tests for User Story 2

> **Write these tests FIRST — confirm they FAIL before implementing T010**

- [x] T009 [US2] Write failing unit tests for undated fallback logic in `frontend/tests/unit/services/predecessor-resolver.test.ts`:
  - predecessor data used for day where main entity has `EmptyDailyValue`
  - predecessor data used for day where main entity has no entry in map
  - main entity data used when both main and predecessor have data for same day
  - cell empty when main has no data AND predecessor also has no data
  - all fallback assertions above also pass when entity type is `measurement` — predecessor `MeasurementDailyValue` merged correctly (FR-009)

### Implementation for User Story 2

- [x] T010 [US2] Extend `frontend/src/services/predecessor-resolver.ts` with undated/fallback predecessor logic: for days in main entity range with no real data, try each undated predecessor (in config list order); store first non-empty value found under main entity key

**Checkpoint**: User Story 2 functional. Predecessor fills gaps without overriding existing main entity data.

---

## Phase 5: User Story 3 — Chained Predecessors (Priority: P3)

**Goal**: Configure two or more dated predecessors; each covers its correct date range in the chain.

**Independent Test**: Configure one entity with two predecessors, each with a `replaced_on` date. Confirm data from each predecessor appears only in its designated date range.

### Tests for User Story 3

> **Write these tests FIRST — confirm they FAIL before implementing T012**

- [x] T011 [US3] Write failing unit tests for chained predecessor resolution in `frontend/tests/unit/services/predecessor-resolver.test.ts`:
  - two dated predecessors (P2 `replaced_on: 2023-01-01`, P1 `replaced_on: 2024-06-01`): P2 active before 2023-01-01, P1 active 2023-01-01–2024-05-31, main active from 2024-06-01
  - day within P2 range with no P2 data → empty (no further fallback to earlier predecessor)
  - three-predecessor chain resolves correctly at each boundary

### Implementation for User Story 3

- [x] T012 [US3] Verify `frontend/src/services/predecessor-resolver.ts` handles 2+ dated predecessors correctly — the ascending-sort + `find` algorithm already supports chains; run T011 tests to confirm; fix edge cases if any

**Checkpoint**: User Story 3 functional. Full predecessor chains work across arbitrary date ranges.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Compatibility validation, multiple-undated-predecessor ordering, console warnings, and final quality gates.

### Compatibility Check (FR-011 / FR-012)

- [x] T013 [P] Write failing unit tests for compatibility validation in `frontend/tests/unit/services/predecessor-resolver.test.ts`:
  - predecessor with different `stateClass` than main is skipped entirely (not used for any date)
  - predecessor with different `unitOfMeasurement` than main is skipped
  - `console.warn` called with predecessor entity ID when skipped
  - `console.warn` called at most once per predecessor ID per `warnedPredecessors` set instance
  - compatible predecessors (same stateClass + unit) are not warned and are used normally
  - predecessor entity ID absent from `metadataMap` (entity not in `hass.states`) → skipped silently, no crash, no `console.warn` (FR-008)
- [x] T014 Implement compatibility check in `frontend/src/services/predecessor-resolver.ts`: before processing each predecessor, compare `metadataMap[pred.entity].stateClass` and `.unitOfMeasurement` against main entity; if `metadataMap` entry is absent, skip silently without warning (entity hasn't loaded yet); skip incompatible ones; call `console.warn('[tabularizer] predecessor ${id}: state_class or unit_of_measurement mismatch, skipping')` once per ID via `warnedPredecessors` set

### Multiple Undated Predecessors (FR-005 / FR-006)

- [x] T015 [P] Write failing unit tests for multiple undated predecessor ordering in `frontend/tests/unit/services/predecessor-resolver.test.ts`:
  - two undated predecessors: first in list order with data wins
  - two undated predecessors: first has no data, second has data → second used
  - two undated predecessors: neither has data → cell empty
- [x] T016 Extend `frontend/src/services/predecessor-resolver.ts` fallback loop to iterate all undated predecessors in config list order, returning first with non-empty data (no change needed if already implemented this way in T010; confirm test passes)

### Final Quality Gates

- [x] T017 Run `npm test` from `frontend/` in WSL2 — confirm all tests pass (including predecessor-resolver.test.ts and tabularizer-card.test.ts)
- [x] T018 Run `npm run build` from `frontend/` in WSL2 — confirm TypeScript compiles without errors
- [x] T019 Run `npm run lint` from `frontend/` in WSL2 — confirm no lint violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phase 3 (US1)**: Depends on Phase 2 — T005/T006 (unit tests + resolver) can start; T007/T008 need T004 (warnedPredecessors)
- **Phase 4 (US2)**: Depends on Phase 3 complete (resolver exists); T009/T010 extend the resolver
- **Phase 5 (US3)**: Depends on Phase 4 complete; T011/T012 extend multi-predecessor support
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: No story dependencies — builds on scaffolding only
- **US2 (P2)**: Depends on US1 (resolver exists); undated logic extends dated logic
- **US3 (P3)**: Depends on US2; chained logic extends fallback + dated

### Within Each User Story (TDD Cycle)

1. Write tests → confirm FAILING
2. Implement → confirm PASSING
3. Refactor if needed → confirm still PASSING

### Parallel Opportunities

- T001, T002, T003 in Phase 1 can all run in parallel
- T013 and T015 in Phase 6 can run in parallel (same file, different `describe` blocks — or split across two sessions)
- T017, T018, T019 can run in parallel (different commands)

---

## Parallel Example: User Story 1

```bash
# Phase 1 — all in parallel:
Task T001: Add PredecessorConfig to card-config.ts
Task T002: Create predecessor-resolver.ts stub
Task T003: Create predecessor-resolver.test.ts with helpers

# Phase 3 — sequential (TDD cycle):
Task T005: Write failing tests
# Confirm tests FAIL
Task T006: Implement resolver logic
# Confirm T005 tests PASS
Task T007: Write failing component test
# Confirm T007 FAILS
Task T008: Wire into tabularizer-card.ts
# Confirm T007 PASSES
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup scaffolding
2. Complete Phase 2: Foundational wiring
3. Complete Phase 3: US1 (date-based predecessor)
4. **STOP and VALIDATE**: One entity + one predecessor + `replaced_on` date works end-to-end
5. Ship if sufficient

### Incremental Delivery

1. Setup + Foundational → scaffolding ready
2. US1 → date-based predecessor works → MVP
3. US2 → fallback predecessor works
4. US3 → chained predecessors work
5. Polish → compatibility checks, warnings, quality gates

---

## Notes

- [P] tasks = different files or logically independent within same file; no blocking dependencies
- [Story] label traces each task to its user story for coverage tracking
- Constitution Principle II: tests MUST fail before implementation code is written — no exceptions
- `predecessor-resolver.ts` is pure (no side effects except `console.warn` via `warnedPredecessors`); all state managed by caller
- Do NOT modify `data-transform.ts`, `statistics-service.ts`, or any rendering component
