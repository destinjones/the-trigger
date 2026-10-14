/**
 * Bureau of Labor Statistics public API (v2). Public domain, no key required
 * for GET requests; BLS_API_KEY raises the daily limit.
 *
 *   LNS14000000            unemployment rate, SA                (CPS)
 *   CES0000000001          total nonfarm payroll employment, SA (CES), thousands
 *   JTS540099000000000JOL  job openings, professional and business services, SA (JOLTS), thousands
 */
import type { FetchContext, Source, SourceResult } from './_types.ts';

interface BlsPoint {
  year: string;
  period: string;
  periodName: string;
  value: string;
  latest?: string;
  footnotes?: { code?: string; text?: string }[];
}
interface BlsResponse {
  status: string;
  message?: string[];
  Results?: { series: { seriesID: string; data: BlsPoint[] }[] };
}

export interface Obs {
  /** YYYY-MM-01 */
  date: string;
  value: number;
  preliminary: boolean;
}

export const SERIES = {
  unemployment: 'LNS14000000',
  payrolls: 'CES0000000001',
  pbsOpenings: 'JTS540099000000000JOL',
} as const;

export function seriesUrl(id: string): string {
  return `https://data.bls.gov/timeseries/${id}`;
}

export function apiUrl(id: string, today: string, key?: string): string {
  const y = Number(today.slice(0, 4));
  const k = key ? `&registrationkey=${encodeURIComponent(key)}` : '';
  return `https://api.bls.gov/publicAPI/v2/timeseries/data/${id}?startyear=${y - 1}&endyear=${y}${k}`;
}

/** Parse a BLS response into monthly observations, newest first. Skips "-" (missing) values. */
export function parseSeries(res: BlsResponse, id: string): Obs[] {
  if (res.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS ${id}: ${res.status} ${(res.message ?? []).join('; ')}`);
  }
  const series = res.Results?.series.find((s) => s.seriesID === id);
  if (!series) throw new Error(`BLS ${id}: series missing from response`);
  const out: Obs[] = [];
  for (const p of series.data) {
    if (!/^M(0[1-9]|1[0-2])$/.test(p.period)) continue; // skip M13 annual averages
    const v = Number(p.value);
    if (p.value.trim() === '-' || !Number.isFinite(v)) continue;
    out.push({
      date: `${p.year}-${p.period.slice(1)}-01`,
      value: v,
      preliminary: (p.footnotes ?? []).some((f) => f.code === 'P'),
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  if (out.length === 0) throw new Error(`BLS ${id}: no usable observations`);
  return out;
}

function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number) as [number, number];
  const [yb, mb] = b.split('-').map(Number) as [number, number];
  return (ya - yb) * 12 + (ma - mb);
}

/** Average monthly change over the last 3 months, from 4 consecutive levels. */
export function threeMonthAvgChange(obs: Obs[]): { value: number; asOf: string } {
  const [a, , , d] = obs;
  if (!a || !d || monthsBetween(a.date, d.date) !== 3) {
    throw new Error('payrolls: need 4 consecutive monthly levels');
  }
  return { value: (a.value - d.value) / 3, asOf: a.date };
}

/** Percent change of the latest observation vs the same month a year earlier. */
export function yoyPct(obs: Obs[]): { value: number; asOf: string } {
  const latest = obs[0];
  if (!latest) throw new Error('yoy: empty series');
  const prior = obs.find((o) => monthsBetween(latest.date, o.date) === 12);
  if (!prior || prior.value === 0) throw new Error('yoy: no observation 12 months earlier');
  return { value: ((latest.value - prior.value) / prior.value) * 100, asOf: latest.date };
}

export const bls: Source = {
  id: 'bls',
  tier: 1,
  cadence: 'monthly',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    const key = ctx.env.BLS_API_KEY;
    const fetchedAt = `${ctx.today}T00:00:00Z`;
    const get = async (id: string) => parseSeries(await ctx.http.getJson<BlsResponse>(apiUrl(id, ctx.today, key)), id);

    const [unemp, payrolls, openings] = await Promise.all([
      get(SERIES.unemployment),
      get(SERIES.payrolls),
      get(SERIES.pbsOpenings),
    ]);

    const u = unemp[0];
    if (!u) throw new Error('BLS: no unemployment observation');
    const prevU = unemp[1];
    const p3 = threeMonthAvgChange(payrolls);
    const lastChange = payrolls[0] && payrolls[1] ? payrolls[0].value - payrolls[1].value : null;
    const o = yoyPct(openings);

    return [
      {
        metricId: 'labor.unemployment_rate',
        label: 'Unemployment rate',
        value: u.value,
        unit: '%',
        asOf: u.date,
        fetchedAt,
        sourceName: 'BLS CPS, series LNS14000000',
        sourceUrl: seriesUrl(SERIES.unemployment),
        note: prevU ? `${(u.value - prevU.value >= 0 ? '+' : '')}${(u.value - prevU.value).toFixed(1)} pt vs prior month` : undefined,
      },
      {
        metricId: 'labor.payrolls_3mo_avg_change',
        label: 'Payroll growth, 3-mo avg',
        value: Math.round(p3.value * 10) / 10,
        unit: 'thousand jobs/mo',
        asOf: p3.asOf,
        fetchedAt,
        sourceName: 'BLS CES, series CES0000000001',
        sourceUrl: seriesUrl(SERIES.payrolls),
        note: lastChange === null ? undefined
          : `Latest month ${lastChange >= 0 ? '+' : ''}${lastChange}k${payrolls[0]?.preliminary ? ' (preliminary)' : ''}`,
      },
      {
        metricId: 'labor.white_collar_openings_yoy',
        label: 'Prof. & business services openings, YoY',
        value: Math.round(o.value * 10) / 10,
        unit: '% YoY',
        asOf: o.asOf,
        fetchedAt,
        sourceName: 'BLS JOLTS, series JTS540099000000000JOL',
        sourceUrl: seriesUrl(SERIES.pbsOpenings),
        note: 'Proxy for entry-level white-collar postings',
      },
    ];
  },
};
