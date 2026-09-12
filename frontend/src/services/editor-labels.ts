import { localize } from '../localize/localize';

/** Field name → `editor.*` translation key for the label. */
const LABEL_KEYS: Record<string, string> = {
  entity: 'statistic_id',
  expression: 'formula',
  name: 'name',
  unit: 'unit',
  precision: 'precision',
  state_class: 'state_class',
  factor: 'factor',
  show_zero: 'show_zero',
  show_min: 'show_min',
  show_avg: 'show_avg',
  show_max: 'show_max',
  text_color: 'text_color',
  background_color: 'background_color',
  show_threshold_table: 'show_threshold_table',
};

/** Field name → `editor.*` translation key for the helper text under the field. */
const HELPER_KEYS: Record<string, string> = {
  expression: 'formula_help',
  precision: 'precision_help',
  unit: 'unit_help',
  factor: 'factor_help',
  state_class: 'state_class_help',
  text_color: 'color_help',
  background_color: 'color_help',
};

/** Localized label for a row/card editor field; unknown fields fall back to their name. */
export function editorLabel(name: string, lang: string): string {
  const key = LABEL_KEYS[name];
  return key ? localize(`editor.${key}`, lang) : name;
}

/** Localized helper text for a field, or undefined when it has none. */
export function editorHelper(name: string, lang: string): string | undefined {
  const key = HELPER_KEYS[name];
  return key ? localize(`editor.${key}`, lang) : undefined;
}
