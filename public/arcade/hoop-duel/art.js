// Hoop Duel art: the arena, the hoops, the ball and the athlete rig. Pure drawing, no game rules.
import { FONT, drawArchie, clamp, lerp } from "../kit/kit.js";

// World: x runs along the court (0..L), z is depth (0 far sideline .. D near sideline), y is height.
export const W = 960, H = 540, L = 1680, D = 440, FY = 300, ZK = 0.5, HZ = 220, RIM_Y = 168, HOOP_IN = 96;
export const THREE_R = 335, CORNER = 190, KEY_X = 280, KEY_Z0 = 135, KEY_Z1 = 305;
export const HOOPS = [{ i: 0, x: HOOP_IN, dir: 1 }, { i: 1, x: L - HOOP_IN, dir: -1 }];
export const zs = (z) => 0.86 + 0.22 * clamp(z / D, -0.1, 1.1);
export const sy = (z, y = 0) => FY + z * ZK - y;
const OUT = "#172554";
const hash = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

export const COURTS = {
  wood: { floor: ["#f3c887", "#dd9f55"], plank: "rgba(120,66,18,.13)", line: "#ffffff", apron: "#1e3a8a", wall: ["#070b1c", "#1a2452"], circle: "rgba(30,58,138,.9)" },
  street: { floor: ["#6c7c92", "#46546a"], plank: "rgba(15,23,42,.12)", line: "#fde047", apron: "#111827", wall: ["#0b1020", "#27304f"], circle: "rgba(15,23,42,.8)" },
  ocean: { floor: ["#67d6dc", "#2796ad"], plank: "rgba(8,60,90,.13)", line: "#ffffff", apron: "#0c4a6e", wall: ["#04121f", "#0f3554"], circle: "rgba(12,74,110,.9)" },
};
const FAN_COLS = ["#f97316", "#e2e8f0", "#facc15", "#a78bfa", "#34d399", "#fb7185", "#94a3b8"];
const FAN_SKIN = ["#f3c9a5", "#c98f63", "#8a5a3c", "#e8b48c", "#a86f48"];
const BOARD_WORDS = ["HOOP DUEL", "ALGEBRIDGE ARCADE", "HOT HAND", "DEFENSE", "BRIDGE CITY", "LET'S GO"];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export { rr };

export function drawArena(ctx, camX, env) {
  const th = COURTS[env.court] || COURTS.wood;
  const gr = ctx.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, th.wall[0]); gr.addColorStop(1, th.wall[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 300);
  // light rigs
  const px = camX * 0.5;
  for (let i = -1; i < 6; i++) {
    const x = i * 260 - (((px % 260) + 260) % 260) + 130;
    const g2 = ctx.createRadialGradient(x, 6, 2, x, 6, 120);
    g2.addColorStop(0, "rgba(255,255,255,.34)"); g2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g2; ctx.fillRect(x - 120, 0, 240, 110);
    ctx.fillStyle = "#e2e8f0"; rr(ctx, x - 26, 4, 52, 7, 3); ctx.fill();
  }
  // the stands
  const cx = camX * 0.82, hype = env.hype || 0, quiet = env.quiet;
  for (let r = 0; r < 6; r++) {
    const y = 64 + r * 31;
    ctx.fillStyle = r % 2 ? "#1b2657" : "#151e47"; ctx.fillRect(0, y + 12, W, 31);
    ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(0, y + 12, W, 2);
    const sp = 27, off = (r % 2) * 13, i0 = Math.floor((cx - off) / sp) - 1;
    for (let i = i0; i < i0 + 38; i++) {
      const x = i * sp + off - cx, h1 = hash(i * 7.13 + r * 91.7), h2 = hash(i * 3.71 + r * 17.3), h3 = hash(i * 1.37 + r * 5.9);
      if (h3 > 0.93) continue; // an empty seat now and then
      const bob = hype > 0.02 ? -hype * 8 * Math.max(0, Math.sin(env.t * 11 + h1 * 6.28)) : Math.sin(env.t * 1.6 + h1 * 6.28) * 0.7;
      const body = h2 < 0.3 ? env.colors[0] : h2 < 0.5 ? env.colors[1] : FAN_COLS[(h2 * 97 | 0) % FAN_COLS.length];
      ctx.globalAlpha = quiet ? 0.55 : 0.92;
      if (hype > 0.35 && h1 < 0.5) {
        ctx.strokeStyle = FAN_SKIN[(h1 * 53 | 0) % 5]; ctx.lineWidth = 3.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - 7, y + 16 + bob); ctx.lineTo(x - 11, y + 1 + bob); ctx.moveTo(x + 7, y + 16 + bob); ctx.lineTo(x + 11, y + 1 + bob); ctx.stroke();
      }
      ctx.fillStyle = body; rr(ctx, x - 9, y + 12 + bob, 18, 24, 6); ctx.fill();
      ctx.fillStyle = FAN_SKIN[(h1 * 53 | 0) % 5]; ctx.beginPath(); ctx.arc(x, y + 6 + bob, 7.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = h3 < 0.5 ? "#1c1917" : h3 < 0.75 ? "#7c2d12" : "#fbbf24"; ctx.beginPath(); ctx.arc(x, y + 4.5 + bob, 7.4, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // shade the stands toward the top so the court pops
  const sh = ctx.createLinearGradient(0, 40, 0, 250);
  sh.addColorStop(0, "rgba(7,11,28,.78)"); sh.addColorStop(1, "rgba(7,11,28,.08)");
  ctx.fillStyle = sh; ctx.fillRect(0, 40, W, 212);
  // courtside boards
  ctx.fillStyle = "#0b1027"; ctx.fillRect(0, 250, W, 38);
  const seg = 280, s0 = Math.floor(camX / seg) - 1;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `900 17px ${FONT}`;
  for (let i = s0; i < s0 + 6; i++) {
    const x = i * seg - camX, k = ((i % 3) + 3) % 3;
    ctx.fillStyle = k === 0 ? env.colors[0] : k === 1 ? "#f97316" : env.colors[1];
    rr(ctx, x + 5, 254, seg - 10, 30, 6); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.16)"; rr(ctx, x + 5, 254, seg - 10, 12, 6); ctx.fill();
    ctx.fillStyle = k === 1 ? "#1e293b" : "#ffffff";
    ctx.fillText(BOARD_WORDS[((i % BOARD_WORDS.length) + BOARD_WORDS.length) % BOARD_WORDS.length], x + seg / 2, 270);
  }
}

export function drawFloor(ctx, camX, env) {
  const th = COURTS[env.court] || COURTS.wood;
  ctx.fillStyle = th.apron; ctx.fillRect(0, 288, W, H - 288);
  ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(0, 288, W, 3);
  const x0 = -camX, y0 = FY, fh = D * ZK;
  const gr = ctx.createLinearGradient(0, y0, 0, y0 + fh);
  gr.addColorStop(0, th.floor[1]); gr.addColorStop(0.35, th.floor[0]); gr.addColorStop(1, th.floor[1]);
  ctx.fillStyle = gr; ctx.fillRect(x0, y0, L, fh);
  // planks
  ctx.fillStyle = th.plank;
  for (let j = 0; j < 20; j++) {
    const y = y0 + j * 11;
    ctx.fillRect(Math.max(0, x0), y, Math.min(W, L + x0) - Math.max(0, x0), 1.2);
    if (j % 2) ctx.fillRect(Math.max(0, x0), y, Math.min(W, L + x0) - Math.max(0, x0), 11);
    const o = (j * 137) % 190;
    for (let x = Math.floor((camX - o) / 190) * 190 + o; x < camX + W; x += 190) if (x > 0 && x < L) ctx.fillRect(x - camX, y, 1.2, 11);
  }
  // painted keys
  for (const h of HOOPS) {
    const kx = h.dir === 1 ? 0 : L - KEY_X;
    ctx.fillStyle = env.keyCol[h.i]; ctx.globalAlpha = 0.88;
    ctx.fillRect(kx - camX, sy(KEY_Z0), KEY_X, (KEY_Z1 - KEY_Z0) * ZK);
    ctx.globalAlpha = 1;
  }
  // center circle and logo
  const ccx = L / 2 - camX, ccy = sy(HZ);
  ctx.fillStyle = th.circle; ctx.beginPath(); ctx.ellipse(ccx, ccy, 72, 36, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.ellipse(ccx, ccy, 40, 20, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ccx - 40, ccy); ctx.lineTo(ccx + 40, ccy); ctx.moveTo(ccx, ccy - 20); ctx.lineTo(ccx, ccy + 20);
  ctx.ellipse(ccx - 40, ccy, 26, 20, 0, -0.9, 0.9); ctx.moveTo(ccx + 24, ccy - 15); ctx.ellipse(ccx + 40, ccy, 26, 20, 0, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
  // lines
  ctx.strokeStyle = th.line; ctx.lineWidth = 3; ctx.lineJoin = "round";
  ctx.strokeRect(x0, y0, L, fh);
  ctx.beginPath(); ctx.moveTo(ccx, y0); ctx.lineTo(ccx, y0 + fh); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(ccx, ccy, 72, 36, 0, 0, 6.283); ctx.stroke();
  const a = Math.asin(CORNER / THREE_R), xa = Math.sqrt(THREE_R * THREE_R - CORNER * CORNER);
  for (const h of HOOPS) {
    const base = (h.dir === 1 ? 0 : L) - camX, hx = h.x - camX, kx = (h.dir === 1 ? KEY_X : L - KEY_X) - camX;
    ctx.strokeRect(Math.min(base, kx), sy(KEY_Z0), KEY_X, (KEY_Z1 - KEY_Z0) * ZK);
    ctx.beginPath(); ctx.ellipse(kx, ccy, 72, 36, 0, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(base, sy(HZ - CORNER)); ctx.lineTo(hx + h.dir * xa, sy(HZ - CORNER));
    if (h.dir === 1) ctx.ellipse(hx, ccy, THREE_R, THREE_R * ZK, 0, -a, a, false); else ctx.ellipse(hx, ccy, THREE_R, THREE_R * ZK, 0, Math.PI + a, Math.PI - a, true);
    ctx.lineTo(base, sy(HZ + CORNER)); ctx.stroke();
    ctx.beginPath();
    if (h.dir === 1) ctx.ellipse(hx, ccy, 44, 22, 0, -Math.PI / 2, Math.PI / 2, false); else ctx.ellipse(hx, ccy, 44, 22, 0, Math.PI / 2, Math.PI * 1.5, false);
    ctx.stroke();
  }
  // sheen
  const g3 = ctx.createRadialGradient(W / 2, y0 + 70, 10, W / 2, y0 + 70, 420);
  g3.addColorStop(0, "rgba(255,255,255,.16)"); g3.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g3; ctx.fillRect(Math.max(0, x0), y0, Math.min(W, L + x0) - Math.max(0, x0), fh);
  // scorer's table on the far side
  const tx = L / 2 - camX;
  ctx.fillStyle = "#0f172a"; rr(ctx, tx - 96, 268, 192, 26, 6); ctx.fill();
  ctx.fillStyle = "#f97316"; rr(ctx, tx - 92, 271, 184, 17, 4); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `900 12px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("HOOP DUEL", tx, 280);
  if (env.archie) drawArchie(ctx, tx + 150, 272, 40, { pose: env.hype > 0.3 ? "happy" : "idle", t: env.t, look: { x: env.lookX || 0, y: 0.2 } });
}

/** part: "back" (pole, board, shot clock, far rim) or "front" (near rim and net). */
export function drawHoop(ctx, h, camX, part, st) {
  const wob = st.rattle > 0 ? Math.sin(st.t * 60) * 3.5 * st.rattle : 0;
  const rx = h.x - camX, ry = sy(HZ, RIM_Y) + wob, d = h.dir;
  const bx = rx - d * 30;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (part === "back") {
    const px = rx - d * 150, py = sy(HZ);
    ctx.fillStyle = "rgba(15,23,42,.25)"; ctx.beginPath(); ctx.ellipse(px, py, 34, 9, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#1e293b"; rr(ctx, px - 24, py - 16, 48, 18, 6); ctx.fill();
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px, py - 150); ctx.lineTo(bx - d * 8, ry - 34); ctx.stroke();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px, py - 150); ctx.lineTo(bx - d * 8, ry - 34); ctx.stroke();
    ctx.fillStyle = st.pad; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; rr(ctx, px - 11, py - 104, 22, 86, 8); ctx.fill(); ctx.stroke();
    // board
    const top = ry - 84, bot = ry + 12;
    ctx.beginPath(); ctx.moveTo(bx + d * 7, top + 12); ctx.lineTo(bx - d * 7, top - 12); ctx.lineTo(bx - d * 7, bot - 12); ctx.lineTo(bx + d * 7, bot + 12); ctx.closePath();
    ctx.fillStyle = "rgba(241,245,249,.9)"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + d * 4, ry - 30); ctx.lineTo(bx - d * 4, ry - 42); ctx.lineTo(bx - d * 4, ry - 6); ctx.lineTo(bx + d * 4, ry + 6); ctx.closePath();
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2; ctx.stroke();
    // shot clock
    ctx.fillStyle = "#0b0f1f"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; rr(ctx, bx - 20, top - 42, 40, 26, 5); ctx.fill(); ctx.stroke();
    if (st.clock != null) {
      ctx.fillStyle = st.clock <= 4 ? "#f87171" : "#fbbf24"; ctx.font = `900 18px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(st.clock), bx, top - 28);
    }
    // rim arm and far half of the rim
    ctx.strokeStyle = "#9a3412"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx + d * 5, ry); ctx.lineTo(rx - d * 17, ry); ctx.stroke();
    ctx.strokeStyle = "#c2410c"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(rx, ry, 19, 6.5, 0, Math.PI, 6.283); ctx.stroke();
  } else {
    const sw = st.swish || 0, len = 27 + sw * 9, sway = Math.sin(st.t * 26) * sw * 5;
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const tx = rx - 18 + i * 6, ty = ry + Math.sqrt(Math.max(0, 1 - ((i - 3) / 3) ** 2)) * 5;
      const b0 = rx - 10 + i * 3.33 + sway;
      if (i < 6) { ctx.moveTo(tx, ty); ctx.lineTo(b0 + 3.33, ry + len); }
      if (i > 0) { ctx.moveTo(tx, ty); ctx.lineTo(b0 - 3.33, ry + len); }
    }
    ctx.moveTo(rx - 14 + sway * 0.5, ry + len * 0.5); ctx.lineTo(rx + 14 + sway * 0.5, ry + len * 0.5);
    ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(rx, ry, 19, 6.5, 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(rx, ry, 19, 6.5, 0, 0, Math.PI); ctx.stroke();
  }
}

export const BALLS = {
  classic: { a: "#fb923c", b: "#ea580c", seam: "#7c2d12" },
  beach: { a: "#fde047", b: "#f43f5e", seam: "#ffffff" },
  galaxy: { a: "#a78bfa", b: "#4c1d95", seam: "#f0abfc" },
  gold: { a: "#fde68a", b: "#d97706", seam: "#92400e" },
};
export function drawBall(ctx, x, y, r, spin, style = "classic") {
  const b = BALLS[style] || BALLS.classic;
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, b.a); g.addColorStop(1, b.b);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
  ctx.rotate(spin);
  ctx.strokeStyle = b.seam; ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.moveTo(r * 0.72, -r * 0.7); ctx.arc(r * 1.25, 0, r * 0.9, Math.PI * 0.72, Math.PI * 1.28); ctx.moveTo(-r * 0.72, r * 0.7); ctx.arc(-r * 1.25, 0, r * 0.9, -Math.PI * 0.28, Math.PI * 0.28);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.clip();
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.moveTo(r * 0.55, -r); ctx.quadraticCurveTo(r * 0.1, 0, r * 0.55, r); ctx.moveTo(-r * 0.55, -r); ctx.quadraticCurveTo(-r * 0.1, 0, -r * 0.55, r);
  ctx.stroke(); ctx.restore();
  ctx.rotate(-spin);
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, r * 0.2); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
  ctx.restore();
}

// ---------- the athlete rig ----------
// Angles: 0 points down, PI/2 forward (the way the athlete faces), PI up. Each limb is [upper, lower] absolute angles.
const jt = (o, a, len) => [o[0] + Math.sin(a) * len, o[1] + Math.cos(a) * len];
function ik(S, T, a, b) {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.5, a + b - 0.5), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const e1 = [S[0] + Math.cos(base + A) * a, S[1] + Math.sin(base + A) * a], e2 = [S[0] + Math.cos(base - A) * a, S[1] + Math.sin(base - A) * a];
  const e = e1[1] > e2[1] ? e1 : e2;
  return [e, [S[0] + Math.cos(base) * d, S[1] + Math.sin(base) * d]];
}

/** Work out a pose from what the athlete is doing. o: { t, defend, ball: [lx, ly] | null, dribble } */
export function poseOf(p, o) {
  const sp = Math.hypot(p.vx, p.vz), run = clamp(sp / 190, 0, 1), ph = p.anim, air = p.y > 0.5, act = p.act, t = o.t;
  const P = { lean: 0, legA: [0.12, 0.06], legB: [-0.12, -0.08], armA: [0.25, 0.6], armB: [-0.2, 0.15], ground: !air, mouth: 0, ball: null, one: false, bob: Math.sin(t * 2.2 + p.idx * 2) * 0.8, sway: Math.sin(t * 3 + p.idx) * 0.1 };
  const s1 = Math.sin(ph), c1 = Math.cos(ph);
  if (run > 0.08 && !air) {
    const back = o.defend ? 0.55 : 1;
    P.legA = [0.9 * s1 * run * back, 0.9 * s1 * run * back - 1.0 * (0.5 + 0.5 * c1) * run - 0.1];
    P.legB = [-0.9 * s1 * run * back, -0.9 * s1 * run * back - 1.0 * (0.5 - 0.5 * c1) * run - 0.1];
    P.armA = [-0.8 * s1 * run, -0.8 * s1 * run + 1.1]; P.armB = [0.8 * s1 * run, 0.8 * s1 * run + 1.1];
    P.lean = 0.17 * run; P.bob = -Math.abs(c1) * 3 * run; P.sway = s1 * 0.4 * run;
  }
  if (air) { P.legA = [0.15, -0.2]; P.legB = [-0.1, -0.5]; }
  if (o.defend && act === "" && !air) {
    const w = s1 * 0.16 * run;
    P.legA = [0.6 + w, 0.02 + w]; P.legB = [-0.38 - w, -0.86 - w]; P.lean = 0.2;
    const wv = Math.sin(t * 7 + p.idx * 1.7) * 0.16;
    P.armA = [2.25 + wv, 2.85 + wv]; P.armB = [1.25 - wv, 1.75 - wv];
  }
  if (o.ball && act === "") {
    if (o.dribble) { P.one = true; P.ball = o.ball[1] < -20 ? o.ball : [o.ball[0] * 0.9, -34]; if (run < 0.08) { P.legA = [0.4, -0.1]; P.legB = [-0.3, -0.7]; P.lean = 0.14; P.armB = [-0.5, 0.3]; } }
    else P.ball = o.ball;
  }
  if (act === "wind") { P.legA = [0.55, -0.4]; P.legB = [0.3, -0.65]; P.lean = 0.06; P.ball = o.ball; }
  else if (act === "air") { P.legA = [0.14, -0.22]; P.legB = [-0.06, -0.42]; P.ball = o.ball; P.lean = -0.04; }
  else if (act === "follow") { P.armA = [2.8, 2.15]; P.armB = [1.7, 2.4]; P.lean = 0.03; P.mouth = 0.5; if (!air) { P.legA = [0.2, 0]; P.legB = [-0.15, -0.3]; } }
  else if (act === "pass") { P.armA = [1.45, 1.6]; P.armB = [1.3, 1.62]; P.lean = 0.3; if (run < 0.2) { P.legA = [0.55, 0.1]; P.legB = [-0.4, -0.75]; } }
  else if (act === "steal") { P.armA = [1.2, 1.38]; P.armB = [-0.45, 0.25]; P.lean = 0.44; P.legA = [0.8, 0.15]; P.legB = [-0.55, -0.95]; }
  else if (act === "jump") { P.armA = [2.0, 2.62]; P.armB = [3.0, 3.1]; P.legA = [0.1, -0.2]; P.legB = [-0.16, -0.58]; P.mouth = 0.6; }
  else if (act === "dunk") { P.one = true; P.farBall = true; P.ball = o.ball; P.armA = [-0.9, -0.25]; P.legA = [1.05, -0.5]; P.legB = [0.5, -0.95]; P.lean = -0.12; P.mouth = 1; }
  else if (act === "hang") { P.armB = [2.9, 3.0]; P.armA = [-0.6, 0.1]; P.legA = [0.5 + Math.sin(t * 14) * 0.2, -0.5]; P.legB = [0.1 + Math.sin(t * 14) * 0.2, -0.8]; P.mouth = 1; P.lean = -0.1; }
  else if (act === "layup") { P.one = true; P.ball = o.ball; P.armB = [0.6, 1.4]; P.legA = [0.95, -0.4]; P.legB = [-0.2, -0.55]; }
  else if (act === "cele") { const w = Math.sin(t * 13) * 0.25; P.armA = [2.75 + w, 3.0 + w]; P.armB = [2.5 - w, 2.9 - w]; P.mouth = 1; P.bob = -Math.abs(Math.sin(t * 9)) * 7; P.ground = false; }
  else if (act === "stun") { P.lean = -0.26; P.armA = [1.3, 0.7]; P.armB = [-0.9, -0.35]; P.mouth = 0.7; }
  else if (act === "ready") { P.legA = [0.55, -0.35]; P.legB = [-0.3, -0.8]; P.armA = [1.0, 2.0]; P.armB = [0.6, 1.7]; P.lean = 0.12; }
  return P;
}

/** Draw one athlete with feet at (x, y). face is 1 or -1. look: { skin, hair, style, jersey, trim, shorts, shoe, num } */
export function drawAthlete(ctx, x, y, s, face, P, look, o = {}) {
  ctx.save(); ctx.translate(x, y + (P.ground ? 0 : 0)); ctx.scale(s * face, s);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const TH = 22, SHN = 23, UA = 19, FA = 18, TOR = 34;
  const footDrop = (lg) => Math.cos(lg[0]) * TH + Math.cos(lg[1]) * SHN;
  let hipY = P.ground ? -Math.max(footDrop(P.legA), footDrop(P.legB)) + 1 : -44;
  hipY += P.ground ? Math.min(0, P.bob || 0) * 0.6 : P.bob || 0;
  const hip = [0, hipY], sh = [Math.sin(P.lean) * TOR, hipY - Math.cos(P.lean) * TOR];
  const head = [sh[0] + Math.sin(P.lean) * 17 + 2.5, sh[1] - Math.cos(P.lean) * 17];
  const seg = (a, b, w, col) => {
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 4.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  };
  const shade = (a, b, w) => { ctx.strokeStyle = "rgba(23,37,84,.22)"; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const leg = (lg, far) => {
    const hp = [hip[0] + (far ? -2 : 2), hip[1]], kn = jt(hp, lg[0], TH), ft = jt(kn, lg[1], SHN);
    seg(kn, ft, 8.5, look.skin);
    const sk = [lerp(kn[0], ft[0], 0.66), lerp(kn[1], ft[1], 0.66)];
    ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 8.5; ctx.beginPath(); ctx.moveTo(sk[0], sk[1]); ctx.lineTo(ft[0], ft[1]); ctx.stroke();
    seg(hp, kn, 10.5, look.skin);
    const md = [lerp(hp[0], kn[0], 0.62), lerp(hp[1], kn[1], 0.62)];
    seg(hp, md, 13, look.shorts);
    if (far) { shade(kn, ft, 8.5); shade(hp, kn, 13); }
    const fa = Math.atan2(ft[1] - kn[1], ft[0] - kn[0]) - Math.PI / 2;
    ctx.save(); ctx.translate(ft[0], ft[1]); ctx.rotate(clamp(fa, -0.9, 0.5));
    ctx.fillStyle = look.shoe || "#f8fafc"; ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(4, 1.5, 10, 5.6, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = look.trim; ctx.fillRect(1, -1.2, 7, 2.4);
    ctx.restore();
  };
  const arm = (ar, far, toBall) => {
    const S = [sh[0] + (far ? -3 : 3), sh[1] + 4];
    let el, hd;
    if (toBall) [el, hd] = ik(S, toBall, UA, FA);
    else { el = jt(S, ar[0], UA); hd = jt(el, ar[1], FA); }
    seg(el, hd, 6.6, look.skin); seg(S, el, 7.6, look.skin);
    if (far) { shade(el, hd, 6.6); shade(S, el, 7.6); }
    ctx.fillStyle = look.skin; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(hd[0], hd[1], 4.6, 0, 6.283); ctx.fill(); ctx.stroke();
    const wb = [lerp(el[0], hd[0], 0.62), lerp(el[1], hd[1], 0.62)], wb2 = [lerp(el[0], hd[0], 0.78), lerp(el[1], hd[1], 0.78)];
    ctx.strokeStyle = look.trim; ctx.lineWidth = 6.8; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(wb[0], wb[1]); ctx.lineTo(wb2[0], wb2[1]); ctx.stroke(); ctx.lineCap = "round";
  };
  if (o.glow) {
    const g = ctx.createRadialGradient(0, -56, 6, 0, -56, 74);
    g.addColorStop(0, "rgba(251,146,60,.55)"); g.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = g; ctx.fillRect(-76, -132, 152, 150);
  }
  // far side first
  arm(P.armB, true, P.ball && (!P.one || P.farBall) ? [P.ball[0] - 3, P.ball[1] + 3] : null);
  leg(P.legB, true);
  leg(P.legA, false);
  // torso
  const waist = [hip[0], hip[1] - 5];
  seg(waist, [sh[0], sh[1] + 5], 23, look.jersey);
  seg([hip[0] - 0.5, hip[1] - 3], [hip[0] + 0.5, hip[1] + 1], 23, look.shorts);
  ctx.strokeStyle = look.trim; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(hip[0] - 9, hip[1] - 9); ctx.lineTo(hip[0] + 9, hip[1] - 9); ctx.stroke();
  // number
  ctx.save(); ctx.translate(lerp(waist[0], sh[0], 0.55), lerp(waist[1], sh[1], 0.55) + 1); ctx.rotate(-P.lean); if (face < 0) ctx.scale(-1, 1);
  ctx.fillStyle = look.trim; ctx.font = `900 ${String(look.num).length > 1 ? 12.5 : 16}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(23,37,84,.55)"; ctx.strokeText(String(look.num), 0, 0); ctx.fillText(String(look.num), 0, 0); ctx.restore();
  // neck and head
  seg([sh[0] + 1, sh[1] + 2], [lerp(sh[0], head[0], 0.5), lerp(sh[1], head[1], 0.5)], 7, look.skin);
  const hx = head[0], hy = head[1], R = 13.5, st = look.style, sw = P.sway || 0;
  ctx.fillStyle = look.hair; ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
  if (st === "afro") { ctx.beginPath(); ctx.arc(hx - 2, hy - 4, 18.5, 0, 6.283); ctx.fill(); ctx.stroke(); }
  if (st === "pony") { ctx.save(); ctx.translate(hx - 11, hy - 5); ctx.rotate(0.5 - sw); ctx.beginPath(); ctx.ellipse(-5, 9, 5.5, 12, 0, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (st === "bun") { ctx.beginPath(); ctx.arc(hx - 8, hy - 15, 6.5, 0, 6.283); ctx.fill(); ctx.stroke(); }
  if (st === "puffs") { ctx.beginPath(); ctx.arc(hx - 12, hy - 9, 7.5, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(hx + 1, hy - 17, 7, 0, 6.283); ctx.fill(); ctx.stroke(); }
  if (st === "spikes") { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.19); ctx.moveTo(hx + Math.cos(a - 0.14) * 12, hy + Math.sin(a - 0.14) * 12); ctx.lineTo(hx + Math.cos(a) * 21, hy + Math.sin(a) * 21); ctx.lineTo(hx + Math.cos(a + 0.14) * 12, hy + Math.sin(a + 0.14) * 12); } ctx.fill(); ctx.stroke(); }
  if (st === "flat") { rr(ctx, hx - 13, hy - 18, 23, 9, 3); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(hx, hy, R, 0, 6.283); ctx.fill(); ctx.stroke();
  // ear
  ctx.beginPath(); ctx.arc(hx - 4, hy + 2, 3, 0, 6.283); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
  // hair cap
  if (st !== "bald") {
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(hx, hy, R - 0.4, Math.PI * 0.86, Math.PI * 1.8); ctx.closePath(); ctx.fill();
  }
  if (st === "band" || look.band) { ctx.strokeStyle = look.trim; ctx.lineWidth = 3.6; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(hx - 12.4, hy - 3.5); ctx.lineTo(hx + 12.6, hy - 6.5); ctx.stroke(); ctx.lineCap = "round"; }
  // face
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(hx + 4.6, hy - 0.5, 3.5, 4.4, 0, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 10.6, hy - 0.5, 2.3, 3.8, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(hx + 5.8, hy - 0.2, 2, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(hx + 11.2, hy - 0.2, 1.6, 0, 6.283); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
  if (P.mouth > 0.4) { ctx.fillStyle = "#7f1d1d"; ctx.beginPath(); ctx.ellipse(hx + 7.5, hy + 7, 3.2, 2 + P.mouth * 2, 0, 0, 6.283); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx + 7, hy + 4.5, 3.6, 0.25, Math.PI - 0.5); ctx.stroke(); }
  // near arm on top
  arm(P.armA, false, P.farBall ? null : P.ball || null);
  ctx.restore();
}
