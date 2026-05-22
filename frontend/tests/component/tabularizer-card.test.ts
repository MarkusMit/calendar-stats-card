import { describe, it, expect, vi, afterEach } from 'vitest';
import { TabularzerCard } from '../../src/tabularizer-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: {
      sendMessagePromise: vi.fn().mockResolvedValue([]),
    },
    language: 'en',
    ...overrides,
  };
}

const CONFIG: CardConfig = {
  type: 'custom:tabularizer-card',
  entities: [{ entity: 'sensor.temp' }],
};

async function createCard(config: CardConfig = CONFIG, hass?: HomeAssistant): Promise<TabularzerCard> {
  const el = new TabularzerCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig(config);
  if (hass) el.hass = hass;
  await el.updateComplete;
  return el;
}

describe('TabularzerCard — year/month logic', () => {
  it('defaults to current year on non-Jan-1 date', async () => {
    const el = await createCard(CONFIG, makeHass());
    const currentYear = new Date().getFullYear();
    expect(el.selectedYear).toBe(currentYear);
  });

  it('shows monthly tables from Jan through current month for current year', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(
      async () => {
        await el.updateComplete;
        const yearTable = el.shadowRoot!.querySelector('year-table');
        if (!yearTable?.shadowRoot) throw new Error('year-table shadow root not ready');
        await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
        const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
        const currentMonth = new Date().getMonth() + 1;
        expect(monthRows.length).toBeGreaterThanOrEqual(1);
        expect(monthRows.length).toBeLessThanOrEqual(currentMonth);
      },
      { timeout: 3000 },
    );
  });

  it('renders loading overlay while statistics are being fetched', async () => {
    const never = new Promise<unknown>(() => {});
    const el = await createCard(CONFIG, makeHass({
      connection: { sendMessagePromise: vi.fn().mockReturnValue(never) },
    }));
    const overlay = el.shadowRoot!.querySelector('loading-overlay') as HTMLElement & { visible?: boolean } | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.visible).toBe(true);
  });

  it('no year-table rendered during initial loading', async () => {
    const never = new Promise<unknown>(() => {});
    const el = await createCard(CONFIG, makeHass({
      connection: { sendMessagePromise: vi.fn().mockReturnValue(never) },
    }));
    const tables = el.shadowRoot!.querySelectorAll('year-table');
    expect(tables.length).toBe(0);
  });
});

// T036: localized display tests
describe('TabularzerCard — localized display (T036)', () => {
  async function getFirstTableRoot(card: TabularzerCard): Promise<ShadowRoot> {
    let root: ShadowRoot | null = null;
    await vi.waitFor(async () => {
      await card.updateComplete;
      const table = card.shadowRoot!.querySelector('year-table');
      if (!table) throw new Error('no year-table');
      if (!table.shadowRoot) throw new Error('year-table shadow root not ready');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      root = table.shadowRoot;
    }, { timeout: 3000 });
    return root!;
  }

  it('hass.selectedLanguage=de → summary column header is German', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    const tableRoot = await getFirstTableRoot(el);
    const summaryHeader = tableRoot.querySelector('th.summary-column');
    expect(summaryHeader?.textContent).toContain('Zusammenfassung');
  });

  it('hass.language=en → summary column header is English', async () => {
    const el = await createCard(CONFIG, makeHass({ language: 'en' }));
    const tableRoot = await getFirstTableRoot(el);
    const summaryHeader = tableRoot.querySelector('th.summary-column');
    expect(summaryHeader?.textContent).toContain('Summary');
  });

  it('no-entities placeholder uses de text', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [] };
    const el = await createCard(config, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const ph = el.shadowRoot!.querySelector('.no-entities');
      if (!ph) throw new Error('placeholder not found');
      expect(ph.textContent).toContain('Keine');
    }, { timeout: 3000 });
  });

  it('year-navigator prev button has lang-aware aria-label', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('year-navigator');
      if (!nav || !nav.shadowRoot) throw new Error('navigator not ready');
      const prevBtn = nav.shadowRoot.querySelector('button.prev');
      expect(prevBtn?.getAttribute('aria-label')).toBe('Vorjahr');
    }, { timeout: 3000 });
  });

  it('year-navigator next button has lang-aware aria-label', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('year-navigator');
      if (!nav || !nav.shadowRoot) throw new Error('navigator not ready');
      const nextBtn = nav.shadowRoot.querySelector('button.next');
      expect(nextBtn?.getAttribute('aria-label')).toBe('Nächstes Jahr');
    }, { timeout: 3000 });
  });
});

// T033: name configuration tests
describe('TabularzerCard — name configuration (T033)', () => {
  async function getFirstTableRoot(card: TabularzerCard): Promise<ShadowRoot> {
    let root: ShadowRoot | null = null;
    await vi.waitFor(async () => {
      await card.updateComplete;
      const table = card.shadowRoot!.querySelector('year-table');
      if (!table) throw new Error('no year-table');
      if (!table.shadowRoot) throw new Error('year-table shadow root not ready');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      root = table.shadowRoot;
    }, { timeout: 3000 });
    return root!;
  }

  it('name override → label column shows override text', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [{ entity: 'sensor.temp', name: 'My Override' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Temperature', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('My Override');
    expect(labelCell?.textContent).not.toContain('Temperature');
  });

  it('no label override → falls back to HA friendly name', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [{ entity: 'sensor.temp' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Outdoor Temp', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('Outdoor Temp');
  });

  it('unit of measurement appended to label in label column', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [{ entity: 'sensor.temp' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Temperature', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('°C');
  });

  it('empty entities → no-entities placeholder shown, no year-table', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [] };
    const el = await createCard(config, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const placeholder = el.shadowRoot!.querySelector('.no-entities');
      if (!placeholder) throw new Error('placeholder not found');
    }, { timeout: 3000 });
    const tables = el.shadowRoot!.querySelectorAll('year-table');
    expect(tables.length).toBe(0);
  });

  it('duplicate entity IDs → both labels rendered in year-table', async () => {
    const config = { type: 'custom:tabularizer-card', entities: [
      { entity: 'sensor.temp', name: 'Row A' },
      { entity: 'sensor.temp', name: 'Row B' },
    ] };
    const el = await createCard(config, makeHass());
    const tableRoot = await getFirstTableRoot(el);
    const labelCells = tableRoot.querySelectorAll('td.label-column');
    const texts = Array.from(labelCells).map((c) => c.textContent ?? '');
    expect(texts.some((t) => t.includes('Row A'))).toBe(true);
    expect(texts.some((t) => t.includes('Row B'))).toBe(true);
  });
});

// T030: year navigation integration tests
describe('TabularzerCard — year navigation (T030)', () => {
  it('renders year-navigator component after fetch', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('year-navigator');
      expect(nav).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('right arrow disabled when at current year', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('year-navigator') as (HTMLElement & { atCurrentYear: boolean }) | null;
      expect(nav).toBeTruthy();
      expect(nav!.atCurrentYear).toBe(true);
    }, { timeout: 3000 });
  });

  it('prev-year event triggers re-fetch for new year', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = new Date(currentYear - 1, 0, 1).getTime();
    const sendMsg = vi.fn()
      .mockResolvedValueOnce([{ statistic_id: 'sensor.temp', start: earliestStart }])
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('year-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const callsBefore = sendMsg.mock.calls.length;
    const nav = el.shadowRoot!.querySelector('year-navigator')!;
    nav.dispatchEvent(new CustomEvent('tabularizer-prev-year', { bubbles: true }));
    await vi.waitFor(async () => {
      expect(sendMsg.mock.calls.length).toBeGreaterThan(callsBefore);
    }, { timeout: 3000 });
  });

  it('fully past year shows 12 month sections', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = new Date(currentYear - 1, 0, 1).getTime();
    const sendMsg = vi.fn()
      .mockResolvedValueOnce([{ statistic_id: 'sensor.temp', start: earliestStart }])
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('year-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('year-navigator')!;
    nav.dispatchEvent(new CustomEvent('tabularizer-prev-year', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const yearTable = el.shadowRoot!.querySelector('year-table');
      if (!yearTable?.shadowRoot) throw new Error('year-table not ready');
      await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
      expect(monthRows.length).toBe(12);
    }, { timeout: 3000 });
  });

  it('earliest year shows only months from earliestDataMonth onward', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = new Date(currentYear - 1, 5, 1).getTime(); // June (month index 5)
    const sendMsg = vi.fn()
      .mockResolvedValueOnce([{ statistic_id: 'sensor.temp', start: earliestStart }])
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('year-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('year-navigator')!;
    nav.dispatchEvent(new CustomEvent('tabularizer-prev-year', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const yearTable = el.shadowRoot!.querySelector('year-table');
      if (!yearTable?.shadowRoot) throw new Error('year-table not ready');
      await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
      // June=month 6, months 6–12 = 7 sections
      expect(monthRows.length).toBe(7);
    }, { timeout: 3000 });
  });

  it('left arrow disabled when at earliest year', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = new Date(currentYear - 1, 0, 1).getTime();
    const sendMsg = vi.fn()
      .mockResolvedValueOnce([{ statistic_id: 'sensor.temp', start: earliestStart }])
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('year-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('year-navigator')!;
    nav.dispatchEvent(new CustomEvent('tabularizer-prev-year', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav2 = el.shadowRoot!.querySelector('year-navigator') as (HTMLElement & { atEarliestYear: boolean }) | null;
      expect(nav2!.atEarliestYear).toBe(true);
    }, { timeout: 3000 });
  });
});
