# Display Contract: Default Precision

The card exposes a display contract to dashboard authors via the rendered numeric cells.
This feature changes one term of that contract: the default decimal count.

## Contract

For any row (entity or expression) and any numeric cell (day value, monthly min/avg/max, total, daily diff):

| Config | Rendered decimals | Example input | Example output |
|--------|-------------------|---------------|----------------|
| `precision` unset | exactly 1 (fixed) | `1.234` | `1.2` |
| `precision` unset | exactly 1 (fixed) | `5` | `5.0` |
| `precision: 0` | 0 | `1.6` | `2` |
| `precision: 2` | exactly 2 (fixed) | `1.234` | `1.23` |

- Rounding is `Intl.NumberFormat` default (round-half-to-even / locale standard), identical to the pre-existing explicit-precision path.
- Locale is the card's active language (`en` / `de`); decimal separator follows locale (`de` → `,`).
- Non-finite values (NaN / Infinity) render as an empty cell — unchanged.

## Non-goals

- No change to which cells are rendered, to summary computation, or to `show_zero` / `device_class` logic.
- No change to the `precision` config field type, range, or editor.
