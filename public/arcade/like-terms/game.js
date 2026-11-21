// Like Terms: a drop-and-merge jar where only like terms combine.
import { createGame, math, sfx, drawArchie, FONT, clamp, rand, randInt, choose } from "../kit/kit.js";

const g = createGame({
  slug: "like-terms",
  title: "Like Terms",
  tagline: "Drop and merge. Only like terms combine.",
  how: ["Two equal like terms merge: x + x = 2x.", "An x and a 4 never merge. They just bump.", "Reach 64x before the jar fills up."],
  controls: [{ keys: "Mouse or ← →", does: "Aim" }, { keys: "Click or Space", does: "Drop" }],
  aspect: 16 / 9,
  bg: "#3a2416",
});
const c = g.canvas2d(960, 540);
const { ctx } = c;

const W = 960, H = 540;
const JL = 318, JR = 642, FLOOR = 478, RIM = 112, LINE = 172, DROPY = 74, G = 1800;
const MINUS = "−";
const FAM = {
  c: { v: "", col: "#f59e0b", dark: "#b45309", light: "#fcd34d", mult: 1, name: "numbers" },
  x: { v: "x", col: "#3b82f6", dark: "#1e40af", light: "#93c5fd", mult: 2, name: "x terms" },
  x2: { v: "x²", col: "#8b5cf6", dark: "#5b21b6", light: "#c4b5fd", mult: 3, name: "x² terms" },
  y: { v: "y", col: "#10b981", dark: "#047857", light: "#6ee7b7", mult: 3, name: "y terms" },
};
const GOAL = [1, 2, 4, 8, 16, 32, 64];
const radius = (coef) => 17 * Math.pow(Math.abs(coef), 0.3219);
function label(f, coef) {
  const s = coef < 0 ? MINUS : "";
  const a = Math.abs(coef);
  const v = FAM[f].v;
  return v ? s + (a === 1 ? "" : a) + v : s + a;
}
const pieceLabel = (p) => (p.kind === "dbl" ? "×2" : label(p.f, p.c));

// ---------- state ----------
let bodies = [], parts = [], pops = [], events = [], rings = [];
// bounce: pieces are bubbly. A hit faster than BOUNCE_MIN springs back; slower contacts stay dead so the pile can settle and sleep.
const BOUNCE_MIN = 110, REST = 0.5, REST_WALL = 0.55;
const hits = [];
let impact = 0, lastBoing = -1;
function wobble(b, nx, ny, speed) {
  const amp = clamp(speed / 620, 0.12, 1);
  if (amp > b.wob * Math.exp(-b.wobT * 6)) { b.wob = amp; b.wobT = 0; b.woba = Math.atan2(ny, nx); }
  if (speed > impact) impact = speed;
}
let cur = null, nxt = null, holdX = 480, cool = 0, score = 0, combo = 0, comboT = 0, bestCombo = 0;
let maxX = 1, bigLabel = "x", overT = 0, drops = 0, sinceSpecial = 0, nextSpecialAt = 8, goalHit = false;
let happyT = 0, lookX = 480, lookY = 300, lastPX = -1, uid = 0, merges = 0;

function genPiece() {
  sinceSpecial++;
  const terms = bodies.filter((b) => b.kind === "term" && b.c > 0);
  if (sinceSpecial >= nextSpecialAt && terms.length >= 4) {
    sinceSpecial = 0;
    nextSpecialAt = randInt(6, 9);
    if (Math.random() < 0.5) return { kind: "dbl", r: 18 };
    const cand = terms.filter((b) => !(b.f === "x" && b.c === maxX) && b.c <= 12);
    const t = choose(cand.length ? cand : terms);
    return { kind: "term", f: t.f, c: -t.c, r: radius(t.c) };
  }
  const bag = [["c", 1, 3], ["c", 2, 2], ["c", 3, 1.6], ["x", 1, 5.4], ["x", 2, 3.4]];
  if (maxX >= 8) bag.push(["x2", 1, 2], ["x2", 2, 1], ["x", 4, 1.2]);
  if (maxX >= 16) bag.push(["y", 1, 1.6], ["y", 2, 0.8]);
  let total = 0;
  for (const b of bag) total += b[2];
  let k = Math.random() * total;
  for (const b of bag) { k -= b[2]; if (k <= 0) return { kind: "term", f: b[0], c: b[1], r: radius(b[1]) }; }
  return { kind: "term", f: "x", c: 1, r: radius(1) };
}
function addBody(p, x, y) {
  const b = { id: ++uid, kind: p.kind, f: p.f, c: p.c, x, y, px: x, py: y, vx: 0, vy: 0, r: p.r, tr: p.r, sleep: false, still: 0, age: 0, sq: 0, wob: 0, wobT: 9, woba: 0, touch: false, dead: false, busy: false };
  bodies.push(b);
  return b;
}
const wakeAll = () => { for (const b of bodies) { b.sleep = false; b.still = 0; } };

g.onStart = () => {
  bodies = []; parts = []; pops = []; events = []; rings = []; hits.length = 0;
  score = 0; combo = 0; comboT = 0; bestCombo = 0; maxX = 1; bigLabel = "x"; overT = 0; drops = 0; sinceSpecial = 0; nextSpecialAt = 8;
  goalHit = false; happyT = 0; holdX = 480; cool = 0; merges = 0;
  cur = { kind: "term", f: "x", c: 1, r: radius(1) };
  nxt = { kind: "term", f: "x", c: 1, r: radius(1) };
  g.setScore(0);
  g.setHud("Biggest", "x");
};

function dropNow() {
  if (!cur || cool > 0) return false;
  const x = clamp(holdX + rand(-0.8, 0.8), JL + cur.r + 1, JR - cur.r - 1);
  const b = addBody(cur, x, DROPY);
  b.vy = 120;
  cur = null;
  cool = 0.42;
  drops++;
  sfx.play("whoosh");
  return true;
}

// ---------- physics: position based, substeps, sleeping ----------
function physics(dt) {
  const SUB = 4, h = dt / SUB, n = bodies.length;
  for (let s = 0; s < SUB; s++) {
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      b.touch = false;
      if (b.sleep) continue;
      b.vy += G * h;
      b.px = b.x; b.py = b.y;
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          if (a.sleep && b.sleep) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.01;
          const nx = dx / d, ny = dy / d, pen = rr - d;
          if (it === 0) { const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (vn < -BOUNCE_MIN) hits.push(a, b, nx, ny, vn); }
          if (a.sleep || b.sleep) {
            const m = a.sleep ? b : a;
            if (m.vx * m.vx + m.vy * m.vy > 30 * 30 || pen > 3) { a.sleep = b.sleep = false; a.still = b.still = 0; }
          }
          const wa = a.sleep ? 0 : 1 / (a.r * a.r), wb = b.sleep ? 0 : 1 / (b.r * b.r), wt = wa + wb;
          if (wt > 0) {
            a.x -= nx * pen * wa / wt; a.y -= ny * pen * wa / wt;
            b.x += nx * pen * wb / wt; b.y += ny * pen * wb / wt;
          }
          a.touch = b.touch = true;
          if (!a.busy && !b.busy) {
            if (a.kind === "term" && b.kind === "term") {
              if (a.f === b.f && a.c === b.c) { a.busy = b.busy = true; events.push(["merge", a, b]); }
              else if (a.f === b.f && a.c === -b.c) { a.busy = b.busy = true; events.push(["zero", a, b]); }
            } else if (a.kind !== b.kind) {
              a.busy = b.busy = true;
              events.push(["double", a.kind === "dbl" ? b : a, a.kind === "dbl" ? a : b]);
            }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        if (b.sleep) continue;
        if (b.x < JL + b.r) { b.x = JL + b.r; if (it === 0 && b.vx < -BOUNCE_MIN) hits.push(b, null, 1, 0, b.vx); }
        else if (b.x > JR - b.r) { b.x = JR - b.r; if (it === 0 && b.vx > BOUNCE_MIN) hits.push(b, null, -1, 0, -b.vx); }
        if (b.y > FLOOR - b.r) { b.y = FLOOR - b.r; b.touch = true; b.floor = true; if (it === 0 && b.vy > BOUNCE_MIN) hits.push(b, null, 0, -1, -b.vy); }
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.sleep) continue;
      b.vx = (b.x - b.px) / h; b.vy = (b.y - b.py) / h;
      if (b.touch) { b.vx *= 0.955; b.vy *= 0.985; }
      if (b.vy < -380) b.vy = -380;
      if (b.vy > 1400) b.vy = 1400;
      b.vx = clamp(b.vx, -600, 600);
    }
    // restitution pass: give fast hits their bounce back, and start the squash wobble
    for (let k = 0; k < hits.length; k += 5) {
      const a = hits[k], b = hits[k + 1], nx = hits[k + 2], ny = hits[k + 3], vp = hits[k + 4];
      if (!b) {
        if (a.sleep) continue;
        const add = -REST_WALL * vp - (a.vx * nx + a.vy * ny);
        if (add > 0) { a.vx += nx * add; a.vy += ny * add; }
        wobble(a, nx, ny, -vp);
      } else {
        const wa = a.sleep ? 0 : 1 / (a.r * a.r), wb = b.sleep ? 0 : 1 / (b.r * b.r), wt = wa + wb;
        if (!wt) continue;
        const add = -REST * vp - ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
        if (add > 0) { a.vx -= (nx * add * wa) / wt; a.vy -= (ny * add * wa) / wt; b.vx += (nx * add * wb) / wt; b.vy += (ny * add * wb) / wt; }
        wobble(a, nx, ny, -vp); wobble(b, nx, ny, -vp);
      }
      if (a.vy < -420) a.vy = -420;
      if (b && b.vy < -420) b.vy = -420;
    }
    hits.length = 0;
  }
  if (impact > 240 && g.time - lastBoing > 0.07) { lastBoing = g.time; sfx.tone(clamp(260 + impact * 0.35, 260, 620), 0.07, { type: "sine", slide: 180, vol: clamp(impact / 2400, 0.08, 0.3) }); }
  impact = 0;
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    if (b.sleep) continue;
    if (b.touch && b.vx * b.vx + b.vy * b.vy < 9 * 9 && b.r >= b.tr) { b.still += dt; if (b.still > 0.45) { b.sleep = true; b.vx = b.vy = 0; } }
    else b.still = 0;
  }
}

function burst(x, y, col, n, speed = 220) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 160) parts.shift();
    const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * speed;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.35, 0.75), t: 0, col, r: rand(2, 5) });
  }
}
function popText(x, y, text, col) {
  if (pops.length > 8) pops.shift();
  x = clamp(x, JL + 60, JR - 60);
  y = Math.max(y, LINE - 30);
  for (let i = 0; i < 4; i++) if (pops.some((q) => q.t < 0.7 && Math.abs(q.x - x) < 170 && Math.abs(q.y - q.t * 34 - y) < 34)) y -= 36;
  pops.push({ x, y, text, col, t: 0 });
}
function gain(points, x, y) {
  if (comboT > 0) combo++; else combo = 1;
  comboT = 1.6;
  bestCombo = Math.max(bestCombo, combo);
  score += points * combo;
  g.setScore(score);
  merges++;
  happyT = 0.9; lookX = x; lookY = y;
}
function handleEvents() {
  for (const [type, a, b] of events) {
    a.busy = b.busy = false;
    if (a.dead || b.dead) continue;
    if (type === "merge") {
      a.dead = b.dead = true;
      const nc = a.c * 2;
      const nb = addBody({ kind: "term", f: a.f, c: nc, r: Math.max(a.r, b.r) }, (a.x + b.x) / 2, (a.y + b.y) / 2);
      nb.tr = radius(nc); nb.vx = (a.vx + b.vx) / 2; nb.vy = Math.min(0, (a.vy + b.vy) / 2) - 120; nb.sq = 1; nb.age = 2;
      rings.push({ x: nb.x, y: nb.y, r: nb.tr, col: FAM[a.f].light, t: 0 }, { x: nb.x, y: nb.y, r: nb.tr * 0.6, col: "#ffffff", t: -0.08 });
      sfx.play("pop");
      const fam = FAM[a.f];
      const paren = (v) => (a.c < 0 ? "(" + v + ")" : v);
      popText(nb.x, nb.y - nb.tr - 8, `${label(a.f, a.c)} + ${paren(label(a.f, a.c))} = ${label(a.f, nc)}`, fam.light);
      burst(nb.x, nb.y, fam.light, 12);
      gain(Math.abs(nc) * fam.mult, nb.x, nb.y);
      const lvl = Math.log2(Math.abs(nc));
      sfx.tone(300 * Math.pow(2, lvl / 5), 0.12, { slide: 480 * Math.pow(2, lvl / 5), vol: 0.45 });
      if (lvl >= 4) g.shake(5, 0.2);
      if (a.f === "x" && nc > maxX) {
        maxX = nc; bigLabel = label("x", nc); g.setHud("Biggest", bigLabel);
        if (nc === 8) g.toast("New family: x² terms", 1800, "gold");
        if (nc === 16) g.toast("New family: y terms", 1800, "gold");
        if (nc >= 64 && !goalHit) { goalHit = true; score += 640; g.setScore(score); g.toast("64x! Goal reached. Keep going!", 2400, "good"); sfx.play("win"); burst(nb.x, nb.y, "#fde047", 30, 380); }
      }
    } else if (type === "zero") {
      a.dead = b.dead = true;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, pos = a.c > 0 ? a : b;
      popText(x, y - 20, `${label(pos.f, pos.c)} ${MINUS} ${label(pos.f, pos.c)} = 0`, "#ffffff");
      burst(x, y, "#ffffff", 16, 260); burst(x, y, FAM[a.f].light, 8, 160);
      rings.push({ x, y, r: Math.max(a.r, b.r), col: "#ffffff", t: 0 });
      sfx.play("pop");
      gain(Math.abs(a.c) * 2 + 4, x, y);
      sfx.play("power");
    } else if (type === "double") {
      const t = a, d = b;
      d.dead = true;
      const old = t.c;
      t.c *= 2; t.tr = radius(t.c); t.sq = 1; t.age = Math.max(t.age, 2);
      popText(t.x, t.y - t.tr - 8, `2 × ${label(t.f, old)} = ${label(t.f, t.c)}`, "#fde68a");
      burst(t.x, t.y, "#fde68a", 14);
      rings.push({ x: t.x, y: t.y, r: t.tr, col: "#fde68a", t: 0 });
      gain(Math.abs(t.c) * FAM[t.f].mult, t.x, t.y);
      sfx.play("coin");
      if (t.f === "x" && t.c > maxX) { maxX = t.c; bigLabel = label("x", t.c); g.setHud("Biggest", bigLabel); if (t.c >= 64 && !goalHit) { goalHit = true; score += 640; g.setScore(score); g.toast("64x! Goal reached. Keep going!", 2400, "good"); sfx.play("win"); } }
    }
  }
  if (events.length) { bodies = bodies.filter((b) => !b.dead); wakeAll(); }
  events.length = 0;
}

function update(dt) {
  // aim
  const p = g.pointer.at(c);
  if (Math.abs(g.pointer.x - lastPX) > 0.0005 || g.pointer.pressed) { holdX = p.x; lastPX = g.pointer.x; }
  holdX += g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]) * 330 * dt;
  const hr = cur ? cur.r : 17;
  holdX = clamp(holdX, JL + hr + 1, JR - hr - 1);
  if (cool > 0) { cool -= dt; if (cool <= 0 && !cur) { cur = nxt; nxt = genPiece(); } }
  if (g.keys.pressed("Space", "ArrowDown", "KeyS", "Enter") || g.pointer.released) dropNow();

  for (const b of bodies) {
    b.age += dt;
    if (b.r < b.tr) { b.r = Math.min(b.tr, b.r + 70 * dt); b.sleep = false; }
    if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 2.6);
    b.wobT += dt;
  }
  for (const q of rings) q.t += dt;
  if (rings.length && rings[0].t > 0.5) rings = rings.filter((q) => q.t < 0.5);
  physics(dt);
  handleEvents();

  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (happyT > 0) happyT -= dt;

  // the jar is full when a settled piece stays above the line
  let above = false;
  for (const b of bodies) if (b.age > 1.1 && b.y - b.r < LINE && b.vx * b.vx + b.vy * b.vy < 70 * 70) { above = true; break; }
  overT = above ? overT + dt : Math.max(0, overT - dt * 2);
  if (overT > 2.4) {
    g.over({ score, title: goalHit ? "64x reached" : "The jar is full", won: goalHit ? true : undefined, lines: [`Biggest x term: ${bigLabel}`, `Merges: ${merges}   Best combo: x${bestCombo}`] });
    return;
  }
  for (const q of parts) { q.t += dt; q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  if (parts.length && parts[0].t > parts[0].life) parts = parts.filter((q) => q.t < q.life);
  for (const q of pops) q.t += dt;
  if (pops.length && pops[0].t > 1.25) pops.shift();
}

// ---------- drawing ----------
const bg = document.createElement("canvas");
bg.width = W * 2; bg.height = H * 2;
function rr(x, y, w, h, r, k = ctx) { k.beginPath(); k.roundRect(x, y, w, h, r); }
function bakeBackground() {
  const k = bg.getContext("2d");
  k.setTransform(2, 0, 0, 2, 0, 0);
  const r = math.rng(11);
  let gr = k.createLinearGradient(0, 0, 0, 486);
  gr.addColorStop(0, "#4b301e"); gr.addColorStop(1, "#38220f");
  k.fillStyle = gr; k.fillRect(0, 0, W, 486);
  for (let x = 0; x < W; x += 96) {
    k.fillStyle = r() < 0.5 ? "rgba(255,220,170,0.035)" : "rgba(0,0,0,0.05)";
    k.fillRect(x, 0, 96, 486);
    k.fillStyle = "rgba(0,0,0,0.28)"; k.fillRect(x, 0, 2, 486);
    k.fillStyle = "rgba(255,225,180,0.07)"; k.fillRect(x + 2, 0, 1.5, 486);
    for (let i = 0; i < 7; i++) {
      const gx = x + 10 + r() * 76, gy = r() * 440, len = 30 + r() * 90;
      k.strokeStyle = "rgba(0,0,0,0.10)"; k.lineWidth = 1.2;
      k.beginPath(); k.moveTo(gx, gy); k.bezierCurveTo(gx + 4, gy + len * 0.3, gx - 4, gy + len * 0.7, gx + 1, gy + len); k.stroke();
    }
  }
  gr = k.createRadialGradient(480, 150, 30, 480, 200, 560);
  gr.addColorStop(0, "rgba(255,214,150,0.30)"); gr.addColorStop(1, "rgba(255,214,150,0)");
  k.fillStyle = gr; k.fillRect(0, 0, W, 486);
  // desk
  gr = k.createLinearGradient(0, 484, 0, 540);
  gr.addColorStop(0, "#d39a5c"); gr.addColorStop(1, "#a86c36");
  k.fillStyle = gr; k.fillRect(0, 484, W, 56);
  k.fillStyle = "#edc38b"; k.fillRect(0, 484, W, 3);
  k.fillStyle = "rgba(0,0,0,0.25)"; k.fillRect(0, 480, W, 4);
  for (let i = 0; i < 26; i++) {
    const gx = r() * W, gy = 492 + r() * 44, len = 40 + r() * 140;
    k.strokeStyle = "rgba(120,70,25,0.28)"; k.lineWidth = 1.3;
    k.beginPath(); k.moveTo(gx, gy); k.quadraticCurveTo(gx + len / 2, gy + (r() - 0.5) * 5, gx + len, gy); k.stroke();
  }
  // jar shadow on the desk
  k.fillStyle = "rgba(60,30,10,0.35)";
  k.beginPath(); k.ellipse(480, 492, 200, 9, 0, 0, 7); k.fill();
  // pencil on the desk
  k.save(); k.translate(716, 512); k.rotate(-0.05);
  k.fillStyle = "rgba(60,30,10,0.3)"; rr(2, 5, 170, 9, 4, k); k.fill();
  k.fillStyle = "#facc15"; k.strokeStyle = "#854d0e"; k.lineWidth = 2;
  rr(0, -6, 140, 12, 2, k); k.fill(); k.stroke();
  k.fillStyle = "#fde68a"; k.fillRect(2, -4, 136, 3);
  k.fillStyle = "#f9a8d4"; rr(-18, -6, 18, 12, 4, k); k.fill(); k.stroke();
  k.fillStyle = "#cbd5e1"; k.fillRect(-3, -6, 6, 12); k.strokeRect(-3, -6, 6, 12);
  k.fillStyle = "#f5deb3"; k.beginPath(); k.moveTo(140, -6); k.lineTo(160, 0); k.lineTo(140, 6); k.closePath(); k.fill(); k.stroke();
  k.fillStyle = "#1f2937"; k.beginPath(); k.moveTo(153, -2); k.lineTo(160, 0); k.lineTo(153, 2); k.closePath(); k.fill();
  k.restore();
  // paper notes
  const note = (x, y, w, h, rot, title) => {
    k.save(); k.translate(x + w / 2, y + h / 2); k.rotate(rot);
    k.fillStyle = "rgba(0,0,0,0.25)"; rr(-w / 2 + 3, -h / 2 + 5, w, h, 6, k); k.fill();
    k.fillStyle = "#fef7e6"; rr(-w / 2, -h / 2, w, h, 6, k); k.fill();
    k.fillStyle = "rgba(245,158,11,0.55)"; k.fillRect(-22, -h / 2 - 6, 44, 13);
    k.fillStyle = "#7c5a3a"; k.font = `800 13px ${FONT}`; k.textAlign = "center"; k.textBaseline = "middle";
    k.fillText(title, 0, -h / 2 + 20);
    k.restore();
  };
  note(712, 62, 136, 124, 0.025, "NEXT");
  note(712, 206, 136, 258, -0.012, "GOAL");
  note(60, 64, 196, 96, -0.03, "THE RULE");
  k.save(); k.translate(158, 112); k.rotate(-0.03);
  k.fillStyle = "#1e3a8a"; k.font = `800 15px ${FONT}`; k.textAlign = "center";
  k.fillText("Only like terms merge.", 0, 6);
  k.fillStyle = "#7c5a3a"; k.font = `700 13px ${FONT}`;
  k.fillText("x and 4 just bump.", 0, 27);
  k.restore();
}
bakeBackground();

function accent(f, r) {
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  if (f === "c") {
    ctx.setLineDash([r * 0.16, r * 0.2]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  } else if (f === "x") {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.74, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.74, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  } else if (f === "x2") {
    const s = r * 0.56;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath(); ctx.moveTo(sx * s, sy * s * 0.45); ctx.lineTo(sx * s, sy * s); ctx.lineTo(sx * s * 0.45, sy * s); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.09, 0, 7); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fill();
    }
  }
}
function drawPiece(p, x, y, r, sx = 1, sy = 1, alpha = 1, wa = 0, w = 0) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (w) { ctx.rotate(wa); ctx.scale(1 - w, 1 + w); ctx.rotate(-wa); } // squash along the hit direction, stretch across it
  ctx.scale(sx, sy);
  const text = pieceLabel(p);
  if (p.kind === "dbl") {
    ctx.fillStyle = "#fffbeb"; ctx.strokeStyle = "#b45309"; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, q = i % 2 ? r * 0.86 : r * 1.08; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#b45309"; ctx.font = `900 ${r * 0.95}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 1);
    ctx.restore();
    return;
  }
  const fam = FAM[p.f], neg = p.c < 0;
  const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  if (neg) { gr.addColorStop(0, "#475569"); gr.addColorStop(1, "#1e293b"); }
  else { gr.addColorStop(0, fam.light); gr.addColorStop(0.45, fam.col); gr.addColorStop(1, fam.dark); }
  // a glossy bubble: see-through body, bright rim, soft glow from below, two highlights
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.88;
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.globalAlpha = ga;
  const glow = ctx.createRadialGradient(r * 0.25, r * 0.55, 0, r * 0.25, r * 0.55, r * 0.9);
  glow.addColorStop(0, neg ? "rgba(148,163,184,0.35)" : "rgba(255,255,255,0.34)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.075);
  ctx.strokeStyle = neg ? fam.col : fam.dark;
  if (neg) ctx.setLineDash([r * 0.3, r * 0.2]);
  ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2 + 1, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  if (!neg) accent(p.f, r);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.84, Math.PI * 0.14, Math.PI * 0.42); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.3, r * 0.15, -0.65, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.66, -r * 0.14, r * 0.07, 0, 7); ctx.fill();
  const fs = r * (text.length <= 1 ? 1.05 : text.length === 2 ? 0.86 : text.length === 3 ? 0.68 : 0.55);
  ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2.5, fs * 0.2);
  ctx.strokeStyle = neg ? "#0f172a" : fam.dark; ctx.strokeText(text, 0, 1);
  ctx.fillStyle = neg ? fam.light : "#ffffff"; ctx.fillText(text, 0, 1);
  ctx.restore();
}

function render() {
  const t = g.time;
  ctx.save();
  ctx.translate(g.shakeX, g.shakeY);
  ctx.drawImage(bg, -0, 0, W, H);
  const danger = overT > 0.25;

  // Archie peeks from behind the jar
  const bob = Math.sin(t * 2.2) * 3;
  drawArchie(ctx, JL - 46, 392 + bob - (happyT > 0 ? Math.sin(happyT * 14) * 5 : 0), 176, {
    pose: danger ? "sad" : happyT > 0 ? "happy" : "idle", rotation: -0.12, t,
    look: { x: clamp((lookX - 270) / 200, -1, 1), y: clamp((lookY - 380) / 160, -1, 1) }, blink: t % 3.4 < 0.12,
  });
  if (combo >= 2 && comboT > 0) {
    const a = clamp(comboT * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(166, 268 - (1.6 - comboT) * 6); ctx.rotate(-0.06);
    ctx.fillStyle = "#fef7e6"; rr(-62, -22, 124, 44, 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(52, 40); ctx.lineTo(46, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b45309"; ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`Combo x${combo}`, 0, 1);
    ctx.restore();
  }

  // glass back
  const jx = JL - 9, jw = JR - JL + 18;
  let gr = ctx.createLinearGradient(jx, 0, jx + jw, 0);
  gr.addColorStop(0, "rgba(210,235,255,0.20)"); gr.addColorStop(0.5, "rgba(210,235,255,0.07)"); gr.addColorStop(1, "rgba(210,235,255,0.16)");
  ctx.fillStyle = gr;
  rr(jx, RIM, jw, FLOOR - RIM + 9, [8, 8, 34, 34]); ctx.fill();

  // fill line
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = danger ? `rgba(248,113,113,${0.6 + 0.4 * Math.sin(t * 16)})` : "rgba(255,255,255,0.38)";
  ctx.beginPath(); ctx.moveTo(JL + 4, LINE); ctx.lineTo(JR - 4, LINE); ctx.stroke();
  ctx.restore();

  // aim guide and the piece in hand
  if (cur && g.state !== "menu") {
    const hx = clamp(holdX, JL + cur.r + 1, JR - cur.r - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2; ctx.setLineDash([4, 9]);
    ctx.beginPath(); ctx.moveTo(hx, DROPY + cur.r + 4); ctx.lineTo(hx, FLOOR - 4); ctx.stroke(); ctx.setLineDash([]);
    drawPiece(cur, hx, DROPY + Math.sin(t * 4) * 2, cur.r);
  }

  for (const b of bodies) {
    const k = (b.sq > 0 ? Math.sin(b.sq * 9) * 0.22 * b.sq : 0) + Math.sin(t * 2.4 + b.id * 1.9) * 0.018; // merge pop plus a gentle idle wobble
    const w = b.wobT < 0.9 ? b.wob * 0.2 * Math.cos(b.wobT * 27) * Math.exp(-b.wobT * 6) : 0;
    drawPiece(b, b.x, b.y, b.r, 1 + k, 1 - k, 1, b.woba, w);
  }
  ctx.lineCap = "butt";
  for (const q of rings) {
    if (q.t < 0) continue;
    const e = q.t / 0.5;
    ctx.globalAlpha = (1 - e) * 0.9; ctx.strokeStyle = q.col; ctx.lineWidth = 1 + 5 * (1 - e);
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + 1.5 * (1 - (1 - e) * (1 - e))), 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const q of parts) {
    ctx.globalAlpha = clamp(1 - q.t / q.life, 0, 1);
    ctx.fillStyle = q.col;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // glass front: walls, rim and shine
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(226,242,255,0.62)";
  rr(jx, RIM, jw, FLOOR - RIM + 9, [8, 8, 34, 34]); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.9)";
  rr(jx - 3, RIM - 3, jw + 6, FLOOR - RIM + 15, [10, 10, 37, 37]); ctx.stroke();
  ctx.fillStyle = "rgba(226,242,255,0.5)"; ctx.strokeStyle = "rgba(255,255,255,0.95)";
  rr(jx - 12, RIM - 12, jw + 24, 16, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  rr(JL + 10, RIM + 22, 12, 220, 6); ctx.fill();
  rr(JL + 28, RIM + 30, 5, 120, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  rr(JR - 24, RIM + 60, 8, 260, 4); ctx.fill();
  if (danger) {
    ctx.fillStyle = "#fecaca"; ctx.font = `900 16px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Too full!", 480, LINE - 14);
  }

  // merge equations
  for (const q of pops) {
    const a = clamp(q.t < 0.15 ? q.t / 0.15 : 1 - (q.t - 0.85) / 0.4, 0, 1), s = q.t < 0.18 ? 0.6 + (q.t / 0.18) * 0.4 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(q.x, q.y - q.t * 34); ctx.scale(s, s);
    ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    const w = ctx.measureText(q.text).width + 24;
    ctx.fillStyle = "rgba(15,23,42,0.86)"; rr(-w / 2, -17, w, 34, 17); ctx.fill();
    ctx.fillStyle = q.col; ctx.fillText(q.text, 0, 1);
    ctx.restore();
  }

  // next piece and the goal ladder
  if (nxt && g.state !== "menu") {
    const cool2 = !cur && cool > 0;
    drawPiece(cool2 ? nxt : nxt, 781, 136, Math.min(nxt.r, 34));
  }
  ctx.save(); ctx.translate(780, 347); ctx.rotate(-0.012);
  for (let i = 0; i < GOAL.length; i++) {
    const v = GOAL[GOAL.length - 1 - i], y = -92 + i * 30, on = maxX >= v && g.state !== "menu", top = v === 64;
    ctx.fillStyle = on ? (top ? "#f59e0b" : "#3b82f6") : "rgba(30,58,138,0.08)";
    rr(-46, y - 12, 92, 25, 12.5); ctx.fill();
    if (!on) { ctx.strokeStyle = top ? "#f59e0b" : "rgba(30,58,138,0.35)"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = on ? "#fff" : top ? "#b45309" : "#1e3a8a";
    ctx.font = `900 16px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label("x", v), 0, y + 1);
  }
  ctx.restore();
  ctx.restore();
}

g.loop(update, render);

// test hooks
g.debug = {
  get bodies() { return bodies; },
  get info() { return { n: bodies.length, score, maxX, combo, bestCombo, overT: +overT.toFixed(2), goalHit, cur: cur && pieceLabel(cur), nxt: nxt && pieceLabel(nxt), asleep: bodies.filter((b) => b.sleep).length, merges }; },
  label,
  setCur(kind, f, coef) { cur = kind === "dbl" ? { kind: "dbl", r: 18 } : { kind: "term", f, c: coef, r: radius(coef) }; cool = 0; },
  dropAt(x) { holdX = x; return dropNow(); },
  spawn(f, coef, x, y) { return addBody({ kind: "term", f, c: coef, r: radius(coef) }, x, y); },
  /** A simple player for testing full runs: drops each piece onto its match when there is one. */
  autoplay(n = 1, wait = 0.75) {
    for (let i = 0; i < n && g.state === "playing"; i++) {
      if (!cur) { g.advance(0.5); if (!cur) continue; }
      let x = null;
      if (cur.kind === "dbl") { const xs = bodies.filter((b) => b.f === "x" && b.c > 0).sort((a, b) => b.c - a.c); if (xs[0]) x = xs[0].x; }
      else {
        const want = cur.c < 0 ? -cur.c : cur.c;
        const m = bodies.filter((b) => b.kind === "term" && b.f === cur.f && b.c === want).sort((a, b) => a.y - b.y)[0];
        if (m) x = m.x;
      }
      if (x == null) { const lane = { x: 0.2, c: 0.8, x2: 0.5, y: 0.62 }[cur.f] ?? 0.5; x = JL + (JR - JL) * clamp(lane + rand(-0.12, 0.12), 0.05, 0.95); }
      holdX = x; dropNow(); g.advance(wait);
    }
    return this.info;
  },
};
