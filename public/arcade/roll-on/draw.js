// Roll On: all the drawing. Bright cartoon shapes with thick dark outlines, built from canvas paths only.
import { FONT, drawArchie } from "../kit/kit.js";
import { T, R, HT, BOT, CRATE, BOSS, EW, SAWA, enemyX, enemyDir, moverPos, bossSpiked } from "./sim.js";

export const INK = "#1b1b3a";
export const THEMES = [
  { name: "hills", sky: ["#38b6ff", "#c9f1ff"], far: "#a9ecb0", far2: "#8fe09a", mid: "#63cf6c", mid2: "#49b95a", dirt: "#c07a3e", dirt2: "#a4612c", dirt3: "#d49354", grass: "#5cd43e", grass2: "#93ee5c", edge: "#2c8a2a", line: "#3a2110", glow: "#fff7b0" },
  { name: "works", sky: ["#ff9f5a", "#ffe6b8"], far: "#f4b274", far2: "#e89a5b", mid: "#c9743f", mid2: "#a85a2e", dirt: "#7d94b5", dirt2: "#62799b", dirt3: "#96abc8", grass: "#ffd23f", grass2: "#2a2f45", edge: "#1f2437", line: "#1f2437", glow: "#fff1c2" },
  { name: "woods", sky: ["#161a5c", "#5546b0"], far: "#31389a", far2: "#2a2f86", mid: "#1f2470", mid2: "#181b58", dirt: "#6a4aa3", dirt2: "#533787", dirt3: "#8463bd", grass: "#2ed3a6", grass2: "#86f3d2", edge: "#0f7a66", line: "#130d38", glow: "#fff6c9" },
];
const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
const star = (c, x, y, r, rot = -Math.PI / 2, inner = 0.48) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, q = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); };

export function createRenderer(ctx) {
  const pats = new Map();
  function pattern(th) {
    if (pats.has(th.name)) return pats.get(th.name);
    const c = document.createElement("canvas"); c.width = c.height = 120; const x = c.getContext("2d");
    x.fillStyle = th.dirt; x.fillRect(0, 0, 120, 120);
    if (th.name === "works") {
      x.strokeStyle = th.dirt2; x.lineWidth = 4; for (let i = 0; i < 3; i++) { x.strokeRect(-2, i * 40, 60 + (i % 2) * 30, 40); x.strokeRect(58 + (i % 2) * 30, i * 40, 124, 40); }
      x.fillStyle = th.dirt3; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(10 + j * 30 + (i % 2) * 14, i * 40 + 10, 3, 0, 7); x.fill(); }
    } else {
      for (let i = 0; i < 9; i++) {
        const px = hash(i * 3 + 1) * 120, py = hash(i * 3 + 2) * 120, w = 16 + hash(i * 3 + 3) * 20;
        x.fillStyle = i % 3 ? th.dirt2 : th.dirt3;
        for (const ox of [0, -120, 120]) for (const oy of [0, -120, 120]) { rr(x, px + ox, py + oy, w, w * 0.62, 7); x.fill(); }
      }
    }
    const p = ctx.createPattern(c, "repeat"); pats.set(th.name, p); return p;
  }

  /** Paths and scenery for a level, made once. */
  function prep(L, seed) {
    const th = THEMES[L.theme];
    L.gfx = { runs: [], deco: [] };
    let n = seed * 97 + 5;
    const rnd = () => hash(n++);
    for (const r of L.runs) {
      const poly = new Path2D(), top = new Path2D();
      poly.moveTo(r[0][0], BOT);
      let pen = false;
      for (let i = 0; i < r.length; i++) {
        poly.lineTo(r[i][0], r[i][1]);
        if (i && r[i][0] - r[i - 1][0] > 0.5) { if (!pen) top.moveTo(r[i - 1][0], r[i - 1][1]); top.lineTo(r[i][0], r[i][1]); pen = true; } else pen = false;
      }
      poly.lineTo(r[r.length - 1][0], BOT); poly.closePath();
      L.gfx.runs.push({ poly, top, x0: r[0][0], x1: r[r.length - 1][0] });
      // scenery on the flatter parts
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i], w = b[0] - a[0];
        if (w < 20 || Math.abs(b[1] - a[1]) / w > 0.25) continue;
        for (let x = a[0] + 30 + rnd() * 60; x < b[0] - 30; x += 70 + rnd() * 150) {
          const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / w, k = rnd();
          L.gfx.deco.push({ x, y, kind: k < 0.3 ? "tree" : k < 0.55 ? "bush" : k < 0.85 ? "flower" : "rock", s: 0.8 + rnd() * 0.5, v: rnd() });
        }
      }
    }
    // keep scenery away from things you play with
    const busy = [];
    for (const q of L.buttons) busy.push(q.x); for (const q of L.gates) busy.push(q.x + 16); for (const q of L.springs) busy.push(q.x); for (const q of L.signs) busy.push(q.x); for (const q of L.cps) busy.push(q.x); busy.push(L.goal.x);
    L.gfx.deco = L.gfx.deco.filter((d) => !busy.some((x) => Math.abs(x - d.x) < (d.kind === "tree" ? 70 : 40)));
    L.gfx.th = th;
  }

  // ---------- backdrop ----------
  function backdrop(th, cx, cy, vw, vh, t, calm) {
    const g = ctx.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    const lift = (HT * T - 700 - cy) * 0.06;
    if (th.name === "woods") {
      for (let i = 0; i < 70; i++) { const x = ((hash(i) * 2400 - cx * 0.03) % vw + vw) % vw, y = hash(i + 200) * vh * 0.6, tw = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * tw})`; ctx.fillRect(x, y, 2.4, 2.4); }
      const mx = vw * 0.74 - cx * 0.02, my = vh * 0.2 + lift * 0.3;
      const h = ctx.createRadialGradient(mx, my, 20, mx, my, 170); h.addColorStop(0, "rgba(255,246,201,0.5)"); h.addColorStop(1, "rgba(255,246,201,0)"); ctx.fillStyle = h; ctx.fillRect(mx - 170, my - 170, 340, 340);
      ctx.fillStyle = th.glow; ctx.beginPath(); ctx.arc(mx, my, 62, 0, 7); ctx.fill();
      ctx.fillStyle = "#e9dca0"; for (const [a, b, r] of [[-20, -14, 13], [18, 10, 9], [-6, 26, 7], [26, -24, 6]]) { ctx.beginPath(); ctx.arc(mx + a, my + b, r, 0, 7); ctx.fill(); }
    } else if (!calm) {
      const sx = vw * 0.8 - cx * 0.02, sy = vh * 0.17 + lift * 0.3;
      const h = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150); h.addColorStop(0, "rgba(255,255,255,0.75)"); h.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = h; ctx.fillRect(sx - 150, sy - 150, 300, 300);
      ctx.fillStyle = th.glow; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, 7); ctx.fill();
    }
    // clouds
    const cl = th.name === "woods" ? "rgba(140,130,220,0.35)" : th.name === "works" ? "rgba(255,246,230,0.85)" : "#ffffff";
    for (let i = 0; i < (calm ? 0 : 7); i++) {
      const span = vw + 500, x = (((i * 290 + hash(i + 9) * 120 - cx * (0.08 + (i % 3) * 0.03) + t * (3 + (i % 3))) % span) + span) % span - 250, y = 40 + hash(i + 40) * vh * 0.34 + lift * 0.5, s = 0.7 + hash(i + 70) * 0.8;
      ctx.fillStyle = cl; ctx.beginPath();
      for (const [a, b, r] of [[-52, 8, 26], [-24, -8, 34], [12, -16, 40], [48, -2, 30], [76, 10, 22], [10, 14, 34], [-20, 16, 28], [44, 16, 26]]) { ctx.moveTo(x + a * s + r * s, y + b * s); ctx.arc(x + a * s, y + b * s, r * s, 0, 7); }
      ctx.fill();
    }
    const base = vh * 0.66 + lift;
    layer(th, cx * 0.22, base, vw, vh, th.far, th.far2, 0, t);
    layer(th, cx * 0.42, base + 62, vw, vh, th.mid, th.mid2, 1, t);
  }
  function layer(th, off, base, vw, vh, c1, c2, k, t) {
    if (th.name === "works") {
      // factory skyline
      const W = k ? 150 : 190;
      for (let i = Math.floor(off / W) - 1; i * W - off < vw + W; i++) {
        const x = i * W - off, h = 70 + hash(i + k * 50) * (k ? 120 : 150), w = W * (0.55 + hash(i + 7 + k) * 0.35);
        ctx.fillStyle = c1; ctx.fillRect(x, base - h, w, vh);
        ctx.fillStyle = c2; ctx.fillRect(x + w * 0.62, base - h, w * 0.38, vh);
        if (hash(i + 3 + k * 9) > 0.45) { // chimney and smoke
          const cxx = x + w * 0.25; ctx.fillStyle = c2; ctx.fillRect(cxx, base - h - 60, 20, 62); ctx.fillStyle = c1; ctx.fillRect(cxx - 3, base - h - 66, 26, 9);
          for (let j = 0; j < 4; j++) { const u = (t * 0.25 + j * 0.25 + hash(i)) % 1; ctx.fillStyle = `rgba(255,250,240,${0.5 * (1 - u)})`; ctx.beginPath(); ctx.arc(cxx + 10 + u * 34, base - h - 74 - u * 70, 9 + u * 16, 0, 7); ctx.fill(); }
        }
        if (k) { ctx.fillStyle = "#ffe08a"; for (let j = 0; j < 3; j++) for (let m = 0; m < 2; m++) if (hash(i * 7 + j * 3 + m) > 0.35) ctx.fillRect(x + 12 + j * 22, base - h + 16 + m * 30, 12, 16); }
        else if (hash(i + 31) > 0.6) gear(x + w + 26, base - 30, 30, t * 0.4 + i, c2);
      }
      ctx.fillStyle = k ? c2 : c1; ctx.fillRect(0, base, vw, vh);
      return;
    }
    // rolling hills
    ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, vh);
    const amp = k ? 34 : 46, f = k ? 0.008 : 0.0052;
    const hy = (x) => base - amp * (Math.sin((x + off) * f) * 0.6 + Math.sin((x + off) * f * 2.3 + 1.7) * 0.4) - amp;
    for (let x = 0; x <= vw + 12; x += 12) ctx.lineTo(x, hy(x));
    ctx.lineTo(vw, vh); ctx.closePath(); ctx.fill();
    // trees on the ridge
    const W = k ? 120 : 170;
    for (let i = Math.floor(off / W) - 1; i * W - off < vw + W; i++) {
      if (hash(i + k * 91) < 0.3) continue;
      const x = i * W - off + hash(i + 5) * 60, y = hy(x) + 6, s = (k ? 1 : 0.75) * (0.8 + hash(i + 12) * 0.5);
      if (th.name === "woods") { ctx.fillStyle = c2; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x, y - (86 - j * 20) * s); ctx.lineTo(x - (16 + j * 9) * s, y - (40 - j * 20) * s); ctx.lineTo(x + (16 + j * 9) * s, y - (40 - j * 20) * s); ctx.closePath(); ctx.fill(); } ctx.fillRect(x - 3 * s, y - 4 * s, 6 * s, 8 * s); }
      else { ctx.fillStyle = c2; ctx.fillRect(x - 3 * s, y - 30 * s, 6 * s, 32 * s); ctx.beginPath(); ctx.arc(x, y - 42 * s, 22 * s, 0, 7); ctx.arc(x - 14 * s, y - 30 * s, 14 * s, 0, 7); ctx.arc(x + 14 * s, y - 30 * s, 14 * s, 0, 7); ctx.fill(); }
    }
    // a lighter stripe that follows the ridge
    ctx.strokeStyle = c2; ctx.lineWidth = 5; ctx.globalAlpha = 0.5; ctx.beginPath(); for (let x = 0; x <= vw + 12; x += 12) ctx.lineTo(x, hy(x) + 16 + (k ? 6 : 10)); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function gear(x, y, r, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const q = (i * Math.PI) / 8, rad = i % 2 ? r : r * 0.78; ctx.lineTo(Math.cos(q - 0.12) * rad, Math.sin(q - 0.12) * rad); ctx.lineTo(Math.cos(q + 0.12) * rad, Math.sin(q + 0.12) * rad); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ---------- world ----------
  function ground(th, path, top) {
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = pattern(th); ctx.fill(path);
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    ctx.strokeStyle = th.edge; ctx.lineWidth = 40; ctx.stroke(top);
    ctx.strokeStyle = th.grass; ctx.lineWidth = 32; ctx.stroke(top);
    ctx.strokeStyle = th.grass2; ctx.setLineDash([14, 14]); ctx.stroke(top); ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = th.line; ctx.lineWidth = 4.5; ctx.lineJoin = "round"; ctx.stroke(path);
  }
  function rect(th, r) {
    if (r.kind === "wood") {
      ctx.fillStyle = "#c98a45"; ctx.strokeStyle = th.line; ctx.lineWidth = 4;
      rr(ctx, r.x - 3, r.y, r.w + 6, r.h, 4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#8a5522"; ctx.lineWidth = 2.5; ctx.beginPath(); for (let x = r.x + 20; x < r.x + r.w - 6; x += 20) { ctx.moveTo(x, r.y + 2); ctx.lineTo(x, r.y + r.h - 2); } ctx.stroke();
      ctx.fillStyle = "#e8b06a"; ctx.fillRect(r.x, r.y + 3, r.w, 3);
      for (const x of [r.x + 2, r.x + r.w - 2]) { ctx.fillStyle = "#8a5522"; ctx.strokeStyle = th.line; ctx.lineWidth = 3; rr(ctx, x - 5, r.y - 16, 10, 24, 3); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = "#f3e2b4"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x + 2, r.y - 12); ctx.quadraticCurveTo(r.x + r.w / 2, r.y - 2, r.x + r.w - 2, r.y - 12); ctx.stroke();
      return;
    }
    if (r.kind === "tower") {
      const stone = th.name === "works" ? ["#8ea2bd", "#7087a6"] : th.name === "woods" ? ["#7b6bb8", "#6253a0"] : ["#c9c2b2", "#b0a894"];
      ctx.fillStyle = stone[0]; ctx.strokeStyle = th.line; ctx.lineWidth = 4; ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill();
      ctx.fillStyle = stone[1]; for (let y = r.y + r.h - 22, i = 0; y > r.y - 22; y -= 22, i++) ctx.fillRect(r.x + (i % 2 ? 4 : r.w / 2 + 2), y + 4, r.w / 2 - 6, 14);
      ctx.stroke(); rr(ctx, r.x - 6, r.y + r.h - 12, r.w + 12, 12, 3); ctx.fillStyle = stone[1]; ctx.fill(); ctx.stroke();
      return;
    }
    const p = new Path2D(); p.rect(r.x, r.y, r.w, r.h);
    const top = new Path2D(); top.moveTo(r.x, r.y); top.lineTo(r.x + r.w, r.y);
    if (r.h < 30) { // a thin floating slab
      ctx.fillStyle = th.name === "works" ? th.dirt : th.dirt2; ctx.strokeStyle = th.line; ctx.lineWidth = 4.5; rr(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = th.grass; ctx.fillRect(r.x, r.y, r.w, 11); ctx.fillStyle = th.grass2; for (let x = r.x + 2; x < r.x + r.w; x += 28) ctx.fillRect(x, r.y, 14, 11); ctx.restore();
      rr(ctx, r.x, r.y, r.w, r.h, 6); ctx.stroke();
    } else ground(th, p, top);
  }
  function deco(th, d, t) {
    const s = d.s; ctx.save(); ctx.translate(d.x, d.y + 2); ctx.lineJoin = "round";
    ctx.strokeStyle = th.line; ctx.lineWidth = 3.5;
    if (th.name === "hills") {
      if (d.kind === "tree") {
        ctx.fillStyle = "#9a5a2a"; rr(ctx, -6 * s, -58 * s, 12 * s, 60 * s, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.v > 0.5 ? "#3fbf4f" : "#58cf48"; ctx.beginPath(); ctx.arc(0, -84 * s, 34 * s, 0, 7); ctx.moveTo(-4 * s, -62 * s); ctx.arc(-26 * s, -62 * s, 22 * s, 0, 7); ctx.moveTo(48 * s, -62 * s); ctx.arc(26 * s, -62 * s, 22 * s, 0, 7); ctx.stroke(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.beginPath(); ctx.arc(-10 * s, -94 * s, 12 * s, 0, 7); ctx.fill();
        if (d.v > 0.6) { ctx.fillStyle = "#ff5a6a"; for (const [a, b] of [[-18, -66], [12, -90], [22, -60]]) { ctx.beginPath(); ctx.arc(a * s, b * s, 5 * s, 0, 7); ctx.fill(); } }
      } else if (d.kind === "bush") {
        ctx.fillStyle = "#49c257"; ctx.beginPath(); ctx.arc(-14 * s, -6 * s, 14 * s, 0, 7); ctx.moveTo(26 * s, -10 * s); ctx.arc(8 * s, -10 * s, 18 * s, 0, 7); ctx.moveTo(38 * s, -4 * s); ctx.arc(26 * s, -4 * s, 12 * s, 0, 7); ctx.stroke(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(4 * s, -18 * s, 6 * s, 0, 7); ctx.fill();
      } else if (d.kind === "flower") {
        const sway = Math.sin(t * 2 + d.x) * 2;
        ctx.strokeStyle = "#2c8a2a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -12 * s, sway, -22 * s); ctx.stroke();
        ctx.strokeStyle = th.line; ctx.lineWidth = 2.5; ctx.fillStyle = ["#ff6b9a", "#ffd23f", "#ffffff", "#ff8a3d"][Math.floor(d.v * 4)];
        for (let i = 0; i < 5; i++) { const a = (i * 6.283) / 5 + t * 0.3; ctx.beginPath(); ctx.arc(sway + Math.cos(a) * 6 * s, -22 * s + Math.sin(a) * 6 * s, 4.6 * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = "#ffb020"; ctx.beginPath(); ctx.arc(sway, -22 * s, 4 * s, 0, 7); ctx.fill(); ctx.stroke();
      } else { ctx.fillStyle = "#b9b3a6"; ctx.beginPath(); ctx.ellipse(0, -7 * s, 16 * s, 10 * s, 0, Math.PI, 0); ctx.lineTo(16 * s, 0); ctx.lineTo(-16 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (th.name === "works") {
      if (d.kind === "tree") { // lamp post
        ctx.fillStyle = "#4b556b"; rr(ctx, -4, -92 * s, 8, 94 * s, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffe98a"; ctx.beginPath(); ctx.arc(0, -98 * s, 12 * s, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,233,138,0.25)"; ctx.beginPath(); ctx.arc(0, -98 * s, 26 * s, 0, 7); ctx.fill();
      } else if (d.kind === "bush") { // barrel
        ctx.fillStyle = d.v > 0.5 ? "#e2603a" : "#3aa6a0"; rr(ctx, -14 * s, -34 * s, 28 * s, 36 * s, 6); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-14 * s, -24 * s); ctx.lineTo(14 * s, -24 * s); ctx.moveTo(-14 * s, -10 * s); ctx.lineTo(14 * s, -10 * s); ctx.stroke();
      } else if (d.kind === "flower") { // small gear
        ctx.save(); ctx.translate(0, -16 * s); ctx.rotate(t * (d.v > 0.5 ? 1 : -1)); ctx.fillStyle = "#f2b445"; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const q = (i * Math.PI) / 8, rad = (i % 2 ? 15 : 11) * s; ctx.lineTo(Math.cos(q - 0.14) * rad, Math.sin(q - 0.14) * rad); ctx.lineTo(Math.cos(q + 0.14) * rad, Math.sin(q + 0.14) * rad); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = th.line; ctx.beginPath(); ctx.arc(0, 0, 4 * s, 0, 7); ctx.fill(); ctx.restore();
      } else { ctx.fillStyle = "#5d6f8a"; rr(ctx, -18 * s, -14 * s, 36 * s, 16 * s, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ffd23f"; ctx.fillRect(-12 * s, -10 * s, 8 * s, 6 * s); }
    } else {
      if (d.kind === "tree") {
        ctx.fillStyle = "#3b2a66"; rr(ctx, -6 * s, -40 * s, 12 * s, 42 * s, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.v > 0.5 ? "#1f9c8a" : "#27b39a";
        for (let j = 2; j >= 0; j--) { ctx.beginPath(); ctx.moveTo(0, -(130 - j * 30) * s); ctx.lineTo(-(22 + j * 12) * s, -(64 - j * 28) * s); ctx.lineTo((22 + j * 12) * s, -(64 - j * 28) * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else if (d.kind === "bush" || d.kind === "flower") { // glowing mushroom
        const g = 0.6 + 0.4 * Math.sin(t * 2 + d.x);
        ctx.fillStyle = `rgba(255,236,150,${0.22 * g})`; ctx.beginPath(); ctx.arc(0, -16 * s, 28 * s, 0, 7); ctx.fill();
        ctx.fillStyle = "#f4ecd8"; rr(ctx, -4 * s, -14 * s, 8 * s, 16 * s, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.v > 0.5 ? "#ff7ab8" : "#ffd45a"; ctx.beginPath(); ctx.ellipse(0, -14 * s, 15 * s, 11 * s, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5 * s, -19 * s, 2.4 * s, 0, 7); ctx.arc(5 * s, -17 * s, 2 * s, 0, 7); ctx.fill();
      } else { ctx.fillStyle = "#6f63a8"; ctx.beginPath(); ctx.ellipse(0, -7 * s, 16 * s, 10 * s, 0, Math.PI, 0); ctx.lineTo(16 * s, 0); ctx.lineTo(-16 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawStar(x, y, r, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + x * 0.05) * 3); ctx.scale(0.82 + 0.18 * Math.cos(t * 2.4 + x * 0.03), 1);
    ctx.lineJoin = "round"; ctx.fillStyle = "#ffd21f"; ctx.strokeStyle = "#8a4b00"; ctx.lineWidth = 3;
    star(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff6a8"; star(ctx, -1, -1.5, r * 0.45); ctx.fill();
    ctx.restore();
  }
  /** A grumpy block. (x, y) is the middle of its base. */
  function block(x, y, w, o = {}) {
    const { spiky = 0, dir = 1, t = 0, flat = 0, look = null, color = spiky ? "#7c4ddb" : "#ff9a1f", dark = spiky ? "#5b34b0" : "#d8700a", angry = 0, hat = 0, hp = 0, spikes = spiky ? 1 : 0, alpha = 1, walk = 1 } = o;
    const h = w * (1 - flat * 0.8), ww = w * (1 + flat * 0.5), step = walk ? Math.sin(t * 9) : 0;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= alpha; ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, w * 0.085);
    if (spikes > 0) { // spikes all round
      const n = Math.round(w / 9), len = w * 0.2 * spikes; ctx.fillStyle = "#f3f4f8"; ctx.beginPath();
      for (let i = 0; i < n; i++) { const u = -ww / 2 + ((i + 0.5) * ww) / n; ctx.moveTo(u - 5, -h + 2); ctx.lineTo(u, -h - len); ctx.lineTo(u + 5, -h + 2); }
      for (let i = 0; i < Math.round(n * 0.75); i++) { const v = -h + ((i + 0.6) * h) / (n * 0.75); ctx.moveTo(-ww / 2 + 2, v - 5); ctx.lineTo(-ww / 2 - len, v); ctx.lineTo(-ww / 2 + 2, v + 5); ctx.moveTo(ww / 2 - 2, v - 5); ctx.lineTo(ww / 2 + len, v); ctx.lineTo(ww / 2 - 2, v + 5); }
      ctx.lineWidth = Math.max(2, w * 0.05); ctx.fill(); ctx.stroke(); ctx.lineWidth = Math.max(3, w * 0.085);
    }
    // feet
    if (!flat) { ctx.fillStyle = dark; for (const sgn of [-1, 1]) { rr(ctx, sgn * ww * 0.26 - w * 0.13 + step * sgn * w * 0.05, -w * 0.08 - Math.max(0, step * sgn) * w * 0.08, w * 0.26, w * 0.14, w * 0.06); ctx.fill(); ctx.stroke(); } }
    const by = -h - (flat ? 0 : w * 0.06) + Math.abs(step) * w * 0.02;
    ctx.fillStyle = color; rr(ctx, -ww / 2, by, ww, h, w * 0.2); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = dark; ctx.fillRect(-ww / 2, by + h * 0.72, ww, h); ctx.fillStyle = "rgba(255,255,255,0.3)"; rr(ctx, -ww / 2 + w * 0.1, by + h * 0.08, ww * 0.4, h * 0.14, h * 0.07); ctx.fill(); ctx.restore();
    rr(ctx, -ww / 2, by, ww, h, w * 0.2); ctx.stroke();
    // face
    const lx = look ? Math.max(-1, Math.min(1, look.x)) : dir, ly = look ? Math.max(-1, Math.min(1, look.y)) : 0, ey = by + h * 0.42, ex = ww * 0.2;
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(sgn * ex + lx * w * 0.03, ey, w * 0.13, Math.max(1, h * 0.15), 0, 0, 7); ctx.fill(); ctx.lineWidth = Math.max(1.5, w * 0.04); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sgn * ex + lx * w * 0.08, ey + ly * h * 0.05, Math.min(w * 0.065, h * 0.1), 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(2.5, w * 0.08); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(sgn * (ex + w * 0.16), ey - h * (0.26 + angry * 0.04)); ctx.lineTo(sgn * (ex - w * 0.12), ey - h * (0.14 - angry * 0.04)); ctx.stroke();
    }
    ctx.lineWidth = Math.max(2, w * 0.06); ctx.beginPath(); ctx.arc(lx * w * 0.04, by + h * 0.86, w * 0.16, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    if (!flat && !spiky) { ctx.fillStyle = "#fff"; ctx.lineWidth = Math.max(1.5, w * 0.035); rr(ctx, lx * w * 0.04 + w * 0.02, by + h * 0.7, w * 0.09, h * 0.1, 2); ctx.fill(); ctx.stroke(); }
    if (hat) { // a boss wears something
      ctx.lineWidth = Math.max(3, w * 0.05);
      if (hat === 1) { ctx.fillStyle = "#ffd21f"; ctx.beginPath(); ctx.moveTo(-w * 0.3, by + 2); ctx.lineTo(-w * 0.34, by - w * 0.26); ctx.lineTo(-w * 0.16, by - w * 0.12); ctx.lineTo(0, by - w * 0.32); ctx.lineTo(w * 0.16, by - w * 0.12); ctx.lineTo(w * 0.34, by - w * 0.26); ctx.lineTo(w * 0.3, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (hat === 2) { ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, by + 2, w * 0.36, w * 0.24, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); rr(ctx, -w * 0.46, by - 2, w * 0.92, w * 0.08, 4); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = "#c9d2ff"; ctx.beginPath(); ctx.moveTo(-w * 0.34, by + 2); ctx.lineTo(-w * 0.3, by - w * 0.2); ctx.lineTo(-w * 0.14, by - w * 0.08); ctx.lineTo(0, by - w * 0.3); ctx.lineTo(w * 0.14, by - w * 0.08); ctx.lineTo(w * 0.3, by - w * 0.2); ctx.lineTo(w * 0.34, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#7df3d0"; ctx.beginPath(); ctx.arc(0, by - w * 0.1, w * 0.05, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  /** Ball-Archie. o: ang, sx, sy, tilt, look {x,y}, mood, blink, pattern, hat, alpha */
  function ball(x, y, r, o = {}) {
    const { ang = 0, sx = 1, sy = 1, tilt = 0, look = { x: 0, y: 0 }, mood = "smile", blink = false, pattern = "arch", hat = null, alpha = 1, foot = false } = o;
    ctx.save(); ctx.globalAlpha *= alpha;
    if (foot) { ctx.translate(x, y + r); ctx.scale(sx, sy); ctx.translate(0, -r); } else { ctx.translate(x, y); ctx.scale(sx, sy); }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.fillStyle = "#2f6df0"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.save(); ctx.clip(); ctx.rotate(ang);
    ctx.strokeStyle = "#6fb0ff"; ctx.fillStyle = "#6fb0ff";
    if (pattern === "stripes") { ctx.lineWidth = r * 0.3; ctx.beginPath(); for (const k of [-0.62, 0, 0.62]) { ctx.moveTo(-r, k * r); ctx.lineTo(r, k * r); } ctx.stroke(); }
    else if (pattern === "star") { star(ctx, 0, 0, r * 0.82, ang * 0); ctx.fill(); ctx.fillStyle = "#a9d2ff"; ctx.beginPath(); ctx.arc(r * 0.72, r * 0.5, r * 0.14, 0, 7); ctx.arc(-r * 0.72, r * 0.5, r * 0.14, 0, 7); ctx.fill(); }
    else if (pattern === "swirl") { ctx.lineWidth = r * 0.22; ctx.beginPath(); for (let a = 0; a < 13; a += 0.3) { const q = (a / 13) * r * 1.1; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); } ctx.stroke(); }
    else { // the arch he is made from, wrapped round the ball
      ctx.lineWidth = r * 0.34; ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.62, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.62, r * 0.62, r * 0.17, 0, 7); ctx.arc(r * 0.62, r * 0.62, r * 0.17, 0, 7); ctx.arc(0, -r * 0.78, r * 0.12, 0, 7); ctx.fill();
    }
    ctx.restore();
    // shading that does not roll
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, "rgba(255,255,255,0.28)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(10,20,90,0.4)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.6, r * 0.15); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = r * 0.11; ctx.beginPath(); ctx.arc(0, 0, r * 0.74, Math.PI * 1.12, Math.PI * 1.42); ctx.stroke();
    // face, easing toward upright
    ctx.rotate(tilt);
    const lx = Math.max(-1, Math.min(1, look.x)), ly = Math.max(-1, Math.min(1, look.y)), fx = lx * r * 0.14, fy = ly * r * 0.08 - r * 0.06;
    const ew = Math.max(1.4, r * 0.07);
    for (const sgn of [-1, 1]) {
      const ex = fx + sgn * r * 0.36, ey = fy - r * 0.08;
      ctx.strokeStyle = INK; ctx.lineWidth = ew;
      if (mood === "dizzy") { ctx.lineWidth = ew * 1.3; ctx.beginPath(); for (let a = 0; a < 9; a += 0.4) { const q = (a / 9) * r * 0.26; ctx.lineTo(ex + Math.cos(a + sgn) * q, ey + Math.sin(a + sgn) * q); } ctx.stroke(); }
      else if (mood === "squint" || blink) { ctx.lineWidth = ew * 1.5; ctx.beginPath(); if (mood === "squint") { ctx.moveTo(ex - sgn * r * 0.2, ey - r * 0.16); ctx.lineTo(ex + sgn * r * 0.14, ey); ctx.lineTo(ex - sgn * r * 0.2, ey + r * 0.16); } else { ctx.moveTo(ex - r * 0.2, ey); ctx.quadraticCurveTo(ex, ey + r * 0.14, ex + r * 0.2, ey); } ctx.stroke(); }
      else {
        const big = mood === "ooh" ? 1.12 : 1;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.25 * big, r * 0.31 * big, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lx * r * 0.1, ey + ly * r * 0.11, r * 0.135, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + lx * r * 0.1 - r * 0.05, ey + ly * r * 0.11 - r * 0.06, r * 0.05, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,150,200,0.9)"; ctx.beginPath(); ctx.ellipse(fx + sgn * r * 0.64, fy + r * 0.3, r * 0.14, r * 0.1, 0, 0, 7); ctx.fill();
    }
    const mx = fx, my = fy + r * 0.42; ctx.strokeStyle = INK; ctx.lineWidth = ew * 1.2;
    if (mood === "grin") { ctx.fillStyle = "#7a1230"; ctx.beginPath(); ctx.moveTo(mx - r * 0.3, my - r * 0.06); ctx.quadraticCurveTo(mx, my + r * 0.42, mx + r * 0.3, my - r * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ff7a9a"; ctx.beginPath(); ctx.ellipse(mx, my + r * 0.13, r * 0.11, r * 0.06, 0, 0, 7); ctx.fill(); }
    else if (mood === "ooh") { ctx.fillStyle = "#7a1230"; ctx.beginPath(); ctx.ellipse(mx, my + r * 0.04, r * 0.11, r * 0.15, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    else if (mood === "squint") { ctx.beginPath(); ctx.moveTo(mx - r * 0.26, my + r * 0.06); ctx.lineTo(mx - r * 0.09, my - r * 0.02); ctx.lineTo(mx + r * 0.09, my + r * 0.08); ctx.lineTo(mx + r * 0.26, my); ctx.stroke(); }
    else if (mood === "dizzy") { ctx.beginPath(); ctx.moveTo(mx - r * 0.24, my + r * 0.05); ctx.bezierCurveTo(mx - r * 0.1, my - r * 0.12, mx + r * 0.06, my + r * 0.22, mx + r * 0.24, my + r * 0.02); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(mx, my - r * 0.12, r * 0.26, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke(); }
    if (hat) {
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.11);
      if (hat === "cap") { ctx.fillStyle = "#ffd21f"; ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.62, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); rr(ctx, r * 0.1, -r * 0.7, r * 0.9, r * 0.16, r * 0.08); ctx.fill(); ctx.stroke(); }
      else if (hat === "party") { ctx.fillStyle = "#ff5aa5"; ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.82); ctx.lineTo(r * 0.06, -r * 1.9); ctx.lineTo(r * 0.5, -r * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r * 0.06, -r * 1.9, r * 0.16, 0, 7); ctx.fill(); ctx.stroke(); }
      else if (hat === "crown") { ctx.fillStyle = "#ffd21f"; ctx.beginPath(); ctx.moveTo(-r * 0.56, -r * 0.74); ctx.lineTo(-r * 0.62, -r * 1.42); ctx.lineTo(-r * 0.28, -r * 1.08); ctx.lineTo(0, -r * 1.56); ctx.lineTo(r * 0.28, -r * 1.08); ctx.lineTo(r * 0.62, -r * 1.42); ctx.lineTo(r * 0.56, -r * 0.74); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ff5a6a"; ctx.beginPath(); ctx.arc(0, -r * 0.98, r * 0.1, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  function heart(x, y, s, on) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-16, -3, -9, -15, 0, -6); ctx.bezierCurveTo(9, -15, 16, -3, 0, 9); ctx.closePath();
    ctx.fillStyle = on ? "#ff4d6d" : "rgba(27,27,58,0.35)"; ctx.fill(); ctx.strokeStyle = on ? INK : "rgba(27,27,58,0.6)"; ctx.lineWidth = 2.6; ctx.stroke();
    if (on) { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-4.5, -5, 2.4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function label(text, x, y, size, fill = "#fff", stroke = INK, lw = 0.24) {
    ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    if (stroke) { ctx.lineWidth = size * lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }

  const P = { x: 0, y: 0, a: 0 };
  /** Draw the level between x0 and x1 (world pixels). a = { t, springT[], gateFx[], btnFx[], look, cpT[], hideSigns, eyes } */
  function world(L, s, x0, x1, a) {
    const th = L.gfx.th, t = a.t;
    for (const d of L.gfx.deco) if (d.x > x0 - 90 && d.x < x1 + 90) deco(th, d, t);
    // rails for lifts, ropes for swings
    for (const m of L.movers) {
      moverPos(m, s.t, P);
      if (m.type === "lift") {
        if (Math.max(m.x, m.x + m.mx) + m.w < x0 || Math.min(m.x, m.x + m.mx) > x1) continue;
        ctx.strokeStyle = "rgba(27,27,58,0.35)"; ctx.lineWidth = 5; ctx.setLineDash([4, 12]); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(m.x + m.w / 2, m.y + 8); ctx.lineTo(m.x + m.mx + m.w / 2, m.y + m.my + 8); ctx.stroke(); ctx.setLineDash([]);
      } else {
        if (m.px + m.len < x0 || m.px - m.len > x1) continue;
        ctx.strokeStyle = th.line; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(P.x + 8, P.y + 4); ctx.moveTo(m.px, m.py); ctx.lineTo(P.x + m.w - 8, P.y + 4); ctx.stroke();
        ctx.strokeStyle = "#e9c98a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(P.x + 8, P.y + 4); ctx.moveTo(m.px, m.py); ctx.lineTo(P.x + m.w - 8, P.y + 4); ctx.stroke();
        ctx.fillStyle = "#8b93a8"; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(m.px, m.py, 9, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    // see-saw posts
    for (const d of L.seesaws) if (d.x > x0 - 200 && d.x < x1 + 200) { ctx.fillStyle = "#8a5522"; ctx.strokeStyle = th.line; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(d.x, d.y + 2); ctx.lineTo(d.x + 22, d.y + 600); ctx.lineTo(d.x - 22, d.y + 600); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // goal arch (behind the ground line)
    goal(L, s, a);
    for (const r of L.rects) if (r.kind === "tower" && r.x + r.w > x0 && r.x < x1) rect(th, r);
    // gates
    for (let i = 0; i < L.gates.length; i++) {
      const q = L.gates[i]; if (q.x + 200 < x0 || q.x - 200 > x1) continue;
      ctx.fillStyle = "#6b7488"; ctx.strokeStyle = th.line; ctx.lineWidth = 3; for (const u of [q.x - 7, q.x + q.w + 1]) { ctx.beginPath(); ctx.rect(u, q.y - 2, 6, q.h + 2); ctx.fill(); ctx.stroke(); }
      const k = s.gate[i].k, h = q.h * (1 - k), shake = a.gateFx[i] > 0 ? Math.sin(a.gateFx[i] * 60) * 4 * a.gateFx[i] : 0;
      if (h > 2) {
        ctx.save(); ctx.translate(shake, 0); ctx.beginPath(); ctx.rect(q.x - 10, q.y, q.w + 20, q.h); ctx.clip();
        ctx.fillStyle = "#c98a45"; ctx.strokeStyle = th.line; ctx.lineWidth = 4; rr(ctx, q.x - 3, q.y + q.h * k, q.w + 6, q.h + 4, 5); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#8a5522"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x + q.w / 2, q.y + q.h * k); ctx.lineTo(q.x + q.w / 2, q.y + q.h + 4); ctx.stroke();
        ctx.fillStyle = "#6b7488"; for (const u of [0.18, 0.62]) { ctx.fillRect(q.x - 3, q.y + q.h * k + q.h * u, q.w + 6, 9); ctx.strokeStyle = th.line; ctx.lineWidth = 2.5; ctx.strokeRect(q.x - 3, q.y + q.h * k + q.h * u, q.w + 6, 9); }
        ctx.restore();
      }
      if (q.math >= 0 && !s.gate[i].open) { // the problem again, big, hanging over the buttons so it is read early
        let bx = 0, n = 0, gy = 0; for (const b of L.buttons) if (b.gate === i) { bx += b.x; gy = b.y; n++; }
        bx /= n; const by = gy - 176 + Math.sin(t * 2) * 3; ctx.font = `900 38px ${FONT}`; const txt = q.text + " = ?", w = Math.max(170, ctx.measureText(txt).width + 44);
        ctx.strokeStyle = th.line; ctx.lineWidth = 4; ctx.beginPath(); for (const u of [-1, 1]) { ctx.moveTo(bx + u * (w / 2 - 22), by - 30); ctx.lineTo(bx + u * (w / 2 - 22), by - 700); } ctx.stroke();
        ctx.fillStyle = "#fff4d6"; ctx.lineWidth = 5; rr(ctx, bx - w / 2, by - 34, w, 68, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f0d9a0"; rr(ctx, bx - w / 2 + 7, by + 18, w - 14, 9, 4); ctx.fill();
        label(txt, bx, by, 38, INK, null);
      }
      if (q.math >= 0) { // the problem, painted on a board above the door
        const open = s.gate[i].open; ctx.font = `900 30px ${FONT}`; const txt = open ? q.text + " = " + L.buttons.find((b) => b.gate === i && b.right).val : q.text + " = ?", w = Math.max(120, ctx.measureText(txt).width + 36), bx = q.x + 16 + shake, by = q.y - 34;
        ctx.fillStyle = open ? "#7be07a" : "#fff4d6"; ctx.strokeStyle = th.line; ctx.lineWidth = 4.5; rr(ctx, bx - w / 2, by - 27, w, 54, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8b93a8"; for (const u of [-1, 1]) { ctx.beginPath(); ctx.arc(bx + u * (w / 2 - 10), by - 17, 3.4, 0, 7); ctx.fill(); }
        label(txt, bx, by + 2, 30, INK, null);
      }
    }
    // static blocks and ground
    for (const r of L.rects) if (r.kind !== "tower" && r.x + r.w > x0 - 10 && r.x < x1 + 10) rect(th, r);
    for (const r of L.gfx.runs) if (r.x1 > x0 - 10 && r.x0 < x1 + 10) ground(th, r.poly, r.top);
    // signs
    if (!a.hideSigns) for (const q of L.signs) if (q.x > x0 - 200 && q.x < x1 + 200) {
      ctx.font = `900 22px ${FONT}`; const w = ctx.measureText(q.text).width + 30;
      ctx.fillStyle = "#8a5522"; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; rr(ctx, q.x - 5, q.y + 10, 10, q.gy - q.y - 8, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f3d49a"; ctx.lineWidth = 4; rr(ctx, q.x - w / 2, q.y - 22, w, 44, 10); ctx.fill(); ctx.stroke();
      label(q.text, q.x, q.y + 1, 22, INK, null);
    }
    // spikes
    for (const q of L.spikes) if (q.x + q.w > x0 && q.x < x1) {
      const n = Math.max(2, Math.round(q.w / 13)); ctx.fillStyle = "#eef0f6"; ctx.strokeStyle = th.line; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
      for (let i = 0; i < n; i++) { const u = q.x + (i * q.w) / n, w = q.w / n; ctx.moveTo(u, q.y + 1); ctx.lineTo(u + w / 2, q.y - 18); ctx.lineTo(u + w, q.y + 1); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#b9bfd0"; ctx.beginPath(); for (let i = 0; i < n; i++) { const u = q.x + (i * q.w) / n, w = q.w / n; ctx.moveTo(u + w / 2, q.y - 18); ctx.lineTo(u + w, q.y + 1); ctx.lineTo(u + w * 0.62, q.y + 1); } ctx.fill();
    }
    // springs
    for (let i = 0; i < L.springs.length; i++) {
      const q = L.springs[i]; if (q.x < x0 - 40 || q.x > x1 + 40) continue;
      const k = a.springT[i] > 0 ? Math.sin(a.springT[i] * 22) * a.springT[i] * 2.2 : 0, h = 16 + k * 14;
      ctx.strokeStyle = th.line; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); for (let j = 0; j <= 4; j++) ctx.lineTo(q.x + (j % 2 ? 11 : -11), q.y - (h * j) / 4); ctx.stroke();
      ctx.strokeStyle = "#dfe4f0"; ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j <= 4; j++) ctx.lineTo(q.x + (j % 2 ? 11 : -11), q.y - (h * j) / 4); ctx.stroke();
      ctx.fillStyle = "#ff4d6d"; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; rr(ctx, q.x - 22, q.y - h - 9, 44, 11, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(q.x - 16, q.y - h - 7, 20, 3);
    }
    // buttons
    for (let i = 0; i < L.buttons.length; i++) {
      const q = L.buttons[i]; if (q.x < x0 - 60 || q.x > x1 + 60) continue;
      const o = s.btn[i], gs = s.gate[q.gate], dn = o.p || (q.mode !== "hold" && gs.open && q.right), lock = o.lock > 0, f = a.btnFx[i] || 0;
      const col = q.mode === "num" ? (gs.open ? (q.right ? "#34d17a" : "#aab1c4") : lock ? "#aab1c4" : "#3b9bff") : q.mode === "hold" ? "#ffcf2e" : gs.open ? "#34d17a" : "#ff5a6a";
      ctx.fillStyle = col; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; rr(ctx, q.x - 19, q.y - (dn ? 4 : 11), 38, 14, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#59617a"; rr(ctx, q.x - 25, q.y - 4, 50, 8, 3); ctx.fill(); ctx.stroke();
      if (q.mode === "num") {
        const sh = lock ? Math.sin(o.lock * 50) * 3 : 0, by = q.y - 62 - (f > 0 ? Math.sin(f * 12) * 8 * f : 0), txt = q.val; ctx.font = `900 28px ${FONT}`; const w = Math.max(46, ctx.measureText(txt).width + 22);
        ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(q.x, q.y - 12); ctx.lineTo(q.x + sh, by + 20); ctx.stroke();
        ctx.fillStyle = gs.open ? (q.right ? "#7be07a" : "#d9dce6") : lock ? "#ffb3b3" : "#ffffff"; ctx.lineWidth = 4; rr(ctx, q.x - w / 2 + sh, by - 23, w, 46, 14); ctx.fill(); ctx.stroke();
        label(txt, q.x + sh, by + 1, 28, gs.open && !q.right ? "#8b90a3" : INK, null);
      }
    }
    // checkpoints
    for (let i = 0; i < L.cps.length; i++) {
      const q = L.cps[i]; if (q.x < x0 - 60 || q.x > x1 + 60) continue;
      const on = s.cp >= i, k = on ? Math.min(1, (a.cpT[i] || 1)) : 0, fy = q.y - 34 - k * 34;
      ctx.fillStyle = "#dfe4f0"; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; rr(ctx, q.x - 4, q.y - 86, 8, 88, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd21f"; ctx.beginPath(); ctx.arc(q.x, q.y - 88, 6.5, 0, 7); ctx.fill(); ctx.stroke();
      const w = Math.sin(t * 5 + i) * 3; ctx.fillStyle = on ? "#3b9bff" : "#b9bfd0"; ctx.beginPath(); ctx.moveTo(q.x + 4, fy - 16); ctx.quadraticCurveTo(q.x + 22, fy - 20 + w, q.x + 40, fy - 13 + w); ctx.lineTo(q.x + 33, fy - 2 + w * 0.5); ctx.lineTo(q.x + 40, fy + 10 + w); ctx.quadraticCurveTo(q.x + 22, fy + 6 + w, q.x + 4, fy + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (on) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(q.x + 19, fy + 2 + w * 0.5, 7, Math.PI, 0); ctx.stroke(); }
    }
    // stars
    for (let i = 0; i < L.stars.length; i++) if (!s.got[i]) { const q = L.stars[i]; if (q.x > x0 - 20 && q.x < x1 + 20) drawStar(q.x, q.y, 12.5, t); }
    // lifts and swings
    for (const m of L.movers) {
      moverPos(m, s.t, P); if (P.x + m.w < x0 - 20 || P.x > x1 + 20) continue;
      ctx.fillStyle = m.type === "lift" ? (th.name === "works" ? "#8ea2bd" : "#e0a45a") : "#c98a45"; ctx.strokeStyle = th.line; ctx.lineWidth = 4; rr(ctx, P.x - 2, P.y, m.w + 4, m.h + 2, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(P.x + 6, P.y + 3, m.w - 12, 3.5);
      if (m.type === "lift") { ctx.fillStyle = "#ffd23f"; ctx.lineWidth = 2.5; for (const u of [10, m.w - 10]) { ctx.beginPath(); ctx.arc(P.x + u, P.y + 10, 4, 0, 7); ctx.fill(); ctx.stroke(); } }
    }
    // see-saw planks
    for (let i = 0; i < L.seesaws.length; i++) {
      const d = L.seesaws[i]; if (d.x + d.hl < x0 || d.x - d.hl > x1) continue;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(s.saw[i].a);
      ctx.fillStyle = "#e0a45a"; ctx.strokeStyle = th.line; ctx.lineWidth = 4; rr(ctx, -d.hl, 0, d.hl * 2, 13, 5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#8a5522"; ctx.lineWidth = 2.5; ctx.beginPath(); for (let x = -d.hl + 24; x < d.hl - 6; x += 24) { ctx.moveTo(x, 2); ctx.lineTo(x, 11); } ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = th.line; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(d.x, d.y + 7, 8, 0, 7); ctx.fill(); ctx.stroke();
    }
    // crates and boulders
    for (let i = 0; i < L.bodies.length; i++) {
      const d = L.bodies[i], o = s.bodies[i]; if (o.dead > 0 || o.x < x0 - 40 || o.x > x1 + 40) continue;
      ctx.save(); ctx.translate(o.x, o.y); ctx.lineJoin = "round"; ctx.strokeStyle = th.line; ctx.lineWidth = 4;
      if (d.kind === "crate") {
        ctx.fillStyle = "#e0a45a"; rr(ctx, -CRATE, -CRATE, CRATE * 2, CRATE * 2, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c98a45"; ctx.fillRect(-CRATE + 6, -CRATE + 6, CRATE * 2 - 12, CRATE * 2 - 12);
        ctx.strokeStyle = "#8a5522"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-CRATE + 7, -CRATE + 7); ctx.lineTo(CRATE - 7, CRATE - 7); ctx.moveTo(CRATE - 7, -CRATE + 7); ctx.lineTo(-CRATE + 7, CRATE - 7); ctx.stroke();
        ctx.strokeStyle = th.line; ctx.lineWidth = 2.5; ctx.strokeRect(-CRATE + 6, -CRATE + 6, CRATE * 2 - 12, CRATE * 2 - 12);
      } else {
        ctx.rotate(o.ang); ctx.fillStyle = th.name === "woods" ? "#8f86c9" : "#a9adba"; ctx.beginPath();
        for (let j = 0; j < 9; j++) { const q = (j * 6.283) / 9, rad = d.r * (0.93 + 0.09 * hash(j + i * 13)); ctx.lineTo(Math.cos(q) * rad, Math.sin(q) * rad); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(27,27,58,0.22)"; ctx.beginPath(); ctx.arc(6, 5, 6, 0, 7); ctx.arc(-9, -4, 4, 0, 7); ctx.arc(-2, 11, 3, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(-8, -11, 5, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // enemies
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i], dead = s.ea[i]; const ex = enemyX(e, dead || s.t); if (ex < x0 - 50 || ex > x1 + 50) continue;
      if (dead) { const k = (s.t - dead) / 0.45; if (k < 1) block(ex, e.y, EW * 2, { spiky: e.spiky, flat: Math.min(1, k * 4), alpha: 1 - k * k, t: 0, walk: 0 }); continue; }
      block(ex, e.y, EW * 2, { spiky: e.spiky, dir: enemyDir(e, s.t), t: s.t + i, look: a.look ? { x: (a.look.x - ex) / 120, y: (a.look.y - e.y + 20) / 120 } : null, walk: e.range > 0 });
    }
    // boss
    if (s.boss) {
      const o = s.boss, d = L.boss, k = d.kind;
      if (o.mode === "dead") { const u = o.tm / 0.8; if (u < 1) block(o.x, o.y, BOSS * 2, { flat: Math.min(1, u * 2), alpha: 1 - u, color: BOSSC[k][0], dark: BOSSC[k][1], hat: k, walk: 0 }); }
      else {
        const sq = o.mode === "crouch" ? Math.min(0.3, o.tm * 0.8) : o.mode === "land" ? Math.max(0, 0.3 - o.tm) : o.mode === "stun" ? 0.25 * Math.max(0, 1 - o.tm * 3) : 0, sp = bossSpiked(L, s);
        const blink = o.inv > 0 && Math.floor(o.inv * 14) % 2;
        block(o.x + (sp === 0.5 ? Math.sin(t * 50) * 2 : 0), o.y, BOSS * 2, { flat: sq, color: blink ? "#fff" : BOSSC[k][0], dark: blink ? "#e6e6f0" : BOSSC[k][1], hat: k, dir: o.dir, t: s.t, angry: 3 - o.hp, spikes: sp === 1 ? 0.9 : sp === 0.5 ? 0.3 : 0, spiky: 0, look: a.look ? { x: (a.look.x - o.x) / 200, y: (a.look.y - o.y + 60) / 200 } : null, walk: o.mode === "walk" });
        if (o.on) for (let j = 0; j < 3; j++) heart(o.x - 22 + j * 22, o.y - BOSS * 2 - 46 - (o.mode === "hop" ? 0 : 0), 0.8, j < o.hp);
      }
    }
  }
  const BOSSC = { 1: ["#ff7b2e", "#d4530c"], 2: ["#7f9cc4", "#566f96"], 3: ["#8a5be0", "#5f37b3"] };
  function goal(L, s, a) {
    const q = L.goal, th = L.gfx.th, t = a.t;
    ctx.save(); ctx.translate(q.x, q.y); ctx.lineJoin = "round"; ctx.strokeStyle = th.line; ctx.lineWidth = 5;
    // an arch like the one Archie is made of
    ctx.fillStyle = "#ffd21f"; ctx.beginPath(); ctx.moveTo(-58, 4); ctx.lineTo(-58, -70); ctx.arc(0, -70, 58, Math.PI, 0); ctx.lineTo(58, 4); ctx.lineTo(34, 4); ctx.lineTo(34, -70); ctx.arc(0, -70, 34, 0, Math.PI, true); ctx.lineTo(-34, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = "#ff9a1f"; for (let i = -6; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 26 - 80, 10); ctx.lineTo(i * 26 - 66, 10); ctx.lineTo(i * 26 + 64, -140); ctx.lineTo(i * 26 + 50, -140); ctx.closePath(); ctx.fill(); } ctx.restore();
    ctx.stroke();
    ctx.fillStyle = "#fff"; star(ctx, 0, -148, 20 + Math.sin(t * 4) * 2, -Math.PI / 2 + Math.sin(t * 2) * 0.2); ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }

  /** The start of a level: Archie's arch tucks in and pops into the ball. k runs 0..1. */
  function transform(x, y, k, ballOpts) {
    if (k < 0.55) {
      const u = k / 0.55, e = u * u;
      drawArchie(ctx, x, y + R - 30 + e * 14, 64 * (1 - e * 0.45), { pose: u < 0.4 ? "wave" : "jump", squashY: 1 - e * 0.35, squashX: 1 + e * 0.25, rotation: e * e * 5, t: u, arms: u < 0.75 });
    }
    if (k > 0.4) { const u = Math.min(1, (k - 0.4) / 0.6), pop = u < 0.4 ? (u / 0.4) * 1.3 : 1.3 - 0.3 * Math.min(1, (u - 0.4) / 0.3) + Math.sin(u * 14) * 0.05 * (1 - u); ball(x, y, R, { ...ballOpts, sx: pop, sy: pop, foot: true, alpha: Math.min(1, u * 4) }); }
  }
  return { prep, backdrop, world, ball, block, heart, label, transform, drawStar, star: (x, y, r, rot) => star(ctx, x, y, r, rot) };
}
