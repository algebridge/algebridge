/**
 * Export all furniture SVG icons to transparent PNGs in public/house/furniture/.
 * Run: npx tsx scripts/export-furniture-png.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { Resvg } from "@resvg/resvg-js";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { FURNITURE_ITEMS } from "../src/data/house-catalog";
import { FurnitureSvgIcon } from "../src/data/FurnitureSvgIcon";

const OUT = join(process.cwd(), "public/house/furniture");
mkdirSync(OUT, { recursive: true });

for (const item of FURNITURE_ITEMS) {
  const inner = renderToStaticMarkup(React.createElement(FurnitureSvgIcon, { id: item.id }));
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 256 },
    background: "rgba(0,0,0,0)",
  });
  const png = resvg.render().asPng();
  const outPath = join(OUT, `${item.id}.png`);
  writeFileSync(outPath, png);
  console.log(`  exported ${item.id}.png`);
}

console.log(`Done — ${FURNITURE_ITEMS.length} furniture PNGs.`);
