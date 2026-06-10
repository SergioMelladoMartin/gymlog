// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Fully static: no server, no API routes. All data lives in the user's
// browser (sqlite-wasm + OPFS) and syncs to their Google Drive.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  // 'hover' instead of 'load': with 'load', pages like the diary (dozens of
  // unique /day?d=… hrefs, all resolving to the same static shell) fired a
  // prefetch per link on every page load. Hover/touchstart is still ~instant
  // for a static site and costs one request per *intended* navigation.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: {
    plugins: [tailwindcss()],
    // sqlite-wasm ships a .wasm asset; keep it untouched by the bundler.
    optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
    worker: { format: 'es' },
  },
});
