# Config Contract: Threshold `scope` Field

The card's user-facing interface is its Lovelace YAML configuration.
This contract defines the new field; everything not listed here is unchanged from spec 007.

## Schema

Each entry of an entity/expression row's `thresholds:` list accepts one new optional key:

| Key | Type | Allowed values | Default | Meaning |
|---|---|---|---|---|
| `scope` | string | `day`, `month`, `year` | `day` | Aggregation period of the cells this rule may color |

Any other string value is treated as `day` (lenient degradation, no error).

## Example

```yaml
entities:
  - entity: sensor.precipitation
    thresholds:
      - above: 10          # shorthand illustration; actual keys: operator/value
        operator: above
        value: 10
        name: Wet day
        background_color: "#4fc3f7"        # scope omitted → day
      - operator: above
        value: 150
        scope: month
        name: Wet month
        background_color: "#0277bd"
      - operator: above
        value: 1200
        scope: year
        name: Wet year
        background_color: "#01579b"
```

Behavior:

- `Wet day` colors daily cells (and, being a day-scope rule, all day-scale statistic cells) — never monthly or yearly totals.
- `Wet month` colors monthly-total cells: yearly-view month cells, comparison values and cross-year average, cumulative year rollup, and the monthly view's Total column.
- `Wet year` colors only the yearly view's Total column.

## Compatibility

- Existing configurations are valid unchanged; absent `scope` means `day`.
- Rendering change without config change: monthly/yearly sum cells stop being colored by scope-less rules (this is the bug fix, spec FR-009).
- The visual editor reads and writes the field via a per-rule scope selector; round-trip preserves the value.
