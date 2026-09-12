import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PredecessorConfig } from '../../src/types/card-config';
import type { HomeAssistant } from '../../src/types/ha-types';
import '../../src/components/predecessor-list-editor';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(states: Record<string, unknown> = {}): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: states as HomeAssistant['states'],
    connection: { sendMessagePromise: vi.fn() },
    language: 'en',
  };
}

async function createPredecessorListEditor(
  predecessors: PredecessorConfig[] = [],
  hass: HomeAssistant = makeHass(),
  lang = 'en',
  knownStatisticIds: Set<string> | null = null,
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-predecessor-list-editor') as HTMLElement & {
    predecessors: PredecessorConfig[];
    hass: HomeAssistant;
    lang: string;
    knownStatisticIds: Set<string> | null;
  };
  el.predecessors = predecessors;
  el.hass = hass;
  el.lang = lang;
  el.knownStatisticIds = knownStatisticIds;
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

// T024: US6 — PredecessorListEditor
describe('PredecessorListEditor — (T024)', () => {
  it('is registered as calendar-stats-predecessor-list-editor', () => {
    const el = document.createElement('calendar-stats-predecessor-list-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-predecessor-list-editor');
  });

  it('renders "Add predecessor" as an ha-button', async () => {
    const el = await createPredecessorListEditor([]);
    const btn = el.shadowRoot!.querySelector('ha-button[data-action="add-predecessor"]');
    expect(btn).toBeTruthy();
    expect(btn!.textContent!.trim()).toBe('Add predecessor');
    expect(btn!.getAttribute('appearance')).toBe('plain');
  });

  it('renders no section title and no chip button (the parent panel carries the heading)', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.a' }]);
    expect(el.shadowRoot!.querySelector('.section-title, .add-chip, button')).toBeNull();
  });

  it('add predecessor dispatches predecessors-changed with one entry appended', async () => {
    const el = await createPredecessorListEditor([]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _addPredecessor(): void };
    internal._addPredecessor();
    expect(dispatched).toHaveLength(1);
    const predecessors = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(predecessors).toHaveLength(1);
    expect(predecessors[0]!.entity).toBe('');
  });

  it('remove predecessor dispatches predecessors-changed with entry removed', async () => {
    const preds: PredecessorConfig[] = [
      { entity: 'sensor.a' },
      { entity: 'sensor.b' },
    ];
    const el = await createPredecessorListEditor(preds);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _removePredecessor(i: number): void };
    internal._removePredecessor(0);
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(result).toHaveLength(1);
    expect(result[0]!.entity).toBe('sensor.b');
  });

  it('renders one ha-form per entry with statistic, date and number selectors', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }, { entity: 'sensor.older' }]);
    const forms = el.shadowRoot!.querySelectorAll('ha-form');
    expect(forms).toHaveLength(2);
    const schema = (forms[0] as HTMLElement & { schema: { name: string; selector: unknown }[] }).schema;
    expect(schema.map((s) => s.name)).toEqual(['entity', 'replaced_on', 'factor']);
    expect(schema[0]!.selector).toEqual({ statistic: {} });
    expect(schema[1]!.selector).toEqual({ date: {} });
    expect(schema[2]!.selector).toMatchObject({ number: { mode: 'box' } });
  });

  it('binds the entry as ha-form data', async () => {
    const entry: PredecessorConfig = { entity: 'sensor.old', replaced_on: '2025-01-01', factor: 1.5 };
    const el = await createPredecessorListEditor([entry]);
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { data: unknown };
    expect(form.data).toEqual(entry);
  });

  it('labels the entity field as statistic ID', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }]);
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { computeLabel: (s: { name: string }) => string };
    expect(form.computeLabel({ name: 'entity' })).toBe('Statistic ID');
    expect(form.computeLabel({ name: 'replaced_on' })).toBe('Replaced on');
    expect(form.computeLabel({ name: 'factor' })).toBe('Factor (optional)');
  });

  it('form value-changed dispatches predecessors-changed with the merged entry', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }, { entity: 'sensor.b' }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelectorAll('ha-form')[0]!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { entity: 'wetter_xls:temperatur', replaced_on: '2025-01-01' } },
      bubbles: true,
      composed: true,
    }));
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(result).toEqual([
      { entity: 'wetter_xls:temperatur', replaced_on: '2025-01-01' },
      { entity: 'sensor.b' },
    ]);
  });

  it('drops cleared optional fields instead of writing undefined or empty strings', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old', replaced_on: '2025-01-01', factor: 2 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { entity: 'sensor.old', replaced_on: undefined, factor: '' } },
      bubbles: true,
      composed: true,
    }));
    const result = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(result[0]).toEqual({ entity: 'sensor.old' });
    expect('replaced_on' in result[0]!).toBe(false);
    expect('factor' in result[0]!).toBe(false);
  });

  it('clearing the statistic keeps the entry with an empty id', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { entity: undefined } },
      bubbles: true,
      composed: true,
    }));
    const result = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(result).toEqual([{ entity: '' }]);
  });

  it('wraps each entry in an outlined expansion panel headed by the statistic id', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old', replaced_on: '2025-01-01' }]);
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel') as HTMLElement & { header: string; secondary: string };
    expect(panel).toBeTruthy();
    expect(panel.hasAttribute('outlined')).toBe(true);
    expect(panel.header).toBe('sensor.old');
    expect(panel.secondary).toBe('2025-01-01');
  });

  it('heads the panel with the friendly name when hass knows the entity', async () => {
    const hass = makeHass({ 'sensor.old': { attributes: { friendly_name: 'Old sensor' } } });
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }], hass);
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel') as HTMLElement & { header: string };
    expect(panel.header).toBe('Old sensor');
  });

  it('heads a brand-new entry with the add label', async () => {
    const el = await createPredecessorListEditor([{ entity: '' }]);
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel') as HTMLElement & { header: string };
    expect(panel.header).toBe('Add predecessor');
  });

  it('remove button sits in the panel icons slot and removes that entry', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.a' }, { entity: 'sensor.b' }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const buttons = el.shadowRoot!.querySelectorAll('ha-expansion-panel > ha-icon-button[slot="icons"]');
    expect(buttons).toHaveLength(2);
    (buttons[1] as HTMLElement).click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.predecessors).toEqual([{ entity: 'sensor.a' }]);
  });

  it('renders no raw input or select elements', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old', replaced_on: '2025-01-01', factor: 2 }]);
    expect(el.shadowRoot!.querySelector('input, select')).toBeNull();
  });

  it('shows stale indicator when the predecessor id is not among the known statistic ids', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.missing' }], makeHass({}), 'en', new Set(['sensor.other']));
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeTruthy();
  });

  it('no stale indicator for an external id known to the recorder but absent from hass.states', async () => {
    const el = await createPredecessorListEditor([{ entity: 'tibber:old' }], makeHass({}), 'en', new Set(['tibber:old']));
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeNull();
  });

  it('no stale indicator while the known ids are not loaded (null)', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.missing' }], makeHass({}), 'en', null);
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeNull();
  });

  it('no stale indicator for empty entity string (brand-new entry)', async () => {
    const hass = makeHass({});
    const el = await createPredecessorListEditor([{ entity: '' }], hass, 'en', new Set());
    const indicator = el.shadowRoot!.querySelector('[data-stale], .stale-entity, .entity-not-found');
    expect(indicator).toBeNull();
  });
});
