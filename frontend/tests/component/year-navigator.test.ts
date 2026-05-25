import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearNavigator } from '../../src/components/year-navigator';

afterEach(() => {
  document.body.innerHTML = '';
});

async function renderNavigator(props: {
  year: number;
  atCurrentYear?: boolean;
  atEarliestYear?: boolean;
}): Promise<YearNavigator> {
  const el = new YearNavigator();
  el.year = props.year;
  if (props.atCurrentYear !== undefined) el.atCurrentYear = props.atCurrentYear;
  if (props.atEarliestYear !== undefined) el.atEarliestYear = props.atEarliestYear;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearNavigator — structure (T029)', () => {
  it('renders the year number', async () => {
    const el = await renderNavigator({ year: 2024 });
    expect(el.shadowRoot!.textContent).toContain('2024');
  });

  it('renders left arrow ‹', async () => {
    const el = await renderNavigator({ year: 2024 });
    expect(el.shadowRoot!.textContent).toContain('‹');
  });

  it('renders right arrow ›', async () => {
    const el = await renderNavigator({ year: 2024 });
    expect(el.shadowRoot!.textContent).toContain('›');
  });

  it('left arrow click dispatches calendar-stats-prev-year event', async () => {
    const el = await renderNavigator({ year: 2024 });
    const spy = vi.fn();
    el.addEventListener('calendar-stats-prev-year', spy);
    const prevBtn = el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement;
    expect(prevBtn).toBeTruthy();
    prevBtn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('right arrow click dispatches calendar-stats-next-year event', async () => {
    const el = await renderNavigator({ year: 2024 });
    const spy = vi.fn();
    el.addEventListener('calendar-stats-next-year', spy);
    const nextBtn = el.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    nextBtn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('atEarliestYear: true → left button disabled', async () => {
    const el = await renderNavigator({ year: 2024, atEarliestYear: true });
    const prevBtn = el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('atCurrentYear: true → right button disabled', async () => {
    const el = await renderNavigator({ year: 2024, atCurrentYear: true });
    const nextBtn = el.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('mid-range year → neither button disabled', async () => {
    const el = await renderNavigator({ year: 2023, atCurrentYear: false, atEarliestYear: false });
    const prevBtn = el.shadowRoot!.querySelector('button.prev') as HTMLButtonElement;
    const nextBtn = el.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
  });
});
