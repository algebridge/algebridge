// Swing Line physics. Pure and deterministic (fixed 1/60 s steps, no randomness, no DOM), so the same
// code runs the game in the browser and proves every level solvable in Node (see gen.mjs).
//
// The swing is a plain weighted pendulum: the rope length is the distance at the moment you hook and it
// never changes, gravity is the only thing that speeds you up, and letting go keeps your exact velocity.
// There is no pump, no speed cap and no air drag. Speed comes from height, pads and hoops.
export const K = { GRAV: 2300, RANGE: 430, PR: 22, MINROPE: 70, FLOOR: 480, STEP: 1 / 60, SUB: 4, HOLD_WRONG: 0.5 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** slots[i] is the ring (0..k-1) that carries the right answer in cluster i. */
export function makeState(L, slots = []) {
  return {
    L, t: 0, mode: "ready", block: false, wrong: 0, coinsGot: 0, hooks: 0, last: -1, ev: [],
    p: { x: L.start.x, y: L.start.y, vx: 0, vy: 0 },
    rope: null,
    anchors: L.anchors.map((a, i) => ({
      i, x: a.x, y: a.y, x0: a.x, y0: a.y, vx: 0, vy: 0, mv: a.mv || null, cluster: a.cluster ?? null, slot: a.slot ?? 0,
      right: a.cluster == null ? true : (slots[a.cluster] ?? 0) === (a.slot ?? 0), broken: false, won: false,
    })),
    pads: L.pads, haz: L.haz,
    hoops: L.hoops.map((h) => ({ x: h.x, y: h.y, used: false })),
    coins: L.coins.map((c) => ({ x: c.x, y: c.y, got: false })),
  };
}

/** The ring a hold would hook right now: simply the nearest one in range. Any ring, any number of times. */
export function candidate(s) {
  const p = s.p;
  let best = null, bd = K.RANGE;
  for (const a of s.anchors) {
    if (a.broken) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

/** Below this line the try is over. It follows the level down: the lowest ring, pad or landing nearby. */
export function floorAt(s, x) {
  let f = -1e9, g = -1e9;
  for (const a of s.anchors) { const y = a.y0 + K.FLOOR; if (y > g) g = y; if (Math.abs(a.x0 - x) < 900 && y > f) f = y; }
  for (const b of s.pads) if (Math.abs(b.x - x) < 900 + b.w / 2 && b.y + 160 > f) f = b.y + 160;
  if (s.L.fy != null && Math.abs(s.L.finish - x) < 900 && s.L.fy + 220 > f) f = s.L.fy + 220;
  return f === -1e9 ? g : f;
}

function latch(s, a) {
  const p = s.p, d = Math.hypot(p.x - a.x, p.y - a.y);
  s.rope = { a, L: Math.max(d, K.MINROPE), t: 0, slack: false };
  s.hooks++;
  let sup = false;
  if (a.cluster != null && a.right && !a.won) {
    a.won = true; sup = true; s.coinsGot += 5;
    for (const o of s.anchors) if (o.cluster === a.cluster && o !== a) o.broken = true;
  }
  s.ev.push({ k: sup ? "super" : a.cluster != null && !a.right ? "badlatch" : "latch", a });
}

function release(s) {
  const a = s.rope.a;
  s.rope = null; s.last = a.i;
  s.ev.push({ k: "release", a, sup: a.cluster != null && a.right });
}

function die(s, why) { s.mode = "dead"; s.rope = null; s.ev.push({ k: "die", why }); }

/** One 1/60 s step (4 substeps inside). hold = the one button. Events for sound and particles land in s.ev. */
export function step(s, hold) {
  const p = s.p;
  s.ev.length = 0;
  if (s.mode !== "ready" && s.mode !== "play") return;
  if (!hold) s.block = false;
  if (s.mode === "ready") { if (!hold || s.block) return; s.mode = "play"; }
  if (s.rope && !hold) release(s);
  if (!s.rope && hold && !s.block) { const a = candidate(s); if (a) latch(s, a); }

  const h = K.STEP / K.SUB;
  for (let n = 0; n < K.SUB; n++) {
    s.t += h;
    for (const a of s.anchors) {
      if (!a.mv) continue;
      const w = TAU / a.mv.per, th = w * s.t + TAU * (a.mv.ph || 0), sn = Math.sin(th), cs = Math.cos(th) * w;
      a.x = a.x0 + (a.mv.ax || 0) * sn; a.y = a.y0 + (a.mv.ay || 0) * sn;
      a.vx = (a.mv.ax || 0) * cs; a.vy = (a.mv.ay || 0) * cs;
    }
    const py = p.y;
    p.vy += K.GRAV * h;
    p.x += p.vx * h; p.y += p.vy * h;
    if (s.rope) {
      // a rope, not a spring: it can go slack, and when it is tight it only stops you moving away from the ring
      const r = s.rope, a = r.a, dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
      r.t += h; r.slack = d < r.L - 2;
      if (d > r.L) {
        const nx = dx / d, ny = dy / d, vr = (p.vx - a.vx) * nx + (p.vy - a.vy) * ny;
        p.x = a.x + nx * r.L; p.y = a.y + ny * r.L;
        if (vr > 0) { p.vx -= nx * vr; p.vy -= ny * vr; }
      }
      if (a.cluster != null && !a.right && r.t >= K.HOLD_WRONG) {
        a.broken = true; s.wrong++; s.block = true; s.last = a.i;
        s.rope = null;
        s.ev.push({ k: "wrong", a });
      }
    }
    for (const b of s.pads) {
      if (p.vy > 0 && py + K.PR <= b.y + 8 && p.y + K.PR >= b.y && Math.abs(p.x - b.x) < b.w / 2 + 12) {
        // reflect, plus a kick
        p.y = b.y - K.PR;
        p.vy = -Math.max(p.vy * 1.04 + 120, 980);
        p.vx *= 1.04;
        if (Math.abs(p.vx) < 240) p.vx = 240;
        s.ev.push({ k: "pad", b });
      }
    }
    for (const q of s.haz) {
      const qx = clamp(p.x, q.x, q.x + q.w), qy = clamp(p.y, q.y, q.y + q.h);
      if ((p.x - qx) ** 2 + (p.y - qy) ** 2 < (K.PR * 0.72) ** 2) { die(s, "zap"); return; }
    }
    for (const q of s.hoops) {
      if (q.used || (p.x - q.x) ** 2 + (p.y - q.y) ** 2 > 56 * 56) continue;
      q.used = true; s.coinsGot += 3;
      p.vx += 240; p.vy -= 200;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 780) { p.vx *= 780 / sp; p.vy *= 780 / sp; }
      s.ev.push({ k: "hoop", h: q });
    }
    for (const c of s.coins) {
      if (c.got || (p.x - c.x) ** 2 + (p.y - c.y) ** 2 > 38 * 38) continue;
      c.got = true; s.coinsGot++;
      s.ev.push({ k: "coin", c });
    }
    if (p.x >= s.L.finish) { s.mode = "done"; s.rope = null; s.ev.push({ k: "finish" }); return; }
    if (p.y > floorAt(s, p.x)) { die(s, "fall"); return; }
  }
}

// ---------- autopilot: the "player" that proves a level can be cleared ----------
/**
 * pol: { rel: swing angle past straight-down at which to let go (radians), sq: how early or late it hooks
 * the next ring, grabWrong: hooks any number ring, never: never lets go }.
 * It only ever goes forward. A real player may also hook the ring they just left.
 */
export function autoHold(s, pol) {
  const p = s.p;
  if (s.mode === "ready") return true;
  if (s.rope) {
    const a = s.rope.a;
    if (pol.never || (a.cluster != null && !a.right)) return true;
    if (p.vx <= 0) return true;
    const phi = Math.atan2(p.x - a.x, p.y - a.y);
    if (phi >= pol.rel) return false;
    // the swing is running out of steam short of that angle: let go just before it stops
    return !(phi > 0.1 && p.vy < 0 && Math.hypot(p.vx, p.vy) < 170);
  }
  if (s.block) return false;
  const c = candidate(s);
  if (!c) return false;
  if (c.i === s.last) return false;
  if (c.cluster != null) { if (!c.right && !pol.grabWrong) return false; }
  else if (c.i < s.last) return false;
  const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1;
  const away = -(p.vx * dx + p.vy * dy) / d; // speed away from the ring
  if (away > 0 && d + away * 0.07 > K.RANGE) return true; // last chance
  // hook around the moment the rope would be square to the flight (sq < 0: a bit before, sq > 0: a bit after)
  return away / (Math.hypot(p.vx, p.vy) || 1) >= (pol.sq ?? 0);
}
export const POLICIES = [];
for (const rel of [0.4, 0.58, 0.76, 0.94, 1.12]) for (const sq of [-0.3, 0.25]) POLICIES.push({ rel, sq });

/** Play a level with one policy. rec (optional array) receives [x, y, onRope] every 2 steps. */
export function run(L, pol, slots, rec, maxT = 25) {
  const s = makeState(L, slots);
  let n = 0;
  while ((s.mode === "ready" || s.mode === "play") && s.t < maxT) {
    step(s, autoHold(s, pol));
    if (rec && (n++ & 1) === 0) rec.push([Math.round(s.p.x), Math.round(s.p.y), s.rope ? 1 : 0]);
  }
  return s;
}
