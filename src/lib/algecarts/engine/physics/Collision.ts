import type { Arena, Hit } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import { KART } from "./KartPhysics";

const hits: Hit[] = [];

/** Half the distance between the two circles that make a kart's body, nose to tail. */
const SPAN = 0.6;

/**
 * Push a kart out of the walls and props it overlaps and bounce it. Returns
 * the hardest impact speed. A kart is about 2.4 m long, so its body is two
 * circles, front and back: one circle in the middle let the nose sink into a
 * wall and slide through a barrel.
 */
export function collideKartWithArena(k: Kart, arena: Arena): number {
  let impact = 0;
  const fx = Math.sin(k.yaw);
  const fz = Math.cos(k.yaw);
  for (const side of [1, -1]) {
    const n = arena.collideCircle(k.pos.x + fx * SPAN * side, k.pos.z + fz * SPAN * side, k.pos.y, KART.radius, KART.height, hits);
    for (let i = 0; i < n; i++) {
      const h = hits[i];
      k.pos.x += h.nx * h.depth;
      k.pos.z += h.nz * h.depth;
      const vn = k.vel.x * h.nx + k.vel.z * h.nz;
      if (vn < 0) {
        k.vel.x -= h.nx * vn * (1 + KART.wallRestitution);
        k.vel.z -= h.nz * vn * (1 + KART.wallRestitution);
        impact = Math.max(impact, -vn);
      }
    }
  }
  if (impact > 2) {
    // Hitting something costs speed.
    const keep = Math.max(0.55, 1 - impact / 40);
    k.vel.x *= keep;
    k.vel.z *= keep;
  }
  return impact;
}

/** The closest points between two karts' nose-to-tail segments. */
function closestBetween(a: Kart, b: Kart): { ax: number; az: number; bx: number; bz: number } {
  const ux = Math.sin(a.yaw) * SPAN, uz = Math.cos(a.yaw) * SPAN;
  const vx = Math.sin(b.yaw) * SPAN, vz = Math.cos(b.yaw) * SPAN;
  // Segments a.pos + s*u and b.pos + t*v, s and t in [-1, 1].
  const wx = a.pos.x - b.pos.x, wz = a.pos.z - b.pos.z;
  const uu = ux * ux + uz * uz, vv = vx * vx + vz * vz, uv = ux * vx + uz * vz;
  const uw = ux * wx + uz * wz, vw = vx * wx + vz * wz;
  const den = uu * vv - uv * uv;
  let s = den > 1e-6 ? (uv * vw - vv * uw) / den : 0;
  s = Math.max(-1, Math.min(1, s));
  let t = (uv * s + vw) / vv;
  t = Math.max(-1, Math.min(1, t));
  s = Math.max(-1, Math.min(1, (uv * t - uw) / uu));
  return { ax: a.pos.x + ux * s, az: a.pos.z + uz * s, bx: b.pos.x + vx * t, bz: b.pos.z + vz * t };
}

/** Two karts shoving each other: separate them and trade momentum. Returns the closing speed. */
export function collideKarts(a: Kart, b: Kart): number {
  if (Math.abs(a.pos.y - b.pos.y) > 1.3) return 0;
  // Far apart: skip the segment math.
  const fx = b.pos.x - a.pos.x, fz = b.pos.z - a.pos.z;
  const reach = (KART.radius + SPAN) * 2;
  if (fx * fx + fz * fz > reach * reach) return 0;
  const c = closestBetween(a, b);
  const dx = c.bx - c.ax;
  const dz = c.bz - c.az;
  const minD = KART.radius * 2;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minD * minD) return 0;
  const d = Math.sqrt(d2);
  // Exactly on top of each other: push apart along the line between centres.
  const cd = Math.hypot(fx, fz);
  const nx = d > 1e-3 ? dx / d : cd > 1e-3 ? fx / cd : 1;
  const nz = d > 1e-3 ? dz / d : cd > 1e-3 ? fz / cd : 0;
  const overlap = minD - d;
  a.pos.x -= (nx * overlap) / 2;
  a.pos.z -= (nz * overlap) / 2;
  b.pos.x += (nx * overlap) / 2;
  b.pos.z += (nz * overlap) / 2;
  const va = a.vel.x * nx + a.vel.z * nz;
  const vb = b.vel.x * nx + b.vel.z * nz;
  const closing = va - vb;
  if (closing <= 0) return 0;
  const j = (closing * (1 + KART.kartRestitution)) / 2;
  a.vel.x -= nx * j;
  a.vel.z -= nz * j;
  b.vel.x += nx * j;
  b.vel.z += nz * j;
  return closing;
}

/** Does a point (a shot) touch this kart's body? */
export function pointHitsKart(k: Kart, x: number, y: number, z: number, pad = 0): boolean {
  const dx = x - k.pos.x;
  const dz = z - k.pos.z;
  const r = KART.radius + pad;
  if (dx * dx + dz * dz > r * r) return false;
  return y >= k.pos.y - 0.2 && y <= k.pos.y + KART.height + pad;
}
