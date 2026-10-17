import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  computeComposite,
  dateToYearFraction,
  parseWeights,
  project,
  quarterOf,
  sourceCoverage,
  yearFractionToDate,
  type Weights,
} from './model.ts';
import { TRANSFORMS, linear, logScale, normalize } from './normalize.ts';
import type { SourceResult } from '../sources/_types.ts';

const weightsText = readFileSync(fileURLToPath(new URL('./weights.v1.yaml', import.meta.url)), 'utf8');
const W = parseWeights(weightsText);
const W2 = parseWeights(readFileSync(fileURLToPath(new URL('./weights.v2.yaml', import.meta.url)), 'utf8'));

function m(metricId: string, value: number): SourceResult {
  return {
    metricId, value, unit: '', asOf: '2026-10-01', fetchedAt: '2026-10-14T00:00:00Z',
    sourceName: 'test', sourceUrl: 'https://example.test/' + metricId,
  };
}

describe('projection fixture (regression)', () => {
  // The demo: readiness 34, 88% of sources live -> Q3 2030, ~61% confidence.
  const p = project(34, 88, '2026-10-14');

  it('lands in Q3 2030', () => {
    expect(quarterOf(p.projectedDate)).toBe('Q3 2030');
    expect(p.projectedYear).toBeCloseTo(2030.53, 2);
  });
  it('carries 61% confidence', () => {
    expect(p.confidence).toBe(0.61);
  });
  it('carries a ~20 month band', () => {
    expect(p.bandMonths).toBe(20);
  });
  it('is deterministic', () => {
    expect(project(34, 88, '2026-10-14')).toEqual(p);
  });
});

describe('project()', () => {
  it('readiness 0 -> 2033.25 with a 30 month band', () => {
    const p = project(0, 100, '2026-10-14');
    expect(p.projectedYear).toBe(2033.25);
    expect(p.bandMonths).toBe(30);
  });
  it('readiness 100 clamps to the floor, band 0', () => {
    const p = project(100, 100, '2026-01-01');
    expect(p.projectedYear).toBe(2026.5);
    expect(p.bandMonths).toBe(0);
  });
  it('never projects before the snapshot date', () => {
    const p = project(100, 100, '2027-03-01');
    expect(p.projectedDate).toBe('2027-03-01');
  });
  it('clamps confidence to [35, 80]', () => {
    expect(project(0, 0, '2026-10-14').confidence).toBe(0.35);
    expect(project(100, 100, '2026-10-14').confidence).toBe(0.8);
  });
  it('clamps out-of-range readiness', () => {
    expect(project(-20, 50, '2026-10-14')).toEqual(project(0, 50, '2026-10-14'));
    expect(project(140, 50, '2026-10-14')).toEqual(project(100, 50, '2026-10-14'));
  });
  it('is monotonic: higher readiness never projects later', () => {
    let prev = Infinity;
    for (let r = 0; r <= 100; r += 5) {
      const y = project(r, 80, '2026-10-14').projectedYear;
      expect(y).toBeLessThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('date helpers', () => {
  it('round-trips', () => {
    for (const d of ['2026-01-01', '2028-02-29', '2030-07-15', '2033-12-31']) {
      expect(yearFractionToDate(dateToYearFraction(d))).toBe(d);
    }
  });
  it('quarters', () => {
    expect(quarterOf('2030-07-01')).toBe('Q3 2030');
    expect(quarterOf('2030-12-31')).toBe('Q4 2030');
  });
  it('rejects bad input', () => {
    expect(() => dateToYearFraction('2030/01/01')).toThrow();
  });
});

describe('normalize', () => {
  it('spec anchors', () => {
    expect(normalize('labor.unemployment_rate', 4.0)).toBe(0);
    expect(normalize('labor.unemployment_rate', 9.0)).toBe(100);
    expect(normalize('labor.unemployment_rate', 6.5)).toBe(50);
    expect(normalize('labor.payrolls_3mo_avg_change', 150)).toBe(0);
    expect(normalize('labor.payrolls_3mo_avg_change', -100)).toBe(100);
    expect(normalize('labor.payrolls_3mo_avg_change', 25)).toBe(50);
    expect(normalize('labor.white_collar_openings_yoy', -20)).toBe(50);
    expect(normalize('labor.ai_layoffs_ttm', 250_000)).toBe(50);
    expect(normalize('precedent.permanent_programs', 10)).toBe(50);
    expect(normalize('politics.bills_with_committee_movement', 5)).toBe(50);
    expect(normalize('opinion.ubi_support_pct', 52.5)).toBe(50);
    expect(normalize('fiscal.deficit_pct_gdp', 6.5)).toBe(50);
    expect(normalize('corporate.equity_commitments_usd', 50e9)).toBe(50);
  });
  it('clamps', () => {
    expect(normalize('labor.unemployment_rate', 2)).toBe(0);
    expect(normalize('labor.unemployment_rate', 15)).toBe(100);
    expect(normalize('labor.payrolls_3mo_avg_change', 400)).toBe(0);
  });
  it('log scale: $0 -> 0, $10B -> 100, monotonic', () => {
    expect(normalize('precedent.cash_disbursed_usd', 0)).toBe(0);
    expect(normalize('precedent.cash_disbursed_usd', 10e9)).toBe(100);
    expect(normalize('precedent.cash_disbursed_usd', 1e12)).toBe(100);
    expect(normalize('precedent.cash_disbursed_usd', 335e6)).toBeCloseTo(85.25, 1);
    expect(logScale(1e6, 1e10)).toBeLessThan(logScale(1e7, 1e10));
  });
  it('throws on unknown metric and non-finite values', () => {
    expect(() => normalize('nope', 1)).toThrow(/no transform/);
    expect(() => normalize('labor.unemployment_rate', NaN)).toThrow(/non-finite/);
  });
  it('linear() rejects equal anchors', () => {
    expect(() => linear(1, 2, 2)).toThrow();
  });
  it('every transform has a note', () => {
    for (const [id, t] of Object.entries(TRANSFORMS)) expect(t.note.length, id).toBeGreaterThan(10);
  });
});

describe('weights', () => {
  it('v1 parses and sums to 1', () => {
    const sum = Object.values(W.subIndices).reduce((a, s) => a + s.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(W.version).toBe('v1');
    expect(W.subIndices.labor_dislocation?.weight).toBe(0.25);
  });
  it('rejects weights that do not sum to 1', () => {
    expect(() => parseWeights('version: x\nsubIndices:\n  a: { weight: 0.5 }\n')).toThrow(/sum/);
  });
  it('rejects unknown metrics and unknown sub-indices', () => {
    expect(() => parseWeights('version: x\nsubIndices:\n  a: { weight: 1 }\nmetrics:\n  bogus.metric: a\n')).toThrow(/no transform/);
    expect(() => parseWeights('version: x\nsubIndices:\n  a: { weight: 1 }\nmetrics:\n  labor.unemployment_rate: b\n')).toThrow(/unknown sub-index/);
  });
  it('every transform is mapped (scored or null) in the default weights, v2', () => {
    for (const id of Object.keys(TRANSFORMS)) expect(id in W2.metrics, id).toBe(true);
  });
  it('v2 demotes fiscal pressure and groups every sub-index', () => {
    expect(W2.version).toBe('v2');
    expect(W2.subIndices.fiscal_pressure?.weight).toBe(0.05);
    expect(W2.subIndices.labor_dislocation?.weight).toBe(0.3);
    for (const [k, d] of Object.entries(W2.subIndices)) expect(['pressure', 'response', 'backdrop'], k).toContain(d.group);
    expect(W2.metrics['corporate.equity_pipeline_usd']).toBe('corporate_equity');
  });
});

describe('computeComposite', () => {
  const tiny: Weights = {
    version: 't',
    subIndices: { a: { weight: 0.75, label: 'A' }, b: { weight: 0.25, label: 'B' } },
    metrics: { 'labor.unemployment_rate': 'a', 'labor.ai_layoffs_ttm': 'a', 'opinion.ubi_support_pct': 'b', 'markets.passage_probability': null },
    coverage: { countSkipped: false },
  };

  it('means within, weights across', () => {
    const r = computeComposite([
      m('labor.unemployment_rate', 6.5),   // 50
      m('labor.ai_layoffs_ttm', 500_000),  // 100
      m('opinion.ubi_support_pct', 30),    // 0
    ], tiny);
    expect(r.subIndices.a).toBe(75);
    expect(r.subIndices.b).toBe(0);
    expect(r.readiness).toBeCloseTo(56.25, 6);
    expect(r.weightCovered).toBe(1);
  });
  it('renormalizes when a sub-index has no data', () => {
    const r = computeComposite([m('labor.unemployment_rate', 6.5)], tiny);
    expect(r.subIndices.b).toBeNull();
    expect(r.readiness).toBe(50);
    expect(r.weightCovered).toBe(0.75);
  });
  it('unscored metrics do not move the score', () => {
    const base = computeComposite([m('labor.unemployment_rate', 6.5)], tiny).readiness;
    const withMkt = computeComposite([m('labor.unemployment_rate', 6.5), m('markets.passage_probability', 99)], tiny).readiness;
    expect(withMkt).toBe(base);
  });
  it('later duplicates win', () => {
    const r = computeComposite([m('labor.unemployment_rate', 4), m('labor.unemployment_rate', 9)], tiny);
    expect(r.subIndices.a).toBe(100);
  });
  it('is order independent', () => {
    const xs = [m('labor.unemployment_rate', 5), m('opinion.ubi_support_pct', 45), m('labor.ai_layoffs_ttm', 9200)];
    expect(computeComposite(xs, tiny)).toEqual(computeComposite([...xs].reverse(), tiny));
  });
  it('no data -> readiness 0', () => {
    expect(computeComposite([], tiny).readiness).toBe(0);
  });
});

describe('buildSnapshot', () => {
  it('produces the documented shape, sorted and rounded', () => {
    const s = buildSnapshot({
      date: '2026-10-14', revision: 0, weights: W,
      metrics: [m('opinion.ubi_support_pct', 45), m('labor.unemployment_rate', 4.2)],
      sourcesOk: ['polling', 'bls'], sourcesFailed: ['edgar'],
    });
    expect(s.weightsVersion).toBe('v1');
    expect(s.sourcesOk).toEqual(['bls', 'polling']);
    expect(s.sourceCoveragePct).toBe(66.7);
    expect(s.metrics.map((x) => x.metricId)).toEqual(['labor.unemployment_rate', 'opinion.ubi_support_pct']);
    expect(s.subIndices.labor_dislocation).toBe(4);
    expect(s.subIndices.public_opinion).toBeCloseTo(33.3, 1);
    expect(s.subIndices.precedent).toBeNull();
    expect(Number.isInteger(s.readiness * 10)).toBe(true);
  });
  it('counts skipped sources against coverage only when the weights say so', () => {
    const input = {
      date: '2026-10-14', revision: 0, metrics: [m('labor.unemployment_rate', 4.2)],
      sourcesOk: ['bls', 'polling', 'fred'], sourcesFailed: [], sourcesSkipped: ['edgar'],
    };
    expect(buildSnapshot({ ...input, weights: W }).sourceCoveragePct).toBe(100);
    expect(buildSnapshot({ ...input, weights: { ...W, coverage: { countSkipped: true } } }).sourceCoveragePct).toBe(75);
  });
  it('rejects a malformed coverage block', () => {
    expect(() => parseWeights('version: x\nsubIndices: { a: { weight: 1 } }\ncoverage: { countSkipped: yes please }')).toThrow(/countSkipped/);
  });
  it('sourceCoverage', () => {
    expect(sourceCoverage([], [])).toBe(0);
    expect(sourceCoverage(['a', 'b', 'c'], ['d'])).toBe(75);
  });
});
