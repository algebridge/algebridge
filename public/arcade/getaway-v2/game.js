// Getaway: x is on the run. Every card is an algebra move. Clean moves gain ground,
// wasted ones let the Sweepers lunge, and each boss pulls a trick to move the exit.
import { createGame, createFx, sfx, drawArchie, PAL, FONT, clamp } from "../kit/kit.js";
import * as Q from "./eq.js";

const g = createGame({
  slug: "getaway",
  title: "Getaway",
  tagline: "Free x before the Sweepers catch up.",
  how: ["Play the card that gets x closer to alone."],
  controls: [{ keys: "1 to 5", does: "Play a card" }, { keys: "S / T", does: "Smoke / Scanner" }],
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

const JOBS = [
  { boss: "Sweeper", color: "#ef4444", tiers: [0, 1, 1], trolls: ["seal"], tick: 7, every: 8 },
  { boss: "Mirror", color: "#38bdf8", tiers: [1, 2, 2], trolls: ["flip"], tick: 5.6, every: 7 },
  { boss: "Landlord", color: "#a855f7", tiers: [2, 3, 3], trolls: ["twist", "double"], tick: 5, every: 6.5, devil: true },
];
const jobCfg = (j) => j < 3 ? JOBS[j] : { boss: "The Crew", color: "#f59e0b", tiers: [2, 3, 3], trolls: ["close", "seal", "flip", "twist", "double"], tick: Math.max(3.4, 4.4 - 0.2 * (j - 3)), every: Math.max(4.5, 6 - 0.3 * (j - 3)), devil: true };

const UPS = [
  { id: "engine", name: "Engine", line: "Sweepers gain on you slower", max: 3, cost: [60, 120, 200] },
  { id: "armor", name: "Armor", line: "Start a block further ahead", max: 2, cost: [100, 220] },
  { id: "smoke", name: "Smoke", line: "Cancel a boss trick (S)", max: 2, cost: [80, 160] },
  { id: "scan", name: "Scanner", line: "Light up a clean move (T)", max: 2, cost: [90, 180] },
];
const TROLL = {
  close: { label: "Sweepers cut a corner", good: false },
  seal: { label: "Roadblock on a card", good: false },
  flip: { label: "Mirror flips the road", good: false },
  twist: { label: "The exit is sliding", good: false },
  double: { label: "The exit is sliding", good: false },
};

let save = { cash: g.load("cash", 0), up: g.load("up", {}), job: g.load("job", 0) };
const lvl = (id) => save.up[id] || 0;
const persist = () => { g.save("cash", save.cash); g.save("up", save.up); g.save("job", save.job); };

let mode = "title"; // title, run, trans, bust, hide
let R = null; // the run
let H = { msg: "", sub: "" }; // hideout header
let modeT = 0;
let heartT = 0;

function newRun() {
  const job = save.job, cfg = jobCfg(job);
  R = {
    job, cfg, stage: 0, pos: 0, gap: 3 + lvl("armor"), cd: 0,
    tickT: 0, firstMove: false, trollCD: cfg.every, troll: null, seal: null,
    smokes: lvl("smoke"), scans: lvl("scan"), scanT: 0, earned: 0, devilUsed: false,
    carX: -BW * 3, sweepX: -BW * 6, doorX: 0, lunge: 0, doorShake: 0, hint: job === 0,
  };
  newEquation();
  R.carX = R.pos * BW - BW * 2.5;
  R.sweepX = (R.pos - R.gap) * BW - BW * 2;
  mode = "run";
  hudRun();
}

function newEquation() {
  const tier = R.cfg.tiers[R.stage];
  const p = Q.make(tier);
  R.eq = p.e; R.x = p.x; R.D = Q.dist(R.eq);
  R.hand = Q.hand(R.eq, handSize());
  R.doorX = (R.pos + R.D) * BW;
  R.troll = null;
  // tricks only in the boss district, so the first two districts are just you and the road
  R.trollCD = R.stage === 2 ? R.cfg.every * 0.6 : 999;
}

function hudRun() {
  g.setHud("Cash", save.cash);
  g.setHud("Job", R && mode !== "hide" ? R.job + 1 : save.job + 1);
}

// two cards to start, then three. One is clean, the others look right.
const handSize = () => (R.job === 0 && R.stage === 0 ? 2 : 3);
function refreshHand() { R.D = Q.dist(R.eq); R.hand = Q.hand(R.eq, handSize()); }

function play(i) {
  if (mode !== "run") return;
  const card = R.hand[i];
  if (!card) return;
  if (R.cd > 0) return;
  if (R.seal && R.seal.slot === i) { sfx.play("wrong"); say("Blocked", "#fca5a5"); g.shake(4, 0.15); return; }
  R.cd = 0.35;
  R.firstMove = true;
  const before = R.D;
  R.eq = Q.apply(R.eq, card.m);
  const after = Q.dist(R.eq);
  if (after < before) {
    R.pos += 1; R.gap = Math.min(4, R.gap + 1);
    sfx.play("whoosh"); sfx.tone(520 + (5 - after) * 90, 0.08, { type: "triangle", vol: 0.2 });
    fx.burst(CAR_SX - 50, 315, { n: 16, colors: [PAL.yellow, PAL.amber, "#fff"], speed: 260, angle: Math.PI, spread: 1.2, gravity: 0 });
    fx.text(CAR_SX, 230, "Clean", { color: PAL.lime, size: 28 });
    R.hint = false;
  } else if (after === before) {
    slip();
    sfx.tone(200, 0.18, { type: "sawtooth", vol: 0.12, slide: 120 });
    fx.text(CAR_SX, 230, "Wasted move", { color: PAL.orange, size: 24 });
    g.shake(4, 0.2);
  } else {
    slip();
    sfx.play("wrong"); g.shake(9, 0.3);
    fx.text(CAR_SX, 230, "Wrong turn", { color: PAL.red, size: 28 });
    R.doorShake = 0.5;
  }
  R.D = after;
  R.doorX = (R.pos + R.D) * BW;
  if (R.gap <= 0) return bust();
  if (checkSolved()) return;
  refreshHand();
}

// a bad card costs you a block right away: the Sweepers lunge
function slip() { R.gap -= 1; R.lunge = 1; R.tickT = Math.max(0, R.tickT - 1); }

function checkSolved() {
  if (Q.solved(R.eq) === null) return false;
  if (R.troll) { say("Dodged", PAL.lime, 34); R.earned += 15; save.cash += 15; R.troll = null; }
  // the Landlord's door: it slides once, right when you get there
  if (R.cfg.devil && R.stage === 2 && !R.devilUsed) {
    R.devilUsed = true;
    const k = 2 + Math.floor(Math.random() * 6);
    R.eq = Q.apply(R.eq, { t: "add", n: k });
    R.D = Q.dist(R.eq); R.doorX = (R.pos + R.D) * BW;
    R.gap = Math.min(4, R.gap + 1);
    say("Not so fast", "#e9d5ff", 44);
    sfx.tone(300, 0.25, { type: "square", vol: 0.15, slide: 90 });
    sfx.tone(260, 0.25, { type: "square", vol: 0.15, slide: 80, delay: 0.25 });
    g.shake(10, 0.35); R.doorShake = 0.8;
    fx.burst(R.doorX - camX(), 300, { n: 24, colors: [R.cfg.color, "#fff"], speed: 300 });
    refreshHand();
    return true;
  }
  const boss = R.stage === 2;
  const pay = 20 + 10 * R.gap + (boss ? 50 : 0);
  R.earned += pay; save.cash += pay; persist(); hudRun();
  sfx.play("win"); g.slowmo(0.4, 0.5); g.hitstop(0.05);
  fx.burst(CAR_SX + 60, 300, { n: 40, colors: [PAL.yellow, PAL.lime, "#fff", R.cfg.color], speed: 420 });
  fx.text(CAR_SX, 210, `x = ${R.x}  +${pay}`, { color: PAL.yellow, size: 36, life: 1.4 });
  mode = "trans"; modeT = 0;
  R.seal = null;
  return true;
}

function fireTroll(kind) {
  const label = TROLL[kind].label;
  if (kind === "close") { R.gap -= 1; R.lunge = 1; sfx.play("hit"); g.shake(10, 0.3); }
  else if (kind === "seal") { R.seal = { slot: R.troll.slot, t: 6 }; sfx.play("crash"); }
  else if (kind === "flip") { R.eq = Q.apply(R.eq, { t: "flip" }); sfx.play("whoosh"); g.shake(6, 0.3); refreshHand(); }
  else if (kind === "twist" || kind === "double") {
    R.eq = Q.apply(R.eq, kind === "double" ? { t: "mul", n: 2 } : { t: "addx", n: 1 + Math.floor(Math.random() * 3) });
    R.D = Q.dist(R.eq); R.doorX = (R.pos + R.D) * BW; R.doorShake = 0.6;
    sfx.tone(320, 0.3, { type: "square", vol: 0.14, slide: 110 }); g.shake(8, 0.3); refreshHand();
  }
  say(label, "#fecaca", 26);
  R.troll = null;
  if (R.gap <= 0) bust();
}

function bust() {
  mode = "bust"; modeT = 0;
  sfx.play("lose"); g.slowmo(0.3, 0.8); g.shake(16, 0.5);
  fx.burst(CAR_SX, 300, { n: 50, colors: ["#ef4444", "#fff", "#f59e0b"], speed: 380 });
}

function toHideout(won) {
  if (won) { H.msg = `Job ${R.job + 1} done`; H.sub = `You got away. +${R.earned} cash this job.`; save.job += 1; }
  else { H.msg = "Busted"; H.sub = R.earned ? `You keep the ${R.earned} you made before they caught you.` : "They caught you. Gear up and go again."; }
  persist(); mode = "hide"; modeT = 0; hudRun();
}

function buy(i) {
  const u = UPS[i]; if (!u) return;
  const l = lvl(u.id);
  if (l >= u.max) { sfx.tone(160, 0.1, { type: "square", vol: 0.12 }); return; }
  const price = u.cost[l];
  if (save.cash < price) { sfx.tone(140, 0.12, { type: "square", vol: 0.15 }); g.toast(`Need ${price - save.cash} more`, 900, "bad"); return; }
  save.cash -= price; save.up[u.id] = l + 1; persist(); hudRun();
  sfx.play("power");
  const r = stationRect(i);
  fx.burst(r.x + r.w / 2, r.y + 40, { n: 30, colors: [PAL.yellow, PAL.lime, "#fff"], speed: 280 });
}

function say(t, color, size = 30) { fx.text(480, 250, t, { color, size, life: 1.2, rise: 40 }); }

// ---------- layout ----------
function cardRect(i) {
  const n = R ? R.hand.length : 3, w = 170, gap = 18;
  const total = n * w + (n - 1) * gap, x0 = 480 - total / 2;
  return { x: x0 + i * (w + gap), y: 412, w, h: 100 };
}
function stationRect(i) { return { x: 110 + i * 190, y: 140, w: 170, h: 210 }; }
const START_BTN = { x: 330, y: 452, w: 300, h: 62 };
const inR = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const camX = () => (R ? R.carX : 0) - CAR_SX;

g.onStart = () => {
  fx.clear();
  if (save.job > 0 || save.cash > 0) { H = { msg: "Hideout", sub: "Spend your cash, then start the next job." }; mode = "hide"; hudRun(); }
  else newRun();
};

// ---------- update ----------
const engine = () => [1, 1.15, 1.3, 1.45][lvl("engine")];

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
    // animate positions
    const k = (s) => 1 - Math.exp(-s * dt);
    R.carX += (R.pos * BW - R.carX) * k(mode === "trans" ? 2 : 7);
    R.sweepX += ((R.pos - R.gap) * BW - R.sweepX) * k(R.lunge > 0 ? 10 : 4);
    R.lunge = Math.max(0, R.lunge - dt * 2);
    R.doorShake = Math.max(0, R.doorShake - dt);
    R.doorDraw = R.doorDraw == null ? R.doorX : R.doorDraw + (R.doorX - R.doorDraw) * k(R.doorShake > 0 ? 3 : 8);

    if (mode === "trans") {
      R.pos = Math.round(R.doorX / BW) + 1;
      if (modeT > 1.1) {
        R.stage += 1;
        if (R.stage >= 3) return toHideout(true);
        newEquation(); R.doorDraw = R.doorX; mode = "run";
        say(R.stage === 2 ? `Boss: ${R.cfg.boss}` : `District ${R.stage + 1}`, R.stage === 2 ? R.cfg.color : PAL.yellow, 40);
        if (R.stage === 2) { sfx.tone(180, 0.4, { type: "sawtooth", vol: 0.15, slide: 90 }); }
      }
      return;
    }
    if (mode === "bust") { if (modeT > 1.3) toHideout(false); return; }

    R.cd = Math.max(0, R.cd - dt);
    // seal timer
    if (R.seal) { R.seal.t -= dt; if (R.seal.t <= 0) R.seal = null; }
    if (R.scanT > 0) R.scanT -= dt;

    // the chase clock
    if (R.firstMove || g.time > 8) {
      const interval = R.cfg.tick * engine() * (R.stage === 2 ? 0.9 : 1);
      R.tickT += dt;
      R.tickFrac = R.tickT / interval;
      if (R.tickT >= interval) {
        R.tickT = 0; R.gap -= 1; R.lunge = 1;
        sfx.tone(880, 0.16, { type: "sine", vol: 0.12, slide: 620 }); sfx.tone(880, 0.16, { type: "sine", vol: 0.12, slide: 620, delay: 0.18 });
        g.shake(6, 0.2);
        if (R.gap <= 0) return bust();
      }
    } else R.tickFrac = 0;

    // heartbeat when they are close
    if (R.gap <= 2) {
      heartT -= dt;
      if (heartT <= 0) { heartT = R.gap <= 1 ? 0.42 : 0.7; sfx.tone(62, 0.09, { type: "sine", vol: 0.35 }); sfx.tone(55, 0.08, { type: "sine", vol: 0.25, delay: 0.12 }); }
    }

    // boss tricks: shown first, then they land
    if (R.troll) {
      R.troll.t -= dt;
      if (R.troll.t <= 0) fireTroll(R.troll.kind);
      if (mode !== "run") return;
    } else if (R.trollCD < 900) {
      R.trollCD -= dt;
      if (R.trollCD <= 0) {
        const list = R.cfg.trolls; const kind = list[Math.floor(Math.random() * list.length)];
        R.troll = { kind, t: 2.8, dur: 2.8, slot: Math.floor(Math.random() * R.hand.length) };
        R.trollCD = R.cfg.every * (R.stage === 2 ? 0.75 : 1) + Math.random() * 2;
        sfx.play("tick"); sfx.tone(440, 0.1, { type: "square", vol: 0.1, delay: 0.12 });
      }
    }

    // input
    for (let i = 0; i < R.hand.length; i++) if (g.keys.pressed(`Digit${i + 1}`)) play(i);
    if (g.pointer.pressed) for (let i = 0; i < R.hand.length; i++) if (inR(p, cardRect(i))) play(i);
    if (g.keys.pressed("KeyS") || (g.pointer.pressed && inR(p, { x: 860, y: 424, w: 80, h: 44 }))) useSmoke();
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

function useSmoke() {
  if (!R.troll) return;
  if (R.smokes <= 0) { say(lvl("smoke") ? "Out of smoke" : "Buy Smoke in the hideout", "#fca5a5"); return; }
  R.smokes -= 1; R.troll = null;
  sfx.noise(0.5, { freq: 900, vol: 0.25 });
  fx.burst(CAR_SX - 80, 300, { n: 40, colors: ["#cbd5e1", "#94a3b8", "#e2e8f0"], speed: 200, gravity: -80, size: 12, life: 1 });
  say("Smoked out", "#e2e8f0", 30);
}
function useScan() {
  if (R.scans <= 0) { say(lvl("scan") ? "Scanner is empty" : "Buy a Scanner in the hideout", "#fca5a5"); return; }
  R.scans -= 1; R.scanT = 3.5; sfx.play("power");
}

// ---------- drawing ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function skyline(cam, speed, base, color, seed, hMin, hMax, windows) {
  const off = cam * speed;
  const w = 70;
  const first = Math.floor(off / w) - 1;
  for (let i = first; i < first + 960 / w + 3; i++) {
    const h = hMin + hash(i * 3.1 + seed) * (hMax - hMin);
    const x = i * w - off;
    ctx.fillStyle = color; ctx.fillRect(x, base - h, w - 4, h);
    if (windows) {
      for (let wy = base - h + 10; wy < base - 12; wy += 16) for (let wx = 8; wx < w - 14; wx += 14) {
        if (hash(i * 13 + wy * 0.7 + wx * 3.3 + seed) > 0.62) { ctx.fillStyle = hash(i + wx + wy) > 0.5 ? "rgba(253,224,71,0.55)" : "rgba(147,197,253,0.4)"; ctx.fillRect(x + wx, wy, 6, 8); }
      }
    }
  }
}

function drawStreet() {
  const cam = camX();
  const danger = R ? clamp(1 - (R.gap - 1) / 2, 0, 1) : 0;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, "#070b18"); sky.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, 1000, 300);
  skyline(cam, 0.2, 262, "#151a35", 1, 60, 150, false);
  skyline(cam, 0.45, 262, "#1c2244", 7, 40, 120, true);
  // sidewalks and road
  ctx.fillStyle = "#2a2f45"; ctx.fillRect(-20, 250, 1000, 14);
  ctx.fillStyle = "#1a1e2e"; ctx.fillRect(-20, 264, 1000, 112);
  ctx.fillStyle = "#2a2f45"; ctx.fillRect(-20, 376, 1000, 14);
  const dash = ctx.createLinearGradient(0, 390, 0, 560);
  dash.addColorStop(0, "#111729"); dash.addColorStop(1, "#070b16");
  ctx.fillStyle = dash; ctx.fillRect(-20, 390, 1000, 170);
  // cross streets every block
  const first = Math.floor(cam / BW) - 1;
  for (let b = first; b < first + 11; b++) {
    const x = b * BW - cam - 20;
    ctx.fillStyle = "#22273a"; ctx.fillRect(x, 250, 40, 140);
    ctx.fillStyle = "rgba(226,232,240,0.18)";
    for (let s = 0; s < 6; s++) ctx.fillRect(x + 4, 268 + s * 18, 32, 8);
  }
  // lane dashes
  ctx.fillStyle = "rgba(253,224,71,0.5)";
  const d0 = -((cam % 60) + 60) % 60;
  for (let x = d0 - 60; x < 1000; x += 60) ctx.fillRect(x, 318, 30, 4);

  if (!R) { drawCar(CAR_SX, 318, 0); ctx.fillStyle = "rgba(0,0,0,0)"; return; }

  // exit door
  const dx = (R.doorDraw ?? R.doorX) - cam + 70;
  drawDoor(dx, R.doorShake);
  if (dx > 940) {
    ctx.fillStyle = PAL.lime; ctx.font = `900 18px ${FONT}`; ctx.textAlign = "right";
    ctx.fillText(`EXIT ${R.D} blocks`, 948, 244);
    ctx.beginPath(); ctx.moveTo(950, 300); ctx.lineTo(930, 288); ctx.lineTo(930, 312); ctx.fill();
  }
  // blocks to go, drawn on the road
  for (let i = 1; i <= R.D; i++) {
    const bx = (R.pos + i) * BW - cam + 10;
    if (bx < 0 || bx > 960) continue;
    ctx.fillStyle = "rgba(132,204,22,0.18)"; rr(bx - 26, 280, 52, 28, 8); ctx.fill();
    ctx.fillStyle = "rgba(190,242,100,0.8)"; ctx.font = `800 15px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(String(R.D - i + 1), bx, 299);
  }

  // searchlights
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

  // car
  const wob = mode === "bust" ? 0 : Math.sin(g.time * 30) * 0.8;
  drawCar(R.carX - cam, 300 + wob, 1);
  // sweepers
  drawSweeper(sx, 290, false);
  drawSweeper(sx - 50, 336, R.stage === 2);
  if (sx < 0) {
    ctx.fillStyle = "#fca5a5"; ctx.font = `900 16px ${FONT}`; ctx.textAlign = "left";
    ctx.fillText(`Sweepers ${R.gap} blocks back`, 12, 244);
  }

  // danger vignette
  if (danger > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(g.time * (R.gap <= 1 ? 14 : 8));
    const v = ctx.createRadialGradient(480, 270, 250, 480, 270, 620);
    v.addColorStop(0, "rgba(239,68,68,0)"); v.addColorStop(1, `rgba(239,68,68,${0.15 + 0.35 * danger * pulse})`);
    ctx.fillStyle = v; ctx.fillRect(-20, -20, 1000, 580);
  }

  drawEquation();
  drawHeat();
  drawTroll();
  drawHand();
  if (mode === "bust") {
    ctx.fillStyle = "rgba(15,23,42,0.55)"; ctx.fillRect(-20, -20, 1000, 580);
    ctx.fillStyle = "#fecaca"; ctx.font = `900 72px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("BUSTED", 480, 300);
  }
}

function drawEquation() {
  const t = Q.text(R.eq);
  ctx.font = `900 44px ${FONT}`;
  const w = Math.max(320, ctx.measureText(t).width + 60);
  ctx.fillStyle = "rgba(15,23,42,0.85)"; rr(480 - w / 2, 64, w, 70, 18); ctx.fill();
  ctx.strokeStyle = R.stage === 2 ? R.cfg.color : "rgba(148,163,184,0.5)"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(t, 480, 115);
  ctx.font = `800 15px ${FONT}`; ctx.fillStyle = "#94a3b8";
  const where = R.stage === 2 ? `Boss: ${R.cfg.boss}` : `District ${R.stage + 1} of 3`;
  ctx.fillText(`Job ${R.job + 1}   ${where}`, 480, 56);
  if (R.hint) { ctx.fillStyle = PAL.yellow; ctx.font = `800 20px ${FONT}`; ctx.fillText("Play the card that frees x", 480, 236); }
}

function drawHeat() {
  // the chase clock: a ring that fills before the Sweepers gain a block
  const f = clamp(R.tickFrac || 0, 0, 1);
  const cx = 80, cy = 100;
  ctx.strokeStyle = "rgba(148,163,184,0.25)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
  ctx.strokeStyle = f > 0.75 ? "#ef4444" : "#fca5a5"; ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(String(R.gap), cx, cy + 8);
  ctx.font = `800 12px ${FONT}`; ctx.fillStyle = "#94a3b8"; ctx.fillText("blocks ahead", cx, cy + 44);
}

function drawTroll() {
  if (!R.troll || mode !== "run") return;
  const f = R.troll.t / R.troll.dur;
  ctx.fillStyle = Math.sin(g.time * 18) > 0 ? "rgba(127,29,29,0.95)" : "rgba(153,27,27,0.95)";
  rr(280, 150, 400, 44, 12); ctx.fill();
  ctx.strokeStyle = R.cfg.color; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 20px ${FONT}`; ctx.textAlign = "center";
  ctx.fillText(TROLL[R.troll.kind].label, 480, 176);
  ctx.fillStyle = "#fde047"; ctx.fillRect(296, 185, 368 * f, 4);
  if (R.smokes > 0) { ctx.font = `700 13px ${FONT}`; ctx.fillStyle = "#fecaca"; ctx.fillText("S for smoke", 480, 210); }
}

function drawHand() {
  R.hand.forEach((cd, i) => {
    const r = cardRect(i);
    const sealed = R.seal && R.seal.slot === i;
    const marked = R.troll && R.troll.kind === "seal" && R.troll.slot === i;
    const scan = R.scanT > 0 && cd.gain > 0;
    const hover = inR(g.pointer.at(c), r) && mode === "run";
    const lift = hover && !sealed ? -6 : 0;
    ctx.save(); ctx.translate(0, lift);
    ctx.globalAlpha = sealed ? 0.5 : R.cd > 0 ? 0.8 : 1;
    ctx.fillStyle = "#1e293b"; rr(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = scan ? PAL.lime : marked && Math.sin(g.time * 16) > 0 ? "#ef4444" : hover ? "#e2e8f0" : "rgba(148,163,184,0.45)";
    ctx.lineWidth = scan || marked ? 4 : 2; ctx.stroke();
    const dist = cd.m.t === "dist";
    ctx.fillStyle = "#f8fafc"; ctx.font = `900 ${dist ? 26 : 40}px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(cd.big, r.x + r.w / 2, r.y + (dist ? 56 : 66));
    if (dist) { ctx.fillStyle = "#94a3b8"; ctx.font = `700 14px ${FONT}`; ctx.fillText(cd.small, r.x + r.w / 2, r.y + 80); }
    ctx.fillStyle = "#64748b"; ctx.font = `800 12px ${FONT}`; ctx.fillText(String(i + 1), r.x + r.w - 14, r.y + 18);
    ctx.globalAlpha = 1;
    if (sealed) {
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(r.x + 12, r.y + 12); ctx.lineTo(r.x + r.w - 12, r.y + r.h - 12); ctx.moveTo(r.x + r.w - 12, r.y + 12); ctx.lineTo(r.x + 12, r.y + r.h - 12); ctx.stroke();
      ctx.fillStyle = "#fecaca"; ctx.font = `900 14px ${FONT}`; ctx.fillText(`${Math.ceil(R.seal.t)}s`, r.x + r.w / 2, r.y + r.h - 8);
    }
    ctx.restore();
  });
  // smoke and scanner only show up once you own them
  const btn = (y, label, n) => {
    ctx.fillStyle = "#1e293b"; rr(860, y, 80, 44, 12); ctx.fill();
    ctx.fillStyle = n > 0 ? "#e2e8f0" : "#64748b"; ctx.font = `900 13px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`${label} x${n}`, 900, y + 27);
  };
  if (lvl("smoke")) btn(424, "S Smoke", R.smokes);
  if (lvl("scan")) btn(476, "T Scan", R.scans);
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
  drawArchie(ctx, -12, -22, 30, { pose: mode === "bust" ? "sad" : "run", t: g.time });
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

// ---------- hideout ----------
function drawHideout() {
  // brick wall
  ctx.fillStyle = "#2b1d1d"; ctx.fillRect(-20, -20, 1000, 580);
  for (let y = 0; y < 400; y += 22) for (let x = (y / 22) % 2 ? -30 : 0; x < 980; x += 60) { ctx.fillStyle = hash(x * 0.3 + y) > 0.5 ? "#3a2626" : "#352222"; ctx.fillRect(x, y, 56, 18); }
  ctx.fillStyle = "#1e1e24"; ctx.fillRect(-20, 400, 1000, 160);
  ctx.fillStyle = "rgba(255,255,255,0.04)"; for (let x = 0; x < 960; x += 80) ctx.fillRect(x, 400, 2, 160);
  // header
  ctx.textAlign = "center"; ctx.fillStyle = "#fde68a"; ctx.font = `900 44px ${FONT}`; ctx.fillText(H.msg, 480, 74);
  ctx.fillStyle = "#e5e7eb"; ctx.font = `700 18px ${FONT}`; ctx.fillText(H.sub, 480, 104);
  ctx.fillStyle = "#facc15"; ctx.font = `900 20px ${FONT}`; ctx.fillText(`Cash ${save.cash}`, 480, 128);
  const p = g.pointer.at(c);
  UPS.forEach((u, i) => {
    const r = stationRect(i), l = lvl(u.id), maxed = l >= u.max, price = u.cost[l];
    const hover = inR(p, r);
    // neon sign lights up once you own it
    ctx.save(); if (l > 0) { ctx.shadowColor = "#facc15"; ctx.shadowBlur = 18; }
    ctx.fillStyle = l > 0 ? "#292524" : "#1c1917"; rr(r.x, r.y + (hover ? -4 : 0), r.w, r.h, 16); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = l > 0 ? "#facc15" : "#44403c"; ctx.lineWidth = 3; rr(r.x, r.y + (hover ? -4 : 0), r.w, r.h, 16); ctx.stroke();
    const y0 = r.y + (hover ? -4 : 0);
    drawStationIcon(u.id, r.x + r.w / 2, y0 + 58, l);
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `900 20px ${FONT}`; ctx.fillText(u.name, r.x + r.w / 2, y0 + 118);
    ctx.fillStyle = "#a8a29e"; ctx.font = `700 12px ${FONT}`; wrap(u.line, r.x + r.w / 2, y0 + 138, r.w - 20, 15);
    for (let k = 0; k < u.max; k++) { ctx.fillStyle = k < l ? "#facc15" : "#44403c"; ctx.beginPath(); ctx.arc(r.x + r.w / 2 + (k - (u.max - 1) / 2) * 18, y0 + 168, 6, 0, 7); ctx.fill(); }
    ctx.fillStyle = maxed ? "#57534e" : save.cash >= price ? "#16a34a" : "#44403c";
    rr(r.x + 20, y0 + 180, r.w - 40, 24, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `900 13px ${FONT}`; ctx.fillText(maxed ? "Maxed" : `${i + 1}  Buy ${price}`, r.x + r.w / 2, y0 + 197);
  });
  // your car
  ctx.save(); ctx.translate(-80, 30); drawCarAt(480 + 80, 390); ctx.restore();
  // start
  const hv = inR(p, START_BTN);
  ctx.fillStyle = hv ? "#22c55e" : "#16a34a"; rr(START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, 16); ctx.fill();
  ctx.strokeStyle = "#052e16"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 24px ${FONT}`; ctx.textAlign = "center";
  const nc = jobCfg(save.job);
  ctx.fillText(`Start Job ${save.job + 1}`, 480, START_BTN.y + 30);
  ctx.font = `700 13px ${FONT}`; ctx.fillText(`Boss: ${nc.boss}   Enter`, 480, START_BTN.y + 49);
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
  get R() { return R; }, get mode() { return mode; }, save: () => save, play, buy,
  best: () => R.hand.findIndex((h) => h.gain > 0),
  reset: () => { save = { cash: 0, up: {}, job: 0 }; persist(); },
};

// This game picks its own equations, so the arcade topic button does not apply here.
{ const t = document.querySelector('[data-a="topic"]'); if (t) t.style.display = "none"; }
