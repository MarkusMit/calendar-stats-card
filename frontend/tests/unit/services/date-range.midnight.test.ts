import { describe, it, expect } from 'vitest';
import { msUntilNextMidnight } from '../../../src/services/date-range';

const HOUR = 3600_000;
const MINUTE = 60_000;

describe('msUntilNextMidnight', () => {
  it('counts the remainder of the day in the given time zone', () => {
    // 2025-06-15T21:30:00Z is 23:30 in Vienna (UTC+2 in summer) → 30 minutes left.
    expect(msUntilNextMidnight('Europe/Vienna', Date.UTC(2025, 5, 15, 21, 30))).toBe(30 * MINUTE);
  });

  it('is time-zone aware: the same instant differs per zone', () => {
    const instant = Date.UTC(2025, 5, 15, 21, 30);
    expect(msUntilNextMidnight('UTC', instant)).toBe(2 * HOUR + 30 * MINUTE);
  });

  it('returns a full day right after midnight', () => {
    expect(msUntilNextMidnight('UTC', Date.UTC(2025, 5, 15, 0, 0))).toBe(24 * HOUR);
  });

  it('never returns zero or a negative delay', () => {
    for (let h = 0; h < 24; h++) {
      const delay = msUntilNextMidnight('Europe/Vienna', Date.UTC(2025, 0, 10, h, 59, 59));
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(24 * HOUR);
    }
  });
});
