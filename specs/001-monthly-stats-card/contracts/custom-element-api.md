# Custom Element API Contract

## Element Registration

**Custom element name**: `tabularizer-card`  
**Lovelace card type** (YAML): `custom:tabularizer-card`  
**Bundle file**: `tabularizer-card.js` (loaded as a Lovelace resource)

## Lovelace Card Interface

The element implements the standard HA Lovelace card lifecycle:

### `setConfig(config: CardConfig): void`

Called by HA when the card configuration is set or updated.

- Validates `config.entities` is an array (may be empty)
- Stores the config and triggers re-render
- Throws `Error` with a localised message if config structure is invalid
- Does NOT throw if `config.entities` is empty — renders the no-entities placeholder instead

### `getCardSize(): number`

Returns the card height in 50px Lovelace layout units.

- Returns the count of visible monthly tables for the selected year (1–12)
- Default return value: 6 (approximate for mid-year load before year is known)

### `set hass(hass: HomeAssistant)`

Called by HA on every state update.

- Card stores the `hass` reference
- On first call: triggers entity metadata resolution and statistics fetch
- On subsequent calls: re-reads entity friendly names from `hass.states` (live updates)
- Card reads: `hass.config.version`, `hass.config.time_zone`, `hass.states`, `hass.connection`, `hass.selectedLanguage`, `hass.language`

## Window Registration

The bundle registers the card in `window.customCards` for the HA card picker:

```javascript
window.customCards = window.customCards || [];
window.customCards.push({
  type: "tabularizer-card",
  name: "Tabularizer",
  description: "Dense monthly statistics tables for HA entities",
});
```

## HA WebSocket API Usage

The card issues the following WebSocket commands via `hass.connection.sendMessagePromise`:

| Command | Period | Purpose |
|---|---|---|
| `recorder/statistics_during_period` | `"day"` | Day-cell values for the selected year |
| `recorder/statistics_during_period` | `"month"` | Monthly summary and total column data |
| `recorder/statistics_during_period` | `"hour"` | Coverage indicator detection (recent data only) |
| `recorder/list_statistic_ids` | N/A | Confirm long-term statistics exist per entity |

All commands are batched: one request per period type covers all configured entity IDs simultaneously.

## Timezone Handling

"Today" and the today/past boundary are computed using `hass.config.time_zone` (HA server timezone), not the browser's local timezone. This applies to:
- Determining which months are visible (current year)
- Emptying today's cell and all future cells (FR-028)
- Mapping UTC statistic timestamps to calendar days
