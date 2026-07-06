import type { FurnitureItem, FurnitureSlot, HouseStyle, PlacedFurnitureEntry } from "@/types";

export const STARTER_HOUSE_ID = "cottage";

/** AI-generated cartoon yard scene (houses are overlaid on top). */
export const YARD_CARTOON_BG = "/house/yard-cartoon-bg.png";

export const ROOM_WIDTH = 800;
export const ROOM_HEIGHT = 500;

export const SLOT_COORDS: Record<FurnitureSlot, { x: number; y: number }> = {
  "back-left": { x: 18, y: 28 },
  "back-center": { x: 50, y: 22 },
  "back-right": { x: 82, y: 28 },
  "mid-left": { x: 22, y: 58 },
  "mid-center": { x: 50, y: 62 },
  "mid-right": { x: 78, y: 58 },
};

export const HOUSE_STYLES: HouseStyle[] = [
  {
    id: "cottage",
    name: "Cozy Cottage",
    emoji: "🏡",
    price: 0,
    description: "Your free starter home — warm wood floors and sunny windows.",
    wallColor: "#fef3c7",
    floorColor: "#d97706",
    accentColor: "#92400e",
    exteriorImage: "/house/exterior/cottage.png",
  },
  {
    id: "treehouse",
    name: "Treehouse Hideout",
    emoji: "🌳",
    price: 150,
    description: "A leafy treetop clubhouse with round windows and rope-ladder vibes.",
    wallColor: "#dcfce7",
    floorColor: "#92400e",
    accentColor: "#365314",
    exteriorImage: "/house/exterior/treehouse.png",
  },
  {
    id: "loft",
    name: "City Loft",
    emoji: "🏙️",
    price: 320,
    description: "Sleek downtown pad with skyline views and modern floors.",
    wallColor: "#e2e8f0",
    floorColor: "#475569",
    accentColor: "#0f172a",
    exteriorImage: "/house/exterior/loft.png",
  },
  {
    id: "beach",
    name: "Beach Bungalow",
    emoji: "🏖️",
    price: 520,
    description: "Bamboo walls, ocean breeze, and sandy floors. Vacation mode ON.",
    wallColor: "#bae6fd",
    floorColor: "#fcd34d",
    accentColor: "#0369a1",
    exteriorImage: "/house/exterior/beach.png",
  },
  {
    id: "castle",
    name: "Algebra Castle",
    emoji: "🏰",
    price: 950,
    description: "Purple stone towers, math banners, and royal torchlight.",
    wallColor: "#e9d5ff",
    floorColor: "#5b21b6",
    accentColor: "#4c1d95",
    exteriorImage: "/house/exterior/castle.png",
  },
];

export const FURNITURE_ITEMS: FurnitureItem[] = [
  { id: "rug", name: "Welcome Rug", emoji: "🟫", price: 15, slot: "mid-center", prestige: 5, rarity: "common", displayWidth: 95 },
  { id: "plant", name: "Potted Plant", emoji: "🪴", price: 22, slot: "back-left", prestige: 8, rarity: "common", displayWidth: 50 },
  { id: "lamp", name: "Desk Lamp", emoji: "💡", price: 28, slot: "back-right", prestige: 10, rarity: "common", displayWidth: 42 },
  { id: "poster", name: "Math Poster", emoji: "📊", price: 35, slot: "back-center", prestige: 12, rarity: "common", displayWidth: 55 },
  { id: "chair", name: "Study Chair", emoji: "🪑", price: 45, slot: "mid-left", prestige: 15, rarity: "common", displayWidth: 52 },
  { id: "bookshelf", name: "Bookshelf", emoji: "📚", price: 60, slot: "back-left", prestige: 20, rarity: "common", displayWidth: 72 },
  { id: "beanbag", name: "Cozy Beanbag", emoji: "🫘", price: 38, slot: "mid-left", prestige: 14, rarity: "common", displayWidth: 68 },
  { id: "clock", name: "Algebra Clock", emoji: "🕐", price: 48, slot: "back-center", prestige: 16, rarity: "common", displayWidth: 48 },
  { id: "yoga-mat", name: "Focus Yoga Mat", emoji: "🧘", price: 42, slot: "mid-center", prestige: 13, rarity: "common", displayWidth: 75 },
  { id: "calculator-bot", name: "Calculator Bot", emoji: "🔢", price: 58, slot: "mid-left", prestige: 18, rarity: "common", displayWidth: 48 },
  { id: "lava-lamp", name: "Lava Lamp", emoji: "🌋", price: 52, slot: "back-right", prestige: 17, rarity: "common", displayWidth: 38 },
  { id: "homework-station", name: "Homework Station", emoji: "📋", price: 68, slot: "mid-center", prestige: 21, rarity: "common", displayWidth: 88 },
  { id: "desk", name: "Algebra Desk", emoji: "🖥️", price: 85, slot: "mid-center", prestige: 25, rarity: "rare", displayWidth: 98 },
  { id: "bed", name: "Cloud Bed", emoji: "🛏️", price: 110, slot: "back-center", prestige: 30, rarity: "rare", displayWidth: 115 },
  { id: "tv", name: "Lesson TV", emoji: "📺", price: 125, slot: "back-right", prestige: 35, rarity: "rare", displayWidth: 78 },
  { id: "whiteboard", name: "Study Whiteboard", emoji: "📝", price: 72, slot: "back-right", prestige: 22, rarity: "common", displayWidth: 82 },
  { id: "globe", name: "Spinning Globe", emoji: "🌍", price: 95, slot: "mid-right", prestige: 28, rarity: "rare", displayWidth: 52 },
  { id: "snack-bar", name: "Snack Bar", emoji: "🍿", price: 105, slot: "mid-right", prestige: 32, rarity: "rare", displayWidth: 78 },
  { id: "candy-machine", name: "Candy Machine", emoji: "🍬", price: 165, slot: "mid-right", prestige: 38, rarity: "rare", displayWidth: 55 },
  { id: "hammock", name: "Reading Hammock", emoji: "🏝️", price: 145, slot: "mid-left", prestige: 40, rarity: "rare", displayWidth: 105 },
  { id: "robot", name: "Tutor Bot", emoji: "🤖", price: 185, slot: "mid-center", prestige: 50, rarity: "rare", displayWidth: 58 },
  { id: "telescope", name: "Star Telescope", emoji: "🔭", price: 170, slot: "mid-right", prestige: 45, rarity: "rare", displayWidth: 48 },
  { id: "cloud-couch", name: "Cloud Couch", emoji: "☁️", price: 240, slot: "mid-center", prestige: 55, rarity: "rare", displayWidth: 110 },
  { id: "arcade", name: "Mini Arcade", emoji: "🕹️", price: 260, slot: "mid-right", prestige: 60, rarity: "rare", displayWidth: 82 },
  { id: "disco-ball", name: "Disco Ball", emoji: "🪩", price: 340, slot: "back-center", prestige: 65, rarity: "rare", displayWidth: 45 },
  { id: "neon-sign", name: "Neon Math Sign", emoji: "✨", price: 380, slot: "back-center", prestige: 72, rarity: "rare", displayWidth: 90 },
  { id: "trophy-case", name: "Trophy Case", emoji: "🏆", price: 360, slot: "back-left", prestige: 75, rarity: "legendary", displayWidth: 88 },
  { id: "piano", name: "Grand Piano", emoji: "🎹", price: 420, slot: "mid-left", prestige: 80, rarity: "legendary", displayWidth: 105 },
  { id: "chandelier", name: "Crystal Chandelier", emoji: "💎", price: 480, slot: "back-center", prestige: 85, rarity: "legendary", displayWidth: 65 },
  { id: "science-lab", name: "Mini Science Lab", emoji: "🧪", price: 550, slot: "back-left", prestige: 95, rarity: "legendary", displayWidth: 95 },
  { id: "aquarium", name: "Galaxy Aquarium", emoji: "🐠", price: 620, slot: "back-center", prestige: 100, rarity: "legendary", displayWidth: 88 },
  { id: "dragon-statue", name: "Dragon Statue", emoji: "🐉", price: 720, slot: "back-left", prestige: 110, rarity: "legendary", displayWidth: 68 },
  { id: "portal", name: "Math Portal", emoji: "🌀", price: 850, slot: "back-right", prestige: 120, rarity: "legendary", displayWidth: 82 },
  { id: "golden-calculator", name: "Golden Calculator", emoji: "🏅", price: 980, slot: "mid-center", prestige: 130, rarity: "legendary", displayWidth: 55 },
  { id: "throne", name: "Math Throne", emoji: "👑", price: 1200, slot: "mid-center", prestige: 150, rarity: "legendary", displayWidth: 78 },
  { id: "unicorn-statue", name: "Unicorn Statue", emoji: "🦄", price: 1400, slot: "mid-right", prestige: 165, rarity: "legendary", displayWidth: 72 },
  { id: "rocket", name: "Rocket Ship", emoji: "🚀", price: 1600, slot: "mid-right", prestige: 180, rarity: "legendary", displayWidth: 92 },
  { id: "dragon-egg", name: "Dragon Egg", emoji: "🥚", price: 1800, slot: "back-center", prestige: 195, rarity: "legendary", displayWidth: 50 },
  { id: "infinity-pool", name: "Infinity Pool", emoji: "♾️", price: 2500, slot: "mid-center", prestige: 250, rarity: "legendary", displayWidth: 130 },
  { id: "time-machine", name: "Time Machine", emoji: "⏳", price: 3000, slot: "mid-right", prestige: 300, rarity: "legendary", displayWidth: 85 },
];

export function getHouseStyle(id: string): HouseStyle | undefined {
  return HOUSE_STYLES.find((h) => h.id === id);
}

export function getFurnitureItem(id: string): FurnitureItem | undefined {
  return FURNITURE_ITEMS.find((f) => f.id === id);
}

export function getFurnitureImageSrc(id: string): string {
  return `/house/furniture/${id}.png`;
}

export function getBestOwnedFurniture(ownedIds: string[]): FurnitureItem | null {
  let best: FurnitureItem | null = null;
  for (const id of ownedIds) {
    const item = getFurnitureItem(id);
    if (!item) continue;
    if (!best || item.prestige > best.prestige) best = item;
  }
  return best;
}

export function migrateSlotPlacements(
  placedFurniture: Record<string, string>
): PlacedFurnitureEntry[] {
  const entries: PlacedFurnitureEntry[] = [];
  for (const [slot, itemId] of Object.entries(placedFurniture)) {
    const coords = SLOT_COORDS[slot as FurnitureSlot];
    if (!coords) continue;
    entries.push({ instanceId: `${itemId}-${slot}`, itemId, x: coords.x, y: coords.y });
  }
  return entries;
}

export function getUnplacedFurnitureIds(
  owned: string[],
  placed: PlacedFurnitureEntry[]
): string[] {
  const placedIds = new Set(placed.map((p) => p.itemId));
  return owned.filter((id) => !placedIds.has(id));
}

export const RARITY_STYLES = {
  common: { ring: "ring-slate-200", badge: "bg-slate-100 text-slate-600", label: "Common" },
  rare: { ring: "ring-sky-300", badge: "bg-sky-100 text-sky-700", label: "Rare" },
  legendary: { ring: "ring-purple-400", badge: "bg-purple-100 text-purple-700", label: "Legendary" },
} as const;
