// Regenerates the PWA / favicon PNG set from the Kokoro meniscus logo.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The mark, drawn in the 100-space so it can be scaled onto any tile.
const orb = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-50 -50)">
    <circle cx="50" cy="50" r="41" fill="#e2894a" opacity="0.16"/>
    <path d="M9 50 Q50 62 91 50 A41 41 0 0 1 9 50 Z" fill="#e2894a"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="#e2894a" stroke-width="9"/>
    <ellipse cx="35" cy="33" rx="8.5" ry="5.5" fill="#ffffff" opacity="0.5" transform="rotate(-20 35 33)"/>
  </g>`;

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%">
      <stop offset="0%" stop-color="#2a201a"/>
      <stop offset="60%" stop-color="#17110e"/>
      <stop offset="100%" stop-color="#100b09"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="46%">
      <stop offset="0%" stop-color="#e2894a" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#e2894a" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

// Rounded-tile icon (home screen / favicon). Orb scale 3.6.
const standard = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs}
  <rect x="0" y="0" width="512" height="512" rx="116" fill="url(#bg)"/>
  <circle cx="256" cy="258" r="210" fill="url(#glow)"/>
  ${orb(3.6)}
</svg>`;

// Maskable: full-bleed background, smaller orb inside the safe zone (scale 3.15).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs}
  <rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="258" r="200" fill="url(#glow)"/>
  ${orb(3.15)}
</svg>`;

const jobs = [
  [standard, 512, "icon-512.png"],
  [standard, 192, "icon-192.png"],
  [standard, 180, "apple-touch-icon.png"],
  [maskable, 512, "icon-maskable-512.png"],
];

for (const [svg, size, name] of jobs) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(pub, name));
  console.log("wrote", name, `(${size}px)`);
}
