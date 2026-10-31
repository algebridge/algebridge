import * as THREE from "three";
import type { Kart } from "./Kart";
import type { Palette } from "../render/Materials";
import { WEAPONS } from "../weapons/weapons";

export type ProjKind = "rocket" | "bullet" | "bomb";

export class Projectile {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  life = 0;
  bounces = 0;
  trailTimer = 0;
  dead = false;
  readonly root: THREE.Group;

  constructor(readonly kind: ProjKind, readonly owner: Kart, pal: Palette) {
    this.root = kind === "rocket" ? rocketMesh(pal) : kind === "bullet" ? bulletMesh(pal) : bombMesh(pal);
  }

  /** Point the mesh along the velocity (rockets, bullets) or roll it (bombs). */
  sync(dt: number): void {
    this.root.position.copy(this.pos);
    if (this.kind === "bomb") {
      this.root.rotation.x += dt * 6;
      this.root.rotation.z += dt * 3;
    } else if (this.vel.lengthSq() > 1e-4) {
      LOOK.copy(this.pos).add(this.vel);
      this.root.lookAt(LOOK);
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

const LOOK = new THREE.Vector3();

export class Mine {
  readonly pos = new THREE.Vector3();
  readonly root: THREE.Group;
  readonly armedAt: number;
  readonly diesAt: number;
  dead = false;
  private readonly lamp: THREE.Mesh;

  constructor(readonly owner: Kart, x: number, y: number, z: number, now: number, armDelay: number, life: number, pal: Palette) {
    this.pos.set(x, y, z);
    this.armedAt = now + armDelay;
    this.diesAt = now + life;
    this.root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.26, 12), pal.toon("#2a2f3f"));
    body.position.y = 0.13;
    body.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 12), pal.toon(WEAPONS.mines.color));
    band.position.y = 0.18;
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: "#ff3b3b", toneMapped: false }));
    this.lamp.position.y = 0.33;
    this.lamp.userData.own = true;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), pal.toon("#d9dde6"));
      spike.position.set(Math.cos(a) * 0.5, 0.26, Math.sin(a) * 0.5);
      spike.rotation.z = -Math.cos(a) * 0.9;
      spike.rotation.x = Math.sin(a) * 0.9;
      this.root.add(spike);
    }
    this.root.add(body, band, this.lamp);
    this.root.position.copy(this.pos);
  }

  armed(now: number): boolean {
    return now >= this.armedAt;
  }

  sync(now: number): void {
    const on = this.armed(now) ? Math.sin(now * 12) > 0 : Math.sin(now * 40) > 0;
    (this.lamp.material as THREE.MeshBasicMaterial).color.set(on ? "#ff3b3b" : "#5a1414");
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.userData.own) (m.material as THREE.Material).dispose();
    });
  }
}

function rocketMesh(pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.9, 10), pal.toon(WEAPONS.rockets.color));
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 10), pal.toon("#ffe066"));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.65;
  const finGeo = new THREE.BoxGeometry(0.62, 0.05, 0.3);
  const fin1 = new THREE.Mesh(finGeo, pal.toon("#2a2f3f"));
  fin1.position.z = -0.35;
  const fin2 = new THREE.Mesh(finGeo, pal.toon("#2a2f3f"));
  fin2.position.z = -0.35;
  fin2.rotation.z = Math.PI / 2;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pal.unlit("#fff2a0"));
  flame.position.z = -0.55;
  g.add(body, nose, fin1, fin2, flame);
  return g;
}

function bulletMesh(pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 2, 6), pal.unlit("#fff1a8"));
  m.rotation.x = Math.PI / 2;
  g.add(m);
  return g;
}

function bombMesh(pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 9), pal.toon(WEAPONS.bomb.color));
  ball.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 8), pal.toon("#2a2f3f"));
  cap.position.y = 0.42;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), pal.toon("#d9dde6"));
  fuse.position.set(0.06, 0.6, 0);
  fuse.rotation.z = -0.4;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), pal.unlit("#ffe066"));
  spark.position.set(0.12, 0.74, 0);
  g.add(ball, cap, fuse, spark);
  return g;
}
