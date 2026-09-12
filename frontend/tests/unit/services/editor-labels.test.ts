import { describe, it, expect } from 'vitest';
import { editorLabel, editorHelper } from '../../../src/services/editor-labels';

describe('editorLabel', () => {
  it('maps a field name to its localized editor label', () => {
    expect(editorLabel('precision', 'en')).toBe('Precision (decimal places)');
    expect(editorLabel('name', 'en')).toBe('Display name');
    expect(editorLabel('expression', 'en')).toBe('Formula');
    expect(editorLabel('entity', 'en')).toBe('Statistic ID');
    expect(editorLabel('entity', 'de')).toBe('Statistik-ID');
  });

  it('follows the language', () => {
    expect(editorLabel('name', 'de')).not.toBe(editorLabel('name', 'en'));
  });

  it('falls back to the field name for unknown fields', () => {
    expect(editorLabel('no_such_field', 'en')).toBe('no_such_field');
  });
});

describe('editorHelper', () => {
  it('returns helper text for fields that have one', () => {
    expect(editorHelper('precision', 'en')).toBe('Decimal digits in day cells and summary columns; default 1');
    expect(editorHelper('text_color', 'en')).toBe(editorHelper('background_color', 'en'));
  });

  it('returns undefined for fields without helper text', () => {
    expect(editorHelper('name', 'en')).toBeUndefined();
    expect(editorHelper('no_such_field', 'en')).toBeUndefined();
  });
});
