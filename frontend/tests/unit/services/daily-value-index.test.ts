import { describe, it, expect } from 'vitest';
import { DailyValueIndex } from '../../../src/services/daily-value-index';
import type { DailyValue } from '../../../src/types/statistics';

const cumulative = (entityId: string, date: string, sum: number): DailyValue =>
  ({ kind: 'cumulative', entityId, date, sum });

describe('DailyValueIndex', () => {
  it('stores and reads a value by row key and date', () => {
    const index = new DailyValueIndex();
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 4));
    expect(index.get('sensor.rain', '2025-06-01')).toEqual(cumulative('sensor.rain', '2025-06-01', 4));
  });

  it('returns undefined for an unknown row or an unknown date', () => {
    const index = new DailyValueIndex();
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 4));
    expect(index.get('sensor.other', '2025-06-01')).toBeUndefined();
    expect(index.get('sensor.rain', '2025-06-02')).toBeUndefined();
  });

  it('overwrites a value written twice for the same row and date', () => {
    const index = new DailyValueIndex();
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 4));
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 9));
    expect(index.get('sensor.rain', '2025-06-01')?.kind === 'cumulative'
      && index.get('sensor.rain', '2025-06-01')).toMatchObject({ sum: 9 });
  });

  it('exposes one row as a date-keyed map', () => {
    const index = new DailyValueIndex();
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 4));
    index.set('sensor.rain', '2025-06-02', cumulative('sensor.rain', '2025-06-02', 7));
    index.set('sensor.temp', '2025-06-01', cumulative('sensor.temp', '2025-06-01', 1));

    const row = index.row('sensor.rain');
    expect([...row!.keys()]).toEqual(['2025-06-01', '2025-06-02']);
    expect(index.row('sensor.missing')).toBeUndefined();
  });

  it('keeps a row key that contains :: itself, as expression row keys do', () => {
    const index = new DailyValueIndex();
    index.set('a::b + c::d', '2025-06-01', cumulative('a::b + c::d', '2025-06-01', 2));
    expect(index.get('a::b + c::d', '2025-06-01')?.kind).toBe('cumulative');
    expect([...index.rowKeys()]).toEqual(['a::b + c::d']);
  });

  it('clones into an independent index', () => {
    const index = new DailyValueIndex();
    index.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 4));

    const copy = index.clone();
    copy.set('sensor.rain', '2025-06-01', cumulative('sensor.rain', '2025-06-01', 99));
    copy.set('sensor.rain', '2025-06-02', cumulative('sensor.rain', '2025-06-02', 1));

    expect(index.get('sensor.rain', '2025-06-01')).toMatchObject({ sum: 4 });
    expect(index.get('sensor.rain', '2025-06-02')).toBeUndefined();
    expect(copy.get('sensor.rain', '2025-06-01')).toMatchObject({ sum: 99 });
  });

  it('lists its row keys', () => {
    const index = new DailyValueIndex();
    index.set('sensor.a', '2025-06-01', cumulative('sensor.a', '2025-06-01', 1));
    index.set('sensor.b', '2025-06-01', cumulative('sensor.b', '2025-06-01', 2));
    expect([...index.rowKeys()]).toEqual(['sensor.a', 'sensor.b']);
  });
});
