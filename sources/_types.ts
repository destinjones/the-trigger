/**
 * The uniform contract every source module implements.
 *
 * A source fetches upstream records and returns raw values with a deep link to
 * the record each value came from. Normalization to 0–100 happens later, in
 * index/normalize.ts, so a source never needs to know how it is scored.
 */

export interface SourceResult {
  /** Stable metric key, e.g. "labor.unemployment_rate". */
  metricId: string;
  value: number;
  unit: string;
  /** ISO date of the underlying observation (not the fetch). */
  asOf: string;
  /** ISO timestamp of the fetch that produced this value. */
  fetchedAt: string;
  sourceName: string;
  /** Deep link to the actual record, not the homepage. */
  sourceUrl: string;
  /** Upstream revision counter, when the publisher revises (BLS does). */
  revision?: number;
  /** Human-readable label for the UI. */
  label?: string;
  /** True when the live fetch failed and this is the last known value carried forward. */
  stale?: boolean;
  /** Free-form note shown under the number (method, caveat). */
  note?: string;
  /** Id of the Source that produced this value. Set by the snapshot runner. */
  sourceId?: string;
}

export interface FetchContext {
  /** ISO date. Sources should not look further back than this unless they need a baseline. */
  since: string;
  /** ISO date of the snapshot being built. Sources must use this, not the wall clock, for windows. */
  today: string;
  /** Injected HTTP layer so runs can be recorded and replayed. */
  http: Http;
  env: Readonly<Record<string, string | undefined>>;
}

export interface Source {
  id: string;
  tier: 1 | 2 | 3;
  cadence: 'daily' | 'weekly' | 'monthly';
  fetch(ctx: FetchContext): Promise<SourceResult[]>;
}

/** Records shown in the UI that are not single numbers: bills, actors, filings. */
export interface BillRecord {
  id: string;            // e.g. "hr5830-119"
  title: string;
  date: string;          // ISO date of latest action
  status: 'passed' | 'in committee' | 'proposed' | 'expired';
  cosponsors: number;
  latestAction: string;
  sourceUrl: string;
  sourceName: string;
}

export interface ActorRecord {
  actor: string;
  vehicle: string;
  status: string;
  signal: 'toward' | 'away' | 'neutral';
  asOf: string;
  sourceUrl: string;
  sourceName: string;
}

export interface FilingRecord {
  company: string;
  ticker: string;
  fiscalYear: number;
  capexUsd: number;
  capexYoyPct: number | null;
  headcount: number | null;
  headcountYoyPct: number | null;
  sourceUrl: string;
}

export interface Http {
  getJson<T = unknown>(url: string, init?: { headers?: Record<string, string> }): Promise<T>;
  getText(url: string, init?: { headers?: Record<string, string> }): Promise<string>;
  postJson<T = unknown>(url: string, body: unknown, init?: { headers?: Record<string, string> }): Promise<T>;
}

/** Optional richer output: sources may attach records alongside their metrics. */
export interface SourceOutput {
  metrics: SourceResult[];
  bills?: BillRecord[];
  actors?: ActorRecord[];
  filings?: FilingRecord[];
}

export interface RichSource extends Source {
  fetchRich(ctx: FetchContext): Promise<SourceOutput>;
}

export function isRich(s: Source): s is RichSource {
  return typeof (s as Partial<RichSource>).fetchRich === 'function';
}
