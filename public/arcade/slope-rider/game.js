// Slope Rider: short physics driving levels, one gag each. Hold gas, balance in the air, pick the line where the road is missing.
import { createGame, sfx, createFx, FONT, clamp, lerp, damp } from "../kit/kit.js";
import { LEVELS, VEH, makeLevel, stepLevel, botInput, nextMath } from "./sim.js";
import * as LV from "./levels.js";
import { createView, THEMES } from "./view3d.js";
import { createGarage } from "./garage3d.js";
import { BODIES, PAINTS, WHEELS, HATS, TRAILS, DECALS, byId } from "./car3d.js";
const BOT_T = LV.BOT_T, ALLOW = LV.ALLOW || [];

const W = 960, HH = 540, NAVY = "#1e3a8a", N = LEVELS.length;
const SETS = [["paint", "paint", PAINTS], ["wheel", "wheels", WHEELS], ["hat", "hat", HATS], ["trail", "trail", TRAILS], ["decal", "decal", DECALS]];
const KEYS = Object.keys(VEH);

let pending = null;
const g = createGame({
  slug: "slope-rider", title: "Slope Rider", instant: true, aspect: 16 / 9, bg: "#8fd3ff",
  prompt: matchMedia("(pointer: coarse)").matches ? "Hold the right button to drive" : "Hold the right arrow to drive",
  onMenu: (el) => {
    el.innerHTML = `<div class="sr-menu"><button class="sr-pill" data-p="levels">Levels</button><button class="sr-pill" data-p="garage">Garage</button></div>`;
    el.querySelector("[data-p=levels]").onclick = (e) => { e.stopPropagation(); levelPanel(); };
    el.querySelector("[data-p=garage]").onclick = (e) => { e.stopPropagation(); garage.show(); };
  },
});
const view = createView(g), c2 = g.canvas2d(W, HH), ctx = c2.ctx, fx = createFx(200);
g.unlocks(SETS.flatMap(([k, word, list]) => list.map((p) => ({ id: k + ":" + p.id, need: p.need, name: `${p.name} ${word}` }))).filter((u) => u.need > 0));
g.touchButtons([{ code: "ArrowLeft", label: "◀", side: "left", aria: "Back" }, { code: "ArrowRight", label: "▶", side: "right", aria: "Gas" }]);

const style = document.createElement("style");
style.textContent = `
.sr-menu{display:flex;gap:.6em;justify-content:center;margin:.2em 0}
.sr-pill{font:inherit;font-weight:900;font-size:clamp(12px,1.9cqw,20px);color:#1e3a8a;background:#fff;border:0;border-bottom:.2em solid #94a3b8;border-radius:99px;padding:.3em 1.1em;cursor:pointer}
.sr-pill:hover{background:#fde047}
.sr-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(4px,.8cqw,10px);margin:.5em 0}
.sr-lv{font:inherit;font-weight:900;font-size:clamp(10px,1.7cqw,19px);color:#fff;background:#2563eb;border:0;border-bottom:.2em solid #1e3a8a;border-radius:12px;padding:.25em 0 .15em;cursor:pointer;line-height:1.05}
.sr-lv small{display:block;font-size:.5em;letter-spacing:.1em;color:#fde047;height:1em}
.sr-lv:disabled{background:#cbd5e1;border-bottom-color:#94a3b8;color:#64748b;cursor:default}
.sr-lv.next{background:#f59e0b;border-bottom-color:#b45309}
.sr-row{display:flex;flex-wrap:wrap;gap:.4em;align-items:center;margin:.35em 0;font-weight:800;color:#1e3a8a;font-size:clamp(11px,1.6cqw,17px)}
.sr-row>span{width:4.2em;text-align:left}
.sr-it{font:inherit;font-weight:800;border:2px solid #cbd5e1;background:#fff;color:#1e3a8a;border-radius:10px;padding:.25em .6em;cursor:pointer;display:flex;align-items:center;gap:.35em}
.sr-it i{width:1em;height:1em;border-radius:50%;border:2px solid #1e3a8a;display:inline-block}
.sr-it.on{border-color:#2563eb;background:#dbeafe}
.sr-it:disabled{color:#94a3b8;cursor:default;background:#f1f5f9}
.ak-stage:not([data-state="playing"]) .sr-re{display:none}
.sr-re{position:absolute;left:50%;top:1.2cqw;transform:translateX(-50%);pointer-events:auto}`;
document.head.appendChild(style);
const reBtn = document.createElement("button");
reBtn.className = "ak-icon sr-re"; reBtn.title = "Restart (R)"; reBtn.setAttribute("aria-label", "Restart level");
reBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>`;
reBtn.onclick = () => { if (g.state === "playing" && mode === "run") load(cur); };
g.stage.querySelector(".ak-hud").appendChild(reBtn);

const OPT = ["#2563eb", "#ec4899", "#f59e0b"];
const HINTS = { 0: ["Hold → to drive", "Hold ▶ to drive"], 2: ["← tips the nose down", "◀ tips the nose down"], 6: ["Press 1, 2 or 3", "Tap the ramp that fits"] };

let prog = g.load("prog", null) || { stars: [], best: [], ghost: {} };
const look = { body: "buggy", paint: "sunny", wheel: "classic", hat: "none", trail: "dust", decal: "none", ...(g.load("look", null) || {}) };
const starSum = () => prog.stars.reduce((s, v) => s + (v || 0), 0);
let cur = 0, L = null, th = THEMES[0], mode = "run", failT = 0, subAcc = 0, pickQ = -1, airSlow = 0, airUsed = false, puttT = 0, sndT = 0, banner = 0, flash = 0, poster = false, auto = false, tags = [], rec = [], recN = 0, tries = 0, lastRetry = 0;
let ghostKey = "";
const cam = { x: 0, y: 0, z: 44 };
const nextOpen = () => { const i = LEVELS.findIndex((_, k) => !prog.stars[k]); return i < 0 ? 0 : i; };
const starTimes = (i) => [BOT_T[i] * 1.3 + 0.8, BOT_T[i] * 2 + 2];
const paint = () => byId(PAINTS, look.paint).c;
const puff = (x, y, o) => view.puff(x, y, o);
const SX = (x, y = cam.y) => view.project(x, y)[0], SY = (y, x = cam.x) => view.project(x, y)[1];
const groundY = (x) => view.groundY(x);
const carKey = (i, def) => def.v || (look.body !== "buggy" && byId(BODIES, look.body).stars <= starSum() && (ALLOW[i] || "").includes(String(KEYS.indexOf(look.body))) ? look.body : "buggy");
function load(i, custom) {
  cur = i; const def = custom || LEVELS[i]; L = makeLevel(i, { ...def, v: carKey(custom ? -1 : i, def) }); th = THEMES[L.def.th || 0]; ghostKey = L.car.key; mode = "run"; failT = 0; subAcc = 0; pickQ = -1; airSlow = 0; airUsed = false; flash = 0; rec = []; recN = 0; tags = [];
  fx.clear();
  view.setLevel(L, { look });
  const c = L.car.chassis; cam.x = c.x + 2; cam.y = c.y + 1.2; cam.z = 46; banner = 2;
  if (g.state !== "playing") { cam.z = 64; cam.x = c.x + 3.4; cam.y = c.y - 1.5; }
  if (!poster) { g.setHud("Level", `${i + 1}/${N}`); g.setHud("Time", "0.0"); g.setHud("Best", prog.best[i] ? prog.best[i].toFixed(1) : null); }
}
g.onStart = () => { poster = false; g.stage.querySelector(".ak-hud").style.visibility = ""; tries = 0; load(pending ?? (g.state === "playing" && L && mode === "over" ? nextOpen() : nextOpen())); pending = null; };

function levelPanel() {
  const open = nextOpen(), all = prog.stars.filter(Boolean).length >= N;
  const el = g.panel(`<h2>Levels</h2><div class="sr-grid">${LEVELS.map((_, i) => `<button class="sr-lv${i === open && !all ? " next" : ""}" data-i="${i}" ${all || i <= open ? "" : "disabled"}>${i + 1}<small>${"★".repeat(prog.stars[i] || 0)}</small></button>`).join("")}</div><button class="ak-btn ak-ghost" data-x="1">Back</button>`, "ak-wide");
  el.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b && !b.disabled) { pending = +b.dataset.i; g.start(); } else if (e.target.closest("[data-x]")) { e.stopPropagation(); g.menu(); } };
}
function finishLevel() {
  mode = "done";
  const t = L.t, [t3, t2] = starTimes(cur), stars = t <= t3 ? 3 : t <= t2 ? 2 : 1, first = !prog.stars[cur], nb = !prog.best[cur] || t < prog.best[cur];
  const was = prog.stars[cur] || 0;
  prog.stars[cur] = Math.max(was, stars);
  if (nb) { prog.best[cur] = +t.toFixed(2); prog.ghost[cur] = rec.slice(0, 900); (prog.gv ||= {})[cur] = L.car.key; }
  const s0 = starSum() - (prog.stars[cur] || 0) + (was || 0), s1 = starSum(); for (const b of BODIES) if (b.stars > s0 && b.stars <= s1) g.toast(`Unlocked: ${b.name}`, 2400, "gold");
  g.save("prog", prog); g.addXp(8 + 4 * stars + (first ? 10 : 0) + L.flips * 2); g.addCoins(L.got);
  const lines = [`${t.toFixed(2)} s${nb && !first ? ", new best" : ""}${stars < 3 ? `. Three stars under ${t3.toFixed(1)} s` : ""}`];
  if (cur === N - 1 && !LEVELS.some((_, k) => !prog.stars[k])) { mode = "over"; g.over({ title: "Every level done", score: prog.stars.reduce((s, v) => s + (v || 0), 0), scoreLabel: "Stars", lines, won: true, again: "Play again for more stars" }); return; }
  g.levelDone({ title: `Level ${cur + 1} clear`, stars, lines, auto: 1.2 }).then(() => { tries = 0; load((cur + 1) % N); });
}

function sound(dt) {
  sndT -= dt; puttT -= dt;
  const car = L.car, rpm = Math.abs(car.wheels[0].w), gas = g.keys.down("ArrowRight", "KeyD", "ArrowUp", "KeyW") || auto;
  if (puttT <= 0 && mode === "run" && (L.started || gas)) { sfx.tone(46 + rpm * 1.5 + (gas ? 14 : 0), 0.055, { type: "sawtooth", vol: gas ? 0.2 : 0.08, slide: 40 + rpm * 1.2 }); puttT = 1 / (8 + rpm * 0.4); }
  for (const e of L.world.events) {
    const tag = (e.a.tag === "crate" || e.b.tag === "crate") ? "crate" : (e.a.tag === "hammer" || e.b.tag === "hammer") ? "hammer" : (e.a.tag === "car" || e.b.tag === "car" || e.a.tag === "wheel" || e.b.tag === "wheel") ? "car" : "thing";
    const near = Math.abs(e.x - cam.x) < 22;
    if (!near) continue;
    if (tag === "crate") { puff(e.x, e.y, { n: 2, color: "#d9a05b", sq: true, speed: 4, spread: 6, size: 0.1, g: 14 }); if (sndT <= 0) { sfx.tone(150 + Math.random() * 120, 0.05, { type: "square", vol: clamp(e.v / 14, 0.1, 0.45) }); sfx.noise(0.05, { freq: 1400, vol: 0.25 }); sndT = 0.045; } }
    else if (tag === "hammer") { sfx.play("hit"); g.shake(12, 0.3); g.hitstop(0.06); fx.ring(SX(e.x), SY(e.y), { color: "#fff", radius: 70 }); }
    else if (tag === "car") { if (e.v > 3) { puff(e.x, e.y, { n: Math.min(8, e.v | 0), color: th.dust, speed: 2.5, spread: 3, size: 0.2, life: 0.5 }); if (sndT <= 0) { sfx.noise(0.09, { freq: 260 + e.v * 20, vol: clamp(e.v / 12, 0.15, 0.9) }); sndT = 0.06; } if (e.v > 9) g.shake(Math.min(9, e.v * 0.5), 0.18); } }
    else if (sndT <= 0 && e.v > 3) { sfx.noise(0.06, { freq: 500, vol: 0.25 }); sndT = 0.06; }
  }
  L.world.events.length = 0;
  for (const e of L.ev) {
    const c = L.car.chassis;
    if (e.type === "coin") { sfx.tone(880 * 2 ** (Math.min(e.n, 14) / 12), 0.09, { type: "square", vol: 0.28 }); puff(e.x, e.y, { n: 6, color: "#fde047", speed: 4, spread: 6.3, size: 0.1, life: 0.35, g: 0 }); }
    else if (e.type === "pick") { if (e.ok) { sfx.play("correct"); fx.text(SX(e.x), SY(e.y) - 30, e.label, { color: "#bbf7d0", size: 30, outline: "#14532d" }); puff(e.x, e.y, { n: 16, colors: ["#fde047", "#fff"], speed: 5, spread: 6.3, size: 0.12, g: 0, life: 0.5 }); } else sfx.tone(160, 0.12, { type: "square", vol: 0.3, slide: 110 }); g.shake(3, 0.1); }
    else if (e.type === "flip") { sfx.play("power"); fx.text(SX(c.x), SY(c.y) - 60, e.n > 1 ? `${e.n} flips!` : "Flip!", { color: "#fde047", size: 40, outline: NAVY }); }
    else if (e.type === "land") { if (e.air > 0.9) fx.text(SX(c.x), SY(c.y) - 40, `${e.air.toFixed(1)} s air`, { color: "#fff", size: 24, outline: NAVY }); for (const w of L.car.wheels) puff(w.x, w.y - w.shapes[0].r, { n: 5, color: th.dust, speed: 3, spread: 3, size: 0.22, life: 0.5 }); }
    else if (e.type === "bounce") { sfx.play("bounce"); fx.ring(SX(e.x), SY(e.y), { color: "#f9a8d4", radius: 80 }); }
    else if (e.type === "trigger") { sfx.noise(0.5, { freq: 160, vol: 0.9 }); g.shake(8, 0.5); }
    else if (e.type === "creak") sfx.tone(300, 0.1, { type: "sawtooth", vol: 0.2, slide: 180 });
    else if (e.type === "fail") { sfx.play(e.why === "fell" ? "whoosh" : "hit"); g.shake(10, 0.25); flash = 1; puff(c.x, c.y, { n: 18, colors: [paint(), "#fff", th.dust], speed: 7, spread: 6.3, size: 0.18, g: 10, sq: true }); }
    else if (e.type === "win") { sfx.play("coin"); for (let i = 0; i < 70; i++) puff(L.finishX + (Math.random() - 0.5) * 3, L.finishY + 3 + Math.random() * 3, { colors: ["#ef4444", "#fde047", "#10b981", "#3b82f6", "#ec4899", "#fff"], speed: 7, spread: 6.3, size: 0.14, g: 7, life: 1.6, sq: true }); }
  }
  L.ev.length = 0;
}

function update(dt) {
  if (!L || mode === "done" || mode === "over" || poster) return;
  const c = L.car.chassis;
  if (g.keys.pressed("KeyR") && mode === "run") { load(cur); return; }
  for (const [k, codes] of [[0, ["Digit1", "Numpad1"]], [1, ["Digit2", "Numpad2"]], [2, ["Digit3", "Numpad3"]]]) if (g.keys.pressed(...codes)) pickQ = k;
  if (g.pointer.pressed) { const p = g.pointer.at(c2); for (const t of tags) if (p.x > t.x - 8 && p.x < t.x + t.w + 8 && p.y > t.y - 8 && p.y < t.y + t.h + 8) pickQ = t.k; }
  let inp = { gas: g.keys.down("ArrowRight", "KeyD", "ArrowUp", "KeyW"), brake: g.keys.down("ArrowLeft", "KeyA", "ArrowDown", "KeyS"), pick: pickQ };
  if (auto) inp = botInput(L);
  let ts = 1;
  const mi = nextMath(L);
  if (mi >= 0 && L.maths[mi].picked < 0 && mode === "run") { const d = L.maths[mi].x0 - c.x; if (d < 17) ts = d < 7 ? 0.25 : 0.5; }
  if (L.grounded) airUsed = false;
  else if (!airUsed && L.airT > 0.25 && c.y - groundY(c.x) > 3.2 && mode === "run") { airUsed = true; airSlow = 0.55; sfx.play("whoosh"); }
  if (airSlow > 0) { airSlow -= dt; ts = Math.min(ts, 0.5); }
  if (mode === "fail" || (mode === "win" && L.winT < 0.35)) ts = 0.5;
  subAcc += 2 * ts;
  const n = Math.floor(subAcc); subAcc -= n;
  if (n) { stepLevel(L, inp, n); pickQ = -1; }
  sound(dt);
  if (mode === "run") {
    if (L.started && ++recN % 6 === 0 && rec.length < 2700) rec.push(Math.round(c.x * 20), Math.round(c.y * 20), Math.round(c.a * 50));
    for (const w of L.car.wheels) if (w.nc > 0 && (inp.gas || inp.brake) && Math.random() < 0.5) puff(w.x - 0.2, w.y - w.shapes[0].r + 0.05, { color: th.dust, angle: inp.gas ? 2.6 : 0.6, speed: 2 + Math.abs(c.vx) * 0.15, spread: 0.7, size: 0.13, life: 0.4, grow: 0.3 });
    if (L.state === "fail") { mode = "fail"; failT = 0.28; tries++; }
    else if (L.state === "win") mode = "win";
    if (!poster) g.setHud("Time", L.t.toFixed(1));
  } else if (mode === "fail") { failT -= dt; if (failT <= 0) { lastRetry = 0.28; load(cur); return; } }
  else if (mode === "win" && L.winT > 0.85) { finishLevel(); return; }
  const tr = byId(TRAILS, look.trail), spd = Math.hypot(c.vx, c.vy);
  if (tr.colors && mode === "run" && L.started && spd > 3 && Math.random() < 0.75) { const w = L.car.wheels[0]; puff(w.x - 0.3, w.y, { colors: tr.colors, size: tr.size, life: tr.life, g: tr.g, sq: tr.sq, grow: tr.grow, speed: 1.3, spread: 6.3, vx: c.vx * 0.15, zs: 1.5 }); }
  view.fx.update(dt * ts);
  fx.update(dt);
  if (banner > 0) banner -= dt;
  if (flash > 0) flash -= dt * 4;
  // camera
  const sp = Math.hypot(c.vx, c.vy);
  let zt = lerp(46, 31, clamp(sp / 20, 0, 1)), tx = c.x + clamp(c.vx * 0.45, -3, 8) + 2, ty = c.y + 1.2 + clamp(c.vy * 0.1, -2, 2);
  if (mi >= 0 && L.maths[mi].x0 - c.x < 24) { const M = L.maths[mi]; zt = Math.min(zt, clamp((W * 0.8) / (M.x1 - c.x + 9), 21, 46)); ty = Math.max(ty, (c.y + M.oy + Math.max(M.A[1], M.B[1]) * M.u) / 2 + 1.5); }
  for (const lp of L.loops) if (Math.abs(c.x - lp.cx) < lp.R + 10) { zt = Math.min(zt, 25); ty = lp.cy - 0.8; }
  tx = Math.min(tx, L.endX - (W * 0.6) / cam.z + 14);
  cam.z = damp(cam.z, zt, 2.5, dt); cam.x = damp(cam.x, tx, 6, dt); cam.y = damp(cam.y, ty, 4, dt);
}


// ---------- drawing: the world is 3D (view3d.js); this thin 2D layer on top holds hints, pop-up words and the flash ----------
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const posterCam = { yaw: 0.52, pitch: 0.05 };
function render() {
  if (garage.open) { ctx.clearRect(0, 0, W, HH); garage.render(); return; }
  if (!L) return;
  const c = L.car.chassis, t = L.pt, up = Math.cos(c.a), mi = nextMath(L);
  let gh = null;
  const rec0 = prog.ghost[cur];
  if (rec0 && L.started && mode === "run" && !poster && (prog.gv?.[cur] || "buggy") === ghostKey) { const f = (L.t * 10) | 0; if (f * 3 + 2 < rec0.length) gh = [rec0[f * 3] / 20, rec0[f * 3 + 1] / 20, rec0[f * 3 + 2] / 50]; }
  view.render({ cam, t, pose: mode === "fail" || up < 0 ? "sad" : mode === "win" || L.grounded === 0 ? "jump" : "idle", ghost: gh, mi, poster, shake: [g.shakeX, g.shakeY], ...(poster ? posterCam : {}) });
  tags = mi >= 0 && !poster ? view.tags : [];
  ctx.clearRect(0, 0, W, HH);
  if (poster) return;
  const hint = HINTS[cur];
  if (hint && g.state === "playing" && !prog.stars[cur] && mode === "run" && (cur !== 0 || !L.started || L.t < 2) && (cur !== 6 || mi >= 0)) {
    const p = view.project(c.x, c.y + 2.9), hx2 = cur === 6 ? 250 : p[0] + 40, hy2 = cur === 6 ? 250 : Math.max(70, p[1]);
    ctx.font = `900 26px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = NAVY; ctx.strokeText(hint[g.coarse ? 1 : 0], hx2, hy2); ctx.fillStyle = "#fff"; ctx.fillText(hint[g.coarse ? 1 : 0], hx2, hy2);
  }
  if (g.state === "playing" && mode === "run" && !prog.stars[cur] && L.started) {
    const z = L.zones.find((q) => q.wait && !q.on && !q.go && c.x > q.x0 - 9 && c.x < q.x1);
    if (z) { const p = view.project(c.x, c.y + 3.2), s = z.wait(L) ? "Go!" : g.coarse ? "Brake and wait" : "Left arrow brakes. Wait here"; ctx.font = `900 24px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = NAVY; ctx.strokeText(s, clamp(p[0] + 30, 190, W - 190), Math.max(110, p[1])); ctx.fillStyle = "#fde047"; ctx.fillText(s, clamp(p[0] + 30, 190, W - 190), Math.max(110, p[1])); }
  }
  if (banner > 0 && g.state === "playing" && !L.maths.length) { ctx.globalAlpha = clamp(banner, 0, 1); ctx.font = `900 30px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = NAVY; const s = `${cur + 1}. ${L.def.n}`; ctx.strokeText(s, W / 2, 92); ctx.fillStyle = "#fde047"; ctx.fillText(s, W / 2, 92); ctx.globalAlpha = 1; }
  const sp = Math.abs(c.vx);
  if (sp > 13 && g.state === "playing") { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = hash(i + ((t * 12) | 0)) * HH, x = hash(i * 7 + ((t * 12) | 0)) * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 30 - sp * 3, y); ctx.stroke(); } }
  fx.draw(ctx);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(flash, 0, 1) * 0.6})`; ctx.fillRect(0, 0, W, HH); }
}
const garage = createGarage(g, view, {
  look: () => look, stars: starSum,
  equip: (k, id) => { look[k] = id; g.save("look", look); },
  onClose: () => { load(nextOpen()); g.menu(); },
});
g.loop(update, render);
load(nextOpen());
g.redraw();

// ---------- poster and test hooks ----------
function makePoster() {
  poster = true; g.posterMode = true;
  g.closePanel(); g.stage.querySelector(".ak-hud").style.visibility = "hidden";
  load(0, { n: "Poster", th: 0, f: (B) => B.flat(3).kick(7, 2.6).to(0.5, -2.6).flat(6).crates(-3.2, 2, 2, 0.95).flat(30).coins(-33, 5.4, -27, 4.4, 5, 0.6).boulder(-53.5, 0, 1.7, 999).finish() });
  const car = L.car, c = car.chassis, cx0 = c.x, cy0 = c.y, dx = 12.4 - c.x, dy = 4.3 - c.y, a = 0.42;
  for (const b of [c, ...car.wheels]) { const rx = b.x - cx0, ry = b.y - cy0; b.x = cx0 + dx + rx * Math.cos(a) - ry * Math.sin(a); b.y = cy0 + dy + rx * Math.sin(a) + ry * Math.cos(a) - (b === c ? 0 : 0.12); b.a += a; }
  car.wheels.forEach((w, i) => { w.a = i * 1.3; w.sync(); }); c.sync();
  let k = 0;
  for (const b of L.world.bodies) if (b.tag === "crate") { const q = [[15.4, 3.6, 0.5], [16.6, 5.0, -0.7], [17.2, 2.6, 1.1], [15.9, 1.6, 0.2]][k++ % 4]; b.x = q[0]; b.y = q[1]; b.a = q[2]; b.sync(); }
  for (const b of L.world.bodies) if (b.tag === "boulder") { b.x = 8.3; b.y = 4.3; b.a = 0.6; b.sync(); }
  L.grounded = 0; mode = "run"; banner = 0;
  for (let i = 0; i < 16; i++) puff(10.4 - i * 0.28, 3.0 - i * 0.13, { color: th.dust, size: 0.34, life: 99, speed: 0.3, g: 0, zs: 1.2 });
  cam.z = 74; cam.x = c.x - 0.3; cam.y = c.y + 1.15;
  g.redraw();
}
g.debug = {
  get L() { return L; }, get mode() { return mode; }, get level() { return cur; }, get prog() { return prog; }, get look() { return look; }, view, garage,
  goto(i) { pending = i; g.start(); }, auto(on = true) { auto = on; }, poster: makePoster,
  next() { g._levelGo?.(); },
  info() { const c = L.car.chassis; return { level: cur + 1, mode, state: L.state, why: L.why, car: L.car.key, x: +c.x.toFixed(1), y: +c.y.toFixed(1), t: +L.t.toFixed(2), tries, retry: lastRetry, stars: starSum(), xp: g.xp, tags: tags.length, picked: L.maths.map((m) => m.picked) }; },
};
