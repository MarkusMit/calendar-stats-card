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
| `getStubConfig()` | `() => CardConfig` | Returns `{ type: 'calendar-stats-card', entities: [] }` |

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
      type: 'calendar-stats-card';
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

1. `config.type` MUST equal `'calendar-stats-card'`
2. `config.entities` MUST be an `EntityConfig[]` in the editor's current display order
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
{ type: 'calendar-stats-card', entities: [] }
```

This config is used when the user adds the card fresh from the card picker. The editor MUST:
- Accept this config without throwing
- Render the FR-017 empty-state message
- Show the "Add row" button

---

## Formula Validation Contract (ExpressionRowEditor)

The formula field follows this validation contract:

1. Validation fires on `blur` only (FR-012)
2. No validation fires while the user is typing
3. On blur, `validateFormula(formula, hass)` is called:
   - If syntax error → display `localize('editor.invalid_expression_syntax', lang)`, do not dispatch
   - If entity not found → display `localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)`, do not dispatch
   - If valid → clear error, dispatch `row-changed` with updated config
4. The formula text in the input is never cleared or modified by validation
5. While formula is invalid: the row is excluded from the dispatched config (card preview retains last valid state)
