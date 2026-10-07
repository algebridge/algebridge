/**
 * The unit prizes, one for each Algebra 1 unit finished and never sold:
 * award pieces in real materials (gold, brass, walnut, glass, neon, glazed
 * clay), each showing its unit's idea. A balance that stays level, a line on
 * a grid, two beams that meet at one point, shelves that rise in equal steps.
 * The bonsai and the vine grow with the daily goals and droop without practice.
 */

import * as THREE from "three";
import { canvasTexture, type Kit, type V3 } from "../kit";
import type { ItemModel } from "../types";

type P2 = [number, number];
type Mat = THREE.Material;

const TAU = Math.PI * 2;
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = "Inter, system-ui, sans-serif";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A fixed random source, so a piece looks the same on every load. */
function seeded(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** A round rod from a to b, r0 thick at a and r1 at b: a branch, a wire, a beam of light. */
function rod(k: Kit, a: V3, b: V3, r0: number, r1: number, m: Mat, seg = 12): THREE.Mesh {
  const from = new THREE.Vector3(a[0], a[1], a[2]);
  const to = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const turn = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  const mid = from.add(to).multiplyScalar(0.5);
  return k.cyl(r1, r0, len, m, { at: [mid.x, mid.y, mid.z], rot: [turn.x, turn.y, turn.z], seg });
}

const rect = (x0: number, y0: number, x1: number, y1: number): P2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A rectangle w by h about the origin, corners rounded to r, for extruding. */
function roundRect(w: number, h: number, r: number, n = 5): P2[] {
  const pts: P2[] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, Math.PI * 1.5],
  ];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  return pts;
}

function circle(cx: number, cy: number, r: number, n = 18): P2[] {
  return Array.from({ length: n }, (_, i): P2 => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
}

/** A slot along the radius at angle a, from r0 out to r1, w wide: an engraved tick on a dial. */
function radialSlot(a: number, r0: number, r1: number, w: number): P2[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = -s * (w / 2);
  const py = c * (w / 2);
  return [
    [c * r0 + px, s * r0 + py],
    [c * r0 - px, s * r0 - py],
    [c * r1 - px, s * r1 - py],
    [c * r1 + px, s * r1 + py],
  ];
}

/** Text that fits: shrinks the font until `text` is no wider than `max`. */
function fitFont(c: CanvasRenderingContext2D, text: string, style: string, px: number, family: string, max: number): number {
  c.font = `${style} ${px}px ${family}`;
  const w = c.measureText(text).width;
  if (w > max) {
    px *= max / w;
    c.font = `${style} ${px}px ${family}`;
  }
  return px;
}

/**
 * An engraved brass plate, screwed on: the prize's name and a second line.
 * Faces +z with its back on z = 0, centred on its own origin.
 */
function plaque(k: Kit, w: number, h: number, title: string, sub: string): THREE.Group {
  const pw = 640;
  const ph = Math.max(80, Math.round((pw * h) / w));
  const face = canvasTexture(pw, ph, (c, cw, ch) => {
    const g = c.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, "#9f7a35");
    g.addColorStop(0.38, "#d7b46a");
    g.addColorStop(0.6, "#c39b50");
    g.addColorStop(1, "#946f2f");
    c.fillStyle = g;
    c.fillRect(0, 0, cw, ch);
    // Brushed along its length.
    const rnd = seeded(31);
    for (let i = 0; i < 320; i += 1) {
      c.fillStyle = rnd() < 0.5 ? `rgba(255,238,196,${rnd() * 0.09})` : `rgba(80,52,12,${rnd() * 0.08})`;
      c.fillRect(0, rnd() * ch, cw, 1);
    }
    const inset = ch * 0.13;
    c.strokeStyle = "rgba(58,38,8,0.5)";
    c.lineWidth = Math.max(1.5, ch * 0.022);
    c.strokeRect(inset, inset, cw - inset * 2, ch - inset * 2);
    c.textAlign = "center";
    c.textBaseline = "middle";
    const engrave = (text: string, y: number, size: number, style: string) => {
      const px = fitFont(c, text, style, size, SERIF, cw - inset * 5);
      c.fillStyle = "rgba(255,241,206,0.55)";
      c.fillText(text, cw / 2, y + Math.max(1, px * 0.06));
      c.fillStyle = "#3a2708";
      c.fillText(text, cw / 2, y);
    };
    engrave(title, ch * (sub ? 0.41 : 0.53), ch * 0.3, "700");
    if (sub) engrave(sub, ch * 0.7, ch * 0.165, "400");
  });
  const brass = k.metal("brass", 0.3);
  return k.group([
    k.box(w, h, 0.003, brass, { at: [0, 0, 0.0015], r: 0.001 }),
    k.plane(w - 0.0035, h - 0.0035, k.print(face, { roughness: 0.36 }), { at: [0, 0, 0.0031] }),
    k.sphere(0.0026, brass, { at: [-w / 2 + 0.0062, 0, 0.0032], scale: [1, 1, 0.5], seg: 12 }),
    k.sphere(0.0026, brass, { at: [w / 2 - 0.0062, 0, 0.0032], scale: [1, 1, 0.5], seg: 12 }),
  ]);
}

const COVERS = ["#7a2e2e", "#2f4f6f", "#3d5c3a", "#8a6a2f", "#5a3d6b", "#2c2c2c", "#a24b2a", "#46607a", "#6d6a5f", "#9c7c4a", "#e2d9c6", "#1f3a5a", "#8c3b3b", "#c7b48c", "#3b4a3f", "#b8a27a"];
const TITLES = ["Algebra", "Geometry", "Poems", "Atlas", "Field Notes", "Physics", "Statistics", "Euclid", "Number", "Logic", "Data", "Maps", "Stars", "Essays", "Calculus", "History", "Patterns", "Chess", "Proofs", "Graphs"];

/**
 * A row of books standing on a shelf, as one piece: the row's outline (each
 * book its own height, a nick between them) given depth, the spines painted
 * on its face and the page edges on its top. Its left end stands at `at`,
 * its middle at the shelf's depth; it fills up to `width`.
 */
function bookRow(k: Kit, at: V3, width: number, maxH: number, depth: number, seed: number): THREE.Mesh {
  const rnd = seeded(seed);
  const books: { x: number; t: number; h: number; c: string; title: string }[] = [];
  let x = 0;
  for (;;) {
    const t = 0.017 + rnd() * 0.024;
    if (x + t > width) break;
    let h = maxH * (0.7 + rnd() * 0.3);
    const prev = books[books.length - 1];
    if (prev && Math.abs(prev.h - h) < 0.007) h = Math.max(maxH * 0.62, prev.h - 0.014);
    books.push({ x, t, h, c: COVERS[Math.floor(rnd() * COVERS.length)], title: TITLES[Math.floor(rnd() * TITLES.length)] });
    x += t;
  }
  const len = x;
  // The outline is in 0..1 across the row and up a little past the tallest
  // book; the top of the picture is kept for the page edges the top faces show.
  const vTop = 1 - depth - 0.012;
  const S = maxH / vTop;
  const nx = (v: number) => v / len;
  const ny = (v: number) => v / S;
  const pts: P2[] = [
    [0, 0],
    [0, ny(books[0].h - 0.003)],
  ];
  books.forEach((b, i) => {
    const next = books[i + 1];
    pts.push([nx(b.x + 0.0016), ny(b.h)], [nx(b.x + b.t - 0.0016), ny(b.h)]);
    pts.push([nx(b.x + b.t), ny((next ? Math.min(b.h, next.h) : b.h) - 0.004)]);
  });
  pts.push([1, 0]);
  const tex = canvasTexture(512, 512, (c, w, h) => {
    // Top band: the page blocks seen from above, back edge at the top of the picture.
    c.fillStyle = "#e8dcc2";
    c.fillRect(0, 0, w, h);
    const front = (depth - 0.003) * h;
    for (const b of books) {
      const x0 = nx(b.x) * w;
      const x1 = nx(b.x + b.t) * w;
      c.fillStyle = "rgba(120,96,60,0.16)";
      for (let px = x0 + 2; px < x1 - 1; px += 2) c.fillRect(px, 0, 1, front);
      c.fillStyle = b.c;
      c.fillRect(x0, front - 4, x1 - x0, 6);
      c.fillRect(x0, 0, x1 - x0, 3);
      c.fillRect(x0, 0, 2, front);
      c.fillRect(x1 - 2, 0, 2, front);
      // The spine.
      const top = (1 - ny(b.h)) * h;
      c.fillStyle = b.c;
      c.fillRect(x0, top, x1 - x0, h - top);
      const shade = c.createLinearGradient(x0, 0, x1, 0);
      shade.addColorStop(0, "rgba(0,0,0,0.42)");
      shade.addColorStop(0.2, "rgba(255,255,255,0.06)");
      shade.addColorStop(0.5, "rgba(255,255,255,0.12)");
      shade.addColorStop(0.82, "rgba(0,0,0,0.08)");
      shade.addColorStop(1, "rgba(0,0,0,0.45)");
      c.fillStyle = shade;
      c.fillRect(x0, top, x1 - x0, h - top);
      const light = new THREE.Color(b.c).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
      const ink = light ? "rgba(40,30,20,0.8)" : "rgba(222,196,130,0.9)";
      c.fillStyle = ink;
      const sh = h - top;
      for (const f of [0.07, 0.1, 0.9]) c.fillRect(x0 + 1, top + sh * f, x1 - x0 - 2, Math.max(1.5, sh * 0.012));
      // The title, up the spine.
      c.save();
      c.translate((x0 + x1) / 2, top + sh * 0.52);
      c.rotate(-Math.PI / 2);
      c.textAlign = "center";
      c.textBaseline = "middle";
      fitFont(c, b.title, "600", Math.min((x1 - x0) * 0.5, 22), SERIF, sh * 0.62);
      c.fillText(b.title, 0, 0);
      c.restore();
    }
  });
  return k.extrude(pts, depth, k.print(tex, { roughness: 0.78 }), { at: [at[0], at[1] + 0.001, at[2]], scale: [len, S, 1], bevel: 0.003 });
}

// --- Neon -------------------------------------------------------------------

interface Stroke {
  pts: P2[];
  color: string;
  /** Which ends pass back through the acrylic, in a black boot. */
  boots?: "both" | "start" | "end" | "none";
}

/** Points a few millimetres apart along a polyline, so a tube through them keeps its runs straight and its bends tight. */
function dense(pts: P2[], step = 0.005): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < n; j += 1) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const NEON = { gap: 0.032, sheet: 0.008, lift: 0.016, r: 0.0046 };
const NEON_DEPTH = 0.068;

/**
 * A neon sign on clear acrylic, held off the wall on four chrome standoffs.
 * Strokes are drawn on the sheet: x from its middle, y up from its bottom
 * edge. Each is a glass tube that glows when the sign is on, held on clear
 * clips, its ends sleeved in black boots where they pass back through.
 */
function neonSign(k: Kit, on: boolean, w: number, h: number, strokes: Stroke[], dots: { at: P2; color: string; r: number }[]): THREE.Group {
  const front = NEON.gap + NEON.sheet;
  const zt = front + NEON.lift;
  const chrome = k.metal("chrome");
  const boot = k.rubber("#1d1d20");
  const clip = k.glass("#f2f7f9", 0.35);
  const g = k.group([k.extrude(roundRect(w - 0.003, h - 0.003, 0.028), NEON.sheet, k.glass("#dce8ee", 0.22), { at: [0, h / 2, NEON.gap + NEON.sheet / 2], bevel: 0.0015 })]);
  for (const sx of [-1, 1])
    for (const y of [0.036, h - 0.036]) {
      const x = sx * (w / 2 - 0.036);
      g.add(k.cyl(0.0072, 0.0072, front, chrome, { at: [x, y, front / 2], rot: [Math.PI / 2, 0, 0], seg: 18 }));
      g.add(k.cyl(0.0105, 0.0105, 0.009, chrome, { at: [x, y, front + 0.0045], rot: [Math.PI / 2, 0, 0], seg: 24 }));
    }
  for (const s of strokes) {
    const pts = dense(s.pts);
    let len = 0;
    for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const path = pts.map(([x, y]): V3 => [x, y, zt]);
    const seg = Math.max(16, Math.ceil(len / 0.003));
    g.add(k.tube(path, NEON.r, k.glow(s.color, on, 1.7), { seg }));
    // Lit, the gas fills the glass round it with colour.
    if (on) g.add(k.tube(path, NEON.r * 2.3, k.glass(s.color, 0.2), { seg }));
    const ends = s.boots ?? "both";
    const bootAt = (p: P2) => g.add(k.cyl(0.0062, 0.0062, NEON.lift + 0.003, boot, { at: [p[0], p[1], front + (NEON.lift + 0.003) / 2], rot: [Math.PI / 2, 0, 0], seg: 14 }));
    if (ends === "both" || ends === "start") bootAt(pts[0]);
    if (ends === "both" || ends === "end") bootAt(pts[pts.length - 1]);
    if (len > 0.12)
      for (const f of [0.3, 0.7]) {
        const p = pts[Math.round(f * (pts.length - 1))];
        g.add(k.cyl(0.0034, 0.0034, NEON.lift, clip, { at: [p[0], p[1], front + NEON.lift / 2], rot: [Math.PI / 2, 0, 0], seg: 10 }));
      }
  }
  for (const d of dots) {
    g.add(k.sphere(d.r, k.glow(d.color, on, 1.9), { at: [d.at[0], d.at[1], zt], seg: 20 }));
    if (on) g.add(k.sphere(d.r * 1.9, k.glass(d.color, 0.2), { at: [d.at[0], d.at[1], zt], seg: 20 }));
  }
  return g;
}

/** An axis with an arrowhead at its far end: the shaft, and the arrowhead as its own bent tube. */
function axis(from: P2, to: P2, color: string): Stroke[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const back: P2 = [to[0] - ux * 0.03, to[1] - uy * 0.03];
  return [
    { pts: [from, to], color, boots: "start" },
    {
      pts: [
        [back[0] - uy * 0.022, back[1] + ux * 0.022],
        [to[0] + ux * 0.004, to[1] + uy * 0.004],
        [back[0] + uy * 0.022, back[1] - ux * 0.022],
      ],
      color,
    },
  ];
}

const AXIS_BLUE = "#3aa8ff";
const AXIS_AMBER = "#ffa53a";

// --- The ruler ----------------------------------------------------------------

/** An 18-inch rule: 45 cm along one edge, 17 1/2 inches along the other, both from the same zero. */
const RULER = { len: 0.47, w: 0.052, t: 0.0045 };

/** The golden ruler's engraving: centimetres along its top edge, half inches along its bottom. */
function rulerTicks(): P2[][] {
  const holes: P2[][] = [];
  const top = RULER.w / 2 - 0.0013;
  const bot = -RULER.w / 2 + 0.0013;
  const x0 = -0.225;
  const gw = 0.0004;
  for (let i = 0; i <= 45; i += 1) {
    const x = x0 + i * 0.01;
    const l = i % 10 === 0 ? 0.016 : i % 5 === 0 ? 0.0115 : 0.0075;
    holes.push(rect(x - gw, top - l, x + gw, top));
  }
  for (let i = 0; i <= 35; i += 1) {
    const x = x0 + i * 0.0127;
    const l = i % 2 === 0 ? 0.0135 : 0.008;
    holes.push(rect(x - gw, bot, x + gw, bot + l));
  }
  return holes;
}

// --- The balance ----------------------------------------------------------------

const BALANCE_COLUMN: P2[] = [
  [0, 0],
  [0.055, 0],
  [0.055, 0.01],
  [0.046, 0.016],
  [0.04, 0.03],
  [0.026, 0.05],
  [0.03, 0.058],
  [0.03, 0.068],
  [0.018, 0.076],
  [0.015, 0.09],
  [0.015, 0.66],
  [0.021, 0.668],
  [0.021, 0.68],
  [0.014, 0.688],
  [0.012, 0.74],
  [0, 0.74],
];
const BALANCE_PAN: P2[] = [
  [0, 0],
  [0.04, 0.0008],
  [0.072, 0.0055],
  [0.092, 0.0135],
  [0.1, 0.0235],
  [0.1, 0.025],
  [0.097, 0.025],
  [0.089, 0.0155],
  [0.07, 0.0075],
  [0.04, 0.0032],
  [0, 0.0025],
];
/** A cylinder weight with a knob, 1 kg at full size. */
const WEIGHT: P2[] = [
  [0, 0],
  [0.028, 0],
  [0.029, 0.003],
  [0.029, 0.044],
  [0.026, 0.048],
  [0.012, 0.05],
  [0.009, 0.056],
  [0.013, 0.062],
  [0.0135, 0.068],
  [0.01, 0.073],
  [0, 0.074],
];

// --- The lasers -------------------------------------------------------------------

/** Where two lines through (a, b) and (c, d) meet. */
function meet(a: P2, b: P2, c: P2, d: P2): P2 {
  const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
  const t = cross(c[0] - a[0], c[1] - a[1], d[0] - c[0], d[1] - c[1]) / cross(b[0] - a[0], b[1] - a[1], d[0] - c[0], d[1] - c[1]);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** The posts stand at ±POST_X; a clamp on each holds an emitter or a target, its inner face at ±CLAMP_FACE. */
const POST_X = 0.52;
const CLAMP = 0.026;
const CLAMP_FACE = POST_X - CLAMP;

/** Each beam runs from an emitter on one post to a target on the other, at its own slope. */
const BEAMS = [
  { from: [-CLAMP_FACE, 0.24] as P2, to: [CLAMP_FACE, 0.95] as P2, color: "#ff2b22" },
  { from: [CLAMP_FACE, 0.62] as P2, to: [-CLAMP_FACE, 0.42] as P2, color: "#2dff5a" },
];
const SOLUTION = meet(BEAMS[0].from, BEAMS[0].to, BEAMS[1].from, BEAMS[1].to);

// --- The machine --------------------------------------------------------------------

/** A spur gear's outline: `teeth` teeth on a pitch circle of radius rp. */
function gearOutline(teeth: number, rp: number, mod: number): P2[] {
  const rOut = rp + mod * 0.9;
  const rRoot = rp - mod * 1.15;
  const p = TAU / teeth;
  const pts: P2[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * p;
    const profile: [number, number][] = [
      [-0.3, rRoot],
      [-0.14, rOut],
      [0.14, rOut],
      [0.3, rRoot],
    ];
    for (const [da, r] of profile) pts.push([Math.cos(a + da * p) * r, Math.sin(a + da * p) * r]);
  }
  return pts;
}

/** A wooden block with a letter on every face, the kind a function machine eats and gives back. */
function letterBlock(k: Kit, size: number, label: string, tone: string): THREE.Mesh {
  const tex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = tone;
    c.fillRect(0, 0, w, h);
    const rnd = seeded(label.length * 97 + 5);
    for (let i = 0; i < 26; i += 1) {
      c.strokeStyle = `rgba(110,72,36,${0.08 + rnd() * 0.12})`;
      c.lineWidth = 1 + rnd() * 1.5;
      const y = rnd() * h;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 18, w * 0.7, y + (rnd() - 0.5) * 18, w, y + (rnd() - 0.5) * 10);
      c.stroke();
    }
    c.strokeStyle = "rgba(60,36,14,0.35)";
    c.lineWidth = 8;
    c.strokeRect(16, 16, w - 32, h - 32);
    c.fillStyle = "#3b2414";
    c.textAlign = "center";
    c.textBaseline = "middle";
    fitFont(c, label, "italic 700", 150, SERIF, w - 70);
    c.fillText(label, w / 2, h / 2 + 6);
  });
  return k.box(size, size, size, k.print(tex, { roughness: 0.62 }), { r: size * 0.08 });
}

// --- The bonsai and the vine ------------------------------------------------------------

/** A heart-shaped leaf one unit long: its stalk end at the origin, its tip hanging to y = -1. */
const LEAF: P2[] = Array.from({ length: 30 }, (_, i): P2 => {
  const t = (i / 30) * TAU;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [(x / 22) * 0.78, (y - 5) / 22];
});

/** The arch's laminations: the band between two parabolas, legs on y = 0. */
function parabolaBand(a0: number, h0: number, a1: number, h1: number, n = 44): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= n; i += 1) {
    const x = a0 * Math.sin(-Math.PI / 2 + (Math.PI * i) / n);
    pts.push([x, h0 * (1 - (x / a0) ** 2)]);
  }
  for (let i = n; i >= 0; i -= 1) {
    const x = a1 * Math.sin(-Math.PI / 2 + (Math.PI * i) / n);
    pts.push([x, h1 * (1 - (x / a1) ** 2)]);
  }
  return pts;
}

// --- Turned profiles, from the bottom up ------------------------------------------------

const VASE: P2[] = [
  [0, 0],
  [0.03, 0],
  [0.038, 0.02],
  [0.042, 0.06],
  [0.034, 0.11],
  [0.02, 0.135],
  [0.018, 0.15],
  [0.022, 0.155],
  [0.016, 0.156],
  [0.014, 0.14],
  [0, 0.14],
];
const BOWL: P2[] = [
  [0, 0],
  [0.03, 0],
  [0.05, 0.012],
  [0.062, 0.04],
  [0.06, 0.042],
  [0.048, 0.016],
  [0, 0.008],
];
const POT: P2[] = [
  [0, 0],
  [0.042, 0],
  [0.046, 0.01],
  [0.052, 0.085],
  [0.056, 0.09],
  [0.05, 0.091],
  [0.046, 0.08],
  [0, 0.08],
];
const HOURGLASS: P2[] = [
  [0, 0],
  [0.036, 0.002],
  [0.04, 0.03],
  [0.03, 0.06],
  [0.006, 0.086],
  [0.006, 0.092],
  [0.03, 0.118],
  [0.04, 0.148],
  [0.036, 0.176],
  [0, 0.178],
];
/** The sand, heaped in the lower bulb. */
const SAND: P2[] = [
  [0, 0.004],
  [0.034, 0.005],
  [0.034, 0.018],
  [0.02, 0.036],
  [0, 0.046],
];
const BONSAI_POT: P2[] = [
  [0, 0],
  [0.118, 0],
  [0.124, 0.004],
  [0.128, 0.05],
  [0.134, 0.058],
  [0.134, 0.065],
  [0.126, 0.066],
  [0.12, 0.06],
  [0.116, 0.05],
  [0, 0.05],
];
/** A tangent ogive, 0.2 long on a 0.032 body. */
const NOSE: P2[] = Array.from({ length: 14 }, (_, i): P2 => {
  const L = 0.2;
  const R = 0.032;
  const rho = (R * R + L * L) / (2 * R);
  const y = (L * i) / 13;
  return [Math.max(0, Math.sqrt(rho * rho - y * y) + R - rho), y];
});

// --- Printed pictures ---------------------------------------------------------------------

/** The framed print: a line on a coordinate grid, with its slope triangle, signed in pencil. */
function graphPrint(): THREE.CanvasTexture {
  return canvasTexture(768, 1016, (c, w, h) => {
    c.fillStyle = "#efe6d0";
    c.fillRect(0, 0, w, h);
    const rnd = seeded(77);
    for (let i = 0; i < 9000; i += 1) {
      const v = rnd() < 0.5 ? 120 : 255;
      c.fillStyle = `rgba(${v},${v - 6},${v - 18},${0.03 + rnd() * 0.05})`;
      c.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
    }
    const u = 54;
    const L = 60;
    const R = L + 12 * u;
    const T = 58;
    const B = T + 15 * u;
    const ox = L + 3 * u;
    const oy = B - 4 * u;
    const X = (x: number) => ox + x * u;
    const Y = (y: number) => oy - y * u;
    // The plate: a grid in blue-grey ink, fifths fine, whole units strong.
    c.fillStyle = "#f6f1e4";
    c.fillRect(L, T, R - L, B - T);
    const lines = (step: number, style: string, width: number) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      for (let gx = L; gx <= R + 0.5; gx += step) {
        c.moveTo(gx, T);
        c.lineTo(gx, B);
      }
      for (let gy = T; gy <= B + 0.5; gy += step) {
        c.moveTo(L, gy);
        c.lineTo(R, gy);
      }
      c.stroke();
    };
    lines(u / 5, "rgba(84,128,160,0.32)", 1.3);
    lines(u, "rgba(52,96,132,0.78)", 2.4);
    c.strokeStyle = "#2c3640";
    c.lineWidth = 3;
    c.strokeRect(L, T, R - L, B - T);
    // Axes with arrowheads, numbered.
    c.strokeStyle = "#1f242b";
    c.fillStyle = "#1f242b";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(L, oy);
    c.lineTo(R - 6, oy);
    c.moveTo(ox, B);
    c.lineTo(ox, T + 6);
    c.stroke();
    const arrow = (x: number, y: number, dx: number, dy: number) => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - dx * 24 - dy * 11, y - dy * 24 + dx * 11);
      c.lineTo(x - dx * 24 + dy * 11, y - dy * 24 - dx * 11);
      c.closePath();
      c.fill();
    };
    arrow(R, oy, 1, 0);
    arrow(ox, T, 0, -1);
    c.font = `600 21px ${SERIF}`;
    c.fillStyle = "#2c3640";
    c.textAlign = "center";
    c.textBaseline = "top";
    for (let x = -2; x <= 8; x += 1) if (x) c.fillText(String(x), X(x), oy + 9);
    c.textAlign = "right";
    c.textBaseline = "middle";
    for (let y = -3; y <= 10; y += 1) if (y) c.fillText(String(y), ox - 10, Y(y));
    c.font = `italic 600 38px ${SERIF}`;
    c.fillStyle = "#1f242b";
    c.textAlign = "left";
    c.fillText("x", R - 30, oy - 28);
    c.fillText("y", ox + 16, T + 24);
    // The line, y = 2/3 x + 1.
    c.strokeStyle = "#c0281c";
    c.lineWidth = 10;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(X(-3) + 4, Y(-1));
    c.lineTo(X(9) - 4, Y(7));
    c.stroke();
    // Its slope triangle: run 3, rise 2.
    c.strokeStyle = "#1f5a99";
    c.lineWidth = 5;
    c.setLineDash([14, 9]);
    c.beginPath();
    c.moveTo(X(0), Y(1));
    c.lineTo(X(3), Y(1));
    c.lineTo(X(3), Y(3));
    c.stroke();
    c.setLineDash([]);
    c.font = `italic 600 30px ${SERIF}`;
    c.fillStyle = "#1f5a99";
    c.textAlign = "center";
    c.textBaseline = "top";
    c.fillText("run 3", X(1.5), Y(1) + 12);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText("rise 2", X(3) + 14, Y(2));
    for (const [px, py] of [
      [0, 1],
      [3, 3],
    ]) {
      c.fillStyle = "#f6f1e4";
      c.beginPath();
      c.arc(X(px), Y(py), 14, 0, TAU);
      c.fill();
      c.fillStyle = "#c0281c";
      c.beginPath();
      c.arc(X(px), Y(py), 10, 0, TAU);
      c.fill();
    }
    c.font = `600 24px ${SERIF}`;
    c.fillStyle = "#1f242b";
    c.textAlign = "right";
    c.fillText("(0, 1)", X(0) - 16, Y(1) - 20);
    c.fillText("(3, 3)", X(3) - 16, Y(3) - 20);
    // The equation, its fraction stacked.
    const ex = X(4.2);
    const ey = Y(8.7);
    c.font = `italic 600 44px ${SERIF}`;
    c.textAlign = "left";
    c.fillText("y =", ex, ey);
    c.font = `600 32px ${SERIF}`;
    c.textAlign = "center";
    c.fillText("2", ex + 96, ey - 19);
    c.fillText("3", ex + 96, ey + 22);
    c.fillRect(ex + 82, ey, 28, 3);
    c.font = `italic 600 44px ${SERIF}`;
    c.textAlign = "left";
    c.fillText("x + 1", ex + 118, ey);
    // Numbered, titled and signed in pencil under the plate.
    c.fillStyle = "rgba(80,80,86,0.85)";
    c.font = `400 24px ${SERIF}`;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillText("3/15", L + 4, B + 56);
    c.font = `italic 400 27px ${SERIF}`;
    c.textAlign = "center";
    c.fillText("Rise over Run", (L + R) / 2, B + 56);
    c.font = `italic 400 30px "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive`;
    c.textAlign = "right";
    c.fillText("AlgeBridge", R - 4, B + 58);
  });
}

/** The optical breadboard the lasers stand on: black anodised, tapped holes every 25 mm. */
function breadboard(): THREE.CanvasTexture {
  return canvasTexture(1152, 252, (c, w, h) => {
    c.fillStyle = "#1f2124";
    c.fillRect(0, 0, w, h);
    const rnd = seeded(19);
    for (let i = 0; i < 400; i += 1) {
      c.fillStyle = `rgba(255,255,255,${rnd() * 0.035})`;
      c.fillRect(0, rnd() * h, w, 1);
    }
    for (let x = 26; x < w - 10; x += 25)
      for (let y = 13.5; y < h - 6; y += 25) {
        c.fillStyle = "rgba(255,255,255,0.13)";
        c.beginPath();
        c.arc(x, y + 0.8, 4.6, 0, TAU);
        c.fill();
        c.fillStyle = "#08090a";
        c.beginPath();
        c.arc(x, y, 4, 0, TAU);
        c.fill();
      }
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}

/** A scale engraved down a post: white ticks and centimetres on black. */
function postScale(): THREE.CanvasTexture {
  return canvasTexture(48, 2048, (c, w, h) => {
    c.fillStyle = "#16181b";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#e9e6dc";
    const per = h / 94;
    for (let i = 0; i <= 94; i += 1) {
      const y = h - i * per;
      const l = i % 10 === 0 ? 30 : i % 5 === 0 ? 22 : 13;
      c.fillRect(0, y - 1.5, l, 3);
      if (i % 10 === 0 && i > 0 && i < 94) {
        c.save();
        c.translate(w - 8, y);
        c.rotate(-Math.PI / 2);
        c.font = `600 15px ${SANS}`;
        c.textAlign = "center";
        c.fillText(String(i), 0, 0);
        c.restore();
      }
    }
  });
}

/** The machine's dial: what comes out, the needle on 7. */
function dialFace(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (c, w) => {
    const r = w / 2;
    const g = c.createRadialGradient(r, r * 0.8, r * 0.1, r, r, r);
    g.addColorStop(0, "#fbf6e8");
    g.addColorStop(1, "#e6dcc4");
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    c.strokeStyle = "#2b2620";
    c.fillStyle = "#2b2620";
    for (let i = 0; i <= 50; i += 1) {
      const a = a0 + (i / 50) * sweep;
      const long = i % 5 === 0;
      c.lineWidth = long ? 6 : 2.5;
      c.beginPath();
      c.moveTo(r + Math.cos(a) * (r - 34), r + Math.sin(a) * (r - 34));
      c.lineTo(r + Math.cos(a) * (r - (long ? 72 : 54)), r + Math.sin(a) * (r - (long ? 72 : 54)));
      c.stroke();
    }
    c.font = `600 42px ${SERIF}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let i = 0; i <= 10; i += 1) {
      const a = a0 + (i / 10) * sweep;
      c.fillText(String(i), r + Math.cos(a) * (r - 112), r + Math.sin(a) * (r - 112));
    }
    c.font = `italic 600 52px ${SERIF}`;
    c.fillText("f(x)", r, r + 120);
    // The needle on 7, with its counterweight.
    const na = a0 + 0.7 * sweep;
    c.strokeStyle = "#9c1f17";
    c.lineCap = "round";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(r - Math.cos(na) * 44, r - Math.sin(na) * 44);
    c.lineTo(r + Math.cos(na) * (r - 52), r + Math.sin(na) * (r - 52));
    c.stroke();
    c.fillStyle = "#3a332a";
    c.beginPath();
    c.arc(r, r, 22, 0, TAU);
    c.fill();
  });
}

/** The half-plane rug: hand-tufted wool, a carved grid on the plain side, the shaded side in ridges, a bound edge. */
function halfPlaneRug(shade: string, vl: number, vr: number): THREE.CanvasTexture {
  return canvasTexture(1320, 900, (c, w, h) => {
    const rnd = seeded(61);
    const wool = (n: number, light: number, dark: number, a: number) => {
      for (let i = 0; i < n; i += 1) {
        const v = rnd() < 0.5 ? dark : light;
        c.fillStyle = `rgba(${v},${v - 10},${v - 28},${a * (0.5 + rnd())})`;
        const s = 1.2 + rnd() * 2.4;
        c.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd() * 0.8));
      }
    };
    c.fillStyle = "#dacdb1";
    c.fillRect(0, 0, w, h);
    wool(60000, 250, 120, 0.07);
    // A grid carved into the plain side, every 15 cm.
    for (const [off, style, lw] of [
      [0, "rgba(96,74,46,0.3)", 5],
      [3, "rgba(255,250,236,0.22)", 2],
    ] as [number, string, number][]) {
      c.strokeStyle = style;
      c.lineWidth = lw;
      c.beginPath();
      for (let x = 90; x < w; x += 90) {
        c.moveTo(x + off, 0);
        c.lineTo(x + off, h);
      }
      for (let y = 90; y < h; y += 90) {
        c.moveTo(0, y + off);
        c.lineTo(w, y + off);
      }
      c.stroke();
    }
    // The shaded half, behind the boundary: the deep colour, tufted in diagonal ridges.
    c.save();
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, vr * h);
    c.lineTo(0, vl * h);
    c.closePath();
    c.clip();
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
    const lighter = new THREE.Color(shade).lerp(new THREE.Color("#ffffff"), 0.14).getStyle();
    const darker = new THREE.Color(shade).multiplyScalar(0.62).getStyle();
    for (let x = -h; x < w; x += 30) {
      c.strokeStyle = lighter;
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(x, h);
      c.lineTo(x + h, 0);
      c.stroke();
      c.strokeStyle = darker;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x + 13, h);
      c.lineTo(x + h + 13, 0);
      c.stroke();
    }
    wool(40000, 255, 0, 0.05);
    c.restore();
    // The boundary itself, a charcoal cord.
    c.strokeStyle = "#232527";
    c.lineWidth = 18;
    c.beginPath();
    c.moveTo(0, vl * h);
    c.lineTo(w, vr * h);
    c.stroke();
    // The bound edge, and the weave.
    c.strokeStyle = "#4a4238";
    c.lineWidth = 30;
    c.strokeRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,240,215,0.18)";
    c.lineWidth = 2;
    c.strokeRect(16, 16, w - 32, h - 32);
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = `rgba(0,0,0,${0.02 + ((y * 7919) % 13) / 420})`;
      c.fillRect(0, y, w, 1);
    }
  });
}

// ---------------------------------------------------------------------------
// The prizes
// ---------------------------------------------------------------------------

export const PRIZE_ITEMS: Record<string, ItemModel> = {
  "prize-ruler": {
    size: [0.5, 0.9, 0.34],
    build(k, o) {
      const walnut = k.wood(o.color ?? "#6b4630", { gloss: 0.55 });
      const gold = k.metal("gold", 0.14);
      const brass = k.metal("brass", 0.3);
      const capTop = 0.72;
      const g = k.group([
        // A walnut pedestal: plinth, a column with its grain upright, a cap with a brass band under it.
        k.box(0.5, 0.06, 0.34, walnut, { at: [0, 0.03, 0], r: 0.006 }),
        k.box(0.62, 0.42, 0.28, walnut, { at: [0, 0.37, 0], rot: [0, 0, Math.PI / 2], r: 0.004 }),
        k.box(0.5, 0.04, 0.34, walnut, { at: [0, capTop - 0.02, 0], r: 0.006 }),
        k.box(0.427, 0.01, 0.287, brass, { at: [0, capTop - 0.047, 0], r: 0.002 }),
      ]);
      const p = plaque(k, 0.19, 0.046, "GOLDEN RULER", "Unit 1 · Working with Units");
      p.position.set(0, 0.585, 0.14);
      g.add(p);
      // The display: a walnut wedge on the cap, its slope laid with navy velvet, two brass pins holding the ruler.
      const slope = 0.56;
      const zf = 0.1;
      const zb = -0.055;
      const lo = 0.034;
      const rise = (zf - zb) * Math.tan(slope);
      g.add(
        k.extrude(
          [
            [zf, 0],
            [zf, lo],
            [zb, lo + rise],
            [zb, 0],
          ],
          0.46,
          walnut,
          { at: [0, capTop + 0.003, 0], rot: [0, -Math.PI / 2, 0], bevel: 0.003 }
        )
      );
      const along = (f: number, lift: number): V3 => [0, capTop + 0.003 + lo + f * rise + Math.cos(slope) * lift, zf + f * (zb - zf) + Math.sin(slope) * lift];
      const slopeLen = (zf - zb) / Math.cos(slope);
      g.add(k.box(0.43, 0.006, slopeLen - 0.026, k.velvet("#1d2740"), { at: along(0.5, 0.003), rot: [slope, 0, 0], r: 0.002 }));
      const pin = 0.5 - (RULER.w / 2 + 0.003) / slopeLen;
      for (const x of [-0.15, 0.15]) {
        const at = along(pin, 0.011);
        g.add(k.cyl(0.0028, 0.0028, 0.012, brass, { at: [x, at[1], at[2]], rot: [slope, 0, 0], seg: 12 }));
      }
      // The ruler on the velvet: a gold body, the engraving cut through a gold face onto black fill.
      const ruler = k.group([
        k.box(RULER.len, RULER.w, RULER.t - 0.001, gold, { at: [0, 0, -0.0005], r: 0.0012 }),
        k.plane(RULER.len - 0.004, RULER.w - 0.002, k.paint("#17130e", 0.2), { at: [0, 0, RULER.t / 2 - 0.0009] }),
        k.extrude(rect(-RULER.len / 2, -RULER.w / 2, RULER.len / 2, RULER.w / 2), 0.0008, gold, { at: [0, 0, RULER.t / 2 - 0.0004], bevel: 0, holes: rulerTicks() }),
      ]);
      const rest = along(0.5, 0.006 + RULER.t / 2);
      ruler.position.set(rest[0], rest[1], rest[2]);
      ruler.rotation.set(slope - Math.PI / 2, 0, 0);
      g.add(ruler);
      return g;
    },
  },

  "prize-scale": {
    size: [0.776, 0.94, 0.3],
    build(k, o) {
      const brass = k.metal("brass", 0.24);
      const wood = k.wood(o.color ?? "#6b4630", { gloss: 0.6 });
      const g = k.group([
        // A walnut plinth on brass bun feet, stepped.
        k.box(0.44, 0.06, 0.3, wood, { at: [0, 0.052, 0], r: 0.008 }),
        k.box(0.3, 0.032, 0.2, wood, { at: [0, 0.098, 0], r: 0.006 }),
        // The turned column, the pivot housing and its finial.
        k.lathe(BALANCE_COLUMN, brass, { at: [0, 0.114, 0], seg: 36 }),
        k.box(0.044, 0.05, 0.036, brass, { at: [0, 0.875, 0], r: 0.006 }),
        k.lathe(
          [
            [0, 0],
            [0.012, 0.004],
            [0.016, 0.014],
            [0.012, 0.024],
            [0.005, 0.032],
            [0, 0.04],
          ],
          brass,
          { at: [0, 0.9, 0], seg: 24 }
        ),
      ]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.sphere(0.02, brass, { at: [sx * 0.19, 0.016, sz * 0.12], scale: [1, 0.8, 1], seg: 16 }));
      const p = plaque(k, 0.17, 0.032, "BRASS BALANCE", "Unit 2 · Solving Equations");
      p.position.set(0, 0.052, 0.15);
      g.add(p);
      // The beam, level: thickest at the pivot, tapering to knobs at the ends.
      const yp = 0.882;
      const L = 0.3;
      const beam: P2[] = [];
      for (let i = 0; i <= 12; i += 1) {
        const x = -L + (2 * L * i) / 12;
        beam.push([x, 0.006 + 0.009 * (1 - Math.abs(x) / L) ** 2]);
      }
      for (let i = 12; i >= 0; i -= 1) {
        const x = -L + (2 * L * i) / 12;
        beam.push([x, -0.006 - 0.009 * (1 - Math.abs(x) / L) ** 2]);
      }
      g.add(k.extrude(beam, 0.01, brass, { at: [0, yp, 0], bevel: 0.0018 }));
      g.add(k.cyl(0.022, 0.022, 0.02, brass, { at: [0, yp, 0], rot: [Math.PI / 2, 0, 0], seg: 28 }));
      g.add(k.cyl(0.006, 0.006, 0.026, k.metal("steel"), { at: [0, yp, 0], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      // The needle, straight down on the middle tick of its arc.
      g.add(
        k.extrude(
          [
            [-0.0024, 0.006],
            [0.0024, 0.006],
            [0.0005, -0.152],
            [-0.0005, -0.152],
          ],
          0.0016,
          k.metal("#2c3442", 0.3),
          { at: [0, yp, 0.0222], bevel: 0.0004 }
        )
      );
      const arc: P2[] = [];
      for (let i = 0; i <= 10; i += 1) {
        const a = -Math.PI / 2 - 0.2 + (0.4 * i) / 10;
        arc.push([Math.cos(a) * 0.162, Math.sin(a) * 0.162]);
      }
      for (let i = 10; i >= 0; i -= 1) {
        const a = -Math.PI / 2 - 0.2 + (0.4 * i) / 10;
        arc.push([Math.cos(a) * 0.137, Math.sin(a) * 0.137]);
      }
      const ticks = Array.from({ length: 9 }, (_, i) => radialSlot(-Math.PI / 2 - 0.16 + i * 0.04, 0.142, i === 4 ? 0.158 : 0.152, 0.0012));
      g.add(k.extrude(arc, 0.0018, brass, { at: [0, yp, 0.0192], bevel: 0.0004, holes: ticks }));
      g.add(k.box(0.012, 0.012, 0.01, brass, { at: [0, yp - 0.149, 0.0135], r: 0.002 }));
      for (const sx of [-1, 1]) {
        const cx = sx * (L - 0.012);
        g.add(k.sphere(0.0085, brass, { at: [sx * (L + 0.002), yp, 0], seg: 16 }));
        g.add(k.torus(0.0105, 0.0024, brass, { at: [cx, yp - 0.0175, 0], seg: 20 }));
        // Three hangers down to the pan's rim.
        const top: V3 = [cx, yp - 0.028, 0];
        for (const a of [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + (2 * TAU) / 3]) g.add(rod(k, top, [cx + Math.cos(a) * 0.095, 0.6, Math.sin(a) * 0.095], 0.0011, 0.0011, brass, 6));
        g.add(k.lathe(BALANCE_PAN, brass, { at: [cx, 0.576, 0], seg: 40 }));
      }
      // Balanced: one weight on the left, two of half its mass on the right.
      const left = -(L - 0.012);
      g.add(k.lathe(WEIGHT, brass, { at: [left, 0.5785, 0], seg: 28 }));
      const half: P2[] = WEIGHT.map(([r, y]) => [r * 0.79, y * 0.79]);
      g.add(k.lathe(half, brass, { at: [-left - 0.03, 0.5785, 0.014], seg: 28 }));
      g.add(k.lathe(half, brass, { at: [-left + 0.03, 0.5785, -0.012], seg: 28 }));
      return g;
    },
  },

  "prize-graph": {
    size: [0.56, 0.7, 0.032],
    wall: true,
    build(k, o) {
      const W = 0.56;
      const H = 0.7;
      const fw = 0.032;
      const D = 0.032;
      const b = 0.003;
      const ow = W - fw * 2;
      const oh = H - fw * 2;
      const win = { w: 0.376, h: 0.501, dy: 0.0075 };
      const g = k.group([
        // The moulding, one piece with softened edges, a gold lip inside it.
        k.extrude(rect(-W / 2 + b, -H / 2 + b, W / 2 - b, H / 2 - b), D, k.wood(o.color ?? "#6b4630", { gloss: 0.5 }), {
          at: [0, H / 2, D / 2],
          bevel: b,
          holes: [rect(-ow / 2 - b, -oh / 2 - b, ow / 2 + b, oh / 2 + b)],
        }),
        k.extrude(rect(-ow / 2 + 0.001, -oh / 2 + 0.001, ow / 2 - 0.001, oh / 2 - 0.001), 0.006, k.metal("gold", 0.3), {
          at: [0, H / 2, 0.027],
          bevel: 0.001,
          holes: [rect(-ow / 2 + 0.005, -oh / 2 + 0.005, ow / 2 - 0.005, oh / 2 - 0.005)],
        }),
        // The mat, its window cut with a bevel, the print behind it, glass in front.
        k.extrude(rect(-ow / 2 + 0.002, -oh / 2 + 0.002, ow / 2 - 0.002, oh / 2 - 0.002), 0.003, k.paper("#fbfaf6"), {
          at: [0, H / 2, 0.0235],
          bevel: 0.0011,
          holes: [rect(-win.w / 2 - 0.0011, win.dy - win.h / 2 - 0.0011, win.w / 2 + 0.0011, win.dy + win.h / 2 + 0.0011)],
        }),
        k.plane(win.w + 0.01, win.h + 0.01, k.print(graphPrint(), { roughness: 0.85 }), { at: [0, H / 2 + win.dy, 0.0215] }),
        k.plane(ow, oh, k.glass("#e4ecef", 0.12), { at: [0, H / 2, 0.0262] }),
        // A board behind it all.
        k.box(W - 0.012, H - 0.012, 0.004, k.paper("#6e5a44"), { at: [0, H / 2, 0.0025] }),
      ]);
      return g;
    },
  },

  "prize-neon-line": {
    size: [0.82, 0.58, NEON_DEPTH],
    wall: true,
    light: { at: [0, 0.3, 0.2], color: "#ff6aa8", intensity: 1.8, distance: 3.5 },
    build(k, o) {
      const line = o.color ?? "#ff3d8b";
      // The graph on the sheet: origin, and the line y = mx + b crossing both axes.
      const O: P2 = [-0.09, 0.2];
      const m = 0.6;
      const b = 0.085;
      const yAt = (x: number) => O[1] + b + m * (x - O[0]);
      return neonSign(
        k,
        o.on,
        0.82,
        0.58,
        [
          ...axis([-0.37, O[1]], [0.355, O[1]], AXIS_BLUE),
          ...axis([O[0], 0.05], [O[0], 0.52], AXIS_BLUE),
          { pts: [[-0.345, yAt(-0.345)], [0.265, yAt(0.265)]], color: line },
        ],
        [
          { at: [O[0], O[1] + b], color: "#ffd84a", r: 0.011 },
          { at: [O[0] - b / m, O[1]], color: "#ffd84a", r: 0.011 },
        ]
      );
    },
  },

  "prize-lasers": {
    size: [1.16, 1.072, 0.26],
    light: { at: [SOLUTION[0], SOLUTION[1], 0.06], color: "#ffd66b", intensity: 1.6, distance: 3 },
    build(k, o) {
      const post = k.metal(o.color ?? "#b9bec4", 0.32);
      const black = k.metal("black", 0.5);
      const steel = k.metal("steel");
      const brass = k.metal("brass");
      const g = k.group([
        k.box(1.16, 0.045, 0.26, black, { at: [0, 0.0275, 0], r: 0.004 }),
        k.plane(1.152, 0.252, k.print(breadboard(), { roughness: 0.5 }), { at: [0, 0.0502, 0], rot: [-Math.PI / 2, 0, 0] }),
      ]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.cyl(0.016, 0.016, 0.005, k.rubber(), { at: [sx * 0.52, 0.0025, sz * 0.1], seg: 16 }));
      const p = plaque(k, 0.2, 0.03, "CROSSING LASERS", "Unit 5 · Systems of Equations");
      p.position.set(0, 0.0275, 0.13);
      g.add(p);
      const scale = postScale();
      for (const sx of [-1, 1]) {
        const x = sx * POST_X;
        g.add(k.box(0.1, 0.01, 0.1, black, { at: [x, 0.055, 0], r: 0.002 }));
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) g.add(k.cyl(0.0045, 0.0045, 0.004, steel, { at: [x + dx * 0.038, 0.062, dz * 0.038], seg: 12 }));
        g.add(k.box(0.04, 1.0, 0.04, post, { at: [x, 0.56, 0], r: 0.003 }));
        g.add(k.box(0.046, 0.012, 0.046, black, { at: [x, 1.066, 0], r: 0.003 }));
        g.add(k.plane(0.022, 0.94, k.print(scale, { roughness: 0.4 }), { at: [x, 0.56, 0.0202] }));
      }
      for (const beam of BEAMS) {
        const [fx, fy] = beam.from;
        const [tx, ty] = beam.to;
        const sx = Math.sign(tx - fx);
        const len = Math.hypot(tx - fx, ty - fy);
        const ux = (tx - fx) / len;
        const uy = (ty - fy) / len;
        const at = (d: number): V3 => [fx + ux * d, fy + uy * d, 0];
        // The emitter: clamped to its post, the module aimed along the beam, a brass bezel, the lens.
        g.add(k.box(0.052, 0.034, 0.052, black, { at: [fx - sx * CLAMP, fy, 0], r: 0.004 }));
        g.add(rod(k, at(-0.004), at(0.05), 0.0125, 0.0125, black, 20));
        g.add(rod(k, at(0.048), at(0.056), 0.0136, 0.0136, brass, 20));
        g.add(k.sphere(0.0062, k.glow(beam.color, o.on, 3.2), { at: at(0.056), seg: 14 }));
        // The target, flat on the far clamp: a brass disc with a black centre.
        g.add(k.box(0.052, 0.034, 0.052, black, { at: [tx + sx * CLAMP, ty, 0], r: 0.004 }));
        g.add(k.cyl(0.018, 0.018, 0.005, brass, { at: [tx - sx * 0.0025, ty, 0], rot: [0, 0, Math.PI / 2], seg: 24 }));
        g.add(k.cyl(0.011, 0.011, 0.0012, black, { at: [tx - sx * 0.0055, ty, 0], rot: [0, 0, Math.PI / 2], seg: 20 }));
        if (o.on) {
          const hit = len - 0.0061 / Math.abs(ux);
          g.add(k.sphere(0.005, k.glow(beam.color, true, 2), { at: at(hit), scale: [0.5, 1, 1], seg: 12 }));
          // The beam, seen in the room's haze, a faint glow round it.
          g.add(rod(k, at(0.056), at(hit), 0.0021, 0.0021, k.glow(beam.color, true, 1.8), 8));
          g.add(rod(k, at(0.056), at(hit), 0.0065, 0.0065, k.glass(beam.color, 0.16), 10));
        }
      }
      // Where the beams cross: the solution, red and green light making yellow.
      if (o.on) {
        g.add(k.sphere(0.0135, k.glow("#ffd640", true, 2.2), { at: [SOLUTION[0], SOLUTION[1], 0], seg: 22 }));
        g.add(k.sphere(0.03, k.glass("#ffd84a", 0.2), { at: [SOLUTION[0], SOLUTION[1], 0], seg: 22 }));
      }
      return g;
    },
  },

  "prize-half-rug": {
    size: [2.2, 0.016, 1.5],
    build(k, o) {
      const W = 2.2;
      const D = 1.5;
      // The boundary runs from 74% of the way back on the left edge to 20% on the right.
      const vl = 0.74;
      const vr = 0.2;
      const zl = (vl - 0.5) * D;
      const zr = (vr - 0.5) * D;
      const g = k.group([
        k.box(W, 0.012, D, k.fabric("#4a4238", { repeat: [8, 6] }), { at: [0, 0.006, 0], r: 0.004 }),
        k.plane(W - 0.005, D - 0.005, k.print(halfPlaneRug(o.color ?? "#34506e", vl, vr), { roughness: 0.97 }), { at: [0, 0.0122, 0], rot: [-Math.PI / 2, 0, 0] }),
        // The boundary, tufted proud of the pile.
        k.box(Math.hypot(W - 0.012, zr - zl), 0.004, 0.014, k.fabric("#26282a"), { at: [0, 0.0135, (zl + zr) / 2], rot: [0, Math.atan2(zl - zr, W), 0], r: 0.0016 }),
      ]);
      return g;
    },
  },

  "prize-machine": {
    size: [0.641, 0.949, 0.5],
    build(k, o) {
      const enamel = k.paint(o.color ?? "#2e4a42", 0.6);
      const walnut = k.wood("walnut", { gloss: 0.55 });
      const brass = k.metal("brass", 0.28);
      const chrome = k.metal("chrome");
      const dark = k.paint("#111214", 0.3);
      const g = k.group([
        // Plinth on brass ball feet, the enamel cabinet with brass corners, a walnut top.
        k.box(0.6, 0.06, 0.44, walnut, { at: [0, 0.075, 0], r: 0.008 }),
        k.box(0.54, 0.6, 0.38, enamel, { at: [0, 0.405, 0], r: 0.012 }),
        k.box(0.58, 0.032, 0.42, walnut, { at: [0, 0.721, 0], r: 0.007 }),
        // The hopper: a spun brass funnel on a flange, dark in its throat.
        k.cyl(0.078, 0.078, 0.01, brass, { at: [0, 0.742, 0], seg: 32 }),
        k.cyl(0.05, 0.05, 0.002, dark, { at: [0, 0.748, 0], seg: 24 }),
        k.lathe(
          [
            [0.05, 0],
            [0.056, 0],
            [0.056, 0.035],
            [0.06, 0.04],
            [0.165, 0.2],
            [0.172, 0.205],
            [0.172, 0.212],
            [0.164, 0.21],
            [0.054, 0.045],
            [0.05, 0.04],
          ],
          brass,
          { at: [0, 0.737, 0], seg: 44 }
        ),
      ]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          g.add(k.sphere(0.024, brass, { at: [sx * 0.26, 0.024, sz * 0.18], seg: 16 }));
          g.add(k.box(0.014, 0.6, 0.014, brass, { at: [sx * 0.268, 0.405, sz * 0.188], r: 0.003 }));
        }
      // x goes in at the top...
      const xIn = letterBlock(k, 0.05, "x", "#dcb98a");
      xIn.position.set(0.045, 0.737 + 0.172, 0.05);
      xIn.rotation.set(0.5, 0.4, 0.42);
      g.add(xIn);
      // ...and f(x) comes out at the front, into a brass tray.
      const front = 0.19;
      g.add(k.box(0.22, 0.1, 0.006, dark, { at: [0, 0.245, front + 0.001] }));
      g.add(
        k.extrude(rect(-0.122, -0.062, 0.122, 0.062), 0.008, brass, {
          at: [0, 0.245, front + 0.004],
          bevel: 0.0015,
          holes: [rect(-0.108, -0.048, 0.108, 0.048)],
        })
      );
      g.add(k.box(0.22, 0.006, 0.09, brass, { at: [0, 0.198, front + 0.045], r: 0.002 }));
      g.add(k.box(0.22, 0.03, 0.006, brass, { at: [0, 0.21, front + 0.087], r: 0.002 }));
      for (const sx of [-1, 1]) g.add(k.box(0.006, 0.03, 0.09, brass, { at: [sx * 0.107, 0.21, front + 0.045], r: 0.002 }));
      const fx = letterBlock(k, 0.05, "f(x)", "#d8b483");
      fx.position.set(0.035, 0.201 + 0.025, front + 0.048);
      fx.rotation.set(0, -0.32, 0);
      g.add(fx);
      const name = plaque(k, 0.32, 0.056, "FUNCTION MACHINE", "f(x) = 2x + 1");
      name.position.set(0, 0.635, front);
      g.add(name);
      const out = plaque(k, 0.08, 0.024, "OUT", "");
      out.position.set(0, 0.325, front);
      g.add(out);
      // The dial: what comes out.
      g.add(k.torus(0.05, 0.006, brass, { at: [-0.13, 0.475, front + 0.004], seg: 40 }));
      g.add(k.disc(0.047, k.print(dialFace(), { roughness: 0.5 }), { at: [-0.13, 0.475, front + 0.002] }));
      g.add(k.disc(0.048, k.glass("#eef3f4", 0.18), { at: [-0.13, 0.475, front + 0.0065] }));
      // A pilot light and a toggle.
      g.add(k.torus(0.016, 0.004, chrome, { at: [0.09, 0.49, front + 0.003], seg: 28 }));
      g.add(k.sphere(0.0125, k.glow("#ff9a3c", o.on, 2.8), { at: [0.09, 0.49, front + 0.002], scale: [1, 1, 0.6], seg: 20 }));
      g.add(k.box(0.034, 0.05, 0.004, chrome, { at: [0.17, 0.49, front + 0.002], r: 0.0015 }));
      g.add(k.cyl(0.007, 0.007, 0.008, chrome, { at: [0.17, 0.49, front + 0.006], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      g.add(rod(k, [0.17, 0.49, front + 0.008], [0.17, 0.515, front + 0.03], 0.0028, 0.0022, chrome, 10));
      // Three brass gears meshing on the right side, and the lever on the middle one's axle.
      const side = 0.288;
      const mod = 0.008;
      const gears: { n: number; z: number; y: number; turn: number; spokes: number }[] = [
        { n: 24, z: -0.055, y: 0.39, turn: (2.5 * Math.PI) / 180, spokes: 5 },
        { n: 14, z: -0.055 + 0.152 * Math.cos((50 * Math.PI) / 180), y: 0.39 + 0.152 * Math.sin((50 * Math.PI) / 180), turn: (310 * Math.PI) / 180, spokes: 0 },
        { n: 10, z: -0.055 + 0.136 * Math.cos((40 * Math.PI) / 180), y: 0.39 - 0.136 * Math.sin((40 * Math.PI) / 180), turn: (40 * Math.PI) / 180, spokes: 0 },
      ];
      for (const gr of gears) {
        const rp = (mod * gr.n) / 2;
        const holes: P2[][] = [circle(0, 0, 0.007, 14)];
        for (let i = 0; i < gr.spokes; i += 1) holes.push(circle(Math.cos((i / gr.spokes) * TAU) * rp * 0.55, Math.sin((i / gr.spokes) * TAU) * rp * 0.55, rp * 0.22, 16));
        g.add(k.extrude(gearOutline(gr.n, rp, mod), 0.01, brass, { at: [side, gr.y, gr.z], rot: [0, Math.PI / 2, gr.turn], bevel: 0.0015, holes }));
        g.add(k.cyl(0.011, 0.011, 0.03, k.metal("steel"), { at: [side - 0.01, gr.y, gr.z], rot: [0, 0, Math.PI / 2], seg: 18 }));
        g.add(k.sphere(0.012, brass, { at: [side + 0.006, gr.y, gr.z], scale: [0.55, 1, 1], seg: 18 }));
      }
      const hub: V3 = [side + 0.014, gears[1].y, gears[1].z];
      g.add(k.cyl(0.02, 0.02, 0.012, brass, { at: hub, rot: [0, 0, Math.PI / 2], seg: 24 }));
      const knob: V3 = [side + 0.028, 0.86, 0.15];
      g.add(rod(k, hub, knob, 0.007, 0.0055, brass, 12));
      g.add(k.sphere(0.026, k.plastic("#141414", 0.85), { at: knob, seg: 24 }));
      return k.group([g], { at: [-0.0205, 0, -0.03] });
    },
  },

  "prize-stairs": {
    size: [1.458, 1.488, 0.32],
    build(k, o) {
      const wood = k.wood(o.color ?? "#c39462", { gloss: 0.4 });
      const back = k.paint("#ece6da", 0.2);
      const c = 0.36;
      const t = 0.018;
      const kb = 0.03;
      const d = 0.32;
      const xs = [0, 1, 2, 3, 4].map((j) => -2 * c + j * c);
      const boardY = (L: number) => kb + t / 2 + L * c;
      const colTop = (i: number) => kb + t + (i + 1) * c;
      const g = k.group([
        // The kick, set back under it.
        k.box(4 * c - t, kb, d - 0.05, k.paint("#3a2f26", 0.3), { at: [0, kb / 2, -0.02] }),
      ]);
      // Boards: one per level, each running from the step where it starts to the right side.
      for (let L = 0; L <= 4; L += 1) {
        const x0 = xs[Math.max(0, L - 1)] - t / 2 + 0.001;
        const x1 = xs[4] + t / 2 - 0.001;
        g.add(k.box(x1 - x0, t, d - 0.01, wood, { at: [(x0 + x1) / 2, boardY(L), 0.001], r: 0.002 }));
      }
      // Sides and dividers, each as tall as the column it closes, grain upright.
      for (let j = 0; j <= 4; j += 1) {
        const top = colTop(Math.min(j, 3)) - 0.0005;
        const bottom = j === 0 || j === 4 ? 0 : kb;
        g.add(k.box(top - bottom, t, d, wood, { at: [xs[j], (top + bottom) / 2, 0], rot: [0, 0, Math.PI / 2], r: 0.002 }));
      }
      // The back, cut to the staircase.
      const e = 0.003;
      const stepX = (j: number) => xs[j] - t / 2;
      const outline: P2[] = [
        [xs[0] - t / 2 + e, e],
        [xs[4] + t / 2 - e, e],
        [xs[4] + t / 2 - e, colTop(3) - e],
        [stepX(3), colTop(3) - e],
        [stepX(3), colTop(2) - e],
        [stepX(2), colTop(2) - e],
        [stepX(2), colTop(1) - e],
        [stepX(1), colTop(1) - e],
        [stepX(1), colTop(0) - e],
        [xs[0] - t / 2 + e, colTop(0) - e],
      ];
      g.add(k.extrude(outline, 0.006, back, { at: [0, 0, -d / 2 + 0.003], bevel: 0.001 }));
      // What sits in the cubbies.
      const floor = (L: number) => boardY(L) + t / 2;
      const inner = (i: number) => xs[i] + t / 2 + 0.008;
      const depth = 0.2;
      const zb = d / 2 - 0.028 - depth / 2;
      g.add(bookRow(k, [inner(0), floor(0), zb], 0.3, 0.27, depth, 11));
      g.add(k.box(0.3, 0.215, 0.26, k.fabric("#a88b5c", { repeat: [7, 5] }), { at: [(xs[1] + xs[2]) / 2, floor(0) + 0.1075, 0.0], r: 0.012 }));
      g.add(bookRow(k, [inner(1), floor(1), zb], 0.21, 0.25, depth, 23));
      g.add(k.lathe(VASE, k.ceramic("#4d6b73"), { at: [xs[2] - t / 2 - 0.06, floor(1), 0.02], seg: 28 }));
      g.add(bookRow(k, [inner(2), floor(0), zb], 0.33, 0.3, depth, 37));
      for (let i = 0; i < 3; i += 1) g.add(k.box(0.24 - i * 0.02, 0.032, 0.17 - i * 0.012, k.paper(COVERS[(i * 5 + 2) % COVERS.length]), { at: [(xs[2] + xs[3]) / 2 - 0.055, floor(1) + 0.016 + i * 0.032, 0.02], rot: [0, 0.05 - i * 0.07, 0], r: 0.003 }));
      g.add(k.sphere(0.035, k.metal("brass", 0.22), { at: [(xs[2] + xs[3]) / 2 + 0.11, floor(1) + 0.035, 0.05], seg: 24 }));
      g.add(bookRow(k, [inner(2), floor(2), zb], 0.2, 0.26, depth, 41));
      g.add(k.lathe(BOWL, k.ceramic("#efe9df"), { at: [xs[3] - t / 2 - 0.068, floor(2), 0.04], seg: 28 }));
      g.add(bookRow(k, [inner(3), floor(0), zb], 0.33, 0.3, depth, 53));
      g.add(bookRow(k, [inner(3), floor(1), zb], 0.2, 0.28, depth, 59));
      g.add(bookRow(k, [inner(3), floor(2), zb], 0.32, 0.26, depth, 67));
      g.add(bookRow(k, [inner(3) + 0.09, floor(3), zb], 0.23, 0.25, depth, 71));
      // A snake plant on the second shelf of the tallest column.
      const pot: V3 = [xs[4] - t / 2 - 0.07, floor(1), 0.02];
      g.add(k.lathe(POT, k.ceramic("#d9cfc0"), { at: pot, seg: 28 }));
      g.add(k.cyl(0.045, 0.045, 0.006, k.soil(), { at: [pot[0], pot[1] + 0.088, pot[2]], seg: 20 }));
      for (let i = 0; i < 5; i += 1) {
        const a = i * 2.4;
        const lh = 0.17 + (i % 3) * 0.035;
        g.add(k.sphere(1, k.leaf(i % 2 ? 3 : 0), { at: [pot[0] + Math.cos(a) * 0.012, pot[1] + 0.09 + lh * 0.48, pot[2] + Math.sin(a) * 0.012], scale: [0.014, lh / 2, 0.005], rot: [Math.sin(a) * 0.14, a, Math.cos(a) * 0.14] }));
      }
      // On the steps: a succulent, a stack of books, a vase of stems, an hourglass.
      const tread = (i: number) => colTop(i);
      const mid = (i: number) => (xs[i] + xs[i + 1]) / 2;
      g.add(k.lathe(POT, k.stone("terracotta"), { at: [mid(0) - 0.06, tread(0), 0.01], scale: [0.8, 0.8, 0.8], seg: 24 }));
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        g.add(k.sphere(1, k.leaf(4), { at: [mid(0) - 0.06 + Math.cos(a) * 0.022, tread(0) + 0.085, 0.01 + Math.sin(a) * 0.022], scale: [0.016, 0.01, 0.028], rot: [0, -a + Math.PI / 2, 0.5] }));
      }
      for (let i = 0; i < 3; i += 1) g.add(k.box(0.25 - i * 0.025, 0.035, 0.18 - i * 0.015, k.paper(COVERS[(i * 3 + 7) % COVERS.length]), { at: [mid(1), tread(1) + 0.0175 + i * 0.035, 0.0], rot: [0, -0.12 + i * 0.1, 0], r: 0.003 }));
      g.add(k.lathe(VASE, k.ceramic("#2f3b44"), { at: [mid(2) + 0.04, tread(2), 0.0], scale: [1.15, 1.25, 1.15], seg: 28 }));
      for (let i = 0; i < 3; i += 1) {
        const base: V3 = [mid(2) + 0.04, tread(2) + 0.17, 0];
        g.add(k.tube([base, [base[0] + (i - 1) * 0.03, base[1] + 0.12, 0.01 * i], [base[0] + (i - 1) * 0.075, base[1] + 0.24 - i * 0.02, 0.02 * (i - 1)]], 0.0022, k.wood("#7a6248", { gloss: 0.1 }), { seg: 16 }));
      }
      const hg: V3 = [mid(3) + 0.02, tread(3), 0.0];
      g.add(k.cyl(0.05, 0.05, 0.014, k.wood("walnut"), { at: [hg[0], hg[1] + 0.007, hg[2]], seg: 24 }));
      g.add(k.cyl(0.05, 0.05, 0.014, k.wood("walnut"), { at: [hg[0], hg[1] + 0.191, hg[2]], seg: 24 }));
      g.add(k.lathe(HOURGLASS, k.glass("#f1f5f6", 0.3), { at: [hg[0], hg[1] + 0.014, hg[2]], seg: 28 }));
      g.add(k.lathe(SAND, k.paint("#d8c08e", 0.1), { at: [hg[0], hg[1] + 0.014, hg[2]], seg: 24 }));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * TAU + 0.4;
        g.add(k.cyl(0.004, 0.004, 0.17, k.metal("brass"), { at: [hg[0] + Math.cos(a) * 0.04, hg[1] + 0.099, hg[2] + Math.sin(a) * 0.04], seg: 10 }));
      }
      return g;
    },
  },

  "prize-bonsai": {
    size: [0.56, 0.98, 0.37],
    build(k, o) {
      const stand = k.wood("#4a2c21", { gloss: 0.6 });
      const top = 0.5;
      const g = k.group([
        // A rosewood display stand.
        k.box(0.5, 0.034, 0.34, stand, { at: [0, top - 0.017, 0], r: 0.006 }),
        k.box(0.42, 0.045, 0.018, stand, { at: [0, top - 0.056, 0.14], r: 0.003 }),
        k.box(0.42, 0.045, 0.018, stand, { at: [0, top - 0.056, -0.14], r: 0.003 }),
        k.box(0.42, 0.016, 0.26, stand, { at: [0, 0.09, 0], r: 0.003 }),
      ]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.box(top - 0.034, 0.034, 0.034, stand, { at: [sx * 0.215, (top - 0.034) / 2, sz * 0.135], rot: [0, 0, Math.PI / 2], r: 0.004 }));
      const p = plaque(k, 0.15, 0.03, "RADICAL BONSAI", "Unit 9 · Exponents & Radicals");
      p.position.set(0, top - 0.056, 0.149);
      g.add(p);
      // A shallow oval pot, glazed, on four feet; soil, moss and two stones.
      const potY = top + 0.012;
      const ov = 1.35;
      g.add(k.lathe(BONSAI_POT, k.ceramic(o.color ?? "#3e5a6b"), { at: [0, potY, 0], scale: [ov, 1, 1], seg: 44 }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.box(0.03, 0.014, 0.022, k.ceramic(o.color ?? "#3e5a6b"), { at: [sx * 0.12, top + 0.006, sz * 0.068], r: 0.003 }));
      const soilY = potY + 0.062;
      g.add(k.cyl(0.117, 0.117, 0.004, k.soil(), { at: [0, soilY - 0.002, 0], scale: [ov, 1, 1], seg: 36 }));
      const moss = k.fabric("#5b7238", { repeat: [2, 2] });
      for (const [x, z, sx, sz] of [
        [-0.07, 0.03, 0.06, 0.045],
        [0.06, -0.04, 0.07, 0.04],
        [0.03, 0.06, 0.05, 0.03],
      ])
        g.add(k.sphere(1, moss, { at: [x, soilY, z], scale: [sx, 0.011, sz], seg: 20 }));
      g.add(k.sphere(1, k.stone("granite"), { at: [0.1, soilY + 0.003, 0.045], scale: [0.016, 0.009, 0.012], seg: 12 }));
      // The tree: a twisting trunk flaring into roots, grown from them.
      const bark = k.wood("#5d4b3c", { gloss: 0.06, repeat: [2, 3] });
      const base: V3 = [-0.02, soilY, 0];
      const at = (x: number, y: number, z: number): V3 => [base[0] + x, base[1] + y, base[2] + z];
      const trunk: { p: V3; r: number }[] = [
        { p: at(0, -0.004, 0), r: 0.03 },
        { p: at(0.04, 0.085, 0.01), r: 0.024 },
        { p: at(-0.015, 0.175, -0.012), r: 0.018 },
        { p: at(0.03, 0.26, 0.004), r: 0.013 },
        { p: at(0.008, 0.33, 0), r: 0.008 },
      ];
      g.add(
        k.lathe(
          [
            [0.062, -0.006],
            [0.05, 0.002],
            [0.038, 0.014],
            [0.032, 0.03],
            [0, 0.03],
          ],
          bark,
          { at: at(0, 0, 0), seg: 24 }
        )
      );
      for (let i = 0; i < trunk.length - 1; i += 1) {
        g.add(rod(k, trunk[i].p, trunk[i + 1].p, trunk[i].r, trunk[i + 1].r, bark, 16));
        if (i > 0) g.add(k.sphere(trunk[i].r, bark, { at: trunk[i].p, seg: 16 }));
      }
      for (const [x, z] of [
        [0.09, 0.04],
        [-0.085, 0.035],
        [0.03, -0.08],
      ])
        g.add(rod(k, at(x * 0.25, 0.012, z * 0.25), at(x, -0.003, z), 0.012, 0.004, bark, 10));
      // Branches, each ending in a pad of foliage that fills out with the daily goals.
      const grow = Math.min(1, Math.max(0, o.live.growth));
      const thirsty = o.live.thirsty;
      const branches: { from: number; to: V3; r: number }[] = [
        { from: 1, to: at(0.17, 0.12, 0.04), r: 0.0095 },
        { from: 2, to: at(-0.17, 0.19, 0.03), r: 0.009 },
        { from: 2, to: at(0.04, 0.2, -0.12), r: 0.008 },
        { from: 3, to: at(0.15, 0.275, -0.04), r: 0.007 },
        { from: 3, to: at(-0.1, 0.3, 0.05), r: 0.006 },
      ];
      for (const br of branches) g.add(rod(k, trunk[br.from].p, br.to, br.r, br.r * 0.4, bark, 10));
      const pads: { c: V3; s: number; min: number }[] = [
        { c: at(0.18, 0.135, 0.04), s: 0.13, min: 0 },
        { c: at(-0.18, 0.205, 0.03), s: 0.12, min: 0 },
        { c: at(0.04, 0.215, -0.12), s: 0.105, min: 0 },
        { c: at(0.155, 0.29, -0.04), s: 0.1, min: 0 },
        { c: at(-0.105, 0.315, 0.05), s: 0.095, min: 0 },
        { c: at(0.008, 0.36, 0), s: 0.1, min: 0 },
        { c: at(0.1, 0.17, 0.09), s: 0.08, min: 0.45 },
        { c: at(-0.075, 0.23, -0.08), s: 0.08, min: 0.75 },
      ];
      // Each pad: a dense dome of needles, with tufts on it in fresher greens.
      const dense = k.fabric(thirsty ? "#6f7442" : "#38552e", { repeat: [5, 3] });
      const dry = k.paint("#8a8550", 0.12);
      pads.forEach((pad, i) => {
        if (grow < pad.min) return;
        const s = pad.s * (0.6 + 0.4 * grow);
        const outward = Math.sign(pad.c[0] - base[0]) || 1;
        const sag = thirsty ? s * 0.3 : 0;
        const tilt = thirsty ? -outward * 0.32 : 0;
        const tufts: [number, number, number, number][] = [
          [0, 0, 0, 1],
          [0.3, 0.16, 0.14, 0.5],
          [-0.26, 0.15, -0.1, 0.46],
          [0.02, 0.2, -0.22, 0.42],
        ];
        tufts.forEach(([dx, dy, dz, f], j) => {
          const m = j === 0 ? dense : thirsty ? (j % 2 ? dry : k.leaf(4)) : k.leaf((i + j) % 2 ? 1 : 3);
          g.add(
            k.sphere(1, m, {
              at: [pad.c[0] + dx * s, pad.c[1] + dy * s - sag, pad.c[2] + dz * s],
              scale: j === 0 ? [s * 0.56, s * 0.27, s * 0.45] : [s * 0.34 * f * 2, s * 0.22 * f * 2, s * 0.3 * f * 2],
              rot: [0, i * 0.7 + j, tilt],
              seg: j === 0 ? 20 : 14,
            })
          );
        });
      });
      return k.group([g], { at: [0.005, 0, 0] });
    },
  },

  "prize-vine": {
    size: [0.64, 1.25, 0.185],
    wall: true,
    build(k, o) {
      const cedar = k.wood("#a86b44", { gloss: 0.25 });
      const g = k.group([
        // A planter on the wall, soil mounded in it under a cedar rim.
        k.box(0.62, 0.16, 0.17, k.paint(o.color ?? "#3c4842", 0.45), { at: [0, 0.08, 0.085], r: 0.008 }),
        k.cushion(0.585, 0.022, 0.135, k.soil(), { at: [0, 0.158, 0.088] }),
        k.extrude(rect(-0.317, -0.0895, 0.317, 0.0895), 0.018, cedar, {
          at: [0, 0.169, 0.0925],
          rot: [-Math.PI / 2, 0, 0],
          bevel: 0.003,
          holes: [rect(-0.293, -0.0705, 0.293, 0.0705)],
        }),
      ]);
      // The trellis, off the wall on cleats: verticals in front of horizontals.
      for (const x of [-0.27, -0.09, 0.09, 0.27]) g.add(k.box(1.06, 0.022, 0.016, cedar, { at: [x, 0.72, 0.066], rot: [0, 0, Math.PI / 2], r: 0.003 }));
      for (const y of [0.27, 0.46, 0.65, 0.84, 1.03, 1.22]) g.add(k.box(0.6, 0.022, 0.016, cedar, { at: [0, y, 0.05], r: 0.003 }));
      for (const x of [-0.18, 0.18]) for (const y of [0.27, 1.22]) g.add(k.box(0.04, 0.04, 0.042, cedar, { at: [x, y, 0.021], r: 0.003 }));
      // The vine: as it grows it climbs higher and branches, and its leaves double.
      const grow = Math.min(1, Math.max(0, o.live.growth));
      const thirsty = o.live.thirsty;
      const stem = k.wood("#5e6a3a", { gloss: 0.2 });
      const runs: V3[][] = [];
      const climb = (x0: number, y0: number, x1: number, y1: number, wig: number, ph: number): V3[] => {
        const n = Math.max(3, Math.round((y1 - y0) / 0.06));
        return Array.from({ length: n + 1 }, (_, i): V3 => {
          const t = i / n;
          const y = y0 + (y1 - y0) * t;
          return [x0 + (x1 - x0) * t + Math.sin(y * 9 + ph) * wig * Math.min(1, t * 3), y, 0.081 + Math.sin(y * 17 + ph) * 0.006];
        });
      };
      const height = 0.32 + grow * 0.86;
      runs.push(climb(-0.16, 0.16, -0.06, height, 0.05, 0));
      if (grow > 0.3) runs.push(climb(-0.12, 0.4, 0.2, 0.4 + (grow - 0.3) * 1.05, 0.04, 1.7));
      if (grow > 0.62) runs.push(climb(-0.08, 0.66, -0.26, 0.66 + (grow - 0.62) * 1.2, 0.035, 3.1));
      for (const run of runs) g.add(k.tube(run, 0.0042, stem, { seg: Math.max(12, run.length * 4) }));
      const leaves = Math.round(4 * 2 ** (3 * grow));
      const rnd = seeded(83);
      const total = runs.reduce((s, r) => s + r.length - 1, 0);
      for (let i = 0; i < leaves; i += 1) {
        // Spread along all the runs, the newest leaves smaller near the tips.
        const f = (i + 0.5) / leaves;
        let at = f * total;
        let run = runs[0];
        for (const r of runs) {
          if (at <= r.length - 1) {
            run = r;
            break;
          }
          at -= r.length - 1;
        }
        const j = Math.min(run.length - 2, Math.floor(at));
        const u = at - j;
        const pt: V3 = [run[j][0] + (run[j + 1][0] - run[j][0]) * u, run[j][1] + (run[j + 1][1] - run[j][1]) * u, run[j][2] + 0.004];
        const tip = 1 - (at / (run.length - 1)) * 0.5;
        const size = (0.045 + rnd() * 0.022) * (0.75 + 0.25 * tip);
        const side = i % 2 ? 1 : -1;
        const leaf = k.extrude(LEAF, 0.0016, thirsty ? k.leaf(4) : k.leaf(i % 5 === 0 ? 4 : i % 3), { scale: [size, size, 1], bevel: 0.0005 });
        g.add(k.group([leaf], { at: pt, rot: [thirsty ? -0.12 : -0.45 - rnd() * 0.35, side * (0.2 + rnd() * 0.3), side * (0.35 + rnd() * 0.45) + (thirsty ? side * 0.25 : 0)] }));
      }
      return g;
    },
  },

  "prize-area-table": {
    size: [0.98, 0.42, 0.87],
    build(k, o) {
      const frame = k.wood(o.color ?? "#2f2620", { gloss: 0.55 });
      const walnut = k.wood("walnut", { gloss: 0.6 });
      const maple = k.wood("maple", { gloss: 0.6 });
      const cherry = k.wood("cherry", { gloss: 0.6 });
      const brass = k.metal("brass", 0.25);
      const X = 0.56;
      const U = 0.11;
      const Win = X + 3 * U;
      const Din = X + 2 * U;
      const fb = 0.045;
      const top = 0.42;
      const gap = 0.003;
      const it = 0.006;
      const y = top - it / 2;
      const x0 = -Win / 2;
      const z0 = -Din / 2;
      const g = k.group([
        // The inlay's dark ground, under the four pieces of wood.
        k.box(Win + 0.002, 0.026, Din + 0.002, k.wood("ebony", { gloss: 0.3 }), { at: [0, top - it - 0.013, 0] }),
        // x squared, in walnut.
        k.box(X - gap, it, X - gap, walnut, { at: [x0 + X / 2, y, z0 + X / 2], r: 0.0015 }),
      ]);
      // Three x strips beside it, two below it, in maple with the grain along their length.
      for (let i = 0; i < 3; i += 1) g.add(k.box(X - gap, it, U - gap, maple, { at: [x0 + X + U * (i + 0.5), y, z0 + X / 2], rot: [0, Math.PI / 2, 0], r: 0.0015 }));
      for (let j = 0; j < 2; j += 1) g.add(k.box(X - gap, it, U - gap, maple, { at: [x0 + X / 2, y, z0 + X + U * (j + 0.5)], r: 0.0015 }));
      // Six units in the corner, in cherry.
      for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) g.add(k.box(U - gap, it, U - gap, cherry, { at: [x0 + X + U * (i + 0.5), y, z0 + X + U * (j + 0.5)], r: 0.0015 }));
      // Brass lines where x ends and the units begin.
      g.add(k.box(0.0024, it + 0.0002, Din, brass, { at: [x0 + X, y, 0] }));
      g.add(k.box(Win, it + 0.0002, 0.0024, brass, { at: [0, y, z0 + X] }));
      // The frame round the top, butt-jointed, its grain along each piece.
      const ft = 0.032;
      const fy = top - ft / 2;
      g.add(k.box(Win + 2 * fb, ft, fb, frame, { at: [0, fy, Din / 2 + fb / 2], r: 0.004 }));
      g.add(k.box(Win + 2 * fb, ft, fb, frame, { at: [0, fy, -Din / 2 - fb / 2], r: 0.004 }));
      g.add(k.box(Din, ft, fb, frame, { at: [Win / 2 + fb / 2, fy, 0], rot: [0, Math.PI / 2, 0], r: 0.004 }));
      g.add(k.box(Din, ft, fb, frame, { at: [-Win / 2 - fb / 2, fy, 0], rot: [0, Math.PI / 2, 0], r: 0.004 }));
      // Apron, tapered legs on brass shoes.
      const ay = top - ft - 0.035;
      const ax = Win / 2 + fb - 0.05;
      const az = Din / 2 + fb - 0.05;
      g.add(k.box(2 * ax, 0.07, 0.02, frame, { at: [0, ay, az - 0.01], r: 0.003 }));
      g.add(k.box(2 * ax, 0.07, 0.02, frame, { at: [0, ay, -az + 0.01], r: 0.003 }));
      g.add(k.box(2 * az - 0.04, 0.07, 0.02, frame, { at: [ax - 0.01, ay, 0], rot: [0, Math.PI / 2, 0], r: 0.003 }));
      g.add(k.box(2 * az - 0.04, 0.07, 0.02, frame, { at: [-ax + 0.01, ay, 0], rot: [0, Math.PI / 2, 0], r: 0.003 }));
      const legH = top - ft;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const lx = sx * (ax - 0.026);
          const lz = sz * (az - 0.026);
          g.add(k.cyl(0.025, 0.016, legH, frame, { at: [lx, legH / 2, lz], seg: 20 }));
          g.add(k.cyl(0.0172, 0.0168, 0.03, brass, { at: [lx, 0.015, lz], seg: 20 }));
        }
      const p = plaque(k, 0.2, 0.036, "(x + 3)(x + 2)", "x² + 5x + 6");
      p.position.set(0, ay, az);
      g.add(p);
      return g;
    },
  },

  "prize-arch": {
    size: [0.96, 1.12, 0.26],
    build(k, o) {
      const baseH = 0.07;
      const a = 0.42;
      const h = 1.05;
      const th = 0.057;
      const n = 3;
      const woods = [k.wood("maple", { gloss: 0.6 }), k.wood("walnut", { gloss: 0.6 })];
      const g = k.group([
        // A lacquered plinth with a brass line along its top: the x-axis the arch stands on.
        k.box(0.96, baseH, 0.26, k.paint(o.color ?? "#2b2d31", 0.5), { at: [0, baseH / 2, 0], r: 0.006 }),
        k.box(0.9, 0.0016, 0.004, k.metal("brass", 0.25), { at: [0, baseH + 0.0003, 0.07] }),
      ]);
      // Bent laminations: maple either side of a walnut core.
      for (let i = 0; i < n; i += 1) {
        const d0 = (th * i) / n;
        const d1 = (th * (i + 1)) / n;
        g.add(k.extrude(parabolaBand(a - d0, h - d0, a - d1, h - d1), 0.06, woods[i % 2], { at: [0, baseH, 0], bevel: 0.0012 }));
      }
      // Brass shoes where the legs meet the plinth: the two roots.
      const brass = k.metal("brass", 0.25);
      for (const sx of [-1, 1]) {
        const slope = Math.atan((2 * h) / a);
        g.add(k.box(th + 0.014, 0.05, 0.074, brass, { at: [sx * (a - th / 2 - 0.002), baseH + 0.02, 0], rot: [0, 0, sx * (Math.PI / 2 - slope)], r: 0.003 }));
        g.add(k.box(0.08, 0.006, 0.09, brass, { at: [sx * (a - th / 2), baseH + 0.003, 0], r: 0.002 }));
      }
      // A plumb line from the vertex: the axis of symmetry, its bob over a brass mark.
      const vertex = baseH + h - th;
      const bobTop = baseH + 0.15;
      g.add(k.cyl(0.0007, 0.0007, vertex - bobTop, k.metal("steel"), { at: [0, (vertex + bobTop) / 2, 0], seg: 6 }));
      g.add(
        k.lathe(
          [
            [0, 0],
            [0.011, 0.028],
            [0.0155, 0.046],
            [0.0145, 0.056],
            [0.007, 0.062],
            [0.004, 0.072],
            [0, 0.074],
          ],
          brass,
          { at: [0, bobTop - 0.074, 0], seg: 28 }
        )
      );
      g.add(k.cyl(0.014, 0.014, 0.0016, brass, { at: [0, baseH + 0.0008, 0], seg: 28 }));
      const p = plaque(k, 0.2, 0.034, "PARABOLA ARCH", "Unit 12 · Quadratic Functions");
      p.position.set(0, baseH / 2, 0.13);
      g.add(p);
      return g;
    },
  },

  "prize-zigzag": {
    size: [0.92, 0.5, NEON_DEPTH],
    wall: true,
    light: { at: [0, 0.25, 0.2], color: "#5ad6ff", intensity: 1.8, distance: 3.5 },
    build(k, o) {
      const tube = o.color ?? "#2fe3ff";
      const O: P2 = [-0.03, 0.17];
      const u = 0.05;
      const P = (x: number, y: number): P2 => [O[0] + x * u, O[1] + y * u];
      // A different rule on every stretch: four pieces, the corners marked.
      const corners: P2[] = [P(-7.4, 4.6), P(-3.6, 0.6), P(-1.6, 3), P(2, -1), P(7.2, 2.5)];
      return neonSign(
        k,
        o.on,
        0.92,
        0.5,
        [...axis([-0.42, O[1]], [0.405, O[1]], AXIS_AMBER), ...axis([O[0], 0.04], [O[0], 0.45], AXIS_AMBER), { pts: corners, color: tube }],
        corners.slice(1, -1).map((c) => ({ at: c, color: "#f4f6ff", r: 0.0095 }))
      );
    },
  },

  "prize-histogram": {
    size: [1.518, 1.558, 0.3],
    build(k, o) {
      const wood = k.wood(o.color ?? "#6b4630", { gloss: 0.5 });
      const back = k.paint("#e6dfd2", 0.2);
      const counts = [1, 3, 5, 4, 2];
      const c = 0.3;
      const t = 0.018;
      const kb = 0.04;
      const d = 0.3;
      const xs = counts.map((_, j) => -0.75 + j * c).concat([0.75]);
      const levelY = (L: number) => kb + t / 2 + L * c;
      const T = counts.map((n) => kb + t + n * c);
      const g = k.group([k.box(1.5 - 0.03, kb, d - 0.05, k.paint("#2c241d", 0.3), { at: [0, kb / 2, -0.02] })]);
      // A board at every level, across the bars tall enough to have it.
      for (let L = 0; L <= Math.max(...counts); L += 1) {
        const bars = counts.map((n, i) => (n >= L ? i : -1)).filter((i) => i >= 0);
        const x0 = xs[bars[0]] - t / 2 + 0.001;
        const x1 = xs[bars[bars.length - 1] + 1] + t / 2 - 0.001;
        g.add(k.box(x1 - x0, t, d - 0.01, wood, { at: [(x0 + x1) / 2, levelY(L), 0.002], r: 0.002 }));
      }
      // Sides between bars, each as tall as the taller bar it closes.
      for (let j = 0; j <= counts.length; j += 1) {
        const top = Math.max(j > 0 ? T[j - 1] : 0, j < counts.length ? T[j] : 0) - 0.0005;
        const bottom = j === 0 || j === counts.length ? 0 : kb;
        g.add(k.box(top - bottom, t, d, wood, { at: [xs[j], (top + bottom) / 2, 0], rot: [0, 0, Math.PI / 2], r: 0.002 }));
      }
      // The back, cut to the bars' outline.
      const e = 0.003;
      const outline: P2[] = [
        [xs[0] - t / 2 + e, e],
        [xs[counts.length] + t / 2 - e, e],
      ];
      for (let i = counts.length - 1; i >= 0; i -= 1) {
        const right = i === counts.length - 1 ? xs[i + 1] + t / 2 - e : T[i] > T[i + 1] ? xs[i + 1] + t / 2 - e : xs[i + 1] - t / 2 + e;
        const left = i === 0 ? xs[0] - t / 2 + e : T[i] > T[i - 1] ? xs[i] - t / 2 + e : xs[i] + t / 2 - e;
        outline.push([right, T[i] - e], [left, T[i] - e]);
      }
      g.add(k.extrude(outline, 0.006, back, { at: [0, 0, -d / 2 + 0.003], bevel: 0.001 }));
      // A brass line along the bottom: the axis the bars stand on.
      g.add(k.box(1.52, 0.004, 0.003, k.metal("brass", 0.25), { at: [0, kb + t + 0.002, d / 2 + 0.0015] }));
      // Books on every shelf, each row its own; in three of them, something else beside the books.
      const depth = 0.2;
      const zb = d / 2 - 0.028 - depth / 2;
      const floor = (L: number) => levelY(L) + t / 2;
      const inside = c - t - 0.016;
      const decor: Record<string, "left" | "right"> = { "0:0": "right", "2:3": "right", "4:1": "left" };
      let seed = 3;
      counts.forEach((n, i) => {
        for (let L = 0; L < n; L += 1) {
          seed += 17;
          const room = decor[`${i}:${L}`];
          const fill = room ? 0.52 : 0.64 + seeded(seed)() * 0.3;
          const w = inside * fill;
          const right = room ? room === "left" : seed % 3 === 0;
          const x = right ? xs[i + 1] - t / 2 - 0.008 - w : xs[i] + t / 2 + 0.008;
          g.add(bookRow(k, [x, floor(L), zb], w, 0.235 + (seed % 5) * 0.006, depth, seed));
        }
      });
      g.add(k.lathe(BOWL, k.ceramic("#2f3b44"), { at: [xs[1] - t / 2 - 0.066, floor(0), 0.04], scale: [0.9, 0.9, 0.9], seg: 28 }));
      g.add(k.lathe(VASE, k.ceramic("#b9573e"), { at: [xs[3] - t / 2 - 0.06, floor(3), 0.03], seg: 28 }));
      g.add(k.sphere(0.03, k.metal("brass", 0.22), { at: [xs[4] + t / 2 + 0.05, floor(1) + 0.03, 0.05], seg: 24 }));
      return g;
    },
  },

  "prize-rocket": {
    size: [0.26, 0.715, 0.26],
    build(k, o) {
      const brass = k.metal("brass", 0.18);
      const wood = k.wood(o.color ?? "#6b4630", { gloss: 0.65 });
      const g = k.group([
        // The stand: a walnut plinth, a brass plate, a steel blast plate, the launch rod.
        k.box(0.26, 0.045, 0.26, k.wood("walnut", { gloss: 0.55 }), { at: [0, 0.0225, 0], r: 0.008 }),
        k.cyl(0.1, 0.1, 0.004, brass, { at: [0, 0.047, 0], seg: 40 }),
        k.cyl(0.05, 0.05, 0.003, k.metal("steel", 0.4), { at: [0, 0.0505, 0], seg: 32 }),
        k.cyl(0.003, 0.003, 0.57, k.metal("steel"), { at: [0, 0.049 + 0.285, -0.0385], seg: 10 }),
        k.sphere(0.005, brass, { at: [0, 0.621, -0.0385], seg: 12 }),
        // The rocket: copper nozzle, brass body with wooden bands, turned wooden nose, brass tip.
        k.lathe(
          [
            [0, 0.004],
            [0.016, 0.0015],
            [0.02, 0],
            [0.0195, 0.004],
            [0.015, 0.013],
            [0.0125, 0.021],
            [0.0125, 0.03],
            [0, 0.03],
          ],
          k.metal("copper", 0.3),
          { at: [0, 0.072, 0], seg: 28 }
        ),
        k.cyl(0.032, 0.032, 0.4, brass, { at: [0, 0.3, 0], seg: 40 }),
        k.cyl(0.0335, 0.0335, 0.014, wood, { at: [0, 0.112, 0], seg: 40 }),
        k.cyl(0.0335, 0.0335, 0.01, wood, { at: [0, 0.31, 0], seg: 40 }),
        k.cyl(0.0335, 0.0335, 0.012, wood, { at: [0, 0.494, 0], seg: 40 }),
        k.lathe(NOSE, wood, { at: [0, 0.5, 0], seg: 40 }),
        k.lathe(
          [
            [0.0052, 0],
            [0.0042, 0.006],
            [0.0022, 0.012],
            [0, 0.016],
          ],
          brass,
          { at: [0, 0.697, 0], seg: 16 }
        ),
        // The launch lug that rides the rod.
        k.cyl(0.0058, 0.0058, 0.05, brass, { at: [0, 0.27, -0.0385], seg: 14 }),
      ]);
      // Four swept fins, standing on the blast plate.
      const fin: P2[] = [
        [0, 0.16],
        [0.078, 0.052],
        [0.083, -0.048],
        [0.062, -0.048],
        [0, 0.0],
      ];
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        g.add(k.extrude(fin, 0.006, wood, { at: [Math.cos(a) * 0.03, 0.1, -Math.sin(a) * 0.03], rot: [0, a, 0], bevel: 0.0015 }));
      }
      // Two portholes facing the room.
      for (const [py, pr] of [
        [0.4, 0.011],
        [0.35, 0.008],
      ]) {
        const a = 0.6;
        g.add(k.torus(pr, 0.0026, brass, { at: [Math.sin(a) * 0.0315, py, Math.cos(a) * 0.0315], rot: [0, a, 0], seg: 24 }));
        g.add(k.sphere(pr - 0.0012, k.glass("#bcd6e0", 0.45), { at: [Math.sin(a) * 0.031, py, Math.cos(a) * 0.031], rot: [0, a, 0], scale: [1, 1, 0.4], seg: 16 }));
      }
      const p = plaque(k, 0.16, 0.03, "MODEL ROCKET", "h(t) = -4.9t² + 30t");
      p.position.set(0, 0.0225, 0.13);
      g.add(p);
      return g;
    },
  },
};
