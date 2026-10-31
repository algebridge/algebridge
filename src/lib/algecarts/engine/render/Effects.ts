import * as THREE from "three";

/** Dark rubber marks left under drifting or braking wheels, fading back to the ground colour. */
export class SkidMarks {
  readonly mesh: THREE.InstancedMesh;
  private readonly cap: number;
  private used = 0;
  private next = 0;
  private readonly ages: Float32Array;
  private readonly dummy = new THREE.Object3D();
  private readonly dark = new THREE.Color("#2b2420");
  private readonly ground = new THREE.Color("#e9c27a");
  private readonly tmp = new THREE.Color();

  constructor(capacity = 600) {
    this.cap = capacity;
    this.ages = new Float32Array(capacity);
    const geo = new THREE.PlaneGeometry(0.34, 0.8);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.dark);
    this.mesh.count = 0;
    this.mesh.renderOrder = -2;
  }

  setGroundColor(hex: string): void {
    this.ground.set(hex);
  }

  add(x: number, y: number, z: number, yaw: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.used = Math.min(this.cap, this.used + 1);
    this.ages[i] = 0;
    this.dummy.position.set(x, y + 0.02, z);
    this.dummy.rotation.set(0, yaw, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.setColorAt(i, this.dark);
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    if (!this.used) return;
    for (let i = 0; i < this.used; i++) {
      const a = (this.ages[i] += dt);
      const t = Math.min(1, a / 9);
      this.mesh.setColorAt(i, this.tmp.copy(this.dark).lerp(this.ground, t * t));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.used = 0;
    this.next = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

/** A few point lights that flash on blasts and fade out. */
export class FlashLights {
  readonly group = new THREE.Group();
  private readonly pool: { light: THREE.PointLight; t: number; max: number; peak: number }[] = [];

  constructor(n = 3) {
    for (let i = 0; i < n; i++) {
      const light = new THREE.PointLight("#ffb347", 0, 26, 2);
      light.visible = false;
      this.group.add(light);
      this.pool.push({ light, t: 0, max: 1, peak: 0 });
    }
  }

  flash(x: number, y: number, z: number, color: string, peak: number, duration: number): void {
    const s = this.pool.find((p) => !p.light.visible) ?? this.pool.reduce((a, b) => (a.t / a.max > b.t / b.max ? a : b));
    s.light.position.set(x, y, z);
    s.light.color.set(color);
    s.light.intensity = peak;
    s.light.visible = true;
    s.t = 0;
    s.max = duration;
    s.peak = peak;
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (!s.light.visible) continue;
      s.t += dt;
      const t = Math.min(1, s.t / s.max);
      s.light.intensity = s.peak * (1 - t) * (1 - t);
      if (t >= 1) s.light.visible = false;
    }
  }
}

/** Floating damage numbers over whoever just got hit. */
export class DamageNumbers {
  readonly group = new THREE.Group();
  private readonly pool: { sprite: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; t: number; vy: number }[] = [];

  constructor(n = 14) {
    for (let i = 0; i < n; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sprite.scale.set(2.0, 1.0, 1);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.group.add(sprite);
      this.pool.push({ sprite, canvas, tex, t: 1, vy: 0 });
    }
  }

  show(x: number, y: number, z: number, text: string, color: string): void {
    const s = this.pool.find((p) => !p.sprite.visible) ?? this.pool.reduce((a, b) => (a.t > b.t ? a : b));
    const ctx = s.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = "900 44px 'Baloo 2', 'Nunito', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(20,18,30,0.9)";
    ctx.strokeText(text, 64, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 34);
    s.tex.needsUpdate = true;
    s.sprite.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8);
    s.sprite.visible = true;
    (s.sprite.material as THREE.SpriteMaterial).opacity = 1;
    s.t = 0;
    s.vy = 2.6;
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (!s.sprite.visible) continue;
      s.t += dt;
      s.sprite.position.y += s.vy * dt;
      s.vy = Math.max(0.6, s.vy - 4 * dt);
      const k = 1 + Math.min(0.3, s.t * 1.2);
      s.sprite.scale.set(2.0 * k, 1.0 * k, 1);
      (s.sprite.material as THREE.SpriteMaterial).opacity = s.t < 0.5 ? 1 : Math.max(0, 1 - (s.t - 0.5) / 0.4);
      if (s.t > 0.9) s.sprite.visible = false;
    }
  }

  dispose(): void {
    for (const s of this.pool) {
      s.tex.dispose();
      (s.sprite.material as THREE.Material).dispose();
    }
  }
}
