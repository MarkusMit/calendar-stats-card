import { describe, it, expect } from 'vitest';
import { ThresholdLegendCollector } from '../../../src/services/threshold-legend';
import type { ThresholdRule } from '../../../src/types/card-config';

const hot: ThresholdRule = { operator: 'above', value: 30, name: 'Hot', background_color: 'red' };
const cold: ThresholdRule = { operator: 'below', value: 0, name: 'Cold', background_color: 'blue' };

describe('ThresholdLegendCollector', () => {
  it('reports the groups it collected, keyed by row label', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature [°C]', hot);
    expect(collector.changes()).toEqual([{ label: 'Temperature [°C]', rules: [hot] }]);
  });

  it('keeps rows in config order, whatever order they triggered in', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'first', hot);
    collector.add(2, 'third', cold);
    expect(collector.changes()?.map((g) => g.label)).toEqual(['first', 'third']);
  });

  it('dedupes a rule triggered by many cells', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    for (let i = 0; i < 500; i++) collector.add(0, 'Temperature', hot);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot] }]);
  });

  it('reports nothing when a re-collection found the same rules', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    expect(collector.changes()).not.toBeNull();

    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    expect(collector.changes()).toBeNull();
  });

  it('reports nothing when asked twice without re-collecting', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.changes();
    expect(collector.changes()).toBeNull();
  });

  it('reports an added rule', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.changes();

    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.add(0, 'Temperature', cold);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot, cold] }]);
  });

  it('reports a row that stopped triggering', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.add(1, 'Rain', cold);
    collector.changes();

    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot] }]);
  });

  it('reports a renamed row', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.changes();

    collector.beginSection(0);
    collector.add(0, 'Temperature [°C]', hot);
    expect(collector.changes()?.[0]?.label).toBe('Temperature [°C]');
  });

  it('reports an emptied collection once, then stays quiet', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.changes();

    collector.beginSection(0);
    expect(collector.changes()).toEqual([]);
    collector.beginSection(0);
    expect(collector.changes()).toBeNull();
  });
});

describe('ThresholdLegendCollector — sections', () => {
  it('keeps the rules of a section that did not re-collect', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.beginSection(1);
    collector.add(0, 'Temperature', cold);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot, cold] }]);

    // Only section 1 renders again; section 0 keeps what it found.
    collector.beginSection(1);
    collector.add(0, 'Temperature', cold);
    expect(collector.changes()).toBeNull();
  });

  it('replaces only the re-collected section', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.beginSection(1);
    collector.add(0, 'Temperature', cold);
    collector.changes();

    collector.beginSection(1);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot] }]);
  });

  it('forgets sections no longer in the table', () => {
    const collector = new ThresholdLegendCollector();
    collector.beginSection(0);
    collector.add(0, 'Temperature', hot);
    collector.beginSection(1);
    collector.add(1, 'Rain', cold);
    collector.changes();

    collector.keepSections(1);
    expect(collector.changes()).toEqual([{ label: 'Temperature', rules: [hot] }]);
  });
});
