/**
 * The Halloween and fall pieces (lib/season.ts): in the shop October 1 to
 * November 2, kept for good once bought. Built from the same kit and to the
 * same real sizes as the rest of the house: a pumpkin you could lift, a hay
 * bale you could sit on, a cauldron that would hold a real brew. The glowing
 * ones (the jack-o'-lantern, the ghost lamp, the cauldron) have a switch and
 * light the room at night like the lamps do.
 */

import * as THREE from "three";
import { canvasTexture, type Kit, type V3 } from "../kit";
import type { ItemModel } from "../types";

const PI = Math.PI;

/** A fixed random source, so a piece looks the same on every load. */
function seeded(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A see-through print: a drawing with clear parts, on a plane. */
function cutout(k: Kit, picture: THREE.Texture, glow = 0): THREE.Material {
  const m = k.print(picture, { roughness: 0.8, glow }) as THREE.MeshStandardMaterial;
  m.transparent = true;
  m.alphaTest = 0.08;
  m.side = THREE.DoubleSide;
  return m;
}

/**
 * A pumpkin: ten lobes round a core, a stem on top. `r` is the radius, `h` the
 * height; squat and ribbed like a real carving pumpkin.
 */
function pumpkin(k: Kit, r: number, h: number, skin: THREE.Material, at: V3 = [0, 0, 0], turn = 0): THREE.Group {
  const g = new THREE.Group();
  const lobes = 10;
  for (let i = 0; i < lobes; i += 1) {
    const a = (i / lobes) * PI * 2 + turn;
    g.add(k.sphere(1, skin, { at: [Math.cos(a) * r * 0.4, h * 0.5, Math.sin(a) * r * 0.4], scale: [r * 0.66, h * 0.52, r * 0.66], seg: 22 }));
  }
  // The core fills the middle so no gap shows between lobes from above.
  g.add(k.sphere(1, skin, { at: [0, h * 0.5, 0], scale: [r * 0.74, h * 0.46, r * 0.74], seg: 22 }));
  // Stem: a short twisted stub, a little off straight.
  g.add(k.cyl(0.018, 0.028, h * 0.22, k.wood("#5a4a2a", { gloss: 0.1 }), { at: [0.012, h * 0.98, 0], rot: [0.12, 0, -0.18], seg: 10 }));
  g.position.set(...at);
  return g;
}

/** A carved shape (a triangle eye, a grin) that glows from inside the pumpkin when it is lit. */
function carving(k: Kit, outline: [number, number][], on: boolean, at: V3, rot: V3 = [0, 0, 0]): THREE.Mesh {
  const m = on ? k.glow("#ffb347", true, 2.6) : k.paint("#2a1407", 0.2);
  return k.extrude(outline, 0.02, m, { at, rot });
}

const STRAW = "#d9b358";

/** Loose straw, painted once: a texture for bales and a scarecrow's stuffing. */
function strawTexture(seed: number): THREE.Texture {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#c9a04a";
    c.fillRect(0, 0, w, h);
    const r = seeded(seed);
    for (let i = 0; i < 2600; i += 1) {
      const x = r() * w;
      const y = r() * h;
      const len = 10 + r() * 40;
      const a = (r() - 0.5) * 0.9;
      const tone = ["#e6c56a", "#d9b358", "#b98d36", "#f0d98a", "#a67c2c"][Math.floor(r() * 5)];
      c.strokeStyle = tone;
      c.lineWidth = 1 + r() * 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.stroke();
    }
  });
}

// Darker than they will look: the cartoon look (style.ts, pop) lifts every colour, and the studio light lifts it again.
const FALL = ["#b4541a", "#8f2a14", "#c48a1e", "#6b3410", "#a8471c", "#cf9a2a"];

export const HALLOWEEN_ITEMS: Record<string, ItemModel> = {
  // ── Jack-o'-Lantern: a carved pumpkin with a candle inside ───────────────
  "jack-o-lantern": {
    size: [0.36, 0.34, 0.36],
    light: { at: [0, 0.16, 0.08], color: "#ff9d3a", intensity: 2.4, distance: 3 },
    build(k, o) {
      const skin = k.paint(o.color ?? "#c4560f", 0.3);
      const g = pumpkin(k, 0.18, 0.28, skin);
      // The face sits on the front lobes: two triangle eyes, a nose, a jagged grin.
      // Just proud of the front lobes, so the cut shapes read from the shop picture.
      const z = 0.186;
      g.add(carving(k, [[-0.03, -0.02], [0.03, -0.02], [0, 0.035]], o.on, [-0.055, 0.18, z]));
      g.add(carving(k, [[-0.03, -0.02], [0.03, -0.02], [0, 0.035]], o.on, [0.055, 0.18, z]));
      g.add(carving(k, [[-0.012, -0.012], [0.012, -0.012], [0, 0.014]], o.on, [0, 0.14, z + 0.004]));
      g.add(
        carving(
          k,
          [[-0.075, 0.012], [-0.05, -0.004], [-0.035, 0.012], [-0.012, -0.006], [0.012, -0.006], [0.035, 0.012], [0.05, -0.004], [0.075, 0.012], [0.05, -0.03], [0.02, -0.038], [-0.02, -0.038], [-0.05, -0.03]],
          o.on,
          [0, 0.095, z]
        )
      );
      // The candle flame, seen through the mouth when lit.
      if (o.on) g.add(k.sphere(0.02, k.glow("#ffe08a", true, 3.2), { at: [0, 0.1, 0.05], scale: [1, 1.5, 1] }));
      return g;
    },
  },

  // ── Candy Bowl: a black ceramic bowl heaped with wrapped candy ───────────
  "candy-bowl": {
    size: [0.3, 0.16, 0.3],
    build(k, o) {
      const bowl = k.ceramic(o.color ?? "#1c1326");
      const g = k.group([k.lathe([[0, 0], [0.08, 0], [0.1, 0.01], [0.14, 0.07], [0.15, 0.11], [0.148, 0.115], [0.136, 0.112], [0.126, 0.07], [0.09, 0.03], [0, 0.028]], bowl, { seg: 40 })]);
      const wrap = ["#e8741d", "#8b3fb6", "#f4c542", "#22a06b", "#e03a6a", "#f6f1e7"];
      const r = seeded(13);
      for (let i = 0; i < 26; i += 1) {
        const a = r() * PI * 2;
        const d = r() * 0.1;
        const y = 0.09 + (0.1 - d) * 0.45 + r() * 0.012;
        const candy = k.group(
          [
            k.sphere(0.014, k.plastic(wrap[i % wrap.length], 0.9), { scale: [1.25, 1, 1] }),
            k.cone(0.007, 0.016, k.plastic(wrap[i % wrap.length], 0.9), { at: [0.024, 0, 0], rot: [0, 0, -PI / 2] }),
            k.cone(0.007, 0.016, k.plastic(wrap[i % wrap.length], 0.9), { at: [-0.024, 0, 0], rot: [0, 0, PI / 2] }),
          ],
          { at: [Math.cos(a) * d, y, Math.sin(a) * d], rot: [r() * 0.6, r() * PI, r() * 0.4] }
        );
        g.add(candy);
      }
      return g;
    },
  },

  // ── Corner Cobweb: a web across the wall, with its spider ───────────────
  cobweb: {
    size: [0.62, 0.62, 0.04],
    wall: true,
    build(k, o) {
      const web = canvasTexture(512, 512, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        // Grey, not white, with a faint dark edge: a web has to show on a pale wall and in the shop.
        c.strokeStyle = "#9a9ab0";
        c.lineWidth = 3;
        c.shadowColor = "rgba(30,20,50,0.5)";
        c.shadowBlur = 3;
        const cx = w * 0.5;
        const cy = h * 0.04;
        // Spokes from a point at the top, and rings strung between them, each sagging a little.
        const spokes = 9;
        const angles = Array.from({ length: spokes }, (_, i) => PI * 0.08 + (i / (spokes - 1)) * PI * 0.84);
        for (const a of angles) {
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(a) * w * 0.7, cy + Math.sin(a) * h * 0.95);
          c.stroke();
        }
        for (let ring = 1; ring <= 7; ring += 1) {
          const rr = (ring / 7) * w * 0.66;
          c.lineWidth = 2;
          c.beginPath();
          for (let i = 0; i < angles.length; i += 1) {
            const a = angles[i];
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr * 1.35;
            if (i === 0) c.moveTo(x, y);
            else {
              const pa = angles[i - 1];
              const px = cx + Math.cos(pa) * rr;
              const py = cy + Math.sin(pa) * rr * 1.35;
              c.quadraticCurveTo((px + x) / 2, (py + y) / 2 + rr * 0.08, x, y);
            }
          }
          c.stroke();
        }
      });
      const g = k.group([k.plane(0.6, 0.6, cutout(k, web), { at: [0, 0.3, 0.004] })]);
      // The spider: body, head, eight legs, hanging on a thread near the middle.
      const ink = k.plastic(o.color ?? "#15121a", 0.3);
      const spider = k.group([k.sphere(0.022, ink, { scale: [1, 0.85, 1.2] }), k.sphere(0.012, ink, { at: [0, 0.004, 0.028] })]);
      for (let i = 0; i < 8; i += 1) {
        const side = i < 4 ? 1 : -1;
        const j = i % 4;
        const a = -0.6 + j * 0.42;
        spider.add(k.cyl(0.0022, 0.0022, 0.05, ink, { at: [side * 0.03, 0.004, -0.012 + j * 0.012], rot: [0, 0, side * (PI / 2 - 0.5 + a * 0.3)] }));
      }
      spider.position.set(0.05, 0.3, 0.03);
      g.add(spider);
      g.add(k.cyl(0.0012, 0.0012, 0.26, k.plastic("#e8e8ee", 0.2), { at: [0.05, 0.45, 0.03] }));
      return g;
    },
  },

  // ── Pumpkin Pile: three pumpkins, the way they sit by a front door ───────
  "pumpkin-pile": {
    size: [0.62, 0.42, 0.5],
    build(k, o) {
      const big = k.paint(o.color ?? "#c4560f", 0.3);
      const g = new THREE.Group();
      g.add(pumpkin(k, 0.2, 0.3, big, [-0.1, 0, 0.02], 0.3));
      g.add(pumpkin(k, 0.14, 0.22, k.paint("#d9b47c", 0.3), [0.19, 0, -0.06], 1.1));
      g.add(pumpkin(k, 0.1, 0.17, k.paint("#5c7a22", 0.3), [0.12, 0, 0.17], 2.2));
      // A gourd on top of the big one, and a few fallen leaves.
      g.add(k.sphere(0.055, k.paint("#b8861e", 0.3), { at: [-0.1, 0.33, 0.02], scale: [1, 0.8, 1] }));
      for (let i = 0; i < 5; i += 1) {
        const a = i * 1.3;
        g.add(k.sphere(1, k.paint(FALL[i % FALL.length], 0.3), { at: [Math.cos(a) * 0.27, 0.004, Math.sin(a) * 0.22], scale: [0.04, 0.004, 0.03], rot: [0, a, 0] }));
      }
      return g;
    },
  },

  // ── Hay Bale Seat: a square bale with two bands of twine and a blanket ──
  "hay-bale": {
    size: [0.9, 0.5, 0.5],
    build(k, o) {
      const straw = k.print(strawTexture(5), { roughness: 0.95, bump: 0.6 });
      const g = k.group([k.box(0.88, 0.44, 0.48, straw, { at: [0, 0.22, 0], r: 0.03 })]);
      // Loose ends poking out of the sides.
      const r = seeded(9);
      for (let i = 0; i < 70; i += 1) {
        const side = r() < 0.5 ? -1 : 1;
        g.add(k.cyl(0.0025, 0.0025, 0.05 + r() * 0.06, k.paint(STRAW, 0.2), { at: [side * 0.44, 0.04 + r() * 0.36, -0.22 + r() * 0.44], rot: [(r() - 0.5) * 0.6, 0, side * (PI / 2 + (r() - 0.5) * 0.5)] }));
      }
      // Twine.
      for (const x of [-0.25, 0.25]) g.add(k.box(0.03, 0.446, 0.486, k.rubber("#8a6a3a"), { at: [x, 0.22, 0], r: 0.005 }));
      // A folded blanket, in the colour picked.
      g.add(k.box(0.34, 0.05, 0.4, k.fabric(o.color ?? "#9b2d2a"), { at: [0.2, 0.465, 0.02], r: 0.015 }));
      g.add(k.box(0.3, 0.035, 0.36, k.fabric(o.color ?? "#9b2d2a"), { at: [0.2, 0.505, 0.02], r: 0.012 }));
      return g;
    },
  },

  // ── Autumn Wreath: dry leaves and berries on a twig ring, with a bow ─────
  "autumn-wreath": {
    size: [0.5, 0.5, 0.1],
    wall: true,
    build(k, o) {
      const g = k.group([k.torus(0.18, 0.025, k.wood("#6b4a2a", { gloss: 0.1 }), { at: [0, 0.25, 0.03], seg: 48 })]);
      const r = seeded(21);
      for (let i = 0; i < 48; i += 1) {
        const a = (i / 48) * PI * 2;
        const out = 0.15 + r() * 0.07;
        const leaf = k.sphere(1, k.paint(FALL[Math.floor(r() * FALL.length)], 0.3), {
          at: [Math.cos(a) * out, 0.25 + Math.sin(a) * out, 0.04 + r() * 0.03],
          scale: [0.045, 0.028, 0.012],
          rot: [(r() - 0.5) * 0.8, (r() - 0.5) * 0.6, a + PI / 2 + (r() - 0.5) * 0.7],
        });
        g.add(leaf);
        if (i % 6 === 0) g.add(k.sphere(0.012, k.plastic("#a3142b", 0.8), { at: [Math.cos(a) * 0.17, 0.25 + Math.sin(a) * 0.17, 0.06] }));
      }
      // A ribbon bow at the bottom, in the colour picked.
      const bow = k.fabric(o.color ?? "#b4541a");
      g.add(k.sphere(1, bow, { at: [-0.05, 0.06, 0.07], scale: [0.055, 0.032, 0.02], rot: [0, 0, 0.3] }));
      g.add(k.sphere(1, bow, { at: [0.05, 0.06, 0.07], scale: [0.055, 0.032, 0.02], rot: [0, 0, -0.3] }));
      g.add(k.sphere(0.018, bow, { at: [0, 0.06, 0.08] }));
      g.add(k.box(0.03, 0.08, 0.008, bow, { at: [-0.025, 0.005, 0.072], rot: [0, 0, 0.25] }));
      g.add(k.box(0.03, 0.08, 0.008, bow, { at: [0.025, 0.005, 0.072], rot: [0, 0, -0.25] }));
      return g;
    },
  },

  // ── Witch's Broom: a besom leaning on its bristles ───────────────────────
  "witch-broom": {
    size: [0.4, 1.4, 0.4],
    build(k, o) {
      const lean = 0.22;
      const g = new THREE.Group();
      // Bristles: a brush of twigs flaring from a bound neck.
      const brush = k.lathe([[0.0001, 0], [0.11, 0], [0.13, 0.08], [0.1, 0.3], [0.045, 0.42], [0.03, 0.46], [0.0001, 0.46]], k.print(strawTexture(17), { roughness: 0.95, bump: 0.5 }), { seg: 36 });
      const r = seeded(3);
      for (let i = 0; i < 60; i += 1) {
        const a = r() * PI * 2;
        const d = 0.04 + r() * 0.09;
        brush.add(k.cyl(0.003, 0.0022, 0.26 + r() * 0.14, k.paint(["#b98d36", "#8a6a2a", "#d9b358"][i % 3], 0.2), { at: [Math.cos(a) * d, 0.12, Math.sin(a) * d], rot: [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3] }));
      }
      g.add(brush);
      g.add(k.torus(0.036, 0.008, k.rubber("#6b4a2a"), { at: [0, 0.4, 0], rot: [PI / 2, 0, 0], seg: 28 }));
      g.add(k.torus(0.034, 0.007, k.rubber("#6b4a2a"), { at: [0, 0.44, 0], rot: [PI / 2, 0, 0], seg: 28 }));
      // The handle: a knotty branch, in the colour picked.
      g.add(k.cyl(0.016, 0.024, 0.98, k.wood(o.color ?? "#5a3d22", { gloss: 0.15 }), { at: [0, 0.93, 0], seg: 14 }));
      g.add(k.sphere(0.02, k.wood("#5a3d22", { gloss: 0.15 }), { at: [0.004, 1.1, 0.006], scale: [1, 0.6, 1] }));
      g.rotation.set(lean, 0.3, 0.1);
      return g;
    },
  },

  // ── Ghost Lamp: a frosted-glass ghost that glows from inside ─────────────
  "ghost-lamp": {
    size: [0.3, 0.5, 0.3],
    light: { at: [0, 0.3, 0.05], color: "#dff3ff", intensity: 2, distance: 3 },
    build(k, o) {
      const glass = o.on ? k.glow(o.color ?? "#f4fbff", true, 1.4) : k.glass("#e9eef3", 0.75);
      const g = k.group([k.cyl(0.11, 0.12, 0.03, k.metal("black"), { at: [0, 0.015, 0], seg: 40 })]);
      // The body: a dome with a wavy hem, as one lathe.
      g.add(k.lathe([[0.0001, 0.03], [0.1, 0.03], [0.12, 0.05], [0.1, 0.09], [0.12, 0.13], [0.11, 0.2], [0.1, 0.3], [0.085, 0.38], [0.055, 0.44], [0.0001, 0.47]], glass, { seg: 40 }));
      // Eyes and a round mouth, pressed into the glass.
      const ink = k.plastic("#1a1522", 0.4);
      g.add(k.sphere(0.018, ink, { at: [-0.035, 0.34, 0.098], scale: [1, 1.4, 0.5] }));
      g.add(k.sphere(0.018, ink, { at: [0.035, 0.34, 0.098], scale: [1, 1.4, 0.5] }));
      g.add(k.sphere(0.016, ink, { at: [0, 0.27, 0.104], scale: [1, 1.2, 0.5] }));
      // Two little arms out to the sides.
      g.add(k.sphere(1, glass, { at: [-0.12, 0.24, 0.02], scale: [0.045, 0.03, 0.03], rot: [0, 0, 0.5] }));
      g.add(k.sphere(1, glass, { at: [0.12, 0.24, 0.02], scale: [0.045, 0.03, 0.03], rot: [0, 0, -0.5] }));
      if (o.on) g.add(k.sphere(0.04, k.glow("#ffffff", true, 2.4), { at: [0, 0.22, 0] }));
      return g;
    },
  },

  // ── Bubbling Cauldron: cast iron on three legs over a small fire ─────────
  cauldron: {
    size: [0.62, 0.6, 0.62],
    light: { at: [0, 0.52, 0], color: "#5df07a", intensity: 2.6, distance: 3.4 },
    build(k, o) {
      const iron = k.metal("black", 0.75);
      const g = new THREE.Group();
      // Legs and a ring of stones with the fire inside.
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2 + 0.5;
        g.add(k.cyl(0.016, 0.02, 0.2, iron, { at: [Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17], rot: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25] }));
      }
      const r = seeded(29);
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * PI * 2;
        g.add(k.sphere(0.035 + r() * 0.015, k.stone("granite"), { at: [Math.cos(a) * 0.24, 0.025, Math.sin(a) * 0.24], scale: [1, 0.7, 1] }));
      }
      for (let i = 0; i < 4; i += 1) g.add(k.cyl(0.014, 0.018, 0.26, k.wood("#4a3220", { gloss: 0.1 }), { at: [0, 0.03, 0], rot: [0.2, i * 0.8, PI / 2 - 0.15], seg: 8 }));
      if (o.on) {
        g.add(k.cone(0.07, 0.16, k.glow("#ff9a2e", true, 2.2), { at: [0, 0.1, 0], seg: 16 }));
        g.add(k.cone(0.04, 0.12, k.glow("#ffd26a", true, 3), { at: [0.01, 0.13, 0.01], seg: 12 }));
      }
      // The pot: a fat belly, a lip, two ring handles.
      g.add(k.lathe([[0.0001, 0.17], [0.16, 0.17], [0.22, 0.22], [0.26, 0.33], [0.25, 0.44], [0.2, 0.52], [0.21, 0.54], [0.22, 0.555], [0.2, 0.555], [0.19, 0.54], [0.0001, 0.54]], iron, { seg: 44 }));
      g.add(k.torus(0.21, 0.014, iron, { at: [0, 0.545, 0], rot: [PI / 2, 0, 0], seg: 44 }));
      for (const x of [-0.23, 0.23]) g.add(k.torus(0.03, 0.006, iron, { at: [x, 0.5, 0], rot: [0, PI / 2, 0], seg: 20 }));
      // The brew: a green surface that glows, with bubbles riding on it.
      const brew = o.on ? k.glow("#49e36c", true, 1.8) : k.paint("#2e6b3a", 0.6);
      g.add(k.disc(0.19, brew, { at: [0, 0.541, 0], rot: [-PI / 2, 0, 0], seg: 44 }));
      const bubbles = o.on ? k.glow("#9cffb0", true, 1.6) : k.paint("#3f8a4c", 0.6);
      for (let i = 0; i < 9; i += 1) {
        const a = r() * PI * 2;
        const d = r() * 0.15;
        g.add(k.sphere(0.008 + r() * 0.016, bubbles, { at: [Math.cos(a) * d, 0.545 + r() * 0.03, Math.sin(a) * d] }));
      }
      // Steam, when it is on: faint pale puffs over the pot.
      if (o.on) {
        const mist = k.glass("#dfffe6", 0.18);
        for (let i = 0; i < 4; i += 1) g.add(k.sphere(0.05 + i * 0.012, mist, { at: [(r() - 0.5) * 0.12, 0.62 + i * 0.07, (r() - 0.5) * 0.12] }));
      }
      // A wooden spoon resting on the rim.
      g.add(k.cyl(0.008, 0.01, 0.44, k.wood("pine", { gloss: 0.2 }), { at: [0.1, 0.62, 0.12], rot: [0.5, 0, -0.9], seg: 10 }));
      return g;
    },
  },

  // ── Study Scarecrow: on a post, in a plaid shirt, with a book under its arm ─
  scarecrow: {
    size: [0.9, 1.8, 0.4],
    build(k, o) {
      const g = new THREE.Group();
      const post = k.wood("#6b4a2a", { gloss: 0.1 });
      g.add(k.box(0.07, 1.4, 0.07, post, { at: [0, 0.7, -0.08] }));
      g.add(k.box(0.86, 0.06, 0.06, post, { at: [0, 1.2, -0.08] }));
      // Body: a stuffed shirt, in the colour picked, with a straw stuffing poking out everywhere.
      const shirt = k.fabric(o.color ?? "#9b2d2a");
      const straw = k.print(strawTexture(11), { roughness: 0.95 });
      g.add(k.box(0.36, 0.5, 0.26, shirt, { at: [0, 1.0, 0], r: 0.05 }));
      g.add(k.cyl(0.06, 0.07, 0.42, shirt, { at: [-0.4, 1.19, 0], rot: [0, 0, PI / 2], seg: 16 }));
      g.add(k.cyl(0.06, 0.07, 0.42, shirt, { at: [0.4, 1.19, 0], rot: [0, 0, PI / 2], seg: 16 }));
      // Overalls below, patched.
      const denim = k.fabric("#3f5a8a");
      g.add(k.box(0.34, 0.3, 0.24, denim, { at: [0, 0.62, 0], r: 0.03 }));
      g.add(k.box(0.08, 0.5, 0.02, denim, { at: [-0.1, 0.98, 0.13] }));
      g.add(k.box(0.08, 0.5, 0.02, denim, { at: [0.1, 0.98, 0.13] }));
      g.add(k.box(0.09, 0.07, 0.01, k.fabric("#e2a82f"), { at: [0.09, 0.66, 0.125] }));
      // Straw at the cuffs, the hem and the neck.
      const r = seeded(2);
      const tufts = (at: V3, dir: V3, n: number) => {
        for (let i = 0; i < n; i += 1)
          g.add(k.cyl(0.003, 0.003, 0.1 + r() * 0.06, k.paint(STRAW, 0.2), { at: [at[0] + (r() - 0.5) * 0.06, at[1] + (r() - 0.5) * 0.06, at[2] + (r() - 0.5) * 0.06], rot: [dir[0] + (r() - 0.5) * 0.6, dir[1], dir[2] + (r() - 0.5) * 0.6] }));
      };
      tufts([-0.63, 1.19, 0], [0, 0, PI / 2], 14);
      tufts([0.63, 1.19, 0], [0, 0, PI / 2], 14);
      tufts([0, 0.46, 0], [0, 0, 0], 16);
      // Head: a burlap sack tied at the neck, with a stitched smile and button eyes.
      g.add(k.sphere(0.15, k.print(strawTexture(23), { roughness: 1 }), { at: [0, 1.43, 0], scale: [1, 1.1, 0.95] }));
      g.add(k.sphere(0.15, k.fabric("#c9a876"), { at: [0, 1.43, 0], scale: [0.99, 1.09, 0.94] }));
      g.add(k.torus(0.06, 0.008, k.rubber("#6b4a2a"), { at: [0, 1.27, 0], rot: [PI / 2, 0, 0], seg: 24 }));
      const ink = k.plastic("#1a1522", 0.4);
      g.add(k.sphere(0.018, ink, { at: [-0.05, 1.47, 0.135] }));
      g.add(k.sphere(0.018, ink, { at: [0.05, 1.47, 0.135] }));
      for (let i = 0; i < 5; i += 1) g.add(k.box(0.012, 0.03, 0.006, ink, { at: [-0.06 + i * 0.03, 1.39 - Math.abs(i - 2) * 0.008, 0.14], rot: [0, 0, 0.5] }));
      // A straw hat with a band.
      g.add(k.cone(0.14, 0.14, straw, { at: [0, 1.62, 0], seg: 24 }));
      g.add(k.cyl(0.26, 0.28, 0.02, straw, { at: [0, 1.555, 0], seg: 32 }));
      g.add(k.cyl(0.125, 0.125, 0.03, k.fabric("#2a1830"), { at: [0, 1.575, 0], seg: 24 }));
      // An algebra book under one arm, so it is studying out there.
      g.add(k.box(0.05, 0.2, 0.15, k.paper("#2563eb"), { at: [0.43, 1.08, 0.08], rot: [0, 0, 0.1] }));
      g.add(k.box(0.04, 0.19, 0.14, k.paper("#f6f1e7"), { at: [0.455, 1.08, 0.08], rot: [0, 0, 0.1] }));
      // A crow on the crossbar, because of course.
      g.add(k.sphere(0.04, ink, { at: [-0.36, 1.27, -0.08], scale: [1.4, 1, 1] }));
      g.add(k.sphere(0.025, ink, { at: [-0.3, 1.3, -0.08] }));
      g.add(k.cone(0.008, 0.03, k.plastic("#e2a82f", 0.5), { at: [-0.27, 1.3, -0.08], rot: [0, 0, -PI / 2], seg: 8 }));
      return g;
    },
  },
};
