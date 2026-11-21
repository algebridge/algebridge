// Builds levels.js. The swing is a real pendulum now (no pump), so height is the fuel: levels run downhill
// and pads and hoops put speed back in. Levels are built by flying them: a pilot (the autopilot in sim.js)
// plays what exists so far, and the next ring, pad, hoop or storm is placed on the path it actually flies.
// Then every release style (and every right-answer slot) plays the finished level, the finish gate is set
// where enough of them arrive, and coins are laid along the fastest run.
//   node public/arcade/swing-line/gen.mjs            writes levels.js and prints a report
//   node public/arcade/swing-line/gen.mjs --trace 4  prints the event trace of level 4
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { K, run, POLICIES, makeState, step, autoHold } from "./sim.js";

const TOTAL = 72, NP = POLICIES.length;
const START = { x: 110, y: 300 };
const P0 = { rel: 0.76, sq: 0 };
const NEVER = { rel: 9, never: true };
const rad = (d) => (d * Math.PI) / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Fly a level. Returns the per-step record, where the last free flight began, and how far it got. */
function trace(L, pol, slot = 0, maxT = 30) {
  const s = makeState(L, [slot]), rec = [];
  const rel = {};
  let cut = -1, cutEv = null, reach = -1e9;
  while ((s.mode === "ready" || s.mode === "play") && s.t < maxT) {
    step(s, autoHold(s, pol));
    for (const e of s.ev) {
      if (e.k === "release") { cut = rec.length; cutEv = { k: "release", a: e.a.i }; rel[e.a.i] = cut; }
      else if (e.k === "pad") { cut = rec.length; cutEv = { k: "pad", b: s.pads.indexOf(e.b) }; }
    }
    if (s.mode === "dead") break;
    rec.push({ x: s.p.x, y: s.p.y, vx: s.p.vx, vy: s.p.vy, rope: s.rope ? 1 : 0 });
    if (s.p.x > reach) reach = s.p.x;
  }
  return { s, rec, cut, cutEv, rel, reach };
}

/** One level under construction. Each piece returns false (and changes nothing) when it does not fly. */
function builder(seed, d, wide) {
  const r = rng(seed), R = (lo, hi) => lo + r() * (hi - lo), Ri = (lo, hi) => Math.round(R(lo, hi));
  const L = { start: { ...START }, anchors: [], pads: [], haz: [], hoops: [], coins: [], made: [], k: 0, finish: 1e9, fy: null };
  let lastKind = "ring";
  /** The pilot's free flight after the newest ring (or pad), or null if it never got there cleanly. */
  const tail = (slot = 0) => {
    const tr = trace(L, P0, slot);
    if (!tr.cutEv) return null;
    if (lastKind === "pad") { if (tr.cutEv.k !== "pad" || tr.cutEv.b !== L.pads.length - 1) return null; }
    else {
      const want = L.k ? L.anchors.findIndex((a) => a.cluster != null && a.slot === slot) : L.anchors.length - 1;
      if (L.k) { if (tr.rel[want] == null) return null; tr.cut = tr.rel[want]; }
      else if (tr.cutEv.k !== "release" || tr.cutEv.a !== want) return null;
    }
    const T = tr.rec.slice(tr.cut);
    if (T.length < 20 || T.some((q) => q.rope)) return null;
    T.tr = tr;
    return T;
  };
  const snap = () => JSON.stringify(L);
  const back = (j) => { const o = JSON.parse(j); for (const k of Object.keys(L)) delete L[k]; Object.assign(L, o); };
  const b = {
    L, R, Ri, r,
    first(dx, dy) { L.anchors.push({ x: START.x + dx, y: START.y - dy }); lastKind = "ring"; return !!tail(); },
    /** A ring up and ahead of where the pilot is at the moment it is falling at about `vy`. */
    hop(o = {}) {
      const T = tail();
      if (!T) return false;
      // slow after the last ring? fall further first: height is the only fuel
      const sp0 = Math.hypot(T[0].vx, T[0].vy), need = Math.max(0, 680 - sp0) * 0.9;
      const vyT = (o.vy ?? R(120, 400)) + need, len = o.len ?? R(200, 320);
      const j = T.findIndex((q, i) => i >= 6 && q.vy >= vyT);
      if (j < 0) { WHY.noJ = (WHY.noJ || 0) + 1; return false; }
      // the rope square to the flight keeps all the speed, so aim the ring there, give or take
      const Q = T[j], th = clamp(Math.atan2(Q.vy, Q.vx) + rad(o.th ?? R(-10, 10)), rad(14), rad(56));
      const ax = Math.round(Q.x + len * Math.sin(th)), ay = Math.round(Q.y - len * Math.cos(th));
      const prev = L.anchors[L.anchors.length - 1];
      if (ax < prev.x + 210 || L.anchors.some((a) => Math.hypot(a.x - Q.x, a.y - Q.y) < len + 30)) { WHY.near = (WHY.near || 0) + 1; return false; }
      const keep = snap(), was = lastKind;
      L.anchors.push(o.mv ? { x: ax, y: ay, mv: o.mv } : { x: ax, y: ay });
      lastKind = "ring";
      const T2 = tail();
      if (!T2 || T2[0].vx < 220 || Math.hypot(T2[0].vx, T2[0].vy) < 340 || T2[0].x < ax) { const w = !T2 ? 'noTail:' + JSON.stringify(trace(L, P0).cutEv) + trace(L, P0).s.ev.map((e) => e.why).join() : T2[0].x < ax ? 'behind' : 'slow'; WHY[w] = (WHY[w] || 0) + 1; back(keep); lastKind = was; return false; }
      return true;
    },
    mover() {
      const mv = r() < 0.3 + d * 0.3
        ? { ax: Ri(40, 70 + d * 30), per: +(2.8 - d * 0.6).toFixed(2), ph: +r().toFixed(2) }
        : { ay: Ri(30, 45 + d * 35), per: +(2.6 - d * 0.7).toFixed(2), ph: +r().toFixed(2) };
      return b.hop({ mv });
    },
    /** A pad where the pilot comes down, then a ring near the top of the bounce. */
    pad() {
      const T = tail();
      if (!T || lastKind === "pad") return false;
      const drop = R(170, 300), j = T.findIndex((q) => q.vy > 250 && q.y > T[0].y + drop);
      if (j < 0) return false;
      const keep = snap(), was = lastKind;
      L.pads.push({ x: Math.round(T[j].x + 20), y: Math.round(T[j].y + K.PR), w: Math.round(wide ? R(300, 330) : R(230, 250) - d * 70) });
      lastKind = "pad";
      if (!tail() || !b.hop({ vy: R(280, 640) })) { back(keep); lastKind = was; return false; }
      return true;
    },
    /** A hoop on the flight line, then a longer hop. */
    hoop() {
      const T = tail();
      if (!T) return false;
      const j = Ri(9, 16);
      if (j >= T.length - 6) return false;
      const keep = snap(), was = lastKind;
      L.hoops.push({ x: Math.round(T[j].x), y: Math.round(T[j].y) });
      if (!tail() || !b.hop({ vy: R(200, 420) })) { back(keep); lastKind = was; return false; }
      return true;
    },
    /** The free flight between the two newest rings. */
    lastFlight() {
      const tr = trace(L, P0, 0), rec = tr.rec;
      let e = tr.cut - 1;
      while (e > 0 && rec[e].rope) e--;
      let s0 = e;
      while (s0 > 0 && !rec[s0 - 1].rope) s0--;
      return e - s0 > 8 ? rec.slice(s0, e + 1) : null;
    },
    /** A hop with a storm tower standing under the flight. */
    tower() {
      const keep = snap(), was = lastKind;
      if (!b.hop({ vy: R(150, 380) })) return false;
      const F = b.lastFlight();
      if (F) {
        const m = F[F.length >> 1], low = Math.max(...F.map((q) => q.y));
        L.haz.push({ x: Math.round(m.x - 45), y: Math.round(low + K.PR + R(70, 110) - d * 25), w: 90, h: 700 });
        if (tail()) return true;
      }
      back(keep); lastKind = was; return false;
    },
    /** A hop under a storm ceiling: late, high releases get zapped. */
    ceil() {
      const keep = snap(), was = lastKind;
      if (!b.hop({ vy: R(120, 300), th: R(0, 12) })) return false;
      const F = b.lastFlight(), a = L.anchors[L.anchors.length - 1];
      if (F) {
        const top = Math.min(a.y, ...F.map((q) => q.y)) - K.PR - R(48, 80) + d * 16, x0 = Math.round(F[0].x - 60), x1 = Math.round(a.x + 190);
        L.haz.push({ x: x0, y: Math.round(top - 900), w: x1 - x0, h: 900 });
        if (tail()) return true;
      }
      back(keep); lastKind = was; return false;
    },
    /** k number rings in a row over a long pad: bounce along and hook the one with the answer. Always the last piece. */
    math(k) {
      const T = tail();
      if (!T) return false;
      const th = rad(R(26, 42)), len = R(210, 280), gap = Ri(180, 200), keep = snap(), was = lastKind;
      const j = T.findIndex((q, i) => i >= 8 && q.vy >= R(60, 300));
      if (j < 0) return false;
      const Q = T[j], ax = Math.round(Q.x + len * Math.sin(th)), ay = Math.round(Q.y - len * Math.cos(th));
      if (L.anchors.some((a) => Math.hypot(a.x - Q.x, a.y - Q.y) < len + 30)) return false;
      for (let n = 0; n < k; n++) L.anchors.push({ x: ax + n * gap, y: ay, cluster: 0, slot: n });
      L.pads.push({ x: Math.round(ax + ((k - 1) * gap) / 2 + 30), y: ay + Ri(330, 360), w: (k - 1) * gap + Ri(440, 500) });
      L.k = k; lastKind = "ring";
      let ok = true;
      for (let sl = 0; ok && sl < k; sl++) ok = !!tail(sl);
      if (!ok) { back(keep); lastKind = was; return false; }
      return true;
    },
    /** Put the gate where at least `need` release styles arrive (all of them when need = NP). */
    finish(need, o = {}) {
      const slots = Math.max(1, L.k);
      const reach = (pol) => { let m = 1e9; for (let sl = 0; sl < slots; sl++) m = Math.min(m, trace(L, pol, sl).reach); return m; };
      const all = POLICIES.map(reach).sort((x, y) => y - x);
      let want = 1e9, fy = 0;
      for (let sl = 0; sl < slots; sl++) {
        const T = tail(sl);
        if (!T) return false;
        const pad = L.k ? L.pads[L.pads.length - 1] : null;
        const x = pad ? pad.x + pad.w / 2 + R(110, 200) : T[0].x + R(250, 340);
        if (x < want) { want = x; const q = T.find((p) => p.x >= x) || T[T.length - 1]; fy = q.y; }
      }
      let f = Math.min(want, all[need - 1] - 40);
      if (o.holdWins) f = Math.min(f, trace(L, NEVER, 0, 6).reach - 14);
      const lastX = Math.max(...L.anchors.map((a) => a.x));
      if (f < lastX + (o.holdWins ? 100 : 150)) return false;
      L.finish = Math.round(f); L.fy = Math.round(fy + 150);
      return true;
    },
  };
  return b;
}

// ---------- recipes ----------
// The teaching curve: one new idea per level. Each entry lists the pieces after the first ring.
const TEACH = [
  { p: [], need: NP, hold: true, strict: true, tip: "hold" },                                   // 1 one hook: holding alone gets there
  { p: ["hop"], need: NP },                                                       // 2 two hooks
  { p: ["hop", "hop"], need: NP },                                                // 3 three hooks
  { p: ["pad", "hop"], need: 8, strict: true, wide: true, tip: "Bounce off the pad" },                      // 4
  { p: ["hop", "hoop"], need: 8, strict: true, tip: "Hoops add speed" },                        // 5
  { p: ["hop", "pad", "hoop"], need: 7, strict: true, wide: true },                                         // 6
  { p: ["hop", "hop"], need: 7, strict: true, k: 2, tip: "Swing to the ring with the answer" }, // 7 first numbers
  { p: ["hop", "tower", "hop"], need: 7, strict: true, tip: "Fly over the storm" },             // 8
  { p: ["hop", "mover", "mover"], need: 7, strict: true, tip: "Some rings move" },              // 9
  { p: ["hop", "pad"], need: 7, strict: true, k: 3, wide: true },                                           // 10 three numbers
  { p: ["hop", "ceil", "hop"], need: 7, strict: true, tip: "Stay low. Let go early" },          // 11
  { p: ["pad", "mover", "hoop", "tower"], need: 6, strict: true },                              // 12 everything so far
];
function recipe(i, d, r) {
  const bag = ["hop", "hop", "hoop", "pad", "mover"];
  if (d > 0.1) bag.push("tower", "mover");
  if (d > 0.2) bag.push("ceil", "hoop");
  if (d > 0.45) bag.push("tower", "ceil", "pad");
  const n = 4 + Math.round(d * 5) + Math.floor(r() * 3), p = [];
  for (let j = 0; j < n; j++) {
    let t = bag[Math.floor(r() * bag.length)];
    if (t === p[j - 1] && t !== "hop") t = "hop";
    p.push(t);
  }
  const withMath = i % 3 === 0; // 1-based levels 13, 16, 19 ...
  return { p, need: d < 0.3 ? 7 : d < 0.65 ? 5 : 4, k: withMath ? (d < 0.2 ? 2 : r() < 0.5 + d * 0.3 ? 3 : 2) : 0 };
}

const FAILS = {}, WHY = {};
function construct(seed, d, rc) {
  const b = builder(seed, d, !!rc.wide), L = b.L;
  if (!b.first(rc.hold ? 220 : b.Ri(200, 240), rc.hold ? 60 : b.Ri(20, 70))) return null;
  for (const t of rc.p) {
    let ok = false, as = t;
    for (let n = 0; n < 8 && !ok; n++) ok = b[t]();
    // a piece that will not fly here becomes a plain hop (teaching levels must have their piece)
    if (!ok) { FAILS[t] = (FAILS[t] || 0) + 1; if (rc.strict) return null; as = "hop"; for (let n = 0; n < 12 && !ok; n++) ok = b.hop(); }
    if (!ok) { FAILS.stuck = (FAILS.stuck || 0) + 1; return null; }
    L.made.push(as);
  }
  if (rc.k) { let ok = false; for (let n = 0; n < 12 && !ok; n++) ok = b.math(rc.k); if (!ok) { FAILS.math = (FAILS.math || 0) + 1; return null; } }
  if (!b.finish(rc.need, { holdWins: rc.hold })) { FAILS.finish = (FAILS.finish || 0) + 1; return null; }
  if (rc.tip) L.tip = rc.tip;
  return L;
}

// ---------- verification ----------
function verify(L) {
  let passes = 99, best = null, novice = 99;
  const ok = [];
  for (let slot = 0; slot < Math.max(1, L.k); slot++) {
    let n = 0, nv = 0;
    POLICIES.forEach((pol, pi) => {
      const s = run(L, pol, [slot]);
      if (s.mode === "done") { n++; if (slot === 0) ok.push(pi); if (!best || s.t < best.t) best = { t: s.t, pol, slot }; }
      if (L.k && run(L, { ...pol, grabWrong: true }, [slot]).mode === "done") nv++;
    });
    passes = Math.min(passes, n); novice = Math.min(novice, L.k ? nv : n);
  }
  return { passes, novice, best, ok };
}
/** A sloppy player: a new random release angle and hook timing on every swing. Share of tries that clear. */
function sloppy(L, tries = 60) {
  const r = rng(77);
  let won = 0;
  for (let n = 0; n < tries; n++) {
    const s = makeState(L, [n % Math.max(1, L.k)]);
    let hooks = -1, pol = null;
    while ((s.mode === "ready" || s.mode === "play") && s.t < 25) {
      if (s.hooks !== hooks) { hooks = s.hooks; pol = { rel: 0.3 + r() * 0.95, sq: -0.45 + r() * 0.85 }; }
      step(s, autoHold(s, pol));
    }
    if (s.mode === "done") won++;
  }
  return won / tries;
}
/** Lay coins along the fastest run, and note the release angle the dotted guide should show. */
function bake(L) {
  let v = verify(L);
  if (!v.best) return null;
  const rec = [];
  run(L, v.best.pol, [v.best.slot], rec);
  let lx = -1e9, ly = 0;
  L.coins = [];
  for (const q of rec) {
    if (q[2] || q[0] < START.x + 150 || q[0] > L.finish - 50 || Math.hypot(q[0] - lx, q[1] - ly) < 80) continue;
    if (L.hoops.some((h) => Math.hypot(h.x - q[0], h.y - q[1]) < 70) || L.anchors.some((a) => Math.hypot(a.x - q[0], a.y - q[1]) < 60)) continue;
    L.coins.push({ x: q[0], y: q[1] }); lx = q[0]; ly = q[1];
  }
  v = verify(L);
  if (!v.best) return null;
  // the guide shows the middle of the release angles that work with an early hook
  const early = v.ok.filter((pi) => POLICIES[pi].sq < 0).map((pi) => POLICIES[pi].rel);
  L.guide = early.length ? early[(early.length - 1) >> 1] : v.best.pol.rel;
  v.sloppy = sloppy(L);
  return v;
}

const args = process.argv.slice(2);
const out = [], report = [];
for (let i = 0; i < TOTAL && !(args.includes("--hand") && i >= TEACH.length); i++) {
  const teach = i < TEACH.length, d = teach ? 0 : (i - TEACH.length) / (TOTAL - TEACH.length - 1);
  let done = false;
  for (let t = 0; t < 600 && !done; t++) {
    const seed = 1000 + i * 977 + t * 7919;
    const rc = teach ? TEACH[i] : recipe(i, d, rng(seed ^ 0x5bd1e995));
    const L = construct(seed, d, rc);
    if (!L) continue;
    const v = bake(L);
    if (!v || v.passes < rc.need || v.best.t > 13) continue;
    if (L.k && v.novice < 3) continue;
    if (i < 3 && v.sloppy < 0.9) continue;
    if (teach && i >= 3 && v.sloppy < (i >= 11 ? 0.2 : 0.3)) continue;
    if (!teach && (v.best.t < 3 || v.sloppy < (d < 0.3 ? 0.2 : 0.1))) continue;
    if (!teach && v.sloppy > 0.85) continue; // not a walk in the park either
    if (!teach) L.d = +d.toFixed(2);
    const drop = Math.max(...L.anchors.map((a) => a.y)) - START.y;
    report.push(`L${i + 1}${teach ? " teach" : " d" + d.toFixed(2)} try ${t} [${L.made.join(" ")}${rc.k ? " math" + rc.k : ""}] passes ${v.passes}/${NP} novice ${v.novice} sloppy ${Math.round(v.sloppy * 100)}% best ${v.best.t.toFixed(1)}s rings ${L.anchors.length} drop ${drop} finish ${L.finish} coins ${L.coins.length}`);
    out.push(L); done = true;
  }
  if (!done) { report.push(`L${i + 1} FAILED TO GENERATE`); out.push(null); process.exitCode = 1; }
}
const ti = args.indexOf("--trace");
if (ti >= 0) {
  const L = out[+args[ti + 1] - 1], pol = POLICIES[+(args[ti + 2] ?? 4)], s = makeState(L, [+(args[ti + 3] ?? 0)]);
  console.log(JSON.stringify(pol), JSON.stringify(L.anchors), JSON.stringify(L.pads), L.finish);
  while ((s.mode === "ready" || s.mode === "play") && s.t < 20) { step(s, autoHold(s, pol)); for (const e of s.ev) if (e.k !== "coin") console.log(s.t.toFixed(2), e.k, e.a ? "#" + e.a.i : "", Math.round(s.p.x), Math.round(s.p.y), "v", Math.round(s.p.vx), Math.round(s.p.vy)); }
  console.log(s.mode, s.t.toFixed(2), Math.round(s.p.x), Math.round(s.p.y));
  for (const pol of POLICIES) console.log(JSON.stringify(pol), [0, 1, 2].slice(0, Math.max(1, L.k)).map((sl) => { const q = run(L, pol, [sl]); return q.mode === "done" ? q.t.toFixed(1) : "x" + Math.round(q.p.x); }).join(" "));
} else console.log(report.join("\n"));
if (args.includes("--why")) console.log("pieces that did not fly:", JSON.stringify(FAILS), JSON.stringify(WHY));

if (!args.includes("--dry") && !out.includes(null) && out.length === TOTAL) {
  const pack = (L) => {
    const o = { a: L.anchors.map((a) => { const q = [a.x, a.y]; if (a.cluster != null) q.push("n", a.slot); else if (a.mv) q.push("m", a.mv.ax || 0, a.mv.ay || 0, a.mv.per, a.mv.ph || 0); return q; }), f: L.finish, y: L.fy, g: L.guide };
    if (L.pads.length) o.p = L.pads.map((p) => [p.x, p.y, p.w]);
    if (L.haz.length) o.h = L.haz.map((h) => [h.x, h.y, h.w, h.h]);
    if (L.hoops.length) o.o = L.hoops.map((h) => [h.x, h.y]);
    o.c = L.coins.flatMap((c) => [c.x, c.y]);
    if (L.k) o.k = L.k;
    if (L.tip) o.tip = L.tip;
    if (L.d != null) o.d = L.d;
    return JSON.stringify(o);
  };
  const src = `// GENERATED by gen.mjs. Do not edit by hand: change gen.mjs and run it again.
// ${out.length} levels. The first ${TEACH.length} follow the teaching recipes, the rest come from seeded random recipes.
// Every one was cleared by the autopilot (several release styles, every right-answer slot) before it was written.
const RAW = [
${out.map(pack).join(",\n")},
];
export const LEVELS = RAW.map((o) => ({
  start: { x: ${START.x}, y: ${START.y} }, finish: o.f, fy: o.y, guide: o.g, k: o.k || 0, tip: o.tip || "", d: o.d ?? 0,
  anchors: o.a.map((q) => q[2] === "n" ? { x: q[0], y: q[1], cluster: 0, slot: q[3] } : q[2] === "m" ? { x: q[0], y: q[1], mv: { ax: q[3], ay: q[4], per: q[5], ph: q[6] } } : { x: q[0], y: q[1] }),
  pads: (o.p || []).map((q) => ({ x: q[0], y: q[1], w: q[2] })),
  haz: (o.h || []).map((q) => ({ x: q[0], y: q[1], w: q[2], h: q[3] })),
  hoops: (o.o || []).map((q) => ({ x: q[0], y: q[1] })),
  coins: Array.from({ length: o.c.length / 2 }, (_, i) => ({ x: o.c[i * 2], y: o.c[i * 2 + 1] })),
}));
`;
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "levels.js"), src);
}
