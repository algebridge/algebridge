// Sneaky Floors: the chalk drawing routine. Everything on the board is a wobbly double stroke that can
// "boil" (re-jitter) and draw itself in stroke by stroke. Archie is drawn with it too.
export const CHALK = "#f4f1e6", BLUE = "#8cc4ff", YEL = "#ffe27a", PINK = "#ff9a9a";
const h = (a, b = 0, c = 0) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return v - Math.floor(v); };
const cl = (v) => Math.max(0, Math.min(1, v));
const DASH = [19, 1.35, 11, 1.2, 31, 1.45, 8, 1.25];
const dashFor = new Map();
function dash(w) { const key = Math.round(w * 4); let d = dashFor.get(key); if (!d) { d = DASH.map((v) => v * w); if (dashFor.size < 200) dashFor.set(key, d); } return d; }

// ---------- point builders (a stroke is a list of [x, y]) ----------
export function line(x1, y1, x2, y2, step = 10) {
  const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step)), out = [];
  for (let i = 0; i <= n; i++) out.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  return out;
}
export function poly(v, step = 10) {
  const out = [];
  for (let i = 0; i + 3 < v.length; i += 2) { const s = line(v[i], v[i + 1], v[i + 2], v[i + 3], step); if (i) s.shift(); out.push(...s); }
  return out;
}
export function arc(cx, cy, rx, ry, a0, a1, n = 0) {
  n = n || Math.max(6, Math.round((Math.abs(a1 - a0) * Math.max(rx, ry)) / 7));
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}
export function quad(x0, y0, cx, cy, x1, y1, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; out.push([v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]); }
  return out;
}
export const rectPts = (x, y, w, hh, step = 10) => poly([x, y, x + w, y, x + w, y + hh, x, y + hh, x, y], step);

/**
 * One chalk stroke. o: color, width, seed, boil (int: change it to re-jitter), amp (wobble), prog (0..1, how much
 * of the stroke is drawn so far), alpha, double (second lighter pass), close, i0 (index offset so a slice of a longer
 * line keeps its wobble).
 */
export function chalkStroke(k, pts, o = {}) {
  const { color = CHALK, width = 3, seed = 1, boil = 0, amp = 1, prog = 1, alpha = 1, double = true, close = false, i0 = 0 } = o;
  if (prog <= 0 || pts.length < 2) return;
  const last = (pts.length - 1) * Math.min(1, prog), n = Math.floor(last), fr = last - n, base = k.globalAlpha;
  k.save(); k.lineCap = "round"; k.lineJoin = "round"; k.strokeStyle = color;
  for (let pass = 0; pass < (double ? 2 : 1); pass++) {
    const sd = seed * 7.13 + pass * 31.7 + boil * 3.91, a = pass ? amp * 1.8 : amp;
    const jit = (i, ax) => { const u = (i + i0) / 3, f0 = Math.floor(u), f = u - f0; return (h(sd, f0, ax) * (1 - f) + h(sd, f0 + 1, ax) * f - 0.5) * 2 * a; };
    k.globalAlpha = base * alpha * (pass ? 0.45 : 0.95);
    k.lineWidth = pass ? width * 0.55 : width;
    k.setLineDash(pass ? [] : dash(k.lineWidth));
    k.beginPath();
    for (let i = 0; i <= n; i++) { const p = pts[i], x = p[0] + jit(i, 1), y = p[1] + jit(i, 2); if (i) k.lineTo(x, y); else k.moveTo(x, y); }
    if (fr > 0 && n + 1 < pts.length) { const p = pts[n], q = pts[n + 1]; k.lineTo(p[0] + (q[0] - p[0]) * fr + jit(n + fr, 1), p[1] + (q[1] - p[1]) * fr + jit(n + fr, 2)); }
    else if (close && prog >= 1) k.closePath();
    k.stroke();
  }
  k.restore();
}
export function chalkDot(k, x, y, r, color = CHALK, seed = 1, boil = 0) {
  k.save(); k.fillStyle = color; k.globalAlpha *= 0.95;
  k.beginPath(); k.ellipse(x + (h(seed, boil, 1) - 0.5) * r * 0.25, y + (h(seed, boil, 2) - 0.5) * r * 0.25, r * (0.94 + h(seed, boil, 3) * 0.14), r * (0.94 + h(seed, boil, 4) * 0.14), 0, 0, 6.3); k.fill();
  k.restore();
}

// ---------- Archie, in chalk ----------
// Same arch as the mascot (kit/archie.js), sampled into a stroke. Local box is 120 x 120, center (60, 60).
const BODY = (() => {
  const out = []; let x = 22, y = 60;
  const L = (x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x, y1 - y) / 7)); for (let i = 1; i <= n; i++) out.push([x + ((x1 - x) * i) / n, y + ((y1 - y) * i) / n]); x = x1; y = y1; };
  const C = (a, b, c, d, x1, y1, n = 9) => { for (let i = 1; i <= n; i++) { const u = i / n, v = 1 - u; out.push([v * v * v * x + 3 * v * v * u * a + 3 * v * u * u * c + u * u * u * x1, v * v * v * y + 3 * v * v * u * b + 3 * v * u * u * d + u * u * u * y1]); } x = x1; y = y1; };
  const Q = (a, b, x1, y1, n = 3) => { for (let i = 1; i <= n; i++) { const u = i / n, v = 1 - u; out.push([v * v * x + 2 * v * u * a + u * u * x1, v * v * y + 2 * v * u * b + u * u * y1]); } x = x1; y = y1; };
  out.push([x, y]);
  C(22, 32, 39, 15, 60, 15); C(81, 15, 98, 32, 98, 60); L(98, 97); Q(98, 104, 91, 104); L(81, 104); Q(74, 104, 74, 97); L(74, 95);
  C(74, 88.5, 67.7, 84, 60, 84, 5); C(52.3, 84, 46, 88.5, 46, 95, 5); L(46, 97); Q(46, 104, 39, 104); L(29, 104); Q(22, 104, 22, 97); L(22, 60);
  return out;
})();
function bodyFor(pose, t) {
  if (pose !== "run" && pose !== "jump" && pose !== "fall") return BODY;
  const ph = Math.sin(t * 14);
  return BODY.map(([x, y]) => {
    if (y <= 78) return [x, y];
    const w = cl((y - 78) / 22), left = x < 60;
    if (pose === "run") return [x + (left ? ph : -ph) * 3.5 * w, y - Math.max(0, left ? ph : -ph) * 8 * w];
    if (pose === "jump") return [x + (60 - x) * 0.14 * w, y + 2 * w];
    return [x + (x - 60) * 0.13 * w, y - 2 * w];
  });
}
const ARMS = {
  idle: [[25, 70, 17, 76, 15, 85], [95, 70, 103, 76, 105, 85]],
  jump: [[26, 64, 15, 56, 12, 41], [94, 64, 105, 56, 108, 41]],
  surprised: [[25, 66, 12, 67, 5, 57], [95, 66, 108, 67, 115, 57]],
  shrug: [[25, 68, 9, 76, 7, 57], [95, 68, 111, 76, 113, 57]],
};
function armsFor(pose, t) {
  if (pose === "run") { const s = Math.sin(t * 14) * 9; return [[25, 70, 16, 74 + s, 14, 82 + s], [95, 70, 104, 74 - s, 106, 82 - s]]; }
  if (pose === "fall") { const s = Math.sin(t * 26) * 5; return [[26, 62, 11, 56, 5, 40 + s], [94, 62, 109, 56, 115, 40 - s]]; }
  if (pose === "wave") { const s = Math.sin(t * 9) * 6; return [ARMS.idle[0], [95, 66, 105, 60, 109 + s, 46]]; }
  if (pose === "happy") return ARMS.jump;
  return ARMS[pose] || ARMS.idle;
}
const ACC_COLOR = { cap: PINK, glasses: CHALK, scarf: PINK, crown: YEL };
function accessory(k, kind, color, st, t) {
  const S = (pts, seed, o) => chalkStroke(k, pts, { ...st, color, seed: 60 + seed, ...o });
  if (kind === "cap") {
    S([...arc(60, 24, 29, 19, Math.PI, Math.PI * 2), [31, 24]], 1);
    S(quad(88, 24, 104, 21, 111, 30), 2);
    for (let i = 0; i < 4; i++) S(line(44 + i * 10, 22, 50 + i * 10, 9 + Math.abs(i - 1.5) * 3, 6), 3 + i, { width: st.width * 0.7, alpha: 0.5, double: false });
    chalkDot(k, 60, 5, 2.6, color, 9, st.boil);
  } else if (kind === "glasses") {
    S(arc(47, 48, 10.5, 10.5, 0.2, 6.5), 1); S(arc(73, 48, 10.5, 10.5, 0.2, 6.5), 2);
    S(line(57, 47, 63, 47, 3), 3); S(line(36.5, 46, 25, 43, 5), 4); S(line(83.5, 46, 95, 43, 5), 5);
  } else if (kind === "scarf") {
    const f = Math.sin(t * 9) * 4;
    S(quad(22, 71, 60, 78, 98, 71, 12), 1); S(quad(22, 80, 60, 87, 98, 80, 12), 2);
    for (let i = 0; i < 8; i++) S(line(27 + i * 9.5, 73 + Math.sin(i * 0.45) * 5 - 2, 23 + i * 9.5, 81 + Math.sin(i * 0.45) * 5 - 2, 5), 3 + i, { width: st.width * 0.7, alpha: 0.6, double: false });
    S([[24, 76], [12, 80 + f * 0.4], [2, 86 + f], [-8, 96 + f * 1.4]], 12); S([[24, 81], [14, 88 + f * 0.4], [6, 96 + f], [0, 106 + f * 1.4]], 13);
  } else if (kind === "crown") {
    S(poly([39, 21, 36, 1, 49, 11, 60, -4, 71, 11, 84, 1, 81, 21, 39, 21], 6), 1);
    for (const [x, y] of [[36, 0], [60, -5], [84, 0]]) chalkDot(k, x, y, 2.6, color, x, st.boil);
  }
}

/**
 * Chalk Archie, centered on (cx, cy). opts: pose "idle" | "run" | "jump" | "fall" | "surprised" | "happy" | "shrug" | "wave",
 * look {x,y}, blink, squashX, squashY, rotation, t, flip, color (his chalk), acc "cap" | "glasses" | "scarf" | "crown",
 * accColor, boil (int), draw (0..1: how far the doodle has drawn itself), board (the color behind him), alpha.
 */
export function drawChalkArchie(k, cx, cy, size, o = {}) {
  const { pose = "idle", look = null, blink = false, squashX = 1, squashY = 1, rotation = 0, t = 0, flip = false, color = BLUE, acc = null, accColor = null, boil = 0, draw = 1, board = "#215240", alpha = 1 } = o;
  const s = size / 120, lw = (1.5 + size * 0.022) / s, amp = (0.45 + size * 0.008) / s;
  const st = { width: lw, amp, boil };
  k.save();
  k.globalAlpha *= alpha;
  k.translate(cx, cy); k.rotate(rotation); k.scale(s * squashX * (flip ? -1 : 1), s * squashY); k.translate(-60, -60);
  const body = bodyFor(pose, t), done = draw >= 1;
  // arms: one curved stroke and a small ring for the hand
  const pa = cl((draw - 0.75) / 0.13);
  if (pa > 0) armsFor(pose, t).forEach((a, i) => {
    chalkStroke(k, quad(...a), { ...st, color, seed: 20 + i, prog: pa });
    if (pa >= 1) chalkStroke(k, arc(a[4], a[5], 4.6, 4.6, 0, 6.5, 12), { ...st, color, seed: 24 + i, width: lw * 0.8 });
  });
  // the board shows through a little, then light hatching in his chalk color
  const ph = cl((draw - 0.88) / 0.12);
  if (ph > 0) {
    k.save();
    k.beginPath(); body.forEach((p, i) => (i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1]))); k.closePath();
    k.globalAlpha *= ph; k.fillStyle = board; k.fill();
    k.globalAlpha *= 0.13; k.fillStyle = color; k.fill(); k.globalAlpha /= 0.13;
    k.clip();
    const gap = size < 70 ? 14 : 9, n = Math.round((size < 70 ? 10 : 15) * ph);
    for (let i = 0; i < n; i++) { const d = 26 + i * gap; chalkStroke(k, line(d, 10, d - 50, 108, 16), { ...st, color, seed: 100 + i, width: lw * (size < 70 ? 0.6 : 0.75), alpha: size < 70 ? 0.36 : 0.42, double: false }); }
    k.restore();
  }
  chalkStroke(k, body, { ...st, color, seed: 3, prog: cl(draw / 0.5), close: true });
  if (done) chalkStroke(k, quad(31.5, 48, 33, 33, 49, 24, 6), { ...st, color: CHALK, seed: 5, width: lw * 0.7, alpha: 0.55, double: false });
  // face: chalk-dot eyes and a chalk smile
  const lx = look ? cl((look.x + 1) / 2) * 5 - 2.5 : 0.6, ly = look ? cl((look.y + 1) / 2) * 6 - 3 : 0.8;
  const wide = pose === "surprised" || pose === "fall";
  [47, 73].forEach((x, i) => {
    if (draw < (i ? 0.6 : 0.5)) return;
    if (pose === "happy") chalkStroke(k, quad(x - 6, 51, x, 42, x + 6, 51, 5), { ...st, seed: 30 + i });
    else if (blink) chalkStroke(k, line(x - 5.5, 49, x + 5.5, 49, 4), { ...st, seed: 30 + i });
    else if (wide) { chalkStroke(k, arc(x, 47, 7, 7.6, 0, 6.6, 9), { ...st, seed: 30 + i, width: lw * 0.8 }); chalkDot(k, x + lx * 0.5, 47 + ly * 0.5, 2.5, CHALK, 32 + i, boil); }
    else chalkDot(k, x + lx, 48 + ly, size < 70 ? 5.6 : 4.6, CHALK, 32 + i, boil);
  });
  const pm = cl((draw - 0.62) / 0.13);
  if (pm > 0) {
    if (wide) chalkStroke(k, arc(60, 68, 4.6, 5.4, 0, 6.6, 8), { ...st, seed: 36, prog: pm, width: lw * 0.85 });
    else if (pose === "shrug") chalkStroke(k, [[51, 66], [56, 64.5], [62, 66], [69, 63]], { ...st, seed: 36, prog: pm });
    else chalkStroke(k, quad(51, 62, 60, pose === "happy" ? 75 : 71, 69, 62, 6), { ...st, seed: 36, prog: pm });
    if (pm >= 1) for (const x of [35, 85]) for (let j = 0; j < 2; j++) chalkStroke(k, line(x - 3 + j * 4, 62, x + j * 4, 57, 3), { ...st, color: PINK, seed: 40 + x + j, width: lw * 0.7, alpha: 0.75, double: false });
  }
  if (pose === "surprised" && done) for (const [x1, y1, x2, y2] of [[60, 7, 60, -6], [40, 10, 33, -1], [80, 10, 87, -1]]) chalkStroke(k, line(x1, y1, x2, y2, 5), { ...st, color: CHALK, seed: 50 + x1 });
  if (acc && done) accessory(k, acc, accColor || ACC_COLOR[acc] || CHALK, st, t);
  k.restore();
}

/** The chalk face that taunts the player, big. mood: "flat" | "smirk" | "shock" | "sulk". */
export function chalkFace(k, x, y, r, o = {}) {
  const { mood = "flat", prog = 1, boil = 0, look = { x: 0, y: 0 }, color = CHALK } = o;
  const u = r / 19, st = { width: 2.6 * Math.sqrt(u), amp: 0.7 * Math.sqrt(u), boil, color };
  const P = (a, d) => cl((prog - a) / d);
  k.save(); k.translate(x, y); k.scale(u, u);
  st.width /= u; st.amp /= u;
  chalkStroke(k, arc(0, 0, 19, 19, 0.1, 6.5), { ...st, seed: 1, prog: P(0, 0.55) });
  const ex = look.x * 3, ey = look.y * 2.5;
  if (prog > 0.62) chalkDot(k, -7 + ex, -4 + ey, 2.6, color, 2, boil);
  if (prog > 0.72) chalkDot(k, 7 + ex, -4 + ey, 2.6, color, 3, boil);
  const pm = P(0.78, 0.22);
  if (mood === "smirk") { chalkStroke(k, quad(-8, 7, 2, 14, 10, 3, 6), { ...st, seed: 4, prog: pm }); chalkStroke(k, line(-11, -12, -3, -10, 3), { ...st, seed: 5 }); chalkStroke(k, line(3, -13, 11, -10, 3), { ...st, seed: 6 }); }
  else if (mood === "shock") chalkStroke(k, arc(0, 9, 3.6, 4.4, 0, 6.6, 8), { ...st, seed: 4, prog: pm });
  else if (mood === "sulk") { chalkStroke(k, quad(-7, 11, 0, 5, 7, 11, 6), { ...st, seed: 4, prog: pm }); chalkStroke(k, line(-12, -9, -4, -12, 3), { ...st, seed: 5 }); chalkStroke(k, line(4, -12, 12, -9, 3), { ...st, seed: 6 }); }
  else chalkStroke(k, line(-6, 8, 6, 8, 3), { ...st, seed: 4, prog: pm });
  k.restore();
}

/** What is left of Archie after a fall: a rubbed-out chalk smudge that stays on the board. */
export function chalkSmudge(k, x, y, seed, color = BLUE) {
  k.save(); k.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = (h(seed, i, 1) - 0.5) * 0.9, len = 9 + h(seed, i, 2) * 13, ox = (h(seed, i, 3) - 0.5) * 22, oy = (h(seed, i, 4) - 0.5) * 16;
    k.strokeStyle = i % 3 ? color : CHALK; k.globalAlpha = 0.11 + h(seed, i, 5) * 0.12; k.lineWidth = 7 + h(seed, i, 6) * 9;
    k.beginPath(); k.moveTo(x + ox - Math.cos(a) * len, y + oy - Math.sin(a) * len); k.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); k.stroke();
  }
  k.globalAlpha = 0.5; k.fillStyle = CHALK;
  for (let i = 0; i < 6; i++) { k.beginPath(); k.arc(x + (h(seed, i, 7) - 0.5) * 40, y + (h(seed, i, 8) - 0.5) * 26, 0.8 + h(seed, i, 9) * 1.2, 0, 6.3); k.fill(); }
  k.restore();
  // two tiny crosses where the eyes were
  for (const dx of [-5, 5]) { chalkStroke(k, line(x + dx - 2.2, y - 5, x + dx + 2.2, y - 0.5, 3), { width: 1.6, alpha: 0.6, seed: seed + dx, double: false, amp: 0.3 }); chalkStroke(k, line(x + dx + 2.2, y - 5, x + dx - 2.2, y - 0.5, 3), { width: 1.6, alpha: 0.6, seed: seed + dx + 1, double: false, amp: 0.3 }); }
}
