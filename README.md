# Calendar Stats Card

Home Assistant Lovelace card that renders **monthly statistics tables** for entities with long-term statistics: temperatures, precipitation, energy meters, external statistics, or arithmetic expressions over several of them.
Each table shows one month day-by-day with min/avg/max and totals.
Future months and today are hidden.

![Calendar Stats Card screenshot](docs/Screenshot_en.png)

> [!WARNING]
> **Vibe-coded project.** This card was developed with AI assistance (Claude Code).
> Expect AI-generated code and rapid iteration. Review before relying on it in production-critical setups.

---

## Features

- **Time ranges** — presets (this month, this quarter, this year, last 3 months, last 12 months) or a custom month span; arrow buttons step the range back to the earliest recorded data.
- **Monthly and yearly views** — monthly: one table per month, one column per day.
  Yearly: one table per year, one column per month holding that month's summary, plus a yearly Summary and Total per row; range presets switch to whole years.
- **Rendering by `state_class`** — `measurement` entities show min/avg/max per day; `total_increasing` / `total` entities show the daily delta plus a monthly total.
- **Monthly summary** — measurement extremes are computed from daily extremes, not from daily means as HA does natively.
  For cumulative and expression rows, `show_zero` decides whether zero-value days count toward min/avg/max.
- **Expression rows** — an arithmetic formula over several statistics, evaluated per day.
- **Thresholds** — colour cells above/below configurable day, month and year values, with a legend and a table counting the days each threshold was reached.
- **Predecessors** — stitch in a replaced sensor's history, with an optional unit factor.
- **Visual editor**; English and German, following the HA UI language.

---

## Installation

### HACS (recommended)

[![Open your Home Assistant instance and open this repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MarkusMit&repository=calendar-stats-card&category=plugin)

1. Click the button above, or add the repository by hand: HACS → ⋮ (top right) → **Custom repositories** → Repository `https://github.com/MarkusMit/calendar-stats-card`, Type **Dashboard** → **Add**.
2. Search for **Calendar Stats Card** in HACS and click **Download**.
3. HACS registers the Lovelace resource automatically; hard-reload the browser once (Ctrl-Shift-R).
4. Updates arrive through HACS like for any other card.

<details>
<summary><strong>Manual install</strong></summary>

1. Download the latest `calendar-stats-card.js` from the [Releases](https://github.com/MarkusMit/calendar-stats-card/releases) page, or build it yourself as described in [CONTRIBUTING.md](CONTRIBUTING.md).
2. Copy the file into your HA config directory, e.g. `<config>/www/calendar-stats/calendar-stats-card.js`.
3. In HA: **Settings → Dashboards → Resources → ＋ Add resource**
   - URL: `/local/calendar-stats/calendar-stats-card.js`
   - Resource type: **JavaScript module**
4. Hard-reload your browser (Ctrl-Shift-R).

</details>

### Add the card

The card is designed for a full-width panel view:

Use a view of type **Panel (1 card)**, add the **Calendar Stats** card and configure it in the visual editor, or in YAML:

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.outdoor_temperature
  - entity: sensor.daily_rainfall
  - entity: sensor.electricity_meter_total
```

---

## Configuration

### Card-level options

| Option   | Type    | Required | Default | Description |
|----------|---------|----------|---------|-------------|
| `type`     | string  | yes | — | Must be `custom:calendar-stats-card`. |
| `entities` | list    | yes | — | Ordered list of entity rows and/or expression rows. |
| `show_threshold_table` | boolean | no  | `true` | Show the [threshold days table](#threshold-days-table). |

### Entity row

One row per HA statistic: an entity with long-term statistics, or an external statistic (`domain:object_id`) imported by an integration.
Rendering follows the entity's `state_class`.
External statistics have no entity, so kind, unit and name come from HA's statistics metadata.

| Option             | Type       | Default            | Description |
|--------------------|------------|--------------------|-------------|
| `entity`             | string     | **required**       | Entity ID (`sensor.outdoor_temperature`) or external statistic ID (`tibber:energy_consumption`). Duplicates allowed. |
| `name`               | string     | HA friendly name   | Label in the first column. |
| `state_class`        | `total` \| `total_increasing` | derived | Forces the cumulative kind: `total_increasing` clamps negative daily and monthly deltas to `0`, `total` keeps them. Needed for external statistics with counter resets. Also applies to the row's predecessors. |
| `precision`          | integer    | `1`                | Decimal digits in day cells and summary columns. |
| `factor`             | number     | `1`                | Multiplier on displayed values, e.g. `0.001` to show Wh as kWh. |
| `unit`               | string     | HA unit            | Unit shown beside the label. |
| `show_zero`          | boolean    | `true`             | If `false`, zero-value day cells render blank and are excluded from the monthly min/avg/max; the monthly total is unaffected. A counter-reset day clamped to `0` counts as zero. |
| `show_min`           | boolean    | `true`             | Measurement entities: show the min sub-row. |
| `show_avg`           | boolean    | `true`             | Measurement entities: show the avg sub-row. |
| `show_max`           | boolean    | `true`             | Measurement entities: show the max sub-row. |
| `text_color`         | string     | theme              | Row text colour, see [Color values](#color-values). |
| `background_color`   | string     | theme              | Row background colour. |
| `thresholds`         | list       | —                  | [Threshold rules](#threshold-rule). |
| `predecessors`       | list       | —                  | [Predecessor entries](#predecessor-entry). |

### Expression row

One per-day value computed from an arithmetic formula; summarised like a cumulative row.

| Option             | Type       | Default      | Description |
|--------------------|------------|--------------|-------------|
| `expression`         | string     | **required** | Statistic IDs (entity or external), numeric literals, `+ - * /` and parentheses, optionally wrapped in `{{ ... }}`. Example: `{{ sensor.solar_export - sensor.solar_import }}`. |
| `name`               | string     | —            | Label in the first column. |
| `unit`               | string     | —            | Unit shown beside the label. |
| `precision`          | integer    | `1`          | Decimal digits. |
| `show_zero`          | boolean    | `true`       | As for entity rows. |
| `text_color`         | string     | theme        | Row text colour, see [Color values](#color-values). |
| `background_color`   | string     | theme        | Row background colour. |
| `thresholds`         | list       | —            | [Threshold rules](#threshold-rule). |

No `factor` (fold it into the formula) and no `predecessors`.

### Threshold rule

Each entry in a row's `thresholds:` list colours cells whose value satisfies the rule.
Rules stack; named rules appear in a legend below the card.

| Option             | Type    | Default         | Description |
|--------------------|---------|-----------------|-------------|
| `operator`           | enum    | **required**    | `above` (>), `equals-above` or `not-below` (≥), `equals-below` or `not-above` (≤), `below` (<). |
| `value`              | number  | —               | Day threshold. |
| `value_month`        | number  | —               | Month threshold. |
| `value_year`         | number  | —               | Year threshold. |
| `name`               | string  | —               | Legend label. |
| `text_color`         | string  | row default     | Text colour of matching cells, see [Color values](#color-values). |
| `background_color`   | string  | row default     | Background colour of matching cells. |

At least one of `value`, `value_month`, `value_year` must be set.
A rule is evaluated only for periods it defines a threshold for; statistics inherit the period of the values they summarise.

| Period   | Field | Cells it colours |
|----------|-------|------------------|
| Day    | `value`       | All measurement cells, cumulative daily values, and their monthly min/avg/max. |
| Month  | `value_month` | Monthly sums: month cells in the yearly view, the yearly per-row summary, the monthly view's Total column. |
| Year   | `value_year`  | The yearly view's Total column. |

One rule can carry all three magnitudes of the same phenomenon with one colour and one legend entry:

```yaml
entities:
  - entity: sensor.precipitation
    thresholds:
      - operator: above
        value: 10            # wet day
        value_month: 150     # wet month
        value_year: 1200     # wet year
        name: Wet
        background_color: "#0277bd"
```

### Threshold days table

Below the tables, the card counts how often each named day threshold was reached over the viewed range.

| Column | Meaning |
|--------|---------|
| Band   | Days where this rule colours the cell, i.e. between this threshold and the next. |
| Total  | Days where this rule applies at all. |

With `equals-above` rules at 25 (Summer day) and 30 (Hot day) on a temperature row, a day at 28 counts in the 25 band, a day at 32 in the 30 band, and both count toward the 25 total:

| Temperature [°C] | Band | Total |
|---|---|---|
| Summer day (≥ 25) | 5 | 8 |
| Hot day (≥ 30) | 3 | 3 |

A rule qualifies when it has a `name`, a day `value` and at least one colour; month-only and year-only rules are left out.
Counts follow what is visible: today and future days are excluded, cells hidden by `show_zero: false` are not counted, and a day with min/avg/max counts once per rule.
A yearly view over several years gets Band and Total columns per year plus an "All years" pair.
Disable the table with `show_threshold_table: false`.

### Predecessor entry

Each entry in a row's `predecessors:` list points to an earlier statistic used for dates before `replaced_on`.

| Option         | Type   | Default      | Description |
|----------------|--------|--------------|-------------|
| `entity`         | string | **required** | Entity ID or external statistic ID of the predecessor. |
| `replaced_on`    | string | —            | ISO date `YYYY-MM-DD`; the predecessor covers dates strictly before it. Omit to use it for all dates without main-entity data. |
| `factor`         | number | `1`          | Multiplier on predecessor values (e.g. `1000` for kWh → Wh). Also bypasses the unit-compatibility check. |

### Color values

Every `text_color` and `background_color` accepts any CSS colour string, applied as-is: named colours, hex (`#f44`, `#ff525280` with alpha), `rgb()` / `rgba()`, `hsl()` / `hsla()`, or theme variables such as `var(--error-color)`.
Theme variables follow light/dark switching; hex stays fixed.

---

## Examples

### Temperature + precipitation + energy

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.outdoor_temperature
    name: Outdoor
  - entity: sensor.daily_rainfall
    name: Rain
    show_zero: false
  - entity: sensor.electricity_meter
    name: Electricity
    factor: 0.001
    unit: kWh
    precision: 2
```

### Threshold colouring

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.outdoor_temperature
    thresholds:
      - operator: above
        value: 30
        name: Hot
        background_color: "#ff5252"
        text_color: white
      - operator: below
        value: 0
        name: Frost
        background_color: "#2196f3"
        text_color: white
```

### Expression row

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.solar_export
  - entity: sensor.solar_import
  - expression: "{{ sensor.solar_export - sensor.solar_import }}"
    name: Net solar
    unit: kWh
    precision: 2
```

### Predecessor

```yaml
type: custom:calendar-stats-card
entities:
  - entity: sensor.electricity_meter_v2
    name: Electricity
    factor: 0.001
    unit: kWh
    predecessors:
      - entity: sensor.electricity_meter_v1
        replaced_on: "2024-06-01"
```

---

## Behaviour & limits

- **Today and future days** render empty; "today" is determined in the HA server's timezone.
- **On load** the card shows the current calendar year; range and view reset on reload.
- **Backward navigation** stops at the period containing the earliest recorded data of any configured entity.
- **Monthly totals** for cumulative entities come from HA's monthly statistics (`sum[month] − sum[prev_month]`) and may differ from the sum of the visible day cells; HA wins.
- **Statistics metadata** is fetched for every configured ID and supplies kind, unit and name where `hass.states` has no entity.
- Tested up to 10 entities; requires HA 2026.5.0+.

## Troubleshooting

- **Card missing from the picker** → check the resource URL under **Settings → Dashboards → Resources** and hard-reload.
- **Warning icon on a row** → the ID has no long-term statistics.
  Enable statistics for the entity under **Settings → System → Customize** and wait one statistics cycle, or check that the external statistic is spelled `domain:object_id`.
- **External cumulative statistic shows negative days** → set `state_class: total_increasing`.
- **Predecessor skipped (console warning)** → its unit differs from the main entity's; set `factor` on the predecessor entry.
- **Monthly total ≠ sum of visible days** → expected, see above.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build, test, and release workflow.
New locales need only a translation file in `frontend/src/translations/`.

## License

[MIT](LICENSE)
