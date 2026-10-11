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

/**
 * Everything solid on a lot: the house, and the fence or hedge along the
 * front with its gap at the walk. Your own house is left out: it has a door
 * to walk in through, and homeBlockers knows its inside.
 */
export function lotBlockers(lot: StreetLot): Rect[] {
  const out: Rect[] = [];
  if (!lot.house) return out;
  if (!lot.own) out.push({ x0: -HOUSE.halfW, x1: HOUSE.halfW, z0: HOUSE.zBack, z1: HOUSE.zFront });
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

/** How far inside a rect's reach (the rect grown by the radius) a point is; 0 or less outside it. */
function depth(x: number, z: number, r: Rect, radius: number): number {
  return Math.min(x - (r.x0 - radius), r.x1 + radius - x, z - (r.z0 - radius), r.z1 + radius - z);
}

/**
 * A step from `from` by (dx, dz): the whole step if it is clear, else along
 * the wall (x alone, then z alone), else nowhere. Always within the street.
 * A character already within something's reach (put there by a floor
 * change, or a rail they stepped past at its end) may step out of it or
 * along it, never deeper in, so nothing ever traps them.
 */
export function slideMove(from: { x: number; z: number }, dx: number, dz: number, rects: readonly Rect[], radius: number, bounds: Rect = STREET_BOUNDS): { x: number; z: number } {
  const clamp = (x: number, z: number) => ({ x: Math.min(bounds.x1, Math.max(bounds.x0, x)), z: Math.min(bounds.z1, Math.max(bounds.z0, z)) });
  const clear = (t: { x: number; z: number }) =>
    rects.every((r) => {
      const d = depth(t.x, t.z, r, radius);
      if (d <= 0) return true;
      const was = depth(from.x, from.z, r, radius);
      return was > 0 && d <= was + 1e-9;
    });
  const tries = [clamp(from.x + dx, from.z + dz), clamp(from.x + dx, from.z), clamp(from.x, from.z + dz)];
  for (const t of tries) if (clear(t)) return t;
  return { x: from.x, z: from.z };
}

/**
 * Your own house, inside and out, for walking in: the front wall with its
 * door, the porch and its two steps, the room on each floor, the hall
 * inside the door and down the right-hand side, the stair up that hall and
 * the landing it tops out on. World metres; they match garden.ts
 * (GARDEN_LAYOUT, FRONT_LAYOUT) and space.ts (ROOM_W, ROOM_D), and a test
 * checks that.
 */
export const HOME = {
  /** The front wall's face, its thickness, and the doorway's middle and half-width. */
  wallZ: -7.2,
  wallT: 0.3,
  doorX: 1.0,
  doorHalf: 0.62,
  /** The porch deck and the steps down to the walk, which end at stepsEnd. */
  porch: { x0: -1.15, x1: 3.15, z0: -7.05, z1: -4.85, top: 0.32, stepsEnd: -4.23 },
  /** The room box on either floor. */
  room: { x0: -3.5, x1: 2.7, z0: -12.5, z1: -7.9 },
  /** The shell's inner walls, left and right of everything. */
  innerX0: -5.2,
  innerX1: 5.2,
  /** The floor heights. */
  down: 0.32,
  up: 3.1,
  /** The stair up the right-hand hall, foot at the front and head at the back, and the landing at its head. */
  stair: { x0: 4.0, x1: 5.1, zFoot: -7.6, zHead: -11.5 },
  landing: { x0: 2.7, x1: 5.2, z0: -12.5, z1: -11.5 },
};

/** Where a character is: out on the ground (the porch and its steps included), or on either floor of the house. */
export type Level = "ground" | "down" | "up";

/** Whether a spot is on the stair itself (either floor's character climbs or comes down it). */
export function onStair(x: number, z: number): boolean {
  const S = HOME.stair;
  return x >= S.x0 && x <= S.x1 && z <= S.zFoot && z >= S.zHead;
}

/** The height a character stands at, on this level at this spot: the floor, the ramp of the stair, the deck or the steps. */
export function floorAt(level: Level, x: number, z: number): number {
  const H = HOME;
  if (level !== "ground") {
    if (onStair(x, z)) {
      const t = (H.stair.zFoot - z) / (H.stair.zFoot - H.stair.zHead);
      return H.down + (H.up - H.down) * Math.min(1, Math.max(0, t));
    }
    return level === "up" ? H.up : H.down;
  }
  const P = H.porch;
  if (x < P.x0 || x > P.x1) return 0;
  // The deck runs from the wall (the doorway's depth included) to the steps.
  if (z >= H.wallZ - H.wallT && z <= P.z1) return P.top;
  // The two steps: a ramp from the deck down to the walk.
  if (z > P.z1 && z <= P.stepsEnd) return (P.top * (P.stepsEnd - z)) / (P.stepsEnd - P.z1);
  return 0;
}

/**
 * The level after a step to (x, z): in through the doorway and out again,
 * and up or down the stair (the floor changes a little before the stair's
 * end, so the step off it lands on the floor's own rules).
 */
export function levelAfter(level: Level, x: number, z: number): Level {
  const H = HOME;
  const doorLine = H.wallZ - H.wallT / 2;
  if (level === "ground") return z < doorLine && Math.abs(x - H.doorX) < H.doorHalf ? "down" : "ground";
  if (z > doorLine) return "ground";
  if (!onStair(x, z)) return level;
  if (level === "down" && z < H.stair.zHead + 0.3) return "up";
  // Coming down, the foot's open stretch (no rail: see homeBlockers) already counts as downstairs, so a step off it lands on the hall floor.
  if (level === "up" && z > H.stair.zFoot - 0.7) return "down";
  return level;
}

/**
 * Everything solid about your house for a character at (x, z) on this
 * level. Outside: the house but for its doorway, and the porch rail but for
 * the steps. Inside: the walls, the edges of the floor (upstairs has none
 * over the hall), the stair's sides while on it and its underside while
 * not, and the pieces standing on that floor (`pieces`, world metres).
 */
export function homeBlockers(level: Level, x: number, z: number, pieces: readonly Rect[] = []): Rect[] {
  const H = HOME;
  const R = H.room;
  const S = H.stair;
  const wallIn = H.wallZ - H.wallT;
  const gapX0 = H.doorX - H.doorHalf;
  const gapX1 = H.doorX + H.doorHalf;
  if (level === "ground") {
    const P = H.porch;
    return [
      { x0: -5.9, x1: gapX0, z0: -15.1, z1: H.wallZ },
      { x0: gapX1, x1: 5.9, z0: -15.1, z1: H.wallZ },
      { x0: P.x0 - 0.1, x1: P.x0 + 0.05, z0: P.z0, z1: P.z1 },
      { x0: P.x1 - 0.05, x1: P.x1 + 0.1, z0: P.z0, z1: P.z1 },
      { x0: P.x0, x1: H.doorX - 0.78, z0: P.z1 - 0.08, z1: P.z1 },
      { x0: H.doorX + 0.78, x1: P.x1, z0: P.z1 - 0.08, z1: P.z1 },
    ];
  }
  // The front wall from inside but for the doorway, the back wall, and the shell's right-hand wall: on either floor.
  const walls: Rect[] = [
    { x0: H.innerX0 - 0.4, x1: gapX0, z0: wallIn, z1: H.wallZ },
    { x0: gapX1, x1: H.innerX1 + 0.4, z0: wallIn, z1: H.wallZ },
    { x0: H.innerX0 - 0.4, x1: H.innerX1 + 0.4, z0: R.z0 - 0.4, z1: R.z0 },
    { x0: H.innerX1, x1: H.innerX1 + 0.4, z0: R.z0, z1: wallIn },
  ];
  if (onStair(x, z)) {
    // On the stair: its open side is railed from the second tread up (the foot is open to the hall), its other side is the wall.
    return walls.concat([{ x0: S.x0 - 0.5, x1: S.x0, z0: S.zHead, z1: S.zFoot - 0.7 }]);
  }
  // The room's left wall, and the side of it beyond that has no floor.
  walls.push({ x0: H.innerX0 - 0.4, x1: R.x0, z0: R.z0, z1: R.z1 });
  if (level === "down") {
    // The hall inside the door starts at the room's left wall; the stair's underside is too low to walk.
    walls.push({ x0: H.innerX0 - 0.4, x1: R.x0 - 0.14, z0: R.z1, z1: wallIn });
    walls.push({ x0: S.x0, x1: S.x1, z0: R.z0, z1: S.zFoot - 0.6 });
  } else {
    // Upstairs there is no floor in front of the room, and none over the hall but the landing (and the stair's head).
    walls.push({ x0: H.innerX0 - 0.4, x1: R.x1, z0: R.z1, z1: wallIn });
    walls.push({ x0: R.x1, x1: H.innerX1 + 0.4, z0: H.landing.z1 + 0.4, z1: wallIn });
  }
  return walls.concat(pieces);
}

