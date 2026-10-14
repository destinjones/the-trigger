/**
 * Federal Register API v1. No key.
 *
 * Counts presidential documents (executive orders, memoranda, proclamations)
 * published in the trailing 12 months whose full text mentions "artificial
 * intelligence". It is a blunt instrument: it measures how often the
 * executive branch is acting on AI at all, not whether it is acting on income.
 */
import type { ActorRecord, FetchContext, RichSource, SourceOutput } from './_types.ts';

interface FrDoc {
  title: string;
  html_url: string;
  publication_date: string;
  document_number: string;
  type: string;
}
interface FrList {
  count: number;
  results?: FrDoc[];
}

export function minusOneYear(iso: string): string {
  const y = Number(iso.slice(0, 4)) - 1;
  const md = iso.slice(5);
  return md === '02-29' ? `${y}-02-28` : `${y}-${md}`;
}

export function apiUrl(since: string): string {
  const p = new URLSearchParams();
  p.set('conditions[term]', '"artificial intelligence"');
  p.append('conditions[type][]', 'PRESDOCU');
  p.set('conditions[publication_date][gte]', since);
  p.set('per_page', '20');
  p.set('order', 'newest');
  for (const f of ['title', 'html_url', 'publication_date', 'document_number', 'type']) p.append('fields[]', f);
  return `https://www.federalregister.gov/api/v1/documents.json?${p.toString()}`;
}

export function searchUrl(since: string): string {
  const p = new URLSearchParams();
  p.set('conditions[term]', '"artificial intelligence"');
  p.append('conditions[type][]', 'PRESDOCU');
  p.set('conditions[publication_date][gte]', since);
  return `https://www.federalregister.gov/documents/search?${p.toString()}`;
}

export const federalRegister: RichSource = {
  id: 'federal-register',
  tier: 1,
  cadence: 'daily',
  async fetch(ctx) {
    return (await this.fetchRich(ctx)).metrics;
  },
  async fetchRich(ctx: FetchContext): Promise<SourceOutput> {
    const since = minusOneYear(ctx.today);
    const res = await ctx.http.getJson<FrList>(apiUrl(since));
    if (typeof res.count !== 'number') throw new Error('Federal Register: missing count');
    const docs = res.results ?? [];
    const latest = docs[0];
    const actors: ActorRecord[] = latest
      ? [{
          actor: 'Executive branch',
          vehicle: latest.title,
          status: `Published ${latest.publication_date}`,
          signal: 'neutral',
          asOf: latest.publication_date,
          sourceUrl: latest.html_url,
          sourceName: `Federal Register ${latest.document_number}`,
        }]
      : [];
    return {
      metrics: [
        {
          metricId: 'politics.ai_executive_actions_12mo',
          label: 'Presidential documents citing AI, 12 mo',
          value: res.count,
          unit: 'documents',
          asOf: latest?.publication_date ?? ctx.today,
          fetchedAt: `${ctx.today}T00:00:00Z`,
          sourceName: 'Federal Register API',
          sourceUrl: searchUrl(since),
          note: latest ? `Latest: ${latest.title}` : undefined,
        },
      ],
      actors,
    };
  },
};
