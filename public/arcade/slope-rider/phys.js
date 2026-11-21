// A small rigid-body engine for Slope Rider: circles and convex polygons, sequential impulses with warm starting,
// revolute, wheel (suspension) and rope joints, kinematic movers, sleeping. y is up, angles are counter-clockwise.
// Pure math: no DOM, so the same code runs in node for the level checker.
export const STA = 0, DYN = 1, KIN = 2;
const SLOP = 0.012, BETA = 0.22, MAXPUSH = 5, MARGIN = 0.015, CW = 4, ITER = 10;
let SID = 1;

export function poly(pts, o = {}) {
  const n = pts.length;
  return { t: 1, n, lv: pts.map((p) => [p[0], p[1]]), wv: new Float64Array(n * 2), wn: new Float64Array(n * 2), skip: o.skip || null,
    fr: o.fr ?? 0.6, re: o.re ?? 0, bounce: o.bounce || 0, d: o.d ?? 1, on: true, id: SID++, look: o.look || "" };
}
export function box(hw, hh, ox = 0, oy = 0, ang = 0, o = {}) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return poly([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [ox + x * c - y * s, oy + x * s + y * c]), o);
}
export function circle(r, ox = 0, oy = 0, o = {}) {
  return { t: 0, r, lx: ox, ly: oy, wx: 0, wy: 0, fr: o.fr ?? 0.6, re: o.re ?? 0, bounce: o.bounce || 0, d: o.d ?? 1, on: true, id: SID++, look: o.look || "" };
}

export class Body {
  constructor(kind, x, y, a, shapes, o = {}) {
    this.kind = kind; this.x = x; this.y = y; this.a = a || 0; this.vx = 0; this.vy = 0; this.w = 0;
    this.shapes = shapes; this.group = o.group || 0; this.gs = o.gs ?? 1; this.ld = o.ld || 0; this.ad = o.ad ?? 0.02;
    this.sleep = !!o.asleep; this.canSleep = !!o.canSleep; this.hold = !!o.hold; this.waker = !!o.waker; this.st = 0;
    this.tag = o.tag || ""; this.pop = o.pop || 0; this.data = o.data || null; this.dead = false; this.nc = 0; this.cnx = 0; this.cny = 1; this.cfr = 1; this.hitT = 0;
    this.m = 0; this.im = 0; this.I = 0; this.iI = 0; this.eim = 0; this.eiI = 0; this.c = 1; this.s = 0;
    this.minx = 0; this.maxx = 0; this.miny = 0; this.maxy = 0;
    if (kind === DYN) this.mass();
    this.sync();
  }
  mass() {
    let M = 0, cx = 0, cy = 0, I = 0;
    for (const s of this.shapes) {
      if (s.t === 0) { const m = s.d * Math.PI * s.r * s.r; M += m; cx += m * s.lx; cy += m * s.ly; I += m * (0.5 * s.r * s.r + s.lx * s.lx + s.ly * s.ly); }
      else {
        let A = 0, sx = 0, sy = 0, J = 0;
        for (let i = 0; i < s.n; i++) {
          const p = s.lv[i], q = s.lv[(i + 1) % s.n], cr = p[0] * q[1] - q[0] * p[1];
          A += cr; sx += (p[0] + q[0]) * cr; sy += (p[1] + q[1]) * cr;
          J += cr * (p[0] * p[0] + p[0] * q[0] + q[0] * q[0] + p[1] * p[1] + p[1] * q[1] + q[1] * q[1]);
        }
        M += s.d * A / 2; cx += s.d * sx / 6; cy += s.d * sy / 6; I += s.d * J / 12;
      }
    }
    cx /= M; cy /= M; I -= M * (cx * cx + cy * cy);
    for (const s of this.shapes) { if (s.t === 0) { s.lx -= cx; s.ly -= cy; } else for (const p of s.lv) { p[0] -= cx; p[1] -= cy; } }
    const c = Math.cos(this.a), s = Math.sin(this.a);
    this.x += c * cx - s * cy; this.y += s * cx + c * cy;
    this.m = M; this.im = 1 / M; this.I = I; this.iI = 1 / I;
  }
  local(wx, wy) { const dx = wx - this.x, dy = wy - this.y, c = Math.cos(this.a), s = Math.sin(this.a); return [c * dx + s * dy, -s * dx + c * dy]; }
  world(lx, ly) { const c = Math.cos(this.a), s = Math.sin(this.a); return [this.x + c * lx - s * ly, this.y + s * lx + c * ly]; }
  sync() {
    const c = (this.c = Math.cos(this.a)), s = (this.s = Math.sin(this.a));
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const sh of this.shapes) {
      if (sh.t === 0) {
        sh.wx = this.x + c * sh.lx - s * sh.ly; sh.wy = this.y + s * sh.lx + c * sh.ly;
        if (sh.wx - sh.r < minx) minx = sh.wx - sh.r; if (sh.wx + sh.r > maxx) maxx = sh.wx + sh.r;
        if (sh.wy - sh.r < miny) miny = sh.wy - sh.r; if (sh.wy + sh.r > maxy) maxy = sh.wy + sh.r;
      } else {
        const n = sh.n, wv = sh.wv, wn = sh.wn;
        for (let i = 0; i < n; i++) {
          const p = sh.lv[i], x = this.x + c * p[0] - s * p[1], y = this.y + s * p[0] + c * p[1];
          wv[i * 2] = x; wv[i * 2 + 1] = y;
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, ex = wv[j * 2] - wv[i * 2], ey = wv[j * 2 + 1] - wv[i * 2 + 1], l = Math.hypot(ex, ey) || 1;
          wn[i * 2] = ey / l; wn[i * 2 + 1] = -ex / l;
        }
      }
    }
    this.minx = minx - 0.03; this.maxx = maxx + 0.03; this.miny = miny - 0.03; this.maxy = maxy + 0.03;
  }
  wake(by) {
    if (this.kind !== DYN || this.hold) return;
    this.sleep = false; this.st = 0; this.eim = this.im; this.eiI = this.iI; this.woke = true;
    if (by && by.waker && this.pop) { const v = Math.abs(by.vx); this.vx = by.vx * 0.5; this.vy = v * this.pop + 1; this.w = (this.shapes[0].id % 2 ? 1 : -1) * (2 + v * 0.3); }
  }
}

// ---------- narrow phase (normals point from the first shape to the second) ----------
function polyPoly(A, B) {
  let sa = -1e9, ia = -1, sb = -1e9, ib = -1;
  for (let i = 0; i < A.n; i++) {
    if (A.skip && A.skip[i]) continue;
    const nx = A.wn[i * 2], ny = A.wn[i * 2 + 1], vx = A.wv[i * 2], vy = A.wv[i * 2 + 1];
    let mn = 1e9;
    for (let j = 0; j < B.n; j++) { const d = nx * (B.wv[j * 2] - vx) + ny * (B.wv[j * 2 + 1] - vy); if (d < mn) mn = d; }
    if (mn > MARGIN) return null;
    if (mn > sa) { sa = mn; ia = i; }
  }
  for (let i = 0; i < B.n; i++) {
    if (B.skip && B.skip[i]) continue;
    const nx = B.wn[i * 2], ny = B.wn[i * 2 + 1], vx = B.wv[i * 2], vy = B.wv[i * 2 + 1];
    let mn = 1e9;
    for (let j = 0; j < A.n; j++) { const d = nx * (A.wv[j * 2] - vx) + ny * (A.wv[j * 2 + 1] - vy); if (d < mn) mn = d; }
    if (mn > MARGIN) return null;
    if (mn > sb) { sb = mn; ib = i; }
  }
  if (ia < 0 && ib < 0) return null;
  let R, I, ri, flip;
  if (ib < 0 || (ia >= 0 && sa >= sb - 0.002)) { R = A; I = B; ri = ia; flip = false; } else { R = B; I = A; ri = ib; flip = true; }
  const nx = R.wn[ri * 2], ny = R.wn[ri * 2 + 1];
  let ie = -1, md = 1e9;
  for (let j = 0; j < I.n; j++) { if (I.skip && I.skip[j]) continue; const d = nx * I.wn[j * 2] + ny * I.wn[j * 2 + 1]; if (d < md) { md = d; ie = j; } }
  if (ie < 0) return null;
  const r2 = (ri + 1) % R.n, i2 = (ie + 1) % I.n;
  const v1x = R.wv[ri * 2], v1y = R.wv[ri * 2 + 1];
  let tx = R.wv[r2 * 2] - v1x, ty = R.wv[r2 * 2 + 1] - v1y;
  const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
  let ax = I.wv[ie * 2], ay = I.wv[ie * 2 + 1], bx = I.wv[i2 * 2], by = I.wv[i2 * 2 + 1];
  let da = tx * (ax - v1x) + ty * (ay - v1y), db = tx * (bx - v1x) + ty * (by - v1y);
  if (da < 0 && db < 0) return null;
  if (da < 0) { const f = da / (da - db); ax += (bx - ax) * f; ay += (by - ay) * f; da = 0; }
  else if (db < 0) { const f = db / (db - da); bx += (ax - bx) * f; by += (ay - by) * f; db = 0; }
  if (da > L && db > L) return null;
  if (da > L) { const f = (da - L) / (da - db); ax += (bx - ax) * f; ay += (by - ay) * f; }
  else if (db > L) { const f = (db - L) / (db - da); bx += (ax - bx) * f; by += (ay - by) * f; }
  const pts = [], base = (flip ? 4096 : 0) + ri * 64 + ie * 2;
  let sep = nx * (ax - v1x) + ny * (ay - v1y);
  if (sep <= MARGIN) pts.push({ x: ax - nx * sep * 0.5, y: ay - ny * sep * 0.5, sep, id: base, pn: 0, pt: 0 });
  sep = nx * (bx - v1x) + ny * (by - v1y);
  if (sep <= MARGIN) pts.push({ x: bx - nx * sep * 0.5, y: by - ny * sep * 0.5, sep, id: base + 1, pn: 0, pt: 0 });
  if (!pts.length) return null;
  return flip ? { nx: -nx, ny: -ny, pts } : { nx, ny, pts };
}
function polyCirc(P, C) {
  const cx = C.wx, cy = C.wy, r = C.r;
  let best = -1e9, bi = -1;
  for (let i = 0; i < P.n; i++) {
    if (P.skip && P.skip[i]) continue;
    const s = P.wn[i * 2] * (cx - P.wv[i * 2]) + P.wn[i * 2 + 1] * (cy - P.wv[i * 2 + 1]);
    if (s > r + MARGIN) return null;
    if (s > best) { best = s; bi = i; }
  }
  if (bi < 0) return null;
  const b2 = (bi + 1) % P.n, v1x = P.wv[bi * 2], v1y = P.wv[bi * 2 + 1], v2x = P.wv[b2 * 2], v2y = P.wv[b2 * 2 + 1];
  const ex = v2x - v1x, ey = v2y - v1y, u = ((cx - v1x) * ex + (cy - v1y) * ey) / (ex * ex + ey * ey || 1);
  if (u < 0 || u > 1) {
    if (best <= 0) { if (P.skip) return null; }
    else {
      const qx = u < 0 ? v1x : v2x, qy = u < 0 ? v1y : v2y, dx = cx - qx, dy = cy - qy, d = Math.hypot(dx, dy);
      if (d > r + MARGIN) return null;
      if (d < 1e-7) return { nx: P.wn[bi * 2], ny: P.wn[bi * 2 + 1], pts: [{ x: qx, y: qy, sep: -r, id: 900 + (u < 0 ? bi : b2), pn: 0, pt: 0 }] };
      return { nx: dx / d, ny: dy / d, pts: [{ x: qx, y: qy, sep: d - r, id: 900 + (u < 0 ? bi : b2), pn: 0, pt: 0 }] };
    }
  }
  const nx = P.wn[bi * 2], ny = P.wn[bi * 2 + 1];
  return { nx, ny, pts: [{ x: cx - nx * r, y: cy - ny * r, sep: best - r, id: bi, pn: 0, pt: 0 }] };
}
function circCirc(A, B) {
  const dx = B.wx - A.wx, dy = B.wy - A.wy, d = Math.hypot(dx, dy), R = A.r + B.r;
  if (d > R + MARGIN) return null;
  const nx = d > 1e-7 ? dx / d : 0, ny = d > 1e-7 ? dy / d : 1;
  return { nx, ny, pts: [{ x: A.wx + nx * A.r, y: A.wy + ny * A.r, sep: d - R, id: 0, pn: 0, pt: 0 }] };
}

// ---------- joints ----------
const soft = (k0, hz, zeta, h, C) => {
  // k0 is the inverse effective mass of the constraint
  const m = k0 > 0 ? 1 / k0 : 0, om = 2 * Math.PI * hz, k = m * om * om, c = 2 * m * zeta * om;
  const gamma = h * (c + h * k) > 0 ? 1 / (h * (c + h * k)) : 0;
  return { gamma, bias: C * h * k * gamma, mass: k0 + gamma > 0 ? 1 / (k0 + gamma) : 0 };
};
/** Pin two bodies together at a world point. Options: motor {speed, maxT}, limits lo/hi (relative angle), spring {hz, zeta} back to the start angle. */
export class Revolute {
  constructor(a, b, wx, wy, o = {}) {
    this.a = a; this.b = b; this.la = a.local(wx, wy); this.lb = b.local(wx, wy); this.ref = b.a - a.a;
    this.motor = !!o.motor; this.speed = o.speed || 0; this.maxT = o.maxT || 0; this.lo = o.lo ?? null; this.hi = o.hi ?? null;
    this.hz = o.hz || 0; this.zeta = o.zeta ?? 0.7; this.rest = o.rest || 0;
    this.px = 0; this.py = 0; this.pm = 0; this.plo = 0; this.phi = 0; this.ps = 0;
  }
  pre(h) {
    const a = this.a, b = this.b;
    const rax = (this.rax = a.c * this.la[0] - a.s * this.la[1]), ray = (this.ray = a.s * this.la[0] + a.c * this.la[1]);
    const rbx = (this.rbx = b.c * this.lb[0] - b.s * this.lb[1]), rby = (this.rby = b.s * this.lb[0] + b.c * this.lb[1]);
    const k11 = a.eim + b.eim + a.eiI * ray * ray + b.eiI * rby * rby, k22 = a.eim + b.eim + a.eiI * rax * rax + b.eiI * rbx * rbx;
    const k12 = -a.eiI * rax * ray - b.eiI * rbx * rby, det = k11 * k22 - k12 * k12, id = det ? 1 / det : 0;
    this.i11 = k22 * id; this.i12 = -k12 * id; this.i22 = k11 * id;
    this.bx = (BETA / h) * (b.x + rbx - a.x - rax); this.by = (BETA / h) * (b.y + rby - a.y - ray);
    const ki = a.eiI + b.eiI;
    this.mm = ki > 0 ? 1 / ki : 0; this.h = h;
    this.ang = b.a - a.a - this.ref;
    if (this.hz) { const s = soft(ki, this.hz, this.zeta, h, this.ang - this.rest); this.sg = s.gamma; this.sb = s.bias; this.sm = s.mass; }
    if (!this.motor) this.pm = 0;
    if (this.lo == null || this.ang > this.lo + 0.02) this.plo = 0;
    if (this.hi == null || this.ang < this.hi - 0.02) this.phi = 0;
    const L = this.pm + this.plo - this.phi + this.ps;
    a.vx -= a.eim * this.px; a.vy -= a.eim * this.py; a.w -= a.eiI * (rax * this.py - ray * this.px + L);
    b.vx += b.eim * this.px; b.vy += b.eim * this.py; b.w += b.eiI * (rbx * this.py - rby * this.px + L);
  }
  solve() {
    const a = this.a, b = this.b;
    if (this.motor) {
      const imp = -this.mm * (b.w - a.w - this.speed), old = this.pm, mx = this.maxT * this.h;
      this.pm = Math.max(-mx, Math.min(mx, old + imp)); const d = this.pm - old; a.w -= a.eiI * d; b.w += b.eiI * d;
    }
    if (this.hz) { const imp = -this.sm * (b.w - a.w + this.sb + this.sg * this.ps); this.ps += imp; a.w -= a.eiI * imp; b.w += b.eiI * imp; }
    if (this.lo != null && this.ang <= this.lo + 0.02) {
      const C = this.ang - this.lo, imp = -this.mm * (b.w - a.w + (C < 0 ? (BETA / this.h) * C : C / this.h)), old = this.plo;
      this.plo = Math.max(0, old + imp); const d = this.plo - old; a.w -= a.eiI * d; b.w += b.eiI * d;
    }
    if (this.hi != null && this.ang >= this.hi - 0.02) {
      const C = this.hi - this.ang, imp = -this.mm * (a.w - b.w + (C < 0 ? (BETA / this.h) * C : C / this.h)), old = this.phi;
      this.phi = Math.max(0, old + imp); const d = this.phi - old; a.w += a.eiI * d; b.w -= b.eiI * d;
    }
    const rax = this.rax, ray = this.ray, rbx = this.rbx, rby = this.rby;
    const cx = b.vx - b.w * rby - a.vx + a.w * ray + this.bx, cy = b.vy + b.w * rbx - a.vy - a.w * rax + this.by;
    const ix = -(this.i11 * cx + this.i12 * cy), iy = -(this.i12 * cx + this.i22 * cy);
    this.px += ix; this.py += iy;
    a.vx -= a.eim * ix; a.vy -= a.eim * iy; a.w -= a.eiI * (rax * iy - ray * ix);
    b.vx += b.eim * ix; b.vy += b.eim * iy; b.w += b.eiI * (rbx * iy - rby * ix);
  }
}
/** Suspension: the wheel b slides along an axis fixed in the chassis a, on a spring, with a motor on its spin. */
export class WheelJ {
  constructor(a, b, axx, axy, o = {}) {
    this.a = a; this.b = b; this.la = a.local(b.x, b.y);
    const c = Math.cos(a.a), s = Math.sin(a.a); this.lax = [c * axx + s * axy, -s * axx + c * axy];
    this.hz = o.hz || 4; this.zeta = o.zeta ?? 0.7; this.lo = o.lo ?? -0.2; this.hi = o.hi ?? 0.15;
    this.motor = false; this.speed = 0; this.maxT = 0;
    this.pp = 0; this.ps = 0; this.pm = 0; this.plo = 0; this.phi = 0; this.t = 0;
  }
  pre(h) {
    const a = this.a, b = this.b; this.h = h;
    const rax = a.c * this.la[0] - a.s * this.la[1], ray = a.s * this.la[0] + a.c * this.la[1];
    const dx = b.x - a.x - rax, dy = b.y - a.y - ray;
    const ax = (this.ax = a.c * this.lax[0] - a.s * this.lax[1]), ay = (this.ay = a.s * this.lax[0] + a.c * this.lax[1]);
    const px = -ay, py = ax; this.qx = px; this.qy = py;
    const ex = dx + rax, ey = dy + ray;
    this.sAy = ex * py - ey * px; this.sAx = ex * ay - ey * ax;
    const kP = a.eim + b.eim + a.eiI * this.sAy * this.sAy; this.mP = kP > 0 ? 1 / kP : 0;
    this.bP = (BETA / h) * (dx * px + dy * py);
    const kS = a.eim + b.eim + a.eiI * this.sAx * this.sAx; this.mL = kS > 0 ? 1 / kS : 0;
    this.t = dx * ax + dy * ay;
    const s = soft(kS, this.hz, this.zeta, h, this.t); this.sg = s.gamma; this.sb = s.bias; this.sm = s.mass;
    const kM = a.eiI + b.eiI; this.mM = kM > 0 ? 1 / kM : 0;
    if (!this.motor) this.pm = 0;
    if (this.t > this.lo + 0.01) this.plo = 0;
    if (this.t < this.hi - 0.01) this.phi = 0;
    const ax1 = this.ps + this.plo - this.phi, Px = this.pp * px + ax1 * ax, Py = this.pp * py + ax1 * ay, LA = this.pp * this.sAy + ax1 * this.sAx + this.pm;
    a.vx -= a.eim * Px; a.vy -= a.eim * Py; a.w -= a.eiI * LA;
    b.vx += b.eim * Px; b.vy += b.eim * Py; b.w += b.eiI * this.pm;
  }
  ap(imp, nx, ny, sA) { const a = this.a, b = this.b; a.vx -= a.eim * imp * nx; a.vy -= a.eim * imp * ny; a.w -= a.eiI * imp * sA; b.vx += b.eim * imp * nx; b.vy += b.eim * imp * ny; }
  solve() {
    const a = this.a, b = this.b, ax = this.ax, ay = this.ay;
    let cd = ax * (b.vx - a.vx) + ay * (b.vy - a.vy) - this.sAx * a.w;
    let imp = -this.sm * (cd + this.sb + this.sg * this.ps); this.ps += imp; this.ap(imp, ax, ay, this.sAx);
    if (this.motor) {
      const mi = -this.mM * (b.w - a.w - this.speed), old = this.pm, mx = this.maxT * this.h;
      this.pm = Math.max(-mx, Math.min(mx, old + mi)); const d = this.pm - old; a.w -= a.eiI * d; b.w += b.eiI * d;
    }
    if (this.t <= this.lo + 0.01) {
      const C = this.t - this.lo; cd = ax * (b.vx - a.vx) + ay * (b.vy - a.vy) - this.sAx * a.w;
      imp = -this.mL * (cd + (C < 0 ? (BETA / this.h) * C : C / this.h)); const old = this.plo; this.plo = Math.max(0, old + imp); this.ap(this.plo - old, ax, ay, this.sAx);
    }
    if (this.t >= this.hi - 0.01) {
      const C = this.hi - this.t; cd = ax * (b.vx - a.vx) + ay * (b.vy - a.vy) - this.sAx * a.w;
      imp = -this.mL * (-cd + (C < 0 ? (BETA / this.h) * C : C / this.h)); const old = this.phi; this.phi = Math.max(0, old + imp); this.ap(-(this.phi - old), ax, ay, this.sAx);
    }
    cd = this.qx * (b.vx - a.vx) + this.qy * (b.vy - a.vy) - this.sAy * a.w;
    imp = -this.mP * (cd + this.bP); this.pp += imp; this.ap(imp, this.qx, this.qy, this.sAy);
  }
}
/** A rope: two world anchors may not get farther apart than len. */
export class Rope {
  constructor(a, b, ax, ay, bx, by, len) { this.a = a; this.b = b; this.la = a.local(ax, ay); this.lb = b.local(bx, by); this.len = len ?? Math.hypot(bx - ax, by - ay); this.p = 0; }
  pre(h) {
    const a = this.a, b = this.b;
    const rax = (this.rax = a.c * this.la[0] - a.s * this.la[1]), ray = (this.ray = a.s * this.la[0] + a.c * this.la[1]);
    const rbx = (this.rbx = b.c * this.lb[0] - b.s * this.lb[1]), rby = (this.rby = b.s * this.lb[0] + b.c * this.lb[1]);
    let dx = b.x + rbx - a.x - rax, dy = b.y + rby - a.y - ray; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    this.nx = dx; this.ny = dy; this.C = l - this.len;
    const ca = rax * dy - ray * dx, cb = rbx * dy - rby * dx, k = a.eim + b.eim + a.eiI * ca * ca + b.eiI * cb * cb;
    this.ca = ca; this.cb = cb; this.m = k > 0 ? 1 / k : 0; this.h = h;
    if (this.C < -0.01) this.p = 0;
    const P = this.p; a.vx -= a.eim * P * dx; a.vy -= a.eim * P * dy; a.w -= a.eiI * P * ca; b.vx += b.eim * P * dx; b.vy += b.eim * P * dy; b.w += b.eiI * P * cb;
  }
  solve() {
    if (this.C < -0.01) return;
    const a = this.a, b = this.b, dx = this.nx, dy = this.ny;
    const cd = dx * (b.vx - b.w * this.rby - a.vx + a.w * this.ray) + dy * (b.vy + b.w * this.rbx - a.vy - a.w * this.rax);
    const imp = -this.m * (cd + Math.min(3, (this.C > 0 ? BETA : 1) * this.C / this.h)), old = this.p;
    this.p = Math.min(0, old + imp); const d = this.p - old;
    a.vx -= a.eim * d * dx; a.vy -= a.eim * d * dy; a.w -= a.eiI * d * this.ca; b.vx += b.eim * d * dx; b.vy += b.eim * d * dy; b.w += b.eiI * d * this.cb;
  }
}

// ---------- world ----------
export class World {
  constructor(g = 16) {
    this.g = g; this.bodies = []; this.joints = []; this.grid = new Map(); this.man = new Map(); this.events = []; this.q = 0; this.cons = [];
    this.ground = new Body(STA, 0, 0, 0, []);
  }
  add(b) {
    if (b.kind !== STA) { this.bodies.push(b); return b; }
    for (const s of b.shapes) {
      const e = { b, s, q: 0, minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 };
      if (s.t === 0) { e.minx = s.wx - s.r; e.maxx = s.wx + s.r; e.miny = s.wy - s.r; e.maxy = s.wy + s.r; }
      else for (let i = 0; i < s.n; i++) { const x = s.wv[i * 2], y = s.wv[i * 2 + 1]; if (x < e.minx) e.minx = x; if (x > e.maxx) e.maxx = x; if (y < e.miny) e.miny = y; if (y > e.maxy) e.maxy = y; }
      for (let i = Math.floor(e.minx / CW); i <= Math.floor(e.maxx / CW); i++) { let c = this.grid.get(i); if (!c) this.grid.set(i, (c = [])); c.push(e); }
    }
    return b;
  }
  joint(j) { this.joints.push(j); return j; }
  pair(a, sa, b, sb, old) {
    if (!sa.on || !sb.on) return;
    let m;
    if (sa.t === 1 && sb.t === 1) m = polyPoly(sa, sb);
    else if (sa.t === 1) m = polyCirc(sa, sb);
    else if (sb.t === 1) { m = polyCirc(sb, sa); if (m) { m.nx = -m.nx; m.ny = -m.ny; } }
    else m = circCirc(sa, sb);
    if (!m) return;
    const aOn = a.eim > 0 || a.eiI > 0, bOn = b.eim > 0 || b.eiI > 0;
    if (!aOn && b.kind === DYN && b.sleep && !b.hold && a.kind !== STA && (a.waker || a.kind === KIN || a.vx * a.vx + a.vy * a.vy + a.w * a.w > 0.05)) b.wake(a);
    if (bOn && a.kind === DYN && a.sleep && !a.hold && (b.waker || b.vx * b.vx + b.vy * b.vy + b.w * b.w > 0.05)) a.wake(b);
    if (aOn && b.kind === DYN && b.sleep && !b.hold && (a.waker || a.vx * a.vx + a.vy * a.vy + a.w * a.w > 0.05)) b.wake(a);
    if (!bOn && a.kind === DYN && a.sleep && !a.hold && b.kind === KIN) a.wake();
    m.a = a; m.b = b; m.sa = sa; m.sb = sb; m.fr = Math.sqrt(sa.fr * sb.fr); m.re = Math.max(sa.re, sb.re); m.bounce = Math.max(sa.bounce, sb.bounce);
    m.key = sa.id * 1048576 + sb.id;
    const o = old.get(m.key);
    m.fresh = !o;
    if (o) for (const p of m.pts) for (const q of o.pts) if (q.id === p.id) { p.pn = q.pn; p.pt = q.pt; break; }
    this.man.set(m.key, m);
    a.nc++; b.nc++; a.cnx = -m.nx; a.cny = -m.ny; b.cnx = m.nx; b.cny = m.ny; a.cfr = b.cfr = m.fr; a.cwith = b; b.cwith = a;
    if (m.bounce > 0 && Math.abs(m.ny) > 0.8) { a.bounced = m.bounce; b.bounced = m.bounce; }
    this.cons.push(m);
  }
  step(h) {
    const B = this.bodies, g = this.g;
    for (const b of B) {
      if (b.dead) continue;
      b.nc = 0; b.cwith = null;
      if (b.kind === DYN && !b.sleep) {
        b.vy -= g * b.gs * h;
        if (b.ld) { const k = 1 / (1 + h * b.ld); b.vx *= k; b.vy *= k; }
        b.w *= 1 / (1 + h * b.ad);
        b.eim = b.im; b.eiI = b.iI;
      } else { b.eim = 0; b.eiI = 0; if (b.kind === DYN) b.vx = b.vy = b.w = 0; }
    }
    const old = this.man; this.man = new Map(); const cons = (this.cons = []);
    for (const b of B) {
      if (b.dead || b.kind !== DYN || b.sleep) continue;
      const q = ++this.q;
      for (let i = Math.floor(b.minx / CW), i1 = Math.floor(b.maxx / CW); i <= i1; i++) {
        const cell = this.grid.get(i);
        if (!cell) continue;
        for (const e of cell) {
          if (e.q === q) continue; e.q = q;
          if (e.b.dead || e.maxx < b.minx || e.minx > b.maxx || e.maxy < b.miny || e.miny > b.maxy) continue;
          for (const s of b.shapes) this.pair(e.b, e.s, b, s, old);
        }
      }
    }
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (a.dead) continue;
      const aOn = a.eim > 0;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j];
        if (b.dead || (!aOn && !(b.eim > 0))) continue;
        if (a.group && a.group === b.group) continue;
        if (a.maxx < b.minx || a.minx > b.maxx || a.maxy < b.miny || a.miny > b.maxy) continue;
        for (const sa of a.shapes) for (const sb of b.shapes) this.pair(a, sa, b, sb, old);
      }
    }
    for (const j of this.joints) {
      const a = j.a, b = j.b;
      if (a.dead || b.dead) continue;
      if (a.sleep && !a.hold && b.eim > 0 && b.vx * b.vx + b.vy * b.vy + b.w * b.w > 0.05) a.wake();
      if (b.sleep && !b.hold && a.eim > 0 && a.vx * a.vx + a.vy * a.vy + a.w * a.w > 0.05) b.wake();
    }
    const ih = 1 / h;
    for (const m of cons) {
      const a = m.a, b = m.b, nx = m.nx, ny = m.ny, tx = -ny, ty = nx;
      for (const p of m.pts) {
        const rax = (p.rax = p.x - a.x), ray = (p.ray = p.y - a.y), rbx = (p.rbx = p.x - b.x), rby = (p.rby = p.y - b.y);
        const rna = rax * ny - ray * nx, rnb = rbx * ny - rby * nx, kn = a.eim + b.eim + a.eiI * rna * rna + b.eiI * rnb * rnb;
        p.mn = kn > 0 ? 1 / kn : 0;
        const rta = rax * ty - ray * tx, rtb = rbx * ty - rby * tx, kt = a.eim + b.eim + a.eiI * rta * rta + b.eiI * rtb * rtb;
        p.mt = kt > 0 ? 1 / kt : 0;
        p.bias = Math.min(MAXPUSH, -BETA * ih * Math.min(0, p.sep + SLOP));
        const vn = (b.vx - b.w * rby - a.vx + a.w * ray) * nx + (b.vy + b.w * rbx - a.vy - a.w * rax) * ny;
        if (m.re > 0 && vn < -1) p.bias = Math.max(p.bias, -m.re * vn);
        if (m.bounce > 0 && vn < -0.6 && Math.abs(ny) > 0.8) p.bias = Math.max(p.bias, m.bounce);
        if (m.fresh && p === m.pts[0] && vn < -1.5 && this.events.length < 40) this.events.push({ x: p.x, y: p.y, v: -vn, a, b, bounce: m.bounce });
        const Px = p.pn * nx + p.pt * tx, Py = p.pn * ny + p.pt * ty;
        a.vx -= a.eim * Px; a.vy -= a.eim * Py; a.w -= a.eiI * (rax * Py - ray * Px);
        b.vx += b.eim * Px; b.vy += b.eim * Py; b.w += b.eiI * (rbx * Py - rby * Px);
      }
    }
    const J = this.joints;
    for (const j of J) if (!j.a.dead && !j.b.dead) j.pre(h);
    for (let it = 0; it < ITER; it++) {
      for (const j of J) if (!j.a.dead && !j.b.dead) j.solve();
      for (const m of cons) {
        const a = m.a, b = m.b, nx = m.nx, ny = m.ny, tx = -ny, ty = nx;
        for (const p of m.pts) {
          const rax = p.rax, ray = p.ray, rbx = p.rbx, rby = p.rby;
          let dvx = b.vx - b.w * rby - a.vx + a.w * ray, dvy = b.vy + b.w * rbx - a.vy - a.w * rax;
          let d = -p.mt * (dvx * tx + dvy * ty); const mx = m.fr * p.pn, o = p.pt;
          p.pt = Math.max(-mx, Math.min(mx, o + d)); d = p.pt - o;
          let Px = d * tx, Py = d * ty;
          a.vx -= a.eim * Px; a.vy -= a.eim * Py; a.w -= a.eiI * (rax * Py - ray * Px);
          b.vx += b.eim * Px; b.vy += b.eim * Py; b.w += b.eiI * (rbx * Py - rby * Px);
          dvx = b.vx - b.w * rby - a.vx + a.w * ray; dvy = b.vy + b.w * rbx - a.vy - a.w * rax;
          d = p.mn * (-(dvx * nx + dvy * ny) + p.bias); const on = p.pn;
          p.pn = Math.max(0, on + d); d = p.pn - on;
          Px = d * nx; Py = d * ny;
          a.vx -= a.eim * Px; a.vy -= a.eim * Py; a.w -= a.eiI * (rax * Py - ray * Px);
          b.vx += b.eim * Px; b.vy += b.eim * Py; b.w += b.eiI * (rbx * Py - rby * Px);
        }
      }
    }
    for (const b of B) {
      if (b.dead || b.kind === STA) continue;
      if (b.kind === DYN && b.sleep) continue;
      const sp = b.vx * b.vx + b.vy * b.vy;
      if (sp > 3600) { const k = 60 / Math.sqrt(sp); b.vx *= k; b.vy *= k; }
      if (b.w > 150) b.w = 150; else if (b.w < -150) b.w = -150;
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
      if (!(b.x === b.x) || !(b.y === b.y) || !(b.a === b.a)) { b.dead = true; continue; }
      b.sync();
      if (b.kind === DYN && b.canSleep) {
        if (sp + b.w * b.w * 0.3 < 0.03 && b.nc > 0) { b.st += h; if (b.st > 0.5) { b.sleep = true; b.vx = b.vy = b.w = 0; } } else b.st = 0;
      }
    }
  }
}
