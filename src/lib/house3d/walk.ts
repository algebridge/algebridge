/**
 * Walking the street: where a character may go. Houses and hedges are solid,
 * lawns, walks, the sidewalk and the road are open, and the street ends
 * where the neighbourhood does. Pure, so it is tested; the measurements
 * here match the lots in lib/house3d/garden.ts (a test checks that).
 */

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A lot on the street: where it stands, and whether it is across the road (turned round). */
export interface StreetLot {
  x: number;
  across: boolean;
  /** A house stands on it (an open lot has nothing to walk into). */
  house: boolean;
  /** Which side the driveway runs up, for where the hedge stops. */
  drive: 1 | -1;
  /** Your own lot: a picket fence with a gate, not a hedge. */
  own?: boolean;
}

/** Lots are this far apart, middle to middle (garden.ts LOT). */
export const LOT_PITCH = 16;
/** The middle of the road (garden.ts STREET_MID). */
export const STREET_MID = 11.6;
/** A house's footprint on its lot, porch and steps included, with a little room round it. */
const HOUSE = { halfW: 5.9, zBack: -15.1, zFront: -4.1 };
const DOOR_X = 1.0;
const FENCE_Z = 4.75;
const DRIVE_X = 6.95;
/** How far along the street and back from it a character may walk. */
export const STREET_BOUNDS: Rect = { x0: -58, x1: 58, z0: -17, z1: 2 * STREET_MID + 17 };

/** A rect on a lot, placed in the world: moved along the street, and turned round across it. */
function placed(lot: StreetLot, r: Rect): Rect {
  if (!lot.across) return { x0: r.x0 + lot.x, x1: r.x1 + lot.x, z0: r.z0, z1: r.z1 };
  // Across the road the lot is turned half round: x and z both mirror.
  return { x0: lot.x - r.x1, x1: lot.x - r.x0, z0: 2 * STREET_MID - r.z1, z1: 2 * STREET_MID - r.z0 };
}

/** Everything solid on a lot: the house, and the fence or hedge along the front with its gap at the walk. */
export function lotBlockers(lot: StreetLot): Rect[] {
  const out: Rect[] = [];
  if (!lot.house) return out;
  out.push({ x0: -HOUSE.halfW, x1: HOUSE.halfW, z0: HOUSE.zBack, z1: HOUSE.zFront });
  const z0 = FENCE_Z - 0.2;
  const z1 = FENCE_Z + 0.2;
  if (lot.own) {
    out.push({ x0: -7, x1: DOOR_X - 0.75, z0, z1 }, { x0: DOOR_X + 0.75, x1: 7, z0, z1 });
  } else {
    const runs: [number, number][] = lot.drive > 0 ? [[-LOT_PITCH / 2 + 0.3, DOOR_X - 0.8], [DOOR_X + 0.8, DRIVE_X - 1.5]] : [[-DRIVE_X + 1.5, DOOR_X - 0.8], [DOOR_X + 0.8, LOT_PITCH / 2 - 0.3]];
    for (const [a, b] of runs) if (b - a > 0.3) out.push({ x0: a, x1: b, z0, z1 });
  }
  return out.map((r) => placed(lot, r));
}

export function blocked(x: number, z: number, rects: readonly Rect[], radius: number): boolean {
  return rects.some((r) => x > r.x0 - radius && x < r.x1 + radius && z > r.z0 - radius && z < r.z1 + radius);
}

/**
 * A step from `from` by (dx, dz): the whole step if it is clear, else along
 * the wall (x alone, then z alone), else nowhere. Always within the street.
 */
export function slideMove(from: { x: number; z: number }, dx: number, dz: number, rects: readonly Rect[], radius: number, bounds: Rect = STREET_BOUNDS): { x: number; z: number } {
  const clamp = (x: number, z: number) => ({ x: Math.min(bounds.x1, Math.max(bounds.x0, x)), z: Math.min(bounds.z1, Math.max(bounds.z0, z)) });
  const tries = [clamp(from.x + dx, from.z + dz), clamp(from.x + dx, from.z), clamp(from.x, from.z + dz)];
  for (const t of tries) if (!blocked(t.x, t.z, rects, radius)) return t;
  return { x: from.x, z: from.z };
}
