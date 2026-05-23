# Design: `show_zero` Entity Config Option

**Date:** 2026-05-24
**Branch:** 001-monthly-stats-card

## Overview

Add a `show_zero` boolean option to entity configuration. When `false`, day cells with a computed value of `0` render as blank instead of `0`. Summary statistics (min/avg/max/total columns) are unaffected.

## Scope

Display-only change. No data pipeline modifications.

## Type Changes

`card-config.ts`: add `show_zero?: boolean` to both `EntityRowConfig` and `ExpressionRowConfig`.

```ts
export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
  show_zero?: boolean;  // default true
}

export interface ExpressionRowConfig {
  expression: string;
  name?: string;
  unit?: string;
  precision?: number;
  show_zero?: boolean;  // default true
}
```

Default is `true` (zeros shown). Field omitted = show zeros. `false` = suppress zeros.

## Rendering Logic

Check: `cfg.show_zero !== false` — evaluates `true` when field is omitted or explicitly `true`.

### Cumulative day cells (`monthly-table.ts`, `year-table.ts`)

When building cell content for `val.kind === 'cumulative'`:
- If `val.sum * factor === 0` and `show_zero === false` → empty cell (no content, no `has-data` class)
- Otherwise → existing render path unchanged

### Measurement day cells (`monthly-table.ts`, `year-table.ts`)

Three sub-rows (min, mean, max) each checked independently:
- If the respective value `* factor === 0` and `show_zero === false` → empty `<td class="data-cell">`
- Otherwise → existing render path unchanged

## What Is NOT Affected

- Summary columns (min/avg/max/total) — always rendered regardless of `show_zero`
- `partialCoverage` asterisk logic — unchanged
- `isPrecipitation` zero-exclusion in `data-transform.ts` — independent mechanism, unchanged
- Error/no-stats cell states — unchanged

## Test Cases

| Scenario | Expected |
|---|---|
| `show_zero` omitted, day value = 0 | renders `0` |
| `show_zero: true`, day value = 0 | renders `0` |
| `show_zero: false`, cumulative day value = 0 | blank cell, no `has-data` class |
| `show_zero: false`, measurement day value = 0 | blank cell in each sub-row |
| `show_zero: false`, day value ≠ 0 | renders normally |
| `show_zero: false`, no data for day | still blank (unchanged) |

## Files Changed

- `frontend/src/types/card-config.ts`
- `frontend/src/components/monthly-table.ts`
- `frontend/src/components/year-table.ts`
- `frontend/tests/component/monthly-table.test.ts`
- `frontend/tests/component/year-table.test.ts`
