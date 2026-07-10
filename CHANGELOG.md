# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MarkusMit/ha-tabularizer/releases/tag/v0.2.0
