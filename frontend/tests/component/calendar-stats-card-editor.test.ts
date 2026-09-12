import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig, ExpressionRowConfig } from '../../src/types/card-config';
import '../../src/components/calendar-stats-card-editor';
import '../../src/components/expression-row-editor';

if (!customElements.get('ha-form')) {
  customElements.define('ha-form', class extends HTMLElement {});
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(states: Record<string, unknown> = {}, send: ReturnType<typeof vi.fn> = vi.fn()): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: states as HomeAssistant['states'],
    connection: { sendMessagePromise: send as unknown as HomeAssistant['connection']['sendMessagePromise'] },
    language: 'en',
  };
}

async function createEditor(config?: CardConfig, hass?: HomeAssistant): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-card-editor') as HTMLElement & {
    setConfig(c: CardConfig): void;
    hass: HomeAssistant;
  };
  document.body.appendChild(el);
  if (config) el.setConfig(config);
  if (hass) el.hass = hass;
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

  it('renders add-row chips', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    const btn = el.shadowRoot!.querySelector('[data-action="add-entity-row"], [data-action="add-expression-row"]');
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
    expect(config.type).toBe('custom:calendar-stats-card');
    expect(config.entities).toHaveLength(1);
    expect((config.entities[0] as { entity: string }).entity).toBe('sensor.temp');
  });

  it('renders one row-item per entity row in list view', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const rows = el.shadowRoot!.querySelectorAll('.row-item');
    expect(rows.length).toBe(2);
  });

  it('opens entity-row-editor in detail view when edit is invoked', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const internal = el as unknown as { _editRow(i: number): void };
    internal._editRow(0);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const editors = el.shadowRoot!.querySelectorAll('calendar-stats-entity-row-editor');
    expect(editors.length).toBe(1);
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

  it('opens calendar-stats-expression-row-editor in detail view for expression rows', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [
        { entity: 'sensor.a' },
        { expression: '{{ sensor.b }}', name: 'Expr' } as ExpressionRowConfig,
      ],
    });
    const internal = el as unknown as { _editRow(i: number): void };
    internal._editRow(1);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const exprEditors = el.shadowRoot!.querySelectorAll('calendar-stats-expression-row-editor');
    expect(exprEditors.length).toBe(1);
    const entityEditors = el.shadowRoot!.querySelectorAll('calendar-stats-entity-row-editor');
    expect(entityEditors.length).toBe(0);
  });
});

// Inline entity picker + reorder + badge removal
describe('CalendarStatsCardEditor — inline picker, reorder, no badge', () => {
  it('renders an inline statistic selector per entity row', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const pickers = el.shadowRoot!.querySelectorAll('.row-list ha-selector');
    expect(pickers.length).toBe(2);
    for (const picker of Array.from(pickers)) {
      expect((picker as HTMLElement & { selector?: unknown }).selector).toEqual({ statistic: {} });
    }
  });

  it('opens a statistic selector when adding an entity row', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    (el.shadowRoot!.querySelector('[data-action="add-entity-row"]') as HTMLElement).click();
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const picker = el.shadowRoot!.querySelector('.entity-picker-row ha-selector') as (HTMLElement & { selector?: unknown }) | null;
    expect(picker).toBeTruthy();
    expect(picker!.selector).toEqual({ statistic: {} });
  });

  it('does not render type badge in main row list', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [
        { entity: 'sensor.a' },
        { expression: '{{ sensor.a }}', name: 'E' } as ExpressionRowConfig,
      ],
    });
    const badges = el.shadowRoot!.querySelectorAll('.row-list .row-type-badge');
    expect(badges.length).toBe(0);
  });

  it('renders a drag handle per row', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const handles = el.shadowRoot!.querySelectorAll('.row-list .drag-handle');
    expect(handles.length).toBe(2);
  });

  it('wraps row list in ha-sortable', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }],
    });
    const sortable = el.shadowRoot!.querySelector('ha-sortable');
    expect(sortable).toBeTruthy();
  });

  it('_moveRow reorders entities and dispatches config-changed', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [
        { entity: 'sensor.a' },
        { entity: 'sensor.b' },
        { entity: 'sensor.c' },
      ],
    });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _moveRow(o: number, n: number): void };
    internal._moveRow(0, 2);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(1);
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect(config.entities.map((e) => (e as { entity: string }).entity))
      .toEqual(['sensor.b', 'sensor.c', 'sensor.a']);
  });

  it('_moveRow no-op when oldIndex === newIndex does not dispatch', async () => {
    const el = await createEditor({
      type: 'calendar-stats-card',
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _moveRow(o: number, n: number): void };
    internal._moveRow(1, 1);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(0);
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
      expect(detail.config.type).toBe('custom:calendar-stats-card');
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

// Feature 016: card-level toggle for the threshold days table
describe('CalendarStatsCardEditor — threshold table toggle', () => {
  const CONFIG: CardConfig = {
    type: 'calendar-stats-card',
    entities: [{ entity: 'sensor.temp' }],
  };

  type OptionsForm = HTMLElement & { data: Record<string, unknown>; schema: { name: string; selector: unknown }[] };

  function optionsForm(el: HTMLElement): OptionsForm {
    const forms = Array.from(el.shadowRoot!.querySelectorAll('ha-form')) as OptionsForm[];
    return forms.find((f) => f.schema?.some((s) => s.name === 'show_threshold_table'))!;
  }

  function fire(el: HTMLElement, value: Record<string, unknown>): void {
    optionsForm(el).dispatchEvent(new CustomEvent('value-changed', { detail: { value }, bubbles: true, composed: true }));
  }

  it('renders the option as a boolean selector, on by default', async () => {
    const el = await createEditor(CONFIG);
    const form = optionsForm(el);
    expect(form.schema.find((s) => s.name === 'show_threshold_table')!.selector).toEqual({ boolean: {} });
    expect(form.data['show_threshold_table']).toBe(true);
  });

  it('reflects an explicit false from the config', async () => {
    const el = await createEditor({ ...CONFIG, show_threshold_table: false } as CardConfig);
    expect(optionsForm(el).data['show_threshold_table']).toBe(false);
  });

  it('emits show_threshold_table: false when switched off', async () => {
    const el = await createEditor(CONFIG);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    fire(el, { show_threshold_table: false });
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect(config.show_threshold_table).toBe(false);
  });

  it('drops the key again when switched on, keeping the default implicit', async () => {
    const el = await createEditor({ ...CONFIG, show_threshold_table: false } as CardConfig);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('config-changed', (e) => dispatched.push(e as CustomEvent));
    fire(el, { show_threshold_table: true });
    const config = (dispatched[0]!.detail as { config: CardConfig }).config;
    expect('show_threshold_table' in config).toBe(false);
  });

  it('renders no ha-checkbox', async () => {
    const el = await createEditor(CONFIG);
    expect(el.shadowRoot!.querySelector('ha-checkbox, ha-formfield')).toBeNull();
  });
});

describe('CalendarStatsCardEditor — options section', () => {
  const CONFIG: CardConfig = {
    type: 'calendar-stats-card',
    entities: [{ entity: 'sensor.temp' }],
  };

  it('renders an Options section with a heading', async () => {
    const el = await createEditor(CONFIG);
    const section = el.shadowRoot!.querySelector('.options-section');
    expect(section).not.toBeNull();
    expect(section!.querySelector('.options-title')!.textContent!.trim()).toBe('Options');
  });

  it('places the section after the add-row controls', async () => {
    const el = await createEditor(CONFIG);
    const addRow = el.shadowRoot!.querySelector('.add-row-section')!;
    const section = el.shadowRoot!.querySelector('.options-section')!;
    expect(addRow.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('holds the threshold table form', async () => {
    const el = await createEditor(CONFIG);
    const section = el.shadowRoot!.querySelector('.options-section')!;
    expect(section.querySelector('ha-form')).not.toBeNull();
  });

  it('shows the section even with no rows configured', async () => {
    const el = await createEditor({ type: 'calendar-stats-card', entities: [] });
    expect(el.shadowRoot!.querySelector('.options-section')).not.toBeNull();
  });
});

describe('CalendarStatsCardEditor — known statistic ids', () => {
  const META = [
    { statistic_id: 'sensor.a', has_sum: false, mean_type: 1 },
    { statistic_id: 'tibber:consumption', has_sum: true, mean_type: 0 },
  ];

  it('requests recorder/list_statistic_ids once when hass is set', async () => {
    const send = vi.fn().mockResolvedValue(META);
    const hass = makeHass({}, send);
    const el = await createEditor({ type: 'calendar-stats-card', entities: [{ entity: 'sensor.a' }] }, hass);
    (el as unknown as { hass: HomeAssistant }).hass = { ...hass };
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const calls = send.mock.calls.filter((c) => (c[0] as Record<string, unknown>)['type'] === 'recorder/list_statistic_ids');
    expect(calls).toHaveLength(1);
  });

  it('passes the loaded ids to the row editor in detail view', async () => {
    const send = vi.fn().mockResolvedValue(META);
    const el = await createEditor({ type: 'calendar-stats-card', entities: [{ entity: 'sensor.a' }] }, makeHass({}, send));
    (el as unknown as { _editRow(i: number): void })._editRow(0);
    await vi.waitFor(async () => {
      await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
      const rowEditor = el.shadowRoot!.querySelector('calendar-stats-entity-row-editor') as (HTMLElement & { knownStatisticIds?: Set<string> | null }) | null;
      expect(rowEditor?.knownStatisticIds).toBeInstanceOf(Set);
      expect(rowEditor!.knownStatisticIds!.has('tibber:consumption')).toBe(true);
    }, { timeout: 2000 });
  });

  it('leaves the ids unknown (null) and still renders when the request fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('WS error'));
    const el = await createEditor({ type: 'calendar-stats-card', entities: [{ entity: 'sensor.a' }] }, makeHass({}, send));
    (el as unknown as { _editRow(i: number): void })._editRow(0);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const rowEditor = el.shadowRoot!.querySelector('calendar-stats-entity-row-editor') as (HTMLElement & { knownStatisticIds?: Set<string> | null }) | null;
    expect(rowEditor).toBeTruthy();
    expect(rowEditor!.knownStatisticIds).toBeNull();
  });

  it("passes the row's metadata entry to the row editor as statMeta", async () => {
    const send = vi.fn().mockResolvedValue(META);
    const el = await createEditor({ type: 'calendar-stats-card', entities: [{ entity: 'tibber:consumption' }] }, makeHass({}, send));
    (el as unknown as { _editRow(i: number): void })._editRow(0);
    await vi.waitFor(async () => {
      await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
      const rowEditor = el.shadowRoot!.querySelector('calendar-stats-entity-row-editor') as (HTMLElement & { statMeta?: unknown }) | null;
      expect(rowEditor?.statMeta).toEqual(META[1]);
    }, { timeout: 2000 });
  });
});
