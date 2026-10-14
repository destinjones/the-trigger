import type { BillRecord } from '../../../sources/_types.ts';
import SourceCite from './SourceCite.tsx';

/** Date, description, status pill. */
export default function BillRow({ bill }: { bill: BillRecord }) {
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
      <td><span class={`pill ${pill}`}>{bill.status}</span></td>
      <td><SourceCite href={bill.sourceUrl} name={bill.sourceName} /></td>
    </tr>
  );
}
