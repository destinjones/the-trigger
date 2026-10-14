import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export interface WatchedBill {
  congress: number;
  type: 'hr' | 's' | 'hjres' | 'sjres';
  number: number;
  short: string;
  summary: string;
}

export function loadWatchlist(): WatchedBill[] {
  const text = readFileSync(fileURLToPath(new URL('./watchlist.yaml', import.meta.url)), 'utf8');
  const doc = parse(text) as { bills?: WatchedBill[] };
  return doc.bills ?? [];
}

/** "hr5830-119" */
export function billKey(b: Pick<WatchedBill, 'congress' | 'type' | 'number'>): string {
  return `${b.type}${b.number}-${b.congress}`;
}

/** H.R. 5830 / S. 4825 */
export function billLabel(b: Pick<WatchedBill, 'type' | 'number'>): string {
  const t = { hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.' }[b.type];
  return `${t} ${b.number}`;
}

/** Congress number in session on an ISO date (approximate: ignores Jan 1–3 handover). */
export function congressFor(iso: string): number {
  const y = Number(iso.slice(0, 4));
  return Math.floor((y - 1789) / 2) + 1;
}
