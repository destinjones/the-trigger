/**
 * Dial geometry: a 270° ring in a 340×340 box, starting at 135° (lower left)
 * and running clockwise. The outer arc carries readiness; an inner scale marks
 * the years 2026–2035 so the same object shows where today sits against the
 * projected date. Pure: inputs in, numbers out. Shared by Dial.astro and the
 * share card.
 */
export const DIAL = { cx: 170, cy: 170, r: 140, start: 135, sweep: 270, year0: 2026, years: 10 } as const;
export const CIRC = 2 * Math.PI * DIAL.r;
export const ARC = CIRC * (DIAL.sweep / 360);

const rad = (deg: number) => (deg * Math.PI) / 180;
export function polar(deg: number, r: number): [number, number] {
  return [DIAL.cx + r * Math.cos(rad(deg)), DIAL.cy + r * Math.sin(rad(deg))];
}

/** Angle of a 0–100 readiness value. */
export const readinessAngle = (v: number) => DIAL.start + DIAL.sweep * Math.min(1, Math.max(0, v / 100));

/** Angle of a year fraction on the inner year scale (2026.0 → start, 2036.0 → end). */
export const yearAngle = (y: number) =>
  DIAL.start + DIAL.sweep * Math.min(1, Math.max(0, (y - DIAL.year0) / DIAL.years));

export function yearFraction(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const start = Date.UTC(y, 0, 1);
  return y + (Date.UTC(y, m - 1, d) - start) / (Date.UTC(y + 1, 0, 1) - start);
}

export function dialGeometry(readiness: number) {
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = DIAL.start + (DIAL.sweep / 20) * i;
    const major = i % 5 === 0;
    const [x1, y1] = polar(a, 151);
    const [x2, y2] = polar(a, major ? 161 : 156);
    return { x1, y1, x2, y2, major };
  });
  const years = Array.from({ length: DIAL.years }, (_, i) => {
    const y = DIAL.year0 + i;
    const [x, yy] = polar(yearAngle(y + 0.5), 116);
    return { year: y, label: `'${String(y).slice(2)}`, x, y: yy };
  });
  return {
    ticks,
    years,
    offset: ARC * (1 - Math.min(1, Math.max(0, readiness / 100))),
    dotAngle: readinessAngle(readiness),
  };
}
