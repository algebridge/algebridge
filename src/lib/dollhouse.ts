/**
 * The dollhouse plane.
 *
 * This replaces the two cameras the House used to carry, a twelve-angle
 * turntable outside and a 360 panorama inside. Both were projections: they
 * needed the browser to agree, to the last decimal, with numbers baked into an
 * offline renderer, and a drift of a hundredth put a bench through a wall.
 *
 * There is no projection here. The scene is one flat picture, drawn side-on,
 * and everything in it is placed by arithmetic you can read in a line. Depth
 * still exists, because a yard with no depth is a shelf: things further back
 * sit higher in their band and draw smaller. That is a 2D convention, not a
 * camera, nothing here has to match anything rendered elsewhere.
 *
 * Stored coordinates are untouched. Ornaments keep their world metres and
 * furniture keeps its floor percentages, so every garden and every room that
 * existed before this still comes back exactly as it was left.
 */

export const SCENE_W = 1200;
export const SCENE_H = 800;

/** Where the sky stops and the land starts. */
export const HORIZON_Y = 430;

/** The house, as a box on the flat plane. */
export const HOUSE = {
  left: 340,
  right: 860,
  /** Top of the walls; the roof rises above this. */
  wallTop: 302,
  /** Where the building meets the ground. */
  base: 652,
} as const;

/** The strip of lawn in front of the house, which is the whole yard. */
export const YARD_TOP = 656;
export const YARD_BOTTOM = 786;

/** How far from the middle of the yard something may be placed, in metres. */
export const PAD_LIMIT = 6.4;

/** Metres across the yard, from the far edge to the near one. */
const YARD_SPAN = PAD_LIMIT * 2;

export interface Placed {
  /** Metres east of the yard centre. */
  x: number;
  /** Metres north of the yard centre, larger is further from the viewer. */
  z: number;
}

export interface Spot {
  /** Scene units across. */
  x: number;
  /** Scene units down, at the object's feet. */
  y: number;
  /** Size multiplier from depth alone. */
  scale: number;
  /** 0 at the back of the band, 1 at the front. Also the paint order. */
  depth: number;
}

/**
 * Depth is one number, used three ways: height in the band, size, and paint
 * order. Keeping them tied to the same `t` is what stops an ornament from
 * drawing in front of something it is standing behind.
 */
function bandDepth(z: number): number {
  return clamp01((PAD_LIMIT - z) / YARD_SPAN);
}

/** Nearer things fan out wider, which is what sells depth without a camera. */
function spread(t: number): number {
  return 0.86 + 0.28 * t;
}

/** A place in the yard → where it is drawn. */
export function yardSpot(p: Placed): Spot {
  const t = bandDepth(p.z);
  return {
    x: SCENE_W / 2 + p.x * 76 * spread(t),
    y: YARD_TOP + t * (YARD_BOTTOM - YARD_TOP),
    scale: 0.72 + t * 0.56,
    depth: t,
  };
}

/** A point on the scene → where it lands in the yard, for click-to-place. */
export function yardPoint(sx: number, sy: number): Placed {
  const t = clamp01((sy - YARD_TOP) / (YARD_BOTTOM - YARD_TOP));
  return {
    x: (sx - SCENE_W / 2) / (76 * spread(t)),
    z: PAD_LIMIT - t * YARD_SPAN,
  };
}

/** True when a click landed on the lawn rather than the sky or the house. */
export function onYard(sy: number): boolean {
  return sy >= YARD_TOP - 6 && sy <= YARD_BOTTOM + 6;
}

export function inYard(p: Placed): boolean {
  return Math.abs(p.x) <= PAD_LIMIT && Math.abs(p.z) <= PAD_LIMIT;
}

export function clampToYard(p: Placed): Placed {
  return {
    x: clamp(p.x, -PAD_LIMIT, PAD_LIMIT),
    z: clamp(p.z, -PAD_LIMIT, PAD_LIMIT),
  };
}

/* ── Inside ──────────────────────────────────────────────────────────── */

/** The room revealed by the cutaway. Walls are 18 units thick. */
export const ROOM = {
  left: HOUSE.left + 18,
  right: HOUSE.right - 18,
  ceiling: HOUSE.wallTop + 18,
  floor: HOUSE.base - 12,
} as const;

/** Furniture stands on the floor, so only this band takes feet. */
export const FLOOR_TOP = 548;

/**
 * Stored furniture percentages → where it is drawn.
 *
 * The vertical percentage maps into the floor band alone, never the wall
 * above it. That is deliberate: a room drawn side-on has no wall you could
 * stand a chair against halfway up, so anything that mapped over the full
 * height would float. Old saves land on the floor by construction.
 */
export function roomSpot(xPct: number, yPct: number): Spot {
  const t = clamp01(yPct / 100);
  const width = ROOM.right - ROOM.left;
  const centre = (ROOM.left + ROOM.right) / 2;
  return {
    x: centre + (clamp01(xPct / 100) - 0.5) * width * (0.9 + 0.2 * t),
    y: FLOOR_TOP + t * (ROOM.floor - FLOOR_TOP),
    scale: 0.84 + 0.34 * t,
    depth: t,
  };
}

/** A point in the room → the percentages to store, for click-to-place. */
export function roomPoint(sx: number, sy: number): { x: number; y: number } {
  const t = clamp01((sy - FLOOR_TOP) / (ROOM.floor - FLOOR_TOP));
  const width = ROOM.right - ROOM.left;
  const centre = (ROOM.left + ROOM.right) / 2;
  const xPct = ((sx - centre) / (width * (0.9 + 0.2 * t)) + 0.5) * 100;
  return { x: clamp(xPct, 0, 100), y: t * 100 };
}

/** True when a click landed on the floor rather than the wall or outside. */
export function onFloor(sx: number, sy: number): boolean {
  return sx >= ROOM.left && sx <= ROOM.right && sy >= FLOOR_TOP - 8 && sy <= ROOM.floor + 8;
}

/* ── Small shared helpers ────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** Scene units → a CSS percentage of the stage. */
export function pctX(x: number): string {
  return `${(x / SCENE_W) * 100}%`;
}

export function pctY(y: number): string {
  return `${(y / SCENE_H) * 100}%`;
}
