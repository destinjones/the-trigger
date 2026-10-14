/** Number formatting for figures. Pure, shared by components. */

export function fmtNumber(v: number, unit: string): string {
  const abs = Math.abs(v);
  if (unit === 'USD') {
    if (abs >= 1e12) return `$${trim(v / 1e12)}T`;
    if (abs >= 1e9) return `$${trim(v / 1e9)}B`;
    if (abs >= 1e6) return `$${trim(v / 1e6)}M`;
    if (abs >= 1e3) return `$${trim(v / 1e3)}K`;
    return `$${v.toFixed(0)}`;
  }
  if (unit === 'thousand jobs/mo') return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}k/mo`;
  if (unit.startsWith('%') || unit === '% YoY') {
    const s = `${Math.abs(v).toFixed(1)}%`;
    return unit === '% YoY' ? `${v >= 0 ? '+' : '−'}${s}` : (v < 0 ? '−' : '') + s;
  }
  if (unit === 'pp') return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}pp`;
  if (abs >= 1e6) return `${trim(v / 1e6)}M`;
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`;
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1);
}

function trim(x: number): string {
  return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/\.?0+$/, '');
}

export function fmtDelta(cur: number, prev: number | undefined, unit: string): string | null {
  if (prev === undefined || prev === cur) return prev === cur ? 'unch' : null;
  const d = cur - prev;
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  if (unit === 'USD') return `${sign}${fmtNumber(a, 'USD')}`;
  if (unit.startsWith('%') || unit === 'pp') return `${sign}${a.toFixed(1)}pt`;
  return `${sign}${Number.isInteger(a) ? a.toLocaleString('en-US') : a.toFixed(1)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
export function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** Color token for a 0–100 score. One mapping for the whole site: see index/color.ts. */
export { readinessColor as scoreColor } from '../../../index/color.ts';

/** A bill with no recorded action for this long is shown as dead. */
export const DEAD_AFTER_DAYS = 180;
export function daysSince(iso: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
}
