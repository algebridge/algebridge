import * as THREE from "three";
import type { TrailId } from "../profile";
import type { Particles } from "./Particles";

/**
 * What a trail looks like out of the exhaust: puff colours while driving,
 * boost colours on turbo, and the flame cones. Extras give a trail its own
 * character: glitter cubes, falling drops, a random palette.
 */
export interface TrailLook {
  puff: [string, string];
  boost: [string, string];
  flame: [string, string];
  /** How fast puffs rise; below zero they fall. */
  rise: number;
  /** Cycles through every colour. */
  rainbow?: boolean;
  /** Small spinning cubes instead of soft puffs. */
  cube?: boolean;
  /** Puff size; 0.35 is plain exhaust. */
  size?: number;
  /** Seconds a puff lives; 0.5 is plain exhaust. */
  life?: number;
  /** Pulls puffs down (snow, lava drops). */
  gravity?: number;
  /** Each puff picks its colour from here (confetti). */
  palette?: string[];
  /** Now and then a bright glitter cube in this colour flies off too. */
  glitter?: string;
}

export const TRAILS: Record<TrailId, TrailLook> = {
  smoke: { puff: ["#d8d8e0", "#9a9aa6"], boost: ["#ffb347", "#5a5a66"], flame: ["#ff8a1f", "#fff2a0"], rise: 1.2 },
  fire: { puff: ["#ffb060", "#6b2a1a"], boost: ["#ffd23c", "#ff3d1f"], flame: ["#ff3d1f", "#ffe066"], rise: 1.6 },
  bubbles: { puff: ["#e6f8ff", "#8fd8ff"], boost: ["#ffffff", "#6fc8ff"], flame: ["#6ff6ff", "#ffffff"], rise: 2.6 },
  rainbow: { puff: ["#ff5d8f", "#3d5aff"], boost: ["#ffd400", "#8b5cf6"], flame: ["#ff5d8f", "#ffe066"], rise: 1.8, rainbow: true },
  shadow: { puff: ["#4b3a6b", "#14101f"], boost: ["#8b5cf6", "#1b1030"], flame: ["#8b5cf6", "#e9d5ff"], rise: 0.8, size: 0.45, life: 0.65 },
  toxic: { puff: ["#a3e635", "#2f5d12"], boost: ["#d9f99d", "#4d7c0f"], flame: ["#84cc16", "#ecfccb"], rise: 1.4, size: 0.4 },
  candy: { puff: ["#ffc2dc", "#ffffff"], boost: ["#ff5d8f", "#ffffff"], flame: ["#ff5d8f", "#ffffff"], rise: 1.6, palette: ["#ff8fbf", "#ffffff", "#ffc2dc", "#ff5d8f"] },
  snow: { puff: ["#ffffff", "#dbeafe"], boost: ["#ffffff", "#93c5fd"], flame: ["#bfdbfe", "#ffffff"], rise: 1.1, cube: true, size: 0.2, life: 1.1, gravity: 2.2, glitter: "#ffffff" },
  hearts: { puff: ["#ff5d8f", "#e11d48"], boost: ["#ff8fbf", "#e11d48"], flame: ["#ff5d8f", "#ffe4ef"], rise: 1.8, glitter: "#ffe4ef" },
  lava: { puff: ["#ffb020", "#7c1d0b"], boost: ["#ffe066", "#ff3d1f"], flame: ["#ff3d1f", "#ffe066"], rise: 3.2, cube: true, size: 0.26, life: 0.75, gravity: 11, glitter: "#ffe066" },
  sparkle: { puff: ["#fff3b0", "#d4a017"], boost: ["#ffffff", "#ffd400"], flame: ["#ffd400", "#ffffff"], rise: 1.4, cube: true, size: 0.22, life: 0.7, glitter: "#ffffff" },
  lightning: { puff: ["#bfe9ff", "#3d5aff"], boost: ["#ffffff", "#6ff6ff"], flame: ["#6ff6ff", "#ffffff"], rise: 1.0, cube: true, size: 0.2, life: 0.35, glitter: "#ffffff" },
  confetti: { puff: ["#ff5d8f", "#ffd400"], boost: ["#3d5aff", "#22c55e"], flame: ["#ffd400", "#ff5d8f"], rise: 2.2, cube: true, size: 0.24, life: 0.9, gravity: 3, palette: ["#ff5d8f", "#ffd400", "#3d5aff", "#22c55e", "#f97316", "#8b5cf6", "#6ff6ff"] },
  galaxy: { puff: ["#6d28d9", "#0b1036"], boost: ["#c084fc", "#1e3a8a"], flame: ["#a855f7", "#e0f2fe"], rise: 1.3, size: 0.42, life: 0.7, glitter: "#ffffff" },
};

/** A trail by id, plain smoke for anything unknown (a newer tab's trail on an older one). */
export function trailLook(id: string): TrailLook {
  return TRAILS[id as TrailId] ?? TRAILS.smoke;
}

/** The rainbow trail's colours at a moment. */
export function rainbowColors(t: number): [string, string] {
  const c0 = new THREE.Color().setHSL((t * 0.25) % 1, 0.95, 0.6);
  const c1 = new THREE.Color().setHSL((t * 0.25 + 0.3) % 1, 0.95, 0.55);
  return [`#${c0.getHexString()}`, `#${c1.getHexString()}`];
}

/** The look at a moment: the rainbow one changes colour, the rest are what they are. */
export function trailAt(look: TrailLook, t: number): TrailLook {
  if (!look.rainbow) return look;
  const [a, b] = rainbowColors(t);
  return { ...look, puff: [a, b], boost: [a, b], flame: [a, b] };
}

/**
 * One puff out of one exhaust tip at (x, y, z), heading back along (bx, bz).
 * Shared by the track and the garage turntable so a trail looks the same in
 * the shop as in a race.
 */
export function emitTrail(p: Particles, look: TrailLook, x: number, y: number, z: number, bx: number, bz: number, boosting: boolean, rnd: () => number): void {
  const jx = (rnd() - 0.5) * 1.5;
  const jz = (rnd() - 0.5) * 1.5;
  const back = boosting ? 6 : 2;
  const spread = boosting ? 1 : 0.6;
  const pair = boosting ? look.boost : look.puff;
  const c0 = look.palette ? look.palette[Math.floor(rnd() * look.palette.length)] : pair[0];
  const c1 = look.palette ? c0 : pair[1];
  const base = look.size ?? 0.35;
  const size = boosting ? base * 2 : base;
  const life = (look.life ?? 0.5) * (boosting ? 0.7 : 1);
  p.emit({
    x, y, z,
    vx: bx * back + jx * spread,
    vy: look.rise + (boosting ? 0.5 : 0),
    vz: bz * back + jz * spread,
    life,
    size0: size,
    size1: look.cube ? size * 0.3 : 0,
    color0: c0,
    color1: c1,
    gravity: look.gravity ?? 0,
    drag: 2,
    cube: !!look.cube,
    spin: look.cube ? 8 : 0,
  });
  if (look.glitter && rnd() < (boosting ? 0.5 : 0.3)) {
    p.emit({
      x: x + jx * 0.3, y: y + 0.1, z: z + jz * 0.3,
      vx: bx * back * 0.6 + jx * 1.4, vy: 1.5 + rnd() * 2, vz: bz * back * 0.6 + jz * 1.4,
      life: 0.45 + rnd() * 0.3,
      size0: 0.16, size1: 0,
      color0: look.glitter, color1: pair[0],
      gravity: 4, drag: 1.5, cube: true, spin: 14,
    });
  }
}
