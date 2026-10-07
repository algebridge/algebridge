/**
 * The five houses as rooms: what the floors and walls are made of, the trim,
 * and what you see through the windows. A house's name still means what it
 * did (the cottage is warm wood, the loft is brick and concrete over the
 * city), now in real materials instead of a drawing of one.
 */

export type WallKind = "plaster" | "brick" | "logs" | "bamboo" | "stone";
export type FloorKind = "planks" | "carpet" | "concrete" | "tiles" | "stone";
export type ViewKind = "countryside" | "forest" | "city" | "ocean" | "mountains";
export type WindowShape = "square" | "round" | "grid" | "arch" | "wide";

export interface RoomFinish {
  floor: FloorKind;
  /** The floor's colour: the wood's tone, the carpet's, the tiles'. */
  floorColor: string;
  backWall: WallKind;
  sideWall: WallKind;
  /** Paint colour for a plastered wall (a brick or log wall has its own). */
  wallColor: string;
}

export interface RoomTheme {
  id: string;
  down: RoomFinish;
  up: RoomFinish;
  trim: string;
  window: WindowShape;
  view: ViewKind;
}

export const THEMES: Record<string, RoomTheme> = {
  cottage: {
    id: "cottage",
    down: { floor: "planks", floorColor: "#b48c64", backWall: "plaster", sideWall: "plaster", wallColor: "#ede4d3" },
    up: { floor: "carpet", floorColor: "#cfc4b2", backWall: "plaster", sideWall: "plaster", wallColor: "#dde3d3" },
    trim: "#f3efe6",
    window: "square",
    view: "countryside",
  },
  treehouse: {
    id: "treehouse",
    down: { floor: "planks", floorColor: "#a87947", backWall: "logs", sideWall: "logs", wallColor: "#c9a77a" },
    up: { floor: "planks", floorColor: "#94683c", backWall: "logs", sideWall: "plaster", wallColor: "#e3d6bd" },
    trim: "#6f4a2c",
    window: "round",
    view: "forest",
  },
  loft: {
    id: "loft",
    down: { floor: "concrete", floorColor: "#a8a6a1", backWall: "brick", sideWall: "plaster", wallColor: "#ecebe8" },
    up: { floor: "planks", floorColor: "#5f4130", backWall: "brick", sideWall: "plaster", wallColor: "#e6e4df" },
    trim: "#26282b",
    window: "grid",
    view: "city",
  },
  beach: {
    id: "beach",
    down: { floor: "planks", floorColor: "#e3d2b0", backWall: "bamboo", sideWall: "plaster", wallColor: "#f2ece0" },
    up: { floor: "carpet", floorColor: "#d9c9a8", backWall: "bamboo", sideWall: "plaster", wallColor: "#e6eef0" },
    trim: "#fbfaf6",
    window: "wide",
    view: "ocean",
  },
  castle: {
    id: "castle",
    down: { floor: "stone", floorColor: "#8e8a85", backWall: "stone", sideWall: "stone", wallColor: "#bdb6ad" },
    up: { floor: "planks", floorColor: "#6b4a33", backWall: "stone", sideWall: "plaster", wallColor: "#d9cfe0" },
    trim: "#4a3326",
    window: "arch",
    view: "mountains",
  },
};

export function themeFor(styleId: string | null | undefined): RoomTheme {
  return THEMES[styleId ?? ""] ?? THEMES.cottage;
}
