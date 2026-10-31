/**
 * The player's account as the game sees it: name, coins, XP, what they own,
 * what their kart wears, and lifetime stats. Pure data plus pure functions,
 * so the standalone shell can keep it in localStorage and AlgeBridge can keep
 * it in Supabase behind the same ProfileStore interface, and both pay out the
 * same rewards.
 */
import type { MatchResult } from "./types";

export type BodyId = "classic" | "buggy" | "rocket" | "monster" | "formula";
export type WheelId = "standard" | "chunky" | "neon" | "gold";
export type DecalId = "plain" | "stripes" | "flames" | "number" | "checker";
export type TrailId = "smoke" | "fire" | "rainbow" | "bubbles";
export type HatId = "none" | "cap" | "helmet" | "beanie" | "cone" | "horns" | "crown" | "halo" | "tophat" | "pumpkin" | "viking" | "cowboy" | "wizard" | "duck";
export type CharacterId =
  | "kid"
  | "bunny"
  | "cat"
  | "dog"
  | "pig"
  | "chick"
  | "frog"
  | "bear"
  | "monkey"
  | "panda"
  | "fox"
  | "penguin"
  | "dino"
  | "robot"
  | "shark"
  | "alien"
  | "ghost"
  | "skeleton"
  | "unicorn"
  | "dragon";

export interface Loadout {
  character: CharacterId;
  body: BodyId;
  color: string;
  wheels: WheelId;
  hat: HatId;
  decal: DecalId;
  trail: TrailId;
}

export type ItemKind = keyof Loadout;

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  blurb: string;
}

export const CATALOG: Record<ItemKind, ShopItem[]> = {
  character: [
    { id: "kid", name: "Kid", price: 0, blurb: "A racer with a grin." },
    { id: "bunny", name: "Bunny", price: 0, blurb: "Tall ears, buck teeth, no fear." },
    { id: "cat", name: "Cat", price: 150, blurb: "Whiskers, fangs and a tail." },
    { id: "dog", name: "Dog", price: 200, blurb: "Floppy ears, tongue out." },
    { id: "pig", name: "Pig", price: 200, blurb: "Snout up, curly tail." },
    { id: "chick", name: "Chick", price: 250, blurb: "Small, yellow, fearless." },
    { id: "frog", name: "Frog", price: 250, blurb: "Eyes on top, grin all the way round." },
    { id: "bear", name: "Bear", price: 300, blurb: "Round ears, big paws." },
    { id: "monkey", name: "Monkey", price: 300, blurb: "Long tail, cheeky face." },
    { id: "panda", name: "Panda", price: 400, blurb: "Black patches, calm eyes." },
    { id: "fox", name: "Fox", price: 400, blurb: "Pointed ears, bushy tail." },
    { id: "penguin", name: "Penguin", price: 450, blurb: "Flippers on the wheel." },
    { id: "dino", name: "Dino", price: 450, blurb: "Spikes and teeth." },
    { id: "robot", name: "Robot", price: 500, blurb: "Glowing eyes, one antenna." },
    { id: "shark", name: "Shark", price: 550, blurb: "A fin, six teeth, gills." },
    { id: "alien", name: "Alien", price: 550, blurb: "Big eyes, two antennae." },
    { id: "ghost", name: "Ghost", price: 800, blurb: "Hollow eyes, wavy hem." },
    { id: "skeleton", name: "Skeleton", price: 900, blurb: "Skull, ribs, bony hands." },
    { id: "unicorn", name: "Unicorn", price: 1100, blurb: "Golden horn, rainbow mane." },
    { id: "dragon", name: "Dragon", price: 1200, blurb: "Horns, wings and fangs." },
  ],
  body: [
    { id: "classic", name: "Classic", price: 0, blurb: "The everyday kart." },
    { id: "buggy", name: "Buggy", price: 350, blurb: "Open frame, roll cage, big tyres." },
    { id: "rocket", name: "Rocket", price: 500, blurb: "A fuselage with fins and a canopy." },
    { id: "monster", name: "Monster", price: 650, blurb: "Lifted, bull bar, light bar." },
    { id: "formula", name: "Formula", price: 800, blurb: "Long nose, front wing, rear wing." },
  ],
  color: [
    { id: "#ff5d3a", name: "Lava", price: 0, blurb: "" },
    { id: "#ffd400", name: "Sun", price: 0, blurb: "" },
    { id: "#22c55e", name: "Lime", price: 0, blurb: "" },
    { id: "#3d5aff", name: "Royal", price: 0, blurb: "" },
    { id: "#2ec4b6", name: "Teal", price: 0, blurb: "" },
    { id: "#ff5d8f", name: "Bubblegum", price: 0, blurb: "" },
    { id: "#8b5cf6", name: "Grape", price: 120, blurb: "" },
    { id: "#06b6d4", name: "Sky", price: 120, blurb: "" },
    { id: "#f97316", name: "Tangerine", price: 120, blurb: "" },
    { id: "#e11d48", name: "Cherry", price: 120, blurb: "" },
    { id: "#a3e635", name: "Acid", price: 120, blurb: "" },
    { id: "#f4f1ea", name: "Pearl", price: 150, blurb: "" },
    { id: "#1b1b24", name: "Midnight", price: 150, blurb: "" },
    { id: "#c08a4b", name: "Caramel", price: 150, blurb: "" },
    { id: "#ff8a1f", name: "Ember", price: 150, blurb: "" },
    { id: "#7dd3fc", name: "Ice", price: 150, blurb: "" },
  ],
  wheels: [
    { id: "standard", name: "Standard", price: 0, blurb: "Black rubber, steel hubs." },
    { id: "chunky", name: "Chunky", price: 250, blurb: "Wider, taller, treaded." },
    { id: "neon", name: "Neon", price: 400, blurb: "Rims that glow." },
    { id: "gold", name: "Gold", price: 600, blurb: "Gold hubs, white walls." },
  ],
  hat: [
    { id: "none", name: "No hat", price: 0, blurb: "" },
    { id: "cap", name: "Cap", price: 0, blurb: "" },
    { id: "beanie", name: "Beanie", price: 120, blurb: "" },
    { id: "helmet", name: "Helmet", price: 150, blurb: "" },
    { id: "cone", name: "Traffic cone", price: 150, blurb: "" },
    { id: "horns", name: "Horns", price: 200, blurb: "" },
    { id: "pumpkin", name: "Pumpkin", price: 200, blurb: "" },
    { id: "tophat", name: "Top hat", price: 250, blurb: "" },
    { id: "halo", name: "Halo", price: 300, blurb: "" },
    { id: "cowboy", name: "Cowboy", price: 300, blurb: "" },
    { id: "crown", name: "Crown", price: 350, blurb: "" },
    { id: "viking", name: "Viking", price: 400, blurb: "" },
    { id: "wizard", name: "Wizard", price: 450, blurb: "" },
    { id: "duck", name: "Duck", price: 500, blurb: "" },
  ],
  decal: [
    { id: "plain", name: "Plain", price: 0, blurb: "" },
    { id: "stripes", name: "Racing stripes", price: 200, blurb: "" },
    { id: "number", name: "Number", price: 250, blurb: "" },
    { id: "flames", name: "Flames", price: 300, blurb: "" },
    { id: "checker", name: "Checker", price: 350, blurb: "" },
  ],
  trail: [
    { id: "smoke", name: "Smoke", price: 0, blurb: "Plain exhaust." },
    { id: "fire", name: "Fire", price: 300, blurb: "Burning exhaust and flames." },
    { id: "bubbles", name: "Bubbles", price: 450, blurb: "Soft blue bubbles." },
    { id: "rainbow", name: "Rainbow", price: 600, blurb: "Every colour, all the time." },
  ],
};

export const ITEM_KINDS: ItemKind[] = ["character", "body", "color", "wheels", "hat", "decal", "trail"];

export const KIND_LABELS: Record<ItemKind, string> = { character: "Characters", body: "Karts", color: "Paint", wheels: "Wheels", hat: "Hats", decal: "Decals", trail: "Trails" };

export const DEFAULT_LOADOUT: Loadout = { character: "kid", body: "classic", color: "#ff5d3a", wheels: "standard", hat: "cap", decal: "plain", trail: "smoke" };

export interface ProfileStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  bestStreak: number;
  coinsEarned: number;
}

export interface Profile {
  version: 1;
  name: string;
  coins: number;
  xp: number;
  owned: Record<ItemKind, string[]>;
  loadout: Loadout;
  stats: ProfileStats;
  settings: { sound: boolean; music: boolean; gate: boolean };
  createdAt: number;
  updatedAt: number;
}

/** Where a profile lives: localStorage here, a Supabase row in AlgeBridge. */
export interface ProfileStore {
  load(): Promise<Profile | null>;
  save(p: Profile): Promise<void>;
}

export const STARTING_COINS = 250;

export function newProfile(name = ""): Profile {
  const now = Date.now();
  return {
    version: 1,
    name,
    coins: STARTING_COINS,
    xp: 0,
    owned: freeItems(),
    loadout: { ...DEFAULT_LOADOUT },
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, bestStreak: 0, coinsEarned: 0 },
    settings: { sound: true, music: true, gate: false },
    createdAt: now,
    updatedAt: now,
  };
}

function freeItems(): Record<ItemKind, string[]> {
  const out = {} as Record<ItemKind, string[]>;
  for (const kind of ITEM_KINDS) out[kind] = CATALOG[kind].filter((i) => i.price === 0).map((i) => i.id);
  return out;
}

/** Fill in anything missing from a stored profile, and drop anything that no longer exists. */
export function normalizeProfile(raw: unknown): Profile {
  const base = newProfile();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Profile>;
  const owned = freeItems();
  for (const kind of ITEM_KINDS) {
    const have = Array.isArray(r.owned?.[kind]) ? (r.owned![kind] as string[]) : [];
    for (const id of have) if (CATALOG[kind].some((i) => i.id === id) && !owned[kind].includes(id)) owned[kind].push(id);
  }
  const loadout = { ...DEFAULT_LOADOUT };
  for (const kind of ITEM_KINDS) {
    const id = r.loadout?.[kind];
    if (typeof id === "string" && owned[kind].includes(id)) (loadout as Record<ItemKind, string>)[kind] = id;
  }
  return {
    version: 1,
    name: typeof r.name === "string" ? r.name.slice(0, 14) : "",
    coins: num(r.coins, STARTING_COINS),
    xp: num(r.xp, 0),
    owned,
    loadout,
    stats: { ...base.stats, ...(r.stats ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    createdAt: num(r.createdAt, Date.now()),
    updatedAt: num(r.updatedAt, Date.now()),
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);

export function itemOf(kind: ItemKind, id: string): ShopItem | undefined {
  return CATALOG[kind].find((i) => i.id === id);
}

export function owns(p: Profile, kind: ItemKind, id: string): boolean {
  return p.owned[kind].includes(id);
}

export type BuyResult = "ok" | "owned" | "poor" | "unknown";

/** Buy and equip. */
export function buy(p: Profile, kind: ItemKind, id: string): BuyResult {
  const item = itemOf(kind, id);
  if (!item) return "unknown";
  if (owns(p, kind, id)) return "owned";
  if (p.coins < item.price) return "poor";
  p.coins -= item.price;
  p.owned[kind].push(id);
  (p.loadout as Record<ItemKind, string>)[kind] = id;
  p.updatedAt = Date.now();
  return "ok";
}

export function equip(p: Profile, kind: ItemKind, id: string): boolean {
  if (!owns(p, kind, id)) return false;
  (p.loadout as Record<ItemKind, string>)[kind] = id;
  p.updatedAt = Date.now();
  return true;
}

// ----- levels and rewards -----

/** XP needed to go from this level to the next. */
export function xpToNext(level: number): number {
  return 250 + 150 * (level - 1);
}

export function levelOf(xp: number): { level: number; into: number; need: number; title: string } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level) && level < 99) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level), title: titleFor(level) };
}

export function titleFor(level: number): string {
  if (level >= 30) return "Legend";
  if (level >= 20) return "Champion";
  if (level >= 12) return "Smasher";
  if (level >= 6) return "Racer";
  if (level >= 3) return "Driver";
  return "Rookie";
}

export const REWARDS = {
  /** Paid the moment it happens. */
  kill: 15,
  /** Extra per kill once a streak reaches three. */
  streak: 10,
  /** By finishing place, 1st first. */
  place: [150, 100, 70, 50, 40, 30, 25, 20],
  match: 40,
  xpKill: 20,
  xpPlace: [250, 180, 140, 100, 80, 60, 50, 40],
  xpMatch: 80,
};

export interface RewardLine {
  label: string;
  coins: number;
  xp: number;
}

export interface Rewards {
  coins: number;
  xp: number;
  lines: RewardLine[];
}

/** What a kill pays right away. */
export function killReward(streak: number): number {
  return REWARDS.kill + (streak >= 3 ? REWARDS.streak : 0);
}

/**
 * What a finished match pays on top of the kills already paid: a line for
 * the place, a line for playing it through, and the XP for everything.
 */
export function matchRewards(r: MatchResult): Rewards {
  const me = r.standings.find((s) => s.isPlayer);
  const rank = r.playerRank;
  const lines: RewardLine[] = [];
  if (!me || rank < 1) return { coins: 0, xp: 0, lines };
  const idx = Math.min(rank - 1, REWARDS.place.length - 1);
  lines.push({ label: rank === 1 ? "Won the match" : `Placed ${ordinal(rank)}`, coins: REWARDS.place[idx], xp: REWARDS.xpPlace[idx] });
  if (me.kills > 0) lines.push({ label: `${me.kills} ${me.kills === 1 ? "smash" : "smashes"}`, coins: 0, xp: REWARDS.xpKill * me.kills });
  lines.push({ label: "Played it through", coins: REWARDS.match, xp: REWARDS.xpMatch });
  return { coins: lines.reduce((s, l) => s + l.coins, 0), xp: lines.reduce((s, l) => s + l.xp, 0), lines };
}

export function applyRewards(p: Profile, rw: Rewards): void {
  p.coins += rw.coins;
  p.xp += rw.xp;
  p.stats.coinsEarned += rw.coins;
  p.updatedAt = Date.now();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
