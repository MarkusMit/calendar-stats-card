import type { EntityConfig } from '../types/card-config';
import type { DailyValue, EntityMetadata } from '../types/statistics';

export function resolvePredecessorData(
  entityConfigs: EntityConfig[],
  dailyValues: Map<string, DailyValue>,
  metadataMap: Record<string, EntityMetadata>,
  warnedPredecessors: Set<string>,
): Map<string, DailyValue> {
  const result = new Map(dailyValues);

  for (const cfg of entityConfigs) {
    if (!('entity' in cfg) || !cfg.predecessors?.length) continue;

    const mainId = cfg.entity;
    const mainMeta = metadataMap[mainId];
    if (!mainMeta) continue;

    // Filter compatible predecessors; absent metadata → skip silently (FR-008)
    const compatible = cfg.predecessors.filter((pred) => {
      const predMeta = metadataMap[pred.entity];
      if (!predMeta) return false;
      const stateClassOk = predMeta.stateClass === mainMeta.stateClass;
      // unit check bypassed when factor is configured (FR-011 / FR-015)
      const unitOk = pred.factor != null || predMeta.unitOfMeasurement === mainMeta.unitOfMeasurement;
      const ok = stateClassOk && unitOk;
      if (!ok && !warnedPredecessors.has(pred.entity)) {
        console.warn(
          `[tabularizer] predecessor ${pred.entity}: state_class or unit_of_measurement mismatch, skipping`,
        );
        warnedPredecessors.add(pred.entity);
      }
      return ok;
    });

    if (!compatible.length) continue;

    const dated = compatible
      .filter((p) => p.replaced_on != null)
      .sort((a, b) => a.replaced_on!.localeCompare(b.replaced_on!));
    const undated = compatible.filter((p) => p.replaced_on == null);

    const predIds = new Set(compatible.map((p) => p.entity));

    // Collect all dates touched by predecessor entries or main entity entries
    const dates = new Set<string>();
    for (const key of result.keys()) {
      const sep = key.indexOf('::');
      if (sep === -1) continue;
      const entityId = key.slice(0, sep);
      const date = key.slice(sep + 2);
      if (predIds.has(entityId) || entityId === mainId) dates.add(date);
    }

    const applyFactor = (v: DailyValue, factor: number | undefined): DailyValue => {
      if (factor == null) return v;
      if (v.kind === 'cumulative') return { ...v, sum: v.sum * factor };
      if (v.kind === 'measurement') return { ...v, mean: v.mean * factor, min: v.min * factor, max: v.max * factor };
      return v;
    };

    for (const date of dates) {
      // Find active dated predecessor: first (oldest) whose replaced_on is strictly after date
      const activeDated = dated.find((p) => p.replaced_on! > date);

      if (activeDated) {
        const predValue = result.get(`${activeDated.entity}::${date}`);
        if (predValue && predValue.kind !== 'empty') {
          result.set(`${mainId}::${date}`, { ...applyFactor(predValue, activeDated.factor), entityId: mainId });
        }
        // If dated predecessor has no data → leave main key unchanged (no fallback)
      } else {
        // Main entity range: use main data unless missing/empty, then try undated fallbacks
        const mainValue = result.get(`${mainId}::${date}`);
        if (!mainValue || mainValue.kind === 'empty') {
          for (const pred of undated) {
            const predValue = result.get(`${pred.entity}::${date}`);
            if (predValue && predValue.kind !== 'empty') {
              result.set(`${mainId}::${date}`, { ...applyFactor(predValue, pred.factor), entityId: mainId });
              break;
            }
          }
        }
      }
    }
  }

  return result;
}
