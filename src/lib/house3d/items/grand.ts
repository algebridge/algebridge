/**
 * The grand pieces: the shop's most expensive, built as real collectibles.
 * Sculpture in marble and bronze on proper plinths, real cabinetry and
 * glass, and the fantastical ones (a dragon egg, a portal, a time machine)
 * the way a prop studio would build them for real. Where a piece can show
 * something true, it does: a trophy per unit finished, a fish per day of
 * streak, a crack in the egg per unit, plants that grow with the goals.
 */

import * as THREE from "three";
import { canvasTexture } from "../kit";
import type { Kit, V3 } from "../kit";
import type { ItemModel } from "../types";

type Pt = [number, number];

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const css = (c: THREE.Color) => `#${c.getHexString()}`;
const shade = (hex: string, f: number) => css(new THREE.Color(hex).multiplyScalar(f));
const mix = (a: string, b: string, t: number) => css(new THREE.Color(a).lerp(new THREE.Color(b), t));

/** A fixed random source, so a piece looks the same on every load. */
function seeded(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A smooth line through the points (Catmull-Rom), `steps` points a span; a closed one wraps round. */
function smooth(pts: Pt[], steps = 6, closed = true): Pt[] {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  const out: Pt[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Points round an ellipse, counter-clockwise. */
function ellipse(rx: number, ry: number, cx = 0, cy = 0, n = 32, start = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = start + (i / n) * TAU;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);
const unit = (v: V3): V3 => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** The turn that points a shape's +y along `dir` (a cone, a rod, a claw). */
function aim(dir: V3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...unit(dir)));
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/** A round rod from a (radius ra) to b (radius rb): a leg bone, a strut, a tapered limb. */
function rod(k: Kit, a: V3, b: V3, ra: number, m: THREE.Material, rb = ra, seg = 14): THREE.Mesh {
  return k.cyl(rb, ra, len(sub(b, a)), m, { at: mid(a, b), rot: aim(sub(b, a)), seg });
}

/** A square beam from a to b (a rafter, a brace). */
function beam(k: Kit, a: V3, b: V3, w: number, d: number, m: THREE.Material): THREE.Mesh {
  return k.box(w, len(sub(b, a)), d, m, { at: mid(a, b), rot: aim(sub(b, a)), r: Math.min(w, d) * 0.12 });
}

/** Points along a smooth 3D path, for tubes that should taper in steps. */
function path(points: V3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
}
function span(curve: THREE.CatmullRomCurve3, t0: number, t1: number, n = 8): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i += 1) {
    const p = curve.getPoint(t0 + ((t1 - t0) * i) / n);
    out.push([p.x, p.y, p.z]);
  }
  return out;
}
const pt = (curve: THREE.CatmullRomCurve3, t: number): V3 => {
  const p = curve.getPoint(t);
  return [p.x, p.y, p.z];
};

/** An engraved brass plate: a title and an optional second line. */
function plate(title: string, line: string | null, w = 640, h = 160): THREE.CanvasTexture {
  return canvasTexture(w, h, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#ecd38f");
    g.addColorStop(0.45, "#c49c48");
    g.addColorStop(1, "#8d6a2c");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      c.fillStyle = `rgba(255,255,255,${0.02 + ((y * 37) % 11) / 260})`;
      c.fillRect(0, y, W, 1);
    }
    c.strokeStyle = "rgba(74,50,14,0.55)";
    c.lineWidth = Math.max(2, H * 0.03);
    c.strokeRect(H * 0.07, H * 0.07, W - H * 0.14, H * 0.86);
    c.fillStyle = "#3a280b";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `600 ${Math.round(H * (line ? 0.32 : 0.42))}px Georgia, "Times New Roman", serif`;
    c.fillText(title, W / 2, line ? H * 0.4 : H / 2);
    if (line) {
      c.font = `italic 400 ${Math.round(H * 0.2)}px Georgia, "Times New Roman", serif`;
      c.fillText(line, W / 2, H * 0.72);
    }
  });
}

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------

/** Three turned trophy shapes, [radius, height] from the foot up. */
const CUPS: Pt[][] = [
  // A two-handled loving cup, open at the top.
  [[0.0001, 0], [0.042, 0], [0.044, 0.006], [0.036, 0.012], [0.024, 0.018], [0.011, 0.034], [0.009, 0.06], [0.016, 0.068], [0.009, 0.078], [0.011, 0.094], [0.03, 0.112], [0.048, 0.14], [0.056, 0.178], [0.058, 0.2], [0.054, 0.2], [0.052, 0.18], [0.044, 0.146], [0.0001, 0.13]],
  // A lidded urn with a finial.
  [[0.0001, 0], [0.038, 0], [0.04, 0.008], [0.028, 0.014], [0.011, 0.03], [0.009, 0.064], [0.018, 0.076], [0.04, 0.104], [0.048, 0.14], [0.042, 0.178], [0.028, 0.194], [0.032, 0.2], [0.028, 0.206], [0.011, 0.222], [0.007, 0.236], [0.013, 0.246], [0.0001, 0.262]],
  // A tall goblet.
  [[0.0001, 0], [0.04, 0], [0.042, 0.006], [0.03, 0.012], [0.008, 0.03], [0.006, 0.11], [0.014, 0.12], [0.006, 0.128], [0.012, 0.14], [0.038, 0.17], [0.046, 0.22], [0.048, 0.25], [0.044, 0.25], [0.042, 0.222], [0.034, 0.18], [0.0001, 0.162]],
];

function trophy(k: Kit, kind: number): THREE.Group {
  const gold = k.metal("gold", 0.16);
  const g = k.group([
    k.box(0.1, 0.036, 0.1, k.wood("ebony", { gloss: 0.75 }), { at: [0, 0.018, 0], r: 0.004 }),
    k.lathe(CUPS[kind % CUPS.length], gold, { at: [0, 0.036, 0], seg: 36 }),
  ]);
  if (kind % CUPS.length === 0)
    for (const s of [-1, 1]) g.add(k.torus(0.026, 0.0045, gold, { at: [s * 0.052, 0.198, 0], rot: [0, 0, -s * (Math.PI / 2)], arc: Math.PI, seg: 20 }));
  return g;
}

// ---------------------------------------------------------------------------
// Fish, wings, eggs: shapes more than one piece uses
// ---------------------------------------------------------------------------

/** A small aquarium fish: a glossy body and a forked fin you can see light through. */
function fish(k: Kit, body: string, fin: string, length: number, at: V3, yaw: number, pitch: number): THREE.Group {
  const tail: Pt[] = [[0, 0], [-0.5, 0.44], [-0.34, 0], [-0.5, -0.44]];
  return k.group(
    [
      k.sphere(1, k.ceramic(body), { scale: [length * 0.5, length * 0.19, length * 0.09], seg: 16 }),
      k.extrude(tail.map(([x, y]) => [x * length * 0.55 - length * 0.36, y * length * 0.55] as Pt), 0.002, k.glass(fin, 0.8), { bevel: 0.0005 }),
      k.extrude([[0.06, 0], [-0.16, 0], [-0.22, 0.1]].map(([x, y]) => [x * length, length * 0.16 + y * length] as Pt), 0.0015, k.glass(fin, 0.8), { bevel: 0.0004 }),
    ],
    { at, rot: [0, yaw, pitch] }
  );
}

/**
 * A dragon's wing laid flat: the arm along the front edge, four fingers,
 * and the membrane scalloped between them. Origin at the shoulder, -x back, y up.
 */
function wingParts(scale: number) {
  const S: Pt = [0, 0];
  const E: Pt = [-0.04, 0.17];
  const W: Pt = [0.04, 0.36];
  const tips: Pt[] = [[0.24, 0.48], [0.39, 0.34], [0.43, 0.15], [0.33, -0.03]];
  const B: Pt = [0.19, -0.2];
  const scallop = (a: Pt, b: Pt, depth = 0.32, n = 6): Pt[] => {
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const c: Pt = [lerp(m[0], W[0], depth), lerp(m[1], W[1], depth)];
    const out: Pt[] = [];
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
    }
    return out;
  };
  const outline: Pt[] = [S, E, W, tips[0], ...scallop(tips[0], tips[1]), ...scallop(tips[1], tips[2]), ...scallop(tips[2], tips[3]), ...scallop(tips[3], B, 0.22), [0.08, -0.12]];
  const to3 = ([u, v]: Pt): V3 => [-u * scale, v * scale, 0];
  return {
    outline: outline.map(([u, v]) => [-u * scale, v * scale] as Pt),
    arm: [S, E, W].map(to3),
    fingers: tips.map((t) => [to3(W), to3([lerp(W[0], t[0], 0.5) + 0.012, lerp(W[1], t[1], 0.5) + 0.012]), to3(t)]),
    wrist: to3(W),
  };
}

const EGG_H = 0.5;
const EGG_R = 0.165;
/** The egg's radius a fraction t of the way up: widest a little below the middle, finer at the top. */
const eggR = (t: number) => EGG_R * Math.sin(Math.PI * Math.pow(clamp01(t), 0.8));
function eggProfile(t0: number, t1: number, inset = 0, n = 26): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    out.push([Math.max(0.0001, eggR(t) - inset), t * EGG_H]);
  }
  return out;
}

/** Overlapping dragon scales in the shell's colour, edged in gold, wrapped round an egg. */
function scaleTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(1024, 1024, (c, w, h) => {
    const light = mix(base, "#ffffff", 0.32);
    const dark = shade(base, 0.42);
    c.fillStyle = dark;
    c.fillRect(0, 0, w, h);
    const rows = 30;
    for (let j = 0; j < rows; j += 1) {
      const t = (j + 0.5) / rows;
      const count = Math.max(6, Math.round(44 * Math.max(0.12, eggR(t) / EGG_R)));
      const sw = w / count;
      const sh = h / rows;
      const y = h - (j + 1) * sh;
      for (let i = -1; i <= count; i += 1) {
        const x = (i + (j % 2) * 0.5) * sw;
        const g = c.createLinearGradient(0, y - sh * 0.4, 0, y + sh * 1.3);
        g.addColorStop(0, light);
        g.addColorStop(0.55, base);
        g.addColorStop(1, dark);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x, y - sh * 0.4);
        c.lineTo(x + sw, y - sh * 0.4);
        c.lineTo(x + sw, y + sh * 0.5);
        c.quadraticCurveTo(x + sw, y + sh * 1.35, x + sw / 2, y + sh * 1.35);
        c.quadraticCurveTo(x, y + sh * 1.35, x, y + sh * 0.5);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(222,184,98,0.55)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + sw, y + sh * 0.5);
        c.quadraticCurveTo(x + sw, y + sh * 1.35, x + sw / 2, y + sh * 1.35);
        c.quadraticCurveTo(x, y + sh * 1.35, x, y + sh * 0.5);
        c.stroke();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/** Seven-segment digits, right-aligned, the way a calculator draws them. */
function sevenSeg(c: CanvasRenderingContext2D, text: string, right: number, base: number, hgt: number): void {
  const SEGS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g" };
  const dw = hgt * 0.52;
  const gap = hgt * 0.2;
  const t = hgt * 0.11;
  let x = right;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === ".") {
      c.fillRect(x - t * 0.9, base - t, t, t);
      continue;
    }
    x -= dw + gap;
    const L = x;
    const R = x + dw;
    const T = base - hgt;
    const M = base - hgt / 2;
    const seg = (s: string) => {
      if (s === "a") c.fillRect(L + t * 0.6, T, dw - t * 1.2, t);
      if (s === "g") c.fillRect(L + t * 0.6, M - t / 2, dw - t * 1.2, t);
      if (s === "d") c.fillRect(L + t * 0.6, base - t, dw - t * 1.2, t);
      if (s === "f") c.fillRect(L, T + t * 0.6, t, hgt / 2 - t * 0.9);
      if (s === "b") c.fillRect(R - t, T + t * 0.6, t, hgt / 2 - t * 0.9);
      if (s === "e") c.fillRect(L, M + t * 0.3, t, hgt / 2 - t * 0.9);
      if (s === "c") c.fillRect(R - t, M + t * 0.3, t, hgt / 2 - t * 0.9);
    };
    for (const s of SEGS[ch] ?? "") seg(s);
  }
}

/** A gauge face: cream dial, ticks, numbers, a red needle. */
function gauge(label: string, value: number, maxLabel: number): THREE.CanvasTexture {
  return canvasTexture(256, 256, (c, w) => {
    const r = w / 2;
    const g = c.createRadialGradient(r, r * 0.8, r * 0.1, r, r, r);
    g.addColorStop(0, "#f7f0dc");
    g.addColorStop(1, "#ddd0ad");
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    c.strokeStyle = "#2b2418";
    c.fillStyle = "#2b2418";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let i = 0; i <= 20; i += 1) {
      const a = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
      const inner = i % 5 === 0 ? r - 34 : r - 24;
      c.lineWidth = i % 5 === 0 ? 4 : 2;
      c.beginPath();
      c.moveTo(r + Math.cos(a) * inner, r + Math.sin(a) * inner);
      c.lineTo(r + Math.cos(a) * (r - 14), r + Math.sin(a) * (r - 14));
      c.stroke();
      if (i % 5 === 0) {
        c.font = "600 22px Georgia, serif";
        c.fillText(String(Math.round((i / 20) * maxLabel)), r + Math.cos(a) * (r - 56), r + Math.sin(a) * (r - 56));
      }
    }
    c.font = "italic 600 20px Georgia, serif";
    c.fillText(label, r, r + 56);
    const a = Math.PI * 0.75 + clamp01(value) * Math.PI * 1.5;
    c.strokeStyle = "#a3241c";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(r - Math.cos(a) * 16, r - Math.sin(a) * 16);
    c.lineTo(r + Math.cos(a) * (r - 30), r + Math.sin(a) * (r - 30));
    c.stroke();
    c.fillStyle = "#2b2418";
    c.beginPath();
    c.arc(r, r, 9, 0, TAU);
    c.fill();
  });
}

// ---------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------

export const GRAND_ITEMS: Record<string, ItemModel> = {
  "trophy-case": {
    size: [1.05, 1.95, 0.47],
    light: { at: [0, 1.62, 0.1], color: "#fff0d6", intensity: 1.6, distance: 3.2 },
    build(k, o) {
      const W = 1.0;
      const D = 0.44;
      const body = o.color ? k.paint(o.color, 0.6) : k.wood("walnut", { gloss: 0.6 });
      const pane = k.glass("#e6eff0", 0.14);
      const shelfGlass = k.glass("#cfe5dc", 0.38);
      const led = k.glow("#fff2da", o.on, 2.6);
      const brass = k.metal("brass", 0.28);
      const sideH = 1.69;
      const midY = 0.14 + sideH / 2;
      const g = k.group([
        // Recessed toe, base, sides, top and a two-step cornice.
        k.box(W - 0.06, 0.08, D - 0.05, k.wood("ebony", { gloss: 0.5 }), { at: [0, 0.04, -0.01], r: 0.004 }),
        k.box(W, 0.06, D, body, { at: [0, 0.11, 0], r: 0.006 }),
        k.box(0.03, sideH, D, body, { at: [-W / 2 + 0.015, midY, 0], r: 0.005 }),
        k.box(0.03, sideH, D, body, { at: [W / 2 - 0.015, midY, 0], r: 0.005 }),
        k.box(W, 0.04, D, body, { at: [0, 1.85, 0], r: 0.006 }),
        k.box(W + 0.03, 0.045, D + 0.015, body, { at: [0, 1.8925, 0], r: 0.008 }),
        k.box(W + 0.05, 0.035, D + 0.03, body, { at: [0, 1.9325, 0], r: 0.01 }),
        // A board at the back, lined in navy velvet.
        k.box(W - 0.04, sideH, 0.012, body, { at: [0, midY, -D / 2 + 0.006] }),
        k.box(W - 0.06, sideH - 0.01, 0.01, k.velvet("#1c2433"), { at: [0, midY, -D / 2 + 0.017] }),
        // Lights in the top: two pucks and a strip behind the doors.
        k.cyl(0.028, 0.028, 0.008, led, { at: [-0.25, 1.826, -0.02] }),
        k.cyl(0.028, 0.028, 0.008, led, { at: [0.25, 1.826, -0.02] }),
        k.box(W - 0.08, 0.008, 0.016, led, { at: [0, 1.826, D / 2 - 0.05] }),
      ]);
      // Two glazed doors, framed, with brass knobs where they meet.
      const doorW = (W - 0.06) / 2 - 0.002;
      const doorH = sideH - 0.008;
      const bev = 0.004;
      const rail = 0.045;
      const outline = rect(-doorW / 2 + bev, -doorH / 2 + bev, doorW / 2 - bev, doorH / 2 - bev);
      const hole = rect(-doorW / 2 + rail, -doorH / 2 + rail, doorW / 2 - rail, doorH / 2 - rail);
      for (const s of [-1, 1]) {
        const cx = s * (doorW / 2 + 0.001);
        g.add(k.extrude(outline, 0.022, body, { at: [cx, midY, D / 2 - 0.011], holes: [hole], bevel: bev }));
        g.add(k.box(doorW - rail * 2 + 0.012, doorH - rail * 2 + 0.012, 0.004, pane, { at: [cx, midY, D / 2 - 0.014] }));
        g.add(k.sphere(0.011, brass, { at: [s * 0.03, 1.0, D / 2 + 0.012], seg: 16 }));
      }
      // Glass shelves, each lit along its front edge.
      const levels = [1.37, 0.96, 0.55, 0.14];
      for (const y of levels.slice(0, 3)) {
        g.add(k.box(W - 0.065, 0.008, D - 0.07, shelfGlass, { at: [0, y - 0.004, -0.01] }));
        g.add(k.box(W - 0.09, 0.006, 0.012, led, { at: [0, y - 0.013, D / 2 - 0.07] }));
      }
      // One trophy for every unit finished, from the top shelf down; a brass rail
      // along each shelf names every spot, so the empty ones wait for their unit.
      const total = Math.max(1, o.live.unitsTotal);
      const done = Math.min(Math.max(0, o.live.unitsDone), total);
      const per = Math.ceil(total / levels.length);
      const inner = W - 0.07;
      levels.forEach((y, li) => {
        const first = li * per;
        if (first >= total) return;
        const rail = canvasTexture(1880, 34, (c, w, h) => {
          const bg = c.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, "#ead07f");
          bg.addColorStop(0.5, "#bb9443");
          bg.addColorStop(1, "#8a6a2a");
          c.fillStyle = bg;
          c.fillRect(0, 0, w, h);
          c.font = "700 21px Georgia, serif";
          c.textAlign = "center";
          c.textBaseline = "middle";
          for (let i = 0; i < per && first + i < total; i += 1) {
            const n = first + i + 1;
            c.fillStyle = n <= done ? "rgba(58,38,10,0.9)" : "rgba(58,38,10,0.55)";
            c.fillText(`UNIT ${n}`, (i + 0.5) * (w / per), h / 2 + 1);
          }
        });
        g.add(k.box(inner, 0.018, 0.004, k.print(rail, { roughness: 0.35 }), { at: [0, y + 0.009, D / 2 - 0.054] }));
        for (let i = 0; i < per; i += 1) {
          const u = first + i;
          if (u >= done) break;
          const t = trophy(k, u);
          t.position.set(-inner / 2 + (i + 0.5) * (inner / per), y, -0.035);
          g.add(t);
        }
      });
      return g;
    },
  },

  chandelier: {
    size: [0.78, 0.9, 0.78],
    ceiling: true,
    light: { at: [0, -0.5, 0], color: "#ffdcae", intensity: 2.6, distance: 5 },
    build(k, o) {
      const brass = k.metal("brass", 0.26);
      const crystal = k.glass(o.color ?? "#f3f7ff", 0.5);
      const sleeve = k.ceramic("#f3eee4");
      const bulb = k.glow("#ffd9a3", o.on, 3);
      const drop = (h: number): Pt[] => [[0.0001, -h], [h * 0.16, -h * 0.74], [h * 0.23, -h * 0.48], [h * 0.17, -h * 0.22], [h * 0.06, -h * 0.05], [0.0001, 0]];
      const g = k.group([
        // Canopy at the ceiling and a short collar.
        k.lathe([[0.0001, -0.075], [0.022, -0.074], [0.05, -0.06], [0.072, -0.035], [0.082, -0.012], [0.082, 0], [0.0001, 0]], brass, { seg: 40 }),
        k.cyl(0.008, 0.008, 0.024, brass, { at: [0, -0.087, 0], seg: 12 }),
        // The turned brass body: stem, knops, the hub the arms leave from, and the finial.
        k.lathe(
          [
            [0.0001, -0.745], [0.01, -0.742], [0.018, -0.73], [0.026, -0.71], [0.04, -0.68], [0.05, -0.65], [0.05, -0.63], [0.042, -0.612],
            [0.03, -0.6], [0.034, -0.59], [0.058, -0.575], [0.066, -0.56], [0.06, -0.548], [0.04, -0.538], [0.016, -0.52],
            [0.011, -0.49], [0.02, -0.47], [0.023, -0.455], [0.012, -0.44], [0.009, -0.39], [0.017, -0.372], [0.011, -0.355],
            [0.006, -0.33], [0.009, -0.318], [0.0001, -0.31],
          ],
          brass,
          { seg: 36 }
        ),
        // A crystal ball and a long drop under it all.
        k.sphere(0.026, crystal, { at: [0, -0.772, 0], seg: 10 }),
        k.lathe(drop(0.11), crystal, { at: [0, -0.796, 0], seg: 6 }),
        // The upper crown: a brass ring on three stays.
        k.torus(0.16, 0.0045, brass, { at: [0, -0.4, 0], rot: [Math.PI / 2, 0, 0], seg: 48 }),
      ]);
      // A chain of oval links from the canopy to the stem.
      for (let i = 0; i < 7; i += 1) g.add(k.torus(0.014, 0.0035, brass, { at: [0, -0.108 - i * 0.03, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, 0], scale: [0.75, 1.25, 1], seg: 16 }));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * TAU;
        g.add(k.tube([[0.008 * Math.cos(a), -0.43, 0.008 * Math.sin(a)], [0.09 * Math.cos(a), -0.425, 0.09 * Math.sin(a)], [0.16 * Math.cos(a), -0.4, 0.16 * Math.sin(a)]], 0.003, brass, { seg: 12 }));
      }
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        g.add(k.lathe(drop(0.05), crystal, { at: [0.16 * Math.cos(a), -0.405, 0.16 * Math.sin(a)], seg: 6 }));
        g.add(k.lathe(drop(0.045), crystal, { at: [0.064 * Math.cos(a + 0.5), -0.565, 0.064 * Math.sin(a + 0.5)], seg: 6 }));
      }
      // Six S-curved arms, each ending in a drip pan, a candle and its flame-tip bulb, with a cut drop below.
      const R = 0.33;
      const cupY = -0.5;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + Math.PI / 6;
        g.add(
          k.group(
            [
              k.tube([[0.05, -0.565, 0], [0.12, -0.63, 0], [0.21, -0.645, 0], [0.285, -0.605, 0], [0.322, -0.548, 0], [R, cupY - 0.012, 0]], 0.0075, brass, { seg: 40 }),
              k.lathe([[0.0001, -0.014], [0.014, -0.016], [0.034, -0.008], [0.046, 0.004], [0.043, 0.006], [0.03, 0.0], [0.012, 0.0], [0.0001, 0.0]], brass, { at: [R, cupY, 0], seg: 28 }),
              k.cyl(0.015, 0.012, 0.026, brass, { at: [R, cupY + 0.013, 0], seg: 20 }),
              k.cyl(0.0105, 0.0105, 0.085, sleeve, { at: [R, cupY + 0.0685, 0], seg: 16 }),
              k.lathe([[0.0001, 0], [0.006, 0.003], [0.0125, 0.018], [0.0135, 0.03], [0.009, 0.046], [0.0001, 0.062]], bulb, { at: [R, cupY + 0.111, 0], seg: 18 }),
              k.lathe(drop(0.07), crystal, { at: [R + 0.036, cupY - 0.004, 0], seg: 6 }),
            ],
            { rot: [0, -a, 0] }
          )
        );
        // A strand of crystal swagged to the next arm.
        const b = a + TAU / 6;
        const m = (a + b) / 2;
        g.add(k.tube([[0.36 * Math.cos(a + 0.08), cupY - 0.006, 0.36 * Math.sin(a + 0.08)], [0.33 * Math.cos(m), cupY - 0.085, 0.33 * Math.sin(m)], [0.36 * Math.cos(b - 0.08), cupY - 0.006, 0.36 * Math.sin(b - 0.08)]], 0.0035, crystal, { seg: 20 }));
      }
      return g;
    },
  },

  aquarium: {
    size: [1.24, 1.365, 0.5],
    light: { at: [0, 1.26, 0.05], color: "#d6ecff", intensity: 1.4, distance: 3 },
    build(k, o) {
      const W = 1.2;
      const D = 0.45;
      const y0 = 0.81;
      const top = 1.3;
      const water = 1.245;
      const stand = o.color ? k.paint(o.color, 0.55) : k.wood("walnut", { gloss: 0.5 });
      const trim = k.plastic("#16181b", 0.5);
      const pane = k.glass("#e3f1ef", 0.12);
      const brass = k.metal("brass", 0.3);
      // The back of the tank: a deep-space print, as aquarists hang behind the glass.
      const space = canvasTexture(1024, 420, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#0d1d40");
        bg.addColorStop(0.6, "#0a1533");
        bg.addColorStop(1, "#060b1d");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        const rnd = seeded(77);
        const tones = ["120,80,200", "40,150,190", "190,70,150", "70,110,220"];
        for (let i = 0; i < 28; i += 1) {
          const x = rnd() * w;
          const y = rnd() * h * 0.85;
          const r = 50 + rnd() * 170;
          const rg = c.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, `rgba(${tones[i % 4]},${0.14 + rnd() * 0.14})`);
          rg.addColorStop(1, `rgba(${tones[i % 4]},0)`);
          c.fillStyle = rg;
          c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        for (let i = 0; i < 520; i += 1) {
          const big = rnd() < 0.04;
          c.fillStyle = `rgba(255,255,255,${0.45 + rnd() * 0.55})`;
          c.beginPath();
          c.arc(rnd() * w, rnd() * h, big ? 2.2 : 0.5 + rnd() * 1.1, 0, TAU);
          c.fill();
        }
      });
      const g = k.group([
        // The stand: a cabinet with two doors.
        k.box(W - 0.02, 0.07, D - 0.02, k.wood("ebony", { gloss: 0.4 }), { at: [0, 0.035, -0.005], r: 0.004 }),
        k.box(W + 0.02, 0.67, D + 0.02, stand, { at: [0, 0.405, 0], r: 0.008 }),
        k.box(W + 0.04, 0.035, D + 0.04, stand, { at: [0, 0.7575, 0], r: 0.008 }),
        k.box(0.588, 0.6, 0.018, stand, { at: [-0.297, 0.405, D / 2 + 0.019], r: 0.005 }),
        k.box(0.588, 0.6, 0.018, stand, { at: [0.297, 0.405, D / 2 + 0.019], r: 0.005 }),
        k.box(0.012, 0.16, 0.012, brass, { at: [-0.03, 0.56, D / 2 + 0.035], r: 0.004 }),
        k.box(0.012, 0.16, 0.012, brass, { at: [0.03, 0.56, D / 2 + 0.035], r: 0.004 }),
        // The tank: black trim top and bottom, glass all round, a lit hood on top.
        k.box(W, 0.035, D, trim, { at: [0, 0.7925, 0], r: 0.004 }),
        k.extrude(rect(-W / 2 + 0.003, -D / 2 + 0.003, W / 2 - 0.003, D / 2 - 0.003), 0.025, trim, { at: [0, 1.2925, 0], rot: [-Math.PI / 2, 0, 0], holes: [rect(-W / 2 + 0.02, -D / 2 + 0.02, W / 2 - 0.02, D / 2 - 0.02)], bevel: 0.003 }),
        k.box(W, top - y0, 0.008, pane, { at: [0, (y0 + top) / 2, D / 2 - 0.004] }),
        k.box(W, top - y0, 0.008, pane, { at: [0, (y0 + top) / 2, -D / 2 + 0.004] }),
        k.box(0.008, top - y0, D - 0.016, pane, { at: [-W / 2 + 0.004, (y0 + top) / 2, 0] }),
        k.box(0.008, top - y0, D - 0.016, pane, { at: [W / 2 - 0.004, (y0 + top) / 2, 0] }),
        k.box(W + 0.01, 0.06, D + 0.01, trim, { at: [0, 1.335, 0], r: 0.008 }),
        k.box(W - 0.1, 0.008, 0.05, k.glow("#eaf6ff", o.on, 2.6), { at: [0, 1.272, 0.02] }),
        // The water: a faint tint through the glass and a surface at the top.
        k.box(W - 0.02, water - y0 - 0.002, D - 0.02, k.glass("#9fd6d2", 0.08), { at: [0, (y0 + water) / 2 - 0.001, 0] }),
        k.plane(W - 0.02, D - 0.02, k.water("#9fd3dc"), { at: [0, water, 0], rot: [-Math.PI / 2, 0, 0] }),
        k.plane(W - 0.02, top - y0 - 0.01, k.print(space, { roughness: 0.9, glow: o.on ? 0.5 : 0 }), { at: [0, (y0 + top) / 2, -D / 2 + 0.009] }),
        // Sand banked up towards the back.
        k.extrude(smooth([[-0.205, 0], [0.205, 0], [0.205, 0.028], [0.1, 0.04], [0.0, 0.055], [-0.1, 0.075], [-0.205, 0.09]], 3), W - 0.04, k.stone("sandstone"), { at: [0, y0, 0], rot: [0, -Math.PI / 2, 0], bevel: 0.006 }),
        // Filter intake and heater in the back corners.
        k.cyl(0.009, 0.009, 0.38, trim, { at: [0.52, 1.07, -0.18], seg: 12 }),
        k.cyl(0.016, 0.016, 0.07, trim, { at: [0.52, 0.875, -0.18], seg: 14 }),
        k.cyl(0.011, 0.011, 0.26, k.glass("#eef6f4", 0.45), { at: [-0.53, 1.07, -0.185], seg: 12 }),
        k.cyl(0.013, 0.013, 0.03, trim, { at: [-0.53, 1.21, -0.185], seg: 12 }),
      ]);
      // Rocks: faceted stones bedded in the sand.
      const stone = k.stone("slate");
      const rocks: [V3, V3, V3][] = [
        [[-0.3, y0 + 0.085, -0.07], [0.1, 0.08, 0.075], [0.3, 0.5, 0.2]],
        [[-0.17, y0 + 0.055, 0.03], [0.055, 0.045, 0.05], [0.1, 1.2, -0.3]],
        [[0.3, y0 + 0.075, -0.1], [0.075, 0.095, 0.065], [-0.2, 0.8, 0.15]],
        [[0.41, y0 + 0.048, 0.04], [0.048, 0.035, 0.042], [0.4, 2.1, 0.1]],
      ];
      for (const [at, scale, rot] of rocks) g.add(k.sphere(1, stone, { at, scale, rot, seg: 7 }));
      // A branch of driftwood.
      const drift = k.wood("#5a4030", { gloss: 0.15 });
      g.add(k.tube([[-0.05, y0 + 0.05, -0.08], [0.04, y0 + 0.13, -0.11], [0.1, y0 + 0.24, -0.15], [0.13, y0 + 0.33, -0.17]], 0.014, drift, { seg: 20 }));
      g.add(k.tube([[0.04, y0 + 0.13, -0.11], [0.13, y0 + 0.17, -0.1], [0.22, y0 + 0.2, -0.12]], 0.008, drift, { seg: 14 }));
      // Tall grass in the back corners, a broad-leaved plant on the rock, a red stem plant.
      const rnd = seeded(91);
      for (const [cx, cz, n] of [[-0.46, -0.15, 5], [0.43, -0.14, 4]] as [number, number, number][]) {
        for (let i = 0; i < n; i += 1) {
          const x = cx + (rnd() - 0.5) * 0.08;
          const z = cz + (rnd() - 0.5) * 0.06;
          const h = 0.26 + rnd() * 0.14;
          const lean = (rnd() - 0.5) * 0.12;
          g.add(k.tube([[x, y0 + 0.07, z], [x + lean * 0.3, y0 + 0.07 + h * 0.5, z], [x + lean, y0 + 0.07 + h, z + 0.02]], 0.0035, k.leaf(i % 3), { seg: 10 }));
        }
      }
      for (let i = 0; i < 4; i += 1) {
        const a = i * 1.7;
        g.add(k.sphere(1, k.leaf(3), { at: [-0.3 + Math.cos(a) * 0.035, y0 + 0.17, -0.07 + Math.sin(a) * 0.03], scale: [0.034, 0.004, 0.018], rot: [0.4, a, 0.3] }));
      }
      const red = k.paint("#9a3a2a", 0.3);
      for (let i = 0; i < 3; i += 1) {
        const x = 0.2 + i * 0.03;
        g.add(k.tube([[x, y0 + 0.06, -0.02], [x + 0.01, y0 + 0.16, -0.02], [x - 0.005, y0 + 0.24 + i * 0.03, -0.01]], 0.003, k.leaf(1), { seg: 10 }));
        g.add(k.sphere(0.022, red, { at: [x - 0.005, y0 + 0.25 + i * 0.03, -0.01], scale: [1, 0.8, 1], seg: 9 }));
      }
      // Fish: three to start, one more for every day of the streak, up to twelve.
      const kinds: [string, string, number][] = [
        ["#e8742a", "#f0a050", 0.062],
        ["#cfd5dc", "#a9b4c2", 0.07],
        ["#f2c94c", "#f5dc8a", 0.05],
        ["#3b8fd8", "#d24b3c", 0.032],
        ["#3b8fd8", "#d24b3c", 0.032],
        ["#3b8fd8", "#d24b3c", 0.032],
        ["#d9473a", "#e9715f", 0.055],
        ["#2b2d33", "#4a4d55", 0.055],
        ["#3b8fd8", "#d24b3c", 0.032],
        ["#3b8fd8", "#d24b3c", 0.032],
        ["#f08a3a", "#f2b06a", 0.05],
        ["#e9e2d0", "#c4342c", 0.06],
      ];
      const n = 3 + Math.min(Math.max(0, o.live.streak), 9);
      for (let i = 0; i < n; i += 1) {
        const [body, fin, length] = kinds[i];
        const r = seeded(500 + i * 31);
        const school = length < 0.04;
        const x = school ? 0.08 + (r() - 0.5) * 0.3 : (r() - 0.5) * 0.9;
        const y = school ? 1.05 + (r() - 0.5) * 0.1 : 0.95 + r() * 0.22;
        const z = (r() - 0.5) * 0.24;
        const yaw = (school || r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.6;
        g.add(fish(k, body, fin, length, [x, y, z], yaw, (r() - 0.5) * 0.25));
      }
      // A few bubbles rising from the intake.
      const bubble = k.glass("#ffffff", 0.5);
      for (let i = 0; i < 4; i += 1) g.add(k.sphere(0.004 + (i % 2) * 0.002, bubble, { at: [0.5 + (i % 2) * 0.01, 0.95 + i * 0.07, -0.16], seg: 8 }));
      return g;
    },
  },

  "dragon-statue": {
    size: [0.8, 1.32, 0.72],
    build(k, o) {
      const stone = o.color ? k.paint(o.color, 0.35) : k.stone("granite");
      const bronze = k.metal("#7b5634", 0.42);
      const P = 0.6;
      const g = k.group([
        // A stone plinth with a brass plate.
        k.box(0.64, 0.07, 0.54, stone, { at: [0, 0.035, 0], r: 0.01 }),
        k.box(0.54, 0.46, 0.44, stone, { at: [0, 0.3, 0], r: 0.006 }),
        k.box(0.62, 0.07, 0.52, stone, { at: [0, 0.565, 0], r: 0.01 }),
        k.plane(0.2, 0.05, k.print(plate("DRACO", "Cast bronze"), { roughness: 0.35 }), { at: [0, 0.33, 0.2205] }),
      ]);
      const d: THREE.Object3D[] = [];
      // Body: a turned torso rearing up, heavy haunches.
      d.push(k.lathe([[0.0001, 0], [0.045, 0.012], [0.07, 0.045], [0.082, 0.1], [0.085, 0.16], [0.079, 0.22], [0.068, 0.27], [0.055, 0.31], [0.043, 0.34], [0.0001, 0.36]], bronze, { at: [-0.15, 0.115, 0], rot: [0, 0, -0.82], scale: [1, 1, 0.82], seg: 28 }));
      for (const s of [-1, 1]) {
        d.push(k.sphere(0.095, bronze, { at: [-0.1, 0.1, s * 0.075], scale: [1.05, 0.95, 0.6], seg: 20 }));
        // Hind leg: shin down to the heel, a long foot forward, three claws.
        d.push(k.tube([[-0.05, 0.13, s * 0.1], [0.0, 0.1, s * 0.125], [-0.06, 0.06, s * 0.13], [-0.13, 0.03, s * 0.13]], 0.022, bronze, { seg: 20 }));
        d.push(k.tube([[-0.13, 0.03, s * 0.13], [-0.05, 0.017, s * 0.135], [0.04, 0.015, s * 0.14]], 0.016, bronze, { seg: 16 }));
        // Foreleg: shoulder, elbow, wrist, a paw on the stone.
        d.push(k.sphere(0.045, bronze, { at: [0.06, 0.235, s * 0.07], scale: [1, 1.35, 0.8], seg: 16 }));
        d.push(k.tube([[0.07, 0.27, s * 0.07], [0.04, 0.15, s * 0.1], [0.12, 0.05, s * 0.1], [0.165, 0.024, s * 0.1]], 0.02, bronze, { seg: 24 }));
        d.push(k.sphere(1, bronze, { at: [0.17, 0.02, s * 0.1], scale: [0.035, 0.02, 0.03], seg: 14 }));
        for (const t of [-1, 0, 1]) {
          d.push(k.cone(0.007, 0.03, bronze, { at: [0.06, 0.012, s * 0.14 + t * 0.018], rot: aim([1, -0.35, t * 0.3]), seg: 8 }));
          d.push(k.cone(0.006, 0.026, bronze, { at: [0.205, 0.013, s * 0.1 + t * 0.016], rot: aim([1, -0.4, t * 0.3]), seg: 8 }));
        }
      }
      // Neck: a curve up from the chest, thick at the base.
      const neck = path([[0.1, 0.33, 0], [0.15, 0.43, 0], [0.13, 0.53, 0], [0.17, 0.61, 0.0], [0.24, 0.655, 0.02]]);
      d.push(k.tube(span(neck, 0, 1, 16), 0.034, bronze, { seg: 40 }));
      [0, 0.12, 0.25, 0.4].forEach((t, i) => d.push(k.sphere(0.056 - i * 0.006, bronze, { at: pt(neck, t), scale: [1, 1, 0.85], seg: 18 })));
      // Head, turned towards the room: skull, long snout, open jaw, fangs, horns, gold eyes.
      const head: THREE.Object3D[] = [
        k.sphere(0.042, bronze, { at: [0.015, 0, 0], scale: [1.25, 0.95, 0.85], seg: 18 }),
        k.lathe([[0.0001, 0], [0.03, 0.008], [0.033, 0.03], [0.029, 0.06], [0.023, 0.088], [0.016, 0.106], [0.0001, 0.116]], bronze, { at: [0.04, 0.006, 0], rot: [0, 0, -Math.PI / 2], scale: [0.72, 1, 0.9], seg: 20 }),
        k.lathe([[0.0001, 0], [0.022, 0.01], [0.022, 0.04], [0.017, 0.072], [0.011, 0.096], [0.0001, 0.102]], bronze, { at: [0.035, -0.022, 0], rot: [0, 0, -Math.PI / 2 - 0.38], scale: [0.5, 1, 0.8], seg: 18 }),
      ];
      for (const s of [-1, 1]) {
        head.push(k.cone(0.0045, 0.02, bronze, { at: [0.125, -0.012, s * 0.013], rot: [Math.PI, 0, 0], seg: 8 }));
        head.push(k.cone(0.011, 0.11, bronze, { at: [-0.046, 0.057, s * 0.031], rot: aim([-0.85, 0.5, s * 0.2]), seg: 12 }));
        head.push(k.sphere(0.012, bronze, { at: [0.045, 0.026, s * 0.022], scale: [1.6, 0.7, 1], seg: 10 }));
        head.push(k.sphere(0.0065, k.metal("gold", 0.2), { at: [0.05, 0.017, s * 0.029], seg: 10 }));
        head.push(k.extrude([[0, 0.012], [-0.07, 0.045], [-0.05, 0.012], [-0.085, -0.005], [-0.05, -0.018], [-0.07, -0.045], [0, -0.015]], 0.004, bronze, { at: [0.0, -0.005, s * 0.03], rot: [0, s * 0.45, 0], bevel: 0.001 }));
      }
      d.push(k.group(head, { at: [0.245, 0.66, 0.025], rot: [0, -0.45, -0.1] }));
      // Wings raised behind, bat-like, the membrane between the fingers.
      const wing = wingParts(1);
      for (const s of [-1, 1]) {
        const parts: THREE.Object3D[] = [
          k.extrude(wing.outline, 0.008, bronze, { bevel: 0.002 }),
          k.tube(wing.arm, 0.014, bronze, { seg: 20 }),
          k.cone(0.008, 0.04, bronze, { at: add(wing.wrist, [0.012, 0.02, 0]), rot: aim([0.6, 0.8, 0]), seg: 8 }),
        ];
        for (const f of wing.fingers) parts.push(k.tube(f, 0.0065, bronze, { seg: 16 }));
        d.push(k.group(parts, { at: [0.03, 0.33, s * 0.05], rot: [s * 0.3, s * 0.38, 0] }));
      }
      // Tail: round the front of the plinth and over its edge, tapering, ending in a spade.
      const tail = path([[-0.2, 0.09, 0], [-0.27, 0.05, 0.05], [-0.26, 0.03, 0.13], [-0.16, 0.026, 0.19], [-0.02, 0.024, 0.215], [0.1, 0.02, 0.232], [0.16, 0.0, 0.262], [0.17, -0.06, 0.27], [0.16, -0.14, 0.268]]);
      d.push(k.tube(span(tail, 0, 0.38), 0.034, bronze, { seg: 24 }));
      d.push(k.tube(span(tail, 0.35, 0.7), 0.025, bronze, { seg: 24 }));
      d.push(k.tube(span(tail, 0.67, 1), 0.017, bronze, { seg: 24 }));
      const end = pt(tail, 1);
      d.push(k.extrude([[0, 0.012], [0.03, -0.018], [0.012, -0.028], [0, -0.07], [-0.012, -0.028], [-0.03, -0.018]], 0.008, bronze, { at: [end[0], end[1], end[2]], bevel: 0.002 }));
      // Spines down the back: along the neck, the torso and the start of the tail.
      const spine = (base: V3, dir: V3, h: number) => d.push(k.cone(h * 0.28, h, bronze, { at: add(base, unit(dir), h / 2), rot: aim(dir), seg: 8 }));
      for (const t of [0.18, 0.38, 0.58, 0.78]) {
        const p = pt(neck, t);
        const tan = neck.getTangent(t);
        spine(add(p, [-tan.y, tan.x, 0], 0.03), [-tan.y - tan.x * 0.4, tan.x - tan.y * 0.4, 0], 0.04);
      }
      for (const a of [0.08, 0.17, 0.26]) spine([-0.15 + a * 0.731 - 0.682 * 0.072, 0.115 + a * 0.682 + 0.731 * 0.072, 0], [-0.75, 0.66, 0], 0.045);
      for (const t of [0.1, 0.22]) spine(add(pt(tail, t), [0, 0.028, 0]), [-0.3, 1, 0], 0.03);
      g.add(k.group(d, { at: [-0.02, P, 0] }));
      return g;
    },
  },

  portal: {
    size: [1.8, 1.93, 0.72],
    light: { at: [0, 1.03, 0.3], color: "#8fc8ff", intensity: 2.4, distance: 4 },
    build(k, o) {
      const energy = o.color ?? "#5fb4ff";
      const steel = k.metal("steel", 0.42);
      const dark = k.metal("#5a6068", 0.5);
      const bolt = k.metal("#9aa1a8", 0.35);
      const slate = k.stone("slate");
      const lamp = k.glow(energy, o.on, 2.6);
      const C = 1.03;
      const R = 0.85;
      const r = 0.66;
      // The cradle that holds the ring: a block with its top cut to the ring's curve.
      const a1 = Math.acos(0.56 / (R + 0.015));
      const arc: Pt[] = [];
      for (let i = 0; i <= 24; i += 1) {
        const a = -a1 - ((Math.PI - 2 * a1) * i) / 24;
        arc.push([Math.cos(a) * (R + 0.015), C + Math.sin(a) * (R + 0.015)]);
      }
      const g = k.group([
        k.box(1.62, 0.06, 0.72, slate, { at: [0, 0.03, 0], r: 0.008 }),
        k.box(1.34, 0.06, 0.52, slate, { at: [0, 0.09, 0], r: 0.008 }),
        k.extrude([[-0.56, 0.12], [0.56, 0.12], ...arc], 0.26, dark, { bevel: 0.01 }),
        // The ring, brushed steel, with rounded lips inside and out.
        k.extrude(ellipse(R - 0.012, R - 0.012, 0, C, 96), 0.16, steel, { holes: [ellipse(r + 0.012, r + 0.012, 0, C, 96)], bevel: 0.012 }),
        k.torus(0.656, 0.016, dark, { at: [0, C, 0.082], seg: 96 }),
        k.torus(0.656, 0.016, dark, { at: [0, C, -0.082], seg: 96 }),
        k.torus(0.852, 0.013, dark, { at: [0, C, 0.08], seg: 96 }),
        k.torus(0.852, 0.013, dark, { at: [0, C, -0.08], seg: 96 }),
      ]);
      // Plate seams with rivets either side, round the front face.
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + Math.PI / 8;
        const m = (R + r) / 2;
        g.add(k.box(0.005, R - r - 0.02, 0.003, k.paint("#2a2d31", 0.3), { at: [Math.cos(a) * m, C + Math.sin(a) * m, 0.081], rot: [0, 0, a - Math.PI / 2] }));
      }
      for (const rr of [0.69, 0.82])
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * TAU;
          g.add(k.sphere(0.011, bolt, { at: [Math.cos(a) * rr, C + Math.sin(a) * rr, 0.082], scale: [1, 1, 0.55], seg: 10 }));
        }
      // Clamps round the rim, each with a lamp that glows with the gate.
      for (let i = 0; i < 7; i += 1) {
        const a = Math.PI / 2 + (i - 3) * (Math.PI / 4);
        const p: V3 = [Math.cos(a) * (R + 0.02), C + Math.sin(a) * (R + 0.02), 0];
        g.add(k.box(0.11, 0.06, 0.22, dark, { at: p, rot: [0, 0, a - Math.PI / 2], r: 0.01 }));
        g.add(k.cyl(0.017, 0.017, 0.012, lamp, { at: [p[0], p[1], 0.114], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      }
      // Switched on, a swirl of light fills the ring.
      if (o.on) {
        const swirl = canvasTexture(1024, 1024, (c, w) => {
          const cx = w / 2;
          const base = new THREE.Color(energy);
          const hot = css(base.clone().lerp(new THREE.Color("#ffffff"), 0.8));
          const bright = css(base.clone().lerp(new THREE.Color("#ffffff"), 0.25));
          const deep = css(base.clone().multiplyScalar(0.22));
          const rg = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
          rg.addColorStop(0, hot);
          rg.addColorStop(0.16, bright);
          rg.addColorStop(0.55, css(base.clone().multiplyScalar(0.55)));
          rg.addColorStop(0.92, deep);
          rg.addColorStop(1, css(base.clone().multiplyScalar(0.08)));
          c.fillStyle = rg;
          c.fillRect(0, 0, w, w);
          c.globalCompositeOperation = "lighter";
          const rnd = seeded(808);
          for (let arm = 0; arm < 6; arm += 1) {
            for (let pass = 0; pass < 7; pass += 1) {
              const off = (arm / 6) * TAU + (rnd() - 0.5) * 0.25;
              c.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.07})`;
              c.lineWidth = 3 + rnd() * 9;
              c.beginPath();
              for (let s = 0; s <= 90; s += 1) {
                const th = (s / 90) * 4.2;
                const rad = cx * 0.97 * Math.exp(-0.62 * th);
                const x = cx + Math.cos(th + off) * rad;
                const y = cx + Math.sin(th + off) * rad;
                if (s === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
              }
              c.stroke();
            }
          }
          c.fillStyle = "rgba(255,255,255,0.8)";
          for (let i = 0; i < 260; i += 1) {
            const th = rnd() * TAU;
            const rad = Math.sqrt(rnd()) * cx * 0.96;
            c.beginPath();
            c.arc(cx + Math.cos(th) * rad, cx + Math.sin(th) * rad, 0.6 + rnd() * 1.8, 0, TAU);
            c.fill();
          }
          // Faint symbols carried round in the current.
          c.fillStyle = "rgba(255,255,255,0.22)";
          c.textAlign = "center";
          c.textBaseline = "middle";
          const glyphs = ["π", "Σ", "√", "x²", "∞", "÷", "=", "y", "Δ", "θ"];
          for (let i = 0; i < 26; i += 1) {
            const th = rnd() * TAU;
            const rad = cx * (0.3 + rnd() * 0.6);
            c.save();
            c.translate(cx + Math.cos(th) * rad, cx + Math.sin(th) * rad);
            c.rotate(th + Math.PI / 2);
            c.font = `600 ${Math.round(18 + rad / 16)}px Georgia, serif`;
            c.fillText(glyphs[i % glyphs.length], 0, 0);
            c.restore();
          }
          c.globalCompositeOperation = "source-over";
        });
        const face = k.screen(true, swirl, 1.5);
        g.add(k.disc(r - 0.004, face, { at: [0, C, 0.002], seg: 64 }));
        g.add(k.disc(r - 0.004, face, { at: [0, C, -0.002], rot: [0, Math.PI, 0], seg: 64 }));
      }
      return g;
    },
  },

  "golden-calculator": {
    size: [0.5, 1.48, 0.42],
    build(k, o) {
      const lacquer = k.paint(o.color ?? "#121316", 0.8);
      const gold = k.metal("gold", 0.2);
      const brushed = k.metal("gold", 0.38);
      const black = k.plastic("#101113", 0.7);
      const g = k.group([
        // A lacquered pedestal with gold lines at its foot and head.
        k.box(0.5, 0.06, 0.42, lacquer, { at: [0, 0.03, 0], r: 0.008 }),
        k.box(0.42, 0.84, 0.34, lacquer, { at: [0, 0.48, 0], r: 0.006 }),
        k.box(0.5, 0.05, 0.42, lacquer, { at: [0, 0.925, 0], r: 0.008 }),
        k.box(0.426, 0.012, 0.346, gold, { at: [0, 0.072, 0] }),
        k.box(0.426, 0.012, 0.346, gold, { at: [0, 0.888, 0] }),
        k.plane(0.24, 0.06, k.print(plate("GOLDEN CALCULATOR", null), { roughness: 0.35 }), { at: [0, 0.74, 0.1705] }),
        // A black stand on top: a base, a lip in front, a strut behind.
        k.box(0.3, 0.012, 0.2, black, { at: [0, 0.956, -0.01], r: 0.004 }),
        beam(k, [0, 0.96, -0.1], [0, 1.24, -0.055], 0.12, 0.012, black),
      ]);
      // The calculator, leaning back on the stand.
      const W = 0.34;
      const H = 0.54;
      const T = 0.045;
      const done = Math.min(o.live.skillsDone, o.live.skillsTotal);
      const total = Math.max(1, o.live.skillsTotal);
      const lcd = o.on
        ? canvasTexture(640, 184, (c, w, h) => {
            c.fillStyle = "#c2cab0";
            c.fillRect(0, 0, w, h);
            const sheen = c.createLinearGradient(0, 0, 0, h);
            sheen.addColorStop(0, "rgba(255,255,255,0.2)");
            sheen.addColorStop(1, "rgba(0,0,0,0.1)");
            c.fillStyle = sheen;
            c.fillRect(0, 0, w, h);
            c.fillStyle = "#1e241d";
            c.font = "600 34px 'Courier New', monospace";
            c.textBaseline = "top";
            c.fillText(`${done}÷${total}=`, 24, 14);
            sevenSeg(c, String(Number((done / total).toPrecision(9))), w - 22, h - 20, 92);
          })
        : undefined;
      const strip = canvasTexture(580, 60, (c, w, h) => {
        c.fillStyle = "#0e0f11";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#d9b75a";
        c.font = "700 26px Georgia, serif";
        c.textBaseline = "middle";
        c.fillText("ALGEBRIDGE", 14, h / 2 + 1);
        for (let i = 0; i < 4; i += 1) {
          c.fillStyle = "#2d2219";
          c.fillRect(330 + i * 60, 10, 54, h - 20);
          c.fillStyle = "rgba(120,90,60,0.35)";
          c.fillRect(330 + i * 60, 10, 54, 3);
        }
      });
      const calc = k.group([
        k.box(W, H, T, gold, { at: [0, H / 2, 0], r: 0.014 }),
        k.box(W - 0.028, H - 0.028, 0.004, brushed, { at: [0, H / 2, T / 2 + 0.001], r: 0.0018 }),
        k.box(0.29, 0.105, 0.006, black, { at: [0, H - 0.118, T / 2 + 0.004], r: 0.003 }),
        k.plane(0.27, 0.078, k.screen(o.on, lcd, 0.95), { at: [0, H - 0.118, T / 2 + 0.0072] }),
        k.plane(0.29, 0.03, k.print(strip, { roughness: 0.4 }), { at: [0, H - 0.04, T / 2 + 0.0035] }),
        k.box(0.3, 0.025, 0.014, black, { at: [0, 0.006, T / 2 + 0.007], r: 0.004 }),
      ]);
      // Nineteen real keys: black, each with its label.
      const rows = [
        ["AC", "±", "%", "÷"],
        ["7", "8", "9", "×"],
        ["4", "5", "6", "−"],
        ["1", "2", "3", "+"],
        ["0", "", ".", "="],
      ];
      rows.forEach((row, ri) => {
        const y = 0.319 - ri * 0.062;
        row.forEach((label, ci) => {
          if (label === "") return;
          const wide = label === "0";
          const kw = wide ? 0.128 : 0.056;
          const x = wide ? -0.072 : -0.108 + ci * 0.072;
          const digit = /^[0-9.]$/.test(label);
          const face = canvasTexture(wide ? 224 : 96, 80, (c, w, h) => {
            const bg = c.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, "#26282c");
            bg.addColorStop(1, "#121316");
            c.fillStyle = bg;
            c.fillRect(0, 0, w, h);
            c.fillStyle = label === "AC" ? "#e48a74" : digit ? "#e3c46c" : "#f1f1f1";
            c.font = `600 ${label.length > 1 ? 30 : 44}px Inter, system-ui, sans-serif`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(label, w / 2, h / 2 + 2);
          });
          calc.add(k.box(kw, 0.046, 0.014, black, { at: [x, y, T / 2 + 0.009], r: 0.005 }));
          calc.add(k.plane(kw - 0.008, 0.038, k.print(face, { roughness: 0.35 }), { at: [x, y, T / 2 + 0.0163] }));
        });
      });
      calc.position.set(0, 0.962, 0.04);
      calc.rotation.set(-0.32, 0, 0);
      g.add(calc);
      return g;
    },
  },

  throne: {
    size: [0.88, 1.74, 0.7],
    build(k, o) {
      const wood = k.wood("#4a2c1d", { gloss: 0.6 });
      const velvet = k.velvet(o.color ?? "#7a1c2b");
      const gold = k.metal("gold", 0.28);
      const LEG: Pt[] = [[0.0001, 0], [0.04, 0], [0.045, 0.012], [0.044, 0.03], [0.032, 0.05], [0.024, 0.07], [0.03, 0.11], [0.034, 0.15], [0.028, 0.2], [0.022, 0.24], [0.03, 0.28], [0.036, 0.31], [0.036, 0.36], [0.0001, 0.36]];
      const POST: Pt[] = [[0.0001, 0], [0.04, 0], [0.04, 0.04], [0.032, 0.06], [0.032, 0.3], [0.038, 0.32], [0.028, 0.36], [0.03, 0.7], [0.036, 0.72], [0.028, 0.76], [0.03, 1.0], [0.04, 1.03], [0.04, 1.09], [0.0001, 1.09]];
      const FINIAL: Pt[] = [[0.0001, 0], [0.03, 0.004], [0.034, 0.02], [0.02, 0.04], [0.026, 0.06], [0.03, 0.08], [0.018, 0.108], [0.006, 0.124], [0.0001, 0.13]];
      /** A tall arch: straight sides, a round head. */
      const arch = (w: number, y0: number, y1: number, rise: number): Pt[] => {
        const out: Pt[] = [[-w / 2, y0], [w / 2, y0]];
        for (let i = 0; i <= 16; i += 1) {
          const a = (i / 16) * Math.PI;
          out.push([(w / 2) * Math.cos(a), y1 + rise * Math.sin(a)]);
        }
        return out;
      };
      const S = 0.49;
      const g = k.group([
        // Seat frame, a gilded valance below it, a gold bead along its edge.
        k.box(0.84, 0.13, 0.68, wood, { at: [0, 0.425, 0], r: 0.012 }),
        k.extrude(smooth([[-0.36, 0], [0.36, 0], [0.36, -0.02], [0.2, -0.03], [0.1, -0.058], [0.04, -0.05], [0, -0.085], [-0.04, -0.05], [-0.1, -0.058], [-0.2, -0.03], [-0.36, -0.02]], 4), 0.015, gold, { at: [0, 0.385, 0.343], bevel: 0.004 }),
        k.box(0.84, 0.014, 0.014, gold, { at: [0, S, 0.343], r: 0.005 }),
        // The velvet seat.
        k.cushion(0.76, 0.11, 0.6, velvet, { at: [0, 0.545, 0.03] }),
        // The back: carved panel, a padded velvet arch framed in gold, a crown above.
        k.extrude(arch(0.72, 0, 0.9, 0.18), 0.05, wood, { at: [0, S, -0.31], bevel: 0.01 }),
        k.extrude(arch(0.54, 0.09, 0.84, 0.13), 0.05, velvet, { at: [0, S, -0.27], bevel: 0.022 }),
        k.extrude(arch(0.62, 0.05, 0.84, 0.17), 0.02, gold, { at: [0, S, -0.276], holes: [arch(0.56, 0.08, 0.84, 0.135)], bevel: 0.004 }),
        k.extrude([[-0.12, 0], [0.12, 0], [0.12, 0.04], [0.135, 0.12], [0.07, 0.07], [0, 0.15], [-0.07, 0.07], [-0.135, 0.12], [-0.12, 0.04]], 0.025, gold, { at: [0, S + 1.06, -0.31], bevel: 0.005 }),
      ]);
      for (const x of [-0.135, 0, 0.135]) g.add(k.sphere(0.014, gold, { at: [x, S + 1.06 + (x === 0 ? 0.152 : 0.122), -0.31], seg: 12 }));
      // Gilded C-scrolls either side of the crown.
      for (const s of [-1, 1]) {
        const spiral: Pt[] = [];
        for (let i = 0; i <= 28; i += 1) {
          const a = (i / 28) * 1.6 * Math.PI;
          const rr = 0.07 * (1 - (i / 28) * 0.7);
          spiral.push([s * (0.2 + Math.cos(a) * rr), S + 0.98 + Math.sin(a) * rr]);
        }
        const back = spiral.slice().reverse().map(([x, y], i, arr) => {
          const t = 1 - i / (arr.length - 1);
          const cx = s * 0.2;
          const cy = S + 0.98;
          const f = 1 - (0.016 * (1 - t * 0.6)) / Math.max(0.02, Math.hypot(x - cx, y - cy));
          return [cx + (x - cx) * f, cy + (y - cy) * f] as Pt;
        });
        g.add(k.extrude([...spiral, ...back], 0.02, gold, { at: [0, 0, -0.3], bevel: 0.003 }));
      }
      // Tufting buttons on the velvet.
      for (const [x, y] of [[-0.12, 0.3], [0.12, 0.3], [-0.18, 0.52], [0, 0.52], [0.18, 0.52], [-0.12, 0.74], [0.12, 0.74]] as Pt[])
        g.add(k.sphere(0.011, gold, { at: [x, S + y, -0.244], scale: [1, 1, 0.6], seg: 10 }));
      // Turned legs with gold collars; posts with gold finials.
      for (const x of [-0.385, 0.385]) {
        for (const z of [-0.3, 0.3]) {
          g.add(k.lathe(LEG, wood, { at: [x, 0, z], seg: 24 }));
          g.add(k.torus(0.034, 0.006, gold, { at: [x, 0.3, z], rot: [Math.PI / 2, 0, 0], seg: 24 }));
        }
        g.add(k.lathe(POST, wood, { at: [x, S, -0.3], seg: 24 }));
        g.add(k.lathe(FINIAL, gold, { at: [x, S + 1.09, -0.3], seg: 24 }));
      }
      // Arms: a carved rest ending in a scroll, a turned post, a velvet pad, a gold rosette.
      const armSide = smooth([[-0.33, 0.745], [0.0, 0.75], [0.24, 0.745], [0.3, 0.73], [0.33, 0.69], [0.31, 0.65], [0.27, 0.64], [0.25, 0.67], [0.27, 0.695], [0.2, 0.7], [0.0, 0.705], [-0.33, 0.7]], 4);
      for (const s of [-1, 1]) {
        g.add(k.extrude(armSide, 0.06, wood, { at: [s * 0.4, 0, 0], rot: [0, -Math.PI / 2, 0], bevel: 0.008 }));
        g.add(k.lathe([[0.0001, 0], [0.03, 0], [0.03, 0.02], [0.02, 0.04], [0.026, 0.09], [0.018, 0.15], [0.024, 0.17], [0.024, 0.2], [0.0001, 0.2]], wood, { at: [s * 0.4, S, 0.24], seg: 20 }));
        g.add(k.cushion(0.07, 0.03, 0.36, velvet, { at: [s * 0.4, 0.765, -0.03] }));
        g.add(k.cyl(0.026, 0.026, 0.008, gold, { at: [s * 0.434, 0.69, 0.285], rot: [0, 0, Math.PI / 2], seg: 20 }));
      }
      return g;
    },
  },

  "unicorn-statue": {
    size: [0.95, 1.36, 0.48],
    build(k, o) {
      const marble = k.stone("marble");
      const stone = o.color ? k.paint(o.color, 0.35) : k.stone("slate");
      const gold = k.metal("gold", 0.22);
      const g = k.group([
        k.box(0.92, 0.06, 0.48, stone, { at: [0, 0.03, 0], r: 0.01 }),
        k.box(0.84, 0.38, 0.4, stone, { at: [0, 0.25, 0], r: 0.006 }),
        k.box(0.9, 0.06, 0.46, stone, { at: [0, 0.47, 0], r: 0.01 }),
        k.box(0.76, 0.04, 0.34, marble, { at: [0, 0.52, 0], r: 0.012 }),
        k.plane(0.26, 0.065, k.print(plate("MONOCEROS", "The Unicorn"), { roughness: 0.35 }), { at: [0, 0.27, 0.2005] }),
      ]);
      const h: THREE.Object3D[] = [];
      // Barrel, quarters, chest and thighs.
      h.push(k.lathe([[0.0001, 0], [0.05, 0.012], [0.085, 0.05], [0.104, 0.12], [0.11, 0.22], [0.106, 0.32], [0.095, 0.4], [0.07, 0.45], [0.0001, 0.47]], marble, { at: [-0.22, 0.36, 0], rot: [0, 0, -Math.PI / 2], scale: [0.95, 1, 0.8], seg: 32 }));
      h.push(k.sphere(0.11, marble, { at: [-0.19, 0.395, 0], scale: [1.05, 0.98, 0.82], seg: 24 }));
      h.push(k.sphere(0.095, marble, { at: [0.19, 0.37, 0], scale: [0.9, 1.05, 0.86], seg: 24 }));
      for (const s of [-1, 1]) h.push(k.sphere(0.075, marble, { at: [-0.16, 0.3, s * 0.045], scale: [1.1, 1.3, 0.7], seg: 18 }));
      // The arched neck, and a carved mane along its crest.
      h.push(k.extrude(smooth([[0.1, 0.43], [0.16, 0.5], [0.22, 0.58], [0.27, 0.655], [0.305, 0.705], [0.335, 0.705], [0.345, 0.665], [0.32, 0.6], [0.29, 0.52], [0.27, 0.44], [0.24, 0.37], [0.14, 0.37]], 5), 0.1, marble, { bevel: 0.03 }));
      const crest: Pt[] = [[0.085, 0.46], [0.13, 0.515], [0.17, 0.56], [0.21, 0.61], [0.245, 0.655], [0.275, 0.7], [0.3, 0.74]];
      const outer = crest.map(([x, y], i) => [x - 0.02 - (i % 2) * 0.012, y + 0.03 + (i % 2) * 0.012] as Pt);
      const under = crest.slice().reverse().map(([x, y]) => [x + 0.025, y - 0.025] as Pt);
      h.push(k.extrude(smooth([...outer, ...under], 4), 0.06, marble, { at: [0, 0, 0.02], bevel: 0.012 }));
      // The head, held high, with a gilded spiral horn.
      const hornDir: V3 = [0.444, 0.896, 0];
      const helix: V3[] = [];
      for (let i = 0; i <= 48; i += 1) {
        const t = i / 48;
        const rr = 0.0105 * (1 - t * 0.95) + 0.0007;
        helix.push([Math.cos(t * 5 * TAU) * rr, t * 0.16 - 0.085, Math.sin(t * 5 * TAU) * rr]);
      }
      const headParts: THREE.Object3D[] = [
        k.sphere(0.05, marble, { at: [0.025, -0.008, 0], scale: [1.15, 1.0, 0.64], seg: 20 }),
        k.lathe([[0.0001, 0], [0.044, 0.01], [0.042, 0.055], [0.035, 0.11], [0.031, 0.14], [0.0001, 0.15]], marble, { at: [0.03, 0.006, 0], rot: [0, 0, -Math.PI / 2], scale: [1, 1, 0.66], seg: 24 }),
        k.sphere(0.033, marble, { at: [0.175, -0.004, 0], scale: [1.1, 1.0, 0.78], seg: 18 }),
        k.group([k.cone(0.0105, 0.17, gold, { seg: 18 }), k.tube(helix, 0.0016, gold, { seg: 160 })], { at: add([0.045, 0.04, 0], hornDir, 0.085), rot: aim(hornDir) }),
      ];
      for (const s of [-1, 1]) headParts.push(k.cone(0.013, 0.055, marble, { at: add([-0.005, 0.04, s * 0.022], unit([-0.304, 0.974, s * 0.15]), 0.0275), rot: aim([-0.304, 0.974, s * 0.15]), seg: 12 }));
      h.push(k.group(headParts, { at: [0.335, 0.7, 0], rot: [0, 0, -0.5] }));
      // Legs: forearm or gaskin, knee or hock, cannon and pastern, fetlock, hoof. The near foreleg is raised.
      const HOOF: Pt[] = [[0.0001, 0], [0.024, 0], [0.0225, 0.01], [0.018, 0.028], [0.014, 0.032], [0.0001, 0.032]];
      const leg = (top: V3, knee: V3, fet: V3, pas: V3, upper: number) => {
        h.push(rod(k, top, knee, upper, marble, 0.02, 16));
        h.push(k.sphere(0.021, marble, { at: knee, seg: 14 }));
        h.push(k.tube([knee, fet, pas], 0.0135, marble, { seg: 16 }));
        h.push(k.sphere(0.017, marble, { at: fet, seg: 12 }));
        const down = unit(sub(pas, fet));
        h.push(k.lathe(HOOF, marble, { at: add(pas, down, 0.032), rot: aim([-down[0], -down[1], -down[2]]), seg: 18 }));
      };
      leg([0.19, 0.34, -0.05], [0.2, 0.175, -0.05], [0.2, 0.06, -0.05], [0.212, 0.032, -0.05], 0.034);
      leg([0.19, 0.34, 0.05], [0.29, 0.25, 0.055], [0.26, 0.135, 0.055], [0.235, 0.112, 0.055], 0.034);
      leg([-0.17, 0.32, -0.05], [-0.255, 0.17, -0.05], [-0.245, 0.06, -0.05], [-0.232, 0.032, -0.05], 0.04);
      leg([-0.15, 0.32, 0.05], [-0.225, 0.17, 0.05], [-0.205, 0.06, 0.05], [-0.19, 0.032, 0.05], 0.04);
      // A long tail, carved as three locks.
      h.push(k.tube([[-0.29, 0.43, 0], [-0.35, 0.43, 0.005], [-0.4, 0.36, 0.015], [-0.415, 0.26, 0.01], [-0.4, 0.16, -0.01], [-0.37, 0.09, -0.02]], 0.022, marble, { seg: 40 }));
      h.push(k.tube([[-0.31, 0.43, 0.008], [-0.37, 0.41, 0.02], [-0.42, 0.32, 0.03], [-0.44, 0.22, 0.025], [-0.43, 0.13, 0.02]], 0.016, marble, { seg: 40 }));
      h.push(k.tube([[-0.3, 0.42, -0.01], [-0.36, 0.4, -0.02], [-0.39, 0.3, -0.03], [-0.385, 0.2, -0.035], [-0.35, 0.12, -0.03]], 0.014, marble, { seg: 40 }));
      g.add(k.group(h, { at: [-0.04, 0.54, 0], rot: [0, -0.2, 0] }));
      return g;
    },
  },

  rocket: {
    size: [0.62, 1.64, 0.62],
    build(k, o) {
      const paint = o.color ?? "#f1eee7";
      const B = 0.09;
      const XR = 0.07;
      const TX = -0.2;
      const steel = k.metal("#8c9298", 0.4);
      const red = k.paint("#b5432e", 0.45);
      const engine = k.metal("#3b3a39", 0.45);
      const white = k.paint(paint, 0.45);
      const ink = "#1d1f22";
      const roll = (c: CanvasRenderingContext2D, w: number, y0: number, y1: number, offset: number) => {
        c.fillStyle = ink;
        for (let q = 0; q < 4; q += 1) if ((q + offset) % 2 === 0) c.fillRect((q * w) / 4, y0, w / 4, y1 - y0);
      };
      const seams = (c: CanvasRenderingContext2D, w: number, h: number, every: number) => {
        c.fillStyle = "rgba(0,0,0,0.07)";
        for (let y = every * 0.7; y < h; y += every) c.fillRect(0, y, w, 2);
        for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 1, h);
      };
      const stage1 = canvasTexture(1024, 1080, (c, w, h) => {
        c.fillStyle = paint;
        c.fillRect(0, 0, w, h);
        seams(c, w, h, 120);
        roll(c, w, h * 0.86, h, 0);
        roll(c, w, 0, h * 0.07, 1);
        c.fillStyle = ink;
        c.font = "700 64px Inter, system-ui, sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        const word = "ALGEBRIDGE";
        for (let i = 0; i < word.length; i += 1) c.fillText(word[i], w * 0.06, h * 0.15 + i * 68);
      });
      const stage2 = canvasTexture(1024, 768, (c, w, h) => {
        c.fillStyle = paint;
        c.fillRect(0, 0, w, h);
        seams(c, w, h, 110);
        c.fillStyle = ink;
        c.fillRect(0, 0, w, h * 0.06);
        c.fillRect(0, h * 0.97, w, h * 0.03);
      });
      const stage3 = canvasTexture(1024, 580, (c, w, h) => {
        c.fillStyle = paint;
        c.fillRect(0, 0, w, h);
        seams(c, w, h, 100);
        roll(c, w, h * 0.55, h, 1);
      });
      const BELL: Pt[] = [[0.024, 0], [0.019, 0.014], [0.014, 0.03], [0.0105, 0.044], [0.009, 0.05], [0.007, 0.046], [0.0085, 0.036], [0.0125, 0.022], [0.0175, 0.008], [0.0215, 0.0]];
      const g = k.group([
        // A walnut base and a steel launch platform with its flame hole.
        k.box(0.62, B, 0.62, k.wood("walnut", { gloss: 0.55 }), { at: [0, B / 2, 0], r: 0.01 }),
        k.box(0.34, 0.04, 0.34, steel, { at: [XR, B + 0.02, 0], r: 0.004 }),
        k.cyl(0.05, 0.05, 0.002, k.paint("#121212", 0.2), { at: [XR, B + 0.041, 0], seg: 24 }),
        // Stages, bottom to top.
        k.cyl(0.066, 0.066, 0.012, k.paint("#2c2d30", 0.3), { at: [XR, 0.196, 0], seg: 40 }),
        k.cyl(0.068, 0.068, 0.45, k.print(stage1, { roughness: 0.5 }), { at: [XR, 0.427, 0], seg: 48 }),
        k.cyl(0.068, 0.068, 0.04, k.paint("#2c2d30", 0.4), { at: [XR, 0.672, 0], seg: 48 }),
        k.cyl(0.068, 0.068, 0.32, k.print(stage2, { roughness: 0.5 }), { at: [XR, 0.852, 0], seg: 48 }),
        k.cyl(0.048, 0.068, 0.06, white, { at: [XR, 1.042, 0], seg: 48 }),
        k.cyl(0.048, 0.048, 0.17, k.print(stage3, { roughness: 0.5 }), { at: [XR, 1.157, 0], seg: 40 }),
        k.cyl(0.048, 0.048, 0.012, k.paint("#c9ccd1", 0.4), { at: [XR, 1.248, 0], seg: 40 }),
        k.cyl(0.036, 0.048, 0.076, white, { at: [XR, 1.292, 0], seg: 40 }),
        k.cyl(0.036, 0.036, 0.05, k.metal("silver", 0.32), { at: [XR, 1.355, 0], seg: 32 }),
        k.lathe([[0.0001, 0], [0.036, 0], [0.03, 0.02], [0.018, 0.048], [0.008, 0.066], [0.0001, 0.07]], white, { at: [XR, 1.38, 0], seg: 32 }),
        // The escape tower: a little truss, its motor and nose.
        k.cyl(0.008, 0.008, 0.07, white, { at: [XR, 1.545, 0], seg: 16 }),
        k.cone(0.008, 0.026, k.paint(ink, 0.4), { at: [XR, 1.593, 0], seg: 16 }),
        // The umbilical tower beside it, with two swing arms and a hammerhead.
        k.box(0.142, 0.022, 0.035, red, { at: [TX + 0.06 + 0.071, 0.96, 0], r: 0.004 }),
        k.box(0.142, 0.022, 0.035, red, { at: [TX + 0.06 + 0.071, 1.27, 0], r: 0.004 }),
        k.box(0.2, 0.03, 0.05, red, { at: [TX + 0.03, 1.415, 0], r: 0.004 }),
      ]);
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * TAU;
        g.add(rod(k, [XR + 0.013 * Math.cos(a), 1.45, 0.013 * Math.sin(a)], [XR + 0.005 * Math.cos(a), 1.51, 0.005 * Math.sin(a)], 0.0018, steel, 0.0018, 6));
      }
      // Engines, fins and hold-downs, the outer four at the diagonals.
      g.add(k.lathe(BELL, engine, { at: [XR, 0.14, 0], seg: 24 }));
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI / 4 + (i / 4) * TAU;
        g.add(k.lathe(BELL, engine, { at: [XR + 0.037 * Math.cos(a), 0.14, 0.037 * Math.sin(a)], seg: 24 }));
        g.add(k.group([k.extrude([[0.064, 0.215], [0.064, 0.36], [0.135, 0.245], [0.135, 0.175]], 0.008, k.paint(ink, 0.4), { bevel: 0.002 })], { at: [XR, 0, 0], rot: [0, -a, 0] }));
        g.add(k.box(0.03, 0.07, 0.03, steel, { at: [XR + 0.1 * Math.cos(a), B + 0.075, 0.1 * Math.sin(a)], r: 0.004 }));
      }
      // The tower's four lattice faces.
      const tw = 0.12;
      const th = 1.31;
      const holes: Pt[][] = [];
      const bays = 11;
      const bar = 0.012;
      for (let i = 0; i < bays; i += 1) {
        const y0 = (i * th) / bays + bar;
        const y1 = ((i + 1) * th) / bays - bar;
        const x0 = -tw / 2 + bar;
        const x1 = tw / 2 - bar;
        const dd = bar * 1.3;
        if (i % 2 === 0) {
          holes.push([[x0, y0], [x1 - dd, y0], [x0, y1 - dd]]);
          holes.push([[x1, y0 + dd], [x1, y1], [x0 + dd, y1]]);
        } else {
          holes.push([[x0 + dd, y0], [x1, y0], [x1, y1 - dd]]);
          holes.push([[x0, y0 + dd], [x1 - dd, y1], [x0, y1]]);
        }
      }
      const face = rect(-tw / 2, 0, tw / 2, th);
      for (const [dx, dz, ry] of [[0, tw / 2, 0], [0, -tw / 2, 0], [tw / 2, 0, Math.PI / 2], [-tw / 2, 0, Math.PI / 2]] as [number, number, number][])
        g.add(k.extrude(face, 0.008, red, { at: [TX + dx, B, dz], rot: [0, ry, 0], holes, bevel: 0.0015 }));
      // The countdown on the base: units left to finish, or ready.
      const left = Math.max(0, o.live.unitsTotal - o.live.unitsDone);
      const msg = left === 0 ? "Ready to launch" : `${left} ${left === 1 ? "unit" : "units"} to launch`;
      const board = o.on
        ? canvasTexture(1024, 150, (c, w, h) => {
            c.fillStyle = "#080807";
            c.fillRect(0, 0, w, h);
            c.fillStyle = "rgba(255,170,60,0.08)";
            for (let x = 0; x < w; x += 6) for (let y = 0; y < h; y += 6) c.fillRect(x, y, 3, 3);
            c.fillStyle = left === 0 ? "#7dff9a" : "#ffb03a";
            c.shadowColor = c.fillStyle;
            c.shadowBlur = 14;
            c.font = "700 82px 'Courier New', monospace";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(msg.toUpperCase(), w / 2, h / 2 + 4);
          })
        : undefined;
      g.add(k.box(0.36, 0.066, 0.01, k.plastic("#111214", 0.6), { at: [0, B / 2, 0.31 + 0.005], r: 0.003 }));
      g.add(k.plane(0.34, 0.05, k.screen(o.on, board, 1.2), { at: [0, B / 2, 0.3156] }));
      return g;
    },
  },

  "dragon-egg": {
    size: [0.42, 0.95, 0.42],
    build(k, o) {
      const base = o.color ?? "#1f5a50";
      const wood = k.wood("walnut", { gloss: 0.6 });
      const bronze = k.metal("#8a6236", 0.38);
      const gold = k.metal("gold", 0.22);
      const shell = k.print(scaleTexture(base), { roughness: 0.32 });
      const EY = 0.412;
      const total = Math.max(1, o.live.unitsTotal);
      const done = Math.max(0, o.live.unitsDone);
      const hatched = done >= total;
      const g = k.group([
        // A turned walnut stand with gold rings.
        k.lathe(
          [[0.0001, 0], [0.2, 0], [0.2, 0.02], [0.185, 0.03], [0.17, 0.05], [0.13, 0.065], [0.07, 0.09], [0.055, 0.14], [0.065, 0.16], [0.05, 0.19], [0.04, 0.26], [0.05, 0.3], [0.07, 0.33], [0.11, 0.36], [0.14, 0.38], [0.15, 0.4], [0.14, 0.41], [0.0001, 0.41]],
          wood,
          { seg: 48 }
        ),
        k.torus(0.064, 0.006, gold, { at: [0, 0.16, 0], rot: [Math.PI / 2, 0, 0], seg: 32 }),
        k.torus(0.152, 0.006, gold, { at: [0, 0.395, 0], rot: [Math.PI / 2, 0, 0], seg: 48 }),
      ]);
      // Three bronze talons rise from the stand and hold the egg.
      for (let i = 0; i < 3; i += 1) {
        const a = 0.35 + (i / 3) * TAU;
        const at = (rr: number, y: number): V3 => [rr * Math.sin(a), y, rr * Math.cos(a)];
        const tip = at(eggR(0.33) + 0.004, EY + 0.165);
        g.add(k.sphere(0.02, bronze, { at: at(0.14, 0.42), seg: 14 }));
        g.add(k.tube([at(0.14, 0.42), at(eggR(0.12) + 0.014, EY + 0.06), at(eggR(0.24) + 0.011, EY + 0.12), tip], 0.011, bronze, { seg: 20 }));
        g.add(k.cone(0.009, 0.04, bronze, { at: add(tip, unit([-Math.sin(a) * 0.6, 0.8, -Math.cos(a) * 0.6]), 0.018), rot: aim([-Math.sin(a) * 0.6, 0.8, -Math.cos(a) * 0.6]), seg: 10 }));
      }
      // Gold bands set with cabochon rubies.
      const band = (t: number) => k.torus(eggR(t) + 0.002, 0.005, gold, { at: [0, EY + t * EGG_H, 0], rot: [Math.PI / 2, 0, 0], seg: 64 });
      const ruby = k.ceramic("#9b1328");
      if (!hatched) {
        g.add(k.lathe(eggProfile(0, 1), shell, { at: [0, EY, 0], seg: 48 }));
        g.add(band(0.24));
        g.add(band(0.64));
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU + 0.35;
          const rr = eggR(0.64) + 0.004;
          g.add(k.sphere(0.009, ruby, { at: [rr * Math.sin(a), EY + 0.64 * EGG_H, rr * Math.cos(a)], scale: [1, 1, 1], seg: 10 }));
        }
        // A crack for every unit finished, glowing from inside when it is on.
        const crack = o.on ? k.glow("#ff9a3c", true, 2.4) : k.paint("#1a120c", 0.2);
        const n = Math.min(done, 14);
        for (let i = 0; i < n; i += 1) {
          const r = seeded(900 + i * 53);
          let phi = (i < 7 ? -0.5 : 2.2) + r() * 2.2;
          let t = 0.42 + r() * 0.42;
          const dir = r() < 0.5 ? -1 : 1;
          const pts: V3[] = [];
          const steps = 6 + Math.floor(r() * 4);
          for (let s = 0; s < steps; s += 1) {
            const rr = eggR(t) + 0.0012;
            pts.push([rr * Math.sin(phi), EY + t * EGG_H, rr * Math.cos(phi)]);
            t = Math.min(0.93, Math.max(0.2, t + dir * (0.024 + r() * 0.022)));
            phi += (r() - 0.5) * 0.34;
          }
          g.add(k.tube(pts, 0.0026, crack, { seg: steps * 6 }));
        }
        return g;
      }
      // Hatched: the lower shell open, its edge broken, and a young dragon climbing out
      // with the top of the shell still on its head.
      const inside = k.ceramic("#efe4cc");
      const rim = 0.56;
      g.add(k.lathe(eggProfile(0, rim), shell, { at: [0, EY, 0], seg: 48 }));
      g.add(k.lathe([[eggR(rim), rim * EGG_H], ...eggProfile(0.05, rim, 0.006).reverse()], inside, { at: [0, EY, 0], seg: 48 }));
      g.add(band(0.24));
      for (let i = 0; i < 8; i += 1) {
        const r = seeded(70 + i * 13);
        const a = (i / 8) * TAU + r() * 0.3;
        const w = 0.04 + r() * 0.03;
        const hh = 0.03 + r() * 0.04;
        g.add(
          k.group([k.group([k.extrude([[-w / 2, 0], [w / 2, 0], [w * (r() - 0.5) * 0.6, hh]], 0.005, shell, { bevel: 0.001 })], { rot: [-0.25, 0, 0] })], {
            at: [Math.sin(a) * (eggR(rim) - 0.003), EY + rim * EGG_H - 0.004, Math.cos(a) * (eggR(rim) - 0.003)],
            rot: [0, a, 0],
          })
        );
      }
      const skin = k.ceramic(mix(base, "#ffffff", 0.12));
      const top = EY + rim * EGG_H;
      const hd: THREE.Object3D[] = [
        k.sphere(0.045, skin, { scale: [1, 0.9, 1.1], seg: 20 }),
        k.lathe([[0.0001, 0], [0.032, 0.006], [0.03, 0.04], [0.022, 0.07], [0.0001, 0.08]], skin, { at: [0, -0.012, 0.03], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.75], seg: 18 }),
      ];
      for (const s of [-1, 1]) {
        hd.push(k.sphere(0.0125, k.ceramic("#d9a330"), { at: [s * 0.03, 0.012, 0.034], seg: 14 }));
        hd.push(k.sphere(1, k.ceramic("#101010"), { at: [s * 0.031, 0.012, 0.046], scale: [0.0025, 0.009, 0.002], seg: 8 }));
        hd.push(k.cone(0.008, 0.035, k.ceramic(mix(base, "#e8dcc0", 0.6)), { at: [s * 0.025, 0.045, -0.02], rot: aim([s * 0.25, 0.8, -0.6]), seg: 10 }));
      }
      // The cap of the shell, tipped on its head.
      hd.push(k.group([k.lathe(eggProfile(0.66, 1), shell, { seg: 40 }), k.lathe([[eggR(0.66), 0.66 * EGG_H], ...eggProfile(0.66, 0.97, 0.006).reverse().slice(0, -1)], inside, { seg: 40 })], { at: [0.01, 0.005 - 0.66 * EGG_H, -0.01], rot: [-0.35, 0, 0.25] }));
      g.add(k.group(hd, { at: [0, top + 0.09, 0.03] }));
      g.add(k.sphere(0.05, skin, { at: [0, top - 0.01, 0.0], seg: 18 }));
      g.add(k.sphere(0.042, skin, { at: [0, top + 0.04, 0.015], seg: 18 }));
      const wing = wingParts(0.32);
      for (const s of [-1, 1]) {
        g.add(k.group([k.extrude(wing.outline, 0.004, skin, { bevel: 0.001 })], { at: [s * 0.05, top + 0.02, -0.03], rot: [s * 0.35, s * 1.2 + Math.PI, 0] }));
        const paw: V3 = [s * 0.05, top + 0.004, eggR(rim) * Math.cos(s * 0.3) - 0.004];
        g.add(k.sphere(1, skin, { at: paw, scale: [0.02, 0.014, 0.024], seg: 12 }));
        for (const t of [-1, 1]) g.add(k.cone(0.0035, 0.016, k.ceramic("#efe6d2"), { at: add(paw, [t * 0.009, -0.004, 0.022]), rot: aim([0, -0.6, 1]), seg: 6 }));
      }
      return g;
    },
  },

  "infinity-pool": {
    size: [2.4, 0.95, 1.6],
    build(k, o) {
      const tile = o.color ?? "#3d8fb5";
      const clad = k.stone("sandstone");
      const coping = k.stone("marble");
      const chrome = k.metal("chrome");
      // Blue mosaic, 5 cm tiles, with a darker waterline band at the top of the walls.
      const mosaic = (wm: number, hm: number, band: boolean) =>
        canvasTexture(Math.round(wm * 320), Math.round(hm * 320), (c, w, h) => {
          const rnd = seeded(Math.round(wm * 100 + hm * 7));
          c.fillStyle = mix(tile, "#ffffff", 0.55);
          c.fillRect(0, 0, w, h);
          const s = 16;
          for (let y = 0; y < h; y += s)
            for (let x = 0; x < w; x += s) {
              const top = band && y < s * 2;
              c.fillStyle = shade(top ? shade(tile, 0.55) : tile, 0.86 + rnd() * 0.28);
              c.fillRect(x + 1, y + 1, s - 2, s - 2);
              c.fillStyle = "rgba(255,255,255,0.12)";
              c.fillRect(x + 1, y + 1, s - 2, 2);
            }
        });
      const floorM = k.print(mosaic(2.08, 1.2, false), { roughness: 0.25 });
      const longM = k.print(mosaic(2.08, 0.505, true), { roughness: 0.25 });
      const shortM = k.print(mosaic(1.2, 0.505, true), { roughness: 0.25 });
      const water = k.water("#6cc2d8");
      const g = k.group([
        // The basin: stone-clad walls, a marble coping, a low weir at the front.
        k.box(2.4, 0.62, 0.16, clad, { at: [0, 0.31, -0.72], r: 0.006 }),
        k.box(0.16, 0.62, 1.44, clad, { at: [-1.12, 0.31, 0.08], r: 0.006 }),
        k.box(0.16, 0.62, 1.44, clad, { at: [1.12, 0.31, 0.08], r: 0.006 }),
        k.box(2.4, 0.04, 0.2, coping, { at: [0, 0.64, -0.7], r: 0.01 }),
        k.box(0.18, 0.04, 1.4, coping, { at: [-1.11, 0.64, 0.1], r: 0.01 }),
        k.box(0.18, 0.04, 1.4, coping, { at: [1.11, 0.64, 0.1], r: 0.01 }),
        k.box(2.08, 0.55, 0.08, clad, { at: [0, 0.275, 0.6], r: 0.004 }),
        k.box(2.08, 0.06, 1.2, clad, { at: [0, 0.03, -0.04] }),
        // The catch channel the water falls into.
        k.box(2.08, 0.32, 0.04, clad, { at: [0, 0.16, 0.78], r: 0.004 }),
        k.box(2.08, 0.26, 0.12, clad, { at: [0, 0.13, 0.7] }),
        // Mosaic on the floor and the inside of every wall.
        k.plane(2.08, 1.2, floorM, { at: [0, 0.061, -0.04], rot: [-Math.PI / 2, 0, 0] }),
        k.plane(2.08, 0.505, longM, { at: [0, 0.3125, -0.639] }),
        k.plane(2.08, 0.49, longM, { at: [0, 0.305, 0.559], rot: [0, Math.PI, 0] }),
        k.plane(1.2, 0.505, shortM, { at: [-1.039, 0.3125, -0.04], rot: [0, Math.PI / 2, 0] }),
        k.plane(1.2, 0.505, shortM, { at: [1.039, 0.3125, -0.04], rot: [0, -Math.PI / 2, 0] }),
        // Water to the brim, spilling over the front edge into the channel.
        k.plane(2.08, 1.28, water, { at: [0, 0.556, 0.0], rot: [-Math.PI / 2, 0, 0] }),
        k.plane(2.08, 0.27, k.water("#a8dce6"), { at: [0, 0.42, 0.6415] }),
        k.plane(2.08, 0.1, water, { at: [0, 0.262, 0.7], rot: [-Math.PI / 2, 0, 0] }),
        // Two lights set in the back wall.
        k.cyl(0.05, 0.05, 0.01, k.glow("#e8f8ff", o.on, 2.4), { at: [-0.5, 0.3, -0.634], rot: [Math.PI / 2, 0, 0], seg: 24 }),
        k.cyl(0.05, 0.05, 0.01, k.glow("#e8f8ff", o.on, 2.4), { at: [0.5, 0.3, -0.634], rot: [Math.PI / 2, 0, 0], seg: 24 }),
        // Two rolled towels on the coping.
        k.cyl(0.05, 0.05, 0.3, k.fabric("#f2efe8"), { at: [-0.75, 0.71, -0.7], rot: [0, 0, Math.PI / 2], seg: 20 }),
        k.cyl(0.05, 0.05, 0.3, k.fabric("#e9e2d4"), { at: [-0.75, 0.79, -0.7], rot: [0, 0, Math.PI / 2], seg: 20 }),
      ]);
      // A stainless ladder over the back wall: two curved rails, three treads.
      for (const x of [0.55, 0.95]) {
        g.add(k.tube([[x, 0.66, -0.77], [x, 0.84, -0.77], [x, 0.92, -0.72], [x, 0.89, -0.645], [x, 0.7, -0.6], [x, 0.4, -0.598], [x, 0.07, -0.598]], 0.019, chrome, { seg: 60 }));
        g.add(k.cyl(0.034, 0.034, 0.008, chrome, { at: [x, 0.664, -0.77], seg: 20 }));
      }
      for (const y of [0.44, 0.3, 0.16]) g.add(k.box(0.37, 0.02, 0.085, k.metal("steel", 0.3), { at: [0.75, y, -0.575], r: 0.004 }));
      return g;
    },
  },

  "time-machine": {
    size: [1.28, 1.66, 1.12],
    light: { at: [0, 0.78, 0.33], color: "#8fd8ff", intensity: 2.2, distance: 3.5 },
    build(k, o) {
      const brass = k.metal("brass", 0.3);
      const copper = k.metal("copper", 0.34);
      const wood = k.wood("walnut", { gloss: 0.6 });
      const velvet = k.velvet(o.color ?? "#7d1f2a");
      const core = k.glow("#8fe4ff", o.on, 3);
      const DZ = -0.42;
      const DY = 1.02;
      const g = k.group([
        // A walnut platform on brass sled runners.
        k.box(1.0, 0.08, 1.0, wood, { at: [0, 0.14, -0.02], r: 0.012 }),
        k.extrude(rect(-0.51, -0.51, 0.51, 0.51), 0.012, brass, { at: [0, 0.186, -0.02], rot: [-Math.PI / 2, 0, 0], holes: [rect(-0.47, -0.47, 0.47, 0.47)], bevel: 0.003 }),
        k.box(0.62, 0.006, 0.9, k.fabric("#5c1f24"), { at: [0, 0.183, -0.02] }),
        // The great disc behind the seat.
        k.cyl(0.64, 0.64, 0.03, brass, { at: [0, DY, DZ], rot: [Math.PI / 2, 0, 0], seg: 72 }),
        k.torus(0.6, 0.012, copper, { at: [0, DY, DZ + 0.017], seg: 72 }),
        k.torus(0.42, 0.012, copper, { at: [0, DY, DZ + 0.017], seg: 64 }),
        k.cyl(0.09, 0.09, 0.05, copper, { at: [0, DY, DZ + 0.03], rot: [Math.PI / 2, 0, 0], seg: 32 }),
        k.sphere(0.05, brass, { at: [0, DY, DZ + 0.055], seg: 20 }),
        rod(k, [0, 0.18, DZ], [0, DY - 0.09, DZ], 0.03, brass),
        // The seat: a walnut box, velvet cushions, a tall back.
        k.box(0.56, 0.3, 0.5, wood, { at: [0, 0.33, -0.05], r: 0.012 }),
        k.cushion(0.52, 0.1, 0.48, velvet, { at: [0, 0.53, -0.04] }),
        k.cushion(0.52, 0.56, 0.1, velvet, { at: [0, 0.86, -0.25], rot: [-0.12, 0, 0] }),
        k.box(0.58, 0.62, 0.05, wood, { at: [0, 0.86, -0.315], rot: [-0.12, 0, 0], r: 0.015 }),
        // The console in front: walnut pedestal, a brass panel tilted up.
        k.box(0.5, 0.42, 0.18, wood, { at: [0, 0.39, 0.33], r: 0.01 }),
        k.box(0.58, 0.025, 0.26, brass, { at: [0, 0.615, 0.33], rot: [0.3, 0, 0], r: 0.006 }),
      ]);
      for (const s of [-1, 1]) {
        g.add(k.tube([[s * 0.42, 0.03, -0.54], [s * 0.42, 0.025, 0.25], [s * 0.42, 0.05, 0.44], [s * 0.42, 0.12, 0.53], [s * 0.42, 0.18, 0.54]], 0.022, brass, { seg: 40 }));
        for (const z of [-0.35, 0.3]) g.add(k.cyl(0.012, 0.012, 0.08, brass, { at: [s * 0.42, 0.065, z], seg: 12 }));
        g.add(rod(k, [s * 0.46, 0.18, DZ - 0.02], [s * 0.5, 0.72, DZ - 0.02], 0.016, brass));
        // Brass armrests curving down to the seat.
        g.add(k.tube([[s * 0.3, 0.72, -0.28], [s * 0.3, 0.7, 0.1], [s * 0.3, 0.6, 0.18], [s * 0.29, 0.48, 0.19]], 0.014, brass, { seg: 30 }));
        // Copper pipes from the console down into the deck.
        g.add(k.tube([[s * 0.2, 0.55, 0.42], [s * 0.26, 0.4, 0.45], [s * 0.3, 0.2, 0.43]], 0.012, copper, { seg: 20 }));
      }
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * TAU;
        g.add(k.box(0.02, 0.18, 0.012, copper, { at: [Math.cos(a) * 0.51, DY + Math.sin(a) * 0.51, DZ + 0.02], rot: [0, 0, a - Math.PI / 2], r: 0.004 }));
      }
      // Dials on the panel, and two levers.
      const panel = k.group([], { at: [0, 0.615, 0.33], rot: [0.3, 0, 0] });
      const dials: [number, string, number][] = [[-0.18, "YEARS", o.on ? 0.62 : 0], [0.18, "CENTURIES", o.on ? 0.4 : 0]];
      for (const [x, label, v] of dials) {
        panel.add(k.disc(0.055, k.print(gauge(label, v, label === "YEARS" ? 100 : 12), { roughness: 0.4 }), { at: [x, 0.0135, 0.02], rot: [-Math.PI / 2, 0, 0], seg: 40 }));
        panel.add(k.torus(0.057, 0.008, brass, { at: [x, 0.016, 0.02], rot: [Math.PI / 2, 0, 0], seg: 40 }));
      }
      g.add(panel);
      for (const s of [-1, 1]) {
        g.add(k.torus(0.07, 0.007, brass, { at: [s * 0.27, 0.62, 0.33], rot: [0, Math.PI / 2, 0], arc: Math.PI, seg: 24 }));
        g.add(rod(k, [s * 0.27, 0.62, 0.33], [s * 0.27, 0.8, 0.33 + s * 0.06], 0.006, brass));
        g.add(k.sphere(0.02, k.plastic("#151515", 0.7), { at: [s * 0.27, 0.81, 0.33 + s * 0.064], seg: 14 }));
      }
      // The core: a glass chamber with a glowing crystal, in a brass cage.
      const coreAt: V3 = [0, 0.64, 0.33];
      g.add(k.cyl(0.062, 0.066, 0.035, brass, { at: add(coreAt, [0, 0.0175, 0]), seg: 32 }));
      g.add(k.cyl(0.05, 0.05, 0.2, k.glass("#dff4ff", 0.18), { at: add(coreAt, [0, 0.135, 0]), seg: 32 }));
      g.add(k.lathe([[0.0001, 0], [0.012, 0.02], [0.022, 0.03], [0.022, 0.13], [0.012, 0.15], [0.0001, 0.17]], core, { at: add(coreAt, [0, 0.05, 0]), seg: 6 }));
      g.add(k.cyl(0.062, 0.058, 0.03, brass, { at: add(coreAt, [0, 0.25, 0]), seg: 32 }));
      g.add(k.sphere(0.022, brass, { at: add(coreAt, [0, 0.283, 0]), seg: 14 }));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * TAU + 0.5;
        g.add(rod(k, add(coreAt, [Math.cos(a) * 0.06, 0.03, Math.sin(a) * 0.06]), add(coreAt, [Math.cos(a) * 0.06, 0.24, Math.sin(a) * 0.06]), 0.004, brass, 0.004, 8));
      }
      // The destination, in glowing digits on the console's face, and its plate.
      const nixie = o.on
        ? canvasTexture(512, 112, (c, w, h) => {
            c.fillStyle = "#120c08";
            c.fillRect(0, 0, w, h);
            const digits = "0820";
            for (let i = 0; i < digits.length; i += 1) {
              const x = 40 + i * 92;
              c.strokeStyle = "rgba(180,140,90,0.35)";
              c.lineWidth = 3;
              c.strokeRect(x, 10, 76, h - 20);
              c.fillStyle = "#ff8a2a";
              c.shadowColor = "#ff7a1a";
              c.shadowBlur = 18;
              c.font = "400 78px Georgia, serif";
              c.textAlign = "center";
              c.textBaseline = "middle";
              c.fillText(digits[i], x + 38, h / 2 + 4);
              c.shadowBlur = 0;
            }
            c.fillStyle = "#ff8a2a";
            c.font = "600 34px Georgia, serif";
            c.fillText("AD", 448, h / 2 + 2);
          })
        : undefined;
      g.add(k.box(0.3, 0.085, 0.012, brass, { at: [0, 0.47, 0.426], r: 0.004 }));
      g.add(k.plane(0.27, 0.06, k.screen(o.on, nixie, 1.3), { at: [0, 0.47, 0.4325] }));
      g.add(k.plane(0.3, 0.04, k.print(plate("AL-JABR, BAGHDAD", "Destination"), { roughness: 0.35 }), { at: [0, 0.37, 0.4205] }));
      return g;
    },
  },

  "hot-tub": {
    size: [1.75, 0.96, 2.2],
    light: { at: [0, 0.55, -0.23], color: "#8fdcff", intensity: 1.6, distance: 3 },
    build(k, o) {
      const TZ = -0.23;
      const R0 = 0.865;
      const R1 = 0.85;
      const T = 0.045;
      const H = 0.95;
      const cedar = o.color ?? "#9e5c37";
      const staves = canvasTexture(2048, 128, (c, w, h) => {
        const rnd = seeded(61);
        const n = 64;
        for (let i = 0; i < n; i += 1) {
          const x0 = (i / n) * w;
          const sw = w / n;
          c.fillStyle = shade(cedar, 0.82 + rnd() * 0.3);
          c.fillRect(x0, 0, sw, h);
          for (let j = 0; j < 6; j += 1) {
            c.fillStyle = `rgba(60,30,15,${0.05 + rnd() * 0.1})`;
            c.fillRect(x0 + rnd() * sw, 0, 1 + rnd() * 1.5, h);
          }
          c.fillStyle = "rgba(30,15,8,0.55)";
          c.fillRect(x0, 0, 2, h);
        }
      });
      const wood = k.wood(cedar, { gloss: 0.3 });
      const iron = k.metal("black", 0.45);
      const chrome = k.metal("chrome");
      const inner = R1 - T;
      const g = k.group([
        // The tub: cedar staves in one ring, a floor and a bench inside.
        k.lathe([[R0, 0], [R1, H], [inner, H], [inner, 0.12]], k.print(staves, { roughness: 0.62 }), { at: [0, 0, TZ], seg: 72 }),
        k.cyl(inner, inner, 0.02, k.wood("#7d4a2c", { gloss: 0.2 }), { at: [0, 0.11, TZ], seg: 48 }),
        k.lathe([[0.6, 0.44], [inner, 0.44], [inner, 0.48], [0.6, 0.48], [0.6, 0.44]], k.wood("#a86b44", { gloss: 0.3 }), { at: [0, 0, TZ], seg: 64 }),
        // Water, brighter when the light under it is on.
        k.disc(inner + 0.002, k.water(o.on ? "#7fd6e8" : "#4d8796"), { at: [0, 0.8, TZ], rot: [-Math.PI / 2, 0, 0], seg: 64 }),
        k.cyl(0.045, 0.045, 0.012, k.glow("#9fe8ff", o.on, 2.8), { at: [0, 0.36, TZ - inner + 0.006], rot: [Math.PI / 2, 0, 0], seg: 24 }),
        k.torus(0.048, 0.006, chrome, { at: [0, 0.36, TZ - inner + 0.008], seg: 24 }),
        // Two steps up to the rim, a folded towel on the top one.
        k.box(0.62, 0.62, 0.26, wood, { at: [0, 0.31, TZ + 0.93], r: 0.01 }),
        k.box(0.62, 0.31, 0.26, wood, { at: [0, 0.155, TZ + 1.19], r: 0.01 }),
        k.box(0.66, 0.03, 0.29, wood, { at: [0, 0.635, TZ + 0.93], r: 0.006 }),
        k.box(0.66, 0.03, 0.29, wood, { at: [0, 0.325, TZ + 1.19], r: 0.006 }),
        k.cushion(0.3, 0.05, 0.2, k.fabric("#f3f0ea"), { at: [0.12, 0.675, TZ + 0.93] }),
      ]);
      // Iron hoops, each with its tension lug.
      for (const y of [0.2, 0.78]) {
        const rr = R0 + (R1 - R0) * (y / H) + 0.004;
        g.add(k.torus(rr, 0.011, iron, { at: [0, y, TZ], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 2.6], seg: 72 }));
        g.add(k.box(0.06, 0.04, 0.02, iron, { at: [Math.sin(0.55) * (rr + 0.012), y, TZ + Math.cos(0.55) * (rr + 0.012)], rot: [0, 0.55, 0], r: 0.004 }));
      }
      // Jets round the inside.
      for (const a of [0.9, -0.9, 2.3, -2.3]) {
        const rr = inner - 0.004;
        g.add(k.cyl(0.018, 0.018, 0.012, chrome, { at: [Math.sin(a) * rr, 0.32, TZ + Math.cos(a) * rr], rot: aim([Math.sin(a), 0, Math.cos(a)]), seg: 16 }));
      }
      return g;
    },
  },

  greenhouse: {
    size: [1.2, 1.92, 0.8],
    build(k, o) {
      const W = 1.2;
      const D = 0.76;
      const E = 1.55;
      const RG = 1.9;
      const frame = k.paint(o.color ?? "#26302b", 0.5);
      const glass = k.glass("#e2efe9", 0.16);
      const wood = k.wood("#8c6a48", { gloss: 0.2 });
      const pot = k.stone("terracotta");
      const xs = W / 2 - 0.015;
      const zs = D / 2 - 0.015;
      const postH = E - 0.06;
      const g = k.group([
        // Sill, posts, eaves, ridge.
        k.extrude(rect(-W / 2, -D / 2, W / 2, D / 2), 0.06, frame, { at: [0, 0.03, 0], rot: [-Math.PI / 2, 0, 0], holes: [rect(-W / 2 + 0.04, -D / 2 + 0.04, W / 2 - 0.04, D / 2 - 0.04)], bevel: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [-xs, 0.06 + postH / 2, zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [xs, 0.06 + postH / 2, zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [-xs, 0.06 + postH / 2, -zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [xs, 0.06 + postH / 2, -zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [-0.27, 0.06 + postH / 2, zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [0.27, 0.06 + postH / 2, zs], r: 0.004 }),
        k.box(0.03, postH, 0.03, frame, { at: [0, 0.06 + postH / 2, -zs], r: 0.004 }),
        k.box(W, 0.035, 0.035, frame, { at: [0, E, zs], r: 0.004 }),
        k.box(W, 0.035, 0.035, frame, { at: [0, E, -zs], r: 0.004 }),
        k.box(0.035, 0.035, D, frame, { at: [-xs, E, 0], r: 0.004 }),
        k.box(0.035, 0.035, D, frame, { at: [xs, E, 0], r: 0.004 }),
        k.box(W, 0.04, 0.04, frame, { at: [0, RG, 0], r: 0.006 }),
        // Rails at bench height.
        k.box(W, 0.025, 0.025, frame, { at: [0, 0.75, -zs], r: 0.003 }),
        k.box(0.025, 0.025, D, frame, { at: [-xs, 0.75, 0], r: 0.003 }),
        k.box(0.025, 0.025, D, frame, { at: [xs, 0.75, 0], r: 0.003 }),
        k.box(0.3, 0.025, 0.025, frame, { at: [-0.42, 0.75, zs], r: 0.003 }),
        k.box(0.3, 0.025, 0.025, frame, { at: [0.42, 0.75, zs], r: 0.003 }),
        // The door: a frame of its own, glazed, a brass knob.
        k.extrude(rect(-0.25, 0.07, 0.25, E - 0.03), 0.02, frame, { at: [0, 0, zs + 0.022], holes: [rect(-0.22, 0.1, 0.22, E - 0.06)], bevel: 0.003 }),
        k.box(0.46, 0.022, 0.016, frame, { at: [0, 0.75, zs + 0.022], r: 0.003 }),
        k.box(0.45, E - 0.15, 0.005, glass, { at: [0, (E + 0.04) / 2, zs + 0.022] }),
        k.sphere(0.016, k.metal("brass", 0.3), { at: [0.2, 0.95, zs + 0.045], seg: 12 }),
        // Glass walls and roof.
        k.box(0.3, postH, 0.005, glass, { at: [-0.42, 0.06 + postH / 2, zs] }),
        k.box(0.3, postH, 0.005, glass, { at: [0.42, 0.06 + postH / 2, zs] }),
        k.box(W - 0.03, postH, 0.005, glass, { at: [0, 0.06 + postH / 2, -zs] }),
        k.box(0.005, postH, D - 0.03, glass, { at: [-xs, 0.06 + postH / 2, 0] }),
        k.box(0.005, postH, D - 0.03, glass, { at: [xs, 0.06 + postH / 2, 0] }),
        k.box(W - 0.02, 0.005, Math.hypot(zs, RG - E), glass, { at: [0, (E + RG) / 2, zs / 2], rot: [Math.atan2(RG - E, zs), 0, 0] }),
        k.box(W - 0.02, 0.005, Math.hypot(zs, RG - E), glass, { at: [0, (E + RG) / 2, -zs / 2], rot: [-Math.atan2(RG - E, zs), 0, 0] }),
        k.extrude([[-zs, 0], [zs, 0], [0, RG - E]], 0.005, glass, { at: [-xs, E, 0], rot: [0, Math.PI / 2, 0], bevel: 0.001 }),
        k.extrude([[-zs, 0], [zs, 0], [0, RG - E]], 0.005, glass, { at: [xs, E, 0], rot: [0, Math.PI / 2, 0], bevel: 0.001 }),
        // A terracotta floor, a slatted bench along the back, a shelf above it.
        k.box(W - 0.08, 0.012, D - 0.08, k.stone("terracotta"), { at: [0, 0.006, 0] }),
        k.box(1.08, 0.03, 0.28, wood, { at: [0, 0.7, -0.2], r: 0.004 }),
        k.box(0.03, 0.685, 0.24, wood, { at: [-0.5, 0.3425, -0.2], r: 0.004 }),
        k.box(0.03, 0.685, 0.24, wood, { at: [0.5, 0.3425, -0.2], r: 0.004 }),
        k.box(1.08, 0.025, 0.18, wood, { at: [0, 1.2, -0.26], r: 0.004 }),
      ]);
      for (const x of [-xs, 0, xs])
        for (const s of [-1, 1]) g.add(beam(k, [x, E, s * zs], [x, RG, 0], 0.03, 0.03, frame));
      // The plants: they grow with the daily goals reached, and droop after three days without practice.
      const growth = clamp01(o.live.growth);
      const grow = 0.45 + growth * 0.55;
      const droop = o.live.thirsty ? 0.45 : 0;
      const potAt = (x: number, y: number, z: number, r: number, h: number) => {
        g.add(k.lathe([[0.0001, 0], [r * 0.72, 0], [r * 0.76, h * 0.06], [r * 0.92, h * 0.86], [r, h * 0.88], [r, h], [r * 0.9, h], [r * 0.86, h * 0.92], [0.0001, h * 0.92]], pot, { at: [x, y, z], seg: 28 }));
      };
      // A lemon tree in a big pot by the door.
      potAt(-0.33, 0.012, 0.12, 0.13, 0.28);
      g.add(k.cyl(0.112, 0.112, 0.008, k.soil(), { at: [-0.33, 0.27, 0.12], seg: 24 }));
      const trunkH = 0.3 + 0.38 * grow;
      g.add(k.tube([[-0.33, 0.27, 0.12], [-0.32, 0.27 + trunkH * 0.5, 0.115], [-0.335, 0.27 + trunkH, 0.12]], 0.014, k.wood("#5b4532", { gloss: 0.1 }), { seg: 12 }));
      const crown: V3 = [-0.335, 0.27 + trunkH + 0.08 * grow - droop * 0.05, 0.12];
      const cr = 0.11 + 0.08 * grow;
      for (const [dx, dy, dz, s] of [[0, 0, 0, 1], [0.07, -0.03, 0.04, 0.75], [-0.07, -0.02, -0.03, 0.8]] as [number, number, number, number][])
        g.add(k.sphere(cr * s, k.leaf(dx > 0 ? 1 : 3), { at: add(crown, [dx * grow, dy * grow, dz * grow]), scale: [1, 0.85, 1], seg: 9 }));
      const lemons = growth >= 0.2 ? Math.min(4, 1 + Math.floor(growth * 4)) : 0;
      for (let i = 0; i < lemons; i += 1) {
        const a = 0.3 + i * 1.3;
        g.add(k.sphere(0.022, k.ceramic("#e8c53a"), { at: add(crown, [Math.sin(a) * cr * 0.92, -cr * 0.25 + (i % 2) * 0.05, Math.cos(a) * cr * 0.92]), scale: [1.25, 0.95, 0.95], seg: 12 }));
      }
      // A tomato on the bench, tied to a cane.
      potAt(0.32, 0.715, -0.2, 0.085, 0.17);
      g.add(k.cyl(0.074, 0.074, 0.006, k.soil(), { at: [0.32, 0.87, -0.2], seg: 20 }));
      const tomH = 0.12 + 0.3 * grow;
      g.add(k.cyl(0.005, 0.005, 0.46, k.wood("#c9a86a", { gloss: 0.3 }), { at: [0.35, 0.87 + 0.23, -0.21], seg: 8 }));
      g.add(k.tube([[0.32, 0.87, -0.2], [0.33, 0.87 + tomH * 0.5, -0.19], [0.34, 0.87 + tomH, -0.205]], 0.005, k.leaf(0), { seg: 12 }));
      for (let i = 0; i < 3; i += 1) {
        const a = i * 2.1;
        g.add(k.sphere(0.05 * grow + 0.02, k.leaf(i), { at: [0.33 + Math.sin(a) * 0.04, 0.87 + tomH * (0.45 + i * 0.22) - droop * 0.04, -0.2 + Math.cos(a) * 0.04], scale: [1.2, 0.55, 1.1], seg: 9 }));
      }
      const toms = growth >= 0.3 ? 1 + Math.floor(growth * 3) : 0;
      for (let i = 0; i < Math.min(3, toms); i += 1) g.add(k.sphere(0.02, k.ceramic("#c8382a"), { at: [0.3 + i * 0.03, 0.87 + tomH * 0.42 - i * 0.02, -0.15], scale: [1, 0.9, 1], seg: 12 }));
      // Basil in a small pot.
      potAt(0.0, 0.715, -0.2, 0.07, 0.11);
      for (let i = 0; i < 6; i += 1) {
        const a = i * 1.05;
        const lf = 0.035 + 0.03 * grow;
        const arm = new THREE.Group();
        arm.add(k.sphere(1, k.leaf(i % 2 ? 2 : 4), { at: [0, 0, lf * 0.7], scale: [lf * 0.6, lf * 0.25, lf] , seg: 10 }));
        arm.position.set(0, 0.815 + (i % 2) * 0.03 * grow, -0.2);
        arm.rotation.set(-0.35 + droop, a, 0);
        g.add(arm);
      }
      // On the shelf: a succulent and a trailing pothos.
      potAt(-0.3, 1.2125, -0.26, 0.05, 0.07);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU;
        const sz = 0.03 + 0.02 * grow;
        g.add(k.cone(sz * 0.42, sz, k.leaf(4), { at: [-0.3 + Math.sin(a) * sz * 0.4, 1.29, -0.26 + Math.cos(a) * sz * 0.4], rot: aim([Math.sin(a), 1.1, Math.cos(a)]), scale: [1, 1, 0.45], seg: 8 }));
      }
      potAt(0.3, 1.2125, -0.27, 0.055, 0.08);
      for (let i = 0; i < 3; i += 1) {
        const dx = (i - 1) * 0.04;
        const drop = (0.12 + 0.3 * grow) * (0.7 + i * 0.15);
        g.add(k.tube([[0.3 + dx, 1.29, -0.26], [0.3 + dx * 1.5, 1.28, -0.19], [0.3 + dx * 2, 1.24, -0.17], [0.3 + dx * 2.2, 1.24 - drop, -0.16]], 0.004, k.leaf(1), { seg: 16 }));
      }
      return g;
    },
  },

  planetarium: {
    size: [0.7, 1.42, 0.7],
    light: { at: [0, 1.18, 0], color: "#c8d6ff", intensity: 1.6, distance: 4 },
    build(k, o) {
      const brass = k.metal("brass", 0.3);
      const walnut = k.wood("walnut", { gloss: 0.55 });
      const body = o.color ?? "#1d2a4a";
      const C: V3 = [0, 1.18, 0];
      const RB = 0.2;
      // The star ball: a lacquered sphere pricked with stars; they shine when it is on.
      const sky = canvasTexture(2048, 1024, (c, w, h) => {
        c.fillStyle = shade(body, 0.42);
        c.fillRect(0, 0, w, h);
        const rnd = seeded(303);
        // The Milky Way: a soft band of faint stars round a tilted circle.
        for (let i = 0; i < 2600; i += 1) {
          const lon = rnd() * TAU;
          const lat = 0.42 * Math.sin(lon + 0.6) + (rnd() - 0.5) * 0.3 * (rnd() + 0.2);
          const sq = Math.max(0.2, Math.cos(lat));
          c.fillStyle = `rgba(220,226,255,${0.15 + rnd() * 0.3})`;
          c.fillRect((lon / TAU) * w, (0.5 - lat / Math.PI) * h, 1.4 / sq, 1.4);
        }
        for (let i = 0; i < 1500; i += 1) {
          const lon = rnd() * TAU;
          const lat = Math.asin(2 * rnd() - 1);
          const sq = Math.max(0.2, Math.cos(lat));
          const b = rnd();
          const r = b > 0.985 ? 3.4 : b > 0.92 ? 2.1 : 1 + rnd() * 0.7;
          const tint = rnd();
          c.fillStyle = tint < 0.1 ? "#ffd9a8" : tint < 0.2 ? "#cfe0ff" : "#ffffff";
          c.beginPath();
          c.ellipse((lon / TAU) * w, (0.5 - lat / Math.PI) * h, r / sq, r, 0, 0, TAU);
          c.fill();
        }
      });
      const lens = k.glow("#e4ecff", o.on, 2.6);
      const housing = k.metal("black", 0.35);
      const ball: THREE.Object3D[] = [
        k.sphere(RB, k.print(sky, { roughness: 0.3, glow: o.on ? 1.7 : 0 }), { seg: 56 }),
        k.torus(RB + 0.004, 0.007, brass, { rot: [Math.PI / 2, 0, 0], seg: 64 }),
        k.torus(RB + 0.006, 0.005, brass, { rot: [0, Math.PI / 2, 0], seg: 64 }),
      ];
      // Projector lenses round the ball, each in a black housing.
      for (let i = 0; i < 14; i += 1) {
        const y = 1 - ((i + 0.5) / 14) * 1.7;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * 2.39996;
        const dir: V3 = [Math.cos(a) * rr, y, Math.sin(a) * rr];
        if (Math.abs(dir[0]) > 0.82) continue;
        ball.push(k.cyl(0.02, 0.025, 0.04, housing, { at: add([0, 0, 0], dir, RB + 0.012), rot: aim(dir), seg: 14 }));
        ball.push(k.cyl(0.015, 0.015, 0.004, lens, { at: add([0, 0, 0], dir, RB + 0.033), rot: aim(dir), seg: 14 }));
      }
      const g = k.group([
        k.group(ball, { at: C, rot: [-0.45, 0, 0] }),
        // The fork it turns in, its pivots and knobs.
        k.torus(0.25, 0.012, brass, { at: C, rot: [0, 0, Math.PI], arc: Math.PI, seg: 40 }),
        k.cyl(0.016, 0.016, 0.05, brass, { at: [-0.225, C[1], 0], rot: [0, 0, Math.PI / 2], seg: 14 }),
        k.cyl(0.016, 0.016, 0.05, brass, { at: [0.225, C[1], 0], rot: [0, 0, Math.PI / 2], seg: 14 }),
        k.sphere(0.022, brass, { at: [-0.262, C[1], 0], seg: 14 }),
        k.sphere(0.022, brass, { at: [0.262, C[1], 0], seg: 14 }),
        // A brass column and hub on a walnut tripod with a shelf.
        k.cyl(0.022, 0.03, 0.12, brass, { at: [0, 0.87, 0], seg: 20 }),
        k.cyl(0.05, 0.05, 0.06, brass, { at: [0, 0.78, 0], seg: 24 }),
      ]);
      const feet: V3[] = [];
      for (let i = 0; i < 3; i += 1) {
        const a = Math.PI / 2 + (i / 3) * TAU + Math.PI;
        const top: V3 = [Math.cos(a) * 0.035, 0.77, Math.sin(a) * 0.035];
        const foot: V3 = [Math.cos(a) * 0.33, 0.035, Math.sin(a) * 0.33];
        g.add(rod(k, top, foot, 0.017, walnut, 0.013, 12));
        g.add(rod(k, foot, add(foot, [0, -0.035, 0]), 0.016, brass, 0.02, 12));
        feet.push(foot);
      }
      const shelfY = 0.3;
      const tt = (0.77 - shelfY) / (0.77 - 0.035);
      g.add(k.extrude(smooth(feet.map(([x, , z]) => [lerp(x * 0.106, x, tt) * 0.92, -lerp(z * 0.106, z, tt) * 0.92] as Pt), 4), 0.018, walnut, { at: [0, shelfY, 0], rot: [-Math.PI / 2, 0, 0], bevel: 0.004 }));
      return g;
    },
  },

  "dino-skeleton": {
    size: [2.3, 1.3, 0.72],
    build(k, o) {
      const bone = k.paint("#d9cba9", 0.18);
      const base = k.paint(o.color ?? "#1b1c1f", 0.55);
      const steel = k.metal("black", 0.5);
      const label = canvasTexture(800, 100, (c, w, h) => {
        c.fillStyle = "#151517";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#f0ece2";
        c.textBaseline = "middle";
        c.font = "700 40px Georgia, serif";
        c.fillText("TYRANNOSAURUS REX", 24, h * 0.38);
        c.font = "italic 400 24px Georgia, serif";
        c.fillStyle = "#bdb6a6";
        c.fillText("Cast skeleton, 1:5 scale", 24, h * 0.76);
      });
      const g = k.group([
        k.box(2.3, 0.1, 0.72, base, { at: [0, 0.05, 0], r: 0.012 }),
        k.box(2.2, 0.012, 0.62, k.stone("sandstone"), { at: [0, 0.106, 0], r: 0.004 }),
        k.plane(0.48, 0.06, k.print(label, { roughness: 0.6 }), { at: [0.72, 0.05, 0.3605] }),
      ]);
      const s: THREE.Object3D[] = [];
      // The spine: tail, back, neck, each vertebra its own bone.
      const DORSAL: Pt[] = [[-0.026, -0.024], [-0.008, -0.018], [0.008, -0.018], [0.026, -0.024], [0.028, 0.02], [0.014, 0.028], [0.017, 0.1], [0.008, 0.112], [-0.012, 0.11], [-0.018, 0.098], [-0.014, 0.028], [-0.028, 0.02]];
      const CAUDAL: Pt[] = [[-0.024, -0.018], [-0.008, -0.016], [-0.004, -0.07], [0.004, -0.072], [0.008, -0.016], [0.024, -0.018], [0.024, 0.016], [0.01, 0.022], [0.014, 0.07], [0.004, 0.076], [-0.006, 0.07], [-0.01, 0.022], [-0.024, 0.016]];
      const CERVICAL: Pt[] = [[-0.034, -0.02], [0.034, -0.024], [0.036, 0.016], [0.016, 0.03], [0.012, 0.05], [-0.012, 0.05], [-0.018, 0.03], [-0.036, 0.018]];
      const vert = (outline: Pt[], curve: THREE.CatmullRomCurve3, u: number, sz: number) => {
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u);
        s.push(k.extrude(outline, 0.05, bone, { at: [p.x, p.y, 0], rot: [0, 0, Math.atan2(t.y, t.x)], scale: [sz, sz, sz], bevel: 0.004 }));
      };
      const tail = path([[-0.15, 0.885, 0], [-0.35, 0.875, 0], [-0.55, 0.85, 0], [-0.75, 0.81, 0], [-0.95, 0.76, 0], [-1.13, 0.7, 0]]);
      const sizes = Array.from({ length: 15 }, (_, i) => 1 - 0.62 * (i / 14));
      const totalLen = sizes.reduce((a, b) => a + b, 0);
      let acc = 0;
      sizes.forEach((sz) => {
        vert(CAUDAL, tail, Math.min(0.995, (acc + sz / 2) / totalLen), sz);
        acc += sz;
      });
      const trunk = path([[-0.15, 0.885, 0], [0.05, 0.885, 0], [0.25, 0.865, 0], [0.42, 0.83, 0]]);
      for (let i = 0; i < 9; i += 1) vert(DORSAL, trunk, (i + 0.5) / 9, 1);
      const neck = path([[0.42, 0.83, 0], [0.5, 0.85, 0], [0.58, 0.92, 0], [0.64, 1.0, 0], [0.7, 1.06, 0]]);
      for (let i = 0; i < 5; i += 1) vert(CERVICAL, neck, (i + 0.5) / 5, 0.95);
      // Ribs down both sides of the chest.
      for (let i = 0; i < 8; i += 1) {
        const u = 0.08 + (i / 7) * 0.84;
        const p = trunk.getPointAt(u);
        const L = 0.36 * (1 - Math.abs(u - 0.4) * 1.1) + 0.06;
        for (const side of [-1, 1])
          s.push(k.tube([[p.x, p.y - 0.015, side * 0.025], [p.x - 0.01, p.y - 0.06, side * 0.12], [p.x - 0.02, p.y - 0.45 * L, side * 0.16], [p.x - 0.01, p.y - 0.8 * L, side * 0.13], [p.x + 0.015, p.y - L, side * 0.07]], 0.008, bone, { seg: 20 }));
      }
      // The pelvis either side of the hip, the shoulder blades, the little arms.
      const hip: V3 = [-0.12, 0.78, 0];
      const pelvis = smooth(
        [[-0.3, 0.06], [-0.27, 0.11], [-0.1, 0.135], [0.08, 0.13], [0.2, 0.1], [0.22, 0.05], [0.15, 0.0], [0.08, -0.03], [0.1, -0.2], [0.13, -0.36], [0.22, -0.4], [0.23, -0.43], [0.0, -0.44], [0.06, -0.38], [0.05, -0.22], [0.02, -0.05], [-0.02, -0.055], [-0.1, -0.2], [-0.17, -0.31], [-0.21, -0.3], [-0.15, -0.16], [-0.1, -0.03], [-0.2, -0.01], [-0.29, 0.02]],
        2
      );
      for (const side of [-1, 1]) {
        s.push(k.extrude(pelvis, 0.025, bone, { at: [hip[0], hip[1], side * 0.07], holes: [ellipse(0.03, 0.028, 0.01, 0.0, 14)], bevel: 0.005 }));
        s.push(k.extrude([[0, 0.02], [0.035, 0.0], [0.03, -0.16], [0.06, -0.24], [0.02, -0.27], [-0.025, -0.2], [-0.02, -0.02]], 0.012, bone, { at: [0.4, 0.86, side * 0.165], rot: [0, 0, 0.5], bevel: 0.003 }));
        s.push(k.tube([[0.47, 0.66, side * 0.17], [0.49, 0.6, side * 0.18], [0.5, 0.55, side * 0.18]], 0.012, bone, { seg: 10 }));
        s.push(k.tube([[0.5, 0.55, side * 0.18], [0.55, 0.53, side * 0.17], [0.59, 0.52, side * 0.16]], 0.009, bone, { seg: 10 }));
        s.push(k.tube([[0.59, 0.52, side * 0.16], [0.615, 0.5, side * 0.16], [0.625, 0.47, side * 0.165]], 0.0055, bone, { seg: 10 }));
      }
      // Legs: femur, knee, tibia, ankle, the long foot bones, three toes. One stepping forward.
      const legs: [V3, V3, V3, V3][] = [
        [[0.05, 0.5, 0.1], [-0.07, 0.22, 0.1], [0.01, 0.03, 0.1], [0.15, 0.012, 0.1]],
        [[-0.06, 0.48, -0.1], [-0.27, 0.24, -0.1], [-0.2, 0.03, -0.1], [-0.06, 0.012, -0.1]],
      ];
      for (const [knee, ankle, ball, toe] of legs) {
        const top: V3 = [hip[0], hip[1], knee[2]];
        s.push(k.sphere(0.034, bone, { at: top, seg: 14 }));
        s.push(k.tube([top, mid(top, knee), knee], 0.026, bone, { seg: 10 }));
        s.push(k.sphere(0.03, bone, { at: knee, seg: 14 }));
        s.push(k.tube([knee, ankle], 0.02, bone, { seg: 8 }));
        s.push(k.sphere(0.022, bone, { at: ankle, seg: 12 }));
        s.push(k.tube([ankle, ball], 0.016, bone, { seg: 8 }));
        for (const dz of [-0.035, 0, 0.035]) {
          const tip: V3 = [toe[0] - Math.abs(dz) * 0.8, toe[1], toe[2] + dz];
          s.push(k.tube([ball, [lerp(ball[0], tip[0], 0.5), 0.03, lerp(ball[2], tip[2], 0.5)], tip], 0.009, bone, { seg: 10 }));
        }
      }
      // The skull: a long head with its windows, teeth, and the jaw a little open.
      const top = smooth([[-0.025, -0.01], [-0.035, 0.05], [-0.01, 0.11], [0.06, 0.145], [0.13, 0.14], [0.2, 0.12], [0.28, 0.095], [0.35, 0.075], [0.405, 0.055], [0.43, 0.025], [0.425, -0.01]], 4, false);
      const teeth: Pt[] = [];
      for (let i = 0; i < 8; i += 1) {
        const x = 0.4 - i * 0.036;
        const yj = -0.012 - (0.41 - x) * 0.05;
        teeth.push([x, yj], [x - 0.006, yj - 0.026 + (i % 2) * 0.006], [x - 0.014, yj - 0.002]);
      }
      const skull = [...top, ...teeth, [0.08, -0.035], [0.04, -0.06], [0.0, -0.045]] as Pt[];
      const jawTop: Pt[] = [];
      for (let i = 0; i < 7; i += 1) {
        const x = 0.14 + i * 0.036;
        jawTop.push([x, -0.05], [x + 0.006, -0.028 - (i % 2) * 0.005], [x + 0.014, -0.05]);
      }
      const jaw = [[0.03, -0.055], [0.12, -0.05], ...jawTop, [0.4, -0.055], [0.395, -0.075], [0.3, -0.09], [0.18, -0.105], [0.08, -0.11], [0.02, -0.09], [-0.01, -0.06]].map(([x, y]) => [x - 0.04, y + 0.06] as Pt);
      s.push(
        k.group(
          [
            k.extrude(skull, 0.1, bone, { holes: [ellipse(0.022, 0.03, 0.095, 0.08, 14), ellipse(0.06, 0.028, 0.215, 0.045, 18), ellipse(0.02, 0.038, 0.03, 0.02, 12), ellipse(0.014, 0.008, 0.375, 0.04, 10)], bevel: 0.006 }),
            k.group([k.extrude(jaw, 0.085, bone, { holes: [ellipse(0.04, 0.012, 0.06, -0.025, 12)], bevel: 0.005 })], { at: [0.04, -0.06, 0], rot: [0, 0, -0.12] }),
          ],
          { at: [0.7, 1.06, 0], rot: [0, 0, -0.1], scale: [0.84, 0.84, 0.84] }
        )
      );
      // The steel armature that holds it up.
      for (const [x, y] of [[-0.05, 0.86], [0.3, 0.84], [-0.75, 0.79]] as Pt[]) s.push(rod(k, [x, 0, 0], [x, y - 0.03, 0], 0.01, steel, 0.01, 10));
      g.add(k.group(s, { at: [0.04, 0.112, 0] }));
      return g;
    },
  },
};
