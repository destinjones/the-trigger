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
import { cuts, cutsLabel, cutsThrough, moved, movedLabel, quarter } from '../lib/headline.ts';
import { scoreColor } from '../lib/format.ts';

const C = {
  bg: '#0e1117', panel: '#151a23', border: '#242b38', fg: '#e6e9ef', muted: '#7b8798',
  red: '#ff5c5c', amber: '#f5b544', green: '#2fd47a',
};
const TOKEN: Record<string, string> = { 'var(--red)': C.red, 'var(--amber)': C.amber, 'var(--green)': C.green };

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

export function cardSvg(): string {
  const cutsValue = cuts ? cuts.value.toLocaleString('en-US') : '—';
  const movedValue = moved ? String(moved.value) : '—';
  const readinessColor = TOKEN[scoreColor(latest.readiness)] ?? C.amber;
  const t = (x: number, y: number, size: number, fill: string, text: string, weight = 400, anchor = 'start') =>
    `<text x="${x}" y="${y}" font-family="IBM Plex Mono" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.bg}"/>
  <rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="${C.border}"/>
  ${t(64, 84, 24, C.fg, 'THE TRIGGER', 500)}${t(224, 84, 24, C.amber, '_', 500)}
  ${t(1136, 84, 20, C.muted, `snapshot ${latest.date}`, 400, 'end')}
  ${t(64, 182, 58, C.fg, 'The layoffs started.', 500)}
  ${t(64, 252, 58, C.amber, "The checks haven't.", 500)}
  <rect x="64" y="300" width="520" height="190" fill="${C.panel}" stroke="${C.border}"/>
  ${t(92, 386, 72, C.red, cutsValue, 500)}
  ${t(92, 428, 20, C.fg, cuts ? `US job cuts citing AI, ${cuts.metricId.endsWith('ytd') ? cuts.asOf.slice(0, 4) : 'last 12 mo'}` : cutsLabel)}
  ${t(92, 462, 18, C.muted, `Challenger, Gray & Christmas, ${cutsThrough.replace('through ', 'to ')}`)}
  <rect x="616" y="300" width="520" height="190" fill="${C.panel}" stroke="${C.border}"/>
  ${t(644, 386, 72, moved && moved.value === 0 ? C.red : C.amber, movedValue, 500)}
  ${t(644, 428, 20, C.fg, movedLabel)}
  ${t(644, 462, 18, C.muted, 'Congress.gov bill actions')}
  ${t(64, 556, 24, C.fg, `First federal check projected ${quarter}, ±${latest.bandMonths} mo`)}
  <text x="64" y="592" font-family="IBM Plex Mono" font-size="20" fill="${C.muted}">Readiness <tspan fill="${readinessColor}" font-weight="500">${latest.readiness.toFixed(1)}/100</tspan> · ${Math.round(latest.confidence * 100)}% confidence · every number cited</text>
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
