import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { EntityMetadata } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
});

const ENTITY_ID = 'sensor.temp';

const tempMeta: EntityMetadata = {
  entityId: ENTITY_ID,
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temperature',
  hasStatistics: true,
};

const precipMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

async function renderYearTable(overrides: Partial<{
  entityConfigs: EntityConfig[];
  entityMetadata: Map<string, EntityMetadata>;
  lang: string;
}> = {}) {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [1];
  el.entityConfigs = overrides.entityConfigs ?? [{ entity: ENTITY_ID }];
  el.dailyValues = new Map();
  el.monthlySummaries = new Map();
  el.entityMetadata = overrides.entityMetadata ?? new Map([[ENTITY_ID, tempMeta]]);
  el.entityErrors = new Set();
  el.lang = overrides.lang ?? 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearTable — measurement sub-label column', () => {
  it('measurement entity → 3 td.sub-label cells with min/avg/max text (EN)', async () => {
    const el = await renderYearTable();
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
  });

  it('measurement entity lang=de → avg row shows Ø', async () => {
    const el = await renderYearTable({ lang: 'de' });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels[1]?.textContent?.trim()).toBe('Ø');
  });

  it('cumulative-only entity → no td.sub-label cells', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', precipMeta]]),
    });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(0);
  });

  it('mixed measurement + cumulative → 3 labeled + 1 empty sub-label cells', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: ENTITY_ID }, { entity: 'sensor.rain' }],
      entityMetadata: new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]]),
    });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(4);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
    expect(subLabels[3]?.textContent?.trim()).toBe('');
  });

  it('measurement entity → th.sub-label present in header', async () => {
    const el = await renderYearTable();
    const subLabelHeaders = el.shadowRoot!.querySelectorAll('th.sub-label');
    expect(subLabelHeaders.length).toBe(1);
  });

  it('cumulative-only entity → no th.sub-label in header', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', precipMeta]]),
    });
    const subLabelHeaders = el.shadowRoot!.querySelectorAll('th.sub-label');
    expect(subLabelHeaders.length).toBe(0);
  });
});
