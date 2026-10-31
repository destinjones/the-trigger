/**
 * Polymarket prediction markets (Tier 3). Public gamma API, no key.
 *
 * Recorded unscored as markets.polymarket_probability: the crowd's price on a
 * federal cash dividend or rebate, next to Kalshi's markets.passage_probability.
 * Used to calibrate our own projection, never to move the index.
 */
import type { FetchContext, Source, SourceResult } from './_types.ts';

/** Markets to watch. Add a slug here when a UBI / dividend market lists. */
export const SLUGS = ['will-trump-create-a-5000-dividend-by-march-31-2027'];

export interface PMarket {
  question?: string;
  slug?: string;
  /** JSON-encoded, e.g. '["Yes","No"]'. */
  outcomes?: string;
  /** JSON-encoded, e.g. '["0.0565","0.9435"]'. */
  outcomePrices?: string;
  lastTradePrice?: number;
  active?: boolean;
  closed?: boolean;
}

export const apiUrl = (slug: string) => `https://gamma-api.polymarket.com/markets?slug=${slug}`;

/** Yes price as a percentage: outcomePrices when present, else last trade. Closed/inactive markets are skipped. */
export function yesPct(m: PMarket): number | null {
  if (m.closed || m.active === false) return null;
  const pct = (p: unknown): number | null => {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10_000) / 100 : null;
  };
  if (m.outcomes && m.outcomePrices) {
    try {
      const outcomes = JSON.parse(m.outcomes) as unknown[];
      const prices = JSON.parse(m.outcomePrices) as unknown[];
      const i = outcomes.findIndex((o) => String(o).toLowerCase() === 'yes');
      if (i >= 0) return pct(prices[i]);
    } catch {
      // Malformed arrays: fall through to last trade.
    }
  }
  return pct(m.lastTradePrice);
}

export const polymarket: Source = {
  id: 'polymarket',
  tier: 3,
  cadence: 'daily',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    let best: { pct: number; m: PMarket } | null = null;
    for (const slug of SLUGS) {
      const res = await ctx.http.getJson<PMarket[]>(apiUrl(slug));
      for (const m of res ?? []) {
        const p = yesPct(m);
        if (p !== null && (!best || p > best.pct)) best = { pct: p, m };
      }
    }
    if (!best || !best.m.slug) return [];
    return [{
      metricId: 'markets.polymarket_probability',
      label: 'Polymarket odds of a federal cash dividend',
      value: best.pct,
      unit: '%',
      asOf: ctx.today,
      fetchedAt: `${ctx.today}T00:00:00Z`,
      sourceName: 'Polymarket',
      sourceUrl: `https://polymarket.com/event/${best.m.slug}`,
      note: best.m.question,
    }];
  },
};
