/**
 * Generates the BBS app icons.
 *
 * The mark is a timer ring with a 90 degree arc and the numerals "90". Both the
 * ring and the digits are drawn as geometry rather than text, so rasterising
 * never depends on a font being installed.
 *
 *   node scripts/gen-icons.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const INK = '#0a0a0b';
const LIGHT = '#f4f4f6';

/**
 * The mark on a 512 grid.
 * @param {{ scale?: number, digits: string, track: string, accent: string }} o
 */
function mark({ scale = 1, digits, track, accent }) {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `
  <g transform="${t}" fill="none" stroke-linecap="round">
    <circle cx="256" cy="256" r="210" stroke="${track}" stroke-width="13"/>
    <path d="M256 46 A210 210 0 0 1 466 256" stroke="${accent}" stroke-width="13"/>
    <g stroke="${digits}" stroke-width="26" stroke-linejoin="round">
      <circle cx="196" cy="218" r="37"/>
      <path d="M233 218 C233 282 222 316 180 333"/>
      <ellipse cx="316" cy="256" rx="40" ry="75"/>
    </g>
  </g>`;
}

/** @param {{ background: string|null, scale: number, digits: string, track: string, accent: string }} o */
function icon({ background, scale, digits, track, accent }) {
  const bg = background ? `<rect width="512" height="512" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}${mark(
    { scale, digits, track, accent },
  )}</svg>`;
}

/** Theme-aware favicon: no background plate, colours follow the OS. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <style>
    .digits { stroke: ${INK}; }
    .track { stroke: rgba(10,10,11,0.18); }
    @media (prefers-color-scheme: dark) {
      .digits { stroke: ${LIGHT}; }
      .track { stroke: rgba(244,244,246,0.22); }
    }
  </style>
  <g fill="none" stroke-linecap="round">
    <circle class="track" cx="256" cy="256" r="210" stroke-width="13"/>
    <path class="digits" d="M256 46 A210 210 0 0 1 466 256" stroke-width="13"/>
    <g class="digits" stroke-width="26" stroke-linejoin="round">
      <circle cx="196" cy="218" r="37"/>
      <path d="M233 218 C233 282 222 316 180 333"/>
      <ellipse cx="316" cy="256" rx="40" ry="75"/>
    </g>
  </g>
</svg>
`;

const standard = icon({
  background: INK,
  scale: 0.74,
  digits: LIGHT,
  track: 'rgba(244,244,246,0.2)',
  accent: LIGHT,
});

// Maskable icons are cropped by the platform; keep the mark inside the safe circle.
const maskable = icon({
  background: INK,
  scale: 0.58,
  digits: LIGHT,
  track: 'rgba(244,244,246,0.2)',
  accent: LIGHT,
});

async function png(svg, size, name) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(OUT, name), buffer);
  console.log(`  ${name}  ${size}x${size}  ${(buffer.length / 1024).toFixed(1)} kB`);
}

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'favicon.svg'), favicon);
console.log('  favicon.svg');
await png(standard, 192, 'icon-192.png');
await png(standard, 512, 'icon-512.png');
await png(maskable, 192, 'maskable-192.png');
await png(maskable, 512, 'maskable-512.png');
await png(standard, 180, 'apple-touch-icon.png');
