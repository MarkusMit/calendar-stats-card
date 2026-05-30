<!--
SYNC IMPACT REPORT
==================
Version change: 2.0.0 → 2.1.0 (MINOR — Principle III: cumulative-total derivation rule made explicit; measurement min/max recompute rule codified; cross-cutting fetch-range rule added. No prior rule removed or contradicted.)

Modified principles:
  III. Density & Data Fidelity — restructured around three row-type sections (cumulative,
       expression, measurement) plus a cross-cutting rules section. New normative content:
       cumulative-row monthly total = HA `sum[month] − sum[prev_month]` with first-month
       fallback; negative monthly delta clamp for `total_increasing`; expression-row totals
       arithmetic-only (no HA monthly stat for formulas); measurement min/max recompute rule
       from commit 58ca61d codified in the constitution; monthly-fetch range extension to
       Dec-1 of prior year for cross-year delta. Previously-silent areas now have explicit
       rules. No prior MUST removed.

Added sections:
  none (Principle III restructured in place)

Removed sections:
  none

Templates updated:
  ✅ .specify/memory/constitution.md — this file
  ⚠  .specify/templates/plan-template.md — no changes required
  ⚠  .specify/templates/spec-template.md — no changes required
  ⚠  .specify/templates/tasks-template.md — no changes required

Deferred:
  none

Rationale for MINOR (not MAJOR): the new rules document long-standing shipping behaviour
(measurement min/max recompute lived in commit 58ca61d + spec 001 FR-010 but not in the
constitution) AND new feature 011 behaviour (HA-sum-delta totals — spec 001 FR-011 always
prescribed this; implementation didn't follow). No prior Principle III MUST is removed or
contradicted; this is an additive clarification per the constitution's amendment procedure.

Earlier history:
  2.0.0 (2026-05-30, MAJOR): feature 010 — device_class:precipitation zero-exclusion removed,
  replaced with user-driven show_zero rule.
  1.0.1 (2026-05-24, PATCH): zero-exclusion rule narrowed from "scalar measurements broadly"
  to "device_class: precipitation only". No implementation impact at that time.
-->

<!--
HISTORICAL SYNC IMPACT REPORT (feature 010, version 2.0.0)
==========================================================
Version change: 1.0.1 → 2.0.0 (MAJOR — Principle III: device_class-driven zero-exclusion removed; replaced with user-driven show_zero rule)

Modified principles:
  III. Density & Data Fidelity — device_class: precipitation auto-exclusion clause removed.
       Cumulative and expression rows now exclude zero-value days from monthly min/avg/max
       only when the row's show_zero option is set to false. Default behaviour (show_zero
       true or omitted): include every recorded day, regardless of device_class.
       Counter-reset zeros (total_increasing clamp-to-zero) are treated uniformly with
       naturally-zero days — no origin metadata is preserved.

Added sections:
  none

Removed sections:
  none

Templates updated:
  ✅ .specify/memory/constitution.md — this file
  ⚠  .specify/templates/plan-template.md — no changes required (references entities generically)
  ⚠  .specify/templates/spec-template.md — no changes required
  ⚠  .specify/templates/tasks-template.md — no changes required

Deferred:
  none

Rationale for MAJOR: Principle III previously asserted a binding computation rule keyed on
device_class. Feature 010 removes that rule and replaces it with a user-driven config-based
rule. This is a backward-incompatible redefinition of a normative principle — exactly the
case the constitution's own amendment procedure defines as MAJOR. Both implementation and
documentation change as a consequence (data-transform.ts, calendar-stats-card.ts, README,
en/de translation labels, historic spec 001 FR-016 realignment).

Earlier history:
  1.0.0 → 1.0.1 (2026-05-24, PATCH): zero-exclusion rule narrowed from "scalar measurements
  broadly" to "device_class: precipitation only". No implementation impact at that time.
-->

# CalendarStats Constitution

## Core Principles

### I. HA-Native Design

The card's visual design, interaction patterns, and color language MUST match Home Assistant's native look
and feel. Components MUST use HA design tokens and Lovelace card conventions where available. Custom
styling that deviates from HA UI norms MUST be explicitly justified.

**Rationale**: Users expect HA cards to feel native to their dashboard. Visual divergence from HA norms
creates a jarring experience and increases maintenance burden as HA's own design evolves.

### II. Test-First (NON-NEGOTIABLE)

TDD is mandatory. Tests MUST be written and confirmed to fail before any implementation code is written.
The Red-Green-Refactor cycle MUST be strictly followed for every task. No task is considered complete
until all tests for that task pass.

**Rationale**: User requirement. Early test definition exposes design issues before they are expensive
to fix and provides measurable acceptance criteria for every requirement.

### III. Density & Data Fidelity

The card layout MUST maximize information density — no decorative whitespace. Day-level data and
monthly summary data MUST be computed accurately per entity type and per derivation path:

**Cumulative entity rows (`total_increasing` / `total`)**:

- Day cells: single daily value (delta from previous day's HA `sum`).
- Monthly min/avg/max: card-computed from daily values; zero-value days excluded when the row's
  `show_zero` option is `false`, included when `show_zero` is `true` or omitted (default).
- Monthly **total**: derived as `HA monthly sum[month] − HA monthly sum[prev_month]` from HA's
  `period: 'month'` statistics. For the first tracked month (no prev-month entry) or after a
  monthly-statistics gap, `total = HA monthly sum[month]` directly. A negative monthly delta MUST
  be clamped to `0` for `total_increasing` entities (counter-reset anomaly); for `total` entities
  a negative delta is legitimate (e.g. net energy export) and MUST pass through as-is.
- Daily-sum arithmetic MUST NOT be used as a fallback when HA's monthly `sum` is present; if
  `sum` is missing for the requested month, the total cell renders empty rather than falling
  back to a daily-sum.

**Expression rows**:

- Day cells: formula evaluation over per-day entity values.
- Monthly min/avg/max AND monthly total: arithmetic from the per-day evaluated values (HA does
  not store monthly-period statistics for formulas, so the HA-sum-delta rule is inapplicable).
  Zero-value days excluded from min/avg/max when `show_zero: false`; total always sums all days.

**`measurement` state-class rows**:

- Day cells: min/avg/max per day in a single row; separate min/max rows are prohibited.
- Monthly min/avg/max: card-computed from daily values. HA's `period=month` `min`/`max` fields
  MUST NOT be used because they report min/max of period-means, not true daily extremes.
- Monthly total: not applicable (measurement entities have no total column).
- `show_zero` MUST NOT affect measurement-entity summaries.

**Cross-cutting rules**:

- `device_class` MUST NOT be read by any monthly-summary computation path.
- Negative daily deltas: for `total_increasing` entities, treated as 0 (counter reset anomaly);
  for `total` entities, shown as-is (legitimate values, e.g. net energy export). A counter-reset
  clamp-to-zero day MUST be indistinguishable from a naturally-zero day in the summary pipeline —
  both are excluded together when `show_zero: false`, both included together otherwise. No origin
  metadata is preserved (YAGNI per Principle V).
- The monthly-summary fetch range MUST extend back one month before the viewing year so that
  January's cross-year delta is available. Entries from the prior year are used for lookup only;
  they MUST NOT produce their own summary entries.

Any deviation from these computation rules is a defect, not a design choice.

**Rationale**: The card's sole purpose is dense statistical display. Whitespace waste or computation
error directly undermines its value. Zero-day handling is a per-row user preference (some sensors —
rainfall, irrigation — make zero days meaningless; others — energy meters — treat them as legitimate
data points); pinning that decision to `device_class` removed user control and is rejected.

### IV. Internationalisation from Day One

Every user-visible string MUST be internationalised at the moment it is introduced.
Hard-coded display strings are prohibited.
Supported locales at launch: `en` and `de`.
Home Assistant doesn't support regional variants like `de-AT`.
Adding a new locale MUST require only a translation file addition — no code changes.

**Rationale**: Retrofitting i18n is expensive.
Both locales are required from launch; the architecture must accommodate them without later refactoring.

### V. Simplicity & Bounded Scope

Features explicitly listed as Out of Scope in any spec MUST NOT be implemented. Abstractions MUST NOT
be introduced without a concrete current need (YAGNI). Three similar lines of code are preferred over
a premature helper function. All complexity MUST be justified in the plan's Complexity Tracking table.

**Rationale**: HA custom cards accrue complexity quickly.
Strict scope discipline keeps the card maintainable and prevents shipping half-finished features.

## Technology Standards

**Target platform**: Home Assistant 2026.5.0 or later.

**Frontend runtime**: Node.js 24.15 (WSL2); source lives in `frontend/`; output bundles to
`frontend/dist/`.

**Python runtime**: Python 3.14+ (WSL2); used exclusively for tooling and automated tests — not
shipped in the card bundle.

**Encoding & line endings**: All source files MUST be UTF-8 with LF line endings (enforced via
`.gitattributes`). Windows CRLF line endings are a defect.

**Dependencies**: New runtime dependencies require explicit justification. HA-provided APIs and
built-in browser capabilities MUST be preferred over third-party libraries.

## Development Workflow

**Specification-driven**: Every feature MUST follow the full Speckit workflow:
specify → clarify → plan → tasks → implement → checklist → analyze.
No implementation begins without an approved spec.

**Conventional Commits**: All commits MUST use Conventional Commits format.
Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`. Subject ≤72 chars, imperative mood, no trailing period. Breaking changes via `!` suffix or
`BREAKING CHANGE:` footer.

**No manual commits during Speckit**: Git commits within an active Speckit workflow are handled by
extension hooks. Manual commits during Speckit steps are prohibited.

**Constitution Check gate**: Every implementation plan MUST include a Constitution Check. Violations
require documented justification in the plan's Complexity Tracking table before work proceeds.

## Governance

This constitution supersedes all other project practices. Any conflict between this document and other
guidance resolves in favor of this constitution.

**Amendment procedure**: Amendments MUST be made via `/speckit-constitution`. Each amendment increments
the version following semantic versioning:
- MAJOR: principle or governance removal / backward-incompatible redefinition.
- MINOR: new principle or section added, or materially expanded guidance.
- PATCH: clarifications, wording, or non-semantic refinements.

Amendments MUST propagate to all dependent templates (tracked in the Sync Impact Report at the top of
this file).

**Compliance review**: Every implementation plan MUST verify all five principles at the Constitution
Check gate. Plans that cannot satisfy a principle MUST justify the exception in the Complexity Tracking
table before proceeding.

**Version**: 2.1.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-30
