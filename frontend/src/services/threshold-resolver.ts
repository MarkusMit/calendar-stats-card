import type { ThresholdRule, CellRole } from '../types/card-config';

const NOT_BELOW_EXCLUDED: ReadonlySet<CellRole> = new Set(['avg', 'max', 'summary-avg', 'summary-max']);
const NOT_ABOVE_EXCLUDED: ReadonlySet<CellRole> = new Set(['min', 'avg', 'summary-min', 'summary-avg']);

function matchesOperator(cellValue: number, rule: ThresholdRule, cellRole: CellRole): boolean {
  const { operator, value } = rule;
  switch (operator) {
    case 'not-below': return !NOT_BELOW_EXCLUDED.has(cellRole) && cellValue >= value;
    case 'not-above': return !NOT_ABOVE_EXCLUDED.has(cellRole) && cellValue <= value;
    case 'above':        return cellValue > value;
    case 'equals-above': return cellValue >= value;
    case 'equals-below': return cellValue <= value;
    case 'below':        return cellValue < value;
  }
}

export function resolveThreshold(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
): ThresholdRule | undefined {
  const matching = thresholds.filter(
    (t) => (t.text_color || t.background_color) && matchesOperator(cellValue, t, cellRole),
  );

  if (matching.length === 0) return undefined;

  const minDist = Math.min(...matching.map((t) => Math.abs(cellValue - t.value)));
  const candidates = matching.filter((t) => Math.abs(cellValue - t.value) === minDist);

  if (candidates.length === 1) return candidates[0];

  const maxVal = Math.max(...candidates.map((t) => t.value));
  const top = candidates.filter((t) => t.value === maxVal);

  // Secondary tie-break: first-defined (filter preserves original order)
  return top[0];
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
