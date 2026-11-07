/**
 * Structural checks on a snapshot file, and on a change to one. Pure: the
 * caller reads the files. scripts/validate-data.ts runs this over data/, and
 * scripts/snapshot.ts runs it before it writes, so a bad file is never written.
 *
 * The rules mirror schema/snapshot.schema.json; schema.test.ts keeps the two
 * in step. The schema is the published contract, this is the enforcement.
 */

/** Top-level keys every snapshot has had since the first file. */
export const REQUIRED_KEYS = [
  'date', 'revision', 'weightsVersion', 'readiness', 'projectedDate', 'confidence', 'bandMonths',
  'sourceCoveragePct', 'weightCovered', 'subIndices', 'metrics', 'sourcesOk', 'sourcesFailed',
  'bills', 'actors', 'filings', 'sourceErrors', 'sourcesSkipped',
] as const;

export const METRIC_REQUIRED_KEYS = ['metricId', 'value', 'unit', 'asOf', 'fetchedAt', 'sourceName', 'sourceUrl'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const HTTPS = /^https:\/\/\S+$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function realDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Every non-finite number anywhere in the value, as JSON paths. JSON.stringify turns NaN into null, so this matters for in-memory snapshots. */
function nonFinite(v: unknown, path: string, out: string[]): void {
  if (typeof v === 'number' && !Number.isFinite(v)) out.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => nonFinite(x, `${path}[${i}]`, out));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) nonFinite(x, `${path}.${k}`, out);
}

export interface ValidateOptions {
  /** Expected date, from the file name. */
  fileDate?: string;
  /** Weights versions that exist in index/, e.g. ["v1", "v2", "v3"]. */
  weightsVersions?: readonly string[];
  /** Highest schema version this code knows. */
  schemaVersion: number;
}

/** Problems with one snapshot, empty when it is valid. */
export function validateSnapshot(snap: unknown, opts: ValidateOptions): string[] {
  const p: string[] = [];
  if (!isObj(snap)) return ['not a JSON object'];

  for (const k of REQUIRED_KEYS) if (!(k in snap)) p.push(`missing key \`${k}\``);

  const bad: string[] = [];
  nonFinite(snap, '$', bad);
  for (const b of bad) p.push(`${b} is not a finite number`);

  if ('schemaVersion' in snap) {
    const v = snap.schemaVersion;
    if (!Number.isInteger(v) || (v as number) < 1) p.push('`schemaVersion` must be an integer of 1 or more');
    else if ((v as number) > opts.schemaVersion) p.push(`\`schemaVersion\` ${String(v)} is newer than this code (${opts.schemaVersion})`);
  }

  const date = snap.date;
  if (typeof date !== 'string' || !ISO_DATE.test(date) || !realDate(date)) p.push('`date` is not an ISO date');
  else if (opts.fileDate && date !== opts.fileDate) p.push(`\`date\` ${date} does not match the file name ${opts.fileDate}`);

  if ('revision' in snap && !(Number.isInteger(snap.revision) && (snap.revision as number) >= 0)) p.push('`revision` must be a non-negative integer');

  if ('weightsVersion' in snap) {
    const w = snap.weightsVersion;
    if (typeof w !== 'string' || !/^v\d+$/.test(w)) p.push('`weightsVersion` must look like v3');
    else if (opts.weightsVersions && !opts.weightsVersions.includes(w)) p.push(`\`weightsVersion\` ${w} has no index/weights.${w}.yaml`);
  }

  const range = (k: string, lo: number, hi: number) => {
    if (!(k in snap)) return;
    const v = snap[k];
    if (!isNum(v) || v < lo || v > hi) p.push(`\`${k}\` must be a number from ${lo} to ${hi}`);
  };
  range('readiness', 0, 100);
  range('confidence', 0, 1);
  range('bandMonths', 0, 1200);
  range('sourceCoveragePct', 0, 100);
  range('weightCovered', 0, 1);

  if ('projectedDate' in snap && (typeof snap.projectedDate !== 'string' || !ISO_DATE.test(snap.projectedDate) || !realDate(snap.projectedDate))) {
    p.push('`projectedDate` is not an ISO date');
  }

  if ('subIndices' in snap) {
    if (!isObj(snap.subIndices)) p.push('`subIndices` must be an object');
    else for (const [k, v] of Object.entries(snap.subIndices)) {
      if (v !== null && (!isNum(v) || v < 0 || v > 100)) p.push(`\`subIndices.${k}\` must be null or a number from 0 to 100`);
    }
  }

  for (const k of ['sourcesOk', 'sourcesFailed', 'sourcesSkipped'] as const) {
    if (k in snap && (!Array.isArray(snap[k]) || !(snap[k] as unknown[]).every((x) => typeof x === 'string'))) p.push(`\`${k}\` must be an array of strings`);
  }
  if ('sourceErrors' in snap && !isObj(snap.sourceErrors)) p.push('`sourceErrors` must be an object');

  if ('metrics' in snap) {
    if (!Array.isArray(snap.metrics)) p.push('`metrics` must be an array');
    else {
      const seen = new Set<string>();
      snap.metrics.forEach((m: unknown, i) => {
        const at = `metrics[${i}]`;
        if (!isObj(m)) { p.push(`${at} is not an object`); return; }
        const id = typeof m.metricId === 'string' && m.metricId ? m.metricId : null;
        const name = id ? `${at} (${id})` : at;
        for (const k of METRIC_REQUIRED_KEYS) if (!(k in m)) p.push(`${name} is missing \`${k}\``);
        if (!id) p.push(`${at} has no \`metricId\``);
        else if (seen.has(id)) p.push(`${name} appears more than once`);
        else seen.add(id);
        if ('value' in m && !isNum(m.value)) p.push(`${name} \`value\` is not a finite number`);
        if ('sourceUrl' in m && (typeof m.sourceUrl !== 'string' || !HTTPS.test(m.sourceUrl))) p.push(`${name} \`sourceUrl\` is not an https link`);
        if ('asOf' in m && (typeof m.asOf !== 'string' || !ISO_DATE_PREFIX.test(m.asOf))) p.push(`${name} \`asOf\` is not an ISO date`);
        if ('stale' in m && typeof m.stale !== 'boolean') p.push(`${name} \`stale\` must be true or false`);
      });
    }
  }

  for (const k of ['bills', 'actors', 'filings'] as const) {
    if (!(k in snap)) continue;
    const list = snap[k];
    if (!Array.isArray(list)) { p.push(`\`${k}\` must be an array`); continue; }
    list.forEach((r: unknown, i) => {
      if (!isObj(r)) { p.push(`${k}[${i}] is not an object`); return; }
      if (typeof r.sourceUrl !== 'string' || !HTTPS.test(r.sourceUrl)) p.push(`${k}[${i}] \`sourceUrl\` is not an https link`);
    });
  }

  return p;
}

/**
 * Problems with replacing `before` by `after` for the same date. Past files are
 * never rewritten: any change is a new revision, so the revision must go up.
 * `before` null means the file is new, which must start at revision 0.
 */
export function checkRevisionChange(before: { revision: number } | null, after: { revision: number } | null): string | null {
  if (after === null) return before === null ? null : 'snapshot was deleted; past snapshots are never removed';
  if (before === null) return after.revision === 0 ? null : `new file starts at revision ${after.revision}, expected 0`;
  if (after.revision <= before.revision) return `file changed but revision went from ${before.revision} to ${after.revision}; a change must bump the revision`;
  return null;
}
