// Hoop Duel: 3 on 3 arcade basketball on a full scrolling court.
// Real rules, short quarters, and a quick "hot hand" problem during dead balls.
import { createGame, createFx, math, sfx, FONT, clamp, lerp, damp, rand, choose } from "../kit/kit.js";
import { W, H, L, D, HZ, RIM_Y, THREE_R, CORNER, KEY_X, KEY_Z0, KEY_Z1, HOOPS, zs, sy, rr, drawArena, drawFloor, drawHoop, drawBall, poseOf, drawAthlete } from "./art.js";

// ---------- teams ----------
const SK = ["#f3c9a5", "#c98f63", "#8a5a3c", "#e8b48c", "#a86f48", "#f1d2b6"];
const mk = (name, num, role, skin, hair, style) => ({ name, num, role, skin: SK[skin], hair, style });
const HOME = { name: "Comets", abbr: "BCC", jersey: "#2563eb", trim: "#fde047", shorts: "#1d4ed8", roster: [mk("Juno", 7, "G", 0, "#3b2416", "puffs"), mk("Milo", 14, "F", 2, "#111827", "flat"), mk("Tessa", 31, "C", 1, "#7c2d12", "pony")] };
const RIVALS = [
  { name: "Herons", jersey: "#0d9488", trim: "#ffffff", shorts: "#0f766e", skill: 0.08, roster: [mk("Benny", 4, "G", 3, "#92400e", "buzz"), mk("Priya", 22, "F", 4, "#1c1917", "bun"), mk("Otto", 50, "C", 0, "#facc15", "spikes")] },
  { name: "Owls", jersey: "#7c3aed", trim: "#fde68a", shorts: "#5b21b6", skill: 0.24, roster: [mk("Marcus", 10, "G", 2, "#0f172a", "afro"), mk("Sofia", 15, "F", 5, "#facc15", "pony"), mk("Dre", 42, "C", 4, "#1c1917", "band")] },
  { name: "Foxes", jersey: "#dc2626", trim: "#ffffff", shorts: "#991b1b", skill: 0.4, roster: [mk("Theo", 2, "G", 0, "#dc2626", "spikes"), mk("Lena", 21, "F", 1, "#3b2416", "bun"), mk("Bo", 34, "C", 2, "#111827", "flat")] },
  { name: "Otters", jersey: "#16a34a", trim: "#fef9c3", shorts: "#166534", skill: 0.56, roster: [mk("Nia", 9, "G", 4, "#1c1917", "puffs"), mk("Cal", 17, "F", 3, "#92400e", "band"), mk("Gus", 45, "C", 5, "#78350f", "buzz")] },
  { name: "Yaks", jersey: "#475569", trim: "#fbbf24", shorts: "#334155", skill: 0.72, roster: [mk("Ravi", 6, "G", 1, "#111827", "flat"), mk("June", 20, "F", 0, "#7c2d12", "pony"), mk("Tank", 55, "C", 2, "#0f172a", "bald")] },
  { name: "Moths", jersey: "#be185d", trim: "#f5f5f4", shorts: "#831843", skill: 0.88, roster: [mk("Zed", 1, "G", 3, "#e2e8f0", "spikes"), mk("Ivy", 13, "F", 4, "#1c1917", "afro"), mk("Moe", 40, "C", 1, "#3b2416", "band")] },
];
const JERSEYS = { home: { jersey: "#2563eb", trim: "#fde047", shorts: "#1d4ed8" }, sunset: { jersey: "#e11d48", trim: "#ffedd5", shorts: "#9f1239" }, mint: { jersey: "#10b981", trim: "#ecfdf5", shorts: "#047857" }, midnight: { jersey: "#312e81", trim: "#a5b4fc", shorts: "#1e1b4b" } };
const UNLOCKS = [
  { id: "archie", name: "Archie courtside", need: 30, kind: "extra" },
  { id: "ball_beach", name: "Beach ball", need: 90, kind: "ball", v: "beach" },
  { id: "jersey_sunset", name: "Sunset jerseys", need: 160, kind: "jersey", v: "sunset" },
  { id: "court_street", name: "Street court", need: 240, kind: "court", v: "street" },
  { id: "ball_galaxy", name: "Galaxy ball", need: 340, kind: "ball", v: "galaxy" },
  { id: "jersey_mint", name: "Mint jerseys", need: 450, kind: "jersey", v: "mint" },
  { id: "court_ocean", name: "Ocean court", need: 580, kind: "court", v: "ocean" },
  { id: "ball_gold", name: "Gold ball", need: 720, kind: "ball", v: "gold" },
  { id: "jersey_midnight", name: "Midnight jerseys", need: 880, kind: "jersey", v: "midnight" },
];
const DIFFS = [{ name: "Easy", k: 0.1, win: 0.115 }, { name: "Normal", k: 0.45, win: 0.09 }, { name: "Hard", k: 0.82, win: 0.07 }];
const KEYS1 = { l: ["ArrowLeft"], r: ["ArrowRight"], u: ["ArrowUp"], d: ["ArrowDown"], pass: ["KeyS"], shoot: ["KeyD", "Space"], ans: ["Digit1", "Digit2", "Digit3"], n: { move: "Arrows", pass: "S", shoot: "D", ans: ["1", "2", "3"] } };
const KEYSA = { l: ["KeyA"], r: ["KeyD"], u: ["KeyW"], d: ["KeyS"], pass: ["KeyF"], shoot: ["KeyG"], ans: ["Digit1", "Digit2", "Digit3"], n: { move: "WASD", pass: "F", shoot: "G", ans: ["1", "2", "3"] } };
const KEYSB = { l: ["ArrowLeft"], r: ["ArrowRight"], u: ["ArrowUp"], d: ["ArrowDown"], pass: ["KeyK"], shoot: ["KeyL"], ans: ["Digit8", "Digit9", "Digit0"], n: { move: "Arrows", pass: "K", shoot: "L", ans: ["8", "9", "0"] } };

const PERIOD = 60, OT = 30, SHOT = 14, T_WIND = 0.16, JV = 360, JG = 1100, T_TOP = T_WIND + JV / JG, BG = 900, BR = 9.5;
const SPOTS = [{ d: 560, z: 220 }, { d: 430, z: 70 }, { d: 430, z: 370 }, { d: 120, z: 20 }, { d: 120, z: 420 }, { d: 215, z: 118 }, { d: 215, z: 322 }, { d: 345, z: 220 }];

const ld = (k, fb) => { try { const v = localStorage.getItem("arcade:hoop-duel:" + k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
const sv = (k, v) => { try { localStorage.setItem("arcade:hoop-duel:" + k, JSON.stringify(v)); } catch {} };
const cfg = { mode: "season", diff: 0 };
let P = [], B = null, S = null, camX = L / 2 - W / 2, posterOn = false, mute = false, TEAMS = [HOME, RIVALS[0]], dbg = { auto: null };
const g = createGame({
  slug: "hoop-duel", title: "Hoop Duel", tagline: "Three on three. Full court. Get the hot hand.",
  instant: true, prompt: "Press any key for the tip-off", keepF: true, aspect: 16 / 9, bg: "#0b1024",
  controls: [{ keys: "Arrows", does: "Move" }, { keys: "S", does: "Pass, switch" }, { keys: "D", does: "Shoot, steal, block" }],
  onMenu: buildMenu,
});
const c = g.canvas2d(W, H), ctx = c.ctx;
const fx = createFx(300);
g.unlocks(UNLOCKS);

const hoopFx = [{ rattle: 0, swish: 0 }, { rattle: 0, swish: 0 }];
const snd = (n) => { if (!mute) sfx.play(n); };
const tone = (f, d, o) => { if (!mute) sfx.tone(f, d, o); };
const noise = (d, o) => { if (!mute) sfx.noise(d, o); };
const whistle = () => { tone(2100, 0.22, { type: "square", vol: 0.25 }); tone(2350, 0.22, { type: "square", vol: 0.2 }); };
const buzzer = () => { tone(160, 0.9, { type: "sawtooth", vol: 0.5 }); tone(164, 0.9, { type: "square", vol: 0.3 }); };
const swishSnd = () => { noise(0.22, { freq: 3200, vol: 0.5 }); tone(880, 0.1, { vol: 0.3, delay: 0.05 }); tone(1320, 0.16, { vol: 0.3, delay: 0.13 }); };
const pick = () => ({ jersey: "home", ball: "classic", court: "wood", ...ld("pick", {}) });
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const atk = (team) => HOOPS[(team === 0) !== S.flipped ? 1 : 0];
const wx = (h, d) => (h.dir === 1 ? d : L - d);
const hd = (p, h) => Math.hypot(p.x - h.x, p.z - HZ);
const isThree = (p, h) => hd(p, h) > THREE_R || Math.abs(p.z - HZ) > CORNER;
const mates = (p) => P.filter((q) => q.team === p.team && q !== p);
const foes = (team) => P.filter((q) => q.team !== team);
const human = (team) => S.human[team];
const isCtrl = (p) => !!human(p.team) && S.ctrl[p.team] === p;
function nearFoe(p) { let b = null, bd = 1e9; for (const q of P) if (q.team !== p.team) { const d = dist(p, q); if (d < bd) { bd = d; b = q; } } return { q: b, d: bd }; }
function segDist(a, b, q) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1; const t = clamp(((q.x - a.x) * dx + (q.z - a.z) * dz) / l2, 0, 1); return { d: Math.hypot(q.x - a.x - dx * t, q.z - a.z - dz * t), t }; }

// ---------- menu ----------
function buildMenu(el) {
  cfg.mode = ld("mode", "season"); cfg.diff = ld("diff", 0);
  const seg = "font:inherit;font-weight:800;font-size:clamp(11px,1.5cqw,16px);border-radius:999px;padding:.3em .9em;cursor:pointer;border:2px solid #bfdbfe;";
  const on = "background:#2563eb;color:#fff;border-color:#1e3a8a;", off = "background:#eff6ff;color:#1e3a8a;";
  const row = "display:flex;gap:.4em;justify-content:center;flex-wrap:wrap;margin:.35em 0;align-items:center;";
  const paint = () => {
    const si = clamp(ld("season", 0), 0, RIVALS.length - 1), cups = ld("cups", 0);
    el.innerHTML = `<div style="${row}">
      <button data-m="season" style="${seg}${cfg.mode === "season" ? on : off}">Season: game ${si + 1} of ${RIVALS.length}, ${RIVALS[si].name}</button>
      <button data-m="quick" style="${seg}${cfg.mode === "quick" ? on : off}">Quick game</button>
      <button data-m="two" style="${seg}${cfg.mode === "two" ? on : off}">2 players</button>
      <button data-k="1" style="${seg}${off}">Locker</button></div>
      ${cfg.mode === "quick" ? `<div style="${row}">${DIFFS.map((d, i) => `<button data-d="${i}" style="${seg}${cfg.diff === i ? on : off}">${d.name}</button>`).join("")}</div>` : ""}
      ${cfg.mode === "two" ? `<p style="margin:.2em 0;font-weight:800;color:#e2e8f0;font-size:clamp(11px,1.4cqw,15px)">Player 1: WASD, F pass, G shoot. Player 2: arrows, K pass, L shoot.</p>` : ""}
      ${cfg.mode === "season" && cups ? `<p style="margin:.2em 0;font-weight:800;color:#fde047;font-size:clamp(11px,1.4cqw,15px)">Season trophies: ${cups}</p>` : ""}`;
  };
  paint();
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.stopPropagation();
    snd("click");
    if (b.dataset.k) return locker();
    if (b.dataset.m) { cfg.mode = b.dataset.m; sv("mode", cfg.mode); }
    if (b.dataset.d) { cfg.diff = +b.dataset.d; sv("diff", cfg.diff); }
    paint(); setupScene(); g.redraw();
  };
}
function locker() {
  const draw = () => {
    const pk = pick(), xp = g.xp;
    const item = (kind, v, name, need) => {
      const open = xp >= need, sel = pk[kind] === v;
      return `<button data-kind="${kind}" data-v="${v}" ${open ? "" : "disabled"} style="font:inherit;font-weight:800;border-radius:12px;padding:.45em .8em;margin:.2em;cursor:${open ? "pointer" : "default"};border:2px solid ${sel ? "#1e3a8a" : "#bfdbfe"};background:${sel ? "#2563eb" : "#eff6ff"};color:${sel ? "#fff" : "#1e3a8a"};opacity:${open ? 1 : 0.5}">${name}${open ? "" : ` (${need} xp)`}</button>`;
    };
    const list = (kind, base, baseName) => item(kind, base, baseName, 0) + UNLOCKS.filter((u) => u.kind === kind).map((u) => item(kind, u.v, u.name, u.need)).join("");
    const el = g.panel(`<h2 style="margin:.1em 0">Locker</h2><p style="margin:.1em 0 .5em;font-weight:700;color:#475569">You have ${xp} xp. Every point you score earns more.</p>
      <p style="margin:.3em 0 0;font-weight:900;color:#1e3a8a">Jerseys</p><div>${list("jersey", "home", "Home blue")}</div>
      <p style="margin:.3em 0 0;font-weight:900;color:#1e3a8a">Ball</p><div>${list("ball", "classic", "Classic")}</div>
      <p style="margin:.3em 0 0;font-weight:900;color:#1e3a8a">Court</p><div>${list("court", "wood", "Hardwood")}</div>
      <p style="margin:.4em 0;font-weight:700;color:#475569">${g.unlocked("archie") ? "Archie is courtside for your games." : "Archie comes to watch at 30 xp."}</p>
      <button class="ak-btn" data-close="1">Done</button>`, "ak-wide");
    el.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      e.stopPropagation(); snd("click");
      if (b.dataset.close) { g.menu(); setupScene(); g.redraw(); return; }
      const p2 = pick(); p2[b.dataset.kind] = b.dataset.v; sv("pick", p2); draw();
    };
  };
  draw();
}

// ---------- setup ----------
function teamLook(t, r) { return { skin: r.skin, hair: r.hair, style: r.style, jersey: t.jersey, trim: t.trim, shorts: t.shorts, num: r.num, shoe: "#f8fafc" }; }
function setupScene() {
  const auto = dbg.auto, pk = pick();
  const home = { ...HOME, ...JERSEYS[pk.jersey] };
  let rival, k1, win;
  if (cfg.mode === "season") { const si = clamp(ld("season", 0), 0, RIVALS.length - 1); rival = RIVALS[si]; k1 = rival.skill; win = lerp(0.115, 0.07, si / 5); }
  else if (cfg.mode === "quick") { rival = choose(RIVALS); k1 = DIFFS[cfg.diff].k; win = DIFFS[cfg.diff].win; }
  else { rival = RIVALS[2]; k1 = 0.5; win = 0.095; }
  TEAMS = [home, rival];
  const tut = ld("tut", {});
  const first = !tut.shoot && cfg.mode !== "two" && !auto;
  S = {
    mode: cfg.mode, ph: "tip", period: 1, clock: PERIOD, shot: SHOT, score: [0, 0], poss: -1, arrow: 0, flipped: false, t: 0, clockHold: true, front: false,
    human: auto ? [null, null] : cfg.mode === "two" ? [KEYSA, KEYSB] : [KEYS1, null], ctrl: [null, null], pt: [null, null], inp: [null, null], k: auto ? auto.k : [0.5, k1], win, auto: !!auto,
    hot: [false, false], hotP: [false, false], banner: null, right: 0, hots: 0, dead: null, ft: null, tip: null, foul: null, big: null, hype: 0, buzz: false, looseT: 0, shotId: 0,
    gentle: first, first, tut, moved: 0, pk, breakT: 0, finalT: 0, inbT: 0,
    stats: { tips: 0, pass: 0, icept: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, dunk: 0, layup: 0, oreb: 0, dreb: 0, steal: 0, block: 0, foul: 0, fta: 0, ftm: 0, shotclock: 0, oob: 0, backcourt: 0, inbound: 0, periods: 0, ot: 0, banners: 0, hot: 0, perfect: 0, andone: 0, jumpball: 0 },
  };
  P = [];
  for (const team of [0, 1]) TEAMS[team].roster.forEach((r, i) => P.push({
    team, idx: i, name: r.name, num: r.num, role: r.role, look: teamLook(TEAMS[team], r), spd: r.role === "G" ? 300 : r.role === "F" ? 286 : 270,
    x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, mvx: 0, mvz: 0, grav: 1500, face: 1, act: "", actT: 0, anim: i * 2, drib: 0, cd: 0, stun: 0, shotT: 0, fin: null, free: false, three: false,
    ai: { t: 0, spot: -1, think: 0, held: 0, tx: 0, tz: 0, side: i % 2 ? 1 : -1, st: 1, cShot: -1, rel: 0, cut: 0, jmpAt: -1, probeT: 0, driveT: 0 },
  }));
  B = { x: L / 2, z: HZ, y: 104, vx: 0, vz: 0, vy: 0, st: "tip", owner: null, spin: 0, last: -1, dead: false, free: 0, reb: -1, t: 0, T: 1, made: false, pts: 2, shooter: null, hoop: null, to: null, ic: null, ft: false, air: false, kind: "", lob: 10 };
  formation(true);
  S.tip = { t: 0, tossed: false, jt: [null, null], done: false };
  P[2].act = "ready"; P[5].act = "ready";
  camX = L / 2 - W / 2; fx.clear(); hoopFx.forEach((h) => { h.rattle = 0; h.swish = 0; });
  S.ctrl = [P[2], P[5]];
}
function formation(tip) {
  for (const p of P) {
    const h = atk(p.team), own = HOOPS[1 - h.i], s = own.dir; // s points from the hoop a team defends into the court
    const spots = tip ? [[L / 2 - s * 170, HZ - 96], [L / 2 - s * 120, HZ + 110], [L / 2 - s * 26, HZ]] : [[L / 2 - s * 220, HZ - 80], [L / 2 - s * 160, HZ + 100], [L / 2 - s * 300, HZ]];
    p.x = spots[p.idx][0]; p.z = spots[p.idx][1]; p.y = 0; p.vx = p.vz = p.vy = 0; p.face = s; p.act = ""; p.fin = null; p.stun = 0; p.free = false;
  }
}
g.onStart = () => {
  if (posterOn) { g.stage.style.setProperty("--ak-aspect", String(16 / 9)); c.fit(); }
  posterOn = false;
  mute = !!dbg.auto;
  setupScene();
  if (S.human[0] && !S.human[1]) g.touchButtons([
    { code: "ArrowLeft", label: "◀", side: "left" }, { code: "ArrowUp", label: "▲", side: "left" }, { code: "ArrowDown", label: "▼", side: "left" }, { code: "ArrowRight", label: "▶", side: "left" },
    { code: "KeyS", label: "Pass", side: "right" }, { code: "KeyD", label: "Shoot", side: "right" },
  ]); else g.touchButtons([]);
  S.big = { text: "Tip-off", sub: `${TEAMS[0].name} vs ${TEAMS[1].name}`, t: 1.3 };
};

// ---------- possession ----------
function setPoss(team) {
  if (S.poss !== team) {
    if (S.poss >= 0) S.hot[S.poss] = false;
    S.poss = team; S.shot = SHOT; S.front = false; S.passN = 0;
    if (human(1 - team)) autoSwitch(1 - team);
  }
  if (S.hotP[team]) { S.hotP[team] = false; S.hot[team] = true; }
}
function autoSwitch(team) {
  let b = null, bd = 1e9;
  for (const p of P) if (p.team === team) { const d = Math.hypot(p.x - B.x, p.z - B.z); if (d < bd) { bd = d; b = p; } }
  S.ctrl[team] = b;
}
function give(p) {
  B.st = "held"; B.owner = p; B.last = p.team; B.dead = false; B.reb = -1; B.to = null; B.ft = false;
  if (p.act !== "jump") p.act = "";
  p.ai.held = 0; p.ai.think = lerp(0.5, 0.2, S.k[p.team]); p.ai.rel = 0; p.ai.tx = p.x; p.ai.tz = p.z;
  setPoss(p.team);
  if (S.ph === "live") S.clockHold = false;
  if (human(p.team)) S.ctrl[p.team] = p;
  S.looseT = 0;
}
function looseBall(vx, vz, vy) { B.st = "loose"; B.owner = null; B.vx = vx; B.vz = vz; B.vy = vy; B.free = 0.14; B.to = null; S.looseT = 0; S.front = false; for (const t of [0, 1]) if (human(t)) autoSwitch(t); }
function say(p, text, color = "#fff", size = 26) { fx.text(p.x, sy(p.z, p.y + 130), text, { color, size, life: 1 }); }

// ---------- shooting ----------
function shotBase(d) {
  if (d < 70) return 0.86;
  if (d < 200) return lerp(0.66, 0.55, (d - 70) / 130);
  if (d < THREE_R) return lerp(0.55, 0.48, (d - 200) / 135);
  if (d < 430) return lerp(0.42, 0.34, (d - THREE_R) / 95);
  if (d < 620) return lerp(0.34, 0.08, (d - 430) / 190);
  return 0.04;
}
function contest(p) {
  let f = 1;
  for (const q of P) if (q.team !== p.team) {
    const d = dist(p, q);
    if (d < 88) f *= 1 - (1 - d / 88) * (q.y > 12 ? 0.62 : q.act === "" ? 0.36 : 0.22);
  }
  return f;
}
function winOf(team) { return (human(team) ? S.win : 0.085) * (S.hot[team] ? 1.7 : 1); }
function estShot(p) { const h = atk(p.team); return shotBase(hd(p, h)) * contest(p) * 0.97 * (isThree(p, h) ? 1.5 : 1); }
function startShot(p) {
  if (p.act !== "" || p.y > 0 || B.owner !== p || S.ph !== "live") return;
  const h = atk(p.team), d = hd(p, h), inFront = (p.x - (h.x - h.dir * 26)) * h.dir > 0;
  S.gentle = false;
  if (d < 108 && inFront) return startFinish(p, h);
  p.act = "wind"; p.shotT = 0; p.face = h.x > p.x ? 1 : -1; p.three = isThree(p, h);
  S.shotId++;
  if (!human(p.team)) p.ai.rel = Math.max(0.1, T_TOP + gauss() * lerp(0.15, 0.055, S.k[p.team]) * (S.hot[p.team] ? 0.6 : 1));
}
// what the defenders around a shooter do to the shot at the moment the ball leaves the hand
function shotDefense(p, range, bp) {
  let block = null, foul = null;
  for (const q of P) if (q.team !== p.team) {
    const d = dist(p, q);
    if (q.y > 14 && d < range && !block && Math.random() < bp * (human(q.team) ? 1 : lerp(0.55, 1, S.k[q.team]))) block = q;
    if (!foul && ((q.act === "steal" && d < 56 && Math.random() < 0.55) || (q.y > 8 && d < 50 && Math.random() < 0.13))) foul = q;
  }
  return { block, foul };
}
function blocked(p, q) {
  S.stats.block++; say(q, "BLOCKED", "#fde047", 30); snd("hit"); g.shake(7, 0.25); g.hitstop(0.06); S.hype = Math.max(S.hype, 0.8);
  fx.burst(B.x, sy(B.z, B.y), { n: 12, color: "#fde047", speed: 260 });
  const h = atk(p.team);
  looseBall(-(h.x > p.x ? 1 : -1) * rand(140, 300), rand(-160, 160), rand(120, 260));
  B.last = q.team;
  p.act = "follow"; p.actT = 0; if (p.fin) { p.fin = null; p.vy = 0; }
}
function releaseShot(p) {
  const h = atk(p.team), err = Math.abs(p.shotT - T_TOP), w = winOf(p.team), d = hd(p, h);
  const three = p.three, green = err <= w;
  p.act = "follow"; p.actT = 0;
  if (human(p.team) && !S.tut.shoot) { S.tut.shoot = true; sv("tut", S.tut); }
  const df = shotDefense(p, 56, 0.32);
  if (df.block) return blocked(p, df.block);
  const tm = green ? 1.18 : clamp(1 - (err - w) / 0.2, 0.22, 1);
  const pr = clamp(shotBase(d) * contest(p) * tm + (S.hot[p.team] ? 0.08 : 0), 0.02, 0.97);
  if (human(p.team)) { say(p, green ? "Perfect" : p.shotT < T_TOP ? "Early" : "Late", green ? "#4ade80" : "#fca5a5", green ? 26 : 20); if (green) { S.stats.perfect++; fx.ring(p.x, sy(p.z, p.y + 60), { color: "#4ade80", radius: 50 }); } }
  S.stats.fga++; if (three) S.stats.tpa++;
  launch(p, h, Math.random() < pr, three ? 3 : 2, three ? "three" : "jumper", clamp(d / 540, 0.55, 1.15), !green && err > w + 0.19 && Math.random() < 0.5);
  if (df.foul) callFoul(p, df.foul);
}
function callFoul(p, q) { S.foul = { p, by: q }; S.stats.foul++; whistle(); say(q, "Foul", "#fca5a5", 22); }
function launch(p, h, made, pts, kind, T, air) {
  B.st = "shot"; B.owner = null; B.shooter = p; B.hoop = h; B.made = made; B.pts = pts; B.kind = kind; B.t = 0; B.T = T; B.air = air && !made; B.last = p.team; B.ft = false;
  B.x0 = B.x; B.z0 = B.z; B.y0 = B.y;
  const ox = made ? 0 : B.air ? h.dir * rand(26, 46) : rand(-1, 1) * 13 + h.dir * 4, oz = made ? 0 : rand(-1, 1) * 12;
  B.tx = h.x + ox; B.tz = HZ + oz; B.ty = B.air ? RIM_Y - 30 : RIM_Y + (made ? 4 : 6);
  B.vy0 = (B.ty - B.y0 + 0.5 * BG * T * T) / T;
  noise(0.08, { freq: 900, vol: 0.2 });
}
function scoreIt(team, pts, p, kind) {
  S.score[team] += pts; S.hype = 1;
  const h = B.hoop;
  hoopFx[h.i].swish = 1;
  fx.text(h.x, sy(HZ, RIM_Y + 40), "+" + pts, { color: pts === 3 ? "#fde047" : "#fff", size: pts === 3 ? 44 : 36, life: 1.1 });
  fx.burst(h.x, sy(HZ, RIM_Y - 14), { n: pts === 3 ? 26 : 16, colors: [TEAMS[team].jersey, TEAMS[team].trim, "#fff"], speed: 280, shape: "star", gravity: 500 });
  if (kind !== "dunk") swishSnd();
  if (kind === "three") { S.stats.tpm++; g.slowmo(0.5, 0.25); }
  if (kind !== "ft") {
    S.stats.fgm++;
    if (p.act !== "hang") { p.act = "cele"; p.actT = 1.1; }
    S.big = { text: `${p.name} ${kind === "dunk" ? "slams it" : kind === "three" ? "for three" : kind === "layup" ? "lays it in" : "scores"}`, t: 1.3, small: true };
  }
}
function resolveShot() {
  const h = B.hoop, p = B.shooter, team = p.team, ft = B.ft;
  if (B.made) {
    scoreIt(team, B.pts, p, B.kind);
    B.st = "loose"; B.dead = true; B.x = h.x; B.z = HZ; B.y = RIM_Y - 8; B.vx = 0; B.vz = 0; B.vy = -230;
    if (ft) return ftNext(true);
    if (S.foul) { S.stats.andone++; return startFT(S.foul.p, 1); }
    if (S.clock <= 0) return endPeriod();
    return deadBall(1 - team, baseSpot(h), 2.6, { banner: true });
  }
  if (B.air) { looseBall((B.tx - B.x0) / B.T * 0.6, 0, -120); B.reb = team; if (S.foul) { B.dead = true; startFT(S.foul.p, B.pts); } else if (S.clock <= 0) endPeriod(); return; }
  hoopFx[h.i].rattle = 0.8; snd("bounce"); tone(300, 0.12, { type: "square", vol: 0.2 });
  looseBall(h.dir * rand(40, 230) + rand(-40, 40), rand(-170, 170), rand(170, 330));
  B.reb = team; B.free = 0.2;
  if (ft) return ftNext(false);
  if (S.foul) { B.dead = true; return startFT(S.foul.p, B.pts); }
  if (S.clock <= 0) return endPeriod();
}
// layups and dunks: a scripted drive to the rim
function startFinish(p, h) {
  const dunk = Math.random() < (p.role === "C" ? 0.85 : p.role === "F" ? 0.55 : 0.22) + (S.hot[p.team] ? 0.3 : 0);
  p.act = dunk ? "dunk" : "layup"; p.face = h.x > p.x ? 1 : -1; p.vy = 0;
  p.fin = { x0: p.x, z0: p.z, t: 0, T: dunk ? 0.46 : 0.44, h, dunk, rel: false };
  if (human(p.team) && !S.tut.shoot) { S.tut.shoot = true; sv("tut", S.tut); }
  S.shotId++; S.stats.fga++;
  noise(0.12, { freq: 500, vol: 0.2 });
}
function stepFinish(p, dt) {
  const f = p.fin, h = f.h; f.t += dt;
  const k = clamp(f.t / f.T, 0, 1), e = k * k * (3 - 2 * k);
  p.x = lerp(f.x0, h.x + h.dir * (f.dunk ? 22 : 34), e); p.z = lerp(f.z0, HZ + 3, e);
  p.y = f.dunk ? 64 * Math.sin(k * Math.PI / 2) : 52 * Math.sin(k * Math.PI * 0.85); p.vx = p.vz = 0;
  if (!f.dunk && !f.rel && k >= 0.6) {
    f.rel = true;
    const df = shotDefense(p, 52, 0.2);
    if (df.block) return blocked(p, df.block);
    S.stats.layup++;
    launch(p, h, Math.random() < clamp(0.84 * contest(p) + (S.hot[p.team] ? 0.08 : 0), 0.05, 0.97), 2, "layup", 0.36, false);
    if (df.foul) callFoul(p, df.foul);
  }
  if (k >= 1) {
    if (f.dunk) {
      const df = shotDefense(p, 50, 0.2);
      if (df.block) return blocked(p, df.block);
      S.stats.dunk++;
      const made = Math.random() < clamp(0.96 * (0.6 + 0.4 * contest(p)), 0.1, 0.98);
      B.st = "shot"; B.owner = null; B.shooter = p; B.hoop = h; B.made = made; B.pts = 2; B.kind = "dunk"; B.air = false; B.ft = false; B.last = p.team;
      B.x = h.x; B.z = HZ; B.y = RIM_Y + (made ? 0 : 8);
      hoopFx[h.i].rattle = 1; g.shake(9, 0.3); g.hitstop(0.07); snd("crash");
      if (df.foul) callFoul(p, df.foul);
      p.act = "hang"; p.actT = 0.3; p.fin = null; p.vy = 0;
      resolveShot();
    } else { p.act = "follow"; p.actT = 0; p.fin = null; p.vy = 0; }
  }
}

// ---------- passing, steals, jumps ----------
function passTarget(p, inp) {
  const ms = mates(p), h = atk(p.team);
  let best = null, bs = -1e9;
  if (inp && (inp.mx || inp.mz)) {
    const l = Math.hypot(inp.mx, inp.mz);
    for (const m of ms) { const dx = m.x - p.x, dz = (m.z - p.z) * 1.4, d = Math.hypot(dx, dz) || 1, s = (dx * inp.mx + dz * inp.mz) / (d * l); if (s > bs) { bs = s; best = m; } }
    if (bs > 0.15) return best;
    best = null; bs = -1e9;
  }
  for (const m of ms) { const s = Math.min(160, nearFoe(m).d) - hd(m, h) * 0.22 - (S.ph === "inbound" ? dist(p, m) * 0.4 : 0); if (s > bs) { bs = s; best = m; } }
  return best;
}
function doPass(p, m) {
  if (!m || B.owner !== p) return;
  const d = dist(p, m), T = clamp(d / 840, 0.15, 0.7);
  p.act = "pass"; p.actT = 0.22; p.face = m.x > p.x ? 1 : -1;
  B.st = "pass"; B.owner = null; B.to = m; B.t = 0; B.T = T; B.x0 = B.x; B.z0 = B.z; B.y0 = Math.max(B.y, p.y + 66); B.last = p.team; B.ic = new Set(); B.lob = 10 + d * 0.06;
  const lead = m.act === "" ? 0.85 : 0;
  B.tx = clamp(m.x + m.vx * T * lead, 14, L - 14); B.tz = clamp(m.z + m.vz * T * lead, 14, D - 14);
  S.stats.pass++; S.passN = (S.passN || 0) + 1;
  if (human(p.team)) S.tut.pass = true;
  if (S.ph === "inbound") { S.ph = "live"; S.stats.inbound++; p.free = false; if (human(p.team)) S.tut.inb = true; }
  snd("whoosh");
}
function stepPass(dt) {
  B.t += dt;
  const k = clamp(B.t / B.T, 0, 1), m = B.to;
  B.x = lerp(B.x0, B.tx, k); B.z = lerp(B.z0, B.tz, k); B.y = lerp(B.y0, 76, k) + Math.sin(k * Math.PI) * B.lob; B.spin += dt * 9;
  if (k > 0.12 && k < 0.94 && !S.gentle) for (const q of P) if (q.team !== B.last && !B.ic.has(q) && q.stun <= 0 && Math.hypot(q.x - B.x, q.z - B.z) < 24 && B.y < q.y + 122) {
    B.ic.add(q);
    if (Math.random() < (isCtrl(q) ? 0.6 : lerp(0.05, 0.22, S.k[q.team]))) { S.stats.icept++; say(q, "Picked off", "#fde047"); snd("power"); S.hype = Math.max(S.hype, 0.6); return give(q); }
  }
  if (k >= 1) {
    if (m && m.stun <= 0 && Math.hypot(m.x - B.tx, m.z - B.tz) < 52) { give(m); tone(220, 0.05, { vol: 0.2 }); }
    else looseBall((B.tx - B.x0) / B.T * 0.5, (B.tz - B.z0) / B.T * 0.5, 40);
  }
}
function trySteal(q) {
  if (q.act !== "" || q.cd > 0 || q.y > 0) return;
  q.act = "steal"; q.actT = 0.3; q.cd = 0.75;
  const o = B.st === "held" ? B.owner : null;
  noise(0.06, { freq: 1500, vol: 0.2 });
  if (!o || o.team === q.team || S.ph !== "live" || dist(q, o) > 54 || o.act !== "" || o.stun > 0) return;
  q.face = o.x > q.x ? 1 : -1;
  if (Math.random() < (human(q.team) ? 0.17 : S.gentle ? 0 : lerp(0.04, 0.13, S.k[q.team]))) {
    S.stats.steal++; say(q, "Steal", "#fde047", 30); snd("power"); g.hitstop(0.04); S.hype = Math.max(S.hype, 0.7);
    fx.burst(B.x, sy(B.z, B.y), { n: 10, color: "#fff", speed: 200 });
    o.stun = 0.55; o.act = "stun"; o.actT = 0.55;
    q.act = "";
    give(q);
  }
}
function jumpAct(q, v = 430) { if (q.y > 0 || (q.act !== "" && q.act !== "ready")) return false; q.act = "jump"; q.vy = v; q.grav = 1500; q.y = 0.01; tone(260, 0.08, { slide: 520, vol: 0.2 }); return true; }
function defAction(q) {
  const o = B.st === "held" ? B.owner : null;
  S.tut.def = true;
  if (!o || o.team === q.team || ["wind", "air", "dunk", "layup"].includes(o.act) || dist(q, o) > 72) jumpAct(q); else trySteal(q);
}

// ---------- dead balls, inbounds, free throws, periods ----------
function baseSpot(h) { return { x: h.dir === 1 ? -18 : L + 18, z: HZ + (Math.random() < 0.5 ? -92 : 92) }; }
function sideSpot(x, z) {
  if (x < 4 || x > L - 4) return { x: x < L / 2 ? -18 : L + 18, z: z < HZ ? clamp(z, 40, HZ - 80) : clamp(z, HZ + 80, D - 40) };
  return { x: clamp(x, 70, L - 70), z: z < HZ ? -16 : D + 16 };
}
function deadBall(team, spot, dur, o = {}) {
  if (S.ph === "break" || S.ph === "final") return;
  S.ph = "dead"; S.deadT = dur; S.clockHold = true; S.foul = null; S.buzz = false; S.ft = null;
  if (B.st !== "loose") { B.st = "loose"; B.vx = B.vz = 0; B.vy = 0; }
  B.dead = true; B.owner = null; B.to = null;
  setPoss(team); S.front = false; S.shot = SHOT;
  const h = atk(team), tm = P.filter((p) => p.team === team);
  const inb = tm[1], rest = [tm[0], tm[2]];
  const baseline = spot.x < 0 || spot.x > L;
  const r1 = baseline ? { x: clamp(spot.x, 150, L - 150), z: clamp(spot.z + (spot.z < HZ ? 40 : -40), 60, D - 60) } : { x: clamp(spot.x + (h.x > spot.x ? 70 : -70), 60, L - 60), z: spot.z < HZ ? 110 : D - 110 };
  const toward = h.x > r1.x ? 1 : -1;
  const r2 = { x: clamp(r1.x + toward * (baseline ? 420 : 260), 80, L - 80), z: D - r1.z };
  S.dead = { team, spot, inb, set: new Map([[inb, spot], [rest[0], r1], [rest[1], r2]]) };
  for (const p of P) { if (!["cele", "hang", "jump"].includes(p.act)) p.act = ""; p.fin = null; p.free = p === inb; }
  if (o.msg) S.big = { text: o.msg, t: 1.2, small: true };
  if (o.banner) openBanner();
}
function startInbound() {
  const d = S.dead, p = d.inb;
  p.x = d.spot.x; p.z = d.spot.z; p.vx = p.vz = 0; p.y = 0; p.vy = 0; p.act = ""; p.free = true;
  S.ph = "inbound"; S.inbT = 0;
  give(p);
  p.face = d.spot.x < 0 ? 1 : d.spot.x > L ? -1 : atk(p.team).x > p.x ? 1 : -1;
}
function startFT(p, n) {
  const h = atk(p.team), o = foes(p.team), m = mates(p);
  S.ph = "ft"; S.clockHold = true; S.foul = null;
  S.ft = { p, n, i: 0, st: "setup", t: 0, m: 0, h, pos: new Map() };
  S.ft.pos.set(p, [wx(h, KEY_X + 8), HZ]);
  S.ft.pos.set(o[2], [wx(h, 120), KEY_Z0 - 24]); S.ft.pos.set(o[1], [wx(h, 120), KEY_Z1 + 24]); S.ft.pos.set(o[0], [wx(h, 470), HZ + 90]);
  S.ft.pos.set(m[1], [wx(h, 190), KEY_Z0 - 24]); S.ft.pos.set(m[0], [wx(h, 470), HZ - 90]);
  for (const q of P) { if (q.act !== "cele") q.act = ""; q.fin = null; q.free = false; }
  B.dead = true; if (B.st !== "loose") { B.st = "loose"; B.vx = B.vz = B.vy = 0; }
  S.big = { text: n === 1 ? "And one" : `${n} free throws`, sub: `${p.name} to the line`, t: 1.4, small: true };
  openBanner();
}
function stepFT(dt) {
  const f = S.ft, p = f.p; f.t += dt;
  if (f.st === "setup") {
    if (f.t >= 1.5) {
      for (const [q, pos] of f.pos) { q.x = pos[0]; q.z = pos[1]; q.vx = q.vz = 0; q.y = 0; q.vy = 0; q.act = ""; q.face = f.h.x > q.x ? 1 : -1; }
      f.st = "aim"; f.t = 0; B.dead = false; B.st = "held"; B.owner = p; if (human(p.team)) S.ctrl[p.team] = p;
    }
  } else if (f.st === "aim") {
    f.m = 0.5 + 0.5 * Math.sin(f.t * 5.2 - Math.PI / 2);
    const inp = S.inp[p.team];
    const fire = inp ? (inp.shootP && f.t > 0.25) || f.t > 5 : f.t > 0.9;
    if (fire) {
      const gw = S.hot[p.team] ? 0.22 : 0.14, e = Math.abs(f.m - 0.5);
      const pr = inp ? (e <= gw ? 0.96 : clamp(0.9 - (e - gw) * 3.2, 0.2, 0.9)) : 0.6 + 0.24 * S.k[p.team];
      p.act = "follow"; p.actT = 0.5; S.stats.fta++;
      if (inp) say(p, e <= gw ? "Perfect" : "Off", e <= gw ? "#4ade80" : "#fca5a5", 22);
      B.x = p.x + p.face * 8; B.z = p.z + 2; B.y = 112;
      launch(p, f.h, Math.random() < pr, 1, "ft", 0.78, false); B.ft = true;
      f.st = "fly";
    }
  } else if (f.st === "wait") {
    if (f.t >= 0.75) { f.st = "aim"; f.t = 0; B.dead = false; B.st = "held"; B.owner = p; p.act = ""; }
  }
}
function ftNext(made) {
  const f = S.ft; if (!f) return;
  if (made) S.stats.ftm++;
  f.i++;
  if (f.i < f.n) { f.st = "wait"; f.t = 0; B.dead = true; return; }
  S.ft = null;
  if (S.clock <= 0) return endPeriod();
  if (made) return deadBall(1 - f.p.team, baseSpot(f.h), 1.7);
  B.dead = false; S.ph = "live"; S.clockHold = true; // the last one missed: live rebound
}
function endPeriod() {
  if (S.ph === "break" || S.ph === "final") return;
  buzzer(); S.stats.periods++; S.buzz = false; S.banner = null; S.ft = null; S.foul = null;
  B.dead = true; B.owner = null; if (B.st !== "loose") { B.st = "loose"; B.vx = B.vz = B.vy = 0; }
  for (const p of P) { if (p.act !== "cele") p.act = ""; p.fin = null; }
  if (!S.auto) sv("tut", S.tut);
  if (S.period >= 4 && S.score[0] !== S.score[1]) {
    S.ph = "final"; S.finalT = 2.6; S.hype = 1;
    const w = S.score[0] > S.score[1] ? 0 : 1;
    for (const p of P) if (p.team === w) { p.act = "cele"; p.actT = 3; }
    S.big = { text: "Final", sub: `${TEAMS[w].name} win`, t: 2.6 };
    return;
  }
  S.ph = "break"; S.breakT = S.period === 2 ? 3 : 2.1;
  S.big = { text: S.period === 2 ? "Halftime" : S.period >= 4 ? "Overtime" : `End of quarter ${S.period}`, sub: S.period === 2 ? "Teams switch sides" : S.period >= 4 ? "Tied. 30 more seconds." : `${TEAMS[0].name} ${S.score[0]}, ${TEAMS[1].name} ${S.score[1]}`, t: S.breakT };
}
function stepBreak(dt) {
  S.breakT -= dt;
  if (S.breakT > 0) return;
  S.period++;
  if (S.period > 4) S.stats.ot++;
  S.clock = S.period > 4 ? OT : PERIOD;
  if (S.period === 3) S.flipped = true;
  S.poss = -1; S.hot = [false, false];
  formation(false);
  const team = S.arrow; S.arrow = 1 - team;
  B.x = L / 2; B.z = 0; B.y = BR; B.vx = B.vz = B.vy = 0;
  S.ph = "live";
  deadBall(team, { x: L / 2 + (atk(team).dir === 1 ? 60 : -60), z: -16 }, 1.1);
  camX = L / 2 - W / 2;
}
function finish() {
  const me = S.score[0], them = S.score[1], won = me > them, rival = TEAMS[1];
  const final = `Final: ${TEAMS[0].name} ${me}, ${rival.name} ${them}`;
  if (S.auto) return g.over({ score: Math.max(me, them), title: `${TEAMS[won ? 0 : 1].name} win`, lines: [final] });
  sv("tut", S.tut);
  if (S.mode === "two") {
    g.addXp(Math.round((me + them) / 3));
    return g.over({ score: Math.max(me, them), won: true, title: `${TEAMS[won ? 0 : 1].name} win`, lines: [final], again: "Space for a rematch" });
  }
  g.addXp(me + (won ? 12 : 0) + S.hots * 2);
  const lines = [final];
  if (S.mode === "season") {
    if (won) {
      const si = clamp(ld("season", 0), 0, RIVALS.length - 1) + 1;
      if (si >= RIVALS.length) { sv("season", 0); sv("cups", ld("cups", 0) + 1); lines.push("You won the season. A new one starts now."); }
      else { sv("season", si); lines.push(`Next up: the ${RIVALS[si].name}`); }
    } else lines.push(`Rematch with the ${rival.name}`);
  }
  if (S.hots) lines.push(`Hot hands: ${S.hots}`);
  g.over({ score: me, won, title: won ? `${TEAMS[0].name} win` : `${rival.name} win`, lines, again: won && S.mode === "season" ? "Space for the next game" : "Space to play again" });
}
function violation(kind, msg) {
  const team = 1 - (B.st === "held" ? B.owner.team : S.poss);
  S.stats[kind]++; whistle();
  deadBall(team, sideSpot(B.x, B.z), 1.5, { msg });
}

// ---------- tip-off ----------
const TIP_TOSS = 0.55, TIP_HIT = TIP_TOSS + 0.885, TIP_JUMP = TIP_HIT - 0.287;
function stepTip(dt) {
  const tp = S.tip; tp.t += dt;
  if (!tp.tossed) { B.x = L / 2; B.z = HZ; B.y = 104 + Math.sin(tp.t * 6) * 2; if (tp.t >= TIP_TOSS) { tp.tossed = true; noise(0.1, { freq: 700, vol: 0.2 }); } }
  else { const t = tp.t - TIP_TOSS; B.y = 104 + 506 * t - 0.5 * BG * t * t; B.spin += dt * 6; }
  for (const team of [0, 1]) {
    const p = P[team * 3 + 2], inp = S.inp[team];
    if (tp.jt[team] != null) continue;
    if (inp) { if (inp.shootP) { tp.jt[team] = tp.t; jumpAct(p); S.tut.tip = true; } }
    else {
      if (p.ai.jmpAt < 0) p.ai.jmpAt = TIP_JUMP + gauss() * lerp(0.22, 0.07, S.k[team]) + (S.first ? 0.3 : 0);
      if (tp.t >= p.ai.jmpAt) { tp.jt[team] = tp.t; jumpAct(p); }
    }
  }
  if (tp.t >= TIP_HIT && !tp.done) {
    tp.done = true;
    const e = [0, 1].map((t2) => (tp.jt[t2] == null ? 9 : Math.abs(tp.jt[t2] - TIP_JUMP)));
    let w = e[0] === e[1] ? (Math.random() < 0.5 ? 0 : 1) : e[0] < e[1] ? 0 : 1;
    if (S.first) w = 0;
    S.stats.tips++; S.arrow = 1 - w;
    const m = P[w * 3];
    snd("hit"); fx.burst(B.x - 0, sy(B.z, B.y), { n: 10, color: "#fff", speed: 220 }); say(P[w * 3 + 2], "Tip won", "#fde047", 22);
    S.ph = "live"; S.clockHold = true; setPoss(w);
    for (const p of P) { if (p.act === "ready") p.act = ""; p.ai.jmpAt = -1; }
    B.st = "pass"; B.to = m; B.t = 0; B.T = 0.45; B.x0 = B.x; B.z0 = B.z; B.y0 = B.y; B.tx = m.x; B.tz = m.z; B.last = w; B.ic = new Set(P); B.lob = 20;
  }
}

// ---------- hot hand banner ----------
function openBanner() {
  if (S.t < 20 || S.banner) return;
  const lvl = S.right >= 8 ? 3 : S.right >= 3 ? 2 : 1;
  const pr = math.problem({ topic: S.mode === "season" && TEAMS[1].skill > 0.5 && S.right >= 3 ? "prealgebra" : "quick", level: lvl });
  const wrong = pr.choices.filter((v) => !pr.check(v)).slice(0, 2);
  if (wrong.length < 2) return;
  const ch = [pr.answer, ...wrong].sort(() => Math.random() - 0.5);
  S.banner = { pr, ch, right: ch.findIndex((v) => pr.check(v)), t: 0, T: 6, res: [null, null], pickI: [-1, -1], closeT: 0, autoT: [rand(1, 2), rand(1, 2)] };
  S.stats.banners++;
}
function answer(team, i) {
  const b = S.banner;
  if (!b || b.res[team] != null) return;
  const ok = i === b.right;
  b.res[team] = ok; b.pickI[team] = i;
  if (!ok) return snd("wrong");
  S.right++; S.stats.hot++; snd("correct");
  if (team === 0 || S.mode === "two") S.hots++;
  if (S.poss === team && (S.ph !== "live" || S.clockHold)) S.hot[team] = true; else S.hotP[team] = true;
  S.big = { text: "Hot hand", sub: `${TEAMS[team].name}: a bigger green zone on the next possession`, t: 1.2, small: true };
  S.hype = Math.max(S.hype, 0.5);
}
const chipRect = (i) => ({ x: W / 2 - 40 + i * 92, y: 66, w: 84, h: 36 });
function stepBanner(dt) {
  const b = S.banner; if (!b) return;
  b.t += dt;
  let open = false;
  for (const team of [0, 1]) {
    const sc = human(team);
    if (b.res[team] != null) continue;
    if (sc) { open = true; for (let i = 0; i < 3; i++) if (g.keys.pressed(sc.ans[i])) answer(team, i); }
    else if (S.auto) { open = true; if (b.t > b.autoT[team]) answer(team, Math.random() < 0.55 ? b.right : (b.right + 1) % 3); }
  }
  if (human(0) && !human(1) && b.res[0] == null && g.pointer.pressed) {
    const pt = g.pointer.at(c);
    for (let i = 0; i < 3; i++) { const r = chipRect(i); if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y - 6 && pt.y <= r.y + r.h + 6) answer(0, i); }
  }
  if (!open) { b.closeT += dt; if (b.closeT > 0.8) S.banner = null; }
  else if (b.t >= b.T || (S.ph === "live" && !S.clockHold)) S.banner = null;
}

// ---------- brains ----------
function goTo(p, tx, tz, mul = 1) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 5) { p.mvx = p.mvz = 0; return; }
  const v = p.spd * mul * Math.min(1, d / 34 + 0.2);
  p.mvx = (dx / d) * v; p.mvz = (dz / d) * v * 0.85;
}
function offBall(p, dt) {
  const h = atk(p.team), a = p.ai, hl = B.owner && B.owner.team === p.team ? B.owner : null;
  a.t -= dt;
  if (a.t <= 0 || a.spot < 0) {
    a.t = rand(1.8, 3.6);
    if (Math.random() < 0.28 && hl && (hl.x - L / 2) * h.dir < 0) a.cut = 0.9;
    let best = 0, bs = -1e9;
    const taken = mates(p).map((m) => m.ai.spot);
    for (let i = 0; i < SPOTS.length; i++) {
      if (taken.includes(i)) continue;
      const sx = wx(h, SPOTS[i].d), sz = SPOTS[i].z;
      let nd = 1e9; for (const q of P) if (q.team !== p.team) nd = Math.min(nd, Math.hypot(q.x - sx, q.z - sz));
      let s = Math.min(nd, 150) + rand(0, 90) - Math.hypot(p.x - sx, p.z - sz) / 7;
      if (hl && Math.hypot(hl.x - sx, hl.z - sz) < 130) s -= 120;
      if (i === a.spot) s -= 40;
      if (s > bs) { bs = s; best = i; }
    }
    a.spot = best;
  }
  if (a.cut > 0) { a.cut -= dt; return goTo(p, wx(h, 125), HZ + a.side * 46, 1.08); }
  goTo(p, wx(h, SPOTS[a.spot].d), SPOTS[a.spot].z, 0.92);
}
function defend(q, dt) {
  const m = P[(1 - q.team) * 3 + q.idx], h = atk(m.team), k = S.k[q.team], a = q.ai;
  const hl = B.st === "held" ? B.owner : B.st === "pass" ? B.to : null;
  const onBall = hl === m;
  let tx, tz;
  const dm = hd(m, h) || 1;
  if (onBall) { const f = clamp(46 / dm, 0, 0.9); tx = m.x + (h.x - m.x) * f; tz = m.z + (HZ - m.z) * f; }
  else { tx = m.x + (h.x - m.x) * 0.32 + (B.x - m.x) * 0.14; tz = m.z + (HZ - m.z) * 0.32 + (B.z - m.z) * 0.14; }
  // help on a drive when the on-ball defender is beaten
  if (!onBall && hl && hl.team !== q.team && B.st === "held" && hd(hl, h) < 190) {
    const od = P[q.team * 3 + hl.idx];
    if (hd(od, h) > hd(hl, h) + 14) { let near = null, nd = 1e9; for (const o of P) if (o.team === q.team && o !== od) { const d2 = hd(o, h); if (d2 < nd) { nd = d2; near = o; } } if (near === q) { tx = lerp(hl.x, h.x, 0.5); tz = lerp(hl.z, HZ, 0.5); } }
  }
  const dd = Math.hypot(tx - h.x, tz - HZ);
  if (dd > 700) { tx = h.x + (tx - h.x) * 700 / dd; tz = HZ + (tz - HZ) * 700 / dd; }
  goTo(q, clamp(tx, 12, L - 12), clamp(tz, 12, D - 12), onBall ? lerp(0.88, 0.99, k) : 1);
  q.face = B.x > q.x ? 1 : -1;
  if (S.gentle || S.ph !== "live") return;
  // contest a shot
  const sh = hl && B.st === "held" && ["wind", "air", "dunk", "layup"].includes(hl.act) ? hl : null;
  if (sh && sh.team !== q.team && dist(q, sh) < 78 && a.cShot !== S.shotId) {
    a.cShot = S.shotId;
    if (Math.random() < lerp(0.3, 0.85, k)) a.jmpAt = S.t + rand(0.03, lerp(0.3, 0.14, k));
  }
  if (a.jmpAt > 0 && S.t >= a.jmpAt) { a.jmpAt = -1; jumpAct(q); }
  // reach for a steal
  if (onBall && B.st === "held" && dist(q, m) < 50 && m.act === "") { a.st -= dt; if (a.st <= 0) { a.st = rand(1.1, 2.6) / lerp(0.6, 1.3, k); trySteal(q); } }
}
function laneOpen(p, h) { for (const q of P) if (q.team !== p.team) { const s = segDist(p, { x: h.x, z: HZ }, q); if (s.d < 44 && s.t > 0.02) return false; } return true; }
function passClear(p, m) { for (const q of P) if (q.team !== p.team) { const s = segDist(p, m, q); if (s.d < 30 && s.t > 0.08 && s.t < 0.95) return false; } return true; }
function handler(p, dt) {
  const a = p.ai, h = atk(p.team), k = S.k[p.team], dH = hd(p, h), nf = nearFoe(p);
  a.held += dt; a.think -= dt;
  if (p.act === "wind" || p.act === "air") { p.mvx = p.mvz = 0; if (p.shotT >= a.rel) releaseShot(p); return; }
  if (p.act !== "") { p.mvx = p.mvz = 0; return; }
  if (S.ph === "inbound") {
    p.mvx = p.mvz = 0;
    const wait = S.banner && human(1 - p.team) && S.banner.res[1 - p.team] == null ? 1.9 : 0.9;
    if (a.held > wait) { let m = null, bs = -1e9; for (const q of mates(p)) { const s = Math.min(nearFoe(q).d, 140) - dist(p, q) * 0.3 + (passClear(p, q) ? 60 : 0); if (s > bs) { bs = s; m = q; } } doPass(p, m); }
    return;
  }
  if (a.think <= 0) {
    a.think = lerp(0.3, 0.13, k);
    const front = (p.x - L / 2) * h.dir < 0;
    const urgent = S.shot < 3.2 || S.clock < 2.2;
    const ms = mates(p);
    if (!front && !urgent) {
      a.tx = wx(h, 560); a.tz = HZ + a.side * 50;
      // outlet: throw it ahead to an open runner
      if (a.held > 0.3) { const m = ms.find((q) => (q.x - p.x) * h.dir < -230 && nearFoe(q).d > 64 && passClear(p, q)); if (m) return doPass(p, m); }
      if (nf.d < 60 && a.held > 0.5) { const m = ms.find((q) => (q.x - p.x) * (h.x - p.x) > 0 && nearFoe(q).d > 70 && passClear(p, q)); if (m) return doPass(p, m); }
    } else {
      const mine = estShot(p), lane = laneOpen(p, h);
      const thr = S.shot > 9 ? 0.53 : S.shot > 5 ? 0.45 : 0.3;
      if (dH < 105 && (lane || urgent || nf.d > 36 || a.held > 1.6)) return startShot(p);
      if (urgent) return startShot(p);
      if (mine > thr && a.held > 0.45 && dH > 105) return startShot(p);
      if ((lane && dH < 460) || a.driveT > S.t) { a.tx = h.x + h.dir * 34; a.tz = HZ + (lane ? 0 : a.side * 60); }
      else {
        let best = null, bs = mine + 0.1 + 0.07 * (S.passN || 0);
        for (const m of ms) { if ((m.x - L / 2) * h.dir > 0) continue; const s = estShot(m) + Math.min(nearFoe(m).d, 120) / 900; if (s > bs && passClear(p, m)) { bs = s; best = m; } }
        if (best && a.held > 0.5) return doPass(p, best);
        if (nf.d < 52 && a.held > 1.3) { const m = ms.find((q) => nearFoe(q).d > 80 && passClear(p, q) && (q.x - L / 2) * h.dir < 0); if (m) return doPass(p, m); }
        if (a.probeT < S.t) { a.probeT = S.t + rand(0.7, 1.3); a.side = -a.side; if (Math.random() < 0.3) a.driveT = S.t + 1.1; a.tx = wx(h, rand(250, 450)); a.tz = HZ + a.side * rand(40, 170); }
      }
    }
  }
  goTo(p, clamp(a.tx, 20, L - 20), clamp(a.tz, 20, D - 20), 0.97);
}
function chase(p, order) {
  if (order < 2) {
    const lead = B.y > 60 ? 0.3 : 0.12;
    goTo(p, clamp(B.x + B.vx * lead, 6, L - 6), clamp(B.z + B.vz * lead, 6, D - 6), 1.05);
    if (p.act === "" && p.y === 0 && B.vy < 0 && B.y > 112 && B.y < 215 && Math.hypot(p.x - B.x, p.z - B.z) < 44 && Math.random() < 0.2) jumpAct(p);
  } else { const h = atk(p.team); goTo(p, wx(h, 620), HZ + p.ai.side * 90, 0.8); }
}
function watchShot(p) {
  const h = B.hoop, off = p.team === B.shooter.team;
  if (off) {
    if (p === B.shooter) { p.mvx = p.mvz = 0; return; }
    const cr = mates(B.shooter).sort((a, b) => hd(a, h) - hd(b, h))[0];
    if (p === cr) goTo(p, h.x + h.dir * 78, HZ + (p.z < HZ ? -58 : 58), 1); else goTo(p, wx(h, 600), HZ, 0.8);
  } else {
    const m = P[(1 - p.team) * 3 + p.idx], dm = hd(m, h) || 1, r = Math.min(82, Math.max(40, dm - 22));
    goTo(p, h.x + (m.x - h.x) / dm * r + h.dir * 12, HZ + (m.z - HZ) / dm * r, 1);
  }
}
function brain(p, dt) {
  if (S.ph === "tip" || S.ph === "break" || S.ph === "final") { p.mvx = p.mvz = 0; return; }
  if (S.ph === "ft") { const pos = S.ft && S.ft.pos.get(p); if (pos && S.ft.st === "setup") goTo(p, pos[0], pos[1], 1); else p.mvx = p.mvz = 0; return; }
  if (S.ph === "dead") {
    const t = S.dead.set.get(p);
    if (t) return goTo(p, t.x, t.z, 1.05);
    return defend(p, dt);
  }
  if (B.st === "held" && B.owner === p) return handler(p, dt);
  if (B.st === "shot" && !B.ft) return watchShot(p);
  if (B.st === "loose" || B.st === "shot") {
    if (B.dead || B.st === "shot") { p.mvx = p.mvz = 0; return; }
    const tm = P.filter((q) => q.team === p.team).sort((a, b) => Math.hypot(a.x - B.x, a.z - B.z) - Math.hypot(b.x - B.x, b.z - B.z));
    return chase(p, tm.indexOf(p));
  }
  if (B.st === "pass" && B.to === p) return goTo(p, B.tx, B.tz, 1.1);
  if (S.ph === "inbound" && p.team === S.poss) {
    const t = S.dead.set.get(p), w = Math.sin(S.t * 3 + p.idx * 2) * 40;
    return goTo(p, clamp(t.x + w, 20, L - 20), clamp(t.z + w * 0.6, 20, D - 20), 0.9);
  }
  if (p.team === S.poss) return offBall(p, dt);
  return defend(p, dt);
}
function control(p, inp, dt) {
  const has = B.st === "held" && B.owner === p;
  if (S.ph === "tip" || S.ph === "break" || S.ph === "final" || S.ph === "dead" || S.ph === "ft") return brain(p, dt);
  if (has) {
    if (p.act === "wind" || p.act === "air") { p.mvx = p.mvz = 0; if (!inp.shootD) releaseShot(p); return; }
    if (p.act !== "") { p.mvx = p.mvz = 0; return; }
    S.pt[p.team] = passTarget(p, inp);
    if (S.ph === "inbound") {
      p.mvx = p.mvz = 0; S.inbT += dt;
      if (inp.pass || inp.shootP || S.inbT > 5) doPass(p, S.pt[p.team]);
      return;
    }
    const l = Math.hypot(inp.mx, inp.mz) || 1, v = p.spd * 0.97;
    p.mvx = (inp.mx / l) * v; p.mvz = (inp.mz / l) * v * 0.85;
    if (inp.mx || inp.mz) S.moved += dt;
    if (inp.pass) return doPass(p, S.pt[p.team]);
    if (inp.shootP) return startShot(p);
    return;
  }
  if (B.st === "pass" && B.to === p) return brain(p, dt);
  if (p.team === S.poss && B.st !== "loose" && B.st !== "shot") return brain(p, dt);
  // defense, rebounds and loose balls
  const l = Math.hypot(inp.mx, inp.mz) || 1, v = p.spd;
  p.mvx = (inp.mx / l) * v; p.mvz = (inp.mz / l) * v * 0.85;
  p.face = inp.mx && B.st !== "held" ? inp.mx : B.x > p.x ? 1 : -1;
  if (inp.shootP) defAction(p);
  if (inp.pass) {
    const others = P.filter((q) => q.team === p.team && q !== p).sort((a, b) => Math.hypot(a.x - B.x, a.z - B.z) - Math.hypot(b.x - B.x, b.z - B.z));
    S.ctrl[p.team] = others[0]; S.tut.sw = true; snd("click");
  }
}

// ---------- step ----------
function stepPlayer(p, dt) {
  p.cd -= dt; p.stun -= dt;
  if (p.fin) { stepFinish(p, dt); return; }
  if (p.act === "wind" || p.act === "air") {
    p.shotT += dt;
    if (p.act === "wind" && p.shotT >= T_WIND) { p.act = "air"; p.vy = JV; p.grav = JG; p.y = 0.01; tone(300, 0.1, { slide: 560, vol: 0.15 }); }
  } else if (["pass", "steal", "cele", "stun", "hang"].includes(p.act)) { p.actT -= dt; if (p.actT <= 0) p.act = ""; }
  if (p.y > 0 && p.act !== "hang") {
    p.vy -= p.grav * dt; p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0; p.vy = 0;
      if (p.act === "air") releaseShot(p);
      if (p.act === "jump" || p.act === "follow") { p.act = ""; p.actT = 0; }
      fx.burst(p.x, sy(p.z), { n: 4, color: "rgba(255,255,255,.5)", speed: 60, life: 0.3, gravity: 0, size: 3 });
    }
  } else if (p.act === "follow" && p.y <= 0) { p.actT -= dt; if (p.actT <= -0.25) { p.act = ""; p.actT = 0; } }
  const frozen = ["wind", "steal", "stun", "cele", "hang", "ready"].includes(p.act) || (p.act === "follow" && p.y <= 0);
  if (p.y <= 0) { p.vx = damp(p.vx, frozen ? 0 : p.mvx, 11, dt); p.vz = damp(p.vz, frozen ? 0 : p.mvz, 11, dt); }
  else if (p.act === "air" || p.act === "follow") { p.vx *= 1 - 3 * dt; p.vz *= 1 - 3 * dt; }
  p.x += p.vx * dt; p.z += p.vz * dt;
  const sp = Math.hypot(p.vx, p.vz);
  p.anim += dt * (4 + sp * 0.045);
  const mine = B.st === "held" && B.owner === p;
  if (p.act === "" && sp > 30 && Math.abs(p.vx) > 24 && (mine || p.team === S.poss || B.st === "loose" || S.ph === "dead")) p.face = p.vx > 0 ? 1 : -1;
  if (mine && p.act === "" && sp < 30 && S.ph === "live") p.face = atk(p.team).x > p.x ? 1 : -1;
  // stay on the floor (the ball handler may step out, and that is a turnover)
  if (!p.free && S.ph !== "dead") {
    // a controlled ball handler has to lean on the line for a moment before stepping out
    let lim = 8;
    if (mine && isCtrl(p)) {
      const out = p.x < 2 || p.x > L - 2 || p.z < 2 || p.z > D - 2;
      p.outT = out ? (p.outT || 0) + dt : 0;
      lim = p.outT > 0.3 ? -20 : 2;
    }
    p.x = clamp(p.x, lim, L - lim); p.z = clamp(p.z, lim, D - lim);
  }
}
function separate() {
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.fin || b.fin || a.free || b.free) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 25 && d > 0.01) {
      const push = 25 - d, wa = B.owner === a ? 0.35 : B.owner === b ? 0.65 : 0.5;
      a.x -= (dx / d) * push * wa; a.z -= (dz / d) * push * wa; b.x += (dx / d) * push * (1 - wa); b.z += (dz / d) * push * (1 - wa);
    }
  }
}
function holdPos(p) {
  const f = p.face;
  if (p.act === "wind") return [p.x + f * 10, p.z + 3, p.y + lerp(62, 98, clamp(p.shotT / T_WIND, 0, 1))];
  if (p.act === "air") return [p.x + f * 7, p.z + 3, p.y + lerp(98, 113, clamp((p.shotT - T_WIND) / 0.14, 0, 1))];
  if (p.act === "dunk") return [p.x + f * 15, p.z - 3, p.y + 109];
  if (p.act === "layup") return [p.x + f * 15, p.z + 3, p.y + 107];
  if (p.act === "" && S.ph === "live" && p.y <= 0) {
    const run = clamp(Math.hypot(p.vx, p.vz) / 200, 0, 1);
    return [p.x + f * (17 + run * 7), p.z + 4, 10 + Math.abs(Math.sin(p.drib)) * 42];
  }
  return [p.x + f * 13, p.z + 3, p.y + 64];
}
function stepBall(dt) {
  B.free -= dt;
  if (B.st === "held") {
    const p = B.owner;
    const before = Math.sin(p.drib);
    p.drib += dt * (8.5 + Math.hypot(p.vx, p.vz) * 0.012);
    if (p.act === "" && S.ph === "live" && before * Math.sin(p.drib) < 0) tone(95, 0.05, { type: "sine", vol: 0.35 });
    const h = holdPos(p); B.x = h[0]; B.z = h[1]; B.y = h[2]; B.spin += dt * 5 * p.face;
  } else if (B.st === "pass") stepPass(dt);
  else if (B.st === "shot") {
    B.t += dt;
    const k = clamp(B.t / B.T, 0, 1);
    B.x = lerp(B.x0, B.tx, k); B.z = lerp(B.z0, B.tz, k); B.y = B.y0 + B.vy0 * B.t - 0.5 * BG * B.t * B.t; B.spin -= dt * 10 * (B.tx > B.x0 ? 1 : -1);
    if (k >= 1) resolveShot();
  } else if (B.st === "loose") {
    B.vy -= BG * dt; B.x += B.vx * dt; B.z += B.vz * dt; B.y += B.vy * dt; B.spin += dt * B.vx * 0.03;
    if (B.y <= BR) {
      B.y = BR;
      if (B.vy < -70) { B.vy = -B.vy * 0.6; B.vx *= 0.82; B.vz *= 0.82; if (!B.dead || B.vy > 120) tone(90, 0.06, { type: "sine", vol: 0.4 }); } else { B.vy = 0; B.vx *= 1 - 2 * dt; B.vz *= 1 - 2 * dt; }
      if (!B.dead && S.ph === "live" && (B.x < 0 || B.x > L || B.z < 0 || B.z > D)) return outOfBounds();
    }
    if (!B.dead && S.ph === "live" && (B.x < -70 || B.x > L + 70 || B.z < -60 || B.z > D + 60)) return outOfBounds();
    if (!B.dead && S.ph === "live" && B.free <= 0) {
      let best = null, bd = 1e9;
      for (const p of P) {
        if (p.stun > 0 || p.fin || ["steal", "stun", "hang", "cele", "wind", "air"].includes(p.act)) continue;
        const d = Math.hypot(p.x - B.x, p.z - B.z);
        if (d < 30 && B.y >= p.y - 6 && B.y <= p.y + (p.act === "jump" ? 138 : 104) && d < bd) { bd = d; best = p; }
      }
      if (best) {
        if (B.reb >= 0) { if (best.team === B.reb) { S.stats.oreb++; S.shot = SHOT; } else S.stats.dreb++; say(best, "Rebound", "#e2e8f0", 18); snd("pop"); }
        give(best);
      }
    }
  }
}
function outOfBounds() {
  S.stats.oob++; whistle();
  deadBall(1 - (B.last >= 0 ? B.last : S.poss), sideSpot(B.x, B.z), 1.5, { msg: "Out of bounds" });
}
function readInput(team) {
  const sc = human(team); if (!sc) return null;
  return { mx: g.keys.axis(sc.l, sc.r), mz: g.keys.axis(sc.u, sc.d), pass: g.keys.pressed(...sc.pass), shootP: g.keys.pressed(...sc.shoot), shootD: g.keys.down(...sc.shoot) };
}
function update(dt) {
  if (!S || posterOn) return;
  S.t += dt;
  S.inp = [readInput(0), readInput(1)];
  S.pt = [null, null];
  if (S.ph === "tip") stepTip(dt);
  else if (S.ph === "dead") { S.deadT -= dt; if (S.deadT <= 0) startInbound(); }
  else if (S.ph === "ft") stepFT(dt);
  else if (S.ph === "break") stepBreak(dt);
  else if (S.ph === "final") { S.finalT -= dt; if (S.finalT <= 0) return finish(); }
  for (const p of P) { if (isCtrl(p) && S.inp[p.team]) control(p, S.inp[p.team], dt); else brain(p, dt); }
  for (const p of P) stepPlayer(p, dt);
  if (S.ph !== "ft" || S.ft.st === "setup") separate();
  if (S.ph !== "tip") stepBall(dt);
  // rules that watch the ball handler
  if (S.ph === "live" && B.st === "held") {
    const p = B.owner, h = atk(p.team), front = (p.x - L / 2) * h.dir < 0;
    if (p.x < -4 || p.x > L + 4 || p.z < -4 || p.z > D + 4) { S.stats.oob++; whistle(); deadBall(1 - p.team, sideSpot(p.x, p.z), 1.5, { msg: "Out of bounds" }); }
    else if (S.front && (p.x - L / 2) * h.dir > 14) violation("backcourt", "Backcourt");
    else if (front && Math.abs(p.x - L / 2) > 18) S.front = true;
  }
  if (S.ph === "live" && B.st === "loose" && !B.dead) {
    S.looseT += dt;
    if (S.looseT > 7) { S.stats.jumpball++; const t = S.arrow; S.arrow = 1 - t; deadBall(t, sideSpot(clamp(B.x, 80, L - 80), B.z), 1.3, { msg: "Jump ball" }); }
  }
  if (S.ph === "live" && !S.clockHold) {
    S.clock -= dt;
    if ((B.st === "held" || B.st === "pass") && !S.gentle) { S.shot -= dt; if (S.shot <= 0 && S.clock > 0) { S.shot = 0; violation("shotclock", "Shot clock"); } }
    if (S.clock <= 0) { S.clock = 0; if (B.st === "shot") S.buzz = true; else if (S.ph === "live") endPeriod(); }
  }
  if (S.gentle && S.t > 30) S.gentle = false;
  stepBanner(dt);
  // camera, crowd, juice
  const lead = S.poss >= 0 && S.ph !== "tip" ? (atk(S.poss).x > B.x ? 90 : -90) : 0;
  const fxm = B.st === "shot" ? lerp(B.x, B.hoop.x, 0.5) : B.x;
  camX = damp(camX, clamp(fxm - W / 2 + lead, -90, L - W + 90), S.ph === "dead" ? 2.4 : 4.5, dt);
  S.hype = Math.max(0, S.hype - dt * 0.45);
  for (const h of hoopFx) { h.rattle = Math.max(0, h.rattle - dt * 2.4); h.swish = Math.max(0, h.swish - dt * 1.8); }
  if (S.big) { S.big.t -= dt; if (S.big.t <= 0) S.big = null; }
  for (const t of [0, 1]) if (S.hot[t] && S.poss === t && B.st === "held" && Math.random() < 0.5) fx.burst(B.x + rand(-6, 6), sy(B.z, B.y), { n: 1, colors: ["#fb923c", "#fde047", "#ef4444"], speed: 40, life: 0.45, gravity: -260, size: 4 });
  fx.update(dt);
}

// ---------- render ----------
function env() {
  return { t: S.t, hype: S.hype, court: S.pk.court, colors: [TEAMS[0].jersey, TEAMS[1].jersey], keyCol: [TEAMS[HOOPS[0] === atk(0) ? 1 : 0].jersey, TEAMS[HOOPS[1] === atk(0) ? 1 : 0].jersey], archie: g.unlocked("archie") && !posterOn, lookX: clamp((B.x - L / 2) / 400, -1, 1) };
}
function pill(x, y, text, bg = "#0f172a", fg = "#fff", size = 15) {
  ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + size * 1.2, h = size * 1.75;
  x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  ctx.fillStyle = "rgba(15,23,42,.35)"; rr(ctx, x - w / 2, y - h / 2 + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = bg; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(text, x, y + 1);
}
function drawPlayer(p) {
  const s = zs(p.z), x = p.x - camX, y = sy(p.z, p.y), mine = B.st === "held" && B.owner === p;
  if (x < -90 || x > W + 90) return;
  const defending = S.ph === "live" && S.poss >= 0 && p.team !== S.poss && B.st !== "loose" && !B.dead && Math.hypot(p.x - B.x, p.z - B.z) < 230;
  const ball = mine ? [(B.x - p.x) * p.face / s, -(B.y - p.y) / s] : null;
  const pose = poseOf(p, { t: S.t, defend: defending, ball, dribble: mine && p.act === "" && S.ph === "live" });
  drawAthlete(ctx, x, y, s, p.face, pose, p.look, { glow: S.hot[p.team] && S.poss === p.team && mine });
}
function drawBallNow() { drawBall(ctx, B.x - camX, sy(B.z, B.y), BR * zs(B.z), B.spin, S.pk.ball); }
function world() {
  const e = env();
  drawArena(ctx, camX, e);
  drawFloor(ctx, camX, e);
  for (const p of P) {
    const s = zs(p.z), x = p.x - camX, y = sy(p.z), k = 1 - Math.min(p.y, 120) / 260;
    ctx.fillStyle = "rgba(15,23,42,.28)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 22 * s * k, 7 * s * k, 0, 0, 6.283); ctx.fill();
    if (isCtrl(p) && !posterOn && S.ph !== "break" && S.ph !== "final" && g.state !== "menu") {
      const col = p.team === 0 ? "#fde047" : "#67e8f9", pu = 1 + Math.sin(S.t * 7) * 0.06;
      ctx.strokeStyle = "rgba(15,23,42,.5)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y + 2, 27 * s * pu, 10 * s * pu, 0, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(x, y + 2, 27 * s * pu, 10 * s * pu, 0, 0, 6.283); ctx.stroke();
    }
  }
  for (const team of [0, 1]) {
    const m = S.pt[team], p = S.ctrl[team];
    if (!m || !p || posterOn) continue;
    ctx.setLineDash([7, 9]); ctx.lineDashOffset = -S.t * 40; ctx.strokeStyle = team === 0 ? "#fde047" : "#67e8f9"; ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x - camX, sy(p.z)); ctx.lineTo(m.x - camX, sy(m.z)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  { const k = clamp(1 - B.y / 300, 0.35, 1) * zs(B.z); ctx.fillStyle = "rgba(15,23,42,.3)"; ctx.beginPath(); ctx.ellipse(B.x - camX, sy(B.z) + 2, 10 * k, 3.6 * k, 0, 0, 6.283); ctx.fill(); }
  const list = P.map((p) => ({ z: p.z, f: () => drawPlayer(p) }));
  const nearRim = B.st === "shot" || (B.dead && B.st === "loose" && Math.abs(B.z - HZ) < 2);
  list.push({ z: nearRim ? HZ : B.z + 0.2, f: drawBallNow });
  for (const h of HOOPS) {
    const sc = S.ph === "live" || S.ph === "inbound" || S.ph === "dead" ? Math.ceil(clamp(S.shot, 0, SHOT)) : null;
    const st = { t: S.t, rattle: hoopFx[h.i].rattle, swish: hoopFx[h.i].swish, clock: sc, pad: TEAMS[h === atk(0) ? 1 : 0].jersey };
    list.push({ z: HZ - 0.6, f: () => drawHoop(ctx, h, camX, "back", st) });
    list.push({ z: HZ + 0.6, f: () => drawHoop(ctx, h, camX, "front", st) });
  }
  list.sort((a, b) => a.z - b.z);
  for (const it of list) it.f();
  ctx.save(); ctx.translate(-camX, 0); fxWorld(); ctx.restore();
}
// fx positions are stored in world x, so they scroll with the court
function fxWorld() { fx.draw(ctx); }
function overlays() {
  const o = B.st === "held" ? B.owner : null;
  if (o && S.ph !== "break" && S.ph !== "final") pill(o.x - camX, sy(o.z, o.y) - 128 * zs(o.z) - 8, `${o.num} ${o.name}`, TEAMS[o.team].jersey, "#fff", 12);
  for (const team of [0, 1]) {
    const m = S.pt[team]; if (!m) continue;
    const x = m.x - camX, y = sy(m.z, m.y) - 128 * zs(m.z) - 6 + Math.sin(S.t * 8) * 3;
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.moveTo(x - 13, y - 14); ctx.lineTo(x + 13, y - 14); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = team === 0 ? "#fde047" : "#67e8f9"; ctx.beginPath(); ctx.moveTo(x - 8, y - 11); ctx.lineTo(x + 8, y - 11); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill();
  }
  // shot meter: the marker climbs with the jump, the green zone is the top
  for (const p of P) if ((p.act === "wind" || p.act === "air") && human(p.team)) {
    const x = p.x - camX - p.face * 42, y0 = sy(p.z, p.y) - 20, hgt = 78, w = winOf(p.team) / T_TOP;
    ctx.fillStyle = "#0f172a"; rr(ctx, x - 9, y0 - hgt - 4, 18, hgt + 8, 8); ctx.fill();
    ctx.fillStyle = "#475569"; rr(ctx, x - 5, y0 - hgt, 10, hgt, 5); ctx.fill();
    ctx.fillStyle = S.hot[p.team] ? "#fb923c" : "#22c55e"; rr(ctx, x - 5, y0 - hgt, 10, Math.max(9, hgt * w), 5); ctx.fill();
    const m = p.shotT <= T_TOP ? p.shotT / T_TOP : Math.max(0, 1 - (p.shotT - T_TOP) / T_TOP);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; rr(ctx, x - 12, y0 - hgt * m - 3, 24, 6, 3); ctx.fill(); ctx.stroke();
  }
  if (S.ph === "ft" && S.ft && S.ft.st === "aim" && human(S.ft.p.team)) {
    const p = S.ft.p, x = p.x - camX, y = sy(p.z, 152), w = 130, gw = S.hot[p.team] ? 0.22 : 0.14;
    ctx.fillStyle = "#0f172a"; rr(ctx, x - w / 2 - 4, y - 9, w + 8, 18, 9); ctx.fill();
    ctx.fillStyle = "#475569"; rr(ctx, x - w / 2, y - 5, w, 10, 5); ctx.fill();
    ctx.fillStyle = S.hot[p.team] ? "#fb923c" : "#22c55e"; rr(ctx, x - w * gw, y - 5, w * gw * 2, 10, 5); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; rr(ctx, x - w / 2 + w * S.ft.m - 3, y - 12, 6, 24, 3); ctx.fill(); ctx.stroke();
    pill(x, y - 28, `${human(p.team).n.shoot}: stop it in the green`, "#0f172a", "#fde047", 13);
  }
  // one teaching prompt at a time, until the player has done the thing once
  if (human(0) && !human(1)) {
    const p = S.ctrl[0], n = human(0).n, tt = S.tut;
    let text = null;
    if (S.ph === "tip" && !tt.tip && !S.tip.done) text = `${n.shoot}: jump for the ball`;
    else if (S.ph === "inbound" && B.owner === p && !tt.inb) text = `${n.pass}: pass it in`;
    else if (S.ph === "live" && B.st === "held" && B.owner === p && p.act === "") {
      if (S.moved < 0.8 && !tt.shoot) text = `${n.move}: move`;
      else if (!tt.pass) text = `${n.pass}: pass`;
      else if (!tt.shoot) text = `Hold ${n.shoot}, release at the top: shoot`;
    } else if (S.ph === "live" && S.poss === 1 && B.st === "held" && p) {
      if (!tt.def) text = `${n.shoot}: steal / jump to block`;
      else if (!tt.sw) text = `${n.pass}: switch player`;
    }
    if (text && p) pill(p.x - camX, sy(p.z, p.y) - 128 * zs(p.z) - 36, text, "#fde047", "#172554", 15);
  }
}
function hud() {
  const x = 10, y = 8, w = 380, h = 46, mx = x + w / 2;
  ctx.fillStyle = "rgba(15,23,42,.4)"; rr(ctx, x, y + 3, w, h, 12); ctx.fill();
  ctx.fillStyle = "#0f172a"; rr(ctx, x, y, w, h, 12); ctx.fill();
  ctx.textBaseline = "middle";
  for (const team of [0, 1]) {
    const tx = team === 0 ? x + 6 : x + w - 132, T = TEAMS[team];
    ctx.fillStyle = T.jersey; rr(ctx, tx, y + 6, 126, h - 12, 8); ctx.fill();
    if (S.hot[team] || S.hotP[team]) { ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 3.5; rr(ctx, tx, y + 6, 126, h - 12, 8); ctx.stroke(); }
    ctx.fillStyle = "#fff"; ctx.font = `900 15px ${FONT}`; ctx.textAlign = team === 0 ? "left" : "right";
    ctx.fillText(T.name, team === 0 ? tx + 10 : tx + 116, y + h / 2 + 1);
    const nw = ctx.measureText(T.name).width;
    ctx.font = `900 26px ${FONT}`; ctx.textAlign = team === 0 ? "right" : "left"; ctx.fillStyle = T.trim;
    ctx.fillText(String(S.score[team]), team === 0 ? tx + 118 : tx + 8, y + h / 2 + 1);
    if (S.arrow === team) { const ax = team === 0 ? tx + 20 + nw : tx + 106 - nw, d = team === 0 ? -1 : 1; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.moveTo(ax + d * 6, y + h / 2); ctx.lineTo(ax - d * 4, y + h / 2 - 6); ctx.lineTo(ax - d * 4, y + h / 2 + 6); ctx.closePath(); ctx.fill(); }
  }
  ctx.textAlign = "center"; ctx.fillStyle = "#94a3b8"; ctx.font = `900 11px ${FONT}`;
  ctx.fillText(S.period > 4 ? "OT" + (S.period > 5 ? S.period - 4 : "") : "Q" + S.period, mx - 30, y + 14);
  ctx.fillStyle = S.clock <= 10 ? "#f87171" : "#fff"; ctx.font = `900 20px ${FONT}`;
  const cs = Math.ceil(S.clock); ctx.fillText(`${Math.floor(cs / 60)}:${String(cs % 60).padStart(2, "0")}`, mx - 30, y + 31);
  ctx.fillStyle = "#1e293b"; rr(ctx, mx + 8, y + 8, 46, h - 16, 6); ctx.fill();
  ctx.fillStyle = S.shot <= 4 ? "#f87171" : "#fbbf24"; ctx.font = `900 22px ${FONT}`; ctx.fillText(String(Math.ceil(clamp(S.shot, 0, SHOT))), mx + 31, y + h / 2 + 1);
  const b = S.banner;
  if (b) {
    const bx = W / 2 - 250, by = 60, bw = 500, bh = 48, two = !!human(1);
    ctx.fillStyle = "rgba(15,23,42,.4)"; rr(ctx, bx, by + 3, bw, bh, 14); ctx.fill();
    ctx.fillStyle = "#fff7ed"; rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.strokeStyle = "#f97316"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#f97316"; rr(ctx, bx + 8, by + bh - 7, (bw - 16) * clamp(1 - b.t / b.T, 0.01, 1), 4, 2); ctx.fill();
    ctx.fillStyle = "#c2410c"; ctx.font = `900 10px ${FONT}`; ctx.textAlign = "left"; ctx.fillText("HOT HAND", bx + 14, by + 12);
    ctx.fillStyle = "#172554"; ctx.font = `900 ${b.pr.text.length > 14 ? 16 : 21}px ${FONT}`; ctx.fillText(b.pr.text, bx + 14, by + 29);
    const done = two ? b.res[0] != null && b.res[1] != null : b.res[0] != null || (S.auto && b.res[1] != null);
    for (let i = 0; i < 3; i++) {
      const r = chipRect(i), mineI = b.pickI[0] === i || b.pickI[1] === i;
      ctx.fillStyle = mineI ? (i === b.right ? "#16a34a" : "#dc2626") : done && i === b.right ? "#86efac" : "#2563eb"; rr(ctx, r.x, r.y, r.w, r.h, 9); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.25)"; rr(ctx, r.x + 4, r.y + 6, two ? 30 : 20, r.h - 12, 5); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `900 12px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(two ? `${i + 1} ${KEYSB.n.ans[i]}` : String(i + 1), r.x + (two ? 19 : 14), r.y + r.h / 2 + 1);
      ctx.font = `900 ${String(b.ch[i]).length > 3 ? 14 : 18}px ${FONT}`; ctx.fillText(String(b.ch[i]), r.x + (two ? 58 : 53), r.y + r.h / 2 + 1);
    }
  }
  const big = S.big;
  if (big) {
    const a = clamp(big.t * 4, 0, 1), yy = big.small ? (b ? 150 : 136) : 190;
    ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.lineJoin = "round";
    ctx.font = `900 ${big.small ? 26 : 54}px ${FONT}`; ctx.lineWidth = big.small ? 6 : 10; ctx.strokeStyle = "#0f172a"; ctx.strokeText(big.text, W / 2, yy);
    ctx.fillStyle = big.small ? "#fff" : "#fde047"; ctx.fillText(big.text, W / 2, yy);
    if (big.sub) { ctx.font = `900 ${big.small ? 15 : 20}px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText(big.sub, W / 2, yy + (big.small ? 24 : 40)); ctx.fillStyle = "#fff"; ctx.fillText(big.sub, W / 2, yy + (big.small ? 24 : 40)); }
    ctx.globalAlpha = 1;
  }
}
function render() {
  if (!S) setupScene();
  if (posterOn) return poster();
  ctx.save(); ctx.translate(g.shakeX, g.shakeY);
  world();
  if (g.state !== "menu") overlays();
  ctx.restore();
  if (g.state !== "menu") hud();
}
function poster() {
  // one composed hero shot on a square canvas: the dunk, the rim, a late defender, a loud crowd
  if (c.canvas.height !== c.canvas.width) c.canvas.height = c.canvas.width;
  const N = c.canvas.width, k = N / 960;
  const h = HOOPS[1], hero = P[2], d1 = P[5], d2 = P[3], m1 = P[0];
  S.flipped = false; S.hype = 1; S.poss = 0; S.hot = [true, false]; S.ph = "live"; S.t = 0.37; S.pt = [null, null]; S.big = null; S.banner = null;
  Object.assign(hero, { x: h.x - 50, z: HZ + 6, y: 62, act: "dunk", face: 1, vx: 0, vz: 0 });
  Object.assign(d1, { x: h.x + 2, z: HZ - 40, y: 20, act: "jump", face: -1, vx: 0, vz: 0 });
  Object.assign(d2, { x: h.x - 168, z: HZ + 96, y: 0, act: "stun", face: 1, vx: 0, vz: 0 });
  Object.assign(m1, { x: h.x - 215, z: HZ - 150, y: 0, act: "cele", face: 1, vx: 0, vz: 0 });
  P[1].x = -900; P[4].x = -900;
  B.st = "held"; B.owner = hero; B.dead = false;
  const hp = holdPos(hero); B.x = hp[0]; B.z = hp[1]; B.y = hp[2]; B.spin = 0.6;
  camX = h.x - 560;
  fx.clear();
  const z = 3, fx0 = hero.x - camX + 14, fy0 = sy(hero.z, 100);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = "#070b1c"; ctx.fillRect(0, 0, 960, 960);
  ctx.save(); ctx.translate(430, 560); ctx.scale(z, z); ctx.translate(-fx0, -fy0);
  world();
  ctx.restore();
  const gr = ctx.createLinearGradient(0, 0, 0, 430);
  gr.addColorStop(0, "rgba(7,11,28,1)"); gr.addColorStop(0.62, "rgba(7,11,28,.86)"); gr.addColorStop(1, "rgba(7,11,28,0)");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 960, 430);
}

// ---------- wiring ----------
g.debug = {
  get auto() { return dbg.auto; }, set auto(v) { dbg.auto = v; },
  get S() { return S; }, get P() { return P; }, get B() { return B; }, get stats() { return S.stats; }, get score() { return S.score; }, cfg,
  /** Both teams play on their own brains: g.debug.autoplay(0.5, 0.5), then g.advance(seconds) until g.state is "over". */
  autoplay(k0 = 0.5, k1 = 0.5) { dbg.auto = { k: [k0, k1] }; g.start(); return "auto"; },
  answer(team, right) { const b = S.banner; if (!b) return false; answer(team, right ? b.right : (b.right + 1) % 3); return true; },
  force(kind) {
    const o = B.owner;
    if (kind === "oob" && o) { o.free = true; o.z = -12; return true; }
    if (kind === "backcourt" && o) { const h = atk(o.team); S.front = true; o.x = L / 2 + h.dir * 60; return true; }
    if (kind === "shotclock") { S.shot = 0.05; return true; }
    if (kind === "tie") { S.score[1] = S.score[0]; S.period = 4; S.clock = 0.5; return true; }
    if (kind === "clock") { S.clock = 0.5; return true; }
    if (kind === "banner") { S.t = Math.max(S.t, 21); openBanner(); return !!S.banner; }
    if (kind === "ft" && o) { startFT(o, 2); return true; }
    return false;
  },
  give(i) { S.ph = "live"; B.dead = false; give(P[i]); return P[i].name; },
  until(fn, max = 60) { let t = 0; while (!fn() && t < max && g.state === "playing") { g.advance(0.1); t += 0.1; } return !!fn(); },
  poster() {
    setupScene(); posterOn = true; g.closePanel();
    g.stage.style.setProperty("--ak-aspect", "1");
    const n = Math.round(Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2));
    c.canvas.width = n; c.canvas.height = n;
    g.redraw(); setTimeout(() => g.redraw(), 150);
    return true;
  },
};
g.loop(update, render);
