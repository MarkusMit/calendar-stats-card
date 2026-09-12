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
  knownStatisticIds: Set<string> | null = null,
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-expression-row-editor') as HTMLElement & {
    config: ExpressionRowConfig;
    index: number;
    hass: HomeAssistant;
    lang: string;
    knownStatisticIds: Set<string> | null;
  };
  el.config = config;
  el.index = index;
  el.hass = hass;
  el.lang = 'en';
  el.knownStatisticIds = knownStatisticIds;
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

describe('ExpressionRowEditor — threshold editor wiring', () => {
  it('passes hass down to the threshold editor so its selectors can render', async () => {
    const hass = makeHass();
    const el = await createExpressionRowEditor({ expression: 'sensor.a' }, 0, hass);
    const thresholdEditor = el.shadowRoot!.querySelector('calendar-stats-threshold-list-editor') as HTMLElement & { hass?: HomeAssistant };
    expect(thresholdEditor.hass).toBe(hass);
  });
});

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

// T011: US2 — basic expression row editor
describe('ExpressionRowEditor — basic rendering (T011)', () => {
  it('is registered as calendar-stats-expression-row-editor', () => {
    const el = document.createElement('calendar-stats-expression-row-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-expression-row-editor');
  });

  it('renders ha-form with expression field in main schema', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    expect(schemaHasField(el, 'expression')).toBe(true);
  });

  it('name field is in main schema', async () => {
    const el = await createExpressionRowEditor({ expression: '', name: 'My Expr' });
    expect(schemaHasField(el, 'name')).toBe(true);
  });

  it('unit field is in main schema', async () => {
    const el = await createExpressionRowEditor({ expression: '', unit: 'kWh' });
    expect(schemaHasField(el, 'unit')).toBe(true);
  });

  it('precision field is in main schema', async () => {
    const el = await createExpressionRowEditor({ expression: '', precision: 1 });
    expect(schemaHasField(el, 'precision')).toBe(true);
  });

  it('dispatches row-changed with ExpressionRowConfig on name change', async () => {
    const hass = makeHass({ 'sensor.a': { entity_id: 'sensor.a', state: '1', attributes: {} } });
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}', name: 'Old' }, 2, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ sensor.a }}', name: 'New Name' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.index).toBe(2);
    expect(dispatched[0]!.detail.config.name).toBe('New Name');
    expect(dispatched[0]!.detail.config.expression).toBe('{{ sensor.a }}');
  });
});

// T016: US4 — formula validation
describe('ExpressionRowEditor — formula validation (T016)', () => {
  it('invalid syntax renders a blocking error and does NOT dispatch row-changed', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ invalid ## syntax }}' });
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(dispatched).toHaveLength(0);
    const error = el.shadowRoot!.querySelector('[data-error]');
    expect(error).toBeTruthy();
    expect(error!.textContent).toContain('Invalid expression syntax');
    expect(el.shadowRoot!.querySelector('[data-warning]')).toBeNull();
  });

  it('an id unknown to the recorder renders a warning but still dispatches row-changed', async () => {
    const el = await createExpressionRowEditor({ expression: '' }, 0, makeHass({}), new Set(['sensor.other']));
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ sensor.missing }}' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.expression).toBe('{{ sensor.missing }}');
    // The parent writes the config back; the warning follows the stored expression.
    (el as unknown as { config: ExpressionRowConfig }).config = dispatched[0]!.detail.config as ExpressionRowConfig;
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const warning = el.shadowRoot!.querySelector('[data-warning]');
    expect(warning).toBeTruthy();
    expect(warning!.textContent).toContain('sensor.missing');
    expect(el.shadowRoot!.querySelector('[data-error]')).toBeNull();
  });

  it('does not flag ids while the known statistic ids are not loaded (null)', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.missing }}' }, 0, makeHass({}), null);
    expect(el.shadowRoot!.querySelector('[data-warning]')).toBeNull();
  });

  it('accepts an external statistic id known to the recorder but absent from hass.states', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ tibber:consumption * 2 }}' }, 0, makeHass({}), new Set(['tibber:consumption']));
    expect(el.shadowRoot!.querySelector('[data-warning], [data-error]')).toBeNull();
  });

  it('shows the syntax error for a stored invalid formula on first render', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ 1 ## 2 }}' });
    expect(el.shadowRoot!.querySelector('[data-error]')).toBeTruthy();
  });

  it('shows the warning for a stored formula with an unknown id on first render', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.gone }}' }, 0, makeHass({}), new Set(['sensor.other']));
    expect(el.shadowRoot!.querySelector('[data-warning]')!.textContent).toContain('sensor.gone');
  });

  it('drops the warning once the known ids arrive and contain the id', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.late }}' }, 0, makeHass({}), new Set(['sensor.other']));
    expect(el.shadowRoot!.querySelector('[data-warning]')).toBeTruthy();
    (el as unknown as { knownStatisticIds: Set<string> | null }).knownStatisticIds = new Set(['sensor.late']);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(el.shadowRoot!.querySelector('[data-warning]')).toBeNull();
  });

  it('a valid formula after a syntax error clears the error and dispatches', async () => {
    const hass = makeHass({ 'sensor.a': { entity_id: 'sensor.a', state: '1', attributes: {} } });
    const el = await createExpressionRowEditor({ expression: '' }, 0, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ 1 ## 2 }}' });
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(el.shadowRoot!.querySelector('[data-error]')).toBeTruthy();
    fireFormChange(el, { expression: '{{ sensor.a }}' });
    expect(dispatched).toHaveLength(1);
    (el as unknown as { config: ExpressionRowConfig }).config = dispatched[0]!.detail.config as ExpressionRowConfig;
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(el.shadowRoot!.querySelector('[data-error]')).toBeNull();
  });

  it('explains the formula syntax as helper text on the expression field', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { computeHelper?: (s: { name: string }) => string | undefined };
    expect(form.computeHelper).toBeTypeOf('function');
    expect(form.computeHelper!({ name: 'expression' })).toBe('Statistic IDs, numbers, + - * / and parentheses, e.g. sensor.export - sensor.import');
    expect(form.computeHelper!({ name: 'name' })).toBeUndefined();
  });
});

// T017: US4 — Advanced section
describe('ExpressionRowEditor — Advanced section (T017)', () => {
  it('renders ha-expansion-panel for Advanced section', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    const panel = el.shadowRoot!.querySelector('ha-expansion-panel, [data-section="advanced"]');
    expect(panel).toBeTruthy();
  });

  it('show_zero checkbox is in Advanced schema', async () => {
    const el = await createExpressionRowEditor({ expression: '', show_zero: true });
    expect(schemaHasField(el, 'show_zero')).toBe(true);
  });

  it('text_color field is in Advanced schema', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    expect(schemaHasField(el, 'text_color')).toBe(true);
  });

  it('background_color field is in Advanced schema', async () => {
    const el = await createExpressionRowEditor({ expression: '' });
    expect(schemaHasField(el, 'background_color')).toBe(true);
  });

  it('feeds an unset show_zero to the advanced form as true (the card default)', async () => {
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}' });
    const form = el.shadowRoot!.querySelectorAll('ha-form')[1] as HTMLElement & { data: Record<string, unknown> };
    expect(form.data['show_zero']).toBe(true);
  });

  it('switching show_zero off writes false', async () => {
    const hass = makeHass({ 'sensor.a': { entity_id: 'sensor.a', state: '1', attributes: {} } });
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}' }, 1, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ sensor.a }}', show_zero: false }, 1);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.config.show_zero).toBe(false);
  });

  it('switching show_zero back on drops the key instead of writing true', async () => {
    const hass = makeHass({ 'sensor.a': { entity_id: 'sensor.a', state: '1', attributes: {} } });
    const el = await createExpressionRowEditor({ expression: '{{ sensor.a }}', show_zero: false }, 1, hass);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('row-changed', (e) => dispatched.push(e as CustomEvent));
    fireFormChange(el, { expression: '{{ sensor.a }}', show_zero: true }, 1);
    expect('show_zero' in (dispatched[0]!.detail.config as Record<string, unknown>)).toBe(false);
  });
});
