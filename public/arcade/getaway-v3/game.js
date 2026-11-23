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

let save = { cash: g.load("cash", 0), up: g.load("up", {}), start: g.load("start", 0), best: g.load("best", 0) };
const lvl = (id) => save.up[id] || 0;
const persist = () => { for (const k of ["cash", "up", "start", "best"]) g.save(k, save[k]); };

let mode = "title"; // title, run, bust, hide
let R = null;
let H = { msg: "", sub: "" };
let modeT = 0;
let heartT = 0;

// how fast counts as fast: harder rungs get more time
const fastT = (L) => 3.5 + 0.8 * Math.min(L, 9);
const slowT = (L) => fastT(L) * 1.8;
const engine = () => [1, 1.15, 1.3, 1.45][lvl("engine")];
const baseTick = (L) => Math.max(3.6, 7.5 - 0.35 * L) * engine();
const topicName = (L) => (L >= TOPICS.length ? "Mixed" : TOPICS[L].name);

function newRun() {
  R = {
    level: save.start, startLevel: save.start, locked: false, streak: 0, solved: 0,
    pos: 0, gap: 3 + lvl("armor"), tickT: 0, tickFrac: 0, interval: baseTick(save.start),
    t: 0, wrongs: 0, out: [], cd: 0, scans: lvl("scan"), firstMove: false,
    carX: -BW * 2.5, sweepX: -BW * 6, lunge: 0, doorShake: 0, earned: 0,
    banner: null, hint: save.start === 0 && save.best === 0,
  };
  next();
  R.sweepX = (R.pos - R.gap) * BW - BW * 2;
  mode = "run"; modeT = 0;
  if (R.level > 0) banner(`Starting at: ${topicName(R.level)}`, PAL.sky);
  hud();
}

function next() {
  R.p = problem(R.level);
  R.t = 0; R.wrongs = 0; R.out = [];
}

function hud() {
  g.setHud("Cash", save.cash);
  g.setHud("Blocks", R && mode !== "hide" ? R.solved : null);
}

function banner(text, color, life = 2) { R.banner = { text, color, t: life, life }; }

function answer(i) {
  if (mode !== "run" || R.cd > 0) return;
  const v = R.p.choices[i];
  if (v === undefined || R.out.includes(i)) return;
  R.cd = 0.25; R.firstMove = true; R.hint = false;
  if (v !== R.p.x) {
    // a trap answer: cross it out, and the Sweepers lunge a block
    R.out.push(i); R.wrongs += 1; R.streak = 0;
    R.gap -= 1; R.lunge = 1; R.tickT = Math.max(0, R.tickT - 1);
    sfx.play("wrong"); g.shake(9, 0.3);
    say(`x is not ${v < 0 ? "\u2212" + Math.abs(v) : v}`, "#fca5a5");
    if (R.gap <= 0) bust();
    return;
  }
  const time = R.t, L = R.level;
  const fast = R.wrongs === 0 && time <= fastT(L);
  const slow = R.wrongs >= 2 || time > slowT(L);
  R.solved += 1; R.pos += 1; R.gap = Math.min(4, R.gap + 1);
  const pay = 5 + 3 * L + (fast ? 5 : 0);
  R.earned += pay; save.cash += pay;
  sfx.play("crash"); sfx.tone(520 + Math.min(R.streak, 4) * 120, 0.1, { type: "triangle", vol: 0.2 });
  g.hitstop(0.04);
  const dX = (R.pos) * BW - camX() + 70;
  fx.burst(dX + 50, 290, { n: 26, colors: [PAL.lime, "#d9f99d", "#fff"], speed: 380 });
  fx.text(CAR_SX, 240, (fast ? "Fast  " : "") + `x = ${R.p.x < 0 ? "\u2212" + Math.abs(R.p.x) : R.p.x}`, { color: fast ? PAL.yellow : PAL.lime, size: fast ? 32 : 26, rise: 22 });

  if (!R.locked) {
    if (fast) {
      R.streak += 1;
      // two fast in a row to climb early on, three once it gets real
      if (R.streak >= (R.level < 3 ? 2 : 3)) {
        R.streak = 0; R.level += 1;
        R.interval = baseTick(R.level);
        sfx.play("power"); g.slowmo(0.4, 0.5);
        banner(R.level >= TOPICS.length ? "Mixed, all of it" : `New: ${topicName(R.level)}`, PAL.yellow);
      }
    } else if (slow) {
      // they slowed down a lot: this is their level now, and the chase keeps tightening
      R.locked = true;
      banner(`Holding at: ${topicName(L)}`, PAL.orange, 2.4);
    } else R.streak = 0;
  } else {
    R.interval = Math.max(2.4, R.interval * 0.95);
  }
  save.best = Math.max(save.best, R.level);
  persist(); hud();
  next();
}

function bust() {
  mode = "bust"; modeT = 0;
  sfx.play("lose"); g.slowmo(0.3, 0.8); g.shake(16, 0.5);
  fx.burst(CAR_SX, 300, { n: 50, colors: ["#ef4444", "#fff", "#f59e0b"], speed: 380 });
  save.start = R.level; persist();
}

function toHideout() {
  H.msg = "Busted";
  H.sub = `${R.solved} blocks. Caught on ${topicName(R.level)}. Next run starts there.`;
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
    if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }
    if (mode === "bust") { if (modeT > 1.3) toHideout(); return; }

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
  drawCar(R.carX - cam, 300 + wob, 1);
  drawSweeper(sx, 290, false);
  drawSweeper(sx - 50, 336, false);
  if (sx < 0) { ctx.fillStyle = "#fca5a5"; ctx.font = `900 16px ${FONT}`; ctx.textAlign = "left"; ctx.fillText(`Sweepers ${R.gap} blocks back`, 12, 244); }

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
  ctx.strokeStyle = R.locked ? "rgba(251,146,60,0.7)" : "rgba(148,163,184,0.5)"; ctx.lineWidth = 3; ctx.stroke();
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
  ctx.fillText(R.locked ? `Level ${L + 1}   ${topicName(L)}   holding` : `Level ${L + 1}   ${topicName(L)}`, 480, 56);
  if (R.hint) { ctx.fillStyle = PAL.yellow; ctx.font = `800 20px ${FONT}`; ctx.fillText("What is x? Pick fast.", 480, 236); }
}

function drawClock() {
  const f = clamp(R.tickFrac || 0, 0, 1), cx = 80, cy = 100;
  ctx.strokeStyle = "rgba(148,163,184,0.25)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
  ctx.strokeStyle = f > 0.75 ? "#ef4444" : "#fca5a5"; ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = `900 22px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(String(R.gap), cx, cy + 8);
  ctx.font = `800 12px ${FONT}`; ctx.fillStyle = "#94a3b8"; ctx.fillText("blocks ahead", cx, cy + 44);
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
  R.p.choices.forEach((v, i) => {
    const r = cardRect(i), out = R.out.includes(i);
    const hover = inR(g.pointer.at(c), r) && mode === "run" && !out;
    ctx.save(); ctx.translate(0, hover ? -6 : 0);
    ctx.globalAlpha = out ? 0.35 : 1;
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
  if (lvl("scan")) {
    ctx.fillStyle = "#1e293b"; rr(860, 476, 80, 44, 12); ctx.fill();
    ctx.fillStyle = R.scans > 0 ? "#e2e8f0" : "#64748b"; ctx.font = `900 13px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`T Scan x${R.scans}`, 900, 503);
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
  reset: () => { save = { cash: 0, up: {}, start: 0, best: 0 }; persist(); },
};

// This game picks its own equations, so the arcade topic button does not apply here.
{ const t = document.querySelector('[data-a="topic"]'); if (t) t.style.display = "none"; }
