/**
 * The room's measurements and the way stored positions become places in it.
 *
 * Saves keep what they always kept (lib/bridgeys.ts): a floor piece's x and
 * y as percentages across the room and from the back wall forward, a wall
 * piece's x along the back wall and y down it. Here those become metres, and
 * metres become percentages again when a piece is dragged, so every room
 * built in the flat house comes back where it was. Pure, so it is tested.
 */

import type { WindowShape } from "./themes";

/** The room: 6.2 m wide (x), 4.6 m deep (z), 2.75 m to the ceiling. The back wall is at z = -D/2. */
export const ROOM_W = 6.2;
export const ROOM_D = 4.6;
export const ROOM_H = 2.75;
export const WALL_T = 0.14;

/** Stored floor percentages are kept within these, as bridgeys.ts clamps them. */
const FLOOR_X = { lo: 5, hi: 95 };
const FLOOR_Y = { lo: 10, hi: 92 };

/** The usable floor: a margin from the walls and the open front. */
const MARGIN_X = 0.35;
const MARGIN_BACK = 0.3;
const MARGIN_FRONT = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A floor piece's stored percentages → its spot on the floor, in metres. */
export function floorToWorld(xPct: number, yPct: number): { x: number; z: number } {
  const tx = (clamp(xPct, FLOOR_X.lo, FLOOR_X.hi) - FLOOR_X.lo) / (FLOOR_X.hi - FLOOR_X.lo);
  const tz = (clamp(yPct, FLOOR_Y.lo, FLOOR_Y.hi) - FLOOR_Y.lo) / (FLOOR_Y.hi - FLOOR_Y.lo);
  const x0 = -ROOM_W / 2 + MARGIN_X;
  const x1 = ROOM_W / 2 - MARGIN_X;
  const z0 = -ROOM_D / 2 + MARGIN_BACK;
  const z1 = ROOM_D / 2 - MARGIN_FRONT;
  return { x: x0 + tx * (x1 - x0), z: z0 + tz * (z1 - z0) };
}

/** A spot on the floor → the percentages to store. */
export function worldToFloor(x: number, z: number): { x: number; y: number } {
  const x0 = -ROOM_W / 2 + MARGIN_X;
  const x1 = ROOM_W / 2 - MARGIN_X;
  const z0 = -ROOM_D / 2 + MARGIN_BACK;
  const z1 = ROOM_D / 2 - MARGIN_FRONT;
  const tx = clamp((x - x0) / (x1 - x0), 0, 1);
  const tz = clamp((z - z0) / (z1 - z0), 0, 1);
  return { x: FLOOR_X.lo + tx * (FLOOR_X.hi - FLOOR_X.lo), y: FLOOR_Y.lo + tz * (FLOOR_Y.hi - FLOOR_Y.lo) };
}

/** Where a hung piece's bottom edge may sit on the wall: from high up to just above a desk. */
export const WALL_HANG = { top: 2.0, bottom: 0.95 };
const WALL_MARGIN = 0.45;

/** A wall piece's stored percentages → its spot on the back wall: x along it, y its bottom edge. */
export function wallToWorld(xPct: number, yPct: number): { x: number; y: number } {
  const x0 = -ROOM_W / 2 + WALL_MARGIN;
  const x1 = ROOM_W / 2 - WALL_MARGIN;
  return {
    x: x0 + clamp(xPct / 100, 0, 1) * (x1 - x0),
    y: WALL_HANG.top - clamp(yPct / 100, 0, 1) * (WALL_HANG.top - WALL_HANG.bottom),
  };
}

/** A spot on the back wall → the percentages to store. */
export function worldToWall(x: number, y: number): { x: number; y: number } {
  const x0 = -ROOM_W / 2 + WALL_MARGIN;
  const x1 = ROOM_W / 2 - WALL_MARGIN;
  return {
    x: clamp((x - x0) / (x1 - x0), 0, 1) * 100,
    y: clamp((WALL_HANG.top - y) / (WALL_HANG.top - WALL_HANG.bottom), 0, 1) * 100,
  };
}

/** The back wall's face, where hung pieces sit. */
export const BACK_WALL_Z = -ROOM_D / 2;

/** Openings in the walls: the window and door on the back wall, the window on the side wall (x = -W/2). */
export const BACK_WINDOW = { x: -0.55, w: 1.5, sill: 0.92, h: 1.38 };
export const DOOR = { x: 2.15, w: 0.92, h: 2.08 };
export const SIDE_WINDOW = { z: -0.25, w: 1.6, sill: 0.92, h: 1.38 };

/** Each house style's windows: how big, for its shape. */
export function windowSize(shape: WindowShape, base: { w: number; h: number; sill: number }): { w: number; h: number; sill: number } {
  if (shape === "round") return { w: 1.15, h: 1.15, sill: 1.0 };
  if (shape === "grid") return { w: 1.7, h: 1.75, sill: 0.6 };
  if (shape === "wide") return { w: 2.1, h: 1.3, sill: 0.95 };
  if (shape === "arch") return { w: 1.1, h: 1.6, sill: 0.85 };
  return base;
}

/** The stretches of back wall taken by the window and the door, casings included. */
export function backWallOpenings(shape: WindowShape): { x0: number; x1: number }[] {
  const win = windowSize(shape, BACK_WINDOW);
  const casing = 0.1;
  return [
    { x0: BACK_WINDOW.x - win.w / 2 - casing, x1: BACK_WINDOW.x + win.w / 2 + casing },
    { x0: DOOR.x - DOOR.w / 2 - casing, x1: DOOR.x + DOOR.w / 2 + casing },
  ];
}

/**
 * Where along the back wall a hung piece of this width really goes: where it
 * was put, or slid the least way off the window or the door. Every opening
 * reaches higher than a hung piece's lowest edge can sit (WALL_HANG.top), so
 * only the sideways overlap matters. A piece too wide for any clear stretch
 * covers as little of an opening as it can.
 */
export function clearOfOpenings(x: number, width: number, shape: WindowShape): number {
  const half = width / 2;
  const lo = -ROOM_W / 2 + half + 0.05;
  const hi = ROOM_W / 2 - half - 0.05;
  const open = backWallOpenings(shape);
  const covered = (cx: number) => open.reduce((s, o) => s + Math.max(0, Math.min(cx + half, o.x1) - Math.max(cx - half, o.x0)), 0);
  const start = clamp(x, lo, hi);
  if (covered(start) < 1e-6) return start;
  const tries = [start, ...open.flatMap((o) => [o.x0 - half, o.x1 + half]).map((c) => clamp(c, lo, hi))];
  return tries.reduce((best, c) => {
    const d = covered(c) - covered(best);
    return d < -1e-6 || (Math.abs(d) <= 1e-6 && Math.abs(c - start) < Math.abs(best - start)) ? c : best;
  });
}
