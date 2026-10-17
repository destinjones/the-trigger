/**
 * pnpm health [-- --out FILE]
 *
 * Checks the newest snapshot and the curated files, prints the report, and
 * writes it as Markdown to FILE when there is anything to report. Exit code is
 * 0 either way; the snapshot workflow decides what to do with the file.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { checkHealth, renderHealth, type CuratedMeta, type HealthSnapshot } from './lib/health.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { values: args } = parseArgs({ options: { out: { type: 'string' } } });

const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const newest = readdirSync(join(ROOT, 'data')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!newest) throw new Error('health: no snapshots in data/');
const snap = JSON.parse(readFileSync(join(ROOT, 'data', newest), 'utf8')) as HealthSnapshot;

const curatedDir = join(ROOT, 'sources', 'curated');
const curated: CuratedMeta[] = readdirSync(curatedDir).filter((f) => f.endsWith('.yaml')).sort().map((f) => {
  const doc = parse(readFileSync(join(curatedDir, f), 'utf8')) as { reviewedOn: unknown; maxAgeDays: number };
  return { name: f.replace(/\.yaml$/, ''), reviewedOn: iso(doc.reviewedOn), maxAgeDays: doc.maxAgeDays };
});

const today = new Date().toISOString().slice(0, 10);
const report = checkHealth(snap, curated, today);
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;
const md = renderHealth(report, snap.date, runUrl);
console.log(md);
if (args.out && (report.problems.length || report.warnings.length)) writeFileSync(args.out, md);
