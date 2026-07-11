import { describe, it, expect } from 'vitest';
import { resolveThreshold, buildCellStyle } from '../../../src/services/threshold-resolver';
import type { ThresholdRule } from '../../../src/types/card-config';

// --- resolveThreshold ---

describe('resolveThreshold — empty / no-match', () => {
  it('empty thresholds → undefined', () => {
    expect(resolveThreshold(15, [], 'scalar')).toBeUndefined();
  });

  it('no rule matches → undefined', () => {
    const r: ThresholdRule = { operator: 'above', value: 20, background_color: 'red' };
    expect(resolveThreshold(10, [r], 'scalar')).toBeUndefined();
  });

  it('rule with no color fields → ignored, returns undefined', () => {
    const r: ThresholdRule = { operator: 'above', value: 5, name: 'x' };
    expect(resolveThreshold(10, [r], 'scalar')).toBeUndefined();
  });

  it('rule with only text_color → valid, matched', () => {
    const r: ThresholdRule = { operator: 'above', value: 5, text_color: 'blue' };
    expect(resolveThreshold(10, [r], 'scalar')).toBe(r);
  });

  it('rule with only background_color → valid, matched', () => {
    const r: ThresholdRule = { operator: 'above', value: 5, background_color: 'red' };
    expect(resolveThreshold(10, [r], 'scalar')).toBe(r);
  });
});

describe('resolveThreshold — above operator', () => {
  const rule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };

  it('value > threshold → matches', () => {
    expect(resolveThreshold(11, [rule], 'scalar')).toBe(rule);
  });

  it('value === threshold → no match (strictly greater)', () => {
    expect(resolveThreshold(10, [rule], 'scalar')).toBeUndefined();
  });

  it('value < threshold → no match', () => {
    expect(resolveThreshold(9, [rule], 'scalar')).toBeUndefined();
  });
});

describe('resolveThreshold — equals-above operator', () => {
  const rule: ThresholdRule = { operator: 'equals-above', value: 10, background_color: 'orange' };

  it('value > threshold → matches', () => {
    expect(resolveThreshold(11, [rule], 'scalar')).toBe(rule);
  });

  it('value === threshold → matches (boundary included)', () => {
    expect(resolveThreshold(10, [rule], 'scalar')).toBe(rule);
  });

  it('value < threshold → no match', () => {
    expect(resolveThreshold(9, [rule], 'scalar')).toBeUndefined();
  });
});

describe('resolveThreshold — equals-below operator', () => {
  const rule: ThresholdRule = { operator: 'equals-below', value: 10, background_color: 'cyan' };

  it('value < threshold → matches', () => {
    expect(resolveThreshold(9, [rule], 'scalar')).toBe(rule);
  });

  it('value === threshold → matches (boundary included)', () => {
    expect(resolveThreshold(10, [rule], 'scalar')).toBe(rule);
  });

  it('value > threshold → no match', () => {
    expect(resolveThreshold(11, [rule], 'scalar')).toBeUndefined();
  });
});

describe('resolveThreshold — below operator', () => {
  const rule: ThresholdRule = { operator: 'below', value: 10, background_color: 'blue' };

  it('value < threshold → matches', () => {
    expect(resolveThreshold(9, [rule], 'scalar')).toBe(rule);
  });

  it('value === threshold → no match (strictly less)', () => {
    expect(resolveThreshold(10, [rule], 'scalar')).toBeUndefined();
  });

  it('value > threshold → no match', () => {
    expect(resolveThreshold(11, [rule], 'scalar')).toBeUndefined();
  });
});

describe('resolveThreshold — closest-wins (≥5 value bands)', () => {
  const t1: ThresholdRule = { operator: 'above', value: 10, background_color: 'yellow' };
  const t2: ThresholdRule = { operator: 'above', value: 20, background_color: 'orange' };
  const t3: ThresholdRule = { operator: 'above', value: 30, background_color: 'red' };
  const thresholds = [t1, t2, t3];

  it('band 1: value below all thresholds → undefined', () => {
    expect(resolveThreshold(5, thresholds, 'scalar')).toBeUndefined();
  });

  it('band 2: value matches only t1 → t1', () => {
    expect(resolveThreshold(15, thresholds, 'scalar')).toBe(t1);
  });

  it('band 3: value matches t1+t2, closer to t2 → t2', () => {
    // value=22: dist(22,10)=12, dist(22,20)=2 → t2
    expect(resolveThreshold(22, thresholds, 'scalar')).toBe(t2);
  });

  it('band 4: value matches all three, closer to t3 → t3', () => {
    // value=32: dist(32,10)=22, dist(32,20)=12, dist(32,30)=2 → t3
    expect(resolveThreshold(32, thresholds, 'scalar')).toBe(t3);
  });

  it('band 5: value far above all, t3 still closest → t3', () => {
    // value=100: dist=90,80,70 → t3
    expect(resolveThreshold(100, thresholds, 'scalar')).toBe(t3);
  });

  it('below operator: 5 bands, closest-below wins', () => {
    const b1: ThresholdRule = { operator: 'below', value: 0, background_color: 'darkblue' };
    const b2: ThresholdRule = { operator: 'below', value: -10, background_color: 'blue' };
    const b3: ThresholdRule = { operator: 'below', value: -20, background_color: 'lightblue' };
    const bs = [b1, b2, b3];
    expect(resolveThreshold(5, bs, 'scalar')).toBeUndefined();    // none match
    expect(resolveThreshold(-1, bs, 'scalar')).toBe(b1);           // only b1
    expect(resolveThreshold(-7, bs, 'scalar')).toBe(b1);           // only b1 matches (-7 not below -10)
    // dist(-12, 0)=12, dist(-12,-10)=2 → b2 wins (b2 matches since -12 < -10)
    expect(resolveThreshold(-12, bs, 'scalar')).toBe(b2);
    expect(resolveThreshold(-15, bs, 'scalar')).toBe(b2);          // b1+b2+b3; closest = b2(dist 5) vs b3(dist 5)... tie!
    // Actually dist(-15,0)=15, dist(-15,-10)=5, dist(-15,-20)=5 → equidistant b2 and b3
    // Tie-break: higher value wins → b2 (value=-10 > value=-20)
    expect(resolveThreshold(-25, bs, 'scalar')).toBe(b3);
  });
});

describe('resolveThreshold — tie-break', () => {
  it('primary: equidistant → higher t.value wins', () => {
    // value=15, not-below:10 (15>=10 ✓, dist=5) and not-above:20 (15<=20 ✓, dist=5) → higher t.value=20 wins
    const t10: ThresholdRule = { operator: 'not-below', value: 10, background_color: 'yellow' };
    const t20: ThresholdRule = { operator: 'not-above', value: 20, background_color: 'orange' };
    expect(resolveThreshold(15, [t10, t20], 'scalar')).toBe(t20);
    // order irrelevant
    expect(resolveThreshold(15, [t20, t10], 'scalar')).toBe(t20);
  });

  it('secondary: equidistant + same t.value → first-defined wins', () => {
    // not-below:20 (first) and above:20 (second): both t.value=20
    // min cell, value=21: dist=1 each, same value=20 → first-defined wins
    const nb: ThresholdRule = { operator: 'not-below', value: 20, background_color: 'pink' };
    const ab: ThresholdRule = { operator: 'above', value: 20, background_color: 'orange' };
    expect(resolveThreshold(21, [nb, ab], 'min')).toBe(nb);
    expect(resolveThreshold(21, [ab, nb], 'min')).toBe(ab);
  });
});

describe('resolveThreshold — not-below cell role filtering', () => {
  const rule: ThresholdRule = { operator: 'not-below', value: 10, background_color: 'lime' };

  it('min role + value >= threshold → matches', () => {
    expect(resolveThreshold(15, [rule], 'min')).toBe(rule);
  });

  it('min role + value < threshold → no match', () => {
    expect(resolveThreshold(5, [rule], 'min')).toBeUndefined();
  });

  it('avg role → excluded (never matches)', () => {
    expect(resolveThreshold(100, [rule], 'avg')).toBeUndefined();
  });

  it('max role → excluded (never matches)', () => {
    expect(resolveThreshold(100, [rule], 'max')).toBeUndefined();
  });

  it('scalar role → matches', () => {
    expect(resolveThreshold(15, [rule], 'scalar')).toBe(rule);
  });

  it('summary-min role → matches', () => {
    expect(resolveThreshold(15, [rule], 'summary-min')).toBe(rule);
  });

  it('summary-avg role → excluded', () => {
    expect(resolveThreshold(100, [rule], 'summary-avg')).toBeUndefined();
  });

  it('summary-max role → excluded', () => {
    expect(resolveThreshold(100, [rule], 'summary-max')).toBeUndefined();
  });

  it('summary-scalar role → matches', () => {
    expect(resolveThreshold(15, [rule], 'summary-scalar')).toBe(rule);
  });
});

describe('resolveThreshold — not-above cell role filtering', () => {
  const rule: ThresholdRule = { operator: 'not-above', value: 25, background_color: 'green' };

  it('max role + value <= threshold → matches', () => {
    expect(resolveThreshold(20, [rule], 'max')).toBe(rule);
  });

  it('max role + value > threshold → no match', () => {
    expect(resolveThreshold(30, [rule], 'max')).toBeUndefined();
  });

  it('avg role → excluded (never matches)', () => {
    expect(resolveThreshold(0, [rule], 'avg')).toBeUndefined();
  });

  it('min role → excluded (never matches)', () => {
    expect(resolveThreshold(0, [rule], 'min')).toBeUndefined();
  });

  it('scalar role → matches', () => {
    expect(resolveThreshold(20, [rule], 'scalar')).toBe(rule);
  });

  it('summary-max role → matches', () => {
    expect(resolveThreshold(20, [rule], 'summary-max')).toBe(rule);
  });

  it('summary-avg role → excluded', () => {
    expect(resolveThreshold(0, [rule], 'summary-avg')).toBeUndefined();
  });

  it('summary-min role → excluded', () => {
    expect(resolveThreshold(0, [rule], 'summary-min')).toBeUndefined();
  });

  it('summary-scalar role → matches', () => {
    expect(resolveThreshold(20, [rule], 'summary-scalar')).toBe(rule);
  });
});

// --- scope filtering (feature 015) ---

describe('resolveThreshold — scope filtering', () => {
  const dayRule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };
  const dayExplicit: ThresholdRule = { operator: 'above', value: 10, scope: 'day', background_color: 'darkred' };
  const monthRule: ThresholdRule = { operator: 'above', value: 150, scope: 'month', background_color: 'blue' };
  const yearRule: ThresholdRule = { operator: 'above', value: 1200, scope: 'year', background_color: 'purple' };

  it('scope-less rule matches day cells (default cellScope)', () => {
    expect(resolveThreshold(15, [dayRule], 'scalar')).toBe(dayRule);
  });

  it('scope-less rule matches explicit day cells', () => {
    expect(resolveThreshold(15, [dayRule], 'scalar', 'day')).toBe(dayRule);
  });

  it('scope-less rule does NOT match month cells', () => {
    expect(resolveThreshold(200, [dayRule], 'scalar', 'month')).toBeUndefined();
  });

  it('scope-less rule does NOT match year cells', () => {
    expect(resolveThreshold(2000, [dayRule], 'scalar', 'year')).toBeUndefined();
  });

  it('explicit day rule behaves like scope-less rule', () => {
    expect(resolveThreshold(15, [dayExplicit], 'scalar', 'day')).toBe(dayExplicit);
    expect(resolveThreshold(200, [dayExplicit], 'scalar', 'month')).toBeUndefined();
  });

  it('month rule matches month cells only', () => {
    expect(resolveThreshold(200, [monthRule], 'scalar', 'month')).toBe(monthRule);
    expect(resolveThreshold(200, [monthRule], 'scalar', 'day')).toBeUndefined();
    expect(resolveThreshold(2000, [monthRule], 'scalar', 'year')).toBeUndefined();
  });

  it('year rule matches year cells only', () => {
    expect(resolveThreshold(1300, [yearRule], 'scalar', 'year')).toBe(yearRule);
    expect(resolveThreshold(1300, [yearRule], 'scalar', 'day')).toBeUndefined();
    expect(resolveThreshold(1300, [yearRule], 'scalar', 'month')).toBeUndefined();
  });

  it('invalid scope string behaves as day', () => {
    const invalid = { operator: 'above', value: 10, scope: 'weekly', background_color: 'red' } as unknown as ThresholdRule;
    expect(resolveThreshold(15, [invalid], 'scalar', 'day')).toBe(invalid);
    expect(resolveThreshold(200, [invalid], 'scalar', 'month')).toBeUndefined();
  });

  it('summary roles obey scope too', () => {
    expect(resolveThreshold(200, [dayRule], 'summary-scalar', 'month')).toBeUndefined();
    expect(resolveThreshold(200, [monthRule], 'summary-scalar', 'month')).toBe(monthRule);
  });

  it('not-below/not-above role exclusions still apply within a scope', () => {
    const nb: ThresholdRule = { operator: 'not-below', value: 100, scope: 'month', background_color: 'lime' };
    expect(resolveThreshold(200, [nb], 'scalar', 'month')).toBe(nb);
    expect(resolveThreshold(200, [nb], 'avg', 'month')).toBeUndefined();
    expect(resolveThreshold(200, [nb], 'max', 'month')).toBeUndefined();
  });
});

describe('resolveThreshold — closest-wins within scope (mixed lists, 3+ bands per scope)', () => {
  const d1: ThresholdRule = { operator: 'above', value: 5, background_color: 'd-yellow' };
  const d2: ThresholdRule = { operator: 'above', value: 10, background_color: 'd-orange' };
  const d3: ThresholdRule = { operator: 'above', value: 20, background_color: 'd-red' };
  const m1: ThresholdRule = { operator: 'above', value: 100, scope: 'month', background_color: 'm-yellow' };
  const m2: ThresholdRule = { operator: 'above', value: 150, scope: 'month', background_color: 'm-orange' };
  const m3: ThresholdRule = { operator: 'above', value: 200, scope: 'month', background_color: 'm-red' };
  const y1: ThresholdRule = { operator: 'above', value: 1000, scope: 'year', background_color: 'y-orange' };
  const y2: ThresholdRule = { operator: 'above', value: 1500, scope: 'year', background_color: 'y-red' };
  const mixed = [d1, d2, d3, m1, m2, m3, y1, y2];

  it('day cell: ranks among day rules only', () => {
    expect(resolveThreshold(4, mixed, 'scalar', 'day')).toBeUndefined();
    expect(resolveThreshold(7, mixed, 'scalar', 'day')).toBe(d1);
    expect(resolveThreshold(12, mixed, 'scalar', 'day')).toBe(d2);
    expect(resolveThreshold(30, mixed, 'scalar', 'day')).toBe(d3);
  });

  it('day cell: high value never picks a month/year rule', () => {
    // 120 is above m1's 100, but m1 has month scope; d3 (20) is the closest day rule
    expect(resolveThreshold(120, mixed, 'scalar', 'day')).toBe(d3);
  });

  it('month cell: ranks among month rules only', () => {
    expect(resolveThreshold(90, mixed, 'scalar', 'month')).toBeUndefined();
    expect(resolveThreshold(110, mixed, 'scalar', 'month')).toBe(m1);
    expect(resolveThreshold(160, mixed, 'scalar', 'month')).toBe(m2);
    expect(resolveThreshold(500, mixed, 'scalar', 'month')).toBe(m3);
  });

  it('month cell: value above all day rules but below all month rules → undefined', () => {
    expect(resolveThreshold(50, mixed, 'scalar', 'month')).toBeUndefined();
  });

  it('year cell: ranks among year rules only', () => {
    expect(resolveThreshold(900, mixed, 'scalar', 'year')).toBeUndefined();
    expect(resolveThreshold(1100, mixed, 'scalar', 'year')).toBe(y1);
    expect(resolveThreshold(1600, mixed, 'scalar', 'year')).toBe(y2);
  });

  it('tie-break still works within a scope', () => {
    // month cell, value 175: above:150 (dist 25) and below:200 (dist 25) both match
    // → equidistant → higher threshold value wins → the below:200 rule
    const mBelow: ThresholdRule = { operator: 'below', value: 200, scope: 'month', background_color: 'm-blue' };
    expect(resolveThreshold(175, [m1, m2, mBelow], 'scalar', 'month')).toBe(mBelow);
  });
});

// --- buildCellStyle ---

describe('buildCellStyle', () => {
  it('static colors only, no threshold → style string with static colors', () => {
    expect(buildCellStyle('blue', 'gray', undefined)).toBe('color:blue;background-color:gray');
  });

  it('no static, no threshold → undefined', () => {
    expect(buildCellStyle(undefined, undefined, undefined)).toBeUndefined();
  });

  it('threshold overrides both colors', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, text_color: 'white', background_color: 'red' };
    expect(buildCellStyle('black', 'gray', rule)).toBe('color:white;background-color:red');
  });

  it('threshold overrides text only; background stays static', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, text_color: 'white' };
    expect(buildCellStyle('black', 'gray', rule)).toBe('color:white;background-color:gray');
  });

  it('threshold overrides background only; text stays static', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };
    expect(buildCellStyle('black', 'gray', rule)).toBe('color:black;background-color:red');
  });

  it('no static + threshold with only text_color → just text', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, text_color: 'blue' };
    expect(buildCellStyle(undefined, undefined, rule)).toBe('color:blue');
  });

  it('no static + threshold with only background_color → just background', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };
    expect(buildCellStyle(undefined, undefined, rule)).toBe('background-color:red');
  });

  it('static text only, no threshold → only text in style', () => {
    expect(buildCellStyle('green', undefined, undefined)).toBe('color:green');
  });

  it('both undefined + threshold with no color → undefined (ThresholdRule filtered upstream, but test defensive)', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10 };
    // threshold has no color fields; buildCellStyle doesn't filter — it just won't add anything
    expect(buildCellStyle(undefined, undefined, rule)).toBeUndefined();
  });

  // --- autoTextColor (4th param) ---

  it('autoText injected when bg set and no explicit text', () => {
    expect(buildCellStyle(undefined, '#cce8f5', undefined, '#000000'))
      .toBe('color:#000000;background-color:#cce8f5');
  });

  it('autoText applies to threshold background when no text', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, background_color: '#8b0000' };
    expect(buildCellStyle(undefined, undefined, rule, '#ffffff'))
      .toBe('color:#ffffff;background-color:#8b0000');
  });

  it('explicit static text_color wins over autoText', () => {
    expect(buildCellStyle('black', '#cce8f5', undefined, '#000000'))
      .toBe('color:black;background-color:#cce8f5');
  });

  it('explicit threshold text_color wins over autoText', () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, text_color: 'blue', background_color: '#8b0000' };
    expect(buildCellStyle(undefined, undefined, rule, '#ffffff'))
      .toBe('color:blue;background-color:#8b0000');
  });

  it('autoText ignored when no background', () => {
    expect(buildCellStyle(undefined, undefined, undefined, '#000000')).toBeUndefined();
  });
});
