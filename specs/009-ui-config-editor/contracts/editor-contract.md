# Editor Contract: calendar-stats-card-editor

## Element Interface

**Custom element tag**: `calendar-stats-card-editor`
**Registered by**: `@customElement('calendar-stats-card-editor')` in `components/calendar-stats-card-editor.ts`
**Instantiated by**: `CalendarStatsCard.getConfigElement()` → `document.createElement('calendar-stats-card-editor')`

### Properties (set by HA framework)

| Property | Type | Set by | Notes |
|---|---|---|---|
| `hass` | `HomeAssistant` | HA Lovelace (reactive) | Updated whenever HA state changes; triggers stale-entity re-check |
| (config) | `CardConfig` | HA via `setConfig(config)` | Called once on panel open; not a reactive Lit property |

### Methods (called by HA framework)

| Method | Signature | Contract |
|---|---|---|
| `setConfig(config)` | `(config: CardConfig) => void` | Must be idempotent; must not throw for any structurally valid `CardConfig`; preserves unknown fields |

### Static Methods (called by HA framework on `CalendarStatsCard`)

| Method | Signature | Contract |
|---|---|---|
| `getConfigElement()` | `() => HTMLElement` | Returns `document.createElement('calendar-stats-card-editor')` |
| `getStubConfig()` | `() => CardConfig` | Returns `{ type: 'custom:calendar-stats-card', entities: [] }` (the `custom:` prefix is required — without it HA rejects the config-changed event and falls back to YAML mode) |

---

## config-changed Event Contract

### Trigger Conditions

The editor MUST dispatch `config-changed` when:
- A row is added, removed, or reordered
- Any field in a row changes to a valid value

The editor MUST NOT dispatch `config-changed` when:
- The expression formula field contains an invalid value (syntax error or unknown entity)
- The `replaced_on` date field (text fallback) contains an invalid ISO date string

### Event Shape

```typescript
interface ConfigChangedEvent extends CustomEvent {
  type: 'config-changed';
  bubbles: true;
  composed: true;
  detail: {
    config: {
      type: 'custom:calendar-stats-card';
      entities: EntityConfig[];
      [unknownKey: string]: unknown;  // preserved top-level unknown fields
    };
  };
}
```

### Dispatch Call

```typescript
this.dispatchEvent(new CustomEvent('config-changed', {
  detail: { config: newConfig },
  bubbles: true,
  composed: true,
}));
```

### Payload Invariants

1. `config.type` MUST equal `'custom:calendar-stats-card'`
2. `config.entities` MUST be an `EntityConfig[]` in the editor's current display order, with empty-formula expression rows filtered out (an `ExpressionRowConfig` whose `expression === ''` is excluded from the dispatched payload — FR-008)
3. All unknown top-level fields from the original config MUST be present unchanged (FR-010)
4. All unknown per-row fields from original row configs MUST be present unchanged (FR-010)
5. Each `EntityRowConfig` in `entities` MUST have `entity: string`
6. Each `ExpressionRowConfig` in `entities` MUST have `expression: string`

---

## Internal Sub-Component Events

These events are internal to the editor — not part of the HA API.

| Event | Detail | Emitted by | Handled by |
|---|---|---|---|
| `row-changed` | `{ index: number, config: EntityRowConfig \| ExpressionRowConfig }` | EntityRowEditor, ExpressionRowEditor | CalendarStatsCardEditor |
| `thresholds-changed` | `{ thresholds: ThresholdRule[] }` | ThresholdListEditor | EntityRowEditor, ExpressionRowEditor |
| `predecessors-changed` | `{ predecessors: PredecessorConfig[] }` | PredecessorListEditor | EntityRowEditor |
| `item-moved` | `{ oldIndex: number, newIndex: number }` | ha-sortable | CalendarStatsCardEditor |

---

## getStubConfig Contract

`CalendarStatsCard.getStubConfig()` returns:
```typescript
{ type: 'custom:calendar-stats-card', entities: [] }
```

This config is used when the user adds the card fresh from the card picker. The editor MUST:
- Accept this config without throwing
- Render the FR-017 empty-state message (above the add-row chips)
- Show the `+ Entity` and `+ Expression` chips (FR-002)
- While `ha-entity-picker` is not yet registered in `customElements`, render the `editor.loading` placeholder in place of the row list (FR-019)

---

## Formula Validation Contract (ExpressionRowEditor)

The formula field follows this validation contract:

1. Validation fires on each `value-changed` event from the wrapping `ha-form` (FR-012 — `ha-form` typically emits `value-changed` on blur for text selectors, not per keystroke; treat the event as the "blur" trigger)
2. On each event, the formula is validated:
   - Empty / whitespace-only formula → clear error, do NOT dispatch `row-changed` (the empty draft is filtered out by `_dispatchConfigChanged()` per FR-008)
   - Syntax error (from `extractEntityIds` / `tokenize`) → display `localize('editor.invalid_expression_syntax', lang)`, do not dispatch
   - Entity not found in extracted IDs → display `localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)`, do not dispatch
   - Valid → clear error, dispatch `row-changed` with updated config
3. The formula text in the input is never cleared or modified by validation
4. While formula is invalid: the row is excluded from the dispatched config (card preview retains last valid state)

## Row Detail Page Contract (CalendarStatsCardEditor)

The editor panel renders one of two mutually exclusive views (FR-018):

- **List view** (`_editingIndex === null`): drag-handle + identity + delete + pencil per row, plus add-row chips and optional empty-state.
- **Detail view** (`_editingIndex !== null`): back-arrow header → row label → type badge, then `<calendar-stats-entity-row-editor>` or `<calendar-stats-expression-row-editor>` bound to `_entities[_editingIndex]`.

State transitions:

| Trigger | Effect |
|---|---|
| Pencil icon on row `i` | `_editingIndex = i` |
| Back-arrow in detail header | `_editingIndex = null` |
| Adding an expression row | `_editingIndex = newIndex` (auto-open) |
| Adding an entity row via inline picker | `_editingIndex = newIndex` (auto-open) |
| Deleting row `i` | If `_editingIndex === i` then `null`; else if `_editingIndex > i` then `_editingIndex--` |

Inline edits via the entity row's `ha-entity-picker` in the list view dispatch `config-changed` directly without changing `_editingIndex`.
