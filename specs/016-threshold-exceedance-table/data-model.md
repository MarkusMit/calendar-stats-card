# Data Model: Threshold Exceedance Table

**Feature**: 016-threshold-exceedance-table
**Date**: 2026-09-06

No configuration schema changes.
This feature adds two derived, in-memory structures and reads existing ones.

## New structures

### ExceedanceRow

One named day threshold of one configured row, with its two counts for the viewed range.

| Field | Type | Notes |
|-------|------|-------|
| `rule` | `ThresholdRule` | The originating rule; carries `name`, `value`, `text_color`, `background_color` for FR-016 |
| `band` | `number` | Days where this rule determines the cell coloring (FR-006) |
| `cumulative` | `number` | Days where this rule applies at all (FR-007) |

**Invariants**:

- `band <= cumulative`.
- `rule.name` is set and `rule.value` is defined — rows failing either are never created (FR-003).
- Both counts are non-negative integers; a day contributes at most 1 to each (FR-008).

### ExceedanceGroup

The rows belonging to one configured entity or expression row.

| Field | Type | Notes |
|-------|------|-------|
| `label` | `string` | Display label including unit, identical to the legend's group label (FR-004) |
| `rows` | `ExceedanceRow[]` | Ordered by `rule.value` ascending (FR-005) |

**Invariants**:

- A group with no surviving row is omitted entirely.
- One group per configured row index, so two rows on the same entity stay separate — they may carry different thresholds.
- Across a group, the band counts sum to the cumulative count of the lowest-valued rule when all rules point the same direction (SC-002).

## Existing structures read

| Structure | Role here |
|-----------|-----------|
| `EntityRowConfig` / `ExpressionRowConfig` | Source of `thresholds`, `factor`, `show_zero`, `show_min`/`show_avg`/`show_max`, `name`, `unit` |
| `ThresholdRule` | The rule itself; only its day `value` participates (FR-003) |
| `YearStatistics.dailyValues` | Per-day values, keyed `<entity or expression>::YYYY-MM-DD`; entry kind distinguishes measurement, cumulative and empty |
| `EntityMetadata` | Friendly name, unit and state class — decides whether a row yields min/avg/max or a single scalar candidate |
| Visible month segments | `{ year, months[] }` per year of the range, already computed for rendering; defines exactly which days are in scope (FR-009) |

## Derivation

For each configured row, for each visible month, for each day of that month:

1. Look up the day's value entry; skip entries of the empty kind (FR-010).
2. Apply the row `factor` to the raw value(s). Predecessor factors are already applied upstream and MUST NOT be applied again.
3. Produce the candidate `(value, role)` pairs:
   - measurement rows → up to three candidates (`min`, `avg`, `max`), each gated by its own visibility option, each skipped when the value is exactly `0` and `show_zero` is `false`;
   - cumulative and expression rows → one `scalar` candidate, kept even when its value is `0`.
4. For each candidate, add the coloring winner to the day's band set and every applicable rule to the day's cumulative set.
5. After the day, increment `band` once per member of the band set and `cumulative` once per member of the cumulative set.

Rules without a name or without a day value are dropped after counting, so they can still take part in the coloring resolution that decides another rule's band.

## Volume

Bounded by days × configured rows × rules: a five-year range with ten rows is under 20 000 day lookups, each a map hit and a handful of numeric comparisons.
Recomputed per render; no caching, no persistence.
