import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import type { SourceResult } from '../sources/_types.ts';
import { parseWeights } from './model.ts';
import { applyChanges, eventEffect, type MetricChange } from './scenarios.ts';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const W = parseWeights(read('./weights.v2.yaml'));
const snap = JSON.parse(read('../data/2026-10-14.json')) as { metrics: SourceResult[]; sourceCoveragePct: number; date: string };

describe('what would have to happen', () => {
  it('applies set then add without touching the input', () => {
    const m: SourceResult[] = [{ metricId: 'labor.unemployment_rate', value: 4.2, unit: '%', asOf: 'x', fetchedAt: 'x', sourceName: 'x', sourceUrl: 'https://x' }];
    expect(applyChanges(m, [{ metricId: 'labor.unemployment_rate', set: 5, add: 0.5 }])[0]?.value).toBe(5.5);
    expect(m[0]?.value).toBe(4.2);
    expect(() => applyChanges(m, [{ metricId: 'nope', add: 1 }])).toThrow(/not in the snapshot/);
  });
  it('one bill out of committee moves political momentum by a third of 10 points', () => {
    // 1 of 10 bills = 10 points on that metric; political momentum averages 3 metrics; weight 0.20.
    const e = eventEffect(snap.metrics, W, [{ metricId: 'politics.bills_with_committee_movement', add: 1 }], snap.date, snap.sourceCoveragePct);
    expect(e.readinessDelta).toBeCloseTo((10 / 3) * 0.2, 5);
  });
  it('every listed event names real metrics and moves the score toward a dividend', () => {
    const f = parse(read('./events.yaml')) as { events: { id: string; changes: MetricChange[]; watch: string }[] };
    expect(f.events.length).toBeGreaterThan(5);
    for (const ev of f.events) {
      expect(ev.watch, ev.id).toMatch(/^https:\/\//);
      const e = eventEffect(snap.metrics, W, ev.changes, snap.date, snap.sourceCoveragePct);
      expect(e.readinessDelta, ev.id).toBeGreaterThan(0);
    }
  });
});
