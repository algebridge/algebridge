import type { WeaponDef, WeaponId } from "../types";
import type { Rng } from "../util";

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rockets: { id: "rockets", name: "Rockets", ammo: 3, color: "#ff5d3a", weight: 16, blurb: "Three straight shots. Tap to fire." },
  machinegun: { id: "machinegun", name: "Machine Gun", ammo: 36, color: "#ffd400", weight: 14, blurb: "Hold to spray." },
  mines: { id: "mines", name: "Mines", ammo: 3, color: "#3d5aff", weight: 11, blurb: "Drops behind you and arms in a moment." },
  bomb: { id: "bomb", name: "Bomb", ammo: 2, color: "#8b5cf6", weight: 11, blurb: "Lobbed ahead. Big blast." },
  shield: { id: "shield", name: "Shield", ammo: 1, color: "#6ff6ff", weight: 9, blurb: "Six seconds of nothing hurts. Ram for damage." },
  boost: { id: "boost", name: "Turbo", ammo: 1, color: "#ff8a1f", weight: 9, blurb: "Four seconds of speed. Ram for damage." },
  seeker: { id: "seeker", name: "Seeker", ammo: 2, color: "#ff3df2", weight: 9, blurb: "Two missiles that hunt the nearest kart ahead." },
  laser: { id: "laser", name: "Laser", ammo: 2, color: "#ff2d55", weight: 8, blurb: "A straight beam, there at once. Line it up." },
  ice: { id: "ice", name: "Ice Shot", ammo: 2, color: "#9be7ff", weight: 8, blurb: "Freezes whoever it hits for a few seconds." },
  slick: { id: "slick", name: "Oil Slick", ammo: 2, color: "#5b6170", weight: 7, blurb: "A puddle behind you. Karts that hit it spin out." },
  shock: { id: "shock", name: "Shock", ammo: 1, color: "#b388ff", weight: 7, blurb: "A burst all around you. Everyone close gets hurt." },
};

export const WEAPON_IDS: WeaponId[] = ["rockets", "machinegun", "mines", "bomb", "shield", "boost", "seeker", "laser", "ice", "slick", "shock"];

export function rollWeapon(rng: Rng): WeaponId {
  const total = WEAPON_IDS.reduce((s, id) => s + WEAPONS[id].weight, 0);
  let r = rng.next() * total;
  for (const id of WEAPON_IDS) {
    r -= WEAPONS[id].weight;
    if (r <= 0) return id;
  }
  return "rockets";
}

/** Numbers behind each weapon. */
export const STATS = {
  rocket: { speed: 46, life: 2.0, damage: 34, radius: 3.2, edge: 12, knock: 9, cooldown: 0.24 },
  bullet: { speed: 74, life: 1.1, damage: 6, interval: 1 / 11, spread: 0.035, knock: 1.2 },
  mine: { arm: 0.7, trigger: 1.8, radius: 3.8, damage: 55, edge: 22, knock: 11, life: 45, cooldown: 0.35 },
  bomb: { speed: 24, up: 11.5, gravity: 30, fuse: 2.0, radius: 4.8, damage: 70, edge: 24, knock: 13, cooldown: 0.5 },
  shield: { duration: 6, ramDamage: 40, ramKnock: 14 },
  boost: { duration: 4, ramDamage: 18, ramKnock: 10 },
  /** Turns toward the nearest kart inside `cone` radians of its heading, within `range`. */
  seeker: { speed: 36, life: 3.4, turn: 2.6, cone: 1.0, range: 44, damage: 30, radius: 3.0, edge: 10, knock: 8, cooldown: 0.45 },
  /** A hitscan beam: the first kart on the line within `range` takes it; the beam shows for `hold` seconds. */
  laser: { range: 36, damage: 42, knock: 6, cooldown: 0.55, hold: 0.18 },
  /** A hit freezes the victim for `freeze` seconds at `slow` of top speed. */
  ice: { speed: 42, life: 1.7, damage: 12, freeze: 2.4, slow: 0.42, knock: 3, cooldown: 0.4 },
  /** A puddle that lasts `life` seconds; a kart over it spins for `spin` seconds. */
  slick: { life: 14, radius: 2.3, spin: 1.1, damage: 8, cooldown: 0.4 },
  /** A blast centred on the kart itself. */
  shock: { radius: 9, damage: 24, edge: 10, knock: 13 },
  bump: { minClosing: 4 },
} as const;
