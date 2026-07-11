# Config Contract: Per-Period Threshold Values

The card's user-facing interface is its Lovelace YAML configuration.
This contract defines the revised fields; everything not listed here is unchanged from spec 007.

## Schema

Each entry of an entity/expression row's `thresholds:` list carries up to three period thresholds:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `value` | number | — | Day threshold: gates daily values and statistics over daily values |
| `value_month` | number | — | Month threshold: gates monthly sums and statistics over monthly sums |
| `value_year` | number | — | Year threshold: gates yearly sums (the yearly Total column) |

All three are optional; a rule defining none of them is silently ignored.
Operator, `name`, `text_color`, and `background_color` are shared across the periods.
There is no `scope` field (an earlier draft used one; it was replaced by this model before release).

## Example

```yaml
entities:
  - entity: sensor.precipitation
    thresholds:
      - operator: above
        value: 10            # day: wet day
        value_month: 150     # month: wet month
        value_year: 1200     # year: wet year
        name: Wet
        background_color: "#0277bd"
      - operator: above
        value_month: 300     # month-only rule; inert on daily and yearly cells
        name: Extreme month
        background_color: "#01579b"
```

Behavior:

- `Wet` colors daily cells above 10, monthly-total cells above 150 (yearly-view month cells, comparison values and cross-year average, cumulative year rollup, monthly view's Total column), and yearly Total cells above 1200 — one legend entry, one color.
- `Extreme month` colors only monthly-total cells above 300.

## Compatibility

- Existing configurations are valid unchanged; rules with only `value` act on day-scale cells only.
- Rendering change without config change: monthly/yearly sum cells stop being colored by day-only rules (the bug fix, spec FR-009).
- The visual editor exposes three optional value inputs per rule; clearing an input removes that period threshold.
