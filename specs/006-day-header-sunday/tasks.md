# Tasks: Day-of-Month Header with Sunday Highlighting

**Input**: Design documents from `specs/006-day-header-sunday/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**TDD**: Constitution II is non-negotiable — all tests written and confirmed failing before implementation.

**Organization**: Two user stories; US2 Sunday bold in `year-table` depends on US1 refactor completing first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label

---

> **Note**: No Phase 1 (Setup) or Phase 2 (Foundational) required — this feature is a rendering-only change to two existing components with no new project structure or shared infrastructure.

## Phase 3: User Story 1 — Day Numbers in Every Month Header (Priority: P1) 🎯 MVP

**Goal**: `year-table` shows day-of-month numbers in every month's header row, not just every 3rd. `monthly-table` already satisfies this requirement — no changes needed there.

**Independent Test**: Render `year-table` with 4+ visible months; every month's header row contains `<th>` cells with day numbers 1–N. The current `i % 3 === 0` suppression is gone.

### Tests for User Story 1

> **Write tests first — confirm they FAIL before touching implementation**

- [x] T001 [US1] Add failing tests "YearTable — day headers present on every month" in `frontend/tests/component/year-table.test.ts`:
  - render with `visibleMonths = [1,2,3,4]`, assert 4th `thead` (January, 31 days) contains exactly 31 `<th>` elements with numeric text 1–31
  - render with `visibleMonths = [2]` (February 2025, 28 days), assert header contains exactly 28 numeric `<th>` elements + 3 pad-cell `<th>` elements

### Implementation for User Story 1

- [x] T002 [US1] Refactor `year-table.ts` render(): move `dayHeaders` generation inside `visibleMonths.map()` loop, generate per-month (days 1–N as `<th>`, days beyond month length as `<th class="pad-cell">`), remove `showDayNumbers`/`i % 3 === 0` variable and the compact fallback branch — `frontend/src/components/year-table.ts`

**Checkpoint**: T001 test passes. All 12 months now show day headers. No other tests regress.

---

## Phase 4: User Story 2 — Sunday Columns Bold (Priority: P2)

**Goal**: In both `monthly-table` and `year-table`, day-of-month header cells that fall on a Sunday have `font-weight: bold` via a `.sunday` CSS class. Non-Sundays are unaffected.

**Independent Test**: For a known month (e.g. January 2025, where Sundays fall on days 5, 12, 19, 26), `querySelectorAll('th.sunday')` returns exactly 4 elements with text content matching those day numbers.

### Tests for User Story 2

> **Write tests first — confirm they FAIL before touching implementation**

- [x] T003 [P] [US2] Add failing tests "MonthlyTable — Sunday header highlighting" in `frontend/tests/component/monthly-table.test.ts`:
  - January 2025: `.day-cell-header` count = 31 (existing behavior guard)
  - January 2025: `th.sunday` text values = exactly [5, 12, 19, 26] (count AND values, not just count)
  - January 2025: day 1 `<th>` does NOT have `.sunday` class
  - February 2025 (28 days): `th.sunday` text values = exactly [2, 9, 16, 23]; pad-cell `<th>` elements carry no `.sunday` class
- [x] T004 [P] [US2] Add failing tests "YearTable — Sunday header highlighting" in `frontend/tests/component/year-table.test.ts`:
  - January 2025: `th.sunday` count = 4, text = 5, 12, 19, 26
  - February 2025: `th.sunday` text = 2, 9, 16, 23
  - Two-month render: each month's Sunday cells are correct independently

### Implementation for User Story 2

- [x] T005 [P] [US2] Add Sunday detection to `monthly-table.ts` day header loop: `const isSunday = new Date(this.year, this.month - 1, d).getDay() === 0;`, apply `${isSunday ? 'sunday' : ''}` to `<th class="day-cell-header ...">`, add `th.sunday { font-weight: bold; }` to `static styles` — `frontend/src/components/monthly-table.ts`
- [x] T006 [US2] Add Sunday detection to `year-table.ts` per-month header loop (requires T002 complete): `const isSunday = new Date(this.year, month - 1, d).getDay() === 0;`, apply `.sunday` class to `<th>` for valid days, add `th.sunday { font-weight: bold; }` to `static styles` — `frontend/src/components/year-table.ts`

**Checkpoint**: T003 and T004 tests pass. Both components bold correct Sunday headers for any month/year combination.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T007 Run full Vitest suite and confirm zero regressions in `frontend/` — `npm test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: No blocking prerequisites — start immediately
- **Phase 4 (US2)**: T005 (monthly-table) can start immediately in parallel with Phase 3. T006 (year-table) depends on T002 (Phase 3 complete).
- **Phase 5**: Depends on all Phase 3 and 4 tasks complete

### User Story Dependencies

- **US1 (P1)**: No dependencies
- **US2 (P2)**: `monthly-table` work (T003, T005) independent. `year-table` work (T004, T006) depends on T002 completing first.

### Within Each User Story

- Tests MUST be written and confirmed failing before implementation
- T001 → T002 (test before impl, US1)
- T003 → T005 (test before impl, monthly-table Sunday)
- T004 → T006 (test before impl, year-table Sunday); T002 must also be complete before T006

### Parallel Opportunities

- T003 and T004 can be written in parallel (different test files)
- T005 and T002 can proceed in parallel (different source files)
- T005 and T006 cannot be parallelized (T006 depends on T002)

---

## Parallel Example: User Story 2

```
# After T002 completes, launch in parallel:
Task T003: failing tests for monthly-table Sunday → frontend/tests/component/monthly-table.test.ts
Task T004: failing tests for year-table Sunday   → frontend/tests/component/year-table.test.ts

# After T003 passes, implement:
Task T005: monthly-table Sunday impl → frontend/src/components/monthly-table.ts

# After T004 passes AND T002 complete:
Task T006: year-table Sunday impl → frontend/src/components/year-table.ts
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 3: T001 → T002
2. Validate: all months show day headers in year-table
3. Demo independently

### Full Delivery

1. Phase 3: T001 → T002
2. Phase 4: T003/T004 in parallel → T005 (after T003) / T006 (after T002+T004)
3. Phase 5: T007

---

## Notes

- [P] tasks = different files, no shared state
- Sunday = `Date.getDay() === 0` — verified correct for all target browsers
- January 2025 Sundays: 5, 12, 19, 26 (use as canonical test fixture)
- February 2025 Sundays: 2, 9, 16, 23 (use as leap-year-safe secondary fixture)
- `monthly-table` already shows all day numbers — US1 has zero changes there
- `year-table` compact header branch (lines 326-329) is deleted entirely by T002
