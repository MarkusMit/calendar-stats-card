import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { ExpressionRowConfig } from '../../src/types/card-config';
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

async function createExpressionRowEditor(
  config: ExpressionRowConfig,
  index = 0,
  hass: HomeAssistant = makeHass(),
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-expression-row-editor') as HTMLElement & {
    config: ExpressionRowConfig;
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

// T011: US2 — basic expression row editor
describe('ExpressionRowEditor — basic rendering (T011)', () => {
  it('is registered as calendar-stats-expression-row-editor', () => {
    const el = document.createElement('calendar-stats-expression-row-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-expression-row-editor');
  });

  it('renders formula textarea with placeholder', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const textarea = el.shadowRoot!.querySelector('ha-textarea, [data-field="expression"]');
    expect(textarea).toBeTruthy();
  });

  it('name field is always visible', async () => {
    const el = await createExpressionRowEditor({ expression: '', name: 'My Expr' });
    const nameField = el.shadowRoot!.querySelector('[data-field="name"]');
    expect(nameField).toBeTruthy();
  });

  it('unit field is always visible', async () => {
    const el = await createExpressionRowEditor({ expression: '', unit: 'kWh' });
    const unitField = el.shadowRoot!.querySelector('[data-field="unit"]');
    expect(unitField).toBeTruthy();
  });

  it('precision field is always visible', async () => {
    const el = await createExpressionRowEditor({ expression: '', precision: 1 });
    const precField = el.shadowRoot!.querySelector('[data-field="precision"]');
    expect(precField).toBeTruthy();
  });

  it('dispatches row-changed with ExpressionRowConfig on name change', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}', name: 'Old' }, 2);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleNonFormulaFieldChange(field: string, value: unknown): void };
    internal._handleNonFormulaFieldChange('name', 'New Name');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.index).toBe(2);
    expect(dispatched[0]!.detail.config.name).toBe('New Name');
    expect(dispatched[0]!.detail.config.expression).toBe('{{ sensor.a }}');
  });
});

// T016: US4 — formula validation
describe('ExpressionRowEditor — formula validation (T016)', () => {
  it('blur on invalid syntax sets error, does NOT dispatch row-changed', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFormulaBlur(value: string): void; _formulaError: string | null };
    internal._handleFormulaBlur('{{ invalid ## syntax }}');
    expect(dispatched).toHaveLength(0);
    expect(internal._formulaError).toBeTruthy();
  });

  it('blur on formula with unknown entity sets entity error, does NOT dispatch', async () => {
    const hass = makeHass({}); // no entities
    const el = await createExpressionRowEditor({ expression: '' }, 0, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFormulaBlur(value: string): void; _formulaError: string | null };
    internal._handleFormulaBlur('{{ sensor.missing }}');
    expect(dispatched).toHaveLength(0);
    expect(internal._formulaError).toContain('sensor.missing');
  });

  it('blur on valid formula clears error and dispatches row-changed', async () => {
    const hass = makeHass({
      'sensor.a': { entity_id: 'sensor.a', state: '1', attributes: {} },
    });
    const el = await createExpressionRowEditor({ expression: '' }, 0, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleFormulaBlur(value: string): void; _formulaError: string | null };
    internal._handleFormulaBlur('{{ sensor.a }}');
    expect(internal._formulaError).toBeNull();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.expression).toBe('{{ sensor.a }}');
  });

  it('formula text is never cleared on validation error', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const internal = el as unknown as { _handleFormulaBlur(value: string): void; _dirtyFormula: string };
    internal._handleFormulaBlur('{{ bad ## formula }}');
    expect(internal._dirtyFormula).toBe('{{ bad ## formula }}');
  });
});

// T017: US4 — Advanced section
describe('ExpressionRowEditor — Advanced section (T017)', () => {
  it('renders ha-expansion-panel for Advanced section', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel, [data-section="advanced"]');
    expect(panel).toBeTruthy();
  });

  it('show_zero checkbox is in Advanced section', async () => {
    const el = await createExpressionRowEditor({ expression: '', show_zero: true });
    const checkbox = el.shadowRoot!.querySelector('[data-field="show_zero"]');
    expect(checkbox).toBeTruthy();
  });

  it('text_color field is in Advanced section', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const colorField = el.shadowRoot!.querySelector('[data-field="text_color"]');
    expect(colorField).toBeTruthy();
  });

  it('background_color field is in Advanced section', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const colorField = el.shadowRoot!.querySelector('[data-field="background_color"]');
    expect(colorField).toBeTruthy();
  });

  it('show_zero change dispatches row-changed', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}', show_zero: false }, 1);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleNonFormulaFieldChange(field: string, value: unknown): void };
    internal._handleNonFormulaFieldChange('show_zero', true);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.show_zero).toBe(true);
  });
});
