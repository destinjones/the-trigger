/**
 * Build-time data access. Everything the site renders comes from committed
 * files: data/*.json (the time series), predictions/ledger.json, and the
 * weights file. Nothing is fetched in the browser.
 */
import type { Snapshot } from '../../../scripts/lib/run.ts';
import type { SourceResult } from '../../../sources/_types.ts';
import { parseWeights } from '../../../index/model.ts';
import weightsText from '../../../index/weights.v1.yaml?raw';
import ledgerJson from '../../../predictions/ledger.json';

export type { Snapshot };

export const REPO_URL = (import.meta.env.REPO_URL as string | undefined) ?? 'https://github.com/cwbhood/the-trigger';
export const weights = parseWeights(weightsText);

const files = import.meta.glob<Snapshot>('../../../data/*.json', { eager: true, import: 'default' });

/** All snapshots, oldest first. */
export const snapshots: Snapshot[] = Object.entries(files)
  .filter(([path]) => /\d{4}-\d{2}-\d{2}\.json$/.test(path))
  .map(([, s]) => s)
  .sort((a, b) => a.date.localeCompare(b.date));

if (snapshots.length === 0) throw new Error('No snapshots in data/. Run `pnpm snapshot` first.');

export const latest = snapshots[snapshots.length - 1] as Snapshot;
export const previous: Snapshot | null = snapshots.length > 1 ? (snapshots[snapshots.length - 2] as Snapshot) : null;

export function snapshotUrl(s: Snapshot): string {
  return `${REPO_URL}/blob/main/data/${s.date}.json`;
}
export function historyUrl(path: string): string {
  return `${REPO_URL}/commits/main/${path}`;
}
export function fileUrl(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}

export function metric(s: Snapshot | null, id: string): SourceResult | undefined {
  return s?.metrics.find((m) => m.metricId === id);
}

/** One value per snapshot date for a metric or a top-level field. */
export function series(pick: (s: Snapshot) => number | null | undefined): { date: string; value: number }[] {
  return snapshots
    .map((s) => ({ date: s.date, value: pick(s) }))
    .filter((p): p is { date: string; value: number } => typeof p.value === 'number' && Number.isFinite(p.value));
}

export interface Prediction {
  id: string;
  madeOn: string;
  claim: string;
  resolvesBy: string;
  confidence: number;
  status: 'open' | 'hit' | 'miss';
  resolvedOn?: string | null;
  evidenceUrl?: string | null;
  weightsVersion?: string;
}
export const ledger = ledgerJson as { predictions: Prediction[] };
