import * as THREE from "three";
import type { Palette } from "../render/Materials";
import type { ArenaTheme } from "./Arena";

export type PropKind =
  | "rock"
  | "cactus"
  | "flag"
  | "lamp"
  | "crane"
  | "buoy"
  | "pine"
  | "palm"
  | "mesa"
  | "mountain"
  | "building"
  | "barrel"
  | "tires"
  | "cone"
  | "crate"
  | "sign"
  | "mark"
  | "boulder";

/** Scenery that never collides: inside the walls as dressing, outside as the world beyond. */
export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  y?: number;
  /** Scale, 1 by default. */
  s?: number;
  /** Turn, radians. */
  ry?: number;
  color?: string;
  /** Height for buildings, mesas and mountains; length for marks. */
  h?: number;
  /** Width for marks. */
  w?: number;
}

export function buildProp(p: Prop, t: ArenaTheme, pal: Palette, quality: "high" | "low"): THREE.Object3D {
  const g = new THREE.Group();
  const s = p.s ?? 1;
  const shadow = quality === "high";
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = shadow;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  switch (p.kind) {
    case "rock": {
      const m = add(new THREE.IcosahedronGeometry(1, 0), pal.toon(p.color ?? "#b98b64"), 0, 0.55, 0);
      m.scale.set(1.3, 0.75, 1);
      m.rotation.y = 0.6;
      const m2 = add(new THREE.IcosahedronGeometry(0.6, 0), pal.toon(p.color ?? "#b98b64"), 0.9, 0.35, 0.5);
      m2.scale.set(1, 0.7, 1);
      break;
    }
    case "cactus": {
      const green = pal.toon(p.color ?? "#4caf50");
      add(new THREE.CylinderGeometry(0.42, 0.5, 3.2, 10), green, 0, 1.6, 0);
      add(new THREE.SphereGeometry(0.42, 10, 8), green, 0, 3.2, 0);
      add(new THREE.CylinderGeometry(0.26, 0.26, 1.2, 8), green, 0.75, 1.9, 0, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.26, 0.26, 1.1, 8), green, 1.25, 2.4, 0);
      add(new THREE.SphereGeometry(0.26, 8, 6), green, 1.25, 2.95, 0);
      add(new THREE.CylinderGeometry(0.24, 0.24, 1.0, 8), green, -0.65, 1.4, 0, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 8), green, -1.1, 1.85, 0);
      add(new THREE.SphereGeometry(0.24, 8, 6), green, -1.1, 2.3, 0);
      break;
    }
    case "flag": {
      add(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), pal.toon("#f4f1ea"), 0, 2.1, 0);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(1.6, -0.45);
      shape.lineTo(0, -0.9);
      shape.lineTo(0, 0);
      const flag = add(new THREE.ShapeGeometry(shape), pal.toon(p.color ?? t.wallStripe), 0.07, 4.15, 0);
      (flag.material as THREE.Material).side = THREE.DoubleSide;
      break;
    }
    case "lamp": {
      add(new THREE.CylinderGeometry(0.12, 0.18, 5.2, 8), pal.toon("#2a2f3f"), 0, 2.6, 0);
      add(new THREE.BoxGeometry(0.7, 0.3, 0.7), pal.toon("#2a2f3f"), 0, 5.3, 0);
      add(new THREE.SphereGeometry(0.42, 12, 10), pal.unlit(p.color ?? "#fff2b0"), 0, 4.95, 0);
      break;
    }
    case "crane": {
      const steel = pal.toon(p.color ?? "#ffb400");
      add(new THREE.BoxGeometry(2, 22, 2), steel, 0, 11, 0);
      add(new THREE.BoxGeometry(1.4, 1.4, 18), steel, 0, 22, 6);
      add(new THREE.BoxGeometry(2.4, 2.2, 3), pal.toon("#2a2f3f"), 0, 23.5, -1);
      add(new THREE.CylinderGeometry(0.05, 0.05, 10, 6), pal.toon("#2a2f3f"), 0, 17, 13);
      add(new THREE.BoxGeometry(2.4, 2.4, 2.4), pal.toon("#ff3df2"), 0, 11, 13);
      break;
    }
    case "buoy": {
      add(new THREE.SphereGeometry(1, 12, 10), pal.toon(p.color ?? "#ff5d3a"), 0, 0.2, 0);
      add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), pal.toon("#2a2f3f"), 0, 1.4, 0);
      add(new THREE.SphereGeometry(0.22, 8, 6), pal.unlit("#ffd400"), 0, 2.2, 0);
      break;
    }
    case "pine": {
      add(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), pal.toon("#6b4a2b"), 0, 0.8, 0);
      const leaf = pal.toon(p.color ?? "#2f8f5b");
      add(new THREE.ConeGeometry(1.7, 2.6, 8), leaf, 0, 2.6, 0);
      add(new THREE.ConeGeometry(1.25, 2.2, 8), leaf, 0, 4.1, 0);
      add(new THREE.ConeGeometry(0.8, 1.8, 8), leaf, 0, 5.4, 0);
      break;
    }
    case "palm": {
      add(new THREE.CylinderGeometry(0.22, 0.34, 5, 7), pal.toon("#8d6a43"), 0.3, 2.5, 0, 0, 0, -0.12);
      const leaf = pal.toon(p.color ?? "#3fae63");
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const m = add(new THREE.ConeGeometry(0.55, 3, 5), leaf, 0.6 + Math.cos(a) * 1.3, 5.1, Math.sin(a) * 1.3);
        m.rotation.set(Math.PI / 2 + 0.35, 0, 0);
        m.rotation.y = -a + Math.PI / 2;
        m.scale.set(1, 1, 0.25);
      }
      break;
    }
    case "mesa": {
      const h = p.h ?? 14;
      const w = 18 * s;
      add(new THREE.BoxGeometry(w, h, w * 0.8), pal.toon(p.color ?? "#c9603a"), 0, h / 2, 0);
      add(new THREE.BoxGeometry(w * 0.86, h * 0.35, w * 0.7), pal.toon(p.color ?? "#c9603a"), 0, h + h * 0.17, 0);
      add(new THREE.BoxGeometry(w * 0.88, 0.5, w * 0.72), pal.toon("#e07a4f"), 0, h * 1.35 + 0.2, 0);
      break;
    }
    case "mountain": {
      const h = p.h ?? 30;
      add(new THREE.ConeGeometry(h * 0.75, h, 7), pal.toon(p.color ?? "#6f4a7a"), 0, h / 2, 0);
      add(new THREE.ConeGeometry(h * 0.22, h * 0.3, 7), pal.toon("#fff5fa"), 0, h - h * 0.15 + 0.05, 0);
      break;
    }
    case "building": {
      const h = p.h ?? 20;
      const w = 10 * s;
      add(new THREE.BoxGeometry(w, h, w), pal.toon(p.color ?? "#1a2147"), 0, h / 2, 0);
      // Lit windows: a few bright strips.
      const win = pal.unlit("#ffe28a");
      for (let i = 0; i < Math.floor(h / 4); i++) {
        add(new THREE.BoxGeometry(w * 0.7, 0.5, 0.2), win, 0, 3 + i * 4, w / 2 + 0.05);
        add(new THREE.BoxGeometry(0.2, 0.5, w * 0.7), win, -w / 2 - 0.05, 3 + i * 4, 0);
      }
      add(new THREE.SphereGeometry(0.4, 8, 6), pal.unlit("#ff3b3b"), 0, h + 0.4, 0);
      break;
    }
    case "barrel": {
      const c = p.color ?? "#3d5aff";
      add(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 12), pal.toon(c), 0, 0.75, 0);
      add(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 12), pal.toon("#2a2f3f"), 0, 0.4, 0);
      add(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 12), pal.toon("#2a2f3f"), 0, 1.1, 0);
      break;
    }
    case "tires": {
      const rubber = pal.toon("#262a33");
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.7, 0.3, 8, 14), rubber, 0, 0.3 + i * 0.58, 0, Math.PI / 2);
      break;
    }
    case "cone": {
      add(new THREE.ConeGeometry(0.42, 1.2, 10), pal.toon("#ff7a1a"), 0, 0.6, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10), pal.unlit("#ffffff"), 0, 0.7, 0);
      add(new THREE.BoxGeometry(1, 0.12, 1), pal.toon("#262a33"), 0, 0.06, 0);
      break;
    }
    case "crate": {
      const c = p.color ?? "#c08a4b";
      add(new THREE.BoxGeometry(1.6, 1.6, 1.6), pal.toon(c), 0, 0.8, 0);
      add(new THREE.BoxGeometry(1.7, 0.16, 0.16), pal.toon("#6b4a2b"), 0, 0.8, 0.8);
      add(new THREE.BoxGeometry(0.16, 1.7, 0.16), pal.toon("#6b4a2b"), 0, 0.8, 0.8);
      break;
    }
    case "mark": {
      const m = add(new THREE.BoxGeometry(p.w ?? 0.4, 0.04, p.h ?? 6), pal.toon(p.color ?? t.wallStripe), 0, 0.02, 0);
      m.castShadow = false;
      break;
    }
    case "boulder": {
      const rock = pal.toon(p.color ?? "#a67b55");
      const m = add(new THREE.DodecahedronGeometry(1.4, 0), rock, 0, 1.0, 0);
      m.scale.set(1.2, 0.85, 1);
      const m2 = add(new THREE.DodecahedronGeometry(0.9, 0), rock, 1.3, 0.6, 0.6);
      m2.rotation.y = 0.8;
      add(new THREE.DodecahedronGeometry(0.6, 0), rock, -1.1, 0.4, -0.8);
      break;
    }
    case "sign": {
      add(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), pal.toon("#2a2f3f"), 0, 1.5, 0);
      add(new THREE.BoxGeometry(2.4, 1.2, 0.12), pal.toon(p.color ?? t.wallStripe), 0, 3, 0);
      break;
    }
  }
  g.position.set(p.x, p.y ?? 0, p.z);
  g.rotation.y = p.ry ?? 0;
  g.scale.setScalar(s);
  return g;
}
