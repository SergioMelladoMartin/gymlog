// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel({ regions: ['dub1'] }),
  integrations: [react()],
  // `load` strategy prefetches every internal link the moment the page is
  // rendered. Essential for mobile where there's no hover. Combined with
  // ClientRouter's view-transitions this makes most navigations feel
  // instant because the HTML is already sitting in the browser cache.
  prefetch: { prefetchAll: true, defaultStrategy: 'load' },
  vite: { plugins: [tailwindcss()] },
});
