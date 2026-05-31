import { describe, it, expect } from 'vitest';
import { DEFAULT_PRECISION, resolvePrecision } from '../../../src/components/year-table';

describe('resolvePrecision / DEFAULT_PRECISION', () => {
  it('defaults to 1 decimal place', () => {
    expect(DEFAULT_PRECISION).toBe(1);
  });

  it('returns the default when precision is unset', () => {
    expect(resolvePrecision({})).toBe(1);
  });

  it('passes an explicit precision through', () => {
    expect(resolvePrecision({ precision: 2 })).toBe(2);
  });

  it('honors an explicit precision of 0', () => {
    expect(resolvePrecision({ precision: 0 })).toBe(0);
  });
});
