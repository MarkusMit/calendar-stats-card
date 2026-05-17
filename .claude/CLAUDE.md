# Tabularizer Agent Guidance

## System Prompt

Act as an objective, critical analyst.
Do not praise my ideas, offer compliments, or use polite filler phrases like 'that's a great question!'.
Skip all social niceties and provide direct, blunt, and evidence-based feedback.
Take nothing for granted.
Double-check every fact, remember validated facts.
If I am wrong, tell me immediately and explain why.


## Project / Workspace

Creating a Home Assistant (HA) app for tabular display of some statistics data of configurable entities.
Entities can be configured with optional label override.

Data should be displayed in tables per month, with a column per day-of-month, and montly summaries in additional columns.
Entities with `state_class` "measurement" should be depending on their `device_class`, renderend either just with their value (e.g. for "precipitation") or with average, min and max values (e.g. for "temperature").
Entities with `state_class` "total_increasing" or "increasing" should be rendered with the diff for the day-of-month.
Monthly summary should show monthly statistics, and a "total" value where feasible. For values like "precipitation" the monthly avg/min/max should only consider days with values > zero.
The row's label colum should also include the entities unit-of-measurement.

Example:

| Month         |    1    |   2   | 3 | ... | n-1 | n | Summary | total |
-------------------------------------------------------------------------
|               |     min |                           |     min |       |
| temp (°C)     |  avg    |             ...           |  avg    |       |
|               |     max |                           |     max |       |
-------------------------------------------------------------------------
|               |         |                           |     min |       |
| precip (mm)   |  value  |             ...           |  avg    | total |
|               |         |                           |     max |       |
-------------------------------------------------------------------------
|               |         |                           |     min |       |
| PV prod (kWh) |  value  |             ...           |  avg    | total |
|               |         |                           |     max |       |
-------------------------------------------------------------------------
| ...
-------------------------------------------------------------------------

One page will show tables for all months of a year, if they are not in the future.
The layout should be rather dense. No exceeding white spaces.

The app will be fully i18n-ed. Languages supported from the start: 'en' and 'de-AT'.

### Possible Future features (OUT-OF-SCOPE!)

- optional color coding for values exceeding configurable thresholds
- optional separate table rows for min/max values
- manual input of daily "weather" condition (sunny, foggy, cloudy, heavy clouds, rain, thunderstorms, ...)
- manual input of daily snow fall in mm (or inches?)
- second tab for yearly summaries
- comparison of same month of different years.

### Dev Environment

Home Assistant 2026.5.0 (or newer)
Python 3.14 (latest stable)  in WSL2
NodeJs 24.15 (latest stable) in WSL2

All files in this project will be encoded in UTF-8.
Line breaks are linux new-lines only.

## Core Workflow
This repository uses Speckit for specification-driven development. Follow this sequence:

1. `/speckit.specify "feature description"` - Create feature specification
2. `/speckit.clarify` - Clarify requirements (if needed)
3. `/speckit.plan` - Create technical implementation plan
4. `/speckit.tasks` - Break down into actionable tasks
5. `/speckit.implement` - Implement the feature
6. `/speckit.checklist` - Generate verification checklist
7. `/speckit.analyze` - Review implementation

## Key Directories
- `.specify/` - Speckit configuration and templates
- `.specify/memory/constitution.md` - Project constitution
- `.specify/extensions/` - Workflow extensions (git, etc.)
- `specs/` - Feature specifications (auto-numbered directories)
- `.claude/commands/` - Speckit command implementations

## Git Workflow
- Automatic commits happen before/after each Speckit step via hooks
- Feature branches are created automatically during `/speckit.specify`
- Never commit manually during Speckit workflow - hooks handle it
- Branch naming: automatic or via `GIT_BRANCH_NAME` env var
- **Always use Conventional Commits format** for commit messages: `type(scope): subject` (e.g. `feat(backfill): add batched write service`, `fix(db): handle NULL last_changed_ts`, `docs(spec): clarify FR-007 job lifetime`). Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Subject ≤72 chars, imperative mood, no trailing period. Use a body for the *why* when non-obvious; mark breaking changes with `!` after the type/scope or a `BREAKING CHANGE:` footer.

## Specification Conventions
- Specifications live in `specs/<NNN>-<feature-name>/spec.md`
- Focus on WHAT and WHY, not HOW (no implementation details)
- Max 3 clarification questions per feature
- Success criteria must be measurable and technology-agnostic

## Common Commands
- Check status: `git status`
- View current spec: `cat .specify/feature.json`
- List features: `ls specs/`
- Re-run last step: repeat the Speckit command

## Template Locations
- Spec template: `.specify/templates/spec-template.md`
- Plan template: `.specify/templates/plan-template.md`
- Tasks template: `.specify/templates/tasks-template.md`
- Checklist template: `.specify/templates/checklist-template.md`

## Important Notes
- The spec directory name and git branch name are independent
- Hooks are configured in `.specify/extensions.yml`
- Constitution guides all feature development
- Never put implementation details in specifications

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
