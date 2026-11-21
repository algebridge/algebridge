// Roof Dash world: builds a level from its course string and steps it. Pure logic (no DOM), used by the game and by levelcheck.mjs.
import { makeCfg, newPlayer, stepPlayer, EV } from "./plat.js";

export const T = 30;
export const CFG = makeCfg({ slide: true, dive: true, wall: true });
export const ZEV = { SPRING: 256, PAD_OK: 512, PAD_BAD: 1024, FLAG: 2048, GOAL: 4096, DIE: 8192, RESPAWN: 16384, RESET: 32768, BOOST: 65536, CRACK: 131072, CRUMBLE: 262144 };
export { EV };
export const DEAD_FRAMES = 18;      // 0.3 s from death to control
export const CRUMBLE_FRAMES = 22;   // a touched tile holds this long
export const BOOST_V = CFG.run * 1.6;

/*
 Course language. A course is a strip that runs to the right. Tokens, separated by spaces:
   r8    run: 8 tiles of roof             g4    gap: 4 tiles of pit
   u2    roof steps up 2                  d3    roof steps down 3
   s3    3 roof tiles with spikes         lo5   low gap 5 long (slide through)
   c6    the next 6 tiles get a spiked ceiling (keep jumps short)
   wj6   wall-jump shaft, climbs 6        sp5   spring, then the roof is 5 higher
   mp9   pit 9 wide with a moving platform    lt6  lift that climbs 6
   cr6   pit 6 wide bridged by crumbling tiles    b3   3 roof tiles with boost arrows
   F     checkpoint flag                  E     exit portal
   {Down to slide}   a hint painted in the level (4 words at most)
   D[ ... ]   shortcut door. Answer pads come first, then the tokens inside the brackets are the normal
              route (it must start by climbing 5 or more with wj or sp). The door tunnel runs under it.
*/
export function build(def) {
  const toks = def.d.match(/\{[^}]*\}|D\[|\]|[a-zA-Z]+[\d.]*/g) || [];
  const cols = [];           // { top } per column (null = pit)
  const extra = [];          // [col, r0, r1] more solid
  const spikes = [];         // [col, row, dir] dir 1 = on the roof, -1 = on the ceiling
  const springs = [], flags = [], signs = [], movers = [], pads = [], doors = [], tunnels = [], crumbs = [], boosts = [];
  let fy = 0, ceilN = 0, ceilRow = 0, goal = null, door = null;
  const push = (top) => {
    const x = cols.length;
    cols.push({ top });
    if (ceilN > 0) { ceilN--; extra.push([x, ceilRow - 2, ceilRow - 1]); spikes.push([x, ceilRow, -1]); }
    return x;
  };
  const run = (n) => { for (let i = 0; i < n; i++) push(fy); };
  for (const tk of toks) {
    if (tk[0] === "{") { signs.push({ col: Math.max(1, cols.length - 4), row: fy, text: tk.slice(1, -1) }); continue; }
    if (tk === "D[") {
      door = { fb: fy, i: doors.length, c0: cols.length };
      run(3);
      for (let k = 0; k < 3; k++) { const x = push(fy); pads.push({ col: x, row: fy, door: door.i, k }); run(4); }
      door.after = cols.length;
      continue;
    }
    if (tk === "]") {
      const fb = door.fb;
      let c0 = door.after;
      while (c0 < cols.length && !(cols[c0].top != null && cols[c0].top <= fb - 5)) c0++;
      if (c0 >= cols.length) throw new Error(`${def.n}: the route inside D[ ] must climb 5 or more`);
      for (let c = door.after; c < c0; c++) if (cols[c].top !== fb) throw new Error(`${def.n}: the route inside D[ ] must start with wj or sp`);
      for (let c = c0; c < cols.length; c++) if (cols[c].top != null && cols[c].top > fb - 5) throw new Error(`${def.n}: the route inside D[ ] dips into the door tunnel at column ${c}`);
      tunnels.push({ c0, c1: cols.length, fb });
      doors.push({ col: c0, row: fb - 2, zone: door.c0 });
      fy = fb; door = null;
      continue;
    }
    const m = /^([a-zA-Z]+)([\d.]*)$/.exec(tk);
    const op = m[1], n = Number(m[2] || 0);
    if (op === "r") run(n);
    else if (op === "g") { for (let i = 0; i < n; i++) push(null); }
    else if (op === "u") fy -= n;
    else if (op === "d") fy += n;
    else if (op === "s") { for (let i = 0; i < n; i++) spikes.push([push(fy), fy - 1, 1]); }
    else if (op === "lo") { for (let i = 0; i < n; i++) extra.push([push(fy), fy - 9, fy - 2]); }
    else if (op === "c") { ceilN = n; ceilRow = fy - 4; }
    else if (op === "wj") { extra.push([push(fy), fy - n - 2, fy - 3]); run(3); fy -= n; }
    else if (op === "sp") { springs.push({ col: push(fy), row: fy, n }); run(1); fy -= n; }
    else if (op === "mp") { const x = cols.length; for (let i = 0; i < n; i++) push(null); movers.push({ x0: x * T, y0: fy * T, x1: (x + n - 3) * T, y1: fy * T }); }
    else if (op === "lt") { const x = cols.length; for (let i = 0; i < 3; i++) push(null); movers.push({ x0: x * T, y0: fy * T, x1: x * T, y1: (fy - n) * T }); fy -= n; }
    else if (op === "cr") { for (let i = 0; i < n; i++) crumbs.push({ col: push(null), row: fy }); }
    else if (op === "b") { for (let i = 0; i < n; i++) boosts.push({ col: push(fy), row: fy }); }
    else if (op === "F") flags.push({ col: push(fy), row: fy });
    else if (op === "E") { run(2); goal = { col: push(fy), row: fy }; run(3); extra.push([push(fy), fy - 14, fy]); }
    else throw new Error(`${def.n}: unknown token ${tk}`);
  }
  if (!goal) throw new Error(`${def.n}: no E`);
  extra.push([0, cols[0].top - 14, cols[0].top]);

  // rows: shift so the highest thing has headroom
  let lo = 0, hi = 0;
  for (const c of cols) if (c.top != null) { lo = Math.min(lo, c.top); hi = Math.max(hi, c.top); }
  for (const e of extra) lo = Math.min(lo, e[1]);
  const off = 9 - lo, rows = hi + off + 5, nc = cols.length;
  const grid = new Uint8Array(nc * rows);
  const set = (c, r, v) => { if (r >= 0 && r < rows && c >= 0 && c < nc) grid[r * nc + c] = v; };
  cols.forEach((c, x) => { if (c.top != null) for (let r = c.top + off; r < rows; r++) set(x, r, 1); });
  for (const [c, r0, r1] of extra) for (let r = r0; r <= r1; r++) set(c, r + off, 1);
  for (const t of tunnels) for (let c = t.c0; c < t.c1; c++) {
    for (let r = t.fb - 3 + off; r < rows; r++) set(c, r, 1);
    set(c, t.fb - 1 + off, 0); set(c, t.fb - 2 + off, 0);
    if (cols[c].top == null && !crumbs.some((k) => k.col === c)) spikes.push([c, t.fb - 4, 1]);
  }
  for (const [c, r, d] of spikes) set(c, r + off, d > 0 ? 2 : 3);
  const kill = new Float32Array(nc);
  for (let x = 0; x < nc; x++) {
    let m = -1e9;
    for (let k = Math.max(0, x - 10); k <= Math.min(nc - 1, x + 10); k++) {
      if (cols[k].top != null) m = Math.max(m, cols[k].top);
      for (const t of tunnels) if (k >= t.c0 && k < t.c1) m = Math.max(m, t.fb);
    }
    for (const k of crumbs) if (Math.abs(k.col - x) <= 10) m = Math.max(m, k.row);
    for (const mv of movers) if (Math.abs(mv.x0 / T - x) <= 14) m = Math.max(m, mv.y0 / T);
    kill[x] = (m + off + 4) * T;
  }
  const fix = (o) => ({ ...o, row: o.row + off });
  const boostRow = new Int16Array(nc).fill(-1);
  for (const b of boosts) boostRow[b.col] = b.row + off;
  const W = {
    T, cols: nc, rows, grid, kill, def, boostRow,
    start: { x: 2 * T + 5, y: (cols[2].top + off) * T - CFG.h },
    springs: springs.map(fix).map((s) => ({ ...s, v: Math.sqrt(2 * CFG.grav * (s.n + 1.7) * T) })),
    flags: flags.map(fix), signs: signs.map(fix), goal: fix(goal),
    pads: pads.map(fix).map((p) => ({ ...p, cx: p.col * T + T / 2, cy: p.row * T - 72 })),
    doors: doors.map(fix), crumbs: crumbs.map(fix), boosts: boosts.map(fix),
    movers: movers.map((m) => ({ x0: m.x0, y0: m.y0 + off * T, x1: m.x1, y1: m.y1 + off * T, per: Math.max(2.2, 2 * Math.hypot(m.x1 - m.x0, m.y1 - m.y0) / 105) })),
    boxes: [],
  };
  for (const m of W.movers) W.boxes.push({ x: m.x0, y: m.y0, w: 3 * T, h: 16, px: m.x0, py: m.y0, off: false });
  for (const d of W.doors) W.boxes.push({ x: d.col * T + 4, y: d.row * T, w: T - 8, h: 2 * T, px: d.col * T + 4, py: d.row * T, off: false, door: true });
  W.crBase = W.boxes.length;
  for (const k of W.crumbs) W.boxes.push({ x: k.col * T, y: k.row * T, w: T, h: 14, px: k.col * T, py: k.row * T, off: false, crumb: true });
  return W;
}

/** ok: for each door, which pad (0..2) is the right one. */
export function newState(W, ok) {
  return {
    p: newPlayer(W.start.x, W.start.y, CFG), time: 0, started: false, dead: 0, cp: -1,
    doors: W.doors.map(() => 0), ok: ok || W.doors.map(() => 1), cr: W.crumbs.map(() => 0),
    done: false, deaths: 0, ev: 0, noPads: false, hit: null, fell: -1,
  };
}
export function cloneState(s) {
  return { p: { ...s.p }, time: s.time, started: s.started, dead: s.dead, cp: s.cp, doors: s.doors.slice(), ok: s.ok, cr: s.cr.slice(), done: s.done, deaths: s.deaths, ev: 0, noPads: s.noPads, hit: null, fell: -1 };
}
export function moverPos(m, frames, out) {
  const k = 0.5 - 0.5 * Math.cos((frames / 60) * 2 * Math.PI / m.per);
  out.x = m.x0 + (m.x1 - m.x0) * k; out.y = m.y0 + (m.y1 - m.y0) * k;
}
const tmp = { x: 0, y: 0 };
export function syncBoxes(W, s) {
  const nm = W.movers.length;
  for (let i = 0; i < nm; i++) {
    const b = W.boxes[i];
    moverPos(W.movers[i], Math.max(0, s.time - 1), tmp); b.px = tmp.x; b.py = tmp.y;
    moverPos(W.movers[i], s.time, tmp); b.x = tmp.x; b.y = tmp.y;
  }
  for (let i = 0; i < W.doors.length; i++) W.boxes[nm + i].off = s.doors[i] === 1;
  for (let i = 0; i < s.cr.length; i++) W.boxes[W.crBase + i].off = s.cr[i] < 0;
}
const over = (p, x, y, w, h) => p.x < x + w && p.x + p.w > x && p.y < y + h && p.y + p.h > y;

/** Back to the last flag. With no flag yet the whole attempt starts over: clock, doors and all. */
export function respawn(W, s) {
  const f = s.cp >= 0 ? W.flags[s.cp] : null;
  s.p = newPlayer(f ? f.col * T + 5 : W.start.x, f ? f.row * T - CFG.h : W.start.y, CFG);
  s.dead = 0;
  for (let i = 0; i < s.cr.length; i++) s.cr[i] = 0;
  s.ev |= ZEV.RESPAWN;
  if (!f) { s.time = 0; s.started = false; for (let i = 0; i < s.doors.length; i++) s.doors[i] = 0; s.ev |= ZEV.RESET; }
}

export function step(W, s, inp) {
  s.ev = 0;
  if (s.done) return;
  if (s.dead > 0) {
    s.dead++; s.time++;
    if (s.dead > DEAD_FRAMES) respawn(W, s);
    return;
  }
  if (!s.started) { if (inp.dir || inp.jump || inp.down) s.started = true; else { syncBoxes(W, s); stepPlayer(W, s.p, inp, CFG, 1 / 60); return; } }
  s.time++;
  syncBoxes(W, s);
  const p = s.p;
  stepPlayer(W, p, inp, CFG, 1 / 60);
  s.ev |= p.ev;
  // springs
  for (const sp of W.springs) {
    if (p.vy >= 0 && over(p, sp.col * T + 2, sp.row * T - 10, T - 4, 12)) {
      p.vy = -sp.v; p.rising = false; p.dive = false; p.ground = false; p.coy = 0; s.ev |= ZEV.SPRING;
      if (p.slide) { p.y -= CFG.h - p.h; p.h = CFG.h; p.slide = false; }
    }
  }
  // boost arrows and crumbling tiles under the feet
  if (p.ground) {
    const feet = p.y + p.h, c = Math.max(0, Math.min(W.cols - 1, Math.floor((p.x + p.w / 2) / T)));
    if (W.boostRow[c] >= 0 && Math.abs(W.boostRow[c] * T - feet) < 1) {
      if (p.vx < BOOST_V - 60) s.ev |= ZEV.BOOST;
      if (p.vx < BOOST_V) p.vx = BOOST_V;
      p.face = 1;
    }
    for (let i = 0; i < s.cr.length; i++) {
      if (s.cr[i] !== 0) continue;
      const b = W.boxes[W.crBase + i];
      if (Math.abs(b.y - feet) < 1 && p.x < b.x + b.w && p.x + p.w > b.x) { s.cr[i] = 1; s.ev |= ZEV.CRACK; }
    }
  }
  for (let i = 0; i < s.cr.length; i++) if (s.cr[i] > 0 && ++s.cr[i] > CRUMBLE_FRAMES) { s.cr[i] = -1; s.ev |= ZEV.CRUMBLE; s.fell = i; }
  // spikes
  let die = p.crush || p.y > W.kill[Math.max(0, Math.min(W.cols - 1, Math.floor((p.x + p.w / 2) / T)))];
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.001) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.001) / T);
  for (let ty = y0; ty <= y1 && !die; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || tx >= W.cols || ty < 0 || ty >= W.rows) continue;
    const v = W.grid[ty * W.cols + tx];
    if (v === 2 && over(p, tx * T + 6, ty * T + 13, T - 12, T - 13)) die = true;
    else if (v === 3 && over(p, tx * T + 6, ty * T, T - 12, T - 13)) die = true;
  }
  if (die) { s.dead = 1; s.deaths++; s.ev |= ZEV.DIE; return; }
  // answer pads
  if (!s.noPads) for (const pad of W.pads) {
    if (s.doors[pad.door] !== 0) continue;
    if (over(p, pad.cx - 15, pad.cy - 15, 30, 30)) {
      if (pad.k === s.ok[pad.door]) { s.doors[pad.door] = 1; s.ev |= ZEV.PAD_OK; }
      else { s.doors[pad.door] = 2; s.ev |= ZEV.PAD_BAD; }
      s.hit = pad;
    }
  }
  // flags and the exit
  for (let i = s.cp + 1; i < W.flags.length; i++) {
    const f = W.flags[i];
    if (over(p, f.col * T, (f.row - 3) * T, T, 3 * T)) { s.cp = i; s.ev |= ZEV.FLAG; }
  }
  if (over(p, W.goal.col * T - 4, (W.goal.row - 4) * T, T + 8, 4 * T)) { s.done = true; s.ev |= ZEV.GOAL; }
}
