// Wobble League: one-button floppy ragdoll sports (Hoops, Soccer, Volleyball) for 1 or 2 players.
// Physics is our own: verlet ragdolls (11 points, distance constraints, soft "puppet string" balance)
// and one ball with impulse collisions. Everything runs inside update() so g.advance works.
import { createGame, createFx, math, sfx, PAL, FONT, clamp, lerp, rand, choose } from "../kit/kit.js";
import { drawCourt, drawDoll, drawBall, drawFixturesBack, drawFixturesFront, drawLean, drawBodyIcon, rr } from "./draw.js";

const W = 960, H = 540, FLOOR = 468, HS = 1 / 120, GR = 1500, WIN = 5;
export const TEAM = [
  { name: "Blue", c: "#2563eb", c2: "#93c5fd", dark: "#1d4ed8" },
  { name: "Amber", c: "#f59e0b", c2: "#fde68a", dark: "#d97706" },
];
const COURTS = {
  beach: { name: "Beach", grav: 1, fr: 0.6 },
  snow: { name: "Snow, slippery", grav: 1, fr: 0.012 },
  gym: { name: "Gym", grav: 1, fr: 0.6 },
  roof: { name: "Rooftop, windy", grav: 1, fr: 0.6, wind: 1 },
  moon: { name: "Moon, low gravity", grav: 0.42, fr: 0.5 },
};
const BALLS = {
  classic: { name: "Classic ball", r: 17, m: 1, e: 0.72, drag: 0.12 },
  beach: { name: "Beach ball", r: 27, m: 0.35, e: 0.8, drag: 0.9 },
  heavy: { name: "Heavy ball", r: 20, m: 3.4, e: 0.35, drag: 0.04 },
  tiny: { name: "Tiny ball", r: 10, m: 0.6, e: 0.82, drag: 0.1 },
  rugby: { name: "Rugby ball", r: 16, m: 1, e: 0.7, drag: 0.12, odd: 1 },
};
const BODIES = {
  normal: { name: "Regular bodies" },
  arms: { name: "Long arms", arm: 1.8 },
  heads: { name: "Big heads", head: 1.6 },
  legs: { name: "Short legs", leg: 0.55 },
};
const SPORTS = {
  hoops: { name: "Hoops", court: "gym", kick: 0.35, homes: [170, 360] },
  soccer: { name: "Soccer", court: "beach", kick: 1, homes: [150, 360] },
  volley: { name: "Volleyball", court: "beach", kick: 0.35, homes: [170, 370] },
};
const CATS = { court: { name: "Court", list: COURTS }, ball: { name: "Ball", list: BALLS }, body: { name: "Bodies", list: BODIES } };
const SHORT = { snow: "Snow", roof: "Rooftop", moon: "Moon" };
const ASK_T = 2.5, CARD_T = 1.9; // question, then the card choice: the whole break stays near 5 s at most
const RIVALS = [["Maya", "Leo"], ["Nora", "Sam"], ["Ivy", "Theo"], ["Zoe", "Max"]];

// ----- mode (read before the shell builds the menu) -----
const mode = { sport: "hoops", players: 1 };
try { Object.assign(mode, JSON.parse(localStorage.getItem("arcade:wobble-league:mode") || "{}")); } catch {}
if (!SPORTS[mode.sport]) mode.sport = "hoops";
if (mode.players !== 2) mode.players = 1;

const g = createGame({
  slug: "wobble-league",
  title: "Wobble League",
  tagline: "Floppy one-button sports. First to 5 wins.",
  instant: true,
  prompt: "Press any key to play",
  controls: [{ keys: "W", does: "Blue jumps" }, { keys: "↑", does: "Amber jumps" }],
  aspect: 16 / 9,
  bg: "#bfdbfe",
  onMenu(el) {
    const paint = () => {
      el.innerHTML = `<div class="wl-row">${Object.keys(SPORTS).map((k) => `<button class="wl-seg${mode.sport === k ? " on" : ""}" data-sport="${k}">${SPORTS[k].name}</button>`).join("")}</div>
        <div class="wl-row">${[1, 2].map((n) => `<button class="wl-seg${mode.players === n ? " on" : ""}" data-pl="${n}">${n === 1 ? "1 player" : "2 players"}</button>`).join("")}</div>`;
    };
    paint();
    el.onclick = (e) => {
      e.stopPropagation(); // the buttons repaint themselves, so the shell must not read this click as "play"
      const b = e.target.closest(".wl-seg");
      if (!b) return;
      if (b.dataset.sport) mode.sport = b.dataset.sport;
      if (b.dataset.pl) mode.players = Number(b.dataset.pl);
      try { localStorage.setItem("arcade:wobble-league:mode", JSON.stringify(mode)); } catch {}
      sfx.play("click");
      paint();
      resetMatch();
      g.redraw();
    };
  },
});
const c = g.canvas2d(W, H);
const { ctx } = c;

// ---------- state ----------
let sport = "hoops", players = 1, SP = SPORTS.hoops, court = COURTS.gym;
let scene = { court: "gym", ball: "classic", body: "normal" };
let dolls = [], ball = null, fixtures = [], hoops = null, goalH = [130, 130];
let score = [0, 0], phase = "serve", phT = 0, pointT = 0, time = 0;
const stats = { points: 0, loose: 0, fresh: 0, grabs: 0, shots: 0 };
let pick = null, swapped = false, swapAt = 0, lastScorer = -1, rivals = RIVALS[0], auto = false, posterOn = false, jumps = 0, picked = null;
const fx = createFx(260);
let kick = [0, 0], chipsT = 0, flash = 0, notice = { text: "", t: 0, t0: 1 };
const ai = [{ cd: 0, hold: 0, down: false, pressed: false }, { cd: 0, hold: 0, down: false, pressed: false }];
const confetti = Array.from({ length: 140 }, () => ({ life: 0 }));
const tDown = [0, 0], tPressed = [false, false], tp = new Map();
let tapAnswer = -1, tapCard = -1, sndT = 0;
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---------- ragdolls ----------
function dims(team) {
  const B = BODIES[scene.body], s = 1;
  const arm = 20 * (B.arm || 1) * s, leg = 25 * (B.leg || 1) * s, hd = B.head || 1;
  return { s, torso: 38 * s, neck: (14 + 18 * hd) * s, headR: 19 * hd * s, chestR: 15 * s, hipR: 14 * s, ua: arm, fa: arm, arm: arm * 2, th: leg, sh: leg, leg: leg * 2, handR: 9.5 * s, footR: 9 * s, stance: 13 * s };
}
function makeDoll(team, idx, x) {
  const L = dims(team), face = team ? -1 : 1, fy = FLOOR - L.footR;
  const hipY = fy - L.leg * 0.94, chY = hipY - L.torso, hdY = chY - L.neck;
  const mk = (px, py, r, m) => ({ x: px, y: py, px, py, r, m, ax: 0, ay: 0 });
  const p = [
    mk(x, hdY, L.headR, 1.4), mk(x, chY, L.chestR, 2.2), mk(x, hipY, L.hipR, 2.2),
    mk(x + face * 4, chY + L.ua, 7 * L.s, 0.7), mk(x + face * 6, chY + L.arm, L.handR, 0.7),
    mk(x - face * 4, chY + L.ua, 7 * L.s, 0.7), mk(x - face * 6, chY + L.arm, L.handR, 0.7),
    mk(x + face * (L.stance + 3), hipY + L.th * 0.9, 7 * L.s, 0.8), mk(x + face * L.stance, fy, L.footR, 1),
    mk(x - face * (L.stance - 3), hipY + L.th * 0.9, 7 * L.s, 0.8), mk(x - face * L.stance, fy, L.footR, 1),
  ];
  const cons = [[0, 1, L.neck, 1], [1, 2, L.torso, 1], [1, 3, L.ua, 1], [3, 4, L.fa, 1], [1, 5, L.ua, 1], [5, 6, L.fa, 1], [2, 7, L.th, 1], [7, 8, L.sh, 1], [2, 9, L.th, 1], [9, 10, L.sh, 1], [0, 2, L.neck + L.torso, 0.35]];
  const lo = sport === "volley" && team === 1 ? W / 2 + 8 : 6, hi = sport === "volley" && team === 0 ? W / 2 - 8 : W - 6;
  return { team, idx, face, home: x, p, cons, dim: L, lo, hi, gT: 0.1, stand: 1, sw: 9, held: false, jcd: 0, airLock: 0, airT: 0, lean: 0, ph: rand(0, 6.28), swf: rand(2.2, 3.2), seek: x, shootAt: -1, happy: 0, sq: 0, dizzy: 0 };
}
function pull(p, tx, ty, k, cc, h) {
  let ax = k * (tx - p.x) - (cc * (p.x - p.px)) / h, ay = k * (ty - p.y) - (cc * (p.y - p.py)) / h;
  const m = Math.hypot(ax, ay);
  if (m > 14000) { ax *= 14000 / m; ay *= 14000 / m; }
  p.ax += ax; p.ay += ay;
}
function stepDoll(d, h) {
  const P = d.p, L = d.dim, G = GR * court.grav, head = P[0], chest = P[1], hip = P[2];
  if (!Number.isFinite(hip.x + hip.y + head.x + head.y)) { Object.assign(d, makeDoll(d.team, d.idx, d.home)); return; }
  d.jcd -= h; d.airLock -= h; d.sw += h;
  for (const p of P) { p.ax = 0; p.ay = G; }
  d.lean = Math.sin(time * d.swf + d.ph) * 0.12 + clamp((d.seek - hip.x) / 170, -1, 1) * 0.3;
  if (d.gT > 0) {
    d.stand = Math.min(1, d.stand + h * 2.2);
    const st = 0.12 + 0.88 * d.stand, fy = FLOOR - L.footR, fx = (P[8].x + P[10].x) / 2, a = d.lean;
    pull(hip, fx + Math.sin(a) * L.leg * 0.55, fy - L.leg * 0.94 * Math.cos(a), 560 * st, 26, h);
    pull(chest, hip.x + Math.sin(a * 1.5) * L.torso, hip.y - Math.cos(a * 1.5) * L.torso, 520 * st, 24, h);
    pull(head, chest.x + Math.sin(a * 1.9) * L.neck, chest.y - L.neck, 520 * st, 24, h);
    for (let k = 0; k < 2; k++) {
      const f = P[8 + k * 2];
      f.ax += 80 * (hip.x + d.face * (k ? -1 : 1) * L.stance - f.x) * st;
      if (f.y < fy - 1) f.ay += 500 * st;
    }
    P[7].ax += d.face * 260; P[9].ax += d.face * 260;
  } else {
    const a = 70 * (hip.x + Math.sin(d.lean) * L.torso - chest.x);
    chest.ax += a; hip.ax -= a;
    head.ax += 70 * (chest.x - head.x);
  }
  // the swing: arms windmill forward and up, the front leg kicks
  if (d.sw < 0.3 || (d.held && d.sw < 2.5) || d.happy > 0) {
    for (let k = 0; k < 2; k++) {
      const t = Math.max(0, d.sw - k * 0.05);
      const al = (t < 0.3 && d.happy <= 0 ? lerp(-0.7, 2.8, easeOut(t / 0.3)) : 2.8 + Math.sin(time * 9 + k * 2 + d.ph) * 0.2) - k * 0.4;
      const sx = d.face * Math.sin(al), cy = Math.cos(al);
      pull(P[4 + k * 2], chest.x + sx * L.arm, chest.y + cy * L.arm, 820, 26, h);
      pull(P[3 + k * 2], chest.x + sx * L.ua, chest.y + cy * L.ua, 300, 14, h);
    }
  }
  if (d.sw < 0.24) {
    const be = lerp(-0.7, 1.55, d.sw / 0.24);
    pull(P[8], hip.x + d.face * Math.sin(be) * L.leg, hip.y + Math.cos(be) * L.leg, 1000 * SP.kick, 22, h);
  }
  for (const p of P) {
    let vx = (p.x - p.px) * 0.9985 + p.ax * h * h, vy = (p.y - p.py) * 0.9985 + p.ay * h * h;
    const m = Math.hypot(vx, vy);
    if (m > 12) { vx *= 12 / m; vy *= 12 / m; }
    p.px = p.x; p.py = p.y; p.x += vx; p.y += vy;
  }
  let touch = false;
  for (let it = 0; it < 5; it++) {
    for (const cn of d.cons) {
      const a = P[cn[0]], b = P[cn[1]], dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.001;
      const diff = ((dist - cn[2]) / dist) * cn[3], wa = b.m / (a.m + b.m), wb = 1 - wa;
      a.x += dx * diff * wa; a.y += dy * diff * wa; b.x -= dx * diff * wb; b.y -= dy * diff * wb;
    }
    for (const p of P) {
      if (p.y > FLOOR - p.r) { p.y = FLOOR - p.r; touch = true; }
      if (p.y < p.r) p.y = p.r;
      if (p.x < d.lo + p.r) p.x = d.lo + p.r;
      if (p.x > d.hi - p.r) p.x = d.hi - p.r;
    }
  }
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.y >= FLOOR - p.r - 0.5) p.px = p.x - (p.x - p.px) * (1 - (i === 8 || i === 10 ? court.fr : court.fr * 0.35));
  }
  if (touch && d.airLock <= 0) {
    if (d.gT <= 0 && d.airT > 0.25) { d.stand = 0.25; d.sq = 1; dust(d, 7); if (sndT <= 0) { sfx.play("land"); sndT = 0.08; } }
    d.gT = 0.1; d.airT = 0;
  } else { d.gT -= h; d.airT += h; }
}
function pressDoll(d) {
  d.sw = 0;
  if (d.gT <= 0 || d.jcd > 0) return;
  const P = d.p, chest = P[1], hip = P[2];
  const a = clamp(Math.atan2(chest.x - hip.x, hip.y - chest.y), -0.95, 0.95) + rand(-0.1, 0.1);
  const J = 600 * (court.grav < 1 ? 0.8 : 1);
  const vx = J * Math.sin(a) * 0.8, vy = -Math.max(J * Math.cos(a), J * 0.72);
  d.sq = -0.7; dust(d, 5);
  fx.burst(P[0].x - d.face * d.dim.headR * 0.6, P[0].y - d.dim.headR * 0.5, { n: 2, color: "#7dd3fc", speed: 150, angle: -Math.PI / 2 - d.face * 0.7, spread: 0.9, life: 0.45, gravity: 900, size: 3 });
  for (const p of P) { p.px -= vx * HS; p.py -= vy * HS; }
  P[0].px -= d.face * 60 * HS; P[10].px += d.face * 50 * HS;
  d.gT = 0; d.airLock = 0.14; d.jcd = 0.3; d.stand = 1; d.airT = 0.3;
}
function dollsCollide() {
  for (const a of dolls) for (const b of dolls) {
    if (a.team >= b.team) continue;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const p = a.p[i], q = b.p[j], dx = q.x - p.x, dy = q.y - p.y, R = p.r + q.r, d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 === 0) continue;
      const dist = Math.sqrt(d2), o = ((R - dist) / dist) * 0.5;
      p.x -= dx * o; p.y -= dy * o; q.x += dx * o; q.y += dy * o;
    }
  }
}

// ---------- ball ----------
function makeBall(x, y) {
  const B = BALLS[scene.ball];
  return { ...B, kind: scene.ball, x, y, vx: 0, vy: 0, ang: 0, holder: null, holdT: 0, grabCd: 0, stealCd: 0, ignoreTeam: -1, ignoreT: 0, idleT: 0, noTouch: 0, prevY: y, frozen: true };
}
function odd(b) { if (b.odd) { b.vx += rand(-1, 1) * 0.4 * Math.abs(b.vy) + rand(-40, 40); b.vy *= rand(0.75, 1.12); } }
function bump(b, speed) { if (speed > 140 && sndT <= 0) { sfx.play("bounce"); sndT = 0.07; } }
function hitCapsule(b, f) {
  const dx = f.bx - f.ax, dy = f.by - f.ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((b.x - f.ax) * dx + (b.y - f.ay) * dy) / l2, 0, 1) : 0;
  const cx = f.ax + dx * t, cy = f.ay + dy * t;
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny), R = b.r + f.r;
  if (d >= R || d === 0) return;
  nx /= d; ny /= d; b.x = cx + nx * R; b.y = cy + ny * R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + b.e * 0.9) * vn * nx; b.vy -= (1 + b.e * 0.9) * vn * ny; bump(b, -vn); odd(b); }
}
function stepBall(b, h) {
  if (b.frozen) return;
  b.grabCd -= h; b.stealCd -= h; b.ignoreT -= h; b.noTouch += h;
  if (b.holder) {
    const d = b.holder.d, p = d.p[b.holder.i];
    b.x = p.x + d.face * 3; b.y = p.y - b.r * 0.55;
    b.vx = (p.x - p.px) / h; b.vy = (p.y - p.py) / h;
    b.holdT += h; b.noTouch = 0; b.idleT = 0;
    for (const o of dolls) {
      if (o.team === d.team || b.stealCd > 0) continue;
      for (const i of [4, 6]) {
        const q = o.p[i];
        if (Math.hypot(q.x - b.x, q.y - b.y) < q.r + b.r) { b.holder = { d: o, i }; b.holdT = 0; b.stealCd = 0.8; o.shootAt = -1; sfx.play("pop"); return; }
      }
    }
    if (d.shootAt >= 0 && time >= d.shootAt) shoot(b, d, false);
    else if (b.holdT > 4.5) shoot(b, d, true);
    return;
  }
  b.prevY = b.y;
  b.vy += GR * court.grav * h;
  if (court.wind) b.vx += (Math.sin(time * 0.7) * 150 + Math.sin(time * 2.3) * 60) * h / Math.max(0.5, b.m);
  const dr = 1 - b.drag * h;
  b.vx *= dr; b.vy *= dr;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 1200) { b.vx *= 1200 / sp; b.vy *= 1200 / sp; }
  b.x += b.vx * h; b.y += b.vy * h; b.ang += (b.vx / b.r) * h;
  if (b.y > FLOOR - b.r) {
    b.y = FLOOR - b.r;
    if (b.vy > 0) { bump(b, b.vy); b.vy = -b.vy * b.e * (scene.court === "beach" ? 0.75 : 1); if (Math.abs(b.vy) < 60) b.vy = 0; else odd(b); }
    b.vx *= 1 - (scene.court === "snow" ? 0.2 : 1.4) * h;
    b.floorHit = true;
  }
  if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy = -b.vy * b.e; }
  if (b.x < b.r) { b.x = b.r; if (b.vx < 0) { bump(b, -b.vx); b.vx = -b.vx * b.e; } }
  if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 0) { bump(b, b.vx); b.vx = -b.vx * b.e; } }
  for (const f of fixtures) hitCapsule(b, f);
  for (const d of dolls) {
    if (b.ignoreT > 0 && b.ignoreTeam === d.team) continue;
    for (let i = 0; i < d.p.length; i++) {
      const p = d.p[i];
      let nx = b.x - p.x, ny = b.y - p.y;
      const R = b.r + p.r, d2 = nx * nx + ny * ny;
      if (d2 >= R * R || d2 === 0) continue;
      if (sport === "hoops" && phase === "play" && b.grabCd <= 0 && (i === 4 || i === 6)) { b.holder = { d, i }; b.holdT = 0; d.shootAt = -1; stats.grabs++; sfx.play("pop"); return; }
      const dist = Math.sqrt(d2);
      nx /= dist; ny /= dist;
      const wb = p.m / (p.m + b.m), wp = 1 - wb, ov = R - dist;
      b.x += nx * ov * wb; b.y += ny * ov * wb; p.x -= nx * ov * wp; p.y -= ny * ov * wp;
      const rel = (b.vx - (p.x - p.px) / h) * nx + (b.vy - (p.y - p.py) / h) * ny;
      if (rel < 0) {
        const j = -1.55 * rel;
        b.vx += nx * j * wb; b.vy += ny * j * wb;
        p.px += nx * j * wp * h; p.py += ny * j * wp * h;
        bump(b, j * wb);
      }
      b.noTouch = 0;
    }
  }
  b.idleT = Math.hypot(b.vx, b.vy) < 30 ? b.idleT + h : 0;
}
function shoot(b, d, weak) {
  const hp = hoops[1 - d.team], G = GR * court.grav;
  b.holder = null; d.shootAt = -1; stats.shots++;
  b.ignoreTeam = d.team; b.ignoreT = 0.3; b.grabCd = 0.4;
  if (weak) { b.vx = d.face * 120; b.vy = -420 * Math.sqrt(court.grav); return; }
  const dx = hp.cx - b.x, far = Math.abs(dx);
  const T = clamp(far / 480, 0.6, 1.25) / Math.sqrt(court.grav);
  const err = 0.02 + (far / 960) * 0.12;
  b.vx = (dx / T) * (1 + b.drag * T * 0.5) * (1 + rand(-err, err));
  b.vy = ((hp.y - 6 - b.y) / T - 0.5 * G * T) * (1 + b.drag * T * 0.3) * (1 + rand(-err, err));
  sfx.play("whoosh");
}

// ---------- scene and points ----------
function buildFixtures() {
  fixtures = []; hoops = null;
  if (sport === "soccer") {
    goalH = [132, 132];
    fixtures.push({ ax: -6, ay: FLOOR - goalH[0] - 20, bx: 56, by: FLOOR - goalH[0], r: 5 }, { ax: W + 6, ay: FLOOR - goalH[1] - 20, bx: W - 56, by: FLOOR - goalH[1], r: 5 });
  } else if (sport === "hoops") {
    const rw = [64, 64], y = 236;
    hoops = [{ side: 0, bb: 34, tip: 40 + rw[0], y, cx: 40 + rw[0] / 2, w: rw[0] }, { side: 1, bb: W - 34, tip: W - 40 - rw[1], y, cx: W - 40 - rw[1] / 2, w: rw[1] }];
    for (const hp of hoops) fixtures.push({ ax: hp.bb, ay: y - 84, bx: hp.bb, by: y + 12, r: 5 }, { ax: hp.tip, ay: y, bx: hp.tip, by: y, r: 4 });
  } else {
    fixtures.push({ ax: W / 2, ay: FLOOR - 160, bx: W / 2, by: FLOOR, r: 6 });
  }
}
function buildDolls(team) {
  const hs = SP.homes;
  dolls = dolls.filter((d) => d.team !== team);
  for (let i = 0; i < 2; i++) dolls.push(makeDoll(team, i, team ? W - hs[i] : hs[i]));
  dolls.sort((a, b) => a.team - b.team || a.idx - b.idx);
}
// Every point starts with the ball dead center, whatever court, ball or bodies are in play.
// Volleyball has a net under the middle, so the ball is tossed from the center to one front player's head,
// and the side alternates every point.
let serveDir = 1;
function placeBall() {
  ball = makeBall(W / 2, 120);
  if (sport === "volley") {
    const T = Math.sqrt((2 * (FLOOR - 150 - 120)) / (GR * court.grav));
    serveDir = -serveDir; ball.vx = (serveDir * (W / 2 - SP.homes[1] - 10)) / T * (1 + ball.drag * T * 0.5);
  }
  else ball.vx = rand(-30, 30);
}
function setScene() {
  court = COURTS[scene.court];
  buildFixtures(); buildDolls(0); buildDolls(1);
}
function resetMatch() {
  sport = mode.sport; players = mode.players; SP = SPORTS[sport];
  scene = { court: SP.court, ball: "classic", body: "normal" };
  score = [0, 0]; pick = null; picked = null; lastScorer = -1; kick = [0, 0]; chipsT = 0; flash = 0; time = 0; jumps = 0;
  serveDir = Math.random() < 0.5 ? 1 : -1; fx.clear();
  rivals = choose(RIVALS);
  for (const p of confetti) p.life = 0;
  setScene();
  placeBall();
  phase = "serve"; phT = 0; pointT = 0;
}
function nextScene() {
  const other = (obj, cur) => choose(Object.keys(obj).filter((k) => k !== cur));
  scene = { court: other(COURTS, scene.court), ball: other(BALLS, scene.ball), body: other(BODIES, scene.body) };
}
function dust(d, n) {
  const x = (d.p[8].x + d.p[10].x) / 2, col = scene.court === "snow" ? "#ffffff" : scene.court === "beach" ? "#fde9b8" : "#e2e8f0";
  for (const s of [-1, 1]) fx.burst(x + s * 10, FLOOR - 4, { n: Math.ceil(n / 2), color: col, speed: 130, angle: s > 0 ? -0.35 : Math.PI + 0.35, spread: 0.7, life: 0.42, gravity: 120, size: 5, drag: 3 });
}
/** What a press would do right now: the same math pressDoll uses, without the small random wobble. */
function launch(d) {
  const chest = d.p[1], hip = d.p[2], a = clamp(Math.atan2(chest.x - hip.x, hip.y - chest.y), -0.95, 0.95);
  const J = 600 * (court.grav < 1 ? 0.8 : 1);
  return { vx: J * Math.sin(a) * 0.8, vy: -Math.max(J * Math.cos(a), J * 0.72), G: GR * court.grav, ready: d.gT > 0 && d.jcd <= 0, strength: Math.abs(a) / 0.95 };
}
function mood(d) {
  if (d.dizzy > 0) return "dizzy";
  if (d.happy > 0 || (phase === "end" && lastScorer === d.team)) return "joy";
  if ((phase === "scored" || phase === "end") && lastScorer >= 0 && lastScorer !== d.team) return "sad";
  if (d.sw < 0.5 || (d.gT <= 0 && d.airT > 0.12)) return "effort";
  return "idle";
}
function burst(x, y, n, cols) {
  for (const p of confetti) {
    if (n <= 0) break;
    if (p.life > 0) continue;
    n--;
    p.x = x + rand(-30, 30); p.y = y + rand(-20, 20); p.vx = rand(-320, 320); p.vy = rand(-520, -120);
    p.rot = rand(0, 6.28); p.vr = rand(-9, 9); p.col = choose(cols); p.life = rand(1.2, 2.2); p.w = rand(6, 11);
  }
}
function teamLabel(t) {
  if (players === 2) return TEAM[t].name;
  return t === 0 ? "You" : `${rivals[0]} and ${rivals[1]}`;
}
function point(team) {
  if (phase !== "play") return;
  score[team]++; stats.points++; kick[team] = 1; lastScorer = team;
  sfx.play(players === 1 && team === 1 ? "wrong" : "coin");
  sfx.play("power");
  g.shake(9, 0.3);
  burst(W / 2, 150, 70, [TEAM[team].c, TEAM[team].c2, "#ffffff", PAL.pink, PAL.green]);
  for (const d of dolls) if (d.team === team) { d.happy = 1.3; fx.burst(d.p[0].x, d.p[0].y - 30, { n: 7, colors: ["#fde047", "#ffffff", TEAM[team].c2], shape: "star", speed: 240, life: 0.8, gravity: 420, size: 6 }); fx.ring(d.p[1].x, d.p[1].y, { color: TEAM[team].c2, radius: 70, life: 0.4 }); }
  fx.text(W / 2 + (team ? 46 : -46), 96, "+1", { color: "#fff", size: 30, outline: PAL.navy });
  notice = { text: players === 1 ? (team === 0 ? "You score!" : `${rivals[team === 1 ? 0 : 1]} scores!`) : `${TEAM[team].name} scores!`, t: 1.05, t0: 1.05, col: TEAM[team].c };
  phT = 0; swapped = false;
  if (score[team] >= WIN) { phase = "end"; pick = null; return; }
  phase = "scored";
  const picker = players === 1 ? 0 : 1 - team;
  const p = math.problem({ topic: "quick", level: 1 });
  const right = p.choices.find((v) => p.check(v)), wrong = p.choices.find((v) => !p.check(v));
  const ci = Math.random() < 0.5 ? 0 : 1;
  pick = { team: picker, text: p.text, opts: ci === 0 ? [right, wrong] : [wrong, right], correct: ci, t: 0, stage: "ask", done: false, result: null, chosen: -1, doneAt: 0, cards: null, sel: 1, choice: null };
}
function answerPick(i) {
  if (!pick || pick.stage !== "ask") return;
  pick.chosen = i; pick.result = i === pick.correct; pick.t = 0;
  if (pick.result) {
    // a right answer: this side picks the next round from three cards, one per category
    pick.stage = "cards"; pick.sel = 1;
    pick.cards = Object.keys(CATS).map((cat) => {
      const key = choose(Object.keys(CATS[cat].list).filter((k) => k !== scene[cat] && k !== "normal" && k !== "classic"));
      return { cat, key, name: SHORT[key] || CATS[cat].list[key].name };
    });
    sfx.play("correct");
  } else { pick.stage = "done"; pick.done = true; pick.doneAt = phT; sfx.play(i < 0 ? "tick" : "wrong"); }
}
function chooseCard(i) {
  if (!pick || pick.stage !== "cards") return;
  pick.sel = i; pick.choice = pick.cards[i]; pick.stage = "done"; pick.done = true; pick.doneAt = phT;
  sfx.play("power");
}
function swapScene() {
  swapped = true; swapAt = phT; flash = 1; chipsT = 3;
  nextScene();
  picked = pick && pick.choice ? { cat: pick.choice.cat, team: pick.team } : null;
  if (picked) scene[picked.cat] = pick.choice.key;
  setScene(); placeBall();
  sfx.play("whoosh");
}
function pickRects() {
  const cx = players === 2 ? (pick.team ? 660 : 300) : W / 2;
  return { cx, x: cx - 220, y: 104, w: 440, h: 190, b: [{ x: cx - 204, y: 196, w: 196, h: 70 }, { x: cx + 8, y: 196, w: 196, h: 70 }], c: [0, 1, 2].map((i) => ({ x: cx - 208 + i * 142, y: 150, w: 132, h: 110 })) };
}

// ---------- computer side ----------
function think(team, dt) {
  const A = ai[team];
  A.pressed = false;
  if (A.hold > 0) { A.hold -= dt; if (A.hold <= 0) A.down = false; }
  A.cd -= dt;
  if (A.cd > 0 || phase !== "play" || ball.frozen) return;
  A.cd = rand(0.07, 0.16);
  let want = 0.012;
  const mine = dolls.filter((d) => d.team === team);
  const near = (d) => Math.hypot(ball.x - d.p[1].x, ball.y - d.p[1].y);
  const toward = (d) => Math.sign(d.lean) === Math.sign(d.seek - d.p[2].x) && Math.abs(d.seek - d.p[2].x) > 60 && Math.abs(d.lean) > 0.14;
  if (sport === "hoops") {
    if (ball.holder) {
      if (ball.holder.d.team === team) want = ball.holdT > 0.35 ? 0.35 : 0;
      else want = mine.some((d) => near(d) < 150) ? 0.3 : mine.some(toward) ? 0.2 : 0.02;
    } else want = mine.some((d) => near(d) < 100) ? 0.6 : mine.some(toward) ? 0.28 : 0.03;
  } else if (sport === "soccer") {
    for (const d of mine) {
      const fr = (ball.x - d.p[2].x) * d.face, dy = ball.y - d.p[2].y;
      if (fr > -15 && fr < 85 && dy > -115 && dy < 55) want = Math.max(want, 0.75);
      else if (near(d) < 60) want = Math.max(want, 0.4);
    }
    if (want < 0.1 && mine.some(toward)) want = 0.25;
  } else {
    const own = team ? ball.x > W / 2 : ball.x < W / 2;
    if (own) {
      for (const d of mine) if (Math.abs(ball.x - d.p[2].x) < 78 && ball.y > d.p[2].y - 210 && ball.vy > -80) want = Math.max(want, 0.7);
      if (want < 0.1 && mine.some(toward)) want = 0.3;
    }
  }
  if (Math.random() < want) { A.pressed = true; A.down = true; A.hold = rand(0.12, 0.55); A.cd = rand(0.3, 0.62); }
}
function input(team) {
  if (auto || (players === 1 && team === 1)) return ai[team];
  if (players === 1) return { down: g.keys.down("KeyW", "ArrowUp", "Space") || tDown[0] + tDown[1] > 0, pressed: g.keys.pressed("KeyW", "ArrowUp", "Space") || tPressed[0] || tPressed[1] };
  return team === 0 ? { down: g.keys.down("KeyW") || tDown[0] > 0, pressed: g.keys.pressed("KeyW") || tPressed[0] } : { down: g.keys.down("ArrowUp") || tDown[1] > 0, pressed: g.keys.pressed("ArrowUp") || tPressed[1] };
}
function landingX() {
  // where the ball will come down to head height
  const G = GR * court.grav, y0 = FLOOR - 110 - ball.y;
  if (y0 <= 0) return ball.x;
  const t = (-ball.vy + Math.sqrt(Math.max(0, ball.vy * ball.vy + 2 * G * y0))) / G;
  return clamp(ball.x + ball.vx * t * (1 - Math.min(0.5, ball.drag * t * 0.4)), 20, W - 20);
}
function setSeeks() {
  const lx = landingX();
  for (const d of dolls) {
    const mid = W / 2, ownHalf = d.team ? ball.x > mid : ball.x < mid;
    let s;
    if (phase !== "play") s = d.home;
    else if (sport === "volley") s = ownHalf ? (d.idx === 1 || Math.abs(lx - d.p[2].x) < 150 ? lx : d.home) : d.home;
    else if (sport === "hoops" && ball.holder) s = ball.holder.d.team === d.team ? (ball.holder.d === d ? hoops[1 - d.team].cx : d.home) : ball.holder.d.p[2].x;
    else s = d.idx === 1 || ownHalf ? ball.x - d.face * 22 : d.home;
    d.seek = clamp(s, d.lo + 30, d.hi - 30);
  }
}

// ---------- update ----------
function physics() {
  for (let s = 0; s < 2; s++) {
    for (const d of dolls) stepDoll(d, HS);
    dollsCollide();
    stepBall(ball, HS);
    if (phase === "play") checkScore();
  }
}
function checkScore() {
  const b = ball;
  if (b.holder) return;
  if (sport === "soccer") {
    if (b.x < 50 && b.y > FLOOR - goalH[0] + 2) point(1);
    else if (b.x > W - 50 && b.y > FLOOR - goalH[1] + 2) point(0);
  } else if (sport === "hoops") {
    for (const hp of hoops) {
      const lo = Math.min(hp.bb, hp.tip) + 5, hi = Math.max(hp.bb, hp.tip);
      if (b.vy > 0 && b.prevY < hp.y && b.y >= hp.y && b.x > lo && b.x < hi) point(1 - hp.side);
    }
  } else if (b.floorHit) point(b.x < W / 2 ? 1 : 0);
  b.floorHit = false;
}
function update(dt) {
  time = g.time; phT += dt; sndT -= dt;
  for (let t = 0; t < 2; t++) { kick[t] = Math.max(0, kick[t] - dt * 1.6); }
  chipsT = Math.max(0, chipsT - dt); flash = Math.max(0, flash - dt * 3); notice.t -= dt;
  fx.update(dt);
  for (const p of confetti) if (p.life > 0) { p.life -= dt; p.vy += 700 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  setSeeks();
  for (let t = 0; t < 2; t++) {
    if (auto || (players === 1 && t === 1)) think(t, dt);
    const inp = input(t);
    for (const d of dolls) {
      if (d.team !== t) continue;
      d.happy = Math.max(0, d.happy - dt);
      d.sq *= Math.exp(-dt * 9); d.dizzy = Math.max(0, d.dizzy - dt);
      if (d.gT > 0 && d.p[0].y > d.p[2].y - d.dim.torso * 0.25) d.dizzy = 1.2;
      d.held = !!inp.down;
      if (inp.pressed && phase !== "serve") {
        const had = d.gT > 0 && d.jcd <= 0;
        pressDoll(d);
        if (had && !auto && (players === 2 || t === 0)) jumps++;
        if (had && d.idx === 0) sfx.tone(t ? 300 : 360, 0.14, { slide: t ? 560 : 680, type: "square", vol: 0.22 });
        if (ball.holder && ball.holder.d.team === t && ball.holder.d.shootAt < 0 && phase === "play") ball.holder.d.shootAt = time + 0.17;
      }
      if (d.happy > 0 && d.gT > 0 && d.jcd <= 0 && phase !== "play") pressDoll(d);
    }
  }
  physics();
  if (phase === "serve") {
    if (phT > 0.55) { phase = "play"; ball.frozen = false; pointT = 0; sfx.play("whoosh"); }
  } else if (phase === "play") {
    pointT += dt;
    if (ball.idleT > 2.2 || ball.noTouch > 9) {
      ball.idleT = 0; ball.noTouch = 0; ball.holder = null; stats.loose++;
      ball.vy = -560 * Math.sqrt(court.grav); ball.vx = clamp((W / 2 - ball.x) * 0.8, -220, 220) + rand(-120, 120);
      ball.y = Math.min(ball.y, FLOOR - ball.r - 2);
      notice = { text: "Loose ball!", t: 0.9, t0: 0.9 };
      sfx.play("pop");
    }
    // stalemate: a fresh ball in the middle, and everyone walks back to their own side (players can end up stuck past the ball)
    if (pointT > 40) { stats.fresh++; buildDolls(0); buildDolls(1); flash = 0.6; placeBall(); ball.frozen = false; pointT = 12; notice = { text: "Fresh ball!", t: 0.9, t0: 0.9 }; }
  } else if (phase === "scored") {
    const two = players === 2, mine = pick.team === 0;
    const L = !two ? g.keys.pressed("KeyA", "ArrowLeft") : mine ? g.keys.pressed("KeyA") : g.keys.pressed("ArrowLeft");
    const R = !two ? g.keys.pressed("KeyD", "ArrowRight") : mine ? g.keys.pressed("KeyD") : g.keys.pressed("ArrowRight");
    if (pick.stage === "ask") {
      pick.t += dt;
      let a = tapAnswer;
      if (L) a = 0; else if (R) a = 1;
      if (auto && a < 0 && pick.t > 0.7) a = Math.random() < 0.6 ? pick.correct : 1 - pick.correct;
      if (a >= 0) answerPick(a);
      else if (pick.t >= ASK_T) answerPick(-1);
    } else if (pick.stage === "cards") {
      pick.t += dt;
      if (L) { pick.sel = (pick.sel + 1) % 3; sfx.play("tick"); }
      if (tapCard >= 0) chooseCard(tapCard);
      else if (R && pick.t > 0.25) chooseCard(pick.sel);
      else if (auto && pick.t > 0.6) chooseCard(Math.floor(rand(0, 3)) % 3);
      else if (pick.t >= CARD_T) chooseCard(pick.sel);
    } else if (!swapped) {
      if (phT >= Math.max(0.9, pick.doneAt + (pick.choice ? 0.12 : 0.45))) swapScene();
    } else if (phT > swapAt + 0.5) { phase = "serve"; phT = 0.25; pick = null; }
  } else if (phase === "end") {
    if (phT > 0.2 && phT < 1.4 && Math.random() < 0.25) burst(rand(120, 840), rand(80, 220), 10, [TEAM[lastScorer].c, TEAM[lastScorer].c2, "#fff", PAL.pink]);
    if (phT > 1.7) {
      const w = lastScorer, won = players === 2 || w === 0;
      g.over({ score: `${score[0]} - ${score[1]}`, scoreLabel: "Final score", won, title: players === 2 ? `${TEAM[w].name} wins!` : w === 0 ? "You win!" : `${rivals[0]} and ${rivals[1]} win`, lines: [`${SP.name}. First to ${WIN}.`] });
    }
  }
  tapAnswer = -1; tapCard = -1; tPressed[0] = tPressed[1] = false;
}

// ---------- render ----------
function text(s, x, y, size, col, align = "center", weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function chip(s, cx, y, bg, fg, size = 15) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(s).width + size * 1.5;
  rr(ctx, cx - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.navy; ctx.stroke();
  text(s, cx, y + 1, size, fg, "center", 800);
  return w;
}
function drawScore() {
  for (let t = 0; t < 2; t++) {
    const x = W / 2 + (t ? 46 : -46), k = kick[t];
    ctx.save();
    ctx.translate(x, 46);
    ctx.rotate(Math.sin(time * 2.6 + t * 2) * 0.05 + Math.sin(time * 34) * 0.28 * k);
    ctx.scale(1 + k * 0.55, 1 + k * 0.55 + Math.sin(time * 5 + t) * 0.025);
    rr(ctx, -34, -30, 68, 60, 18); ctx.fillStyle = TEAM[t].c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = PAL.navy; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.22)"; rr(ctx, -27, -24, 54, 16, 8); ctx.fill();
    text(String(score[t]), 0, 3, 42, "#fff");
    ctx.restore();
    const nx = W / 2 + (t ? 96 : -96);
    ctx.font = `800 15px ${FONT}`;
    const label = teamLabel(t) + (players === 2 ? (t ? "  ↑" : "  W") : "");
    const w = ctx.measureText(label).width + 22;
    chip(label, nx + (t ? w / 2 : -w / 2), 36, "#fff", PAL.navy);
  }
  for (let t = 0; t < 2; t++) for (let i = 0; i < WIN; i++) {
    ctx.beginPath(); ctx.arc(W / 2 + (t ? 20 + i * 13 : -20 - i * 13), 88, 4.5, 0, 7);
    ctx.fillStyle = i < score[t] ? TEAM[t].c : "rgba(255,255,255,0.75)"; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.navy; ctx.stroke();
  }
}
function drawPick() {
  const R = pickRects(), T = TEAM[pick.team], pop = Math.min(1, phT / 0.18), cards = pick.stage === "cards" || !!pick.choice;
  ctx.save();
  ctx.translate(R.cx, R.y + R.h / 2); ctx.scale(0.8 + 0.2 * easeOut(pop), 0.8 + 0.2 * easeOut(pop)); ctx.translate(-R.cx, -(R.y + R.h / 2));
  ctx.globalAlpha = pop;
  rr(ctx, R.x, R.y + 6, R.w, R.h, 24); ctx.fillStyle = "rgba(15,23,42,0.25)"; ctx.fill();
  rr(ctx, R.x, R.y, R.w, R.h, 24); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = PAL.navy; ctx.stroke();
  const head = cards ? "You pick the next round" : "Right answer picks the round";
  ctx.font = `800 14px ${FONT}`;
  const hw = ctx.measureText(players === 2 ? `${T.name}: ${head}` : head).width + 26;
  rr(ctx, R.x + 14, R.y + 12, hw, 26, 13); ctx.fillStyle = T.c; ctx.fill();
  text(players === 2 ? `${T.name}: ${head}` : head, R.x + 14 + hw / 2, R.y + 26, 14, "#fff", "center", 800);
  // timer
  const tx = R.x + 24 + hw, tw = R.x + R.w - 16 - tx;
  rr(ctx, tx, R.y + 19, tw, 12, 6); ctx.fillStyle = PAL.cloud; ctx.fill();
  const f = pick.done ? 0 : clamp(1 - pick.t / (pick.stage === "cards" ? CARD_T : ASK_T), 0, 1);
  if (f > 0.01) { rr(ctx, tx, R.y + 19, tw * f, 12, 6); ctx.fillStyle = PAL.amber; ctx.fill(); }
  const two = players === 2 && pick.team === 1, keys = two ? ["←", "→"] : ["A", "D"];
  if (cards) {
    for (let i = 0; i < 3; i++) {
      const b = R.c[i], cd = pick.cards[i], on = i === pick.sel, lift = on ? -4 : 0, gone = pick.choice && !on;
      ctx.save(); ctx.globalAlpha = pop * (gone ? 0.35 : 1); ctx.translate(0, lift + (on ? Math.sin(time * 9) * 1.2 : 0));
      rr(ctx, b.x, b.y + 5, b.w, b.h, 16); ctx.fillStyle = on ? "#b45309" : "#93c5fd"; ctx.fill();
      rr(ctx, b.x, b.y, b.w, b.h, 16); ctx.fillStyle = on ? "#fef3c7" : "#eff6ff"; ctx.fill(); ctx.lineWidth = on ? 4 : 3; ctx.strokeStyle = on ? "#f59e0b" : "#93c5fd"; ctx.stroke();
      text(CATS[cd.cat].name.toUpperCase(), b.x + b.w / 2, b.y + 14, 11, on ? "#b45309" : "#3b82f6", "center", 800);
      const ix = b.x + b.w / 2, iy = b.y + 54;
      if (cd.cat === "court") {
        ctx.save(); rr(ctx, ix - 48, iy - 28, 96, 54, 9); ctx.clip();
        ctx.translate(ix - 48, iy - 28); ctx.scale(0.1, 0.1); drawCourt(ctx, cd.key, time, W, H, FLOOR); ctx.restore();
        rr(ctx, ix - 48, iy - 28, 96, 54, 9); ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.navy; ctx.stroke();
      } else if (cd.cat === "ball") { const B = BALLS[cd.key]; drawBall(ctx, { kind: cd.key, r: clamp(B.r, 13, 24), x: ix, y: iy, ang: 0.5 }); }
      else drawBodyIcon(ctx, ix, iy - 2, BODIES[cd.key], T.c);
      text(cd.name, b.x + b.w / 2, b.y + b.h - 15, 15, PAL.navy, "center", 800);
      ctx.restore();
    }
    const hy = R.y + R.h - 14;
    if (pick.choice) text("Locked in!", R.cx, hy, 15, "#047857", "center", 800);
    else {
      const key = (k, x) => { rr(ctx, x, hy - 11, 24, 22, 6); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#93c5fd"; ctx.stroke(); text(k, x + 12, hy + 1, 13, "#1d4ed8"); };
      key(keys[0], R.cx - 112); text("next", R.cx - 82, hy + 1, 13, PAL.navy, "left", 800);
      key(keys[1], R.cx - 30); text("pick, or tap a card", R.cx, hy + 1, 13, PAL.navy, "left", 800);
    }
  } else {
    text(pick.done ? (pick.chosen < 0 ? "Too slow. Random round." : "Not this time. Random round.") : pick.text, R.cx, R.y + 66, pick.done ? 26 : 38, pick.done ? "#b91c1c" : PAL.ink);
    for (let i = 0; i < 2; i++) {
      const b = R.b[i];
      let bg = "#eff6ff", bd = "#93c5fd", fg = PAL.navy;
      if (pick.done) { if (i === pick.correct) { bg = "#10b981"; bd = "#047857"; fg = "#fff"; } else if (i === pick.chosen) { bg = "#ef4444"; bd = "#b91c1c"; fg = "#fff"; } }
      rr(ctx, b.x, b.y + 5, b.w, b.h, 18); ctx.fillStyle = bd; ctx.fill();
      rr(ctx, b.x, b.y, b.w, b.h, 18); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = bd; ctx.stroke();
      text(String(pick.opts[i]), b.x + b.w / 2 + 12, b.y + b.h / 2 + 2, 36, fg);
      rr(ctx, b.x + 12, b.y + b.h / 2 - 15, 30, 30, 8); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = bd; ctx.stroke();
      text(keys[i], b.x + 27, b.y + b.h / 2 + 1, 16, "#1d4ed8");
    }
  }
  ctx.restore();
}
const human = (team) => !auto && (players === 2 || team === 0);
function world(lean) {
  drawCourt(ctx, scene.court, time, W, H, FLOOR);
  drawFixturesBack(ctx, { sport, hoops, goalH, W, FLOOR });
  if (lean) for (const d of dolls) if (human(d.team)) drawLean(ctx, d, TEAM[d.team], launch(d));
  const order = [...dolls].sort((a, b) => a.idx - b.idx);
  for (const d of order) drawDoll(ctx, d, TEAM[d.team], ball, time, { sport, mood: mood(d) });
  if (ball) drawBall(ctx, ball);
  drawFixturesFront(ctx, { sport, hoops, goalH, W, FLOOR });
  fx.draw(ctx);
  for (const p of confetti) if (p.life > 0) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); ctx.restore();
  }
}
function render() {
  if (posterOn) return poster();
  ctx.save();
  ctx.translate(g.shakeX, g.shakeY);
  world(phase === "serve" || phase === "play");
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
  if (g.state === "menu") return;
  drawScore();
  if (phase === "serve" && g.state === "playing") text("Ready", ball.x, ball.y - ball.r - 18, 20, PAL.navy);
  if (jumps < 3 && !auto && (phase === "play" || phase === "serve") && score[0] + score[1] === 0) {
    ctx.font = `900 20px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = PAL.navy; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeText("Press to jump where you lean", W / 2, 132); ctx.fillStyle = "#fff"; ctx.fillText("Press to jump where you lean", W / 2, 132);
  }
  if (notice.t > 0) {
    const k = clamp((notice.t0 - notice.t) / 0.15, 0, 1);
    ctx.save(); ctx.translate(W / 2, pick ? 340 : 170); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); ctx.rotate(Math.sin(time * 9) * 0.03);
    ctx.font = `900 54px ${FONT}`; ctx.lineWidth = 12; ctx.strokeStyle = PAL.navy; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeText(notice.text, 0, 0); ctx.fillStyle = "#fff"; ctx.fillText(notice.text, 0, 0);
    ctx.restore();
  }
  if (pick && phase === "scored") drawPick();
  if (chipsT > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, chipsT * 2);
    const cats = ["court", "ball", "body"], names = cats.map((k) => CATS[k].list[scene[k]].name);
    ctx.font = `800 16px ${FONT}`;
    const ws = names.map((n) => ctx.measureText(n).width + 24), tot = ws.reduce((a, b) => a + b, 0) + 16;
    let x = W / 2 - tot / 2;
    const y = pick ? 322 : 126;
    names.forEach((n, i) => {
      const mine = picked && picked.cat === cats[i];
      chip(n, x + ws[i] / 2, y, mine ? TEAM[picked.team].c : i === 0 ? "#dbeafe" : i === 1 ? "#fef3c7" : "#fce7f3", mine ? "#fff" : PAL.navy, 16);
      if (mine) text(players === 2 ? `${TEAM[picked.team].name} picked` : "Your pick", x + ws[i] / 2, y + 27, 13, PAL.navy, "center", 800);
      x += ws[i] + 8;
    });
    ctx.restore();
  }
}
// One composed hero shot for the tile: no HUD, no text, top of the frame calm.
function pose(d, x, y, o) {
  const P = d.p, L = d.dim, f = d.face, set = (i, px, py) => { P[i].x = P[i].px = px; P[i].y = P[i].py = py; };
  const dir = (a, l) => [Math.sin(a) * l, -Math.cos(a) * l];
  const put = (i, from, a, l) => { const v = dir(a, l); set(i, P[from].x + v[0], P[from].y + v[1]); };
  set(2, x, y); put(1, 2, o.torso, L.torso); put(0, 1, o.head, L.neck);
  put(3, 1, o.arm1[0] * f, L.ua); put(4, 3, o.arm1[1] * f, L.fa); put(5, 1, o.arm2[0] * f, L.ua); put(6, 5, o.arm2[1] * f, L.fa);
  put(7, 2, o.leg1[0] * f, L.th); put(8, 7, o.leg1[1] * f, L.sh); put(9, 2, o.leg2[0] * f, L.th); put(10, 9, o.leg2[1] * f, L.sh);
  d.sw = o.sw ?? 9; d.happy = o.happy || 0; d.dizzy = o.dizzy || 0; d.sq = 0; d.gT = 0; d.airT = 1;
}
function poster() {
  if (c.canvas.height !== c.canvas.width) c.canvas.height = c.canvas.width;
  const k = c.canvas.width / 960, z = 2;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = "#7dd3fc"; ctx.fillRect(0, 0, 960, 960);
  ctx.save(); ctx.scale(z, z); ctx.translate(-190, -18);
  world(false);
  ctx.restore();
  const gr = ctx.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, "rgba(125,211,252,1)"); gr.addColorStop(0.6, "rgba(125,211,252,0.9)"); gr.addColorStop(1, "rgba(125,211,252,0)");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 960, 300);
}

// ---------- input and boot ----------
c.canvas.addEventListener("pointerdown", (e) => {
  if (g.state !== "playing") return;
  const r = c.canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  if (pick && !pick.done) {
    const R = pickRects(), i = R.b.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y - 6 && y <= b.y + b.h + 10);
    if (pick.stage === "ask" && i >= 0) { tapAnswer = i; return; }
    const j = R.c.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y - 6 && y <= b.y + b.h + 10);
    if (pick.stage === "cards" && j >= 0) { tapCard = j; return; }
    if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) return;
  }
  const side = x < W / 2 ? 0 : 1;
  tp.set(e.pointerId, side); tDown[side]++; tPressed[side] = true;
});
const pointerUp = (e) => { const s = tp.get(e.pointerId); if (s != null) { tp.delete(e.pointerId); tDown[s] = Math.max(0, tDown[s] - 1); } };
addEventListener("pointerup", pointerUp);
addEventListener("pointercancel", pointerUp);

g.onStart = () => {
  if (posterOn) { posterOn = false; g.stage.style.setProperty("--ak-aspect", String(16 / 9)); c.fit(); }
  tp.clear(); tDown[0] = tDown[1] = 0; resetMatch();
};
g.answerOpen = (right = true) => { if (!pick || pick.stage !== "ask") return false; answerPick(right ? pick.correct : 1 - pick.correct); return true; };
g.debug = {
  get state() { return { sport, players, phase, score: [...score], scene: { ...scene }, picked, phT: Math.round(phT * 100) / 100, pick: pick && { team: pick.team, stage: pick.stage, done: pick.done, result: pick.result, sel: pick.sel, cards: pick.cards && pick.cards.map((cd) => cd.cat + ":" + cd.key), choice: pick.choice && pick.choice.key }, ball: ball && { x: Math.round(ball.x), y: Math.round(ball.y), held: !!ball.holder }, dolls: dolls.map((d) => ({ team: d.team, x: Math.round(d.p[2].x), y: Math.round(d.p[2].y), headY: Math.round(d.p[0].y) })) }; },
  get dolls() { return dolls; }, get ball() { return ball; },
  setMode(s, p) { mode.sport = s; mode.players = p; },
  setAuto(v) { auto = !!v; },
  setScene(s) { Object.assign(scene, s); setScene(); placeBall(); ball.frozen = false; },
  pickCard(i) { if (!pick || pick.stage !== "cards") return false; chooseCard(i); return true; },
  /** Every court, ball and body combination: how far the fresh ball is from the middle, and whether the two teams mirror each other. */
  spawnCheck() {
    const keep = { ...scene }, keepSport = mode.sport;
    let n = 0, off = 0, mirror = 0, maxVx = 0;
    for (const sp of Object.keys(SPORTS)) {
      mode.sport = sp; resetMatch();
      for (const co of Object.keys(COURTS)) for (const ba of Object.keys(BALLS)) for (const bo of Object.keys(BODIES)) {
        scene = { court: co, ball: ba, body: bo }; setScene(); placeBall(); n++;
        off = Math.max(off, Math.abs(ball.x - W / 2)); maxVx = Math.max(maxVx, Math.abs(ball.vx));
        for (let i = 0; i < 2; i++) for (let j = 0; j < 11; j++) mirror = Math.max(mirror, Math.abs(dolls[i].p[j].x + dolls[2 + i].p[j].x - W), Math.abs(dolls[i].p[j].y - dolls[2 + i].p[j].y));
      }
    }
    mode.sport = keepSport; resetMatch(); Object.assign(scene, keep);
    return { combos: n, ballOffCenter: off, teamMirrorError: Math.round(mirror * 100) / 100, maxServeVx: Math.round(maxVx) };
  },
  poster() {
    mode.sport = "volley"; resetMatch(); auto = false; posterOn = true; g.closePanel?.();
    const [b0, b1, a0, a1] = dolls;
    pose(b1, 400, 300, { torso: 0.22, head: -0.15, arm1: [1.05, 0.5], arm2: [-1.9, -2.4], leg1: [2.3, 3.4], leg2: [3.3, 3.9], sw: 0.2 });
    pose(b0, 268, 409, { torso: 0.1, head: 0.05, arm1: [2.2, 0.6], arm2: [-2.2, -0.6], leg1: [2.95, 3.14], leg2: [3.35, 3.14], happy: 1 });
    pose(a1, 590, 438, { torso: -1.25, head: -1.45, arm1: [-2.6, -1.6], arm2: [0.4, 1.3], leg1: [1.75, 1.2], leg2: [2.3, 1.7], dizzy: 9 });
    pose(a0, 900, 398, { torso: 0, head: 0, arm1: [2.6, 2.9], arm2: [-2.6, -2.9], leg1: [2.95, 3.14], leg2: [3.35, 3.14] });
    ball.x = 457; ball.y = 212; ball.ang = 0.5; phase = "play"; lastScorer = -1; fx.clear();
    fx.burst(446, 226, { n: 8, color: "#ffffff", shape: "spark", speed: 160, life: 9, gravity: 0, size: 4 });
    g.stage.style.setProperty("--ak-aspect", "1");
    const n = Math.round(Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2));
    c.canvas.width = n; c.canvas.height = n;
    g.redraw(); setTimeout(() => g.redraw(), 150);
    return true;
  },
  point, stats,
  /** worst stretch of any limb and whether anything left the court: a physics health check */
  health() {
    let stretch = 0, out = 0;
    for (const d of dolls) { for (const cn of d.cons) if (cn[3] === 1) stretch = Math.max(stretch, Math.abs(Math.hypot(d.p[cn[0]].x - d.p[cn[1]].x, d.p[cn[0]].y - d.p[cn[1]].y) - cn[2])); for (const p of d.p) if (!(p.x > -5 && p.x < W + 5 && p.y > -5 && p.y < FLOOR + 5)) out++; }
    if (!(ball.x > -5 && ball.x < W + 5 && ball.y > -5 && ball.y < FLOOR + 5)) out++;
    return { stretch: Math.round(stretch * 10) / 10, out };
  },
};
resetMatch();
g.loop(update, render);
