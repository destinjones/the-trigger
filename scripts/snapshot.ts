/**
 * pnpm snapshot [-- options]
 *
 *   --date YYYY-MM-DD   snapshot date (default: today, UTC)
 *   --weights vN        weights version to score with (default: v2)
 *   --record FILE       live run, and save every HTTP response to a cassette
 *   --replay FILE       build from a cassette instead of the network
 *   --revise            allow writing a new revision of a past date
 *   --dry-run           print, do not write
 *
 * Writes data/YYYY-MM-DD.json. Never rewrites a past date without --revise;
 * a revision bumps the `revision` field and lands as a new commit.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseWeights } from '../index/model.ts';
import { liveHttp, recordingHttp, replayHttp } from '../sources/_http.ts';
import { SOURCES } from '../sources/index.ts';
import { assemble, runSources, type Snapshot } from './lib/run.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'data');

const { values: args } = parseArgs({
  options: {
    date: { type: 'string' },
    weights: { type: 'string', default: 'v2' },
    record: { type: 'string' },
    replay: { type: 'string' },
    revise: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const date = args.date ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD, got ${date}`);

export function listSnapshots(dir = DATA): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
}

function readSnapshot(file: string): Snapshot {
  return JSON.parse(readFileSync(join(DATA, file), 'utf8')) as Snapshot;
}

async function main(): Promise<void> {
  const weights = parseWeights(readFileSync(join(ROOT, 'index', `weights.${args.weights}.yaml`), 'utf8'));
  const files = listSnapshots();
  const target = `${date}.json`;
  const existing = files.includes(target) ? readSnapshot(target) : null;
  const today = new Date().toISOString().slice(0, 10);
  if (existing && date < today && !args.revise) {
    throw new Error(`${target} already exists. Past snapshots are immutable; pass --revise to publish a correction.`);
  }
  const prevFile = files.filter((f) => f < target).at(-1);
  const previous = existing ?? (prevFile ? readSnapshot(prevFile) : null);

  const http = args.replay
    ? replayHttp(args.replay)
    : args.record ? recordingHttp(args.record, date) : liveHttp();

  const since = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  console.log(`snapshot ${date}  weights ${weights.version}  ${args.replay ? `replay ${args.replay}` : 'live'}`);
  const run = await runSources(SOURCES, { since, today: date, http, env: process.env }, previous, (m) => console.log('  ' + m));

  const snap = assemble(date, existing ? existing.revision + 1 : 0, weights, run);
  const json = JSON.stringify(snap, null, 2) + '\n';

  console.log(`\nreadiness ${snap.readiness}  projected ${snap.projectedDate} ±${snap.bandMonths}mo  confidence ${Math.round(snap.confidence * 100)}%`);
  console.log(`coverage ${snap.sourceCoveragePct}% of sources, ${Math.round(snap.weightCovered * 100)}% of index weight`);
  for (const [k, v] of Object.entries(snap.subIndices)) console.log(`  ${k.padEnd(20)} ${v === null ? '—' : v}`);

  if (args['dry-run']) return;
  writeFileSync(join(DATA, target), json);
  console.log(`\nwrote data/${target} (revision ${snap.revision})`);

  if (run.ok.length === 0) {
    // Every feed down: the file still records it, but fail the job so someone looks.
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
