/**
 * Embeddable badge: live readiness and projected quarter, rebuilt with every
 * snapshot. <img src=".../badge.svg"> in a README or post links back here.
 */
import { latest } from '../lib/data.ts';
import { quarter } from '../lib/headline.ts';
import { readinessColor, TOKEN_HEX } from '../../../index/color.ts';


export function GET(): Response {
  const left = 'AI dividend';
  const right = `${latest.readiness.toFixed(1)}/100 · ${quarter}`;
  // Plex Mono at 11px is ~6.6px per character.
  const lw = Math.round(left.length * 6.6 + 16);
  const rw = Math.round(right.length * 6.6 + 16);
  const color = TOKEN_HEX[readinessColor(latest.readiness)] ?? '#ffb020';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${left}: ${right}">
<title>The Trigger: readiness ${latest.readiness.toFixed(1)}/100, first federal check projected ${quarter} ±${latest.bandMonths} months (snapshot ${latest.date})</title>
<rect width="${lw}" height="20" fill="#0b0f15"/><rect x="${lw}" width="${rw}" height="20" fill="#06080b"/>
<rect x="0.5" y="0.5" width="${lw + rw - 1}" height="19" fill="none" stroke="#182030"/>
<g font-family="'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace" font-size="11">
<text x="8" y="14" fill="#f4f7fb">${left}</text><text x="${lw + 8}" y="14" fill="${color}">${right}</text>
</g></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
