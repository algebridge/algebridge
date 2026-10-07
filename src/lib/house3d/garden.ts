/**
 * The garden behind the house, in 3D: the yard you see from the back door.
 *
 * It is the same house seen from behind. The back wall is built in the house
 * style's own material (plaster, logs, brick, bamboo or stone) with its back
 * door, windows, gutter, and a tap with a hose. A mown lawn runs out from it,
 * a cedar fence closes the sides, stepping stones lead from the back door,
 * and the garden grows as the student learns (lib/garden.ts):
 *
 * - a cedar raised bed holds one plant for every unit of the course, each in
 *   its unit's colour, coming up by how much of the unit is finished: a seed
 *   under a mound of soil, a sprout, leaves, a bud, then the flower of its
 *   kind in full bloom;
 * - a tree grows with the whole course: a tire swing hangs from it at
 *   halfway, a birdhouse goes up at three quarters, a treehouse at the end;
 * - on a day with a right answer, the sprinkler runs and the soil is wet.
 *
 * World: metres, x east, y up, z south (towards the camera). The lawn is
 * 14 m square on the origin, its top at y = 0, and the house's back wall
 * stands along its far edge. An ornament stored at (x, z north) stands at
 * world (x, 0, -z); ornaments are the engine's to place, not built here.
 *
 * Everything is built from the kit (lib/house3d/kit.ts). Surfaces the kit has
 * no texture for (grass, soil, bark, leaves, shingles, fence boards) are
 * painted here once, in code, with a fixed seed, and shared by every build.
 */

import * as THREE from "three";
import { canvasTexture, TEX, type Kit, type V3 } from "./kit";
import { themeFor, type RoomTheme, type WallKind, type WindowShape } from "./themes";
import type { ItemModel } from "./types";
import type { Flower, GardenBed, GardenState } from "@/lib/garden";

type Pt = [number, number];
const PI = Math.PI;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Where the garden's fixed parts stand, in world metres, so the engine can fit its camera and keep ornaments off them. */
export const GARDEN_LAYOUT = {
  /** The lawn runs from -half to +half in x and z; its top is y = 0. */
  half: 7,
  /** The face of the house's back wall, how wide the house is, and the height of its eaves and ridge. */
  wallZ: -7.2,
  houseWidth: 11,
  houseDepth: 7.6,
  eave: 5.8,
  ridge: 8.7,
  /** The back door's middle (x). */
  doorX: 1.0,
  /** The raised bed: its middle, length along x and width along z. */
  bed: { x: 1.3, z: 1.5, length: 6.4, width: 1.25 },
  /** The garden tree's trunk; the full-grown crown reaches about 3 m round it and 7 m up. */
  tree: { x: -4.4, z: -2.4 },
  /** The sprinkler, behind the bed. */
  sprinkler: { x: 2.9, z: -0.45 },
  /** The fence along the sides (x = ±fenceX) and its height. */
  fenceX: 7,
  fenceHeight: 1.78,
} as const;

const L = GARDEN_LAYOUT;
const HOUSE = { w: L.houseWidth, d: L.houseDepth, eave: L.eave, plinth: 0.32, t: 0.3 };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** A fixed random source, so the garden looks the same on every load. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** A shape built along y, stood between a and b: its middle, length and turn. */
function between(a: V3, b: V3): { at: V3; len: number; rot: V3 } {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  const m = va.add(vb).multiplyScalar(0.5);
  return { at: [m.x, m.y, m.z], len, rot: [e.x, e.y, e.z] };
}

/** A round rod from a to b, r0 thick at a and r1 at b: a stem, a branch, a rope. */
function rod(k: Kit, a: V3, b: V3, r0: number, r1: number, m: THREE.Material, seg = 10): THREE.Mesh {
  const s = between(a, b);
  return k.cyl(r1, r0, s.len, m, { at: s.at, rot: s.rot, seg });
}

/** A board from a to b, `w` wide and `t` thick, its broad face turned towards `face`; the grain runs along it. */
function board(k: Kit, a: V3, b: V3, w: number, t: number, m: THREE.Material, face: V3 = [0, 0, 1], r = 0.004): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const x = vb.clone().sub(va);
  const len = x.length();
  x.normalize();
  const f = new THREE.Vector3(...face);
  let z = f.clone().sub(x.clone().multiplyScalar(f.dot(x)));
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(0, 0, 1).sub(x.clone().multiplyScalar(x.z));
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z), "XYZ");
  const mid = va.add(vb).multiplyScalar(0.5);
  return k.box(len, w, t, m, { at: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z], r });
}

/** Turns an object: heading `yaw` round y (0 faces +z), tipped by `pitch` (negative lifts its +z end), twisted `roll` about its length. */
function aim<T extends THREE.Object3D>(o: T, yaw: number, pitch: number, roll = 0): T {
  o.rotation.set(pitch, yaw, roll, "YXZ");
  return o;
}

/** One leaf from its base: `len` long, `wid` wide, heading `yaw`, lifted `lift` above flat. */
function leafAt(k: Kit, m: THREE.Material, base: V3, len: number, wid: number, yaw: number, lift: number, roll = 0): THREE.Object3D {
  const blade = k.sphere(1, m, { at: [0, 0, len * 0.5], scale: [wid * 0.5, Math.max(0.0022, wid * 0.07), len * 0.5], seg: 12 });
  return aim(k.group([blade], { at: base }), yaw, -lift, roll);
}

/** A long leaf that rises from its base and bends over at the tip, like a tulip's. */
function strapLeaf(k: Kit, m: THREE.Material, base: V3, len: number, wid: number, yaw: number, lift: number, bend: number): THREE.Object3D {
  const h = len * 0.55;
  const lower = k.sphere(1, m, { at: [0, 0, h * 0.5], scale: [wid * 0.5, Math.max(0.0025, wid * 0.08), h * 0.56], seg: 12 });
  const upper = k.sphere(1, m, { at: [0, 0, (len - h) * 0.5], scale: [wid * 0.42, Math.max(0.0022, wid * 0.07), (len - h) * 0.58], seg: 12 });
  const tip = k.group([upper], { at: [0, 0, h * 0.94] });
  tip.rotation.x = bend;
  return aim(k.group([lower, tip], { at: base }), yaw, -lift);
}

/** A ring of `n` petals round a middle, flat, facing +z: rounded tips (a daisy) or pointed (a sunflower). */
function petalOutline(n: number, rIn: number, rOut: number, tip: "round" | "point"): Pt[] {
  const pts: Pt[] = [];
  const steps = n * 10;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * PI * 2;
    const ph = ((a * n) / (PI * 2)) % 1;
    const d = Math.min(ph, 1 - ph) * 2;
    const f = tip === "point" ? Math.pow(1 - d, 1.35) : Math.pow(Math.cos((d * PI) / 2), 2.2);
    const r = rIn + (rOut - rIn) * f;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** A window's or door's outline, centred on its middle. */
function openingOutline(shape: WindowShape, w: number, h: number): Pt[] {
  if (shape === "round") {
    const r = Math.min(w, h) / 2;
    return Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });
  }
  if (shape === "arch") {
    const r = w / 2;
    const pts: Pt[] = [
      [-r, -h / 2],
      [r, -h / 2],
      [r, h / 2 - r],
    ];
    for (let i = 1; i < 20; i += 1) {
      const a = (i / 20) * PI;
      pts.push([Math.cos(a) * r, h / 2 - r + Math.sin(a) * r]);
    }
    pts.push([-r, h / 2 - r]);
    return pts;
  }
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
}

const shift = (pts: Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy] as Pt);

/** Whether two segments cross (touching ends do not count). */
function crosses(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Whether an outline crosses itself, which would tear its triangles. */
function tangled(pts: Pt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i += 1)
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  return false;
}

type LeafShape = "lance" | "broad" | "needle" | "toothed" | "strap";

/**
 * Leaves fanned out from one base in an upright plane, like a hand: `n`
 * leaves about `len` long and `wid` wide, spread over `spread` radians and
 * arching outwards by `arch`. One flat mesh carries the whole fan, and three
 * crossed make a clump. The leaves are narrowed until none overlaps another.
 */
function fanOutline(n: number, len: number, wid: number, spread: number, arch: number, seed: number, shape: LeafShape = "lance"): Pt[] {
  const steps = shape === "toothed" ? 14 : 9;
  const width = (t: number) => {
    if (shape === "broad") return Math.pow(Math.sin(PI * Math.pow(t, 0.62)), 0.9);
    if (shape === "needle") return Math.pow(Math.sin(PI * Math.pow(t, 0.5)), 0.6) * (1 - t * 0.5);
    if (shape === "strap") return Math.pow(Math.sin(PI * Math.pow(t, 0.7)), 0.5);
    return Math.pow(Math.sin(PI * Math.pow(t, 0.85)), 1.1);
  };
  let w = wid;
  let pts: Pt[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rnd = rng(seed);
    const base = wid * (shape === "broad" ? 0.55 : 0.2) * (n - 1);
    pts = [[-base / 2 - wid * 0.12, 0]];
    for (let i = 0; i < n; i += 1) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const a0 = (f - 0.5) * spread + (rnd() - 0.5) * (spread / n) * 0.3;
      const l = len * (0.84 + rnd() * 0.28) * (1 - Math.abs(f - 0.5) * 0.28);
      const bend = (Math.abs(a0) < 0.05 ? (rnd() - 0.5) * 0.3 : Math.sign(a0)) * arch * (0.75 + rnd() * 0.5);
      const line: [number, number, number][] = [];
      let x = (f - 0.5) * base;
      let y = 0;
      for (let j = 0; j <= steps; j += 1) {
        const a = a0 + bend * (j / steps) * (j / steps);
        line.push([x, y, a]);
        x += Math.sin(a) * (l / steps);
        y += Math.cos(a) * (l / steps);
      }
      const edge = (side: number, j: number): Pt => {
        const [cx, cy, a] = line[j];
        let half = (w * width(j / steps)) / 2;
        if (shape === "toothed" && j > 1 && j < steps) half *= j % 2 ? 1.28 : 0.78;
        return [cx - side * Math.cos(a) * half, cy + side * Math.sin(a) * half];
      };
      for (let j = 1; j < steps; j += 1) pts.push(edge(1, j));
      pts.push([line[steps][0], line[steps][1]]);
      for (let j = steps - 1; j >= 1; j -= 1) pts.push(edge(-1, j));
    }
    pts.push([base / 2 + wid * 0.12, 0]);
    if (!tangled(pts)) break;
    w *= 0.82;
  }
  return pts;
}

/** A clump of leaves: `fans` fans crossed round the base, `yaw` turning the first. */
function clump(k: Kit, m: THREE.Material, outline: Pt[], fans: number, yaw: number, lean = 0): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < fans; i += 1) {
    const f = k.extrude(outline, 0.003, m, { bevel: 0.0008 });
    aim(f, yaw + (i / fans) * PI, lean * (i % 2 ? 1 : -1));
    g.add(f);
  }
  return g;
}

/** Materials made for one build, by name, so it makes each only once. */
interface Ctx {
  k: Kit;
  cache: Map<string, THREE.Material>;
}

function once<T extends THREE.Material>(c: Ctx, key: string, make: () => T): T {
  let m = c.cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    c.cache.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Painted surfaces
// ---------------------------------------------------------------------------

const painted = new Map<string, THREE.Texture>();

/**
 * A surface painted once and reused. Each call hands back its own copy of
 * the texture, sharing the one picture, so a build frees only what it took.
 */
function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.Texture {
  let t = painted.get(key);
  if (!t) {
    t = canvasTexture(w, h, draw);
    painted.set(key, t);
  }
  const copy = t.clone();
  if (repeat) {
    copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
    copy.repeat.set(repeat[0], repeat[1]);
  }
  return copy;
}

/** Draws `fn` at (x, y) and again across each edge it comes near, so a tiling picture has no seams. */
function wrapped(w: number, h: number, x: number, y: number, reach: number, fn: (x: number, y: number) => void) {
  for (const dx of [-w, 0, w])
    for (const dy of [-h, 0, h]) {
      const px = x + dx;
      const py = y + dy;
      if (px > -reach && px < w + reach && py > -reach && py < h + reach) fn(px, py);
    }
}

/** Mown grass for the whole lawn in one picture: stripes, patches, clover, dry bits, thinner by the fence and the wall. */
function drawLawn(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(7);
  g.fillStyle = "#4f6d33";
  g.fillRect(0, 0, w, h);
  // Broad patches, a little lusher here and drier there.
  const patch = ["86,116,56", "68,98,44", "108,122,60", "56,84,40", "96,110,52", "78,104,48"];
  for (let i = 0; i < 520; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 30 + rnd() * 200;
    const c = patch[Math.floor(rnd() * patch.length)];
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${c},${0.14 + rnd() * 0.2})`);
    grad.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Mowing stripes: the mower went up and down, so alternate bands lean the grass two ways.
  const bands = 14;
  for (let b = 0; b < bands; b += 1) {
    g.fillStyle = b % 2 ? "rgba(222,236,168,0.06)" : "rgba(8,26,4,0.06)";
    g.fillRect((b * w) / bands, 0, w / bands + 1, h);
  }
  // Blades: short strokes every way, dark ones in the shade between, light tips on top.
  const tones = ["#26401a", "#334f21", "#41602a", "#4f7232", "#5f843b", "#729848", "#88a955", "#a2b866"];
  const counts = [34000, 38000, 38000, 32000, 22000, 11000, 4000, 1000];
  g.lineCap = "round";
  tones.forEach((tone, ti) => {
    g.strokeStyle = tone;
    g.lineWidth = ti < 3 ? 1.7 : 1.25;
    g.globalAlpha = 0.5 + ti * 0.055;
    g.beginPath();
    for (let i = 0; i < counts[ti]; i += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      const a = rnd() * PI * 2;
      const l = 2 + rnd() * 4.5;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.8);
    }
    g.stroke();
  });
  g.globalAlpha = 1;
  // Clover in drifts, with a few white heads.
  for (let i = 0; i < 70; i += 1) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const n = 6 + Math.floor(rnd() * 14);
    for (let j = 0; j < n; j += 1) {
      const x = cx + (rnd() - 0.5) * 50;
      const y = cy + (rnd() - 0.5) * 50;
      g.fillStyle = `rgba(${52 + rnd() * 20},${92 + rnd() * 20},${42 + rnd() * 10},0.9)`;
      for (let l = 0; l < 3; l += 1) {
        const a = (l / 3) * PI * 2 + rnd();
        g.beginPath();
        g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.3, 0, PI * 2);
        g.fill();
      }
    }
    if (rnd() < 0.55) {
      g.fillStyle = "rgba(240,238,226,0.9)";
      g.beginPath();
      g.arc(cx + (rnd() - 0.5) * 30, cy + (rnd() - 0.5) * 30, 2.8, 0, PI * 2);
      g.fill();
    }
  }
  // Dry bits of thatch.
  g.strokeStyle = "rgba(150,140,92,0.35)";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 2600; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const a = rnd() * PI;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
  }
  g.stroke();
  // Thinner and darker in the shade along the fence and under the wall.
  const edge = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(30,40,20,${a})`);
    grad.addColorStop(1, "rgba(30,40,20,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  };
  edge(0, 0, 90, 0, 0.32);
  edge(w, 0, w - 90, 0, 0.32);
  edge(0, 0, 0, 110, 0.4);
}

/** Rougher grass beyond the fence: the neighbours' yards and the field past them. */
function drawFarGrass(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(9);
  g.fillStyle = "#54703a";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 20 + rnd() * 90;
    const c = ["90,112,58", "70,96,46", "112,118,66"][Math.floor(rnd() * 3)];
    wrapped(w, h, x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${c},0.3)`);
      grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  const tones = ["#2f4a20", "#3f5e29", "#56763a", "#6e8c45", "#8d9c56"];
  tones.forEach((tone) => {
    g.strokeStyle = tone;
    g.lineWidth = 1.4;
    g.globalAlpha = 0.6;
    g.beginPath();
    for (let i = 0; i < 9000; i += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      const a = rnd() * PI * 2;
      const l = 3 + rnd() * 8;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
  });
  g.globalAlpha = 1;
}

/** Garden soil: crumbs, clods, a few pebbles and bits of straw. */
function drawSoil(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(31);
  g.fillStyle = "#4a3628";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 3 + rnd() * 14;
    const c = rnd() < 0.5 ? "34,24,16" : "98,76,56";
    wrapped(w, h, x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${c},${0.25 + rnd() * 0.3})`);
      grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  const crumbs = ["#2a1d14", "#3a2a1e", "#5c4532", "#6e5640", "#7d6550"];
  for (let i = 0; i < 9000; i += 1) {
    g.fillStyle = crumbs[Math.floor(rnd() * crumbs.length)];
    g.globalAlpha = 0.5 + rnd() * 0.45;
    const s = 1 + rnd() * 2.6;
    g.fillRect(rnd() * w, rnd() * h, s, s);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 120; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 1.5 + rnd() * 3.5;
    const v = 120 + rnd() * 80;
    g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * PI, 0, PI * 2);
    g.fill();
    g.strokeStyle = "rgba(20,14,10,0.5)";
    g.lineWidth = 1;
    g.stroke();
  }
  g.strokeStyle = "rgba(170,140,90,0.6)";
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i < 90; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const a = rnd() * PI;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (6 + rnd() * 8), y + Math.sin(a) * (6 + rnd() * 8));
  }
  g.stroke();
}

/** Bark mulch: chips of shredded bark, every shade of brown. */
function drawMulch(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(37);
  g.fillStyle = "#2e1f15";
  g.fillRect(0, 0, w, h);
  const tones = ["#4a2f1d", "#5a3a24", "#6e4a2e", "#7d5636", "#8a6240", "#3c271a"];
  for (let i = 0; i < 2600; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const l = 6 + rnd() * 16;
    const t = 2.5 + rnd() * 5;
    const a = rnd() * PI;
    const tone = tones[Math.floor(rnd() * tones.length)];
    wrapped(w, h, x, y, l, (px, py) => {
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = tone;
      g.fillRect(-l / 2, -t / 2, l, t);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-l / 2, t / 2 - 1, l, 1);
      g.restore();
    });
  }
}

/** Pea gravel along the foot of the wall. */
function drawGravel(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(41);
  g.fillStyle = "#6f6a62";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3400; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 2.5 + rnd() * 4.5;
    const v = 120 + rnd() * 90;
    const warm = rnd() * 18;
    wrapped(w, h, x, y, r + 2, (px, py) => {
      g.fillStyle = "rgba(30,28,24,0.45)";
      g.beginPath();
      g.ellipse(px + 1, py + 1.2, r, r * 0.8, 0, 0, PI * 2);
      g.fill();
      g.fillStyle = `rgb(${v + warm},${v + warm * 0.6},${v - 4})`;
      g.beginPath();
      g.ellipse(px, py, r, r * 0.8, rnd() * PI, 0, PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.beginPath();
      g.ellipse(px - r * 0.3, py - r * 0.3, r * 0.35, r * 0.25, 0, 0, PI * 2);
      g.fill();
    });
  }
}

/** Bark: fissures running up the trunk, ridges between, a little lichen. Grey-brown, tinted by the material. */
function drawBark(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(61);
  g.fillStyle = "#8a7e72";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 8 + rnd() * 40;
    const c = rnd() < 0.5 ? "60,52,44" : "150,140,126";
    wrapped(w, h, x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${c},0.3)`);
      grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  const crack = (x0: number, width: number, color: string) => {
    for (const dx of [-w, 0, w]) {
      let x = x0 + dx;
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, -10);
      for (let y = 0; y <= h + 16; y += 14) {
        x += (rnd() - 0.5) * 7;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  for (let i = 0; i < 30; i += 1) crack(rnd() * w, 2 + rnd() * 5, `rgba(28,22,18,${0.55 + rnd() * 0.35})`);
  for (let i = 0; i < 22; i += 1) crack(rnd() * w, 1 + rnd() * 2, `rgba(190,180,164,${0.2 + rnd() * 0.25})`);
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    g.fillStyle = `rgba(${150 + rnd() * 30},${165 + rnd() * 30},${130 + rnd() * 20},0.35)`;
    g.beginPath();
    g.ellipse(x, y, 3 + rnd() * 8, 2 + rnd() * 5, rnd() * PI, 0, PI * 2);
    g.fill();
  }
}

/**
 * Leaves for a crown or a shrub, on a clear ground so the gaps between them
 * are holes: a shape made of these has a leafy edge and casts dappled shade.
 * Near grey, so the material's colour makes them a maple's, a box's or an
 * autumn red.
 */
function drawFoliage(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(53);
  g.clearRect(0, 0, w, h);
  const leaf = (x: number, y: number, len: number, wid: number, a: number, fill: string) => {
    wrapped(w, h, x, y, len, (px, py) => {
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(-len / 2, 0);
      g.quadraticCurveTo(0, -wid, len / 2, 0);
      g.quadraticCurveTo(0, wid, -len / 2, 0);
      g.fill();
      g.restore();
    });
  };
  // Deep leaves first, the lit ones over them.
  const layers: [number, number, number][] = [
    [1300, 70, 110],
    [1200, 120, 175],
    [900, 175, 240],
  ];
  for (const [n, lo, hi] of layers)
    for (let i = 0; i < n; i += 1) {
      const v = lo + rnd() * (hi - lo);
      const len = 12 + rnd() * 14;
      leaf(rnd() * w, rnd() * h, len, len * (0.32 + rnd() * 0.16), rnd() * PI, `rgb(${Math.round(v * 0.93)},${Math.round(v)},${Math.round(v * 0.8)})`);
    }
}

/** A clipped box hedge: tiny leaves packed tight, no gaps. Near grey, tinted by the material. */
function drawBoxwood(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(59);
  g.fillStyle = "#3a4436";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i += 1) {
    const v = 90 + rnd() * 150;
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 5 + rnd() * 5;
    const a = rnd() * PI;
    wrapped(w, h, x, y, len, (px, py) => {
      g.fillStyle = `rgb(${Math.round(v * 0.92)},${Math.round(v)},${Math.round(v * 0.82)})`;
      g.beginPath();
      g.ellipse(px, py, len / 2, len / 4, a, 0, PI * 2);
      g.fill();
    });
  }
}

/** Three-tab shingles, grey to be tinted: rows of tabs with their slots, each row's edge shadowing the one below. */
function drawShingles(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(71);
  const rows = 8;
  const rowH = h / rows;
  const tabW = w / 4;
  g.fillStyle = "#3c3c3c";
  g.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r += 1) {
    const off = (r % 2) * (tabW / 2) + (r % 3) * 9;
    for (let i = -1; i < 5; i += 1) {
      const x = i * tabW + off;
      const v = 132 + rnd() * 64;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 2, r * rowH, tabW - 4, rowH);
      for (let j = 0; j < 320; j += 1) {
        const s = 70 + rnd() * 150;
        g.fillStyle = `rgba(${s},${s},${s},0.35)`;
        g.fillRect(x + 2 + rnd() * (tabW - 4), r * rowH + rnd() * rowH, 1.6, 1.6);
      }
    }
    // The butt edge of this row, and its shadow on the row below.
    const y = (r + 1) * rowH;
    g.fillStyle = "rgba(20,20,20,0.75)";
    g.fillRect(0, (y - 2 + h) % h, w, 2);
    const grad = g.createLinearGradient(0, y % h, 0, (y % h) + 9);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, y % h, w, 9);
  }
}

/** Standing-seam metal: wide pans between raised seams. */
function drawSeams(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(73);
  const pans = 4;
  const pw = w / pans;
  for (let i = 0; i < pans; i += 1) {
    const v = 200 + rnd() * 20;
    const grad = g.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
    grad.addColorStop(0, `rgb(${v - 30},${v - 28},${v - 24})`);
    grad.addColorStop(0.1, `rgb(${v},${v + 2},${v + 4})`);
    grad.addColorStop(0.9, `rgb(${v - 8},${v - 6},${v - 3})`);
    grad.addColorStop(1, `rgb(${v - 40},${v - 38},${v - 34})`);
    g.fillStyle = grad;
    g.fillRect(i * pw, 0, pw, h);
    g.fillStyle = "rgba(255,255,255,0.65)";
    g.fillRect(i * pw, 0, 3, h);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(i * pw + 3, 0, 2, h);
  }
  for (let i = 0; i < 400; i += 1) {
    g.fillStyle = `rgba(90,90,90,${rnd() * 0.06})`;
    g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 30, 1);
  }
}

/** Cedar fence boards standing side by side, each its own tone, with grain, knots and the gaps between. */
function drawFenceBoards(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(79);
  const n = 6;
  const bw = w / n;
  for (let i = 0; i < n; i += 1) {
    const x0 = i * bw;
    const base = new THREE.Color("#b98458").multiplyScalar(0.8 + rnd() * 0.28);
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(x0, 0, bw, h);
    // Grain running up the board.
    for (let j = 0; j < 26; j += 1) {
      let x = x0 + rnd() * bw;
      const d = Math.round(80 + rnd() * 60);
      g.strokeStyle = `rgba(${d},${d - 30},${d - 50},${0.1 + rnd() * 0.22})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 24) {
        x += (rnd() - 0.5) * 2.2;
        x = Math.max(x0 + 1, Math.min(x0 + bw - 1, x));
        g.lineTo(x, y);
      }
      g.stroke();
    }
    if (rnd() < 0.6) {
      const kx = x0 + bw * (0.25 + rnd() * 0.5);
      const ky = rnd() * h;
      for (let r = 9; r > 0; r -= 3) {
        g.strokeStyle = `rgba(70,40,24,${0.25 + (9 - r) * 0.05})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(kx, ky, r * 0.8, r * 1.5, 0, 0, PI * 2);
        g.stroke();
      }
      g.fillStyle = "rgba(60,34,20,0.75)";
      g.beginPath();
      g.ellipse(kx, ky, 2.5, 4, 0, 0, PI * 2);
      g.fill();
    }
    // The gap to the next board, and a soft shade beside it.
    g.fillStyle = "rgba(34,22,14,0.9)";
    g.fillRect(x0, 0, 3, h);
    const sh = g.createLinearGradient(x0 + 3, 0, x0 + 12, 0);
    sh.addColorStop(0, "rgba(0,0,0,0.22)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh;
    g.fillRect(x0 + 3, 0, 9, h);
  }
  // Weathered darker at the foot, where the rain splashes.
  const foot = g.createLinearGradient(0, h, 0, h * 0.8);
  foot.addColorStop(0, "rgba(40,30,20,0.35)");
  foot.addColorStop(1, "rgba(40,30,20,0)");
  g.fillStyle = foot;
  g.fillRect(0, h * 0.8, w, h * 0.2);
}

/** What you see through a window: a dim room by day, a lamp-lit one at night. */
function drawInterior(night: boolean) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    if (night) {
      const grad = g.createRadialGradient(w * 0.55, h * 0.3, 10, w * 0.5, h * 0.45, w * 0.8);
      grad.addColorStop(0, "#ffe2b0");
      grad.addColorStop(0.45, "#f0b46e");
      grad.addColorStop(1, "#8a5228");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(60,30,12,0.45)";
      g.fillRect(0, h * 0.78, w, h * 0.22);
    } else {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#1f1d1b");
      grad.addColorStop(0.5, "#3a3530");
      grad.addColorStop(1, "#2a2622");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      // The far wall of the room, a little lighter, and a picture on it.
      g.fillStyle = "rgba(200,190,170,0.12)";
      g.fillRect(w * 0.15, h * 0.12, w * 0.7, h * 0.6);
      g.fillStyle = "rgba(20,18,16,0.5)";
      g.fillRect(w * 0.4, h * 0.25, w * 0.22, h * 0.16);
    }
  };
}

/** The sky all round, with a soft line of distant trees on the horizon: day blue with clouds, or night with stars and the moon. */
function drawSky(night: boolean) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const rnd = rng(night ? 83 : 89);
    const horizon = h / 2;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    if (night) {
      sky.addColorStop(0, "#04081a");
      sky.addColorStop(0.55, "#0b1530");
      sky.addColorStop(0.9, "#1a2747");
      sky.addColorStop(1, "#24324f");
    } else {
      sky.addColorStop(0, "#4f86c9");
      sky.addColorStop(0.5, "#7fa9dc");
      sky.addColorStop(0.85, "#bcd3ea");
      sky.addColorStop(1, "#dfe8ee");
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon + 2);
    g.fillStyle = night ? "#0a0f0c" : "#4b5a3e";
    g.fillRect(0, horizon, w, h - horizon);
    if (night) {
      for (let i = 0; i < 900; i += 1) {
        const y = rnd() * horizon * 0.9;
        const a = 0.25 + rnd() * 0.7;
        g.fillStyle = `rgba(255,255,255,${a})`;
        const s = rnd() < 0.08 ? 2 : 1.2;
        g.fillRect(rnd() * w, y, s, s);
      }
      // The moon, low in the south-west, with its halo.
      const mx = w * 0.3;
      const my = horizon * 0.62;
      const halo = g.createRadialGradient(mx, my, 6, mx, my, 120);
      halo.addColorStop(0, "rgba(220,228,255,0.45)");
      halo.addColorStop(1, "rgba(220,228,255,0)");
      g.fillStyle = halo;
      g.fillRect(mx - 120, my - 120, 240, 240);
      g.fillStyle = "#f4f1e4";
      g.beginPath();
      g.arc(mx, my, 11, 0, PI * 2);
      g.fill();
    } else {
      g.filter = "blur(14px)";
      for (let i = 0; i < 46; i += 1) {
        const x = rnd() * w;
        const y = horizon * (0.25 + rnd() * 0.6);
        const cw = 60 + rnd() * 160;
        g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.4})`;
        for (let j = 0; j < 4; j += 1) {
          g.beginPath();
          g.ellipse(x + (rnd() - 0.5) * cw, y + (rnd() - 0.5) * 12, cw * (0.3 + rnd() * 0.3), 10 + rnd() * 14, 0, 0, PI * 2);
          g.fill();
        }
      }
      g.filter = "none";
    }
    // Distant trees, soft as if out of focus, bluer the further they are.
    const rows: [number, number, string, number][] = night
      ? [
          [0.02, 34, "#0d1620", 3],
          [0.0, 24, "#0a120f", 2],
        ]
      : [
          [0.02, 34, "#7d9283", 3],
          [0.0, 24, "#5d7458", 2],
        ];
    for (const [lift, size, color, blur] of rows) {
      g.filter = `blur(${blur}px)`;
      g.fillStyle = color;
      const base = horizon - lift * h;
      g.fillRect(0, base - 4, w, h - base + 4);
      for (let x = -20; x < w + 20; x += size * (0.45 + rnd() * 0.5)) {
        const r = size * (0.55 + rnd() * 0.75);
        g.beginPath();
        g.ellipse(x, base - r * 0.55, r * 0.75, r, 0, 0, PI * 2);
        g.fill();
      }
      g.filter = "none";
    }
  };
}

/** Spruce needles in sprays along their twigs, on a clear ground. Grey-green, tinted by the material. */
function drawNeedles(g: CanvasRenderingContext2D, w: number, h: number) {
  const rnd = rng(67);
  g.clearRect(0, 0, w, h);
  g.lineCap = "round";
  for (let i = 0; i < 520; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 26 + rnd() * 30;
    const a = PI / 2 + (rnd() - 0.5) * 0.9;
    const v = Math.round(90 + rnd() * 140);
    wrapped(w, h, x, y, len + 10, (px, py) => {
      g.strokeStyle = `rgb(${Math.round(v * 0.9)},${v},${Math.round(v * 0.92)})`;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let j = 0; j < 12; j += 1) {
        const t = j / 12;
        const cx = px + Math.cos(a) * len * t;
        const cy = py + Math.sin(a) * len * t;
        for (const sd of [-1, 1]) {
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a + sd * 0.9) * 7 * (1 - t * 0.5), cy + Math.sin(a + sd * 0.9) * 7 * (1 - t * 0.5));
        }
      }
      g.stroke();
    });
  }
}

/** The neighbourhood all round, soft as if out of focus: rows of trees, a few roofs between, on a clear sky. */
function drawTreeline(night: boolean) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const rnd = rng(night ? 131 : 137);
    g.clearRect(0, 0, w, h);
    const base = h * 0.97;
    const crowns = (n: number, lo: number, hi: number, color: string, blur: number) => {
      g.filter = `blur(${blur}px)`;
      g.fillStyle = color;
      for (let i = 0; i < n; i += 1) {
        const x = rnd() * w;
        const top = base - (lo + rnd() * (hi - lo)) * h;
        const r = (base - top) * (0.32 + rnd() * 0.22);
        wrapped(w, h, x, 0, r * 2, (px) => {
          g.beginPath();
          g.ellipse(px, top + r, r * 0.85, r, 0, 0, PI * 2);
          g.fill();
          g.beginPath();
          g.ellipse(px + r * 0.45, top + r * 1.3, r * 0.7, r * 0.8, 0, 0, PI * 2);
          g.fill();
          g.fillRect(px - r * 0.9, top + r, r * 1.9, base - top - r + 4);
        });
      }
      g.filter = "none";
    };
    const roofs = (n: number, color: string, lit: boolean) => {
      for (let i = 0; i < n; i += 1) {
        const x = rnd() * w;
        const rw = 70 + rnd() * 90;
        const top = base - (0.3 + rnd() * 0.14) * h;
        const eaves = top + (0.1 + rnd() * 0.05) * h;
        g.filter = "blur(1.5px)";
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(x - rw / 2 - 10, eaves);
        g.lineTo(x - rw / 4, top);
        g.lineTo(x + rw / 4, top);
        g.lineTo(x + rw / 2 + 10, eaves);
        g.closePath();
        g.fill();
        g.fillStyle = night ? "#1a1d24" : "#8c8a86";
        g.fillRect(x - rw / 2, eaves, rw, base - eaves + 4);
        if (lit && rnd() < 0.8) {
          g.fillStyle = "rgba(255,206,140,0.85)";
          g.fillRect(x - rw * 0.25, eaves + 10, 10, 9);
          g.fillRect(x + rw * 0.12, eaves + 10, 10, 9);
        }
        g.filter = "none";
      }
    };
    if (night) {
      crowns(70, 0.38, 0.75, "#101a22", 3);
      roofs(5, "#14171d", true);
      crowns(60, 0.25, 0.55, "#0b1310", 2);
    } else {
      crowns(70, 0.38, 0.75, "#8ea39a", 3);
      roofs(5, "#6d6660", false);
      crowns(60, 0.25, 0.55, "#647c5e", 2);
    }
  };
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** A painted texture on a surface, with its own roughness and, optionally, a colour it is tinted with. */
function printed(c: Ctx, key: string, t: () => THREE.Texture, roughness: number, tint?: string): THREE.MeshStandardMaterial {
  return once(c, key, () => {
    const m = c.k.print(t(), { roughness }) as THREE.MeshStandardMaterial;
    if (tint) m.color.set(tint);
    return m;
  });
}

/**
 * Leaves for crowns and shrubs: the painted leaves cut out where the paint
 * stops, both sides showing, tinted `color`. Sized for a clump of radius `r`,
 * so a leaf is a few centimetres across whatever the clump.
 */
function foliage(c: Ctx, color: string, r = 0.5): THREE.MeshStandardMaterial {
  const cls = [0.12, 0.25, 0.45, 0.75, 1.15, 1.7].reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
  return once(c, `foliage:${color}:${cls}`, () => {
    const repeat: [number, number] = [Math.max(1, Math.round(3.9 * cls)), Math.max(0.6, 1.96 * cls)];
    const m = c.k.print(paint("foliage", 512, 512, drawFoliage, repeat), { roughness: 0.78 }) as THREE.MeshStandardMaterial;
    m.color.set(color);
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
    return m;
  });
}

function barkMat(c: Ctx, tint = "#8a7a6c"): THREE.MeshStandardMaterial {
  return printed(c, `bark:${tint}`, () => paint("bark", 256, 512, drawBark, [2, 2.5]), 0.95, tint);
}

/** The house's walls, in the style's own material, laid out in metres (the walls carry world-sized UVs). */
function wallMat(c: Ctx, kind: WallKind, color: string): THREE.MeshStandardMaterial {
  return once(c, `wall:${kind}:${color}`, () => {
    const pick = (): [THREE.Texture, number, number] => {
      if (kind === "brick") return [TEX.brick(), 0.85, 0.9];
      if (kind === "logs") return [TEX.logs(), 0.57, 0.85];
      if (kind === "bamboo") return [TEX.bamboo(), 0.9, 0.7];
      if (kind === "stone") return [TEX.stoneBlocks(), 0.36, 0.88];
      return [TEX.plaster(), 0.5, 0.92];
    };
    const [tex, per, roughness] = pick();
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(per, per);
    const m = c.k.print(t, { roughness }) as THREE.MeshStandardMaterial;
    if (kind === "plaster") m.color.set(color);
    return m;
  });
}

// ---------------------------------------------------------------------------
// The house
// ---------------------------------------------------------------------------

interface Opening {
  x: number;
  /** Bottom of the opening. */
  sill: number;
  w: number;
  h: number;
  shape: WindowShape;
}

/** Each style's windows, in the shape the rooms use, for the ground floor and the floor above. */
function windowsFor(shape: WindowShape): Opening[] {
  const size: Record<WindowShape, [number, number, number, number, number, number]> = {
    // w, h, sill below; w, h, sill above
    square: [1.25, 1.45, 0.95, 1.15, 1.3, 3.75],
    round: [1.05, 1.05, 1.15, 0.95, 0.95, 3.95],
    grid: [1.6, 1.85, 0.75, 1.6, 1.7, 3.7],
    wide: [2.0, 1.25, 1.0, 1.8, 1.15, 3.9],
    arch: [1.05, 1.75, 0.85, 0.95, 1.5, 3.75],
  };
  const [w0, h0, s0, w1, h1, s1] = size[shape];
  return [-2.5, 3.9].flatMap((x) => [
    { x, sill: s0, w: w0, h: h0, shape },
    { x, sill: s1, w: w1, h: h1, shape },
  ]);
}

/** The top edge of a wall with battlements, from x1 back to x0 at height `top`. */
function battlements(x0: number, x1: number, top: number): Pt[] {
  const pts: Pt[] = [];
  const merlon = 0.7;
  const crenel = 0.5;
  const span = x1 - x0;
  const n = Math.max(1, Math.round((span - merlon) / (merlon + crenel)));
  const step = (span - merlon) / n;
  const mw = merlon * (step / (merlon + crenel));
  let x = x1;
  pts.push([x, top]);
  for (let i = 0; i < n; i += 1) {
    x -= mw;
    pts.push([x, top], [x, top - 0.55]);
    x -= step - mw;
    pts.push([x, top - 0.55], [x, top]);
  }
  pts.push([x0, top]);
  return pts;
}

/** One window, built in the wall's plane: casing proud of the wall, glass set back, curtains, the room behind. */
function windowSet(c: Ctx, o: Opening, trim: THREE.Material, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const hole = openingOutline(o.shape, o.w, o.h);
  const outer = openingOutline(o.shape, o.w + 0.16, o.h + 0.16);
  // Casing.
  g.add(k.extrude(outer, 0.05, trim, { holes: [hole.slice().reverse()], at: [0, 0, 0.015], bevel: 0.008 }));
  // Glass, a little back from the face of the wall.
  const glass = k.extrude(hole, 0.006, k.glass("#c9d7df", 0.3), { at: [0, 0, -0.1], bevel: 0.0005 });
  glass.castShadow = false;
  g.add(glass);
  // Glazing bars.
  const bar = (bw: number, bh: number, x: number, y: number) => g.add(k.box(bw, bh, 0.03, trim, { at: [x, y, -0.09] }));
  if (o.shape === "square") {
    bar(0.04, o.h, 0, 0);
    bar(o.w, 0.04, 0, o.h * 0.12);
  } else if (o.shape === "grid") {
    for (const fx of [-1 / 3, 1 / 3]) bar(0.035, o.h, fx * o.w, 0);
    for (const fy of [-0.25, 0, 0.25]) bar(o.w, 0.035, 0, fy * o.h);
  } else if (o.shape === "wide") {
    bar(0.05, o.h, 0, 0);
  } else if (o.shape === "round") {
    bar(0.04, o.h, 0, 0);
    bar(o.w, 0.04, 0, 0);
  } else {
    bar(0.04, o.h, 0, 0);
    bar(o.w, 0.04, 0, -0.05);
  }
  // Sill, sloped off the wall.
  if (o.shape !== "round") g.add(k.box(o.w + 0.26, 0.05, 0.12, k.stone("concrete"), { at: [0, -o.h / 2 - 0.045, 0.05], r: 0.008 }));
  // Curtains drawn to the sides, then the room.
  const cw = Math.min(0.32, o.w * 0.26);
  const curtain = night ? k.glow("#e9c48c", true, 0.5) : k.fabric("#e4dccb");
  for (const s of [-1, 1]) g.add(k.box(cw, o.h + 0.1, 0.03, curtain, { at: [s * (o.w / 2 - cw / 2 + 0.04), 0, -0.22], r: 0.01 }));
  const back = k.plane(o.w + 0.7, o.h + 0.7, room(c, night), { at: [0, 0, -HOUSE.t - 0.05] });
  back.castShadow = false;
  g.add(back);
  return g;
}

/** The back door: casing, a door with its glass or planks, handle and hinges, the steps and a mat. */
function backDoor(c: Ctx, theme: RoomTheme, trim: THREE.Material, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const w = 0.94;
  const h = 2.12;
  const arch = theme.window === "arch";
  const plankDoor = theme.id === "treehouse" || theme.id === "castle";
  const leafM = plankDoor ? k.wood("walnut", { gloss: 0.25 }) : k.paint(theme.id === "loft" ? "#24272a" : theme.id === "beach" ? "#f4f2ec" : "#56705f", 0.5);
  const hole = arch ? openingOutline("arch", w, h) : openingOutline("square", w, h);
  // Casing round the opening.
  g.add(k.extrude(openingOutline(arch ? "arch" : "square", w + 0.18, h + 0.09), 0.05, trim, { holes: [shift(hole, 0, -0.045).reverse()], at: [0, 0.045, 0.015], bevel: 0.008 }));
  // The door leaf, set back in the opening.
  const leaf = k.extrude(shift(openingOutline(arch ? "arch" : "square", w - 0.01, h - 0.005), 0, 0), 0.05, leafM, { at: [0, 0, -0.12], bevel: 0.004 });
  g.add(leaf);
  const metal = k.metal("black");
  if (plankDoor) {
    // Planks, and iron straps across them.
    for (let i = -3; i <= 3; i += 1) g.add(k.box(0.006, h - 0.1, 0.008, k.paint("#2b1d14"), { at: [i * 0.125, -0.03, -0.093] }));
    for (const y of [-0.62, 0.55]) {
      g.add(k.box(w * 0.82, 0.05, 0.01, metal, { at: [-0.04, y, -0.088], r: 0.003 }));
      for (let i = 0; i < 4; i += 1) g.add(k.sphere(0.009, metal, { at: [-0.38 + i * 0.22, y, -0.082], seg: 8 }));
    }
    g.add(k.torus(0.04, 0.007, metal, { at: [0.33, 0.0, -0.078], seg: 16 }));
  } else {
    // Two panels below, and nine lights of glass above.
    for (const [py, ph] of [
      [-0.62, 0.62],
      [0.08, 0.36],
    ] as const) {
      g.add(k.box(w - 0.24, ph, 0.012, leafM, { at: [0, py, -0.091], r: 0.004 }));
      g.add(k.box(w - 0.3, ph - 0.06, 0.006, leafM, { at: [0, py, -0.084], r: 0.003 }));
    }
    const glassW = w - 0.22;
    const glassH = 0.72;
    const gy = 0.6;
    const glass = k.box(glassW, glassH, 0.006, k.glass("#c9d7df", 0.3), { at: [0, gy, -0.095] });
    glass.castShadow = false;
    g.add(glass);
    g.add(k.plane(glassW, glassH, room(c, night), { at: [0, gy, -0.2] }));
    for (const fx of [-1 / 6, 1 / 6]) g.add(k.box(0.025, glassH, 0.02, leafM, { at: [fx * glassW * 2, gy, -0.092] }));
    for (const fy of [-1 / 6, 1 / 6]) g.add(k.box(glassW, 0.025, 0.02, leafM, { at: [0, gy + fy * glassH * 2, -0.092] }));
    // Lever handle and its plate.
    g.add(k.box(0.035, 0.16, 0.012, k.metal(theme.id === "loft" ? "steel" : "brass"), { at: [0.36, -0.08, -0.088], r: 0.004 }));
    g.add(k.box(0.11, 0.018, 0.018, k.metal(theme.id === "loft" ? "steel" : "brass"), { at: [0.32, -0.04, -0.072], r: 0.008 }));
  }
  // Hinges on the left.
  for (const y of [-0.85, 0.0, 0.85]) g.add(k.box(0.02, 0.09, 0.012, metal, { at: [-w / 2 + 0.01, y, -0.09], r: 0.003 }));
  g.position.y = HOUSE.plinth + h / 2;
  // Steps up to the door, and a mat.
  const steps = new THREE.Group();
  const stoneM = theme.id === "castle" ? k.stone("granite") : k.stone("concrete");
  steps.add(k.box(1.5, 0.31, 0.72, stoneM, { at: [0, 0.155, 0.36], r: 0.012 }));
  steps.add(k.box(1.5, 0.16, 0.38, stoneM, { at: [0, 0.08, 0.91], r: 0.012 }));
  steps.add(k.box(0.78, 0.016, 0.44, k.fabric("#8f7048", { repeat: [6, 4] }), { at: [0, 0.318, 0.33], r: 0.004 }));
  // A wall lantern beside the door, lit at night.
  const lx = w / 2 + 0.36;
  const lamp = k.group([
    k.box(0.1, 0.24, 0.02, metal, { at: [0, 0, 0.01], r: 0.004 }),
    k.box(0.022, 0.022, 0.1, metal, { at: [0, 0.02, 0.06] }),
    k.box(0.15, 0.2, 0.15, k.glass("#efe6cf", 0.35), { at: [0, -0.02, 0.15] }),
    k.cone(0.13, 0.08, metal, { at: [0, 0.12, 0.15], rot: [0, PI / 4, 0], seg: 4 }),
    k.sphere(0.035, k.glow("#ffd9a0", night, 3.5), { at: [0, -0.02, 0.15], seg: 14 }),
  ]);
  lamp.position.set(lx, HOUSE.plinth + 1.9, 0);
  const out = new THREE.Group();
  out.add(g, steps, lamp);
  if (night) {
    const l = new THREE.PointLight("#ffcf8f", 7, 9, 2);
    l.position.set(lx, HOUSE.plinth + 1.85, 0.32);
    out.add(l);
  }
  return out;
}

/** The room seen through the glass: dim by day, lamp-lit (glowing) at night. */
function room(c: Ctx, night: boolean): THREE.MeshStandardMaterial {
  const m = printed(c, `interior:${night}`, () => paint(`interior:${night}`, 256, 256, drawInterior(night)), 1);
  if (night) {
    m.emissive.set("#ffffff");
    m.emissiveMap = m.map;
    m.emissiveIntensity = 1.15;
  }
  return m;
}

/** The back of the house: its walls in the style's material, the roof, the door, windows, gutter, and the tap with its hose. */
function buildHouse(c: Ctx, theme: RoomTheme, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  g.userData.gardenPart = "house";
  const finish = theme.down;
  const wall = wallMat(c, finish.backWall, finish.wallColor);
  // Outside, the whole house is in the back wall's material.
  const side = wall;
  const trim = k.paint(theme.trim, 0.45);
  const W = HOUSE.w;
  const D = HOUSE.d;
  const T = HOUSE.t;
  const z0 = L.wallZ;
  const flat = theme.id === "loft" || theme.id === "castle";
  const crenel = theme.id === "castle";
  const pitch = theme.id === "beach" ? 0.44 : theme.id === "treehouse" ? 0.7 : 0.66;
  const top = flat ? HOUSE.eave + 0.75 : HOUSE.eave;
  const ridgeY = HOUSE.eave + (D / 2) * Math.tan(pitch);

  // The back wall, with the door and the windows cut through it.
  const doorW = 0.94;
  const doorH = 2.12;
  const doorHole = shift(openingOutline(theme.window === "arch" ? "arch" : "square", doorW, doorH), L.doorX, HOUSE.plinth + doorH / 2);
  const wins = windowsFor(theme.window);
  const holes = [doorHole, ...wins.map((o) => shift(openingOutline(o.shape, o.w, o.h), o.x, o.sill + o.h / 2))];
  const backTop: Pt[] = crenel ? battlements(-W / 2, W / 2, top) : [[W / 2, top], [-W / 2, top]];
  const backOutline: Pt[] = [[-W / 2, 0], [W / 2, 0], ...backTop];
  g.add(k.extrude(backOutline, T, wall, { at: [0, 0, z0 - T / 2], holes, bevel: 0.006 }));
  // The far wall (the front of the house), for when the camera sees over a flat roof.
  g.add(k.extrude(backOutline, T, side, { at: [0, 0, z0 - D + T / 2], bevel: 0.006 }));
  // The side walls, gabled under a pitched roof.
  const gable = (u0: number, u1: number): Pt[] =>
    flat
      ? [[u0, 0], [u1, 0], ...(crenel ? battlements(u0, u1, top) : ([[u1, top], [u0, top]] as Pt[]))]
      : [
          [u0, 0],
          [u1, 0],
          [u1, HOUSE.eave + (D - u1) * Math.tan(pitch)],
          [D / 2, ridgeY],
          [u0, HOUSE.eave + u0 * Math.tan(pitch)],
        ];
  for (const sx of [-1, 1]) g.add(k.extrude(gable(T, D - T), T, side, { at: [sx * (W / 2 - T / 2), 0, z0], rot: [0, PI / 2, 0], bevel: 0.006 }));

  // A concrete plinth along the foot of the walls you can see.
  const plinthM = theme.id === "castle" ? k.stone("granite") : k.stone("concrete");
  g.add(k.box(W + 0.04, HOUSE.plinth, 0.04, plinthM, { at: [0, HOUSE.plinth / 2, z0 + 0.02] }));
  g.add(k.box(0.04, HOUSE.plinth, D, plinthM, { at: [W / 2 + 0.02, HOUSE.plinth / 2, z0 - D / 2] }));

  if (flat) {
    // A flat roof behind a parapet: gravel on the membrane, and stone coping along the top.
    g.add(k.box(W - 2 * T, 0.12, D - 2 * T, printed(c, "gravel:roof", () => paint("gravel", 512, 512, drawGravel, [6, 4]), 0.95, "#9c968d"), { at: [0, HOUSE.eave, z0 - D / 2] }));
    if (!crenel) {
      const cope = k.stone("concrete");
      g.add(k.box(W + 0.06, 0.07, T + 0.08, cope, { at: [0, top + 0.035, z0 - T / 2], r: 0.01 }));
      g.add(k.box(W + 0.06, 0.07, T + 0.08, cope, { at: [0, top + 0.035, z0 - D + T / 2], r: 0.01 }));
      for (const sx of [-1, 1]) g.add(k.box(T + 0.08, 0.07, D, cope, { at: [sx * (W / 2 - T / 2), top + 0.035, z0 - D / 2], r: 0.01 }));
    }
  } else {
    // A pitched roof: two slopes meeting at the ridge, overhanging the walls.
    const ov = 0.45;
    const rake = 0.38;
    const th = 0.12;
    const len = (D / 2 + ov) / Math.cos(pitch);
    const dm = (D / 2 - ov) / 2;
    const n = new THREE.Vector3(0, Math.cos(pitch), Math.sin(pitch));
    const seam = theme.id === "beach";
    const tint = theme.id === "treehouse" ? "#8b6a4a" : theme.id === "beach" ? "#c4cccf" : "#6e645c";
    const roofM = seam
      ? printed(c, "roof:seam", () => paint("seams", 512, 512, drawSeams, [(W + 2 * rake) / 1.8, 1]), 0.42, tint)
      : printed(c, `roof:shingle:${tint}`, () => paint("shingles", 512, 512, drawShingles, [(W + 2 * rake) / 1.36, len / 1.12]), 0.86, tint);
    if (seam) roofM.metalness = 0.55;
    for (const s of [1, -1]) {
      const zm = z0 - D / 2 + s * (D / 2 - dm);
      const ym = HOUSE.eave + dm * Math.tan(pitch);
      g.add(k.box(W + 2 * rake, th, len, roofM, { at: [0, ym + n.y * (th / 2), zm + s * n.z * (th / 2)], rot: [s * pitch, 0, 0] }));
    }
    // Ridge cap.
    g.add(k.box(W + 2 * rake + 0.02, 0.07, 0.24, k.paint("#3d3a37", 0.2), { at: [0, ridgeY + th / Math.cos(pitch) - 0.01, z0 - D / 2], r: 0.02 }));
    // Fascia and gutter along the eave, a downpipe at the corner.
    const eaveY = HOUSE.eave - ov * Math.tan(pitch);
    g.add(k.box(W + 2 * rake, 0.2, 0.03, trim, { at: [0, eaveY - 0.02, z0 + ov + 0.01] }));
    const gutterM = theme.id === "castle" || theme.id === "loft" ? k.metal("black") : k.paint("#eceae4", 0.55);
    g.add(k.box(W + 2 * rake, 0.11, 0.13, gutterM, { at: [0, eaveY - 0.07, z0 + ov + 0.09], r: 0.025 }));
    const px = W / 2 - 0.12;
    g.add(board(k, [px + 0.18, eaveY - 0.12, z0 + ov + 0.09], [px, eaveY - 0.5, z0 + 0.07], 0.075, 0.075, gutterM));
    g.add(k.box(0.075, eaveY - 0.62, 0.075, gutterM, { at: [px, (eaveY - 0.5 + 0.12) / 2, z0 + 0.07], r: 0.02 }));
    g.add(board(k, [px, 0.16, z0 + 0.07], [px, 0.06, z0 + 0.24], 0.075, 0.075, gutterM));
    g.add(k.box(0.3, 0.04, 0.5, k.stone("concrete"), { at: [px, 0.02, z0 + 0.42], r: 0.01 }));
    // Barge boards up the gable ends.
    for (const sx of [-1, 1])
      for (const s of [1, -1]) {
        const a: V3 = [sx * (W / 2 + rake), eaveY + 0.06, z0 - D / 2 + s * (D / 2 + ov)];
        const b: V3 = [sx * (W / 2 + rake), ridgeY + 0.06, z0 - D / 2];
        g.add(board(k, a, b, 0.2, 0.03, trim, [sx, 0, 0]));
      }
    // A brick chimney on the cottage.
    if (theme.id === "cottage") {
      const cz = z0 - D / 2 + 0.7;
      const base = HOUSE.eave + (D / 2 - 0.7 - 0.35) * Math.tan(pitch);
      const tall = ridgeY + 1.0 - base;
      const brick = once(c, "chimney", () => {
        const t = TEX.brick().clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(0.8 * 0.85, tall * 0.85);
        return c.k.print(t, { roughness: 0.9 });
      });
      g.add(k.box(0.8, tall, 0.7, brick, { at: [3.4, base + tall / 2, cz] }));
      g.add(k.box(0.92, 0.08, 0.82, k.stone("concrete"), { at: [3.4, base + tall + 0.04, cz], r: 0.01 }));
      for (const dx of [-0.17, 0.17]) g.add(k.cyl(0.08, 0.09, 0.3, k.stone("terracotta"), { at: [3.4 + dx, base + tall + 0.23, cz], seg: 16 }));
    }
  }

  // Windows and the back door.
  for (const o of wins) {
    const w = windowSet(c, o, trim, night);
    w.position.set(o.x, o.sill + o.h / 2, z0);
    g.add(w);
  }
  const door = backDoor(c, theme, trim, night);
  door.position.set(L.doorX, 0, z0);
  g.add(door);
  if (night)
    for (const o of wins.filter((w) => w.sill < 2)) {
      const l = new THREE.PointLight("#ffc98a", 2.6, 6, 2);
      l.position.set(o.x, o.sill + o.h * 0.4, z0 + 0.7);
      g.add(l);
    }

  // The outside tap, and a hose coiled on its hanger.
  const tapX = 2.35;
  const brass = k.metal("brass", 0.35);
  g.add(k.cyl(0.018, 0.018, 0.12, brass, { at: [tapX, 0.5, z0 + 0.06], rot: [PI / 2, 0, 0], seg: 12 }));
  g.add(k.cyl(0.014, 0.014, 0.06, brass, { at: [tapX, 0.47, z0 + 0.11], seg: 12 }));
  g.add(k.torus(0.03, 0.006, k.paint("#9a2a24", 0.4), { at: [tapX, 0.545, z0 + 0.09], rot: [PI / 2, 0, 0], seg: 16 }));
  const hoseM = k.plastic("#2f6e3c", 0.35);
  g.add(k.box(0.06, 0.12, 0.1, k.metal("black"), { at: [tapX + 0.55, 0.92, z0 + 0.05], r: 0.01 }));
  for (let i = 0; i < 4; i += 1) g.add(k.torus(0.2 - i * 0.004, 0.012, hoseM, { at: [tapX + 0.55, 0.76 + i * 0.008, z0 + 0.06 + i * 0.026], rot: [0.1, 0, 0], seg: 40 }));

  // Gravel along the foot of the wall.
  g.add(k.box(W + 0.4, 0.03, 0.55, printed(c, "gravel", () => paint("gravel", 512, 512, drawGravel, [(W + 0.4) / 0.9, 0.6]), 0.95), { at: [0, 0.006, z0 + 0.275] }));
  // A pot by the door.
  const pot = k.group([
    k.lathe([[0.0, 0], [0.15, 0], [0.19, 0.3], [0.215, 0.32], [0.215, 0.36], [0.19, 0.36]], k.stone("terracotta"), { seg: 28 }),
    k.cyl(0.185, 0.185, 0.02, k.soil(), { at: [0, 0.34, 0], seg: 24 }),
    k.sphere(1, foliage(c, "#5d7f45", 0.3), { at: [0, 0.6, 0], scale: [0.3, 0.32, 0.3], seg: 18 }),
    k.sphere(1, foliage(c, "#4c7039", 0.22), { at: [0.05, 0.75, 0.04], scale: [0.22, 0.24, 0.22], seg: 16 }),
  ]);
  pot.position.set(L.doorX - 0.98, 0, z0 + 0.36);
  g.add(pot);
  return g;
}

// ---------------------------------------------------------------------------
// Fence, ground, sky, trees beyond
// ---------------------------------------------------------------------------

/** A cedar fence down both sides, with a panel and a gate back to the house's corners. */
function buildFence(c: Ctx): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  g.userData.gardenPart = "fence";
  const H = 1.62;
  const postH = L.fenceHeight - 0.06;
  const post = k.wood("#8f6345", { gloss: 0.15 });
  const rail = k.wood("#a2724f", { gloss: 0.12 });
  const capM = k.wood("#7c5539", { gloss: 0.2 });
  const z0 = L.wallZ + 0.06;
  const z1 = L.half;
  const bays = 6;
  const bay = (z1 - z0) / bays;
  const panelM = printed(c, "fence:panel", () => paint("fence", 512, 1024, drawFenceBoards, [(bay - 0.1) / 0.84, 1]), 0.88);
  const shortM = printed(c, "fence:short", () => paint("fence", 512, 1024, drawFenceBoards, [1.4 / 0.84, 1]), 0.88);
  const addPost = (x: number, z: number) => {
    g.add(board(k, [x, 0, z], [x, postH, z], 0.1, 0.1, post, [0, 0, 1], 0.008));
    g.add(k.cone(0.088, 0.07, capM, { at: [x, postH + 0.035, z], rot: [0, PI / 4, 0], seg: 4 }));
  };
  for (const sx of [-1, 1]) {
    const x = sx * L.fenceX;
    for (let i = 0; i <= bays; i += 1) addPost(x, z0 + i * bay);
    for (let i = 0; i < bays; i += 1) {
      const zm = z0 + (i + 0.5) * bay;
      g.add(k.box(0.022, H - 0.08, bay - 0.1, panelM, { at: [x, 0.06 + (H - 0.08) / 2, zm] }));
      g.add(board(k, [x - sx * 0.035, H - 0.03, zm - bay / 2 + 0.05], [x - sx * 0.035, H - 0.03, zm + bay / 2 - 0.05], 0.06, 0.045, rail, [-sx, 0, 0]));
      g.add(board(k, [x - sx * 0.035, 0.32, zm - bay / 2 + 0.05], [x - sx * 0.035, 0.32, zm + bay / 2 - 0.05], 0.09, 0.04, rail, [-sx, 0, 0]));
    }
  }
  // Back to the house: a panel on the left, a gate on the right.
  const hx = HOUSE.w / 2 + 0.06;
  const wid = L.fenceX - hx;
  addPost(-hx, z0);
  g.add(k.box(wid - 0.1, H - 0.08, 0.022, shortM, { at: [-(hx + wid / 2), 0.06 + (H - 0.08) / 2, z0] }));
  g.add(board(k, [-hx - 0.05, H - 0.03, z0 + 0.035], [-L.fenceX + 0.05, H - 0.03, z0 + 0.035], 0.06, 0.045, rail, [0, 0, 1]));
  addPost(hx, z0);
  const gate = new THREE.Group();
  const gw = wid - 0.14;
  gate.add(k.box(gw, H - 0.12, 0.022, shortM, { at: [gw / 2, 0.08 + (H - 0.12) / 2, 0] }));
  gate.add(board(k, [0.04, 0.3, 0.03], [gw - 0.04, 0.3, 0.03], 0.1, 0.03, rail));
  gate.add(board(k, [0.04, H - 0.25, 0.03], [gw - 0.04, H - 0.25, 0.03], 0.1, 0.03, rail));
  gate.add(board(k, [0.1, 0.36, 0.03], [gw - 0.1, H - 0.31, 0.03], 0.09, 0.028, rail));
  const iron = k.metal("black");
  for (const y of [0.3, H - 0.25]) gate.add(k.box(0.24, 0.03, 0.008, iron, { at: [0.12, y, 0.05], r: 0.003 }));
  gate.add(k.box(0.12, 0.025, 0.02, iron, { at: [gw - 0.03, H - 0.55, 0.05], r: 0.004 }));
  gate.add(k.torus(0.03, 0.005, iron, { at: [gw - 0.12, H - 0.6, 0.06], seg: 14 }));
  gate.position.set(hx + 0.07, 0, z0);
  g.add(gate);
  return g;
}

/** Mulch beds along the fences, edged in steel, with shrubs in them. */
function buildBorders(c: Ctx): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const z0 = L.wallZ + 0.3;
  const len = L.half - z0;
  const mulch = printed(c, "mulch", () => paint("mulch", 512, 512, drawMulch, [1.0, len / 0.9]), 0.96);
  const edging = k.metal("black", 0.6);
  for (const sx of [-1, 1]) {
    g.add(k.box(0.9, 0.03, len, mulch, { at: [sx * (L.half - 0.45), 0.004, z0 + len / 2] }));
    g.add(k.box(0.005, 0.05, len, edging, { at: [sx * (L.half - 0.9), 0.01, z0 + len / 2] }));
  }
  const rnd = rng(211);
  const shrubs: [number, number, number, string][] = [
    [-1, -5.7, 0.55, "#4b6b3a"],
    [-1, 0.9, 0.48, "#56783f"],
    [-1, 3.6, 0.6, "#46663a"],
    [-1, 6.0, 0.45, "#5c7d44"],
    [1, -5.5, 0.58, "#4e6e3b"],
    [1, -2.6, 0.46, "#5a7c42"],
    [1, 0.6, 0.55, "#4a6a39"],
    [1, 3.4, 0.5, "#587a40"],
    [1, 6.1, 0.42, "#4f713c"],
  ];
  for (const [sx, z, r, tint] of shrubs) {
    const x = sx * (L.half - 0.46);
    g.add(k.sphere(1, foliage(c, tone(tint, 0.7), r), { at: [x, r * 0.62, z], scale: [r * 0.8, r * 0.66, r * 0.8], seg: 16 }));
    g.add(k.sphere(1, foliage(c, tint, r), { at: [x, r * 0.72, z], scale: [r, r * 0.82, r * 0.95], seg: 20 }));
    g.add(k.sphere(1, foliage(c, tone(tint, 1.12), r * 0.7), { at: [x + (rnd() - 0.5) * 0.2, r * 1.15, z + (rnd() - 0.5) * 0.25], scale: [r * 0.72, r * 0.62, r * 0.7], seg: 16 }));
  }
  return g;
}

/** The lawn (its top at y = 0), the ground beyond it, and the sky round everything. */
function buildGround(c: Ctx, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const lawn = k.plane(L.half * 2, L.half * 2, printed(c, "lawn", () => paint("lawn", 2048, 2048, drawLawn), 0.96), { rot: [-PI / 2, 0, 0] });
  lawn.castShadow = false;
  lawn.userData.gardenPart = "lawn";
  g.add(lawn);
  const far = k.plane(260, 260, printed(c, "fargrass", () => paint("fargrass", 512, 512, drawFarGrass, [86, 86]), 1), { at: [0, -0.02, 0], rot: [-PI / 2, 0, 0] });
  far.castShadow = false;
  g.add(far);
  // The sky: a dome lit by nothing but itself.
  const skyM = once(c, `sky:${night}`, () => {
    const m = c.k.print(paint(`sky:${night}`, 2048, 1024, drawSky(night)), { roughness: 1, glow: 1 }) as THREE.MeshStandardMaterial;
    m.color.setRGB(0, 0, 0);
    m.toneMapped = false;
    m.fog = false;
    m.side = THREE.BackSide;
    return m;
  });
  const dome = k.sphere(120, skyM, { seg: 48 });
  dome.castShadow = false;
  dome.receiveShadow = false;
  dome.rotation.y = -0.35;
  g.add(dome);
  // The neighbourhood all round, between the yard and the sky: trees and a few roofs, painted soft.
  const ringM = once(c, `treeline:${night}`, () => {
    const t = paint(`treeline:${night}`, 2048, 256, drawTreeline(night), [3, 1]);
    t.wrapT = THREE.ClampToEdgeWrapping;
    const m = c.k.print(t, { roughness: 1, glow: 1 }) as THREE.MeshStandardMaterial;
    m.color.setRGB(0, 0, 0);
    m.toneMapped = false;
    m.fog = false;
    m.transparent = true;
    m.depthWrite = false;
    m.side = THREE.BackSide;
    return m;
  });
  const ring = k.cyl(48, 48, 15, ringM, { at: [0, 7.2, 0], open: true, seg: 72 });
  ring.castShadow = false;
  ring.receiveShadow = false;
  ring.renderOrder = -1;
  g.add(ring);
  return g;
}

/** A hex colour made lighter (f > 1) or darker (f < 1). */
function tone(hex: string, f: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;
}

/** A tree for the neighbours' yards: the same build as the garden's own, simpler. */
function farTree(c: Ctx, at: V3, height: number, crown: number, tint: string, seed: number): THREE.Group {
  const g = growTree(c, { trunkR: crown * 0.085, crownY: height - crown * 0.85, crownR: crown, crownH: crown * 0.85, clumps: 9, branches: 3, seed, leaf: tint });
  g.position.set(...at);
  return g;
}

/** A spruce: a trunk and tiers of needled boughs, drooping at their tips. */
function farSpruce(c: Ctx, at: V3, height: number): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const needles = once(c, "spruce", () => {
    const m = c.k.print(paint("needles", 512, 512, drawNeedles, [4, 2]), { roughness: 0.85 }) as THREE.MeshStandardMaterial;
    m.color.set("#3f5c47");
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
    return m;
  });
  g.add(k.cyl(height * 0.012, height * 0.028, height * 0.92, barkMat(c, "#5d5047"), { at: [0, height * 0.46, 0], seg: 8 }));
  g.add(k.cone(height * 0.15, height * 0.78, k.leaf(3), { at: [0, height * 0.12 + height * 0.39, 0], seg: 12 }));
  const tiers = 6;
  for (let i = 0; i < tiers; i += 1) {
    const t = i / tiers;
    const r = height * (0.25 - t * 0.17);
    const h = height * (0.3 - t * 0.12);
    g.add(k.cyl(height * 0.012, r, h, needles, { at: [0, height * (0.1 + t * 0.66) + h / 2, 0], rot: [0, i * 0.7, 0], seg: 16, open: true }));
  }
  g.position.set(...at);
  return g;
}

interface TreeSpec {
  /** Radius of the trunk above its flare, and where the crown's middle is, how wide and how tall. */
  trunkR: number;
  crownY: number;
  crownR: number;
  crownH: number;
  clumps: number;
  branches: number;
  seed: number;
  leaf: string;
  /** Keep the crown's leaf clumps out of these (the treehouse, the swing's rope). */
  avoid?: THREE.Box3[];
}

/** A broadleaf tree: a flared trunk that divides into limbs, and a crown of leafy clumps round a darker middle, flatter underneath. */
function growTree(c: Ctx, s: TreeSpec): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const rnd = rng(s.seed);
  const bark = barkMat(c);
  const r = s.trunkR;
  const forkY = Math.max(0.5, s.crownY - s.crownH * 0.62);
  g.add(
    k.lathe(
      [
        [r * 1.9, 0],
        [r * 1.42, 0.05 + r * 0.4],
        [r * 1.1, 0.12 + r * 1.6],
        [r, Math.min(forkY * 0.35, 0.3 + r * 3)],
        [r * 0.9, forkY * 0.78],
        [r * 0.76, forkY],
        [r * 0.48, forkY + s.crownH * 0.45],
        [r * 0.18, s.crownY + s.crownH * 0.35],
      ],
      bark,
      { seg: 16 }
    )
  );
  // Limbs from the fork up and out, each bending once on its way to the crown's edge.
  const tips: V3[] = [];
  for (let i = 0; i < s.branches; i += 1) {
    const a = i * 2.39996 + rnd() * 0.6;
    const y0 = forkY + (rnd() - 0.25) * s.crownH * 0.25;
    const base: V3 = [Math.cos(a) * r * 0.35, y0, Math.sin(a) * r * 0.35];
    const elbow: V3 = [Math.cos(a) * s.crownR * 0.32, y0 + s.crownH * (0.3 + rnd() * 0.2), Math.sin(a) * s.crownR * 0.32];
    const tip: V3 = [Math.cos(a + 0.25) * s.crownR * 0.66, s.crownY + (rnd() - 0.25) * s.crownH * 0.5, Math.sin(a + 0.25) * s.crownR * 0.66];
    g.add(rod(k, base, elbow, r * 0.55, r * 0.36, bark, 9));
    g.add(rod(k, elbow, tip, r * 0.36, r * 0.1, bark, 8));
    tips.push(tip);
  }
  // A darker leafy middle, so you never see sky straight through the crown.
  g.add(k.sphere(1, foliage(c, tone(s.leaf, 0.62), s.crownR * 0.7), { at: [0, s.crownY, 0], scale: [s.crownR * 0.74, s.crownH * 0.68, s.crownR * 0.74], seg: 20 }));
  // Clumps at the limb tips, then over the crown's shell, smaller at the top, none hanging low.
  const spots: { p: V3; r: number }[] = tips.map((p) => ({ p, r: s.crownR * (0.3 + rnd() * 0.08) }));
  for (let tries = 0; spots.length < s.clumps && tries < 800; tries += 1) {
    const u = rnd() * 2 - 1;
    const v = rnd() * 2 - 1;
    const w = rnd() * 2 - 1;
    const d = Math.hypot(u, v, w);
    if (d > 1 || d < 0.55 || v < -0.5) continue;
    const p: V3 = [u * s.crownR * 0.8, s.crownY + v * s.crownH * 0.78, w * s.crownR * 0.8];
    const cr = s.crownR * (0.22 + rnd() * 0.14) * (v > 0.4 ? 0.85 : 1);
    if (spots.some((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1], q.p[2] - p[2]) < (q.r + cr) * 0.6)) continue;
    spots.push({ p, r: cr });
  }
  const tints = [s.leaf, tone(s.leaf, 1.12), tone(s.leaf, 0.9)];
  spots.forEach(({ p, r: cr }, i) => {
    const box = new THREE.Box3(new THREE.Vector3(p[0] - cr * 0.5, p[1] - cr * 0.5, p[2] - cr * 0.5), new THREE.Vector3(p[0] + cr * 0.5, p[1] + cr * 0.5, p[2] + cr * 0.5));
    if (s.avoid?.some((b) => b.intersectsBox(box))) return;
    g.add(k.sphere(1, foliage(c, tints[i % 3], cr), { at: p, scale: [cr, cr * (0.78 + rnd() * 0.15), cr * (0.9 + rnd() * 0.15)], rot: [0, rnd() * PI, 0], seg: 18 }));
  });
  return g;
}

// ---------------------------------------------------------------------------
// The tree that grows with the course
// ---------------------------------------------------------------------------

/** The tree by its stage, 0 a staked sapling to 5 a full crown, with the swing, the birdhouse and the treehouse as the course earns them. */
function buildTree(c: Ctx, state: GardenState, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  g.userData.gardenPart = "tree";
  g.position.set(L.tree.x, 0, L.tree.z);
  const stage = Math.max(state.tree, state.swing ? 3 : 0, state.birdhouse ? 4 : 0, state.treehouse ? 5 : 0);
  const mulch = printed(c, "mulch:ring", () => paint("mulch", 512, 512, drawMulch, [1.4, 1.4]), 0.96);

  if (stage === 0) {
    // A sapling, tied to a stake, in a ring of mulch.
    g.add(k.cyl(0.42, 0.44, 0.03, mulch, { at: [0, 0.006, 0], seg: 32 }));
    g.add(k.lathe([[0.016, 0], [0.012, 0.4], [0.008, 0.95], [0.004, 1.3]], barkMat(c, "#8e7a66"), { seg: 8 }));
    const sap = foliage(c, "#6b9147", 0.15);
    for (const [x, y, z, r] of [
      [0.05, 1.12, 0.02, 0.17],
      [-0.08, 1.25, -0.04, 0.15],
      [0.02, 1.38, 0.05, 0.12],
      [-0.03, 1.0, 0.08, 0.12],
    ] as const)
      g.add(k.sphere(1, sap, { at: [x, y, z], scale: [r, r * 0.85, r], seg: 14 }));
    g.add(board(k, [0.09, -0.1, -0.03], [0.09, 1.05, -0.03], 0.03, 0.03, k.wood("pine", { gloss: 0.1 })));
    g.add(k.torus(0.05, 0.008, k.rubber("#2d2d2d"), { at: [0.045, 0.8, -0.015], rot: [PI / 2, 0, 0], seg: 18 }));
    return g;
  }

  const specs: Record<number, Omit<TreeSpec, "seed" | "leaf" | "avoid">> = {
    1: { trunkR: 0.035, crownY: 1.8, crownR: 0.62, crownH: 0.55, clumps: 6, branches: 3 },
    2: { trunkR: 0.06, crownY: 2.45, crownR: 1.05, crownH: 0.85, clumps: 9, branches: 4 },
    3: { trunkR: 0.1, crownY: 3.3, crownR: 1.65, crownH: 1.25, clumps: 12, branches: 5 },
    4: { trunkR: 0.16, crownY: 4.05, crownR: 2.25, crownH: 1.6, clumps: 15, branches: 6 },
    5: { trunkR: 0.23, crownY: 4.85, crownR: 2.9, crownH: 2.0, clumps: 19, branches: 7 },
  };
  const spec = specs[stage];
  const avoid: THREE.Box3[] = [];
  // The swing hangs from a low limb towards the lawn's middle.
  const swingAt: V3 = [1.6, stage >= 4 ? 2.95 : 2.7, -0.75];
  if (state.swing) avoid.push(new THREE.Box3(new THREE.Vector3(swingAt[0] - 0.5, 0, swingAt[2] - 0.5), new THREE.Vector3(swingAt[0] + 0.5, swingAt[1] + 0.25, swingAt[2] + 0.5)));
  // The treehouse's deck and cabin, on the lawn side of the trunk.
  const deck = { x: 0.62, z: 0.78, y: 2.75, w: 2.4, d: 2.0 };
  if (state.treehouse) avoid.push(new THREE.Box3(new THREE.Vector3(deck.x - deck.w / 2 - 0.1, deck.y - 0.4, deck.z - deck.d / 2 - 0.1), new THREE.Vector3(deck.x + deck.w / 2 + 0.3, deck.y + 2.0, deck.z + deck.d / 2 + 0.4)));
  g.add(growTree(c, { ...spec, seed: 300 + stage, leaf: "#5b8a3e", avoid }));
  if (stage <= 2) g.add(k.cyl(0.55, 0.58, 0.03, mulch, { at: [0, 0.006, 0], seg: 36 }));
  else {
    // Roots running out from the foot of the trunk.
    const bark = barkMat(c);
    for (let i = 0; i < 5; i += 1) {
      const a = i * 1.3 + 0.4;
      g.add(rod(k, [Math.cos(a) * spec.trunkR * 1.2, 0.08, Math.sin(a) * spec.trunkR * 1.2], [Math.cos(a) * spec.trunkR * 4.2, -0.02, Math.sin(a) * spec.trunkR * 4.2], spec.trunkR * 0.45, spec.trunkR * 0.12, bark, 8));
    }
  }

  if (state.swing) {
    // A limb out over the lawn, a rope knotted round it, and a tire.
    const bark = barkMat(c);
    const tr = spec.trunkR;
    const limbTip: V3 = [swingAt[0] + 0.55, swingAt[1] + 0.22, swingAt[2] - 0.2];
    g.add(rod(k, [0, swingAt[1] - 0.35, 0], [swingAt[0], swingAt[1], swingAt[2]], tr * 0.55, tr * 0.32, bark, 10));
    g.add(rod(k, swingAt, limbTip, tr * 0.32, tr * 0.12, bark, 8));
    const rope = k.wood("#c9b48a", { gloss: 0.05 });
    const ropeR = 0.014;
    const tireTop = 0.93;
    g.add(k.torus(tr * 0.34 + ropeR, ropeR, rope, { at: swingAt, rot: [0, 0.2, 0], seg: 18 }));
    g.add(rod(k, [swingAt[0], swingAt[1] - 0.04, swingAt[2]], [swingAt[0], tireTop + 0.02, swingAt[2]], ropeR, ropeR, rope, 8));
    g.add(k.sphere(0.03, rope, { at: [swingAt[0], tireTop + 0.03, swingAt[2]], seg: 10 }));
    g.add(k.torus(0.28, 0.09, k.rubber("#222326"), { at: [swingAt[0], tireTop - 0.36, swingAt[2]], rot: [0, 0.65, 0], seg: 36 }));
    // Worn ground under it.
    const worn = once(c, "worn", () => {
      const m = c.k.print(
        paint("worn", 256, 256, (q, w, h) => {
          const rnd = rng(5);
          const grad = q.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
          grad.addColorStop(0, "rgba(104,84,60,0.9)");
          grad.addColorStop(0.55, "rgba(104,88,62,0.6)");
          grad.addColorStop(1, "rgba(104,88,62,0)");
          q.fillStyle = grad;
          q.fillRect(0, 0, w, h);
          for (let i = 0; i < 900; i += 1) {
            const a = rnd() * PI * 2;
            const d = Math.sqrt(rnd()) * w * 0.45;
            q.fillStyle = `rgba(${60 + rnd() * 60},${50 + rnd() * 40},${36 + rnd() * 20},${0.3 + rnd() * 0.4})`;
            q.fillRect(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 2, 2);
          }
        }),
        { roughness: 1 }
      ) as THREE.MeshStandardMaterial;
      m.transparent = true;
      m.depthWrite = false;
      return m;
    });
    const patch = k.plane(1.3, 1.0, worn, { at: [swingAt[0], 0.004, swingAt[2]], rot: [-PI / 2, 0, 0.6] });
    patch.castShadow = false;
    g.add(patch);
  }

  if (state.birdhouse) {
    // A birdhouse nailed to the trunk, facing the lawn.
    const by = 2.05;
    const rAt = spec.trunkR * 0.9;
    const body = k.paint("#6f8f86", 0.35);
    const wood = k.wood("#b98c5e", { gloss: 0.2 });
    const bh = k.group([
      k.box(0.07, 0.4, 0.02, wood, { at: [0, 0, 0.01] }),
      k.box(0.17, 0.2, 0.15, body, { at: [0, -0.02, 0.095], r: 0.006 }),
      k.extrude([[-0.085, 0], [0.085, 0], [0, 0.07]], 0.15, body, { at: [0, 0.08, 0.095], bevel: 0.003 }),
      k.disc(0.024, k.paint("#1a1612"), { at: [0, 0.0, 0.1715] }),
      k.cyl(0.004, 0.004, 0.05, wood, { at: [0, -0.06, 0.19], rot: [PI / 2, 0, 0], seg: 8 }),
    ]);
    // The roof: two boards meeting over the ridge.
    for (const s of [-1, 1]) bh.add(k.box(0.13, 0.014, 0.2, wood, { at: [s * 0.05, 0.12, 0.095], rot: [0, 0, -s * 0.72], r: 0.003 }));
    bh.position.set(0, by, rAt);
    g.add(bh);
  }

  if (state.treehouse) g.add(treehouse(c, deck, night));
  return g;
}

/** The treehouse: a deck round the trunk on posts and braces, a little cabin with a shingled roof, a railing, a ladder, bunting. */
function treehouse(c: Ctx, d: { x: number; z: number; y: number; w: number; d: number }, night: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  const deckM = k.wood("#a37a55", { gloss: 0.15 });
  const frame = k.wood("#8a6446", { gloss: 0.12 });
  const walls = k.wood("#b08a62", { gloss: 0.18 });
  const x0 = d.x - d.w / 2;
  const x1 = d.x + d.w / 2;
  const zb = d.z - d.d / 2;
  const zf = d.z + d.d / 2;
  // Deck boards (one slab with the seams of its boards) on two beams.
  const deckTex = printed(c, "deck", () => paint("fence", 512, 1024, drawFenceBoards, [d.w / 0.84, 1]), 0.8, "#c8a07a");
  g.add(k.box(d.w, 0.05, d.d, deckTex, { at: [d.x, d.y, d.z], rot: [0, PI / 2, 0], r: 0.006 }));
  for (const z of [zb + 0.2, zf - 0.2]) g.add(board(k, [x0, d.y - 0.12, z], [x1, d.y - 0.12, z], 0.18, 0.08, frame, [0, 0, 1]));
  // Posts to the ground at the front, braces back to the trunk.
  for (const x of [x0 + 0.12, x1 - 0.12]) {
    g.add(board(k, [x, -0.05, zf - 0.2], [x, d.y - 0.2, zf - 0.2], 0.1, 0.1, frame, [0, 0, 1], 0.006));
    g.add(board(k, [x, d.y - 0.85, zf - 0.2], [x * 0.35, d.y - 0.18, zf - 0.75], 0.08, 0.06, frame, [1, 0, 0]));
  }
  // The cabin.
  const cw = 1.45;
  const cd = 1.25;
  const ch = 1.2;
  const cx = d.x + 0.3;
  const cz = d.z - 0.2;
  const base = d.y + 0.025;
  const door: Pt[] = shift(openingOutline("square", 0.5, 0.9), -0.2, 0.47);
  const win: Pt[] = shift(openingOutline("square", 0.36, 0.32), 0, 0.68);
  g.add(k.extrude([[-cw / 2, 0], [cw / 2, 0], [cw / 2, ch], [-cw / 2, ch]], 0.04, walls, { at: [cx, base, cz + cd / 2 - 0.02], holes: [door], bevel: 0.004 }));
  g.add(k.extrude([[-cw / 2, 0], [cw / 2, 0], [cw / 2, ch], [-cw / 2, ch]], 0.04, walls, { at: [cx, base, cz - cd / 2 + 0.02], bevel: 0.004 }));
  const sideOutline: Pt[] = [[-cd / 2, 0], [cd / 2, 0], [cd / 2, ch], [0, ch + 0.5], [-cd / 2, ch]];
  g.add(k.extrude(sideOutline, 0.04, walls, { at: [cx + cw / 2 - 0.02, base, cz], rot: [0, PI / 2, 0], holes: [win], bevel: 0.004 }));
  g.add(k.extrude(sideOutline, 0.04, walls, { at: [cx - cw / 2 + 0.02, base, cz], rot: [0, PI / 2, 0], bevel: 0.004 }));
  // Front gable.
  g.add(k.extrude([[-cw / 2, 0], [cw / 2, 0], [0, 0.001]], 0.04, walls, { at: [cx, base + ch, cz + cd / 2 - 0.02], bevel: 0.002 }));
  // Its roof, in shingles.
  const rp = Math.atan2(0.5, cd / 2);
  const rl = Math.hypot(0.5, cd / 2) + 0.18;
  const shingle = printed(c, "roof:shingle:#5f5248", () => paint("shingles", 512, 512, drawShingles, [1.4, 1.2]), 0.86, "#5f5248");
  for (const s of [1, -1]) g.add(k.box(cw + 0.25, 0.04, rl, shingle, { at: [cx, base + ch + 0.25 + 0.03, cz + s * (cd / 4 + 0.05)], rot: [s * rp, 0, 0] }));
  // The window's frame, the doorway's dark inside.
  const trim = k.paint("#e9e2d4", 0.4);
  g.add(k.extrude(openingOutline("square", 0.44, 0.4), 0.03, trim, { holes: [openingOutline("square", 0.36, 0.32).reverse()], at: [cx + cw / 2 + 0.005, base + 0.68, cz], rot: [0, PI / 2, 0], bevel: 0.004 }));
  g.add(k.plane(0.5, 0.9, night ? k.glow("#ffc27a", true, 1.4) : k.paint("#1f1a15"), { at: [cx - 0.2, base + 0.47, cz + cd / 2 - 0.15] }));
  // Railing round the open side of the deck.
  const railM = k.wood("#9c7552", { gloss: 0.15 });
  const ry = d.y + 0.03;
  const posts: V3[] = [
    [x0 + 0.05, ry, zf - 0.05],
    [x1 - 0.05, ry, zf - 0.05],
    [x1 - 0.05, ry, zb + 0.05],
  ];
  for (const p of posts) g.add(board(k, p, [p[0], p[1] + 0.85, p[2]], 0.07, 0.07, railM, [0, 0, 1], 0.005));
  g.add(board(k, [x0 + 0.62, ry + 0.85, zf - 0.05], [x1 - 0.05, ry + 0.85, zf - 0.05], 0.08, 0.03, railM, [0, 1, 0]));
  g.add(board(k, [x1 - 0.05, ry + 0.85, zf - 0.05], [x1 - 0.05, ry + 0.85, zb + 0.05], 0.08, 0.03, railM, [0, 1, 0]));
  g.add(board(k, [x0 + 0.62, ry + 0.45, zf - 0.05], [x1 - 0.05, ry + 0.45, zf - 0.05], 0.06, 0.025, railM, [0, 0, 1]));
  // A ladder up to the gap in the railing.
  const lx = x0 + 0.33;
  const foot: V3 = [lx, 0, zf + 0.75];
  const head: V3 = [lx, d.y + 0.02, zf];
  for (const dx of [-0.2, 0.2]) g.add(board(k, [foot[0] + dx, foot[1], foot[2]], [head[0] + dx, head[1] + 0.6, head[2] - 0.15], 0.07, 0.045, frame, [0, 0.27, 1]));
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 9.2;
    const y = foot[1] + (head[1] + 0.6 - foot[1]) * t;
    const z = foot[2] + (head[2] - 0.15 - foot[2]) * t;
    g.add(k.cyl(0.018, 0.018, 0.4, frame, { at: [lx, y, z + 0.01], rot: [0, 0, PI / 2], seg: 8 }));
  }
  // Bunting along the front rail, a flag in the colour of each unit in turn.
  const flags = ["#0369a1", "#7c3aed", "#047857", "#fbbf24", "#e11d48", "#0e7490", "#4f46e5", "#fb923c", "#0f766e"];
  const by = ry + 0.85;
  const span = x1 - 0.05 - (x0 + 0.62);
  flags.forEach((col, i) => {
    const fx = x0 + 0.62 + ((i + 0.5) / flags.length) * span;
    const sag = Math.sin(((i + 0.5) / flags.length) * PI) * 0.08;
    g.add(k.extrude([[-0.06, 0], [0.06, 0], [0, -0.13]], 0.004, k.fabric(col), { at: [fx, by - 0.01 - sag, zf - 0.02], bevel: 0.0008 }));
  });
  g.add(k.tube([[x0 + 0.62, by, zf - 0.03], [x0 + 0.62 + span / 2, by - 0.085, zf - 0.03], [x1 - 0.05, by, zf - 0.03]], 0.003, k.paper("#efe9dc"), { seg: 16 }));
  if (night) {
    g.add(k.sphere(0.05, k.glow("#ffd59a", true, 3), { at: [x1 - 0.12, ry + 0.95, zf - 0.08], seg: 14 }));
    const l = new THREE.PointLight("#ffc98a", 3, 6, 2);
    l.position.set(x1 - 0.12, ry + 1.0, zf + 0.1);
    g.add(l);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The bed and its plants
// ---------------------------------------------------------------------------

const STAGE_N: Record<GardenBed["stage"], number> = { seed: 0, sprout: 1, leaf: 2, bud: 3, bloom: 4 };
/** How big the leaves are at each stage. */
const GROWTH = [0, 0.3, 0.7, 0.9, 1];
/** Plants are grown a little generous, so the stages read from the lawn. */
const PLANT_SCALE = 1.55;

interface PlantMats {
  petal: THREE.Material;
  deep: THREE.Material;
  bud: THREE.Material;
  stem: THREE.Material;
  leaf: THREE.Material[];
  grey: THREE.Material;
  blue: THREE.Material;
  silver: THREE.Material;
  centre: THREE.Material;
  foliage: (tint: string, r: number) => THREE.Material;
}

const DAISY = petalOutline(18, 0.011, 0.047, "round");
const SUNFLOWER = petalOutline(22, 0.058, 0.122, "point");
const BRACTS = petalOutline(15, 0.05, 0.088, "point");

/** A daisy's head, facing +z: a ring of petals round a golden middle. */
function daisyHead(k: Kit, p: PlantMats): THREE.Group {
  return k.group([k.extrude(DAISY, 0.004, p.petal, { bevel: 0.0008 }), k.sphere(1, p.centre, { at: [0, 0, 0.003], scale: [0.0135, 0.0135, 0.0075], seg: 14 })]);
}

/** A tulip's cup, along +y: a closed cup with two outer petals standing proud of it. */
function tulipHead(k: Kit, petal: THREE.Material): THREE.Group {
  const g = k.group([
    k.lathe(
      [
        [0.0005, 0],
        [0.012, 0.004],
        [0.02, 0.014],
        [0.0235, 0.029],
        [0.0228, 0.044],
        [0.0185, 0.057],
        [0.0155, 0.062],
        [0.011, 0.059],
        [0.0005, 0.052],
      ],
      petal,
      { seg: 18 }
    ),
  ]);
  for (let i = 0; i < 2; i += 1) {
    const a = i * PI + 0.5;
    const pivot = k.group([k.sphere(1, petal, { at: [0, 0.033, 0], scale: [0.018, 0.037, 0.007], seg: 12 })], { at: [Math.sin(a) * 0.014, 0.0, Math.cos(a) * 0.014] });
    g.add(aim(pivot, a, 0.12));
  }
  return g;
}

/** A poppy's open bowl, along +y, with its dark ring of stamens and the seed head. */
function poppyHead(k: Kit, p: PlantMats): THREE.Group {
  return k.group([
    k.lathe(
      [
        [0.003, 0],
        [0.017, 0.004],
        [0.033, 0.014],
        [0.046, 0.028],
        [0.052, 0.037],
        [0.049, 0.039],
        [0.037, 0.028],
        [0.022, 0.017],
        [0.006, 0.012],
      ],
      p.petal,
      { seg: 22 }
    ),
    k.torus(0.014, 0.0045, k.paint("#1c1922", 0.2), { at: [0, 0.015, 0], rot: [PI / 2, 0, 0], seg: 16 }),
    k.sphere(1, k.paint("#8f9a6a", 0.25), { at: [0, 0.019, 0], scale: [0.0095, 0.008, 0.0095], seg: 12 }),
  ]);
}

/** A sunflower's head, facing +z: pointed petals, green bracts behind, a deep brown middle. */
function sunflowerHead(k: Kit, p: PlantMats, s: number): THREE.Group {
  return k.group(
    [
      k.extrude(SUNFLOWER, 0.005, p.petal, { bevel: 0.001 }),
      k.extrude(BRACTS, 0.004, p.leaf[0], { at: [0, 0, -0.005], rot: [0, 0, 0.11], bevel: 0.001 }),
      k.sphere(1, k.paint("#3a2416", 0.15), { at: [0, 0, 0.004], scale: [0.064, 0.064, 0.022], seg: 22 }),
    ],
    { scale: [s, s, s] }
  );
}

/** A bellflower, along +y with its mouth at y = 0, to hang from a stem. */
function bell(k: Kit, m: THREE.Material, s = 1): THREE.Mesh {
  return k.lathe(
    [
      [0.03 * s, 0],
      [0.025 * s, 0.005 * s],
      [0.02 * s, 0.016 * s],
      [0.017 * s, 0.031 * s],
      [0.011 * s, 0.041 * s],
      [0.0005, 0.044 * s],
    ],
    m,
    { seg: 16 }
  );
}

/** A lavender stem with its spike, along +y: a bare stem, then whorls of tiny flowers tapering to a point. */
function lavenderStem(h: number, spike: number): Pt[] {
  const pts: Pt[] = [
    [0.0024, 0],
    [0.002, h - spike - 0.004],
  ];
  const n = 10;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    pts.push([(i % 2 === 0 ? 0.0088 : 0.006) * (1 - t * 0.45), h - spike + t * spike]);
  }
  pts.push([0.0005, h + 0.01]);
  return pts;
}

/** A rose, along +y: a cupped head, the swirl of its inner petals, one outer petal turning back. */
function roseHead(k: Kit, p: PlantMats): THREE.Group {
  const g = k.group([
    k.lathe(
      [
        [0.0005, 0],
        [0.014, 0.003],
        [0.026, 0.013],
        [0.031, 0.026],
        [0.03, 0.038],
        [0.025, 0.046],
        [0.016, 0.048],
        [0.008, 0.044],
        [0.0005, 0.041],
      ],
      p.petal,
      { seg: 20 }
    ),
    k.torus(0.012, 0.0048, p.deep, { at: [0, 0.045, 0], rot: [PI / 2, 0, 0], seg: 18 }),
  ]);
  const flare = k.group([k.sphere(1, p.petal, { at: [0, 0.018, 0], scale: [0.024, 0.021, 0.006], seg: 12 })], { at: [0, 0.022, 0.027] });
  flare.rotation.x = 0.75;
  g.add(flare);
  return g;
}

/** The point at `t` along a smooth stem through `pts`, the same curve the kit's tube follows. */
function along(pts: V3[], t: number): V3 {
  const p = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))).getPoint(t);
  return [p.x, p.y, p.z];
}

/** A stem from the base out to `top`, gently curved. */
function stemTo(k: Kit, m: THREE.Material, top: V3, r: number, droop = 0): THREE.Mesh {
  const pts: V3[] = [
    [0, 0.004, 0],
    [top[0] * 0.25, top[1] * 0.5, top[2] * 0.25],
    top,
  ];
  if (droop) pts.push([top[0] * 1.15, top[1] - droop, top[2] * 1.15]);
  return k.tube(pts, r, m, { seg: 10 });
}

/** One unit's plant at its stage, standing on the soil at the origin, its flowers turned towards the path. */
function growPlant(k: Kit, kind: Flower, stage: number, p: PlantMats, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rnd = rng(seed);
  const s = GROWTH[stage];
  const face = 0.4; // flowers turn to the south-east, where the path and the camera are
  const yaw0 = rnd() * PI;
  if (stage === 0) return g;
  if (stage === 1) {
    // A sprout: a short stem, its two seed leaves, and the first true pair coming.
    const tilt = (rnd() - 0.5) * 0.2;
    g.add(rod(k, [0, -0.005, 0], [tilt * 0.1, 0.1, 0.004], 0.0042, 0.0032, p.stem, 8));
    g.add(leafAt(k, p.leaf[4], [tilt * 0.1, 0.098, 0.004], 0.05, 0.026, yaw0, 0.28));
    g.add(leafAt(k, p.leaf[4], [tilt * 0.1, 0.098, 0.004], 0.05, 0.026, yaw0 + PI, 0.28));
    g.add(leafAt(k, p.leaf[1], [tilt * 0.1, 0.104, 0.004], 0.036, 0.017, yaw0 + PI / 2, 1.0));
    g.add(leafAt(k, p.leaf[1], [tilt * 0.1, 0.104, 0.004], 0.036, 0.017, yaw0 - PI / 2, 1.0));
    return g;
  }
  const budding = stage === 3;
  const blooming = stage === 4;
  const flowering = stage >= 3;
  /** Where the i-th of n flower stems ends: round the clump, leaning out a little. */
  const tipAt = (i: number, n: number, reach: number, h: number): V3 => {
    const a = (i / n) * PI * 2 + yaw0 + rnd() * 0.6;
    const r = reach * (0.45 + rnd() * 0.55);
    return [Math.sin(a) * r, h * (0.85 + rnd() * 0.25), Math.cos(a) * r];
  };

  if (kind === "daisy") {
    g.add(clump(k, p.leaf[1], fanOutline(5, 0.21 * s, 0.036 * s, 2.5, 0.75, seed, "lance"), 3, yaw0));
    if (!flowering) return g;
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const top = tipAt(i, n, 0.12, budding ? 0.32 : 0.44);
      g.add(stemTo(k, p.stem, top, 0.0032));
      if (budding) g.add(k.sphere(1, p.bud, { at: top, scale: [0.013, 0.011, 0.013], seg: 12 }));
      else g.add(aim(k.group([daisyHead(k, p)], { at: top }), face + (rnd() - 0.5) * 1.1, -(0.75 + rnd() * 0.5)));
    }
    return g;
  }

  if (kind === "tulip") {
    g.add(clump(k, p.blue, fanOutline(2, 0.27 * s, 0.075 * s, 1.15, 0.7, seed, "strap"), 2, yaw0));
    if (!flowering) return g;
    const n = 4;
    for (let i = 0; i < n; i += 1) {
      const top = tipAt(i, n, 0.06, budding ? 0.32 : 0.42);
      g.add(rod(k, [0, 0.004, 0], top, 0.0048, 0.004, p.stem, 8));
      const head = budding ? k.group([k.sphere(1, p.bud, { at: [0, 0.028, 0], scale: [0.015, 0.032, 0.015], seg: 14 })]) : tulipHead(k, p.petal);
      head.position.set(...top);
      head.rotation.set(...between([0, 0.004, 0], top).rot);
      g.add(head);
    }
    return g;
  }

  if (kind === "poppy") {
    g.add(clump(k, p.grey, fanOutline(3, 0.17 * s, 0.055 * s, 2.7, 0.9, seed, "toothed"), 3, yaw0));
    if (!flowering) return g;
    const n = 5;
    for (let i = 0; i < n; i += 1) {
      const top = tipAt(i, n, 0.16, budding ? 0.36 : 0.5);
      const nod = budding || i === n - 1;
      g.add(stemTo(k, p.stem, top, 0.0028, nod ? 0.05 : 0));
      if (nod) g.add(k.sphere(1, p.leaf[4], { at: [top[0] * 1.18, top[1] - 0.07, top[2] * 1.18], scale: [0.012, 0.018, 0.012], seg: 12 }));
      else {
        const head = poppyHead(k, p);
        head.position.set(...top);
        aim(head, face + (rnd() - 0.5) * 0.8, 0.35 + rnd() * 0.25);
        g.add(head);
      }
    }
    return g;
  }

  if (kind === "sunflower") {
    const H = budding ? 0.95 : blooming ? 1.25 : 0.55;
    g.add(k.tube([[0, 0, 0], [0.01, H * 0.5, -0.005], [0.03, H, 0.02]], 0.014, p.stem, { seg: 14 }));
    const n = flowering ? 7 : 5;
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.6) / (n + 0.6);
      const len = (0.21 - t * 0.07) * Math.max(0.8, s);
      g.add(leafAt(k, p.leaf[i % 3], [0.01 + t * 0.02, H * (0.1 + t * 0.78), 0], len, len * 0.82, yaw0 + i * 2.4, -0.35 + rnd() * 0.25, (rnd() - 0.5) * 0.5));
    }
    const top: V3 = [0.03, H, 0.02];
    if (budding) g.add(aim(k.group([k.extrude(BRACTS, 0.006, p.leaf[0], { scale: [0.6, 0.6, 1], bevel: 0.001 }), k.sphere(1, p.leaf[1], { scale: [0.035, 0.035, 0.02], seg: 14 })], { at: top }), face, -1.1));
    else if (blooming) {
      g.add(aim(k.group([sunflowerHead(k, p, 1)], { at: [top[0], top[1] + 0.02, top[2] + 0.02] }), face, -0.3));
      const side: V3 = [-0.13, H * 0.72, 0.07];
      g.add(k.tube([[0.015, H * 0.6, 0], [-0.06, H * 0.66, 0.03], side], 0.007, p.stem, { seg: 10 }));
      g.add(aim(k.group([sunflowerHead(k, p, 0.62)], { at: side }), face - 0.5, -0.45));
    }
    return g;
  }

  if (kind === "bell") {
    g.add(clump(k, p.leaf[2], fanOutline(3, 0.13 * s, 0.075 * s, 2.7, 0.8, seed, "broad"), 3, yaw0));
    if (!flowering) return g;
    for (let i = 0; i < 3; i += 1) {
      const yaw = (i / 3) * PI * 2 + yaw0 + rnd() * 0.5;
      const reach = 0.11 + rnd() * 0.06;
      const h = (budding ? 0.32 : 0.44) + rnd() * 0.08;
      const dx = Math.sin(yaw) * reach;
      const dz = Math.cos(yaw) * reach;
      const pts: V3[] = [
        [0, 0.004, 0],
        [dx * 0.3, h * 0.6, dz * 0.3],
        [dx, h, dz],
        [dx * 1.35, h * 0.9, dz * 1.35],
      ];
      g.add(k.tube(pts, 0.003, p.stem, { seg: 14 }));
      const count = 4;
      const sz = budding ? 0.6 : 1;
      for (let j = 0; j < count; j += 1) {
        const at = along(pts, 0.42 + (j / count) * 0.56);
        const b = k.group([bell(k, budding ? p.bud : p.petal, sz)], { at: [at[0], at[1] - 0.044 * sz - 0.004, at[2]] });
        b.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5);
        g.add(b);
      }
    }
    return g;
  }

  if (kind === "lavender") {
    g.add(clump(k, p.silver, fanOutline(9, 0.2 * s, 0.01 * s, 1.6, 0.45, seed, "needle"), 3, yaw0));
    if (!flowering) return g;
    const n = 11;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * PI * 2 + rnd() * 0.5;
      const lean = 0.18 + rnd() * 0.22;
      const h = (budding ? 0.32 : 0.42) + rnd() * 0.1;
      const spike = k.lathe(lavenderStem(h, budding ? 0.05 : 0.08), budding ? p.bud : p.petal, { seg: 8 });
      aim(spike, a, lean);
      spike.position.set(Math.sin(a) * 0.02, 0.01, Math.cos(a) * 0.02);
      g.add(spike);
    }
    return g;
  }

  // Rose: canes with glossy leaves along them, then buds and roses at the tips.
  const cane = k.paint("#4f5a2e", 0.2);
  const tips: V3[] = [];
  for (let i = 0; i < 4; i += 1) {
    const top = tipAt(i, 4, 0.16 * s, (0.46 + (blooming ? 0.08 : 0)) * s);
    g.add(rod(k, [0, 0, 0], top, 0.0065, 0.004, cane, 8));
    tips.push(top);
  }
  const glossy = (r: number) => p.foliage("#3f6a37", r);
  for (let i = 0; i < 4; i += 1) {
    const t = tips[i];
    const r = (0.1 + rnd() * 0.03) * s;
    g.add(k.sphere(1, glossy(r), { at: [t[0] * 0.75, t[1] * (0.55 + (i % 2) * 0.18), t[2] * 0.75], scale: [r, r * 0.85, r], seg: 14 }));
  }
  g.add(clump(k, p.leaf[3], fanOutline(4, 0.13 * s, 0.05 * s, 2.4, 0.6, seed, "lance"), 2, yaw0));
  if (!flowering) return g;
  tips.forEach((top, i) => {
    if (budding || i === 3) {
      g.add(k.sphere(1, p.leaf[0], { at: [top[0], top[1] + 0.008, top[2]], scale: [0.012, 0.012, 0.012], seg: 10 }));
      g.add(k.sphere(1, budding ? p.bud : p.petal, { at: [top[0], top[1] + 0.024, top[2]], scale: [0.012, 0.024, 0.012], seg: 12 }));
    } else {
      const head = roseHead(k, p);
      head.position.set(top[0], top[1], top[2]);
      aim(head, face + (rnd() - 0.5) * 0.8, 0.3 + rnd() * 0.2);
      g.add(head);
    }
  });
  return g;
}

/** A unit's plant colours: the unit's hue for the flower (a paler tint of it for the greens, so it stands out from the leaves), a deeper shade, a bud half green. */
function plantMats(c: Ctx, bed: GardenBed): PlantMats {
  const { k } = c;
  // Deep hues are 600 or 700 (solid) with a brighter 500 (bar); bright ones are 400 (solid). Petals take the brighter.
  const bright = bed.hue.onSolid !== "#ffffff";
  const col = new THREE.Color(bright ? bed.hue.solid : bed.hue.bar);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  if (hsl.h > 0.19 && hsl.h < 0.46) col.lerp(new THREE.Color("#ffffff"), 0.42);
  const petalHex = `#${col.getHexString()}`;
  const deepHex = `#${col.clone().multiplyScalar(0.62).getHexString()}`;
  const budHex = `#${col.clone().lerp(new THREE.Color("#5a7f3a"), 0.5).getHexString()}`;
  return {
    petal: k.velvet(petalHex),
    deep: k.velvet(deepHex),
    bud: k.velvet(budHex),
    stem: k.paint("#557a3a", 0.25),
    leaf: [k.leaf(0), k.leaf(1), k.leaf(2), k.leaf(3), k.leaf(4)],
    grey: k.paint("#6f8a62", 0.2),
    blue: k.paint("#5a8467", 0.3),
    silver: k.paint("#8b9c86", 0.15),
    centre: k.paint("#d39a1d", 0.25),
    foliage: (tint: string, r: number) => foliage(c, tint, r),
  };
}

/** The label stake in front of a plant: a pointed stick and a tag in the unit's colour with its number. */
function labelStake(c: Ctx, bed: GardenBed): THREE.Group {
  const { k } = c;
  const label = once(c, `label:${bed.number}:${bed.hue.solid}`, () =>
    k.print(
      canvasTexture(160, 112, (g, w, h) => {
        g.fillStyle = bed.hue.solid;
        g.fillRect(0, 0, w, h);
        g.strokeStyle = bed.hue.onSolid;
        g.globalAlpha = 0.35;
        g.lineWidth = 5;
        g.strokeRect(9, 9, w - 18, h - 18);
        g.globalAlpha = 1;
        g.fillStyle = bed.hue.onSolid;
        g.font = "700 70px Inter, system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(bed.number), w / 2, h / 2 + 4);
      }),
      { roughness: 0.55 }
    )
  );
  const s = k.group([k.box(0.014, 0.26, 0.008, k.wood("maple", { gloss: 0.1 }), { at: [0, 0.07, 0], r: 0.002 }), k.box(0.086, 0.06, 0.007, label, { at: [0, 0.205, 0.006], r: 0.002 })]);
  s.rotation.x = -0.32;
  return s;
}

/** The cedar raised bed, and in it one plant for every unit, in two staggered rows in course order. */
function buildBed(c: Ctx, state: GardenState): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  g.userData.gardenPart = "bed";
  const { x, z, length: Lb, width: Wb } = L.bed;
  g.position.set(x, 0, z);
  const cedar = k.wood("#a0694a", { gloss: 0.18 });
  const cedar2 = k.wood("#93603f", { gloss: 0.15 });
  const boardH = 0.145;
  const t = 0.04;
  const courses = 3;
  const H = boardH * courses;
  for (const sz of [-1, 1])
    for (let i = 0; i < courses; i += 1) {
      const y = boardH * (i + 0.5);
      for (const sx of [-1, 1]) g.add(k.box(Lb / 2 - 0.004, boardH - 0.006, t, (i + sx) % 2 ? cedar : cedar2, { at: [(sx * Lb) / 4, y, sz * (Wb / 2 - t / 2)], r: 0.006 }));
    }
  for (const sx of [-1, 1])
    for (let i = 0; i < courses; i += 1) g.add(k.box(t, boardH - 0.006, Wb - 2 * t, i % 2 ? cedar2 : cedar, { at: [sx * (Lb / 2 - t / 2), boardH * (i + 0.5), 0], r: 0.006 }));
  // Corner and middle posts inside, and the cap boards lying flat on top.
  for (const px of [-Lb / 2 + t + 0.045, 0, Lb / 2 - t - 0.045])
    for (const sz of [-1, 1]) g.add(k.box(0.09, H + 0.005, 0.09, cedar2, { at: [px, (H + 0.005) / 2, sz * (Wb / 2 - t - 0.045)] }));
  const capY = H + 0.016;
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) g.add(k.box(Lb / 2 + 0.02, 0.03, 0.14, cedar, { at: [sx * (Lb / 4 + 0.01), capY, sz * (Wb / 2 - 0.05)], r: 0.006 }));
  for (const sx of [-1, 1]) g.add(k.box(0.14, 0.03, Wb - 0.24, cedar, { at: [sx * (Lb / 2 - 0.05), capY, 0], r: 0.006 }));
  // Galvanised brackets on the corners, screwed in.
  const steel = k.metal("steel", 0.5);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      g.add(k.box(0.003, 0.3, 0.07, steel, { at: [sx * (Lb / 2 + 0.0015), 0.22, sz * (Wb / 2 - 0.035)] }));
      g.add(k.box(0.07, 0.3, 0.003, steel, { at: [sx * (Lb / 2 - 0.035), 0.22, sz * (Wb / 2 + 0.0015)] }));
      if (sz > 0)
        for (const sy of [0.12, 0.32]) g.add(k.cyl(0.006, 0.006, 0.004, k.metal("silver", 0.35), { at: [sx * (Lb / 2 - 0.035), sy, Wb / 2 + 0.0035], rot: [PI / 2, 0, 0], seg: 10 }));
    }
  // The soil: wet and dark on a watered day.
  const soilTop = H - 0.05;
  const soil = state.watered
    ? printed(c, "soil:wet", () => paint("soil", 512, 512, drawSoil, [(Lb - 2 * t) / 0.6, (Wb - 2 * t) / 0.6]), 0.5, "#7e6c60")
    : printed(c, "soil", () => paint("soil", 512, 512, drawSoil, [(Lb - 2 * t) / 0.6, (Wb - 2 * t) / 0.6]), 1);
  g.add(k.box(Lb - 2 * t - 0.002, 0.06, Wb - 2 * t - 0.002, soil, { at: [0, soilTop - 0.03, 0] }));
  const moundM = state.watered
    ? printed(c, "soil:wet:mound", () => paint("soil", 512, 512, drawSoil, [0.6, 0.6]), 0.5, "#7e6c60")
    : printed(c, "soil:mound", () => paint("soil", 512, 512, drawSoil, [0.6, 0.6]), 1);

  // Plants: odd units along the back row, even units in front between them.
  const beds = state.beds;
  const back = Math.ceil(beds.length / 2);
  const step = (Lb - 2 * t - 0.12) / Math.max(1, back);
  const x0 = -Lb / 2 + t + 0.06;
  beds.forEach((bed, i) => {
    const row = i % 2;
    const px = x0 + (Math.floor(i / 2) + 0.5 + row * 0.5) * step;
    const pz = row ? 0.26 : -0.25;
    const unit = new THREE.Group();
    unit.userData.gardenUnit = bed.number;
    unit.position.set(px, soilTop, pz);
    const st = STAGE_N[bed.stage];
    // The mound it was sown in: fresh and high for a seed, settled once it grows.
    unit.add(k.sphere(1, moundM, { scale: st === 0 ? [0.17, 0.065, 0.16] : [0.15, 0.035, 0.15], seg: 18 }));
    if (st === 0) unit.add(k.disc(0.014, k.paint("#1c130d"), { at: [0.0, 0.0655, 0.0], rot: [-PI / 2, 0, 0], seg: 12 }));
    const plant = growPlant(k, bed.flower, st, plantMats(c, bed), 500 + bed.number * 37);
    plant.scale.setScalar(PLANT_SCALE);
    unit.add(plant);
    const stake = labelStake(c, bed);
    stake.position.set(0.12, -0.04, 0.16);
    unit.add(stake);
    g.add(unit);
  });
  return g;
}

// ---------------------------------------------------------------------------
// The sprinkler, the hose, a watering can, fireflies
// ---------------------------------------------------------------------------

/** An oscillating sprinkler behind the bed, the hose to it from the tap, and on a watered day, its spray over the bed. */
function buildSprinkler(c: Ctx, watered: boolean): THREE.Group {
  const { k } = c;
  const g = new THREE.Group();
  g.userData.gardenPart = "sprinkler";
  const { x, z } = L.sprinkler;
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  const body = k.plastic("#3b7a45", 0.45);
  const grey = k.plastic("#c9ccc8", 0.5);
  const alu = k.metal("steel", 0.28);
  for (const sx of [-1, 1]) {
    s.add(k.box(0.05, 0.022, 0.3, body, { at: [sx * 0.17, 0.011, 0], r: 0.008 }));
    s.add(k.box(0.06, 0.08, 0.08, grey, { at: [sx * 0.17, 0.06, 0], r: 0.012 }));
  }
  // The spray tube, bowed upwards, tipped forward over the bed.
  const tilt = 0.35;
  const tube = k.torus(0.5, 0.011, alu, { at: [0, 0.075 - 0.5 * Math.cos(0.33), 0], rot: [0, 0, 0], arc: 0.66, seg: 24 });
  tube.rotation.set(0, 0, PI / 2 - 0.33);
  const arm = k.group([tube]);
  arm.rotation.x = tilt;
  s.add(arm);
  s.add(k.cyl(0.016, 0.016, 0.05, k.metal("brass", 0.3), { at: [0.225, 0.06, 0], rot: [0, 0, PI / 2], seg: 12 }));
  g.add(s);

  // The hose, from the tap at the wall along the gravel and over the lawn.
  const hoseM = k.plastic("#2f6e3c", 0.35);
  const tap: V3 = [2.35, 0.44, L.wallZ + 0.12];
  g.add(
    k.tube(
      [
        tap,
        [2.4, 0.12, L.wallZ + 0.22],
        [2.6, 0.016, L.wallZ + 0.6],
        [3.3, 0.016, -5.6],
        [3.6, 0.016, -4.2],
        [3.0, 0.016, -3.1],
        [2.4, 0.016, -2.4],
        [2.7, 0.016, -1.3],
        [3.3, 0.016, -0.75],
        [x + 0.3, 0.05, z],
      ],
      0.013,
      hoseM,
      { seg: 90 }
    )
  );

  if (watered) {
    // Jets fanning out from the tube, arcing over and falling into the bed.
    const spray = k.glass("#f2f9fd", 0.5);
    const drops = k.glass("#f7fcff", 0.7);
    const rnd = rng(17);
    const n = 13;
    const g9 = 9.81;
    for (let i = 0; i < n; i += 1) {
      const f = i / (n - 1) - 0.5;
      const start = new THREE.Vector3(f * 0.3, 0.1, 0.02);
      const vy = 5.4 + rnd() * 0.3;
      const vz = vy * (0.28 + rnd() * 0.05);
      const vx = f * 2.1;
      const land = (vy + Math.sqrt(vy * vy - 2 * g9 * (0.46 - start.y))) / g9;
      const pts: V3[] = [];
      const steps = 12;
      for (let j = 0; j <= steps; j += 1) {
        const tt = (j / steps) * land * 0.78;
        pts.push([start.x + vx * tt, start.y + vy * tt - 0.5 * g9 * tt * tt, start.z + vz * tt]);
      }
      const jet = k.tube(pts, 0.0042, spray, { seg: 30 });
      jet.castShadow = false;
      s.add(jet);
      // The end of each jet breaks into drops.
      for (let j = 0; j < 3; j += 1) {
        const tt = land * (0.8 + j * 0.07 + rnd() * 0.04);
        const d = k.sphere(0.008 + rnd() * 0.005, drops, { at: [start.x + vx * tt + (rnd() - 0.5) * 0.06, start.y + vy * tt - 0.5 * g9 * tt * tt, start.z + vz * tt + (rnd() - 0.5) * 0.06], seg: 8 });
        d.castShadow = false;
        s.add(d);
      }
    }
  }
  return g;
}

/** A galvanised watering can left by the end of the bed. */
function wateringCan(k: Kit): THREE.Group {
  const zinc = k.metal("#aab0b4", 0.48);
  const g = k.group([
    k.cyl(0.1, 0.11, 0.24, zinc, { at: [0, 0.12, 0], seg: 28 }),
    k.cyl(0.085, 0.1, 0.03, zinc, { at: [0, 0.255, 0], seg: 28 }),
    k.torus(0.05, 0.008, zinc, { at: [0.02, 0.272, 0], rot: [PI / 2, 0, 0], seg: 20 }),
    rod(k, [0.07, 0.06, 0], [0.38, 0.33, 0], 0.017, 0.011, zinc, 10),
    k.cyl(0.032, 0.014, 0.045, zinc, { at: [0.395, 0.345, 0], rot: [0, 0, -0.85], seg: 16 }),
    k.torus(0.11, 0.009, zinc, { at: [-0.02, 0.27, 0], arc: PI, seg: 20 }),
    k.torus(0.07, 0.009, zinc, { at: [-0.105, 0.15, 0], rot: [0, 0, PI / 2], arc: PI, seg: 16 }),
  ]);
  return g;
}

/** Fireflies over the lawn on a summer night. */
function fireflies(k: Kit): THREE.Group {
  const g = new THREE.Group();
  const rnd = rng(97);
  const m = k.glow("#e4ff8c", true, 7);
  for (let i = 0; i < 16; i += 1) {
    const d = k.sphere(0.022, m, { at: [-5 + rnd() * 10, 0.4 + rnd() * 1.4, -4 + rnd() * 9], seg: 8 });
    d.castShadow = false;
    g.add(d);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The garden
// ---------------------------------------------------------------------------

/**
 * The whole backyard for a garden state, without the ornaments (the engine
 * places those). Night darkens the sky to stars and a moon, lights the
 * windows, the back-door lantern and the treehouse, and brings out
 * fireflies; the scene's sun, moon and sky light are the caller's.
 *
 * Tappable parts carry userData: each unit's plant group has `gardenUnit`
 * (the unit number), and the tree's and the sprinkler's groups have
 * `gardenPart` ("tree", "sprinkler"; also "house", "bed", "fence", "lawn").
 */
export function buildGarden(k: Kit, state: GardenState, opts: { night: boolean; styleId: string }): { group: THREE.Group; dispose(): void } {
  const theme = themeFor(opts.styleId);
  const [group, own] = k.collect(() => {
    const c: Ctx = { k, cache: new Map() };
    const g = new THREE.Group();
    g.name = "garden";
    g.add(buildGround(c, opts.night));
    g.add(buildHouse(c, theme, opts.night));
    g.add(buildFence(c));
    g.add(buildBorders(c));
    // Trees in the neighbours' yards, beyond the fence and behind the house.
    g.add(farTree(c, [-10.6, 0, -4.5], 9.5, 2.8, "#55803d", 11));
    g.add(farTree(c, [-11.5, 0, 3.5], 8.0, 2.5, "#5f8742", 12));
    g.add(farTree(c, [10.8, 0, -8.5], 10.5, 3.1, "#4f7a3a", 13));
    g.add(farTree(c, [-1.5, 0, -18.5], 12.0, 3.8, "#577f3d", 14));
    g.add(farSpruce(c, [10.4, 0, 1.5], 9.0));
    g.add(farSpruce(c, [-9.8, 0, -11.5], 10.5));
    // Stepping stones from the back door down to the bed.
    const flags = ["#a69d90", "#9a958d"].map((tint) =>
      printed(c, `flag:${tint}`, () => {
        const t = TEX.concrete().clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1.6, 1.6);
        return t;
      }, 0.88, tint)
    );
    const rnd = rng(23);
    const stones = 8;
    for (let i = 0; i < stones; i += 1) {
      const t = i / (stones - 1);
      const sx = L.doorX + Math.sin(t * PI * 1.1) * 0.35 - t * 0.3;
      const sz = L.wallZ + 1.45 + t * (L.bed.z - L.bed.width / 2 - 0.5 - (L.wallZ + 1.45));
      const outline: Pt[] = [];
      const rx = 0.27 + rnd() * 0.06;
      const rz = 0.21 + rnd() * 0.05;
      for (let j = 0; j < 14; j += 1) {
        const a = (j / 14) * PI * 2;
        const wob = 0.88 + rnd() * 0.2;
        outline.push([Math.cos(a) * rx * wob, Math.sin(a) * rz * wob]);
      }
      g.add(k.extrude(outline, 0.05, flags[i % 2], { at: [sx, -0.004, sz], rot: [-PI / 2, 0, rnd() * PI], bevel: 0.012 }));
    }
    g.add(buildBed(c, state));
    g.add(buildTree(c, state, opts.night));
    g.add(buildSprinkler(c, state.watered));
    const can = wateringCan(k);
    can.position.set(L.bed.x + L.bed.length / 2 + 0.55, 0, L.bed.z + 0.75);
    can.rotation.y = -0.7;
    g.add(can);
    if (opts.night) g.add(fireflies(k));
    return g;
  });
  return {
    group,
    dispose() {
      for (const d of own) d.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Ornaments
// ---------------------------------------------------------------------------

/** A material cache for one ornament's build. */
const ornamentCtx = (k: Kit): Ctx => ({ k, cache: new Map() });

export const ORNAMENT_MODELS: Record<string, ItemModel> = {
  flowerbed: {
    size: [1.3, 0.62, 1.3],
    build(k, o) {
      const c = ornamentCtx(k);
      const g = new THREE.Group();
      const rnd = rng(401);
      // A ring of stones, two courses, the upper set over the joints of the lower.
      const stones = [k.stone("sandstone"), k.stone("granite")];
      for (let course = 0; course < 2; course += 1) {
        const n = 9;
        for (let i = 0; i < n; i += 1) {
          const a = ((i + course * 0.5) / n) * PI * 2;
          const r = 0.55 - course * 0.02;
          const sw = 0.36 + rnd() * 0.04;
          const sh = 0.13 + rnd() * 0.02;
          const st = k.box(sw, sh, 0.17, stones[(i + course) % 2 === 0 ? 0 : 1], { at: [Math.sin(a) * r, 0.065 + course * 0.135, Math.cos(a) * r], r: 0.035 });
          st.rotation.y = a;
          g.add(st);
        }
      }
      g.add(k.cyl(0.48, 0.48, 0.04, printed(c, "soil", () => paint("soil", 512, 512, drawSoil, [1.6, 1.6]), 1), { at: [0, 0.25, 0], seg: 32 }));
      // A mound of foliage, and flowers in the swatch's colour (marigolds by default), salvia spikes behind.
      g.add(k.sphere(1, foliage(c, "#55803f", 0.3), { at: [0, 0.3, 0], scale: [0.42, 0.18, 0.42], seg: 20 }));
      const petal = k.velvet(o.color ?? "#e08a2c");
      const centre = k.paint("#7a4a12", 0.2);
      for (let i = 0; i < 7; i += 1) {
        const a = i * 2.4 + 0.3;
        const r = 0.12 + (i % 3) * 0.1;
        const head = k.group([k.extrude(DAISY, 0.004, petal, { scale: [0.85, 0.85, 1], bevel: 0.0008 }), k.sphere(1, centre, { at: [0, 0, 0.003], scale: [0.016, 0.016, 0.009], seg: 12 })], { at: [Math.sin(a) * r, 0.44 + rnd() * 0.04, Math.cos(a) * r] });
        g.add(aim(head, 0.3 + (rnd() - 0.5) * 0.8, -(0.9 + rnd() * 0.4)));
      }
      // Salvia spikes standing up behind.
      const salvia = k.velvet("#5b4a9c");
      for (let i = 0; i < 4; i += 1) {
        const a = -1.2 + i * 0.8 + PI;
        const spike = k.lathe(lavenderStem(0.22 + (i % 2) * 0.04, 0.11), salvia, { at: [Math.sin(a) * 0.22, 0.3, Math.cos(a) * 0.22], seg: 10 });
        aim(spike, a, 0.15);
        g.add(spike);
      }
      return g;
    },
  },

  fence: {
    size: [2.4, 1.1, 0.1],
    build(k, o) {
      const paintM = k.paint(o.color ?? "#f3f1ea", 0.4);
      const g = new THREE.Group();
      // Two posts with ball finials, two rails behind, and pointed pickets.
      for (const sx of [-1, 1]) {
        g.add(board(k, [sx * 1.15, 0, -0.01], [sx * 1.15, 1.0, -0.01], 0.09, 0.09, paintM, [0, 0, 1], 0.008));
        g.add(k.box(0.11, 0.025, 0.11, paintM, { at: [sx * 1.15, 1.012, -0.01], r: 0.006 }));
        g.add(k.sphere(0.042, paintM, { at: [sx * 1.15, 1.06, -0.01], seg: 14 }));
      }
      for (const y of [0.22, 0.75]) g.add(k.box(2.24, 0.07, 0.035, paintM, { at: [0, y, -0.025], r: 0.006 }));
      const picket: Pt[] = [
        [-0.036, 0],
        [0.036, 0],
        [0.036, 0.86],
        [0, 0.93],
        [-0.036, 0.86],
      ];
      const n = 13;
      for (let i = 0; i < n; i += 1) {
        const px = -1.04 + (i * 2.08) / (n - 1);
        g.add(k.extrude(picket, 0.018, paintM, { at: [px, 0.05, 0.004], bevel: 0.004 }));
      }
      return g;
    },
  },

  mailbox: {
    size: [0.32, 1.32, 0.56],
    build(k, o) {
      const post = k.wood("#8f6a4a", { gloss: 0.15 });
      const box = k.paint(o.color ?? "#2c3034", 0.6);
      const g = new THREE.Group();
      g.add(board(k, [0, 0, -0.04], [0, 1.02, -0.04], 0.09, 0.09, post, [0, 0, 1], 0.008));
      g.add(board(k, [0, 1.0, -0.26], [0, 1.0, 0.24], 0.14, 0.035, post, [0, 1, 0]));
      g.add(board(k, [0, 0.72, -0.04], [0, 0.98, -0.2], 0.05, 0.035, post, [1, 0, 0]));
      // The box: a flat-sided tunnel with a round top, along z, its door to the front.
      const profile: Pt[] = [
        [-0.083, 0],
        [0.083, 0],
        ...Array.from({ length: 17 }, (_, i) => {
          const a = (i / 16) * PI;
          return [Math.cos(a) * 0.083, 0.13 + Math.sin(a) * 0.083] as Pt;
        }),
      ];
      g.add(k.extrude(profile, 0.47, box, { at: [0, 1.0175, -0.01], bevel: 0.006 }));
      g.add(k.extrude(profile.map(([x, y]) => [x * 1.06, y * 1.04 - 0.004] as Pt), 0.014, box, { at: [0, 1.0175, 0.232], bevel: 0.004 }));
      g.add(k.box(0.05, 0.016, 0.03, k.metal("steel", 0.3), { at: [0, 1.2, 0.254], r: 0.006 }));
      // The flag, up: there is mail.
      const red = k.paint("#b8352b", 0.5);
      g.add(k.box(0.006, 0.2, 0.025, red, { at: [0.089, 1.2, -0.08], rot: [0.25, 0, 0], r: 0.002 }));
      g.add(k.box(0.006, 0.065, 0.085, red, { at: [0.089, 1.29, -0.045], rot: [0.25, 0, 0], r: 0.002 }));
      g.add(k.cyl(0.01, 0.01, 0.012, k.metal("steel"), { at: [0.09, 1.12, -0.1], rot: [0, 0, PI / 2], seg: 10 }));
      return g;
    },
  },

  bench: {
    size: [1.52, 0.92, 0.66],
    build(k, o) {
      const iron = k.metal("black");
      const slat = o.color ? k.paint(o.color, 0.4) : k.wood("#9a6b44", { gloss: 0.3 });
      const g = new THREE.Group();
      // Cast-iron ends: front leg, seat rail, arm, back leg rising to the top rail, with the openings of the casting.
      const end: Pt[] = [
        [0.27, 0],
        [0.31, 0],
        [0.28, 0.2],
        [0.27, 0.42],
        [0.29, 0.58],
        [0.31, 0.62],
        [0.27, 0.66],
        [0.22, 0.63],
        [0.2, 0.5],
        [-0.12, 0.47],
        [-0.2, 0.62],
        [-0.27, 0.9],
        [-0.31, 0.9],
        [-0.27, 0.6],
        [-0.2, 0.42],
        [-0.27, 0.2],
        [-0.31, 0],
        [-0.27, 0],
        [-0.2, 0.2],
        [-0.15, 0.38],
        [0.2, 0.38],
        [0.24, 0.2],
      ];
      const hole: Pt[] = [
        [0.17, 0.41],
        [-0.13, 0.41],
        [-0.1, 0.44],
        [0.16, 0.45],
      ];
      for (const sx of [-1, 1]) g.add(k.extrude(end, 0.04, iron, { at: [sx * 0.7, 0, 0], rot: [0, PI / 2, 0], holes: [hole], bevel: 0.006 }));
      // Seat slats and back slats.
      for (let i = 0; i < 5; i += 1) g.add(k.box(1.48, 0.028, 0.07, slat, { at: [0, 0.405, 0.2 - i * 0.085], r: 0.008 }));
      for (let i = 0; i < 4; i += 1) {
        const y = 0.52 + i * 0.1;
        const zz = -0.17 - (y - 0.5) * 0.36;
        g.add(k.box(1.48, 0.075, 0.026, slat, { at: [0, y, zz], rot: [-0.33, 0, 0], r: 0.008 }));
      }
      // A rod tying the ends together under the seat.
      g.add(k.cyl(0.012, 0.012, 1.4, iron, { at: [0, 0.2, 0], rot: [0, 0, PI / 2], seg: 10 }));
      return g;
    },
  },

  topiary: {
    size: [0.84, 1.88, 0.84],
    build(k, o) {
      const c = ornamentCtx(k);
      const pot = o.color ? k.ceramic(o.color) : k.stone("terracotta");
      const clipped = printed(c, "boxwood", () => paint("boxwood", 256, 256, drawBoxwood, [5, 2.5]), 0.82, "#5c7f45");
      return k.group([
        k.lathe([[0.0, 0], [0.23, 0], [0.25, 0.04], [0.3, 0.46], [0.34, 0.48], [0.34, 0.54], [0.31, 0.55], [0.29, 0.52]], pot, { seg: 36 }),
        k.cyl(0.29, 0.29, 0.02, k.soil(), { at: [0, 0.505, 0], seg: 28 }),
        k.lathe([[0.03, 0], [0.025, 0.4], [0.02, 1.0]], barkMat(c), { at: [0, 0.5, 0], seg: 10 }),
        k.sphere(0.38, clipped, { at: [0, 1.0, 0], seg: 28 }),
        k.sphere(0.25, clipped, { at: [0, 1.6, 0], seg: 24 }),
      ]);
    },
  },

  birdbath: {
    size: [0.62, 0.98, 0.62],
    build(k, o) {
      const stone = o.color ? k.ceramic(o.color) : k.stone("concrete");
      return k.group([
        k.lathe([[0.0, 0], [0.22, 0], [0.22, 0.05], [0.17, 0.08], [0.12, 0.14], [0.09, 0.2]], k.stone("concrete"), { seg: 32 }),
        k.lathe([[0.09, 0.2], [0.065, 0.32], [0.06, 0.5], [0.07, 0.62], [0.1, 0.7], [0.11, 0.72]], k.stone("concrete"), { seg: 28 }),
        k.lathe(
          [
            [0.05, 0.71],
            [0.17, 0.74],
            [0.27, 0.79],
            [0.31, 0.84],
            [0.31, 0.87],
            [0.285, 0.875],
            [0.25, 0.835],
            [0.15, 0.8],
            [0.0, 0.79],
          ],
          stone,
          { seg: 40 }
        ),
        k.cyl(0.255, 0.255, 0.006, k.water("#5b8e9a"), { at: [0, 0.832, 0], seg: 36 }),
        // A sparrow on the rim.
        k.group(
          [
            k.sphere(1, k.paint("#8a6a4c", 0.2), { at: [0, 0.05, 0], scale: [0.032, 0.03, 0.05], seg: 12 }),
            k.sphere(0.021, k.paint("#6f5640", 0.2), { at: [0, 0.085, 0.04], seg: 12 }),
            k.cone(0.006, 0.016, k.paint("#2a2a28"), { at: [0, 0.084, 0.064], rot: [PI / 2, 0, 0], seg: 6 }),
            k.box(0.02, 0.006, 0.05, k.paint("#5f4836", 0.2), { at: [0, 0.055, -0.06], rot: [0.4, 0, 0], r: 0.002 }),
          ],
          { at: [0.21, 0.83, 0.18], rot: [0, 2.3, 0] }
        ),
      ]);
    },
  },

  lamp: {
    size: [0.46, 2.62, 0.46],
    light: { at: [0, 2.35, 0], color: "#ffd59a", intensity: 6, distance: 11 },
    build(k, o) {
      const iron = k.metal("black");
      const finish = o.color ? k.paint(o.color, 0.55) : iron;
      return k.group([
        // A stepped cast base, a fluted pole with collars, the ladder bar, and a warm opal globe.
        k.lathe([[0.0, 0], [0.2, 0], [0.2, 0.05], [0.16, 0.08], [0.15, 0.2], [0.11, 0.24], [0.1, 0.38], [0.07, 0.42], [0.06, 0.45]], finish, { seg: 8 }),
        k.cyl(0.042, 0.05, 1.7, finish, { at: [0, 1.3, 0], seg: 16 }),
        k.torus(0.055, 0.014, finish, { at: [0, 0.55, 0], rot: [PI / 2, 0, 0], seg: 20 }),
        k.torus(0.05, 0.012, finish, { at: [0, 1.9, 0], rot: [PI / 2, 0, 0], seg: 20 }),
        k.box(0.42, 0.028, 0.028, finish, { at: [0, 1.98, 0], r: 0.006 }),
        k.sphere(0.022, finish, { at: [-0.21, 1.98, 0], seg: 10 }),
        k.sphere(0.022, finish, { at: [0.21, 1.98, 0], seg: 10 }),
        k.lathe([[0.04, 0], [0.06, 0.04], [0.09, 0.11], [0.075, 0.13], [0.05, 0.13]], finish, { at: [0, 2.1, 0], seg: 20 }),
        k.sphere(0.17, o.on ? k.glow("#ffe2b4", true, 2.4) : k.ceramic("#efebe2"), { at: [0, 2.37, 0], seg: 28 }),
        k.cone(0.03, 0.06, finish, { at: [0, 2.56, 0], seg: 12 }),
      ]);
    },
  },

  tree: {
    size: [2.6, 3.4, 2.6],
    build(k, o) {
      const c = ornamentCtx(k);
      const g = growTree(c, { trunkR: 0.07, crownY: 2.45, crownR: 1.25, crownH: 0.95, clumps: 10, branches: 4, seed: 717, leaf: o.color ?? "#5f8c3f" });
      g.add(k.cyl(0.6, 0.62, 0.03, printed(c, "mulch:ring", () => paint("mulch", 512, 512, drawMulch, [1.4, 1.4]), 0.96), { at: [0, 0.006, 0], seg: 36 }));
      g.add(k.torus(0.61, 0.012, k.metal("black", 0.6), { at: [0, 0.012, 0], rot: [PI / 2, 0, 0], seg: 48 }));
      return g;
    },
  },

  pond: {
    size: [2.1, 0.5, 1.5],
    build(k, o) {
      const c = ornamentCtx(k);
      const g = new THREE.Group();
      const rnd = rng(503);
      // A kidney of still water over a dark bed, ringed with stones; lily pads, a lily, reeds at the back.
      const kidney: Pt[] = [];
      for (let i = 0; i < 40; i += 1) {
        const a = (i / 40) * PI * 2;
        const r = 1 - 0.18 * Math.max(0, Math.cos(a - PI / 2)) ** 3;
        kidney.push([Math.cos(a) * 0.86 * r, Math.sin(a) * 0.56 * r]);
      }
      g.add(k.extrude(kidney, 0.02, k.paint("#1e2a1f", 0.1), { at: [0, -0.012, 0], rot: [-PI / 2, 0, 0], bevel: 0.002 }));
      const water = k.extrude(kidney, 0.004, k.water("#3e6a63"), { at: [0, 0.008, 0], rot: [-PI / 2, 0, 0], bevel: 0.001 });
      water.castShadow = false;
      g.add(water);
      const stones = [k.stone("sandstone"), k.stone("granite"), k.stone("slate")];
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * PI * 2;
        const r = 1 - 0.18 * Math.max(0, Math.cos(a - PI / 2)) ** 3;
        const sx = Math.cos(a) * (0.86 * r + 0.1);
        const sz = -Math.sin(a) * (0.56 * r + 0.1);
        const st = k.sphere(1, stones[i % 3], { at: [sx, 0.03, sz], scale: [0.13 + rnd() * 0.05, 0.06 + rnd() * 0.03, 0.1 + rnd() * 0.03], rot: [0, -a + rnd() * 0.4, 0], seg: 12 });
        g.add(st);
      }
      const pad = k.paint("#3f6b33", 0.45);
      const padShape = (r: number): Pt[] => Array.from({ length: 22 }, (_, i) => {
        const a = 0.25 + (i / 21) * (PI * 2 - 0.5);
        return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
      }).concat([[0, 0]]);
      g.add(k.extrude(padShape(0.13), 0.006, pad, { at: [0.25, 0.013, 0.05], rot: [-PI / 2, 0, 0.6], bevel: 0.001 }));
      g.add(k.extrude(padShape(0.1), 0.006, pad, { at: [-0.18, 0.013, -0.12], rot: [-PI / 2, 0, 2.4], bevel: 0.001 }));
      const lily = k.velvet(o.color ?? "#e7a3b8");
      g.add(k.group([k.extrude(petalOutline(10, 0.012, 0.05, "point"), 0.008, lily, { rot: [-PI / 2, 0, 0], bevel: 0.002 }), k.extrude(petalOutline(8, 0.008, 0.035, "point"), 0.008, lily, { at: [0, 0.012, 0], rot: [-PI / 2, 0, 0.3], bevel: 0.002 }), k.sphere(0.009, k.paint("#e2b52a"), { at: [0, 0.02, 0], seg: 10 })], { at: [0.21, 0.022, 0.02] }));
      // Reeds at the back.
      const reed = k.paint("#5c7d3c", 0.25);
      for (let i = 0; i < 6; i += 1) g.add(leafAt(k, reed, [-0.45 + i * 0.12, 0.02, -0.52 - (i % 2) * 0.04], 0.42 + (i % 3) * 0.06, 0.03, PI + (rnd() - 0.5) * 0.5, 1.25 + rnd() * 0.15));
      return g;
    },
  },

  fountain: {
    size: [1.7, 1.82, 1.7],
    build(k, o) {
      const stone = o.color ? k.ceramic(o.color) : k.stone("sandstone");
      const water = k.water("#6aa3b3");
      const g = k.group([
        // The basin, rolled rim and all.
        k.lathe(
          [
            [0.0, 0],
            [0.82, 0],
            [0.85, 0.05],
            [0.84, 0.36],
            [0.86, 0.4],
            [0.84, 0.44],
            [0.76, 0.45],
            [0.74, 0.4],
            [0.74, 0.12],
            [0.0, 0.12],
          ],
          stone,
          { seg: 48 }
        ),
        k.cyl(0.745, 0.745, 0.01, water, { at: [0, 0.36, 0], seg: 48 }),
        // The column and the upper bowl.
        k.lathe([[0.17, 0.12], [0.12, 0.2], [0.1, 0.45], [0.09, 0.7], [0.13, 0.86], [0.16, 0.92]], stone, { seg: 28 }),
        k.lathe(
          [
            [0.12, 0.9],
            [0.3, 0.94],
            [0.4, 1.0],
            [0.44, 1.06],
            [0.43, 1.09],
            [0.4, 1.085],
            [0.36, 1.03],
            [0.2, 1.0],
            [0.0, 0.99],
          ],
          stone,
          { seg: 40 }
        ),
        k.cyl(0.395, 0.395, 0.008, water, { at: [0, 1.055, 0], seg: 40 }),
        // The finial the water rises from.
        k.lathe([[0.06, 0.99], [0.045, 1.15], [0.07, 1.25], [0.05, 1.33], [0.035, 1.42], [0.05, 1.47], [0.0, 1.52]], stone, { seg: 20 }),
      ]);
      // Water: a jet from the top, a sheet falling over the upper bowl's rim, rings where it lands.
      const jet = k.cyl(0.012, 0.016, 0.3, water, { at: [0, 1.67, 0], seg: 10 });
      const sheet = k.cyl(0.43, 0.5, 0.68, water, { at: [0, 0.72, 0], seg: 40, open: true });
      const ring = k.torus(0.6, 0.006, k.glass("#f2f9fd", 0.5), { at: [0, 0.368, 0], rot: [PI / 2, 0, 0], seg: 48 });
      for (const w of [jet, sheet, ring]) {
        w.castShadow = false;
        g.add(w);
      }
      return g;
    },
  },
};
