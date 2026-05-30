# Show-Zero Rule Requirements Quality Checklist: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

**Purpose**: Validate that the spec, plan, constitution amendment, and downstream doc updates for feature 010 are written clearly, completely, and consistently — independent of whether the implementation works. Use during PR review.
**Created**: 2026-05-30
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] CHK001 Are requirements defined for **every** row type that the change touches — cumulative entity rows (`total_increasing` + `total`), expression rows, and the unaffected `measurement` rows? [Completeness, Spec §FR-002, FR-003, FR-007]
- [ ] CHK002 Does the spec explicitly state what happens to the monthly `total` column under `show_zero: false`, or could a reader plausibly infer it changes? [Completeness, Spec §FR-004]
- [ ] CHK003 Are requirements documented for the "all-zero month" edge case (every day in the month is zero, `show_zero: false`)? [Completeness, Spec §FR-006]
- [ ] CHK004 Are requirements documented for the counter-reset uniformity case (clamp-to-zero day vs naturally-zero day)? [Completeness, Spec §Clarifications 2026-05-30]
- [ ] CHK005 Does the spec define what happens at the boundary between "spec writing" and existing FR-016 in spec 001 (i.e. is the historic-record realignment requirement present)? [Completeness, Spec §FR-012]
- [ ] CHK006 Is the i18n requirement for the editor label scoped to **both** locales (`en.json` AND `de.json`) and required in the same commit? [Completeness, Spec §FR-013]
- [ ] CHK007 Are constitution-update requirements scoped (which principle, what version bump, what sync-impact-report fields)? [Completeness, Spec §FR-011]
- [ ] CHK008 Does the spec address what happens to configurations stored before the change (config migration)? [Completeness, Spec §FR-008]

## Requirement Clarity

- [ ] CHK009 Is the term "zero-value day" defined unambiguously — does "exactly 0" mean strict equality (no floating-point tolerance) for both cumulative sums and expression-row evaluations? [Clarity, Ambiguity]
- [ ] CHK010 Is the new English editor label specified verbatim (`"Include zero-value days"`) so an implementer cannot accidentally pick a near-synonym? [Clarity, Spec §FR-013]
- [ ] CHK011 Is the German translation pinned to a specific string or only described as "semantically equivalent"? Could two implementers land on different DE strings? [Clarity, Ambiguity, Spec §FR-013]
- [ ] CHK012 Is "default include" (when `show_zero` is `true` or omitted) stated symmetrically for cumulative rows (FR-002) and expression rows (FR-003)? [Clarity, Consistency]
- [ ] CHK013 Is the phrase "the monthly summary cells render empty rather than `0/0/0`" (FR-006) precise about what "empty" means in the rendered DOM (blank, `—`, or null in the data model)? [Clarity, Spec §FR-006]
- [ ] CHK014 Does the spec define whether "summary" includes only min/avg/max or also the total column when describing `show_zero` effects? [Clarity, Spec §FR-002, FR-004]

## Requirement Consistency

- [ ] CHK015 Do FR-002 (cumulative) and FR-003 (expression) describe the same `show_zero` semantic, or is there drift between the two? [Consistency, Spec §FR-002, FR-003]
- [ ] CHK016 Is the constitution Principle III update consistent with the spec's FR-002, FR-003, FR-004, FR-007? [Consistency, Constitution Principle III ↔ Spec §FR-002–007]
- [ ] CHK017 Is the `docs/README.md` `show_zero` row description consistent between the Entity row table and the Expression row table (same effect described)? [Consistency, README]
- [ ] CHK018 Is the historic-record amendment in `specs/001-monthly-stats-card/spec.md` worded in a way that does not contradict the original FR-016 text it leaves in place? [Consistency, Spec 001 §Session 2026-05-30]
- [ ] CHK019 Are CLAUDE.md line 25 and `docs/README.md`'s Smart-monthly-summary bullet aligned (no contradiction about whether `show_zero` controls summary)? [Consistency, CLAUDE.md ↔ README]
- [ ] CHK020 Does the spec consistently use "zero-value days" (vs alternates like "zero-sum days", "no-rain days", "empty days") or does terminology drift? [Consistency, Terminology]

## Acceptance Criteria Quality

- [ ] CHK021 Are the four user stories' acceptance scenarios independently verifiable (each can pass or fail on its own without needing the others)? [Measurability, Spec §US1–US4]
- [ ] CHK022 Is SC-001 ("zero `device_class === 'precipitation'` matches") measurable by a deterministic, repeatable command? [Measurability, Spec §SC-001]
- [ ] CHK023 Is SC-008 ("editor preview updates in the same render cycle as day cells") measurable — does the spec define what "same render cycle" means? [Measurability, Spec §SC-008]
- [ ] CHK024 Are SC-005 ("docs/README.md contains no precipitation auto-exclusion") and SC-006 (constitution generic) testable by mechanical grep, or do they require human judgment? [Measurability, Spec §SC-005, SC-006]

## Scenario Coverage

- [ ] CHK025 Are requirements specified for `total` (negative-as-legitimate-export) entities under `show_zero: false` — should a `-5.2` kWh export day be excluded as "not zero" or treated separately? [Coverage, Gap]
- [ ] CHK026 Are requirements defined for a row with both a `factor` and `show_zero: false` — is the zero check applied before or after `factor` scaling? [Coverage, Gap]
- [ ] CHK027 Are requirements defined for an expression row whose formula references entity IDs not present in HA (resolved to `0`) — does that count as a zero day for `show_zero: false`? [Coverage, Edge Case]
- [x] CHK028 Are requirements defined for duplicate entity rows with conflicting `show_zero` settings? [Coverage, Research Q2] — *Resolved: FR-002a, SC-010, and a new Edge Case bullet require per-row-keyed summaries; regression test added.*
- [ ] CHK029 Are requirements defined for the in-progress current month — does the current-month-fill path apply `show_zero` correctly? [Coverage, Spec §FR-005]

## Non-Functional Requirements

- [ ] CHK030 Are performance requirements addressed — does the spec or plan claim no measurable performance change, and is that claim falsifiable? [Completeness, Plan §Technical Context]
- [ ] CHK031 Are i18n requirements consistent with Constitution Principle IV (every user-visible string change in same commit, both locales)? [Consistency, Constitution Principle IV ↔ Spec §FR-013]
- [ ] CHK032 Is there a requirement (or explicit non-requirement) for accessibility properties (aria-label, tooltip) on the relabeled editor toggle? [Coverage, Gap, Research Q5]

## Dependencies & Assumptions

- [ ] CHK033 Is the assumption "`show_zero` already exists on both Row config types" stated and traceable to the source file? [Assumption, Spec §Assumptions]
- [ ] CHK034 Is the YAGNI rejection of `show_zero_in_cells` / `show_zero_in_summary` documented with rationale (not just asserted)? [Assumption, Spec §Assumptions]
- [ ] CHK035 Is the assumption "card not yet publicly released → no migration note needed" stated and traceable to the clarification that produced it? [Assumption, Spec §Clarifications 2026-05-30]

## Ambiguities & Conflicts

- [ ] CHK036 Is the apparent conflict between spec 001 FR-016 (precipitation auto-exclusion) and feature 010 FR-002 (user-driven exclusion) explicitly resolved with a "supersedes" note rather than leaving both as normative? [Conflict, Spec §FR-012, Spec 001 §Session 2026-05-30]
- [x] CHK037 Does the spec leave any term ambiguous about whether `device_class` is read **at all** anywhere in the summary path, or could a reader interpret "MUST NOT apply any device-class-specific rule" (FR-001) as still permitting `device_class` reads for label/unit purposes only? [Clarity, Spec §FR-001] — *Resolved: FR-001 now includes a "Scope clarification" paragraph explicitly permitting non-summary `device_class` reads.*
- [x] CHK038 Is the duplicate-entity-row collision behaviour ("last-write-wins" per research Q2) documented in the spec (not just in research.md), so a future contributor can find it? [Traceability, Gap] — *Resolved: collision eliminated entirely. FR-002a now requires per-row-keyed summaries (the previous "last-write-wins" decision in research.md Q2 is superseded — see research.md Q2 update).*

## Notes

- Items prefixed with `[Gap]` flag requirements that may be missing entirely; ≥80% of items include `[Spec §…]` or a quality marker (`[Gap]`, `[Ambiguity]`, `[Conflict]`, `[Assumption]`).
- Tick boxes during PR review. Each unchecked item is a candidate for a spec edit, not a code edit.
- This checklist tests the **specification**, not the implementation. Implementation correctness is covered by `frontend/tests/` (vitest, 446 tests).
- If multiple items in the same category are unchecked, prioritise consolidation: one spec edit may fix several.
