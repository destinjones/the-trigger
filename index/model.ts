/**
 * The model: composite readiness score and the projection ("the clock").
 *
 * Every function here is pure. No I/O, no wall clock, no randomness. The
 * snapshot date is an argument. Same inputs, same output, always.
 */
import { parse as parseYaml } from 'yaml';
import { TRANSFORMS, clamp, normalize } from './normalize.ts';
import type { SourceResult } from '../sources/_types.ts';

// ── Weights ────────────────────────────────────────────────────────────────

export interface SubIndexDef {
  weight: number;
  label: string;
}

export interface Weights {
  version: string;
  subIndices: Record<string, SubIndexDef>;
  /** metricId -> sub-index key, or null for recorded-but-unscored. */
  metrics: Record<string, string | null>;
}

/** Parse and validate a weights YAML document. Throws with a precise message on any violation. */
export function parseWeights(yamlText: string): Weights {
  const raw = parseYaml(yamlText) as unknown;
  if (!raw || typeof raw !== 'object') throw new Error('weights: not a mapping');
  const doc = raw as Record<string, unknown>;

  if (typeof doc.version !== 'string') throw new Error('weights: missing string `version`');
  const subRaw = doc.subIndices as Record<string, unknown> | undefined;
  if (!subRaw || typeof subRaw !== 'object') throw new Error('weights: missing `subIndices`');

  const subIndices: Record<string, SubIndexDef> = {};
  let sum = 0;
  for (const [key, v] of Object.entries(subRaw)) {
    const def = v as Partial<SubIndexDef> | null;
    if (!def || typeof def.weight !== 'number' || def.weight < 0) {
      throw new Error(`weights: sub-index "${key}" needs a non-negative numeric weight`);
    }
    subIndices[key] = { weight: def.weight, label: typeof def.label === 'string' ? def.label : key };
    sum += def.weight;
  }
  if (Math.abs(sum - 1) > 0.001) throw new Error(`weights: sub-index weights sum to ${sum}, expected 1.0`);

  const metRaw = (doc.metrics ?? {}) as Record<string, unknown>;
  const metrics: Record<string, string | null> = {};
  for (const [metricId, target] of Object.entries(metRaw)) {
    if (!TRANSFORMS[metricId]) throw new Error(`weights: metric "${metricId}" has no transform in normalize.ts`);
    if (target !== null && (typeof target !== 'string' || !subIndices[target])) {
      throw new Error(`weights: metric "${metricId}" maps to unknown sub-index "${String(target)}"`);
    }
    metrics[metricId] = target as string | null;
  }
  return { version: doc.version, subIndices, metrics };
}

// ── Composite ──────────────────────────────────────────────────────────────

export interface ScoredMetric {
  metricId: string;
  subIndex: string | null;
  raw: number;
  score: number;
}

export interface CompositeResult {
  /** 0–100 per sub-index, or null when no metric fed it this run. */
  subIndices: Record<string, number | null>;
  /** Weighted composite, renormalized over sub-indices that have data. */
  readiness: number;
  /** Share of total weight that had data (0–1). */
  weightCovered: number;
  scored: ScoredMetric[];
}

/**
 * Sub-index = equal-weight mean of its normalized metrics.
 * Composite = weighted sum of sub-indices.
 *
 * If a sub-index has no data at all, it is dropped and the remaining weights
 * are rescaled to sum to 1. That keeps one dead feed from dragging the score to
 * zero, at the cost of the score silently leaning on what we can see. The
 * snapshot records `weightCovered` so the UI can say so.
 *
 * If the same metricId appears twice, the last one wins (later sources override).
 */
export function computeComposite(metrics: readonly SourceResult[], weights: Weights): CompositeResult {
  const latest = new Map<string, SourceResult>();
  for (const m of metrics) latest.set(m.metricId, m);

  const buckets: Record<string, number[]> = {};
  for (const key of Object.keys(weights.subIndices)) buckets[key] = [];

  const scored: ScoredMetric[] = [];
  for (const m of [...latest.values()].sort((a, b) => a.metricId.localeCompare(b.metricId))) {
    if (!(m.metricId in weights.metrics)) continue;
    const subIndex = weights.metrics[m.metricId] ?? null;
    const score = normalize(m.metricId, m.value);
    scored.push({ metricId: m.metricId, subIndex, raw: m.value, score });
    if (subIndex) buckets[subIndex]?.push(score);
  }

  const subIndices: Record<string, number | null> = {};
  let weighted = 0;
  let covered = 0;
  for (const [key, def] of Object.entries(weights.subIndices)) {
    const xs = buckets[key] ?? [];
    if (xs.length === 0) {
      subIndices[key] = null;
      continue;
    }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    subIndices[key] = mean;
    weighted += mean * def.weight;
    covered += def.weight;
  }
  const readiness = covered > 0 ? weighted / covered : 0;
  return { subIndices, readiness, weightCovered: covered, scored };
}

// ── Projection ("the clock") ───────────────────────────────────────────────

export const PROJECTION = {
  /** Readiness 0 projects to this fractional year. */
  anchorYear: 2033.25,
  /** Years pulled forward between readiness 0 and readiness 100. */
  spanYears: 8.0,
  minYear: 2026.5,
  maxYear: 2033.25,
  confidenceMin: 35,
  confidenceMax: 80,
  /** Uncertainty band at readiness 0, in months. */
  maxBandMonths: 30,
} as const;

export interface Projection {
  projectedYear: number;
  projectedDate: string;
  /** 0–1. */
  confidence: number;
  bandMonths: number;
}

/**
 * projectedYears = 2033.25 − (readiness / 100) × 8.0       clamp [2026.5, 2033.25]
 * confidence     = clamp(0.5 × readiness + 0.5 × coverage%, 35, 80)
 * bandMonths     = (100 − readiness) / 100 × 30
 *
 * `today` (ISO date) is an additional floor: the projection never lands before
 * the snapshot it belongs to.
 */
export function project(readiness: number, sourceCoveragePct: number, today: string): Projection {
  const r = clamp(readiness, 0, 100);
  const cov = clamp(sourceCoveragePct, 0, 100);
  const P = PROJECTION;
  const floor = Math.max(P.minYear, dateToYearFraction(today));
  const projectedYear = clamp(P.anchorYear - (r / 100) * P.spanYears, floor, P.maxYear);
  const confidencePct = clamp(0.5 * r + 0.5 * cov, P.confidenceMin, P.confidenceMax);
  return {
    projectedYear,
    projectedDate: yearFractionToDate(projectedYear),
    confidence: round(confidencePct / 100, 2),
    bandMonths: Math.round(((100 - r) / 100) * P.maxBandMonths),
  };
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** 2030.5 -> the date halfway through 2030 (UTC), as YYYY-MM-DD. */
export function yearFractionToDate(y: number): string {
  const year = Math.floor(y);
  const days = isLeap(year) ? 366 : 365;
  const dayIndex = Math.min(days - 1, Math.floor((y - year) * days + 1e-6));
  const d = new Date(Date.UTC(year, 0, 1 + dayIndex));
  return d.toISOString().slice(0, 10);
}

/** "2030-07-02" -> 2030.5 (approximately). Inverse of yearFractionToDate. */
export function dateToYearFraction(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`dateToYearFraction(): bad ISO date "${iso}"`);
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(y, 0, 1);
  const t = Date.UTC(y, m - 1, d);
  const days = isLeap(y) ? 366 : 365;
  return y + (t - start) / 86_400_000 / days;
}

export function quarterOf(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
}

export function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// ── Snapshot assembly ──────────────────────────────────────────────────────

export interface SnapshotInput {
  date: string;
  revision: number;
  weights: Weights;
  metrics: SourceResult[];
  sourcesOk: string[];
  sourcesFailed: string[];
}

export interface SnapshotCore {
  date: string;
  revision: number;
  weightsVersion: string;
  readiness: number;
  projectedDate: string;
  confidence: number;
  bandMonths: number;
  sourceCoveragePct: number;
  weightCovered: number;
  subIndices: Record<string, number | null>;
  metrics: SourceResult[];
  sourcesOk: string[];
  sourcesFailed: string[];
}

/** Share of sources that returned live data this run, 0–100. */
export function sourceCoverage(ok: readonly string[], failed: readonly string[]): number {
  const total = ok.length + failed.length;
  return total === 0 ? 0 : (ok.length / total) * 100;
}

export function buildSnapshot(input: SnapshotInput): SnapshotCore {
  const comp = computeComposite(input.metrics, input.weights);
  const coverage = sourceCoverage(input.sourcesOk, input.sourcesFailed);
  const readiness = round(comp.readiness, 1);
  const proj = project(readiness, coverage, input.date);
  const subIndices: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(comp.subIndices)) subIndices[k] = v === null ? null : round(v, 1);
  return {
    date: input.date,
    revision: input.revision,
    weightsVersion: input.weights.version,
    readiness,
    projectedDate: proj.projectedDate,
    confidence: proj.confidence,
    bandMonths: proj.bandMonths,
    sourceCoveragePct: round(coverage, 1),
    weightCovered: round(comp.weightCovered, 3),
    subIndices,
    metrics: [...input.metrics].sort((a, b) => a.metricId.localeCompare(b.metricId)),
    sourcesOk: [...input.sourcesOk].sort(),
    sourcesFailed: [...input.sourcesFailed].sort(),
  };
}
