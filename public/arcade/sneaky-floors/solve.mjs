// Proves every stage can be finished, with room to spare: a breadth-first scripted player searches the inputs, and a
// solution only counts if it ALSO wins with every jump pressed 3 frames late and 3 frames early (the slack rule).
// Run: node public/arcade/sneaky-floors/solve.mjs [stage indexes: 3,7 or 50-64]   (writes solutions.js; game.js can replay them)
//      node solve.mjs 0-21 --part /tmp/a.json   search a slice into a side file (run several at once)
//      node solve.mjs --merge /tmp/a.json /tmp/b.json   fold side files into solutions.js
import { writeFileSync, readFileSync } from "node:fs";
import { compile, newSim, clone, step, T } from "./sim.js";
import { STAGES, ROOMS } from "./stages.js";
import { SLACK, PAD, slackRun } from "./slack.mjs";
const ACTS = { r: [1, 0], R: [1, 1], n: [0, 0], N: [0, 1], l: [-1, 0], L: [-1, 1] }, NAMES = Object.keys(ACTS), MACRO = 5;
const argv = process.argv.slice(2);
const write = (out) => writeFileSync(new URL("./solutions.js", import.meta.url), "// Written by solve.mjs. One input script per stage: r/l/n = right/left/none, capital = jump held, 5 frames each.\n// Every script also wins with each jump 3 frames late and 3 frames early (slack.mjs checks it).\nexport const MACRO = 5;\nexport const SOLUTIONS = " + JSON.stringify(out, null, 0).replace(/\},/g, "},\n") + ";\n");
let prev = []; try { prev = (await import("./solutions.js")).SOLUTIONS; } catch {}
if (argv[0] === "--merge") {
  const out = STAGES.map((_, i) => prev[i] || null);
  for (const f of argv.slice(1)) for (const [i, r] of JSON.parse(readFileSync(f, "utf8"))) out[i] = r;
  write(out); console.log("merged,", out.filter(Boolean).length + "/" + STAGES.length, "solved"); process.exit(0);
}
const pi = argv.indexOf("--part"), part = pi >= 0 ? argv.splice(pi, 2)[1] : null;
const only = argv[0] ? argv[0].split(",").flatMap((v) => { const m = /^(\d+)-(\d+)$/.exec(v); if (!m) return [Number(v)]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; }) : null;

// A node carries three runs of the same inputs: on time, jumps late, jumps early (that one trails SLACK frames behind).
function solve(c, attempt, maxSec = 26, K = 48, wide = false) {
  let layer = [{ s: newSim(c, attempt), l: newSim(c, attempt), e: newSim(c, attempt), hd: [], hj: [], path: "" }];
  const seen = new Set(), timed = Math.max(0, ...c.traps.map((t) => t.on.t || 0));
  for (let L = 0; L < (maxSec * 60) / MACRO; L++) {
    const cells = new Map(), next = [];
    for (const node of layer) for (const a of NAMES) {
      const s = clone(node.s), l = clone(node.l), e = clone(node.e), [d, j] = ACTS[a];
      const hd = node.hd.slice(), hj = node.hj.slice();
      for (let i = 0; i < MACRO && !s.dead && !s.won; i++) {
        step(s, d, !!j);
        step(l, d, hj.length >= SLACK ? hj[hj.length - SLACK] : false);
        if (hd.length >= SLACK) step(e, hd[hd.length - SLACK], !!j);
        hd.push(d); hj.push(!!j); if (hd.length > SLACK) { hd.shift(); hj.shift(); }
      }
      if (s.dead || l.dead || e.dead) continue;
      if (s.won) { const path = node.path + a; if (slackRun(c, attempt, path, SLACK) && slackRun(c, attempt, path, -SLACK)) return path; continue; }
      const p = s.p;
      let dyn = "";
      for (const o of s.objs) if (o.mv || o.armed || o.seen) dyn += o.id + (o.mv ? (o.x >> 4) + "," + (o.y >> 4) : "");
      const cell = `${Math.floor(p.x / T)},${Math.floor(p.y / T)},${p.g},${s.ice},${s.fired.map((v) => (v >= 0 ? 1 : 0)).join("")},${s.rule ? s.rule.text : ""},${s.objs.map((o) => (o.hidden ? 0 : 1) + (o.n ?? "") + (o.shut ? "s" : "")).join("")}`;
      let fine = `${p.x >> 2},${p.y >> 2},${Math.round(p.vx / 80)},${Math.round(p.vy / 130)},${p.ground},${Math.ceil(s.mirror * 3)},${dyn},${s.pend.length}`;
      if (wide) fine += `,${l.p.x >> 3},${l.p.y >> 3},${e.p.x >> 3},${e.p.y >> 3}`;
      // two paths to the same spot: keep the one whose late and early runs stay closest to the on-time run
      const dv = Math.abs(l.p.x - p.x) + Math.abs(l.p.y - p.y) + Math.abs(e.p.x - p.x) + Math.abs(e.p.y - p.y);
      let set = cells.get(cell);
      if (!set) cells.set(cell, (set = new Map()));
      const had = set.get(fine);
      if (had != null) { if (had >= 0 && next[had].dv > dv) next[had] = { s, l, e, hd, hj, dv, path: node.path + a }; continue; }
      if (set.size >= K) continue;
      set.set(fine, -1);
      // a quiet world (nothing moving, nothing scheduled) does not depend on time: never revisit it
      if (!s.pend.length && !s.cam.mv && !s.mirror && !s.dark && s.t > timed && !s.objs.some((o) => o.mv || o.falling)) { const key = cell + "|" + fine + p.coy.toFixed(2); if (seen.has(key)) continue; seen.add(key); }
      set.set(fine, next.length);
      next.push({ s, l, e, hd, hj, dv, path: node.path + a });
    }
    layer = next;
    if (!layer.length) return null;
  }
  return null;
}
const out = [], parts = [], t0 = Date.now();
let fail = 0, total = 0;
STAGES.forEach((st, i) => {
  if (only && !only.includes(i)) { out.push(prev[i] || null); return; }
  const c = compile(st, ROOMS);
  let res = null, tr = 0;
  for (const [sec, K, wide] of [[14, 48, false], [14, 48, true], [12, 240, true], [26, 48, false]]) { for (tr = 0; tr < 3 && !res; tr++) res = solve(c, tr, sec, K, wide); if (res) break; }   // short searches first, then wider ones
  tr--;
  const name = `${Math.floor(i / 5) + 1}-${(i % 5) + 1}`;
  if (!res) { fail++; console.log(name, `(#${i})`, "NO SOLUTION"); out.push(null); parts.push([i, null]); return; }
  const sec = (res.length * MACRO) / 60; total += sec;
  console.log(name, "ok", sec.toFixed(1) + " s", tr ? `(attempt ${tr + 1})` : "", st.rule ? "[math]" : "");
  out.push({ try: tr, keys: res }); parts.push([i, { try: tr, keys: res }]);
  if (part) writeFileSync(part, JSON.stringify(parts));
});
console.log(`${parts.length - fail}/${parts.length} solved, ${total.toFixed(0)} s of play, ${((Date.now() - t0) / 1000).toFixed(0)} s to search`);
if (part) writeFileSync(part, JSON.stringify(parts)); else write(out);
process.exit(fail ? 1 : 0);
