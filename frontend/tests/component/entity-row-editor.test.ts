import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { EntityRowConfig } from '../../src/types/card-config';
import type { StatisticMetaEntry } from '../../src/services/statistics-service';
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
  knownStatisticIds: Set<string> | null = null,
  statMeta: StatisticMetaEntry | undefined = undefined,
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-entity-row-editor') as HTMLElement & {
    config: EntityRowConfig;
    index: number;
    hass: HomeAssistant;
    lang: string;
    knownStatisticIds: Set<string> | null;
    statMeta: StatisticMetaEntry | undefined;
  };
  el.statMeta = statMeta;
  el.config = config;
  el.index = index;
  el.hass = hass;
  el.lang = 'en';
  el.knownStatisticIds = knownStatisticIds;
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

function schemaHasField(el: HTMLElement, fieldName: string): boolean {
  const forms = el.shadowRoot!.querySelectorAll('ha-form');
  for (const form of Array.from(forms)) {
    const schema = (form as HTMLElement & { schema?: { name: string }[] }).schema;
    if (schema?.some((s) => s.name === fieldName)) return true;
  }
  return false;
}

function fireFormChange(el: HTMLElement, value: Record<string, unknown>, formIndex = 0): void {
  const forms = el.shadowRoot!.querySelectorAll('ha-form');
  const form = forms[formIndex] as HTMLElement;
  form.dispatchEvent(new CustomEvent('value-changed', {
    detail: { value },
    bubbles: true,
    composed: true,
  }));
}

// T007: US1 — basic entity row editor
describe('EntityRowEditor — basic rendering (T007)', () => {
  it('is registered as calendar-stats-entity-row-editor', () => {
    const el = document.createElement('calendar-stats-entity-row-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-entity-row-editor');
  });

  it('renders ha-form with entity field in main schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    expect(schemaHasField(el, 'entity')).toBe(true);
  });

  it('name field is in main schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', name: 'My Sensor' });
    expect(schemaHasField(el, 'name')).toBe(true);
  });

  it('precision field is in main schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', precision: 2 });
    expect(schemaHasField(el, 'precision')).toBe(true);
  });

  it('dispatches row-changed with correct index and config on name change', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 3);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.temp', name: 'New Name' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.index).toBe(3);
    expect(dispatched[0]!.detail.config.name).toBe('New Name');
    expect(dispatched[0]!.detail.config.entity).toBe('sensor.temp');
  });

  it('dispatches row-changed with correct config on entity change', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.old' }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.new' });
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

  it('factor field is in Advanced schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', factor: 2 });
    expect(schemaHasField(el, 'factor')).toBe(true);
  });

  it('unit field is in Advanced schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', unit: 'kW' });
    expect(schemaHasField(el, 'unit')).toBe(true);
  });

  it('text_color field is in Advanced schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    expect(schemaHasField(el, 'text_color')).toBe(true);
  });

  it('background_color field is in Advanced schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    expect(schemaHasField(el, 'background_color')).toBe(true);
  });

  it('factor change dispatches row-changed with updated EntityRowConfig', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.temp', factor: 2.5 }, 1);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.factor).toBe(2.5);
  });

});

function advancedSchemaNames(el: HTMLElement): string[] {
  const form = el.shadowRoot!.querySelectorAll('ha-form')[1] as HTMLElement & { schema: { name: string }[] };
  return form.schema.map((f) => f.name);
}

function advancedForm(el: HTMLElement): HTMLElement & { data: Record<string, unknown> } {
  return el.shadowRoot!.querySelectorAll('ha-form')[1] as HTMLElement & { data: Record<string, unknown> };
}

function selectorOf(el: HTMLElement, name: string): unknown {
  return schemaField(el, name)?.['selector'];
}

function hassWith(entityId: string, attributes: Record<string, unknown>): HomeAssistant {
  return makeHass({ [entityId]: { entity_id: entityId, state: '1', attributes } });
}

const SUM_META: StatisticMetaEntry = {
  statistic_id: 'tibber:consumption', statistics_unit_of_measurement: 'kWh', unit_class: 'energy',
  has_sum: true, mean_type: 0, source: 'tibber',
};
const MEAN_META: StatisticMetaEntry = {
  statistic_id: 'wetter:temp', statistics_unit_of_measurement: '°C', unit_class: 'temperature',
  has_sum: false, mean_type: 1, source: 'wetter',
};

describe('EntityRowEditor — kind-aware advanced schema', () => {
  it('unknown kind: offers state_class and all four visibility switches', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const names = advancedSchemaNames(el);
    expect(names).toEqual(expect.arrayContaining(['state_class', 'show_zero', 'show_min', 'show_avg', 'show_max']));
    for (const f of ['show_zero', 'show_min', 'show_avg', 'show_max']) {
      expect(selectorOf(el, f)).toEqual({ boolean: {} });
    }
  });

  it('measurement entity: offers min/avg/max switches, hides show_zero and state_class', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0, hassWith('sensor.temp', { state_class: 'measurement' }));
    const names = advancedSchemaNames(el);
    expect(names).toEqual(expect.arrayContaining(['show_min', 'show_avg', 'show_max']));
    expect(names).not.toContain('show_zero');
    expect(names).not.toContain('state_class');
  });

  it('cumulative entity: offers show_zero and state_class, hides min/avg/max switches', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.energy' }, 0, hassWith('sensor.energy', { state_class: 'total_increasing' }));
    const names = advancedSchemaNames(el);
    expect(names).toEqual(expect.arrayContaining(['show_zero', 'state_class']));
    expect(names).not.toContain('show_min');
    expect(names).not.toContain('show_avg');
    expect(names).not.toContain('show_max');
  });

  it('external statistic with has_sum metadata counts as cumulative', async () => {
    const el = await createEntityRowEditor({ entity: 'tibber:consumption' }, 0, makeHass({}), new Set(['tibber:consumption']), SUM_META);
    const names = advancedSchemaNames(el);
    expect(names).toContain('show_zero');
    expect(names).not.toContain('show_min');
  });

  it('external statistic with mean metadata counts as measurement', async () => {
    const el = await createEntityRowEditor({ entity: 'wetter:temp' }, 0, makeHass({}), new Set(['wetter:temp']), MEAN_META);
    const names = advancedSchemaNames(el);
    expect(names).toContain('show_min');
    expect(names).not.toContain('show_zero');
    expect(names).not.toContain('state_class');
  });

  it('config state_class override wins over the entity attribute', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', state_class: 'total' }, 0, hassWith('sensor.temp', { state_class: 'measurement' }));
    const names = advancedSchemaNames(el);
    expect(names).toContain('show_zero');
    expect(names).toContain('state_class');
    expect(names).not.toContain('show_min');
  });

  it('renders no ha-checkbox', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    expect(el.shadowRoot!.querySelector('ha-checkbox, ha-formfield')).toBeNull();
  });
});

describe('EntityRowEditor — visibility switch defaults and serialisation', () => {
  it('feeds unset visibility flags to the form as true (the card default)', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', show_min: false });
    const data = advancedForm(el).data;
    expect(data['show_min']).toBe(false);
    expect(data['show_zero']).toBe(true);
    expect(data['show_avg']).toBe(true);
    expect(data['show_max']).toBe(true);
  });

  it('switching a flag off writes false', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.temp', show_min: false, show_avg: true, show_max: true, show_zero: true }, 1);
    expect(dispatched[0]!.detail.config.show_min).toBe(false);
  });

  it('switching a flag back on drops the key instead of writing true', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', show_min: false }, 0);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.temp', show_min: true, show_avg: true, show_max: true, show_zero: true }, 1);
    const cfg = dispatched[0]!.detail.config as Record<string, unknown>;
    expect('show_min' in cfg).toBe(false);
    expect('show_zero' in cfg).toBe(false);
  });
});

// T021: US5 — Thresholds nested collapsible in EntityRowEditor
describe('EntityRowEditor — Thresholds sub-section (T021)', () => {
  it('renders calendar-stats-threshold-list-editor inside Advanced', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', thresholds: [] });
    const thresholdEditor = el.shadowRoot!.querySelector('calendar-stats-threshold-list-editor');
    expect(thresholdEditor).toBeTruthy();
  });

  it('passes hass down to the threshold editor so its selectors can render', async () => {
    const hass = makeHass();
    const el = await createEntityRowEditor({ entity: 'sensor.temp', thresholds: [] }, 0, hass);
    const thresholdEditor = el.shadowRoot!.querySelector('calendar-stats-threshold-list-editor') as HTMLElement & { hass?: HomeAssistant };
    expect(thresholdEditor.hass).toBe(hass);
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

function schemaField(el: HTMLElement, fieldName: string): Record<string, unknown> | undefined {
  const forms = el.shadowRoot!.querySelectorAll('ha-form');
  for (const form of Array.from(forms)) {
    const schema = (form as HTMLElement & { schema?: { name: string }[] }).schema;
    const field = schema?.find((f) => f.name === fieldName);
    if (field) return field as unknown as Record<string, unknown>;
  }
  return undefined;
}

describe('EntityRowEditor — statistic picker and state_class', () => {
  it('uses the statistic selector for the entity field', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = schemaField(el, 'entity');
    expect(field?.['selector']).toEqual({ statistic: {} });
  });

  it('offers state_class with total and total_increasing in the advanced schema', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp' });
    const field = schemaField(el, 'state_class');
    const options = ((field?.['selector'] as { select?: { options?: { value: string }[] } })?.select?.options ?? []).map((o) => o.value);
    expect(options).toEqual(['total', 'total_increasing']);
  });
});

describe('EntityRowEditor — clearing state_class', () => {
  it('drops state_class from the row config when the dropdown is cleared', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.temp', state_class: 'total_increasing' });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { entity: 'sensor.temp', state_class: undefined }, 1);
    fireFormChange(el, { entity: 'sensor.temp', state_class: '' }, 1);
    expect(dispatched).toHaveLength(2);
    for (const ev of dispatched) {
      expect('state_class' in (ev.detail.config as Record<string, unknown>)).toBe(false);
    }
  });
});

describe('EntityRowEditor — stale indicator against known statistic ids', () => {
  it('shows stale indicator when the id is not among the known statistic ids', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.missing' }, 0, makeHass({}), new Set(['sensor.other']));
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeTruthy();
  });

  it('shows no stale indicator while the known ids are not loaded (null)', async () => {
    const el = await createEntityRowEditor({ entity: 'sensor.missing' }, 0, makeHass({}), null);
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeNull();
  });

  it('shows no stale indicator for an external id known to the recorder but absent from hass.states', async () => {
    const el = await createEntityRowEditor({ entity: 'tibber:consumption' }, 0, makeHass({}), new Set(['tibber:consumption']));
    expect(el.shadowRoot!.querySelector('[data-stale]')).toBeNull();
  });

  it('passes the known statistic ids to the predecessor editor', async () => {
    const known = new Set(['sensor.temp']);
    const el = await createEntityRowEditor({ entity: 'sensor.temp' }, 0, makeHass({}), known);
    const pred = el.shadowRoot!.querySelector('calendar-stats-predecessor-list-editor') as HTMLElement & { knownStatisticIds?: Set<string> | null };
    expect(pred.knownStatisticIds).toBe(known);
  });
});
