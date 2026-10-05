/**
 * Display titles by tier, and finding the title a saved label means.
 *
 * The tier comes from the price, so a title's look always matches what it
 * cost: common ones are a tinted chip, rare ones a plate in their own color
 * with a shine, epic ones night-sky plates with a metal edge, and legendary
 * ones gold foil.
 */

import { DISPLAY_TITLES, getDisplayTitle } from "@/data/titles-catalog";
import type { DisplayTitle } from "@/types";

export type TitleTier = "common" | "rare" | "epic" | "legendary";

export const TIERS: { id: TitleTier; label: string; blurb: string; from: number }[] = [
  { id: "common", label: "Common", blurb: "A first one to wear, in a tint of its own.", from: 0 },
  { id: "rare", label: "Rare", blurb: "A plate in its own color, with a shine.", from: 150 },
  { id: "epic", label: "Epic", blurb: "Night-sky plates with a metal edge.", from: 300 },
  { id: "legendary", label: "Legendary", blurb: "Gold foil. Everyone notices.", from: 700 },
];

export const TIER_LABEL: Record<TitleTier, string> = Object.fromEntries(TIERS.map((t) => [t.id, t.label])) as Record<TitleTier, string>;

/** The tier a title (or a price) belongs to. */
export function tierOf(title: DisplayTitle | number): TitleTier {
  const price = typeof title === "number" ? title : title.price;
  let tier: TitleTier = "common";
  for (const t of TIERS) if (price >= t.from) tier = t.id;
  return tier;
}

/** Every title, grouped by tier, cheapest first within each. */
export function titlesByTier(): { tier: (typeof TIERS)[number]; titles: DisplayTitle[] }[] {
  return TIERS.map((tier) => ({
    tier,
    titles: DISPLAY_TITLES.filter((t) => tierOf(t) === tier.id).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name)),
  }));
}

const PICTOGRAPHS = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

/**
 * The title a saved label means: an id, a name, or the "<emoji> Name"
 * labels saved before titles had drawn emblems (still on old leaderboard
 * rows). Null for anything else.
 */
export function resolveTitle(stored: string | null | undefined): DisplayTitle | null {
  if (!stored) return null;
  const byId = getDisplayTitle(stored.trim());
  if (byId) return byId;
  const name = stored.replace(PICTOGRAPHS, "").replace(/\s{2,}/g, " ").trim().toLowerCase();
  return DISPLAY_TITLES.find((t) => t.name.toLowerCase() === name) ?? null;
}
