import { describe, it, expect } from 'vitest';
import { statisticsSignature } from '../../../src/services/config-signature';
import type { EntityConfig } from '../../../src/types/card-config';

const base: EntityConfig[] = [
  { entity: 'sensor.rain', show_zero: false },
  { expression: 'sensor.a + sensor.b', unit: 'kWh' },
];

/** Same signature ⇒ the fetched statistics stay valid. */
function same(changed: EntityConfig[]): boolean {
  return statisticsSignature(changed) === statisticsSignature(base);
}

describe('statisticsSignature', () => {
  it('is stable across separately built but equal configs', () => {
    expect(same([{ entity: 'sensor.rain', show_zero: false }, { expression: 'sensor.a + sensor.b', unit: 'kWh' }])).toBe(true);
  });

  it('ignores the order the row fields were written in', () => {
    expect(same([{ show_zero: false, entity: 'sensor.rain' }, { unit: 'kWh', expression: 'sensor.a + sensor.b' }])).toBe(true);
  });

  it('treats an explicit undefined as an absent field', () => {
    expect(same([{ entity: 'sensor.rain', show_zero: false, name: undefined }, { expression: 'sensor.a + sensor.b', unit: 'kWh' }])).toBe(true);
  });

  describe('changes that invalidate fetched statistics', () => {
    it('a different entity id', () => {
      expect(same([{ entity: 'sensor.other', show_zero: false }, base[1]!])).toBe(false);
    });

    it('a different expression', () => {
      expect(same([base[0]!, { expression: 'sensor.a - sensor.b', unit: 'kWh' }])).toBe(false);
    });

    it('reordered rows, because monthly summaries are keyed by row index', () => {
      expect(same([base[1]!, base[0]!])).toBe(false);
    });

    it('an added row', () => {
      expect(same([...base, { entity: 'sensor.new' }])).toBe(false);
    });

    it('a removed row', () => {
      expect(same([base[0]!])).toBe(false);
    });

    it('show_zero, which the monthly transform reads', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: true }, base[1]!])).toBe(false);
    });

    it('state_class, which decides the cumulative kind', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, state_class: 'total' }, base[1]!])).toBe(false);
    });

    it('predecessors, which are stitched into the daily values', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, predecessors: [{ entity: 'sensor.old' }] }, base[1]!])).toBe(false);
    });

    it('name and unit, which are baked into an expression row metadata', () => {
      expect(same([base[0]!, { expression: 'sensor.a + sensor.b', unit: 'Wh' }])).toBe(false);
      expect(same([base[0]!, { expression: 'sensor.a + sensor.b', unit: 'kWh', name: 'Total' }])).toBe(false);
    });
  });

  describe('changes that only affect rendering', () => {
    it('precision', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, precision: 3 }, base[1]!])).toBe(true);
    });

    it('factor', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, factor: 0.5 }, base[1]!])).toBe(true);
    });

    it('colors', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, text_color: 'red', background_color: 'blue' }, base[1]!])).toBe(true);
    });

    it('thresholds', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, thresholds: [{ operator: 'above', value: 5, background_color: 'red' }] }, base[1]!])).toBe(true);
    });

    it('sub-row visibility', () => {
      expect(same([{ entity: 'sensor.rain', show_zero: false, show_min: false, show_avg: false, show_max: false }, base[1]!])).toBe(true);
    });
  });
});
