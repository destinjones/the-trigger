import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './run.ts';
import { checkRevisionChange, METRIC_REQUIRED_KEYS, REQUIRED_KEYS, validateSnapshot } from './validate.ts';

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const dataFiles = readdirSync(root('data')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const newest = dataFiles.at(-1) ?? '';
const load = (f: string) => JSON.parse(readFileSync(root(`data/${f}`), 'utf8')) as Record<string, unknown>;
const opts = { weightsVersions: ['v1', 'v2', 'v3'], schemaVersion: SCHEMA_VERSION };

describe('validateSnapshot on the committed archive', () => {
  it.each(dataFiles)('%s is valid', (f) => {
    expect(validateSnapshot(load(f), { ...opts, fileDate: f.slice(0, 10) })).toEqual([]);
  });
});

describe('validateSnapshot rejects', () => {
  const base = () => structuredClone(load(newest));
  const check = (s: unknown) => validateSnapshot(s, { ...opts, fileDate: newest.slice(0, 10) });

  it('a missing key', () => {
    const s = base();
    delete s.weightCovered;
    expect(check(s)).toContain('missing key `weightCovered`');
  });

  it('a date that does not match the file name, or is not a real date', () => {
    expect(check({ ...base(), date: '2026-01-01' })[0]).toMatch(/does not match the file name/);
    expect(check({ ...base(), date: '2026-02-30' })).toContain('`date` is not an ISO date');
  });

  it('an http link on a metric or a record', () => {
    type L = [{ sourceUrl: string }, ...{ sourceUrl: string }[]];
    const s = base() as { metrics: L; actors: L };
    s.metrics[0].sourceUrl = 'http://example.gov/a';
    s.actors[0].sourceUrl = 'http://example.gov/b';
    const p = check(s);
    expect(p.some((x) => /metrics\[0\].*not an https link/.test(x))).toBe(true);
    expect(p).toContain('actors[0] `sourceUrl` is not an https link');
  });

  it('a sub-index outside 0 to 100, and accepts null', () => {
    const s = base() as { subIndices: Record<string, number | null> };
    s.subIndices.precedent = 101;
    s.subIndices.fiscal_pressure = null;
    expect(check(s)).toEqual(['`subIndices.precedent` must be null or a number from 0 to 100']);
  });

  it('NaN anywhere in an in-memory snapshot', () => {
    const s = base() as { readiness: number; metrics: [{ value: number }, { value: number }] };
    s.readiness = Number.NaN;
    s.metrics[1].value = Number.POSITIVE_INFINITY;
    const p = check(s);
    expect(p).toContain('$.readiness is not a finite number');
    expect(p).toContain('$.metrics[1].value is not a finite number');
  });

  it('a NaN that JSON turned into null', () => {
    const s = base() as { readiness: number | null; metrics: [{ value: number | null }] };
    s.readiness = null;
    s.metrics[0].value = null;
    const p = check(s);
    expect(p).toContain('`readiness` must be a number from 0 to 100');
    expect(p.some((x) => /metrics\[0\].*`value` is not a finite number/.test(x))).toBe(true);
  });

  it('a duplicated metricId', () => {
    const s = base() as { metrics: unknown[] };
    s.metrics.push(s.metrics[0]);
    expect(check(s).some((x) => /appears more than once/.test(x))).toBe(true);
  });

  it('an unknown weights version, a bad revision, and a schemaVersion from the future', () => {
    const p = check({ ...base(), weightsVersion: 'v9', revision: -1, schemaVersion: SCHEMA_VERSION + 1 });
    expect(p).toContain('`weightsVersion` v9 has no index/weights.v9.yaml');
    expect(p).toContain('`revision` must be a non-negative integer');
    expect(p.some((x) => /newer than this code/.test(x))).toBe(true);
  });

  it('something that is not an object', () => {
    expect(check([])).toEqual(['not a JSON object']);
  });
});

describe('checkRevisionChange', () => {
  it('accepts a new file at revision 0 and a change that bumps the revision', () => {
    expect(checkRevisionChange(null, { revision: 0 })).toBeNull();
    expect(checkRevisionChange({ revision: 0 }, { revision: 1 })).toBeNull();
  });

  it('rejects a change without a bump, a decrease, a new file above 0, and a deletion', () => {
    expect(checkRevisionChange({ revision: 1 }, { revision: 1 })).toMatch(/must bump/);
    expect(checkRevisionChange({ revision: 2 }, { revision: 1 })).toMatch(/must bump/);
    expect(checkRevisionChange(null, { revision: 3 })).toMatch(/expected 0/);
    expect(checkRevisionChange({ revision: 0 }, null)).toMatch(/never removed/);
  });
});

describe('schema/snapshot.schema.json', () => {
  const schema = JSON.parse(readFileSync(root('schema/snapshot.schema.json'), 'utf8')) as {
    required: string[]; properties: Record<string, unknown>; $defs: { metric: { required: string[] } };
  };

  it('requires the same keys the validator does', () => {
    expect([...schema.required].sort()).toEqual([...REQUIRED_KEYS].sort());
    expect([...schema.$defs.metric.required].sort()).toEqual([...METRIC_REQUIRED_KEYS].sort());
  });

  it('describes every top-level key the newest snapshot has', () => {
    const s = load(newest);
    for (const k of Object.keys(s)) expect(schema.properties, `schema is missing ${k}`).toHaveProperty(k);
    expect(schema.properties).toHaveProperty('schemaVersion');
  });
});
