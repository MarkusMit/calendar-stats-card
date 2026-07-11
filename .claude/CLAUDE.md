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

Displays HA entity statistics in dense monthly tables. Entities are user-configured with optional label overrides. One page shows all past months of a year; future months are hidden.

### Display Logic

- Columns: day-of-month (1–N), Summary (min/avg/max), total (where applicable)
- `measurement` entities: single value per day for scalar types (e.g. precipitation); min/avg/max per day for range types (e.g. temperature)
- `total_increasing` / `increasing` entities: daily diff
- Monthly summary min/avg/max for cumulative/expression rows; zero-day inclusion controlled by per-row show_zero (default include)
- Label column includes unit-of-measurement
- Layout must be dense — no excessive whitespace

### i18n

Supported from day one: `en`, `de`.

### For Later Implementation

- Separate min/max rows
- Manual weather/snowfall input
- Cross-year month comparison

## Dev Environment

- **Frontend**: Node.js 24.15 in WSL2 — `frontend/` directory, bundles to `frontend/dist/`
- **Python**: 3.14 in WSL2 — tooling and tests
- **Encoding**: UTF-8, LF line endings only (enforced via `.gitattributes`)

## Build & Test Commands

<!-- SPECKIT START -->
Active feature plan: [specs/012-default-entity-precision/plan.md](../specs/012-default-entity-precision/plan.md)
<!-- SPECKIT END -->

All commands run in WSL2, from the `frontend/` directory:

```bash
npm install          # install dependencies
npm run build        # bundle → frontend/dist/calendar-stats-card.js
npm test             # Vitest (write failing tests first — TDD)
npm run test:watch   # watch mode
npm run test:coverage
npm run lint
```

## Core Workflow

This repository uses Speckit for specification-driven development:

1. `/speckit.specify "feature description"` — create feature spec
2. `/speckit.clarify` — resolve ambiguities (max 3 questions)
3. `/speckit.plan` — technical implementation plan
4. `/speckit.tasks` — actionable task breakdown
5. `/speckit.implement` — execute tasks
6. `/speckit.checklist` — verification checklist
7. `/speckit.analyze` — implementation review

## Key Directories

- `.specify/` — Speckit configuration and templates
- `.specify/memory/constitution.md` — project constitution (**fill in via `/speckit.constitution` before first feature**)
- `.specify/extensions/` — workflow extensions (git hooks, scripts)
- `specs/` — feature specifications (`specs/<NNN>-<name>/`)
- `.claude/skills/` — Speckit skill implementations

## Git Workflow

- Automatic commits happen before/after each Speckit step via hooks — **never commit manually during Speckit workflow**
- Feature branches created automatically during `/speckit.specify`; override with `GIT_BRANCH_NAME` env var
- Spec directory name and git branch name are independent
- **Conventional Commits format**: `type(scope): subject`
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
  - Subject ≤72 chars, imperative mood, no trailing period
  - Breaking changes: `!` after type/scope or `BREAKING CHANGE:` footer

## Specification Conventions

- Specs live in `specs/<NNN>-<feature-name>/spec.md`
- Focus on WHAT and WHY — no implementation details in specs
- Success criteria must be measurable and technology-agnostic
- Never put implementation details in specifications
