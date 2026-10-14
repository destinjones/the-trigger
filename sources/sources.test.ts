import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cassetteKey, fakeHttp, replayHttp } from './_http.ts';
import type { FetchContext, Http } from './_types.ts';
import { bls, parseSeries, threeMonthAvgChange, yoyPct } from './bls.ts';
import { billStatus, congress, isMovement } from './congress.ts';
import { federalRegister, minusOneYear } from './federal-register.ts';
import { fred, parseCsv } from './fred.ts';
import { govtrack, prognosisPct } from './govtrack.ts';
import { congressFor } from './_watchlist.ts';

// Real upstream responses recorded on 2026-10-14.
const CASSETTE = fileURLToPath(new URL('../fixtures/cassettes/2026-10-14.json', import.meta.url));

function ctx(http: Http, env: Record<string, string> = {}): FetchContext {
  return { since: '2025-10-14', today: '2026-10-14', http, env };
}

describe('cassetteKey', () => {
  it('strips credentials and sorts params', () => {
    expect(cassetteKey('GET', 'https://x.test/a?b=2&api_key=SECRET&a=1')).toBe('GET https://x.test/a?a=1&b=2');
  });
});

describe('bls (recorded)', () => {
  it('produces the September 2026 employment situation', async () => {
    const r = await bls.fetch(ctx(replayHttp(CASSETTE)));
    const byId = Object.fromEntries(r.map((m) => [m.metricId, m]));
    expect(byId['labor.unemployment_rate']?.value).toBe(4.2);
    expect(byId['labor.unemployment_rate']?.asOf).toBe('2026-09-01');
    expect(byId['labor.unemployment_rate']?.note).toBe('+0.1 pt vs prior month');
    // (159044 - 158892) / 3
    expect(byId['labor.payrolls_3mo_avg_change']?.value).toBeCloseTo(50.7, 1);
    expect(byId['labor.payrolls_3mo_avg_change']?.note).toBe('Latest month +29k (preliminary)');
    // Aug 2026 1186 vs Aug 2025 1095
    expect(byId['labor.white_collar_openings_yoy']?.value).toBeCloseTo(8.3, 1);
    for (const m of r) expect(m.sourceUrl).toMatch(/^https:\/\/data\.bls\.gov\/timeseries\//);
  });

  it('skips missing "-" values and annual averages', () => {
    const obs = parseSeries({
      status: 'REQUEST_SUCCEEDED',
      Results: { series: [{ seriesID: 'X', data: [
        { year: '2025', period: 'M13', periodName: 'Annual', value: '4.0' },
        { year: '2025', period: 'M10', periodName: 'October', value: '-' },
        { year: '2025', period: 'M09', periodName: 'September', value: '4.4' },
      ] }] },
    }, 'X');
    expect(obs).toEqual([{ date: '2025-09-01', value: 4.4, preliminary: false }]);
  });

  it('refuses gaps in the 3-month window', () => {
    expect(() => threeMonthAvgChange([
      { date: '2025-12-01', value: 3, preliminary: false },
      { date: '2025-11-01', value: 2, preliminary: false },
      { date: '2025-09-01', value: 1, preliminary: false },
      { date: '2025-08-01', value: 0, preliminary: false },
    ])).toThrow();
    expect(() => yoyPct([{ date: '2025-12-01', value: 3, preliminary: false }])).toThrow();
  });

  it('throws on API errors', () => {
    expect(() => parseSeries({ status: 'REQUEST_NOT_PROCESSED', message: ['daily threshold'] }, 'X')).toThrow(/threshold/);
  });
});

describe('congress (recorded)', () => {
  it('reads the watchlist: no movement, 11 co-sponsors', async () => {
    const out = await congress.fetchRich(ctx(replayHttp(CASSETTE)));
    const byId = Object.fromEntries(out.metrics.map((m) => [m.metricId, m]));
    expect(byId['politics.bills_with_committee_movement']?.value).toBe(0);
    expect(byId['politics.cosponsors_total']?.value).toBe(11);
    const hr = out.bills?.find((b) => b.id === 'hr5830-119');
    expect(hr?.status).toBe('in committee');
    expect(hr?.cosponsors).toBe(11);
    expect(hr?.sourceUrl).toBe('https://www.congress.gov/bill/119th-congress/house-bill/5830');
  });

  it('classifies actions', () => {
    expect(isMovement({ actionDate: '', text: 'Referred to the Subcommittee on Health.', type: 'Committee' })).toBe(false);
    expect(isMovement({ actionDate: '', text: 'Subcommittee Hearings Held', type: 'Committee' })).toBe(true);
    expect(isMovement({ actionDate: '', text: 'Ordered to be Reported', type: 'Committee' })).toBe(true);
    expect(billStatus([{ actionDate: '', text: 'Became Public Law No: 119-1.', type: 'BecameLaw' }], 119, '2026-10-14')).toBe('passed');
    expect(billStatus([{ actionDate: '', text: 'Referred to committee' }], 118, '2026-10-14')).toBe('expired');
  });

  it('congressFor', () => {
    expect(congressFor('2026-10-14')).toBe(119);
    expect(congressFor('2027-06-01')).toBe(120);
  });
});

describe('govtrack', () => {
  it('fails loudly when GovTrack is down (recorded 502)', async () => {
    await expect(govtrack.fetch(ctx(replayHttp(CASSETTE)))).rejects.toThrow(/502/);
  });
  it('normalizes prognosis shapes', () => {
    expect(prognosisPct({ id: 1, link: '', prognosis: 0.03 })).toBe(3);
    expect(prognosisPct({ id: 1, link: '', prognosis: { percent: 12 } })).toBe(12);
    expect(prognosisPct({ id: 1, link: '' })).toBeNull();
  });
  it('picks the best prognosis (synthetic response)', async () => {
    const body = (p: number, n: number) => JSON.stringify({ objects: [{ id: n, link: `https://www.govtrack.us/congress/bills/119/x${n}`, prognosis: p, current_status_label: 'Introduced', current_status_date: '2026-01-01' }] });
    const http = fakeHttp({
      'GET https://www.govtrack.us/api/v2/bill?bill_type=house_bill': body(0.02, 1),
      'GET https://www.govtrack.us/api/v2/bill?bill_type=senate_bill': body(0.05, 2),
    });
    const r = await govtrack.fetch(ctx(http));
    expect(r[0]?.value).toBe(5);
    expect(r[0]?.sourceUrl).toContain('x2');
  });
});

describe('fred (recorded)', () => {
  it('deficit FY2025 and interest share', async () => {
    const r = await fred.fetch(ctx(replayHttp(CASSETTE)));
    const byId = Object.fromEntries(r.map((m) => [m.metricId, m]));
    expect(byId['fiscal.deficit_pct_gdp']?.value).toBe(5.77);
    expect(byId['fiscal.deficit_pct_gdp']?.asOf).toBe('2025-01-01');
    // 970065 / 5236421
    expect(byId['fiscal.interest_pct_receipts']?.value).toBe(18.5);
  });
  it('parses CSV and skips missing', () => {
    expect(parseCsv('observation_date,X\n2020-01-01,.\n2021-01-01,2.5\n')).toEqual([{ date: '2021-01-01', value: 2.5 }]);
    expect(() => parseCsv('nope')).toThrow();
  });
});

describe('federal register (recorded)', () => {
  it('counts presidential documents citing AI in the last 12 months', async () => {
    const out = await federalRegister.fetchRich(ctx(replayHttp(CASSETTE)));
    expect(out.metrics[0]?.value).toBe(16);
    expect(out.metrics[0]?.asOf).toBe('2026-10-02');
    expect(out.actors?.[0]?.sourceUrl).toContain('2026-20321');
  });
  it('minusOneYear handles leap day', () => {
    expect(minusOneYear('2028-02-29')).toBe('2027-02-28');
  });
});
