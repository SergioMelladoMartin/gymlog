// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    // Pin the function to Dublin — same AWS region (eu-west-1) as the Turso
    // database, so round-trip time is <10ms instead of ~100ms across the
    // Atlantic.
    regions: ['dub1'],
    includeFiles: [
      './src/fonts/Inter-Regular.ttf',
      './src/fonts/Inter-SemiBold.ttf',
      './src/fonts/Inter-Bold.ttf',
    ],
  }),
  integrations: [react()],
  // Speculative prefetch on hover makes navigation feel instant for the
  // next page the user is likely to click.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@resvg/resvg-js'],
    },
    optimizeDeps: {
      exclude: ['@resvg/resvg-js'],
    },
  },
});
