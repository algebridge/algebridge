/**
 * The first pieces, built to set the bar for the rest: real sizes in metres,
 * real materials, soft edges, and where a piece can show something true
 * (the books on the shelf, the clock's goal ring), it does.
 */

import * as THREE from "three";
import { canvasTexture } from "../kit";
import type { ItemModel } from "../types";

const FONT = "600 64px Inter, system-ui, sans-serif";

/** A row of books for a shelf `w` wide, as many as `count`, each its own colour and height. */
function books(k: Parameters<ItemModel["build"]>[0], w: number, count: number, seed: number): THREE.Group {
  const covers = ["#7a2e2e", "#2f4f6f", "#3d5c3a", "#8a6a2f", "#5a3d6b", "#2c2c2c", "#a24b2a", "#46607a", "#6d6a5f", "#9c7c4a"];
  const g = new THREE.Group();
  let x = -w / 2 + 0.02;
  let i = 0;
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  while (i < count && x < w / 2 - 0.05) {
    const t = 0.022 + rnd() * 0.022;
    const h = 0.19 + rnd() * 0.08;
    const d = 0.16 + rnd() * 0.05;
    const lean = i === count - 1 && rnd() > 0.4 ? 0.22 : 0;
    const book = k.box(t, h, d, k.paper(covers[Math.floor(rnd() * covers.length)]), { at: [x + t / 2, h / 2, 0], r: 0.003, rot: [0, 0, -lean] });
    g.add(book);
    x += t + 0.002 + lean * 0.06;
    i += 1;
  }
  return g;
}

export const CORE_ITEMS: Record<string, ItemModel> = {
  desk: {
    size: [1.3, 0.76, 0.66],
    build(k, o) {
      const top = k.wood("oak", { gloss: 0.5 });
      const drawers = k.paint(o.color ?? "#e7e3da", 0.45);
      const steel = k.metal("black");
      const g = k.group([
        // Top, with a softened edge.
        k.box(1.3, 0.035, 0.66, top, { at: [0, 0.7425, 0], r: 0.008 }),
        // Two slim steel legs on the open side.
        k.box(0.04, 0.725, 0.04, steel, { at: [-0.6, 0.3625, -0.28], r: 0.004 }),
        k.box(0.04, 0.725, 0.04, steel, { at: [-0.6, 0.3625, 0.28], r: 0.004 }),
        k.box(0.03, 0.03, 0.56, steel, { at: [-0.6, 0.06, 0], r: 0.004 }),
        // The drawer unit.
        k.box(0.42, 0.72, 0.6, drawers, { at: [0.42, 0.36, 0], r: 0.01 }),
      ]);
      for (let i = 0; i < 3; i += 1) {
        const y = 0.6 - i * 0.22;
        g.add(k.box(0.4, 0.2, 0.012, drawers, { at: [0.42, y, 0.303], r: 0.004 }));
        g.add(k.box(0.12, 0.012, 0.02, k.metal("brass"), { at: [0.42, y + 0.06, 0.315], r: 0.004 }));
      }
      // A closed notebook and a mug on top: someone studies here.
      g.add(k.box(0.3, 0.012, 0.22, k.paper("#2f4f6f"), { at: [-0.25, 0.766, 0.05], rot: [0, 0.2, 0], r: 0.003 }));
      g.add(k.cyl(0.04, 0.036, 0.095, k.ceramic("#f2efe9"), { at: [0.25, 0.808, 0.12] }));
      g.add(k.torus(0.026, 0.006, k.ceramic("#f2efe9"), { at: [0.295, 0.81, 0.12], rot: [0, 0, Math.PI / 2], arc: Math.PI * 1.2 }));
      return g;
    },
  },

  chair: {
    size: [0.6, 0.98, 0.6],
    build(k, o) {
      const seat = k.fabric(o.color ?? "#3f4c5c");
      const chrome = k.metal("chrome");
      const g = k.group([
        k.cushion(0.5, 0.08, 0.48, seat, { at: [0, 0.5, 0] }),
        k.cushion(0.46, 0.5, 0.07, seat, { at: [0, 0.82, -0.23], rot: [-0.12, 0, 0] }),
        // The back's stem and the gas lift.
        k.box(0.06, 0.32, 0.03, k.metal("black"), { at: [0, 0.6, -0.27], rot: [-0.12, 0, 0], r: 0.008 }),
        k.cyl(0.025, 0.025, 0.3, chrome, { at: [0, 0.31, 0] }),
        k.cyl(0.04, 0.04, 0.08, k.metal("black"), { at: [0, 0.42, 0] }),
      ]);
      // Five legs on casters.
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const leg = k.box(0.3, 0.035, 0.05, chrome, { at: [Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15], rot: [0, -a, 0], r: 0.01 });
        g.add(leg);
        g.add(k.sphere(0.03, k.rubber(), { at: [Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29] }));
      }
      // Armrests.
      for (const sx of [-1, 1]) {
        g.add(k.box(0.05, 0.03, 0.26, k.rubber("#26282c"), { at: [sx * 0.27, 0.68, 0], r: 0.012 }));
        g.add(k.box(0.025, 0.16, 0.025, k.metal("black"), { at: [sx * 0.27, 0.6, -0.02] }));
      }
      return g;
    },
  },

  bed: {
    size: [1.1, 0.95, 2.1],
    build(k, o) {
      const frame = k.wood("walnut", { gloss: 0.4 });
      const duvet = k.fabric(o.color ?? "#d9dde3", { repeat: [4, 6] });
      const sheet = k.fabric("#f4f2ee");
      const g = k.group([
        // Frame and legs.
        k.box(1.06, 0.18, 2.06, frame, { at: [0, 0.2, 0], r: 0.015 }),
        ...k.legs(1.0, 2.0, 0.12, frame, { r: 0.025, inset: 0.05 }).children,
        // Headboard, upholstered.
        k.cushion(1.06, 0.62, 0.09, k.fabric(o.color ? o.color : "#8a8f96"), { at: [0, 0.62, -1.02] }),
        // Mattress, duvet folded back at the top, two pillows.
        k.cushion(1.0, 0.2, 1.96, sheet, { at: [0, 0.38, 0.0] }),
        k.cushion(1.04, 0.09, 1.45, duvet, { at: [0, 0.505, 0.26] }),
        k.cushion(1.05, 0.06, 0.18, duvet, { at: [0, 0.53, -0.4] }),
        k.cushion(0.44, 0.13, 0.32, sheet, { at: [-0.23, 0.53, -0.78], rot: [-0.25, 0.05, 0] }),
        k.cushion(0.44, 0.13, 0.32, sheet, { at: [0.23, 0.53, -0.78], rot: [-0.25, -0.05, 0] }),
      ]);
      return g;
    },
  },

  bookshelf: {
    size: [0.9, 1.8, 0.34],
    build(k, o) {
      const wood = k.wood(o.color ? o.color : "oak", { gloss: 0.3 });
      // The back panel a shade darker than the case, as veneered shelving is.
      const back = o.color ? k.paint("#e9e6e0", 0.2) : k.wood("walnut", { gloss: 0.2 });
      const g = k.group([
        k.box(0.025, 1.8, 0.34, wood, { at: [-0.4375, 0.9, 0], r: 0.004 }),
        k.box(0.025, 1.8, 0.34, wood, { at: [0.4375, 0.9, 0], r: 0.004 }),
        k.box(0.9, 0.02, 0.34, wood, { at: [0, 1.79, 0], r: 0.004 }),
        k.box(0.85, 1.76, 0.01, back, { at: [0, 0.9, -0.165] }),
        k.box(0.85, 0.06, 0.32, wood, { at: [0, 0.03, 0.005] }),
      ]);
      // Shelves, and on them one book for each skill finished: the shelf fills as the course does.
      const levels = [0.06, 0.4, 0.74, 1.08, 1.42];
      const total = Math.max(1, o.live.skillsTotal);
      const done = Math.min(o.live.skillsDone, total);
      const perShelf = Math.ceil(total / levels.length);
      levels.forEach((y, i) => {
        if (i > 0) g.add(k.box(0.85, 0.022, 0.32, wood, { at: [0, y, 0.005], r: 0.003 }));
        const here = Math.max(0, Math.min(perShelf, done - i * perShelf));
        if (here > 0) {
          const row = books(k, 0.84, here, 101 + i * 7);
          row.position.set(0, y + 0.011, 0.02);
          g.add(row);
        }
      });
      return g;
    },
  },

  lamp: {
    size: [0.22, 0.52, 0.24],
    light: { at: [0.0, 0.42, 0.1], color: "#ffd9a0", intensity: 2.2, distance: 3.2 },
    build(k, o) {
      const arm = k.metal("black");
      const shade = k.paint(o.color ?? "#1f3b33", 0.55);
      const g = k.group([
        k.cyl(0.08, 0.085, 0.024, k.metal("black"), { at: [0, 0.012, 0] }),
        k.sphere(0.018, k.metal("brass"), { at: [0, 0.03, 0] }),
        // Lower arm leaning back, upper arm reaching forward, a brass joint between.
        k.cyl(0.007, 0.007, 0.3, arm, { at: [0, 0.17, -0.05], rot: [-0.35, 0, 0] }),
        k.sphere(0.016, k.metal("brass"), { at: [0, 0.31, -0.1] }),
        k.cyl(0.007, 0.007, 0.26, arm, { at: [0, 0.36, 0.0], rot: [1.2, 0, 0] }),
        k.sphere(0.014, k.metal("brass"), { at: [0, 0.41, 0.115] }),
      ]);
      // The shade: a cone open at the bottom, tipped down at the desk, with the bulb inside.
      const head = k.group([
        k.lathe([[0.012, 0.11], [0.03, 0.105], [0.055, 0.06], [0.075, 0.0], [0.072, 0.0], [0.052, 0.058], [0.027, 0.1], [0.012, 0.104]], shade, { seg: 40 }),
        k.sphere(0.024, k.glow("#ffe2b0", o.on, 3), { at: [0, 0.03, 0] }),
      ]);
      head.position.set(0, 0.32, 0.15);
      head.rotation.set(0.5, 0, 0);
      g.add(head);
      return g;
    },
  },

  plant: {
    size: [0.55, 1.15, 0.55],
    build(k, o) {
      const pot = k.ceramic(o.color ?? "#c7a98a");
      const g = k.group([
        k.lathe([[0.0, 0], [0.13, 0], [0.155, 0.04], [0.17, 0.28], [0.18, 0.3], [0.17, 0.3]], pot, { seg: 36 }),
        k.cyl(0.165, 0.165, 0.01, k.soil(), { at: [0, 0.285, 0] }),
      ]);
      // A fiddle-leaf fig: it grows with the daily goals reached, and droops after three days without practice.
      const grow = 0.45 + Math.min(1, Math.max(0, o.live.growth)) * 0.55;
      const droop = o.live.thirsty ? 0.55 : 0;
      const stem = k.wood("#5b4532", { gloss: 0.1 });
      const trunkH = 0.75 * grow;
      g.add(k.cyl(0.012, 0.018, trunkH, stem, { at: [0, 0.29 + trunkH / 2, 0] }));
      const leaves = Math.round(9 + grow * 14);
      for (let i = 0; i < leaves; i += 1) {
        const t = i / leaves;
        const y = 0.36 + t * trunkH * 1.05;
        const a = i * 2.4;
        const len = (0.17 + (1 - t) * 0.06) * (0.8 + grow * 0.3);
        const leaf = k.sphere(1, k.leaf(i % 3), { scale: [len * 0.62, 0.018, len], rot: [0.18, 0, 0] });
        const arm = new THREE.Group();
        leaf.position.set(0, 0, len * 0.85);
        arm.add(leaf);
        arm.position.set(0, y, 0);
        arm.rotation.set(-0.35 + droop + (1 - t) * 0.25, a, 0);
        g.add(arm);
      }
      return g;
    },
  },

  tv: {
    size: [1.5, 1.25, 0.45],
    light: { at: [0, 0.85, 0.2], color: "#bcd4ff", intensity: 0.8, distance: 2.5 },
    build(k, o) {
      const cabinet = k.wood(o.color ? o.color : "walnut", { gloss: 0.45 });
      const g = k.group([
        k.box(1.5, 0.42, 0.42, cabinet, { at: [0, 0.27, 0], r: 0.012 }),
        ...k.legs(1.4, 0.36, 0.06, k.metal("black"), { r: 0.012, inset: 0.04 }).children,
        // Two doors and a gap between them.
        k.box(0.002, 0.36, 0.005, k.paint("#2a1e16"), { at: [0, 0.27, 0.212] }),
        k.box(0.18, 0.012, 0.015, k.metal("black"), { at: [-0.12, 0.38, 0.22] }),
        k.box(0.18, 0.012, 0.015, k.metal("black"), { at: [0.12, 0.38, 0.22] }),
        // The TV on its stand.
        k.box(0.32, 0.012, 0.18, k.metal("black"), { at: [0, 0.486, 0], r: 0.004 }),
        k.box(0.06, 0.1, 0.03, k.metal("black"), { at: [0, 0.54, -0.02] }),
        k.box(1.14, 0.66, 0.045, k.plastic("#16181b", 0.4), { at: [0, 0.92, 0], r: 0.006 }),
      ]);
      // The screen: the skill the student is on, as a title card, when it is on.
      const picture = o.on
        ? canvasTexture(1024, 576, (c, w, h) => {
            const bg = c.createLinearGradient(0, 0, w, h);
            bg.addColorStop(0, "#14284d");
            bg.addColorStop(1, "#2f5fb3");
            c.fillStyle = bg;
            c.fillRect(0, 0, w, h);
            c.fillStyle = "rgba(255,255,255,0.75)";
            c.font = "600 40px Inter, system-ui, sans-serif";
            c.fillText("NOW LEARNING", 70, 200);
            c.fillStyle = "#ffffff";
            c.font = "700 84px Inter, system-ui, sans-serif";
            c.fillText((o.live.skillTitle ?? "Algebra 1").slice(0, 22), 70, 300);
            c.fillStyle = "rgba(255,255,255,0.7)";
            c.font = "500 36px Inter, system-ui, sans-serif";
            c.fillText("Tap the TV to watch the lesson", 70, 380);
          })
        : undefined;
      g.add(k.plane(1.1, 0.62, k.screen(o.on, picture, 1.15), { at: [0, 0.92, 0.0235] }));
      return g;
    },
  },

  rug: {
    size: [2.0, 0.02, 1.4],
    build(k, o) {
      const base = o.color ?? "#b9ab95";
      const pattern = canvasTexture(1024, 720, (c, w, h) => {
        c.fillStyle = base;
        c.fillRect(0, 0, w, h);
        const dark = new THREE.Color(base).multiplyScalar(0.62).getStyle();
        const light = new THREE.Color(base).lerp(new THREE.Color("#ffffff"), 0.45).getStyle();
        c.strokeStyle = dark;
        c.lineWidth = 26;
        c.strokeRect(40, 40, w - 80, h - 80);
        c.strokeStyle = light;
        c.lineWidth = 8;
        c.strokeRect(84, 84, w - 168, h - 168);
        // A quiet diamond field.
        c.strokeStyle = dark;
        c.globalAlpha = 0.35;
        c.lineWidth = 4;
        for (let x = 150; x < w - 120; x += 90)
          for (let y = 150; y < h - 120; y += 90) {
            c.beginPath();
            c.moveTo(x, y - 30);
            c.lineTo(x + 30, y);
            c.lineTo(x, y + 30);
            c.lineTo(x - 30, y);
            c.closePath();
            c.stroke();
          }
        c.globalAlpha = 1;
        // Weave.
        for (let y = 0; y < h; y += 3) {
          c.fillStyle = `rgba(0,0,0,${0.025 + ((y * 7919) % 13) / 400})`;
          c.fillRect(0, y, w, 1);
        }
      });
      const m = k.print(pattern, { roughness: 0.98 });
      const g = k.group([k.box(2.0, 0.012, 1.4, k.fabric(base), { at: [0, 0.006, 0], r: 0.004 }), k.plane(1.99, 1.39, m, { at: [0, 0.0125, 0], rot: [-Math.PI / 2, 0, 0] })]);
      return g;
    },
  },

  clock: {
    size: [0.38, 0.38, 0.06],
    wall: true,
    build(k, o) {
      const d = new Date(o.live.now);
      const goal = Math.min(1, o.live.goalRight / Math.max(1, o.live.goalTarget));
      const face = canvasTexture(512, 512, (c, w) => {
        const r = w / 2;
        c.fillStyle = "#f7f5f0";
        c.fillRect(0, 0, w, w);
        // The daily goal, as a ring round the dial.
        c.lineWidth = 22;
        c.strokeStyle = "#e3ded3";
        c.beginPath();
        c.arc(r, r, r - 30, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = goal >= 1 ? "#2f9e5b" : "#d08a2a";
        c.lineCap = "round";
        c.beginPath();
        c.arc(r, r, r - 30, -Math.PI / 2, -Math.PI / 2 + goal * Math.PI * 2);
        c.stroke();
        c.fillStyle = "#24272b";
        c.font = FONT.replace("64px", "54px");
        c.textAlign = "center";
        c.textBaseline = "middle";
        for (let i = 1; i <= 12; i += 1) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          c.fillText(String(i), r + Math.cos(a) * (r - 100), r + Math.sin(a) * (r - 100));
        }
        c.font = "600 30px Inter, system-ui, sans-serif";
        c.fillStyle = "#6b6f75";
        c.fillText(`${Math.min(o.live.goalRight, o.live.goalTarget)} of ${o.live.goalTarget} today`, r, r + 92);
        // Hands.
        const hand = (angle: number, len: number, width: number, color: string) => {
          c.strokeStyle = color;
          c.lineWidth = width;
          c.lineCap = "round";
          c.beginPath();
          c.moveTo(r, r);
          c.lineTo(r + Math.cos(angle) * len, r + Math.sin(angle) * len);
          c.stroke();
        };
        const m = d.getMinutes();
        const h = (d.getHours() % 12) + m / 60;
        hand((h / 12) * Math.PI * 2 - Math.PI / 2, r * 0.45, 16, "#24272b");
        hand((m / 60) * Math.PI * 2 - Math.PI / 2, r * 0.66, 10, "#24272b");
        c.fillStyle = "#24272b";
        c.beginPath();
        c.arc(r, r, 14, 0, Math.PI * 2);
        c.fill();
      });
      const g = k.group([
        k.cyl(0.19, 0.19, 0.04, k.paint(o.color ?? "#2a2d31", 0.5), { at: [0, 0.19, 0.02], rot: [Math.PI / 2, 0, 0], seg: 48 }),
        k.disc(0.17, k.print(face, { roughness: 0.6 }), { at: [0, 0.19, 0.0405] }),
        k.cyl(0.172, 0.172, 0.006, k.glass(), { at: [0, 0.19, 0.046], rot: [Math.PI / 2, 0, 0], seg: 48 }),
      ]);
      return g;
    },
  },
};
