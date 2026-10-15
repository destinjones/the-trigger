/**
 * The wire: recent, timestamped events for the scrolling strip, generated from
 * the snapshots. Changes since the previous snapshot come first, then the
 * newest dated upstream records in the latest one. Source health is left out:
 * it has its own status panel, and the wire is for news. Pure.
 */
import type { Snapshot } from '../../../scripts/lib/run.ts';
import { fmtNumber } from './format.ts';
import { diffSnapshots } from './log.ts';

export interface WireItem { date: string; text: string; href?: string }

export function wireItems(latest: Snapshot, previous: Snapshot | null, limit = 14): WireItem[] {
  const changes: WireItem[] = previous
    ? diffSnapshots(previous, latest).filter((c) => c.kind !== 'source').map((c) => ({ date: latest.date, text: c.text.replace(/\.$/, ''), href: c.href }))
    : [];
  const records: WireItem[] = [
    ...latest.metrics.map((m) => ({ date: m.asOf, text: `${m.label ?? m.metricId}: ${fmtNumber(m.value, m.unit)}`, href: m.sourceUrl })),
    ...latest.bills.map((b) => ({ date: b.date, text: `${b.title}: ${b.latestAction}`, href: b.sourceUrl })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return [...changes, ...records].slice(0, limit);
}
