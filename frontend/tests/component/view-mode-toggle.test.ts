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

async function open(el: ViewModeToggle): Promise<void> {
  (el.shadowRoot!.querySelector('button.mode-toggle') as HTMLButtonElement).click();
  await el.updateComplete;
}

describe('ViewModeToggle — dropdown (T017, FR-011)', () => {
  it('trigger button shows the active mode label (en)', async () => {
    const el = await renderToggle('monthly');
    const trigger = el.shadowRoot!.querySelector('button.mode-toggle');
    expect(trigger?.textContent).toContain('Monthly');
  });

  it('click opens a dropdown with both mode options, active one marked', async () => {
    const el = await renderToggle('yearly');
    await open(el);
    const options = el.shadowRoot!.querySelectorAll('button.mode-option');
    expect(options.length).toBe(2);
    expect(options[0]!.textContent).toContain('Monthly');
    expect(options[1]!.textContent).toContain('Yearly');
    expect(options[1]!.classList.contains('active')).toBe(true);
  });

  it('selecting the other mode emits view-mode-select and closes', async () => {
    const el = await renderToggle('monthly');
    await open(el);
    const spy = vi.fn();
    el.addEventListener('calendar-stats-view-mode-select', (e) => spy((e as CustomEvent).detail));
    (el.shadowRoot!.querySelectorAll('button.mode-option')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith({ mode: 'yearly' });
    expect(el.shadowRoot!.querySelector('.mode-popover')).toBeNull();
  });

  it('selecting the active mode closes without emitting', async () => {
    const el = await renderToggle('monthly');
    await open(el);
    const spy = vi.fn();
    el.addEventListener('calendar-stats-view-mode-select', spy);
    (el.shadowRoot!.querySelectorAll('button.mode-option')[0] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(spy).not.toHaveBeenCalled();
    expect(el.shadowRoot!.querySelector('.mode-popover')).toBeNull();
  });

  it('click outside closes the dropdown', async () => {
    const el = await renderToggle('monthly');
    await open(el);
    expect(el.shadowRoot!.querySelector('.mode-popover')).toBeTruthy();
    document.body.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.mode-popover')).toBeNull();
  });

  it('de labels localized', async () => {
    const el = await renderToggle('monthly', 'de');
    expect(el.shadowRoot!.querySelector('button.mode-toggle')?.textContent).toContain('Monatlich');
    await open(el);
    const options = el.shadowRoot!.querySelectorAll('button.mode-option');
    expect(options[1]!.textContent).toContain('Jährlich');
  });
});
