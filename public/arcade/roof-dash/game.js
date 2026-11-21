// Roof Dash: a minimalist precision speed-platformer across flat geometric rooftops.
// Run, slide, dive, wall-jump. Short levels, a running clock, medals, a ghost of your best run,
// and shortcut doors you open by jumping into the right answer.
// Levels live in levels.js, the world rules in sim.js, the controller in plat.js.
import { createGame, createFx, math, sfx, FONT, clamp, damp, rand } from "../kit/kit.js";
import { LEVELS } from "./levels.js";
import { build, newState, step, syncBoxes, T, CFG, EV, ZEV } from "./sim.js";

const VW = 960, VH = 540;
const INK = "#1c2440", HAZ = "#ff4d6a", HAZ_D = "#b81f45", SUN = "#ffc93c", SUN_D = "#b9860a", MINT = "#2fbf8f", PORTAL = "#7c5cff", SKIN = "#ffe9cf";
const MEDAL = ["#f5b301", "#aab4c3", "#c98448"], MEDAL_NAME = ["Gold", "Silver", "Bronze"];
// one palette per block of 8 levels: sky top, sky bottom, roof fill, roof outline, roof lip, far skyline
const THEMES = [
  { top: "#d6e8fb", bot: "#fdebd8", roof: "#3f4d73", line: "#232b47", lip: "#62739f", far: "#9db0d3" },
  { top: "#d5f1ec", bot: "#fff3d6", roof: "#35596a", line: "#1c343e", lip: "#55849a", far: "#93c2bd" },
  { top: "#ffe3d1", bot: "#ffd6e2", roof: "#5a3f66", line: "#35223f", lip: "#80608f", far: "#dba3b1" },
  { top: "#e3dcfb", bot: "#f9dcea", roof: "#44407a", line: "#27244d", lip: "#6863a6", far: "#aea6da" },
  { top: "#cbd8f4", bot: "#ebe2f6", roof: "#2c3558", line: "#141a33", lip: "#4a5488", far: "#93a0cb" },
];
const HOODS = [
  { id: "blue", name: "Blue hoodie", col: "#2f7bf6", need: 0 },
  { id: "ember", name: "Ember hoodie", col: "#f08a24", need: 20 },
  { id: "mint", name: "Mint hoodie", col: "#14b88a", need: 90 },
  { id: "violet", name: "Violet hoodie", col: "#8b5cf6", need: 200 },
  { id: "night", name: "Midnight hoodie", col: "#3b4763", need: 380 },
  { id: "gold", name: "Gold hoodie", col: "#e3ad0c", need: 520 },
];
const TRAILS = [
  { id: "streak", name: "Streak trail", need: 0 },
  { id: "sparks", name: "Spark trail", need: 50 },
  { id: "ribbon", name: "Ribbon trail", need: 140 },
  { id: "comet", name: "Comet trail", need: 280 },
];

const css = document.createElement("style");
css.textContent = `
.rd-row { display: flex; gap: 0.6em; justify-content: center; margin: 0.3em 0 0.1em; }
.rd-link { font: inherit; font-weight: 900; font-size: clamp(11px, 1.7cqw, 18px); padding: 0.35em 1em; border-radius: 999px; border: 2px solid rgb(255 255 255 / 0.85); background: rgb(28 36 64 / 0.55); color: #fff; cursor: pointer; }
.rd-link:hover { background: rgb(28 36 64 / 0.8); }
.rd-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: clamp(3px, 0.7cqw, 8px); margin: 0.4em 0 0.6em; }
.rd-lv { font: inherit; display: flex; flex-direction: column; align-items: center; gap: 0.15em; padding: 0.4em 0.1em; border-radius: 10px; border: 2px solid ${INK}; background: #f4f7fd; color: ${INK}; cursor: pointer; min-width: 0; }
.rd-lv:hover:not(:disabled) { background: #dfe8fa; }
.rd-lv:disabled { opacity: 0.38; cursor: default; }
.rd-lv b { font-size: clamp(12px, 1.9cqw, 20px); font-weight: 900; line-height: 1; }
.rd-lv em { font-style: normal; font-size: clamp(7px, 1cqw, 12px); font-weight: 800; color: #51607f; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 0.3em; }
.rd-medal { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; border: 1.5px solid ${INK}; }
.rd-medal.rd-none { background: transparent; border-style: dashed; border-color: #94a3b8; }
.rd-looks { display: flex; flex-wrap: wrap; gap: 0.5em; justify-content: center; margin: 0.3em 0 0.7em; }
.rd-look { font: inherit; font-weight: 800; font-size: clamp(10px, 1.4cqw, 15px); display: flex; align-items: center; gap: 0.45em; padding: 0.45em 0.8em; border-radius: 999px; border: 2px solid ${INK}; background: #f4f7fd; color: ${INK}; cursor: pointer; }
.rd-look i { width: 1.1em; height: 1.1em; border-radius: 35%; border: 1.5px solid ${INK}; display: inline-block; }
.rd-look.on { background: ${INK}; color: #fff; }
.rd-look:disabled { opacity: 0.45; cursor: default; }
.ak-root .ak-tbtn { background: rgb(28 36 64 / 0.16); color: ${INK}; border-color: rgb(28 36 64 / 0.5); }
.ak-root .ak-tbtn.on { background: rgb(28 36 64 / 0.34); }
`;
document.head.appendChild(css);

const g = createGame({
  slug: "roof-dash",
  title: "Roof Dash",
  tagline: "Run the roofs. Beat the clock.",
  instant: true,
  controls: [{ keys: "← →", does: "Run" }, { keys: "↑ / Space", does: "Jump" }, { keys: "↓", does: "Slide, dive" }],
  aspect: 16 / 9,
  bg: THEMES[0].top,
  onMenu: (el) => {
    const row = document.createElement("div");
    row.className = "rd-row";
    for (const [label, fn] of [["Levels", showLevels], ["Hoodie", showLooks]]) {
      const b = document.createElement("button");
      b.className = "rd-link"; b.textContent = label;
      b.onclick = (e) => { e.stopPropagation(); sfx.play("click"); fn(); };
      row.appendChild(b);
    }
    el.appendChild(row);
  },
});
const c = g.canvas2d(VW, VH);
const { ctx } = c;
const fx = createFx(260);
g.unlocks([...HOODS, ...TRAILS].filter((u) => u.need > 0));

// ---------- saves ----------
let times = g.load("times", {});            // level index -> best seconds
let look = g.load("look", { hood: "blue", trail: "streak" });
const fmt = (t) => (t >= 60 ? Math.floor(t / 60) + ":" + (t % 60).toFixed(2).padStart(5, "0") : t.toFixed(2));
const medalOf = (i, t) => (t == null ? -1 : t <= LEVELS[i].par[0] ? 0 : t <= LEVELS[i].par[1] ? 1 : t <= LEVELS[i].par[2] ? 2 : 3);
const nextLevel = () => { let n = 0; while (n < LEVELS.length && times[n] != null) n++; return n; };
const hoodCol = () => (HOODS.find((h) => h.id === look.hood && g.unlocked(h.id)) || HOODS[0]).col;
const trailId = () => (TRAILS.find((h) => h.id === look.trail && g.unlocked(h.id)) || TRAILS[0]).id;

// ---------- run state ----------
let cur = Math.min(nextLevel(), LEVELS.length - 1), W, s, TH = THEMES[0], mode = "run", labels = [], probs = [], decor = [];
const cam = { x: 0, y: 0 };
let squash = 0, doorAnim = [], padPop = [], springT = [], fresh = true, fixedOk = null, startAt = null, wantRetry = false;
let ghost = null, rec = [], bot = null, verifying = false, posterOn = false, runPhase = 0, hue = "";
const inp = { dir: 0, jump: false, down: false };
const trail = [];
const scarf = Array.from({ length: 7 }, () => ({ x: 0, y: 0 }));

const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function topicFor(i) { return i < 20 ? { topic: "quick", level: 1 } : i < 30 ? { topic: "quick", level: 2 } : { topic: "prealgebra", level: 1 }; }
function newProblems() {
  probs = []; labels = [];
  return W.doors.map(() => {
    const q = math.problem(topicFor(cur));
    const wrong = q.choices.filter((v) => !q.check(v)).slice(0, 2);
    const k = fixedOk != null ? fixedOk : Math.floor(Math.random() * 3);
    const row = [wrong[0], wrong[1]];
    row.splice(k, 0, q.answer);
    probs.push(q); labels.push(row);
    return k;
  });
}
function neck(p) { return { x: p.x + p.w / 2 - p.face * 5, y: p.y + (p.slide ? 6 : 11) }; }
function resetScarf() { const n = neck(s.p); scarf.forEach((q, i) => { q.x = n.x - s.p.face * i * 4; q.y = n.y + i * 2; }); }
function buildDecor() {
  decor = [];
  const taken = new Set();
  for (const o of [...W.springs, ...W.flags, ...W.pads, ...W.boosts, ...W.signs]) taken.add(o.col);
  for (let x = 5; x < W.cols - 2; x++) {
    if (taken.has(x) || Math.abs(x - W.goal.col) < 3 || hash(x * 3.7 + cur * 11) > 0.13) continue;
    let r = 0;
    while (r < W.rows && W.grid[r * W.cols + x] === 0) r++;
    if (r < 5 || r >= W.rows || W.grid[r * W.cols + x] !== 1) continue;
    const wide = W.grid[r * W.cols + x + 1] === 1 && W.grid[(r - 1) * W.cols + x + 1] === 0 && !taken.has(x + 1);
    const kind = Math.floor(hash(x * 9.1 + cur) * 4);
    decor.push({ x: x * T, y: r * T, kind: kind === 1 && !wide ? 0 : kind, h: 30 + hash(x * 5.3) * 26 });
  }
}
function load(i, ok = null) {
  cur = clamp(i, 0, LEVELS.length - 1);
  fixedOk = ok;
  if (!W || W.def !== LEVELS[cur]) { W = build(LEVELS[cur]); buildDecor(); }
  TH = THEMES[Math.floor(cur / 8) % THEMES.length];
  s = newState(W, newProblems());
  syncBoxes(W, s);
  bot = null; mode = "run"; wantRetry = false;
  trail.length = 0; rec = []; fx.clear();
  ghost = verifying ? null : g.load("ghost" + cur, null);
  doorAnim = W.doors.map(() => 0);
  padPop = W.pads.map(() => 0);
  springT = W.springs.map(() => 9);
  squash = 0; fresh = true;
  resetScarf();
  const ct = camTarget(); cam.x = ct.x; cam.y = ct.y;
  hue = hoodCol();
  g.setHud("Level", `${cur + 1}/${LEVELS.length}`);
}
function camTarget() {
  const p = s.p;
  return {
    x: clamp(p.x + p.w / 2 - VW * 0.42 + p.face * 70 + p.vx * 0.24, 0, Math.max(0, W.cols * T - VW)),
    y: clamp(p.y + p.h - VH * 0.62 + clamp(p.vy * 0.06, -20, 60), -200, Math.max(-200, W.rows * T - VH - 30)),
  };
}

const HIDE = ".ak-overlay, .ak-hud, .ak-toasts, .ak-touch";
g.onStart = () => {
  if (posterOn) { posterOn = false; g.posterMode = false; g.stage.style.setProperty("--ak-aspect", String(16 / 9)); g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "")); c.fit(); }
  g.closePanel();
  const n = startAt ?? nextLevel();
  startAt = null;
  load(n >= LEVELS.length ? 0 : n);
};
g.touchButtons([
  { code: "ArrowLeft", label: "◀", side: "left" }, { code: "ArrowRight", label: "▶", side: "left" },
  { code: "KeyR", label: "↻", side: "right", aria: "Restart" }, { code: "ArrowDown", label: "▼", side: "right", aria: "Slide" }, { code: "Space", label: "Jump", side: "right" },
]);
g.onTopic = () => { if (W && W.doors.length && s.doors.every((d) => d === 0)) s.ok = newProblems(); };
addEventListener("keydown", (e) => { if (mode === "done" && e.code === "KeyR" && !e.repeat) { wantRetry = true; g._levelGo?.(); } });

// ---------- panels ----------
const medalDot = (m) => (m >= 0 && m < 3 ? `<i class="rd-medal" style="background:${MEDAL[m]}"></i>` : `<i class="rd-medal rd-none"></i>`);
function showLevels() {
  const un = Math.min(nextLevel(), LEVELS.length - 1);
  const golds = LEVELS.filter((_, i) => medalOf(i, times[i]) === 0).length;
  const cells = LEVELS.map((d, i) => {
    const t = times[i];
    return `<button class="rd-lv" data-lv="${i}" title="${d.n}" ${i > un ? "disabled" : ""}><b>${i + 1}</b><em>${medalDot(medalOf(i, t))}${t != null ? fmt(t) : i > un ? "" : "New"}</em></button>`;
  }).join("");
  const el = g.panel(`<h2>Levels</h2><div class="rd-grid">${cells}</div>
    <p class="ak-line">${Object.keys(times).length} of ${LEVELS.length} done. ${golds} gold.</p>
    <button class="ak-btn ak-ghost" data-back="1">Back</button>`, "ak-wide");
  el.onclick = (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-lv]");
    if (b && !b.disabled) { sfx.play("click"); startAt = Number(b.dataset.lv); g.start(); }
    else if (e.target.closest("[data-back]")) { sfx.play("click"); g.menu(); }
  };
}
function showLooks() {
  const btn = (u, kind) => {
    const open = g.unlocked(u.id) || u.need === 0, on = look[kind] === u.id;
    return `<button class="rd-look ${on ? "on" : ""}" data-kind="${kind}" data-id="${u.id}" ${open ? "" : "disabled"}>${u.col ? `<i style="background:${u.col}"></i>` : ""}${u.name}${open ? "" : ` (${u.need} xp)`}</button>`;
  };
  const el = g.panel(`<h2>Your look</h2><div class="rd-looks">${HOODS.map((u) => btn(u, "hood")).join("")}</div>
    <div class="rd-looks">${TRAILS.map((u) => btn(u, "trail")).join("")}</div>
    <p class="ak-line">You have ${g.xp} xp. Finish levels and win medals to earn more.</p>
    <button class="ak-btn ak-ghost" data-back="1">Back</button>`, "ak-wide");
  el.onclick = (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-id]");
    if (b && !b.disabled) { sfx.play("click"); look[b.dataset.kind] = b.dataset.id; g.save("look", look); hue = hoodCol(); showLooks(); g.redraw?.(); }
    else if (e.target.closest("[data-back]")) { sfx.play("click"); g.menu(); }
  };
}

function finish() {
  const time = s.time / 60, medal = medalOf(cur, time), prev = times[cur], par = LEVELS[cur].par;
  const isBest = prev == null || time < prev;
  mode = "done";
  if (verifying) return;
  if (isBest) {
    times[cur] = Math.round(time * 1000) / 1000; g.save("times", times);
    if (!bot) g.save("ghost" + cur, rec);
  }
  g.addXp(10 + [20, 12, 6, 0][medal]);
  const lines = [`${fmt(time)} s${isBest && prev != null ? ", new best" : ""}`];
  if (medal === 0) lines.push("R to run it again");
  else if (W.doors.length && s.doors.some((d) => d !== 1)) lines.push(`Gold is ${fmt(par[0])} s. Take the door.`);
  else lines.push(`${MEDAL_NAME[medal - 1]} is ${fmt(par[medal - 1])} s. R to retry.`);
  const last = cur === LEVELS.length - 1;
  g.levelDone({ title: `${cur + 1}. ${LEVELS[cur].n}${medal < 3 ? ": " + MEDAL_NAME[medal] : ""}`, stars: 3 - medal, lines, auto: 1, prompt: last ? "Finish" : "Next" }).then(() => {
    if (wantRetry) return load(cur);
    if (!last) return load(cur + 1);
    if (nextLevel() < LEVELS.length) return load(nextLevel());   // jumped here from the level list: go back to the first open level
    const counts = [0, 0, 0];
    let tot = 0;
    LEVELS.forEach((_, i) => { const m = medalOf(i, times[i]); if (m >= 0 && m < 3) counts[m]++; tot += times[i] || 0; });
    startAt = 0;
    g.over({ title: "All 40 roofs clear", score: Math.round(tot * 100) / 100, higherIsBetter: false, won: true, lines: [`Gold ${counts[0]}, silver ${counts[1]}, bronze ${counts[2]}`], again: "Go back for more gold" });
  });
}

// ---------- update ----------
const DUST = () => TH.far;
function update(dt) {
  if (mode === "done") return;
  if (g.keys.pressed("KeyR")) { load(cur, fixedOk); sfx.play("whoosh"); return; }
  if (bot) {
    const ch = bot.acts[Math.floor(bot.i / 4)];
    bot.i++;
    if (ch == null) bot = null;
    else { const a = parseInt(ch, 12); inp.dir = [1, 0, -1][a >> 2]; inp.jump = !!(a & 2); inp.down = !!(a & 1); }
  }
  if (!bot) {
    inp.dir = g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]);
    inp.jump = g.keys.down("ArrowUp", "KeyW", "Space", "KeyZ");
    inp.down = g.keys.down("ArrowDown", "KeyS");
  }
  step(W, s, inp);
  if (s.started) fresh = false;
  const p = s.p, ev = s.ev, cx = p.x + p.w / 2, fy = p.y + p.h;
  if (!verifying) {
    if (ev & EV.JUMP) { sfx.play("jump"); squash = -0.34; fx.burst(cx, fy, { n: 5, color: DUST(), speed: 90, angle: -Math.PI / 2, spread: 2.4, life: 0.35, gravity: 200, size: 4 }); }
    if (ev & EV.SLIDEJUMP) { sfx.tone(520, 0.12, { slide: 1040, type: "square", vol: 0.22 }); fx.ring(cx, fy - 6, { color: SUN, radius: 34, life: 0.28, width: 5 }); fx.burst(cx, fy, { n: 8, color: SUN, speed: 190, angle: Math.PI, spread: 1.2, life: 0.35, gravity: 0, size: 3, shape: "spark" }); }
    if (ev & EV.WALLJUMP) { sfx.play("jump"); squash = -0.3; fx.burst(cx + p.wallDir * 10, p.y + 18, { n: 6, color: DUST(), speed: 120, angle: p.wallDir > 0 ? Math.PI : 0, spread: 1.6, life: 0.3, gravity: 200, size: 4 }); }
    if (ev & EV.LAND) { sfx.play("land"); sfx.tone(90, 0.09, { type: "sine", vol: 0.35, slide: 50 }); squash = 0.36; fx.burst(cx - 8, fy, { n: 3, color: DUST(), speed: 110, angle: Math.PI, spread: 0.7, life: 0.3, gravity: 0, size: 4 }); fx.burst(cx + 8, fy, { n: 3, color: DUST(), speed: 110, angle: 0, spread: 0.7, life: 0.3, gravity: 0, size: 4 }); }
    if (ev & EV.SLIDE) sfx.play("whoosh");
    if (ev & EV.DIVE) { sfx.tone(700, 0.14, { slide: 240, type: "sawtooth", vol: 0.2 }); fx.ring(cx, p.y, { color: "#fff", radius: 26, life: 0.22, width: 4 }); }
    if (ev & EV.BONK) fx.burst(cx + p.face * 10, p.y + 14, { n: 4, color: DUST(), speed: 90, life: 0.25, gravity: 300, size: 3 });
    if (ev & ZEV.SPRING) {
      sfx.play("bounce"); squash = -0.5; g.hitstop(0.05); g.shake(3, 0.12);
      let bi = 0, bd = 1e9;
      W.springs.forEach((sp, i) => { const d = Math.abs(sp.col * T + 15 - cx); if (d < bd) { bd = d; bi = i; } });
      springT[bi] = 0;
      fx.ring(cx, fy, { color: SUN, radius: 44, life: 0.3, width: 6 });
      fx.burst(cx, fy, { n: 10, color: SUN, speed: 220, angle: -Math.PI / 2, spread: 1.4, life: 0.4, gravity: 500, size: 3, shape: "square" });
    }
    if (ev & ZEV.BOOST) { sfx.tone(330, 0.16, { slide: 990, type: "triangle", vol: 0.3 }); fx.burst(cx, fy - 8, { n: 8, color: SUN, speed: 260, angle: Math.PI, spread: 0.6, life: 0.3, gravity: 0, size: 3, shape: "spark" }); }
    if (ev & ZEV.CRACK) sfx.tone(180, 0.05, { type: "square", vol: 0.12 });
    if (ev & ZEV.CRUMBLE) { const b = W.boxes[W.crBase + s.fell]; sfx.noise(0.12, { freq: 900, vol: 0.2 }); fx.burst(b.x + 15, b.y + 7, { n: 6, color: TH.lip, speed: 90, life: 0.5, gravity: 900, size: 4, shape: "square" }); }
    if (ev & ZEV.FLAG) { sfx.play("coin"); fx.burst(cx, fy - 44, { n: 10, color: SUN, speed: 160, life: 0.45, gravity: 300, size: 3, shape: "star" }); }
    if (ev & ZEV.PAD_OK) { sfx.play("correct"); g.hitstop(0.04); fx.ring(s.hit.cx, s.hit.cy, { color: MINT, radius: 60, life: 0.35, width: 7 }); fx.burst(s.hit.cx, s.hit.cy, { n: 16, color: MINT, speed: 240, life: 0.5, gravity: 300, size: 4, shape: "star" }); fx.text(s.hit.cx, s.hit.cy - 30, "Door open", { color: MINT, size: 22, outline: "#fff" }); }
    if (ev & ZEV.PAD_BAD) { sfx.play("wrong"); g.shake(5, 0.18); fx.burst(s.hit.cx, s.hit.cy, { n: 10, color: "#9aa5bd", speed: 170, life: 0.4, gravity: 500, size: 4, shape: "square" }); fx.text(s.hit.cx, s.hit.cy - 30, "Locked", { color: "#6b7691", size: 20, outline: "#fff" }); }
    if (ev & ZEV.DIE) { sfx.play("hit"); g.shake(8, 0.2); fx.ring(cx, p.y + p.h / 2, { color: HAZ, radius: 50, life: 0.25, width: 6 }); fx.burst(cx, p.y + p.h / 2, { n: 16, colors: [hue, hue, SUN, SKIN], speed: 280, life: 0.5, gravity: 700, size: 5, shape: "square" }); }
    if (ev & ZEV.RESPAWN) { const ct = camTarget(); cam.x = ct.x; cam.y = ct.y; trail.length = 0; resetScarf(); sfx.play("pop"); squash = -0.3; }
    if (p.slide && p.ground && (s.time & 3) === 0) fx.burst(cx - p.face * 12, fy, { n: 1, color: DUST(), speed: 50, angle: -Math.PI / 2, spread: 1, life: 0.3, gravity: 0, size: 4 });
    if (p.onWall && (s.time & 3) === 0) fx.burst(cx + p.onWall * 10, p.y + 6, { n: 1, color: DUST(), speed: 30, life: 0.3, gravity: -100, size: 3 });
  }
  if (ev & ZEV.RESET) { rec = []; fresh = true; if (!verifying) s.ok = newProblems(); padPop = W.pads.map(() => 0); }
  if (ev & ZEV.GOAL) {
    if (!verifying) { fx.ring(cx, p.y + 10, { color: PORTAL, radius: 90, life: 0.5, width: 8 }); fx.burst(cx, p.y + 10, { n: 26, colors: [PORTAL, "#fff", SUN], speed: 320, life: 0.7, gravity: 200, size: 4, shape: "star" }); }
    finish();
    return;
  }
  if (verifying) return;

  // best-run ghost: one sample every 2 frames
  if (s.started && !s.dead && (s.time & 1) === 0) rec.push(Math.round(p.x), Math.round(p.y), p.h < CFG.h ? 1 : 0);

  // juice timers
  squash = damp(squash, 0, 14, dt);
  if (p.ground && Math.abs(p.vx) > 30) runPhase += Math.abs(p.vx) * dt * 0.06;
  for (let i = 0; i < doorAnim.length; i++) doorAnim[i] = damp(doorAnim[i], s.doors[i] === 1 ? 1 : 0, 16, dt);
  W.pads.forEach((pad, i) => { if (s.doors[pad.door] !== 0) padPop[i] = Math.min(1, padPop[i] + dt * 5); });
  for (let i = 0; i < springT.length; i++) springT[i] += dt;
  const tk = trailId(), fast = Math.abs(p.vx) > CFG.run * 1.12 || p.dive || p.slide;
  if (!s.dead && (tk === "ribbon" || tk === "comet" ? Math.hypot(p.vx, p.vy) > 140 : fast) && (s.time & 1) === 0) {
    trail.push({ x: cx, y: p.y + p.h / 2, h: p.h, t: 0 });
    if (trail.length > 16) trail.shift();
    if (tk === "sparks") fx.burst(cx - p.face * 8, p.y + p.h / 2 + rand(-8, 8), { n: 1, colors: [SUN, "#fff"], speed: 60, life: 0.4, gravity: 200, size: 3, shape: "star" });
  }
  const tl = trailId() === "ribbon" || trailId() === "comet" ? 0.3 : 0.2;
  for (const t of trail) t.t += dt;
  while (trail.length && trail[0].t > tl) trail.shift();
  // scarf: a little chain that follows the neck
  if (!s.dead) {
    const n = neck(p);
    scarf[0].x = n.x; scarf[0].y = n.y;
    for (let i = 1; i < scarf.length; i++) {
      const q = scarf[i], a = scarf[i - 1];
      q.y += (26 + Math.sin(g.time * 9 + i) * 22) * dt;
      q.x -= p.face * 14 * dt;
      const dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1, L = 4.6;
      if (d > L) { q.x = a.x + (dx / d) * L; q.y = a.y + (dy / d) * L; }
    }
  }
  fx.update(dt);
  if (!s.dead) {
    const ct = camTarget();
    cam.x = damp(cam.x, ct.x, 7, dt);
    cam.y = damp(cam.y, ct.y, p.ground ? 6 : 3.2, dt);
    if (p.y - cam.y < 90) cam.y = damp(cam.y, p.y - 90, 12, dt);
    if (p.y + p.h - cam.y > VH - 90) cam.y = damp(cam.y, p.y + p.h - VH + 90, 14, dt);
  }
}

// ---------- render ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(str, x, y, size, col = INK, align = "center", weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = col;
  ctx.fillText(str, x, y);
}

function drawBackdrop(x0 = 0, x1 = VW) {
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, TH.top); gr.addColorStop(1, TH.bot);
  ctx.fillStyle = gr; ctx.fillRect(x0, 0, x1 - x0, VH);
  // a few large faint shapes
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  const ox = cam.x * 0.06, oy = cam.y * 0.04;
  for (let i = Math.floor((ox + x0) / 520) - 1; i <= Math.floor((ox + x1) / 520) + 1; i++) {
    const h = hash(i * 3.1 + 2), h2 = hash(i * 7.7 + 5), x = i * 520 - ox + h * 220, y = 110 + h2 * 200 - oy, sz = 90 + h * 90;
    ctx.beginPath();
    if (Math.floor(h2 * 3) === 1) ctx.roundRect(x - sz, y - sz, sz * 2, sz * 2, sz * 0.3);
    else ctx.arc(x, y, sz, 0, 7);
    ctx.fill();
  }
  // skyline silhouettes, two layers
  for (let layer = 0; layer < 2; layer++) {
    const par = layer ? 0.3 : 0.14, span = layer ? 96 : 130, ox2 = cam.x * par, base = VH + 40 - cam.y * par * 0.35 + (layer ? 60 : 0);
    ctx.globalAlpha = layer ? 0.34 : 0.2; ctx.fillStyle = TH.far;
    for (let i = Math.floor((ox2 + x0) / span) - 1; i <= Math.floor((ox2 + x1) / span) + 1; i++) {
      const h = hash(i * 1.7 + layer * 31), h2 = hash(i * 4.3 + layer * 13);
      if (h2 < 0.2) continue;
      const w = span * (0.55 + h2 * 0.5), ht = 110 + h * (layer ? 190 : 250), x = i * span - ox2, y = base - ht;
      ctx.fillRect(x, y, w, ht + 300);
      if (h > 0.6) { ctx.fillRect(x + w * 0.3, y - 26, 3, 26); ctx.fillRect(x + w * 0.3 - 6, y - 18, 15, 3); }
      else if (h < 0.25) { rr(x + w * 0.2, y - 20, w * 0.36, 16, 4); ctx.fill(); ctx.fillRect(x + w * 0.24, y - 5, 3, 5); ctx.fillRect(x + w * 0.5, y - 5, 3, 5); }
    }
    ctx.globalAlpha = 1;
  }
}

function drawDecor() {
  ctx.fillStyle = TH.far; ctx.strokeStyle = TH.far; ctx.lineWidth = 3; ctx.lineCap = "round";
  for (const d of decor) {
    if (d.x < cam.x - 800 || d.x > cam.x + VW + 800) continue;
    const x = d.x, y = d.y;
    if (d.kind === 0) { // antenna
      ctx.beginPath(); ctx.moveTo(x + 15, y); ctx.lineTo(x + 15, y - d.h); ctx.moveTo(x + 7, y - d.h + 9); ctx.lineTo(x + 23, y - d.h + 9); ctx.moveTo(x + 10, y - d.h + 17); ctx.lineTo(x + 20, y - d.h + 17); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 15, y - d.h - 2, 3, 0, 7); ctx.fill();
    } else if (d.kind === 1) { // water tank
      rr(x + 8, y - 44, 44, 30, 7); ctx.fill();
      ctx.fillRect(x + 14, y - 14, 4, 14); ctx.fillRect(x + 42, y - 14, 4, 14);
      ctx.beginPath(); ctx.moveTo(x + 10, y - 46); ctx.lineTo(x + 30, y - 56); ctx.lineTo(x + 50, y - 46); ctx.closePath(); ctx.fill();
    } else if (d.kind === 2) { // vent
      rr(x + 6, y - 14, 18, 14, 3); ctx.fill(); rr(x + 2, y - 20, 26, 7, 3); ctx.fill();
    } else { // dish
      ctx.beginPath(); ctx.moveTo(x + 15, y); ctx.lineTo(x + 15, y - 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 15, y - 22, 11, 0.5, 0.5 + Math.PI); ctx.fill();
    }
  }
}

function drawTerrain(x0, x1, y0, y1) {
  const G = W.grid, nc = W.cols, nr = W.rows;
  const sol = (x, y) => (x < 0 || x >= nc ? true : y < 0 ? false : y >= nr ? true : G[y * nc + x] === 1);
  ctx.fillStyle = TH.roof;
  for (let y = y0; y <= y1; y++) {
    let run = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const v = x <= x1 && sol(x, y);
      if (v && run < 0) run = x;
      if (!v && run >= 0) { ctx.fillRect(run * T, y * T, (x - run) * T + 0.5, T + 0.5); run = -1; }
    }
  }
  // a lighter lip along every roof edge you can stand on
  ctx.fillStyle = TH.lip;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (sol(x, y) && !sol(x, y - 1)) ctx.fillRect(x * T, y * T, T + 0.5, 5);
  // boost arrows are part of the roof
  for (const b of W.boosts) {
    if (b.col < x0 || b.col > x1) continue;
    const X = b.col * T, Y = b.row * T, k = (g.time * 2.2 + b.col * 0.33) % 1;
    ctx.fillStyle = SUN; ctx.fillRect(X, Y, T + 0.5, 6);
    ctx.strokeStyle = SUN; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let j = 0; j < 2; j++) {
      const ax = X + ((k + j * 0.5) % 1) * T;
      ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(ax - 4, Y - 21); ctx.lineTo(ax + 4, Y - 14); ctx.lineTo(ax - 4, Y - 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // thin darker outline
  ctx.strokeStyle = TH.line; ctx.lineWidth = 2; ctx.lineCap = "square";
  ctx.beginPath();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!sol(x, y)) continue;
    const X = x * T, Y = y * T;
    if (!sol(x, y - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X + T, Y); }
    if (!sol(x, y + 1)) { ctx.moveTo(X, Y + T); ctx.lineTo(X + T, Y + T); }
    if (!sol(x - 1, y)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + T); }
    if (!sol(x + 1, y)) { ctx.moveTo(X + T, Y); ctx.lineTo(X + T, Y + T); }
  }
  ctx.stroke();
  // spikes: the one alert color
  ctx.fillStyle = HAZ; ctx.strokeStyle = HAZ_D; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
  for (let y = Math.max(0, y0); y <= Math.min(nr - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(nc - 1, x1); x++) {
    const v = G[y * nc + x];
    if (v < 2) continue;
    const X = x * T, Y = y * T;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const bx = X + k * 10;
      if (v === 2) { ctx.moveTo(bx + 0.5, Y + T); ctx.lineTo(bx + 5, Y + 11); ctx.lineTo(bx + 9.5, Y + T); }
      else { ctx.moveTo(bx + 0.5, Y); ctx.lineTo(bx + 5, Y + T - 11); ctx.lineTo(bx + 9.5, Y); }
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
  }
}

function billboard(str, cx, cy, size, state) {
  ctx.font = `900 ${size}px ${FONT}`;
  const w = Math.max(84, ctx.measureText(str).width + 30), h = size + 22;
  ctx.fillStyle = state === 1 ? "#d8f7ea" : state === 2 ? "#e3e7ef" : "#fff";
  rr(cx - w / 2, cy - h / 2, w, h, 9); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  text(str, cx, cy + 1, size, state === 2 ? "#8a93a8" : INK);
  return w;
}

function drawThings() {
  const time = g.time, vis = (x) => x > cam.x - 400 && x < cam.x + VW + 400;
  // hints: painted straight onto the sky, gone once the level is beaten
  if (times[cur] == null && !posterOn) for (const sg of W.signs) {
    ctx.font = `900 24px ${FONT}`;
    const x = Math.max(sg.col * T + 15, 44 + ctx.measureText(sg.text).width / 2), y = sg.row * T - 124;
    if (!vis(x)) continue;
    ctx.globalAlpha = 0.62;
    text(sg.text, x, y, 24, TH.roof, "center", 900);
    ctx.fillStyle = TH.roof; ctx.fillRect(x - 22, y + 19, 44, 3);
    ctx.globalAlpha = 1;
  }
  // moving platforms with their track
  for (let i = 0; i < W.movers.length; i++) {
    const m = W.movers[i], b = W.boxes[i];
    if (!vis(b.x)) continue;
    ctx.strokeStyle = TH.far; ctx.lineWidth = 2; ctx.setLineDash([2, 8]); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(m.x0 + 45, m.y0 + 8); ctx.lineTo(m.x1 + 45, m.y1 + 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = TH.lip; rr(b.x, b.y, b.w, b.h, 5); ctx.fill();
    ctx.strokeStyle = TH.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = SUN; ctx.beginPath(); ctx.arc(b.x + 14, b.y + 8, 3, 0, 7); ctx.arc(b.x + b.w - 14, b.y + 8, 3, 0, 7); ctx.fill();
  }
  // crumbling tiles
  W.crumbs.forEach((k, i) => {
    const st = s.cr[i];
    if (st < 0 || !vis(k.col * T)) return;
    const jx = st > 0 ? Math.sin(st * 2.3) * 1.6 : 0, jy = st > 0 ? st * 0.12 : 0, X = k.col * T + jx, Y = k.row * T + jy;
    ctx.fillStyle = TH.lip; ctx.globalAlpha = st > 0 ? 0.75 : 1;
    rr(X + 1, Y, T - 2, 13, 3); ctx.fill();
    ctx.strokeStyle = TH.line; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(X + 9, Y + 2); ctx.lineTo(X + 13, Y + 7); ctx.lineTo(X + 10, Y + 11); ctx.moveTo(X + 20, Y + 2); ctx.lineTo(X + 18, Y + 6); ctx.stroke();
    ctx.globalAlpha = 1;
  });
  // springs
  W.springs.forEach((sp, i) => {
    const x = sp.col * T, y = sp.row * T, k = springT[i], up = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) * 10 : 0;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x + 21, y - 3 - up * 0.3); ctx.lineTo(x + 9, y - 6 - up * 0.6); ctx.lineTo(x + 21, y - 9 - up); ctx.stroke();
    ctx.fillStyle = SUN; rr(x + 2, y - 14 - up, T - 4, 6, 3); ctx.fill(); ctx.stroke();
  });
  // checkpoint flags
  W.flags.forEach((f, i) => {
    const x = f.col * T + 9, y = f.row * T, on = s.cp >= i;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 54); ctx.stroke();
    const wv = on ? Math.sin(time * 9) * 3 : 0;
    ctx.fillStyle = on ? SUN : "#d4dbe8";
    ctx.beginPath(); ctx.moveTo(x, y - 54); ctx.lineTo(x + 24, y - 45 + wv); ctx.lineTo(x, y - 34); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2; ctx.stroke();
  });
  // exit portal
  {
    const x = W.goal.col * T + 15, y = W.goal.row * T - 48;
    if (vis(x)) {
      const gr = ctx.createRadialGradient(x, y, 4, x, y, 60);
      gr.addColorStop(0, "rgba(124,92,255,0.35)"); gr.addColorStop(1, "rgba(124,92,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(x - 60, y - 60, 120, 120);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, y, 20, 40, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#d9d0ff"; ctx.beginPath(); ctx.ellipse(x, y, 12 + Math.sin(time * 4) * 2, 30, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = PORTAL; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, 20, 40, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 23, 43, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = PORTAL;
      for (let k = 0; k < 4; k++) { const a = time * 2.4 + k * 1.57; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 30, y + Math.sin(a) * 52, 3.2, 0, 7); ctx.fill(); }
    }
  }
  // shortcut doors: the problem painted above the door and at the start of the pads
  W.doors.forEach((d, i) => {
    const x = d.col * T, y = d.row * T, st = s.doors[i], open = doorAnim[i], q = probs[i];
    if (!q) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 4, y, T + 8, 2 * T); ctx.clip();
    const yy = y - open * 58;
    ctx.fillStyle = st === 2 ? "#c3cada" : SUN; rr(x + 4, yy + 1, T - 8, 2 * T - 2, 5); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + 15, yy + 26, 4, 0, 7); ctx.fill(); ctx.fillRect(x + 13.5, yy + 27, 3, 10);
    ctx.restore();
    billboard(q.text, x + 15, y - 44, 22, st);
    const zx = d.zone * T + 45, zy = (d.row + 2) * T - 150;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(zx - 26, zy - 20); ctx.lineTo(zx - 26, zy - 70); ctx.moveTo(zx + 26, zy - 20); ctx.lineTo(zx + 26, zy - 70); ctx.stroke(); ctx.setLineDash([]);
    billboard(q.text, zx, zy, 28, st);
  });
  // answer pads
  W.pads.forEach((pad, i) => {
    const st = s.doors[pad.door], pop = padPop[i], right = pad.k === s.ok[pad.door];
    if (!labels[pad.door] || (st !== 0 && pop >= 1 && !(st === 1 && right))) return;
    const bob = Math.sin(time * 3 + i * 1.7) * 3, x = pad.cx, y = pad.cy + bob;
    const sc = st === 0 ? 1 : right && st === 1 ? 1 + 0.25 * Math.sin(pop * Math.PI) : 1 - pop;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -70); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = st === 1 && right ? MINT : "#fff"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = st === 1 && right ? "#178a64" : SUN_D; ctx.stroke();
    ctx.strokeStyle = SUN; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke();
    const lab = String(labels[pad.door][pad.k]);
    text(lab, 0, 1, lab.length > 3 ? 12 : lab.length > 2 ? 15 : 19, st === 1 && right ? "#fff" : INK);
    ctx.restore();
  });
}

/** The hero: a small rounded runner in a hoodie. Origin is the middle of the feet. o: { h, face, vx, vy, ground, slide, dive, wall, phase, sx, sy, col, ghost } */
function drawHero(x, y, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.face, 1);
  let rot = 0;
  if (o.slide) rot = -0.5;
  else if (o.dive) rot = 0.95;
  else if (!o.ground && !o.wall) rot = clamp(Math.abs(o.vx) / 2600, 0, 0.18) + clamp(o.vy / 3200, -0.1, 0.16);
  else if (o.ground) rot = clamp(Math.abs(o.vx) / 2200, 0, 0.16);
  ctx.scale(o.sx, o.sy);
  if (o.slide) ctx.translate(-3, 0);
  ctx.rotate(rot);
  const line = o.ghost ? "rgba(28,36,64,0.35)" : INK;
  ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.strokeStyle = line;
  if (o.ghost) ctx.globalAlpha = 0.55;
  // legs
  ctx.fillStyle = o.ghost ? "#fff" : INK;
  const run = o.ground && !o.slide && Math.abs(o.vx) > 30, a = run ? Math.sin(o.phase) : 0;
  if (o.slide) { rr(2, -7, 13, 5.5, 2.5); ctx.fill(); rr(0, -3, 12, 5, 2.5); ctx.fill(); }
  else if (!o.ground) { rr(-7, -8, 5.5, 8 - (o.vy < 0 ? 3 : 0), 2.5); ctx.fill(); rr(2, -9, 5.5, 8 - (o.vy < 0 ? 0 : 3), 2.5); ctx.fill(); }
  else { rr(-6 + a * 5, -8 + Math.max(0, -a) * 3, 5.5, 8 - Math.max(0, -a) * 3, 2.5); ctx.fill(); rr(1 - a * 5, -8 + Math.max(0, a) * 3, 5.5, 8 - Math.max(0, a) * 3, 2.5); ctx.fill(); }
  // hoodie body
  ctx.fillStyle = o.ghost ? "#fff" : o.col;
  rr(-7.5, -22, 15, 15.5, 6); ctx.fill(); ctx.stroke();
  // hood with its little tip, and the face
  ctx.beginPath(); ctx.arc(0.5, -24.5, 9.8, 0, 7); ctx.fill(); ctx.stroke();
  if (!o.ghost) {
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(4.1, -23.8, 4.9, 5.4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(28,36,64,0.3)"; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(6, -24.6, 1.7, o.blink ? 0.5 : 2.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(6.5, -25.6, 0.7, 0, 7); ctx.fill();
    ctx.strokeStyle = line;
    // scarf knot and pocket
    ctx.fillStyle = SUN; rr(-8, -17, 16, 4.6, 2.3); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = "rgba(28,36,64,0.35)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(1, -8.5, 4.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // arm
    ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.fillStyle = o.col;
    const ar = o.dive ? -1.9 : o.slide ? 1.2 : !o.ground ? -0.9 - clamp(o.vy / 900, -0.6, 0.8) : run ? -a * 0.9 : 0.15;
    ctx.save(); ctx.translate(-1, -15); ctx.rotate(ar); rr(-2.6, 0, 5.2, 9.5, 2.6); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
function drawScarf() {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? SUN : INK;
    for (let i = 1; i < scarf.length; i++) {
      ctx.lineWidth = (pass ? 5.2 : 8.2) - i * 0.5;
      ctx.beginPath(); ctx.moveTo(scarf[i - 1].x, scarf[i - 1].y); ctx.lineTo(scarf[i].x, scarf[i].y); ctx.stroke();
    }
  }
}
function drawTrail(col) {
  const tk = trailId(), n = trail.length;
  if (!n) return;
  if (tk === "ribbon") {
    ctx.lineCap = "round"; ctx.strokeStyle = SUN;
    for (let i = 1; i < n; i++) { ctx.globalAlpha = 0.6 * (i / n); ctx.lineWidth = 2 + 10 * (i / n); ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke(); }
  } else if (tk === "comet") {
    for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.5 * (i / n); ctx.fillStyle = i % 2 ? "#fff" : col; ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, 3 + 9 * (i / n), 0, 7); ctx.fill(); }
  } else {
    for (const t of trail) { ctx.globalAlpha = 0.3 * (1 - t.t / 0.2); ctx.fillStyle = col; rr(t.x - 10, t.y - t.h / 2, 20, t.h, 8); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawPlayer() {
  const p = s.p;
  // ghost of the best run
  if (ghost && s.started && mode === "run" && !posterOn) {
    const k = Math.floor(s.time / 2) * 3;
    if (k + 2 < ghost.length) {
      const low = ghost[k + 2] === 1, k0 = Math.max(0, k - 3);
      drawHero(ghost[k] + 10, ghost[k + 1] + (low ? 15 : 32), { h: 32, face: ghost[k] >= ghost[k0] ? 1 : -1, vx: 200, vy: 0, ground: true, slide: low, phase: s.time * 0.3, sx: 1, sy: 1, ghost: true });
    }
  }
  if (s.dead) return;
  drawTrail(hue);
  drawScarf();
  let sy = 1 - squash, sx = 1 + squash * 0.6;
  if (!p.ground && !p.dive) { const st = clamp(Math.abs(p.vy) / 900, 0, 0.2); sy *= 1 + st; sx *= 1 - st * 0.6; }
  if (p.dive) { sy *= 1.12; sx *= 0.9; }
  drawHero(p.x + p.w / 2, p.y + p.h, { face: p.face, vx: p.vx, vy: p.vy, ground: p.ground, slide: p.slide, dive: p.dive, wall: p.onWall, phase: runPhase, sx, sy, col: hue, blink: !posterOn && Math.floor(g.time * 60) % 200 > 193 });
}

function drawHud() {
  const tm = s.time / 60, t = fmt(tm), par = LEVELS[cur].par;
  const HX = c.canvas.clientWidth && c.canvas.clientWidth < 560 ? 330 : VW / 2;   // small screens: slide left of the kit buttons
  ctx.fillStyle = "rgba(255,255,255,0.82)"; rr(HX - 80, 12, 160, 58, 16); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `900 28px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillStyle = INK; ctx.textAlign = "center";
  let x = HX - (t.length * 16) / 2 + 8;
  for (const ch of t) { ctx.fillText(ch, x, 33); x += 16; }   // fixed-width digits so the clock does not wobble
  const m = medalOf(cur, Math.max(tm, 0.001));
  for (let i = 0; i < 3; i++) {
    const cx = HX - 50 + i * 50;
    ctx.globalAlpha = i < m ? 0.28 : 1;
    ctx.fillStyle = MEDAL[i]; ctx.beginPath(); ctx.arc(cx - 15, 57, 5, 0, 7); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    text(par[i].toFixed(1), cx - 7, 57.5, 11.5, INK, "left", 800);
    ctx.globalAlpha = 1;
  }
  if (times[cur] != null) text("Best " + fmt(times[cur]), HX + 92, 33, 13, INK, "left", 800);
  if (fresh) {
    text(`${cur + 1}. ${LEVELS[cur].n}`, HX, 104, 28, INK);
    text(g.coarse ? "The clock starts when you move" : "The clock starts when you move. R restarts.", HX, 131, 14, TH.roof, "center", 700);
  }
  // the next door's problem stays on screen so it can be worked out on the run
  const di = s.doors.findIndex((d, i) => d === 0 && W.doors[i].col * T > s.p.x - 60);
  if (di >= 0 && probs[di]) {
    const q = probs[di];
    ctx.font = `900 22px ${FONT}`;
    const w = ctx.measureText(q.text).width + 92, bx = HX - w / 2, by = fresh ? 152 : 82;
    ctx.fillStyle = SUN; rr(bx, by, w, 38, 19); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    text("Door", bx + 16, by + 20, 13, INK, "left", 900);
    text(q.text, bx + 58 + (w - 74) / 2, by + 20, 22, INK);
  }
}

function drawWorld(camx, camy, zoom = 1) {
  const vw = VW / zoom, vh = VH / zoom;
  const x0 = Math.floor(camx / T) - 1, x1 = Math.floor((camx + vw) / T) + 1, y0 = Math.floor(camy / T) - 1, y1 = Math.floor((camy + vh) / T) + 1;
  drawDecor();
  drawTerrain(x0, x1, y0, y1);
  drawThings();
  drawPlayer();
  fx.draw(ctx);
  ctx.globalAlpha = 1;
}
function render() {
  if (!W) return;
  if (posterOn) return renderPoster();
  drawBackdrop();
  const camx = Math.round(cam.x + g.shakeX), camy = Math.round(cam.y + g.shakeY);
  ctx.save();
  ctx.translate(-camx, -camy);
  drawWorld(camx, camy);
  ctx.restore();
  if (g.state !== "menu") drawHud();
}

// ---------- poster ----------
const POSTER = { n: "Poster", d: "r9 s2 r2 sp3 r9 E", par: [9, 9, 9] };
const PZ = 4.6;
let pFocus = { x: 0, y: 0 };
function poster() {
  posterOn = true; g.posterMode = true;
  g.stage.style.setProperty("--ak-aspect", String(innerWidth / innerHeight));
  g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "hidden"));
  W = build(POSTER); TH = THEMES[0]; cur = 0; decor = [];
  fixedOk = 1; s = newState(W, newProblems()); syncBoxes(W, s);
  ghost = null; fx.clear(); trail.length = 0; mode = "run"; squash = -0.1; hue = hoodCol();
  springT = W.springs.map(() => 9); doorAnim = []; padPop = [];
  const p = s.p, fy = W.start.y + CFG.h, view = VH / PZ;
  p.x = 9.35 * T; p.y = fy - 27 - CFG.h; p.vx = 430; p.vy = -180; p.ground = false; p.face = 1; s.started = true;
  for (let i = 1; i <= 4; i++) trail.push({ x: p.x + 10 - (5 - i) * 8, y: p.y + 16 + (5 - i) * 2.6, h: 32, t: 0.2 * (1 - i / 6) });
  const n = neck(p);
  scarf.forEach((q, i) => { q.x = n.x - i * 4.3; q.y = n.y + Math.sin(i * 0.9) * 2 + i * 0.5; });
  for (let i = 0; i < 7; i++) fx.burst(8.3 * T + rand(-8, 14), fy - rand(1, 9), { n: 1, color: TH.far, speed: 0, life: 9, gravity: 0, size: rand(1.5, 3), drag: 0 });
  for (let i = 0; i < 5; i++) fx.burst(p.x - 12 - i * 9 + rand(-3, 3), p.y + 22 + i * 3 + rand(-5, 5), { n: 1, colors: [SUN, "#fff"], speed: 0, life: 9, gravity: 0, size: rand(1.6, 3.2), shape: "star", drag: 0 });
  pFocus = { x: p.x + 10 + 0.08 * view, y: p.y + 16 - 0.06 * view };
  render();
}
function renderPoster() {
  const r = g.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr)), sc = ch / VH;
  if (c.canvas.width !== cw || c.canvas.height !== ch) { c.canvas.width = cw; c.canvas.height = ch; }
  ctx.setTransform(sc, 0, 0, sc, cw / 2 - (VW / 2) * sc, 0);
  cam.x = 0; cam.y = 0;
  drawBackdrop(-600, VW + 600);
  ctx.save();
  ctx.translate(VW / 2, VH * 0.5); ctx.scale(PZ, PZ); ctx.translate(-pFocus.x, -pFocus.y);
  cam.x = pFocus.x - VW / 2; cam.y = pFocus.y - VH / 2;
  drawWorld(pFocus.x - 700 / PZ, pFocus.y - VH / 2 / PZ, PZ * 0.6);
  ctx.restore();
}

load(cur);
g.loop(update, render);

// ---------- test hooks ----------
let ROUTES = null;
const routes = async () => (ROUTES ||= (await import("./routes.js")).ROUTES);
g.debug = {
  get state() { return { level: cur + 1, mode, time: s.time / 60, x: Math.round(s.p.x), y: Math.round(s.p.y), col: Math.floor(s.p.x / T), cols: W.cols, dead: s.dead, deaths: s.deaths, doors: s.doors.slice(), ok: s.ok.slice(), cp: s.cp, done: s.done, ground: s.p.ground, slide: s.p.slide, started: s.started, xp: g.xp, times, ghost: ghost ? ghost.length / 3 : 0 }; },
  get s() { return s; }, get W() { return W; },
  /** Jump to a level (1-based). ok fixes the right pad (0..2) for every door. */
  goto(n, ok = null) { g.closePanel(); load(n - 1, ok); },
  /** Let the scripted player run this level: "short" goes through the shortcut door, "long" takes the roofs. */
  async autoplay(kind = "short", n = cur + 1) {
    const R = (await routes())[n];
    if (!R) return false;
    load(n - 1, 1);
    bot = { acts: R[kind] || R.long, i: 0 };
    return true;
  },
  /** Runs the scripted player through every level, both routes, without touching saves. Returns what failed. */
  async verifyAll() {
    const R = await routes(), bad = [], out = [];
    verifying = true;
    for (let n = 1; n <= LEVELS.length; n++) for (const kind of ["long", "short"]) {
      const acts = R[n]?.[kind];
      if (!acts) { if (kind === "long" || W.doors.length) { load(n - 1, 1); if (kind === "long" || W.doors.length) bad.push(`${n} ${kind}: no route`); } continue; }
      load(n - 1, 1);
      bot = { acts, i: 0 };
      for (let f = 0; f < acts.length * 4 + 8 && mode !== "done"; f++) update(1 / 60);
      if (mode !== "done") bad.push(`${n} ${kind}: stopped at col ${Math.floor(s.p.x / T)} of ${W.cols}`);
      else { if (kind === "short" && !s.doors.every((d) => d === 1)) bad.push(`${n} short: a door stayed shut`); out.push(`${n}${kind[0]} ${(s.time / 60).toFixed(2)}`); }
    }
    verifying = false;
    load(Math.min(nextLevel(), LEVELS.length - 1));
    return { bad, runs: out.length, times: out.join(" ") };
  },
  poster, showLevels, showLooks,
  clear() { times = {}; g.save("times", times); g.save("xp", 0); for (let i = 0; i < LEVELS.length; i++) g.save("ghost" + i, null); },
};
