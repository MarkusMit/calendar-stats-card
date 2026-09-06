import { describe, it, expect } from 'vitest';
import { rowLabel } from '../../../src/services/row-label';
import type { EntityRowConfig, ExpressionRowConfig } from '../../../src/types/card-config';
import type { EntityMetadata } from '../../../src/types/statistics';

function meta(overrides: Partial<EntityMetadata> = {}): EntityMetadata {
  return {
    entityId: 'sensor.temp',
    stateClass: 'measurement',
    deviceClass: 'temperature',
    unitOfMeasurement: '°C',
    friendlyName: 'Outdoor temperature',
    hasStatistics: true,
    ...overrides,
  };
}

describe('rowLabel — name resolution', () => {
  it('config name wins over the friendly name', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature' };
    expect(rowLabel(cfg, meta())).toBe('Temperature [°C]');
  });

  it('friendly name is used when the config has no name', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp' };
    expect(rowLabel(cfg, meta())).toBe('Outdoor temperature [°C]');
  });

  it('falls back to the entity id when neither name is available', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp' };
    expect(rowLabel(cfg, meta({ friendlyName: null }))).toBe('sensor.temp [°C]');
  });

  it('expression row without a name has an empty name part', () => {
    const cfg: ExpressionRowConfig = { expression: 'a + b' };
    expect(rowLabel(cfg, undefined)).toBe('');
  });

  it('expression row uses its config name', () => {
    const cfg: ExpressionRowConfig = { expression: 'a + b', name: 'Sum' };
    expect(rowLabel(cfg, undefined)).toBe('Sum');
  });
});

describe('rowLabel — unit', () => {
  it('config unit wins over the metadata unit', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature', unit: 'K' };
    expect(rowLabel(cfg, meta())).toBe('Temperature [K]');
  });

  it('metadata unit is used when the config has none', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature' };
    expect(rowLabel(cfg, meta({ unitOfMeasurement: 'mm' }))).toBe('Temperature [mm]');
  });

  it('no unit anywhere → no brackets', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature' };
    expect(rowLabel(cfg, meta({ unitOfMeasurement: null }))).toBe('Temperature');
  });

  it('no metadata at all → name only', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature' };
    expect(rowLabel(cfg, undefined)).toBe('Temperature');
  });

  it('empty config unit falls back to the metadata unit', () => {
    const cfg: EntityRowConfig = { entity: 'sensor.temp', name: 'Temperature', unit: '' };
    expect(rowLabel(cfg, meta())).toBe('Temperature [°C]');
  });
});
