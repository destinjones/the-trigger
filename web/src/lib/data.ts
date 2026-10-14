/**
 * Build-time data access. Everything the site renders comes from committed
 * files: data/*.json (the time series), predictions/ledger.json, and the
 * weights file. Nothing is fetched in the browser.
 */
import type { Snapshot } from '../../../scripts/lib/run.ts';
import type { SourceResult } from '../../../sources/_types.ts';
import { parseWeights } from '../../../index/model.ts';
import ledgerJson from '../../../predictions/ledger.json';

export type { Snapshot };

export const REPO_URL = (import.meta.env.REPO_URL as string | undefined) ?? 'https://github.com/destinjones/the-trigger';

const files = import.meta.glob<Snapshot>('../../../data/*.json', { eager: true, import: 'default' });

/** All snapshots, oldest first. */
export const snapshots: Snapshot[] = Object.entries(files)
  .filter(([path]) => /\d{4}-\d{2}-\d{2}\.json$/.test(path))
  .map(([, s]) => s)
  .sort((a, b) => a.date.localeCompare(b.date));

if (snapshots.length === 0) throw new Error('No snapshots in data/. Run `pnpm snapshot` first.');

export const latest = snapshots[snapshots.length - 1] as Snapshot;
export const previous: Snapshot | null = snapshots.length > 1 ? (snapshots[snapshots.length - 2] as Snapshot) : null;

/** The weights file the latest snapshot was scored with, so labels and groups match its numbers. */
const weightFiles = import.meta.glob<string>('../../../index/weights.v*.yaml', { eager: true, query: '?raw', import: 'default' });
const weightsText = Object.entries(weightFiles).find(([p]) => p.endsWith(`/weights.${latest.weightsVersion}.yaml`))?.[1];
if (!weightsText) throw new Error(`No index/weights.${latest.weightsVersion}.yaml for the latest snapshot`);
export const weights = parseWeights(weightsText);
export const weightsPath = `index/weights.${latest.weightsVersion}.yaml`;

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

/** Monthly AI-attributed cuts from the curated Challenger file, for the gap chart. */
import challengerText from '../../../sources/curated/challenger.yaml?raw';
import { parse as parseYaml } from 'yaml';
import type { MonthlyCuts } from './gap.ts';
export const challengerMonthly: MonthlyCuts[] = ((parseYaml(challengerText) as { monthly?: MonthlyCuts[] }).monthly ?? []);
export const billsObserved = snapshots.flatMap((s) => {
  const m = s.metrics.find((x) => x.metricId === 'politics.bills_with_committee_movement');
  return m ? [{ date: s.date, bills: m.value }] : [];
});
