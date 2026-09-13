import type { ThresholdRule, CellRole, ThresholdScope } from '../types/card-config';

/** Shared stand-in for an unconfigured `thresholds` list. Rendering asks for a
 *  row's rules once per cell, so a fresh `[]` per miss would be thousands of
 *  throwaway arrays per table. */
export const EMPTY_THRESHOLDS: readonly ThresholdRule[] = Object.freeze([]);

const NOT_BELOW_EXCLUDED: ReadonlySet<CellRole> = new Set(['avg', 'max', 'summary-avg', 'summary-max']);
const NOT_ABOVE_EXCLUDED: ReadonlySet<CellRole> = new Set(['min', 'avg', 'summary-min', 'summary-avg']);

/** The rule's threshold for the given period; undefined ⇒ rule is inert there. */
function thresholdFor(rule: ThresholdRule, cellScope: ThresholdScope): number | undefined {
  switch (cellScope) {
    case 'day': return rule.value;
    case 'month': return rule.value_month;
    case 'year': return rule.value_year;
  }
}

function matchesOperator(cellValue: number, operator: ThresholdRule['operator'], value: number, cellRole: CellRole): boolean {
  switch (operator) {
    case 'not-below': return !NOT_BELOW_EXCLUDED.has(cellRole) && cellValue >= value;
    case 'not-above': return !NOT_ABOVE_EXCLUDED.has(cellRole) && cellValue <= value;
    case 'above':        return cellValue > value;
    case 'equals-above': return cellValue >= value;
    case 'equals-below': return cellValue <= value;
    case 'below':        return cellValue < value;
  }
}

/** The rule's threshold for this cell, or undefined when the rule cannot apply to it. */
function applicableValue(
  rule: ThresholdRule,
  cellValue: number,
  cellRole: CellRole,
  cellScope: ThresholdScope,
): number | undefined {
  const value = thresholdFor(rule, cellScope);
  if (value == null) return undefined;
  if (!rule.text_color && !rule.background_color) return undefined;
  return matchesOperator(cellValue, rule.operator, value, cellRole) ? value : undefined;
}

/** All applicable rules, not just the winning one — used for cumulative exceedance counts. */
export function matchingThresholds(
  cellValue: number,
  thresholds: readonly ThresholdRule[],
  cellRole: CellRole,
  cellScope: ThresholdScope = 'day',
): ThresholdRule[] {
  const matches: ThresholdRule[] = [];
  for (const rule of thresholds) {
    if (applicableValue(rule, cellValue, cellRole, cellScope) !== undefined) matches.push(rule);
  }
  return matches;
}

/**
 * The rule that colors the cell: the closest applicable threshold, ties broken
 * by the higher threshold and then by config order. Resolved in one pass —
 * this runs several times per cell, for thousands of cells.
 */
export function resolveThreshold(
  cellValue: number,
  thresholds: readonly ThresholdRule[],
  cellRole: CellRole,
  cellScope: ThresholdScope = 'day',
): ThresholdRule | undefined {
  let winner: ThresholdRule | undefined;
  let winnerDistance = Infinity;
  let winnerValue = -Infinity;

  for (const rule of thresholds) {
    const value = applicableValue(rule, cellValue, cellRole, cellScope);
    if (value === undefined) continue;
    const distance = Math.abs(cellValue - value);
    // Strictly better only: an exact tie keeps the rule defined first.
    if (distance < winnerDistance || (distance === winnerDistance && value > winnerValue)) {
      winner = rule;
      winnerDistance = distance;
      winnerValue = value;
    }
  }

  return winner;
}

export function buildCellStyle(
  staticTextColor: string | undefined,
  staticBgColor: string | undefined,
  threshold: ThresholdRule | undefined,
  autoTextColor?: string,
): string | undefined {
  // Uncolored cells are the common case and are asked for once per cell — leave
  // before any allocation. Without statics and without a rule, nothing below can
  // produce a color: auto-contrast needs a defined background.
  if (staticTextColor === undefined && staticBgColor === undefined && threshold === undefined) {
    return undefined;
  }
  let text = staticTextColor;
  let bg = staticBgColor;
  if (threshold) {
    if (threshold.text_color !== undefined) text = threshold.text_color;
    if (threshold.background_color !== undefined) bg = threshold.background_color;
  }
  // No explicit text color but a background is present → use auto-contrast
  // text (black/white by luminance) for dark-mode readability.
  if (text === undefined && bg !== undefined && autoTextColor !== undefined) {
    text = autoTextColor;
  }
  if (text && bg) return `color:${text};background-color:${bg}`;
  if (text) return `color:${text}`;
  if (bg) return `background-color:${bg}`;
  return undefined;
}
