/**
 * Renders the inside of each house as a 360-degree panorama.
 *
 *   npm run interiors
 *
 * The interior was a flat room seen side-on with furniture pasted onto it. To
 * make it something you can look around, each house gets one cylindrical
 * panorama rendered from standing height in the middle of the room: a full
 * turn of azimuth across the width, a slice of elevation down the height.
 *
 * A panorama rather than a turntable, because the two problems are different
 * shapes. Outside you walk around one object, so the camera orbits it. Inside
 * you stand in one place and turn your head, so the camera stays put and the
 * ray direction sweeps. One render covers every heading, which is why this is
 * five images rather than five times twelve.
 *
 * Furniture is not baked in. It is placed by the student, so it is projected
 * onto the panorama in the browser from its world position — the same trick
 * the yard ornaments use, and the reason both had to be stored in world
 * coordinates rather than screen ones.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/* The room, in metres. Shared with src/lib/room-camera.ts — keep in step. */
export const ROOM_W = 7.2;
export const ROOM_D = 5.6;
export const ROOM_H = 2.9;
/** Eye height of someone standing in the middle. */
export const EYE_Y = 1.62;
/** Vertical half-angle captured, in radians. */
export const V_HALF = 0.62;

const OUT_W = 2560;
const OUT_H = 720;
const SS = 2;

type V3 = [number, number, number];

const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normalize(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

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
const seam = (f: number, w: number) => Math.max(0, Math.min(1, Math.min(f, 1 - f) / w));

const M_FLOOR = 0;
const M_WALL = 1;
const M_CEIL = 2;
const M_TRIM = 3;
const M_GLASS = 4;
const M_DOOR = 5;

type Hit = { d: number; m: number };
const closer = (a: Hit, b: Hit): Hit => (a.d < b.d ? a : b);

function sdBox(p: V3, c: V3, b: V3): number {
  const q: V3 = [
    Math.abs(p[0] - c[0]) - b[0],
    Math.abs(p[1] - c[1]) - b[1],
    Math.abs(p[2] - c[2]) - b[2],
  ];
  const out = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  return out + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

/**
 * The room as a hollow shell.
 *
 * Built by subtracting the inside from a slightly larger solid, so the walls
 * have real thickness and the window and door openings are holes cut through
 * them rather than panels stuck on. That matters here more than it does
 * outside: standing in the middle you see the reveals of every opening, and a
 * zero-thickness wall gives itself away immediately.
 */
function room(p: V3): Hit {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;

  const outer = sdBox(p, [0, ROOM_H / 2, 0], [hw + 0.2, ROOM_H / 2 + 0.2, hd + 0.2]);
  const inner = sdBox(p, [0, ROOM_H / 2, 0], [hw, ROOM_H / 2, hd]);
  const shell = Math.max(outer, -inner);

  // Two windows in the far wall and one in the left, plus a doorway.
  let holes = 1e9;
  for (const x of [-1.9, 1.9]) {
    holes = Math.min(holes, sdBox(p, [x, 1.55, -hd], [0.62, 0.58, 0.6]));
  }
  holes = Math.min(holes, sdBox(p, [-hw, 1.55, 1.1], [0.6, 0.58, 0.62]));
  holes = Math.min(holes, sdBox(p, [0.4, 1.05, hd], [0.5, 1.05, 0.6]));

  let h: Hit = { d: Math.max(shell, -holes), m: M_WALL };

  // Floor and ceiling are their own materials, so they can be boarded and
  // plastered rather than sharing the walls' surface.
  const floor = sdBox(p, [0, -0.1, 0], [hw + 0.2, 0.1, hd + 0.2]);
  h = closer(h, { d: floor, m: M_FLOOR });
  const ceil = sdBox(p, [0, ROOM_H + 0.1, 0], [hw + 0.2, 0.1, hd + 0.2]);
  h = closer(h, { d: ceil, m: M_CEIL });

  // Skirting, which is most of what makes a room read as a room.
  const skirt = Math.max(
    sdBox(p, [0, 0.09, 0], [hw + 0.02, 0.09, hd + 0.02]),
    -sdBox(p, [0, 0.09, 0], [hw - 0.06, 0.2, hd - 0.06])
  );
  h = closer(h, { d: skirt, m: M_TRIM });

  // Glazing set into the openings, with bars.
  for (const x of [-1.9, 1.9]) {
    h = closer(h, { d: sdBox(p, [x, 1.55, -hd - 0.02], [0.6, 0.56, 0.03]), m: M_GLASS });
    h = closer(h, { d: sdBox(p, [x, 1.55, -hd - 0.06], [0.03, 0.56, 0.05]), m: M_TRIM });
    h = closer(h, { d: sdBox(p, [x, 1.55, -hd - 0.06], [0.6, 0.03, 0.05]), m: M_TRIM });
    // Reveal lining.
    const lining = Math.max(
      sdBox(p, [x, 1.55, -hd], [0.7, 0.66, 0.2]),
      -sdBox(p, [x, 1.55, -hd], [0.6, 0.56, 0.4])
    );
    h = closer(h, { d: lining, m: M_TRIM });
  }
  h = closer(h, { d: sdBox(p, [-hw - 0.02, 1.55, 1.1], [0.03, 0.56, 0.6]), m: M_GLASS });

  // The door, standing in its opening.
  h = closer(h, { d: sdBox(p, [0.4, 1.02, hd + 0.02], [0.48, 1.02, 0.04]), m: M_DOOR });
  const casing = Math.max(
    sdBox(p, [0.4, 1.06, hd], [0.6, 1.14, 0.16]),
    -sdBox(p, [0.4, 1.02, hd], [0.5, 1.05, 0.4])
  );
  h = closer(h, { d: casing, m: M_TRIM });

  return h;
}

function normalAt(p: V3): V3 {
  const e = 0.002;
  return normalize([
    room([p[0] + e, p[1], p[2]]).d - room([p[0] - e, p[1], p[2]]).d,
    room([p[0], p[1] + e, p[2]]).d - room([p[0], p[1] - e, p[2]]).d,
    room([p[0], p[1], p[2] + e]).d - room([p[0], p[1], p[2] - e]).d,
  ]);
}

type Palette = {
  floor: [V3, V3];
  wall: V3;
  ceil: V3;
  trim: V3;
  door: V3;
  /** Colour and strength of the light coming in through the glass. */
  day: V3;
};

const PALETTES: Record<string, Palette> = {
  cottage: {
    floor: [[168, 116, 70], [196, 146, 96]],
    wall: [238, 230, 214],
    ceil: [246, 243, 236],
    trim: [250, 248, 242],
    door: [140, 92, 54],
    day: [255, 244, 214],
  },
  treehouse: {
    floor: [[136, 96, 58], [166, 124, 78]],
    wall: [196, 162, 116],
    ceil: [210, 182, 142],
    trim: [232, 214, 184],
    door: [110, 76, 46],
    day: [226, 246, 226],
  },
  loft: {
    floor: [[122, 118, 116], [152, 148, 144]],
    wall: [188, 132, 108],
    ceil: [228, 226, 222],
    trim: [86, 92, 100],
    door: [70, 78, 88],
    day: [255, 226, 186],
  },
  beach: {
    floor: [[204, 174, 124], [226, 200, 152]],
    wall: [238, 232, 214],
    ceil: [246, 244, 236],
    trim: [244, 246, 242],
    door: [96, 156, 152],
    day: [226, 246, 255],
  },
  castle: {
    floor: [[124, 116, 132], [150, 142, 158]],
    wall: [166, 152, 182],
    ceil: [140, 130, 156],
    trim: [104, 92, 124],
    door: [82, 66, 98],
    day: [255, 216, 168],
  },
};

/** Sun coming in through the far windows, low and warm. */
const SUN = normalize([-0.35, 0.42, -0.84]);

/** Surface colour after texture, plus a shade factor for grooves. */
function surface(mat: number, p: V3, n: V3, pal: Palette): { col: V3; shade: number } {
  if (mat === M_FLOOR) {
    // Boards running the length of the room, with an end joint every so often.
    const board = seam(fract(p[0] / 0.22), 0.05);
    const plank = Math.floor(p[0] / 0.22);
    const endJoint = seam(fract((p[2] + plank * 0.7) / 1.6), 0.02);
    const v = hash2(plank, Math.floor((p[2] + plank * 0.7) / 1.6));
    const c: V3 = [
      pal.floor[0][0] + (pal.floor[1][0] - pal.floor[0][0]) * v,
      pal.floor[0][1] + (pal.floor[1][1] - pal.floor[0][1]) * v,
      pal.floor[0][2] + (pal.floor[1][2] - pal.floor[0][2]) * v,
    ];
    const grain = 0.94 + noise2(p[0] * 30, p[2] * 3) * 0.12;
    return { col: [c[0] * grain, c[1] * grain, c[2] * grain], shade: 0.8 + Math.min(board, endJoint) * 0.2 };
  }
  if (mat === M_WALL) {
    const g = 0.96 + noise2(p[0] * 9 + p[1] * 3, p[2] * 9) * 0.08;
    return { col: [pal.wall[0] * g, pal.wall[1] * g, pal.wall[2] * g], shade: 1 };
  }
  if (mat === M_CEIL) return { col: pal.ceil, shade: 1 };
  if (mat === M_TRIM) return { col: pal.trim, shade: 1 };
  if (mat === M_DOOR) {
    const panel = seam(fract(p[1] / 0.62), 0.06);
    return { col: pal.door, shade: 0.86 + panel * 0.14 };
  }
  return { col: pal.day, shade: 1 };
}

function render(id: string): Buffer {
  const pal = PALETTES[id];
  const w = OUT_W * SS;
  const h = OUT_H * SS;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const eye: V3 = [0, EYE_Y, 0];

  for (let py = 0; py < h; py++) {
    const el = (0.5 - py / h) * 2 * V_HALF;
    const ce = Math.cos(el);
    const se = Math.sin(el);
    for (let px = 0; px < w; px++) {
      // A full turn across the width, so every heading is in one image.
      const az = (px / w) * Math.PI * 2;
      const dir: V3 = [Math.sin(az) * ce, se, Math.cos(az) * ce];

      let t = 0.05;
      let hit: Hit | null = null;
      let p: V3 = eye;
      for (let i = 0; i < 90; i++) {
        p = [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
        const s = room(p);
        if (s.d < 0.002) {
          hit = s;
          break;
        }
        t += Math.max(s.d * 0.85, 0.004);
        if (t > 24) break;
      }
      if (!hit) continue;

      const n = normalAt(p);
      const surf = surface(hit.m, p, n, pal);

      // Glass is a light source rather than a surface: the panorama has no
      // world outside it, so daylight has to come from the openings.
      let lit: number;
      if (hit.m === M_GLASS) {
        lit = 1.35;
      } else {
        const direct = Math.max(0, dot(n, SUN));
        // Bounce: brighter nearer the windowed wall, and the floor catches
        // more of it than the ceiling does.
        const toward = Math.max(0, (-p[2] + ROOM_D / 2) / ROOM_D);
        const up = Math.max(0, n[1]);
        const ambient = 0.42 + toward * 0.3 + up * 0.12;
        // Corners gather shade, which is most of what gives a room its volume.
        const corner =
          Math.min(1, (ROOM_W / 2 - Math.abs(p[0])) / 0.9) *
          Math.min(1, (ROOM_D / 2 - Math.abs(p[2])) / 0.9);
        const ao = 0.72 + 0.28 * Math.max(0, Math.min(1, corner));
        lit = (direct * 0.55 + ambient) * ao * surf.shade;
      }

      const i = (py * w + px) * 4;
      rgba[i] = surf.col[0] * lit + pal.day[0] * 0.05;
      rgba[i + 1] = surf.col[1] * lit + pal.day[1] * 0.05;
      rgba[i + 2] = surf.col[2] * lit + pal.day[2] * 0.05;
      rgba[i + 3] = 255;
    }
  }
  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/interiors";

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });
  const only = process.argv[2];
  for (const id of Object.keys(PALETTES)) {
    if (only && id !== only) continue;
    const raw = render(id);
    const out = await sharp(raw, { raw: { width: OUT_W * SS, height: OUT_H * SS, channels: 4 } })
      .resize(OUT_W, OUT_H)
      .webp({ quality: 84, effort: 5 })
      .toBuffer();
    const file = `${OUT}/${id}.webp`;
    writeFileSync(join(root, file), out);
    console.log(`  ${file}  ${OUT_W}x${OUT_H}  ${(out.length / 1024).toFixed(0)} KB`);
  }
}

main();
