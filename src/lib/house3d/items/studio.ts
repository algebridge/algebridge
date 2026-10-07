/**
 * The studio pieces: music, art, screens and a bench of science, built to the
 * bar set in core.ts. Real sizes in metres, real materials, soft edges, and
 * where a piece can show something true (the neon sign's streak, the
 * projector's lesson), it does.
 */

import * as THREE from "three";
import { canvasTexture } from "../kit";
import type { Kit, V3 } from "../kit";
import type { ItemModel } from "../types";

type P2 = [number, number];
type Mat = THREE.Material;

const SANS = "Inter, system-ui, sans-serif";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A fixed random source, so a piece looks the same on every load. */
function rand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** The centre and turn that make a shape built along y run from a to b. */
function span(a: V3, b: V3): { at: V3; rot: V3; len: number } {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return { at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [e.x, e.y, e.z], len };
}

/** A round rod from a to b, optionally tapering to rb at b. */
function rod(k: Kit, a: V3, b: V3, r: number, m: Mat, rb = r, seg = 14): THREE.Mesh {
  const s = span(a, b);
  return k.cyl(rb, r, s.len, m, { at: s.at, rot: s.rot, seg });
}

/** A square-section bar from a to b. */
function bar(k: Kit, a: V3, b: V3, w: number, d: number, m: Mat, r = 0.003): THREE.Mesh {
  const s = span(a, b);
  return k.box(w, s.len, d, m, { at: s.at, rot: s.rot, r });
}

function cr(a: number, b: number, c: number, d: number, t: number): number {
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}

/** A smooth closed outline through these points (Catmull-Rom), `per` points to each span. */
function smoothLoop(pts: P2[], per: number): P2[] {
  const out: P2[] = [];
  const m = pts.length;
  for (let j = 0; j < m; j += 1) {
    const p0 = pts[(j - 1 + m) % m];
    const p1 = pts[j];
    const p2 = pts[(j + 1) % m];
    const p3 = pts[(j + 2) % m];
    for (let i = 0; i < per; i += 1) {
      const t = i / per;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  return out;
}

/** Points round an arc, from angle a0 to a1. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

const circle = (r: number, n = 64): P2[] => arc(0, 0, r, 0, Math.PI * 2, n).slice(0, n);

function unit2(x: number, y: number): P2 {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** A closed outline moved inwards by d (outwards when d is negative). */
function inset(pts: P2[], d: number): P2[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i += 1) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  const side = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const e1 = unit2(p[0] - a[0], p[1] - a[1]);
    const e2 = unit2(b[0] - p[0], b[1] - p[1]);
    const l1: P2 = [-e1[1] * side, e1[0] * side];
    const l2: P2 = [-e2[1] * side, e2[0] * side];
    const m = unit2(l1[0] + l2[0], l1[1] + l2[1]);
    const c = Math.max(0.35, m[0] * l1[0] + m[1] * l1[1]);
    return [p[0] + (m[0] * d) / c, p[1] + (m[1] * d) / c] as P2;
  });
}

/** A colour as rgb numbers, and back. */
function rgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}
function css(c: number[], a = 1): string {
  const [r, g, b] = c.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t);
}

/** The 88 keys of a piano, as two combs: the whites with hairline gaps, the blacks raised on top. Key fronts at z = 0, tops at y = 0. */
function keys88(k: Kit): THREE.Group {
  const kw = 0.02358;
  const W = kw * 52;
  const Lw = 0.15;
  const Lb = 0.095;
  const spine = 0.025;
  const gap = 0.0016;
  // In the outline, y runs back from the key fronts; the comb is laid flat afterwards.
  const white: P2[] = [
    [-W / 2, Lw + spine],
    [W / 2, Lw + spine],
  ];
  for (let i = 51; i >= 0; i -= 1) {
    const xr = -W / 2 + (i + 1) * kw - (i === 51 ? 0 : gap / 2);
    const xl = -W / 2 + i * kw + (i === 0 ? 0 : gap / 2);
    white.push([xr, Lw], [xr, 0], [xl, 0], [xl, Lw]);
  }
  // Black keys sit over the line between two whites, nudged the way a real keyboard has them.
  const nudge: Record<string, number> = { A: 0.14, C: -0.1, D: 0.1, F: -0.13, G: 0 };
  const centres: number[] = [];
  for (let i = 0; i < 51; i += 1) {
    const letter = "ABCDEFG"[i % 7];
    if (letter in nudge) centres.push(-W / 2 + (i + 1) * kw + nudge[letter] * kw);
  }
  const bw = 0.0098;
  const black: P2[] = [
    [centres[0] - 0.012, Lw + spine],
    [centres[centres.length - 1] + 0.012, Lw + spine],
    [centres[centres.length - 1] + 0.012, Lw],
  ];
  for (let j = centres.length - 1; j >= 0; j -= 1) {
    const c = centres[j];
    black.push([c + bw / 2, Lw], [c + bw / 2, Lw - Lb], [c - bw / 2, Lw - Lb], [c - bw / 2, Lw]);
  }
  black.push([centres[0] - 0.012, Lw]);
  const flat: V3 = [-Math.PI / 2, 0, 0];
  return k.group([
    k.extrude(white, 0.022, k.plastic("#f4f1e8", 0.5), { at: [0, -0.011, 0], rot: flat, bevel: 0.0005 }),
    k.extrude(black, 0.017, k.plastic("#121214", 0.75), { at: [0, 0.0045, 0], rot: flat, bevel: 0.0016 }),
  ]);
}

/**
 * A shelf's worth of LPs standing spine out, `w` wide: one block with the
 * spines printed on its face and the sleeve edges on its top, then a few
 * loose sleeves leaning at the open end. Bottom at y = 0, spines at z = d / 2.
 */
function recordRow(k: Kit, w: number, seed: number): THREE.Group {
  const h = 0.315;
  const d = 0.31;
  const rnd = rand(seed);
  const palette = ["#ebe6da", "#1d1d1f", "#b8402f", "#2f4f78", "#d8b54b", "#f3f0e8", "#3f6a4f", "#86405e", "#2a2b2f", "#c9692f", "#7189a8", "#a39c8c", "#e2d3b5", "#5b3b2a"];
  const blockW = w - 0.05;
  // The same sleeves on both prints: each one's colour and thickness.
  const sleeves: { x: number; t: number; col: string; dark: boolean }[] = [];
  for (let x = 0; x < blockW; ) {
    const t = 0.0028 + rnd() * 0.0032 + (rnd() < 0.08 ? 0.006 : 0);
    const col = palette[Math.floor(rnd() * palette.length)];
    sleeves.push({ x, t: Math.min(t, blockW - x), col, dark: rnd() < 0.5 });
    x += t;
  }
  const px = (m: number, W: number) => (m / blockW) * W;
  const spines = canvasTexture(1024, 1024, (c, W, H) => {
    for (const s of sleeves) {
      const x0 = px(s.x, W);
      const x1 = px(s.x + s.t, W);
      c.fillStyle = s.col;
      c.fillRect(x0, 0, x1 - x0, H);
      // Shadow between sleeves, a worn top edge, a line of spine text.
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.fillRect(x1 - 1.5, 0, 1.5, H);
      c.fillStyle = "rgba(0,0,0,0.12)";
      c.fillRect(x0, 0, x1 - x0, 6 + rnd() * 18);
      if (x1 - x0 > 9) {
        c.fillStyle = s.dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
        const y = 120 + rnd() * 420;
        c.fillRect((x0 + x1) / 2 - 1.2, y, 2.4, 140 + rnd() * 260);
      }
    }
  });
  const edges = canvasTexture(1024, 256, (c, W, H) => {
    c.fillStyle = "#1a1715";
    c.fillRect(0, 0, W, H);
    for (const s of sleeves) {
      const x0 = px(s.x, W);
      const x1 = px(s.x + s.t, W);
      c.fillStyle = s.col;
      c.globalAlpha = 0.85;
      c.fillRect(x0 + 0.6, 0, Math.max(1, x1 - x0 - 1.8), H);
    }
    c.globalAlpha = 1;
  });
  const g = k.group([
    k.box(blockW, h - 0.004, d - 0.004, k.paper("#2a2622"), { at: [-w / 2 + blockW / 2, h / 2 - 0.002, 0] }),
    k.plane(blockW, h, k.print(spines, { roughness: 0.8 }), { at: [-w / 2 + blockW / 2, h / 2, d / 2] }),
    k.plane(blockW, d, k.print(edges, { roughness: 0.85 }), { at: [-w / 2 + blockW / 2, h + 0.0005, 0], rot: [-Math.PI / 2, 0, 0] }),
  ]);
  // The last few lean into the gap.
  let x = -w / 2 + blockW;
  for (let i = 0; i < 3; i += 1) {
    const t = 0.004 + rnd() * 0.002;
    const lean = -0.06 - i * 0.07;
    g.add(k.box(t, h, d - 0.01, k.paper(palette[Math.floor(rnd() * palette.length)]), { at: [x + t / 2 + 0.002 + i * 0.006, h / 2 - 0.004 * i, -0.004], rot: [0, 0, lean] }));
    x += t;
  }
  return g;
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/** An oil landscape in short strokes: a lake under an evening sky, far hills, a tree. */
function landscape(): THREE.Texture {
  return canvasTexture(500, 600, (c, w, h) => {
    const rnd = rand(29);
    const horizon = 0.5;
    const ridge = (u: number) => 0.355 + 0.045 * Math.sin(u * 6.1 + 0.8) + 0.022 * Math.sin(u * 15.3 + 2.1) + 0.01 * Math.sin(u * 41);
    const hill = (u: number) => 0.5 - 0.12 * Math.max(0, 1 - Math.abs(u - 0.9) / 0.42) ** 1.4 + 0.006 * Math.sin(u * 50);
    const shore = (u: number) => 0.63 + 0.035 * Math.sin(u * 4.2 + 1.4) + 0.012 * Math.sin(u * 19);
    const SKY_TOP = rgb("#2c5487");
    const SKY_MID = rgb("#7fa2c4");
    const SKY_LOW = rgb("#ecc895");
    const SUN = rgb("#ffe0a6");
    const sky = (u: number, v: number) => {
      const t = Math.min(1, v / horizon);
      let col = t < 0.45 ? mix(SKY_TOP, SKY_MID, t / 0.45) : mix(SKY_MID, SKY_LOW, (t - 0.45) / 0.55);
      const glow = Math.exp(-((u - 0.66) ** 2) * 10 - (v - 0.41) ** 2 * 40);
      col = mix(col, SUN, glow * 0.85);
      const cloud = Math.sin(u * 9 + v * 30) * Math.sin(u * 3.1 - v * 11 + 1) - 0.35;
      if (v > 0.1 && v < 0.3 && cloud > 0) col = mix(col, rgb("#f3d6cf"), Math.min(0.6, cloud * 1.2));
      return col;
    };
    const colour = (u: number, v: number): number[] => {
      if (v < ridge(u) && v < hill(u)) return sky(u, v);
      if (v < hill(u) && v < horizon) return mix(rgb("#5c6690"), rgb("#aaa3bf"), Math.min(1, (v - ridge(u)) / 0.14));
      if (v < horizon || (u > 0.62 && v < shore(u) - 0.01 && v < hill(u) + 0.2 && v < horizon + 0.02)) return mix(rgb("#55703f"), rgb("#33482a"), Math.min(1, (v - hill(u)) / 0.12));
      if (v < shore(u)) {
        const r = sky(u, Math.max(0.02, 2 * horizon - v - 0.04));
        const col = mix(r, rgb("#3d5f86"), 0.25 + (v - horizon) * 1.5);
        return mix(col, SUN, Math.exp(-((u - 0.66) ** 2) * 160) * 0.5);
      }
      const t = (v - shore(u)) / (1 - shore(u));
      return mix(rgb("#7c9446"), rgb("#2f4422"), t * 0.9);
    };
    const dir = (u: number, v: number) => (v < horizon - 0.01 ? (v > ridge(u) ? 0.35 : 0) : v < shore(u) ? 0 : -Math.PI / 2);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      c.fillStyle = css(colour(x / w, y / h));
      c.fillRect(x, y, 4, 4);
    }
    c.lineCap = "round";
    for (let i = 0; i < 9000; i += 1) {
      const u = rnd();
      const v = rnd();
      const col = colour(u, v);
      const j = (rnd() - 0.5) * 26;
      c.strokeStyle = css([col[0] + j, col[1] + j, col[2] + j * 0.8], 0.85);
      c.lineWidth = 1.5 + rnd() * 3.5;
      const len = 5 + rnd() * (v > 0.64 ? 10 : 18);
      const a = dir(u, v) + (rnd() - 0.5) * (v > 0.64 ? 0.9 : 0.3);
      c.beginPath();
      c.moveTo(u * w, v * h);
      c.lineTo(u * w + Math.cos(a) * len, v * h + Math.sin(a) * len);
      c.stroke();
    }
    // Light on the water under the sun.
    for (let i = 0; i < 90; i += 1) {
      const v = horizon + 0.01 + rnd() * 0.12;
      const u = 0.66 + (rnd() - 0.5) * (0.05 + (v - horizon) * 0.8);
      c.strokeStyle = css(rgb("#fff1c8"), 0.6 + rnd() * 0.4);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(u * w, v * h);
      c.lineTo(u * w + 4 + rnd() * 10, v * h);
      c.stroke();
    }
    // Flowers in the meadow.
    for (let i = 0; i < 160; i += 1) {
      const u = rnd();
      const v = 0.72 + rnd() * 0.27;
      c.fillStyle = ["#f4efe2", "#f2c84b", "#e0703c", "#c9b3e0"][Math.floor(rnd() * 4)];
      c.globalAlpha = 0.8;
      c.beginPath();
      c.arc(u * w, v * h, 1.2 + rnd() * 2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // The tree on the left: trunk, then foliage in dabs, lit from the sunset side.
    c.strokeStyle = "#3d2e24";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(0.19 * w, 0.8 * h);
    c.quadraticCurveTo(0.2 * w, 0.6 * h, 0.17 * w, 0.42 * h);
    c.stroke();
    for (let i = 0; i < 1400; i += 1) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd());
      const u = 0.17 + Math.cos(a) * d * 0.15;
      const v = 0.36 + Math.sin(a) * d * 0.17;
      const lit = Math.max(0, Math.cos(a) * d);
      c.fillStyle = css(mix(rgb("#22361f"), rgb("#7f9a4a"), lit * 0.8 + rnd() * 0.15), 0.9);
      c.beginPath();
      c.ellipse(u * w, v * h, 2 + rnd() * 4, 1.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // Canvas weave under the paint.
    c.globalAlpha = 0.05;
    c.fillStyle = "#000";
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h);
    c.globalAlpha = 1;
  });
}

/** A record seen from above: fine grooves, the bands between tracks, the sheen, a label. */
function recordFace(label: string, artist: string, hue: string): THREE.Texture {
  return canvasTexture(512, 512, (c, w) => {
    const r = w / 2;
    const rnd = rand(53);
    c.fillStyle = "#0a0a0b";
    c.fillRect(0, 0, w, w);
    const tracks = [0.97, 0.86, 0.77, 0.66, 0.58, 0.49];
    for (let rr = r * 0.975; rr > r * 0.36; rr -= 1.1) {
      const gapBand = tracks.some((t) => Math.abs(rr / r - t) < 0.006);
      c.strokeStyle = gapBand ? "rgba(255,255,255,0.0)" : `rgba(255,255,255,${0.025 + rnd() * 0.045})`;
      c.lineWidth = 0.6;
      c.beginPath();
      c.arc(r, r, rr, 0, Math.PI * 2);
      c.stroke();
    }
    // The light bar the grooves throw back.
    for (const base of [0.55, 0.55 + Math.PI]) {
      const g = c.createRadialGradient(r, r, r * 0.36, r, r, r);
      g.addColorStop(0, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0.02)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(r, r);
      c.arc(r, r, r * 0.975, base - 0.18, base + 0.18);
      c.closePath();
      c.fill();
    }
    c.fillStyle = hue;
    c.beginPath();
    c.arc(r, r, r * 0.34, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.25)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(r, r, r * 0.3, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#f7f1e3";
    c.textAlign = "center";
    c.font = `700 22px ${SANS}`;
    c.fillText(label, r, r - 34);
    c.font = `500 15px ${SANS}`;
    c.fillText(artist, r, r - 12);
    c.font = `600 12px ${SANS}`;
    c.fillText("SIDE A", r - 52, r + 44);
    c.fillText("33 1/3", r + 52, r + 44);
    c.fillStyle = "#111";
    c.beginPath();
    c.arc(r, r, 5, 0, Math.PI * 2);
    c.fill();
  });
}

// ---------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------

export const STUDIO_ITEMS: Record<string, ItemModel> = {
  easel: {
    size: [0.61, 1.81, 0.66],
    build(k, o) {
      const wood = k.wood(o.color ?? "#b58a5c", { gloss: 0.3 });
      const brass = k.metal("brass");
      const t = 0.16; // the front frame leans back about nine degrees
      const zf = 0.32; // where the front feet stand
      const ct = Math.cos(t);
      const st = Math.sin(t);
      /** A point in the leaning front frame, in the piece's own space. */
      const fw = (x: number, y: number, z: number): V3 => [x, y * ct + z * st, zf - y * st + z * ct];
      const frame = new THREE.Group();
      frame.position.set(0, 0, zf);
      frame.rotation.set(-t, 0, 0);
      const L = 1.64;
      frame.add(
        bar(k, [-0.285, 0.004, 0], [-0.05, L, 0], 0.034, 0.024, wood),
        bar(k, [0.285, 0.004, 0], [0.05, L, 0], 0.034, 0.024, wood),
        // The mast the canvas clamp slides on, and the crossbars that hold the legs together.
        k.box(0.042, 1.6, 0.024, wood, { at: [0, 1.03, 0.006], r: 0.003 }),
        k.box(0.5, 0.032, 0.022, wood, { at: [0, 0.24, 0], r: 0.003 }),
        k.box(0.15, 0.05, 0.03, wood, { at: [0, L - 0.04, -0.002], r: 0.004 }),
        // The tray, level with the floor, and its lip.
        k.box(0.6, 0.018, 0.085, wood, { at: [0, 0.715, 0.05], rot: [t, 0, 0], r: 0.003 }),
        k.box(0.6, 0.03, 0.012, wood, { at: [0, 0.735, 0.09], rot: [t, 0, 0], r: 0.003 }),
        k.box(0.07, 0.07, 0.03, wood, { at: [0, 0.69, 0.01], r: 0.004 }),
        k.cyl(0.016, 0.016, 0.014, brass, { at: [0.05, 0.69, 0.012], rot: [Math.PI / 2, 0, 0], seg: 16 })
      );
      // The canvas: linen over a stretcher, the painting on its face, held by the top clamp.
      const cy = 0.73 + 0.3;
      frame.add(
        k.box(0.5, 0.6, 0.025, k.fabric("#e9e2d2"), { at: [0, cy, 0.0305], r: 0.002 }),
        k.plane(0.496, 0.596, k.print(landscape(), { roughness: 0.55 }), { at: [0, cy, 0.0435] }),
        k.box(0.05, 0.036, 0.06, wood, { at: [0, cy + 0.3 + 0.012, 0.03], r: 0.005 }),
        k.cyl(0.015, 0.015, 0.012, brass, { at: [0, cy + 0.312, 0.066], rot: [Math.PI / 2, 0, 0], seg: 16 }),
        k.box(0.05, 0.05, 0.004, brass, { at: [0, L - 0.05, -0.019], r: 0.002 })
      );
      // Two brushes and a tube of paint on the tray.
      const brush = (x: number, z: number, turn: number, tip: string) => {
        const b = new THREE.Group();
        b.add(
          k.cyl(0.0035, 0.005, 0.17, k.paint("#7a2e22", 0.6), { at: [0, 0, 0], rot: [0, 0, Math.PI / 2], seg: 10 }),
          k.cyl(0.0042, 0.0042, 0.025, k.metal("silver"), { at: [0.097, 0, 0], rot: [0, 0, Math.PI / 2], seg: 10 }),
          k.cyl(0.0012, 0.0045, 0.02, k.paint(tip, 0.4), { at: [0.12, 0, 0], rot: [0, 0, Math.PI / 2], seg: 10 })
        );
        b.position.set(x, 0.734 + (0.05 - z) * Math.tan(t), z);
        b.rotation.set(t, turn, 0);
        frame.add(b);
      };
      brush(-0.12, 0.04, 0.08, "#c98a3a");
      brush(0.06, 0.06, -0.12, "#3f6d8f");
      frame.add(
        k.cyl(0.011, 0.011, 0.075, k.metal("silver", 0.3), { at: [0.2, 0.741, 0.045], rot: [t, 0.3, Math.PI / 2], seg: 14 }),
        k.cyl(0.006, 0.006, 0.014, k.plastic("#1d1d1f"), { at: [0.158, 0.741, 0.058], rot: [t, 0.3, Math.PI / 2], seg: 10 })
      );
      // The back leg on its brass hinge, and the stay that sets the angle.
      const hinge = fw(0, 1.56, -0.03);
      const foot: V3 = [0, 0.004, -0.31];
      const onBack = (y: number): V3 => {
        const f = (y - foot[1]) / (hinge[1] - foot[1]);
        return [0, y, foot[2] + (hinge[2] - foot[2]) * f + 0.006];
      };
      const g = k.group([frame]);
      g.add(bar(k, hinge, foot, 0.034, 0.024, wood), bar(k, fw(0, 0.62, -0.014), onBack(0.6), 0.022, 0.012, wood));
      return g;
    },
  },

  "record-player": {
    size: [0.8, 0.79, 0.43],
    build(k, o) {
      const cab = k.wood(o.color ?? "#6b4630", { gloss: 0.45 });
      const brass = k.metal("brass");
      const chrome = k.metal("chrome");
      const y0 = 0.18; // the cabinet stands on legs this tall
      const g = k.group([
        // The cabinet, open at the front: top, bottom, sides, back and a divider.
        k.box(0.8, 0.026, 0.42, cab, { at: [0, y0 + 0.427, 0], r: 0.006 }),
        k.box(0.8, 0.026, 0.42, cab, { at: [0, y0 + 0.013, 0], r: 0.006 }),
        k.box(0.026, 0.44, 0.42, cab, { at: [-0.387, y0 + 0.22, 0], r: 0.006 }),
        k.box(0.026, 0.44, 0.42, cab, { at: [0.387, y0 + 0.22, 0], r: 0.006 }),
        k.box(0.75, 0.39, 0.012, k.wood("#5a3a28", { gloss: 0.2 }), { at: [0, y0 + 0.22, -0.2] }),
        k.box(0.02, 0.39, 0.4, cab, { at: [0, y0 + 0.22, 0.0], r: 0.004 }),
      ]);
      // Splayed tapered legs with brass caps.
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const top: V3 = [sx * 0.34, y0 + 0.002, sz * 0.16];
          const foot: V3 = [sx * 0.372, 0.03, sz * 0.182];
          g.add(rod(k, foot, top, 0.011, cab, 0.017, 16));
          g.add(rod(k, [sx * 0.374, 0.0, sz * 0.184], foot, 0.0105, brass, 0.011, 16));
        }
      // Records standing in both halves, spines out.
      for (const side of [-1, 1]) {
        const row = recordRow(k, 0.355, side < 0 ? 71 : 113);
        row.position.set(side * 0.1925, y0 + 0.026, 0.035);
        g.add(row);
      }
      // The turntable: gloss black plinth on four feet, platter, mat, record and spindle.
      const top = y0 + 0.44;
      const deck = top + 0.018 + 0.085;
      g.add(
        k.box(0.45, 0.085, 0.36, k.plastic("#141416", 0.85), { at: [0, top + 0.018 + 0.0425, -0.01], r: 0.008 }),
        k.box(0.446, 0.003, 0.356, k.metal("steel", 0.38), { at: [0, deck + 0.0015, -0.01], r: 0.001 })
      );
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(k.cyl(0.022, 0.024, 0.018, k.metal("black"), { at: [sx * 0.19, top + 0.009, sz * 0.14 - 0.01] }));
      const px = -0.05;
      const pz = -0.005;
      g.add(
        k.cyl(0.152, 0.152, 0.022, k.metal("steel", 0.25), { at: [px, deck + 0.003 + 0.011, pz], seg: 64 }),
        k.cyl(0.149, 0.149, 0.003, k.rubber("#232325"), { at: [px, deck + 0.0255, pz], seg: 64 }),
        k.cyl(0.1505, 0.1505, 0.002, k.plastic("#0b0b0c", 0.9), { at: [px, deck + 0.028, pz], seg: 64 }),
        k.disc(0.1505, k.print(recordFace("VERTEX FORM", "The Parabolas", "#c8452f"), { roughness: 0.3 }), { at: [px, deck + 0.0296, pz], rot: [-Math.PI / 2, 0, 0], seg: 64 }),
        k.cyl(0.0036, 0.0036, 0.018, chrome, { at: [px, deck + 0.034, pz], seg: 12 })
      );
      // Tonearm, parked on its rest: pillar, S-shaped arm, headshell and cartridge, counterweight.
      const ax = 0.165;
      const az = -0.12;
      const ay = deck + 0.045;
      g.add(
        k.cyl(0.024, 0.027, 0.03, k.metal("black"), { at: [ax, deck + 0.018, az], seg: 24 }),
        k.cyl(0.014, 0.014, 0.02, chrome, { at: [ax, deck + 0.04, az], seg: 20 }),
        k.tube([[ax, ay, az], [ax + 0.004, ay, az + 0.07], [ax + 0.016, ay - 0.001, az + 0.15], [ax + 0.008, ay - 0.003, az + 0.215]], 0.0042, chrome, { seg: 24 }),
        k.box(0.02, 0.006, 0.046, k.metal("black"), { at: [ax + 0.006, ay - 0.004, az + 0.24], rot: [0, 0.25, 0], r: 0.002 }),
        k.box(0.016, 0.014, 0.022, k.plastic("#8f1d1d", 0.7), { at: [ax + 0.006, ay - 0.014, az + 0.245], rot: [0, 0.25, 0], r: 0.002 }),
        k.tube([[ax + 0.014, ay - 0.004, az + 0.255], [ax + 0.026, ay + 0.002, az + 0.262], [ax + 0.034, ay + 0.004, az + 0.262]], 0.0015, chrome, { seg: 8 }),
        k.tube([[ax, ay, az], [ax - 0.002, ay, az - 0.05]], 0.0042, chrome, { seg: 4 }),
        k.cyl(0.017, 0.017, 0.03, k.metal("steel", 0.3), { at: [ax - 0.002, ay, az - 0.06], rot: [Math.PI / 2, 0, 0], seg: 24 }),
        k.cyl(0.004, 0.004, 0.032, chrome, { at: [ax + 0.012, deck + 0.016, az + 0.19], seg: 10 }),
        k.box(0.016, 0.006, 0.012, k.rubber(), { at: [ax + 0.012, deck + 0.034, az + 0.19], r: 0.002 })
      );
      // Start button, the two speeds, and the pitch slider.
      g.add(
        k.box(0.05, 0.006, 0.026, k.plastic("#2a2a2d", 0.6), { at: [-0.175, deck + 0.003, 0.15], r: 0.002 }),
        k.box(0.022, 0.006, 0.014, k.plastic("#2a2a2d", 0.6), { at: [-0.12, deck + 0.003, 0.155], r: 0.002 }),
        k.box(0.022, 0.006, 0.014, k.plastic("#2a2a2d", 0.6), { at: [-0.093, deck + 0.003, 0.155], r: 0.002 }),
        k.box(0.012, 0.002, 0.09, k.plastic("#0c0c0d", 0.3), { at: [0.207, deck + 0.004, 0.09] }),
        k.box(0.02, 0.012, 0.012, k.metal("steel", 0.3), { at: [0.207, deck + 0.008, 0.08], r: 0.002 }),
        k.sphere(0.004, k.glow("#ff5a3c", o.on, 2), { at: [-0.205, deck + 0.004, 0.12], seg: 10 })
      );
      // The power cable, down the back of the cabinet to the floor.
      g.add(k.tube([[0.12, top + 0.06, -0.19], [0.13, top + 0.04, -0.212], [0.14, top - 0.05, -0.214], [0.15, 0.3, -0.214], [0.16, 0.03, -0.212], [0.2, 0.004, -0.2]], 0.0025, k.rubber("#151515"), { seg: 40 }));
      return g;
    },
  },

  keyboard: {
    size: [1.33, 0.82, 0.45],
    build(k, o) {
      const body = o.color ?? "#1e1f22";
      const shell = k.plastic(body, 0.35);
      const steel = k.metal("black", 0.45);
      const rubber = k.rubber("#1a1a1a");
      const yk = 0.775; // top of the white keys
      const zk = 0.115; // key fronts
      const keys = keys88(k);
      keys.position.set(0, yk, zk);
      const g = k.group([
        keys,
        // Base under the keys, the raised panel behind them, end cheeks, and the red felt strip.
        k.box(1.33, 0.05, 0.27, shell, { at: [0, yk - 0.022 - 0.025 - 0.001, -0.02], r: 0.008 }),
        k.box(1.33, 0.1, 0.13, shell, { at: [0, yk - 0.02, -0.09], r: 0.01 }),
        k.box(0.05, 0.075, 0.245, shell, { at: [-0.64, yk - 0.03, -0.005], r: 0.012 }),
        k.box(0.05, 0.075, 0.245, shell, { at: [0.64, yk - 0.03, -0.005], r: 0.012 }),
        k.box(1.23, 0.008, 0.006, k.velvet("#5c1a1f"), { at: [0, yk + 0.017, -0.024] }),
      ]);
      // The panel's face: speaker grilles, buttons, the volume slot, a model name.
      const panel = canvasTexture(2048, 200, (c, w, h) => {
        c.fillStyle = body;
        c.fillRect(0, 0, w, h);
        const dark = css(mix(rgb(body), [0, 0, 0], 0.65));
        const light = css(mix(rgb(body), [255, 255, 255], 0.55));
        for (const x0 of [50, w - 410]) {
          c.fillStyle = css(mix(rgb(body), [0, 0, 0], 0.25));
          c.fillRect(x0 - 10, 40, 370, 120);
          c.fillStyle = dark;
          for (let y = 52; y < 156; y += 11) for (let x = x0; x < x0 + 350; x += 11) {
            c.beginPath();
            c.arc(x + ((y / 11) % 2) * 5, y, 3.2, 0, Math.PI * 2);
            c.fill();
          }
        }
        c.fillStyle = light;
        c.font = `600 22px ${SANS}`;
        const labels = ["GRAND", "E.PIANO", "ORGAN", "STRINGS", "METRONOME", "REC", "PLAY"];
        labels.forEach((t, i) => {
          const x = 730 + i * 88;
          c.fillStyle = css(mix(rgb(body), [255, 255, 255], 0.12));
          c.fillRect(x, 96, 60, 34);
          c.fillStyle = light;
          c.textAlign = "center";
          c.fillText(t, x + 30, 84);
        });
        c.fillStyle = dark;
        c.fillRect(520, 110, 160, 10);
        c.textAlign = "left";
        c.fillStyle = light;
        c.fillText("VOLUME", 520, 84);
        c.strokeStyle = light;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(450, 115, 16, 0, Math.PI * 2);
        c.stroke();
        c.fillText("POWER", 412, 84);
        c.font = `700 24px ${SANS}`;
        c.fillText("STAGE 88", 730, 178);
      });
      g.add(k.plane(1.24, 0.121, k.print(panel, { roughness: 0.6 }), { at: [0, yk + 0.0305, -0.09], rot: [-Math.PI / 2, 0, 0] }));
      // Display, power light, volume slider.
      const lcd = o.on
        ? canvasTexture(256, 96, (c, w, h) => {
            c.fillStyle = "#0d2a3a";
            c.fillRect(0, 0, w, h);
            c.fillStyle = "#9fe3ff";
            c.font = `700 30px ${SANS}`;
            c.fillText("Grand 1", 16, 42);
            c.font = `500 22px ${SANS}`;
            c.fillText("Tempo 96   Vol 12", 16, 78);
          })
        : undefined;
      g.add(
        k.box(0.13, 0.004, 0.05, k.plastic("#0b0b0c", 0.8), { at: [0.26, yk + 0.031, -0.09], r: 0.001 }),
        k.plane(0.12, 0.044, k.screen(o.on, lcd, 1.1), { at: [0.26, yk + 0.0335, -0.09], rot: [-Math.PI / 2, 0, 0] }),
        k.sphere(0.0035, k.glow("#5dff8a", o.on, 2.4), { at: [-0.347, yk + 0.031, -0.0925], seg: 10 }),
        k.box(0.016, 0.01, 0.012, k.metal("steel", 0.3), { at: [-0.27, yk + 0.034, -0.0815], r: 0.002 })
      );
      // The X stand: two crossing steel tubes, feet and arms along the depth with rubber ends.
      const half = 0.43;
      g.add(
        bar(k, [-half, 0.035, 0.026], [half, yk - 0.108, 0.026], 0.04, 0.025, steel, 0.006),
        bar(k, [half, 0.035, -0.026], [-half, yk - 0.108, -0.026], 0.04, 0.025, steel, 0.006),
        k.cyl(0.02, 0.02, 0.09, k.plastic("#18181a", 0.4), { at: [0, (yk - 0.073) / 2, 0], rot: [Math.PI / 2, 0, 0], seg: 18 }),
        k.cyl(0.026, 0.026, 0.022, k.plastic("#232326", 0.4), { at: [0, (yk - 0.073) / 2, 0.055], rot: [Math.PI / 2, 0, 0], seg: 18 })
      );
      for (const sx of [-1, 1]) {
        g.add(
          k.box(0.035, 0.03, 0.42, steel, { at: [sx * half, 0.017, 0], r: 0.006 }),
          k.cyl(0.019, 0.019, 0.36, rubber, { at: [sx * half, yk - 0.093, -0.01], rot: [Math.PI / 2, 0, 0], seg: 18 }),
          k.box(0.04, 0.02, 0.04, steel, { at: [sx * half, yk - 0.112, 0], r: 0.004 })
        );
        for (const sz of [-1, 1]) g.add(k.box(0.042, 0.036, 0.03, rubber, { at: [sx * half, 0.018, sz * 0.205], r: 0.008 }));
      }
      // The sustain pedal on the floor, its cable up to the back of the keyboard.
      g.add(
        k.box(0.08, 0.025, 0.14, k.plastic("#1a1a1c", 0.4), { at: [0.2, 0.0125, 0.15], rot: [0, -0.15, 0], r: 0.008 }),
        k.box(0.07, 0.008, 0.11, k.metal("chrome", 0.15), { at: [0.2, 0.03, 0.155], rot: [-0.08, -0.15, 0], r: 0.003 }),
        k.tube([[0.21, 0.016, 0.075], [0.25, 0.012, 0.0], [0.33, 0.014, -0.09], [0.4, 0.25, -0.14], [0.45, yk - 0.08, -0.15]], 0.003, k.rubber("#111"), { seg: 40 })
      );
      return g;
    },
  },

  "ring-light": {
    size: [0.73, 1.77, 0.64],
    light: { at: [0, 1.54, 0.25], color: "#fff4e4", intensity: 2.6, distance: 4 },
    build(k, o) {
      const housing = k.plastic(o.color ?? "#1c1c1f", 0.3);
      const pole = k.metal("black", 0.45);
      const knob = k.plastic("#161618", 0.4);
      const zc = 0.1; // the stand's centre, so the footprint is centred
      const yc = 1.54; // the ring's centre
      const g = k.group([]);
      // Tripod: three legs from a collar, struts from a lower collar, rubber feet.
      const hub = 0.46;
      for (let i = 0; i < 3; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const foot: V3 = [ca * 0.4, 0.012, zc + sa * 0.4];
        g.add(
          rod(k, [ca * 0.02, hub, zc + sa * 0.02], foot, 0.0075, pole),
          rod(k, [ca * 0.018, 0.29, zc + sa * 0.018], [ca * 0.235, 0.19, zc + sa * 0.235], 0.005, pole),
          k.cyl(0.012, 0.014, 0.024, k.rubber(), { at: [ca * 0.405, 0.012, zc + sa * 0.405] })
        );
      }
      g.add(
        k.cyl(0.022, 0.022, 0.05, knob, { at: [0, hub, zc] }),
        k.cyl(0.02, 0.02, 0.03, knob, { at: [0, 0.29, zc] }),
        // The pole in three sections, each lock with its knob.
        k.cyl(0.0125, 0.0125, 0.82, pole, { at: [0, 0.06 + 0.41, zc] }),
        k.cyl(0.0105, 0.0105, 0.34, pole, { at: [0, 0.88 + 0.17, zc] }),
        k.cyl(0.009, 0.009, 0.06, pole, { at: [0, 1.22 + 0.03, zc] }),
        k.cyl(0.018, 0.018, 0.04, knob, { at: [0, 0.88, zc] }),
        k.cyl(0.016, 0.016, 0.036, knob, { at: [0, 1.22, zc] }),
        k.cyl(0.008, 0.008, 0.03, knob, { at: [0.025, 0.88, zc], rot: [0, 0, Math.PI / 2] }),
        k.cyl(0.007, 0.007, 0.028, knob, { at: [0.023, 1.22, zc], rot: [0, 0, Math.PI / 2] })
      );
      // The tilt head under the ring, with its big knob, and the ring's mounting plate.
      g.add(
        k.box(0.05, 0.04, 0.04, knob, { at: [0, 1.285, zc], r: 0.006 }),
        k.cyl(0.016, 0.016, 0.02, knob, { at: [0.035, 1.285, zc], rot: [0, 0, Math.PI / 2], seg: 18 }),
        k.box(0.06, 0.014, 0.05, housing, { at: [0, yc - 0.226 - 0.004, zc], r: 0.004 })
      );
      // The ring: a flat housing with the diffuser glowing on its face.
      g.add(
        k.extrude(circle(0.224, 128), 0.034, housing, { at: [0, yc, zc], bevel: 0.004, holes: [circle(0.176, 128)] }),
        k.torus(0.2, 0.0215, k.glow("#fff6ea", o.on, 2.6), { at: [0, yc, zc + 0.017], scale: [1, 1, 0.32], seg: 96 })
      );
      // The phone holder: a rod up from the head to the middle, a ball joint, a clamp, a phone.
      const pz = zc + 0.045;
      const screen = o.on
        ? canvasTexture(264, 572, (c, w, h) => {
            const bg = c.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, "#c9a27c");
            bg.addColorStop(0.55, "#8a6a55");
            bg.addColorStop(1, "#3b2f2a");
            c.fillStyle = bg;
            c.fillRect(0, 0, w, h);
            const rnd = rand(9);
            for (let i = 0; i < 9; i += 1) {
              c.fillStyle = `rgba(255,236,200,${0.12 + rnd() * 0.15})`;
              c.beginPath();
              c.arc(rnd() * w, rnd() * h * 0.5, 14 + rnd() * 30, 0, Math.PI * 2);
              c.fill();
            }
            c.fillStyle = "rgba(0,0,0,0.45)";
            c.fillRect(0, 0, w, 64);
            c.fillRect(0, h - 120, w, 120);
            c.fillStyle = "#ff3b30";
            c.beginPath();
            c.arc(30, 36, 8, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#fff";
            c.font = `600 22px ${SANS}`;
            c.fillText("REC 00:12", 46, 44);
            c.strokeStyle = "#fff";
            c.lineWidth = 5;
            c.beginPath();
            c.arc(w / 2, h - 60, 34, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = "#ff3b30";
            c.beginPath();
            c.arc(w / 2, h - 60, 18, 0, Math.PI * 2);
            c.fill();
          })
        : undefined;
      g.add(
        k.box(0.03, 0.03, 0.05, knob, { at: [0, 1.295, zc + 0.03], r: 0.005 }),
        rod(k, [0, 1.3, pz], [0, yc - 0.03, pz], 0.006, pole),
        k.sphere(0.012, k.metal("black", 0.3), { at: [0, yc - 0.028, pz] }),
        k.box(0.084, 0.024, 0.014, knob, { at: [0, yc - 0.01, pz + 0.006], r: 0.004 }),
        k.box(0.081, 0.158, 0.009, k.plastic("#1b1c1e", 0.7), { at: [0, yc + 0.045, pz + 0.017], r: 0.007 }),
        k.plane(0.072, 0.15, k.screen(o.on, screen, 1.1), { at: [0, yc + 0.045, pz + 0.0223] }),
        k.box(0.012, 0.02, 0.018, knob, { at: [-0.046, yc + 0.045, pz + 0.012], r: 0.003 }),
        k.box(0.012, 0.02, 0.018, knob, { at: [0.046, yc + 0.045, pz + 0.012], r: 0.003 })
      );
      // The cable down the pole, through the dimmer, off along the floor.
      g.add(
        k.tube([[0.02, 1.27, zc - 0.02], [0.022, 1.1, zc - 0.022], [0.024, 0.8, zc - 0.024], [0.03, 0.5, zc - 0.03], [0.05, 0.2, zc - 0.06], [0.08, 0.02, zc - 0.2], [0.1, 0.005, zc - 0.4]], 0.0026, k.rubber("#121212"), { seg: 48 }),
        k.box(0.032, 0.08, 0.022, knob, { at: [0.024, 0.8, zc - 0.03], r: 0.006 })
      );
      return g;
    },
  },

  guitar: {
    size: [0.43, 1.08, 0.53],
    build(k, o) {
      const finish = k.plastic(o.color ?? "#9a1d1d", 0.92);
      const chrome = k.metal("chrome");
      const white = k.plastic("#f1efe8", 0.5);
      const maple = k.wood("maple", { gloss: 0.6 });
      const steel = k.metal("black", 0.4);
      const rubber = k.rubber("#262626");
      const mm = (pts: P2[]): P2[] => pts.map(([x, y]) => [x / 1000, y / 1000]);
      // The guitar is built standing up in its own space: x across (bass side to the left), y along it from the body's bottom, z out of its face.
      const body = smoothLoop(
        mm([
          [0, 0], [60, 3], [110, 18], [143, 48], [158, 90], [162, 135], [154, 180], [136, 218], [118, 248], [114, 272], [124, 305],
          [132, 340], [133, 370], [125, 392], [110, 400], [95, 390], [78, 372], [58, 362], [40, 362], [28, 370], [-28, 370], [-34, 372],
          [-50, 385], [-66, 405], [-80, 432], [-92, 452], [-108, 458], [-125, 448], [-138, 420], [-142, 385], [-136, 345], [-124, 308],
          [-118, 278], [-122, 252], [-138, 222], [-156, 182], [-164, 135], [-160, 90], [-143, 48], [-110, 18], [-60, 3],
        ]),
        5
      );
      const guard = smoothLoop(
        mm([
          [-29, 366], [-44, 378], [-58, 393], [-72, 410], [-88, 414], [-100, 398], [-104, 360], [-98, 320], [-95, 280], [-101, 240],
          [-104, 200], [-96, 170], [-78, 150], [-45, 138], [-38, 128], [38, 128], [46, 122], [50, 96], [60, 64], [80, 40], [100, 34],
          [116, 50], [118, 90], [114, 130], [108, 175], [104, 220], [102, 270], [100, 318], [92, 345], [72, 350], [50, 352], [32, 360],
        ]),
        4
      );
      const gtr = k.group([
        k.extrude(body, 0.045, finish, { bevel: 0.009 }),
        k.extrude(guard, 0.0025, white, { at: [0, 0, 0.0237], bevel: 0.0006 }),
      ]);
      // Three single-coil pickups (the bridge one slanted), three knobs, the switch.
      for (const [y, a] of [[0.262, 0], [0.208, 0], [0.155, 0.14]] as [number, number][]) {
        gtr.add(k.box(0.071, 0.018, 0.007, white, { at: [0, y, 0.0275], rot: [0, 0, a], r: 0.0032 }));
      }
      for (const [x, y] of [[0.066, 0.108], [0.085, 0.076], [0.1, 0.045]]) gtr.add(k.cyl(0.0095, 0.0105, 0.017, white, { at: [x, y, 0.033], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      gtr.add(k.box(0.006, 0.006, 0.014, white, { at: [0.078, 0.148, 0.03], rot: [0.5, 0, 0.6], r: 0.002 }));
      // Bridge, saddles, tremolo arm, the jack, strap buttons.
      gtr.add(
        k.box(0.074, 0.038, 0.004, chrome, { at: [0, 0.112, 0.0245], r: 0.0015 }),
        k.box(0.06, 0.012, 0.01, chrome, { at: [0, 0.117, 0.03], r: 0.002 }),
        k.tube([[0.03, 0.098, 0.027], [0.044, 0.094, 0.04], [0.07, 0.07, 0.046], [0.1, 0.035, 0.044]], 0.0022, chrome, { seg: 16 }),
        k.cyl(0.0035, 0.0035, 0.022, white, { at: [0.108, 0.026, 0.044], rot: [0, 0, 0.75], seg: 10 }),
        k.cyl(0.012, 0.012, 0.005, chrome, { at: [0.135, 0.075, 0.023], rot: [Math.PI / 2, 0, 0], seg: 20 }),
        k.cyl(0.005, 0.005, 0.012, chrome, { at: [0, -0.012, 0], seg: 12 }),
        k.cyl(0.005, 0.005, 0.012, chrome, { at: [-0.118, 0.468, 0], rot: [0, 0, 0.6], seg: 12 })
      );
      // The neck: maple, a rosewood board with frets and dots, the nut, the headstock with its tuners.
      const yEnd = 0.296;
      const yNut = 0.761;
      // The bevel rounds the neck's back and adds its width again, so the outline is drawn that much narrower.
      const neck: P2[] = [[-0.023, 0.3], [0.023, 0.3], [0.016, yNut], [-0.016, yNut]];
      gtr.add(k.extrude(neck, 0.024, maple, { at: [0, 0, 0.012], bevel: 0.005 }));
      const board = canvasTexture(128, 1024, (c, w, h) => {
        c.fillStyle = "#3a2318";
        c.fillRect(0, 0, w, h);
        const rnd = rand(5);
        for (let i = 0; i < 160; i += 1) {
          c.strokeStyle = `rgba(20,10,6,${0.15 + rnd() * 0.3})`;
          c.lineWidth = 0.5 + rnd();
          const x = rnd() * w;
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x + (rnd() - 0.5) * 8, h);
          c.stroke();
        }
        const len = yNut - yEnd;
        const at = (n: number) => ((0.648 * (1 - 2 ** (-n / 12))) / len) * h;
        for (let n = 1; n <= 21; n += 1) {
          const y = at(n);
          c.fillStyle = "#4a3a30";
          c.fillRect(0, y + 2, w, 3);
          c.fillStyle = "#e6e4df";
          c.fillRect(0, y - 2, w, 4);
        }
        c.fillStyle = "#efe9dc";
        for (const n of [3, 5, 7, 9, 15, 17, 19, 21]) {
          const y = (at(n - 1) + at(n)) / 2;
          c.beginPath();
          c.arc(w / 2, y, 7, 0, Math.PI * 2);
          c.fill();
        }
        const y12 = (at(11) + at(12)) / 2;
        for (const x of [w * 0.3, w * 0.7]) {
          c.beginPath();
          c.arc(x, y12, 7, 0, Math.PI * 2);
          c.fill();
        }
      });
      // The board is printed: an outline from 0 to 1, scaled to its real taper and length.
      const bl = yNut - yEnd;
      const taper = (0.056 - 0.042) / 2 / 0.056;
      gtr.add(
        k.extrude([[0, 0], [1, 0], [1 - taper, 1], [taper, 1]], 1, k.print(board, { roughness: 0.55 }), { at: [-0.028, yEnd, 0.0275], scale: [0.056, bl, 0.006], bevel: 0 }),
        k.box(0.043, 0.004, 0.0055, k.plastic("#efe8d6", 0.4), { at: [0, yNut + 0.001, 0.0322], r: 0.001 })
      );
      const head = smoothLoop(mm([[21, 761], [23, 800], [27, 860], [31, 905], [27, 942], [12, 958], [-10, 962], [-31, 952], [-44, 928], [-47, 892], [-42, 850], [-36, 812], [-28, 788], [-21, 774]]), 5);
      gtr.add(k.extrude(head, 0.014, maple, { at: [0, 0, 0.017], bevel: 0.003 }));
      const posts: V3[] = [];
      for (let i = 0; i < 6; i += 1) {
        const y = 0.792 + i * 0.0285;
        const x = -0.027 - Math.sin(((i + 0.5) / 6) * Math.PI) * 0.006;
        posts.push([x, y, 0.034]);
        gtr.add(
          k.cyl(0.004, 0.0045, 0.012, chrome, { at: [x, y, 0.028], rot: [Math.PI / 2, 0, 0], seg: 12 }),
          k.box(0.018, 0.0045, 0.012, chrome, { at: [-0.058, y, 0.007], r: 0.002 })
        );
      }
      // Six strings, from the saddles over the nut to the posts.
      for (let i = 0; i < 6; i += 1) {
        const xs = -0.026 + i * 0.0104;
        const xn = -0.018 + i * 0.0072;
        const post = posts[i];
        gtr.add(
          k.tube([[xs, 0.117, 0.0356], [xn + (xs - xn) * 0.02, yNut - 0.014, 0.0352], [xn, yNut, 0.0352], [post[0] + 0.004, post[1], post[2]]], i < 3 ? 0.0011 : 0.0008, k.metal("silver", 0.25), { seg: 24 })
        );
      }
      // Leaning back in its stand; everything moves forward by dz so the footprint is centred.
      const dz = 0.1;
      const lean = 0.24;
      const gy = 0.133;
      const gz = 0.11 + dz;
      gtr.position.set(0, gy, gz);
      gtr.rotation.set(-lean, 0, 0);
      const cl = Math.cos(lean);
      const sl = Math.sin(lean);
      /** A point in the guitar's own space, in the piece's. */
      const gw = (x: number, y: number, z: number): V3 => [x, gy + y * cl + z * sl, gz - y * sl + z * cl];
      const g = k.group([gtr]);
      // The stand: a tripod, a post behind the body, a padded yoke round the neck, padded arms under the body.
      const hubY = 0.12;
      const hubZ = -0.12 + dz;
      const yoke = [gw(-0.033, 0.6, 0.02), gw(-0.031, 0.6, -0.002), gw(0, 0.6, -0.0078), gw(0.031, 0.6, -0.002), gw(0.033, 0.6, 0.02)];
      const under = gw(0, 0.6, -0.016);
      const postTop: V3 = [0, under[1] - 0.04, hubZ];
      g.add(
        rod(k, [0, hubY - 0.03, hubZ], postTop, 0.009, steel),
        k.cyl(0.016, 0.016, 0.04, k.plastic("#18181a", 0.4), { at: [0, hubY, hubZ] }),
        k.tube([postTop, [0, postTop[1] + 0.03, hubZ + 0.01], [0, under[1] - 0.006, (hubZ + under[2]) / 2], under], 0.008, steel, { seg: 16 }),
        k.tube(yoke, 0.0075, rubber, { seg: 24 })
      );
      for (const sx of [-1, 1]) {
        const back = gw(sx * 0.1, 0.006, -0.0225);
        const front = gw(sx * 0.1, 0.006, 0.0225);
        const r = 0.011;
        g.add(
          k.tube([[0, hubY, hubZ], [sx * 0.05, hubY - 0.012, hubZ + 0.07], [sx * 0.09, back[1] - r - 0.004, back[2] - 0.07], [sx * 0.1, back[1] - r, back[2] - 0.03]], 0.0075, steel, { seg: 20 }),
          k.tube([[sx * 0.1, back[1] - r, back[2] - 0.032], [sx * 0.1, back[1] - r, back[2]], [sx * 0.1, front[1] - r + 0.002, front[2] + 0.006], [sx * 0.1, front[1] + 0.014, front[2] + r + 0.002], [sx * 0.1, front[1] + 0.03, front[2] + r + 0.004]], r, rubber, { seg: 20 })
        );
      }
      for (const [fx, fz] of [[0, -0.36 + dz], [-0.2, 0.02 + dz], [0.2, 0.02 + dz]]) {
        g.add(rod(k, [0, hubY, hubZ], [fx, 0.012, fz], 0.0075, steel), k.cyl(0.012, 0.013, 0.022, rubber, { at: [fx, 0.011, fz] }));
      }
      return g;
    },
  },
};

// DEBUG-ZOOM-START (temporary close-ups for checking; removed before finishing)
function zoomOf(id: string, lo: V3, hi: V3): ItemModel {
  return {
    size: [1, 1, 1],
    build(k, o) {
      const obj = STUDIO_ITEMS[id].build(k, o);
      obj.updateMatrixWorld(true);
      const kill: THREE.Object3D[] = [];
      obj.traverse((m) => {
        if (!(m as THREE.Mesh).isMesh) return;
        const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
        if (c.x < lo[0] || c.y < lo[1] || c.z < lo[2] || c.x > hi[0] || c.y > hi[1] || c.z > hi[2]) kill.push(m);
      });
      for (const m of kill) m.parent?.remove(m);
      return obj;
    },
  };
}
const ZOOMS: Record<string, [string, V3, V3]> = {
  "zz-keys": ["keyboard", [-0.7, 0.7, -0.2], [0.0, 0.9, 0.2]],
  "zz-deck": ["record-player", [-0.3, 0.6, -0.3], [0.3, 0.9, 0.3]],
  "zz-head": ["guitar", [-0.2, 0.45, -0.4], [0.2, 1.2, 0.4]],
  "zz-body": ["guitar", [-0.2, 0.0, -0.4], [0.2, 0.62, 0.4]],
  "zz-phone": ["ring-light", [-0.3, 1.2, -0.4], [0.3, 1.9, 0.4]],
};
for (const [zid, [id, lo, hi]] of Object.entries(ZOOMS)) STUDIO_ITEMS[zid] = zoomOf(id, lo, hi);
// DEBUG-ZOOM-END
