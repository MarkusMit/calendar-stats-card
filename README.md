# tabularizer

Source repository for **Calendar Stats Card** — a Home Assistant Lovelace custom card that renders dense monthly statistics tables for any HA entity.

For end-user documentation (what the card does, installation, configuration reference), see [`docs/README.md`](docs/README.md).
This file is for contributors.

> ⚠️ **Disclaimer** — this project is developed using Spec-Driven Development (SDD) and "vibe coding" with AI assistance (Claude Code + Speckit).
> Expect specs-first workflows, AI-generated diffs, and rapid iteration.
> Review changes critically before merging; treat the codebase accordingly when contributing.

---

## Project layout

```
.
├── frontend/              Lit + TypeScript card source
│   ├── src/               Card, components, services, translations
│   ├── tests/             Vitest unit + component tests
│   └── dist/              Build output (calendar-stats-card.js) — gitignored
├── docs/                  User-facing docs and screenshots
├── specs/                 Speckit feature specs (NNN-feature-name/)
├── scripts/               Dev tooling (deploy.sh — gitignored)
├── .specify/              Speckit templates, constitution, hooks
└── .claude/               Claude Code project config
```

## Tech stack

- **Card runtime**: [Lit 3](https://lit.dev/) web components, TypeScript 6
- **Bundler**: Rollup 4 (single-file ES module → `frontend/dist/calendar-stats-card.js`)
- **Test runner**: Vitest 4 + happy-dom (no browser required)
- **Target HA version**: 2026.5.0+

## Prerequisites

- Node.js **24.15**
- Python **3.14** — used for tooling and Speckit scripts only; not shipped
- Git with UTF-8 / LF line endings (enforced via `.gitattributes`)

## Setup

All `npm` / `python` commands run from the `frontend/` directory:

```bash
cd frontend
npm install
```

## Build & test

```bash
npm run build          # bundle → frontend/dist/calendar-stats-card.js
npm test               # Vitest single run
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
npm run lint           # ESLint over src/ and tests/
```

### TDD is non-negotiable

Constitution Principle II: write the failing test first, then the implementation.
See [`.specify/memory/constitution.md`](.specify/memory/constitution.md) for the full ruleset.

## Deploy to a real HA instance

A helper script (`scripts/deploy.sh`, gitignored) builds the bundle and `scp`s it to a configured HA host's `/config/www/calendar-stats/` directory.
Each contributor maintains their own copy.
The script is not checked in because the host/user values are personal.

Manual equivalent:

```bash
cd frontend
npm run build
scp dist/calendar-stats-card.js user@homeassistant.local:/config/www/calendar-stats/
```

Then reload the browser (Ctrl-Shift-R) or bump the resource URL's `?v=` parameter.

## Workflow: Speckit

The repository uses [Speckit](https://github.com/githubnext/speckit) for specification-driven development.
Every feature lives under `specs/<NNN>-<name>/` and goes through the following stages:

| Step | Slash command | Output |
|---|---|---|
| 1 | `/speckit.specify "feature description"` | `spec.md` — WHAT/WHY only |
| 2 | `/speckit.clarify` | Resolves up to 3 ambiguities; appends to `spec.md` |
| 3 | `/speckit.plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| 4 | `/speckit.tasks` | `tasks.md` — actionable, dependency-ordered |
| 5 | `/speckit.implement` | Executes tasks |
| 6 | `/speckit.checklist` | Verification checklist |
| 7 | `/speckit.analyze` | Cross-artifact consistency check |

**Automatic git hooks commit before/after each Speckit step** — never run `git commit` manually during a Speckit workflow, or you will produce duplicate or out-of-order commits.

Feature branch names are auto-generated during `/speckit.specify`; override with `GIT_BRANCH_NAME=...` in the environment if needed.
The spec directory name and the branch name are independent.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/) — enforced by hooks and PR review:

```
type(scope): subject

[optional body]

[optional footer(s)]
```

- **Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Subject**: ≤ 72 chars, imperative mood, no trailing period
- **Breaking changes**: `!` after type/scope (`feat(editor)!: ...`) or a `BREAKING CHANGE:` footer

## Branches

- `main` — released code
- `dev` — integration branch; features land here first via PR
- `NNN-feature-name` — per-feature branches, merged into `dev`

## Coding rules (short version)

- HA-native design — use HA design tokens and Lovelace components; no custom theming
- i18n from day one — every user-visible string goes through `localize()`; both `en.json` and `de.json` must be updated in the same commit
- No decorative whitespace — the card is a dense data display
- YAGNI — no abstractions without a concrete current need
- Out-of-scope features (color coding alternates, separate min/max rows, manual data entry, yearly summary tab, cross-year comparison) must not be implemented even opportunistically

Full ruleset: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## License

TBD.
