<!--
SYNC IMPACT REPORT
==================
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

The card layout MUST maximize information density — no decorative whitespace. Day-level data MUST be
computed accurately per entity type:

- Scalar measurements (total_increasing / total) and expression rows: single daily value (delta from
  previous day's sum for cumulative entities; formula evaluation for expression rows). Monthly
  min/avg/max MUST exclude zero-value days when the row's `show_zero` option is `false`, and MUST
  include them when `show_zero` is `true` or omitted (default). The monthly `total` MUST always be
  the sum of every recorded day, regardless of `show_zero` (zero days contribute zero and cannot
  change the total). `device_class` MUST NOT be read by any monthly-summary computation path.
- Range measurements (measurement state_class): min/avg/max per day in a single row; separate min/max
  rows are prohibited; monthly min/avg/max MUST be card-computed from daily values (HA monthly-period
  min/max reflect period-mean extremes, not true daily extremes). `show_zero` MUST NOT affect
  measurement-entity summaries.
- Negative daily deltas: for `total_increasing` entities, treated as 0 (counter reset anomaly); for
  `total` entities, shown as-is (legitimate values, e.g. net energy export). A counter-reset
  clamp-to-zero day MUST be indistinguishable from a naturally-zero day in the summary pipeline — both
  are excluded together when `show_zero: false`, both included together otherwise. No origin metadata
  is preserved (YAGNI per Principle V).

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

**Version**: 2.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-30
