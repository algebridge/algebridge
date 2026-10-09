// Renders the Bridgey House shop pictures ahead of time, so the shop does no 3D work.
// Run with the dev server up: node scripts/house-pictures.mjs [http://localhost:3215]
// Writes public/house/pictures/*.webp and src/data/house-pictures.ts. Re-run after changing a model.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3215";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "public/house/pictures");
mkdirSync(outDir, { recursive: true });
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 90);
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "pics-"))}`, "--no-first-run", "--enable-gpu", "--use-angle=metal", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v;
for (let i = 0; i < 60 && !v; i++) {
  try {
    v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}, s) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params, sessionId: s })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, s);
// Pictures at twice the size they show, for sharp screens.
await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 2, mobile: false }, s);
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }, s)).result?.result?.value;
await send("Page.navigate", { url: `${BASE}/demo/pictures` }, s);
for (let i = 0; i < 240 && !(await ev("!!window.__picturesReady")); i++) await sleep(500);
const ids = await ev("window.__pictureIds");
const only = process.env.ONLY; // e.g. ONLY=porch to redo just those
const jobs = [...ids.pieces.map((x) => ["piece", x]), ...ids.ornaments.map((x) => ["ornament", x]), ...ids.rooms.map((x) => ["room", x]), ...ids.porches.map((x) => ["porch", x])].filter(([k]) => !only || k === only);
const done = { piece: [], ornament: [], room: [], porch: [] };
const hash = createHash("sha1");
for (const [kind, x] of jobs) {
  const data = await ev(`window.__shoot(${JSON.stringify(kind)}, ${JSON.stringify(x)})`);
  if (!data?.startsWith("data:image/")) {
    console.log("skipped", kind, x);
    continue;
  }
  const buf = Buffer.from(data.split(",")[1], "base64");
  hash.update(buf);
  const file = kind === "piece" ? `${x}.webp` : kind === "ornament" ? `ornament-${x}.webp` : kind === "porch" ? `porch-${x}.jpg` : `room-${x}.webp`;
  writeFileSync(path.join(outDir, file), buf);
  // The porch picture is shown big but only for a moment: 1280 wide, plain JPEG quality (macOS sips).
  if (kind === "porch") spawnSync("sips", ["-Z", "1280", "-s", "formatOptions", "72", path.join(outDir, file), "--out", path.join(outDir, file)]);
  done[kind].push(x);
  process.stdout.write(".");
}
const version = hash.digest("hex").slice(0, 10);
// A partial run (ONLY=...) leaves the list of pictures as it was.
if (!only) writeFileSync(
  path.join(root, "src/data/house-pictures.ts"),
  `/** Made by scripts/house-pictures.mjs: the pieces with a picture rendered ahead of time in public/house/pictures. */\n` +
    `export const PICTURES_VERSION = ${JSON.stringify(version)};\n` +
    `export const PIECE_PICTURES = new Set<string>(${JSON.stringify(done.piece)});\n` +
    `export const ORNAMENT_PICTURES = new Set<string>(${JSON.stringify(done.ornament)});\n` +
    `export const ROOM_PICTURES = new Set<string>(${JSON.stringify(done.room)});\n` +
    `/** The porch view's first picture in each house style, shown until the 3D view has drawn. */\n` +
    `export const PORCH_PICTURES = new Set<string>(${JSON.stringify(done.porch)});\n`
);
// A partial run still changes pictures: a new version, so browsers fetch them again instead of keeping the old ones.
if (only) {
  const file = path.join(root, "src/data/house-pictures.ts");
  const old = readFileSync(file, "utf8");
  const bumped = createHash("sha1").update(old).update(version).digest("hex").slice(0, 10);
  writeFileSync(file, old.replace(/PICTURES_VERSION = "[0-9a-f]+"/, `PICTURES_VERSION = "${bumped}"`));
}
console.log(`\n${done.piece.length} pieces, ${done.ornament.length} ornaments, ${done.room.length} rooms, ${done.porch.length} porches; version ${version}`);
ws.close();
proc.kill();
