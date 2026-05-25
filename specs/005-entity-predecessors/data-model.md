# Data Model: Entity Predecessor Configuration

**Branch**: `005-entity-predecessors` | **Date**: 2026-05-25

## New Types

### `PredecessorConfig` (new — `frontend/src/types/card-config.ts`)

```typescript
export interface PredecessorConfig {
  entity: string;       // HA entity ID of the predecessor
  replaced_on?: string; // ISO date YYYY-MM-DD; strictly exclusive upper bound for predecessor data
}
```

**Constraints**:
- `entity`: required, non-empty string
- `replaced_on`: optional; if present, predecessor data used for dates strictly before this value; main entity data used from this date onwards
- Multiple predecessors with no `replaced_on`: ordered by position in config list (first = highest priority among undated)

### Updated `EntityRowConfig` (modified — `frontend/src/types/card-config.ts`)

```typescript
export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
  show_zero?: boolean;
  show_min?: boolean;
  show_avg?: boolean;
  show_max?: boolean;
  text_color?: string;
  background_color?: string;
  predecessors?: PredecessorConfig[];  // NEW
}
```

**Constraints**:
- `predecessors`: optional; omitting or empty array = current behaviour unchanged
- Expression rows (`ExpressionRowConfig`) do NOT get this field (out of scope)

## New Service

### `resolvePredecessorData` (new — `frontend/src/services/predecessor-resolver.ts`)

```typescript
export function resolvePredecessorData(
  entityConfigs: EntityConfig[],
  dailyValues: Map<string, DailyValue>,
  metadataMap: Record<string, EntityMetadata>,
  warnedPredecessors: Set<string>,
): Map<string, DailyValue>
```

**Inputs**:
- `entityConfigs`: full config list; processes only `EntityRowConfig` entries with non-empty `predecessors`
- `dailyValues`: raw per-entity daily values from `transformDailyStats`
- `metadataMap`: entity metadata including `stateClass` and `unitOfMeasurement`
- `warnedPredecessors`: mutable set; incompatible predecessors added here on first skip; prevents duplicate console warnings

**Output**: new `Map<string, DailyValue>` — copy of `dailyValues` with main entity keys overwritten by resolved predecessor data where applicable

**Resolution rules (per date per entity row)**:
1. Separate `predecessors` into dated (has `replaced_on`) and undated
2. Sort dated ascending by `replaced_on`
3. Compatibility check (FR-011): skip any predecessor whose `stateClass` or `unitOfMeasurement` (from `metadataMap`) differs from the main entity; log console.warn once per predecessor ID using `warnedPredecessors` set (FR-012)
4. For each date key `${mainEntityId}::${date}` in the daily values map, AND for each date key found in any predecessor's entries:
   - Find active dated predecessor: first in sorted list where `replaced_on > date`
   - If dated predecessor found: use `${predecessorId}::${date}` value; if absent → keep existing value for that key (empty/missing)
   - If no dated predecessor (main entity range): use main entity data if present; else try undated predecessors in config list order; use first with a non-empty value
5. Write resolved value under `${mainEntityId}::${date}` in output map

## Key invariants

- Output map contains all keys from input map (predecessor-keyed entries remain; main entity keys may be overwritten)
- `entityId` field on resolved `DailyValue` is rewritten to `mainEntityId` so downstream monthly summary computation keys correctly
- No mutation of input map
- Console warnings: `console.warn('[calendar-stats] predecessor ${id}: state_class or unit_of_measurement mismatch, skipping')`

## Affected data flow in `calendar-stats-card.ts`

```
entityIds  ←  now includes predecessor entity IDs
     ↓
fetchDailyStats / fetchMonthlyStats / getStatisticsMetadata
     ↓
transformDailyStats  →  rawDailyValues (per-entity)
     ↓
resolvePredecessorData  →  mergedDailyValues (main entity keys enriched)
     ↓
expression evaluation (unchanged, uses mergedDailyValues)
     ↓
transformMonthlyStats + computeMonthlySummaryFromDailyValues (unchanged)
     ↓
YearStatistics → rendering (unchanged)
```
