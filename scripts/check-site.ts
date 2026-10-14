/**
 * Fails the build when any page in web/dist renders a different snapshot from
 * the newest file in data/. Run after `pnpm build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkStamps, expectedStamp, readStamp, type PageStamp } from './lib/checkSite.ts';

const dist = join(process.cwd(), 'web', 'dist');
const dataDir = join(process.cwd(), 'data');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return f.endsWith('.html') ? [p] : [];
  });
}

const newest = readdirSync(dataDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!newest) throw new Error('check-site: no snapshots in data/');
const expected = expectedStamp(JSON.parse(readFileSync(join(dataDir, newest), 'utf8')));
const pages: PageStamp[] = htmlFiles(dist).map((p) => ({ page: relative(dist, p), stamp: readStamp(readFileSync(p, 'utf8')) }));
const problems = checkStamps(pages, expected);
if (problems.length) {
  console.error(`check-site: ${problems.length} page(s) out of step with ${newest}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-site: ${pages.length} pages all render ${expected}`);
