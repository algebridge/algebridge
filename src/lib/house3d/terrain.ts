/**
 * The land beyond the neighbourhood: flat where the houses and the street
 * are, rolling hills further out, bigger ones at the horizon. Pure, so it is
 * tested; the yard (lib/house3d/garden.ts) builds the ground mesh from it and
 * stands the woods on it.
 */

/** The ground stays flat this far out: the town (city.ts: three streets, to the road round its edge), and the street's own run. */
const FLAT = { x: 120, z0: -18, z1: 268 };
const ROAD = { halfLength: 132, z: 11.6, halfWidth: 17 };

/** The ground mesh: this wide, this many squares a side, centred on the neighbourhood. */
export const TERRAIN = { size: 660, segments: 150, centerZ: 70 };
/** A lake in the hills behind the houses, seen over the rooftops from the street: its middle and its reach. The water lies at WATER_Y. */
export const LAKE = { x: 30, z: -82, r: 46 };
export const WATER_Y = -0.5;

/** A fixed, integer-only hash to [0, 1): the same hills on every visit and in every browser. */
function hash(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Smooth value noise in [0, 1]. */
function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** How far a point is outside the flat ground (0 within it). */
export function beyondFlat(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x) - FLAT.x);
  const dz = Math.max(0, z < FLAT.z0 ? FLAT.z0 - z : z - FLAT.z1);
  const rx = Math.max(0, Math.abs(x) - ROAD.halfLength);
  const rz = Math.max(0, Math.abs(z - ROAD.z) - ROAD.halfWidth);
  return Math.min(Math.hypot(dx, dz), Math.hypot(rx, rz));
}

/** How much of the lake a point is in: 0 on dry land, 1 out in the middle. */
export function lakeDepth(x: number, z: number): number {
  return smooth((LAKE.r - Math.hypot(x - LAKE.x, z - LAKE.z)) / 22);
}

/** The ground's height at a point, in metres: 0 across the neighbourhood, hills beyond, a lake bed below its water. */
export function terrainHeight(x: number, z: number): number {
  const d = beyondFlat(x, z);
  if (d <= 0) return 0;
  const ramp = smooth(d / 55);
  const far = smooth((d - 70) / 160);
  const n = noise(x * 0.011 + 3.1, z * 0.011 + 7.7) * 0.6 + noise(x * 0.027, z * 0.027 + 1.3) * 0.3 + noise(x * 0.07 + 9, z * 0.07) * 0.1;
  let h = ramp * (2 + 12 * n) + far * 18 * (0.5 + n);
  // The land lies low round the lake, then dips under its water.
  const near = smooth((LAKE.r + 40 - Math.hypot(x - LAKE.x, z - LAKE.z)) / 40);
  h *= 1 - 0.75 * near;
  const w = lakeDepth(x, z);
  return h * (1 - w) - 2.8 * w;
}

/** Where the land is lush and where it is dry, 0 to 1, for the colour of the grass. */
export function terrainLush(x: number, z: number): number {
  return noise(x * 0.02 + 11, z * 0.02 + 5);
}
