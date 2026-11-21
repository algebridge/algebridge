// Roll On: level builder and physics. No DOM and no randomness in here, so Node can run a scripted player through every level.
// Level coordinates are tiles: x to the right, y UP from the bottom. One tile = T pixels. The sim runs in pixels, y down.

export const T = 40, R = 17, HT = 30, DT = 1 / 60;
export const BOT = HT * T + 240;
const G = 1900, JUMP = 700, MAXV = 310, ACC = 1000, AIR = 720, ROLLF = 240, BRAKE = 2000, SPRING = 1040, VMAX = 1250;
const BK = 80;
export const SAWA = 0.3, CRATE = 19, BOULDER = 24, BOSS = 52, EW = 19;
const PX = (x) => x * T, PY = (y) => (HT - y) * T;

/** Level builder. Terrain calls lay ground from a cursor; item calls place things on the piece just laid (x is local to that piece). */
export class Builder {
  constructor(y = 6) {
    this.x = 0; this.y = y; this.px = 0; this.py = y; this.runs = []; this.cur = null;
    this.it = { stars: [], enemies: [], spikes: [], bodies: [], springs: [], cps: [], rects: [], movers: [], saws: [], buttons: [], gates: [], signs: [], targets: [], boss: null, goal: null, math: 0 };
  }
  _pt(x, y) { if (!this.cur) { this.cur = []; this.runs.push(this.cur); } this.cur.push([x, y]); }
  _piece() { this.px = this.x; this.py = this.y; if (!this.cur) this._pt(this.x, this.y); }
  flat(n) { this._piece(); this.x += n; this._pt(this.x, this.y); return this; }
  slope(n, dh) { this._piece(); this.x += n; this.y += dh; this._pt(this.x, this.y); return this; }
  hill(n, h) { this._piece(); const hm = (0.5 * n) / Math.PI; if (Math.abs(h) > hm) h = Math.sign(h) * hm; const k = Math.ceil(n * 2); for (let i = 1; i <= k; i++) { const u = i / k; this._pt(this.px + n * u, this.py + (h * (1 - Math.cos(2 * Math.PI * u))) / 2); } this.x += n; return this; }
  ramp(n, dh) { this._piece(); n = Math.max(n, Math.ceil((Math.PI * Math.abs(dh)) / 1.1)); const k = Math.ceil(n * 2); for (let i = 1; i <= k; i++) { const u = i / k; this._pt(this.px + n * u, this.py + (dh * (1 - Math.cos(Math.PI * u))) / 2); } this.x += n; this.y += dh; return this; }
  up(h) { this._piece(); this.y += h; this._pt(this.x, this.y); if (h > 3.2) this.it.targets.push({ type: "way", x: this.x + 0.8, y: this.y }); return this; }
  down(h) { return this.up(-h); }
  gap(n, dh = 0) { this.cur = null; this.px = this.x; this.py = this.y; this.x += n; this.y += dh; return this; }
  /** A crate-sized hole with a hold button at the bottom. */
  notch(id) { const t = this.it.targets[this.it.targets.length - 1]; if (t && t.type === "push" && t.x == null) t.x = this.x + 0.3; this.down(1); this.flat(1.3); this.button(0.65, id, "hold"); this.up(1); return this; }
  // ----- items (x local to the last piece; ground items sit on the ground at that x) -----
  stars(x, n, step = 1, dy = 1) { for (let i = 0; i < n; i++) this.it.stars.push({ x: this.px + x + i * step, g: dy, py: this.py }); return this; }
  arc(x, n, w, h, dy = 1) { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0.5; this.it.stars.push({ x: this.px + x + w * u, y: this.py + dy + h * 4 * u * (1 - u) }); } return this; }
  col(x, n, dy = 2, step = 1) { for (let i = 0; i < n; i++) this.it.stars.push({ x: this.px + x, y: this.py + dy + i * step }); return this; }
  /** A pit of w tiles with an arc of stars over it. */
  hop(w, dh = 0) { this.arc(this.x - this.px - 1, 5, w + 2, 1.5); return this.gap(w, dh); }
  star(x, dy) { this.it.stars.push({ x: this.px + x, y: this.py + dy }); return this; }
  enemy(x, range = 2, o = {}) { this.it.enemies.push({ x: this.px + x, py: this.py, range, spiky: 0, sp: o.sp || 55, ph: o.ph || 0, dy: o.dy }); return this; }
  spiky(x, range = 2, o = {}) { this.it.enemies.push({ x: this.px + x, py: this.py, range, spiky: 1, sp: o.sp || 50, ph: o.ph || 0, dy: o.dy }); return this; }
  spikes(x, w) { this.it.spikes.push({ x: this.px + x, py: this.py, w }); return this; }
  /** to: the local x the crate must be pushed to (a hint for the scripted player). */
  crate(x, to, dy) { this.it.bodies.push({ x: this.px + x, py: this.py, dy, kind: "crate" }); if (to != null) this.it.targets.push({ type: "push", body: this.it.bodies.length - 1, x: to === true ? null : this.px + to, x0: this.px + x }); return this; }
  boulder(x, dy) { this.it.bodies.push({ x: this.px + x, py: this.py, dy, kind: "boulder" }); return this; }
  spring(x, pow = 1) { this.it.springs.push({ x: this.px + x, py: this.py, pow }); return this; }
  cp(x) { this.it.cps.push({ x: this.px + x, py: this.py }); return this; }
  block(x, dy, w, h = 1, kind = "dirt") { this.it.rects.push({ x: this.px + x, y: this.py + dy + h, w, h, kind }); return this; }
  bridge(x, dy, w) { this.it.rects.push({ x: this.px + x, y: this.py + dy, w, h: 0.4, kind: "wood" }); return this; }
  lift(x, dy, w, mx, my, period = 4, phase = 0) { this.it.movers.push({ type: "lift", x: this.px + x, y: this.py + dy, w, mx, my, period, phase }); return this; }
  swing(x, dy, len, w = 3, amp = 0.9, period = 3.6, phase = 0) { this.it.movers.push({ type: "swing", x: this.px + x, y: this.py + dy, len, w, amp, period, phase }); return this; }
  seesaw(x, dy = 1, w = 6) { this.it.saws.push({ x: this.px + x, y: this.py + dy, w }); return this; }
  button(x, id, mode = "latch", dy) { this.it.buttons.push({ x: this.px + x, py: this.py, id, mode, dy }); if (mode === "latch") this.it.targets.push({ type: "gate", id }); return this; }
  gate(x, id, h = 4) { this.it.gates.push({ x: this.px + x, py: this.py, id, h, math: -1 }); return this; }
  math(x, n = 3) {
    const k = this.it.math++, id = "m" + k;
    for (let i = 0; i < n; i++) this.it.buttons.push({ x: this.px + x - 3.5 * (n - i) - 0.5, py: this.py, id, mode: "num", slot: i });
    this.it.gates.push({ x: this.px + x, py: this.py, id, h: 4, math: k, n });
    this.it.targets.push({ type: "gate", id });
    return this;
  }
  boss(x0, x1, kind = 1) {
    this.it.boss = { x0: this.px + x0, x1: this.px + x1, py: this.py, kind };
    this.it.gates.push({ x: this.px + x1 + 1.2, py: this.py, id: "boss", h: 4, math: -1 });
    this.it.targets.push({ type: "boss" });
    return this;
  }
  way(x, dy = 0) { this.it.targets.push({ type: "way", x: this.px + x, y: this.py + dy }); return this; }
  goal(x) { this.it.goal = { x: this.px + x, py: this.py }; return this; }
  sign(x, text, dy = 2.7) { this.it.signs.push({ x: this.px + x, py: this.py, dy, text }); return this; }

  gy(x, fallback) {
    let best = null;
    for (const r of this.runs) for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      if (b[0] > a[0] && x >= a[0] - 1e-6 && x <= b[0] + 1e-6) { const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); if (best == null || y > best) best = y; }
    }
    return best == null ? fallback : best;
  }
  finish(name, theme = 0) {
    const it = this.it, gy = (o) => (o.dy != null ? o.py + o.dy : this.gy(o.x, o.py));
    const L = { name, theme, W: this.x * T, runs: this.runs.map((r) => r.map(([x, y]) => [PX(x), PY(y)])), segs: [], buckets: new Map() };
    const seg = (a, b, c, d) => {
      const i = L.segs.length; L.segs.push([a, b, c, d]);
      for (let k = Math.floor((Math.min(a, c) - 30) / BK); k <= Math.floor((Math.max(a, c) + 30) / BK); k++) { let l = L.buckets.get(k); if (!l) L.buckets.set(k, (l = [])); l.push(i); }
    };
    for (const r of L.runs) {
      seg(r[0][0], BOT, r[0][0], r[0][1]);
      for (let i = 1; i < r.length; i++) seg(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]);
      const e = r[r.length - 1]; seg(e[0], e[1], e[0], BOT);
    }
    seg(0, -4000, 0, BOT); seg(L.W, -4000, L.W, BOT);
    L.rects = it.rects.map((r) => ({ x: PX(r.x), y: PY(r.y), w: r.w * T, h: r.h * T, kind: r.kind }));
    L.stars = it.stars.map((o) => ({ x: PX(o.x), y: PY(o.y != null ? o.y : this.gy(o.x, o.py) + o.g) }));
    L.enemies = it.enemies.map((o) => ({ x: PX(o.x), y: PY(gy(o)), range: o.range * T, spiky: o.spiky, sp: o.sp, ph: o.ph }));
    L.spikes = it.spikes.map((o) => ({ x: PX(o.x), y: PY(gy(o)), w: o.w * T }));
    L.bodies = it.bodies.map((o) => { const r = o.kind === "crate" ? CRATE : BOULDER; return { x: PX(o.x), y: PY(gy(o)) - r - 0.5, kind: o.kind, r, m: o.kind === "crate" ? 1.2 : 2.4 }; });
    L.springs = it.springs.map((o) => ({ x: PX(o.x), y: PY(gy(o)), pow: o.pow }));
    L.cps = it.cps.map((o) => ({ x: PX(o.x), y: PY(gy(o)) })).sort((a, b) => a.x - b.x);
    L.movers = it.movers.map((o) => o.type === "lift"
      ? { type: "lift", x: PX(o.x), y: PY(o.y), w: o.w * T, h: 16, mx: o.mx * T, my: -o.my * T, period: o.period, phase: o.phase }
      : { type: "swing", px: PX(o.x), py: PY(o.y), len: o.len * T, w: o.w * T, h: 16, amp: o.amp, period: o.period, phase: o.phase });
    L.seesaws = it.saws.map((o) => ({ x: PX(o.x), y: PY(o.y), hl: (o.w * T) / 2 }));
    L.gates = it.gates.map((o) => ({ x: PX(o.x) - 16, y: PY(gy(o) + o.h), w: 32, h: o.h * T, id: o.id, math: o.math, n: o.n || 0, text: "" }));
    for (const gt of L.gates) L.rects.push({ x: gt.x - 6, y: gt.y - 12 * T, w: gt.w + 12, h: 12 * T, kind: "tower" });
    for (const r of L.rects) { seg(r.x, r.y, r.x + r.w, r.y); seg(r.x + r.w, r.y, r.x + r.w, r.y + r.h); seg(r.x + r.w, r.y + r.h, r.x, r.y + r.h); seg(r.x, r.y + r.h, r.x, r.y); }
    L.buttons = it.buttons.map((o) => ({ x: PX(o.x), y: PY(gy(o)), mode: o.mode, gate: L.gates.findIndex((q) => q.id === o.id), slot: o.slot || 0, val: "", right: o.mode !== "num" }));
    L.signs = it.signs.map((o) => { const y = this.gy(o.x, o.py); return { x: PX(o.x), y: PY(y + o.dy), gy: PY(y), text: o.text }; });
    L.boss = it.boss ? { x0: PX(it.boss.x0), x1: PX(it.boss.x1), y: PY(it.boss.py), kind: it.boss.kind, gate: L.gates.findIndex((q) => q.id === "boss") } : null;
    L.goal = { x: PX(it.goal.x), y: PY(gy(it.goal)) };
    L.start = { x: PX(2), y: PY(this.gy(2, 6)) - R - 1 };
    L.targets = it.targets.map((o) => (o.type === "gate" ? { type: "gate", gate: L.gates.findIndex((q) => q.id === o.id) } : o.type === "way" ? { type: "way", x: PX(o.x), y: PY(o.y) } : o.type === "push" ? { type: "push", body: o.body, x: PX(o.x), x0: PX(o.x0) } : { type: "boss" }));
    // Targets in the order a player meets them, then the goal.
    const tx = (q) => (q.type === "gate" ? L.gates[q.gate].x : q.type === "boss" ? L.boss.x0 : q.type === "push" ? q.x0 : q.x);
    L.targets.sort((a, b) => tx(a) - tx(b));
    L.targets.push({ type: "goal" });
    L.nmath = it.math;
    return L;
  }
}

/** problems[k] = { text, vals: [..], right: index } for math gate k. */
export function setProblems(L, problems) {
  for (const gt of L.gates) if (gt.math >= 0) {
    const p = problems[gt.math]; gt.text = p.text;
    for (const b of L.buttons) if (L.gates[b.gate] === gt) { b.val = String(p.vals[b.slot]); b.right = b.slot === p.right; }
  }
}

export function newState(L) {
  return {
    t: 0,
    b: { x: L.start.x, y: L.start.y, vx: 0, vy: 0, ang: 0, gr: 0, coy: 0, jbuf: 0, jh: 0, jmp: 0, inv: 0, on: -1, nx: 0, ny: -1, face: 1 },
    hearts: 3, cp: -1, got: L.stars.map(() => 0), nstar: 0, ea: L.enemies.map(() => 0),
    bodies: L.bodies.map((d) => ({ x: d.x, y: d.y, vx: 0, vy: 0, ang: 0, gr: 0, dead: 0 })),
    btn: L.buttons.map(() => ({ p: 0, lock: 0 })), gate: L.gates.map(() => ({ open: 0, k: 0, h: 0 })),
    saw: L.seesaws.map(() => ({ a: -SAWA, w: 0, ld: 0 })),
    boss: L.boss ? { x: L.boss.x1 - 130, y: L.boss.y, vx: 0, vy: 0, hp: 3, mode: "idle", tm: 0, dir: -1, inv: 0, turn: 0, spk: 0, on: 0 } : null,
    ti: 0, done: 0, fail: 0, wrong: 0, hurt: 0, stomps: 0, ev: [], q: 0, _ny: 0, _on: -1, _imp: 0,
  };
}
export function clone(s) { const ev = s.ev; s.ev = []; const c = JSON.parse(JSON.stringify(s)); s.ev = ev; c.q = 1; return c; }

const tri = (u) => { u -= Math.floor(u); return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; };
export function enemyX(e, t) { return e.range ? e.x + e.range * tri((t * e.sp) / (4 * e.range) + e.ph) : e.x; }
export function enemyDir(e, t) { if (!e.range) return -1; let u = (t * e.sp) / (4 * e.range) + e.ph; u -= Math.floor(u); return u < 0.5 ? 1 : -1; }
/** Top-left corner of a mover at time t. */
export function moverPos(m, t, o) {
  if (m.type === "lift") { const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / m.period + m.phase)); o.x = m.x + m.mx * k; o.y = m.y + m.my * k; }
  else { const a = m.amp * Math.sin(2 * Math.PI * (t / m.period + m.phase)); o.a = a; o.x = m.px + m.len * Math.sin(a) - m.w / 2; o.y = m.py + m.len * Math.cos(a); }
  return o;
}
/** 1 = spikes out (do not land on it), 0.5 = about to come out, 0 = safe. */
export function bossSpiked(L, s) { return L.boss && L.boss.kind === 3 && s.boss.on ? (s.boss.spk >= 3.4 ? 1 : s.boss.spk >= 2.7 ? 0.5 : 0) : 0; }
/** Where a player should head next: o.x, and o.y when the height matters (else null). */
export function target(L, s, o) {
  const q = L.targets[Math.min(s.ti, L.targets.length - 1)]; o.y = null; o.bonus = 0;
  if (q.type === "push") { const c = s.bodies[q.body]; o.x = c.x - 34; o.bonus = 3 * (c.x - q.x); return o; }
  if (q.type === "way") { o.x = q.x; o.y = q.y; }
  else if (q.type === "boss") o.x = s.boss.on ? s.boss.x : L.boss.x0 + 120;
  else if (q.type === "gate") { o.x = L.gates[q.gate].x; for (const b of L.buttons) if (b.gate === q.gate && b.right) { o.x = b.x; o.y = b.y; break; } }
  else o.x = L.goal.x;
  return o;
}

const C = { nx: 0, ny: 0, d: 0 }, P0 = { x: 0, y: 0 }, P1 = { x: 0, y: 0 };
function cSeg(cx, cy, r, q) {
  const dx = q[2] - q[0], dy = q[3] - q[1], l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - q[0]) * dx + (cy - q[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = cx - (q[0] + dx * t), ey = cy - (q[1] + dy * t), d2 = ex * ex + ey * ey;
  if (d2 >= r * r || d2 < 1e-9) return false;
  const d = Math.sqrt(d2); C.nx = ex / d; C.ny = ey / d; C.d = r - d; return true;
}
function cBox(cx, cy, r, x, y, w, h) {
  const qx = cx < x ? x : cx > x + w ? x + w : cx, qy = cy < y ? y : cy > y + h ? y + h : cy;
  const ex = cx - qx, ey = cy - qy, d2 = ex * ex + ey * ey;
  if (d2 >= r * r) return false;
  if (d2 < 1e-9) { // center inside: leave by the nearest side
    const l = cx - x, rr = x + w - cx, u = cy - y, dn = y + h - cy, m = Math.min(l, rr, u, dn);
    if (m === u) { C.nx = 0; C.ny = -1; C.d = u + r; } else if (m === l) { C.nx = -1; C.ny = 0; C.d = l + r; } else if (m === rr) { C.nx = 1; C.ny = 0; C.d = rr + r; } else { C.nx = 0; C.ny = 1; C.d = dn + r; }
    return true;
  }
  const d = Math.sqrt(d2); C.nx = ex / d; C.ny = ey / d; C.d = r - d; return true;
}
function ev(s, a, x, y, v) { if (!s.q) s.ev.push([a, x, y, v]); }

function touch(s, b, svx, svy, bounce) {
  b.x += C.nx * C.d; b.y += C.ny * C.d;
  const vn = (b.vx - svx) * C.nx + (b.vy - svy) * C.ny;
  if (vn < 0) {
    const e = bounce && vn < -380 ? 0.24 : 0;
    b.vx -= (1 + e) * vn * C.nx; b.vy -= (1 + e) * vn * C.ny;
    if (-vn > s._imp) s._imp = -vn;
  }
  if (C.ny < -0.55) { b.gr = 1; if (C.ny < s._ny) { s._ny = C.ny; b.nx = C.nx; b.ny = C.ny; } return true; }
  return false;
}
function ballWorld(L, s, b, t, pushBodies) {
  const k0 = Math.floor(b.x / BK);
  for (let k = k0 - 1; k <= k0 + 1; k++) { const l = L.buckets.get(k); if (l) for (let i = 0; i < l.length; i++) if (cSeg(b.x, b.y, R, L.segs[l[i]])) touch(s, b, 0, 0, 1); }
  for (let i = 0; i < L.movers.length; i++) {
    const m = L.movers[i]; moverPos(m, t, P0);
    if (b.x < P0.x - 40 || b.x > P0.x + m.w + 40 || b.y < P0.y - 40 || b.y > P0.y + 60) continue;
    if (cBox(b.x, b.y, R, P0.x, P0.y, m.w, m.h)) {
      moverPos(m, t + DT, P1); const svx = (P1.x - P0.x) / DT, svy = (P1.y - P0.y) / DT;
      if (b.on === i) { if (touch(s, b, 0, 0, 0)) s._on = i; }
      else if (touch(s, b, svx, svy, 0)) { s._on = i; b.vx -= svx; b.vy = 0; b.on = i; }
    }
  }
  for (let i = 0; i < L.gates.length; i++) {
    const gt = L.gates[i], k = s.gate[i].k; if (k >= 0.98 || Math.abs(b.x - gt.x - 16) > 60) continue;
    if (cBox(b.x, b.y, R, gt.x, gt.y + gt.h * k, gt.w, gt.h * (1 - k))) touch(s, b, 0, 0, 1);
  }
  for (let i = 0; i < L.seesaws.length; i++) {
    const d = L.seesaws[i], o = s.saw[i]; if (Math.abs(b.x - d.x) > d.hl + 30 || Math.abs(b.y - d.y) > d.hl) continue;
    const ca = Math.cos(o.a), sa = Math.sin(o.a), rx = b.x - d.x, ry = b.y - d.y, lx = rx * ca + ry * sa, ly = -rx * sa + ry * ca;
    if (cBox(lx, ly, R, -d.hl, 0, d.hl * 2, 12)) {
      const nx = C.nx * ca - C.ny * sa, ny = C.nx * sa + C.ny * ca; if (C.ny < -0.5) o.ld = lx / d.hl;
      C.nx = nx; C.ny = ny; touch(s, b, -o.w * ry, o.w * rx, 0);
    }
  }
  for (let i = 0; i < L.bodies.length; i++) {
    const d = L.bodies[i], o = s.bodies[i]; if (o.dead > 0) continue;
    const dx = b.x - o.x, dy = b.y - o.y; if (dx > 60 || dx < -60 || dy > 60 || dy < -60) continue;
    let hit;
    if (d.kind === "crate") hit = cBox(b.x, b.y, R, o.x - CRATE, o.y - CRATE, CRATE * 2, CRATE * 2);
    else { const d2 = dx * dx + dy * dy, rr = R + d.r; hit = d2 < rr * rr && d2 > 1e-6; if (hit) { const q = Math.sqrt(d2); C.nx = dx / q; C.ny = dy / q; C.d = rr - q; } }
    if (!hit) continue;
    if (!pushBodies || C.ny < -0.62 || (d.kind === "crate" && Math.abs(C.nx) < 0.6)) { touch(s, b, o.vx, C.ny < -0.62 ? 0 : o.vy, 0); continue; }
    // push it: the body gives way, both share the speed along the push
    const nx = C.nx, m = d.m;
    o.x -= nx * C.d; if (d.kind !== "crate") b.y += C.ny * C.d * 0.5;
    const rel = (b.vx - o.vx) * nx;
    if (rel < 0) { b.vx -= (rel * nx * m) / (1 + m); o.vx += (rel * nx) / (1 + m); }
  }
}
function hurt(L, s, dirx, pit) {
  const b = s.b; if (!pit && b.inv > 0) return;
  s.hearts--; s.hurt++; ev(s, pit ? "fall" : "hurt", b.x, b.y);
  if (s.hearts <= 0) { s.fail = 1; return; }
  if (pit) respawn(L, s);
  else { b.inv = 1.5; b.vx = dirx * 290; b.vy = -440; b.gr = 0; b.on = -1; b.coy = 0; b.jmp = 0; }
}
export function respawn(L, s) {
  const b = s.b, c = s.cp >= 0 ? L.cps[s.cp] : null, x = c ? c.x : L.start.x;
  b.x = x; b.y = (c ? c.y : L.start.y + R + 1) - R - 1; b.vx = b.vy = 0; b.gr = 0; b.on = -1; b.coy = 0; b.jbuf = 0; b.jmp = 0; b.inv = 1.2;
  for (let i = 0; i < L.bodies.length; i++) if (L.bodies[i].x > x || s.bodies[i].dead > 0) { const d = L.bodies[i], o = s.bodies[i]; o.x = d.x; o.y = d.y; o.vx = o.vy = 0; o.dead = 0; }
  if (s.boss && s.boss.mode !== "dead") { const o = s.boss; o.x = L.boss.x1 - 130; o.y = L.boss.y; o.mode = "idle"; o.on = 0; o.vx = o.vy = 0; o.tm = 0; o.spk = 0; }
  ev(s, "respawn", b.x, b.y);
}

function ballStep(L, s, dir, t, h) {
  const b = s.b;
  if (b.on >= 0) { const m = L.movers[b.on]; moverPos(m, t, P0); moverPos(m, t + h, P1); b.x += P1.x - P0.x; b.y += P1.y - P0.y; }
  if (b.gr) {
    const tx = -b.ny, ty = b.nx; let vt = b.vx * tx + b.vy * ty; const vn = b.vx * b.nx + b.vy * b.ny;
    if (dir) { if (vt * dir < 0) vt += dir * BRAKE * h; else if (vt * dir < MAXV) vt += dir * ACC * h; }
    else { const f = ROLLF * h; vt = Math.abs(vt) <= f ? 0 : vt - Math.sign(vt) * f; }
    const over = Math.abs(vt) - MAXV; if (over > 0) vt -= Math.sign(vt) * over * 2.5 * h; // a slope boost fades
    b.vx = vt * tx + vn * b.nx; b.vy = vt * ty + vn * b.ny;
    b.ang += (vt / R) * h;
  } else {
    if (dir && b.vx * dir < MAXV) b.vx += dir * (b.vx * dir < 0 ? AIR * 1.7 : AIR) * h;
    b.ang += (b.vx / R) * h * 0.7;
  }
  b.vy += G * h;
  const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
  b.x += b.vx * h; b.y += b.vy * h;
  const was = b.gr; b.gr = 0; s._ny = 0; s._on = -1; s._imp = 0;
  ballWorld(L, s, b, t + h, true); ballWorld(L, s, b, t + h, true);
  if (b.on >= 0 && s._on !== b.on) { const m = L.movers[b.on]; moverPos(m, t, P0); moverPos(m, t + h, P1); b.vx += (P1.x - P0.x) / h; b.on = -1; }
  if (b.gr) {
    if (!was && b.coy <= 0 && s._imp > 150) ev(s, "land", b.x, b.y + R, s._imp);
    b.coy = 0.1; if (b.vy >= -1) b.jmp = 0;
  } else { b.nx = 0; b.ny = -1; }
  if (b.jbuf > 0 && b.coy > 0) {
    if (b.on >= 0) { const m = L.movers[b.on]; moverPos(m, t, P0); moverPos(m, t + h, P1); b.vx += (P1.x - P0.x) / h; }
    b.vy = -JUMP; b.jmp = 1; b.coy = 0; b.jbuf = 0; b.gr = 0; b.on = -1; ev(s, "jump", b.x, b.y + R);
  }
}

function bodyTouch(o) {
  o.x += C.nx * C.d; o.y += C.ny * C.d;
  const vn = o.vx * C.nx + o.vy * C.ny; if (vn < 0) { o.vx -= vn * C.nx; o.vy -= vn * C.ny; }
  if (C.ny < -0.55) o.gr = 1;
}
function bodiesStep(L, s) {
  for (let i = 0; i < L.bodies.length; i++) {
    const d = L.bodies[i], o = s.bodies[i];
    if (o.dead > 0) { o.dead -= DT; if (o.dead <= 0) { o.x = d.x; o.y = d.y; o.vx = o.vy = 0; o.dead = 0; ev(s, "poof", o.x, o.y); } continue; }
    o.vy += G * DT; if (o.vy > 1100) o.vy = 1100; if (o.vx > 700) o.vx = 700; if (o.vx < -700) o.vx = -700;
    o.x += o.vx * DT; o.y += o.vy * DT; o.gr = 0;
    const k0 = Math.floor(o.x / BK);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = k0 - 1; k <= k0 + 1; k++) { const l = L.buckets.get(k); if (l) for (let j = 0; j < l.length; j++) if (cSeg(o.x, o.y, d.r, L.segs[l[j]])) bodyTouch(o); }
      for (let j = 0; j < L.gates.length; j++) { const gt = L.gates[j], k = s.gate[j].k; if (k < 0.98 && Math.abs(o.x - gt.x - 16) < 70 && cBox(o.x, o.y, d.r, gt.x, gt.y + gt.h * k, gt.w, gt.h * (1 - k))) bodyTouch(o); }
    }
    if (o.gr) { if (d.kind === "crate") { o.vx *= 1 - 5 * DT; if (Math.abs(o.vx) < 5) o.vx = 0; } else o.vx *= 1 - 0.25 * DT; }
    if (d.kind === "boulder") o.ang += (o.vx / d.r) * DT;
    if (o.y > BOT - 150) o.dead = 1.2;
    // boulders flatten blocks
    if (d.kind === "boulder" && Math.abs(o.vx) > 70) for (let j = 0; j < L.enemies.length; j++) if (!s.ea[j]) {
      const e = L.enemies[j], ex = enemyX(e, s.t);
      if (Math.abs(o.x - ex) < d.r + EW && o.y > e.y - 2 * EW - d.r && o.y < e.y + d.r) { s.ea[j] = s.t + 0.001; ev(s, "squash", ex, e.y - EW, 1); }
    }
  }
  for (let i = 0; i < L.bodies.length; i++) for (let j = i + 1; j < L.bodies.length; j++) {
    const a = s.bodies[i], c = s.bodies[j]; if (a.dead > 0 || c.dead > 0) continue;
    const dx = c.x - a.x, dy = c.y - a.y, rr = L.bodies[i].r + L.bodies[j].r; if (Math.abs(dx) >= rr || Math.abs(dy) >= rr) continue;
    const d2 = dx * dx + dy * dy; if (d2 >= rr * rr || d2 < 1e-6) continue;
    const q = Math.sqrt(d2), p = (rr - q) / 2, nx = dx / q; a.x -= nx * p; c.x += nx * p; const v = (a.vx + c.vx) / 2; a.vx = v; c.vx = v;
  }
}

function bossStep(L, s) {
  const d = L.boss, o = s.boss, b = s.b;
  if (o.mode === "dead") { o.tm += DT; return; }
  if (!o.on) { if (b.x > d.x0 + 60) { o.on = 1; o.mode = "walk"; o.tm = 0; o.dir = -1; ev(s, "bossOn", o.x, o.y); } return; }
  const sp = [0, 150, 115, 85][o.hp] * (d.kind === 1 ? 0.85 : 1), lo = d.x0 + BOSS + 20, hi = d.x1 - BOSS - 50;
  if (o.inv > 0) o.inv -= DT;
  o.tm += DT;
  if (d.kind === 3) { o.spk += DT; if (o.spk >= 5.2) o.spk = 0; }
  if (o.mode === "walk") {
    const want = b.x > o.x ? 1 : -1;
    if (want !== o.dir) { o.turn += DT; if (o.turn > 0.45) { o.dir = want; o.turn = 0; } } else o.turn = 0;
    o.x += o.dir * sp * DT;
    if (o.x < lo) { o.x = lo; o.dir = 1; } if (o.x > hi) { o.x = hi; o.dir = -1; }
    if (d.kind >= 2 && o.tm > 2.8) { o.mode = "crouch"; o.tm = 0; }
  } else if (o.mode === "crouch") {
    if (o.tm > 0.45) { o.mode = "hop"; o.vy = -780; const air = (2 * 780) / G; o.vx = Math.max(-300, Math.min(300, (b.x - o.x) / air)); ev(s, "bossHop", o.x, o.y); }
  } else if (o.mode === "hop") {
    o.vy += G * DT; o.x += o.vx * DT; o.y += o.vy * DT;
    if (o.x < lo) o.x = lo; if (o.x > hi) o.x = hi;
    if (o.y >= d.y) { o.y = d.y; o.mode = "land"; o.tm = 0; ev(s, "bossLand", o.x, o.y); }
  } else if (o.mode === "land") { if (o.tm > 0.4) { o.mode = "walk"; o.tm = 0; }
  } else if (o.mode === "stun") { if (o.tm > 0.7) { o.mode = "walk"; o.tm = 0; } }
  if (!cBox(b.x, b.y, R, o.x - BOSS, o.y - BOSS * 2, BOSS * 2, BOSS * 2)) return;
  const away = b.x > o.x ? 1 : -1, spiked = bossSpiked(L, s) === 1;
  if (C.ny < -0.5 && b.vy >= o.vy - 20) {
    b.y += C.ny * C.d; b.x += C.nx * C.d;
    if (spiked) { const was = b.inv; hurt(L, s, away, false); if (was > 0) { b.vy = -420; b.vx = away * 200; } return; }
    b.vy = -690; b.vx += away * 90; b.jmp = 0; b.gr = 0; b.coy = 0;
    if (o.inv <= 0) {
      o.hp--; o.inv = 1.3; s.stomps++; if (o.mode !== "hop") { o.mode = "stun"; o.tm = 0; }
      ev(s, "bossHit", o.x, o.y - BOSS * 2, o.hp);
      if (o.hp <= 0) { o.mode = "dead"; o.tm = 0; o.y = d.y; s.gate[d.gate].open = 1; ev(s, "bossDead", o.x, o.y - BOSS); }
    } else ev(s, "bounce", b.x, b.y + R);
    return;
  }
  b.x += C.nx * C.d; b.y += C.ny * C.d;
  if (o.inv <= 0 && o.mode !== "stun") hurt(L, s, away, false);
  else if (C.nx * b.vx < 0) b.vx = 0;
}

/** One 1/60 s tick. dir is -1, 0 or 1; jump is whether the jump key is held. */
export function step(L, s, dir, jump) {
  if (s.done || s.fail) return;
  const b = s.b;
  if (jump && !b.jh) b.jbuf = 0.13;
  if (!jump && b.jh && b.jmp && b.vy < -JUMP * 0.45) { b.vy *= 0.5; b.jmp = 0; }
  b.jh = jump ? 1 : 0;
  if (dir) b.face = dir;
  for (let i = 0; i < s.saw.length; i++) s.saw[i].ld = 0;
  ballStep(L, s, dir, s.t, DT / 2);
  ballStep(L, s, dir, s.t + DT / 2, DT / 2);
  if (L.bodies.length) { bodiesStep(L, s); const g0 = b.gr; ballWorld(L, s, b, s.t + DT, false); b.gr = g0 || b.gr; }
  s.t += DT;
  if (b.coy > 0 && !b.gr) b.coy -= DT;
  if (b.jbuf > 0) b.jbuf -= DT;
  if (b.inv > 0) b.inv -= DT;
  // see-saws tip under the ball and drift back to rest
  for (let i = 0; i < s.saw.length; i++) {
    const o = s.saw[i];
    o.w += (o.ld * 9 + (o.ld ? 0 : (-SAWA - o.a) * 1.2) - o.w * 2.2) * DT;
    o.a += o.w * DT;
    if (o.a > SAWA) { if (o.w > 0.5) ev(s, "clack", L.seesaws[i].x, L.seesaws[i].y); o.a = SAWA; o.w = 0; }
    if (o.a < -SAWA) { if (o.w < -0.5) ev(s, "clack", L.seesaws[i].x, L.seesaws[i].y); o.a = -SAWA; o.w = 0; }
  }
  // stars
  for (let i = 0; i < L.stars.length; i++) if (!s.got[i]) { const q = L.stars[i], dx = q.x - b.x, dy = q.y - b.y; if (dx * dx + dy * dy < 1100) { s.got[i] = 1; s.nstar++; ev(s, "star", q.x, q.y, s.nstar); } }
  // springs
  for (let i = 0; i < L.springs.length; i++) { const q = L.springs[i]; if (Math.abs(b.x - q.x) < 24 && b.y + R > q.y - 12 && b.y < q.y + 4 && b.vy > -200) { b.vy = -SPRING * q.pow; b.jmp = 0; b.gr = 0; b.coy = 0; b.on = -1; ev(s, "spring", q.x, q.y, i); } }
  // buttons and gates
  for (let i = 0; i < L.buttons.length; i++) {
    const q = L.buttons[i], o = s.btn[i]; if (o.lock > 0) o.lock -= DT;
    let p = Math.abs(b.x - q.x) < 26 && b.y + R > q.y - 9 && b.y < q.y ? 1 : 0;
    if (!p && q.mode !== "num") for (let j = 0; j < L.bodies.length; j++) { const c = s.bodies[j]; if (c.dead <= 0 && Math.abs(c.x - q.x) < 22 + L.bodies[j].r * 0.6 && c.y + L.bodies[j].r > q.y - 9 && c.y < q.y) { p = 2; break; } }
    const gs = s.gate[q.gate];
    if (q.mode === "hold") { if (p) gs.h = 1; if (p && !o.p) ev(s, "press", q.x, q.y); }
    else if (p && !o.p && !gs.open && o.lock <= 0) {
      if (q.right) { gs.open = 1; ev(s, q.mode === "num" ? "right" : "press", q.x, q.y, q.gate); }
      else { s.wrong++; for (let j = 0; j < L.buttons.length; j++) if (L.buttons[j].gate === q.gate) s.btn[j].lock = 0.9; ev(s, "wrong", q.x, q.y, q.gate); }
    }
    o.p = p;
  }
  for (let i = 0; i < L.gates.length; i++) { const o = s.gate[i], want = o.open || o.h ? 1 : 0; o.h = 0; if (o.k < want) o.k = Math.min(1, o.k + DT * 2.2); else if (o.k > want) o.k = Math.max(0, o.k - DT * 2.5); }
  // enemies
  for (let i = 0; i < L.enemies.length; i++) if (!s.ea[i]) {
    const e = L.enemies[i], ex = enemyX(e, s.t);
    if (Math.abs(b.x - ex) > 60 || Math.abs(b.y - e.y) > 90) continue;
    if (!cBox(b.x, b.y, R - 2, ex - EW, e.y - EW * 2, EW * 2, EW * 2)) continue;
    if (!e.spiky && b.vy > 20 && b.y < e.y - EW * 2 + 6) { s.ea[i] = s.t; s.stomps++; b.vy = b.jh ? -640 : -470; b.jmp = 0; b.gr = 0; b.coy = 0; ev(s, "squash", ex, e.y - EW, 0); }
    else hurt(L, s, b.x > ex ? 1 : -1, false);
  }
  // spikes
  for (let i = 0; i < L.spikes.length; i++) { const q = L.spikes[i]; if (b.x > q.x - 8 && b.x < q.x + q.w + 8 && b.y + R > q.y - 14 && b.y < q.y + 10 && b.inv <= 0) { hurt(L, s, b.vx > 0 ? -1 : 1, false); b.vy = -520; } }
  if (s.boss) bossStep(L, s);
  // checkpoints, pits, goal, targets
  for (let i = s.cp + 1; i < L.cps.length; i++) { const q = L.cps[i]; if (b.x > q.x - 12 && Math.abs(b.y - q.y) < 160) { s.cp = i; if (s.hearts < 3) s.hearts++; ev(s, "cp", q.x, q.y, i); } }
  if (!s.fail && b.y > BOT - 150) hurt(L, s, 0, true);
  if (!s.fail && Math.abs(b.x - L.goal.x) < 34 && Math.abs(b.y - L.goal.y) < 130) { s.done = 1; ev(s, "goal", L.goal.x, L.goal.y); }
  for (let n = 0; n < 3 && s.ti < L.targets.length - 1; n++) {
    const q = L.targets[s.ti];
    if ((q.type === "gate" && s.gate[q.gate].open) || (q.type === "boss" && s.boss.mode === "dead") || (q.type === "push" && s.bodies[q.body].x >= q.x) || (q.type === "way" && Math.abs(b.x - q.x) < 30 && Math.abs(b.y - q.y) < 110)) s.ti++; else break;
  }
}
