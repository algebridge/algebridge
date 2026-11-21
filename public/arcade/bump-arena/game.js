// Bump Arena: round jelly characters bump each other off platforms. Last one standing wins the round.
// Our own small physics: circles against rounded boxes and capsules, impulse bumps with mass.
// A quick problem before each round can earn a perk. Everything runs inside update() so g.advance works.
import { createGame, math, sfx, PAL, FONT, clamp, lerp, rand, choose } from "../kit/kit.js";

const W = 960, H = 540, R = 22, WIN = 5, NAVY = "#1e3a8a", INK = "#0f172a";
const NAMES = ["Maya", "Leo", "Nora", "Sam", "Ivy", "Theo", "Zoe", "Max", "Ruby", "Eli"];
const COLORS = ["#2563eb", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#14b8a6"];
const SHINE = ["#60a5fa", "#fcd34d", "#f9a8d4", "#6ee7b7", "#c4b5fd", "#5eead4"];
const PERKS = { double: "Double Jump", anchor: "Anchor", dash: "Dash", bubble: "Bubble" };
const ARENA_NAMES = ["Flat Slab", "See-Saw", "Shrinking Slab", "Moving Platforms", "The Bowl", "Ice Rink", "Two Towers", "Conveyor", "Bouncy Walls", "Crumbling Tiles"];

const mode = { players: 1 };
try { Object.assign(mode, JSON.parse(localStorage.getItem("arcade:bump-arena:mode") || "{}")); } catch {}
if (mode.players !== 2) mode.players = 1;

const g = createGame({
  slug: "bump-arena",
  title: "Bump Arena",
  tagline: "Bump everyone off. Last one standing wins the round.",
  how: ["Answer before each round to earn a perk. First to 5 rounds wins."],
  controls: [{ keys: "← → ↑", does: "Move and jump" }, { keys: "Space", does: "Hold to go heavy" }, { keys: "1 2 3 4", does: "Answer" }],
  aspect: 16 / 9,
  bg: "#c7e9ff",
  onMenu(el) {
    const paint = () => {
      el.innerHTML = `<div class="ba-row">${[1, 2].map((n) => `<button class="ba-seg${mode.players === n ? " on" : ""}" data-pl="${n}">${n === 1 ? "1 player" : "2 players"}</button>`).join("")}</div>
      <p class="ba-note">${mode.players === 2 ? "Blue: W A D, Shift heavy, answer 1 to 4. Amber: arrows, / heavy, answer 7 8 9 0." : "Arrows or W A D. Hold Space or X to go heavy."}</p>`;
    };
    paint();
    el.onclick = (e) => {
      const b = e.target.closest(".ba-seg");
      if (!b) return;
      mode.players = Number(b.dataset.pl);
      try { localStorage.setItem("arcade:bump-arena:mode", JSON.stringify(mode)); } catch {}
      sfx.play("click"); paint(); resetMatch(); g.redraw();
    };
  },
});
const c = g.canvas2d(W, H);
const { ctx } = c;

// ---------- state ----------
let chars = [], arena = null, arenaIdx = 0, round = 0, phase = "ask", phT = 0, fightT = 0, time = 0;
let q = null, kb = 1, slow = 0, slowWho = null, roundWinner = null, auto = false, suddenSaid = false, tapAns = -1;
let notice = { text: "", t: 0, t0: 1 };
const log = [], koLog = [];
let peace = false;
const stars = Array.from({ length: 90 }, () => ({ life: 0 }));

// ---------- arenas ----------
const box = (x, y, w, h, o = {}) => ({ type: "rect", x, y, w, h, vx: 0, vy: 0, alive: true, ...o });
function buildArena(i) {
  const A = { idx: i, name: ARENA_NAMES[i], solids: [], t: 0, spawns: [270, 410, 550, 690], update() {} };
  if (i === 0) A.solids.push(box(170, 380, 620, 46));
  else if (i === 1) {
    const s = { type: "cap", ax: 190, ay: 390, bx: 770, by: 390, r: 14, cx: 480, cy: 390, len: 290, a: 0, av: 0, alive: true, seesaw: true };
    A.solids.push(s);
    A.update = (dt) => {
      let tq = 0;
      for (const ch of chars) if (ch.alive && ch.ground === s) tq += ch.mass * (ch.x - s.cx);
      s.av += (tq * 0.0055 - s.a * 5 - s.av * 2.2) * dt;
      s.a = clamp(s.a + s.av * dt, -0.36, 0.36);
      if (Math.abs(s.a) >= 0.36) s.av = 0;
      s.ax = s.cx - Math.cos(s.a) * s.len; s.ay = s.cy - Math.sin(s.a) * s.len; s.bx = s.cx + Math.cos(s.a) * s.len; s.by = s.cy + Math.sin(s.a) * s.len;
    };
  } else if (i === 2) {
    const s = box(150, 380, 660, 46);
    A.solids.push(s);
    A.update = () => { const w = lerp(660, 190, clamp((A.t - 3) / 26, 0, 1)); s.x = 480 - w / 2; s.w = w; };
  } else if (i === 3) {
    const a = box(150, 390, 200, 34), b = box(380, 330, 200, 34), d = box(610, 390, 200, 34);
    A.solids.push(a, b, d); A.spawns = [230, 430, 530, 730];
    A.update = () => {
      const t = A.t, sx = Math.sin(t * 0.8) * 80, cx = Math.cos(t * 0.8) * 64;
      a.x = 150 + sx; a.vx = cx; d.x = 610 - sx; d.vx = -cx;
      b.y = 330 + Math.sin(t * 1.1) * 46; b.vy = Math.cos(t * 1.1) * 50.6;
    };
  } else if (i === 4) {
    const n = 12, pts = [];
    for (let k = 0; k <= n; k++) { const u = (k / n) * 2 - 1; pts.push([480 + u * 300, 408 - 64 * u ** 4 + (Math.abs(u) > 0.99 ? 6 : 0)]); }
    for (let k = 0; k < n; k++) A.solids.push({ type: "cap", ax: pts[k][0], ay: pts[k][1], bx: pts[k + 1][0], by: pts[k + 1][1], r: 13, alive: true, bowl: true });
    A.spawns = [330, 430, 530, 630];
  } else if (i === 5) A.solids.push(box(150, 380, 660, 46, { ice: true }));
  else if (i === 6) { A.solids.push(box(160, 372, 250, 240), box(550, 372, 250, 240)); A.spawns = [220, 340, 620, 740]; }
  else if (i === 7) {
    // the belt stands still until the fight starts (it used to run during the question and carry everyone off the right side)
    const s = box(160, 380, 640, 46, { belt: true, conv: 0, dir: 1 });
    A.solids.push(s);
    A.update = (dt) => {
      const k = Math.floor(A.t / 6) % 2 ? -1 : 1;
      if (s.dir !== k) { s.dir = k; sfx.play("whoosh"); }
      const want = phase === "fight" && A.t > 1.2 ? k * 90 : 0;
      s.conv += clamp(want - s.conv, -160 * dt, 160 * dt);
    };
  } else if (i === 8) A.solids.push(box(250, 384, 460, 44), box(84, 150, 30, 290, { bouncy: true }), box(846, 150, 30, 290, { bouncy: true }));
  else {
    for (let k = 0; k < 10; k++) A.solids.push(box(170 + k * 62, 380, 62, 40, { tile: true, stood: 0, fall: 0, k }));
    A.update = (dt) => {
      for (const s of A.solids) {
        if (!s.alive) continue;
        if (phase === "fight" && chars.some((ch) => ch.alive && ch.ground === s && ch.onGround)) s.stood += dt;
        if (s.stood > 1.2 || s.fall > 0) { if (s.fall === 0) sfx.play("tick"); s.fall += dt; if (s.fall > 0.5) { s.alive = false; sfx.play("crash"); burst(s.x + 31, s.y + 10, 6, ["#fcd34d", "#fff"]); } }
      }
    };
  }
  return A;
}
/** Top of the ground under x, or null. The computer players use this to see edges. */
function groundY(x, fromY = -999) {
  let best = null;
  for (const s of arena.solids) {
    if (!s.alive || s.bouncy) continue;
    let y = null;
    if (s.type === "rect") { if (x >= s.x - 4 && x <= s.x + s.w + 4) y = s.y; }
    else { const lo = Math.min(s.ax, s.bx), hi = Math.max(s.ax, s.bx); if (x >= lo - s.r * 0.5 && x <= hi + s.r * 0.5 && hi > lo) y = lerp(s.ay, s.by, clamp((x - s.ax) / (s.bx - s.ax), 0, 1)) - s.r; }
    if (y != null && y > fromY && (best == null || y < best)) best = y;
  }
  return best;
}

// ---------- characters ----------
function makeChars() {
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  chars = [];
  for (let i = 0; i < 4; i++) {
    const human = i < mode.players ? i : -1;
    chars.push({ i, human, name: human >= 0 ? (mode.players === 1 ? "You" : human ? "Amber" : "Blue") : names[i], color: COLORS[i], shine: SHINE[i], hat: i, wins: 0, skill: rand(0.55, 0.9), x: 0, y: 0, vx: 0, vy: 0, ai: {} });
  }
}
function placeChars() {
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  chars.forEach((ch, k) => {
    const x = arena.spawns[order[k]];
    Object.assign(ch, { x, y: (groundY(x) ?? 380) - R - 1, vx: 0, vy: 0, alive: true, onGround: false, ground: null, gvx: 0, coyote: 0, jbuf: 0, heavy: false, mass: 1, ghost: false, perk: null, perkPop: 0, airJumps: 0, bubble: false, inv: 0, dashCd: 0, dashT: 0, tapDir: 0, tapT: 9, prevMx: 0, sq: 0, sqa: 0, face: x < 480 ? 1 : -1, hurtT: 0, happyT: 0, hitT: -9, lastHit: null, outT: 0, ans: null, right: null, koT: 0,
      ai: { tick: rand(0, 0.2), mx: 0, jump: false, heavyT: 0, wander: 0, wdir: 0, dash: false } });
  });
}
function burst(x, y, n, cols, sp = 260) {
  for (const p of stars) {
    if (n <= 0) break;
    if (p.life > 0) continue;
    n--;
    const a = rand(0, 6.28), v = rand(sp * 0.4, sp);
    p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 60; p.rot = rand(0, 6); p.vr = rand(-8, 8); p.col = choose(cols); p.life = p.l0 = rand(0.35, 0.7); p.s = rand(5, 10);
  }
}

function controls(ch) {
  if (ch.human < 0 || auto) return think(ch);
  const k = g.keys;
  if (mode.players === 1) return { mx: k.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]), jump: k.pressed("ArrowUp", "KeyW"), heavy: k.down("Space", "KeyX", "ArrowDown", "KeyS"), L: k.pressed("ArrowLeft", "KeyA"), Rt: k.pressed("ArrowRight", "KeyD") };
  if (ch.human === 0) return { mx: k.axis(["KeyA"], ["KeyD"]), jump: k.pressed("KeyW"), heavy: k.down("ShiftLeft", "KeyS"), L: k.pressed("KeyA"), Rt: k.pressed("KeyD") };
  return { mx: k.axis(["ArrowLeft"], ["ArrowRight"]), jump: k.pressed("ArrowUp"), heavy: k.down("Slash", "ShiftRight", "ArrowDown"), L: k.pressed("ArrowLeft"), Rt: k.pressed("ArrowRight") };
}

// ---------- computer players ----------
function edgeDist(ch, dir) {
  for (let d = 12; d <= 150; d += 12) { const gy = groundY(ch.x + dir * d, ch.y - 60); if (gy == null || gy > ch.y + 130) return d; }
  return 999;
}
function think(ch) {
  if (peace) return { mx: 0, jump: false, heavy: false, L: false, Rt: false };
  const A = ch.ai, out = { mx: A.mx, jump: false, heavy: A.heavyT > 0, L: false, Rt: false };
  A.heavyT -= 1 / 60; A.tick -= 1 / 60; A.wander -= 1 / 60;
  if (A.tick > 0) return out;
  A.tick = rand(0.08, 0.2) + (1 - ch.skill) * 0.12;
  const below = groundY(ch.x, ch.y - 30);
  // off the edge: get back
  if (!ch.onGround && (below == null || below > ch.y + 160)) {
    let bx = 480, bd = 1e9;
    const px = ch.x + ch.vx * 0.35; // where the jump is carrying it: keep going across a gap, do not turn back half way
    for (const s of arena.solids) {
      if (!s.alive || s.bouncy) continue;
      const lo = s.type === "rect" ? s.x + 18 : Math.min(s.ax, s.bx) + 10, hi = s.type === "rect" ? s.x + s.w - 18 : Math.max(s.ax, s.bx) - 10;
      const tx = clamp(ch.x, lo, hi), d = Math.abs(clamp(px, lo, hi) - px);
      if (d < bd) { bd = d; bx = tx; }
    }
    A.mx = Math.sign(bx - ch.x); A.heavyT = 0;
    out.mx = A.mx; out.heavy = false;
    out.jump = ch.vy > -80 && (ch.coyote > 0 || ch.airJumps > 0) && Math.random() < ch.skill;
    return out;
  }
  let tg = null, td = 1e9;
  for (const o of chars) {
    if (o === ch || !o.alive) continue;
    const og = groundY(o.x, o.y - 40);
    if (og == null && o.y > ch.y + 30) continue;
    const d = Math.hypot(o.x - ch.x, o.y - ch.y) * (o === A.last ? 0.8 : 1);
    if (d < td) { td = d; tg = o; }
  }
  A.last = tg;
  let mx = 0;
  if (A.wander > 0) mx = A.wdir;
  else if (tg) {
    const dx = tg.x - ch.x;
    mx = Math.abs(dx) > 14 ? Math.sign(dx) : 0;
    if (Math.random() < 0.06) { A.wander = rand(0.25, 0.6); A.wdir = choose([-1, 1, 0]); }
    // brace or ram
    const closing = (ch.vx - tg.vx) * Math.sign(dx);
    if (td < 95 && A.heavyT <= 0 && ch.onGround) {
      if (-((tg.vx - ch.vx) * Math.sign(dx)) > 120 && Math.abs(tg.vx) > Math.abs(ch.vx) && Math.random() < ch.skill * 0.7) A.heavyT = rand(0.3, 0.5);
      else if (closing > 150 && Math.random() < ch.skill * 0.6) A.heavyT = rand(0.18, 0.3);
      else if (Math.random() < 0.12) out.jump = true;
    }
    if (tg.y < ch.y - 46 && Math.abs(dx) < 140 && ch.onGround && Math.random() < 0.6) out.jump = true;
    if (ch.perk === "dash" && ch.dashCd <= 0 && ch.onGround && td > 70 && td < 170 && Math.abs(tg.y - ch.y) < 30 && Math.random() < 0.35) { out[dx > 0 ? "Rt" : "L"] = true; ch.tapDir = Math.sign(dx); ch.tapT = 0; }
  }
  // edges: do not walk off (mostly)
  if (ch.onGround) {
    const careful = Math.random() < ch.skill + 0.12;
    // a gap toward the target that can be jumped (towers, moving platforms, missing tiles): take a run-up and jump it at speed
    let gapDir = 0;
    if (tg && mx && A.wander <= 0) {
      const e = edgeDist(ch, mx);
      if (e < 150 && Math.abs(tg.x - ch.x) > e + 30) {
        const ok = (d) => { const gy = groundY(ch.x + mx * d, ch.y - 110); return gy != null && gy < ch.y + 70 && gy > ch.y + R - 80; };
        for (let d = e + 12; d <= e + 150; d += 12) if (ok(d) && ok(d + 26)) { gapDir = mx; break; }
      }
    }
    for (const dir of [-1, 1]) {
      const e = edgeDist(ch, dir), need = 30 + Math.max(0, ch.vx * dir) * 0.3 + (arena.idx === 5 ? 50 : 0);
      if (dir === gapDir) {
        if (e < 40) { if (ch.vx * dir > 215) { out.jump = true; A.tick = 0.3; } else { mx = -dir; A.wander = 0.5; A.wdir = -dir; } }
        continue;
      }
      if (careful && e < need) { if (mx === dir || ch.vx * dir > 60) mx = -dir; if (e < 22 && ch.vx * dir > 140) out.jump = false; }
    }
  }
  A.mx = mx; out.mx = mx; out.heavy = A.heavyT > 0;
  return out;
}

// ---------- physics ----------
function hitSolid(ch, s) {
  let nx, ny, pen, svx = s.vx || 0, svy = s.vy || 0;
  if (s.type === "rect") {
    const cx = clamp(ch.x, s.x, s.x + s.w), cy = clamp(ch.y, s.y, s.y + s.h), dx = ch.x - cx, dy = ch.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    if (d2 > 0.0001) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = R - d; }
    else {
      const l = ch.x - s.x, r = s.x + s.w - ch.x, t = ch.y - s.y, b = s.y + s.h - ch.y, m = Math.min(l, r, t, b);
      nx = 0; ny = 0;
      if (m === t) ny = -1; else if (m === l) nx = -1; else if (m === r) nx = 1; else ny = 1;
      pen = m + R;
    }
  } else {
    const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((ch.x - s.ax) * dx + (ch.y - s.ay) * dy) / l2, 0, 1) : 0;
    const cx = s.ax + dx * t, cy = s.ay + dy * t;
    nx = ch.x - cx; ny = ch.y - cy;
    const d = Math.hypot(nx, ny), RR = R + s.r;
    if (d >= RR || d === 0) return;
    nx /= d; ny /= d; pen = RR - d;
    if (s.seesaw) { svx = -s.av * (cy - s.cy); svy = s.av * (cx - s.cx); }
  }
  ch.x += nx * pen; ch.y += ny * pen;
  const rvx = ch.vx - svx, rvy = ch.vy - svy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    if (s.bouncy) {
      const out = Math.max(-vn * 1.25, 420);
      ch.vx -= vn * nx; ch.vy -= vn * ny; ch.vx += nx * out; ch.vy += ny * out - 120;
      ch.sq = 1; ch.sqa = Math.atan2(ny, nx); s.pop = 1;
      sfx.play("bounce"); burst(ch.x - nx * R, ch.y, 5, ["#fff", "#f9a8d4"]);
    } else {
      if (-vn > 420) { ch.sq = Math.min(1, -vn / 900); ch.sqa = Math.atan2(ny, nx); if (ny < -0.5) sfx.play("land"); }
      ch.vx -= vn * nx; ch.vy -= vn * ny;
    }
  }
  if (ny < -0.5 && !s.bouncy) { ch.onGround = true; ch.ground = s; ch.gvx = svx + (s.conv || 0); }
}
function stepChar(ch, inp, dt) {
  ch.heavy = !!inp.heavy;
  ch.mass = ch.heavy ? (ch.perk === "anchor" ? 5 : 2.6) : 1;
  ch.dashCd -= dt; ch.dashT -= dt; ch.inv -= dt;
  const ice = ch.ground && ch.ground.ice, onG = ch.onGround;
  const maxSp = ch.heavy ? 150 : 275, acc = onG ? (ice ? 430 : 2300) : 1150;
  let rvx = ch.vx - (onG ? ch.gvx : 0);
  if (inp.mx) {
    ch.face = inp.mx;
    if (rvx * inp.mx < maxSp) rvx = inp.mx > 0 ? Math.min(maxSp, rvx + acc * dt) : Math.max(-maxSp, rvx - acc * dt);
  }
  if (onG && ch.dashT <= 0 && (!inp.mx || Math.abs(rvx) > maxSp)) {
    const f = (ice ? 90 : ch.heavy ? 2600 : 1500) * dt;
    rvx = Math.abs(rvx) <= f ? 0 : rvx - Math.sign(rvx) * f;
  }
  ch.vx = rvx + (onG ? ch.gvx : 0);
  ch.vy += (ch.heavy ? 2500 : 1750) * dt;
  ch.coyote = onG ? 0.1 : ch.coyote - dt;
  if (onG) ch.airJumps = ch.perk === "double" ? 1 : 0;
  ch.jbuf = inp.jump ? 0.12 : ch.jbuf - dt;
  if (ch.jbuf > 0) {
    if (ch.coyote > 0) { ch.vy = -(ch.heavy ? 360 : 610); ch.coyote = 0; ch.jbuf = 0; ch.sq = -0.6; ch.sqa = Math.PI / 2; sfx.tone(300 + ch.i * 40, 0.12, { slide: 600 + ch.i * 40, type: "square", vol: 0.2 }); }
    else if (ch.airJumps > 0 && !ch.heavy) { ch.airJumps--; ch.vy = -560; ch.jbuf = 0; ch.sq = -0.6; ch.sqa = Math.PI / 2; burst(ch.x, ch.y + R, 6, ["#fff", "#bfdbfe"], 160); sfx.play("pop"); }
  }
  // dash: double-tap a direction
  ch.tapT += dt;
  const tap = inp.Rt ? 1 : inp.L ? -1 : 0;
  if (tap) {
    if (ch.perk === "dash" && ch.tapDir === tap && ch.tapT < 0.3 && ch.dashCd <= 0 && !ch.heavy) {
      ch.vx = tap * 700; ch.vy = Math.min(ch.vy, -60); ch.dashT = 0.18; ch.dashCd = 1; ch.tapT = 9;
      sfx.play("whoosh"); burst(ch.x - tap * R, ch.y, 7, ["#fff", ch.shine], 180);
    } else { ch.tapDir = tap; ch.tapT = 0; }
  }
  const sp = Math.hypot(ch.vx, ch.vy);
  if (sp > 1500) { ch.vx *= 1500 / sp; ch.vy *= 1500 / sp; }
  ch.x += ch.vx * dt; ch.y += ch.vy * dt;
  ch.onGround = false; ch.ground = onG ? ch.ground : null;
  const prevG = ch.ground; ch.ground = null;
  if (ch.ghost && ch.vy >= 0) ch.ghost = false;
  if (!ch.ghost) for (const s of arena.solids) if (s.alive) hitSolid(ch, s);
  if (!ch.ground && prevG && ch.coyote > 0.05) ch.ground = null;
  ch.sq *= 1 - 9 * dt;
}
function bumpPairs() {
  for (let i = 0; i < chars.length; i++) for (let j = i + 1; j < chars.length; j++) {
    const a = chars[i], b = chars[j];
    if (!a.alive || !b.alive) continue;
    let nx = b.x - a.x, ny = b.y - a.y;
    const d2 = nx * nx + ny * ny;
    if (d2 >= 4 * R * R || d2 === 0) continue;
    const d = Math.sqrt(d2); nx /= d; ny /= d;
    const ia = 1 / a.mass, ib = 1 / b.mass, pen = 2 * R - d;
    a.x -= nx * pen * (ia / (ia + ib)); a.y -= ny * pen * (ia / (ia + ib));
    b.x += nx * pen * (ib / (ia + ib)); b.y += ny * pen * (ib / (ia + ib));
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn >= 0) continue;
    const dashB = (a.dashT > 0 || b.dashT > 0) ? 1.5 : 1;
    const jn = ((-1.7 * vn + 120) * kb * dashB) / (ia + ib);
    a.vx -= nx * jn * ia; a.vy -= ny * jn * ia; b.vx += nx * jn * ib; b.vy += ny * jn * ib;
    // a little lift so bumps send jellies flying, not just sliding
    const lift = Math.min(150, jn * 0.16) * (Math.abs(ny) < 0.6 ? 1 : 0.3);
    if (a.inv <= 0) a.vy -= lift * ia; if (b.inv <= 0) b.vy -= lift * ib;
    const pow = clamp(-vn / 500, 0.25, 1);
    a.sq = pow; a.sqa = Math.atan2(ny, nx); b.sq = pow; b.sqa = a.sqa;
    a.lastHit = b; b.lastHit = a; a.hitT = b.hitT = fightT;
    if (-vn > 110) {
      // the one who was moving slower into the bump is the one who got hit
      const va = (a.vx + nx * jn * ia) * nx + (a.vy + ny * jn * ia) * ny, vb = -((b.vx - nx * jn * ib) * nx + (b.vy - ny * jn * ib) * ny);
      if (-vn > 230) (va < vb ? a : b).hurtT = 0.4;
      burst(a.x + nx * R, a.y + ny * R, 3 + Math.round(pow * 7), ["#fde047", "#fff", "#fb923c"], 180 + pow * 220);
      sfx.play(pow > 0.6 ? "hit" : "bounce");
      if (pow > 0.6) g.shake(5 + pow * 6, 0.18);
    }
  }
}
function knockOut(ch) {
  if (ch.perk === "bubble" && !ch.bubble) {
    ch.bubble = true; ch.inv = 1.1; ch.ghost = true;
    let bx = 480, bd = 1e9;
    for (const s of arena.solids) { if (!s.alive || s.bouncy) continue; const m = s.type === "rect" ? s.x + s.w / 2 : (s.ax + s.bx) / 2, d = Math.abs(m - ch.x); if (d < bd) { bd = d; bx = m; } }
    ch.x = clamp(ch.x, 60, W - 60); ch.y = 548; ch.vy = -1120; ch.vx = clamp((bx - ch.x) * 1.5, -420, 420);
    sfx.play("power"); burst(ch.x, 520, 12, ["#bae6fd", "#fff"], 240);
    notice = { text: `${ch.name === "You" ? "Your" : ch.name + "'s"} bubble popped!`, t: 1, t0: 1 };
    return;
  }
  ch.alive = false; ch.koT = fightT; ch.outT = 0;
  const by = ch.lastHit && ch.lastHit.alive && fightT - ch.hitT < 3 ? ch.lastHit : null;
  if (by) { by.happyT = 1.3; by.hurtT = 0; }
  koLog.push([arena.idx, ch.name, Math.round(fightT * 10) / 10, by ? "bumped" : "fell", ch.x < 480 ? "L" : "R"]);
  sfx.play("crash"); g.shake(10, 0.3);
  burst(clamp(ch.x, 30, W - 30), clamp(ch.y, 30, H - 14), 16, [ch.color, ch.shine, "#fff"], 420);
}

// ---------- rounds ----------
function resetMatch() {
  makeChars(); round = 0; arenaIdx = 0; time = 0;
  for (const p of stars) p.life = 0;
  startRound();
}
function startRound() {
  arena = buildArena(arenaIdx % 10);
  arena.update(0);
  placeChars();
  phase = "ask"; phT = 0; fightT = 0; kb = 1; slow = 0; slowWho = null; roundWinner = null; suddenSaid = false;
  const p = math.problem({ topic: "quick", level: round < 3 ? 1 : 2 });
  q = { text: p.text, choices: p.choices, correct: p.choices.findIndex((v) => p.check(v)), resolved: false };
}
function answer(ch, i) {
  if (phase !== "ask" || q.resolved || ch.ans != null) return;
  ch.ans = i; ch.right = i === q.correct;
  sfx.play("click");
}
function resolveAsk() {
  q.resolved = true;
  const kinds = Object.keys(PERKS);
  for (const ch of chars) {
    const got = ch.human >= 0 && !auto ? ch.right === true : Math.random() < 0.34;
    if (ch.human >= 0 && ch.ans == null) ch.ans = -1;
    if (got) { ch.perk = choose(kinds); ch.perkPop = 1; }
  }
  const hs = chars.filter((ch) => ch.human >= 0);
  sfx.play(hs.some((h) => h.perk) ? "correct" : "wrong");
  phase = "go"; phT = 0;
}
function endRound(w) {
  roundWinner = w; phase = "roundEnd"; phT = 0;
  log.push([arena.idx, Math.round(fightT * 10) / 10, w ? w.name : "draw"]);
  if (w) { w.happyT = 2.4; w.wins++; sfx.play(w.human >= 0 ? "win" : "coin"); burst(w.x, w.y - 30, 30, [w.color, w.shine, "#fff", "#fde047"], 420); }
  notice = { text: w ? (w.name === "You" ? "You win the round!" : `${w.name} wins the round!`) : "Draw! Nobody scores.", t: 2, t0: 2 };
}
function update(dt) {
  time = g.time; phT += dt; notice.t -= dt;
  for (const p of stars) if (p.life > 0) { p.life -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  for (const ch of chars) { ch.perkPop = Math.max(0, ch.perkPop - dt * 1.5); ch.hurtT -= dt; ch.happyT -= dt; }
  if (phase === "ask") {
    const hs = chars.filter((ch) => ch.human >= 0);
    const K1 = ["Digit1", "Digit2", "Digit3", "Digit4"], K2 = ["Digit7", "Digit8", "Digit9", "Digit0"], N1 = ["Numpad1", "Numpad2", "Numpad3", "Numpad4"];
    for (let i = 0; i < 4; i++) {
      if (g.keys.pressed(K1[i], N1[i])) answer(hs[0], i);
      if (hs[1] && g.keys.pressed(K2[i])) answer(hs[1], i);
    }
    if (tapAns >= 0) answer(hs[0], tapAns);
    if (auto) for (const h of hs) if (h.ans == null && phT > 0.5) answer(h, Math.random() < 0.5 ? q.correct : (q.correct + 1) % 4);
    if (hs.every((h) => h.ans != null) || phT >= 5) resolveAsk();
  }
  tapAns = -1;
  const fighting = phase === "fight";
  if (phase === "go" && phT > 0.9) { phase = "fight"; phT = 0; sfx.play("power"); }
  // slow motion on the final knock-out
  let ts = 1;
  if (slow > 0) { slow -= dt; ts = 0.28; }
  const sdt = (dt * ts) / 2;
  for (let s = 0; s < 2; s++) {
    if (fighting) { arena.t += sdt; fightT += sdt; }
    arena.update(sdt);
    for (const ch of chars) {
      if (!ch.alive) continue;
      const inp = fighting || phase === "roundEnd" ? (s === 0 ? (ch.inp = controls(ch)) : { ...ch.inp, jump: false, L: false, Rt: false }) : { mx: 0, jump: false, heavy: false };
      stepChar(ch, inp, sdt);
    }
    bumpPairs();
  }
  if (!fighting) return void (phase === "roundEnd" && endTick());
  const alive = chars.filter((ch) => ch.alive);
  for (const ch of alive) {
    if (alive.length === 2 && slow <= 0 && slowWho !== ch && ch.y > 470 && ch.vy > 0 && groundY(ch.x, ch.y - 10) == null && !(ch.perk === "bubble" && !ch.bubble) && ch.airJumps === 0) { slow = 0.9; slowWho = ch; sfx.tone(500, 0.7, { slide: 120, type: "sine", vol: 0.4 }); }
    if (ch.y > H + 70 || ch.x < -90 || ch.x > W + 90) knockOut(ch);
  }
  if (fightT > 16) { kb = 1 + (fightT - 16) * 0.14; if (!suddenSaid) { suddenSaid = true; notice = { text: "Bumps get stronger!", t: 1.4, t0: 1.4 }; sfx.play("power"); } }
  const left = chars.filter((ch) => ch.alive);
  if (left.length <= 1) {
    let w = left[0];
    if (!w) { const last = [...chars].sort((a, b) => b.koT - a.koT); w = last[0].koT - last[1].koT > 0.05 ? last[0] : null; }
    endRound(w || null);
  } else if (fightT > 75) endRound(null);
}
function endTick() {
  if (phT < 2.1) return;
  const champ = chars.find((ch) => ch.wins >= WIN);
  if (champ) {
    const me = chars[0], won = mode.players === 2 ? champ.human >= 0 : champ === me;
    g.over({ score: mode.players === 1 ? me.wins : String(champ.wins), scoreLabel: mode.players === 1 ? "Rounds won" : `${champ.name}: rounds won`, won, title: champ.name === "You" ? "You win the match!" : `${champ.name} wins the match`, lines: [chars.map((ch) => `${ch.name} ${ch.wins}`).join("   ")] });
    return;
  }
  round++; arenaIdx++;
  startRound();
}

// ---------- drawing ----------
function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(s, x, y, size, col, align = "center", weight = 900) { ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = col; ctx.fillText(s, x, y); }
function cloud(x, y, s) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, 7); ctx.arc(x + 24 * s, y - 10 * s, 24 * s, 0, 7); ctx.arc(x + 52 * s, y, 19 * s, 0, 7); ctx.fill();
  rr(x - 18 * s, y + 2 * s, 88 * s, 17 * s, 8 * s); ctx.fill();
}
const THEMES = [["#c7e9ff", "#ffe4f1"], ["#d9f7e8", "#fff3c9"], ["#ffe1d2", "#fff5d6"], ["#dcd9ff", "#ffe4f1"], ["#c9f2f0", "#f5ffd9"], ["#cfe8ff", "#f3f9ff"], ["#ffd9ec", "#fff0d9"], ["#d5e3ff", "#e9fbe5"], ["#ffe0f3", "#e3e9ff"], ["#fff0c9", "#ffdfd2"]];
function drawSky() {
  const th = THEMES[arena.idx], gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, th[0]); gr.addColorStop(1, th[1]);
  ctx.fillStyle = gr; ctx.fillRect(-40, -40, W + 80, H + 80);
  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(800, 110, 74, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff6c2"; ctx.beginPath(); ctx.arc(800, 110, 50, 0, 7); ctx.fill();
  // far floating islands
  for (const [x, y, s] of [[120, 300, 1], [860, 330, 0.8], [520, 250, 0.55]]) {
    const yy = y + Math.sin(time * 0.5 + x) * 5;
    ctx.fillStyle = "rgba(167,139,250,0.28)"; ctx.beginPath(); ctx.moveTo(x - 70 * s, yy); ctx.quadraticCurveTo(x, yy + 90 * s, x + 70 * s, yy); ctx.fill();
    ctx.fillStyle = "rgba(110,231,183,0.5)"; rr(x - 76 * s, yy - 12 * s, 152 * s, 20 * s, 10 * s); ctx.fill();
  }
  cloud(((time * 9 + 80) % (W + 240)) - 120, 96, 1.1); cloud(((time * 5 + 520) % (W + 240)) - 120, 170, 0.8); cloud(((time * 7 + 840) % (W + 240)) - 120, 60, 0.65);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(((i * 190 + time * 14) % (W + 200)) - 100, 520 + (i % 2) * 12, 110, 26, 0, 0, 7); ctx.fill(); }
}
function slab(s, top, body, edge) {
  rr(s.x, s.y + 5, s.w, s.h, 16); ctx.fillStyle = "rgba(30,58,138,0.18)"; ctx.fill();
  rr(s.x, s.y, s.w, s.h, 16); ctx.fillStyle = body; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = top; ctx.fillRect(s.x, s.y, s.w, 14); ctx.fillStyle = edge; ctx.fillRect(s.x, s.y + 14, s.w, 4); ctx.restore();
  rr(s.x, s.y, s.w, s.h, 16); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
}
function drawArena() {
  const i = arena.idx;
  if (i === 1) {
    const s = arena.solids[0];
    ctx.fillStyle = "#a78bfa"; ctx.beginPath(); ctx.moveTo(s.cx, s.cy + 6); ctx.lineTo(s.cx - 54, 600); ctx.lineTo(s.cx + 54, 600); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
    ctx.lineCap = "round"; ctx.strokeStyle = NAVY; ctx.lineWidth = s.r * 2 + 7; ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
    ctx.strokeStyle = "#f6c177"; ctx.lineWidth = s.r * 2; ctx.stroke();
    ctx.strokeStyle = "#fde2b3"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s.ax + 8, s.ay - 8); ctx.lineTo(s.bx - 8, s.by - 8); ctx.stroke();
    ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(s.cx, s.cy, 9, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.stroke();
    return;
  }
  if (i === 4) {
    const S = arena.solids;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const path = () => { ctx.beginPath(); ctx.moveTo(S[0].ax, S[0].ay); for (const s of S) ctx.lineTo(s.bx, s.by); };
    ctx.fillStyle = "#99e6d8"; path(); ctx.quadraticCurveTo(480, 640, S[0].ax, S[0].ay); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
    path(); ctx.strokeStyle = NAVY; ctx.lineWidth = 33; ctx.stroke(); path(); ctx.strokeStyle = "#5eead4"; ctx.lineWidth = 26; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(S[0].ax, S[0].ay - 7); for (const s of S) ctx.lineTo(s.bx, s.by - 7); ctx.strokeStyle = "#ccfbf1"; ctx.lineWidth = 6; ctx.stroke();
    return;
  }
  for (const s of arena.solids) {
    if (!s.alive) continue;
    if (s.bouncy) {
      const p = (s.pop = Math.max(0, (s.pop || 0) - 0.06));
      rr(s.x - p * 5, s.y, s.w + p * 10, s.h, 15); ctx.fillStyle = "#f472b6"; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
      ctx.fillStyle = "#fbcfe8"; for (let y = s.y + 22; y < s.y + s.h - 12; y += 34) { rr(s.x + 7, y, s.w - 14, 12, 6); ctx.fill(); }
    } else if (s.tile) {
      const sh = s.fall > 0 ? Math.sin(time * 70 + s.k) * 3 : 0, warn = clamp(s.stood / 1.2, 0, 1);
      ctx.save(); ctx.translate(sh, s.fall * s.fall * 30);
      slab({ x: s.x + 2, y: s.y, w: s.w - 4, h: s.h }, warn > 0.5 ? "#fca5a5" : "#fde68a", "#f6c177", "#e0a458");
      if (warn > 0.3) { ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x + 20, s.y + 3); ctx.lineTo(s.x + 30, s.y + 16); ctx.lineTo(s.x + 24, s.y + 26); ctx.stroke(); }
      ctx.restore();
    } else if (s.ice) {
      slab(s, "#ffffff", "#bae6fd", "#7dd3fc");
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 4; ctx.lineCap = "round";
      for (let x = s.x + 40; x < s.x + s.w - 30; x += 90) { ctx.beginPath(); ctx.moveTo(x, s.y + 24); ctx.lineTo(x - 12, s.y + 38); ctx.stroke(); }
      ctx.fillStyle = "#e0f2fe"; for (let x = s.x + 30; x < s.x + s.w - 20; x += 64) { ctx.beginPath(); ctx.moveTo(x - 9, s.y + s.h - 1); ctx.lineTo(x, s.y + s.h + 16 + (x % 3) * 5); ctx.lineTo(x + 9, s.y + s.h - 1); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = NAVY; ctx.stroke(); }
    } else if (s.belt) {
      slab(s, "#94a3b8", "#64748b", "#475569");
      const d = s.dir, off = (s.off = ((s.off || 0) + s.conv / 60) % 40);
      ctx.save(); rr(s.x + 4, s.y, s.w - 8, 16, 6); ctx.clip();
      ctx.strokeStyle = "#fde047"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let x = s.x - 40 + off; x < s.x + s.w + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x - d * 6, s.y + 3); ctx.lineTo(x + d * 4, s.y + 8); ctx.lineTo(x - d * 6, s.y + 13); ctx.stroke(); }
      ctx.restore();
      for (const x of [s.x + 24, s.x + s.w - 24]) { ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.arc(x, s.y + 30, 9, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = NAVY; ctx.stroke(); }
    } else {
      const pal = [["#86efac", "#fcd9a8", "#eab676"], , ["#fda4af", "#fde2c4", "#f3bd8c"], ["#c4b5fd", "#ede9fe", "#c4b5fd"], , , ["#86efac", "#d6c3f7", "#b39ae8"], , ["#a5b4fc", "#e0e7ff", "#a5b4fc"]][i] || ["#86efac", "#fcd9a8", "#eab676"];
      slab(s, pal[0], pal[1], pal[2]);
    }
  }
}
function perkIcon(kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.6;
  if (kind === "double") { ctx.strokeStyle = "#10b981"; for (const yy of [-1, 5]) { ctx.beginPath(); ctx.moveTo(-5, yy); ctx.lineTo(0, yy - 5); ctx.lineTo(5, yy); ctx.stroke(); } }
  else if (kind === "anchor") { ctx.strokeStyle = "#475569"; ctx.beginPath(); ctx.arc(0, -5, 2.2, 0, 7); ctx.moveTo(0, -3); ctx.lineTo(0, 6); ctx.moveTo(-6, 2); ctx.quadraticCurveTo(0, 10, 6, 2); ctx.moveTo(-3.5, -1); ctx.lineTo(3.5, -1); ctx.stroke(); }
  else if (kind === "dash") { ctx.strokeStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-1, -4); ctx.moveTo(-7, 0); ctx.lineTo(1, 0); ctx.moveTo(-7, 4); ctx.lineTo(-1, 4); ctx.moveTo(3, -5); ctx.lineTo(8, 0); ctx.lineTo(3, 5); ctx.stroke(); }
  else { ctx.strokeStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.6, -2.4, -1.3); ctx.stroke(); }
  ctx.restore();
}
function drawHat(k, col) {
  ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.lineJoin = "round";
  if (k === 0) { ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(0, -R * 0.78, 12, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); rr(2, -R * 0.78 - 4, 18, 6, 3); ctx.fill(); ctx.stroke(); }
  else if (k === 1) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-11, -R * 0.82); ctx.lineTo(0, -R * 0.82 - 24); ctx.lineTo(11, -R * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, -R * 0.82 - 25, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
  else if (k === 2) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-8, -R * 0.86, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(8, -R * 0.86, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(0, -R * 0.84, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
  else { ctx.fillStyle = INK; rr(-10, -R * 0.84 - 18, 20, 18, 3); ctx.fill(); ctx.stroke(); rr(-16, -R * 0.84 - 3, 32, 6, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fde047"; ctx.fillRect(-9, -R * 0.84 - 8, 18, 4); }
}
function drawChar(ch, small) {
  const sq = ch.sq * 0.28;
  ctx.save();
  ctx.translate(ch.x, ch.y);
  if (!small) { ctx.rotate(ch.sqa); ctx.scale(1 - sq, 1 + sq); ctx.rotate(-ch.sqa); if (ch.heavy) { ctx.translate(0, R * 0.14); ctx.scale(1.12, 0.86); } }
  if (ch.inv > 0 && !small) { ctx.beginPath(); ctx.arc(0, 0, R + 9, 0, 7); ctx.fillStyle = "rgba(186,230,253,0.5)"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#38bdf8"; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fillStyle = ch.color; ctx.fill();
  if (ch.heavy && !small) { ctx.fillStyle = "rgba(15,23,42,0.28)"; ctx.fill(); }
  ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.strokeStyle = ch.shine; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, R - 6, -2.7, -1.9); ctx.stroke();
  // face
  let lx = ch.face * 2, ly = 0;
  const tg = !small && chars.filter((o) => o !== ch && o.alive).sort((a, b) => Math.abs(a.x - ch.x) - Math.abs(b.x - ch.x))[0];
  if (tg) { const dx = tg.x - ch.x, dy = tg.y - ch.y, d = Math.hypot(dx, dy) || 1; lx = (dx / d) * 2.6; ly = (dy / d) * 2.6; }
  const fx = small ? 0 : ch.face * 3;
  // expression: hurt (brief), happy (after a knock-out or a win), worried (near an edge or falling with nothing below), else a calm smile
  let mood = "calm";
  if (!small) {
    if (ch.hurtT > 0) mood = "hurt";
    else if (ch.happyT > 0) mood = "happy";
    else if (phase === "fight" && (ch.onGround ? Math.min(edgeDist(ch, -1), edgeDist(ch, 1)) < 40 : ch.vy > 200 && groundY(ch.x, ch.y - 10) == null)) mood = "worried";
  }
  for (const s of [-1, 1]) {
    const x = fx + s * 8;
    ctx.lineCap = "round";
    if (mood === "hurt") { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4 * s, -8); ctx.lineTo(x + 3 * s, -4); ctx.lineTo(x - 4 * s, 0); ctx.stroke(); continue; }
    if (mood === "happy") { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, -2, 5, Math.PI + 0.25, -0.25); ctx.stroke(); continue; }
    if (ch.heavy && !small) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4 * s - 2, -11); ctx.lineTo(x + 3 * s, -8); ctx.stroke(); }
    if (mood === "worried") { ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x - 5 * s, -15); ctx.lineTo(x + 4 * s, -12.5); ctx.stroke(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, -4, 6, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + lx * 0.8, -4 + ly * 0.9, 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + lx * 0.8 + 1.3, -5.4 + ly * 0.9, 1.2, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "#f9a8d4"; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx + s * 14, 5, 3.6, 2.4, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  if (mood === "hurt") { ctx.beginPath(); ctx.ellipse(fx, 10, 3.5, 4.5, 0, 0, 7); ctx.fill(); }
  else if (mood === "happy") { ctx.beginPath(); ctx.arc(fx, 5, 7, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fb7185"; ctx.beginPath(); ctx.arc(fx, 10, 3.2, 0, 7); ctx.fill(); }
  else if (mood === "worried") { ctx.beginPath(); ctx.moveTo(fx - 6, 10); ctx.quadraticCurveTo(fx - 3, 6, fx, 10); ctx.quadraticCurveTo(fx + 3, 14, fx + 6, 10); ctx.stroke(); }
  else if (ch.heavy && !small) { ctx.beginPath(); ctx.arc(fx, 6, 5, 0.5, Math.PI - 0.5); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(fx, 6, 5, 0.3, Math.PI - 0.3); ctx.stroke(); }
  drawHat(ch.hat, ch.color);
  ctx.restore();
}
function drawBoard() {
  const n = chars.length, cw = 150, x0 = W / 2 - (n * cw) / 2;
  chars.forEach((ch, k) => {
    const x = x0 + k * cw + 4;
    rr(x, 10, cw - 8, 44, 22); ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ch.alive || phase !== "fight" ? NAVY : "#94a3b8"; ctx.stroke();
    ctx.save(); ctx.translate(x + 24, 34); ctx.scale(0.62, 0.62); ctx.globalAlpha = ch.alive || phase !== "fight" ? 1 : 0.35; drawChar({ ...ch, x: 0, y: 0, sq: 0, sqa: 0 }, true); ctx.restore();
    text(ch.name, x + 46, 23, 13, NAVY, "left", 800);
    for (let i = 0; i < WIN; i++) { ctx.beginPath(); ctx.arc(x + 52 + i * 14, 40, 5, 0, 7); ctx.fillStyle = i < ch.wins ? ch.color : "#e2e8f0"; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = NAVY; ctx.stroke(); }
    if (ch.perk && phase !== "ask") perkIcon(ch.perk, x + cw - 24, 24, 0.8);
  });
}
function askRects() { return [0, 1, 2, 3].map((i) => ({ x: 222 + i * 132, y: 164, w: 120, h: 66 })); }
function drawAsk() {
  const pop = Math.min(1, phT / 0.18), two = mode.players === 2, hs = chars.filter((ch) => ch.human >= 0);
  ctx.save(); ctx.globalAlpha = phase === "go" ? clamp(1 - (phT - 0.55) / 0.3, 0, 1) : pop;
  ctx.translate(0, -14);
  rr(200, 78, 560, 190, 26); ctx.fillStyle = "rgba(15,23,42,0.2)"; ctx.fill();
  rr(200, 72, 560, 190, 26); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NAVY; ctx.stroke();
  rr(216, 86, 178, 26, 13); ctx.fillStyle = PAL.blue; ctx.fill();
  text(`Round ${round + 1}: win a perk`, 305, 100, 13.5, "#fff", "center", 800);
  text(arena.name, 744, 100, 14, PAL.slate, "right", 800);
  rr(404, 93, 230, 12, 6); ctx.fillStyle = PAL.cloud; ctx.fill();
  const f = q.resolved ? 0 : clamp(1 - phT / 5, 0, 1);
  if (f > 0.02) { rr(404, 93, 230 * f, 12, 6); ctx.fillStyle = PAL.amber; ctx.fill(); }
  text(q.text, W / 2, 146, 38, INK);
  askRects().forEach((b0, i) => {
    const b = { ...b0, y: b0.y + 14 };
    let bg = "#eff6ff", bd = "#93c5fd", fg = NAVY;
    if (q.resolved) { if (i === q.correct) { bg = "#10b981"; bd = "#047857"; fg = "#fff"; } else if (hs.some((h) => h.ans === i)) { bg = "#ef4444"; bd = "#b91c1c"; fg = "#fff"; } }
    rr(b.x, b.y + 5, b.w, b.h, 16); ctx.fillStyle = bd; ctx.fill();
    rr(b.x, b.y, b.w, b.h, 16); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = bd; ctx.stroke();
    text(String(q.choices[i]), b.x + b.w / 2, b.y + (two ? 26 : 34), 30, fg);
    if (two) { text(String(i + 1), b.x + 30, b.y + 53, 13, q.resolved ? fg : COLORS[0]); text("7890"[i], b.x + b.w - 30, b.y + 53, 13, q.resolved ? fg : "#b45309"); }
    else { rr(b.x + 8, b.y + 8, 22, 22, 6); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = bd; ctx.stroke(); text(String(i + 1), b.x + 19, b.y + 20, 13, "#1d4ed8"); }
  });
  if (!q.resolved) hs.forEach((h, k) => { if (h.ans != null) text(`${h.name === "You" ? "Locked in" : h.name + " locked in"}`, k ? 668 : 292, 160, 12, h.color, "center", 800); });
  ctx.restore();
}
function render() {
  if (!arena) return;
  ctx.save();
  const z = slow > 0 && slowWho ? 0.14 * Math.min(1, (0.9 - slow) * 5, slow * 4) : 0;
  ctx.translate(g.shakeX, g.shakeY);
  if (z > 0) { const fx = clamp(slowWho.x, 200, W - 200), fy = clamp(slowWho.y, 200, 420); ctx.translate(fx, fy); ctx.scale(1 + z, 1 + z); ctx.translate(-fx, -fy); }
  drawSky();
  drawArena();
  for (const ch of chars) {
    if (!ch.alive) continue;
    ctx.fillStyle = "rgba(30,58,138,0.16)";
    const gy = groundY(ch.x, ch.y - 4);
    if (gy != null && gy - ch.y < 200) { ctx.beginPath(); ctx.ellipse(ch.x, gy + 2, Math.max(6, R - (gy - ch.y - R) * 0.1), 4.5, 0, 0, 7); ctx.fill(); }
  }
  for (const ch of chars) {
    if (!ch.alive) continue;
    drawChar(ch);
    const top = ch.y - R - (ch.hat === 1 || ch.hat === 3 ? 34 : 22);
    if (ch.perk) { const bob = Math.sin(time * 4 + ch.i) * 2; perkIcon(ch.perk, ch.x, top - 6 + bob, 1 + ch.perkPop * 0.8); if (ch.perkPop > 0.05) text(PERKS[ch.perk], ch.x, top - 30, 14, NAVY); }
    if (ch.human >= 0 && phase === "ask") {
      const yy = top - (ch.perk ? 46 : 12) + Math.sin(time * 6) * 3;
      ctx.fillStyle = ch.color; ctx.beginPath(); ctx.moveTo(ch.x - 8, yy - 10); ctx.lineTo(ch.x + 8, yy - 10); ctx.lineTo(ch.x, yy); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = NAVY; ctx.stroke();
      text(ch.name, ch.x, yy - 22, 14, NAVY);
    } else if (phase === "ask") text(ch.name, ch.x, top - (ch.perk ? 48 : 12), 13, NAVY, "center", 800);
  }
  for (const p of stars) if (p.life > 0) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, (p.life / p.l0) * 1.6); ctx.fillStyle = p.col;
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? p.s * 0.45 : p.s, a = (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = NAVY; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  if (slow > 0) { ctx.fillStyle = "rgba(30,58,138,0.12)"; ctx.fillRect(0, 0, W, H); }
  drawBoard();
  if (phase === "ask" || (phase === "go" && phT < 0.85)) drawAsk();
  const big = (s, y, size) => { ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = size * 0.22; ctx.strokeStyle = NAVY; ctx.strokeText(s, W / 2, y); ctx.fillStyle = "#fff"; ctx.fillText(s, W / 2, y); };
  if (phase === "fight" && phT < 0.6) { ctx.save(); ctx.globalAlpha = 1 - phT / 0.6; big("Go!", 200, 80 + phT * 60); ctx.restore(); }
  if (notice.t > 0) big(notice.text, 150, 44);
  if (phase === "fight" && kb > 1.01) text(`Bump power x${kb.toFixed(1)}`, W / 2, 74, 14, "#b91c1c", "center", 800);
}

// ---------- input and boot ----------
c.canvas.addEventListener("pointerdown", (e) => {
  if (g.state !== "playing" || phase !== "ask") return;
  const r = c.canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  const i = askRects().findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y - 4 && y <= b.y + b.h + 8);
  if (i >= 0) tapAns = i;
});
g.touchButtons([{ code: "ArrowLeft", label: "◀", side: "left" }, { code: "ArrowRight", label: "▶", side: "left" }, { code: "KeyX", label: "Heavy", side: "right" }, { code: "ArrowUp", label: "Jump", side: "right" }]);
g.onStart = () => resetMatch();
g.answerOpen = (right = true) => {
  if (phase !== "ask" || q.resolved) return false;
  for (const h of chars) if (h.human >= 0 && h.ans == null) answer(h, right ? q.correct : (q.correct + 1) % 4);
  return true;
};
g.debug = {
  get state() { return { players: mode.players, phase, round, arena: arena.name, fightT: Math.round(fightT * 10) / 10, kb, q: q && { text: q.text, correct: q.correct, resolved: q.resolved }, chars: chars.map((ch) => ({ name: ch.name, human: ch.human, alive: ch.alive, x: Math.round(ch.x), y: Math.round(ch.y), wins: ch.wins, perk: ch.perk, heavy: ch.heavy, ground: ch.onGround })) }; },
  get chars() { return chars; }, log, koLog,
  setPlayers(n) { mode.players = n; },
  setAuto(v) { auto = !!v; },
  setPeace(v) { peace = !!v; },
  setArena(i) { arenaIdx = i; startRound(); },
  setPerk(i, p) { chars[i].perk = p; },
  ko(i) { chars[i].y = H + 200; },
  setWins(i, n) { chars[i].wins = n; },
};
resetMatch();
g.loop(update, render);
