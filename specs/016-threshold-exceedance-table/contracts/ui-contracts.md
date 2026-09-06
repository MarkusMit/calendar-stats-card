# UI Contract: Threshold Exceedance Table

The card's user-facing interfaces are its Lovelace YAML configuration and its rendered surface.
This feature adds **no configuration keys** (FR-013) — the contract below covers the rendered surface and the translation keys.

## Configuration

Unchanged from spec 015.
The table derives entirely from existing `thresholds:` entries; a rule participates when it has both `name` and `value`.

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.outdoor_temperature
    name: Temperature
    thresholds:
      - operator: equals-above
        value: 25
        name: Summer day
        background_color: orange
      - operator: equals-above
        value: 30
        name: Hot day
        background_color: red
```

With the range showing 5 days between 25 and 30 and 3 days at or above 30, the table reads:

| Temperature [°C] | Band | Total |
|---|---|---|
| Summer day | 5 | 8 |
| Hot day | 3 | 3 |

## Rendered surface

| Element | Contract |
|---|---|
| Placement | After every data table, inside the card content, above the space reserved for the floating bottom bar (FR-001) |
| Visibility | Rendered when at least one qualifying rule exists, in the monthly and yearly views only (FR-012, FR-013) |
| Grouping | One group per configured row, labelled exactly as the legend labels it, unit included (FR-004) |
| Row order | Day threshold value ascending within a group (FR-005) |
| Columns | Threshold name, band count, cumulative count (FR-006, FR-007) |
| Rule marking | Each row carries its rule's colors, matching the legend's swatch treatment (FR-016) |
| Layout | Dense — same cell padding, border and font conventions as the existing tables (Constitution III) |

The table exposes no interaction: no sorting, no selection, no drill-down.

## Translation keys

New `exceedance` group in `frontend/src/translations/en.json` and `de.json`, following the existing flat two-level structure (FR-015):

| Key | English | German |
|---|---|---|
| `exceedance.title` | Threshold days | Schwellwerttage |
| `exceedance.band` | Band | Bereich |
| `exceedance.total` | Total | Gesamt |

No hard-coded display string is introduced anywhere (Constitution IV).

## Backward compatibility

Existing configurations gain the table without any change.
A configuration whose threshold rules are all unnamed, or all month/year-only, renders exactly as before — no table, no heading.
