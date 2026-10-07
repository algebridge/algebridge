/**
 * A teenager's room, built to the bar items/core.ts sets: real sizes in
 * metres, real materials, soft edges, and where a piece can show something
 * true, it does. The poster and the whiteboard carry the skill the student
 * is on, the pin board gets a card for every unit finished, and the plants
 * grow with the daily goals reached and wilt after three days away.
 */

import * as THREE from "three";
import { canvasTexture, type Kit, type V3 } from "../kit";
import type { ItemModel } from "../types";
import { units } from "@/data/curriculum";

type Pt = [number, number];

const SANS = '"Helvetica Neue", Helvetica, Inter, Arial, system-ui, sans-serif';
/** Marker on a whiteboard. */
const MARKER = '"Marker Felt", "Segoe Print", "Bradley Hand", Noteworthy, "Comic Neue", cursive';
/** Ballpoint and pencil on paper. */
const PEN = '"Bradley Hand", "Segoe Print", Noteworthy, "Marker Felt", cursive';

/** A fixed random source, so a piece is the same every time it is built. */
function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483645) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const hex = (c: THREE.Color) => `#${c.getHexString()}`;
const shade = (color: string, f: number) => hex(new THREE.Color(color).multiplyScalar(f));
const tint = (color: string, toward: string, t: number) => hex(new THREE.Color(color).lerp(new THREE.Color(toward), t));

// ---------------------------------------------------------------------------
// Writing on things
// ---------------------------------------------------------------------------

/** Words into lines no wider than `max` pixels, in the canvas's current font. */
function wrapLines(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size, from `big` down to `small`, at which `text` fits in
 * `maxLines` lines `max` pixels wide (and, given `maxH`, that many pixels
 * tall); cut short with an ellipsis when even `small` will not do.
 */
function fitText(
  c: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  max: number,
  maxLines: number,
  big: number,
  small: number,
  maxH = Infinity,
  lineH = 1.1
): { lines: string[]; px: number } {
  for (let px = big; px >= small; px -= 2) {
    c.font = font(px);
    const lines = wrapLines(c, text, max);
    if (lines.length <= maxLines && lines.length * px * lineH <= maxH && lines.every((l) => c.measureText(l).width <= max)) return { lines, px };
  }
  c.font = font(small);
  const all = wrapLines(c, text, max);
  const room = Math.max(1, Math.min(maxLines, Math.floor(maxH / (small * lineH))));
  const lines = all.slice(0, room);
  if (all.length > room) {
    let last = lines[room - 1];
    while (last.length > 1 && c.measureText(`${last}...`).width > max) last = last.slice(0, -1);
    lines[room - 1] = `${last.trimEnd()}...`;
  }
  return { lines, px: small };
}

/** Text with its letters spaced out, the way a poster sets small capitals. */
function spaced(c: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number, align: "left" | "right" = "left"): void {
  const chars = [...text];
  const widths = chars.map((ch) => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let cx = align === "right" ? x - total : x;
  const was = c.textAlign;
  c.textAlign = "left";
  chars.forEach((ch, i) => {
    c.fillText(ch, cx, y);
    cx += widths[i] + gap;
  });
  c.textAlign = was;
}

/** One handwritten line: never quite level. */
function scrawl(c: CanvasRenderingContext2D, text: string, x: number, y: number, tilt: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.fillText(text, 0, 0);
  c.restore();
}

/** Cork, speckled, for a pin board or a yoga block. */
function corkPicture(w: number, h: number, seed: number): THREE.CanvasTexture {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = "#a6825b";
    c.fillRect(0, 0, w, h);
    const rnd = rng(seed);
    const tones = ["#84603b", "#bd986d", "#987249", "#cfb08a", "#6b4d31", "#a57c52"];
    for (let i = 0; i < (w * h) / 12; i += 1) {
      c.globalAlpha = 0.35 + rnd() * 0.5;
      c.fillStyle = tones[Math.floor(rnd() * tones.length)];
      const s = 0.8 + rnd() * 2.6;
      c.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd() * 0.8));
    }
    c.globalAlpha = 1;
  });
}

/** A small line graph on a grid: y = x/2 + 1, with the rise and the run between two points marked. */
function lineGraph(c: CanvasRenderingContext2D, x0: number, y0: number, gw: number, gh: number, ink: string, accent: string): void {
  const cols = 10;
  const s = gw / cols;
  const rows = Math.max(5, Math.floor(gh / s));
  const top = y0 + (gh - rows * s) / 2;
  const X = (u: number) => x0 + (u + 2) * s;
  const Y = (v: number) => top + (rows - 1.5 - v) * s;
  c.save();
  c.beginPath();
  c.rect(x0, top, gw, rows * s);
  c.clip();
  c.strokeStyle = "rgba(30,28,25,0.26)";
  c.lineWidth = 2;
  for (let i = 0; i <= cols; i += 1) {
    c.beginPath();
    c.moveTo(x0 + i * s, top);
    c.lineTo(x0 + i * s, top + rows * s);
    c.stroke();
  }
  for (let j = 0; j <= rows; j += 1) {
    c.beginPath();
    c.moveTo(x0, top + j * s);
    c.lineTo(x0 + gw, top + j * s);
    c.stroke();
  }
  c.strokeStyle = ink;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x0, Y(0));
  c.lineTo(x0 + gw, Y(0));
  c.moveTo(X(0), top);
  c.lineTo(X(0), top + rows * s);
  c.stroke();
  c.strokeStyle = accent;
  c.lineWidth = 6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(X(-2), Y(0));
  c.lineTo(X(8), Y(5));
  c.stroke();
  c.restore();
  c.setLineDash([10, 8]);
  c.strokeStyle = ink;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(X(2), Y(2));
  c.lineTo(X(6), Y(2));
  c.lineTo(X(6), Y(4));
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = accent;
  for (const [u, v] of [
    [2, 2],
    [6, 4],
  ]) {
    c.beginPath();
    c.arc(X(u), Y(v), s * 0.15, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = ink;
  c.font = `italic 500 ${Math.round(s * 0.4)}px ${SANS}`;
  c.textAlign = "center";
  c.fillText("run", X(4), Y(2) + s * 0.55);
  c.textAlign = "left";
  c.fillText("rise", X(6) + s * 0.18, Y(3) + s * 0.14);
}

/** The poster's print: the skill the student is on, its key idea set big, and the graph that goes with it. */
function posterArt(c: CanvasRenderingContext2D, w: number, h: number, skill: string, headline: string): void {
  c.fillStyle = "#ebe4d4";
  c.fillRect(0, 0, w, h);
  const rnd = rng(17);
  for (let i = 0; i < 4000; i += 1) {
    c.fillStyle = `rgba(80,60,30,${0.02 + rnd() * 0.04})`;
    c.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
  }
  const ink = "#1e1c19";
  const red = "#c24e2a";
  const L = w * 0.09;
  const R = w * 0.91;
  const tw = R - L;
  c.textBaseline = "alphabetic";
  c.fillStyle = red;
  c.font = `700 ${Math.round(w * 0.03)}px ${SANS}`;
  spaced(c, "NOW LEARNING", L, h * 0.075, w * 0.006);
  c.fillStyle = ink;
  const sk = fitText(c, skill, (px) => `500 ${px}px ${SANS}`, tw, 1, Math.round(w * 0.05), Math.round(w * 0.03));
  c.font = `500 ${sk.px}px ${SANS}`;
  const skY = h * 0.075 + sk.px * 1.4;
  c.fillText(sk.lines[0], L, skY);
  const headTop = skY + h * 0.03;
  const head = fitText(c, headline, (px) => `800 ${px}px ${SANS}`, tw, 5, Math.round(w * 0.15), Math.round(w * 0.06), h * 0.5 - headTop, 1.04);
  c.font = `800 ${head.px}px ${SANS}`;
  let y = headTop + head.px * 0.86;
  for (const line of head.lines) {
    c.fillText(line, L, y);
    y += head.px * 1.04;
  }
  const gTop = Math.max(y, h * 0.52);
  lineGraph(c, L, gTop, tw, h * 0.885 - gTop, ink, red);
  c.fillStyle = ink;
  c.fillRect(L, h * 0.912, tw, 2);
  c.font = `600 ${Math.round(w * 0.024)}px ${SANS}`;
  spaced(c, "ALGEBRA 1", L, h * 0.948, w * 0.005);
  spaced(c, "ALGEBRIDGE", R, h * 0.948, w * 0.005, "right");
}

/** A ruled index card with a finished unit written on it. */
function unitCard(n: number, title: string): THREE.CanvasTexture {
  return canvasTexture(360, 240, (c, w, h) => {
    c.fillStyle = "#fbf8ef";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(205,70,70,0.75)";
    c.fillRect(0, 60, w, 2.5);
    c.fillStyle = "rgba(90,130,200,0.4)";
    for (let y = 96; y < h; y += 32) c.fillRect(0, y, w, 2);
    c.textBaseline = "alphabetic";
    c.fillStyle = "#b3322c";
    c.font = `40px ${PEN}`;
    scrawl(c, `Unit ${n}`, 18, 48, -0.02);
    c.fillStyle = "#24408f";
    const t = fitText(c, title, (px) => `${px}px ${PEN}`, w - 34, 2, 34, 20);
    c.font = `${t.px}px ${PEN}`;
    t.lines.forEach((line, i) => scrawl(c, line, 18, 90 + i * 32, i % 2 ? -0.01 : 0.012));
    c.strokeStyle = "#2f7d46";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(w - 76, 28);
    c.lineTo(w - 59, 45);
    c.lineTo(w - 28, 9);
    c.stroke();
  });
}

// ---------------------------------------------------------------------------
// Shapes the pieces share
// ---------------------------------------------------------------------------

/** A frame's moulding: w by h, `face` wide and `depth` deep, its bottom edge on y = y0 and its back on z = 0. */
function moulding(k: Kit, w: number, h: number, face: number, depth: number, m: THREE.Material, y0 = 0, bevel = 0.002): THREE.Mesh {
  const ox = w / 2 - bevel;
  const ix = w / 2 - face + bevel;
  return k.extrude(
    [
      [-ox, y0 + bevel],
      [ox, y0 + bevel],
      [ox, y0 + h - bevel],
      [-ox, y0 + h - bevel],
    ],
    depth,
    m,
    {
      at: [0, 0, depth / 2],
      bevel,
      holes: [
        [
          [-ix, y0 + face - bevel],
          [ix, y0 + face - bevel],
          [ix, y0 + h - face + bevel],
          [-ix, y0 + h - face + bevel],
        ],
      ],
    }
  );
}

/** A closed loop round a rounded rectangle (half sizes hw by hd, corners `rad`) at height y: piping, rails. */
function loop(hw: number, hd: number, rad: number, y: number, steps = 5): V3[] {
  const pts: V3[] = [];
  const corners: [number, number, number][] = [
    [hw - rad, hd - rad, 0],
    [-(hw - rad), hd - rad, Math.PI / 2],
    [-(hw - rad), -(hd - rad), Math.PI],
    [hw - rad, -(hd - rad), (Math.PI * 3) / 2],
  ];
  for (const [cx, cz, a0] of corners)
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad]);
    }
  pts.push(pts[0]);
  return pts;
}

/** The point a fraction `t` of the way along a path, by length. */
function along(pts: V3[], t: number): V3 {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]));
  let left = Math.min(1, Math.max(0, t)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i += 1) {
    if (left <= lens[i] || i === lens.length - 1) {
      const u = lens[i] > 0 ? Math.min(1, left / lens[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u, pts[i][2] + (pts[i + 1][2] - pts[i][2]) * u];
    }
    left -= lens[i];
  }
  return pts[pts.length - 1];
}

/** A heart-shaped leaf (pothos), `len` long, hanging from its stalk at the origin with its tip down, flat in x and y. */
function heartLeaf(len: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 36; i += 1) {
    const t = (i / 36) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([(x * 0.62 * len) / 29, ((y - 5) * len) / 29]);
  }
  return pts;
}

/** A fern frond, `len` long, pointing up +y from its base, its leaflets cut into the outline. */
function frond(len: number): Pt[] {
  const right: Pt[] = [];
  const n = 9;
  for (let i = 0; i <= n; i += 1) {
    const y = (i / n) * len;
    const w = len * 0.2 * Math.sin(Math.PI * (0.15 + 0.85 * (1 - i / n))) * (i === n ? 0 : 1);
    right.push([w * 0.25, y]);
    if (i < n) right.push([w, y + len / n / 2]);
  }
  const left = right
    .slice()
    .reverse()
    .map(([x, y]) => [-x, y] as Pt);
  return [[0, 0], ...right, ...left.slice(1, -1)];
}

const COVERS = ["#7a2e2e", "#2f4f6f", "#3d5c3a", "#8a6a2f", "#5a3d6b", "#2c2c2c", "#a24b2a", "#46607a", "#6d6a5f", "#9c7c4a", "#c9b79c"];

/** Books standing in a row from x = 0 to the right, the last one leaning on its neighbour. */
function bookRow(k: Kit, count: number, seed: number, h: Pt = [0.17, 0.23], d: Pt = [0.13, 0.17]): THREE.Group {
  const rnd = rng(seed);
  const g = new THREE.Group();
  let x = 0;
  let prevH = h[1];
  for (let i = 0; i < count; i += 1) {
    const t = 0.02 + rnd() * 0.022;
    const bh = h[0] + rnd() * (h[1] - h[0]);
    const bd = d[0] + rnd() * (d[1] - d[0]);
    const cover = k.paper(COVERS[Math.floor(rnd() * COVERS.length)]);
    if (i === count - 1 && count > 2) {
      // Leaning left onto the book before it.
      const lean = 0.24;
      const bx = x + Math.min(bh, prevH) * Math.sin(lean);
      g.add(k.box(t, bh, bd, cover, { at: [bx + (t / 2) * Math.cos(lean) - (bh / 2) * Math.sin(lean), (t / 2) * Math.sin(lean) + (bh / 2) * Math.cos(lean), 0], rot: [0, 0, lean], r: 0.003 }));
    } else {
      g.add(k.box(t, bh, bd, cover, { at: [x + t / 2, bh / 2, 0], r: 0.003 }));
      x += t + 0.0015;
      prevH = bh;
    }
  }
  return g;
}

/** Legs that splay: `n` of them, from radius rTop under a top `h` high out to radius rFoot on the floor, tapering. */
function splayLegs(k: Kit, n: number, rTop: number, rFoot: number, h: number, thick: number, m: THREE.Material, turn = 0): THREE.Group {
  const g = new THREE.Group();
  const spread = rFoot - rTop;
  const len = Math.hypot(spread, h);
  const tilt = Math.atan2(spread, h);
  for (let i = 0; i < n; i += 1) {
    const a = turn + (i / n) * Math.PI * 2;
    const mid = rTop + spread / 2;
    g.add(k.group([k.cyl(thick, thick * 0.6, len, m, { rot: [0, 0, tilt], seg: 16 })], { at: [Math.cos(a) * mid, h / 2, Math.sin(a) * mid], rot: [0, -a, 0] }));
  }
  return g;
}

/**
 * A ribbed cactus stem `h` tall and `r` round, standing on y = 0, with a
 * rounded, woolly crown. Down every rib's crest runs a row of areoles: one
 * thread that dips under the skin between them, so only the tufts show.
 */
function cactusStem(k: Kit, r: number, h: number, skin: THREE.Material, crown: THREE.Material, wool: THREE.Material, ribs: number): THREE.Group {
  const bevel = r * 0.12;
  const core = r - bevel;
  const outline: Pt[] = [];
  const n = ribs * 8;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = core * (0.68 + 0.32 * Math.sqrt(Math.abs(Math.cos((a * ribs) / 2))));
    outline.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const body = Math.max(0.02, h - r * 0.35);
  const g = k.group([
    k.extrude(outline, body, skin, { at: [0, body / 2, 0], rot: [-Math.PI / 2, 0, 0], bevel }),
    k.sphere(1, crown, { at: [0, body - r * 0.04, 0], scale: [r * 0.74, r * 0.36, r * 0.74], seg: 24 }),
    k.sphere(r * 0.2, wool, { at: [0, body + r * 0.27, 0], seg: 12 }),
  ]);
  const step = 0.026;
  for (let i = 0; i < ribs; i += 1) {
    const a = (i / ribs) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = -Math.sin(a);
    const pts: V3[] = [];
    const at = (rad: number, y: number): V3 => [dx * rad, y, dz * rad];
    for (let y = 0.012 + (i % 2) * step * 0.5; y < body - 0.006; y += step) {
      pts.push(at(r - 0.007, y - step * 0.32), at(r + 0.0012, y), at(r - 0.007, y + step * 0.32));
    }
    if (pts.length > 2) g.add(k.tube(pts, 0.0026, wool, { seg: pts.length * 4 }));
  }
  return g;
}

/** A flame, `w` wide and `h` tall, standing on `at`. */
const FLAME: Pt[] = [
  [0, 0],
  [0.4, 0.05],
  [0.5, 0.18],
  [0.42, 0.4],
  [0.26, 0.64],
  [0.11, 0.86],
  [0, 1],
];

/** The egg chair's shell: [height, radius] from the bottom (0) to the top (1), for a shell 0.47 m at its widest. */
const EGG: Pt[] = [
  [0, 0],
  [0.05, 0.2],
  [0.12, 0.33],
  [0.25, 0.43],
  [0.42, 0.47],
  [0.6, 0.455],
  [0.75, 0.4],
  [0.88, 0.29],
  [0.96, 0.16],
  [1, 0],
];
function eggR(t: number): number {
  for (let i = 1; i < EGG.length; i += 1)
    if (t <= EGG[i][0]) {
      const [t0, r0] = EGG[i - 1];
      const [t1, r1] = EGG[i];
      const u = (t - t0) / (t1 - t0);
      return r0 + (r1 - r0) * (u * u * (3 - 2 * u) * 0.35 + u * 0.65);
    }
  return 0;
}

export const ROOM_ITEMS: Record<string, ItemModel> = {
  poster: {
    size: [0.5, 0.7, 0.028],
    wall: true,
    build(k, o) {
      const W = 0.5;
      const H = 0.7;
      const D = 0.028;
      const F = 0.02;
      const side = 0.042;
      const top = 0.046;
      const bottom = 0.058;
      const pw = W - 2 * F - 2 * side;
      const ph = H - 2 * F - top - bottom;
      const idea = (o.live.keyIdea ?? "").trim();
      const skill = (o.live.skillTitle ?? "").trim() || "Slope-intercept form";
      const art = canvasTexture(900, Math.round((900 * ph) / pw), (c, w, h) => posterArt(c, w, h, skill, idea || "y = mx + b"));
      const mb = 0.0012;
      const y0 = F + bottom;
      return k.group([
        moulding(k, W, H, F, D, k.paint(o.color ?? "#262421", 0.4)),
        // The mat, its window cut on a bevel that catches the light.
        k.extrude(
          [
            [-W / 2 + F - 0.003, F - 0.003],
            [W / 2 - F + 0.003, F - 0.003],
            [W / 2 - F + 0.003, H - F + 0.003],
            [-W / 2 + F - 0.003, H - F + 0.003],
          ],
          0.003,
          k.paper("#f3f0e8"),
          {
            at: [0, 0, D - 0.008],
            bevel: mb,
            holes: [
              [
                [-pw / 2 - mb, y0 - mb],
                [pw / 2 + mb, y0 - mb],
                [pw / 2 + mb, y0 + ph + mb],
                [-pw / 2 - mb, y0 + ph + mb],
              ],
            ],
          }
        ),
        // The print behind it, and glass in front.
        k.plane(pw + 0.012, ph + 0.012, k.print(art, { roughness: 0.6 }), { at: [0, y0 + ph / 2, D - 0.0105] }),
        k.plane(W - 2 * F + 0.004, H - 2 * F + 0.004, k.glass("#ffffff", 0.06), { at: [0, H / 2, D - 0.004] }),
      ]);
    },
  },

  beanbag: {
    size: [0.95, 0.8, 0.92],
    build(k, o) {
      const cloth = k.velvet(o.color ?? "#5d6a74");
      const g = k.group([
        // The bag, slumped into a wide heap with a hollow where someone sat...
        k.lathe(
          [
            [0, 0],
            [0.3, 0.002],
            [0.4, 0.02],
            [0.452, 0.07],
            [0.472, 0.15],
            [0.462, 0.23],
            [0.43, 0.3],
            [0.37, 0.35],
            [0.28, 0.372],
            [0.15, 0.348],
            [0, 0.338],
          ],
          cloth,
          { seg: 64, scale: [1, 1, 0.95] }
        ),
        // ...pushed up at the back into a broad rest, and at the sides into a soft rim.
        k.sphere(1, cloth, { at: [0, 0.45, -0.2], scale: [0.44, 0.34, 0.25], rot: [-0.32, 0, 0], seg: 48 }),
        k.sphere(1, cloth, { at: [-0.25, 0.35, -0.06], scale: [0.2, 0.16, 0.33], rot: [0.05, 0.5, 0.18], seg: 36 }),
        k.sphere(1, cloth, { at: [0.25, 0.35, -0.06], scale: [0.2, 0.16, 0.33], rot: [0.05, -0.5, -0.18], seg: 36 }),
      ]);
      // Folds where the fabric gathers: down the front, and in the crease under the back.
      const folds: [number, number, number, number][] = [
        [-0.55, 0.2, 0.1, 0.3],
        [-0.15, 0.18, 0.08, 0.32],
        [0.3, 0.2, 0.11, 0.28],
        [0.75, 0.17, 0.08, 0.3],
      ];
      for (const [a, y, len, tilt] of folds) {
        const fold = k.sphere(1, cloth, { at: [0, y, 0.462], scale: [0.012, len, 0.012], rot: [-tilt, 0, 0], seg: 12 });
        g.add(k.group([k.group([fold], { rot: [0, a, 0] })], { scale: [1, 1, 0.95] }));
      }
      g.add(k.sphere(1, cloth, { at: [0, 0.37, -0.035], scale: [0.3, 0.014, 0.014], rot: [0, 0, 0.03], seg: 12 }));
      return g;
    },
  },

  "yoga-mat": {
    size: [1.6, 0.11, 0.61],
    build(k, o) {
      const base = o.color ?? "#7d8e76";
      const L = 1.6;
      const Wm = 0.61;
      const T = 0.006;
      const R = 0.055;
      const x0 = -L / 2;
      const x1 = L / 2 - R;
      const flat = x1 - x0;
      const rubber = k.rubber(base);
      const face = canvasTexture(1024, Math.round((1024 * Wm) / flat), (c, w, h) => {
        c.fillStyle = base;
        c.fillRect(0, 0, w, h);
        // A fine grip texture, and alignment lines printed a shade lighter.
        const rnd = rng(5);
        for (let i = 0; i < 14000; i += 1) {
          const v = rnd() < 0.5 ? 0 : 255;
          c.fillStyle = `rgba(${v},${v},${v},${0.025 + rnd() * 0.04})`;
          c.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
        }
        c.strokeStyle = tint(base, "#ffffff", 0.22);
        c.globalAlpha = 0.4;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(w * 0.03, h / 2);
        c.lineTo(w * 0.97, h / 2);
        for (const fx of [0.22, 0.5, 0.78]) {
          c.moveTo(w * fx, h * 0.22);
          c.lineTo(w * fx, h * 0.78);
        }
        c.stroke();
        c.lineWidth = 2;
        c.strokeRect(w * 0.015, h * 0.045, w * 0.97, h * 0.91);
        c.globalAlpha = 1;
      });
      // The end still rolled, its layers showing.
      const spiral = canvasTexture(256, 256, (c, w) => {
        c.fillStyle = shade(base, 0.82);
        c.fillRect(0, 0, w, w);
        c.strokeStyle = shade(base, 0.52);
        c.lineWidth = 2.5;
        c.beginPath();
        for (let a = 0; a < Math.PI * 2 * 4.2; a += 0.05) {
          const r = 14 + (a / (Math.PI * 2)) * 26;
          const px = w / 2 + Math.cos(a) * r;
          const py = w / 2 + Math.sin(a) * r;
          if (a === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.stroke();
      });
      const ends = k.print(spiral, { roughness: 0.9 });
      return k.group([
        k.box(flat, T, Wm, rubber, { at: [(x0 + x1) / 2, T / 2, 0], r: 0.0025 }),
        k.plane(flat - 0.004, Wm - 0.004, k.print(face, { roughness: 0.85 }), { at: [(x0 + x1) / 2, T + 0.0004, 0], rot: [-Math.PI / 2, 0, 0] }),
        k.cyl(R, R, Wm, rubber, { at: [x1, R, 0], rot: [Math.PI / 2, 0, 0], seg: 40 }),
        k.disc(R - 0.001, ends, { at: [x1, R, Wm / 2 + 0.0006] }),
        k.disc(R - 0.001, ends, { at: [x1, R, -Wm / 2 - 0.0006], rot: [0, Math.PI, 0] }),
        // A cork block, and a hand towel folded at the far end.
        k.box(0.23, 0.075, 0.15, k.print(corkPicture(256, 256, 3), { roughness: 0.9 }), { at: [x0 + 0.3, T + 0.0375, -0.13], rot: [0, 0.35, 0], r: 0.008 }),
        k.box(0.27, 0.032, 0.17, k.fabric("#e8e4dc", { repeat: [2, 2] }), { at: [x0 + 0.2, T + 0.016, 0.13], rot: [0, -0.12, 0], r: 0.012 }),
        k.box(0.27, 0.012, 0.004, k.fabric("#c9c2b4"), { at: [x0 + 0.2 + 0.01, T + 0.012, 0.13 + 0.086], rot: [0, -0.12, 0], r: 0.002 }),
      ]);
    },
  },

  "homework-station": {
    size: [1.0, 1.62, 0.55],
    light: { at: [0, 1.25, 0.0], color: "#fff0d8", intensity: 1.2, distance: 2.4 },
    build(k, o) {
      const paint = k.paint(o.color ?? "#e8e4dc", 0.4);
      const oak = k.wood("oak", { gloss: 0.5 });
      const W = 1.0;
      const D = 0.55;
      const topY = 0.75;
      const back = -D / 2;
      const skill = (o.live.skillTitle ?? "").trim() || "Algebra 1";
      const idea = (o.live.keyIdea ?? "").trim() || "Show every step.";
      const peg = canvasTexture(1024, 534, (c, w, h) => {
        c.fillStyle = "#efe8dc";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(60,45,30,0.75)";
        const s = w / 38;
        for (let x = s / 2; x < w; x += s)
          for (let y = s / 2; y < h; y += s) {
            c.beginPath();
            c.arc(x, y, 3.2, 0, Math.PI * 2);
            c.fill();
          }
      });
      const sheet = canvasTexture(420, 560, (c, w, h) => {
        c.fillStyle = "#fbfaf6";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#222";
        c.font = `700 30px ${SANS}`;
        c.fillText("Homework", 28, 52);
        c.font = `400 18px ${SANS}`;
        c.fillText("Name ________________   Date ______", 28, 84);
        const t = fitText(c, skill, (px) => `600 ${px}px ${SANS}`, w - 56, 1, 22, 14);
        c.font = `600 ${t.px}px ${SANS}`;
        c.fillText(t.lines[0], 28, 122);
        c.font = `400 18px ${SANS}`;
        for (let i = 0; i < 6; i += 1) {
          c.fillText(`${i + 1}.`, 28, 172 + i * 62);
          c.fillStyle = "rgba(0,0,0,0.25)";
          c.fillRect(56, 178 + i * 62, w - 84, 1.5);
          c.fillStyle = "#222";
        }
        c.fillStyle = "#4a4f57";
        c.font = `24px ${PEN}`;
        scrawl(c, "2x + 3 = 11", 64, 172, -0.01);
        scrawl(c, "2x = 8,  x = 4", 64, 234, 0.008);
      });
      const pages = canvasTexture(840, 560, (c, w, h) => {
        c.fillStyle = "#fbfaf5";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(90,130,200,0.35)";
        for (let y = 70; y < h - 10; y += 30) c.fillRect(0, y, w, 1.5);
        c.fillStyle = "rgba(205,70,70,0.45)";
        c.fillRect(60, 0, 2, h);
        c.fillRect(w / 2 + 60, 0, 2, h);
        const fold = c.createLinearGradient(w / 2 - 30, 0, w / 2 + 30, 0);
        fold.addColorStop(0, "rgba(0,0,0,0)");
        fold.addColorStop(0.5, "rgba(0,0,0,0.18)");
        fold.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = fold;
        c.fillRect(w / 2 - 30, 0, 60, h);
        c.fillStyle = "#3d424a";
        const t = fitText(c, skill, (px) => `${px}px ${PEN}`, w / 2 - 100, 1, 30, 18);
        c.font = `${t.px}px ${PEN}`;
        scrawl(c, t.lines[0], 72, 62, -0.01);
        const lines = fitText(c, idea, (px) => `${px}px ${PEN}`, w / 2 - 100, 5, 24, 16);
        c.font = `${lines.px}px ${PEN}`;
        lines.lines.forEach((line, i) => scrawl(c, line, 72, 124 + i * 30, (i % 2 ? -1 : 1) * 0.006));
        // A sketched graph on the right page.
        c.strokeStyle = "#3d424a";
        c.lineWidth = 2.5;
        const gx = w / 2 + 140;
        const gy = 360;
        c.beginPath();
        c.moveTo(gx - 40, gy);
        c.lineTo(gx + 230, gy);
        c.moveTo(gx, gy + 40);
        c.lineTo(gx, gy - 230);
        c.stroke();
        c.strokeStyle = "#2c56b0";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(gx - 30, gy + 15);
        c.lineTo(gx + 210, gy - 190);
        c.stroke();
      });
      const calc = canvasTexture(170, 360, (c, w, h) => {
        c.fillStyle = "#2b2e33";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#b9c4b0";
        c.fillRect(16, 18, w - 32, 96);
        c.fillStyle = "#33392f";
        c.font = `600 22px ${SANS}`;
        c.textAlign = "right";
        c.fillText("y=0.5x+1", w - 24, 100);
        for (let r = 0; r < 7; r += 1)
          for (let q = 0; q < 5; q += 1) {
            c.fillStyle = r === 0 ? "#5f6670" : q === 4 ? "#3f6db3" : "#41464e";
            c.fillRect(14 + q * 29, 136 + r * 31, 24, 22);
          }
      });
      const g = k.group([
        k.box(W, 0.028, D, oak, { at: [0, topY - 0.014, 0], r: 0.005 }),
        ...k.legs(W - 0.06, D - 0.06, topY - 0.028, paint, { r: 0.019, inset: 0 }).children,
        // An apron with a drawer.
        k.box(W - 0.12, 0.07, D - 0.1, paint, { at: [0, topY - 0.063, -0.01], r: 0.004 }),
        k.box(0.42, 0.056, 0.014, paint, { at: [0, topY - 0.063, D / 2 - 0.053], r: 0.004 }),
        k.sphere(0.011, k.metal("brass"), { at: [0, topY - 0.063, D / 2 - 0.038] }),
        // The hutch: a pegboard back, two sides, a shelf, and a light under it.
        k.box(W, 0.56, 0.016, paint, { at: [0, topY + 0.28, back + 0.008], r: 0.003 }),
        k.plane(W - 0.05, 0.5, k.print(peg, { roughness: 0.8 }), { at: [0, topY + 0.28, back + 0.0165] }),
        k.box(0.018, 0.58, 0.24, paint, { at: [-W / 2 + 0.009, topY + 0.29, back + 0.12], r: 0.004 }),
        k.box(0.018, 0.58, 0.24, paint, { at: [W / 2 - 0.009, topY + 0.29, back + 0.12], r: 0.004 }),
        k.box(W, 0.02, 0.25, paint, { at: [0, topY + 0.59, back + 0.125], r: 0.004 }),
        k.box(0.62, 0.012, 0.03, k.metal("silver"), { at: [0, topY + 0.574, back + 0.17], r: 0.003 }),
        k.box(0.6, 0.002, 0.018, k.glow("#fff3dc", o.on, 2.4), { at: [0, topY + 0.5675, back + 0.17] }),
        // On the pegboard: a ruler on two pegs and a clipboard with tonight's sheet.
        k.cyl(0.003, 0.003, 0.04, k.metal("silver"), { at: [-0.33, topY + 0.43, back + 0.036], rot: [Math.PI / 2, 0, 0] }),
        k.cyl(0.003, 0.003, 0.04, k.metal("silver"), { at: [-0.05, topY + 0.43, back + 0.036], rot: [Math.PI / 2, 0, 0] }),
        k.box(0.32, 0.034, 0.003, k.wood("maple", { gloss: 0.4 }), { at: [-0.19, topY + 0.412, back + 0.022], r: 0.001 }),
        k.box(0.23, 0.31, 0.004, k.wood("#8a6a48", { gloss: 0.3 }), { at: [0.27, topY + 0.25, back + 0.024], r: 0.004 }),
        k.plane(0.205, 0.27, k.print(sheet, { roughness: 0.9 }), { at: [0.27, topY + 0.24, back + 0.0265] }),
        k.box(0.08, 0.026, 0.014, k.metal("steel"), { at: [0.27, topY + 0.39, back + 0.031], r: 0.004 }),
        // On the desk: open notes, a pencil, a calculator, a cup of pens and a sticky note.
        k.box(0.42, 0.01, 0.28, k.paper("#2f3b4d"), { at: [-0.2, topY + 0.005, 0.06], rot: [0, 0.08, 0], r: 0.002 }),
        k.plane(0.4, 0.266, k.print(pages, { roughness: 0.9 }), { at: [-0.2, topY + 0.0108, 0.06], rot: [-Math.PI / 2, 0, 0.08] }),
        k.cyl(0.0035, 0.0035, 0.17, k.paint("#e3b23c", 0.5), { at: [0.03, topY + 0.0045, 0.13], rot: [0, 0.5, Math.PI / 2] }),
        k.box(0.085, 0.018, 0.18, k.plastic("#2b2e33", 0.4), { at: [0.2, topY + 0.009, 0.1], rot: [0, -0.25, 0], r: 0.006 }),
        k.plane(0.08, 0.172, k.print(calc, { roughness: 0.5 }), { at: [0.2, topY + 0.0185, 0.1], rot: [-Math.PI / 2, 0, -0.25] }),
        k.cyl(0.034, 0.03, 0.1, k.ceramic("#2f4f6f"), { at: [0.38, topY + 0.05, -0.13] }),
        k.cyl(0.004, 0.004, 0.16, k.paint("#e3b23c", 0.5), { at: [0.37, topY + 0.13, -0.13], rot: [0.12, 0, 0.1] }),
        k.cyl(0.005, 0.005, 0.15, k.plastic("#1f3f8f"), { at: [0.39, topY + 0.125, -0.12], rot: [-0.1, 0, -0.12] }),
        k.cyl(0.005, 0.005, 0.14, k.plastic("#1e1e1e"), { at: [0.385, topY + 0.12, -0.145], rot: [-0.18, 0, 0.05] }),
        k.box(0.076, 0.01, 0.076, k.paper("#f4dc6a"), { at: [0.06, topY + 0.005, -0.1], rot: [0, 0.3, 0], r: 0.001 }),
      ]);
      // Books and a snake plant on the shelf.
      const row = bookRow(k, 5, 11, [0.16, 0.21], [0.14, 0.18]);
      row.position.set(-W / 2 + 0.03, topY + 0.6, back + 0.12);
      g.add(row);
      g.add(k.lathe([[0, 0], [0.045, 0], [0.05, 0.075], [0.053, 0.08], [0.045, 0.08], [0.044, 0.07]], k.ceramic("#f1ede6"), { at: [0.38, topY + 0.6, back + 0.13], seg: 28 }));
      g.add(k.cyl(0.044, 0.044, 0.006, k.soil(), { at: [0.38, topY + 0.672, back + 0.13] }));
      const rnd = rng(9);
      for (let i = 0; i < 5; i += 1) {
        const a = i * 1.3;
        const lh = 0.07 + rnd() * 0.055;
        g.add(k.sphere(1, k.leaf(i % 2 ? 3 : 0), { at: [0.38 + Math.cos(a) * 0.014, topY + 0.672 + lh * 0.92, back + 0.13 + Math.sin(a) * 0.014], scale: [0.013, lh, 0.004], rot: [Math.sin(a) * 0.15, a, Math.cos(a) * 0.15] }));
      }
      return g;
    },
  },

  whiteboard: {
    size: [0.9, 0.64, 0.072],
    wall: true,
    build(k, o) {
      const W = 0.9;
      const H = 0.6;
      const D = 0.022;
      const F = 0.016;
      const y0 = 0.036;
      const iw = W - 2 * F;
      const ih = H - 2 * F;
      const frame = o.color ? k.paint(o.color, 0.5) : k.metal("silver", 0.32);
      const title = (o.live.skillTitle ?? "").trim() || "Algebra 1";
      const idea = (o.live.keyIdea ?? "").trim() || "Pick a skill and start practicing.";
      const goal = `${Math.min(o.live.goalRight, o.live.goalTarget)} of ${o.live.goalTarget} right`;
      const board = canvasTexture(1600, Math.round((1600 * ih) / iw), (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, "#fdfdfc");
        bg.addColorStop(0.55, "#f2f3f2");
        bg.addColorStop(1, "#fafaf9");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        // Ghosts of last week's notes, never quite wiped off.
        const rnd = rng(23);
        c.lineCap = "round";
        for (let i = 0; i < 10; i += 1) {
          c.strokeStyle = `rgba(90,100,120,${0.03 + rnd() * 0.03})`;
          c.lineWidth = 5 + rnd() * 9;
          c.beginPath();
          let x = rnd() * w;
          let y = rnd() * h;
          c.moveTo(x, y);
          for (let j = 0; j < 7; j += 1) {
            x += (rnd() - 0.3) * 110;
            y += (rnd() - 0.5) * 36;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        const pad = w * 0.05;
        const split = w * 0.66;
        c.textBaseline = "alphabetic";
        c.lineCap = "round";
        c.lineJoin = "round";
        // The skill, in blue, underlined.
        c.fillStyle = "#1d4aa8";
        const t = fitText(c, title, (px) => `${px}px ${MARKER}`, w - pad * 2, 1, 112, 56);
        c.font = `${t.px}px ${MARKER}`;
        const ty = pad + t.px * 0.85;
        scrawl(c, t.lines[0], pad, ty, -0.012);
        const tw = Math.min(w - 2 * pad, c.measureText(t.lines[0]).width);
        c.strokeStyle = "#1d4aa8";
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(pad, ty + 26);
        c.quadraticCurveTo(pad + tw / 2, ty + 36, pad + tw, ty + 14);
        c.stroke();
        // The key idea, in black, boxed in red.
        const ky = ty + 130;
        c.fillStyle = "#c22f2a";
        c.font = `54px ${MARKER}`;
        scrawl(c, "Key idea:", pad, ky, 0.01);
        c.fillStyle = "#23262b";
        const body = fitText(c, idea, (px) => `${px}px ${MARKER}`, split - pad - 90, 5, 96, 40, h - ky - 120, 1.18);
        c.font = `${body.px}px ${MARKER}`;
        let y = ky + body.px * 1.3;
        let widest = 0;
        body.lines.forEach((line, i) => {
          scrawl(c, line, pad + 36, y, (i % 2 ? -1 : 1) * 0.008);
          widest = Math.max(widest, c.measureText(line).width);
          y += body.px * 1.18;
        });
        c.strokeStyle = "#c22f2a";
        c.lineWidth = 6;
        c.beginPath();
        const bx0 = pad + 8;
        const by0 = ky + 26;
        const bx1 = pad + 66 + widest;
        const by1 = y - body.px * 0.62;
        c.moveTo(bx0, by0 + 4);
        c.lineTo(bx1, by0 - 5);
        c.lineTo(bx1 + 7, by1);
        c.lineTo(bx0 - 5, by1 + 7);
        c.closePath();
        c.stroke();
        // Today, in green: a tally of right answers, and the streak.
        const right = Math.max(0, Math.floor(o.live.goalRight));
        const rx = split + 30;
        c.fillStyle = "#2c7a43";
        c.strokeStyle = "#2c7a43";
        c.font = `64px ${MARKER}`;
        scrawl(c, "Today", rx, ty + 150, -0.01);
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(rx, ty + 170);
        c.lineTo(rx + 170, ty + 166);
        c.stroke();
        c.lineWidth = 8;
        for (let i = 0; i < Math.min(right, 20); i += 1) {
          const grp = Math.floor(i / 5);
          const gx = rx + (grp % 2) * 170 + 6;
          const gy = ty + 220 + Math.floor(grp / 2) * 120;
          c.beginPath();
          if (i % 5 === 4) {
            c.moveTo(gx - 10, gy + 74);
            c.lineTo(gx + 4 * 30 + 6, gy + 8);
          } else {
            c.moveTo(gx + (i % 5) * 30, gy + 4);
            c.lineTo(gx + (i % 5) * 30 + 4, gy + 84);
          }
          c.stroke();
        }
        c.font = `46px ${MARKER}`;
        scrawl(c, goal, rx, h - pad * 2.1, -0.012);
        if (o.live.streak > 0) scrawl(c, `Streak: ${o.live.streak} ${o.live.streak === 1 ? "day" : "days"}`, rx, h - pad * 1.05, 0.01);
      });
      const g = k.group([
        k.box(iw + 0.006, ih + 0.006, 0.008, k.paint("#f1f1ef"), { at: [0, y0 + H / 2, 0.006] }),
        k.plane(iw + 0.002, ih + 0.002, k.print(board, { roughness: 0.18 }), { at: [0, y0 + H / 2, 0.0102] }),
        moulding(k, W, H, F, D, frame, y0, 0.002),
      ]);
      // Grey corner caps.
      for (const sx of [-1, 1])
        for (const sy of [0, 1]) g.add(k.box(0.03, 0.03, D + 0.004, k.plastic("#8f9398", 0.3), { at: [sx * (W / 2 - 0.013), y0 + 0.013 + sy * (H - 0.026), D / 2], r: 0.006 }));
      // The marker tray: a ledge with a lip, three markers and an eraser.
      const alu = k.metal("silver", 0.36);
      g.add(k.box(0.6, 0.006, 0.062, alu, { at: [0, 0.006, 0.035], r: 0.002 }));
      g.add(k.box(0.6, 0.03, 0.004, alu, { at: [0, 0.02, 0.006], r: 0.0015 }));
      g.add(k.box(0.6, 0.02, 0.004, alu, { at: [0, 0.016, 0.064], r: 0.0015 }));
      for (const sx of [-1, 1]) g.add(k.box(0.008, 0.024, 0.066, k.plastic("#8f9398", 0.3), { at: [sx * 0.302, 0.015, 0.035], r: 0.002 }));
      ["#1e1f22", "#1d4aa8", "#c22f2a"].forEach((ink, i) => {
        const x = -0.2 + i * 0.075;
        const z = 0.024 + i * 0.012;
        g.add(k.cyl(0.0085, 0.0085, 0.1, k.plastic("#ecebe7", 0.5), { at: [x, 0.0175, z], rot: [0, 0.06 * (i - 1), Math.PI / 2] }));
        g.add(k.cyl(0.0095, 0.0095, 0.038, k.plastic(ink, 0.5), { at: [x + 0.068, 0.0175, z], rot: [0, 0.06 * (i - 1), Math.PI / 2] }));
      });
      g.add(k.box(0.12, 0.022, 0.048, k.plastic("#26282c", 0.4), { at: [0.17, 0.027, 0.036], r: 0.008 }));
      g.add(k.box(0.118, 0.01, 0.046, k.fabric("#8c8f93"), { at: [0.17, 0.013, 0.036], r: 0.002 }));
      return g;
    },
  },

  cactus: {
    size: [0.34, 0.86, 0.26],
    build(k, o) {
      const grow = clamp01(o.live.growth);
      const thirsty = o.live.thirsty;
      const pot = o.color ? k.ceramic(o.color) : k.stone("terracotta");
      const skin = k.paint(thirsty ? "#7d8350" : "#4a6b4f", 0.22);
      const crown = k.paint(thirsty ? "#8e9060" : "#6a8c58", 0.22);
      const wool = k.fabric("#d9cfb7", { repeat: [1, 1] });
      const g = k.group([
        // A terracotta pot with a rolled rim, topped with grit.
        k.lathe(
          [
            [0, 0],
            [0.074, 0],
            [0.078, 0.008],
            [0.09, 0.14],
            [0.104, 0.142],
            [0.106, 0.178],
            [0.096, 0.18],
            [0.093, 0.165],
          ],
          pot,
          { seg: 40 }
        ),
        k.cyl(0.093, 0.093, 0.008, k.stone("sandstone"), { at: [0, 0.162, 0], seg: 32 }),
      ]);
      const rnd = rng(31);
      for (let i = 0; i < 8; i += 1) {
        const a = rnd() * Math.PI * 2;
        const r = 0.035 + rnd() * 0.045;
        g.add(k.sphere(1, i % 2 ? k.stone("granite") : k.ceramic("#d9d2c4"), { at: [Math.cos(a) * r, 0.167, Math.sin(a) * r], scale: [0.009 + rnd() * 0.006, 0.005, 0.008 + rnd() * 0.005], seg: 10 }));
      }
      // The cactus: taller and branching with every goal reached.
      const plant = new THREE.Group();
      const H = 0.2 + 0.44 * grow;
      const R = 0.042 + 0.012 * grow;
      plant.add(cactusStem(k, R, H, skin, crown, wool, 8));
      const arms: { at: number; turn: number; t: number }[] = [
        { at: 0.4, turn: 0.3, t: clamp01((grow - 0.3) / 0.5) },
        { at: 0.55, turn: Math.PI - 0.25, t: clamp01((grow - 0.55) / 0.4) },
        { at: 0.3, turn: -2.25, t: clamp01((grow - 0.8) / 0.2) },
      ];
      for (const arm of arms) {
        if (arm.t <= 0) continue;
        const ra = R * 0.64;
        const out = R + ra * 1.15;
        const len = 0.05 + 0.17 * arm.t;
        const branch = k.group([
          k.tube(
            [
              [0, 0, 0],
              [out * 0.55, -0.004, 0],
              [out, ra * 0.7, 0],
              [out, ra * 2.0, 0],
            ],
            ra * 0.86,
            skin,
            { seg: 24 }
          ),
        ]);
        const stem = cactusStem(k, ra, len, skin, crown, wool, 7);
        stem.position.set(out, ra * 1.7, 0);
        branch.add(stem);
        branch.position.y = H * arm.at;
        branch.rotation.y = arm.turn;
        plant.add(branch);
      }
      plant.position.y = 0.162;
      // Three days without practice: it leans, shrivels and yellows.
      if (thirsty) {
        plant.rotation.set(0.05, 0, -0.17);
        plant.scale.set(0.9, 0.97, 0.9);
      }
      g.add(plant);
      return g;
    },
  },

  "window-plant": {
    size: [0.44, 0.96, 0.25],
    wall: true,
    build(k, o) {
      const grow = clamp01(o.live.growth);
      const thirsty = o.live.thirsty;
      const iron = k.metal("black");
      const rope = k.fabric("#e4d9c4", { repeat: [1, 8] });
      const top = 0.96;
      const zc = 0.13;
      const ringY = top - 0.075;
      const potY = 0.5;
      const potR = 0.074;
      const potH = 0.115;
      const g = k.group([
        // A wall bracket: a plate, an arm with a scroll at its end, a brace, and a hook.
        k.box(0.03, 0.14, 0.008, iron, { at: [0, top - 0.07, 0.004], r: 0.002 }),
        k.box(0.014, 0.014, zc + 0.03, iron, { at: [0, top - 0.007, (zc + 0.03) / 2 + 0.006], r: 0.003 }),
        k.tube(
          [
            [0, top - 0.132, 0.008],
            [0, top - 0.075, 0.055],
            [0, top - 0.016, 0.105],
          ],
          0.0042,
          iron,
          { seg: 12 }
        ),
        k.torus(0.011, 0.0035, iron, { at: [0, top - 0.018, zc + 0.034], rot: [0, Math.PI / 2, 0], arc: Math.PI * 1.5 }),
        k.torus(0.011, 0.003, iron, { at: [0, top - 0.024, zc], rot: [0, Math.PI / 2, Math.PI * 0.9], arc: Math.PI * 1.3 }),
        // A wooden ring where the macrame cords meet.
        k.torus(0.014, 0.0035, k.wood("#c8a77a", { gloss: 0.3 }), { at: [0, ringY, zc], rot: [0, Math.PI / 2, 0] }),
        // The pot, and its soil.
        k.lathe(
          [
            [0, 0],
            [0.048, 0],
            [0.057, 0.008],
            [0.068, 0.055],
            [potR, potH - 0.008],
            [potR + 0.002, potH],
            [potR - 0.006, potH],
            [potR - 0.008, potH - 0.014],
          ],
          k.ceramic(o.color ?? "#ece7de"),
          { at: [0, potY, zc], seg: 40 }
        ),
        k.cyl(potR - 0.008, potR - 0.01, 0.008, k.soil(), { at: [0, potY + potH - 0.012, zc] }),
      ]);
      // Three cords from the ring, down round the pot, gathered in a knot and a tassel under it.
      for (let i = 0; i < 3; i += 1) {
        const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        g.add(
          k.tube(
            [
              [0, ringY - 0.01, zc],
              [cx * 0.035, ringY - 0.12, zc + cz * 0.035],
              [cx * (potR + 0.006), potY + potH + 0.012, zc + cz * (potR + 0.006)],
              [cx * (potR - 0.002), potY + 0.055, zc + cz * (potR - 0.002)],
              [cx * 0.04, potY - 0.012, zc + cz * 0.04],
              [0, potY - 0.045, zc],
            ],
            0.0034,
            rope,
            { seg: 48 }
          )
        );
      }
      g.add(k.cyl(0.011, 0.011, 0.024, rope, { at: [0, potY - 0.056, zc] }));
      g.add(
        k.lathe(
          [
            [0, 0],
            [0.018, 0.002],
            [0.015, 0.05],
            [0.01, 0.09],
            [0, 0.092],
          ],
          rope,
          { at: [0, potY - 0.16, zc], seg: 20 }
        )
      );
      // A golden pothos: vines trail down further with every goal reached.
      const leafLen = 0.055;
      const rnd = rng(13);
      const droop = thirsty ? 0.35 : 0;
      const vines = [0.1, 0.85, 1.57, 2.3, 3.04];
      vines.forEach((a, vi) => {
        const ox = Math.cos(a);
        const oz = Math.sin(a);
        const len = (0.08 + 0.4 * grow) * [0.8, 1.15, 0.95, 1.08, 0.72][vi] + 0.03;
        const lip: V3 = [ox * (potR + 0.012), potY + potH + 0.012, zc + oz * (potR + 0.012)];
        const pts: V3[] = [[ox * (potR - 0.02), potY + potH, zc + oz * (potR - 0.02)], lip];
        const steps = 5;
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          const sway = Math.sin(t * 3 + vi * 1.7) * 0.022;
          const outward = potR + 0.018 + t * 0.012;
          pts.push([ox * outward - oz * sway, lip[1] - t * len, zc + oz * outward + ox * sway * 0.4]);
        }
        g.add(k.tube(pts, 0.0018, k.leaf(3), { seg: 32 }));
        const leaves = 2 + Math.round(grow * 6);
        for (let i = 0; i < leaves; i += 1) {
          const t = 0.22 + (i / Math.max(1, leaves - 1)) * 0.78;
          const [px, py, pz] = along(pts, t);
          const side = i % 2 ? 1 : -1;
          const holder = new THREE.Group();
          holder.position.set(px, py, pz);
          holder.rotation.y = Math.PI / 2 - a;
          const leaf = k.extrude(heartLeaf(leafLen), 0.0014, k.leaf(i % 3 === 0 ? 4 : i % 2), { bevel: 0.0004 });
          const s = (1.08 - 0.42 * t) * (0.85 + rnd() * 0.3);
          leaf.scale.set(s, s, 1);
          const tilt = new THREE.Group();
          tilt.rotation.set(-0.45 + droop + rnd() * 0.25, 0, side * (0.55 + rnd() * 0.4));
          tilt.add(leaf);
          tilt.position.set(0, -0.004, 0.006);
          holder.add(tilt);
          g.add(holder);
        }
      });
      // Leaves standing up and spilling over the rim.
      for (let i = 0; i < 7; i += 1) {
        const a = -0.3 + i * 0.92;
        const holder = new THREE.Group();
        holder.position.set(Math.cos(a) * 0.035, potY + potH + 0.004, zc + Math.sin(a) * 0.035);
        holder.rotation.y = Math.PI / 2 - a;
        const leaf = k.extrude(heartLeaf(leafLen), 0.0014, k.leaf(i % 2 ? 1 : 4), { bevel: 0.0004 });
        const tilt = new THREE.Group();
        tilt.rotation.set(Math.PI - 0.95 - (i % 3) * 0.25 - droop * 0.5, 0, (i % 2 ? 1 : -1) * 0.3);
        tilt.add(leaf);
        holder.add(tilt);
        g.add(holder);
      }
      return g;
    },
  },

  "floor-cushion": {
    size: [0.6, 0.17, 0.6],
    build(k, o) {
      const cloth = k.velvet(o.color ?? "#9a5b45");
      const S = 0.6;
      const g = k.group([
        // A boxed cushion: a firm base, a plump top, piping round the top edge.
        k.box(S, 0.075, S, cloth, { at: [0, 0.0375, 0], r: 0.032 }),
        k.cushion(S - 0.004, 0.115, S - 0.004, cloth, { at: [0, 0.095, 0] }),
        k.tube(loop(S / 2 - 0.014, S / 2 - 0.014, 0.036, 0.142), 0.0055, cloth, { seg: 160 }),
        // A strap stitched to one side, to carry it by.
        k.box(0.14, 0.026, 0.008, cloth, { at: [0, 0.075, S / 2 + 0.006], r: 0.003 }),
        k.box(0.012, 0.03, 0.01, cloth, { at: [-0.07, 0.075, S / 2 + 0.003], r: 0.003 }),
        k.box(0.012, 0.03, 0.01, cloth, { at: [0.07, 0.075, S / 2 + 0.003], r: 0.003 }),
      ]);
      // Five tufts, each a covered button pulled into the top.
      for (const [x, z] of [
        [0, 0],
        [-0.15, -0.15],
        [0.15, -0.15],
        [-0.15, 0.15],
        [0.15, 0.15],
      ]) {
        const swell = (1 - (x / (S / 2)) ** 2) * (1 - (z / (S / 2)) ** 2);
        g.add(k.sphere(1, cloth, { at: [x, 0.0955 + 0.0575 + swell * 0.0138 - 0.002, z], scale: [0.016, 0.006, 0.016], seg: 16 }));
      }
      return g;
    },
  },

  "wall-shelf": {
    size: [0.8, 0.36, 0.22],
    wall: true,
    build(k, o) {
      const board = o.color ? k.paint(o.color, 0.4) : k.wood("oak", { gloss: 0.45 });
      const T = 0.036;
      const g = k.group([k.box(0.8, T, 0.22, board, { at: [0, T / 2, 0.11], r: 0.004 })]);
      // Books at the left end.
      const row = bookRow(k, 5, 23, [0.17, 0.22], [0.13, 0.16]);
      row.position.set(-0.385, T, 0.1);
      g.add(row);
      // A succulent in a small white pot.
      const sx = -0.13;
      g.add(k.lathe([[0, 0], [0.036, 0], [0.042, 0.008], [0.046, 0.06], [0.04, 0.06], [0.039, 0.052]], k.ceramic("#efebe4"), { at: [sx, T, 0.11], seg: 28 }));
      g.add(k.cyl(0.039, 0.039, 0.004, k.soil(), { at: [sx, T + 0.054, 0.11] }));
      const rosette = k.paint("#83a593", 0.35);
      for (let i = 0; i < 13; i += 1) {
        const ring = i < 8 ? 0 : 1;
        const a = i * 2.4;
        const len = ring ? 0.018 : 0.027;
        const holder = new THREE.Group();
        holder.position.set(sx, T + 0.06, 0.11);
        holder.rotation.y = a;
        holder.add(k.sphere(1, rosette, { at: [0, 0.004 + ring * 0.006, len * 0.8], scale: [0.012, 0.006, len], rot: [ring ? -0.6 : -0.25, 0, 0] }));
        g.add(holder);
      }
      // A small framed photo leaning on the wall.
      const photo = canvasTexture(240, 300, (c, w, h) => {
        const sky = c.createLinearGradient(0, 0, 0, h * 0.6);
        sky.addColorStop(0, "#7fa6c9");
        sky.addColorStop(1, "#e7d3b5");
        c.fillStyle = sky;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#5d6b78";
        c.beginPath();
        c.moveTo(0, h * 0.55);
        c.lineTo(w * 0.3, h * 0.36);
        c.lineTo(w * 0.48, h * 0.48);
        c.lineTo(w * 0.7, h * 0.3);
        c.lineTo(w, h * 0.5);
        c.lineTo(w, h * 0.62);
        c.lineTo(0, h * 0.62);
        c.fill();
        const lake = c.createLinearGradient(0, h * 0.6, 0, h);
        lake.addColorStop(0, "#6f8fa8");
        lake.addColorStop(1, "#33495c");
        c.fillStyle = lake;
        c.fillRect(0, h * 0.6, w, h * 0.4);
        c.fillStyle = "#2f3b2a";
        c.fillRect(0, h * 0.58, w, h * 0.04);
      });
      const frame = k.group([moulding(k, 0.13, 0.17, 0.012, 0.014, k.wood("walnut", { gloss: 0.5 }), 0, 0.0015), k.plane(0.108, 0.148, k.print(photo, { roughness: 0.35 }), { at: [0, 0.085, 0.009] })]);
      frame.position.set(0.02, T, 0.03);
      frame.rotation.x = -0.12;
      g.add(frame);
      // Two books flat, a candle in an amber jar on top.
      g.add(k.box(0.15, 0.028, 0.2, k.paper("#2f4f6f"), { at: [0.19, T + 0.014, 0.11], rot: [0, 0.06, 0], r: 0.003 }));
      g.add(k.box(0.14, 0.024, 0.19, k.paper("#c9b79c"), { at: [0.19, T + 0.04, 0.115], rot: [0, -0.08, 0], r: 0.003 }));
      g.add(k.lathe([[0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.075], [0.033, 0.078], [0.032, 0.006], [0, 0.006]], k.glass("#c98a3a", 0.5), { at: [0.19, T + 0.052, 0.11], seg: 28 }));
      g.add(k.cyl(0.031, 0.031, 0.045, k.paint("#efe6d4", 0.3), { at: [0.19, T + 0.052 + 0.028, 0.11] }));
      g.add(k.cyl(0.0012, 0.0012, 0.01, k.paint("#222"), { at: [0.19, T + 0.052 + 0.055, 0.11] }));
      // A stoneware vase of dried bunny-tail grass.
      const vx = 0.33;
      g.add(k.lathe([[0, 0], [0.032, 0], [0.042, 0.03], [0.04, 0.08], [0.022, 0.12], [0.02, 0.14], [0.024, 0.145], [0.018, 0.145], [0.016, 0.12]], k.ceramic("#d8cbb6"), { at: [vx, T, 0.11], seg: 32 }));
      const tuft = k.velvet("#efe6d2");
      const stalk = k.wood("#c7ae84", { gloss: 0.2 });
      [
        [-0.42, 0.13, -0.01],
        [-0.2, 0.17, 0.012],
        [0.02, 0.19, -0.006],
        [0.2, 0.16, 0.01],
        [0.4, 0.12, -0.012],
        [0.1, 0.14, 0.018],
      ].forEach(([lean, len, dz]) => {
        const mid: V3 = [vx + Math.sin(lean) * len * 0.45, T + 0.12 + Math.cos(lean) * len * 0.5, 0.11 + dz * 0.5];
        const tip: V3 = [vx + Math.sin(lean) * len * 1.05, T + 0.12 + Math.cos(lean) * len, 0.11 + dz];
        g.add(k.tube([[vx, T + 0.1, 0.11], mid, tip], 0.0013, stalk, { seg: 10 }));
        g.add(k.sphere(1, tuft, { at: [tip[0] + Math.sin(lean) * 0.016, tip[1] + Math.cos(lean) * 0.016, tip[2]], scale: [0.011, 0.024, 0.011], rot: [0, 0, -lean], seg: 16 }));
      });
      return g;
    },
  },

  "string-lights": {
    size: [1.66, 0.31, 0.05],
    wall: true,
    light: { at: [0, 0.12, 0.2], color: "#ffbf73", intensity: 1.6, distance: 3.2 },
    build(k, o) {
      const wire = k.plastic("#2a2c26", 0.3);
      const bulb = k.glow(o.color ?? "#ffc677", o.on, 2.6);
      const cap = k.plastic("#33352f", 0.3);
      const brass = k.metal("brass");
      const pins = [-0.78, -0.26, 0.26, 0.78];
      const top = 0.3;
      const sags = [0.21, 0.25, 0.2];
      const g = k.group([]);
      for (const x of pins) g.add(k.cyl(0.006, 0.006, 0.004, brass, { at: [x, top + 0.004, 0.002], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      const hang = (x: number, y: number, z: number) => {
        g.add(k.cyl(0.0045, 0.0045, 0.008, cap, { at: [x, y - 0.004, z], seg: 10 }));
        g.add(k.sphere(0.0105, bulb, { at: [x, y - 0.017, z], seg: 14 }));
      };
      for (let i = 0; i < 3; i += 1) {
        const xa = pins[i];
        const xb = pins[i + 1];
        const at = (u: number): V3 => {
          const s = 1 - (2 * u - 1) ** 2;
          return [xa + (xb - xa) * u, top - sags[i] * s, 0.006 + 0.022 * s];
        };
        const pts: V3[] = [];
        for (let j = 0; j <= 12; j += 1) pts.push(at(j / 12));
        g.add(k.tube(pts, 0.0016, wire, { seg: 48 }));
        for (let j = 1; j <= 7; j += 1) hang(...at(j / 8));
      }
      // A tail at the left end, and the lead down to a battery box at the right.
      g.add(
        k.tube(
          [
            [pins[0], top, 0.004],
            [pins[0] - 0.012, top - 0.05, 0.008],
            [pins[0] - 0.01, top - 0.11, 0.01],
          ],
          0.0016,
          wire,
          { seg: 12 }
        )
      );
      hang(pins[0] - 0.01, top - 0.11, 0.01);
      hang(pins[0] - 0.013, top - 0.055, 0.008);
      g.add(
        k.tube(
          [
            [pins[3], top, 0.004],
            [pins[3] + 0.02, top - 0.08, 0.008],
            [pins[3] + 0.025, top - 0.17, 0.012],
            [pins[3] + 0.026, 0.1, 0.013],
          ],
          0.0016,
          wire,
          { seg: 16 }
        )
      );
      g.add(k.box(0.05, 0.1, 0.026, k.plastic("#2b2d2a", 0.35), { at: [pins[3] + 0.026, 0.05, 0.015], r: 0.006 }));
      g.add(k.box(0.012, 0.018, 0.006, k.plastic("#4a4d47", 0.35), { at: [pins[3] + 0.026, 0.066, 0.0285], r: 0.002 }));
      return g;
    },
  },

  fan: {
    size: [0.31, 0.41, 0.21],
    build(k, o) {
      const body = k.paint(o.color ?? "#e7e0d0", 0.55);
      const chrome = k.metal("chrome");
      const blade = k.metal("silver", 0.3);
      const cy = 0.255;
      const pz = -0.05;
      const g = k.group([
        // A weighted round base with piano-key switches.
        k.lathe(
          [
            [0, 0],
            [0.098, 0],
            [0.102, 0.006],
            [0.1, 0.02],
            [0.088, 0.032],
            [0.05, 0.04],
            [0, 0.042],
          ],
          body,
          { seg: 48 }
        ),
        k.cyl(0.011, 0.011, 0.17, chrome, { at: [0, 0.125, pz * 0.3] }),
        k.cyl(0.016, 0.016, 0.02, body, { at: [0, 0.205, pz * 0.3] }),
        // The yoke the head tilts in, and the motor.
        k.torus(0.064, 0.0055, chrome, { at: [0, cy, pz], arc: Math.PI, rot: [0, 0, Math.PI] }),
        k.cyl(0.012, 0.012, 0.014, body, { at: [-0.068, cy, pz], rot: [0, 0, Math.PI / 2] }),
        k.cyl(0.016, 0.016, 0.016, body, { at: [0.07, cy, pz], rot: [0, 0, Math.PI / 2] }),
        k.lathe(
          [
            [0, 0],
            [0.026, 0.004],
            [0.045, 0.022],
            [0.054, 0.048],
            [0.054, 0.082],
            [0.044, 0.096],
            [0.024, 0.1],
            [0, 0.1],
          ],
          body,
          { at: [0, cy, -0.1], rot: [Math.PI / 2, 0, 0], seg: 40 }
        ),
        // Hub and blades.
        k.cyl(0.022, 0.024, 0.026, chrome, { at: [0, cy, 0.012], rot: [Math.PI / 2, 0, 0] }),
        // The cage: a rim, rings and wires, front and back, and a badge in the middle.
        k.torus(0.15, 0.0042, chrome, { at: [0, cy, 0.028], seg: 64 }),
        k.torus(0.12, 0.0022, chrome, { at: [0, cy, 0.046], seg: 56 }),
        k.torus(0.085, 0.0022, chrome, { at: [0, cy, 0.056], seg: 48 }),
        k.torus(0.05, 0.0022, chrome, { at: [0, cy, 0.062], seg: 40 }),
        k.torus(0.11, 0.0022, chrome, { at: [0, cy, -0.002], seg: 56 }),
        k.torus(0.065, 0.0022, chrome, { at: [0, cy, -0.012], seg: 40 }),
        k.lathe(
          [
            [0, 0],
            [0.026, 0],
            [0.024, 0.005],
            [0.016, 0.009],
            [0, 0.011],
          ],
          chrome,
          { at: [0, cy, 0.062], rot: [Math.PI / 2, 0, 0], seg: 32 }
        ),
      ]);
      for (let i = 0; i < 3; i += 1) {
        const bl = k.extrude(
          [
            [0.02, -0.011],
            [0.06, -0.034],
            [0.105, -0.043],
            [0.132, -0.024],
            [0.137, 0.008],
            [0.122, 0.033],
            [0.075, 0.032],
            [0.02, 0.011],
          ],
          0.0024,
          blade,
          { rot: [0.38, 0, 0], bevel: 0.0008 }
        );
        g.add(k.group([bl], { at: [0, cy, 0.016], rot: [0, 0, (i / 3) * Math.PI * 2 + 0.3] }));
      }
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        g.add(
          k.tube(
            [
              [c * 0.024, cy + s * 0.024, 0.063],
              [c * 0.09, cy + s * 0.09, 0.055],
              [c * 0.15, cy + s * 0.15, 0.028],
            ],
            0.0016,
            chrome,
            { seg: 8 }
          )
        );
        if (i % 2 === 0)
          g.add(
            k.tube(
              [
                [c * 0.04, cy + s * 0.04, -0.02],
                [c * 0.1, cy + s * 0.1, -0.004],
                [c * 0.15, cy + s * 0.15, 0.028],
              ],
              0.0016,
              chrome,
              { seg: 8 }
            )
          );
      }
      // Three keys on the base, and the flex out of the back.
      for (let i = 0; i < 3; i += 1) g.add(k.box(0.022, 0.012, 0.024, k.plastic("#f4f0e6", 0.5), { at: [(i - 1) * 0.026, 0.03, 0.084], rot: [0.55, 0, 0], r: 0.003 }));
      g.add(
        k.tube(
          [
            [0, 0.012, -0.095],
            [0.02, 0.005, -0.105],
            [0.07, 0.004, -0.1],
            [0.1, 0.004, -0.08],
          ],
          0.0028,
          k.plastic("#e9e5dc", 0.3),
          { seg: 16 }
        )
      );
      return g;
    },
  },

  "coat-rack": {
    size: [0.56, 1.8, 0.56],
    build(k, o) {
      const wood = o.color ? k.paint(o.color, 0.4) : k.wood("walnut", { gloss: 0.45 });
      const H = 1.75;
      const g = k.group([
        // A turned pole with a collar where the legs join.
        k.lathe(
          [
            [0, 0.2],
            [0.026, 0.2],
            [0.03, 0.24],
            [0.03, 0.31],
            [0.022, 0.33],
            [0.018, H - 0.07],
            [0.024, H - 0.05],
            [0.024, H - 0.03],
            [0, H - 0.03],
          ],
          wood,
          { seg: 28 }
        ),
        k.sphere(0.03, wood, { at: [0, H - 0.01, 0] }),
      ]);
      // Three legs to the floor, with felt feet.
      const joint = 0.27;
      const foot = 0.25;
      const drop = Math.atan2(joint - 0.026, foot);
      const len = Math.hypot(joint - 0.026, foot) + 0.012;
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
        g.add(k.group([k.box(len, 0.03, 0.034, wood, { at: [len / 2, 0, 0], r: 0.008 })], { at: [0, joint, 0], rot: [0, -a, -drop] }));
        g.add(k.cyl(0.02, 0.02, 0.014, k.rubber("#3b3631"), { at: [Math.cos(a) * (foot + 0.006), 0.007, Math.sin(a) * (foot + 0.006)], seg: 16 }));
      }
      // Six pegs, three high and three low.
      for (let i = 0; i < 6; i += 1) {
        const high = i < 3;
        const a = (i % 3) * ((Math.PI * 2) / 3) + (high ? Math.PI / 3 : 0) + Math.PI / 2;
        const y = high ? H - 0.13 : H - 0.28;
        g.add(
          k.group(
            [
              k.tube(
                [
                  [0, 0, 0],
                  [0.07, 0.022, 0],
                  [0.1, 0.07, 0],
                ],
                0.009,
                wood,
                { seg: 12 }
              ),
              k.sphere(0.015, wood, { at: [0.102, 0.078, 0] }),
            ],
            { at: [0, y, 0], rot: [0, -a, 0] }
          )
        );
      }
      // A canvas tote on a low peg, a scarf on another, a beanie on top.
      const lowA = (k2: number) => (k2 * Math.PI * 2) / 3 + Math.PI / 2;
      // The tote: soft canvas, its straps over the peg.
      const canvas = k.fabric("#d8ccb4", { repeat: [2, 2] });
      const bag = k.group([k.cushion(0.31, 0.026, 0.35, canvas, { rot: [Math.PI / 2, 0, 0] })], { at: [0.118, -0.31, 0], rot: [0, Math.PI / 2, 0.05] });
      g.add(
        k.group(
          [
            bag,
            k.torus(0.075, 0.0065, k.fabric("#c2b293"), { at: [0.112, -0.135, 0.012], rot: [0, Math.PI / 2, 0], arc: Math.PI, scale: [1, 1.9, 1] }),
            k.torus(0.075, 0.0065, k.fabric("#c2b293"), { at: [0.12, -0.135, -0.012], rot: [0, Math.PI / 2, 0], arc: Math.PI, scale: [1, 1.9, 1] }),
          ],
          { at: [0, H - 0.28 + 0.035, 0], rot: [0, -lowA(1), 0] }
        )
      );
      // A knitted scarf folded over another peg, one end longer than the other.
      const knit = k.velvet("#b07f34");
      g.add(
        k.group(
          [
            k.box(0.17, 0.6, 0.016, knit, { at: [0.085, -0.27, 0.022], rot: [0.04, 0, 0.03], r: 0.007 }),
            k.box(0.17, 0.44, 0.016, knit, { at: [0.09, -0.19, -0.022], rot: [-0.05, 0, 0.05], r: 0.007 }),
            k.torus(0.022, 0.008, knit, { at: [0.085, 0.03, 0], rot: [0, Math.PI / 2, 0], arc: Math.PI, scale: [1, 1, 10], seg: 20 }),
          ],
          { at: [0, H - 0.28, 0], rot: [0, -lowA(2), 0] }
        )
      );
      g.add(k.lathe([[0.075, 0], [0.074, 0.05], [0.066, 0.09], [0.045, 0.125], [0.02, 0.14], [0, 0.142]], k.fabric("#3c4450", { repeat: [3, 3] }), { at: [0, H - 0.07, 0], seg: 32 }));
      g.add(k.torus(0.073, 0.012, k.fabric("#3c4450", { repeat: [3, 3] }), { at: [0, H - 0.055, 0], rot: [Math.PI / 2, 0, 0], seg: 40 }));
      g.add(k.sphere(0.03, k.fabric("#d9d2c6"), { at: [0, H + 0.085, 0], seg: 18 }));
      return g;
    },
  },

  pinboard: {
    size: [0.9, 0.6, 0.032],
    wall: true,
    build(k, o) {
      const W = 0.9;
      const H = 0.6;
      const F = 0.022;
      const D = 0.024;
      const corkZ = 0.012;
      const g = k.group([
        moulding(k, W, H, F, D, o.color ? k.paint(o.color, 0.4) : k.wood("oak", { gloss: 0.4 })),
        k.plane(W - 2 * F + 0.004, H - 2 * F + 0.004, k.print(corkPicture(1024, 668, 41), { roughness: 0.95 }), { at: [0, H / 2, corkZ] }),
      ]);
      const pinColours = ["#c8382e", "#2f63b8", "#e3b330", "#3c8a4e", "#f2f0ea"];
      const pin = (x: number, y: number, z: number, i: number) => {
        g.add(k.cyl(0.0012, 0.0012, 0.008, k.metal("silver"), { at: [x, y, z + 0.003], rot: [Math.PI / 2, 0, 0], seg: 8 }));
        g.add(k.sphere(0.0062, k.plastic(pinColours[i % pinColours.length], 0.7), { at: [x, y, z + 0.009], seg: 16 }));
      };
      const total = Math.max(1, Math.min(units.length, 15));
      const done = Math.max(0, Math.min(total, Math.floor(o.live.unitsDone)));
      const rnd = rng(77);
      // One index card for each unit finished, pinned in rows.
      for (let i = 0; i < done; i += 1) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = -0.33 + col * 0.165 + (rnd() - 0.5) * 0.024;
        const y = H / 2 + 0.17 - row * 0.172 + (rnd() - 0.5) * 0.02;
        const z = corkZ + 0.0012 + i * 0.0001;
        const u = units[i];
        g.add(k.plane(0.15, 0.1, k.print(unitCard(i + 1, u?.title ?? `Unit ${i + 1}`), { roughness: 0.9 }), { at: [x, y, z], rot: [0, 0, (rnd() - 0.5) * 0.1] }));
        pin(x + (rnd() - 0.5) * 0.02, y + 0.033, z, i);
      }
      // Nothing finished yet: a few spare pins waiting.
      if (done === 0)
        for (let i = 0; i < 3; i += 1) pin(-0.3 + i * 0.27 + (rnd() - 0.5) * 0.05, H / 2 + 0.15 - i * 0.07, corkZ, i);
      return g;
    },
  },

  headphones: {
    size: [0.21, 0.295, 0.13],
    build(k, o) {
      const shell = k.plastic(o.color ?? "#1e1f22", 0.35);
      const pad = k.leather("#26272a");
      const alu = k.metal("silver", 0.3);
      const cy = 0.2015;
      const g = k.group([
        // The stand: a walnut base, an aluminium stem, a curved rest with a rubber top.
        k.lathe(
          [
            [0, 0],
            [0.062, 0],
            [0.065, 0.005],
            [0.064, 0.014],
            [0.058, 0.018],
            [0, 0.018],
          ],
          k.wood("walnut", { gloss: 0.5 }),
          { seg: 40 }
        ),
        k.cyl(0.0075, 0.0075, 0.235, alu, { at: [0, 0.1325, 0] }),
        k.torus(0.06, 0.0075, alu, { at: [0, 0.2, 0], arc: Math.PI * 0.5, rot: [0, 0, Math.PI * 0.25], seg: 24 }),
        k.torus(0.06, 0.0095, k.rubber("#2a2a2c"), { at: [0, 0.2, 0], arc: Math.PI * 0.3, rot: [0, 0, Math.PI * 0.35], seg: 20 }),
        // The headphones hung on it: a steel band, its padded underside, two sliders.
        k.torus(0.088, 0.0035, alu, { at: [0, cy, 0], arc: Math.PI + 0.4, rot: [0, 0, -0.2], seg: 48 }),
        k.torus(0.08, 0.011, shell, { at: [0, cy, 0], arc: Math.PI * 0.62, rot: [0, 0, Math.PI * 0.19], seg: 40, scale: [1, 1, 1.6] }),
      ]);
      for (const sx of [-1, 1]) {
        const x = sx * 0.0862;
        g.add(k.box(0.008, 0.05, 0.016, alu, { at: [x, 0.165, 0], r: 0.002 }));
        // Yoke, cup, ear cushion, and the cup's outer cap.
        g.add(k.torus(0.046, 0.0045, shell, { at: [sx * 0.084, 0.124, 0], rot: [0, Math.PI / 2, 0], arc: Math.PI, seg: 28 }));
        g.add(k.cyl(0.047, 0.047, 0.032, shell, { at: [sx * 0.088, 0.124, 0], rot: [0, 0, Math.PI / 2], seg: 36 }));
        g.add(k.torus(0.034, 0.013, pad, { at: [sx * 0.064, 0.124, 0], rot: [0, Math.PI / 2, 0], seg: 36 }));
        g.add(k.cyl(0.038, 0.04, 0.006, k.metal("#4a4b4f", 0.35), { at: [sx * 0.106, 0.124, 0], rot: [0, 0, Math.PI / 2], seg: 36 }));
      }
      // The cable from the left cup, coiled on the base.
      const coil: V3[] = [
        [-0.09, 0.08, 0.01],
        [-0.088, 0.05, 0.03],
        [-0.06, 0.024, 0.052],
      ];
      for (let i = 0; i <= 10; i += 1) {
        const a = Math.PI * 0.6 - (i / 10) * Math.PI * 1.7;
        coil.push([Math.cos(a) * 0.046, 0.0215, Math.sin(a) * 0.046]);
      }
      g.add(k.tube(coil, 0.0022, k.rubber("#202022"), { seg: 64 }));
      g.add(k.cyl(0.0035, 0.0035, 0.024, k.metal("#4a4b4f"), { at: [0.045, 0.022, -0.035], rot: [Math.PI / 2, 0, 0.6], seg: 10 }));
      return g;
    },
  },

  "side-table": {
    size: [0.46, 0.66, 0.46],
    build(k, o) {
      const wood = o.color ? k.paint(o.color, 0.45) : k.wood("walnut", { gloss: 0.5 });
      const topY = 0.55;
      const g = k.group([
        // A round top with a softened edge, and a shelf below.
        k.cyl(0.218, 0.218, 0.026, wood, { at: [0, topY - 0.013, 0], seg: 64 }),
        k.torus(0.218, 0.013, wood, { at: [0, topY - 0.013, 0], rot: [Math.PI / 2, 0, 0], seg: 72 }),
        k.cyl(0.17, 0.17, 0.018, wood, { at: [0, 0.2, 0], seg: 48 }),
        splayLegs(k, 3, 0.15, 0.2, topY - 0.026, 0.018, k.wood("walnut", { gloss: 0.45 }), Math.PI / 2),
        // Two books, a glass of water on a coaster.
        k.box(0.2, 0.028, 0.14, k.paper("#3d5c3a"), { at: [-0.04, topY + 0.014, 0.03], rot: [0, 0.25, 0], r: 0.003 }),
        k.box(0.18, 0.024, 0.13, k.paper("#c9b79c"), { at: [-0.035, topY + 0.04, 0.03], rot: [0, 0.05, 0], r: 0.003 }),
        k.cyl(0.045, 0.045, 0.005, k.stone("slate"), { at: [0.12, topY + 0.0025, -0.07], seg: 32 }),
        k.lathe(
          [
            [0, 0],
            [0.03, 0],
            [0.033, 0.1],
            [0.031, 0.1],
            [0.028, 0.006],
            [0, 0.006],
          ],
          k.glass("#e8f1f2", 0.25),
          { at: [0.12, topY + 0.005, -0.07], seg: 32 }
        ),
        k.cyl(0.0275, 0.028, 0.068, k.water("#bcd7de"), { at: [0.12, topY + 0.045, -0.07], seg: 28 }),
        // A magazine on the shelf below.
        k.box(0.21, 0.008, 0.27, k.paper("#b9c3c9"), { at: [0.0, 0.213, 0.0], rot: [0, -0.4, 0], r: 0.002 }),
      ]);
      return g;
    },
  },

  "floor-lamp": {
    size: [0.38, 2.09, 1.43],
    light: { at: [0, 1.62, 0.53], color: "#ffd9a8", intensity: 2.6, distance: 4.5 },
    build(k, o) {
      const zb = -0.565;
      const zs = 0.53;
      const steel = k.metal("steel", 0.22);
      const shade = o.color ? k.paint(o.color, 0.6) : k.metal("steel", 0.28);
      const g = k.group([
        // A block of marble to hold it down.
        k.box(0.36, 0.24, 0.28, k.stone("marble"), { at: [0, 0.12, zb], r: 0.016 }),
        k.cyl(0.026, 0.03, 0.03, steel, { at: [0, 0.255, zb], seg: 24 }),
        // The arc.
        k.tube(
          [
            [0, 0.25, zb],
            [0, 0.8, zb],
            [0, 1.35, zb + 0.03],
            [0, 1.75, zb + 0.15],
            [0, 2.0, zb + 0.42],
            [0, 2.06, zb + 0.72],
            [0, 2.0, zb + 0.95],
            [0, 1.9, zs - 0.03],
            [0, 1.84, zs],
          ],
          0.012,
          steel,
          { seg: 96 }
        ),
        // The shade: a dome, white inside, with the bulb under it.
        k.lathe(
          [
            [0.19, 0],
            [0.185, 0.045],
            [0.16, 0.1],
            [0.11, 0.145],
            [0.05, 0.168],
            [0.018, 0.172],
          ],
          shade,
          { at: [0, 1.66, zs], seg: 56 }
        ),
        k.lathe(
          [
            [0.012, 0.166],
            [0.05, 0.162],
            [0.106, 0.14],
            [0.156, 0.096],
            [0.181, 0.044],
            [0.186, 0.002],
          ],
          k.glow("#fff3e0", o.on, 0.55),
          { at: [0, 1.66, zs], seg: 56 }
        ),
        k.torus(0.1875, 0.0035, shade, { at: [0, 1.66, zs], rot: [Math.PI / 2, 0, 0], seg: 64 }),
        k.cyl(0.02, 0.02, 0.04, k.metal("black"), { at: [0, 1.81, zs] }),
        k.sphere(0.045, k.glow("#ffe2b8", o.on, 3), { at: [0, 1.745, zs], seg: 24 }),
        // The flex, out of the back of the base.
        k.tube(
          [
            [0, 0.03, zb - 0.14],
            [0.02, 0.006, zb - 0.155],
            [0.09, 0.005, zb - 0.15],
            [0.17, 0.005, zb - 0.1],
          ],
          0.0035,
          k.plastic("#1d1d1f", 0.3),
          { seg: 20 }
        ),
      ]);
      return g;
    },
  },

  "mini-fridge": {
    size: [0.48, 0.97, 0.54],
    build(k, o) {
      const enamel = k.paint(o.color ?? "#e8e1d1", 0.7);
      const chrome = k.metal("chrome");
      const note = canvasTexture(200, 220, (c, w, h) => {
        c.fillStyle = "#fbf6e6";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(90,130,200,0.35)";
        for (let y = 60; y < h; y += 30) c.fillRect(0, y, w, 1.5);
        c.fillStyle = "#2b3a6b";
        c.font = `30px ${PEN}`;
        scrawl(c, "Snacks", 18, 44, -0.02);
        c.font = `24px ${PEN}`;
        scrawl(c, "water", 26, 86, 0.01);
        scrawl(c, "yogurt", 26, 116, -0.01);
        scrawl(c, "apples", 26, 146, 0.012);
      });
      const g = k.group([
        // The cabinet, its door, and the gasket between them.
        k.box(0.48, 0.8, 0.47, enamel, { at: [0, 0.43, -0.03], r: 0.035 }),
        k.box(0.46, 0.776, 0.012, k.rubber("#d6d3cc"), { at: [0, 0.432, 0.208], r: 0.004 }),
        k.box(0.478, 0.79, 0.05, enamel, { at: [0, 0.432, 0.237], r: 0.03 }),
        // A chrome lever handle and hinges.
        k.tube(
          [
            [0.19, 0.69, 0.262],
            [0.19, 0.68, 0.29],
            [0.19, 0.6, 0.296],
            [0.19, 0.5, 0.29],
            [0.19, 0.49, 0.262],
          ],
          0.011,
          chrome,
          { seg: 32 }
        ),
        k.box(0.03, 0.014, 0.03, chrome, { at: [-0.2, 0.832, 0.24], r: 0.004 }),
        k.box(0.03, 0.014, 0.03, chrome, { at: [-0.2, 0.033, 0.24], r: 0.004 }),
        k.extrude(
          Array.from({ length: 24 }, (_, i): Pt => [Math.cos((i / 24) * Math.PI * 2) * 0.05, 0.75 + Math.sin((i / 24) * Math.PI * 2) * 0.016]),
          0.006,
          chrome,
          { at: [0, 0, 0.263], bevel: 0.002 }
        ),
        // A vent grille along the bottom, and feet.
        k.box(0.36, 0.022, 0.01, k.plastic("#5b5a57", 0.3), { at: [0, 0.045, 0.2], r: 0.004 }),
        // A shopping list held on with a magnet.
        k.plane(0.09, 0.1, k.print(note, { roughness: 0.9 }), { at: [-0.08, 0.6, 0.2625], rot: [0, 0, 0.05] }),
        k.cyl(0.012, 0.012, 0.008, k.plastic("#c8382e", 0.6), { at: [-0.08, 0.64, 0.266], rot: [Math.PI / 2, 0, 0], seg: 20 }),
      ]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.cyl(0.018, 0.022, 0.03, k.metal("chrome"), { at: [sx * 0.19, 0.015, -0.03 + sz * 0.18], seg: 16 }));
      // Two cans on top: sparkling water and iced tea.
      const label = (bg: string, ink: string, small: string, big: string) =>
        canvasTexture(512, 256, (c, w, h) => {
          c.fillStyle = bg;
          c.fillRect(0, 0, w, h);
          c.fillStyle = ink;
          c.globalAlpha = 0.18;
          c.beginPath();
          c.moveTo(0, h * 0.72);
          c.bezierCurveTo(w * 0.3, h * 0.55, w * 0.6, h * 0.9, w, h * 0.7);
          c.lineTo(w, h);
          c.lineTo(0, h);
          c.fill();
          c.globalAlpha = 1;
          c.textAlign = "center";
          c.font = `600 26px ${SANS}`;
          spaced(c, small, w / 2 - c.measureText(small).width / 2 - small.length * 2, h * 0.36, 4);
          c.font = `800 70px ${SANS}`;
          c.fillText(big, w / 2, h * 0.68);
        });
      const can = (x: number, z: number, turn: number, picture: THREE.Texture) => {
        g.add(
          k.lathe(
            [
              [0, 0],
              [0.026, 0],
              [0.033, 0.009],
              [0.033, 0.103],
              [0.027, 0.113],
              [0.0285, 0.116],
              [0, 0.116],
            ],
            k.metal("silver", 0.22),
            { at: [x, 0.83, z], seg: 32 }
          )
        );
        g.add(k.cyl(0.0333, 0.0333, 0.088, k.print(picture, { roughness: 0.3 }), { at: [x, 0.83 + 0.056, z], rot: [0, Math.PI + turn, 0], open: true, seg: 32 }));
      };
      can(0.1, -0.07, 0.4, label("#f3f1ea", "#5d9a3c", "SPARKLING WATER", "Lime"));
      can(0.175, 0.0, -0.3, label("#1f5c6b", "#f4c46a", "ICED TEA", "Peach"));
      g.position.z = -0.021;
      return g;
    },
  },

  "coffee-machine": {
    size: [0.62, 1.24, 0.46],
    build(k, o) {
      const steel = k.metal("black");
      const oak = k.wood("oak", { gloss: 0.5 });
      const body = o.color ? k.paint(o.color, 0.75) : k.metal("steel", 0.18);
      const chrome = k.metal("chrome");
      const W = 0.6;
      const D = 0.42;
      const shelf = (y: number) => [
        k.box(W - 0.02, 0.02, D - 0.02, oak, { at: [0, y, 0], r: 0.004 }),
        k.extrude(
          [
            [-W / 2, -D / 2],
            [W / 2, -D / 2],
            [W / 2, D / 2],
            [-W / 2, D / 2],
          ],
          0.034,
          steel,
          {
            at: [0, y + 0.007, 0],
            rot: [-Math.PI / 2, 0, 0],
            bevel: 0.002,
            holes: [
              [
                [-W / 2 + 0.014, -D / 2 + 0.014],
                [W / 2 - 0.014, -D / 2 + 0.014],
                [W / 2 - 0.014, D / 2 - 0.014],
                [-W / 2 + 0.014, D / 2 - 0.014],
              ],
            ],
          }
        ),
      ];
      const topY = 0.8;
      const deck = topY + 0.01;
      const mx = -0.08;
      const front = 0.15;
      const gauge = canvasTexture(256, 256, (c, w) => {
        c.fillStyle = "#f6f4ef";
        c.fillRect(0, 0, w, w);
        c.strokeStyle = "#222";
        c.fillStyle = "#222";
        c.lineWidth = 3;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `600 26px ${SANS}`;
        for (let i = 0; i <= 8; i += 1) {
          const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
          c.beginPath();
          c.moveTo(w / 2 + Math.cos(a) * 92, w / 2 + Math.sin(a) * 92);
          c.lineTo(w / 2 + Math.cos(a) * 112, w / 2 + Math.sin(a) * 112);
          c.stroke();
          if (i % 2 === 0) c.fillText(String(i * 2), w / 2 + Math.cos(a) * 70, w / 2 + Math.sin(a) * 70);
        }
        c.fillStyle = "#c8382e";
        c.beginPath();
        c.arc(w / 2, w / 2, 98, Math.PI * 0.75 + (8 / 16) * Math.PI * 1.5, Math.PI * 0.75 + (11 / 16) * Math.PI * 1.5);
        c.arc(w / 2, w / 2, 88, Math.PI * 0.75 + (11 / 16) * Math.PI * 1.5, Math.PI * 0.75 + (8 / 16) * Math.PI * 1.5, true);
        c.fill();
        c.font = `500 18px ${SANS}`;
        c.fillStyle = "#555";
        c.fillText("BAR", w / 2, w / 2 + 52);
        const a = Math.PI * 0.75 + (o.on ? 9.5 / 16 : 0) * Math.PI * 1.5;
        c.strokeStyle = "#c8382e";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(w / 2, w / 2);
        c.lineTo(w / 2 + Math.cos(a) * 96, w / 2 + Math.sin(a) * 96);
        c.stroke();
        c.fillStyle = "#222";
        c.beginPath();
        c.arc(w / 2, w / 2, 10, 0, Math.PI * 2);
        c.fill();
      });
      const grille = canvasTexture(256, 128, (c, w, h) => {
        c.fillStyle = "#b9bdc2";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#2a2b2d";
        for (let x = 14; x < w - 10; x += 16) c.fillRect(x, 14, 7, h - 28);
      });
      const bag = canvasTexture(240, 300, (c, w, h) => {
        c.fillStyle = "#b9946a";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#f3ede1";
        c.fillRect(30, 110, w - 60, 120);
        c.fillStyle = "#2a2522";
        c.textAlign = "center";
        c.font = `700 26px ${SANS}`;
        c.fillText("WHOLE BEAN", w / 2, 150);
        c.font = `500 20px ${SANS}`;
        c.fillText("Medium roast", w / 2, 182);
        c.fillText("340 g", w / 2, 210);
      });
      const cup = (x: number, y: number, z: number, turn: number) => [
        k.lathe(
          [
            [0, 0],
            [0.022, 0],
            [0.028, 0.012],
            [0.031, 0.05],
            [0.029, 0.05],
            [0.026, 0.012],
            [0, 0.008],
          ],
          k.ceramic("#f4f1ea"),
          { at: [x, y, z], seg: 28 }
        ),
        k.torus(0.013, 0.004, k.ceramic("#f4f1ea"), { at: [x + Math.cos(turn) * 0.033, y + 0.028, z - Math.sin(turn) * 0.033], rot: [0, turn, 0], arc: Math.PI * 1.25, seg: 16 }),
      ];
      const g = k.group([
        // A two-tier cart: oak shelves in black steel trays, legs on casters.
        ...shelf(topY),
        ...shelf(0.24),
        k.box(0.48, 0.016, 0.3, k.metal("black"), { at: [mx, deck + 0.008, -0.01], r: 0.003 }),
        // The machine: a steel box with a cup warmer on top.
        k.box(0.25, 0.34, 0.32, body, { at: [mx, deck + 0.02 + 0.17, -0.01], r: 0.012 }),
        k.tube(loop(0.115, 0.15, 0.02, deck + 0.375), 0.004, chrome, { seg: 120 }),
        ...cup(mx - 0.05, deck + 0.36, -0.05, 0.4),
        // The group head, its lever, and the portafilter locked in.
        k.cyl(0.032, 0.036, 0.075, chrome, { at: [mx, deck + 0.22, front + 0.035], rot: [Math.PI / 2, 0, 0], seg: 28 }),
        k.cyl(0.036, 0.036, 0.04, chrome, { at: [mx, deck + 0.18, front + 0.06], seg: 28 }),
        k.tube(
          [
            [mx, deck + 0.25, front + 0.06],
            [mx + 0.01, deck + 0.29, front + 0.08],
            [mx + 0.04, deck + 0.31, front + 0.1],
          ],
          0.005,
          chrome,
          { seg: 12 }
        ),
        k.sphere(0.013, k.plastic("#1b1b1c", 0.6), { at: [mx + 0.045, deck + 0.312, front + 0.104] }),
        k.cyl(0.035, 0.03, 0.03, chrome, { at: [mx, deck + 0.148, front + 0.06], seg: 28 }),
        k.cyl(0.011, 0.013, 0.13, k.plastic("#1b1b1c", 0.5), { at: [mx, deck + 0.14, front + 0.15], rot: [Math.PI / 2 - 0.12, 0, 0], seg: 16 }),
        // The drip tray, an espresso cup on it.
        k.box(0.24, 0.032, 0.1, k.metal("steel", 0.25), { at: [mx, deck + 0.036, front + 0.06], r: 0.004 }),
        k.plane(0.22, 0.085, k.print(grille, { roughness: 0.4 }), { at: [mx, deck + 0.0525, front + 0.06], rot: [-Math.PI / 2, 0, 0] }),
        ...cup(mx, deck + 0.053, front + 0.06, -0.6),
        // A steam wand and a hot water spout, their knobs; a pressure gauge; the switch and its light.
        k.tube(
          [
            [mx + 0.1, deck + 0.29, front],
            [mx + 0.11, deck + 0.28, front + 0.04],
            [mx + 0.115, deck + 0.2, front + 0.05],
            [mx + 0.118, deck + 0.13, front + 0.055],
          ],
          0.005,
          chrome,
          { seg: 24 }
        ),
        k.tube(
          [
            [mx - 0.1, deck + 0.29, front],
            [mx - 0.105, deck + 0.27, front + 0.03],
            [mx - 0.105, deck + 0.21, front + 0.035],
          ],
          0.005,
          chrome,
          { seg: 16 }
        ),
        k.cyl(0.017, 0.017, 0.022, k.plastic("#1b1b1c", 0.5), { at: [mx + 0.1, deck + 0.33, front + 0.004], rot: [Math.PI / 2, 0, 0], seg: 20 }),
        k.cyl(0.017, 0.017, 0.022, k.plastic("#1b1b1c", 0.5), { at: [mx - 0.1, deck + 0.33, front + 0.004], rot: [Math.PI / 2, 0, 0], seg: 20 }),
        k.disc(0.026, k.print(gauge, { roughness: 0.3 }), { at: [mx, deck + 0.3, front + 0.0055] }),
        k.torus(0.027, 0.0035, chrome, { at: [mx, deck + 0.3, front + 0.006], seg: 32 }),
        k.box(0.014, 0.02, 0.01, k.plastic("#1b1b1c", 0.5), { at: [mx - 0.06, deck + 0.3, front + 0.004], r: 0.002 }),
        k.cyl(0.004, 0.004, 0.004, k.glow("#ff8a2a", o.on, 2.5), { at: [mx + 0.06, deck + 0.3, front + 0.002], rot: [Math.PI / 2, 0, 0], seg: 12 }),
        // A burr grinder beside it, beans in its hopper.
        k.box(0.11, 0.2, 0.15, k.plastic("#232427", 0.45), { at: [0.2, deck + 0.1, -0.03], r: 0.014 }),
        k.lathe(
          [
            [0.022, 0],
            [0.05, 0.06],
            [0.054, 0.11],
            [0.052, 0.11],
            [0.048, 0.062],
            [0.02, 0.004],
          ],
          k.glass("#d9c9b0", 0.32),
          { at: [0.2, deck + 0.2, -0.03], seg: 32 }
        ),
        k.lathe(
          [
            [0, 0],
            [0.022, 0.004],
            [0.046, 0.06],
            [0.03, 0.075],
            [0, 0.08],
          ],
          k.paint("#3b2416", 0.2),
          { at: [0.2, deck + 0.2, -0.03], seg: 24 }
        ),
        k.cyl(0.056, 0.056, 0.016, k.plastic("#232427", 0.45), { at: [0.2, deck + 0.318, -0.03], seg: 32 }),
        // Beans and a milk jug on the shelf below.
        k.box(0.12, 0.17, 0.07, k.paper("#b9946a"), { at: [-0.16, 0.335, -0.04], rot: [0, 0.2, 0], r: 0.008 }),
        k.plane(0.1, 0.12, k.print(bag, { roughness: 0.9 }), { at: [-0.153, 0.33, -0.005], rot: [0, 0.2, 0] }),
        k.lathe(
          [
            [0, 0],
            [0.038, 0],
            [0.04, 0.05],
            [0.034, 0.1],
            [0.032, 0.1],
            [0.037, 0.05],
            [0.035, 0.004],
            [0, 0.004],
          ],
          k.metal("steel", 0.25),
          { at: [0.12, 0.25, 0.02], seg: 32 }
        ),
        k.torus(0.022, 0.004, k.metal("steel", 0.25), { at: [0.165, 0.31, 0.02], arc: Math.PI * 1.2, rot: [0, 0, -Math.PI * 0.6], seg: 16 }),
      ]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          g.add(k.box(0.022, 0.78, 0.022, steel, { at: [sx * (W / 2 - 0.011), 0.45, sz * (D / 2 - 0.011)], r: 0.003 }));
          g.add(k.cyl(0.03, 0.03, 0.02, k.rubber("#222"), { at: [sx * (W / 2 - 0.011), 0.03, sz * (D / 2 - 0.011)], rot: [0, 0, Math.PI / 2], seg: 20 }));
        }
      return g;
    },
  },

  "bunk-bed": {
    size: [2.0, 1.62, 1.02],
    build(k, o) {
      const pine = k.wood("pine", { gloss: 0.35 });
      const top = o.color ?? "#5f7187";
      const sheet = k.fabric("#f3f1ec");
      const L = 2.0;
      const Dp = 0.98;
      const H = 1.62;
      const P = 0.07;
      const g = k.group([]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) g.add(k.box(P, H, P, pine, { at: [sx * (L / 2 - P / 2), H / 2, sz * (Dp / 2 - P / 2)], r: 0.008 }));
      [0.2, 1.02].forEach((base, i) => {
        for (const sz of [-1, 1]) g.add(k.box(L - 2 * P, 0.14, 0.035, pine, { at: [0, base + 0.03, sz * (Dp / 2 - 0.0175)], r: 0.004 }));
        for (const sx of [-1, 1]) g.add(k.box(0.035, 0.14, Dp - 2 * P, pine, { at: [sx * (L / 2 - 0.0175), base + 0.03, 0], r: 0.004 }));
        g.add(k.box(L - 2 * P, 0.018, Dp - 0.07, pine, { at: [0, base - 0.02, 0] }));
        // Mattress, duvet and pillow.
        g.add(k.cushion(L - 2 * P - 0.02, 0.15, Dp - 0.1, sheet, { at: [0, base + 0.065, 0] }));
        g.add(k.cushion(1.42, 0.06, Dp - 0.08, k.fabric(i ? top : tint(top, "#ffffff", 0.35), { repeat: [4, 4] }), { at: [0.2, base + 0.165, 0] }));
        g.add(k.cushion(0.36, 0.1, 0.56, sheet, { at: [-0.72, base + 0.18, 0], rot: [0, 0, -0.18] }));
      });
      // Slats across each end, head and foot.
      for (const sx of [-1, 1]) for (const y of [0.52, 0.64, 1.32, 1.46]) g.add(k.box(0.03, 0.07, Dp - 2 * P, pine, { at: [sx * (L / 2 - 0.02), y, 0], r: 0.004 }));
      // Guard rails round the top bunk, open at the ladder.
      for (const y of [1.32, 1.46]) {
        g.add(k.box(L - 2 * P, 0.07, 0.03, pine, { at: [0, y, -(Dp / 2 - 0.015)], r: 0.004 }));
        g.add(k.box(1.42, 0.07, 0.03, pine, { at: [-0.22, y, Dp / 2 - 0.015], r: 0.004 }));
      }
      g.add(k.box(0.05, 0.42, 0.035, pine, { at: [0.5, 1.29, Dp / 2 - 0.015], r: 0.004 }));
      // The ladder.
      for (const x of [0.53, 0.89]) g.add(k.box(0.04, 1.52, 0.035, pine, { at: [x, 0.76, Dp / 2 + 0.0175], r: 0.005 }));
      for (const y of [0.42, 0.68, 0.94, 1.2]) g.add(k.cyl(0.016, 0.016, 0.32, pine, { at: [0.71, y, Dp / 2 + 0.0175], rot: [0, 0, Math.PI / 2], seg: 16 }));
      return g;
    },
  },

  fireplace: {
    size: [1.42, 1.28, 0.46],
    light: { at: [0, 0.32, 0.18], color: "#ff9447", intensity: 2.6, distance: 4.5 },
    build(k, o) {
      const surround = k.paint(o.color ?? "#ebe7df", 0.3);
      const iron = k.metal("black");
      const back = -0.23;
      const front = back + 0.24;
      const oW = 0.82;
      const oH = 0.74;
      const brick = canvasTexture(512, 480, (c, w, h) => {
        c.fillStyle = "#17110f";
        c.fillRect(0, 0, w, h);
        const rnd = rng(61);
        const bh = 34;
        const bw = 92;
        for (let r = 0; r * bh < h; r += 1) {
          const off = r % 2 ? bw / 2 : 0;
          for (let x = -off; x < w; x += bw) {
            const t = 0.55 + rnd() * 0.45;
            c.fillStyle = hex(new THREE.Color("#6a3a28").multiplyScalar(t));
            c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
          }
        }
        const soot = c.createLinearGradient(0, 0, 0, h);
        soot.addColorStop(0, "rgba(8,6,5,0.92)");
        soot.addColorStop(0.55, "rgba(8,6,5,0.55)");
        soot.addColorStop(1, "rgba(8,6,5,0.3)");
        c.fillStyle = soot;
        c.fillRect(0, 0, w, h);
      });
      const print = canvasTexture(300, 380, (c, w, h) => {
        c.fillStyle = "#e9e2d2";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#3f5a4a";
        c.beginPath();
        c.moveTo(0, h * 0.75);
        c.bezierCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.8, w, h * 0.55);
        c.lineTo(w, h);
        c.lineTo(0, h);
        c.fill();
        c.fillStyle = "#c98a4b";
        c.beginPath();
        c.arc(w * 0.66, h * 0.36, w * 0.13, 0, Math.PI * 2);
        c.fill();
      });
      const g = k.group([
        // A slate hearth, two pilasters with raised panels and plinths, a frieze, a cornice and the mantel shelf.
        k.box(1.36, 0.04, 0.46, k.stone("slate"), { at: [0, 0.02, 0], r: 0.006 }),
        k.box(0.22, 0.96, 0.24, surround, { at: [-0.52, 0.52, back + 0.12], r: 0.006 }),
        k.box(0.22, 0.96, 0.24, surround, { at: [0.52, 0.52, back + 0.12], r: 0.006 }),
        k.box(0.14, 0.62, 0.014, surround, { at: [-0.52, 0.5, front + 0.007], r: 0.004 }),
        k.box(0.14, 0.62, 0.014, surround, { at: [0.52, 0.5, front + 0.007], r: 0.004 }),
        k.box(0.25, 0.11, 0.262, surround, { at: [-0.52, 0.095, back + 0.131], r: 0.006 }),
        k.box(0.25, 0.11, 0.262, surround, { at: [0.52, 0.095, back + 0.131], r: 0.006 }),
        k.box(1.26, 0.22, 0.24, surround, { at: [0, 0.89, back + 0.12], r: 0.006 }),
        k.box(1.34, 0.04, 0.27, surround, { at: [0, 1.02, back + 0.135], r: 0.008 }),
        k.box(1.42, 0.05, 0.31, k.wood("oak", { gloss: 0.45 }), { at: [0, 1.065, back + 0.155], r: 0.006 }),
        // The firebox: sooty brick behind, dark sides and lintel, a cast iron surround.
        k.plane(oW, oH, k.print(brick, { roughness: 0.95 }), { at: [0, 0.04 + oH / 2, back + 0.03] }),
        k.box(0.02, oH, 0.22, k.paint("#1d1714", 0.1), { at: [-0.375, 0.04 + oH / 2, back + 0.125], rot: [0, -0.22, 0] }),
        k.box(0.02, oH, 0.22, k.paint("#1d1714", 0.1), { at: [0.375, 0.04 + oH / 2, back + 0.125], rot: [0, 0.22, 0] }),
        k.box(oW, 0.02, 0.22, k.paint("#1d1714", 0.1), { at: [0, 0.04 + oH - 0.01, back + 0.12] }),
        k.box(oW - 0.04, 0.008, 0.21, k.paint("#2b2522", 0.05), { at: [0, 0.044, back + 0.12] }),
        k.extrude(
          [
            [-oW / 2 - 0.04, 0.04],
            [-oW / 2, 0.04],
            [-oW / 2, 0.04 + oH],
            [oW / 2, 0.04 + oH],
            [oW / 2, 0.04],
            [oW / 2 + 0.04, 0.04],
            [oW / 2 + 0.04, 0.04 + oH + 0.04],
            [-oW / 2 - 0.04, 0.04 + oH + 0.04],
          ],
          0.014,
          iron,
          { at: [0, 0, front + 0.004], bevel: 0.003 }
        ),
        // A log grate and three logs.
        k.box(0.03, 0.06, 0.2, iron, { at: [-0.22, 0.075, back + 0.13], r: 0.004 }),
        k.box(0.03, 0.06, 0.2, iron, { at: [0.22, 0.075, back + 0.13], r: 0.004 }),
        k.box(0.5, 0.02, 0.02, iron, { at: [0, 0.1, back + 0.215], r: 0.004 }),
        k.cyl(0.045, 0.045, 0.52, k.wood("#4c3727", { gloss: 0.1 }), { at: [-0.02, 0.15, back + 0.1], rot: [0, 0.12, Math.PI / 2], seg: 14 }),
        k.cyl(0.04, 0.04, 0.48, k.wood("#5a4130", { gloss: 0.1 }), { at: [0.03, 0.145, back + 0.18], rot: [0, -0.1, Math.PI / 2], seg: 14 }),
        k.cyl(0.037, 0.037, 0.42, k.wood("#2e2420", { gloss: 0.1 }), { at: [0, 0.215, back + 0.14], rot: [0, 0.55, Math.PI / 2], seg: 14 }),
        k.box(0.5, 0.012, 0.18, o.on ? k.glow("#ff5a1e", true, 1.6) : k.paint("#2b2522", 0.05), { at: [0, 0.102, back + 0.14] }),
        // On the mantel: two pillar candles on a brass tray, a print leaning on the wall, a little potted box ball.
        k.cyl(0.08, 0.08, 0.008, k.metal("brass"), { at: [-0.45, 1.094, back + 0.15], seg: 32 }),
        k.cyl(0.035, 0.035, 0.13, k.paint("#efe8da", 0.3), { at: [-0.48, 1.163, back + 0.14], seg: 24 }),
        k.cyl(0.03, 0.03, 0.085, k.paint("#efe8da", 0.3), { at: [-0.41, 1.14, back + 0.17], seg: 24 }),
        k.cyl(0.0012, 0.0012, 0.012, k.paint("#222"), { at: [-0.48, 1.234, back + 0.14] }),
        k.cyl(0.0012, 0.0012, 0.012, k.paint("#222"), { at: [-0.41, 1.188, back + 0.17] }),
        k.group([moulding(k, 0.24, 0.3, 0.018, 0.018, k.wood("walnut", { gloss: 0.5 }), 0, 0.0015), k.plane(0.206, 0.266, k.print(print, { roughness: 0.6 }), { at: [0, 0.15, 0.012] })], {
          at: [0.36, 1.09, back + 0.035],
          rot: [-0.1, 0, 0],
        }),
        k.lathe(
          [
            [0, 0],
            [0.04, 0],
            [0.047, 0.06],
            [0.042, 0.06],
          ],
          k.ceramic("#d8cbb6"),
          { at: [0.55, 1.09, back + 0.16], seg: 28 }
        ),
        k.sphere(0.055, k.velvet("#4f6b3a"), { at: [0.55, 1.19, back + 0.16], seg: 24 }),
      ]);
      if (o.on) {
        // Flames, orange behind and yellow in front, with the candles lit.
        const flames: [number, number, number, number, number, string, number][] = [
          [-0.17, 0.17, -0.04, 0.09, 0.26, "#ff6a1a", 2.2],
          [-0.05, 0.18, -0.05, 0.11, 0.33, "#ff7a22", 2.4],
          [0.09, 0.17, -0.04, 0.1, 0.29, "#ff6a1a", 2.2],
          [0.19, 0.16, -0.03, 0.08, 0.2, "#ff7a22", 2.2],
          [-0.1, 0.19, 0.02, 0.07, 0.19, "#ffb03a", 2.8],
          [0.03, 0.2, 0.025, 0.08, 0.23, "#ffc04a", 3],
          [0.14, 0.18, 0.03, 0.06, 0.15, "#ffb03a", 2.8],
          [-0.02, 0.21, 0.05, 0.045, 0.1, "#ffe7a0", 3],
        ];
        for (const [x, y, z, w, h, col, s] of flames)
          g.add(k.lathe(FLAME, k.glow(col, true, s), { at: [x, y, back + 0.14 + z], scale: [w, h, w * 0.55], rot: [0, 0, -x * 0.5], seg: 18 }));
        for (const [x, y, z] of [
          [-0.48, 1.24, back + 0.14],
          [-0.41, 1.194, back + 0.17],
        ])
          g.add(k.lathe(FLAME, k.glow("#ffc55c", true, 2.6), { at: [x, y, z], scale: [0.007, 0.024, 0.007], seg: 12 }));
      }
      return g;
    },
  },

  "swing-chair": {
    size: [1.0, 1.99, 1.0],
    build(k, o) {
      const cane = k.wood("#b18556", { gloss: 0.35 });
      const iron = k.metal("black");
      const cloth = k.fabric(o.color ?? "#e9e3d7", { repeat: [2, 2] });
      const yb = 0.3;
      const HE = 1.15;
      const depth = 0.9;
      const open = (t: number) => (t <= 0.24 || t >= 0.86 ? 0 : 3.3 * Math.sin((Math.PI * (t - 0.24)) / 0.62) ** 0.6);
      const egg = new THREE.Group();
      egg.scale.set(1, 1, depth);
      // The shell: rattan rings, open at the front, on ribs that meet top and bottom.
      const rings = 15;
      for (let i = 0; i < rings; i += 1) {
        const t = 0.05 + (i / (rings - 1)) * 0.9;
        const gap = open(t);
        const arc = Math.PI * 2 - gap;
        if (arc < 0.3) continue;
        const ring = k.group([k.torus(eggR(t), 0.011, cane, { rot: [Math.PI / 2, 0, 0], arc, seg: 64 })], { at: [0, yb + t * HE, 0], rot: [0, Math.PI / 2 + arc / 2, 0] });
        egg.add(ring);
      }
      for (const phi of [Math.PI, Math.PI - 0.55, Math.PI + 0.55, Math.PI - 1.1, Math.PI + 1.1, 0]) {
        const pts: V3[] = [];
        const front = phi === 0;
        for (let j = 0; j <= 12; j += 1) {
          const t = front ? 0.01 + (j / 12) * 0.23 : j / 12;
          const r = eggR(t);
          pts.push([Math.sin(phi) * r, yb + t * HE, Math.cos(phi) * r]);
        }
        egg.add(k.tube(pts, 0.009, cane, { seg: 48 }));
      }
      // A thick rim round the opening.
      const rim: V3[] = [];
      for (let j = 0; j <= 10; j += 1) {
        const t = 0.24 + (j / 10) * 0.62;
        const a = open(t) / 2;
        rim.push([Math.sin(a) * eggR(t), yb + t * HE, Math.cos(a) * eggR(t)]);
      }
      for (let j = 9; j >= 0; j -= 1) {
        const [x, y, z] = rim[j];
        rim.push([-x, y, z]);
      }
      egg.add(k.tube(rim, 0.016, cane, { seg: 120 }));
      // Cushions: a deep round seat, a tall back, and a small pillow.
      egg.add(
        k.lathe(
          [
            [0, 0],
            [0.28, 0.004],
            [0.34, 0.04],
            [0.35, 0.085],
            [0.32, 0.12],
            [0.2, 0.135],
            [0, 0.138],
          ],
          cloth,
          { at: [0, yb + 0.08, 0.02], seg: 48 }
        )
      );
      egg.add(k.cushion(0.6, 0.14, 0.56, cloth, { at: [0, yb + 0.5, -0.27], rot: [Math.PI / 2 - 0.24, 0, 0] }));
      egg.add(k.cushion(0.34, 0.1, 0.3, k.fabric("#c9b28c", { repeat: [2, 2] }), { at: [0.12, yb + 0.33, -0.12], rot: [Math.PI / 2 - 0.35, -0.35, 0] }));
      // The cap the ribs meet at, under the chain.
      egg.add(k.cyl(0.03, 0.04, 0.03, iron, { at: [0, yb + HE + 0.005, 0] }));
      const g = k.group([
        egg,
        // The stand: a round base and a C-shaped post curving over to the hook.
        k.lathe(
          [
            [0, 0],
            [0.48, 0],
            [0.5, 0.008],
            [0.49, 0.02],
            [0.3, 0.034],
            [0.06, 0.044],
            [0, 0.044],
          ],
          iron,
          { seg: 64 }
        ),
        k.tube(
          [
            [0, 0.03, -0.44],
            [0, 0.6, -0.49],
            [0, 1.2, -0.51],
            [0, 1.62, -0.48],
            [0, 1.86, -0.34],
            [0, 1.955, -0.15],
            [0, 1.955, 0.0],
          ],
          0.024,
          iron,
          { seg: 80 }
        ),
        k.torus(0.016, 0.004, iron, { at: [0, 1.915, 0], rot: [0, Math.PI / 2, 0], seg: 20 }),
      ]);
      // The chain.
      for (let i = 0; i < 8; i += 1) g.add(k.torus(0.016, 0.0042, k.metal("steel"), { at: [0, 1.875 - i * 0.053, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], scale: [1.75, 1, 1], seg: 16 }));
      return g;
    },
  },

  hammock: {
    size: [2.82, 1.24, 0.94],
    build(k, o) {
      const cloth = k.fabric(o.color ?? "#d8ccb3", { repeat: [3, 3] });
      const larch = k.wood("#b98a57", { gloss: 0.45 });
      const rope = k.fabric("#e8dfcc", { repeat: [1, 6] });
      const steel = k.metal("steel");
      // The stand: one laminated arc resting on two feet.
      const R0 = 1.432;
      const cy = R0 + 0.07;
      const T = 0.085;
      const tm = 1.36;
      const arc: Pt[] = [];
      for (let i = 0; i <= 40; i += 1) {
        const th = -tm + (i / 40) * tm * 2;
        arc.push([Math.sin(th) * R0, cy - Math.cos(th) * R0]);
      }
      for (let i = 40; i >= 0; i -= 1) {
        const th = -tm + (i / 40) * tm * 2;
        arc.push([Math.sin(th) * (R0 - T), cy - Math.cos(th) * (R0 - T)]);
      }
      const g = k.group([k.extrude(arc, 0.075, larch, { bevel: 0.006 })]);
      for (const sx of [-1, 1]) {
        g.add(k.box(0.08, 0.1, 0.9, larch, { at: [sx * 0.3, 0.05, 0], r: 0.01 }));
        for (const sz of [-1, 1]) g.add(k.box(0.084, 0.022, 0.05, k.rubber("#2a2a2a"), { at: [sx * 0.3, 0.011, sz * 0.43], r: 0.005 }));
      }
      // The hammock: canvas between two spreader bars, hung by cords from rings at the arc's ends.
      const half = 0.95;
      const yEnd = 0.92;
      const yLow = 0.48;
      const yc = (x: number) => yLow + (yEnd - yLow) * (x / half) ** 2;
      const slope = (x: number) => Math.atan((2 * (yEnd - yLow) * x) / (half * half));
      const sheet: Pt[] = [];
      for (let i = 0; i <= 30; i += 1) {
        const x = -half + (i / 30) * half * 2;
        sheet.push([x, yc(x) + 0.006]);
      }
      for (let i = 30; i >= 0; i -= 1) {
        const x = -half + (i / 30) * half * 2;
        sheet.push([x, yc(x) - 0.006]);
      }
      g.add(k.extrude(sheet, 0.82, cloth, { bevel: 0.004 }));
      for (const sx of [-1, 1]) {
        const bx = sx * half;
        g.add(k.cyl(0.015, 0.015, 0.9, larch, { at: [bx, yEnd + 0.012, 0], rot: [Math.PI / 2, 0, 0], seg: 16 }));
        const ring: V3 = [sx * 1.27, 1.1, 0];
        for (const z of [-0.42, -0.21, 0, 0.21, 0.42]) g.add(k.tube([[bx, yEnd + 0.012, z], ring], 0.0035, rope, { seg: 1 }));
        g.add(k.torus(0.026, 0.0055, steel, { at: ring, rot: [0, Math.PI / 2, 0], seg: 20 }));
        g.add(k.torus(0.02, 0.005, steel, { at: [sx * 1.29, 1.142, 0], rot: [0, 0, sx * 0.4], scale: [1, 1.6, 1], seg: 16 }));
      }
      // A pillow and a folded blanket, a book on top.
      g.add(k.cushion(0.34, 0.12, 0.44, k.fabric("#efe9dd"), { at: [-0.64, yc(-0.64) + 0.075, 0], rot: [0, 0, slope(-0.64)] }));
      g.add(k.box(0.36, 0.035, 0.46, k.fabric("#6f7d6c", { repeat: [3, 3] }), { at: [0.28, yc(0.28) + 0.023, 0.04], rot: [0, 0.05, slope(0.28)], r: 0.012 }));
      g.add(k.box(0.16, 0.026, 0.22, k.paper("#7a2e2e"), { at: [0.3, yc(0.3) + 0.054, 0.02], rot: [0, -0.3, slope(0.3)], r: 0.003 }));
      return g;
    },
  },

  "cloud-couch": {
    size: [2.36, 0.88, 1.06],
    build(k, o) {
      const up = k.fabric(o.color ?? "#dcd5c8", { repeat: [5, 5] });
      const back = (x: number, yaw: number) => k.group([k.cushion(0.84, 0.22, 0.52, up, { rot: [Math.PI / 2 - 0.2, 0, 0] })], { at: [x, 0.62, -0.31], rot: [0, yaw, 0] });
      const pillow = (x: number, yaw: number, m: THREE.Material) => k.group([k.cushion(0.44, 0.13, 0.44, m, { rot: [Math.PI / 2 - 0.3, 0.12 * Math.sign(x), 0] })], { at: [x, 0.64, -0.12], rot: [0, yaw, 0] });
      const knit = k.fabric("#8a7a62", { repeat: [3, 6] });
      return k.group([
        // A dark plinth set back, so it seems to float; the upholstered base on it.
        k.box(2.16, 0.07, 0.92, k.wood("ebony", { gloss: 0.2 }), { at: [0, 0.035, -0.01], r: 0.005 }),
        k.box(2.3, 0.2, 1.04, up, { at: [0, 0.17, 0], r: 0.06 }),
        // Wide low arms, and the back the cushions lean on.
        k.cushion(0.3, 0.38, 1.04, up, { at: [-1.0, 0.43, 0] }),
        k.cushion(0.3, 0.38, 1.04, up, { at: [1.0, 0.43, 0] }),
        k.box(1.72, 0.4, 0.22, up, { at: [0, 0.46, -0.41], r: 0.06 }),
        // Two deep seat cushions and two plump back cushions.
        k.cushion(0.86, 0.19, 0.84, up, { at: [-0.43, 0.36, 0.08], rot: [0, 0.012, 0] }),
        k.cushion(0.86, 0.19, 0.84, up, { at: [0.43, 0.36, 0.08], rot: [0, -0.012, 0] }),
        back(-0.43, 0.02),
        back(0.43, -0.02),
        // Throw pillows, and a knit blanket over the arm.
        pillow(-0.7, 0.35, k.velvet("#9a5a3c")),
        pillow(0.72, -0.4, k.fabric("#8d8f86")),
        k.box(0.32, 0.024, 0.56, knit, { at: [1.0, 0.68, 0.14], r: 0.01 }),
        k.box(0.024, 0.36, 0.56, knit, { at: [1.163, 0.5, 0.14], r: 0.01 }),
      ]);
    },
  },

  terrarium: {
    size: [0.44, 0.96, 0.44],
    build(k, o) {
      const grow = clamp01(o.live.growth);
      const frame = o.color ? k.paint(o.color, 0.6) : k.metal("brass", 0.32);
      const walnut = k.wood("walnut", { gloss: 0.5 });
      const topY = 0.54;
      const R = 0.16;
      const Hw = 0.24;
      const Hr = 0.13;
      const Rr = 0.03;
      const b = topY + 0.022;
      const turn: V3 = [0, Math.PI / 6, 0];
      const g = k.group([
        // A walnut plant stand.
        k.lathe(
          [
            [0, topY - 0.024],
            [0.2, topY - 0.024],
            [0.205, topY - 0.016],
            [0.205, topY - 0.006],
            [0.2, topY],
            [0, topY],
          ],
          walnut,
          { seg: 48 }
        ),
        splayLegs(k, 3, 0.13, 0.19, topY - 0.024, 0.016, walnut, Math.PI / 2),
        // The case: hexagonal glass on a metal tray, a pitched roof.
        k.cyl(R + 0.008, R + 0.008, 0.022, frame, { at: [0, topY + 0.011, 0], seg: 6, rot: turn }),
        k.lathe(
          [
            [0, 0],
            [R, 0],
            [R, Hw],
            [Rr, Hw + Hr],
            [0, Hw + Hr],
          ],
          k.glass("#e6f0ec", 0.16),
          { at: [0, b, 0], seg: 6, rot: turn }
        ),
        k.sphere(0.012, frame, { at: [0, b + Hw + Hr + 0.008, 0] }),
        k.sphere(0.006, frame, { at: [0, b + 0.13, R * Math.cos(Math.PI / 6) + 0.006] }),
        // Inside: gravel, charcoal and soil in layers, moss, a stone, a twig.
        k.cyl(R - 0.006, R - 0.006, 0.03, k.stone("granite"), { at: [0, b + 0.015, 0], seg: 6, rot: turn }),
        k.cyl(R - 0.006, R - 0.006, 0.008, k.paint("#1c1b1a", 0.05), { at: [0, b + 0.034, 0], seg: 6, rot: turn }),
        k.cyl(R - 0.006, R - 0.006, 0.036, k.soil(), { at: [0, b + 0.056, 0], seg: 6, rot: turn }),
        k.sphere(1, k.velvet("#5b7a35"), { at: [-0.05, b + 0.074, 0.03], scale: [0.075, 0.022, 0.06], seg: 20 }),
        k.sphere(1, k.velvet("#6b8a3d"), { at: [0.06, b + 0.074, 0.05], scale: [0.05, 0.016, 0.045], seg: 18 }),
        k.sphere(1, k.stone("granite"), { at: [0.075, b + 0.08, -0.03], scale: [0.032, 0.022, 0.028], seg: 14 }),
        k.tube(
          [
            [-0.1, b + 0.076, -0.06],
            [-0.04, b + 0.085, -0.02],
            [0.02, b + 0.08, 0.06],
          ],
          0.006,
          k.wood("#9a8a74", { gloss: 0.2 }),
          { seg: 12 }
        ),
      ]);
      // The brass edges: six uprights, the eaves, and the roof's hips.
      const corner = (i: number, r: number, y: number): V3 => {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        return [Math.sin(a) * r, y, Math.cos(a) * r];
      };
      for (let i = 0; i < 6; i += 1) {
        g.add(k.tube([corner(i, R, b), corner(i, R, b + Hw)], 0.0035, frame, { seg: 1 }));
        g.add(k.tube([corner(i, R, b + Hw), corner(i + 1, R, b + Hw)], 0.0035, frame, { seg: 1 }));
        g.add(k.tube([corner(i, R, b + Hw), corner(i, Rr, b + Hw + Hr)], 0.0035, frame, { seg: 1 }));
      }
      // A fern that grows with every goal reached, and a small nerve plant.
      const fernAt: V3 = [0.035, b + 0.074, -0.04];
      const fronds = 5 + Math.round(grow * 6);
      const len = 0.07 + 0.08 * grow;
      for (let i = 0; i < fronds; i += 1) {
        const a = i * 2.39;
        const lift = 0.55 + (i % 3) * 0.22;
        g.add(k.group([k.group([k.extrude(frond(len), 0.0012, k.leaf(i % 2 ? 1 : 0), { bevel: 0.0003 })], { rot: [lift, 0, 0] })], { at: fernAt, rot: [0, a, 0] }));
      }
      const nerve: V3 = [-0.07, b + 0.085, 0.045];
      for (let i = 0; i < 7; i += 1) {
        const a = i * 0.9;
        const r = i === 0 ? 0 : 0.016;
        g.add(k.sphere(1, k.paint("#4f7d45", 0.35), { at: [nerve[0] + Math.cos(a) * r, nerve[1] + (i === 0 ? 0.014 : 0.006), nerve[2] + Math.sin(a) * r], scale: [0.013, 0.003, 0.018], rot: [0.3, a, 0], seg: 12 }));
      }
      return g;
    },
  },

  "lava-lamp": {
    size: [0.144, 0.43, 0.144],
    light: { at: [0, 0.27, 0], color: "#ff8a4c", intensity: 1.4, distance: 2.6 },
    build(k, o) {
      const wax = o.color ?? "#ff5a1f";
      const alu = k.metal("silver", 0.22);
      const bottle: Pt[] = [
        [0, 0.155],
        [0.034, 0.155],
        [0.05, 0.185],
        [0.057, 0.225],
        [0.055, 0.275],
        [0.046, 0.325],
        [0.035, 0.36],
        [0.029, 0.375],
        [0, 0.375],
      ];
      const g = k.group([
        // The base cone, a ring of vents, the bottle, the liquid and the cap.
        k.lathe(
          [
            [0, 0],
            [0.072, 0],
            [0.072, 0.008],
            [0.068, 0.012],
            [0.04, 0.152],
            [0.036, 0.156],
            [0, 0.156],
          ],
          alu,
          { seg: 48 }
        ),
        k.lathe(
          [
            [0.0605, 0.045],
            [0.0545, 0.075],
          ],
          k.paint("#1c1c1e", 0.2),
          { seg: 48 }
        ),
        k.lathe(bottle, k.glass("#f4f1ea", 0.18), { seg: 40 }),
        k.lathe(
          bottle.map(([r, y]) => [r * 0.92, 0.16 + (y - 0.155) * 0.95] as Pt),
          k.water(o.on ? "#ffd27a" : "#e9d9a8"),
          { seg: 36 }
        ),
        k.lathe(
          [
            [0, 0.373],
            [0.031, 0.373],
            [0.029, 0.38],
            [0.012, 0.426],
            [0, 0.428],
          ],
          alu,
          { seg: 40 }
        ),
      ]);
      if (o.on) {
        // Warm wax, rising and falling.
        const hot = k.glow(wax, true, 1.8);
        g.add(k.sphere(1, hot, { at: [0, 0.172, 0], scale: [0.038, 0.014, 0.038], seg: 24 }));
        g.add(k.sphere(1, hot, { at: [0.008, 0.245, 0.004], scale: [0.024, 0.036, 0.024], rot: [0, 0, 0.12], seg: 24 }));
        g.add(k.sphere(1, hot, { at: [-0.015, 0.3, 0.008], scale: [0.015, 0.018, 0.015], seg: 18 }));
        g.add(k.sphere(1, hot, { at: [0.012, 0.333, -0.01], scale: [0.009, 0.011, 0.009], seg: 14 }));
        g.add(k.sphere(1, hot, { at: [0, 0.355, 0], scale: [0.022, 0.01, 0.022], seg: 18 }));
        g.add(k.sphere(1, hot, { at: [-0.006, 0.2, -0.006], scale: [0.016, 0.022, 0.016], seg: 16 }));
      } else {
        // Cold: the wax sits in a lump at the bottom.
        g.add(k.sphere(1, k.paint(shade(wax, 0.8), 0.35), { at: [0, 0.172, 0], scale: [0.042, 0.018, 0.042], seg: 24 }));
      }
      return g;
    },
  },
};
