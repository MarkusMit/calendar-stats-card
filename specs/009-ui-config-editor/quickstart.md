# Quickstart: UI Configuration Editor

## Prerequisites

- Node.js 24.15 in WSL2
- HA development instance at HA 2026.5.0+
- `npm install` completed in `frontend/`

## Run Tests

```bash
cd frontend
npm test
```

All tests use Vitest + happy-dom. No browser required.

## Build

```bash
npm run build
# Output: frontend/dist/calendar-stats-card.js
```

## Test the Editor in HA

1. Copy `frontend/dist/calendar-stats-card.js` to your HA `www/` folder
2. Add Lovelace resource: **Settings → Dashboards → Resources → Add** `/local/calendar-stats-card.js`
3. Open a dashboard in Edit mode → Add Card → search **"Calendar Stats"**
4. The visual editor opens automatically (no YAML textarea)

## Key Files

| File | Purpose |
|---|---|
| `src/calendar-stats-card.ts` | Main card — add `getConfigElement()` + `getStubConfig()` here |
| `src/components/calendar-stats-card-editor.ts` | Root editor element — list view (drag-handle + inline entity-picker + delete + pencil per row), detail view (back-arrow header + sub-editor), `+ Entity` / `+ Expression` chips, empty state, `ha-entity-picker` preload |
| `src/components/entity-row-editor.ts` | Per-entity-row form rendered via `ha-form` (entity, name, precision in main schema; factor/unit/text_color/background_color in Advanced schema; show_zero/show_min/show_avg/show_max as one-row checkbox strip); embeds threshold and predecessor list editors directly inside Advanced |
| `src/components/expression-row-editor.ts` | Per-expression-row form via `ha-form` (expression as multiline text selector, name, unit, precision in main schema; show_zero/text_color/background_color in Advanced); formula validation runs on each `ha-form value-changed`; never dispatches `row-changed` on invalid or empty formula |
| `src/components/threshold-list-editor.ts` | Threshold sub-list — `+ Add threshold` chip; each rule is its own `ha-expansion-panel` with header `> value` or `name (> value)`; operator/value/name/text_color/background_color fields use plain `<select>` + `<input>` |
| `src/components/predecessor-list-editor.ts` | Predecessor sub-list — `+ Add predecessor` chip; each entry is a bordered card with plain `<input>` for entity ID, `<input placeholder="YYYY-MM-DD">` for `replaced_on`, `<input type=number>` for `factor` |
| `src/translations/en.json` | English strings (source of truth; all `editor.*` and `threshold.operators.*` keys) |
| `src/translations/de.json` | German strings (must stay in sync with `en.json`) |

## TDD Workflow

Constitution Principle II is non-negotiable: write failing tests before implementation.

```bash
# 1. Write test (it will fail)
npm test                     # confirm red

# 2. Write minimal implementation
npm test                     # confirm green

# 3. Refactor if needed
npm run lint                 # confirm clean
```

## Editor Protocol

The editor communicates config changes via a CustomEvent:

```typescript
this.dispatchEvent(new CustomEvent('config-changed', {
  detail: { config: newConfig },
  bubbles: true,
  composed: true,
}));
```

HA picks up this event and updates the card preview immediately.

## Formula Validation

`ExpressionRowEditor` calls `extractEntityIds()` from `src/services/expression-evaluator.ts` on each `ha-form value-changed` event. The current shape, simplified:

```typescript
import { extractEntityIds } from '../services/expression-evaluator';

private _handleFormChanged(ev: CustomEvent): void {
  const formData = ev.detail.value as Record<string, unknown>;
  const expression = (formData['expression'] as string) ?? '';

  if (expression.trim()) {
    try {
      const ids = extractEntityIds(expression);
      this._formulaError = null;
      for (const id of ids) {
        if (this.hass && !this.hass.states[id]) {
          this._formulaError = localize('editor.entity_not_found_in_expression', this.lang).replace('{entity}', id);
          break;
        }
      }
    } catch {
      this._formulaError = localize('editor.invalid_expression_syntax', this.lang);
    }
  } else {
    this._formulaError = null;
  }

  if (this._formulaError) return; // do NOT dispatch row-changed on invalid input

  this.dispatchEvent(new CustomEvent('row-changed', {
    detail: { index: this.index, config: { ...this.config, ...formData } },
    bubbles: true,
    composed: true,
  }));
}
```

Empty / whitespace-only formulas clear the error but do not dispatch. `CalendarStatsCardEditor._dispatchConfigChanged()` then filters any `ExpressionRowConfig` with `expression === ''` out of the dispatched payload (FR-008).
