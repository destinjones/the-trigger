import { scoreColor } from '../lib/format.ts';
import SourceCite from './SourceCite.tsx';

/** Labeled bar per sub-index, colored by value. */
export interface SubIndexProps {
  label: string;
  value: number | null;
  weight: number;
  metricCount: number;
  citeHref: string;
  methodHref: string;
}

export default function SubIndex({ label, value, weight, metricCount, citeHref, methodHref }: SubIndexProps) {
  const color = value === null ? 'var(--dim)' : scoreColor(value);
  return (
    <div class="subindex">
      <div class="subindex-head">
        <a class="subindex-label" href={methodHref}>{label}</a>
        <span class="subindex-weight num">w {weight.toFixed(2)}</span>
        <span class="subindex-value num" style={{ color }}>{value === null ? 'no data' : value.toFixed(1)}</span>
      </div>
      <div class="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-label={label}>
        <div class="bar-fill" style={{ width: `${value ?? 0}%`, background: color }} />
        {[25, 50, 75].map((t) => <div key={t} class="bar-tick" style={{ left: `${t}%` }} />)}
      </div>
      <div class="subindex-foot">
        <span class="muted">{metricCount} metric{metricCount === 1 ? '' : 's'}, equal weight</span>
        <SourceCite href={citeHref} name="snapshot" />
      </div>
    </div>
  );
}
