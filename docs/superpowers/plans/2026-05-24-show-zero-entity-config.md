# `show_zero` Entity Config Option — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `show_zero?: boolean` to `EntityConfig`; when `false`, day cells whose computed value is `0` render blank instead of showing `0`.

**Architecture:** Pure display-only change. Add the field to both config interfaces, then gate cell content in the two table components. Summary stat columns are unaffected. The check `cfg.show_zero !== false` treats omitted/`true` identically (show zeros).

**Tech Stack:** TypeScript, Lit, Vitest (WSL2, run from `frontend/`)

---

## File Map

| File | Change |
|---|---|
| `frontend/src/types/card-config.ts` | Add `show_zero?: boolean` to both interfaces |
| `frontend/src/components/monthly-table.ts` | Gate zero cell content in cumulative + measurement paths |
| `frontend/src/components/year-table.ts` | Same gates as monthly-table |
| `frontend/tests/component/monthly-table.test.ts` | New describe block: `show_zero` tests |
| `frontend/tests/component/year-table.test.ts` | New describe block: `show_zero` tests |

---

### Task 1: Add `show_zero` field to EntityConfig types

**Files:**
- Modify: `frontend/src/types/card-config.ts`

- [ ] **Step 1: Add the field to both interfaces**

Edit `frontend/src/types/card-config.ts` to add `show_zero?: boolean` to both `EntityRowConfig` and `ExpressionRowConfig`:

```ts
export interface EntityRowConfig {
  entity: string;
  name?: string;
  precision?: number;
  factor?: number;
  unit?: string;
  show_zero?: boolean;
}

export interface ExpressionRowConfig {
  expression: string;
  name?: string;
  unit?: string;
  precision?: number;
  show_zero?: boolean;
}

export type EntityConfig = EntityRowConfig | ExpressionRowConfig;

export function rowKey(cfg: EntityConfig): string {
  return 'entity' in cfg ? cfg.entity : cfg.expression;
}

export interface CardConfig {
  type: string;
  entities: EntityConfig[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/card-config.ts
git commit -m "feat(config): add show_zero field to EntityConfig interfaces"
```

---

### Task 2: `show_zero` support in `monthly-table` — cumulative entities

**Files:**
- Modify: `frontend/src/components/monthly-table.ts`
- Test: `frontend/tests/component/monthly-table.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this describe block at the end of `frontend/tests/component/monthly-table.test.ts`:

```ts
// show_zero option
describe('MonthlyTable — show_zero (cumulative)', () => {
  async function renderWithShowZero(showZero: boolean | undefined, sum: number) {
    const entity = 'sensor.energy';
    const meta: EntityMetadata = {
      entityId: entity,
      stateClass: 'total_increasing',
      deviceClass: 'energy',
      unitOfMeasurement: 'kWh',
      friendlyName: 'Energy',
      hasStatistics: true,
    };
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: entity,
      date: '2025-01-01',
      sum,
      partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = showZero === undefined
      ? [{ entity }]
      : [{ entity, show_zero: showZero }];
    el.dailyValues = new Map([[`${entity}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[entity, meta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + sum=0 → cell renders "0"', async () => {
    const el = await renderWithShowZero(undefined, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: true + sum=0 → cell renders "0"', async () => {
    const el = await renderWithShowZero(true, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + sum=0 → blank cell, no has-data class', async () => {
    const el = await renderWithShowZero(false, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + sum≠0 → cell renders normally', async () => {
    const el = await renderWithShowZero(false, 5.5);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('5.5');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (cumulative)"
```

Expected: `show_zero: false + sum=0` test FAILS ("0" rendered instead of "").

- [ ] **Step 3: Implement in monthly-table.ts**

In `frontend/src/components/monthly-table.ts`, locate the cumulative path inside `renderEntityRow` (around line 181). Replace:

```ts
      } else if (val?.kind === 'cumulative') {
        cellContent = `${nf.format(val.sum * f)}${val.partialCoverage ? '*' : ''}`;
      }
```

With:

```ts
      } else if (val?.kind === 'cumulative') {
        const v = val.sum * f;
        if (v !== 0 || cfg.show_zero !== false) {
          cellContent = `${nf.format(v)}${val.partialCoverage ? '*' : ''}`;
        }
      }
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (cumulative)"
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/monthly-table.ts frontend/tests/component/monthly-table.test.ts
git commit -m "feat(ui): suppress zero cells in monthly-table cumulative rows when show_zero is false"
```

---

### Task 3: `show_zero` support in `monthly-table` — measurement entities

**Files:**
- Modify: `frontend/src/components/monthly-table.ts`
- Test: `frontend/tests/component/monthly-table.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this describe block at the end of `frontend/tests/component/monthly-table.test.ts`:

```ts
describe('MonthlyTable — show_zero (measurement)', () => {
  async function renderMeasurementWithShowZero(showZero: boolean | undefined, min: number, mean: number, max: number) {
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement',
      entityId: ENTITY_ID,
      date: '2025-01-05',
      min,
      mean,
      max,
      partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = showZero === undefined
      ? [{ entity: ENTITY_ID }]
      : [{ entity: ENTITY_ID, show_zero: showZero }];
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-05`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + all-zero day → cells render "0"', async () => {
    const el = await renderMeasurementWithShowZero(undefined, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('0');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + all-zero day → all three sub-row cells blank', async () => {
    const el = await renderMeasurementWithShowZero(false, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('');
    expect(meanCell?.classList.contains('has-data')).toBe(false);
    expect(maxCell?.textContent?.trim()).toBe('');
    expect(maxCell?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + only min=0, mean and max nonzero → only min cell blank', async () => {
    const el = await renderMeasurementWithShowZero(false, 0, 5, 10);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('5');
    expect(meanCell?.classList.contains('has-data')).toBe(true);
    expect(maxCell?.textContent?.trim()).toBe('10');
    expect(maxCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + nonzero values → cells render normally', async () => {
    const el = await renderMeasurementWithShowZero(false, 2, 5, 8);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('2');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (measurement)"
```

Expected: `show_zero: false` tests FAIL (zero values still rendered).

- [ ] **Step 3: Implement in monthly-table.ts**

In `frontend/src/components/monthly-table.ts`, locate the measurement path inside `renderEntityRow` (around line 137). Replace:

```ts
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          minCells.push(html`<td class="data-cell has-data">${nf.format(val.min * f)}${pc}</td>`);
          meanCells.push(html`<td class="data-cell has-data">${nf.format(val.mean * f)}</td>`);
          maxCells.push(html`<td class="data-cell has-data">${nf.format(val.max * f)}${pc}</td>`);
        } else {
```

With:

```ts
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;
          minCells.push(minV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(minV)}${pc}</td>`);
          meanCells.push(meanV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(meanV)}</td>`);
          maxCells.push(maxV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(maxV)}${pc}</td>`);
        } else {
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (measurement)"
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/monthly-table.ts frontend/tests/component/monthly-table.test.ts
git commit -m "feat(ui): suppress zero cells in monthly-table measurement rows when show_zero is false"
```

---

### Task 4: `show_zero` support in `year-table` — cumulative entities

**Files:**
- Modify: `frontend/src/components/year-table.ts`
- Test: `frontend/tests/component/year-table.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this describe block at the end of `frontend/tests/component/year-table.test.ts`. First add the needed imports at top of test file if not already present:

```ts
import type { DailyValue, CumulativeDailyValue, MeasurementDailyValue, MonthlySummary } from '../../src/types/statistics';
```

Then append:

```ts
describe('YearTable — show_zero (cumulative)', () => {
  const RAIN_ID = 'sensor.rain';

  async function renderYearCumulative(showZero: boolean | undefined, sum: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = showZero === undefined
      ? [{ entity: RAIN_ID }]
      : [{ entity: RAIN_ID, show_zero: showZero }];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: RAIN_ID,
      date: '2025-01-01',
      sum,
      partialCoverage: false,
    };
    el.dailyValues = new Map([[`${RAIN_ID}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, precipMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + sum=0 → cell renders "0"', async () => {
    const el = await renderYearCumulative(undefined, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + sum=0 → blank cell, no has-data class', async () => {
    const el = await renderYearCumulative(false, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + sum≠0 → cell renders normally', async () => {
    const el = await renderYearCumulative(false, 3.2);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('3.2');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });
});
```

- [ ] **Step 2: Check existing imports in year-table.test.ts**

Run:

```bash
head -10 tests/component/year-table.test.ts
```

If `DailyValue`, `CumulativeDailyValue`, `MeasurementDailyValue` are not imported, add them. The import line should be:

```ts
import type { DailyValue, CumulativeDailyValue, MeasurementDailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';
```

Replace the existing statistics import line with the above.

- [ ] **Step 3: Run the failing tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (cumulative)"
```

Expected: year-table `show_zero: false + sum=0` test FAILS.

- [ ] **Step 4: Implement in year-table.ts**

In `frontend/src/components/year-table.ts`, locate the cumulative path inside `renderEntityRows` (around line 231). Replace:

```ts
      } else if (val?.kind === 'cumulative') {
        cellContent = `${nf.format(val.sum * f)}${val.partialCoverage ? '*' : ''}`;
      }
```

With:

```ts
      } else if (val?.kind === 'cumulative') {
        const v = val.sum * f;
        if (v !== 0 || cfg.show_zero !== false) {
          cellContent = `${nf.format(v)}${val.partialCoverage ? '*' : ''}`;
        }
      }
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (cumulative)"
```

Expected: all year-table cumulative `show_zero` tests PASS.

- [ ] **Step 6: Run full suite — no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/year-table.ts frontend/tests/component/year-table.test.ts
git commit -m "feat(ui): suppress zero cells in year-table cumulative rows when show_zero is false"
```

---

### Task 5: `show_zero` support in `year-table` — measurement entities

**Files:**
- Modify: `frontend/src/components/year-table.ts`
- Test: `frontend/tests/component/year-table.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this describe block at the end of `frontend/tests/component/year-table.test.ts`:

```ts
describe('YearTable — show_zero (measurement)', () => {
  async function renderYearMeasurement(showZero: boolean | undefined, min: number, mean: number, max: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = showZero === undefined
      ? [{ entity: ENTITY_ID }]
      : [{ entity: ENTITY_ID, show_zero: showZero }];
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement',
      entityId: ENTITY_ID,
      date: '2025-01-05',
      min,
      mean,
      max,
      partialCoverage: false,
    };
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-05`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + all-zero day → cells render "0"', async () => {
    const el = await renderYearMeasurement(undefined, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('0');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + all-zero day → all three sub-row cells blank', async () => {
    const el = await renderYearMeasurement(false, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('');
    expect(meanCell?.classList.contains('has-data')).toBe(false);
    expect(maxCell?.textContent?.trim()).toBe('');
    expect(maxCell?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + only min=0 → only min cell blank', async () => {
    const el = await renderYearMeasurement(false, 0, 5, 10);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('5');
    expect(meanCell?.classList.contains('has-data')).toBe(true);
    expect(maxCell?.textContent?.trim()).toBe('10');
    expect(maxCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + nonzero values → renders normally', async () => {
    const el = await renderYearMeasurement(false, 2, 5, 8);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('2');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (measurement)"
```

Expected: year-table `show_zero: false` tests FAIL.

- [ ] **Step 3: Implement in year-table.ts**

In `frontend/src/components/year-table.ts`, locate the measurement path inside `renderEntityRows` (around line 187). Replace:

```ts
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          minCells.push(html`<td class="data-cell has-data">${nf.format(val.min * f)}${pc}</td>`);
          meanCells.push(html`<td class="data-cell has-data">${nf.format(val.mean * f)}</td>`);
          maxCells.push(html`<td class="data-cell has-data">${nf.format(val.max * f)}</td>`);
        } else {
```

With:

```ts
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;
          minCells.push(minV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(minV)}${pc}</td>`);
          meanCells.push(meanV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(meanV)}</td>`);
          maxCells.push(maxV === 0 && !showZero ? html`<td class="data-cell"></td>` : html`<td class="data-cell has-data">${nf.format(maxV)}</td>`);
        } else {
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "show_zero (measurement)"
```

Expected: all year-table measurement `show_zero` tests PASS.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/year-table.ts frontend/tests/component/year-table.test.ts
git commit -m "feat(ui): suppress zero cells in year-table measurement rows when show_zero is false"
```
