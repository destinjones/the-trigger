import { describe, expect, it } from 'vitest';
import { ARC, dialGeometry, readinessAngle, yearAngle, yearFraction } from './dial.ts';

describe('dial', () => {
  it('sweeps 270° of a 140px ring', () => {
    expect(ARC).toBeCloseTo(659.73, 2);
    expect(readinessAngle(0)).toBe(135);
    expect(readinessAngle(100)).toBe(405);
    expect(dialGeometry(25).offset).toBeCloseTo(ARC * 0.75, 6);
  });
  it('has 21 ticks with every fifth major, and ten year labels', () => {
    const g = dialGeometry(28.1);
    expect(g.ticks).toHaveLength(21);
    expect(g.ticks.filter((t) => t.major)).toHaveLength(5);
    expect(g.years.map((y) => y.label)).toEqual(["'26", "'27", "'28", "'29", "'30", "'31", "'32", "'33", "'34", "'35"]);
  });
  it('places dates on the year scale', () => {
    expect(yearFraction('2031-01-01')).toBe(2031);
    expect(yearAngle(2031)).toBeCloseTo(135 + 135, 6);
    expect(yearAngle(2040)).toBe(405);
  });
});
