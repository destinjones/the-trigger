/**
 * Guaranteed-income precedent (Tier 2). Curated from guaranteedincome.us (the
 * Stanford Basic Income Lab / Center for Guaranteed Income Research dashboard)
 * and program records, in sources/curated/pilots.yaml.
 *
 * The dashboard has no API and, as of 2026-10-14, publishes no cumulative
 * totals we could confirm, so the totals are maintainer figures flagged
 * unverified in the snapshot.
 */
import { curatedSource, iso } from './_curated.ts';

export const pilots = curatedSource('pilots', 'pilots', 2, (file, today) => {
  const permanent = (file.programs ?? []).filter((p) => p.permanent);
  const newest = permanent.map((p) => iso(p.asOf)).sort().at(-1) ?? today;
  const first = [...permanent].sort((a, b) => iso(b.asOf).localeCompare(iso(a.asOf)))[0];
  return [{
    metricId: 'precedent.permanent_programs',
    label: 'Permanent cash programs',
    value: permanent.length,
    unit: 'programs',
    asOf: newest,
    fetchedAt: `${today}T00:00:00Z`,
    sourceName: first ? `${first.sourceName} (newest of ${permanent.length})` : 'sources/curated/pilots.yaml',
    sourceUrl: first?.sourceUrl ?? 'https://guaranteedincome.us/',
    note: permanent.map((p) => p.name).join('; '),
  }];
});
