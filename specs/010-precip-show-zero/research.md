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

**Decision**: Accept existing last-write-wins collision behaviour for duplicate entity rows.
If two `EntityRowConfig` entries reference the same entity ID with conflicting `show_zero`, the monthly summary written into `monthlySummaries` will reflect whichever config was iterated last.
Both rows will display the same (collided) summary in their summary columns.

**Rationale**: The `monthlySummaries` map is keyed by `${rowKey(cfg)}::${year}-${month}` where `rowKey(EntityRowConfig)` returns the entity ID.
Duplicate entity rows already collide on this key today — this is not a regression introduced by the feature.
Spec 001 Acceptance Scenario for duplicates says "each entry produces its own row" but does not require independent summary computation.
Adding row-index keying would touch four components (year-table, monthly-table, plus their tests and the current-month-fill loop) for an edge case with no demonstrated user need.

**Alternatives considered**:
- *Add row index to summary key* (`${rowKey}::${year}-${month}::${index}`): cleanest, but ~120 LOC of propagation through components and tests for a hypothetical conflict.
  YAGNI per Constitution V.
  Rejected for this feature; revisit if a real user reports the conflict.
- *Error on duplicate-entity rows with conflicting show_zero*: degrades UX; spec 001 permits duplicates freely.
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
