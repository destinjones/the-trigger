/**
 * LegiScan (Tier 2): state bills mentioning guaranteed or basic income.
 * Free key required (LEGISCAN_API_KEY); without one the source is skipped,
 * not failed. Recorded unscored in v1 (state-level map is on the roadmap).
 */
import type { FetchContext, Source, SourceResult } from './_types.ts';

interface LsSearch {
  status: string;
  searchresult?: { summary?: { count?: number } } & Record<string, unknown>;
}

export const QUERY = '"guaranteed income" OR "basic income"';
export const apiUrl = (key: string, year: number) =>
  `https://api.legiscan.com/?key=${encodeURIComponent(key)}&op=getSearch&state=ALL&year=${year}&query=${encodeURIComponent(QUERY)}`;

export const legiscan: Source = {
  id: 'legiscan',
  tier: 2,
  cadence: 'weekly',
  requiresEnv: 'LEGISCAN_API_KEY',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    const key = ctx.env.LEGISCAN_API_KEY;
    if (!key) throw new Error('LEGISCAN_API_KEY not set');
    // year=1: current session(s) only.
    const res = await ctx.http.getJson<LsSearch>(apiUrl(key, 1));
    if (res.status !== 'OK') throw new Error(`LegiScan: ${res.status}`);
    const count = res.searchresult?.summary?.count;
    if (typeof count !== 'number') throw new Error('LegiScan: missing count');
    return [{
      metricId: 'politics.state_bills_active',
      label: 'State guaranteed-income bills, current sessions',
      value: count,
      unit: 'bills',
      asOf: ctx.today,
      fetchedAt: `${ctx.today}T00:00:00Z`,
      sourceName: 'LegiScan full-text search',
      sourceUrl: `https://legiscan.com/gaits/search?state=ALL&keyword=${encodeURIComponent(QUERY)}`,
    }];
  },
};
