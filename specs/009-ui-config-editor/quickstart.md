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
| `src/components/calendar-stats-card-editor.ts` | Root editor element — unified row list, Add row button, empty state |
| `src/components/entity-row-editor.ts` | Per-entity-row form (name, precision always visible; Advanced collapsed) |
| `src/components/expression-row-editor.ts` | Per-expression-row form (formula, name, unit, precision visible; Advanced collapsed); formula validation on blur |
| `src/components/threshold-list-editor.ts` | Threshold sub-list — add/remove rules, operator/value/color fields |
| `src/components/predecessor-list-editor.ts` | Predecessor sub-list — add/remove entries, plain text entity ID, date picker |
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

Reuse existing `tokenize()` and `extractEntityIds()` from `src/services/expression-evaluator.ts`:

```typescript
import { tokenize, extractEntityIds } from '../services/expression-evaluator';

function validateFormula(formula, hass) {
  try { tokenize(formula); } catch { return { valid: false, error: 'invalid_syntax' }; }
  for (const id of extractEntityIds(formula)) {
    if (!hass.states[id]) return { valid: false, error: `entity_not_found:${id}` };
  }
  return { valid: true };
}
```
