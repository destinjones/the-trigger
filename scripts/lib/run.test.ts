import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseWeights } from '../../index/model.ts';
import type { FetchContext, RichSource, Source, SourceResult } from '../../sources/_types.ts';
import { assemble, nextRevision, runSources, SCHEMA_VERSION, type Snapshot } from './run.ts';
import { validateSnapshot } from './validate.ts';

const W = parseWeights(readFileSync(fileURLToPath(new URL('../../index/weights.v3.yaml', import.meta.url)), 'utf8'));

const noHttp = {
  getJson: () => Promise.reject(new Error('no network in tests')),
  getText: () => Promise.reject(new Error('no network in tests')),
  postJson: () => Promise.reject(new Error('no network in tests')),
};
const ctx = (env: Record<string, string> = {}): FetchContext => ({ since: '2025-11-06', today: '2026-11-06', http: noHttp, env });

function metric(metricId: string, value: number, over: Partial<SourceResult> = {}): SourceResult {
  return {
    metricId, value, unit: 'pct', asOf: '2026-10-01', fetchedAt: '2026-11-06T00:00:00Z',
    sourceName: 'Test', sourceUrl: `https://example.gov/${metricId}`, ...over,
  };
}

function source(id: string, fetch: () => Promise<SourceResult[]>, over: Partial<Source> = {}): Source {
  return { id, tier: 1, cadence: 'daily', fetch, ...over };
}

const ok = (id: string, ...ms: SourceResult[]) => source(id, () => Promise.resolve(ms));
const boom = (id: string, msg = 'HTTP 503') => source(id, () => Promise.reject(new Error(msg)));

function prevSnapshot(metrics: SourceResult[], extra: Partial<Snapshot> = {}): Snapshot {
  return {
    date: '2026-11-05', revision: 0, weightsVersion: 'v3', readiness: 25, projectedDate: '2031-03-01',
    confidence: 0.5, bandMonths: 22, sourceCoveragePct: 100, weightCovered: 1, subIndices: {},
    metrics, sourcesOk: [], sourcesFailed: [], bills: [], actors: [], filings: [], sourceErrors: {}, sourcesSkipped: [],
    ...extra,
  };
}

describe('runSources: failure isolation', () => {
  it('records a throwing source as failed with its error and still runs the others', async () => {
    const r = await runSources([boom('bls'), ok('fred', metric('fiscal.debt', 1))], ctx(), null);
    expect(r.failed).toEqual(['bls']);
    expect(r.errors).toEqual({ bls: 'HTTP 503' });
    expect(r.ok).toEqual(['fred']);
    expect(r.metrics.map((m) => m.metricId)).toEqual(['fiscal.debt']);
  });

  it('tags every metric with the id of the source that produced it', async () => {
    const r = await runSources([ok('fred', metric('a', 1), metric('b', 2))], ctx(), null);
    expect(r.metrics.map((m) => m.sourceId)).toEqual(['fred', 'fred']);
  });

  it('fails a source that hangs past the timeout', async () => {
    const hang = source('slow', () => new Promise(() => {}));
    const r = await runSources([hang, ok('fred', metric('a', 1))], ctx(), null, () => {}, 10);
    expect(r.failed).toEqual(['slow']);
    expect(r.errors.slow).toMatch(/timed out after 10ms/);
    expect(r.ok).toEqual(['fred']);
  });

  it('treats a source that returns no metrics as ok, not failed', async () => {
    const r = await runSources([ok('pilots')], ctx(), null);
    expect(r.ok).toEqual(['pilots']);
    expect(r.failed).toEqual([]);
  });

  it('records a non-Error rejection as a string', async () => {
    const r = await runSources([source('odd', () => Promise.reject('plain string'))], ctx(), null);
    expect(r.errors.odd).toBe('plain string');
  });
});

describe('runSources: requiresEnv', () => {
  it('skips, does not fail, a source whose key is not set', async () => {
    const s = ok('congress', metric('politics.bills', 3));
    const r = await runSources([{ ...s, requiresEnv: 'CONGRESS_API_KEY' }], ctx(), null);
    expect(r.skipped).toEqual(['congress']);
    expect(r.failed).toEqual([]);
    expect(r.metrics).toEqual([]);
  });

  it('runs it when the key is set', async () => {
    const s = ok('congress', metric('politics.bills', 3));
    const r = await runSources([{ ...s, requiresEnv: 'CONGRESS_API_KEY' }], ctx({ CONGRESS_API_KEY: 'k' }), null);
    expect(r.ok).toEqual(['congress']);
  });
});

describe('runSources: validation', () => {
  const cases: [string, SourceResult][] = [
    ['an http (not https) link', metric('a', 1, { sourceUrl: 'http://example.gov/a' })],
    ['an empty link', metric('a', 1, { sourceUrl: '' })],
    ['a link with no host', metric('a', 1, { sourceUrl: 'https://' })],
    ['a relative link', metric('a', 1, { sourceUrl: '/series/a' })],
    ['NaN', metric('a', Number.NaN)],
    ['Infinity', metric('a', Number.POSITIVE_INFINITY)],
    ['a missing metricId', metric('', 1)],
    ['a bad asOf', metric('a', 1, { asOf: 'Oct 2026' })],
  ];
  for (const [what, m] of cases) {
    it(`fails a source that returns ${what}`, async () => {
      const r = await runSources([ok('bad', m)], ctx(), null);
      expect(r.failed).toEqual(['bad']);
      expect(r.metrics).toEqual([]);
    });
  }

  it('rejects the whole source when one of its metrics is invalid', async () => {
    const r = await runSources([ok('mixed', metric('good', 1), metric('bad', 1, { sourceUrl: 'http://x.gov' }))], ctx(), null);
    expect(r.failed).toEqual(['mixed']);
    expect(r.errors.mixed).toMatch(/no https deep link/);
    expect(r.metrics).toEqual([]);
  });
});

describe('runSources: carry-forward', () => {
  const prev = prevSnapshot([
    { ...metric('labor.unemployment_rate', 4.4, { asOf: '2026-09-01' }), sourceId: 'bls' },
    { ...metric('labor.openings', -3, { asOf: '2026-08-01' }), sourceId: 'bls' },
    { ...metric('fiscal.debt', 120), sourceId: 'fred' },
  ]);

  it('reuses only the failed source\'s previous metrics, unchanged except stale: true', async () => {
    const r = await runSources([boom('bls'), ok('fred', metric('fiscal.debt', 121))], ctx(), prev);
    const bls = r.metrics.filter((m) => m.sourceId === 'bls');
    expect(bls).toEqual(prev.metrics.filter((m) => m.sourceId === 'bls').map((m) => ({ ...m, stale: true })));
    // fred ran fresh: its old value is not duplicated.
    expect(r.metrics.filter((m) => m.metricId === 'fiscal.debt')).toEqual([{ ...metric('fiscal.debt', 121), sourceId: 'fred' }]);
  });

  it('does not mutate the previous snapshot', async () => {
    const before = structuredClone(prev);
    await runSources([boom('bls')], ctx(), prev);
    expect(prev).toEqual(before);
  });

  it('carries nothing, and does not throw, when there is no previous snapshot', async () => {
    const r = await runSources([boom('bls')], ctx(), null);
    expect(r.metrics).toEqual([]);
    expect(r.failed).toEqual(['bls']);
  });

  it('carries nothing for a skipped source', async () => {
    const s = { ...boom('bls'), requiresEnv: 'BLS_API_KEY' };
    const r = await runSources([s], ctx(), prev);
    expect(r.metrics).toEqual([]);
  });

  it('carries the previous bills when congress fails and the previous filings when edgar fails', async () => {
    const bill = { id: 'hr1-119', title: 'T', date: '2026-10-01', status: 'proposed' as const, cosponsors: 1, latestAction: 'x', sourceUrl: 'https://congress.gov/x', sourceName: 'Congress.gov' };
    const filing = { company: 'A', ticker: 'A', fiscalYear: 2025, periodEnd: '2025-12-31', capexUsd: 1, capexYoyPct: null, headcount: null, headcountYoyPct: null, sourceUrl: 'https://sec.gov/a' };
    const p = prevSnapshot([], { bills: [bill], filings: [filing] });
    const r = await runSources([boom('congress'), boom('edgar')], ctx(), p);
    expect(r.bills).toEqual([bill]);
    expect(r.filings).toEqual([filing]);
  });

  it('collects records from a rich source', async () => {
    const actor = { actor: 'X', vehicle: 'Y', status: 'z', signal: 'toward' as const, asOf: '2026-10-01', sourceUrl: 'https://x.gov', sourceName: 'X' };
    const rich: RichSource = { ...ok('actors'), fetchRich: () => Promise.resolve({ metrics: [metric('m', 1)], actors: [actor] }) };
    const r = await runSources([rich], ctx(), null);
    expect(r.actors).toEqual([actor]);
    expect(r.metrics).toHaveLength(1);
  });
});

describe('nextRevision', () => {
  it('starts a new date at revision 0', () => {
    expect(nextRevision('2026-11-06', '2026-11-06', null, false)).toEqual({ revision: 0 });
    expect(nextRevision('2026-10-01', '2026-11-06', null, false)).toEqual({ revision: 0 });
  });

  it('bumps the revision when today is rescored', () => {
    expect(nextRevision('2026-11-06', '2026-11-06', { revision: 1 }, false)).toEqual({ revision: 2 });
  });

  it('refuses to touch an existing past date without --revise', () => {
    const r = nextRevision('2026-11-05', '2026-11-06', { revision: 0 }, false);
    expect(r).toHaveProperty('error');
    expect('error' in r && r.error).toMatch(/immutable/);
  });

  it('bumps the revision of a past date with --revise', () => {
    expect(nextRevision('2026-11-05', '2026-11-06', { revision: 3 }, true)).toEqual({ revision: 4 });
  });
});

describe('assemble', () => {
  it('writes the given revision, the schema version, and sorted records', async () => {
    const r = await runSources([ok('fred', metric('fiscal.debt', 1)), boom('bls')], ctx(), null);
    r.skipped.push('legiscan', 'edgar');
    const s = assemble('2026-11-06', 2, W, r);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.revision).toBe(2);
    expect(s.weightsVersion).toBe('v3');
    expect(s.sourcesFailed).toEqual(['bls']);
    expect(s.sourcesSkipped).toEqual(['edgar', 'legiscan']);
    expect(s.sourceErrors).toEqual({ bls: 'HTTP 503' });
  });

  it('produces a snapshot that passes validation', async () => {
    const r = await runSources([ok('fred', metric('fiscal.debt', 1))], ctx(), null);
    const s = assemble('2026-11-06', 0, W, r);
    expect(validateSnapshot(JSON.parse(JSON.stringify(s)), { fileDate: '2026-11-06', weightsVersions: ['v3'], schemaVersion: SCHEMA_VERSION })).toEqual([]);
  });
});
