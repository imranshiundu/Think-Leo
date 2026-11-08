/**
 * Think Leo — PWA icon generator
 * Renders Leo's head as PNG icons via sharp (already in node_modules).
 * Run: bun scripts/make-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

// Leo head, centered on a warm rounded-square. `scale` controls how much
// of the canvas the head fills (maskable icons need a ~20% safe zone).
function leoIconSvg(size, scale = 1, bg = "#FFB020") {
  const cx = 500, cy = 500;
  const maneR = 300 * scale;
  const bumps = 12;
  const bumpR = 96 * scale;
  const faceR = 258 * scale;
  let bumpCircles = "";
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const x = cx + maneR * Math.cos(a);
    const y = cy + maneR * Math.sin(a);
    bumpCircles += `<circle cx="${x}" cy="${y}" r="${bumpR}" fill="#C4622D"/>`;
  }
  const eyeY = cy - 30 * scale;
  const eyeDx = 95 * scale;
  const pupil = 26 * scale;
  const shine = 9 * scale;
  const noseY = cy + 70 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" rx="${bg === "none" ? 0 : 220}" fill="${bg}"/>
  <circle cx="${cx}" cy="${cy}" r="${maneR}" fill="#C4622D"/>
  ${bumpCircles}
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="#FFC93C"/>
  <circle cx="${cx - eyeDx}" cy="${eyeY}" r="${46 * scale}" fill="#fff"/>
  <circle cx="${cx + eyeDx}" cy="${eyeY}" r="${46 * scale}" fill="#fff"/>
  <circle cx="${cx - eyeDx + 6 * scale}" cy="${eyeY + 6 * scale}" r="${pupil}" fill="#4A2F1B"/>
  <circle cx="${cx + eyeDx + 6 * scale}" cy="${eyeY + 6 * scale}" r="${pupil}" fill="#4A2F1B"/>
  <circle cx="${cx - eyeDx + 14 * scale}" cy="${eyeY - 6 * scale}" r="${shine}" fill="#fff"/>
  <circle cx="${cx + eyeDx + 14 * scale}" cy="${eyeY - 6 * scale}" r="${shine}" fill="#fff"/>
  <ellipse cx="${cx}" cy="${cy + 105 * scale}" rx="${110 * scale}" ry="${72 * scale}" fill="#FFE9C7"/>
  <path d="M ${cx - 52 * scale} ${noseY} q 52 ${-34 * scale} 104 0 q ${-10 * scale} ${44 * scale} ${-52 * scale} ${48 * scale} q ${-42 * scale} ${-4 * scale} ${-52 * scale} ${-48 * scale} z" fill="#7A4526"/>
  <path d="M ${cx - 58 * scale} ${cy + 150 * scale} q 58 ${44 * scale} 116 0" stroke="#7A4526" stroke-width="${16 * scale}" fill="none" stroke-linecap="round"/>
</svg>`;
}

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log("✓", file);
}

mkdirSync("public/icons", { recursive: true });

const anyIcon = leoIconSvg(1000, 0.86);
await render(leoIconSvg(192, 0.86), "public/icons/icon-192.png");
await render(leoIconSvg(512, 0.86), "public/icons/icon-512.png");
await render(leoIconSvg(180, 0.86), "public/icons/apple-touch-icon.png");
// maskable: smaller head + full-bleed background for safe-zone cropping
await render(leoIconSvg(512, 0.68, "#FFB020").replace('rx="220"', 'rx="0"'), "public/icons/maskable-512.png");
// favicon
await render(leoIconSvg(32, 0.9), "public/icons/favicon-32.png");
console.log("All icons generated.");
