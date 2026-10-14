import { describe, expect, it } from 'vitest';
import { interpolate, valueAt } from './counter.ts';

describe('counters', () => {
  it('extends a year-to-date figure at its own average rate', () => {
    const c = interpolate(120_136, '2026-09-30T00:00:00Z', '2026-01-01T00:00:00Z');
    const day = 86_400_000;
    expect(c.ratePerMs * day).toBeCloseTo(120_136 / 272, 6);
    expect(valueAt(c, c.since)).toBe(120_136);
    expect(valueAt(c, c.since - day)).toBe(120_136); // never runs backwards
    expect(valueAt(c, c.since + 14 * day)).toBeCloseTo(120_136 + 14 * 120_136 / 272, 3);
  });
});
