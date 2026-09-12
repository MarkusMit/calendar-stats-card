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

  it('renders "Add predecessor" button', async () => {
    const el = await createPredecessorListEditor([]);
    const btn = el.shadowRoot!.querySelector('[data-action="add-predecessor"]');
    expect(btn).toBeTruthy();
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

  it('renders entity ID text field for each entry', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old' }]);
    const field = el.shadowRoot!.querySelector('[data-field="predecessor_entity"]');
    expect(field).toBeTruthy();
  });

  it('renders replaced_on date field for each entry', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old', replaced_on: '2025-01-01' }]);
    const field = el.shadowRoot!.querySelector('[data-field="predecessor_replaced_on"]');
    expect(field).toBeTruthy();
  });

  it('renders factor number field for each entry', async () => {
    const el = await createPredecessorListEditor([{ entity: 'sensor.old', factor: 1.5 }]);
    const field = el.shadowRoot!.querySelector('[data-field="predecessor_factor"]');
    expect(field).toBeTruthy();
  });

  it('field change dispatches predecessors-changed with full updated array', async () => {
    const preds: PredecessorConfig[] = [{ entity: 'sensor.old' }];
    const el = await createPredecessorListEditor(preds);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('predecessors-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleEntryChange(i: number, field: string, value: unknown): void };
    internal._handleEntryChange(0, 'entity', 'sensor.new');
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.predecessors as PredecessorConfig[];
    expect(result[0]!.entity).toBe('sensor.new');
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
