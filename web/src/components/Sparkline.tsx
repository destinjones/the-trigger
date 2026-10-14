/** Inline trend from committed snapshots (git history), never a live call. */
export interface SparklineProps {
  points: { date: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({ points, width = 96, height = 24, color = 'var(--cyan)' }: SparklineProps) {
  if (points.length < 2) {
    return (
      <svg class="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Not enough history yet">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--border)" stroke-dasharray="2 3" />
        {points.length === 1 && <circle cx={width - 2} cy={height / 2} r="2" fill={color} />}
      </svg>
    );
  }
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * (width - 4) + 2,
    height - 2 - ((p.value - lo) / span) * (height - 4),
  ] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1] as readonly [number, number];
  return (
    <svg class="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      aria-label={`${points[0]?.date} to ${points[points.length - 1]?.date}`}>
      <path d={d} fill="none" stroke={color} stroke-width="1.25" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}
