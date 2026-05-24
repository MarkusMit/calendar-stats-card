# Implementation Plan: Monthly Stats Card

**Branch**: `001-monthly-stats-card` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-monthly-stats-card/spec.md`

## Summary

Build a Home Assistant Lovelace custom card (`custom:tabularizer-card`) that fetches entity statistics via the HA WebSocket API (`recorder/statistics_during_period`) and renders them as dense monthly tables. Each configured entity is one row per monthly table; columns cover day 1 through last day of month plus a sticky label column, a summary column (min/avg/max), and a total column (cumulative entities only). Year navigation (`‹ YYYY ›`) allows browsing past years bounded by the earliest year with recorded data. Locale is auto-detected from `hass.selectedLanguage`; supported: `en` and `de`.

**Stack**: TypeScript 5.6+ + Lit 3.2 bundled by Rollup 4; tested with Vitest + happy-dom + @open-wc/testing.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 24.15 (WSL2)  
**Primary Dependencies**: Lit 3.2+, custom-card-helpers (types), Rollup 4 (build), Vitest + happy-dom + @open-wc/testing + @vitest/coverage-v8 (test)  
**Storage**: N/A — reads from HA statistics WebSocket API  
**Testing**: Vitest, happy-dom environment, @open-wc/testing component helpers, @vitest/coverage-v8 coverage  
**Target Platform**: HA Lovelace browser runtime, HA 2026.5.0+  
**Project Type**: HA Lovelace custom card (single ES module bundle `tabularizer-card.js`)  
**Performance Goals**: <3s per year-view (initial load + every year navigation), ≤10 entities (SC-007)  
**Constraints**: Dense layout (4px cell padding, zero decorative gap); no internal vertical scroll (FR-035); horizontal scroll per monthly table (FR-026); sticky label column (FR-027); UTF-8 LF line endings  
**Scale/Scope**: Up to 10 entities (soft performance ceiling), 12 months, 2 locales (en, de)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — Root element is `<ha-card>`; all colors and typography use HA CSS custom properties (`--primary-text-color`, `--secondary-text-color`, `--card-background-color`, `--divider-color`, `--ha-card-border-radius`, `--paper-font-body1`). No custom theming or deviations from HA design norms.
- [x] **II. Test-First** — TDD is mandatory and enforced per task. Every task requires tests to be written and confirmed failing before implementation code is written. Red-Green-Refactor cycle applied to every task without exception.
- [x] **III. Density & Data Fidelity** — CSS Grid with 4px cell padding, zero decorative gap. Computation rules: `measurement` → min/avg/max from HA daily stats; monthly min/mean/max from HA monthly stats (authoritative). Cumulative → daily delta (`sum[N] − sum[N-1]`); negative as 0 for `total_increasing`, as-is for `total`. Precipitation only: zero-sum days excluded from monthly summary (FR-016). *(Note: constitution's broad "exclude zero-value days" is refined by spec to precipitation only — this is a spec clarification, not a violation.)*
- [x] **IV. i18n from Day One** — All user-visible strings go through `localize()` from first introduction. Translation files: `src/translations/en.json` and `src/translations/de.json`. Dates via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`. No hard-coded display strings permitted.
- [x] **V. Simplicity** — Out-of-scope features (color coding, separate min/max rows, yearly summary tab, cross-year comparison, graphical config UI) are not implemented. No abstractions introduced without a concrete current need. Every component has an immediately required use case.

*No violations → Complexity Tracking table not required.*

## Commands

All commands run in WSL2, from the `frontend/` directory.

```bash
# Install dependencies (first time)
npm install

# Build → frontend/dist/tabularizer-card.js
npm run build

# Test (Vitest — write failing tests first per TDD)
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Lint (ESLint + TypeScript)
npm run lint

# Type-check only
npx tsc --noEmit
```

## Project Structure

### Documentation (this feature)

```text
specs/001-monthly-stats-card/
├── plan.md                           # This file
├── research.md                       # Phase 0: toolchain + HA API decisions
├── data-model.md                     # Phase 1: domain types + computation rules
├── quickstart.md                     # Phase 1: setup, build, test, deployment
├── contracts/
│   ├── card-config-schema.yaml       # YAML configuration schema (user-facing)
│   └── custom-element-api.md         # Web component + HA WebSocket API contract
└── tasks.md                          # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code

```text
frontend/
├── src/
│   ├── tabularizer-card.ts           # Root custom element (LitElement)
│   ├── components/
│   │   ├── year-navigator.ts         # ‹ YYYY › navigation bar
│   │   ├── year-table.ts             # Primary grid: all months of a year in one table
│   │   ├── monthly-table.ts          # Per-month grid (exists; not used by main card)
│   │   └── loading-overlay.ts        # Spinner overlay during statistics fetch
│   ├── services/
│   │   ├── statistics-service.ts     # HA WebSocket API calls (recorder/statistics_during_period)
│   │   ├── data-transform.ts         # Raw HA API response → DailyValue / MonthlySummary
│   │   └── expression-evaluator.ts   # Arithmetic expression parser and evaluator
│   ├── localize/
│   │   └── localize.ts               # i18n key lookup + Intl formatting helpers
│   ├── translations/
│   │   ├── en.json                   # English strings
│   │   └── de.json                   # German strings
│   └── types/
│       ├── card-config.ts            # CardConfig, EntityConfig union (EntityRowConfig | ExpressionRowConfig)
│       ├── statistics.ts             # DailyValue, MonthlySummary, ViewState, EntityMetadata
│       └── ha-types.ts               # Minimal HA API type shims (HomeAssistant, etc.)
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── statistics-service.test.ts
│   │   │   └── data-transform.test.ts
│   │   └── localize/
│   │       └── localize.test.ts
│   └── component/
│       ├── year-navigator.test.ts
│       ├── monthly-table.test.ts
│       └── tabularizer-card.test.ts
├── dist/                             # Build output (gitignored)
├── package.json
├── rollup.config.js
├── tsconfig.json
└── vitest.config.ts

# HA deployment:
# frontend/dist/tabularizer-card.js → <ha-config>/www/tabularizer-card.js
```

**Structure Decision**: Single frontend project (no backend). Rollup bundles `frontend/src/` → `frontend/dist/tabularizer-card.js` as a single ES module. Tests live in `frontend/tests/`, mirroring the `src/` structure.

## Key Design Decisions

### Statistics fetch strategy

Two API requests per year-view, all entities batched into one request per period:

| Request | Period | Data used for |
|---|---|---|
| `recorder/statistics_during_period` | `"day"` | Day-column cell values |
| `recorder/statistics_during_period` | `"month"` | Measurement summary (authoritative); cumulative total column |
| `recorder/statistics_during_period` | `"hour"` | Coverage indicator detection (recent data only; fails silently if outside retention) |
| `recorder/list_statistic_ids` | N/A | Confirm entity has long-term statistics (FR-029) |

### mean_type / has_mean compatibility (SC-009)

Runtime version detection via `hass.config.version`:
- HA 2026.5–2026.10: use `has_mean` boolean from statistics metadata
- HA 2026.11+: use `mean_type` integer (0=NONE, 1=ARITHMETIC, 2=CIRCULAR)
- Combined detection: `meta.mean_type ?? (meta.has_mean ? 1 : 0)`

### Timezone

All date arithmetic (today's boundary, month boundaries, visible-month rules) uses `hass.config.time_zone` via the `Temporal` API or `Intl.DateTimeFormat` with `timeZone` option. Browser timezone is never used.

### Coverage indicators

Asterisk `*` shown only when hourly stats are available and confirm partial coverage. For data older than the HA recorder's hourly retention window (~10 days default), no asterisk is shown.

### Monthly total for first tracked month (FR-011)

When no prior-month `sum` entry exists in the monthly-period stats, use `monthlySum[0]` directly as the total (the cumulative sum equals the month's accumulation since tracking started).

### Year-table architecture

The card renders all months of a year in a single `<year-table>` component instead of one `<monthly-table>` per month. This allows the day-number header row to be shared across months and gives a more compact layout. The `monthly-table` component is retained for potential standalone use but is not used by the main card.

### Expression rows

The `entities` config list may include expression rows in addition to entity rows. An expression row uses an arithmetic formula (e.g. `{{ sensor.a - sensor.b }}`) to derive daily values from constituent entities' daily sums. The `expression-evaluator.ts` service parses and evaluates the formula per day. Expression rows always produce cumulative-style data (single sum per day cell) and do not have `stateClass`/`deviceClass` metadata.
