/**
 * The interior camera, shared between the renderer and the browser.
 *
 * These constants are copies of the ones in scripts/gen-interiors.ts and have
 * to agree exactly, the same way the yard's do. `npm run check:yard` asserts
 * both.
 *
 * The interior is a cylindrical panorama shot from standing height in the
 * middle of the room: a full turn of heading across the image width, a slice
 * of elevation down its height. So a point in the room maps to a fixed spot on
 * that strip, and looking around is just sliding the strip sideways. Furniture
 * is positioned on the strip rather than on the screen, which means it travels
 * with the walls for free.
 *
 * Furniture keeps its existing storage — percentages of the room floor, as the
 * flat explorer used — so nothing a student already placed is lost. Those
 * percentages are read as floor coordinates rather than screen ones.
 */

export const ROOM_W = 7.2;
export const ROOM_D = 5.6;
export const EYE_Y = 1.62;
export const V_HALF = 0.62;

/**
 * How much of the full turn the viewport shows.
 *
 * Chosen so the strip's full height lands almost exactly in a 3:2 frame:
 * strip height = (1 / VIEW_TURNS) * (2 * V_HALF / 2pi) of the width, and the
 * frame is 0.667 of its width. At a quarter turn the strip stood taller than
 * the frame and the floor was cropped away, which in a room is most of what
 * you want to see.
 */
export const VIEW_TURNS = 0.3;

export interface RoomPoint {
  /** Metres right of the room centre. */
  x: number;
  /** Metres toward the near wall from the room centre. */
  z: number;
}

export interface OnStrip {
  /** Fraction across the panorama, 0–1, wrapping. */
  u: number;
  /** Fraction down the panorama, 0–1. */
  v: number;
  /** Distance from the eye, for painter's order and scale. */
  depth: number;
  /** How large to draw something, 1 at two metres away. */
  scale: number;
}

/** Stored percentages of the floor → metres from the room centre. */
export function toRoom(xPct: number, yPct: number): RoomPoint {
  return {
    x: (xPct / 100 - 0.5) * ROOM_W,
    z: (yPct / 100 - 0.5) * ROOM_D,
  };
}

/** Metres from the room centre → the percentages that get stored. */
export function toPercent(p: RoomPoint): { x: number; y: number } {
  return {
    x: Math.max(2, Math.min(98, (p.x / ROOM_W + 0.5) * 100)),
    y: Math.max(2, Math.min(98, (p.z / ROOM_D + 0.5) * 100)),
  };
}

/**
 * Where a point on the floor lands on the panorama.
 *
 * Heading is measured the way the renderer sweeps it: azimuth 0 looks toward
 * +z, and it increases turning toward +x.
 */
export function projectRoom(p: RoomPoint, standHeight = 0): OnStrip {
  const dx = p.x;
  const dz = p.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  const az = Math.atan2(dx, dz);
  const el = Math.atan2(standHeight - EYE_Y, Math.max(r, 0.05));

  let u = az / (Math.PI * 2);
  if (u < 0) u += 1;
  const v = 0.5 - el / (2 * V_HALF);
  const depth = Math.sqrt(r * r + EYE_Y * EYE_Y);
  return { u, v, depth, scale: 2 / Math.max(depth, 0.6) };
}

/**
 * A point on the panorama → where it lands on the floor.
 *
 * Only downward rays meet the floor, so anything at or above the horizon has
 * no answer and placement there is refused rather than guessed at.
 */
export function unprojectRoom(u: number, v: number): RoomPoint | null {
  const az = u * Math.PI * 2;
  const el = (0.5 - v) * 2 * V_HALF;
  if (el >= -0.02) return null;

  // Drop from eye height to the floor along that elevation.
  const r = EYE_Y / Math.tan(-el);
  if (!Number.isFinite(r) || r > 14) return null;

  const p = { x: Math.sin(az) * r, z: Math.cos(az) * r };
  return insideRoom(p) ? p : clampToRoom(p);
}

export function insideRoom(p: RoomPoint): boolean {
  return Math.abs(p.x) <= ROOM_W / 2 - 0.25 && Math.abs(p.z) <= ROOM_D / 2 - 0.25;
}

export function clampToRoom(p: RoomPoint): RoomPoint {
  return {
    x: Math.max(-ROOM_W / 2 + 0.25, Math.min(ROOM_W / 2 - 0.25, p.x)),
    z: Math.max(-ROOM_D / 2 + 0.25, Math.min(ROOM_D / 2 - 0.25, p.z)),
  };
}
