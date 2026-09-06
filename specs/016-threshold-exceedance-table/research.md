# Research: Threshold Exceedance Table

**Feature**: 016-threshold-exceedance-table
**Date**: 2026-09-06

All open questions were resolved before planning.
No `NEEDS CLARIFICATION` markers remain in the spec.

---

## Decision 1: Where the counting happens

**Decision**: A pure counting service, independent of any component's render pass.

**Rationale**: The yearly view never renders day cells, yet FR-014 requires identical counts in both views.
Counting during rendering — the way the legend collects its fired rules through the `thresholds-applied` event — cannot satisfy that.
A pure function over the already-fetched daily values works the same in every view and is unit-testable without a DOM.

**Alternatives considered**:

- Accumulate counts while `year-table` renders and dispatch them upward, mirroring the legend.
Rejected: produces nothing in the yearly view, and couples a data question to a layout concern.
- Count inside the new component itself.
Rejected: mixes aggregation with presentation and forces DOM setup into every counting test.

---

## Decision 2: How the band is defined

**Decision**: A day falls into a rule's band when that rule is the one the existing cell-coloring resolution picks for that day's cell.

**Rationale**: This is the definition the user can verify by looking at the table above — SC-003 states exactly that.
It also needs no direction handling: thresholds that flag low values, and rows mixing both directions, fall out of the same rule with no extra branching.
An explicit `[value, next value)` range would need its own ordering and direction logic and could disagree with the colors on screen, which would read as a bug.

**Alternatives considered**:

- Sort day values ascending per row and use `[value, next value)`.
Rejected: duplicates the resolution logic and can contradict the visible coloring.
- Restrict the table to above-family operators.
Rejected: silently drops configured thresholds.

---

## Decision 3: Exposing the matching rules

**Decision**: Export a `matchingThresholds()` candidate list from the existing threshold resolution module and rebuild `resolveThreshold()` on top of it.

**Rationale**: The cumulative count (FR-007) needs every rule that applies, not only the winner.
The operator matching, the per-period value lookup and the cell-role exclusions already exist as module-private helpers; exporting the filtered candidate list reuses all of it and keeps one definition of "this rule applies".
Re-implementing operator matching in the new service would be duplicated logic that can drift.

**Alternatives considered**:

- Export the private `matchesOperator` helper and loop over rules in the new service.
Rejected: leaks the lowest-level primitive and forces every caller to re-implement the period-value and role-exclusion filters.
- Have the resolver return `{ winner, matches }`.
Rejected: changes an existing signature used at a dozen call sites for the benefit of one new caller.

---

## Decision 4: Zero-value days and the row factor

**Decision**: Counting mirrors the rendered cells exactly — a measurement value of `0` is skipped when the row sets `show_zero: false`, cumulative and expression rows still count zero days, and the row's `factor` is applied before comparing against thresholds.

**Rationale**: FR-011 and SC-003 tie the counts to what is visibly colored.
The renderer skips threshold resolution entirely for a suppressed measurement value but still resolves for a suppressed cumulative value, so the counts must follow that same asymmetry or the band counts will not match the colored cells.
The row `factor` is applied at render time rather than baked into the stored daily values, so the service has to apply it itself; predecessor factors are already baked in and must not be applied twice.

**Constitution note**: Principle III states `show_zero` MUST NOT affect measurement-entity *summaries*.
That rule governs monthly min/avg/max derivation.
The exceedance counts are not a summary of values but a count of visible day cells, and the day-cell suppression they follow is existing shipped behaviour.

**Alternatives considered**:

- Count every recorded day regardless of `show_zero`.
Rejected: breaks SC-003 for rows that hide zero days.

---

## Decision 5: Excluding incomplete days

**Decision**: Rely on the existing `kind: 'empty'` marker in the daily values.

**Rationale**: Today and every future day are already stored as empty entries by the data transform, so filtering on the entry kind satisfies FR-010 with no date comparison and no second source of truth about "what counts as today".
Re-deriving the current date inside the service would duplicate the timezone handling the card already does against the HA server timezone.

---

## Decision 6: One count per day per rule

**Decision**: Collect the applicable rules per day into sets, then increment counts once per set member.

**Rationale**: FR-008 — a measurement row exposes up to three values per day and a rule can apply to more than one of them.
Sets make double counting structurally impossible rather than relying on ordering.

---

## Decision 7: Row labels

**Decision**: Extract the existing inline label composition (`name`/friendly name plus unit in brackets) into one shared helper used by both the legend path and the new service.

**Rationale**: FR-004 requires the same labels the legend uses.
The composition currently exists only as inline code in the monthly table; a second copy would be free to drift, and the two labels sitting on the same screen make any drift visible to the user.
