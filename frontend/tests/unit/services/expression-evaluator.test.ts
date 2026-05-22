import { describe, it, expect } from 'vitest';
import { extractEntityIds, evaluate } from '../../../src/services/expression-evaluator';

describe('extractEntityIds', () => {
  it('extracts single entity ID', () => {
    expect(extractEntityIds('{{ sensor.energy }}')).toEqual(['sensor.energy']);
  });

  it('extracts multiple entity IDs', () => {
    const ids = extractEntityIds('{{ sensor.kwh + sensor.wh * 0.001 }}');
    expect(ids).toContain('sensor.kwh');
    expect(ids).toContain('sensor.wh');
    expect(ids).toHaveLength(2);
  });

  it('deduplicates repeated entity IDs', () => {
    const ids = extractEntityIds('{{ sensor.a + sensor.a }}');
    expect(ids).toEqual(['sensor.a']);
  });

  it('does not extract plain numbers as entity IDs', () => {
    const ids = extractEntityIds('{{ sensor.a * 0.001 + 5 }}');
    expect(ids).toEqual(['sensor.a']);
  });

  it('handles entity IDs with underscores', () => {
    const ids = extractEntityIds('{{ input_number.living_room + sensor.energy_wh }}');
    expect(ids).toContain('input_number.living_room');
    expect(ids).toContain('sensor.energy_wh');
  });

  it('handles expression without {{ }}', () => {
    const ids = extractEntityIds('sensor.a + sensor.b');
    expect(ids).toContain('sensor.a');
    expect(ids).toContain('sensor.b');
  });
});

describe('evaluate — basic arithmetic', () => {
  it('evaluates addition', () => {
    expect(evaluate('{{ sensor.a + sensor.b }}', { 'sensor.a': 3, 'sensor.b': 7 })).toBe(10);
  });

  it('evaluates subtraction', () => {
    expect(evaluate('{{ sensor.a - sensor.b }}', { 'sensor.a': 10, 'sensor.b': 4 })).toBe(6);
  });

  it('evaluates multiplication', () => {
    expect(evaluate('{{ sensor.a * 0.001 }}', { 'sensor.a': 1000 })).toBeCloseTo(1);
  });

  it('evaluates division', () => {
    expect(evaluate('{{ sensor.a / 2 }}', { 'sensor.a': 10 })).toBe(5);
  });

  it('respects operator precedence (* before +)', () => {
    expect(evaluate('{{ sensor.a + sensor.b * 2 }}', { 'sensor.a': 1, 'sensor.b': 3 })).toBe(7);
  });

  it('respects parentheses', () => {
    expect(evaluate('{{ (sensor.a + sensor.b) * 2 }}', { 'sensor.a': 1, 'sensor.b': 3 })).toBe(8);
  });

  it('handles unary minus on number', () => {
    expect(evaluate('{{ -1 + sensor.a }}', { 'sensor.a': 5 })).toBe(4);
  });

  it('handles unary minus on entity', () => {
    expect(evaluate('{{ sensor.a + -sensor.b }}', { 'sensor.a': 10, 'sensor.b': 3 })).toBe(7);
  });

  it('uses 0 for entity absent from context', () => {
    expect(evaluate('{{ sensor.a + sensor.missing }}', { 'sensor.a': 5 })).toBe(5);
  });

  it('evaluates numeric literal only', () => {
    expect(evaluate('{{ 42 }}', {})).toBe(42);
  });

  it('evaluates typical Wh-to-kWh expression', () => {
    const result = evaluate(
      '{{ sensor.energy_kwh + sensor.energy_wh * 0.001 }}',
      { 'sensor.energy_kwh': 10, 'sensor.energy_wh': 500 },
    );
    expect(result).toBeCloseTo(10.5);
  });
});

describe('evaluate — error handling', () => {
  it('throws on division by zero', () => {
    expect(() => evaluate('{{ sensor.a / 0 }}', { 'sensor.a': 5 })).toThrow();
  });

  it('throws on unknown token', () => {
    expect(() => evaluate('{{ sensor.a @ sensor.b }}', { 'sensor.a': 1, 'sensor.b': 2 })).toThrow();
  });
});
