# Contributing

Source repository for **Calendar Stats Card**, a Home Assistant Lovelace custom card that renders dense monthly statistics tables for any HA entity.
End-user documentation lives in [README.md](README.md).

> [!WARNING]
> **Vibe-coded project.** This card was developed with AI assistance (Claude Code).
> Expect AI-generated code and rapid iteration. Review changes critically before merging.

---

## Project layout

```
.
├── frontend/              Lit + TypeScript card source
│   ├── src/               Card, components, services, translations
│   ├── tests/             Vitest unit + component tests
│   └── dist/              Build output (calendar-stats-card.js) — gitignored
├── docs/                  Screenshots
├── .github/workflows/     CI and release automation
├── hacs.json              HACS manifest
└── .claude/               Claude Code project config
```

## Tech stack

- **Card runtime**: [Lit 3](https://lit.dev/) web components, TypeScript 6
- **Bundler**: Rollup 4 (single-file ES module → `frontend/dist/calendar-stats-card.js`)
- **Test runner**: Vitest + happy-dom (no browser required)
- **Target HA version**: 2026.5.0+

## Prerequisites

- Node.js **24** (current LTS)
- Git with UTF-8 / LF line endings (enforced via `.gitattributes`)

## Setup

All `npm` commands run from the `frontend/` directory:

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
npm run typecheck      # tsc --noEmit
npm run check          # lint + typecheck + tests
```

### TDD is non-negotiable

Write the failing test first, confirm it fails, then implement.
The full ruleset is in [`.claude/CLAUDE.md`](.claude/CLAUDE.md).

## Deploy to a real HA instance

Build the bundle and copy it to your HA host's `/config/www/` directory:

```bash
cd frontend
npm run build
scp dist/calendar-stats-card.js user@homeassistant.local:/config/www/calendar-stats/
```

Register `/local/calendar-stats/calendar-stats-card.js` as a JavaScript module resource once.
After each upload reload the browser (Ctrl-Shift-R) or bump the resource URL's `?v=` parameter.

## Branches

- `main` — released code; every commit on it is a release merge and carries a tag
- `dev` — integration branch; features land here first
- Short-lived feature branches off `dev`, merged back into `dev`

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

[optional body]

[optional footer(s)]
```

- **Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Subject**: ≤ 72 chars, imperative mood, no trailing period
- **Body**: 2–6 lines, only when the "why" is not obvious from the subject
- **Breaking changes**: `!` after type/scope (`feat(editor)!: ...`) or a `BREAKING CHANGE:` footer

## Release process

Releases are GitHub Releases with the built bundle attached; HACS installs and updates the card from there.

1. On `dev`: set the new version in `frontend/package.json`.
2. In `CHANGELOG.md`: rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, and add the compare link at the bottom.
3. Commit as `docs(changelog): release X.Y.Z`.
4. Merge `dev` into `main` with `merge(release): vX.Y.Z`.
5. Tag and push:

   ```bash
   git tag vX.Y.Z main
   git push origin main vX.Y.Z
   ```

6. The `Release` workflow validates the tag, checks that `package.json` matches it, runs lint/typecheck/tests, builds the bundle, and publishes the GitHub Release with `calendar-stats-card.js` and the CHANGELOG section as notes.

A release for an existing tag can be re-published from the Actions tab (`Release` → Run workflow → tag).

## Coding rules (short version)

- HA-native design — use HA design tokens and Lovelace components; no custom theming
- i18n from day one — every user-visible string goes through `localize()`; both `en.json` and `de.json` are updated in the same commit
- No decorative whitespace — the card is a dense data display
- YAGNI — no abstractions without a concrete current need
- Markdown: one sentence per line

## License

[MIT](LICENSE).
