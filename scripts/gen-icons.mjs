// Generates PWA PNG icons from public/favicon.svg. Run once (or whenever the
// logo changes) with: node scripts/gen-icons.mjs
//
// Outputs (all committed to the repo, not built on every deploy):
//   public/icon-192.png            — any purpose, logo fills the canvas
//   public/icon-512.png            — any purpose, logo fills the canvas
//   public/icon-512-maskable.png   — maskable purpose: solid #0f0f15 background,
//                                    logo scaled to ~60% so it survives OS masking
//   public/apple-touch-icon.png    — 180x180, iOS home screen icon
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const svgPath = path.join(root, 'public', 'favicon.svg');
const svg = readFileSync(svgPath);

const BG = '#0f0f15';

async function plain(size, outName) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(root, 'public', outName));
  console.log(`wrote ${outName} (${size}x${size})`);
}

async function maskable(size, outName) {
  const logoSize = Math.round(size * 0.6);
  const logo = await sharp(svg, { density: 384 }).resize(logoSize, logoSize).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(root, 'public', outName));
  console.log(`wrote ${outName} (${size}x${size}, maskable)`);
}

await plain(192, 'icon-192.png');
await plain(512, 'icon-512.png');
await maskable(512, 'icon-512-maskable.png');
await plain(180, 'apple-touch-icon.png');

console.log('done.');
