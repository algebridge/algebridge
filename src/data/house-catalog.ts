import type { FurnitureItem, FurnitureSlot, HouseStyle, PlacedFurnitureEntry } from "@/types";

export const STARTER_HOUSE_ID = "cottage";

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
    description: "Your free starter home, warm wood floors and sunny windows.",
    wallColor: "#fef3c7",
    floorColor: "#d97706",
    accentColor: "#92400e",
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
  { id: "trophy-case", name: "Trophy Case", emoji: "🏆", price: 400, slot: "back-left", prestige: 75, rarity: "legendary", displayWidth: 88 },
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

  // ---- Added Sep 2026: a teenager's room, not a classroom ----------------
  { id: "cactus", name: "Desert Cactus", price: 20, slot: "back-left", prestige: 7, rarity: "common", displayWidth: 44, blurb: "Needs water once a month. Perfect." },
  { id: "window-plant", name: "Hanging Planter", price: 28, slot: "back-right", prestige: 9, rarity: "common", displayWidth: 44 },
  { id: "floor-cushion", name: "Floor Cushion", price: 24, slot: "mid-left", prestige: 8, rarity: "common", displayWidth: 64 },
  { id: "wall-shelf", name: "Floating Shelf", price: 26, slot: "back-center", prestige: 9, rarity: "common", displayWidth: 70 },
  { id: "string-lights", name: "String Lights", price: 30, slot: "back-center", prestige: 11, rarity: "common", displayWidth: 90 },
  { id: "fan", name: "Desk Fan", price: 30, slot: "back-right", prestige: 10, rarity: "common", displayWidth: 44 },
  { id: "coat-rack", name: "Coat Rack", price: 32, slot: "back-left", prestige: 11, rarity: "common", displayWidth: 48 },
  { id: "pinboard", name: "Pin Board", price: 33, slot: "back-center", prestige: 12, rarity: "common", displayWidth: 66 },
  { id: "headphones", name: "Headphone Stand", price: 34, slot: "back-right", prestige: 12, rarity: "common", displayWidth: 44 },
  { id: "side-table", name: "Side Table", price: 36, slot: "mid-right", prestige: 13, rarity: "common", displayWidth: 54 },
  { id: "skateboard", name: "Skateboard", price: 40, slot: "mid-left", prestige: 14, rarity: "common", displayWidth: 66 },
  { id: "hoop", name: "Door Hoop", price: 44, slot: "back-right", prestige: 15, rarity: "common", displayWidth: 46 },
  { id: "floor-lamp", name: "Arc Floor Lamp", price: 46, slot: "back-left", prestige: 16, rarity: "common", displayWidth: 54 },
  { id: "dumbbells", name: "Dumbbell Rack", price: 50, slot: "mid-left", prestige: 17, rarity: "common", displayWidth: 60 },
  { id: "mini-fridge", name: "Mini Fridge", price: 55, slot: "back-left", prestige: 18, rarity: "common", displayWidth: 48, blurb: "Stocked, somehow, forever." },
  { id: "easel", name: "Art Easel", price: 58, slot: "mid-right", prestige: 19, rarity: "common", displayWidth: 56 },
  { id: "record-player", name: "Record Player", price: 62, slot: "back-right", prestige: 21, rarity: "common", displayWidth: 66 },
  { id: "keyboard", name: "Music Keyboard", price: 90, slot: "mid-right", prestige: 26, rarity: "rare", displayWidth: 90 },
  { id: "ring-light", name: "Creator Ring Light", price: 95, slot: "back-right", prestige: 27, rarity: "rare", displayWidth: 50 },
  { id: "terrarium", name: "Terrarium", price: 100, slot: "back-left", prestige: 28, rarity: "rare", displayWidth: 56 },
  { id: "coffee-machine", name: "Espresso Machine", price: 115, slot: "back-right", prestige: 30, rarity: "rare", displayWidth: 52 },
  { id: "gaming-chair", name: "Gaming Chair", price: 120, slot: "mid-center", prestige: 33, rarity: "rare", displayWidth: 62 },
  { id: "guitar", name: "Electric Guitar", price: 130, slot: "back-left", prestige: 34, rarity: "rare", displayWidth: 58 },
  { id: "vinyl-wall", name: "Record Wall", price: 140, slot: "back-center", prestige: 36, rarity: "rare", displayWidth: 84 },
  { id: "bike", name: "Wall Bike", price: 150, slot: "back-center", prestige: 38, rarity: "rare", displayWidth: 88 },
  { id: "bunk-bed", name: "Bunk Bed", price: 160, slot: "back-center", prestige: 40, rarity: "rare", displayWidth: 104 },
  { id: "skate-ramp", name: "Mini Ramp", price: 175, slot: "mid-right", prestige: 42, rarity: "rare", displayWidth: 100 },
  { id: "drone", name: "Drone Dock", price: 180, slot: "back-right", prestige: 43, rarity: "rare", displayWidth: 66 },
  { id: "vending", name: "Vending Machine", price: 190, slot: "back-right", prestige: 45, rarity: "rare", displayWidth: 60 },
  { id: "swing-chair", name: "Hanging Egg Chair", price: 200, slot: "mid-left", prestige: 47, rarity: "rare", displayWidth: 72 },
  { id: "drum-kit", name: "Drum Kit", price: 210, slot: "mid-right", prestige: 48, rarity: "rare", displayWidth: 96 },
  { id: "projector", name: "Projector Screen", price: 220, slot: "back-center", prestige: 50, rarity: "rare", displayWidth: 92 },
  { id: "pc-setup", name: "Battle Station", price: 230, slot: "mid-center", prestige: 52, rarity: "rare", displayWidth: 108, blurb: "Three fans. All of them loud." },
  { id: "fireplace", name: "Fireplace", price: 250, slot: "back-center", prestige: 56, rarity: "rare", displayWidth: 90 },
  { id: "foosball", name: "Foosball Table", price: 280, slot: "mid-center", prestige: 60, rarity: "rare", displayWidth: 104 },
  { id: "pinball", name: "Pinball Machine", price: 300, slot: "mid-right", prestige: 64, rarity: "rare", displayWidth: 70 },
  { id: "jukebox", name: "Jukebox", price: 500, slot: "back-left", prestige: 86, rarity: "legendary", displayWidth: 66 },
  { id: "claw-machine", name: "Claw Machine", price: 560, slot: "back-right", prestige: 92, rarity: "legendary", displayWidth: 66 },
  { id: "ball-pit", name: "Ball Pit", price: 600, slot: "mid-center", prestige: 98, rarity: "legendary", displayWidth: 110 },
  { id: "dj-booth", name: "DJ Booth", price: 640, slot: "mid-center", prestige: 104, rarity: "legendary", displayWidth: 112 },
  { id: "ice-cream-cart", name: "Ice Cream Cart", price: 680, slot: "mid-right", prestige: 108, rarity: "legendary", displayWidth: 90 },
  { id: "sim-rig", name: "Racing Sim Rig", price: 700, slot: "mid-center", prestige: 112, rarity: "legendary", displayWidth: 108 },
  { id: "robot-dog", name: "Robot Dog", price: 760, slot: "mid-left", prestige: 118, rarity: "legendary", displayWidth: 74, blurb: "Fetches nothing. Loved anyway." },
  { id: "slide", name: "Indoor Slide", price: 820, slot: "mid-left", prestige: 124, rarity: "legendary", displayWidth: 100 },
  { id: "hot-tub", name: "Hot Tub", price: 900, slot: "mid-center", prestige: 132, rarity: "legendary", displayWidth: 108 },
  { id: "greenhouse", name: "Mini Greenhouse", price: 1000, slot: "back-left", prestige: 140, rarity: "legendary", displayWidth: 94 },
  { id: "block-castle", name: "Block Castle", price: 1050, slot: "mid-right", prestige: 145, rarity: "legendary", displayWidth: 96 },
  { id: "planetarium", name: "Planetarium Dome", price: 1100, slot: "back-center", prestige: 152, rarity: "legendary", displayWidth: 108 },
  { id: "dino-skeleton", name: "Dino Skeleton", price: 1300, slot: "back-center", prestige: 160, rarity: "legendary", displayWidth: 112 },
  { id: "holo-table", name: "Hologram Table", price: 1500, slot: "mid-center", prestige: 172, rarity: "legendary", displayWidth: 100 },

  // ---- Unit prizes: one per unit, earned by finishing it -----------------
  { id: "prize-ruler", name: "Golden Ruler", price: 0, earnedBy: "working-with-units", slot: "back-left", prestige: 60, rarity: "legendary", displayWidth: 72, blurb: "Every unit measured, starting with this one." },
  { id: "prize-scale", name: "Brass Balance", price: 0, earnedBy: "solving-equations", slot: "mid-right", prestige: 70, rarity: "legendary", displayWidth: 68, blurb: "Both sides, always equal." },
  { id: "prize-graph", name: "Framed Line", price: 0, earnedBy: "linear-equations-graphs", slot: "back-center", prestige: 80, rarity: "legendary", displayWidth: 74, blurb: "Rise over run, on the wall." },
  { id: "prize-neon-line", name: "Intercept Neon", price: 0, earnedBy: "forms-linear-equations", slot: "back-center", prestige: 90, rarity: "legendary", displayWidth: 88, blurb: "y = mx + b, in lights." },
  { id: "prize-lasers", name: "Crossing Lasers", price: 0, earnedBy: "systems-equations", slot: "mid-center", prestige: 100, rarity: "legendary", displayWidth: 92, blurb: "Two beams, one solution." },
  { id: "prize-half-rug", name: "Half-Plane Rug", price: 0, earnedBy: "inequalities-systems", slot: "mid-center", prestige: 110, rarity: "legendary", displayWidth: 100, blurb: "The shaded side is the answer." },
  { id: "prize-machine", name: "Function Machine", price: 0, earnedBy: "functions", slot: "mid-left", prestige: 120, rarity: "legendary", displayWidth: 96, blurb: "Feed it x. Out comes f(x)." },
  { id: "prize-stairs", name: "Staircase Shelf", price: 0, earnedBy: "sequences", slot: "mid-right", prestige: 130, rarity: "legendary", displayWidth: 90, blurb: "Each step the same size up." },
  { id: "prize-bonsai", name: "Radical Bonsai", price: 0, earnedBy: "exponents-radicals", slot: "back-right", prestige: 140, rarity: "legendary", displayWidth: 60, blurb: "Grown from a root." },
  { id: "prize-vine", name: "Growth Vine", price: 0, earnedBy: "exponential-growth-decay", slot: "back-left", prestige: 150, rarity: "legendary", displayWidth: 70, blurb: "Doubles every week." },
  { id: "prize-area-table", name: "Area Model Table", price: 0, earnedBy: "quadratics-factoring", slot: "mid-center", prestige: 160, rarity: "legendary", displayWidth: 96, blurb: "Four products, one table." },
  { id: "prize-arch", name: "Parabola Arch", price: 0, earnedBy: "quadratic-functions", slot: "back-center", prestige: 170, rarity: "legendary", displayWidth: 104, blurb: "It opens up. So do you." },
  { id: "prize-zigzag", name: "Piecewise Neon", price: 0, earnedBy: "absolute-value-piecewise", slot: "back-center", prestige: 180, rarity: "legendary", displayWidth: 90, blurb: "A different rule on every stretch." },
];

/**
 * Pieces that go on a wall as well as the floor: pictures, shelves, lights,
 * anything with a hook. Kept as a list rather than a flag on each row so the
 * set is easy to read in one place.
 */
export const WALL_MOUNTED = new Set([
  "poster", "clock", "whiteboard", "wall-shelf", "string-lights", "pinboard", "hoop", "neon-sign", "vinyl-wall",
  "bike", "projector", "window-plant", "chandelier", "disco-ball",
  "prize-graph", "prize-neon-line", "prize-zigzag", "prize-vine",
]);
for (const item of FURNITURE_ITEMS) if (WALL_MOUNTED.has(item.id)) item.mount = "wall";

/** Can this piece hang on a wall? */
export function canHang(itemId: string): boolean {
  return WALL_MOUNTED.has(itemId);
}

/** The furniture a student can buy. Unit prizes are earned instead. */
export const SHOP_ITEMS: FurnitureItem[] = FURNITURE_ITEMS.filter((i) => !i.earnedBy);

/** The prize for finishing a unit, in course order. */
export const UNIT_PRIZES: FurnitureItem[] = FURNITURE_ITEMS.filter((i) => !!i.earnedBy);

export function getUnitPrize(unitId: string): FurnitureItem | undefined {
  return UNIT_PRIZES.find((i) => i.earnedBy === unitId);
}

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
