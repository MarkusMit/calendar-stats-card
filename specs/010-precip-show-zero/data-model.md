# Data Model: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

## Schema diff

**None.**
`EntityRowConfig.show_zero` and `ExpressionRowConfig.show_zero` already exist in `frontend/src/types/card-config.ts`:

```typescript
export interface EntityRowConfig {
  // … other fields …
  show_zero?: boolean;
  // … other fields …
}

export interface ExpressionRowConfig {
  // … other fields …
  show_zero?: boolean;
  // … other fields …
}
```

No fields are added, removed, or renamed.
No migration required (FR-008).

## Semantic change

### Before this feature

`show_zero` controls only day-cell rendering:

| Value         | Day cells (computed value = 0)                 | Monthly summary min/avg/max                                   | Monthly total |
|---------------|-------------------------------------------------|---------------------------------------------------------------|---------------|
| `true` / omitted | Render `0`                                   | Determined by `device_class` — precipitation excludes 0; else includes 0 | Unaffected    |
| `false`       | Render blank                                    | Same as above (independent of `show_zero`)                    | Unaffected    |

### After this feature

`show_zero` controls both day-cell rendering AND monthly summary inclusion:

| Value         | Day cells (computed value = 0) | Monthly summary min/avg/max (cumulative + expression rows) | Monthly total |
|---------------|---------------------------------|------------------------------------------------------------|---------------|
| `true` / omitted | Render `0`                   | Include zero-value days                                    | Unaffected    |
| `false`       | Render blank                    | Exclude zero-value days (uniformly, regardless of zero origin) | Unaffected    |

**Origin uniformity** (clarification 2026-05-30): A `total_increasing` day whose sum is `0` because of a counter-reset clamp-to-zero (spec 001 FR-015) is indistinguishable from a naturally-zero day in the summary pipeline.
Both are excluded together when `show_zero: false`; both are included together when `show_zero: true`.
No origin metadata is preserved.

**Empty-summary case** (FR-006): When every qualifying day in a month is zero AND `show_zero: false`, the summary min/avg/max cells render empty (`—`) rather than `0/0/0`.

### Out of scope

- `measurement` state-class entities (FR-007) — `show_zero` does not apply.
  Monthly summary min/avg/max are computed from per-day min/avg/max as today.
- Monthly **total** column (FR-004) — derived from per-day sums independent of `show_zero`.
  Zero days contribute `0` to the sum and do not change it.
- `device_class` field — no longer read for monthly-summary decisions.
  Still read for unit display and other unaffected behaviour.

## Affected runtime entities

| Entity (TS type)          | Field                | Before                                | After                                                                 |
|---------------------------|----------------------|---------------------------------------|-----------------------------------------------------------------------|
| `EntityRowConfig`         | `show_zero?: boolean` | Controls day-cell blanking only       | Controls day-cell blanking AND monthly summary min/avg/max inclusion  |
| `ExpressionRowConfig`     | `show_zero?: boolean` | Controls day-cell blanking only       | Same dual effect                                                      |
| `EntityMetadata`          | `deviceClass`         | Read by summary path to drive zero-exclusion | No longer read by summary path (still read by label/unit code) |
| `MonthlySummary`          | `min`, `mean`, `max`  | Excluded zero days for precipitation only | Excludes zero days for any cumulative / expression row with `show_zero: false` |
| `MonthlySummary`          | `total`               | Unchanged                             | Unchanged                                                             |
