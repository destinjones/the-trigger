import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditChain, auditPair, type ChainMetric, type ChainSnapshot } from './chain.ts';
import { CHAIN_EXCEPTIONS } from './chainExceptions.ts';

const m = (metricId: string, value: number, sourceId: string, over: Partial<ChainMetric> = {}): ChainMetric => ({
  metricId, value, sourceId, asOf: '2026-10-01', sourceUrl: `https://example.gov/${metricId}`, ...over,
});

const prev: ChainSnapshot = {
  date: '2026-11-05',
  sourcesFailed: [],
  metrics: [m('labor.unemployment_rate', 4.4, 'bls'), m('fiscal.debt', 120, 'fred')],
};

const day = (metrics: ChainMetric[], sourcesFailed: string[] = [], sourcesSkipped: string[] = []): ChainSnapshot => ({
  date: '2026-11-06', metrics, sourcesFailed, sourcesSkipped,
});

describe('auditPair', () => {
  it('passes a correct carry-forward', () => {
    const cur = day([{ ...m('labor.unemployment_rate', 4.4, 'bls'), stale: true }, m('fiscal.debt', 121, 'fred')], ['bls']);
    expect(auditPair(prev, cur)).toEqual({ problems: [], warnings: [] });
  });

  it('catches a stale value that is not the previous value', () => {
    const cur = day([{ ...m('labor.unemployment_rate', 4.5, 'bls'), stale: true }, m('fiscal.debt', 121, 'fred')], ['bls']);
    expect(auditPair(prev, cur).problems).toEqual([
      '2026-11-06 labor.unemployment_rate is stale but its value (4.5) differs from 2026-11-05 (4.4)',
    ]);
  });

  it('catches a stale asOf or link that changed', () => {
    const cur = day([{ ...m('labor.unemployment_rate', 4.4, 'bls', { asOf: '2026-10-02', sourceUrl: 'https://example.gov/other' }), stale: true }], ['bls']);
    expect(auditPair(prev, cur).problems).toHaveLength(2);
  });

  it('catches a stale value with nothing to carry', () => {
    const cur = day([{ ...m('labor.new_metric', 1, 'bls'), stale: true }], ['bls']);
    expect(auditPair(prev, cur).problems[0]).toMatch(/has no value to carry forward/);
  });

  it('catches a fresh value from a source that failed', () => {
    const cur = day([m('labor.unemployment_rate', 4.4, 'bls'), m('fiscal.debt', 121, 'fred')], ['bls']);
    expect(auditPair(prev, cur).problems).toEqual(['2026-11-06 labor.unemployment_rate is fresh but its source `bls` failed']);
  });

  it('catches a stale value from a source that did not fail', () => {
    const cur = day([{ ...m('labor.unemployment_rate', 4.4, 'bls'), stale: true }, m('fiscal.debt', 121, 'fred')]);
    expect(auditPair(prev, cur).problems).toEqual(['2026-11-06 labor.unemployment_rate is stale but its source `bls` did not fail']);
  });

  it('warns, without failing, when a metric disappears from a source that ran', () => {
    const r = auditPair(prev, day([m('labor.unemployment_rate', 4.4, 'bls')]));
    expect(r.problems).toEqual([]);
    expect(r.warnings[0]).toMatch(/fiscal.debt is missing/);
  });

  it('does not warn about metrics from a skipped source', () => {
    expect(auditPair(prev, day([m('labor.unemployment_rate', 4.4, 'bls')], [], ['fred'])).warnings).toEqual([]);
  });

  it('honours a recorded exception', () => {
    const cur = day([{ ...m('labor.unemployment_rate', 9, 'bls'), stale: true }, m('fiscal.debt', 121, 'fred')], ['bls']);
    expect(auditPair(prev, cur, { '2026-11-06:labor.unemployment_rate': 'test' }).problems).toEqual([]);
  });
});

describe('auditChain', () => {
  it('rejects snapshots out of date order', () => {
    expect(auditChain([day([]), { ...prev, date: '2026-11-06' }]).problems[0]).toMatch(/is not after/);
  });

  it('passes on the committed archive', () => {
    const dir = fileURLToPath(new URL('../../data/', import.meta.url));
    const snaps = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
      .map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as ChainSnapshot);
    expect(auditChain(snaps, CHAIN_EXCEPTIONS).problems).toEqual([]);
  });
});
