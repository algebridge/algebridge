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

/* ── Materials ──────────────────────────────────────────────────
   The id travels with the distance so the shader knows what it hit. */

const M_WALL = 0;
const M_ROOF = 1;
const M_TRIM = 2;
const M_GLASS = 3;
const M_DOOR = 4;
const M_STONE = 5;
const M_LEAF = 6;

type Hit = { d: number; m: number };
const closer = (a: Hit, b: Hit): Hit => (a.d < b.d ? a : b);

type Model = (p: V3) => Hit;

/** Rows of windows punched along a wall, as raised glass panels. */
/** zFace is negative: the camera looks along +z, so the front is at -z. */
function windowRow(p: V3, y: number, zFace: number, xs: number[], w: number, h: number): Hit {
  let d = 1e9;
  for (const x of xs) d = Math.min(d, sdBox(p, [x, y, zFace], [w, h, 0.06]));
  return { d, m: M_GLASS };
}

const MODELS: Record<string, Model> = {
  /* A cottage: walls, a steep gable, a chimney, a door and four windows. */
  cottage: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.25, 0], [2.5, 1.25, 2.0]), m: M_WALL };
    h = closer(h, { d: sdGable(p, [0, 2.5, 0], 2.75, 2.0, 2.2), m: M_ROOF });
    h = closer(h, { d: sdBox(p, [1.5, 4.0, 0.4], [0.32, 0.9, 0.32]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [0, 0.95, -2.02], [0.5, 0.95, 0.12]), m: M_DOOR });
    h = closer(h, windowRow(p, 1.5, -2.02, [-1.5, 1.5], 0.44, 0.44));
    h = closer(h, windowRow(p, 3.0, -2.02, [0], 0.36, 0.36));
    // Sill course, which is what stops a box reading as a box.
    h = closer(h, { d: sdBox(p, [0, 0.12, 0], [2.62, 0.12, 2.12]), m: M_STONE });
    return h;
  },

  /* A treehouse: trunk, canopy, and a cabin sitting in the fork. */
  treehouse: (p) => {
    let h: Hit = { d: sdCyl(p, [0, 1.6, 0], 0.72 - p[1] * 0.06, 1.6), m: M_TRIM };
    h = closer(h, { d: sdBox(p, [0, 3.5, 0], [1.9, 1.05, 1.6]), m: M_WALL });
    h = closer(h, { d: sdGable(p, [0, 4.55, 0], 2.1, 1.15, 1.75), m: M_ROOF });
    h = closer(h, { d: sdBox(p, [0, 2.42, 0], [2.3, 0.12, 2.0]), m: M_TRIM });
    h = closer(h, { d: sdBox(p, [0, 3.2, -1.62], [0.42, 0.72, 0.1]), m: M_DOOR });
    h = closer(h, windowRow(p, 3.7, -1.62, [-1.15, 1.15], 0.34, 0.32));
    // Canopy, as three overlapping crowns so it is not one sphere.
    h = closer(h, { d: sdCyl(p, [-1.5, 5.6, -0.4], 1.5, 0.9), m: M_LEAF });
    h = closer(h, { d: sdCyl(p, [1.6, 5.9, 0.2], 1.7, 1.0), m: M_LEAF });
    h = closer(h, { d: sdCyl(p, [0.1, 6.6, -0.2], 1.9, 0.95), m: M_LEAF });
    return h;
  },

  /* A city loft: two storeys of brick, big windows, a parapet. */
  loft: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.9, 0], [2.4, 1.9, 1.8]), m: M_WALL };
    h = closer(h, { d: sdBox(p, [0, 3.95, 0], [2.55, 0.16, 1.95]), m: M_STONE });
    h = closer(h, { d: sdBox(p, [0, 4.18, -1.86], [2.5, 0.3, 0.1]), m: M_STONE });
    h = closer(h, windowRow(p, 1.15, -1.82, [-1.5, 0, 1.5], 0.5, 0.62));
    h = closer(h, windowRow(p, 2.85, -1.82, [-1.5, 0, 1.5], 0.5, 0.62));
    h = closer(h, { d: sdBox(p, [-1.9, 0.85, -1.84], [0.42, 0.85, 0.1]), m: M_DOOR });
    // Floor band between storeys.
    h = closer(h, { d: sdBox(p, [0, 2.0, 0], [2.48, 0.12, 1.88]), m: M_STONE });
    return h;
  },

  /* A beach hut: stilts, a deck, and a thatched pitch. */
  beach: (p) => {
    let h: Hit = { d: 1e9, m: M_TRIM };
    for (const x of [-1.7, 1.7]) {
      for (const z of [-1.3, 1.3]) {
        h = closer(h, { d: sdCyl(p, [x, 0.6, z], 0.16, 0.6), m: M_TRIM });
      }
    }
    h = closer(h, { d: sdBox(p, [0, 1.28, 0], [2.0, 0.14, 1.6]), m: M_TRIM });
    h = closer(h, { d: sdBox(p, [0, 2.15, -0.15], [1.55, 0.75, 1.2]), m: M_WALL });
    h = closer(h, { d: sdGable(p, [0, 2.9, -0.15], 2.1, 1.5, 1.6), m: M_ROOF });
    h = closer(h, { d: sdBox(p, [0, 2.05, -1.06], [0.4, 0.65, 0.08]), m: M_DOOR });
    h = closer(h, { d: sdBox(p, [0, 1.62, -1.55], [2.0, 0.08, 0.08]), m: M_TRIM });
    return h;
  },

  /* A castle: keep, four towers with conical caps, and a gate. */
  castle: (p) => {
    let h: Hit = { d: sdBox(p, [0, 1.9, 0], [2.2, 1.9, 1.7]), m: M_STONE };
    h = closer(h, { d: sdBox(p, [0, 3.95, 0], [2.35, 0.22, 1.85]), m: M_STONE });
    for (const x of [-2.5, 2.5]) {
      h = closer(h, { d: sdCyl(p, [x, 2.5, 0], 0.85, 2.5), m: M_STONE });
      h = closer(h, { d: sdCone(p, [x, 5.0, 0], 1.0, 1.7), m: M_ROOF });
    }
    h = closer(h, { d: sdCyl(p, [0, 3.4, -0.9], 0.95, 3.4), m: M_STONE });
    h = closer(h, { d: sdCone(p, [0, 6.8, -0.9], 1.1, 2.0), m: M_ROOF });
    // Battlements along the keep.
    for (const x of [-1.7, -0.85, 0, 0.85, 1.7]) {
      h = closer(h, { d: sdBox(p, [x, 4.35, 0], [0.3, 0.3, 1.8]), m: M_STONE });
    }
    h = closer(h, { d: sdBox(p, [0, 1.1, -1.72], [0.62, 1.1, 0.1]), m: M_DOOR });
    h = closer(h, windowRow(p, 2.9, -1.72, [-1.2, 1.2], 0.18, 0.34));
    return h;
  },
};

/* ── Palettes ───────────────────────────────────────────────────
   Kept close to the sprite each one replaces, so a red-roofed cottage stays
   a red-roofed cottage and the shop art still matches the yard. */

type Palette = { sun: V3; sky: V3; cols: Record<number, V3> };

const PALETTES: Record<string, Palette> = {
  cottage: {
    sun: normalize([-0.55, 0.74, -0.38]),
    sky: [150, 186, 214],
    cols: {
      [M_WALL]: [238, 226, 198],
      [M_ROOF]: [188, 62, 52],
      [M_TRIM]: [140, 96, 58],
      [M_GLASS]: [128, 186, 208],
      [M_DOOR]: [124, 78, 44],
      [M_STONE]: [206, 192, 168],
      [M_LEAF]: [92, 148, 70],
    },
  },
  treehouse: {
    sun: normalize([-0.62, 0.68, -0.4]),
    sky: [140, 180, 190],
    cols: {
      [M_WALL]: [168, 122, 78],
      [M_ROOF]: [126, 88, 54],
      [M_TRIM]: [104, 74, 46],
      [M_GLASS]: [150, 198, 206],
      [M_DOOR]: [88, 60, 36],
      [M_STONE]: [150, 140, 124],
      [M_LEAF]: [74, 130, 62],
    },
  },
  loft: {
    sun: normalize([-0.82, 0.36, -0.44]),
    sky: [206, 176, 146],
    cols: {
      [M_WALL]: [166, 96, 74],
      [M_ROOF]: [96, 92, 90],
      [M_TRIM]: [120, 112, 106],
      [M_GLASS]: [96, 130, 152],
      [M_DOOR]: [64, 74, 84],
      [M_STONE]: [176, 170, 162],
      [M_LEAF]: [92, 138, 72],
    },
  },
  beach: {
    sun: normalize([-0.5, 0.72, -0.48]),
    sky: [166, 208, 224],
    cols: {
      [M_WALL]: [214, 176, 116],
      [M_ROOF]: [206, 178, 112],
      [M_TRIM]: [156, 116, 72],
      [M_GLASS]: [96, 172, 176],
      [M_DOOR]: [72, 132, 132],
      [M_STONE]: [198, 182, 154],
      [M_LEAF]: [82, 146, 76],
    },
  },
  castle: {
    sun: normalize([-0.78, 0.3, -0.34]),
    sky: [150, 124, 158],
    cols: {
      [M_WALL]: [142, 122, 166],
      [M_ROOF]: [104, 74, 142],
      [M_TRIM]: [96, 84, 112],
      [M_GLASS]: [238, 196, 108],
      [M_DOOR]: [76, 60, 92],
      [M_STONE]: [156, 138, 178],
      [M_LEAF]: [92, 118, 78],
    },
  },
};

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

      const base = pal.cols[mat] ?? pal.cols[M_WALL];
      const lit = diffuse * sh * 0.78 + 0.27;

      let r = base[0] * lit + pal.sky[0] * skyAmt;
      let g = base[1] * lit + pal.sky[1] * skyAmt;
      let b = base[2] * lit + pal.sky[2] * skyAmt;

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
