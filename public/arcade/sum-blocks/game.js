// Sum Blocks: drag pieces onto an 8 by 8 felt board, clear full rows and columns.
// Every tile has a digit. A cleared line whose digits satisfy the magic rule (line sum = 5n, sum = 3n + 1, ...) pays triple.
import { createGame, sfx, drawArchie, math, PAL, FONT, clamp, lerp, damp, ease, rand } from "../kit/kit.js";
import * as L from "./logic.js";

const NAVY = "#1e3a8a";
const INK = "#0f172a";
const GOLD = "#fbbf24";
const CREAM = "#fef7e6";
const TILE = ["#ef4444", "#fb923c", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#84cc16", "#38bdf8", "#94a3b8"];
const GRAY = 10;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`; };

// ---------- shell ----------
const pickDim = () => {
  const iw = innerWidth || 960, ih = innerHeight || 540;
  return ih / iw > 1.15 ? { p: true, W: 540, H: clamp(Math.round((540 * ih) / iw / 10) * 10, 880, 1060) } : { p: false, W: 960, H: 540 };
};
let dim = pickDim();
let G = null; // set once createGame returns (the kit calls onMenu before that)
const sel = { mode: "endless", level: null };

const g = createGame({
  slug: "sum-blocks",
  title: "Sum Blocks",
  tagline: "Fit the blocks. Clear the lines. Solve the magic rule.",
  how: ["Drag a piece onto the board. Full rows and columns clear.", "A line whose sum fits the magic rule pays triple."],
  controls: [{ keys: "Drag", does: "Place a piece" }, { keys: "1 2 3, arrows, Space", does: "Keyboard" }],
  instant: true,
  aspect: dim.W / dim.H,
  bg: "#3a2110",
  onMenu: (el) => { if (G) buildMenu(el); },
});
G = g;
const c = g.canvas2d(dim.W, dim.H);
const { ctx } = c;
let pointerType = "mouse";
c.canvas.addEventListener("pointerdown", (e) => { pointerType = e.pointerType || "mouse"; });

// ---------- layout (landscape 960 x 540, portrait 540 x 880 to 1060). The tray sits under the board in both. ----------
let LAY = null;
function makeLayout() {
  const { W, H, p } = dim;
  if (!p) {
    // keep the streak pill clear of the shell's round buttons, which stop shrinking on small screens
    const sw = g.stage.getBoundingClientRect().width || W;
    const ty = Math.round(clamp(((0.014 * sw + clamp(0.04 * sw, 30, 42)) / sw) * W + 8, 62, 100));
    return {
      W, H, p, cell: 42, bx: 312, by: 22, frame: 12,
      tray: { x: 215, y: 382, w: 530, h: 150, vert: false, max: 34 },
      score: { x: 24, y: 12, w: 170, h: 80, rot: -0.03 },
      badge: { x: 14, y: 106, w: 272, h: 150 },
      info: { x: 14, y: 270, w: 272, h: 72 },
      streak: { x: 700, y: ty, w: 180, h: 42 },
      archie: { x: 818, y: 262, size: 150, ground: true },
      keys: { x: 110, y: 462 },
    };
  }
  const by = 232, ty = by + 480 + 24;
  const th = clamp(H - ty - 8, 128, 216);
  return {
    W, H, p, cell: 60, bx: 30, by, frame: 14,
    tray: { x: 16, y: ty + (H - ty - th) / 2 - 2, w: 508, h: th, vert: false, max: 42 },
    score: { x: 14, y: 10, w: 132, h: 80, rot: -0.03 },
    badge: { x: 14, y: 102, w: 404, h: 112 },
    info: { x: 160, y: 58, w: 366, h: 38 },
    streak: { x: 160, y: 12, w: 122, h: 38 },
    archie: { x: 478, y: 160, size: 104, ground: false },
    keys: null,
  };
}
LAY = makeLayout();
let staticCv = null, staticKey = "";
const sprites = new Map();
function refit() {
  const d = pickDim();
  if (d.W !== dim.W || d.H !== dim.H) {
    dim = d;
    g.stage.style.setProperty("--ak-aspect", String(d.W / d.H));
    c.w = d.W; c.h = d.H;
    if (S) S.drag = null;
  }
  LAY = makeLayout();
  const r = g.stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.max(1, Math.round((r.width || dim.W) * dpr)), py = Math.max(1, Math.round((px * dim.H) / dim.W));
  if (c.canvas.width !== px || c.canvas.height !== py) { c.canvas.width = px; c.canvas.height = py; }
  c.scale = px / dim.W;
  ctx.setTransform(c.scale, 0, 0, c.scale, 0, 0);
  g.stage.classList.toggle("sb-portrait", dim.p);
}
g.onResize = refit;
addEventListener("resize", () => { refit(); g.redraw(); });

// ---------- drawing helpers ----------
function rr(x, a, b, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}
function text(x, str, px, py, size, color, o = {}) {
  x.font = `${o.italic ? "italic " : ""}${o.weight || 900} ${size}px ${FONT}`;
  x.textAlign = o.align || "center";
  x.textBaseline = o.base || "middle";
  if (o.stroke) { x.lineJoin = "round"; x.lineWidth = o.sw || size * 0.24; x.strokeStyle = o.stroke; x.strokeText(str, px, py); }
  x.fillStyle = color;
  x.fillText(str, px, py);
}
function wrap(x, str, maxW) {
  const words = str.split(" "), out = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function tileSprite(ci, d) {
  const px = Math.max(8, Math.round(LAY.cell * c.scale));
  const key = ci + "," + d + ":" + px;
  let cv = sprites.get(key);
  if (cv) return cv;
  if (sprites.size > 400) sprites.clear();
  cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const x = cv.getContext("2d"), u = px / 60, base = TILE[ci];
  rr(x, 1 * u, 1 * u, px - 2 * u, px - 2 * u, 12 * u); x.fillStyle = NAVY; x.fill();
  rr(x, 5 * u, 5 * u, px - 10 * u, px - 10 * u, 8 * u); x.fillStyle = mix(base, "#0b1437", 0.42); x.fill();
  const face = px - 10 * u - 5 * u;
  const gr = x.createLinearGradient(0, 5 * u, 0, 5 * u + face);
  gr.addColorStop(0, mix(base, "#ffffff", 0.3)); gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, "#0b1437", 0.1));
  rr(x, 5 * u, 5 * u, px - 10 * u, face, 8 * u); x.fillStyle = gr; x.fill();
  rr(x, 8.5 * u, 8.5 * u, px - 17 * u, face - 7 * u, 5.5 * u); x.strokeStyle = "rgba(255,255,255,0.34)"; x.lineWidth = 2.2 * u; x.stroke();
  rr(x, 11 * u, 10.5 * u, px - 22 * u, 8 * u, 4 * u); x.fillStyle = "rgba(255,255,255,0.25)"; x.fill();
  if (d === L.XT) {
    // a wildcard: the game solves for it when its line clears
    x.setLineDash([4 * u, 3.4 * u]); rr(x, 9.5 * u, 9.5 * u, px - 19 * u, face - 9 * u, 5 * u); x.strokeStyle = "#fde047"; x.lineWidth = 2.4 * u; x.stroke(); x.setLineDash([]);
    text(x, "x", px / 2, 5 * u + face / 2 - 0.5 * u, 30 * u, "#fde047", { stroke: mix(base, "#0b1437", 0.72), sw: 6 * u, italic: true });
  } else if (d) text(x, String(d), px / 2, 5 * u + face / 2 + 1.5 * u, 25 * u, "#ffffff", { stroke: mix(base, "#0b1437", 0.62), sw: 6 * u });
  sprites.set(key, cv);
  return cv;
}
function drawTile(ci, d, x, y, size, alpha = 1) {
  if (alpha <= 0) return;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(tileSprite(ci, d), x, y, size, size);
  if (alpha < 1) ctx.globalAlpha = 1;
}
function drawPiece(p, x, y, cs, alpha = 1) {
  for (let k = 0; k < p.shape.cells.length; k++) drawTile(p.color, p.digits[k], x + p.shape.cells[k][0] * cs, y + p.shape.cells[k][1] * cs, cs, alpha);
}

// ---------- the static layer: desk, tray, board ----------
/** A deep walnut desk, so the felt and the tiles are the brightest things on screen. */
function paintDesk(x, W, H, r, planks) {
  let gr = x.createLinearGradient(0, 0, W * 0.3, H);
  gr.addColorStop(0, "#5e3a20"); gr.addColorStop(0.5, "#4c2c17"); gr.addColorStop(1, "#3b2110");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  const plank = H / planks;
  for (let i = 0; i * plank < H; i++) {
    const y0 = i * plank;
    x.fillStyle = `rgba(${r() < 0.5 ? "255,200,140" : "20,8,0"},${0.02 + r() * 0.06})`;
    x.fillRect(0, y0, W, plank);
    x.lineCap = "round";
    for (let k = 0; k < 9; k++) {
      const yy = y0 + 6 + r() * (plank - 12), amp = 2 + r() * 5, x0 = -20 + r() * 80;
      x.beginPath(); x.moveTo(x0, yy);
      for (let xx = x0; xx < W + 60; xx += 120) x.bezierCurveTo(xx + 40, yy - amp, xx + 80, yy + amp, xx + 120, yy + (r() - 0.5) * 3);
      x.strokeStyle = `rgba(24,10,2,${0.1 + r() * 0.14})`; x.lineWidth = 0.8 + r() * 1.6; x.stroke();
    }
    const kx = r() * W, ky = y0 + plank * (0.3 + r() * 0.4);
    for (let q = 3; q > 0; q--) { x.beginPath(); x.ellipse(kx, ky, q * 7, q * 3.2, 0, 0, 7); x.strokeStyle = "rgba(24,10,2,0.2)"; x.lineWidth = 1.4; x.stroke(); }
    x.fillStyle = "rgba(18,7,1,0.6)"; x.fillRect(0, y0 - 1.2, W, 2.4);
    x.fillStyle = "rgba(255,206,150,0.1)"; x.fillRect(0, y0 + 1.2, W, 1.2);
  }
  gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  gr.addColorStop(0, "rgba(12,4,0,0)"); gr.addColorStop(1, "rgba(12,4,0,0.5)");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
}
/** Wooden frame, navy felt, soft cell wells. */
function paintBoard(x, bx, by, cell, frame, r) {
  const fx = bx - frame, fy = by - frame, fs = cell * 8 + frame * 2, k60 = cell / 60;
  let gr;
  for (let k = 5; k > 0; k--) { rr(x, fx - k + 2, fy - k + 9, fs + k * 2 - 4, fs + k * 2 - 4, 26 + k); x.fillStyle = "rgba(8,3,0,0.11)"; x.fill(); }
  rr(x, fx, fy, fs, fs, 24 * k60 + 4);
  gr = x.createLinearGradient(0, fy, 0, fy + fs); gr.addColorStop(0, "#a8703a"); gr.addColorStop(1, "#7a4a22");
  x.fillStyle = gr; x.fill(); x.strokeStyle = "#1f0f04"; x.lineWidth = 3; x.stroke();
  rr(x, fx + 3.5, fy + 3.5, fs - 7, fs - 7, 21 * k60 + 3); x.strokeStyle = "rgba(255,224,170,0.4)"; x.lineWidth = 2; x.stroke();
  const pin = frame + 1;
  for (const [ax, ay] of [[fx + pin, fy + pin], [fx + fs - pin, fy + pin], [fx + pin, fy + fs - pin], [fx + fs - pin, fy + fs - pin]]) {
    x.beginPath(); x.arc(ax, ay, 3.2, 0, 7); x.fillStyle = "#f1c56b"; x.fill(); x.strokeStyle = "#3a1d08"; x.lineWidth = 1.5; x.stroke();
  }
  rr(x, bx - 5, by - 5, cell * 8 + 10, cell * 8 + 10, 14 * k60 + 2);
  gr = x.createLinearGradient(0, by, 0, by + cell * 8); gr.addColorStop(0, "#2040a0"); gr.addColorStop(1, "#172a6e");
  x.fillStyle = gr; x.fill(); x.strokeStyle = "#0b1437"; x.lineWidth = 3; x.stroke();
  x.save(); rr(x, bx - 5, by - 5, cell * 8 + 10, cell * 8 + 10, 14 * k60 + 2); x.clip();
  for (let k = 0; k < 2600; k++) { x.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(4,8,30,0.09)"; x.fillRect(bx - 5 + r() * (cell * 8 + 10), by - 5 + r() * (cell * 8 + 10), 1 + r() * 1.6, 1 + r() * 1.6); }
  gr = x.createLinearGradient(0, by - 5, 0, by + 16); gr.addColorStop(0, "rgba(4,8,30,0.5)"); gr.addColorStop(1, "rgba(4,8,30,0)");
  x.fillStyle = gr; x.fillRect(bx - 5, by - 5, cell * 8 + 10, 21);
  x.restore();
  for (let rw = 0; rw < 8; rw++) for (let cl = 0; cl < 8; cl++) {
    const a = bx + cl * cell, b = by + rw * cell, m = 3 * k60;
    rr(x, a + m, b + m, cell - m * 2, cell - m * 2, 10 * k60); x.fillStyle = "rgba(6,12,44,0.42)"; x.fill();
    rr(x, a + m, b + m * 1.5, cell - m * 2, cell - m * 2, 10 * k60); x.strokeStyle = "rgba(140,170,255,0.1)"; x.lineWidth = 1.5; x.stroke();
  }
}
function buildStatic() {
  const key = `${c.canvas.width}x${c.canvas.height}:${dim.W}x${dim.H}:${g.coarse}`;
  if (key === staticKey) return;
  staticKey = key;
  staticCv = staticCv || document.createElement("canvas");
  staticCv.width = c.canvas.width; staticCv.height = c.canvas.height;
  const x = staticCv.getContext("2d");
  x.setTransform(c.scale, 0, 0, c.scale, 0, 0);
  const { W, H, cell, bx, by, frame, tray } = LAY;
  const r = math.rng(77);
  paintDesk(x, W, H, r, dim.p ? 7 : 5);

  // tray: a shallow recess cut into the desk, right under the board
  let gr;
  rr(x, tray.x - 3, tray.y - 3, tray.w + 6, tray.h + 6, 22); x.fillStyle = "rgba(255,214,160,0.22)"; x.fill();
  rr(x, tray.x, tray.y, tray.w, tray.h, 20); x.fillStyle = "#26140a"; x.fill();
  x.save(); rr(x, tray.x, tray.y, tray.w, tray.h, 20); x.clip();
  gr = x.createLinearGradient(0, tray.y, 0, tray.y + 26); gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(tray.x, tray.y, tray.w, 26);
  gr = x.createLinearGradient(tray.x, 0, tray.x + 18, 0); gr.addColorStop(0, "rgba(0,0,0,0.4)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(tray.x, tray.y, 18, tray.h);
  for (let k = 0; k < 26; k++) { const yy = tray.y + r() * tray.h; x.fillStyle = `rgba(255,210,160,${0.015 + r() * 0.035})`; x.fillRect(tray.x, yy, tray.w, 1 + r() * 2); }
  x.restore();
  rr(x, tray.x, tray.y, tray.w, tray.h, 20); x.strokeStyle = "rgba(10,4,0,0.9)"; x.lineWidth = 3; x.stroke();
  for (let i = 1; i < 3; i++) {
    x.fillStyle = "rgba(255,214,160,0.1)";
    if (tray.vert) x.fillRect(tray.x + 18, tray.y + (tray.h * i) / 3 - 1, tray.w - 36, 2);
    else x.fillRect(tray.x + (tray.w * i) / 3 - 1, tray.y + 18, 2, tray.h - 36);
  }
  if (!g.coarse) {
    for (let i = 0; i < 3; i++) {
      const s = slotRect(i);
      x.beginPath(); x.arc(s.x + 20, s.y + 20, 11, 0, 7); x.fillStyle = "#e9b65c"; x.fill(); x.strokeStyle = "#1f0f04"; x.lineWidth = 2.4; x.stroke();
      text(x, String(i + 1), s.x + 20, s.y + 21, 14, "#4a2610");
    }
    if (LAY.keys) {
      text(x, "Drag a piece up", LAY.keys.x, LAY.keys.y - 22, 14, "rgba(255,226,190,0.78)", { weight: 800 });
      text(x, "or press 1 2 3, then", LAY.keys.x, LAY.keys.y, 12.5, "rgba(255,226,190,0.55)", { weight: 700 });
      text(x, "arrows and Space", LAY.keys.x, LAY.keys.y + 17, 12.5, "rgba(255,226,190,0.55)", { weight: 700 });
    }
  }
  paintBoard(x, bx, by, cell, frame, r);
}
function slotRect(i) {
  const t = LAY.tray;
  return t.vert ? { x: t.x, y: t.y + (t.h * i) / 3, w: t.w, h: t.h / 3 } : { x: t.x + (t.w * i) / 3, y: t.y, w: t.w / 3, h: t.h };
}
function trayCell(p, i) {
  const s = slotRect(i);
  return Math.min(LAY.tray.max, (s.w - 30) / p.shape.w, (s.h - 24) / p.shape.h);
}
function trayPos(p, i) {
  const s = slotRect(i), cs = trayCell(p, i);
  return { x: s.x + s.w / 2 - (p.shape.w * cs) / 2, y: s.y + s.h / 2 - (p.shape.h * cs) / 2 + (LAY.tray.vert || g.coarse ? 0 : 4), cs };
}

// ---------- particles (pooled) ----------
const PARTS = Array.from({ length: 360 }, () => ({ live: false }));
let partAt = 0;
function spark(x, y, color, kind = 0, power = 1) {
  const p = PARTS[partAt = (partAt + 1) % PARTS.length];
  const a = rand(0, Math.PI * 2), v = rand(60, 260) * power;
  p.live = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 120 * power;
  p.rot = rand(0, 6); p.vr = rand(-9, 9); p.t = 0; p.max = rand(0.45, 0.85) * (kind ? 1.25 : 1); p.size = rand(5, 11) * (kind === 2 ? 1.2 : 1); p.color = color; p.kind = kind;
}
function star(x, R, r2) {
  x.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, q = i % 2 ? r2 : R; x.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  x.closePath();
}

// ---------- run state ----------
let S = null;
const progress = () => g.load("levels", {});
const firstOpen = () => { const pr = progress(); for (let i = 0; i < L.LEVELS.length; i++) if (!pr[i]) return i; return L.LEVELS.length - 1; };
const unlockedUpTo = () => { const pr = progress(); let hi = -1; for (let i = 0; i < L.LEVELS.length; i++) if (pr[i]) hi = i; return Math.min(L.LEVELS.length - 1, hi + 2); };

function newRun(mode, levelIdx, demo = false) {
  const lv = mode === "target" ? L.LEVELS[levelIdx] : null;
  S = {
    mode, levelIdx: lv ? levelIdx : null, lv, demo,
    board: lv ? L.buildPrefill(lv, Math.random) : L.emptyBoard(),
    tray: [null, null, null],
    score: 0, shown: 0, streak: 0, miss: 0, used: 0, lines: 0, magicLines: 0, count: 0, bestCombo: 0,
    magicIdx: 0, rule: lv ? lv.rule : L.ruleFor(0), want: lv ? L.wantFor(lv) : null, guide: null,
    sumGoal: !!lv && ["exact", "atLeast", "atMost", "odd"].includes(lv.goal.type),
    drag: null, kcur: { col: 3, row: 3 }, keyMode: false, hold: { code: "", t: 0 },
    pops: [], chips: [], floats: [], ending: null,
    joy: -9, flip: -9, worry: false, punch: -9, bump: -9, wave: 1.4,
  };
  for (const p of PARTS) p.live = false;
  dealTray(true);
  if (mode === "endless" && !demo && !taught().board) firstGame();
}
const taught = () => g.load("taught", {});
const learn = (k) => { const t = taught(); if (!t[k]) { t[k] = 1; g.save("taught", t); } };
/** The very first game: one row with a gap, and the piece that fills it to a sum of 30. Nothing here can fail. */
function firstGame() {
  const row = [4, 2, 6, 0, 0, 0, 3, 5], col = [0, 6, 3, 0, 0, 0, 8, 5];
  row.forEach((d, k) => { if (d) S.board[7 * 8 + k] = { d, c: col[k] }; });
  S.board[6 * 8] = { d: 7, c: 4 }; S.board[6 * 8 + 1] = { d: 1, c: 4 }; S.board[6 * 8 + 7] = { d: 9, c: 7 };
  const mk = (id, digits) => ({ shape: L.SHAPE[id], color: L.SHAPE[id].color, digits, born: 0, ret: null });
  S.tray = [mk("sq2", [1, 4, 2, 6]), mk("h3", [3, 5, 2]), mk("v2", [7, 3])];
  S.guide = { i: 1, col: 3, row: 7 };
}
function dealTray(quiet) {
  const tries = S.lv ? 10 : Math.max(3, 12 - Math.floor(S.score / 1200));
  const rule = S.rule;
  const xOk = (rule.kind === "mult" || rule.kind === "lin") && !S.sumGoal && !S.demo && (S.lv ? !!S.lv.xs : S.magicIdx >= 1);
  const pieces = L.deal(S.board, Math.random, {
    difficulty: S.lv ? Math.min(0.5, S.levelIdx / 50) : Math.min(1, S.score / 12000), tries, pool: S.lv?.pool,
    want: S.sumGoal ? S.want : (x) => L.ruleTest(rule, x), luck: S.lv ? 0.6 : rule.kind === "dbl" ? 0.7 : 0.45, xChance: xOk ? 0.13 : 0,
  });
  if (xOk && !g.load("xSeen", false) && pieces.some((p) => p.digits.includes(L.XT))) { g.save("xSeen", true); g.toast("New: an x tile. Clear its line and the game solves for x", 3400, "gold"); }
  pieces.forEach((p, i) => { p.born = (g.time || 0) + (quiet ? 0 : 0.1 + i * 0.07); p.ret = null; S.tray[i] = p; });
  if (!quiet) sfx.tone(300, 0.09, { slide: 520, type: "sine", vol: 0.25, delay: 0.1 });
}
function updateWorry() {
  let fits = 0;
  for (const p of S.tray) if (p) fits += L.allFits(S.board, p.shape).length;
  S.worry = L.filledCount(S.board) >= 38 || (fits > 0 && fits <= 6);
}
const cellXY = (col, row) => ({ x: LAY.bx + col * LAY.cell, y: LAY.by + row * LAY.cell });
const NOTE = (i) => 330 * 2 ** (([0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)) / 12);

/** Drop tray piece i with its top-left cell box at (col, row). The one place the rules run. */
function place(i, col, row) {
  const p = S.tray[i];
  if (!p || S.ending || g.state !== "playing" || !L.canPlace(S.board, p.shape, col, row)) return { ok: false };
  const now = g.time, cell = LAY.cell;
  const lines = L.previewLines(S.board, p.shape, p.digits, col, row).map((l) => { const j = L.judge(S.rule, l); return { ...l, magic: j.ok, total: j.total, x: j.x, hit: S.sumGoal && !l.xs && S.want(l.sum) }; });
  // the first triple line and the first plain line ever are counted out slowly, one digit at a time
  const known = taught();
  const teach = !S.demo && lines.length === 1 && !lines[0].xs && (lines[0].magic ? !known.hit : !known.miss);
  const step = teach ? 0.19 : 0.042, rule = S.rule;
  if (S.guide && S.guide.i === i) { S.guide = null; learn("board"); }
  L.writePiece(S.board, p, col, row, { born: now });
  S.tray[i] = null; S.used++; S.drag = null;
  sfx.noise(0.05, { freq: 900, vol: 0.5 }); sfx.tone(170, 0.09, { type: "sine", vol: 0.6, slide: 95 });
  S.bump = now;
  if (lines.length) { S.streak++; S.miss = 0; } else if (++S.miss >= 2) S.streak = 0;
  // remember what the cleared tiles looked like, then take them off the board right away
  const seen = new Set();
  lines.forEach((l, li) => {
    const t0 = now + 0.06 + li * 0.07;
    const digits = [], times = [];
    for (let k = 0; k < 8; k++) {
      const cc = l.type === "row" ? k : l.index, rw = l.type === "row" ? l.index : 7 - k;
      const cellv = S.board[rw * 8 + cc], t = t0 + k * step;
      digits.push(cellv.d); times.push(t);
      if (!seen.has(rw * 8 + cc)) { seen.add(rw * 8 + cc); S.pops.push({ col: cc, row: rw, c: cellv.c, d: cellv.d, t, done: false, gold: l.magic }); }
      sfx.tone(NOTE(Math.min(14, Math.min(S.streak - 1, 5) + li * 2 + k)), 0.09, { type: "triangle", vol: 0.32, delay: t - now });
    }
    l.end = t0 + 8 * step;
    l.mid = l.type === "row" ? { x: LAY.bx + cell * 4, y: LAY.by + l.index * cell + cell / 2 } : { x: LAY.bx + l.index * cell + cell / 2, y: LAY.by + cell * (2.5 + li * 1.4) };
    S.chips.push({ type: l.type, index: l.index, digits, times, sum: l.sum, xs: l.xs, total: l.total, x: l.x, magic: l.magic, hit: l.hit, end: l.end, mid: l.mid, hold: teach ? 3.4 : l.magic ? 1.7 : 1.1, fly: teach ? 0.26 : 0.14 });
  });
  L.clearLines(S.board, lines);
  const empty = lines.length > 0 && L.filledCount(S.board) === 0;
  const gained = L.scoreMove(p.shape.size, lines, S.streak, empty);
  S.score += gained; g.score = S.score;
  S.lines += lines.length; S.magicLines += lines.filter((l) => l.magic).length;
  S.bestCombo = Math.max(S.bestCombo, lines.length);
  // the result lines stack clear of the count-up strips: above them when there is room, else below
  const fh = LAY.p ? 78 : 64, topY = Math.min(...lines.map((l) => l.mid.y)), botY = Math.max(...lines.map((l) => l.mid.y));
  const above = topY - LAY.by > lines.length * fh + 16;
  lines.forEach((l, li) => {
    const fy = above ? topY - (LAY.p ? 66 : 54) - (lines.length - 1 - li) * fh : botY + (LAY.p ? 50 : 42) + li * fh;
    const F = (text, sub, color, size, dur) => S.floats.push({ x: lines.length > 1 ? LAY.bx + cell * 4 : l.mid.x, y: fy, text, sub, color, size: size * (LAY.p ? 1.15 : 1), t0: l.end, dur });
    if (l.magic) {
      const solved = L.ruleSolved(rule, l.total);
      if (l.xs) F(`x = ${l.x} makes ${l.total}`, `${solved}   ×3  +${l.pts}`, GOLD, 25, 2.4);
      else if (teach) F(L.ruleTeach(rule, l.total), `${solved}   +${l.pts}`, GOLD, 21, 4);
      else F(solved, `×3   +${l.pts}`, GOLD, 25, 1.9);
      [988, 1319, 1568].forEach((f, k) => sfx.tone(f, 0.14, { type: "square", vol: 0.22, delay: l.end - now + k * 0.07 }));
    } else if (l.xs) F(`+${l.pts}`, "no x from 1 to 9 fits", "#ffffff", 28, 1.6);
    else if (teach) F(L.ruleMiss(rule, l.total, true), `No bonus this time.   +${l.pts}`, "#ffffff", 21, 3.4);
    else F(`+${l.pts}`, l.hit ? `${l.sum} counts` : L.ruleMiss(rule, l.total), "#ffffff", 28, 1.4);
  });
  if (teach) learn(lines[0].magic ? "hit" : "miss");
  if (lines.length) {
    S.joy = now + 0.15; S.punch = now;
    g.shake(3 + lines.length * 2.5, 0.22);
    sfx.noise(0.18, { freq: 2600, type: "bandpass", vol: 0.3, delay: 0.05 });
    if (lines.length >= 2) g.toast(`${lines.length} lines at once`, 1100, "good");
    else if (S.streak >= 2) g.toast(`Streak ${S.streak}`, 900, "good");
  }
  if (empty) {
    g.toast(`Board clear! +${L.BOARD_CLEAR}`, 1800, "gold");
    [523, 659, 784, 1047].forEach((f, k) => sfx.tone(f, 0.18, { vol: 0.45, delay: 0.45 + k * 0.09 }));
    for (let k = 0; k < 70; k++) spark(LAY.bx + rand(0, cell * 8), LAY.by + rand(0, cell * 8), TILE[k % 10], 2, 1.2);
  }
  if (S.mode === "endless") {
    let changed = false;
    while (S.score >= L.magicThreshold(S.magicIdx)) { S.magicIdx++; S.rule = L.ruleFor(S.magicIdx); changed = true; }
    if (changed) {
      S.flip = now + 0.5;
      g.toast(L.ruleIntro(S.rule), 3600, "gold");
      [392, 523, 659, 784, 1047].forEach((f, k) => sfx.tone(f, 0.12, { type: "square", vol: 0.26, delay: 0.55 + k * 0.06 }));
    }
  } else {
    S.count = L.goalProgress(S.lv, S.count, { lines, streak: S.streak, score: S.score, boardEmpty: empty });
    if (S.count >= L.goalTarget(S.lv)) S.ending = { at: now + 1.5, won: true, t0: now };
    else if (S.used >= S.lv.pieces) S.ending = { at: now + 1.3, won: false, why: "pieces", t0: now };
  }
  if (!S.ending && S.tray.every((x) => !x)) dealTray(false);
  if (!S.ending && L.isStuck(S.board, S.tray)) { S.ending = { at: now + 1.5, won: false, why: "stuck", t0: now }; sfx.tone(196, 0.3, { type: "sawtooth", vol: 0.22, delay: 0.35, slide: 120 }); }
  updateWorry();
  if (S.keyMode && !S.ending) keyPick(S.tray.findIndex(Boolean));
  return { ok: true, gained, teach, lines: lines.map((l) => ({ type: l.type, index: l.index, sum: l.sum, xs: l.xs, x: l.x, total: l.total, magic: l.magic, pts: l.pts })), streak: S.streak, score: S.score, boardCleared: empty, ending: S.ending ? (S.ending.won ? "won" : S.ending.why) : null };
}
function finish() {
  const e = S.ending;
  clearToasts();
  if (S.mode === "endless") {
    g.over({ score: S.score, title: "No more moves", lines: [`Lines cleared: ${S.lines}`, `Triple lines: ${S.magicLines}`] });
    return;
  }
  const n = S.levelIdx + 1, lv = S.lv, last = n === L.LEVELS.length;
  if (e.won) {
    const stars = L.starsFor(lv, S.used), pr = progress();
    pr[S.levelIdx] = Math.max(pr[S.levelIdx] || 0, stars);
    g.save("levels", pr);
    sel.level = last ? S.levelIdx : S.levelIdx + 1;
    g.over({ won: true, title: last ? "All 30 levels clear" : `Level ${n} clear`, score: `${S.used} of ${lv.pieces}`, scoreLabel: "Pieces used", lines: [L.goalText(lv)], again: last ? "Play again" : "Next level" });
    const h = g.stage.querySelector(".ak-overlay h2");
    if (h) h.insertAdjacentHTML("afterend", `<div class="sb-stars sb-big">${starsHtml(stars)}</div>`);
  } else {
    sel.level = S.levelIdx;
    g.over({ won: false, title: e.why === "pieces" ? "Out of pieces" : "No more moves", score: `${Math.min(S.count, L.goalTarget(lv))} of ${L.goalTarget(lv)}`, scoreLabel: `Level ${n} goal`, lines: [L.goalText(lv)], again: "Try again" });
  }
  g.stage.querySelector(".ak-overlay .ak-best")?.remove();
}

// ---------- input ----------
function keyPick(i) {
  if (i < 0 || !S.tray[i]) { S.drag = null; return; }
  const p = S.tray[i];
  const col = clamp(S.kcur.col, 0, 8 - p.shape.w), row = clamp(S.kcur.row, 0, 8 - p.shape.h);
  S.drag = { i, src: "key", col, row, valid: false, lines: [], t0: g.time };
  S.keyMode = true;
  hover();
}
/** Work out the ghost cell and the lines it would clear. */
function hover() {
  const d = S.drag;
  if (!d) return;
  const p = S.tray[d.i], cell = LAY.cell;
  if (d.src === "key") d.valid = L.canPlace(S.board, p.shape, d.col, d.row);
  else {
    const fx = (d.tx - LAY.bx) / cell, fy = (d.ty - LAY.by) / cell;
    let best = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = Math.round(fx) + dc, rw = Math.round(fy) + dr;
      if (!L.canPlace(S.board, p.shape, cc, rw)) continue;
      const dist = Math.hypot(cc - fx, rw - fy);
      if (dist <= 0.8 && (!best || dist < best.dist)) best = { cc, rw, dist };
    }
    d.valid = !!best;
    if (best) { if (d.col !== best.cc || d.row !== best.rw) sfx.tone(880, 0.02, { type: "sine", vol: 0.1 }); d.col = best.cc; d.row = best.rw; } else { d.col = -9; d.row = -9; }
  }
  d.lines = d.valid ? L.previewLines(S.board, p.shape, p.digits, d.col, d.row) : [];
  for (const l of d.lines) { l.j = L.judge(S.rule, l); l.need = l.xs ? 0 : L.ruleNeed(S.rule, l.sum); }
}
function pointerTarget(p, pt) {
  const cell = LAY.cell, pw = p.shape.w * cell, ph = p.shape.h * cell;
  if (pointerType === "mouse") return { x: pt.x - pw / 2, y: pt.y - ph / 2 - cell * 0.3 };
  const off = lerp(cell * 0.2, cell * 0.95, clamp((LAY.H - pt.y) / (cell * 1.6), 0, 1));
  return { x: pt.x - pw / 2, y: pt.y - off - ph };
}
function input(dt) {
  const pt = g.pointer.at(c);
  let over = -1;
  for (let i = 0; i < 3; i++) { const s = slotRect(i); if (S.tray[i] && pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h) over = i; }
  if (g.pointer.pressed && over >= 0) {
    const p = S.tray[over], tp = trayPos(p, over), tg = pointerTarget(p, pt);
    S.drag = { i: over, src: "pointer", x: tp.x, y: tp.y, cs: tp.cs, tx: tg.x, ty: tg.y, col: -9, row: -9, valid: false, lines: [], t0: g.time };
    S.keyMode = false; p.ret = null;
    sfx.tone(520, 0.05, { slide: 760, vol: 0.22 });
  }
  const d = S.drag;
  if (d && d.src === "pointer") {
    const p = S.tray[d.i], tg = pointerTarget(p, pt);
    d.tx = tg.x; d.ty = tg.y;
    const k = clamp((g.time - d.t0) / 0.11, 0, 1);
    d.cs = lerp(d.cs, LAY.cell, Math.max(ease.out(k), 1 - Math.exp(-30 * dt)));
    d.x = damp(d.x, d.tx, 42, dt); d.y = damp(d.y, d.ty, 42, dt);
    hover();
    if (g.pointer.released || !g.pointer.down) {
      if (d.valid) place(d.i, d.col, d.row);
      else {
        const onBoard = d.tx > LAY.bx - 90 && d.tx < LAY.bx + LAY.cell * 8 && d.ty > LAY.by - 90 && d.ty < LAY.by + LAY.cell * 8;
        if (onBoard) { sfx.tone(150, 0.12, { type: "sawtooth", vol: 0.18, slide: 110 }); }
        else sfx.tone(420, 0.05, { slide: 300, vol: 0.15 });
        p.ret = { x: d.x, y: d.y, cs: d.cs, t0: g.time };
        S.drag = null;
      }
    }
  }
  c.canvas.style.cursor = S.drag?.src === "pointer" ? "grabbing" : over >= 0 ? "grab" : "default";

  // keyboard
  const K = g.keys;
  for (let i = 0; i < 3; i++) if (K.pressed("Digit" + (i + 1), "Numpad" + (i + 1))) {
    if (S.drag?.src === "key" && S.drag.i === i) { S.drag = null; S.keyMode = false; sfx.play("click"); }
    else if (S.tray[i]) { keyPick(i); sfx.tone(520, 0.05, { slide: 760, vol: 0.22 }); }
  }
  const kd = S.drag;
  if (kd && kd.src === "key") {
    const p = S.tray[kd.i];
    const DIRS = [["ArrowLeft", "KeyA", -1, 0], ["ArrowRight", "KeyD", 1, 0], ["ArrowUp", "KeyW", 0, -1], ["ArrowDown", "KeyS", 0, 1]];
    for (const [a, b, dx, dy] of DIRS) {
      let go = K.pressed(a, b);
      if (go) S.hold = { code: a, t: 0.24 };
      else if (S.hold.code === a && K.down(a, b)) { S.hold.t -= dt; if (S.hold.t <= 0) { S.hold.t = 0.07; go = true; } }
      if (go) {
        const nc = clamp(kd.col + dx, 0, 8 - p.shape.w), nr = clamp(kd.row + dy, 0, 8 - p.shape.h);
        if (nc !== kd.col || nr !== kd.row) { kd.col = nc; kd.row = nr; S.kcur = { col: nc, row: nr }; sfx.tone(880, 0.02, { type: "sine", vol: 0.1 }); hover(); }
      }
    }
    if (K.pressed("Space", "Enter", "NumpadEnter")) {
      if (kd.valid) place(kd.i, kd.col, kd.row);
      else { sfx.tone(150, 0.12, { type: "sawtooth", vol: 0.18, slide: 110 }); kd.nope = g.time; }
    }
    if (K.pressed("Backspace", "KeyX")) { S.drag = null; S.keyMode = false; }
  }
}

function update(dt) {
  const now = g.time;
  S.shown = S.shown + (S.score - S.shown) * Math.min(1, dt * 9);
  if (S.score - S.shown < 0.6) S.shown = S.score;
  for (const p of S.pops) if (!p.done && now >= p.t) {
    p.done = true;
    const { x, y } = cellXY(p.col, p.row), h = LAY.cell / 2;
    for (let k = 0; k < 5; k++) spark(x + h + rand(-14, 14), y + h + rand(-14, 14), TILE[p.c], 0);
    if (p.gold) for (let k = 0; k < 3; k++) spark(x + h, y + h, GOLD, 1, 0.9);
  }
  if (S.pops.length && now > S.pops[S.pops.length - 1].t + 0.4) S.pops = S.pops.filter((p) => now < p.t + 0.3);
  for (const ch of S.chips) if (ch.magic && !ch.burst && now >= ch.end) { ch.burst = true; const q = ch.mid; for (let k = 0; k < 22; k++) spark(q.x + rand(-90, 90), q.y, k % 3 ? GOLD : "#fff7cc", 1, 1.1); }
  S.chips = S.chips.filter((ch) => now < ch.end + ch.hold);
  S.floats = S.floats.filter((f) => now < f.t0 + f.dur);
  for (const p of PARTS) if (p.live) {
    p.t += dt; if (p.t >= p.max) { p.live = false; continue; }
    p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= 1 - 1.2 * dt;
  }
  if (S.ending) {
    S.drag = null;
    if (S.ending.won && Math.random() < 0.5) spark(rand(0, LAY.W), rand(-10, LAY.H * 0.3), TILE[Math.floor(rand(0, 10))], 2, 0.5);
    if (now >= S.ending.at) finish();
    return;
  }
  input(dt);
}

// ---------- render ----------
const chipXY = (l) => (l.type === "row" ? { x: LAY.bx + LAY.cell * 8 + (LAY.p ? 0 : 10), y: LAY.by + l.index * LAY.cell + LAY.cell / 2 } : { x: LAY.bx + l.index * LAY.cell + LAY.cell / 2, y: LAY.by - (LAY.p ? 6 : 2) });
function drawChip(x, y, value, tone, scale = 1) {
  const str = String(value);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const w = str.length > 2 ? 22 + str.length * 11 : str.length > 1 ? 46 : 38;
  rr(ctx, -w / 2, -16, w, 36, 14); ctx.fillStyle = "rgba(11,20,55,0.45)"; ctx.fill();
  rr(ctx, -w / 2, -18, w, 34, 14); ctx.fillStyle = tone === "gold" ? GOLD : tone === "hit" ? "#34d399" : CREAM; ctx.fill();
  ctx.strokeStyle = NAVY; ctx.lineWidth = 3.5; ctx.stroke();
  text(ctx, str, 0, 0, 21, tone === "gold" ? "#5b2c06" : NAVY);
  ctx.restore();
  return w;
}
/** The small label that hangs off a preview chip: a gold "×3", or what the line still needs. */
function drawTag(l, q, chipW, now) {
  const j = l.j, gold = j.ok;
  const str = gold ? (l.xs ? `x = ${j.x}   ×3` : "×3") : l.xs ? "no x fits" : l.need ? `needs ${l.need} more` : "";
  if (!str) return;
  const size = gold ? 19 : 13;
  ctx.font = `900 ${size}px ${FONT}`;
  const w = ctx.measureText(str).width + (gold ? 20 : 16), h = gold ? 30 : 24;
  let x = q.x + chipW / 2 + w / 2 + 3;
  const y = q.y - 1;
  if (l.type === "row" && x + w / 2 > LAY.W - 4) x = q.x - chipW / 2 - w / 2 - 3; // no room on the right in portrait
  x = clamp(x, w / 2 + 4, LAY.W - w / 2 - 4);
  const sc = gold ? 1 + 0.07 * Math.sin(now * 9) : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  rr(ctx, -w / 2, -h / 2 + 2, w, h, h / 2); ctx.fillStyle = "rgba(11,20,55,0.45)"; ctx.fill();
  rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = gold ? "#fde047" : "#0f1c4d"; ctx.fill();
  ctx.strokeStyle = gold ? "#92400e" : "#93c5fd"; ctx.lineWidth = gold ? 3 : 2; ctx.stroke();
  text(ctx, str, 0, 1, size, gold ? "#5b2c06" : "#e0ecff");
  ctx.restore();
}
/** The count-up of a cleared line: "3 + 5 + 1 + ... = 30", built one digit at a time where the line was. */
function drawCount(ch, now) {
  let n = 0, v = 0, last = -1, xsSeen = 0;
  for (let k = 0; k < 8; k++) if (now >= ch.times[k]) { n++; if (ch.digits[k] === L.XT) xsSeen++; else v += ch.digits[k]; last = ch.times[k]; }
  if (!n) return;
  const done = now >= ch.end, cell = LAY.cell, T = (d) => (d === L.XT ? "x" : String(d));
  const terms = ch.digits.slice(0, n).map(T).join(" + ");
  const rhs = done ? (ch.xs && !ch.x ? `${ch.sum} + ${ch.xs > 1 ? ch.xs : ""}x` : String(ch.total)) : xsSeen ? `${v} + ${xsSeen > 1 ? xsSeen : ""}x` : String(v);
  const full = ch.digits.map(T).join(" + ") + " = " + (ch.xs ? "00 + 2x" : "00");
  let fs = LAY.p ? 24 : 18;
  ctx.font = `900 ${fs}px ${FONT}`;
  const maxW = cell * 8 - 30, fw = ctx.measureText(full).width;
  if (fw > maxW) { fs *= maxW / fw; ctx.font = `900 ${fs}px ${FONT}`; }
  const w = Math.min(fw, maxW) + 26, h = fs + 18;
  const cx = clamp(ch.mid.x, LAY.bx + w / 2 + 2, LAY.bx + cell * 8 - w / 2 - 2), cy = ch.mid.y;
  const tw = ctx.measureText(terms).width, left = cx - w / 2 + 13;
  const fin = done ? 1 + 0.12 * (1 - ease.out(clamp((now - ch.end) / 0.3, 0, 1))) : 1;
  const alpha = clamp((ch.end + ch.hold - now) / 0.25, 0, 1);
  const tone = done && ch.magic ? GOLD : done && ch.hit ? "#34d399" : "#bfdbfe";
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(fin, fin); ctx.translate(-cx, -cy);
  rr(ctx, cx - w / 2, cy - h / 2 + 3, w, h, h / 2); ctx.fillStyle = "rgba(4,8,30,0.4)"; ctx.fill();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = "rgba(11,20,55,0.94)"; ctx.fill();
  ctx.strokeStyle = tone; ctx.lineWidth = done && ch.magic ? 3.5 : 2.5; ctx.stroke();
  text(ctx, terms, left, cy + 1, fs, "#ffffff", { align: "left" });
  const tick = 1 + 0.25 * (1 - clamp((now - last) / 0.1, 0, 1));
  text(ctx, " = ", left + tw, cy + 1, fs, "#93c5fd", { align: "left" });
  const ew = ctx.measureText(" = ").width;
  ctx.save(); ctx.translate(left + tw + ew, cy + 1); ctx.scale(tick, tick);
  text(ctx, rhs, 0, 0, fs * 1.08, done && ch.magic ? "#fde047" : done && ch.hit ? "#6ee7b7" : "#ffffff", { align: "left" });
  ctx.restore();
  // each digit flies from its tile into the sum
  for (let k = 0; k < 8; k++) {
    const u = (now - ch.times[k]) / ch.fly;
    if (u < 0 || u >= 1) continue;
    const cc = ch.type === "row" ? k : ch.index, rw = ch.type === "row" ? ch.index : 7 - k;
    const e = ease.out(u), sx = LAY.bx + cc * cell + cell / 2, sy = LAY.by + rw * cell + cell / 2;
    const px = lerp(sx, left + tw, e), py = lerp(sy, cy, e) - Math.sin(u * Math.PI) * 16;
    text(ctx, T(ch.digits[k]), px, py, lerp(cell * 0.5, fs, e), "#fde68a", { stroke: NAVY, sw: 5 });
  }
  ctx.restore();
}
function drawScoreCard(now) {
  const s = LAY.score;
  ctx.save();
  ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(s.rot);
  const k = clamp((now - S.punch) / 0.3, 0, 1), sc = 1 + 0.07 * (1 - ease.out(k));
  ctx.scale(sc, sc);
  rr(ctx, -s.w / 2 + 2, -s.h / 2 + 5, s.w, s.h, 10); ctx.fillStyle = "rgba(45,20,4,0.35)"; ctx.fill();
  rr(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 10); ctx.fillStyle = CREAM; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#f87171"; ctx.fillRect(-s.w / 2 + 8, -s.h / 2 + 24, s.w - 16, 2);
  ctx.fillStyle = "rgba(96,165,250,0.4)"; ctx.fillRect(-s.w / 2 + 8, s.h / 2 - 25, s.w - 16, 1.5);
  text(ctx, "SCORE", 0, -s.h / 2 + 14, 13, "#64748b", { weight: 800 });
  text(ctx, String(Math.round(S.shown)), 0, 3, 34, NAVY);
  const foot = S.mode === "target" ? `Level ${S.levelIdx + 1}` : g.best ? `Best ${Math.max(g.best, S.demo ? 0 : S.score)}` : "First run";
  text(ctx, foot, 0, s.h / 2 - 13, 13, "#64748b", { weight: 800 });
  ctx.restore();
}
function drawCoin(cx, cy, r, rule) {
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + r * 0.2 + 5, r * 1.02, r * 0.95, 0, 0, 7); ctx.fillStyle = "rgba(4,8,30,0.4)"; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, q = r * (1 + 0.055 * Math.cos(a * 12)); ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, cy - r, 0, cy + r); gr.addColorStop(0, "#fde68a"); gr.addColorStop(0.5, "#fbbf24"); gr.addColorStop(1, "#d97706");
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = "#0b1437"; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.76, 0, 7); ctx.fillStyle = "#fff4cf"; ctx.fill(); ctx.strokeStyle = "#b45309"; ctx.lineWidth = 2; ctx.stroke();
  if (rule.kind === "mult") text(ctx, String(rule.a), cx, cy + 2, r * 1.12, NAVY);
  else if (rule.kind === "lin") text(ctx, `${rule.a}n+${rule.b}`, cx, cy + 1, r * 0.5, NAVY);
  else { text(ctx, "x =", cx, cy - r * 0.34, r * 0.36, "#92400e", { weight: 800 }); text(ctx, String(rule.x), cx, cy + r * 0.2, r * 0.74, NAVY); }
}
function drawBadge(now) {
  const b = LAY.badge, rule = S.rule, p = LAY.p;
  const k = clamp((now - S.flip) / 0.7, 0, 1), flipping = now >= S.flip && k < 1;
  const pop = flipping ? 1 + 0.07 * Math.sin(k * Math.PI) : 1;
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(pop, pop); ctx.translate(-b.w / 2, -b.h / 2);
  rr(ctx, 2, 6, b.w, b.h, 18); ctx.fillStyle = "rgba(8,3,0,0.45)"; ctx.fill();
  rr(ctx, 0, 0, b.w, b.h, 18);
  const gr = ctx.createLinearGradient(0, 0, 0, b.h); gr.addColorStop(0, "#24449f"); gr.addColorStop(1, "#16286a");
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
  rr(ctx, 5, 5, b.w - 10, b.h - 10, 14); ctx.strokeStyle = "rgba(253,230,138,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
  const cr = p ? 36 : 31, cx = 14 + cr, tx = cx + cr + 13, tw = b.w - tx - 12;
  drawCoin(cx, b.h / 2 + (p ? 0 : -6), cr, rule);
  const title = rule.kind === "mult" ? `MAGIC NUMBER ${rule.a}` : "MAGIC RULE";
  let y = p ? 19 : 23;
  text(ctx, title, tx, y, 12.5, "#fde68a", { align: "left", weight: 800 });
  y += p ? 25 : 28;
  const eq = `line ${L.ruleText(rule)}`, es = p ? 27 : 25;
  ctx.font = `900 ${es}px ${FONT}`;
  text(ctx, eq, tx, y, es * Math.min(1, tw / ctx.measureText(eq).width), "#ffffff", { align: "left" });
  y += p ? 25 : 27;
  ctx.font = `800 13px ${FONT}`;
  const hint = wrap(ctx, L.ruleHint(rule), tw).slice(0, 3);
  hint.forEach((t, i) => text(ctx, t, tx, y + i * 16, 13, "#dbeafe", { align: "left", weight: 800 }));
  if (rule.kind === "mult" || rule.kind === "lin") {
    const ny = p ? Math.max(y + hint.length * 16 - 2, b.h - 13) : b.h - 15;
    text(ctx, "n is any whole number", p ? tx : b.w / 2, ny, 11.5, "rgba(191,219,254,0.75)", { align: p ? "left" : "center", weight: 700 });
  }
  if (flipping) { rr(ctx, 0, 0, b.w, b.h, 18); ctx.fillStyle = `rgba(253,224,71,${0.45 * Math.sin(k * Math.PI)})`; ctx.fill(); }
  ctx.restore();
}
function drawStreak(now) {
  const s = LAY.streak, n = S.streak, risky = n > 0 && S.miss > 0;
  rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.fillStyle = "rgba(16,7,2,0.62)"; ctx.fill(); ctx.strokeStyle = "rgba(255,214,160,0.34)"; ctx.lineWidth = 2; ctx.stroke();
  const pips = 5, gap = LAY.p ? 15 : 19, x0 = s.x + (LAY.p ? 14 : 18), cy = s.y + s.h / 2;
  for (let i = 0; i < pips; i++) {
    const on = i < n, cx = x0 + i * gap, pulse = on && i === n - 1 ? 1 + 0.25 * (1 - ease.out(clamp((now - S.punch) / 0.35, 0, 1))) : 1;
    ctx.beginPath(); ctx.arc(cx, cy, (LAY.p ? 5.5 : 7) * pulse, 0, 7);
    ctx.fillStyle = on ? (risky && Math.sin(now * 9) > 0 ? "#b45309" : i >= 3 ? "#f87171" : "#fbbf24") : "rgba(20,8,0,0.55)";
    ctx.fill(); ctx.strokeStyle = on ? "#fff3c4" : "rgba(255,214,160,0.28)"; ctx.lineWidth = 1.6; ctx.stroke();
  }
  const label = n >= 2 ? `x${L.streakMult(n)}` : "streak";
  text(ctx, label, s.x + s.w - (LAY.p ? 8 : 12), cy + 1, n >= 2 ? (LAY.p ? 17 : 20) : LAY.p ? 0.1 : 13, n >= 2 ? "#fde68a" : "rgba(255,232,200,0.85)", { align: "right", weight: n >= 2 ? 900 : 800 });
}
function drawInfo(now) {
  const s = LAY.info, slim = s.h < 50;
  if (S.mode === "target") {
    const lv = S.lv, target = L.goalTarget(lv), left = Math.max(0, lv.pieces - S.used);
    const prog = lv.goal.type === "score" ? `${Math.min(S.score, target)}/${target}` : `${Math.min(S.count, target)}/${target}`;
    ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(slim ? 0 : 0.015);
    rr(ctx, -s.w / 2 + 2, -s.h / 2 + 5, s.w, s.h, 8); ctx.fillStyle = "rgba(8,3,0,0.4)"; ctx.fill();
    rr(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 8); ctx.fillStyle = "#fef08a"; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 3; ctx.stroke();
    if (slim) {
      const tw = s.w - 108, goal = L.goalText(lv);
      ctx.font = `800 14.5px ${FONT}`;
      const linesT = wrap(ctx, goal, tw).slice(0, 2), fsz = linesT.length > 1 ? 12.5 : 14.5;
      linesT.forEach((t, i) => text(ctx, t, -s.w / 2 + 12, (i - (linesT.length - 1) / 2) * 14 + 1, fsz, INK, { weight: 800, align: "left" }));
      text(ctx, prog, s.w / 2 - 48, -7, lv.goal.type === "score" ? 13 : 17, NAVY);
      text(ctx, `${left} left`, s.w / 2 - 48, 10, 11, left <= 3 ? "#b91c1c" : "#713f12", { weight: 800 });
    } else {
      ctx.font = `800 13.5px ${FONT}`;
      const linesT = wrap(ctx, L.goalText(lv), s.w - 22).slice(0, 2);
      linesT.forEach((t, i) => text(ctx, t, 0, -s.h / 2 + 15 + i * 16, 13.5, INK, { weight: 800 }));
      text(ctx, prog, -s.w / 2 + 12, s.h / 2 - 14, 17, NAVY, { align: "left" });
      text(ctx, `${left} pieces left`, s.w / 2 - 10, s.h / 2 - 14, 12.5, left <= 3 ? "#b91c1c" : "#713f12", { weight: 800, align: "right" });
    }
    ctx.restore();
    return;
  }
  const lo = S.magicIdx ? L.magicThreshold(S.magicIdx - 1) : 0, hi = L.magicThreshold(S.magicIdx);
  const f = clamp((S.shown - lo) / (hi - lo), 0, 1);
  rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.fillStyle = "rgba(16,7,2,0.62)"; ctx.fill(); ctx.strokeStyle = "rgba(255,214,160,0.34)"; ctx.lineWidth = 2; ctx.stroke();
  const pad = 14, cy = s.y + s.h / 2, label = `New rule at ${hi}`;
  let bx0 = s.x + pad, bw = s.w - pad * 2, by2 = cy + 6;
  if (slim) { text(ctx, label, s.x + pad, cy + 1, 13.5, "rgba(255,240,215,0.95)", { align: "left", weight: 800 }); bx0 = s.x + 150; bw = s.w - 150 - pad; by2 = cy - 7; }
  else text(ctx, label, s.x + pad, cy - 17, 13.5, "rgba(255,240,215,0.95)", { align: "left", weight: 800 });
  rr(ctx, bx0, by2, bw, 14, 7); ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
  if (f > 0.02) { rr(ctx, bx0 + 2, by2 + 2, Math.max(10, (bw - 4) * f), 10, 5); ctx.fillStyle = GOLD; ctx.fill(); }
}
function drawArchieHere(now) {
  const a = LAY.archie, joy = now - S.joy, happy = joy >= 0 && joy < 1.3;
  const lost = S.ending && !S.ending.won && now > S.ending.t0 + 0.5, won = S.ending?.won;
  let pose = "idle", y = a.y, sx = 1, sy = 1, x = a.x, rot = 0;
  if (lost) pose = "sad";
  else if (happy || won) {
    pose = "happy";
    const u = won ? (now * 1.4) % 1 : joy / 1.3, hop = Math.abs(Math.sin(u * Math.PI * (won ? 1 : 3))) * (won ? 1 : 1 - u);
    y -= hop * 26; sy = 1 + hop * 0.08; sx = 1 - hop * 0.05; rot = Math.sin(u * Math.PI * 6) * 0.05 * (1 - u);
  } else if (g.state === "playing" && now < S.wave) pose = "wave";
  else if (S.worry) { x += Math.sin(now * 38) * 1.3; sy = 0.97; }
  else sy = 1 + Math.sin(now * 2.2) * 0.012;
  ctx.beginPath(); ctx.ellipse(a.x, a.y + a.size * 0.385, a.size * 0.36 * (1 - (a.y - y) / 90), a.size * (a.ground ? 0.075 : 0.045), 0, 0, 7); ctx.fillStyle = "rgba(30,12,2,0.3)"; ctx.fill();
  let look = { x: a.ground ? 0.9 : -0.5, y: a.ground ? -0.1 : 0.9 };
  const d = S.drag;
  if (d) { const tx = d.src === "key" ? LAY.bx + (d.col + 1) * LAY.cell : d.x, ty = d.src === "key" ? LAY.by + (d.row + 1) * LAY.cell : d.y; const dx = tx - a.x, dy = ty - a.y, m = Math.hypot(dx, dy) || 1; look = { x: dx / m, y: dy / m }; }
  else if (S.worry) look = { x: Math.sin(now * 3.1) * 0.9, y: 0.4 };
  drawArchie(ctx, x, y, a.size, { pose, look, blink: now % 3.4 > 3.26, squashX: sx, squashY: sy, rotation: rot, t: now });
  if (S.worry && !happy && !lost && !won) {
    const u = (now * 0.9) % 1;
    ctx.save(); ctx.translate(a.x + a.size * 0.33, a.y - a.size * 0.3 + u * 16); ctx.globalAlpha = 1 - u;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.bezierCurveTo(7, 2, 5, 8, 0, 8); ctx.bezierCurveTo(-5, 8, -7, 2, 0, -8);
    ctx.fillStyle = "#bae6fd"; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}
function render() {
  if (!S) return;
  if (posterOn) { drawPoster(); return; }
  buildStatic();
  const now = g.time, { cell, bx, by, W, H } = LAY;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#3a2110"; ctx.fillRect(0, 0, c.canvas.width, c.canvas.height);
  const shx = g.shakeX, shy = g.shakeY;
  ctx.drawImage(staticCv, Math.round(shx * c.scale), Math.round(shy * c.scale));
  ctx.setTransform(c.scale, 0, 0, c.scale, shx * c.scale, shy * c.scale);

  drawScoreCard(now); drawBadge(now); drawStreak(now); drawInfo(now);

  // tiles on the board
  const dying = S.ending && !S.ending.won ? (now - S.ending.t0 - 0.45) / 0.7 : -1;
  for (let rw = 0; rw < 8; rw++) for (let cl = 0; cl < 8; cl++) {
    const t = S.board[rw * 8 + cl];
    if (!t) continue;
    const x = bx + cl * cell, y = by + rw * cell;
    const gray = dying > (7 - rw) / 8;
    const k = t.born != null ? clamp((now - t.born) / 0.16, 0, 1) : 1;
    if (k < 1) { const s = 1 + 0.16 * (1 - ease.out(k)); drawTile(t.c, t.d, x + (cell * (1 - s)) / 2, y + (cell * (1 - s)) / 2, cell * s); }
    else drawTile(gray ? GRAY : t.c, t.d, x, y, cell);
  }
  // tiles on their way out
  for (const p of S.pops) {
    const u = (now - p.t) / 0.2;
    if (u >= 1) continue;
    const x = bx + p.col * cell, y = by + p.row * cell;
    if (u < 0) { drawTile(p.c, p.d, x, y, cell); const w = clamp(1 + u / 0.25, 0, 1); if (w > 0) { rr(ctx, x + 3, y + 3, cell - 6, cell - 6, 9); ctx.fillStyle = `rgba(255,255,255,${0.55 * w})`; ctx.fill(); } }
    else { const s = 1 + 0.32 * ease.out(u); drawTile(p.c, p.d, x + (cell * (1 - s)) / 2, y + (cell * (1 - s)) / 2, cell * s, 1 - u); rr(ctx, x + 3, y + 3, cell - 6, cell - 6, 9); ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - u)})`; ctx.fill(); }
  }
  // the first game points at the gap
  const d = S.drag;
  if (S.guide && S.tray[S.guide.i] && g.state === "playing") {
    const gd = S.guide, p = S.tray[gd.i], gx = bx + gd.col * cell, gy = by + gd.row * cell, pulse = 0.5 + 0.5 * Math.sin(now * 5);
    for (const [cx, cy] of p.shape.cells) {
      rr(ctx, gx + cx * cell + 3, gy + cy * cell + 3, cell - 6, cell - 6, 9);
      ctx.fillStyle = `rgba(253,224,71,${0.12 + 0.14 * pulse})`; ctx.fill(); ctx.strokeStyle = `rgba(253,224,71,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.stroke();
    }
    if (!d) {
      const tp = trayPos(p, gd.i), u = (now % 2.2) / 2.2, e = ease.inOut ? ease.inOut(clamp((u - 0.15) / 0.55, 0, 1)) : clamp((u - 0.15) / 0.55, 0, 1);
      const a = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
      drawPiece(p, lerp(tp.x, gx, e), lerp(tp.y, gy, e), lerp(tp.cs, cell, e), 0.55 * a);
    }
    text(ctx, "Drag it into the gap", bx + cell * 4, gy - cell * 1.6, LAY.p ? 28 : 21, "#fde047", { stroke: "#0b1437", sw: LAY.p ? 8 : 6 });
  }
  // ghost, and the lines it would clear
  if (d && S.tray[d.i]) {
    const p = S.tray[d.i];
    if (d.valid || d.src === "key") {
      const gx = bx + d.col * cell, gy = by + d.row * cell;
      for (const l of d.lines) {
        const gold = l.j.ok, hit = S.sumGoal && !l.xs && S.want(l.sum), a = 0.2 + 0.1 * Math.sin(now * 9);
        const lx = l.type === "row" ? bx : bx + l.index * cell, ly = l.type === "row" ? by + l.index * cell : by, lw = l.type === "row" ? cell * 8 : cell, lh = l.type === "row" ? cell : cell * 8;
        rr(ctx, lx + 1, ly + 1, lw - 2, lh - 2, 12);
        ctx.fillStyle = gold ? `rgba(253,224,71,${a + 0.16})` : hit ? `rgba(52,211,153,${a + 0.14})` : `rgba(255,255,255,${a + 0.06})`; ctx.fill();
        ctx.strokeStyle = gold ? "#fde047" : hit ? "#6ee7b7" : "#ffffff"; ctx.lineWidth = 3.5; ctx.stroke();
      }
      const shakeX = d.nope && now - d.nope < 0.25 ? Math.sin((now - d.nope) * 60) * 5 : 0;
      drawPiece(p, gx + shakeX, gy, cell, d.src === "key" ? 0.78 : 0.5);
      for (const [cx, cy] of p.shape.cells) {
        rr(ctx, gx + shakeX + cx * cell + 2, gy + cy * cell + 2, cell - 4, cell - 4, 11);
        if (!d.valid) { ctx.fillStyle = "rgba(239,68,68,0.45)"; ctx.fill(); ctx.strokeStyle = "#fecaca"; }
        else ctx.strokeStyle = `rgba(255,255,255,${0.75 + 0.25 * Math.sin(now * 9)})`;
        ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
  }
  // particles
  for (const p of PARTS) if (p.live) {
    const u = p.t / p.max;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    if (p.kind === 1) { const s = p.size * (1 - u * 0.5); star(ctx, s, s * 0.38); ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = "#92400e"; ctx.lineWidth = 1.4; ctx.stroke(); }
    else { const s = p.size * (p.kind === 2 ? 1 : 1 - u * 0.4); rr(ctx, -s / 2, -s / 2, s, p.kind === 2 ? s * 0.6 : s, 2.5); ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.restore();
  }
  drawArchieHere(now);

  // tray pieces
  for (let i = 0; i < 3; i++) {
    const p = S.tray[i];
    if (!p) continue;
    const tp = trayPos(p, i), s = slotRect(i);
    const held = d && d.i === i;
    if (held && d.src === "key") { rr(ctx, s.x + 8, s.y + 8, s.w - 16, s.h - 16, 14); ctx.fillStyle = "rgba(253,224,71,0.22)"; ctx.fill(); ctx.strokeStyle = "#fde047"; ctx.lineWidth = 3; ctx.stroke(); }
    if (held && d.src === "pointer") continue;
    const fits = S.demo || L.fitsAnywhere(S.board, p.shape);
    let x = tp.x, y = tp.y, cs = tp.cs, alpha = fits ? 1 : 0.4;
    if (p.ret) { const k = clamp((now - p.ret.t0) / 0.2, 0, 1), e = ease.out(k); x = lerp(p.ret.x, tp.x, e); y = lerp(p.ret.y, tp.y, e); cs = lerp(p.ret.cs, tp.cs, e); if (k >= 1) p.ret = null; }
    const b = clamp((now - p.born) / 0.24, 0, 1);
    if (b <= 0) continue;
    if (b < 1) { const e = ease.back(b); x += (p.shape.w * cs * (1 - e)) / 2; y += (p.shape.h * cs * (1 - e)) / 2; cs *= e; }
    if (S.ending && !S.ending.won && S.ending.why === "stuck") x += Math.sin(now * 40 + i) * 2.5 * clamp(1 - (now - S.ending.t0) / 0.6, 0, 1);
    drawPiece(p, x, y, cs, alpha);
  }
  // the piece in the hand
  if (d && d.src === "pointer" && S.tray[d.i]) {
    const p = S.tray[d.i];
    for (const [cx, cy] of p.shape.cells) { rr(ctx, d.x + cx * d.cs + 7, d.y + cy * d.cs + 13, d.cs - 4, d.cs - 4, 11); ctx.fillStyle = "rgba(8,10,30,0.22)"; ctx.fill(); }
    drawPiece(p, d.x, d.y, d.cs);
  }
  // would-be sums while a piece hovers, then the count-up of real clears
  if (d) for (const l of d.lines) {
    const q = chipXY(l);
    const w = drawChip(q.x, q.y, l.xs ? `${l.sum}+${l.xs > 1 ? l.xs : ""}x` : l.sum, l.j.ok ? "gold" : S.sumGoal && !l.xs && S.want(l.sum) ? "hit" : "", 1 + 0.05 * Math.sin(now * 9));
    drawTag(l, q, w, now);
  }
  for (const ch of S.chips) drawCount(ch, now);
  for (const f of S.floats) {
    const u = (now - f.t0) / f.dur;
    if (u < 0) continue;
    const pop = ease.back(clamp(u / (0.14 / f.dur * 1.6), 0, 1)), y = f.y - 8 * ease.out(u);
    ctx.font = `900 ${f.size}px ${FONT}`;
    let half = ctx.measureText(f.text).width / 2;
    if (f.sub) { ctx.font = `900 ${f.size * 0.74}px ${FONT}`; half = Math.max(half, ctx.measureText(f.sub).width / 2); }
    const fit = Math.min(1, (W - 16) / (half * 2));
    ctx.save(); ctx.translate(clamp(f.x, half * fit + 8, W - half * fit - 8), y); ctx.scale(pop * fit, pop * fit); ctx.globalAlpha = clamp(((1 - u) * f.dur) / 0.3, 0, 1);
    text(ctx, f.text, 0, 0, f.size, f.color, { stroke: "#0b1437", sw: 8 });
    if (f.sub) text(ctx, f.sub, 0, f.size * 1.02, f.size * 0.74, "#ffffff", { stroke: "#0b1437", sw: 6 });
    ctx.restore();
  }
  ctx.setTransform(c.scale, 0, 0, c.scale, 0, 0);
}

// ---------- poster: one composed hero shot, no HUD and no words (framed for a square crop of the center) ----------
let posterOn = false;
function drawPoster() {
  const W = dim.W, H = dim.H, r = math.rng(5);
  ctx.setTransform(c.scale, 0, 0, c.scale, 0, 0);
  paintDesk(ctx, W, H, math.rng(77), dim.p ? 7 : 5);
  const mx = W / 2, cell = 52, bx = -cell * 3.1, by = -cell * 3.2;
  ctx.save(); ctx.translate(mx + 70, H * 0.5 + 118); ctx.rotate(-0.09);
  paintBoard(ctx, bx, by, cell, 15, r);
  const rows = ["........", "..6.....", ".66..3..", "GGGGGGGG", "11.777.4", "115577.4", "9955.888"];
  const digs = [3, 5, 1, 7, 2, 4, 6, 2];
  const save = LAY.cell; LAY.cell = cell;
  rows.forEach((s, rw) => [...s].forEach((ch, cl) => {
    if (ch === ".") return;
    const x = bx + cl * cell, y = by + rw * cell;
    if (ch === "G") {
      rr(ctx, x - 3, y - 3, cell + 6, cell + 6, 14); ctx.fillStyle = "rgba(253,224,71,0.55)"; ctx.fill();
      drawTile(2, digs[cl], x, y - 4, cell);
    } else drawTile(+ch, 1 + Math.floor(r() * 9), x, y, cell);
  }));
  rr(ctx, bx - 6, by + 3 * cell - 8, cell * 8 + 12, cell + 12, 18); ctx.strokeStyle = "#fde047"; ctx.lineWidth = 6; ctx.stroke();
  // the piece in the hand, on its way down
  const piece = { shape: L.SHAPE.c4, color: 3, digits: [4, 1, 5] };
  ctx.save(); ctx.translate(bx + cell * 5.2, by - cell * 0.2); ctx.rotate(0.14);
  for (const [cx, cy] of piece.shape.cells) { rr(ctx, cx * cell + 12, cy * cell + 22, cell - 4, cell - 4, 12); ctx.fillStyle = "rgba(4,6,24,0.3)"; ctx.fill(); }
  drawPiece(piece, 0, 0, cell);
  ctx.restore();
  for (let k = 0; k < 10; k++) {
    const sx = bx + r() * cell * 8, sy = by + cell * 3.5 + (k % 2 ? -1 : 1) * cell * (0.62 + r() * 0.5), sz = 8 + r() * 12;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(r() * 3); star(ctx, sz, sz * 0.4); ctx.fillStyle = k % 3 ? GOLD : "#fff7cc"; ctx.fill(); ctx.strokeStyle = "#92400e"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  LAY.cell = save;
  ctx.restore();
  const ax = mx - 150, ay = H * 0.5 + 92, as = 200;
  ctx.beginPath(); ctx.ellipse(ax, ay + as * 0.39, as * 0.4, as * 0.07, 0, 0, 7); ctx.fillStyle = "rgba(8,3,0,0.45)"; ctx.fill();
  drawArchie(ctx, ax, ay, as, { pose: "happy", look: { x: 0.8, y: 0.1 }, blink: false, t: 0.4 });
}

// ---------- menu extras: mode pick and level select ----------
const STAR = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : ""}"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z"/></svg>`;
const starsHtml = (n) => STAR(n >= 1) + STAR(n >= 2) + STAR(n >= 3);
function buildMenu(el) {
  if (!el) return;
  sel.mode = g.load("mode", "endless");
  const paint = () => {
    const pr = progress(), done = Object.keys(pr).length, open = sel.level ?? firstOpen();
    el.innerHTML = `<div class="sb-modes">
      <button class="sb-mode ${sel.mode === "endless" ? "on" : ""}" data-m="endless"><b>Endless</b><span>${g.best ? "Best " + g.best : "Play for a high score"}</span></button>
      <button class="sb-mode ${sel.mode === "target" ? "on" : ""}" data-m="target"><b>Target</b><span>${done ? `${done} of 30 levels clear` : "30 levels, one goal each"}</span></button>
    </div>${sel.mode === "target" ? `<p class="sb-next">Level ${open + 1}: ${L.goalText(L.LEVELS[open])}. <button class="sb-link" data-levels>All levels</button></p>` : ""}`;
  };
  paint();
  el.onclick = (e) => {
    const m = e.target.closest("[data-m]")?.dataset.m;
    if (m) { sel.mode = m; sel.level = null; g.save("mode", m); sfx.play("click"); paint(); }
    if (e.target.closest("[data-levels]")) { sfx.play("click"); levelSelect(); }
  };
}
function levelSelect() {
  const pr = progress(), max = unlockedUpTo();
  const card = g.panel(`<h2>Target levels</h2><p class="ak-tag">One goal per level. Use fewer pieces for more stars.</p>
    <div class="sb-grid">${L.LEVELS.map((lv, i) => `<button class="sb-lv ${pr[i] ? "done" : ""}" data-l="${i}" ${i > max ? "disabled" : ""} title="${L.goalText(lv)}"><b>${i + 1}</b><span class="sb-stars">${starsHtml(pr[i] || 0)}</span></button>`).join("")}</div>
    <p class="sb-tip">&nbsp;</p>
    <button class="ak-btn ak-ghost" data-a="quit">Back</button>`, "ak-wide sb-levels");
  const tip = card.querySelector(".sb-tip");
  card.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-l]"); if (b) tip.textContent = b.disabled ? "Clear earlier levels to open this one." : `Level ${+b.dataset.l + 1}: ${b.title}`; });
  card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-l]");
    if (!b || b.disabled) return;
    sel.mode = "target"; sel.level = +b.dataset.l; g.save("mode", "target");
    sfx.play("click");
    g.start();
  });
}

const clearToasts = () => { const t = g.stage.querySelector(".ak-toasts"); if (t) t.innerHTML = ""; };
g.onStart = () => {
  clearToasts();
  posterOn = false;
  sel.mode = g.load("mode", "endless");
  if (sel.mode === "target") {
    const idx = sel.level ?? firstOpen();
    sel.level = idx;
    newRun("target", idx);
    g.toast(`Level ${idx + 1}: ${L.goalText(L.LEVELS[idx])}`, 3000);
  } else newRun("endless");
  g.score = 0;
  updateWorry();
};

// A pretty board behind the menu before the first run.
newRun("endless", null, true);
{
  const r = math.rng(11);
  const rows = ["........", "........", "........", "..33....", "..3..66.", "55...66.", "5577.111", "5577.888"];
  rows.forEach((s, rw) => [...s].forEach((ch, cl) => { if (ch !== ".") S.board[rw * 8 + cl] = { d: 1 + Math.floor(r() * 9), c: +ch }; }));
  S.score = S.shown = 0;
}
refit();
buildMenu(g.menuExtra);
g.loop(update, render);

// Test hooks.
g.debug = {
  get S() { return S; },
  get board() { return S.board.map((x) => (x ? x.d : 0)); },
  get tray() { return S.tray.map((p) => (p ? { id: p.shape.id, digits: p.digits.slice(), w: p.shape.w, h: p.shape.h } : null)); },
  get layout() { return LAY; },
  place: (i, col, row) => place(i, col, row),
  fits: (i) => (S.tray[i] ? L.allFits(S.board, S.tray[i].shape) : []),
  setBoard(rows) { rows.forEach((s, rw) => [...s].forEach((ch, cl) => { S.board[rw * 8 + cl] = ch === "." || ch === "0" ? null : { d: ch === "x" ? L.XT : +ch, c: (rw + cl) % 10 }; })); S.guide = null; updateWorry(); },
  setTray(list) { list.forEach((t, i) => { S.tray[i] = t ? { shape: L.SHAPE[t.id], color: L.SHAPE[t.id].color, digits: t.digits || L.SHAPE[t.id].cells.map(() => 1), born: -9, ret: null } : null; }); S.guide = null; updateWorry(); },
  startLevel(i) { g.save("mode", "target"); sel.level = i; g.start(); },
  startEndless() { g.save("mode", "endless"); g.start(); },
  slot: (i) => { const s = slotRect(i); return { fx: (s.x + s.w / 2) / LAY.W, fy: (s.y + s.h / 2) / LAY.H }; },
  setRule(rule) { S.rule = rule; },
  /** One composed hero shot for the tile art. Stays until the next start. */
  poster() { posterOn = true; S.drag = null; refit(); g.redraw(); },
  logic: L,
};
