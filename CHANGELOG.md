# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.1]: https://github.com/MarkusMit/ha-tabularizer/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MarkusMit/ha-tabularizer/releases/tag/v0.2.0
