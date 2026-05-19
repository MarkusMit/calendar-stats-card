<!--
SYNC IMPACT REPORT
==================
Version change: [NEW] → 1.0.0 (initial ratification, all placeholders replaced)

Principles defined:
  I.   HA-Native Design
  II.  Test-First (TDD) — NON-NEGOTIABLE
  III. Density & Data Fidelity
  IV.  Internationalisation from Day One
  V.   Simplicity & Bounded Scope

Sections added:
  - Technology Standards
  - Development Workflow
  - Governance

Templates updated:
  ✅ .specify/templates/plan-template.md — Constitution Check gates added
  ✅ .specify/memory/constitution.md — this file
  ⚠  .specify/templates/spec-template.md — no changes required
  ⚠  .specify/templates/tasks-template.md — no changes required (TDD note already present)

Deferred:
  none — all fields resolved
-->

# Tabularizer Constitution

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

- Scalar measurements: single daily value; monthly avg/min/max MUST exclude zero-value days.
- Range measurements: min/avg/max per day in a single row; separate min/max rows are prohibited.
- Cumulative (total_increasing / increasing): daily difference (end − start); negative diffs treated as 0.

Any deviation from these computation rules is a defect, not a design choice.

**Rationale**: The card's sole purpose is dense statistical display. Whitespace waste or computation
error directly undermines its value.

### IV. Internationalisation from Day One

Every user-visible string MUST be internationalised at the moment it is introduced. Hard-coded display
strings are prohibited. Supported locales at launch: `en` and `de-AT`. Adding a new locale MUST require
only a translation file addition — no code changes.

**Rationale**: Retrofitting i18n is expensive. Both locales are required from launch; the architecture
must accommodate them without later refactoring.

### V. Simplicity & Bounded Scope

Features explicitly listed as Out of Scope in any spec MUST NOT be implemented. Abstractions MUST NOT
be introduced without a concrete current need (YAGNI). Three similar lines of code are preferred over
a premature helper function. All complexity MUST be justified in the plan's Complexity Tracking table.

**Rationale**: HA custom cards accrue complexity quickly. Strict scope discipline keeps the card
maintainable and prevents shipping half-finished features.

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

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
