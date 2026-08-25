/**
 * Renders the garden ornaments you can stand in your yard.
 *
 *   npm run ornaments
 *
 * Same signed-distance approach as the houses and the critter, and lit by the
 * same sun, so an ornament dropped on the pad belongs to the picture rather
 * than sitting on top of it.
 *
 * Each sprite is drawn so the object's feet are on the bottom edge of the
 * cell. That is what lets the browser place one by its ground point: the
 * projected screen position is the feet, and the sprite hangs upward from it.
 *
 * These are billboards. From a quarter-turn away a bench is not strictly the
 * shape it would be, but at the size they render — a couple of dozen pixels —
 * silhouette is all that survives, and a billboard reads correctly enough that
 * twelve renders per ornament would be paying a lot for very little.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CELL = 256;
const SS = 3;

type V3 = [number, number, number];

const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normalize(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function sdBox(p: V3, c: V3, b: V3): number {
  const q: V3 = [
    Math.abs(p[0] - c[0]) - b[0],
    Math.abs(p[1] - c[1]) - b[1],
    Math.abs(p[2] - c[2]) - b[2],
  ];
  const out = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  return out + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

function sdCyl(p: V3, c: V3, r: number, h: number): number {
  const d = len([p[0] - c[0], 0, p[2] - c[2]]) - r;
  const y = Math.abs(p[1] - c[1]) - h;
  return len([Math.max(d, 0), Math.max(y, 0), 0]) + Math.min(Math.max(d, y), 0);
}

function sdCone(p: V3, c: V3, r: number, h: number): number {
  const q = len([p[0] - c[0], 0, p[2] - c[2]]);
  const y = p[1] - c[1];
  const k = normalize([h, r, 0]);
  return Math.max(k[0] * q + k[1] * y - k[0] * r, Math.max(-y, y - h));
}

function sdSphere(p: V3, c: V3, r: number): number {
  return len([p[0] - c[0], p[1] - c[1], p[2] - c[2]]) - r;
}

type Hit = { d: number; c: V3 };
const closer = (a: Hit, b: Hit): Hit => (a.d < b.d ? a : b);

const BARK: V3 = [112, 82, 54];
const LEAF: V3 = [74, 132, 62];
const WOOD: V3 = [156, 116, 74];
const IRON: V3 = [64, 68, 76];
const STONE: V3 = [176, 172, 164];
const WATER: V3 = [92, 168, 200];
const PETAL: V3 = [226, 108, 140];
const BRASS: V3 = [214, 176, 96];

/** Each model stands on y = 0 and is about one unit tall per unit of `height`. */
const ORNAMENTS: Record<string, { height: number; width: number; sdf: (p: V3) => Hit }> = {
  tree: {
    height: 3.4,
    width: 1.4,
    sdf: (p) => {
      let h: Hit = { d: sdCyl(p, [0, 0.75, 0], 0.14, 0.75), c: BARK };
      h = closer(h, { d: sdSphere(p, [-0.28, 1.75, 0], 0.62), c: LEAF });
      h = closer(h, { d: sdSphere(p, [0.3, 2.02, 0.1], 0.66), c: LEAF });
      h = closer(h, { d: sdSphere(p, [0, 2.5, -0.05], 0.58), c: LEAF });
      return h;
    },
  },
  bench: {
    height: 1.0,
    width: 1.5,
    sdf: (p) => {
      let h: Hit = { d: sdBox(p, [0, 0.42, 0], [0.72, 0.05, 0.2]), c: WOOD };
      h = closer(h, { d: sdBox(p, [0, 0.72, -0.16], [0.72, 0.26, 0.05]), c: WOOD });
      for (const x of [-0.6, 0.6]) {
        h = closer(h, { d: sdBox(p, [x, 0.21, 0], [0.05, 0.21, 0.18]), c: IRON });
      }
      return h;
    },
  },
  lamp: {
    height: 2.6,
    width: 0.7,
    sdf: (p) => {
      let h: Hit = { d: sdCyl(p, [0, 0.1, 0], 0.2, 0.1), c: STONE };
      h = closer(h, { d: sdCyl(p, [0, 1.1, 0], 0.07, 1.1), c: IRON });
      h = closer(h, { d: sdCone(p, [0, 2.5, 0], 0.28, -0.42), c: IRON });
      h = closer(h, { d: sdSphere(p, [0, 2.22, 0], 0.24), c: [255, 236, 176] });
      return h;
    },
  },
  fountain: {
    height: 1.8,
    width: 2.0,
    sdf: (p) => {
      let h: Hit = { d: sdCyl(p, [0, 0.22, 0], 0.95, 0.22), c: STONE };
      const bowl = Math.max(sdCyl(p, [0, 0.3, 0], 0.85, 0.2), -sdCyl(p, [0, 0.38, 0], 0.72, 0.2));
      h = closer(h, { d: bowl, c: STONE });
      h = closer(h, { d: sdCyl(p, [0, 0.3, 0], 0.72, 0.06), c: WATER });
      h = closer(h, { d: sdCyl(p, [0, 0.78, 0], 0.16, 0.5), c: STONE });
      h = closer(h, { d: sdCyl(p, [0, 1.3, 0], 0.42, 0.07), c: STONE });
      h = closer(h, { d: sdSphere(p, [0, 1.52, 0], 0.16), c: WATER });
      return h;
    },
  },
  flowerbed: {
    height: 0.7,
    width: 1.7,
    sdf: (p) => {
      const ring = Math.max(sdCyl(p, [0, 0.16, 0], 0.78, 0.16), -sdCyl(p, [0, 0.2, 0], 0.62, 0.2));
      let h: Hit = { d: ring, c: STONE };
      h = closer(h, { d: sdCyl(p, [0, 0.2, 0], 0.62, 0.08), c: [92, 68, 46] });
      const blooms: V3[] = [
        [-0.3, 0.36, -0.1],
        [0.1, 0.4, 0.18],
        [0.34, 0.34, -0.14],
        [-0.05, 0.34, -0.3],
      ];
      for (const b of blooms) {
        h = closer(h, { d: sdSphere(p, b, 0.16), c: LEAF });
        h = closer(h, { d: sdSphere(p, [b[0], b[1] + 0.13, b[2]], 0.09), c: PETAL });
      }
      return h;
    },
  },
  fence: {
    height: 1.1,
    width: 2.0,
    sdf: (p) => {
      let h: Hit = { d: sdBox(p, [0, 0.62, 0], [0.95, 0.05, 0.04]), c: WOOD };
      h = closer(h, { d: sdBox(p, [0, 0.34, 0], [0.95, 0.05, 0.04]), c: WOOD });
      for (const x of [-0.85, -0.42, 0, 0.42, 0.85]) {
        h = closer(h, { d: sdBox(p, [x, 0.44, 0], [0.06, 0.44, 0.035]), c: WOOD });
      }
      return h;
    },
  },
  birdbath: {
    height: 1.3,
    width: 1.1,
    sdf: (p) => {
      let h: Hit = { d: sdCyl(p, [0, 0.08, 0], 0.34, 0.08), c: STONE };
      h = closer(h, { d: sdCyl(p, [0, 0.5, 0], 0.11, 0.45), c: STONE });
      const bowl = Math.max(sdCyl(p, [0, 1.02, 0], 0.48, 0.12), -sdCyl(p, [0, 1.1, 0], 0.38, 0.12));
      h = closer(h, { d: bowl, c: STONE });
      h = closer(h, { d: sdCyl(p, [0, 1.02, 0], 0.38, 0.05), c: WATER });
      return h;
    },
  },
  mailbox: {
    height: 1.3,
    width: 0.7,
    sdf: (p) => {
      let h: Hit = { d: sdBox(p, [0, 0.5, 0], [0.06, 0.5, 0.06]), c: WOOD };
      const body = Math.min(
        sdBox(p, [0, 1.05, 0], [0.17, 0.14, 0.28]),
        sdCyl([p[0], p[2], p[1]], [0, 0, 1.19], 0.17, 0.28)
      );
      h = closer(h, { d: body, c: [178, 66, 58] });
      h = closer(h, { d: sdSphere(p, [0.2, 1.2, 0], 0.06), c: BRASS });
      return h;
    },
  },
  pond: {
    height: 0.4,
    width: 2.3,
    sdf: (p) => {
      const rim = Math.max(sdCyl(p, [0, 0.08, 0], 1.1, 0.08), -sdCyl(p, [0, 0.1, 0], 0.9, 0.12));
      let h: Hit = { d: rim, c: STONE };
      h = closer(h, { d: sdCyl(p, [0, 0.09, 0], 0.9, 0.05), c: WATER });
      h = closer(h, { d: sdCyl(p, [0.3, 0.13, 0.1], 0.2, 0.02), c: LEAF });
      h = closer(h, { d: sdCyl(p, [-0.34, 0.13, -0.2], 0.16, 0.02), c: LEAF });
      return h;
    },
  },
  topiary: {
    height: 1.9,
    width: 1.0,
    sdf: (p) => {
      const pot = Math.max(sdCone(p, [0, 0.42, 0], 0.42, -0.6), -sdCyl(p, [0, 0.44, 0], 0.28, 0.1));
      let h: Hit = { d: pot, c: [166, 104, 74] };
      h = closer(h, { d: sdCyl(p, [0, 0.7, 0], 0.06, 0.3), c: BARK });
      h = closer(h, { d: sdSphere(p, [0, 1.12, 0], 0.38), c: LEAF });
      h = closer(h, { d: sdSphere(p, [0, 1.66, 0], 0.28), c: LEAF });
      return h;
    },
  },
};

/** Up and to the left, matching the yards. */
const SUN = normalize([-0.55, 0.7, -0.45]);

function render(id: string): Buffer {
  const { height, width, sdf } = ORNAMENTS[id];
  const W = CELL * SS;
  const H = CELL * SS;
  const rgba = new Uint8ClampedArray(W * H * 4);

  // A square window in world units, sized by whichever extent is larger, with
  // the model's feet on the bottom edge. Framing by height alone cropped
  // anything wide and low — a bench came out as a slab of its own backrest.
  const half = (Math.max(width, height) / 2) * 1.08;

  const normalAt = (p: V3): V3 => {
    const e = 0.0025;
    return normalize([
      sdf([p[0] + e, p[1], p[2]]).d - sdf([p[0] - e, p[1], p[2]]).d,
      sdf([p[0], p[1] + e, p[2]]).d - sdf([p[0], p[1] - e, p[2]]).d,
      sdf([p[0], p[1], p[2] + e]).d - sdf([p[0], p[1], p[2] - e]).d,
    ]);
  };

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = ((px / W) * 2 - 1) * half;
      const y = (1 - py / H) * half * 2;

      let z = -3;
      let hit: Hit | null = null;
      let p: V3 = [x, y, z];
      for (let i = 0; i < 90; i++) {
        p = [x, y, z];
        const s = sdf(p);
        if (s.d < 0.0025) {
          hit = s;
          break;
        }
        z += Math.max(s.d * 0.85, 0.004);
        if (z > 3) break;
      }
      if (!hit) continue;

      const n = normalAt(p);
      const diffuse = Math.max(0, dot(n, SUN));
      let sh = 1;
      {
        let t = 0.03;
        for (let i = 0; i < 18 && t < 3; i++) {
          const d = sdf([p[0] + SUN[0] * t, p[1] + SUN[1] * t, p[2] + SUN[2] * t]).d;
          if (d < 0.0015) {
            sh = 0;
            break;
          }
          sh = Math.min(sh, (9 * d) / t);
          t += Math.max(d, 0.02);
        }
        sh = Math.max(0, Math.min(1, sh));
      }
      // Sky light from above fills the shade, as it does on the buildings.
      const sky = (0.5 + 0.5 * n[1]) * 0.34;
      const lit = diffuse * sh * 0.74 + 0.26;

      const i = (py * W + px) * 4;
      rgba[i] = hit.c[0] * lit + 168 * sky;
      rgba[i + 1] = hit.c[1] * lit + 194 * sky;
      rgba[i + 2] = hit.c[2] * lit + 214 * sky;
      rgba[i + 3] = 255;
    }
  }
  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/ornaments";

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });
  for (const id of Object.keys(ORNAMENTS)) {
    const raw = render(id);
    const out = await sharp(raw, { raw: { width: CELL * SS, height: CELL * SS, channels: 4 } })
      .resize(CELL, CELL)
      .png({ compressionLevel: 9 })
      .toBuffer();
    const file = `${OUT}/${id}.png`;
    writeFileSync(join(root, file), out);
    console.log(`  ${file}  ${(out.length / 1024).toFixed(0)} KB`);
  }
}

main();
