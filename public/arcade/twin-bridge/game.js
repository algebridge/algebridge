// Twin Bridge: a two-twin puzzle platformer where number plates open the doors.
import { createGame, math, sfx, drawArchie, FONT, clamp, rand } from "../kit/kit.js";
import { LEVELS } from "./levels.js";

const T = 40, VW = 960, VH = 540, PW = 26, PH = 34, CR = 36, GRAV = 2200, JUMP = 660, SPEED = 210;
const MINUS = "−";
const COL = [
  { main: "#2563eb", light: "#93c5fd", rgb: "59,130,246", name: "Archie" },
  { main: "#f59e0b", light: "#fde68a", rgb: "245,158,11", name: "Amber" },
];
const TILE = { tile: true };
const num = (v) => (v < 0 ? MINUS + -v : String(v));
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

const style = document.createElement("style");
style.textContent = `
.tb-row{display:flex;gap:.5em;justify-content:center;margin:0 0 .5em;flex-wrap:wrap}
.tb-chip{font:inherit;font-weight:800;font-size:clamp(11px,1.6cqw,17px);color:#1e3a8a;background:#eff6ff;border:2px solid #bfdbfe;border-bottom-width:4px;border-radius:999px;padding:.25em 1em;cursor:pointer}
.tb-chip.on{background:#2563eb;color:#fff;border-color:#1e3a8a}
.tb-note{color:#64748b;font-weight:700;font-size:clamp(11px,1.4cqw,15px);margin:0 0 .3em}
.tb-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:clamp(4px,.9cqw,10px);margin:.4em 0 .6em}
.tb-lv{font:inherit;cursor:pointer;background:#eff6ff;border:2px solid #bfdbfe;border-bottom-width:5px;border-radius:14px;padding:.35em 0 .25em;color:#1e3a8a;display:flex;flex-direction:column;align-items:center;gap:.1em}
.tb-lv b{font-size:clamp(15px,2.6cqw,28px);font-weight:900;line-height:1}
.tb-lv span{font-size:clamp(9px,1.3cqw,14px);letter-spacing:.05em;color:#f59e0b;font-weight:900}
.tb-lv span i{color:#cbd5e1;font-style:normal}
.tb-lv:disabled{opacity:.45;cursor:default}
.tb-lv:not(:disabled):hover{background:#dbeafe}
.tb-stars{font-size:clamp(26px,5cqw,52px);color:#f59e0b;letter-spacing:.1em;line-height:1.1}
.tb-stars i{color:#e2e8f0;font-style:normal}
.tb-line{margin:.15em 0;color:#475569;font-weight:700;font-size:clamp(12px,1.6cqw,17px)}`;
document.head.appendChild(style);

const g = createGame({
  slug: "twin-bridge",
  title: "Twin Bridge",
  tagline: "Two twins, one broken bridge. Fix it span by span.",
  how: ["Get Archie and Amber to their own doors.", "Stand on number plates to make the equation true."],
  controls: [{ keys: "A D W", does: "Archie" }, { keys: "← → ↑", does: "Amber" }, { keys: "S ↓", does: "Lever" }, { keys: "R", does: "Restart" }],
  aspect: 16 / 9,
  bg: "#0a1330",
  onMenu: (el) => queueMicrotask(() => fillMenu(el)),
});
const cv = g.canvas2d(VW, VH);
const { ctx } = cv;

// ---------- progress ----------
let prog = g.load("prog", { stars: {}, time: {} });
const starsOf = (i) => prog.stars[i] || 0;
const totalStars = () => LEVELS.reduce((s, _, i) => s + starsOf(i), 0);
const unlocked = () => { let n = 0; while (n < LEVELS.length && starsOf(n) > 0) n++; return Math.min(n, LEVELS.length - 1); };
let cur = unlocked();
let unlockAll = false;
const starText = (n) => "★".repeat(n) + "<i>" + "★".repeat(3 - n) + "</i>";

function fillMenu(el) {
  if (!el || !el.isConnected) return;
  el.innerHTML = `<div class="tb-row"><button class="tb-chip" data-m="levels">Pick a span</button></div>
    <p class="tb-note">Two players, one keyboard. Archie: W A S D. Amber: arrow keys.</p>
    <p class="tb-note">Span ${cur + 1} of ${LEVELS.length} · ${totalStars()} of ${LEVELS.length * 3} stars</p>`;
  el.onclick = (e) => {
    const m = e.target.closest("[data-m]")?.dataset.m;
    if (!m) return;
    sfx.play("click");
    if (m === "levels") return showLevels();
  };
}
function showLevels() {
  const open = unlockAll ? LEVELS.length - 1 : unlocked();
  const el = g.panel(`<h2>Pick a span</h2><div class="tb-grid">${LEVELS.map((lv, i) => `<button class="tb-lv" data-i="${i}" title="${lv.name}" ${i > open ? "disabled" : ""}><b>${i + 1}</b><span>${starText(starsOf(i))}</span></button>`).join("")}</div><button class="ak-btn ak-ghost" data-a="quit">Back</button>`, "ak-wide");
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b && !b.disabled) { cur = +b.dataset.i; g.start(); }
  });
}

// ---------- level runtime ----------
let L = null, P = [], phase = "play", lvTime = 0, falls = 0, winT = 0, winHold = 0, panelShown = false, lastStars = 0;
let parts = [];
const stat = document.createElement("canvas");
stat.width = VW * 2; stat.height = VH * 2;

function loadLevel(i) {
  const src = LEVELS[i], rows = src.map, Hh = rows.length, Ww = rows[0].length;
  const grid = rows.map((r, ri) => { if (r.length !== Ww) console.error(`level ${i + 1} row ${ri} has length ${r.length}, expected ${Ww}`); return r.split(""); });
  const z = Math.min(1, VW / (Ww * T));
  const lv = { i, src, W: Ww, H: Hh, grid, z, ox: (VW - Ww * T * z) / 2, oy: VH - (Hh * T + 20) * z, waterY: (Hh - 1) * T + 12,
    plates: [], buttons: [], levers: [], doors: [], lifts: [], crates: [], decks: [], pans: [], locks: [], scales: [], ids: {}, exits: [null, null], starts: [null, null] };
  const defs = src.defs || {};
  const runH = (r, c, ch) => { let n = 0; while (grid[r][c + n] === ch) { grid[r][c + n] = "."; n++; } return n; };
  const runV = (r, c, ch) => { let n = 0; while (grid[r + n] && grid[r + n][c] === ch) { grid[r + n][c] = "."; n++; } return n; };
  for (let r = 0; r < Hh; r++) for (let c = 0; c < Ww; c++) {
    const ch = grid[r][c];
    if (ch === "." || ch === "#" || ch === "a" || ch === "b") continue;
    const cx = c * T + T / 2, fy = (r + 1) * T;
    if (ch === "A" || ch === "B") { lv.starts[ch === "A" ? 0 : 1] = { x: cx, y: fy }; grid[r][c] = "."; continue; }
    if (ch === "1" || ch === "2") { lv.exits[ch === "1" ? 0 : 1] = { x: cx, y: fy, glow: 0 }; grid[r][c] = "."; continue; }
    const d = defs[ch];
    if (!d) { console.error(`level ${i + 1}: unknown map character ${ch}`); grid[r][c] = "."; continue; }
    if (d.t === "plate") { lv.plates.push({ c, r, x: cx, y: fy, v: d.v, lock: d.lock, by: -1, press: 0 }); grid[r][c] = "."; }
    else if (d.t === "button") { const o = { c, r, x: cx, y: fy, id: d.id, down: false, press: 0 }; lv.buttons.push(o); lv.ids[d.id] = { k: "button", o }; grid[r][c] = "."; }
    else if (d.t === "lever") { const o = { c, r, x: cx, y: fy, id: d.id, on: false, a: 0 }; lv.levers.push(o); lv.ids[d.id] = { k: "lever", o }; grid[r][c] = "."; }
    else if (d.t === "door") { const n = runV(r, c, ch); lv.doors.push({ c, r, n, on: d.on, open: 0, x: c * T + 10, y: r * T, w: 20 }); }
    else if (d.t === "lift") { const n = runH(r, c, ch); lv.lifts.push({ x0: c * T, y0: r * T, x: c * T, y: r * T, w: n * T, dx: (d.dx || 0) * T, dy: (d.dy || 0) * T, on: d.on, auto: !!d.auto, t: 0, dir: 1, wait: 0.6, mdx: 0, mdy: 0 }); }
    else if (d.t === "deck") { const n = runH(r, c, ch); lv.decks.push({ x: c * T, y: r * T, w: n * T, on: d.on, a: 0 }); }
    else if (d.t === "pan") { const n = runH(r, c, ch); lv.pans.push({ x: c * T, y: fy, w: n * T, scale: d.scale }); }
    else if (d.t === "crate") { lv.crates.push({ x: cx, y: fy, hx: cx, hy: fy, w: CR, h: CR, vy: 0, ground: TILE, mdx: 0, mdy: 0, pdx: 0, wgt: d.w, label: d.label, isX: d.isX, pop: 0 }); grid[r][c] = "."; }
  }
  for (const s of src.locks || []) { const o = { ...s, open: false, va: null, vb: null, x: null, xOk: false, need: false, key: "", buzz: 0, glow: 0 }; lv.locks.push(o); lv.ids[s.id] = { k: "lock", o }; }
  for (const s of src.scales || []) { const o = { ...s, total: 0, expr: "0", hold: 0, done: false, tilt: 0, glow: 0 }; lv.scales.push(o); lv.ids[s.id] = { k: "scale", o }; }
  L = lv;
  P = [0, 1].map((k) => ({ i: k, x: lv.starts[k].x, y: lv.starts[k].y, w: PW, h: PH, vx: 0, vy: 0, grounded: true, ground: TILE, coy: 0, buf: 0, face: 1, safe: { ...lv.starts[k] }, dead: 0, mdx: 0, mdy: 0, sq: 0, pushing: false, atExit: false, blink: 0 }));
  phase = "play"; lvTime = 0; falls = 0; winT = 0; winHold = 0; panelShown = false; parts = [];
  bake();
}

function sig(expr) {
  if (!expr) return false;
  if (expr === "auto") return true;
  if (expr.includes("|")) return expr.split("|").some(sig);
  const e = L.ids[expr];
  if (!e) return false;
  return e.k === "button" ? e.o.down : e.k === "lever" ? e.o.on : e.k === "lock" ? e.o.open : e.o.done;
}
function tileSolid(c, r, who) {
  if (c < 0 || c >= L.W) return true;
  if (r < 0 || r >= L.H) return false;
  const ch = L.grid[r][c];
  return ch === "#" || (ch === "b" && who !== 1) || (ch === "a" && who !== 0);
}
function dynSolids(m) {
  const out = [];
  for (const d of L.doors) { const h = d.n * T * (1 - d.open); if (h > 3) out.push({ x: d.x, y: d.y, w: d.w, h }); }
  if (m.w !== CR) for (const d of L.decks) if (d.a > 0.97) out.push({ x: d.x, y: d.y, w: d.w, h: 14 });
  for (const c of L.crates) if (c !== m) out.push({ x: c.x - CR / 2, y: c.y - CR, w: CR, h: CR, crate: c });
  return out;
}
const hit = (m, s) => m.x - m.w / 2 < s.x + s.w - 0.01 && m.x + m.w / 2 > s.x + 0.01 && m.y - m.h < s.y + s.h - 0.01 && m.y > s.y + 0.01;

function moveX(m, dx, who, push) {
  if (!dx) return 0;
  const x0 = m.x, hw = m.w / 2;
  m.x += dx;
  const r0 = Math.floor((m.y - m.h + 0.5) / T), r1 = Math.floor((m.y - 0.5) / T);
  if (dx > 0) { const c = Math.floor((m.x + hw - 0.01) / T); for (let r = r0; r <= r1; r++) if (tileSolid(c, r, who)) { m.x = c * T - hw; break; } }
  else { const c = Math.floor((m.x - hw) / T); for (let r = r0; r <= r1; r++) if (tileSolid(c, r, who)) { m.x = (c + 1) * T + hw; break; } }
  for (const s of dynSolids(m)) {
    if (!hit(m, s)) continue;
    if (s.crate && push) {
      const need = dx > 0 ? m.x + hw - s.x : m.x - hw - (s.x + s.w);
      const moved = moveX(s.crate, need, 2, true);
      s.crate.pdx += moved;
      s.x = s.crate.x - CR / 2;
      m.pushing = true;
    }
    if (hit(m, s)) m.x = dx > 0 ? s.x - hw : s.x + s.w + hw;
  }
  return m.x - x0;
}
function moveY(m, dy, who, plats) {
  const prevB = m.y, hw = m.w / 2 - 0.5;
  m.y += dy;
  let land = null;
  const c0 = Math.floor((m.x - hw) / T), c1 = Math.floor((m.x + hw) / T);
  if (dy >= 0) {
    const r = Math.floor((m.y - 0.001) / T);
    for (let c = c0; c <= c1; c++) if (tileSolid(c, r, who) && prevB <= r * T + 1) { m.y = r * T; land = TILE; break; }
  } else {
    const r = Math.floor((m.y - m.h) / T);
    for (let c = c0; c <= c1; c++) if (tileSolid(c, r, who)) { m.y = (r + 1) * T + m.h; m.vy = 0; break; }
  }
  for (const s of dynSolids(m)) {
    if (!hit(m, s)) continue;
    if (dy >= 0 && prevB <= s.y + 8) { m.y = s.y; land = s.crate || TILE; }
    else if (dy < 0) { m.y = s.y + s.h + m.h; m.vy = 0; }
  }
  if (dy >= 0 && plats) for (const pl of plats) {
    if (m.x + hw > pl.x && m.x - hw < pl.x + pl.w && prevB <= pl.y + 6 && m.y >= pl.y) { m.y = pl.y; land = pl.ent; }
  }
  if (land) m.vy = 0;
  return land;
}

function puff(x, y, col, n, sp = 120, up = 0) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 140) parts.shift();
    const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * sp;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - up, t: 0, life: rand(0.3, 0.7), col, r: rand(2, 4.5) });
  }
}

function inputs() {
  const k = g.keys;
  const a = { x: k.axis(["KeyA"], ["KeyD"]), jp: k.pressed("KeyW"), jh: k.down("KeyW"), use: k.pressed("KeyS") };
  const b = { x: k.axis(["ArrowLeft"], ["ArrowRight"]), jp: k.pressed("ArrowUp"), jh: k.down("ArrowUp"), use: k.pressed("ArrowDown") };
  return [a, b];
}

function updatePlayer(p, inp, dt) {
  const o = P[1 - p.i];
  if (p.dead > 0) {
    p.dead -= dt;
    if (p.dead <= 0) { p.x = p.safe.x; p.y = p.safe.y; p.vx = p.vy = 0; p.blink = 1; p.ground = TILE; p.grounded = true; puff(p.x, p.y - 16, COL[p.i].light, 10); sfx.play("pop"); }
    p.mdx = p.mdy = 0;
    return;
  }
  const x0 = p.x, y0 = p.y;
  if (p.ground && p.ground !== TILE) {
    if (p.ground.mdx) moveX(p, p.ground.mdx, p.i, false);
    if (p.ground.mdy) p.y += p.ground.mdy;
  }
  for (const c of L.crates) {
    const s = { x: c.x - CR / 2, y: c.y - CR, w: CR, h: CR };
    if (hit(p, s) && p.y > s.y + 10) p.x += (p.x < c.x ? -1 : 1) * 3;
  }
  const carrying = o.dead <= 0 && o.ground === p;
  const want = inp.x * (p.pushing ? 115 : SPEED);
  const acc = (p.grounded ? 2600 : 1700) * dt;
  p.vx += clamp(want - p.vx, -acc, acc);
  if (inp.x) p.face = inp.x;
  p.buf = inp.jp ? 0.12 : p.buf - dt;
  p.coy = p.grounded ? 0.1 : p.coy - dt;
  if (p.buf > 0 && p.coy > 0) {
    p.buf = 0;
    if (carrying) { sfx.tone(160, 0.08, { type: "square", vol: 0.15 }); p.sq = 0.5; }
    else { p.vy = -JUMP; p.coy = 0; p.grounded = false; p.ground = null; p.sq = 1; sfx.play("jump"); puff(p.x, p.y, "#cbd5e1", 4, 70); }
  }
  if (!inp.jh && p.vy < -250) p.vy = -250;
  p.vy = Math.min(p.vy + GRAV * dt, 900);
  p.pushing = false;
  const mx = p.vx * dt;
  if (mx && Math.abs(moveX(p, mx, p.i, p.grounded)) < Math.abs(mx) * 0.5 && !p.pushing) p.vx = 0;
  const plats = L.lifts.map((l) => ({ x: l.x, y: l.y, w: l.w, ent: l }));
  if (o.dead <= 0) plats.push({ x: o.x - PW / 2, y: o.y - PH, w: PW, ent: o });
  const fall = p.vy;
  const land = moveY(p, p.vy * dt, p.i, plats);
  if (land && !p.grounded) { if (fall > 420) { sfx.play("land"); puff(p.x, p.y, "#cbd5e1", 5, 80); } p.sq = Math.max(p.sq, 0.6); }
  p.grounded = !!land;
  p.ground = land;
  if (land === TILE && L.grid[Math.floor(p.y / T + 0.01)]?.[Math.floor(p.x / T)] !== undefined) p.safe = { x: p.x, y: p.y };
  if (inp.use && p.grounded) for (const lv of L.levers) if (Math.abs(p.x - lv.x) < 24 && Math.abs(p.y - lv.y) < 8) { lv.on = !lv.on; sfx.play("click"); sfx.tone(lv.on ? 520 : 330, 0.1, { vol: 0.3, delay: 0.03 }); }
  p.mdx = p.x - x0; p.mdy = p.y - y0;
  if (p.sq > 0) p.sq = Math.max(0, p.sq - dt * 4);
  if (p.blink > 0) p.blink -= dt;
  if (p.y - 12 > L.waterY) { p.dead = 0.75; falls++; sfx.noise(0.3, { freq: 1600, vol: 0.5 }); sfx.tone(300, 0.2, { slide: 120, type: "sine", vol: 0.4 }); puff(p.x, L.waterY, "#bfdbfe", 16, 200, 220); g.shake(4, 0.15); }
}

function onSpot(m, x, y, half) { return Math.abs(m.x - x) < half && Math.abs(m.y - y) < 6; }

function update(dt) {
  if (phase === "won") {
    winT += dt;
    for (const q of parts) { q.t += dt; q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (winT > 0.9 && !panelShown) showWin();
    else if (panelShown && g.keys.pressed("Enter", "Space")) nextLevel();
    return;
  }
  lvTime += dt;
  if (g.keys.pressed("KeyR")) { loadLevel(cur); sfx.play("whoosh"); return; }

  // lifts
  for (const l of L.lifts) {
    const px = l.x, py = l.y, on = sig(l.on), dist = Math.hypot(l.dx, l.dy) || 1, v = (100 / dist) * dt;
    if (l.auto) {
      if (on) {
        if (l.wait > 0) l.wait -= dt;
        else { l.t += l.dir * v; if (l.t >= 1) { l.t = 1; l.dir = -1; l.wait = 1.2; } else if (l.t <= 0) { l.t = 0; l.dir = 1; l.wait = 1.2; } }
      } else { l.t = Math.max(0, l.t - v); l.dir = 1; l.wait = 0.4; }
    } else l.t = clamp(l.t + (on ? v : -v), 0, 1);
    l.x = l.x0 + l.dx * l.t; l.y = l.y0 + l.dy * l.t;
    l.mdx = l.x - px; l.mdy = l.y - py;
  }
  // crates
  const liftPlats = L.lifts.map((l) => ({ x: l.x, y: l.y, w: l.w, ent: l }));
  for (const c of L.crates) {
    c.mdx = c.pdx; c.pdx = 0;
    const y0 = c.y;
    if (c.ground && c.ground !== TILE) { if (c.ground.mdx) moveX(c, c.ground.mdx, 2, false); if (c.ground.mdy) c.y += c.ground.mdy; }
    c.vy = Math.min(c.vy + GRAV * dt, 900);
    const fall = c.vy;
    const land = moveY(c, c.vy * dt, 2, liftPlats);
    if (land && !c.ground && fall > 300) { sfx.play("land"); puff(c.x, c.y, "#cbd5e1", 6, 90); }
    c.ground = land;
    c.mdy = c.y - y0;
    if (c.pop > 0) c.pop -= dt;
    if (c.y - 20 > L.waterY) { puff(c.x, L.waterY, "#bfdbfe", 14, 180, 200); sfx.noise(0.25, { freq: 1400, vol: 0.4 }); c.x = c.hx; c.y = c.hy; c.vy = 0; c.pop = 0.4; }
  }
  // twins
  const inp = inputs();
  const order = P[0].ground === P[1] ? [1, 0] : [0, 1];
  for (const k of order) updatePlayer(P[k], inp[k], dt);

  // buttons and plates
  const alive = P.filter((p) => p.dead <= 0 && p.grounded);
  for (const b of L.buttons) {
    const d = alive.some((p) => onSpot(p, b.x, b.y, 19)) || L.crates.some((c) => onSpot(c, b.x, b.y, 24));
    if (d !== b.down) { b.down = d; sfx.tone(d ? 440 : 300, 0.06, { type: "square", vol: 0.2 }); }
  }
  const plateOf = [null, null];
  for (const pl of L.plates) {
    pl.by = -1;
    for (const p of alive) if (onSpot(p, pl.x, pl.y, 19)) { if (pl.by < 0) pl.by = p.i; plateOf[p.i] = pl; }
    const t = pl.by >= 0 ? 1 : 0;
    if (t && pl.press === 0) sfx.play("tick");
    pl.press = t;
  }
  // locks
  for (const k of L.locks) {
    if (k.buzz > 0) k.buzz -= dt;
    if (k.glow > 0) k.glow -= dt;
    if (k.open) continue;
    const mine = (pl) => (pl && pl.lock === k.id ? pl.v : null);
    let ok = false, key = "", bad = false;
    if (k.type === "solve") {
      const xs = [mine(plateOf[0]), mine(plateOf[1])].filter((v) => v != null);
      const x = xs.find((v) => k.f(v) === k.rhs) ?? xs[0] ?? null;
      k.x = x; k.xOk = x != null && k.f(x) === k.rhs;
      const also = !k.also || sig(k.also);
      k.need = k.xOk && !also;
      ok = k.xOk && also; key = x == null ? "" : String(x); bad = x != null && !k.xOk;
    } else {
      k.va = mine(plateOf[0]); k.vb = plateOf[1] === plateOf[0] ? null : mine(plateOf[1]);
      const full = k.va != null && k.vb != null;
      ok = full && (k.type === "sum" ? k.va + k.vb : k.type === "prod" ? k.va * k.vb : k.va - k.vb) === k.target;
      key = full ? k.va + "," + k.vb : ""; bad = full && !ok;
    }
    if (key !== k.key) { k.key = key; if (bad) { k.buzz = 0.45; sfx.tone(150, 0.2, { type: "sawtooth", vol: 0.22 }); } }
    if (ok) { k.open = true; k.glow = 1.2; sfx.play("correct"); const d = L.doors.find((d) => d.on === k.id); if (d) puff(d.x + 10, d.y + d.n * T / 2, "#86efac", 18, 200); }
  }
  // scales
  for (const s of L.scales) {
    const pan = L.pans.find((p) => p.scale === s.id);
    let nx = 0, units = 0;
    for (const c of L.crates) if (c.ground && Math.abs(c.y - pan.y) < 3 && c.x > pan.x && c.x < pan.x + pan.w) { if (c.isX) nx++; else units += c.wgt; }
    s.total = nx * s.xval + units;
    s.expr = (nx ? (nx > 1 ? nx : "") + "x" : "") + (units ? (nx ? " + " : "") + units : nx ? "" : "0");
    const tt = s.done ? 0 : clamp((s.leftW - s.total) / 4, -1, 1);
    s.tilt += clamp(tt - s.tilt, -dt * 3, dt * 3);
    if (s.glow > 0) s.glow -= dt;
    if (!s.done) { if (s.total === s.leftW) { s.hold += dt; if (s.hold > 0.5) { s.done = true; s.glow = 1.2; sfx.play("correct"); g.shake(5, 0.25); } } else s.hold = 0; }
  }
  // doors and decks
  for (const d of L.doors) {
    const want = sig(d.on) ? 1 : 0;
    if (want > d.open) { if (d.open === 0) sfx.play("whoosh"); d.open = Math.min(1, d.open + dt * 3.5); }
    else if (want < d.open) {
      const full = { x: d.x, y: d.y, w: d.w, h: d.n * T };
      if (!P.some((p) => p.dead <= 0 && hit(p, full)) && !L.crates.some((c) => hit(c, full))) d.open = Math.max(0, d.open - dt * 3.5);
    }
  }
  for (const d of L.decks) { if (sig(d.on) && d.a < 1) { d.a = Math.min(1, d.a + dt * 1.4); if (d.a === 1) { sfx.play("land"); g.shake(4, 0.2); puff(d.x + d.w, d.y, "#cbd5e1", 10, 120); } } }

  // exits
  let both = true;
  for (const p of P) { const e = L.exits[p.i]; p.atExit = p.dead <= 0 && p.grounded && Math.abs(p.x - e.x) < 17 && Math.abs(p.y - e.y) < 5; e.glow += clamp((p.atExit ? 1 : 0) - e.glow, -dt * 4, dt * 4); both = both && p.atExit; }
  winHold = both ? winHold + dt : 0;
  if (winHold > 0.25) win();

  for (const q of parts) { q.t += dt; q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  if (parts.length && parts[0].t > parts[0].life) parts = parts.filter((q) => q.t < q.life);
  g.setHud("Time", fmt(lvTime));
}

function win() {
  phase = "won"; winT = 0; panelShown = false;
  lastStars = 1 + (lvTime <= L.src.par ? 1 : 0) + (falls === 0 ? 1 : 0);
  if (lastStars > starsOf(cur)) prog.stars[cur] = lastStars;
  if (!prog.time[cur] || lvTime < prog.time[cur]) prog.time[cur] = Math.round(lvTime * 10) / 10;
  g.save("prog", prog);
  sfx.play("win");
  for (const p of P) puff(p.x, p.y - 20, COL[p.i].light, 16, 220, 120);
}
function showWin() {
  panelShown = true;
  if (cur === LEVELS.length - 1) {
    const done = cur + 1;
    cur = 0;
    g.over({ won: true, score: totalStars(), scoreLabel: "Stars", title: "The bridge is fixed", lines: [`All ${done} spans repaired.`, `Last span: ${fmt(lvTime)}, ${lastStars} of 3 stars`], again: "Play again" });
    return;
  }
  const el = g.panel(`<h2>Span ${cur + 1} repaired</h2><div class="tb-stars">${starText(lastStars)}</div>
    <p class="tb-line">Time ${fmt(lvTime)} ${lvTime <= L.src.par ? "· fast" : `· star under ${fmt(L.src.par)}`}</p>
    <p class="tb-line">${falls === 0 ? "No splashes" : falls === 1 ? "1 splash" : falls + " splashes"}</p>
    <button class="ak-btn" data-w="next">Next span</button>
    <div class="tb-row" style="margin-top:.6em"><button class="tb-chip" data-w="again">Again</button><button class="tb-chip" data-w="levels">All spans</button></div>`, "ak-small");
  el.addEventListener("click", (e) => {
    const w = e.target.closest("[data-w]")?.dataset.w;
    if (!w) return;
    sfx.play("click");
    if (w === "next") nextLevel();
    else if (w === "again") { g.closePanel(); startLevel(cur); }
    else showLevels();
  });
}
function startLevel(i) {
  cur = clamp(i, 0, LEVELS.length - 1);
  loadLevel(cur);
  g.setHud("Span", `${cur + 1}/${LEVELS.length}`);
  g.setHud("Time", "0:00");
}
function nextLevel() { g.closePanel(); startLevel(cur + 1); }
g.onStart = () => startLevel(cur);
// touch: Archie's pad on the left, Amber's on the right, so two people can share one screen
g.touchButtons([
  { code: "KeyA", label: "◀", side: "left" }, { code: "KeyD", label: "▶", side: "left" }, { code: "KeyW", label: "Jump", side: "left" }, { code: "KeyS", label: "Use", side: "left" },
  { code: "ArrowDown", label: "Use", side: "right" }, { code: "ArrowUp", label: "Jump", side: "right" }, { code: "ArrowLeft", label: "◀", side: "right" }, { code: "ArrowRight", label: "▶", side: "right" },
]);

// ---------- drawing ----------
function rr(k, x, y, w, h, r) { k.beginPath(); k.roundRect(x, y, w, h, r); }
function bake() {
  const k = stat.getContext("2d");
  k.setTransform(2, 0, 0, 2, 0, 0);
  const rnd = math.rng(L.i * 7 + 3);
  let gr = k.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, "#0a1330"); gr.addColorStop(1, "#11254f");
  k.fillStyle = gr; k.fillRect(0, 0, VW, VH);
  // blueprint grid
  for (let x = 0; x <= VW; x += 20) { k.fillStyle = x % 100 === 0 ? "rgba(147,197,253,0.10)" : "rgba(147,197,253,0.04)"; k.fillRect(x, 0, 1, VH); }
  for (let y = 0; y <= VH; y += 20) { k.fillStyle = y % 100 === 0 ? "rgba(147,197,253,0.10)" : "rgba(147,197,253,0.04)"; k.fillRect(0, y, VW, 1); }
  // a far bridge, sketched
  k.strokeStyle = "rgba(147,197,253,0.13)"; k.lineWidth = 2;
  const deckY = 330;
  for (const tx of [250, 710]) {
    k.strokeRect(tx - 9, 90, 18, 300);
    k.beginPath(); k.moveTo(tx - 9, 150); k.lineTo(tx + 9, 150); k.moveTo(tx - 9, 210); k.lineTo(tx + 9, 210); k.stroke();
  }
  k.beginPath(); k.moveTo(-20, 220); k.quadraticCurveTo(120, 300, 250, 92); k.quadraticCurveTo(480, 420, 710, 92); k.quadraticCurveTo(840, 300, 980, 220); k.stroke();
  k.lineWidth = 1;
  for (let x = 20; x < VW; x += 26) {
    const u = x < 250 ? (x + 20) / 270 : x < 710 ? (x - 250) / 460 : (x - 710) / 270;
    const cy = x < 250 ? (1 - u) * (1 - u) * 220 + 2 * (1 - u) * u * 300 + u * u * 92 : x < 710 ? (1 - u) * (1 - u) * 92 + 2 * (1 - u) * u * 420 + u * u * 92 : (1 - u) * (1 - u) * 92 + 2 * (1 - u) * u * 300 + u * u * 220;
    if (cy < deckY) { k.beginPath(); k.moveTo(x, cy); k.lineTo(x, deckY); k.stroke(); }
  }
  k.lineWidth = 2; k.beginPath(); k.moveTo(0, deckY); k.lineTo(VW, deckY); k.moveTo(0, deckY + 10); k.lineTo(VW, deckY + 10); k.stroke();
  k.setLineDash([6, 6]); k.lineWidth = 1.2; k.strokeStyle = "rgba(147,197,253,0.16)";
  k.beginPath(); k.moveTo(250, 62); k.lineTo(710, 62); k.moveTo(250, 54); k.lineTo(250, 70); k.moveTo(710, 54); k.lineTo(710, 70); k.stroke();
  k.beginPath(); k.arc(480, 250, 150, -0.5, 0.9); k.stroke();
  k.setLineDash([]);

  k.save();
  k.translate(L.ox, L.oy); k.scale(L.z, L.z);
  const solid = (c, r) => c < 0 || c >= L.W || r >= L.H || (r >= 0 && L.grid[r][c] === "#");
  const viewBottom = (VH - L.oy) / L.z, viewTop = -L.oy / L.z;
  // lamps
  for (let c = 3; c < L.W; c += 6) {
    let first = 0; while (first < L.H && L.grid[first][c] !== "#" && L.grid[first][c] !== "a" && L.grid[first][c] !== "b") first++;
    if (first < 3) continue;
    const x = c * T + T / 2, y = Math.min(first * T - 60, 50 + rnd() * 60);
    k.strokeStyle = "#1c2a4d"; k.lineWidth = 3; k.beginPath(); k.moveTo(x, viewTop); k.lineTo(x, y - 14); k.stroke();
    gr = k.createRadialGradient(x, y + 6, 4, x, y + 6, 150);
    gr.addColorStop(0, "rgba(253,186,116,0.36)"); gr.addColorStop(0.4, "rgba(253,186,116,0.10)"); gr.addColorStop(1, "rgba(253,186,116,0)");
    k.fillStyle = gr; k.fillRect(x - 150, y - 144, 300, 300);
    k.fillStyle = "#fde68a"; k.beginPath(); k.arc(x, y + 4, 7, 0, 7); k.fill();
    k.fillStyle = "#22335a"; k.strokeStyle = "#0f1a36"; k.lineWidth = 2;
    k.beginPath(); k.moveTo(x - 7, y - 14); k.lineTo(x + 7, y - 14); k.lineTo(x + 16, y + 3); k.lineTo(x - 16, y + 3); k.closePath(); k.fill(); k.stroke();
    k.fillStyle = "#f59e0b"; k.fillRect(x - 16, y + 1, 32, 3);
  }
  // steel
  for (let r = 0; r < L.H; r++) for (let c = 0; c < L.W; c++) {
    const ch = L.grid[r][c], x = c * T, y = r * T;
    if (ch === "#") {
      const h = r === L.H - 1 ? viewBottom - y : T;
      k.fillStyle = "#27385d"; k.fillRect(x, y, T + 0.5, h + 0.5);
      k.strokeStyle = "rgba(125,155,205,0.14)"; k.lineWidth = 3;
      k.beginPath(); k.moveTo(x + 4, y + 4); k.lineTo(x + T - 4, y + T - 4); k.moveTo(x + T - 4, y + 4); k.lineTo(x + 4, y + T - 4); k.stroke();
      if (!solid(c, r - 1)) {
        k.fillStyle = "#6f8bb5"; k.fillRect(x, y, T + 0.5, 9);
        k.fillStyle = "#a9c0e0"; k.fillRect(x, y, T + 0.5, 2.5);
        k.fillStyle = "rgba(5,10,30,0.3)"; k.fillRect(x, y + 9, T + 0.5, 3);
        k.fillStyle = "#2b3d63"; for (const dx of [8, 32]) { k.beginPath(); k.arc(x + dx, y + 5.4, 1.8, 0, 7); k.fill(); }
      }
      k.fillStyle = "#0f1a36";
      if (!solid(c - 1, r)) k.fillRect(x, y, 2.5, h);
      if (!solid(c + 1, r)) k.fillRect(x + T - 2.5, y, 2.5, h);
      if (!solid(c, r + 1)) k.fillRect(x, y + T - 3, T, 3);
    } else if (ch === "a" || ch === "b") {
      const col = COL[ch === "b" ? 0 : 1];
      k.fillStyle = `rgba(${col.rgb},0.20)`; k.fillRect(x, y, T + 0.5, T);
      k.save(); k.beginPath(); k.rect(x, y + 9, T, T - 15); k.clip();
      k.strokeStyle = `rgba(${col.rgb},0.45)`; k.lineWidth = 3;
      for (let d = -T; d < T; d += 13) { k.beginPath(); k.moveTo(x + d, y + T); k.lineTo(x + d + T, y); k.stroke(); }
      k.restore();
      k.shadowColor = col.main; k.shadowBlur = 10;
      k.fillStyle = col.main; k.fillRect(x, y, T + 0.5, 9);
      k.shadowBlur = 0;
      k.fillStyle = col.light; k.fillRect(x, y, T + 0.5, 2.5);
      k.fillStyle = `rgba(${col.rgb},0.8)`; k.fillRect(x, y + T - 6, T + 0.5, 6);
      k.fillStyle = "#0f1a36";
      if (L.grid[r][c - 1] !== ch) k.fillRect(x, y, 2.5, T);
      if (L.grid[r][c + 1] !== ch) k.fillRect(x + T - 2.5, y, 2.5, T);
    }
  }
  k.restore();
}

function label(text, x, y, size, fill, weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
function box(x, y, w, h, col, text, state) {
  ctx.fillStyle = state === "ok" ? "rgba(16,185,129,0.35)" : state === "bad" ? "rgba(239,68,68,0.35)" : `rgba(${col.rgb},0.22)`;
  rr(ctx, x - w / 2, y - h / 2, w, h, 7); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = col.main === "#2563eb" ? "#60a5fa" : col.main; ctx.stroke();
  if (text != null) label(text, x, y + 1, 19, "#fff");
}
function panelBG(x, y, w, h, tone, shake) {
  ctx.save();
  ctx.translate(x + shake, y);
  ctx.fillStyle = "rgba(8,16,40,0.94)"; rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = tone; ctx.stroke();
  ctx.fillStyle = tone; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - 8), -h / 2 + 8, 2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(sx * (w / 2 - 8), h / 2 - 8, 2, 0, 7); ctx.fill(); }
}
function drawLock(k) {
  const x = k.at[0] * T, y = k.at[1] * T, t = g.time;
  const tone = k.open ? "#34d399" : k.buzz > 0 ? "#f87171" : "#93c5fd";
  const shake = k.buzz > 0 ? Math.sin(t * 60) * 5 * k.buzz * 2 : 0;
  const d = L.doors.find((q) => q.on === k.id);
  if (d) { ctx.strokeStyle = k.open ? "rgba(52,211,153,0.5)" : "rgba(147,197,253,0.3)"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(d.x + 10, y + 26); ctx.lineTo(d.x + 10, d.y); ctx.stroke(); ctx.setLineDash([]); }
  if (k.type === "solve") {
    ctx.font = `900 24px ${FONT}`;
    const tw = ctx.measureText(k.text).width, w = tw + 150 + (k.also ? 44 : 0);
    panelBG(x, y, w, 56, tone, shake);
    let px = -w / 2 + 18;
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.font = `900 24px ${FONT}`; ctx.fillText(k.text, px, 1);
    px += tw + 22;
    ctx.fillStyle = "#93c5fd"; ctx.font = `800 20px ${FONT}`; ctx.fillText("x =", px, 1);
    box(px + 62, 0, 42, 34, { rgb: "226,232,240", main: "#e2e8f0" }, k.x == null ? null : num(k.x), k.x == null ? "" : k.xOk ? "ok" : "bad");
    if (k.also) {
      const bx = px + 112, on = sig(k.also), pulse = k.need ? 0.5 + 0.5 * Math.sin(t * 10) : 0;
      ctx.fillStyle = "#475569"; rr(ctx, bx - 13, 6, 26, 7, 3); ctx.fill();
      ctx.fillStyle = on ? "#34d399" : `rgb(${239},${68 + pulse * 120},${68 + pulse * 60})`;
      ctx.beginPath(); ctx.arc(bx, 6, on ? 6 : 9, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
    return;
  }
  const op = k.type === "sum" ? "+" : k.type === "prod" ? "×" : MINUS;
  const tt = num(k.target), w = 190 + tt.length * 12;
  panelBG(x, y, w, 56, tone, shake);
  const st = k.open ? "ok" : k.va != null && k.vb != null ? "bad" : "";
  let px = -w / 2 + 38;
  box(px, 0, 46, 36, COL[0], k.va == null ? null : num(k.va), st); px += 40;
  label(op, px, 1, 24, "#fff"); px += 40;
  box(px, 0, 46, 36, COL[1], k.vb == null ? null : num(k.vb), st); px += 42;
  label("=", px, 1, 24, "#fff"); px += 20 + tt.length * 7;
  label(tt, px, 1, 26, "#fff");
  ctx.restore();
}
function drawScale(s) {
  const x = s.at[0] * T, y = s.at[1] * T;
  const tone = s.done ? "#34d399" : "#93c5fd";
  panelBG(x, y, 300, 112, tone, 0);
  label(`x = ${s.xval}`, 0, -40, 17, "#fde68a", 800);
  ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-10, 44); ctx.lineTo(10, 44); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(0, -12); ctx.rotate(-s.tilt * 0.14);
  ctx.fillStyle = "#cbd5e1"; rr(ctx, -112, -3, 224, 6, 3); ctx.fill();
  ctx.fillStyle = tone; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
  ctx.restore();
  const side = (sx, text, col, live) => {
    const py = -12 - sx * Math.sin(-s.tilt * 0.14) * -92 + 30;
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx * 92, py - 30); ctx.lineTo(sx * 92 - 30, py - 12); ctx.moveTo(sx * 92, py - 30); ctx.lineTo(sx * 92 + 30, py - 12); ctx.stroke();
    ctx.fillStyle = live ? `rgba(${COL[1].rgb},0.25)` : `rgba(${COL[0].rgb},0.25)`; rr(ctx, sx * 92 - 46, py - 14, 92, 32, 8); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    label(text, sx * 92, py + 3, 19, "#fff");
  };
  side(-1, s.left, "#60a5fa", false);
  side(1, s.expr, "#f59e0b", true);
  ctx.fillStyle = "#0b1430"; ctx.beginPath(); ctx.arc(0, 32, 13, 0, 7); ctx.fill();
  label(s.done || s.total === s.leftW ? "=" : "≠", 0, 33, 21, s.done ? "#34d399" : "#f87171");
  ctx.restore();
}

function drawTwin(p, t) {
  if (p.dead > 0) return;
  const c = COL[p.i], cy = p.y - 17.5;
  const pose = p.atExit ? "happy" : !p.grounded ? "jump" : Math.abs(p.vx) > 40 ? "run" : "idle";
  const k = p.sq > 0 ? Math.sin(p.sq * 3.1) * 0.16 : 0;
  const sx = 1 + k, sy = 1 - k, flip = p.face < 0;
  if (p.blink > 0 && Math.floor(p.blink * 12) % 2) return;
  const o = P[1 - p.i];
  drawArchie(ctx, p.x, cy + 17.5 * k, 47, { pose, t, flip, color: c.main, squashX: sx, squashY: sy, blink: (t + p.i * 1.3) % 3.6 < 0.12, look: { x: clamp((o.x - p.x) / 200, -1, 1) * (flip ? -1 : 1), y: clamp((o.y - p.y) / 150, -1, 1) } });
  if (p.i === 1) {
    ctx.save(); ctx.translate(p.x, cy + 17.5 * k); ctx.scale((47 / 120) * sx * (flip ? -1 : 1), (47 / 120) * sy); ctx.translate(-60, -60);
    ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.stroke(new Path2D("M31.5 47 C33 35 40.5 26 50 23"));
    ctx.restore();
  }
}

function render() {
  if (!L) return;
  const t = g.time;
  ctx.drawImage(stat, 0, 0, VW, VH);
  ctx.save();
  ctx.translate(L.ox + g.shakeX, L.oy + g.shakeY);
  ctx.scale(L.z, L.z);
  const viewBottom = (VH - L.oy) / L.z, viewL = -L.ox / L.z, viewR = (VW - L.ox) / L.z;

  // lift rails
  for (const l of L.lifts) {
    ctx.strokeStyle = "rgba(147,197,253,0.22)"; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
    for (const dx of [6, l.w - 6]) { ctx.beginPath(); ctx.moveTo(l.x0 + dx, l.y0 + 5); ctx.lineTo(l.x0 + l.dx + dx, l.y0 + l.dy + 5); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  // exits
  L.exits.forEach((e, i) => {
    if (!e) return;
    const c = COL[i];
    const gr = ctx.createRadialGradient(e.x, e.y - 24, 4, e.x, e.y - 24, 60 + e.glow * 20);
    gr.addColorStop(0, `rgba(${c.rgb},${0.35 + e.glow * 0.3})`); gr.addColorStop(1, `rgba(${c.rgb},0)`);
    ctx.fillStyle = gr; ctx.fillRect(e.x - 80, e.y - 104, 160, 130);
    ctx.beginPath(); ctx.moveTo(e.x - 17, e.y); ctx.lineTo(e.x - 17, e.y - 30); ctx.arc(e.x, e.y - 30, 17, Math.PI, 0); ctx.lineTo(e.x + 17, e.y); ctx.closePath();
    ctx.fillStyle = `rgba(${c.rgb},${0.22 + e.glow * 0.3 + Math.sin(t * 3 + i) * 0.05})`; ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = c.main; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = c.light; ctx.stroke();
    ctx.fillStyle = c.light; ctx.beginPath(); ctx.arc(e.x, e.y - 54, 3.5, 0, 7); ctx.fill();
  });
  // pans
  for (const p of L.pans) {
    const s = L.ids[p.scale].o;
    ctx.fillStyle = s.done ? "#34d399" : "#f59e0b"; rr(ctx, p.x + 2, p.y - 5, p.w - 4, 5, 2); ctx.fill();
    ctx.fillStyle = "rgba(15,26,54,0.8)"; for (let x = p.x + 12; x < p.x + p.w - 8; x += 16) ctx.fillRect(x, p.y - 5, 6, 5);
    const gr = ctx.createLinearGradient(0, p.y - 70, 0, p.y);
    gr.addColorStop(0, "rgba(245,158,11,0)"); gr.addColorStop(1, s.done ? "rgba(52,211,153,0.16)" : "rgba(245,158,11,0.14)");
    ctx.fillStyle = gr; ctx.fillRect(p.x + 2, p.y - 70, p.w - 4, 65);
  }
  // plates
  for (const pl of L.plates) {
    const c = pl.by >= 0 ? COL[pl.by] : null, dn = pl.press ? 3 : 0;
    ctx.fillStyle = "#16233f"; rr(ctx, pl.x - 19, pl.y - 4, 38, 4, 2); ctx.fill();
    ctx.fillStyle = c ? c.main : "#94a3b8"; rr(ctx, pl.x - 16, pl.y - 8 + dn, 32, 6, 3); ctx.fill();
    ctx.fillStyle = c ? c.light : "#e2e8f0"; ctx.fillRect(pl.x - 13, pl.y - 8 + dn, 26, 1.8);
    const ty = pl.y - 62 + Math.sin(t * 2 + pl.c) * 1.5, text = num(pl.v), w = 22 + text.length * 9;
    ctx.strokeStyle = c ? `rgba(${c.rgb},0.6)` : "rgba(147,197,253,0.25)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(pl.x, ty + 14); ctx.lineTo(pl.x, pl.y - 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c ? c.main : "#0c1a3d"; rr(ctx, pl.x - w / 2, ty - 13, w, 26, 8); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = c ? c.light : "#93c5fd"; ctx.stroke();
    label(text, pl.x, ty + 1, 17, "#fff");
  }
  // buttons
  for (const b of L.buttons) {
    ctx.fillStyle = "#475569"; rr(ctx, b.x - 15, b.y - 5, 30, 5, 2); ctx.fill();
    ctx.fillStyle = b.down ? "#34d399" : "#ef4444"; ctx.strokeStyle = "#0f1a36"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 5, 11, b.down ? 3 : 9, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // levers
  for (const lv of L.levers) {
    lv.a += clamp((lv.on ? 1 : -1) - lv.a, -0.2, 0.2);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 5; ctx.lineCap = "round";
    const ex = lv.x + lv.a * 14, ey = lv.y - 26;
    ctx.beginPath(); ctx.moveTo(lv.x, lv.y - 6); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = lv.on ? "#34d399" : "#f59e0b"; ctx.strokeStyle = "#0f1a36"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#475569"; rr(ctx, lv.x - 14, lv.y - 8, 28, 8, 3); ctx.fill(); ctx.stroke();
  }
  // doors
  for (const d of L.doors) {
    const h = d.n * T * (1 - d.open);
    ctx.fillStyle = "#1c2a4d"; rr(ctx, d.x - 6, d.y - 6, d.w + 12, 10, 3); ctx.fill();
    if (h > 1) {
      ctx.save(); rr(ctx, d.x, d.y, d.w, h, [0, 0, 4, 4]); ctx.clip();
      ctx.fillStyle = "#475569"; ctx.fillRect(d.x, d.y, d.w, h);
      ctx.fillStyle = "#f59e0b";
      for (let y = d.y + h - 14; y > d.y - 30; y -= 28) { ctx.beginPath(); ctx.moveTo(d.x, y + 14); ctx.lineTo(d.x + d.w, y); ctx.lineTo(d.x + d.w, y - 12); ctx.lineTo(d.x, y + 2); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(d.x + 2, d.y, 3, h);
      ctx.restore();
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#0f1a36"; rr(ctx, d.x, d.y, d.w, h, [0, 0, 4, 4]); ctx.stroke();
    }
  }
  // decks
  for (const d of L.decks) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((1 - d.a) * (1 - d.a) * 0.95 + (d.a < 1 ? Math.sin(t * 1.6) * 0.02 : 0));
    ctx.fillStyle = "#3b4f7a"; ctx.fillRect(0, 0, d.w, 14);
    ctx.fillStyle = "#6f8bb5"; ctx.fillRect(0, 0, d.w, 7);
    ctx.fillStyle = "#a9c0e0"; ctx.fillRect(0, 0, d.w, 2.5);
    ctx.fillStyle = "#2b3d63"; for (let x = 10; x < d.w; x += 20) { ctx.beginPath(); ctx.arc(x, 4.6, 1.6, 0, 7); ctx.fill(); }
    ctx.lineWidth = 2; ctx.strokeStyle = "#0f1a36"; ctx.strokeRect(0, 0, d.w, 14);
    ctx.restore();
  }
  // lifts
  for (const l of L.lifts) {
    ctx.fillStyle = "#6f8bb5"; rr(ctx, l.x, l.y, l.w, 11, 3); ctx.fill();
    ctx.fillStyle = "#f59e0b"; for (let x = l.x + 8; x < l.x + l.w - 10; x += 16) { ctx.beginPath(); ctx.moveTo(x, l.y + 9); ctx.lineTo(x + 5, l.y + 3); ctx.lineTo(x + 10, l.y + 9); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#a9c0e0"; ctx.fillRect(l.x + 2, l.y, l.w - 4, 2);
    ctx.lineWidth = 2; ctx.strokeStyle = "#0f1a36"; rr(ctx, l.x, l.y, l.w, 11, 3); ctx.stroke();
  }
  // crates
  for (const c of L.crates) {
    const x = c.x - CR / 2, y = c.y - CR, plain = c.label === "";
    ctx.fillStyle = c.isX ? "#2563eb" : plain ? "#64748b" : "#d97706";
    rr(ctx, x, y, CR, CR, 6); ctx.fill();
    ctx.fillStyle = c.isX ? "#60a5fa" : plain ? "#94a3b8" : "#fbbf24"; rr(ctx, x + 4, y + 4, CR - 8, CR - 8, 4); ctx.fill();
    if (plain) { ctx.strokeStyle = "#475569"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + CR - 7, y + CR - 7); ctx.moveTo(x + CR - 7, y + 7); ctx.lineTo(x + 7, y + CR - 7); ctx.stroke(); }
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#0f1a36"; rr(ctx, x, y, CR, CR, 6); ctx.stroke();
    if (!plain) label(c.label, c.x, c.y - CR / 2 + 1, 21, c.isX ? "#fff" : "#1e3a8a");
  }
  for (const k of L.locks) drawLock(k);
  for (const s of L.scales) drawScale(s);

  // twins: the one being stood on first
  const order = P[0].ground === P[1] ? [1, 0] : [0, 1];
  for (const i of order) drawTwin(P[i], t);
  for (const q of parts) {
    ctx.globalAlpha = clamp(1 - q.t / q.life, 0, 1);
    ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // water
  const wy = L.waterY;
  let gr = ctx.createLinearGradient(0, wy, 0, viewBottom);
  gr.addColorStop(0, "rgba(37,99,180,0.80)"); gr.addColorStop(1, "rgba(8,20,52,0.96)");
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(viewL - 10, viewBottom + 10);
  for (let x = viewL - 10; x <= viewR + 16; x += 16) ctx.lineTo(x, wy + Math.sin(x * 0.03 + t * 1.8) * 2.6 + Math.sin(x * 0.071 - t * 1.2) * 1.4);
  ctx.lineTo(viewR + 10, viewBottom + 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(191,219,254,0.55)"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = viewL - 10; x <= viewR + 16; x += 16) ctx.lineTo(x, wy + Math.sin(x * 0.03 + t * 1.8) * 2.6 + Math.sin(x * 0.071 - t * 1.2) * 1.4);
  ctx.stroke();
  ctx.fillStyle = "rgba(253,186,116,0.20)";
  for (let c = 3; c < L.W; c += 6) { const x = c * T + T / 2 + Math.sin(t * 1.3 + c) * 3; rr(ctx, x - 12, wy + 9, 24, 3, 1.5); ctx.fill(); rr(ctx, x - 7, wy + 17, 14, 2.5, 1.2); ctx.fill(); }
  ctx.restore();

  // tip
  if (g.state !== "menu") {
    const tip = L.src.tip;
    ctx.font = `700 15px ${FONT}`;
    const w = ctx.measureText(tip).width + 28;
    ctx.fillStyle = "rgba(8,16,40,0.72)"; rr(ctx, 480 - w / 2, 56, w, 28, 14); ctx.fill();
    label(tip, 480, 71, 15, "#dbeafe", 700);
  }
}

loadLevel(cur);
g.loop(update, render);

// ---------- test hooks ----------
g.debug = {
  get L() { return L; },
  get P() { return P; },
  get info() { return { level: cur + 1, phase, time: +lvTime.toFixed(2), falls, stars: prog.stars, twins: P.map((p) => [+(p.x / T).toFixed(2), +(p.y / T).toFixed(2), p.grounded, p.dead > 0]), locks: L.locks.map((k) => k.open), scales: L.scales.map((s) => [s.expr, s.total, s.done]) }; },
  /** Jump straight to a level (1 based). */
  goto(n) { cur = clamp(n - 1, 0, LEVELS.length - 1); if (g.state === "playing") { g.closePanel(); startLevel(cur); } else g.start(); return cur + 1; },
  set2p() {},
  unlockAll() { unlockAll = true; },
  async solve(n) { const m = await import("./solutions.js"); return m.solve(g, n); },
  async solveAll() { const m = await import("./solutions.js"); const out = []; for (let n = 1; n <= LEVELS.length; n++) out.push(m.solve(g, n)); return out; },
};
