// Sneaky Floors: a troll platformer on a chalkboard. The level lies. The math does not.
// World rules and the trap script engine: sim.js. The 65 stages: stages.js. Proof they can be beaten: solve.mjs.
import { createGame, createFx, sfx, FONT, clamp } from "../kit/kit.js";
import { drawChalkArchie, chalkSmudge, chalkStroke, line, quad, arc, BLUE } from "./chalk.js";
import { drawIntro, drawEnding, heroD, introCues, endCues, TD, INTRO_LEN, END_LEN } from "./story.js";
import { STAGES, ROOMS, ROOM_NAMES } from "./stages.js";
import { compile, newSim, step, T, VW, VH, OY, PW, PH } from "./sim.js";
import { SOLUTIONS, MACRO } from "./solutions.js";

const N = STAGES.length;
const BOARD = "#255844", CHALK = "#f4f1e6", YEL = "#ffe27a", PINK = "#ff9a9a", SKY = "#a8dcff";
const LOOKS = [
  { id: "blue", name: "Blue Chalk" },
  { id: "chalk", name: "White Chalk", color: "#f4f1e6", need: 20 },
  { id: "mint", name: "Mint Chalk", color: "#8ff0c4", need: 80 },
  { id: "paper", name: "Chalk Cap", acc: "cap", accColor: "#ff9a9a", need: 170 },
  { id: "rose", name: "Chalk Glasses", color: "#ffa3b8", acc: "glasses", accColor: "#f4f1e6", need: 300 },
  { id: "gold", name: "Chalk Scarf", color: "#ffd66b", acc: "scarf", accColor: "#ff9a9a", need: 470 },
  { id: "night", name: "Chalk Crown", color: "#b9abff", acc: "crown", accColor: "#ffe27a", need: 560 },
];
const POOFS = [
  { id: "dust", name: "Chalk dust" },
  { id: "stars", name: "Star poof", need: 45 },
  { id: "eraser", name: "Eraser poof", need: 120 },
  { id: "numbers", name: "Number poof", need: 230 },
  { id: "confetti", name: "Confetti poof", need: 380 },
];
// What the chalk face says after a fall. One short dry line per kind of trick, five words at most, never about skill.
const LINES = {
  any: ["Again.", "Noted.", "Bold.", "It did that before.", "The door is that way.", "Still here.", "Chalk it up.", "I saw nothing.", "Take your time.", "Classic."],
  fell: ["Gravity works.", "Down you go."], spike: ["Pointy.", "Those are sharp."], crush: ["Flat.", "Mind your head."], wrong: ["Check the math.", "The math said no."],
  floor: ["You trusted a floor.", "Floors. Honestly."], pop: ["Classic.", "They were shy."], door: ["That door has trust issues.", "Doors wander."],
  fake: ["Paint. Just paint.", "The arrow meant it."], ice: ["Slippery when chalked.", "Ice is honest."], grav: ["Up is a direction.", "Mind the sky."],
  mirror: ["Left was right.", "Other left."], scroll: ["The board moves on.", "Keep up."], rule: ["Rules change. Math stays.", "Read it again."],
  label: ["One stroke. Sorry.", "It was a 3."], belt: ["Standing still moves you.", "Rest later."], tilt: ["I leaned on it.", "Downhill is fast."],
  launch: ["Going up.", "Bold."], walker: ["It had plans."], dark: ["Lights help.", "Dark, was it?"], twin: ["He trusted you.", "Jump for him."],
  lie: ["I lied. Once.", "Honest from now on."], banner: ["Premature.", "Almost counted."], high: ["Too much spring.", "Tap. Gently."], low: ["Heavy shoes.", "Short hops."],
};

const g = createGame({
  slug: "sneaky-floors", title: "Sneaky Floors", tagline: "The level lies. The math does not.", instant: true,
  controls: [{ keys: "← →", does: "Move" }, { keys: "↑ / Space", does: "Jump" }],
  aspect: 16 / 9, bg: BOARD,
  onMenu: (el) => {
    const mk = (label, fn) => { const b = document.createElement("button"); b.className = "sf-mini"; b.textContent = label; b.onclick = (e) => { e.stopPropagation(); sfx.play("click"); fn(); }; el.appendChild(b); };
    mk("Stages", showStages);
    mk("Looks", showLooks);
    mk("Story", () => { storyReplay = true; g.start(); });
  },
});
const c = g.canvas2d(VW, VH);
const { ctx } = c;
const fx = createFx(320);
g.unlocks([...LOOKS, ...POOFS].filter((u) => u.need).map((u) => ({ id: u.id, name: u.name, need: u.need })));
g.touchButtons([{ code: "ArrowLeft", label: "←", side: "left", aria: "Left" }, { code: "ArrowRight", label: "→", side: "left", aria: "Right" }, { code: "Space", label: "Jump", side: "right" }]);

// ---------- saves ----------
let progress = clamp(g.load("progress2", 0), 0, N);          // stages cleared in order
let deaths = g.load("deaths2", 0);
let falls = g.load("falls", {});                              // stage index -> falls there, ever (the small tally)
let lied = g.load("lied", {});                                // stage index -> the hint there already lied once
let clean = g.load("clean2", {});                             // stage index -> cleared with no falls
let lookId = g.load("look", "blue"), poofId = g.load("poof", "dust");
const look = () => LOOKS.find((l) => l.id === lookId && g.unlocked(l.id)) || LOOKS[0];
const poof = () => (POOFS.find((l) => l.id === poofId && g.unlocked(l.id)) || POOFS[0]).id;

// ---------- run state ----------
let cur = 0, C = null, s = null, attempt = 0, stageDeaths = 0, mode = "play", modeT = 0, startAt = null, bot = null, posterOn = false;
let known = new Set(), learn = new Set(), knownZ = new Set(), learnZ = new Set();
let sayText = "", sayT = 0, comment = "", commentT = 0, faceT = 0, faceMood = "", squash = 0, stretch = 0, runT = 0, spawnT = 0;
let ruleOld = "", ruleT = 9, ruleShown = "", labelT = {}, mirrorWarn = 0, iceT = 0, winT = 0, tSec = 0;
let layer = null, layerKey = "", bg = null, bgKey = "";
// the new tricks: coins (only for show), the fake "Stage clear!" banner, the leaning board, which trick got you last
let coinsGot = new Set(), coinN = 0, bannerT = -1, tiltVis = 0, lastTrick = null, kindDeaths = {}, lieOn = false, lieTrig = -9, strokeT = {}, lastKind = "";
let knownX = new Set(), learnX = new Set();
const trick = (kind) => { lastTrick = { kind, t: s.t }; };
const xTell = (tr) => (tr.on.xgt != null || tr.on.xlt != null) && tr.do.some((a) => a.tilt != null || a.dark != null || a.rule != null || a.label != null || a.fx != null || a.set != null);
// chalk Archie and the story
let smudges = [], surpriseT = 0, heroBoil = 0, introHero = null, introT = 0, endT = 0, storyReplay = false, noIntro = false, skipReq = false;
const chalkCol = () => look().color || BLUE;
const SKIP_KEYS = ["Space", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"];
addEventListener("keydown", (e) => {
  if (e.repeat || g.state !== "playing" || ["KeyP", "Escape", "KeyM", "KeyF"].includes(e.code)) return;
  if ((mode === "intro" && introT > 0.05) || (mode === "ending" && endT > 0.4)) skipReq = true;
});

function loadStage(i) {
  cur = clamp(i, 0, N - 1);
  C = compile(STAGES[cur], ROOMS);
  attempt = 0; stageDeaths = 0; smudges = [];
  known = new Set(); learn = new Set(); knownZ = new Set(); learnZ = new Set(); knownX = new Set(); learnX = new Set(); kindDeaths = {};
  sayText = ""; comment = ""; commentT = 0;
  respawn();
}
function respawn() {
  for (const k of learn) known.add(k);
  for (const k of learnZ) knownZ.add(k);
  for (const k of learnX) knownX.add(k);
  coinsGot = new Set(); coinN = 0; bannerT = -1; lastTrick = null; lieTrig = -9; strokeT = {}; lieOn = !!STAGES[cur].lie && !lied[cur];
  s = newSim(C, attempt);
  mode = "play"; spawnT = 0.25; ruleT = 9; ruleShown = s.rule ? s.rule.text : ""; labelT = {}; mirrorWarn = 0; winT = 0; sayT = Math.min(sayT, 0.4);
}
const obj = (id) => s.objs.find((o) => o.id === id);

// ---------- juice ----------
function dust(x, y, n = 6, o = {}) { fx.burst(x, y, { n, colors: o.color ? null : [CHALK, CHALK, chalkCol()], speed: 90, life: 0.4, gravity: -40, size: 3.2, drag: 3, ...o }); }
function scribble() { for (let i = 0; i < 4; i++) sfx.noise(0.05, { freq: 3200 + i * 500, type: "bandpass", vol: 0.5, delay: i * 0.055 }); }
function poofAt(x, y) {
  const kind = poof();
  if (kind === "stars") fx.burst(x, y, { n: 18, colors: [YEL, "#fff7c2", CHALK], speed: 300, life: 0.6, gravity: 300, size: 6, shape: "star" });
  else if (kind === "eraser") fx.burst(x, y, { n: 16, colors: [PINK, CHALK, "#ffd0d0"], speed: 280, life: 0.6, gravity: 700, size: 6, shape: "square" });
  else if (kind === "confetti") fx.burst(x, y, { n: 26, colors: [YEL, PINK, SKY, "#b9f5c8", CHALK], speed: 340, life: 0.7, gravity: 600, size: 4, shape: "spark" });
  else if (kind === "numbers") { for (let i = 0; i < 7; i++) fx.text(x + Math.cos(i * 0.9) * 26, y + Math.sin(i * 0.9) * 18, "0123456789"[(i * 7 + deaths) % 10], { color: i % 2 ? YEL : CHALK, size: 22, life: 0.6, rise: 50 + i * 9, outline: "#17382c" }); }
  fx.burst(x, y, { n: kind === "dust" ? 22 : 8, color: CHALK, speed: 240, life: 0.5, gravity: 120, size: 5, drag: 3 });
  fx.ring(x, y, { color: CHALK, radius: 46, life: 0.3, width: 5 });
}
function onDeath(why) {
  deaths++; stageDeaths++; g.save("deaths2", deaths);
  falls[cur] = (falls[cur] || 0) + 1; g.save("falls", falls);
  const p = s.p;
  const px = clamp(p.x + PW / 2, s.cam.x + 10, s.cam.x + VW - 10), py = clamp(p.y + PH / 2, 20, C.H * T - 10);
  poofAt(px, py);
  fx.burst(px, py, { n: 12, color: chalkCol(), speed: 170, life: 0.55, gravity: 160, size: 4, drag: 3 });
  smudges.push({ x: px, y: clamp(py, 30, VH - OY - 26), seed: deaths * 3.7 + stageDeaths, color: chalkCol() });   // what is left of him stays on the board
  if (smudges.length > 40) smudges.shift();
  g.shake(7, 0.18);
  sfx.tone(520, 0.09, { slide: 140, type: "square", vol: 0.35 }); sfx.noise(0.16, { freq: 1800, vol: 0.5 });
  faceT = 1.4; faceMood = "smirk";
  // which trick did it: the one that fired just before, or the state the room is in
  const recent = lastTrick && s.t - lastTrick.t < 1.6 ? lastTrick.kind : null;
  let kind = why === "twin" || why === "wrong" ? why : s.t - lieTrig < 1.6 ? "lie" : recent || (why === "spike" && s.jp > 1 ? "high" : why === "fell" && s.jp < 1 ? "low" : s.tilt ? "tilt" : s.dark > 0 ? "dark" : why);
  if (why === "crush" && kind !== "launch") kind = "crush";
  if (why === "twin") { const tx = C.W * T - px; poofAt(tx, py); smudges.push({ x: tx, y: clamp(py, 30, VH - OY - 26), seed: deaths * 5.1, color: CHALK }); }
  if (kind === "lie") { faceT = 2.4; for (let i = 0; i < 4; i++) sfx.tone(620 - i * 40, 0.06, { type: "square", vol: 0.22, delay: 0.25 + i * 0.11 }); }   // the snicker
  const L = LINES[kind] || LINES.any, n = (kindDeaths[kind] = (kindDeaths[kind] || 0) + 1);
  comment = n <= L.length ? L[n - 1] : LINES.any[(deaths + stageDeaths) % LINES.any.length];
  lastKind = kind;
  commentT = 2.4;
  mode = "dead"; modeT = 0.3;
}
const SURPRISE = new Set(["fall", "show", "hide", "move", "grav", "mirror", "scroll", "rule", "label", "say", "painted", "ice", "tilt", "dark", "fx", "roll"]);
function handle(ev) {
  const p = s.p, fy = p.g > 0 ? p.y + PH : p.y, cx = p.x + PW / 2;
  for (const e of ev) {
    const o = e.id != null ? obj(e.id) : null;
    if (SURPRISE.has(e.type)) surpriseT = 0.5;
    switch (e.type) {
      case "jump": sfx.play("jump"); stretch = 1; dust(cx, fy, 6); break;
      case "land": sfx.play("land"); squash = 1; dust(cx - 6, fy, 4, { angle: Math.PI, spread: 1 }); dust(cx + 6, fy, 4, { angle: 0, spread: 1 }); dust(cx, fy - 8, 3, { speed: 50 }); break;
      case "arm": sfx.play("tick"); break;
      case "fall": sfx.noise(0.18, { freq: 500, vol: 0.7 }); sfx.tone(300, 0.2, { slide: 90, vol: 0.3 }); if (o) dust(o.x + o.w / 2, o.y + 6, 9, { speed: 130 }); learn.add(e.id); trick("floor"); break;
      case "show": if (o && o.k === "s") { sfx.tone(700, 0.08, { slide: 1500, type: "square", vol: 0.3 }); } else sfx.play("pop"); if (o) dust(o.x + o.w / 2, o.y + o.h / 2, 7, { color: o.k === "s" ? PINK : CHALK }); learn.add(e.id); if (o && o.k === "s") trick("pop"); break;
      case "hide": sfx.play("whoosh"); if (o) dust(o.x + o.w / 2, o.y + o.h / 2, 16, { speed: 200 }); learn.add(e.id); break;
      case "move": if (o && o.launch && o.mv && o.mv.y1 < o.mv.y0) { sfx.play("bounce"); sfx.tone(300, 0.2, { slide: 1400, type: "square", vol: 0.3 }); } else sfx.play("whoosh"); learn.add(e.id);
        if (o && o.k !== "f") trick(o.k === "d" ? "door" : o.launch ? "launch" : o.legs ? "walker" : o.crush ? "crush" : "floor"); break;
      case "stop": if (o && o.crush) { g.shake(9, 0.22); sfx.play("crash"); g.hitstop(0.04); dust(o.x + o.w / 2, o.y + o.h, 14, { speed: 220 }); } break;
      case "ice": sfx.tone(1800, 0.25, { slide: 2600, type: "sine", vol: 0.35 }); iceT = 0.6; trick("ice"); break;
      case "grav": sfx.tone(p.g < 0 ? 300 : 700, 0.22, { slide: p.g < 0 ? 900 : 200, type: "sine", vol: 0.45 }); fx.ring(cx, p.y + PH / 2, { color: SKY, radius: 50 }); trick("grav"); break;
      case "mirror": sfx.tone(600, 0.1, { type: "square", vol: 0.3 }); sfx.tone(450, 0.14, { type: "square", vol: 0.3, delay: 0.1 }); mirrorWarn = 0.35; trick("mirror"); break;
      case "mirrorEnd": sfx.play("pop"); break;
      case "scroll": sfx.play("whoosh"); trick("scroll"); break;
      case "rule": scribble(); ruleOld = ruleShown; ruleShown = s.rule.text; ruleT = 0; trick("rule"); break;
      case "label": scribble(); labelT[e.id] = 0.45; if (e.stroke) strokeT[e.id] = 0.7; if (o) dust(o.x + o.w / 2, o.y + (o.k === "d" ? -14 : 14), 6); trick("label"); break;
      case "set": if (e.props.shut === true) { sfx.noise(0.12, { freq: 400, vol: 0.6 }); sfx.tone(180, 0.12, { type: "square", vol: 0.3 }); if (o) dust(o.x + o.w / 2, o.y + o.h / 2, 8, { color: PINK }); learn.add(e.id); surpriseT = 0.5; }
        else if (e.props.shut === false) { sfx.tone(500, 0.2, { slide: 800, type: "sine", vol: 0.35 }); if (o) fx.ring(o.x + o.w / 2, o.y + o.h / 2, { color: YEL, radius: 40 }); } break;
      case "tilt": sfx.tone(260, 0.45, { slide: s.tilt > 0 ? 170 : 360, type: "sawtooth", vol: 0.22 }); g.shake(4, 0.2); if (s.tilt) trick("tilt"); break;
      case "dark": sfx.play("click"); sfx.tone(120, 0.3, { type: "sine", vol: 0.3 }); trick("dark"); break;
      case "fx": if (e.name === "banner") { bannerT = 0; sfx.play("win"); trick("banner"); } break;
      case "roll": sfx.noise(0.25, { freq: 700, vol: 0.4 }); trick("belt"); break;
      case "say": sayText = e.text; sayT = 2; break;
      case "painted": sfx.noise(0.2, { freq: 900, vol: 0.5 }); if (o) dust(o.x + o.w / 2, o.y + o.h / 2, 16, { color: o.k === "s" ? PINK : YEL, speed: 160 }); if (o && o.k === "s") { sayText = "Painted."; sayT = 2; learn.add(e.id); } break;
      case "seen": sfx.play("whoosh"); learn.add(e.id); trick("fake"); break;
      case "trig": { const tr = C.traps[e.i]; if (tr.on.zone) learnZ.add(e.i); if (xTell(tr)) learnX.add(e.i); if (tr.lie) { lieTrig = s.t; if (!lied[cur]) { lied[cur] = 1; g.save("lied", lied); } } break; }
      case "die": onDeath(e.why); break;
      case "win": sfx.play("coin"); winT = 0.001; if (o) { fx.burst(o.x + o.w / 2, o.y + o.h / 2, { n: 16, colors: [YEL, CHALK], speed: 260, life: 0.6, gravity: 200, size: 5, shape: "star" }); fx.ring(o.x + o.w / 2, o.y + o.h / 2, { color: YEL, radius: 70 }); } break;
    }
  }
  ev.length = 0;
}

async function finish() {
  mode = "done";
  const first = cur >= progress, flawless = stageDeaths === 0, roomEnd = cur % 5 === 4, room = Math.floor(cur / 5);
  let xp = first ? 10 : 4;
  if (flawless && !clean[cur]) { xp += 5; clean[cur] = 1; g.save("clean2", clean); }
  if (roomEnd && first) xp += 10;
  if (first) { progress = cur + 1; g.save("progress2", progress); }
  g.addXp(xp);
  if (roomEnd) { for (let i = 0; i < 5; i++) fx.burst(160 + i * 160 + s.cam.x, 150, { n: 14, colors: [YEL, PINK, SKY, CHALK], speed: 300, life: 0.9, gravity: 500, size: 5, shape: i % 2 ? "star" : "spark" }); g.slowmo(0.4, 0.5); }
  await g.levelDone({
    title: roomEnd ? `Room ${room + 1} clear` : `Stage ${room + 1}-${(cur % 5) + 1} clear`,
    lines: [roomEnd ? ROOM_NAMES[room] + " is done." : flawless ? "No falls. Bonus chalk." : stageDeaths === 1 ? "1 fall" : stageDeaths + " falls"],
    stars: roomEnd ? 3 : undefined, auto: roomEnd ? 1.8 : 1,
  });
  if (cur === N - 1) { mode = "ending"; endT = 0; skipReq = false; fx.clear(); return; }
  loadStage(cur + 1);
}
function theEnd() {
  endT = END_LEN;
  { g.over({ won: true, title: "The whole board. Cleared.", score: deaths, higherIsBetter: false, lines: ["Falls so far. The chalk kept count."], again: g.coarse ? "Tap to start over" : "Space to start over" }); }
}

g.onStart = () => {
  if (posterOn) { posterOn = false; g.stage.style.setProperty("--ak-aspect", String(16 / 9)); c.fit(); layerKey = bgKey = ""; } bot = null; fx.clear();
  loadStage(startAt != null ? startAt : progress >= N ? 0 : progress);
  const story = storyReplay || (!noIntro && !g.load("story", 0));
  startAt = null; faceT = 0; storyReplay = noIntro = skipReq = false; introHero = null; surpriseT = 0;
  if (story) { mode = "intro"; introT = 0; }
};
// The story: about 18 seconds of chalk panels. Any key or tap skips it. It ends standing on the stage, ready to run.
const storyApi = {
  FONT, fx, sfx, scribble: () => scribble(), dust: (x, y, n) => dust(x, y, n),
  board: (k) => { buildBg(); k.drawImage(bg, 0, 0, VW, VH); },
  hero: (k, x, y, size, o) => drawHero(k, x, y, size, o),
  text: (k, ...a) => chalkText(k, ...a),
  land: () => { const p = s.p; sfx.play("land"); squash = 1; dust(p.x + PW / 2 - 6, p.y + PH, 5, { angle: Math.PI, spread: 1 }); dust(p.x + PW / 2 + 6, p.y + PH, 5, { angle: 0, spread: 1 }); g.shake(4, 0.12); },
  sparkle: (x, y) => { fx.burst(x, y, { n: 22, colors: [YEL, CHALK, "#fff7c2"], speed: 280, life: 0.8, gravity: 200, size: 6, shape: "star" }); fx.ring(x, y, { color: YEL, radius: 80 }); },
};
function endIntro() { mode = "play"; introHero = null; skipReq = false; spawnT = 0; g.save("story", 1); }
function updateStory(dt) {
  const skip = skipReq || g.pointer.pressed || g.keys.pressed(...SKIP_KEYS);
  skipReq = false;
  if (mode === "intro") {
    if (skip && introT > 0.05) { fx.clear(); squash = 0; sfx.play("pop"); return endIntro(); }
    introCues(introT, introT + dt, storyApi);
    introT += dt;
    if (introT >= INTRO_LEN) endIntro();
  } else {
    if (skip && endT > 0.4) return theEnd();
    endCues(endT, endT + dt, storyApi);
    endT += dt;
    if (endT >= END_LEN) theEnd();
  }
}

function update(dt) {
  tSec += dt; fx.update(dt);
  sayT -= dt; commentT -= dt; faceT -= dt; spawnT -= dt; ruleT += dt; mirrorWarn -= dt; iceT -= dt;
  squash = Math.max(0, squash - dt * 6); stretch = Math.max(0, stretch - dt * 5);
  for (const k in labelT) labelT[k] -= dt;
  for (const k in strokeT) strokeT[k] -= dt;
  if (bannerT >= 0) { if (bannerT < 0.55 && bannerT + dt >= 0.55) { sfx.noise(0.28, { freq: 2600, vol: 0.6 }); g.shake(3, 0.12); } bannerT += dt; }
  if (s) tiltVis += (s.tilt - tiltVis) * Math.min(1, dt * 7);
  if (winT > 0) winT += dt;
  surpriseT -= dt;
  if (mode === "intro" || mode === "ending") return updateStory(dt);
  if (s && (!s.p.ground || Math.abs(s.p.vx) > 20)) heroBoil = Math.floor(tSec * 8);   // the line boils only while he moves
  if (mode === "play") {
    if (g.keys.pressed("KeyR")) { attempt++; respawn(); return; }
    let dir, jump;
    if (bot) { const ch = bot.keys[Math.floor(bot.f++ / MACRO)]; if (!ch) { bot = null; dir = 0; jump = false; } else { dir = ch === "r" || ch === "R" ? 1 : ch === "l" || ch === "L" ? -1 : 0; jump = ch < "a"; } }
    else { dir = g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]); jump = g.keys.down("Space", "ArrowUp", "KeyW"); }
    step(s, dir, jump);
    if (s.p.ground && Math.abs(s.p.vx) > 60) { runT += dt; if (runT > 0.13) { runT = 0; dust(s.p.x + PW / 2 - s.p.face * 8, s.p.g > 0 ? s.p.y + PH : s.p.y, 2, { speed: 45, ...(s.ice ? { color: SKY } : {}) }); } }
    collectCoins();
    handle(s.ev);
    if (s.won && mode === "play") { mode = "win"; modeT = 0.45; }
  } else if (mode === "dead") { modeT -= dt; if (modeT <= 0) { attempt++; respawn(); } }
  else if (mode === "win") { modeT -= dt; if (modeT <= 0) finish(); }
}

// Chalk coins are only for show: they chime, they pull the eye, and some of them lead somewhere they should not.
const coinAt = (cn) => [cn[0] * T + T / 2, cn[1] * T + 8];
function collectCoins() {
  const cs = STAGES[cur].coins; if (!cs) return;
  const px = s.p.x + PW / 2, py = s.p.y + PH / 2;
  cs.forEach((cn, i) => {
    if (coinsGot.has(i)) return;
    const [x, y] = coinAt(cn);
    if (Math.abs(px - x) > 21 || Math.abs(py - y) > 25) return;
    coinsGot.add(i);
    sfx.tone(880 * Math.pow(2, Math.min(coinN++, 12) / 12), 0.09, { type: "triangle", vol: 0.35 });
    fx.burst(x, y, { n: 6, colors: [YEL, CHALK], speed: 150, life: 0.35, gravity: 100, size: 4, shape: "star" });
  });
}

// ---------- drawing ----------
const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
function block(k, x, y, w, h, o = {}) {
  k.fillStyle = o.fill || "#2f6650";
  k.fillRect(x, y, w, h);
  k.save(); k.beginPath(); k.rect(x, y, w, h); k.clip();
  k.strokeStyle = "rgba(244,241,230,0.13)"; k.lineWidth = 2; k.beginPath();
  for (let d = -h; d < w; d += 11) { k.moveTo(x + d, y + h); k.lineTo(x + d + h, y); }
  k.stroke(); k.restore();
  k.strokeStyle = o.line || CHALK; k.lineWidth = 3; k.lineJoin = "round";
  k.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  k.globalAlpha *= 0.35; k.lineWidth = 1.5; k.strokeRect(x + 4 + hash(x, y) * 2, y + 4, w - 8, h - 8); k.globalAlpha /= 0.35;
}
function crack(k, x, y, w) {
  k.strokeStyle = CHALK; k.lineWidth = 2; k.beginPath();
  const n = Math.max(2, Math.round(w / 40));
  for (let i = 0; i < n; i++) { const bx = x + (i + 0.5) * (w / n); k.moveTo(bx - 7, y + 3); k.lineTo(bx - 1, y + 11); k.lineTo(bx - 5, y + 16); k.lineTo(bx + 4, y + 26); k.moveTo(bx - 1, y + 11); k.lineTo(bx + 7, y + 14); }
  k.stroke();
}
function spikes(k, o) {
  k.fillStyle = "rgba(255,154,154,0.28)"; k.strokeStyle = PINK; k.lineWidth = 2.5; k.lineJoin = "round";
  if (o.fake) { k.save(); k.setLineDash([5, 4]); k.lineWidth = 2; k.globalAlpha *= o.seen ? 0.35 : 0.85; }   // painted: a dashed outline, no fill, a drip
  for (let x = o.x; x < o.x + o.w - 1; x += 20) {
    k.beginPath();
    if (o.dn) { k.moveTo(x + 2, o.y); k.lineTo(x + 10, o.y + 30); k.lineTo(x + 18, o.y); }
    else { k.moveTo(x + 2, o.y + o.h); k.lineTo(x + 10, o.y + o.h - 30); k.lineTo(x + 18, o.y + o.h); }
    k.closePath(); if (!o.fake) k.fill(); k.stroke();
  }
  if (o.fake) { k.setLineDash([]); k.beginPath(); k.moveTo(o.x + o.w - 6, o.y + o.h - 12); k.lineTo(o.x + o.w - 5, o.y + o.h - 3); k.stroke(); k.restore(); }
}
function coin(k, x, y, i) {
  const b = Math.sin(tSec * 4 + i * 0.9) * 2.5;
  k.save(); k.strokeStyle = YEL; k.lineWidth = 2.6; k.lineCap = "round";
  k.beginPath(); k.arc(x, y + b, 8.5, 0.2, 6.4); k.stroke();
  k.globalAlpha *= 0.7; k.lineWidth = 2; k.beginPath(); k.moveTo(x, y + b - 4); k.lineTo(x, y + b + 4); k.stroke();
  k.restore();
}
// A doodle arrow that points down at a tile. It means what it says. That is the joke.
function doodle(k, x, y) {
  const o = { color: CHALK, width: 3, seed: 71, boil: Math.floor(tSec * 3), alpha: 0.9 };
  chalkStroke(k, quad(x - 46, y - 8, x - 10, y - 34, x, y + 54, 10), o);
  chalkStroke(k, [[x - 12, y + 40], [x, y + 58], [x + 13, y + 41]], { ...o, seed: 72 });
}
function flag(k, o) {
  const run = !!o.mv, x = o.x + 12, y = o.y + o.h, w = Math.sin(tSec * (run ? 22 : 4));
  k.save(); k.strokeStyle = CHALK; k.lineWidth = 3; k.lineCap = "round"; k.lineJoin = "round";
  if (run) { k.translate(x, y); k.rotate(0.16); k.translate(-x, -y); }
  k.beginPath(); k.moveTo(x, y - (run ? 7 : 0)); k.lineTo(x, y - 46); k.stroke();
  k.fillStyle = "rgba(255,226,122,0.3)"; k.strokeStyle = YEL;
  k.beginPath(); k.moveTo(x, y - 46); k.lineTo(x + 22 * (run ? -1 : 1), y - 38 + w * 2); k.lineTo(x, y - 30); k.closePath(); k.fill(); k.stroke();
  if (run) { k.strokeStyle = CHALK; k.lineWidth = 2.5; k.beginPath(); k.moveTo(x, y - 8); k.lineTo(x - 5 + w * 6, y); k.moveTo(x, y - 8); k.lineTo(x + 5 - w * 6, y); k.stroke(); }
  k.restore();
}
function chalkText(k, text, x, y, size, color, align = "center", weight = 800) {
  k.font = `${weight} ${size}px ${FONT}`; k.textAlign = align; k.textBaseline = "middle";
  k.fillStyle = "rgba(20,51,39,0.55)"; k.fillText(text, x + 1.5, y + 2);
  k.fillStyle = color; k.fillText(text, x, y);
}
function drawDoor(k, o, glow) {
  const x = o.x, y = o.y, w = o.w, h = o.h;
  k.save();
  if (o.up) { k.translate(0, y * 2 + h); k.scale(1, -1); }
  if (o.fake && o.seen) k.globalAlpha *= 0.3;
  const path = () => { k.beginPath(); k.moveTo(x, y + h); k.lineTo(x, y + 14); k.quadraticCurveTo(x + w / 2, y - 8, x + w, y + 14); k.lineTo(x + w, y + h); k.closePath(); };
  if (glow > 0) { k.shadowColor = YEL; k.shadowBlur = 24 * glow; }
  path(); k.fillStyle = glow > 0 ? "#fff4b8" : "#143327"; k.fill(); k.shadowBlur = 0;
  const dc = o.twin ? CHALK : YEL;                             // the twin's door is drawn in his chalk
  k.strokeStyle = dc; k.lineWidth = 3.5; k.lineJoin = "round"; k.stroke();
  k.lineWidth = 1.5; k.globalAlpha *= 0.5; k.strokeRect(x + 6, y + 18, w - 12, 16); k.strokeRect(x + 6, y + 38, w - 12, 16); k.globalAlpha /= 0.5;
  k.fillStyle = dc; k.beginPath(); k.arc(x + w - 8, y + 36, 2.6, 0, 6.3); k.fill();
  if (o.shut) {                                                // boarded up: walk away and it thinks again
    k.strokeStyle = PINK; k.lineWidth = 4.5; k.lineCap = "round";
    k.beginPath(); k.moveTo(x - 4, y + 22); k.lineTo(x + w + 4, y + 30); k.moveTo(x - 4, y + 46); k.lineTo(x + w + 4, y + 40); k.stroke();
  }
  k.restore();
  if (o.n != null) {
    const ly = o.up ? y + h + 20 : y - 22, lt = labelT[o.id] > 0 ? labelT[o.id] / 0.45 : 0;
    k.save(); k.translate(x + w / 2 + (lt ? Math.sin(tSec * 80) * 3 * lt : 0), ly);
    k.fillStyle = "#17382c"; k.beginPath(); k.arc(0, 0, 17, 0, 6.3); k.fill();
    k.strokeStyle = lt ? PINK : CHALK; k.lineWidth = 3; k.stroke();
    chalkText(k, String(o.n), 0, 1, 21, lt ? PINK : CHALK, "center", 900);
    k.restore();
  }
}
function arrow(k, x, y, up, a) {
  k.save(); k.globalAlpha *= a; k.strokeStyle = SKY; k.lineWidth = 4; k.lineCap = "round"; k.lineJoin = "round";
  for (let i = 0; i < 2; i++) { const yy = y + i * 18 * (up ? 1 : -1) + Math.sin(tSec * 5) * 3 * (up ? -1 : 1), d = up ? 1 : -1; k.beginPath(); k.moveTo(x - 10, yy + 8 * d); k.lineTo(x, yy - 4 * d); k.lineTo(x + 10, yy + 8 * d); k.stroke(); }
  k.restore();
}
function drawObj(k, o) {
  if (o.gone) return;
  const retry = attempt > 0, wig = retry && o.wig > s.t ? Math.sin(s.t * 95) * 2.5 : 0, isKnown = known.has(o.id);
  if (o.hidden) {
    if (isKnown && retry && o.k !== "d") { k.save(); k.globalAlpha = 0.3; k.setLineDash([3, 6]); k.strokeStyle = o.k === "s" ? PINK : CHALK; k.lineWidth = 2; const yy = o.k === "s" ? (o.dn ? o.y : o.y + o.h - 30) : o.y; k.strokeRect(o.x + 3 + wig, yy + 2, o.w - 6, (o.k === "s" ? 30 : o.h) - 4); k.restore(); }
    return;
  }
  k.save();
  k.translate(wig, 0);
  if (o.falling) { k.globalAlpha = 0.8; k.translate(o.x + o.w / 2, o.y + o.h / 2); k.rotate(o.vy * 0.0004 * (hash(o.x, 3) - 0.5) * 4); k.translate(-o.x - o.w / 2, -o.y - o.h / 2); }
  if (o.k === "s") spikes(k, o);
  else if (o.k === "f") flag(k, o);
  else if (o.k === "d") drawDoor(k, o, s.won === o.id ? Math.min(1, winT * 5) : 0);
  else if (o.ghost && !o.seen) { k.fillStyle = CHALK; for (let i = 0; i < o.w / 13; i++) { k.globalAlpha = 0.16 + hash(i, 4) * 0.2; k.beginPath(); k.arc(o.x + 6 + i * 13 + hash(i, 1) * 5, o.y + 3 + hash(i, 2) * 5, 1 + hash(i, 3) * 1.3, 0, 6.3); k.fill(); } }   // nobody drew it: only chalk dust
  else if (o.tally) {                                          // the fall counter itself, lying down as a plank
    k.strokeStyle = CHALK; k.lineWidth = 3.2; k.lineCap = "round"; k.beginPath();
    for (let gx = o.x + 9; gx < o.x + o.w - 24; gx += 37) { for (let j = 0; j < 4; j++) { k.moveTo(gx + j * 7, o.y + 6); k.lineTo(gx + j * 7 - 1, o.y + o.h - 10); } k.moveTo(gx - 5, o.y + o.h - 14); k.lineTo(gx + 27, o.y + 9); }
    k.stroke(); k.globalAlpha *= 0.55; k.beginPath(); k.moveTo(o.x + 2, o.y + 2); k.lineTo(o.x + o.w - 2, o.y + 2); k.stroke();
    if (o.armed) { k.globalAlpha = 1; crack(k, o.x, o.y, o.w); }
  }
  else if (o.fake && o.seen) { k.globalAlpha = 0.28; k.setLineDash([6, 7]); k.strokeStyle = CHALK; k.lineWidth = 2.5; k.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4); }
  else {
    const lt = labelT[o.id] > 0 ? labelT[o.id] / 0.45 : 0;
    block(k, o.x, o.y, o.w, o.h, o.n != null ? { fill: "#1d4838", line: lt ? PINK : o.armed ? PINK : CHALK } : o.crush ? { fill: "#3b5d6b", line: SKY } : {});
    if (o.n != null) chalkText(k, String(o.n), o.x + o.w / 2 + (lt ? Math.sin(tSec * 80) * 3 * lt : 0), o.y + o.h / 2 + 1, o.h < 40 ? 16 : 25, lt ? PINK : CHALK, "center", 900);
    if (o.n != null && strokeT[o.id] > 0) { const pr = clamp(1 - (strokeT[o.id] - 0.25) / 0.45, 0, 1), cx = o.x + o.w / 2, cy = o.y + o.h / 2; chalkStroke(k, arc(cx - 2, cy - 5, 6, 6, 1.4, 4.9, 6), { color: PINK, width: 3, seed: 8, prog: pr }); chalkStroke(k, arc(cx - 2, cy + 7, 7, 6.5, 1.4, 4.9, 6), { color: PINK, width: 3, seed: 9, prog: pr }); }
    if (o.crack || (isKnown && retry && (o.crumble != null || o.armed || o.fake))) crack(k, o.x, o.y, o.w);
    if (o.belt) {                                              // a treadmill: the arrows only run while you stand still on it
      const rolling = s.p.ground && s.p.gid === o.id && Math.abs(s.p.vx - o.belt) < 60, d = Math.sign(o.belt), off = rolling ? (tSec * Math.abs(o.belt)) % 20 : 0;
      k.save(); k.beginPath(); k.rect(o.x + 3, o.y, o.w - 6, 16); k.clip(); k.strokeStyle = SKY; k.lineWidth = 2.5; k.lineCap = "round"; k.globalAlpha *= rolling ? 1 : 0.6; k.beginPath();
      for (let x = o.x - 20; x < o.x + o.w + 20; x += 20) { const xx = x + off * d; k.moveTo(xx - 4 * d, o.y + 4); k.lineTo(xx + 2 * d, o.y + 9); k.lineTo(xx - 4 * d, o.y + 14); }
      k.stroke(); k.restore();
    }
    if (o.legs) {                                              // a polite platform: it looks at you, then it leaves with you
      const ex = clamp((s.p.x + PW / 2 - o.x - o.w / 2) / 200, -1, 1) * 2.5, cx = o.x + o.w / 2;
      k.fillStyle = CHALK; for (const dx of [-9, 9]) { k.beginPath(); k.arc(cx + dx + ex, o.y + 19, 3, 0, 6.3); k.fill(); }
      k.strokeStyle = CHALK; k.lineWidth = 2.2; k.lineCap = "round"; k.beginPath(); k.moveTo(cx - 6, o.y + 29); k.quadraticCurveTo(cx, o.y + (o.mv ? 34 : 31), cx + 6, o.y + 29); k.stroke();
    }
    if (o.crush) { k.strokeStyle = SKY; k.lineWidth = 2.5; for (let x = o.x + 8; x < o.x + o.w - 4; x += 12) { k.beginPath(); k.moveTo(x, o.y + o.h - 4); k.lineTo(x + 4, o.y + o.h - 12); k.lineTo(x + 8, o.y + o.h - 4); k.stroke(); } }
  }
  k.restore();
  if (isKnown && retry && !o.falling && (o.k === "d" || o.crush || o.launch || o.legs) && !o.mv) chalkText(k, "!", o.x + o.w / 2, o.y + (o.k === "d" ? (o.up ? o.h + 44 : -(o.n != null ? 48 : 16)) : -14), 22, PINK, "center", 900);
}
function buildLayer() {
  const key = cur + ":" + c.scale;
  if (layerKey === key && layer) return;
  layerKey = key;
  layer = layer || document.createElement("canvas");
  layer.width = Math.ceil(C.W * T * c.scale); layer.height = Math.ceil(C.H * T * c.scale);
  const k = layer.getContext("2d");
  k.setTransform(c.scale, 0, 0, c.scale, 0, 0);
  k.clearRect(0, 0, C.W * T, C.H * T);
  for (const r of C.rects) {
    block(k, r.x, r.y, r.w, r.h);
    k.strokeStyle = "rgba(244,241,230,0.4)"; k.lineWidth = 2; k.beginPath();
    for (let x = r.x + T; x < r.x + r.w - 2; x += T) { k.moveTo(x, r.y + 3); k.lineTo(x + (hash(x, r.y) - 0.5) * 3, r.y + 12); }
    k.stroke();
  }
}
function buildBg() {
  const room = STAGES[cur].room, key = room + ":" + c.scale;
  if (bgKey === key && bg) return;
  bgKey = key;
  bg = bg || document.createElement("canvas");
  bg.width = c.canvas.width; bg.height = c.canvas.height;
  const k = bg.getContext("2d");
  k.setTransform(c.scale, 0, 0, c.scale, 0, 0);
  const gr = k.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, "#2b6650"); gr.addColorStop(1, "#1e4c3b");
  k.fillStyle = gr; k.fillRect(0, 0, VW, VH);
  // eraser smudges
  k.lineCap = "round";
  for (let i = 0; i < 16; i++) { const x = hash(i, room) * VW, y = hash(room, i * 3) * VH, a = (hash(i, 9) - 0.5) * 0.5; k.strokeStyle = `rgba(244,241,230,${0.012 + hash(i, 5) * 0.02})`; k.lineWidth = 40 + hash(i, 7) * 50; k.beginPath(); k.moveTo(x - 110, y - 110 * a); k.lineTo(x + 110, y + 110 * a); k.stroke(); }
  // faint doodles from older lessons
  k.strokeStyle = k.fillStyle = "rgba(244,241,230,0.11)"; k.lineWidth = 2.5; k.lineJoin = "round";
  const spots = [[150, 215], [400, 290], [660, 205], [840, 300], [290, 170], [560, 330]];
  spots.forEach(([x0, y0], i) => {
    const x = x0 + (hash(room, i) - 0.5) * 60, y = y0 + (hash(i, room + 4) - 0.5) * 40, kind = (i + room) % 6;
    k.beginPath();
    if (kind === 0) { k.moveTo(x - 30, y + 26); k.lineTo(x - 30, y - 26); k.moveTo(x - 30, y + 26); k.lineTo(x + 36, y + 26); k.moveTo(x - 26, y + 18); k.lineTo(x + 28, y - 20); }
    else if (kind === 1) { k.moveTo(x - 28, y + 22); k.lineTo(x + 30, y + 22); k.lineTo(x + 30, y - 22); k.closePath(); k.rect(x + 20, y + 12, 10, 10); }
    else if (kind === 2) { k.arc(x, y, 22, 0, 6.3); for (let a = 0; a < 8; a++) { k.moveTo(x + Math.cos(a * 0.785) * 28, y + Math.sin(a * 0.785) * 28); k.lineTo(x + Math.cos(a * 0.785) * 38, y + Math.sin(a * 0.785) * 38); } }
    else if (kind === 3) { for (let j = 1; j < 3; j++) { k.moveTo(x - 30 + j * 20, y - 30); k.lineTo(x - 30 + j * 20, y + 30); k.moveTo(x - 30, y - 30 + j * 20); k.lineTo(x + 30, y - 30 + j * 20); } k.moveTo(x - 24, y - 24); k.lineTo(x - 16, y - 16); k.moveTo(x - 16, y - 24); k.lineTo(x - 24, y - 16); k.moveTo(x + 27, y); k.arc(x + 20, y, 7, 0, 6.3); }
    else if (kind === 4) { for (let j = 0; j < 5; j++) { const a = -1.57 + j * 2.513; k[j ? "lineTo" : "moveTo"](x + Math.cos(a) * 26, y + Math.sin(a) * 26); } k.closePath(); }
    k.stroke();
    if (kind === 5) { k.font = `700 26px ${FONT}`; k.textAlign = "center"; k.fillText(["2 + 2 = 4", "y = 2x + 1", "7 x 8 = 56", "a + b = b + a"][(room + i) % 4], x, y); }
  });
  // wooden frame
  k.strokeStyle = "#7a5230"; k.lineWidth = 12; k.strokeRect(0, 0, VW, VH);
  k.strokeStyle = "#a9753f"; k.lineWidth = 3; k.strokeRect(7, 7, VW - 14, VH - 14);
}
function drawHero(k, x, y, size, o = {}) {
  const L = look();
  drawChalkArchie(k, x, y, size, { color: L.color || BLUE, acc: L.acc, accColor: L.accColor, boil: heroBoil, ...o });
}
function drawPlayer() {
  if (mode === "dead" || mode === "done") { if (mode === "done") return; return; }
  const p = s.p, cx = p.x + PW / 2;
  const sq = squash * 0.22 - stretch * 0.18, pop = spawnT > 0 && g.state === "playing" && !introHero ? 1 - spawnT / 0.25 : 1;
  ctx.save();
  ctx.translate(cx, p.g > 0 ? p.y + PH : p.y);
  if (p.g < 0) ctx.scale(1, -1);
  const won = mode === "win";
  const ih = introHero, running = p.ground && Math.abs(p.vx) > 40;
  const pose = ih ? ih.pose : won ? "happy" : !p.ground ? (p.vy * p.g > 140 ? "fall" : "jump") : surpriseT > 0 ? "surprised" : running ? "run" : "idle";
  drawHero(ctx, 0, -18 * (1 - sq) * pop + (ih ? ih.dy : 0), 46 * (won ? Math.max(0.2, 1 - winT * 1.6) : pop), {
    pose, flip: !ih && p.face < 0, t: ih ? introT : tSec * (s.ice ? 0.5 : 1.25), rotation: ih ? ih.lean || 0 : running ? 0.09 * p.face : 0,
    squashX: 1 + sq, squashY: 1 - sq, look: ih ? ih.look : { x: Math.abs(p.vx) > 40 || !p.ground ? 0.7 : 0.3, y: p.ground ? 0 : p.vy * p.g > 0 ? 0.6 : -0.6 }, blink: ih ? !!ih.blink : tSec % 3.2 < 0.12,
    boil: ih ? Math.floor(introT * 8) : heroBoil,
  });
  ctx.restore();
  if (STAGES[cur].twin && !ih) {                               // the chalk twin: same moves, mirrored, drawn in white
    ctx.save();
    ctx.translate(C.W * T - cx, p.g > 0 ? p.y + PH : p.y);
    if (p.g < 0) ctx.scale(1, -1);
    drawChalkArchie(ctx, 0, -18 * (1 - sq) * pop, 46 * (won ? Math.max(0.2, 1 - winT * 1.6) : pop), {
      pose, flip: p.face > 0, t: tSec * 1.25, rotation: running ? -0.09 * p.face : 0, squashX: 1 + sq, squashY: 1 - sq, color: CHALK, boil: heroBoil + 3,
      look: { x: Math.abs(p.vx) > 40 || !p.ground ? 0.7 : 0.3, y: 0 }, blink: tSec % 3.2 < 0.12, alpha: 0.9,
    });
    ctx.restore();
  }
}
function drawFace(x, y) {
  const smirk = faceT > 0, p = s.p, dx = clamp((p.x - s.cam.x - x) / 400, -1, 1) * 3, dy = clamp((p.y + OY - y) / 300, -1, 1) * 2.5;
  ctx.save(); ctx.translate(x, y + (smirk ? Math.sin(faceT * 22) * 2 * Math.min(1, faceT) : 0));
  ctx.strokeStyle = CHALK; ctx.fillStyle = CHALK; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, 0, 19, 0.1, 6.35); ctx.stroke();
  ctx.beginPath(); ctx.arc(-7 + dx, -4 + dy, 2.6, 0, 6.3); ctx.arc(7 + dx, -4 + dy, 2.6, 0, 6.3); ctx.fill();
  ctx.beginPath();
  if (mode === "win" || mode === "done") { ctx.arc(0, 9, 4, 0, 6.3); }
  else if (smirk) { ctx.moveTo(-8, 7); ctx.quadraticCurveTo(2, 14, 10, 3); ctx.moveTo(-11, -12); ctx.lineTo(-3, -10); ctx.moveTo(3, -13); ctx.lineTo(11, -10); }
  else { ctx.moveTo(-6, 8); ctx.lineTo(6, 8); }
  ctx.stroke(); ctx.restore();
}
function drawHud() {
  const room = Math.floor(cur / 5);
  const tag = `${room + 1}-${(cur % 5) + 1}`;
  chalkText(ctx, tag, 24, 36, 24, CHALK, "left", 900);
  const tw = ctx.measureText(tag).width;
  ctx.globalAlpha = 0.7; chalkText(ctx, ROOM_NAMES[room], 36 + tw, 37, 16, CHALK, "left", 700); ctx.globalAlpha = 1;
  // the rule, in yellow chalk. A rewrite strikes the old one out.
  if (ruleShown) {
    const k = clamp(ruleT / 0.45, 0, 1);
    ctx.font = `900 30px ${FONT}`; const w = ctx.measureText(ruleShown).width;
    ctx.save(); ctx.beginPath(); ctx.rect(480 - w / 2 - 6, 30, (w + 12) * k, 50); ctx.clip();
    chalkText(ctx, ruleShown, 480, 54, 30, YEL, "center", 900);
    ctx.strokeStyle = YEL; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    for (let x = -w / 2; x <= w / 2; x += 8) ctx.lineTo(480 + x, 74 + Math.sin(x * 0.09) * 2.5);
    ctx.stroke(); ctx.restore();
    if (ruleT < 1.6 && ruleOld) {
      ctx.globalAlpha = clamp(1.6 - ruleT, 0, 1) * 0.75; chalkText(ctx, ruleOld, 480, 100, 20, CHALK, "center", 800);
      const ow = ctx.measureText(ruleOld).width; ctx.strokeStyle = PINK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(480 - ow / 2 - 6, 103); ctx.lineTo(480 - ow / 2 - 6 + (ow + 12) * clamp(ruleT / 0.25, 0, 1), 97); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  // the chalk face keeps count
  drawFace(772, 40);
  const marks = s.objs.some((o) => o.tally && !o.hidden) ? 0 : Math.min(stageDeaths, 15);   // the count is busy being a platform
  if (falls[cur] > 0) { ctx.globalAlpha = 0.65; chalkText(ctx, "Falls here: " + falls[cur], 748, 64, 12, CHALK, "right", 700); ctx.globalAlpha = 1; }
  ctx.strokeStyle = CHALK; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.beginPath();
  for (let i = 0; i < marks; i++) { const gx = 738 - Math.floor(i / 5) * 34, j = i % 5; if (j < 4) { ctx.moveTo(gx - j * 6, 28); ctx.lineTo(gx - j * 6 - 1, 50); } else { ctx.moveTo(gx + 5, 45); ctx.lineTo(gx - 24, 32); } }
  ctx.stroke();
  if (stageDeaths > 15) chalkText(ctx, "+" + (stageDeaths - 15), 634, 40, 16, CHALK, "right", 800);
  if (commentT > 0 && comment) { ctx.globalAlpha = clamp(commentT * 3, 0, 1); chalkText(ctx, comment, 796, 84, 19, CHALK, "right", 800); ctx.globalAlpha = 1; }
  if (sayT > 0 && sayText) { const pop = clamp((2 - sayT) * 8, 0, 1); ctx.globalAlpha = clamp(sayT * 3, 0, 1); chalkText(ctx, sayText, 480, (ruleShown ? 118 : 70) + (1 - pop) * 8, 26, PINK, "center", 900); ctx.globalAlpha = 1; }
  if (bannerT >= 0 && bannerT < 1.6) drawBanner(bannerT);
  if (s.mirror > 0) {
    const y = 176, sh = mirrorWarn > 0 ? Math.sin(tSec * 70) * 5 : 0;
    ctx.save(); ctx.translate(480 + sh, y);
    chalkText(ctx, "LEFT", -92, 0, 30, PINK, "center", 900); chalkText(ctx, "RIGHT", 96, 0, 30, PINK, "center", 900);
    ctx.strokeStyle = PINK; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    ctx.moveTo(-28, -8); ctx.lineTo(28, -8); ctx.lineTo(20, -15); ctx.moveTo(28, 8); ctx.lineTo(-28, 8); ctx.lineTo(-20, 15); ctx.stroke();
    ctx.fillStyle = PINK; ctx.fillRect(-150, 26, 300 * (s.mirror / 3), 5);
    ctx.restore();
  }
}
// The fake win: a "Stage clear!" banner one step before the door. Then it tears down the middle.
function drawBanner(t) {
  const tear = clamp((t - 0.55) / 0.7, 0, 1), pop = clamp(t / 0.14, 0, 1);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(480 + side * tear * 50, 215 + tear * tear * 170); ctx.rotate(side * tear * 0.4); ctx.scale(pop, pop);
    ctx.globalAlpha = 1 - clamp((t - 1.2) / 0.4, 0, 1);
    ctx.beginPath(); ctx.moveTo(side * 270, -70);
    for (let i = 0; i <= 10; i++) ctx.lineTo((i % 2 ? 7 : -7) * (tear > 0 ? 1 : 0), -70 + i * 14);
    ctx.lineTo(side * 270, 70); ctx.closePath(); ctx.clip();
    ctx.fillStyle = "#17382c"; ctx.strokeStyle = YEL; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.rect(-225, -44, 450, 88); ctx.fill(); ctx.stroke();
    chalkText(ctx, "Stage clear!", 0, 3, 50, YEL, "center", 900);
    ctx.restore();
  }
}
function drawWorld() {
  buildBg(); buildLayer();
  const lean = Math.abs(tiltVis) > 0.01;
  if (lean) { ctx.fillStyle = "#17382c"; ctx.fillRect(0, 0, VW, VH); ctx.save(); ctx.translate(480, 300); ctx.rotate(tiltVis * 0.085); ctx.scale(1 - 0.07 * Math.abs(tiltVis), 1 - 0.07 * Math.abs(tiltVis)); ctx.translate(-480, -300); }
  ctx.drawImage(bg, 0, 0, VW, VH);
  ctx.save();
  ctx.translate(-s.cam.x + g.shakeX, OY + g.shakeY);
  const retry = attempt > 0;
  for (const d of STAGES[cur].deco || []) { if (d.k === "doodle") doodle(ctx, d.x * T + T / 2, d.y * T); else arrow(ctx, d.x * T + T / 2, d.y * T + T / 2, d.k === "up", 0.85); }
  if (retry) for (const i of knownX) { const o = C.traps[i].on, x = (o.xgt ?? o.xlt) * T, y = (C.spawn.y + 1) * T; ctx.save(); ctx.globalAlpha = 0.4; ctx.setLineDash([4, 7]); ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 62); ctx.stroke(); ctx.restore(); chalkText(ctx, "!", x, y - 74, 17, PINK, "center", 900); }
  if (retry) for (const i of knownZ) { const z = C.traps[i].on.zone; ctx.save(); ctx.globalAlpha = 0.35; ctx.setLineDash([4, 7]); ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.strokeRect(z[0] * T, z[1] * T, z[2] * T, z[3] * T); ctx.restore(); }
  for (const m of smudges) chalkSmudge(ctx, m.x, m.y, m.seed, m.color);
  for (const o of s.objs) if (o.k === "d") drawObj(ctx, o);
  ctx.drawImage(layer, 0, 0, C.W * T, C.H * T);
  for (const o of s.objs) if (o.k !== "d") drawObj(ctx, o);
  if (s.ice) {
    ctx.save(); ctx.globalAlpha = iceT > 0 ? 1 : 0.85; ctx.strokeStyle = SKY; ctx.lineWidth = iceT > 0 ? 7 : 5; ctx.lineCap = "round";
    const top = (r) => { ctx.beginPath(); ctx.moveTo(r.x + 4, r.y + 2); ctx.lineTo(r.x + r.w - 4, r.y + 2); ctx.stroke(); ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = r.x + 14; x < r.x + r.w - 14; x += 46) { ctx.moveTo(x, r.y + 9); ctx.lineTo(x + 12, r.y + 9); } ctx.stroke(); ctx.restore(); };
    for (const r of C.rects) if (r.y >= 440) top(r);
    ctx.restore();
  }
  const st = STAGES[cur];
  if (st.hint && progress <= cur && g.state !== "menu") chalkText(ctx, st.hint, 480, st.hintY || 250, 30, CHALK, "center", 800);
  if (st.coins) st.coins.forEach((cn, i) => { if (!coinsGot.has(i)) { const [x, y] = coinAt(cn); coin(ctx, x, y, i); } });
  if (st.lie) {                                                // the hint that lies once, then says sorry forever
    const L = st.lie, x = L.x * T, y = L.y * T;
    chalkText(ctx, lieOn ? L.text : L.truth, x, y - 40, 21, lieOn ? CHALK : YEL, "center", 800);
    if (lieOn) { chalkStroke(ctx, line(x, y - 24, x, y + 6, 8), { width: 3, seed: 75 }); chalkStroke(ctx, [[x - 9, y - 4], [x, y + 8], [x + 9, y - 4]], { width: 3, seed: 76 }); }
  }
  drawPlayer();
  if (s.dark > 0) {                                            // lights off: only the chalk outlines glow
    const a = clamp(s.dark * 5, 0, 1);
    ctx.save(); ctx.globalAlpha = a * 0.9; ctx.fillStyle = "#06120d"; ctx.fillRect(s.cam.x - 80, -OY - 80, VW + 160, VH + 200);
    ctx.globalAlpha = a; ctx.shadowColor = CHALK; ctx.shadowBlur = 9; ctx.strokeStyle = CHALK; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    for (const r of C.rects) ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    for (const o of s.objs) {
      if (o.hidden || o.gone || o.falling || (o.ghost && !o.seen)) continue;
      if (o.k === "s") spikes(ctx, o); else if (o.k === "d") drawDoor(ctx, o, 0);
      else if (o.k === "b") { ctx.strokeStyle = CHALK; ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3); if (o.n != null) chalkText(ctx, String(o.n), o.x + o.w / 2, o.y + o.h / 2 + 1, 25, CHALK, "center", 900); }
    }
    ctx.restore();
    drawPlayer();
  }
  fx.draw(ctx);
  ctx.restore();
  if (lean) ctx.restore();
}
function render() {
  if (posterOn) return drawPoster();
  if (!s) return;
  if (mode === "sheet") return;
  if (mode === "ending") return drawEnding(ctx, endT, storyApi);
  if (mode === "intro") {
    if (introT < TD) { drawIntro(ctx, introT, storyApi); if (introT < 4) { ctx.globalAlpha = 0.5 * clamp(4 - introT, 0, 1); chalkText(ctx, g.coarse ? "Tap to skip" : "Any key skips", 936, 518, 15, CHALK, "right", 700); ctx.globalAlpha = 1; } return; }
    introHero = heroD(introT - TD);
  }
  drawWorld();
  drawHud();
}

// ---------- title buttons: stage select and looks ----------
function showStages() {
  let html = `<h2>Stages</h2><div class="sf-rooms">`;
  for (let r = 0; r < N / 5; r++) {
    html += `<div class="sf-room"><span>${r + 1}. ${ROOM_NAMES[r]}</span><div>`;
    for (let k = 0; k < 5; k++) { const i = r * 5 + k; html += `<button class="sf-lv${i < progress ? " sf-done" : ""}${clean[i] ? " sf-clean" : ""}" data-i="${i}" ${i > progress ? "disabled" : ""}>${k + 1}</button>`; }
    html += `</div></div>`;
  }
  const el = g.panel(html + `</div><button class="ak-btn ak-ghost" data-back>Back</button>`, "ak-wide");
  el.onclick = (e) => {
    e.stopPropagation();
    const b = e.target.closest("button"); if (!b) return;
    sfx.play("click");
    if (b.dataset.back != null) return g.menu();
    startAt = Number(b.dataset.i); g.start();
  };
}
function showLooks() {
  const row = (list, cur0, kind) => list.map((u) => { const ok = g.unlocked(u.id); return `<button class="sf-pick${u.id === cur0 ? " on" : ""}" data-kind="${kind}" data-id="${u.id}" ${ok ? "" : "disabled"}>${u.name}${ok ? "" : `<small>${u.need} xp</small>`}</button>`; }).join("");
  const el = g.panel(`<h2>Looks</h2><p class="ak-line">You have ${g.xp} xp. Clear stages to earn more.</p><div class="sf-picks">${row(LOOKS, look().id, "look")}</div><p class="ak-line">Poof style</p><div class="sf-picks">${row(POOFS, poof(), "poof")}</div><button class="ak-btn ak-ghost" data-back>Back</button>`, "ak-wide");
  el.onclick = (e) => {
    e.stopPropagation();
    const b = e.target.closest("button"); if (!b) return;
    sfx.play("click");
    if (b.dataset.back != null) return g.menu();
    if (b.dataset.kind === "look") { lookId = b.dataset.id; g.save("look", lookId); } else { poofId = b.dataset.id; g.save("poof", poofId); }
    showLooks(); g.redraw();
  };
}

// ---------- poster: one composed hero shot, no HUD, no text ----------
function drawPoster() {
  const k = ctx;
  // fill whatever shape the stage has (a square capture crops the center of the 16:9 frame)
  const box = g.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), sc = Math.max(box.width / VW, box.height / VH) * dpr;
  c.canvas.width = Math.round(VW * sc); c.canvas.height = Math.round(VH * sc);
  k.setTransform(sc, 0, 0, sc, 0, 0);
  const gr = k.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, "#2f6f57"); gr.addColorStop(1, "#1c4838");
  k.fillStyle = gr; k.fillRect(0, 0, VW, VH);
  k.lineCap = "round";
  for (let i = 0; i < 10; i++) { k.strokeStyle = `rgba(244,241,230,${0.02 + hash(i, 2) * 0.025})`; k.lineWidth = 50 + hash(i, 7) * 50; const x = hash(i, 1) * VW, y = 220 + hash(1, i) * 320; k.beginPath(); k.moveTo(x - 120, y - 20); k.lineTo(x + 120, y + 20); k.stroke(); }
  k.save();
  k.translate(480, 540); k.scale(1.9, 1.9); k.translate(-240, -284);       // world units; floor top at y = 204
  const fy = 204;
  // floor on both sides, number tiles between, the wrong one already falling
  block(k, -80, fy, 190, 80); block(k, 290, fy, 300, 80);
  block(k, 110, fy, 60, 40, { fill: "#1d4838" }); chalkText(k, "4", 140, fy + 21, 25, CHALK, "center", 900);
  block(k, 230, fy, 60, 40, { fill: "#1d4838" }); chalkText(k, "8", 260, fy + 21, 25, CHALK, "center", 900);
  k.save(); k.translate(203, fy + 56); k.rotate(0.34); k.globalAlpha = 0.92; block(k, -30, -20, 60, 40, { fill: "#1d4838", line: PINK }); chalkText(k, "7", 0, 1, 25, PINK, "center", 900); k.restore();
  for (let i = 0; i < 10; i++) { k.fillStyle = `rgba(244,241,230,${0.35 + hash(i, 4) * 0.5})`; k.beginPath(); k.arc(172 + hash(i, 1) * 58, fy + 4 + hash(i, 2) * 40, 1.5 + hash(i, 3) * 3.5, 0, 6.3); k.fill(); }
  // spikes that just popped, and the door leaning away
  spikes(k, { x: 294, y: fy - 40, w: 40, h: 40 });
  k.save(); k.translate(352, fy); k.rotate(0.12); drawDoor(k, { x: -16, y: -60, w: 32, h: 60 }, 0); k.restore();
  k.strokeStyle = YEL; k.lineWidth = 3; k.globalAlpha = 0.8; for (let i = 0; i < 3; i++) { k.beginPath(); k.moveTo(336, fy - 48 + i * 15); k.lineTo(324 - i * 3, fy - 48 + i * 15); k.stroke(); } k.globalAlpha = 1;
  // Archie, mid jump, about a third of the frame
  drawHero(k, 196, fy - 64, 122, { pose: "jump", look: { x: 0.7, y: 0.5 }, rotation: -0.12, squashX: 0.96, squashY: 1.05, boil: 2, board: "#245844" });
  for (let i = 0; i < 7; i++) { k.fillStyle = "rgba(244,241,230,0.75)"; k.beginPath(); k.arc(138 + hash(i, 8) * 44 - i * 3, fy - 8 - hash(i, 9) * 20, 1.5 + hash(i, 6) * 3.5, 0, 6.3); k.fill(); }
  k.restore();
}

g.loop(update, render);
loadStage(progress >= N ? 0 : progress);
g.redraw();

// ---------- debug and test hooks ----------
g.debug = {
  get s() { return s; }, get cur() { return cur; }, get mode() { return mode; }, get deaths() { return deaths; }, get stageDeaths() { return stageDeaths; }, get progress() { return progress; }, get attempt() { return attempt; }, get comment() { return comment; }, get kind() { return lastKind; }, get falls() { return falls; }, lines: LINES,
  stages: N, solutions: SOLUTIONS,
  get introT() { return introT; }, get endT() { return endT; }, get smudges() { return smudges.length; },
  story() { storyReplay = true; g.start(); return INTRO_LEN; }, ending() { noIntro = true; if (g.state !== "playing") g.start(); mode = "ending"; endT = 0; fx.clear(); return END_LEN; },
  sheet() { // every look in every pose, for checking the chalk drawing
    mode = "sheet"; buildBg(); ctx.drawImage(bg, 0, 0, VW, VH);
    const poses = ["idle", "run", "jump", "fall", "surprised", "happy", "shrug", "wave"], keep = lookId;
    LOOKS.forEach((L, j) => poses.forEach((pose, i) => drawChalkArchie(ctx, 80 + i * 115, 50 + j * 72, j < 2 ? 62 : 46, { pose, t: 0.1 + i, color: L.color || BLUE, acc: L.acc, accColor: L.accColor, look: { x: 0.5, y: 0 } })));
    for (let i = 0; i < 4; i++) chalkSmudge(ctx, 900, 100 + i * 90, i * 3.1 + 1, [BLUE, "#ffa3b8", "#ffd66b", CHALK][i]);
    lookId = keep; return true;
  },
  introAt(t) { mode = "intro"; introT = t; introHero = null; g.redraw(); return t; }, endAt(t) { mode = "ending"; endT = t; g.redraw(); return t; },
  goto(i, tr = 0) { startAt = i; noIntro = true; if (g.state !== "playing") g.start(); else { loadStage(i); startAt = null; } noIntro = false; attempt = tr; respawn(); return cur; },
  solve(i = cur) { const sol = SOLUTIONS[i]; if (!sol) return 0; this.goto(i, sol.try); bot = { keys: sol.keys, f: 0 }; return (sol.keys.length * MACRO) / 60; },
  next() { g._levelGo?.(); return cur; },
  verifyAll() {
    const fail = [];
    STAGES.forEach((st, i) => {
      const sol = SOLUTIONS[i]; if (!sol) return fail.push(i);
      const q = newSim(compile(st, ROOMS), sol.try);
      for (const ch of sol.keys) for (let f = 0; f < MACRO && !q.won && !q.dead; f++) step(q, ch === "r" || ch === "R" ? 1 : ch === "l" || ch === "L" ? -1 : 0, ch < "a");
      if (!q.won) fail.push(i);
    });
    return { ok: N - fail.length, fail };
  },
  poster() { posterOn = true; g.posterMode = true; const st = document.createElement("style"); st.textContent = ".ak-hud,.ak-overlay,.ak-touch,.ak-toasts{display:none!important}.ak-canvas{object-fit:cover}"; document.head.appendChild(st); g.stage.style.setProperty("--ak-aspect", String(innerWidth / innerHeight)); g.redraw(); setTimeout(() => posterOn && g.redraw(), 150); return true; },
  setXp(n) { g.save("xp", n); }, reset() { ["progress2", "deaths2", "clean2", "falls", "lied", "xp", "look", "poof", "best", "story"].forEach((k) => localStorage.removeItem("arcade:sneaky-floors:" + k)); },
};
