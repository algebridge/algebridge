// Juice for 2D canvas games: pooled particles, floating text, rings and trails.
//   const fx = createFx(400);
//   fx.burst(x, y, { n: 14, color: "#f59e0b", colors: [...], speed: 260, spread: Math.PI * 2, angle: 0, life: 0.6, gravity: 700, size: 5, shape: "dot" | "square" | "star" | "spark" });
//   fx.text(x, y, "+10", { color: "#fff", size: 26, life: 0.8, outline: "#1e3a8a" });
//   fx.ring(x, y, { color: "#fff", radius: 60, life: 0.35, width: 6 });
//   fx.update(dt) in update, fx.draw(ctx) in render (after the world, in world coordinates).
import { FONT } from "./kit.js";

export function createFx(max = 400) {
  const P = [], T = [], R = [];
  const fx = {
    get count() { return P.length + T.length + R.length; },
    burst(x, y, o = {}) {
      const n = o.n ?? 12;
      for (let i = 0; i < n && P.length < max; i++) {
        const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
        const v = (o.speed ?? 240) * (0.35 + Math.random() * 0.65);
        P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity ?? 600, life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.4), t: 0,
          size: (o.size ?? 5) * (0.6 + Math.random() * 0.8), color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : o.color || "#fff",
          shape: o.shape || "dot", rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 12, drag: o.drag ?? 1.5 });
      }
    },
    text(x, y, str, o = {}) { T.push({ x, y, str: String(str), t: 0, life: o.life ?? 0.9, color: o.color || "#fff", outline: o.outline ?? "#0f172a", size: o.size ?? 26, rise: o.rise ?? 70 }); if (T.length > 40) T.shift(); },
    ring(x, y, o = {}) { R.push({ x, y, t: 0, life: o.life ?? 0.35, radius: o.radius ?? 60, color: o.color || "#fff", width: o.width ?? 6 }); if (R.length > 30) R.shift(); },
    clear() { P.length = T.length = R.length = 0; },
    update(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.t += dt;
        if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      }
      for (let i = T.length - 1; i >= 0; i--) { T[i].t += dt; if (T[i].t >= T[i].life) T.splice(i, 1); }
      for (let i = R.length - 1; i >= 0; i--) { R[i].t += dt; if (R[i].t >= R[i].life) R.splice(i, 1); }
    },
    draw(ctx) {
      for (const r of R) {
        const k = r.t / r.life;
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.radius * (0.2 + 0.8 * (1 - (1 - k) ** 3)), 0, 6.283); ctx.stroke();
      }
      for (const p of P) {
        const k = p.t / p.life, s = p.size * (1 - k * 0.7);
        ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3; ctx.fillStyle = p.color;
        if (p.shape === "dot") { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill(); }
        else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          if (p.shape === "square") ctx.fillRect(-s, -s, s * 2, s * 2);
          else if (p.shape === "spark") ctx.fillRect(-s * 2.2, -s * 0.35, s * 4.4, s * 0.7);
          else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.45 : s * 1.2, a = (i / 10) * 6.283; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      for (const t of T) {
        const k = t.t / t.life, pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, k - 0.15);
        ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        ctx.font = `900 ${Math.round(t.size * pop)}px ${FONT}`;
        const y = t.y - t.rise * (1 - (1 - k) ** 2);
        if (t.outline) { ctx.lineWidth = t.size * 0.22; ctx.strokeStyle = t.outline; ctx.strokeText(t.str, t.x, y); }
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, y);
      }
      ctx.globalAlpha = 1;
    },
  };
  return fx;
}
