import type { BillRecord } from '../../../sources/_types.ts';
import SourceCite from './SourceCite.tsx';
import { DEAD_AFTER_DAYS, daysSince } from '../lib/format.ts';

/** Date, description, status pill. A bill idle past DEAD_AFTER_DAYS gets a "dead" pill. */
export default function BillRow({ bill, today }: { bill: BillRecord; today: string }) {
  const idle = daysSince(bill.date, today);
  const dead = (bill.status === 'in committee' || bill.status === 'proposed') && idle >= DEAD_AFTER_DAYS;
  const pill = {
    passed: 'pill-green',
    'in committee': 'pill-amber',
    proposed: 'pill-cyan',
    expired: 'pill-muted',
  }[bill.status];
  return (
    <tr class="bill-row">
      <td class="num nowrap">{bill.date}</td>
      <td>
        <div class="bill-title">{bill.title}</div>
        <div class="muted small">{bill.latestAction}</div>
      </td>
      <td class="num">{bill.cosponsors}</td>
      <td class="nowrap">
        <span class={`pill ${pill}`}>{bill.status}</span>
        {dead && <> <span class="pill pill-red" title={`No recorded action in ${idle} days`}>dead</span></>}
      </td>
      <td><SourceCite href={bill.sourceUrl} name={bill.sourceName} /></td>
    </tr>
  );
}
