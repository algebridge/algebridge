/**
 * Renders the yard critter as a run-cycle sprite sheet.
 *
 *   npm run critters
 *
 * The critter this replaces was a flat SVG rabbit: a few ellipses with a dark
 * outline. On drawn scenery that was fine. On rendered ground it was the one
 * thing left in the frame that was obviously a sticker, because everything
 * around it has form and it had none.
 *
 * So this builds the animal as a signed distance field — a body, a head, ears,
 * a muzzle, a tail and four legs, all capsules and ellipsoids — and sphere-
 * traces it per pixel. That gives real curvature, a normal at every point, and
 * therefore shading that agrees with the sun the terrain was lit by. Legs
 * swing and the body bounds through a hop; the whole cycle loops in eight
 * frames.
 *
 * Rendered at 3x and downsampled, so edges are anti-aliased by the resample.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const FRAMES = 8;
const CELL = 96;
const SS = 3;

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Distance to a sphere, squashed independently on each axis. */
function sdEllipsoid(p: V3, c: V3, r: V3): number {
  const q: V3 = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  const k = len(q);
  return (k - 1) * Math.min(r[0], Math.min(r[1], r[2]));
}

/** Distance to a capsule between a and b. Legs, ears and tail are all these. */
function sdCapsule(p: V3, a: V3, b: V3, r: number): number {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = Math.max(0, Math.min(1, dot(pa, ba) / (dot(ba, ba) || 1)));
  return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - r;
}

/** Smooth union, so the parts read as one animal rather than a pile of beans. */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/**
 * The animal, posed at phase t in [0,1) of one hop.
 *
 * A hop is not a bounce with legs attached: the body rises and pitches
 * nose-up as the hind legs extend, the fore legs reach out to catch the
 * landing, and the whole thing compresses on touchdown. Getting that ordering
 * right matters more than any amount of detail on the shape.
 */
function scene(p: V3, t: number): number {
  const rise = Math.max(0, Math.sin(t * Math.PI * 2)) ;
  const airborne = rise;
  const bodyY = 0.34 + airborne * 0.26;
  const pitch = Math.sin(t * Math.PI * 2) * 0.26;

  // Rotate a point into the body's pitched frame.
  const cs = Math.cos(-pitch);
  const sn = Math.sin(-pitch);
  const q: V3 = [
    (p[0] - 0) * cs - (p[1] - bodyY) * sn,
    (p[0] - 0) * sn + (p[1] - bodyY) * cs,
    p[2],
  ];

  let d = sdEllipsoid(q, [0, 0, 0], [0.38, 0.27, 0.26]);
  // Haunch, which is most of a rabbit's silhouette from the side.
  d = smin(d, sdEllipsoid(q, [-0.2, -0.02, 0], [0.26, 0.24, 0.23]), 0.09);
  // Head and muzzle.
  d = smin(d, sdEllipsoid(q, [0.36, 0.16, 0], [0.19, 0.18, 0.17]), 0.07);
  d = smin(d, sdEllipsoid(q, [0.5, 0.09, 0], [0.11, 0.09, 0.09]), 0.05);
  // Ears, laid back a little when airborne the way they are in a real bound.
  const earLay = 0.3 + airborne * 0.45;
  for (const side of [-1, 1]) {
    d = smin(
      d,
      sdCapsule(
        q,
        [0.34, 0.28, side * 0.08],
        [0.34 - earLay * 0.5, 0.28 + 0.34 - earLay * 0.2, side * 0.12],
        0.045
      ),
      0.05
    );
  }
  // Tail.
  d = smin(d, sdEllipsoid(q, [-0.42, 0.06, 0], [0.1, 0.1, 0.1]), 0.06);

  // Legs. Hind drive the take-off, fore reach for the landing.
  const hind = Math.sin(t * Math.PI * 2 - 0.6);
  const fore = Math.sin(t * Math.PI * 2 + 1.5);
  for (const side of [-1, 1]) {
    d = smin(
      d,
      sdCapsule(
        p,
        [-0.16, bodyY - 0.12, side * 0.17],
        [-0.16 - hind * 0.22, bodyY - 0.3 - airborne * 0.06, side * 0.17],
        0.062
      ),
      0.05
    );
    d = smin(
      d,
      sdCapsule(
        p,
        [0.22, bodyY - 0.12, side * 0.13],
        [0.22 + fore * 0.16, bodyY - 0.29 - airborne * 0.04, side * 0.13],
        0.05
      ),
      0.045
    );
  }
  return d;
}

function normalAt(p: V3, t: number): V3 {
  const e = 0.0035;
  return normalize([
    scene([p[0] + e, p[1], p[2]], t) - scene([p[0] - e, p[1], p[2]], t),
    scene([p[0], p[1] + e, p[2]], t) - scene([p[0], p[1] - e, p[2]], t),
    scene([p[0], p[1], p[2] + e], t) - scene([p[0], p[1], p[2] - e], t),
  ]);
}

/** The same sun the yards are lit by: up, to the left, slightly toward us. */
const SUN = normalize([-0.52, 0.66, -0.54]);

function renderFrame(t: number, coat: V3, belly: V3): Buffer {
  const W = CELL * SS;
  const H = CELL * SS;
  const rgba = new Uint8ClampedArray(W * H * 4);

  // Orthographic side view, which is how you see an animal crossing a field.
  const half = 0.95;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = ((px / W) * 2 - 1) * half;
      const y = (1 - (py / H) * 2) * half * 0.78 + 0.34;

      let z = -1.6;
      let hit = false;
      let p: V3 = [x, y, z];
      for (let i = 0; i < 64; i++) {
        p = [x, y, z];
        const d = scene(p, t);
        if (d < 0.0015) {
          hit = true;
          break;
        }
        z += Math.max(d * 0.85, 0.004);
        if (z > 1.6) break;
      }
      if (!hit) continue;

      const n = normalAt(p, t);
      const diffuse = Math.max(0, dot(n, SUN));
      // A little wrap and a rim from the sky, so the shaded side keeps form.
      const wrap = Math.max(0, dot(n, SUN) * 0.5 + 0.5);
      const rim = Math.pow(Math.max(0, 1 - Math.abs(n[2])), 3) * 0.24;
      const lit = diffuse * 0.66 + wrap * 0.3 + 0.22;

      // Undersides are paler on almost every small mammal.
      const up = Math.max(0, -n[1]);
      const c: V3 = [
        coat[0] + (belly[0] - coat[0]) * up,
        coat[1] + (belly[1] - coat[1]) * up,
        coat[2] + (belly[2] - coat[2]) * up,
      ];

      const i = (py * W + px) * 4;
      rgba[i] = c[0] * lit + 255 * rim;
      rgba[i + 1] = c[1] * lit + 255 * rim;
      rgba[i + 2] = c[2] * lit + 255 * rim;
      rgba[i + 3] = 255;
    }
  }
  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/critters";

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });

  // One sheet per coat. Same animal, retinted for the scene it crosses.
  const coats: Array<[string, V3, V3]> = [
    ["hare", [176, 150, 118], [232, 222, 204]],
    ["fox", [186, 104, 48], [238, 226, 208]],
    ["grey", [128, 126, 130], [220, 218, 220]],
  ];

  for (const [name, coat, belly] of coats) {
    const cells: Buffer[] = [];
    for (let f = 0; f < FRAMES; f++) {
      const raw = renderFrame(f / FRAMES, coat, belly);
      cells.push(
        await sharp(raw, { raw: { width: CELL * SS, height: CELL * SS, channels: 4 } })
          .resize(CELL, CELL)
          .png()
          .toBuffer()
      );
    }
    const sheet = await sharp({
      create: {
        width: CELL * FRAMES,
        height: CELL,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(cells.map((input, i) => ({ input, left: i * CELL, top: 0 })))
      .png()
      .toBuffer();

    const file = `${OUT}/${name}.png`;
    writeFileSync(join(root, file), sheet);
    console.log(`  ${file}  ${CELL * FRAMES}x${CELL}  ${(sheet.length / 1024).toFixed(0)} KB`);
  }
}

main();
