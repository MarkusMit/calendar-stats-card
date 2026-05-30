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

- Iterate `entityConfigs.forEach((cfg, rowIndex) => …)` — one iteration per row, not per entity.
- For each `EntityRowConfig` (skip expression rows):
  - Resolve `entityId = cfg.entity`, look up `meta` in `metadataMap` and `entries` in `rawStats`. Skip the row if either is missing.
  - Compute `excludeZero = cfg.show_zero === false`.
  - For each `entry` in sorted `entries`, derive `(year, month)`, call `computeMonthlySummaryFromDailyValues(entityId, year, month, isMeasurement, excludeZero, dailyValues)`, and write the result to the map under key `rowSummaryKey(rowIndex, entityId, year, month)`.
- Return value shape unchanged.
- **Per-row keying (FR-002a)**: the summary map is keyed by `${rowIndex}::${entityId}::${year}-${month}` (helper `rowSummaryKey()`). Duplicate entity rows with conflicting `show_zero` produce independent summary entries — no first-write-wins collision.

### New helper: `rowSummaryKey`

```typescript
export function rowSummaryKey(rowIndex: number, rowKey: string, year: number, month: number): string;
```

Single source of truth for the per-row summary map key. Used by `transformMonthlyStats`, the expression-row summary loop and the current-month-fill loop in `calendar-stats-card.ts`, and the renderer lookups in `monthly-table.ts` / `year-table.ts`.

## Caller-side change: `calendar-stats-card.ts`

### Expression-row summary loop (≈ line 321)

```typescript
// BEFORE
for (const cfg of this._config.entities) {
  if (!('expression' in cfg)) continue;
  const sums = collectDailySums(cfg.expression, year, m, dailyValues, false);
  // …
  monthlySummaries.set(`${cfg.expression}::${year}-${m}`, { … });
}

// AFTER
this._config.entities.forEach((cfg, rowIndex) => {
  if (!('expression' in cfg)) return;
  const excludeZero = cfg.show_zero === false;
  // … split into filteredSums (for min/mean/max) and allSums (for total).
  monthlySummaries.set(rowSummaryKey(rowIndex, cfg.expression, year, m), { … });
});
```

The downstream `min`/`mean`/`max` are computed from `filteredSums` (zero-excluded when `excludeZero`); `total` always uses `allSums`.
If `allSums.length === 0`, the loop continues without writing an entry — FR-006 satisfied.

### Current-month summary fill (≈ line 346)

```typescript
// BEFORE
for (const cfg of this._config.entities) {
  if (!('entity' in cfg)) continue;
  // …
  const key = `${entityId}::${year}-${currentMonth}`;
  // …
  const s = computeMonthlySummaryFromDailyValues(
    entityId, year, currentMonth,
    meta.stateClass === 'measurement',
    meta.deviceClass === 'precipitation',
    dailyValues,
  );
}

// AFTER
this._config.entities.forEach((cfg, rowIndex) => {
  if (!('entity' in cfg)) return;
  // …
  const key = rowSummaryKey(rowIndex, entityId, year, currentMonth);
  // …
  const s = computeMonthlySummaryFromDailyValues(
    entityId, year, currentMonth,
    meta.stateClass === 'measurement',
    cfg.show_zero === false,
    dailyValues,
  );
});
```

### `transformMonthlyStats` call (≈ line 315)

```typescript
// BEFORE
const monthlySummaries = transformMonthlyStats(monthlyRaw as ..., metadataMap, dailyValues);

// AFTER
const monthlySummaries = transformMonthlyStats(monthlyRaw as ..., metadataMap, dailyValues, this._config.entities);
```

### Renderer lookup (`monthly-table.ts`, `year-table.ts`)

The render loop now receives the row index from the `entityConfigs.map((cfg, i) => …)` iteration and threads it into the summary lookup:

```typescript
// BEFORE
const summaryKey = `${rowKey(cfg)}::${this.year}-${this.month}`;

// AFTER
const summaryKey = rowSummaryKey(rowIndex, rowKey(cfg), this.year, this.month);
```

## Backward compatibility

None required.
The functions in `data-transform.ts` are internal to the bundle; no consumer outside `frontend/src/` depends on the signatures.
The bundle's public contract is the Lovelace card configuration schema, which is unchanged (Data Model: no schema diff).
