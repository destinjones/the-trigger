/**
 * pnpm validate-data [-- --against REF]
 *
 * Checks every file in data/ against the snapshot rules in scripts/lib/validate.ts.
 * With --against REF, also checks every snapshot that differs from REF: a
 * changed file must have a higher revision, a new file must start at 0, and no
 * file may be deleted. Exits 1 on any problem.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { SCHEMA_VERSION } from './lib/run.ts';
import { DATA, gitShow, gitSnapshots, listSnapshots, readJson, weightsVersions } from './lib/files.ts';
import { checkRevisionChange, validateSnapshot } from './lib/validate.ts';

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: { against: { type: 'string' } },
});

const files = listSnapshots();
const versions = weightsVersions();
const problems: string[] = [];

for (const f of files) {
  let snap: unknown;
  try {
    snap = readJson(join(DATA, f));
  } catch (e) {
    problems.push(`${f}: not valid JSON (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  for (const p of validateSnapshot(snap, { fileDate: f.slice(0, 10), weightsVersions: versions, schemaVersion: SCHEMA_VERSION })) {
    problems.push(`${f}: ${p}`);
  }
}

let compared = 0;
if (args.against) {
  const ref = args.against;
  const all = [...new Set([...gitSnapshots(ref), ...files])].sort();
  for (const f of all) {
    const old = gitShow(ref, `data/${f}`);
    const now = files.includes(f) ? JSON.stringify(readJson(join(DATA, f))) : null;
    const oldNorm = old === null ? null : JSON.stringify(JSON.parse(old));
    if (oldNorm === now) continue;
    compared++;
    const rev = (s: string | null) => (s === null ? null : { revision: (JSON.parse(s) as { revision: number }).revision });
    const problem = checkRevisionChange(rev(oldNorm), rev(now));
    if (problem) problems.push(`${f}: ${problem} (against ${ref})`);
  }
}

if (problems.length) {
  console.error(`validate-data: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`validate-data: ${files.length} snapshots valid${args.against ? `; ${compared} changed since ${args.against}, revisions in order` : ''}`);
