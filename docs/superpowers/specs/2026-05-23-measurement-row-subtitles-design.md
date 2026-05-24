# Design: Measurement Row Subtitles (min/avg/max)

**Date:** 2026-05-23  
**Status:** Approved

## Problem

Measurement entities render as 3 rows (min, mean, max) in both `year-table` and `monthly-table`. There is no per-row indicator identifying which row is which — the only distinction is vertical position within the rowspan group. This is ambiguous without prior knowledge of the layout.

## Decision

Add a narrow sub-label column between the entity label column and the data columns. Each measurement row gets a text label (`min`, `avg`, `max`) in this column, using localized strings. Cumulative/expression rows get an empty cell in the same column to preserve alignment.

**Symbol style chosen:** text abbreviations (`min` / `avg` / `max`) — unambiguous, no icon rendering issues.

## Files to Change

### Translation files
- `frontend/src/translations/en.json` — keys `summary.min/avg/max` already exist (`"min"`, `"avg"`, `"max"`); no change needed
- `frontend/src/translations/de.json` — change `summary.avg` from `"avg"` to `"Ø"` (standard German abbreviation for Durchschnitt)

### `frontend/src/components/year-table.ts`
- Add `hasMeasurement()` helper (mirrors existing `hasCumulative()`)
- Add `.sub-label` CSS rule: right-aligned, `font-size: 0.8em`, `opacity: 0.7`, `color: var(--secondary-text-color)`, `padding: 1px 4px`, `white-space: nowrap`; **not sticky** (see trade-off below)
- `renderEntityRows` — measurement branch: in row 1 (after the `rowspan="3"` label cell), insert `<td class="sub-label">${localize('summary.min', lang)}</td>`; in rows 2 and 3 (which have no label cell), insert the sub-label as the first cell with `avg` and `max` respectively
- `renderEntityRows` — cumulative/expression branch: insert `<td class="sub-label"></td>` (empty) when `hasMeasurement()` is true
- Month header row: add `<th class="sub-label"></th>` after the label header `<th>` when `hasMeasurement()`
- `totalCols` calculation: add `+ (hasMeasurement ? 1 : 0)`

### `frontend/src/components/monthly-table.ts`
- Same CSS, same `hasMeasurement()` helper, same cell insertions
- Header row: add `<th class="sub-label"></th>` when `hasMeasurement()`

## Trade-offs

**Not sticky:** Making the sub-label column sticky requires knowing the dynamic label column width at runtime (would require a `ResizeObserver`). The entity label column is already sticky and identifies the entity; the sub-label is a quick visual cue near the left edge, not a navigation landmark. Not worth the complexity.

**Text over symbols:** Arrow symbols (↓/~/↑) are less immediately obvious than `min`/`avg`/`max` text. The extra column width (~24px) is acceptable.

**German `Ø` for avg:** Standard German notation for average (Durchschnitt), compact, fits the column width.

## Verification

1. `npm run build` — no TypeScript errors
2. `npm test` — all tests pass
3. Load card in HA with a measurement entity (e.g. temperature): confirm 3 rows show `min`, `avg`, `max` labels in the sub-label column
4. Switch HA language to German: confirm avg row shows `Ø`
5. Verify cumulative entity rows have empty sub-label cell (column alignment preserved)
6. Verify month header row has the extra column accounted for (no misaligned colspan)
7. Horizontal scroll: label column stays sticky, sub-label scrolls with data
