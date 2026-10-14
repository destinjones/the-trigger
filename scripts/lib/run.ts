/**
 * Runs every source, isolates failures, and carries forward last known values.
 * No file I/O here so it can be unit tested; scripts/snapshot.ts does the I/O.
 */
import type {
  ActorRecord, BillRecord, FetchContext, FilingRecord, Source, SourceResult,
} from '../../sources/_types.ts';
import { isRich } from '../../sources/_types.ts';
import { buildSnapshot, type SnapshotCore, type Weights } from '../../index/model.ts';

export interface Snapshot extends SnapshotCore {
  bills: BillRecord[];
  actors: ActorRecord[];
  filings: FilingRecord[];
  /** Why each failed source failed, for the run log and the UI. */
  sourceErrors: Record<string, string>;
  /** Sources not attempted because a required key was not configured. */
  sourcesSkipped: string[];
}

export interface RunResult {
  metrics: SourceResult[];
  bills: BillRecord[];
  actors: ActorRecord[];
  filings: FilingRecord[];
  ok: string[];
  failed: string[];
  skipped: string[];
  errors: Record<string, string>;
}

const TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, id: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${id}: timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e: unknown) => { clearTimeout(t); reject(e); });
  });
}

function validate(r: SourceResult, id: string): void {
  if (!r.metricId || !Number.isFinite(r.value)) throw new Error(`${id}: invalid value for ${r.metricId}`);
  if (!/^https?:\/\//.test(r.sourceUrl)) throw new Error(`${id}: ${r.metricId} has no deep link`);
  if (!/^\d{4}-\d{2}-\d{2}/.test(r.asOf)) throw new Error(`${id}: ${r.metricId} has a bad asOf`);
}

/**
 * Run all sources. A source that throws (or returns invalid data) is recorded
 * in `failed`, and its metrics from `previous` are reused with `stale: true`.
 * A source that returns zero metrics is OK, not failed (nothing to report).
 */
export async function runSources(
  sources: readonly Source[],
  ctx: FetchContext,
  previous: Snapshot | null,
  log: (msg: string) => void = () => {},
): Promise<RunResult> {
  const out: RunResult = { metrics: [], bills: [], actors: [], filings: [], ok: [], failed: [], skipped: [], errors: {} };

  for (const s of sources) {
    if (s.requiresEnv && !ctx.env[s.requiresEnv]) {
      out.skipped.push(s.id);
      log(`skip   ${s.id.padEnd(18)} ${s.requiresEnv} not set`);
      continue;
    }
    try {
      const res = isRich(s)
        ? await withTimeout(s.fetchRich(ctx), TIMEOUT_MS, s.id)
        : { metrics: await withTimeout(s.fetch(ctx), TIMEOUT_MS, s.id) };
      res.metrics.forEach((m) => validate(m, s.id));
      out.metrics.push(...res.metrics.map((m) => ({ ...m, sourceId: s.id })));
      out.bills.push(...(res.bills ?? []));
      out.actors.push(...(res.actors ?? []));
      out.filings.push(...(res.filings ?? []));
      out.ok.push(s.id);
      log(`ok     ${s.id.padEnd(18)} ${res.metrics.length} metrics`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.failed.push(s.id);
      out.errors[s.id] = msg;
      const carried = (previous?.metrics ?? [])
        .filter((m) => m.sourceId === s.id)
        .map((m) => ({ ...m, stale: true }));
      out.metrics.push(...carried);
      if (previous) {
        // Records are keyed by source via their sourceName/sourceUrl; carry the
        // previous ones forward only if this source produced them.
        if (s.id === 'congress') out.bills.push(...previous.bills);
        if (s.id === 'edgar') out.filings.push(...previous.filings);
      }
      log(`FAILED ${s.id.padEnd(18)} ${msg}${carried.length ? ` (carried ${carried.length} stale)` : ''}`);
    }
  }
  return out;
}

export function assemble(date: string, revision: number, weights: Weights, run: RunResult): Snapshot {
  const core = buildSnapshot({
    date, revision, weights,
    metrics: run.metrics,
    sourcesOk: run.ok,
    sourcesFailed: run.failed,
  });
  return {
    ...core,
    bills: [...run.bills].sort((a, b) => b.date.localeCompare(a.date)),
    actors: run.actors,
    filings: [...run.filings].sort((a, b) => a.company.localeCompare(b.company)),
    sourceErrors: run.errors,
    sourcesSkipped: [...run.skipped].sort(),
  };
}
