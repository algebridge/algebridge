/**
 * Garden ornaments — the outdoor half of the House.
 *
 * Sizes are in metres, and they matter: an ornament is projected onto the yard
 * by the same camera that rendered it, so `height` is what decides how large
 * it draws at a given distance. Getting one wrong makes a bench the size of a
 * shed rather than just looking slightly off.
 */

export interface Ornament {
  id: string;
  name: string;
  price: number;
  /** Real height in metres, used to scale the sprite in the yard. */
  height: number;
  /** Prestige, on the same scale as indoor furniture. */
  prestige: number;
  rarity: "common" | "rare" | "legendary";
  description: string;
}

export const ORNAMENTS: Ornament[] = [
  {
    id: "flowerbed",
    name: "Flower Bed",
    price: 45,
    height: 0.7,
    prestige: 4,
    rarity: "common",
    description: "A ring of stone with something cheerful growing out of it.",
  },
  {
    id: "fence",
    name: "Picket Fence",
    price: 60,
    height: 1.1,
    prestige: 5,
    rarity: "common",
    description: "One span of fence. Buy a few and make a boundary.",
  },
  {
    id: "mailbox",
    name: "Mailbox",
    price: 70,
    height: 1.3,
    prestige: 6,
    rarity: "common",
    description: "Proof that somebody lives here.",
  },
  {
    id: "bench",
    name: "Garden Bench",
    price: 110,
    height: 1.0,
    prestige: 9,
    rarity: "common",
    description: "Somewhere to sit and look at what you have built.",
  },
  {
    id: "topiary",
    name: "Potted Topiary",
    price: 150,
    height: 1.9,
    prestige: 12,
    rarity: "rare",
    description: "A shrub with ambitions, clipped into two neat spheres.",
  },
  {
    id: "birdbath",
    name: "Bird Bath",
    price: 190,
    height: 1.3,
    prestige: 14,
    rarity: "rare",
    description: "The birds already fly over. Give them a reason to stop.",
  },
  {
    id: "lamp",
    name: "Lamp Post",
    price: 240,
    height: 2.6,
    prestige: 18,
    rarity: "rare",
    description: "Cast iron, warm globe, faintly Victorian.",
  },
  {
    id: "tree",
    name: "Shade Tree",
    price: 320,
    height: 3.4,
    prestige: 24,
    rarity: "rare",
    description: "The one thing that makes a new house look settled.",
  },
  {
    id: "pond",
    name: "Lily Pond",
    price: 520,
    height: 0.4,
    prestige: 38,
    rarity: "legendary",
    description: "Still water, a stone rim, two lily pads.",
  },
  {
    id: "fountain",
    name: "Stone Fountain",
    price: 780,
    height: 1.8,
    prestige: 55,
    rarity: "legendary",
    description: "The centrepiece. People will notice this one.",
  },
];

export function getOrnament(id: string): Ornament | undefined {
  return ORNAMENTS.find((o) => o.id === id);
}

export function ornamentImage(id: string): string {
  return `/house/ornaments/${id}.png`;
}

/** Owned ornaments that are not currently standing in the yard. */
export function getUnplacedOrnamentIds(
  owned: string[],
  placed: { itemId: string }[]
): string[] {
  const used = new Map<string, number>();
  for (const p of placed) used.set(p.itemId, (used.get(p.itemId) ?? 0) + 1);
  const out: string[] = [];
  for (const id of owned) {
    const n = used.get(id) ?? 0;
    if (n > 0) used.set(id, n - 1);
    else out.push(id);
  }
  return out;
}
