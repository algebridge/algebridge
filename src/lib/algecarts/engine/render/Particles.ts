import * as THREE from "three";

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  c0: THREE.Color;
  c1: THREE.Color;
  grav: number;
  drag: number;
  cube: boolean;
  rot: number;
  rotV: number;
}

export interface EmitOpts {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size0: number;
  size1?: number;
  color0: string;
  color1?: string;
  gravity?: number;
  drag?: number;
  cube?: boolean;
  spin?: number;
}

/**
 * Smoke, fire, sparks and dust as two instanced meshes (low-poly spheres and
 * cubes), so a whole battle of explosions is two draw calls. Particles fade
 * by shrinking rather than by alpha, which keeps them cheap and cartoon-flat.
 */
export class Particles {
  readonly group = new THREE.Group();
  private readonly live: P[] = [];
  private readonly pool: P[] = [];
  private readonly spheres: THREE.InstancedMesh;
  private readonly cubes: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tmp = new THREE.Color();
  private readonly cap: number;

  constructor(capacity = 700) {
    this.cap = capacity;
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    this.spheres = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), mat, capacity);
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat, capacity);
    for (const m of [this.spheres, this.cubes]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, this.tmp.set("#ffffff"));
      m.count = 0;
      this.group.add(m);
    }
  }

  emit(o: EmitOpts): void {
    if (this.live.length >= this.cap * 2) return;
    const p: P = this.pool.pop() ?? {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 0,
      c0: new THREE.Color(), c1: new THREE.Color(), grav: 0, drag: 0, cube: false, rot: 0, rotV: 0,
    };
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.life = 0;
    p.max = o.life;
    p.s0 = o.size0;
    p.s1 = o.size1 ?? 0;
    p.c0.set(o.color0);
    p.c1.set(o.color1 ?? o.color0);
    p.grav = o.gravity ?? 0;
    p.drag = o.drag ?? 0;
    p.cube = o.cube ?? false;
    p.rot = Math.random() * Math.PI * 2;
    p.rotV = o.spin ?? 0;
    this.live.push(p);
  }

  update(dt: number): void {
    const live = this.live;
    let ns = 0;
    let nc = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      if (p.life >= p.max) {
        live[i] = live[live.length - 1];
        live.pop();
        this.pool.push(p);
        continue;
      }
      if (p.drag > 0) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.vz *= d;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotV * dt;
      const t = p.life / p.max;
      // Grow a touch, then shrink away.
      const bulge = p.s1 < p.s0 ? 1 + 0.35 * Math.sin(Math.min(1, t * 2.2) * Math.PI) : 1;
      const s = (p.s0 + (p.s1 - p.s0) * t) * bulge;
      const mesh = p.cube ? this.cubes : this.spheres;
      const idx = p.cube ? nc++ : ns++;
      if (idx >= this.cap) continue;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      this.dummy.scale.setScalar(Math.max(0.001, s));
      this.dummy.updateMatrix();
      mesh.setMatrixAt(idx, this.dummy.matrix);
      mesh.setColorAt(idx, this.tmp.copy(p.c0).lerp(p.c1, t));
    }
    this.spheres.count = Math.min(ns, this.cap);
    this.cubes.count = Math.min(nc, this.cap);
    this.spheres.instanceMatrix.needsUpdate = true;
    this.cubes.instanceMatrix.needsUpdate = true;
    if (this.spheres.instanceColor) this.spheres.instanceColor.needsUpdate = true;
    if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;
  }

  /** Fireball, smoke and sparks. scale 1 is a rocket; 2 is a bomb. */
  explosion(x: number, y: number, z: number, scale = 1, color = "#ff8a1f"): void {
    const n = Math.round(10 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const sp = (3 + Math.random() * 5) * scale;
      this.emit({
        x, y: y + 0.3, z,
        vx: r * Math.cos(a) * sp, vy: (u * 0.5 + 0.6) * sp, vz: r * Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.3,
        size0: (1.1 + Math.random() * 0.9) * scale, size1: 0,
        color0: i % 3 === 0 ? "#fff2a0" : color, color1: "#ff3d1f",
        drag: 3,
      });
    }
    for (let i = 0; i < Math.round(8 * scale); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 2.5) * scale;
      this.emit({
        x, y: y + 0.5, z,
        vx: Math.cos(a) * sp, vy: 2.5 + Math.random() * 3 * scale, vz: Math.sin(a) * sp,
        life: 0.9 + Math.random() * 0.7,
        size0: (0.9 + Math.random() * 0.9) * scale, size1: 0.1,
        color0: "#8a8a93", color1: "#3b3b45",
        drag: 1.5,
      });
    }
    for (let i = 0; i < Math.round(14 * scale); i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random();
      const sp = (8 + Math.random() * 10) * scale;
      this.emit({
        x, y: y + 0.4, z,
        vx: Math.cos(a) * sp * (1 - u * 0.5), vy: u * sp * 0.9 + 2, vz: Math.sin(a) * sp * (1 - u * 0.5),
        life: 0.5 + Math.random() * 0.5,
        size0: 0.28, size1: 0.05,
        color0: "#ffe066", color1: "#ff6b2b",
        gravity: 22, drag: 1.2, cube: true, spin: 12,
      });
    }
  }

  /** A soft puff: exhaust, rocket trail, dust. */
  puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, size: number, life: number, color1 = color): void {
    this.emit({ x, y, z, vx, vy, vz, life, size0: size, size1: 0, color0: color, color1, drag: 2 });
  }

  /** Little cubes flying out: bullet hits, pickups, bumps. */
  sparks(x: number, y: number, z: number, color: string, n: number, speed: number, life = 0.45, color1 = color): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random();
      this.emit({
        x, y, z,
        vx: Math.cos(a) * speed * (0.4 + u), vy: speed * (0.3 + Math.random() * 0.8), vz: Math.sin(a) * speed * (0.4 + u),
        life: life * (0.6 + Math.random() * 0.7),
        size0: 0.22, size1: 0.04,
        color0: color, color1,
        gravity: 18, drag: 1, cube: true, spin: 10,
      });
    }
  }

  /** Rising sparkle for a pickup. */
  sparkle(x: number, y: number, z: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.emit({
        x: x + Math.cos(a) * 0.6, y: y + 0.2, z: z + Math.sin(a) * 0.6,
        vx: Math.cos(a) * 2.2, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 2.2,
        life: 0.6 + Math.random() * 0.3,
        size0: 0.3, size1: 0,
        color0: "#ffffff", color1: color,
        drag: 2, cube: true, spin: 8,
      });
    }
  }

  /** Dust kicked up on landing. */
  dust(x: number, y: number, z: number, strength: number): void {
    const n = Math.round(4 + strength * 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3 * strength;
      this.emit({
        x, y: y + 0.1, z,
        vx: Math.cos(a) * sp, vy: 0.8 + Math.random(), vz: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.3,
        size0: 0.7 + strength * 0.5, size1: 0,
        color0: "#e9dcc3", color1: "#cbbda2",
        drag: 3,
      });
    }
  }

  dispose(): void {
    this.spheres.geometry.dispose();
    this.cubes.geometry.dispose();
    (this.spheres.material as THREE.Material).dispose();
    this.spheres.dispose();
    this.cubes.dispose();
  }
}

/** Expanding translucent shells for blasts and respawns. */
export class Shockwaves {
  readonly group = new THREE.Group();
  private readonly pool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; max: number; from: number; to: number; alive: boolean }[] = [];

  constructor(n = 10) {
    const geo = new THREE.SphereGeometry(1, 18, 12);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, mat, t: 0, max: 1, from: 0, to: 1, alive: false });
    }
  }

  burst(x: number, y: number, z: number, radius: number, color: string, duration = 0.35): void {
    const s = this.pool.find((p) => !p.alive) ?? this.pool[0];
    s.alive = true;
    s.t = 0;
    s.max = duration;
    s.from = radius * 0.2;
    s.to = radius;
    s.mesh.position.set(x, y, z);
    s.mesh.visible = true;
    s.mat.color.set(color);
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (!s.alive) continue;
      s.t += dt;
      const t = Math.min(1, s.t / s.max);
      const e = 1 - (1 - t) * (1 - t);
      s.mesh.scale.setScalar(s.from + (s.to - s.from) * e);
      s.mat.opacity = 0.55 * (1 - t);
      if (t >= 1) {
        s.alive = false;
        s.mesh.visible = false;
      }
    }
  }

  dispose(): void {
    for (const s of this.pool) s.mat.dispose();
    (this.pool[0]?.mesh.geometry as THREE.BufferGeometry | undefined)?.dispose();
  }
}
