import { describe, it, expect } from 'vitest';
import { localize } from '../../../src/localize/localize';

// T039: Verify de Intl behaviour
describe('de Intl behaviour (T039)', () => {
  const months = [
    [0, 'Januar'],
    [1, 'Februar'],
    [2, 'März'],
    [3, 'April'],
    [4, 'Mai'],
    [5, 'Juni'],
    [6, 'Juli'],
    [7, 'August'],
    [8, 'September'],
    [9, 'Oktober'],
    [10, 'November'],
    [11, 'Dezember'],
  ] as const;

  for (const [idx, name] of months) {
    it(`month ${idx + 1} formats as "${name}" in de`, () => {
      const result = new Intl.DateTimeFormat('de', { month: 'long' }).format(new Date(2026, idx, 1));
      expect(result).toBe(name);
    });
  }

  it('Intl.NumberFormat de uses comma decimal separator', () => {
    const result = new Intl.NumberFormat('de', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(1234.5);
    expect(result).toContain(',');
  });
});

describe('localize', () => {
  it('returns correct string for en', () => {
    expect(localize('card.no_entities', 'en')).toBe('No entities configured.');
  });

  it('returns correct string for de', () => {
    expect(localize('card.no_entities', 'de')).toBe('Keine Entitäten konfiguriert.');
  });

  it('falls back to en for unknown language', () => {
    expect(localize('card.no_entities', 'fr')).toBe('No entities configured.');
  });

  it('resolves nested key path', () => {
    expect(localize('table.summary', 'en')).toBe('Summary');
  });

  it('returns key string for missing key', () => {
    expect(localize('nonexistent.key', 'en')).toBe('nonexistent.key');
  });
});
