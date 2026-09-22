/**
 * Draws every piece of furniture in src/data/furniture-art.ts to a
 * transparent PNG in public/house/furniture/, which is what the shop and the
 * rooms show.
 *
 *   npm run furniture:export
 *
 * With --sheet it also writes furniture-sheet.png, a contact sheet of every
 * piece, for checking the set reads as one at a glance.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { FURNITURE_ITEMS } from "@/data/house-catalog";
import { ART_IDS, furnitureSvg } from "@/data/furniture-art";

const OUT = join(process.cwd(), "public/house/furniture");
mkdirSync(OUT, { recursive: true });

const ids = FURNITURE_ITEMS.map((i) => i.id);
const missing = ids.filter((id) => !ART_IDS.includes(id));
if (missing.length) {
  console.error(`No art for: ${missing.join(", ")}`);
  process.exit(1);
}

for (const id of ids) {
  const png = new Resvg(furnitureSvg(id)!, { fitTo: { mode: "width", value: 256 }, background: "rgba(0,0,0,0)" }).render().asPng();
  writeFileSync(join(OUT, `${id}.png`), png);
}
console.log(`${ids.length} pieces drawn.`);

if (process.argv.includes("--sheet")) {
  const cols = 10;
  const cell = 100;
  const rows = Math.ceil(ids.length / cols);
  const tiles = ids
    .map((id, i) => {
      const inner = furnitureSvg(id)!.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * cell;
      return `<g transform="translate(${x} ${y})"><rect width="${cell}" height="${cell}" fill="${i % 2 ? "#f1f5f9" : "#e2e8f0"}"/>${inner}</g>`;
    })
    .join("");
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * cell} ${rows * cell}">${tiles}</svg>`;
  const png = new Resvg(sheet, { fitTo: { mode: "width", value: cols * 140 } }).render().asPng();
  writeFileSync(join(process.cwd(), ".cache", "furniture-sheet.png"), png);
  console.log("Contact sheet at .cache/furniture-sheet.png");
}
