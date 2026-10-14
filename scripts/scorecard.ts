/**
 * pnpm scorecard
 *
 * Logs the latest snapshot's projection to predictions/ledger.json (when it
 * changed), expires overdue predictions, and regenerates SCOREBOARD.md.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expire, recordProjection, renderScoreboard, type Ledger, type SnapshotLike } from './lib/scorecard.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEDGER = join(ROOT, 'predictions', 'ledger.json');

const files = readdirSync(join(ROOT, 'data')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const latestFile = files.at(-1);
let ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger;

const today = latestFile ? latestFile.slice(0, 10) : new Date().toISOString().slice(0, 10);
if (latestFile) {
  const snap = JSON.parse(readFileSync(join(ROOT, 'data', latestFile), 'utf8')) as SnapshotLike;
  ledger = recordProjection(ledger, snap);
}
ledger = expire(ledger, today);

writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
writeFileSync(join(ROOT, 'SCOREBOARD.md'), renderScoreboard(ledger, today));
console.log(`ledger: ${ledger.predictions.length} predictions; SCOREBOARD.md written`);
