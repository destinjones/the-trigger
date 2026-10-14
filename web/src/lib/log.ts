/**
 * "What moved": a changelog written from the snapshots themselves. Each week's
 * entry diffs that week's last snapshot against the previous week's last
 * snapshot. Pure: snapshots in, entries out, so the /log page and the RSS feed
 * render the same words.
 */
import type { Snapshot } from '../../../scripts/lib/run.ts';
import { fmtDelta, fmtNumber } from './format.ts';

export interface Change {
  kind: 'score' | 'metric' | 'source' | 'bill' | 'model';
  text: string;
  /** Deep link backing the change, when there is one. */
  href?: string;
}

export interface LogEntry {
  /** ISO week label, e.g. "2026-W42". */
  week: string;
  /** Date of the snapshot the entry describes. */
  date: string;
  /** Date of the snapshot it is compared against; null for the first entry. */
  since: string | null;
  changes: Change[];
  /** Short line for feed titles. */
  summary: string;
}

/** ISO 8601 week of a YYYY-MM-DD date. */
export function isoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const signed = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;

export function diffSnapshots(prev: Snapshot, cur: Snapshot): Change[] {
  const out: Change[] = [];

  if (prev.weightsVersion !== cur.weightsVersion) {
    out.push({ kind: 'model', text: `Weights changed from ${prev.weightsVersion} to ${cur.weightsVersion}. Score moves below include the reweighting.` });
  }
  const dr = cur.readiness - prev.readiness;
  if (Math.abs(dr) >= 0.05) {
    out.push({ kind: 'score', text: `Readiness ${prev.readiness.toFixed(1)} → ${cur.readiness.toFixed(1)} (${signed(dr)}).` });
  }
  if (prev.projectedDate !== cur.projectedDate) {
    out.push({ kind: 'score', text: `Projected first check moved from ${prev.projectedDate} to ${cur.projectedDate}.` });
  }

  const before = new Map(prev.metrics.map((m) => [m.metricId, m]));
  for (const m of cur.metrics) {
    const p = before.get(m.metricId);
    const label = m.label ?? m.metricId;
    if (!p) {
      out.push({ kind: 'metric', text: `New: ${label}, ${fmtNumber(m.value, m.unit)}.`, href: m.sourceUrl });
    } else if (p.value !== m.value) {
      out.push({
        kind: 'metric',
        text: `${label}: ${fmtNumber(p.value, p.unit)} → ${fmtNumber(m.value, m.unit)} (${fmtDelta(m.value, p.value, m.unit)}).`,
        href: m.sourceUrl,
      });
    }
  }

  const failedBefore = new Set(prev.sourcesFailed);
  for (const s of cur.sourcesFailed) if (!failedBefore.has(s)) out.push({ kind: 'source', text: `${s} started failing; its last values are carried forward as stale.` });
  for (const s of prev.sourcesFailed) if (!cur.sourcesFailed.includes(s) && cur.sourcesOk.includes(s)) out.push({ kind: 'source', text: `${s} is back.` });

  const billsBefore = new Map(prev.bills.map((b) => [b.id, b]));
  for (const b of cur.bills) {
    const p = billsBefore.get(b.id);
    if (!p) out.push({ kind: 'bill', text: `Now tracking ${b.title}.`, href: b.sourceUrl });
    else {
      if (p.status !== b.status) out.push({ kind: 'bill', text: `${b.title}: ${p.status} → ${b.status}.`, href: b.sourceUrl });
      if (p.cosponsors !== b.cosponsors) out.push({ kind: 'bill', text: `${b.title}: co-sponsors ${p.cosponsors} → ${b.cosponsors}.`, href: b.sourceUrl });
      if (p.latestAction !== b.latestAction && p.status === b.status) out.push({ kind: 'bill', text: `${b.title}: ${b.latestAction}.`, href: b.sourceUrl });
    }
  }
  return out;
}

/** Bills that did not move are news too: say so, so a quiet week reads as quiet, not as missing data. */
function stillStuck(cur: Snapshot, changes: Change[]): Change[] {
  const moved = new Set(changes.filter((c) => c.kind === 'bill').map((c) => c.href));
  return cur.bills
    .filter((b) => b.status === 'in committee' && !moved.has(b.sourceUrl))
    .map((b) => ({ kind: 'bill' as const, text: `${b.title} still in committee (last action ${b.date}).`, href: b.sourceUrl }));
}

function summarize(changes: Change[], cur: Snapshot): string {
  const score = changes.find((c) => c.kind === 'score' && c.text.startsWith('Readiness'));
  const n = changes.filter((c) => c.kind === 'metric').length;
  return `${score ? score.text.replace(/\.$/, '') : `Readiness ${cur.readiness.toFixed(1)}, unchanged`}; ${n} input${n === 1 ? '' : 's'} moved.`;
}

/** Newest first. `snapshots` must be sorted oldest first. */
export function weeklyLog(snapshots: Snapshot[]): LogEntry[] {
  const lastOfWeek = new Map<string, Snapshot>();
  for (const s of snapshots) lastOfWeek.set(isoWeek(s.date), s);
  const weeks = [...lastOfWeek.entries()];
  const entries: LogEntry[] = weeks.map(([week, cur], i) => {
    const prev = i > 0 ? weeks[i - 1]?.[1] ?? null : null;
    if (!prev) {
      return {
        week, date: cur.date, since: null,
        changes: [{ kind: 'score', text: `First snapshot. Readiness ${cur.readiness.toFixed(1)}, first federal check projected ${cur.projectedDate} ±${cur.bandMonths} months.` }],
        summary: `First snapshot: readiness ${cur.readiness.toFixed(1)}.`,
      };
    }
    const changes = diffSnapshots(prev, cur);
    return { week, date: cur.date, since: prev.date, changes: [...changes, ...stillStuck(cur, changes)], summary: summarize(changes, cur) };
  });
  return entries.reverse();
}
