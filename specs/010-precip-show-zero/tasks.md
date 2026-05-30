---

description: "Task list — replace hardcoded precipitation zero-exclusion with `show_zero`"
---

# Tasks: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

**Input**: Design documents from `/specs/010-precip-show-zero/`
**Prerequisites**: plan.md, spec.md (required); research.md, data-model.md, contracts/data-transform.md, quickstart.md (loaded)

**Tests**: REQUIRED. Constitution Principle II (Test-First, non-negotiable) mandates failing tests before implementation for every behavioural change in this feature.

**Organization**: Tasks grouped by user story (US1–US4). Story labels map directly to spec.md sections.

## Format: `- [ ] [TaskID] [P?] [Story?] Description`

- **[P]**: Different file, no dependency on an incomplete task — parallelizable.
- **[StoryID]**: Maps to spec.md user story (US1, US2, US3, US4). Setup, Foundational, and Polish tasks have no story label.

## Path Conventions

Single-project frontend bundle. All source paths are relative to the repo root:

- Source: `frontend/src/`
- Tests: `frontend/tests/unit/`, `frontend/tests/component/`
- Translations: `frontend/src/translations/`

---

## Phase 1: Setup

**Purpose**: Verify the green baseline before any new work (per memory `feedback-tdd-run-tests-first`).

- [X] T001 Run `npm test` from `frontend/`; confirm all existing tests pass. If any test is red, stop and report to the user before proceeding.

---

## Phase 2: Foundational

**Purpose**: None required.
The refactor itself lives inside the first user-story phase because the change is a single coordinated rename across two files; splitting it would be artificial.
US2 and US3 add tests on top of the US1 refactor and do not need additional source changes (US3 adds one caller-site change for expression rows).

**Checkpoint**: Setup complete → proceed to US1.

---

## Phase 3: User Story 1 — Precipitation user controls zero-rain via `show_zero` (Priority: P1) 🎯 MVP

**Goal**: Drop the `device_class === 'precipitation'` branch in the monthly-summary pipeline and drive zero-exclusion from per-row `show_zero`.

**Independent Test**: Configure a precipitation entity with `show_zero: false` → summary excludes zero-rain days. Configure same entity with `show_zero: true` (or omitted) → summary includes zero-rain days. Acceptance Scenarios 1 + 2 from US1 in spec.md.

### Tests for User Story 1 (write FIRST, confirm RED)

- [X] T002 [US1] Update the two existing precipitation tests in `frontend/tests/unit/services/data-transform.test.ts` (lines ~274 and ~358 — "precipitation → zero-sum days excluded …" / "precipitation: zero-sum days excluded …") so they invoke `computeMonthlySummaryFromDailyValues` with an explicit `excludeZero: true` derived from a row config `{ show_zero: false }`, not from `device_class: 'precipitation'`. Confirm both go RED after update.
- [X] T003 [P] [US1] Add a new test in `frontend/tests/unit/services/data-transform.test.ts` named `precipitation + show_zero omitted → summary includes zero-sum days (FR-002 default)`. Confirm RED.
- [X] T004 [P] [US1] Add a new test in `frontend/tests/unit/services/data-transform.test.ts` named `all-zero month + show_zero: false → summary min/mean/max are null (FR-006)`. Confirm RED.
- [X] T005 [P] [US1] *No-op confirmed.* Inspected `monthly-table.test.ts` lines ~139, ~864, ~881, ~983: precipMeta fixtures drive *rendering* tests (day cell, label colour, threshold colour). None assert zero-exclusion in monthly summary; all pre-build `MonthlySummary` fixtures directly. No edits needed.
- [X] T006 [P] [US1] *No-op confirmed.* Same finding for `year-table.test.ts` line ~24: precipMeta is metadata for rendering; not piped through summary computation in this test file.
- [X] T007 [P] [US1] *Relocated to `frontend/tests/unit/services/data-transform.test.ts`* — natural home since `transformDailyStats` is where the counter-reset clamp happens. Test asserts that a clamped-zero day and a naturally-zero day are excluded together under `show_zero: false`.
- [X] T007a [P] [US1] Add a new test in `frontend/tests/unit/services/data-transform.test.ts` named `measurement entity (any device_class, any show_zero) → summary computed from per-day min/avg/max; show_zero ignored (FR-007)`. Pass `excludeZero: true` and `excludeZero: false` in two parameterised sub-cases and assert the returned `MonthlySummary` is identical for both. Confirm GREEN immediately (current measurement path ignores the flag) — this test is a regression guard, not a red-first behavioural test.

**Checkpoint**: confirm T002–T007 all RED and T007a GREEN before starting T008. If any test was expected RED but is GREEN, the assertion does not yet bind to the new behaviour — re-examine it before proceeding.

### Implementation for User Story 1

- [X] T008 [US1] In `frontend/src/services/data-transform.ts` rename the 5th parameter of `computeMonthlySummaryFromDailyValues` from `isPrecipitation: boolean` to `excludeZero: boolean`. Function body unchanged (the boolean was already used as an exclude-zero flag).
- [X] T009 [US1] In `frontend/src/services/data-transform.ts` change `transformMonthlyStats` signature to accept a 4th parameter `entityConfigs: EntityConfig[]`. Replace `const isPrecipitation = meta.deviceClass === 'precipitation';` with: lookup of the first matching `EntityRowConfig` by entity ID, then `const excludeZero = matchingCfg?.show_zero === false;` (defaults to `false`/include when no config or `show_zero` omitted). Pass `excludeZero` to `computeMonthlySummaryFromDailyValues` instead of `isPrecipitation`.
- [X] T010 [US1] In `frontend/src/calendar-stats-card.ts` update the `transformMonthlyStats` call (≈ line 315) to pass `this._config.entities` as the 4th argument.
- [X] T011 [US1] In `frontend/src/calendar-stats-card.ts` update the current-month-fill loop (≈ line 346) so the 5th argument passed to `computeMonthlySummaryFromDailyValues` is `cfg.show_zero === false` instead of `meta.deviceClass === 'precipitation'`.
- [X] T012 [US1] Run `npm test`. Confirm tests modified/added in T002–T007a now GREEN. If any unrelated test broke, stop and investigate.

**Checkpoint**: US1 acceptance scenarios 1 and 2 from spec.md pass. The precipitation branch is gone from the data-transform pipeline.

---

## Phase 4: User Story 2 — Any cumulative entity can opt into zero-exclusion (Priority: P2)

**Goal**: Verify that `show_zero: false` excludes zero-sum days from monthly summary for **non-precipitation** cumulative entities (e.g. `device_class: energy`) — a capability unreachable before this feature.

**Independent Test**: Configure a `device_class: energy` entity with `show_zero: false` → monthly summary min/avg/max exclude zero-sum days; monthly total unchanged.

### Tests for User Story 2 (regression guards on the US1 refactor)

> US2 has no separate implementation step — the US1 refactor already generalises the behaviour. These tests verify the generalisation; if any is RED, US1 has a regression that must be fixed before continuing.

- [X] T013 [P] [US2] Add a test in `frontend/tests/unit/services/data-transform.test.ts` named `non-precipitation cumulative (device_class: energy) + show_zero: false → summary excludes zero-sum days (FR-002, SC-004)`. Verify GREEN; if RED, US1 refactor has a regression — fix before proceeding.
- [X] T014 [P] [US2] Add a test in `frontend/tests/unit/services/data-transform.test.ts` named `non-precipitation cumulative + show_zero: false → monthly total still sums all days including zeros (FR-004)`. Verify GREEN; if RED, US1 refactor has a regression — fix before proceeding. After T013+T014 written, run `npm test` and confirm full suite still GREEN with no unrelated regressions.

> T015 removed (merged into T014).

**Checkpoint**: US2 acceptance scenarios from spec.md pass. Both US1 and US2 work independently of `device_class`.

---

## Phase 5: User Story 3 — Expression rows follow the same `show_zero` rule (Priority: P2)

**Goal**: Extend the show_zero-driven summary exclusion to expression rows (their dedicated summary loop in `calendar-stats-card.ts`).

**Independent Test**: Configure an expression row whose daily value is `0` on at least one day with `show_zero: false` → monthly summary excludes that day. With `show_zero: true` (or omitted) → included.

### Tests for User Story 3 (write FIRST, confirm RED)

- [X] T016 [P] [US3] *Relocated to `frontend/tests/unit/services/data-transform.test.ts` (`collectDailySums — show_zero semantic for expression rows (FR-003)`)*. Direct unit test of the helper the expression-row summary loop uses; integration wiring is verified by the production caller plus existing expression-row tests in `calendar-stats-card.test.ts`.
- [X] T017 [P] [US3] *Co-located with T016 in `data-transform.test.ts`*. Verifies default-include behaviour (excludeZero=false → zero days returned).

### Implementation for User Story 3

- [X] T018 [US3] In `frontend/src/calendar-stats-card.ts` update the expression-row summary loop (≈ line 321): derive `const excludeZero = cfg.show_zero === false;` and pass it as the 5th argument to `collectDailySums` instead of the hardcoded `false`.
- [X] T019 [US3] Run `npm test`. Confirm T016 + T017 GREEN.

**Checkpoint**: US3 acceptance scenarios pass. All behavioural FRs (FR-001 through FR-008) satisfied.

---

## Phase 6: User Story 4 — Documentation reflects the new rule (Priority: P1)

**Goal**: Realign all user-visible and contributor-visible documentation with the new generic `show_zero` rule. Bump the constitution version.

**Independent Test**: Read each updated file. (a) `show_zero` description names the dual effect. (b) No precipitation-only auto-exclusion language remains. (c) Constitution Principle III is generic. (d) Editor toggle label reads "Include zero-value days" (en) and the new DE equivalent.

### Implementation for User Story 4

- [X] T020 [P] [US4] Update `frontend/src/translations/en.json`: change `"show_zero": "Show zero-value days"` → `"show_zero": "Include zero-value days"` (FR-013).
- [X] T021 [P] [US4] Update `frontend/src/translations/de.json`: change `"show_zero": "Nullwerttage anzeigen"` → `"show_zero": "Nullwerttage einbeziehen"` (or another semantically equivalent translation matching the new English meaning). Must ship in the same commit as T020 (FR-013).
- [X] T022 [P] [US4] Update `docs/README.md`: (a) in the Entity row option table, change the `show_zero` row description to "If `false`, day cells whose computed value is exactly `0` render as blank AND the monthly summary min/avg/max exclude those zero-value days. Summary `total` is unaffected. Default: `true` (include zero-value days everywhere)."; (b) apply the same change to the Expression row option table; (c) remove the "Smart monthly summary" features bullet that mentions precipitation zero-exclusion, or rewrite it so it no longer claims a precipitation-specific rule.
- [X] T023 [P] [US4] Update `.claude/CLAUDE.md` line 25 (`Monthly summary min/avg/max; for precipitation-like, exclude zero-value days from avg/min/max`) → `Monthly summary min/avg/max for cumulative/expression rows; zero-day inclusion controlled by per-row show_zero (default include).`
- [X] T024 [US4] Update `.specify/memory/constitution.md`: (a) rewrite Principle III to remove the `device_class: precipitation` clause and replace with the generic `show_zero` rule; (b) update version footer `1.0.1` → `2.0.0` and `Last Amended` → `2026-05-30`; (c) prepend a new SYNC IMPACT REPORT entry at the top describing the MAJOR change (Principle III redefinition).
- [X] T025 [US4] Amend `specs/001-monthly-stats-card/spec.md`: append a "### Session 2026-05-30" clarification entry near the bottom of the existing clarifications block noting that FR-016's precipitation-only zero-exclusion rule was superseded by feature 010 (FR-002 / FR-011 in `specs/010-precip-show-zero/spec.md`). Leave FR-016's original text intact for historical record.
- [X] T026 [US4] Verify by grep: `grep -rn "precipitation" docs/README.md` returns no auto-exclusion claim; `grep -rn "device_class: precipitation" .specify/memory/constitution.md` returns zero matches.

**Checkpoint**: US4 acceptance scenarios pass. Docs, governance, and i18n strings are coherent with the new behaviour.

---

## Phase 7: Polish & Cross-Cutting

- [X] T027 [P] Run `npm run lint` from `frontend/`; fix any new lint warnings introduced by the refactor.
- [X] T028 [P] Run `npm run build` from `frontend/`; verify the bundle compiles and emits `frontend/dist/calendar-stats-card.js`.
- [X] T029 Run `npm test` one final time from `frontend/` (full suite, not just the affected files). Confirm GREEN.
- [ ] T030 Execute `specs/010-precip-show-zero/quickstart.md` Step 5 manual verification in a real HA instance (optional but recommended before merge). *Not executed in this session — defer to user.*

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: no deps.
- **Phase 2 Foundational**: skipped (none required).
- **Phase 3 US1**: depends on Phase 1 passing.
- **Phase 4 US2**: depends on Phase 3 (US1 refactor provides the capability tested by US2).
- **Phase 5 US3**: depends on Phase 3 (US1 refactor shape) but is independent of Phase 4. Can run in parallel with Phase 4 if staffed.
- **Phase 6 US4**: independent of Phases 3–5 except for T020/T021 which logically pair with the new behaviour shipping. Doc tasks can be drafted in parallel with implementation; merge them together.
- **Phase 7 Polish**: depends on Phases 3, 5, 6 completing.

### Within each story

- Tests RED before implementation.
- Source change AFTER tests.
- `npm test` GREEN before moving to next story.
- Commit per task or per logical group (per CLAUDE.md commit conventions); never amend during Speckit.

### Parallel opportunities

| Group | Tasks |
|---|---|
| US1 test additions (independent files / non-conflicting locations) | T003, T004, T005, T006, T007, T007a |
| US2 tests (single file, additive) | T013, T014 |
| US3 tests | T016, T017 |
| US4 doc edits (different files) | T020, T021, T022, T023 |
| Polish run | T027, T028 |

### Critical path

`T001 → T002 → T007a → T008 → T009 → T010 → T011 → T012 → T018 → T019 → T024 → T029`

---

## Parallel Example: User Story 1 test phase

```bash
# Write all new/updated US1 tests in parallel (different test files or non-overlapping sections):
Task: "Add test 'precipitation + show_zero omitted → includes zeros' to frontend/tests/unit/services/data-transform.test.ts"
Task: "Add test 'all-zero month + show_zero:false → null summary' to frontend/tests/unit/services/data-transform.test.ts"
Task: "Update precipitation fixtures in frontend/tests/component/monthly-table.test.ts to use show_zero:false"
Task: "Update precipitation fixture in frontend/tests/component/year-table.test.ts to use show_zero:false"
Task: "Add counter-reset uniformity test to frontend/tests/component/monthly-table.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 (T001).
2. Complete Phase 3 (T002–T012). At this point precipitation users can opt in/out via `show_zero` — the core spec value ships.
3. **Stop and validate**: Manual smoke test per quickstart.md Step 5 against a precipitation entity.
4. Continue.

### Incremental delivery

- After Phase 3: US1 acceptance scenarios pass. Could merge as `feat(stats): drive precipitation summary zero-exclusion from show_zero`.
- After Phase 4: US2 capability verified. No additional code; tests prove generalisation.
- After Phase 5: US3 expression-row capability ships. Could merge as `feat(stats): drive expression-row summary zero-exclusion from show_zero`.
- After Phase 6: Docs + governance coherent. Could merge as `docs(spec): align README, constitution, i18n with feature 010`.
- After Phase 7: Polish gates pass.

Single-PR delivery is also acceptable given the tightly-coupled refactor.

---

## Notes

- Test count: ~4 new + ~6 updated (per research.md Q3).
- Constitution bump: MAJOR (1.0.1 → 2.0.0) — Principle III redefinition (research.md Q4).
- Duplicate-entity-row collision is accepted as last-write-wins (research.md Q2).
- No new dependencies, no new files, no schema migration.
- All user-facing strings handled via `localize()` and the two translation files; no hardcoded strings introduced.
