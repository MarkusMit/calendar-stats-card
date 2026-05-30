# Feature Specification: Reconcile HA Monthly Stats With Cumulative Totals

**Feature Branch**: `011-ha-monthly-totals`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User description: "HA monthly statistics are fetched but discarded for cumulative totals. Decide whether to use HA's monthly sum field for the total column (matching spec 001 FR-011) or drop the fetch entirely and align the specs with the daily-sum behaviour the implementation already ships. Preserve the existing measurement min/max recompute from daily values (commit 58ca61d) — HA's period=month returns min/max of period-means, not true daily extremes. No public config schema change."

## Clarifications

### Session 2026-05-30

- Q: Which derivation rule for the monthly cumulative-total column? Use HA's `sum` field (Option A) or drop the fetch and keep daily-sum arithmetic (Option B)? → A: **Option A** — total = `HA monthly sum[month] − HA monthly sum[prev_month]`, with `HA monthly sum[earliest]` as the first-tracked-month fallback.
  Matches the existing spec 001 FR-011 text.
  Implementation switches to read the previously-discarded `sum` field; cross-year boundary requires fetching one extra prior month.
  Rendered totals MAY now differ from the arithmetic sum of visible daily cells (spec 001 already permits this).
- Q: How should a negative monthly delta render? Mirror spec 001 FR-015 daily-delta rule, or different? → A: Mirror it.
  For `total_increasing` entities a negative monthly delta is a counter-reset anomaly and MUST be clamped to `0`.
  For `total` entities a negative monthly delta is legitimate (e.g. net export exceeded import for the month) and MUST be shown as-is.
  Keeps monthly-total semantics symmetric with daily-cell semantics; no new clamping rule introduced.
- Q: Constitution version bump scope — MAJOR, MINOR, or PATCH? → A: **MINOR** (2.0.0 → 2.1.0).
  Principle III gains an explicit cumulative-total derivation rule it previously did not state.
  Treated as added clarification rather than backward-incompatible redefinition because the implementation never had Principle III as the authority for monthly-total source (spec 001 FR-011 was).
  Sync-impact-report entry required per amendment procedure.
- Q: Add a falsifiable Non-Functional Requirement section mirroring feature 010's NFR-001? → A: Yes.
  Same three thresholds: bundle size delta ≤ 2 KB, test runtime delta ≤ 10 %, complexity unchanged at `O(D × R)`.
  Keeps the per-feature falsifiable rejection criterion precedent; breach blocks merge.
- Q: Scope of Constitution Principle III amendment — also fold in the measurement-recompute rule (HA `period=month` min/max are unreliable; recompute from daily values; spec 001 FR-010 + commit 58ca61d) for completeness? → A: Yes — Option A.
  Single coherent Principle III edit replaces two future amendments.
  Final scope: cumulative-row monthly total → HA `sum` delta (FR-002); negative-delta clamp per FR-002a; cumulative-row monthly min/avg/max → derived from daily values (per show_zero, established in feature 010 Principle III); expression-row totals + min/avg/max → arithmetic daily sum (no HA monthly stat exists for expressions); measurement-row monthly min/avg/max → recomputed from daily values, HA's period=month min/max fields MUST NOT be used because they report min/max of period-means.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Card is internally consistent about where totals come from (Priority: P1)

A contributor reading any of `specs/001-monthly-stats-card/spec.md` (FR-011), `specs/010-precip-show-zero/spec.md` (FR-004), `frontend/src/services/data-transform.ts`, and the rendered card sees ONE coherent rule for how the monthly total column is derived for cumulative (`total_increasing` / `total`) entity rows.
Today the four sources disagree: spec 001 and spec 010 both say "from HA's authoritative monthly statistics", the code sums per-day deltas, and the network layer fetches the monthly stats but discards the values.

**Why this priority**: The inconsistency blocks future work — any contributor trying to fix a totals-related bug has to decide which source of truth to follow.
P1 because resolution is small and unlocks coherence across the documentation set.

**Independent Test**: After this feature ships, read FR-011, FR-004, `data-transform.ts`, and any code that fetches monthly stats.
Verify all four state (and do) the same thing.
Verify the rendered total column value matches the rule the docs describe.

**Acceptance Scenarios**:

1. **Given** the spec set after merge, **When** a contributor greps for "monthly total" or "monthly sum", **Then** every match describes the same derivation rule (either "HA monthly delta `sum[month] − sum[prev_month]`" OR "arithmetic sum of per-day deltas" — whichever option is chosen).
2. **Given** a cumulative entity with N days of data, **When** the card renders the monthly total, **Then** the displayed value matches the rule documented in spec 001 FR-011 and spec 010 FR-004 (no silent divergence).
3. **Given** the chosen rule, **When** the card loads, **Then** the network and CPU work it performs matches the rule (no fetched-and-discarded payload; no extra work that the docs do not justify).

---

### User Story 2 — Cross-year monthly delta accuracy (Priority: P2)

The total for **January of each year** correctly reflects the January delta (not the cumulative sum-since-tracking-began).

**Why this priority**: With `sum[month] − sum[prev_month]` semantics, January needs the previous December's `sum` as `prev_month`.
That requires fetching one extra month before the requested year, or special-casing the first-of-year boundary.

**Independent Test**: Configure a `total_increasing` electricity meter that started in November of a previous year.
View January of any subsequent year.
Verify the total shows January's delta (e.g. ~300 kWh), not the cumulative-since-November-of-the-prior-year (e.g. ~2000 kWh).

**Acceptance Scenarios**:

1. **Given** an entity with multi-year history, **When** the card renders January, **Then** the total = `HA monthly sum[Jan] − HA monthly sum[Dec of previous year]`.
2. **Given** the earliest tracked month of an entity, **When** the card renders that month, **Then** the total = `HA monthly sum[earliest]` directly (no `prev_month` exists), matching spec 001 FR-011's explicit rule for the first month.
3. **When** the rendered total is compared to the arithmetic sum of visible daily cells, **Then** they may differ (spec 001 explicitly permits this); the rendered total is authoritative.

---

### Edge Cases

- An entity whose HA monthly `sum` field is missing or `undefined` for the requested month (corrupted stats, partial data, or month not yet finalised): the total cell MUST render as empty / `—` (same convention as other missing-data cells per spec 001 FR-019). The arithmetic daily sum MUST NOT be substituted as a fallback (would silently mask the data-quality issue).
- Cross-year fetch interacts with the existing earliest-data-year logic; the prev-month fetch MUST NOT extend before the entity's earliest recorded data. For the earliest tracked month of an entity, FR-006's `sum[earliest]` rule applies.
- An entity with very recent statistics (only the first tracked month so far): `sum[earliest]` rule kicks in, rendering the total = the current cumulative sum since tracking began.
- A user upgrading from feature 010 to this feature: rendered totals MAY change (Option A semantics may yield different numbers than the previous daily-sum arithmetic, particularly when there are mid-day gaps that biased the daily-sum computation). No card-config migration is required.
- The existing measurement min/max recompute from daily values (commit `58ca61d`) MUST NOT regress; it is a separate concern from the cumulative-total question.
- Expression rows continue to use arithmetic daily-sum for their totals (no HA monthly stat exists for expressions); the derivation rule for expression rows is unchanged by this feature (FR-008).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After this feature ships, all of the following sources MUST describe the same rule for monthly cumulative totals: `specs/001-monthly-stats-card/spec.md` FR-011, `specs/010-precip-show-zero/spec.md` FR-004, the implementation in `frontend/src/services/data-transform.ts` and `frontend/src/calendar-stats-card.ts`, and any test that asserts a total value.
  No two sources may contradict each other on the derivation rule.
- **FR-002**: The monthly cumulative-total column MUST be derived as `HA monthly sum[month] − HA monthly sum[prev_month]`, where both values come from the existing `recorder/statistics_during_period` `period: 'month'` fetch (Option A, per Clarifications 2026-05-30).
  The rendered total MAY differ from the arithmetic sum of visible daily cells; the spec accepts this divergence and treats the HA-sourced value as authoritative.
  Daily-sum arithmetic MUST NOT be used as a fallback when HA's `sum` is present.
- **FR-002a**: Negative monthly delta handling MUST mirror spec 001 FR-015's daily-delta rule (per Clarifications 2026-05-30).
  For `total_increasing` state-class entities, a negative monthly delta (cumulative `sum[month] < sum[prev_month]`) is a counter-reset anomaly and MUST be clamped to `0` before rendering.
  For `total` state-class entities, a negative monthly delta is legitimate (e.g. net export exceeded import that month) and MUST be rendered as-is.
  The clamp rule applies symmetrically to the first-month fallback (`sum[earliest]` for `total_increasing` is always ≥ 0 by definition, so no clamp required there in practice).
- **FR-003**: The card MUST NOT regress the measurement min/max recompute from daily values established by commit `58ca61d`.
  HA's `period=month` `min`/`max` fields MUST continue to be ignored for `measurement` state-class entities because they report min/max of period-means, not true intra-day extremes.
- **FR-004**: The card MUST NOT introduce any user-facing configuration schema change.
  Existing card configurations MUST load and render after this change without modification.
- **FR-005**: All affected specs and contributor docs (`specs/001-monthly-stats-card/spec.md` FR-011, `specs/010-precip-show-zero/spec.md` FR-004, `docs/README.md` if it mentions total derivation, `.claude/CLAUDE.md` if applicable) MUST be updated as part of this feature so that the documented behaviour matches the shipping behaviour.
- **FR-006**: The implementation MUST handle the first tracked month of an entity (no previous month available) by using `HA monthly sum[earliest]` directly, per spec 001 FR-011's explicit rule for the first-month case.
- **FR-007**: The cross-year boundary MUST be handled by extending the monthly-stats fetch range to include one extra month before the requested year (so that January of year N can subtract December of year N−1).
  When the requested year is the earliest-data-year for an entity, the prior month fetch returns no entry and FR-006's first-month rule applies.
- **FR-008**: For expression rows, the monthly total derivation rule is out of scope of this feature.
  Expression rows compute their own daily values (from the formula), and the current arithmetic-sum-of-daily-values approach for expression-row totals is retained unchanged.
  This is because HA does not store HA-monthly-period statistics for expression formulas.
- **FR-009**: Constitution Principle III (Density & Data Fidelity) MUST be amended to document the FULL set of monthly-summary derivation rules in one place (per Clarifications 2026-05-30 — folded scope).
  The amendment MUST cover:
  - **Cumulative entity rows (`total_increasing` / `total`)** — monthly **total** = `HA monthly sum[month] − HA monthly sum[prev_month]`; `sum[earliest]` fallback for the first tracked month; negative-delta clamp for `total_increasing` (counter reset); negative-delta as-is for `total` (per FR-002a).
  - **Cumulative entity rows** — monthly **min/avg/max** derived from daily values, with zero-day exclusion controlled by per-row `show_zero` (established in feature 010 Principle III; carried forward unchanged).
  - **Expression rows** — both monthly total AND min/avg/max derived by arithmetic from per-day evaluated values (no HA monthly statistic exists for formulas).
  - **`measurement` state-class rows** — monthly min/avg/max recomputed by the card from daily values; HA's `period=month` `min`/`max` fields MUST NOT be used because they report min/max of period-means, not true daily extremes (rule discovered in commit `58ca61d` 2026-05-24; previously documented only in spec 001 FR-010).
  Version bump MUST be **MINOR** (2.0.0 → 2.1.0): added clarification, not removal or backward-incompatible redefinition (Principle III was previously silent on monthly-derivation sources; this is a documented addition that codifies long-standing shipping behaviour).
  A new sync-impact-report entry MUST be prepended to the constitution file describing the addition.
- **FR-010**: Existing tests MUST continue to pass.
  Tests that asserted "total = arithmetic sum of daily values" for cumulative entity rows MUST be updated to assert HA-monthly-sum-delta semantics; tests for expression-row totals MUST stay as-is.
  Fixture data MUST include realistic HA monthly `sum` payloads (not just `start`/`end` stubs) so the new derivation path is exercised.

### Non-Functional Requirements

- **NFR-001 (per Clarifications 2026-05-30)**: Performance.
  This feature MUST NOT increase the bundle size of `frontend/dist/calendar-stats-card.js` by more than 2 KB minified vs the post-feature-010 baseline.
  Full test-suite wall-clock runtime (`npm test`) MUST NOT increase by more than 10 % vs baseline.
  Algorithmic complexity of the monthly-summary computation MUST remain `O(D × R)` where `D` is days per month and `R` is row count — no new nested loops or repeated scans introduced by the HA-monthly-sum-delta derivation.
  If any of these thresholds is exceeded, the change is rejected for re-work, not merged.

### Key Entities

- **HA Monthly Statistic Entry**: Per-entity, per-month data returned by `recorder/statistics_during_period` with `period: 'month'`.
  Fields: `start`, `end`, `mean`, `min`, `max`, `sum`.
  For cumulative state classes, `sum` is the cumulative-since-tracking-began value at end-of-month.
- **HA Daily Statistic Entry**: Per-entity, per-day data returned by `recorder/statistics_during_period` with `period: 'day'`.
  Same field shape.
  For cumulative state classes, the per-day delta is derived by subtracting consecutive daily `sum` values.
- **Monthly Total**: The value rendered in the "total" column of each monthly table for a cumulative entity row.
  Derivation rule resolved by FR-002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of textual references to "monthly total" / "monthly sum" derivation across `specs/001-monthly-stats-card/spec.md`, `specs/010-precip-show-zero/spec.md`, `docs/README.md`, `.claude/CLAUDE.md`, and the source code describe the same rule (verifiable by grep + diff against the canonical rule statement).
- **SC-002**: A multi-year cumulative entity renders a January total that matches the documented rule.
  Verifiable by setting up a fixture with December-of-prior-year data and asserting the rendered January total.
- **SC-003**: An existing card configuration that worked under feature 010 continues to load and render without modification under this feature (no schema migration).
- **SC-004**: The measurement min/max recompute path (commit `58ca61d`) is preserved; no test that previously asserted measurement-entity behaviour regresses.
- **SC-005**: The rendered total for any month of a cumulative entity row is reproducible from the public HA API (`recorder/statistics_during_period` `period: month` `sum` field) using only the prior-month-delta rule (and the first-month fallback) — no daily-value arithmetic required for entity rows.
- **SC-006**: Initial card load makes the **same number** of `recorder/statistics_during_period` requests as before, with the monthly request now extended to cover one extra prior month for cross-year delta support (verifiable by inspecting the request range, not by counting requests).
- **SC-007**: All tests still pass (`npm test` GREEN); test count delta documented in the implementation plan.
- **SC-008**: The constitution is internally consistent with the chosen rule; if Principle III was amended, the sync-impact report at the top of the constitution file lists the change.

## Assumptions

- The current implementation (post feature 010) computes monthly totals from per-day deltas in `computeMonthlySummaryFromDailyValues` and the expression-row loop; `fetchMonthlyStats` is wired up but its result payload is unused beyond `entry.start` for iteration purposes (project memory `project-followup-monthly-stats`).
- HA's monthly `sum` field for cumulative entities reflects the cumulative-since-tracking-began value at end-of-month; monthly delta is `sum[month] − sum[prev_month]` (spec 001 FR-011, assumed accurate).
- HA's monthly `min`/`max` fields for `measurement` entities are unreliable (min/max of period means, not daily extremes) — commit `58ca61d` evidence.
  This assumption is the basis for FR-003 (measurement recompute preserved regardless of chosen option).
- No card-config field changes are needed for either Option A or Option B.
- The card has not been publicly released yet (per feature 010 clarification 2026-05-30); user-facing total values MAY shift between feature 010 and feature 011 (Option A swap) without a migration note, but a contributor-visible note in the commit body and `docs/README.md` is welcome.
- Test count delta is left to the implementation plan; expected to be small (~5 new or modified tests). The biggest test change is replacing daily-sum-arithmetic assertions with HA-monthly-sum-delta assertions for cumulative entity-row totals (FR-010).
