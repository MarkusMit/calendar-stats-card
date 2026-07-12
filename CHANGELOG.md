# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-07-12

### Fixed

- In a multi-year monthly view, the day columns of all years now share the same widths;
  previously each year's month tables sized their columns independently, misaligning the grid.

### Changed

- The Summary and Total column headers in the monthly and yearly views are now bold.

## [0.5.0] - 2026-07-11

### Added

- Month comparison view.
  Clicking a month label in a yearly-view header opens a cross-year comparison of that calendar month over the yearly view's range.
  A summary table shows each year's monthly values with the signed difference to the previous year, the deviation from the cross-year average, and a trailing average column; cumulative totals additionally show percentages.
  Below it, the daily values of every data-bearing year render as sections of one table with aligned day columns.
  Prev/next controls in the bottom bar switch the compared month (wrapping December↔January); a back control returns to the yearly view.
  An incomplete current month is marked and excluded from the cross-year average.
- Per-period threshold values.
  Each threshold rule can now define up to three thresholds — `value` (day), `value_month`, and `value_year` — sharing one operator, label, and colors.
  A rule is evaluated only against cells whose aggregation period it defines a threshold for: day rules gate daily values and statistics over them, month rules gate monthly sums (yearly-view month cells, comparison values and averages, the monthly view's Total column), year rules gate the yearly Total column.
  The visual editor gained day/month/year value inputs arranged in one row.

### Fixed

- Daily-intent thresholds no longer fire on monthly and yearly sum cells.
  Previously a rule like "above 10 mm per day" colored essentially every monthly total in the yearly and comparison views.
- The cumulative summary average is prefixed with the Ø symbol in the comparison summary table.
- In comparison diff cells, the absolute and relative values are separated by a line break instead of sitting on one line.
- Empty value cells now render with column borders and a non-breaking space, keeping the grid lines and row heights uniform.

### Changed

- The monthly and yearly Total columns, previously never threshold-colored, are now colorable via explicit month/year threshold values (supersedes the 0.2.0 note that the total column uses static colors only).

## [0.4.1] - 2026-07-11

### Fixed

- In the yearly view, all years of a multi-year range now render inside one table, so every year shares the same column widths; previously each year's table sized its columns independently, breaking the layout.
- The threshold legend now lists rules triggered in any year of a multi-year yearly range; previously only the last year's triggered rules survived.

## [0.4.0] - 2026-07-11

### Added

- Yearly summary view.
  A Monthly | Yearly selector in the bottom bar switches between the day-by-day monthly tables and a compact yearly grid.
  The yearly view shows one table per calendar year with one column per month; each cell is that month's summary (min/avg/max for measurement rows, the monthly total for cumulative rows), plus a per-row yearly Summary and Total.
- Year-granular range selection in the yearly view.
  Presets This year, Last year, Last 3 years, Last 5 years, and All (from the first recorded data through the current year), plus a custom whole-year span.

### Fixed

- Navigation no longer scrolls before the first recorded data point.
  The earliest data point is now derived from the earliest monthly statistics bucket instead of the recorder metadata (which carries no earliest timestamp and always fell back to a fixed ten-years-ago anchor), so the backward-navigation floor and the yearly year filtering now clamp correctly in both views.
- The yearly roll-up column is labeled by year ("Jahr" in German) rather than reusing the monthly view's per-month label.

### Changed

- The bottom bar was reworked to fit portrait phone screens: the view selector is a compact dropdown and the legend button moved to the right end of the bar.

## [0.3.1] - 2026-07-11

### Security

- Updated build/test dependencies to resolve two high-severity advisories.
  Vite was patched against the `server.fs.deny` bypass on Windows alternate paths and the launch-editor NTLMv2 hash disclosure, and `ws` was patched against memory-exhaustion denial of service from tiny fragments.
  These are development-only dependencies; the shipped card bundle is unaffected.

## [0.3.0] - 2026-07-11

### Added

- Month-wise date-range selection in the floating bottom bar.
  Preset ranges (this month, this quarter, this year, last 3 months, last 12 months) are selectable from a popover, alongside a custom From/To month picker for an arbitrary span.
  The prev/next arrows step the current range: calendar-aligned presets move by their aligned unit (previous month/quarter/year), while rolling and custom windows shift by their own length.
- The navbar label reflects the displayed span rather than a fixed name.
  A year shows as `YYYY`, a quarter as `YYYY-Qn`, a month as `YYYY-MM`, and any other span as a compact numeric range (e.g. `2025-08–2026-07`).

### Changed

- Ranges spanning more than one calendar year render one table block per year, with the year shown alongside each month name.
- The year-only navigator was replaced by the range navigator.

## [0.2.1] - 2026-06-28

### Fixed

- Auto-contrast text now works for named background colors (e.g. `lightblue`).
  Named colors are resolved through a built-in CSS color table instead of relying on a DOM probe, so cells with a named background get readable dark/light text in dark mode.
  The color probe was also moved to `document.body` so `var(...)` backgrounds resolve correctly in the browser.

## [0.2.0] - 2026-06-28

### Added

- Auto-contrast cell text for dark-mode readability.
  When a cell has a background color but no explicit `text_color`, the text color is automatically set to black or white based on the background luminance (WCAG).
  An explicit `text_color` always takes precedence.

### Fixed

- Threshold coloring is no longer applied to a cumulative row's total column; the total uses the static color only.
- Table text can now be selected (for copying) in the macOS Home Assistant app by adding `-webkit-user-select` for WKWebView.

[0.5.0]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MarkusMit/ha-tabularizer/releases/tag/v0.2.0
