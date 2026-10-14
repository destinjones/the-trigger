/**
 * National polling on a federal basic income (Tier 2, curated in
 * sources/curated/polling.yaml).
 *
 * One poll is an anecdote, so the metric is a weighted mean over every poll
 * listed in the file:
 *
 *   weight = sqrt(n) × 0.5^(age / 365 days) × (0.5 if the sponsor is partisan)
 *
 * sqrt(n) because sampling error shrinks with sqrt(n), so a 4,000-person poll
 * is worth twice a 1,000-person one, not four times. A one-year half-life
 * because opinion on this question moves slowly but does move. Partisan
 * sponsors (left or right) count half, not zero: they are still data. Polls
 * older than three years drop out. Question wording varies a lot between
 * pollsters; the note on each poll in the YAML records it.
 */
import type { SourceResult } from './_types.ts';
import { curatedSource, daysBetween, iso } from './_curated.ts';

export interface Poll {
  pollster: string;
  sponsor?: string;
  fieldEnd: string | Date;
  n: number;
  support: number;
  oppose?: number;
  /** 'left' | 'right' when the sponsor or pollster has a partisan lean. */
  partisan?: 'left' | 'right' | null;
  question: string;
  sourceUrl: string;
}

export const POLL_HALF_LIFE_DAYS = 365;
export const POLL_MAX_AGE_DAYS = 365 * 3;

export function pollWeight(p: Poll, today: string): number {
  const age = daysBetween(today, iso(p.fieldEnd));
  if (age < 0 || age > POLL_MAX_AGE_DAYS || !(p.n > 0)) return 0;
  return Math.sqrt(p.n) * 0.5 ** (age / POLL_HALF_LIFE_DAYS) * (p.partisan ? 0.5 : 1);
}

export interface PollAggregate {
  support: number;
  used: (Poll & { weight: number; share: number })[];
}

export function aggregatePolls(polls: Poll[], today: string): PollAggregate | null {
  const weighted = polls.map((p) => ({ ...p, weight: pollWeight(p, today) })).filter((p) => p.weight > 0);
  const total = weighted.reduce((a, p) => a + p.weight, 0);
  if (total === 0) return null;
  const support = weighted.reduce((a, p) => a + p.support * p.weight, 0) / total;
  const used = weighted
    .map((p) => ({ ...p, share: p.weight / total }))
    .sort((a, b) => b.share - a.share);
  return { support, used };
}

function pollMetric(file: { polls?: Poll[] }, today: string): SourceResult[] {
  const agg = aggregatePolls(file.polls ?? [], today);
  if (!agg) return [];
  const [top] = agg.used;
  if (!top) return [];
  const partisan = agg.used.filter((p) => p.partisan).length;
  return [{
    metricId: 'opinion.ubi_support_pct',
    label: 'Support for a basic income, poll average',
    value: Math.round(agg.support * 10) / 10,
    unit: '%',
    asOf: agg.used.map((p) => iso(p.fieldEnd)).sort().at(-1) ?? today,
    fetchedAt: `${today}T00:00:00Z`,
    sourceName: `Weighted mean of ${agg.used.length} national polls`,
    // The heaviest poll; every poll and its link is in sources/curated/polling.yaml.
    sourceUrl: top.sourceUrl,
    note: agg.used.map((p) => `${p.pollster} ${p.support}%${p.partisan ? ` (${p.partisan})` : ''}`).join(', ')
      + (partisan ? `. Partisan sponsors at half weight` : ''),
  }];
}

export const polling = curatedSource('polling', 'polling', 2, (f, today) => pollMetric(f as { polls?: Poll[] }, today));
