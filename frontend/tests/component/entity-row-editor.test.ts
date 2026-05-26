import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { EntityRowConfig } from '../../src/types/card-config';
import '../../src/components/entity-row-editor';

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

async function createEntityRowEditor(
  config: EntityRowConfig,
  index = 0,
  hass: HomeAssistant = makeHass(),
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-entity-row-editor') as HTMLElement & {
    config: EntityRowConfig;
    index: number;
    hass: HomeAssistant;
    lang: string;
  };
  el.config = config;
  el.index = index;
  el.hass = hass;
  el.lang = 'en';
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

// T007: US1 — basic entity row editor
describe('EntityRowEditor — basic rendering (T007)', () => {
  it('is registered as calendar-stats-entity-row-editor', () => {
    const el = document.createElement('calendar-stats-entity-row-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-entity-row-editor');
  });

  it('renders ha-entity-picker or entity input with entity ID', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const picker = el.shadowRoot!.querySelector('ha-entity-picker, [data-field="entity"]');
    expect(picker).toBeTruthy();
  });

  it('name field is always visible', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', name: 'My Sensor' });
    const nameField = el.shadowRoot!.querySelector('[data-field="name"]');
    expect(nameField).toBeTruthy();
  });

  it('precision field is always visible', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', precision: 2 });
    const precField = el.shadowRoot!.querySelector('[data-field="precision"]');
    expect(precField).toBeTruthy();
  });

  it('dispatches row-changed with correct index and config on name change', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 3);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFieldChange(field: string, value: unknown): void };
    internal._handleFieldChange('name', 'New Name');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.index).toBe(3);
    expect(dispatched[0]!.detail.config.name).toBe('New Name');
    expect(dispatched[0]!.detail.config.entity).toBe('sensor.temp');
  });

  it('dispatches row-changed with correct config on entity change', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.old' }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFieldChange(field: string, value: unknown): void };
    internal._handleFieldChange('entity', 'sensor.new');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.entity).toBe('sensor.new');
  });
});

// T014: US3 — Advanced section
describe('EntityRowEditor — Advanced section (T014)', () => {
  it('renders ha-expansion-panel for Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel, [data-section="advanced"]');
    expect(panel).toBeTruthy();
  });

  it('factor field is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', factor: 2 });
    const field = el.shadowRoot!.querySelector('[data-field="factor"]');
    expect(field).toBeTruthy();
  });

  it('unit field is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', unit: 'kW' });
    const field = el.shadowRoot!.querySelector('[data-field="unit"]');
    expect(field).toBeTruthy();
  });

  it('show_zero checkbox is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', show_zero: true });
    const field = el.shadowRoot!.querySelector('[data-field="show_zero"]');
    expect(field).toBeTruthy();
  });

  it('show_min checkbox is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', show_min: false });
    const field = el.shadowRoot!.querySelector('[data-field="show_min"]');
    expect(field).toBeTruthy();
  });

  it('show_avg checkbox is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = el.shadowRoot!.querySelector('[data-field="show_avg"]');
    expect(field).toBeTruthy();
  });

  it('show_max checkbox is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = el.shadowRoot!.querySelector('[data-field="show_max"]');
    expect(field).toBeTruthy();
  });

  it('text_color field is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = el.shadowRoot!.querySelector('[data-field="text_color"]');
    expect(field).toBeTruthy();
  });

  it('background_color field is in Advanced section', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = el.shadowRoot!.querySelector('[data-field="background_color"]');
    expect(field).toBeTruthy();
  });

  it('factor change dispatches row-changed with updated EntityRowConfig', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFieldChange(field: string, value: unknown): void };
    internal._handleFieldChange('factor', 2.5);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.factor).toBe(2.5);
  });

  it('show_min toggle dispatches row-changed', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', show_min: true }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFieldChange(field: string, value: unknown): void };
    internal._handleFieldChange('show_min', false);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.show_min).toBe(false);
  });
});

// T021: US5 — Thresholds nested collapsible in EntityRowEditor
describe('EntityRowEditor — Thresholds sub-section (T021)', () => {
  it('renders calendar-stats-threshold-list-editor inside Advanced', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', thresholds: [] });
    const thresholdEditor = el.shadowRoot!.querySelector('calendar-stats-threshold-list-editor');
    expect(thresholdEditor).toBeTruthy();
  });

  it('thresholds-changed event updates config and dispatches row-changed', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', thresholds: [] }, 1);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    el.dispatchEvent(new CustomEvent('thresholds-changed', {
      detail: { thresholds: [{ operator: 'above', value: 30 }] },
      bubbles: true,
    }));
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.thresholds).toHaveLength(1);
    expect(dispatched[0]!.detail.config.thresholds[0].value).toBe(30);
  });
});

// T025: US6 — Predecessors sub-section in EntityRowEditor
describe('EntityRowEditor — Predecessors sub-section (T025)', () => {
  it('renders calendar-stats-predecessor-list-editor inside Advanced', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', predecessors: [] });
    const predEditor = el.shadowRoot!.querySelector('calendar-stats-predecessor-list-editor');
    expect(predEditor).toBeTruthy();
  });

  it('predecessors-changed event updates config and dispatches row-changed', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', predecessors: [] }, 2);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    el.dispatchEvent(new CustomEvent('predecessors-changed', {
      detail: { predecessors: [{ entity: 'sensor.old', replaced_on: '2025-01-01' }] },
      bubbles: true,
    }));
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.predecessors).toHaveLength(1);
    expect(dispatched[0]!.detail.config.predecessors[0].entity).toBe('sensor.old');
  });
});

// T007: stale entity indicator (FR-013)
describe('EntityRowEditor — stale entity indicator (T007/FR-013)', () => {
  it('shows stale-entity indicator when entity not in hass.states', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.missing' }, 0, makeHass({}));
    const indicator = el.shadowRoot!.querySelector('[data-stale], .stale-entity, .entity-not-found');
    expect(indicator).toBeTruthy();
  });

  it('no stale indicator when entity exists in hass.states', async () => {
    const hass = makeHass({
      'sensor.temp': { entity_id: 'sensor.temp', state: '20', attributes: {} },
    });
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0, hass);
    const indicator = el.shadowRoot!.querySelector('[data-stale], .stale-entity, .entity-not-found');
    expect(indicator).toBeNull();
  });
});
