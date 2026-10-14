/**
 * GovTrack API v2. Open, no key. Used for its normalized status labels and its
 * enactment prognosis, which Congress.gov does not provide.
 *
 * Output is recorded unscored (politics.govtrack_prognosis_max) for v1: it is
 * a model of its own, and we would rather calibrate against it than stack it.
 */
import type { FetchContext, Source, SourceResult } from './_types.ts';
import { billLabel, loadWatchlist, type WatchedBill } from './_watchlist.ts';

const TYPE: Record<WatchedBill['type'], string> = {
  hr: 'house_bill',
  s: 'senate_bill',
  hjres: 'house_joint_resolution',
  sjres: 'senate_joint_resolution',
};

interface GtBill {
  id: number;
  link: string;
  current_status?: string;
  current_status_label?: string;
  current_status_date?: string;
  /** Present on some API versions as a number (0–1 or 0–100) or an object. */
  prognosis?: number | { prediction?: number; percent?: number } | null;
}
interface GtList {
  meta?: { total_count?: number };
  objects: GtBill[];
}

export function apiUrl(w: WatchedBill): string {
  return `https://www.govtrack.us/api/v2/bill?congress=${w.congress}&bill_type=${TYPE[w.type]}&number=${w.number}`;
}

/** Normalize the prognosis field to a 0–100 percentage, or null if absent. */
export function prognosisPct(b: GtBill): number | null {
  const p = b.prognosis;
  if (p === null || p === undefined) return null;
  const raw = typeof p === 'number' ? p : (p.percent ?? p.prediction ?? null);
  if (raw === null || !Number.isFinite(raw)) return null;
  return raw <= 1 ? raw * 100 : raw;
}

export const govtrack: Source = {
  id: 'govtrack',
  tier: 1,
  cadence: 'daily',
  async fetch(ctx: FetchContext): Promise<SourceResult[]> {
    const fetchedAt = `${ctx.today}T00:00:00Z`;
    let best: { pct: number; w: WatchedBill; b: GtBill } | null = null;
    let found = 0;
    for (const w of loadWatchlist()) {
      const res = await ctx.http.getJson<GtList>(apiUrl(w));
      const b = res.objects[0];
      if (!b) continue;
      found++;
      const pct = prognosisPct(b);
      if (pct !== null && (!best || pct > best.pct)) best = { pct, w, b };
    }
    if (found === 0) throw new Error('GovTrack: no watched bills found');
    if (!best) return []; // reachable, but no prognosis published: nothing to record
    return [
      {
        metricId: 'politics.govtrack_prognosis_max',
        label: 'Best enactment prognosis (GovTrack)',
        value: Math.round(best.pct * 10) / 10,
        unit: '%',
        asOf: best.b.current_status_date?.slice(0, 10) ?? ctx.today,
        fetchedAt,
        sourceName: `GovTrack, ${billLabel(best.w)}`,
        sourceUrl: best.b.link,
        note: best.b.current_status_label,
      },
    ];
  },
};
