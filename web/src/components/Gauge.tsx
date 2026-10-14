/** SVG semicircle arc, 0–100 readiness. Amber fill. */
export interface GaugeProps {
  value: number;
  label?: string;
}

const R = 80;
const CX = 100;
const CY = 96;

function point(pct: number): [number, number] {
  const a = Math.PI * (1 - pct / 100);
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
}

export function arcPath(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  const [x0, y0] = point(0);
  const [x1, y1] = point(p);
  return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function Gauge({ value, label = 'Readiness' }: GaugeProps) {
  const ticks = [25, 50, 75];
  return (
    <svg class="gauge" viewBox="0 0 200 112" role="img" aria-label={`${label} ${value} of 100`}>
      <path d={arcPath(100)} fill="none" stroke="var(--border)" stroke-width="14" />
      {value > 0 && <path d={arcPath(value)} fill="none" stroke="var(--amber)" stroke-width="14" />}
      {ticks.map((t) => {
        const [x, y] = point(t);
        const [xi, yi] = [CX + (x - CX) * 0.8, CY + (y - CY) * 0.8];
        return <line key={t} x1={xi} y1={yi} x2={CX + (x - CX) * 0.74} y2={CY + (y - CY) * 0.74} stroke="var(--muted)" stroke-width="1" />;
      })}
      <text x={CX} y={CY - 14} text-anchor="middle" class="gauge-value">{value.toFixed(1)}</text>
      <text x={CX} y={CY + 2} text-anchor="middle" class="gauge-label">{label.toLowerCase()} / 100</text>
      <text x={CX - R} y={CY + 14} text-anchor="middle" class="gauge-tick">0</text>
      <text x={CX + R} y={CY + 14} text-anchor="middle" class="gauge-tick">100</text>
    </svg>
  );
}
