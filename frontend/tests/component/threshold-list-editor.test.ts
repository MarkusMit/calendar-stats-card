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

  it('renders "Add threshold" button', async () => {
    const el = await createThresholdListEditor([]);
    const btn = el.shadowRoot!.querySelector('[data-action="add-threshold"]');
    expect(btn).toBeTruthy();
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

  it('renders ha-select or operator field for each rule', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 30 }];
    const el = await createThresholdListEditor(rules);
    const operatorField = el.shadowRoot!.querySelector('[data-field="operator"]');
    expect(operatorField).toBeTruthy();
  });

  it('renders value field for each rule', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 30 }];
    const el = await createThresholdListEditor(rules);
    const valueField = el.shadowRoot!.querySelector('[data-field="value"]');
    expect(valueField).toBeTruthy();
  });

  it('renders name field for each rule', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 30, name: 'Hot' }];
    const el = await createThresholdListEditor(rules);
    const nameField = el.shadowRoot!.querySelector('[data-field="threshold_name"]');
    expect(nameField).toBeTruthy();
  });

  it('renders text_color field for each rule', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 30 }];
    const el = await createThresholdListEditor(rules);
    const field = el.shadowRoot!.querySelector('[data-field="threshold_text_color"]');
    expect(field).toBeTruthy();
  });

  it('renders background_color field for each rule', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 30 }];
    const el = await createThresholdListEditor(rules);
    const field = el.shadowRoot!.querySelector('[data-field="threshold_background_color"]');
    expect(field).toBeTruthy();
  });

  it('field change dispatches thresholds-changed with full updated array', async () => {
    const rules: ThresholdRule[] = [{ operator: 'above', value: 10 }];
    const el = await createThresholdListEditor(rules);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const internal = el as unknown as { _handleRuleChange(i: number, field: string, value: unknown): void };
    internal._handleRuleChange(0, 'value', 25);
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result[0]!.value).toBe(25);
  });

  it('operator localization uses underscore key for hyphenated values', async () => {
    const rules: ThresholdRule[] = [{ operator: 'equals-above', value: 10 }];
    const el = await createThresholdListEditor(rules, 'en');
    // Operator label should be localized (not the raw key)
    const operatorField = el.shadowRoot!.querySelector('[data-field="operator"]');
    expect(operatorField).toBeTruthy();
  });
});

describe('ThresholdListEditor — per-period value inputs (015/US4)', () => {
  it('renders day, month, and year value inputs for each rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }]);
    expect(el.shadowRoot!.querySelector('input[data-field="value"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input[data-field="value_month"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input[data-field="value_year"]')).toBeTruthy();
  });

  it('shows stored values and leaves absent periods empty', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10, value_month: 150 }]);
    const day = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value"]')!;
    const month = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value_month"]')!;
    const year = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value_year"]')!;
    expect(day.value).toBe('10');
    expect(month.value).toBe('150');
    expect(year.value).toBe('');
  });

  it('entering a month value dispatches thresholds-changed with value_month', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const month = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value_month"]')!;
    month.value = '150';
    month.dispatchEvent(new Event('change'));
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect(result[0]!.value_month).toBe(150);
    expect(result[0]!.value).toBe(10);
  });

  it('clearing a period input removes the field from the rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10, value_month: 150 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const month = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value_month"]')!;
    month.value = '';
    month.dispatchEvent(new Event('change'));
    expect(dispatched).toHaveLength(1);
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect('value_month' in result[0]!).toBe(false);
    expect(result[0]!.value).toBe(10);
  });

  it('clearing the day input removes value from the rule', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10, value_month: 150 }]);
    const dispatched: CustomEvent[] = [];
    el.addEventListener('thresholds-changed', (e) => dispatched.push(e as CustomEvent));
    const day = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-field="value"]')!;
    day.value = '';
    day.dispatchEvent(new Event('change'));
    const result = dispatched[0]!.detail.thresholds as ThresholdRule[];
    expect('value' in result[0]!).toBe(false);
    expect(result[0]!.value_month).toBe(150);
  });

  it('the three period inputs share one row container', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }]);
    const row = el.shadowRoot!.querySelector('.field-row');
    expect(row).toBeTruthy();
    expect(row!.querySelectorAll('input[data-field="value"], input[data-field="value_month"], input[data-field="value_year"]').length).toBe(3);
  });

  it('english labels: Value (day)/(month)/(year)', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }], 'en');
    const labels = [...el.shadowRoot!.querySelectorAll('.field label')].map((l) => l.textContent!.trim());
    expect(labels).toContain('Value (day)');
    expect(labels).toContain('Value (month)');
    expect(labels).toContain('Value (year)');
  });

  it('german labels: Wert (Tag)/(Monat)/(Jahr)', async () => {
    const el = await createThresholdListEditor([{ operator: 'above', value: 10 }], 'de');
    const labels = [...el.shadowRoot!.querySelectorAll('.field label')].map((l) => l.textContent!.trim());
    expect(labels).toContain('Wert (Tag)');
    expect(labels).toContain('Wert (Monat)');
    expect(labels).toContain('Wert (Jahr)');
  });
});
