// Swing Line: one button. Hold to hook the nearest ring (any ring, as often as you like), let go to fly.
// Short levels, instant retry. Physics and the autopilot live in sim.js, levels in levels.js (built by gen.mjs).
import { createGame, createFx, math, sfx, drawArchie, PAL, FONT, clamp, lerp, damp, ease, rand } from "../kit/kit.js";
import { LEVELS } from "./levels.js";
import { K, makeState, step, candidate, autoHold, POLICIES, run as simRun } from "./sim.js";

const W = 960, H = 540, PR = K.PR, TAU = Math.PI * 2, N = LEVELS.length;
const SKINS = [
  { id: "classic", name: "Classic Archie", need: 0 },
  { id: "gold", name: "Gold Archie", need: 3, color: "#f59e0b" },
  { id: "cap", name: "Red Cap", need: 8, hat: "cap" },
  { id: "mint", name: "Mint Bubbles", need: 14, color: "#10b981", trail: "bubble" },
  { id: "star", name: "Star Trail", need: 22, color: "#ec4899", trail: "star" },
  { id: "crown", name: "Royal Archie", need: 32, color: "#8b5cf6", hat: "crown" },
  { id: "fire", name: "Fire Trail", need: 46, color: "#ef4444", trail: "fire" },
  { id: "prop", name: "Propeller Hat", need: 62, color: "#14b8a6", hat: "prop" },
  { id: "night", name: "Midnight Archie", need: 80, color: "#312e81", trail: "star", hat: "cap" },
  { id: "rainbow", name: "Rainbow King", need: 100, trail: "rainbow", hat: "crown" },
];

let fillMenu = () => {};
const coarse = matchMedia("(pointer: coarse)").matches;
const g = createGame({
  slug: "swing-line", title: "Swing Line", instant: true, aspect: 16 / 9, bg: "#7dd3fc",
  prompt: coarse ? "Touch and hold to swing" : "Hold Space or the mouse to swing",
  onMenu: (el) => queueMicrotask(() => fillMenu(el)),
});
const c = g.canvas2d(W, H);
const { ctx } = c;
const fx = createFx(360);
g.unlocks(SKINS.filter((k) => k.need > 0));

// ---------- saves ----------
let reached = clamp(g.load("reached", 0) | 0, 0, N);
let times = g.load("times", {}) || {};
let cur = Math.min(reached, N - 1);
const skin = () => { const k = SKINS.find((q) => q.id === g.skin); return k && g.xp >= k.need ? k : SKINS[0]; };

// ---------- menu extras: level select and looks ----------
const style = document.createElement("style");
style.textContent = `
.sl-row{display:flex;gap:.7em;justify-content:center;align-items:center;margin:.5em 0 0}
.sl-mini{font:inherit;font-weight:900;font-size:clamp(11px,1.7cqw,18px);color:#1e3a8a;background:#fff;border:0;border-bottom:.2em solid #93c5fd;border-radius:999px;padding:.35em 1.1em;cursor:pointer}
.sl-mini:hover{background:#dbeafe}
.sl-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:.35em;margin:.6em 0;max-height:52cqh;overflow:auto}
.sl-lv{font:inherit;font-weight:900;font-size:clamp(10px,1.6cqw,18px);color:#fff;background:#2563eb;border:0;border-bottom:.2em solid #1e3a8a;border-radius:.5em;padding:.45em 0;cursor:pointer}
.sl-lv.done{background:#0ea5e9;border-bottom-color:#075985}
.sl-lv:disabled{background:#cbd5e1;border-bottom-color:#94a3b8;color:#64748b;cursor:default}
.sl-skins{display:grid;grid-template-columns:repeat(5,1fr);gap:.5em;margin:.6em 0}
.sl-skin{font:inherit;font-weight:800;font-size:clamp(9px,1.25cqw,14px);color:#1e3a8a;background:#eff6ff;border:.2em solid #bfdbfe;border-radius:.9em;padding:.3em .2em .5em;cursor:pointer;line-height:1.15}
.sl-skin canvas{display:block;margin:0 auto;width:clamp(34px,6.5cqw,70px);height:auto}
.sl-skin.on{border-color:#f59e0b;background:#fef3c7}
.sl-skin:disabled{color:#64748b;background:#f1f5f9;border-color:#e2e8f0;cursor:default}
.sl-skin:disabled canvas{filter:grayscale(1);opacity:.45}`;
document.head.appendChild(style);

function showLevels() {
  const el = g.panel(`<h2>Levels</h2><div class="sl-grid">${LEVELS.map((_, i) => `<button class="sl-lv ${i < reached ? "done" : ""}" data-lv="${i}" ${i <= reached ? "" : "disabled"}>${i + 1}</button>`).join("")}</div><button class="ak-btn ak-ghost" data-a="quit">Back</button>`, "ak-wide");
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lv]");
    if (!b || b.disabled) return;
    cur = +b.dataset.lv; loadLevel(cur); sfx.play("click"); g.menu();
  });
}
function showSkins() {
  const xp = g.xp;
  const el = g.panel(`<h2>Looks</h2><div class="sl-skins">${SKINS.map((k) => `<button class="sl-skin ${skin().id === k.id ? "on" : ""}" data-skin="${k.id}" ${xp >= k.need ? "" : "disabled"}><canvas width="140" height="140"></canvas>${k.name}${xp >= k.need ? "" : `<br>at ${k.need} level points`}</button>`).join("")}</div><button class="ak-btn ak-ghost" data-a="quit">Back</button>`, "ak-wide");
  el.querySelectorAll("canvas").forEach((cv, i) => { const x = cv.getContext("2d"); drawHero(x, 70, 84, 96, SKINS[i], { pose: "happy", rot: 0, t: 0 }); });
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-skin]");
    if (!b || b.disabled) return;
    g.skin = b.dataset.skin; sfx.play("pop"); g.menu();
  });
}
fillMenu = (el) => {
  if (!el || !el.isConnected) return;
  el.innerHTML = `<div class="sl-row"><button class="sl-mini" data-k="lv" type="button">Level ${cur + 1}</button><button class="sl-mini" data-k="sk" type="button">Looks</button></div>`;
  el.addEventListener("click", (e) => { const k = e.target.closest("[data-k]")?.dataset.k; if (!k) return; e.stopPropagation(); sfx.play("click"); k === "lv" ? showLevels() : showSkins(); });
};

// ---------- input: one button, and the press that starts the game already counts ----------
const rawKeys = new Set();
let rawPointer = false;
const HOLD_KEYS = ["Space", "ArrowUp", "ArrowRight", "KeyW", "KeyD", "Enter"];
addEventListener("keydown", (e) => { if (HOLD_KEYS.includes(e.code)) rawKeys.add(e.code); });
addEventListener("keyup", (e) => rawKeys.delete(e.code));
addEventListener("blur", () => { rawKeys.clear(); rawPointer = false; });
g.stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".ak-hud button, .ak-extra, .ak-card, .ak-mini")) return;
  rawPointer = true;
  if (g.state === "menu" && e.target.closest(".ak-overlay.splash")) g.start();
});
addEventListener("pointerup", () => { rawPointer = false; });
addEventListener("pointercancel", () => { rawPointer = false; });
const held = () => rawPointer || rawKeys.size > 0 || g.pointer.down || g.keys.down(...HOLD_KEYS);

// ---------- world ----------
let L = LEVELS[cur], s = makeState(L, [0]);
let prob = null, vals = [], slot = 0;
let T = 0, rot = 0, spin = 0, sqx = 1, sqy = 1, falls = 0, needFresh = false, deadT = 0, deadWhy = "", doneT = 0, doneFrom = null, doneSent = false;
let slowed = false, coinChain = 0, coinT = 0, baseCoins = 0, flash = 0, solvedT = -1, posterOn = false, runTok = 0;
const cam = { x: 0, y: 0 };
const trail = [];
const auto = { on: false, pol: POLICIES[4], slot: null };
const path = [], ghost = []; // this try's line, and the line of the try before it
let guide = null;
const pulse = new WeakMap();
const pget = (o) => pulse.get(o) || 0;

function newProblem() {
  prob = null; vals = []; slot = 0;
  if (!L.k) return;
  const lvl = cur < 30 ? 1 : cur < 54 ? 2 : 3;
  for (let i = 0; i < 40; i++) {
    const q = math.problem({ topic: "quick", level: lvl });
    const wrong = q.choices.filter((v) => !q.check(v) && String(v).length <= 4);
    if (wrong.length < L.k - 1 || String(q.answer).length > 4 || q.text.length > 12) continue;
    prob = q; slot = auto.slot ?? Math.floor(Math.random() * L.k);
    vals = []; let w = 0;
    for (let j = 0; j < L.k; j++) vals.push(String(j === slot ? q.answer : wrong[w++]));
    return;
  }
  prob = { text: "2 + 2", answer: 4 }; slot = auto.slot ?? 0; vals = ["5", "3", "6"].slice(0, L.k); vals[slot] = "4";
}
function loadLevel(i) {
  cur = clamp(i, 0, N - 1); L = LEVELS[cur];
  newProblem(); falls = 0; ghost.length = 0;
  guide = makeGuide();
  reset(true);
}
/** The first swing of the early levels, flown ahead of time: the dotted line and the spot to let go. */
function makeGuide() {
  if (cur >= 8 || !L.anchors.length || L.finish > 90000) return null;
  const st = makeState(L, [0]), pol = { rel: L.guide || 0.76, sq: -0.3 }, pts = [];
  let rel = null;
  for (let n = 0; n < 400; n++) {
    step(st, rel ? false : autoHold(st, pol));
    if (st.mode !== "play") break;
    if (!rel && !st.rope) rel = { x: st.p.x, y: st.p.y, n: pts.length / 2 };
    pts.push(st.p.x, st.p.y);
    if (rel && pts.length / 2 - rel.n > 16) break;
  }
  return rel ? { pts, rel } : null;
}
function reset(snap) {
  s = makeState(L, [slot]);
  rot = 0; spin = 0; sqx = sqy = 1; deadT = 0; doneT = 0; doneFrom = null; doneSent = false; slowed = false; coinChain = 0; solvedT = -1;
  trail.length = 0; path.length = 0; baseCoins = g.coins;
  if (snap) { cam.x = 0; cam.y = 0; fx.clear(); }
  g.setHud("Coins", baseCoins);
}
g.onStart = () => {
  if (posterOn) { posterOn = false; g.stage.querySelector(".ak-hud").style.visibility = ""; }
  runTok++;
  loadLevel(cur);
  needFresh = false;
};

// ---------- juice ----------
const CONF = [PAL.yellow, PAL.pink, PAL.green, PAL.orange, PAL.white, PAL.sky, PAL.purple];
function onEvent(e) {
  const p = s.p;
  if (e.k === "latch" || e.k === "super" || e.k === "badlatch") {
    pulse.set(e.a, 1); sqx = 0.8; sqy = 1.25;
    sfx.tone(620, 0.07, { slide: 1500, type: "square", vol: 0.22 }); sfx.noise(0.04, { freq: 5200, type: "highpass", vol: 0.45 });
    fx.ring(e.a.x, e.a.y, { color: "#fff", radius: 44, life: 0.25, width: 5 });
    fx.burst(e.a.x, e.a.y, { n: 6, color: "#fff", speed: 180, life: 0.3, size: 3, shape: "spark", gravity: 0 });
    if (e.k === "super") {
      solvedT = T;
      sfx.play("correct"); g.hitstop(0.07); g.shake(7, 0.2); flash = 0.5;
      fx.ring(e.a.x, e.a.y, { color: PAL.yellow, radius: 130, life: 0.5, width: 10 });
      fx.burst(e.a.x, e.a.y, { n: 26, colors: [PAL.yellow, "#fff", PAL.amber], speed: 420, life: 0.8, size: 6, shape: "star", gravity: 300 });
      fx.text(e.a.x, e.a.y - 50, "Super ring! +5", { color: PAL.yellow, size: 30, outline: PAL.navy });
    } else if (e.k === "badlatch") sfx.tone(170, 0.45, { slide: 110, type: "sawtooth", vol: 0.16 });
  } else if (e.k === "release") {
    sqx = 1.15; sqy = 0.88;
    const sp = Math.hypot(p.vx, p.vy);
    spin = (p.vx >= 0 ? 1 : -1) * (5.5 + sp * 0.006);
    sfx.noise(0.2, { freq: 1600 + sp * 1.4, type: "bandpass", vol: 0.3 + Math.min(0.3, sp / 3000) });
    if (e.sup) { sfx.play("power"); g.shake(6, 0.2); fx.burst(p.x, p.y, { n: 18, colors: [PAL.yellow, "#fff"], speed: 300, life: 0.6, size: 5, shape: "star", angle: Math.PI, spread: 1.6, gravity: 0 }); }
    else if (sp > 500) fx.burst(p.x, p.y, { n: 5, color: "#fff", speed: 140, life: 0.3, size: 3, angle: Math.atan2(-p.vy, -p.vx), spread: 1, gravity: 0 });
  } else if (e.k === "wrong") {
    sfx.play("wrong"); g.shake(6, 0.18);
    fx.burst(e.a.x, e.a.y, { n: 12, colors: ["#94a3b8", PAL.red, "#fff"], speed: 240, life: 0.5, size: 4 });
    fx.text(e.a.x, e.a.y - 46, "Wrong ring", { color: "#fecaca", size: 24, outline: "#7f1d1d" });
    spin = 7;
  } else if (e.k === "pad") {
    pulse.set(e.b, 1); sqx = 1.35; sqy = 0.65; spin = 8;
    sfx.play("bounce"); sfx.tone(330, 0.18, { slide: 990, type: "sine", vol: 0.4 });
    fx.burst(p.x, e.b.y, { n: 12, colors: ["#fff", PAL.pink], speed: 260, life: 0.45, size: 4, angle: -Math.PI / 2, spread: 2.4 });
    fx.ring(p.x, e.b.y, { color: PAL.pink, radius: 60, life: 0.3 });
    g.shake(4, 0.12); g.hitstop(0.03);
  } else if (e.k === "hoop") {
    sfx.tone(520, 0.2, { slide: 1560, type: "sawtooth", vol: 0.22 }); sfx.play("coin");
    fx.ring(e.h.x, e.h.y, { color: PAL.yellow, radius: 110, life: 0.4, width: 9 });
    fx.burst(e.h.x, e.h.y, { n: 16, colors: [PAL.yellow, PAL.orange, "#fff"], speed: 380, life: 0.5, size: 4, shape: "spark", gravity: 0 });
    fx.text(e.h.x, e.h.y - 56, "Boost +3", { color: PAL.yellow, size: 24, outline: PAL.navy });
    g.hitstop(0.04); g.shake(5, 0.15); flash = 0.3;
  } else if (e.k === "coin") {
    coinChain = coinT > 0 ? coinChain + 1 : 0; coinT = 0.7;
    sfx.tone(880 * 2 ** (Math.min(coinChain, 14) / 12), 0.09, { type: "square", vol: 0.2 });
    fx.burst(e.c.x, e.c.y, { n: 5, colors: [PAL.yellow, "#fff"], speed: 150, life: 0.3, size: 3, gravity: 0 });
  } else if (e.k === "die") {
    deadWhy = e.why; deadT = 0; falls++;
    ghost.length = 0; for (let i = 0; i < path.length; i++) ghost.push(path[i]);
    if (e.why === "zap") {
      sfx.play("hit"); sfx.tone(1400, 0.18, { slide: 200, type: "sawtooth", vol: 0.3 }); g.shake(11, 0.25); g.hitstop(0.05); flash = 0.6;
      fx.burst(p.x, p.y, { n: 22, colors: [PAL.yellow, "#fff", "#94a3b8"], speed: 420, life: 0.5, size: 4, shape: "spark", gravity: 200 });
    } else sfx.tone(460, 0.22, { slide: 120, type: "triangle", vol: 0.35 });
  } else if (e.k === "finish") {
    doneFrom = { x: p.x, y: p.y, rot };
    sfx.play("power"); g.shake(7, 0.25); g.slowmo(0.45, 0.5);
    const y = p.y;
    fx.burst(L.finish, y, { n: 60, colors: CONF, speed: 520, life: 1.3, size: 6, shape: "square", gravity: 520 });
    for (let i = -2; i <= 2; i++) if (i) fx.burst(L.finish, y + i * 90, { n: 14, colors: CONF, speed: 380, life: 1.2, size: 6, shape: "square", gravity: 480, angle: 0, spread: 2.2 });
    fx.ring(L.finish, y, { color: "#fff", radius: 150, life: 0.5, width: 10 });
  }
}

async function levelCleared() {
  const time = Math.round(s.t * 10) / 10, clean = falls === 0, played = cur, last = cur === N - 1, tok = runTok;
  const prev = times[cur];
  if (prev == null || time < prev) times[cur] = time;
  reached = Math.max(reached, cur + 1);
  g.save("times", times); g.save("reached", reached);
  if (s.coinsGot) g.addCoins(s.coinsGot);
  g.addXp(clean ? 2 : 1);
  const lines = [`${time.toFixed(1)} s${prev != null && time < prev ? ". New best" : ""}`, clean ? "Clean run. 2 level points" : "1 level point"];
  if (last) { cur = 0; g.over({ won: true, title: `All ${N} levels clear`, score: g.xp, lines: ["Level points", "Play any level again from the title"], again: coarse ? "Tap for level 1" : "Space for level 1" }); return; }
  await g.levelDone({ title: `Level ${played + 1} clear`, lines, auto: 1.2, prompt: `Level ${played + 2}` });
  if (tok !== runTok) return;
  loadLevel(played + 1);
  needFresh = true;
}

// ---------- update ----------
function update(dt) {
  if (posterOn) return;
  T += dt;
  const p = s.p;
  let hold = auto.on ? autoHold(s, auto.pol) : held();
  if (!hold) needFresh = false;
  if (needFresh && !auto.on) hold = false;
  if (g.keys.pressed("KeyR") && s.mode !== "done") { reset(false); needFresh = true; }
  coinT -= dt; flash = Math.max(0, flash - dt * 2.2);
  sqx = damp(sqx, 1, 10, dt); sqy = damp(sqy, 1, 10, dt);
  for (const a of s.anchors) { const v = pget(a); if (v) pulse.set(a, Math.max(0, v - dt * 3)); }
  for (const b of s.pads) { const v = pget(b); if (v) pulse.set(b, Math.max(0, v - dt * 3.5)); }

  if (s.mode === "ready" || s.mode === "play") {
    const before = s.coinsGot;
    step(s, hold);
    for (const e of s.ev) onEvent(e);
    if (s.coinsGot !== before) g.setHud("Coins", baseCoins + s.coinsGot);
    if (s.mode === "play") {
      const sp = Math.hypot(p.vx, p.vy);
      if (s.rope) {
        const a = s.rope.a, target = Math.atan2(a.y - p.y, a.x - p.x) + Math.PI / 2;
        const diff = ((target - rot + Math.PI) % TAU + TAU) % TAU - Math.PI;
        rot += diff * Math.min(1, 16 * dt);
      } else rot += spin * dt;
      if ((Math.round(T * 60) & 1) === 0) { trail.push(p.x, p.y); if (trail.length > 40) trail.splice(0, 2); if (path.length < 2400) path.push(p.x, p.y); }
      if (!slowed && !s.rope && p.vx > 200 && (L.finish - p.x) / p.vx < 0.3) { slowed = true; g.slowmo(0.4, 0.75); }
      if (sp > 900 && Math.random() < 0.5) fx.burst(p.x, p.y, { n: 1, color: "#fff", speed: 40, life: 0.3, size: 3, gravity: 0 });
    }
  } else if (s.mode === "dead") {
    deadT += dt;
    if (deadWhy === "zap") { p.vy += 1600 * dt; p.y += p.vy * dt * 0.4; rot += 14 * dt; }
    if (deadT > (deadWhy === "zap" ? 0.3 : 0.12)) { reset(false); needFresh = true; }
  } else if (s.mode === "done") {
    doneT += dt;
    const k = clamp(doneT / 0.6, 0, 1), tx = L.finish + 170, ty = L.fy - PR - 6;
    p.x = lerp(doneFrom.x, tx, ease.out(k));
    p.y = lerp(doneFrom.y, ty, k * k) - Math.sin(k * Math.PI) * 70;
    const endRot = Math.ceil(doneFrom.rot / TAU) * TAU + TAU;
    rot = lerp(doneFrom.rot, endRot, ease.out(k));
    if ((Math.round(T * 60) & 1) === 0 && k < 1) { trail.push(p.x, p.y); if (trail.length > 40) trail.splice(0, 2); }
    if (k >= 1) {
      if (doneT - dt < 0.6) { sqx = 1.35; sqy = 0.65; sfx.play("land"); fx.burst(p.x, ty + PR, { n: 10, color: "#fff", speed: 200, life: 0.4, size: 4, angle: -Math.PI / 2, spread: 2.6 }); }
      p.y = ty - Math.abs(Math.sin((doneT - 0.6) * 9)) * 26;
      if (Math.random() < 0.35) fx.burst(L.finish + rand(-40, 330), L.fy - rand(160, 380), { n: 2, colors: CONF, speed: 120, life: 1.1, size: 6, shape: "square", gravity: 420 });
    }
    if (doneT > 0.95 && !doneSent) { doneSent = true; levelCleared(); }
  }
  fx.update(dt);
  camera(dt);
}
function camera(dt) {
  const p = s.p, ready = s.mode === "ready";
  const look = clamp(p.vx * 0.22, -60, 230);
  const tx = clamp(p.x - 300 + look, 0, Math.max(0, L.finish - 520));
  cam.x = damp(cam.x, tx, ready ? 18 : 7, dt);
  // the level has no floor and can run downhill, so the camera simply keeps Archie in the middle band
  const ty = ready ? L.start.y - 300 : clamp(cam.y, p.y - 360, p.y - 190);
  cam.y = damp(cam.y, ty, ready ? 18 : 9, dt);
}

// ---------- drawing ----------
let skyGrad = null;
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const hash = (n) => { const q = Math.sin(n * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };

function cloud(x, y, k, a) {
  ctx.globalAlpha = a; ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, 26 * k, 0, TAU); ctx.closePath();
  ctx.arc(x + 30 * k, y - 14 * k, 32 * k, 0, TAU); ctx.closePath();
  ctx.arc(x + 66 * k, y - 2 * k, 28 * k, 0, TAU); ctx.closePath();
  ctx.arc(x + 96 * k, y + 4 * k, 20 * k, 0, TAU); ctx.closePath();
  ctx.roundRect(x - 26 * k, y, 142 * k, 26 * k, 13 * k);
  ctx.fill("nonzero"); ctx.globalAlpha = 1;
}
function farIsland(x, y, k, kind) {
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath(); ctx.moveTo(x - 70 * k, y); ctx.quadraticCurveTo(x - 30 * k, y + 70 * k, x + 6 * k, y + 92 * k); ctx.quadraticCurveTo(x + 40 * k, y + 60 * k, x + 70 * k, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#a7f3d0"; rr(x - 76 * k, y - 12 * k, 152 * k, 22 * k, 11 * k); ctx.fill();
  ctx.lineWidth = 5 * k; ctx.lineCap = "round";
  if (kind === 0) {
    ctx.strokeStyle = "#c4b5fd"; ctx.beginPath(); ctx.arc(x, y - 62 * k, 40 * k, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3 * k;
    for (let i = 0; i < 8; i++) {
      const a = T * 0.25 + (i * TAU) / 8;
      ctx.beginPath(); ctx.moveTo(x, y - 62 * k); ctx.lineTo(x + Math.cos(a) * 40 * k, y - 62 * k + Math.sin(a) * 40 * k); ctx.stroke();
      ctx.fillStyle = i % 2 ? "#fbcfe8" : "#fde68a"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 40 * k, y - 62 * k + Math.sin(a) * 40 * k, 6 * k, 0, TAU); ctx.fill();
    }
    ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.moveTo(x - 20 * k, y - 10 * k); ctx.lineTo(x, y - 62 * k); ctx.lineTo(x + 20 * k, y - 10 * k); ctx.stroke();
  } else if (kind === 1) {
    ctx.strokeStyle = "#fda4af";
    ctx.beginPath(); ctx.moveTo(x - 66 * k, y - 14 * k); ctx.quadraticCurveTo(x - 30 * k, y - 20 * k, x - 6 * k, y - 30 * k);
    ctx.arc(x, y - 58 * k, 28 * k, Math.PI * 0.6, Math.PI * 0.6 + TAU); ctx.quadraticCurveTo(x + 36 * k, y - 60 * k, x + 66 * k, y - 14 * k); ctx.stroke();
  } else {
    ctx.fillStyle = "#fcd34d"; ctx.beginPath(); ctx.moveTo(x - 34 * k, y - 10 * k); ctx.lineTo(x - 8 * k, y - 62 * k); ctx.lineTo(x + 18 * k, y - 10 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fca5a5"; ctx.beginPath(); ctx.moveTo(x - 16 * k, y - 10 * k); ctx.lineTo(x - 8 * k, y - 62 * k); ctx.lineTo(x, y - 10 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6ee7b7"; ctx.beginPath(); ctx.arc(x + 44 * k, y - 34 * k, 18 * k, 0, TAU); ctx.fill();
  }
}
function balloon(x, y, k, col) {
  ctx.strokeStyle = "rgba(30,58,138,0.35)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 10 * k, y + 24 * k); ctx.lineTo(x - 5 * k, y + 42 * k); ctx.moveTo(x + 10 * k, y + 24 * k); ctx.lineTo(x + 5 * k, y + 42 * k); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 26 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(x, y, 10 * k, 26 * k, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#b45309"; rr(x - 7 * k, y + 40 * k, 14 * k, 10 * k, 3 * k); ctx.fill();
}
const wrap = (v, span) => ((v % span) + span) % span;
function ridge(par, base, amp, col, seed) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-40, H + 40);
  const st = 80, off = cam.x * par, i0 = Math.floor(off / st) - 1;
  for (let i = i0; i < i0 + W / st + 4; i++) {
    const x = i * st - off, y = base - (hash(i * 1.37 + seed) * 0.6 + hash(Math.floor(i / 3) * 2.1 + seed) * 0.4) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 40, H + 40); ctx.closePath(); ctx.fill();
}
function background() {
  if (!skyGrad) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#1d8fe0"); skyGrad.addColorStop(0.38, "#56c2f7"); skyGrad.addColorStop(0.7, "#b4ebff"); skyGrad.addColorStop(0.9, "#ffe9c2"); skyGrad.addColorStop(1, "#ffd3a6");
  }
  ctx.fillStyle = skyGrad; ctx.fillRect(-30, -30, W + 60, H + 60);
  const cy = cam.y, low = posterOn ? 170 : 0, sx = 760 - cam.x * 0.015, sy = 104 - clamp(cy * 0.03, -30, 30);
  if (!posterOn) {
    // sun with soft rays
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i < 9; i++) { const a = T * 0.05 + (i * TAU) / 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 520, a, a + 0.16); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,247,200,0.55)"; ctx.beginPath(); ctx.arc(0, 0, 68, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff6c4"; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // far, hazy cloud bank
  for (let i = 0; i < 7; i++) {
    const span = 1500, x = wrap(i * 233 + hash(i) * 150 - cam.x * 0.06, span) - 220;
    cloud(x, 70 + low + wrap(hash(i + 9) * 330 - cy * 0.05, 330), 0.7 + hash(i + 3) * 0.5, 0.4);
  }
  // two distant ridges low on the horizon give the sky its depth
  const ry = clamp(-cy * 0.04, -24, 40);
  ridge(0.04, H - 70 + ry, 90, "rgba(125,170,235,0.5)", 3);
  ridge(0.08, H - 30 + ry * 1.5, 70, "rgba(96,150,225,0.55)", 11);
  // floating islands and balloons drift past at their own speeds, and repeat up and down
  const P1 = 0.2, st = 430, i0 = Math.floor((cam.x * P1 - 200) / st), SY = 900;
  for (let i = i0; i < i0 + 5; i++) {
    const x = i * st - cam.x * P1 + hash(i * 3.1) * 140, y = wrap(260 + low * 0.4 + hash(i * 7.7) * 500 - cy * P1 + 200, SY) - 200;
    ctx.globalAlpha = 0.7; farIsland(x, y, 0.75 + hash(i * 1.3) * 0.4, ((i % 3) + 3) % 3); ctx.globalAlpha = 1;
  }
  const P2 = 0.34, st2 = 610, j0 = Math.floor((cam.x * P2 - 100) / st2);
  for (let i = j0; i < j0 + 3; i++) {
    const x = i * st2 - cam.x * P2 + hash(i * 5.3) * 300, y = wrap(130 + low + hash(i * 2.9) * 500 - cy * P2 + 120, 800) - 120;
    ctx.globalAlpha = 0.9; balloon(x, y, 0.8 + hash(i) * 0.4, ["#fb7185", "#fbbf24", "#a78bfa", "#34d399"][((i % 4) + 4) % 4]); ctx.globalAlpha = 1;
  }
  // near clouds: big, bright, fast
  for (let i = 0; i < 5; i++) {
    const span = 1900, x = wrap(i * 420 + 120 - cam.x * 0.55, span) - 340;
    cloud(x, wrap(380 + hash(i + 40) * 600 - cy * 0.55 + 160, 860) - 160 + low * 0.6, 1.5 + hash(i + 50) * 0.6, 0.62);
  }
}
function island(x0, x1, y, depth) {
  ctx.fillStyle = "#a16207"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(x0 + 6, y + 8);
  ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.2, y + depth * 0.8, (x0 + x1) / 2 - 10, y + depth);
  ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.85, y + depth * 0.7, x1 - 6, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#4ade80"; rr(x0, y - 4, x1 - x0, 26, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#86efac"; rr(x0 + 10, y, x1 - x0 - 20, 7, 4); ctx.fill();
}
function drawStart() {
  const x = L.start.x, y = L.start.y;
  island(-60, 70, y + 96, 110);
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3; ctx.lineJoin = "round";
  ctx.fillStyle = "#f8fafc"; rr(18, y - 104, 14, 202, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.amber; rr(14, y - 112, x - 2, 14, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; rr(-34, y + 40, 44, 32, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.navy; ctx.font = `900 19px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(cur + 1), -12, y + 57);
  if (s.mode === "ready") {
    ctx.strokeStyle = PAL.navy; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y - 100); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.strokeStyle = "#fb7185"; ctx.lineWidth = 3; ctx.stroke();
  }
}
function drawFinish() {
  const x = L.finish, fy = L.fy, top = Math.min(cam.y - 80, fy - 760), C = 14;
  island(x - 30, x + 340, fy, 120);
  // arrows in the air point at the gate
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const ph = (T * 1.6 + i * 0.33) % 1, ax = x - 180 + i * 46 + ph * 12, ay = fy - 215;
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin((T * 3 - i * 0.7)));
    ctx.strokeStyle = PAL.navy; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(ax - 14, ay - 24); ctx.lineTo(ax + 10, ay); ctx.lineTo(ax - 14, ay + 24); ctx.stroke();
    ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 7; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the gate: a tall checkered pole, crossing it at any height wins
  ctx.fillStyle = "#fff"; ctx.fillRect(x - C, top, C * 2, fy - top);
  ctx.fillStyle = PAL.navy;
  const r0 = Math.floor((Math.max(top, cam.y - 40) - top) / C), r1 = Math.ceil((Math.min(fy, cam.y + H + 40) - top) / C);
  for (let i = r0; i < r1; i++) ctx.fillRect(x - C + (i & 1) * C, top + i * C, C, C);
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3.5; ctx.strokeRect(x - C, top, C * 2, fy - top);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x - C + 3, top, 4, fy - top);
  ctx.fillStyle = PAL.amber; rr(x - C - 8, fy - 14, C * 2 + 16, 16, 6); ctx.fill(); ctx.stroke();
  // banner
  const by = fy - 350, wv = Math.sin(T * 5) * 6, wv2 = Math.cos(T * 5) * 5;
  ctx.fillStyle = PAL.pink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + C, by); ctx.quadraticCurveTo(x + 70, by - 10 + wv, x + 150, by + 6 + wv2);
  ctx.lineTo(x + 128, by + 34 + wv2 * 0.6); ctx.lineTo(x + 150, by + 62 + wv2); ctx.quadraticCurveTo(x + 70, by + 46 + wv, x + C, by + 56); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.save(); ctx.translate(x + 72, by + 28 + wv * 0.6); ctx.rotate(wv * 0.006); ctx.fillText("FINISH", 0, 0); ctx.restore();
  // landing mat
  ctx.fillStyle = PAL.amber; rr(x + 120, fy - 16, 100, 14, 6); ctx.fill(); ctx.stroke();
}
function drawPad(b) {
  const k = pget(b), x0 = Math.max(b.x - b.w / 2, cam.x - 80), x1 = Math.min(b.x + b.w / 2, cam.x + W + 80), w = x1 - x0, yy = b.y + k * 8;
  if (w <= 0) return;
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3;
  const n = Math.max(2, Math.round(b.w / 240)), gap = (b.w - 28) / (n - 1);
  for (let i = 0; i < n; i++) {
    const fx0 = b.x - b.w / 2 + 14 + i * gap;
    if (fx0 < x0 - 20 || fx0 > x1 + 20) continue;
    ctx.fillStyle = "#64748b"; rr(fx0 - 9, b.y + 12, 18, 16, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(fx0, b.y + 31, Math.abs(Math.sin(T * 30 + i)) * 16 + 6, 3, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = "#334155"; rr(x0, b.y + 6, w, 12, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.pink; rr(x0 + 6, yy - 4, w - 12, 13, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fbcfe8"; rr(x0 + 16, yy - 1, w - 32, 4, 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3; ctx.lineCap = "round";
  const up = ((T * 1.6) % 1) * 14, wide = b.w > 400, c0 = wide ? Math.ceil(x0 / 200) * 200 : b.x;
  for (let cx = c0; cx < x1; cx += 200) {
    for (let i = 0; i < 2; i++) { const y2 = b.y - 22 - i * 14 - up; ctx.globalAlpha = 0.6 - i * 0.25; ctx.beginPath(); ctx.moveTo(cx - 10, y2 + 6); ctx.lineTo(cx, y2); ctx.lineTo(cx + 10, y2 + 6); ctx.stroke(); }
    if (!wide) break;
  }
  ctx.globalAlpha = 1;
}
function drawStorm(h) {
  const ceil = h.h >= 900, x0 = h.x, x1 = h.x + h.w, ey = ceil ? h.y + h.h : h.y;
  ctx.fillStyle = "#475569"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3.5; ctx.lineJoin = "round";
  ctx.beginPath();
  const n = Math.max(2, Math.round(h.w / 46)), bw = h.w / n;
  if (ceil) { ctx.moveTo(x0, h.y); ctx.lineTo(x0, ey - 26); for (let i = 0; i < n; i++) ctx.arc(x0 + bw * (i + 0.5), ey - 26, bw / 2, Math.PI, 0, true); ctx.lineTo(x1, h.y); }
  else { ctx.moveTo(x0, h.y + h.h); ctx.lineTo(x0, ey + 26); for (let i = 0; i < n; i++) ctx.arc(x0 + bw * (i + 0.5), ey + 26, bw / 2, Math.PI, 0, false); ctx.lineTo(x1, h.y + h.h); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(15,23,42,0.25)";
  if (ceil) ctx.fillRect(x0 + 4, h.y, h.w - 8, h.h - 70); else ctx.fillRect(x0 + 4, ey + 90, h.w - 8, h.h - 90);
  ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  const dir = ceil ? 1 : -1;
  for (let i = 0; i < n; i += ceil ? 3 : 1) {
    if (!ceil && i !== (n >> 1)) continue;
    const f = Math.floor(T * 9 + i * 1.7), on = posterOn || hash(f + i * 13) > 0.35, bx = x0 + bw * (i + 0.5) + (hash(f * 3 + i) - 0.5) * 10, by = ey + dir * 4;
    if (!on) continue;
    ctx.beginPath(); ctx.moveTo(bx, by - dir * 30); ctx.lineTo(bx - 7, by - dir * 12); ctx.lineTo(bx + 5, by - dir * 14); ctx.lineTo(bx - 3, by + dir * 6); ctx.stroke();
  }
  const ex = (x0 + x1) / 2, eyy = ceil ? ey - 52 : ey + 50;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - 14, eyy, 8, 0, TAU); ctx.arc(ex + 14, eyy, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(ex - 12, eyy + 2, 3.6, 0, TAU); ctx.arc(ex + 12, eyy + 2, 3.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - 25, eyy - 13); ctx.lineTo(ex - 6, eyy - 7); ctx.moveTo(ex + 25, eyy - 13); ctx.lineTo(ex + 6, eyy - 7); ctx.stroke();
}
function drawHoop(h) {
  if (h.used) ctx.globalAlpha = 0.25;
  const r = 44 + Math.sin(T * 6 + h.x) * 2;
  ctx.save(); ctx.translate(h.x, h.y); ctx.scale(0.55, 1);
  ctx.lineWidth = 15; ctx.strokeStyle = PAL.navy; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 9; ctx.strokeStyle = PAL.orange; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = PAL.yellow; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -T * 60; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 2; i++) { const cx = h.x - 8 + i * 14 + ((T * 2) % 1) * 4; ctx.beginPath(); ctx.moveTo(cx - 5, h.y - 9); ctx.lineTo(cx + 4, h.y); ctx.lineTo(cx - 5, h.y + 9); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawCoins(x0, x1) {
  ctx.lineWidth = 2.5; ctx.strokeStyle = "#b45309";
  for (const q of s.coins) {
    if (q.got || q.x < x0 || q.x > x1) continue;
    const w = Math.abs(Math.cos(T * 4 + q.x * 0.01)) * 0.7 + 0.3;
    ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.ellipse(q.x, q.y, 9 * w, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(q.x - 2 * w, q.y - 3, 2.5 * w, 3, 0, 0, TAU); ctx.fill();
  }
}
function drawAnchor(a, isTarget, near) {
  const k = pget(a);
  if (near && !a.broken) { // in reach: a soft glow
    const rg = (a.cluster == null ? 34 : 50) + Math.sin(T * 6 + a.i) * 3;
    ctx.fillStyle = isTarget ? "rgba(253,224,71,0.38)" : "rgba(255,255,255,0.28)"; ctx.beginPath(); ctx.arc(a.x, a.y, rg, 0, TAU); ctx.fill();
    ctx.fillStyle = isTarget ? "rgba(253,224,71,0.3)" : "rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(a.x, a.y, rg * 0.72, 0, TAU); ctx.fill();
  }
  if (a.cluster == null) {
    const r = 17 + k * 6;
    ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a.x, a.y - r - 4); ctx.lineTo(a.x, a.y - r - 13); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.ellipse(a.x, a.y - r - 14, Math.abs(Math.cos(T * 18 + a.i)) * 14 + 3, 3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (a.mv) { ctx.fillStyle = PAL.sky; ctx.beginPath(); ctx.moveTo(a.x - 8, a.y + r + 9); ctx.lineTo(a.x + 8, a.y + r + 9); ctx.lineTo(a.x, a.y + r + 19); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // a steel ring: dark rim, bright band, a shine on top and a shadow underneath
    ctx.lineWidth = 14; ctx.strokeStyle = PAL.navy; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 8.5; ctx.strokeStyle = "#94a3b8"; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(a.x, a.y, r + 0.5, Math.PI * 0.95, Math.PI * 1.95); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(a.x, a.y, r + 1.5, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#64748b"; ctx.beginPath(); ctx.arc(a.x, a.y, r - 1.5, Math.PI * 0.15, Math.PI * 0.6); ctx.stroke();
    // the colored core tells you what kind of ring it is
    ctx.fillStyle = isTarget ? PAL.yellow : a.mv ? PAL.sky : PAL.amber; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(a.x, a.y, 7.5 + k * 3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(a.x - 2.2, a.y - 2.4, 2.2, 0, TAU); ctx.fill();
  } else {
    const bad = s.rope && s.rope.a === a && !a.right, r = 31 + k * 6, won = a.right && a.won;
    ctx.save(); ctx.translate(a.x + (bad ? Math.sin(T * 70) * (2 + s.rope.t * 9) : 0), a.y);
    if (a.broken) ctx.globalAlpha = 0.22;
    if (won) { ctx.fillStyle = "rgba(253,224,71,0.5)"; ctx.beginPath(); for (let i = 0; i < 16; i++) { const q = T * 1.5 + (i * TAU) / 16, rad = i % 2 ? r + 6 : r + 22; ctx.lineTo(Math.cos(q) * rad, Math.sin(q) * rad); } ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = won ? PAL.green : bad ? PAL.red : isTarget ? PAL.yellow : "#94a3b8"; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(0, 0, r - 5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
    const txt = vals[a.slot] ?? "";
    ctx.fillStyle = PAL.navy; ctx.font = `900 ${txt.length > 3 ? 18 : txt.length > 2 ? 22 : 28}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, 0, 2);
    ctx.restore();
  }
  if (isTarget && !s.rope && !a.broken) { // this is the ring a press hooks right now
    const r = (a.cluster == null ? 17 : 31) + 16 + Math.sin(T * 8) * 2;
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(T * 2.2); ctx.setLineDash([11, 8]); ctx.lineCap = "butt";
    ctx.lineWidth = 6.5; ctx.strokeStyle = PAL.navy; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore(); ctx.setLineDash([]);
  }
}
/** On the forward swing, between a flat let-go and a steep one: the rope glows while a let-go flies far. */
const sweet = () => {
  const r = s.rope, p = s.p;
  if (!r || !r.a.right || r.slack || p.vx <= 0) return false;
  const phi = Math.atan2(p.x - r.a.x, p.y - r.a.y);
  return phi > 0.3 && phi < 1 && Math.hypot(p.vx, p.vy) > 260;
};
function drawRope() {
  const r = s.rope;
  if (!r) return;
  const p = s.p, a = r.a, hx = p.x + Math.sin(rot) * 24, hy = p.y - Math.cos(rot) * 24;
  const dx = a.x - hx, dy = a.y - hy, d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (ny < 0) { nx = -nx; ny = -ny; } // sag hangs down
  // a tight rope still bows a touch; a slack one droops. The twang right after the hook is only for show.
  const sag = (r.slack ? Math.min(46, (r.L - d) * 0.9 + 10) : 3 + d * 0.012) + 9 * Math.exp(-9 * r.t) * Math.sin(r.t * 40);
  const path2 = () => { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + dx / 2 + nx * sag * 2, hy + dy / 2 + ny * sag * 2, a.x, a.y); };
  ctx.lineCap = "round";
  const good = sweet() && !posterOn;
  if (good) { ctx.strokeStyle = "rgba(253,224,71,0.55)"; ctx.lineWidth = 15; path2(); ctx.stroke(); }
  const col = !a.right ? (Math.sin(T * 40) > 0 ? "#ef4444" : "#fecaca") : good ? PAL.yellow : a.cluster != null ? PAL.green : "#fb7185";
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 7.5; path2(); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 3.8; path2(); ctx.stroke();
  // rope twist marks
  ctx.strokeStyle = "rgba(30,58,138,0.45)"; ctx.lineWidth = 3.8; ctx.setLineDash([2, 9]); path2(); ctx.stroke(); ctx.setLineDash([]);
  // knots: one on the ring, one in Archie's hands
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2.5; ctx.fillStyle = col;
  const ux = dx / d, uy = dy / d, kx = a.x - ux * (a.cluster == null ? 17 : 31), ky = a.y - uy * (a.cluster == null ? 17 : 31);
  ctx.beginPath(); ctx.arc(kx, ky, 6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
}
function hat(x, kind, t) {
  x.lineJoin = "round"; x.strokeStyle = PAL.navy; x.lineWidth = 2.6;
  if (kind === "cap") {
    x.fillStyle = PAL.red; x.beginPath(); x.moveTo(34, 24); x.quadraticCurveTo(60, -4, 86, 24); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(78, 19, 30, 8, 4); x.fill(); x.stroke();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(60, 8, 4, 0, TAU); x.fill(); x.stroke();
  } else if (kind === "crown") {
    x.fillStyle = PAL.yellow; x.beginPath(); x.moveTo(36, 22); x.lineTo(34, -2); x.lineTo(47, 10); x.lineTo(60, -8); x.lineTo(73, 10); x.lineTo(86, -2); x.lineTo(84, 22); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.pink; x.beginPath(); x.arc(60, 12, 4, 0, TAU); x.fill(); x.stroke();
  } else if (kind === "prop") {
    x.fillStyle = PAL.yellow; x.beginPath(); x.moveTo(40, 22); x.quadraticCurveTo(60, 2, 80, 22); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(60, 12); x.lineTo(60, 0); x.stroke();
    x.fillStyle = "#fff"; x.beginPath(); x.ellipse(60, -1, Math.abs(Math.cos(t * 22)) * 22 + 4, 4, 0, 0, TAU); x.fill(); x.stroke();
  }
}
function drawHero(x, px, py, size, sk, o) {
  drawArchie(x, px, py, size, { pose: o.pose, rotation: o.rot, squashX: o.sqx ?? 1, squashY: o.sqy ?? 1, t: o.t, look: o.look, blink: o.blink, color: sk.color });
  if (!sk.hat) return;
  const k = size / 120;
  x.save(); x.translate(px, py); x.rotate(o.rot); x.scale(k * (o.sqx ?? 1), k * (o.sqy ?? 1)); x.translate(-60, -60); hat(x, sk.hat, o.t); x.restore();
}
function drawTrail(sk) {
  const n = trail.length / 2;
  for (let i = 0; i < n; i++) {
    const k = i / n, x = trail[i * 2], y = trail[i * 2 + 1];
    ctx.globalAlpha = k * 0.5;
    if (sk.trail === "fire") { ctx.fillStyle = k > 0.7 ? PAL.yellow : k > 0.4 ? PAL.orange : PAL.red; ctx.beginPath(); ctx.arc(x, y + Math.sin(i + T * 20) * 3, 4 + k * 15, 0, TAU); ctx.fill(); }
    else if (sk.trail === "rainbow") { ctx.globalAlpha = k * 0.75; ctx.fillStyle = `hsl(${(i * 22 + T * 200) % 360} 95% 62%)`; ctx.beginPath(); ctx.arc(x, y, 5 + k * 13, 0, TAU); ctx.fill(); }
    else if (sk.trail === "bubble") { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.1) * 8, y + Math.cos(i * 1.7) * 8, 4 + k * 9, 0, TAU); ctx.stroke(); }
    else if (sk.trail === "star") { if (i % 2) continue; ctx.globalAlpha = k * 0.9; ctx.fillStyle = i % 4 ? PAL.yellow : "#fff"; const r = 4 + k * 9; ctx.beginPath(); for (let j = 0; j < 10; j++) { const q = (j / 10) * TAU + i, rad = j % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(q) * rad, y + Math.sin(q) * rad); } ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = k > 0.6 ? "#fff" : "#e0f2fe"; ctx.beginPath(); ctx.arc(x, y, 5 + k * 13, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
/** Where the last try went, so you can see what to change. */
function drawGhost() {
  if (ghost.length < 4 || posterOn) return;
  ctx.fillStyle = "rgba(30,58,138,0.38)";
  for (let i = 0; i < ghost.length; i += 4) { ctx.beginPath(); ctx.arc(ghost[i], ghost[i + 1], 3.6, 0, TAU); ctx.fill(); }
  const n = ghost.length, ex = ghost[n - 2], ey = Math.min(ghost[n - 1], cam.y + H - 26);
  ctx.strokeStyle = "rgba(30,58,138,0.5)"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ex - 9, ey - 9); ctx.lineTo(ex + 9, ey + 9); ctx.moveTo(ex + 9, ey - 9); ctx.lineTo(ex - 9, ey + 9); ctx.stroke();
}
/** The first swing drawn ahead of time (first 8 levels), with the let-go spot marked (first 4). */
function drawGuide() {
  if (!guide || posterOn || s.hooks > 1 || (s.hooks === 1 && !s.rope) || !(s.mode === "ready" || s.mode === "play")) return;
  const q = guide.pts, rn = guide.rel.n;
  for (let i = 0; i < q.length; i += 6) {
    const k = i / 2, after = k > rn;
    ctx.fillStyle = after ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(30,58,138,0.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(q[i], q[i + 1], after ? 3 : 4.2, 0, TAU); ctx.fill(); ctx.stroke();
  }
  const n = q.length, ang = Math.atan2(q[n - 1] - q[n - 5], q[n - 2] - q[n - 6]);
  ctx.save(); ctx.translate(q[n - 2], q[n - 1]); ctx.rotate(ang);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(30,58,138,0.7)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-2, -10); ctx.lineTo(-2, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  if (cur >= 4) return;
  const rx = guide.rel.x, ry = guide.rel.y, pu = 1 + Math.sin(T * 7) * 0.12, hot = sweet();
  ctx.lineWidth = 4; ctx.strokeStyle = PAL.navy; ctx.fillStyle = hot ? PAL.yellow : "#fff";
  ctx.beginPath(); ctx.arc(rx, ry, 13 * pu, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.navy; ctx.beginPath(); ctx.arc(rx, ry, 4.5, 0, TAU); ctx.fill();
  ctx.font = `900 17px ${FONT}`;
  const tw = ctx.measureText("let go").width + 22;
  ctx.fillStyle = hot ? PAL.yellow : "#fff"; ctx.lineWidth = 3; rr(rx + 20, ry - 34, tw, 28, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.navy; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("let go", rx + 20 + tw / 2, ry - 19);
}
/** Lines that stream off Archie when he is really moving. */
function drawStreaks() {
  const p = s.p, sp = Math.hypot(p.vx, p.vy);
  if (s.mode !== "play" || sp < 620) return;
  const k = clamp((sp - 620) / 500, 0, 1), ux = p.vx / sp, uy = p.vy / sp;
  ctx.lineCap = "round"; ctx.strokeStyle = "#fff";
  for (let i = 0; i < 6; i++) {
    const off = (i - 2.5) * 9, j = hash(i + Math.floor(T * 20) * 0.37), len = (50 + j * 70) * (0.5 + k), back = 22 + j * 14;
    const bx = p.x - ux * back - uy * off, by = p.y - uy * back + ux * off;
    ctx.globalAlpha = (0.25 + 0.5 * k) * (1 - Math.abs(off) / 40); ctx.lineWidth = 2 + (1 - Math.abs(off) / 30) * 2.5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * len, by - uy * len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function bubble(text, x, y, big) {
  ctx.font = `900 ${big ? 26 : 18}px ${FONT}`;
  const tw = ctx.measureText(text).width + (big ? 40 : 30), h = big ? 46 : 36;
  ctx.fillStyle = big ? PAL.yellow : "rgba(255,255,255,0.95)"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3;
  rr(x - tw / 2, y - h / 2, tw, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.navy; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 1);
}
function drawWorld() {
  const p = s.p, x0 = cam.x - 120, x1 = cam.x + W + 120, sk = skin();
  if (!posterOn) { drawStart(); drawFinish(); }
  for (const h of s.haz) if (h.x + h.w > x0 && h.x < x1) drawStorm(h);
  for (const b of s.pads) drawPad(b);
  for (const h of s.hoops) if (h.x > x0 && h.x < x1) drawHoop(h);
  drawCoins(x0, x1);
  const live = s.mode === "ready" || s.mode === "play";
  const target = !live || posterOn ? null : s.rope ? s.rope.a : candidate(s);
  drawGhost(); drawGuide();
  if (target && !s.rope && s.mode === "play") {
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2.5; ctx.setLineDash([3, 10]); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
  }
  drawTrail(sk);
  drawStreaks();
  drawRope();
  const R2 = K.RANGE * K.RANGE;
  for (const a of s.anchors) if (a.x > x0 && a.x < x1) drawAnchor(a, a === target, live && !posterOn && !s.rope && (a.x - p.x) ** 2 + (a.y - p.y) ** 2 < R2);
  let pose = "idle";
  if (s.mode === "done") pose = "happy"; else if (s.mode === "dead") pose = "sad"; else if (s.mode === "play") pose = "jump";
  // speed pulls him long: along the flight in the air, along the swing on the rope
  const st0 = s.mode === "play" ? clamp((Math.hypot(p.vx, p.vy) - 380) / 2400, 0, 0.24) : 0, onRope = !!s.rope;
  const stX = onRope ? 1 + st0 : 1 - st0 * 0.5, stY = onRope ? 1 - st0 * 0.5 : 1 + st0;
  const look = target && !s.rope ? { x: clamp((target.x - p.x) / 200, -1, 1), y: clamp((target.y - p.y) / 200, -1, 1) } : { x: clamp(p.vx / 500, -1, 1), y: clamp(p.vy / 600, -1, 1) };
  if (s.mode === "ready") drawHero(ctx, p.x, p.y, 64, sk, { pose: "jump", rot: 0, t: T, look });
  else if (!(s.mode === "dead" && deadWhy === "fall")) {
    if (s.mode === "dead" && Math.sin(T * 60) > 0) ctx.globalAlpha = 0.5;
    drawHero(ctx, p.x, p.y, 64, sk, { pose, rot, sqx: sqx * stX, sqy: sqy * stY, t: T, look: pose === "happy" ? null : look, blink: !posterOn && T % 3.2 < 0.12 });
    ctx.globalAlpha = 1;
  }
  fx.draw(ctx);
  // in-world hints: one short line, only until the idea has worked once
  if (posterOn || cur < reached) return;
  if (cur === 0) {
    if (s.mode === "ready" && g.state === "playing") bubble(coarse ? "Touch and hold" : "Hold Space", p.x + 130, p.y - 150);
  } else if (L.tip && L.tip !== "hold" && s.mode === "ready" && g.state === "playing") bubble(L.tip, p.x + 170, p.y - 150);
}
function drawUI() {
  const p = s.p, sp = Math.hypot(p.vx, p.vy);
  if (sp > 620 && s.mode === "play") { // wind lines
    const k = clamp((sp - 620) / 380, 0, 1), ang = Math.atan2(p.vy, p.vx);
    ctx.strokeStyle = "#fff"; ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const ph = (T * (1.6 + hash(i) * 1.4) + hash(i + 20)) % 1, yy = hash(i + 7) * H, xx = W + 80 - ph * (W + 260), len = 50 + hash(i + 3) * 100;
      ctx.globalAlpha = k * 0.45 * Math.sin(ph * Math.PI); ctx.lineWidth = 2 + hash(i + 11) * 2.5;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + Math.cos(ang) * len, yy + Math.sin(ang) * len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  if (g.state === "menu") return;
  // level 3 to 4 progress marker
  const bw = 190, bx = W / 2 - bw / 2, by = 24, f = clamp((p.x - L.start.x) / (L.finish - L.start.x), 0, 1);
  ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3;
  ctx.fillStyle = "rgba(255,255,255,0.75)"; rr(bx, by - 6, bw, 12, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.amber; rr(bx, by - 6, Math.max(12, bw * f), 12, 6); ctx.fill(); ctx.stroke();
  ctx.font = `900 15px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [x, n, on] of [[bx - 4, cur + 1, true], [bx + bw + 4, cur + 2, s.mode === "done"]]) {
    if (n > N) continue;
    ctx.fillStyle = on ? PAL.blue : "#fff"; ctx.beginPath(); ctx.arc(x, by, 16, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = on ? "#fff" : PAL.navy; ctx.fillText(String(n), x, by + 1);
  }
  ctx.font = `800 13px ${FONT}`; ctx.fillStyle = PAL.navy; ctx.textAlign = "left";
  const tt = `${s.t.toFixed(1)} s${times[cur] != null ? `   best ${times[cur].toFixed(1)}` : ""}`;
  ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.strokeText(tt, bx + bw + 30, by + 1); ctx.fillText(tt, bx + bw + 30, by + 1);
  // the number problem sits at the top from the first frame of the level
  if (prob) {
    const solved = solvedT >= 0, txt = `${prob.text} = ${solved ? prob.answer : "?"}`;
    if (solved && T - solvedT > 1.2) return;
    ctx.font = `900 34px ${FONT}`;
    const w = ctx.measureText(txt).width + 56, pop = solved ? 1 + Math.max(0, 0.25 - (T - solvedT)) : 1;
    ctx.save(); ctx.translate(W / 2, 80); ctx.scale(pop, pop);
    ctx.fillStyle = "rgba(15,23,42,0.2)"; rr(-w / 2 + 2, -24, w, 56, 20); ctx.fill();
    ctx.fillStyle = solved ? "#bbf7d0" : "#fff"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 3.5; rr(-w / 2, -28, w, 56, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.navy; ctx.textAlign = "center"; ctx.fillText(txt, 0, 2);
    ctx.restore();
  }
}
const Z = 2.7;
function render() {
  ctx.save();
  background();
  if (posterOn) { ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y); drawWorld(); ctx.restore(); return; }
  ctx.translate(Math.round(-cam.x + g.shakeX), Math.round(-cam.y + g.shakeY));
  drawWorld();
  ctx.restore();
  drawUI();
}

g.touchButtons([]);
loadLevel(cur);
g.loop(update, render);

// ---------- debug and test hooks ----------
g.debug = {
  auto, cam, POLICIES, LEVELS,
  get s() { return s; },
  get p() { return s.p; },
  get mode() { return s.mode; },
  get level() { return cur; },
  get falls() { return falls; },
  get reached() { return reached; },
  get problem() { return prob && { text: prob.text, answer: prob.answer, vals, slot }; },
  /** Jump to a level (0-based) and start it. */
  goto(i) { cur = clamp(i, 0, N - 1); g.start(); },
  /** Let the autopilot hold the button. pol is an index into POLICIES or a policy object. */
  autopilot(on = true, pol = 4, slot = null) { auto.on = on; auto.pol = typeof pol === "number" ? POLICIES[pol] : pol; auto.slot = slot; },
  /** Autoplay one level in the real game loop. */
  run(i, pol = 4, seconds = 14) {
    g.debug.autopilot(true, pol, 0); g.debug.goto(i); g.advance(seconds);
    const res = { level: i + 1, mode: s.mode, t: +s.t.toFixed(2), falls, coins: s.coinsGot };
    auto.on = false; auto.slot = null;
    return res;
  },
  /** Every level, every release style, every right-answer slot, physics only. */
  verifyAll() {
    const weak = []; let min = 99;
    LEVELS.forEach((lv, i) => {
      let worst = 99;
      for (let sl = 0; sl < Math.max(1, lv.k); sl++) worst = Math.min(worst, POLICIES.filter((pol) => simRun(lv, pol, [sl]).mode === "done").length);
      min = Math.min(min, worst);
      if (worst < 3) weak.push(i + 1);
    });
    return { levels: N, fewestWinningStyles: min, weak };
  },
  /** A scripted average player: random release timing, late hooks now and then. Physics only, from level 1. */
  average(seed = 1, seconds = 60) {
    const r = math.rng(seed), slotOf = (lv) => Math.floor(r() * 3) % Math.max(1, LEVELS[lv].k);
    let lv = 0, clock = 0, deaths = 0, xp = 0, first = null, clean = true, st = makeState(LEVELS[0], [0]), pol = null, hooks = -1;
    const log = [];
    while (clock < seconds && lv < N) {
      if (st.hooks !== hooks) { hooks = st.hooks; pol = { rel: 0.3 + r() * 0.95, sq: -0.45 + r() * 0.85, grabWrong: r() < 0.6 }; }
      step(st, autoHold(st, pol)); clock += K.STEP;
      if (st.mode === "dead" || st.t > 25) { deaths++; clean = false; clock += 0.5; st = makeState(LEVELS[lv], [slotOf(lv)]); hooks = -1; }
      else if (st.mode === "done") { xp += clean ? 2 : 1; if (first == null) first = +clock.toFixed(1); log.push(+st.t.toFixed(1)); clock += 2.2; lv++; clean = true; hooks = -1; if (lv < N) st = makeState(LEVELS[lv], [slotOf(lv)]); }
    }
    return { seconds, levelsCleared: lv, deaths, xp, unlocks: SKINS.filter((k) => k.need > 0 && k.need <= xp).length, firstClearAt: first, levelTimes: log.slice(0, 12) };
  },
  /** One composed hero shot, no HUD, no text. Stays until the next start. */
  poster() {
    posterOn = true;
    g.closePanel(); g.stage.querySelector(".ak-hud").style.visibility = "hidden";
    L = { start: { x: 0, y: 0 }, finish: 99999, k: 0, tip: "", anchors: [{ x: 250, y: 78 }, { x: 420, y: 96 }], pads: [{ x: 138, y: 197, w: 110 }], haz: [{ x: 256, y: 160, w: 64, h: 300 }], hoops: [{ x: 292, y: 112 }], coins: [] };
    for (let i = 0; i < 5; i++) L.coins.push({ x: 216 + i * 15, y: 150 - i * 8 });
    prob = null; guide = null; ghost.length = 0; s = makeState(L, [0]); s.mode = "play"; fx.clear();
    const a = s.anchors[0];
    s.p.x = 166; s.p.y = 134; s.p.vx = 760; s.p.vy = 520;
    s.rope = { a, L: 101, t: 1, slack: false };
    rot = Math.atan2(a.y - s.p.y, a.x - s.p.x) + Math.PI / 2; sqx = 0.95; sqy = 1.08;
    trail.length = 0;
    for (let i = 0; i < 16; i++) { const q = 2.55 + (16 - i) * 0.05; trail.push(a.x + Math.cos(q) * 101, a.y + Math.sin(q) * 101); }
    cam.x = 166 - 400 / Z; cam.y = 134 - 365 / Z; T = 1.3;
    g.redraw();
  },
};
