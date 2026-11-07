/**
 * Chain integrity: each snapshot checked against the one before it.
 *
 * The runner's safety story is "a failed source carries its last value forward,
 * marked stale". This checks that story held: a stale value is exactly the
 * previous day's value, every metric of a failed source is stale, and nothing
 * is stale that should not be. Pure; scripts/audit-chain.ts reads data/.
 */

export interface ChainMetric {
  metricId: string;
  value: number;
  asOf: string;
  sourceUrl: string;
  stale?: boolean;
  sourceId?: string;
}

export interface ChainSnapshot {
  date: string;
  metrics: ChainMetric[];
  sourcesFailed: string[];
  sourcesSkipped?: string[];
}

export interface ChainReport {
  /** The chain is broken: fail. */
  problems: string[];
  /** Worth a look, not necessarily wrong (a source may legitimately stop returning a metric). */
  warnings: string[];
}

/**
 * Known one-off breaks, recorded rather than rewritten. Key: `${date}:${metricId}`.
 * Add an entry only with a note on why the break is legitimate.
 */
export type ChainExceptions = Readonly<Record<string, string>>;

export function auditPair(prev: ChainSnapshot, cur: ChainSnapshot, exceptions: ChainExceptions = {}): ChainReport {
  const problems: string[] = [];
  const warnings: string[] = [];
  const before = new Map(prev.metrics.map((m) => [m.metricId, m]));
  const failed = new Set(cur.sourcesFailed);
  const quiet = new Set([...cur.sourcesFailed, ...(cur.sourcesSkipped ?? [])]);
  const at = (id: string) => `${cur.date} ${id}`;
  const excused = (id: string) => `${cur.date}:${id}` in exceptions;

  for (const m of cur.metrics) {
    if (excused(m.metricId)) continue;
    const p = before.get(m.metricId);
    if (m.stale) {
      if (!p) {
        problems.push(`${at(m.metricId)} is stale but ${prev.date} has no value to carry forward`);
        continue;
      }
      for (const k of ['value', 'asOf', 'sourceUrl'] as const) {
        if (m[k] !== p[k]) problems.push(`${at(m.metricId)} is stale but its ${k} (${String(m[k])}) differs from ${prev.date} (${String(p[k])})`);
      }
      if (m.sourceId && !failed.has(m.sourceId)) problems.push(`${at(m.metricId)} is stale but its source \`${m.sourceId}\` did not fail`);
    } else if (m.sourceId && failed.has(m.sourceId)) {
      problems.push(`${at(m.metricId)} is fresh but its source \`${m.sourceId}\` failed`);
    }
  }

  const now = new Set(cur.metrics.map((m) => m.metricId));
  for (const p of prev.metrics) {
    if (now.has(p.metricId) || excused(p.metricId)) continue;
    if (p.sourceId && quiet.has(p.sourceId)) continue;
    warnings.push(`${at(p.metricId)} is missing; it was in ${prev.date} and its source \`${p.sourceId ?? '?'}\` neither failed nor was skipped`);
  }
  return { problems, warnings };
}

/** Audit every consecutive pair. `snaps` must be sorted by date. */
export function auditChain(snaps: readonly ChainSnapshot[], exceptions: ChainExceptions = {}): ChainReport {
  const out: ChainReport = { problems: [], warnings: [] };
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    if (!prev || !cur) continue;
    if (cur.date <= prev.date) {
      out.problems.push(`${cur.date} is not after ${prev.date}`);
      continue;
    }
    const r = auditPair(prev, cur, exceptions);
    out.problems.push(...r.problems);
    out.warnings.push(...r.warnings);
  }
  return out;
}
