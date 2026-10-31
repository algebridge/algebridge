import type { Arena, Hit } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import { KART } from "./KartPhysics";

const hits: Hit[] = [];

/** Push a kart out of the walls it overlaps and bounce it. Returns the hardest impact speed. */
export function collideKartWithArena(k: Kart, arena: Arena): number {
  const n = arena.collideCircle(k.pos.x, k.pos.z, k.pos.y, KART.radius, KART.height, hits);
  let impact = 0;
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
  if (impact > 2) {
    // Scraping a wall costs speed.
    const keep = Math.max(0.55, 1 - impact / 40);
    k.vel.x *= keep;
    k.vel.z *= keep;
  }
  return impact;
}

/** Two karts shoving each other: separate them and trade momentum. Returns the closing speed. */
export function collideKarts(a: Kart, b: Kart): number {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  if (Math.abs(a.pos.y - b.pos.y) > 1.3) return 0;
  const minD = KART.radius * 2 * 0.98;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minD * minD) return 0;
  const d = Math.sqrt(Math.max(d2, 1e-6));
  const nx = d > 1e-3 ? dx / d : 1;
  const nz = d > 1e-3 ? dz / d : 0;
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
