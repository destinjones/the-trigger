/** robots.txt: everything is public; point crawlers at the sitemap. */
export function GET({ site }: { site?: URL }): Response {
  const root = `${(site?.toString() ?? '').replace(/\/$/, '')}${import.meta.env.BASE_URL.replace(/\/$/, '')}`;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${root}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
