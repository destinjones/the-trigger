import { describe, expect, it } from 'vitest';
import { ARC, ARC_INNER, CIRC, dialGeometry, readinessAngle, yearAngle, yearFraction } from './dial.ts';

const input = { readiness: 25, windowFrom: '2029-03-01', windowTo: '2032-11-01', projectedDate: '2031-01-01' };

describe('dial', () => {
  it('sweeps 270° of a 140px outer ring and a 98px inner ring', () => {
    expect(ARC).toBeCloseTo(659.73, 2);
    expect(ARC_INNER).toBeCloseTo(461.81, 2);
    expect(readinessAngle(0)).toBe(135);
    expect(readinessAngle(100)).toBe(405);
    expect(dialGeometry(input).innerOffset).toBeCloseTo(ARC_INNER * 0.75, 6);
  });
  it('ticks each quarter with a long tick each January, and ten year labels', () => {
    const g = dialGeometry(input);
    expect(g.ticks).toHaveLength(41);
    expect(g.ticks.filter((t) => t.major)).toHaveLength(11);
    expect(g.years.map((y) => y.label)).toEqual(["'26", "'27", "'28", "'29", "'30", "'31", "'32", "'33", "'34", "'35"]);
  });
  it('puts the projection on the time ring, not the readiness value', () => {
    const g = dialGeometry(input);
    expect(g.dotAngle).toBeCloseTo(yearAngle(2031), 6);
    expect(g.band.start).toBeCloseTo(yearAngle(yearFraction('2029-03-01')), 6);
    expect(g.band.length).toBeCloseTo(CIRC * ((yearAngle(yearFraction('2032-11-01')) - g.band.start) / 360), 6);
  });
  it('places dates on the year scale', () => {
    expect(yearFraction('2031-01-01')).toBe(2031);
    expect(yearAngle(2031)).toBeCloseTo(135 + 135, 6);
    expect(yearAngle(2040)).toBe(405);
  });
});
