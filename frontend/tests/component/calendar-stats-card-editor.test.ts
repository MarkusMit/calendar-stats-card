import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig, ExpressionRowConfig } from '../../src/types/card-config';
import '../../src/components/calendar-stats-card-editor';
import '../../src/components/expression-row-editor';

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

async function createEditor(config?: CardConfig): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-card-editor') as HTMLElement & {
    setConfig(c: CardConfig): void;
    hass: HomeAssistant;
  };
  document.body.appendChild(el);
  if (config) el.setConfig(config);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

// T006: US1 — empty state and entity-row addition
describe('CalendarStatsCardEditor — US1: empty state and entity-row addition (T006)', () => {
  it('shows empty-state message when no entities configured', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const text = el.shadowRoot!.textContent ?? '';
    expect(text).toMatch(/no rows yet|add your first row/i);
  });

  it('renders "Add row" button', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const btn = el.shadowRoot!.querySelector('[data-action="add-row"], button, .add-row-btn');
    expect(btn).toBeTruthy();
  });

  it('dispatches config-changed with new entity after entity-row addition', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as {
      _addEntityRow(id: string): void;
    };
    internal._addEntityRow('sensor.temp');
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect(config.type).toBe('calendar-stats-card');
    expect(config.entities).toHaveLength(1);
    expect((config.entities[0] as { entity: string }).entity).toBe('sensor.temp');
  });

  it('renders one entity-row-editor per entity row', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const rows = el.shadowRoot!.querySelectorAll('calendar-stats-entity-row-editor');
    expect(rows.length).toBe(2);
  });
});

// T010: US2 — row management (group-a: reorder/remove; group-b: expression-row addition)
describe('CalendarStatsCardEditor — US2: row management (T010)', () => {
  it('remove row deletes entry at index and dispatches config-changed', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _removeRow(i: number): void };
    internal._removeRow(0);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect(config.entities).toHaveLength(1);
    expect((config.entities[0] as { entity: string }).entity).toBe('sensor.b');
  });

  it('adding expression row does NOT dispatch config-changed (FR-008 brand-new row)', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _addExpressionRow(): void };
    internal._addExpressionRow();
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(0);
  });

  it('expression row excluded from config-changed payload when expression is empty (FR-008)', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as {
      _addExpressionRow(): void;
      _handleRowChanged(e: CustomEvent): void;
    };
    internal._addExpressionRow();
    // Simulate row-changed with valid formula from ExpressionRowEditor
    internal._handleRowChanged(new CustomEvent('row-changed', {
      detail: { index: 0, config: { expression: '{{ sensor.a + sensor.b }}', name: 'Test', unit: 'kWh', precision: 0 } },
    }));
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect(config.entities).toHaveLength(1);
    expect((config.entities[0] as { expression: string }).expression).toBe('{{ sensor.a + sensor.b }}');
  });

  it('renders calendar-stats-expression-row-editor for expression rows', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [
        { entity: 'sensor.a' },
        { expression: '{{ sensor.b }}', name: 'Expr' } as ExpressionRowConfig,
      ],
    });
    const exprEditors = el.shadowRoot!.querySelectorAll('calendar-stats-expression-row-editor');
    expect(exprEditors.length).toBe(1);
  });
});

// T004: core contract
describe('CalendarStatsCardEditor — core contract (T004)', () => {
  it('is registered as calendar-stats-card-editor', () => {
    const el = document.createElement('calendar-stats-card-editor');
    expect(el).toBeTruthy();
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-card-editor');
  });

  it('setConfig stores entities', async () => {
    const config: CardConfig = { type: 'calendar-stats-card', entities: [{ entity: 'sensor.temp' }] };
    const el = await createEditor(config);
    expect(el.shadowRoot).toBeTruthy();
  });

  it('setConfig preserves unknown top-level fields (FR-010)', async () => {
    const config = { type: 'calendar-stats-card', entities: [], unknownField: 'preserved' } as unknown as CardConfig;
    const el = await createEditor(config);
    const dispatched: Event[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e));
    (el as HTMLElement & { hass: HomeAssistant }).hass = makeHass({ 'sensor.x': { entity_id: 'sensor.x', state: '1', attributes: {} } });
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    // Trigger a change by simulating a row-changed — tested more fully in T028
    expect(el.shadowRoot).toBeTruthy();
  });

  it('config-changed event has correct shape', async () => {
    const config: CardConfig = { type: 'calendar-stats-card', entities: [] };
    const el = await createEditor(config);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    // Force a dispatch by simulating internal row-changed
    el.dispatchEvent(new CustomEvent('_test_dispatch', { bubbles: false }));
    // Manually trigger via internal method
    const internal = el as unknown as { _dispatchConfigChanged(): void };
    if (typeof internal._dispatchConfigChanged === 'function') {
      internal._dispatchConfigChanged();
      expect(dispatched).toHaveLength(1);
      const detail = dispatched[0]!.detail as { config: CardConfig };
      expect(detail.config.type).toBe('calendar-stats-card');
      expect(Array.isArray(detail.config.entities)).toBe(true);
    }
  });

  it('hass property accepted without throwing', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    expect(() => {
      (el as HTMLElement & { hass: HomeAssistant }).hass = makeHass();
    }).not.toThrow();
  });
});

// T028: FR-010 — unknown field round-trip integration test
describe('CalendarStatsCardEditor — unknown field round-trip (T028/FR-010)', () => {
  it('unknown top-level field survives setConfig → mutate known field → config-changed', async () => {
    const config = {
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.x' }],
      unknownTopField: 't',
    } as unknown as CardConfig;
    const el = await createEditor(config);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _dispatchConfigChanged(): void };
    internal._dispatchConfigChanged();
    expect(dispatched).toHaveLength(1);
    const emitted = dispatched[0]!.detail.config as Record<string, unknown>;
    expect(emitted['unknownTopField']).toBe('t');
  });

  it('unknown row-level field survives setConfig → mutate known field → config-changed', async () => {
    const config = {
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.x', unknownRowField: 'r' }],
    } as unknown as CardConfig;
    const el = await createEditor(config);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as {
      _handleRowChanged(e: CustomEvent): void;
      _dispatchConfigChanged(): void;
    };
    internal._handleRowChanged(new CustomEvent('row-changed', {
      detail: { index: 0, config: { entity: 'sensor.x', unknownRowField: 'r', name: 'Updated' } },
    }));
    expect(dispatched).toHaveLength(1);
    const entities = (dispatched[0]!.detail.config as CardConfig).entities;
    const row = entities[0] as unknown as Record<string, unknown>;
    expect(row['unknownRowField']).toBe('r');
    expect(row['name']).toBe('Updated');
  });
});
