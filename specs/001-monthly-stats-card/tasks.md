# Tasks: Monthly Stats Card

**Input**: Design documents from `specs/001-monthly-stats-card/`
**Branch**: `001-monthly-stats-card`
**Constitution**: TDD is **NON-NEGOTIABLE** — every implementation task is preceded by a test task that must be written first and confirmed failing before implementation begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies within the phase)
- **[US#]**: Which user story this task belongs to
- All commands run in WSL (`bash` tool), from `frontend/`

---

## Phase 1: Setup

**Purpose**: Bootstrap the frontend project — no implementation logic here.

- [x] T001 Create `frontend/` directory structure: `src/components/`, `src/services/`, `src/localize/`, `src/translations/`, `src/types/`, `tests/unit/services/`, `tests/unit/localize/`, `tests/component/`, `dist/`
- [x] T002 Create `frontend/package.json` with all runtime and dev dependencies: `lit@3`, `custom-card-helpers`, `rollup@4`, `@rollup/plugin-typescript`, `@rollup/plugin-node-resolve`, `@rollup/plugin-terser`, `typescript@5.6`, `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@open-wc/testing`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`; add npm scripts: `build`, `test`, `test:watch`, `test:coverage`, `lint`
- [x] T003 [P] Create `frontend/rollup.config.js`: input `src/calendar-stats-card.ts`, output `dist/calendar-stats-card.js` as ES module, single minified bundle via `@rollup/plugin-typescript` + `@rollup/plugin-terser`
- [x] T004 [P] Create `frontend/tsconfig.json`: `target: ES2022`, `lib: ["ES2023","DOM","DOM.Iterable"]`, `strict: true`, `noUncheckedIndexedAccess: true`, `experimentalDecorators: true`, `useDefineForClassFields: false`, `moduleResolution: bundler`
- [x] T005 [P] Create `frontend/vitest.config.ts`: `environment: 'happy-dom'`, `include: ['tests/**/*.test.ts']`, `coverage.provider: 'v8'`, `setupFiles` importing `@open-wc/testing`

**Checkpoint**: `npm install` runs clean; `npm run build` produces `dist/calendar-stats-card.js` (empty entry file); `npm test` runs (zero tests pass/fail)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and domain types that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Define all TypeScript types in `frontend/src/types/`: `card-config.ts` (EntityConfig, CardConfig); `statistics.ts` (EntityMetadata, MeasurementDailyValue, CumulativeDailyValue, EmptyDailyValue, DailyValue union, MonthlySummary, ViewState, YearStatistics — exact shapes from `data-model.md`); `ha-types.ts` (HomeAssistant interface shim covering `config.version`, `config.time_zone`, `states`, `connection.sendMessagePromise`, `selectedLanguage`, `language`)
- [x] T007 [P] Write failing unit tests for `localize()` in `frontend/tests/unit/localize/localize.test.ts`: key lookup returns correct string for `en`; key lookup returns correct string for `de-AT`; unknown language falls back to `en`; nested key path (e.g. `'table.summary'`) resolves correctly; missing key returns the key string itself
- [x] T008 [P] Implement `frontend/src/localize/localize.ts`: nested JSON key traversal, language fallback to `en`; create skeleton `frontend/src/translations/en.json` and `frontend/src/translations/de.json` with all keys from research.md §6 (values can be placeholders — filled in Phase 7)
- [x] T009 [P] Write failing unit tests for `data-transform.ts` in `frontend/tests/unit/services/data-transform.test.ts`: daily delta from consecutive `sum` values; first-day delta uses `sum[0]` directly; negative delta for `total_increasing` → 0; negative delta for `total` → preserved as-is; today (HA server timezone) → `EmptyDailyValue`; future day → `EmptyDailyValue`; MonthlySummary for measurement → passes through HA monthly values; MonthlySummary for `device_class: precipitation` → zero-sum days excluded from min/mean/max (**FR-016: zero-exclusion applies ONLY to `device_class: precipitation` — not all cumulative entities**); MonthlySummary for energy (non-precipitation cumulative) → zero-sum days INCLUDED in min/mean/max; monthly total = `monthlySum[M] − monthlySum[M-1]`; first tracked month total = `monthlySum[0]`; `partialCoverage: true` when hourly count < 24 for measurement; `partialCoverage: true` when first or last hour missing for cumulative; `partialCoverage: false` when hourly data unavailable (silent)
- [x] T010 [P] Write failing unit tests for `statistics-service.ts` in `frontend/tests/unit/services/statistics-service.test.ts`: sends `recorder/statistics_during_period` with `period:'day'` for all entity IDs batched; sends same command with `period:'month'`; sends same with `period:'hour'`; sends `recorder/list_statistic_ids`; sends `recorder/get_statistics_metadata` and returns earliest `start` timestamp across all entity IDs (used for earliestDataYear/earliestDataMonth — FR-004, FR-007); on HA < 2026.11 uses `has_mean` param; on HA ≥ 2026.11 uses `mean_type` param; rejects with error on WS failure
- [x] T011 Implement `frontend/src/services/statistics-service.ts`: `hass.connection.sendMessagePromise` wrappers for all four WS commands; add `getStatisticsMetadata(hass, entityIds)` wrapper for `recorder/get_statistics_metadata` — returns `{ earliestYear: number, earliestMonth: number }` derived from the minimum `start` value across all entity metadata entries (required by T032 for FR-004/FR-007 earliestDataYear detection); `hass.config.version` parsing (`"YYYY.MM.PATCH"` → `[number, number, number]`) for has_mean/mean_type branching; batch all entity IDs into one request per period type; return typed response objects
- [x] T012 Implement `frontend/src/services/data-transform.ts`: raw HA daily-period stats → `DailyValue[]` (delta computation, today/future → `EmptyDailyValue` using `Intl.DateTimeFormat` in `hass.config.time_zone`, coverage from hourly stats); raw HA monthly-period stats → `MonthlySummary[]` (measurement: pass-through from HA; cumulative: card-computed min/mean/max — **FR-016: zero-exclusion applies ONLY when `device_class === 'precipitation'`; all other cumulative entities include zero-sum days**; monthly total as `sum` delta)

**Checkpoint**: `npm test` passes all unit tests in `tests/unit/`

---

## Phase 3: User Story 1 — View Annual Entity Statistics (Priority: P1) 🎯 MVP

**Goal**: Card loads and renders monthly tables for all visible months; loading overlay shown during fetch; empty cells for future/today.

**Independent Test**: Configure card with one `measurement` entity; open dashboard; verify monthly tables appear for all months January through current month of the current year; future months absent; loading spinner shown briefly then replaced by tables.

> **TDD**: Write and confirm test FAILS before implementing each component.

- [x] T013 [P] [US1] Write failing component test for `loading-overlay.ts` in `frontend/tests/component/loading-overlay.test.ts`: renders spinner element when `visible=true`; renders nothing (or hidden) when `visible=false`; uses `--primary-text-color` for spinner colour
- [x] T014 [P] [US1] Write failing component test for `monthly-table.ts` structure in `frontend/tests/component/monthly-table.test.ts`: renders month name in header; renders correct number of day columns for the month (28/29/30/31); renders a label column as first column; renders a summary column after day columns; label column has `position: sticky; left: 0` style; table container has `overflow-x: auto`; entity row with all-empty DailyValues renders empty cells; card root (`<ha-card>`) `overflowY` is not `scroll` or `auto` (FR-035: no internal vertical scroll); day cell computed padding ≤ 4px (FR-023: dense layout)
- [x] T015 [P] [US1] Write failing component test for `calendar-stats-card.ts` year/month logic in `frontend/tests/component/calendar-stats-card.test.ts`: defaults to current year on non-Jan-1 date; defaults to previous year when today is Jan 1 (both determined via `hass.config.time_zone`); shows monthly tables from Jan through current month for current year; shows 12 monthly tables for a fully past year; renders loading overlay while statistics are being fetched; no tables rendered during loading state
- [x] T016 [US1] Implement `frontend/src/components/loading-overlay.ts`: LitElement; `visible: boolean` property; spinner element (CSS animation) positioned as overlay; HA design tokens (`--primary-text-color`, `--card-background-color` at 80% opacity)
- [x] T017 [US1] Implement `frontend/src/components/monthly-table.ts` structure: LitElement; properties: `month: number`, `year: number`, `entityConfigs: EntityConfig[]`, `dailyValues: Map<string, DailyValue>`, `monthlySummaries: Map<string, MonthlySummary>`, `entityMetadata: Map<string, EntityMetadata>`, `lang: string`; render month header row (month name via `Intl.DateTimeFormat`); render entity rows with: label column (`position: sticky; left: 0; z-index: 1`), N day columns (correct count per month/year), summary column header; empty cells render as blank; CSS Grid layout, 4px cell padding, zero decorative gap; `overflow-x: auto` on table container
- [x] T018 [US1] Implement `frontend/src/calendar-stats-card.ts` core: LitElement with `@customElement('calendar-stats-card')`; `setConfig(config)` — validates `entities` is array, throws on invalid shape; `set hass(hass)` — stores ref, triggers statistics fetch on first call, re-reads entity friendly names on subsequent calls; year defaulting logic (today via `Intl.DateTimeFormat([], {timeZone: hass.config.time_zone})` — current year unless Jan 1 → prev year); visible months calculation (current year: Jan–current month; past year: all 12; earliest year: first-month-with-data onward); fetch via `statistics-service` then `data-transform`; render `<ha-card>` containing `<loading-overlay>` + one `<monthly-table>` per visible month; `getCardSize()` returns visible month count; `window.customCards` registration

**Checkpoint**: US1 acceptance scenario 1–4 verifiable manually; unit + component tests pass

---

## Phase 4: User Story 2 — View Dense Daily Statistics per Entity (Priority: P1)

**Goal**: Each entity row renders correct cell content based on `state_class` and `device_class`; summary and total columns correct; error states handled gracefully.

**Independent Test**: Configure one temperature (`measurement`) and one precipitation (`total_increasing`, `device_class: precipitation`) entity; verify temperature shows min/avg/max per day cell; precipitation shows daily sum; precipitation monthly summary excludes zero-sum days; temperature has no total column.

> **TDD**: Write and confirm test FAILS before implementing each rendering feature.

- [x] T019 [P] [US2] Write failing component tests for measurement rendering in `frontend/tests/component/monthly-table.test.ts`: `MeasurementDailyValue` → day cell shows `min/avg/max` combined in one row; `partialCoverage: true` → asterisk `*` appended to cell value; `partialCoverage: false` → no asterisk; no separate min/max rows rendered
- [x] T020 [P] [US2] Write failing component tests for cumulative rendering in `frontend/tests/component/monthly-table.test.ts`: `CumulativeDailyValue` → day cell shows single `sum` value; `sum < 0` for `total_increasing` → cell shows `0`; `sum < 0` for `total` → cell shows negative value as-is; `partialCoverage: true` → asterisk; EmptyDailyValue → blank cell
- [x] T021 [P] [US2] Write failing component tests for summary column in `frontend/tests/component/monthly-table.test.ts`: measurement entity → summary shows `MonthlySummary.min / .mean / .max` from HA directly; precipitation entity → summary shows card-computed values excluding zero-sum days (not from HA monthly mean); energy entity → summary includes zero-sum days
- [x] T022 [P] [US2] Write failing component tests for total column in `frontend/tests/component/monthly-table.test.ts`: cumulative entity (`total_increasing` or `total`) → total column rendered with `MonthlySummary.total` value; measurement entity → no total column rendered (column absent from DOM)
- [x] T023 [US2] Implement measurement entity row rendering in `frontend/src/components/monthly-table.ts`: detect entity kind from `EntityMetadata.stateClass === 'measurement'`; render `min / avg / max` combined in one `<td>` per day (e.g. `"18.3 / 22.1 / 26.5"`); append superscript `*` when `partialCoverage: true`
- [x] T024 [US2] Implement cumulative entity row rendering in `frontend/src/components/monthly-table.ts`: detect kind from `stateClass` in `['total_increasing', 'total']`; render single `sum` value per day cell; enforce zero-floor only for `total_increasing` (negative → `0`); `total` entities render negative as-is; append superscript `*` when `partialCoverage: true`; `EmptyDailyValue` → render empty cell
- [x] T025 [US2] Implement summary column rendering in `frontend/src/components/monthly-table.ts`: measurement → render `MonthlySummary.min` / `.mean` / `.max` (authoritative from HA monthly stats, no card recomputation); cumulative → render card-computed min/mean/max from `MonthlySummary` (already computed in `data-transform.ts`); label rows: "min", "avg", "max" via `localize()`
- [x] T026 [US2] Implement total column rendering in `frontend/src/components/monthly-table.ts`: cumulative entities only (skip for measurement); render `MonthlySummary.total`; column header via `localize('table.total')`; total column absent from DOM for measurement entity rows
- [x] T027 [P] [US2] Write failing component tests for entity error states in `frontend/tests/component/monthly-table.test.ts`: `EntityMetadata.hasStatistics: false` → label cell shows warning indicator (⚠ or equivalent), all day cells empty; fetch error (`DailyValue` fetch fails for one entity) → that entity's cells show `—`; other entity rows are unaffected and render normally
- [x] T028 [US2] Implement entity error states in `frontend/src/components/monthly-table.ts` and `frontend/src/calendar-stats-card.ts`: `hasStatistics: false` → warning indicator on label cell, empty day cells (FR-029); statistics fetch failure per entity → store error state in `ViewState`; render `—` in affected cells (FR-019); partial failure leaves successful entities intact

**Checkpoint**: US2 acceptance scenarios 1–5 verifiable; all T019–T028 tests pass

---

## Phase 5: User Story 3 — Navigate Between Years (Priority: P2)

**Goal**: Year navigator allows stepping back to previous years; left arrow disabled at earliest data year; right arrow disabled at current year; correct month visibility per year type.

**Independent Test**: With HA history spanning 2+ years, navigate to previous year via left arrow; verify all 12 monthly tables appear; navigate back to current year; verify only Jan–current month shown; right arrow disabled on current year.

> **TDD**: Write and confirm test FAILS before implementing navigator.

- [x] T029 [P] [US3] Write failing component test for `year-navigator.ts` in `frontend/tests/component/year-navigator.test.ts`: renders `‹`, year label, `›` in correct layout; left arrow click emits custom event `calendar-stats-prev-year`; right arrow click emits `calendar-stats-next-year`; `atEarliestYear: true` → left arrow has `disabled` attribute; `atCurrentYear: true` → right arrow has `disabled` attribute; neither disabled for mid-range year; year label displays the passed `year` number
- [x] T030 [P] [US3] Write failing integration tests for year navigation in `frontend/tests/component/calendar-stats-card.test.ts`: navigating to prev year triggers statistics fetch for new year; prev year (fully past) renders 12 monthly tables; current year renders Jan–current month tables; earliest data year renders only months from first-data-month onward; left arrow disabled when `selectedYear === earliestDataYear`; right arrow disabled when `selectedYear === currentYear`; `<3s` fetch not enforced in tests but year change triggers re-render
- [x] T031 [US3] Implement `frontend/src/components/year-navigator.ts`: LitElement; properties: `year: number`, `atCurrentYear: boolean`, `atEarliestYear: boolean`; renders `‹ YYYY ›` layout; left/right `<button>` elements; `disabled` attribute applied when at boundary; dispatches `new CustomEvent('calendar-stats-prev-year')` and `new CustomEvent('calendar-stats-next-year')` on click; uses HA design tokens for button styling
- [x] T032 [US3] Implement year navigation in `frontend/src/calendar-stats-card.ts`: integrate `<year-navigator>` in render output above monthly tables; listen for `calendar-stats-prev-year` / `calendar-stats-next-year` events; update `selectedYear` (clamped to `[earliestDataYear, currentYear]`); call `getStatisticsMetadata()` from T011 on first hass set to resolve `earliestDataYear` and `earliestMonth` (FR-004, FR-007); use `earliestMonth` to hide months before first data in the earliest year; refetch statistics for new year on navigation; recompute visible months for selected year; update `<year-navigator>` props (`atCurrentYear`, `atEarliestYear`)

**Checkpoint**: US3 acceptance scenarios 1–5 verifiable; T029–T032 tests pass

---

## Phase 6: User Story 4 — Configure Entities and Label Overrides (Priority: P2)

**Goal**: Label override applies correctly; HA friendly name used as fallback; unit appended; empty config shows placeholder; duplicate entity IDs each produce their own row.

**Independent Test**: Edit card YAML with 3 entities (2 with label overrides, 1 without); verify overridden labels displayed; verify fallback to HA friendly name; verify unit of measurement appended to each label.

> **TDD**: Write and confirm test FAILS before implementing label logic.

- [x] T033 [P] [US4] Write failing component tests for configuration behaviour in `frontend/tests/component/calendar-stats-card.test.ts`: `config.name` set → label column shows override (not HA friendly name); `config.name` absent → label column shows `hass.states[id].attributes.friendly_name`; `unitOfMeasurement` from `EntityMetadata` appended to label in label column; `config.entities = []` → no monthly tables rendered, localised no-entities placeholder message visible; two entries with same entity ID → two separate rows in each monthly table
- [x] T034 [US4] Implement label resolution in `frontend/src/calendar-stats-card.ts`: resolve display label as `entityConfig.name ?? entityMetadata.friendlyName ?? entityConfig.entity`; append `entityMetadata.unitOfMeasurement` (e.g. `" [°C]"`) to the label passed to `monthly-table.ts` (FR-009, FR-021, FR-022); pass resolved labels per `EntityConfig` entry (not per unique entity ID — duplicates each get their own label)
- [x] T035 [US4] Implement no-entities placeholder in `frontend/src/calendar-stats-card.ts`: when `config.entities` is empty array render `<p class="no-entities">` with `localize('card.no_entities', lang)` message; no `<monthly-table>` elements rendered; placeholder styled with `--secondary-text-color` (FR-033)

**Checkpoint**: US4 acceptance scenarios 1–3 verifiable; T033–T035 tests pass

---

## Phase 7: User Story 5 — Localized Display (Priority: P3)

**Goal**: All UI text renders in the active HA locale (`en` or `de-AT`); locale auto-detected from `hass`; no hard-coded display strings anywhere.

**Independent Test**: Set HA language to `de-AT`; load card; verify month names show "Jänner", "Februar"/"Feber", …, "Dezember" and all UI labels are in German. Switch to `en`; verify English throughout.

> **TDD**: Write and confirm test FAILS before wiring locale.

- [x] T036 [P] [US5] Write failing component tests for localised display in `frontend/tests/component/calendar-stats-card.test.ts`: `hass.selectedLanguage = 'de-AT'` → month names in Austrian German (January = "Jänner" via `Intl.DateTimeFormat('de-AT')`); `hass.language = 'en'` → English month names and UI strings; `localize()` called with `'de-AT'` produces German UI strings; no hard-coded English string visible in rendered output when locale is `de-AT`
- [x] T037 [P] [US5] Fill complete translation keys in `frontend/src/translations/en.json` and `frontend/src/translations/de.json`: all keys from `localize.ts` skeleton (`card.no_entities`, `card.loading`, `table.label`, `table.summary`, `table.total`, `table.day_header`, `nav.previous_year`, `nav.next_year`, `warning.no_statistics`, `error.fetch_failed`, `summary.min`, `summary.avg`, `summary.max`); Austrian German values must use official forms ("Jänner" handled by `Intl`; other labels use standard Austrian German)
- [x] T038 [US5] Wire locale detection throughout all components in `frontend/src/`: `calendar-stats-card.ts` computes `lang = hass.selectedLanguage ?? hass.language ?? 'en'` and passes to all child components as `lang` property; `monthly-table.ts` uses `localize(key, lang)` for all column headers, summary row labels, warning text; uses `Intl.DateTimeFormat(lang, {month:'long'})` for month header name; uses `Intl.NumberFormat(lang, {maximumFractionDigits:1})` for cell values; `year-navigator.ts` uses `localize(key, lang)` for aria-labels; `loading-overlay.ts` uses `localize('card.loading', lang)` for accessible label
- [x] T039 [US5] Verify `de` `Intl` behaviour in `frontend/tests/unit/localize/localize.test.ts`: confirm `new Intl.DateTimeFormat('de', {month:'long'}).format(new Date(2026,0))` returns `'Jänner'` under happy-dom; confirm all 12 Austrian month names are correct; confirm `Intl.NumberFormat('de').format(1234.5)` uses comma decimal separator

**Checkpoint**: US5 acceptance scenarios 1–2 verifiable; T036–T039 tests pass

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, i18n audit, build verification.

- [x] T040 [P] Audit all `render()` methods in `frontend/src/` for hard-coded display strings: search for string literals that are user-visible but not routed through `localize()` or `Intl`; fix any found; no new tests required (covered by existing i18n tests)
- [x] T041 [P] Run full test suite in WSL (`npm test`) and confirm all tests pass; run `npm run test:coverage`; verify branch coverage ≥ 80% for `data-transform.ts` and `statistics-service.ts`; if below 80%, write additional unit tests targeting uncovered branches before proceeding to T042
- [x] T042 Run build in WSL (`npm run build`); confirm `frontend/dist/calendar-stats-card.js` exists as a single ES module (starts with `import` or is self-contained); confirm no unresolved `import` statements remain in bundle; confirm `window.customCards` registration present in output
- [ ] T043 End-to-end smoke test per `specs/001-monthly-stats-card/quickstart.md`: deploy `calendar-stats-card.js` to HA 2026.5 test instance; configure 3 entities (`measurement`, `total_increasing` precipitation, `total_increasing` energy); verify each criterion below — all must pass before marking complete:
  - **US1**: Monthly tables visible Jan–current month; no future months; loading spinner appears then clears (SC-001, SC-003)
  - **US2**: Temperature row shows min/avg/max per cell; precipitation row shows daily sum; precipitation monthly summary excludes zero days; energy monthly summary includes zero days; no total column on temperature rows (SC-004)
  - **US3**: Left/right ‹ › navigate by year; past year shows 12 months; earliest year shows only months from first data onward; left arrow disabled at earliest year; right arrow disabled at current year (SC-002)
  - **US4**: Label overrides display correctly; friendly name used when no override; unit of measurement appended; empty config shows placeholder (SC-005)
  - **US5**: Set HA locale to `de-AT` — month names show "Jänner" for January; all UI labels in German; switch to `en` — English throughout (SC-006)
  - **SC-009**: Repeat US1 smoke test on HA ≥ 2026.11 instance (mean_type API); verify identical rendering with no config changes required
- [x] T044 [P] Replace per-month table rendering with single `year-table.ts` component in `frontend/src/components/year-table.ts`: renders all visible months of a year in one scrollable table; day-number header shared across months; month name header rows repeat every month; sub-label column (min/avg/max) for measurement entities; cumulative/expression rows use colspan=2 label in mixed tables; write component tests in `frontend/tests/component/year-table.test.ts`; update `calendar-stats-card.ts` to import and render `<year-table>` instead of per-month `<monthly-table>` elements
- [x] T045 [P] Add `factor` and `unit` fields to `EntityRowConfig` in `frontend/src/types/card-config.ts`: `factor?: number` (value multiplier, default 1); `unit?: string` (unit override for label column); apply factor to day cells and summary columns in `year-table.ts` and `monthly-table.ts`; add tests for both fields
- [x] T046 [P] Add `show_zero` field to `EntityRowConfig` and `ExpressionRowConfig` in `frontend/src/types/card-config.ts`: `show_zero?: boolean` (default true); when false, day cells with computed value 0 render blank in `year-table.ts` and `monthly-table.ts`; summary columns unaffected; add tests for cumulative and measurement rows in `frontend/tests/component/monthly-table.test.ts` and `frontend/tests/component/year-table.test.ts`
- [x] T047 Implement `ExpressionRowConfig` support: add `expression: string` variant to `EntityConfig` union in `frontend/src/types/card-config.ts`; create `frontend/src/services/expression-evaluator.ts` (arithmetic parser supporting entity IDs, numeric literals, +/-/*// and parentheses, `{{ }}` delimiters); in `calendar-stats-card.ts` compute expression daily values from constituent entity daily sums and expression monthly summaries from those daily values; support `name`, `unit`, `precision`, `show_zero` fields; expression rows render as single cumulative-style row per month
- [x] T048 [P] Add sub-label column for measurement row identification in `year-table.ts` and `monthly-table.ts`: narrow column between label column and day columns; shows localised `min`/`avg`/`max` text (or `Ø` in de locale) for each measurement sub-row; cumulative/expression rows in mixed tables use colspan=2 on label cell; month header rows adjusted for extra column; add `hasMeasurement()` helper; update tests
- [x] T049 Fix measurement monthly summary computation in `frontend/src/services/data-transform.ts`: HA monthly-period stats return min/max of period means, not true daily extremes — recompute measurement min/mean/max from daily `DailyValue` entries for consistency with displayed day cells

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — MUST complete before US2 (monthly-table structure needed)
- **US2 (Phase 4)**: Depends on US1 (adds rendering to existing monthly-table structure)
- **US3 (Phase 5)**: Depends on Phase 2 — can start in parallel with US1/US2 (different component)
- **US4 (Phase 6)**: Depends on Phase 3 (extends calendar-stats-card.ts from US1)
- **US5 (Phase 7)**: Depends on Phase 2 (i18n skeleton) — translation fill (T037) can start anytime after T008
- **Polish (Phase 8)**: Depends on all user stories complete

### Story Dependencies Summary

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
        ├── Phase 3 (US1) ──── Phase 4 (US2)
        │                          └── Phase 6 (US4)
        ├── Phase 5 (US3) [independent of US1/US2 component-wise]
        └── Phase 7 (US5) [translation fill T037 can run alongside Phase 3+]
              └── Phase 8 (Polish)
```

### Within Each Phase

1. Tests written and **confirmed FAILING**
2. Implementation written until tests pass
3. Red-Green-Refactor: clean up implementation once green
4. Run `npm test` before moving to next task

### Parallel Opportunities Within Phases

**Phase 2**: T007, T009, T010 can all run in parallel (different files); T011 after T010 passes; T012 after T009 passes; T008 after T007 passes

**Phase 3**: T013, T014, T015 can run in parallel (different test files); T016 after T013; T017 after T014; T018 after T015

**Phase 4**: T019, T020, T021, T022, T027 can run in parallel (all add to monthly-table tests); implementations T023–T026 sequential within the file; T028 after T027

**Phase 5**: T029, T030 in parallel; T031 after T029; T032 after T030

---

## Parallel Example: Phase 2 (Foundational)

```
Parallel batch 1:
  T007 — write failing localize tests
  T009 — write failing data-transform tests
  T010 — write failing statistics-service tests

After batch 1 completes:
  T008 — implement localize (T007 → green)
  T011 — implement statistics-service (T010 → green)
  T012 — implement data-transform (T009 → green)
```

## Parallel Example: Phase 4 (US2)

```
Parallel batch — all write failing tests:
  T019 — measurement rendering tests
  T020 — cumulative rendering tests
  T021 — summary column tests
  T022 — total column tests
  T027 — error state tests

Sequential implementation (same file, monthly-table.ts):
  T023 → T024 → T025 → T026 → T028
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**cannot skip**)
3. Complete Phase 3: US1 → deploy, verify monthly tables appear
4. Complete Phase 4: US2 → deploy, verify correct cell content
5. **STOP and VALIDATE**: one temperature + one precipitation entity renders correctly

### Incremental Delivery

1. Setup + Foundational → types and services ready
2. US1 → card loads, tables visible (MVP structure)
3. US2 → cells show correct data per entity type (MVP complete)
4. US3 → year navigation added
5. US4 → label overrides refined
6. US5 → full i18n

---

## Notes

- `[P]` tasks: different files, no blocking same-phase dependencies
- `[US#]` maps task to user story for traceability
- All node/npm commands in WSL via `bash` tool
- Conventional Commits for any manual commits: `type(scope): subject`
- TDD is the only accepted workflow: Red → Green → Refactor, no exceptions
- Estimated test counts: Phase 2 ≈ 20 tests; Phase 3 ≈ 9 tests; Phase 4 ≈ 16 tests; Phase 5 ≈ 10 tests; Phase 6 ≈ 6 tests; Phase 7 ≈ 8 tests (C1/SC-007 deferred — no automated perf test)
