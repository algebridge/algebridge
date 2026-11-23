// Getaway: you are x, on the run. Pick what x is to smash through the next door.
// Answer fast and the equations level up. Slow down a lot and you hold at that level
// while the Sweepers keep speeding up. Get busted, and the next run starts on that topic.
import { createGame, createFx, sfx, drawArchie, PAL, FONT, clamp } from "../kit/kit.js";
import { problem, TOPICS } from "./ladder.js";

const g = createGame({
  slug: "getaway",
  title: "Getaway",
  tagline: "Find x before the Sweepers catch up.",
  how: ["Pick what x is to break through the next door."],
  controls: [{ keys: "1 2 3", does: "Pick an answer" }, { keys: "T", does: "Scanner" }],
  aspect: 16 / 9,
  bg: "#0b1020",
  instant: true,
  prompt: "Press any key to run",
});
const c = g.canvas2d(960, 540);
const { ctx } = c;
const fx = createFx();
const BW = 120; // one block on the road
const CAR_SX = 560; // where the car sits on screen

const UPS = [
  { id: "engine", name: "Engine", line: "Sweepers gain on you slower", max: 3, cost: [60, 120, 200] },
  { id: "armor", name: "Armor", line: "Start a block further ahead", max: 2, cost: [100, 220] },
  { id: "scan", name: "Scanner", line: "Cross out a wrong answer (T)", max: 3, cost: [80, 160, 260] },
];

let save = { cash: g.load("cash", 0), up: g.load("up", {}), start: g.load("start", 0), best: g.load("best", 0), heat: g.load("heat", 0), wins: g.load("wins", 0) };
const lvl = (id) => save.up[id] || 0;
const persist = () => { for (const k of ["cash", "up", "start", "best", "heat", "wins"]) g.save(k, save[k]); };

let mode = "title"; // title, run, bust, hide
let R = null;
let H = { msg: "", sub: "" };
let modeT = 0;
let heartT = 0;

// how fast counts as fast: harder rungs get more time
const fastT = (L) => 3 + 0.7 * Math.min(L, 9);
const slowT = (L) => fastT(L) * 1.8;
const engine = () => [1, 1.15, 1.3, 1.45][lvl("engine")];
// HEAT goes up with every getaway: the Sweepers come back faster
const ESCAPE = 8; // get this many blocks ahead and they lose you
// one ring of the chase is a bit longer than a fast answer at that level:
// answer fast and you pull away, answer at your normal pace and it is neck and neck
const baseTick = (L) => Math.max(2.8, fastT(L) * 1.3 * Math.pow(0.9, save.heat)) * engine();
const topicName = (L) => (L >= TOPICS.length ? "Mixed" : TOPICS[L].name);

function newRun() {
  R = {
    level: save.start, startLevel: save.start, locked: false, prev: null, solved: 0,
    pos: 0, gap: 3 + lvl("armor"), coins: [], combo: 0, tickT: 0, tickFrac: 0, interval: baseTick(save.start),
    t: 0, wrongs: 0, out: [], cd: 0, scans: lvl("scan"), firstMove: false,
    carX: -BW * 2.5, sweepX: -BW * 6, lunge: 0, doorShake: 0, earned: 0,
    banner: null, hint: save.start === 0 && save.best === 0,
  };
  next();
  R.sweepX = (R.pos - R.gap) * BW - BW * 2;
  mode = "run"; modeT = 0;
  hud();
}

function next() {
  R.p = problem(R.level);
  R.t = 0; R.wrongs = 0; R.out = []; R.guessed = false; R.lastPick = null;
}

function hud() {
  g.setHud("Cash", save.cash);
}

function banner(text, color, life = 2) { R.banner = { text, color, t: life, life }; }

const PRAISE = ["Nice", "Got it", "Clean", "Smooth", "Yes", "Sharp", "Easy", "Boom"];
const STREAK = ["", "", "Two in a row", "Three in a row", "On fire", "Unstoppable", "Can't touch you"];

function answer(i) {
  if (mode !== "run" || R.cd > 0) return;
  const v = R.p.choices[i];
  if (v === undefined || R.out.includes(i)) return;
  R.cd = 0.25; R.firstMove = true; R.hint = false;
  // two picks less than a second apart is clicking, not solving
  if (R.lastPick != null && R.t - R.lastPick < 1) R.guessed = true;
  R.lastPick = R.t;
  if (v !== R.p.x) {
    // a trap answer: cross it out, and the Sweepers lunge a block
    R.out.push(i); R.wrongs += 1; R.combo = 0;
    R.gap -= 1; R.lunge = 1; R.tickT = Math.max(0, R.tickT - 1);
    sfx.play("wrong"); g.shake(9, 0.3);
    say(`x is not ${v < 0 ? "\u2212" + Math.abs(v) : v}`, "#fca5a5");
    if (R.gap <= 0) bust();
    return;
  }
  const time = R.t, L = R.level;
  const fast = R.wrongs === 0 && time <= fastT(L);
  const slow = R.wrongs >= 2 || time > slowT(L);
  const superFast = R.wrongs === 0 && time <= fastT(L) * 0.45;
  const close = R.gap <= 1; // the Sweepers were right on you when you answered
  R.times = [...(R.times || []).slice(-2), time];
  R.solved += 1; R.pos += 1; R.gap = Math.min(ESCAPE, R.gap + 1);
  R.combo = R.wrongs === 0 ? (R.combo || 0) + 1 : 0;
  const pay = 5 + 3 * L + (fast ? 5 : 0);
  R.earned += pay; save.cash += pay;
  celebrate(i, fast, close, pay);
  R.cd = 0.45; // let the pop play before the next cards arrive

  // read how it went from the clock, quietly
  // measured against the chase: one ring is how long they have before losing a block
  const lastSecond = close && R.tickFrac > 0.7;        // right before they would have been caught
  // a fast clean answer always counts as fast, even with the Sweepers close
  const noTime = !fast && (time > 2 * R.interval || lastSecond || R.guessed || (close && time > R.interval));
  const struggling = !fast && (slow || close || time > R.interval || R.wrongs >= 1);
  if (noTime) dropBy(L < 4 ? 2 : 3);                      // way over their head: back a few
  else if (struggling) dropBy(1);                         // a bit too hard: back one
  else if (fast) climb(superFast ? (L < 4 ? 3 : 2) : 1);  // fast: up again, every time
  if (R.gap >= ESCAPE) { save.best = Math.max(save.best, R.level); persist(); return escape(); }
  save.best = Math.max(save.best, R.level);
  persist(); hud();
  next();
}

// the good feeling: every right answer pops, chimes, pays out and pushes the car forward
function celebrate(i, fast, close, pay) {
  const r = cardRect(i), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  R.pop = { i, t: 0.55, v: R.p.choices[i] };
  R.flash = 0.22; R.boost = 0.7; R.happyT = 0.9;
  // chime: a rising chord, higher with every answer in a row
  const base = 523 * Math.pow(1.06, Math.min(R.combo, 8));
  [0, 4, 7, 12].forEach((st, k) => sfx.tone(base * Math.pow(2, st / 12), 0.16, { type: "triangle", vol: 0.16, delay: k * 0.055 }));
  sfx.play("crash");
  g.hitstop(0.05); g.shake(5, 0.15);
  // the card bursts into confetti
  fx.burst(cx, cy, { n: 34, colors: [PAL.lime, PAL.yellow, "#fff", PAL.sky, PAL.pink], speed: 460, shape: "square", size: 6, gravity: 700, life: 1 });
  fx.ring(cx, cy, { radius: 120, color: PAL.lime, width: 8, life: 0.4 });
  // the door smashes
  const dX = R.pos * BW - camX() + 70 + 50;
  fx.burst(dX, 290, { n: 22, colors: ["#273244", "#1f2937", PAL.lime], speed: 420, shape: "square", size: 9, gravity: 900, life: 0.9, angle: 0, spread: 2.4 });
  fx.burst(dX, 290, { n: 14, colors: [PAL.yellow, "#fff"], speed: 300, shape: "spark", size: 5, gravity: 0, life: 0.4 });
  // coins fly up to the cash pill
  for (let k = 0; k < Math.min(10, 3 + Math.floor(pay / 8)); k++) R.coins.push({ x: cx + (Math.random() - 0.5) * 60, y: cy, t: -k * 0.04, life: 0.7 + Math.random() * 0.2, sx: cx, sy: cy, ox: (Math.random() - 0.5) * 240 });
  // words
  let word = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  if (close) word = "Just in time";
  if (R.combo >= 2) word = STREAK[Math.min(R.combo, STREAK.length - 1)];
  R.praise = { text: word, sub: `x = ${R.p.x < 0 ? "\u2212" + Math.abs(R.p.x) : R.p.x}`, t: 0, life: 1.1, gold: fast || R.combo >= 3 };
  if (close) g.slowmo(0.35, 0.55);
  // every 5 doors, a bigger party
  if (R.solved % 5 === 0) {
    R.praise.text = `${R.solved} doors`; R.praise.gold = true; R.praise.life = 1.5;
    sfx.play("win");
    for (let k = 0; k < 3; k++) fx.burst(160 + k * 320, -10, { n: 30, colors: [PAL.yellow, PAL.pink, PAL.lime, PAL.sky, "#fff"], speed: 300, shape: "square", size: 7, gravity: 500, angle: Math.PI / 2, spread: 1.6, life: 1.6 });
  }
}

function climb(n) {
  R.prev = R.level; R.level = Math.min(TOPICS.length + 1, R.level + n);
  R.interval = baseTick(R.level);
}

// step back down. The chase is set to their real pace, so they make it just in time.
function dropBy(n, rescue = false) {
  R.level = Math.max(0, R.level - n);
  const t = R.times && R.times.length ? R.times.reduce((a, b) => a + b, 0) / R.times.length : baseTick(R.level);
  // at least the normal pace for the easier level, so a drop always gives some air
  R.interval = clamp(Math.max(t * 1.1, baseTick(R.level)), 2.6, 14) * engine();
  if (rescue) { R.gap = Math.max(R.gap, 2); R.tickT = 0; }
}

function bust() {
  mode = "bust"; modeT = 0;
  sfx.play("lose"); g.slowmo(0.3, 0.8); g.shake(16, 0.5);
  fx.burst(CAR_SX, 300, { n: 50, colors: ["#ef4444", "#fff", "#f59e0b"], speed: 380 });
  save.start = R.level; persist();
}

// the win: they got far enough ahead that the Sweepers lost them
function escape() {
  mode = "escaped"; modeT = 0;
  const bonus = 40 + 15 * R.level + 20 * save.heat;
  R.earned += bonus; save.cash += bonus;
  save.wins += 1; save.heat += 1; save.start = R.level; persist(); hud();
  R.pop = null; R.praise = { text: "You lost them", sub: `+${bonus} cash`, t: 0, life: 2.4, gold: true };
  sfx.play("win");
  [0, 4, 7, 12, 16, 19, 24].forEach((st, k) => sfx.tone(523 * Math.pow(2, st / 12), 0.22, { type: "triangle", vol: 0.18, delay: k * 0.08 }));
  g.slowmo(0.5, 0.8);
  for (let k = 0; k < 5; k++) fx.burst(80 + k * 200, -10, { n: 40, colors: [PAL.yellow, PAL.pink, PAL.lime, PAL.sky, "#fff"], speed: 340, shape: "square", size: 7, gravity: 500, angle: Math.PI / 2, spread: 1.6, life: 2 });
}

function toHideout(won) {
  H.msg = won ? "You got away" : "Busted";
  const doors = `${R.solved} door${R.solved === 1 ? "" : "s"}`;
  H.sub = won ? `${doors}. They come back faster next time.` : `${doors}. Caught on ${topicName(R.level)}. Next run starts there.`;
  mode = "hide"; modeT = 0; hud();
}

function buy(i) {
  const u = UPS[i]; if (!u) return;
  const l = lvl(u.id);
  if (l >= u.max) { sfx.tone(160, 0.1, { type: "square", vol: 0.12 }); return; }
  const price = u.cost[l];
  if (save.cash < price) { sfx.tone(140, 0.12, { type: "square", vol: 0.15 }); g.toast(`Need ${price - save.cash} more`, 900, "bad"); return; }
  save.cash -= price; save.up[u.id] = l + 1; persist(); hud();
  sfx.play("power");
  const r = stationRect(i);
  fx.burst(r.x + r.w / 2, r.y + 40, { n: 30, colors: [PAL.yellow, PAL.lime, "#fff"], speed: 280 });
}

function useScan() {
  if (R.scans <= 0) { say(lvl("scan") ? "Scanner is empty" : "Buy a Scanner in the hideout", "#fca5a5"); return; }
  const i = R.p.choices.findIndex((v, k) => v !== R.p.x && !R.out.includes(k));
  if (i < 0) return;
  R.scans -= 1; R.out.push(i); sfx.play("power");
}

function say(t, color, size = 30) { fx.text(480, 244, t, { color, size, life: 1.2, rise: 22 }); }

// ---------- layout ----------
function cardRect(i) { const w = 190, gap = 20, x0 = 480 - (3 * w + 2 * gap) / 2; return { x: x0 + i * (w + gap), y: 414, w, h: 96 }; }
function stationRect(i) { return { x: 195 + i * 200, y: 140, w: 170, h: 210 }; }
const START_BTN = { x: 330, y: 452, w: 300, h: 62 };
const inR = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const camX = () => (R ? R.carX : 0) - CAR_SX;

g.onStart = () => {
  fx.clear();
  if (save.best > 0 || save.cash > 0) { H = { msg: "Hideout", sub: `Next run starts at: ${topicName(save.start)}` }; mode = "hide"; hud(); }
  else newRun();
};

g.loop(
  (dt) => {
    fx.update(dt);
    modeT += dt;
    const p = g.pointer.at(c);
    if (mode === "hide") {
      for (let i = 0; i < UPS.length; i++) if (g.keys.pressed(`Digit${i + 1}`)) buy(i);
      if (g.pointer.pressed) { for (let i = 0; i < UPS.length; i++) if (inR(p, stationRect(i))) buy(i); if (inR(p, START_BTN)) newRun(); }
      if (g.keys.pressed("Enter") || g.keys.pressed("Space")) newRun();
      return;
    }
    if (!R) return;
    const k = (s) => 1 - Math.exp(-s * dt);
    R.carX += (R.pos * BW - R.carX) * k(7);
    R.sweepX += ((R.pos - R.gap) * BW - R.sweepX) * k(R.lunge > 0 ? 10 : 4);
    R.lunge = Math.max(0, R.lunge - dt * 2);
    for (const k of ["flash", "boost", "happyT", "party"]) if (R[k] > 0) R[k] = Math.max(0, R[k] - dt);
    if (R.pop) { R.pop.t -= dt; if (R.pop.t <= 0) R.pop = null; }
    if (R.praise) { R.praise.t += dt; if (R.praise.t >= R.praise.life) R.praise = null; }
    for (let k = R.coins.length - 1; k >= 0; k--) { const q = R.coins[k]; q.t += dt; if (q.t >= q.life) { R.coins.splice(k, 1); sfx.tone(1400 + k * 40, 0.04, { type: "sine", vol: 0.06 }); } }
    if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }
    if (mode === "bust") { if (modeT > 1.3) toHideout(false); return; }
    if (mode === "escaped") {
      // floor it: the car pulls away and the Sweepers fall back
      R.pos += dt * (2 + modeT * 6); R.gap += dt * 3;
      if (modeT > 2.6) toHideout(true);
      return;
    }

    R.cd = Math.max(0, R.cd - dt);
    R.t += dt;

    // the chase clock
    if (R.firstMove || modeT > 6) {
      R.tickT += dt;
      R.tickFrac = R.tickT / R.interval;
      if (R.tickT >= R.interval) {
        R.tickT = 0; R.gap -= 1; R.lunge = 1;
        sfx.tone(880, 0.16, { type: "sine", vol: 0.12, slide: 620 }); sfx.tone(880, 0.16, { type: "sine", vol: 0.12, slide: 620, delay: 0.18 });
        g.shake(6, 0.2);
        if (R.gap <= 0) return bust();
        if (R.gap === 1 && R.t > Math.min(fastT(R.level), R.interval)) { dropBy(R.t > 2 * R.interval ? (R.level < 4 ? 2 : 3) : 1, true); next(); }
      }
    }
    // heartbeat when they are close
    if (R.gap <= 2) {
      heartT -= dt;
      if (heartT <= 0) { heartT = R.gap <= 1 ? 0.42 : 0.7; sfx.tone(62, 0.09, { type: "sine", vol: 0.35 }); sfx.tone(55, 0.08, { type: "sine", vol: 0.25, delay: 0.12 }); }
    }

    for (let i = 0; i < 3; i++) if (g.keys.pressed(`Digit${i + 1}`)) answer(i);
    if (g.pointer.pressed) for (let i = 0; i < 3; i++) if (inR(p, cardRect(i))) answer(i);
    if (g.keys.pressed("KeyT") || (g.pointer.pressed && inR(p, { x: 860, y: 476, w: 80, h: 44 }))) useScan();
  },
  () => {
    ctx.save();
    ctx.translate(g.shakeX, g.shakeY);
    if (mode === "hide") drawHideout(); else drawStreet();
    fx.draw(ctx);
    ctx.restore();
  }
);

// ---------- drawing ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function skyline(cam, speed, base, color, seed, hMin, hMax, windows) {
  const off = cam * speed, w = 70, first = Math.floor(off / w) - 1;
  for (let i = first; i < first + 960 / w + 3; i++) {
    const h = hMin + hash(i * 3.1 + seed) * (hMax - hMin), x = i * w - off;
    ctx.fillStyle = color; ctx.fillRect(x, base - h, w - 4, h);
    if (windows) for (let wy = base - h + 10; wy < base - 12; wy += 16) for (let wx = 8; wx < w - 14; wx += 14) {
      if (hash(i * 13 + wy * 0.7 + wx * 3.3 + seed) > 0.62) { ctx.fillStyle = hash(i + wx + wy) > 0.5 ? "rgba(253,224,71,0.55)" : "rgba(147,197,253,0.4)"; ctx.fillRect(x + wx, wy, 6, 8); }
    }
  }
}

function drawStreet() {
  const cam = camX();
  const danger = R ? clamp(1 - (R.gap - 1) / 2, 0, 1) : 0;
  const sky = ctx.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, "#070b18"); sky.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, 1000, 300);
  skyline(cam, 0.2, 262, "#151a35", 1, 60, 150, false);
  skyline(cam, 0.45, 262, "#1c2244", 7, 40, 120, true);
  ctx.fillStyle = "#2a2f45"; ctx.fillRect(-20, 250, 1000, 14);
  ctx.fillStyle = "#1a1e2e"; ctx.fillRect(-20, 264, 1000, 112);
  ctx.fillStyle = "#2a2f45"; ctx.fillRect(-20, 376, 1000, 14);
  const dash = ctx.createLinearGradient(0, 390, 0, 560);
  dash.addColorStop(0, "#111729"); dash.addColorStop(1, "#070b16");
  ctx.fillStyle = dash; ctx.fillRect(-20, 390, 1000, 170);
  const first = Math.floor(cam / BW) - 1;
  for (let b = first; b < first + 11; b++) {
    const x = b * BW - cam - 20;
    ctx.fillStyle = "#22273a"; ctx.fillRect(x, 250, 40, 140);
    ctx.fillStyle = "rgba(226,232,240,0.18)";
    for (let s = 0; s < 6; s++) ctx.fillRect(x + 4, 268 + s * 18, 32, 8);
  }
  ctx.fillStyle = "rgba(253,224,71,0.5)";
  const d0 = -((cam % 60) + 60) % 60;
  for (let x = d0 - 60; x < 1000; x += 60) ctx.fillRect(x, 318, 30, 4);

  if (!R) { drawCar(CAR_SX, 300, 0); return; }

  // the next door, one block ahead
  drawDoor((R.pos + 1) * BW - cam + 70, 0);

  const sx = R.sweepX - cam + 20;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let j = 0; j < 2; j++) {
    const a = Math.sin(g.time * (1.3 + j * 0.4) + j) * 0.25;
    const tx = CAR_SX + Math.cos(a) * 60, ty = 310 + Math.sin(g.time * 2 + j) * 40;
    const grd = ctx.createLinearGradient(sx, 300, tx, ty);
    grd.addColorStop(0, "rgba(254,226,226,0.35)"); grd.addColorStop(1, "rgba(254,226,226,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(sx + 30, 296 + j * 30);
    ctx.lineTo(tx + 40, ty - 50); ctx.lineTo(tx + 40, ty + 50); ctx.fill();
  }
  ctx.restore();

  const wob = mode === "bust" ? 0 : Math.sin(g.time * 30) * 0.8;
  if (R.boost > 0) {
    // speed lines behind the car
    ctx.save(); ctx.globalAlpha = Math.min(1, R.boost * 2);
    for (let k = 0; k < 9; k++) {
      const y = 272 + hash(k * 7.7) * 70, len = 80 + hash(k * 3.3) * 140, x = CAR_SX - 70 - ((g.time * 900 + k * 97) % 260);
      ctx.fillStyle = k % 3 ? "rgba(255,255,255,0.5)" : "rgba(253,224,71,0.7)"; ctx.fillRect(x - len, y, len, 3);
    }
    ctx.restore();
  }
  drawCar(R.carX - cam, 300 + wob, 1);
  drawSweeper(sx, 290, false);
  drawSweeper(sx - 50, 336, false);
  if (sx < 0) { ctx.fillStyle = "#fca5a5"; ctx.font = `900 16px ${FONT}`; ctx.textAlign = "left"; ctx.fillText(mode === "escaped" ? "They lost you" : `Sweepers ${R.gap} blocks back`, 12, 244); }

  if (danger > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(g.time * (R.gap <= 1 ? 14 : 8));
    const v = ctx.createRadialGradient(480, 270, 250, 480, 270, 620);
    v.addColorStop(0, "rgba(239,68,68,0)"); v.addColorStop(1, `rgba(239,68,68,${0.15 + 0.35 * danger * pulse})`);
    ctx.fillStyle = v; ctx.fillRect(-20, -20, 1000, 580);
  }

  drawEquation();
  drawClock();
  drawBanner();
  drawHand();
  drawCelebrate();
  if (mode === "bust") {
    ctx.fillStyle = "rgba(15,23,42,0.55)"; ctx.fillRect(-20, -20, 1000, 580);
    ctx.fillStyle = "#fecaca"; ctx.font = `900 72px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("BUSTED", 480, 300);
  }
}

function drawEquation() {
  const t = R.p.text;
  ctx.font = `900 46px ${FONT}`;
  const w = Math.max(340, ctx.measureText(t).width + 70);
  ctx.fillStyle = "rgba(15,23,42,0.88)"; rr(480 - w / 2, 64, w, 76, 18); ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(t, 480, 114);
  // speed bar: answer while it is green to level up
  const L = R.level, f = clamp(R.t / slowT(L), 0, 1), fz = fastT(L) / slowT(L);
  const bx = 480 - w / 2 + 18, bw = w - 36, by = 128;
  ctx.fillStyle = "rgba(148,163,184,0.18)"; ctx.fillRect(bx, by, bw, 5);
  const col = R.t <= fastT(L) ? "#84cc16" : R.t <= slowT(L) ? "#facc15" : "#ef4444";
  ctx.fillStyle = col; ctx.fillRect(bx, by, bw * (1 - f), 5);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(bx + bw * (1 - fz) - 1, by - 2, 2, 9);
  // level line
  ctx.font = `800 15px ${FONT}`; ctx.fillStyle = R.locked ? "#fdba74" : "#94a3b8";
  ctx.fillText(R.solved ? `${R.solved} door${R.solved === 1 ? "" : "s"}` : "", 480, 56);
  if (R.hint) { ctx.fillStyle = PAL.yellow; ctx.font = `800 20px ${FONT}`; ctx.fillText("What is x? Pick fast.", 480, 236); }
}

function drawClock() {
  const f = clamp(R.tickFrac || 0, 0, 1), cx = 80, cy = 100;
  ctx.strokeStyle = "rgba(148,163,184,0.25)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
  ctx.strokeStyle = f > 0.75 ? "#ef4444" : "#fca5a5"; ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(String(Math.min(ESCAPE, Math.floor(R.gap))), cx, cy + 8);
  ctx.font = `800 12px ${FONT}`; ctx.fillStyle = "#94a3b8"; ctx.fillText("blocks ahead", cx, cy + 44);
  // the escape meter: fill it and they lose you
  ctx.font = `900 12px ${FONT}`; ctx.fillStyle = "#bef264"; ctx.fillText("LOSE THEM", cx, cy + 66);
  for (let k = 0; k < ESCAPE; k++) {
    const on = k < R.gap, x = cx - 63 + k * 18;
    ctx.fillStyle = on ? (k >= ESCAPE - 2 ? "#bef264" : "#84cc16") : "rgba(148,163,184,0.25)";
    rr(x - 7, cy + 74, 14, 10, 3); ctx.fill();
  }
}

function drawBanner() {
  const b = R.banner; if (!b) return;
  const a = clamp(b.t / 0.3, 0, 1) * clamp((b.life - b.t) / 0.15, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `900 24px ${FONT}`; const w = ctx.measureText(b.text).width + 60;
  ctx.fillStyle = "rgba(15,23,42,0.92)"; rr(480 - w / 2, 152, w, 46, 14); ctx.fill();
  ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = b.color; ctx.textAlign = "center"; ctx.fillText(b.text, 480, 184);
  ctx.restore();
}

function drawHand() {
  // after a right answer, the new cards slide up once the pop is done
  if (mode === "escaped") return;
  const enter = R.pop ? clamp((0.2 - R.pop.t) / 0.2, 0, 1) : 1;
  if (enter <= 0) return drawScan();
  R.p.choices.forEach((v, i) => {
    const r = cardRect(i), out = R.out.includes(i);
    const hover = inR(g.pointer.at(c), r) && mode === "run" && !out;
    ctx.save(); ctx.translate(0, (hover ? -6 : 0) + (1 - enter) * 40);
    ctx.globalAlpha = (out ? 0.35 : 1) * enter;
    ctx.fillStyle = "#1e293b"; rr(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = hover ? "#e2e8f0" : "rgba(148,163,184,0.45)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#f8fafc"; ctx.font = `900 40px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`x = ${v < 0 ? "−" + Math.abs(v) : v}`, r.x + r.w / 2, r.y + 62);
    ctx.fillStyle = "#64748b"; ctx.font = `800 12px ${FONT}`; ctx.fillText(String(i + 1), r.x + r.w - 14, r.y + 18);
    ctx.globalAlpha = 1;
    if (out) {
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(r.x + 14, r.y + 14); ctx.lineTo(r.x + r.w - 14, r.y + r.h - 14); ctx.moveTo(r.x + r.w - 14, r.y + 14); ctx.lineTo(r.x + 14, r.y + r.h - 14); ctx.stroke();
    }
    ctx.restore();
  });
  drawScan();
}
function drawScan() {
  if (lvl("scan")) {
    ctx.fillStyle = "#1e293b"; rr(860, 476, 80, 44, 12); ctx.fill();
    ctx.fillStyle = R.scans > 0 ? "#e2e8f0" : "#64748b"; ctx.font = `900 13px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`T Scan x${R.scans}`, 900, 503);
  }
}

function easeBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function drawCelebrate() {
  // the chosen card pops up, glowing green
  if (R.pop) {
    const r = cardRect(R.pop.i), k = 1 - R.pop.t / 0.55, sc = 1 + 0.18 * Math.sin(Math.min(1, k * 1.6) * Math.PI);
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - k * 30); ctx.scale(sc, sc); ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.shadowColor = "#84cc16"; ctx.shadowBlur = 30;
    ctx.fillStyle = "#16a34a"; rr(-r.w / 2, -r.h / 2, r.w, r.h, 16); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#d9f99d"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `900 40px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`x = ${R.pop.v < 0 ? "\u2212" + Math.abs(R.pop.v) : R.pop.v}`, 0, 14);
    ctx.restore();
  }
  // a soft green flash
  if (R.flash > 0) { ctx.fillStyle = `rgba(132,204,22,${R.flash * 0.6})`; ctx.fillRect(-20, -20, 1000, 580); }
  // praise word with a bounce
  if (R.praise) {
    const t = R.praise.t, sc = t < 0.35 ? easeBack(t / 0.35) : 1, a = t > R.praise.life - 0.25 ? (R.praise.life - t) / 0.25 : 1;
    ctx.save(); ctx.translate(480, 222 - t * 12); ctx.scale(sc, sc); ctx.globalAlpha = Math.max(0, a);
    ctx.font = `900 ${R.praise.gold ? 54 : 46}px ${FONT}`; ctx.textAlign = "center"; ctx.lineJoin = "round";
    ctx.lineWidth = 10; ctx.strokeStyle = "#0f172a"; ctx.strokeText(R.praise.text, 0, 0);
    ctx.fillStyle = R.praise.gold ? "#fde047" : "#bef264"; ctx.fillText(R.praise.text, 0, 0);
    ctx.font = `900 22px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(R.praise.sub, 0, 32); ctx.fillStyle = "#fff"; ctx.fillText(R.praise.sub, 0, 32);
    ctx.restore();
  }
  // coins arc up to the cash pill
  for (const q of R.coins) {
    if (q.t < 0) continue;
    const k = q.t / q.life, e = k * k, tx = 70, ty = 28;
    const x = q.sx + (tx - q.sx) * e + q.ox * Math.sin(k * Math.PI) * 0.4, y = q.sy + (ty - q.sy) * e - Math.sin(k * Math.PI) * 120;
    ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 8 * Math.abs(Math.cos(q.t * 12)) + 2, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
}

// ---------- hideout ----------
function drawHideout() {
  ctx.fillStyle = "#2b1d1d"; ctx.fillRect(-20, -20, 1000, 580);
  for (let y = 0; y < 400; y += 22) for (let x = (y / 22) % 2 ? -30 : 0; x < 980; x += 60) { ctx.fillStyle = hash(x * 0.3 + y) > 0.5 ? "#3a2626" : "#352222"; ctx.fillRect(x, y, 56, 18); }
  ctx.fillStyle = "#1e1e24"; ctx.fillRect(-20, 400, 1000, 160);
  ctx.textAlign = "center"; ctx.fillStyle = "#fde68a"; ctx.font = `900 44px ${FONT}`; ctx.fillText(H.msg, 480, 74);
  ctx.fillStyle = "#e5e7eb"; ctx.font = `700 18px ${FONT}`; ctx.fillText(H.sub, 480, 106);
  const p = g.pointer.at(c);
  UPS.forEach((u, i) => {
    const r = stationRect(i), l = lvl(u.id), maxed = l >= u.max, price = u.cost[l];
    const y0 = r.y + (inR(p, r) ? -4 : 0);
    ctx.save(); if (l > 0) { ctx.shadowColor = "#facc15"; ctx.shadowBlur = 18; }
    ctx.fillStyle = l > 0 ? "#292524" : "#1c1917"; rr(r.x, y0, r.w, r.h, 16); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = l > 0 ? "#facc15" : "#44403c"; ctx.lineWidth = 3; rr(r.x, y0, r.w, r.h, 16); ctx.stroke();
    drawStationIcon(u.id, r.x + r.w / 2, y0 + 58, l);
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `900 20px ${FONT}`; ctx.fillText(u.name, r.x + r.w / 2, y0 + 118);
    ctx.fillStyle = "#a8a29e"; ctx.font = `700 12px ${FONT}`; wrap(u.line, r.x + r.w / 2, y0 + 138, r.w - 20, 15);
    for (let k = 0; k < u.max; k++) { ctx.fillStyle = k < l ? "#facc15" : "#44403c"; ctx.beginPath(); ctx.arc(r.x + r.w / 2 + (k - (u.max - 1) / 2) * 18, y0 + 168, 6, 0, 7); ctx.fill(); }
    ctx.fillStyle = maxed ? "#57534e" : save.cash >= price ? "#16a34a" : "#44403c";
    rr(r.x + 20, y0 + 180, r.w - 40, 24, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `900 13px ${FONT}`; ctx.fillText(maxed ? "Maxed" : `${i + 1}  Buy ${price}`, r.x + r.w / 2, y0 + 197);
  });
  ctx.save(); ctx.translate(-80, 30); drawCarAt(480 + 80, 390); ctx.restore();
  const hv = inR(p, START_BTN);
  ctx.fillStyle = hv ? "#22c55e" : "#16a34a"; rr(START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, 16); ctx.fill();
  ctx.strokeStyle = "#052e16"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 24px ${FONT}`; ctx.textAlign = "center";
  ctx.fillText("Run again", 480, START_BTN.y + 30);
  ctx.font = `700 13px ${FONT}`; ctx.fillText(`Starts at: ${topicName(save.start)}   Enter`, 480, START_BTN.y + 49);
}

function drawCar(x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, 26, 62, 10, 0, 0, 7); ctx.fill();
  // headlight beam
  const hb = ctx.createLinearGradient(50, 0, 220, 0); hb.addColorStop(0, "rgba(254,240,138,0.4)"); hb.addColorStop(1, "rgba(254,240,138,0)");
  ctx.fillStyle = hb; ctx.beginPath(); ctx.moveTo(52, 2); ctx.lineTo(230, -30); ctx.lineTo(230, 40); ctx.fill();
  // body
  ctx.fillStyle = "#facc15"; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 4;
  rr(-58, -8, 116, 32, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fde047"; rr(-30, -30, 62, 28, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#93c5fd"; rr(4, -25, 22, 18, 5); ctx.fill();
  drawArchie(ctx, -12, -22, 30, { pose: mode === "bust" ? "sad" : R && R.happyT > 0 ? "happy" : "run", t: g.time });
  ctx.fillStyle = "#0f172a";
  for (const wx of [-34, 34]) { ctx.beginPath(); ctx.arc(wx, 24, 11, 0, 7); ctx.fill(); ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.arc(wx, 24, 4, 0, 7); ctx.fill(); ctx.fillStyle = "#0f172a"; }
  ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.arc(54, 4, 5, 0, 7); ctx.fill();
  ctx.fillStyle = "#ef4444"; ctx.fillRect(-60, 0, 5, 8);
  // big x on the door
  ctx.fillStyle = PAL.navy; ctx.font = `900 20px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("x", -8, 17);
  ctx.restore();
}

function drawSweeper(x, y, boss) {
  ctx.save(); ctx.translate(x, y);
  const sc = boss ? 1.25 : 1; ctx.scale(sc, sc);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, 24, 58, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = boss ? "#1f1235" : "#111827"; ctx.strokeStyle = boss ? R.cfg.color : "#475569"; ctx.lineWidth = 3;
  rr(-55, -8, 110, 30, 10); ctx.fill(); ctx.stroke();
  rr(-28, -26, 52, 20, 8); ctx.fill(); ctx.stroke();
  const on = Math.sin(g.time * 22) > 0;
  ctx.fillStyle = on ? "#ef4444" : "#f8fafc"; ctx.fillRect(-22, -32, 18, 7);
  ctx.fillStyle = on ? "#f8fafc" : "#ef4444"; ctx.fillRect(0, -32, 18, 7);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(-2, -28, 2, -2, -28, 60);
  glow.addColorStop(0, on ? "rgba(239,68,68,0.6)" : "rgba(248,250,252,0.5)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(-62, -90, 120, 120); ctx.restore();
  ctx.fillStyle = "#0f172a"; for (const wx of [-32, 32]) { ctx.beginPath(); ctx.arc(wx, 22, 10, 0, 7); ctx.fill(); }
  if (boss) { ctx.fillStyle = R.cfg.color; ctx.font = `900 12px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(R.cfg.boss.toUpperCase(), 0, 12); }
  ctx.restore();
}

function drawDoor(x, shake) {
  const jx = shake > 0 ? Math.sin(g.time * 60) * 6 * shake : 0;
  ctx.save(); ctx.translate(x + jx, 0);
  ctx.fillStyle = "#111827"; ctx.fillRect(-10, 180, 120, 210);
  ctx.strokeStyle = PAL.lime; ctx.lineWidth = 4; ctx.strokeRect(-10, 180, 120, 210);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? "#1f2937" : "#273244"; ctx.fillRect(-6, 214 + i * 19, 112, 19); }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(132,204,22,${0.6 + 0.3 * Math.sin(g.time * 4)})`;
  ctx.font = `900 24px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("EXIT", 50, 207);
  ctx.restore(); ctx.restore();
}

function drawCarAt(x, y) { const keep = mode; drawCar(x, y, 1); mode = keep; }
function wrap(t, x, y, w, lh) {
  const words = t.split(" "); let line = "";
  for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > w && line) { ctx.fillText(line, x, y); line = wd; y += lh; } else line = test; }
  ctx.fillText(line, x, y);
}
function drawStationIcon(id, x, y, l) {
  ctx.save(); ctx.translate(x, y);
  const on = l > 0 ? "#facc15" : "#78716c";
  ctx.strokeStyle = on; ctx.fillStyle = on; ctx.lineWidth = 5; ctx.lineCap = "round";
  if (id === "engine") { rr(-28, -18, 56, 36, 6); ctx.stroke(); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 14, -18); ctx.lineTo(i * 14, -30); ctx.stroke(); } }
  else if (id === "armor") { ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(26, -20); ctx.lineTo(22, 10); ctx.lineTo(0, 30); ctx.lineTo(-22, 10); ctx.lineTo(-26, -20); ctx.closePath(); ctx.stroke(); }
  else if (id === "glove") { for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate((i - 1) * 0.25); rr(-14, -28, 28, 44, 5); ctx.stroke(); ctx.restore(); } }
  else if (id === "smoke") { for (const [cx, cy, r] of [[-14, 6, 14], [8, -4, 18], [20, 12, 12]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); } }
  else if (id === "scan") { ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -14); ctx.stroke(); }
  ctx.restore();
}


g.debug = {
  get R() { return R; }, get mode() { return mode; }, save: () => save, answer, buy,
  right: () => R.p.choices.indexOf(R.p.x),
  wrong: () => R.p.choices.findIndex((v, k) => v !== R.p.x && !R.out.includes(k)),
  reset: () => { save = { cash: 0, up: {}, start: 0, best: 0, heat: 0, wins: 0 }; persist(); },
};

// This game picks its own equations, so the arcade topic button does not apply here.
{ const t = document.querySelector('[data-a="topic"]'); if (t) t.style.display = "none"; }
