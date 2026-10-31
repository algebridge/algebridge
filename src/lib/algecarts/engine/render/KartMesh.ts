import * as THREE from "three";
import type { BodyId, CharacterId, DecalId, HatId, Loadout, TrailId, WheelId } from "../profile";
import type { Palette } from "./Materials";
import { shadeHex } from "../util";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** A box with softened edges; the radius never exceeds what the box can take. */
function rbox(w: number, h: number, d: number, r = 0.09): THREE.BufferGeometry {
  const rr = Math.min(r, Math.min(w, h, d) * 0.45);
  return new RoundedBoxGeometry(w, h, d, 2, rr);
}

/** The parts of a kart's mesh the simulation animates. */
export interface KartView {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Group[];
  frontPivots: THREE.Group[];
  chassisMat: THREE.MeshToonMaterial;
  shield: THREE.Mesh;
  flames: THREE.Mesh[];
  flameMats: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
  brake: THREE.Group;
  blob: THREE.Mesh;
  /** The driver: rig is the whole body, head turns and bobs on its own. */
  rig: THREE.Group;
  head: THREE.Group;
  headY: number;
  /** Shoulder pivots: rotate to raise the arms. */
  arms: [THREE.Group, THREE.Group];
  /** Exhaust tips in kart space, where puffs come from. */
  exhaust: { x: number; y: number; z: number }[];
  tag: THREE.Sprite | null;
  setTag(name: string, hp: number): void;
  dispose(): void;
}

export interface TrailLook {
  puff: [string, string];
  boost: [string, string];
  flame: [string, string];
  /** How fast puffs rise. */
  rise: number;
  rainbow?: boolean;
}

export const TRAILS: Record<TrailId, TrailLook> = {
  smoke: { puff: ["#d8d8e0", "#9a9aa6"], boost: ["#ffb347", "#5a5a66"], flame: ["#ff8a1f", "#fff2a0"], rise: 1.2 },
  fire: { puff: ["#ffb060", "#6b2a1a"], boost: ["#ffd23c", "#ff3d1f"], flame: ["#ff3d1f", "#ffe066"], rise: 1.6 },
  bubbles: { puff: ["#e6f8ff", "#8fd8ff"], boost: ["#ffffff", "#6fc8ff"], flame: ["#6ff6ff", "#ffffff"], rise: 2.6 },
  rainbow: { puff: ["#ff5d8f", "#3d5aff"], boost: ["#ffd400", "#8b5cf6"], flame: ["#ff5d8f", "#ffe066"], rise: 1.8, rainbow: true },
};

/** The rainbow trail's colours at a moment. */
export function rainbowColors(t: number): [string, string] {
  const c0 = new THREE.Color().setHSL((t * 0.25) % 1, 0.95, 0.6);
  const c1 = new THREE.Color().setHSL((t * 0.25 + 0.3) % 1, 0.95, 0.55);
  return [`#${c0.getHexString()}`, `#${c1.getHexString()}`];
}

const SKINS = ["#f7d1b0", "#e8b990", "#c98a5c", "#8d5a3b", "#5c3a26", "#f3c9a6"];

let blobTexture: THREE.CanvasTexture | null = null;
let blobMaterial: THREE.MeshBasicMaterial | null = null;
function blobMat(): THREE.MeshBasicMaterial {
  if (blobMaterial) return blobMaterial;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.6, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(c);
  blobMaterial = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity: 0.6, color: "#000000" });
  return blobMaterial;
}

interface Style {
  driverY: number;
  driverZ: number;
  shieldY: number;
  wheelR: number;
  wheelW: number;
  wheelAt: [number, number][];
  flameAt: { x: number; y: number; z: number; up?: boolean }[];
}

type MeshFn = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => THREE.Mesh;

interface Kit {
  pal: Palette;
  body: THREE.Group;
  mesh: MeshFn;
  chassis: THREE.MeshToonMaterial;
  hood: THREE.Material;
  trim: THREE.Material;
  light: THREE.Material;
  dark: THREE.Material;
  steel: THREE.Material;
  lamp: THREE.Material;
  tail: THREE.Material;
  glass: THREE.Material;
}

/**
 * A chunky low-poly kart from a loadout: body style, paint, wheels, hat,
 * hood decal, trail colours. Everything is boxes, cylinders, cones and
 * spheres; no asset files. Glow parts use over-bright unlit paint so the
 * bloom pass picks them up.
 */
export function buildKart(pal: Palette, lo: Loadout, name: string, isPlayer: boolean, quality: "high" | "low"): KartView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shadow = quality === "high";
  const own: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const mesh: MeshFn = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  };

  const chassis = pal.own(lo.color);
  own.push(chassis);
  let hood: THREE.Material = chassis;
  if (lo.decal !== "plain") {
    const tex = decalTexture(lo.decal, lo.color, name);
    textures.push(tex);
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: pal.gradient });
    own.push(m);
    hood = m;
  }
  const kit: Kit = {
    pal,
    body,
    mesh,
    chassis,
    hood,
    trim: pal.toon(shadeHex(lo.color, -0.35)),
    light: pal.toon(shadeHex(lo.color, 0.35)),
    dark: pal.toon("#262a33"),
    steel: pal.toon("#d9dde6"),
    lamp: pal.glow("#fff6c0", 1.5),
    tail: pal.glow("#ff3b3b", 1.3),
    glass: pal.toon("#1b2a44", "#2b4a7a", 0.35),
  };

  const style = BODIES[lo.body](kit);

  // Wheels: a steer pivot (front only) around a spin pivot around the tyre.
  const wheels: THREE.Group[] = [];
  const frontPivots: THREE.Group[] = [];
  const frontZ = Math.max(...style.wheelAt.map(([, z]) => z));
  for (const [x, z] of style.wheelAt) {
    const steer = new THREE.Group();
    steer.position.set(x, style.wheelR, z);
    const spin = buildWheel(lo.wheels, pal, style.wheelR, style.wheelW, lo.color, shadow);
    steer.add(spin);
    body.add(steer);
    wheels.push(spin);
    if (z >= frontZ - 0.01) frontPivots.push(steer);
  }

  const driver = buildCharacter(kit, style, lo, name, shadow);

  // Shield bubble.
  const shieldMat = new THREE.MeshBasicMaterial({ color: "#6ff6ff", transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  own.push(shieldMat);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.95, 18, 12), shieldMat);
  shield.position.set(0, style.shieldY + 0.4, -0.05);
  shield.visible = false;
  root.add(shield);

  // Boost flames at the exhausts.
  const look = TRAILS[lo.trail];
  const flameOuter = new THREE.MeshBasicMaterial({ color: look.flame[0], toneMapped: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: look.flame[1], toneMapped: false });
  flameOuter.color.multiplyScalar(1.4);
  flameInner.color.multiplyScalar(1.6);
  own.push(flameOuter, flameInner);
  const flames: THREE.Mesh[] = [];
  const exhaust: { x: number; y: number; z: number }[] = [];
  for (const f of style.flameAt) {
    exhaust.push({ x: f.x, y: f.y, z: f.z });
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.0, 8), flameOuter);
    const i = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 8), flameInner);
    if (f.up) {
      o.position.set(f.x, f.y + 0.55, f.z);
      i.position.set(f.x, f.y + 0.45, f.z);
    } else {
      o.position.set(f.x, f.y, f.z - 0.6);
      o.rotation.x = -Math.PI / 2;
      i.position.set(f.x, f.y, f.z - 0.45);
      i.rotation.x = -Math.PI / 2;
    }
    o.visible = i.visible = false;
    body.add(o, i);
    flames.push(o, i);
  }

  // Brake lights.
  const brake = new THREE.Group();
  brake.visible = false;
  body.add(brake);
  const brakeGlow = pal.glow("#ff6b6b", 1.4);
  for (const f of style.flameAt.slice(0, 2)) mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), brakeGlow, f.x * 1.8, f.y + 0.1, f.z - 0.05, brake);

  // Ground blob.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1.35, 20), blobMat());
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.renderOrder = -1;
  root.add(blob);

  // Name tag with health bar, for everyone but the player (the HUD has theirs).
  let tag: THREE.Sprite | null = null;
  let tagCanvas: HTMLCanvasElement | null = null;
  let tagTex: THREE.CanvasTexture | null = null;
  if (!isPlayer) {
    tagCanvas = document.createElement("canvas");
    tagCanvas.width = 256;
    tagCanvas.height = 96;
    tagTex = new THREE.CanvasTexture(tagCanvas);
    tagTex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthTest: true, depthWrite: false });
    own.push(sm);
    tag = new THREE.Sprite(sm);
    tag.scale.set(3.0, 1.125, 1);
    tag.position.set(0, style.driverY + 2.2, 0);
    root.add(tag);
  }

  const setTag = (label: string, hp: number) => {
    if (!tagCanvas || !tagTex) return;
    const ctx = tagCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 96);
    ctx.font = "800 30px 'Baloo 2', 'Nunito', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(20,18,30,0.9)";
    ctx.strokeText(label, 128, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, 128, 30);
    const w = 150;
    const x0 = 128 - w / 2;
    ctx.fillStyle = "rgba(20,18,30,0.85)";
    roundRect(ctx, x0 - 3, 58, w + 6, 18, 9);
    ctx.fill();
    const frac = Math.max(0, Math.min(1, hp / 100));
    ctx.fillStyle = frac > 0.5 ? "#4ade80" : frac > 0.25 ? "#fbbf24" : "#ef4444";
    if (frac > 0) {
      roundRect(ctx, x0, 61, Math.max(10, w * frac), 12, 6);
      ctx.fill();
    }
    tagTex.needsUpdate = true;
  };
  setTag(name, 100);

  return {
    root,
    body,
    wheels,
    frontPivots,
    chassisMat: chassis,
    shield,
    flames,
    flameMats: [flameOuter, flameInner],
    brake,
    blob,
    rig: driver.rig,
    head: driver.head,
    headY: driver.headY,
    arms: driver.arms,
    exhaust,
    tag,
    setTag,
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && m !== blob) m.geometry.dispose();
      });
      blob.geometry.dispose();
      for (const m of own) m.dispose();
      for (const t of textures) t.dispose();
      tagTex?.dispose();
    },
  };
}

// ----- body styles -----

const BODIES: Record<BodyId, (k: Kit) => Style> = {
  classic(k) {
    const { mesh, chassis, hood, trim, light, dark, lamp, tail } = k;
    mesh(rbox(1.5, 0.5, 2.3), chassis, 0, 0.55, -0.05);
    mesh(rbox(1.0, 0.36, 0.8), chassis, 0, 0.5, 1.35);
    mesh(rbox(1.2, 0.06, 1.0), hood, 0, 0.83, 0.55);
    mesh(rbox(1.1, 0.12, 0.3), light, 0, 0.74, 1.25);
    mesh(rbox(1.0, 0.34, 1.0), dark, 0, 0.82, -0.3);
    mesh(rbox(1.6, 0.26, 0.26), trim, 0, 0.42, 1.72);
    mesh(rbox(1.6, 0.26, 0.26), trim, 0, 0.42, -1.26);
    mesh(rbox(0.3, 0.3, 1.3), trim, 0.85, 0.5, -0.1);
    mesh(rbox(0.3, 0.3, 1.3), trim, -0.85, 0.5, -0.1);
    mesh(rbox(0.1, 0.42, 0.1), dark, 0.55, 1.0, -1.15);
    mesh(rbox(0.1, 0.42, 0.1), dark, -0.55, 1.0, -1.15);
    mesh(rbox(1.5, 0.1, 0.45), light, 0, 1.22, -1.18);
    const pipe = new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8);
    mesh(pipe, dark, 0.32, 0.5, -1.42).rotation.x = Math.PI / 2;
    mesh(pipe, dark, -0.32, 0.5, -1.42).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.12, 8, 6), lamp, 0.36, 0.56, 1.76);
    mesh(new THREE.SphereGeometry(0.12, 8, 6), lamp, -0.36, 0.56, 1.76);
    mesh(rbox(0.22, 0.12, 0.06), tail, 0.6, 0.6, -1.4);
    mesh(rbox(0.22, 0.12, 0.06), tail, -0.6, 0.6, -1.4);
    return {
      driverY: 1.2, driverZ: -0.25, shieldY: 0.95, wheelR: 0.42, wheelW: 0.34,
      wheelAt: [[0.8, 0.85], [-0.8, 0.85], [0.8, -0.85], [-0.8, -0.85]],
      flameAt: [{ x: 0.32, y: 0.5, z: -1.5 }, { x: -0.32, y: 0.5, z: -1.5 }],
    };
  },
  buggy(k) {
    const { mesh, chassis, hood, trim, dark, steel, lamp, tail } = k;
    mesh(rbox(1.4, 0.24, 2.3), chassis, 0, 0.42, 0);
    mesh(rbox(1.0, 0.24, 0.7), chassis, 0, 0.48, 1.3);
    mesh(rbox(1.0, 0.06, 0.9), hood, 0, 0.63, 0.75);
    const post = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 7);
    for (const [x, z] of [[0.55, 0.35], [-0.55, 0.35], [0.55, -0.75], [-0.55, -0.75]]) mesh(post, dark, x, 1.15, z);
    const bar = new THREE.CylinderGeometry(0.05, 0.05, 1.1, 7);
    mesh(bar, dark, 0.55, 1.8, -0.2).rotation.x = Math.PI / 2;
    mesh(bar, dark, -0.55, 1.8, -0.2).rotation.x = Math.PI / 2;
    mesh(bar, dark, 0, 1.8, 0.35).rotation.z = Math.PI / 2;
    mesh(bar, dark, 0, 1.8, -0.75).rotation.z = Math.PI / 2;
    mesh(rbox(0.7, 0.5, 0.5), dark, 0, 0.75, -0.3);
    mesh(rbox(0.8, 0.45, 0.5), trim, 0, 0.75, -0.95);
    const stack = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 7);
    mesh(stack, dark, 0.25, 1.15, -1.0);
    mesh(stack, dark, -0.25, 1.15, -1.0);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 7), steel, 0, 0.55, 1.68).rotation.z = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.13, 8, 6), lamp, 0.3, 0.66, 1.62);
    mesh(new THREE.SphereGeometry(0.13, 8, 6), lamp, -0.3, 0.66, 1.62);
    mesh(rbox(0.22, 0.12, 0.06), tail, 0.55, 0.6, -1.2);
    mesh(rbox(0.22, 0.12, 0.06), tail, -0.55, 0.6, -1.2);
    return {
      driverY: 1.15, driverZ: -0.32, shieldY: 1.0, wheelR: 0.46, wheelW: 0.4,
      wheelAt: [[0.85, 0.9], [-0.85, 0.9], [0.85, -0.9], [-0.85, -0.9]],
      flameAt: [{ x: 0.25, y: 1.35, z: -1.0, up: true }, { x: -0.25, y: 1.35, z: -1.0, up: true }],
    };
  },
  rocket(k) {
    const { mesh, chassis, hood, trim, dark, lamp, tail, glass } = k;
    mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 14), chassis, 0, 0.75, -0.1).rotation.x = Math.PI / 2;
    mesh(new THREE.ConeGeometry(0.5, 0.9, 14), chassis, 0, 0.75, 1.45).rotation.x = Math.PI / 2;
    mesh(rbox(0.7, 0.04, 1.3), hood, 0, 1.26, 0.45);
    const shield = mesh(rbox(0.9, 0.5, 0.08), glass, 0, 1.2, 0.35);
    shield.rotation.x = -0.45;
    const fin = rbox(0.7, 0.05, 0.6);
    mesh(fin, trim, 0.75, 0.75, -0.95).rotation.z = 0.35;
    mesh(fin, trim, -0.75, 0.75, -0.95).rotation.z = -0.35;
    mesh(rbox(0.05, 0.6, 0.6), trim, 0, 1.4, -0.95);
    mesh(new THREE.ConeGeometry(0.36, 0.5, 12), dark, 0, 0.75, -1.4).rotation.x = -Math.PI / 2;
    const axle = rbox(1.6, 0.08, 0.08);
    mesh(axle, dark, 0, 0.4, 0.9);
    mesh(axle, dark, 0, 0.4, -0.9);
    mesh(new THREE.SphereGeometry(0.1, 8, 6), lamp, 0.25, 0.95, 1.3);
    mesh(new THREE.SphereGeometry(0.1, 8, 6), lamp, -0.25, 0.95, 1.3);
    mesh(rbox(0.18, 0.1, 0.06), tail, 0.3, 0.55, -1.2);
    mesh(rbox(0.18, 0.1, 0.06), tail, -0.3, 0.55, -1.2);
    return {
      driverY: 1.45, driverZ: -0.2, shieldY: 1.0, wheelR: 0.4, wheelW: 0.34,
      wheelAt: [[0.78, 0.9], [-0.78, 0.9], [0.78, -0.9], [-0.78, -0.9]],
      flameAt: [{ x: 0, y: 0.75, z: -1.5 }],
    };
  },
  monster(k) {
    const { mesh, chassis, hood, dark, steel, lamp, tail, pal } = k;
    mesh(rbox(1.5, 0.55, 2.2), chassis, 0, 1.05, 0);
    mesh(rbox(1.3, 0.06, 1.0), hood, 0, 1.36, 0.55);
    mesh(rbox(1.3, 0.35, 0.9), dark, 0, 1.45, -0.45);
    const post = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 7);
    mesh(post, steel, 0.5, 0.95, 1.3);
    mesh(post, steel, -0.5, 0.95, 1.3);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 7), steel, 0, 1.2, 1.3).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 7), steel, 0, 0.8, 1.3).rotation.z = Math.PI / 2;
    mesh(rbox(1.2, 0.12, 0.2), dark, 0, 1.75, -0.05);
    const glow = pal.glow("#fff2a0", 1.6);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) mesh(rbox(0.2, 0.1, 0.05), glow, x, 1.75, 0.06);
    const stack = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 7);
    mesh(stack, dark, 0.55, 1.65, -0.95);
    mesh(stack, dark, -0.55, 1.65, -0.95);
    const arm = rbox(0.6, 0.1, 0.12);
    for (const [x, z] of [[0.75, 0.9], [-0.75, 0.9], [0.75, -0.9], [-0.75, -0.9]]) mesh(arm, dark, x, 0.78, z);
    mesh(new THREE.SphereGeometry(0.13, 8, 6), lamp, 0.4, 1.1, 1.12);
    mesh(new THREE.SphereGeometry(0.13, 8, 6), lamp, -0.4, 1.1, 1.12);
    mesh(rbox(0.24, 0.14, 0.06), tail, 0.5, 1.1, -1.12);
    mesh(rbox(0.24, 0.14, 0.06), tail, -0.5, 1.1, -1.12);
    return {
      driverY: 1.85, driverZ: -0.45, shieldY: 1.4, wheelR: 0.6, wheelW: 0.5,
      wheelAt: [[0.95, 0.9], [-0.95, 0.9], [0.95, -0.9], [-0.95, -0.9]],
      flameAt: [{ x: 0.55, y: 2.05, z: -0.95, up: true }, { x: -0.55, y: 2.05, z: -0.95, up: true }],
    };
  },
  formula(k) {
    const { mesh, chassis, hood, trim, light, dark, lamp, tail } = k;
    mesh(rbox(0.8, 0.3, 1.7), chassis, 0, 0.5, 0.75);
    mesh(new THREE.ConeGeometry(0.3, 0.5, 10), chassis, 0, 0.5, 1.82).rotation.x = Math.PI / 2;
    mesh(rbox(0.6, 0.05, 1.3), hood, 0, 0.66, 0.8);
    mesh(rbox(1.9, 0.06, 0.4), light, 0, 0.28, 1.7);
    mesh(rbox(0.06, 0.22, 0.4), trim, 0.95, 0.38, 1.7);
    mesh(rbox(0.06, 0.22, 0.4), trim, -0.95, 0.38, 1.7);
    mesh(rbox(0.9, 0.4, 1.0), dark, 0, 0.7, -0.15);
    mesh(rbox(0.45, 0.35, 1.3), trim, 0.72, 0.5, -0.25);
    mesh(rbox(0.45, 0.35, 1.3), trim, -0.72, 0.5, -0.25);
    mesh(rbox(0.6, 0.45, 0.9), chassis, 0, 0.85, -0.85);
    mesh(rbox(0.3, 0.3, 0.4), trim, 0, 1.4, -0.6);
    mesh(rbox(1.6, 0.06, 0.5), light, 0, 1.2, -1.2);
    mesh(rbox(0.06, 0.3, 0.5), trim, 0.8, 1.05, -1.2);
    mesh(rbox(0.06, 0.3, 0.5), trim, -0.8, 1.05, -1.2);
    mesh(rbox(0.08, 0.5, 0.08), dark, 0.5, 0.95, -1.2);
    mesh(rbox(0.08, 0.5, 0.08), dark, -0.5, 0.95, -1.2);
    const pipe = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8);
    mesh(pipe, dark, 0.25, 0.6, -1.38).rotation.x = Math.PI / 2;
    mesh(pipe, dark, -0.25, 0.6, -1.38).rotation.x = Math.PI / 2;
    const axle = rbox(1.7, 0.07, 0.07);
    mesh(axle, dark, 0, 0.42, 1.05);
    mesh(axle, dark, 0, 0.42, -0.85);
    mesh(new THREE.SphereGeometry(0.08, 8, 6), lamp, 0.2, 0.58, 1.55);
    mesh(new THREE.SphereGeometry(0.08, 8, 6), lamp, -0.2, 0.58, 1.55);
    mesh(rbox(0.2, 0.1, 0.06), tail, 0.5, 1.0, -1.42);
    mesh(rbox(0.2, 0.1, 0.06), tail, -0.5, 1.0, -1.42);
    return {
      driverY: 1.15, driverZ: -0.2, shieldY: 0.9, wheelR: 0.42, wheelW: 0.42,
      wheelAt: [[0.85, 1.05], [-0.85, 1.05], [0.85, -0.85], [-0.85, -0.85]],
      flameAt: [{ x: 0.25, y: 0.6, z: -1.5 }, { x: -0.25, y: 0.6, z: -1.5 }],
    };
  },
};

// ----- wheels -----

function buildWheel(style: WheelId, pal: Palette, r: number, w: number, color: string, shadow: boolean): THREE.Group {
  const spin = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = Math.PI / 2;
    m.position.x = x;
    m.castShadow = shadow;
    spin.add(m);
    return m;
  };
  const rubber = pal.toon("#262a33");
  if (style === "chunky") {
    add(new THREE.CylinderGeometry(r + 0.08, r + 0.08, w + 0.12, 14), rubber);
    for (const s of [-1, 1]) {
      const tread = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.07, 6, 14), pal.toon("#3a3f4a"));
      tread.rotation.y = Math.PI / 2;
      tread.position.x = s * (w / 2 + 0.03);
      spin.add(tread);
    }
    add(new THREE.CylinderGeometry(0.24, 0.24, w + 0.16, 8), pal.toon("#8a8f9a"));
  } else if (style === "neon") {
    add(new THREE.CylinderGeometry(r, r, w, 14), rubber);
    const glow = pal.glow("#6ff6ff", 1.8);
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.1, 0.045, 6, 18), glow);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = s * (w / 2 + 0.01);
      spin.add(rim);
    }
    add(new THREE.CylinderGeometry(0.2, 0.2, w + 0.04, 8), pal.toon("#1b1b24"));
  } else if (style === "gold") {
    add(new THREE.CylinderGeometry(r, r, w, 14), rubber);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.TorusGeometry(r - 0.08, 0.035, 6, 18), pal.toon("#f4f1ea"));
      wall.rotation.y = Math.PI / 2;
      wall.position.x = s * (w / 2 + 0.01);
      spin.add(wall);
    }
    add(new THREE.CylinderGeometry(0.24, 0.24, w + 0.06, 10), pal.toon("#ffcc33", "#5a4200", 0.25));
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, 0.07, r - 0.14), pal.toon("#ffcc33"));
      spoke.rotation.x = (i / 5) * Math.PI;
      spin.add(spoke);
    }
  } else {
    add(new THREE.CylinderGeometry(r, r, w, 14), rubber);
    add(new THREE.CylinderGeometry(0.2, 0.2, w + 0.02, 8), pal.toon("#d9dde6"));
    add(new THREE.CylinderGeometry(0.08, 0.08, w + 0.06, 6), pal.toon(shadeHex(color, -0.1)));
  }
  return spin;
}

// ----- characters and hats -----

/** Head radius: big, the way a cartoon kart driver should be. */
const H = 0.44;

type AddFn = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => THREE.Mesh;

interface Face {
  k: Kit;
  head: THREE.Group;
  rig: THREE.Group;
  add: AddFn;
  name: string;
  /** The kart's paint, for cuffs and shirts. */
  kart: string;
  shadow: boolean;
}

interface CharacterParts {
  /** Head top in head-local units, where the hat sits. */
  top: number;
}

type HandStyle = "glove" | "bare" | "flipper" | "claw";

interface CharacterDef {
  /** Fur, skin or metal: the torso and arms. */
  body(f: Face): THREE.Material;
  hands?: HandStyle;
  /** A lighter patch on the front of the torso. */
  belly?: string;
  /** Builds its own torso instead of the capsule. */
  torso?(f: Face, body: THREE.Material): void;
  build(f: Face, body: THREE.Material): CharacterParts;
}

const SPHERE = (r: number) => new THREE.SphereGeometry(r, 14, 11);

function pick<T>(list: T[], name: string, salt: string): T {
  return list[hashName(name + salt) % list.length];
}

const mat = (f: Face, hex: string, emissive?: string, intensity?: number) => f.k.pal.toon(hex, emissive, intensity);

function headSphere(f: Face, m: THREE.Material, r = H, sy = 1, sz = 1, y = 0): THREE.Mesh {
  const h = f.add(SPHERE(r), m, 0, y, 0, f.head);
  h.scale.set(1, sy, sz);
  return h;
}

/** Big oval eyes with a pupil and a glint, or dark almond eyes. */
function bigEyes(f: Face, o: { x: number; y: number; z: number; rx: number; ry: number; pupil?: string; pr?: number; tilt?: number; dark?: boolean; white?: string }): void {
  const white = mat(f, o.white ?? "#ffffff");
  const pupil = mat(f, o.pupil ?? "#1b1b24");
  const glint = f.k.pal.unlit("#ffffff");
  const pr = o.pr ?? Math.min(o.rx, o.ry) * 0.55;
  for (const side of [1, -1]) {
    if (o.dark) {
      const e = f.add(SPHERE(1), mat(f, "#1b1b24"), side * o.x, o.y, o.z, f.head);
      e.scale.set(o.rx, o.ry, o.rx * 0.5);
      e.rotation.z = -side * (o.tilt ?? 0);
      const g = f.add(SPHERE(o.rx * 0.25), glint, side * o.x + o.rx * 0.3, o.y + o.ry * 0.35, o.z + o.rx * 0.45, f.head);
      g.castShadow = false;
      continue;
    }
    const e = f.add(SPHERE(1), white, side * o.x, o.y, o.z, f.head);
    e.scale.set(o.rx, o.ry, o.rx * 0.6);
    e.rotation.z = -side * (o.tilt ?? 0);
    f.add(SPHERE(pr), pupil, side * o.x, o.y - o.ry * 0.05, o.z + o.rx * 0.52, f.head);
    const g = f.add(SPHERE(pr * 0.32), glint, side * o.x + pr * 0.35, o.y + pr * 0.35, o.z + o.rx * 0.52 + pr * 0.8, f.head);
    g.castShadow = false;
  }
}

/** An open grin: a dark mouth with a row of teeth and a tongue. */
function grin(f: Face, o: { y: number; z: number; w: number; h: number; teeth?: number; buck?: boolean; fangs?: boolean; tongue?: boolean; color?: string }): void {
  const cavity = f.add(SPHERE(1), mat(f, o.color ?? "#4a1020"), 0, o.y, o.z, f.head);
  cavity.scale.set(o.w, o.h, 0.2);
  const white = mat(f, "#ffffff");
  if (o.teeth) {
    const n = o.teeth;
    const tw = (o.w * 1.5) / n;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * tw;
      f.add(new THREE.BoxGeometry(tw * 0.8, o.h * 0.5, 0.05), white, x, o.y + o.h * 0.5, o.z + 0.17 - Math.abs(x) * 0.25, f.head);
    }
  }
  if (o.buck) {
    f.add(new THREE.BoxGeometry(0.085, 0.14, 0.05), white, 0.05, o.y + o.h * 0.3, o.z + 0.18, f.head);
    f.add(new THREE.BoxGeometry(0.085, 0.14, 0.05), white, -0.05, o.y + o.h * 0.3, o.z + 0.18, f.head);
  }
  if (o.fangs) {
    for (const side of [1, -1]) {
      const fang = f.add(new THREE.ConeGeometry(0.035, 0.1, 5), white, side * o.w * 0.6, o.y + o.h * 0.35, o.z + 0.16, f.head);
      fang.rotation.x = Math.PI;
    }
  }
  if (o.tongue) {
    const t = f.add(SPHERE(1), mat(f, "#ff6b8a"), 0, o.y - o.h * 0.4, o.z + 0.06, f.head);
    t.scale.set(o.w * 0.55, o.h * 0.38, 0.22);
  }
}

function smileLine(f: Face, y: number, z: number, r: number): void {
  const m = f.add(new THREE.TorusGeometry(r, 0.025, 6, 12, Math.PI), mat(f, "#4a1020"), 0, y, z, f.head);
  m.rotation.z = Math.PI;
  m.rotation.x = -0.25;
}

function muzzle(f: Face, hex: string, o: { y: number; z: number; rx: number; ry: number; rz: number }): void {
  const m = f.add(SPHERE(1), mat(f, hex), 0, o.y, o.z, f.head);
  m.scale.set(o.rx, o.ry, o.rz);
}

function noseOf(f: Face, kind: "pink" | "dot" | "button", y: number, z: number, r = 0.07): void {
  const hex = kind === "pink" ? "#ff8fb1" : kind === "button" ? "#5c3a26" : "#1b1b24";
  const n = f.add(SPHERE(r), mat(f, hex), 0, y, z, f.head);
  if (kind === "pink") n.scale.set(1.3, 0.9, 0.8);
}

function whiskers(f: Face, y: number, z: number, len = 0.3, hex = "#f4f1ea"): void {
  const g = new THREE.BoxGeometry(len, 0.014, 0.014);
  const m = mat(f, hex);
  for (const side of [1, -1]) {
    f.add(g, m, side * (0.22 + len / 2), y, z, f.head).rotation.z = side * 0.18;
    f.add(g, m, side * (0.22 + len / 2), y - 0.06, z, f.head).rotation.z = -side * 0.1;
  }
}

function cheeks(f: Face, y: number, z: number, x = 0.27): void {
  const pink = mat(f, "#ff9aa8");
  f.add(SPHERE(0.05), pink, x, y, z, f.head);
  f.add(SPHERE(0.05), pink, -x, y, z, f.head);
}

function earsTall(f: Face, m: THREE.Material, inner: THREE.Material, o: { x: number; y: number; h: number; tilt: number; w?: number }): void {
  const w = o.w ?? 0.11;
  for (const side of [1, -1]) {
    const e = f.add(new THREE.CapsuleGeometry(w, o.h, 4, 8), m, side * o.x, o.y + o.h / 2, -0.04, f.head);
    e.scale.z = 0.55;
    e.rotation.z = -side * o.tilt;
    const i = f.add(new THREE.CapsuleGeometry(w * 0.55, o.h * 0.8, 4, 8), inner, side * o.x, o.y + o.h / 2, -0.04 + w * 0.35, f.head);
    i.scale.z = 0.4;
    i.rotation.z = -side * o.tilt;
  }
}

function earsPointy(f: Face, m: THREE.Material, inner: THREE.Material, o: { x: number; y: number; tilt: number; size: number }): void {
  for (const side of [1, -1]) {
    f.add(new THREE.ConeGeometry(o.size, o.size * 2.3, 8), m, side * o.x, o.y, -0.02, f.head).rotation.z = -side * o.tilt;
    f.add(new THREE.ConeGeometry(o.size * 0.55, o.size * 1.5, 8), inner, side * o.x, o.y - o.size * 0.1, 0.03, f.head).rotation.z = -side * o.tilt;
  }
}

function earsFloppy(f: Face, m: THREE.Material, o: { x: number; y: number }): void {
  for (const side of [1, -1]) {
    const e = f.add(SPHERE(0.16), m, side * o.x, o.y, -0.02, f.head);
    e.scale.set(0.7, 1.9, 0.5);
    e.rotation.z = -side * 0.2;
  }
}

function earsRound(f: Face, m: THREE.Material, inner: THREE.Material | null, o: { x: number; y: number; r: number; z?: number }): void {
  for (const side of [1, -1]) {
    f.add(SPHERE(o.r), m, side * o.x, o.y, o.z ?? -0.05, f.head);
    if (inner) f.add(SPHERE(o.r * 0.55), inner, side * o.x, o.y, (o.z ?? -0.05) + o.r * 0.55, f.head);
  }
}

function tailOf(f: Face, kind: "cat" | "bushy" | "dino" | "monkey" | "curly", m: THREE.Material, tip?: THREE.Material): void {
  switch (kind) {
    case "cat":
      f.add(new THREE.CylinderGeometry(0.055, 0.045, 0.75, 7), m, 0.28, -0.08, -0.45, f.rig).rotation.x = 0.55;
      return;
    case "bushy": {
      f.add(new THREE.ConeGeometry(0.17, 0.85, 8), m, 0.22, -0.12, -0.5, f.rig).rotation.x = -1.15;
      if (tip) f.add(SPHERE(0.14), tip, 0.22, 0.2, -0.86, f.rig);
      return;
    }
    case "dino":
      f.add(new THREE.ConeGeometry(0.12, 0.85, 7), m, 0, -0.08, -0.62, f.rig).rotation.x = -1.3;
      return;
    case "monkey": {
      f.add(new THREE.CylinderGeometry(0.04, 0.035, 0.8, 6), m, 0.22, -0.15, -0.5, f.rig).rotation.x = 0.9;
      f.add(SPHERE(0.05), m, 0.22, 0.16, -0.82, f.rig);
      return;
    }
    case "curly": {
      const t = f.add(new THREE.TorusGeometry(0.08, 0.025, 6, 12, Math.PI * 1.6), m, 0, -0.12, -0.46, f.rig);
      t.rotation.y = Math.PI / 2;
      return;
    }
  }
}

const CHARACTERS: Record<CharacterId, CharacterDef> = {
  kid: {
    body: (f) => mat(f, shadeHex(f.kart, -0.15)),
    build(f) {
      const skin = mat(f, pick(SKINS, f.name, "s"));
      headSphere(f, skin);
      const hair = mat(f, pick(["#3b2a1a", "#1b1b24", "#c98a3c", "#b5451b", "#e6c27a", "#6b4a2b"], f.name, "h"));
      f.add(new THREE.SphereGeometry(H * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), hair, 0, 0.03, -0.02, f.head);
      bigEyes(f, { x: 0.15, y: 0.07, z: H * 0.8, rx: 0.11, ry: 0.13, pupil: "#3b2a1a" });
      grin(f, { y: -0.15, z: H * 0.86, w: 0.2, h: 0.09, teeth: 4, tongue: true });
      cheeks(f, -0.07, H * 0.76);
      return { top: H * 1.03 };
    },
  },
  bunny: {
    body: (f) => mat(f, pick(["#ffffff", "#7fe9f0", "#c7b9ff", "#ffd6e0"], f.name, "b")),
    belly: "#fff7f7",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#ffffff", { y: -0.1, z: H * 0.78, rx: 0.27, ry: 0.21, rz: 0.2 });
      noseOf(f, "pink", -0.02, H * 0.78 + 0.18, 0.06);
      bigEyes(f, { x: 0.16, y: 0.12, z: H * 0.78, rx: 0.13, ry: 0.16, pupil: "#3b2a1a", pr: 0.075 });
      grin(f, { y: -0.2, z: H * 0.9, w: 0.2, h: 0.11, buck: true, tongue: true });
      whiskers(f, -0.06, H * 0.9, 0.28, "#9aa3b2");
      const inner = mat(f, pick(["#ff9aa8", "#dff6ff", "#ffe9f0", "#ffd6e0"], f.name, "b"));
      earsTall(f, body, inner, { x: 0.19, y: H * 0.8, h: 0.78, tilt: 0.14 });
      return { top: H * 1.0 };
    },
  },
  cat: {
    body: (f) => mat(f, pick(["#f59e0b", "#9ca3af", "#374151", "#f4f1ea"], f.name, "c")),
    belly: "#f4f1ea",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#f4f1ea", { y: -0.14, z: H * 0.78, rx: 0.24, ry: 0.17, rz: 0.17 });
      noseOf(f, "pink", -0.06, H * 0.78 + 0.16, 0.055);
      bigEyes(f, { x: 0.16, y: 0.09, z: H * 0.8, rx: 0.11, ry: 0.14, pupil: "#166534" });
      grin(f, { y: -0.23, z: H * 0.88, w: 0.17, h: 0.08, fangs: true, tongue: true });
      whiskers(f, -0.1, H * 0.86);
      earsPointy(f, body, mat(f, "#ff9aa8"), { x: 0.3, y: H * 0.82, tilt: 0.35, size: 0.15 });
      tailOf(f, "cat", body);
      return { top: H * 0.96 };
    },
  },
  dog: {
    body: (f) => mat(f, pick(["#a16207", "#8d5a3b", "#d4a373", "#f4f1ea"], f.name, "d")),
    belly: "#e8c9a0",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#e8c9a0", { y: -0.14, z: H * 0.75, rx: 0.24, ry: 0.19, rz: 0.3 });
      noseOf(f, "dot", -0.04, H * 0.75 + 0.3, 0.08);
      bigEyes(f, { x: 0.16, y: 0.11, z: H * 0.8, rx: 0.11, ry: 0.13, pupil: "#3b2a1a" });
      grin(f, { y: -0.26, z: H * 0.9, w: 0.17, h: 0.07, teeth: 2, tongue: true });
      earsFloppy(f, mat(f, "#5c3a26"), { x: H * 0.95, y: -0.02 });
      return { top: H };
    },
  },
  pig: {
    body: (f) => mat(f, pick(["#ffb3c6", "#f9a8d4", "#fda4af"], f.name, "p")),
    belly: "#ffe4ec",
    build(f, body) {
      headSphere(f, body, H, 0.95, 1);
      const snout = f.add(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 12), mat(f, "#f98cb0"), 0, -0.07, H * 0.95, f.head);
      snout.rotation.x = Math.PI / 2;
      f.add(SPHERE(0.03), mat(f, "#7a2a44"), 0.05, -0.06, H * 0.95 + 0.07, f.head);
      f.add(SPHERE(0.03), mat(f, "#7a2a44"), -0.05, -0.06, H * 0.95 + 0.07, f.head);
      bigEyes(f, { x: 0.15, y: 0.13, z: H * 0.8, rx: 0.1, ry: 0.12 });
      grin(f, { y: -0.26, z: H * 0.86, w: 0.15, h: 0.06, tongue: true });
      for (const side of [1, -1]) f.add(new THREE.ConeGeometry(0.1, 0.24, 7), body, side * 0.3, H * 0.72, 0, f.head).rotation.z = -side * 0.9;
      tailOf(f, "curly", body);
      return { top: H * 0.95 };
    },
  },
  chick: {
    body: (f) => mat(f, "#ffd400"),
    belly: "#fff1a8",
    build(f, body) {
      headSphere(f, body, H * 0.96);
      f.add(new THREE.ConeGeometry(0.12, 0.3, 8), mat(f, "#ff8a1f"), 0, -0.04, H * 0.98, f.head).rotation.x = Math.PI / 2;
      const red = mat(f, "#e03131");
      f.add(SPHERE(0.06), red, 0, H * 0.92, 0.1, f.head);
      f.add(SPHERE(0.07), red, 0, H * 0.99, 0, f.head);
      f.add(SPHERE(0.06), red, 0, H * 0.92, -0.1, f.head);
      bigEyes(f, { x: 0.14, y: 0.13, z: H * 0.84, rx: 0.08, ry: 0.1, dark: true });
      cheeks(f, -0.04, H * 0.74);
      return { top: H * 0.9 };
    },
  },
  frog: {
    body: (f) => mat(f, pick(["#4ade80", "#84cc16", "#2dd4bf"], f.name, "f")),
    belly: "#ecfccb",
    build(f, body) {
      headSphere(f, body, H, 0.82, 1.05);
      for (const side of [1, -1]) {
        f.add(SPHERE(0.15), mat(f, "#ffffff"), side * 0.2, H * 0.62, 0.08, f.head);
        f.add(SPHERE(0.075), mat(f, "#1b1b24"), side * 0.2, H * 0.62, 0.21, f.head);
      }
      smileLine(f, -0.08, H * 0.88, 0.3);
      grin(f, { y: -0.16, z: H * 0.9, w: 0.3, h: 0.045 });
      cheeks(f, -0.02, H * 0.8, 0.33);
      return { top: H * 0.65 };
    },
  },
  bear: {
    body: (f) => mat(f, pick(["#6b4a2b", "#3b2a1a", "#f4f1ea", "#a67b55"], f.name, "r")),
    belly: "#e8c9a0",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#e8c9a0", { y: -0.14, z: H * 0.8, rx: 0.23, ry: 0.18, rz: 0.2 });
      noseOf(f, "dot", -0.06, H * 0.8 + 0.19, 0.085);
      bigEyes(f, { x: 0.16, y: 0.11, z: H * 0.82, rx: 0.09, ry: 0.11 });
      grin(f, { y: -0.25, z: H * 0.88, w: 0.14, h: 0.06, teeth: 2 });
      earsRound(f, body, mat(f, "#e8c9a0"), { x: 0.33, y: H * 0.76, r: 0.15 });
      return { top: H };
    },
  },
  monkey: {
    body: (f) => mat(f, pick(["#8d5a3b", "#6b4a2b", "#a67b55"], f.name, "m")),
    belly: "#e8c9a0",
    build(f, body) {
      headSphere(f, body);
      const face = f.add(SPHERE(1), mat(f, "#e8c9a0"), 0, -0.06, H * 0.72, f.head);
      face.scale.set(0.36, 0.33, 0.18);
      bigEyes(f, { x: 0.14, y: 0.09, z: H * 0.84, rx: 0.1, ry: 0.12 });
      f.add(SPHERE(0.025), mat(f, "#5c3a26"), 0.05, -0.07, H * 0.72 + 0.17, f.head);
      f.add(SPHERE(0.025), mat(f, "#5c3a26"), -0.05, -0.07, H * 0.72 + 0.17, f.head);
      grin(f, { y: -0.2, z: H * 0.98, w: 0.17, h: 0.07, teeth: 3 });
      earsRound(f, body, mat(f, "#e8c9a0"), { x: H * 0.98, y: 0.02, r: 0.14, z: 0 });
      tailOf(f, "monkey", body);
      return { top: H };
    },
  },
  panda: {
    body: (f) => mat(f, "#f4f1ea"),
    torso(f) {
      f.add(new THREE.CapsuleGeometry(0.3, 0.42, 4, 10), mat(f, "#1b1b24"), 0, 0, 0, f.rig);
      const b = f.add(SPHERE(1), mat(f, "#f4f1ea"), 0, -0.04, 0.2, f.rig);
      b.scale.set(0.22, 0.26, 0.14);
    },
    build(f, body) {
      headSphere(f, body);
      const black = mat(f, "#1b1b24");
      for (const side of [1, -1]) {
        const patch = f.add(SPHERE(1), black, side * 0.17, 0.07, H * 0.84, f.head);
        patch.scale.set(0.15, 0.19, 0.08);
        patch.rotation.z = -side * 0.35;
      }
      bigEyes(f, { x: 0.17, y: 0.07, z: H * 0.9, rx: 0.075, ry: 0.085 });
      noseOf(f, "dot", -0.1, H * 0.98, 0.07);
      grin(f, { y: -0.22, z: H * 0.88, w: 0.13, h: 0.055, tongue: true });
      earsRound(f, black, null, { x: 0.33, y: H * 0.76, r: 0.15 });
      return { top: H };
    },
  },
  fox: {
    body: (f) => mat(f, pick(["#f97316", "#ea580c", "#fb923c"], f.name, "x")),
    belly: "#fff7ed",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#fff7ed", { y: -0.14, z: H * 0.74, rx: 0.24, ry: 0.18, rz: 0.3 });
      noseOf(f, "dot", -0.06, H * 0.74 + 0.3, 0.07);
      bigEyes(f, { x: 0.16, y: 0.1, z: H * 0.8, rx: 0.1, ry: 0.12, tilt: 0.2 });
      grin(f, { y: -0.25, z: H * 0.9, w: 0.14, h: 0.06, fangs: true });
      whiskers(f, -0.1, H * 0.86, 0.26);
      earsPointy(f, body, mat(f, "#1b1b24"), { x: 0.3, y: H * 0.84, tilt: 0.3, size: 0.19 });
      tailOf(f, "bushy", body, mat(f, "#fff7ed"));
      return { top: H * 0.95 };
    },
  },
  penguin: {
    body: (f) => mat(f, "#1b1b24"),
    hands: "flipper",
    belly: "#f4f1ea",
    build(f, body) {
      headSphere(f, body);
      const face = f.add(SPHERE(1), mat(f, "#f4f1ea"), 0, -0.03, H * 0.62, f.head);
      face.scale.set(0.37, 0.4, 0.2);
      f.add(new THREE.ConeGeometry(0.09, 0.3, 8), mat(f, "#ff8a1f"), 0, -0.06, H * 0.96, f.head).rotation.x = Math.PI / 2;
      bigEyes(f, { x: 0.13, y: 0.12, z: H * 0.84, rx: 0.085, ry: 0.1 });
      cheeks(f, -0.06, H * 0.76, 0.24);
      return { top: H * 0.98 };
    },
  },
  dino: {
    body: (f) => mat(f, pick(["#22c55e", "#8b5cf6", "#06b6d4", "#f97316"], f.name, "r")),
    belly: "#ecfccb",
    build(f, body) {
      headSphere(f, body, H, 0.95, 1.05);
      f.add(rbox(0.46, 0.26, 0.46), body, 0, -0.12, H * 0.85, f.head);
      f.add(SPHERE(0.03), mat(f, "#1b1b24"), 0.1, -0.02, 0.61, f.head);
      f.add(SPHERE(0.03), mat(f, "#1b1b24"), -0.1, -0.02, 0.61, f.head);
      grin(f, { y: -0.23, z: 0.56, w: 0.2, h: 0.07, teeth: 4 });
      const darker = mat(f, "#15803d");
      f.add(new THREE.ConeGeometry(0.07, 0.2, 6), darker, 0, H * 0.9, 0.12, f.head);
      f.add(new THREE.ConeGeometry(0.08, 0.24, 6), darker, 0, H * 0.98, -0.02, f.head);
      f.add(new THREE.ConeGeometry(0.07, 0.2, 6), darker, 0, H * 0.9, -0.16, f.head);
      bigEyes(f, { x: 0.17, y: 0.13, z: H * 0.78, rx: 0.1, ry: 0.12, white: "#ffd400" });
      tailOf(f, "dino", body);
      return { top: H * 0.9 };
    },
  },
  robot: {
    body: (f) => mat(f, "#9aa3b2"),
    hands: "claw",
    torso(f) {
      f.add(rbox(0.6, 0.62, 0.44), mat(f, "#9aa3b2"), 0, 0, 0, f.rig);
      f.add(new THREE.BoxGeometry(0.3, 0.2, 0.05), f.k.pal.glow("#6ff6ff", 1.5), 0, 0.08, 0.23, f.rig);
    },
    build(f) {
      const metal = mat(f, "#9aa3b2");
      const dark = mat(f, "#2a2f3f");
      const glow = f.k.pal.glow("#6ff6ff", 1.7);
      f.add(rbox(0.78, 0.7, 0.7, 0.08), metal, 0, 0.02, 0, f.head);
      f.add(new THREE.BoxGeometry(0.6, 0.42, 0.04), dark, 0, -0.02, 0.36, f.head);
      f.add(new THREE.BoxGeometry(0.15, 0.1, 0.03), glow, 0.17, 0.09, 0.39, f.head);
      f.add(new THREE.BoxGeometry(0.15, 0.1, 0.03), glow, -0.17, 0.09, 0.39, f.head);
      f.add(new THREE.BoxGeometry(0.3, 0.025, 0.03), glow, 0, -0.12, 0.39, f.head);
      f.add(new THREE.BoxGeometry(0.22, 0.025, 0.03), glow, 0, -0.18, 0.39, f.head);
      f.add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), metal, 0, 0.5, 0, f.head);
      f.add(SPHERE(0.07), f.k.pal.glow("#ff3b3b", 1.5), 0, 0.68, 0, f.head);
      f.add(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), dark, 0.42, 0.05, 0, f.head).rotation.z = Math.PI / 2;
      f.add(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), dark, -0.42, 0.05, 0, f.head).rotation.z = Math.PI / 2;
      return { top: 0.37 };
    },
  },
  shark: {
    body: (f) => mat(f, pick(["#64748b", "#94a3b8", "#3b82f6"], f.name, "k")),
    belly: "#f4f1ea",
    build(f, body) {
      headSphere(f, body, H, 0.9, 1.12);
      const under = f.add(SPHERE(1), mat(f, "#f4f1ea"), 0, -0.2, 0.12, f.head);
      under.scale.set(0.4, 0.26, 0.42);
      f.add(new THREE.ConeGeometry(0.13, 0.4, 7), body, 0, H * 0.95, -0.1, f.head).rotation.x = -0.5;
      bigEyes(f, { x: 0.2, y: 0.1, z: H * 0.84, rx: 0.075, ry: 0.085 });
      grin(f, { y: -0.16, z: H * 0.9, w: 0.3, h: 0.1, teeth: 6 });
      const gill = new THREE.BoxGeometry(0.02, 0.12, 0.05);
      for (const side of [1, -1]) for (let i = 0; i < 3; i++) f.add(gill, mat(f, "#334155"), side * 0.42, -0.05, -0.08 - i * 0.07, f.head);
      return { top: H * 0.85 };
    },
  },
  alien: {
    body: (f) => mat(f, pick(["#4ade80", "#86efac", "#67e8f9", "#c4b5fd"], f.name, "a")),
    build(f, body) {
      headSphere(f, body, H * 1.05, 1.15, 1, 0.05);
      bigEyes(f, { x: 0.17, y: 0.1, z: H * 0.92, rx: 0.14, ry: 0.2, tilt: 0.3, dark: true });
      smileLine(f, -0.22, H * 0.95, 0.1);
      for (const side of [1, -1]) {
        f.add(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), body, side * 0.14, H * 1.22, 0, f.head).rotation.z = -side * 0.3;
        f.add(SPHERE(0.06), f.k.pal.glow("#ffe066", 1.6), side * 0.22, H * 1.22 + 0.17, 0, f.head);
      }
      return { top: H * 1.22 };
    },
  },
  ghost: {
    body: (f) => mat(f, "#f4f1ea"),
    hands: "bare",
    torso(f, body) {
      f.add(new THREE.CapsuleGeometry(0.32, 0.36, 4, 10), body, 0, 0.02, 0, f.rig);
      for (const x of [-0.2, 0, 0.2]) f.add(SPHERE(0.12), body, x, -0.32, 0.05, f.rig);
    },
    build(f, body) {
      headSphere(f, body, H * 1.02, 1.05, 1);
      bigEyes(f, { x: 0.16, y: 0.08, z: H * 0.9, rx: 0.1, ry: 0.15, tilt: 0.25, dark: true });
      grin(f, { y: -0.18, z: H * 0.94, w: 0.1, h: 0.13, color: "#1b1b24" });
      return { top: H * 1.05 };
    },
  },
  skeleton: {
    body: (f) => mat(f, "#f4f1ea"),
    hands: "bare",
    torso(f, body) {
      f.add(new THREE.CapsuleGeometry(0.28, 0.4, 4, 10), mat(f, "#2a2f3f"), 0, 0, 0, f.rig);
      for (let i = 0; i < 3; i++) {
        const rib = f.add(new THREE.TorusGeometry(0.29, 0.03, 6, 14), body, 0, 0.16 - i * 0.14, 0, f.rig);
        rib.rotation.x = Math.PI / 2;
      }
    },
    build(f, body) {
      headSphere(f, body, H, 1.05, 1);
      f.add(rbox(0.5, 0.2, 0.42, 0.06), body, 0, -0.3, 0.1, f.head);
      bigEyes(f, { x: 0.16, y: 0.1, z: H * 0.86, rx: 0.12, ry: 0.15, dark: true });
      const hole = f.add(new THREE.ConeGeometry(0.045, 0.09, 5), mat(f, "#1b1b24"), 0, -0.08, H * 0.98, f.head);
      hole.rotation.x = Math.PI;
      f.add(new THREE.BoxGeometry(0.36, 0.08, 0.06), mat(f, "#1b1b24"), 0, -0.24, H * 0.93, f.head);
      for (let i = 0; i < 5; i++) f.add(new THREE.BoxGeometry(0.05, 0.08, 0.05), body, -0.14 + i * 0.07, -0.24, H * 0.95, f.head);
      return { top: H * 1.03 };
    },
  },
  unicorn: {
    body: (f) => mat(f, "#ffffff"),
    belly: "#fdf2f8",
    build(f, body) {
      headSphere(f, body);
      muzzle(f, "#fdf2f8", { y: -0.12, z: H * 0.78, rx: 0.25, ry: 0.19, rz: 0.2 });
      noseOf(f, "pink", -0.04, H * 0.78 + 0.18, 0.06);
      bigEyes(f, { x: 0.15, y: 0.1, z: H * 0.8, rx: 0.11, ry: 0.14, pupil: "#8b5cf6" });
      smileLine(f, -0.22, H * 0.9, 0.1);
      cheeks(f, -0.06, H * 0.76);
      f.add(new THREE.ConeGeometry(0.07, 0.42, 8), f.k.pal.toon("#ffcc33", "#5a4200", 0.3), 0, H * 0.95, 0.12, f.head).rotation.x = -0.35;
      const mane = ["#ff5d8f", "#ff8a1f", "#ffd400", "#22c55e", "#3d5aff", "#8b5cf6"];
      mane.forEach((c, i) => {
        const m = f.add(SPHERE(0.1), mat(f, c), 0, H * 0.9 - i * 0.07, -0.08 - i * 0.09, f.head);
        m.scale.set(1.3, 1, 0.8);
      });
      earsPointy(f, body, mat(f, "#ff9aa8"), { x: 0.25, y: H * 0.86, tilt: 0.3, size: 0.09 });
      mane.slice(0, 4).forEach((c, i) => f.add(new THREE.ConeGeometry(0.06, 0.5, 6), mat(f, c), (i - 1.5) * 0.08, -0.1, -0.55, f.rig).rotation.x = -1.2);
      return { top: H };
    },
  },
  dragon: {
    body: (f) => mat(f, pick(["#dc2626", "#7c3aed", "#0f766e"], f.name, "g")),
    belly: "#fde68a",
    build(f, body) {
      headSphere(f, body, H, 0.95, 1.1);
      f.add(rbox(0.42, 0.26, 0.46), body, 0, -0.12, H * 0.85, f.head);
      f.add(SPHERE(0.035), mat(f, "#1b1b24"), 0.09, -0.03, 0.61, f.head);
      f.add(SPHERE(0.035), mat(f, "#1b1b24"), -0.09, -0.03, 0.61, f.head);
      grin(f, { y: -0.23, z: 0.56, w: 0.18, h: 0.07, teeth: 4, fangs: true });
      bigEyes(f, { x: 0.18, y: 0.13, z: H * 0.78, rx: 0.1, ry: 0.11, white: "#ffd400" });
      const horn = mat(f, "#fde68a");
      for (const side of [1, -1]) {
        const h = f.add(new THREE.ConeGeometry(0.07, 0.34, 7), horn, side * 0.2, H * 0.88, -0.1, f.head);
        h.rotation.z = -side * 0.4;
        h.rotation.x = -0.4;
      }
      const darker = mat(f, shadeHex("#dc2626", -0.3));
      for (const side of [1, -1]) {
        const wing = f.add(new THREE.ConeGeometry(0.32, 0.7, 4), darker, side * 0.32, 0.25, -0.32, f.rig);
        wing.scale.z = 0.15;
        wing.rotation.z = -side * 1.25;
        wing.rotation.y = side * 0.4;
      }
      tailOf(f, "dino", body);
      f.add(new THREE.ConeGeometry(0.1, 0.2, 4), horn, 0, 0.3, -1.0, f.rig).rotation.x = -1.3;
      return { top: H * 0.9 };
    },
  },
};

/** The driver: torso, arms (pivoting at the shoulders), the character's head, then the hat. */
function buildCharacter(k: Kit, s: Style, lo: Loadout, name: string, shadow: boolean): { rig: THREE.Group; head: THREE.Group; headY: number; arms: [THREE.Group, THREE.Group] } {
  const rig = new THREE.Group();
  rig.position.set(0, s.driverY, s.driverZ);
  k.body.add(rig);
  const add: AddFn = (geo, mat, x, y, z, parent = rig) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  };
  const head = new THREE.Group();
  const f: Face = { k, head, rig, add, name, kart: lo.color, shadow };
  const ch = CHARACTERS[lo.character];
  const body = ch.body(f);
  if (ch.torso) ch.torso(f, body);
  else {
    add(new THREE.CapsuleGeometry(0.3, 0.42, 4, 10), body, 0, 0, 0);
    if (ch.belly) {
      const b = add(SPHERE(1), mat(f, ch.belly), 0, -0.04, 0.2);
      b.scale.set(0.22, 0.26, 0.14);
    }
  }
  add(new THREE.TorusGeometry(0.22, 0.035, 6, 14), k.dark, 0, 0.02, 0.62).rotation.x = -0.55;
  const arms = buildArms(f, body, ch.hands ?? "glove");
  const headY = 0.8;
  head.position.set(0, headY, 0.02);
  rig.add(head);
  const parts = ch.build(f, body);
  const hat = new THREE.Group();
  hat.position.set(0, parts.top, 0);
  hat.scale.setScalar(1.3);
  head.add(hat);
  buildHat(lo.hat, k, hat, lo.color, shadow, H / 1.3, parts.top / 1.3);
  return { rig, head, headY, arms };
}

/** Two arms hanging from shoulder pivots, hands on the wheel at rest. */
function buildArms(f: Face, body: THREE.Material, style: HandStyle): [THREE.Group, THREE.Group] {
  const out: THREE.Group[] = [];
  const dark = mat(f, "#2a2f3f");
  const cuff = mat(f, f.kart);
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.33, 0.22, 0.05);
    f.rig.add(pivot);
    const hand = new THREE.Vector3(side * -0.13, -0.18, 0.53);
    const dir = hand.clone().normalize();
    if (style === "flipper") {
      const flip = new THREE.Mesh(new THREE.ConeGeometry(0.1, hand.length() + 0.1, 8), body);
      flip.position.copy(hand).multiplyScalar(0.5);
      flip.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      flip.scale.z = 0.45;
      flip.castShadow = f.shadow;
      pivot.add(flip);
    } else {
      limb(pivot, new THREE.Vector3(0, 0, 0), hand, 0.085, body, f.shadow);
      if (style === "glove") {
        const g = new THREE.Mesh(SPHERE(0.14), dark);
        g.position.copy(hand);
        g.castShadow = f.shadow;
        pivot.add(g);
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 12), cuff);
        c.position.copy(hand).multiplyScalar(0.78);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        pivot.add(c);
      } else if (style === "claw") {
        const g = new THREE.Mesh(rbox(0.2, 0.16, 0.2, 0.04), dark);
        g.position.copy(hand);
        pivot.add(g);
      } else {
        const g = new THREE.Mesh(SPHERE(0.11), body);
        g.position.copy(hand);
        g.castShadow = f.shadow;
        pivot.add(g);
      }
    }
    out.push(pivot);
  }
  return [out[0], out[1]];
}

/** A cylinder from a to b: an arm. */
function limb(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, shadow: boolean): void {
  const d = b.clone().sub(a);
  const len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.castShadow = shadow;
  parent.add(mesh);
}

/** Hats are built around the head top (y = 0) in a group scaled to the head. */
function buildHat(hat: HatId, k: Kit, g: THREE.Group, color: string, shadow: boolean, headR: number, headTop: number): void {
  const { pal } = k;
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    g.add(m);
    return m;
  };
  switch (hat) {
    case "none":
      return;
    case "cap": {
      mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 12), pal.toon(shadeHex(color, 0.2)), 0, 0.05, 0);
      mesh(new THREE.BoxGeometry(0.5, 0.05, 0.34), pal.toon(shadeHex(color, 0.2)), 0, 0, 0.4);
      return;
    }
    case "helmet": {
      const r = headR + 0.06;
      const h = mesh(new THREE.SphereGeometry(r, 14, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.62), k.chassis, 0, -headTop + 0.02, 0);
      h.castShadow = false;
      mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), k.glass, 0, -headTop + r * 0.55, r * 0.82);
      return;
    }
    case "crown": {
      const gold = pal.toon("#ffcc33", "#5a4200", 0.2);
      mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.22, 8), gold, 0, 0.08, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        mesh(new THREE.SphereGeometry(0.06, 6, 5), pal.glow("#ff5d8f", 1.2), Math.cos(a) * 0.23, 0.24, Math.sin(a) * 0.23);
      }
      return;
    }
    case "horns": {
      const red = pal.toon("#e03131");
      mesh(new THREE.ConeGeometry(0.09, 0.45, 7), red, 0.22, 0.1, 0).rotation.z = -0.5;
      mesh(new THREE.ConeGeometry(0.09, 0.45, 7), red, -0.22, 0.1, 0).rotation.z = 0.5;
      return;
    }
    case "halo": {
      mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 20), pal.glow("#ffe066", 1.8), 0, 0.3, 0).rotation.x = Math.PI / 2;
      return;
    }
    case "tophat": {
      const black = pal.toon("#1b1b24");
      mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 14), black, 0, -0.02, 0);
      mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.46, 14), black, 0, 0.22, 0);
      mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.08, 14), pal.toon("#e03131"), 0, 0.05, 0);
      return;
    }
    case "beanie": {
      mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.toon("#5b8def"), 0, -0.12, 0);
      mesh(new THREE.SphereGeometry(0.1, 8, 6), pal.toon("#ffffff"), 0, 0.26, 0);
      return;
    }
    case "pumpkin": {
      mesh(new THREE.SphereGeometry(0.36, 12, 9), pal.toon("#ff7a1a"), 0, 0.1, 0).scale.y = 0.85;
      mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6), pal.toon("#3f7d2c"), 0, 0.46, 0);
      return;
    }
    case "viking": {
      const steel = pal.toon("#9aa3b2");
      mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, -0.1, 0);
      mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 12), pal.toon("#6b4a2b"), 0, -0.08, 0);
      const horn = pal.toon("#f4f1ea");
      mesh(new THREE.ConeGeometry(0.09, 0.4, 7), horn, 0.36, 0.08, 0).rotation.z = -0.9;
      mesh(new THREE.ConeGeometry(0.09, 0.4, 7), horn, -0.36, 0.08, 0).rotation.z = 0.9;
      return;
    }
    case "cowboy": {
      const brown = pal.toon("#8d5a3b");
      mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 14), brown, 0, -0.02, 0);
      mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.32, 12), brown, 0, 0.16, 0);
      mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 12), pal.toon("#2a2f3f"), 0, 0.04, 0);
      return;
    }
    case "wizard": {
      const purple = pal.toon("#5b3ea6");
      mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), purple, 0, -0.02, 0);
      mesh(new THREE.ConeGeometry(0.3, 0.9, 12), purple, 0, 0.42, 0).rotation.z = 0.15;
      mesh(new THREE.SphereGeometry(0.07, 6, 5), pal.glow("#ffe066", 1.5), 0.15, 0.2, 0.26);
      mesh(new THREE.SphereGeometry(0.05, 6, 5), pal.glow("#ffe066", 1.5), -0.18, 0.5, 0.12);
      return;
    }
    case "cone": {
      mesh(new THREE.ConeGeometry(0.3, 0.8, 10), pal.toon("#ff7a1a"), 0, 0.32, 0);
      mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.1, 10), pal.toon("#ffffff"), 0, 0.36, 0);
      mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), pal.toon("#262a33"), 0, -0.02, 0);
      return;
    }
    case "duck": {
      const yellow = pal.toon("#ffd400");
      mesh(new THREE.SphereGeometry(0.26, 12, 9), yellow, 0, 0.15, 0);
      mesh(new THREE.SphereGeometry(0.2, 12, 9), yellow, 0, 0.42, 0.1);
      mesh(new THREE.BoxGeometry(0.16, 0.08, 0.2), pal.toon("#ff8a1f"), 0, 0.38, 0.32);
      mesh(new THREE.SphereGeometry(0.04, 6, 5), pal.toon("#1b1b24"), 0.09, 0.48, 0.22);
      mesh(new THREE.SphereGeometry(0.04, 6, 5), pal.toon("#1b1b24"), -0.09, 0.48, 0.22);
      return;
    }
  }
}

// ----- decals -----

/** A hood texture: the paint colour with a pattern over it. */
function decalTexture(decal: DecalId, color: string, name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  const ink = "rgba(255,255,255,0.92)";
  switch (decal) {
    case "stripes":
      ctx.fillStyle = ink;
      ctx.fillRect(94, 0, 22, 256);
      ctx.fillRect(140, 0, 22, 256);
      break;
    case "checker": {
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? "#ffffff" : "#1b1b24";
          ctx.fillRect(i * 32, 96 + j * 22, 32, 22);
        }
      }
      break;
    }
    case "flames": {
      const g = ctx.createLinearGradient(0, 256, 0, 60);
      g.addColorStop(0, "#ffd400");
      g.addColorStop(0.5, "#ff8a1f");
      g.addColorStop(1, "#ff3d1f");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 256);
      for (let i = 0; i <= 8; i++) {
        const x = i * 32;
        ctx.quadraticCurveTo(x + 8, 150 - (i % 3) * 25, x + 16, 70 + (i % 2) * 40);
        ctx.quadraticCurveTo(x + 24, 150 - ((i + 1) % 3) * 25, x + 32, 256);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "number": {
      const n = 10 + (hashName(name) % 90);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(128, 128, 88, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b1b24";
      ctx.font = "900 120px 'Baloo 2', 'Nunito', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), 128, 136);
      break;
    }
    case "plain":
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
