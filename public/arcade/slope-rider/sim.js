// Slope Rider world: vehicles, the parts kit, level building, rules (finish, flip, fall, pick the line) and the test driver.
// Pure logic on top of phys.js, so node can drive every level without a browser.
import { World, Body, poly, box, circle, Revolute, WheelJ, Rope, STA, DYN, KIN } from "./phys.js";
import { LEVELS } from "./levels.js";
export { LEVELS };
export const G = 16, H = 1 / 120;
const TAU = Math.PI * 2;

// ---------- vehicles ----------
export const VEH = {
  buggy: { name: "Buggy", hull: [[-1.15, -0.25], [1.15, -0.25], [1.22, 0.1], [0.35, 0.32], [-1.1, 0.32]], ballast: [0.7, 0.07, 0, -0.3, 6], head: [-0.2, 0.62, 0.33],
    wheels: [{ x: -0.82, y: -0.42, r: 0.42, drive: 1 }, { x: 0.82, y: -0.42, r: 0.42, drive: 1 }], hz: 4, zeta: 0.7, travel: [-0.2, 0.16], maxV: 16, acc: 10, air: 7 },
  mini: { name: "Mini", hull: [[-0.72, -0.2], [0.72, -0.2], [0.76, 0.08], [0.2, 0.3], [-0.7, 0.3]], ballast: [0.4, 0.06, 0, -0.24, 5], head: [-0.1, 0.56, 0.3],
    wheels: [{ x: -0.5, y: -0.32, r: 0.3, drive: 1 }, { x: 0.5, y: -0.32, r: 0.3, drive: 1 }], hz: 5, zeta: 0.7, travel: [-0.14, 0.1], maxV: 15, acc: 13, air: 12 },
  bus: { name: "Long Bus", hull: [[-2.7, -0.3], [2.7, -0.3], [2.7, 0.85], [-2.7, 0.85]], ballast: [2.2, 0.08, 0, -0.34, 5], head: [1.9, 0.5, 0.01],
    wheels: [{ x: -1.9, y: -0.5, r: 0.46, drive: 1 }, { x: 1.9, y: -0.5, r: 0.46, drive: 1 }], hz: 3.4, zeta: 0.7, travel: [-0.22, 0.18], maxV: 14, acc: 8, air: 5 },
  monster: { name: "Monster Truck", hull: [[-1.2, -0.2], [1.2, -0.2], [1.25, 0.2], [0.4, 0.45], [-1.15, 0.45]], ballast: [0.75, 0.1, 0, -0.6, 8], head: [-0.15, 0.76, 0.33],
    wheels: [{ x: -1.25, y: -0.75, r: 0.8, drive: 1 }, { x: 1.25, y: -0.75, r: 0.8, drive: 1 }], hz: 2.6, zeta: 0.55, travel: [-0.4, 0.3], maxV: 15, acc: 10, air: 7, wd: 0.5 },
  penny: { name: "Big Wheel", hull: [[-0.9, -0.2], [1.3, -0.2], [1.35, 0.05], [0.4, 0.3], [-0.85, 0.3]], ballast: [0.7, 0.07, 0.25, -0.26, 6], head: [-0.1, 0.6, 0.33],
    wheels: [{ x: -0.75, y: 0.1, r: 1.0, drive: 1 }, { x: 1.05, y: -0.55, r: 0.3, drive: 0 }], hz: 3.6, zeta: 0.7, travel: [-0.2, 0.16], maxV: 16, acc: 9, air: 8, wd: 0.5 },
  rocket: { name: "Rocket Car", hull: [[-1.4, -0.2], [1.6, -0.2], [1.75, -0.02], [0.2, 0.26], [-1.35, 0.3]], ballast: [1.0, 0.07, 0.1, -0.26, 7], head: [-0.45, 0.56, 0.31],
    wheels: [{ x: -0.95, y: -0.32, r: 0.5, drive: 1 }, { x: 1.2, y: -0.44, r: 0.36, drive: 0.6 }], hz: 4.5, zeta: 0.75, travel: [-0.16, 0.12], maxV: 26, acc: 14, air: 8 },
};

function makeCar(W, key, x, gy) {
  const sp = VEH[key];
  let low = 1e9;
  for (const w of sp.wheels) low = Math.min(low, w.y - w.r);
  const y = gy - low + 0.03, bl = sp.ballast;
  const chassis = W.add(new Body(DYN, x, y, 0, [
    poly(sp.hull, { fr: 0.35, look: "none" }),
    box(bl[0], bl[1], bl[2], bl[3], 0, { d: bl[4], fr: 0.35, look: "none" }),
    circle(sp.head[2], sp.head[0], sp.head[1], { d: 0.15, fr: 0.4, look: "none" }),
  ], { group: 1, tag: "car", waker: true, ad: 0.3 }));
  const off = chassis.local(x, y);
  const wheels = [], joints = [];
  let mass = chassis.m;
  for (const w of sp.wheels) {
    const b = W.add(new Body(DYN, x + w.x, y + w.y, 0, [circle(w.r, 0, 0, { d: sp.wd ?? 1.1, fr: 1.5, look: "none" })], { group: 1, tag: "wheel", waker: true, ad: 0.1 }));
    wheels.push(b); mass += b.m;
    joints.push(W.joint(new WheelJ(chassis, b, 0, -1, { hz: sp.hz, zeta: sp.zeta, lo: sp.travel[0], hi: sp.travel[1] })));
  }
  const dsum = sp.wheels.reduce((s, w) => s + w.drive, 0);
  return { key, sp, chassis, wheels, joints, off, mass, torque: sp.wheels.map((w) => (sp.acc * mass * w.r * w.drive) / dsum), brake: sp.wheels.map((w) => (sp.acc * mass * w.r) / sp.wheels.length) };
}

// ---------- equations ----------
const frac = (v) => { for (const q of [1, 2, 3, 4]) { const p = v * q; if (Math.abs(p - Math.round(p)) < 1e-9) return [Math.round(p), q]; } return [v, 1]; };
export function eq(m, b) {
  const [p, q] = frac(m), [bp, bq] = frac(b);
  const bs = (n, d) => (d === 1 ? String(n) : `${n}/${d}`);
  if (p === 0) return "y = " + (bp < 0 ? "-" : "") + bs(Math.abs(bp), bq);
  const mx = (p < 0 ? "-" : "") + (Math.abs(p) === 1 ? "" : Math.abs(p)) + "x" + (q === 1 ? "" : "/" + q);
  return "y = " + mx + (bp === 0 ? "" : (bp < 0 ? " - " : " + ") + bs(Math.abs(bp), bq));
}

// ---------- the parts kit ----------
class Builder {
  constructor(L) { this.L = L; this.W = L.world; this.x = 0; this.y = 0; this.line = null; this.iceOn = false; this.grp = 10; }
  start(x, y) { this.x = x; this.y = y; this.line = { pts: [[x, y]], ice: [] }; this.L.lines.push(this.line); return this; }
  to(dx, dy = 0) { this.x += dx; this.y += dy; this.line.pts.push([this.x, this.y]); this.line.ice.push(this.iceOn); return this; }
  flat(d) { return this.to(d, 0); }
  curve(dx, f, n) { n = n || Math.max(4, Math.ceil(Math.abs(dx) / 1.1)); const x0 = this.x, y0 = this.y; for (let i = 1; i <= n; i++) { const t = i / n; this.x = x0 + dx * t; this.y = y0 + f(t); this.line.pts.push([this.x, this.y]); this.line.ice.push(this.iceOn); } return this; }
  /** Smooth S change of height. */
  ease(dx, dy, n) { return this.curve(dx, (t) => dy * t * t * (3 - 2 * t), n); }
  /** A rounded bump (h > 0) or dip (h < 0). */
  hump(w, h, n) { return this.curve(w, (t) => (h * (1 - Math.cos(TAU * t))) / 2, n || Math.max(8, Math.ceil(w / 0.8))); }
  /** A launch ramp that curves upward. */
  kick(dx, dy, n) { return this.curve(dx, (t) => dy * t * t, n); }
  /** A landing ramp: steep first, then flat. */
  land(dx, dy, n) { return this.curve(dx, (t) => dy * (1 - (1 - t) * (1 - t)), n); }
  ice(on = true) { this.iceOn = on; return this; }
  /** End the road here and start it again dx, dy away. Falling in restarts the level. */
  gap(dx, dy = 0) { this.L.pits.push({ x0: this.x, x1: this.x + dx, y: Math.min(this.y, this.y + dy) - 5 }); return this.start(this.x + dx, this.y + dy); }
  slab(pts, o = {}) { const b = this.W.add(new Body(STA, 0, 0, 0, [poly(pts, { fr: o.fr ?? 0.8, bounce: o.bounce, look: o.look || "stone" })], { tag: o.tag })); this.L.statics.push(b); return b; }
  /** A static box given relative to the cursor. */
  rect(dx0, dy0, dx1, dy1, o) { const x = this.x, y = this.y; this.slab([[x + dx0, y + dy0], [x + dx1, y + dy0], [x + dx1, y + dy1], [x + dx0, y + dy1]], o); return this; }
  dyn(x, y, a, shapes, o = {}) { return this.W.add(new Body(DYN, x, y, a, shapes, o)); }
  coins(dx0, dy0, dx1, dy1, n, peak = 0) { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0.5; this.L.coins.push({ x: this.x + dx0 + (dx1 - dx0) * t, y: this.y + dy0 + (dy1 - dy0) * t + peak * 4 * t * (1 - t), got: false }); } return this; }
  bot(dx0, dx1, o) { this.L.zones.push({ x0: this.x + dx0, x1: this.x + dx1, ...o }); return this; }
  crate(x, y, s = 0.9, d = 0.13) { return this.dyn(x, y, 0, [box(s / 2, s / 2, 0, 0, 0, { d, fr: 0.4, re: 0.15, look: "crate" })], { tag: "crate", canSleep: true, asleep: true, ad: 0.3, pop: 0.4 }); }
  /** A stack of crates standing on the road at the cursor + dx. */
  crates(dx, cols, rows, s = 0.9, d) { for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) this.crate(this.x + dx + c * (s + 0.03), this.y + s / 2 + 0.01 + r * (s + 0.005), s, d); return this; }
  logs(dx, dy, n, r = 0.45, cols = 4) { for (let i = 0; i < n; i++) this.dyn(this.x + dx + (i % cols) * (r * 2.05) + 0, this.y + dy + r + Math.floor(i / cols) * r * 1.8, 0, [circle(r, 0, 0, { d: 0.8, fr: 0.8, look: "log" })], { tag: "log", canSleep: true, ad: 2.5 }); return this; }
  ball(dx, dy, r, d = 0.12, o = {}) { this.dyn(this.x + dx, this.y + dy + r, 0, [circle(r, 0, 0, { d, fr: 0.9, look: "ball" })], { tag: "ball", ad: 0.05, ...o }); return this; }
  /** A plank on a pivot. tilt > 0 puts the left end down. */
  seesaw(dx, dy, len, tilt = 0.3, o = {}) {
    const px = this.x + dx, py = this.y + dy;
    const b = this.dyn(px, py, tilt, [box(len / 2, 0.12, 0, 0, 0, { d: o.d ?? 0.5, fr: 0.9, look: "plank" })], { tag: "seesaw", ad: 0.8 });
    this.W.joint(new Revolute(this.W.ground, b, px, py, { lo: -(o.lim ?? Math.abs(tilt)) - tilt, hi: (o.lim ?? Math.abs(tilt)) - tilt }));
    this.L.pivots.push({ x: px, y: py, h: o.h ?? dy });
    return this;
  }
  /** A hinged plank bridge from the cursor across a pit of width len. */
  bridge(len, n, o = {}) {
    const x0 = this.x, y0 = this.y, w = len / n, grp = this.grp++;
    let prev = this.W.ground;
    for (let i = 0; i < n; i++) {
      const b = this.dyn(x0 + w * (i + 0.5), y0 - 0.1, 0, [box(w / 2 - 0.02, 0.1, 0, 0, 0, { d: o.d ?? 0.9, fr: 0.9, look: "plank" })], { tag: "plank", group: grp, canSleep: true, asleep: true, ad: 1.5, ld: 0.3 });
      this.W.joint(new Revolute(prev, b, x0 + w * i, y0 - 0.1));
      prev = b;
    }
    this.W.joint(new Revolute(prev, this.W.ground, x0 + len, y0 - 0.1));
    this.L.pits.push({ x0, x1: x0 + len, y: y0 - 6 });
    return this.start(x0 + len, y0);
  }
  /** Planks over a pit that fall a moment after you touch them. */
  drops(n, w = 2.2, sp = 0.1) {
    const x0 = this.x, y0 = this.y, len = n * (w + sp) + sp;
    for (let i = 0; i < n; i++) {
      const b = this.dyn(x0 + sp + i * (w + sp) + w / 2, y0 - 0.15, 0, [box(w / 2, 0.15, 0, 0, 0, { d: 0.8, fr: 0.9, look: "drop" })], { tag: "drop", asleep: true, hold: true });
      this.L.drops.push({ b, t: -1 });
    }
    this.L.pits.push({ x0, x1: x0 + len, y: y0 - 6 });
    return this.start(x0 + len, y0);
  }
  /** A swinging hammer: pivot above the road, head down. */
  hammer(dx, dy, len, o = {}) {
    const px = this.x + dx, py = this.y + dy, r = o.r ?? 0.9, amp = o.amp ?? 1.1, per = o.per ?? 3, ph = o.ph ?? 0;
    const b = this.W.add(new Body(KIN, px, py, 0, [box(0.12, len / 2, 0, -len / 2, 0, { look: "rod", fr: 0.3 }), circle(r, 0, -len, { look: "hammer", fr: 0.3 })], { tag: "hammer" }));
    b.data = { per, ph, amp };
    this.L.movers.push({ b, f: (t) => [px, py, amp * Math.sin((TAU * t) / per + ph)] });
    this.L.pivots.push({ x: px, y: py, h: 0, post: true });
    return this;
  }
  /** A turning wheel or paddle cross. */
  spinner(dx, dy, r, speed, o = {}) {
    const px = this.x + dx, py = this.y + dy, shapes = [];
    if (o.cross) for (let i = 0; i < (o.arms || 2); i++) shapes.push(box(r, 0.16, 0, 0, (Math.PI * i) / (o.arms || 2), { look: "blade", fr: 0.9 }));
    else shapes.push(circle(r, 0, 0, { look: "gear", fr: 1.2 }));
    const b = this.W.add(new Body(KIN, px, py, 0, shapes, { tag: "spinner" }));
    this.L.movers.push({ b, f: (t) => [px, py, speed * t] });
    return this;
  }
  /** A platform that rides between two points and waits at each end. */
  lift(dx, dy, w, mx, my, per = 5, ph = 0) {
    const px = this.x + dx, py = this.y + dy;
    const b = this.W.add(new Body(KIN, px, py, 0, [box(w / 2, 0.18, 0, 0, 0, { look: "lift", fr: 1.2 })], { tag: "lift" }));
    const f = (t) => { let u = (((t / per + ph) % 1) + 1) % 1; u = u < 0.2 ? 0 : u < 0.5 ? (u - 0.2) / 0.3 : u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3; u = u * u * (3 - 2 * u); return [px + mx * u, py + my * u, 0]; };
    b.data = { per, ph, u: (t) => (f(t)[0] - px + f(t)[1] - py) / ((mx + my) || 1) };
    this.L.movers.push({ b, f });
    return this;
  }
  /** A bouncy pad lying on the road. */
  tramp(w, power = 13) { const x = this.x, y = this.y; this.slab([[x, y - 0.05], [x + w, y - 0.05], [x + w - 0.5, y + 0.14], [x + 0.5, y + 0.14]], { bounce: power, look: "tramp", fr: 1 }); return this.flat(w); }
  /** A boulder that waits at dx, dy and starts rolling when the buggy passes trig. */
  boulder(dx, dy, r, trig, push = 0) {
    const b = this.dyn(this.x + dx, this.y + dy + r, 0, [circle(r, 0, 0, { d: 1.6, fr: 1, look: "boulder" })], { tag: "boulder", asleep: true, hold: true, ad: 0 });
    this.L.triggers.push({ x: this.x + trig, done: false, fn: () => { b.hold = false; b.wake(); b.vx = push; } });
    return this;
  }
  /** A plank hanging from two ropes. */
  gondola(dx, dy, w, rope = 4) {
    const px = this.x + dx, py = this.y + dy;
    const b = this.dyn(px, py, 0, [box(w / 2, 0.14, 0, 0, 0, { d: 1.2, fr: 1, look: "plank" })], { tag: "gondola", ad: 1.2, ld: 0.25 });
    for (const s of [-1, 1]) this.L.ropes.push(this.W.joint(new Rope(this.W.ground, b, px + s * (w / 2 - 0.2), py + rope, px + s * (w / 2 - 0.2), py, rope)));
    return this;
  }
  /** A full loop of radius R standing on the road at the cursor. The road goes on under it. */
  loop(R) {
    const cx = this.x + R * 0.2, cy = this.y + R, mk = (a0, a1) => {
      const pts = [], n = Math.ceil(((a1 - a0) / TAU) * 44);
      for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      return this.strip(pts, 0.45, "loop");
    };
    const rl = mk(-Math.PI / 2, 0), top = mk(0, Math.PI), ll = mk(Math.PI, Math.PI * 1.5);
    this.L.loops.push({ cx, cy, R, rl, ll, top, phase: 0 });
    for (const b of ll) b.shapes[0].on = false;
    return this;
  }
  /** Solid strip along a polyline; the surface is on the left of the direction of travel. */
  strip(pts, D, look, ice) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < 1e-6) continue;
      const nx = (-dy / l) * D, ny = (dx / l) * D;
      const body = new Body(STA, 0, 0, 0, [poly([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0], b[1]], [a[0], a[1]]], { skip: [false, i < pts.length - 2, false, i > 0], fr: ice && ice[i] ? 0.02 : 0.8, look })], { tag: look });
      this.W.add(body); out.push(body);
      if (look !== "ground") this.L.statics.push(body);
    }
    return out;
  }
  /** Pick the line: the road stops at grid point A and starts again at grid point B. opts[0] is the line through both. */
  math(o) {
    const u = o.unit || 2, A = o.A || [0, 0], Bp = o.B, ox = this.x - A[0] * u, oy = this.y - A[1] * u;
    const order = o.order || [1, 0, 2];
    const opts = order.map((k) => ({ m: o.opts[k][0], b: o.opts[k][1], ok: k === 0, label: eq(o.opts[k][0], o.opts[k][1]) }));
    const M = { ox, oy, u, A, B: Bp, opts, ghost: o.ghost || "full", picked: -1, body: null, x0: this.x, x1: ox + Bp[0] * u, right: null };
    this.L.maths.push(M);
    this.L.pits.push({ x0: this.x, x1: M.x1, y: Math.min(this.y, oy + Bp[1] * u) - 6 });
    return this.start(M.x1, oy + Bp[1] * u);
  }
  finish(run = 5) { this.flat(run); this.L.finishX = this.x; this.L.finishY = this.y; this.flat(16); return this; }
}

export function pick(L, mi, k) {
  const M = L.maths[mi];
  if (!M || k < 0 || k >= M.opts.length || M.picked === k || L.car.chassis.x > M.x0 - 0.5) return false;
  if (M.body) { M.body.dead = true; L.statics.splice(L.statics.indexOf(M.body), 1); }
  const o = M.opts[k], xa = M.A[0], xb = M.B[0];
  const p0 = [M.ox + xa * M.u, M.oy + (o.m * xa + o.b) * M.u], p1 = [M.ox + xb * M.u, M.oy + (o.m * xb + o.b) * M.u];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), nx = (-dy / l) * 0.3, ny = (dx / l) * 0.3;
  M.body = L.world.add(new Body(STA, 0, 0, 0, [poly([[p0[0] - nx, p0[1] - ny], [p1[0] - nx, p1[1] - ny], p1, p0], { fr: 0.9, look: "ramp" })], { tag: "ramp" }));
  M.body.data = { ok: o.ok };
  L.statics.push(M.body);
  M.picked = k; M.right = o.ok; M.pt = L.pt;
  L.ev.push({ type: "pick", ok: o.ok, x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, label: o.label });
  return true;
}
/** The gap the buggy is coming up to, or -1. */
export function nextMath(L) { const x = L.car.chassis.x; for (let i = 0; i < L.maths.length; i++) if (x < L.maths[i].x0 - 0.5) return i; return -1; }

// ---------- levels ----------
export function makeLevel(idx, custom) {
  const def = custom || LEVELS[idx], W = new World(G);
  const L = { idx, def, world: W, lines: [], statics: [], pits: [], maths: [], coins: [], movers: [], triggers: [], drops: [], loops: [], pivots: [], ropes: [], zones: [],
    finishX: 0, finishY: 0, killY: 0, t: 0, pt: 0, state: "run", why: "", started: false, flipT: 0, stuckT: 0, airT: 0, spin: 0, flips: 0, grounded: 2, ev: [], got: 0, winT: 0, maxAir: 0, bounceT: 0 };
  const B = new Builder(L);
  B.start(-9, 0).flat(9);
  def.f(B);
  if (!L.finishX) B.finish();
  let lowY = 1e9;
  for (const ln of L.lines) {
    B.strip(ln.pts, 1.5, "ground", ln.ice);
    const a = ln.pts[0], z = ln.pts[ln.pts.length - 1];
    W.add(new Body(STA, 0, 0, 0, [poly([[a[0], a[1] - 60], [a[0] + 0.4, a[1] - 60], [a[0] + 0.4, a[1] - 0.12], [a[0], a[1] - 0.12]], { fr: 0.4 })]));
    W.add(new Body(STA, 0, 0, 0, [poly([[z[0] - 0.4, z[1] - 60], [z[0], z[1] - 60], [z[0], z[1] - 0.12], [z[0] - 0.4, z[1] - 0.12]], { fr: 0.4 })]));
    for (const p of ln.pts) lowY = Math.min(lowY, p[1]);
  }
  const f = L.lines[0].pts[0], e = L.lines[L.lines.length - 1].pts, z = e[e.length - 1];
  W.add(new Body(STA, 0, 0, 0, [poly([[f[0] - 1, f[1] - 2], [f[0], f[1] - 2], [f[0], f[1] + 30], [f[0] - 1, f[1] + 30]], { fr: 0.2 })]));
  W.add(new Body(STA, 0, 0, 0, [poly([[z[0], z[1] - 2], [z[0] + 1, z[1] - 2], [z[0] + 1, z[1] + 30], [z[0], z[1] + 30]], { fr: 0.2 })]));
  L.endX = z[0]; L.startX = f[0];
  L.killY = lowY - 9;
  L.car = makeCar(W, def.v || "buggy", 0, 0);
  for (const m of L.movers) { const p = m.f(0); m.b.x = p[0]; m.b.y = p[1]; m.b.a = p[2]; m.b.sync(); }
  for (let i = 0; i < 90; i++) physics(L, null, true);
  L.pt = 0; W.events.length = 0;
  return L;
}

function physics(L, inp, settle) {
  const W = L.world, car = L.car, c = car.chassis, sp = car.sp;
  const dir = !inp || L.state !== "run" ? 0 : (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0);
  if (!settle) for (const m of L.movers) { const p = m.f(L.pt + H), b = m.b; b.vx = (p[0] - b.x) / H; b.vy = (p[1] - b.y) / H; b.w = (p[2] - b.a) / H; }
  let grounded = 0;
  for (const w of car.wheels) if (w.nc > 0) grounded++;
  L.grounded = grounded;
  for (let i = 0; i < car.joints.length; i++) {
    const j = car.joints[i], ws = sp.wheels[i];
    j.motor = true;
    if (L.state === "win" || settle) { j.speed = 0; j.maxT = car.brake[i] * 1.5; }
    else if (dir > 0) { j.speed = -sp.maxV / ws.r; j.maxT = car.torque[i]; }
    else if (dir < 0) { j.speed = (sp.maxV * 0.45) / ws.r; j.maxT = car.brake[i] * 1.2; }
    else { j.speed = 0; j.maxT = car.brake[i] * 0.05; }
  }
  if (dir) { const k = grounded ? (dir > 0 ? 0.25 : 0.08) : 1, lim = 5.5; if ((dir > 0 && c.w < lim) || (dir < 0 && c.w > -lim)) c.w += dir * sp.air * k * H; }
  W.step(H);
  if (L.bounceT > 0) L.bounceT -= H;
  let bp = 0;
  for (const b of [c, ...car.wheels]) { if (b.bounced) bp = Math.max(bp, b.bounced); b.bounced = 0; }
  if (bp && L.bounceT <= 0 && c.vy < bp * 0.8) { for (const b of [c, ...car.wheels]) b.vy = bp; c.w *= 0.4; L.bounceT = 0.25; L.ev.push({ type: "bounce", x: c.x, y: c.y - 0.8 }); }
  if (!settle) L.pt += H;
}

/** One frame of n physics substeps (2 = 1/60 s; 1 = half speed slow motion). inp: { gas, brake, pick: 0..2 or -1 }. */
export function stepLevel(L, inp, n = 2) {
  const c = L.car.chassis, d = n * H;
  if (L.state === "run") {
    if (inp.pick >= 0) { const mi = nextMath(L); if (mi >= 0) pick(L, mi, inp.pick); }
    if (!L.started && (inp.gas || inp.brake)) L.started = true;
  }
  for (let i = 0; i < n; i++) physics(L, inp);
  if (L.started && L.state === "run") L.t += d;
  for (const lp of L.loops) {
    if (lp.phase === 0 && c.x < lp.cx - 0.3 && c.y > lp.cy && Math.abs(c.x - lp.cx) < lp.R) lp.phase = 1;
    else if (lp.phase === 1 && (c.x > lp.cx + lp.R + 1.2 || c.x < lp.cx - lp.R - 3)) lp.phase = 0;
    for (const b of lp.rl) b.shapes[0].on = lp.phase === 0;
    for (const b of lp.ll) b.shapes[0].on = lp.phase === 1;
  }
  for (const t of L.triggers) if (!t.done && c.x > t.x) { t.done = true; t.fn(); L.ev.push({ type: "trigger" }); }
  for (const d of L.drops) {
    if (d.t < 0) { if (d.b.nc > 0) { d.t = 0.32; L.ev.push({ type: "creak", x: d.b.x, y: d.b.y }); } }
    else if (d.t > 0) { d.t -= d; if (d.t <= 0) { d.t = 0; d.b.hold = false; d.b.wake(); } }
  }
  for (const b of L.world.bodies) {
    if (b.dead || b.kind !== DYN) continue;
    if (b.y < L.killY - 12) b.dead = true;
    else if (b.canSleep && !b.hold && (b.woke || !b.sleep) && Math.abs(b.x - c.x) < 9) { b.st = 0; if (b.sleep) b.wake(); }
  }
  if (L.grounded === 0) { L.airT += d; L.spin += c.w * d; }
  else {
    if (L.airT > 0.3) {
      const n = Math.round(Math.abs(L.spin) / TAU);
      if (n > 0 && Math.cos(c.a) > 0.3) { L.flips += n; L.ev.push({ type: "flip", n }); }
      L.ev.push({ type: "land", air: L.airT });
      if (L.airT > L.maxAir) L.maxAir = L.airT;
    }
    L.airT = 0; L.spin = 0;
  }
  if (L.state !== "run") { if (L.state === "win") L.winT += d; return; }
  for (const k of L.coins) if (!k.got && (k.x - c.x) ** 2 + (k.y - c.y) ** 2 < 1.9) { k.got = true; L.got++; L.ev.push({ type: "coin", x: k.x, y: k.y, n: L.got }); }
  const up = Math.cos(c.a), sp2 = c.vx * c.vx + c.vy * c.vy;
  let why = "";
  if (c.dead || c.y < L.killY) why = "fell";
  for (const p of L.pits) if (c.x > p.x0 && c.x < p.x1 && c.y < p.y) why = "fell";
  if (up < -0.15 && (c.nc > 0 || sp2 < 4)) L.flipT += d; else L.flipT = Math.max(0, L.flipT - 2 * d);
  if (L.flipT > 0.7) why = "flip";
  if (up < 0.3 && sp2 < 0.5) L.stuckT += d; else L.stuckT = 0;
  if (L.stuckT > 1.4) why = "flip";
  for (const b of L.world.bodies) if (b.tag === "boulder" && !b.sleep && !b.dead) { const r = b.shapes[0].r; if ((b.x - c.x) ** 2 + (b.y - c.y) ** 2 < (r + 0.75) ** 2 && b.vx * b.vx + b.vy * b.vy > 6) why = "squash"; }
  if (why) { L.state = "fail"; L.why = why; L.ev.push({ type: "fail", why }); return; }
  if (c.x > L.finishX) { L.state = "win"; L.ev.push({ type: "win" }); }
}

// ---------- the test driver ----------
export const norm = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export function botInput(L) {
  const c = L.car.chassis, out = { gas: false, brake: false, pick: -1 };
  const mi = nextMath(L);
  if (mi >= 0) { const M = L.maths[mi]; if (M.picked < 0 && c.x > M.x0 - 16) out.pick = M.opts.findIndex((o) => o.ok); }
  let z = null;
  for (const q of L.zones) if (c.x >= q.x0 && c.x < q.x1) z = q;
  const vT = z?.v ?? L.def.bv ?? 99, sp = c.vx - (z?.on ? z.on.vx : 0), a = norm(c.a);
  if (z?.wait && !z.go) { if (z.wait(L)) z.go = true; }
  if (z?.wait && !z.go) { if (sp > 0.4) out.brake = true; else if (sp < -0.4) out.gas = true; return out; }
  if (L.grounded === 0 && L.airT > 0.06) {
    const target = z?.air ?? Math.max(-0.5, Math.min(0.5, Math.atan2(c.vy, Math.max(4, Math.abs(c.vx))) * 0.6));
    const e = a + 0.2 * c.w - target;
    if (e < -0.1) out.gas = true; else if (e > 0.1) out.brake = true;
    return out;
  }
  if (!z?.go || !z.wait) { if (Math.abs(sp) < 0.3) L.botStuck = (L.botStuck || 0) + 1; else if (L.botStuck < 70) L.botStuck = 0; }
  if (L.botStuck > 70) { L.botStuck++; if (L.botStuck > 110) L.botStuck = 0; out.brake = true; return out; }
  if (a > (z?.tip ?? 0.75) && c.w > 0) return out;
  if (sp < vT) out.gas = true; else if (sp > vT + 3) out.brake = true;
  return out;
}

/** Problems with a level's math, for the checker: exactly one line must pass through A and B. */
export function mathErrors(L) {
  const bad = [];
  L.maths.forEach((M, i) => {
    const hit = M.opts.filter((o) => Math.abs(o.m * M.A[0] + o.b - M.A[1]) < 1e-9 && Math.abs(o.m * M.B[0] + o.b - M.B[1]) < 1e-9);
    if (hit.length !== 1 || !hit[0].ok) bad.push(`math ${i}: ${hit.length} lines fit`);
    if (new Set(M.opts.map((o) => o.label)).size !== M.opts.length) bad.push(`math ${i}: duplicate labels`);
  });
  return bad;
}
