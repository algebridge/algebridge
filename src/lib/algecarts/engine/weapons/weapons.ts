import type { WeaponDef, WeaponId } from "../types";
import type { Rng } from "../util";

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rockets: { id: "rockets", name: "Rockets", ammo: 3, color: "#ff5d3a", weight: 22, blurb: "Three straight shots. Tap to fire." },
  machinegun: { id: "machinegun", name: "Machine Gun", ammo: 36, color: "#ffd400", weight: 20, blurb: "Hold to spray." },
  mines: { id: "mines", name: "Mines", ammo: 3, color: "#3d5aff", weight: 16, blurb: "Drops behind you and arms in a moment." },
  bomb: { id: "bomb", name: "Bomb", ammo: 2, color: "#8b5cf6", weight: 16, blurb: "Lobbed ahead. Big blast." },
  shield: { id: "shield", name: "Shield", ammo: 1, color: "#6ff6ff", weight: 13, blurb: "Six seconds of nothing hurts. Ram for damage." },
  boost: { id: "boost", name: "Turbo", ammo: 1, color: "#ff8a1f", weight: 13, blurb: "Four seconds of speed. Ram for damage." },
};

export const WEAPON_IDS: WeaponId[] = ["rockets", "machinegun", "mines", "bomb", "shield", "boost"];

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
  bump: { minClosing: 4 },
} as const;
