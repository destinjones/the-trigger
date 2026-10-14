/**
 * Hand-curated sources: upstream publishers with no API (Challenger, polls,
 * pilot dashboards, corporate announcements). A maintainer edits
 * sources/curated/*.yaml with a deep link for every value; the runner treats
 * the file as a source like any other.
 *
 * A curated file fails (and its last values go stale) when nobody has
 * re-reviewed it within `maxAgeDays` of the snapshot date. That keeps a
 * forgotten YAML file from silently propping up the score.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ActorRecord, FetchContext, RichSource, SourceOutput, SourceResult } from './_types.ts';

export interface CuratedMetric extends Omit<SourceResult, 'fetchedAt' | 'asOf'> {
  asOf: string | Date;
  verified?: boolean;
}
export interface CuratedFile {
  reviewedOn: string | Date;
  maxAgeDays: number;
  metrics?: CuratedMetric[];
  actors?: (Omit<ActorRecord, 'asOf'> & { asOf: string | Date })[];
  programs?: { name: string; permanent: boolean; asOf: string | Date; sourceUrl: string; sourceName: string; detail: string; jurisdiction: string; since: number }[];
}

/** YAML parses bare dates into Date objects; normalize to ISO strings. */
export function iso(d: string | Date): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function loadCurated(name: string): CuratedFile {
  const text = readFileSync(fileURLToPath(new URL(`./curated/${name}.yaml`, import.meta.url)), 'utf8');
  return parse(text) as CuratedFile;
}

export function curatedOutput(file: CuratedFile, name: string, today: string): SourceOutput {
  const reviewed = iso(file.reviewedOn);
  const age = daysBetween(today, reviewed);
  if (age > file.maxAgeDays) {
    throw new Error(`curated/${name}.yaml last reviewed ${reviewed} (${age} days ago, limit ${file.maxAgeDays})`);
  }
  if (age < 0) throw new Error(`curated/${name}.yaml reviewedOn ${reviewed} is after the snapshot date`);
  const fetchedAt = `${today}T00:00:00Z`;
  const metrics: SourceResult[] = (file.metrics ?? []).map(({ verified, ...m }) => ({
    ...m,
    asOf: iso(m.asOf),
    fetchedAt,
    note: verified === false && m.note && !/not (independently )?confirmed|unverified/i.test(m.note)
      ? `${m.note} (unverified)` : m.note,
  }));
  const actors = (file.actors ?? []).map((a) => ({ ...a, asOf: iso(a.asOf) }));
  return { metrics, actors };
}

export function curatedSource(id: string, name: string, tier: 1 | 2 | 3, extra?: (f: CuratedFile, today: string) => SourceResult[]): RichSource {
  return {
    id,
    tier,
    cadence: 'monthly',
    async fetch(ctx) {
      return (await this.fetchRich(ctx)).metrics;
    },
    async fetchRich(ctx: FetchContext) {
      const file = loadCurated(name);
      const out = curatedOutput(file, name, ctx.today);
      if (extra) out.metrics.push(...extra(file, ctx.today));
      return out;
    },
  };
}
