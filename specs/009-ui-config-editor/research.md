# Research: UI Configuration Editor

## 1. HA Lovelace Card Editor Protocol

**Decision**: Register `calendar-stats-card-editor` as a custom element; expose via `CalendarStatsCard.getConfigElement()` and `CalendarStatsCard.getStubConfig()`.

**Rationale**: HA Lovelace instantiates the editor via `getConfigElement()` when the user opens the card editor panel. HA sets `.hass` and calls `setConfig(config)` on the editor element, then listens for `config-changed` CustomEvents to update the card preview.

**Protocol**:
- HA sets `editor.hass = hass` — provides `HomeAssistant` object (entity states, language)
- HA calls `editor.setConfig(config)` — provides current card config
- Editor dispatches `new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true, composed: true })` on every valid mutation
- HA applies `newConfig` to the card preview immediately (satisfies FR-008)
- The editor does **not** dispatch `config-changed` when a formula is invalid — the card retains its last valid config (satisfies FR-008 brand-new / invalid formula behavior)

**Required additions to `CalendarStatsCard`**:
```typescript
static getConfigElement(): HTMLElement {
  return document.createElement('calendar-stats-card-editor');
}

static getStubConfig(): CardConfig {
  return { type: 'calendar-stats-card', entities: [] };
}
```

**Alternative rejected**: `getConfigForm()` (HA schema-based form generator) — cannot express nested sub-lists (thresholds, predecessors), custom formula validation, or unified drag-and-drop row list.

---

## 2. HA-Native Web Components (HA 2026.5+)

**Decision**: Use the following components, all available in HA 2026.5+:

| Component | Use case | FR |
|---|---|---|
| `ha-entity-picker` | Main entity ID selection per entity row | FR-002 |
| `ha-sortable` | Drag-and-drop row reordering (wraps SortableJS) | FR-004 |
| `ha-expansion-panel` | "Advanced" collapsible section and nested Thresholds/Predecessors sub-sections | FR-006, FR-007, FR-015, FR-016 |
| `ha-textfield` | Name, unit, precision, factor, predecessor entity ID text input, predecessor factor, color fallback | FR-005, FR-006, FR-007, FR-015, FR-016 |
| `ha-select` + `ha-list-item` | Threshold operator dropdown (6 values) | FR-015 |
| `ha-color-picker` | Color input for row-level and per-threshold colors | FR-015 |
| `ha-date-input` | Predecessor `replaced_on` ISO date | FR-016 |
| `ha-icon-button` | Remove row / threshold / predecessor buttons | FR-003 |
| `ha-checkbox` | Boolean toggles: show_zero, show_min, show_avg, show_max | FR-006, FR-007 |

**`ha-sortable` drag-and-drop**:
- Emits `item-moved` CustomEvent with `{ oldIndex: number, newIndex: number }` detail
- Handler: splice `_entities` array then dispatch `config-changed`
- Up/down `ha-icon-button` controls provide keyboard fallback with same splice logic

**`ha-color-picker` note**: Renders a full HSL canvas picker. If not registered (edge case), fall back to `ha-textfield` accepting any CSS color string.

**Alternative rejected**: Custom input elements, third-party color pickers — violate FR-014 and Constitution Principle I.

---

## 3. Expression Formula Validation

**Decision**: Reuse `tokenize()` and `extractEntityIds()` from the existing `expression-evaluator.ts`; use `hass.states` for entity existence check.

**Formula syntax** (from `expression-evaluator.ts`):
- Wrapped in `{{ }}` delimiters (stripped before parsing)
- Supports: numbers, entity IDs (containing `.`), `+`, `-`, `*`, `/`, `(`, `)`
- `tokenize()` throws `SyntaxError` on unrecognised characters or structure
- `extractEntityIds()` returns all tokens matching `[a-zA-Z_][a-zA-Z0-9_.]*` that contain a `.`

**Validation function** (to implement in `expression-row-editor.ts`):
```typescript
function validateFormula(
  formula: string,
  hass: HomeAssistant
): { valid: boolean; error?: 'invalid_syntax' | `entity_not_found:${string}` } {
  try {
    tokenize(formula); // throws SyntaxError if malformed
  } catch {
    return { valid: false, error: 'invalid_syntax' };
  }
  for (const id of extractEntityIds(formula)) {
    if (!hass.states[id]) {
      return { valid: false, error: `entity_not_found:${id}` };
    }
  }
  return { valid: true };
}
```

**Timing**: Fires on `blur` event only; no validation while typing (FR-012).

**Preview behavior**: `config-changed` dispatched only when formula is valid. While invalid: error message shown in editor, no event dispatched, card preview unchanged. Brand-new row excluded from dispatched config until valid (FR-008).

**Alternative rejected**: HA Templates API for server-side validation — async, adds latency, overkill given the existing synchronous client-side parser.

---

## 4. Unknown Field Preservation (FR-010)

**Decision**: Destructure known fields; carry remaining fields in `_rest` / `_rowRest` and spread into dispatched config.

**Top-level preservation**:
```typescript
// On setConfig:
const { type, entities, ...rest } = config;
this._rest = rest;

// On dispatch:
const newConfig = { type: 'calendar-stats-card', entities: [...this._entities], ...this._rest };
```

**Per-row preservation**:
```typescript
// EntityRowConfig — known fields destructured; rowRest spread into output
const { entity, name, precision, factor, unit,
        show_zero, show_min, show_avg, show_max,
        text_color, background_color, thresholds, predecessors,
        ...rowRest } = cfg as EntityRowConfig;
```

---

## 5. Stale Entity Detection (FR-013)

**Decision**: Check `hass.states[entityId]` directly. Entity ID is considered stale if `hass.states[entityId]` is `undefined`.

**Applied to**:
- Main entity ID on entity rows (checked in `entity-row-editor.ts`)
- Predecessor entity IDs in the predecessor list (checked in `predecessor-list-editor.ts`)
- Entity IDs referenced in expression formulas (checked during formula validation in `expression-row-editor.ts`)

**Display**: Warning icon (`ha-icon` with `mdi:alert-circle`) + localised "Entity not found" text rendered inline below the relevant input.

---

## 6. i18n: New Translation Keys

All keys added to `en.json` and `de.json` simultaneously (Constitution IV). Keys namespaced under `editor.*` and `threshold.operators.*`.

```json
{
  "editor": {
    "add_row": "Add row",
    "entity_row": "Entity row",
    "expression_row": "Expression row",
    "no_rows": "No rows yet — add your first row above",
    "remove_row": "Remove row",
    "advanced": "Advanced",
    "name": "Display name",
    "precision": "Precision (decimal places)",
    "factor": "Factor",
    "unit": "Unit",
    "show_zero": "Show zero-value days",
    "show_min": "Show minimum",
    "show_avg": "Show average",
    "show_max": "Show maximum",
    "text_color": "Text color",
    "background_color": "Background color",
    "formula": "Formula",
    "thresholds": "Thresholds",
    "add_threshold": "Add threshold",
    "remove_threshold": "Remove threshold",
    "threshold_operator": "Operator",
    "threshold_value": "Value",
    "threshold_name": "Label (optional)",
    "predecessors": "Predecessors",
    "add_predecessor": "Add predecessor",
    "remove_predecessor": "Remove predecessor",
    "predecessor_entity": "Entity ID",
    "predecessor_replaced_on": "Replaced on",
    "predecessor_factor": "Factor (optional)",
    "entity_not_found": "Entity not found",
    "invalid_expression_syntax": "Invalid expression syntax",
    "entity_not_found_in_expression": "Entity not found: {entity}"
  },
  "threshold": {
    "operators": {
      "above": "Above (>)",
      "equals_above": "At least (≥)",
      "equals_below": "At most (≤)",
      "below": "Below (<)",
      "not_below": "Not below (≥)",
      "not_above": "Not above (≤)"
    }
  }
}
```

**Note**: `localize()` does not currently support `{placeholder}` substitution. The `entity_not_found_in_expression` key requires the entity ID appended at runtime; implement as `localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)` or extend `localize()` with a replacement map.
