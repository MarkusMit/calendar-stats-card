# Data Model: Monthly Stats Card

## Core Domain Types

### EntityConfig — user-facing configuration entry

```typescript
// Union type — config list may contain entity rows or expression rows
type EntityConfig = EntityRowConfig | ExpressionRowConfig;

interface EntityRowConfig {
  entity: string;      // HA entity ID
  name?: string;       // Optional display label override
  precision?: number;  // Optional decimal digit count
  factor?: number;     // Optional value multiplier (default 1)
  unit?: string;       // Optional unit of measurement override
  show_zero?: boolean; // When false, zero day cells render blank (default true)
}

interface ExpressionRowConfig {
  expression: string;  // Arithmetic formula combining entity IDs (e.g. "{{ sensor.a + sensor.b }}")
  name?: string;
  unit?: string;
  precision?: number;
  show_zero?: boolean;
}
```

### CardConfig — full Lovelace YAML config

```typescript
interface CardConfig {
  type: string;              // "custom:tabularizer-card"
  entities: EntityConfig[];  // Union of EntityRowConfig | ExpressionRowConfig; order preserved; duplicates allowed; may be empty
}
```

### EntityMetadata — resolved from HA at runtime

```typescript
interface EntityMetadata {
  entityId: string;
  stateClass: 'measurement' | 'total_increasing' | 'total' | 'unknown';
  deviceClass: string | null;           // 'precipitation', 'energy', 'temperature', etc.
  unitOfMeasurement: string | null;
  friendlyName: string | null;          // Fallback label when config.label is absent
  hasStatistics: boolean;               // false → FR-029: warning in label cell, empty day cells
}
```

**Derivation**:
- `friendlyName`, `stateClass`, `deviceClass`, `unitOfMeasurement` from `hass.states[entityId]?.attributes`
- `hasStatistics` from `recorder/list_statistic_ids` response
- If entity absent from `hass.states` → `hasStatistics: false`, all other fields null

---

### DailyValue — per-entity, per-day cell data

```typescript
type DailyValue =
  | MeasurementDailyValue
  | CumulativeDailyValue
  | EmptyDailyValue;

interface MeasurementDailyValue {
  kind: 'measurement';
  entityId: string;
  date: string;              // "YYYY-MM-DD" (HA server timezone)
  min: number;
  mean: number;              // API field: 'mean'; UI label: 'avg'
  max: number;
  partialCoverage: boolean;  // true → append superscript '*' (FR-030)
}

interface CumulativeDailyValue {
  kind: 'cumulative';
  entityId: string;
  date: string;
  sum: number;               // Daily delta; ≥ 0 for total_increasing; any sign for total
  partialCoverage: boolean;  // true → day-boundary gap detected (FR-031); false for mid-day gaps (FR-032)
}

interface EmptyDailyValue {
  kind: 'empty';
  entityId: string;
  date: string;              // Today, future, or no stats available
}
```

**Computation rules**:

| Entity type | Source | Notes |
|---|---|---|
| `measurement` | HA daily-period stats `mean`/`min`/`max` | Direct from API |
| `total_increasing` daily sum | `sum[N] − sum[N-1]` from HA daily-period stats | Negative → 0 (FR-015) |
| `total` daily sum | `sum[N] − sum[N-1]` | Negative shown as-is (FR-015) |
| Any, today or future | `EmptyDailyValue` | FR-028: always empty regardless of partial stats |
| Any, no stats | `EmptyDailyValue` | FR-017 |
| First tracked day (no prior `sum`) | `sum[0]` used directly | FR-011 logic applied to daily as well |

**Coverage detection** (`partialCoverage`):
- Derived from hourly-period stats: count hourly entries per calendar day in HA server timezone
- Measurement: count < 24 → `partialCoverage: true` (FR-030)
- Cumulative: missing first hour (00:xx) or last hour (23:xx) → `partialCoverage: true` (FR-031); mid-day gaps → `partialCoverage: false` (FR-032)
- If hourly stats unavailable (beyond 10-day retention) → `partialCoverage: false` (no asterisk shown)

---

### MonthlySummary — per-entity, per-month summary and total

```typescript
interface MonthlySummary {
  entityId: string;
  year: number;
  month: number;        // 1–12
  min: number | null;
  mean: number | null;  // UI label: 'avg'
  max: number | null;
  total: number | null; // null for measurement entities (no total column)
}
```

**Computation rules**:

| Entity type | min/mean/max source | total source |
|---|---|---|
| `measurement` | Card-computed from daily `DailyValue` entries (HA monthly-period means are period-mean extremes, not true daily min/max) | null (no total column) |
| `total_increasing` / `total`, `device_class: precipitation` | Card-computed from daily `sum` values, **zero-sum days excluded** (FR-016) | `monthlySum[M] − monthlySum[M-1]`; first month: `monthlySum[0]` (FR-011) |
| `total_increasing` / `total`, all other device_class | Card-computed from daily `sum` values, **zero-sum days included** (FR-016) | Same monthly delta formula |

Only non-empty daily values (kind ≠ 'empty') contribute to card-computed min/mean/max.

---

### ViewState — internal UI state

```typescript
interface ViewState {
  selectedYear: number;
  earliestDataYear: number | null;   // null = resolving; determines left-arrow enabled state
  isLoading: boolean;
  statisticsByYear: Map<number, YearStatistics>;
}

interface YearStatistics {
  dailyValues: Map<string, DailyValue>;           // key: `${entityId}::${date}`
  monthlySummaries: Map<string, MonthlySummary>;  // key: `${entityId}::${year}-${month}`
  entityMetadata: Map<string, EntityMetadata>;    // key: entityId
}
```

---

## Entity Relationships

```
CardConfig
  └── EntityConfig[]          (union of EntityRowConfig | ExpressionRowConfig; ordered; duplicates allowed; position = row order)
        └── EntityMetadata    (one per unique entityId, resolved from HA at runtime)

ViewState
  └── YearStatistics          (cached per year; keyed by selectedYear)
        ├── EntityMetadata    (per configured entity)
        ├── DailyValue[]      (per entity × per calendar day of the year)
        └── MonthlySummary[]  (per entity × per visible month)
```

## Visible Month Rules

| Context | Visible months |
|---|---|
| Current year, any day except Jan 1 | January through current month (FR-005) |
| Current year, January 1 | January only (empty) — card defaults to prev year (FR-001) |
| Fully past year (not earliest data year) | All 12 months (FR-006) |
| Earliest data year | First month with data through December (FR-007) |

## State Transitions

```
initial
  → loading     (setConfig called or year navigation triggered)
      → loaded  (all statistics fetched successfully)
      → partial (some entity fetches failed; FR-019: affected cells show '—')
loaded / partial
  → loading     (year navigation: new year selected)
```
