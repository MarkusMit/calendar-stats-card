# Contract: `data-transform.ts` Function Signatures

## `computeMonthlySummaryFromDailyValues`

### Before

```typescript
export function computeMonthlySummaryFromDailyValues(
  entityId: string,
  year: number,
  month: number,
  isMeasurement: boolean,
  isPrecipitation: boolean,
  dailyValues: Map<string, DailyValue>,
): MonthlySummary | null;
```

### After

```typescript
export function computeMonthlySummaryFromDailyValues(
  entityId: string,
  year: number,
  month: number,
  isMeasurement: boolean,
  excludeZero: boolean,
  dailyValues: Map<string, DailyValue>,
): MonthlySummary | null;
```

### Semantics

- Identical body, except parameter renamed `isPrecipitation` → `excludeZero` and the internal `isPrecipitation`-based filter is driven by the new parameter directly (no further logic change inside the function — the boolean was already used as an exclude-zero flag).
- When `isMeasurement === true`, `excludeZero` is ignored (measurement entities don't have summable "zero days").

## `transformMonthlyStats`

### Before

```typescript
export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
): Map<string, MonthlySummary>;
```

### After

```typescript
export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
  entityConfigs: EntityConfig[],
): Map<string, MonthlySummary>;
```

### Semantics

- For each `(entityId, entries)` pair in `rawStats`:
  - Look up the first matching `EntityRowConfig` in `entityConfigs` where `cfg.entity === entityId`.
    Compute `excludeZero = matchingCfg?.show_zero === false`.
    (Duplicate entity rows with conflicting `show_zero` resolve to first-match; this is an accepted last-write-wins collision per Research Q2.)
  - If no matching config found (defensive), `excludeZero = false` (default-include).
- Call `computeMonthlySummaryFromDailyValues(entityId, year, month, isMeasurement, excludeZero, dailyValues)` as before.
- Return value shape unchanged.

## Caller-side change: `calendar-stats-card.ts`

### Expression-row summary loop (≈ line 321)

```typescript
// BEFORE
const sums = collectDailySums(cfg.expression, year, m, dailyValues, false);

// AFTER
const excludeZero = cfg.show_zero === false;
const sums = collectDailySums(cfg.expression, year, m, dailyValues, excludeZero);
```

The downstream `min`/`mean`/`max` are computed from `sums`, so they inherit the exclusion automatically.
If `sums.length === 0` (all-zero month with `excludeZero === true`), the existing `if (sums.length === 0) continue;` line already suppresses the empty summary — FR-006 satisfied.

### Current-month summary fill (≈ line 346)

```typescript
// BEFORE
const s = computeMonthlySummaryFromDailyValues(
  entityId, year, currentMonth,
  meta.stateClass === 'measurement',
  meta.deviceClass === 'precipitation',
  dailyValues,
);

// AFTER
const s = computeMonthlySummaryFromDailyValues(
  entityId, year, currentMonth,
  meta.stateClass === 'measurement',
  cfg.show_zero === false,
  dailyValues,
);
```

### `transformMonthlyStats` call (≈ line 315)

```typescript
// BEFORE
const monthlySummaries = transformMonthlyStats(monthlyRaw as ..., metadataMap, dailyValues);

// AFTER
const monthlySummaries = transformMonthlyStats(monthlyRaw as ..., metadataMap, dailyValues, this._config.entities);
```

## Backward compatibility

None required.
The functions in `data-transform.ts` are internal to the bundle; no consumer outside `frontend/src/` depends on the signatures.
The bundle's public contract is the Lovelace card configuration schema, which is unchanged (Data Model: no schema diff).
