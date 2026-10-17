import { describe, expect, it } from 'vitest';
import { checkHealth, renderHealth } from './health.ts';

const snap = {
  date: '2026-10-16',
  sourcesFailed: ['bls'],
  sourcesSkipped: ['edgar'],
  sourceErrors: { bls: 'HTTP 503' },
  metrics: [{ metricId: 'labor.unemployment_rate', sourceId: 'bls', stale: true }],
};

describe('checkHealth', () => {
  it('reports failures with their error and stale count, and skipped sources as warnings', () => {
    const r = checkHealth(snap, [], '2026-10-16');
    expect(r.problems).toEqual(['Source `bls` failed: HTTP 503 (1 value carried forward as stale).']);
    expect(r.warnings).toEqual(['Source `edgar` was skipped because its key or setting is not configured.']);
  });

  it('flags a snapshot the daily job stopped updating', () => {
    const r = checkHealth({ ...snap, sourcesFailed: [] }, [], '2026-10-20');
    expect(r.problems[0]).toMatch(/4 days old/);
  });

  it('warns before a curated file expires, not after', () => {
    const cur = [
      { name: 'challenger', reviewedOn: '2026-10-14', maxAgeDays: 75 },
      { name: 'polling', reviewedOn: '2026-10-14', maxAgeDays: 365 },
      { name: 'old', reviewedOn: '2026-01-01', maxAgeDays: 30 },
    ];
    expect(checkHealth({ ...snap, sourcesFailed: [], sourcesSkipped: [] }, cur, '2026-12-20').warnings)
      .toEqual(['`sources/curated/challenger.yaml` was reviewed 2026-10-14; it fails in 8 days unless someone re-checks it and bumps `reviewedOn`.']);
  });

  it('is empty when everything is fine', () => {
    const r = checkHealth({ date: '2026-10-16', sourcesFailed: [], metrics: [] }, [], '2026-10-16');
    expect(r).toEqual({ problems: [], warnings: [] });
    expect(renderHealth(r, '2026-10-16')).toMatch(/closes itself/);
  });
});
