// Roll On: Archie curls into a bouncy blue ball and rolls through hills, a factory and a moonlit wood.
// sim.js is the physics, levels.js the 24 levels, draw.js the art, bot.js the scripted player that proves every level can be finished.
import { createGame, createFx, math, sfx, FONT, clamp, damp, rand } from "../kit/kit.js";
import { T, R, HT, Builder, newState, setProblems, step, respawn } from "./sim.js";
import { buildLevel, COUNT, WORLDS } from "./levels.js";
import { makeBot, runBot } from "./bot.js";
import { createRenderer, THEMES, INK } from "./draw.js";

const VW = 960, VH = 540, INTRO = 0.6, Z = 1.2, WW = VW / Z, WH = VH / Z;
const UNLOCKS = [
  { id: "p-stripes", name: "Stripes ball", need: 15 }, { id: "t-spark", name: "Sparkle trail", need: 45 }, { id: "h-cap", name: "Sunny cap", need: 80 },
  { id: "p-star", name: "Star ball", need: 125 }, { id: "t-rainbow", name: "Rainbow trail", need: 175 }, { id: "h-party", name: "Party hat", need: 235 },
  { id: "p-swirl", name: "Swirl ball", need: 300 }, { id: "t-comet", name: "Comet trail", need: 370 }, { id: "h-crown", name: "Crown", need: 440 },
];
const g = createGame({
  slug: "roll-on", title: "Roll On", tagline: "Roll, bounce and open the number gates.", instant: true,
  controls: [{ keys: "← →", does: "Roll" }, { keys: "Space", does: "Jump" }], aspect: 16 / 9, bg: "#38b6ff", onMenu: menuExtras,
});
const c = g.canvas2d(VW, VH), ctx = c.ctx, D = createRenderer(ctx), fx = createFx(520);
g.unlocks(UNLOCKS);
g.touchButtons([{ code: "ArrowLeft", label: "◀", side: "left", aria: "Roll left" }, { code: "ArrowRight", label: "▶", side: "left", aria: "Roll right" }, { code: "Space", label: "Jump", side: "right" }]);

let prog = g.load("prog2", { done: [], stars: [], times: [] });
let look = g.load("look", { pattern: "arch", trail: "none", hat: null });
const nextLevel = () => { for (let i = 0; i < COUNT; i++) if (!prog.done[i]) return i; return 0; };
const open = (i) => i === 0 || !!prog.done[i - 1];
const totalStars = () => prog.stars.reduce((a, b) => a + (b || 0), 0);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ---------- level state ----------
let lv = 0, L = null, s = null, th = THEMES[0], bot = null, auto = false, pending = null, quick = false;
let mode = "play", modeT = 0, introT = 0, animT = 0, finishing = false, bannerT = 0;
let sq = 0, sqv = 0, dizzyT = 0, squintT = 0, airT = 0, chain = 0, chainT = 0, dustT = 0, flash = 0, heartT = 0;
const cam = { x: 0, y: 0, look: 0 }, trail = [];
const A = { t: 0, springT: [], gateFx: [], btnFx: [], cpT: [], look: null, hideSigns: false };

function makeProblems(n, level) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const p = math.problem({ topic: "quick", level });
    const wrong = p.choices.filter((v) => !p.check(v)).sort(() => Math.random() - 0.5).slice(0, 2);
    const vals = [p.answer, ...wrong].sort(() => Math.random() - 0.5);
    out.push({ text: p.text, vals, right: vals.findIndex((v) => p.check(v)) });
  }
  return out;
}
function loadLevel(i) {
  lv = i; L = buildLevel(i); th = THEMES[L.theme];
  setProblems(L, makeProblems(L.nmath, i < 12 ? 1 : 2));
  D.prep(L, i + 1);
  s = newState(L);
  mode = "play"; modeT = 0; introT = 0; bannerT = 0; finishing = false;
  sq = sqv = dizzyT = squintT = airT = chain = chainT = flash = heartT = 0;
  A.springT = L.springs.map(() => 0); A.gateFx = L.gates.map(() => 0); A.btnFx = L.buttons.map(() => 0); A.cpT = L.cps.map(() => 0);
  fx.clear(); trail.length = 0;
  cam.look = 0; cam.x = clamp(s.b.x - WW * 0.36, 0, L.W - WW); cam.y = camY(true);
  bot = auto ? makeBot(L) : null;
}
// The camera keeps the ground the ball last stood on in view, and only chases the ball when it leaves a tall window.
let camG = 0;
const camY = (snap) => {
  const b = s.b; if (snap || b.gr) camG = snap ? b.y : camG + (b.y - camG) * 0.2;
  let y = camG - WH * (g.state === "menu" ? 0.42 : 0.66);
  if (b.y - y < WH * 0.16) y = b.y - WH * 0.16; if (b.y - y > WH * 0.74) y = b.y - WH * 0.74;
  return clamp(y, -2000, HT * T + 60 - WH);
};

// ---------- juice ----------
const DUST = () => [th.dirt3, "#ffffff", th.grass2];
function events() {
  const b = s.b;
  for (const [e, x, y, v] of s.ev) {
    if (e === "jump") { sfx.play("jump"); sqv += 5.5; fx.burst(x, y, { n: 7, colors: DUST(), speed: 150, angle: -Math.PI / 2, spread: 2.6, life: 0.35, gravity: 500, size: 4 }); }
    else if (e === "land") { const k = Math.min(1, v / 900); sqv -= 3 + k * 7; sfx.play("land"); fx.burst(x, y, { n: 4 + Math.round(k * 10), colors: DUST(), speed: 120 + k * 160, angle: -Math.PI / 2, spread: 3, life: 0.4, gravity: 600, size: 4.5 }); if (v > 760) { squintT = 0.32; g.shake(4, 0.14); } }
    else if (e === "star") {
      chain = chainT > 0 ? chain + 1 : 0; chainT = 0.9;
      sfx.tone(660 * 2 ** (Math.min(chain, 16) / 12), 0.1, { type: "triangle", vol: 0.22 }); sfx.tone(1320 * 2 ** (Math.min(chain, 16) / 12), 0.08, { type: "sine", vol: 0.1, delay: 0.04 });
      fx.burst(x, y, { n: 6, colors: ["#ffd21f", "#fff6a8", "#ffffff"], speed: 190, life: 0.4, gravity: 200, size: 4, shape: "star" });
      if (chain > 0 && chain % 5 === 4) fx.text(x, y - 18, `${chain + 1} in a row`, { color: "#ffd21f", size: 20, outline: INK });
    }
    else if (e === "spring") { sfx.play("bounce"); A.springT[v] = 0.45; sqv += 9; fx.ring(x, y - 10, { color: "#fff", radius: 46, life: 0.3, width: 5 }); }
    else if (e === "squash") { sfx.play("pop"); sfx.tone(180, 0.12, { type: "square", vol: 0.15, slide: -90 }); g.hitstop(0.05); sqv += 7; fx.burst(x, y, { n: 14, colors: v ? ["#c9cdd8", "#7c4ddb"] : ["#ff9a1f", "#ffd21f", "#ffffff"], speed: 300, life: 0.5, gravity: 800, size: 6, shape: "square" }); fx.ring(x, y, { color: "#fff", radius: 50, life: 0.25 }); fx.text(x, y - 30, "Squash", { color: "#fff", size: 20, outline: INK }); }
    else if (e === "bounce") { sfx.play("bounce"); sqv += 6; }
    else if (e === "hurt" || e === "fall") { sfx.play("hit"); g.shake(9, 0.28); g.hitstop(0.06); dizzyT = 1.2; flash = 1; heartT = 0.5; fx.burst(x, y, { n: 12, colors: ["#ff4d6d", "#ffffff"], speed: 260, life: 0.5, gravity: 500, size: 5, shape: "star" }); }
    else if (e === "respawn") { introT = INTRO * 0.45; fx.ring(x, y, { color: "#fff", radius: 70, life: 0.4 }); cam.x = clamp(x - WW * 0.36, 0, L.W - WW); cam.y = camY(true); trail.length = 0; }
    else if (e === "cp") { sfx.play("power"); A.cpT[v] = 0.001; fx.burst(x, y - 60, { n: 14, colors: ["#3b9bff", "#ffffff", "#ffd21f"], speed: 240, life: 0.6, gravity: 300, size: 5, shape: "star" }); fx.text(x, y - 100, "Checkpoint", { color: "#fff", size: 22, outline: INK }); }
    else if (e === "right") { sfx.play("correct"); A.gateFx[v] = 0; g.shake(3, 0.2); fx.burst(x, y - 20, { n: 18, colors: ["#34d17a", "#ffffff", "#ffd21f"], speed: 320, life: 0.7, gravity: 400, size: 5, shape: "star" }); fx.text(x, y - 96, "Yes!", { color: "#7be07a", size: 30, outline: INK }); g.addCoins(1); }
    else if (e === "wrong") { sfx.play("wrong"); A.gateFx[v] = 0.5; g.shake(4, 0.2); fx.text(x, y - 96, "Try another", { color: "#ffb3b3", size: 22, outline: INK }); }
    else if (e === "press") { sfx.play("click"); fx.burst(x, y - 8, { n: 6, color: "#fff", speed: 120, life: 0.3, size: 3 }); }
    else if (e === "clack") sfx.play("tick");
    else if (e === "poof") { sfx.play("pop"); fx.burst(x, y, { n: 10, color: "#fff", speed: 160, life: 0.4, gravity: 0, size: 6 }); }
    else if (e === "bossOn") { sfx.tone(110, 0.5, { type: "sawtooth", vol: 0.2, slide: -30 }); g.shake(6, 0.4); fx.text(x, y - 150, "Bounce on it 3 times", { color: "#fff", size: 24, outline: INK, life: 2.2, rise: 30 }); }
    else if (e === "bossHop") sfx.play("whoosh");
    else if (e === "bossLand") { sfx.play("crash"); g.shake(12, 0.35); fx.burst(x, y, { n: 18, colors: DUST(), speed: 300, angle: -Math.PI / 2, spread: 3, life: 0.5, gravity: 700, size: 6 }); }
    else if (e === "bossHit") { sfx.play("hit"); sfx.tone(240, 0.2, { type: "square", vol: 0.2, slide: -120 }); g.hitstop(0.09); g.shake(10, 0.3); sqv += 8; fx.burst(x, y, { n: 20, colors: ["#ffd21f", "#ffffff", "#ff9a1f"], speed: 380, life: 0.6, gravity: 700, size: 6, shape: "star" }); fx.ring(x, y, { color: "#fff", radius: 90, life: 0.3, width: 8 }); if (v > 0) fx.text(x, y - 40, v === 1 ? "1 more" : `${v} more`, { color: "#fff", size: 28, outline: INK }); }
    else if (e === "bossDead") { sfx.play("win"); g.slowmo(0.3, 0.9); g.shake(14, 0.5); for (let i = 0; i < 4; i++) fx.burst(x + rand(-40, 40), y + rand(-40, 40), { n: 16, colors: ["#ffd21f", "#ffffff", "#ff9a1f", "#3b9bff"], speed: 420, life: 0.9, gravity: 600, size: 7, shape: i % 2 ? "star" : "square" }); g.addCoins(5); }
    else if (e === "goal") { sfx.play("power"); g.slowmo(0.4, 0.5); for (let i = 0; i < 3; i++) fx.burst(x + rand(-50, 50), y - 80 - i * 30, { n: 18, colors: ["#ffd21f", "#ff5aa5", "#3b9bff", "#34d17a", "#ffffff"], speed: 380, life: 1, gravity: 500, size: 6, shape: i % 2 ? "star" : "square" }); }
  }
  s.ev.length = 0;
  if (b.gr) airT = 0;
}

function update(dt) {
  animT += dt; A.t = animT; bannerT += dt;
  const b = s.b;
  if (mode === "play") {
    let dir, jump;
    if (bot) { const a = bot(s); dir = a.dir; jump = a.jump; }
    else { dir = g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]); jump = g.keys.down("Space", "ArrowUp", "KeyW"); }
    if (g.keys.pressed("KeyR")) { respawn(L, s); sfx.play("whoosh"); }
    step(L, s, dir, jump);
    events();
    if (!b.gr) airT += dt;
    if (s.done) { mode = "win"; modeT = 0; }
    else if (s.fail) { mode = "fail"; modeT = 0; sfx.play("lose"); fx.burst(b.x, b.y, { n: 24, colors: ["#2f6df0", "#6fb0ff", "#ffffff"], speed: 320, life: 0.7, gravity: 600, size: 6 }); }
    // rolling dust, trails
    const sp = Math.hypot(b.vx, b.vy);
    dustT -= dt;
    if (dustT <= 0 && sp > 170) {
      dustT = look.trail === "none" ? 0.09 : 0.035;
      if (look.trail === "spark") fx.burst(b.x - b.vx * 0.03, b.y - b.vy * 0.03, { n: 1, colors: ["#fff6a8", "#ffffff", "#ffd21f"], speed: 40, life: 0.5, gravity: 60, size: 4.5, shape: "star" });
      else if (look.trail === "comet") fx.burst(b.x - b.vx * 0.03, b.y - b.vy * 0.03, { n: 1, colors: ["#bfe3ff", "#ffffff", "#6fb0ff"], speed: 20, life: 0.45, gravity: 0, size: 8 });
      else if (b.gr && sp > 250) fx.burst(b.x - Math.sign(b.vx) * 10, b.y + R - 2, { n: 1, colors: DUST(), speed: 70, angle: -Math.PI / 2 - Math.sign(b.vx) * 0.8, spread: 0.8, life: 0.35, gravity: 300, size: 3.6 });
    }
    if (look.trail === "rainbow") { trail.push(b.x, b.y); if (trail.length > 36) trail.splice(0, 2); }
  } else if (mode === "win") {
    modeT += dt;
    if (modeT > 0.9 && !finishing) finish();
  } else if (mode === "fail") {
    modeT += dt;
    if (modeT > 0.6) { loadLevel(lv); introT = INTRO * 0.3; if (!quick) g.toast("Out of hearts. Go again!", 1300); }
  }
  // timers
  if (introT < INTRO) { const was = introT; introT += dt; if (was < INTRO * 0.45 && introT >= INTRO * 0.45) { sfx.play("pop"); fx.ring(b.x, b.y, { color: "#fff", radius: 60, life: 0.3, width: 6 }); fx.burst(b.x, b.y, { n: 12, colors: ["#6fb0ff", "#ffffff", "#ffd21f"], speed: 240, life: 0.45, gravity: 300, size: 5, shape: "star" }); sqv += 6; } }
  sqv += (-sq * 230 - sqv * 13) * dt; sq = clamp(sq + sqv * dt, -0.42, 0.42);
  if (dizzyT > 0) dizzyT -= dt; if (squintT > 0) squintT -= dt; if (chainT > 0) chainT -= dt; if (flash > 0) flash -= dt * 2.5; if (heartT > 0) heartT -= dt;
  for (let i = 0; i < A.springT.length; i++) if (A.springT[i] > 0) A.springT[i] -= dt;
  for (let i = 0; i < A.gateFx.length; i++) if (A.gateFx[i] > 0) A.gateFx[i] -= dt;
  for (let i = 0; i < A.cpT.length; i++) if (A.cpT[i] > 0 && A.cpT[i] < 1) A.cpT[i] = Math.min(1, A.cpT[i] + dt * 3);
  for (let i = 0; i < L.buttons.length; i++) { const d = Math.abs(b.x - L.buttons[i].x); A.btnFx[i] = L.buttons[i].mode === "num" && d < 70 && !s.gate[L.buttons[i].gate].open ? 0 : 0; }
  // camera with look-ahead
  cam.look = damp(cam.look, clamp(b.vx * 0.42, -150, 150) + b.face * 40, 2.6, dt);
  cam.x = damp(cam.x, clamp(b.x + cam.look - WW * 0.42, 0, L.W - WW), 7, dt);
  cam.y = damp(cam.y, camY(), 6, dt);
  fx.update(dt);
}

async function finish() {
  finishing = true;
  const total = L.stars.length, rating = 1 + (s.nstar >= total * 0.6 ? 1 : 0) + (s.nstar >= total * 0.9 ? 1 : 0), time = s.t, first = !prog.done[lv];
  prog.done[lv] = 1; prog.stars[lv] = Math.max(prog.stars[lv] || 0, rating);
  if (!prog.times[lv] || time < prog.times[lv]) prog.times[lv] = +time.toFixed(1);
  g.save("prog2", prog); g.best = totalStars();
  g.addXp(8 + rating * 3 + (first ? 4 : 0)); g.addCoins(rating);
  const last = lv === COUNT - 1;
  if (last) { g.over({ won: true, title: "You rolled them all", score: totalStars(), lines: [`${totalStars()} of ${COUNT * 3} stars. Replay levels to find them all.`], again: g.coarse ? "Tap to roll again" : "Space to roll again" }); return; }
  if (!quick) await g.levelDone({ title: `${L.name} clear`, stars: rating, lines: [`Stars ${s.nstar} of ${total}   Time ${fmt(time)}`], prompt: "Next level", auto: 2.4 });
  loadLevel(lv + 1);
}

// ---------- drawing ----------
function ballOpts() {
  const b = s.b, sp = Math.hypot(b.vx, b.vy);
  const mood = mode === "win" ? "grin" : dizzyT > 0 ? "dizzy" : squintT > 0 ? "squint" : !b.gr && airT > 0.1 ? "ooh" : sp > 235 ? "grin" : "smile";
  const st = b.gr ? 0 : clamp(Math.abs(b.vy) / 4200, 0, 0.1), sy = 1 + sq + st;
  return {
    ang: b.ang, sx: 1 - (sy - 1) * 0.75, sy, foot: !!b.gr, tilt: clamp(b.vx / 1300, -0.3, 0.3) + (dizzyT > 0 ? Math.sin(animT * 16) * 0.22 : 0),
    look: { x: Math.abs(b.vx) > 30 ? b.vx / 240 : b.face * 0.5, y: b.vy / 520 }, mood, blink: animT % 3.4 < 0.11, pattern: look.pattern, hat: look.hat,
    alpha: b.inv > 0 && mode === "play" && Math.floor(b.inv * 16) % 2 ? 0.45 : 1,
  };
}
function drawHero() {
  const b = s.b;
  if (look.trail === "rainbow" && trail.length > 4) {
    const cols = ["#ff5a6a", "#ff9a1f", "#ffd21f", "#34d17a", "#3b9bff", "#8a5be0"];
    ctx.lineCap = "round";
    for (let k = 0; k < cols.length; k++) { ctx.strokeStyle = cols[k]; ctx.lineWidth = 4; ctx.globalAlpha = 0.85; ctx.beginPath(); for (let i = 0; i < trail.length; i += 2) ctx.lineTo(trail[i], trail[i + 1] - 10 + k * 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (mode === "fail") { const k = modeT / 0.35; if (k < 1) D.ball(b.x, b.y, R * (1 + k * 0.6), { ...ballOpts(), mood: "dizzy", alpha: 1 - k }); return; }
  const o = ballOpts();
  if (g.state === "menu" && !posterOn) { D.transform(b.x, b.y, 0, o); return; }
  const hop = mode === "win" ? -Math.abs(Math.sin(modeT * 9)) * 26 * Math.max(0, 1 - modeT * 0.6) : 0;
  if (mode === "win") { const k = Math.min(1, modeT / 0.3), e = k * (2 - k); D.ball(b.x + (L.goal.x - b.x) * e, b.y + (L.goal.y - R - b.y) * e + hop, R, { ...o, foot: true, sx: 1, sy: 1 }); return; }
  if (introT < INTRO) D.transform(b.x, b.y, introT / INTRO, o); else D.ball(b.x, b.y, R, o);
}
function hud() {
  for (let i = 0; i < 3; i++) { const on = i < s.hearts, k = i === s.hearts && heartT > 0 ? 1 + heartT : 1; D.heart(30 + i * 34, 30 + (i === s.hearts && heartT > 0 ? Math.sin(heartT * 40) * 3 : 0), 1.15 * k, on); }
  ctx.save(); ctx.lineJoin = "round"; ctx.fillStyle = "#ffd21f"; ctx.strokeStyle = "#8a4b00"; ctx.lineWidth = 3; D.star(34, 66, 13, -Math.PI / 2); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.font = `900 22px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = "round";
  const st = `${s.nstar}/${L.stars.length}`; ctx.strokeText(st, 54, 67); ctx.fillStyle = "#fff"; ctx.fillText(st, 54, 67);
  const best = prog.times[lv], tt = fmt(s.t) + (best ? `   best ${fmt(best)}` : "");
  ctx.font = `900 16px ${FONT}`; ctx.lineWidth = 4; ctx.strokeText(tt, 22, 96); ctx.fillText(tt, 22, 96);
  if (bannerT < 2.6) { // the level name, for a moment
    const k = bannerT < 0.25 ? bannerT / 0.25 : bannerT > 2.1 ? Math.max(0, (2.6 - bannerT) / 0.5) : 1;
    ctx.globalAlpha = k; D.label(`${WORLDS[L.theme]} ${(lv % 8) + 1}`, VW / 2, 92 - (1 - k) * 12, 20, "#ffe98a"); D.label(L.name, VW / 2, 126 - (1 - k) * 12, 40); ctx.globalAlpha = 1;
  }
}
function render() {
  if (posterOn) return renderPoster();
  D.backdrop(th, cam.x * Z, cam.y * Z, VW, VH, animT);
  A.look = s.b; A.hideSigns = false;
  ctx.save();
  ctx.scale(Z, Z); ctx.translate(-cam.x + g.shakeX / Z, -cam.y + g.shakeY / Z);
  D.world(L, s, cam.x - 30, cam.x + WW + 30, A);
  drawHero();
  fx.draw(ctx);
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,60,90,${0.28 * flash})`; ctx.fillRect(0, 0, VW, VH); }
  if (g.state === "menu") { D.label(`Level ${lv + 1}: ${L.name}`, VW / 2, 40, 24); return; }
  hud();
}

// ---------- title extras: level select and looks ----------
const css = document.createElement("style");
css.textContent = `.ro-mini{display:flex;gap:.7em;justify-content:center;margin-top:.6em}
.ro-mini button{font:inherit;font-weight:900;font-size:clamp(11px,1.7cqw,18px);color:#fff;background:rgba(27,27,58,.6);border:.16em solid #fff;border-radius:999px;padding:.3em 1.1em;cursor:pointer}
.ro-mini button:hover{background:#2563eb}
.ro-w{font-weight:900;color:#1e3a8a;text-align:left;margin:.5em 0 .2em;font-size:clamp(11px,1.6cqw,17px)}
.ro-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:.6cqw}
.ro-lv{font:inherit;font-weight:900;font-size:clamp(13px,2.2cqw,24px);color:#fff;border:0;border-bottom:.22em solid rgba(15,23,42,.35);border-radius:.6em;padding:.25em 0 .15em;cursor:pointer;line-height:1.1}
.ro-lv small{display:block;font-size:.5em;letter-spacing:.08em;color:#fde047}
.ro-lv.w0{background:#34b84a}.ro-lv.w1{background:#e2803a}.ro-lv.w2{background:#5546b0}
.ro-lv:disabled{background:#cbd5e1;color:#94a3b8;cursor:default}.ro-lv:disabled small{color:#94a3b8}
.ro-opts{display:flex;flex-wrap:wrap;gap:.5em;justify-content:center;margin:.2em 0 .6em}
.ro-opt{font:inherit;font-weight:800;font-size:clamp(11px,1.5cqw,16px);border:.16em solid #cbd5e1;background:#fff;color:#1e3a8a;border-radius:999px;padding:.3em .9em;cursor:pointer}
.ro-opt.on{border-color:#2563eb;background:#dbeafe}.ro-opt:disabled{color:#94a3b8;cursor:default;background:#f1f5f9}
.ro-prev{display:block;margin:0 auto .2em;width:clamp(70px,12cqw,120px);height:clamp(70px,12cqw,120px)}`;
document.head.appendChild(css);
function menuExtras(el) {
  if (!el) return;
  el.innerHTML = `<div class="ro-mini"><button data-r="levels">Levels</button><button data-r="looks">Looks</button></div>`;
  el.addEventListener("click", (e) => { const a = e.target.closest("[data-r]")?.dataset.r; if (!a) return; e.stopPropagation(); sfx.play("click"); a === "levels" ? openLevels() : openLooks(); });
}
function openLevels() {
  const el = g.panel(`<h2>Pick a level</h2>${WORLDS.map((w, k) => `<div class="ro-w">${w}</div><div class="ro-grid">${Array.from({ length: 8 }, (_, j) => { const i = k * 8 + j; return `<button class="ro-lv w${k}" data-lv="${i}" ${open(i) ? "" : "disabled"}>${i + 1}<small>${"★".repeat(prog.stars[i] || 0)}${"☆".repeat(3 - (prog.stars[i] || 0))}</small></button>`; }).join("")}</div>`).join("")}
    <button class="ak-btn ak-ghost" data-back="1">Back</button>`, "ak-wide");
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-back]")) { sfx.play("click"); g.menu(); return; }
    const b = e.target.closest("[data-lv]"); if (!b || b.disabled) return;
    sfx.play("click"); pending = +b.dataset.lv; g.closePanel(); g.start();
  });
}
function openLooks() {
  const groups = [["Ball", "pattern", [["arch", "Archie"], ["stripes", "Stripes", "p-stripes"], ["star", "Star", "p-star"], ["swirl", "Swirl", "p-swirl"]]], ["Trail", "trail", [["none", "Dust"], ["spark", "Sparkle", "t-spark"], ["rainbow", "Rainbow", "t-rainbow"], ["comet", "Comet", "t-comet"]]], ["Hat", "hat", [[null, "None"], ["cap", "Sunny cap", "h-cap"], ["party", "Party hat", "h-party"], ["crown", "Crown", "h-crown"]]]];
  const html = () => `<h2>Looks</h2><canvas class="ro-prev" width="240" height="240"></canvas>${groups.map(([name, key, opts]) => `<div class="ro-w">${name}</div><div class="ro-opts">${opts.map(([v, label, id]) => { const ok = !id || g.unlocked(id); return `<button class="ro-opt${look[key] === v ? " on" : ""}" data-k="${key}" data-v="${v}" ${ok ? "" : "disabled"}>${label}${ok ? "" : ` (${UNLOCKS.find((u) => u.id === id).need} xp)`}</button>`; }).join("")}</div>`).join("")}
    <p class="ak-line">You have ${g.xp} xp. Finish levels to earn more.</p><button class="ak-btn" data-back="1">Done</button>`;
  const el = g.panel(html(), "ak-wide");
  const paint = () => { const cv = el.querySelector("canvas"), x = cv.getContext("2d"); x.clearRect(0, 0, 240, 240); createRenderer(x).ball(120, 150, 70, { pattern: look.pattern, hat: look.hat, mood: "grin", look: { x: 0.4, y: 0 }, ang: 0.5 }); };
  paint();
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-back]")) { sfx.play("click"); g.menu(); return; }
    const b = e.target.closest("[data-k]"); if (!b || b.disabled) return;
    look[b.dataset.k] = b.dataset.v === "null" ? null : b.dataset.v; g.save("look", look); sfx.play("click"); el.innerHTML = html(); paint();
  });
}

// ---------- poster ----------
const HIDE = ".ak-overlay, .ak-hud, .ak-toasts, .ak-touch";
let posterOn = false;
function poster() {
  posterOn = true; g.posterMode = true;
  g.stage.style.setProperty("--ak-aspect", String(innerWidth / innerHeight));
  g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "hidden"));
  L = new Builder(8).flat(7).hill(6, 0.7).flat(9).enemy(4.25, 0).hill(8, 1).flat(6).goal(40).finish("Poster", 0);
  const gy = L.start.y + R + 1, bx = 16.5 * T;
  L.stars = [[70, -62], [96, -92], [-64, -56], [-90, -26], [118, -40]].map(([x, y]) => ({ x: bx + x, y: gy + y }));
  th = THEMES[0]; D.prep(L, 3);
  L.gfx.deco = [{ x: bx - 46, y: gy, kind: "flower", s: 1.1, v: 0.1 }, { x: bx + 84, y: gy, kind: "flower", s: 1, v: 0.3 }, { x: bx - 104, y: gy, kind: "bush", s: 0.9, v: 0.3 }, { x: bx + 128, y: gy, kind: "flower", s: 0.9, v: 0.6 }];
  s = newState(L); fx.clear(); trail.length = 0; mode = "play"; introT = INTRO; animT = 0.5; sq = 0; dizzyT = squintT = 0; airT = 1;
  const b = s.b;
  b.x = bx; b.y = gy - 82; b.vx = 215; b.vy = 430; b.gr = 0; b.ang = -0.45; b.face = 1; s.t = 0;
  for (let i = 1; i < 5; i++) fx.burst(b.x - 22 - i * 9 + rand(-3, 3), b.y - 20 - i * 7 + rand(-3, 3), { n: 1, colors: ["#fff6a8", "#ffffff", "#ffd21f"], speed: 0, life: 99, gravity: 0, size: 5 - i * 0.7, shape: "star", drag: 0 });
  render();
}
function renderPoster() {
  const r = g.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr)), sc = ch / VH, vw = cw / sc, PZ = 2.75;
  if (c.canvas.width !== cw || c.canvas.height !== ch) { c.canvas.width = cw; c.canvas.height = ch; }
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const b = s.b, fxp = b.x + 14, fyp = b.y + 20;
  D.backdrop(th, 250, HT * T - 1150, vw, VH, 2, true);
  ctx.save(); ctx.translate(vw * 0.5, VH * 0.58); ctx.scale(PZ, PZ); ctx.translate(-fxp, -fyp);
  A.t = 0.5; A.look = b; A.hideSigns = true;
  D.world(L, s, fxp - vw / PZ, fxp + vw / PZ, A);
  fx.draw(ctx);
  D.ball(b.x, b.y, R * 1.45, { ang: b.ang, pattern: look.pattern, hat: look.hat, mood: "grin", sy: 1.05, sx: 0.96, tilt: 0.14, look: { x: 0.55, y: 0.75 } });
  ctx.restore();
}

g.onStart = () => {
  if (posterOn) { posterOn = false; g.posterMode = false; g.stage.style.setProperty("--ak-aspect", String(16 / 9)); g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "")); c.fit(); }
  prog = g.load("prog2", prog);
  loadLevel(pending != null ? pending : nextLevel()); pending = null;
};
loadLevel(nextLevel());
g.loop(update, render);

// ---------- test hooks ----------
g.debug = {
  get s() { return s; }, get L() { return L; }, get prog() { return prog; },
  info: () => ({ lv: lv + 1, name: L.name, mode, x: +(s.b.x / T).toFixed(1), y: +((HT * T - s.b.y) / T).toFixed(1), hearts: s.hearts, stars: s.nstar, t: +s.t.toFixed(1), ti: s.ti, done: s.done, cp: s.cp, state: g.state, xp: g.xp }),
  /** Jump to a level (1-based). */
  goto(n) { pending = n - 1; if (g.state === "playing") { loadLevel(n - 1); pending = null; } else g.start(); },
  /** Let the scripted player drive. quick skips the between-level strip. */
  autoplay(on = true, q = true) { auto = on; quick = on && q; bot = on ? makeBot(L) : null; },
  /** Run the scripted player through levels a..b (1-based) in the sim only. Returns one result per level. */
  verify(a = 1, z = COUNT) { const out = []; for (let i = a - 1; i < z; i++) { const l = buildLevel(i); setProblems(l, makeProblems(l.nmath, 1)); const r = runBot(l, newState(l)); out.push({ n: i + 1, name: l.name, done: r.done, t: r.t, hearts: r.hearts, stars: `${r.stars}/${l.stars.length}`, wrong: r.wrong }); } return out; },
  skip(sec) { introT = INTRO; bannerT = 9; if (sec) g.advance(sec); },
  look(o) { Object.assign(look, o); },
  unlockAll() { for (let i = 0; i < COUNT - 1; i++) prog.done[i] = 1; g.save("prog2", prog); },
  /** Draw the whole level small, in rows, to check a layout. */
  map(n = lv + 1, row = 0) {
    const l = buildLevel(n - 1); setProblems(l, makeProblems(l.nmath, 1)); D.prep(l, n); const st = newState(l), z = 0.4, per = VW / z, rows = 3;
    ctx.fillStyle = THEMES[l.theme].sky[1]; ctx.fillRect(0, 0, VW, VH);
    for (let k = 0; k < rows; k++) {
      const x0 = (row + k) * per; let gy = 0, cnt = 0; for (const r of l.runs) for (const p of r) if (p[0] >= x0 && p[0] <= x0 + per) { gy += p[1]; cnt++; }
      gy = cnt ? gy / cnt : HT * T - 300;
      ctx.save(); ctx.beginPath(); ctx.rect(0, (k * VH) / rows, VW, VH / rows); ctx.clip(); ctx.translate(0, (k * VH) / rows + 120); ctx.scale(z, z); ctx.translate(-x0, -gy);
      D.world(l, st, x0, x0 + per, { t: 0, springT: [], gateFx: [], btnFx: [], cpT: [], look: null }); if (!k && !row) D.ball(st.b.x, st.b.y, R, {});
      ctx.restore();
    }
    return Math.ceil(l.W / per);
  },
  poster,
};
