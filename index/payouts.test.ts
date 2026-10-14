import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { fundNeeded, householdPerYear, perPersonPerYear, type Plan, type Population } from './payouts.ts';

const pop: Population = { everyone: 341_800_000, adults: 265_000_000 };
const s4825: Plan = { id: 's', name: 's', kind: 'fund', fundUsd: 7e12, payoutRate: 0.05, eligible: 'everyone', recurring: true };

describe('payouts', () => {
  it('splits a fund payout across everyone eligible', () => {
    // $350B a year over 341.8M people: just over the sponsor's "$1,000 to everyone".
    expect(perPersonPerYear(s4825, pop)).toBeCloseTo(1024.0, 0);
    expect(householdPerYear(s4825, pop, { adults: 2, children: 0 }) / 12).toBeCloseTo(170.7, 1);
    expect(householdPerYear(s4825, pop, { adults: 2, children: 2 })).toBeCloseTo(4 * 1024.0, -1);
  });
  it('adults-only plans ignore children and use the adult population', () => {
    const a: Plan = { ...s4825, eligible: 'adults' };
    expect(householdPerYear(a, pop, { adults: 1, children: 3 })).toBeCloseTo(350e9 / 265e6);
    expect(() => perPersonPerYear(a, { everyone: 1 })).toThrow(/adults population/);
  });
  it('per-person plans pay a fixed amount', () => {
    const p: Plan = { id: 'ak', name: 'ak', kind: 'perPerson', amountUsd: 1200, periodsPerYear: 1, eligible: 'everyone', recurring: true };
    expect(householdPerYear(p, pop, { adults: 2, children: 1 })).toBe(3600);
  });
  it('a $1,000/month dividend at 5% needs an ~$82T fund', () => {
    expect(fundNeeded(1000, 0.05, pop) / 1e12).toBeCloseTo(82.0, 0);
  });
  it('curated plans parse and every one has an https source', () => {
    const f = parse(readFileSync(fileURLToPath(new URL('../sources/curated/payouts.yaml', import.meta.url)), 'utf8')) as {
      population: Population & { sourceUrl: string }; plans: (Plan & { sourceUrl: string })[];
    };
    expect(f.population.sourceUrl).toMatch(/^https:\/\//);
    for (const p of f.plans) {
      expect(p.sourceUrl, p.id).toMatch(/^https:\/\//);
      expect(perPersonPerYear(p, f.population), p.id).toBeGreaterThan(0);
    }
  });
});
