# Quickstart: Threshold Exceedance Table

**Feature**: 016-threshold-exceedance-table

## What it does

Below every table on the page, the card lists each named day threshold with two numbers: how many days fell into that threshold's own band, and how many days reached it in total.

## Try it

Add two named thresholds to a temperature row:

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

Open a range of a few past months.
At the end of the page, under the monthly tables:

| Temperature [°C] | Band | Total |
|---|---|---|
| Summer day | 5 | 8 |
| Hot day | 3 | 3 |

Read it as: 5 days were warm but not hot, 3 days were hot, 8 days reached 25 °C or more.

## Check the numbers

- **Band matches the colors**: count the orange day cells in the tables above — that is the Summer day band. Count the red ones — that is the Hot day band.
- **Total is the running sum**: the Total of the lowest threshold equals the sum of all band counts of that row.
- **Views agree**: switch to the yearly view without changing the range; every number stays the same.
- **Range-scoped**: step to another range and the numbers follow it.

## What is left out

- Unnamed thresholds — nothing to label a row with.
- Thresholds that only set `value_month` or `value_year` — those describe monthly and yearly sums, not days.
- Today and future days — not complete yet.
- Days hidden by `show_zero: false` on a measurement row — no cell is colored for them either.
- The month comparison view — the table is not shown there.

## Build and verify

From `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Deploy to Home Assistant:

```bash
wsl -e bash -lc "cd /mnt/c/Dev/HomeAssistant/tabularizer && ./scripts/deploy.sh"
```

Then reload the browser or clear the Lovelace cache.
