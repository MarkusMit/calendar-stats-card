# Quickstart: Monthly Stats Card

## Prerequisites

- Node.js 24.15 (WSL2)
- Home Assistant 2026.5.0+ (for local testing and deployment)

## Setup

```bash
cd frontend
npm install
```

## Build

```bash
npm run build
# Output: frontend/dist/tabularizer-card.js
```

## Deploy to Home Assistant

1. Copy `frontend/dist/tabularizer-card.js` to `<ha-config>/www/tabularizer-card.js`
2. Add to your dashboard's resource list:

```yaml
resources:
  - url: /local/tabularizer-card.js
    type: module
```

3. Reload the browser (hard reload: Ctrl+Shift+R)

## Test

```bash
# Run all tests (Vitest — write tests before implementation per TDD)
npm test

# Watch mode during active development
npm run test:watch

# Coverage report (opens HTML report in dist/coverage/)
npm run test:coverage
```

## Lint

```bash
npm run lint
```

## Card YAML Configuration

```yaml
type: custom:tabularizer-card
entities:
  - entity: sensor.outdoor_temperature
    label: "Temperature"          # optional override; otherwise uses HA friendly name
  - entity: sensor.precipitation_gauge
    label: "Rain"
  - entity: sensor.daily_energy_consumption
    # no label — uses HA friendly name
```

## TypeScript

```bash
# Type-check only (no emit)
npx tsc --noEmit
```

## Notes

- All commands run in WSL2 (Node.js 24.15)
- Output bundle is a single ES module; do not use IIFE format
- Tests use happy-dom (not jsdom); no browser binary required
- Coverage indicators (asterisk `*`) only appear for statistics within the HA recorder's hourly retention window (~10 days by default)
