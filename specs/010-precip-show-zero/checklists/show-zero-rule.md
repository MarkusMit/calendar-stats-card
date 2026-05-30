# Show-Zero Rule Requirements Quality Checklist: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

**Purpose**: Validate that the spec, plan, constitution amendment, and downstream doc updates for feature 010 are written clearly, completely, and consistently — independent of whether the implementation works. Use during PR review.
**Created**: 2026-05-30
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are requirements defined for **every** row type that the change touches — cumulative entity rows (`total_increasing` + `total`), expression rows, and the unaffected `measurement` rows? [Completeness, Spec §FR-002, FR-003, FR-007] — *Resolved: FR-002 bundles `total_increasing` + `total`; FR-003 covers expression rows; FR-007 declares measurement rows out-of-scope. CHK025 still tracks the deeper sub-question of `total` negative-value interaction with `show_zero`.*
- [x] CHK002 Does the spec explicitly state what happens to the monthly `total` column under `show_zero: false`, or could a reader plausibly infer it changes? [Completeness, Spec §FR-004] — *Resolved: FR-004 says "MUST remain unaffected by show_zero". Side-finding (pre-existing): FR-004's parenthetical claim about HA-authoritative monthly stats is inaccurate vs implementation — flagged for follow-up; not within this CHK item's scope.*
- [x] CHK003 Are requirements documented for the "all-zero month" edge case (every day in the month is zero, `show_zero: false`)? [Completeness, Spec §FR-006] — *Auto-pass: FR-006 explicit.*
- [x] CHK004 Are requirements documented for the counter-reset uniformity case (clamp-to-zero day vs naturally-zero day)? [Completeness, Spec §Clarifications 2026-05-30] — *Auto-pass: Clarifications 2026-05-30 + FR-002 + Edge Cases bullet.*
- [x] CHK005 Does the spec define what happens at the boundary between "spec writing" and existing FR-016 in spec 001 (i.e. is the historic-record realignment requirement present)? [Completeness, Spec §FR-012] — *Auto-pass: FR-012 explicit; spec 001 amendment shipped.*
- [x] CHK006 Is the i18n requirement for the editor label scoped to **both** locales (`en.json` AND `de.json`) and required in the same commit? [Completeness, Spec §FR-013] — *Auto-pass: FR-013 names both files and requires same-commit shipping.*
- [x] CHK007 Are constitution-update requirements scoped (which principle, what version bump, what sync-impact-report fields)? [Completeness, Spec §FR-011] — *Auto-pass: FR-011 names Principle III and MAJOR bump. Sync-impact-report content governed by constitution's own amendment procedure (implicit, not re-asserted).*
- [x] CHK008 Does the spec address what happens to configurations stored before the change (config migration)? [Completeness, Spec §FR-008] — *Auto-pass: FR-008 explicit ("MUST NOT require any configuration migration"); Assumptions reaffirms.*

## Requirement Clarity

- [x] CHK009 Is the term "zero-value day" defined unambiguously — does "exactly 0" mean strict equality (no floating-point tolerance) for both cumulative sums and expression-row evaluations? [Clarity, Ambiguity] — *Resolved: FR-002 now defines zero-check semantics as strict JavaScript `entry.sum === 0` with no float tolerance; FR-003 inherits same semantics.*
- [x] CHK010 Is the new English editor label specified verbatim (`"Include zero-value days"`) so an implementer cannot accidentally pick a near-synonym? [Clarity, Spec §FR-013] — *Auto-pass: FR-013 says "MUST become exactly **\"Include zero-value days\"**".*
- [x] CHK011 Is the German translation pinned to a specific string or only described as "semantically equivalent"? Could two implementers land on different DE strings? [Clarity, Ambiguity, Spec §FR-013] — *Resolved: FR-013 now pins German label to exactly `"Nullwerttage einbeziehen"`.*
- [x] CHK012 Is "default include" (when `show_zero` is `true` or omitted) stated symmetrically for cumulative rows (FR-002) and expression rows (FR-003)? [Clarity, Consistency] — *Auto-pass: both FRs use the same "true or omitted (default)" phrasing.*
- [x] CHK013 Is the phrase "the monthly summary cells render empty rather than `0/0/0`" (FR-006) precise about what "empty" means in the rendered DOM (blank, `—`, or null in the data model)? [Clarity, Spec §FR-006] — *Resolved: FR-006 now defines "empty" as `null` in the `MonthlySummary` data model; cell rendering follows existing per-cell rules for null/missing summary values (not changed by this feature).*
- [x] CHK014 Does the spec define whether "summary" includes only min/avg/max or also the total column when describing `show_zero` effects? [Clarity, Spec §FR-002, FR-004] — *Auto-pass: FR-002 scopes to "min/avg/max"; FR-004 explicitly carves out `total` as unaffected.*

## Requirement Consistency

- [x] CHK015 Do FR-002 (cumulative) and FR-003 (expression) describe the same `show_zero` semantic, or is there drift between the two? [Consistency, Spec §FR-002, FR-003] — *Auto-pass: parallel wording; FR-003 explicitly inherits FR-002 strict-zero semantics after CHK009 edit.*
- [x] CHK016 Is the constitution Principle III update consistent with the spec's FR-002, FR-003, FR-004, FR-007? [Consistency, Constitution Principle III ↔ Spec §FR-002–007] — *Auto-pass: rewritten Principle III mirrors FR-002 (show_zero-driven, no device_class), FR-003 (expression rows), FR-004 (total unaffected), FR-007 (measurement unaffected), plus counter-reset uniformity.*
- [x] CHK017 Is the `docs/README.md` `show_zero` row description consistent between the Entity row table and the Expression row table (same effect described)? [Consistency, README] — *Auto-pass: both tables describe the dual effect (cell blanking + summary exclusion, total unaffected) in symmetric language.*
- [x] CHK018 Is the historic-record amendment in `specs/001-monthly-stats-card/spec.md` worded in a way that does not contradict the original FR-016 text it leaves in place? [Consistency, Spec 001 §Session 2026-05-30] — *Auto-pass: amendment explicitly states FR-016 text is retained for historical record but "superseded by feature 010". No contradictory normative claim left standing.*
- [x] CHK019 Are CLAUDE.md line 25 and `docs/README.md`'s Smart-monthly-summary bullet aligned (no contradiction about whether `show_zero` controls summary)? [Consistency, CLAUDE.md ↔ README] — *Auto-pass: both describe per-row `show_zero` as the summary-exclusion control; neither references device_class auto-exclusion.*
- [x] CHK020 Does the spec consistently use "zero-value days" (vs alternates like "zero-sum days", "no-rain days", "empty days") or does terminology drift? [Consistency, Terminology] — *Resolved: new Terminology subsection declares "zero-value day" canonical and lists "zero-sum day" / "zero day" / "no-rain day" as aliases. Future edits MUST use the canonical term.*

## Acceptance Criteria Quality

- [x] CHK021 Are the four user stories' acceptance scenarios independently verifiable (each can pass or fail on its own without needing the others)? [Measurability, Spec §US1–US4] — *Auto-pass: each US has its own Independent Test paragraph and discrete Acceptance Scenarios using Given/When/Then.*
- [x] CHK022 Is SC-001 ("zero `device_class === 'precipitation'` matches") measurable by a deterministic, repeatable command? [Measurability, Spec §SC-001] — *Auto-pass: `grep -rn "device_class === 'precipitation'" frontend/src` is deterministic and repeatable; verification command spelled out in tasks.md T026.*
- [x] CHK023 Is SC-008 ("editor preview updates in the same render cycle as day cells") measurable — does the spec define what "same render cycle" means? [Measurability, Spec §SC-008] — *Resolved: SC-008 now defines "same render cycle" as "within a single `config-changed`-triggered Lit update; verifiable by awaiting `updateComplete` once after the toggle event".*
- [x] CHK024 Are SC-005 ("docs/README.md contains no precipitation auto-exclusion") and SC-006 (constitution generic) testable by mechanical grep, or do they require human judgment? [Measurability, Spec §SC-005, SC-006] — *Auto-pass: both verifiable by `grep -n "device_class: precipitation"` returning zero matches in the relevant files. T026 prescribes the exact commands.*

## Scenario Coverage

- [x] CHK025 Are requirements specified for `total` (negative-as-legitimate-export) entities under `show_zero: false` — should a `-5.2` kWh export day be excluded as "not zero" or treated separately? [Coverage, Gap] — *Resolved: FR-002 now states negative non-zero daily sums are NOT excluded (strict equality with 0 means `-5.2 !== 0`).*
- [x] CHK026 Are requirements defined for a row with both a `factor` and `show_zero: false` — is the zero check applied before or after `factor` scaling? [Coverage, Gap] — *Resolved: new FR-002c states the zero-check operates on the raw stored daily value, before `factor` scaling. Ordering is moot for non-zero factors (0 × factor = 0). `factor: 0` declared undefined behaviour.*
- [x] CHK027 Are requirements defined for an expression row whose formula references entity IDs not present in HA (resolved to `0`) — does that count as a zero day for `show_zero: false`? [Coverage, Edge Case] — *Resolved: FR-003 now states missing-entity operands are substituted with `0`; the resulting evaluated value is treated like any other day for `show_zero` purposes (no "real 0" vs "substitution 0" distinction).*
- [x] CHK028 Are requirements defined for duplicate entity rows with conflicting `show_zero` settings? [Coverage, Research Q2] — *Resolved: FR-002a, SC-010, and a new Edge Case bullet require per-row-keyed summaries; regression test added.*
- [x] CHK029 Are requirements defined for the in-progress current month — does the current-month-fill path apply `show_zero` correctly? [Coverage, Spec §FR-005] — *Resolved: new FR-005a requires the current-month-fill loop to derive `excludeZero` from `cfg.show_zero === false` identically to `transformMonthlyStats`. Past and current months MUST produce identical results for identical inputs.*

## Non-Functional Requirements

- [x] CHK030 Are performance requirements addressed — does the spec or plan claim no measurable performance change, and is that claim falsifiable? [Completeness, Plan §Technical Context] — *Resolved: new NFR-001 sets three falsifiable thresholds — bundle size delta ≤ 2 KB, test wall-clock delta ≤ 10 %, complexity remains `O(D × R)`. Breach triggers rejection.*
- [x] CHK031 Are i18n requirements consistent with Constitution Principle IV (every user-visible string change in same commit, both locales)? [Consistency, Constitution Principle IV ↔ Spec §FR-013] — *Auto-pass: FR-013 mandates same-commit en+de update with both labels pinned verbatim; satisfies Constitution IV's "every user-visible string MUST be internationalised at the moment it is introduced".*
- [x] CHK032 Is there a requirement (or explicit non-requirement) for accessibility properties (aria-label, tooltip) on the relabeled editor toggle? [Coverage, Gap, Research Q5] — *Resolved: FR-013 now includes an Accessibility non-requirement paragraph — no aria-label/title/tooltip changes; `ha-formfield label=` is HA's native a11y binding; implementers MUST NOT add custom attributes.*

## Dependencies & Assumptions

- [x] CHK033 Is the assumption "`show_zero` already exists on both Row config types" stated and traceable to the source file? [Assumption, Spec §Assumptions] — *Auto-pass: spec Assumptions states it; data-model.md cites the existing field in `frontend/src/types/card-config.ts` lines 29 and 45.*
- [x] CHK034 Is the YAGNI rejection of `show_zero_in_cells` / `show_zero_in_summary` documented with rationale (not just asserted)? [Assumption, Spec §Assumptions] — *Auto-pass: spec Assumptions explicitly invokes Constitution Principle V — YAGNI for the rejection.*
- [x] CHK035 Is the assumption "card not yet publicly released → no migration note needed" stated and traceable to the clarification that produced it? [Assumption, Spec §Clarifications 2026-05-30] — *Auto-pass: spec Assumptions cites "(clarification 2026-05-30)"; Clarifications section records the Q&A.*

## Ambiguities & Conflicts

- [x] CHK036 Is the apparent conflict between spec 001 FR-016 (precipitation auto-exclusion) and feature 010 FR-002 (user-driven exclusion) explicitly resolved with a "supersedes" note rather than leaving both as normative? [Conflict, Spec §FR-012, Spec 001 §Session 2026-05-30] — *Auto-pass: FR-012 requires the realignment; spec 001 Session 2026-05-30 entry explicitly states "superseded by feature 010".*
- [x] CHK037 Does the spec leave any term ambiguous about whether `device_class` is read **at all** anywhere in the summary path, or could a reader interpret "MUST NOT apply any device-class-specific rule" (FR-001) as still permitting `device_class` reads for label/unit purposes only? [Clarity, Spec §FR-001] — *Resolved: FR-001 now includes a "Scope clarification" paragraph explicitly permitting non-summary `device_class` reads.*
- [x] CHK038 Is the duplicate-entity-row collision behaviour ("last-write-wins" per research Q2) documented in the spec (not just in research.md), so a future contributor can find it? [Traceability, Gap] — *Resolved: collision eliminated entirely. FR-002a now requires per-row-keyed summaries (the previous "last-write-wins" decision in research.md Q2 is superseded — see research.md Q2 update).*

## Notes

- Items prefixed with `[Gap]` flag requirements that may be missing entirely; ≥80% of items include `[Spec §…]` or a quality marker (`[Gap]`, `[Ambiguity]`, `[Conflict]`, `[Assumption]`).
- Tick boxes during PR review. Each unchecked item is a candidate for a spec edit, not a code edit.
- This checklist tests the **specification**, not the implementation. Implementation correctness is covered by `frontend/tests/` (vitest, 446 tests).
- If multiple items in the same category are unchecked, prioritise consolidation: one spec edit may fix several.
