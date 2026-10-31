import * as THREE from "three";
import type { ArenaId } from "../types";
import type { Palette } from "../render/Materials";
import { buildProp, type Prop } from "./Props";
import { clamp } from "../util";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WaterMaterial } from "../render/Water";
import { shadeHex } from "../util";

export type Dir = "+x" | "-x" | "+z" | "-z";

/** A solid box: a wall when you are below its top, a floor when you are on it. Bottom defaults to the ground. */
export interface BoxBlock {
  kind: "box";
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  y?: number;
  color?: string;
  /** Colour of the drivable top slab; omit for none. */
  top?: string;
  /** A neon strip around the top edge. */
  strip?: string;
}

/** A wedge rising from h0 at its low end to h1 at its high end, in direction dir. */
export interface RampBlock {
  kind: "ramp";
  x: number;
  z: number;
  w: number;
  d: number;
  h0: number;
  h1: number;
  dir: Dir;
  color?: string;
}

export type Block = BoxBlock | RampBlock;

export interface ArenaTheme {
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ground: string;
  groundLine: string;
  /** Beyond the walls: "same" keeps the ground going, or a sheet of water below it. */
  outside: "same" | { color: string; light: string; y: number };
  wall: string;
  wallTop: string;
  wallStripe: string;
  rampColor: string;
  sun: string;
  sunIntensity: number;
  sunFrom: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambient: string;
  ambientIntensity: number;
  night: boolean;
  cloudColor: string;
  clouds: number;
}

export interface Spawn {
  x: number;
  z: number;
  yaw: number;
}

export interface ArenaDef {
  id: ArenaId;
  name: string;
  tagline: string;
  /** Half the side of the square play area. */
  half: number;
  theme: ArenaTheme;
  blocks: Block[];
  spawns: Spawn[];
  items: { x: number; z: number }[];
  waypoints: { x: number; z: number }[];
  props: Prop[];
}

interface BoxCol {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
}

interface RampCol {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h0: number;
  h1: number;
  dir: Dir;
}

export interface Hit {
  nx: number;
  nz: number;
  depth: number;
}

/** A kart rolls up onto anything this far above it; higher is a wall. */
export const STEP = 0.6;
export const WALL_HEIGHT = 3.6;

export class Arena {
  readonly boxes: BoxCol[] = [];
  readonly ramps: RampCol[] = [];
  /** Visual blocks, including the supports added under free-standing ramp ends. */
  readonly blocks: Block[];

  constructor(readonly def: ArenaDef) {
    const half = def.half;
    const t = WALL_HEIGHT;
    const bound: BoxBlock[] = [
      { kind: "box", x: 0, z: half + 1.5, w: half * 2 + 6, h: t, d: 3 },
      { kind: "box", x: 0, z: -half - 1.5, w: half * 2 + 6, h: t, d: 3 },
      { kind: "box", x: half + 1.5, z: 0, w: 3, h: t, d: half * 2 },
      { kind: "box", x: -half - 1.5, z: 0, w: 3, h: t, d: half * 2 },
    ];
    const blocks: Block[] = [...def.blocks, ...bound];
    // A ramp whose high end hangs in the air gets a support under it, so you
    // meet a wall rather than drive through the wedge from the far side.
    for (const b of def.blocks) {
      if (b.kind !== "ramp" || b.h1 <= STEP) continue;
      const end = rampHighEnd(b);
      const probeX = end.x + end.nx * 0.6;
      const probeZ = end.z + end.nz * 0.6;
      const supported = def.blocks.some((o) => o.kind === "box" && inFootprint(o, probeX, probeZ) && (o.y ?? 0) + o.h >= b.h1 - 0.2);
      if (!supported) {
        const along = b.dir === "+x" || b.dir === "-x";
        blocks.push({
          kind: "box",
          x: end.x + end.nx * 0.5,
          z: end.z + end.nz * 0.5,
          w: along ? 1 : b.w,
          d: along ? b.d : 1,
          h: Math.max(0.2, b.h1 - 0.35),
          color: b.color,
        });
      }
    }
    this.blocks = blocks;
    for (const b of blocks) {
      if (b.kind === "box") {
        const bottom = b.y ?? 0;
        this.boxes.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, bottom, top: bottom + b.h });
      } else {
        this.ramps.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h0: b.h0, h1: b.h1, dir: b.dir });
      }
    }
  }

  get half(): number {
    return this.def.half;
  }

  /** Height of the surface under a thing at (x, z) that is currently at height y. */
  heightAt(x: number, z: number, y: number): number {
    let h = 0;
    const lim = y + STEP;
    for (const r of this.ramps) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      const rh = rampHeight(r, x, z);
      if (rh <= lim && rh > h) h = rh;
    }
    for (const b of this.boxes) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (b.top <= lim && b.top > h) h = b.top;
    }
    return h;
  }

  /**
   * Walls touching a circle of radius r at (x, z) whose body spans y..y+height.
   * Writes push-out normals into out and returns how many.
   */
  collideCircle(x: number, z: number, y: number, r: number, height: number, out: Hit[]): number {
    let n = 0;
    const lim = y + STEP;
    for (const b of this.boxes) {
      if (b.top <= lim || b.bottom >= y + height) continue;
      if (circleVsRect(x, z, r, b.minX, b.maxX, b.minZ, b.maxZ, out, n)) n++;
    }
    for (const rp of this.ramps) {
      // The wedge is a wall wherever it stands taller than you can climb.
      const cx = clamp(x, rp.minX, rp.maxX);
      const cz = clamp(z, rp.minZ, rp.maxZ);
      if (rampHeight(rp, cx, cz) <= lim) continue;
      if (circleVsRect(x, z, r, rp.minX, rp.maxX, rp.minZ, rp.maxZ, out, n)) n++;
    }
    return n;
  }

  /** Is there a wall at this point for a kart at height y? Used by bot feelers. */
  blockedAt(x: number, z: number, y: number): boolean {
    const lim = y + STEP;
    for (const b of this.boxes) {
      if (b.top <= lim || b.bottom >= y + 1) continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
    }
    for (const r of this.ramps) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      if (rampHeight(r, x, z) > lim) return true;
    }
    return false;
  }

  /** Is this point inside something solid, or below the ground? Projectiles die here. */
  solidAt(x: number, y: number, z: number): boolean {
    if (y <= 0) return true;
    if (Math.abs(x) > this.def.half + 3 || Math.abs(z) > this.def.half + 3) return true;
    for (const b of this.boxes) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.bottom && y <= b.top) return true;
    }
    for (const r of this.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y <= rampHeight(r, x, z)) return true;
    }
    return false;
  }

  /** Ground height for something resting on the world, found from high up (the top of whatever is there). */
  topAt(x: number, z: number): number {
    return this.heightAt(x, z, 1000);
  }

  /** The arena's geometry as one group: ground, blocks, boundary and props. */
  build(palette: Palette, quality: "high" | "low"): THREE.Group {
    const g = new THREE.Group();
    const t = this.def.theme;
    const half = this.def.half;

    const groundSize = t.outside === "same" ? 460 : half * 2 + 6;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMaterial(palette, t.ground, t.groundLine, groundSize));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    if (t.outside !== "same") {
      const water = new WaterMaterial(t.outside.color, t.outside.light);
      water.userData.own = true;
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), water);
      sheet.rotation.x = -Math.PI / 2;
      sheet.position.y = t.outside.y;
      g.add(sheet);
      // A concrete lip so the dock reads as a slab over the water.
      const lip = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 6, 1.2, half * 2 + 6), palette.toon(shadeHex(t.wall, -0.25)));
      lip.position.y = -0.6;
      g.add(lip);
    }

    const bound = this.blocks.length - 4;
    const trims = new Map<string, THREE.BufferGeometry[]>();
    const trim = (color: string, geo: THREE.BufferGeometry) => {
      const list = trims.get(color) ?? [];
      list.push(geo);
      trims.set(color, list);
    };
    this.blocks.forEach((b, i) => {
      const isBound = i >= bound;
      if (b.kind === "box") {
        const bottom = b.y ?? 0;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), palette.toon(b.color ?? t.wall));
        mesh.position.set(b.x, bottom + b.h / 2, b.z);
        mesh.castShadow = quality === "high";
        mesh.receiveShadow = true;
        g.add(mesh);
        // A light edge along the top so blocks read crisply at speed.
        if (!isBound && b.h >= 1) {
          const c = shadeHex(b.color ?? t.wall, 0.45);
          const top = bottom + b.h;
          const e = 0.16;
          trim(c, new THREE.BoxGeometry(b.w + e, e, e).translate(b.x, top, b.z - b.d / 2));
          trim(c, new THREE.BoxGeometry(b.w + e, e, e).translate(b.x, top, b.z + b.d / 2));
          trim(c, new THREE.BoxGeometry(e, e, b.d + e).translate(b.x - b.w / 2, top, b.z));
          trim(c, new THREE.BoxGeometry(e, e, b.d + e).translate(b.x + b.w / 2, top, b.z));
        }
        const topColor = isBound ? t.wallStripe : b.top;
        if (topColor) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.14, b.d + 0.02), palette.toon(topColor));
          slab.position.set(b.x, bottom + b.h + 0.07, b.z);
          slab.receiveShadow = true;
          g.add(slab);
        }
        if (b.strip) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.18, b.d + 0.1), palette.unlit(b.strip));
          strip.position.set(b.x, bottom + b.h - 0.3, b.z);
          g.add(strip);
        }
      } else {
        const mesh = new THREE.Mesh(wedgeGeometry(b.w, b.d, b.h0, b.h1), palette.toon(b.color ?? t.rampColor));
        mesh.position.set(b.x, 0, b.z);
        mesh.rotation.y = dirYaw(b.dir);
        mesh.castShadow = quality === "high";
        mesh.receiveShadow = true;
        g.add(mesh);
        // Side rails so the edge reads at speed.
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, b.d), palette.toon(t.wallStripe));
        const railL = rail;
        const railR = rail.clone();
        const run = (pos: THREE.Mesh, side: number) => {
          pos.position.set(side * (b.w / 2 - 0.12), 0, 0);
          pos.rotation.x = -Math.atan2(b.h1 - b.h0, b.d);
          pos.position.y = (b.h0 + b.h1) / 2 + 0.15;
          pos.scale.z = Math.hypot(b.d, b.h1 - b.h0) / b.d;
          mesh.add(pos);
        };
        run(railL, -1);
        run(railR, 1);
      }
    });

    for (const [color, geos] of trims) {
      const merged = mergeGeometries(geos);
      for (const geo of geos) geo.dispose();
      if (!merged) continue;
      const m = new THREE.Mesh(merged, palette.toon(color));
      m.receiveShadow = true;
      g.add(m);
    }

    for (const p of this.def.props) g.add(buildProp(p, t, palette, quality));
    return g;
  }
}

function inFootprint(b: BoxBlock, x: number, z: number): boolean {
  return x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && z >= b.z - b.d / 2 && z <= b.z + b.d / 2;
}

/** Centre of the ramp's high edge and the outward normal there. */
function rampHighEnd(b: RampBlock): { x: number; z: number; nx: number; nz: number } {
  switch (b.dir) {
    case "+x":
      return { x: b.x + b.w / 2, z: b.z, nx: 1, nz: 0 };
    case "-x":
      return { x: b.x - b.w / 2, z: b.z, nx: -1, nz: 0 };
    case "+z":
      return { x: b.x, z: b.z + b.d / 2, nx: 0, nz: 1 };
    case "-z":
      return { x: b.x, z: b.z - b.d / 2, nx: 0, nz: -1 };
  }
}

export function rampHeight(r: RampCol, x: number, z: number): number {
  let t: number;
  switch (r.dir) {
    case "+x":
      t = (x - r.minX) / (r.maxX - r.minX);
      break;
    case "-x":
      t = (r.maxX - x) / (r.maxX - r.minX);
      break;
    case "+z":
      t = (z - r.minZ) / (r.maxZ - r.minZ);
      break;
    case "-z":
      t = (r.maxZ - z) / (r.maxZ - r.minZ);
      break;
  }
  return r.h0 + (r.h1 - r.h0) * clamp(t, 0, 1);
}

export function dirYaw(dir: Dir): number {
  switch (dir) {
    case "+z":
      return 0;
    case "+x":
      return Math.PI / 2;
    case "-z":
      return Math.PI;
    case "-x":
      return -Math.PI / 2;
  }
}

function circleVsRect(x: number, z: number, r: number, minX: number, maxX: number, minZ: number, maxZ: number, out: Hit[], n: number): boolean {
  const cx = clamp(x, minX, maxX);
  const cz = clamp(z, minZ, maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  const hit = (out[n] ??= { nx: 0, nz: 0, depth: 0 });
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    hit.nx = dx / d;
    hit.nz = dz / d;
    hit.depth = r - d;
  } else {
    // Centre inside: leave through the nearest face.
    const l = x - minX;
    const rt = maxX - x;
    const b = z - minZ;
    const f = maxZ - z;
    const m = Math.min(l, rt, b, f);
    if (m === l) (hit.nx = -1), (hit.nz = 0);
    else if (m === rt) (hit.nx = 1), (hit.nz = 0);
    else if (m === b) (hit.nx = 0), (hit.nz = -1);
    else (hit.nx = 0), (hit.nz = 1);
    hit.depth = m + r;
  }
  return true;
}

/** A wedge of width w (x), depth d (z) rising from h0 at z = -d/2 to h1 at z = +d/2. */
export function wedgeGeometry(w: number, d: number, h0: number, h1: number): THREE.BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  const v = [
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [hw, 0, hd],
    [-hw, 0, hd],
    [-hw, h0, -hd],
    [hw, h0, -hd],
    [hw, h1, hd],
    [-hw, h1, hd],
  ];
  const center = [0, (h0 + h1) / 4, 0];
  const pos: number[] = [];
  const quad = (a: number, b: number, c: number, e: number) => {
    const pa = v[a], pb = v[b], pc = v[c], pe = v[e];
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const fx = (pa[0] + pb[0] + pc[0] + pe[0]) / 4 - center[0];
    const fy = (pa[1] + pb[1] + pc[1] + pe[1]) / 4 - center[1];
    const fz = (pa[2] + pb[2] + pc[2] + pe[2]) / 4 - center[2];
    const flip = nx * fx + ny * fy + nz * fz < 0;
    const tri = (p: number[], q: number[], s: number[]) => (flip ? pos.push(...p, ...s, ...q) : pos.push(...p, ...q, ...s));
    tri(pa, pb, pc);
    tri(pa, pc, pe);
  };
  quad(4, 5, 6, 7); // slope
  quad(0, 1, 5, 4); // low end
  quad(3, 2, 6, 7); // high end
  quad(0, 3, 7, 4); // left
  quad(1, 2, 6, 5); // right
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Flat ground with a faint tile grid, drawn once to a canvas and repeated. */
function groundMaterial(palette: Palette, color: string, line: string, size: number): THREE.MeshToonMaterial {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = line;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillRect(0, 0, 6, 256);
  ctx.globalAlpha = 0.18;
  ctx.fillRect(128, 0, 3, 256);
  ctx.fillRect(0, 128, 256, 3);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const tile = 8;
  tex.repeat.set(size / tile, size / tile);
  const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: palette.gradient });
  return m;
}
