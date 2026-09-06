import type { EntityConfig } from '../types/card-config';
import type { EntityMetadata } from '../types/statistics';

/**
 * Display label for a configured row, unit included — "Temperature [°C]".
 * Shared by the legend groups and the threshold exceedance table so the two
 * always name a row identically.
 */
export function rowLabel(cfg: EntityConfig, meta: EntityMetadata | undefined): string {
  const name = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
  const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
  return unitStr ? `${name} [${unitStr}]` : name;
}
