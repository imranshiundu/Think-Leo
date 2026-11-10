/**
 * Think Leo — docs mood gallery
 * Renders the REAL parametric Leo component (src/components/leo/Leo.tsx)
 * to static SVG files so the documentation can show every mood.
 * Run: bun scripts/docs-mood-gallery.tsx
 */
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "fs";
import React from "react";
import { Leo } from "../src/components/leo/Leo";

const MOODS = [
  "idle",
  "happy",
  "excited",
  "sad",
  "thinking",
  "celebrate",
  "wow",
  "cheer",
  "sleep",
] as const;

mkdirSync("docs/assets", { recursive: true });

for (const mood of MOODS) {
  const html = renderToStaticMarkup(
    React.createElement(Leo, { mood, size: 220, bubble: null })
  );
  // strip framer-motion artifacts so the file is pure, valid SVG
  const svg = html
    .replace(/<div[^>]*>/g, "")
    .replace(/<\/div>/g, "")
    .replace(/<span[^>]*>[\s\S]*?<\/span>/g, "") // sparkles are runtime DOM
    .replace(/ style="[^"]*"/g, "")
    .trim();
  if (!svg.startsWith("<svg")) {
    console.error(`✗ ${mood}: no <svg> produced`, svg.slice(0, 80));
    process.exit(1);
  }
  writeFileSync(`docs/assets/leo-${mood}.svg`, svg + "\n");
  console.log("✓", `docs/assets/leo-${mood}.svg`);
}
console.log("Mood gallery written.");
