/**
 * What can stand around the rink. Bought with Bridgeys, placed on one of
 * the fixed slots in src/lib/rink.ts. Art lives with the furniture in
 * furniture-art.ts and is exported to public/house/rink/.
 */
import type { FurnitureItem } from "@/types";

export interface RinkItem {
  id: string;
  name: string;
  price: number;
  prestige: number;
  rarity: FurnitureItem["rarity"];
  blurb: string;
  /** Drawn height in scene units at scale 1. */
  height: number;
}

export const RINK_ITEMS: RinkItem[] = [
  { id: "rink-cones", name: "Cone Course", price: 35, prestige: 6, rarity: "common", blurb: "Weave through them. Or over them.", height: 91 },
  { id: "rink-bench", name: "Rinkside Bench", price: 45, prestige: 8, rarity: "common", blurb: "For lacing up and catching your breath.", height: 99 },
  { id: "rink-planter", name: "Palm Planter", price: 50, prestige: 9, rarity: "common", blurb: "A little shade at the boards.", height: 156 },
  { id: "rink-lamp", name: "Lamp Post", price: 65, prestige: 11, rarity: "common", blurb: "Skate past sunset.", height: 195 },
  { id: "rink-banner", name: "Skate Banner", price: 80, prestige: 14, rarity: "common", blurb: "Says what the place is for.", height: 169 },
  { id: "rink-arch", name: "Light Arch", price: 110, prestige: 20, rarity: "rare", blurb: "Bulbs over the entrance.", height: 195 },
  { id: "rink-snacks", name: "Snack Stand", price: 140, prestige: 24, rarity: "rare", blurb: "Pretzels, slushies, the works.", height: 166 },
  { id: "rink-scoreboard", name: "Scoreboard", price: 160, prestige: 28, rarity: "rare", blurb: "Keeps count of the runs.", height: 169 },
  { id: "rink-speakers", name: "Speaker Tower", price: 190, prestige: 32, rarity: "rare", blurb: "Loud, in the good way.", height: 182 },
  { id: "rink-ramp", name: "Mini Ramp", price: 220, prestige: 36, rarity: "rare", blurb: "A launch pad at the boards.", height: 117 },
  { id: "rink-booth", name: "Photo Booth", price: 300, prestige: 48, rarity: "legendary", blurb: "Proof you were here.", height: 195 },
  { id: "rink-dj", name: "DJ Table", price: 360, prestige: 56, rarity: "legendary", blurb: "The music picks the pace.", height: 143 },
  { id: "rink-disco", name: "Disco Ball Rig", price: 420, prestige: 64, rarity: "legendary", blurb: "The whole rink sparkles.", height: 208 },
  { id: "rink-neon", name: "Neon Skater", price: 520, prestige: 80, rarity: "legendary", blurb: "A skater in pink light.", height: 182 },
];

export function getRinkItem(id: string): RinkItem | undefined {
  return RINK_ITEMS.find((i) => i.id === id);
}

export function rinkItemImage(id: string): string {
  return `/house/rink/${id}.png`;
}
