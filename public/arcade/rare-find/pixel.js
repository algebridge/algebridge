// Rare Find pixel art, all drawn in code on tiny canvases that CSS scales up with crisp pixels:
// a 5 x 7 bitmap font, pixel Archie with poses, the starfield, confetti and the poster.

export const COL = {
  ink: "#060a1f", night: "#0a0f2e", navy: "#121a4a", deep: "#1a2468", line: "#3d4bb8",
  white: "#f4f6ff", cyan: "#3fe0ff", green: "#5cf08a", pink: "#ff5cc8", gold: "#ffd23f", red: "#ff5a5a", orange: "#ff9a3d",
};
export const TIER_COL = [COL.cyan, COL.green, COL.pink, COL.gold];
/** The color of block i (0..9) on the rarity meter. */
export const meterColor = (i) => TIER_COL[i < 3 ? 0 : i < 6 ? 1 : i < 8 ? 2 : 3];

// ---------- bitmap font: 5 wide, 7 tall, one number per row ----------
const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 14], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0], "+": [0, 4, 4, 31, 4, 4, 0], "-": [0, 0, 0, 31, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12],
  "!": [4, 4, 4, 4, 4, 0, 4], "?": [14, 17, 1, 2, 4, 0, 4], "/": [1, 1, 2, 4, 8, 16, 16], ":": [0, 12, 12, 0, 12, 12, 0], "'": [4, 4, 8, 0, 0, 0, 0],
};
export const textWidth = (s) => Math.max(0, String(s).length * 6 - 1);
/** Draws text with its top-left corner at (x, y). One font pixel is `scale` canvas pixels. */
export function drawText(ctx, s, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = GLYPHS[ch] || GLYPHS["?"];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r] & (16 >> c)) ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
    cx += 6 * scale;
  }
}
/** HTML for a word in the bitmap font. Call paintText(root) after it is in the page. */
export const px = (text, cls = "", color = COL.white, shadow = COL.ink) =>
  `<canvas class="px ${cls}" data-t="${String(text).replace(/"/g, "")}" data-c="${color}" data-s="${shadow}" role="img" aria-label="${String(text).replace(/"/g, "")}"></canvas>`;
export function paintText(root) {
  for (const c of root.querySelectorAll("canvas.px[data-t]")) {
    const t = c.dataset.t;
    if (c._t === t + c.dataset.c) continue;
    c._t = t + c.dataset.c;
    c.width = textWidth(t) + 1;
    c.height = 8;
    c.style.setProperty("--w", c.width);
    const ctx = c.getContext("2d");
    if (c.dataset.s !== "none") drawText(ctx, t, 1, 1, c.dataset.s);
    drawText(ctx, t, 0, 0, c.dataset.c);
  }
}
export function setText(canvas, text, color) {
  canvas.dataset.t = String(text);
  if (color) canvas.dataset.c = color;
  canvas.setAttribute("aria-label", String(text));
  paintText(canvas.parentElement);
}

// ---------- pixel Archie: the arch of a bridge with a face, on a 40 x 40 grid ----------
export const SKINS = [
  { id: "classic", name: "Classic", body: "#2f6bff", shade: "#1b3fc4", light: "#86b4ff" },
  { id: "mint", name: "Mint", need: 20, body: "#2dd4a7", shade: "#0f9b7a", light: "#a6f7e0" },
  { id: "coral", name: "Coral", need: 60, body: "#ff6b5e", shade: "#c93a3a", light: "#ffb9a8" },
  { id: "grape", name: "Grape", need: 110, body: "#a855f7", shade: "#7426c9", light: "#dcbcff" },
  { id: "gold", name: "Gold", need: 170, body: "#ffc21a", shade: "#d18a00", light: "#fff2a8" },
  { id: "ghost", name: "Ghost", need: 240, body: "#e8ecff", shade: "#a9b3e6", light: "#ffffff" },
  { id: "royal", name: "Royal", need: 320, body: "#2f6bff", shade: "#1b3fc4", light: "#86b4ff", hat: "crown" },
  { id: "wizard", name: "Wizard", need: 420, body: "#4a3fd6", shade: "#2f2596", light: "#9d95ff", hat: "wizard" },
];
export const skinOf = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

const SW = 40, SH = 40;
const grid = new Uint8Array(SW * SH);
const E = 0, BODY = 1, SHADE = 2, LIGHT = 3, OUT = 4, WHITE = 5, INK = 6, CHEEK = 7, HAT = 8, HAT2 = 9, TEAR = 10, TONGUE = 11, BUB = 12;
const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < SW && y < SH) grid[y * SW + x] = v; };
const get = (x, y) => (x >= 0 && y >= 0 && x < SW && y < SH ? grid[y * SW + x] : E);
const rect = (x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, v); };
/** Both sides at once: (x, y) on the left and its mirror on the right. */
const both = (x, y, v) => { put(x, y, v); put(SW - 1 - x, y, v); };

/**
 * pose: "idle" | "think" | "cheer" | "sad" | "wave". t in seconds drives blinking, bobbing and waving.
 * Draws the 40 x 40 sprite with its top-left at (ox, oy); one sprite pixel is `scale` canvas pixels.
 */
export function drawArchie(ctx, ox, oy, { pose = "idle", t = 0, skin = SKINS[0], scale = 1, shadow = true } = {}) {
  grid.fill(E);
  const f2 = Math.floor(t * 2) % 2, f8 = Math.floor(t * 8);
  let jump = 0, sq = 0;
  if (pose === "cheer") jump = [0, 2, 4, 2][f8 % 4];
  else if (pose === "sad") sq = 1;
  const breathe = pose !== "cheer" && pose !== "sad" && Math.floor(t * 1.3) % 2 === 1 ? 1 : 0;
  const cy = 19 + sq + breathe - jump, foot = 34 - jump;
  const inside = (x, y) => {
    if (x < 9 || x > 30 || y > foot) return false;
    if (y < cy) { const dx = x + 0.5 - 20, dy = y + 0.5 - cy; return dx * dx + dy * dy <= 11.3 * 11.3; }
    if (y === foot && (x === 9 || x === 30 || x === 15 || x === 24)) return false;
    if (y >= foot - 6 && x >= 16 && x <= 23) return false;
    if (y === foot - 7 && x >= 17 && x <= 22) return false;
    return true;
  };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (!inside(x, y)) continue;
    const dx = x + 0.5 - 20, dy = y + 0.5 - cy;
    let v = BODY;
    if (y < cy) {
      const d = Math.hypot(dx, dy);
      if (dx > 6.5 && d > 7.5) v = SHADE;
      else if (dx < -3 && dy < -3 && d > 7.2 && d < 9.4) v = LIGHT;
    } else if (x >= 28 || y === foot || (x === 15 && y >= foot - 5)) v = SHADE;
    else if (x === 11 && y <= cy + 5) v = LIGHT;
    put(x, y, v);
  }
  // arms and hands (body pixels, so the outline pass wraps them)
  const arm = (pts, hx, hy, right) => {
    const m = (x) => (right ? SW - 1 - x : x);
    for (const [x, y] of pts) put(m(x), y, right ? SHADE : BODY);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) put(m(hx + i), hy + j, BODY);
  };
  const down = (right, drop = 0) => arm([[8, cy + 4], [7, cy + 5], [7, cy + 6 + drop]], 6, cy + 7 + drop, right);
  const up = (right, k = 0) => arm([[8, cy + 2], [7, cy + 1], [6, cy], [6, cy - 1 - k]], 5, cy - 3 - k, right);
  if (pose === "cheer") { up(false, f8 % 2); up(true, (f8 + 1) % 2); }
  else if (pose === "wave") { down(false); arm([[8, cy + 2], [7, cy + 1], [6, cy], [6 - f2, cy - 1]], 5 - f2 * 2, cy - 3, true); }
  else if (pose === "think") { down(false); arm([[8, cy + 3], [7, cy + 2], [6, cy + 1], [6, cy]], 6, cy - 2 - (f8 % 4 === 0 ? 1 : 0), true); }
  else if (pose === "sad") { down(false, 1); down(true, 1); }
  else { down(false); down(true); }
  // hats
  const top = cy - 11;
  if (skin.hat === "crown") {
    rect(14, top - 1, 12, 2, HAT);
    for (const x of [14, 17, 19, 20, 22, 25]) put(x, top - 2, HAT);
    for (const x of [14, 19, 20, 25]) put(x, top - 3, HAT);
    put(16, top, HAT2); put(19, top, HAT2); put(20, top, HAT2); put(23, top, HAT2);
  } else if (skin.hat === "wizard") {
    for (let r = 0; r < 8; r++) rect(20 - Math.ceil((r + 1) * 0.8), top - 7 + r, Math.ceil((r + 1) * 0.8) * 2, 1, HAT);
    rect(11, top + 1, 18, 1, HAT);
    put(19, top - 3, HAT2); put(21, top - 1, HAT2); put(17, top, HAT2);
  }
  // outline: every empty pixel that touches a filled one
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (get(x, y) !== E) continue;
    const n = (a, b) => { const v = get(a, b); return v !== E && v !== OUT; };
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) put(x, y, OUT);
  }
  // face
  const blink = pose !== "sad" && t % 3.4 < 0.13;
  let lx = 0, ly = 0;
  if (pose === "think") { lx = Math.floor(t * 0.9) % 2 ? 1 : -1; ly = -1; }
  if (pose === "sad") ly = 1;
  if (pose === "cheer") ly = -1;
  for (const ex of [13, 23]) {
    if (blink) { rect(ex, cy - 2, 4, 1, OUT); continue; }
    if (pose === "cheer") { rect(ex, cy - 3, 4, 1, OUT); put(ex, cy - 2, OUT); put(ex + 3, cy - 2, OUT); continue; }
    rect(ex, cy - 4, 4, 4, WHITE);
    rect(ex + 1 + lx, cy - 3 + ly, 2, 2, INK);
  }
  if (pose === "sad") { put(13, cy - 6, OUT); put(14, cy - 6, OUT); put(15, cy - 5, OUT); put(26, cy - 6, OUT); put(25, cy - 6, OUT); put(24, cy - 5, OUT); }
  both(11, cy + 1, CHEEK); both(12, cy + 1, CHEEK);
  if (pose === "cheer") {
    rect(17, cy + 1, 6, 3, OUT); put(17, cy + 3, BODY); put(22, cy + 3, BODY); put(19, cy + 3, TONGUE); put(20, cy + 3, TONGUE);
  } else if (pose === "sad") {
    put(17, cy + 4, OUT); put(22, cy + 4, OUT); rect(18, cy + 3, 4, 1, OUT);
    const drop = Math.floor(t * 5) % 7;
    if (drop < 5) { put(13, cy + drop, TEAR); if (drop > 0) put(13, cy + drop - 1, TEAR); }
  } else if (pose === "think") {
    rect(20, cy + 2, 3, 1, OUT);
    const n = Math.floor(t * 2.5) % 4;
    if (n >= 1) put(33, cy - 7, BUB);
    if (n >= 2) rect(35, cy - 10, 2, 2, BUB);
    if (n >= 3) rect(36, cy - 15, 3, 3, BUB);
  } else {
    put(17, cy + 2, OUT); put(22, cy + 2, OUT); rect(18, cy + 3, 4, 1, OUT);
  }
  // paint
  const pal = [null, skin.body, skin.shade, skin.light, COL.ink, COL.white, COL.ink, "#ff9ad5", skin.hat === "wizard" ? "#7c3aed" : COL.gold, skin.hat === "wizard" ? COL.gold : COL.red, COL.cyan, "#ff7aa8", COL.white];
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    const k = Math.min(4, jump);
    ctx.fillRect(ox + (10 + k) * scale, oy + 36 * scale, (20 - k * 2) * scale, scale);
    ctx.fillRect(ox + (8 + k) * scale, oy + 37 * scale, (24 - k * 2) * scale, scale);
  }
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const v = grid[y * SW + x];
    if (!v) continue;
    ctx.fillStyle = pal[v];
    ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
  }
}

// ---------- starfield ----------
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function drawSky(ctx, w, h, t = 0, { floor = true, drift = 1 } = {}) {
  const bands = [COL.ink, "#080c26", COL.night, "#0d1338", "#101742"];
  for (let i = 0; i < bands.length; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, Math.floor((h * i) / bands.length), w, Math.ceil(h / bands.length) + 1); }
  // dither between bands
  for (let i = 1; i < bands.length; i++) {
    const y = Math.floor((h * i) / bands.length);
    ctx.fillStyle = bands[i];
    for (let x = (i % 2); x < w; x += 2) ctx.fillRect(x, y - 1, 1, 1);
    for (let x = ((i + 1) % 4); x < w; x += 4) ctx.fillRect(x, y - 2, 1, 1);
  }
  const n = Math.round((w * h) / 150);
  for (let i = 0; i < n; i++) {
    const layer = i % 3;
    const sx = hash(i) * w - t * drift * (0.6 + layer * 0.9);
    const x = Math.floor(((sx % w) + w) % w), y = Math.floor(hash(i + 0.5) * h);
    const tw = Math.floor(t * 1.5 + hash(i + 0.25) * 9) % 6 === 0;
    ctx.fillStyle = tw ? "#4a56a8" : layer === 2 ? COL.white : layer === 1 ? "#9fb0ff" : "#5c6bd0";
    ctx.fillRect(x, y, 1, 1);
    if (i % 23 === 0 && !tw) { ctx.fillStyle = i % 46 === 0 ? COL.cyan : COL.gold; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = COL.white; ctx.fillRect(x, y, 1, 1); }
  }
  if (floor) drawFloor(ctx, w, h);
}
export function drawFloor(ctx, w, h, top = Math.floor(h * 0.88)) {
  ctx.fillStyle = "#1c2580"; ctx.fillRect(0, top, w, h - top);
  ctx.fillStyle = "#5568ff"; ctx.fillRect(0, top, w, 1);
  ctx.fillStyle = "#2a36a8"; ctx.fillRect(0, top + 1, w, 1);
  ctx.fillStyle = "#151c66";
  for (let y = top + 3; y < h; y += 2) for (let x = (y % 4 ? 0 : 2); x < w; x += 4) ctx.fillRect(x, y, 2, 1);
}

// ---------- confetti, sparkles and floating numbers on a low resolution canvas ----------
export function makeFx(max = 180) {
  const parts = [];
  const texts = [];
  const CONF = [COL.cyan, COL.green, COL.pink, COL.gold, COL.white, COL.orange];
  return {
    burst(x, y, n, { colors = CONF, speed = 60, up = 50, spark = false } = {}) {
      for (let i = 0; i < n && parts.length < max; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: 0.7 + Math.random() * 0.9, c: colors[(Math.random() * colors.length) | 0], s: Math.random() < 0.3 ? 2 : 1, spark });
      }
    },
    rain(w, n) {
      for (let i = 0; i < n && parts.length < max; i++) parts.push({ x: Math.random() * w, y: -2 - Math.random() * 30, vx: (Math.random() - 0.5) * 14, vy: 20 + Math.random() * 30, life: 2.2 + Math.random(), c: CONF[(Math.random() * CONF.length) | 0], s: Math.random() < 0.4 ? 2 : 1, rain: true });
    },
    text(s, x, y, color) { texts.push({ s, x, y, color, life: 1.1 }); },
    clear() { parts.length = 0; texts.length = 0; },
    get busy() { return parts.length + texts.length > 0; },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        if (!p.rain) p.vy += 130 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i--) { const q = texts[i]; q.life -= dt; q.y -= 14 * dt; if (q.life <= 0) texts.splice(i, 1); }
    },
    draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        if (p.life < 0.25 && Math.floor(p.life * 30) % 2) continue;
        ctx.fillStyle = p.c;
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.spark) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
        else ctx.fillRect(x, y, p.s, p.s);
      }
      for (const q of texts) {
        if (q.life < 0.3 && Math.floor(q.life * 24) % 2) continue;
        const x = Math.round(q.x - textWidth(q.s) / 2), y = Math.round(q.y);
        drawText(ctx, q.s, x + 1, y + 1, COL.ink);
        drawText(ctx, q.s, x, y, q.color);
      }
    },
  };
}

// ---------- shapes for the poster ----------
export function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1);
  if (r > 1) { ctx.fillStyle = COL.white; ctx.fillRect(x, y, 1, 1); }
}
export function gem(ctx, x, y, color, light) {
  const rows = [[2, 3], [1, 5], [0, 7], [1, 5], [2, 3], [3, 1]];
  rows.forEach(([o, n], j) => { ctx.fillStyle = COL.ink; ctx.fillRect(x + o - 1, y + j, n + 2, 1); });
  ctx.fillStyle = COL.ink; ctx.fillRect(x + 2, y - 1, 3, 1); ctx.fillRect(x + 3, y + 6, 1, 1);
  rows.forEach(([o, n], j) => { ctx.fillStyle = color; ctx.fillRect(x + o, y + j, n, 1); });
  ctx.fillStyle = light; ctx.fillRect(x + 2, y, 2, 1); ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + 2, 1, 1);
}
/** One composed hero shot with no words: Archie cheering beside a full rarity meter, gems and sparkles. */
export function drawPoster(ctx, w, h, skin) {
  drawSky(ctx, w, h, 3.3, { floor: false });
  const u = 64, x0 = Math.floor((w - u) / 2), y0 = h - u; // compose inside a 64 x 64 square, bottom center
  drawFloor(ctx, w, h, y0 + 54);
  // confetti first, so it falls behind Archie and the meter (the top 30% stays calm for the logo)
  const conf = [COL.cyan, COL.green, COL.pink, COL.gold, COL.orange];
  for (let i = 0; i < 26; i++) {
    const cx = x0 + Math.floor(hash(i + 70) * 64), cy = y0 + 20 + Math.floor(hash(i + 90) * 32);
    ctx.fillStyle = conf[i % conf.length]; ctx.fillRect(cx, cy, 1, 1);
  }
  // the rarity meter: a tall frame with ten blocks, filled to the top
  const mx = x0 + 44, my = y0 + 22;
  ctx.fillStyle = COL.ink; ctx.fillRect(mx - 2, my - 1, 13, 35); ctx.fillRect(mx - 1, my - 2, 11, 37);
  ctx.fillStyle = COL.white; ctx.fillRect(mx - 1, my - 1, 11, 35);
  ctx.fillStyle = COL.navy; ctx.fillRect(mx, my, 9, 33);
  for (let i = 0; i < 10; i++) {
    const by = my + 30 - i * 3;
    ctx.fillStyle = meterColor(i); ctx.fillRect(mx + 1, by, 7, 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(mx + 1, by, 2, 1);
  }
  // pedestal steps under the meter
  ctx.fillStyle = COL.ink; ctx.fillRect(mx - 5, y0 + 55, 19, 1);
  ctx.fillStyle = COL.line; ctx.fillRect(mx - 4, y0 + 56, 17, 2);
  // gems as pickups, rarer toward the top right
  gem(ctx, x0 + 33, y0 + 44, COL.cyan, "#c9f6ff");
  gem(ctx, x0 + 3, y0 + 41, COL.green, "#d5ffe2");
  gem(ctx, x0 + 55, y0 + 26, COL.pink, "#ffd0ef");
  gem(ctx, x0 + 34, y0 + 23, COL.gold, "#fff6c2");
  // Archie, large, a little left of center and low
  drawArchie(ctx, x0 + 2, y0 + 19, { pose: "cheer", t: 0.26, skin });
  // sparkles
  for (const [sx, sy, r, c] of [[42, 20, 2, COL.gold], [58, 21, 1, COL.white], [29, 25, 1, COL.gold], [3, 26, 1, COL.cyan], [60, 40, 1, COL.pink], [38, 33, 1, COL.white], [18, 21, 1, COL.pink], [51, 19, 1, COL.cyan]]) sparkle(ctx, x0 + sx, y0 + sy, r, c);
}
