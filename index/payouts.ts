/**
 * What a dividend plan pays a household. Pure arithmetic over the plans in
 * sources/curated/payouts.yaml; no I/O.
 *
 * A fund plan pays fundUsd x payoutRate a year, split evenly across everyone
 * eligible. A per-person plan pays a fixed amount per eligible person.
 */

export interface Population {
  everyone: number;
  /** 18+. Needed only by plans that pay adults only. */
  adults?: number;
}

interface PlanBase {
  id: string;
  name: string;
  eligible: 'everyone' | 'adults';
  recurring: boolean;
}
export interface FundPlan extends PlanBase {
  kind: 'fund';
  fundUsd: number;
  payoutRate: number;
}
export interface PerPersonPlan extends PlanBase {
  kind: 'perPerson';
  amountUsd: number;
  periodsPerYear: number;
}
export type Plan = FundPlan | PerPersonPlan;

/** Dollars per eligible person per year. */
export function perPersonPerYear(plan: Plan, pop: Population): number {
  if (plan.kind === 'perPerson') return plan.amountUsd * plan.periodsPerYear;
  const n = plan.eligible === 'adults' ? pop.adults : pop.everyone;
  if (!n || n <= 0) throw new Error(`payouts: no ${plan.eligible} population for plan "${plan.id}"`);
  return (plan.fundUsd * plan.payoutRate) / n;
}

export interface Household {
  adults: number;
  children: number;
}

export function householdPerYear(plan: Plan, pop: Population, h: Household): number {
  const people = plan.eligible === 'adults' ? h.adults : h.adults + h.children;
  return perPersonPerYear(plan, pop) * Math.max(0, people);
}

/**
 * The fund a plan would need to pay `monthlyPerPerson` to everyone at its
 * payout rate. Used to show the distance between "a dividend" and a salary.
 */
export function fundNeeded(monthlyPerPerson: number, payoutRate: number, pop: Population): number {
  if (payoutRate <= 0) throw new Error('payouts: payoutRate must be positive');
  return (monthlyPerPerson * 12 * pop.everyone) / payoutRate;
}
