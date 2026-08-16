/**
 * Generates the BBS app icons from the product mark.
 *
 * The mark is the timer ring broken into the five exercises of a workout, each
 * segment one step along the spectrum. It is drawn as geometry rather than
 * text, so rasterising never depends on a font being installed.
 *
 * The same shape is drawn in the app by src/components/Logo.tsx — the two have
 * to be changed together.
 *
 *   node scripts/gen-icons.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const INK = '#0a0a0b';

const CENTRE = 256;
const RADIUS = 176;
const STROKE = 54;

const SEGMENTS = 5;
const GAP_DEG = 26;
const SPAN_DEG = 360 / SEGMENTS - GAP_DEG;

/** Five stops of the timer's spectrum. Kept in step with src/components/Logo.tsx. */
const COLORS = ['#E5484D', '#E8811A', '#2BA55B', '#1F7FE0', '#8B4FD0'];

/** A point on the ring. 0 degrees is the top, running clockwise. */
function point(degrees) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return [CENTRE + RADIUS * Math.cos(rad), CENTRE + RADIUS * Math.sin(rad)];
}

/**
 * The mark on a 512 grid, scaled about its centre.
 * @param {{ scale?: number }} o
 */
function mark({ scale = 1 } = {}) {
  const arcs = COLORS.map((stroke, i) => {
    const from = GAP_DEG / 2 + i * (SPAN_DEG + GAP_DEG);
    const [x1, y1] = point(from);
    const [x2, y2] = point(from + SPAN_DEG);
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    return `    <path d="${d}" stroke="${stroke}"/>`;
  }).join('\n');

  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `
  <g transform="${t}" fill="none" stroke-width="${STROKE}" stroke-linecap="round">
${arcs}
  </g>`;
}

/** @param {{ background: string|null, scale: number }} o */
function icon({ background, scale }) {
  const bg = background ? `<rect width="512" height="512" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}${mark(
    { scale },
  )}</svg>`;
}

/**
 * The favicon needs no theme handling: the mark is colour on transparency and
 * reads the same on a light tab strip as on a dark one.
 */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${mark()}
</svg>
`;

const standard = icon({ background: INK, scale: 1 });

// Maskable icons are cropped by the platform; keep the mark inside the safe circle.
const maskable = icon({ background: INK, scale: 0.72 });

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
