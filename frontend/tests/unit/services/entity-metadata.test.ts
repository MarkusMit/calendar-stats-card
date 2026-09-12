import { describe, it, expect } from 'vitest';
import { resolveEntityMetadata } from '../../../src/services/entity-metadata';
import type { StatisticMetaEntry } from '../../../src/services/statistics-service';

const SUM_META: StatisticMetaEntry = {
  statistic_id: 'tibber:consumption',
  statistics_unit_of_measurement: 'kWh',
  display_unit_of_measurement: 'Wh',
  unit_class: 'energy',
  has_sum: true,
  mean_type: 0,
  name: 'Tibber',
  source: 'tibber',
};

const MEAN_META: StatisticMetaEntry = {
  statistic_id: 'forecast:temp',
  statistics_unit_of_measurement: '°C',
  unit_class: 'temperature',
  has_sum: false,
  mean_type: 1,
  name: null,
  source: 'forecast',
};

describe('resolveEntityMetadata — entity-backed rows', () => {
  it('uses hass.states attributes when present', () => {
    const meta = resolveEntityMetadata(
      'sensor.temp',
      { state_class: 'measurement', unit_of_measurement: '°F', friendly_name: 'Outdoor', device_class: 'temperature' },
      MEAN_META,
      undefined,
    );
    expect(meta).toEqual({
      entityId: 'sensor.temp',
      stateClass: 'measurement',
      deviceClass: 'temperature',
      unitOfMeasurement: '°F',
      friendlyName: 'Outdoor',
      hasStatistics: true,
    });
  });

  it('falls through to metadata when the state attribute state_class is unrecognised', () => {
    const meta = resolveEntityMetadata('sensor.x', { state_class: 'bogus' }, SUM_META, undefined);
    expect(meta.stateClass).toBe('total');
  });

  it('lets config state_class override the state attribute', () => {
    const meta = resolveEntityMetadata('sensor.x', { state_class: 'total' }, SUM_META, 'total_increasing');
    expect(meta.stateClass).toBe('total_increasing');
  });
});

describe('resolveEntityMetadata — external statistics (no state object)', () => {
  it('derives total from has_sum', () => {
    const meta = resolveEntityMetadata('tibber:consumption', undefined, SUM_META, undefined);
    expect(meta.stateClass).toBe('total');
  });

  it('derives measurement from mean_type without sum', () => {
    const meta = resolveEntityMetadata('forecast:temp', undefined, MEAN_META, undefined);
    expect(meta.stateClass).toBe('measurement');
  });

  it('prefers total when both sum and mean exist', () => {
    const meta = resolveEntityMetadata('x:y', undefined, { ...MEAN_META, has_sum: true }, undefined);
    expect(meta.stateClass).toBe('total');
  });

  it('applies config total_increasing to external statistics', () => {
    const meta = resolveEntityMetadata('tibber:consumption', undefined, SUM_META, 'total_increasing');
    expect(meta.stateClass).toBe('total_increasing');
  });

  it('uses the statistics unit, not the display unit', () => {
    const meta = resolveEntityMetadata('tibber:consumption', undefined, SUM_META, undefined);
    expect(meta.unitOfMeasurement).toBe('kWh');
  });

  it('uses the metadata name as friendly name', () => {
    const meta = resolveEntityMetadata('tibber:consumption', undefined, SUM_META, undefined);
    expect(meta.friendlyName).toBe('Tibber');
  });

  it('yields null name and device class when metadata carries none', () => {
    const meta = resolveEntityMetadata('forecast:temp', undefined, MEAN_META, undefined);
    expect(meta.friendlyName).toBeNull();
    expect(meta.deviceClass).toBeNull();
  });
});

describe('resolveEntityMetadata — missing metadata', () => {
  it('marks hasStatistics false and stateClass unknown without state or metadata', () => {
    const meta = resolveEntityMetadata('sensor.gone', undefined, undefined, undefined);
    expect(meta).toEqual({
      entityId: 'sensor.gone',
      stateClass: 'unknown',
      deviceClass: null,
      unitOfMeasurement: null,
      friendlyName: null,
      hasStatistics: false,
    });
  });

  it('marks hasStatistics false even when the entity exists in hass.states', () => {
    const meta = resolveEntityMetadata('sensor.nostats', { state_class: 'measurement', unit_of_measurement: '°C' }, undefined, undefined);
    expect(meta.hasStatistics).toBe(false);
    expect(meta.stateClass).toBe('measurement');
    expect(meta.unitOfMeasurement).toBe('°C');
  });
});
