import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fakeHttp, replayHttp } from './_http.ts';
import type { FetchContext, Http, Source } from './_types.ts';
import { curatedOutput, daysBetween } from './_curated.ts';
import {
  COMPANIES, annualFacts, annualReports, capexHeadcountGap, conceptUrl, docUrl, edgar, htmlToText, parseHeadcount, submissionsUrl,
} from './edgar.ts';
import { kalshi, marketPct } from './kalshi.ts';
import { pilots } from './pilots.ts';
import { aggregatePolls, pollWeight, polling, type Poll } from './polling.ts';
import { challenger } from './challenger.ts';
import { corporate, pipeline, type Commitment } from './corporate.ts';
import { legiscan } from './legiscan.ts';
import { runSources, type Snapshot } from '../scripts/lib/run.ts';

const CASSETTE = fileURLToPath(new URL('../fixtures/cassettes/2026-10-14.json', import.meta.url));
const ctx = (http: Http, today = '2026-10-14', env: Record<string, string> = {}): FetchContext =>
  ({ since: '2025-10-14', today, http, env });

describe('edgar', () => {
  // Microsoft PaymentsToAcquirePropertyPlantAndEquipment, annual 10-K facts as
  // reported to XBRL (FY ends June 30), plus the noise a real response carries:
  // quarterly durations and a 10-Q.
  const msft = {
    units: {
      USD: [
        { start: '2022-07-01', end: '2023-06-30', val: 28107000000, form: '10-K', accn: '0000950170-23-035122', filed: '2023-07-27' },
        { start: '2023-07-01', end: '2024-06-30', val: 44477000000, form: '10-K', accn: '0000950170-24-087843', filed: '2024-07-30' },
        { start: '2024-07-01', end: '2025-06-30', val: 64551000000, form: '10-K', accn: '0000950170-25-100235', filed: '2025-07-30' },
        { start: '2025-07-01', end: '2026-06-30', val: 115948000000, form: '10-K', accn: '0001193125-26-323660', filed: '2026-07-29' },
        { start: '2026-04-01', end: '2026-06-30', val: 30000000000, form: '10-K', accn: '0001193125-26-323660', filed: '2026-07-29' },
        { start: '2025-07-01', end: '2025-09-30', val: 19394000000, form: '10-Q', accn: 'x', filed: '2025-10-29' },
        // A later 10-K restating FY2024 wins over the original.
        { start: '2023-07-01', end: '2024-06-30', val: 44480000000, form: '10-K', accn: '0000950170-25-100235', filed: '2025-07-30' },
      ],
    },
  };

  it('annualFacts keeps 12-month 10-K facts, newest first, latest filing wins', () => {
    const a = annualFacts(msft);
    expect(a.map((x) => x.end)).toEqual(['2026-06-30', '2025-06-30', '2024-06-30', '2023-06-30']);
    expect(a[0]?.val).toBe(115948000000);
    expect(a[2]?.val).toBe(44480000000);
  });

  it('parses headcount sentences in the forms 10-Ks actually use', () => {
    const cases: [string, number][] = [
      ['Human Capital. As of December 31, 2025, we had 190,167 employees.', 190167],
      ['As of June 30, 2026, we employed approximately 228,000 people on a full-time basis, 126,000 in the U.S.', 228000],
      ['As of December 31, 2025, we employed approximately 1,576,000 full-time and part-time employees.', 1576000],
      ['As of the end of fiscal year 2026, we had a total of approximately 42,000 employees in 38 countries.', 42000],
      ['Our employees. Our workforce consisted of approximately 162,000 employees as of May 31, 2026.', 162000],
    ];
    for (const [text, n] of cases) expect(parseHeadcount(text), text).toBe(n);
  });

  it('prefers the human capital section over earlier mentions', () => {
    const t = 'Our platform serves 3,000,000 customers and 45,000 developers. ... Human Capital As of December 31, 2025, we had 78,450 employees.';
    expect(parseHeadcount(t)).toBe(78450);
    expect(parseHeadcount('no numbers here')).toBeNull();
  });

  it('htmlToText', () => {
    expect(htmlToText('<p>we&nbsp;had <b>1,000</b> employees</p><script>x=1</script>')).toBe(' we had 1,000 employees ');
  });

  it('aggregate gap weights by size, not by company count', () => {
    const g = capexHeadcountGap([
      { company: 'A', ticker: 'A', fiscalYear: 2026, periodEnd: '2026-06-30', capexUsd: 200, capexYoyPct: 100, headcount: 1000, headcountYoyPct: 0, sourceUrl: '' },
      { company: 'B', ticker: 'B', fiscalYear: 2026, periodEnd: '2026-06-30', capexUsd: 100, capexYoyPct: 0, headcount: 3000, headcountYoyPct: -25, sourceUrl: '' },
      { company: 'C', ticker: 'C', fiscalYear: 2026, periodEnd: '2026-06-30', capexUsd: 999, capexYoyPct: 50, headcount: null, headcountYoyPct: null, sourceUrl: '' },
    ]);
    // capex 300 vs 200 -> +50%; headcount 4000 vs 5000 -> -20%
    expect(g?.n).toBe(2);
    expect(g?.capexYoy).toBeCloseTo(50, 6);
    expect(g?.headYoy).toBeCloseTo(-20, 6);
    expect(g?.gap).toBeCloseTo(70, 6);
  });

  it('end to end on a fake EDGAR', async () => {
    const c = COMPANIES[0];
    if (!c) throw new Error('no companies');
    const sub = { filings: { recent: {
      accessionNumber: ['0001193125-26-323660', '0001193125-26-100000', '0000950170-25-100235'],
      form: ['10-K', '10-Q', '10-K'],
      reportDate: ['2026-06-30', '2026-03-31', '2025-06-30'],
      filingDate: ['2026-07-29', '2026-04-29', '2025-07-30'],
      primaryDocument: ['msft-20260630.htm', 'q.htm', 'msft-20250630.htm'],
    } } };
    expect(annualReports(sub).map((r) => r.doc)).toEqual(['msft-20260630.htm', 'msft-20250630.htm']);
    const http = fakeHttp({
      [`GET ${conceptUrl(c, c.capex[0] as string)}`]: JSON.stringify(msft),
      [`GET ${submissionsUrl(c)}`]: JSON.stringify(sub),
      [`GET ${docUrl(c, '0001193125-26-323660', 'msft-20260630.htm')}`]: '<p>Human Capital</p><p>As of June 30, 2026, we employed approximately 220,000 people</p>',
      [`GET ${docUrl(c, '0000950170-25-100235', 'msft-20250630.htm')}`]: '<p>Human Capital</p><p>As of June 30, 2025, we employed approximately 228,000 people</p>',
    });
    const out = await edgar.fetchRich(ctx(http));
    const row = out.filings?.find((f) => f.ticker === 'MSFT');
    expect(row?.capexYoyPct).toBeCloseTo(79.6, 1);
    expect(row?.headcountYoyPct).toBeCloseTo(-3.5, 1);
    expect(out.metrics[0]?.value).toBeCloseTo(83.1, 1);
    expect(out.metrics[0]?.sourceUrl).toBe(docUrl(c, '0001193125-26-323660', 'msft-20260630.htm'));
    // The other five companies 404 on the fake and are skipped, not fatal.
    expect(out.filings).toHaveLength(1);
  });
});

describe('kalshi (recorded)', () => {
  it('reads the decimal-dollar quote as a percentage', async () => {
    const r = await kalshi.fetch(ctx(replayHttp(CASSETTE)));
    expect(r[0]?.value).toBe(3.25);
    expect(r[0]?.sourceUrl).toBe('https://kalshi.com/markets/kxtariffchecks');
  });
  it('falls back to last trade, and to legacy cents', () => {
    expect(marketPct({ ticker: 't', title: '', status: '', last_price_dollars: '0.12' })).toBeCloseTo(12, 6);
    expect(marketPct({ ticker: 't', title: '', status: '', yes_bid: 4, yes_ask: 6 })).toBe(5);
    expect(marketPct({ ticker: 't', title: '', status: '' })).toBeNull();
  });
});

describe('curated sources', () => {
  const none = fakeHttp({});
  it('load with deep links and ISO dates', async () => {
    for (const s of [pilots, polling, challenger, corporate]) {
      const out = await s.fetchRich(ctx(none));
      expect(out.metrics.length, s.id).toBeGreaterThan(0);
      for (const m of out.metrics) {
        expect(m.sourceUrl, m.metricId).toMatch(/^https:\/\//);
        expect(m.asOf, m.metricId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
  it('pilots counts only permanent programs', async () => {
    const r = await pilots.fetch(ctx(none));
    expect(r.find((m) => m.metricId === 'precedent.permanent_programs')?.value).toBe(2);
  });
  it('unverified figures say so', async () => {
    const r = await pilots.fetch(ctx(none));
    expect(r.find((m) => m.metricId === 'precedent.cash_disbursed_usd')?.note).toMatch(/not (independently )?confirmed|unverified/);
  });
  it('corporate carries the who-is-moving roster', async () => {
    const out = await corporate.fetchRich(ctx(none));
    expect(out.actors?.length).toBeGreaterThan(3);
  });
  it('corporate scores the pipeline with discounts, binding at face value', async () => {
    const r = await corporate.fetch(ctx(none));
    const pipe = r.find((m) => m.metricId === 'corporate.equity_pipeline_usd');
    expect(pipe?.value).toBe(Math.round(42_600_000_000 * 0.15));
    expect(r.find((m) => m.metricId === 'corporate.equity_commitments_usd')?.value).toBe(0);
  });
  it('pipeline discounts by status and skips unsized entries', () => {
    const c = (status: Commitment['status'], valueUsd: number | null): Commitment =>
      ({ entity: 'x', what: 'x', status, valueUsd, asOf: '2026-01-01', sourceUrl: 'https://x.test', sourceName: 'x' });
    expect(pipeline([c('binding', 10), c('signed', 10), c('reported', 10), c('floated', 100), c('reported', null)]))
      .toEqual({ binding: 10, discounted: 10 + 6 + 3 + 15, counted: 4 });
    expect(() => pipeline([c('rumored' as Commitment['status'], 1)])).toThrow(/unknown status/);
  });
  it('polls aggregate by sqrt(n), recency, and partisan half weight', () => {
    const p = (support: number, n: number, fieldEnd: string, partisan: Poll['partisan'] = null): Poll =>
      ({ pollster: `p${support}`, fieldEnd, n, support, partisan, question: 'q', sourceUrl: 'https://x.test' });
    const today = '2026-10-14';
    // Same date, n 4x larger -> weight 2x.
    expect(pollWeight(p(1, 4000, today), today) / pollWeight(p(1, 1000, today), today)).toBeCloseTo(2);
    // One year older -> half.
    expect(pollWeight(p(1, 1000, '2025-10-14'), today) / pollWeight(p(1, 1000, today), today)).toBeCloseTo(0.5, 2);
    // Partisan -> half. Too old, future, or no n -> zero.
    expect(pollWeight(p(1, 1000, today, 'left'), today) / pollWeight(p(1, 1000, today), today)).toBeCloseTo(0.5);
    expect(pollWeight(p(1, 1000, '2022-01-01'), today)).toBe(0);
    expect(pollWeight(p(1, 1000, '2026-12-01'), today)).toBe(0);
    expect(pollWeight(p(1, 0, today), today)).toBe(0);
    // Two equal-weight polls average; a left and right poll of equal size cancel lean.
    expect(aggregatePolls([p(20, 1000, today), p(60, 1000, today)], today)?.support).toBeCloseTo(40);
    expect(aggregatePolls([p(30, 1000, today, 'right'), p(60, 1000, today, 'left'), p(40, 1000, today)], today)?.support)
      .toBeCloseTo((30 * 0.5 + 60 * 0.5 + 40) / 2);
    expect(aggregatePolls([], today)).toBeNull();
  });
  it('polling publishes one averaged metric over the curated polls', async () => {
    const r = await polling.fetch(ctx(none));
    const m = r.filter((x) => x.metricId === 'opinion.ubi_support_pct');
    expect(m).toHaveLength(1);
    expect(m[0]?.sourceName).toMatch(/Weighted mean of 3 national polls/);
    expect(m[0]?.value).toBeGreaterThan(30);
    expect(m[0]?.value).toBeLessThan(45);
  });
  it('fail once nobody has re-reviewed them', () => {
    expect(() => curatedOutput({ reviewedOn: '2026-01-01', maxAgeDays: 30, metrics: [] }, 'x', '2026-10-14')).toThrow(/last reviewed/);
    expect(() => curatedOutput({ reviewedOn: '2027-01-01', maxAgeDays: 30, metrics: [] }, 'x', '2026-10-14')).toThrow(/after/);
    expect(daysBetween('2026-10-14', '2026-10-01')).toBe(13);
  });
});

describe('runner', () => {
  const good: Source = {
    id: 'good', tier: 1, cadence: 'daily',
    fetch: async (c) => [{ metricId: 'labor.unemployment_rate', value: 5, unit: '%', asOf: '2026-09-01', fetchedAt: c.today, sourceName: 'g', sourceUrl: 'https://g.test' }],
  };
  const bad: Source = { id: 'bad', tier: 1, cadence: 'daily', fetch: async () => { throw new Error('boom'); } };
  const linkless: Source = {
    id: 'linkless', tier: 1, cadence: 'daily',
    fetch: async (c) => [{ metricId: 'opinion.ubi_support_pct', value: 40, unit: '%', asOf: '2026-09-01', fetchedAt: c.today, sourceName: 'x', sourceUrl: '' }],
  };
  const prev = {
    metrics: [{ metricId: 'opinion.ubi_support_pct', value: 41, unit: '%', asOf: '2026-08-01', fetchedAt: 'x', sourceName: 'b', sourceUrl: 'https://b.test', sourceId: 'bad' }],
    bills: [], filings: [],
  } as unknown as Snapshot;

  it('isolates failures and carries last known values forward as stale', async () => {
    const r = await runSources([good, bad], ctx(fakeHttp({})), prev);
    expect(r.ok).toEqual(['good']);
    expect(r.failed).toEqual(['bad']);
    expect(r.errors.bad).toBe('boom');
    const carried = r.metrics.find((m) => m.metricId === 'opinion.ubi_support_pct');
    expect(carried?.stale).toBe(true);
    expect(carried?.value).toBe(41);
    expect(r.metrics.find((m) => m.metricId === 'labor.unemployment_rate')?.sourceId).toBe('good');
  });
  it('rejects numbers without a deep link', async () => {
    const r = await runSources([linkless], ctx(fakeHttp({})), null);
    expect(r.failed).toEqual(['linkless']);
    expect(r.errors.linkless).toMatch(/deep link/);
  });
  it('skips keyed sources without a key, runs them with one', async () => {
    const r = await runSources([legiscan], ctx(fakeHttp({})), null);
    expect(r.skipped).toEqual(['legiscan']);
    expect(r.failed).toEqual([]);
    const r2 = await runSources([legiscan], ctx(fakeHttp({}), '2026-10-14', { LEGISCAN_API_KEY: 'k' }), null);
    expect(r2.failed).toEqual(['legiscan']);
  });
});
