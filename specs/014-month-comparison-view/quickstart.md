# Quickstart: Month Comparison View — Manual Verification

Run from `frontend/` in WSL2.
Assumes an HA instance with at least one measurement entity (e.g. temperature) and one cumulative entity (e.g. precipitation) with 2+ years of recorded statistics.

## Build & test

```bash
npm install
npm test          # all Vitest suites green (unit + component), incl. new comparison tests
npm run lint
npm run build     # → frontend/dist/calendar-stats-card.js
```

## Load in Home Assistant

1. Serve / copy `frontend/dist/calendar-stats-card.js` as a Lovelace resource.
2. Add the card with a measurement and a cumulative entity, switch to the **Yearly** view, select a multi-year range (e.g. *Last 3 years*).

## Verify (maps to acceptance scenarios / SC)

1. **Open** — click a month label (e.g. *Jun*) in any year's header row; the comparison view opens for that month across all years of the range (SC-001, FR-001/002).
2. **Summary values** — rows = entities, columns = years; each value equals the corresponding yearly-view cell (SC-002); measurement rows show min/avg/max per visibility, the rain row shows the monthly total (FR-003/004).
3. **Diffs & average** — each year spans three aligned sub-columns (value, signed Δ to previous year — absent on the earliest year —, signed Ø deviation from the cross-year average) under one year header; the trailing column shows the cross-year average itself; the table's first header cell names the month; recompute one diff by hand (SC-003, FR-005/006).
4. **Percentages** — the rain total diffs additionally show a percentage; the temperature row shows none (FR-006a).
5. **Incomplete month** — compare the current month: the current year's cell is marked incomplete and the average matches the mean of the *other* years only (FR-007).
6. **Daily section** — below the summary, ONE table with a monthly-view section per data-bearing year, chronological, day columns aligned across years, each section header naming month and year (e.g. "June 2025"); a data-less year has no section; spot-check values and threshold colors against the Monthly view for one year (SC-004, FR-009/010/011).
7. **Month navigation** — the back button plus the prev/next controls with the month name sit in the bottom bar (replacing the range navigator while the comparison is open); the month steps with the same year set; from December, next lands on January (and reverse); twelve steps return to the start (SC-008, FR-017).
7a. **Sticky scrollbar** — in the Monthly view (and the comparison's daily section), the horizontal scrollbar stays pinned at the viewport's bottom edge while the table extends below the fold; dragging it scrolls the table.
8. **Empty month** — navigate to a month without any data (e.g. future month of the current year in a short range): an empty state is shown, controls stay usable (FR-017); confirm that same month's header is *not* clickable in the yearly view (FR-016).
9. **Back** — the back control returns to the yearly view with range and entities unchanged (SC-007, FR-012).
10. **No refetch** — with dev tools open, opening/navigating/closing the comparison issues no `recorder/statistics_during_period` calls (research D10).
11. **i18n** — set HA language to German; back label, diff captions, incomplete marker, empty state, and month names are localized (SC-006, FR-014).
12. **Density** — no decorative whitespace; layout matches the other views (FR-015).

## Regression

- Monthly and yearly views behave exactly as before; the only yearly-view change is that data-bearing month headers are now interactive.
- Changing the range or view mode while a comparison is open closes it — verify no stale comparison can survive a range change.
