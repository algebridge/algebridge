/**
 * The fun pieces: games, toys, sport and treats. Each is built to the size of
 * the real thing from the same kit as the rest of the house, so an arcade
 * cabinet stands as tall as a real one, a gumball machine's globe is glass
 * with gumballs in it, and a bike hangs on its rack at a bike's length.
 */

import * as THREE from "three";
import { canvasTexture, type Kit, type V3 } from "../kit";
import type { ItemModel } from "../types";

const SANS = "Inter, system-ui, sans-serif";
const HEAVY = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";

/** A fixed random source, so a piece looks the same on every load. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Points close together along straight runs, so a tube through them stays straight and only rounds its corners. */
function polyline(points: V3[], step = 0.02): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
    for (let j = 0; j < n; j += 1) {
      const t = j / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** A straight tube through a few corners: a rail, a frame, a cable run. */
function rail(k: Kit, points: V3[], radius: number, m: THREE.Material, step = 0.02): THREE.Mesh {
  const pts = polyline(points, step);
  return k.tube(pts, radius, m, { seg: Math.min(900, pts.length * 3) });
}

/** Points round an arc, in the plane: [x, y] pairs. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** A shiny ball painted flat, for the gumballs and ball-pit balls seen in the mass. */
function paintBall(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  const base = new THREE.Color(color);
  const dark = base.clone().multiplyScalar(0.45).getStyle();
  const lit = base.clone().lerp(new THREE.Color("#ffffff"), 0.35).getStyle();
  c.save();
  c.translate(x, y);
  c.scale(rx / ry, 1);
  const grad = c.createRadialGradient(-ry * 0.35, -ry * 0.4, ry * 0.08, 0, 0, ry);
  grad.addColorStop(0, lit);
  grad.addColorStop(0.45, base.getStyle());
  grad.addColorStop(1, dark);
  c.fillStyle = grad;
  c.beginPath();
  c.arc(0, 0, ry, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.beginPath();
  c.ellipse(-ry * 0.38, -ry * 0.42, ry * 0.2, ry * 0.12, -0.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function stars(c: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number) {
  const r = seeded(seed);
  for (let i = 0; i < n; i += 1) {
    const s = r() < 0.88 ? 1 + r() * 1.3 : 2 + r() * 1.8;
    c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
    c.fillRect(r() * w, r() * h, s, s);
  }
}

/** Pixel art from rows of 0s and 1s. */
function sprite(c: CanvasRenderingContext2D, rows: string[], x: number, y: number, px: number, color: string) {
  c.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) if (row[i] === "1") c.fillRect(x + i * px, y + j * px, px, px);
  });
}

// --- Seven-segment digits, for a calculator's LCD -----------------------------

const SEGMENTS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "" };

function sevenSegment(c: CanvasRenderingContext2D, text: string, right: number, top: number, dw: number, dh: number, color: string) {
  const cells: { ch: string; dot: boolean }[] = [];
  for (const ch of text) {
    if (ch === "." && cells.length) cells[cells.length - 1].dot = true;
    else cells.push({ ch, dot: false });
  }
  const t = dw * 0.2;
  const gap = dw * 0.36;
  c.save();
  c.fillStyle = color;
  c.transform(1, 0, -0.1, 1, (top + dh) * 0.1, 0);
  cells.forEach((cell, i) => {
    const x = right - (cells.length - i) * (dw + gap);
    const on = SEGMENTS[cell.ch] ?? "";
    const half = dh / 2;
    const rect: Record<string, [number, number, number, number]> = {
      a: [x + t * 0.6, top, dw - t * 1.2, t],
      b: [x + dw - t, top + t * 0.6, t, half - t * 1.1],
      c: [x + dw - t, top + half + t * 0.5, t, half - t * 1.1],
      d: [x + t * 0.6, top + dh - t, dw - t * 1.2, t],
      e: [x, top + half + t * 0.5, t, half - t * 1.1],
      f: [x, top + t * 0.6, t, half - t * 1.1],
      g: [x + t * 0.6, top + half - t / 2, dw - t * 1.2, t],
    };
    for (const s of on) c.fillRect(...rect[s]);
    if (cell.dot) c.fillRect(x + dw + gap * 0.3, top + dh - t, t, t);
  });
  c.restore();
}

// --- The globe's map: the continents in longitude, latitude pairs --------------

const LAND: number[][] = [
  // North America
  [-168, 66, -162, 70, -156, 71.5, -140, 70, -128, 70, -115, 68, -100, 68.5, -90, 69, -82, 69.5, -80, 64, -88, 64, -93, 61, -94, 58, -90, 57, -82, 55, -82, 52, -79, 51, -77, 56, -77, 60, -72, 61, -64, 60, -61, 56, -56, 52, -59, 48, -65, 49, -64, 45, -70, 43, -70, 41.5, -74, 40.5, -76, 38, -76, 35, -81, 31, -80, 27, -80.5, 25, -82, 26.5, -83, 29.5, -89, 30, -94, 29.5, -97, 27.5, -97.5, 22, -96, 19, -91, 18.5, -88, 21, -87, 16, -84, 15.5, -83, 11, -79, 9, -77.5, 8, -80, 7.5, -83, 8.5, -86, 11, -88, 13, -92, 14.5, -96, 16, -101, 17, -105, 20, -106, 23, -109, 26, -112, 29, -114.5, 31.5, -113, 29, -111, 26, -110, 23, -112, 24.8, -114, 27, -115.5, 29.5, -117, 32.5, -120, 34.5, -122, 37, -124, 40, -124, 46, -123, 49, -128, 51, -131, 55, -135, 58, -140, 60, -146, 60.5, -152, 58.5, -158, 56, -162, 55, -158, 58, -162, 60, -165, 62, -165, 64.5, -168, 66],
  // Arctic islands
  [-80, 73, -72, 71.5, -67, 69, -62, 66.5, -64, 63, -70, 62.5, -74, 64.5, -78, 64.5, -82, 68, -86, 70, -90, 72, -80, 73],
  [-120, 72, -110, 73, -100, 73.5, -95, 76, -85, 79, -75, 82, -62, 82.5, -70, 79.5, -80, 77, -90, 76, -100, 77, -110, 76.5, -118, 76, -125, 74, -120, 72],
  // Greenland
  [-73, 78, -60, 82, -40, 83.5, -22, 82.5, -18, 79, -20, 75, -22, 71, -25, 68.5, -32, 68, -40, 65, -43, 60, -48, 61, -52, 64.5, -54, 68, -56, 72, -62, 76, -68, 77, -73, 78],
  // Cuba, Hispaniola
  [-85, 21.8, -82, 23.2, -80, 23.1, -77, 21.5, -74.2, 20.2, -77.5, 19.9, -80, 21.6, -82.5, 22, -85, 21.8],
  [-74.5, 18.5, -72.8, 19.9, -70, 19.7, -68.4, 18.6, -70, 18.2, -72, 18, -74.5, 18.5],
  // South America
  [-77, 8, -72, 12, -64, 10.5, -60, 8.5, -55, 6, -51, 4, -50, 0, -44, -2.5, -38, -4, -35, -7, -35, -9.5, -39, -15, -39, -18, -41, -22, -45, -23.5, -48.5, -26, -48.5, -28, -52, -32, -54, -34.5, -58, -34.5, -57, -36, -57.5, -38, -62, -39, -62.5, -41, -65, -42, -64, -44.5, -67, -46, -66, -48, -68.5, -50.5, -68.5, -52.5, -70, -53.5, -74, -52.5, -75.5, -48, -74, -43, -73.5, -37, -71.5, -32, -71, -27, -70.5, -23, -70, -18, -71.5, -17, -76, -14, -79, -8, -81, -5, -80, -2, -80, 1, -78, 2.5, -77.5, 4, -77, 7, -77, 8],
  // Africa
  [-17, 21, -16, 24, -14.5, 26.2, -13, 27.8, -10, 29.5, -9.8, 32, -6.8, 34, -5.9, 35.8, -2, 35.1, 1, 36.5, 5, 36.8, 9.8, 37.3, 10.2, 36.6, 11, 35.5, 10, 34.2, 11.5, 33.1, 15.2, 32.3, 19, 30.3, 20, 31.5, 20, 32.5, 23, 32.6, 25, 31.7, 29, 30.9, 32, 31.2, 32.6, 29.9, 33.6, 27.8, 35.5, 23.9, 37.2, 21, 38.6, 18, 39.7, 15.5, 41.7, 13.5, 43.3, 12.5, 44, 10.6, 51.2, 11.8, 51, 10.5, 49.5, 7, 48, 4.5, 46, 2, 43.5, -0.5, 41.6, -1.7, 40, -3.3, 39.5, -6.5, 39.3, -8, 40.5, -10.5, 40.6, -14.7, 39.1, -17, 35.5, -21, 35.5, -24, 33, -26, 32.8, -28.8, 31, -30, 30, -31.4, 27.5, -33.3, 25.6, -34, 22.5, -34, 20, -34.8, 18.4, -34, 18.2, -32, 17.2, -29, 15.3, -27, 14.5, -23, 13.2, -20, 11.8, -17, 11.8, -14, 13.7, -10.7, 13, -8, 12.2, -6, 12, -5, 9, -1, 9.5, 1, 9.8, 3.2, 8.5, 4.5, 6, 4.3, 4.4, 6.3, 2, 6.3, -1, 5, -4, 5.2, -7.5, 4.4, -9.5, 5.3, -11.5, 6.8, -13.2, 8.5, -15, 10.9, -16.7, 12.4, -17.2, 14.7, -16.5, 16.2, -16.2, 19, -17, 21],
  [49.3, -12, 50.5, -15.5, 49.5, -17, 48.3, -21, 47, -25, 45, -25.5, 43.7, -23.5, 43.3, -21.5, 44.4, -19.5, 44, -17, 46.5, -15.7, 48, -13.5, 49.3, -12],
  // Eurasia
  [-9, 39, -9.5, 43, -8, 43.7, -1.8, 43.4, -1.2, 46, -2.5, 47.3, -4.7, 48.4, -1.5, 48.7, 1.5, 50.1, 2.5, 51, 4.3, 51.5, 4.8, 53, 7, 53.5, 8.6, 53.9, 8.5, 55.3, 8.1, 56.8, 10, 57.6, 10.6, 56.5, 10.3, 55, 12, 54.2, 14.2, 53.9, 18.5, 54.6, 21, 55.2, 21.1, 56.8, 23.9, 57, 24.3, 58.4, 23.4, 59.2, 28, 59.6, 30.2, 59.9, 28.5, 60.5, 22.9, 59.8, 21.3, 60.8, 21.5, 63, 25, 64.9, 25.5, 65.5, 22.2, 65.8, 17.8, 62.7, 17.2, 61, 18.8, 60, 18.1, 59.3, 16.5, 57, 14.4, 56, 12.9, 55.6, 12.6, 56.7, 11.2, 58.4, 10.5, 59.3, 8.2, 58.1, 6.6, 58.1, 5.3, 59.2, 5, 61.5, 5.6, 62.6, 8, 63.5, 10.2, 64.9, 12.5, 66.5, 14, 68, 16.5, 68.9, 19, 69.8, 23, 70.5, 26, 71, 28.5, 70.9, 31, 70.3, 33, 69.4, 41, 67.5, 44, 68.5, 46, 68.2, 53, 68.7, 58, 68.9, 61, 69.8, 68, 68.5, 69, 72.8, 73, 72.5, 72, 71, 75, 72.5, 80, 72.5, 83, 70.5, 87, 74, 96, 76, 104, 77.7, 112, 76, 113, 73.5, 127, 73.5, 130, 71, 140, 72.5, 150, 71.5, 160, 70, 170, 70, 180, 69, 180, 65, 178, 64.5, 176, 62, 172, 61, 165, 60, 163, 57, 162, 54.5, 158, 51, 156.5, 51.5, 156, 57, 160, 61, 159, 61.8, 154, 59.2, 150, 59.6, 143, 59.3, 140.5, 57.8, 136, 54, 141, 52.5, 140, 48, 136, 43, 132, 43, 129.5, 41, 129.5, 37, 127, 34.7, 126.3, 34.5, 126.5, 37.7, 124.5, 39.7, 121.5, 39, 121.5, 40.8, 118, 39, 117.5, 38, 119, 37, 120.7, 37.8, 122.5, 37, 119.5, 35, 120.5, 32.5, 121.8, 31, 122, 30, 121, 28, 119.5, 26, 117, 23.5, 113.5, 22.5, 110, 21, 108, 21.5, 106.5, 20, 105.5, 18.5, 107, 17, 109, 15, 109, 11.5, 105, 8.6, 104.5, 10.5, 100.5, 13.5, 99.5, 10.5, 100.5, 7, 103, 5.3, 103.5, 1.4, 101, 2.5, 98.5, 7.8, 98.2, 10, 97.5, 16.5, 95, 15.8, 94, 18.5, 92, 21.5, 90, 21.8, 87, 21.5, 85, 19.5, 82, 16.5, 80.2, 15.5, 80, 13, 79.8, 10.3, 77.5, 8, 76.5, 9, 74.5, 13.5, 73, 18, 72.6, 21, 70.2, 21, 68.6, 23.5, 67, 24.8, 62, 25.2, 57.3, 25.8, 54, 26.6, 51.5, 27.9, 50.2, 30, 48.6, 30, 48.8, 27.5, 50.2, 26.2, 51.5, 24.5, 54, 24.2, 56, 26, 56.4, 24.8, 58.5, 23.6, 59.8, 22.4, 58.5, 20.5, 57.7, 19, 55.3, 17.4, 52.2, 16, 48.6, 14, 45, 12.8, 43.5, 12.7, 42.7, 16, 41, 19.6, 39, 21.5, 38.5, 24, 36.5, 26, 35, 28, 34.5, 29.5, 34.2, 31.3, 34.9, 32.5, 35.5, 34, 36, 35.8, 36.2, 36.6, 34, 36.5, 32, 36.2, 30.5, 36.5, 28, 36.8, 27.2, 37.9, 26.3, 39.3, 26.5, 40.3, 26, 40.8, 24, 40.7, 23, 39.5, 22.6, 36.5, 21.7, 36.9, 21, 38.4, 19.5, 40.5, 19.5, 41.8, 16, 43.5, 13.7, 45.6, 12.3, 44.6, 13.8, 43.6, 16, 41.5, 18.5, 40.2, 17, 39, 16, 38, 15.6, 40, 12.5, 41.5, 10.5, 43.5, 9, 44.3, 6, 43.1, 3, 43.3, 3.2, 42, 0.5, 40.5, 0, 38.5, -2, 36.7, -6, 36.2, -8.9, 37, -9, 39],
  [-180, 69, -172, 66, -180, 65],
  // Britain, Ireland, Iceland
  [-5.7, 50, -3, 50.6, 1.3, 51.2, 1.7, 52.7, 0.2, 53.5, -0.3, 54.5, -1.6, 55.6, -2.1, 57, -1.8, 57.6, -4, 57.6, -3.1, 58.6, -5, 58.6, -6.2, 57.5, -5.6, 56.3, -6.2, 55.6, -4.8, 54.8, -3.4, 54.9, -3, 53.4, -4.6, 53.3, -4.3, 52.3, -5.2, 51.7, -3.3, 51.4, -5.7, 50],
  [-6, 52.2, -6.2, 53.9, -5.6, 54.6, -7.3, 55.3, -8.5, 54.7, -10, 54.1, -9.9, 52.2, -8.2, 51.6, -6, 52.2],
  [-22.5, 64, -24, 65.5, -22.5, 66.4, -18, 66.2, -14.5, 66.4, -13.5, 65.2, -14.5, 64.4, -18.5, 63.4, -22.5, 64],
  // Japan, Sri Lanka, Taiwan, the Philippines
  [130, 31.3, 131.5, 31.5, 132, 33.8, 135, 33.5, 136.8, 34.3, 139.5, 34.9, 140.9, 35.7, 140.6, 38, 142, 39.5, 141.4, 41.4, 140, 40.6, 139.8, 38.5, 138, 37.5, 136.7, 37.3, 133, 35.5, 131, 34.4, 129.7, 33.2, 130, 31.3],
  [140, 41.5, 141.5, 42.5, 143.3, 42, 145.5, 43.3, 145, 44.2, 141.8, 45.4, 141.5, 43.8, 140, 43, 140, 41.5],
  [79.8, 8, 80.2, 9.8, 81.8, 7.5, 81.2, 6.2, 80.1, 6, 79.8, 8],
  [120.1, 23, 121, 25.2, 121.9, 24.6, 120.8, 22, 120.1, 23],
  [120, 18.5, 122.3, 18.4, 121.5, 15.5, 124, 13.2, 125.5, 12, 126, 9, 125.3, 6, 122, 7, 123, 9.5, 121.7, 11.8, 120.6, 14.2, 120, 16, 120, 18.5],
  // Indonesia and New Guinea
  [95.3, 5.6, 98, 4, 100.5, 1.5, 104, -1, 106, -3.5, 105.8, -5.8, 104.5, -5.9, 102, -4, 100.3, -1, 98.6, 1.7, 95.3, 5.6],
  [105.2, -6.8, 106.5, -6, 110.5, -6.9, 112.6, -6.9, 114.5, -7.8, 112, -8.4, 108, -7.8, 105.2, -6.8],
  [109, 1.5, 110.5, 1.7, 113, 3.1, 115.5, 5.3, 117, 7, 118.5, 5, 119, 0.8, 117.5, -0.5, 116.5, -3.5, 114, -4.1, 111, -3, 110, -1.5, 109, 1.5],
  [119.5, -5.5, 120.5, -1, 121, 1, 124.5, 1.2, 121.5, -1, 123, -4.8, 121, -3, 120.5, -5.5, 119.5, -5.5],
  [131, -1, 134, -0.8, 138, -1.6, 141, -2.6, 145, -4.2, 147.5, -6.5, 150, -10.5, 147, -10, 144, -7.8, 141, -9, 138.5, -8.3, 137.5, -5.3, 134, -4, 132, -2.7, 131, -1],
  // Australia, Tasmania, New Zealand
  [113.5, -22, 114, -26.5, 115, -30, 115.3, -34, 117.8, -35, 123.5, -33.9, 126, -32.3, 131, -31.5, 134, -32.8, 136, -34.8, 138, -35.5, 138.6, -34.7, 140, -37.5, 143.5, -38.7, 146.3, -39.1, 148, -37.8, 150, -37.3, 150.8, -34.5, 153, -31, 153.5, -28, 153, -25, 150.8, -22.5, 149, -20.5, 146.3, -19, 145.4, -16, 145.3, -14.8, 143.5, -14, 142.5, -10.8, 141.7, -12.8, 141.5, -15.5, 140.5, -17.5, 139, -17.4, 136.5, -15.6, 135.8, -14.3, 136.8, -12.2, 133, -11.5, 131, -12.2, 129.6, -14.9, 127.8, -14.5, 125, -15, 123, -16.3, 121.5, -18.6, 119, -20, 116.7, -20.6, 114.2, -21.8, 113.5, -22],
  [144.6, -40.7, 148.3, -40.9, 148, -43, 146.8, -43.6, 145.2, -42.2, 144.6, -40.7],
  [172.7, -34.4, 174.5, -36.2, 176, -37.6, 178.5, -37.7, 177, -39.3, 175.3, -41.6, 174.6, -41.3, 175.2, -40, 173.8, -39.2, 174.6, -37.3, 172.7, -34.4],
  [172.7, -40.5, 174.3, -41.7, 173.3, -43, 171.2, -44.4, 169.3, -46.6, 166.5, -46, 167, -44.8, 168.4, -43.9, 170.5, -42.9, 172.1, -41.4, 172.7, -40.5],
  // Antarctica
  [-180, -90, -180, -78, -160, -77.5, -150, -76.5, -140, -75, -120, -73.5, -100, -73, -80, -73, -68, -70, -60, -63.5, -58, -63, -62, -67, -62, -71, -60, -74, -45, -77.5, -30, -78, -20, -73.5, 0, -70, 20, -70, 40, -69, 60, -67, 80, -67, 90, -66.5, 110, -66, 130, -66, 150, -68, 165, -71, 170, -73, 165, -77.5, 180, -78, 180, -90],
];

/** Seas inside the land outline. */
const SEAS: number[][] = [
  [27.5, 42.5, 28, 41.3, 31, 41.2, 35, 42, 38, 41, 41.5, 41.5, 41.7, 42.8, 39.5, 44, 37.5, 44.7, 36.6, 45.3, 35, 45, 33.5, 44.5, 32.5, 45.4, 30.5, 46.5, 29.7, 45.2, 28.5, 43.5, 27.5, 42.5],
  [47, 45, 49, 46.5, 51, 47, 53, 46.5, 53, 45, 51, 44.5, 51.5, 43, 52.8, 41.8, 53.9, 40.6, 53.6, 39.5, 53.8, 37.5, 52, 36.8, 50, 37.2, 49, 38.3, 49.5, 40, 48.5, 41.8, 47.5, 43, 47, 45],
];

function globeMap() {
  return canvasTexture(2048, 1024, (c, w, h) => {
    const X = (lon: number) => ((lon + 180) / 360) * w;
    const Y = (lat: number) => ((90 - lat) / 180) * h;
    const sea = c.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, "#a9c9da");
    sea.addColorStop(0.5, "#8ab6cf");
    sea.addColorStop(1, "#a9c9da");
    c.fillStyle = sea;
    c.fillRect(0, 0, w, h);
    const tones = ["#e7d59c", "#c8db9c", "#efc69c", "#e2b7bf", "#bcd4a5", "#efe0aa", "#d6c4df", "#f1d1a6"];
    const trace = (p: number[]) => {
      c.beginPath();
      for (let i = 0; i < p.length; i += 2) (i ? c.lineTo : c.moveTo).call(c, X(p[i]), Y(p[i + 1]));
      c.closePath();
    };
    LAND.forEach((p, i) => {
      // A soft shallow-water halo first, then the land and its coastline.
      trace(p);
      c.strokeStyle = "rgba(190,220,232,0.8)";
      c.lineWidth = 9;
      c.stroke();
    });
    LAND.forEach((p, i) => {
      trace(p);
      c.fillStyle = i === LAND.length - 1 ? "#f3f1ea" : tones[i % tones.length];
      c.fill();
      c.strokeStyle = "rgba(70,80,72,0.7)";
      c.lineWidth = 1.8;
      c.stroke();
    });
    for (const p of SEAS) {
      trace(p);
      c.fillStyle = "#8ab6cf";
      c.fill();
      c.strokeStyle = "rgba(70,80,72,0.7)";
      c.stroke();
    }
    // Lines of longitude and latitude, the equator and the tropics.
    c.strokeStyle = "rgba(40,60,80,0.22)";
    c.lineWidth = 1.2;
    for (let lon = -180; lon <= 180; lon += 15) {
      c.beginPath();
      c.moveTo(X(lon), 0);
      c.lineTo(X(lon), h);
      c.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      c.beginPath();
      c.moveTo(0, Y(lat));
      c.lineTo(w, Y(lat));
      c.stroke();
    }
    c.strokeStyle = "rgba(150,45,40,0.6)";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(0, Y(0));
    c.lineTo(w, Y(0));
    c.stroke();
    c.setLineDash([10, 8]);
    c.lineWidth = 1.4;
    for (const lat of [23.4, -23.4]) {
      c.beginPath();
      c.moveTo(0, Y(lat));
      c.lineTo(w, Y(lat));
      c.stroke();
    }
    c.setLineDash([]);
    // Names, the way a globe prints them.
    c.textAlign = "center";
    c.fillStyle = "rgba(35,70,100,0.62)";
    c.font = `italic 600 30px Georgia, 'Times New Roman', serif`;
    for (const [name, lon, lat] of [["PACIFIC OCEAN", -140, 8], ["PACIFIC OCEAN", 165, 14], ["ATLANTIC OCEAN", -38, 24], ["ATLANTIC OCEAN", -15, -18], ["INDIAN OCEAN", 78, -18], ["ARCTIC OCEAN", 0, 80]] as const)
      c.fillText(name, X(lon), Y(lat));
    c.fillStyle = "rgba(60,50,40,0.6)";
    c.font = `700 22px ${SANS}`;
    for (const [name, lon, lat] of [["NORTH AMERICA", -102, 45], ["SOUTH AMERICA", -60, -12], ["AFRICA", 20, 6], ["EUROPE", 18, 52], ["ASIA", 95, 50], ["AUSTRALIA", 134, -26], ["ANTARCTICA", 40, -80]] as const)
      c.fillText(name, X(lon), Y(lat));
  });
}

// --- Labels and art ------------------------------------------------------------

function keyCap(label: string, face: string, ink: string) {
  return canvasTexture(96, 72, (c, w, h) => {
    c.fillStyle = face;
    c.fillRect(0, 0, w, h);
    const shade = c.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(255,255,255,0.18)");
    shade.addColorStop(1, "rgba(0,0,0,0.12)");
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
    c.fillStyle = ink;
    c.font = `600 ${label.length > 2 ? 26 : 36}px ${SANS}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, w / 2, h / 2 + 2);
  });
}

function arcadeScreen() {
  return canvasTexture(480, 640, (c, w, h) => {
    c.fillStyle = "#03040a";
    c.fillRect(0, 0, w, h);
    stars(c, w, h, 110, 3);
    c.font = `bold 21px ${MONO}`;
    c.fillStyle = "#ff5a4f";
    c.fillText("1UP", 36, 34);
    c.fillText("HIGH SCORE", 172, 34);
    c.fillStyle = "#ffffff";
    c.fillText("004250", 24, 60);
    c.fillText("015770", 190, 60);
    const bug = ["00011111000", "01111111110", "11011111011", "11111111111", "00110001100", "01101110110", "11000000011"];
    const wasp = ["00100000100", "10011111001", "10111111101", "11101110111", "11111111111", "01111111110", "00100000100", "01000000010"];
    const orb = ["0001110000", "0111111100", "1110110111", "1111111111", "0101010101", "1010000101"];
    const rows: [string[], string][] = [[orb, "#ff6ad5"], [wasp, "#5fe3ff"], [wasp, "#5fe3ff"], [bug, "#9cff6b"], [bug, "#ffd84d"]];
    rows.forEach(([s, col], r) => {
      for (let i = 0; i < 8; i += 1) sprite(c, s, 46 + i * 50 + (r % 2) * 6, 110 + r * 46, 3.6, col);
    });
    // Shots, the player's ship and its shields.
    c.fillStyle = "#ffffff";
    c.fillRect(238, 420, 3, 14);
    c.fillStyle = "#ffd84d";
    c.fillRect(132, 360, 3, 12);
    c.fillRect(334, 330, 3, 12);
    const ship = ["00000100000", "00001110000", "00001110000", "00011111000", "10111111101", "11111111111", "11011011011"];
    sprite(c, ship, 216, 548, 4.4, "#7df3ff");
    c.fillStyle = "#3ee06a";
    for (const x of [60, 170, 280, 390]) {
      c.fillRect(x - 26, 480, 52, 30);
      c.fillStyle = "#03040a";
      c.fillRect(x - 10, 498, 20, 12);
      c.fillRect(x - 26 + ((x * 7) % 30), 480, 8, 6);
      c.fillStyle = "#3ee06a";
    }
    c.fillStyle = "#3ee06a";
    c.fillRect(0, 600, w, 3);
    c.fillStyle = "#ffffff";
    c.font = `bold 19px ${MONO}`;
    c.fillText("3", 22, 628);
    sprite(c, ship, 48, 612, 2.2, "#7df3ff");
    sprite(c, ship, 80, 612, 2.2, "#7df3ff");
    c.fillText("CREDIT 01", 320, 628);
    // The tube: scanlines and a dark rim.
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.fillRect(0, y, w, 1);
    }
    const vig = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.6)");
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);
  });
}

function arcadeMarquee() {
  return canvasTexture(1024, 320, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#120a3a");
    bg.addColorStop(1, "#3b0f5c");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    stars(c, w, h, 160, 11);
    // A ringed planet on the left, a sun's glow on the right.
    const planet = c.createRadialGradient(120, 120, 10, 150, 160, 120);
    planet.addColorStop(0, "#ffb36b");
    planet.addColorStop(0.6, "#d4562e");
    planet.addColorStop(1, "#5a1630");
    c.fillStyle = planet;
    c.beginPath();
    c.arc(150, 165, 105, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,214,150,0.85)";
    c.lineWidth = 9;
    c.beginPath();
    c.ellipse(150, 170, 165, 30, -0.25, 0, Math.PI * 2);
    c.stroke();
    const glow = c.createRadialGradient(900, 60, 5, 900, 60, 220);
    glow.addColorStop(0, "rgba(120,220,255,0.75)");
    glow.addColorStop(1, "rgba(120,220,255,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `italic 900 118px ${HEAVY}`;
    for (let i = 8; i > 0; i -= 1) {
      c.fillStyle = `rgba(40,8,30,${0.25 + i * 0.05})`;
      c.fillText("ORBIT FORCE", w / 2 + 70 + i * 1.5, h / 2 + i * 2);
    }
    const title = c.createLinearGradient(0, 90, 0, 220);
    title.addColorStop(0, "#fff6b0");
    title.addColorStop(0.5, "#ffc531");
    title.addColorStop(1, "#ff6a1f");
    c.fillStyle = title;
    c.fillText("ORBIT FORCE", w / 2 + 70, h / 2);
    c.lineWidth = 3;
    c.strokeStyle = "#2a0820";
    c.strokeText("ORBIT FORCE", w / 2 + 70, h / 2);
    c.font = `700 26px ${SANS}`;
    c.fillStyle = "#9fe9ff";
    c.fillText("DEFEND THE OUTER RING", w / 2 + 70, h - 40);
  });
}

function arcadeSide() {
  return canvasTexture(512, 1024, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, w * 0.3, h);
    bg.addColorStop(0, "#1b0c46");
    bg.addColorStop(0.55, "#0b0820");
    bg.addColorStop(1, "#050409");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    stars(c, w, h, 260, 21);
    // Light streaks across the side, a planet up top and a ship diving down.
    const band = c.createLinearGradient(0, h * 0.35, w, h * 0.7);
    band.addColorStop(0, "#ff2fa0");
    band.addColorStop(1, "#ffb21e");
    c.fillStyle = band;
    for (let i = 0; i < 4; i += 1) {
      c.beginPath();
      c.moveTo(0, h * (0.5 + i * 0.07));
      c.lineTo(w, h * (0.32 + i * 0.07));
      c.lineTo(w, h * (0.34 + i * 0.07 - i * 0.004));
      c.lineTo(0, h * (0.53 + i * 0.07 - i * 0.006));
      c.closePath();
      c.globalAlpha = 0.85 - i * 0.18;
      c.fill();
    }
    c.globalAlpha = 1;
    const planet = c.createRadialGradient(330, 190, 10, 300, 230, 170);
    planet.addColorStop(0, "#9ff3ff");
    planet.addColorStop(0.5, "#2b8fd6");
    planet.addColorStop(1, "#0c2350");
    c.fillStyle = planet;
    c.beginPath();
    c.arc(300, 230, 150, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(200,240,255,0.7)";
    c.lineWidth = 8;
    c.beginPath();
    c.ellipse(300, 236, 230, 40, -0.3, 0, Math.PI * 2);
    c.stroke();
    c.save();
    c.translate(190, 760);
    c.rotate(-0.5);
    c.fillStyle = "#e8edf5";
    c.beginPath();
    c.moveTo(0, -110);
    c.lineTo(34, 30);
    c.lineTo(90, 70);
    c.lineTo(30, 62);
    c.lineTo(0, 90);
    c.lineTo(-30, 62);
    c.lineTo(-90, 70);
    c.lineTo(-34, 30);
    c.closePath();
    c.fill();
    c.fillStyle = "#ff7a2a";
    c.beginPath();
    c.moveTo(-14, 92);
    c.lineTo(0, 170);
    c.lineTo(14, 92);
    c.fill();
    c.fillStyle = "#2b6fd6";
    c.fillRect(-8, -40, 16, 40);
    c.restore();
    c.strokeStyle = "#5fe3ff";
    c.lineWidth = 5;
    for (const [x, y] of [[250, 600], [300, 560]]) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 120, y - 220);
      c.stroke();
    }
  });
}

/** A coin entry's lit price insert. */
function coinInsert() {
  return canvasTexture(96, 128, (c, w, h) => {
    c.fillStyle = "#5a0d0d";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ff3b2f";
    c.fillRect(8, 8, w - 16, h - 16);
    c.fillStyle = "#16090a";
    c.fillRect(w / 2 - 4, 20, 8, 40);
    c.fillStyle = "#ffffff";
    c.font = `800 30px ${SANS}`;
    c.textAlign = "center";
    c.fillText("25¢", w / 2, 100);
  });
}

/** Where a part runs between two points in the y-z plane (a leg, a strut, a seat back): its length, middle and tilt. */
function strut(a: V3, b: V3): { len: number; at: V3; rot: V3 } {
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return { len: Math.hypot(dy, dz), at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

/** A plush toy's head, its face printed on the front (the +z side of a sphere). */
function plushFace(kind: string, fur: string) {
  return canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = fur;
    c.fillRect(0, 0, w, h);
    const r = seeded(kind.length * 31 + 7);
    for (let i = 0; i < 1800; i += 1) {
      c.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";
      c.fillRect(r() * w, r() * h, 1.5, 3);
    }
    const cx = w * 0.25;
    const cy = h * 0.53;
    const light = new THREE.Color(fur).lerp(new THREE.Color("#ffffff"), 0.45).getStyle();
    if (kind === "bear" || kind === "pig") {
      c.fillStyle = kind === "pig" ? "#f7c3cd" : light;
      c.beginPath();
      c.ellipse(cx, cy + 16, 26, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (kind === "panda") {
      c.fillStyle = "#1c1c1e";
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * 22, cy - 4, 13, 17, sx * 0.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (const sx of [-1, 1]) {
      c.fillStyle = "#151517";
      c.beginPath();
      c.arc(cx + sx * 22, cy - 6, kind === "frog" ? 6 : 8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(cx + sx * 22 - 2.5, cy - 9, 2.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(240,120,140,0.45)";
      c.beginPath();
      c.arc(cx + sx * 40, cy + 14, 9, 0, Math.PI * 2);
      c.fill();
    }
    if (kind === "chick") {
      c.fillStyle = "#f08a24";
      c.beginPath();
      c.moveTo(cx - 9, cy + 6);
      c.lineTo(cx + 9, cy + 6);
      c.lineTo(cx, cy + 20);
      c.closePath();
      c.fill();
    } else {
      c.fillStyle = kind === "pig" ? "#d97f92" : "#2a1d1a";
      c.beginPath();
      c.ellipse(cx, cy + 9, kind === "pig" ? 9 : 6, kind === "pig" ? 6 : 4.5, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#2a1d1a";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(cx, cy + 14, kind === "frog" ? 16 : 7, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    }
  });
}

/** Text in an orange dot-matrix display. */
function dotMatrix(lines: [string, number][]) {
  return canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = "#0b0502";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ff8a1c";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [text, size] of lines) {
      c.font = `700 ${size}px ${MONO}`;
      c.fillText(text, w / 2, size > 40 ? h * 0.62 : h * 0.2);
    }
    c.fillStyle = "#0b0502";
    for (let i = 0; i < w; i += 4) c.fillRect(i, 0, 1.4, h);
    for (let j = 0; j < h; j += 4) c.fillRect(0, j, w, 1.4);
  });
}

function pinballField(on: boolean) {
  return canvasTexture(640, 1060, (c, w, h) => {
    const U = (x: number) => ((x + 0.33) / 0.66) * w;
    const V = (z: number) => ((z + 0.44) / 1.09) * h;
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1a1050");
    bg.addColorStop(0.6, "#0e1c4a");
    bg.addColorStop(1, "#08122e");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    stars(c, w, h, 240, 41);
    const nebula = c.createRadialGradient(U(0), V(-0.05), 10, U(0), V(-0.05), 300);
    nebula.addColorStop(0, "rgba(255,90,170,0.55)");
    nebula.addColorStop(1, "rgba(255,90,170,0)");
    c.fillStyle = nebula;
    c.fillRect(0, 0, w, h);
    // Arrow inserts pointing up the lanes, circles under the bumpers, a shoot-again light.
    const arrow = (x: number, z: number, col: string, rot = 0) => {
      c.save();
      c.translate(U(x), V(z));
      c.rotate(rot);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, -26);
      c.lineTo(18, 14);
      c.lineTo(-18, 14);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    };
    for (let i = 0; i < 3; i += 1) arrow(-0.2, 0.05 - i * 0.07, ["#ff3b3b", "#ffb21e", "#ffe14d"][i], -0.25);
    for (let i = 0; i < 3; i += 1) arrow(0.2, 0.05 - i * 0.07, ["#3bd1ff", "#4dff9a", "#b36bff"][i], 0.25);
    for (let i = 0; i < 4; i += 1) arrow(0, 0.28 - i * 0.065, "#ff5ad1");
    for (const [x, z, col] of [[-0.09, -0.2, "#ff3b3b"], [0.09, -0.2, "#ffd84d"], [0, -0.31, "#3b8bff"]] as const) {
      c.fillStyle = col;
      c.globalAlpha = 0.55;
      c.beginPath();
      c.arc(U(x), V(z), 46, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.fillStyle = "#ff3b3b";
    c.beginPath();
    c.arc(U(0), V(0.56), 20, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = `800 16px ${SANS}`;
    c.textAlign = "center";
    c.fillText("SHOOT AGAIN", U(0), V(0.56) + 40);
    c.font = `italic 900 64px ${HEAVY}`;
    const title = c.createLinearGradient(0, V(0.12) - 40, 0, V(0.12) + 20);
    title.addColorStop(0, "#fff6b0");
    title.addColorStop(1, "#ff8a1f");
    c.fillStyle = title;
    c.fillText("STARLIGHT", U(0), V(0.14));
    // Lanes and outlines.
    c.strokeStyle = "rgba(255,255,255,0.75)";
    c.lineWidth = 3;
    for (const x of [-0.26, 0.26]) {
      c.beginPath();
      c.moveTo(U(x), V(0.25));
      c.lineTo(U(x * 0.62), V(0.42));
      c.stroke();
    }
    if (!on) {
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(0, 0, w, h);
    }
  });
}

function pinballBackglass() {
  return canvasTexture(1024, 776, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#120a3a");
    bg.addColorStop(1, "#2a0c45");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    stars(c, w, h, 300, 51);
    for (const [x, y, r, col] of [[300, 260, 260, "rgba(255,80,170,0.45)"], [760, 420, 300, "rgba(80,170,255,0.4)"]] as const) {
      const neb = c.createRadialGradient(x, y, 10, x, y, r);
      neb.addColorStop(0, col);
      neb.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = neb;
      c.fillRect(0, 0, w, h);
    }
    const planet = c.createRadialGradient(780, 560, 20, 820, 600, 220);
    planet.addColorStop(0, "#ffd08a");
    planet.addColorStop(0.6, "#e0603a");
    planet.addColorStop(1, "#3a0f2a");
    c.fillStyle = planet;
    c.beginPath();
    c.arc(820, 610, 200, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,226,170,0.8)";
    c.lineWidth = 12;
    c.beginPath();
    c.ellipse(820, 615, 320, 60, -0.2, 0, Math.PI * 2);
    c.stroke();
    // A comet's trail across the glass.
    const trail = c.createLinearGradient(80, 640, 420, 470);
    trail.addColorStop(0, "rgba(120,230,255,0)");
    trail.addColorStop(1, "rgba(220,250,255,0.95)");
    c.strokeStyle = trail;
    c.lineWidth = 16;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(80, 640);
    c.lineTo(420, 470);
    c.stroke();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(424, 468, 16, 0, Math.PI * 2);
    c.fill();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `italic 900 150px ${HEAVY}`;
    for (let i = 10; i > 0; i -= 1) {
      c.fillStyle = `rgba(30,6,30,${0.2 + i * 0.05})`;
      c.fillText("STARLIGHT", w / 2 + i * 1.6, 200 + i * 2.2);
    }
    const title = c.createLinearGradient(0, 120, 0, 270);
    title.addColorStop(0, "#ffffff");
    title.addColorStop(0.45, "#ffe066");
    title.addColorStop(1, "#ff7a1f");
    c.fillStyle = title;
    c.fillText("STARLIGHT", w / 2, 200);
    c.font = `800 40px ${SANS}`;
    c.fillStyle = "#9fe9ff";
    c.fillText("P I N B A L L", w / 2, 320);
  });
}

// --- The pieces ----------------------------------------------------------------

export const FUN_ITEMS: Record<string, ItemModel> = {
  "calculator-bot": {
    size: [0.2, 0.42, 0.12],
    build(k, o) {
      const shellHex = o.color ?? "#3a3f47";
      const shell = k.plastic(shellHex, 0.45);
      const dark = k.plastic("#1b1e22", 0.5);
      const steel = k.metal("steel", 0.3);
      const bot = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => bot.add(x));
      // Feet, legs and hips.
      for (const sx of [-1, 1]) {
        add(k.box(0.05, 0.026, 0.07, k.rubber("#2b2d31"), { at: [sx * 0.038, 0.013, 0.008], r: 0.008 }));
        add(k.cyl(0.011, 0.011, 0.066, steel, { at: [sx * 0.038, 0.058, 0] }));
      }
      add(k.box(0.11, 0.018, 0.04, dark, { at: [0, 0.094, 0], r: 0.005 }));
      // The body is the calculator: its display, twenty keys, a model line and four screws.
      add(k.box(0.14, 0.18, 0.042, shell, { at: [0, 0.192, 0], r: 0.01 }));
      add(k.box(0.114, 0.042, 0.004, dark, { at: [0, 0.252, 0.0215], r: 0.002 }));
      const lcd = canvasTexture(400, 120, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#bcc5a8");
        bg.addColorStop(1, "#a6b092");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        if (o.on) sevenSegment(c, "3.1415926", w - 18, 20, 30, 78, "#262b24");
      });
      add(k.plane(0.1, 0.03, k.print(lcd, { roughness: 0.3 }), { at: [0, 0.252, 0.0238] }));
      const KEYS = [
        ["AC", "+/-", "%", "÷"],
        ["7", "8", "9", "×"],
        ["4", "5", "6", "−"],
        ["1", "2", "3", "+"],
        ["0", ".", "√", "="],
      ];
      KEYS.forEach((row, r) =>
        row.forEach((label, c) => {
          const face = r === 0 && c === 0 ? "#c4473a" : c === 3 ? "#e08a2b" : r === 0 ? "#5b6069" : "#e4e3df";
          const ink = face === "#e4e3df" ? "#2a2c30" : "#ffffff";
          add(k.box(0.022, 0.016, 0.006, k.print(keyCap(label, face, ink), { roughness: 0.45 }), { at: [-0.042 + c * 0.028, 0.218 - r * 0.021, 0.0225], r: 0.002 }));
        })
      );
      const model = canvasTexture(256, 32, (c, w, h) => {
        c.fillStyle = shellHex;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.75)";
        c.font = `700 20px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("CALC-BOT  CB-12", w / 2, h / 2 + 1);
      });
      add(k.plane(0.08, 0.01, k.print(model, { roughness: 0.5 }), { at: [0, 0.113, 0.0212] }));
      for (const [x, y] of [[-0.058, 0.111], [0.058, 0.111], [-0.06, 0.277], [0.06, 0.277]]) add(k.cyl(0.0026, 0.0026, 0.002, k.metal("chrome"), { at: [x, y, 0.0212], rot: [Math.PI / 2, 0, 0], seg: 12 }));
      // The head: a dark visor with two eyes that light up, a solar cell on top and an antenna.
      add(k.cyl(0.014, 0.014, 0.016, steel, { at: [0, 0.289, 0] }));
      add(k.box(0.11, 0.075, 0.065, shell, { at: [0, 0.3335, 0], r: 0.014 }));
      add(k.box(0.084, 0.04, 0.006, k.plastic("#101214", 0.85), { at: [0, 0.336, 0.031], r: 0.003 }));
      for (const sx of [-1, 1]) add(k.cyl(0.0095, 0.0095, 0.004, k.glow("#7fe8ff", o.on, 2.6), { at: [sx * 0.02, 0.338, 0.0355], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      const solar = canvasTexture(128, 48, (c, w, h) => {
        c.fillStyle = "#3a2b2b";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#4b3838";
        for (let i = 0; i < 4; i += 1) c.fillRect(4 + i * 31, 4, 27, h - 8);
      });
      add(k.box(0.07, 0.003, 0.032, k.print(solar, { roughness: 0.25 }), { at: [0, 0.3725, 0.004] }));
      add(k.cyl(0.0022, 0.0022, 0.042, steel, { at: [0.03, 0.392, -0.012] }));
      add(k.sphere(0.0065, k.glow("#ff5a4a", o.on, 2.4), { at: [0.03, 0.4145, -0.012] }));
      for (const sx of [-1, 1]) add(k.cyl(0.012, 0.012, 0.01, steel, { at: [sx * 0.059, 0.334, 0], rot: [0, 0, Math.PI / 2] }));
      // Arms held forward, ready to hand over an answer.
      for (const sx of [-1, 1]) {
        add(k.cyl(0.013, 0.013, 0.016, dark, { at: [sx * 0.078, 0.258, 0], rot: [0, 0, Math.PI / 2] }));
        add(k.box(0.02, 0.07, 0.022, shell, { at: [sx * 0.09, 0.225, 0], r: 0.006 }));
        add(k.sphere(0.012, steel, { at: [sx * 0.09, 0.19, 0] }));
        add(k.box(0.018, 0.018, 0.06, shell, { at: [sx * 0.09, 0.19, 0.032], r: 0.005 }));
        add(k.torus(0.011, 0.0038, steel, { at: [sx * 0.09, 0.19, 0.07], rot: [0, Math.PI / 2, Math.PI * 0.62], arc: Math.PI * 1.35 }));
      }
      bot.position.z = -0.0265;
      return k.group([bot]);
    },
  },

  globe: {
    size: [0.4, 0.935, 0.4],
    build(k, o) {
      const wood = k.wood(o.color ? o.color : "walnut", { gloss: 0.6 });
      const brass = k.metal("brass", 0.28);
      const g = k.group([
        // A turned foot and column in walnut, and the brass cup the meridian stands in.
        k.lathe([[0, 0], [0.19, 0], [0.2, 0.012], [0.195, 0.026], [0.17, 0.034], [0.15, 0.05], [0.09, 0.062], [0.06, 0.07], [0, 0.07]], wood, { seg: 48 }),
        k.lathe([[0, 0.069], [0.05, 0.069], [0.052, 0.09], [0.036, 0.11], [0.03, 0.16], [0.045, 0.24], [0.05, 0.28], [0.04, 0.33], [0.026, 0.38], [0.024, 0.44], [0.036, 0.47], [0.04, 0.49], [0.03, 0.5], [0, 0.5]], wood, { seg: 40 }),
        k.lathe([[0, 0.499], [0.035, 0.499], [0.04, 0.515], [0.032, 0.535], [0.014, 0.546], [0, 0.546]], brass, { seg: 32 }),
      ]);
      // The globe on its tilted axis inside a full brass meridian.
      const R = 0.178;
      const meridian = new THREE.Group();
      meridian.position.set(0, 0.733, 0);
      meridian.rotation.y = 0.95;
      meridian.add(k.torus(0.192, 0.009, brass, { scale: [1, 1, 0.42], seg: 96 }));
      const tilt = new THREE.Group();
      tilt.rotation.z = 0.41;
      tilt.add(k.sphere(R, k.print(globeMap(), { roughness: 0.42 }), { rot: [0, -1.55, 0], seg: 64 }));
      for (const sy of [-1, 1]) tilt.add(k.cyl(0.004, 0.004, 0.022, brass, { at: [0, sy * 0.185, 0] }));
      meridian.add(tilt);
      g.add(meridian);
      return g;
    },
  },

  "snack-bar": {
    size: [1.24, 1.3, 0.96],
    build(k, o) {
      const paint = k.paint(o.color ?? "#2f5245", 0.4);
      const top = k.wood("oak", { gloss: 0.55 });
      const brass = k.metal("brass", 0.25);
      const black = k.metal("black", 0.45);
      const bar = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => bar.add(x));
      // The counter: a painted cabinet with fluted slats, a toe kick, a butcher-block top on steel brackets.
      add(k.box(1.2, 0.93, 0.34, paint, { at: [0, 0.545, -0.27], r: 0.006 }));
      add(k.box(1.17, 0.08, 0.3, k.paint("#1c1d1f", 0.3), { at: [0, 0.04, -0.27] }));
      for (let i = 0; i < 10; i += 1) add(k.box(0.105, 0.92, 0.014, paint, { at: [-0.5265 + i * 0.117, 0.545, -0.094], r: 0.004 }));
      add(k.box(1.24, 0.04, 0.61, top, { at: [0, 1.03, -0.155], r: 0.006 }));
      for (const x of [-0.45, 0.45]) add(k.extrude([[0, 0], [0.21, 0.13], [0.21, 0.16], [0, 0.16]], 0.025, black, { at: [x, 0.85, -0.087], rot: [0, -Math.PI / 2, 0], bevel: 0.003 }));
      // A brass foot rail on two posts.
      add(k.cyl(0.018, 0.018, 1.1, brass, { at: [0, 0.2, 0.03], rot: [0, 0, Math.PI / 2] }));
      for (const x of [-0.45, 0.45]) add(k.cyl(0.012, 0.012, 0.13, brass, { at: [x, 0.2, -0.03], rot: [Math.PI / 2, 0, 0] }));
      for (const x of [-0.55, 0.55]) add(k.sphere(0.02, brass, { at: [x, 0.2, 0.03] }));
      // Two stools: a turned walnut seat, four splayed steel legs and a foot ring.
      for (const x of [-0.3, 0.3]) {
        add(k.lathe([[0, 0], [0.17, 0], [0.18, 0.012], [0.178, 0.03], [0.165, 0.042], [0, 0.046]], k.wood("walnut", { gloss: 0.5 }), { at: [x, 0.715, 0.32], seg: 40 }));
        for (let i = 0; i < 4; i += 1) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          add(k.tube([[x + Math.cos(a) * 0.115, 0.716, 0.32 + Math.sin(a) * 0.115], [x + Math.cos(a) * 0.16, 0.0, 0.32 + Math.sin(a) * 0.16]], 0.012, black, { seg: 2 }));
        }
        add(k.torus(0.142, 0.008, black, { at: [x, 0.3, 0.32], rot: [Math.PI / 2, 0, 0], seg: 40 }));
      }
      // Snacks on the bar. Popcorn in a striped bucket.
      const stripes = canvasTexture(512, 256, (c, w, h) => {
        for (let i = 0; i < 16; i += 1) {
          c.fillStyle = i % 2 ? "#f4f1ea" : "#c8302a";
          c.fillRect((i * w) / 16, 0, w / 16 + 1, h);
        }
        c.fillStyle = "#f4f1ea";
        c.fillRect(0, h * 0.42, w, h * 0.2);
        c.fillStyle = "#c8302a";
        c.font = `900 40px ${HEAVY}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("POPCORN", w * 0.25 + 10, h * 0.52);
        c.fillText("POPCORN", w * 0.75 + 10, h * 0.52);
      });
      const bucket: [number, number][] = [[0, 0], [0.052, 0]];
      for (let i = 0; i <= 8; i += 1) bucket.push([0.052 + i * 0.003, i * 0.02]);
      bucket.push([0.078, 0.162], [0.07, 0.16], [0, 0.15]);
      add(k.lathe(bucket, k.print(stripes, { roughness: 0.6 }), { at: [-0.4, 1.05, -0.22], seg: 40 }));
      const corn = k.paint("#f3e3bd", 0.1);
      add(k.sphere(0.074, corn, { at: [-0.4, 1.205, -0.22], scale: [1, 0.42, 1] }));
      const pr = seeded(5);
      for (let i = 0; i < 7; i += 1) {
        const a = pr() * Math.PI * 2;
        const d = 0.02 + pr() * 0.045;
        add(k.sphere(0.013 + pr() * 0.005, i % 3 ? corn : k.paint("#e8c77a", 0.15), { at: [-0.4 + Math.cos(a) * d, 1.218 + pr() * 0.012 - d * 0.25, -0.22 + Math.sin(a) * d], scale: [1, 0.8 + pr() * 0.3, 0.9] }));
      }
      // Donuts on a plate: one pink with sprinkles, one chocolate, one glazed.
      add(k.lathe([[0, 0], [0.09, 0], [0.12, 0.012], [0.126, 0.017], [0.119, 0.017], [0.088, 0.007], [0, 0.007]], k.ceramic("#f4f2ee"), { at: [0.02, 1.05, -0.02], seg: 40 }));
      const sprinkles = canvasTexture(256, 128, (c, w, h) => {
        c.fillStyle = "#ea8db0";
        c.fillRect(0, 0, w, h);
        const r = seeded(9);
        const cols = ["#ffffff", "#ffd54a", "#4fc3f7", "#7bd36b", "#ff7043", "#8e6bd6"];
        for (let i = 0; i < 160; i += 1) {
          c.save();
          c.translate(r() * w, r() * h * 0.5);
          c.rotate(r() * Math.PI);
          c.fillStyle = cols[Math.floor(r() * cols.length)];
          c.fillRect(-4, -1.2, 8, 2.4);
          c.restore();
        }
      });
      const dough = k.paint("#c98d4e", 0.2);
      const donuts: [number, number, number, number, THREE.Material][] = [
        [-0.03, 1.074, 0.0, 0, k.print(sprinkles, { roughness: 0.4 })],
        [0.06, 1.074, -0.05, 0, k.paint("#5a3726", 0.55)],
        [0.025, 1.098, -0.01, 0.35, k.paint("#efe2cf", 0.7)],
      ];
      for (const [x, y, z, tilt, icing] of donuts) {
        const d = k.group([k.torus(0.032, 0.0165, dough, { rot: [Math.PI / 2, 0, 0], seg: 32 }), k.torus(0.032, 0.0158, icing, { at: [0, 0.0045, 0], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 0.72], seg: 32 })], { at: [x, y, z], rot: [tilt, 0, tilt * 0.6] });
        add(d);
      }
      // Chips in a wooden bowl.
      add(k.lathe([[0, 0], [0.05, 0], [0.088, 0.035], [0.1, 0.062], [0.094, 0.064], [0.083, 0.04], [0.045, 0.009], [0, 0.009]], k.wood("walnut", { gloss: 0.5 }), { at: [-0.18, 1.05, 0.04], seg: 40 }));
      const chip = k.paint("#e3b45a", 0.3);
      const cr = seeded(13);
      for (let i = 0; i < 6; i += 1) {
        const a = i * 1.1;
        add(k.sphere(0.03, chip, { at: [-0.18 + Math.cos(a) * 0.035, 1.098 + cr() * 0.012, 0.04 + Math.sin(a) * 0.035], scale: [1, 0.12, 0.78], rot: [cr() - 0.5, a, cr() - 0.5] }));
      }
      // Two cans of soda.
      const can = (name: string, a: string, b: string) =>
        canvasTexture(512, 256, (c, w, h) => {
          const bg = c.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, a);
          bg.addColorStop(1, b);
          c.fillStyle = bg;
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#ffffff";
          c.font = `italic 900 46px ${HEAVY}`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(name, w * 0.25, h / 2);
          c.fillText(name, w * 0.75, h / 2);
          c.fillStyle = "rgba(255,255,255,0.6)";
          c.fillRect(0, h * 0.08, w, 4);
          c.fillRect(0, h * 0.9, w, 4);
        });
      for (const [x, z, tex] of [[0.27, -0.24, can("COLA", "#c41f26", "#7e0f14")], [0.335, -0.17, can("LIME", "#3c9a3a", "#1d5d22")]] as const) {
        add(k.cyl(0.033, 0.033, 0.114, k.print(tex, { roughness: 0.3 }), { at: [x, 1.107, z], seg: 32 }));
        add(k.lathe([[0, 0], [0.033, 0], [0.028, 0.008], [0.027, 0.01], [0.025, 0.006], [0, 0.006]], k.metal("silver", 0.25), { at: [x, 1.164, z], seg: 32 }));
      }
      // Cookies in a glass jar with a wooden lid.
      add(k.lathe([[0, 0], [0.07, 0], [0.075, 0.012], [0.075, 0.16], [0.06, 0.18], [0.055, 0.19], [0.055, 0.198]], k.glass("#e8f0f0", 0.25), { at: [0.45, 1.05, -0.02], seg: 40 }));
      add(k.lathe([[0, 0], [0.062, 0], [0.064, 0.012], [0.05, 0.02], [0.015, 0.024], [0.015, 0.04], [0.022, 0.046], [0, 0.05]], k.wood("oak", { gloss: 0.5 }), { at: [0.45, 1.247, -0.02], seg: 32 }));
      const cookie = canvasTexture(128, 128, (c, w, h) => {
        c.fillStyle = "#c58c52";
        c.fillRect(0, 0, w, h);
        const r = seeded(17);
        for (let i = 0; i < 14; i += 1) {
          c.fillStyle = "#3b2418";
          c.beginPath();
          c.arc(r() * w, r() * h, 5 + r() * 5, 0, Math.PI * 2);
          c.fill();
        }
      });
      const cookieMat = k.print(cookie, { roughness: 0.85 });
      for (const [y, x, z, rx] of [[0.012, 0, 0, 0], [0.026, 0.004, -0.004, 0.1], [0.04, -0.003, 0.002, -0.12], [0.07, 0.0, 0.0, 1.35]]) add(k.cyl(0.034, 0.034, 0.012, cookieMat, { at: [0.45 + x, 1.05 + y, -0.02 + z], rot: [rx, 0, 0], seg: 28 }));
      // A small chalkboard menu at the back of the bar.
      const menu = canvasTexture(512, 360, (c, w, h) => {
        c.fillStyle = "#26302b";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.font = `700 56px ${SANS}`;
        c.textAlign = "center";
        c.fillText("SNACKS", w / 2, 78);
        c.font = `500 34px ${SANS}`;
        c.textAlign = "left";
        const lines: [string, string][] = [["Popcorn", "2.00"], ["Donuts", "1.50"], ["Cookies", "1.00"], ["Soda", "1.25"]];
        lines.forEach(([a, b], i) => {
          c.fillText(a, 50, 150 + i * 52);
          c.textAlign = "right";
          c.fillText(b, w - 50, 150 + i * 52);
          c.textAlign = "left";
        });
      });
      add(k.box(0.3, 0.22, 0.016, k.wood("oak", { gloss: 0.4 }), { at: [0.1, 1.16, -0.4], rot: [-0.14, -0.06, 0], r: 0.004 }));
      add(k.plane(0.27, 0.19, k.print(menu, { roughness: 0.9 }), { at: [0.1, 1.161, -0.391], rot: [-0.14, -0.06, 0] }));
      bar.position.z = -0.02;
      return k.group([bar]);
    },
  },

  "candy-machine": {
    size: [0.36, 1.24, 0.36],
    build(k, o) {
      const body = k.paint(o.color ?? "#b8262c", 0.75);
      const chrome = k.metal("chrome");
      const g = k.group([
        // A cast stand: round foot, slim column and a platform.
        k.lathe([[0, 0], [0.175, 0], [0.18, 0.012], [0.172, 0.028], [0.13, 0.05], [0.07, 0.07], [0.045, 0.085], [0, 0.085]], body, { seg: 48 }),
        k.lathe([[0, 0.084], [0.042, 0.084], [0.045, 0.1], [0.03, 0.12], [0.028, 0.5], [0.036, 0.52], [0.03, 0.54], [0.028, 0.62], [0.05, 0.66], [0.11, 0.69], [0.12, 0.705], [0, 0.705]], body, { seg: 40 }),
        // The machine's cast body, its chrome ring and the glass globe.
        k.lathe([[0, 0.704], [0.115, 0.704], [0.12, 0.716], [0.118, 0.73], [0.11, 0.8], [0.104, 0.86], [0.095, 0.885], [0.085, 0.892], [0, 0.892]], body, { seg: 48 }),
        k.torus(0.084, 0.008, chrome, { at: [0, 0.892, 0], rot: [Math.PI / 2, 0, 0], seg: 48 }),
        k.sphere(0.13, k.glass("#eef6f8", 0.16), { at: [0, 1.01, 0], seg: 48 }),
      ]);
      // Gumballs: a packed mass inside the glass, with real ones pressed against it.
      const palette = ["#d8343a", "#f2c230", "#3a9a4a", "#2f6fc0", "#ef7d2a", "#f3efe6", "#e46aa0", "#7b4fb0"];
      const mass = canvasTexture(1024, 512, (c, w, h) => {
        c.fillStyle = "#2a1820";
        c.fillRect(0, 0, w, h);
        const r = seeded(31);
        const R = 15;
        let row = 0;
        for (let y = R * 0.6; y < h + R; y += R * 1.62) {
          const lat = (0.5 - y / h) * Math.PI;
          const sx = 1 / Math.max(0.22, Math.cos(lat));
          const step = R * 2 * sx * 0.97;
          const off = row % 2 ? step / 2 : 0;
          for (let x = -step + off; x < w + step; x += step) paintBall(c, x + (r() - 0.5) * 4, y + (r() - 0.5) * 3, R * sx, R, palette[Math.floor(r() * palette.length)]);
          row += 1;
        }
      });
      g.add(k.sphere(0.124, k.print(mass, { roughness: 0.25 }), { at: [0, 1.01, 0], rot: [0, 2.2, 0], seg: 48 }));
      const gr = seeded(7);
      for (let i = 0; i < 24; i += 1) {
        const lon = -1.3 + gr() * 2.9;
        const lat = -0.55 + gr() * 1.15;
        const d = 0.117;
        g.add(k.sphere(0.0122, k.plastic(palette[i % palette.length], 0.85), { at: [Math.sin(lon) * Math.cos(lat) * d, 1.01 + Math.sin(lat) * d, Math.cos(lon) * Math.cos(lat) * d], seg: 16 }));
      }
      // The lid with its lock, and the coin mechanism: plate, slot, price, knob and chute.
      g.add(k.lathe([[0, 1.112], [0.074, 1.112], [0.078, 1.125], [0.07, 1.16], [0.05, 1.19], [0.025, 1.205], [0, 1.208]], body, { seg: 40 }));
      g.add(k.cyl(0.012, 0.014, 0.022, chrome, { at: [0, 1.218, 0] }));
      g.add(k.box(0.09, 0.105, 0.014, chrome, { at: [0, 0.8, 0.106], rot: [-0.08, 0, 0], r: 0.006 }));
      g.add(k.box(0.026, 0.004, 0.004, k.plastic("#111111"), { at: [0, 0.838, 0.114], rot: [-0.08, 0, 0] }));
      const price = canvasTexture(128, 48, (c, w, h) => {
        c.fillStyle = "#f5f1e6";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#b8262c";
        c.font = `800 32px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("25¢", w / 2, h / 2 + 1);
      });
      g.add(k.plane(0.034, 0.013, k.print(price, { roughness: 0.5 }), { at: [0, 0.852, 0.1132], rot: [-0.08, 0, 0] }));
      g.add(k.cyl(0.026, 0.026, 0.024, chrome, { at: [0, 0.795, 0.125], rot: [Math.PI / 2 - 0.08, 0, 0], seg: 32 }));
      g.add(k.box(0.05, 0.012, 0.012, chrome, { at: [0, 0.795, 0.139], rot: [-0.08, 0, 0], r: 0.005 }));
      g.add(k.box(0.05, 0.034, 0.04, chrome, { at: [0, 0.735, 0.112], r: 0.01 }));
      g.add(k.box(0.044, 0.03, 0.004, k.plastic("#c9ccd1", 0.7), { at: [0, 0.734, 0.134], rot: [0.25, 0, 0], r: 0.002 }));
      return g;
    },
  },

  arcade: {
    size: [0.66, 1.84, 0.83],
    light: { at: [0, 1.35, 0.42], color: "#a9c4ff", intensity: 1.4, distance: 3 },
    build(k, o) {
      const body = k.paint(o.color ?? "#141518", 0.35);
      const trim = k.plastic("#e0a91f", 0.55);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The side panels follow the classic profile, with the art printed on them and T-molding on their edges.
      const outline: [number, number][] = [[-0.41, 0], [0.3, 0], [0.3, 0.86], [0.41, 0.9], [0.41, 1.0], [0.2, 1.1], [0.07, 1.58], [0.17, 1.61], [0.17, 1.83], [-0.41, 1.83]];
      for (const sx of [-1, 1]) {
        const art = arcadeSide();
        art.repeat.set(sx > 0 ? -1 / 0.82 : 1 / 0.82, 1 / 1.83);
        art.offset.set(0.5, 0);
        add(k.extrude(outline, 0.018, k.print(art, { roughness: 0.45 }), { at: [sx * 0.32, 0, 0], rot: [0, -Math.PI / 2, 0], bevel: 0.002 }));
        const edge: V3[] = [[0.3, 0.0], [0.3, 0.86], [0.41, 0.9], [0.41, 1.0], [0.2, 1.1], [0.07, 1.58], [0.17, 1.61], [0.17, 1.83], [-0.41, 1.83]].map(([z, y]) => [sx * 0.32, y, z] as V3);
        add(rail(k, edge, 0.0105, trim, 0.025));
      }
      // Front: kick panel, coin door, control panel, the bezel and screen under glass, the marquee.
      add(k.box(0.622, 0.86, 0.018, body, { at: [0, 0.43, 0.291] }));
      add(k.box(0.622, 0.018, 0.58, body, { at: [0, 1.821, -0.12] }));
      add(k.box(0.622, 1.81, 0.018, body, { at: [0, 0.905, -0.401] }));
      add(k.box(0.3, 0.34, 0.012, k.metal("black", 0.5), { at: [0, 0.47, 0.306], r: 0.004 }));
      for (const x of [-0.065, 0.065]) {
        add(k.box(0.05, 0.1, 0.008, k.metal("chrome", 0.15), { at: [x, 0.55, 0.316], r: 0.003 }));
        add(k.plane(0.034, 0.068, k.print(coinInsert(), { roughness: 0.4, glow: o.on ? 1.1 : 0 }), { at: [x, 0.55, 0.3205] }));
      }
      add(k.cyl(0.009, 0.009, 0.01, k.metal("chrome", 0.15), { at: [0.11, 0.38, 0.315], rot: [Math.PI / 2, 0, 0] }));
      add(k.extrude([[0.2, 0.86], [0.3, 0.86], [0.41, 0.9], [0.41, 1.0], [0.2, 1.1]], 0.622, body, { rot: [0, -Math.PI / 2, 0], bevel: 0.002 }));
      // The control panel's face, tipped toward the player: overlay, two sticks, six buttons, two starts.
      const L = 0.2326;
      const cp = new THREE.Group();
      cp.position.set(0, 1.0032, 0.4115);
      cp.rotation.x = 0.445;
      const spots: [number, number, string][] = [[-0.14, 0.12, "#d8322e"], [-0.1, 0.135, "#f2c230"], [-0.06, 0.14, "#2f6fc0"], [0.18, 0.12, "#d8322e"], [0.22, 0.135, "#f2c230"], [0.26, 0.14, "#2f6fc0"]];
      const sticks: [number, number][] = [[-0.22, 0.11], [0.1, 0.11]];
      const starts: [number, number][] = [[-0.025, 0.2], [0.025, 0.2]];
      const overlay = canvasTexture(1024, 400, (c, w, h) => {
        const U = (x: number) => ((x + 0.3) / 0.6) * w;
        const V = (s: number) => (1 - s / L) * h;
        c.fillStyle = "#101117";
        c.fillRect(0, 0, w, h);
        const band = c.createLinearGradient(0, 0, w, 0);
        band.addColorStop(0, "#ff2fa0");
        band.addColorStop(1, "#ffb21e");
        c.fillStyle = band;
        c.fillRect(0, h * 0.86, w, h * 0.05);
        c.fillRect(0, h * 0.06, w, h * 0.02);
        c.strokeStyle = "#5fe3ff";
        c.lineWidth = 5;
        for (const [x, s] of [...spots, ...sticks]) {
          c.beginPath();
          c.arc(U(x), V(s), 38, 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = "#ffffff";
        c.font = `800 30px ${SANS}`;
        c.textAlign = "center";
        c.fillText("1P", U(-0.22), V(0.11) + 78);
        c.fillText("2P", U(0.1), V(0.11) + 78);
        c.font = `700 18px ${SANS}`;
        c.fillText("1 PLAYER", U(-0.025), V(0.2) + 50);
        c.fillText("2 PLAYERS", U(0.035), V(0.2) - 34);
      });
      cp.add(k.plane(0.6, L, k.print(overlay, { roughness: 0.5 }), { at: [0, 0.001, -L / 2], rot: [-Math.PI / 2, 0, 0] }));
      const button = (color: THREE.Material, x: number, s: number) => k.lathe([[0, 0.009], [0.011, 0.0105], [0.0125, 0.011], [0.013, 0.004], [0.017, 0.004], [0.0175, 0.002], [0.0175, 0], [0, 0]], color, { at: [x, 0, -s], seg: 24 });
      for (const [x, s, col] of spots) cp.add(button(k.plastic(col, 0.8), x, s));
      const startMat = o.on ? k.glow("#fff3d6", true, 1.4) : k.plastic("#e8e6df", 0.7);
      for (const [x, s] of starts) cp.add(button(startMat, x, s));
      for (const [x, s] of sticks) {
        cp.add(k.cyl(0.022, 0.022, 0.003, k.plastic("#0c0c0e", 0.5), { at: [x, 0.0015, -s] }));
        cp.add(k.cyl(0.005, 0.005, 0.07, k.metal("black", 0.3), { at: [x, 0.035, -s] }));
        cp.add(k.sphere(0.018, k.plastic("#d8322e", 0.85), { at: [x, 0.078, -s] }));
      }
      g.add(cp);
      // The bezel and the screen behind glass, tipped back.
      const bezelArt = canvasTexture(620, 500, (c, w, h) => {
        c.fillStyle = "#07070a";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#2b6fd6";
        c.lineWidth = 6;
        c.strokeRect(w / 2 - 166, 20, 332, 432);
        c.fillStyle = "#9fb7d9";
        c.font = `700 22px ${SANS}`;
        c.textAlign = "center";
        c.fillText("INSERT COIN", w / 2, h - 18);
        c.save();
        c.translate(60, h / 2);
        c.rotate(-Math.PI / 2);
        c.fillText("1 OR 2 PLAYERS", 0, 0);
        c.restore();
      });
      const bezel = new THREE.Group();
      bezel.position.set(0, 1.34, 0.135);
      bezel.rotation.x = -0.264;
      bezel.add(k.box(0.622, 0.5, 0.02, body, { at: [0, 0, -0.011] }));
      bezel.add(k.plane(0.62, 0.5, k.print(bezelArt, { roughness: 0.3 }), { at: [0, 0, 0.0005] }));
      bezel.add(k.plane(0.3, 0.4, k.screen(o.on, o.on ? arcadeScreen() : undefined, 1.25), { at: [0, 0.022, 0.0012] }));
      g.add(bezel);
      add(k.box(0.622, 0.22, 0.11, body, { at: [0, 1.72, 0.115] }));
      add(k.plane(0.6, 0.19, k.print(arcadeMarquee(), { roughness: 0.35, glow: o.on ? 1.0 : 0 }), { at: [0, 1.72, 0.1705] }));
      g.position.z = -0.005;
      return k.group([g]);
    },
  },

  skateboard: {
    size: [0.78, 0.15, 0.21],
    build(k, o) {
      const maple = k.wood("maple", { gloss: 0.35 });
      const grip = k.paint("#19191b", 0.04);
      const metal = k.metal("silver", 0.32);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      const deckY = 0.083;
      // The deck: a flat middle and a kicked nose and tail, seven-ply maple with grip tape on top.
      add(k.box(0.45, 0.012, 0.2, maple, { at: [0, deckY, 0], r: 0.004 }));
      add(k.box(0.45, 0.0015, 0.196, grip, { at: [0, deckY + 0.0066, 0] }));
      const kickOutline: [number, number][] = [[0, -0.1], [0.075, -0.1], ...arc(0.075, 0, 0.1, -Math.PI / 2, Math.PI / 2, 16).slice(1, -1), [0.075, 0.1], [0, 0.1]];
      const gripOutline: [number, number][] = [[0, -0.098], [0.075, -0.098], ...arc(0.075, 0, 0.098, -Math.PI / 2, Math.PI / 2, 16).slice(1, -1), [0.075, 0.098], [0, 0.098]];
      for (const sx of [-1, 1]) {
        const kick = k.group(
          [
            k.extrude(kickOutline, 0.012, maple, { rot: [-Math.PI / 2, 0, 0], bevel: 0.003 }),
            k.extrude(gripOutline, 0.0015, grip, { at: [0, 0.0066, 0], rot: [-Math.PI / 2, 0, 0], bevel: 0.0004 }),
          ],
          { at: [sx * 0.222, deckY, 0], rot: [0, sx > 0 ? 0 : Math.PI, 0.33] }
        );
        add(kick);
      }
      // Two trucks: baseplate, bushing, hanger and axle, four wheels, and the bolts through the deck.
      const wheel: [number, number][] = [[0, -0.011], [0.011, -0.011], [0.0125, -0.0155], [0.022, -0.016], [0.026, -0.0135], [0.027, -0.007], [0.027, 0.007], [0.026, 0.0135], [0.022, 0.016], [0.0125, 0.0155], [0.011, 0.011], [0, 0.011]];
      const urethane = k.plastic(o.color ?? "#ece5d4", 0.35);
      for (const x of [-0.2, 0.2]) {
        add(k.box(0.058, 0.008, 0.066, metal, { at: [x, deckY - 0.01, 0], r: 0.003 }));
        add(k.cyl(0.013, 0.014, 0.03, k.plastic("#d9b13b", 0.4), { at: [x - Math.sign(x) * 0.012, deckY - 0.025, 0] }));
        add(k.box(0.03, 0.024, 0.13, metal, { at: [x, 0.033, 0], r: 0.008 }));
        add(k.cyl(0.004, 0.004, 0.206, metal, { at: [x, 0.027, 0], rot: [Math.PI / 2, 0, 0], seg: 12 }));
        for (const z of [-0.087, 0.087]) add(k.lathe(wheel, urethane, { at: [x, 0.027, z], rot: [Math.PI / 2, 0, 0], seg: 28 }));
        for (const dx of [-0.027, 0.027]) for (const z of [-0.0205, 0.0205]) add(k.cyl(0.0042, 0.0042, 0.0016, k.metal("black", 0.4), { at: [x + dx, deckY + 0.0081, z], seg: 10 }));
      }
      return k.group([g]);
    },
  },

  hoop: {
    size: [0.46, 0.52, 0.3],
    wall: true,
    build(k, o) {
      const boardHex = o.color ?? "#f3f3f0";
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      const rimY = 0.26;
      const R = 0.1145;
      const rimZ = 0.176;
      // The backboard, its printed border and shooter's square, four screws into the wall.
      add(k.box(0.46, 0.3, 0.02, k.paint(boardHex, 0.5), { at: [0, 0.37, 0.01], r: 0.006 }));
      const face = canvasTexture(768, 500, (c, w, h) => {
        c.fillStyle = boardHex;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#c8302a";
        c.lineWidth = 22;
        c.strokeRect(26, 26, w - 52, h - 52);
        c.lineWidth = 14;
        c.strokeRect(w / 2 - 128, h - 70 - 215, 256, 215);
        c.fillStyle = "#1d1f22";
        c.font = `900 34px ${HEAVY}`;
        c.textAlign = "center";
        c.fillText("PRO MINI", w / 2, 92);
      });
      add(k.plane(0.448, 0.288, k.print(face, { roughness: 0.4 }), { at: [0, 0.37, 0.0205] }));
      for (const [x, y] of [[-0.205, 0.24], [0.205, 0.24], [-0.205, 0.5], [0.205, 0.5]]) add(k.cyl(0.006, 0.006, 0.004, k.metal("chrome"), { at: [x, y, 0.022], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      // The rim on its bracket.
      const orange = k.paint("#dd5a1e", 0.55);
      add(k.box(0.09, 0.07, 0.008, orange, { at: [0, rimY - 0.02, 0.024], r: 0.003 }));
      add(k.box(0.05, 0.026, 0.04, orange, { at: [0, rimY - 0.006, 0.045], r: 0.004 }));
      add(k.torus(R, 0.0065, orange, { at: [0, rimY, rimZ], rot: [Math.PI / 2, 0, 0], seg: 56 }));
      // The net: twelve cords, each knotted to its neighbours in turn, so the diamonds close.
      const cord = k.paper("#f1f1ed");
      const N = 12;
      const half = Math.PI / N;
      for (let i = 0; i < N; i += 1) {
        const a = (i / N) * Math.PI * 2;
        const s = i % 2 ? -1 : 1;
        const pts: V3[] = [];
        for (let j = 0; j <= 6; j += 1) {
          const ang = j === 0 ? a : a + s * (j % 2 ? half : -half);
          const r = R - 0.004 - j * 0.0068;
          pts.push([Math.cos(ang) * r, rimY - 0.004 - j * 0.042, rimZ + Math.sin(ang) * r]);
        }
        add(rail(k, pts, 0.0022, cord, 0.008));
      }
      return k.group([g]);
    },
  },

  dumbbells: {
    size: [0.91, 0.77, 0.62],
    build(k, o) {
      const frame = k.paint(o.color ?? "#1d1f22", 0.45);
      const head = k.rubber("#232427");
      const chrome = k.metal("chrome", 0.22);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // An A-frame at each end, standing on a foot, and two shelves of rails between them.
      for (const x of [-0.43, 0.43]) {
        add(k.box(0.04, 0.8, 0.04, frame, { at: [x, 0.39, 0.115], rot: [-0.396, 0, 0], r: 0.004 }));
        add(k.box(0.04, 0.775, 0.04, frame, { at: [x, 0.38, -0.155], rot: [0.301, 0, 0], r: 0.004 }));
        add(k.box(0.05, 0.03, 0.62, frame, { at: [x, 0.015, 0], r: 0.004 }));
      }
      const shelves = [
        { z0: 0.2, y0: 0.23, z1: -0.02, y1: 0.3, weights: [20, 25, 30] },
        { z0: 0.065, y0: 0.5, z1: -0.125, y1: 0.57, weights: [5, 10, 15] },
      ];
      for (const sh of shelves) {
        const dz = sh.z0 - sh.z1;
        const dy = sh.y1 - sh.y0;
        const len = Math.hypot(dz, dy);
        const tilt = Math.atan2(dy, dz);
        const shelf = new THREE.Group();
        shelf.position.set(0, (sh.y0 + sh.y1) / 2, (sh.z0 + sh.z1) / 2);
        shelf.rotation.x = tilt;
        for (const z of [-len / 2, len / 2]) shelf.add(k.box(0.9, 0.03, 0.04, frame, { at: [0, 0, z], r: 0.004 }));
        for (const x of [-0.43, 0.43]) shelf.add(k.box(0.04, 0.03, len + 0.04, frame, { at: [x, -0.012, 0], r: 0.004 }));
        // Pairs, lightest on the left, each head resting on a rail.
        let x = -0.4;
        for (const w of sh.weights)
          for (let n = 0; n < 2; n += 1) {
            const D = 0.07 + w * 0.0022;
            const L = 0.045 + w * 0.0012;
            const lift = 0.015 + (D / 2) * 0.866;
            x += D / 2;
            const off = 0.065 + L / 2;
            shelf.add(k.cyl(D / 2, D / 2, L, head, { at: [x, lift, off], rot: [Math.PI / 2, Math.PI / 6, 0], seg: 6 }));
            shelf.add(k.cyl(D / 2, D / 2, L, head, { at: [x, lift, -off], rot: [Math.PI / 2, Math.PI / 6, 0], seg: 6 }));
            shelf.add(k.cyl(0.0155, 0.0155, 0.132, chrome, { at: [x, lift, 0], rot: [Math.PI / 2, 0, 0], seg: 20 }));
            const label = canvasTexture(128, 128, (c, cw, ch) => {
              c.fillStyle = "#2e2f33";
              c.fillRect(0, 0, cw, ch);
              c.fillStyle = "#f2f2f2";
              c.textAlign = "center";
              c.font = `800 52px ${SANS}`;
              c.fillText(String(w), cw / 2, 70);
              c.font = `700 22px ${SANS}`;
              c.fillText("LB", cw / 2, 100);
            });
            shelf.add(k.disc(D * 0.3, k.print(label, { roughness: 0.6 }), { at: [x, lift, off + L / 2 + 0.0006] }));
            x += D / 2 + 0.012;
          }
        g.add(shelf);
      }
      return k.group([g]);
    },
  },

  "skate-ramp": {
    size: [1.0, 0.56, 1.06],
    build(k, o) {
      const ply = k.wood("#d9bf92", { gloss: 0.3 });
      const sides = o.color ? k.paint(o.color, 0.35) : k.wood("#d2b47f", { gloss: 0.3 });
      const steel = k.metal("steel", 0.28);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // A quarter pipe: a 0.85 m radius transition up to 0.55 m, a deck behind it.
      const R = 0.85;
      const t = 0.012;
      const front = 0.55;
      const phi0 = Math.acos(R / (R + t));
      const phi1 = Math.acos((R - 0.55) / R);
      const at = (rad: number, phi: number): [number, number] => [front - rad * Math.sin(phi), R - rad * Math.cos(phi)];
      const inner: [number, number][] = [];
      const outer: [number, number][] = [];
      for (let i = 0; i <= 40; i += 1) {
        const phi = phi0 + ((phi1 - phi0) * i) / 40;
        inner.push(at(R, phi));
        outer.push(at(R + t, phi));
      }
      add(k.extrude([...inner, ...outer.reverse()], 1.0, k.wood("#c49a68", { gloss: 0.45 }), { rot: [0, -Math.PI / 2, 0], bevel: 0.002 }));
      // Seams between the sheets of the riding surface.
      for (const phi of [0.62, 1.0]) {
        const [z, y] = at(R - 0.0005, phi);
        add(k.box(1.0, 0.0012, 0.003, k.paint("#5a4330", 0.2), { at: [0, y, z], rot: [-phi, 0, 0] }));
      }
      const top = at(R + t, phi1);
      const sideOutline: [number, number][] = [...outer.slice().reverse(), [-0.55, top[1]], [-0.55, 0]];
      for (const x of [-0.491, 0.491]) add(k.extrude(sideOutline, 0.018, sides, { at: [x, 0, 0], rot: [0, -Math.PI / 2, 0], bevel: 0.002 }));
      add(k.box(1.0, 0.012, 0.305, ply, { at: [0, 0.544, -0.3975], r: 0.002 }));
      add(k.box(1.0, top[1], 0.012, ply, { at: [0, top[1] / 2, -0.544] }));
      // Steel coping along the lip, bolted through the deck, and a steel plate where it meets the floor.
      add(k.cyl(0.03, 0.03, 1.0, steel, { at: [0, 0.528, -0.267], rot: [0, 0, Math.PI / 2], seg: 32 }));
      for (const x of [-0.35, 0, 0.35]) add(k.cyl(0.008, 0.008, 0.004, k.metal("black", 0.4), { at: [x, 0.551, -0.33], seg: 12 }));
      add(k.box(1.0, 0.004, 0.11, steel, { at: [0, 0.008, 0.452], rot: [0.11, 0, 0] }));
      const sticker = canvasTexture(256, 256, (c, w, h) => {
        c.fillStyle = "#1d1f22";
        c.beginPath();
        c.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#f2c230";
        c.textAlign = "center";
        c.font = `900 50px ${HEAVY}`;
        c.fillText("MINI", w / 2, 118);
        c.fillText("RAMP", w / 2, 172);
      });
      add(k.disc(0.07, k.print(sticker, { roughness: 0.5 }), { at: [0.5005, 0.2, -0.22], rot: [0, Math.PI / 2, 0] }));
      g.position.z = 0.0225;
      return k.group([g]);
    },
  },

  drone: {
    size: [0.5, 0.52, 0.52],
    build(k, o) {
      const dock = k.plastic("#eceef0", 0.4);
      const graphite = k.plastic("#2a2d32", 0.5);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The dock: a white cabinet, a landing pad on top with charging contacts, a status screen and a light strip.
      add(k.box(0.46, 0.03, 0.46, graphite, { at: [0, 0.015, 0], r: 0.006 }));
      add(k.box(0.5, 0.39, 0.5, dock, { at: [0, 0.225, 0], r: 0.03 }));
      const sq = (h: number): [number, number][] => [[-h, -h], [h, -h], [h, h], [-h, h]];
      add(k.extrude(sq(0.24), 0.012, graphite, { at: [0, 0.426, 0], rot: [-Math.PI / 2, 0, 0], holes: [sq(0.222)], bevel: 0.003 }));
      const vents = canvasTexture(256, 256, (c, w, h) => {
        c.fillStyle = "#e9ebed";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#a3a8ae";
        for (let i = 0; i < 12; i += 1) c.fillRect(30, 22 + i * 18, w - 60, 8);
      });
      add(k.plane(0.22, 0.2, k.print(vents, { roughness: 0.6 }), { at: [0.2505, 0.22, 0], rot: [0, Math.PI / 2, 0] }));
      const pad = canvasTexture(512, 512, (c, w, h) => {
        c.fillStyle = "#3a3d42";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#f2f2f2";
        c.lineWidth = 14;
        c.beginPath();
        c.arc(w / 2, h / 2, 200, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = "#f2f2f2";
        c.font = `900 230px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("H", w / 2, h / 2 + 10);
      });
      add(k.plane(0.44, 0.44, k.print(pad, { roughness: 0.7 }), { at: [0, 0.4205, 0], rot: [-Math.PI / 2, 0, 0] }));
      const legs: [number, number][] = [[-0.118, 0.105], [0.118, 0.105], [-0.118, -0.105], [0.118, -0.105]];
      for (const [x, z] of legs) add(k.box(0.03, 0.002, 0.03, k.metal("gold", 0.25), { at: [x, 0.4215, z] }));
      const status = o.on
        ? canvasTexture(256, 64, (c, w, h) => {
            c.fillStyle = "#06121a";
            c.fillRect(0, 0, w, h);
            c.fillStyle = "#7fe8ff";
            c.font = `700 24px ${SANS}`;
            c.textBaseline = "middle";
            c.fillText("CHARGING", 14, h / 2);
            c.strokeStyle = "#7fe8ff";
            c.lineWidth = 3;
            c.strokeRect(150, 18, 80, 28);
            c.fillRect(153, 21, 62, 22);
            c.fillRect(231, 26, 5, 12);
          })
        : undefined;
      add(k.plane(0.16, 0.04, k.screen(o.on, status, 1.2), { at: [0, 0.345, 0.2502] }));
      add(k.box(0.4, 0.008, 0.004, k.glow("#7fe8ff", o.on, 2.2), { at: [0, 0.4, 0.249] }));
      const grille = canvasTexture(256, 128, (c, w, h) => {
        c.fillStyle = "#e6e8ea";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#9da2a8";
        for (let i = 0; i < 9; i += 1) c.fillRect(18 + i * 26, 16, 12, h - 32);
      });
      add(k.plane(0.2, 0.1, k.print(grille, { roughness: 0.6 }), { at: [0, 0.12, 0.2502] }));
      const logo = canvasTexture(256, 48, (c, w, h) => {
        c.fillStyle = "#eceef0";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#5c6168";
        c.font = `700 26px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("SKYDOCK", w / 2, h / 2 + 1);
      });
      add(k.plane(0.1, 0.019, k.print(logo, { roughness: 0.5 }), { at: [0, 0.29, 0.2502] }));
      add(k.tube([[0.16, 0.06, -0.25], [0.16, 0.03, -0.258], [0.165, 0.007, -0.262], [0.17, 0.006, -0.25], [0.2, 0.006, -0.235]], 0.0045, k.rubber("#26272a"), { seg: 24 }));
      // The quadcopter: body and battery, four arms, motors and two-blade props, a camera on its gimbal.
      const shell = k.plastic(o.color ?? "#454a51", 0.5);
      const cy = 0.4825;
      add(k.box(0.09, 0.052, 0.17, shell, { at: [0, cy, 0], r: 0.02 }));
      add(k.box(0.07, 0.022, 0.08, k.plastic("#1f2125", 0.5), { at: [0, cy + 0.027, -0.04], r: 0.008 }));
      for (const [x, z] of legs) {
        const dx = x - Math.sign(x) * 0.04;
        const dz = z - Math.sign(z) * 0.055;
        const len = Math.hypot(dx, dz);
        add(k.box(len + 0.01, 0.014, 0.018, shell, { at: [Math.sign(x) * 0.04 + dx / 2, cy + 0.008, Math.sign(z) * 0.055 + dz / 2], rot: [0, -Math.atan2(dz, dx), 0], r: 0.005 }));
        add(k.cyl(0.016, 0.016, 0.022, graphite, { at: [x, cy + 0.012, z], seg: 24 }));
        add(k.box(0.15, 0.0025, 0.016, k.plastic("#1b1c1f", 0.4), { at: [x, cy + 0.025, z], rot: [0, (x * 37 + z * 11) % 3, 0], r: 0.001 }));
        add(k.cyl(0.0045, 0.0035, 0.066, graphite, { at: [x, cy - 0.028, z] }));
      }
      add(k.sphere(0.017, graphite, { at: [0, cy - 0.022, 0.085] }));
      add(k.cyl(0.0085, 0.0085, 0.006, k.glass("#141820", 0.85), { at: [0, cy - 0.022, 0.1015], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      add(k.sphere(0.0045, k.glow("#ff3b2f", o.on, 2.5), { at: [-0.118, cy - 0.002, 0.123] }));
      add(k.sphere(0.0045, k.glow("#3bff6a", o.on, 2.5), { at: [0.118, cy - 0.002, 0.123] }));
      g.position.z = 0.008;
      return k.group([g]);
    },
  },

  vending: {
    size: [0.9, 1.83, 0.88],
    light: { at: [-0.1, 1.15, 0.55], color: "#eef4ff", intensity: 1.6, distance: 3.2 },
    build(k, o) {
      const body = k.paint(o.color ?? "#24282e", 0.5);
      const inside = k.paint("#d9dde2", 0.3);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // Cabinet: a side wall, the control column, a top, the base with the delivery bin, and a lit back wall.
      add(k.box(0.04, 1.83, 0.85, body, { at: [-0.43, 0.915, 0], r: 0.006 }));
      add(k.box(0.25, 1.83, 0.85, body, { at: [0.325, 0.915, 0], r: 0.006 }));
      add(k.box(0.62, 0.1, 0.85, body, { at: [-0.105, 1.78, 0] }));
      add(k.box(0.62, 0.48, 0.85, body, { at: [-0.105, 0.24, 0] }));
      add(k.box(0.62, 1.25, 0.02, inside, { at: [-0.105, 1.105, -0.39] }));
      add(k.box(0.62, 1.25, 0.012, body, { at: [-0.105, 1.105, -0.419] }));
      for (const x of [-0.405, 0.194]) add(k.box(0.012, 1.2, 0.012, k.glow("#f4f8ff", o.on, 1.8), { at: [x, 1.105, 0.39] }));
      // Five trays, each with its spiral coils, price strip and the front row of what it sells.
      const label = (name: string, sub: string, a: string, b: string, ink = "#ffffff") =>
        canvasTexture(256, 384, (c, w, h) => {
          const bg = c.createLinearGradient(0, 0, w, h);
          bg.addColorStop(0, a);
          bg.addColorStop(1, b);
          c.fillStyle = bg;
          c.fillRect(0, 0, w, h);
          c.fillStyle = "rgba(255,255,255,0.18)";
          c.beginPath();
          c.ellipse(w * 0.5, h * 0.62, w * 0.42, h * 0.16, -0.2, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = ink;
          c.textAlign = "center";
          c.font = `900 ${name.length > 6 ? 44 : 58}px ${HEAVY}`;
          c.fillText(name, w / 2, h * 0.42);
          c.font = `700 26px ${SANS}`;
          c.fillText(sub, w / 2, h * 0.8);
        });
      const mats = {
        choco: k.print(label("CHOCO", "milk chocolate", "#5a2d1c", "#3a1a10"), { roughness: 0.4 }),
        nutty: k.print(label("NUTTY", "peanut bar", "#e8a21c", "#b8720f", "#3a1a10"), { roughness: 0.4 }),
        mint: k.print(label("MINT", "dark chocolate", "#1f7a5a", "#0f4a36"), { roughness: 0.4 }),
        cookie: k.print(label("COOKIES", "chocolate chip", "#2d5fa8", "#173a70"), { roughness: 0.5 }),
        cracker: k.print(label("CRACKERS", "cheddar", "#e0592a", "#a83a16"), { roughness: 0.5 }),
        salt: k.print(label("CHIPS", "sea salt", "#f2c230", "#d39a12", "#2a1c0e"), { roughness: 0.35 }),
        bbq: k.print(label("CHIPS", "barbecue", "#b5262c", "#7a1418"), { roughness: 0.35 }),
        sour: k.print(label("CHIPS", "sour cream", "#3a8f4a", "#1f5c2c"), { roughness: 0.35 }),
        pretzel: k.print(label("PRETZELS", "twists", "#8a4b1c", "#5c2f10"), { roughness: 0.35 }),
        water: k.print(label("WATER", "spring", "#9fd3ef", "#3b8fc4"), { roughness: 0.2 }),
        cola: k.print(label("COLA", "classic", "#c41f26", "#7e0f14"), { roughness: 0.25 }),
        lime: k.print(label("LIME", "sparkling", "#4caf50", "#1f6a28"), { roughness: 0.25 }),
      };
      const rows: { kind: "bar" | "box" | "bag" | "bottle" | "can"; mats: THREE.Material[] }[] = [
        { kind: "can", mats: [mats.cola, mats.lime, mats.cola, mats.water, mats.lime] },
        { kind: "bag", mats: [mats.salt, mats.bbq, mats.sour, mats.salt, mats.pretzel] },
        { kind: "bag", mats: [mats.pretzel, mats.salt, mats.bbq, mats.sour, mats.bbq] },
        { kind: "box", mats: [mats.cookie, mats.cracker, mats.cookie, mats.cracker, mats.cookie] },
        { kind: "bar", mats: [mats.choco, mats.nutty, mats.mint, mats.choco, mats.nutty] },
      ];
      const wire = k.metal("silver", 0.25);
      rows.forEach((row, i) => {
        const y = 0.53 + i * 0.235;
        add(k.box(0.6, 0.012, 0.72, k.metal("steel", 0.45), { at: [-0.105, y, -0.02] }));
        // One wire runs through all five coils, its turns under the price strip and at the back.
        const pts: V3[] = [];
        const r = 0.046;
        const axis = y + 0.006 + r;
        for (let c = 0; c < 5; c += 1) {
          const xc = -0.345 + c * 0.12;
          for (let j = 0; j <= 96; j += 1) {
            const f = c % 2 ? 1 - j / 96 : j / 96;
            const th = f * Math.PI * 16;
            pts.push([xc + Math.sin(th) * r, axis - Math.cos(th) * r, 0.31 - f * 0.64]);
          }
        }
        add(k.tube(pts, 0.0024, wire, { seg: 1400 }));
        const prices = canvasTexture(1024, 52, (c, w, h) => {
          c.fillStyle = "#15171a";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#f2f2f2";
          c.font = `700 28px ${SANS}`;
          c.textBaseline = "middle";
          for (let col = 0; col < 5; col += 1) c.fillText(`${"EDCBA"[i]}${col + 1}  ${(1.25 + ((i + col) % 3) * 0.25).toFixed(2)}`, 28 + col * 204, h / 2 + 1);
        });
        add(k.plane(0.6, 0.03, k.print(prices, { roughness: 0.5 }), { at: [-0.105, y + 0.004, 0.341] }));
        row.mats.forEach((m, c) => {
          const x = -0.345 + c * 0.12;
          if (row.kind === "bar") add(k.box(0.078, 0.13, 0.02, m, { at: [x, y + 0.072, 0.27], rot: [-0.12, 0, 0], r: 0.003 }));
          else if (row.kind === "box") add(k.box(0.09, 0.13, 0.034, m, { at: [x, y + 0.071, 0.27], rot: [-0.08, 0, 0], r: 0.003 }));
          else if (row.kind === "bag") add(k.cushion(0.1, 0.165, 0.045, m, { at: [x, y + 0.088, 0.265], rot: [-0.1, 0, 0] }));
          else add(k.cyl(0.033, 0.033, 0.122, m, { at: [x, y + 0.067, 0.275], seg: 28 }));
        });
      });
      add(k.plane(0.61, 1.25, k.glass("#dfeaf0", 0.14), { at: [-0.105, 1.105, 0.418] }));
      // The control column: lit header, selection display, keypad, coin and bill slots, card reader, coin return.
      const header = canvasTexture(256, 360, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#ff6a2a");
        bg.addColorStop(1, "#d8274a");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#ffffff";
        c.textAlign = "center";
        c.font = `900 50px ${HEAVY}`;
        c.fillText("SNACKS", w / 2, 150);
        c.font = `900 50px ${HEAVY}`;
        c.fillText("DRINKS", w / 2, 260);
        c.font = `700 30px ${SANS}`;
        c.fillText("&", w / 2, 202);
      });
      add(k.plane(0.2, 0.28, k.print(header, { roughness: 0.4, glow: o.on ? 0.9 : 0 }), { at: [0.325, 1.56, 0.4255] }));
      const display = o.on
        ? canvasTexture(256, 80, (c, w, h) => {
            c.fillStyle = "#04160c";
            c.fillRect(0, 0, w, h);
            c.fillStyle = "#6dff9a";
            c.font = `700 30px ${MONO}`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("MAKE SELECTION", w / 2, h / 2 + 1);
          })
        : undefined;
      add(k.box(0.17, 0.06, 0.01, k.plastic("#0e0f11", 0.6), { at: [0.325, 1.355, 0.428], r: 0.003 }));
      add(k.plane(0.15, 0.045, k.screen(o.on, display, 1.1), { at: [0.325, 1.355, 0.4335] }));
      const keypad = canvasTexture(256, 340, (c, w, h) => {
        c.fillStyle = "#b9bec4";
        c.fillRect(0, 0, w, h);
        const keys = ["A", "B", "C", "D", "E", "F", "1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"];
        keys.forEach((key, i) => {
          const x = 18 + (i % 3) * 78;
          const y = 14 + Math.floor(i / 3) * 54;
          c.fillStyle = "#e9ebee";
          c.fillRect(x, y, 66, 44);
          c.fillStyle = "rgba(0,0,0,0.25)";
          c.fillRect(x, y + 40, 66, 4);
          c.fillStyle = "#24272b";
          c.font = `700 ${key.length > 1 ? 20 : 26}px ${SANS}`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(key, x + 33, y + 22);
        });
      });
      add(k.box(0.15, 0.2, 0.01, k.metal("steel", 0.3), { at: [0.325, 1.16, 0.428], r: 0.004 }));
      add(k.plane(0.13, 0.172, k.print(keypad, { roughness: 0.45 }), { at: [0.325, 1.16, 0.4335] }));
      add(k.box(0.05, 0.07, 0.014, k.metal("chrome", 0.15), { at: [0.27, 0.98, 0.43], r: 0.004 }));
      add(k.box(0.004, 0.032, 0.004, k.plastic("#0b0b0c"), { at: [0.27, 0.99, 0.437] }));
      add(k.box(0.09, 0.05, 0.03, k.plastic("#141518", 0.5), { at: [0.36, 0.98, 0.438], r: 0.005 }));
      add(k.box(0.05, 0.006, 0.004, k.glow("#4cff7a", o.on, 2), { at: [0.36, 0.995, 0.4535] }));
      add(k.box(0.07, 0.09, 0.022, k.plastic("#141518", 0.5), { at: [0.325, 0.84, 0.434], r: 0.006 }));
      add(k.box(0.05, 0.035, 0.003, k.glow("#7fd8ff", o.on, 1.2), { at: [0.325, 0.85, 0.4455] }));
      add(k.box(0.08, 0.05, 0.03, k.metal("chrome", 0.2), { at: [0.325, 0.68, 0.432], r: 0.008 }));
      add(k.box(0.06, 0.03, 0.004, k.plastic("#0b0b0c"), { at: [0.325, 0.675, 0.4475] }));
      // The delivery bin, its push flap, and a kick plate.
      add(k.box(0.5, 0.2, 0.008, k.plastic("#0c0d0f"), { at: [-0.105, 0.24, 0.4245] }));
      const flap = canvasTexture(512, 160, (c, w, h) => {
        c.fillStyle = "#34383e";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#c9ced4";
        c.font = `800 44px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("PUSH", w / 2, h / 2);
      });
      add(k.box(0.46, 0.16, 0.012, k.print(flap, { roughness: 0.5 }), { at: [-0.105, 0.245, 0.43], rot: [-0.06, 0, 0], r: 0.004 }));
      add(k.box(0.9, 0.06, 0.012, k.plastic("#0f1012", 0.4), { at: [0, 0.03, 0.42] }));
      // A printed panel down the side.
      const side = canvasTexture(400, 900, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#ff6a2a");
        bg.addColorStop(1, "#c41f4a");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.12)";
        for (let i = 0; i < 6; i += 1) {
          c.beginPath();
          c.arc(w * 0.5, h * 0.62, 60 + i * 55, 0, Math.PI * 2);
          c.fill();
        }
        c.save();
        c.translate(w * 0.5, h * 0.42);
        c.rotate(-Math.PI / 2);
        c.fillStyle = "#ffffff";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `900 120px ${HEAVY}`;
        c.fillText("SNACKS", 0, 0);
        c.restore();
      });
      add(k.plane(0.7, 1.58, k.print(side, { roughness: 0.4 }), { at: [0.4505, 0.98, 0], rot: [0, Math.PI / 2, 0] }));
      g.position.z = -0.0155;
      return k.group([g]);
    },
  },

  foosball: {
    size: [1.4, 0.93, 1.32],
    build(k, o) {
      const wood = k.wood(o.color ? o.color : "walnut", { gloss: 0.5 });
      const chrome = k.metal("chrome", 0.12);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // Legs and braces, the cabinet's four walls, the field and the two goals.
      for (const x of [-0.62, 0.62]) {
        for (const z of [-0.3, 0.3]) add(k.box(0.07, 0.6, 0.07, wood, { at: [x, 0.3, z], r: 0.006 }));
        add(k.box(0.045, 0.045, 0.53, wood, { at: [x, 0.13, 0], r: 0.004 }));
      }
      for (const z of [-0.365, 0.365]) add(k.box(1.4, 0.34, 0.03, wood, { at: [0, 0.75, z], r: 0.006 }));
      for (const x of [-0.685, 0.685]) add(k.box(0.03, 0.34, 0.7, wood, { at: [x, 0.75, 0], r: 0.006 }));
      add(k.box(1.34, 0.14, 0.7, k.paint("#2c5a2e", 0.2), { at: [0, 0.65, 0] }));
      const field = canvasTexture(1400, 730, (c, w, h) => {
        for (let i = 0; i < 12; i += 1) {
          c.fillStyle = i % 2 ? "#3f8a3f" : "#378037";
          c.fillRect((i * w) / 12, 0, w / 12 + 1, h);
        }
        c.strokeStyle = "rgba(255,255,255,0.92)";
        c.lineWidth = 7;
        c.strokeRect(24, 24, w - 48, h - 48);
        c.beginPath();
        c.moveTo(w / 2, 24);
        c.lineTo(w / 2, h - 24);
        c.stroke();
        c.beginPath();
        c.arc(w / 2, h / 2, 95, 0, Math.PI * 2);
        c.stroke();
        for (const side of [0, 1]) {
          const x0 = side ? w - 24 - 150 : 24;
          c.strokeRect(x0, h / 2 - 190, 150, 380);
          const x1 = side ? w - 24 - 60 : 24;
          c.strokeRect(x1, h / 2 - 110, 60, 220);
        }
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
        c.fill();
      });
      add(k.plane(1.34, 0.7, k.print(field, { roughness: 0.85 }), { at: [0, 0.7205, 0], rot: [-Math.PI / 2, 0, 0] }));
      for (const x of [-0.668, 0.668]) add(k.box(0.006, 0.07, 0.2, k.paint("#0d0e10", 0.2), { at: [x, 0.757, 0] }));
      // Eight rods: goalie, defence, attack and midfield for each side, handles on the owner's side.
      const red = k.plastic("#c0392b", 0.7);
      const blue = k.plastic("#2e5ea8", 0.7);
      const man: [number, number][] = [
        [-0.007, 0.021], [-0.016, 0.012], [-0.017, -0.012], [-0.015, -0.032], [-0.012, -0.05], [-0.01, -0.062], [-0.011, -0.074], [-0.011, -0.092], [-0.01, -0.1],
        [0.024, -0.1], [0.025, -0.092], [0.009, -0.088], [0.008, -0.07], [0.011, -0.058], [0.012, -0.04], [0.015, -0.022], [0.016, 0.004], [0.013, 0.015], [0.007, 0.022],
        ...arc(0.0015, 0.037, 0.0155, -0.9, Math.PI + 0.9, 14).map(([x, y]) => [x, y] as [number, number]),
      ];
      const lineup: [number, 0 | 1][] = [[1, 0], [2, 0], [3, 1], [5, 0], [5, 1], [3, 0], [2, 1], [1, 1]];
      const spread: Record<number, number[]> = { 1: [0], 2: [-0.12, 0.12], 3: [-0.2, 0, 0.2], 5: [-0.26, -0.13, 0, 0.13, 0.26] };
      const rodY = 0.83;
      lineup.forEach(([count, team], i) => {
        const x = -0.525 + i * 0.15;
        const hz = team === 0 ? 1 : -1;
        add(k.cyl(0.0079, 0.0079, 1.21, chrome, { at: [x, rodY, hz * 0.055], rot: [Math.PI / 2, 0, 0], seg: 16 }));
        add(k.cyl(0.019, 0.019, 0.14, k.rubber("#1b1b1d"), { at: [x, rodY, hz * 0.59], rot: [Math.PI / 2, 0, 0], seg: 8 }));
        add(k.cyl(0.012, 0.012, 0.02, k.rubber("#1b1b1d"), { at: [x, rodY, -hz * 0.548], rot: [Math.PI / 2, 0, 0], seg: 16 }));
        for (const z of spread[count]) add(k.extrude(man, 0.026, team === 0 ? red : blue, { at: [x, rodY, z], rot: [0, team === 0 ? 0 : Math.PI, 0], bevel: 0.004 }));
      });
      add(k.sphere(0.0175, k.plastic("#f4f1ea", 0.5), { at: [0.14, 0.738, 0.08] }));
      add(k.torus(0.022, 0.006, chrome, { at: [0, 0.921, 0.365], rot: [Math.PI / 2, 0, 0] }));
      return k.group([g]);
    },
  },

  pinball: {
    size: [0.74, 1.82, 1.46],
    light: { at: [0, 1.5, -0.35], color: "#ffd3a0", intensity: 1.6, distance: 3 },
    build(k, o) {
      const body = k.paint(o.color ?? "#1b2238", 0.45);
      const chrome = k.metal("chrome", 0.12);
      const white = k.plastic("#f1efe9", 0.7);
      const rubber = k.rubber("#c8302a");
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The cabinet tilts up toward the back, the way a playfield runs.
      const cab = new THREE.Group();
      cab.position.set(0, 0.785, 0);
      cab.rotation.x = 0.105;
      const cadd = (...m: THREE.Object3D[]) => m.forEach((x) => cab.add(x));
      cadd(k.box(0.71, 0.24, 1.38, body, { at: [0, -0.06, 0], r: 0.008 }));
      for (const sx of [-1, 1]) cadd(k.box(0.025, 0.12, 1.38, body, { at: [sx * 0.3425, 0.12, 0], r: 0.004 }));
      cadd(k.box(0.66, 0.12, 0.025, body, { at: [0, 0.12, 0.6775] }));
      for (const sx of [-1, 1]) cadd(k.box(0.03, 0.012, 1.36, chrome, { at: [sx * 0.34, 0.186, 0] }));
      cadd(k.box(0.71, 0.03, 0.07, chrome, { at: [0, 0.195, 0.655], r: 0.008 }));
      const side = canvasTexture(1024, 256, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, "#160d44");
        bg.addColorStop(1, "#06102a");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        stars(c, w, h, 220, 61);
        const band = c.createLinearGradient(0, 0, w, 0);
        band.addColorStop(0, "#ff7a1f");
        band.addColorStop(1, "#ff2fa0");
        c.fillStyle = band;
        c.beginPath();
        c.moveTo(0, h * 0.78);
        c.lineTo(w, h * 0.3);
        c.lineTo(w, h * 0.4);
        c.lineTo(0, h * 0.9);
        c.fill();
        c.fillStyle = "#ffe066";
        c.font = `italic 900 70px ${HEAVY}`;
        c.textBaseline = "middle";
        c.fillText("STARLIGHT", 40, h * 0.36);
      });
      for (const sx of [-1, 1]) cadd(k.plane(1.36, 0.34, k.print(side, { roughness: 0.4 }), { at: [sx * 0.3555, 0, 0], rot: [0, (sx * Math.PI) / 2, 0] }));
      // The playfield under glass: flippers, slingshots, pop bumpers, targets, a wire ramp and the ball.
      const y0 = 0.0605;
      cadd(k.plane(0.66, 1.09, k.print(pinballField(o.on), { roughness: 0.35, glow: o.on ? 0.35 : 0 }), { at: [0, y0, 0.105], rot: [-Math.PI / 2, 0, 0] }));
      cadd(k.plane(0.66, 1.12, k.glass("#e6eef2", 0.08), { at: [0, 0.178, 0.11], rot: [-Math.PI / 2, 0, 0] }));
      const field = (outline: [number, number][], h: number, m: THREE.Material) => k.extrude(outline.map(([x, z]) => [x, -z] as [number, number]), h, m, { at: [0, y0 + h / 2, 0], rot: [-Math.PI / 2, 0, 0], bevel: 0.002 });
      const ring = (outline: [number, number][], y: number, r: number) => k.tube([...outline, outline[0]].map(([x, z]) => [x, y, z] as V3), r, rubber, { seg: 64 });
      for (const sx of [-1, 1]) {
        const ang = sx < 0 ? 0.42 : Math.PI - 0.42;
        const flip: [number, number][] = [...arc(0, 0, 0.012, Math.PI / 2, (3 * Math.PI) / 2, 8), ...arc(0.072, 0, 0.0065, -Math.PI / 2, Math.PI / 2, 6)].map(([x, y]) => [
          sx * 0.095 + x * Math.cos(ang) - y * Math.sin(ang),
          0.5 + x * Math.sin(ang) + y * Math.cos(ang),
        ]);
        cadd(field(flip, 0.022, white));
        cadd(ring(flip, y0 + 0.011, 0.0045));
        const sling: [number, number][] = [[sx * 0.2, 0.36], [sx * 0.2, 0.22], [sx * 0.118, 0.405]];
        cadd(field(sling, 0.03, white));
        cadd(ring(sling, y0 + 0.016, 0.005));
      }
      for (const [x, z, col] of [[-0.09, -0.2, "#ff3b3b"], [0.09, -0.2, "#ffd84d"], [0, -0.31, "#3b8bff"]] as const) {
        cadd(k.cyl(0.03, 0.032, 0.036, white, { at: [x, y0 + 0.018, z], seg: 24 }));
        cadd(k.cyl(0.04, 0.04, 0.012, k.glow(col, o.on, 1.6), { at: [x, y0 + 0.042, z], seg: 24 }));
      }
      for (let i = 0; i < 3; i += 1) cadd(k.box(0.026, 0.034, 0.006, k.plastic("#ffd84d", 0.7), { at: [-0.25 + i * 0.03, y0 + 0.017, -0.02 + i * 0.018], rot: [0, 0.55, 0] }));
      for (const x of [-0.035, 0.035]) cadd(k.box(0.006, 0.02, 0.08, chrome, { at: [x, y0 + 0.01, -0.36] }));
      cadd(rail(k, arc(0, -0.13, 0.31, 0, Math.PI, 24).map(([x, z]) => [x, y0 + 0.015, z - 0.0] as V3).map(([x, y, z]) => [x, y, -0.13 - (z + 0.13)] as V3), 0.009, chrome, 0.03));
      cadd(k.box(0.006, 0.03, 0.98, chrome, { at: [0.29, y0 + 0.015, 0.16] }));
      cadd(k.sphere(0.0135, k.metal("chrome", 0.05), { at: [0.311, y0 + 0.0135, 0.56] }));
      const ramp: V3[] = [[-0.26, 0.004, 0.28], [-0.275, 0.035, 0.06], [-0.24, 0.07, -0.16], [-0.14, 0.088, -0.33], [0.0, 0.09, -0.38], [0.12, 0.08, -0.3], [0.16, 0.058, -0.14]];
      for (const side2 of [-1, 1]) {
        const pts = ramp.map((p, i) => {
          const a = ramp[Math.max(0, i - 1)];
          const b = ramp[Math.min(ramp.length - 1, i + 1)];
          const tx = b[0] - a[0];
          const tz = b[2] - a[2];
          const n = Math.hypot(tx, tz) || 1;
          return [p[0] - (tz / n) * 0.014 * side2, y0 + p[1], p[2] + (tx / n) * 0.014 * side2] as V3;
        });
        cadd(k.tube(pts, 0.0028, chrome, { seg: 80 }));
      }
      const apron = canvasTexture(512, 96, (c, w, h) => {
        c.fillStyle = "#0d0f14";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#f2efe6";
        c.fillRect(12, 14, 150, h - 28);
        c.fillRect(w - 162, 14, 150, h - 28);
        c.fillStyle = "#30323a";
        c.font = `700 15px ${SANS}`;
        c.fillText("3 BALLS PER GAME", 20, 40);
        c.fillText("REPLAY AT 5,000,000", w - 156, 40);
      });
      cadd(k.box(0.56, 0.026, 0.1, k.plastic("#0d0f14", 0.4), { at: [-0.03, y0 + 0.013, 0.6] }));
      cadd(k.plane(0.54, 0.09, k.print(apron, { roughness: 0.5 }), { at: [-0.03, y0 + 0.0265, 0.6], rot: [-Math.PI / 2, 0, 0] }));
      // The front: coin door with two lit slots, a start button, the plunger; flipper buttons on the sides.
      cadd(k.box(0.28, 0.19, 0.012, k.metal("black", 0.5), { at: [0, -0.07, 0.696], r: 0.004 }));
      for (const x of [-0.06, 0.06]) cadd(k.plane(0.03, 0.05, k.print(coinInsert(), { roughness: 0.4, glow: o.on ? 1.1 : 0 }), { at: [x, -0.04, 0.7025] }));
      cadd(k.cyl(0.013, 0.013, 0.012, o.on ? k.glow("#fff3d6", true, 1.5) : k.plastic("#e8e6df", 0.7), { at: [-0.27, 0.11, 0.696], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      cadd(k.cyl(0.005, 0.005, 0.08, chrome, { at: [0.29, 0.07, 0.73], rot: [Math.PI / 2, 0, 0], seg: 12 }));
      cadd(k.cyl(0.018, 0.016, 0.03, k.plastic("#d8322e", 0.7), { at: [0.29, 0.07, 0.785], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      for (const sx of [-1, 1]) cadd(k.cyl(0.015, 0.015, 0.012, k.plastic("#f2c230", 0.7), { at: [sx * 0.361, 0.1, 0.6], rot: [0, 0, Math.PI / 2], seg: 20 }));
      g.add(cab);
      // Legs, and the backbox standing at the back with its lit backglass and score display.
      for (const x of [-0.32, 0.32]) {
        add(k.box(0.045, 0.6, 0.045, chrome, { at: [x, 0.3, 0.58], r: 0.004 }));
        add(k.box(0.045, 0.74, 0.045, chrome, { at: [x, 0.37, -0.62], r: 0.004 }));
      }
      add(k.box(0.71, 0.82, 0.24, body, { at: [0, 1.41, -0.58], r: 0.008 }));
      add(k.plane(0.66, 0.5, k.print(pinballBackglass(), { roughness: 0.25, glow: o.on ? 1.0 : 0 }), { at: [0, 1.54, -0.4595] }));
      const speakers = canvasTexture(660, 220, (c, w, h) => {
        c.fillStyle = "#0b0c10";
        c.fillRect(0, 0, w, h);
        for (const x of [80, w - 80]) {
          c.fillStyle = "#1c1e24";
          c.beginPath();
          c.arc(x, h / 2, 62, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#0b0c10";
          for (let i = -50; i <= 50; i += 10) for (let j = -50; j <= 50; j += 10) if (i * i + j * j < 2500) c.fillRect(x + i - 2, h / 2 + j - 2, 4, 4);
        }
      });
      add(k.plane(0.66, 0.22, k.print(speakers, { roughness: 0.5 }), { at: [0, 1.15, -0.4595] }));
      add(k.plane(0.33, 0.082, k.screen(o.on, o.on ? dotMatrix([["PLAYER 1   BALL 2", 22], ["2,450,330", 70]]) : undefined, 1.4), { at: [0, 1.15, -0.459] }));
      return k.group([g]);
    },
  },

  "claw-machine": {
    size: [0.8, 1.9, 0.92],
    light: { at: [0, 1.45, 0.3], color: "#ffe9f4", intensity: 1.5, distance: 3 },
    build(k, o) {
      const paint = k.paint(o.color ?? "#c2364f", 0.6);
      const chrome = k.metal("chrome", 0.12);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The cabinet, its art panel, the prize door and the control ledge.
      add(k.box(0.8, 0.92, 0.8, paint, { at: [0, 0.46, 0], r: 0.01 }));
      const art = canvasTexture(700, 400, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, "#ffcf3d");
        bg.addColorStop(1, "#ff8a3d");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = 0; i < 9; i += 1) {
          c.beginPath();
          c.moveTo(w / 2, h * 1.2);
          c.lineTo((i * w) / 8 - 40, -20);
          c.lineTo((i * w) / 8 + 10, -20);
          c.closePath();
          c.fill();
        }
        c.fillStyle = "#ffffff";
        c.strokeStyle = "#b8213f";
        c.lineWidth = 10;
        c.textAlign = "center";
        c.font = `900 92px ${HEAVY}`;
        c.strokeText("WIN A", w / 2, 160);
        c.fillText("WIN A", w / 2, 160);
        c.strokeText("PRIZE!", w / 2, 270);
        c.fillText("PRIZE!", w / 2, 270);
      });
      add(k.plane(0.6, 0.34, k.print(art, { roughness: 0.4 }), { at: [0.07, 0.36, 0.4005] }));
      add(k.box(0.2, 0.18, 0.008, k.plastic("#101114", 0.5), { at: [-0.27, 0.34, 0.402] }));
      add(k.box(0.18, 0.15, 0.01, k.plastic("#3a3d44", 0.6), { at: [-0.27, 0.345, 0.407], rot: [-0.08, 0, 0], r: 0.004 }));
      add(k.box(0.8, 0.07, 0.12, paint, { at: [0, 0.875, 0.46], r: 0.01 }));
      add(k.cyl(0.022, 0.022, 0.003, k.plastic("#0c0c0e", 0.5), { at: [-0.12, 0.9115, 0.46] }));
      add(k.cyl(0.005, 0.005, 0.07, k.metal("black", 0.3), { at: [-0.12, 0.945, 0.46] }));
      add(k.sphere(0.02, k.plastic("#d8322e", 0.85), { at: [-0.12, 0.985, 0.46] }));
      add(k.lathe([[0, 0.016], [0.022, 0.018], [0.024, 0.019], [0.025, 0.006], [0.031, 0.006], [0.032, 0.003], [0.032, 0], [0, 0]], o.on ? k.glow("#4cff7a", true, 1.4) : k.plastic("#3fbf5f", 0.8), { at: [0.12, 0.91, 0.46], seg: 28 }));
      add(k.box(0.06, 0.1, 0.01, chrome, { at: [0.3, 0.72, 0.405], r: 0.004 }));
      add(k.plane(0.036, 0.06, k.print(coinInsert(), { roughness: 0.4, glow: o.on ? 1.1 : 0 }), { at: [0.3, 0.72, 0.4105] }));
      // The glass box: chrome posts, three glass sides, a printed back and a floor.
      for (const x of [-0.38, 0.38]) for (const z of [-0.38, 0.38]) add(k.box(0.04, 0.7, 0.04, chrome, { at: [x, 1.27, z], r: 0.004 }));
      add(k.plane(0.72, 0.7, k.glass("#e6f0f4", 0.1), { at: [0, 1.27, 0.39] }));
      for (const sx of [-1, 1]) add(k.plane(0.72, 0.7, k.glass("#e6f0f4", 0.1), { at: [sx * 0.39, 1.27, 0], rot: [0, (sx * Math.PI) / 2, 0] }));
      const back = canvasTexture(512, 512, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#7ad3ff");
        bg.addColorStop(1, "#c79bff");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        const r = seeded(77);
        for (let i = 0; i < 40; i += 1) {
          c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.4})`;
          c.beginPath();
          c.arc(r() * w, r() * h, 6 + r() * 16, 0, Math.PI * 2);
          c.fill();
        }
      });
      add(k.plane(0.72, 0.7, k.print(back, { roughness: 0.5 }), { at: [0, 1.27, -0.379] }));
      add(k.box(0.76, 0.01, 0.76, k.paint("#2a2d33", 0.3), { at: [0, 0.925, 0] }));
      for (const x of [-0.355, 0.355]) add(k.box(0.012, 0.66, 0.012, k.glow("#ff7ad8", o.on, 2), { at: [x, 1.27, 0.355] }));
      add(k.box(0.22, 0.22, 0.22, k.glass("#dff3ff", 0.18), { at: [-0.26, 1.04, 0.26] }));
      // A heap of plush toys.
      const kinds: [string, string, "round" | "long" | "point" | "eyes" | "none"][] = [
        ["bear", "#a8754a", "round"], ["bunny", "#f4efe6", "long"], ["cat", "#f0a65a", "point"], ["panda", "#f4f4f1", "round"], ["frog", "#7cbf5a", "eyes"], ["chick", "#f6d44a", "none"], ["pig", "#f2b3c0", "point"],
      ];
      const faces = new Map<string, THREE.Material>();
      const spots: [number, number, number, number][] = [
        [-0.05, 0.99, -0.25, 0], [0.16, 0.99, -0.24, 1], [0.3, 0.99, -0.08, 2], [0.08, 0.99, -0.04, 3], [-0.2, 0.99, -0.06, 4], [0.27, 0.99, 0.18, 5], [0.07, 0.99, 0.2, 6], [-0.02, 1.09, -0.15, 2], [0.2, 1.09, 0.02, 0], [-0.07, 1.08, 0.07, 1],
      ];
      spots.forEach(([x, y, z, t], i) => {
        const [kind, fur, ears] = kinds[t];
        if (!faces.has(kind)) faces.set(kind, k.print(plushFace(kind, fur), { roughness: 0.95 }));
        const yaw = ((i * 0.37) % 0.8) - 0.3;
        const head = k.group([], { at: [x, y, z], rot: [-0.1 - (i % 3) * 0.08, yaw, ((i % 4) - 1.5) * 0.08] });
        head.add(k.sphere(0.066, faces.get(kind)!, { scale: [1, 0.93, 0.92], seg: 28 }));
        const earMat = k.fabric(kind === "panda" ? "#1c1c1e" : fur, { repeat: [1, 1] });
        for (const sx of [-1, 1]) {
          if (ears === "round") head.add(k.sphere(0.022, earMat, { at: [sx * 0.044, 0.05, -0.01], scale: [1, 1, 0.6] }));
          if (ears === "long") head.add(k.sphere(0.018, earMat, { at: [sx * 0.024, 0.088, -0.01], scale: [0.75, 2.3, 0.5], rot: [0, 0, -sx * 0.18] }));
          if (ears === "point") head.add(k.cone(0.02, 0.036, earMat, { at: [sx * 0.036, 0.066, -0.005], rot: [0, 0, -sx * 0.4] }));
          if (ears === "eyes") head.add(k.sphere(0.018, k.plastic("#f4f4f1", 0.6), { at: [sx * 0.026, 0.056, 0.02] }));
        }
        add(head);
      });
      // The gantry, the trolley, the cable and the three-pronged claw.
      for (const x of [-0.36, 0.36]) add(k.box(0.025, 0.025, 0.74, k.metal("steel", 0.3), { at: [x, 1.6, 0] }));
      add(k.box(0.74, 0.025, 0.04, k.metal("steel", 0.3), { at: [0, 1.585, 0.04] }));
      add(k.box(0.07, 0.04, 0.07, k.plastic("#25272c", 0.5), { at: [0.08, 1.56, 0.04], r: 0.006 }));
      add(k.cyl(0.0025, 0.0025, 0.2, k.metal("black", 0.4), { at: [0.08, 1.44, 0.04], seg: 8 }));
      add(k.cyl(0.026, 0.03, 0.05, chrome, { at: [0.08, 1.315, 0.04], seg: 24 }));
      for (let i = 0; i < 3; i += 1) {
        const a = (i * Math.PI * 2) / 3;
        const p = (r: number, y: number): V3 => [0.08 + Math.cos(a) * r, y, 0.04 + Math.sin(a) * r];
        add(k.tube([p(0.018, 1.29), p(0.042, 1.265), p(0.052, 1.225), p(0.044, 1.19), p(0.026, 1.172)], 0.004, chrome, { seg: 24 }));
      }
      // The lit header.
      add(k.box(0.8, 0.28, 0.8, paint, { at: [0, 1.76, 0], r: 0.01 }));
      add(k.plane(0.74, 0.02, k.glow("#ffffff", o.on, 1.2), { at: [0, 1.618, 0], rot: [Math.PI / 2, 0, 0] }));
      const marquee = canvasTexture(1024, 300, (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, w, 0);
        bg.addColorStop(0, "#ff4fa3");
        bg.addColorStop(1, "#7a5cff");
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        stars(c, w, h, 80, 13);
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `900 120px ${HEAVY}`;
        c.fillStyle = "rgba(60,10,60,0.5)";
        c.fillText("PRIZE CATCH", w / 2 + 6, h / 2 + 8);
        c.fillStyle = "#fff7c2";
        c.fillText("PRIZE CATCH", w / 2, h / 2);
      });
      add(k.plane(0.74, 0.22, k.print(marquee, { roughness: 0.35, glow: o.on ? 1.0 : 0 }), { at: [0, 1.76, 0.4005] }));
      g.position.z = -0.06;
      return k.group([g]);
    },
  },

  "ball-pit": {
    size: [1.39, 0.45, 1.39],
    build(k, o) {
      const vinyl = k.plastic(o.color ?? "#2f7fc6", 0.75);
      const white = k.plastic("#f3f1ea", 0.75);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // Three inflated rings, a valve, and the pool's floor.
      add(k.torus(0.62, 0.075, vinyl, { at: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], seg: 72 }));
      add(k.torus(0.62, 0.075, white, { at: [0, 0.225, 0], rot: [Math.PI / 2, 0, 0], seg: 72 }));
      add(k.torus(0.62, 0.075, vinyl, { at: [0, 0.375, 0], rot: [Math.PI / 2, 0, 0], seg: 72 }));
      add(k.cyl(0.012, 0.012, 0.03, white, { at: [0.43, 0.43, 0.43], rot: [0.5, 0, -0.5] }));
      add(k.cyl(0.016, 0.016, 0.008, white, { at: [0.44, 0.443, 0.44], rot: [0.5, 0, -0.5] }));
      add(k.cyl(0.6, 0.6, 0.01, vinyl, { at: [0, 0.005, 0], seg: 48 }));
      // Balls: a packed layer seen from above, with real ones heaped on it, and a few that got away.
      const palette = ["#d8343a", "#f2c230", "#2f6fc0", "#3a9a4a", "#ef7d2a", "#e46aa0"];
      const bed = canvasTexture(1024, 1024, (c, w, h) => {
        c.fillStyle = "#1d1a22";
        c.fillRect(0, 0, w, h);
        const r = seeded(91);
        const R = 30;
        let row = 0;
        for (let y = R * 0.5; y < h + R; y += R * 1.72) {
          for (let x = (row % 2 ? R : 0) - R; x < w + R; x += R * 2) paintBall(c, x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, R, R, palette[Math.floor(r() * palette.length)]);
          row += 1;
        }
      });
      add(k.disc(0.555, k.print(bed, { roughness: 0.3 }), { at: [0, 0.31, 0], rot: [-Math.PI / 2, 0, 0], seg: 64 }));
      const mats = palette.map((c) => k.plastic(c, 0.8));
      const r = seeded(19);
      const step = 0.122;
      let n = 0;
      for (let zi = -5; zi <= 5; zi += 1)
        for (let xi = -5; xi <= 5; xi += 1) {
          const x = xi * step + (zi % 2 ? step / 2 : 0) + (r() - 0.5) * 0.03;
          const z = zi * step * 0.87 + (r() - 0.5) * 0.03;
          if (Math.hypot(x, z) > 0.49) continue;
          add(k.sphere(0.035, mats[n % mats.length], { at: [x, 0.33 + r() * 0.025, z], seg: 18 }));
          n += 1;
        }
      for (const [x, z, i] of [[0.6, 0.55, 0], [0.53, 0.63, 2], [0.64, 0.47, 3]]) add(k.sphere(0.035, mats[i], { at: [x, 0.035, z], seg: 18 }));
      return k.group([g]);
    },
  },

  "ice-cream-cart": {
    size: [1.44, 2.15, 1.44],
    build(k, o) {
      const paint = k.paint(o.color ?? "#f3ece0", 0.55);
      const chrome = k.metal("chrome", 0.12);
      const steel = k.metal("steel", 0.3);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The cart: a painted freezer box with chrome trim, a stainless top and a sign on its side.
      add(k.box(1.0, 0.55, 0.56, paint, { at: [0, 0.62, 0], r: 0.02 }));
      for (const y of [0.35, 0.89]) add(k.box(1.02, 0.02, 0.58, chrome, { at: [0, y, 0], r: 0.006 }));
      add(k.box(1.0, 0.03, 0.56, steel, { at: [0, 0.91, 0], r: 0.006 }));
      const sign = canvasTexture(1024, 460, (c, w, h) => {
        c.fillStyle = "#fbf6ec";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 20; i += 1) {
          c.fillStyle = i % 2 ? "#f6c6d2" : "#fbf6ec";
          c.fillRect((i * w) / 20, 0, w / 20 + 1, 46);
        }
        c.fillStyle = "#2f6f8f";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `italic 900 150px Georgia, 'Times New Roman', serif`;
        c.fillText("Gelato", w / 2, 210);
        c.font = `700 40px ${SANS}`;
        c.fillStyle = "#c2364f";
        c.fillText("HOMEMADE  ·  SIX FLAVORS", w / 2, 340);
        for (const [x, col] of [[110, "#f2a7b8"], [w - 110, "#b9d48a"]] as const) {
          c.fillStyle = "#d9a35f";
          c.beginPath();
          c.moveTo(x - 46, 210);
          c.lineTo(x + 46, 210);
          c.lineTo(x, 380);
          c.closePath();
          c.fill();
          c.fillStyle = col;
          c.beginPath();
          c.arc(x, 196, 52, 0, Math.PI * 2);
          c.fill();
        }
      });
      add(k.plane(0.9, 0.44, k.print(sign, { roughness: 0.5 }), { at: [0, 0.62, 0.2805] }));
      // Six tubs: four open and heaped with gelato, two under their lids.
      const flavors = ["#f2a7b8", "#b9d48a", "#6b4330", "#f5e9c8"];
      let f = 0;
      for (const x of [-0.3, 0, 0.3])
        for (const z of [-0.12, 0.12]) {
          if ((x === 0 && z < 0) || (x === 0.3 && z > 0)) {
            add(k.lathe([[0, 0.032], [0.035, 0.03], [0.07, 0.016], [0.086, 0.006], [0.088, 0], [0, 0]], steel, { at: [x, 0.925, z], seg: 36 }));
            add(k.cyl(0.01, 0.012, 0.016, chrome, { at: [x, 0.963, z], seg: 16 }));
            continue;
          }
          const ice = k.paint(flavors[f % flavors.length], 0.25);
          f += 1;
          add(k.torus(0.08, 0.008, steel, { at: [x, 0.926, z], rot: [Math.PI / 2, 0, 0], seg: 36 }));
          add(k.sphere(0.076, ice, { at: [x, 0.926, z], scale: [1, 0.34, 1], seg: 24 }));
          add(k.sphere(0.034, ice, { at: [x + 0.018, 0.958, z - 0.01], scale: [1, 0.8, 1], seg: 16 }));
        }
      // The umbrella: a striped canopy with its valance, on a chrome pole clamped to the back.
      const pz = -0.2;
      add(k.cyl(0.015, 0.015, 1.15, chrome, { at: [0, 1.5, pz], seg: 16 }));
      add(k.cyl(0.03, 0.03, 0.05, chrome, { at: [0, 0.95, pz], seg: 20 }));
      const stripes = canvasTexture(1024, 64, (c, w, h) => {
        for (let i = 0; i < 16; i += 1) {
          c.fillStyle = i % 2 ? "#f6f1e7" : "#d8475d";
          c.fillRect((i * w) / 16, 0, w / 16 + 1, h);
        }
      });
      add(k.lathe([[0.0, 2.11], [0.12, 2.09], [0.3, 2.04], [0.5, 1.97], [0.66, 1.91], [0.72, 1.885]].map(([r, y]) => [r, y] as [number, number]).reverse(), k.print(stripes, { roughness: 0.85 }), { at: [0, 0, pz], seg: 64 }));
      const valance = canvasTexture(1024, 96, (c, w, h) => {
        for (let i = 0; i < 16; i += 1) {
          c.fillStyle = i % 2 ? "#f6f1e7" : "#d8475d";
          c.fillRect((i * w) / 16, 0, w / 16 + 1, h);
        }
        c.fillStyle = "#2f6f8f";
        c.font = `800 44px ${SANS}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        for (const x of [0.125, 0.375, 0.625, 0.875]) c.fillText("ICE CREAM", w * x, h / 2 + 2);
      });
      add(k.cyl(0.722, 0.722, 0.085, k.print(valance, { roughness: 0.85 }), { at: [0, 1.845, pz], open: true, seg: 64 }));
      add(k.sphere(0.022, chrome, { at: [0, 2.13, pz] }));
      // Two big spoked wheels on one axle, two legs and a push handle at the other end.
      for (const z of [-0.33, 0.33]) {
        const c: V3 = [-0.3, 0.28, z];
        add(k.torus(0.265, 0.016, k.rubber("#26272a"), { at: c, seg: 64 }));
        add(k.torus(0.248, 0.007, chrome, { at: c, seg: 64 }));
        add(k.cyl(0.03, 0.03, 0.05, chrome, { at: c, rot: [Math.PI / 2, 0, 0], seg: 20 }));
        const spokes: V3[] = [];
        for (let i = 0; i < 12; i += 1) {
          const a = (i * Math.PI) / 6;
          const r = i % 2 ? 0.026 : 0.244;
          spokes.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z + (i % 4 < 2 ? 0.008 : -0.008)]);
        }
        spokes.push(spokes[0]);
        add(rail(k, spokes, 0.0035, k.paint("#c2364f", 0.5), 0.02));
      }
      add(k.cyl(0.012, 0.012, 0.66, chrome, { at: [-0.3, 0.28, 0], rot: [Math.PI / 2, 0, 0], seg: 12 }));
      for (const z of [-0.22, 0.22]) {
        add(k.cyl(0.013, 0.013, 0.35, chrome, { at: [0.42, 0.175, z], seg: 12 }));
        add(k.cyl(0.02, 0.02, 0.012, k.rubber("#26272a"), { at: [0.42, 0.006, z], seg: 16 }));
      }
      add(rail(k, [[0.5, 0.72, -0.2], [0.66, 0.79, -0.2], [0.69, 0.8, -0.15], [0.69, 0.8, 0.15], [0.66, 0.79, 0.2], [0.5, 0.72, 0.2]], 0.012, chrome, 0.02));
      add(k.cyl(0.018, 0.018, 0.26, k.rubber("#26272a"), { at: [0.69, 0.8, 0], rot: [Math.PI / 2, 0, 0], seg: 16 }));
      // A holder of waffle cones at the end.
      const waffle = canvasTexture(256, 256, (c, w, h) => {
        c.fillStyle = "#d9a35f";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#b07a3c";
        c.lineWidth = 4;
        for (let i = -h; i < w + h; i += 28) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i + h, h);
          c.stroke();
          c.beginPath();
          c.moveTo(i + h, 0);
          c.lineTo(i, h);
          c.stroke();
        }
      });
      add(k.cyl(0.04, 0.035, 0.12, chrome, { at: [-0.545, 0.8, 0.15], open: true, seg: 24 }));
      for (const dy of [0.0, 0.03]) add(k.cone(0.034, 0.14, k.print(waffle, { roughness: 0.8 }), { at: [-0.545, 0.84 + dy, 0.15], rot: [Math.PI, 0, 0], seg: 24 }));
      g.position.z = -pz;
      return k.group([g]);
    },
  },

  "sim-rig": {
    size: [0.75, 1.24, 1.5],
    build(k, o) {
      const alu = k.metal("black", 0.5);
      const shellMat = k.plastic("#16171a", 0.6);
      const bolster = k.leather("#232428");
      const insert = k.fabric(o.color ?? "#9e2a2b");
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // An aluminium-profile frame: two rails, cross members, uprights for the wheel deck.
      for (const x of [-0.25, 0.25]) add(k.box(0.04, 0.08, 1.4, alu, { at: [x, 0.04, -0.08], r: 0.003 }));
      for (const z of [-0.74, -0.3, 0.15, 0.55]) add(k.box(0.46, 0.04, 0.04, alu, { at: [0, 0.06, z], r: 0.003 }));
      for (const x of [-0.25, 0.25]) add(k.box(0.04, 0.52, 0.08, alu, { at: [x, 0.34, -0.3], r: 0.003 }));
      add(k.box(0.54, 0.012, 0.2, alu, { at: [0, 0.606, -0.3], r: 0.003 }));
      // The wheel base, quick release and a round wheel with its rev lights, tipped toward the driver.
      add(k.box(0.13, 0.12, 0.2, k.metal("#3a3d42", 0.35), { at: [0, 0.672, -0.31], r: 0.012 }));
      const wheel = new THREE.Group();
      wheel.position.set(0, 0.73, -0.15);
      wheel.rotation.x = -0.28;
      wheel.add(k.cyl(0.026, 0.026, 0.07, k.metal("silver", 0.3), { at: [0, 0, -0.04], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      wheel.add(k.torus(0.15, 0.014, k.leather("#1b1c1f"), { seg: 64 }));
      wheel.add(k.box(0.29, 0.045, 0.014, k.metal("#2b2d31", 0.4), { r: 0.006 }));
      wheel.add(k.box(0.045, 0.14, 0.014, k.metal("#2b2d31", 0.4), { at: [0, -0.075, 0], r: 0.006 }));
      const leds = canvasTexture(256, 32, (c, w, h) => {
        c.fillStyle = "#050505";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 10; i += 1) {
          c.fillStyle = i < 4 ? "#3bff6a" : i < 7 ? "#ffd84d" : i < 9 ? "#ff3b3b" : "#3b8bff";
          c.beginPath();
          c.arc(16 + i * 25, h / 2, 8, 0, Math.PI * 2);
          c.fill();
        }
      });
      wheel.add(k.plane(0.11, 0.014, k.screen(o.on, leds, 1.5), { at: [0, 0.035, 0.0075] }));
      for (const sx of [-1, 1]) wheel.add(k.box(0.06, 0.09, 0.006, k.metal("silver", 0.3), { at: [sx * 0.08, 0, -0.03], r: 0.003 }));
      g.add(wheel);
      // Pedals on an angled plate.
      add(k.box(0.46, 0.04, 0.04, alu, { at: [0, 0.1, -0.52], r: 0.003 }));
      const pedals = new THREE.Group();
      pedals.position.set(0, 0.16, -0.6);
      pedals.rotation.x = 0.6;
      pedals.add(k.box(0.4, 0.012, 0.3, alu, { r: 0.003 }));
      for (const [x, h] of [[-0.11, 0.1], [0, 0.1], [0.11, 0.12]] as const) {
        pedals.add(k.box(0.016, 0.016, 0.12, k.metal("silver", 0.3), { at: [x, 0.05, -0.02], rot: [-0.9, 0, 0] }));
        pedals.add(k.box(0.06, h, 0.012, k.metal("silver", 0.25), { at: [x, 0.09, 0.03], rot: [-0.6, 0, 0], r: 0.004 }));
      }
      g.add(pedals);
      // The bucket seat on its brackets: pan and back in fabric, leather bolsters, a black shell, harness slots.
      for (const x of [-0.22, 0.22]) add(k.box(0.012, 0.2, 0.36, alu, { at: [x, 0.18, 0.33] }));
      const pan = strut([0, 0.3, 0.12], [0, 0.34, 0.54]);
      add(k.cushion(0.42, 0.085, pan.len, insert, { at: [0, 0.31, 0.33], rot: [Math.PI / 2 - pan.rot[0], 0, 0] }));
      const backA: V3 = [0, 0.34, 0.53];
      const backB: V3 = [0, 1.0, 0.76];
      const back = strut(backA, backB);
      add(k.cushion(0.42, back.len, 0.09, insert, { at: back.at, rot: back.rot }));
      add(k.box(0.52, back.len + 0.08, 0.05, shellMat, { at: [0, back.at[1] + 0.01, back.at[2] + 0.06], rot: back.rot, r: 0.02 }));
      for (const sx of [-1, 1]) {
        add(k.cushion(0.08, 0.13, 0.44, bolster, { at: [sx * 0.23, 0.36, 0.33], rot: [-0.1, 0, 0] }));
        add(k.cushion(0.09, back.len - 0.12, 0.13, bolster, { at: [sx * 0.235, back.at[1] - 0.02, back.at[2] - 0.01], rot: back.rot }));
        add(k.box(0.05, 0.026, 0.02, k.plastic("#050506", 0.3), { at: [sx * 0.075, 0.9, 0.712], rot: back.rot, r: 0.008 }));
      }
      // A sequential shifter on the right.
      add(k.box(0.03, 0.42, 0.03, alu, { at: [0.3, 0.27, 0.05], r: 0.003 }));
      add(k.box(0.07, 0.05, 0.09, k.metal("#3a3d42", 0.35), { at: [0.3, 0.505, 0.05], r: 0.008 }));
      add(k.cyl(0.006, 0.006, 0.12, k.metal("silver", 0.25), { at: [0.3, 0.59, 0.05], rot: [-0.15, 0, 0], seg: 12 }));
      add(k.sphere(0.022, k.plastic("#1b1c1f", 0.6), { at: [0.3, 0.655, 0.06] }));
      // A monitor on its own upright, the track on screen when it is on.
      add(k.box(0.04, 0.84, 0.04, alu, { at: [0, 0.5, -0.74], r: 0.003 }));
      add(k.box(0.75, 0.44, 0.035, k.plastic("#121316", 0.5), { at: [0, 1.0, -0.7], r: 0.006 }));
      const track = o.on
        ? canvasTexture(1024, 576, (c, w, h) => {
            const sky = c.createLinearGradient(0, 0, 0, h * 0.5);
            sky.addColorStop(0, "#5f9fe0");
            sky.addColorStop(1, "#cfe4f5");
            c.fillStyle = sky;
            c.fillRect(0, 0, w, h);
            c.fillStyle = "#7f9f78";
            c.beginPath();
            c.moveTo(0, h * 0.5);
            for (let x = 0; x <= w; x += 32) c.lineTo(x, h * 0.46 - Math.sin(x * 0.012) * 18 - Math.sin(x * 0.031) * 8);
            c.lineTo(w, h * 0.5);
            c.fill();
            c.fillStyle = "#4f8a3c";
            c.fillRect(0, h * 0.5, w, h * 0.5);
            const vx = w * 0.58;
            const vy = h * 0.5;
            c.fillStyle = "#d9cfae";
            c.beginPath();
            c.moveTo(0, h);
            c.lineTo(vx - 30, vy);
            c.lineTo(vx - 10, vy);
            c.lineTo(w * 0.2, h);
            c.fill();
            c.fillStyle = "#55575c";
            c.beginPath();
            c.moveTo(w * 0.04, h);
            c.lineTo(vx - 8, vy);
            c.lineTo(vx + 22, vy);
            c.lineTo(w * 1.02, h);
            c.fill();
            for (let i = 0; i < 14; i += 1) {
              const t0 = i / 14;
              const t1 = (i + 1) / 14;
              const ex = (t: number) => vx + 22 + (w * 1.02 - vx - 22) * t * t;
              const ey = (t: number) => vy + (h - vy) * t * t;
              c.fillStyle = i % 2 ? "#f4f4f2" : "#d6262c";
              c.beginPath();
              c.moveTo(ex(t0), ey(t0));
              c.lineTo(ex(t1), ey(t1));
              c.lineTo(ex(t1) + 70 * t1, ey(t1));
              c.lineTo(ex(t0) + 70 * t0, ey(t0));
              c.fill();
            }
            c.strokeStyle = "rgba(255,255,255,0.85)";
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(w * 0.07, h);
            c.lineTo(vx - 6, vy);
            c.stroke();
            // A car ahead, braking for the turn.
            const cx = w * 0.6;
            const cy = h * 0.6;
            c.fillStyle = "#1e2a4a";
            c.fillRect(cx - 46, cy - 18, 92, 26);
            c.fillStyle = "#101114";
            c.fillRect(cx - 54, cy - 30, 108, 8);
            c.fillRect(cx - 50, cy + 2, 18, 16);
            c.fillRect(cx + 32, cy + 2, 18, 16);
            c.fillStyle = "#ff2b2b";
            c.fillRect(cx - 6, cy - 4, 12, 6);
            // The car's nose and the HUD.
            c.fillStyle = "#121318";
            c.beginPath();
            c.moveTo(w * 0.28, h);
            c.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.72, h);
            c.fill();
            c.fillStyle = "rgba(0,0,0,0.55)";
            c.fillRect(24, 22, 230, 92);
            c.fillRect(w - 260, h - 140, 236, 116);
            c.fillStyle = "#ffffff";
            c.font = `800 34px ${SANS}`;
            c.fillText("LAP 3/12", 40, 62);
            c.fillText("P2", 40, 102);
            c.font = `700 30px ${MONO}`;
            c.fillText("1:24.381", 120, 102);
            c.font = `900 64px ${SANS}`;
            c.fillText("212", w - 244, h - 64);
            c.font = `700 24px ${SANS}`;
            c.fillText("KM/H", w - 120, h - 64);
            c.font = `900 48px ${SANS}`;
            c.fillStyle = "#ffd84d";
            c.fillText("5", w - 72, h - 100);
            for (let i = 0; i < 12; i += 1) {
              c.fillStyle = i < 6 ? "#3bff6a" : i < 9 ? "#ffd84d" : "#ff3b3b";
              c.fillRect(w - 244 + i * 18, h - 44, 14, 10);
            }
          })
        : undefined;
      add(k.plane(0.72, 0.405, k.screen(o.on, track, 1.2), { at: [0, 1.0, -0.6823] }));
      add(k.tube([[0, 0.62, -0.38], [0.04, 0.5, -0.42], [0.06, 0.1, -0.42], [0.08, 0.02, -0.45]], 0.004, k.rubber("#1b1c1f"), { seg: 24 }));
      g.position.z = 0.0;
      return k.group([g]);
    },
  },

  "robot-dog": {
    size: [0.4, 0.42, 0.66],
    build(k, o) {
      const shell = k.plastic(o.color ?? "#e6e7e9", 0.55);
      const dark = k.plastic("#24262a", 0.5);
      const g = new THREE.Group();
      const add = (...m: THREE.Object3D[]) => m.forEach((x) => g.add(x));
      // The body: a white shell over a dark core, a sensor head at the front, status lights down the sides.
      add(k.box(0.24, 0.1, 0.5, dark, { at: [0, 0.34, 0], r: 0.03 }));
      add(k.box(0.27, 0.07, 0.46, shell, { at: [0, 0.37, 0], r: 0.03 }));
      add(k.box(0.12, 0.012, 0.22, dark, { at: [0, 0.408, -0.06], r: 0.004 }));
      add(k.box(0.2, 0.11, 0.1, shell, { at: [0, 0.345, 0.27], r: 0.035 }));
      add(k.box(0.17, 0.06, 0.012, k.plastic("#0b0c0e", 0.9), { at: [0, 0.35, 0.318], r: 0.01 }));
      for (const sx of [-1, 1]) add(k.cyl(0.011, 0.011, 0.006, k.glow("#7fe8ff", o.on, 2.4), { at: [sx * 0.04, 0.355, 0.3245], rot: [Math.PI / 2, 0, 0], seg: 20 }));
      add(k.cyl(0.028, 0.032, 0.04, dark, { at: [0, 0.28, 0.27], seg: 24 }));
      for (const sx of [-1, 1]) add(k.box(0.004, 0.012, 0.2, k.glow("#7fe8ff", o.on, 2), { at: [sx * 0.136, 0.37, 0.05] }));
      // Four legs, knees bent back: hip motor, thigh, knee, shin and a rubber foot.
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const hip: V3 = [sx * 0.16, 0.34, sz * 0.19];
          const knee: V3 = [sx * 0.165, 0.175, sz * 0.19 - 0.1];
          const foot: V3 = [sx * 0.165, 0.024, sz * 0.19 - 0.005];
          add(k.cyl(0.045, 0.045, 0.06, dark, { at: hip, rot: [0, 0, Math.PI / 2], seg: 28 }));
          const th = strut(hip, knee);
          add(k.box(0.05, th.len + 0.03, 0.065, shell, { at: th.at, rot: th.rot, r: 0.022 }));
          add(k.cyl(0.03, 0.03, 0.05, dark, { at: knee, rot: [0, 0, Math.PI / 2], seg: 24 }));
          const sh = strut(knee, foot);
          add(k.box(0.03, sh.len, 0.034, dark, { at: sh.at, rot: sh.rot, r: 0.012 }));
          add(k.sphere(0.024, k.rubber("#1b1c1f"), { at: foot }));
        }
      return k.group([g]);
    },
  },
};
