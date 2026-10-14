/**
 * "What would have to happen": rescore the latest snapshot with a few raw
 * metric values changed, and report how far the composite and the projected
 * date move. Pure. Uses the same computeComposite and project as the daily
 * run, so the answer cannot drift from the index.
 */
import type { SourceResult } from '../sources/_types.ts';
import { computeComposite, dateToYearFraction, project, type Weights } from './model.ts';

export interface MetricChange {
  metricId: string;
  /** Replace the raw value. */
  set?: number;
  /** Add to the raw value (after `set`, if both are given). */
  add?: number;
}

export interface EventEffect {
  readiness: number;
  readinessDelta: number;
  projectedDate: string;
  /** Positive = the projected first check moves earlier. */
  monthsEarlier: number;
}

export function applyChanges(metrics: readonly SourceResult[], changes: readonly MetricChange[]): SourceResult[] {
  const out = metrics.map((m) => ({ ...m }));
  for (const c of changes) {
    const m = out.find((x) => x.metricId === c.metricId);
    if (!m) throw new Error(`scenarios: metric "${c.metricId}" is not in the snapshot`);
    if (c.set !== undefined) m.value = c.set;
    if (c.add !== undefined) m.value += c.add;
  }
  return out;
}

export function eventEffect(
  metrics: readonly SourceResult[],
  weights: Weights,
  changes: readonly MetricChange[],
  today: string,
  coveragePct: number,
): EventEffect {
  const base = computeComposite(metrics, weights).readiness;
  const after = computeComposite(applyChanges(metrics, changes), weights).readiness;
  const p0 = project(base, coveragePct, today);
  const p1 = project(after, coveragePct, today);
  return {
    readiness: after,
    readinessDelta: after - base,
    projectedDate: p1.projectedDate,
    monthsEarlier: Math.round((dateToYearFraction(p0.projectedDate) - dateToYearFraction(p1.projectedDate)) * 12),
  };
}
