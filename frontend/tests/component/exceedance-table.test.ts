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
    { rule: WET, band: 5, cumulative: 8, byYear: [{ year: 2025, band: 5, cumulative: 8 }] },
    { rule: HEAVY, band: 3, cumulative: 3, byYear: [{ year: 2025, band: 3, cumulative: 3 }] },
  ],
};

describe('ExceedanceTable — structure', () => {
  it('renders nothing when there are no groups', async () => {
    const el = await renderTable([]);
    expect(el.shadowRoot!.querySelector('table')).toBeNull();
  });

  it('renders one group header per group, carrying its label', async () => {
    const el = await renderTable([RAIN_GROUP, { label: 'Temperature [°C]', rows: [{ rule: WET, band: 1, cumulative: 1, byYear: [] }] }]);
    const headers = el.shadowRoot!.querySelectorAll('.group-label');
    expect(headers).toHaveLength(2);
    expect(headers[0]!.textContent).toContain('Rain [mm]');
    expect(headers[1]!.textContent).toContain('Temperature [°C]');
  });

  it('renders one row per rule, in the order given', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const names = [...el.shadowRoot!.querySelectorAll('.rule-name')].map((n) => n.textContent!.trim());
    expect(names).toEqual(['Wet day (≥ 10)', 'Heavy day (≥ 30)']);
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

describe('ExceedanceTable — band column', () => {
  it('shows the band count for each rule', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const bands = [...el.shadowRoot!.querySelectorAll('.band-cell')].map((c) => c.textContent!.trim());
    expect(bands).toEqual(['5', '3']);
  });

  it('renders band before total in each row', async () => {
    const el = await renderTable([RAIN_GROUP]);
    const cells = [...el.shadowRoot!.querySelectorAll('tbody tr')[1]!.querySelectorAll('td')];
    expect(cells.map((c) => c.className.split(' ').pop())).toEqual(['rule-name', 'band-cell', 'total-cell']);
    expect(cells[1]!.textContent!.trim()).toBe('5');
    expect(cells[2]!.textContent!.trim()).toBe('8');
  });

  it('labels the band column in German', async () => {
    const el = await renderTable([RAIN_GROUP], 'de');
    expect(el.shadowRoot!.textContent).toContain('Bereich');
  });
});

// --- Per-year columns (yearly view) ---

const MULTI_YEAR_GROUP: ExceedanceGroup = {
  label: 'Rain [mm]',
  rows: [
    {
      rule: WET,
      band: 5,
      cumulative: 8,
      byYear: [
        { year: 2024, band: 2, cumulative: 3 },
        { year: 2025, band: 3, cumulative: 5 },
      ],
    },
    {
      rule: HEAVY,
      band: 3,
      cumulative: 3,
      byYear: [
        { year: 2024, band: 1, cumulative: 1 },
        { year: 2025, band: 2, cumulative: 2 },
      ],
    },
  ],
};

async function renderYears(years: number[], groups = [MULTI_YEAR_GROUP], lang = 'en'): Promise<ExceedanceTable> {
  const el = new ExceedanceTable();
  el.groups = groups;
  el.years = years;
  el.lang = lang;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no shadowRoot');
  }, { timeout: 3000 });
  return el;
}

describe('ExceedanceTable — per-year columns', () => {
  it('renders a header group per year plus an overall group', () => {
    // header groups are asserted in the next test; this one guards the count
    expect(MULTI_YEAR_GROUP.rows[0]!.byYear).toHaveLength(2);
  });

  it('names each year and the overall group in the top header row', async () => {
    const el = await renderYears([2024, 2025]);
    const groups = [...el.shadowRoot!.querySelectorAll('.year-group')].map((h) => h.textContent!.trim());
    expect(groups).toEqual(['2024', '2025', 'All years']);
  });

  it('emits two count cells per year plus two overall', async () => {
    const el = await renderYears([2024, 2025]);
    const firstRule = el.shadowRoot!.querySelectorAll('tbody tr')[1]!;
    expect(firstRule.querySelectorAll('.count-cell')).toHaveLength(6);
  });

  it('places each year counts before the overall counts', async () => {
    const el = await renderYears([2024, 2025]);
    const firstRule = el.shadowRoot!.querySelectorAll('tbody tr')[1]!;
    const values = [...firstRule.querySelectorAll('.count-cell')].map((c) => c.textContent!.trim());
    expect(values).toEqual(['2', '3', '3', '5', '5', '8']);
  });

  it('falls back to the two-column layout for a single year', async () => {
    const el = await renderYears([2025]);
    expect(el.shadowRoot!.querySelectorAll('.year-group')).toHaveLength(0);
    const firstRule = el.shadowRoot!.querySelectorAll('tbody tr')[1]!;
    expect(firstRule.querySelectorAll('.count-cell')).toHaveLength(2);
  });

  it('falls back to the two-column layout when no years are given', async () => {
    const el = await renderYears([]);
    expect(el.shadowRoot!.querySelectorAll('.year-group')).toHaveLength(0);
  });

  it('translates the overall group header', async () => {
    const el = await renderYears([2024, 2025], [MULTI_YEAR_GROUP], 'de');
    const groups = [...el.shadowRoot!.querySelectorAll('.year-group')].map((h) => h.textContent!.trim());
    expect(groups).toEqual(['2024', '2025', 'Alle Jahre']);
  });

  it('spans the group label across every column', async () => {
    const el = await renderYears([2024, 2025]);
    const label = el.shadowRoot!.querySelector('.group-label')!;
    expect(label.getAttribute('colspan')).toBe('7');
  });
});

describe('ExceedanceTable — visual weighting', () => {
  it('marks the all-years pair so it can be emphasised', async () => {
    const el = await renderYears([2024, 2025]);
    const firstRule = el.shadowRoot!.querySelectorAll('tbody tr')[1]!;
    const emphasised = [...firstRule.querySelectorAll('.all-years')].map((c) => c.textContent!.trim());
    expect(emphasised).toEqual(['5', '8']);
  });

  it('does not mark an all-years pair when there are no year columns', async () => {
    const el = await renderYears([]);
    expect(el.shadowRoot!.querySelectorAll('.all-years')).toHaveLength(0);
  });

  it('marks the all-years header group too', async () => {
    const el = await renderYears([2024, 2025]);
    const header = el.shadowRoot!.querySelector('.year-group.all-years');
    expect(header?.textContent!.trim()).toBe('All years');
  });
});

describe('ExceedanceTable — threshold definition in the row label', () => {
  function ruleRow(rule: ThresholdRule): ExceedanceGroup {
    return { label: 'Rain [mm]', rows: [{ rule, band: 1, cumulative: 1, byYear: [] }] };
  }

  async function labelFor(rule: ThresholdRule, lang = 'en'): Promise<string> {
    const el = await renderTable([ruleRow(rule)], lang);
    return el.shadowRoot!.querySelector('.rule-name')!.textContent!.replace(/\s+/g, ' ').trim();
  }

  it('appends the operator symbol and the day value', async () => {
    expect(await labelFor({ operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' }))
      .toBe('Summer day (≥ 25)');
  });

  it('uses the matching symbol for each operator', async () => {
    const base = { value: 10, name: 'R', background_color: 'blue' } as const;
    expect(await labelFor({ ...base, operator: 'above' })).toContain('(> 10)');
    expect(await labelFor({ ...base, operator: 'below' })).toContain('(< 10)');
    expect(await labelFor({ ...base, operator: 'equals-below' })).toContain('(≤ 10)');
    // not-below/not-above only target the min resp. max cell, so their symbol
    // carries the ↓/↑ marker and stays distinct from equals-above/equals-below.
    expect(await labelFor({ ...base, operator: 'not-below' })).toContain('(↓≥ 10)');
    expect(await labelFor({ ...base, operator: 'not-above' })).toContain('(↑≤ 10)');
  });

  it('keeps a negative or fractional value readable', async () => {
    expect(await labelFor({ operator: 'below', value: -2.5, name: 'Frost', background_color: 'cyan' }))
      .toBe('Frost (< -2.5)');
  });
});
