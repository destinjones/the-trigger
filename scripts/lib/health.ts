/**
 * Pipeline health: what a maintainer needs to act on after a snapshot run.
 * Pure; scripts/health.ts reads the files and the snapshot workflow turns a
 * non-empty report into a GitHub issue (and closes it when the report clears).
 */

export interface HealthSnapshot {
  date: string;
  sourcesFailed: string[];
  sourcesSkipped?: string[];
  sourceErrors?: Record<string, string>;
  metrics: { metricId: string; stale?: boolean; sourceId?: string }[];
}

export interface CuratedMeta {
  name: string;
  reviewedOn: string;
  maxAgeDays: number;
}

export interface HealthReport {
  /** Something is broken now. */
  problems: string[];
  /** Something will break soon, or is degraded by configuration. */
  warnings: string[];
}

/** Warn this many days before a curated file passes its review limit. */
export const REVIEW_WARN_DAYS = 14;
/** A snapshot older than this (relative to the run date) means the daily job stopped. */
export const MAX_SNAPSHOT_AGE_DAYS = 2;

function days(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function checkHealth(snap: HealthSnapshot, curated: readonly CuratedMeta[], today: string): HealthReport {
  const problems: string[] = [];
  const warnings: string[] = [];

  const age = days(today, snap.date);
  if (age > MAX_SNAPSHOT_AGE_DAYS) problems.push(`Newest snapshot is ${snap.date}, ${age} days old. The daily job has not committed since.`);

  for (const id of [...snap.sourcesFailed].sort()) {
    const stale = snap.metrics.filter((m) => m.sourceId === id && m.stale).length;
    const why = snap.sourceErrors?.[id] ?? 'no error recorded';
    problems.push(`Source \`${id}\` failed: ${why}${stale ? ` (${stale} value${stale === 1 ? '' : 's'} carried forward as stale)` : ''}.`);
  }
  for (const id of [...(snap.sourcesSkipped ?? [])].sort()) {
    warnings.push(`Source \`${id}\` was skipped because its key or setting is not configured.`);
  }

  for (const c of curated) {
    const left = c.maxAgeDays - days(today, c.reviewedOn);
    if (left < 0) continue; // already failing: reported as a failed source above
    if (left <= REVIEW_WARN_DAYS) {
      warnings.push(`\`sources/curated/${c.name}.yaml\` was reviewed ${c.reviewedOn}; it fails in ${left} day${left === 1 ? '' : 's'} unless someone re-checks it and bumps \`reviewedOn\`.`);
    }
  }
  return { problems, warnings };
}

export function renderHealth(r: HealthReport, snapDate: string, runUrl?: string): string {
  const lines = [
    `Automated report from the snapshot job for ${snapDate}.${runUrl ? ` [Run log](${runUrl}).` : ''}`,
    '',
  ];
  if (r.problems.length) lines.push('### Broken', '', ...r.problems.map((p) => `- ${p}`), '');
  if (r.warnings.length) lines.push('### Needs attention', '', ...r.warnings.map((w) => `- ${w}`), '');
  lines.push('This issue closes itself when a snapshot run comes back clean.');
  return lines.join('\n') + '\n';
}
