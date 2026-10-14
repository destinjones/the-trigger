/**
 * Congress.gov API v3. Free key (CONGRESS_API_KEY); falls back to the shared
 * api.data.gov DEMO_KEY, which allows a handful of calls per hour — enough for
 * the daily run over a short watchlist.
 *
 * For each watched bill: the bill record (co-sponsors, latest action) and its
 * full action list, from which we decide whether it has moved past referral.
 */
import type { BillRecord, FetchContext, RichSource, SourceOutput, SourceResult } from './_types.ts';
import { billKey, billLabel, congressFor, loadWatchlist, type WatchedBill } from './_watchlist.ts';

interface CgBill {
  bill: {
    congress: number;
    number: string;
    type: string;
    title: string;
    introducedDate: string;
    legislationUrl: string;
    cosponsors?: { count: number };
    latestAction?: { actionDate: string; text: string };
    sponsors?: { fullName: string }[];
  };
}
interface CgAction {
  actionDate: string;
  text: string;
  type?: string;
  actionCode?: string;
}
interface CgActions {
  actions: CgAction[];
}

const BASE = 'https://api.congress.gov/v3';

/**
 * An action counts as movement if it is anything beyond introduction and
 * referral: a hearing, markup, report, discharge, floor action, or passage.
 */
export function isMovement(a: CgAction): boolean {
  if (a.type === 'IntroReferral') return false;
  if (/^(introduced|read twice|referred to|sponsor introductory remarks)/i.test(a.text.trim())) return false;
  return true;
}

export function isEnacted(actions: CgAction[]): boolean {
  return actions.some((a) => a.type === 'BecameLaw' || /became public law/i.test(a.text));
}

export function billStatus(actions: CgAction[], congress: number, today: string): BillRecord['status'] {
  if (isEnacted(actions)) return 'passed';
  if (congress < congressFor(today)) return 'expired';
  if (actions.some((a) => /referred to/i.test(a.text))) return 'in committee';
  return 'proposed';
}

export function summarizeBill(w: WatchedBill, bill: CgBill, actions: CgActions, today: string): BillRecord & { moved: boolean } {
  const b = bill.bill;
  return {
    id: billKey(w),
    title: `${billLabel(w)} ${w.short}`,
    date: b.latestAction?.actionDate ?? b.introducedDate,
    status: billStatus(actions.actions, w.congress, today),
    cosponsors: b.cosponsors?.count ?? 0,
    latestAction: b.latestAction?.text ?? 'Introduced',
    sourceUrl: b.legislationUrl,
    sourceName: 'Congress.gov',
    moved: actions.actions.some(isMovement),
  };
}

export const congress: RichSource = {
  id: 'congress',
  tier: 1,
  cadence: 'daily',
  async fetch(ctx) {
    return (await this.fetchRich(ctx)).metrics;
  },
  async fetchRich(ctx: FetchContext): Promise<SourceOutput> {
    const key = ctx.env.CONGRESS_API_KEY || 'DEMO_KEY';
    const q = `?api_key=${encodeURIComponent(key)}&format=json`;
    const fetchedAt = `${ctx.today}T00:00:00Z`;
    const watch = loadWatchlist();

    const bills: (BillRecord & { moved: boolean })[] = [];
    for (const w of watch) {
      // Sequential on purpose: DEMO_KEY is rate limited.
      const path = `${BASE}/bill/${w.congress}/${w.type}/${w.number}`;
      const bill = await ctx.http.getJson<CgBill>(`${path}${q}`);
      const actions = await ctx.http.getJson<CgActions>(`${path}/actions${q}`);
      bills.push(summarizeBill(w, bill, actions, ctx.today));
    }

    const live = bills.filter((b) => b.status !== 'expired');
    const moved = live.filter((b) => b.moved);
    const cosponsors = live.reduce((a, b) => a + b.cosponsors, 0);
    const listUrl = 'https://github.com/cwbhood/the-trigger/blob/main/sources/watchlist.yaml';
    const top = [...live].sort((a, b) => b.cosponsors - a.cosponsors)[0];
    const asOf = live.map((b) => b.date).sort().at(-1) ?? ctx.today;

    const metrics: SourceResult[] = [
      {
        metricId: 'politics.bills_with_committee_movement',
        label: 'Bills with committee movement',
        value: moved.length,
        unit: 'bills',
        asOf,
        fetchedAt,
        sourceName: `Congress.gov actions, ${live.length} watched bills`,
        // When nothing has moved, link the bill people most expect to move.
        sourceUrl: (moved[0] ?? top)?.sourceUrl ?? listUrl,
        note: moved.length ? moved.map((b) => b.title).join('; ') : `0 of ${live.length} watched bills past referral`,
      },
      {
        metricId: 'politics.cosponsors_total',
        label: 'Co-sponsors, watched bills',
        value: cosponsors,
        unit: 'co-sponsors',
        asOf,
        fetchedAt,
        sourceName: 'Congress.gov bill records',
        sourceUrl: top ? `${top.sourceUrl}/cosponsors` : listUrl,
        note: live.map((b) => `${b.title.split(' ').slice(0, 2).join(' ')}: ${b.cosponsors}`).join(', '),
      },
    ];
    return { metrics, bills: bills.map(({ moved: _moved, ...rest }) => rest) };
  },
};
