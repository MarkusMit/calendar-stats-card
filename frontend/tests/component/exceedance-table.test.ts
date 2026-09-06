import { describe, it, expect, afterEach, vi } from 'vitest';
import { ExceedanceTable } from '../../src/components/exceedance-table';
import type { ExceedanceGroup } from '../../src/services/threshold-exceedance';
import type { ThresholdRule } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
});

const WET: ThresholdRule = { operator: 'equals-above', value: 10, name: 'Wet day', background_color: 'blue' };
const HEAVY: ThresholdRule = { operator: 'equals-above', value: 30, name: 'Heavy day', text_color: 'red' };

async function renderTable(groups: ExceedanceGroup[], lang = 'en'): Promise<ExceedanceTable> {
  const el = new ExceedanceTable();
  el.groups = groups;
  el.lang = lang;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no shadowRoot');
  }, { timeout: 3000 });
  return el;
}

const RAIN_GROUP: ExceedanceGroup = {
  label: 'Rain [mm]',
  rows: [
    { rule: WET, band: 5, cumulative: 8 },
    { rule: HEAVY, band: 3, cumulative: 3 },
  ],
};

describe('ExceedanceTable — structure', () => {
  it('renders nothing when there are no groups', async () => {
    const el = await renderTable([]);
    expect(el.shadowRoot!.querySelector('table')).toBeNull();
  });

  it('renders one group header per group, carrying its label', async () => {
    const el = await renderTable([RAIN_GROUP, { label: 'Temperature [°C]', rows: [{ rule: WET, band: 1, cumulative: 1 }] }]);
    const headers = el.shadowRoot!.querySelectorAll('.group-label');
    expect(headers).toHaveLength(2);
    expect(headers[0]!.textContent).toContain('Rain [mm]');
    expect(headers[1]!.textContent).toContain('Temperature [°C]');
  });

  it('renders one row per rule, in the order given', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const names = [...el.shadowRoot!.querySelectorAll('.rule-name')].map((n) => n.textContent!.trim());
    expect(names).toEqual(['Wet day', 'Heavy day']);
  });

  it('shows the cumulative count for each rule', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const totals = [...el.shadowRoot!.querySelectorAll('.total-cell')].map((c) => c.textContent!.trim());
    expect(totals).toEqual(['8', '3']);
  });
});

describe('ExceedanceTable — rule colors', () => {
  it('applies a rule background to its name cell', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const cell = el.shadowRoot!.querySelectorAll('.rule-name')[0] as HTMLElement;
    expect(cell.style.backgroundColor).toBeTruthy();
  });

  it('applies a text-only rule color to its name cell', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const cell = el.shadowRoot!.querySelectorAll('.rule-name')[1] as HTMLElement;
    expect(cell.style.color).toBe('red');
    expect(cell.style.backgroundColor).toBe('');
  });
});

describe('ExceedanceTable — i18n', () => {
  it('uses the English column headers by default', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain('Total');
  });

  it('uses German headers when lang is de', async () => {
    const el = await renderTable([RAIN_GROUP], 'de');
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain('Gesamt');
    expect(text).not.toContain('Total');
  });
});
