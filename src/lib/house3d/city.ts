/**
 * The town your street is part of: three streets running side by side,
 * joined by two cross streets and a road round the edge, every lot along
 * them a real student's house or an open lot. Pure, so it is tested; the
 * yard (garden.ts) draws it and the walk (walk.ts) walks it from these same
 * numbers.
 *
 * Measurements are your street's: lots LOT wide, your street's middle at
 * STREET_MID, and each street ROW_PITCH further on, so the backs of the
 * lots across one street meet the backs of the next street's.
 */

export const LOT = 16;
export const STREET_MID = 11.6;
export const ROW_PITCH = 56;
/** At most this many streets; the town has as many as its students need (rowsFor). */
export const ROWS = 5;
/** Lots run from -COLS to COLS lots either side of yours. */
export const COLS = 6;
/** Where the cross streets run, in lots from yours, and the road round the edge (its middle, in metres). */
export const CROSS = [-4, 4];
export const EDGE_X = (COLS + 0.5) * LOT + 5;
export const STREET_NAMES = ["BRIDGE ST", "MAPLE AVE", "CEDAR LN", "OAK ST", "BIRCH RD"];

/** The middle of a street, in metres north (+z) of your house's street. */
export function rowMid(row: number): number {
  return STREET_MID + ROW_PITCH * row;
}

export interface CityLot {
  x: number;
  /** Which street: 0 is yours. */
  row: number;
  /** Across that street (turned round), or on its near side. */
  across: boolean;
  number: number;
  street: string;
}

/** Where a lot's house stands: the middle of its footprint, in world metres. */
export function houseCenter(lot: { x: number; row: number; across: boolean }): { x: number; z: number } {
  const off = ROW_PITCH * lot.row;
  return { x: lot.x, z: lot.across ? 2 * STREET_MID + off + 11 : -11 + off };
}

/**
 * Every lot in town but yours, nearest first. A cross street takes the
 * place of a lot wherever it runs between two streets; at either end of the
 * town the cross streets stop at the street, and the lots there remain.
 */
export const CITY_LOTS: CityLot[] = (() => {
  const out: CityLot[] = [];
  for (let row = 0; row < ROWS; row += 1)
    for (const across of [false, true])
      for (let k = -COLS; k <= COLS; k += 1) {
        if (row === 0 && !across && k === 0) continue;
        const between = across ? row < ROWS - 1 : row > 0;
        if (between && CROSS.includes(k)) continue;
        out.push({ x: k * LOT, row, across, number: across ? 53 - 2 * k : 52 + 2 * k, street: STREET_NAMES[row] });
      }
  const home = { x: 0, z: -11 };
  const d = (l: CityLot) => {
    const c = houseCenter(l);
    return Math.hypot(c.x - home.x, c.z - home.z);
  };
  return out.sort((a, b) => d(a) - d(b) || a.x - b.x);
})();

/** The cross streets and the road round the edge: their middles, in metres. */
export const CROSS_X = [...CROSS.map((k) => k * LOT), -EDGE_X, EDGE_X];

/**
 * The trees along the front lawns, at the line between two lots, and the
 * street lamps at the curb, on alternate sides: where each stands, in world
 * metres, for drawing and for walking round. `arm` is the way the lamp's arm
 * reaches, over the road.
 */
export const STREET_TREES: { x: number; z: number }[] = [];
export const STREET_LAMPS: { x: number; z: number; arm: 1 | -1 }[] = [];
for (let row = 0; row < ROWS; row += 1) {
  const off = ROW_PITCH * row;
  for (let x = -COLS * LOT + LOT / 2; x <= COLS * LOT - LOT / 2; x += LOT) {
    STREET_TREES.push({ x, z: 4.0 + off }, { x, z: 2 * STREET_MID + off - 4.0 });
  }
  for (const x of [-88, -56, -24, 24, 56, 88]) STREET_LAMPS.push({ x, z: 6.15 + off, arm: 1 });
  for (const x of [-72, -40, -8, 8, 40, 72]) STREET_LAMPS.push({ x, z: 2 * STREET_MID + off - 6.15, arm: -1 });
}

/** A length of road or sidewalk from a to b, with the cross streets' mouths (each `half` either side of its middle) left open. */
export function spans(a: number, b: number, cuts: readonly number[], half: number): [number, number][] {
  const out: [number, number][] = [];
  let at = a;
  for (const c of [...cuts].sort((p, q) => p - q)) {
    if (c + half <= at || c - half >= b) continue;
    if (c - half > at) out.push([at, c - half]);
    at = Math.max(at, c + half);
  }
  if (b > at) out.push([at, b]);
  return out;
}

/** How many streets the town needs for this many neighbours: the lots fill nearest first, so the furthest one in use decides. Always your own street. */
export function rowsFor(neighbours: number): number {
  let rows = 1;
  for (let i = 0; i < Math.min(neighbours, CITY_LOTS.length); i += 1) rows = Math.max(rows, CITY_LOTS[i].row + 1);
  return rows;
}

/** The far edge of a town of this many streets (the backs of its last street's lots across the road), in metres north. */
export function townEnd(rows: number): number {
  return 2 * STREET_MID + ROW_PITCH * (rows - 1) + 17;
}

