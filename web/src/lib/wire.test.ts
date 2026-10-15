import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../../scripts/lib/run.ts';
import { wireItems } from './wire.ts';

const s = {
  date: '2026-10-14', readiness: 28.1, projectedDate: '2031-01-01', weightsVersion: 'v2', sourcesFailed: ['govtrack'], sourcesOk: [],
  metrics: [
    { metricId: 'a', label: 'Older', value: 1, unit: 'jobs', asOf: '2026-08-01', fetchedAt: '', sourceName: '', sourceUrl: 'https://a' },
    { metricId: 'b', label: 'Newer', value: 4.2, unit: '%', asOf: '2026-09-01', fetchedAt: '', sourceName: '', sourceUrl: 'https://b' },
  ],
  bills: [],
} as unknown as Snapshot;

describe('wire', () => {
  it('lists newest records first, with links, and leaves source failures to the status panel', () => {
    const w = wireItems(s, null);
    expect(w.map((i) => i.text)).toEqual(['Newer: 4.2%', 'Older: 1']);
    expect(w[0]?.href).toBe('https://b');
    const prev = { ...s, sourcesFailed: [], date: '2026-10-13' } as Snapshot;
    expect(wireItems(s, prev).some((i) => i.text.includes('govtrack'))).toBe(false);
  });
  it('leads with changes since the previous snapshot', () => {
    const prev = { ...s, readiness: 27.0, date: '2026-10-13' } as Snapshot;
    expect(wireItems(s, prev)[0]?.text).toBe('Readiness 27.0 → 28.1 (+1.1)');
  });
});
