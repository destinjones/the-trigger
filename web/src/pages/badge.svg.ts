/**
 * Embeddable badge: live readiness and projected quarter, rebuilt with every
 * snapshot. <img src=".../badge.svg"> in a README or post links back here.
 */
import { latest } from '../lib/data.ts';
import { quarter } from '../lib/headline.ts';
import { scoreColor } from '../lib/format.ts';

const HEX: Record<string, string> = { 'var(--red)': '#ff5c5c', 'var(--amber)': '#f5b544', 'var(--green)': '#2fd47a' };

export function GET(): Response {
  const left = 'AI dividend';
  const right = `${latest.readiness.toFixed(1)}/100 · ${quarter}`;
  // Plex Mono at 11px is ~6.6px per character.
  const lw = Math.round(left.length * 6.6 + 16);
  const rw = Math.round(right.length * 6.6 + 16);
  const color = HEX[scoreColor(latest.readiness)] ?? '#f5b544';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${left}: ${right}">
<title>The Trigger: readiness ${latest.readiness.toFixed(1)}/100, first federal check projected ${quarter} ±${latest.bandMonths} months (snapshot ${latest.date})</title>
<rect width="${lw}" height="20" fill="#151a23"/><rect x="${lw}" width="${rw}" height="20" fill="#0e1117"/>
<rect x="0.5" y="0.5" width="${lw + rw - 1}" height="19" fill="none" stroke="#242b38"/>
<g font-family="'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace" font-size="11">
<text x="8" y="14" fill="#e6e9ef">${left}</text><text x="${lw + 8}" y="14" fill="${color}">${right}</text>
</g></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
