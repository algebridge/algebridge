/**
 * The last seventeen pieces: the robot, the telescope, the disco ball, the
 * neon sign, the grand piano, the science lab, the gaming chair, the record
 * wall, the wall bike, the drum kit, the projector screen, the battle
 * station, the jukebox, the DJ booth, the indoor slide, the block castle and
 * the hologram table. Real proportions and real materials, like the rest;
 * where a piece can show something true it does (the neon sign reads the
 * streak, the screens show the skill the student is on).
 */

import * as THREE from "three";
import { canvasTexture } from "../kit";
import type { Kit, V3 } from "../kit";
import type { BuildOptions, ItemModel } from "../types";

const PI = Math.PI;
const FONT = "Inter, system-ui, sans-serif";

/** A fixed random source, so a piece looks the same on every load. */
function seeded(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A rod between two points. */
function rod(k: Kit, a: V3, b: V3, r: number, m: THREE.Material, seg = 12): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const mesh = k.cyl(r, r, len, m, { seg });
  mesh.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return mesh;
}

/** A material of one flat colour that glows and is see-through, for light itself (a hologram, a beam). */
function lightMat(k: Kit, color: string, opacity: number, on: boolean): THREE.MeshStandardMaterial {
  const t = canvasTexture(4, 4, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 4, 4);
  });
  const m = k.print(t, { glow: on ? 1.6 : 0.2 }) as THREE.MeshStandardMaterial;
  m.color.set(color);
  m.emissive.set(color);
  m.transparent = true;
  m.opacity = on ? opacity : opacity * 0.25;
  m.depthWrite = false;
  m.side = THREE.DoubleSide;
  return m;
}

/** A screen's picture: the skill the student is on, as a slide. */
function lessonSlide(o: BuildOptions, w = 1024, h = 576): THREE.Texture {
  return canvasTexture(w, h, (g) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#1e3a8a");
    grad.addColorStop(1, "#0f172a");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#93c5fd";
    g.font = `600 ${h * 0.06}px ${FONT}`;
    g.fillText("ALGEBRA 1", w * 0.07, h * 0.16);
    g.fillStyle = "#ffffff";
    g.font = `700 ${h * 0.1}px ${FONT}`;
    const title = o.live.skillTitle ?? "Your next skill";
    g.fillText(title.length > 26 ? `${title.slice(0, 25)}...` : title, w * 0.07, h * 0.32);
    // A worked line on axes.
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 3;
    const ox = w * 0.62;
    const oy = h * 0.82;
    g.beginPath();
    g.moveTo(w * 0.5, oy);
    g.lineTo(w * 0.93, oy);
    g.moveTo(ox, h * 0.42);
    g.lineTo(ox, h * 0.92);
    g.stroke();
    g.strokeStyle = "#fbbf24";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(w * 0.52, h * 0.9);
    g.lineTo(w * 0.9, h * 0.46);
    g.stroke();
    g.fillStyle = "#e2e8f0";
    g.font = `500 ${h * 0.055}px ${FONT}`;
    g.fillText("y = mx + b", w * 0.07, h * 0.52);
    g.fillText("Rise over run", w * 0.07, h * 0.62);
  });
}

// ---------------------------------------------------------------------------

export const EXTRA_ITEMS: Record<string, ItemModel> = {
  // ── Tutor Bot: a service robot on wheels, a tablet in its chest ─────────
  robot: {
    size: [0.62, 1.2, 0.5],
    build(k, o) {
      const shell = k.plastic(o.color ?? "#f2f3f5", 0.75);
      const dark = k.plastic("#25282d", 0.5);
      const steel = k.metal("steel", 0.3);
      const eye = k.glow("#5ee6ff", true, 2.6);
      const g = new THREE.Group();
      // Base with three wheels.
      g.add(k.cyl(0.25, 0.27, 0.12, dark, { at: [0, 0.1, 0], seg: 40 }));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2 + PI / 6;
        g.add(k.cyl(0.045, 0.045, 0.04, k.rubber("#1b1c1f"), { at: [Math.cos(a) * 0.17, 0.045, Math.sin(a) * 0.17], rot: [0, -a, PI / 2], seg: 20 }));
      }
      // Body: a rounded capsule, wider at the hips.
      g.add(k.lathe([[0.0001, 0.16], [0.22, 0.17], [0.24, 0.3], [0.225, 0.55], [0.19, 0.72], [0.12, 0.78], [0.0001, 0.785]], shell, { seg: 48 }));
      // Chest tablet, angled up a little, showing a hint.
      const hint = canvasTexture(512, 360, (c, w, h) => {
        c.fillStyle = "#0b1220";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#5ee6ff";
        c.font = `700 70px ${FONT}`;
        c.textAlign = "center";
        c.fillText("Need a hint?", w / 2, h * 0.42);
        c.fillStyle = "#cbd5e1";
        c.font = `500 44px ${FONT}`;
        c.fillText("Ask Archie", w / 2, h * 0.72);
      });
      g.add(k.box(0.26, 0.19, 0.02, dark, { at: [0, 0.5, 0.215], rot: [-0.18, 0, 0], r: 0.008 }));
      g.add(k.plane(0.235, 0.165, k.screen(true, hint), { at: [0, 0.5, 0.227], rot: [-0.18, 0, 0] }));
      // Neck and head with a dark visor and two eyes.
      g.add(k.cyl(0.05, 0.06, 0.08, steel, { at: [0, 0.82, 0], seg: 20 }));
      g.add(k.sphere(1, shell, { at: [0, 0.98, 0], scale: [0.17, 0.15, 0.16], seg: 40 }));
      g.add(k.sphere(1, k.plastic("#0e1013", 0.95), { at: [0, 0.985, 0.045], scale: [0.14, 0.095, 0.12], seg: 40 }));
      for (const sx of [-1, 1]) g.add(k.sphere(1, eye, { at: [sx * 0.05, 0.995, 0.158], scale: [0.022, 0.03, 0.01], seg: 16 }));
      // Ears and an antenna.
      for (const sx of [-1, 1]) g.add(k.cyl(0.035, 0.035, 0.03, dark, { at: [sx * 0.168, 0.98, 0], rot: [0, 0, PI / 2], seg: 20 }));
      g.add(rod(k, [0.06, 1.1, 0], [0.09, 1.2, -0.01], 0.006, steel));
      g.add(k.sphere(0.018, k.glow("#ff7a59", true, 2), { at: [0.09, 1.205, -0.01], seg: 14 }));
      // Arms: shoulder, upper arm, forearm, a gripper hand.
      for (const sx of [-1, 1]) {
        g.add(k.sphere(0.055, dark, { at: [sx * 0.235, 0.66, 0], seg: 20 }));
        g.add(rod(k, [sx * 0.25, 0.65, 0], [sx * 0.3, 0.47, 0.06], 0.035, shell));
        g.add(k.sphere(0.04, dark, { at: [sx * 0.3, 0.47, 0.06], seg: 18 }));
        g.add(rod(k, [sx * 0.3, 0.47, 0.06], [sx * 0.29, 0.33, 0.18], 0.032, shell));
        g.add(k.box(0.05, 0.07, 0.04, dark, { at: [sx * 0.29, 0.3, 0.2], r: 0.012 }));
      }
      return g;
    },
  },

  // ── Star Telescope: a refractor on a wooden tripod ──────────────────────
  telescope: {
    size: [0.75, 1.5, 0.95],
    build(k, o) {
      const wood = k.wood("#b98a5a", { gloss: 0.35 });
      const metal = k.metal("black", 0.4);
      const chrome = k.metal("chrome", 0.15);
      const tube = k.paint(o.color ?? "#f4f4f2", 0.75);
      const g = new THREE.Group();
      const head: V3 = [0, 1.02, 0];
      // Three legs, splayed, with a spreader tray between them.
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2 + PI / 2;
        const foot: V3 = [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36];
        g.add(rod(k, foot, [head[0] + Math.cos(a) * 0.05, head[1], head[2] + Math.sin(a) * 0.05], 0.018, wood, 10));
        g.add(k.cyl(0.02, 0.022, 0.03, k.rubber("#1d1d1d"), { at: [foot[0], 0.015, foot[2]], seg: 12 }));
        g.add(rod(k, [Math.cos(a) * 0.19, 0.52, Math.sin(a) * 0.19], [0, 0.52, 0], 0.008, chrome, 8));
      }
      g.add(k.cyl(0.12, 0.12, 0.012, metal, { at: [0, 0.53, 0], seg: 6 }));
      // The mount: a head, an axis, a counterweight bar.
      g.add(k.cyl(0.075, 0.08, 0.06, metal, { at: [0, 1.05, 0], seg: 24 }));
      g.add(k.box(0.09, 0.12, 0.1, metal, { at: [0, 1.13, 0], rot: [0.5, 0, 0], r: 0.01 }));
      g.add(rod(k, [0, 1.13, 0], [0, 0.92, -0.16], 0.008, chrome));
      g.add(k.cyl(0.04, 0.04, 0.06, chrome, { at: [0, 0.9, -0.17], rot: [0.75, 0, 0], seg: 20 }));
      // The tube, pointed at the sky, with a dew shield, a finder and an eyepiece.
      const scope = new THREE.Group();
      scope.add(k.cyl(0.05, 0.05, 0.85, tube, { at: [0, 0, 0], seg: 32 }));
      scope.add(k.cyl(0.062, 0.062, 0.2, metal, { at: [0, 0.48, 0], seg: 32 }));
      scope.add(k.cyl(0.058, 0.058, 0.004, k.glass("#9fc1d6", 0.5), { at: [0, 0.578, 0], seg: 32 }));
      scope.add(k.cyl(0.035, 0.03, 0.08, metal, { at: [0, -0.46, 0], seg: 20 }));
      scope.add(k.cyl(0.012, 0.012, 0.1, metal, { at: [0, -0.5, 0.04], rot: [0.9, 0, 0], seg: 12 }));
      scope.add(k.cyl(0.018, 0.016, 0.06, k.rubber("#111"), { at: [0, -0.54, 0.08], rot: [0.9, 0, 0], seg: 14 }));
      scope.add(k.cyl(0.016, 0.016, 0.18, metal, { at: [0.065, 0.12, 0], seg: 14 }));
      for (const y of [0.05, 0.2]) scope.add(k.box(0.03, 0.012, 0.012, metal, { at: [0.045, y, 0] }));
      // Tube rings.
      for (const y of [-0.15, 0.2]) scope.add(k.torus(0.054, 0.008, metal, { at: [0, y, 0], rot: [PI / 2, 0, 0], seg: 28 }));
      scope.position.set(0, 1.18, 0.02);
      scope.rotation.x = 0.95;
      g.add(scope);
      return g;
    },
  },

  // ── Disco Ball: mirror tiles on a turning motor, hung from the ceiling ──
  "disco-ball": {
    size: [0.42, 0.62, 0.42],
    ceiling: true,
    light: { at: [0, -0.42, 0], color: "#f2e8ff", intensity: 1.6, distance: 5 },
    build(k, o) {
      const chrome = k.metal("chrome", 0.2);
      const tiles = canvasTexture(1024, 512, (g, w, h) => {
        const rnd = seeded(41);
        const n = 48;
        const m = 24;
        for (let i = 0; i < n; i += 1)
          for (let j = 0; j < m; j += 1) {
            const v = 150 + Math.floor(rnd() * 105);
            g.fillStyle = `rgb(${v},${v},${v + 6})`;
            g.fillRect((i * w) / n + 1, (j * h) / m + 1, w / n - 2, h / m - 2);
          }
        g.fillStyle = "#2a2a2e";
        for (let i = 0; i <= n; i += 1) g.fillRect((i * w) / n - 1, 0, 2, h);
        for (let j = 0; j <= m; j += 1) g.fillRect(0, (j * h) / m - 1, w, 2);
      });
      const mirror = k.print(tiles, { roughness: 0.12 }) as THREE.MeshStandardMaterial;
      mirror.metalness = 1;
      if (o.color) mirror.color.set(o.color);
      const g = new THREE.Group();
      g.add(k.cyl(0.06, 0.06, 0.02, k.paint("#f2f2f0", 0.4), { at: [0, -0.01, 0], seg: 24 }));
      g.add(rod(k, [0, -0.02, 0], [0, -0.3, 0], 0.004, chrome, 8));
      g.add(k.cyl(0.035, 0.035, 0.07, k.plastic("#1f2125", 0.5), { at: [0, -0.33, 0], seg: 20 }));
      g.add(k.sphere(0.18, mirror, { at: [0, -0.55, 0], seg: 48 }));
      return g;
    },
  },

  // ── Neon Math Sign: the streak, in light, on clear acrylic ──────────────
  "neon-sign": {
    size: [0.95, 0.46, 0.06],
    wall: true,
    light: { at: [0, 0.23, 0.25], color: "#ff4fa3", intensity: 1.4, distance: 3 },
    build(k, o) {
      const tube = o.color ?? "#ff4fa3";
      const days = Math.max(0, o.live.streak);
      const art = canvasTexture(1024, 512, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const glowText = (text: string, font: string, y: number, color: string) => {
          g.font = font;
          g.textAlign = "center";
          g.lineJoin = "round";
          if (o.on) {
            g.shadowColor = color;
            g.shadowBlur = 38;
          }
          g.strokeStyle = o.on ? color : "#9a8f95";
          g.lineWidth = 14;
          g.strokeText(text, w / 2, y);
          g.shadowBlur = 0;
          g.strokeStyle = o.on ? "#ffffff" : "#c7c1c4";
          g.lineWidth = 4;
          g.strokeText(text, w / 2, y);
        };
        glowText("keep going", `italic 600 120px Georgia, serif`, h * 0.4, o.on ? "#7df9ff" : "#9a8f95");
        glowText(`${days} DAY STREAK`, `800 118px ${FONT}`, h * 0.82, tube);
      });
      const face = k.print(art, { glow: o.on ? 1.4 : 0, roughness: 0.4 }) as THREE.MeshStandardMaterial;
      face.transparent = true;
      face.alphaTest = 0.02;
      face.depthWrite = false;
      const g = new THREE.Group();
      // Clear acrylic backer on four chrome standoffs.
      g.add(k.box(0.95, 0.46, 0.008, k.glass("#e9f3f6", 0.16), { at: [0, 0.23, 0.04], r: 0.006 }));
      for (const [x, y] of [[-0.43, 0.03], [0.43, 0.03], [-0.43, 0.43], [0.43, 0.43]] as const) g.add(k.cyl(0.012, 0.012, 0.04, k.metal("chrome", 0.15), { at: [x, y, 0.02], rot: [PI / 2, 0, 0], seg: 12 }));
      g.add(k.plane(0.93, 0.465, face, { at: [0, 0.23, 0.047] }));
      // The transformer and its cable.
      g.add(k.box(0.08, 0.05, 0.03, k.plastic("#1d1f22"), { at: [0.36, 0.2, 0.025], r: 0.006 }));
      return g;
    },
  },

  // ── Grand Piano: lid up, keys, lyre, a bench ────────────────────────────
  piano: {
    size: [1.5, 1.45, 2.05],
    build(k, o) {
      const lacquer = k.paint(o.color ?? "#0d0d0f", 0.95);
      const brass = k.metal("brass", 0.25);
      const g = new THREE.Group();
      // The case outline: straight bass side, the curved bentside, the tail.
      const outline: [number, number][] = [];
      outline.push([-0.72, 0.0], [0.72, 0.0], [0.72, -0.35]);
      for (let i = 0; i <= 16; i += 1) {
        const t = i / 16;
        const x = 0.72 - t * 0.9;
        const z = -0.35 - Math.sin((t * PI) / 2) * 0.55 - t * 0.55;
        outline.push([x, z]);
      }
      outline.push([-0.38, -1.62], [-0.72, -1.45]);
      const shape = outline.map(([x, z]) => [x, -z] as [number, number]);
      const caseMesh = k.extrude(shape, 0.32, lacquer, { bevel: 0.01 });
      caseMesh.rotation.x = -PI / 2;
      caseMesh.position.set(0, 0.66, 0.35);
      g.add(caseMesh);
      // Lid, propped open on its stick.
      const lid = k.extrude(shape, 0.02, lacquer, { bevel: 0.004 });
      const lidPivot = new THREE.Group();
      lid.rotation.x = -PI / 2;
      lid.position.set(0.72, 0, 0);
      lidPivot.add(lid);
      lidPivot.position.set(-0.72, 0.99, 0.35);
      lidPivot.rotation.z = 0.62;
      g.add(lidPivot);
      g.add(rod(k, [0.42, 0.98, -0.55], [0.36, 1.6, -0.55], 0.008, lacquer, 8));
      // The inside: the gold harp plate, the case's own shape a little inside it.
      const plate = k.extrude(shape, 0.01, k.metal("#b8975a", 0.35), { bevel: 0.002 });
      plate.rotation.x = -PI / 2;
      plate.scale.set(0.9, 0.9, 1);
      plate.position.set(0, 0.93, 0.29);
      g.add(plate);
      // Keyboard: the key bed, white keys as one block with a printed gap pattern, black keys raised.
      const keys = canvasTexture(1024, 64, (c, w, h) => {
        c.fillStyle = "#f6f3ea";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#b8b2a6";
        for (let i = 0; i <= 52; i += 1) c.fillRect((i * w) / 52, 0, 2, h);
      });
      g.add(k.box(1.3, 0.14, 0.3, lacquer, { at: [0, 0.7, 0.5], r: 0.01 }));
      const keyTop = k.box(1.22, 0.025, 0.15, k.print(keys, { roughness: 0.35 }), { at: [0, 0.785, 0.55] });
      g.add(keyTop);
      const black = k.plastic("#111214", 0.8);
      const pattern = [1, 1, 0, 1, 1, 1, 0];
      for (let i = 0; i < 51; i += 1) if (pattern[i % 7]) g.add(k.box(0.012, 0.012, 0.09, black, { at: [-0.61 + ((i + 1) * 1.22) / 52, 0.803, 0.52] }));
      for (const sx of [-1, 1]) g.add(k.box(0.05, 0.08, 0.32, lacquer, { at: [sx * 0.64, 0.79, 0.5], r: 0.01 }));
      // The music stand, with a page of music.
      const music = canvasTexture(256, 180, (c, w, h) => {
        c.fillStyle = "#f7f3e8";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#333";
        c.lineWidth = 1;
        for (let s = 0; s < 4; s += 1) for (let l = 0; l < 5; l += 1) c.fillRect(12, 22 + s * 40 + l * 5, w - 24, 1);
        c.fillStyle = "#222";
        const rnd = seeded(3);
        for (let s = 0; s < 4; s += 1) for (let n = 0; n < 9; n += 1) c.fillRect(24 + n * 24, 22 + s * 40 + Math.floor(rnd() * 5) * 5 - 2, 5, 5);
      });
      g.add(k.box(0.7, 0.24, 0.015, lacquer, { at: [0, 1.06, 0.32], rot: [-0.25, 0, 0], r: 0.004 }));
      g.add(k.plane(0.3, 0.2, k.print(music, { roughness: 0.9 }), { at: [0, 1.07, 0.33], rot: [-0.25, 0, 0] }));
      // Three turned legs on brass casters, and the pedal lyre.
      const leg: [number, number][] = [[0.0001, 0], [0.045, 0], [0.05, 0.05], [0.04, 0.12], [0.055, 0.3], [0.05, 0.45], [0.065, 0.52], [0.0001, 0.53]];
      for (const [x, z] of [[-0.6, 0.45], [0.6, 0.45], [-0.1, -1.1]] as const) {
        g.add(k.lathe(leg, lacquer, { at: [x, 0.02, z], seg: 20 }));
        g.add(k.sphere(0.025, brass, { at: [x, 0.02, z], seg: 12 }));
      }
      g.add(k.box(0.16, 0.5, 0.06, lacquer, { at: [0, 0.27, 0.18], r: 0.01 }));
      for (const x of [-0.05, 0, 0.05]) g.add(k.box(0.025, 0.012, 0.09, brass, { at: [x, 0.045, 0.24], r: 0.004 }));
      // The bench.
      const bench = new THREE.Group();
      bench.add(k.box(0.8, 0.07, 0.36, lacquer, { at: [0, 0.48, 0], r: 0.012 }));
      bench.add(k.cushion(0.76, 0.05, 0.32, k.leather("#1c1c1e"), { at: [0, 0.535, 0] }));
      bench.add(k.legs(0.78, 0.34, 0.45, lacquer, { r: 0.022, inset: 0.03 }));
      bench.position.set(0, 0, 0.9);
      g.add(bench);
      return g;
    },
  },

  // ── Mini Science Lab: a bench with glassware and a microscope ───────────
  "science-lab": {
    size: [1.4, 1.75, 0.66],
    build(k, o) {
      const cabinet = k.paint(o.color ?? "#e9ece9", 0.5);
      const top = k.stone("slate");
      const steel = k.metal("steel", 0.3);
      const g = new THREE.Group();
      // The bench: cabinets, drawers with handles, a black worktop, a shelf above.
      g.add(k.box(1.4, 0.82, 0.62, cabinet, { at: [0, 0.41, 0], r: 0.01 }));
      g.add(k.box(1.36, 0.06, 0.6, k.paint("#2b2e31", 0.2), { at: [0, 0.03, 0.03] }));
      for (const [x, w] of [[-0.46, 0.42], [0, 0.42], [0.46, 0.42]] as const) {
        for (const y of [0.62, 0.38]) {
          g.add(k.box(w, 0.2, 0.01, cabinet, { at: [x, y, 0.315], r: 0.004 }));
          g.add(k.box(0.12, 0.014, 0.02, steel, { at: [x, y + 0.05, 0.33], r: 0.006 }));
        }
      }
      g.add(k.box(1.46, 0.04, 0.66, top, { at: [0, 0.84, 0], r: 0.006 }));
      for (const sx of [-1, 1]) g.add(k.box(0.03, 0.7, 0.24, cabinet, { at: [sx * 0.68, 1.21, -0.2] }));
      g.add(k.box(1.39, 0.03, 0.26, cabinet, { at: [0, 1.32, -0.2] }));
      g.add(k.box(1.39, 0.03, 0.26, cabinet, { at: [0, 1.56, -0.2] }));
      g.add(k.box(1.39, 0.62, 0.01, cabinet, { at: [0, 1.22, -0.325] }));
      // Glassware with coloured liquids.
      const glass = k.glass("#e4f1f4", 0.28);
      const flask = (x: number, y: number, z: number, s: number, liquid: string) => {
        const f = new THREE.Group();
        f.add(k.lathe([[0.0001, 0], [0.06, 0], [0.062, 0.01], [0.045, 0.07], [0.016, 0.12], [0.016, 0.17], [0.019, 0.175]], glass, { seg: 28 }));
        f.add(k.lathe([[0.0001, 0.003], [0.056, 0.003], [0.058, 0.012], [0.04, 0.058], [0.0001, 0.058]], k.glass(liquid, 0.75), { seg: 28 }));
        f.position.set(x, y, z);
        f.scale.setScalar(s);
        return f;
      };
      const beaker = (x: number, y: number, z: number, liquid: string, fill: number) => {
        const b = new THREE.Group();
        b.add(k.cyl(0.04, 0.038, 0.11, glass, { at: [0, 0.055, 0], seg: 24, open: true }));
        b.add(k.cyl(0.036, 0.036, 0.1 * fill, k.glass(liquid, 0.7), { at: [0, 0.05 * fill + 0.003, 0], seg: 24 }));
        b.position.set(x, y, z);
        return b;
      };
      g.add(flask(-0.5, 0.86, 0.1, 1.1, "#3fbf7f"), flask(-0.32, 0.86, 0.05, 0.9, "#e0457b"), beaker(0.28, 0.86, 0.12, "#4f8df7", 0.6));
      g.add(flask(-0.45, 1.335, -0.2, 0.8, "#f2b134"), beaker(-0.2, 1.335, -0.18, "#9b5de5", 0.5), flask(0.3, 1.575, -0.2, 0.7, "#3fbf7f"));
      // A rack of test tubes.
      const rack = new THREE.Group();
      rack.add(k.box(0.24, 0.02, 0.06, k.wood("maple"), { at: [0, 0.01, 0] }), k.box(0.24, 0.02, 0.06, k.wood("maple"), { at: [0, 0.08, 0] }));
      for (const sx of [-1, 1]) rack.add(k.box(0.012, 0.09, 0.06, k.wood("maple"), { at: [sx * 0.114, 0.045, 0] }));
      ["#e0457b", "#4f8df7", "#3fbf7f", "#f2b134", "#9b5de5"].forEach((c, i) => {
        rack.add(k.cyl(0.011, 0.011, 0.14, glass, { at: [-0.08 + i * 0.04, 0.08, 0], seg: 14 }));
        rack.add(k.cyl(0.0095, 0.0095, 0.06, k.glass(c, 0.8), { at: [-0.08 + i * 0.04, 0.04, 0], seg: 14 }));
      });
      rack.position.set(0.0, 0.86, 0.12);
      g.add(rack);
      // A microscope.
      const scope = new THREE.Group();
      const scopeBody = k.paint("#f4f4f2", 0.6);
      scope.add(k.box(0.14, 0.03, 0.18, scopeBody, { at: [0, 0.015, 0], r: 0.01 }));
      scope.add(k.box(0.05, 0.22, 0.05, scopeBody, { at: [0, 0.13, -0.06], rot: [0.2, 0, 0], r: 0.01 }));
      scope.add(k.box(0.1, 0.012, 0.1, k.paint("#2b2e31"), { at: [0, 0.1, 0.01] }));
      scope.add(k.cyl(0.02, 0.022, 0.14, scopeBody, { at: [0, 0.23, 0.0], rot: [-0.45, 0, 0], seg: 18 }));
      scope.add(k.cyl(0.012, 0.012, 0.05, k.metal("black"), { at: [0, 0.31, -0.035], rot: [-0.45, 0, 0], seg: 14 }));
      scope.add(k.cyl(0.01, 0.008, 0.04, steel, { at: [0, 0.14, 0.02], seg: 12 }));
      scope.position.set(0.55, 0.86, 0.05);
      scope.rotation.y = -0.4;
      g.add(scope);
      // A Bunsen burner.
      g.add(k.cyl(0.035, 0.04, 0.012, steel, { at: [0.1, 0.866, -0.1], seg: 20 }));
      g.add(k.cyl(0.01, 0.012, 0.13, steel, { at: [0.1, 0.93, -0.1], seg: 14 }));
      return g;
    },
  },

  // ── Gaming Chair: a racing bucket seat on a five-star base ──────────────
  "gaming-chair": {
    size: [0.7, 1.38, 0.72],
    build(k, o) {
      const accent = o.color ?? "#c8102e";
      const leather = k.leather("#17181b");
      const trim = k.leather(accent);
      const base = k.metal("black", 0.35);
      const g = new THREE.Group();
      // Five-star base, casters, gas lift.
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * PI * 2;
        g.add(rod(k, [0, 0.11, 0], [Math.cos(a) * 0.33, 0.07, Math.sin(a) * 0.33], 0.022, base));
        g.add(k.sphere(0.03, k.plastic("#111", 0.5), { at: [Math.cos(a) * 0.33, 0.03, Math.sin(a) * 0.33], seg: 14 }));
      }
      g.add(k.cyl(0.05, 0.05, 0.07, base, { at: [0, 0.12, 0], seg: 20 }));
      g.add(k.cyl(0.024, 0.024, 0.24, k.metal("chrome", 0.2), { at: [0, 0.27, 0], seg: 16 }));
      g.add(k.box(0.24, 0.05, 0.22, base, { at: [0, 0.4, 0], r: 0.01 }));
      // The seat: a bucket with raised side bolsters and coloured piping.
      g.add(k.cushion(0.52, 0.1, 0.5, leather, { at: [0, 0.47, 0.02] }));
      for (const sx of [-1, 1]) g.add(k.cushion(0.08, 0.1, 0.5, trim, { at: [sx * 0.24, 0.5, 0.02] }));
      // The back: tall, with wings, a headrest pillow and a lumbar pillow.
      const back = new THREE.Group();
      back.add(k.cushion(0.5, 0.86, 0.12, leather, { at: [0, 0.43, 0] }));
      for (const sx of [-1, 1]) back.add(k.cushion(0.08, 0.66, 0.14, trim, { at: [sx * 0.25, 0.36, 0.02] }));
      back.add(k.cushion(0.26, 0.12, 0.08, trim, { at: [0, 0.78, 0.08] }));
      back.add(k.cushion(0.3, 0.14, 0.09, leather, { at: [0, 0.22, 0.08] }));
      // Slots in the top of the back, as racing seats have.
      for (const sx of [-1, 1]) back.add(k.box(0.04, 0.1, 0.13, k.paint("#050505"), { at: [sx * 0.11, 0.7, 0] }));
      back.position.set(0, 0.5, -0.24);
      back.rotation.x = -0.12;
      g.add(back);
      // Armrests.
      for (const sx of [-1, 1]) {
        g.add(k.box(0.04, 0.2, 0.04, base, { at: [sx * 0.3, 0.6, 0], r: 0.008 }));
        g.add(k.box(0.08, 0.035, 0.26, k.rubber("#1a1a1a"), { at: [sx * 0.3, 0.71, 0.02], r: 0.012 }));
      }
      return g;
    },
  },

  // ── Record Wall: six sleeves on ledges, the covers facing out ───────────
  "vinyl-wall": {
    size: [1.25, 0.9, 0.08],
    wall: true,
    build(k, o) {
      const ledgeM = k.wood(o.color ?? "walnut", { gloss: 0.3 });
      const g = new THREE.Group();
      const covers: ((c: CanvasRenderingContext2D, w: number, h: number) => void)[] = [
        (c, w, h) => {
          c.fillStyle = "#f2c14e";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#e4572e";
          c.beginPath();
          c.arc(w / 2, h / 2, w * 0.3, 0, PI * 2);
          c.fill();
        },
        (c, w, h) => {
          c.fillStyle = "#0b132b";
          c.fillRect(0, 0, w, h);
          c.strokeStyle = "#5bc0be";
          c.lineWidth = 8;
          for (let i = 0; i < 6; i += 1) {
            c.beginPath();
            c.arc(w * 0.3, h * 0.7, 30 + i * 22, -PI / 2, 0);
            c.stroke();
          }
        },
        (c, w, h) => {
          const gr = c.createLinearGradient(0, 0, w, h);
          gr.addColorStop(0, "#ff7eb3");
          gr.addColorStop(1, "#7afcff");
          c.fillStyle = gr;
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#ffffff";
          c.font = `800 46px ${FONT}`;
          c.fillText("y = x²", 20, h - 30);
        },
        (c, w, h) => {
          c.fillStyle = "#eae2d6";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#1f1f1f";
          for (let i = 0; i < 7; i += 1) c.fillRect(20 + i * 30, 30 + (i % 3) * 30, 14, h - 90 - (i % 3) * 30);
        },
        (c, w, h) => {
          c.fillStyle = "#2d6a4f";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#95d5b2";
          c.beginPath();
          c.moveTo(0, h);
          c.lineTo(w * 0.5, h * 0.3);
          c.lineTo(w, h);
          c.fill();
        },
        (c, w, h) => {
          c.fillStyle = "#14213d";
          c.fillRect(0, 0, w, h);
          c.strokeStyle = "#fca311";
          c.lineWidth = 6;
          c.strokeRect(30, 30, w - 60, h - 60);
          c.fillStyle = "#fca311";
          c.font = `700 40px ${FONT}`;
          c.fillText("PI", 50, 90);
        },
      ];
      for (let row = 0; row < 2; row += 1) {
        const y = 0.04 + row * 0.44;
        g.add(k.box(1.22, 0.025, 0.08, ledgeM, { at: [0, y, 0.04], r: 0.004 }));
        g.add(k.box(1.22, 0.035, 0.012, ledgeM, { at: [0, y + 0.03, 0.075], r: 0.003 }));
        for (let i = 0; i < 3; i += 1) {
          const art = canvasTexture(256, 256, covers[row * 3 + i]);
          const sleeve = new THREE.Group();
          sleeve.add(k.box(0.31, 0.31, 0.006, k.paper("#efe9df"), { at: [0, 0.155, 0] }));
          sleeve.add(k.plane(0.31, 0.31, k.print(art, { roughness: 0.6 }), { at: [0, 0.155, 0.0031] }));
          sleeve.position.set(-0.4 + i * 0.4, y + 0.013, 0.03);
          sleeve.rotation.x = -0.06;
          g.add(sleeve);
        }
      }
      return g;
    },
  },

  // ── Wall Bike: a road bike hung level on two wall hooks ─────────────────
  bike: {
    size: [1.72, 0.98, 0.42],
    wall: true,
    build(k, o) {
      const frameM = k.paint(o.color ?? "#1f6fb2", 0.85);
      const black = k.metal("black", 0.4);
      const chrome = k.metal("chrome", 0.2);
      const tire = k.rubber("#1a1a1a");
      const g = new THREE.Group();
      const z = 0.22;
      const R = 0.34;
      const rear: V3 = [-0.5, 0.4, z];
      const front: V3 = [0.5, 0.4, z];
      const wheel = (c: V3) => {
        const w = new THREE.Group();
        w.add(k.torus(R, 0.014, tire, { seg: 48 }));
        w.add(k.torus(R - 0.018, 0.008, chrome, { seg: 48 }));
        w.add(k.cyl(0.022, 0.022, 0.06, chrome, { rot: [PI / 2, 0, 0], seg: 14 }));
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * PI * 2;
          w.add(rod(k, [0, 0, i % 2 ? 0.02 : -0.02], [Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), 0], 0.0015, chrome, 4));
        }
        w.position.set(...c);
        return w;
      };
      g.add(wheel(rear), wheel(front));
      // The frame: the main triangle and the rear stays.
      const bb: V3 = [-0.08, 0.36, z];
      const seatTop: V3 = [-0.18, 0.78, z];
      const headTop: V3 = [0.4, 0.78, z];
      const headBot: V3 = [0.43, 0.66, z];
      g.add(rod(k, bb, seatTop, 0.017, frameM), rod(k, seatTop, headTop, 0.016, frameM), rod(k, bb, headBot, 0.019, frameM), rod(k, headBot, headTop, 0.022, frameM));
      g.add(rod(k, bb, rear, 0.011, frameM), rod(k, seatTop, rear, 0.011, frameM));
      g.add(rod(k, headBot, front, 0.013, frameM));
      // Saddle, bars, chainring, pedals.
      g.add(rod(k, seatTop, [-0.2, 0.86, z], 0.012, chrome));
      g.add(k.box(0.26, 0.04, 0.12, k.leather("#141414"), { at: [-0.21, 0.885, z], r: 0.018 }));
      g.add(rod(k, headTop, [0.42, 0.86, z], 0.013, black));
      g.add(rod(k, [0.42, 0.86, z - 0.2], [0.42, 0.86, z + 0.2], 0.012, k.rubber("#222")));
      for (const s of [-1, 1]) g.add(k.torus(0.05, 0.011, k.rubber("#222"), { at: [0.47, 0.82, z + s * 0.2], rot: [0, 0, 0], arc: PI, seg: 16 }));
      g.add(k.cyl(0.1, 0.1, 0.008, chrome, { at: [-0.08, 0.36, z + 0.04], rot: [PI / 2, 0, 0], seg: 36 }));
      g.add(rod(k, [-0.08, 0.36, z + 0.05], [-0.08, 0.2, z + 0.08], 0.008, black));
      g.add(k.box(0.09, 0.015, 0.05, black, { at: [-0.08, 0.2, z + 0.1] }));
      // The chain, as a thin loop to the rear cog.
      g.add(rod(k, [-0.08, 0.45, z + 0.04], [-0.5, 0.44, z + 0.04], 0.004, black, 6), rod(k, [-0.08, 0.27, z + 0.04], [-0.5, 0.36, z + 0.04], 0.004, black, 6));
      // Two wall hooks under the top tube.
      for (const x of [-0.05, 0.25]) {
        g.add(k.box(0.05, 0.08, 0.02, black, { at: [x, 0.75, 0.01], r: 0.006 }));
        g.add(rod(k, [x, 0.74, 0.01], [x, 0.74, z + 0.02], 0.008, black));
      }
      return g;
    },
  },

  // ── Drum Kit: bass drum, toms, snare, hi-hat and two cymbals ────────────
  "drum-kit": {
    size: [1.55, 1.3, 1.25],
    build(k, o) {
      const shell = k.paint(o.color ?? "#7b1e2b", 0.9);
      const head = k.paint("#f1ede3", 0.15);
      const chrome = k.metal("chrome", 0.18);
      const bronze = k.metal("#b8893c", 0.28);
      const g = new THREE.Group();
      const drum = (r: number, depth: number, at: V3, rot: V3) => {
        const d = new THREE.Group();
        d.add(k.cyl(r, r, depth, shell, { seg: 40 }));
        for (const s of [-1, 1]) {
          d.add(k.cyl(r * 0.985, r * 0.985, 0.004, head, { at: [0, (s * depth) / 2, 0], seg: 40 }));
          d.add(k.torus(r, 0.007, chrome, { at: [0, (s * depth) / 2, 0], rot: [PI / 2, 0, 0], seg: 40 }));
        }
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * PI * 2;
          d.add(k.box(0.012, depth * 0.5, 0.016, chrome, { at: [Math.cos(a) * (r + 0.008), 0, Math.sin(a) * (r + 0.008)], r: 0.004 }));
        }
        d.position.set(...at);
        d.rotation.set(...rot);
        return d;
      };
      // Bass drum, on its side, with the band's name on the front head.
      g.add(drum(0.28, 0.42, [0, 0.29, 0], [PI / 2, 0, 0]));
      const logo = canvasTexture(256, 256, (c, w, h) => {
        c.fillStyle = "#f1ede3";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#1b1b1b";
        c.font = `800 40px ${FONT}`;
        c.textAlign = "center";
        c.fillText("THE", w / 2, h * 0.42);
        c.fillText("VARIABLES", w / 2, h * 0.6);
      });
      g.add(k.disc(0.27, k.print(logo, { roughness: 0.8 }), { at: [0, 0.29, 0.213] }));
      for (const sx of [-1, 1]) g.add(rod(k, [sx * 0.2, 0.12, 0.15], [sx * 0.32, 0.0, 0.25], 0.008, chrome));
      g.add(k.box(0.08, 0.02, 0.24, k.metal("black"), { at: [0, 0.03, -0.36], rot: [0.15, 0, 0], r: 0.006 }));
      g.add(rod(k, [0, 0.04, -0.25], [0, 0.26, -0.22], 0.006, chrome));
      // Two rack toms, a floor tom on legs, the snare on its stand.
      g.add(drum(0.12, 0.11, [-0.14, 0.7, -0.06], [-0.35, 0, 0.2]), drum(0.13, 0.12, [0.15, 0.71, -0.06], [-0.35, 0, -0.2]));
      g.add(rod(k, [0, 0.57, -0.05], [0, 0.66, -0.05], 0.012, chrome));
      g.add(drum(0.18, 0.3, [0.5, 0.42, -0.3], [0, 0, 0]));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2;
        g.add(rod(k, [0.5 + Math.cos(a) * 0.19, 0.48, -0.3 + Math.sin(a) * 0.19], [0.5 + Math.cos(a) * 0.24, 0, -0.3 + Math.sin(a) * 0.24], 0.008, chrome));
      }
      g.add(drum(0.17, 0.12, [-0.3, 0.62, -0.38], [-0.08, 0, 0]));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2;
        g.add(rod(k, [-0.3, 0.4, -0.38], [-0.3 + Math.cos(a) * 0.2, 0, -0.38 + Math.sin(a) * 0.2], 0.007, chrome));
      }
      g.add(rod(k, [-0.3, 0.4, -0.38], [-0.3, 0.56, -0.38], 0.01, chrome));
      // Hi-hat, crash, ride: thin bronze cymbals on stands.
      const cymbal = (r: number, at: V3, tilt: number) => {
        const c = k.lathe([[0.0001, 0.012], [0.03, 0.011], [r * 0.4, 0.005], [r, 0]], bronze, { seg: 40 });
        c.position.set(...at);
        c.rotation.x = tilt;
        return c;
      };
      const stand = (x: number, z: number, top: number) => {
        g.add(rod(k, [x, 0, z], [x, top, z], 0.009, chrome));
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * PI * 2;
          g.add(rod(k, [x, 0.25, z], [x + Math.cos(a) * 0.18, 0, z + Math.sin(a) * 0.18], 0.006, chrome));
        }
      };
      stand(-0.62, -0.3, 0.9);
      g.add(cymbal(0.18, [-0.62, 0.9, -0.3], 0), cymbal(0.18, [-0.62, 0.885, -0.3], PI));
      stand(-0.45, 0.1, 1.18);
      g.add(cymbal(0.22, [-0.45, 1.18, 0.1], -0.35));
      stand(0.6, 0.05, 1.06);
      g.add(cymbal(0.25, [0.6, 1.06, 0.05], -0.25));
      // The throne.
      g.add(k.cushion(0.34, 0.08, 0.34, k.leather("#141414"), { at: [0, 0.52, -0.72] }));
      g.add(rod(k, [0, 0.48, -0.72], [0, 0.05, -0.72], 0.016, chrome));
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * PI * 2 + PI / 6;
        g.add(rod(k, [0, 0.12, -0.72], [Math.cos(a) * 0.22, 0, -0.72 + Math.sin(a) * 0.22], 0.008, chrome));
      }
      return g;
    },
  },

  // ── Projector Screen: a pull-down screen showing the lesson ─────────────
  projector: {
    size: [1.75, 1.3, 0.12],
    wall: true,
    build(k, o) {
      const housing = k.paint("#ececea", 0.4);
      const g = new THREE.Group();
      g.add(k.box(1.75, 0.09, 0.1, housing, { at: [0, 1.25, 0.05], r: 0.03 }));
      for (const sx of [-1, 1]) g.add(k.box(0.02, 0.1, 0.11, k.plastic("#2a2c30"), { at: [sx * 0.88, 1.25, 0.05], r: 0.006 }));
      // The screen, with its black border; the lesson on it when it is on.
      g.add(k.box(1.62, 1.12, 0.004, k.paint("#151515", 0.1), { at: [0, 0.66, 0.07] }));
      const slide = lessonSlide(o);
      const face = o.on ? k.print(slide, { glow: 0.9, roughness: 0.9 }) : k.paint("#f4f4f2", 0.05);
      g.add(k.plane(1.52, 0.86, face, { at: [0, 0.72, 0.0725] }));
      g.add(k.box(1.62, 0.03, 0.03, k.metal("black"), { at: [0, 0.095, 0.07], r: 0.008 }));
      // Pull cord and its handle.
      g.add(rod(k, [0, 0.08, 0.07], [0, 0.0, 0.08], 0.003, k.plastic("#222")));
      g.add(k.torus(0.022, 0.006, k.plastic("#222"), { at: [0, -0.02, 0.08], seg: 16 }));
      return g;
    },
  },

  // ── Battle Station: a desk, two monitors, a glass-sided PC with three fans ─
  "pc-setup": {
    size: [1.6, 1.4, 0.78],
    light: { at: [0.6, 0.6, 0.1], color: "#7c5cff", intensity: 1.2, distance: 2.5 },
    build(k, o) {
      const desk = k.paint("#1b1c1f", 0.4);
      const rgb = o.color ?? "#7c5cff";
      const g = new THREE.Group();
      // The desk, with an LED strip along its front edge.
      g.add(k.box(1.6, 0.04, 0.75, desk, { at: [0, 0.74, 0], r: 0.008 }));
      g.add(k.box(1.56, 0.01, 0.01, k.glow(rgb, o.on, 2.4), { at: [0, 0.72, 0.37] }));
      for (const sx of [-1, 1]) {
        g.add(k.box(0.06, 0.72, 0.06, k.metal("black"), { at: [sx * 0.74, 0.36, 0], r: 0.01 }));
        g.add(k.box(0.06, 0.04, 0.7, k.metal("black"), { at: [sx * 0.74, 0.02, 0], r: 0.01 }));
      }
      g.add(k.box(1.45, 0.006, 0.42, k.fabric("#202226"), { at: [-0.05, 0.763, 0.08] }));
      // Two monitors on one arm: the lesson on the left, a game on the right.
      const game = canvasTexture(1024, 576, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#1a1033");
        gr.addColorStop(1, "#3b1f6e");
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#ffd166";
        for (let i = 0; i < 60; i += 1) c.fillRect((i * 97) % w, (i * 53) % (h * 0.6), 3, 3);
        c.fillStyle = "#06d6a0";
        c.fillRect(w * 0.1, h * 0.78, w * 0.8, 8);
        c.fillStyle = "#ef476f";
        c.fillRect(w * 0.45, h * 0.66, 50, 50);
        c.fillStyle = "#ffffff";
        c.font = `700 40px ${FONT}`;
        c.fillText("SCORE 4096", 30, 60);
      });
      const monitor = (x: number, yaw: number, pic: THREE.Texture) => {
        const m = new THREE.Group();
        m.add(k.box(0.62, 0.37, 0.03, k.plastic("#101114", 0.6), { at: [0, 0, 0], r: 0.008 }));
        m.add(k.plane(0.6, 0.34, k.screen(o.on, pic), { at: [0, 0.008, 0.0155] }));
        m.position.set(x, 1.08, -0.18);
        m.rotation.y = yaw;
        return m;
      };
      g.add(monitor(-0.33, 0.18, lessonSlide(o)), monitor(0.31, -0.18, game));
      g.add(k.box(0.05, 0.3, 0.05, k.metal("black"), { at: [0, 0.9, -0.3], r: 0.01 }), k.box(0.7, 0.03, 0.04, k.metal("black"), { at: [0, 1.06, -0.23], r: 0.01 }));
      g.add(k.box(0.18, 0.012, 0.14, k.metal("black"), { at: [0, 0.766, -0.3], r: 0.004 }));
      // Keyboard and mouse.
      const keys = canvasTexture(512, 160, (c, w, h) => {
        c.fillStyle = "#121316";
        c.fillRect(0, 0, w, h);
        for (let r = 0; r < 5; r += 1)
          for (let i = 0; i < 15; i += 1) {
            c.fillStyle = "#2a2c31";
            c.fillRect(6 + i * 33.5, 6 + r * 30, 29, 26);
          }
        if (o.on) {
          const gr = c.createLinearGradient(0, 0, w, 0);
          ["#ff3b6b", "#ffb703", "#3ddc97", "#38bdf8", "#a78bfa"].forEach((col, i) => gr.addColorStop(i / 4, col));
          c.globalAlpha = 0.35;
          c.fillStyle = gr;
          c.fillRect(0, 0, w, h);
        }
      });
      g.add(k.box(0.44, 0.025, 0.14, k.plastic("#121316"), { at: [-0.12, 0.775, 0.16], r: 0.006 }));
      g.add(k.plane(0.43, 0.13, k.print(keys, { glow: o.on ? 0.5 : 0, roughness: 0.5 }), { at: [-0.12, 0.7876, 0.16], rot: [-PI / 2, 0, 0] }));
      g.add(k.sphere(1, k.plastic("#121316", 0.8), { at: [0.25, 0.775, 0.16], scale: [0.032, 0.02, 0.055], seg: 20 }));
      // The tower: glass side, three glowing fans, a graphics card.
      const tower = new THREE.Group();
      const shell = k.paint("#0f1012", 0.5);
      tower.add(k.box(0.22, 0.48, 0.45, shell, { at: [0, 0.24, 0], r: 0.01 }));
      tower.add(k.box(0.005, 0.44, 0.41, k.glass("#9aa7b4", 0.18), { at: [-0.112, 0.24, 0] }));
      for (let i = 0; i < 3; i += 1) {
        tower.add(k.torus(0.055, 0.008, k.glow(rgb, o.on, 2.6), { at: [-0.06, 0.1 + i * 0.13, 0.215], rot: [0, 0, 0], seg: 28 }));
        tower.add(k.cyl(0.05, 0.05, 0.01, k.plastic("#1b1c20"), { at: [-0.06, 0.1 + i * 0.13, 0.21], rot: [PI / 2, 0, 0], seg: 20 }));
      }
      tower.add(k.box(0.012, 0.06, 0.3, k.plastic("#2a2c31"), { at: [-0.07, 0.2, -0.02] }));
      tower.add(k.box(0.006, 0.006, 0.28, k.glow(rgb, o.on, 2), { at: [-0.1, 0.23, -0.02] }));
      tower.position.set(0.62, 0.763, -0.1);
      g.add(tower);
      // A headset on its stand.
      g.add(k.box(0.07, 0.012, 0.07, k.metal("black"), { at: [-0.65, 0.766, -0.15] }), rod(k, [-0.65, 0.77, -0.15], [-0.65, 0.98, -0.15], 0.008, k.metal("black")));
      g.add(k.torus(0.08, 0.012, k.plastic("#18191c"), { at: [-0.65, 0.92, -0.15], rot: [0, PI / 2, 0], arc: PI, seg: 20 }));
      for (const s of [-1, 1]) g.add(k.cyl(0.04, 0.04, 0.03, k.plastic("#18191c"), { at: [-0.65, 0.88, -0.15 + s * 0.08], rot: [PI / 2, 0, 0], seg: 20 }));
      return g;
    },
  },

  // ── Jukebox: the classic arch, bubble tubes lit, records inside ─────────
  jukebox: {
    size: [0.88, 1.55, 0.62],
    light: { at: [0, 1.0, 0.35], color: "#ffb35c", intensity: 1.4, distance: 3 },
    build(k, o) {
      const wood = k.wood(o.color ?? "#6b3f22", { gloss: 0.7 });
      const chrome = k.metal("chrome", 0.15);
      const g = new THREE.Group();
      // The body: a box with an arched top, extruded front to back.
      const arch: [number, number][] = [[-0.44, 0], [0.44, 0], [0.44, 1.1]];
      for (let i = 0; i <= 20; i += 1) {
        const a = (i / 20) * PI;
        arch.push([Math.cos(a) * 0.44, 1.1 + Math.sin(a) * 0.42]);
      }
      arch.push([-0.44, 1.1]);
      const body = k.extrude(arch, 0.56, wood, { at: [0, 0, -0.28], bevel: 0.015 });
      g.add(body);
      // Glowing tubes following the arch, and a chrome band.
      const tubes = ["#ff5d5d", "#ffb703", "#6be4ff"];
      tubes.forEach((c, i) => {
        const r = 0.4 - i * 0.05;
        const pts: V3[] = [];
        for (let s = 0; s <= 24; s += 1) {
          const a = (s / 24) * PI;
          pts.push([Math.cos(a) * r, 1.1 + Math.sin(a) * r, 0.29 + i * 0.004]);
        }
        pts.unshift([r, 0.35, 0.29 + i * 0.004]);
        pts.push([-r, 0.35, 0.29 + i * 0.004]);
        g.add(k.tube(pts, 0.016, k.glow(c, o.on, 2.4), { seg: 64 }));
      });
      // The window onto the records, the selection buttons, the grille.
      g.add(k.box(0.5, 0.36, 0.01, k.paint("#0d0d0f", 0.6), { at: [0, 1.1, 0.284] }));
      g.add(k.box(0.48, 0.34, 0.006, k.glass("#ffe6c4", 0.3), { at: [0, 1.1, 0.292] }));
      for (let i = 0; i < 5; i += 1) g.add(k.cyl(0.11, 0.11, 0.008, k.plastic("#111", 0.9), { at: [-0.14 + i * 0.07, 1.05 + (i % 2) * 0.02, 0.2], rot: [PI / 2 - 0.3, 0, 0], seg: 28 }));
      if (o.on) g.add(k.box(0.44, 0.3, 0.004, k.glow("#ffcf8a", true, 0.6), { at: [0, 1.1, 0.278] }));
      for (let i = 0; i < 10; i += 1) g.add(k.box(0.03, 0.022, 0.02, k.plastic(i % 2 ? "#f4f1ea" : "#e63946", 0.7), { at: [-0.18 + i * 0.04, 0.86, 0.3], r: 0.004 }));
      const grille = canvasTexture(256, 256, (c, w, h) => {
        c.fillStyle = "#1a1210";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#c9a368";
        c.lineWidth = 6;
        for (let i = -h; i < w; i += 26) {
          c.beginPath();
          c.moveTo(i, h);
          c.lineTo(i + h, 0);
          c.stroke();
        }
      });
      g.add(k.plane(0.56, 0.48, k.print(grille, { roughness: 0.5 }), { at: [0, 0.42, 0.286] }));
      g.add(k.box(0.88, 0.04, 0.6, chrome, { at: [0, 0.02, 0], r: 0.01 }));
      g.add(k.box(0.86, 0.025, 0.02, chrome, { at: [0, 0.74, 0.29], r: 0.006 }));
      return g;
    },
  },

  // ── DJ Booth: two turntables and a mixer behind a lit front ─────────────
  "dj-booth": {
    size: [1.8, 1.25, 0.8],
    light: { at: [0, 0.5, 0.5], color: "#38bdf8", intensity: 1.5, distance: 3 },
    build(k, o) {
      const booth = k.paint("#141518", 0.5);
      const led = o.color ?? "#38bdf8";
      const g = new THREE.Group();
      g.add(k.box(1.8, 1.0, 0.72, booth, { at: [0, 0.5, 0], r: 0.015 }));
      // The lit front: a gradient behind a perforated face.
      const front = canvasTexture(1024, 512, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, led);
        gr.addColorStop(0.5, "#a855f7");
        gr.addColorStop(1, led);
        c.fillStyle = o.on ? gr : "#2a2c31";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(0,0,0,0.55)";
        for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) c.fillRect(x + 5, y + 5, 7, 7);
      });
      g.add(k.plane(1.7, 0.88, k.print(front, { glow: o.on ? 1.3 : 0, roughness: 0.6 }), { at: [0, 0.5, 0.362] }));
      g.add(k.box(1.84, 0.05, 0.76, k.paint("#0c0c0e", 0.6), { at: [0, 1.025, 0], r: 0.01 }));
      // Two turntables and the mixer.
      const deck = (x: number) => {
        const d = new THREE.Group();
        d.add(k.box(0.48, 0.07, 0.38, k.metal("#2b2d31", 0.4), { at: [0, 0.035, 0], r: 0.01 }));
        d.add(k.cyl(0.16, 0.16, 0.012, k.metal("chrome", 0.2), { at: [-0.04, 0.076, 0], seg: 40 }));
        d.add(k.cyl(0.15, 0.15, 0.006, k.plastic("#0b0b0b", 0.9), { at: [-0.04, 0.085, 0], seg: 40 }));
        d.add(k.cyl(0.05, 0.05, 0.007, k.paint("#e63946"), { at: [-0.04, 0.0885, 0], seg: 24 }));
        d.add(rod(k, [0.17, 0.09, -0.13], [0.04, 0.09, 0.06], 0.005, k.metal("chrome", 0.2)));
        d.add(k.box(0.03, 0.01, 0.08, k.plastic("#888"), { at: [0.19, 0.075, 0.08] }));
        d.position.set(x, 1.05, -0.02);
        return d;
      };
      g.add(deck(-0.55), deck(0.55));
      const mixer = new THREE.Group();
      mixer.add(k.box(0.34, 0.07, 0.36, k.metal("#1d1f23", 0.4), { at: [0, 0.035, 0], r: 0.01 }));
      for (let i = 0; i < 4; i += 1) {
        mixer.add(k.box(0.012, 0.01, 0.1, k.paint("#000"), { at: [-0.1 + i * 0.065, 0.071, 0.08] }));
        mixer.add(k.box(0.025, 0.02, 0.015, k.plastic("#e5e5e5"), { at: [-0.1 + i * 0.065, 0.08, 0.06 + (i % 2) * 0.03], r: 0.003 }));
        for (let j = 0; j < 3; j += 1) mixer.add(k.cyl(0.011, 0.011, 0.016, k.plastic("#e5e5e5"), { at: [-0.1 + i * 0.065, 0.078, -0.12 + j * 0.05], seg: 12 }));
        mixer.add(k.box(0.01, 0.006, 0.05, k.glow(i % 2 ? "#3ddc97" : "#ffb703", o.on, 2), { at: [-0.1 + i * 0.065, 0.073, -0.155] }));
      }
      mixer.position.set(0, 1.05, -0.02);
      g.add(mixer);
      // Headphones on the mixer, a laptop on its stand.
      g.add(k.torus(0.08, 0.012, k.plastic("#18191c"), { at: [0.18, 1.14, 0.2], rot: [-PI / 2, 0, 0], arc: PI, seg: 20 }));
      g.add(k.box(0.3, 0.012, 0.22, k.metal("silver", 0.3), { at: [0, 1.2, -0.25], rot: [0.3, 0, 0], r: 0.006 }));
      g.add(k.box(0.3, 0.2, 0.008, k.metal("silver", 0.3), { at: [0, 1.32, -0.37], rot: [-0.2, 0, 0], r: 0.006 }));
      return g;
    },
  },

  // ── Indoor Slide: a platform, a ladder, a curved chute ──────────────────
  slide: {
    size: [0.95, 1.85, 2.7],
    build(k, o) {
      const plastic = k.plastic(o.color ?? "#f3a712", 0.7);
      const frame = k.paint("#2f6db5", 0.6);
      const steel = k.metal("steel", 0.3);
      const g = new THREE.Group();
      const deckY = 1.3;
      // The platform on four posts, with a rail round the back.
      g.add(k.box(0.9, 0.05, 0.7, frame, { at: [0, deckY, -0.95], r: 0.01 }));
      for (const [x, z] of [[-0.42, -1.27], [0.42, -1.27], [-0.42, -0.63], [0.42, -0.63]] as const) g.add(k.box(0.06, deckY + 0.5, 0.06, frame, { at: [x, (deckY + 0.5) / 2, z], r: 0.012 }));
      for (const sx of [-1, 1]) g.add(rod(k, [sx * 0.42, deckY + 0.48, -1.27], [sx * 0.42, deckY + 0.48, -0.63], 0.02, frame));
      // The ladder up the back.
      for (const sx of [-1, 1]) g.add(rod(k, [sx * 0.25, 0, -1.55], [sx * 0.25, deckY + 0.3, -1.3], 0.022, steel));
      for (let i = 1; i <= 5; i += 1) {
        const t = i / 6;
        g.add(rod(k, [-0.25, t * deckY, -1.55 + t * 0.25], [0.25, t * deckY, -1.55 + t * 0.25], 0.016, steel));
      }
      // The chute: a curved channel from the deck down to the floor, in segments.
      const n = 14;
      const at = (t: number): V3 => [0, deckY - (1 - Math.cos(t * PI)) * 0.5 * (deckY - 0.12), -0.6 + t * 1.9];
      for (let i = 0; i < n; i += 1) {
        const a = new THREE.Vector3(...at(i / n));
        const b = new THREE.Vector3(...at((i + 1) / n));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const len = a.distanceTo(b) + 0.01;
        const pitch = Math.atan2(a.y - b.y, b.z - a.z);
        const seg = new THREE.Group();
        seg.add(k.box(0.56, 0.03, len, plastic, { at: [0, 0, 0] }));
        for (const sx of [-1, 1]) seg.add(k.box(0.04, 0.18, len, plastic, { at: [sx * 0.29, 0.08, 0], r: 0.012 }));
        seg.position.copy(mid);
        seg.rotation.x = pitch;
        g.add(seg);
      }
      // A lip at the bottom, and a soft mat to land on.
      g.add(k.cushion(0.8, 0.06, 0.5, k.fabric("#4f8df7"), { at: [0, 0.03, 1.3] }));
      return g;
    },
  },

  // ── Block Castle: a castle of plastic bricks on a baseplate ─────────────
  "block-castle": {
    size: [1.0, 1.0, 0.9],
    build(k, o) {
      const colors = [o.color ?? "#d62828", "#fcbf49", "#2a9d8f", "#f1faee", "#1d3557"];
      const mats = colors.map((c) => k.plastic(c, 0.8));
      const g = new THREE.Group();
      const unit = 0.032;
      g.add(k.box(1.0, 0.012, 0.9, k.plastic("#5aaa4f", 0.6), { at: [0, 0.006, 0], r: 0.004 }));
      const brick = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, studs = true) => {
        g.add(k.box(w, h, d, m, { at: [x, y + h / 2, z], r: 0.003 }));
        if (!studs) return;
        const nx = Math.max(1, Math.round(w / (unit * 2)));
        const nz = Math.max(1, Math.round(d / (unit * 2)));
        if (nx * nz <= 4) for (let i = 0; i < nx; i += 1) for (let j = 0; j < nz; j += 1) g.add(k.cyl(0.0095, 0.0095, 0.008, m, { at: [x - w / 2 + (i + 0.5) * (w / nx), y + h + 0.004, z - d / 2 + (j + 0.5) * (d / nz)], seg: 12 }));
      };
      // Four towers at the corners, walls between, a gate in front.
      const rnd = seeded(12);
      const towerAt = [[-0.38, -0.32], [0.38, -0.32], [-0.38, 0.3], [0.38, 0.3]] as const;
      towerAt.forEach(([x, z], ti) => {
        for (let r = 0; r < 9; r += 1) brick(0.16, 0.06, 0.16, x, 0.012 + r * 0.06, z, mats[(r + ti) % 2 === 0 ? 0 : 3], false);
        for (const [dx, dz] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]] as const) brick(0.05, 0.05, 0.05, x + dx, 0.552, z + dz, mats[1]);
        if (ti < 2) {
          g.add(rod(k, [x, 0.6, z], [x, 0.85, z], 0.004, k.metal("steel")));
          g.add(k.box(0.1, 0.06, 0.004, mats[2], { at: [x + 0.05, 0.81, z] }));
        }
      });
      // Walls, two bricks thick, in courses, with crenellations.
      const wall = (x0: number, z0: number, x1: number, z1: number, gate: boolean) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const along = (x1 - x0) / len;
        const across = (z1 - z0) / len;
        const n = Math.floor(len / 0.1);
        for (let r = 0; r < 6; r += 1)
          for (let i = 0; i < n; i += 1) {
            const t = (i + 0.5) / n;
            if (gate && r < 4 && t > 0.38 && t < 0.62) continue;
            const off = r % 2 ? 0.025 : 0;
            const cx = x0 + (x1 - x0) * t + along * off;
            const cz = z0 + (z1 - z0) * t + across * off;
            const w = Math.abs(along) > 0.5 ? len / n - 0.002 : 0.06;
            const d = Math.abs(along) > 0.5 ? 0.06 : len / n - 0.002;
            brick(w, 0.06, d, cx, 0.012 + r * 0.06, cz, mats[rnd() < 0.85 ? 3 : 1], false);
          }
        for (let i = 0; i < n; i += 2) {
          const t = (i + 0.5) / n;
          brick(0.05, 0.04, 0.05, x0 + (x1 - x0) * t, 0.372, z0 + (z1 - z0) * t, mats[0]);
        }
      };
      wall(-0.3, -0.32, 0.3, -0.32, false);
      wall(-0.3, 0.3, 0.3, 0.3, true);
      wall(-0.38, -0.24, -0.38, 0.22, false);
      wall(0.38, -0.24, 0.38, 0.22, false);
      // The gate's lintel and a drawbridge.
      brick(0.24, 0.06, 0.07, 0, 0.252, 0.3, mats[4]);
      g.add(k.box(0.2, 0.012, 0.18, k.wood("#8a5a35"), { at: [0, 0.018, 0.4], rot: [0.12, 0, 0] }));
      return g;
    },
  },

  // ── Hologram Table: a round console projecting a glowing parabola ───────
  "holo-table": {
    size: [1.15, 1.45, 1.15],
    light: { at: [0, 1.0, 0], color: "#5ee6ff", intensity: 1.6, distance: 3 },
    build(k, o) {
      const holo = o.color ?? "#5ee6ff";
      const shell = k.metal("#2c3138", 0.35);
      const g = new THREE.Group();
      // Pedestal and the round top, with a glowing ring and a grid in the glass.
      g.add(k.lathe([[0.0001, 0], [0.3, 0], [0.3, 0.04], [0.14, 0.12], [0.11, 0.6], [0.22, 0.7], [0.0001, 0.7]], shell, { seg: 48 }));
      g.add(k.cyl(0.55, 0.52, 0.08, shell, { at: [0, 0.74, 0], seg: 64 }));
      const grid = canvasTexture(512, 512, (c, w, h) => {
        c.fillStyle = "#06121a";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = o.on ? holo : "#24404d";
        c.globalAlpha = 0.6;
        c.lineWidth = 2;
        for (let i = 0; i <= 16; i += 1) {
          c.beginPath();
          c.moveTo((i * w) / 16, 0);
          c.lineTo((i * w) / 16, h);
          c.moveTo(0, (i * h) / 16);
          c.lineTo(w, (i * h) / 16);
          c.stroke();
        }
      });
      const top = k.disc(0.5, k.print(grid, { glow: o.on ? 0.7 : 0, roughness: 0.15 }), { at: [0, 0.781, 0], rot: [-PI / 2, 0, 0] });
      g.add(top);
      g.add(k.torus(0.51, 0.012, k.glow(holo, o.on, 2.6), { at: [0, 0.782, 0], rot: [PI / 2, 0, 0], seg: 64 }));
      // The hologram: a faint cone of light and a glowing parabola with its axes.
      if (o.on) {
        const cone = k.cone(0.42, 0.62, lightMat(k, holo, 0.07, true), { at: [0, 1.1, 0], rot: [PI, 0, 0], seg: 40 });
        cone.castShadow = false;
        g.add(cone);
      }
      const line = k.glow(holo, o.on, 3);
      const pts: V3[] = [];
      for (let i = 0; i <= 30; i += 1) {
        const x = -0.3 + (i / 30) * 0.6;
        pts.push([x, 0.92 + (x * x) / 0.18, 0]);
      }
      g.add(k.tube(pts, 0.006, line, { seg: 60 }));
      g.add(rod(k, [-0.34, 0.92, 0], [0.34, 0.92, 0], 0.003, line, 6), rod(k, [0, 0.86, 0], [0, 1.42, 0], 0.003, line, 6));
      g.add(k.sphere(0.018, k.glow("#ffffff", o.on, 3), { at: [0, 0.92, 0], seg: 14 }));
      return g;
    },
  },
};
