# Phase 0 Research: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

## Q1 — Where does the precipitation branch live, and what is the minimal refactor surface?

**Decision**: Three call sites change; the `computeMonthlySummaryFromDailyValues` and `transformMonthlyStats` functions in `frontend/src/services/data-transform.ts` get their `isPrecipitation: boolean` parameter renamed to `excludeZero: boolean` (semantic shift only).
All callers in `frontend/src/calendar-stats-card.ts` derive `excludeZero` from `(cfg as { show_zero?: boolean }).show_zero === false`.

**Rationale**: The existing implementation already passes a boolean through these layers — `collectDailySums` already takes `excludeZero: boolean`.
The fix is to stop computing that boolean from `meta.deviceClass === 'precipitation'` and start computing it from the per-row `show_zero` field.
No new helpers, no architectural shift.
Minimal diff aligns with Constitution Principle V (Simplicity).

**Alternatives considered**:
- *Move summary computation into the render component* (year-table / monthly-table): cleaner separation of "data plumbing" vs "row-specific projection", but requires moving 50+ lines of compute logic out of the service layer and into a component, larger diff, no current functional need.
  Rejected.
- *Introduce a new `RowProjection` type to carry per-row config into the service*: premature abstraction; only one boolean is needed per row.
  Rejected.
- *Compute excludeZero from cfg AND from device_class as a fallback*: violates the spec's goal of removing the device-class branch entirely (FR-001, SC-001).
  Rejected.

## Q2 — How does the change interact with duplicate entity rows?

**Original decision (rejected during checklist review 2026-05-30)**: Accept existing last-write-wins collision behaviour for duplicate entity rows.
Rationale was YAGNI — assumed conflicting-`show_zero` duplicates were hypothetical.

**Revised decision (adopted)**: Add row-index keying. Summary map key changes from `${rowKey(cfg)}::${year}-${month}` to `${rowIndex}::${rowKey(cfg)}::${year}-${month}` (see helper `rowSummaryKey()` in `data-transform.ts`).
`transformMonthlyStats` iterates per row (not per entity), giving each row an independent summary derived from its own `show_zero`.
Per-row day-cell rendering already worked per-row; this aligns summary cells with the same model.

**Why reversed**: Checklist CHK037/CHK038 review surfaced a real inconsistency — under the original decision, a row with `show_zero: false` would still see zeros in its **summary** if a sibling row with `show_zero: true` for the same entity was processed first.
That is incoherent (the row asking for exclusion gets an inclusive summary), not merely "shared".
The fix is small (~30 LOC across data-transform.ts, calendar-stats-card.ts, monthly-table.ts, year-table.ts, plus 1 new regression test).
Cost is below the cost of documenting the anomaly + maintaining a known-bug entry indefinitely.

**Alternatives considered (and still rejected)**:
- *Error on duplicate-entity rows with conflicting show_zero*: degrades UX; spec 001 permits duplicates freely.
  Rejected.
- *Defer to a follow-up feature*: would ship a known incoherence in 010.
  Rejected.

## Q3 — Where do the new tests live, and how many?

**Decision**: All new and modified tests stay in their existing files; no new test file.

| File | New tests | Modified tests | Net delta |
|---|---|---|---|
| `tests/unit/services/data-transform.test.ts` | +3 (show_zero=false excludes zeros for non-precipitation; show_zero=true includes zeros for precipitation; all-zero month with show_zero=false → empty summary) | 2 existing precipitation-specific tests reframed to use show_zero | +3 |
| `tests/component/monthly-table.test.ts` | +1 (counter-reset uniformity under show_zero=false) | ~3 fixtures gain explicit `show_zero: false` to keep assertions valid | +1 |
| `tests/component/year-table.test.ts` | 0 | 1 fixture update | 0 |
| **Total** | **+4** | **6 updated** | **+4** |

**Rationale**: Existing test layout co-locates service tests with the service module and component tests with the component module.
Adding a new dedicated test file for this feature would split related cases across files and complicate later refactors.
Reusing the existing structure also makes the red-green-refactor cycle straightforward — modify existing assertions to match new behaviour (red), implement, see green.

**Alternatives considered**:
- *New dedicated test file `tests/unit/services/show-zero-summary.test.ts`*: splits related cases.
  Rejected.
- *Add tests only at component level*: would not exercise the pure-function refactor in `data-transform.ts` directly.
  Rejected.

## Q4 — Constitution version bump scope

**Decision**: PATCH bump 1.0.1 → 1.0.2 is **insufficient**; MAJOR bump 1.0.1 → 2.0.0 is required.

**Rationale**: Principle III currently asserts a binding computation rule ("for `device_class: precipitation`, monthly avg/min/max MUST exclude zero-sum days").
This change removes the rule and replaces it with a user-driven equivalent.
Per the constitution's own amendment procedure: "MAJOR: principle or governance removal / backward-incompatible redefinition" — this matches exactly.
The previous PATCH bump (1.0.0 → 1.0.1) was for *narrowing* the rule to precipitation only without affecting any implementation.
This bump is for *removing* the rule entirely; tests and implementation both change.

**Alternatives considered**:
- *MINOR (1.1.0)*: principle is being redefined, not expanded — does not fit MINOR's "new principle or section added".
  Rejected.
- *PATCH (1.0.2)*: "wording / non-semantic refinement" — this is a semantic change.
  Rejected.

## Q5 — Should `editor.show_zero` rewording be propagated to the spec's i18n requirement only, or also to the editor component's accessibility tooltip / aria-label?

**Decision**: Only `editor.show_zero` (the label/text) changes.
No aria-label or tooltip exists for this control in the current implementation; nothing to update.

**Rationale**: Verified by reading `frontend/src/components/entity-row-editor.ts` — the show_zero / show_min / show_avg / show_max strip uses `ha-formfield label=` only; no aria-label override.
Adding one would expand scope.

**Alternatives considered**: None — minimal change suffices.
