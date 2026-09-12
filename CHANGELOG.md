# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> [!WARNING]
> **Vibe-coded project.** This card was developed with AI assistance (Claude Code).
> Expect AI-generated code and rapid iteration. Review before relying on it in production-critical setups.

## [Unreleased]

### Fixed

- Yearly view: months covered only by a predecessor take their total from the predecessor's HA monthly statistics instead of staying empty.
- The month a predecessor is replaced in sums both sources' day values instead of only the main entity's part.

## [0.8.0] - 2026-09-12

### Added

- External long-term statistics (`domain:object_id`) as entity rows, predecessors and expression operands.
  Kind, unit and name come from HA's statistics metadata (`recorder/get_statistics_metadata`).
- `state_class` row option to force `total` or `total_increasing` where the metadata cannot tell them apart.
- The editor picks from all statistics (entities and external) for rows and predecessors, and flags IDs without long-term statistics.

### Changed

- Editor: threshold rules and predecessor entries use HA form selectors (dropdown operator, date picker, statistic picker) inside outlined expansion panels.
- Editor: row options are grouped into Display, Thresholds and Predecessors panels; fields carry helper text; toggles are switches.
- Editor: the entity row only offers the visibility switches and the `state_class` override that apply to its kind.
- Editor: an always-visible statistic picker under the row list adds entity rows; the card option sits above the list.
- Editor: threshold panel headers name each period (`> day 5 · month 100`).
- Rows whose ID has no long-term statistics show the `⚠` label prefix and empty cells, as documented.

### Fixed

- Editor: clearing an inline row picker removes the row instead of being ignored.
- Editor: an unknown statistic ID in a formula warns but no longer blocks saving; a stored invalid formula shows its state when the editor opens.
- Yearly view showed empty months, and empty whole years, wherever the main entity had no HA monthly bucket, even when a predecessor supplied the daily values.
  Every month with daily values now gets a summary; the cumulative total stays empty without an HA bucket.
- An external predecessor of a `total_increasing` entity was skipped as a kind mismatch.
  A predecessor without a state object now inherits the main row's cumulative kind.
- README no longer claims the card reads `has_mean` and `mean_type` from the statistics response.
- The first recorded day of a year in a sparse statistic (imported data with rows only on days with a value) showed the all-time cumulative `sum` instead of the day's delta.
  Day cells now use HA's `change`, which is computed against the last row even when it lies before the fetch window.

## [0.7.0] - 2026-09-09

### Added

- Installation through HACS as a custom repository.
  GitHub Releases now carry the built `calendar-stats-card.js`, and HACS installs and updates the card from there.
- MIT license.

### Removed

- Speckit specification tooling and the `specs/` directory.
  Project rules live in `.claude/CLAUDE.md`; contributor and release workflow in `CONTRIBUTING.md`.

## [0.6.0] - 2026-09-06

### Added

- Threshold days table below the tables.
  For every named threshold it shows how many days that rule coloured, and how many days it applied to at all, over the range on screen.
  In the yearly view the counts are broken down per year.
  Switch it off in the editor's Options section or with `show_threshold_table: false`.
- The card picks up a finished day on its own at midnight.
  A dashboard left open no longer keeps showing yesterday's data until someone reloads it.

### Fixed

- In the visual editor, "not below" and "not above" rules looked exactly like "at least" and "at most", so two rules on the same value could not be told apart.
  They now read `↓≥` and `↑≤`.
- The current month's Total for cumulative rows counted today's partial data while every other figure stopped at yesterday; it now covers completed days only.
  On the 1st of a month nothing is complete yet, so the card shows a short note instead of an empty table.
- Threshold rules that set only a text colour showed an empty box in the legend.
  The swatch now shows a sample letter in that colour.

### Changed

- The card is considerably faster: it no longer redraws on every Home Assistant update, and loading a year of data takes a fraction of the time it used to.

### Removed

- The `*` marker for days with incomplete data.
  It was documented but never actually appeared, in this release or earlier ones; displayed values are unchanged.

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

[Unreleased]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/MarkusMit/calendar-stats-card/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MarkusMit/calendar-stats-card/releases/tag/v0.2.0
