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

**Output**: Dispatches `config-changed` with `{ config: CardConfig }` on every valid mutation.

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
| `_dirtyFormula` | `string` | Formula as typed; may be invalid while user edits |
| `_formulaError` | `string \| null` | `null` = valid; error key string = invalid |

**Output**: Dispatches `row-changed` with `{ index: number, config: ExpressionRowConfig }` — **only when formula is valid**. Never dispatches with an invalid formula.

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
│  [hass, _entities, _rest]
│  ↓ dispatches: config-changed
│
├── ha-sortable (drag-and-drop)
│   │  ↑ item-moved event
│   │
│   ├── EntityRowEditor × N (entity rows)
│   │   │  [hass, config, index, lang]
│   │   │  ↑ row-changed event
│   │   │
│   │   ├── ha-entity-picker           (entity ID — always visible)
│   │   ├── ha-textfield (name)        (always visible)
│   │   ├── ha-textfield (precision)   (always visible)
│   │   └── ha-expansion-panel "Advanced"
│   │       ├── ha-textfield (factor, unit)
│   │       ├── ha-checkbox × 4 (show_zero, show_min, show_avg, show_max)
│   │       ├── ha-color-picker (text_color)
│   │       ├── ha-color-picker (background_color)
│   │       ├── ha-expansion-panel "Thresholds"
│   │       │   └── ThresholdListEditor
│   │       │       │  [thresholds, lang]
│   │       │       │  ↑ thresholds-changed event
│   │       │       └── ThresholdRule × M
│   │       │           ├── ha-select (operator — 6 options)
│   │       │           ├── ha-textfield type=number (value)
│   │       │           ├── ha-textfield (name, optional)
│   │       │           ├── ha-color-picker (text_color, optional)
│   │       │           └── ha-color-picker (background_color, optional)
│   │       └── ha-expansion-panel "Predecessors"
│   │           └── PredecessorListEditor
│   │               │  [hass, predecessors, lang]
│   │               │  ↑ predecessors-changed event
│   │               └── PredecessorConfig × K
│   │                   ├── ha-textfield (entity ID — plain text)
│   │                   ├── ha-date-input (replaced_on, optional)
│   │                   └── ha-textfield type=number (factor, optional)
│   │
│   └── ExpressionRowEditor × N (expression rows)
│       │  [hass, config, index, lang]
│       │  ↑ row-changed event (only when formula valid)
│       │
│       ├── ha-textarea (formula)     (always visible)
│       ├── ha-textfield (name)       (always visible)
│       ├── ha-textfield (unit)       (always visible)
│       ├── ha-textfield (precision)  (always visible)
│       └── ha-expansion-panel "Advanced"
│           ├── ha-checkbox (show_zero)
│           ├── ha-color-picker (text_color)
│           ├── ha-color-picker (background_color)
│           └── ha-expansion-panel "Thresholds"
│               └── ThresholdListEditor
│
├── "Add row" button + type menu
│   └── on "Entity row" → ha-entity-picker → new EntityRowConfig appended
│   └── on "Expression row" → new ExpressionRowConfig appended (hidden from preview until formula valid)
│
└── Empty-state message (shown when _entities.length === 0, FR-017)
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
    type: 'calendar-stats-card';
    entities: EntityConfig[];      // ordered, unified list
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
