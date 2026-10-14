/**
 * Corporate equity toward a public fund, and the "who's moving" roster
 * (curated in sources/curated/corporate.yaml and actors.yaml).
 *
 * Each entry in `commitments` has a status. Two metrics come out:
 *
 *   corporate.equity_commitments_usd  binding entries only, at face value
 *   corporate.equity_pipeline_usd     every entry, discounted by firmness
 *
 * The discounts are editorial and live here, next to the code that applies
 * them, so a PR that changes one shows up in one diff.
 */
import type { SourceResult } from './_types.ts';
import { curatedOutput, curatedSource, iso, loadCurated } from './_curated.ts';

export type CommitmentStatus = 'binding' | 'signed' | 'reported' | 'floated';

/** binding: legally enforceable and dated. signed: signed letter or term sheet,
 *  not yet enforceable. reported: talks reported by named outlets. floated: an
 *  op-ed, interview, or proposal with no counterparty. */
export const DISCOUNTS: Readonly<Record<CommitmentStatus, number>> = {
  binding: 1.0,
  signed: 0.6,
  reported: 0.3,
  floated: 0.15,
};

export interface Commitment {
  entity: string;
  what: string;
  status: CommitmentStatus;
  /** Face value in USD. null when the size is unknown; it is listed but counts 0. */
  valueUsd: number | null;
  /** How valueUsd was derived, e.g. "5% × $500B valuation (Reuters)". */
  basis?: string;
  asOf: string | Date;
  sourceUrl: string;
  sourceName: string;
}

export function pipeline(commitments: Commitment[]): { binding: number; discounted: number; counted: number } {
  let binding = 0, discounted = 0, counted = 0;
  for (const c of commitments) {
    const d = DISCOUNTS[c.status];
    if (d === undefined) throw new Error(`corporate.yaml: unknown status "${String(c.status)}" for ${c.entity}`);
    if (c.valueUsd === null || !(c.valueUsd > 0)) continue;
    counted++;
    discounted += c.valueUsd * d;
    if (c.status === 'binding') binding += c.valueUsd;
  }
  return { binding, discounted, counted };
}

const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B` : `$${Math.round(v / 1e6)}M`);

export function commitmentMetrics(commitments: Commitment[], today: string): SourceResult[] {
  if (commitments.length === 0) return [];
  const p = pipeline(commitments);
  const fetchedAt = `${today}T00:00:00Z`;
  const asOf = commitments.map((c) => iso(c.asOf)).sort().at(-1) ?? today;
  const largest = [...commitments].sort((a, b) => (b.valueUsd ?? 0) * DISCOUNTS[b.status] - (a.valueUsd ?? 0) * DISCOUNTS[a.status])[0];
  const firstBinding = commitments.find((c) => c.status === 'binding');
  const lead = largest ?? commitments[0];
  if (!lead) return [];
  return [
    {
      metricId: 'corporate.equity_pipeline_usd',
      label: 'AI equity pipeline, discounted',
      value: Math.round(p.discounted),
      unit: 'USD',
      asOf,
      fetchedAt,
      sourceName: lead.sourceName,
      sourceUrl: lead.sourceUrl,
      note: commitments
        .map((c) => `${c.entity}: ${c.status}${c.valueUsd ? `, ${usd(c.valueUsd)} × ${DISCOUNTS[c.status]}` : ', unsized'}`)
        .join('; '),
    },
    {
      metricId: 'corporate.equity_commitments_usd',
      label: 'Binding AI equity committed to a public fund',
      value: p.binding,
      unit: 'USD',
      asOf,
      fetchedAt,
      sourceName: (firstBinding ?? lead).sourceName,
      sourceUrl: (firstBinding ?? lead).sourceUrl,
      note: p.binding ? `${usd(p.binding)} binding` : `$0 binding. ${commitments.length} proposals tracked, none enforceable`,
    },
  ];
}

const base = curatedSource('corporate', 'corporate', 2);

export const corporate: typeof base = {
  ...base,
  async fetchRich(ctx) {
    const file = loadCurated('corporate') as ReturnType<typeof loadCurated> & { commitments?: Commitment[] };
    const out = curatedOutput(file, 'corporate', ctx.today);
    out.metrics.push(...commitmentMetrics(file.commitments ?? [], ctx.today));
    // The actor roster rides along with this source.
    out.actors = curatedOutput(loadCurated('actors'), 'actors', ctx.today).actors;
    return out;
  },
};
