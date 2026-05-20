import { describe, it, expect, vi, afterEach } from 'vitest';
import { LoadingOverlay } from '../../src/components/loading-overlay';

// Use new ClassName() to get properly typed instance regardless of registry state
afterEach(() => {
  document.body.innerHTML = '';
});

async function createElement(visible: boolean): Promise<LoadingOverlay> {
  const el = new LoadingOverlay();
  el.visible = visible;
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

function getStaticCssText(): string {
  // Access the raw CSS from the component's static styles declaration
  const styles = LoadingOverlay.styles;
  if (!styles) return '';
  const toText = (s: unknown) => String(s); // CSSResult.toString() returns cssText
  return Array.isArray(styles) ? styles.map(toText).join('\n') : toText(styles);
}

describe('LoadingOverlay', () => {
  it('renders spinner element when visible=true', async () => {
    const el = await createElement(true);
    const spinner = el.shadowRoot!.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('is hidden when visible=false', async () => {
    const el = await createElement(false);
    const container = el.shadowRoot!.querySelector('.overlay') as HTMLElement | null;
    const isHidden =
      container == null ||
      container.hidden === true ||
      container.style.display === 'none';
    expect(isHidden).toBe(true);
  });

  it('uses --primary-text-color for spinner colour', () => {
    const cssText = getStaticCssText();
    expect(cssText).toContain('--primary-text-color');
  });
});
