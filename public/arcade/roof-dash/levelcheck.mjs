// Level check for Roof Dash: a search bot plays every level twice (through the shortcut door, and the long way)
// and prints medal times. Run: node public/arcade/roof-dash/levelcheck.mjs [level numbers] [--write]
// --write saves the bot routes to routes.js (used by g.debug.autoplay) and the medal times into levels.js.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LEVELS } from "./levels.js";
import { build, newState, cloneState, step, T } from "./sim.js";

const HOLD = 4;
const ACTS = [];
for (const dir of [1, 0, -1]) for (const jump of [false, true]) for (const down of [false, true]) ACTS.push({ dir, jump, down });

function distField(W, open) {
  const n = W.cols * W.rows, d = new Int32Array(n).fill(-1);
  const blocked = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (W.grid[i] === 1) blocked[i] = 1;
  if (!open) for (const dr of W.doors) { blocked[dr.row * W.cols + dr.col] = 1; blocked[(dr.row + 1) * W.cols + dr.col] = 1; }
  const q = [(W.goal.row - 1) * W.cols + W.goal.col];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W.cols, y = (i / W.cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W.cols || ny >= W.rows) continue;
      const j = ny * W.cols + nx;
      if (blocked[j] || d[j] >= 0) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}

let far = 0;
export function solve(W, open, BEAM = 500, SPREAD = 200) {
  far = 0;
  const dist = distField(W, open);
  const score = (s) => {
    const p = s.p, cx = Math.floor((p.x + p.w / 2) / T), cy = Math.max(0, Math.min(W.rows - 1, Math.floor((p.y + p.h / 2) / T)));
    const d = dist[cy * W.cols + cx];
    return (d < 0 ? 1e6 : d * 30) - Math.abs(p.vx) * 0.02;
  };
  const s0 = newState(W);
  s0.noPads = !open;
  let beam = [{ s: s0, path: null, sc: 0 }];
  let bestSc = 1e9, bestGen = 0;
  for (let gen = 0; gen < 1100; gen++) {
    const seen = new Map();
    for (const node of beam) {
      for (let a = 0; a < ACTS.length; a++) {
        if (!node.s.started && a === 2) continue;
        const s = cloneState(node.s);
        let dead = false;
        for (let k = 0; k < HOLD && !dead && !s.done; k++) { step(W, s, ACTS[a]); if (s.dead) dead = true; }
        if (dead) continue;
        if (open && s.doors.includes(2)) continue;
        const path = { prev: node.path, a };
        if (s.done) {
          const acts = [];
          for (let n = path; n; n = n.prev) acts.push(n.a);
          return { time: s.time / 60, acts: acts.reverse(), doors: s.doors.slice() };
        }
        const p = s.p;
        const key = `${p.x >> 2},${p.y >> 2},${Math.round(p.vx / 70)},${Math.round(p.vy / 110)},${p.ground ? 1 : 0}${p.slide ? 1 : 0}${p.dive ? 1 : 0}${p.pj ? 1 : 0}${p.lock > 0 ? 1 : 0}${p.wallT > 0 ? p.wallDir + 2 : 0},${s.doors.join("")}`;
        if (!seen.has(key)) seen.set(key, { s, path, sc: score(s) });
      }
    }
    let all = [...seen.values()].sort((a, b) => a.sc - b.sc);
    for (const n of all) far = Math.max(far, n.s.p.x / T);
    if (!all.length) return null;
    if (all[0].sc < bestSc - 1) { bestSc = all[0].sc; bestGen = gen; } else if (gen - bestGen > 200) return null;
    if (all.length > BEAM + SPREAD) {
      const rest = all.slice(BEAM), stepN = rest.length / SPREAD;
      all = all.slice(0, BEAM);
      for (let i = 0; i < SPREAD; i++) all.push(rest[Math.floor(i * stepN)]);
    }
    beam = all;
  }
  return null;
}

export function replay(W, acts, ok) {
  const s = newState(W, ok);
  for (const a of acts) for (let k = 0; k < HOLD && !s.done; k++) step(W, s, ACTS[a]);
  return s;
}

const args = process.argv.slice(2);
const wAt = args.indexOf("--write");
const doWrite = wAt >= 0 ? !!args.splice(wAt, 1) : false;
// --json file: save this run's routes and medal times (for running a few checks side by side); --merge a.json b.json: write them all
const jAt = args.indexOf("--json");
const jsonFile = jAt >= 0 ? args.splice(jAt, 2)[1] : null;
const mAt = args.indexOf("--merge");
const mergeFiles = mAt >= 0 ? args.splice(mAt) .slice(1) : null;
const here = (f) => fileURLToPath(new URL(f, import.meta.url));
let ROUTES = {};
try { ROUTES = (await import("./routes.js")).ROUTES; } catch {}
const pars = {};
const want = args.map(Number).filter(Boolean);
const out = {};
let bad = 0;
const r1 = (v) => Math.round(v * 10) / 10;
if (mergeFiles) for (const f of mergeFiles) { const j = JSON.parse(readFileSync(f, "utf8")); Object.assign(out, j.out); Object.assign(pars, j.pars); }
LEVELS.forEach((def, i) => {
  if (mergeFiles) return;
  if (want.length && !want.includes(i + 1)) return;
  const t0 = Date.now();
  let W;
  try { W = build(def); } catch (e) { console.log(`${i + 1} ${def.n}: BUILD ERROR ${e.message}`); bad++; return; }
  const long = solve(W, false) || solve(W, false, 1600, 600);
  const short = W.doors.length ? solve(W, true) || solve(W, true, 1600, 600) : null;
  if (!long || (W.doors.length && !short)) { console.log(`${String(i + 1).padStart(2)} ${def.n}: NOT SOLVED ${long ? "" : "(long way) "}${W.doors.length && !short ? "(door way)" : ""} got to column ${Math.floor(far)} of ${W.cols}`); bad++; return; }
  let note = "";
  let gold, silver, bronze;
  if (short) {
    if (!short.doors.every((d) => d === 1)) note += " bot skipped a door";
    const wrong = replay(W, short.acts, W.doors.map(() => 0));
    if (!wrong.doors.includes(2)) note += " WRONG PAD DID NOT LOCK";
    const saved = long.time - short.time;
    note += ` door saves ${saved.toFixed(1)}s`;
    if (saved < 0.8) { note += " (TOO LITTLE)"; }
    gold = Math.min(short.time * 1.35 + 0.5, long.time);
    silver = long.time * 1.3 + 0.5; bronze = long.time * 1.9 + 2;
  } else { gold = long.time * 1.3 + 0.4; silver = long.time * 1.5 + 0.6; bronze = long.time * 2.1 + 2; }
  out[i + 1] = { long: long.acts.map((a) => a.toString(12)).join(""), short: short ? short.acts.map((a) => a.toString(12)).join("") : null, d: def.d };
  pars[i] = [r1(gold), r1(silver), r1(bronze)];
  console.log(`${String(i + 1).padStart(2)} ${def.n.padEnd(16)} cols ${String(W.cols).padStart(3)}  bot ${short ? short.time.toFixed(2) + " / " : ""}${long.time.toFixed(2)}s  par: [${r1(gold)}, ${r1(silver)}, ${r1(bronze)}]${note}  (${Date.now() - t0} ms)`);
});
if (jsonFile) writeFileSync(jsonFile, JSON.stringify({ out, pars }));
if (doWrite || mergeFiles) {
  const all = { ...ROUTES, ...out };
  writeFileSync(here("./routes.js"), "// Bot routes from levelcheck.mjs (one digit per 4 frames). Used by g.debug.autoplay. Do not edit by hand.\nexport const ROUTES = " + JSON.stringify(all, null, 0).replace(/("\d+":)/g, "\n$1") + ";\n");
  const lines = readFileSync(here("./levels.js"), "utf8").split("\n");
  let k = -1;
  for (let j = 0; j < lines.length; j++) if (/^\s*\{ n: /.test(lines[j])) { k++; if (pars[k]) lines[j] = lines[j].replace(/par: \[[^\]]*\]/, `par: [${pars[k].join(", ")}]`); }
  writeFileSync(here("./levels.js"), lines.join("\n"));
}
if (!mergeFiles) console.log(bad ? `${bad} level(s) FAILED` : "all levels solved");
process.exit(bad ? 1 : 0);
