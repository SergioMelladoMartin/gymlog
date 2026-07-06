/**
 * Generates PWA PNG icons from public/favicon.svg.
 * Run: npx tsx scripts/generate-icons.ts
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'public/favicon.svg'));
const outDir = join(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}
