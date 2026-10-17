/** One row per snapshot: the headline numbers only, for charts and embeds. Full records are in data/. */
import { REPO_URL, snapshots } from '../../lib/data.ts';

export function GET(): Response {
  const rows = snapshots.map((s) => ({
    date: s.date,
    revision: s.revision,
    weightsVersion: s.weightsVersion,
    readiness: s.readiness,
    projectedDate: s.projectedDate,
    confidence: s.confidence,
    bandMonths: s.bandMonths,
    subIndices: s.subIndices,
    sourcesFailed: s.sourcesFailed,
    snapshotUrl: `${REPO_URL}/blob/main/data/${s.date}.json`,
  }));
  return new Response(JSON.stringify({ snapshots: rows }, null, 2) + '\n', { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
