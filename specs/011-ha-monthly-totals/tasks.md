---

description: "Task list — reconcile HA monthly stats with cumulative-row totals"
---

# Tasks: Reconcile HA Monthly Stats With Cumulative Totals

**Input**: Design documents from `/specs/011-ha-monthly-totals/`
**Prerequisites**: plan.md, spec.md (required); research.md, data-model.md, contracts/data-transform.md, quickstart.md (loaded)

**Tests**: REQUIRED. Constitution Principle II (Test-First, non-negotiable) applies. Failing tests precede every behavioural change.

**Organization**: Tasks grouped by user story (US1, US2). Story labels map directly to spec.md.

## Format: `- [ ] [TaskID] [P?] [Story?] Description`

- **[P]**: Parallelizable (different file, no dependency on incomplete task).
- **[StoryID]**: Maps to spec.md user story. Setup/Foundational/Polish carry no story label.

## Path Conventions

Single-project frontend bundle:
- Source: `frontend/src/`
- Tests: `frontend/tests/unit/`, `frontend/tests/component/`

---

## Phase 1: Setup

- [ ] T001 Run `npm test` from `frontend/`; confirm 447/447 green baseline (post-feature-010). If anything is red, stop and report. Also record the current bundle-size baseline for NFR-001: run `npm run build` and capture the byte size of `frontend/dist/calendar-stats-card.js` (e.g. `wc -c < frontend/dist/calendar-stats-card.js`). Store the value for the T022 comparison (T4 resolution).

---

## Phase 2: Foundational

**Purpose**: None required.
US1's data-transform refactor is the shared infrastructure; US2 adds the fetch-range extension + cross-year test on top of it. No separate foundational work needed.

**Checkpoint**: Setup complete → proceed to US1.

---

## Phase 3: User Story 1 — Card is internally consistent about totals (Priority: P1) 🎯 MVP

**Goal**: Switch `MonthlySummary.total` derivation for cumulative entity rows from arithmetic-sum-of-daily-deltas to `HA monthly sum[month] − HA monthly sum[prev_month]` with first-month fallback and per-state-class negative-delta clamp. Align spec 010 FR-004 parenthetical + docs/README + constitution Principle III with the shipping rule.

**Independent Test**: After Phase 3, an entity-row monthly total is reproducible from the public HA API `sum` field using only the prior-month rule + first-month fallback. No daily-value arithmetic required for past complete months (current in-progress month is an explicit edge case — see T012).

### Tests for User Story 1 (write FIRST, confirm RED)

> All US1 tests assume the post-T010 signature `transformMonthlyStats(rawStats, metadataMap, dailyValues, entityConfigs, viewingYear)`.
> Tests fail with a TypeScript compile error until T010 lands — this is the intended RED state (T2 resolution).

- [ ] T002 [US1] In `frontend/tests/unit/services/data-transform.test.ts`, modify the existing test `cumulative monthly total = sum of daily values (unaffected by show_zero — FR-004)` to assert HA-sum-delta semantics: populate `monthlyRaw` entries with realistic `sum` values (e.g. Dec 2024: `sum: 0` baseline, Jan 2025: `sum: 100`, Feb 2025: `sum: 130`); expect `jan?.total === 100` and `feb?.total === 30`. Verify RED.
- [ ] T003 [P] [US1] Add a new test in the same file: `cumulative entity: first tracked month uses sum directly (FR-006)`. Fixture: single monthly entry with `sum: 250`. Expected: total = 250. Verify RED.
- [ ] T004 [P] [US1] Add a new test: `cumulative entity: missing entry.sum → total is null`. Fixture: monthly entry with `sum: undefined` (or absent). Expected: `summary?.total === null`. Verify RED.
- [ ] T005 [P] [US1] Add a new test: `total_increasing entity: negative monthly delta clamps to 0 (FR-002a counter-reset)`. Fixture: two consecutive entries with `sum[m] < sum[m-1]` (e.g. Dec: `sum: 1000`, Jan: `sum: 50` after meter reset). Expected: `total === 0`. Verify RED.
- [ ] T006 [P] [US1] Add a new test: `total entity: negative monthly delta passes through as-is (FR-002a legitimate net export)`. Same fixture shape as T005 but with `stateClass: 'total'`. Expected: `total === -950` (or whatever the negative delta is). Verify RED.
- [ ] T007 [P] [US1] Add a new test: `monthly gap → post-gap month uses sum directly (Research Q2 gap-handling)`. Fixture: entries for Jan and March (Feb missing). Expected: March total = `sum[Mar]` (not `sum[Mar] − sum[Jan]`). Verify RED.
- [ ] T008 [P] [US1] Add a new test: `prev-December raw entry (year-1) does NOT produce a summary entry in the result map`. Fixture: monthly raw includes Dec 2024 + Jan 2025 entries for an entity. Expected: result map contains the `0::sensor.x::2025-1` entry but no `0::sensor.x::2024-12` entry. Verify RED.
- [ ] T008a [P] [US1] Add a regression-guard test in the same file: `measurement entity summary unaffected by HA-sum-delta refactor (FR-003, SC-004)`. Fixture: a `measurement`-state-class entity with daily values (e.g. `sensor.temp` with three days of min/mean/max) and a single monthly raw entry. Pass to `transformMonthlyStats(...)` and assert the returned summary's `min`/`mean`/`max` match the values derived from per-day extremes (commit 58ca61d behaviour); `total` MUST be `null` (measurement entities have no total). The new HA-sum-delta logic MUST be on a code path that is skipped for `isMeasurement === true` rows. Verify GREEN after T009 — this is a regression guard, not a red-first behavioural test (C1 resolution).

**Checkpoint**: Confirm T002–T008 all RED and T008a GREEN before starting T009. Other tests stay GREEN.

### Implementation for User Story 1

- [ ] T009 [US1] In `frontend/src/services/data-transform.ts`, rewrite the entry-processing block inside `transformMonthlyStats` per `contracts/data-transform.md`: after sorting entries by `start`, for each entry derive `(year, month)`; skip entries whose `(year, month)` precedes the viewing year (lookup-only Dec-of-prior-year — viewing year supplied by the new parameter added in T010); compute `total` via `entry.sum`, prev-entry lookup with consecutive-month check, and per-state-class clamp (`Math.max(0, delta)` for `total_increasing`, raw `delta` for `total`). Use `computeMonthlySummaryFromDailyValues(...)` for min/mean/max only — drop its use for `total`. Construct `MonthlySummary` and store via `rowSummaryKey(...)`. (A1 resolution: viewing year always supplied via parameter; no inference from entry contents.)
- [ ] T010 [US1] Add a new `viewingYear: number` parameter to `transformMonthlyStats` signature. Update all call sites (only one in `calendar-stats-card.ts:315` plus test fixtures from T002–T008a) to pass the year. Update `contracts/data-transform.md` "Signature (unchanged)" header → "Signature (`viewingYear` added)" and document the new parameter. (I1 resolution: signature change is in `contracts/data-transform.md`, not `data-model.md` — data-model.md tracks TypeScript types, not function signatures.)
- [ ] T011 [US1] Run `npm test`. Confirm T002–T008 GREEN. If any unrelated test broke, stop and investigate.
- [ ] T012 [US1] Confirm by inspection: the current-month-fill loop in `calendar-stats-card.ts:346` still uses `computeMonthlySummaryFromDailyValues(...)` which produces `total` via arithmetic daily-sum for the in-progress current month. This is the intentional edge-case behaviour from `contracts/data-transform.md` ("interim value; will become HA-sum-delta once the month closes"). No code change required here. Document a one-line note in `data-transform.md` comment near the function definition.

### Doc realignment for User Story 1

- [ ] T013 [US1] Edit `specs/010-precip-show-zero/spec.md` FR-004: drop the parenthetical `(its value continues to come from HA's authoritative monthly statistics)`. Replace the whole FR-004 sentence with: `The monthly **total** column MUST remain unaffected by show_zero (its derivation is governed by feature 011 FR-002).`
- [ ] T014 [US1] Edit `docs/README.md` Behaviour & limits section: keep the existing bullet about "Monthly totals for cumulative entities are sourced from HA's authoritative monthly statistics (sum[month] − sum[prev_month]) and may not exactly equal the arithmetic sum of visible daily cells — this is expected and HA wins." (It's already there from the original 010 docs and now becomes accurate.) Verify the wording matches; no edit needed if already present.
- [ ] T015 [US1] Edit `.specify/memory/constitution.md`: amend Principle III per spec FR-009 — cover all four monthly-derivation paths (cumulative total via HA `sum`-delta with clamp, cumulative min/avg/max via daily values, expression-row totals via arithmetic daily-sum, measurement min/avg/max via daily-value recompute). Bump version `2.0.0` → `2.1.0`. Update `Last Amended` to `2026-05-30`. Prepend a SYNC IMPACT REPORT entry describing the addition (MINOR — clarification, not redefinition).
- [ ] T016 [US1] Verify by grep: `grep -n "arithmetic sum" docs/README.md specs/001-monthly-stats-card/spec.md specs/010-precip-show-zero/spec.md` returns no claim that the rendered total IS an arithmetic sum of daily values for past complete months. `grep -n "sum\[month\] − sum\[prev_month\]\|HA monthly sum" .specify/memory/constitution.md` returns a Principle III match.

**Checkpoint**: US1 acceptance scenarios from spec.md pass. The card's total column for past complete months now matches HA's authoritative monthly figure. All four doc sources describe the same rule.

---

## Phase 4: User Story 2 — Cross-year monthly delta accuracy (Priority: P2)

**Goal**: Extend the monthly fetch range so that January totals can subtract December-of-prior-year, and prove cross-year correctness with a dedicated test fixture.

**Independent Test**: A `total_increasing` entity with multi-year history renders a January total equal to `HA monthly sum[Jan] − HA monthly sum[Dec of prior year]`, not the cumulative-since-tracking-began value.

### Tests for User Story 2 (write FIRST, confirm RED before T019)

- [ ] T017 [US2] Add a new test in `frontend/tests/unit/services/data-transform.test.ts`: `cumulative entity: cross-year January delta uses prev-December sum`. Fixture: entity with monthly entries spanning Dec 2024 (`sum: 500`) and Jan 2025 (`sum: 800`). Expected: Jan total = 300. Pass `viewingYear: 2025` to `transformMonthlyStats`. Confirm RED before T019 (US2 impl). After T019, verify GREEN. (T1 resolution: deterministic ordering — if T017 passes before T019, the US1 refactor accidentally covered the cross-year branch and the boundary between US1 and US2 is misdrawn; investigate.)
- [ ] T018 [P] [US2] Add a test in `frontend/tests/component/calendar-stats-card.test.ts` (or extend an existing one): `monthly fetch range starts at Dec 1 of prior year`. Assert that the mocked `recorder/statistics_during_period` request with `period: 'month'` is called with `start_time: '${year-1}-12-01T00:00:00Z'` (or equivalent). Verify RED before T019.

### Implementation for User Story 2

- [ ] T019 [US2] In `frontend/src/calendar-stats-card.ts:219`, change the monthly fetch's `startTime` parameter: add a new local `const monthlyStartTime = \`${year - 1}-12-01T00:00:00Z\`;` and pass it to `this._service.fetchMonthlyStats(...)` instead of the daily/year `startTime`. Keep the existing `startTime` variable for any other use (or rename to clarify scope).
- [ ] T020 [US2] Run `npm test`. Confirm T017 + T018 GREEN. Confirm US1 tests still GREEN.

**Checkpoint**: US2 acceptance scenarios pass. Cross-year January totals are correct for multi-year entities.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T021 [P] Run `npm run lint` from `frontend/`. Fix any new warnings introduced by the refactor.
- [ ] T022 [P] Run `npm run build` from `frontend/`. Verify the bundle compiles and emits `frontend/dist/calendar-stats-card.js`. Compare bundle size against pre-feature-011 baseline; confirm delta ≤ 2 KB (NFR-001 threshold). If exceeded, stop and investigate.
- [ ] T023 Run `npm test` one final time. Confirm full suite GREEN. Measure wall-clock runtime against the post-feature-010 baseline (~7.86 s); confirm delta ≤ 10 % (NFR-001 threshold). If exceeded, stop and investigate.
- [ ] T024 Execute `specs/011-ha-monthly-totals/quickstart.md` Step 5 manual verification in a real HA instance (optional but recommended before merge): (1) `total_increasing` multi-year entity January total matches HA's official figure; (2) `total` net-energy entity renders negative monthly delta; (3) brand-new entity (≤ 1 month) renders cumulative `sum` as total.

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 Setup: no deps.
- Phase 2 Foundational: skipped.
- Phase 3 US1: depends on Phase 1.
- Phase 4 US2: depends on Phase 3 (US1 refactor is the substrate for US2's cross-year test).
- Phase 5 Polish: depends on Phases 3 + 4.

### Within each story

- Tests RED before implementation.
- Source change after tests.
- `npm test` GREEN before moving to next story.

### Parallel opportunities

| Group | Tasks |
|---|---|
| US1 test additions (different test cases in same file, non-overlapping describes) | T003, T004, T005, T006, T007, T008, T008a |
| US2 test additions | T017, T018 |
| Polish | T021, T022 |

### Critical path

`T001 → T002 → T008a → T009 → T010 → T011 → T019 → T020 → T023`

---

## Parallel Example: User Story 1 test phase

```bash
# Write all new US1 tests in parallel (different test cases in the same file; non-overlapping):
Task: "Add 'first tracked month uses sum directly' test to frontend/tests/unit/services/data-transform.test.ts"
Task: "Add 'missing entry.sum → total null' test to same file"
Task: "Add 'total_increasing negative delta clamps to 0' test to same file"
Task: "Add 'total negative delta as-is' test to same file"
Task: "Add 'monthly gap fallback' test to same file"
Task: "Add 'prev-December lookup-only entry suppressed from result map' test to same file"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 (T001).
2. Phase 3 (T002–T016). At this point past complete monthly totals match HA's authoritative figure; docs/constitution coherent.
3. **Stop and validate**: Manual smoke test on a past month for any cumulative entity.
4. Continue to US2 for cross-year correctness.

### Incremental delivery

- After Phase 3: ship `feat(stats): use HA monthly sum delta for cumulative totals` (US1 MVP).
- After Phase 4: ship `feat(stats): extend monthly fetch for cross-year January delta` (US2 cross-year correctness).
- Or single PR if preferred — the changes are tightly coupled.

---

## Notes

- Test count: +8 new (T003–T008, T008a, T017) + ~1 modified (T002) + 1 component test (T018) = ~10 net.
- Constitution bump: MINOR (2.0.0 → 2.1.0) — Principle III addition.
- No card-config schema change.
- Expression-row totals untouched (FR-008 — no HA monthly stat for formulas).
- Current-month-fill loop untouched (in-progress month total stays arithmetic daily-sum as an accepted edge case).
