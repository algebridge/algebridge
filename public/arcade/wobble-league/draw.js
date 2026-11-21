// Wobble League drawing: courts, fixtures, ragdolls and balls. All art is code.
const NAVY = "#1e3a8a", INK = "#0f172a";

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const circ = (ctx, x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); if (fill) { ctx.fillStyle = fill; ctx.fill(); } };
function sky(ctx, W, h, stops) {
  const gr = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = gr; ctx.fillRect(-30, -30, W + 60, h + 60);
}
function cloud(ctx, x, y, s, col = "#ffffff") {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, 7); ctx.arc(x + 22 * s, y - 9 * s, 23 * s, 0, 7); ctx.arc(x + 48 * s, y, 19 * s, 0, 7); ctx.rect(x, y, 48 * s, 18 * s); ctx.fill();
  rr(ctx, x - 18 * s, y + 4 * s, 84 * s, 15 * s, 7 * s); ctx.fill();
}
function floor(ctx, W, H, FLOOR, top, body, edge) {
  ctx.fillStyle = body; ctx.fillRect(-30, FLOOR - 14, W + 60, H - FLOOR + 50);
  ctx.fillStyle = top; ctx.fillRect(-30, FLOOR - 14, W + 60, 16);
  ctx.fillStyle = edge; ctx.fillRect(-30, FLOOR + 2, W + 60, 4);
}

export function drawCourt(ctx, kind, t, W, H, FLOOR) {
  if (kind === "beach") {
    sky(ctx, W, FLOOR, ["#7dd3fc", "#bae6fd", "#fef3c7"]);
    circ(ctx, 770, 104, 62, "rgba(253,224,71,0.35)"); circ(ctx, 770, 104, 44, "#fde047");
    cloud(ctx, 110, 90, 1.1); cloud(ctx, 430, 150, 0.8); cloud(ctx, 600, 70, 0.7);
    ctx.fillStyle = "#38bdf8"; ctx.fillRect(-30, 318, W + 60, FLOOR - 318);
    ctx.fillStyle = "#7dd3fc";
    for (let i = 0; i < 7; i++) { rr(ctx, ((i * 173 + t * 14) % (W + 160)) - 80, 336 + (i % 4) * 26, 70 + (i % 3) * 30, 6, 3); ctx.fill(); }
    // island and palms
    ctx.fillStyle = "#fcd34d"; ctx.beginPath(); ctx.ellipse(210, 322, 120, 20, 0, Math.PI, 0); ctx.fill();
    for (const [px, ph] of [[170, 86], [236, 64]]) {
      ctx.strokeStyle = "#b45309"; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(px, 316); ctx.quadraticCurveTo(px + 12, 316 - ph / 2, px + 4, 316 - ph); ctx.stroke();
      ctx.strokeStyle = "#10b981"; ctx.lineWidth = 9;
      for (let k = 0; k < 5; k++) { const a = -2.7 + k * 0.57; ctx.beginPath(); ctx.moveTo(px + 4, 316 - ph); ctx.quadraticCurveTo(px + 4 + Math.cos(a) * 24, 304 - ph + Math.sin(a) * 20, px + 4 + Math.cos(a) * 40, 322 - ph + Math.sin(a) * 14); ctx.stroke(); }
    }
    floor(ctx, W, H, FLOOR, "#fde9b8", "#fbd38d", "#f6b45f");
    ctx.fillStyle = "#f6b45f";
    for (let i = 0; i < 16; i++) circ(ctx, 30 + i * 61 + (i % 3) * 9, FLOOR + 22 + (i % 4) * 11, 3, "#f6b45f");
  } else if (kind === "snow") {
    sky(ctx, W, FLOOR, ["#bfdbfe", "#e0f2fe", "#f8fafc"]);
    for (const [mx, mh, mw] of [[150, 210, 230], [420, 260, 280], [720, 200, 250], [900, 160, 200]]) {
      ctx.fillStyle = "#93c5fd"; ctx.beginPath(); ctx.moveTo(mx - mw, FLOOR); ctx.lineTo(mx, FLOOR - mh); ctx.lineTo(mx + mw, FLOOR); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(mx - mw * 0.24, FLOOR - mh * 0.76); ctx.lineTo(mx, FLOOR - mh); ctx.lineTo(mx + mw * 0.24, FLOOR - mh * 0.76); ctx.lineTo(mx + mw * 0.1, FLOOR - mh * 0.68); ctx.lineTo(mx, FLOOR - mh * 0.78); ctx.lineTo(mx - mw * 0.1, FLOOR - mh * 0.68); ctx.fill();
    }
    for (const [tx, ts] of [[60, 1], [250, 0.8], [330, 1.1], [610, 0.9], [860, 1.15]]) {
      ctx.fillStyle = "#0f766e";
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(tx - (34 - k * 7) * ts, FLOOR - 14 - k * 26 * ts); ctx.lineTo(tx, FLOOR - 14 - (52 + k * 26) * ts); ctx.lineTo(tx + (34 - k * 7) * ts, FLOOR - 14 - k * 26 * ts); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(tx - 9 * ts, FLOOR - 14 - 84 * ts); ctx.lineTo(tx, FLOOR - 14 - 104 * ts); ctx.lineTo(tx + 9 * ts, FLOOR - 14 - 84 * ts); ctx.fill();
    }
    floor(ctx, W, H, FLOOR, "#ffffff", "#dbeafe", "#bfdbfe");
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(50 + i * 110, FLOOR + 20); ctx.lineTo(20 + i * 110, FLOOR + 50); ctx.stroke(); }
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 40; i++) circ(ctx, (i * 97 + Math.sin(t * 0.8 + i) * 18 + 9999) % W, (i * 53 + t * (26 + (i % 5) * 9)) % (FLOOR - 20), 2 + (i % 3), "#ffffff");
  } else if (kind === "gym") {
    ctx.fillStyle = "#fff3d6"; ctx.fillRect(-30, -30, W + 60, FLOOR + 30);
    ctx.fillStyle = "#bfdbfe"; ctx.fillRect(-30, 150, W + 60, 26);
    // pennants
    const cols = ["#2563eb", "#f59e0b", "#ec4899", "#10b981"];
    ctx.strokeStyle = NAVY; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, 106); ctx.quadraticCurveTo(W / 2, 132, W + 10, 106); ctx.stroke();
    for (let i = 0; i < 16; i++) { const x = 30 + i * 60, y = 107 + 24 * (1 - ((x - W / 2) / (W / 2)) ** 2); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.lineTo(x, y + 28); ctx.fill(); }
    // bleachers with a quiet crowd of dots
    for (let r = 0; r < 4; r++) {
      const y = 230 + r * 52;
      ctx.fillStyle = r % 2 ? "#fbbf77" : "#f8ad5c"; rr(ctx, 70 - r * 12, y, W - 140 + r * 24, 60, 12); ctx.fill();
      for (let i = 0; i < 20; i++) { const x = 100 - r * 10 + i * ((W - 200 + r * 20) / 19); circ(ctx, x, y + 14 + Math.sin(t * 3 + i * 1.7 + r) * 2, 11, ["#fca5a5", "#93c5fd", "#fde68a", "#86efac", "#f9a8d4"][(i + r * 2) % 5]); }
    }
    floor(ctx, W, H, FLOOR, "#f0b46c", "#e39b4d", "#c97f33");
    ctx.strokeStyle = "#c97f33"; ctx.lineWidth = 2;
    for (let i = 0; i < 13; i++) { ctx.beginPath(); ctx.moveTo(i * 80, FLOOR + 6); ctx.lineTo(i * 80 - 26, H); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(-30, FLOOR + 26, W + 60, 5);
  } else if (kind === "roof") {
    sky(ctx, W, FLOOR, ["#a5b4fc", "#fbcfe8", "#fed7aa"]);
    circ(ctx, 180, 300, 70, "#fef08a");
    cloud(ctx, 560 + Math.sin(t * 0.2) * 20, 90, 1, "#fff7ed"); cloud(ctx, 60, 140, 0.7, "#fff7ed");
    const bl = [[-10, 130, 150], [110, 90, 220], [230, 120, 170], [370, 80, 250], [480, 140, 190], [640, 100, 230], [760, 130, 160], [880, 100, 210]];
    for (const [bx, bw, bh] of bl) {
      ctx.fillStyle = "#818cf8"; rr(ctx, bx, FLOOR - bh, bw, bh + 10, 8); ctx.fill();
      ctx.fillStyle = "#fef3c7";
      for (let wy = FLOOR - bh + 16; wy < FLOOR - 30; wy += 30) for (let wx = bx + 14; wx < bx + bw - 20; wx += 28) if ((wx * 7 + wy * 3) % 5 > 1) { rr(ctx, wx, wy, 14, 16, 3); ctx.fill(); }
    }
    ctx.fillStyle = "#6366f1"; rr(ctx, 410, FLOOR - 296, 44, 46, 8); ctx.fill(); ctx.fillRect(418, FLOOR - 252, 5, 12); ctx.fillRect(441, FLOOR - 252, 5, 12);
    floor(ctx, W, H, FLOOR, "#e2e8f0", "#cbd5e1", "#94a3b8");
    ctx.fillStyle = "#94a3b8"; for (let i = 0; i < 8; i++) { rr(ctx, 40 + i * 125, FLOOR + 24 + (i % 2) * 16, 46, 5, 2.5); ctx.fill(); }
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    const wd = Math.sin(t * 0.7) * 150 + Math.sin(t * 2.3) * 60;
    for (let i = 0; i < 7; i++) { const x = (i * 211 + t * wd * 1.4 + 99999) % (W + 100) - 50, y = 120 + i * 43; ctx.globalAlpha = Math.min(1, Math.abs(wd) / 120); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(wd) * 44, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else {
    sky(ctx, W, FLOOR, ["#1e1b4b", "#312e81", "#4c1d95"]);
    const hsh = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 60; i++) circ(ctx, hsh(i + 1) * W, hsh(i + 77.7) * (FLOOR - 70), 1 + (i % 3) * 0.6 + Math.sin(t * 2 + i) * 0.4, i % 7 ? "#e0e7ff" : "#fde047");
    circ(ctx, 760, 120, 58, "#60a5fa"); ctx.save(); ctx.beginPath(); ctx.arc(760, 120, 58, 0, 7); ctx.clip();
    ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.ellipse(740, 100, 30, 20, 0.4, 0, 7); ctx.ellipse(790, 150, 26, 16, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(770, 90, 34, 7, 0.1, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#6366f1"; ctx.beginPath(); ctx.moveTo(-30, FLOOR); ctx.quadraticCurveTo(140, FLOOR - 120, 330, FLOOR - 30); ctx.quadraticCurveTo(520, FLOOR - 130, 700, FLOOR - 40); ctx.quadraticCurveTo(860, FLOOR - 110, W + 30, FLOOR - 20); ctx.lineTo(W + 30, FLOOR); ctx.fill();
    floor(ctx, W, H, FLOOR, "#e2e8f0", "#cbd5e1", "#94a3b8");
    for (const [cx, cw] of [[90, 40], [300, 26], [470, 52], [690, 30], [860, 44]]) { ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.ellipse(cx, FLOOR + 34, cw, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#a8b4c6"; ctx.beginPath(); ctx.ellipse(cx, FLOOR + 37, cw * 0.8, 6, 0, 0, 7); ctx.fill(); }
  }
}

// ---------- fixtures ----------
function bar(ctx, x1, y1, x2, y2, w, col) {
  ctx.lineCap = "round";
  ctx.strokeStyle = NAVY; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
export function drawFixturesBack(ctx, S) {
  const { sport, W, FLOOR } = S;
  if (sport === "soccer") {
    for (let s = 0; s < 2; s++) {
      const top = FLOOR - S.goalH[s], X = (x) => (s ? W - x : x);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.moveTo(X(0), top - 20); ctx.lineTo(X(56), top); ctx.lineTo(X(56), FLOOR); ctx.lineTo(X(0), FLOOR); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
      for (let x = 8; x < 56; x += 12) { ctx.beginPath(); ctx.moveTo(X(x), top - 20 + (x / 56) * 20); ctx.lineTo(X(x), FLOOR); ctx.stroke(); }
      for (let y = top + 6; y < FLOOR; y += 14) { ctx.beginPath(); ctx.moveTo(X(0), y); ctx.lineTo(X(56), y); ctx.stroke(); }
      bar(ctx, X(-6), top - 20, X(56), top, 8, "#ffffff");
    }
  } else if (sport === "hoops") {
    for (const hp of S.hoops) {
      const d = hp.side ? -1 : 1, px = hp.bb - d * 22;
      bar(ctx, px, FLOOR, px, hp.y - 40, 9, "#94a3b8"); bar(ctx, px, hp.y - 40, hp.bb - d * 6, hp.y - 40, 7, "#94a3b8");
      rr(ctx, hp.bb - 6, hp.y - 90, 12, 108, 6); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
      ctx.fillStyle = "#ef4444"; ctx.fillRect(hp.bb - 2.5, hp.y - 44, 5, 34);
      // back of the net
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5;
      const a = hp.bb + d * 6, b = hp.tip, n = 5;
      for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n, x2 = a + (b - a) * (0.18 + (0.64 * i) / n); ctx.beginPath(); ctx.moveTo(x, hp.y); ctx.lineTo(x2, hp.y + 40); ctx.stroke(); }
    }
  } else {
    const x = W / 2, top = FLOOR - 160;
    bar(ctx, x, FLOOR, x, top, 9, "#ffffff");
    ctx.fillStyle = "#ef4444"; for (let y = top + 4; y < FLOOR - 16; y += 32) ctx.fillRect(x - 4.5, y, 9, 14);
    circ(ctx, x, top - 4, 10, "#fde047"); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.stroke();
  }
}
export function drawFixturesFront(ctx, S) {
  const { sport, W, FLOOR } = S;
  if (sport === "soccer") {
    for (let s = 0; s < 2; s++) bar(ctx, s ? W - 56 : 56, FLOOR - S.goalH[s], s ? W - 56 : 56, FLOOR - 3, 7, "#ffffff");
  } else if (sport === "hoops") {
    for (const hp of S.hoops) {
      const d = hp.side ? -1 : 1, a = hp.bb + d * 6;
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2.5;
      for (let k = 1; k < 3; k++) { const f = 0.18 * (k / 2.4), y = hp.y + k * 14; ctx.beginPath(); ctx.moveTo(a + (hp.tip - a) * f, y); ctx.lineTo(a + (hp.tip - a) * (1 - f), y); ctx.stroke(); }
      bar(ctx, a, hp.y, hp.tip, hp.y, 6, "#f97316");
    }
  }
}

// ---------- ball ----------
export function drawBall(ctx, b) {
  const r = b.r;
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(b.ang);
  ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.lineCap = "round";
  if (b.kind === "beach") {
    const cols = ["#ffffff", "#f472b6", "#fde047", "#38bdf8", "#ffffff", "#fb923c"];
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill(); }
    circ(ctx, 0, 0, r); ctx.stroke(); circ(ctx, 0, 0, r * 0.2, "#ffffff"); ctx.lineWidth = 2; ctx.stroke();
  } else if (b.kind === "heavy") {
    circ(ctx, 0, 0, r, "#475569"); ctx.stroke();
    circ(ctx, 0, 0, r * 0.62); ctx.lineWidth = 3; ctx.strokeStyle = "#94a3b8"; ctx.stroke();
    for (let i = 0; i < 4; i++) circ(ctx, Math.cos(i * 1.5708) * r * 0.62, Math.sin(i * 1.5708) * r * 0.62, 2.6, "#e2e8f0");
  } else if (b.kind === "tiny") {
    circ(ctx, 0, 0, r, "#a3e635"); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-r * 0.9, 0, r * 0.9, -0.9, 0.9); ctx.stroke();
  } else if (b.kind === "rugby") {
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.4, r * 0.86, 0, 0, 7); ctx.fillStyle = "#c2703a"; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.24, -4); ctx.lineTo(i * r * 0.24, 4); ctx.stroke(); }
  } else {
    circ(ctx, 0, 0, r, "#fb7185"); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1.5, 0, 7); ctx.clip();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-r, -r * 0.3, r * 2, r * 0.6);
    ctx.fillStyle = "#fde047"; ctx.fillRect(-r, -r * 0.08, r * 2, r * 0.16);
    ctx.restore();
    circ(ctx, 0, 0, r); ctx.strokeStyle = NAVY; ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = Math.max(2, r * 0.16); ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.68, -2.5, -1.7); ctx.stroke();
}

// ---------- ragdoll athletes ----------
// Four characters (team x index), each with their own skin, hair and number. The sport picks the outfit.
const FLOORY = 468;
const SKIN = [["#ffd9b5", "#ecb489"], ["#c98f62", "#a8703f"], ["#93603f", "#754829"], ["#f4cc95", "#d9a866"]];
const HAIR = ["#6b3f1d", "#3b2412", "#111827", "#9a3412"];
const NUM = ["7", "12", "4", "9"];
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function outfit(sport, T, team) {
  if (sport === "soccer") return { jersey: T.c, trim: T.c2, ink: "#ffffff", stripes: 1, sleeve: 0.62, shorts: team ? "#1f2937" : "#ffffff", shortsTo: 0.5, sock: T.c, sockFrom: 0.1, sockTop: "#ffffff", shoe: "cleat" };
  if (sport === "volley") return { jersey: T.c2, trim: T.c, ink: NAVY, band: 1, sleeve: 0, shorts: T.dark, shortsTo: 0.45, dots: T.c2, shoe: "bare" };
  return { jersey: T.c, trim: T.c2, ink: "#ffffff", piping: 1, sleeve: 0, shorts: T.c, shortsTo: 0.86, sock: "#ffffff", sockFrom: 0.6, shoe: "high", wrist: 1 };
}
// a limb through three physics points with a rounded joint
function limbPath(ctx, a, b, c) {
  const k = 0.72;
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  ctx.quadraticCurveTo(b.x, b.y, b.x + (c.x - b.x) * (1 - k), b.y + (c.y - b.y) * (1 - k));
  ctx.lineTo(c.x, c.y);
}
function part(ctx, a, b, k0, k1, w, col) {
  const p = mix(a, b, k0), q = mix(a, b, k1);
  ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.lineCap = "round";
}
function hem(ctx, a, b, k, w, col = NAVY) {
  const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * w * 0.5, ny = (dx / l) * w * 0.5;
  ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke(); ctx.lineCap = "round";
}
function limb(ctx, a, b, c, w, o) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  limbPath(ctx, a, b, c); ctx.strokeStyle = NAVY; ctx.lineWidth = w + 6; ctx.stroke();
  ctx.strokeStyle = o.base; ctx.lineWidth = w; ctx.stroke();
  if (o.upper && o.upTo > 0) { circ(ctx, a.x, a.y, w / 2, o.upper); part(ctx, a, b, 0, o.upTo, w, o.upper); hem(ctx, a, b, o.upTo, w); }
  if (o.lower) {
    part(ctx, b, c, o.lowFrom, 1, w, o.lower);
    if (o.lowTop) part(ctx, b, c, o.lowFrom, o.lowFrom + 0.2, w, o.lowTop);
    hem(ctx, b, c, o.lowFrom, w);
  }
  if (o.band) part(ctx, b, c, 0.5, 0.78, w, o.band);
  if (o.shade) { limbPath(ctx, a, b, c); ctx.strokeStyle = "rgba(15,23,42,0.2)"; ctx.lineWidth = w; ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(a.x - 1.5, a.y - 1); const m = mix(a, b, 0.6); ctx.lineTo(m.x - 1.5, m.y - 1); ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = w * 0.3; ctx.stroke(); }
}
function hand(ctx, p, el, col) {
  const a = Math.atan2(p.y - el.y, p.x - el.x);
  ctx.lineWidth = 3; ctx.strokeStyle = NAVY;
  circ(ctx, p.x + Math.cos(a + 1.3) * p.r * 0.8, p.y + Math.sin(a + 1.3) * p.r * 0.8, p.r * 0.5, col); ctx.stroke();
  circ(ctx, p.x, p.y, p.r, col); ctx.stroke();
  circ(ctx, p.x + Math.cos(a + 1.3) * p.r * 0.55, p.y + Math.sin(a + 1.3) * p.r * 0.55, p.r * 0.42, col);
  ctx.strokeStyle = "rgba(15,23,42,0.28)"; ctx.lineWidth = 1.6;
  for (const k of [-0.35, 0.25]) { ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a + k) * p.r * 0.45, p.y + Math.sin(a + k) * p.r * 0.45); ctx.lineTo(p.x + Math.cos(a + k) * p.r * 0.85, p.y + Math.sin(a + k) * p.r * 0.85); ctx.stroke(); }
}
function shoe(ctx, f, knee, face, K, T, skin, shade) {
  const r = f.r, sa = Math.atan2(f.y - knee.y, f.x - knee.x) - Math.PI / 2;
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.rotate(f.y > FLOORY - r - 2 ? 0 : cl(sa * 0.7, -1.2, 1.2));
  ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.lineJoin = "round";
  if (K.shoe === "bare") {
    circ(ctx, face * r * 1.3, r * 0.3, r * 0.42, skin); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(face * r * 0.3, r * 0.12, r * 1.25, r * 0.85, 0, 0, 7); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
    circ(ctx, face * r * 1.2, r * 0.3, r * 0.34, skin);
  } else {
    const high = K.shoe === "high";
    if (!high) { ctx.fillStyle = NAVY; for (const sx of [-0.4, 0.5, 1.4]) ctx.fillRect(face * r * sx - 2, r * 0.8, 4, r * 0.45); }
    ctx.beginPath(); ctx.ellipse(face * r * 0.5, r * 0.08, r * 1.5, r * 0.97, 0, 0, 7); ctx.fillStyle = high ? "#ffffff" : "#273449"; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = high ? T.c : T.c2; ctx.fillRect(face > 0 ? r * 1.05 : -r * 2.2, -r, r * 1.15, r * 2.2);
    ctx.fillStyle = high ? "#cbd5e1" : "#ffffff"; ctx.fillRect(-r * 2.2, r * 0.55, r * 4.4, r);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(face * r * 0.5, r * 0.08, r * 1.5, r * 0.97, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = high ? T.c : "#ffffff"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(face * r * -0.1, -r * 0.42); ctx.lineTo(face * r * 0.75, r * 0.2); ctx.stroke();
  }
  if (shade) { ctx.beginPath(); ctx.ellipse(face * r * 0.45, r * 0.1, r * 1.45, r * 0.92, 0, 0, 7); ctx.fillStyle = "rgba(15,23,42,0.18)"; ctx.fill(); }
  ctx.restore();
}
function star(ctx, x, y, r, rot, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const q = i % 2 ? r * 0.45 : r, a = rot + (i / 10) * 6.2832; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = NAVY; ctx.lineJoin = "round"; ctx.stroke();
}
function hairBack(ctx, v, hr, f, T, d) {
  ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.lineJoin = "round";
  if (v === 1) {
    const sway = cl((d.p[0].x - d.p[0].px) * 0.22 * f, -0.7, 0.7);
    ctx.save(); ctx.translate(-f * hr * 0.78, -hr * 0.42); ctx.rotate(f * (0.5 + sway));
    ctx.beginPath(); ctx.ellipse(-f * hr * 0.2, hr * 0.62, hr * 0.3, hr * 0.68, 0, 0, 7); ctx.fillStyle = HAIR[v]; ctx.fill(); ctx.stroke();
    circ(ctx, 0, 0, hr * 0.2, T.c2); ctx.stroke();
    ctx.restore();
  } else if (v === 2) {
    const puffs = [[-0.92, -0.2, 0.42], [-0.62, -0.7, 0.5], [0, -0.95, 0.54], [0.62, -0.7, 0.5], [0.92, -0.2, 0.42]];
    for (const [x, y, r] of puffs) { circ(ctx, x * hr, y * hr, r * hr + 2.5, NAVY); }
    for (const [x, y, r] of puffs) circ(ctx, x * hr, y * hr, r * hr, HAIR[v]);
  } else if (v === 3) {
    rr(ctx, f > 0 ? -hr * 1.55 : hr * 0.45, -hr * 0.5, hr * 1.1, hr * 0.26, hr * 0.13); ctx.fillStyle = T.dark; ctx.fill(); ctx.stroke();
  }
}
function hairFront(ctx, v, hr, f, T) {
  ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.lineJoin = "round";
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, hr - 1.7, 0, 7); ctx.clip();
  ctx.fillStyle = HAIR[v];
  if (v === 0) {
    ctx.fillRect(-hr, -hr, hr * 2, hr * 0.5); ctx.fillRect(f > 0 ? -hr : hr * 0.6, -hr, hr * 0.4, hr * 1.05);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-hr, -hr * 0.56, hr * 2, hr * 0.2);
    ctx.fillStyle = T.c; ctx.fillRect(-hr, -hr * 0.5, hr * 2, hr * 0.07);
  } else if (v === 1) {
    ctx.fillRect(-hr, -hr, hr * 2, hr * 0.46); ctx.fillRect(f > 0 ? -hr : hr * 0.5, -hr, hr * 0.5, hr * 1.25);
    ctx.beginPath(); ctx.ellipse(f * hr * 0.5, -hr * 0.52, hr * 0.62, hr * 0.3, f * 0.35, 0, 7); ctx.fill();
  } else if (v === 2) {
    ctx.fillRect(-hr, -hr, hr * 2, hr * 0.44); ctx.fillRect(f > 0 ? -hr : hr * 0.66, -hr, hr * 0.34, hr * 0.95);
  } else {
    circ(ctx, f * hr * 0.55, -hr * 0.3, hr * 0.2, HAIR[v]); ctx.fillRect(f > 0 ? -hr : hr * 0.62, -hr * 0.4, hr * 0.38, hr * 0.5);
  }
  ctx.restore();
  if (v === 0) {
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.4 - f * 0.12;
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.24) * hr * 0.95, Math.sin(a - 0.24) * hr * 0.95);
      ctx.lineTo(Math.cos(a + f * 0.2) * hr * (1.3 - Math.abs(i) * 0.05), Math.sin(a + f * 0.2) * hr * (1.3 - Math.abs(i) * 0.05));
      ctx.lineTo(Math.cos(a + 0.24) * hr * 0.95, Math.sin(a + 0.24) * hr * 0.95);
      ctx.fillStyle = HAIR[v]; ctx.fill(); ctx.stroke();
    }
  } else if (v === 3) {
    ctx.beginPath(); ctx.arc(0, 0, hr * 1.06, Math.PI + 0.3, -0.3); ctx.closePath(); ctx.fillStyle = T.dark; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = T.c2; ctx.fillRect(-hr * 0.22, -hr * 1.2, hr * 0.44, hr); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, hr * 1.06, Math.PI + 0.3, -0.3); ctx.closePath(); ctx.stroke();
    circ(ctx, 0, -hr * 1.06, hr * 0.11, T.c2); ctx.lineWidth = 2; ctx.stroke();
  }
}
function face(ctx, d, hr, f, ha, ball, t, mood) {
  const ex = f * hr * 0.24, ey = hr * 0.08;
  let lx = 0, ly = 0;
  if (ball) { const dx = ball.x - d.p[0].x, dy = ball.y - d.p[0].y, dd = Math.hypot(dx, dy) || 1, ca = Math.cos(-ha), sa = Math.sin(-ha); lx = ((dx * ca - dy * sa) / dd) * hr * 0.11; ly = ((dx * sa + dy * ca) / dd) * hr * 0.11; }
  if (mood === "sad") { lx *= 0.4; ly = hr * 0.08; }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of [-1, 1]) {
    const x = ex + s * hr * 0.35;
    if (mood === "joy") { ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, hr * 0.14); ctx.beginPath(); ctx.arc(x, ey + hr * 0.1, hr * 0.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); continue; }
    if (mood === "dizzy") {
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.8, hr * 0.09); ctx.beginPath();
      for (let a = 0; a < 11; a += 0.45) { const q = hr * 0.024 * a, an = a * s + t * 7; ctx.lineTo(x + Math.cos(an) * q, ey + Math.sin(an) * q); }
      ctx.stroke(); continue;
    }
    const sy = mood === "effort" ? 0.78 : 1;
    ctx.beginPath(); ctx.ellipse(x, ey, hr * 0.25, hr * 0.31 * sy, 0, 0, 7); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = NAVY; ctx.stroke();
    circ(ctx, x + lx, ey + ly, hr * (mood === "effort" ? 0.12 : 0.15), INK); circ(ctx, x + lx + hr * 0.05, ey + ly - hr * 0.06, hr * 0.05, "#ffffff");
    if (mood === "effort" || mood === "sad") {
      const up = mood === "sad" ? 1 : -1;
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.2, hr * 0.12);
      ctx.beginPath(); ctx.moveTo(x + s * hr * 0.26, ey - hr * (0.44 - up * 0.07)); ctx.lineTo(x - s * hr * 0.2, ey - hr * (0.44 + up * 0.09)); ctx.stroke();
    }
  }
  ctx.fillStyle = mood === "effort" ? "#fb7185" : "#f9a8d4";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + s * hr * 0.6, ey + hr * 0.4, hr * 0.16, hr * 0.1, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = Math.max(2.2, hr * 0.12);
  const my = ey + hr * 0.42;
  if (mood === "joy") {
    ctx.beginPath(); ctx.arc(ex, my - hr * 0.02, hr * 0.32, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex, my + hr * 0.2, hr * 0.15, hr * 0.08, 0, 0, 7); ctx.fillStyle = "#fb7185"; ctx.fill();
  } else if (mood === "effort") {
    rr(ctx, ex - hr * 0.26, my - hr * 0.02, hr * 0.52, hr * 0.26, hr * 0.09); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - hr * 0.24, my + hr * 0.11); ctx.lineTo(ex + hr * 0.24, my + hr * 0.11); ctx.moveTo(ex, my); ctx.lineTo(ex, my + hr * 0.22); ctx.lineWidth = 1.4; ctx.stroke();
  } else if (mood === "dizzy") {
    ctx.beginPath(); ctx.moveTo(ex - hr * 0.26, my + hr * 0.12);
    ctx.quadraticCurveTo(ex - hr * 0.13, my - hr * 0.04, ex, my + hr * 0.12); ctx.quadraticCurveTo(ex + hr * 0.13, my + hr * 0.28, ex + hr * 0.26, my + hr * 0.12); ctx.stroke();
  } else if (mood === "sad") { ctx.beginPath(); ctx.arc(ex, my + hr * 0.3, hr * 0.2, Math.PI + 0.45, -0.45); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(ex, my, hr * 0.2, 0.3, Math.PI - 0.3); ctx.stroke(); }
  if (mood === "effort") {
    const x = -f * hr * 0.7, y = -hr * 0.2;
    ctx.beginPath(); ctx.moveTo(x, y - hr * 0.3); ctx.quadraticCurveTo(x + hr * 0.2, y, x, y + hr * 0.06); ctx.quadraticCurveTo(x - hr * 0.2, y, x, y - hr * 0.3);
    ctx.fillStyle = "#7dd3fc"; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = NAVY; ctx.stroke();
  }
  if (mood === "dizzy") for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.094; star(ctx, Math.cos(a) * hr * 0.95, -hr * 1.28 + Math.sin(a) * hr * 0.24, hr * 0.2 + 2, a, "#fde047"); }
}

/** o: { sport, mood: "idle" | "effort" | "joy" | "dizzy" | "sad", noShadow } */
export function drawDoll(ctx, d, T, ball, t, o = {}) {
  const P = d.p, L = d.dim, f = d.face, v = d.team * 2 + d.idx, K = outfit(o.sport, T, d.team);
  const skin = SKIN[v][0], skin2 = SKIN[v][1], aw = 9.5 * L.s, lw = 11.5 * L.s, mood = o.mood || "idle";
  // soft shadow that slides the way the body leans
  if (!o.noShadow) {
    const hgt = Math.max(0, FLOORY - P[2].y - L.leg), lean = P[1].x - P[2].x;
    ctx.fillStyle = `rgba(15,23,42,${cl(0.2 - hgt * 0.0007, 0.07, 0.2)})`;
    ctx.beginPath(); ctx.ellipse(P[2].x + lean * 0.9, FLOORY - 2, Math.max(12, 30 * L.s + Math.abs(lean) * 0.5 - hgt * 0.07), 5.5, 0, 0, 7); ctx.fill();
  }
  const sq = d.sq || 0, squash = Math.abs(sq) > 0.02;
  if (squash) { const ax = (P[8].x + P[10].x) / 2, ay = Math.max(P[8].y + P[8].r, P[10].y + P[10].r); ctx.save(); ctx.translate(ax, ay); ctx.scale(1 + sq * 0.16, 1 - sq * 0.2); ctx.translate(-ax, -ay); }
  const legO = (shade) => ({ base: skin, upper: K.shorts, upTo: K.shortsTo, lower: K.sock, lowFrom: K.sockFrom, lowTop: K.sockTop, shade });
  const armO = (shade) => ({ base: skin, upper: K.sleeve ? K.jersey : null, upTo: K.sleeve, band: K.wrist && !shade ? K.trim : null, shade });
  // far side first
  limb(ctx, P[2], P[9], P[10], lw, legO(true)); shoe(ctx, P[10], P[9], f, K, T, skin, true);
  limb(ctx, P[1], P[5], P[6], aw, armO(true)); hand(ctx, P[6], P[5], skin2);
  // neck
  ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(P[1].x, P[1].y); ctx.lineTo(P[0].x, P[0].y);
  ctx.strokeStyle = NAVY; ctx.lineWidth = 15 * L.s; ctx.stroke(); ctx.strokeStyle = skin2; ctx.lineWidth = 9 * L.s; ctx.stroke();
  // torso: jersey, number, shorts
  const tl = Math.hypot(P[2].x - P[1].x, P[2].y - P[1].y), R = L.chestR, R2 = R * 0.92;
  const body = () => { ctx.beginPath(); ctx.arc(0, 0, R, Math.PI, 0); ctx.lineTo(R2, tl); ctx.arc(0, tl, R2, 0, Math.PI); ctx.closePath(); };
  ctx.save(); ctx.translate(P[1].x, P[1].y); ctx.rotate(Math.atan2(P[2].y - P[1].y, P[2].x - P[1].x) - Math.PI / 2);
  body(); ctx.fillStyle = K.jersey; ctx.fill();
  ctx.save(); ctx.clip();
  if (K.stripes) { ctx.fillStyle = K.trim; ctx.fillRect(-R * 0.72, -R, R * 0.36, tl + R); ctx.fillRect(R * 0.36, -R, R * 0.36, tl + R); }
  if (K.band) { ctx.fillStyle = K.trim; ctx.fillRect(-R, tl * 0.5, R * 2, 6 * L.s); ctx.fillStyle = "#ffffff"; ctx.fillRect(-R, tl * 0.5 + 6 * L.s, R * 2, 2.5 * L.s); }
  if (K.piping) { ctx.fillStyle = K.trim; ctx.fillRect(-R, -R, 3.2 * L.s, tl + R); ctx.fillRect(R - 3.2 * L.s, -R, 3.2 * L.s, tl + R); ctx.beginPath(); ctx.arc(0, -R * 1.02, R * 0.5, 0, Math.PI); ctx.fill(); }
  ctx.fillStyle = K.shorts; ctx.fillRect(-R, tl * 0.74, R * 2, tl);
  if (K.dots) { ctx.fillStyle = K.dots; for (const [x, y] of [[-0.5, 0.86], [0.35, 0.92], [-0.1, 1.08], [0.6, 1.14]]) { ctx.beginPath(); ctx.arc(x * R, y * tl, 2.2 * L.s, 0, 7); ctx.fill(); } }
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-R, tl * 0.74 - 1.5 * L.s, R * 2, 3 * L.s);
  ctx.fillStyle = "rgba(15,23,42,0.14)"; ctx.fillRect(f > 0 ? -R : R * 0.45, -R, R * 0.55, tl + R * 2);
  ctx.restore();
  ctx.font = `900 ${Math.round(R * (NUM[v].length > 1 ? 0.92 : 1.12))}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = K.ink; ctx.fillText(NUM[v], f * R * 0.08, tl * (K.band ? 0.2 : 0.34));
  body(); ctx.lineWidth = 3.5; ctx.strokeStyle = NAVY; ctx.lineJoin = "round"; ctx.stroke();
  ctx.restore();
  // head
  const hr = L.headR, ha = Math.atan2(P[0].x - P[1].x, -(P[0].y - P[1].y));
  ctx.save(); ctx.translate(P[0].x, P[0].y); ctx.rotate(ha);
  hairBack(ctx, v, hr, f, T, d);
  circ(ctx, -f * hr * 0.86, hr * 0.14, hr * 0.2, skin2); ctx.lineWidth = 2.6; ctx.strokeStyle = NAVY; ctx.stroke();
  circ(ctx, 0, 0, hr, skin2); ctx.lineWidth = 3.5; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, hr - 1.7, 0, 7); ctx.clip(); circ(ctx, f * hr * 0.2, -hr * 0.16, hr * 1.02, skin); ctx.restore();
  hairFront(ctx, v, hr, f, T);
  face(ctx, d, hr, f, ha, ball, t, mood);
  ctx.restore();
  // near side on top
  limb(ctx, P[2], P[7], P[8], lw, legO(false)); shoe(ctx, P[8], P[7], f, K, T, skin, false);
  limb(ctx, P[1], P[3], P[4], aw, armO(false)); hand(ctx, P[4], P[3], skin);
  if (squash) ctx.restore();
}

/**
 * The lean dial under a controlled player's feet: the arrow sweeps with the sway and shows where a press
 * would send them right now. o: { vx, vy, G, ready, strength 0..1 }
 */
export function drawLean(ctx, d, T, o) {
  const P = d.p, cx = (P[8].x + P[10].x) / 2, cy = FLOORY + 44, R = 29, al = o.ready ? 1 : 0.3;
  const up = -Math.PI / 2, ang = up + cl((Math.atan2(o.vy, o.vx) - up) * 1.5, -1.05, 1.05), span = 1.05;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = al;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, up - span, up + span); ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R - 2.5, Math.min(up, ang), Math.max(up, ang)); ctx.closePath();
  ctx.fillStyle = T.c; ctx.globalAlpha = al * 0.6; ctx.fill(); ctx.globalAlpha = al;
  ctx.strokeStyle = "rgba(30,58,138,0.45)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy - R + 5); ctx.lineTo(cx, cy - R); ctx.stroke();
  const len = R + 5 + o.strength * 9, tx = cx + Math.cos(ang) * len, ty = cy + Math.sin(ang) * len;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.strokeStyle = NAVY; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = T.c; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx + Math.cos(ang) * 8, ty + Math.sin(ang) * 8); ctx.lineTo(tx + Math.cos(ang + 2.2) * 8, ty + Math.sin(ang + 2.2) * 8); ctx.lineTo(tx + Math.cos(ang - 2.2) * 8, ty + Math.sin(ang - 2.2) * 8); ctx.closePath();
  ctx.fillStyle = T.c; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = NAVY; ctx.stroke();
  circ(ctx, cx, cy, 4.5, "#ffffff"); ctx.lineWidth = 2.4; ctx.stroke();
  if (o.ready) for (let i = 0; i < 4; i++) {
    const q = 0.14 + i * 0.055, x = P[1].x + o.vx * q, y = P[1].y + o.vy * q + 0.5 * o.G * q * q;
    ctx.globalAlpha = 0.9 - i * 0.17;
    circ(ctx, x, y, 4.6 - i * 0.7, "#ffffff"); ctx.lineWidth = 2; ctx.strokeStyle = T.dark; ctx.stroke();
  }
  ctx.restore();
}

/** Small picture of a body style for the pick cards. */
export function drawBodyIcon(ctx, x, y, B, col) {
  const hd = 7 * (B.head || 1), arm = 13 * (B.arm || 1), leg = 17 * (B.leg || 1), top = y - 4;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const lines = () => { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + 18); ctx.moveTo(x - arm, top - 3); ctx.lineTo(x, top + 4); ctx.lineTo(x + arm, top - 3); ctx.moveTo(x - 7, top + 18 + leg); ctx.lineTo(x, top + 18); ctx.lineTo(x + 7, top + 18 + leg); };
  lines(); ctx.strokeStyle = NAVY; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
  circ(ctx, x, top - hd - 1, hd, "#ffd9b5"); ctx.lineWidth = 2.6; ctx.strokeStyle = NAVY; ctx.stroke();
  circ(ctx, x - hd * 0.35, top - hd - 1, 1.5, INK); circ(ctx, x + hd * 0.35, top - hd - 1, 1.5, INK);
}
