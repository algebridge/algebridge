/**
 * Renders each house as an actual building.
 *
 *   npm run houses
 *
 * The sprites this replaces were flat clipart with hard black outlines. They
 * were the last thing in the frame with no form, and once the ground became a
 * render they were the only reason the picture still read as assembled: the
 * land had per-pixel light and the building had a painted-on highlight.
 *
 * So each house is a signed distance field — boxes, prisms, cylinders and
 * cones — sphere-traced per pixel. Architecture is far easier to model this
 * way than an animal, because a building really is a handful of solids.
 *
 * The important part is the camera. It is *the same camera as the yard*:
 * same eye height, same horizon, same field of view, same pitch scale, and
 * the house is placed at the same PAD_Z the terrain was levelled at. Each
 * frame is rendered full size, so compositing is a straight overlay with no
 * placement maths — and the perspective, the horizon and the sun all agree
 * with the ground by construction rather than by tuning.
 *
 * Output is WebP with alpha, mostly empty, so the files are small.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/* Camera and pad — must stay in step with scripts/gen-yards.ts. */
const CAM_Y = 1.85;
const HORIZON = 0.6;
const PITCH_SCALE = 1.02;
const FOV = 0.66;
const PAD_Z = 15.5;

const W = 1800;
const H = 1200;
const SS = 2;

type V3 = [number, number, number];

const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normalize(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/* ── Primitives ─────────────────────────────────────────────────
   Each returns a signed distance. Everything below is built from these. */

function sdBox(p: V3, c: V3, b: V3): number {
  const q: V3 = [
    Math.abs(p[0] - c[0]) - b[0],
    Math.abs(p[1] - c[1]) - b[1],
    Math.abs(p[2] - c[2]) - b[2],
  ];
  const out = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  return out + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

/** A gable roof: a triangular prism running along z. */
function sdGable(p: V3, c: V3, half: number, hgt: number, depth: number): number {
  const x = Math.abs(p[0] - c[0]);
  const y = p[1] - c[1];
  const z = Math.abs(p[2] - c[2]) - depth;
  // Distance to the sloping face, in the x-y section.
  const k = normalize([hgt, half, 0]);
  const face = k[0] * x + k[1] * y - k[0] * half;
  const base = -y;
  const d2 = Math.max(face, base);
  return len([Math.max(d2, 0), Math.max(z, 0), 0]) + Math.min(Math.max(d2, z), 0);
}

/** Vertical cylinder. */
function sdCyl(p: V3, c: V3, r: number, h: number): number {
  const d = len([p[0] - c[0], 0, p[2] - c[2]]) - r;
  const y = Math.abs(p[1] - c[1]) - h;
  return len([Math.max(d, 0), Math.max(y, 0), 0]) + Math.min(Math.max(d, y), 0);
}

/** Cone standing on its base, for tower roofs. */
function sdCone(p: V3, c: V3, r: number, h: number): number {
  const q = len([p[0] - c[0], 0, p[2] - c[2]]);
  const y = p[1] - c[1];
  const k = normalize([h, r, 0]);
  const side = k[0] * q + k[1] * y - k[0] * r;
  return Math.max(side, Math.max(-y, y - h));
}

/* ── Surface detail ─────────────────────────────────────────────
   Flat colour on a solid is the CGI-toy tell. Real buildings are made of
   units — courses of brick, laps of tile, boards, blocks — and it is the
   shadow line between those units that the eye reads as material. All of it
   is computed from the hit point in the building's own local space, so the
   pattern stays put on the wall no matter how the house is turned. */

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

const fract = (x: number) => x - Math.floor(x);

/** 0 inside a groove of width w at either end of the unit, 1 on its face. */
function seam(f: number, w: number): number {
  const e = Math.min(f, 1 - f);
  return Math.max(0, Math.min(1, e / w));
}

/**
 * Two tangent axes for a face, chosen by its dominant normal. This is what
 * lets one brick routine wrap a whole building: courses always run
 * horizontally and joints always run up the wall, on every face.
 */
function tangents(q: V3, n: V3): [number, number] {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [q[0], q[2]];
  if (ax >= az) return [q[2], q[1]];
  return [q[0], q[1]];
}

/** Courses of units, staggered row to row. Returns face shade and a unit id. */
function courses(
  q: V3,
  n: V3,
  unitW: number,
  unitH: number,
  mortar: number
): { shade: number; id: number } {
  const [u, v] = tangents(q, n);
  const row = Math.floor(v / unitH);
  const stagger = (row & 1) * unitW * 0.5;
  const col = Math.floor((u + stagger) / unitW);
  const shade = Math.min(seam(fract((u + stagger) / unitW), mortar), seam(fract(v / unitH), mortar));
  return { shade, id: hash2(col, row) };
}

/* ── Materials ──────────────────────────────────────────────────
   The id travels with the distance so the shader knows what it hit. */

const M_WALL = 0;
const M_ROOF = 1;
const M_TRIM = 2;
const M_GLASS = 3;
const M_DOOR = 4;
const M_STONE = 5;
const M_LEAF = 6;
const M_FRAME = 7;

type Hit = { d: number; m: number };
const closer = (a: Hit, b: Hit): Hit => (a.d < b.d ? a : b);

type Model = (p: V3) => Hit;

/**
 * A window as joinery rather than a coloured rectangle: glass set back behind
 * a surround, with a sill under it and glazing bars across it. The set-back is
 * what matters — a recess catches its own shadow, and that shadow is most of
 * what tells you a window is a hole in a wall.
 *
 * zFace is negative: the camera looks along +z, so the front is at -z.
 */
function windowRow(p: V3, y: number, zFace: number, xs: number[], w: number, h: number): Hit {
  const s = Math.sign(zFace) || -1;
  let out: Hit = { d: 1e9, m: M_GLASS };
  for (const x of xs) {
    // Glass, set back into the wall.
    out = closer(out, { d: sdBox(p, [x, y, zFace + s * -0.07], [w, h, 0.05]), m: M_GLASS });
    // Surround.
    const outer = sdBox(p, [x, y, zFace], [w + 0.1, h + 0.1, 0.05]);
    const inner = sdBox(p, [x, y, zFace], [w, h, 0.2]);
    out = closer(out, { d: Math.max(outer, -inner), m: M_FRAME });
    // Sill, proud of the wall so it throws a line of shade.
    out = closer(out, { d: sdBox(p, [x, y - h - 0.12, zFace + s * 0.03], [w + 0.16, 0.05, 0.09]), m: M_FRAME });
    // Glazing bars.
    out = closer(out, { d: sdBox(p, [x, y, zFace + s * -0.02], [0.025, h, 0.03]), m: M_FRAME });
    out = closer(out, { d: sdBox(p, [x, y, zFace + s * -0.02], [w, 0.025, 0.03]), m: M_FRAME });
  }
  return out;
}

/** A plank door with a frame, a threshold and a handle. */
function doorway(p: V3, x: number, zFace: number, w: number, h: number): Hit {
  const s = Math.sign(zFace) || -1;
  let out: Hit = { d: sdBox(p, [x, h, zFace + s * -0.06], [w, h, 0.05]), m: M_DOOR };
  const outer = sdBox(p, [x, h, zFace], [w + 0.12, h + 0.12, 0.05]);
  const inner = sdBox(p, [x, h, zFace], [w, h, 0.2]);
  out = closer(out, { d: Math.max(outer, -inner), m: M_FRAME });
  out = closer(out, { d: sdBox(p, [x, 0.06, zFace + s * 0.12], [w + 0.24, 0.06, 0.2]), m: M_STONE });
  out = closer(out, { d: sdCyl(p, [x + w * 0.62, h * 0.92, zFace + s * -0.02], 0.045, 0.03), m: M_FRAME });
  return out;
}

const MODELS: Record<string, Model> = {
  /* A cottage: rendered walls, a tiled gable with real eaves, a porch, a
     chimney with a cap, shutters and a window box. */
  cottage: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.25, 0], [2.5, 1.25, 2.0]), m: M_WALL };
    // Plinth and a sill course, which is what stops a box reading as a box.
    h = closer(h, { d: sdBox(p, [0, 0.12, 0], [2.62, 0.12, 2.12]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [0, 2.46, 0], [2.58, 0.07, 2.08]), m: M_FRAME });
    // Roof, plus a fascia board under it so the eaves have thickness.
    h = closer(h, { d: sdGable(p, [0, 2.5, 0], 2.78, 2.0, 2.24), m: M_ROOF });
    for (const x of [-2.74, 2.74]) {
      h = closer(h, { d: sdBox(p, [x, 2.46, 0], [0.09, 0.11, 2.26]), m: M_FRAME });
    }
    // Ridge cap.
    h = closer(h, { d: sdBox(p, [0, 4.42, 0], [0.1, 0.09, 2.26]), m: M_ROOF });
    // Chimney with a corbelled cap.
    h = closer(h, { d: sdBox(p, [1.55, 4.0, 0.5], [0.32, 1.0, 0.32]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [1.55, 5.02, 0.5], [0.42, 0.1, 0.42]), m: M_STONE });
    // Porch: two posts and a small pitched hood over the door.
    for (const x of [-0.78, 0.78]) {
      h = closer(h, { d: sdCyl(p, [x, 1.03, -2.62], 0.07, 1.03), m: M_FRAME });
    }
    h = closer(h, { d: sdGable(p, [0, 2.06, -2.42], 0.95, 0.36, 0.5), m: M_ROOF });
    h = closer(h, doorway(p, 0, -2.02, 0.5, 0.95));
    h = closer(h, windowRow(p, 1.55, -2.02, [-1.55, 1.55], 0.42, 0.42));
    h = closer(h, windowRow(p, 3.05, -2.02, [0], 0.34, 0.34));
    h = closer(h, windowRow(p, 1.55, 2.02, [-1.3, 1.3], 0.42, 0.42));
    // Shutters either side of the ground-floor windows.
    for (const x of [-1.55, 1.55]) {
      for (const s of [-1, 1]) {
        h = closer(h, { d: sdBox(p, [x + s * 0.58, 1.55, -2.03], [0.13, 0.44, 0.04]), m: M_FRAME });
      }
    }
    // Window box under the left window.
    h = closer(h, { d: sdBox(p, [-1.55, 1.02, -2.14], [0.5, 0.11, 0.14]), m: M_FRAME });
    h = closer(h, { d: sdBox(p, [-1.55, 1.16, -2.14], [0.46, 0.09, 0.11]), m: M_LEAF });
    return h;
  },

  /* A treehouse: a tapered trunk, a planked cabin on a bracketed deck, a
     railing, a ladder and three crowns of leaves. */
  treehouse: (p) => {
    let h: Hit = { d: sdCyl(p, [0, 1.6, 0], 0.78 - p[1] * 0.07, 1.6), m: M_TRIM };
    // Deck, with brackets under it.
    h = closer(h, { d: sdBox(p, [0, 2.42, 0], [2.3, 0.12, 2.0]), m: M_TRIM });
    for (const x of [-1.7, 1.7]) {
      for (const z of [-1.4, 1.4]) {
        h = closer(h, { d: sdCyl(p, [x, 1.9, z], 0.09, 0.55), m: M_TRIM });
      }
    }
    // Railing around the front of the deck.
    h = closer(h, { d: sdBox(p, [0, 2.9, -1.95], [2.28, 0.06, 0.06]), m: M_FRAME });
    for (let i = -4; i <= 4; i++) {
      h = closer(h, { d: sdBox(p, [i * 0.5, 2.7, -1.95], [0.035, 0.24, 0.035]), m: M_FRAME });
    }
    h = closer(h, { d: sdBox(p, [0, 3.5, 0.1], [1.9, 1.05, 1.5]), m: M_WALL });
    h = closer(h, { d: sdGable(p, [0, 4.55, 0.1], 2.16, 1.2, 1.7), m: M_ROOF });
    for (const x of [-2.12, 2.12]) {
      h = closer(h, { d: sdBox(p, [x, 4.51, 0.1], [0.08, 0.1, 1.72]), m: M_FRAME });
    }
    h = closer(h, doorway(p, 0, -1.42, 0.42, 0.72));
    h = closer(h, windowRow(p, 3.85, -1.42, [-1.2, 1.2], 0.3, 0.28));
    // Ladder up to the deck.
    for (let i = 0; i < 5; i++) {
      h = closer(h, { d: sdBox(p, [0, 0.42 + i * 0.44, -1.05], [0.34, 0.045, 0.045]), m: M_FRAME });
    }
    for (const x of [-0.34, 0.34]) {
      h = closer(h, { d: sdBox(p, [x, 1.35, -1.05], [0.05, 1.25, 0.05]), m: M_FRAME });
    }
    h = closer(h, { d: sdCyl(p, [-1.5, 5.6, -0.4], 1.5, 0.9), m: M_LEAF });
    h = closer(h, { d: sdCyl(p, [1.6, 5.9, 0.2], 1.7, 1.0), m: M_LEAF });
    h = closer(h, { d: sdCyl(p, [0.1, 6.6, -0.2], 1.9, 0.95), m: M_LEAF });
    return h;
  },

  /* A city loft: brick, a stone cornice, tall windows and a roof rail. */
  loft: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.9, 0], [2.4, 1.9, 1.8]), m: M_WALL };
    h = closer(h, { d: sdBox(p, [0, 0.1, 0], [2.5, 0.1, 1.9]), m: M_STONE });
    // Cornice, in two steps so it reads as masonry rather than a lid.
    h = closer(h, { d: sdBox(p, [0, 3.9, 0], [2.52, 0.12, 1.92]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [0, 4.06, 0], [2.62, 0.1, 2.02]), m: M_STONE });
    // Band between the storeys.
    h = closer(h, { d: sdBox(p, [0, 2.02, 0], [2.46, 0.09, 1.86]), m: M_STONE });
    h = closer(h, windowRow(p, 1.1, -1.82, [-1.5, 0, 1.5], 0.44, 0.56));
    h = closer(h, windowRow(p, 2.95, -1.82, [-1.5, 0, 1.5], 0.44, 0.56));
    h = closer(h, windowRow(p, 2.95, 1.82, [-1.2, 1.2], 0.44, 0.56));
    h = closer(h, doorway(p, -1.5, -1.82, 0.42, 0.9));
    // Roof rail.
    h = closer(h, { d: sdBox(p, [0, 4.66, -1.9], [2.5, 0.05, 0.05]), m: M_FRAME });
    for (let i = -4; i <= 4; i++) {
      h = closer(h, { d: sdBox(p, [i * 0.58, 4.4, -1.9], [0.03, 0.3, 0.03]), m: M_FRAME });
    }
    return h;
  },

  /* A beach hut: stilts, a decked veranda with a rail, planked walls and a
     deep thatched pitch. */
  beach: (p) => {
    let h: Hit = { d: 1e9, m: M_TRIM };
    for (const x of [-1.75, 1.75]) {
      for (const z of [-1.45, 1.45]) {
        h = closer(h, { d: sdCyl(p, [x, 0.62, z], 0.15, 0.62), m: M_TRIM });
        // Cross-brace, which is what stops stilts reading as chair legs.
        h = closer(h, { d: sdBox(p, [x, 0.5, z], [0.05, 0.05, 1.45]), m: M_FRAME });
      }
    }
    h = closer(h, { d: sdBox(p, [0, 1.28, 0], [2.05, 0.13, 1.65]), m: M_TRIM });
    h = closer(h, { d: sdBox(p, [0, 2.15, -0.2], [1.5, 0.75, 1.15]), m: M_WALL });
    h = closer(h, { d: sdGable(p, [0, 2.88, -0.2], 2.16, 1.55, 1.68), m: M_ROOF });
    h = closer(h, doorway(p, 0, -1.36, 0.4, 0.65));
    h = closer(h, windowRow(p, 2.3, -1.36, [-1.02, 1.02], 0.26, 0.24));
    // Veranda rail along the front.
    h = closer(h, { d: sdBox(p, [0, 1.86, -1.6], [2.04, 0.05, 0.05]), m: M_FRAME });
    for (let i = -3; i <= 3; i++) {
      h = closer(h, { d: sdBox(p, [i * 0.62, 1.62, -1.6], [0.035, 0.24, 0.035]), m: M_FRAME });
    }
    // Steps down to the sand.
    for (let i = 0; i < 3; i++) {
      h = closer(h, { d: sdBox(p, [0, 1.05 - i * 0.32, -1.9 - i * 0.26], [0.44, 0.06, 0.16]), m: M_FRAME });
    }
    return h;
  },

  /* A castle: a keep on a battered plinth, four towers with conical caps,
     crenellations, arrow slits and a barred gate. */
  castle: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.9, 0], [2.2, 1.9, 1.7]), m: M_STONE };
    // Battered base, wider at the foot the way a real curtain wall is.
    h = closer(h, { d: sdBox(p, [0, 0.34, 0], [2.44, 0.34, 1.94]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [0, 3.95, 0], [2.36, 0.22, 1.86]), m: M_STONE });
    for (const x of [-2.5, 2.5]) {
      h = closer(h, { d: sdCyl(p, [x, 2.5, 0], 0.85, 2.5), m: M_STONE });
      h = closer(h, { d: sdCyl(p, [x, 5.02, 0], 0.96, 0.16), m: M_STONE });
      h = closer(h, { d: sdCone(p, [x, 5.18, 0], 1.0, 1.7), m: M_ROOF });
      // Crenellations round each tower.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        h = closer(h, {
          d: sdBox(p, [x + Math.cos(a) * 0.82, 5.06, Math.sin(a) * 0.82], [0.16, 0.2, 0.16]),
          m: M_STONE,
        });
      }
    }
    h = closer(h, { d: sdCyl(p, [0, 3.4, -0.9], 0.95, 3.4), m: M_STONE });
    h = closer(h, { d: sdCyl(p, [0, 6.92, -0.9], 1.06, 0.16), m: M_STONE });
    h = closer(h, { d: sdCone(p, [0, 7.08, -0.9], 1.1, 2.0), m: M_ROOF });
    for (const x of [-1.7, -0.85, 0, 0.85, 1.7]) {
      h = closer(h, { d: sdBox(p, [x, 4.35, 0], [0.3, 0.3, 1.82]), m: M_STONE });
    }
    // Gate: an arch-headed opening with bars across it.
    h = closer(h, doorway(p, 0, -1.72, 0.6, 1.05));
    for (let i = -2; i <= 2; i++) {
      h = closer(h, { d: sdBox(p, [i * 0.24, 1.05, -1.78], [0.028, 1.02, 0.03]), m: M_FRAME });
    }
    // Arrow slits.
    h = closer(h, windowRow(p, 2.9, -1.72, [-1.2, 1.2], 0.09, 0.3));
    for (const x of [-2.5, 2.5]) {
      h = closer(h, windowRow(p, 3.4, -0.86 + x * 0.0, [x], 0.08, 0.26));
    }
    return h;
  },
};

/* ── Palettes ───────────────────────────────────────────────────
   Kept close to the sprite each one replaces, so a red-roofed cottage stays
   a red-roofed cottage and the shop art still matches the yard. */

type WallStyle = "render" | "brick" | "plank";
type Palette = { sun: V3; sky: V3; wall: WallStyle; cols: Record<number, V3> };

const PALETTES: Record<string, Palette> = {
  cottage: {
    sun: normalize([-0.55, 0.74, -0.38]),
    sky: [150, 186, 214],
    wall: "render",
    cols: {
      [M_WALL]: [238, 226, 198],
      [M_ROOF]: [188, 62, 52],
      [M_TRIM]: [140, 96, 58],
      [M_GLASS]: [128, 186, 208],
      [M_DOOR]: [124, 78, 44],
      [M_STONE]: [206, 192, 168],
      [M_LEAF]: [92, 148, 70],
      [M_FRAME]: [250, 246, 238],
    },
  },
  treehouse: {
    sun: normalize([-0.62, 0.68, -0.4]),
    sky: [140, 180, 190],
    wall: "plank",
    cols: {
      [M_WALL]: [168, 122, 78],
      [M_ROOF]: [126, 88, 54],
      [M_TRIM]: [104, 74, 46],
      [M_GLASS]: [150, 198, 206],
      [M_DOOR]: [88, 60, 36],
      [M_STONE]: [150, 140, 124],
      [M_LEAF]: [74, 130, 62],
      [M_FRAME]: [196, 168, 130],
    },
  },
  loft: {
    sun: normalize([-0.82, 0.36, -0.44]),
    sky: [206, 176, 146],
    wall: "brick",
    cols: {
      [M_WALL]: [166, 96, 74],
      [M_ROOF]: [96, 92, 90],
      [M_TRIM]: [120, 112, 106],
      [M_GLASS]: [96, 130, 152],
      [M_DOOR]: [64, 74, 84],
      [M_STONE]: [176, 170, 162],
      [M_LEAF]: [92, 138, 72],
      [M_FRAME]: [86, 92, 100],
    },
  },
  beach: {
    sun: normalize([-0.5, 0.72, -0.48]),
    sky: [166, 208, 224],
    wall: "plank",
    cols: {
      [M_WALL]: [214, 176, 116],
      [M_ROOF]: [206, 178, 112],
      [M_TRIM]: [156, 116, 72],
      [M_GLASS]: [96, 172, 176],
      [M_DOOR]: [72, 132, 132],
      [M_STONE]: [198, 182, 154],
      [M_LEAF]: [82, 146, 76],
      [M_FRAME]: [240, 232, 210],
    },
  },
  castle: {
    sun: normalize([-0.78, 0.3, -0.34]),
    sky: [150, 124, 158],
    wall: "brick",
    cols: {
      [M_WALL]: [142, 122, 166],
      [M_ROOF]: [104, 74, 142],
      [M_TRIM]: [96, 84, 112],
      [M_GLASS]: [238, 196, 108],
      [M_DOOR]: [76, 60, 92],
      [M_STONE]: [156, 138, 178],
      [M_LEAF]: [92, 118, 78],
      [M_FRAME]: [92, 78, 112],
    },
  },
};

/**
 * Surface detail per material.
 *
 * Returns the albedo after texture, plus a shade factor for the grooves
 * between units. The shade is deliberately separate: a mortar joint is not a
 * darker brick, it is a brick with a shadow in front of it, and multiplying
 * after the lighting is what makes it behave that way.
 */
function surface(mat: number, q: V3, n: V3, pal: Palette): { col: V3; shade: number } {
  const base = pal.cols[mat] ?? pal.cols[M_WALL];
  let col: V3 = [base[0], base[1], base[2]];
  let shade = 1;

  if (mat === M_ROOF) {
    // Tile courses. Laps run along the eaves, so the course line is in the
    // slope direction and the joints run down it.
    const c = courses(q, n, 0.3, 0.17, 0.1);
    shade = 0.66 + c.shade * 0.34;
    const v = 0.88 + c.id * 0.24;
    col = [col[0] * v, col[1] * v, col[2] * v];
  } else if (mat === M_WALL) {
    const [u, w] = tangents(q, n);
    if (pal.wall === "brick") {
      const c = courses(q, n, 0.62, 0.2, 0.09);
      shade = 0.72 + c.shade * 0.28;
      const v = 0.88 + c.id * 0.24;
      col = [col[0] * v, col[1] * v, col[2] * v];
    } else if (pal.wall === "plank") {
      const board = seam(fract(w / 0.3), 0.07);
      shade = 0.8 + board * 0.2;
      const grain = 0.93 + noise2(u * 3.5, w * 30) * 0.14;
      col = [col[0] * grain, col[1] * grain, col[2] * grain];
    } else {
      // Render: no units at all, just the float texture of the trowel.
      const g = 0.95 + noise2(u * 14, w * 14) * 0.1;
      shade = 0.97 + noise2(u * 42, w * 42) * 0.06;
      col = [col[0] * g, col[1] * g, col[2] * g];
    }
  } else if (mat === M_STONE) {
    const c = courses(q, n, 0.78, 0.34, 0.08);
    shade = 0.7 + c.shade * 0.3;
    const v = 0.86 + c.id * 0.28;
    col = [col[0] * v, col[1] * v, col[2] * v];
  } else if (mat === M_TRIM || mat === M_DOOR) {
    // Boards: one long axis, so no stagger.
    const [u, w] = tangents(q, n);
    const board = seam(fract(w / 0.24), 0.09);
    shade = 0.78 + board * 0.22;
    const grain = 0.92 + noise2(u * 3, w * 26) * 0.16;
    col = [col[0] * grain, col[1] * grain, col[2] * grain];
  } else if (mat === M_LEAF) {
    const [u, w] = tangents(q, n);
    const clump = noise2(u * 5.5, w * 5.5);
    const fine = noise2(u * 17, w * 17);
    shade = 0.62 + clump * 0.46;
    const v = 0.82 + fine * 0.3;
    col = [col[0] * v, col[1] * v * 1.04, col[2] * v];
  }
  return { col, shade };
}

/** Soft shadow by marching toward the sun through the model itself. */
function shadow(p: V3, sun: V3, model: Model): number {
  let s = 1;
  let t = 0.06;
  for (let i = 0; i < 26 && t < 9; i++) {
    const d = model([p[0] + sun[0] * t, p[1] + sun[1] * t, p[2] + sun[2] * t]).d;
    if (d < 0.002) return 0.0;
    s = Math.min(s, (12 * d) / t);
    t += Math.max(d, 0.035);
  }
  return Math.max(0, Math.min(1, s));
}

/** Ambient occlusion, so eaves and recesses gather shade. */
function occlusion(p: V3, n: V3, model: Model): number {
  let occ = 0;
  let w = 1;
  for (let i = 1; i <= 5; i++) {
    const h = i * 0.055;
    const d = model([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]).d;
    occ += (h - d) * w;
    w *= 0.72;
  }
  return Math.max(0, Math.min(1, 1 - occ * 1.5));
}

function normalAt(p: V3, model: Model): V3 {
  const e = 0.0025;
  return normalize([
    model([p[0] + e, p[1], p[2]]).d - model([p[0] - e, p[1], p[2]]).d,
    model([p[0], p[1] + e, p[2]]).d - model([p[0], p[1] - e, p[2]]).d,
    model([p[0], p[1], p[2] + e]).d - model([p[0], p[1], p[2] - e]).d,
  ]);
}

function render(id: string): Buffer {
  const model = MODELS[id];
  const pal = PALETTES[id];
  const w = W * SS;
  const h = H * SS;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const horizonY = HORIZON * h;

  // Turn the building a few degrees off square. A facade dead-on to the
  // camera is the single most model-like thing a render can do.
  const yaw = 0.4;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const posed: Model = (p) => {
    const lx = (p[0] - 0) * cy - (p[2] - PAD_Z) * sy;
    const lz = (p[0] - 0) * sy + (p[2] - PAD_Z) * cy;
    return model([lx, p[1], lz]);
  };

  for (let py = 0; py < h; py++) {
    // Exactly the yard's projection, inverted: a pixel row maps to a fixed
    // ratio of (eye height - world y) over depth.
    const dirY = (py - horizonY) / (h * PITCH_SCALE);
    for (let px = 0; px < w; px++) {
      const dirX = (px / w - 0.5) * 2 * FOV;

      let z = PAD_Z - 9;
      let hit = false;
      let p: V3 = [0, 0, 0];
      let mat = 0;
      for (let i = 0; i < 90; i++) {
        p = [dirX * z, CAM_Y - dirY * z, z];
        const s = posed(p);
        if (s.d < 0.004) {
          hit = true;
          mat = s.m;
          break;
        }
        // Step along the ray, not along z, so the march stays conservative.
        z += Math.max(s.d * 0.75, 0.01);
        if (z > PAD_Z + 12) break;
      }
      if (!hit) continue;

      const n = normalAt(p, posed);
      const diffuse = Math.max(0, dot(n, pal.sun));
      const sh = shadow(p, pal.sun, posed);
      const ao = occlusion(p, n, posed);
      // Sky light comes from above, which is what fills the shaded walls.
      const skyAmt = (0.5 + 0.5 * n[1]) * 0.5 * ao;

      // Texture is applied in the building's own frame, so courses stay put on
      // the wall however the house is turned to the camera.
      const q: V3 = [p[0] * cy - (p[2] - PAD_Z) * sy, p[1], p[0] * sy + (p[2] - PAD_Z) * cy];
      const nq: V3 = [n[0] * cy - n[2] * sy, n[1], n[0] * sy + n[2] * cy];
      const surf = surface(mat, q, nq, pal);

      const base = surf.col;
      const lit = (diffuse * sh * 0.78 + 0.27) * surf.shade;

      let r = base[0] * lit + pal.sky[0] * skyAmt * surf.shade;
      let g = base[1] * lit + pal.sky[1] * skyAmt * surf.shade;
      let b = base[2] * lit + pal.sky[2] * skyAmt * surf.shade;

      // Glass is dark where it is not catching the sky, and bright where it is.
      if (mat === M_GLASS) {
        const spec = Math.pow(Math.max(0, n[1] * 0.3 + 0.7 - Math.abs(n[2]) * 0.4), 6);
        r = r * 0.7 + 255 * spec * 0.5;
        g = g * 0.7 + 255 * spec * 0.5;
        b = b * 0.7 + 255 * spec * 0.5;
      }

      const i = (py * w + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/models";

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });

  const only = process.argv[2];
  for (const id of Object.keys(MODELS)) {
    if (only && id !== only) continue;
    const raw = render(id);
    const full = sharp(raw, { raw: { width: W * SS, height: H * SS, channels: 4 } }).resize(W, H);

    // Full frame, for the yard. It shares the yard's camera exactly, so
    // compositing is a straight overlay with no placement maths.
    const out = await full.clone().webp({ quality: 90, alphaQuality: 95, effort: 6 }).toBuffer();
    const file = `${OUT}/${id}.webp`;
    writeFileSync(join(root, file), out);
    console.log(`  ${file}  ${W}x${H}  ${(out.length / 1024).toFixed(0)} KB`);

    // The same building trimmed to its own bounds, for the shop cards — so
    // the house you buy is the house you get rather than a different drawing.
    const card = await full
      .clone()
      .trim({ threshold: 1 })
      .resize({ width: 640, height: 640, fit: "inside" })
      .webp({ quality: 92, alphaQuality: 95, effort: 6 })
      .toBuffer();
    const cardFile = `${OUT}/${id}-card.webp`;
    writeFileSync(join(root, cardFile), card);
    console.log(`  ${cardFile}  ${(card.length / 1024).toFixed(0)} KB`);
  }
}

main();
