import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityMetadata } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** Resolves after the browser would have run its animation-frame callbacks. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** The prototype that actually owns `addEventListener` in this DOM implementation. */
function eventTargetPrototype(): object {
  let proto: object | null = Object.getPrototypeOf(document.createElement('div')) as object | null;
  while (proto && !Object.getOwnPropertyDescriptor(proto, 'addEventListener')) {
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  if (!proto) throw new Error('addEventListener owner not found');
  return proto;
}

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
    await nextFrame();
    expect(container.scrollLeft).toBe(40);
    container.scrollLeft = 15;
    container.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(sticky.scrollLeft).toBe(15);
  });

  it('registers both scroll listeners as passive so they cannot block scrolling', async () => {
    const options: unknown[] = [];
    const proto = eventTargetPrototype() as { addEventListener: EventTarget['addEventListener'] };
    const original = proto.addEventListener;
    vi.spyOn(proto, 'addEventListener').mockImplementation(
      function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
        if (type === 'scroll') options.push(opts);
        return original.call(this, type, listener, opts as AddEventListenerOptions);
      },
    );
    await renderTable();

    expect(options.length).toBe(2);
    expect(options.every((o) => typeof o === 'object' && o !== null && (o as AddEventListenerOptions).passive === true)).toBe(true);
  });

  it('does not query the shadow root while scrolling', async () => {
    const el = await renderTable();
    // Let the pending layout-measurement frame run; it is the only other reader.
    await nextFrame();
    const container = el.shadowRoot!.querySelector<HTMLElement>('.table-container')!;
    const spy = vi.spyOn(el.shadowRoot!, 'querySelector');

    for (let i = 0; i < 5; i++) container.dispatchEvent(new Event('scroll'));
    await nextFrame();

    expect(spy).not.toHaveBeenCalled();
  });

  it('coalesces a burst of scroll events into a single frame', async () => {
    const el = await renderTable();
    const container = el.shadowRoot!.querySelector<HTMLElement>('.table-container')!;
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');

    for (let i = 0; i < 5; i++) container.dispatchEvent(new Event('scroll'));

    expect(raf).toHaveBeenCalledTimes(1);
  });
});
