# Data Model: UI Configuration Editor

## Overview

The editor is a stateless-first component hierarchy: the root element owns all mutable state; sub-components receive immutable props and emit typed events. No shared mutable state between siblings.

---

## Component State

### CalendarStatsCardEditor (root, `calendar-stats-card-editor`)

| Property | Type | Source | Notes |
|---|---|---|---|
| `hass` | `HomeAssistant` | HA framework (reactive) | Used for entity existence checks, entity picker, language |
| `_entities` | `EntityConfig[]` | Derived from `setConfig()` | Mutable copy; source of truth for all row operations |
| `_rest` | `Record<string, unknown>` | Derived from `setConfig()` | Unknown top-level config fields — preserved, never modified (FR-010) |
| `_addingEntityRow` | `boolean` | Internal | When true, the add-row area renders the inline `ha-entity-picker` + cancel button instead of the two chips |
| `_editingIndex` | `number \| null` | Internal | When non-null, the panel renders the row detail page for `_entities[_editingIndex]` instead of the list (FR-018) |
| `_entityPickerReady` | `boolean` | Internal | False until `customElements.get('ha-entity-picker')` resolves; gates the loading placeholder (FR-019) |

**Output**: Dispatches `config-changed` with `{ config: CardConfig }` on every valid mutation. The dispatched `config.type` is `'custom:calendar-stats-card'` (the `custom:` prefix is required by HA); empty-formula expression rows are filtered out of `entities` before dispatch (FR-008).

---

### EntityRowEditor (`calendar-stats-entity-row-editor`)

| Property | Type | Source | Notes |
|---|---|---|---|
| `hass` | `HomeAssistant` | Parent |  |
| `config` | `EntityRowConfig` | Parent | Immutable; mutations emitted via event |
| `index` | `number` | Parent | Row position for event routing |
| `lang` | `string` | Parent |  |

**Internal state**: None (stateless).

**Output**: Dispatches `row-changed` with `{ index: number, config: EntityRowConfig }`.

---

### ExpressionRowEditor (`calendar-stats-expression-row-editor`)

| Property | Type | Source | Notes |
|---|---|---|---|
| `hass` | `HomeAssistant` | Parent |  |
| `config` | `ExpressionRowConfig` | Parent | Immutable |
| `index` | `number` | Parent |  |
| `lang` | `string` | Parent |  |

| Internal State | Type | Notes |
|---|---|---|
| `_formulaError` | `string \| null` | `null` = valid (or empty); localized error message string when invalid. There is no separate `_dirtyFormula` — the formula is stored in `config.expression` and validated on each `ha-form` `value-changed` event. |

**Output**: Dispatches `row-changed` with `{ index: number, config: ExpressionRowConfig }` — **only when formula is valid** (including the empty case: empty formulas do not dispatch and are filtered from the root payload per FR-008). Never dispatches with an invalid formula.

---

### ThresholdListEditor (`calendar-stats-threshold-list-editor`)

| Property | Type | Source | Notes |
|---|---|---|---|
| `thresholds` | `ThresholdRule[]` | Parent | Immutable |
| `lang` | `string` | Parent |  |

**Internal state**: None.

**Output**: Dispatches `thresholds-changed` with `{ thresholds: ThresholdRule[] }` on any add/remove/field change.

---

### PredecessorListEditor (`calendar-stats-predecessor-list-editor`)

| Property | Type | Source | Notes |
|---|---|---|---|
| `hass` | `HomeAssistant` | Parent | For stale entity detection |
| `predecessors` | `PredecessorConfig[]` | Parent | Immutable |
| `lang` | `string` | Parent |  |

**Internal state**: None.

**Output**: Dispatches `predecessors-changed` with `{ predecessors: PredecessorConfig[] }` on any mutation.

---

## Component Hierarchy

```
CalendarStatsCardEditor
│  [hass, _entities, _rest, _addingEntityRow, _editingIndex, _entityPickerReady]
│  ↓ dispatches: config-changed
│
├── if !_entityPickerReady → loading placeholder (editor.loading)
│
├── if _editingIndex !== null → DETAIL VIEW (FR-018)
│   ├── detail-header
│   │   ├── back-arrow ha-icon-button → _editingIndex = null
│   │   ├── row label (name || entity || expression || type fallback)
│   │   └── row-type-badge ("Entity row" | "Expression row")
│   └── detail-content
│       └── EntityRowEditor  OR  ExpressionRowEditor (see sub-trees below)
│
└── else → LIST VIEW
    ├── if _entities.length > 0:
    │   └── ha-sortable handle-selector=".drag-handle" @item-moved
    │       └── row-list
    │           └── row × N:
    │               ├── drag-handle ha-svg-icon
    │               ├── if entity row → inline ha-entity-picker bound to config.entity (dispatches config-changed without opening detail)
    │               │  else expression row → mdi:function-variant icon + (name || expression || "Expression row") label
    │               ├── delete ha-icon-button (mdi:delete)
    │               └── edit pencil ha-icon-button (mdi:pencil) → _editingIndex = i
    │  else → italic empty-state (editor.no_rows) above the chips
    │
    └── add-row-section
        ├── if !_addingEntityRow → two chips:
        │   ├── "+ Entity"     chip → _addingEntityRow = true
        │   └── "+ Expression" chip → _addExpressionRow() (appends draft + opens detail)
        └── else → entity-picker-row:
            ├── ha-entity-picker @value-changed → _addEntityRow(id)
            └── cancel "✕" button → _addingEntityRow = false

EntityRowEditor (rendered inside the detail view for an entity row)
│  [hass, config, index, lang]
│  ↑ row-changed event
│
├── ha-form (schema MAIN): entity, name, precision
├── if hass.states[config.entity] is undefined → stale-entity warning (mdi:alert-circle + editor.entity_not_found, FR-013)
└── ha-expansion-panel "Advanced" (collapsed by default)
    └── advanced-content
        ├── ha-form (schema ADVANCED): factor, unit, text_color, background_color
        ├── visibility-row: ha-formfield + ha-checkbox × 4 (show_zero, show_min, show_avg, show_max — one-row strip, default-on)
        ├── ThresholdListEditor (rendered directly inside Advanced; no extra collapsible wrapper)
        │   │  [thresholds, lang]
        │   │  ↑ thresholds-changed event
        │   ├── section-title "Thresholds"
        │   ├── per-rule ha-expansion-panel × M (outlined, header = "{operator-symbol} {value}" or "{name} ({symbol} {value})")
        │   │   └── threshold-fields:
        │   │       ├── <select> operator (6 options)
        │   │       ├── <input type=number> value
        │   │       ├── <input type=text> name (optional)
        │   │       ├── <input type=text> text_color (plain text; ha-color-picker MAY substitute — FR-015)
        │   │       ├── <input type=text> background_color
        │   │       └── delete ha-icon-button
        │   └── "+ Add threshold" chip → appends { operator: 'above', value: 0 }
        └── PredecessorListEditor (rendered directly inside Advanced)
            │  [hass, predecessors, lang]
            │  ↑ predecessors-changed event
            ├── section-title "Predecessors"
            ├── per-entry bordered card × K:
            │   ├── <input type=text> entity ID (plain text)
            │   ├── if stale → stale-entity warning (mdi:alert-circle + editor.entity_not_found)
            │   ├── <input type=text placeholder="YYYY-MM-DD"> replaced_on (plain text; ha-date-input MAY substitute — FR-016)
            │   ├── <input type=number> factor (optional)
            │   └── delete ha-icon-button
            └── "+ Add predecessor" chip → appends { entity: '' }

ExpressionRowEditor (rendered inside the detail view for an expression row)
│  [hass, config, index, lang]  +  _formulaError state
│  ↑ row-changed event (only when formula valid; never dispatched on invalid)
│
├── ha-form (schema MAIN): expression (text selector with multiline: true), name, unit, precision
├── if _formulaError → inline error message
└── ha-expansion-panel "Advanced" (collapsed by default)
    └── advanced-content
        ├── ha-form (schema ADVANCED): show_zero, text_color, background_color
        └── ThresholdListEditor (same structure as above; predecessor-list is NOT used for expression rows)
```

---

## Validation Rules

| Field | Component | Rule | Timing | Display |
|---|---|---|---|---|
| Entity ID (entity row) | EntityRowEditor | `hass.states[id] !== undefined` | On render / hass change | Warning icon + "Entity not found" (FR-013) |
| Formula | ExpressionRowEditor | Syntactically valid (tokenize) + all referenced entities in `hass.states` | On blur (FR-012) | Inline error: "Invalid expression syntax" or "Entity not found: {id}" |
| Predecessor entity ID | PredecessorListEditor | `hass.states[id] !== undefined` | On render / hass change | Warning icon + "Entity not found" (FR-013) |
| `replaced_on` (text fallback) | PredecessorListEditor | Valid ISO date YYYY-MM-DD regex | On blur | Format hint; invalid input not saved |
| Precision | EntityRowEditor / ExpressionRowEditor | Integer ≥ 0 | `type=number` / `min=0` / `step=1` HTML constraints | Browser native |
| Threshold value | ThresholdListEditor | Any number | `type=number` HTML constraint | Browser native |

---

## Unknown Field Preservation (FR-010)

### Top-level fields

```typescript
// setConfig receives: { type, entities, ...unknown }
// _rest stores all unknown keys
// dispatch includes: { type, entities, ..._rest }
```

### Per-entity-row fields

```typescript
// Known: entity, name, precision, factor, unit,
//        show_zero, show_min, show_avg, show_max,
//        text_color, background_color, thresholds, predecessors
// Unknown: spread into output row object unchanged
```

### Per-expression-row fields

```typescript
// Known: expression, name, unit, precision, show_zero,
//        text_color, background_color, thresholds
// Unknown: spread into output row object unchanged
```

---

## Config-Changed Event Format

```typescript
interface ConfigChangedDetail {
  config: {
    type: 'custom:calendar-stats-card';
    entities: EntityConfig[];      // ordered, unified list with empty-formula expression rows filtered out (FR-008)
    [key: string]: unknown;        // preserved unknown top-level fields
  };
}
```

Dispatched as:
```typescript
this.dispatchEvent(new CustomEvent('config-changed', {
  detail: { config: newConfig },
  bubbles: true,
  composed: true,
}));
```
