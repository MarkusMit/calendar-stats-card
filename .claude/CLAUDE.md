# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Persona

Act as an objective, critical analyst.
Do not praise ideas, offer compliments, or use polite filler.
Provide direct, blunt, evidence-based feedback.
Double-check every fact, remember validated facts.
Correct errors immediately and explain why.

## Project Overview

**Type**: Home Assistant Lovelace custom card
**Target HA version**: 2026.5.0+
**Distribution**: HACS custom repository; GitHub Releases carry the built `calendar-stats-card.js`

Displays HA entity statistics in dense monthly tables. Entities are user-configured with optional label overrides. One page shows all past months of a year; future months are hidden.

### Display Logic

- Columns: day-of-month (1–N), Summary (min/avg/max), total (where applicable)
- `measurement` entities: single value per day for scalar types (e.g. precipitation); min/avg/max per day for range types (e.g. temperature)
- `total_increasing` / `increasing` entities: daily diff
- Monthly summary min/avg/max for cumulative/expression rows; zero-day inclusion controlled by per-row show_zero (default include)
- Label column includes unit-of-measurement
- Layout must be dense — no excessive whitespace

### i18n

Supported: `en`, `de`.

### For Later Implementation

- Manual weather/snowfall input

## Project Principles

### I. HA-Native Design

Visual design, interaction patterns, and colour language match Home Assistant's native look.
Use HA design tokens and Lovelace card conventions where available.
Custom styling that deviates from HA UI norms needs explicit justification.

### II. Test-First (non-negotiable)

Write the failing test first, confirm it fails, then implement.
Red-Green-Refactor for every task.
A task is complete only when all its tests pass.

### III. Density & Data Fidelity

Maximise information density; no decorative whitespace.
Computation rules per row type are normative; any deviation is a defect.

**Cumulative entity rows (`total_increasing` / `total`)**:

- Day cells: single daily value, HA's `change` (delta of `sum` against the previous recorded row, even one before the fetch window).
  In-window `sum` difference only when the response carries no `change`.
- Monthly min/avg/max: card-computed from daily values; zero-value days excluded when the row's `show_zero` is `false`, included otherwise (default).
- Monthly **total**: `HA monthly sum[month] − HA monthly sum[prev_month]` from HA's `period: 'month'` statistics.
  First tracked month or after a monthly-statistics gap: `total = HA monthly sum[month]`.
  Negative monthly delta: clamp to `0` for `total_increasing`; pass through for `total` (e.g. net export).
- Daily-sum arithmetic is never a fallback when HA's monthly `sum` is present; missing `sum` renders an empty total cell.

**Expression rows**:

- Day cells: formula evaluation over per-day entity values.
- Monthly min/avg/max and total: arithmetic over per-day evaluated values.
  Zero-value days excluded from min/avg/max when `show_zero: false`; total always sums all days.

**`measurement` rows**:

- Day cells: min/avg/max per day in one row; separate min/max rows are prohibited.
- Monthly min/avg/max: card-computed from daily values.
  HA's `period=month` `min`/`max` are not used (they are min/max of period means, not daily extremes).
- No total column. `show_zero` has no effect on measurement summaries.

**Cross-cutting**:

- `device_class` is never read by any monthly-summary computation path.
- Negative daily deltas: `total_increasing` → 0; `total` → shown as-is.
  A clamped day is indistinguishable from a naturally-zero day; no origin metadata is kept.
- The monthly-summary fetch range extends one month before the viewing year so January's cross-year delta exists.
  Prior-year entries are lookup-only and produce no summary entries.

### IV. Internationalisation

Every user-visible string goes through `localize()` at the moment it is introduced.
`en.json` and `de.json` are updated in the same commit.
HA has no regional variants (`de-AT` is `de`).
Adding a locale requires only a translation file.

### V. Simplicity & Bounded Scope

YAGNI: no abstraction without a concrete current need; three similar lines beat a premature helper.
Features listed under "For Later Implementation" or explicitly out of scope are not implemented opportunistically.

## Technology Standards

- Home Assistant 2026.5.0 or later
- Node.js 24 (current LTS); source in `frontend/`, bundle to `frontend/dist/calendar-stats-card.js` (gitignored)
- UTF-8, LF line endings only (enforced via `.gitattributes`); CRLF is a defect
- New runtime dependencies need explicit justification; prefer HA-provided APIs and browser built-ins

## Build & Test Commands

All commands run from the `frontend/` directory:

```bash
npm install          # install dependencies
npm run build        # bundle → frontend/dist/calendar-stats-card.js
npm test             # Vitest (write failing tests first — TDD)
npm run test:watch   # watch mode
npm run test:coverage
npm run lint          # ESLint only — does NOT typecheck
npm run typecheck     # tsc --noEmit
npm run check         # lint + typecheck + tests
```

## Key Directories

- `frontend/src/` — card, components, services, translations
- `frontend/tests/` — Vitest unit and component tests
- `docs/` — screenshots
- `.github/workflows/` — CI (`ci.yml`) and release (`release.yml`)
- `.claude/` — Claude Code project config

## Git Workflow

- `main` — released code; every commit on it is a `merge(release): vX.Y.Z` and carries a tag
- `dev` — integration branch; features land here first
- Short-lived feature branches off `dev`, merged back into `dev`
- Commit manually after each coherent step; commit bodies 2–6 lines
- Release process is documented in `CONTRIBUTING.md`; the tag push builds and publishes the GitHub Release
- **Conventional Commits format**: `type(scope): subject`
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
  - Subject ≤72 chars, imperative mood, no trailing period
  - Breaking changes: `!` after type/scope or `BREAKING CHANGE:` footer

## Documentation Conventions

- Markdown: one sentence per line
- Comments and docs describe the current state only
- Every user-facing document carries the "vibe-coded" `> [!WARNING]` admonition near the top
- `CHANGELOG.md` follows Keep a Changelog; update it in the version-bump commit, before tagging
