# Tasks: Current Month Summary and Total Columns

**Input**: Design documents from `specs/004-current-month-summary/`
**Branch**: `004-current-month-summary`
**Constitution**: TDD is **NON-NEGOTIABLE** — test tasks must be written first and confirmed failing before implementation begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies within the phase)
- **[US#]**: Which user story this task belongs to
- All npm commands run in WSL (`bash` tool), from `frontend/`

---

## Phase 1: TDD — Write Failing Tests

**Purpose**: Write all tests before any implementation. Tests must fail at this stage (the `computeMonthlySummaryFromDailyValues` function does not exist yet, so the import will fail).

> **TDD**: Confirm tests FAIL (`npm test`) before moving to Phase 2.

- [X] T001 [US1] Write failing unit tests for `computeMonthlySummaryFromDailyValues` in `frontend/tests/unit/services/data-transform.test.ts`:
  - Import `computeMonthlySummaryFromDailyValues` from `../../src/services/data-transform` (alongside existing imports)
  - Describe block: `computeMonthlySummaryFromDailyValues`
  - Test 1 — measurement entity: given a `dailyValues` map with 3 measurement entries for `sensor.temp` in `2026-05` (e.g. days 1–3, each with min/mean/max), calling `computeMonthlySummaryFromDailyValues('sensor.temp', 2026, 5, true, false, dailyValues)` returns a `MonthlySummary` with `min = Math.min(...daily mins)`, `mean = avg of daily means`, `max = Math.max(...daily maxes)`, `total = null`
  - Test 2 — cumulative entity: given daily cumulative values for `sensor.energy` in `2026-05`, returns `MonthlySummary` with `total = sum of all daily sums`, `min / mean / max` from those sums
  - Test 3 — precipitation (zero-exclusion): given daily values for `sensor.rain` in `2026-05` including days with `sum = 0`, calling with `isPrecipitation = true` returns `min / mean / max` excluding zero-sum days; `total` includes all days
  - Test 4 — no daily data: given empty `dailyValues` map, returns `null`

**Checkpoint**: Run `npm test` — the new describe block must FAIL (import error) before proceeding.

---

## Phase 2: User Story 1 — Running Monthly Totals for the Current Month (Priority: P1) 🎯

**Goal**: Compute and expose `MonthlySummary` for the current incomplete month for all entity types, using the same rules as complete months.

**Independent Test**: Configure a temperature entity and an energy entity. On any day after the 1st of the current month, the summary and total columns in the current month's table show values computed from completed days.

> **TDD**: T001 must be confirmed failing before T002 begins.

- [X] T002 [US1] Extract `computeMonthlySummaryFromDailyValues` helper in `frontend/src/services/data-transform.ts`:
  - Add exported function signature: `export function computeMonthlySummaryFromDailyValues(entityId: string, year: number, month: number, isMeasurement: boolean, isPrecipitation: boolean, dailyValues: Map<string, DailyValue>): MonthlySummary | null`
  - Move the measurement-branch computation (currently inside `transformMonthlyStats` lines ~162–183) into this function; return `null` when no daily data exists for the month
  - Move the cumulative-branch computation (currently lines ~186–204) into this function; return `null` when `allSums.length === 0`
  - Refactor `transformMonthlyStats` to call `computeMonthlySummaryFromDailyValues` for both branches — behavior for complete months unchanged; existing tests must still pass

- [X] T003 [US1] Add current-month fill-in pass in `frontend/src/tabularizer-card.ts`:
  - Import `computeMonthlySummaryFromDailyValues` from `./services/data-transform`
  - After the expression-row monthly summary loop (currently ~line 235), add a fill-in block:
    - Only when `year === currentYear` (use the already-computed `currentYear` / `currentMonth` values from `this._currentYearMonth()`)
    - For each non-expression entity in `this._config.entities` (i.e., `'entity' in cfg`)
    - Build the key `${entityId}::${year}-${currentMonth}`
    - Skip if `monthlySummaries.has(key)` (don't overwrite if HA did return a monthly record)
    - Call `computeMonthlySummaryFromDailyValues` with the entity's `meta.stateClass === 'measurement'` and `meta.deviceClass === 'precipitation'` flags
    - If the result is non-null, set it in `monthlySummaries`

**Checkpoint**: Run `npm test` — all 4 new tests plus all 202 existing tests must pass.

---

## Phase 3: Polish

- [X] T004 Run full test suite (`npm test`) and confirm all tests pass; run `npm run build` and confirm `frontend/dist/tabularizer-card.js` produced without errors; verify no TypeScript errors (`npx tsc --noEmit`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **TDD (Phase 1)**: No code dependencies — write and confirm failing first
- **US1 (Phase 2)**: Depends on Phase 1 (tests confirmed failing before T002/T003 begin)
  - T002 must complete before T003 (T003 imports the function from T002)
- **Polish (Phase 3)**: Depends on Phase 2

### Within Phase 2

1. T001 tests confirmed FAILING
2. T002: extract helper in `data-transform.ts` → T001 tests now pass
3. T003: fill-in pass in `tabularizer-card.ts` → end-to-end path complete
4. Full suite green before Polish

---

## Implementation Strategy

### MVP (Single Story)

1. Complete Phase 1: Confirm tests fail
2. Complete T002: Helper extracted — unit tests pass
3. Complete T003: Card fill-in — integration path complete
4. Complete Phase 3: Full suite + build verified

### Notes

- `computeMonthlySummaryFromDailyValues` is a pure function — easy to unit test in isolation
- No component changes needed (`year-table` and `monthly-table` render whatever `monthlySummaries` provides)
- The `metadataMap` in `tabularizer-card.ts` already has `stateClass` and `deviceClass` for all entities — no additional data fetching required
- Conventional Commits: `type(scope): subject`
