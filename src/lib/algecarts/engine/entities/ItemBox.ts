import * as THREE from "three";
import type { Palette } from "../render/Materials";

/** A floating mystery box. Drive through it for a weapon; it comes back a few seconds later. */
export class ItemBox {
  readonly root = new THREE.Group();
  readonly x: number;
  readonly z: number;
  readonly y: number;
  active = true;
  respawnAt = 0;
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly cube: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private pop = 1;

  constructor(x: number, z: number, groundTop: number, mat: THREE.Material, pal: Palette) {
    this.x = x;
    this.z = z;
    this.y = groundTop + 1.25;
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), mat);
    this.cube.castShadow = true;
    this.glow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), pal.unlit("#ffe066", 0.16));
    this.root.add(this.cube, this.glow);
    this.root.position.set(x, this.y, z);
  }

  update(dt: number, now: number): void {
    if (!this.active) {
      if (now >= this.respawnAt) {
        this.active = true;
        this.pop = 0;
        this.root.visible = true;
      } else return;
    }
    this.pop = Math.min(1, this.pop + dt * 3);
    const s = this.pop < 1 ? 1.25 - 0.25 * Math.cos(this.pop * Math.PI) : 1;
    this.root.scale.setScalar(this.pop < 1 ? s * this.pop : 1);
    this.root.position.y = this.y + Math.sin(now * 2.2 + this.phase) * 0.18;
    this.cube.rotation.y += dt * 1.6;
    this.cube.rotation.x += dt * 0.7;
    this.glow.rotation.y -= dt * 0.9;
    this.glow.rotation.z += dt * 0.5;
  }

  take(now: number, respawnSeconds: number): void {
    this.active = false;
    this.respawnAt = now + respawnSeconds;
    this.root.visible = false;
  }

  dispose(): void {
    this.cube.geometry.dispose();
    this.glow.geometry.dispose();
  }
}

/** The "?" faces: drawn once per game to a canvas. */
export function itemBoxMaterial(pal: Palette): THREE.MeshToonMaterial {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, "#ff5d8f");
  g.addColorStop(1, "#ffb84d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.font = "900 92px 'Baloo 2', 'Nunito', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#5a1a3a";
  ctx.strokeText("?", 64, 70);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("?", 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: pal.gradient, emissive: "#ff5d8f", emissiveIntensity: 0.18 });
  m.userData.own = true;
  return m;
}
