/**
 * The facts the headline, the share card, and the page description are built
 * from. One place, so the three never disagree, and every figure comes from a
 * cited metric in the latest snapshot.
 */
import { latest, metric } from './data.ts';
import { fmtMonth } from './format.ts';

export function quarterOf(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
}

const cutsYtd = metric(latest, 'labor.ai_layoffs_ytd');
const cutsTtm = metric(latest, 'labor.ai_layoffs_ttm');
/** Prefer the calendar-year figure; it is the one people quote. */
export const cuts = cutsYtd ?? cutsTtm;
export const cutsLabel = cutsYtd
  ? `US jobs cut in ${cutsYtd.asOf.slice(0, 4)} with AI cited as the reason`
  : 'US jobs cut with AI cited as the reason, last 12 months';
export const cutsThrough = cuts ? `through ${fmtMonth(cuts.asOf)}` : '';

export const moved = metric(latest, 'politics.bills_with_committee_movement');
export const movedLabel = 'federal dividend bills out of committee';

export const year = latest.projectedDate.slice(0, 4);
export const quarter = quarterOf(latest.projectedDate);

export const title = "The Trigger: the layoffs started, the checks haven't";

export const description = [
  cuts ? `AI has cut ${cuts.value.toLocaleString('en-US')} US jobs${cutsYtd ? ` in ${cutsYtd.asOf.slice(0, 4)}` : ' in a year'}.` : '',
  moved ? `${moved.value === 0 ? 'Zero' : moved.value} federal bills have left committee.` : '',
  `The Trigger projects when the first federal dividend check clears: ${year}, ±${latest.bandMonths} months.`,
].filter(Boolean).join(' ');

/** Sign of labor dislocation minus political momentum, with copy for each case. */
export function gapCopy(gap: number | null, labor: number | null | undefined, politics: number | null | undefined): { head: string; body: string } {
  if (gap === null || labor == null || politics == null) {
    return { head: 'No data', body: 'One of the two sub-indices has no live inputs in this snapshot.' };
  }
  const l = labor.toFixed(1);
  const p = politics.toFixed(1);
  if (gap < -2) {
    return {
      head: 'Elites are front-running the crisis',
      body: `Political momentum (${p}) is ahead of measured labor dislocation (${l}). Bills, executive orders, and equity proposals are arriving before the job losses show up in unemployment and payrolls. The thesis says checks get forced by pain, so the forcing event is still ahead.`,
    };
  }
  if (gap > 2) {
    return {
      head: 'Pain is outrunning the response',
      body: `Labor dislocation (${l}) is ahead of political momentum (${p}). This is the condition the thesis says forces a response: a widening positive gap is the warning light.`,
    };
  }
  return {
    head: 'Pain and response are level',
    body: `Labor dislocation (${l}) and political momentum (${p}) are within 2 points. Watch which one moves first.`,
  };
}
