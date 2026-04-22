// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    // Bundle native binaries (Resvg) so the PNG export endpoint works on Vercel.
    includeFiles: [
      './src/fonts/Inter-Regular.ttf',
      './src/fonts/Inter-SemiBold.ttf',
      './src/fonts/Inter-Bold.ttf',
    ],
  }),
  integrations: [react()],
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
