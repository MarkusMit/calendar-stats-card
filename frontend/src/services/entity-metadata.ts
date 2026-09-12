import type { HassEntityAttributes } from '../types/ha-types';
import type { EntityMetadata } from '../types/statistics';
import type { CumulativeStateClass } from '../types/card-config';
import type { StatisticMetaEntry } from './statistics-service';

const KNOWN_STATE_CLASSES = new Set(['measurement', 'total_increasing', 'total']);

/**
 * Resolve a row's metadata from, in order of precedence: the config
 * `state_class` override, the entity's state attributes, and HA statistics
 * metadata. External statistics (`domain:object_id`) have no state object,
 * so their kind, unit and name come from the metadata entry.
 */
export function resolveEntityMetadata(
  entityId: string,
  stateAttrs: HassEntityAttributes | undefined,
  statMeta: StatisticMetaEntry | undefined,
  cfgStateClass: CumulativeStateClass | undefined,
): EntityMetadata {
  let stateClass: EntityMetadata['stateClass'] = 'unknown';
  const attrClass = stateAttrs?.state_class;
  if (cfgStateClass) {
    stateClass = cfgStateClass;
  } else if (attrClass && KNOWN_STATE_CLASSES.has(attrClass)) {
    stateClass = attrClass as EntityMetadata['stateClass'];
  } else if (statMeta?.has_sum) {
    stateClass = 'total';
  } else if (statMeta && statMeta.mean_type > 0) {
    stateClass = 'measurement';
  }

  return {
    entityId,
    stateClass,
    deviceClass: stateAttrs?.device_class ?? null,
    unitOfMeasurement: stateAttrs?.unit_of_measurement ?? statMeta?.statistics_unit_of_measurement ?? null,
    friendlyName: stateAttrs?.friendly_name ?? statMeta?.name ?? null,
    hasStatistics: statMeta != null,
  };
}
