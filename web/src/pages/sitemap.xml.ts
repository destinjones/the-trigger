/** sitemap.xml for every HTML page, stamped with the newest snapshot date. */
import { latest } from '../lib/data.ts';

const PAGES = ['', 'calculator', 'what-would-move-it', 'log', 'method', 'data'];

export function GET({ site }: { site?: URL }): Response {
  const root = `${(site?.toString() ?? '').replace(/\/$/, '')}${import.meta.env.BASE_URL.replace(/\/$/, '')}`;
  const urls = PAGES.map((p) => `<url><loc>${root}/${p}</loc><lastmod>${latest.date}</lastmod><changefreq>daily</changefreq></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
