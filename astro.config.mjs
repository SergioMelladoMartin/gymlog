// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Fully static: no server, no API routes. All data lives in the user's
// browser (sqlite-wasm + OPFS) and syncs to their Google Drive.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  prefetch: { prefetchAll: true, defaultStrategy: 'load' },
  vite: {
    plugins: [tailwindcss()],
    // sqlite-wasm ships a .wasm asset; keep it untouched by the bundler.
    optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
    worker: { format: 'es' },
  },
});
