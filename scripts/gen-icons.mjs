// Generate PNG icons from public/icon.svg. Run: npm run icons (outputs are committed).
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const BG = '#059669';
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

const plain = (size) => sharp(svg, { density: 384 }).resize(size, size).flatten({ background: BG }).png();

await plain(192).toFile(out('icon-192.png'));
await plain(512).toFile(out('icon-512.png'));
await plain(180).toFile(out('apple-touch-icon.png'));

// Maskable: shrink artwork into the 80% safe zone on a full-bleed background.
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: BG } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-512-maskable.png'));

console.log('icons generated');
