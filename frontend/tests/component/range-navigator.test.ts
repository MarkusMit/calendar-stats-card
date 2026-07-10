import { describe, it, expect, vi, afterEach } from 'vitest';
import { RangeNavigator } from '../../src/components/range-navigator';
import type { DateRange, MonthAnchor } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
});

const now: MonthAnchor = { year: 2026, month: 7 };

async function renderNav(props: {
  range: DateRange;
  atStart?: boolean;
  atEnd?: boolean;
  earliest?: MonthAnchor | null;
}): Promise<RangeNavigator> {
  const el = new RangeNavigator();
  el.range = props.range;
  el.now = now;
  el.earliest = props.earliest ?? { year: 2024, month: 1 };
  if (props.atStart !== undefined) el.atStart = props.atStart;
  if (props.atEnd !== undefined) el.atEnd = props.atEnd;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

const thisYear: DateRange = { start: { year: 2026, month: 1 }, end: { year: 2026, month: 7 }, preset: 'this_year' };

async function labelText(range: DateRange): Promise<string> {
  const el = await renderNav({ range });
  return el.shadowRoot!.querySelector('.range-label')!.textContent!.trim();
}

describe('RangeNavigator — label reflects displayed span', () => {
  it('this_year → bare year', async () => {
    expect(await labelText(thisYear)).toBe('2026');
  });

  it('this_quarter → YYYY-Qn', async () => {
    const q3: DateRange = { start: { year: 2026, month: 7 }, end: { year: 2026, month: 9 }, preset: 'this_quarter' };
    expect(await labelText(q3)).toBe('2026-Q3');
    const q1: DateRange = { start: { year: 2026, month: 1 }, end: { year: 2026, month: 3 }, preset: 'this_quarter' };
    expect(await labelText(q1)).toBe('2026-Q1');
  });

  it('this_month → YYYY-MM zero-padded', async () => {
    const m: DateRange = { start: { year: 2026, month: 3 }, end: { year: 2026, month: 3 }, preset: 'this_month' };
    expect(await labelText(m)).toBe('2026-03');
  });

  it('same-year custom span → compact YYYY-MM–MM', async () => {
    const custom: DateRange = { start: { year: 2026, month: 2 }, end: { year: 2026, month: 5 }, preset: 'custom' };
    expect(await labelText(custom)).toBe('2026-02–05');
  });

  it('cross-year rolling span → YYYY-MM–YYYY-MM', async () => {
    const rolling: DateRange = { start: { year: 2025, month: 8 }, end: { year: 2026, month: 7 }, preset: 'last_12_months' };
    expect(await labelText(rolling)).toBe('2025-08–2026-07');
  });

  it('single-month custom span → YYYY-MM', async () => {
    const one: DateRange = { start: { year: 2026, month: 4 }, end: { year: 2026, month: 4 }, preset: 'custom' };
    expect(await labelText(one)).toBe('2026-04');
  });
});

describe('RangeNavigator — arrows', () => {
  it('prev click dispatches calendar-stats-prev-range', async () => {
    const el = await renderNav({ range: thisYear });
    const spy = vi.fn();
    el.addEventListener('calendar-stats-prev-range', spy);
    (el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('next click dispatches calendar-stats-next-range', async () => {
    const el = await renderNav({ range: thisYear });
    const spy = vi.fn();
    el.addEventListener('calendar-stats-next-range', spy);
    (el.shadowRoot!.querySelector('button.next') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('atStart disables prev', async () => {
    const el = await renderNav({ range: thisYear, atStart: true });
    expect((el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement).disabled).toBe(true);
  });

  it('atEnd disables next', async () => {
    const el = await renderNav({ range: thisYear, atEnd: true });
    expect((el.shadowRoot!.querySelector('button.next') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('RangeNavigator — popover', () => {
  it('label click opens the popover with 5 presets', async () => {
    const el = await renderNav({ range: thisYear });
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const presets = el.shadowRoot!.querySelectorAll('.preset');
    expect(presets.length).toBe(5);
  });

  it('preset click dispatches range-select with the preset', async () => {
    const el = await renderNav({ range: thisYear });
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('calendar-stats-range-select', (e) => spy((e as CustomEvent).detail));
    const monthPreset = Array.from(el.shadowRoot!.querySelectorAll('.preset')).find(
      (b) => b.textContent!.includes('This month'),
    ) as HTMLButtonElement;
    monthPreset.click();
    expect(spy).toHaveBeenCalledWith({ preset: 'this_month' });
  });

  it('custom Apply dispatches range-select with start/end', async () => {
    const el = await renderNav({ range: thisYear });
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('calendar-stats-range-select', (e) => spy((e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
    const detail = spy.mock.calls[0]![0];
    expect(detail).toHaveProperty('start');
    expect(detail).toHaveProperty('end');
  });

  it('Apply disabled when From is after To', async () => {
    const custom: DateRange = { start: { year: 2026, month: 6 }, end: { year: 2026, month: 3 }, preset: 'custom' };
    const el = await renderNav({ range: custom });
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('click outside closes the popover', async () => {
    const el = await renderNav({ range: thisYear });
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.popover')).toBeTruthy();
    document.body.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.popover')).toBeNull();
  });
});
