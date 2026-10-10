/**
 * The kit every piece of furniture is built from: real materials and simple
 * solid shapes, in metres.
 *
 * Materials are physically based (three.js MeshStandardMaterial): a colour,
 * how rough the surface is, whether it is metal. Their surface detail (wood
 * grain, fabric weave, brick, marble veins) is painted into small textures
 * here in code, with a fixed seed, so nothing is downloaded and every load
 * looks the same. Materials and textures are cached, so a hundred pieces in
 * oak share one material, and `dispose()` frees them all.
 *
 * Builders call these and nothing else from three.js, which keeps every
 * piece in one look: the same oak, the same steel, the same light.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];

export interface Place {
  /** Centre of the shape. */
  at?: V3;
  /** Turn, in radians, about x, y and z. */
  rot?: V3;
  /** Stretch along x, y and z. */
  scale?: V3;
}

export type WoodTone = "oak" | "walnut" | "pine" | "cherry" | "white" | "ebony" | "maple";
export type MetalKind = "steel" | "chrome" | "brass" | "gold" | "black" | "copper" | "silver";
export type StoneKind = "marble" | "granite" | "concrete" | "sandstone" | "slate" | "terracotta";

const WOOD_TONES: Record<WoodTone, string> = {
  oak: "#c39462",
  walnut: "#6b4630",
  pine: "#d9b07a",
  cherry: "#9a5434",
  white: "#e9e3d8",
  ebony: "#2f2620",
  maple: "#e2c194",
};

const METALS: Record<MetalKind, { color: string; roughness: number; metalness: number }> = {
  steel: { color: "#b9bec4", roughness: 0.34, metalness: 1 },
  chrome: { color: "#e6e9ee", roughness: 0.07, metalness: 1 },
  silver: { color: "#d4d7db", roughness: 0.2, metalness: 1 },
  brass: { color: "#c49a46", roughness: 0.3, metalness: 1 },
  gold: { color: "#e2b64a", roughness: 0.2, metalness: 1 },
  copper: { color: "#c27a4b", roughness: 0.3, metalness: 1 },
  black: { color: "#2b2b2e", roughness: 0.42, metalness: 0.6 },
};

// ---------------------------------------------------------------------------
// Painted textures
// ---------------------------------------------------------------------------

/** A fixed random source, so a texture is the same on every load. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  // Painted on the CPU. A GPU canvas queues every stroke for the graphics
  // card, and handing the picture to WebGL then waited for all of them: the
  // porch's lawn, sky and shingles froze the first visit for seconds.
  c.getContext("2d", { willReadFrequently: true });
  return c;
}

function texture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fine speckle over a whole canvas, for plaster, concrete and the like. */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n: number, dark: number, light: number) {
  for (let i = 0; i < n; i += 1) {
    const v = rnd() < 0.5 ? dark : light;
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + rnd() * 0.08})`;
    const s = 1 + rnd() * 2.5;
    g.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

/** Long grain along the width: near white, so the material's colour shows through. */
function paintGrain(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, lines: number) {
  g.fillStyle = "#f2f2f2";
  g.fillRect(0, 0, w, h);
  // Broad bands of a slightly different tone, the way a board varies.
  for (let i = 0; i < 6; i += 1) {
    const y = rnd() * h;
    const band = g.createLinearGradient(0, y - 40, 0, y + 40);
    band.addColorStop(0, "rgba(120,100,80,0)");
    band.addColorStop(0.5, `rgba(120,100,80,${0.05 + rnd() * 0.07})`);
    band.addColorStop(1, "rgba(120,100,80,0)");
    g.fillStyle = band;
    g.fillRect(0, y - 40, w, 80);
  }
  for (let i = 0; i < lines; i += 1) {
    const y0 = rnd() * h;
    const amp = 2 + rnd() * 9;
    const freq = (0.4 + rnd() * 1.6) * ((Math.PI * 2) / w);
    const phase = rnd() * 6;
    const dark = Math.round(90 + rnd() * 60);
    g.strokeStyle = `rgba(${dark},${dark - 18},${dark - 36},${0.12 + rnd() * 0.3})`;
    g.lineWidth = 0.5 + rnd() * 1.8;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase * 2) * amp * 0.2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // Pores.
  for (let i = 0; i < 900; i += 1) {
    const d = Math.round(110 + rnd() * 60);
    g.fillStyle = `rgba(${d},${d - 20},${d - 40},${0.12 + rnd() * 0.2})`;
    g.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 6, 0.8);
  }
}

const textureCache = new Map<string, THREE.Texture>();

function cachedTexture(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = textureCache.get(key);
  if (!t) {
    t = make();
    textureCache.set(key, t);
  }
  return t;
}

export const TEX = {
  grain(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`grain:${repeat}`, () => {
      const c = makeCanvas(512, 512);
      paintGrain(c.getContext("2d")!, 512, 512, seeded(7), 150);
      return texture(c, repeat);
    });
  },
  /** Floorboards: rows of planks, each its own tone, with seams and staggered ends. */
  planks(tone: string, repeat: [number, number] = [1, 1]) {
    return cachedTexture(`planks:${tone}:${repeat}`, () => {
      const W = 1024;
      const H = 1024;
      const c = makeCanvas(W, H);
      const g = c.getContext("2d")!;
      const rnd = seeded(11);
      const rows = 8;
      const rowH = H / rows;
      const grain = makeCanvas(512, 128);
      paintGrain(grain.getContext("2d")!, 512, 128, seeded(3), 40);
      for (let r = 0; r < rows; r += 1) {
        let x = -rnd() * 400;
        while (x < W) {
          const len = 380 + rnd() * 420;
          const shade = 0.82 + rnd() * 0.22;
          const base = new THREE.Color(tone).multiplyScalar(shade);
          g.fillStyle = `#${base.getHexString()}`;
          g.fillRect(x, r * rowH, len, rowH);
          g.globalAlpha = 0.55;
          g.globalCompositeOperation = "multiply";
          g.drawImage(grain, rnd() * 100, rnd() * 60, 300, 60, x, r * rowH, len, rowH);
          g.globalCompositeOperation = "source-over";
          g.globalAlpha = 1;
          // End joint.
          g.fillStyle = "rgba(40,25,15,0.55)";
          g.fillRect(x, r * rowH, 2, rowH);
          x += len;
        }
        // Seam between rows, with a soft shadow under it.
        g.fillStyle = "rgba(35,22,12,0.6)";
        g.fillRect(0, r * rowH, W, 2);
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(0, r * rowH + 2, W, 2);
      }
      return texture(c, repeat);
    });
  },
  weave(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`weave:${repeat}`, () => {
      const c = makeCanvas(256, 256);
      const g = c.getContext("2d")!;
      const rnd = seeded(5);
      g.fillStyle = "#efefef";
      g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 3) {
        g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
        g.fillRect(0, y, 256, 1);
      }
      for (let x = 0; x < 256; x += 3) {
        g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
        g.fillRect(x, 0, 1, 256);
      }
      speckle(g, 256, 256, rnd, 1500, 60, 255);
      return texture(c, repeat);
    });
  },
  plaster(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`plaster:${repeat}`, () => {
      const c = makeCanvas(256, 256);
      const g = c.getContext("2d")!;
      g.fillStyle = "#f4f4f4";
      g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, seeded(9), 2600, 150, 255);
      return texture(c, repeat);
    });
  },
  carpet(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`carpet:${repeat}`, () => {
      const c = makeCanvas(256, 256);
      const g = c.getContext("2d")!;
      g.fillStyle = "#ededed";
      g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, seeded(21), 9000, 120, 255);
      return texture(c, repeat);
    });
  },
  /** Brick in its own colours, mortar and all. */
  brick(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`brick:${repeat}`, () => {
      const W = 512;
      const H = 512;
      const c = makeCanvas(W, H);
      const g = c.getContext("2d")!;
      const rnd = seeded(17);
      g.fillStyle = "#cfc6bb";
      g.fillRect(0, 0, W, H);
      const bh = 32;
      const bw = 96;
      for (let r = 0; r < H / bh; r += 1) {
        const off = r % 2 ? bw / 2 : 0;
        for (let x = -off; x < W; x += bw) {
          const t = 0.75 + rnd() * 0.35;
          const col = new THREE.Color("#9c4f37").multiplyScalar(t);
          g.fillStyle = `#${col.getHexString()}`;
          g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
          for (let i = 0; i < 30; i += 1) {
            g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
            g.fillRect(x + 3 + rnd() * (bw - 8), r * bh + 3 + rnd() * (bh - 8), 2 + rnd() * 3, 2);
          }
        }
      }
      return texture(c, repeat);
    });
  },
  /** Cut stone blocks, grey. */
  stoneBlocks(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`stoneblocks:${repeat}`, () => {
      const W = 512;
      const c = makeCanvas(W, W);
      const g = c.getContext("2d")!;
      const rnd = seeded(23);
      g.fillStyle = "#8d8a86";
      g.fillRect(0, 0, W, W);
      const bh = 64;
      for (let r = 0; r < W / bh; r += 1) {
        let x = -rnd() * 60;
        while (x < W) {
          const bw = 90 + rnd() * 80;
          const t = 0.8 + rnd() * 0.3;
          const col = new THREE.Color("#b3aea6").multiplyScalar(t);
          g.fillStyle = `#${col.getHexString()}`;
          g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
          for (let i = 0; i < 80; i += 1) {
            const v = rnd() < 0.5 ? 60 : 230;
            g.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.1})`;
            g.fillRect(x + 3 + rnd() * (bw - 8), r * bh + 3 + rnd() * (bh - 8), 2 + rnd() * 4, 2 + rnd() * 3);
          }
          x += bw;
        }
      }
      return texture(c, repeat);
    });
  },
  /** Round logs stacked, for the treehouse. */
  logs(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`logs:${repeat}`, () => {
      const W = 512;
      const c = makeCanvas(W, W);
      const g = c.getContext("2d")!;
      const rnd = seeded(29);
      const lh = 64;
      for (let r = 0; r < W / lh; r += 1) {
        const tone = new THREE.Color("#8a5a36").multiplyScalar(0.85 + rnd() * 0.25);
        const grad = g.createLinearGradient(0, r * lh, 0, (r + 1) * lh);
        const dark = tone.clone().multiplyScalar(0.55);
        grad.addColorStop(0, `#${dark.getHexString()}`);
        grad.addColorStop(0.35, `#${tone.getHexString()}`);
        grad.addColorStop(0.7, `#${tone.clone().multiplyScalar(0.92).getHexString()}`);
        grad.addColorStop(1, `#${dark.clone().multiplyScalar(0.7).getHexString()}`);
        g.fillStyle = grad;
        g.fillRect(0, r * lh, W, lh);
        for (let i = 0; i < 14; i += 1) {
          g.strokeStyle = `rgba(50,30,15,${0.1 + rnd() * 0.2})`;
          g.lineWidth = 1;
          const y = r * lh + 8 + rnd() * (lh - 16);
          g.beginPath();
          g.moveTo(0, y);
          for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2);
          g.stroke();
        }
      }
      return texture(c, repeat);
    });
  },
  /** Bamboo stalks side by side, with their joints. */
  bamboo(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`bamboo:${repeat}`, () => {
      const W = 512;
      const c = makeCanvas(W, W);
      const g = c.getContext("2d")!;
      const rnd = seeded(31);
      const sw = 32;
      for (let i = 0; i < W / sw; i += 1) {
        const tone = new THREE.Color("#cdb27a").multiplyScalar(0.88 + rnd() * 0.2);
        const grad = g.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
        grad.addColorStop(0, `#${tone.clone().multiplyScalar(0.7).getHexString()}`);
        grad.addColorStop(0.4, `#${tone.getHexString()}`);
        grad.addColorStop(1, `#${tone.clone().multiplyScalar(0.75).getHexString()}`);
        g.fillStyle = grad;
        g.fillRect(i * sw, 0, sw, W);
        let y = rnd() * 120;
        while (y < W) {
          g.fillStyle = "rgba(90,70,30,0.5)";
          g.fillRect(i * sw, y, sw, 3);
          y += 110 + rnd() * 60;
        }
      }
      return texture(c, repeat);
    });
  },
  marble(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`marble:${repeat}`, () => {
      const W = 512;
      const c = makeCanvas(W, W);
      const g = c.getContext("2d")!;
      const rnd = seeded(41);
      g.fillStyle = "#f3f1ed";
      g.fillRect(0, 0, W, W);
      g.filter = "blur(1.2px)";
      for (let i = 0; i < 26; i += 1) {
        g.strokeStyle = `rgba(110,110,120,${0.08 + rnd() * 0.25})`;
        g.lineWidth = 0.6 + rnd() * 2.6;
        g.beginPath();
        let x = rnd() * W;
        let y = 0;
        g.moveTo(x, y);
        while (y < W) {
          x += (rnd() - 0.45) * 40;
          y += 10 + rnd() * 30;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.filter = "none";
      return texture(c, repeat);
    });
  },
  concrete(repeat: [number, number] = [1, 1]) {
    return cachedTexture(`concrete:${repeat}`, () => {
      const c = makeCanvas(256, 256);
      const g = c.getContext("2d")!;
      g.fillStyle = "#e9e9e9";
      g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, seeded(43), 5000, 90, 255);
      return texture(c, repeat);
    });
  },
  /** Square tiles with grout. */
  tiles(color: string, repeat: [number, number] = [1, 1]) {
    return cachedTexture(`tiles:${color}:${repeat}`, () => {
      const W = 512;
      const c = makeCanvas(W, W);
      const g = c.getContext("2d")!;
      const rnd = seeded(47);
      g.fillStyle = "#cfcac2";
      g.fillRect(0, 0, W, W);
      const s = 128;
      for (let y = 0; y < W; y += s)
        for (let x = 0; x < W; x += s) {
          const col = new THREE.Color(color).multiplyScalar(0.9 + rnd() * 0.12);
          g.fillStyle = `#${col.getHexString()}`;
          g.fillRect(x + 3, y + 3, s - 6, s - 6);
        }
      return texture(c, repeat);
    });
  },
};

/**
 * Relief for a painted surface, worked out by the card from the painting's
 * own light and dark (grain is grooved, mortar is sunk, a shingle's edge is a
 * step): the material's bump map is its colour map, at this strength. Costs
 * the page nothing on a first visit, unlike a normal map made in script.
 */
export function bumpScale(strength: number): number {
  return strength * 0.012;
}

/** Text and pictures on a surface: a screen, a clock face, a sign. */
export function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = makeCanvas(w, h);
  paint(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

export interface Kit {
  // Materials
  wood(tone?: WoodTone | string, opts?: { gloss?: number; repeat?: [number, number] }): THREE.Material;
  fabric(color: string, opts?: { repeat?: [number, number] }): THREE.Material;
  velvet(color: string): THREE.Material;
  leather(color: string): THREE.Material;
  paint(color: string, gloss?: number): THREE.Material;
  plastic(color: string, gloss?: number): THREE.Material;
  metal(kind?: MetalKind | string, roughness?: number): THREE.Material;
  glass(tint?: string, opacity?: number): THREE.Material;
  ceramic(color: string): THREE.Material;
  stone(kind?: StoneKind): THREE.Material;
  leaf(shade?: number): THREE.Material;
  soil(): THREE.Material;
  rubber(color?: string): THREE.Material;
  paper(color?: string): THREE.Material;
  water(color?: string): THREE.Material;
  /** A surface that gives off light (a bulb, a neon tube, an LED). Dark when off. */
  glow(color: string, on: boolean, strength?: number): THREE.Material;
  /** A screen: glossy black when off, the picture when on. */
  screen(on: boolean, picture?: THREE.Texture, strength?: number): THREE.Material;
  /** A picture or a label printed on a flat face; `bump` gives it relief read from the picture. */
  print(picture: THREE.Texture, opts?: { roughness?: number; glow?: number; bump?: number }): THREE.Material;

  // Shapes (sizes in metres; `at` is the centre)
  box(w: number, h: number, d: number, m: THREE.Material, p?: Place & { r?: number }): THREE.Mesh;
  cyl(rTop: number, rBottom: number, h: number, m: THREE.Material, p?: Place & { seg?: number; open?: boolean }): THREE.Mesh;
  sphere(r: number, m: THREE.Material, p?: Place & { seg?: number }): THREE.Mesh;
  torus(R: number, r: number, m: THREE.Material, p?: Place & { arc?: number; seg?: number }): THREE.Mesh;
  cone(r: number, h: number, m: THREE.Material, p?: Place & { seg?: number }): THREE.Mesh;
  /** A turned profile (a vase, a lamp shade, a table leg): [radius, y] pairs from the bottom up. */
  lathe(profile: [number, number][], m: THREE.Material, p?: Place & { seg?: number }): THREE.Mesh;
  /** A flat outline (x, y pairs) given thickness along z, with softened edges. */
  extrude(outline: [number, number][], depth: number, m: THREE.Material, p?: Place & { bevel?: number; holes?: [number, number][][] }): THREE.Mesh;
  /** A soft cushion: a rounded box with a little bulge. */
  cushion(w: number, h: number, d: number, m: THREE.Material, p?: Place): THREE.Mesh;
  /** A tube along points (a cable, a pipe, a bent rail). */
  tube(points: V3[], radius: number, m: THREE.Material, p?: Place & { seg?: number }): THREE.Mesh;
  /** A flat panel facing +z (a picture, a label, a screen face). */
  plane(w: number, h: number, m: THREE.Material, p?: Place): THREE.Mesh;
  /** A flat round face facing +z, its picture upright (a clock face, a dial, a plate). */
  disc(r: number, m: THREE.Material, p?: Place & { seg?: number }): THREE.Mesh;
  /** Four legs under a top of w by d, h tall. */
  legs(w: number, d: number, h: number, m: THREE.Material, opts?: { r?: number; inset?: number; taper?: number; square?: boolean }): THREE.Group;
  group(children: THREE.Object3D[], p?: Place): THREE.Group;

  /**
   * Runs a build and returns, with what it built, the pictures and screens
   * made for that one piece (a clock face, a TV picture), which are its own
   * to free when the piece goes. Shared materials stay with the kit.
   */
  collect<T>(build: () => T): [T, (THREE.Material | THREE.Texture)[]];

  /** Frees every material and texture the kit made. */
  dispose(): void;
}

function place<T extends THREE.Object3D>(o: T, p?: Place): T {
  if (!p) return o;
  if (p.at) o.position.set(p.at[0], p.at[1], p.at[2]);
  if (p.rot) o.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  if (p.scale) o.scale.set(p.scale[0], p.scale[1], p.scale[2]);
  return o;
}

/** Makes a kit. One per renderer: its materials belong to that renderer's GPU memory. */
export function makeKit(): Kit {
  const mats = new Map<string, THREE.Material>();
  const made: (THREE.Material | THREE.Texture)[] = [];
  const geos = new Map<string, THREE.BufferGeometry>();
  /** While a piece is being built, its own pictures go here instead of the kit's store. */
  let collector: (THREE.Material | THREE.Texture)[] | null = null;
  const own = (m: THREE.Material, picture: THREE.Texture) => {
    if (collector) collector.push(m, picture);
    else made.push(m, picture);
    return m;
  };

  const mat = (key: string, make: () => THREE.Material) => {
    let m = mats.get(key);
    if (!m) {
      m = make();
      mats.set(key, m);
    }
    return m;
  };
  const geo = (key: string, make: () => THREE.BufferGeometry) => {
    let g = geos.get(key);
    if (!g) {
      g = make();
      geos.set(key, g);
    }
    return g;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p?: Place) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    return place(o, p);
  };
  const r3 = (n: number) => Math.round(n * 1000) / 1000;

  const kit: Kit = {
    wood(tone = "oak", opts = {}) {
      const color = (WOOD_TONES as Record<string, string>)[tone] ?? tone;
      const gloss = opts.gloss ?? 0.45;
      // White-painted wood shows no grain; any other tone shows it.
      if (tone === "white") return mat(`wood:${color}:${gloss}:painted`, () => new THREE.MeshStandardMaterial({ color, map: TEX.plaster([2, 2]), roughness: 0.55, metalness: 0 }));
      return mat(`wood:${color}:${gloss}:${opts.repeat ?? ""}`, () => {
        const map = TEX.grain(opts.repeat ?? [1, 1]);
        return new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: bumpScale(0.45), roughness: 1 - gloss * 0.8, metalness: 0 });
      });
    },
    fabric(color, opts = {}) {
      return mat(`fabric:${color}:${opts.repeat ?? ""}`, () => {
        const map = TEX.weave(opts.repeat ?? [3, 3]);
        return new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: bumpScale(0.3), roughness: 0.96, metalness: 0 });
      });
    },
    velvet(color) {
      return mat(`velvet:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35) }));
    },
    leather(color) {
      return mat(`leather:${color}`, () => new THREE.MeshStandardMaterial({ color, map: TEX.plaster([2, 2]), roughness: 0.5, metalness: 0 }));
    },
    paint(color, gloss = 0.35) {
      return mat(`paint:${color}:${gloss}`, () => new THREE.MeshStandardMaterial({ color, roughness: 1 - gloss * 0.85, metalness: 0 }));
    },
    plastic(color, gloss = 0.6) {
      return mat(`plastic:${color}:${gloss}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 1 - gloss * 0.8, metalness: 0, clearcoat: gloss * 0.4, clearcoatRoughness: 0.3 }));
    },
    metal(kind = "steel", roughness) {
      const m = (METALS as Record<string, { color: string; roughness: number; metalness: number }>)[kind] ?? { color: kind, roughness: 0.3, metalness: 1 };
      const r = roughness ?? m.roughness;
      return mat(`metal:${m.color}:${r}`, () => new THREE.MeshStandardMaterial({ color: m.color, roughness: r, metalness: m.metalness }));
    },
    glass(tint = "#dfe9ee", opacity = 0.22) {
      return mat(`glass:${tint}:${opacity}`, () => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transparent: true, opacity, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }));
    },
    ceramic(color) {
      return mat(`ceramic:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    },
    stone(kind = "marble") {
      return mat(`stone:${kind}`, () => {
        if (kind === "marble") return new THREE.MeshPhysicalMaterial({ color: "#f1efea", map: TEX.marble(), roughness: 0.16, clearcoat: 0.5, clearcoatRoughness: 0.15 });
        if (kind === "concrete") return new THREE.MeshStandardMaterial({ color: "#a9a7a3", map: TEX.concrete(), bumpMap: TEX.concrete(), bumpScale: bumpScale(0.35), roughness: 0.92 });
        if (kind === "granite") return new THREE.MeshStandardMaterial({ color: "#77736f", map: TEX.concrete([2, 2]), bumpMap: TEX.concrete([2, 2]), bumpScale: bumpScale(0.35), roughness: 0.4 });
        if (kind === "slate") return new THREE.MeshStandardMaterial({ color: "#4b5157", map: TEX.concrete(), roughness: 0.7 });
        if (kind === "terracotta") return new THREE.MeshStandardMaterial({ color: "#b8643f", map: TEX.concrete(), roughness: 0.85 });
        return new THREE.MeshStandardMaterial({ color: "#cdb58e", map: TEX.concrete(), roughness: 0.9 });
      });
    },
    leaf(shade = 0) {
      const tones = ["#3f6b34", "#4c7d3d", "#5a8c45", "#35602f", "#6b9a4f"];
      const color = tones[Math.abs(Math.round(shade)) % tones.length];
      return mat(`leaf:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }));
    },
    soil() {
      return mat("soil", () => new THREE.MeshStandardMaterial({ color: "#3d2c22", map: TEX.carpet([2, 2]), roughness: 1 }));
    },
    rubber(color = "#1f1f22") {
      return mat(`rubber:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 }));
    },
    paper(color = "#f6f3ec") {
      return mat(`paper:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 }));
    },
    water(color = "#5fa8c8") {
      return mat(`water:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 1.4 }));
    },
    glow(color, on, strength = 2.2) {
      return mat(`glow:${color}:${on}:${strength}`, () =>
        on
          ? new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.4 })
          : new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color("#888888"), 0.55), roughness: 0.35 })
      );
    },
    screen(on, picture, strength = 1.3) {
      if (!on || !picture) return mat("screen:off", () => new THREE.MeshPhysicalMaterial({ color: "#0d0f12", roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
      // A screen's picture is its own piece's: freed with it, never shared.
      return own(new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: picture, emissiveIntensity: strength, roughness: 0.15 }), picture);
    },
    print(picture, opts = {}) {
      return own(
        new THREE.MeshStandardMaterial({
          map: picture,
          roughness: opts.roughness ?? 0.7,
          metalness: 0,
          ...(opts.bump ? { bumpMap: picture, bumpScale: bumpScale(opts.bump) } : {}),
          ...(opts.glow ? { emissive: "#ffffff", emissiveMap: picture, emissiveIntensity: opts.glow } : {}),
        }),
        picture
      );
    },

    box(w, h, d, m, p = {}) {
      const r = Math.min(p.r ?? 0, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005);
      const g =
        r > 0.0005
          ? geo(`rbox:${r3(w)}:${r3(h)}:${r3(d)}:${r3(r)}`, () => new RoundedBoxGeometry(w, h, d, 3, r))
          : geo(`box:${r3(w)}:${r3(h)}:${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
      return mesh(g, m, p);
    },
    cyl(rTop, rBottom, h, m, p = {}) {
      const seg = p.seg ?? 28;
      return mesh(geo(`cyl:${r3(rTop)}:${r3(rBottom)}:${r3(h)}:${seg}:${!!p.open}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, !!p.open)), m, p);
    },
    sphere(r, m, p = {}) {
      const seg = p.seg ?? 24;
      return mesh(geo(`sph:${r3(r)}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.66)))), m, p);
    },
    torus(R, r, m, p = {}) {
      const seg = p.seg ?? 32;
      const arc = p.arc ?? Math.PI * 2;
      return mesh(geo(`tor:${r3(R)}:${r3(r)}:${seg}:${r3(arc)}`, () => new THREE.TorusGeometry(R, r, 12, seg, arc)), m, p);
    },
    cone(r, h, m, p = {}) {
      const seg = p.seg ?? 24;
      return mesh(geo(`cone:${r3(r)}:${r3(h)}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)), m, p);
    },
    lathe(profile, m, p = {}) {
      const seg = p.seg ?? 32;
      return mesh(
        geo(`lathe:${profile.map((q) => q.map(r3).join(",")).join(";")}:${seg}`, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg)),
        m,
        p
      );
    },
    extrude(outline, depth, m, p = {}) {
      const bevel = p.bevel ?? Math.min(0.01, depth / 4);
      const key = `ext:${outline.map((q) => q.map(r3).join(",")).join(";")}:${r3(depth)}:${r3(bevel)}:${(p.holes ?? []).map((h) => h.map((q) => q.map(r3).join(",")).join(";")).join("|")}`;
      const g = geo(key, () => {
        const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
        for (const hole of p.holes ?? []) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
        const eg = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
        eg.translate(0, 0, -depth / 2 + bevel);
        return eg;
      });
      return mesh(g, m, p);
    },
    cushion(w, h, d, m, p = {}) {
      const r = Math.min(h * 0.45, w * 0.2, d * 0.2);
      const g = geo(`cush:${r3(w)}:${r3(h)}:${r3(d)}`, () => {
        const rb = new RoundedBoxGeometry(w, h, d, 4, r);
        // A little bulge in the middle of the top and bottom.
        const pos = rb.attributes.position;
        for (let i = 0; i < pos.count; i += 1) {
          const x = pos.getX(i) / (w / 2);
          const z = pos.getZ(i) / (d / 2);
          const y = pos.getY(i);
          const swell = (1 - Math.min(1, x * x)) * (1 - Math.min(1, z * z));
          pos.setY(i, y + Math.sign(y) * swell * h * 0.12);
        }
        rb.computeVertexNormals();
        return rb;
      });
      return mesh(g, m, p);
    },
    tube(points, radius, m, p = {}) {
      const seg = p.seg ?? 32;
      const key = `tube:${points.map((q) => q.map(r3).join(",")).join(";")}:${r3(radius)}:${seg}`;
      const g = geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, radius, 8, false));
      return mesh(g, m, p);
    },
    plane(w, h, m, p = {}) {
      return mesh(geo(`plane:${r3(w)}:${r3(h)}`, () => new THREE.PlaneGeometry(w, h)), m, p);
    },
    disc(r, m, p = {}) {
      const seg = p.seg ?? 48;
      return mesh(geo(`disc:${r3(r)}:${seg}`, () => new THREE.CircleGeometry(r, seg)), m, p);
    },
    legs(w, d, h, m, opts = {}) {
      const r = opts.r ?? 0.02;
      const inset = opts.inset ?? 0.05;
      const g = new THREE.Group();
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const at: V3 = [sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)];
          g.add(opts.square ? kit.box(r * 2, h, r * 2, m, { at, r: r * 0.25 }) : kit.cyl(r * (opts.taper ?? 1), r, h, m, { at, seg: 16 }));
        }
      return g;
    },
    group(children, p) {
      const g = new THREE.Group();
      for (const c of children) g.add(c);
      return place(g, p);
    },
    collect(build) {
      const before = collector;
      const mine: (THREE.Material | THREE.Texture)[] = [];
      collector = mine;
      try {
        return [build(), mine];
      } finally {
        collector = before;
      }
    },
    dispose() {
      for (const m of mats.values()) m.dispose();
      for (const g of geos.values()) g.dispose();
      for (const t of made) t.dispose();
      mats.clear();
      geos.clear();
      made.length = 0;
    },
  };
  return kit;
}

export { SWATCH_HEX } from "./swatches";
