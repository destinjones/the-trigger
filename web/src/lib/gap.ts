/**
 * The gap chart: AI-attributed job cuts (cumulative, from Challenger's monthly
 * reports in sources/curated/challenger.yaml) against federal dividend bills
 * past committee (from the snapshots in data/), on one monthly axis. Pure.
 */

export interface GapPoint { t: number; cuts: number; bills: number }

export interface MonthlyCuts { month: string; aiCuts: number | null; ytd: number; url: string }
export interface BillsObservation { date: string; bills: number }

/** Month "YYYY-MM" -> year fraction at month end. */
export function monthEnd(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return y + m / 12;
}

/**
 * Cumulative AI-attributed cuts at each month end, from year-to-date figures:
 * each January resets ytd, so cumulative = sum of prior years' last ytd + this ytd.
 *
 * Bills past committee at each month end = the latest snapshot on or before it.
 * Months before the first snapshot take the first snapshot's value; the count
 * is of bills that have ever moved past referral, which can only rise within a
 * Congress.
 */
export function gapSeries(monthly: MonthlyCuts[], bills: BillsObservation[]): GapPoint[] {
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const obs = [...bills].sort((a, b) => a.date.localeCompare(b.date));
  const priorYears = new Map<number, number>();
  for (const m of sorted) priorYears.set(Number(m.month.slice(0, 4)), m.ytd); // last ytd of each year wins
  const yearsBefore = (y: number) => [...priorYears.entries()].filter(([yy]) => yy < y).reduce((a, [, v]) => a + v, 0);
  return sorted.map((m) => {
    const y = Number(m.month.slice(0, 4));
    const end = `${m.month}-31`;
    const seen = obs.filter((o) => o.date <= end).at(-1) ?? obs[0];
    return { t: monthEnd(m.month), cuts: yearsBefore(y) + m.ytd, bills: seen?.bills ?? 0 };
  });
}

/** Pixels between the x axis and a zero bills line. */
export const BILLS_FLOOR = 7;

export function gapGeometry(pts: GapPoint[], W = 656, H = 200, padTop = 26, padBot = 24) {
  const [first] = pts;
  const last = pts.at(-1);
  if (pts.length < 2 || !first || !last) return null;
  const maxCuts = Math.max(...pts.map((p) => p.cuts), 1);
  const maxBills = Math.max(...pts.map((p) => p.bills), 1);
  const t0 = first.t;
  const span = (last.t - t0) || 1;

  const X = (t: number) => ((t - t0) / span) * W;
  const Yc = (c: number) => padTop + (1 - c / maxCuts) * (H - padTop - padBot - BILLS_FLOOR);
  // Both series start from a floor a few pixels above the axis, so a bills line
  // that never leaves zero still reads as a line rather than as the axis.
  const Yb = (b: number) => (H - padBot - BILLS_FLOOR) - (b / maxBills) * (H * 0.16);

  const cutsPath = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Yc(p.cuts).toFixed(1)}`).join('');
  const billsPath = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Yb(p.bills).toFixed(1)}`).join('');
  const gapPath = cutsPath
    + pts.slice().reverse().map((p) => `L${X(p.t).toFixed(1)} ${Yb(p.bills).toFixed(1)}`).join('')
    + 'Z';

  // Polyline length, for the draw-on animation.
  let cutsLength = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as GapPoint;
    const b = pts[i] as GapPoint;
    cutsLength += Math.hypot(X(b.t) - X(a.t), Yc(b.cuts) - Yc(a.cuts));
  }
  // A tick at each January. When the series starts mid-year, the opening
  // year is labelled at the left edge so the axis never starts unnamed.
  const years: { x: number; label: string; anchor: 'start' | 'middle' }[] = [];
  if (Math.ceil(t0) !== t0 && X(Math.ceil(t0)) > 48) years.push({ x: 0, label: String(Math.floor(t0)), anchor: 'start' });
  for (let y = Math.ceil(t0); y <= last.t; y++) years.push({ x: X(y), label: String(y), anchor: 'middle' });

  return {
    cutsPath, billsPath, gapPath, maxCuts, maxBills, cutsLength, years,
    end: { x: X(last.t), cutsY: Yc(last.cuts), billsY: Yb(last.bills) },
  };
}
