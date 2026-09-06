import type { ThresholdOperator } from '../types/card-config';
import { localize } from '../localize/localize';

/** Translation-key segment per operator (JSON keys use underscores). */
const OPERATOR_KEYS: Record<ThresholdOperator, string> = {
  'above': 'above',
  'equals-above': 'equals_above',
  'equals-below': 'equals_below',
  'below': 'below',
  'not-below': 'not_below',
  'not-above': 'not_above',
};

/**
 * Short symbol for an operator, e.g. "≥" or "↓≥".
 *
 * `not-below` and `not-above` compare like `equals-above` / `equals-below`,
 * but only against the day's minimum resp. maximum cell (spec 007, FR-003).
 * Their symbols carry the ↓/↑ marker the summary cells already use for
 * min/max, so two rules on the same value stay distinguishable.
 */
export function operatorSymbol(operator: ThresholdOperator, lang: string): string {
  return localize(`threshold.symbols.${OPERATOR_KEYS[operator]}`, lang);
}

/** Full operator label for pickers, e.g. "Not below (↓≥)". */
export function operatorLabel(operator: ThresholdOperator, lang: string): string {
  return localize(`threshold.operators.${OPERATOR_KEYS[operator]}`, lang);
}
