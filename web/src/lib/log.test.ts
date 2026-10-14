import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../../scripts/lib/run.ts';
import { diffSnapshots, isoWeek, weeklyLog } from './log.ts';

const snap = (date: string, over: Partial<Snapshot> = {}): Snapshot => ({
  date, revision: 0, weightsVersion: 'v2', readiness: 28.1, projectedDate: '2031-01-01', bandMonths: 22, confidence: 0.55,
  subIndices: {}, sourceCoveragePct: 80, weightCovered: 1, sourcesOk: ['bls', 'edgar'], sourcesFailed: [], sourcesSkipped: [], sourceErrors: {},
  metrics: [{ metricId: 'labor.unemployment_rate', label: 'Unemployment rate', value: 4.2, unit: '%', asOf: date, fetchedAt: date, sourceName: 'BLS', sourceUrl: 'https://bls.test' }],
  bills: [{ id: 's4825', title: 'S. 4825', date: '2026-06-18', status: 'in committee', cosponsors: 0, latestAction: 'Referred', sourceUrl: 'https://c.test/s4825', sourceName: 'Congress.gov' }],
  actors: [], filings: [],
  ...over,
} as Snapshot);

describe('what moved', () => {
  it('computes ISO weeks across a year boundary', () => {
    expect(isoWeek('2026-10-14')).toBe('2026-W42');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
  });
  it('reports score, metric, source and bill changes with links', () => {
    const a = snap('2026-10-14');
    const [m0] = a.metrics;
    const [b0] = a.bills;
    if (!m0 || !b0) throw new Error('fixture');
    const b = snap('2026-10-21', {
      readiness: 29.0, projectedDate: '2030-12-01', sourcesOk: ['bls'], sourcesFailed: ['edgar'],
      metrics: [{ ...m0, value: 4.3 }],
      bills: [{ ...b0, cosponsors: 3 }],
    });
    const texts = diffSnapshots(a, b).map((c) => c.text);
    expect(texts).toContain('Readiness 28.1 → 29.0 (+0.9).');
    expect(texts).toContain('Projected first check moved from 2031-01-01 to 2030-12-01.');
    expect(texts).toContain('Unemployment rate: 4.2% → 4.3% (+0.1pt).');
    expect(texts.some((t) => t.startsWith('edgar started failing'))).toBe(true);
    expect(texts).toContain('S. 4825: co-sponsors 0 → 3.');
    expect(diffSnapshots(b, { ...b, sourcesFailed: [], sourcesOk: ['bls', 'edgar'] }).map((c) => c.text)).toContain('edgar is back.');
  });
  it('writes one entry per week, newest first, and says when bills sat still', () => {
    const log = weeklyLog([snap('2026-10-14'), snap('2026-10-15', { readiness: 28.4 }), snap('2026-10-20', { readiness: 28.6 })]);
    expect(log.map((e) => e.week)).toEqual(['2026-W43', '2026-W42']);
    expect(log[1]?.since).toBeNull();
    expect(log[0]?.since).toBe('2026-10-15');
    expect(log[0]?.summary).toBe('Readiness 28.4 → 28.6 (+0.2); 0 inputs moved.');
    expect(log[0]?.changes.some((c) => c.text.includes('still in committee'))).toBe(true);
  });
});
