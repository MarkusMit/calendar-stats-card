import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThresholdRule } from '../../src/types/card-config';
import '../../src/components/threshold-list-editor';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function createThresholdListEditor(
  thresholds: ThresholdRule[] = [],
  lang = 'en',
): Promise<HTMLElement> {
  const el = document.createElement('calendar-stats-threshold-list-editor') as HTMLElement & {
    thresholds: ThresholdRule[];
    lang: string;
  };
  el.thresholds = thresholds;
  el.lang = lang;
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

// T020: US5 — ThresholdListEditor
describe('ThresholdListEditor — (T020)', () => {
  it('is registered as calendar-stats-threshold-list-editor', () => {
    const el = document.createElement('calendar-stats-threshold-list-editor');
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-threshold-list-editor');
  });

  it('renders "Add threshold" as an ha-button', async () => {
    const el = await createThresholdListEditor([]);
    const btn = el.shadowRoot!.querySelector('ha-button[data-action="add-threshold"]');
    expect(btn).toBeTruthy();
    expect(btn!.textContent!.trim()).toBe('Add threshold');
    expect(btn!.getAttribute('appearance')).toBe('plain');
  });

  it('renders no section title and no chip button (the parent panel carries the heading)', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 1 }]);
    expect(el.shadowRoot!.querySelector('.section-title, .add-chip, button')).toBeNull();
  });

  it('add threshold dispatches thresholds-changed with one rule appended', async () => {
    const el = await createThresholdListEditor([]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _addThreshold(): void };
    internal._addThreshold();
    expect(dispatched).toHaveLength(1);
    const thresholds = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(thresholds).toHaveLength(1);
    expect(thresholds[0]!.operator).toBe('above');
  });

  it('remove threshold dispatches thresholds-changed with rule removed', async () => {
    const rules: ThresholdRule[] = [
      { operator: 'above', value: 10 },
      { operator: 'below', value: 5 },
    ];
    const el = await createThresholdListEditor(rules);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _removeThreshold(i: number): void };
    internal._removeThreshold(0);
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result).toHaveLength(1);
    expect(result[0]!.operator).toBe('below');
  });

  it('renders one ha-form per rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 30 }, { operator: 'below', value: 5 }]);
    expect(el.shadowRoot!.querySelectorAll('ha-form')).toHaveLength(2);
  });

  it('form value-changed dispatches thresholds-changed with the merged rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }, { operator: 'below', value: 5 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelectorAll('ha-form')[0]!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { operator: 'above', value: 25, name: 'Hot' } },
      bubbles: true,
      composed: true,
    }));
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail.thresholds).toEqual([
      { operator: 'above', value: 25, name: 'Hot' },
      { operator: 'below', value: 5 },
    ]);
  });

  it('renders no raw input or select elements', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 30, name: 'Hot' }]);
    expect(el.shadowRoot!.querySelector('input, select')).toBeNull();
  });

  it('remove button sits in the panel icons slot and removes that rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }, { operator: 'below', value: 5 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const buttons = el.shadowRoot!.querySelectorAll('ha-expansion-panel > ha-icon-button[slot="icons"]');
    expect(buttons).toHaveLength(2);
    (buttons[0] as HTMLElement).click();
    expect(dispatched[0]!.detail.thresholds).toEqual([{ operator: 'below', value: 5 }]);
  });
});

type SchemaEntry = { name?: string; type?: string; required?: boolean; selector?: unknown; schema?: SchemaEntry[] };

function ruleSchema(el: HTMLElement): SchemaEntry[] {
  return (el.shadowRoot!.querySelector('ha-form') as HTMLElement & { schema: SchemaEntry[] }).schema;
}

describe('ThresholdListEditor — rule form schema', () => {
  it('offers the operator as a dropdown select with all six localized options', async () => {
    const el = await createThresholdListEditor([{ operator: 'equals-above', value: 10 }], 'en');
    const op = ruleSchema(el).find((s) => s.name === 'operator')!;
    const select = (op.selector as { select: { mode: string; options: { value: string; label: string }[] } }).select;
    expect(select.mode).toBe('dropdown');
    expect(op.required).toBe(true);
    expect(select.options.map((o) => o.value)).toEqual([
      'above', 'equals-above', 'equals-below', 'below', 'not-below', 'not-above',
    ]);
    expect(select.options[1]!.label).toBe('At least (≥)');
  });

  it('places the three period values in one grid row of number selectors', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }]);
    const grid = ruleSchema(el).find((s) => s.type === 'grid')!;
    // ha-form hands a named grid item data[name]; only an unnamed grid receives the whole rule.
    expect(grid.name).toBe('');
    expect(grid.schema!.map((s) => s.name)).toEqual(['value', 'value_month', 'value_year']);
    for (const entry of grid.schema!) {
      expect(entry.selector).toMatchObject({ number: { mode: 'box' } });
    }
  });

  it('has text selectors for label and colours', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }]);
    const names = ruleSchema(el).filter((s) => s.selector != null && 'text' in (s.selector as object)).map((s) => s.name);
    expect(names).toEqual(['name', 'text_color', 'background_color']);
  });

  it('binds the rule as ha-form data', async () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, value_month: 150 };
    const el = await createThresholdListEditor([rule]);
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { data: unknown };
    expect(form.data).toEqual(rule);
  });

  it('clearing a period field removes it from the rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10, value_month: 150 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { operator: 'above', value: 10, value_month: undefined } },
      bubbles: true,
      composed: true,
    }));
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result[0]).toEqual({ operator: 'above', value: 10 });
    expect('value_month' in result[0]!).toBe(false);
  });

  it('clearing a text field removes it from the rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10, name: 'Hot' }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { operator: 'above', value: 10, name: '' } },
      bubbles: true,
      composed: true,
    }));
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result[0]).toEqual({ operator: 'above', value: 10 });
  });

  it('keeps the operator when the form sends it as undefined', async () => {
    const el = await createThresholdListEditor([{ operator: 'below', value: 10 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { operator: undefined, value: 10 } },
      bubbles: true,
      composed: true,
    }));
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result[0]!.operator).toBe('below');
  });

  it('english labels: Operator, Value (day)/(month)/(year), Label (optional)', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }], 'en');
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { computeLabel: (s: { name: string }) => string };
    expect(form.computeLabel({ name: 'operator' })).toBe('Operator');
    expect(form.computeLabel({ name: 'value' })).toBe('Value (day)');
    expect(form.computeLabel({ name: 'value_month' })).toBe('Value (month)');
    expect(form.computeLabel({ name: 'value_year' })).toBe('Value (year)');
    expect(form.computeLabel({ name: 'name' })).toBe('Label (optional)');
  });

  it('german labels: Wert (Tag)/(Monat)/(Jahr)', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }], 'de');
    const form = el.shadowRoot!.querySelector('ha-form') as HTMLElement & { computeLabel: (s: { name: string }) => string };
    expect(form.computeLabel({ name: 'value' })).toBe('Wert (Tag)');
    expect(form.computeLabel({ name: 'value_month' })).toBe('Wert (Monat)');
    expect(form.computeLabel({ name: 'value_year' })).toBe('Wert (Jahr)');
  });
});

describe('ThresholdListEditor — operator symbol in the panel header', () => {
  async function headers(thresholds: ThresholdRule[], lang = 'en'): Promise<string[]> {
    const el = await createThresholdListEditor(thresholds, lang);
    return [...el.shadowRoot!.querySelectorAll('ha-expansion-panel')]
      .map((panel) => (panel as HTMLElement & { header?: string }).header ?? '');
  }

  it('tells not-below apart from equals-above at the same value', async () => {
    const [equalsAbove, notBelow] = await headers([
      { operator: 'equals-above', value: 25, background_color: 'orange' },
      { operator: 'not-below', value: 25, background_color: 'lime' },
    ]);

    expect(equalsAbove).not.toBe(notBelow);
  });

  it('tells not-above apart from equals-below at the same value', async () => {
    const [equalsBelow, notAbove] = await headers([
      { operator: 'equals-below', value: 10, background_color: 'orange' },
      { operator: 'not-above', value: 10, background_color: 'lime' },
    ]);

    expect(equalsBelow).not.toBe(notAbove);
  });

  it('marks the cell the min/max operators target', async () => {
    const [notBelow, notAbove] = await headers([
      { operator: 'not-below', value: 0, name: 'Frost free', background_color: 'lime' },
      { operator: 'not-above', value: 25, background_color: 'cyan' },
    ]);

    expect(notBelow).toBe('Frost free (↓≥ day 0)');
    expect(notAbove).toBe('↑≤ day 25');
  });

  it('labels every present period so day/month/year values stay distinguishable', async () => {
    const [dayMonth, dayYear, monthOnly] = await headers([
      { operator: 'above', value: 5, value_month: 100 },
      { operator: 'above', value: 5, value_year: 100 },
      { operator: 'above', value_month: 100 },
    ]);
    expect(dayMonth).toBe('> day 5 · month 100');
    expect(dayYear).toBe('> day 5 · year 100');
    expect(monthOnly).toBe('> month 100');
  });

  it('uses german period labels', async () => {
    const [h] = await headers([{ operator: 'above', value: 5, value_month: 100 }], 'de');
    expect(h).toBe('> Tag 5 · Monat 100');
  });

  it('shows a dash when the rule has no value yet', async () => {
    const [h] = await headers([{ operator: 'above' }]);
    expect(h).toBe('> —');
  });
});
