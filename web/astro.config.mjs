import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// SITE_URL / BASE_PATH are set by .github/workflows/deploy.yml.
// Locally and on Cloudflare Pages the site is served from the root.
export default defineConfig({
  site: process.env.SITE_URL || 'https://the-trigger.pages.dev',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [preact()],
  vite: {
    server: { fs: { allow: ['..'] } },
    // Native rasterizer for the build-time share card (src/pages/og.png.ts).
    ssr: { external: ['@resvg/resvg-js'] },
  },
});
