// Bridge Run: a three-lane sprint along an endless suspension bridge at sunrise.
// Chain lane changes, jumps and slides, take the high road over trucks and trams,
// and run through the arch with the right answer for a multiplier and a burst of speed.
import { g, hooks, THREE, scene, camera, renderer, LANE, SPAN, HORIZON, waterMat, deckTex, spans } from "./world.js";
import { math, sfx, clamp, lerp, damp, rand, randInt } from "../kit/kit.js";
import { T, KIND, TOP, RAMP_L, birdMesh, NCOIN, coinMesh, PICK_COL, pick, ARCH_COL, gate, bestMark, root, tilt, archie, setLook, wing, springs, shield, shieldRing, gull, NP, P, partMesh, puff, spark, NL, lineMesh, lineSeed, words, say, hideProps, showProps, NLET, letterSprites, setLetter } from "./props.js";
import * as music from "./music.js";

// ---------- the chaser: Sweeper, the bridge's cleaning machine. It is right behind you at the start and after every stumble. ----------
const chaser = new THREE.Group();
const chaserParts = {};
{
  const M = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
  const add3 = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; chaser.add(m); return m; };
  const red = M("#ef4444"), dark = M("#1e293b"), yellow = M("#fde047"), steel = M("#94a3b8");
  add3(new THREE.BoxGeometry(1.9, 1.05, 1.7), red, 0, 0.95, 0);
  add3(new THREE.BoxGeometry(1.5, 0.75, 1.0), dark, 0, 1.8, 0.2);
  add3(new THREE.BoxGeometry(1.2, 0.34, 0.06), M("#7dd3fc", { emissive: "#38bdf8", emissiveIntensity: 0.5 }), 0, 1.86, 0.72);
  add3(new THREE.BoxGeometry(1.96, 0.16, 1.76), yellow, 0, 0.5, 0);
  chaserParts.roller = add3(new THREE.CylinderGeometry(0.46, 0.46, 2.1, 14), yellow, 0, 0.48, -1.25);
  chaserParts.roller.rotation.z = Math.PI / 2;
  for (const x of [-0.98, 0.98]) for (const z of [-0.45, 0.6]) { const w = add3(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), dark, x, 0.4, z); w.rotation.z = Math.PI / 2; }
  chaserParts.beacon = add3(new THREE.SphereGeometry(0.2, 12, 10), M("#f59e0b", { emissive: "#f59e0b", emissiveIntensity: 1 }), 0, 2.36, 0.2);
  chaserParts.arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.82, 1.5, -0.6);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.5), steel); arm.position.z = -0.75; arm.castShadow = true;
    const claw = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 14, Math.PI * 1.4), yellow); claw.position.z = -1.6; claw.rotation.set(Math.PI / 2, 0, side * 0.6); claw.castShadow = true;
    pivot.add(arm, claw); chaser.add(pivot); return pivot;
  });
  // a face on the back of the cab is no use: the eyes sit on stalks above the roller so they read from behind and from the front
  for (const x of [-0.42, 0.42]) { add3(new THREE.SphereGeometry(0.2, 12, 10), M("#ffffff"), x, 1.66, -0.86); add3(new THREE.SphereGeometry(0.1, 10, 8), dark, x, 1.66, -1.03); }
  const brow = add3(new THREE.BoxGeometry(1.1, 0.1, 0.1), dark, 0, 1.92, -0.92); brow.rotation.z = 0;
  chaser.scale.setScalar(0.62);
  chaser.visible = false;
  scene.add(chaser);
}
let chaserX = 0, sirenT = 0;

const GRAV = 34, JUMP_V = 10.6, SPRING_V = 15.2, SLIDE_T = 0.6, FLY_Y = 7.4;
const CAM_Y = 3.5, CAM_Z = 6.4, REF = 12.5;
const laneX = (i) => (i - 1) * LANE;
// Hit shapes match the drawing: Archie's body is about 1 unit wide, each obstacle has its own half width (KIND.hw).
// Shapes that only graze by less than EASE do not count.
const AW = 0.5, EASE = 0.15;
const WORDS = ["SLOPE", "GRAPH", "ALGEBRA", "FACTOR", "PRIME", "EQUAL", "BRIDGE"];
const letters = Array.from({ length: NLET }, () => ({ on: false, s: 0, lane: 1 }));
let wordStart = 0;
// ---------- the word at the top: collected letters are lit ----------
const wordEl = document.createElement("div");
wordEl.style.cssText = "position:absolute;right:1.7cqw;top:max(6.6cqw,44px);transform-origin:100% 0;display:none;gap:.22em;pointer-events:none;z-index:3;font-weight:900;font-size:clamp(10px,2cqw,19px);letter-spacing:0;transition:transform .12s";
g.stage.appendChild(wordEl);
function paintWord() {
  const word = WORDS[S.wordI];
  let h = "";
  for (let i = 0; i < word.length; i++) h += `<span style="display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:.4em;${i < S.got ? "background:#fbbf24;color:#1e3a8a;box-shadow:0 0 .6em #fde68a" : "background:rgb(15 23 42 / .6);color:rgb(255 255 255 / .7)"}">${word[i]}</span>`;
  wordEl.innerHTML = h;
}
const smooth = (x) => x * x * (3 - 2 * x);

// ---------- things to earn ----------
const LOOKS = [
  { id: "classic", name: "Classic", c: "#2563eb" }, { id: "sunrise", name: "Sunrise", c: "#f97316" }, { id: "mint", name: "Mint", c: "#10b981" },
  { id: "grape", name: "Grape", c: "#8b5cf6" }, { id: "gold", name: "Gold", c: "#eab308" }, { id: "night", name: "Midnight", c: "#334155" },
];
const TRAILS = [
  { id: "dust", name: "Dust", c: ["#fff4d6"] }, { id: "spark", name: "Sparks", c: ["#fde047", "#fb923c", "#ffffff"] }, { id: "bubble", name: "Bubbles", c: ["#7dd3fc", "#e0f2fe", "#a5f3fc"] },
  { id: "rainbow", name: "Rainbow", c: ["#ef4444", "#f59e0b", "#fde047", "#22c55e", "#3b82f6", "#a855f7"] }, { id: "comet", name: "Comet", c: ["#ffffff", "#a5b4fc", "#f0abfc"] },
];
g.unlocks([
  { id: "sunrise", name: "Sunrise Archie", need: 40 }, { id: "spark", name: "Spark trail", need: 150 }, { id: "mint", name: "Mint Archie", need: 350 },
  { id: "bubble", name: "Bubble trail", need: 650 }, { id: "grape", name: "Grape Archie", need: 1000 }, { id: "rainbow", name: "Rainbow trail", need: 1500 },
  { id: "gold", name: "Gold Archie", need: 2100 }, { id: "comet", name: "Comet trail", need: 2800 }, { id: "night", name: "Midnight Archie", need: 3600 },
]);
const curLook = () => LOOKS.find((l) => l.id === g.skin && g.unlocked(l.id)) || LOOKS[0];
const curTrail = () => TRAILS.find((l) => l.id === g.load("trail", "dust") && g.unlocked(l.id)) || TRAILS[0];
let trail = curTrail();
setLook(curLook().c);

// ---------- missions: three at a time, saved between runs ----------
const MDEF = {
  coins: ["Collect {n} coins", [60, 120, 200, 300]], jumps: ["Jump {n} times", [20, 40, 60]], dist: ["Run {n} m in one go", [300, 600, 1000, 1500]],
  slides: ["Slide {n} times", [8, 16, 30]], arches: ["Hit {n} right arches", [3, 6, 10]], close: ["Get {n} close calls", [4, 10, 20]],
  high: ["Run {n} m up high", [60, 150, 300]], power: ["Grab {n} power-ups", [3, 6, 10]],
};
const MORDER = Object.keys(MDEF);
const meta = g.load("meta", null) || { m: [{ id: "coins", have: 0 }, { id: "jumps", have: 0 }, { id: "dist", have: 0 }], next: 3, done: 0, tier: {} };
const mNeed = (m) => { const a = MDEF[m.id][1]; return a[Math.min(a.length - 1, meta.tier[m.id] || 0)]; };
const mText = (m) => MDEF[m.id][0].replace("{n}", mNeed(m));
const baseMult = () => 1 + Math.min(4, Math.floor(meta.done / 3));

// ---------- pools ----------
const obs = Array.from({ length: 130 }, () => ({ on: false, kind: "", K: null, lane: 0, s0: 0, s1: 0, fly: 0, fx: 0, flag: 0 }));
const coins = Array.from({ length: NCOIN }, () => ({ on: false, x: 0, y: 0, s: 0 }));
function add(kind, lane, s0, len) {
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.on) continue;
    o.on = true; o.kind = kind; o.K = KIND[kind]; o.lane = lane; o.s0 = s0; o.s1 = s0 + (len ?? o.K.len ?? 0); o.fly = 0; o.fx = 0; o.flag = 0;
    return o;
  }
  return null;
}
let coinNext = 0;
function coin(x, y, s) {
  for (let n = 0; n < NCOIN; n++) {
    const c = coins[coinNext]; coinNext = (coinNext + 1) % NCOIN;
    if (c.on) continue;
    c.on = true; c.x = x; c.y = y; c.s = s;
    return;
  }
}
const coinLine = (lane, s, n, y = 0.8, step = 1.7) => { for (let j = 0; j < n; j++) coin(laneX(lane), y, s + j * step); };
const coinArc = (lane, sc, v, base = 0) => { for (let j = -2; j <= 2; j++) { const u = j / 2.3; coin(laneX(lane), base + 0.8 + 1.25 * (1 - u * u), sc + u * v * 0.31); } };
const coinSwerve = (a, b, s, n = 4, y = 0.8) => { for (let j = 0; j < n; j++) coin(lerp(laneX(a), laneX(b), (j + 0.5) / n), y, s + j * 1.7); };
// A bit easier (owner, Nov 20): slower start, a longer ramp, wider gaps, later tiers. Obstacles are still random from the first one.
const V0 = 13.5, V1 = 13, RAMP_T = 75, GAP_MIN = 12, GAP_A = 1.42, GAP_B = 0.55, FIRST_S = 82, TIER3 = 300, TIER4 = 700;
const vAt = (s) => V0 + V1 * clamp(s / 1500, 0, 1) ** 0.85;
const other = (a) => (a === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1);
const block = () => (Math.random() < 0.55 ? "crate" : "cone");

// ---------- state ----------
const S = { pk: { on: false, type: "magnet", lane: 1, s: 0 }, st: {}, forced: [] };
const IN = { L: false, R: false, U: false, D: false };
const swipe = { x: 0, y: 0, used: true };
let firstRun = true, posterOn = false, menuT = 0;
function reset() {
  Object.assign(S, {
    t: 0, dist: 0, base: V0, speed: firstRun ? 9 : 12, lane: 1, prevLane: 1, laneD: -99, x: 0, vx: 0, y: 0, vy: 0, camY: 0, ground: true, fast: false,
    slide: 0, slideAge: 9, slideBuf: 0, jumpBuf: 0, coyote: 0, sq: 1, phase: 0, step: 0,
    mult: baseMult(), maxMult: 1, streak: 0, coins: 0, chain: 0, coinT: -9, score: 0,
    shield: false, shieldPop: 0, safe: 0, boost: 0, wob: 0, danger: 0, gullK: 0, edge: 0, kick: 0, speedTier: 0, closeT: -9,
    magnet: 0, spring: 0, x2: 0, glide: 0, hudT: 0,
    dead: false, deadT: 0, fell: false, spin: 0, cause: "",
    nextS: 0, nextPick: 520, pickN: randInt(0, 4), last: "", tierSeen: 1, gateS: 0, gatePassed: false, gateRight: 0, gateFlash: 0, gatesRight: 0, gatesTotal: 0,
    bestD: g.load("bestDist", 0), bestPassed: false, intro: firstRun ? 1 : 0.4, taught: g.load("taught", 0), hintJ: null, hintS: null, gustT: 0, gustDir: 0,
    wordI: wordStart % WORDS.length, got: 0, wordsDone: 0, lettersGot: 0, nextLetterS: 70, letterY: 1.25, wordPop: 0, pinX: null, sink: false,
    auto: S.auto || false, autoErr: S.autoErr ?? 0.06, autoSkill: S.autoSkill ?? 0.75, autoCd: 0, autoWant: 1,
  });
  S.forced.length = 0;
  Object.assign(S.st, { coins: 0, jumps: 0, slides: 0, arches: 0, close: 0, high: 0, power: 0, dist: 0 });
  S.pk.on = false;
  for (const o of obs) o.on = false;
  for (const c of coins) c.on = false;
  for (const l of letters) l.on = false;
  for (const w of words) { w.sp.visible = false; w.life = 0; w.stick = false; }
  P.life.fill(0);
  paintWord();
  trail = curTrail();
  setLook(curLook().c);
  layIntro();
  setGate(382);
  lay();
}

// ---------- the answer gate ----------
function setGate(s) {
  S.gateS = s; S.gatePassed = false;
  const level = S.gatesTotal < 4 ? 1 : S.gatesTotal < 10 ? 2 : 3;
  const p = math.problem({ topic: "quick", level });
  const wrong = p.choices.filter((c) => !p.check(c));
  const right = randInt(0, 2);
  const answers = [0, 1, 2].map((i) => (i === right ? p.answer : wrong[i > right ? i - 1 : i]));
  if (answers.filter((a) => p.check(a)).length !== 1) answers[right] = p.answer; // checked: exactly one right arch
  S.gateRight = right; S.gateText = p.text; S.gateAnswers = answers; S.gateAnswer = p.answer;
  S.autoWant = Math.random() < S.autoSkill ? right : (right + randInt(1, 2)) % 3;
  gate.board.draw(p.text, { bg: "#1e3a8a", fg: "#ffffff", edge: "#fbbf24", size: 0.66 });
  answers.forEach((a, i) => { gate.labels[i].draw(String(a), { bg: "#ffffff", fg: "#0f172a", edge: ARCH_COL[i], size: 0.7 }); gate.arches[i].material.color.set(ARCH_COL[i]); });
}

// ---------- level generator ----------
function layIntro() {
  // No scripted lesson: coins to chase for about seven seconds, then random patterns.
  const A = randInt(0, 2), B = other(A);
  coinLine(A, 14, 6); coinSwerve(A, B, 25.5, 4); coinLine(B, 33, 8); coinSwerve(B, 1, 48, 3); coinLine(1, 54, 6);
  S.nextS = FIRST_S + rand(0, 8);
}
const PAT = {
  row2(s) { const f = randInt(0, 2); for (let l = 0; l < 3; l++) if (l !== f) add(block(), l, s); coinLine(f, s - 5, 6); return s + 2; },
  jumpRow(s, v, tier) {
    const c = tier > 2 && Math.random() < 0.5 ? randInt(0, 2) : -1;
    for (let l = 0; l < 3; l++) add(l === c ? "crate" : "barrier", l, l === c ? s - 0.85 : s);
    coinArc(c < 0 ? randInt(0, 2) : (c + randInt(1, 2)) % 3, s, v);
    return s + 1;
  },
  slideRow(s, v, tier) {
    const c = tier > 2 && Math.random() < 0.5 ? randInt(0, 2) : -1;
    for (let l = 0; l < 3; l++) add(l === c ? "cone" : "beam", l, l === c ? s - 0.65 : s);
    coinLine(c < 0 ? randInt(0, 2) : (c + randInt(1, 2)) % 3, s - 4, 5, 0.45);
    return s + 1;
  },
  mixRow(s, v) {
    const k = randInt(0, 2);
    add("barrier", k, s); coinArc(k, s, v);
    add("beam", (k + 1) % 3, s); coinLine((k + 1) % 3, s - 3, 4, 0.45);
    add("crate", (k + 2) % 3, s - 0.85);
    return s + 1;
  },
  zig(s, v) {
    let f = randInt(0, 2);
    const gp = Math.max(9.5, v * 0.55);
    for (let i = 0; i < 3; i++) {
      for (let l = 0; l < 3; l++) if (l !== f) add(block(), l, s + i * gp);
      coinLine(f, s + i * gp - 2.5, 3);
      const nf = other(f);
      if (i < 2) coinSwerve(f, nf, s + i * gp + 2.8, 3);
      f = nf;
    }
    return s + 2 * gp + 2;
  },
  truck(s, v) {
    const A = randInt(0, 2), B = other(A), C = 3 - A - B;
    add("ramp", A, s); add("truck", A, s + RAMP_L);
    for (let j = 0; j < 3; j++) coin(laneX(A), 0.9 + (TOP * (j + 0.5)) / 3, s + ((j + 0.5) * RAMP_L) / 3);
    coinLine(A, s + 6.5, 4, TOP + 0.8);
    if (Math.random() < 0.65) {
      add("tram", B, s + 12.5);
      coinSwerve(A, B, s + 12.6, 2, TOP + 0.8); coinLine(B, s + 16.5, 8, TOP + 0.8);
      for (let j = 0; j < 3; j++) coin(laneX(B), TOP + 0.5 - j * 0.6, s + 31.3 + j * 1.2);
      add("barrier", C, s + 9); add("barrier", C, s + 25); coinArc(C, s + 25, v);
      return s + 32;
    }
    add("crate", B, s + 9); add("barrier", C, s + 12);
    return s + 15;
  },
  scaf(s) {
    const A = randInt(0, 2), B = other(A), C = 3 - A - B;
    add("ramp", A, s); add("truck", A, s + RAMP_L); add("scaffold", A, s + 16.7); add("scaffold", A, s + 26);
    for (let j = 0; j < 3; j++) coin(laneX(A), 0.9 + (TOP * (j + 0.5)) / 3, s + ((j + 0.5) * RAMP_L) / 3);
    coinLine(A, s + 7, 4, TOP + 0.8); coin(laneX(A), TOP + 1.5, s + 15.6); coinLine(A, s + 17.6, 4, TOP + 0.8); coin(laneX(A), TOP + 1.5, s + 24.9); coinLine(A, s + 27, 4, TOP + 0.8);
    add("crate", B, s + 11); add("barrier", C, s + 11); add("beam", B, s + 24); add(block(), C, s + 24);
    return s + 33;
  },
  cart(s, v) {
    const A = randInt(0, 2), B = other(A), C = 3 - A - B;
    const o = add("cart", A, s + 36);
    if (o) o.flag = 8;
    add("barrier", B, s + 18); coinArc(B, s + 18, v); coinLine(C, s + 4, 8); coinLine(B, s + 26, 5);
    return s + 40;
  },
  holes(s, v) {
    const a = randInt(0, 2), b = randInt(0, 2);
    add("hole", a, s + 6, 4); coinArc(a, s + 8, v);
    for (let l = 0; l < 3; l++) if (l !== b) add("hole", l, s + 23, 4.5);
    coinArc((b + 1) % 3, s + 25.2, v); coinLine(b, s + 20, 5);
    for (let l = 0; l < 3; l++) { add("hole", l, s + 44, 4.5); coinArc(l, s + 46.2, v); }
    return s + 50;
  },
  flock(s) {
    const f = Math.random() < 0.4 ? -1 : randInt(0, 2);
    for (let l = 0; l < 3; l++) if (l !== f) add("flock", l, s, 4);
    coinLine(f < 0 ? 1 : f, s - 2, 5, f < 0 ? 0.45 : 0.8);
    return s + 4;
  },
  wind(s) {
    for (let i = 0; i < 3; i++) {
      add("gust", Math.random() < 0.5 ? 0 : 2, s + 14 + i * 30, 0);
      add("crate", randInt(0, 2), s + 28 + i * 30);
      coinLine(1, s + 3 + i * 30, 5);
    }
    return s + 90;
  },
  rest(s) {
    const l = randInt(0, 2), m = other(l);
    coinLine(l, s, 6); coinSwerve(l, m, s + 10.5, 4); coinLine(m, s + 18, 5);
    if (s >= S.nextPick && !S.pk.on) {
      const order = ["shield", "spring", "glider", "x2", "magnet"];
      S.pk.on = true; S.pk.type = order[S.pickN++ % 5]; S.pk.lane = m; S.pk.s = s + 29;
      S.nextPick = s + rand(240, 330);
      return s + 32;
    }
    return s + 27;
  },
};
const LEN = { row2: 3, jumpRow: 2, slideRow: 2, mixRow: 2, zig: 40, truck: 33, scaf: 34, cart: 41, holes: 51, flock: 5, wind: 91, rest: 33 };
const POOL = {
  2: ["row2", "row2", "jumpRow", "jumpRow", "slideRow", "slideRow", "mixRow", "zig", "zig", "truck", "truck"],
  3: ["row2", "jumpRow", "slideRow", "mixRow", "mixRow", "zig", "truck", "cart", "cart", "flock", "flock", "scaf", "scaf", "rest"],
  4: ["row2", "jumpRow", "slideRow", "mixRow", "mixRow", "zig", "zig", "truck", "cart", "cart", "flock", "scaf", "scaf", "holes", "holes", "wind", "rest"],
};
const NEW = { 2: ["truck"], 3: ["cart", "flock", "scaf"], 4: ["holes", "wind"] };
/** Put the next letter tile at s, and plan the one after it 6 to 10 seconds of running later. */
function letter(s, v) {
  for (let i = 0; i < NLET; i++) {
    const l = letters[i];
    if (l.on) continue;
    l.on = true; l.s = s; l.lane = randInt(0, 2);
    S.nextLetterS = Math.max(S.nextLetterS, s - v * 2) + v * rand(6, 9.5);
    return true;
  }
  return false;
}
function lay() {
  let guard = 0;
  while (S.nextS < S.dist + HORIZON && guard++ < 10) {
    const s = S.nextS, v = vAt(s);
    const room = S.gateS - 48 - s;
    if (s < S.gateS + 20 && room < 3) {
      const a = Math.max(s, S.gateS - 40);
      for (let l = 0; l < 3; l++) coinLine(l, a + l * 1.1, 9, 0.8, 3.6);
      if (a + 3 >= S.nextLetterS) letter(a + 3, v);
      S.nextS = S.gateS + 22; continue;
    }
    const tier = s < TIER3 ? 2 : s < TIER4 ? 3 : 4;
    if (tier > S.tierSeen) { S.tierSeen = tier; for (const n of NEW[tier]) S.forced.push(n); }
    let name = "";
    if (s >= S.nextPick && !S.pk.on) name = "rest";
    else if (S.forced.length) name = S.forced[0];
    else { const pool = POOL[tier]; for (let i = 0; i < 6 && (!name || name === S.last); i++) name = pool[randInt(0, pool.length - 1)]; }
    if (s < S.gateS && LEN[name] > room) name = S.last === "row2" ? "jumpRow" : "row2";
    else if (S.forced.length && name === S.forced[0]) S.forced.shift();
    S.last = name;
    const end = PAT[name](s, v, tier);
    const diff = clamp(s / 1400, 0, 1);
    let gap = Math.max(GAP_MIN, v * lerp(GAP_A, GAP_B, diff)) + rand(0, 4); // random spacing too, so no two runs line up
    if (end >= S.nextLetterS && letter(end + gap * 0.5 + 2.5, v)) gap += 5; // a little room around a letter
    S.nextS = end + gap;
  }
}

// ---------- events ----------
function die(o) {
  if (S.dead) return;
  S.dead = true; S.deadT = 0.22; S.slide = 0;
  music.stop();
  sfx.play("crash");
  g.shake(16, 0.35); g.hitstop(0.07);
  puff(S.x, S.y + 0.8, -0.3, 22, "#ffffff", 5, 0.14);
  if (!S.fell) { S.vy = 7; S.ground = false; }
  S.cause = o ? o.kind : S.fell ? "fell" : "caught";
  S.causeAt = `${S.cause} in ${S.last} at ${Math.round(S.dist)} m`;
}
function popShield() {
  S.shield = false; S.shieldPop = 0.4; S.safe = 0.7;
  sfx.play("hit"); sfx.play("pop"); g.shake(8, 0.25); g.hitstop(0.05);
  say("Shield!", S.x, S.y + 2.2, S.dist, "#a5f3fc", 1, 0.7);
  puff(S.x, S.y + 0.9, -0.5, 18, "#8be9ff", 4.5, 0.12);
  g.setHud("Shield", null);
}
/** A side bump or a soft hit: forgiven once, the Sweeper closes in, a second one soon after ends the run. Returns true if the run goes on. */
function stumble(soft) {
  if (S.safe > 0) return true;
  if (S.shield) { popShield(); return true; }
  if (S.danger > 0) { say("Caught!", S.x, S.y + 2.2, S.dist, "#fca5a5", 1.2, 0.8); die(null); return false; }
  S.danger = 5; S.wob = 0.9; S.speed *= 0.8;
  sfx.play("hit"); g.shake(8, 0.25);
  say(soft ? "Feathers!" : "Oof!", S.x, S.y + 2.2, S.dist, "#fca5a5", 1, 0.7);
  puff(S.x, S.y + 0.9, -0.2, 10, soft ? "#ffffff" : "#fca5a5", 3.5, 0.1);
  return true;
}
/** Head-on hit. Returns true if the run goes on. */
function crash(o) {
  if (S.safe > 0 || S.shield) {
    if (S.safe <= 0) popShield();
    o.fly = 0.7; o.fx = S.x >= laneX(o.lane) ? -1 : 1;
    return true;
  }
  die(o);
  return false;
}
function sideHeight(lane) {
  let h = 0;
  const d = S.dist;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.on || o.fly > 0 || o.lane !== lane) continue;
    const t = o.K.t;
    if (t === T.SOLID) { if (d + 0.7 > o.s0 && d - 0.5 < o.s1 && o.K.top > h) h = o.K.top; }
    else if (t === T.RAMP && d > o.s0 && d < o.s1) h = Math.max(h, (TOP * (d - o.s0)) / RAMP_L);
  }
  return h;
}
function tryLane(dir) {
  const nl = S.lane + dir;
  if (nl < 0 || nl > 2) { S.edge = dir * 0.5; sfx.play("tick"); return; }
  S.prevLane = S.lane; S.lane = nl; S.laneD = S.dist;
  sfx.noise(0.12, { freq: 1800 + S.speed * 60, type: "bandpass", vol: 0.3 });
  if (S.ground) puff(S.x, S.y + 0.08, 0.1, 3, trail.c[0], 1.4, 0.07, 0.3);
}
const PNAME = { magnet: "Magnet", spring: "Spring shoes", x2: "Double score", glider: "Glider", shield: "Shield" };
function grab(type) {
  S.st.power++;
  sfx.play("power"); g.hitstop(0.04);
  puff(S.x, S.y + 1, -0.4, 16, PICK_COL[type], 4.5, 0.12);
  say(PNAME[type], S.x, S.y + 2.4, S.dist + 1, "#ffffff", 1.2, 1.1);
  if (type === "magnet") S.magnet = 9;
  else if (type === "spring") S.spring = 9;
  else if (type === "x2") S.x2 = 10;
  else if (type === "shield") { S.shield = true; g.setHud("Shield", "on"); }
  else {
    S.glide = 8; S.ground = false; S.slide = 0; S.vy = 0; S.fast = false;
    let l = S.lane, n = 0;
    const end = S.dist + S.speed * 1.15 * 7.3;
    for (let s = S.dist + 14; s < end; s += 1.9) {
      if (++n % 7 === 0) l = l === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
      coin(laneX(l), FLY_Y + 0.7, s);
    }
  }
  S.hudT = 0;
}
function endGlide() {
  S.vy = 0; S.safe = 1.3;
  const far = S.dist + S.speed * 1.7 + 8;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.on || o.s0 > far || o.s1 < S.dist - 2) continue;
    const t = o.K.t;
    if (t === T.HOLE || t === T.GUST || t === T.FLOCK) o.on = false;
    else if (t !== T.RAMP && t !== T.OPEN && !(t === T.SOLID && o.K.len > 5)) { o.fly = 0.7; o.fx = o.lane === 0 ? -1 : o.lane === 2 ? 1 : Math.random() < 0.5 ? -1 : 1; }
  }
}
function near(o) {
  const t = o.K.t;
  let close = false;
  if (o.lane === S.lane) {
    if (t === T.HURDLE) close = !S.ground && S.y < 1.05;
    else if (t === T.OVER) close = S.slide > 0 && S.slideAge < 0.2;
  } else if (t === T.SOLID && o.lane === S.prevLane && S.laneD <= o.s0 + 0.5 && o.s0 - S.laneD < S.speed * 0.26) close = true;
  if (!close || S.t - S.closeT < 0.8) return;
  S.closeT = S.t; S.st.close++;
  S.score += 25 * S.mult;
  say("Close!", S.x, S.y + 2.3, S.dist, "#fde047", 1.25, 0.7);
  sfx.tone(1175, 0.09, { type: "square", vol: 0.3 }); sfx.tone(1568, 0.14, { type: "square", vol: 0.3, delay: 0.07 });
  g.slowmo(0.4, 0.16);
  puff(S.x, S.y + 0.9, 0, 8, "#fde047", 3, 0.09);
}
function finish() {
  const dist = Math.round(S.dist), score = Math.round(S.score) + S.coins * 5;
  const record = dist > S.bestD;
  if (record) g.save("bestDist", dist);
  g.addCoins(S.coins);
  S.st.coins = S.coins; S.st.dist = dist; S.st.arches = S.gatesRight; S.st.high = Math.round(S.st.high);
  let xp = Math.round(dist / 25) + Math.round(S.coins / 3) + S.gatesRight * 5 + S.wordsDone * 15 + S.lettersGot;
  const lines = [`${dist} m, ${S.coins} coins, top multiplier x${S.maxMult}`];
  if (S.wordsDone) lines.push(S.wordsDone === 1 ? "You spelled a word: +15 xp" : `You spelled ${S.wordsDone} words: +${S.wordsDone * 15} xp`);
  for (let i = 0; i < meta.m.length; i++) {
    const m = meta.m[i], need = mNeed(m);
    m.have = m.id === "dist" ? Math.max(m.have, dist) : m.have + (S.st[m.id] || 0);
    if (m.have >= need) {
      lines.push(`Mission done: ${mText(m)}`);
      xp += 20; meta.done++; meta.tier[m.id] = (meta.tier[m.id] || 0) + 1;
      let id = m.id;
      for (let k = 0; k < MORDER.length; k++) { id = MORDER[meta.next++ % MORDER.length]; if (!meta.m.some((q) => q.id === id)) break; }
      meta.m[i] = { id, have: 0 };
    } else lines.push(`${mText(m)} (${Math.min(m.have, need)}/${need})`);
  }
  g.save("meta", meta);
  g.addXp(xp);
  firstRun = false;
  wordEl.style.display = "none";
  g.over({ score, title: S.fell ? "Splash!" : record && S.bestD > 0 ? "New record" : "Bumped", lines });
}

g.onPause = (paused) => { if (paused) music.stop(); else if (!S.dead) music.start(false); };
g.onStart = () => {
  if (posterOn) g.stage.style.setProperty("--ak-aspect", String(16 / 9));
  posterOn = false;
  showProps();
  wordStart = (g.load("word", -1) + 1) % WORDS.length; // a new word every run
  g.save("word", wordStart);
  reset();
  wordEl.style.display = "flex";
  music.start(true);
  g.setScore(0);
  g.setHud("Coins", 0);
  g.setHud("Multiplier", "x" + S.mult);
  for (const n of ["Shield", "Magnet", "Springs", "Double", "Glider"]) g.setHud(n, null);
};

// ---------- autopilot (testing): plays like an average player ----------
const TH = { dz: 0, act: 0, o: null };
function hasRamp(o) { for (let i = 0; i < obs.length; i++) { const r = obs[i]; if (r.on && r.K.t === T.RAMP && r.lane === o.lane && Math.abs(r.s1 - o.s0) < 0.6 && r.s1 > S.dist) return true; } return false; }
function threat(l) {
  let best = 1e9, act = 0, bo = null;
  const d = S.dist;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.on || o.fly > 0 || o.lane !== l || o.s1 < d - 0.3) continue;
    const t = o.K.t;
    if (t === T.GUST || t === T.RAMP || t === T.OPEN) continue;
    if (t === T.SOLID && (S.y >= o.K.top - 0.45 || hasRamp(o))) continue;
    let dz = o.s0 - d;
    if (o.flag & 8) dz -= (Math.max(0, Math.min(dz, 62)) * 7) / (S.speed + 7);
    if (dz < best) { best = dz; act = t === T.HURDLE || t === T.HOLE ? 1 : t === T.SOLID ? 3 : 2; bo = o; }
  }
  TH.dz = best; TH.act = act; TH.o = bo;
}
function pilot(dt) {
  S.autoCd -= dt;
  const v = S.speed;
  threat(S.lane);
  const dz = TH.dz, act = TH.act, o = TH.o;
  let moved = false;
  if (o && !(o.flag & 32)) { o.flag |= 32; if (Math.random() < S.autoErr) o.flag |= 64; }
  if (o && !(o.flag & 64) && S.glide <= 0) {
    if (act === 1 && S.ground && dz > -1 && dz < (o.K.t === T.HOLE ? 0.9 : v * 0.2)) IN.U = true;
    else if (act === 2 && S.slide <= 0 && dz > -4 && dz < v * 0.22) IN.D = true;
    else if (act === 3 && dz < v * 0.6 && S.autoCd <= 0) {
      let pickDir = 0, bestDz = v * 0.9;
      for (let dir = -1; dir <= 1; dir += 2) {
        const c = S.lane + dir;
        if (c < 0 || c > 2 || sideHeight(c) > S.y + 0.5) continue;
        threat(c);
        const far = TH.act === 3 ? TH.dz : 999;
        if (far > bestDz) { bestDz = far; pickDir = dir; }
      }
      if (!pickDir && S.lane !== 1 && dz > 2 && sideHeight(1) <= S.y + 0.5) { threat(2 - S.lane); if (TH.act !== 3 || TH.dz > v * 0.9) pickDir = 1 - S.lane; }
      if (pickDir) { pickDir < 0 ? (IN.L = true) : (IN.R = true); S.autoCd = 0.14; moved = true; }
      else if (o.kind === "crate" && S.ground && dz < v * 0.24) IN.U = true;
    }
  }
  let want = !S.gatePassed && S.gateS - S.dist < 42 ? S.autoWant : -1;
  if (want < 0) for (let i = 0; i < NLET; i++) { const l = letters[i]; if (l.on && l.s - S.dist > 0 && l.s - S.dist < v * 0.9) want = l.lane; }
  if (!moved && want >= 0 && want !== S.lane && S.autoCd <= 0 && !(act === 3 && dz < v * 0.6)) {
    const dir = Math.sign(want - S.lane), c = S.lane + dir;
    if (sideHeight(c) <= S.y + 0.5) { threat(c); if (TH.act !== 3 || TH.dz > v * 0.6) { dir < 0 ? (IN.L = true) : (IN.R = true); S.autoCd = 0.14; } }
  }
}

// ---------- update ----------
function update(dt) {
  for (let i = 0; i < words.length; i++) { const w = words[i]; if (w.life > 0 && !w.stick) { w.t += dt; if (w.t >= w.life) { w.life = 0; w.sp.visible = false; } } }
  if (S.dead) {
    S.deadT -= dt;
    S.speed = damp(S.speed, 0, 9, dt);
    S.dist += S.speed * dt * 0.4;
    S.vy -= GRAV * dt; S.y += S.vy * dt;
    if (!S.fell && S.y < 0) S.y = 0;
    S.spin += dt * 14;
    stepParticles(dt);
    if (S.deadT <= 0) finish();
    return;
  }
  S.t += dt;
  if (S.intro > 0) S.intro = Math.max(0, S.intro - dt / 0.55);
  // ----- input -----
  const k = g.keys;
  IN.L = k.pressed("ArrowLeft", "KeyA"); IN.R = k.pressed("ArrowRight", "KeyD");
  IN.U = k.pressed("ArrowUp", "KeyW", "Space"); IN.D = k.pressed("ArrowDown", "KeyS");
  const p = g.pointer;
  if (p.pressed) { swipe.x = p.x; swipe.y = p.y; swipe.used = false; }
  if (p.down && !swipe.used) {
    const dx = p.x - swipe.x, dy = (p.y - swipe.y) * 0.5625;
    if (Math.abs(dx) > 0.035 || Math.abs(dy) > 0.035) {
      swipe.used = true;
      if (Math.abs(dx) > Math.abs(dy)) dx > 0 ? (IN.R = true) : (IN.L = true);
      else dy > 0 ? (IN.D = true) : (IN.U = true);
    }
  }
  if (p.released && !swipe.used) { IN.U = true; swipe.used = true; }
  if (S.auto) pilot(dt);
  if (IN.L) tryLane(-1);
  if (IN.R) tryLane(1);
  if (S.dead) return;
  if (IN.U) S.jumpBuf = 0.15;
  S.jumpBuf -= dt;
  if (S.jumpBuf > 0 && (S.ground || S.coyote > 0) && S.glide <= 0) {
    S.vy = S.spring > 0 ? SPRING_V : JUMP_V; S.ground = false; S.coyote = 0; S.slide = 0; S.jumpBuf = 0; S.sq = 1.25; S.fast = false; S.sink = false;
    S.st.jumps++;
    sfx.play("jump");
    if (S.spring > 0) sfx.play("bounce");
    puff(S.x, S.y + 0.08, 0.1, 5, trail.c[0], 1.8, 0.08, 0.4);
    if (S.hintJ && !(S.taught & 1)) { S.taught |= 1; g.save("taught", S.taught); }
  }
  if (IN.D && S.glide <= 0) {
    if (S.ground) { S.slide = SLIDE_T; S.slideAge = 0; S.st.slides++; }
    else { S.fast = true; S.vy = Math.min(S.vy, -20); S.slideBuf = 0.35; }
    sfx.noise(0.2, { freq: 900, type: "bandpass", vol: 0.4 });
    if (S.hintS && !(S.taught & 2)) { S.taught |= 2; g.save("taught", S.taught); }
  }
  if (S.slide > 0) { S.slide -= dt; S.slideAge += dt; }
  S.slideBuf -= dt;

  // ----- timers and speed -----
  if (S.boost > 0) S.boost -= dt;
  if (S.wob > 0) S.wob -= dt;
  if (S.danger > 0) S.danger -= dt;
  if (S.safe > 0) S.safe -= dt;
  if (S.shieldPop > 0) S.shieldPop -= dt;
  if (S.gateFlash > 0) S.gateFlash -= dt;
  if (S.magnet > 0) S.magnet -= dt;
  if (S.spring > 0) S.spring -= dt;
  if (S.x2 > 0) S.x2 -= dt;
  S.kick = Math.max(0, S.kick - dt * 1.6);
  S.edge = damp(S.edge, 0, 10, dt);
  S.gullK = damp(S.gullK, (S.danger > 0 || S.t < 3.4) && S.glide <= 0 ? 1 : 0, S.t < 3.4 ? 9 : 4, dt);
  if (S.gullK > 0.5 && (sirenT -= dt) <= 0) { sirenT = 0.42; sfx.tone(S.danger > 0 ? 880 : 660, 0.16, { type: "square", vol: 0.12, slide: S.danger > 0 ? 660 : 520 }); }
  S.base = V0 + V1 * smooth(clamp(S.t / RAMP_T, 0, 1)) + clamp((S.t - 90) * 0.03, 0, 6);
  const tierK = Math.floor((S.base - V0) / 2.6);
  if (tierK > S.speedTier) {
    S.speedTier = tierK; S.kick = 1;
    if (S.gateS - S.dist > 125 || S.gatePassed) say("Faster!", 0, 3.4, S.dist + 8, "#ffffff", 1.4, 0.9);
    sfx.tone(392, 0.1, { type: "square", vol: 0.25 }); sfx.tone(587, 0.16, { type: "square", vol: 0.25, delay: 0.08 });
  }
  const target = S.base * (S.boost > 0 ? 1.3 : 1) * (S.wob > 0 ? 0.78 : 1) * (S.glide > 0 ? 1.15 : 1);
  S.speed = damp(S.speed, target, S.t < 1 ? 8 : 4, dt);
  music.tick((S.speed - 13) / 15, sfx.muted);
  const ds = S.speed * dt;
  S.dist += ds;
  S.score += ds * S.mult * (S.x2 > 0 ? 2 : 1);
  const d = S.dist, ln = S.lane;
  const tx = laneX(ln) + S.edge * 0.5, px = S.x;
  S.x = damp(S.x, tx, 30, dt);
  if (Math.abs(S.x - tx) < 0.004) S.x = tx;
  if (S.pinX != null) S.x = S.pinX; // hit test only
  S.vx = (S.x - px) / dt;

  // ----- obstacles -----
  let floor = 0, hole = false, hit = null;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.on) continue;
    if (o.fly > 0) { o.fly -= dt; if (o.fly <= 0) o.on = false; continue; }
    if (o.flag & 8 && o.s0 - d < 62) {
      if (!(o.flag & 16)) { o.flag |= 16; sfx.tone(466, 0.14, { type: "square", vol: 0.3 }); sfx.tone(466, 0.2, { type: "square", vol: 0.3, delay: 0.2 }); }
      o.s0 -= 7 * dt; o.s1 -= 7 * dt;
    }
    if (o.s1 < d - 16) { o.on = false; continue; }
    const K = o.K, t = K.t;
    if (t === T.GUST) {
      if (!(o.flag & 2) && d > o.s0 - S.speed * 0.8) {
        o.flag |= 2; S.gustT = 1.3; S.gustDir = o.lane === 0 ? -1 : 1;
        say(S.gustDir < 0 ? "<< Gust" : "Gust >>", 0, 3.3, d + 7, "#e0f2fe", 1.4, 1.0);
        sfx.noise(0.9, { freq: 700, type: "bandpass", vol: 0.5 });
      }
      if (d > o.s0) {
        o.on = false;
        const nl = ln + (o.lane === 0 ? -1 : 1);
        if (S.glide <= 0 && nl >= 0 && nl <= 2 && sideHeight(nl) <= S.y + 0.5) { S.prevLane = nl; S.lane = nl; S.laneD = -99; }
      }
      continue;
    }
    if (!(o.flag & 1) && d > o.s0 + 0.5) { o.flag |= 1; if (S.glide <= 0) near(o); }
    // from here on it is about touching: Archie's real x against the obstacle's drawn width
    if (S.glide > 0) continue;
    const ox = laneX(o.lane), reach = K.hw + AW, adx = Math.abs(S.x - ox);
    if (adx >= reach) continue;
    const touch = adx < reach - EASE;
    if (t === T.HURDLE) { if (touch && Math.abs(o.s0 - d) < 0.42 && S.y < 0.5) hit = o; }
    else if (t === T.OVER) { if (touch && Math.abs(o.s0 - d) < 0.42 && S.slide <= 0 && S.y < 1.9) hit = o; }
    else if (t === T.FLOCK) {
      if (touch && d > o.s0 + 0.3 && d < o.s1 + 0.1 && S.slide <= 0 && S.y < 1.7 && !(o.flag & 2)) { o.flag |= 2; if (!stumble(true)) return; }
    } else if (t === T.RAMP) {
      if (d >= o.s0 && d <= o.s1 + 0.3) { const h = TOP * clamp((d - o.s0) / RAMP_L, 0, 1); if (S.y >= h - 0.6 && h > floor) floor = h; }
    } else if (t === T.HOLE) { if (adx < K.hw - 0.2 && d > o.s0 + 0.3 && d < o.s1 - 0.3) hole = true; }
    else if (d >= o.s0 - 0.35 && d <= o.s1 + 0.35) {
      const zin = K.zin || 0;
      if (S.y >= K.top - 0.45) { if (K.top > floor) floor = K.top; }
      else if (t === T.SOLID && touch && d + 0.3 >= o.s0 + zin && d < o.s1 - zin) {
        if (Math.abs(px - ox) >= reach - EASE) {
          // came in from the side: a bump. Archie bounces back to the lane he came from.
          const sg = px >= ox ? 1 : -1;
          S.x = ox + sg * (reach - EASE + 0.02); S.vx = 0; S.edge = sg * 0.5;
          S.lane = clamp(o.lane + sg, 0, 2); S.prevLane = S.lane;
          if (!stumble(false)) return;
        } else hit = o;
      }
    }
  }
  if (hit && !crash(hit)) return;

  // ----- up and down -----
  if (S.glide > 0) {
    S.glide -= dt;
    S.y = damp(S.y, FLY_Y + Math.sin(S.t * 2.2) * 0.25, 4, dt);
    if (S.glide <= 0) endGlide();
  } else if (S.ground) {
    if (hole && floor === 0 && S.y < 0.05) { S.ground = false; S.vy = 0; S.coyote = 0.1; S.sink = true; }
    else if (floor >= S.y || S.y - floor < 0.5) S.y = floor;
    else { S.ground = false; S.vy = 0; S.coyote = 0.11; }
    if (S.y > 1.5) S.st.high += ds;
  } else {
    S.coyote -= dt;
    S.vy -= (S.fast || Math.abs(S.vy) > 2.4 ? GRAV : GRAV * 0.5) * dt;
    S.y += S.vy * dt;
    // stepped into open deck and did not jump in time: Archie goes down, even if the far edge comes up first
    if (S.sink && S.coyote <= 0 && S.y < 0) { floor = 0; hole = true; S.fast = true; }
    if (S.vy <= 0 && S.y <= floor && !(hole && floor === 0)) {
      S.sink = false;
      S.y = floor; S.vy = 0; S.ground = true; S.sq = 0.68; S.fast = false;
      sfx.play("land");
      puff(S.x, S.y + 0.08, 0.1, 6, trail.c[0], 1.8, 0.08, 0.4);
      if (S.slideBuf > 0) { S.slide = SLIDE_T; S.slideAge = 0; S.st.slides++; }
    } else if (S.y < -0.7) { if (!fall()) return; }
  }
  S.camY = damp(S.camY, S.y, 6, dt);
  S.sq = damp(S.sq, 1, 12, dt);
  // footsteps and trail
  if (S.ground && S.slide <= 0) {
    S.phase += dt * (7 + S.speed * 0.42);
    const st = Math.floor(S.phase / Math.PI);
    if (st !== S.step) {
      S.step = st;
      sfx.noise(0.04, { freq: st % 2 ? 380 : 460, vol: 0.2 });
      if (trail.id !== "dust") spark(S.x + rand(-0.2, 0.2), S.y + 0.12, 0.25, rand(-0.5, 0.5), rand(0.6, 1.6), -S.speed * 0.55, trail.c[st % trail.c.length], trail.id === "bubble" ? 0.13 : 0.1, 0.55, trail.id === "bubble" ? -2 : 4);
    }
  } else if (trail.id !== "dust" || S.glide > 0) {
    if ((S.step = (S.step + 1) % 3) === 0) spark(S.x + rand(-0.25, 0.25), S.y + 0.5, 0.3, 0, rand(-0.4, 0.4), -S.speed * 0.5, S.glide > 0 ? "#99f6e4" : trail.c[randInt(0, trail.c.length - 1)], 0.1, 0.5, 0);
  }
  if (S.gustT > 0) {
    S.gustT -= dt;
    spark(-S.gustDir * 7, rand(0.4, 4), rand(-14, 2), S.gustDir * rand(16, 24), 0, -S.speed, "#ffffff", 0.07, 0.6, 0);
  }

  // ----- coins -----
  const py = S.y + 0.7, mag = S.magnet > 0;
  for (let i = 0; i < NCOIN; i++) {
    const c = coins[i];
    if (!c.on) continue;
    let dz = c.s - d;
    if (dz < -6) { c.on = false; continue; }
    if (mag && dz < 15) { c.x = damp(c.x, S.x, 9, dt); c.y = damp(c.y, py, 9, dt); if (dz > 0.4) { c.s -= 9 * dt; dz = c.s - d; } }
    if (Math.abs(dz) < 1.0 && Math.abs(c.x - S.x) < 1.05 && Math.abs(c.y - py) < 1.25) {
      c.on = false;
      S.coins += S.x2 > 0 ? 2 : 1;
      S.chain = S.t - S.coinT < 0.5 ? S.chain + 1 : 0;
      S.coinT = S.t;
      sfx.tone(660 * 2 ** (Math.min(S.chain, 17) / 12), 0.09, { type: "square", vol: 0.2 });
      puff(c.x, c.y, -dz, 3, "#ffe27a", 2, 0.07, 1);
      g.setHud("Coins", S.coins);
    }
  }
  // ----- pickup -----
  if (S.pk.on) {
    const dz = S.pk.s - d;
    if (dz < -6) S.pk.on = false;
    else if (Math.abs(dz) < 1.1 && Math.abs(laneX(S.pk.lane) - S.x) < 1.0 && S.y < 2.4) { S.pk.on = false; grab(S.pk.type); }
  }
  // ----- letters: grab them in order to spell the word -----
  S.letterY = damp(S.letterY, S.glide > 0 ? FLY_Y + 0.7 : 1.25, 5, dt);
  if (S.wordPop > 0) S.wordPop -= dt;
  for (let i = 0; i < NLET; i++) {
    const l = letters[i];
    if (!l.on) continue;
    const dz = l.s - d;
    if (dz < -5) { l.on = false; continue; } // missed: the same letter is on the next tile
    if (Math.abs(dz) < 1.1 && Math.abs(laneX(l.lane) - S.x) < 1.0 && Math.abs(S.letterY - py) < 1.7) { l.on = false; gotLetter(l); }
  }
  // ----- the answer gate: run or fly through, the lane decides -----
  if (!S.gatePassed && d >= S.gateS) {
    const ln = S.lane;
    S.gatePassed = true; S.gatesTotal++;
    const ok = ln === S.gateRight;
    S.gateFlash = 0.6;
    gate.arches[ln].material.color.set(ok ? "#34d399" : "#f87171");
    if (ok) {
      S.streak++; S.gatesRight++;
      S.mult = Math.min(9, S.mult + 1); S.maxMult = Math.max(S.maxMult, S.mult);
      S.boost = 2.4; S.kick = 1;
      say(`Right! x${S.mult}`, S.x, S.y + 2.5, d + 2, "#bbf7d0", 1.5, 1.1);
      const f = 523 * 2 ** (Math.min(S.streak - 1, 8) / 6);
      sfx.tone(f, 0.1, { vol: 0.5 }); sfx.tone(f * 1.26, 0.1, { vol: 0.5, delay: 0.08 }); sfx.tone(f * 1.5, 0.12, { vol: 0.5, delay: 0.16 }); sfx.tone(f * 2, 0.24, { vol: 0.5, delay: 0.24 });
      puff(S.x, S.y + 1.2, -1, 28, "#ffd84a", 6, 0.14, 3);
      coinLine(ln, S.gateS + 4, 10, S.glide > 0 ? FLY_Y + 0.7 : 0.8, 1.6);
    } else {
      S.streak = 0; S.mult = Math.max(baseMult(), S.mult - 1); S.wob = 0.8;
      say(`It was ${S.gateAnswer}`, S.x, S.y + 2.5, d + 2, "#fecaca", 1.3, 1.2);
      sfx.play("wrong");
      g.shake(6, 0.25);
      puff(S.x, S.y + 1, -0.5, 10, "#f87171", 3, 0.1);
    }
    g.setHud("Multiplier", "x" + S.mult);
  }
  if (S.gatePassed && d > S.gateS + 14) setGate(Math.max(d + clamp(S.base * 21, 290, 520), S.nextS + 52));
  // ----- your best distance -----
  if (!S.bestPassed && S.bestD > 80 && d > S.bestD) {
    S.bestPassed = true;
    say("New best!", 0, 3.6, d + 4, "#fde047", 1.6, 1.3);
    sfx.play("correct");
    puff(-2, 3, -2, 16, "#fde047", 5, 0.13, 2); puff(2, 3, -2, 16, "#f472b6", 5, 0.13, 2);
  }
  if (S.hintJ && (S.taught & 1 || d > 172)) { S.hintJ.life = 0; S.hintJ.stick = false; S.hintJ.sp.visible = false; S.hintJ = null; }
  if (S.hintS && (S.taught & 2 || d > 200)) { S.hintS.life = 0; S.hintS.stick = false; S.hintS.sp.visible = false; S.hintS = null; }
  lay();
  stepParticles(dt);
  // ----- HUD (a few times a second) -----
  S.hudT -= dt;
  if (S.hudT <= 0) {
    S.hudT = 0.2;
    g.setScore(Math.round(S.score) + S.coins * 5);
    g.setHud("Magnet", S.magnet > 0 ? Math.ceil(S.magnet) : null);
    g.setHud("Springs", S.spring > 0 ? Math.ceil(S.spring) : null);
    g.setHud("Double", S.x2 > 0 ? Math.ceil(S.x2) : null);
    g.setHud("Glider", S.glide > 0 ? Math.ceil(S.glide) : null);
  }
}
function gotLetter(l) {
  const word = WORDS[S.wordI], ch = word[S.got];
  S.got++; S.lettersGot++;
  S.score += 20 * S.mult;
  const f = 523 * 2 ** ([0, 2, 4, 5, 7, 9, 11, 12][Math.min(S.got - 1, 7)] / 12);
  sfx.tone(f, 0.1, { type: "triangle", vol: 0.6 }); sfx.tone(f * 2, 0.16, { type: "triangle", vol: 0.5, delay: 0.06 });
  puff(laneX(l.lane), S.letterY, -0.3, 10, "#fde68a", 3.5, 0.11, 2);
  if (S.got < word.length) { say(ch, S.x, S.y + 2.3, S.dist + 1, "#fde047", 1.2, 0.6); paintWord(); return; }
  // the whole word: coin shower, one multiplier step, bonus xp at the end of the run
  S.wordsDone++; S.wordPop = 1.2;
  S.mult = Math.min(9, S.mult + 1); S.maxMult = Math.max(S.maxMult, S.mult);
  S.score += 250 * S.mult;
  g.setHud("Multiplier", "x" + S.mult);
  say(word + "!", 0, 4.0, S.dist + 12, "#fde047", 1.25, 1.5);
  [523, 659, 784, 1047, 1319].forEach((q, i) => sfx.tone(q, i === 4 ? 0.3 : 0.11, { type: "square", vol: 0.4, delay: i * 0.075 }));
  g.slowmo(0.5, 0.2); g.hitstop(0.04);
  puff(S.x - 1.4, S.y + 2.2, -1, 18, "#ffd84a", 6, 0.14, 3); puff(S.x + 1.4, S.y + 2.2, -1, 18, "#f472b6", 6, 0.14, 3);
  const base = S.glide > 0 ? FLY_Y : 0;
  for (let j = 0; j < 36; j++) coin(laneX(j % 3) + rand(-0.5, 0.5), base + rand(2.2, 6.5), S.dist + 5 + j * 0.8);
  S.magnet = Math.max(S.magnet, 3.2); // the shower pours into Archie
  S.wordI = (S.wordI + 1) % WORDS.length; S.got = 0;
  paintWord();
}
/** Dropped through a gap. Returns true if a shield bounced Archie back up. */
function fall() {
  if (S.shield || S.safe > 0) {
    if (S.shield && S.safe <= 0) popShield();
    S.y = Math.max(S.y, 0.05); S.vy = 12; S.ground = false; S.fast = false; S.sink = false;
    sfx.play("bounce");
    return true;
  }
  S.fell = true; S.ground = false; S.vy = Math.min(S.vy, -3);
  die(null);
  S.deadT = 0.3;
  return false;
}
function stepParticles(dt) {
  for (let i = 0; i < NP; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    P.vy[i] -= P.grav[i] * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += (P.vz[i] + S.speed) * dt;
  }
}

// ---------- render ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _one = new THREE.Vector3(1, 1, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const BIRDS = [[-0.6, 0.1, 1.2], [0.5, 0.35, 0.5], [-0.2, -0.1, -0.3], [0.65, 0.05, -1.1], [-0.7, 0.3, -1.6]];
const axisY = (dc) => CAM_Y - (2.3 / 12.4) * dc;
const POSTER = { cam: [1.7, 1.3, -5.6], look: [-0.55, 2.45, 0], fov: 44 };
function render() {
  const t = menuT + S.t, d = S.dist;
  const title = posterOn ? 0 : smooth(S.intro);
  deckTex.offset.y = (d / 8.8) % 1;
  const m = d % SPAN;
  for (let i = 0; i < 4; i++) spans[i].position.z = m - (i - 1) * SPAN;
  waterMat.uniforms.uTime.value = t;
  waterMat.uniforms.uScroll.value = d;

  // obstacles
  for (const k in KIND) KIND[k].n = 0;
  let nb = 0;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.on) continue;
    const K = o.K, zc = -((o.s0 + o.s1) / 2 - d);
    if (K.t === T.GUST) continue;
    if (K.t === T.FLOCK) {
      for (let b = 0; b < 5 && nb < 40; b++) {
        const B = BIRDS[b];
        let f = Math.sin(t * 15 + b * 1.7 + o.s0);
        if (Math.abs(f) < 0.2) f = f < 0 ? -0.2 : 0.2;
        const scat = o.flag & 2 ? 2.2 : 1;
        _p.set(laneX(o.lane) + B[0] * scat, 1.25 + B[1] * scat + Math.sin(t * 3 + b) * 0.1, zc + B[2]);
        _e.set(0, 0, Math.sin(t * 2 + b) * 0.2); _q.setFromEuler(_e); _s.set(1, f, 1);
        birdMesh.setMatrixAt(nb++, _m.compose(_p, _q, _s));
      }
      continue;
    }
    if (K.n >= K.cap) continue;
    if (o.fly > 0) {
      const f = 0.7 - o.fly;
      _p.set(laneX(o.lane) + o.fx * f * 9, f * 9 - f * f * 12, zc - f * 16);
      _e.set(f * 9, f * 5, f * 7); _q.setFromEuler(_e);
      K.mesh.setMatrixAt(K.n++, _m.compose(_p, _q, _one));
    } else {
      _q.identity();
      if (K.t === T.HOLE) { _p.set(laneX(o.lane), 0, zc); _s.set(1, 1, o.s1 - o.s0); }
      else {
        const pop = clamp((HORIZON - (o.s0 - d)) / 12 + 0.2, 0.2, 1);
        _p.set(laneX(o.lane), o.flag & 16 ? Math.abs(Math.sin(t * 18)) * 0.05 : 0, zc); _s.set(pop, pop, pop);
      }
      K.mesh.setMatrixAt(K.n++, _m.compose(_p, _q, _s));
    }
  }
  for (const k in KIND) { const K = KIND[k]; if (K.mesh) { K.mesh.count = K.n; K.mesh.instanceMatrix.needsUpdate = true; } }
  birdMesh.count = nb; birdMesh.instanceMatrix.needsUpdate = true;
  // coins
  let n = 0;
  for (let i = 0; i < NCOIN; i++) {
    const c = coins[i];
    if (!c.on) continue;
    _p.set(c.x, c.y + Math.sin(t * 4 + c.s) * 0.06, -(c.s - d));
    _e.set(0, t * 4 + c.s * 0.5, 0); _q.setFromEuler(_e);
    coinMesh.setMatrixAt(n++, _m.compose(_p, _q, _one));
  }
  coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true;
  // pickup
  pick.group.visible = S.pk.on;
  if (S.pk.on) {
    for (const k in pick.items) pick.items[k].visible = k === S.pk.type;
    pick.group.position.set(laneX(S.pk.lane), 1.15 + Math.sin(t * 3) * 0.12, -(S.pk.s - d));
    pick.items[S.pk.type].rotation.y = t * 2.4;
    pick.ring.rotation.set(t * 1.3, t * 1.9, 0);
    pick.ring.material.color.set(PICK_COL[S.pk.type]);
  }
  // letter tiles: the nearest one is the next letter you need, the ones behind it follow in order
  {
    const word = WORDS[S.wordI], nextWord = WORDS[(S.wordI + 1) % WORDS.length];
    for (let i = 0; i < NLET; i++) {
      const l = letters[i], sp = letterSprites[i];
      sp.visible = l.on && !posterOn && title < 0.5;
      if (!sp.visible) continue;
      let rank = 0;
      for (let j = 0; j < NLET; j++) if (letters[j].on && letters[j].s < l.s) rank++;
      const k = S.got + rank;
      setLetter(sp, k < word.length ? word[k] : nextWord[(k - word.length) % nextWord.length]);
      const pop = clamp((HORIZON - (l.s - d)) / 14, 0.2, 1) * (1.25 + Math.sin(t * 5 + i) * 0.06);
      sp.position.set(laneX(l.lane), S.letterY + Math.sin(t * 3 + i * 2) * 0.14, -(l.s - d));
      sp.scale.set(pop, pop, 1);
      sp.material.rotation = Math.sin(t * 2.4 + i) * 0.12;
    }
    if (S.wordPop > 0 || wordEl.dataset.pop) { wordEl.dataset.pop = S.wordPop > 0 ? "1" : ""; wordEl.style.transform = `scale(${1 + Math.max(0, S.wordPop) * 0.35})`; }
  }
  // particles
  _q.identity();
  for (let i = 0; i < NP; i++) {
    const a = P.life[i] > 0 ? (P.life[i] / P.max[i]) * P.size[i] : 0;
    _p.set(P.x[i], P.y[i], P.z[i]); _s.set(a, a, a);
    partMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  partMesh.count = NP; partMesh.instanceMatrix.needsUpdate = true;
  // words
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.life <= 0) continue;
    const k = w.stick ? 0.3 : w.t / w.life;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.1;
    w.sp.visible = !posterOn && title < 0.5;
    w.sp.position.set(w.x, w.y + (w.stick ? Math.sin(t * 4) * 0.12 : k * 0.9), -(w.s - d));
    w.sp.scale.set(3.6 * w.size * pop, 0.9 * w.size * pop, 1);
    w.sp.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
  }

  // gate: arches on the deck, labels and the sign scale up with distance so they read early
  const gz = -(S.gateS - d);
  gate.group.position.z = gz;
  gate.group.visible = !posterOn && gz < 12 && gz > -125;
  const dc = Math.max(1, CAM_Z - gz);
  const k = clamp(dc / REF, 1, 12);
  const far = k > 1.08;
  const ay = axisY(dc), ay0 = axisY(dc / k);
  for (let i = 0; i < 3; i++) {
    const pl = gate.planes[i];
    const pulse = S.gateFlash > 0 && S.gatePassed ? 1 + S.gateFlash * 0.3 : 1;
    pl.position.set(laneX(i) * k, ay + (4.1 - ay0) * k, 0.3);
    pl.scale.setScalar(k * pulse);
    pl.material.depthTest = !far;
  }
  const bp = gate.boardPlane;
  bp.position.set(0, ay + (6.4 + Math.sin(t * 2) * 0.06 - ay0) * k, 0.2);
  bp.scale.setScalar(k);
  bp.material.depthTest = !far;
  // best marker
  const bz = -(S.bestD - d);
  bestMark.group.visible = !posterOn && S.bestD > 80 && bz < 10 && bz > -200;
  if (bestMark.group.visible) {
    bestMark.group.position.z = bz;
    if (bestMark.shown !== S.bestD) { bestMark.shown = S.bestD; bestMark.lb.draw(`Beat ${S.bestD} m`, { bg: "#fef3c7", fg: "#1e3a8a", edge: "#f59e0b", size: 0.6 }); }
  }

  // Archie
  const run = S.phase;
  const rolling = S.slide > 0 && !S.dead;
  const flying = S.glide > 0;
  const idle = title > 0.5;
  const bob = idle ? Math.sin(t * 3.2) * 0.05 + 0.05 : S.ground && !rolling && !S.dead ? Math.abs(Math.sin(run)) * 0.13 : 0;
  root.position.set(S.x, S.y + bob, 0);
  root.visible = !(S.safe > 0 && S.shieldPop <= 0 && Math.sin(t * 40) > 0.3);
  const sq = rolling ? 0.62 : idle ? 1 + Math.sin(t * 3.2) * 0.03 : S.sq;
  const wide = 1 / Math.sqrt(sq);
  tilt.scale.set(wide, sq, wide);
  tilt.position.y = 0.62 * sq + (rolling ? 0.02 : 0);
  let rx = -0.2, rz = -S.vx * 0.03 + Math.sin(run) * 0.07;
  if (idle) { rx = 0; rz = Math.sin(t * 1.6) * 0.05; }
  else if (flying) { rx = -0.75; rz = -S.vx * 0.05; }
  else if (rolling) rx = -0.2 - (1 - S.slide / SLIDE_T) * Math.PI * 2;
  else if (!S.ground) rx = -0.1 - S.vy * 0.02;
  if (S.wob > 0) rz += Math.sin(t * 22) * 0.34 * S.wob;
  if (S.dead) { rx = S.spin; rz = S.spin * 0.4; }
  tilt.rotation.set(rx, 0, clamp(rz, -0.75, 0.75));
  archie.rotation.y = Math.PI * (1 - title) + (idle ? 0.3 : 0);
  const arms = archie.userData.arms;
  const air = (!S.ground || flying) && !S.dead;
  arms[0].rotation.x = idle ? 0.2 : air ? 2.6 : Math.sin(run) * 1.15;
  arms[1].rotation.x = idle ? 2.7 + Math.sin(t * 7) * 0.3 : air ? 2.6 : -Math.sin(run) * 1.15;
  arms[0].rotation.z = posterOn ? -2.5 : -0.35; arms[1].rotation.z = posterOn ? 2.5 : 0.35;
  if (posterOn) arms[0].rotation.x = arms[1].rotation.x = 0;
  wing.visible = flying;
  if (flying) wing.rotation.set(-0.1, 0, -S.vx * 0.05);
  springs.visible = S.spring > 0 && !flying;
  shield.visible = S.shield || S.shieldPop > 0;
  if (shield.visible) {
    const pop = S.shieldPop > 0 ? 1 + (0.4 - S.shieldPop) * 3 : 1 + Math.sin(t * 5) * 0.03;
    shield.scale.setScalar(pop);
    shield.material.opacity = S.shieldPop > 0 ? S.shieldPop * 0.6 : 0.24;
    shieldRing.material.opacity = S.shieldPop > 0 ? S.shieldPop * 2 : 0.85;
    shieldRing.rotation.set(t * 1.7, t * 2.3, 0);
  }
  // the Sweeper is right behind Archie at the start and after a stumble, and drops back when the run is clean
  gull.group.visible = false;
  chaser.visible = S.gullK > 0.02 && !posterOn;
  if (chaser.visible) {
    chaserX = lerp(chaserX, S.x + (S.x > 0.5 ? -1.7 : 1.7), 0.08); // beside and behind, so Archie stays in view
    const caught = S.dead && S.cause === "caught";
    const near = caught ? 0.7 : 3.0 - (S.danger > 0 ? (5 - S.danger) * 0.2 : 0);
    if (caught) chaserX = lerp(chaserX, S.x, 0.3);
    chaser.position.set(chaserX, Math.abs(Math.sin(t * 17)) * 0.05, lerp(10.5, near, S.gullK));
    chaser.rotation.set(Math.sin(t * 17) * 0.02, (S.x - chaserX) * 0.1, Math.sin(t * 8.5) * 0.03);
    chaserParts.roller.rotation.x = -t * 22;
    chaserParts.beacon.material.emissiveIntensity = Math.sin(t * 14) > 0 ? 1.6 : 0.15;
    const reach = S.danger > 0 ? 0.55 + Math.sin(t * 12) * 0.25 : 0.1 + Math.sin(t * 5) * 0.08;
    chaserParts.arms[0].rotation.x = reach; chaserParts.arms[1].rotation.x = reach * 0.8 + 0.05;
  }
  // speed lines
  const boost = clamp(S.boost / 0.5, 0, 1);
  const rush = posterOn ? 0 : Math.max(boost, clamp((S.speed - 19) / 9, 0, 0.7), S.kick);
  lineMesh.visible = rush > 0.02 && !S.dead && title < 0.1;
  if (lineMesh.visible) {
    lineMesh.material.opacity = 0.6 * rush;
    _q.identity();
    for (let i = 0; i < NL; i++) {
      const l = lineSeed[i];
      const z = 6 - ((l.o + t * 2.6) % 1) * 60;
      _p.set(Math.cos(l.a) * l.r, 2.4 + S.camY * 0.5 + Math.sin(l.a) * l.r * 0.7, z); _s.set(1, 1, l.len);
      lineMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    lineMesh.instanceMatrix.needsUpdate = true;
  }

  // camera: the title pose looks at Archie's face, then swings behind him
  let fov = 62 + boost * 8 + S.kick * 6 + clamp((S.speed - 12) / 15, 0, 1) * 5;
  _a.set(S.x * 0.55 + g.shakeX * 0.02, CAM_Y + S.camY * 0.55 + g.shakeY * 0.02, CAM_Z - boost * 0.5);
  _b.set(S.x * 0.4, 1.2 + S.camY * 0.5, -6);
  if (posterOn) { _a.set(POSTER.cam[0], POSTER.cam[1], POSTER.cam[2]); _b.set(POSTER.look[0], POSTER.look[1], POSTER.look[2]); fov = POSTER.fov; }
  else if (title > 0) {
    _p.set(1.5 + Math.sin(t * 0.5) * 0.15, 1.5, 4.3); _a.lerp(_p, title);
    _p.set(0, -0.35, 0); _b.lerp(_p, title);
    fov = lerp(fov, 50, title);
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.copy(_a);
  camera.lookAt(_b);
  renderer.render(scene, camera);
}

// ---------- title screen: look and trail pickers, and a gentle idle loop ----------
const BTN = "font:inherit;font-weight:800;font-size:clamp(11px,1.5cqw,16px);color:#1e3a8a;background:#fff;border:0;border-radius:99px;padding:.35em 1em;cursor:pointer;box-shadow:0 3px 0 rgb(15 23 42 / .35)";
let menuRaf = 0, menuLast = 0;
function menuTick(now) {
  menuRaf = 0;
  if (g.state !== "menu" || posterOn) return;
  if (!document.hidden && now - menuLast > 30) { menuT += Math.min(0.05, (now - menuLast) / 1000); menuLast = now; S.intro = 1; g.redraw(); }
  menuRaf = requestAnimationFrame(menuTick);
}
function buildMenu(el) {
  el.innerHTML = `<div style="display:flex;gap:.6em;justify-content:center;margin:.3em 0 .2em"><button type="button" data-k="look" style="${BTN}"></button><button type="button" data-k="trail" style="${BTN}"></button></div>`;
  const paint = () => {
    const nl = LOOKS.filter((l) => g.unlocked(l.id)).length, nt = TRAILS.filter((l) => g.unlocked(l.id)).length;
    el.querySelector("[data-k=look]").textContent = `Look: ${curLook().name} (${nl}/${LOOKS.length})`;
    el.querySelector("[data-k=trail]").textContent = `Trail: ${curTrail().name} (${nt}/${TRAILS.length})`;
  };
  paint();
  el.onclick = (e) => {
    const k = e.target.closest("button")?.dataset.k;
    if (!k) return;
    e.stopPropagation();
    const list = (k === "look" ? LOOKS : TRAILS).filter((l) => g.unlocked(l.id));
    const cur = k === "look" ? curLook() : curTrail();
    const nx = list[(list.indexOf(cur) + 1) % list.length];
    if (k === "look") { g.skin = nx.id; setLook(nx.c); } else { g.save("trail", nx.id); trail = nx; }
    sfx.play("click");
    paint();
    g.redraw();
  };
  if (!firstRun) { reset(); S.intro = 1; }
  wordEl.style.display = "none";
  if (!menuRaf) menuRaf = requestAnimationFrame(menuTick);
}

// ---------- poster: one composed hero shot, no HUD, no words ----------
function poster() {
  firstRun = false;
  reset();
  posterOn = true;
  for (const o of obs) o.on = false;
  for (const c of coins) c.on = false;
  for (const w of words) { w.life = 0; w.sp.visible = false; }
  S.pk.on = false; S.intro = 0; S.bestD = 0; S.gateS = 1e6;
  const d = (S.dist = 42 + SPAN * 3);
  S.lane = 1; S.x = 0; S.y = 1.25; S.vy = 3; S.ground = false; S.vx = 2.5; S.camY = 0; S.speed = 22; S.gullK = 1; S.danger = 3.4;
  add("barrier", 1, d + 0.7);
  coinLine(0, d - 1, 4, 0.8, 1.5); coin(-0.9, 2.5, d + 0.6); coin(-1.5, 2.1, d + 1.4); coinArc(2, d - 2.5, 12, 0.2);
  add("ramp", 0, d - 24); add("truck", 0, d - 24 + RAMP_L); coinLine(0, d - 16, 4, TOP + 0.8);
  add("tram", 2, d - 30); add("crate", 2, d - 7); add("cone", 1, d - 10); add("cart", 1, d - 22);
  S.pk.on = true; S.pk.type = "magnet"; S.pk.lane = 0; S.pk.s = d - 3.5;
  g.closePanel();
  hideProps();
  wordEl.style.display = "none";
  g.stage.style.setProperty("--ak-aspect", String(innerWidth / innerHeight));
  g.redraw();
  setTimeout(() => g.redraw(), 150);
  return true;
}

reset();
// ---------- debug: sweep Archie past every obstacle kind and compare hits with the drawn shapes ----------
function hitTest() {
  const was = sfx.muted, auto = S.auto;
  sfx.setMuted(true); S.auto = false;
  const fails = [], table = {};
  const run = (kind, setup, label) => {
    reset();
    for (const o of obs) o.on = false;
    for (const c of coins) c.on = false;
    S.nextS = 1e9; S.gateS = 1e9; S.nextLetterS = 1e9; S.intro = 0; S.t = 6; S.speed = 16;
    const K = KIND[kind];
    const o = add(kind, 1, S.dist + 9, kind === "hole" ? 4 : undefined);
    const st = setup(o) || {};
    if (kind === "hole") o.s1 = o.s0 + 4;
    // the drawn shape: the real geometry's box (the cone is its body, radius 0.6 at the deck; birds reach about 1.0)
    let hw = K.hw, z0 = -(o.s1 - o.s0) / 2, z1 = (o.s1 - o.s0) / 2;
    if (K.geo && kind !== "hole") { K.geo.boundingBox || K.geo.computeBoundingBox(); const b = K.geo.boundingBox; hw = Math.max(-b.min.x, b.max.x); z0 = b.min.z; z1 = b.max.z; }
    if (kind === "cone") { hw = 0.6; z0 = -0.6; z1 = 0.6; }
    if (kind === "flock") hw = 1.0;
    let seen = false, hitAt = false;
    for (let f = 0; f < 110 && !hitAt; f++) {
      if (S.fell) hitAt = true;
      if (st.frame) st.frame(f, o);
      update(1 / 60);
      const zc = (o.s0 + o.s1) / 2 - S.dist; // obstacle centre ahead of Archie
      if (Math.abs(S.x - laneX(o.lane)) < hw + AW && zc + z1 > -0.47 && zc + z0 < 0.47) seen = true;
      if (S.dead || S.danger > 0) hitAt = true;
    }
    if (hitAt && !seen) fails.push(`${label}: hit but the shapes never touched`);
    return { hit: hitAt, seen };
  };
  // 1. static sweep: Archie held at a fixed x offset from the obstacle's centre
  const OFF = [0, 0.3, 0.6, 0.8, 1.0, 1.2, 1.35, 1.5, 1.8, 2.2];
  for (const kind in KIND) {
    const K = KIND[kind];
    const hits = K.t === T.HURDLE || K.t === T.OVER || K.t === T.SOLID || K.t === T.FLOCK || K.t === T.HOLE;
    table[kind] = "";
    for (const off of OFF) for (const sg of [-1, 1]) {
      if (off === 0 && sg < 0) continue;
      const r = run(kind, () => { S.pinX = sg * off; }, `${kind} at x ${sg * off}`);
      const deep = K.t === T.HOLE ? off < K.hw - 0.25 : off < K.hw + AW - EASE - 0.03;
      if (hits && deep && !r.hit) fails.push(`${kind} at x ${sg * off}: ran through it`);
      if (!hits && r.hit) fails.push(`${kind} at x ${sg * off}: this kind should never hit`);
      if (sg > 0) table[kind] += r.hit ? "X" : ".";
    }
  }
  // 2. swerves: start in the obstacle's lane and press right with less and less room
  const sw = {};
  for (const kind of ["cone", "crate", "barrier", "beam", "cart", "truck"]) {
    sw[kind] = "";
    for (const lead of [8, 4, 2, 1, 0, -1, -2, -4]) {
      const r = run(kind, () => ({ frame: (f) => { if (f === 31 - lead) tryLane(1); } }), `${kind} swerve ${lead} frames early`);
      sw[kind] += r.hit ? "X" : ".";
    }
  }
  // 3. side by side: running past each kind in the next lane, and changing lanes next to a cone, is always clean
  for (const kind in KIND) { const r = run(kind, () => { S.lane = 2; S.x = laneX(2); }, `${kind} from the next lane`); if (r.hit) fails.push(`${kind}: hit from the next lane`); }
  {
    const r = run("cone", (o) => { o.lane = 0; S.lane = 2; S.x = laneX(2); return { frame: (f) => { if (f === 28) tryLane(-1); } }; }, "cone: lane change beside it");
    if (r.hit) fails.push("cone: lane change into the lane beside it counted as a hit");
  }
  S.pinX = null; S.auto = auto;
  sfx.setMuted(was);
  reset();
  return { ok: fails.length === 0, fails, offsets: OFF, static: table, swerve: sw };
}
g.debug = {
  hitTest, music: music.info, letters, WORDS,
  S, obs, coins, KIND, PAT, meta, poster, POSTER, add,
  auto(on = true, err = 0.06, skill = 0.75) { S.auto = on; S.autoErr = err; S.autoSkill = skill; return on; },
  pick(right = true) { S.lane = right ? S.gateRight : (S.gateRight + 1) % 3; },
  grab(type) { grab(type); return type; },
  force(name) { S.forced.push(name); return S.forced.length; },
  clear() { for (const o of obs) o.on = false; },
  info: () => ({ t: +S.t.toFixed(1), dist: Math.round(S.dist), speed: +S.speed.toFixed(1), lane: S.lane, y: +S.y.toFixed(2), mult: S.mult, coins: S.coins, shield: S.shield, dead: S.dead, cause: S.cause, danger: +S.danger.toFixed(1), gateIn: Math.round(S.gateS - S.dist), gate: S.gateText, answers: S.gateAnswers, right: S.gateRight, st: { ...S.st }, last: S.last, obstacles: obs.filter((o) => o.on).length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, xp: g.xp, state: g.state }),
};
hooks.onMenu = buildMenu;
g.loop(update, render);
if (g.menuExtra) buildMenu(g.menuExtra);
