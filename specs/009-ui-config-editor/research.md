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
  return { type: 'custom:calendar-stats-card', entities: [] };
}
```

**Alternative rejected**: `getConfigForm()` (HA schema-based form generator) — cannot express nested sub-lists (thresholds, predecessors), custom formula validation, or unified drag-and-drop row list.

---

## 2. HA-Native Web Components (HA 2026.5+)

**Decision**: Use the following components, all available in HA 2026.5+:

| Component | Use case | FR |
|---|---|---|
| `ha-form` | Schema-driven main + Advanced field rendering for both row editors (selectors: `entity`, `text`, `number`, `boolean`, `text` with `multiline: true` for the formula) | FR-005, FR-006, FR-007 |
| `ha-entity-picker` | Inline entity ID selector per entity row in the main list view and the `+ Entity` chip flow | FR-002, FR-018 |
| `ha-selector` | (Implementation note) `ha-form`'s `entity` selector internally renders `ha-selector` with `{ entity: {} }` — required because direct `ha-entity-picker` instances rendered zero-height in our shadow DOM context before the preload workaround (FR-019) was added |
| `ha-sortable` | Drag-and-drop row reordering via `handle-selector=".drag-handle"`; emits `item-moved` `{ oldIndex, newIndex }` | FR-004 |
| `ha-expansion-panel` | "Advanced" collapsible section per row editor; also wraps each individual threshold rule (header = `> value` or `name (> value)`) | FR-006, FR-007, FR-015 |
| `ha-formfield` + `ha-checkbox` | One-row strip of `show_zero` / `show_min` / `show_avg` / `show_max` toggles inside Advanced (entity-row editor only) | FR-006 |
| Plain `<select>` + `<input>` | Threshold operator, value, name, color fields (HA's `ha-select` / `ha-color-picker` not used in current impl) | FR-015 |
| Plain `<input>` | Predecessor entity ID (text), `replaced_on` (text with `YYYY-MM-DD` placeholder), `factor` (number) — `ha-date-input` substitution allowed but not used | FR-016 |
| `ha-icon-button` | Per-row delete + pencil-to-detail; back-arrow in detail header; threshold + predecessor delete | FR-003, FR-018 |
| `ha-svg-icon` | Drag-handle icon per row | FR-004 |

**`ha-sortable` drag-and-drop**:
- Wraps the row-list `<div>` and uses `handle-selector=".drag-handle"` so only the handle icon initiates a drag
- Emits `item-moved` CustomEvent with `{ oldIndex: number, newIndex: number }` detail
- Handler: splice `_entities` array then dispatch `config-changed`
- No separate up/down `ha-icon-button` controls — accessibility relies on `ha-sortable`'s built-in keyboard support

**Color picker fallback**: The current implementation does not instantiate `ha-color-picker` anywhere; all color fields (row-level and per-threshold) use plain text inputs. The MAY-substitute clause (FR-015) is preserved for a future swap.

**Date picker fallback**: Same — `ha-date-input` is not instantiated; `replaced_on` uses a plain text input with a `YYYY-MM-DD` placeholder. MAY-substitute clause preserved (FR-016).

**`ha-entity-picker` preload**: Direct `ha-entity-picker` instances render zero-height in our shadow DOM context unless HA has registered the element. The root editor's `connectedCallback` calls `window.loadCardHelpers()` → `createCardElement({ type: 'entities', entities: [] })` → `constructor.getConfigElement()` to force registration, then awaits `customElements.whenDefined('ha-entity-picker')`. Until the element is defined, an `editor.loading` placeholder is shown in place of the row list (FR-019).

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
const newConfig = { type: 'custom:calendar-stats-card', entities: [...this._entities], ...this._rest };
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
