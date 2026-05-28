// Generate a placeholder 1024x1024 app icon as a flat rounded square in the
// Papering accent. Sharp is already in the dep tree (transitive of Next.js).
//
// Run once, then `pnpm tauri icon icons/source.png` fans the sizes out.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.cwd(), "icons/source.png");
mkdirSync(resolve(process.cwd(), "icons"), { recursive: true });

const size = 1024;
const radius = 224;
const accent = "#c44a3a"; // matches oklch(0.72 0.18 28) approx in sRGB
const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d96a5b"/>
      <stop offset="100%" stop-color="#a83a2c"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)"/>
  <g fill="#ffffff" opacity="0.95">
    <rect x="280" y="320" width="464" height="36" rx="18"/>
    <rect x="280" y="440" width="464" height="36" rx="18"/>
    <rect x="280" y="560" width="320" height="36" rx="18"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${out}`);
