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
export function yesPct(_m: PMarket): number | null {
  return null;
}

export const polymarket: Source = {
  id: 'polymarket',
  tier: 3,
  cadence: 'daily',
  async fetch(_ctx: FetchContext): Promise<SourceResult[]> {
    return [];
  },
};
