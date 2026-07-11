# Quickstart: Yearly Summary View — Manual Verification

Run from `frontend/` in WSL2. Assumes an HA instance with at least one measurement entity (e.g. temperature) and one cumulative entity (e.g. precipitation) with 1+ year of recorded statistics.

## Build & test

```bash
npm install
npm test          # all Vitest suites green (unit + component), incl. new yearly-view tests
npm run lint
npm run build     # → frontend/dist/calendar-stats-card.js
```

## Load in Home Assistant

1. Serve / copy `frontend/dist/calendar-stats-card.js` as a Lovelace resource.
2. Add the card with a couple of entities (one measurement, one cumulative), e.g.:

   ```yaml
   type: custom:calendar-stats-card
   entities:
     - entity: sensor.outdoor_temperature
     - entity: sensor.rain_daily
   ```

## Verify (maps to acceptance scenarios / SC)

1. **Toggle exists** — the bottom bar shows a `Monthly | Yearly` segmented control (FR-011). Monthly is active by default.
2. **Switch to Yearly** — click *Yearly*. The view becomes a grid: 12 month columns (Jan–Dec), one row per entity; the range snaps to the full year (FR-016). Entities and selection are preserved (SC-003).
3. **Measurement cells** — the temperature row shows min/avg/max sub-rows; each month cell equals that month's Summary from the Monthly view (SC-001). Toggle back to Monthly and spot-check one month matches.
4. **Cumulative cells** — the rain row shows each month's total; the yearly **Total** equals the sum of the twelve months (FR-006); the yearly **Summary** shows the lowest/mean/highest monthly total.
5. **Yearly Summary (measurement)** — the row's yearly min = lowest monthly min, max = highest monthly max, avg = day-weighted yearly mean (FR-005).
6. **Current year** — months after the current month render blank, not zero (FR-007 / SC-005).
7. **Multi-year** — select a range spanning two years (or step back a year), confirm one labeled block per year in chronological order (FR-010 / SC-004).
8. **Threshold coloring** — with a row that has thresholds configured, month cells are colored per the rules and the legend lists them (FR-017).
9. **Earliest-data floor** — step *previous* repeatedly: navigation stops at the year/period containing the first recorded data; you cannot reach a fully-empty period before the data (FR-015 / SC-007). Confirm the same floor now holds in the Monthly view.
10. **i18n** — set HA language to German; the toggle (`Monat`/`Jahr`-style), month names, and Summary/Total labels are localized (FR-014 / SC-006).
11. **Density & layout** — all 12 months fit without horizontal scroll on desktop (SC-002); no decorative whitespace (FR-013).

## Regression

- Monthly view behavior is unchanged except the new earliest-data floor (previously you could scroll past the first data point — now clamped).
- No new websocket calls when switching to a year already loaded.
