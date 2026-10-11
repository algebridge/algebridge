// Bakes the real cities students can buy a plot in: for each, a square of
// ground round a landmark, with its real terrain, satellite imagery and
// every building's footprint and height, saved into public/world/<id>/ so
// the page loads one small file per city and never calls a map service.
//
// Sources (all open, attributed on the page):
//   imagery   Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), tiles.maps.eox.at
//   terrain   Terrain Tiles on AWS (Mapzen terrarium), s3 elevation-tiles-prod
//   buildings and water  OpenStreetMap (ODbL), via the Overpass API
//
// node scripts/world-cities.mjs            all cities
// ONLY=paris node scripts/world-cities.mjs one
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { CITIES, CITY_SIZE } from "../src/data/world-cities.mjs";

const UA = "AlgeBridge-world-bake/1.0";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HALF = CITY_SIZE / 2;
const M_LAT = 110540;
const mLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const worldPx = (lat, lon, z) => {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    await sleep(1500 * (i + 1));
  }
  throw new Error(`fetch failed: ${url}`);
}

/** A square of tiles at zoom z covering the bbox, stitched, cropped to it and resized to `out` pixels a side; returns sharp raw or jpeg. */
async function mosaic(urlFor, z, b, out, kind) {
  const a = worldPx(b.n, b.w, z);
  const c = worldPx(b.s, b.e, z);
  const tx0 = Math.floor(a.x / 256), ty0 = Math.floor(a.y / 256), tx1 = Math.floor(c.x / 256), ty1 = Math.floor(c.y / 256);
  const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256;
  const parts = [];
  for (let ty = ty0; ty <= ty1; ty += 1)
    for (let tx = tx0; tx <= tx1; tx += 1) parts.push({ input: await get(urlFor(z, tx, ty)), left: (tx - tx0) * 256, top: (ty - ty0) * 256 });
  const base = sharp({ create: { width: W, height: H, channels: 3, background: "#000" } }).composite(parts);
  const full = await base.png().toBuffer();
  const left = Math.round(a.x - tx0 * 256), top = Math.round(a.y - ty0 * 256);
  const w = Math.round(c.x - a.x), h = Math.round(c.y - a.y);
  const crop = sharp(full).extract({ left, top, width: w, height: h });
  if (kind === "raw") return crop.resize(out, out, { kernel: "linear" }).removeAlpha().raw().toBuffer();
  return crop.resize(out, out, { kernel: "lanczos3" }).modulate({ saturation: 1.1, brightness: 1.04 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function overpass(q) {
  for (let i = 0; i < 6; i += 1) {
    const url = OVERPASS[i % OVERPASS.length];
    const r = await fetch(url, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
    if (r.ok) return r.json();
    await sleep(4000 * (i + 1));
  }
  throw new Error("overpass failed");
}

function inside(x, z, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Outer ways of a multipolygon joined end to end into closed rings. */
function rings(ways) {
  const open = ways.map((w) => w.slice());
  const out = [];
  while (open.length) {
    let r = open.shift();
    let grew = true;
    while (grew && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) {
      grew = false;
      for (let i = 0; i < open.length; i += 1) {
        const w = open[i];
        const end = r[r.length - 1];
        const same = (p, q) => p[0] === q[0] && p[1] === q[1];
        if (same(w[0], end)) r = r.concat(w.slice(1));
        else if (same(w[w.length - 1], end)) r = r.concat(w.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(r);
  }
  return out;
}

/**
 * The elevation source picks up some tall structures as ground (spikes of
 * 100 m in London): each point becomes the median of the 5x5 round it, and
 * nothing stands more than 25 m above its neighbourhood's low.
 */
export function despike(h, n) {
  const out = [];
  for (let j = 0; j < n; j += 1)
    for (let i = 0; i < n; i += 1) {
      const near = [];
      for (let dj = -2; dj <= 2; dj += 1) for (let di = -2; di <= 2; di += 1) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < n && b < n) near.push(h[b * n + a]);
      }
      near.sort((p, q) => p - q);
      out.push(Math.round(Math.min(near[Math.floor(near.length / 2)], near[0] + 25) * 10) / 10);
    }
  return out;
}

const height = (t) => {
  const h = parseFloat(String(t.height ?? "").replace(/[^0-9.]/g, ""));
  if (h > 2 && h < 600) return h;
  const lv = parseFloat(t["building:levels"]);
  if (lv > 0 && lv < 200) return lv * 3.2 + 1.5;
  return t.building === "house" || t.building === "garage" || t.building === "shed" ? 6 : 12;
};

if (!process.env.NO_BAKE) for (const city of CITIES.filter((c) => !process.env.ONLY || c.id === process.env.ONLY)) {
  const dLat = HALF / M_LAT, dLon = HALF / mLon(city.lat);
  const b = { s: city.lat - dLat, n: city.lat + dLat, w: city.lon - dLon, e: city.lon + dLon };
  const local = (lat, lon) => [Math.round((lon - city.lon) * mLon(city.lat) * 2) / 2, Math.round(-(lat - city.lat) * M_LAT * 2) / 2];
  console.log(`== ${city.name}`);
  const dir = new URL(`../public/world/${city.id}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  // Imagery.
  const sat = await mosaic((z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`, 16, b, 1024, "jpeg");
  const look = await sharp(sat).resize(256, 256).removeAlpha().raw().toBuffer();
  // Terrain, relative to the middle of the square.
  const N = 61;
  const terr = await mosaic((z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, 14, b, N, "raw");
  const elev = [];
  for (let i = 0; i < N * N; i += 1) elev.push(terr[i * 3] * 256 + terr[i * 3 + 1] + terr[i * 3 + 2] / 256 - 32768);
  const sorted = [...elev].sort((p, q) => p - q);
  const base = sorted[Math.floor(sorted.length * 0.1)];
  const heights = despike(elev.map((e) => Math.max(-5, e - base)), N);
  // Buildings and water.
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  const bj = await overpass(`[out:json][timeout:120];(way["building"](${bb});relation["building"](${bb});way["man_made"="tower"]["height"](${bb}););out tags geom;`);
  await sleep(3000);
  const mj = await overpass(`[out:json][timeout:120];(way["highway"](${bb});way["leisure"~"park|garden|pitch"](${bb});way["landuse"~"grass|forest|recreation_ground|meadow"](${bb}););out tags geom;`);
  await sleep(3000);
  const wj = await overpass(`[out:json][timeout:120];(way["natural"="water"](${bb});way["waterway"="riverbank"](${bb});relation["natural"="water"](${bb});relation["waterway"="riverbank"](${bb}););out geom;`);
  await sleep(3000);
  const buildings = [];
  const shapes = [];
  for (const el of bj.elements ?? []) {
    if (el.type === "relation") {
      for (const r of rings((el.members ?? []).filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry.map((p) => [p.lat, p.lon])))) if (r.length >= 4) shapes.push({ tags: el.tags ?? {}, geometry: r.map(([lat, lon]) => ({ lat, lon })) });
    } else shapes.push(el);
  }
  for (const el of shapes) {
    if (!el.geometry || el.geometry.length < 4) continue;
    const pts = el.geometry.map((p) => local(p.lat, p.lon));
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    if (Math.abs(cx) > HALF || Math.abs(cz) > HALF) continue;
    const flat = [];
    for (const p of pts.slice(0, -1)) flat.push(p[0], p[1]);
    // A tower (the Eiffel Tower) narrows to its top: a negative height says so.
    const taper = (el.tags ?? {}).man_made === "tower" || /tower|spire/.test((el.tags ?? {}).building ?? "");
    buildings.push([(taper ? -1 : 1) * Math.round(height(el.tags ?? {}) * 2) / 2, ...flat]);
  }
  const water = [];
  for (const el of wj.elements ?? []) {
    if (el.type === "way" && el.geometry) water.push(el.geometry.map((p) => local(p.lat, p.lon)));
    if (el.type === "relation") for (const r of rings((el.members ?? []).filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry.map((p) => local(p.lat, p.lon))))) water.push(r);
  }
  const waterFlat = water.map((r) => r.flat());
  const bFlat = buildings.map((bd) => bd.slice(1));
  // The ground: the satellite picture with the real streets, parks and water drawn over it crisply.
  const PX = 2048;
  const sv = (x) => (((x + HALF) / CITY_SIZE) * PX).toFixed(1);
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sv(p[0])} ${sv(p[1])}`).join("");
  const ROAD = { motorway: 22, trunk: 20, primary: 17, secondary: 14, tertiary: 11, residential: 8, unclassified: 8, living_street: 7, pedestrian: 7, service: 4.5, footway: 2.2, path: 2, cycleway: 2.2, steps: 2 };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PX}" height="${PX}">`;
  for (const el of mj.elements ?? []) {
    const t = el.tags ?? {};
    if (!el.geometry || t.highway) continue;
    svg += `<path d="${path(el.geometry.map((p) => local(p.lat, p.lon)))}Z" fill="#6e9a4c" fill-opacity="0.55"/>`;
  }
  for (const r of water) svg += `<path d="${path(r)}Z" fill="#3f6f93" fill-opacity="0.9"/>`;
  const ways = (mj.elements ?? []).filter((el) => el.geometry && el.tags?.highway && ROAD[el.tags.highway]).sort((p, q) => ROAD[p.tags.highway] - ROAD[q.tags.highway]);
  for (const el of ways) {
    const w = (ROAD[el.tags.highway] / CITY_SIZE) * PX;
    const foot = w < 2.5 / CITY_SIZE * PX;
    svg += `<path d="${path(el.geometry.map((p) => local(p.lat, p.lon)))}" fill="none" stroke="${foot ? "#c9c2b2" : "#55595e"}" stroke-opacity="${foot ? 0.7 : 0.95}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (const r of bFlat) {
    const pts = [];
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
    svg += `<path d="${path(pts)}Z" fill="#8e8a84" fill-opacity="0.9"/>`;
  }
  svg += "</svg>";
  const ground = await sharp(sat).resize(PX, PX, { kernel: "lanczos3" }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  writeFileSync(new URL("ground.jpg", dir), ground);
  // Plots: open ground on a grid (parks, squares, empty lots), clear of buildings and water, nearest the landmark first.
  const plots = [];
  const clear = (x, z) => !bFlat.some((r) => inside(x, z, r)) && !waterFlat.some((r) => inside(x, z, r));
  const looksWet = (x, z) => {
    const px = Math.min(255, Math.max(0, Math.round(((x + HALF) / CITY_SIZE) * 255)));
    const pz = Math.min(255, Math.max(0, Math.round(((z + HALF) / CITY_SIZE) * 255)));
    const o = (pz * 256 + px) * 3;
    const [r, g, bl] = [look[o], look[o + 1], look[o + 2]];
    return bl > r + 12 && bl >= g && r + g + bl < 330;
  };
  const cands = [];
  for (let x = -480; x <= 480; x += 60) for (let z = -480; z <= 480; z += 60) cands.push([x, z]);
  cands.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
  for (const [x, z] of cands) {
    if (plots.length >= 18) break;
    const ok = [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9], [7, 7], [-7, -7], [7, -7], [-7, 7]].every(([dx, dz]) => clear(x + dx, z + dz)) && !looksWet(x, z);
    if (ok) plots.push({ id: `p${String(plots.length + 1).padStart(2, "0")}`, x, z });
  }
  writeFileSync(new URL("data.json", dir), JSON.stringify({ id: city.id, size: CITY_SIZE, grid: N, heights, buildings, plots }));
  console.log(`   ${buildings.length} buildings, ${water.length} water, ${plots.length} plots, relief ${Math.max(...heights).toFixed(0)} m, ground ${(ground.length / 1024).toFixed(0)} KB`);
}
