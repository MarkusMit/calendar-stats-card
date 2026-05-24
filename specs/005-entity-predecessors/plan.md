# Implementation Plan: Entity Predecessor Configuration

**Branch**: `005-entity-predecessors` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-entity-predecessors/spec.md`

## Summary

Extend `EntityRowConfig` with an optional `predecessors` list. Each predecessor has an entity ID, an optional `replaced_on` ISO date, and an optional `factor` number for unit-scaling. A new `predecessor-resolver.ts` service merges predecessor data into the main entity's daily-value map entries after the initial stats fetch. All downstream code — rendering, monthly summaries, expression evaluation — is unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Lit 3.x (web components), Vitest (unit tests)
**Storage**: N/A — reads from HA recorder via WebSocket
**Testing**: Vitest — `npm test` from `frontend/`
**Target Platform**: Home Assistant Lovelace (browser, HA 2026.5.0+)
**Project Type**: Browser custom card (LitElement)
**Performance Goals**: No additional network round-trips relative to current (predecessor IDs bundled into existing fetch calls)
**Constraints**: No new runtime dependencies; HA-provided APIs only
**Scale/Scope**: Up to ~10 entity rows, each with up to ~5 predecessors — no scaling concern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — no UI changes; purely data layer; no custom styling introduced
- [x] **II. Test-First** — `predecessor-resolver.test.ts` written and failing before implementation
- [x] **III. Density & Data Fidelity** — monthly summaries use merged daily values (FR-013); partial coverage preserved (FR-014); computation rules unchanged
- [x] **IV. i18n from Day One** — no user-visible strings; console warnings are developer-facing only
- [x] **V. Simplicity** — one new file; two modified files; no abstractions beyond concrete need

*All gates pass. No complexity tracking required.*

## Project Structure

### Documentation (this feature)

```text
specs/005-entity-predecessors/
├── plan.md              # This file
├── research.md          # Phase 0: architecture findings
├── data-model.md        # Phase 1: type changes and resolver contract
└── tasks.md             # Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code

```text
frontend/src/
├── types/
│   └── card-config.ts          # MODIFY: add PredecessorConfig, predecessors field
└── services/
    ├── predecessor-resolver.ts  # CREATE: resolvePredecessorData function
    └── (existing files unchanged)

frontend/src/tabularizer-card.ts # MODIFY: include predecessor IDs in fetch; call resolver

frontend/tests/unit/services/
    └── predecessor-resolver.test.ts  # CREATE: unit tests (TDD)
```

**No changes to**: `data-transform.ts`, `statistics-service.ts`, `year-table.ts`, `monthly-table.ts`, rendering components.

## Implementation Approach

### Step 1 — Type changes (`card-config.ts`)

Add `PredecessorConfig` interface and `predecessors` optional field to `EntityRowConfig`:

```typescript
export interface PredecessorConfig {
  entity: string;
  replaced_on?: string; // ISO date YYYY-MM-DD
  factor?: number;      // multiplied onto all values; also bypasses unit compatibility check
}

export interface EntityRowConfig {
  // ... existing fields ...
  predecessors?: PredecessorConfig[];
}
```

### Step 2 — New `predecessor-resolver.ts`

Single exported function:

```typescript
export function resolvePredecessorData(
  entityConfigs: EntityConfig[],
  dailyValues: Map<string, DailyValue>,
  metadataMap: Record<string, EntityMetadata>,
  warnedPredecessors: Set<string>,
): Map<string, DailyValue>
```

Resolution algorithm (per entity row with predecessors):

1. **Compatibility filter**: For each predecessor, compare `metadataMap[predecessor.entity].stateClass` against the main entity — always enforced. Compare `.unitOfMeasurement` UNLESS `predecessor.factor` is set (factor implies explicit unit conversion; unit check bypassed). Skip incompatible predecessors; log `console.warn` once per predecessor ID via `warnedPredecessors`. When merging a predecessor with `factor` set, multiply all numeric fields (`sum`, `mean`, `min`, `max`) by `factor` before storing.

2. **Sort**: Split compatible predecessors into dated (has `replaced_on`) and undated. Sort dated ascending by `replaced_on`.

3. **Date resolution** for each date `D` covered by any of the entities in the chain:
   - `activePredecessor = sortedDated.find(p => p.replaced_on > D) ?? null`
   - If `activePredecessor`: use `dailyValues.get(`${activePredecessor.entity}::${D}`)` → store under `${mainId}::${D}` (rewrite `entityId` field to `mainId`)
   - If null (main entity range): use main entity data if it has a non-empty value; else try undated predecessors in list order, use first with non-empty data

4. Dates to consider: union of all date keys present for `mainEntityId` and any predecessor entity ID.

### Step 3 — `tabularizer-card.ts` changes

**a. Predecessor entity IDs in fetch:**
```typescript
const entityIds = [...new Set(
  this._config.entities.flatMap((cfg) => {
    if ('entity' in cfg) {
      const predIds = cfg.predecessors?.map(p => p.entity) ?? [];
      return [cfg.entity, ...predIds];
    }
    return extractEntityIds(cfg.expression);
  }),
)];
```

**b. Add instance variable:**
```typescript
private _warnedPredecessors = new Set<string>();
```

**c. Call resolver after `transformDailyStats`:**
```typescript
const rawDailyValues = transformDailyStats(...);
const dailyValues = resolvePredecessorData(
  this._config.entities,
  rawDailyValues,
  metadataMap,
  this._warnedPredecessors,
);
```

### Step 4 — Tests (`predecessor-resolver.test.ts`)

TDD: write these failing test cases BEFORE implementation:

- **Date-based (P1)**: predecessor data appears before `replaced_on`; main data appears on and after
- **Main wins on exchange date**: both have data on `replaced_on` → main entity value used
- **No predecessor after exchange date**: main has no data after `replaced_on` → cell empty (predecessor not used)
- **Fallback mode (P2)**: predecessor fills missing main entity days; main wins when both have data
- **Chained predecessors (P3)**: two dated predecessors, correct entity used per date range
- **Compatibility reject**: predecessor with different `stateClass` skipped; `console.warn` called once per ID
- **Multiple undated predecessors**: first in list with data wins; if none → empty
- **Missing predecessor entity**: no entry in `dailyValues` → empty, no crash
- **No predecessors**: output map identical to input for that entity
- **entityId rewrite**: resolved value has `entityId === mainEntityId`

## Verification

```bash
# From frontend/ in WSL2
npm test                         # All tests pass (including new predecessor-resolver.test.ts)
npm run build                    # Bundle builds without TypeScript errors
npm run lint                     # No lint errors
```

Manual smoke test in HA:
1. Configure entity row with predecessor and `replaced_on` date
2. Navigate to year/month before exchange date → predecessor data shown
3. Navigate to month of/after exchange date → main entity data shown
4. Check browser console: no warnings for compatible predecessors
5. Add incompatible predecessor (different unit) → console warning logged once

## Complexity Tracking

> No violations — all constitution checks pass.
