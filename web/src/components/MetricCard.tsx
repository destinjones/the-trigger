import type { SourceResult } from '../../../sources/_types.ts';
import { fmtDelta, fmtMonth, fmtNumber, scoreColor } from '../lib/format.ts';
import SourceCite from './SourceCite.tsx';
import Sparkline from './Sparkline.tsx';

/** Label, value, delta vs prior snapshot, normalized score, source cite. */
export interface MetricCardProps {
  metric: SourceResult;
  prior?: SourceResult;
  score: number | null;
  history: { date: string; value: number }[];
}

export default function MetricCard({ metric: m, prior, score, history }: MetricCardProps) {
  const delta = fmtDelta(m.value, prior?.value, m.unit);
  return (
    <article class={`card metric${m.stale ? ' is-stale' : ''}`}>
      <header class="metric-head">
        <span class="metric-label">{m.label ?? m.metricId}</span>
        {score !== null && <span class="metric-score num" style={{ color: scoreColor(score) }} title="Normalized 0–100 score">{score.toFixed(0)}</span>}
      </header>
      <div class="metric-row">
        <span class="metric-value num">{fmtNumber(m.value, m.unit)}</span>
        {delta && <span class="metric-delta num" title="Change vs prior snapshot">{delta}</span>}
        <Sparkline points={history} />
      </div>
      {m.note && <p class="metric-note">{m.note}</p>}
      <footer>
        <SourceCite href={m.sourceUrl} name={m.sourceName} asOf={/-01$/.test(m.asOf) ? fmtMonth(m.asOf) : m.asOf} stale={m.stale} />
      </footer>
    </article>
  );
}
