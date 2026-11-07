/**
 * pnpm audit-chain
 *
 * Compares each snapshot in data/ with its predecessor: stale values must equal
 * the previous day's, and a failed source's metrics must all be stale. Exits 1
 * on a problem; warnings are printed but do not fail.
 */
import { join } from 'node:path';
import { auditChain, type ChainSnapshot } from './lib/chain.ts';
import { CHAIN_EXCEPTIONS } from './lib/chainExceptions.ts';
import { DATA, listSnapshots, readJson } from './lib/files.ts';

const files = listSnapshots();
const snaps = files.map((f) => readJson(join(DATA, f)) as ChainSnapshot);
const { problems, warnings } = auditChain(snaps, CHAIN_EXCEPTIONS);

for (const w of warnings) console.warn(`warning: ${w}`);
if (problems.length) {
  console.error(`audit-chain: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`audit-chain: ${files.length} snapshots, ${Math.max(0, files.length - 1)} links checked${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
