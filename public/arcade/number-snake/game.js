// Number Snake: a crowded arena of snakes. Eat to grow, cut rivals off, feast on what they drop.
// The math is a bubble you steer at: the banner asks, the bubble with the answer makes you grow.
import { createGame, createFx, math, sfx, FONT, clamp, damp, rand, randInt, choose } from "../kit/kit.js";

const W = 960, H = 540, R = 1800, TAU = Math.PI * 2;
const SEG = 6, CAP = 512, MASK = CAP - 1, MAXN = 420;
const CELL = 90, GN = Math.ceil((2 * R) / CELL) + 2;
const NR = 14, PCAP = 2600, AMBIENT = 1300;
const BASE = 118, FAST = 225, DEAD = 34;
const LAPSE = 0.035, PBLIND = 0.5;
const NAMES = ["Maya", "Leo", "Nora", "Sam", "Ivy", "Omar", "Zoe", "Eli", "Ada", "Theo", "Lena", "Max", "Ruby", "Kai", "Nina", "Hugo", "Mila", "Owen", "Tess", "Jude", "Rosa", "Finn", "Cleo", "Abel"];
const HUES = [215, 90, 28, 50, 275, 4, 175, 330, 150, 300, 40, 195];
const ORB_RING = "#fde047", ORB_FILL = "#2563eb", ORB_COL = [ORB_FILL, ORB_FILL, ORB_FILL, ORB_FILL, ORB_FILL];
const START_LENS = [520, 360, 240, 160, 110, 85, 70, 58, 48, 40, 32, 26, 20, 14];
const POWER_NAME = ["", "Magnet", "Speed", "Ghost"], POWER_COL = ["", "#f472b6", "#fde047", "#a5f3fc"];
const SKINS = [
  { id: "racer", name: "Blue Racer", need: 0, a: "#3b82f6", b: "#bfdbfe", d: "#172554", pat: "solid", hat: "", trail: "", eyes: "round", pc: 0 },
  { id: "lime", name: "Lime Stripes", need: 40, a: "#84cc16", b: "#3f6212", d: "#1a2e05", pat: "stripes", hat: "", trail: "", eyes: "round", pc: 1 },
  { id: "sunset", name: "Sunset", need: 110, a: "#fb923c", b: "#ec4899", d: "#7c2d12", pat: "bands", hat: "", trail: "", eyes: "round", pc: 2 },
  { id: "bee", name: "Bumble", need: 200, a: "#facc15", b: "#1c1917", d: "#1c1917", pat: "stripes", hat: "antenna", trail: "", eyes: "round", pc: 3 },
  { id: "party", name: "Party Hat", need: 320, a: "#8b5cf6", b: "#fde047", d: "#2e1065", pat: "dots", hat: "party", trail: "", eyes: "round", pc: 4 },
  { id: "ember", name: "Ember", need: 460, a: "#ef4444", b: "#fdba74", d: "#450a0a", pat: "spine", hat: "", trail: "spark", eyes: "angry", pc: 5 },
  { id: "googly", name: "Googly", need: 620, a: "#14b8a6", b: "#99f6e4", d: "#042f2e", pat: "solid", hat: "", trail: "", eyes: "googly", pc: 6 },
  { id: "gent", name: "Top Hat", need: 800, a: "#64748b", b: "#f8fafc", d: "#0f172a", pat: "spine", hat: "top", trail: "", eyes: "round", pc: 11 },
  { id: "candy", name: "Candy", need: 1000, a: "#f472b6", b: "#ffffff", d: "#831843", pat: "stripes", hat: "bow", trail: "star", eyes: "round", pc: 7 },
  { id: "ninja", name: "Ninja", need: 1250, a: "#334155", b: "#ef4444", d: "#020617", pat: "solid", hat: "band", trail: "", eyes: "angry", pc: 5 },
  { id: "rainbow", name: "Rainbow", need: 1550, a: "#f8fafc", b: "#ffffff", d: "#1e1b4b", pat: "rainbow", hat: "", trail: "dot", eyes: "round", pc: 9 },
  { id: "halo", name: "Golden Halo", need: 1900, a: "#f59e0b", b: "#fef3c7", d: "#451a03", pat: "dots", hat: "halo", trail: "star", eyes: "googly", pc: 10 },
];
const RAINBOW = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const NODASH = [];

const g = createGame({
  slug: "number-snake",
  title: "Number Snake",
  tagline: "Eat the right number. Grow the longest snake.",
  instant: true,
  controls: [{ keys: "Mouse or arrows", does: "Steer" }, { keys: "Hold click or Space", does: "Sprint" }],
  aspect: 16 / 9,
  bg: "#070b1a",
  onMenu: (el) => queueMicrotask(() => { paintSkins(el); if (player) { player.look = skinLook(); player.dashR = 0; clearOrbs(); } armAttract(); }),
});
g.unlocks(SKINS.map((s) => ({ id: s.id, name: s.name, need: s.need })));
const c = g.canvas2d(W, H);
const { ctx } = c;
g.touchButtons([{ code: "Space", label: "Sprint", side: "right" }]);
let touchMode = g.coarse;
const stick = { on: false, ax: 0, ay: 0, dx: 0, dy: 0 };
g.stage.addEventListener("pointerdown", (e) => { touchMode = e.pointerType === "touch" || e.pointerType === "pen"; }, true);
const fx = createFx(520);

// ---------- pooled world state ----------
const cellHead = new Int32Array(GN * GN), SEGMAX = (NR + 1) * (MAXN / 2 + 4);
const segNext = new Int32Array(SEGMAX), segX = new Float32Array(SEGMAX), segY = new Float32Array(SEGMAX), segOwner = new Uint8Array(SEGMAX), segI = new Int16Array(SEGMAX);
let segCount = 0;
const pHead = new Int32Array(GN * GN), pNext = new Int32Array(PCAP), pX = new Float32Array(PCAP), pY = new Float32Array(PCAP), pVX = new Float32Array(PCAP), pVY = new Float32Array(PCAP);
const pV = new Float32Array(PCAP), pTTL = new Float32Array(PCAP), pPh = new Float32Array(PCAP), pC = new Uint8Array(PCAP), pOn = new Uint8Array(PCAP), pFree = new Int32Array(PCAP);
let pFreeN = 0, pCount = 0, ambient = 0;
const snakes = [], rankArr = [], orbs = [], feed = [], fields = [], feasts = [];
const boardName = ["", "", "", "", "", ""], boardLen = ["", "", "", "", "", ""], boardRank = [0, 0, 0, 0, 0, 0], boardWho = [null, null, null, null, null, null];
let boardN = 0, rankN = 0, leader = null, playerRank = 15, lastRank = 99;
let player = null, T = 0, frame = 0;
const cam = { x: 0, y: 0, z: 1 };
let life = null, autoOn = false, simOn = false, posterOn = false, ctl = 1, deadT = -1, deathTitle = "", deathX = 0, deathY = 0, menuRespawn = 0;
let prob = null, probText = "", probRaw = "", probState = "off", probT = 0, probBorn = 0, probSeen = 0, flashT = 9, flashGood = true;
const callout = { txt: "", t: 9, col: "#fff" };
let rankT = 0, hudT = 0, tickCombo = 0, tickT = 0, tickLast = 0, powerCycle = 0;
let hintBoost = !g.load("boosted", false);
const stats = { deaths: 0, wall: 0, lapse: 0, hunted: 0, fast: 0, kfast: 0, flee: 0, young: 0, goal: [0,0,0,0,0,0], pgoal: [0,0,0,0,0,0], plapse: 0, pwall: 0 };

const ci = (v) => { const k = (((v + R) / CELL) | 0) + 1; return k < 0 ? 0 : k >= GN ? GN - 1 : k; };
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const bodyN = (len) => Math.min(MAXN, ((len <= 400 ? 46 + len * 2.5 : 1046 + (len - 400) * 0.7) / SEG) | 0);
const radius = (len) => 7 + Math.min(15, Math.sqrt(len) * 0.62);
const live = () => simOn || g.state === "playing";
const quiet = () => simOn || g.state !== "playing";
const inView = (x, y, m) => Math.abs(x - cam.x) < W / 2 / cam.z + m && Math.abs(y - cam.y) < H / 2 / cam.z + m;

// ---------- art that is drawn once ----------
function makeSprite(size, paint) { const k = document.createElement("canvas"); k.width = k.height = size; paint(k.getContext("2d"), size); return k; }
const pelSprite = HUES.map((h) => makeSprite(48, (x, s) => {
  const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `hsl(${h} 100% 92%)`); gr.addColorStop(0.28, `hsl(${h} 95% 66%)`); gr.addColorStop(0.42, `hsla(${h}, 95%, 58%, 0.42)`); gr.addColorStop(1, `hsla(${h}, 95%, 55%, 0)`);
  x.fillStyle = gr; x.fillRect(0, 0, s, s);
}));
const glowSprite = makeSprite(128, (x, s) => {
  const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, "rgba(255,255,255,0.75)"); gr.addColorStop(0.35, "rgba(255,255,255,0.28)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr; x.fillRect(0, 0, s, s);
});
const floor = ctx.createPattern(makeSprite(120, (x, s) => {
  x.fillStyle = "#0b1330"; x.fillRect(0, 0, s, s);
  x.strokeStyle = "rgba(96,125,220,0.13)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(s, 0); x.moveTo(0, 0); x.lineTo(0, s); x.moveTo(s / 2, s / 2 - 7); x.lineTo(s / 2, s / 2 + 7); x.moveTo(s / 2 - 7, s / 2); x.lineTo(s / 2 + 7, s / 2); x.stroke();
  x.fillStyle = "rgba(129,160,255,0.2)"; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.arc(s, 0, 4, 0, TAU); x.arc(0, s, 4, 0, TAU); x.arc(s, s, 4, 0, TAU); x.fill();
}), "repeat");

// ---------- snakes ----------
function skinLook() { return SKINS.find((s) => s.id === g.skin && g.unlocked(s.id)) || SKINS[0]; }
function rivalLook(i) {
  const k = 1 + (i % 11), h = HUES[k];
  return { a: `hsl(${h} 82% 56%)`, b: `hsl(${(h + 35) % 360} 95% 80%)`, d: `hsl(${h} 70% 17%)`, pat: choose(["solid", "stripes", "bands", "dots", "spine", "stripes"]),
    hat: Math.random() < 0.3 ? choose(["party", "top", "bow", "antenna"]) : "", trail: "", eyes: Math.random() < 0.15 ? "googly" : Math.random() < 0.15 ? "angry" : "round", pc: k };
}
function newSnake(id, isPlayer) {
  return { id, isPlayer, name: isPlayer ? "You" : "", look: null, x: 0, y: 0, ang: 0, w: 0, tAng: 0, len: 10, r: 9, n: 10, px: new Float32Array(CAP), py: new Float32Array(CAP), h: 0, acc: 0,
    alive: false, boost: false, fast: false, safe: 0, respawn: 0, kills: 0, power: 0, powerT: 0, pulses: new Float32Array(6).fill(-1), pulseT: 0, dropAcc: 0, trailT: 0,
    safeX: 0, born: 0, minx: 0, miny: 0, maxx: 0, maxy: 0, mouth: 0, eye: 0, dying: false, killer: -1, dash: [1, 1], dashR: 0,
    ai: { want: 0, wAng: 0, wT: 0, skill: 0.7, aggr: 0.5, greed: 0.5, side: 1, lapse: 0, mode: 0, target: -1, modeT: 0, grudge: -1, grudgeT: 0, boost: false, orb: -1, orbGo: 0, lvl: 2, said: false } };
}
function layPath(s, wave, wl) {
  const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
  s.h = 0; s.acc = 0;
  for (let i = 0; i < CAP; i++) {
    const t = (i + 1) * SEG, o = wave ? Math.sin(t / wl) * wave * Math.min(1, t / 60) : 0, k = (CAP - i) & MASK;
    s.px[k] = s.x - ca * t - sa * o; s.py[k] = s.y - sa * t + ca * o;
  }
}
function place(s, x, y, ang, len) {
  s.x = x; s.y = y; s.ang = s.tAng = ang; s.w = 0; s.len = len; s.r = radius(len); s.n = bodyN(len); s.alive = true; s.boost = s.fast = false; s.safe = 2; s.safeX = 0; s.born = T; s.power = 0; s.powerT = 0;
  s.dying = false; s.killer = -1; s.kills = 0; s.pulses.fill(-1); s.mouth = 0; s.dropAcc = 0; s.dashR = 0;
  s.ai.want = s.ai.wAng = ang; s.ai.mode = 0; s.ai.lapse = 0; s.ai.orb = -1; s.ai.said = false; s.ai.boost = false;
  layPath(s, 0, 1);
}
const spot = { x: 0, y: 0 };
// how many body points lie within `cells` grid cells of a spot (uses the last built grid)
function crowd(x, y, cells) {
  const cx = ci(x), cy = ci(y);
  let n = 0;
  for (let yy = Math.max(0, cy - cells); yy <= Math.min(GN - 1, cy + cells); yy++) for (let xx = Math.max(0, cx - cells); xx <= Math.min(GN - 1, cx + cells); xx++) for (let j = cellHead[xx + GN * yy]; j >= 0; j = segNext[j]) n++;
  return n;
}
function freeSpot(minHead, far) {
  let bx = 0, by = 0, bs = -1e9;
  for (let t = 0; t < 40; t++) {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * (R - 320), x = Math.cos(a) * d, y = Math.sin(a) * d;
    let m = 1e9;
    for (let i = 0; i < snakes.length; i++) { const o = snakes[i]; if (o.alive) m = Math.min(m, Math.hypot(o.x - x, o.y - y)); }
    const dc = Math.hypot(x - cam.x, y - cam.y);
    if (dc < far) continue;
    const cr = crowd(x, y, 1), sc = Math.min(m, minHead) - (dc > 1500 ? 200 : 0) - cr * 40;
    if (sc > bs) { bs = sc; bx = x; by = y; }
    if (m > minHead && dc < 1500 && !cr) break;
  }
  spot.x = bx; spot.y = by;
}
function spawnRival(s, len) {
  if (len == null) {
    let big = 0;
    for (let i = 1; i < snakes.length; i++) if (snakes[i].alive && snakes[i].len > big) big = snakes[i].len;
    const q = Math.random();
    len = big < 260 ? rand(240, 380) : q < 0.6 ? rand(12, 35) : q < 0.9 ? rand(40, 100) : rand(120, 220);
  }
  freeSpot(280, W / 2 / cam.z + 160);
  place(s, spot.x, spot.y, Math.atan2(-spot.y, -spot.x) + rand(-0.9, 0.9), len);
}
function spawnPlayer() {
  let bx = 0, by = 0, bs = -1e9;
  for (let t = 0; t < 40; t++) {
    const f = choose(fields), x = f.x * 0.7 + rand(-80, 80), y = f.y * 0.7 + rand(-80, 80);
    let m = 1e9;
    for (let i = 1; i < snakes.length; i++) { const o = snakes[i]; if (o.alive) m = Math.min(m, Math.hypot(o.x - x, o.y - y)); }
    const cr = crowd(x, y, 3);
    m = Math.min(m, 600) - cr * 30;
    if (m > bs) { bs = m; bx = x; by = y; }
    if (m > 420 && !cr) break;
  }
  place(player, bx, by, Math.atan2(-by, -bx) + rand(-0.6, 0.6), 10);
}

// ---------- pellets ----------
function addPellet(x, y, v, col, vx, vy, ttl) {
  if (!pFreeN) return -1;
  const d = Math.hypot(x, y);
  if (d > R - 20) { x *= (R - 20) / d; y *= (R - 20) / d; }
  const j = pFree[--pFreeN];
  pX[j] = x; pY[j] = y; pV[j] = v; pC[j] = col; pVX[j] = vx; pVY[j] = vy; pTTL[j] = ttl; pPh[j] = Math.random() * TAU; pOn[j] = 1;
  pCount++; if (!ttl) ambient++;
  return j;
}
function killPellet(j) { pOn[j] = 0; pFree[pFreeN++] = j; pCount--; if (!pTTL[j]) ambient--; }
function spawnAmbient() {
  let x, y;
  if (Math.random() < 0.72) { const f = choose(fields); x = f.x + (Math.random() + Math.random() - 1) * 240; y = f.y + (Math.random() + Math.random() - 1) * 240; }
  else { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * (R - 30); x = Math.cos(a) * d; y = Math.sin(a) * d; }
  addPellet(x, y, Math.random() < 0.15 ? 2 : 1, randInt(0, 11), 0, 0, 0);
}
function updatePellets(dt) {
  pHead.fill(-1);
  const lim = (R - 16) * (R - 16);
  for (let j = 0; j < PCAP; j++) {
    if (!pOn[j]) continue;
    if (pTTL[j] && T > pTTL[j]) { killPellet(j); continue; }
    if (pVX[j] !== 0 || pVY[j] !== 0) {
      pX[j] += pVX[j] * dt; pY[j] += pVY[j] * dt; pVX[j] *= 0.9; pVY[j] *= 0.9;
      if (Math.abs(pVX[j]) + Math.abs(pVY[j]) < 3) pVX[j] = pVY[j] = 0;
      const d2 = pX[j] * pX[j] + pY[j] * pY[j];
      if (d2 > lim) { const k = (R - 16) / Math.sqrt(d2); pX[j] *= k; pY[j] *= k; }
    }
    const cc = ci(pX[j]) + GN * ci(pY[j]);
    pNext[j] = pHead[cc]; pHead[cc] = j;
  }
}

// ---------- feed, callouts, sound ----------
function pushFeed(txt, col) {
  if (simOn) return;
  const f = feed.length < 5 ? { txt: "", t: 0, col: "" } : feed.shift();
  f.txt = txt; f.t = T; f.col = col || "#e2e8f0";
  feed.push(f);
}
function say(txt, col) { if (simOn) return; callout.txt = txt; callout.t = 0; callout.col = col || "#fff"; }
function chomp() {
  if (quiet()) return;
  tickCombo = T - tickT < 0.45 ? Math.min(26, tickCombo + 1) : 0; tickT = T;
  if (T - tickLast < 0.045) return;
  tickLast = T;
  sfx.tone(440 * Math.pow(2, tickCombo / 12), 0.05, { type: "triangle", vol: 0.32 });
}

// ---------- problems and orbs ----------
function clearOrbs() { for (let i = 0; i < orbs.length; i++) orbs[i].on = false; probState = "off"; }
function fizzOrbs() { for (let i = 0; i < orbs.length; i++) { const o = orbs[i]; if (o.on) { o.on = false; if (!simOn) fx.burst(o.x, o.y, { n: 8, color: ORB_COL[o.ci], speed: 140, gravity: 0, life: 0.4, size: 4 }); } } }
function placeOrb(o, a, d, fromHead) {
  const lead = fromHead ? 0 : 140;
  let x = player.x + Math.cos(player.ang) * lead + Math.cos(a) * d, y = player.y + Math.sin(player.ang) * lead + Math.sin(a) * d;
  const k = Math.hypot(x, y);
  if (k > R - 170) { x *= (R - 170) / k; y *= (R - 170) / k; }
  if (Math.hypot(x - player.x, y - player.y) < 200) { x = player.x - Math.cos(a) * 320; y = player.y - Math.sin(a) * 320; }
  o.x = x; o.y = y; o.vx = rand(-5, 5); o.vy = rand(-5, 5); o.born = T; o.on = true;
}
function newProblem() {
  const n = life ? life.correct : 0, len = player.len, tier = n < 3 ? ["quick", 1] : len < 260 ? ["quick", n < 7 ? 1 : 2] : len < 520 ? ["prealgebra", 1] : ["prealgebra", 2];
  let p = null;
  for (let t = 0; t < 14; t++) {
    p = math.problem({ topic: tier[0], level: tier[1] });
    if (p.text !== probRaw && p.choices.every((v) => String(v).length <= 4) && p.choices.filter((v) => p.check(v)).length === 1) break;
  }
  prob = p; probRaw = p.text; probText = p.text.includes("=") ? p.text : p.text + " = ?"; probState = "live"; probT = 45; probBorn = T; probSeen++;
  if (life) life.probs++;
  const first = !!life && life.probs <= 3;
  const wrong = p.choices.filter((v) => !p.check(v)), vals = [p.answer, wrong[0], wrong[1], p.answer, wrong[2]], base = rand(0, TAU);
  // the first problems of a life put one right bubble straight ahead and the wrong ones off to the sides
  const easyA = [0, 1.25, -1.25, Math.PI, 2.3], easyD = [300 - (life ? life.probs : 0) * 0, 400, 400, 520, 470];
  for (let i = 0; i < 5; i++) {
    const o = orbs[i];
    o.val = vals[i]; o.str = String(vals[i]); o.right = i === 0 || i === 3; o.ci = i;
    if (first) placeOrb(o, player.ang + easyA[i] + rand(-0.12, 0.12), easyD[i] + rand(-20, 20), true);
    else placeOrb(o, base + (i * TAU) / 5 + rand(-0.3, 0.3), i === 0 ? rand(330, 430) : rand(380, 640));
  }
  // the bubbles belong to the player: the others never take them
  for (let i = 0; i < snakes.length; i++) { const ai = snakes[i].ai, q = Math.random(); ai.orb = snakes[i].isPlayer ? (q < 0.8 ? 0 : q < 0.9 ? 1 : -1) : -1; ai.orbGo = T + rand(1.5, 3); }
  if (!quiet()) sfx.play("pop");
}
function eatOrb(s, o) {
  o.on = false;
  flashT = 0; flashGood = o.right;
  if (o.right) {
    const gain = Math.round(clamp(30 + s.len * 0.08, 30, 80));
    s.len += gain; life.correct++;
    probText = probRaw.includes("=") ? probRaw + ",  answer " + o.str : probRaw + " = " + o.str;
    fizzOrbs(); probState = "wait"; probT = 2.4;
    s.power = 1 + (powerCycle++ % 3); s.powerT = 4;
    for (let i = 0; i < 20; i++) { const a = rand(0, TAU), v = rand(160, 420); addPellet(o.x, o.y, 2, randInt(0, 11), Math.cos(a) * v, Math.sin(a) * v, T + 25); }
    if (!simOn) {
      g.save("rights", g.load("rights", 0) + 1);
      fx.burst(o.x, o.y, { n: 30, colors: ["#fde047", "#fff", "#86efac"], speed: 380, gravity: 0, life: 0.7, size: 6, shape: "star" });
      fx.ring(o.x, o.y, { color: "#86efac", radius: 150, life: 0.45, width: 10 }); fx.ring(o.x, o.y, { color: "#fff", radius: 90, life: 0.3, width: 6 });
      fx.text(s.x, s.y - 34, POWER_NAME[s.power], { color: POWER_COL[s.power], size: 22 / cam.z, life: 1.1 });
      say(o.str + " is right! +" + gain, "#86efac");
      if (!quiet()) { sfx.play("correct"); sfx.play("power"); g.hitstop(0.06); g.shake(7, 0.25); }
    }
  } else {
    const loss = Math.round(Math.min(Math.max(0, s.len - 10), Math.max(3, s.len * 0.06)));
    s.len -= loss; life.wrong++;
    if (!simOn) {
      fx.burst(o.x, o.y, { n: 14, colors: ["#fca5a5", "#475569"], speed: 170, gravity: 0, life: 0.5, size: 5 }); fx.ring(o.x, o.y, { color: "#f87171", radius: 60, life: 0.3, width: 4 });
      say(o.str + " is not it", "#fca5a5");
      if (loss) fx.text(s.x, s.y - 34, "-" + loss, { color: "#fca5a5", size: 22 / cam.z, life: 0.9 });
      if (!quiet()) { sfx.play("wrong"); g.shake(4, 0.18); }
    }
  }
}

// ---------- brains ----------
function huntable() {
  if (!live() || !life || life.t < 40) return false;
  let n = 0;
  for (let i = 1; i < snakes.length; i++) if (snakes[i].alive && snakes[i].ai.mode && snakes[i].ai.target === 0) n++;
  return n < (player.len < 120 ? 1 : 2);
}
function think(s) {
  const ai = s.ai, full = ai.lvl === 2;
  let want = ai.wAng, boost = false, goal = 0;
  if (ai.lapse <= 0 && Math.random() < (1 - ai.skill) * LAPSE) ai.lapse = rand(0.25, 0.65);
  let threat = null, td = 1e9, prey = null, pd = 1e9;
  for (let i = 0; i < snakes.length; i++) {
    const o = snakes[i];
    if (o === s || !o.alive) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (o.len > s.len * 1.15 && d < td) { td = d; threat = o; }
    if (d < pd && o.safe <= 0 && d < 340 && (!o.isPlayer || huntable())) { pd = d; prey = o; }
  }
  if (threat && td < 60 + threat.r * 2.5) {
    const toMe = Math.atan2(s.y - threat.y, s.x - threat.x);
    if (Math.abs(angDiff(threat.ang, toMe)) < 0.7) { want = toMe + ai.side * 0.7; boost = td < 90 && s.len > 40 && ai.skill > 0.75; goal = 1; ai.mode = 0; }
  }
  if (!goal && full) {
    let t = ai.mode ? snakes[ai.target] : null;
    if (t && (!t.alive || ai.modeT <= 0 || t.safe > 0 || Math.hypot(t.x - s.x, t.y - s.y) > 560)) { ai.mode = 0; t = null; }
    if (!t) {
      const q = ai.grudge >= 0 && ai.grudgeT > 0 ? snakes[ai.grudge] : null;
      if (q && q !== s && s.len > 30 && T - s.born > 6 && q.alive && q.safe <= 0 && Math.hypot(q.x - s.x, q.y - s.y) < 620 && (!q.isPlayer || huntable())) {
        t = q; ai.mode = 1; ai.modeT = 6; ai.target = q.id;
        if (q.isPlayer && !ai.said) { ai.said = true; pushFeed(s.name + " wants revenge", "#fca5a5"); }
      } else if (prey && s.len > 25 && Math.random() < ai.aggr * 0.05) { t = prey; ai.mode = s.len > prey.len * 2.5 && s.len > 150 ? 2 : 1; ai.modeT = rand(3, 6); ai.target = prey.id; }
    }
    if (t) {
      goal = 2;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (ai.mode === 2) want = Math.atan2(t.y - s.y, t.x - s.x) + ai.side * 1.2;
      else {
        const tc = Math.cos(t.ang), ts = Math.sin(t.ang), rx = s.x - t.x, ry = s.y - t.y, ahead = rx * tc + ry * ts, lat = -rx * ts + ry * tc;
        if (ahead > 70 + t.r * 2 && ahead < 320) want = Math.abs(lat) < 18 ? s.ang : t.ang + (lat > 0 ? -1.1 : 1.1);
        else { const lead = 150 + d * 0.9; want = Math.atan2(t.y + ts * lead - s.y, t.x + tc * lead - s.x); }
        boost = s.len > 25 && d < 320;
      }
    }
  }
  if (!goal && full) {
    for (let i = 0; i < feasts.length; i++) {
      const f = feasts[i], d = Math.hypot(f.x - s.x, f.y - s.y);
      if (T - f.t < 6 && d < 650 && d > 60 && ai.greed > 0.3) { want = Math.atan2(f.y - s.y, f.x - s.x); boost = d > 200 && s.len > 30 && ai.greed > 0.6; goal = 3; break; }
    }
  }
  if (!goal && full && probState === "live" && ai.orb >= 0 && T > ai.orbGo) {
    const o = orbs[ai.orb];
    if (o.on) { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < 700) { want = Math.atan2(o.y - s.y, o.x - s.x); boost = !s.isPlayer && d > 160 && s.len > 40 && ai.greed > 0.55; goal = 4; } }
  }
  if (!goal && (full || !s.isPlayer)) {
    const cx = ci(s.x), cy = ci(s.y);
    let bs = 0, ba = 0;
    for (let yy = Math.max(0, cy - 2); yy <= Math.min(GN - 1, cy + 2); yy++) for (let xx = Math.max(0, cx - 2); xx <= Math.min(GN - 1, cx + 2); xx++) {
      for (let j = pHead[xx + GN * yy]; j >= 0; j = pNext[j]) {
        if (!pOn[j]) continue;
        const dx = pX[j] - s.x, dy = pY[j] - s.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 230) continue;
        const a = Math.atan2(dy, dx), turn = Math.abs(angDiff(a, s.ang));
        if (d < 55 && turn > 1.1) continue;
        const sc = ((pV[j] + 0.3) / (d + 30)) * (1 - turn * 0.24);
        if (sc > bs) { bs = sc; ba = a; }
      }
    }
    if (bs > 0) { want = ba; goal = 5; }
  }
  if (!goal) {
    ai.wT -= 0.1;
    if (ai.wT <= 0) {
      ai.wT = rand(1, 3);
      ai.wAng = Math.hypot(s.x, s.y) > R * 0.7 ? Math.atan2(-s.y, -s.x) + rand(-0.6, 0.6) : !s.isPlayer && player.alive && Math.random() < 0.5 && Math.hypot(player.x - s.x, player.y - s.y) > 800 ? Math.atan2(player.y - s.y, player.x - s.x) + rand(-0.5, 0.5) : s.ang + rand(-1, 1);
    }
    want = ai.wAng;
  }
  ai.want = want; ai.boost = boost; ai.goal = goal;
}
function clearDist(s, a, look) {
  const ca = Math.cos(a), sa = Math.sin(a), wall = (R - s.r - 10) * (R - s.r - 10);
  for (let d = 22; d <= look; d += 26) {
    const x = s.x + ca * d, y = s.y + sa * d;
    if (x * x + y * y > wall) return d;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === s || !o.alive || o.safe > 0) continue;
      const lead = (o.fast ? FAST : BASE) * (d / (s.fast ? FAST : BASE)), hx = o.x + Math.cos(o.ang) * lead - x, hy = o.y + Math.sin(o.ang) * lead - y, rr = (o.r + s.r + 8) * (o.isPlayer ? PBLIND : 1);
      if (hx * hx + hy * hy < rr * rr) return d;
    }
    const x0 = ci(x - 48), x1 = ci(x + 48), y0 = ci(y - 48), y1 = ci(y + 48);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      for (let j = cellHead[xx + GN * yy]; j >= 0; j = segNext[j]) {
        const id = segOwner[j];
        if (id === s.id) continue;
        const o = snakes[id];
        if (o.safe > 1) continue;
        let rr = o.r + s.r + 5;
        if (o.isPlayer) rr *= PBLIND;
        const dx = segX[j] - x, dy = segY[j] - y;
        if (dx * dx + dy * dy < rr * rr) return d;
      }
    }
  }
  return look + 1;
}
const OFFS = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4], ESC = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2];
function avoid(s) {
  const ai = s.ai;
  if (ai.lapse > 0) { s.tAng = ai.want; s.boost = ai.boost; return; }
  const look = (50 + s.r * 2.6 + (s.fast ? 55 : 0)) * (0.55 + 0.55 * ai.skill), half = look * 0.6;
  let k = 0;
  for (; k < 9; k++) {
    const a = ai.want + OFFS[k] * ai.side, turn = angDiff(a, s.ang);
    if (clearDist(s, a, look) <= look) continue;
    // the way there must be open too, or the turn itself runs into something
    if (Math.abs(turn) > 0.8 && clearDist(s, s.ang + turn * 0.5, half) <= half) continue;
    if (Math.abs(turn) > 1.7 && clearDist(s, s.ang + turn * 0.2, half) <= half) continue;
    s.tAng = a; s.boost = ai.boost && k === 0;
    return;
  }
  // boxed in: take the most open way out from where the head points now
  let bestA = s.ang, bestC = -1;
  for (let i = 0; i < 7; i++) { const a = s.ang + ESC[i] * ai.side, cl = clearDist(s, a, look) - Math.abs(ESC[i]) * 6; if (cl > bestC) { bestC = cl; bestA = a; } }
  s.tAng = bestA; s.boost = false;
  if (Math.random() < 0.1) ai.side = -ai.side;
}

// ---------- one step of the world ----------
// Where to head for a pointer at this spot of the screen. The head sits at the middle of the screen, so only the
// direction from the middle counts. Inside the dead zone the snake keeps its heading (no jitter).
function aimAt(sx, sy) {
  const dx = sx - W / 2, dy = sy - H / 2;
  return dx * dx + dy * dy < DEAD * DEAD ? null : Math.atan2(dy, dx);
}
function controlPlayer() {
  const p = player, ai = p.ai;
  if (live() && !autoOn) {
    const ptr = g.pointer, ax = g.keys.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]), ay = g.keys.axis(["ArrowUp", "KeyW"], ["ArrowDown", "KeyS"]);
    const sprint = g.keys.down("Space", "ShiftLeft", "ShiftRight");
    if (Math.abs(ptr.x - life.px) + Math.abs(ptr.y - life.py) > 0.004) { life.px = ptr.x; life.py = ptr.y; ctl = 1; life.input = true; }
    if (ax || ay) { ctl = 2; life.input = true; }
    if (ptr.down || sprint) life.input = true;
    if (touchMode && ptr.down) {
      // a stick wherever the thumb lands: drag away from that spot to steer
      if (!stick.on) { stick.on = true; stick.ax = ptr.x * W; stick.ay = ptr.y * H; ctl = 1; }
      stick.dx = ptr.x * W - stick.ax; stick.dy = ptr.y * H - stick.ay;
      const d = Math.hypot(stick.dx, stick.dy);
      if (d > 70) { stick.ax += (stick.dx / d) * (d - 70); stick.ay += (stick.dy / d) * (d - 70); stick.dx *= 70 / d; stick.dy *= 70 / d; }
    } else stick.on = false;
    if (life.input) {
      if (ctl === 2) { if (ax || ay) p.tAng = Math.atan2(ay, ax); }
      else if (touchMode) { if (stick.on && stick.dx * stick.dx + stick.dy * stick.dy > 144) p.tAng = Math.atan2(stick.dy, stick.dx); }
      else { const a = aimAt(ptr.x * W, ptr.y * H); if (a != null) p.tAng = a; }
      p.boost = sprint || (ptr.down && !touchMode);
      if (p.boost && p.len > 12 && hintBoost) { hintBoost = false; g.save("boosted", true); }
      return;
    }
    ai.lvl = 1;
    if (life.t < 8 && p.safe < 0.3) p.safe = 0.3; // still hands off: stay protected a little longer
  } else ai.lvl = 2;
  if (frame % 6 === 0) think(p);
  if (frame & 1) avoid(p);
  if (ai.lvl === 1) p.boost = false;
}
function camStep(dt) {
  let tx, ty, tz;
  // lead by exactly the lag of the camera, so the head rests on the middle of the screen
  if (player.alive) { const lead = (player.fast ? FAST : BASE) / 7; tx = player.x + Math.cos(player.ang) * lead; ty = player.y + Math.sin(player.ang) * lead; tz = clamp(1.04 - (player.r - 9) * 0.036, 0.52, 1) * (player.fast ? 0.95 : 1); }
  else if (g.state === "menu" && leader) { tx = leader.x; ty = leader.y; tz = 0.7; }
  else { tx = deathX; ty = deathY; tz = Math.min(cam.z, 0.72); }
  cam.x = damp(cam.x, tx, 7, dt); cam.y = damp(cam.y, ty, 7, dt); cam.z = damp(cam.z, tz, 1.8, dt);
}
function move(s, dt) {
  const free = s.power === 2;
  s.fast = free || (s.boost && s.len > 12);
  const speed = s.fast ? FAST : BASE, maxTurn = 7.2 / (1 + (s.r - 9) * 0.045);
  const tw = clamp(angDiff(s.tAng, s.ang) * 12, -maxTurn, maxTurn);
  s.w += (tw - s.w) * Math.min(1, dt * 24);
  s.ang += s.w * dt;
  const ca = Math.cos(s.ang), sa = Math.sin(s.ang), step = speed * dt;
  s.x += ca * step; s.y += sa * step; s.acc += step;
  while (s.acc >= SEG) { s.acc -= SEG; s.h = (s.h + 1) & MASK; s.px[s.h] = s.x - ca * s.acc; s.py[s.h] = s.y - sa * s.acc; }
  for (let i = 0; i < 6; i++) if (s.pulses[i] >= 0) { s.pulses[i] += 620 * dt; if (s.pulses[i] > s.n * SEG) s.pulses[i] = -1; }
  if (s.fast && !free) {
    s.len = Math.max(10, s.len - 4.5 * dt);
    s.dropAcc += dt;
    if (s.dropAcc > 0.22) { s.dropAcc = 0; const k = (s.h - s.n + 1 + CAP) & MASK; addPellet(s.px[k], s.py[k], 1, s.look.pc, 0, 0, T + 30); }
  }
  s.r = radius(s.len); s.n = bodyN(s.len);
  if (s.safe > 0 && (s.safe -= dt) <= 0 && s.safeX < 4 && tangled(s)) { s.safe = 0.25; s.safeX += 0.25; }
  if (s.powerT > 0 && (s.powerT -= dt) <= 0) s.power = 0;
  if (s.mouth > 0) s.mouth -= dt;
  const ai = s.ai;
  if (ai.lapse > 0) ai.lapse -= dt;
  if (ai.modeT > 0) ai.modeT -= dt;
  if (ai.grudgeT > 0) ai.grudgeT -= dt;
  s.eye = damp(s.eye, clamp(angDiff(s.tAng, s.ang), -1.1, 1.1), 12, dt);
  const d2 = s.x * s.x + s.y * s.y, lim = R - s.r;
  if (d2 > lim * lim) {
    if (s.safe > 0 || s.isPlayer) { const k = lim / Math.sqrt(d2); s.x *= k; s.y *= k; if (!s.isPlayer || !live() || autoOn || !life.input) s.tAng = Math.atan2(-s.y, -s.x); } // the wall never ends your run: you slide along it
    else { s.dying = true; s.killer = -1; }
  }
  if (!simOn && (s.fast || s.look.trail) && inView(s.x, s.y, 60)) {
    s.trailT -= dt;
    if (s.trailT <= 0) {
      s.trailT = 0.05;
      if (s.fast) fx.burst(s.x - ca * s.r, s.y - sa * s.r, { n: 1, angle: s.ang + Math.PI, spread: 1.1, speed: 150, life: 0.32, gravity: 0, size: 2.6 + s.r * 0.12, color: free ? "#fde047" : s.look.b, shape: "dot" });
      if (s.look.trail) { const k = (s.h - s.n + 2 + CAP) & MASK; fx.burst(s.px[k], s.py[k], { n: 1, speed: 30, life: 0.6, gravity: 0, size: 4, color: s.look.trail === "spark" ? "#fdba74" : s.look.b, shape: s.look.trail }); }
    }
  }
}
// true while this snake lies across another one: spawn protection holds until it is clear
function tangled(s) {
  for (let i = 0; i < snakes.length; i++) {
    const o = snakes[i];
    if (!o.alive) continue;
    const cx = ci(o.x), cy = ci(o.y);
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(GN - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(GN - 1, cx + 1); xx++) {
      for (let j = cellHead[xx + GN * yy]; j >= 0; j = segNext[j]) {
        const id = segOwner[j];
        if (o === s ? id === s.id : id !== s.id) continue;
        const rr = (o.r + snakes[id].r) * 1.5 + 10, dx = segX[j] - o.x, dy = segY[j] - o.y;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
  }
  return false;
}
function buildSegGrid() {
  cellHead.fill(-1); segCount = 0;
  for (let k = 0; k < snakes.length; k++) {
    const s = snakes[k];
    if (!s.alive) continue;
    let x0 = s.x, x1 = s.x, y0 = s.y, y1 = s.y;
    for (let i = s.h & 1; i < s.n; i += 2) {
      const q = (s.h - i + CAP) & MASK, x = s.px[q], y = s.py[q], cc = ci(x) + GN * ci(y), j = segCount++;
      segX[j] = x; segY[j] = y; segOwner[j] = s.id; segI[j] = i; segNext[j] = cellHead[cc]; cellHead[cc] = j;
      if (x < x0) x0 = x; else if (x > x1) x1 = x;
      if (y < y0) y0 = y; else if (y > y1) y1 = y;
    }
    s.minx = x0 - 30; s.maxx = x1 + 30; s.miny = y0 - 30; s.maxy = y1 + 30;
  }
}
function eat(s) {
  const magnet = s.power === 1, pull = magnet ? 240 : s.r + 30, eatR = s.r + 5, rng = magnet ? 3 : 1, force = magnet ? 560 : 420;
  const mx = s.x + Math.cos(s.ang) * s.r * 0.5, my = s.y + Math.sin(s.ang) * s.r * 0.5, cx = ci(mx), cy = ci(my);
  let got = 0;
  for (let yy = Math.max(0, cy - rng); yy <= Math.min(GN - 1, cy + rng); yy++) for (let xx = Math.max(0, cx - rng); xx <= Math.min(GN - 1, cx + rng); xx++) {
    for (let j = pHead[xx + GN * yy]; j >= 0; j = pNext[j]) {
      if (!pOn[j]) continue;
      const dx = mx - pX[j], dy = my - pY[j], d2 = dx * dx + dy * dy;
      if (d2 < eatR * eatR) { got += pV[j]; killPellet(j); }
      else if (d2 < pull * pull) { const d = Math.sqrt(d2); pVX[j] = (dx / d) * force; pVY[j] = (dy / d) * force; }
    }
  }
  if (got > 0) {
    s.len += got * (s.len < 60 ? 2 : s.len < 140 ? 1.4 : 1);
    s.mouth = 0.18;
    if (T - s.pulseT > 0.09) { s.pulseT = T; for (let i = 0; i < 6; i++) if (s.pulses[i] < 0) { s.pulses[i] = 0; break; } }
    if (s.isPlayer) chomp();
  }
  if (s.isPlayer && probState === "live" && life && live()) for (let i = 0; i < 5; i++) { const o = orbs[i]; if (o.on && Math.hypot(o.x - s.x, o.y - s.y) < s.r + 30) { eatOrb(s, o); break; } }
}
function hitCheck(s) {
  if (s.safe > 0 || s.power === 3) return;
  const cx = ci(s.x), cy = ci(s.y);
  for (let yy = Math.max(0, cy - 1); yy <= Math.min(GN - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(GN - 1, cx + 1); xx++) {
    for (let j = cellHead[xx + GN * yy]; j >= 0; j = segNext[j]) {
      const id = segOwner[j];
      if (id === s.id) continue;
      const o = snakes[id];
      if (o.safe > 0 || (segI[j] < 4 && s.len > o.len)) continue;
      const rr = s.isPlayer ? o.r * 0.74 + s.r * 0.18 : o.r * 0.9 + s.r * 0.45, dx = segX[j] - s.x, dy = segY[j] - s.y; // your head is smaller than it looks
      if (dx * dx + dy * dy < rr * rr) { s.dying = true; s.killer = id; s.hitI = segI[j]; return; }
    }
  }
}
function die(s) {
  const k = s.killer >= 0 ? snakes[s.killer] : null, n = s.n, L = s.look;
  const cnt = clamp((n / 2.2) | 0, 6, 110), v = Math.max(5, s.len * 0.35) / cnt;
  for (let i = 0; i < cnt; i++) {
    const q = (s.h - ((((i + Math.random()) * n) / cnt) | 0) + CAP) & MASK;
    addPellet(s.px[q] + rand(-s.r, s.r), s.py[q] + rand(-s.r, s.r), v, L.pc, rand(-50, 50), rand(-50, 50), T + rand(35, 50));
  }
  if (T - s.born < 4) stats.young++; if (!k) stats.wall++; if (s.ai.lapse > 0) stats.lapse++; if (k && k.ai.mode && k.ai.target === s.id) stats.hunted++; if (s.fast) stats.fast++; if (k && k.fast) stats.kfast++; stats.goal[s.ai.goal | 0]++;
  s.alive = false; s.dying = false; s.respawn = rand(2, 5); stats.deaths++;
  const f = feasts.length < 6 ? (feasts.push({ x: 0, y: 0, t: 0 }), feasts[feasts.length - 1]) : feasts[stats.deaths % 6];
  const mid = (s.h - (n >> 1) + CAP) & MASK;
  f.x = s.px[mid]; f.y = s.py[mid]; f.t = T;
  if (k) { k.kills++; if (!s.isPlayer && Math.random() < 0.5) { s.ai.grudge = k.id; s.ai.grudgeT = 30; } else s.ai.grudgeT = 0; }
  const mine = !!k && k.isPlayer, me = s.isPlayer;
  pushFeed(mine ? "You ate " + s.name : me ? (k ? k.name + " ate you" : "You hit the wall") : k ? k.name + " ate " + s.name : s.name + " hit the wall", mine ? "#fde047" : me ? "#fca5a5" : "#e2e8f0");
  if (!simOn && inView(s.x, s.y, 500)) {
    fx.burst(s.x, s.y, { n: 24, colors: [L.a, L.b, "#fff"], speed: 260 + s.r * 9, life: 0.7, gravity: 0, size: 5 + s.r * 0.2 });
    fx.ring(s.x, s.y, { color: "#fff", radius: 70 + s.r * 4, life: 0.4, width: 9 }); fx.ring(s.x, s.y, { color: L.a, radius: 40 + s.r * 3, life: 0.55, width: 6 });
    for (let i = 8; i < n; i += 16) { const q = (s.h - i + CAP) & MASK; fx.burst(s.px[q], s.py[q], { n: 3, color: L.a, speed: 130, gravity: 0, life: 0.5, size: 4 }); }
    if (!quiet()) {
      const prox = clamp(1 - Math.hypot(s.x - cam.x, s.y - cam.y) / (700 / cam.z), 0.15, 1);
      g.shake((3 + s.r * 0.55) * prox * (mine || me ? 1.7 : 1), 0.32);
      sfx.noise(0.3, { freq: 800, vol: 0.9 * prox }); sfx.tone(130, 0.25, { slide: 50, type: "sawtooth", vol: 0.4 * prox });
    }
  }
  if (mine && live()) {
    life.kills++;
    if (!simOn) {
      say("You ate " + s.name + "!", "#fde047");
      fx.text(player.x, player.y - 40, "+1 kill", { color: "#fde047", size: 24 / cam.z, life: 1 });
      if (!quiet()) { g.hitstop(0.08); g.slowmo(0.45, 0.3); sfx.tone(523, 0.12, { type: "square", vol: 0.3 }); sfx.tone(784, 0.12, { delay: 0.06, type: "square", vol: 0.3 }); sfx.tone(1047, 0.16, { delay: 0.12, type: "square", vol: 0.3 }); }
    }
  }
  if (me) {
    if (simOn) (stats.log ||= []).push([+(life ? life.t : 0).toFixed(1), s.ai.goal, s.ai.lapse > 0 ? 1 : 0, k ? s.hitI : -1, k ? +(k.len).toFixed(0) : 0, k && k.fast ? 1 : 0, k ? k.ai.mode : 0, k ? +angDiff(k.ang, s.ang).toFixed(1) : 0, s.fast ? 1 : 0, +(s.len).toFixed(0)].join("/"));
    stats.pgoal[s.ai.goal | 0]++; if (s.ai.lapse > 0) stats.plapse++; if (!k) stats.pwall++;
    deathX = s.x; deathY = s.y; clearOrbs();
    if (live()) {
      deathTitle = k ? k.name + " ate you" : "You hit the wall";
      deadT = 0.4;
      if (!quiet()) { sfx.play("crash"); g.shake(15, 0.5); g.slowmo(0.4, 0.25); }
    } else menuRespawn = 2;
  }
}
function updateRank() {
  rankN = 0;
  for (let i = 0; i < snakes.length; i++) if (snakes[i].alive) {
    const s = snakes[i];
    let j = rankN++;
    while (j > 0 && rankArr[j - 1].len < s.len) { rankArr[j] = rankArr[j - 1]; j--; }
    rankArr[j] = s;
  }
  leader = rankN ? rankArr[0] : null;
  playerRank = 0;
  if (player.alive) for (let i = 0; i < rankN; i++) if (rankArr[i] === player) { playerRank = i + 1; break; }
  boardN = 0;
  for (let i = 0; i < Math.min(5, rankN); i++) { boardWho[boardN] = rankArr[i]; boardRank[boardN] = i + 1; boardN++; }
  if (playerRank > 5) { boardWho[boardN] = player; boardRank[boardN] = playerRank; boardN++; }
  for (let i = 0; i < boardN; i++) { boardName[i] = boardRank[i] + "  " + boardWho[i].name; boardLen[i] = String(Math.round(boardWho[i].len)); }
  if (live() && player.alive && life) {
    if (playerRank < life.bestRank) life.bestRank = playerRank;
    if (playerRank <= 5 && life.top5At < 0) life.top5At = life.t;
    if (playerRank < lastRank && playerRank <= 5 && life.t > 3 && !simOn) {
      say(playerRank === 1 ? "You are #1!" : "You are #" + playerRank, playerRank === 1 ? "#fde047" : "#fff");
      if (!quiet()) { if (playerRank === 1) sfx.play("win"); else { sfx.tone(660, 0.1, { vol: 0.4 }); sfx.tone(990, 0.14, { delay: 0.08, vol: 0.4 }); } }
    }
    lastRank = playerRank;
  }
}
function stepWorld(dt) {
  T += dt; frame++;
  const on = live();
  if (player.alive) controlPlayer();
  for (let i = 1; i < snakes.length; i++) { const s = snakes[i]; if (!s.alive) continue; if ((frame + s.id) % 6 === 0) think(s); if ((frame + s.id) & 1) avoid(s); }
  for (let i = 0; i < snakes.length; i++) if (snakes[i].alive) move(snakes[i], dt);
  buildSegGrid();
  updatePellets(dt);
  for (let i = 0; i < snakes.length; i++) if (snakes[i].alive) { eat(snakes[i]); hitCheck(snakes[i]); }
  for (let i = 0; i < snakes.length; i++) if (snakes[i].alive && snakes[i].dying) die(snakes[i]);
  for (let i = 1; i < snakes.length; i++) { const s = snakes[i]; if (!s.alive && (s.respawn -= dt) <= 0) spawnRival(s); }
  for (let i = 0; i < 4 && ambient < AMBIENT; i++) spawnAmbient();
  if (frame % 1200 === 0) { const f = choose(fields), a = rand(0, TAU), d = Math.sqrt(Math.random()) * R * 0.88; f.x = Math.cos(a) * d; f.y = Math.sin(a) * d; }
  if (on && player.alive) {
    life.t += dt;
    if (player.len > life.peak) life.peak = player.len;
    if (life.kills && life.killAt < 0) life.killAt = life.t;
    probT -= dt;
    if (probState === "wait" && probT <= 0) newProblem();
    else if (probState === "live") {
      if (probT <= 0 && life.probs > 3) { fizzOrbs(); probState = "wait"; probT = 1.5; }
      for (let i = 0; i < 5; i++) {
        const o = orbs[i];
        if (!o.on) continue;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x * o.x + o.y * o.y > (R - 120) * (R - 120)) { o.vx = -o.x * 0.01; o.vy = -o.y * 0.01; }
        if (frame % 90 === i && Math.hypot(o.x - player.x, o.y - player.y) > 760) placeOrb(o, rand(0, TAU), rand(360, 520));
      }
    }
  } else if (!on && !player.alive && g.state === "menu" && (menuRespawn -= dt) <= 0) { spawnPlayer(); player.len = 30; player.look = skinLook(); }
  if ((rankT -= dt) <= 0) { rankT = 0.25; updateRank(); }
  camStep(dt);
  if (!simOn) fx.update(dt);
  callout.t += dt; flashT += dt;
  if (deadT > 0 && (deadT -= dt) <= 0 && !simOn) endLife();
  if (on && !simOn && (hudT -= dt) <= 0) { hudT = 0.1; g.score = Math.round(player.len); g.setHud("Length", g.score); g.setHud("Rank", playerRank ? "#" + playerRank : "-"); }
}
function endLife() {
  deadT = -1;
  const peak = Math.round(life.peak), xp = Math.round(peak / 4) + life.kills * 15 + life.correct * 10, t = Math.floor(life.t);
  g.addXp(xp);
  g.addCoins(Math.floor(peak / 30) + life.kills * 2 + life.correct * 2);
  g.save("runs", g.load("runs", 0) + 1);
  g.over({ score: peak, title: deathTitle, scoreLabel: "Length", lines: [`Kills ${life.kills} · Best rank #${life.bestRank} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`, `+${xp} xp`] });
  armAttract();
}
function beginLife(auto) {
  autoOn = auto; deadT = -1;
  clearOrbs(); probState = "wait"; probT = 0.35; flashT = 9; stick.on = false; // the first bubbles show up at once
  if (!player.alive) { spawnPlayer(); cam.x = player.x; cam.y = player.y; cam.z = 0.9; }
  player.len = 10; player.safe = 2; player.safeX = 0; player.born = T; player.kills = 0; player.power = 0; player.powerT = 0; player.look = skinLook(); player.dashR = 0; player.boost = false;
  player.ai.skill = 0.72; player.ai.aggr = 0.35; player.ai.greed = 0.6; player.ai.mode = 0;
  life = { t: 0, peak: 10, kills: 0, correct: 0, wrong: 0, probs: 0, bestRank: 15, top5At: -1, killAt: -1, input: false, px: g.pointer.x, py: g.pointer.y };
  lastRank = 99; ctl = 1; tickCombo = 0;
  // a line of food straight ahead: the first seconds always feed you
  let a = player.ang, x = player.x + Math.cos(a) * 50, y = player.y + Math.sin(a) * 50;
  const bend = rand(-0.05, 0.05);
  for (let i = 0; i < 16; i++) { addPellet(x, y, 2, (i + 3) % 12, 0, 0, T + 25); a += bend; x += Math.cos(a) * 24; y += Math.sin(a) * 24; }
  if (!simOn) { g.setHud("Length", 10); g.setHud("Rank", "-"); }
}
function initWorld() {
  snakes.length = 0; feed.length = 0; feasts.length = 0; fields.length = 0; orbs.length = 0; fx.clear();
  pOn.fill(0); pFreeN = 0; pCount = 0; ambient = 0;
  for (let j = PCAP - 1; j >= 0; j--) pFree[pFreeN++] = j;
  for (let i = 0; i < 26; i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R * 0.88; fields.push({ x: Math.cos(a) * d, y: Math.sin(a) * d }); }
  for (let i = 0; i < 5; i++) orbs.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, val: 0, str: "", right: false, ci: i, born: 0 });
  player = newSnake(0, true); player.look = skinLook(); snakes.push(player);
  const names = NAMES.slice().sort(() => Math.random() - 0.5), looks = [...Array(NR).keys()].sort(() => Math.random() - 0.5);
  cam.x = cam.y = 0; cam.z = 0.9;
  for (let i = 0; i < NR; i++) {
    const s = newSnake(i + 1, false);
    s.name = names[i]; s.look = rivalLook(looks[i]);
    s.ai.skill = rand(0.5, 0.95); s.ai.aggr = rand(0.1, 1); s.ai.greed = rand(0.2, 1); s.ai.side = choose([-1, 1]);
    snakes.push(s);
    const a = (i / NR) * TAU * 2.3 + rand(-0.3, 0.3), d = 380 + ((i * 97) % 1000);
    place(s, Math.cos(a) * d, Math.sin(a) * d, rand(0, TAU), START_LENS[i]);
  }
  while (ambient < AMBIENT) spawnAmbient();
  probState = "off"; deadT = -1; T = 0; frame = 0;
  buildSegGrid();
  spawnPlayer(); player.len = 30;
  cam.x = player.x; cam.y = player.y;
  buildSegGrid(); updatePellets(0); updateRank();
}

// ---------- drawing ----------
function trace(s) {
  const n = s.n, px = s.px, py = s.py, h = s.h;
  ctx.beginPath(); ctx.moveTo(s.x, s.y);
  for (let i = h & 1; i < n - 1; i += 2) { const q = (h - i + CAP) & MASK; ctx.lineTo(px[q], py[q]); }
  const a = (h - n + 1 + CAP) & MASK, b = (h - n + 2 + CAP) & MASK, f = s.acc / SEG;
  ctx.lineTo(px[a] + (px[b] - px[a]) * f, py[a] + (py[b] - py[a]) * f);
}
function drawHat(s, r, crown) {
  const x = s.x, y = s.y, L = s.look, hat = crown ? "crown" : L.hat;
  if (!hat) return;
  ctx.lineWidth = 2.2; ctx.strokeStyle = L.d; ctx.lineJoin = "round";
  if (hat === "crown") {
    const w = r * 1.05 + 5, by = y - r * 0.95 - 3 + Math.sin(T * 4) * 1.5, hh = w * 0.95;
    ctx.fillStyle = "#fbbf24"; ctx.strokeStyle = "#78350f";
    ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x - w * 1.1, by - hh); ctx.lineTo(x - w * 0.5, by - hh * 0.5); ctx.lineTo(x, by - hh * 1.15); ctx.lineTo(x + w * 0.5, by - hh * 0.5); ctx.lineTo(x + w * 1.1, by - hh); ctx.lineTo(x + w, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(x, by - hh * 0.38, w * 0.16, 0, TAU); ctx.fill();
  } else if (hat === "party") {
    ctx.fillStyle = L.b; ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.6); ctx.lineTo(x + r * 0.15, y - r * 2.5); ctx.lineTo(x + r * 0.7, y - r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 2.5, r * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (hat === "top") {
    ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(x - r * 1.05, y - r * 0.95, r * 2.1, r * 0.32); ctx.rect(x - r * 0.68, y - r * 2.3, r * 1.36, r * 1.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.fillRect(x - r * 0.68, y - r * 1.3, r * 1.36, r * 0.3);
  } else if (hat === "bow") {
    ctx.fillStyle = "#fb7185"; ctx.beginPath(); ctx.moveTo(x, y - r * 1.05); ctx.lineTo(x - r * 0.95, y - r * 1.75); ctx.lineTo(x - r * 0.95, y - r * 0.55); ctx.closePath(); ctx.moveTo(x, y - r * 1.05); ctx.lineTo(x + r * 0.95, y - r * 1.75); ctx.lineTo(x + r * 0.95, y - r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (hat === "antenna") {
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.8); ctx.lineTo(x - r * 0.8, y - r * 2); ctx.moveTo(x + r * 0.4, y - r * 0.8); ctx.lineTo(x + r * 0.8, y - r * 2); ctx.stroke();
    ctx.fillStyle = L.a; ctx.beginPath(); ctx.arc(x - r * 0.8, y - r * 2, r * 0.26, 0, TAU); ctx.arc(x + r * 0.8, y - r * 2, r * 0.26, 0, TAU); ctx.fill();
  } else if (hat === "halo") {
    ctx.strokeStyle = "#fde047"; ctx.lineWidth = r * 0.26; ctx.beginPath(); ctx.ellipse(x, y - r * 1.55 + Math.sin(T * 3) * 1.5, r * 0.95, r * 0.34, 0, 0, TAU); ctx.stroke();
  } else if (hat === "band") {
    const ca = Math.cos(s.ang), sa = Math.sin(s.ang), bx = x - ca * r * 0.25, by = y - sa * r * 0.25;
    ctx.strokeStyle = L.b; ctx.lineWidth = r * 0.34; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(bx - sa * r, by + ca * r); ctx.lineTo(bx + sa * r, by - ca * r); ctx.stroke();
    ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.moveTo(bx - sa * r, by + ca * r); ctx.lineTo(bx - sa * r * 1.2 - ca * r * 1.2, by + ca * r * 1.2 - sa * r * 1.2 + Math.sin(T * 9) * 2); ctx.stroke();
    ctx.lineCap = "round";
  }
}
function drawSnake(s) {
  const L = s.look, r = s.r;
  let alpha = 1;
  if (s.safe > 0 && !posterOn) alpha = 0.6 + 0.25 * Math.sin(T * 18);
  if (s.power === 3) alpha = 0.5;
  ctx.globalAlpha = alpha; ctx.lineCap = "round"; ctx.lineJoin = "round";
  trace(s);
  if (s.fast || s.power) { ctx.globalAlpha = alpha * 0.3; ctx.strokeStyle = s.power ? POWER_COL[s.power] : L.b; ctx.lineWidth = r * 2 + 16; ctx.stroke(); ctx.globalAlpha = alpha; }
  ctx.strokeStyle = L.d; ctx.lineWidth = r * 2 + 4.5; ctx.stroke();
  ctx.strokeStyle = L.a; ctx.lineWidth = r * 2; ctx.stroke();
  if (Math.abs(r - s.dashR) > 0.4) {
    s.dashR = r;
    if (L.pat === "stripes") { s.dash[0] = r * 0.8; s.dash[1] = r * 1.7; } else if (L.pat === "bands") { s.dash[0] = s.dash[1] = r * 3.2; } else if (L.pat === "dots") { s.dash[0] = 0.01; s.dash[1] = r * 2.3; } else { s.dash[0] = r * 1.6; s.dash[1] = r * 6.4; }
  }
  if (L.pat === "spine") { ctx.strokeStyle = L.b; ctx.lineWidth = r * 0.5; ctx.stroke(); }
  else if (L.pat !== "solid") {
    ctx.setLineDash(s.dash);
    if (L.pat === "dots") { ctx.lineWidth = r * 0.8; ctx.strokeStyle = L.b; ctx.lineDashOffset = -r * 1.6; ctx.stroke(); }
    else {
      ctx.lineCap = "butt"; ctx.lineWidth = r * 2;
      if (L.pat === "rainbow") for (let i = 0; i < 5; i++) { ctx.strokeStyle = RAINBOW[i]; ctx.lineDashOffset = -r * 1.4 - i * r * 1.6; ctx.stroke(); }
      else { ctx.strokeStyle = L.b; ctx.lineDashOffset = -r * 1.5; ctx.stroke(); }
      ctx.lineCap = "round";
    }
    ctx.setLineDash(NODASH); ctx.lineDashOffset = 0;
  }
  if (L.pat !== "spine") { ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = r * 0.5; ctx.stroke(); }
  // growth pulses rolling down the body
  ctx.fillStyle = L.b;
  for (let i = 0; i < 6; i++) {
    const p = s.pulses[i];
    if (p < 0) continue;
    const q = (s.h - ((p / SEG) | 0) + CAP) & MASK;
    ctx.globalAlpha = alpha * 0.6 * Math.max(0, 1 - p / (s.n * SEG)); ctx.beginPath(); ctx.arc(s.px[q], s.py[q], r * 1.3, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = alpha;
  const hr = r * 1.14, ca = Math.cos(s.ang), sa = Math.sin(s.ang), x = s.x, y = s.y;
  ctx.fillStyle = L.d; ctx.beginPath(); ctx.arc(x, y, hr + 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = L.a; ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
  if (s.mouth > 0) { ctx.fillStyle = L.d; ctx.beginPath(); ctx.arc(x + ca * hr * 0.72, y + sa * hr * 0.72, hr * 0.3 * Math.min(1, s.mouth * 8), 0, TAU); ctx.fill(); }
  const goo = L.eyes === "googly", er = hr * (goo ? 0.5 : 0.38), la = s.ang + s.eye, jig = goo ? Math.sin(T * 14 + s.id) * er * 0.12 : 0;
  for (let side = -1; side <= 1; side += 2) {
    const ex = x + ca * hr * 0.42 - sa * hr * 0.52 * side, ey = y + sa * hr * 0.42 + ca * hr * 0.52 * side;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(ex + Math.cos(la) * er * 0.42 + jig, ey + Math.sin(la) * er * 0.42 + jig, er * (goo ? 0.42 : 0.55), 0, TAU); ctx.fill();
    if (L.eyes === "angry") { const th = s.ang + side * (Math.PI / 2 + 0.95) - Math.PI / 2; ctx.fillStyle = L.d; ctx.beginPath(); ctx.arc(ex, ey, er * 1.08, th, th + Math.PI); ctx.fill(); }
  }
  drawHat(s, hr, s === leader);
  if (s.isPlayer && s.powerT > 0) {
    ctx.strokeStyle = POWER_COL[s.power]; ctx.lineWidth = 4; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, hr + 11, -Math.PI / 2, -Math.PI / 2 + (TAU * s.powerT) / 4); ctx.stroke();
    if (s.power === 1) { ctx.globalAlpha = 0.14 + 0.08 * Math.sin(T * 10); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 240 - ((T * 160) % 120), 0, TAU); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}
// One look for every answer bubble, in the world, on the edge chips and in the banner: blue glass, gold ring, white number.
function bubble(x, y, rad, str, glow) {
  if (glow) { ctx.globalAlpha = 0.85; ctx.drawImage(glowSprite, x - rad * 2.5, y - rad * 2.5, rad * 5, rad * 5); ctx.globalAlpha = 1; }
  ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(x, y, rad + rad * 0.1 + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = ORB_RING; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  ctx.fillStyle = ORB_FILL; ctx.beginPath(); ctx.arc(x, y, rad * 0.84, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.ellipse(x - rad * 0.28, y - rad * 0.4, rad * 0.36, rad * 0.2, -0.5, 0, TAU); ctx.fill();
  ctx.font = `900 ${Math.round(rad * (str.length > 3 ? 0.62 : str.length > 2 ? 0.76 : str.length > 1 ? 0.95 : 1.1))}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = rad * 0.16; ctx.strokeStyle = "#0f172a"; ctx.lineJoin = "round"; ctx.strokeText(str, x, y + rad * 0.05);
  ctx.fillStyle = "#fff"; ctx.fillText(str, x, y + rad * 0.05);
}
function drawOrb(o, z) {
  const age = T - o.born, pop = age < 0.3 ? Math.max(0.05, age / 0.3) : 1, rad = (31 / Math.pow(z, 0.55)) * pop * (1 + 0.06 * Math.sin(T * 5 + o.ci));
  bubble(o.x, o.y, rad, o.str, true);
}
// dotted line from your head to the nearest bubble with the answer (first three problems of a life)
function drawGuide(z) {
  if (probState !== "live" || !life || life.probs > 3 || !player.alive || g.state !== "playing") return;
  let best = null, bd = 1e9;
  for (let i = 0; i < 5; i++) { const o = orbs[i]; if (o.on && o.right) { const d = Math.hypot(o.x - player.x, o.y - player.y); if (d < bd) { bd = d; best = o; } } }
  if (!best || bd < 70) return;
  const a = Math.atan2(best.y - player.y, best.x - player.x), ca = Math.cos(a), sa = Math.sin(a), d0 = player.r + 16, d1 = bd - 40 / Math.pow(z, 0.55);
  if (d1 <= d0) return;
  ctx.strokeStyle = ORB_RING; ctx.lineWidth = 8 / z; ctx.lineCap = "round"; ctx.globalAlpha = 0.85;
  s_dash[0] = 0.01; s_dash[1] = 20 / z; ctx.setLineDash(s_dash); ctx.lineDashOffset = -((T * 46) % (20 / z + 0.01));
  ctx.beginPath(); ctx.moveTo(player.x + ca * d0, player.y + sa * d0); ctx.lineTo(player.x + ca * d1, player.y + sa * d1); ctx.stroke();
  ctx.setLineDash(NODASH); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
}
const s_dash = [0.01, 17];
let bannerY = 40, bannerX = W / 2;
let U = 1; // HUD scale: bigger on small screens so it stays readable
function fitHud() { U = clamp(640 / (g.stage.getBoundingClientRect().width || 960), 1, 1.75); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawHud() {
  const playing = g.state === "playing";
  ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  // orbs that are off screen: a chip on the edge with the number
  if (probState === "live" && player.alive) {
    for (let i = 0; i < 5; i++) {
      const o = orbs[i];
      if (!o.on) continue;
      const sx = W / 2 + (o.x - cam.x) * cam.z, sy = H / 2 + (o.y - cam.y) * cam.z;
      if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20) continue;
      const dx = sx - W / 2, dy = sy - H / 2, k = Math.min((W / 2 - 30) / Math.abs(dx || 1), (H / 2 - 30) / Math.abs(dy || 1)), ey = Math.max(96 * U, H / 2 + dy * k), ex = Math.min(W / 2 + dx * k, ey < 190 ? W - 200 : W), a = Math.atan2(dy, dx);
      ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 31, ey + Math.sin(a) * 31); ctx.lineTo(ex + Math.cos(a + 0.5) * 19, ey + Math.sin(a + 0.5) * 19); ctx.lineTo(ex + Math.cos(a - 0.5) * 19, ey + Math.sin(a - 0.5) * 19); ctx.fill();
      bubble(ex, ey, 19, o.str, false);
    }
  }
  if (probState !== "off" && playing && player.alive && probSeen) {
    const age = T - probBorn, pop = age < 0.25 ? 0.7 + 1.5 * age : 1.075 - Math.min(0.075, (age - 0.25) * 0.5), fl = flashT < 0.7 ? 1 - flashT / 0.7 : 0;
    const edge = fl > 0 ? (flashGood ? "#4ade80" : "#f87171") : ORB_RING, solved = probState === "wait";
    const label = "Eat the answer:";
    ctx.font = `800 19px ${FONT}`; const lw = ctx.measureText(label).width;
    ctx.font = `900 34px ${FONT}`; const pw = ctx.measureText(probText).width;
    const w = 24 + lw + 10 + 34 + 14 + pw + 26, x0 = -w / 2, room = W - 2 * (260 * Math.min(U, 1.5)) - 12;
    // on small screens the banner drops under the top buttons so it can stay big
    const low = w * Math.min(U, 1.5) > room, free = W - 172 * U - 24, bs = Math.min(Math.min(U, 1.5), low ? free / w : 9) * pop * (1 + fl * 0.08);
    bannerY = low ? 52 * U + 34 * Math.min(U, 1.5) : 40 * U; bannerX = low ? 8 + free / 2 : W / 2;
    ctx.save(); ctx.translate(bannerX, bannerY); ctx.scale(bs, bs);
    ctx.fillStyle = edge; rr(x0 - 4, -32, w + 8, 64, 32); ctx.fill();
    ctx.fillStyle = fl > 0 ? (flashGood ? "#14532d" : "#7f1d1d") : "#0f172a"; rr(x0, -28, w, 56, 28); ctx.fill();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = `800 19px ${FONT}`; ctx.fillStyle = ORB_RING; ctx.fillText(label, x0 + 24, 1);
    bubble(x0 + 24 + lw + 10 + 17, 0, 15, solved ? String(prob.answer) : "?", false);
    ctx.textAlign = "left"; ctx.font = `900 34px ${FONT}`; ctx.fillStyle = solved ? "#86efac" : "#fff"; ctx.fillText(probText, x0 + 24 + lw + 10 + 34 + 14, 2);
    ctx.restore();
    if (!life.correct && g.load("rights", 0) < 6) {
      const hint = "Eat the bubble with the answer";
      ctx.font = `800 ${Math.round(16 * U)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 4; ctx.strokeStyle = "#0f172a"; ctx.strokeText(hint, bannerX, bannerY + 48 * Math.min(U, 1.5)); ctx.fillStyle = "#fff"; ctx.fillText(hint, bannerX, bannerY + 48 * Math.min(U, 1.5));
    }
  }
  if (stick.on && playing) {
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(stick.ax, stick.ay, 70, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(stick.ax + stick.dx, stick.ay + stick.dy, 30, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (playing && hintBoost && player.alive && life.t > 6 && player.len > 30 && probState !== "live") {
    const t = touchMode ? "Hold Sprint to go fast" : "Hold click to sprint";
    ctx.font = `800 16px ${FONT}`; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#0f172a"; ctx.strokeText(t, W / 2, H - 60); ctx.fillStyle = "#fff"; ctx.fillText(t, W / 2, H - 60);
  }
  if (callout.t < 1.6 && playing) {
    const k = callout.t, pop = k < 0.12 ? 0.5 + k * 5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.8);
    ctx.globalAlpha = k > 1.25 ? (1.6 - k) / 0.35 : 1;
    const cy = bannerY + 56 + 40 * U; ctx.font = `900 ${Math.round(40 * pop * Math.min(U, 1.3))}px ${FONT}`; ctx.textAlign = "center"; ctx.lineWidth = 8; ctx.strokeStyle = "#1e3a8a"; ctx.strokeText(callout.txt, W / 2, cy); ctx.fillStyle = callout.col; ctx.fillText(callout.txt, W / 2, cy);
    ctx.globalAlpha = 1;
  }
  // leaderboard
  ctx.save(); ctx.translate(W - 172 * U, 50 * U); ctx.scale(U, U);
  const bx = 0, by = 0;
  ctx.fillStyle = "rgba(8,12,30,0.62)"; rr(bx, by, 162, 12 + boardN * 20, 10); ctx.fill();
  ctx.font = `800 13px ${FONT}`;
  for (let i = 0; i < boardN; i++) {
    const y = by + 16 + i * 20, me = boardWho[i] === player;
    if (me) { ctx.fillStyle = "rgba(253,224,71,0.2)"; rr(bx + 4, y - 9, 154, 19, 6); ctx.fill(); }
    ctx.fillStyle = me ? "#fde047" : i === 0 ? "#fbbf24" : "#e2e8f0";
    ctx.textAlign = "left"; ctx.fillText(boardName[i], bx + 12, y + 1);
    ctx.textAlign = "right"; ctx.fillText(boardLen[i], bx + 150, y + 1);
  }
  ctx.restore();
  ctx.save(); ctx.translate(14, 64 * U); ctx.scale(U, U);
  // kill feed
  ctx.textAlign = "left"; ctx.font = `800 13px ${FONT}`; ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(8,12,30,0.85)";
  let fy = 0;
  for (let i = Math.max(0, feed.length - 4); i < feed.length; i++) {
    const f = feed[i], age = T - f.t;
    if (age > 6) continue;
    ctx.globalAlpha = age > 5 ? 6 - age : 1; ctx.strokeText(f.txt, 0, fy); ctx.fillStyle = f.col; ctx.fillText(f.txt, 0, fy); fy += 18;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // minimap
  const mr = 42 * Math.min(U, 1.4), mx = g.coarse ? mr + 14 : W - mr - 14, my = g.coarse ? H - 150 : H - mr - 14, k = mr / R;
  ctx.fillStyle = "rgba(8,12,30,0.62)"; ctx.beginPath(); ctx.arc(mx, my, mr + 4, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(244,114,182,0.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.stroke();
  for (let i = snakes.length - 1; i >= 0; i--) {
    const s = snakes[i];
    if (!s.alive) continue;
    ctx.fillStyle = s.isPlayer ? "#fff" : s === leader ? "#fbbf24" : s.look.a;
    ctx.beginPath(); ctx.arc(mx + s.x * k, my + s.y * k, s.isPlayer ? 3.4 : 1.4 + s.r * 0.1, 0, TAU); ctx.fill();
  }
  if (probState === "live") for (let i = 0; i < 5; i++) { const o = orbs[i]; if (o.on) { ctx.fillStyle = ORB_RING; ctx.fillRect(mx + o.x * k - 1.5, my + o.y * k - 1.5, 3, 3); } }
}
function render() {
  const z = cam.z, playing = g.state === "playing";
  if (posterOn) {
    // the poster fills whatever shape the stage was forced to, framed on the center of the scene
    const r = g.stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr)), sc = ch / H;
    if (c.canvas.width !== cw || c.canvas.height !== ch) { c.canvas.width = cw; c.canvas.height = ch; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#0b1330"; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(sc, 0, 0, sc, cw / 2 - (W / 2) * sc, 0);
  } else { ctx.fillStyle = "#1a0a1c"; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.translate(W / 2 + (playing ? g.shakeX : 0), H / 2 + (playing ? g.shakeY : 0)); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / z - 30, vx1 = cam.x + W / 2 / z + 30, vy0 = cam.y - H / 2 / z - 30, vy1 = cam.y + H / 2 / z + 30;
  ctx.fillStyle = floor; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  if (Math.hypot(cam.x, cam.y) + Math.hypot(W, H) / 2 / z > R - 40) {
    ctx.strokeStyle = "rgba(244,63,94,0.25)"; ctx.lineWidth = 46; ctx.beginPath(); ctx.arc(0, 0, R - 20, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#fb7185"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  }
  const cx0 = ci(vx0), cx1 = ci(vx1), cy0 = ci(vy0), cy1 = ci(vy1);
  for (let yy = cy0; yy <= cy1; yy++) for (let xx = cx0; xx <= cx1; xx++) {
    for (let j = pHead[xx + GN * yy]; j >= 0; j = pNext[j]) {
      if (!pOn[j]) continue;
      const v = pV[j], sz = (3.2 + (v > 5 ? 5.5 : v * 1.1)) * 2.5 * (1 + 0.14 * Math.sin(T * 4 + pPh[j]));
      ctx.drawImage(pelSprite[pC[j]], pX[j] - sz, pY[j] - sz, sz * 2, sz * 2);
    }
  }
  if (!posterOn) drawGuide(z);
  for (let i = 0; i < orbs.length; i++) if (orbs[i].on) drawOrb(orbs[i], z);
  for (let i = 0; i < rankN; i++) { const s = rankArr[i]; if (s.alive && !s.isPlayer && s.maxx > vx0 && s.minx < vx1 && s.maxy > vy0 && s.miny < vy1) drawSnake(s); }
  if (player.alive) drawSnake(player);
  fx.draw(ctx);
  if (!posterOn) {
    ctx.font = `800 ${Math.round(12 / z)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3 / z; ctx.strokeStyle = "rgba(8,12,30,0.8)"; ctx.fillStyle = "#e2e8f0"; ctx.lineJoin = "round";
    for (let i = 0; i < rankN; i++) { const s = rankArr[i]; if (s.alive && !s.isPlayer && s.x > vx0 && s.x < vx1 && s.y > vy0 && s.y < vy1) { const y = s.y + s.r * 1.2 + 12 / z; ctx.strokeText(s.name, s.x, y); ctx.fillText(s.name, s.x, y); } }
  }
  ctx.restore();
  if (!posterOn) drawHud();
}

// ---------- title: live arena and skin picker ----------
let attractOn = false, attractLast = 0;
function armAttract() { if (attractOn || posterOn) return; attractOn = true; requestAnimationFrame(attractFrame); }
function attractFrame(now) {
  if ((g.state !== "menu" && g.state !== "over") || posterOn) { attractOn = false; return; }
  requestAnimationFrame(attractFrame);
  if (document.hidden || now - attractLast < 30) return;
  attractLast = now;
  stepWorld(1 / 60); stepWorld(1 / 60); render();
}
const css = document.createElement("style");
css.textContent = `.ns-skins{display:flex;gap:.5cqw;justify-content:center;flex-wrap:wrap;margin:.5em auto 0;max-width:92%}
.ns-sw{width:clamp(20px,3.2cqw,34px);height:clamp(20px,3.2cqw,34px);border-radius:50%;border:2.5px solid #0f172a;padding:0;cursor:pointer;box-shadow:0 2px 0 rgb(15 23 42/.5)}
.ns-sw.on{outline:3px solid #fde047;outline-offset:1px}.ns-sw.lock{filter:saturate(.25) brightness(.55)}
.ns-cap{margin:.35em 0 0;font-weight:800;font-size:clamp(10px,1.5cqw,15px);color:#fff;text-shadow:0 1px 0 rgb(15 23 42/.7);min-height:1.2em}`;
document.head.appendChild(css);
function swatch(s) {
  if (s.pat === "rainbow") return `linear-gradient(90deg,${RAINBOW.join(",")})`;
  if (s.pat === "stripes" || s.pat === "bands") return `repeating-linear-gradient(60deg,${s.a} 0 22%,${s.b} 22% 40%)`;
  if (s.pat === "dots") return `radial-gradient(circle,${s.b} 0 24%,${s.a} 26%)`;
  if (s.pat === "spine") return `linear-gradient(90deg,${s.a} 0 38%,${s.b} 38% 62%,${s.a} 62%)`;
  return s.a;
}
function paintSkins(el) {
  if (!el || !el.isConnected) return;
  const cur = skinLook(), xp = g.xp;
  el.innerHTML = `<div class="ns-skins">${SKINS.map((s) => `<button class="ns-sw${s.id === cur.id ? " on" : ""}${xp >= s.need ? "" : " lock"}" data-skin="${s.id}" aria-label="${s.name}" style="background:${swatch(s)}"></button>`).join("")}</div><p class="ns-cap">Skin: ${cur.name}</p>`;
  el.onclick = (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-skin]");
    if (!b) return;
    const s = SKINS.find((k) => k.id === b.dataset.skin);
    if (g.xp >= s.need) { g.skin = s.id; sfx.play("click"); paintSkins(el); player.look = skinLook(); player.dashR = 0; }
    else { sfx.play("tick"); el.querySelector(".ns-cap").textContent = `${s.name}: ${s.need - g.xp} xp to go`; }
  };
  el.onpointerdown = (e) => e.stopPropagation();
}

// ---------- poster ----------
const HIDE = ".ak-overlay, .ak-hud, .ak-toasts, .ak-touch";
function poster() {
  posterOn = true; simOn = false; g.posterMode = true;
  g.stage.style.setProperty("--ak-aspect", String(innerWidth / innerHeight));
  g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "hidden"));
  for (let i = 0; i < snakes.length; i++) snakes[i].alive = false;
  for (let j = 0; j < PCAP; j++) if (pOn[j]) killPellet(j);
  fx.clear(); clearOrbs(); T = 2.2;
  cam.x = 0; cam.y = 0; cam.z = 2.2;
  const p = player;
  p.look = skinLook(); place(p, -20, 46, -0.7, 300); p.safe = 0; p.fast = true; p.eye = 0.2; layPath(p, 30, 32); p.pulses[0] = 130;
  const rv = snakes[1];
  rv.look = { a: "#f43f5e", b: "#fecdd3", d: "#4c0519", pat: "stripes", hat: "party", trail: "", eyes: "angry", pc: 5 };
  place(rv, 74, 82, Math.PI + 0.45, 120); rv.safe = 0; rv.eye = 0.4; layPath(rv, 12, 28);
  for (let i = 0; i < 7; i++) { const t = 24 + i * 8, a = -0.7 + i * 0.05; addPellet(p.x + Math.cos(a) * t, p.y + Math.sin(a) * t, 2 + (i % 3), [3, 7, 6, 10, 4][i % 5], 0, 0, 0); }
  for (let i = 0; i < 40; i++) { const x = rand(-125, 125), y = rand(-30, 120); if (Math.hypot(x - p.x, y - p.y) > 30 && Math.hypot(x - 52, y + 10) > 24 && Math.hypot(x + 78, y - 10) > 24) addPellet(x, y, 1 + (i % 3), randInt(0, 11), 0, 0, 0); }
  const o = orbs[0]; o.on = true; o.x = 52; o.y = -10; o.val = 7; o.str = "7"; o.ci = 1; o.born = 0; o.right = true;
  const o2 = orbs[2]; o2.on = true; o2.x = -78; o2.y = 10; o2.val = 3; o2.str = "3"; o2.ci = 2; o2.born = 0; o2.right = false;
  buildSegGrid(); updatePellets(0); updateRank();
  render();
}

// ---------- wiring ----------
g.onStart = () => {
  if (posterOn) { posterOn = false; g.posterMode = false; g.stage.style.setProperty("--ak-aspect", String(16 / 9)); g.stage.querySelectorAll(HIDE).forEach((e) => (e.style.visibility = "")); c.fit(); initWorld(); player.alive = false; }
  beginLife(false);
};
initWorld();
g.debug = {
  get player() { return player; }, get snakes() { return snakes; }, get orbs() { return orbs; }, get problem() { return prob; }, get life() { return life; }, get cam() { return cam; },
  get pellets() { return pCount; }, stats, get rank() { return playerRank; }, get probState() { return probState; }, R, SKINS, poster,
  /** Let the computer steer the player (an average player with some mistakes). */
  auto(on = true) { autoOn = on; },
  /** Steer toward an angle as if the keys were held. */
  aim(a) { life.input = true; ctl = 2; player.tAng = a; },
  grow(n) { player.len += n; },
  power(k) { player.power = k; player.powerT = 4; },
  skipToMath() { probT = 0; },
  get banner() { return probState === "off" ? "" : "Eat the answer: " + probText; }, get callout() { return callout.t < 1.6 ? callout.txt : ""; },
  touch(on = true) { touchMode = on; }, aimAt,
  /** Put the player right next to a bubble (right or wrong) so the next step eats it. */
  eatOrb(right = true) { const o = orbs.find((k) => k.on && k.right === right); if (!o) return false; player.x = o.x - 20; player.y = o.y; return o.str; },
  /** Steering check: from 16 headings to a target 200 px away in 16 directions. mode "mouse" (pointer on the target) or "keys" (nearest of 8 directions). */
  steer(mode = "mouse") {
    simOn = true;
    const out = { mode, cases: 0, reached: 0, orbited: 0, worstSec: 0, avgSec: 0, worstTurn: 0 };
    for (let h = 0; h < 16; h++) for (let d = 0; d < 16; d++) {
      for (let i = 1; i < snakes.length; i++) snakes[i].alive = false;
      const ha = (h * TAU) / 16, da = (d * TAU) / 16 + 0.1, tx = Math.cos(da) * 200, ty = Math.sin(da) * 200;
      place(player, 0, 0, ha, 10); cam.x = 0; cam.y = 0; cam.z = 1;
      let t = 0, turned = 0, hit = false, key = null;
      while (t < 6) {
        // keys: a person holds one of the 8 directions and only changes it when it is clearly off
        const want = Math.atan2(ty - player.y, tx - player.x);
        if (mode === "keys" && (key == null || Math.abs(angDiff(want, key)) > 0.6)) key = Math.round(want / (Math.PI / 4)) * (Math.PI / 4);
        const a = mode === "keys" ? key : aimAt(W / 2 + (tx - cam.x) * cam.z, H / 2 + (ty - cam.y) * cam.z);
        if (a != null) player.tAng = a;
        player.boost = false;
        const a0 = player.ang; move(player, 1 / 60); turned += Math.abs(player.ang - a0); camStep(1 / 60); t += 1 / 60;
        if (Math.hypot(tx - player.x, ty - player.y) < player.r + 8) { hit = true; break; }
      }
      out.cases++; if (hit) out.reached++; if (!hit || turned > TAU) out.orbited++;
      out.worstSec = Math.max(out.worstSec, t); out.avgSec += t; out.worstTurn = Math.max(out.worstTurn, turned);
    }
    out.avgSec = +(out.avgSec / out.cases).toFixed(2); out.worstSec = +out.worstSec.toFixed(2); out.worstTurn = +out.worstTurn.toFixed(2);
    simOn = false; initWorld();
    return out;
  },
  killPlayer() { player.dying = true; player.killer = -1; },
  /** Headless runs of the scripted average player. Returns the averages. */
  sim(runs = 10, maxSec = 300, idle = false) {
    simOn = true;
    const out = [], d0 = stats.deaths;
    let total = 0;
    for (let r = 0; r < runs; r++) {
      initWorld(); player.alive = false; beginLife(!idle);
      let t = 0;
      while (player.alive && t < maxSec) { stepWorld(1 / 60); t += 1 / 60; }
      total += t;
      out.push({ t, peak: life.peak, kills: life.kills, rank: life.bestRank, top5At: life.top5At, killAt: life.killAt, correct: life.correct, wrong: life.wrong });
    }
    simOn = false; autoOn = false; initWorld();
    const avg = (f) => +(out.reduce((a, o) => a + f(o), 0) / out.length).toFixed(2), sorted = out.map((o) => o.t).sort((a, b) => a - b);
    return { runs, avgTime: avg((o) => o.t), medianTime: +sorted[runs >> 1].toFixed(1), minTime: +sorted[0].toFixed(1), avgPeak: avg((o) => o.peak), avgKills: avg((o) => o.kills), avgBestRank: avg((o) => o.rank),
      top5In2Min: avg((o) => (o.top5At >= 0 && o.top5At <= 120 ? 1 : 0)), killIn2Min: avg((o) => (o.killAt >= 0 && o.killAt <= 120 ? 1 : 0)), avgCorrect: avg((o) => o.correct), avgWrong: avg((o) => o.wrong), secPerDeathInArena: +(total / Math.max(1, stats.deaths - d0)).toFixed(1) };
  },
  /** Milliseconds per world step and per frame drawn. */
  bench(n = 600) {
    let t0 = performance.now();
    for (let i = 0; i < n; i++) stepWorld(1 / 60);
    const step = (performance.now() - t0) / n;
    t0 = performance.now();
    for (let i = 0; i < 120; i++) render();
    return { stepMs: +step.toFixed(3), renderMs: +((performance.now() - t0) / 120).toFixed(3), pellets: pCount, snakes: rankN, segs: segCount };
  },
};
g.onResize = fitHud; fitHud();
g.loop(stepWorld, render);
armAttract();
