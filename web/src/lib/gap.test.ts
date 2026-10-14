import { describe, expect, it } from 'vitest';
import { gapGeometry, gapSeries, monthEnd } from './gap.ts';

const m = (month: string, ytd: number) => ({ month, aiCuts: null, ytd, url: 'https://x.test' });

describe('gap chart', () => {
  it('turns year-to-date figures into a cumulative series across a year boundary', () => {
    const s = gapSeries([m('2025-11', 50), m('2025-12', 55), m('2026-01', 8), m('2026-02', 12)], [{ date: '2026-10-14', bills: 0 }]);
    expect(s.map((p) => p.cuts)).toEqual([50, 55, 63, 67]);
    expect(s.every((p) => p.bills === 0)).toBe(true);
    expect(monthEnd('2026-12')).toBe(2027);
  });
  it('takes bills from the latest snapshot on or before each month end', () => {
    const s = gapSeries([m('2026-01', 1), m('2026-02', 2), m('2026-03', 3)], [{ date: '2026-02-10', bills: 1 }, { date: '2026-03-31', bills: 2 }]);
    expect(s.map((p) => p.bills)).toEqual([1, 1, 2]);
  });
  it('draws paths, a closed gap, and year ticks; nothing for one point', () => {
    const g = gapGeometry([{ t: 2025.5, cuts: 0, bills: 0 }, { t: 2026.5, cuts: 100, bills: 0 }]);
    expect(g?.cutsPath).toBe('M0.0 176.0L656.0 26.0');
    expect(g?.gapPath.endsWith('Z')).toBe(true);
    expect(g?.years.map((y) => y.label)).toEqual(['2025', '2026']);
    expect(g?.years[0]?.anchor).toBe('start');
    expect(g?.cutsLength).toBeCloseTo(Math.hypot(656, 150), 3);
    expect(gapGeometry([{ t: 2026, cuts: 1, bills: 0 }])).toBeNull();
  });
});
