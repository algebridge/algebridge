/**
 * The ten houses as rooms: what the floors and walls are made of, the trim,
 * what you see through the windows, and how the house stands outside (its
 * roof and its walls as the street sees them). A house's name still means
 * what it did (the cottage is warm wood, the loft is brick and concrete over
 * the city), now in real materials instead of a drawing of one.
 */

export type WallKind = "plaster" | "brick" | "logs" | "bamboo" | "stone" | "boards" | "timber";
export type FloorKind = "planks" | "carpet" | "concrete" | "tiles" | "stone";
export type ViewKind = "countryside" | "forest" | "city" | "ocean" | "mountains" | "desert" | "lake";
export type WindowShape = "square" | "round" | "grid" | "arch" | "wide";
/** The roof's shape: two slopes to a ridge, a flat top (with or without battlements), a barn's broken slopes, or one slope. */
export type RoofKind = "gable" | "flat" | "battlements" | "gambrel" | "shed";

export interface RoomFinish {
  floor: FloorKind;
  /** The floor's colour: the wood's tone, the carpet's, the tiles'. */
  floorColor: string;
  backWall: WallKind;
  sideWall: WallKind;
  /** Paint colour for a plastered wall, the tone of painted boards (a brick or log wall has its own). */
  wallColor: string;
  /** The side wall's colour when it differs from the back wall's. */
  sideColor?: string;
}

/** How the house stands on its lot: its roof, its outside walls, its door, and the small things that make it that house. */
export interface HouseLook {
  roof: RoofKind;
  /** A gable's slope, in radians; a gambrel's lower slope. */
  pitch?: number;
  /** The roof's colour. */
  roofTint?: string;
  /** Standing-seam metal instead of shingles. */
  seam?: boolean;
  /** Fish-scale shingles, as on a painted lady. */
  scallops?: boolean;
  /** The outside walls, when they differ from the downstairs finish (the barn is red outside and wood within). */
  wall?: { kind: WallKind; color: string };
  /** A plank door with iron straps, or a panelled door in this colour. */
  door: { kind: "plank" | "panel"; color?: string };
  /** Black metal gutters and fittings rather than painted ones. */
  darkMetal?: boolean;
  chimney?: boolean;
  /** Painted shutters either side of each window. */
  shutters?: string;
  /** Window boxes of red flowers under the windows. */
  flowerBoxes?: boolean;
  /** A stone band round the lower storey. */
  stoneBase?: boolean;
  /** A balcony along the upper storey. */
  balcony?: boolean;
  /** Round beam ends through the wall below a flat roof, as on an adobe. */
  vigas?: boolean;
  /** A round corner tower with a pointed roof. */
  turret?: boolean;
  /** A cupola with a weathervane on the ridge. */
  cupola?: boolean;
  /** Boards up the corners, as on a barn. */
  cornerBoards?: boolean;
  /** Deep eaves on brackets, as on a chalet. */
  deepEaves?: boolean;
  /** Windows smaller (or bigger) than the shape's usual size. */
  windowScale?: number;
}

export interface RoomTheme {
  id: string;
  down: RoomFinish;
  up: RoomFinish;
  trim: string;
  window: WindowShape;
  view: ViewKind;
  look: HouseLook;
}

export const THEMES: Record<string, RoomTheme> = {
  cottage: {
    id: "cottage",
    down: { floor: "planks", floorColor: "#b48c64", backWall: "plaster", sideWall: "plaster", wallColor: "#ede4d3" },
    up: { floor: "carpet", floorColor: "#cfc4b2", backWall: "plaster", sideWall: "plaster", wallColor: "#dde3d3" },
    trim: "#f3efe6",
    window: "square",
    view: "countryside",
    look: { roof: "gable", pitch: 0.66, roofTint: "#6e645c", door: { kind: "panel", color: "#56705f" }, chimney: true },
  },
  treehouse: {
    id: "treehouse",
    down: { floor: "planks", floorColor: "#a87947", backWall: "logs", sideWall: "logs", wallColor: "#c9a77a" },
    up: { floor: "planks", floorColor: "#94683c", backWall: "logs", sideWall: "plaster", wallColor: "#e3d6bd" },
    trim: "#6f4a2c",
    window: "round",
    view: "forest",
    look: { roof: "gable", pitch: 0.7, roofTint: "#8b6a4a", door: { kind: "plank" } },
  },
  loft: {
    id: "loft",
    down: { floor: "concrete", floorColor: "#a8a6a1", backWall: "brick", sideWall: "plaster", wallColor: "#ecebe8" },
    up: { floor: "planks", floorColor: "#5f4130", backWall: "brick", sideWall: "plaster", wallColor: "#e6e4df" },
    trim: "#26282b",
    window: "grid",
    view: "city",
    look: { roof: "flat", door: { kind: "panel", color: "#24272a" }, darkMetal: true },
  },
  beach: {
    id: "beach",
    down: { floor: "planks", floorColor: "#e3d2b0", backWall: "bamboo", sideWall: "plaster", wallColor: "#f2ece0" },
    up: { floor: "carpet", floorColor: "#d9c9a8", backWall: "bamboo", sideWall: "plaster", wallColor: "#e6eef0" },
    trim: "#fbfaf6",
    window: "wide",
    view: "ocean",
    look: { roof: "gable", pitch: 0.44, roofTint: "#c4cccf", seam: true, door: { kind: "panel", color: "#f4f2ec" } },
  },
  castle: {
    id: "castle",
    down: { floor: "stone", floorColor: "#8e8a85", backWall: "stone", sideWall: "stone", wallColor: "#bdb6ad" },
    up: { floor: "planks", floorColor: "#6b4a33", backWall: "stone", sideWall: "plaster", wallColor: "#d9cfe0" },
    trim: "#4a3326",
    window: "arch",
    view: "mountains",
    look: { roof: "battlements", door: { kind: "plank" }, darkMetal: true },
  },
  barn: {
    id: "barn",
    down: { floor: "planks", floorColor: "#a4703f", backWall: "timber", sideWall: "timber", wallColor: "#b8875a" },
    up: { floor: "planks", floorColor: "#8e6238", backWall: "timber", sideWall: "plaster", wallColor: "#b8875a", sideColor: "#f1ead9" },
    trim: "#f6f1e6",
    window: "square",
    view: "countryside",
    look: { roof: "gambrel", pitch: 0.95, roofTint: "#5a5550", wall: { kind: "boards", color: "#9b2d2a" }, door: { kind: "plank" }, cupola: true, cornerBoards: true },
  },
  victorian: {
    id: "victorian",
    down: { floor: "planks", floorColor: "#7a4a2f", backWall: "plaster", sideWall: "plaster", wallColor: "#f0e6ee" },
    up: { floor: "carpet", floorColor: "#c9b8c6", backWall: "plaster", sideWall: "plaster", wallColor: "#e8dfe9" },
    trim: "#f8f4f9",
    window: "arch",
    view: "city",
    look: { roof: "gable", pitch: 0.92, roofTint: "#4b4a5e", scallops: true, wall: { kind: "plaster", color: "#c9b8e0" }, door: { kind: "panel", color: "#5b2a52" }, turret: true, chimney: true },
  },
  adobe: {
    id: "adobe",
    down: { floor: "tiles", floorColor: "#c27a55", backWall: "plaster", sideWall: "plaster", wallColor: "#efdfca" },
    up: { floor: "planks", floorColor: "#9c6a45", backWall: "plaster", sideWall: "plaster", wallColor: "#f3e7d6" },
    trim: "#3aa0a0",
    window: "square",
    view: "desert",
    look: { roof: "flat", roofTint: "#b89a7e", wall: { kind: "plaster", color: "#c8845a" }, door: { kind: "plank" }, vigas: true, windowScale: 0.82 },
  },
  chalet: {
    id: "chalet",
    down: { floor: "stone", floorColor: "#9a948c", backWall: "stone", sideWall: "timber", wallColor: "#8a5f3a" },
    up: { floor: "planks", floorColor: "#8a5f3a", backWall: "timber", sideWall: "plaster", wallColor: "#8a5f3a", sideColor: "#efe7d8" },
    trim: "#3f2d1f",
    window: "square",
    view: "mountains",
    look: { roof: "gable", pitch: 0.42, roofTint: "#5c5048", wall: { kind: "timber", color: "#7a5230" }, door: { kind: "plank" }, shutters: "#3f6b3f", flowerBoxes: true, stoneBase: true, balcony: true, deepEaves: true },
  },
  modern: {
    id: "modern",
    down: { floor: "concrete", floorColor: "#b9b7b2", backWall: "plaster", sideWall: "plaster", wallColor: "#f4f3ef" },
    up: { floor: "planks", floorColor: "#c8b08a", backWall: "plaster", sideWall: "plaster", wallColor: "#f2f1ec", sideColor: "#2c2f33" },
    trim: "#1f2225",
    window: "grid",
    view: "lake",
    look: { roof: "shed", roofTint: "#2a2d31", seam: true, wall: { kind: "plaster", color: "#f2f1ec" }, door: { kind: "panel", color: "#1f2225" }, darkMetal: true },
  },
};

export function themeFor(styleId: string | null | undefined): RoomTheme {
  return THEMES[styleId ?? ""] ?? THEMES.cottage;
}
