import { describe, expect, it } from 'vitest';
import { brier, expire, recordProjection, renderScoreboard, type Ledger, type Prediction } from './lib/scorecard.ts';

const snap = { date: '2026-10-14', revision: 0, weightsVersion: 'v1', projectedDate: '2031-03-12', confidence: 0.54, bandMonths: 22, readiness: 25.7 };
const empty: Ledger = { predictions: [] };

describe('scorecard', () => {
  it('logs a projection with its band as the window', () => {
    const l = recordProjection(empty, snap);
    expect(l.predictions).toHaveLength(1);
    const p = l.predictions[0] as Prediction;
    expect(p.window).toEqual({ from: '2029-05-12', to: '2033-01-12' });
    expect(p.resolvesBy).toBe('2033-01-12');
    expect(p.claim).toContain('Q1 2031');
  });
  it('does not re-log an unchanged projection', () => {
    const l = recordProjection(recordProjection(empty, snap), { ...snap, date: '2026-10-15', projectedDate: '2031-03-13' });
    expect(l.predictions).toHaveLength(1);
  });
  it('logs again when confidence or window moves', () => {
    const l = recordProjection(recordProjection(empty, snap), { ...snap, date: '2026-11-01', confidence: 0.56 });
    expect(l.predictions).toHaveLength(2);
  });
  it('expires overdue open predictions as misses', () => {
    const l = expire(recordProjection(empty, snap), '2033-02-01');
    expect(l.predictions[0]?.status).toBe('miss');
    expect(l.predictions[0]?.resolvedOn).toBe('2033-02-01');
  });
  it('brier', () => {
    const base = recordProjection(empty, snap).predictions[0] as Prediction;
    expect(brier([base])).toBeNull();
    expect(brier([{ ...base, status: 'hit', confidence: 0.6 }, { ...base, status: 'miss', confidence: 0.6 }])).toBeCloseTo((0.16 + 0.36) / 2, 6);
  });
  it('renders', () => {
    const md = renderScoreboard(recordProjection(empty, snap), '2026-10-14');
    expect(md).toContain('Do not hand-edit');
    expect(md).toContain('| 2026-10-14 |');
    expect(md).toContain('n/a until something resolves');
  });
});
