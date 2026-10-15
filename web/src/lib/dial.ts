/**
 * Dial geometry: a 270° ring in a 340×340 box, starting at 135° (lower left)
 * and running clockwise. Two rings, two scales, never mixed:
 *   - the outer ring is time, 2026.0 to 2036.0. The projection window is drawn
 *     on it as an arc, the point estimate as a dot, today as a marker;
 *   - the thin inner ring is readiness, 0 to 100, matching the centre number.
 * Pure: inputs in, numbers out.
 */
export const DIAL = { cx: 170, cy: 170, r: 140, rInner: 98, start: 135, sweep: 270, year0: 2026, years: 10 } as const;
export const CIRC = 2 * Math.PI * DIAL.r;
export const ARC = CIRC * (DIAL.sweep / 360);
export const CIRC_INNER = 2 * Math.PI * DIAL.rInner;
export const ARC_INNER = CIRC_INNER * (DIAL.sweep / 360);

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export function polar(deg: number, r: number): [number, number] {
  return [DIAL.cx + r * Math.cos(rad(deg)), DIAL.cy + r * Math.sin(rad(deg))];
}

/** Angle of a 0–100 readiness value on the inner ring. */
export const readinessAngle = (v: number) => DIAL.start + DIAL.sweep * clamp01(v / 100);

/** Angle of a year fraction on the outer ring (2026.0 → start, 2036.0 → end). */
export const yearAngle = (y: number) => DIAL.start + DIAL.sweep * clamp01((y - DIAL.year0) / DIAL.years);

export function yearFraction(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const start = Date.UTC(y, 0, 1);
  return y + (Date.UTC(y, m - 1, d) - start) / (Date.UTC(y + 1, 0, 1) - start);
}

export interface DialInput { readiness: number; windowFrom: string; windowTo: string; projectedDate: string }

export function dialGeometry({ readiness, windowFrom, windowTo, projectedDate }: DialInput) {
  // One tick per quarter, long ticks at each January: the ticks belong to the time ring.
  const ticks = Array.from({ length: DIAL.years * 4 + 1 }, (_, i) => {
    const a = DIAL.start + (DIAL.sweep / (DIAL.years * 4)) * i;
    const major = i % 4 === 0;
    const [x1, y1] = polar(a, 151);
    const [x2, y2] = polar(a, major ? 161 : 155);
    return { x1, y1, x2, y2, major };
  });
  const years = Array.from({ length: DIAL.years }, (_, i) => {
    const y = DIAL.year0 + i;
    const [x, yy] = polar(yearAngle(y + 0.5), 120);
    return { year: y, label: `'${String(y).slice(2)}`, x, y: yy };
  });
  const a0 = yearAngle(yearFraction(windowFrom));
  const a1 = yearAngle(yearFraction(windowTo));
  return {
    ticks,
    years,
    /** Projection window on the time ring: start angle and arc length. */
    band: { start: a0, length: CIRC * ((a1 - a0) / 360) },
    dotAngle: yearAngle(yearFraction(projectedDate)),
    /** Readiness on the inner ring, as a dash offset. */
    innerOffset: ARC_INNER * (1 - clamp01(readiness / 100)),
  };
}
