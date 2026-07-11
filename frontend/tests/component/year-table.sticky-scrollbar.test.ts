import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityMetadata } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
});

const rainMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

async function renderTable(): Promise<YearTable> {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [6];
  el.entityConfigs = [{ entity: 'sensor.rain' }];
  el.entityMetadata = new Map([['sensor.rain', rainMeta]]);
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearTable — sticky horizontal scrollbar (user revision 3)', () => {
  it('renders a viewport-sticky scrollbar element below the table container', async () => {
    const el = await renderTable();
    const sticky = el.shadowRoot!.querySelector('.sticky-scrollbar');
    expect(sticky).toBeTruthy();
    expect(sticky!.querySelector('.sticky-scrollbar-spacer')).toBeTruthy();
  });

  it('mirrors scroll positions between the table container and the sticky scrollbar', async () => {
    const el = await renderTable();
    const container = el.shadowRoot!.querySelector<HTMLElement>('.table-container')!;
    const sticky = el.shadowRoot!.querySelector<HTMLElement>('.sticky-scrollbar')!;
    sticky.scrollLeft = 40;
    sticky.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(container.scrollLeft).toBe(40);
    container.scrollLeft = 15;
    container.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(sticky.scrollLeft).toBe(15);
  });
});
