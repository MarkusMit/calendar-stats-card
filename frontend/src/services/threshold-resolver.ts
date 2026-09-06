import type { ThresholdRule, CellRole, ThresholdScope } from '../types/card-config';

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

/** Every rule that applies to the cell, in config order — the candidates a winner is picked from. */
function applicableRules(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
  cellScope: ThresholdScope,
): Array<{ rule: ThresholdRule; value: number }> {
  return thresholds
    .map((t) => ({ rule: t, value: thresholdFor(t, cellScope) }))
    .filter((e): e is { rule: ThresholdRule; value: number } =>
      e.value != null
      && Boolean(e.rule.text_color || e.rule.background_color)
      && matchesOperator(cellValue, e.rule.operator, e.value, cellRole),
    );
}

/** All applicable rules, not just the winning one — used for cumulative exceedance counts. */
export function matchingThresholds(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
  cellScope: ThresholdScope = 'day',
): ThresholdRule[] {
  return applicableRules(cellValue, thresholds, cellRole, cellScope).map((e) => e.rule);
}

export function resolveThreshold(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
  cellScope: ThresholdScope = 'day',
): ThresholdRule | undefined {
  const withValue = applicableRules(cellValue, thresholds, cellRole, cellScope);

  if (withValue.length === 0) return undefined;

  const minDist = Math.min(...withValue.map((e) => Math.abs(cellValue - e.value)));
  const candidates = withValue.filter((e) => Math.abs(cellValue - e.value) === minDist);

  if (candidates.length === 1) return candidates[0]!.rule;

  const maxVal = Math.max(...candidates.map((e) => e.value));
  const top = candidates.filter((e) => e.value === maxVal);

  // Secondary tie-break: first-defined (filter preserves original order)
  return top[0]!.rule;
}

export function buildCellStyle(
  staticTextColor: string | undefined,
  staticBgColor: string | undefined,
  threshold: ThresholdRule | undefined,
  autoTextColor?: string,
): string | undefined {
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
  const parts: string[] = [];
  if (text) parts.push(`color:${text}`);
  if (bg) parts.push(`background-color:${bg}`);
  return parts.length ? parts.join(';') : undefined;
}
