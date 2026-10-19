import { describe, expect, it } from 'vitest';
import { fmtDate, fmtDelta, fmtMonth, fmtNumber } from './format.ts';

describe('fmtNumber', () => {
  it.each([
    [999, 'USD', '$999'],
    [1_500, 'USD', '$1.5K'],
    [1_200_000, 'USD', '$1.2M'],
    [1_000_000_000, 'USD', '$1B'],
    [1_234_567, 'jobs', '1.23M'],
    [12_345, 'jobs', '12k'],
    [1_234, 'jobs', '1,234'],
    [3, 'thousand jobs/mo', '+3k/mo'],
    [-3, 'thousand jobs/mo', '−3k/mo'],
    [12_345, 'bills', '12k'],
    [12_345, 'documents', '12k'],
    [12_345, 'co-sponsors', '12k'],
    [12_345, 'people', '12k'],
    [12_345, 'programs', '12k'],
    [2.34, '%', '2.3%'],
    [-2.34, '% of GDP', '−2.3%'],
    [2.34, '% YoY', '+2.3%'],
    [-2.34, '% YoY', '−2.3%'],
    [2.34, '% of receipts', '2.3%'],
  ] as const)('formats %s %s as %s', (value, unit, expected) => {
    expect(fmtNumber(value, unit)).toBe(expected);
  });
});

describe('fmtDelta', () => {
  it.each([
    [15, 10, 'jobs', '+5'],
    [5, 10, 'jobs', '−5'],
    [1.2, 1.1, '%', '+0.1pt'],
    [3_000_000, 2_000_000, 'USD', '+$1M'],
    [10, 10, 'bills', 'unch'],
  ] as const)('formats %s from %s in %s as %s', (cur, prev, unit, expected) => {
    expect(fmtDelta(cur, prev, unit)).toBe(expected);
  });

  it('returns null when there is no previous value', () => {
    expect(fmtDelta(10, undefined, 'jobs')).toBeNull();
  });
});

describe('date formatters', () => {
  it('formats a date with an abbreviated month, day, and year', () => {
    expect(fmtDate('2026-10-16')).toBe('Oct 16, 2026');
  });

  it('formats a month with an abbreviated month and year', () => {
    expect(fmtMonth('2026-10')).toBe('Oct 2026');
  });
});

