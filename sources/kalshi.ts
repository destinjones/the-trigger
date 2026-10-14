/**
 * Kalshi prediction markets (Tier 3). Public market data, no key.
 *
 * Recorded unscored as markets.passage_probability: the crowd's price on
 * federal cash reaching households. Used to calibrate our own projection,
 * never to move the index. As of 2026-10-14 no UBI contract trades; the
 * closest live series is household "tariff stimulus checks".
 */
import type { FetchContext, Source, SourceResult } from './_types.ts';

/** Series to watch. Add a ticker here when a UBI / dividend market lists. */
export const SERIES = ['KXTARIFFCHECKS'];

interface KMarket {
  ticker: string;
  title: string;
  status: string;
  /** Legacy integer-cents fields. */
  last_price?: number;
  yes_bid?: number;
  yes_ask?: number;
  /** Current API: decimal-dollar strings, "0.0340" = 3.4%. */
  last_price_dollars?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  close_time?: string;
}
interface KResponse {
  markets: KMarket[];
}

export const apiUrl = (series: string) =>
  `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${series}&status=open&limit=100`;

const dollarsToPct = (s?: string) => (s === undefined || s === '' ? undefined : Number(s) * 100);

/** Mid of bid/ask when both quote, else last trade, as a percentage (a $1 contract's price in cents). */
export function marketPct(m: KMarket): number | null {
  const bid = dollarsToPct(m.yes_bid_dollars) ?? m.yes_bid;
  const ask = dollarsToPct(m.yes_ask_dollars) ?? m.yes_ask;
  const last = dollarsToPct(m.last_price_dollars) ?? m.last_price;
  if (bid && ask) return Math.round(((bid + ask) / 2) * 100) / 100;
  if (typeof last === 'number' && Number.isFinite(last) && last > 0) return last;
  return null;
}

export const kalshi: Source = {
  id: 'kalshi',
  tier: 3,
  cadence: 'daily',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    let best: { pct: number; m: KMarket } | null = null;
    for (const s of SERIES) {
      const res = await ctx.http.getJson<KResponse>(apiUrl(s));
      for (const m of res.markets ?? []) {
        const p = marketPct(m);
        if (p !== null && (!best || p > best.pct)) best = { pct: p, m };
      }
    }
    if (!best) return [];
    return [{
      metricId: 'markets.passage_probability',
      label: 'Market odds of federal household checks',
      value: best.pct,
      unit: '%',
      asOf: ctx.today,
      fetchedAt: `${ctx.today}T00:00:00Z`,
      sourceName: `Kalshi ${best.m.ticker}`,
      sourceUrl: `https://kalshi.com/markets/${best.m.ticker.split('-')[0]?.toLowerCase()}`,
      note: best.m.title,
    }];
  },
};
