/** RSS 2.0 feed of the weekly "what moved" log, built from the snapshots. */
import { snapshots } from '../lib/data.ts';
import { weeklyLog } from '../lib/log.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET({ site }: { site?: URL }): Response {
  const root = `${(site?.toString() ?? '').replace(/\/$/, '')}${import.meta.env.BASE_URL.replace(/\/$/, '')}`;
  const items = weeklyLog(snapshots).map((e) => {
    const link = `${root}/log#${e.week}`;
    const body = `<ul>${e.changes.map((c) => `<li>${esc(c.text)}${c.href ? ` <a href="${esc(c.href)}">source</a>` : ''}</li>`).join('')}</ul>`;
    return `<item><title>${esc(`${e.week}: ${e.summary}`)}</title><link>${esc(link)}</link><guid isPermaLink="false">the-trigger-${e.week}-${e.date}</guid>`
      + `<pubDate>${new Date(`${e.date}T15:00:00Z`).toUTCString()}</pubDate><description>${esc(body)}</description></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>The Trigger: what moved</title>
<link>${esc(`${root}/log`)}</link>
<description>Weekly changes in the US AI dividend readiness index, written from committed snapshots.</description>
<language>en-us</language>
${items.join('\n')}
</channel></rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
