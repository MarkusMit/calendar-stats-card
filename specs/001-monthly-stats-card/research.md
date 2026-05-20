# Research: Monthly Stats Card

## 1. Build Toolchain

**Decision**: Rollup 4 + TypeScript 5.6+

**Rationale**: The canonical HA custom card boilerplate (`custom-cards/boilerplate-card`) uses Rollup 4 to produce a single minified ES module. HA loads it via the Lovelace resource mechanism. Vite and esbuild exist but are not the established standard for HA card bundling.

**Alternatives considered**:
- Vite: better DX but overkill for a single-file bundle; not used by authoritative HA card boilerplates
- esbuild: fastest, but less mature rollup-plugin ecosystem for LitElement transforms

**Critical constraint**: TypeScript target MUST be ES2022. Lit 3 uses native ES6 class syntax; downgrading to ES5 causes a runtime TypeError.

---

## 2. Test Framework

**Decision**: Vitest + happy-dom + @open-wc/testing + @vitest/coverage-v8

**Rationale**:
- **Vitest**: native ESM support, same config format as build tools, significantly faster than Jest on large test suites; excellent TypeScript support
- **happy-dom**: 3–10× faster than jsdom; officially supported by Vitest and LitElement 3
- **@open-wc/testing**: provides `fixture()`, DOM helpers, and LitElement lifecycle utilities that are the community standard for web component tests
- **@vitest/coverage-v8**: the current default Vitest coverage provider; `@vitest/coverage-c8` is stale (last published 3+ years ago)

**Alternatives considered**:
- Jest + jsdom: worse ESM support, heavier config for Lit decorators, slower
- Playwright: appropriate for E2E, but no HA instance is available in CI; overkill for component unit tests

---

## 3. LitElement / Lit 3

**Decision**: Lit 3.2+

**Rationale**: Still the industry standard for HA custom cards. The official boilerplate targets Lit 3.2. No newer alternative exists in the HA ecosystem. `<ha-card>` must be the root element for HA design token inheritance.

---

## 4. HA Statistics WebSocket API

**Command**: `recorder/statistics_during_period`

**Parameters used**:
```
{
  type: "recorder/statistics_during_period",
  start_time: <ISO 8601 string>,
  end_time: <ISO 8601 string>,
  statistic_ids: [<entity IDs>],
  period: "day" | "month",
  types: ["mean", "min", "max", "sum"]   // omit fields not needed
}
```

**Response shape**:
```
{
  "sensor.example": [
    {
      start: <Unix ms>,   // new Date(entry.start) works directly (since HA 2023.6)
      end: <Unix ms>,
      // measurement entities:
      mean: number | null,
      min: number | null,
      max: number | null,
      // cumulative entities:
      sum: number | null, // cumulative total at end of period
      state: number | null
    }
  ]
}
```

**Absent fields**: Since HA 2023.6, the API omits field keys that would be null for all entries. Treat missing keys as null.

**Granularity strategy**: Two requests per year-view:
1. `period: "day"` — data for all day-column cells
2. `period: "month"` — data for summary (measurement) and total (cumulative) columns

Long-term statistics (day/month granularity) are retained indefinitely — safe for multi-year historical queries. Short-term statistics (hour/5min) default to 10-day retention.

**Daily delta computation** (cumulative entities):
- HA returns cumulative `sum` at end of each day period
- Daily delta = `sum[day N] − sum[day N-1]`; for the first tracked day with no prior entry, delta = `sum[day 0]`
- Negative delta for `total_increasing` → store and display as 0 (counter reset anomaly)
- Negative delta for `total` → store and display as-is (legitimate, e.g., net energy export)

**mean_type migration (SC-009)**:

| HA version | Parameter | Values |
|---|---|---|
| 2026.5–2026.10 | `has_mean: boolean` | true = arithmetic mean available |
| 2026.11+ | `mean_type: 0\|1\|2` | 0=NONE, 1=ARITHMETIC, 2=CIRCULAR |

Applied to: metadata returned by `recorder/list_statistic_ids` or `recorder/get_statistics_metadata`.

Runtime detection pattern:
```typescript
const version = hass.config.version.split('.').map(Number); // ["2026","5","0"]
const isGE2026_11 = version[0] > 2026 || (version[0] === 2026 && version[1] >= 11);

// For metadata entry `meta`:
const isMeasurementLike =
  isGE2026_11
    ? (meta.mean_type ?? 0) !== 0
    : (meta.has_mean ?? false);
```

**Entity metadata fetching**:
- `hass.states[entityId]?.attributes` → `state_class`, `device_class`, `unit_of_measurement`, `friendly_name`
- `recorder/list_statistic_ids` → confirm long-term statistics exist for entity (if absent → FR-029 warning)

**Coverage indicators (FR-030, FR-031)**:

FR-030 (measurement) and FR-031 (cumulative) require an asterisk `*` when a day has partial data coverage. The day-period API does not expose hourly count in its aggregated response.

**Decision**: Fetch hourly-period stats alongside daily/monthly stats. Group hourly entries by calendar day; <24 entries → partial coverage for measurement. For cumulative, check if the first hourly entry of the day starts at 00:00 and the last ends at 23:xx (day-boundary gaps only per FR-032).

**Limitation**: Hourly stats are retained for ~10 days by default. For historical months beyond the retention window, hourly data is unavailable — coverage indicators will be absent silently (asterisks only appear for recent data within the retention window). This is acceptable per the spec (no requirement to show asterisks on old data).

---

## 5. HA Design Tokens

**Root element**: `<ha-card>` (required for token inheritance and HA design consistency)

**CSS custom properties used**:

| Property | Use |
|---|---|
| `--primary-text-color` | Day cell values, headers |
| `--secondary-text-color` | Label column, summary labels |
| `--disabled-text-color` | Empty cells, coverage indicator asterisk |
| `--card-background-color` | Table background |
| `--divider-color` | Cell borders |
| `--ha-card-border-radius` | Card corners |
| `--primary-color` | Year navigator active state |

**Typography**: `--paper-font-body1` (body), `--paper-font-body2` (emphasized). Font sizing via CSS em units relative to `--paper-font-body1`.

**Density**: CSS Grid layout; 4px cell padding; zero decorative gap. Sticky label column via `position: sticky; left: 0`.

---

## 6. i18n

**Decision**: Inline JSON translation files + simple `localize()` key lookup; `Intl` API for dates/numbers

**Rationale**: Two locales, small string set — no external i18n library needed. Zero runtime dependency. The HA custom card community standard pattern.

**Locale detection**:
```typescript
const lang = hass.selectedLanguage ?? hass.language ?? 'en';
```

**Austrian German note**: January = "Jänner" (not "Januar"). `Intl.DateTimeFormat('de-AT', { month: 'long' }).format(new Date(year, 0))` returns "Jänner" automatically — no manual override needed.

**Translation key structure**:
```
card.no_entities
card.loading
table.label
table.summary
table.total
table.day_header
nav.previous_year
nav.next_year
warning.no_statistics
error.fetch_failed
```

**Date/number formatting**:
```typescript
const monthName = new Intl.DateTimeFormat(lang, { month: 'long' }).format(date);
const value = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(num);
```
