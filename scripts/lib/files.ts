/** Shared file helpers for the data scripts (I/O lives here, not in the pure libs). */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DATA = join(ROOT, 'data');

export const SNAPSHOT_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

export function listSnapshots(dir = DATA): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => SNAPSHOT_FILE.test(f)).sort();
}

export function weightsVersions(dir = join(ROOT, 'index')): string[] {
  return readdirSync(dir)
    .map((f) => /^weights\.(v\d+)\.yaml$/.exec(f)?.[1])
    .filter((v): v is string => v !== undefined);
}

/** A file's content at a git ref, or null when it does not exist there. */
export function gitShow(ref: string, path: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

/** Snapshot files present at a git ref. */
export function gitSnapshots(ref: string): string[] {
  const out = execFileSync('git', ['ls-tree', '--name-only', `${ref}`, 'data/'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').map((l) => l.replace(/^data\//, '')).filter((f) => SNAPSHOT_FILE.test(f)).sort();
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
