# Config Schema Delta: Threshold-Based Cell Coloring

This document describes the additions to the card YAML configuration introduced by feature 007. Reference: `specs/001-monthly-stats-card/contracts/card-config-schema.yaml` for the base schema.

## No Breaking Changes

Existing `text_color` and `background_color` fields on entity and expression rows are **unchanged**. All existing configs continue to work without modification.

## New Fields

### `thresholds` (on EntityRowConfig and ExpressionRowConfig)

```yaml
thresholds:
  - operator: <operator>        # required
    value: <number>             # required
    name: <string>              # optional; enables legend entry
    text_color: <css-color>     # optional; same format as row-level text_color
    background_color: <css-color>  # optional; same format as row-level background_color
```

**Operators**:

| Operator | Condition | Applies to cell roles |
|----------|-----------|----------------------|
| `above` | `cellValue > value` | all |
| `equals-above` | `cellValue >= value` | all |
| `equals-below` | `cellValue <= value` | all |
| `below` | `cellValue < value` | all |
| `not-below` | `cellValue >= value` | min cells and scalar cells only |
| `not-above` | `cellValue <= value` | max cells and scalar cells only |

**Selection rule**: when multiple thresholds match a cell value, the threshold with the numerically closest `value` is applied. Tie-break: higher `value` wins.

**Override rule**: threshold `text_color`/`background_color` override the row-level static `text_color`/`background_color` for the matched cell only. Partial override is supported — a threshold that sets only `background_color` leaves the row-level `text_color` intact for that cell.

**Ignored rules**: a threshold rule with neither `text_color` nor `background_color` is silently ignored.

## Full Example

```yaml
type: custom:tabularizer-card
entities:
  - entity: sensor.outside_temperature
    text_color: "var(--primary-text-color)"
    thresholds:
      - operator: above
        value: 30
        name: Heat day
        background_color: "#ff6b6b"
      - operator: above
        value: 25
        name: Summer day
        background_color: "#ffd93d"
      - operator: not-below
        value: 20
        name: Tropical night
        background_color: "#ff9ff3"
      - operator: below
        value: 0
        name: Frost day
        text_color: "#74b9ff"
        background_color: "#dfe6e9"

  - entity: sensor.precipitation
    background_color: "var(--secondary-background-color)"
    thresholds:
      - operator: above
        value: 10
        name: Heavy rain
        background_color: "#0984e3"
        text_color: white
      - operator: above
        value: 1
        background_color: "#74b9ff"
```

Temperature entity has 4 named thresholds; precipitation has 1 named + 1 unnamed. Combined legend at card bottom: 5 entries in definition order ("Heat day", "Summer day", "Tropical night", "Frost day", "Heavy rain").

## Legend Rendering Rules

- Appears at the bottom of `<ha-card>` when at least one valid named threshold exists.
- Each entry: colored swatch (`background_color`) + name label (optionally in `text_color`). If no `background_color`, name label rendered in `text_color` only (no swatch).
- Entries ordered by first appearance across all entities (config definition order); deduplicated by name.
- Named thresholds with no color fields are excluded.
