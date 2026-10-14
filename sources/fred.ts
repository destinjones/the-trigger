/**
 * FRED (Federal Reserve Bank of St. Louis). With FRED_API_KEY we use the JSON
 * API; without it we read the public fredgraph CSV endpoint, which serves the
 * same observations with no key.
 *
 *   FYFSGDA188S  federal surplus or deficit (−) as % of GDP, annual (fiscal year)
 *   FYOINT       federal outlays: interest, annual, $M
 *   FYFR         federal receipts, annual, $M
 */
import type { FetchContext, Http, Source, SourceResult } from './_types.ts';

export interface FredObs {
  date: string;
  value: number;
}

export function seriesUrl(id: string): string {
  return `https://fred.stlouisfed.org/series/${id}`;
}

export function csvUrl(id: string, since: string): string {
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`;
}

export function apiUrl(id: string, since: string, key: string): string {
  return `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&observation_start=${since}&file_type=json&api_key=${encodeURIComponent(key)}`;
}

/** Parse fredgraph CSV ("observation_date,ID\n2024-01-01,-6.3"). Skips "." (missing). Oldest first. */
export function parseCsv(csv: string): FredObs[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header || !/date/i.test(header)) throw new Error('FRED CSV: unexpected header');
  const out: FredObs[] = [];
  for (const line of lines) {
    const [date, raw] = line.split(',');
    if (!date || raw === undefined) continue;
    const v = Number(raw);
    if (raw.trim() === '.' || raw.trim() === '' || !Number.isFinite(v)) continue;
    out.push({ date, value: v });
  }
  return out;
}

interface FredApi {
  observations: { date: string; value: string }[];
}

export async function getSeries(http: Http, id: string, since: string, key?: string): Promise<FredObs[]> {
  if (key) {
    const res = await http.getJson<FredApi>(apiUrl(id, since, key));
    return res.observations
      .filter((o) => o.value !== '.')
      .map((o) => ({ date: o.date, value: Number(o.value) }));
  }
  return parseCsv(await http.getText(csvUrl(id, since)));
}

export const fred: Source = {
  id: 'fred',
  tier: 1,
  cadence: 'monthly',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    const key = ctx.env.FRED_API_KEY || undefined;
    const since = `${Number(ctx.today.slice(0, 4)) - 6}-01-01`;
    const fetchedAt = `${ctx.today}T00:00:00Z`;
    const [def, interest, receipts] = await Promise.all([
      getSeries(ctx.http, 'FYFSGDA188S', since, key),
      getSeries(ctx.http, 'FYOINT', since, key),
      getSeries(ctx.http, 'FYFR', since, key),
    ]);
    const d = def.at(-1);
    if (!d) throw new Error('FRED: FYFSGDA188S empty');

    const out: SourceResult[] = [
      {
        metricId: 'fiscal.deficit_pct_gdp',
        label: 'Federal deficit, % of GDP',
        // FRED reports a deficit as a negative surplus; we score the deficit.
        value: Math.round(-d.value * 100) / 100,
        unit: '% of GDP',
        asOf: d.date,
        fetchedAt,
        sourceName: 'FRED FYFSGDA188S (OMB via St. Louis Fed)',
        sourceUrl: seriesUrl('FYFSGDA188S'),
        note: `Fiscal year ${d.date.slice(0, 4)}`,
      },
    ];

    // Interest / receipts for the latest fiscal year both series cover.
    const rByDate = new Map(receipts.map((r) => [r.date, r.value]));
    const pair = [...interest].reverse().find((i) => rByDate.has(i.date));
    if (pair) {
      const r = rByDate.get(pair.date) as number;
      out.push({
        metricId: 'fiscal.interest_pct_receipts',
        label: 'Interest outlays, % of receipts',
        value: Math.round((pair.value / r) * 1000) / 10,
        unit: '% of receipts',
        asOf: pair.date,
        fetchedAt,
        sourceName: 'FRED FYOINT / FYFR (OMB via St. Louis Fed)',
        sourceUrl: seriesUrl('FYOINT'),
        note: `Fiscal year ${pair.date.slice(0, 4)}: $${Math.round(pair.value / 1000)}B interest on $${Math.round(r / 1000)}B receipts`,
      });
    }
    return out;
  },
};
