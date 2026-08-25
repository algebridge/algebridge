/**
 * Renders each yard as a turntable: the same scene from N angles around the
 * house, so the view can be spun and zoomed.
 *
 *   npm run turntable
 *
 * Two things change from the separate yard and house passes.
 *
 * First, the camera orbits. It sits one PAD_Z out from the pad on a circle and
 * always looks at it, so the pad stays the same size and in the same place in
 * every frame — which is what makes a drag-to-spin feel like turning one
 * object rather than cutting between photographs.
 *
 * Second, the ground and the building are rendered in ONE pass with a shared
 * depth buffer. That buys three things the composite could never have: the
 * terrain occludes the building where it should, the building casts a real
 * shadow onto the ground, and props behind the house are hidden by it.
 *
 * Props — trees, rocks, bushes, fence posts — are placed on a deterministic
 * lattice, skipped near the pad, and sphere-traced with the same shader as the
 * house. They are what stops the middle distance reading as bare noise.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  CAM_Y,
  FOV,
  HORIZON,
  PAD_R,
  PAD_Z,
  PITCH_SCALE,
  SCENES,
  Z_FAR,
  Z_NEAR,
  hash2,
  height,
  noise2,
  padMix,
  type Scene,
} from "./gen-yards.ts";
import {
  MODELS,
  M_LEAF,
  M_STONE,
  M_TRIM,
  PALETTES,
  occlusion,
  normalAt,
  sdCyl,
  surface,
  type Hit,
  type Model,
  type Palette,
} from "./gen-houses.ts";

type V3 = [number, number, number];

const FRAMES = 12;
const OUT_W = 1400;
const OUT_H = 933;
const SS = 1.5;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
function normalize(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/* ── Props ──────────────────────────────────────────────────────
   Scattered on a lattice so the placement is reproducible and never lands on
   the ground the house needs. Each is a couple of solids; at the distance
   they sit, silhouette is all that survives anyway. */

/** Radius of the cylinder that encloses any prop, for the conservative bound. */
const PROP_BOUND = 2.6;

type Prop = { x: number; z: number; kind: number; scale: number; groundY: number };

function propsFor(s: Scene, seed: number): Prop[] {
  const out: Prop[] = [];
  for (let gx = -9; gx <= 9; gx++) {
    for (let gz = -5; gz <= 11; gz++) {
      const r = hash2(gx * 71 + seed, gz * 37 + seed);
      if (r > 0.62) continue;
      const x = gx * 5 + (hash2(gx + 11, gz + 3) - 0.5) * 4;
      const z = PAD_Z + gz * 5 + (hash2(gx + 5, gz + 19) - 0.5) * 4;
      if (z < Z_NEAR + 2) continue;
      const r0 = Math.sqrt(x * x + (z - PAD_Z) * (z - PAD_Z));
      // Keep the pad and its approach clear.
      if (r0 < PAD_R * 2.4) continue;
      // And keep clear of the ring the camera orbits on. A prop that lands
      // near the eye fills the frame from some angles and reads as floating,
      // because its own ground is nothing like the ground behind it.
      if (Math.abs(r0 - PAD_Z) < 5) continue;
      const kind = r < 0.2 ? 0 : r < 0.3 ? 1 : r < 0.42 ? 2 : r < 0.52 ? 3 : 4;
      out.push({
        x,
        z,
        kind,
        scale: 0.7 + hash2(gx * 13, gz * 29) * 0.8,
        // Sampled once. Sampling it inside the march is an fbm call per prop
        // per step, which is the difference between seconds and hours.
        groundY: height(x, z, s),
      });
    }
  }
  return out;
}

/** One prop as an SDF, in world space. */
/** A sphere, which the props are mostly made of. */
function sdSphere(p: V3, c: V3, r: number): number {
  return Math.sqrt(
    (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]) + (p[2] - c[2]) * (p[2] - c[2])
  ) - r;
}

function propSdf(p: V3, pr: Prop): Hit {
  const groundY = pr.groundY;
  const s = pr.scale;
  const q: V3 = [p[0] - pr.x, p[1] - groundY, p[2] - pr.z];
  if (pr.kind === 0) {
    // Tree: a trunk and three overlapping crowns. Spheres, not cones — a cone
    // reads as a party hat at this size.
    let h: Hit = { d: sdCyl(q, [0, 1.3 * s, 0], 0.2 * s, 1.3 * s), m: M_TRIM };
    const crown = Math.min(
      sdSphere(q, [-0.42 * s, 2.5 * s, 0], 1.0 * s),
      Math.min(
        sdSphere(q, [0.46 * s, 2.86 * s, 0.16 * s], 1.06 * s),
        sdSphere(q, [0, 3.5 * s, -0.1 * s], 0.92 * s)
      )
    );
    if (crown < h.d) h = { d: crown, m: M_LEAF };
    return h;
  }
  if (pr.kind === 1) {
    // Boulder, as two lumps so it is not a ball on a lawn.
    const a = sdSphere(q, [0, 0.3 * s, 0], 0.74 * s);
    const b = sdSphere(q, [0.5 * s, 0.2 * s, 0.2 * s], 0.44 * s);
    return { d: Math.min(a, b), m: M_STONE };
  }
  if (pr.kind === 2) {
    // Bush clump.
    const a = sdSphere(q, [0, 0.4 * s, 0], 0.72 * s);
    const b = sdSphere(q, [0.6 * s, 0.3 * s, -0.2 * s], 0.5 * s);
    const c = sdSphere(q, [-0.5 * s, 0.32 * s, 0.24 * s], 0.54 * s);
    return { d: Math.min(a, Math.min(b, c)), m: M_LEAF };
  }
  if (pr.kind === 3) {
    // Conifer: a narrow tapered stack, which reads differently at distance
    // from the round broadleaf and stops the treeline looking cloned.
    let h: Hit = { d: sdCyl(q, [0, 0.6 * s, 0], 0.16 * s, 0.6 * s), m: M_TRIM };
    const cone = Math.min(
      sdSphere(q, [0, 1.5 * s, 0], 0.86 * s),
      Math.min(sdSphere(q, [0, 2.4 * s, 0], 0.66 * s), sdSphere(q, [0, 3.2 * s, 0], 0.44 * s))
    );
    if (cone < h.d) h = { d: cone, m: M_LEAF };
    return h;
  }
  // Fallen log.
  return {
    d: sdCyl([q[0], q[2], q[1]], [0, 0, 0.3 * s], 0.26 * s, 1.1 * s),
    m: M_TRIM,
  };
}

/** Props bucketed by plan position, so a query touches a handful, not all. */
const PROP_CELL = 8;

function buildGrid(props: Prop[]): Map<number, Prop[]> {
  const grid = new Map<number, Prop[]>();
  for (const pr of props) {
    const key = cellKey(Math.floor(pr.x / PROP_CELL), Math.floor(pr.z / PROP_CELL));
    const bucket = grid.get(key);
    if (bucket) bucket.push(pr);
    else grid.set(key, [pr]);
  }
  return grid;
}

const cellKey = (gx: number, gz: number) => (gx + 512) * 4096 + (gz + 512);

/**
 * Distance to the nearest prop.
 *
 * Two things here are load-bearing.
 *
 * The returned distance must be a CONSERVATIVE bound, never infinity. Sphere
 * tracing steps by whatever this gives back and is only safe while that never
 * overstates how far the surface is. An early version returned 1e9 for any
 * prop outside a reject radius, and rays leapt clean through the crowns and
 * carved every tree into hollow shells — the surface was there, the march
 * simply stepped over it.
 *
 * And the lookup has to be local. Iterating every prop per evaluation is
 * correct and unusably slow: with a hundred-odd props it took a frame from
 * seconds to twelve minutes. Anything outside the 3x3 block of cells is at
 * least one whole cell away in plan, which is itself a valid bound.
 */
function propScene(p: V3, grid: Map<number, Prop[]>): Hit {
  const gx = Math.floor(p[0] / PROP_CELL);
  const gz = Math.floor(p[2] / PROP_CELL);
  let best: Hit = { d: PROP_CELL - PROP_BOUND, m: M_LEAF };

  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const bucket = grid.get(cellKey(gx + ix, gz + iz));
      if (!bucket) continue;
      for (const pr of bucket) {
        const dx = p[0] - pr.x;
        const dz = p[2] - pr.z;
        const planar = Math.sqrt(dx * dx + dz * dz);
        if (planar > 7) {
          const bound = planar - PROP_BOUND;
          if (bound < best.d) best = { d: bound, m: M_LEAF };
          continue;
        }
        const h = propSdf(p, pr);
        if (h.d < best.d) best = h;
      }
    }
  }
  return best;
}

/* ── Render ─────────────────────────────────────────────────────*/

function render(id: string, frame: number): Buffer {
  const s = SCENES[id];
  const pal: Palette = PALETTES[id];
  const model: Model = MODELS[id];
  const props = propsFor(s, 7);
  const grid = buildGrid(props);

  const w = Math.round(OUT_W * SS);
  const h = Math.round(OUT_H * SS);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const horizonY = HORIZON * h;

  // Camera orbits the pad and always looks at it, so the house holds still in
  // frame while the world turns around it.
  const theta = (frame / FRAMES) * Math.PI * 2;
  const fwd: V3 = [Math.sin(theta), 0, Math.cos(theta)];
  const right: V3 = [Math.cos(theta), 0, -Math.sin(theta)];
  const eye: V3 = [-fwd[0] * PAD_Z, CAM_Y, PAD_Z - fwd[2] * PAD_Z];

  /** The building, rotated into world space for this frame. */
  const posed: Model = (p) => {
    const lx = p[0] - 0;
    const lz = p[2] - PAD_Z;
    // The house keeps its own quarter-turn so no frame is dead-on square.
    const a = -theta + 0.4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return model([lx * c - lz * sn, p[1], lx * sn + lz * c]);
  };

  /** Everything solid: the building and the props. */
  const solids: Model = (p) => {
    const a = posed(p);
    const b = propScene(p, grid);
    return a.d < b.d ? a : b;
  };

  /** Terrain shadow now has to account for what stands on it. */
  function sunShadow(x: number, y: number, z: number): number {
    let shade = 1;
    let t = 0.35;
    for (let i = 0; i < 22 && t < 26; i++) {
      const hx = x + s.sun[0] * t;
      const hy = y + s.sun[1] * t;
      const hz = z + s.sun[2] * t;
      const gap = hy - height(hx, hz, s);
      if (gap < 0) return 0.12;
      shade = Math.min(shade, (gap * 7) / t);
      if (t < 12) {
        const solid = solids([hx, hy, hz]).d;
        if (solid < 0.03) return 0.12;
        shade = Math.min(shade, (solid * 6) / t);
      }
      t *= 1.42;
    }
    return Math.max(0.12, Math.min(1, shade));
  }

  const depth = new Float32Array(w * h).fill(Infinity);

  /* ── Terrain, one ray per COLUMN ─────────────────────────────────
     Marching near to far and only painting above the highest pixel drawn so
     far gives correct occlusion for free and, far more importantly, costs one
     height() walk per column instead of one per pixel. Doing this per pixel
     is the difference between a minute and an afternoon. */
  for (let sx = 0; sx < w; sx++) {
    const dirX = (sx / w - 0.5) * 2 * FOV;
    const dir: V3 = [fwd[0] + right[0] * dirX, 0, fwd[2] + right[2] * dirX];
    let highest = h;
    let z = Z_NEAR;
    let step = 0.01;

    while (z < Z_FAR && highest > 0) {
      const wx = eye[0] + dir[0] * z;
      const wz = eye[2] + dir[2] * z;
      let hh = height(wx, wz, s);
      const water = s.water !== null && hh < (s.water as number);
      if (water) hh = s.water as number;

      const sy = Math.round(horizonY + ((CAM_Y - hh) / z) * h * PITCH_SCALE);
      if (sy < highest) {
        const e = 0.04;
        let nx: number;
        let nz: number;
        let ny: number;
        if (water) {
          const rx = noise2(wx * 1.7 + 5, wz * 1.7 + 5) - noise2(wx * 1.7 - 5, wz * 1.7 - 5);
          const rz = noise2(wx * 1.7 + 9, wz * 1.7 + 9) - noise2(wx * 1.7 - 9, wz * 1.7 - 9);
          nx = -rx * 0.16;
          nz = -rz * 0.16;
          ny = 1;
        } else {
          nx = -(height(wx + e, wz, s) - height(wx - e, wz, s));
          nz = -(height(wx, wz + e, s) - height(wx, wz - e, s));
          ny = 2 * e;
        }
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl;
        nz /= nl;
        const nyn = ny / nl;

        const diffuse = Math.max(0, nx * s.sun[0] + nyn * s.sun[1] + nz * s.sun[2]);
        const sh = water ? 1 : sunShadow(wx, hh, wz);
        const lit = Math.min(1, diffuse * sh * 0.9 + 0.1);
        const skyFill = (1 - diffuse * sh) * 0.34;

        let dark: V3;
        let light: V3;
        if (water) {
          dark = s.waterDark as V3;
          light = s.waterLit as V3;
        } else {
          const flat = Math.max(0, nyn);
          const bare = Math.max(
            0,
            Math.min(1, (0.74 - flat) * 3.1 + (noise2(wx * 0.7 + 3, wz * 0.7 + 3) - 0.5) * 0.7)
          );
          const pad = padMix(wx, wz);
          const gd: V3 = [
            s.groundDark[0] + (s.bareDark[0] - s.groundDark[0]) * bare,
            s.groundDark[1] + (s.bareDark[1] - s.groundDark[1]) * bare,
            s.groundDark[2] + (s.bareDark[2] - s.groundDark[2]) * bare,
          ];
          const gl: V3 = [
            s.groundLit[0] + (s.bareLit[0] - s.groundLit[0]) * bare,
            s.groundLit[1] + (s.bareLit[1] - s.groundLit[1]) * bare,
            s.groundLit[2] + (s.bareLit[2] - s.groundLit[2]) * bare,
          ];
          dark = [
            gd[0] + (s.padDark[0] - gd[0]) * pad,
            gd[1] + (s.padDark[1] - gd[1]) * pad,
            gd[2] + (s.padDark[2] - gd[2]) * pad,
          ];
          light = [
            gl[0] + (s.padLit[0] - gl[0]) * pad,
            gl[1] + (s.padLit[1] - gl[1]) * pad,
            gl[2] + (s.padLit[2] - gl[2]) * pad,
          ];
        }

        const grain = water
          ? 1
          : (noise2(wx * 1.6, wz * 1.6) * 0.15 + 0.9) *
            (noise2(wx * 7.5 + 31, wz * 7.5 + 31) * 0.1 + 0.95);

        let r = (dark[0] + (light[0] - dark[0]) * lit) * grain;
        let g = (dark[1] + (light[1] - dark[1]) * lit) * grain;
        let b = (dark[2] + (light[2] - dark[2]) * lit) * grain;
        r += (s.ambient[0] - r) * skyFill;
        g += (s.ambient[1] - g) * skyFill;
        b += (s.ambient[2] - b) * skyFill;

        const tt = Math.min(1, ((z - Z_NEAR) / (Z_FAR - Z_NEAR)) * s.fog);
        const haze = tt * tt * 0.6;
        r += (s.ambient[0] - r) * haze;
        g += (s.ambient[1] - g) * haze;
        b += (s.ambient[2] - b) * haze;
        const alpha = Math.max(0, 1 - tt * tt * tt * 1.04) * 255;

        for (let y = Math.max(0, sy); y < highest; y++) {
          const i = (y * w + sx) * 4;
          rgba[i] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = alpha;
          depth[y * w + sx] = z;
        }
        highest = Math.max(0, sy);
      }

      z += step;
      step *= 1.0035;
    }
  }

  /* ── Solids, one ray per pixel, depth-tested against the ground ── */
  for (let py = 0; py < h; py++) {
    const dirY = (py - horizonY) / (h * PITCH_SCALE);
    for (let px = 0; px < w; px++) {
      const dirX = (px / w - 0.5) * 2 * FOV;
      const dir: V3 = [fwd[0] + right[0] * dirX, 0, fwd[2] + right[2] * dirX];

      let t = Math.max(Z_NEAR, 0.6);
      let hitP: V3 | null = null;
      let mat = 0;
      const limit = Math.min(depth[py * w + px], PAD_Z + 30);
      for (let i = 0; i < 110; i++) {
        const p: V3 = [eye[0] + dir[0] * t, CAM_Y - dirY * t, eye[2] + dir[2] * t];
        const hit = solids(p);
        if (hit.d < 0.006) {
          hitP = p;
          mat = hit.m;
          break;
        }
        t += Math.max(hit.d * 0.8, 0.012);
        if (t > limit) break;
      }
      if (!hitP) continue;

      const n = normalAt(hitP, solids);
      const diffuse = Math.max(0, dot(n, pal.sun));
      let sh = 1;
      {
        let st = 0.05;
        for (let i = 0; i < 22 && st < 11; i++) {
          const q: V3 = [
            hitP[0] + pal.sun[0] * st,
            hitP[1] + pal.sun[1] * st,
            hitP[2] + pal.sun[2] * st,
          ];
          const d = solids(q).d;
          if (d < 0.002) {
            sh = 0;
            break;
          }
          sh = Math.min(sh, (11 * d) / st);
          st += Math.max(d, 0.03);
        }
        sh = Math.max(0, Math.min(1, sh));
      }
      const ao = occlusion(hitP, n, solids);
      const skyAmt = (0.5 + 0.5 * n[1]) * 0.5 * ao;

      const a = -theta + 0.4;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const lx = hitP[0];
      const lz = hitP[2] - PAD_Z;
      const q: V3 = [lx * c - lz * sn, hitP[1], lx * sn + lz * c];
      const nq: V3 = [n[0] * c - n[2] * sn, n[1], n[0] * sn + n[2] * c];
      const surf = surface(mat, q, nq, pal);
      const lit = (diffuse * sh * 0.78 + 0.27) * surf.shade;

      let r = surf.col[0] * lit + pal.sky[0] * skyAmt * surf.shade;
      let g = surf.col[1] * lit + pal.sky[1] * skyAmt * surf.shade;
      let b = surf.col[2] * lit + pal.sky[2] * skyAmt * surf.shade;

      const tt = Math.min(1, ((t - Z_NEAR) / (Z_FAR - Z_NEAR)) * s.fog);
      const haze = tt * tt * 0.6;
      r += (s.ambient[0] - r) * haze;
      g += (s.ambient[1] - g) * haze;
      b += (s.ambient[2] - b) * haze;

      const i = (py * w + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }

  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/turntable";

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });
  const only = process.argv[2];

  for (const id of Object.keys(SCENES)) {
    if (only && id !== only) continue;
    for (let f = 0; f < FRAMES; f++) {
      const raw = render(id, f);
      const out = await sharp(raw, {
        raw: { width: Math.round(OUT_W * SS), height: Math.round(OUT_H * SS), channels: 4 },
      })
        .resize(OUT_W, OUT_H)
        .webp({ quality: 82, alphaQuality: 90, effort: 5 })
        .toBuffer();
      const file = `${OUT}/${id}-${f}.webp`;
      writeFileSync(join(root, file), out);
      console.log(`  ${file}  ${(out.length / 1024).toFixed(0)} KB`);
    }
  }
}

main();
