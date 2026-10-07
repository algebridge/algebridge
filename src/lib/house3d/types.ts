/**
 * The Bridgey House in 3D: shared types.
 *
 * Every piece of furniture is a model built in code from a small kit of real
 * materials (lib/house3d/kit.ts), in metres, standing on the floor at the
 * origin and facing +z (towards the camera). Nothing is drawn: wood has
 * grain, fabric has weave, metal reflects the room, and one light reaches
 * all of it, so every piece belongs to the same room.
 */

import type * as THREE from "three";
import type { Kit } from "./kit";

/** What a piece can show of the student's real progress (lib/house-functions.ts fills it in). */
export interface LiveData {
  /** Right answers today, and the daily goal. */
  goalRight: number;
  goalTarget: number;
  /** Practice days in a row. */
  streak: number;
  unitsDone: number;
  unitsTotal: number;
  skillsDone: number;
  skillsTotal: number;
  /** How grown the plants are, 0 to 1: daily goals reached over the last two weeks. */
  growth: number;
  /** No practice for three days: the plants droop until the next one. */
  thirsty: boolean;
  /** The skill the student is on, and its key idea, for the whiteboard and the TV. */
  skillTitle: string | null;
  keyIdea: string | null;
  /** The time the clocks show. */
  now: Date;
}

export interface BuildOptions {
  /** The colour picked for the piece's main part (a swatch's hex), or null for its own. */
  color: string | null;
  /** Switched on: lights glow and light the room, screens show a picture. */
  on: boolean;
  live: LiveData;
}

export interface ItemModel {
  /** Width (x), height (y) and depth (z) in metres, for spacing, the selection ring and the shop picture. */
  size: [number, number, number];
  /**
   * Hung on a wall: the model's origin is the middle of its back, at its
   * bottom edge, and it faces +z out of the wall.
   */
  wall?: boolean;
  /**
   * Hangs from the ceiling (a chandelier, a disco ball): the origin is the
   * point it hangs from, and it is built downwards.
   */
  ceiling?: boolean;
  /** Where a switched-on piece gives off light, relative to its origin, and how much. */
  light?: { at: [number, number, number]; color: string; intensity: number; distance?: number };
  build(k: Kit, o: BuildOptions): THREE.Object3D;
}

export const DEFAULT_LIVE: LiveData = {
  goalRight: 0,
  goalTarget: 10,
  streak: 0,
  unitsDone: 0,
  unitsTotal: 15,
  skillsDone: 0,
  skillsTotal: 52,
  growth: 0.3,
  thirsty: false,
  skillTitle: null,
  keyIdea: null,
  now: new Date(2026, 9, 6, 10, 10),
};
