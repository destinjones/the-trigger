/**
 * Share card (og:image), rendered at build time from the latest snapshot, so
 * the image people see in a link preview carries today's numbers. SVG drawn
 * here, rasterized with resvg. Fonts are IBM Plex Mono (OFL), committed in
 * web/og/fonts so the render is identical on every machine.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { latest } from '../lib/data.ts';
import { cuts, moved, quarter } from '../lib/headline.ts';
import { readinessColor, TOKEN_HEX } from '../../../index/color.ts';
import { ARC, CIRC } from '../lib/dial.ts';

// Hex copies of web/src/styles/tokens.css; resvg cannot read CSS variables.
const C = { bg: '#06080b', pnl: '#0b0f15', bd: '#182030', fg: '#f4f7fb', mut: '#71829a', dim: '#3a4757', amb: '#ffb020', red: '#ff4a4a', cyn: '#38d2f2' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fontDir(): string {
  // Astro builds with --root web from the repo root; allow running from web/ too.
  for (const d of [join(process.cwd(), 'web', 'og', 'fonts'), join(process.cwd(), 'og', 'fonts')]) {
    if (existsSync(d)) return d;
  }
  throw new Error('og.png: IBM Plex Mono not found in web/og/fonts');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function cardSvg(): string {
  const cutsValue = cuts ? cuts.value.toLocaleString('en-US') : '—';
  const cutsYear = cuts?.metricId.endsWith('ytd') ? `in ${cuts.asOf.slice(0, 4)}` : 'in the last 12 months';
  const [y, m] = latest.projectedDate.split('-').map(Number) as [number, number];
  const date = `${MONTHS[m - 1]} ${y}`;
  const ring = TOKEN_HEX[readinessColor(latest.readiness) as keyof typeof TOKEN_HEX] ?? C.amb;
  const t = (x: number, yy: number, size: number, fill: string, text: string, weight = 400, anchor = 'start', ls = 0) =>
    `<text x="${x}" y="${yy}" font-family="IBM Plex Mono" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}>${esc(text)}</text>`;
  // Ring: same geometry as the homepage dial (r 140 in a 340 box), scaled to 0.95.
  const cx = 960, cy = 330, s = 0.95, r = 140 * s;
  const circ = CIRC * s, arc = ARC * s;
  const offset = arc * (1 - Math.max(0, Math.min(100, latest.readiness)) / 100);
  const circle = (stroke: string, dashoffset: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${dashoffset.toFixed(1)}" transform="rotate(135 ${cx} ${cy})"/>`;
  const end = (135 + 270 * latest.readiness / 100) * Math.PI / 180;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.bg}"/>
  <rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="${C.bd}"/>
  ${t(64, 88, 22, C.fg, 'THE TRIGGER', 500, 'start', 3.7)}
  ${t(64, 124, 22, C.amb, "The layoffs started. The checks haven't.", 400)}
  ${t(64, 262, 78, C.red, cutsValue, 500)}
  ${t(64, 302, 20, C.fg, `US jobs cut citing AI ${cutsYear}`)}
  ${t(64, 334, 18, C.mut, `${moved ? (moved.value === 0 ? 'Zero' : moved.value) : '—'} federal dividend bills out of committee`)}
  ${t(64, 418, 15, C.dim, 'FIRST FEDERAL CHECK, PROJECTED', 400, 'start', 2.5)}
  ${t(64, 466, 34, C.cyn, `${date} ±${latest.bandMonths} mo`, 500)}
  ${t(64, 500, 18, C.mut, `${quarter} · ${Math.round(latest.confidence * 100)}% confidence`)}
  ${t(64, 574, 16, C.mut, `snapshot ${latest.date} · every number cited · open source`)}
  ${circle(C.bd, 0)}
  ${circle(ring, offset)}
  <circle cx="${(cx + r * Math.cos(end)).toFixed(1)}" cy="${(cy + r * Math.sin(end)).toFixed(1)}" r="5.5" fill="${C.fg}"/>
  ${t(cx, cy + 18, 62, C.fg, latest.readiness.toFixed(1), 500, 'middle')}
  ${t(cx, cy + 50, 14, C.mut, 'READINESS / 100', 400, 'middle', 2.4)}
</svg>`;
}

export function GET(): Response {
  const dir = fontDir();
  const png = new Resvg(cardSvg(), {
    font: {
      fontFiles: [join(dir, 'IBMPlexMono-Regular.ttf'), join(dir, 'IBMPlexMono-Medium.ttf')],
      loadSystemFonts: false,
      defaultFontFamily: 'IBM Plex Mono',
    },
  }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
}
