# Tasks: Floating Bottom Navigation Bar

**Input**: Design documents from `specs/008-floating-bottom-nav/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: TDD is mandatory (Constitution II). Test tasks MUST be written and confirmed FAILING before any implementation task in the same story begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1, US2)
- File paths are relative to repository root

---

## Design Guarantees (no automated test possible)

The following requirements are satisfied structurally by the flex-column layout and cannot be validated by Vitest/happy-dom (which does not compute CSS layout). They require **manual visual QA** (see T012):

- **FR-003** — bar visible without scrolling (bar is a flex sibling, never scrolls out of view)
- **FR-004** — bar never overlaps table rows (flex children cannot overlap without explicit negative margins)
- **FR-005** — bottom space reserved when no legend (`.card-content` auto-shrinks to card height − bar height)
- **FR-010** — bar anchored to card not viewport (`position: fixed` is not used; bar is in normal flex flow)
- **SC-002** — zero rows obscured (corollary of FR-004)

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm all pre-existing tests pass before any changes land.

- [x] T001 Run `npm test` in `frontend/` and confirm all existing tests pass (establishes regression baseline)

---

## Phase 2: User Story 1 — Year Navigator Moves to Floating Bottom Bar (Priority: P1) 🎯 MVP

**Goal**: Remove year navigator from card header; render it in a floating bar anchored to the card's bottom. Table and legend remain fully readable.

**Independent Test**: Load card → year navigator visible at bottom, absent from top → previous/next year navigation works → no table data obscured.

### Tests for User Story 1

> **⚠️ Write these FIRST. Run `npm test` and confirm each new test FAILS before writing any implementation.**

- [x] T002 [US1] Write failing test: `shadowRoot.querySelector('.bottom-bar')` is not null in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T003 [US1] Write failing test: `year-navigator` is a descendant of `.bottom-bar` (not top-level `ha-card` child) in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T004 [US1] Write failing test: no `year-navigator` exists outside `.bottom-bar` in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T005 [US1] Write failing test: `year-table` is a descendant of `.card-content` in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T006 [US1] Write failing test: `year-changed` event dispatched from `.bottom-bar`'s `year-navigator` still updates the card's displayed year in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T007 [US1] Write failing test: `.bottom-bar` element has `border-top` style and `background` style containing HA CSS token (`--ha-card-background` or `--card-background-color`) — covers FR-007 in `frontend/tests/component/calendar-stats-card.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Add CSS for `ha-card` (flex column; `overflow: hidden` removed per research Decision 6), `.card-content` (`flex: 1 1 0; min-height: 0; overflow: auto; padding: 8px`), and `.bottom-bar` (flex center, HA design tokens: `--ha-card-background`, `--divider-color`, upward shadow) in `frontend/src/calendar-stats-card.ts`
- [x] T009 [US1] Restructure `render()`: wrap `year-table` + `_buildLegend()` in `<div class="card-content">`; move `<year-navigator>` (with all existing bindings unchanged) into `<div class="bottom-bar">` in `frontend/src/calendar-stats-card.ts`

**Checkpoint**: Run `npm test`. All T002–T007 tests must now pass. Year navigation must work visually.

---

## Phase 3: User Story 2 — Legend Co-exists with Floating Bar (Priority: P2)

**Goal**: Confirm the threshold legend renders inside `.card-content` (document flow, not inside the bar). Flex layout prevents bar from ever covering the legend.

**Independent Test**: Configure entity with named thresholds → legend appears fully visible → floating bar does not overlap legend.

### Tests for User Story 2

> **⚠️ Write these FIRST. Confirm FAILING before implementation.**

- [x] T010 [US2] Write failing test: when named thresholds are triggered, `.legend` element is a descendant of `.card-content` (not of `.bottom-bar`) in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T011 [US2] Write failing test: when named thresholds are triggered, `.card-content` contains both a `year-table` descendant and a `.legend` descendant in `frontend/tests/component/calendar-stats-card.test.ts`

**Checkpoint**: Run `npm test`. T010–T011 should already pass after T009 placed `_buildLegend()` inside `.card-content`. If not, fix legend placement in `frontend/src/calendar-stats-card.ts`.

---

## Phase 4: Polish & Regression

**Purpose**: Visual QA for CSS layout guarantees + full regression.

- [ ] T012 Manual visual QA: load card in HA → confirm `.bottom-bar` style matches HA Energy dashboard (background fill, top border, upward shadow, SC-004); confirm FR-003/FR-004/FR-005/FR-010 visually (no overlap, no scroll needed, bottom space correct) — no code artifact, acceptance: checklist signed off
- [x] T013 Run full test suite `npm test` in `frontend/` and confirm all tests pass (all pre-existing 348 + new T002–T011)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 ✅
- **Phase 3 (US2)**: Depends on Phase 2 ✅ (T008/T009 create `.card-content` which US2 tests verify)
- **Phase 4 (Polish)**: Depends on Phase 3 ✅

### Within Each User Story

1. All test tasks for a story written and confirmed **FAILING**
2. Implementation tasks written
3. Tests now **PASS**
4. Move to next story

### Parallel Opportunities

- T002–T007 are all additions to the same test file — write sequentially
- T008 and T009 both modify `calendar-stats-card.ts` — write sequentially
- T010–T011 are additions to the same test file — write sequentially

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. T001 — baseline verification
2. T002–T007 — failing tests (TDD red)
3. T008–T009 — implementation (TDD green)
4. Checkpoint: US1 complete and independently testable

### Full Delivery (Both Stories)

1. MVP above
2. T010–T011 — failing tests for US2
3. Checkpoint: US2 tests pass (likely no code change needed)
4. T012 — visual QA
5. T013 — full regression

---

## Notes

- All tasks touch at most 2 files: `calendar-stats-card.ts` (implementation) + `calendar-stats-card.test.ts` (tests)
- No new source files, no new dependencies, no new `@state()` fields
- `year-navigator.ts` and all other components are **unchanged**
- `overflow: hidden` removed from `ha-card` per research Decision 6; `.card-content { overflow: auto }` provides equivalent clipping
- The flex-column layout automatically satisfies FR-005/FR-006 (no JS height measurement needed)
- T010/T011 may pass immediately after T009 with no additional implementation — this is expected
