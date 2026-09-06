import { describe, it, expect } from 'vitest';
import { operatorSymbol } from '../../../src/services/threshold-operator';
import type { ThresholdOperator } from '../../../src/types/card-config';

const ALL: ThresholdOperator[] = ['above', 'equals-above', 'equals-below', 'below', 'not-below', 'not-above'];

describe('operatorSymbol', () => {
  it('renders every operator with its own symbol', () => {
    const symbols = ALL.map((op) => operatorSymbol(op, 'en'));
    expect(new Set(symbols).size).toBe(ALL.length);
  });

  it('distinguishes not-below from equals-above', () => {
    expect(operatorSymbol('not-below', 'en')).not.toBe(operatorSymbol('equals-above', 'en'));
  });

  it('distinguishes not-above from equals-below', () => {
    expect(operatorSymbol('not-above', 'en')).not.toBe(operatorSymbol('equals-below', 'en'));
  });

  it('marks the cell the min/max operators target', () => {
    // ↓ and ↑ are the min/max markers the summary cells already use.
    expect(operatorSymbol('not-below', 'en')).toBe('↓≥');
    expect(operatorSymbol('not-above', 'en')).toBe('↑≤');
  });

  it('keeps the plain comparison symbols unchanged', () => {
    expect(operatorSymbol('above', 'en')).toBe('>');
    expect(operatorSymbol('below', 'en')).toBe('<');
    expect(operatorSymbol('equals-above', 'en')).toBe('≥');
    expect(operatorSymbol('equals-below', 'en')).toBe('≤');
  });

  it('uses the same symbols in German', () => {
    for (const op of ALL) expect(operatorSymbol(op, 'de')).toBe(operatorSymbol(op, 'en'));
  });
});
