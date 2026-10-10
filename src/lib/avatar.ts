/**
 * A student's character: the choices they can make and what each is called.
 * Pure, so it is tested. The figure itself is built from a spec in
 * lib/house3d/figure.ts; the choices here are the only values a spec may
 * hold, so a spec from another student's row is checked against them
 * before anything is built from it (sanitizeAvatar).
 */

import type { AvatarSpec } from "@/types";

export interface Choice {
  id: string;
  label: string;
}

export const SKIN_TONES = ["#f6d9c4", "#f1c7a5", "#e0ac86", "#c98d63", "#b07a55", "#8d5a3b", "#6f432a", "#4b2d1c"];
export const HAIR_COLORS = ["#1c1210", "#4a2c17", "#7a5230", "#a8713d", "#c9a24a", "#e8d9a6", "#b23a2a", "#8e8e94", "#2f6bd6", "#d653a8", "#2f9e6a"];
export const EYE_COLORS = ["#2b1b12", "#6b4426", "#3b5a8c", "#4f7a3a", "#7a8a94"];
export const CLOTHES_COLORS = ["#2563eb", "#ea580c", "#dc2626", "#f59e0b", "#16a34a", "#0d9488", "#7c3aed", "#db2777", "#f4f1ea", "#1f2937", "#6b7280", "#8b5e34", "#0ea5e9", "#a3e635"];

export const HAIR_STYLES: Choice[] = [
  { id: "short", label: "Short" },
  { id: "buzz", label: "Buzz cut" },
  { id: "curly", label: "Curly" },
  { id: "long", label: "Long" },
  { id: "ponytail", label: "Ponytail" },
  { id: "bun", label: "Bun" },
  { id: "braids", label: "Braids" },
  { id: "bald", label: "Shaved" },
];
export const TOPS: Choice[] = [
  { id: "tee", label: "T-shirt" },
  { id: "hoodie", label: "Hoodie" },
  { id: "jacket", label: "Jacket" },
  { id: "jersey", label: "Jersey" },
  { id: "sweater", label: "Sweater" },
];
export const BOTTOMS: Choice[] = [
  { id: "jeans", label: "Jeans" },
  { id: "shorts", label: "Shorts" },
  { id: "joggers", label: "Joggers" },
  { id: "skirt", label: "Skirt" },
];
export const EXTRAS: Choice[] = [
  { id: "glasses", label: "Glasses" },
  { id: "cap", label: "Cap" },
  { id: "headphones", label: "Headphones" },
  { id: "backpack", label: "Backpack" },
];
export const BUILDS: Choice[] = [
  { id: "slim", label: "Slim" },
  { id: "medium", label: "Medium" },
  { id: "broad", label: "Broad" },
];
export const HEIGHTS: Choice[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "tall", label: "Tall" },
];

/** What each colour is called, for the swatch buttons. */
export const COLOR_NAMES: Record<string, string> = {
  "#f6d9c4": "Skin tone 1",
  "#f1c7a5": "Skin tone 2",
  "#e0ac86": "Skin tone 3",
  "#c98d63": "Skin tone 4",
  "#b07a55": "Skin tone 5",
  "#8d5a3b": "Skin tone 6",
  "#6f432a": "Skin tone 7",
  "#4b2d1c": "Skin tone 8",
  "#1c1210": "Black",
  "#4a2c17": "Dark brown",
  "#7a5230": "Brown",
  "#a8713d": "Auburn",
  "#c9a24a": "Blond",
  "#e8d9a6": "Light blond",
  "#b23a2a": "Red",
  "#8e8e94": "Grey",
  "#2f6bd6": "Blue",
  "#d653a8": "Pink",
  "#2f9e6a": "Green",
  "#2b1b12": "Dark brown",
  "#6b4426": "Hazel",
  "#3b5a8c": "Blue",
  "#4f7a3a": "Green",
  "#7a8a94": "Grey",
  "#2563eb": "Blue",
  "#ea580c": "Orange",
  "#dc2626": "Red",
  "#f59e0b": "Amber",
  "#16a34a": "Green",
  "#0d9488": "Teal",
  "#7c3aed": "Violet",
  "#db2777": "Pink",
  "#f4f1ea": "White",
  "#1f2937": "Charcoal",
  "#6b7280": "Grey",
  "#8b5e34": "Brown",
  "#0ea5e9": "Sky blue",
  "#a3e635": "Lime",
};

export const DEFAULT_AVATAR: AvatarSpec = {
  skin: "#e0ac86",
  hair: "short",
  hairColor: "#4a2c17",
  eyes: "#2b1b12",
  top: "hoodie",
  topColor: "#2563eb",
  bottom: "jeans",
  bottomColor: "#1f2937",
  shoes: "#f4f1ea",
  extras: [],
  build: "medium",
  height: "medium",
};

const has = (list: readonly Choice[], id: unknown): id is string => typeof id === "string" && list.some((c) => c.id === id);
const colorIn = (list: readonly string[], v: unknown, fallback: string): string => (typeof v === "string" && list.includes(v.toLowerCase()) ? v.toLowerCase() : fallback);

/**
 * A spec with every field checked against the choices above: anything else
 * (a save from an older version, a row written by hand) falls back to the
 * default for that field, so a figure can always be built from it.
 */
export function sanitizeAvatar(raw: unknown): AvatarSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR;
  const extras = Array.isArray(r.extras) ? r.extras.filter((e): e is string => has(EXTRAS, e)) : [];
  return {
    skin: colorIn(SKIN_TONES, r.skin, d.skin),
    hair: has(HAIR_STYLES, r.hair) ? r.hair : d.hair,
    hairColor: colorIn(HAIR_COLORS, r.hairColor, d.hairColor),
    eyes: colorIn(EYE_COLORS, r.eyes, d.eyes),
    top: has(TOPS, r.top) ? r.top : d.top,
    topColor: colorIn(CLOTHES_COLORS, r.topColor, d.topColor),
    bottom: has(BOTTOMS, r.bottom) ? r.bottom : d.bottom,
    bottomColor: colorIn(CLOTHES_COLORS, r.bottomColor, d.bottomColor),
    shoes: colorIn(CLOTHES_COLORS, r.shoes, d.shoes),
    extras: [...new Set(extras)],
    build: has(BUILDS, r.build) ? (r.build as AvatarSpec["build"]) : d.build,
    height: has(HEIGHTS, r.height) ? (r.height as AvatarSpec["height"]) : d.height,
  };
}

/** A character picked at random, for a "surprise me" button. */
export function randomAvatar(random: () => number = Math.random): AvatarSpec {
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const extras = EXTRAS.filter(() => random() < 0.3).map((e) => e.id);
  return {
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS),
    eyes: pick(EYE_COLORS),
    top: pick(TOPS).id,
    topColor: pick(CLOTHES_COLORS),
    bottom: pick(BOTTOMS).id,
    bottomColor: pick(CLOTHES_COLORS),
    shoes: pick(CLOTHES_COLORS),
    extras,
    build: pick(BUILDS).id as AvatarSpec["build"],
    height: pick(HEIGHTS).id as AvatarSpec["height"],
  };
}

/** One string for a spec, for telling two apart and for cache keys. */
export function avatarKey(spec: AvatarSpec): string {
  return [spec.skin, spec.hair, spec.hairColor, spec.eyes, spec.top, spec.topColor, spec.bottom, spec.bottomColor, spec.shoes, [...spec.extras].sort().join("+"), spec.build, spec.height].join("|");
}
