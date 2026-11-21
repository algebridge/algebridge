// Fourth Down: arcade football with real rules. You are always on offense; defense and special
// teams are simulated in a few seconds, the way the classic handheld football games did it.
// World units: x is yards from your own goal line (0 to 100, end zones at -10..0 and 100..110),
// z is across the field (0 to 34). All game logic lives in update() so g.advance() can drive it.
import { createGame, sfx, clamp, lerp, damp, rand, randInt, choose } from "../kit/kit.js";
import { simDrive } from "./sim.js";
import { W, H, PX, FY0, FY1, FW, ZS, lo, L, wy, txt, txs, tw, box, spr, ballSpr, makeCrowd, drawStadium, drawField, drawPosts } from "./art.js";

const QLEN = 75, OTLEN = 60, BALLSPD = 23;
const coarse = matchMedia("(pointer: coarse)").matches;
const ME = { name: "ARCHERS", city: "BRIDGE CITY", abbr: "ARC" };
const UNI = {
  home: { name: "Home blues", a: "#2563eb", b: "#fde047", h: "#f8fafc", p: "#e2e8f0" },
  ice: { name: "Ice", a: "#e0f2fe", b: "#0284c7", h: "#38bdf8", p: "#7dd3fc" },
  gold: { name: "Gold rush", a: "#fbbf24", b: "#1e293b", h: "#fde047", p: "#f8fafc" },
  chrome: { name: "Chrome", a: "#cbd5e1", b: "#2563eb", h: "#f1f5f9", p: "#94a3b8" },
  legend: { name: "Legend", a: "#22d3ee", b: "#f0abfc", h: "#fef9c3", p: "#ecfeff" },
};
const STAD = {
  day: { name: "Day park", f1: "#2f9e44", f2: "#37b24d", line: "#f0fdf4", wall: "#1e3a8a", ad: "#93c5fd", dark: "#172554", side: "#14532d" },
  sunset: { name: "Sunset bowl", f1: "#4d8b31", f2: "#5c9c36", line: "#fff7ed", wall: "#9a3412", ad: "#fed7aa", dark: "#431407", side: "#365314" },
  snow: { name: "Snow field", f1: "#b9cfe4", f2: "#c9dbec", line: "#ffffff", wall: "#334155", ad: "#e2e8f0", dark: "#1e293b", side: "#94a3b8" },
  night: { name: "Night lights", f1: "#166534", f2: "#15803d", line: "#dcfce7", wall: "#0f172a", ad: "#fde047", dark: "#020617", side: "#052e16" },
};
const OPPS = [
  { name: "OTTERS", city: "RIVER", a: "#b45309", b: "#fde68a", h: "#78350f", p: "#451a03" },
  { name: "NEWTS", city: "NEON", a: "#c026d3", b: "#a3e635", h: "#701a75", p: "#3b0764" },
  { name: "CRABS", city: "HARBOR", a: "#dc2626", b: "#fecaca", h: "#7f1d1d", p: "#450a0a" },
  { name: "FOXES", city: "PINE", a: "#ea580c", b: "#1c1917", h: "#431407", p: "#292524" },
  { name: "GEESE", city: "STORM", a: "#475569", b: "#f97316", h: "#1e293b", p: "#0f172a" },
  { name: "GOATS", city: "COPPER", a: "#9a3412", b: "#fbbf24", h: "#57534e", p: "#292524" },
  { name: "OWLS", city: "IRON", a: "#4c1d95", b: "#fbbf24", h: "#2e1065", p: "#1e1b4b" },
  { name: "YETIS", city: "SUMMIT", a: "#0f766e", b: "#f0fdfa", h: "#134e4a", p: "#042f2e" },
  { name: "MOTHS", city: "MIDNIGHT", a: "#18181b", b: "#e879f9", h: "#09090b", p: "#3f3f46" },
];
const LEVELS = ["Rookie", "Pro", "Legend"];
const UNLOCKS = [
  { id: "ice", name: "Ice uniform", need: 40 }, { id: "sunset", name: "Sunset stadium", need: 90 },
  { id: "gold", name: "Gold uniform", need: 150 }, { id: "snow", name: "Snow stadium", need: 220 },
  { id: "chrome", name: "Chrome uniform", need: 300 }, { id: "night", name: "Night stadium", need: 390 },
  { id: "legend", name: "Legend uniform", need: 500 },
];
const ORD = ["", "1ST", "2ND", "3RD", "4TH"];
const cap = (s) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const g = createGame({
  slug: "fourth-down", title: "Fourth Down", tagline: "Read the defense. Lead the throw.", instant: true,
  prompt: coarse ? "Tap to kick off" : "Click or press any key to kick off", aspect: 16 / 9, bg: "#0b1220",
  onMenu: (el) => queueMicrotask(() => fillMenu(el)),
});
const c = g.canvas2d(960, 540);
c.canvas.style.imageRendering = "pixelated";
g.unlocks(UNLOCKS);
g.touchButtons([{ code: "Space", label: "Juke", side: "right" }]);

// ---------- saves ----------
let D = clamp(g.load("level", 0) | 0, 0, 2);
const season = () => ({ i: 0, w: 0, l: 0, t: 0, champ: 0, ...(g.load("season", null) || {}) });
const recText = (s) => `${s.w}-${s.l}${s.t ? "-" + s.t : ""}`;
const pick = (key, table, def) => { const v = g.load(key, def); return table[v] && (v === def || g.unlocked(v)) ? v : def; };
const fullName = (t) => cap(t.city + " " + t.name);
function fillMenu(el) {
  if (!el || !el.isConnected) return;
  const se = season(), op = OPPS[clamp(se.i, 0, 8)];
  const st = "font:inherit;font-weight:800;font-size:clamp(11px,1.7cqw,17px);color:#fff;background:rgb(15 23 42/.72);border:2px solid rgb(255 255 255/.5);border-radius:8px;padding:.3em .7em;margin:.2em;cursor:pointer";
  el.innerHTML = `<p style="margin:.3em 0;font-weight:800;font-size:clamp(11px,1.8cqw,18px)">${se.i >= 8 ? "The Final" : `Game ${se.i + 1} of 8`}: Archers vs ${fullName(op)}. Record ${recText(se)}</p>
    <button data-k="level" style="${st}">Level: ${LEVELS[D]}</button><button data-k="uni" style="${st}">Uniform: ${UNI[pick("uni", UNI, "home")].name}</button><button data-k="stad" style="${st}">Stadium: ${STAD[pick("stad", STAD, "day")].name}</button>`;
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = b.dataset.k;
    if (k === "level") { D = (D + 1) % 3; g.save("level", D); }
    else {
      const table = k === "uni" ? UNI : STAD, def = k === "uni" ? "home" : "day";
      const ids = Object.keys(table).filter((id) => id === def || g.unlocked(id));
      g.save(k, ids[(ids.indexOf(pick(k, table, def)) + 1) % ids.length]);
      if (ids.length === 1) g.toast("Earn XP to unlock more", 1400);
    }
    sfx.play("click"); fillMenu(el); newGame(); g.redraw();
  };
}

// ---------- state ----------
let S = null;
const I = { ax: 0, az: 0, go: false, juke: false, opt: -1, ans: -1, any: false, px: 0, py: 0, pd: false, pp: false, pr: false };
let lastPx = -1, lastPy = -1;
const TOTAL = {};
const ev = (n) => { S.log[n] = (S.log[n] || 0) + 1; TOTAL[n] = (TOTAL[n] || 0) + 1; };
const yds = (n) => { const k = S.pk + "Yds"; TOTAL[k] = (TOTAL[k] || 0) + n; TOTAL[S.pk + "N"] = (TOTAL[S.pk + "N"] || 0) + 1; };
const snd = (n) => { if (!S.auto) sfx.play(n); };
const tone = (...a) => { if (!S.auto) sfx.tone(...a); };
const cheer = (t = 2.5) => { S.cheer = t; if (!S.auto) sfx.noise(0.9, { freq: 1400, vol: 0.12 }); };
const whistle = () => { tone(2300, 0.22, { type: "square", vol: 0.08 }); };
const spotName = (b) => (b === 50 ? "50" : b < 50 ? "OWN " + b : "OPP " + (100 - b));
const scoreLine = () => `${ME.name} ${S.me}  ${S.team.name} ${S.opp}`;
const fgDist = () => 100 - S.ball + 17;
const togoText = () => (S.line >= 100 ? "GOAL" : String(S.line - S.ball));

function newGame() {
  const se = season(), gi = clamp(se.i, 0, 8), team = OPPS[gi];
  const keep = S ? { auto: S.auto, force: S.force } : {};
  S = {
    t: 0, gi, final: gi === 8, team, me: 0, opp: 0, quarter: 1, clock: QLEN, clockRun: false, ball: 30, bz: 17, down: 1, line: 40, poss: 0,
    phase: "title", rating: clamp(0.12 + gi * 0.1 + se.champ * 0.05 + [-0.15, 0, 0.2][D], -0.2, 1.3), log: {}, reads: 0, plays: 0,
    tut: !g.load("tut", 0), try: false, ot: false, cam: 0, cheer: 0, ents: [], fx: [], ft: [], msg: null, marks: true, note: "",
    auto: keep.auto || null, force: keep.force || {}, usePtr: false, ptrT: -9, uni: UNI[pick("uni", UNI, "home")], st: STAD[pick("stad", STAD, "day")],
  };
  S.dm = [0.94, 1, 1.05][D] + S.rating * 0.04;
  S.meC = { ...S.uni, name: ME.name };
  S.opC = team;
  S.crowd = makeCrowd([S.uni.a, S.uni.a, S.uni.b, team.a, "#e2e8f0", "#94a3b8"], S.st.dark);
  lineUp(); makePlay();
  S.cam = clamp((S.los + 10) * PX - 100, 0, 400);
}

// ---------- formation and plays ----------
function lineUp() {
  const los = S.ball, bz = S.bz;
  S.los = los; S.mark = S.line;
  const mk = (team, role, x, z, o) => ({ team, role, x: Math.min(x, 108.5), z, anim: Math.random() * 4, face: team ? -1 : 1, moving: false, down: false, stun: 0, freeAt: 0, frz: 0, spd: 7, ...o });
  const ol = [];
  for (let i = 0; i < 5; i++) ol.push(mk(0, "ol", los - 0.6, bz + (i - 2) * 1.8));
  const qb = mk(0, "qb", los - 4.6, bz, { spd: 6.4 }), rb = mk(0, "rb", los - 4.9, bz + 2.6, { spd: 7.2 });
  const ss = Math.random() < 0.5 ? -1 : 1;
  const rec = [mk(0, "wr", los - 0.6, clamp(bz - 12, 2.5, 31.5), { spd: 7.7 }), mk(0, "wr", los - 1.4, bz + ss * 7, { spd: 7.5 }), mk(0, "wr", los - 0.6, clamp(bz + 12, 2.5, 31.5), { spd: 7.7 })].sort((a, b) => a.z - b.z);
  rec.forEach((r, i) => (r.n = i + 1));
  const te = mk(0, "te", los - 0.6, bz - ss * 5.6);
  const dl = [];
  for (let i = 0; i < 4; i++) dl.push(mk(1, "dl", los + 0.9, bz + (i - 1.5) * 2.2, { spd: 6.3 * S.dm, blk: ol[i < 2 ? i : i + 1] }));
  const lb = [-5.5, 0, 5.5].map((o) => mk(1, "lb", los + 4.6, bz + o, { spd: 7.1 * S.dm, hz: bz + o }));
  const db = rec.map((r) => mk(1, "db", los + 3.6, r.z + Math.sign(bz - r.z) * 0.5, { man: r, spd: 7.5 * S.dm * rand(0.96, 1.02), react: rand(0.2, 0.42) * [1.3, 1, 0.8][D] }));
  rec.forEach((r, i) => (r.cov = db[i]));
  const sf = mk(1, "s", los + 14, bz, { spd: 7.7 * S.dm });
  Object.assign(S, { ol, qb, rb, rec, te, dl, lb, db, sf, off: [...ol, qb, rb, ...rec, te], def: [...dl, ...lb, ...db, sf], car: null, aim: null, tgt: null, bl: null, loose: null });
  S.ents = [...S.off, ...S.def];
}
const ROUTES = { slant: [[2, 0], [11, 8]], hitch: [[6, 0], [4.8, 0.6]], out: [[7, 0], [8.5, -7]], cross: [[4, 0], [9, 18]], curl: [[11, 0], [9, 1.5]], dig: [[10, 0], [11, 12]], corner: [[10, 0], [22, -7]], go: [[13, 0], [36, 0]], post: [[11, 0], [27, 9]] };
function makePlay() {
  const names = [choose(["slant", "hitch", "out", "cross"]), choose(["curl", "dig", "out", "corner"]), choose(["go", "post", "corner"])].sort(() => Math.random() - 0.5);
  S.rec.forEach((r, i) => {
    const ins = Math.sign(S.bz - r.z) || 1, nm = names[i];
    r.stop = nm === "hitch" || nm === "curl";
    r.route = ROUTES[nm].map(([dx, dz]) => ({ x: Math.min(S.los + dx, 108.5), z: clamp(r.z + dz * ins, 1.5, 32.5) }));
    r.wp = 0;
    const a = r.route[r.route.length - 2] || r, b = r.route[r.route.length - 1], dd = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    r.dx = (b.x - a.x) / dd; r.dz = (b.z - a.z) / dd;
  });
  S.star = choose(S.rec);
  S.gapz = S.bz + choose([-5.6, -2.2, 0, 2.2, 5.6]);
}
function go(p, tx, tz, sp, dt) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.03) { p.moving = false; return true; }
  const s = Math.min(d, sp * dt);
  p.x += (dx / d) * s; p.z += (dz / d) * s; p.moving = true; p.anim += dt * 9;
  if (Math.abs(dx) > 0.15) p.face = dx > 0 ? 1 : -1;
  return s >= d - 1e-6;
}
function routeGoal(p, r) {
  const w = r.route[p.wp];
  if (w) return [w.x, w.z, r.spd, true];
  if (r.stop) return null;
  return [clamp(p.x + r.dx * 4, -9, 108.5), clamp(p.z + r.dz * 4, 1.5, 32.5), r.spd * 0.92, false];
}
function runRoute(r, dt) {
  const t = routeGoal(r, r);
  if (!t) { r.moving = false; r.face = -1; return; }
  if (go(r, t[0], t[1], t[2], dt) && t[3]) { r.wp++; if (r.cov) r.cov.frz = r.cov.react; }
}
/** Where a receiver will be in T seconds if he keeps running his route. */
function future(r, T) {
  const p = { x: r.x, z: r.z, wp: r.wp };
  for (let t = T; t > 0; t -= 1 / 30) {
    const dt = Math.min(1 / 30, t), q = routeGoal(p, r);
    if (!q) break;
    const dx = q[0] - p.x, dz = q[1] - p.z, d = Math.hypot(dx, dz);
    if (d < 0.03) { if (q[3]) p.wp++; else break; continue; }
    const s = Math.min(d, q[2] * dt);
    p.x += (dx / d) * s; p.z += (dz / d) * s;
    if (q[3] && s >= d - 1e-6) p.wp++;
  }
  return p;
}
function lead(r) {
  const q = S.qb;
  let T = 0.5, tg = r;
  for (let i = 0; i < 4; i++) { tg = future(r, T); T = clamp(Math.hypot(tg.x - q.x, tg.z - q.z) / BALLSPD, 0.3, 2.4); }
  return { x: tg.x, z: tg.z, T };
}
const openness = (r) => { let m = 99; for (const d of S.def) if (!d.down) m = Math.min(m, Math.hypot(d.x - r.x, d.z - r.z)); return m; };

// ---------- flow ----------
const PH = {};
function msg(lines, dur, then, o = {}) { S.phase = "msg"; S.msg = { lines: lines.filter(Boolean), t: 0, dur, then, run: !!o.run, tone: o.tone || "" }; }
PH.msg = (dt) => {
  const m = S.msg;
  m.t += dt;
  if (m.t > 0.3 && I.any) m.t = m.dur;
  if (m.t >= m.dur) { S.msg = null; m.then(); }
};
function opening() {
  const won = S.force.toss != null ? !!S.force.toss : S.tut || Math.random() < 0.5;
  S.recvFirst = won ? 0 : 1;
  ev("coinToss");
  kickoff(S.recvFirst, false, [`COIN TOSS: ${won ? ME.name : S.team.name} WIN IT`, won ? "YOU RECEIVE THE KICK" : "YOU KICK OFF"]);
}
function checkClock(cont) {
  if (S.clock > 0) return cont();
  const q = S.quarter;
  ev("quarterEnd"); whistle();
  S.clockRun = false;
  if (q === 1 || q === 3) { S.quarter++; S.clock = QLEN; return msg([`END OF QUARTER ${q}`, scoreLine()], 1.4, cont); }
  if (q === 2) { S.quarter = 3; S.clock = QLEN; ev("halftime"); return msg(["HALFTIME", scoreLine(), S.recvFirst ? "YOU RECEIVE THE KICK" : "YOU KICK OFF"], 2, () => kickoff(S.recvFirst ? 0 : 1)); }
  if (S.me !== S.opp) return endGame();
  if (q >= 5 && !S.final) return endGame();
  S.quarter = q + 1; S.clock = OTLEN; S.ot = true; ev("overtime");
  const won = S.force.toss != null ? !!S.force.toss : Math.random() < 0.5;
  msg(["OVERTIME", "TIED " + S.me + " TO " + S.opp, "NEXT SCORE WINS"], 2, () => kickoff(won ? 0 : 1, false, [`COIN TOSS: ${won ? ME.name : S.team.name} WIN IT`]));
}
function fly(o) { S.phase = "fly"; S.marks = false; S.car = null; S.fl = { t: 0, T: 1.2, z0: 17, z1: 17, h: 26, bx: o.x0, ...o }; S.ents = o.ents || []; }
PH.fly = (dt) => {
  const f = S.fl;
  f.t += dt;
  const skip = I.any && f.t > 0.25;
  f.bx = lerp(f.x0, f.x1, clamp(f.t / f.T, 0, 1));
  if (f.t >= f.T && f.runner && !skip) { if (!go(f.runner, f.ret, 17, 17, dt)) { f.bx = f.runner.x; return; } }
  if (f.t >= f.T + (f.runner ? 0 : 0.3) || skip) { if (f.runner) f.runner.x = f.ret; f.then(); }
};
const actor = (team, x, z, o) => ({ team, x, z, anim: 0, face: team ? -1 : 1, moving: false, down: false, ...o });
function kickoff(to, free, top) {
  S.clockRun = false; S.try = false; ev("kickoff");
  tone(140, 0.12, { type: "square", vol: 0.15 });
  if (to === 0) {
    S.poss = 0;
    const tb = !free && Math.random() < 0.3, spot = tb ? 25 : free ? randInt(32, 45) : randInt(18, 36);
    if (tb) ev("touchback");
    const runner = actor(0, tb ? -4 : randInt(2, 9), 17, { ball: false });
    fly({ x0: free ? 80 : 65, x1: runner.x, top, label: free ? "FREE KICK" : "KICKOFF", runner: tb ? null : runner, ret: spot, ents: [actor(1, free ? 81 : 66, 17), runner],
      then: () => { S.note = tb ? "TOUCHBACK. BALL AT THE OWN 25" : "KICK RETURNED TO THE " + spotName(spot); startDrive(spot); } });
  } else {
    S.poss = 1;
    const tb = !free && Math.random() < 0.35, pos = tb ? 25 : free ? randInt(30, 42) : randInt(18, 34);
    if (tb) ev("touchback");
    fly({ x0: free ? 20 : 35, x1: tb ? 104 : randInt(91, 98), top, label: free ? "FREE KICK" : "KICKOFF", ents: [actor(0, free ? 19 : 34, 17), actor(1, tb ? 104 : 95, 17)],
      then: () => oppDrive(pos, tb ? "TOUCHBACK" : "KICKOFF RETURN") });
  }
}
function startDrive(ball) {
  S.poss = 0; S.ball = clamp(ball, 1, 99); S.bz = 17; S.down = 1; S.line = Math.min(100, S.ball + 10); S.try = false;
  card();
}
function card() {
  S.phase = "card"; S.marks = true; S.ct = 0; S.read = 0; S.ai = null;
  S.pc = S.tut ? 45 : [20, 15, 12][D];
  lineUp(); makePlay();
  const o = [{ k: "pass", label: "PASS", col: "#2563eb" }, { k: "run", label: "RUN", col: "#16a34a" }];
  if (S.down === 4 && !S.try) { o.push({ k: "punt", label: "PUNT", col: "#475569" }); if (fgDist() <= 55) o.push({ k: "fg", label: "KICK", col: "#d97706" }); }
  S.opts = o;
  S.prob = S.tut || S.try || S.plays < 2 ? null : makeProblem();
  if (Math.abs((S.los + 10) * PX - 100 - S.cam) > 150) S.cam = clamp((S.los + 10) * PX - 100, 0, 400);
}
const optRects = () => { const n = S.opts.length, w = n > 2 ? 74 : 100, x0 = Math.round((W - (n * w + (n - 1) * 4)) / 2); return S.opts.map((o, i) => ({ x: x0 + i * (w + 4), y: 152, w, h: 13 })); };
const ansRects = () => [0, 1, 2].map((i) => ({ x: 198 + i * 40, y: 167, w: 37, h: 11 }));
const inR = (r) => I.px >= r.x && I.px < r.x + r.w && I.py >= r.y - 1 && I.py < r.y + r.h + 1;
const clicked = (rects) => (I.pp ? rects.findIndex(inR) : -1);
PH.card = (dt) => {
  S.ct += dt; S.pc -= dt;
  if (S.pc <= 0) return delayOfGame();
  if (S.prob && !S.read) {
    let a = I.ans;
    if (a < 0) a = clicked(ansRects());
    if (a >= 0) {
      if (S.prob.choices[a] === S.prob.answer) { S.read = 1; S.reads++; ev("readRight"); snd("correct"); ftext("GOOD READ!", S.star.x, S.star.z, "#fde047"); }
      else { S.read = -1; ev("readWrong"); snd("wrong"); }
      return;
    }
  }
  let k = I.opt;
  if (k < 0) k = clicked(optRects());
  if (k >= 0 && k < S.opts.length && S.ct > 0.12) callPlay(S.opts[k].k);
};
function callPlay(k) {
  S.note = "";
  if (k === "punt") return punt();
  if (k === "fg") return startKick("fg");
  snap(k);
}
function delayOfGame() {
  ev("delay"); whistle();
  const pen = Math.min(5, Math.floor(S.ball / 2));
  S.ball = Math.max(1, S.ball - pen); S.clockRun = true;
  msg(["DELAY OF GAME", `${pen} YARD PENALTY`, "PICK A PLAY BEFORE THE PLAY CLOCK HITS 0"], 1.6, () => checkClock(card), { run: true });
}
function snap(kind) {
  S.plays++; S.pk = kind; S.slow = 0; S.pt = 0; S.rt = 0; S.juke = 0; S.jcd = 0; S.safeT = 0; S.armed = false; S.design = false;
  tone(190, 0.06, { type: "square", vol: 0.18 });
  const read = S.read > 0 ? 1 : 0;
  if (kind === "pass") {
    S.phase = "pass"; S.car = S.qb;
    S.hold = [4.6, 3.6, 3.0][D] + read * 1.5 + (S.tut ? 5 : 0) - S.rating * 0.4;
    [0, 1, 2, 3].sort(() => Math.random() - 0.5).forEach((di, k) => (S.dl[di].freeAt = S.hold + k * 0.5 + rand(0, 0.3)));
    if (D > 0 && !S.tut && Math.random() < 0.12 * D) { const b = choose(S.lb); b.blitz = true; b.freeAt = S.hold - 0.5; }
    if (read) { S.star.cov.react = 1.1; S.star.cov.spd *= 0.9; } else S.star.cov.react *= 1.3;
  } else {
    S.phase = "run"; S.car = S.rb; S.safeT = 0.35; S.design = true;
    const m = [1.3, 1, 0.82][D], bonus = read * 0.8 + (S.tut ? 1.5 : 0);
    for (const d of S.dl) d.freeAt = rand(1.1, 1.9) * m + bonus;
    const tl = S.te.z < S.bz ? S.lb[0] : S.lb[2];
    for (const d of S.lb) { if (d === S.lb[1]) { d.blk = S.ol[2]; d.freeAt = rand(0.9, 1.5) * m + bonus; } else if (d === tl) { d.blk = S.te; d.freeAt = rand(0.9, 1.4) * m + bonus; } else d.freeAt = 0.4; }
    for (const d of S.db) { d.blk = d.man; d.freeAt = rand(1.0, 2.0) * m + bonus; }
    S.sf.freeAt = 0.6;
  }
}

// ---------- live play ----------
function ptrRec() {
  let best = null, bd = 1e9;
  for (const r of S.rec) { const d = Math.hypot((r.x + 10) * PX - S.cam - I.px, wy(r.z) - 8 - I.py); if (d < bd) { bd = d; best = r; } }
  return best;
}
function coverage(dt) {
  let deep = S.rec[0];
  for (const r of S.rec) if (r.x > deep.x) deep = r;
  for (const d of S.def) {
    if (d.man) {
      const r = d.man;
      if (d.frz > 0) { d.frz -= dt; go(d, r.x, r.z, d.spd * 0.35, dt); }
      else if (r === S.tgt) go(d, r.to.x, r.to.z, d.spd, dt);
      else go(d, Math.min(r.x + Math.max(0.7, 3.4 - S.pt * 2.2), 109), r.z + Math.sign(S.bz - r.z) * 0.5, d.spd, dt);
    } else if (d.role === "lb" && !d.blitz) {
      if (S.tgt && Math.hypot(S.tgt.to.x - d.x, S.tgt.to.z - d.z) < 12) { go(d, S.tgt.to.x, S.tgt.to.z, d.spd, dt); continue; }
      let n = null, nd = 6;
      for (const r of S.rec) { const q = Math.hypot(r.x - (S.los + 6.5), r.z - d.hz); if (q < nd) { nd = q; n = r; } }
      if (n) go(d, n.x + 0.6, n.z, 5.2 * S.dm, dt); else go(d, Math.min(S.los + 6.5, 108), d.hz, 4, dt);
    } else if (d.role === "s") {
      if (S.tgt) go(d, S.tgt.to.x, S.tgt.to.z, d.spd, dt);
      else go(d, Math.min(Math.max(S.los + 12, deep.x + 4), 108.5), lerp(S.bz, deep.z, 0.5), d.spd, dt);
    }
  }
}
function rush(dt) {
  const q = S.qb;
  for (const d of S.def) {
    if (d.role !== "dl" && !d.blitz) continue;
    if (S.pt < d.freeAt) {
      if (d.blitz) { go(d, S.los + 0.8, d.z, 5, dt); continue; }
      d.x -= 0.3 * dt; d.moving = true; d.anim += dt * 6;
      if (d.blk) { go(d.blk, d.x - 1.2, d.z, 3, dt); d.blk.moving = true; d.blk.face = 1; }
    } else {
      go(d, q.x, q.z, d.spd, dt);
      if (S.phase === "pass" && Math.hypot(d.x - q.x, d.z - q.z) < 0.95) return d;
    }
  }
  return null;
}
PH.pass = (dt) => {
  S.pt += dt;
  const q = S.qb;
  if (I.ax || I.az) {
    const n = Math.hypot(I.ax, I.az);
    q.x = Math.max(-9.5, q.x + (I.ax / n) * 5.6 * dt); q.z = clamp(q.z + (I.az / n) * 5.6 * dt, 0.5, FW - 0.5);
    q.moving = true; q.anim += dt * 9;
  } else if (S.pt < 0.45) go(q, S.los - 6.2, S.bz, 4, dt);
  else q.moving = false;
  q.face = 1;
  if (q.x > S.los + 0.4) { ftext("SCRAMBLE!", q.x, q.z, "#fde047"); return toRun(q, 0); }
  for (const r of S.rec) runRoute(r, dt);
  coverage(dt);
  const sacker = rush(dt);
  if (sacker) return sack(sacker);
  let best = S.rec[0], bo = -1;
  for (const r of S.rec) { r.open = openness(r); const v = Math.min(r.open, 4) + r.x * 0.01; if (v > bo) { bo = v; best = r; } }
  const byPtr = S.usePtr && (I.pd || g.time - S.ptrT < 3);
  S.aim = byPtr ? ptrRec() : best;
  if (I.pp) S.armed = true;
  let th = null;
  if (I.opt >= 0 && I.opt < 3) th = S.rec[I.opt];
  else if (I.go) th = S.aim;
  else if (I.pr && S.armed) th = ptrRec();
  if (th && S.pt > 0.2) throwTo(th);
};
function throwTo(r) {
  const q = S.qb, tg = lead(r);
  r.to = tg; S.tgt = r; S.car = null; S.phase = "air"; ev("pass");
  S.bl = { x0: q.x + 0.5, z0: q.z, x1: tg.x, z1: tg.z, t: 0, T: tg.T, h: 5 + Math.hypot(tg.x - q.x, tg.z - q.z) * 0.55 };
  snd("whoosh");
}
PH.air = (dt) => {
  const b = S.bl, r = S.tgt;
  S.pt += dt; b.t += dt;
  go(r, r.to.x, r.to.z, r.spd * 1.05, dt);
  if (b.T - b.t < 0.25) r.arms = true;
  for (const o of S.rec) if (o !== r) runRoute(o, dt);
  coverage(dt); rush(dt);
  if (b.t >= b.T) resolveThrow();
};
function resolveThrow() {
  const b = S.bl, r = S.tgt, tx = b.x1, tz = b.z1;
  let dmin = 99, dn = null;
  for (const d of S.def) { const dd = Math.hypot(d.x - tx, d.z - tz); if (dd < dmin) { dmin = dd; dn = d; } }
  let pC = clamp(0.3 + 0.18 * dmin, 0.3, 0.95) + [0.06, 0, -0.06][D];
  const pI = S.tut ? 0 : clamp(0.2 - 0.065 * dmin, 0.006, 0.2) * [0.5, 1, 1.3][D];
  if (Math.hypot(r.x - tx, r.z - tz) > 1.6) pC = 0;
  if (S.tut && S.plays < 3) pC = 1;
  const roll = Math.random();
  let res = roll < pI ? "int" : roll < pI + pC ? "catch" : "inc";
  if (S.force.pass) { res = S.force.pass; S.force.pass = null; }
  S.bl = null; S.tgt = null; r.arms = false;
  if (res === "catch") {
    ev("catch"); snd("pop"); burst(tx, tz, 8, ["#fde047", "#fff"]);
    r.x = tx; r.z = tz;
    if (S.read > 0 && r === S.star) ftext("OPEN!", tx, tz, "#86efac");
    if (tx >= 100) { S.car = r; return playOver("td"); }
    return toRun(r, 0.25);
  }
  if (res === "int" && !S.try) { dn.x = tx; dn.z = tz; S.car = dn; return playOver("int", { x: tx }); }
  S.loose = { x: tx + 1, z: tz };
  playOver("inc");
}
function toRun(p, safe) {
  S.phase = "run"; S.car = p; S.rt = 0; S.design = false; S.safeT = safe; S.slow = safe ? 0.3 : 0; if (p.role === "wr") p.spd = 6.8;
  for (const o of S.off) if (o !== p) o.moving = false;
}
function sack(d) {
  const q = S.qb;
  q.down = true; d.down = true; g.shake(6, 0.2); snd("hit");
  const strip = !S.tut && !S.try && (S.force.fumble || Math.random() < [0.02, 0.05, 0.08][D]);
  S.force.fumble = false;
  playOver(strip ? "fumble" : "sack", { x: q.x });
}
PH.run = (dt) => {
  S.rt += dt;
  const c0 = S.car;
  if (S.safeT > 0) S.safeT -= dt;
  if (S.jcd > 0) S.jcd -= dt;
  if (S.juke > 0) S.juke -= dt;
  let ax = I.ax, az = I.az;
  if (S.usePtr && !ax && !az) {
    const pz = (I.py - FY0) / ZS, px = (I.px + S.cam) / PX - 10, dz = pz - c0.z;
    az = Math.abs(dz) < 0.8 ? 0 : clamp(dz / 2.5, -1, 1);
    ax = I.pd && px < c0.x - 3 ? -1 : 1;
  } else if (!ax) ax = az ? 0.8 : 1;
  if (I.juke && S.jcd <= 0 && S.rt > 0.1) {
    let nd = null, nn = 99;
    for (const d of S.def) { const q = Math.hypot(d.x - c0.x, d.z - c0.z); if (q < nn && !d.down) { nn = q; nd = d; } }
    S.juke = 0.25; S.jcd = 1.8; S.jdir = az ? Math.sign(az) : nd && nd.z > c0.z ? -1 : 1;
    if (c0.z < 3) S.jdir = 1;
    if (c0.z > FW - 3) S.jdir = -1;
    snd("whoosh"); burst(c0.x, c0.z, 6, ["#e2e8f0", "#fff"]); ev("juke");
  }
  const n = Math.hypot(ax, az) || 1;
  const sp = c0.spd * (S.slow > 0 ? 0.55 : 1);
  if (S.slow > 0) S.slow -= dt;
  let vx = (ax / n) * sp, vz = (az / n) * sp;
  if (S.juke > 0) { vz = S.jdir * 15; vx = Math.max(vx, c0.spd * 0.8); }
  c0.x = Math.max(-9.5, c0.x + vx * dt); c0.z += vz * dt; c0.moving = true; c0.anim += dt * 10;
  if (Math.abs(vx) > 0.5) c0.face = vx > 0 ? 1 : -1;
  if (c0.x >= 100) return playOver("td");
  if (c0.z < 0 || c0.z > FW) { c0.z = clamp(c0.z, 0, FW); return playOver("oob"); }
  for (const d of S.def) {
    if (d.stun > 0) { d.stun -= dt; d.moving = false; if (d.stun <= 0) d.down = false; continue; }
    const eng = S.design && S.rt < d.freeAt;
    if (eng) {
      const b = d.blk;
      if (b) {
        const near = Math.hypot(b.x - d.x, b.z - d.z) < 1.6;
        go(b, d.x - 0.9, d.z, 6.5, dt);
        if (d.role === "dl") { if (S.rt < 1) { d.x += 0.5 * dt; d.z += (d.z < S.gapz ? -1 : 1) * 0.9 * dt; } d.moving = true; d.anim += dt * 6; }
        else if (!near) go(d, c0.x + 1, c0.z, 2.5, dt);
        else { d.moving = true; d.anim += dt * 6; }
      } else d.moving = false;
    } else {
      const dist = Math.hypot(c0.x - d.x, c0.z - d.z), ld = clamp((dist / d.spd) * 0.55, 0, 0.7);
      go(d, c0.x + vx * ld, clamp(c0.z + vz * ld, 0, FW), d.spd * 1.14, dt);
    }
    if (Math.hypot(d.x - c0.x, d.z - c0.z) < (eng ? 0.6 : 1.0)) {
      if (S.juke > 0) { if (!d.missed) { d.missed = 1; d.stun = 0.8; d.down = true; ftext("JUKED!", d.x, d.z, "#fde047"); snd("bounce"); } }
      else if (S.safeT > 0) continue;
      else if (!d.tried && Math.random() < [0.15, 0.08, 0.04][D] + (S.tut ? 0.5 : 0)) { d.tried = 1; d.stun = 0.9; d.down = true; ftext("BROKE THE TACKLE", d.x, d.z, "#fff"); g.hitstop(0.04); snd("bounce"); }
      else return tackle(d);
    }
  }
  for (let i = 0; i < S.def.length; i++) for (let j = i + 1; j < S.def.length; j++) {
    const a = S.def[i], b = S.def[j];
    if (Math.abs(a.x - b.x) < 0.9 && Math.abs(a.z - b.z) < 0.9) { const s = a.z <= b.z ? -1 : 1; a.z += s * 1.5 * dt; b.z -= s * 1.5 * dt; }
  }
};
function tackle(d) {
  const p = S.car;
  p.down = true; d.down = true; g.shake(5, 0.18); g.hitstop(0.05); snd("hit"); burst(p.x, p.z, 6, ["#e2e8f0", "#bbf7d0"]);
  const fum = !S.tut && !S.try && (S.force.fumble || Math.random() < [0.008, 0.02, 0.032][D]);
  S.force.fumble = false;
  playOver(fum ? "fumble" : "tackle", { x: p.x });
}

// ---------- the whistle: what the play did ----------
function playOver(kind, o = {}) {
  const p = S.car, x = o.x ?? (p ? p.x : S.ball);
  if (kind !== "inc" && p) S.bz = clamp(p.z, 13.5, 20.5);
  if ((kind === "tackle" || kind === "sack" || kind === "oob") && x <= 0) kind = "safety";
  if (S.try) {
    const good = kind === "td";
    if (good) { cheer(); burst(x, p.z, 20, [S.uni.a, S.uni.b, "#fff"]); }
    return tryDone(good, 2);
  }
  const opp = S.team.name;
  switch (kind) {
    case "td":
      S.me += 6; ev("td"); yds(100 - S.ball); cheer(3.5); g.shake(8, 0.4); snd("win"); burst(x, p.z, 30, [S.uni.a, S.uni.b, "#fff"]); p.arms = true; S.clockRun = false; S.tut = false; g.save("tut", 1);
      return msg(["TOUCHDOWN!", "6 POINTS", scoreLine()], 1.8, S.ot ? endGame : tryCard, { tone: "gold" });
    case "safety":
      S.opp += 2; ev("safetyAgainst"); snd("lose"); S.clockRun = false;
      return msg(["SAFETY", "DOWNED IN YOUR OWN END ZONE", `2 POINTS FOR THE ${opp}`], 2, () => (S.ot ? endGame() : checkClock(() => kickoff(1, true))), { tone: "bad" });
    case "int": case "fumble": {
      ev(kind); snd("wrong"); S.clockRun = false; g.shake(6, 0.25);
      const tb = kind === "int" && x >= 100, pos = tb ? 20 : 100 - clamp(Math.round(x), 1, 99);
      if (tb) ev("touchback");
      return msg([kind === "int" ? "INTERCEPTED!" : "FUMBLE!", tb ? "TOUCHBACK" : `${opp} RECOVER`, `${opp} BALL AT THEIR ${pos}`], 1.7, () => checkClock(() => oppDrive(pos, "AFTER THE TURNOVER")), { tone: "bad" });
    }
    case "inc": S.clockRun = false; ev("incomplete"); snd("tick"); return advance(S.ball, "INCOMPLETE");
    case "oob": S.clockRun = false; ev("oob"); whistle(); return advance(x, "OUT OF BOUNDS");
    case "sack": S.clockRun = true; ev("sack"); return advance(x, "SACKED!");
    default: S.clockRun = true; whistle(); return advance(x);
  }
}
function advance(x, head) {
  const spot = clamp(Math.round(x), 1, 99), gain = spot - S.ball;
  yds(gain);
  S.ball = spot;
  const gl = gain > 0 ? `GAIN OF ${gain}` : gain < 0 ? `LOSS OF ${-gain}` : head === "INCOMPLETE" ? "" : "NO GAIN";
  const stop = head === "OUT OF BOUNDS" || head === "INCOMPLETE" ? "CLOCK STOPS" : "";
  if (spot >= S.line) {
    ev("firstDown"); S.down = 1; S.line = Math.min(100, spot + 10); snd("coin"); cheer(1.2);
    if (S.tut) { S.tut = false; g.save("tut", 1); }
    return msg(["FIRST DOWN!", gl, head === "OUT OF BOUNDS" ? "OUT OF BOUNDS. CLOCK STOPS" : ""], 1.0, () => checkClock(card), { run: true, tone: "gold" });
  }
  if (S.down === 4) {
    ev("turnoverOnDowns"); S.clockRun = false; snd("wrong");
    return msg(["TURNOVER ON DOWNS", head || gl, `${S.team.name} BALL AT THEIR ${100 - spot}`], 1.7, () => checkClock(() => oppDrive(100 - spot, "TAKING OVER ON DOWNS")), { tone: "bad" });
  }
  S.down++;
  msg([head || gl, [head ? gl : "", stop].filter(Boolean).join(". "), `${ORD[S.down]} AND ${togoText()}`], 1.0, () => checkClock(card), { run: true });
}
function tryCard() {
  S.phase = "trycard"; S.ct = 0; S.marks = false;
  S.opts = [{ k: "xp", label: "KICK 1", col: "#d97706" }, { k: "two", label: "GO FOR 2", col: "#2563eb" }];
}
PH.trycard = (dt) => {
  S.ct += dt;
  let k = I.opt;
  if (k < 0) k = clicked(optRects());
  if (k < 0 || k > 1 || S.ct < 0.15) return;
  if (k === 0) return startKick("xp");
  S.try = true; S.ball = 98; S.bz = 17; S.line = 100; S.down = 1;
  card();
};
function tryDone(good, pts) {
  S.try = false;
  if (good) S.me += pts;
  ev(pts === 1 ? (good ? "xpGood" : "xpMiss") : good ? "twoGood" : "twoFail");
  snd(good ? "correct" : "wrong");
  msg([good ? (pts === 1 ? "EXTRA POINT IS GOOD" : "2 POINT TRY IS GOOD!") : pts === 1 ? "KICK IS NO GOOD" : "2 POINT TRY FAILS", scoreLine()], 1.3, () => checkClock(() => kickoff(1)), { tone: good ? "gold" : "" });
}
function startKick(kind) {
  const dist = kind === "xp" ? 33 : fgDist();
  S.phase = "fg"; S.marks = kind !== "xp";
  S.fg = { kind, dist, t: 0, pos: 0, w: clamp(0.38 - (dist - 20) * 0.0065, 0.1, 0.38) * [1.35, 1, 0.78][D] };
}
PH.fg = (dt) => {
  const f = S.fg;
  f.t += dt;
  const ph = (f.t * [0.75, 0.95, 1.2][D]) % 2;
  f.pos = ph < 1 ? ph : 2 - ph;
  if (!((I.go || I.pp) && f.t > 0.25) && f.t < 5) return;
  const off = Math.abs(f.pos - 0.5);
  let good = off < f.w / 2 || (off < f.w / 2 + 0.05 && Math.random() < 0.4);
  if (S.force.fg != null) { good = !!S.force.fg; S.force.fg = null; }
  tone(120, 0.1, { type: "square", vol: 0.2 });
  fly({ x0: (f.kind === "xp" ? 85 : S.ball) - 7, x1: 111, T: 1.1, h: 30, z1: good ? 17 : 17 + (f.pos < 0.5 ? -9 : 9), ents: S.ents, then: () => kicked(f, good) });
};
function kicked(f, good) {
  if (f.kind === "xp") return tryDone(good, 1);
  S.clock = Math.max(0, S.clock - 3); S.clockRun = false;
  if (good) {
    S.me += 3; ev("fgGood"); cheer(); snd("win");
    return msg(["FIELD GOAL IS GOOD!", `${f.dist} YARDS. 3 POINTS`, scoreLine()], 1.5, () => (S.ot ? endGame() : checkClock(() => kickoff(1))), { tone: "gold" });
  }
  ev("fgMiss"); snd("wrong");
  const pos = Math.max(20, 100 - (S.ball - 7));
  msg(["NO GOOD", `${f.dist} YARD KICK MISSES`, `${S.team.name} BALL AT THEIR ${pos}`], 1.5, () => checkClock(() => oppDrive(pos, "AFTER THE MISS")));
}
function punt() {
  ev("punt"); tone(130, 0.1, { type: "square", vol: 0.2 });
  const from = S.ball, land = from + randInt(34, 50), tb = land >= 100, pos = tb ? 20 : clamp(100 - land + randInt(0, 8), 1, 99);
  if (tb) ev("touchback");
  S.clock = Math.max(0, S.clock - 3); S.clockRun = false;
  fly({ x0: from - 12, x1: Math.min(land, 105), T: 1.4, h: 34, label: "PUNT", ents: S.ents,
    then: () => msg([tb ? "PUNT. TOUCHBACK" : `PUNT NETS ${100 - pos - from} YARDS`, `${S.team.name} BALL AT THEIR ${pos}`], 1.2, () => checkClock(() => oppDrive(pos, "AFTER THE PUNT"))) });
}

// ---------- the other team's drive (simulated) ----------
function oppDrive(pos, intro) {
  S.tut = false; S.poss = 1; S.clockRun = false; S.marks = false; S.try = false;
  const need = S.me - S.opp;
  const o = { pos, rating: S.rating, clock: S.clock, quarter: S.quarter, qlen: QLEN, mustGo: S.quarter === 4 && need > 0 && S.clock < 30, need };
  let res = simDrive(o);
  if (S.force.opp) { for (let i = 0; i < 4000 && res.result !== S.force.opp; i++) res = simDrive(o); S.force.opp = null; }
  S.od = { res, t: 0, x0: 100 - pos, x1: 100 - res.pos, mx: 100 - pos, intro, shown: false, lines: null };
  S.phase = "opp";
  const z = 17;
  S.ents = [actor(1, 0, z, { lead: 0, ball: true }), actor(1, 0, z - 4, { lead: -2 }), actor(1, 0, z + 4, { lead: -2.5 }), actor(0, 0, z - 6, { lead: 6, face: -1 }), actor(0, 0, z + 1, { lead: 8, face: -1 }), actor(0, 0, z + 7, { lead: 5, face: -1 })];
  for (const e of S.ents) e.x = S.od.mx - e.lead;
  if (Math.abs((S.od.mx + 10) * PX - 200 - S.cam) > 150) S.cam = clamp((S.od.mx + 10) * PX - 200, 0, 400);
}
PH.opp = (dt) => {
  const d = S.od, r = d.res, T = 1.9;
  d.t += dt;
  if (I.any && d.t > 0.3) d.t = d.shown ? 99 : Math.max(d.t, T);
  const p = clamp((d.t - 0.4) / (T - 0.5), 0, 1);
  d.mx = lerp(d.x0, d.x1, p * p * (3 - 2 * p));
  for (const e of S.ents) { e.x = clamp(d.mx - e.lead, -9, 109); e.moving = p > 0 && p < 1; if (e.moving) e.anim += dt * 9; }
  if (d.t >= T && !d.shown) {
    d.shown = true;
    for (let i = 0; i < r.qx; i++) ev("quarterEnd");
    S.clock = r.clock; S.quarter = r.quarter;
    const o = S.team.name, at = () => "YOUR BALL AT THE " + spotName(r.myBall), sum = `${r.plays} PLAYS, ${r.yards} YARDS`;
    if (r.touchback) ev("touchback");
    switch (r.result) {
      case "td": S.opp += r.pts; ev("oppTd"); snd("lose"); d.lines = [`TOUCHDOWN ${o}`, sum, r.xp ? "KICK IS GOOD" : "KICK IS NO GOOD"]; d.tone = "bad"; break;
      case "fg": S.opp += 3; ev("oppFg"); snd("lose"); d.lines = [`${o} FIELD GOAL`, `${r.dist} YARD KICK IS GOOD`]; d.tone = "bad"; break;
      case "fgMiss": ev("oppFgMiss"); snd("correct"); d.lines = ["THEIR KICK IS NO GOOD!", `${r.dist} YARD TRY MISSES`, at()]; break;
      case "punt": ev("oppPunt"); snd("correct"); d.lines = ["YOUR DEFENSE HOLDS!", r.touchback ? `${o} PUNT. TOUCHBACK` : `${o} PUNT ${r.net} YARDS`, at()]; break;
      case "downs": ev("defStop"); snd("correct"); cheer(1.5); d.lines = ["STOPPED ON 4TH DOWN!", "TURNOVER ON DOWNS", at()]; break;
      case "int": ev("defInt"); snd("power"); cheer(2); d.lines = ["INTERCEPTION!", r.touchback ? "YOUR DEFENSE PICKS IT. TOUCHBACK" : "YOUR DEFENSE PICKS IT OFF", at()]; d.tone = "gold"; break;
      case "fumble": ev("defFumble"); snd("power"); cheer(2); d.lines = ["FUMBLE! YOU RECOVER", sum, at()]; d.tone = "gold"; break;
      case "safety": S.me += 2; ev("safetyFor"); snd("power"); cheer(2); d.lines = ["SAFETY!", `2 POINTS FOR THE ${ME.name}`, "THEY KICK TO YOU"]; d.tone = "gold"; break;
      default: d.lines = ["TIME RUNS OUT", `${o} DRIVE ENDS`, sum];
    }
    if (r.result === "td" || r.result === "fg") for (const e of S.ents) e.arms = e.team === 1;
  }
  if (d.t < T + 1.9) return;
  if (r.result === "td" || r.result === "fg") return S.ot ? endGame() : checkClock(() => kickoff(0));
  if (r.result === "safety") return S.ot ? endGame() : checkClock(() => kickoff(0, true));
  if (r.result === "clock") { S.clock = 0; return checkClock(() => startDrive(20)); }
  checkClock(() => startDrive(r.myBall));
};

// ---------- end of game, season ----------
function endGame() {
  S.phase = "end"; whistle();
  const won = S.me > S.opp, tie = S.me === S.opp, se = season(), lines = [];
  ev(won ? "win" : tie ? "tie" : "loss");
  if (S.final) {
    if (won) { se.champ++; lines.push("You are the champions. A new season starts."); } else lines.push("So close. A new season starts.");
    Object.assign(se, { i: 0, w: 0, l: 0, t: 0 });
  } else {
    if (won) se.w++; else if (tie) se.t++; else se.l++;
    se.i++;
    if (se.i >= 8) {
      if (se.w >= 5) lines.push(`Record ${recText(se)}. You made the final against the ${fullName(OPPS[8])}.`);
      else { lines.push(`Season over at ${recText(se)}. Win 5 to reach the final.`); Object.assign(se, { i: 0, w: 0, l: 0, t: 0 }); }
    } else lines.push(`Record ${recText(se)}. Next: ${fullName(OPPS[se.i])}.`);
  }
  g.save("season", se);
  if (S.reads) lines.push(`Good reads: ${S.reads}`);
  g.addXp(S.me + (won ? 12 : tie ? 6 : 3) + S.reads * 2);
  const t = cap(S.team.name);
  g.over({ score: S.me, title: won ? `Archers win ${S.me} to ${S.opp}` : tie ? `Tie game, ${S.me} to ${S.opp}` : `${t} win ${S.opp} to ${S.me}`, won: won ? true : tie ? undefined : false, lines, again: coarse ? "Tap for the next game" : "Space for the next game" });
}

// ---------- the pre-snap read ----------
function makeProblem() {
  const lv = clamp(Math.floor(S.gi / 3) + D, 0, 3);
  const kind = choose(lv === 0 ? ["add", "sub", "left"] : lv === 1 ? ["add", "sub", "mul", "left", "pts"] : lv === 2 ? ["mul", "pts", "goal", "one", "sub"] : ["mul", "pts", "one", "two", "goal"]);
  let text, answer, ok;
  if (kind === "add") { const a = randInt(11, 48), b = randInt(4, 29); text = `${a} + ${b} = ?`; answer = a + b; ok = (v) => v - b === a; }
  else if (kind === "sub") { const a = randInt(30, 99), b = randInt(6, 28); text = `${a} - ${b} = ?`; answer = a - b; ok = (v) => v + b === a; }
  else if (kind === "left") { const need = randInt(4, 10), got = randInt(1, need - 1); text = `NEED ${need}, GAIN ${got}. LEFT?`; answer = need - got; ok = (v) => v + got === need; }
  else if (kind === "mul") { const a = randInt(3, 9), b = randInt(3, 9); text = `${a} * ${b} = ?`; answer = a * b; ok = (v) => v / a === b; }
  else if (kind === "pts") { const td = randInt(1, 4), fg = randInt(1, 3); text = `${td} TD (6) + ${fg} FG (3) = ?`; answer = td * 6 + fg * 3; ok = (v) => v - fg * 3 === td * 6; }
  else if (kind === "goal") { const a = randInt(12, 48); text = `OWN ${a}: YARDS TO SCORE?`; answer = 100 - a; ok = (v) => v + a === 100; }
  else if (kind === "one") { const x = randInt(3, 15), a = randInt(4, 20); text = `X + ${a} = ${x + a}. X = ?`; answer = x; ok = (v) => v + a === x + a; }
  else { const x = randInt(2, 9), m = randInt(2, 5), b = randInt(1, 9); text = `${m}X + ${b} = ${m * x + b}. X = ?`; answer = x; ok = (v) => m * v + b === m * x + b; }
  const set = new Set([answer]);
  while (set.size < 3) { const v = answer + choose([-10, -3, -2, -1, 1, 2, 3, 10]); if (v > 0) set.add(v); }
  const choices = [...set].sort(() => Math.random() - 0.5);
  return { kind, text, answer, choices, valid: ok(answer) && choices.filter(ok).length === 1 };
}

// ---------- juice ----------
function burst(x, z, n, cols) { if (S.auto) return; for (let i = 0; i < n; i++) S.fx.push({ x: (x + 10) * PX, y: wy(z) - 6, vx: rand(-40, 40), vy: rand(-70, -10), l: rand(0.4, 0.9), col: choose(cols) }); if (S.fx.length > 120) S.fx.splice(0, S.fx.length - 120); }
function ftext(s, x, z, col) { if (S.auto) return; S.ft.push({ s, x: (x + 10) * PX, y: wy(z) - 22, l: 1.1, col }); if (S.ft.length > 6) S.ft.shift(); }

// ---------- input ----------
function readInput() {
  const k = g.keys, p = g.pointer;
  I.ax = k.axis(["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"]); I.az = k.axis(["ArrowUp", "KeyW"], ["ArrowDown", "KeyS"]);
  I.go = k.pressed("Space", "Enter");
  I.opt = -1;
  for (let i = 0; i < 4; i++) if (k.pressed("Digit" + (i + 1), "Numpad" + (i + 1))) I.opt = i;
  I.ans = k.pressed("KeyQ") ? 0 : k.pressed("KeyW") ? 1 : k.pressed("KeyE") ? 2 : -1;
  I.px = p.x * W; I.py = p.y * H; I.pd = p.down; I.pp = p.pressed; I.pr = p.released;
  if (I.pp || Math.abs(I.px - lastPx) + Math.abs(I.py - lastPy) > 0.5) { S.usePtr = true; S.ptrT = g.time; }
  lastPx = I.px; lastPy = I.py;
  if (I.ax || I.az || I.opt >= 0 || I.go) S.usePtr = false;
  I.juke = I.go || (I.pp && !coarse);
  I.any = I.go || I.pp || I.opt >= 0 || k.pressed("ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown");
}
/** The computer plays the offense through the same inputs a person uses. For tests. */
function autoInput() {
  const A = S.auto, sk = A.skill ?? 0.8;
  Object.assign(I, { ax: 0, az: 0, go: false, juke: false, opt: -1, ans: -1, pp: false, pr: false, pd: false });
  S.usePtr = false;
  I.any = S.phase === "msg" ? S.msg.t > 0.6 : S.phase === "opp" ? S.od.t > 0.6 && (!S.od.shown || S.od.t > 2.6) : true;
  const ai = S.ai || (S.ai = { r: Math.random(), r2: Math.random(), r3: Math.random() });
  if (S.phase === "card") {
    if (S.prob && !S.read && S.ct > 0.5) { const right = S.prob.choices.indexOf(S.prob.answer); I.ans = ai.r < sk ? right : (right + 1) % 3; return; }
    if (S.ct < 1.4) return;
    const togo = S.line - S.ball, late = S.quarter >= 4 && S.me < S.opp && S.clock < 40;
    if (S.down === 4 && !S.try) {
      const fg = S.opts.findIndex((o) => o.k === "fg");
      if (late && S.opp - S.me > 3) I.opt = 0;
      else if (fg >= 0 && fgDist() <= 50) I.opt = fg;
      else if (togo <= 2 && S.ball >= 45) I.opt = togo <= 1 ? 1 : 0;
      else if (S.ball >= 62 || late) I.opt = 0;
      else I.opt = 2;
    } else I.opt = ai.r2 < (togo > 6 ? 0.7 : 0.5) ? 0 : 1;
  } else if (S.phase === "trycard") { if (S.ct > 0.5) I.opt = ai.r3 < (A.two ?? 0.25) ? 1 : 0; }
  else if (S.phase === "pass") {
    if (S.pt < 0.9) return;
    let best = null;
    for (const r of S.rec) if (r.open > 2.6 && (!best || r.x > best.x)) best = r;
    if (ai.r3 > sk && S.pt > 1.3) best = S.rec[Math.floor(ai.r * 3)];
    if (!best && S.pt > S.hold - 0.3) best = S.aim;
    if (best) I.opt = best.n - 1;
  } else if (S.phase === "run") {
    const c0 = S.car;
    let nd = null, nn = 7;
    for (const d of S.def) { if (d.down || d.x < c0.x - 1 || (S.design && S.rt < d.freeAt && d.blk)) continue; const q = Math.hypot(d.x - c0.x, d.z - c0.z); if (q < nn) { nn = q; nd = d; } }
    I.ax = 1;
    if (S.design && S.rt < 0.6) I.az = clamp((S.gapz - c0.z) / 1.5, -1, 1);
    else if (nd) I.az = c0.z >= nd.z ? 1 : -1;
    if (c0.z < 3) I.az = 1;
    if (c0.z > FW - 3) I.az = -1;
    if (nd && nn < 2.3 && S.jcd <= 0 && ai.r < sk + 0.1) I.juke = true;
  } else if (S.phase === "fg") {
    const f = S.fg;
    if (f.t > 0.3 && (Math.abs(f.pos - 0.5) < f.w * 0.35 || (ai.r > sk + 0.1 && f.t > 0.6))) I.go = true;
  }
}

// ---------- loop ----------
function update(dt) {
  if (!S || S.phase === "title" || S.phase === "end") return;
  readInput();
  if (S.auto) autoInput();
  S.t += dt;
  if (S.cheer > 0) S.cheer -= dt;
  const live = S.phase === "pass" || S.phase === "air" || S.phase === "run";
  if (!S.try && (live || (S.clockRun && (S.phase === "card" || (S.phase === "msg" && S.msg.run))))) {
    S.clock = Math.max(0, S.clock - dt);
    if (S.clock <= 0 && S.phase === "card") { S.clockRun = false; checkClock(card); return; }
  }
  PH[S.phase]?.(dt);
  if (S.phase === "end") return;
  let goal = S.cam;
  if (S.phase === "air") goal = (lerp(S.bl.x0, S.bl.x1, S.bl.t / S.bl.T) + 10) * PX - 130;
  else if (S.phase === "run" && S.car) goal = (S.car.x + 10) * PX - 110;
  else if (S.phase === "fly") goal = (S.fl.bx + 10) * PX - 160;
  else if (S.phase === "opp") goal = (S.od.mx + 10) * PX - 200;
  else if (S.phase === "card" || S.phase === "pass" || S.phase === "fg") goal = (S.los + 10) * PX - 100;
  S.cam = clamp(damp(S.cam, goal, 7, dt), 0, 400);
  for (const p of S.fx) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
  for (const p of S.ft) { p.l -= dt; p.y -= 9 * dt; }
  if (S.fx.length) S.fx = S.fx.filter((p) => p.l > 0);
  if (S.ft.length && S.ft[0].l <= 0) S.ft.shift();
}

// ---------- drawing ----------
const dotLine = (x0, y0, x1, y1, col) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
  L.fillStyle = col;
  for (let i = 0; i <= n; i++) L.fillRect(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), 1, 1);
};
function ring(x, y, col) {
  L.fillStyle = col;
  L.fillRect(x - 5, y - 4, 10, 1); L.fillRect(x - 5, y + 1, 10, 1); L.fillRect(x - 7, y - 3, 2, 1); L.fillRect(x + 5, y - 3, 2, 1);
  L.fillRect(x - 7, y, 2, 1); L.fillRect(x + 5, y, 2, 1); L.fillRect(x - 8, y - 2, 1, 2); L.fillRect(x + 7, y - 2, 1, 2);
}
function banner(lines, tn) {
  const w = Math.max(...lines.map((l, i) => tw(l, i ? 1 : 2))) + 16, h = 18 + (lines.length - 1) * 9, x = Math.round((W - w) / 2), y = 70 - Math.round(h / 2);
  box(x, y, w, h, "#0f172a", tn === "gold" ? "#fde047" : tn === "bad" ? "#f87171" : "#e2e8f0");
  lines.forEach((l, i) => (i ? txt(l, W / 2, y + 17 + (i - 1) * 9, "#e2e8f0", 1, 1) : txs(l, W / 2, y + 4, tn === "gold" ? "#fde047" : tn === "bad" ? "#fca5a5" : "#fff", 2, 1, "#000")));
}
function hud() {
  L.fillStyle = "#0b1220"; L.fillRect(0, 0, W, 13);
  L.fillStyle = "#334155"; L.fillRect(0, 13, W, 1);
  L.fillStyle = S.meC.a; L.fillRect(3, 2, 3, 9); txt(ME.abbr, 9, 3, "#e2e8f0"); txt(S.me, 23, 2, "#fff", 2);
  L.fillStyle = S.opC.a; L.fillRect(50, 2, 3, 9); txt(S.team.name.slice(0, 3), 56, 3, "#e2e8f0"); txt(S.opp, 70, 2, "#fff", 2);
  L.fillStyle = "#fde047"; L.fillRect(S.poss ? 56 : 9, 9, 11, 1);
  txt(S.quarter > 4 ? "OT" : "Q" + S.quarter, 100, 4, "#fde047");
  const cl = Math.ceil(S.clock);
  txt(Math.floor(cl / 60) + ":" + String(cl % 60).padStart(2, "0"), 111, 2, "#fff", 2);
  if (S.phase === "card") { txt("PLAY", 150, 4, "#94a3b8"); txt(Math.ceil(S.pc), 168, 2, S.pc < 5 ? "#f87171" : "#fff", 2); }
}
function panel() {
  L.fillStyle = "#0f172a"; L.fillRect(0, 142, W, 38);
  L.fillStyle = "#334155"; L.fillRect(0, 142, W, 1);
  const ph = S.phase, mine = S.poss === 0, blink = Math.floor(S.t * 3) & 1;
  const info = ph === "trycard" ? "TOUCHDOWN! PICK YOUR TRY" : S.try ? "2 POINT TRY FROM THE 2 YARD LINE" : ph === "fg" ? `${S.fg.dist} YARD ${S.fg.kind === "xp" ? "EXTRA POINT" : "FIELD GOAL"}` : ph === "fly" ? S.fl.label || "" : mine ? `${ORD[S.down]} AND ${togoText()} AT THE ${spotName(S.ball)}` : `${S.team.name} HAVE THE BALL`;
  txt(info, 6, 145, "#fde047");
  if (ph === "card" || ph === "trycard") {
    if (ph === "card" && !S.try) {
      const n = S.line - S.ball;
      txt(S.down === 4 ? (fgDist() <= 55 ? `FIELD GOAL IS ${fgDist()} YARDS` : "TOO FAR FOR A FIELD GOAL") : S.note || (S.line >= 100 ? `NEED ${n} TO SCORE` : `NEED ${n} FOR A FIRST DOWN`), W - 6, 145, "#94a3b8", 1, 2);
    }
    optRects().forEach((r, i) => {
      const o = S.opts[i];
      box(r.x, r.y, r.w, r.h, o.col, "#e2e8f0");
      txt(i + 1, r.x + 4, r.y + 4, "#fde047");
      txs(o.label, r.x + r.w / 2 + 3, r.y + 2, "#fff", 2, 1, "rgba(0,0,0,.45)");
    });
    if (ph === "trycard") txt("KICK IS WORTH 1. A PLAY FROM THE 2 IS WORTH 2", W / 2, 170, "#94a3b8", 1, 1);
    else if (S.tut) { if (blink) txt(coarse ? "TAP PASS OR RUN" : "PRESS 1 TO PASS OR 2 TO RUN", W / 2, 170, "#fde047", 1, 1); }
    else if (S.prob && !S.read) {
      txt("READ:", 6, 170, "#94a3b8"); txt(S.prob.text, 30, 170, "#fff");
      ansRects().forEach((r, i) => { box(r.x, r.y, r.w, r.h, "#1e293b", "#64748b"); txt("QWE"[i], r.x + 3, r.y + 3, "#fde047"); txt(S.prob.choices[i], r.x + 22, r.y + 3, "#fff", 1, 1); });
    } else if (S.read > 0) txt("GOOD READ! STAR IS OPEN. YOUR LINE HOLDS LONGER", W / 2, 170, "#86efac", 1, 1);
    else if (S.read < 0) txt(`NO READ THIS PLAY. IT WAS ${S.prob.answer}`, W / 2, 170, "#94a3b8", 1, 1);
    else if (S.down === 4 && !S.try) txt("4TH DOWN: GO FOR IT, PUNT IT AWAY OR KICK", W / 2, 170, "#94a3b8", 1, 1);
  } else if (ph === "pass") {
    if (S.tut) { if (blink) txs(coarse ? "TAP A RECEIVER TO THROW" : "CLICK A RECEIVER TO THROW", W / 2, 155, "#fde047", 2, 1); }
    else txt(coarse ? "TAP A RECEIVER TO THROW. GREEN RING IS OPEN" : "CLICK A RECEIVER OR PRESS 1 2 3 TO THROW. GREEN RING IS OPEN", W / 2, 158, "#cbd5e1", 1, 1);
    const left = clamp(1 - S.pt / (S.hold + 0.8), 0, 1);
    txt("POCKET", 6, 171, "#94a3b8"); box(34, 170, 82, 7, "#1e293b", "#64748b");
    L.fillStyle = left < 0.3 ? "#f87171" : "#4ade80"; L.fillRect(35, 171, Math.round(80 * left), 5);
  } else if (ph === "run") {
    if (S.tut) { if (blink) txs(coarse ? "HOLD TO STEER" : "ARROWS: RUN", W / 2, 155, "#fde047", 2, 1); }
    else txt(coarse ? "HOLD TO STEER. JUKE BUTTON DODGES A TACKLE" : "ARROWS OR MOUSE: STEER.  SPACE: JUKE", W / 2, 158, "#cbd5e1", 1, 1);
    txt("JUKE", 6, 171, "#94a3b8"); box(26, 170, 42, 7, "#1e293b", "#64748b");
    L.fillStyle = S.jcd <= 0 ? "#fde047" : "#64748b"; L.fillRect(27, 171, Math.round(40 * clamp(1 - S.jcd / 1.8, 0, 1)), 5);
  } else if (ph === "fg") {
    const f = S.fg, x0 = 60, w = 200;
    box(x0 - 1, 154, w + 2, 9, "#1e293b", "#e2e8f0");
    L.fillStyle = "#16a34a"; L.fillRect(Math.round(x0 + w * (0.5 - f.w / 2)), 155, Math.round(w * f.w), 7);
    L.fillStyle = "#fde047"; L.fillRect(Math.round(x0 + w * f.pos) - 1, 152, 3, 13);
    txt(coarse ? "TAP WHEN THE MARKER IS IN THE GREEN" : "PRESS SPACE WHEN THE MARKER IS IN THE GREEN", W / 2, 170, "#fde047", 1, 1);
  } else if (ph === "opp" || ph === "fly" || ph === "msg") {
    if (ph === "opp") txt((S.od.intro || "DRIVE") + ". YOUR DEFENSE IS ON THE FIELD", 6, 158, "#94a3b8");
    txt(coarse ? "TAP TO SKIP AHEAD" : "SPACE: SKIP AHEAD", W - 6, 171, "#475569", 1, 2);
  }
}
function render() {
  if (!S) return;
  if (S.poster) { poster(); return blit(); }
  const cam = Math.round(S.cam), X = (x) => Math.round((x + 10) * PX - cam), ph = S.phase;
  drawStadium(cam, S.st, S.crowd, S.cheer > 0 && Math.floor(S.t * 8) & 1);
  drawField(cam, S.st, S.meC, S.opC);
  drawPosts(cam, 110); drawPosts(cam, -10);
  if (S.marks && S.poss === 0) {
    L.fillStyle = "#60a5fa"; L.fillRect(X(S.los), FY0, 1, FY1 - FY0);
    if (S.mark < 100 && !S.try) {
      L.fillStyle = "#fde047"; L.fillRect(X(S.mark), FY0, 1, FY1 - FY0);
      box(X(S.mark) - 6, FY0 - 9, 13, 8, "#f97316", "#7c2d12"); txt("1ST", X(S.mark) - 5, FY0 - 7, "#fff");
    }
  }
  if (ph === "card" || ph === "title") {
    for (const r of S.rec) {
      let px = X(r.x), py = wy(r.z) - 2;
      const col = S.read > 0 && r === S.star ? "#fde047" : "rgba(255,255,255,.8)";
      for (const w of r.route) { const nx = X(w.x), ny = wy(w.z) - 2; dotLine(px, py, nx, ny, col); px = nx; py = ny; }
      L.fillStyle = col; L.fillRect(px - 1, py - 1, 3, 3);
    }
    dotLine(X(S.rb.x), wy(S.rb.z) - 2, X(S.los + 3), wy(S.gapz) - 2, "#fdba74");
    L.fillStyle = "#fdba74"; L.fillRect(X(S.los + 3) - 1, wy(S.gapz) - 3, 3, 3);
  }
  const ctl = ph === "pass" || ph === "run" ? S.car : null;
  for (const e of S.ents.slice().sort((a, b) => a.z - b.z)) {
    const x = X(e.x), y = wy(e.z);
    if (x < -12 || x > W + 12) continue;
    if (ph === "pass" && e.n) ring(x, y, e.open > 2.4 ? "#4ade80" : "#f87171");
    if (e === ctl) ring(x, y, "#fde047");
    spr(x, y, e.team ? S.opC : S.meC, e.face, e.moving ? Math.floor(e.anim) & 3 : -1, { down: e.down, ball: e.ball || (e === S.car && ph !== "air" && ph !== "card"), arms: e.arms });
  }
  if (ph === "card" || ph === "pass" || ph === "title") for (const r of S.rec) {
    const x = X(r.x), y = wy(r.z) - 27, on = r === S.aim && ph === "pass";
    box(x - 3, y, 7, 9, on ? "#fde047" : "#0f172a", "#e2e8f0"); txt(r.n, x - 1, y + 2, on ? "#0f172a" : "#fff");
    if (S.read > 0 && r === S.star) { L.fillStyle = "#fde047"; L.fillRect(x - 1, y - 6, 3, 5); L.fillRect(x - 3, y - 4, 7, 1); L.fillRect(x - 2, y - 2, 1, 2); L.fillRect(x + 2, y - 2, 1, 2); }
  }
  if (ctl) { const x = X(ctl.x), y = wy(ctl.z) - 21 - (Math.floor(S.t * 6) & 1); L.fillStyle = "#fde047"; L.fillRect(x - 2, y, 5, 1); L.fillRect(x - 1, y + 1, 3, 1); L.fillRect(x, y + 2, 1, 1); }
  if (ph === "pass" && S.aim) {
    const q = S.qb, tg = lead(S.aim), x0 = X(q.x) + 3, y0 = wy(q.z) - 10, x1 = X(tg.x), y1 = wy(tg.z) - 8, h = 4 + Math.hypot(tg.x - q.x, tg.z - q.z) * 0.55;
    const n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4)), o = Math.floor(S.t * 12);
    L.fillStyle = "#fff";
    for (let i = 1; i < n; i++) if ((i + o) % 3) L.fillRect(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n) - Math.sin((i / n) * Math.PI) * h), 1, 1);
    ring(x1, wy(tg.z), "#fff");
  }
  if (ph === "card") ballSpr(X(S.los), wy(S.bz));
  if (S.bl) { const b = S.bl, p = clamp(b.t / b.T, 0, 1), x = X(lerp(b.x0, b.x1, p)), y = wy(lerp(b.z0, b.z1, p)); L.fillStyle = "rgba(0,0,0,.35)"; L.fillRect(x - 1, y - 1, 3, 1); ballSpr(x, Math.round(y - 9 - Math.sin(p * Math.PI) * b.h)); }
  if (S.loose && ph === "msg") ballSpr(X(S.loose.x), wy(S.loose.z));
  if (ph === "fly") {
    const f = S.fl, p = clamp(f.t / f.T, 0, 1), x = X(f.bx), y = wy(lerp(f.z0, f.z1, p));
    L.fillStyle = "rgba(0,0,0,.35)"; L.fillRect(x - 1, y - 1, 3, 1);
    ballSpr(x, Math.round(y - 6 - Math.sin(p * Math.PI) * f.h));
    if (f.top) { const w = Math.max(...f.top.map((l) => tw(l))) + 12; box(Math.round((W - w) / 2), 50, w, 5 + f.top.length * 8, "#0f172a", "#fde047"); f.top.forEach((l, i) => txt(l, W / 2, 54 + i * 8, i ? "#fff" : "#fde047", 1, 1)); }
  }
  for (const p of S.fx) { L.fillStyle = p.col; L.fillRect(Math.round(p.x - cam), Math.round(p.y), 2, 2); }
  for (const p of S.ft) txs(p.s, p.x - cam, p.y, p.col, 1, 1);
  if (ph !== "title" && !S.clean) { hud(); panel(); }
  else { L.fillStyle = S.st.side; L.fillRect(0, 142, W, 38); for (let i = 0; i < 9; i++) spr(24 + i * 34, 172 - (i & 1) * 6, S.meC, i < 5 ? 1 : -1, -1, {}); }
  if (S.msg) banner(S.msg.lines, S.msg.tone);
  else if (ph === "opp" && S.od.lines) banner(S.od.lines, S.od.tone);
  blit();
}
function blit() {
  const k = c.ctx;
  k.imageSmoothingEnabled = false;
  k.fillStyle = "#0b1220"; k.fillRect(0, 0, 960, 540);
  k.drawImage(lo, 0, 0, W, H, Math.round((g.shakeX || 0) / 3) * 3, Math.round((g.shakeY || 0) / 3) * 3, 960, 540);
}
/** One composed hero shot for the tile art: no HUD, no text, calm top third. */
function poster() {
  const st = S.st, big = (x, y, k, col, f, fr, o) => { L.save(); L.translate(x, y); L.scale(k, k); spr(0, 0, col, f, fr, o); L.restore(); };
  L.fillStyle = "#7dd3fc"; L.fillRect(0, 0, W, 64);
  L.fillStyle = "#bae6fd"; L.fillRect(0, 44, W, 20);
  L.fillStyle = "#e0f2fe"; L.fillRect(0, 56, W, 8);
  for (let x = -40; x < W; x += 240) L.drawImage(S.crowd, x, 60);
  L.fillStyle = st.wall; L.fillRect(0, 84, W, 8);
  L.fillStyle = "rgba(255,255,255,.2)"; L.fillRect(0, 84, W, 1);
  for (let i = 0; i < 8; i++) { L.fillStyle = i & 1 ? st.f1 : st.f2; L.fillRect(i * 48 - 20, 92, 48, 88); }
  L.fillStyle = st.line; L.fillRect(0, 92, W, 2);
  for (let i = 0; i < 8; i++) { L.globalAlpha = 0.8; L.fillRect(i * 48 - 20, 92, 2, 88); L.globalAlpha = 1; for (let j = 1; j < 5; j++) { L.fillRect(i * 48 - 20 + j * 10, 122, 1, 2); L.fillRect(i * 48 - 20 + j * 10, 150, 1, 2); } }
  L.fillStyle = "#fde047"; L.fillRect(222, 92, 2, 88);
  big(206, 118, 2, S.opC, -1, 2, {}); big(246, 136, 2, S.meC, 1, 1, {});
  big(238, 170, 3, S.opC, -1, 0, {});
  big(92, 172, 3, S.opC, 1, 0, { down: true });
  big(146, 166, 4, S.meC, 1, 0, { ball: true });
  for (let i = 0; i < 5; i++) { L.fillStyle = "rgba(255,255,255,.7)"; L.fillRect(104 - i * 9, 150 - (i & 1) * 4, 5 - (i >> 1), 2); }
}

const KIT_UI = ".ak-hud,.ak-overlay,.ak-toasts,.ak-touch";
const kitUi = (show) => g.stage.querySelectorAll(KIT_UI).forEach((e) => (e.style.visibility = show ? "" : "hidden"));
g.onStart = () => { const clean = S && S.clean; if (S && S.poster) kitUi(true); newGame(); S.clean = clean; opening(); };
newGame();
g.loop(update, render);

// ---------- test hooks ----------
g.debug = {
  get S() { return S; },
  total: TOTAL,
  /** Let the computer play the offense through the real inputs. auto(false) hands control back. */
  auto(on = true, o = {}) { S.auto = on ? { skill: 0.8, ...o } : null; return !!S.auto; },
  /** Force the next result: { pass: "int" | "catch" | "inc", fumble: true, fg: true | false, toss: true | false, opp: "td" | "punt" | "safety" | ... } */
  force(o) { Object.assign(S.force, o); return S.force; },
  /** Jump to a situation: set({ ball: 62, down: 4, togo: 3, quarter: 4, clock: 5, me: 14, opp: 14 }) */
  set(o = {}) {
    for (const k of ["quarter", "clock", "me", "opp", "ball", "down"]) if (o[k] != null) S[k] = o[k];
    S.poss = 0; S.try = false; S.msg = null; S.line = Math.min(100, S.ball + (o.togo ?? 10)); S.ot = S.quarter > 4;
    if (o.tut != null) S.tut = o.tut;
    card();
    if (o.plays != null) S.plays = o.plays;
    return g.debug.where();
  },
  where() { return { phase: S.phase, q: S.quarter, clock: +S.clock.toFixed(1), me: S.me, opp: S.opp, ball: S.ball, down: S.down, togo: S.line - S.ball, poss: S.poss, try: S.try, state: g.state }; },
  /** Play n whole games with the autoplayer and report the scores and what happened. */
  games(n = 1, o = {}) {
    const out = [];
    for (let i = 0; i < n; i++) { g.start(); S.auto = { skill: 0.8, ...o }; g.advance(4000); out.push({ me: S.me, opp: S.opp, q: S.quarter, state: g.state, vs: S.team.name, log: { ...S.log } }); }
    return out;
  },
  mathCheck(n = 500) { let bad = 0; const was = S.gi; for (let i = 0; i < n; i++) { S.gi = i % 9; if (!makeProblem().valid) bad++; } S.gi = was; return bad; },
  poster() { S.poster = true; kitUi(false); g.redraw(); },
  /** Hide every HUD (ours and the kit's) for a clean screenshot of live play. */
  clean(on = true) { S.clean = on; kitUi(!on); g.redraw(); },
};
