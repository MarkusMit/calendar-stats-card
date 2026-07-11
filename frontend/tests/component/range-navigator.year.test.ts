import { describe, it, expect, vi, afterEach } from 'vitest';
import { RangeNavigator } from '../../src/components/range-navigator';
import type { DateRange, MonthAnchor } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
});

const now: MonthAnchor = { year: 2026, month: 7 };

async function renderYearNav(range: DateRange, overrides: Partial<{
  atStart: boolean;
  earliest: MonthAnchor | null;
}> = {}): Promise<RangeNavigator> {
  const el = new RangeNavigator();
  el.range = range;
  el.granularity = 'year';
  el.now = now;
  el.earliest = overrides.earliest ?? { year: 2024, month: 4 };
  if (overrides.atStart !== undefined) el.atStart = overrides.atStart;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

const thisYear: DateRange = { start: { year: 2026, month: 1 }, end: { year: 2026, month: 12 }, preset: 'this_year' };

describe('RangeNavigator — year granularity (T018, FR-016)', () => {
  it('single-year range label is YYYY', async () => {
    const el = await renderYearNav(thisYear);
    expect(el.shadowRoot!.querySelector('.range-label')!.textContent!.trim()).toBe('2026');
  });

  it('multi-year range label is YYYY–YYYY', async () => {
    const r: DateRange = { start: { year: 2024, month: 1 }, end: { year: 2026, month: 12 }, preset: 'last_3_years' };
    const el = await renderYearNav(r);
    expect(el.shadowRoot!.querySelector('.range-label')!.textContent!.trim()).toBe('2024–2026');
  });

  it('popover shows year presets and a year-only custom picker', async () => {
    const el = await renderYearNav(thisYear);
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const presets = [...el.shadowRoot!.querySelectorAll('.preset')].map((p) => p.textContent!.trim());
    expect(presets).toContain('This year');
    expect(presets).toContain('Last year');
    expect(presets).toContain('Last 3 years');
    expect(presets).toContain('Last 5 years');
    expect(presets).toContain('All');
    // year selects, no month selects
    expect(el.shadowRoot!.querySelector('select.from-year')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('select.from-month')).toBeNull();
  });

  it('year preset click emits range-select with the preset', async () => {
    const el = await renderYearNav(thisYear);
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('calendar-stats-range-select', (e) => spy((e as CustomEvent).detail));
    const lastYear = [...el.shadowRoot!.querySelectorAll('.preset')].find((b) => b.textContent!.includes('Last year')) as HTMLButtonElement;
    lastYear.click();
    expect(spy).toHaveBeenCalledWith({ preset: 'last_year' });
  });

  it('All preset click emits range-select with preset all', async () => {
    const el = await renderYearNav(thisYear);
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('calendar-stats-range-select', (e) => spy((e as CustomEvent).detail));
    const all = [...el.shadowRoot!.querySelectorAll('.preset')].find((b) => b.textContent!.trim() === 'All') as HTMLButtonElement;
    all.click();
    expect(spy).toHaveBeenCalledWith({ preset: 'all' });
  });

  it('custom year From/To Apply emits year-aligned anchors', async () => {
    const el = await renderYearNav(thisYear);
    (el.shadowRoot!.querySelector('.range-label') as HTMLButtonElement).click();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('calendar-stats-range-select', (e) => spy((e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
    const detail = spy.mock.calls[0]![0] as { start: MonthAnchor; end: MonthAnchor };
    expect(detail.start.month).toBe(1);
    expect(detail.end.month).toBe(12);
  });

  it('atStart disables prev (earliest-data floor)', async () => {
    const el = await renderYearNav(thisYear, { atStart: true });
    expect((el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement).disabled).toBe(true);
  });
});
