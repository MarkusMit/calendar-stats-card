# Quickstart: Default Entity Precision of 1

## What changed

Rows without a `precision` set now display numbers with **1 decimal place** (was: native / up to 20 decimals).

## Try it

1. Add a card with one entity row and no `precision`:

   ```yaml
   type: custom:calendar-stats-card
   entities:
     - entity: sensor.kitchen_temperature
   ```

2. Day cells, min/avg/max, and totals now show one decimal (e.g. `21.3`, `5.0`).

3. To override, set `precision` on the row:

   ```yaml
   entities:
     - entity: sensor.kitchen_temperature
       precision: 2   # → 21.34
     - entity: sensor.rain_counter
       precision: 0   # → 4
   ```

## Verify (dev)

All commands run in WSL2 from `frontend/`:

```bash
npm test          # precision-default.test.ts passes (resolvePrecision / DEFAULT_PRECISION)
npm run build     # bundle → frontend/dist/calendar-stats-card.js
```

## Acceptance mapping

| Spec | Check |
|------|-------|
| SC-001 | unset + `1.23` → `1.2` |
| SC-002 | `precision: 2` + `1.23` → `1.23` |
| SC-003 | every numeric cell shows 1 decimal when no row sets `precision` |
| SC-004 | `docs/README.md` documents default `1` for entity + expression rows |
