/** Headline facts from sources/curated/payouts.yaml, shared by the tracker and the calculator. */
import { parse } from 'yaml';
import payoutsText from '../../../sources/curated/payouts.yaml?raw';
import { fundNeeded, perPersonPerYear, type Plan, type Population } from '../../../index/payouts.ts';

export interface PayoutsFile {
  reviewedOn: string | Date;
  population: Population & { asOf: string | Date; sourceName: string; sourceUrl: string; note: string };
  plans: (Plan & { status: string; basis: string; sourceName: string; sourceUrl: string })[];
}
export const payouts = parse(payoutsText) as PayoutsFile;
const lead = payouts.plans.find((p) => p.id === 's4825') ?? payouts.plans[0];
if (!lead) throw new Error('payouts.yaml has no plans');
export const leadPlan = lead;
export const leadPerPersonYear = perPersonPerYear(lead, payouts.population);
export const leadRate = lead.kind === 'fund' ? lead.payoutRate : 0.05;
export const leadFund = lead.kind === 'fund' ? lead.fundUsd : null;
/** Fund needed to pay everyone $1,000 a month at the lead plan's payout rate. */
export const salaryFund = fundNeeded(1000, leadRate, payouts.population);
export const shortfall = leadFund ? salaryFund / leadFund : null;
