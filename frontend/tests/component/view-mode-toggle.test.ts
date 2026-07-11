import { describe, it, expect, vi, afterEach } from 'vitest';
import { ViewModeToggle } from '../../src/components/view-mode-toggle';

afterEach(() => {
  document.body.innerHTML = '';
});

async function renderToggle(mode: 'monthly' | 'yearly', lang = 'en'): Promise<ViewModeToggle> {
  const el = new ViewModeToggle();
  el.mode = mode;
  el.lang = lang;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('ViewModeToggle (T017, FR-011)', () => {
  it('renders two labeled segments (en)', async () => {
    const el = await renderToggle('monthly');
    const segs = el.shadowRoot!.querySelectorAll('button.segment');
    expect(segs.length).toBe(2);
    expect(segs[0]!.textContent).toContain('Monthly');
    expect(segs[1]!.textContent).toContain('Yearly');
  });

  it('marks the active segment with aria-pressed', async () => {
    const el = await renderToggle('yearly');
    const segs = el.shadowRoot!.querySelectorAll('button.segment');
    expect(segs[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(segs[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the inactive segment emits view-mode-select with the other mode', async () => {
    const el = await renderToggle('monthly');
    const spy = vi.fn();
    el.addEventListener('calendar-stats-view-mode-select', (e) => spy((e as CustomEvent).detail));
    (el.shadowRoot!.querySelectorAll('button.segment')[1] as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith({ mode: 'yearly' });
  });

  it('clicking the active segment emits nothing', async () => {
    const el = await renderToggle('monthly');
    const spy = vi.fn();
    el.addEventListener('calendar-stats-view-mode-select', spy);
    (el.shadowRoot!.querySelectorAll('button.segment')[0] as HTMLButtonElement).click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('de labels localized', async () => {
    const el = await renderToggle('monthly', 'de');
    const segs = el.shadowRoot!.querySelectorAll('button.segment');
    expect(segs[0]!.textContent).toContain('Monatlich');
    expect(segs[1]!.textContent).toContain('Jährlich');
  });
});
