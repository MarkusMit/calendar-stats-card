# Quickstart: Threshold Aggregation Scope

## Prerequisites

- WSL2, Node.js 24.15, work in `frontend/`.
- Green baseline before any new work: `npm test` (572 tests passing as of 2026-07-11).

## TDD order

1. **Resolver** — extend `tests/unit/services/threshold-resolver.test.ts`:
   scope-less rule matches `day` cells only; `month`/`year` rules match only their scope; mixed lists rank closest-wins within the cell's scope only; invalid scope string behaves as `day`; role exclusions (`not-below`/`not-above`) still apply within each scope.
   Then implement the `cellScope` parameter + filter in `src/services/threshold-resolver.ts` and update `src/types/card-config.ts`.
2. **Yearly view** — extend `tests/component/year-summary-table.thresholds.test.ts`:
   day-rule no longer colors cumulative month cells or the cumulative rollup; month-rule colors exactly the qualifying month cells and rollup; year-rule colors the yearly Total column; measurement cells keep day-rule coloring.
   Then pass scopes in `src/components/year-summary-table.ts` (incl. new Total-column evaluation).
3. **Monthly view** — component test for `year-table`:
   daily cells unchanged under day rules; month-rule colors the Total column; day-rule never colors the Total column.
   Then update `src/components/year-table.ts`.
4. **Comparison view** — extend `tests/component/month-comparison-table.test.ts`:
   cumulative value cells and cross-year average obey `month` scope; measurement cells obey `day` scope; diff cells stay uncolored.
   Then update `src/components/month-comparison-table.ts`.
5. **Editor** — extend `tests/component/threshold-list-editor.test.ts`:
   scope select present with Day/Month/Year, defaults to Day for scope-less rules, change event writes `scope`, German labels.
   Then update `src/components/threshold-list-editor.ts` + `src/translations/en.json` / `de.json`.

## Verification

```bash
npm test
npm run lint
npm run build
```

Manual check in HA: precipitation row with `above: 10` (no scope) + `above: 150, scope: month`:

- Monthly view: rainy days colored as before; Total column colored only when the month exceeds 150.
- Yearly view: month cells colored only by the month rule; no cell colored by the day rule.
- Comparison view: same gating; legend lists only rules that fired.
