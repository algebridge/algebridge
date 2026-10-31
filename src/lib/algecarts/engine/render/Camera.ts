import * as THREE from "three";
import type { Kart } from "../entities/Kart";
import type { Arena } from "../world/Arena";
import { KART } from "../physics/KartPhysics";
import { damp } from "../util";

/** The camera behind the player's kart, and the slow orbit over the arena while watching. */
export class ChaseCamera {
  readonly cam = new THREE.PerspectiveCamera(64, 1, 0.1, 900);
  private readonly pos = new THREE.Vector3(0, 20, 40);
  private readonly look = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private shakeAmt = 0;
  private orbit = 0;
  private fov = 64;

  snapTo(k: Kart): void {
    this.pos.set(k.pos.x - k.fx * 8.2, k.pos.y + 4, k.pos.z - k.fz * 8.2);
    this.look.set(k.pos.x, k.pos.y + 1, k.pos.z);
  }

  follow(k: Kart, dt: number, arena: Arena, now: number): void {
    const frac = Math.max(0, Math.min(1, Math.abs(k.speed) / KART.maxSpeed));
    const dist = 7.8 + frac * 1.6;
    const height = 3.8 + frac * 0.3;
    this.target.set(k.pos.x - k.fx * dist, k.pos.y + height, k.pos.z - k.fz * dist);
    const rate = 5.5;
    this.pos.x = damp(this.pos.x, this.target.x, rate, dt);
    this.pos.z = damp(this.pos.z, this.target.z, rate, dt);
    this.pos.y = damp(this.pos.y, this.target.y, 4.5, dt);
    // Stay inside the walls, above whatever is under the camera, and out of any block.
    const lim = arena.half - 1.2;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    const floor = arena.heightAt(this.pos.x, this.pos.z, this.pos.y) + 1.4;
    if (this.pos.y < floor) this.pos.y = floor;
    if (arena.solidAt(this.pos.x, this.pos.y, this.pos.z)) {
      // March from the kart toward the wanted spot and stop at the last clear point.
      const ax = k.pos.x, ay = k.pos.y + 2.2, az = k.pos.z;
      let fx = ax, fy = ay, fz = az;
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        const x = ax + (this.pos.x - ax) * t, y = ay + (this.pos.y - ay) * t, z = az + (this.pos.z - az) * t;
        if (arena.solidAt(x, y, z)) break;
        fx = x; fy = y; fz = z;
      }
      this.pos.set(fx, fy, fz);
    }

    this.target.set(k.pos.x + k.fx * 3.5, k.pos.y + 1.35, k.pos.z + k.fz * 3.5);
    this.look.x = damp(this.look.x, this.target.x, 9, dt);
    this.look.y = damp(this.look.y, this.target.y, 7, dt);
    this.look.z = damp(this.look.z, this.target.z, 9, dt);

    this.fov = damp(this.fov, 64 + (k.isBoosting(now) ? 11 : frac * 3), 6, dt);
    this.apply(dt);
  }

  /** A slow sweep over the fight, used before the player joins and after they leave. */
  spectate(dt: number, arena: Arena): void {
    this.orbit += dt * 0.07;
    const r = arena.half * 1.25;
    this.target.set(Math.cos(this.orbit) * r, 26, Math.sin(this.orbit) * r);
    this.pos.x = damp(this.pos.x, this.target.x, 2, dt);
    this.pos.y = damp(this.pos.y, this.target.y, 2, dt);
    this.pos.z = damp(this.pos.z, this.target.z, 2, dt);
    this.look.x = damp(this.look.x, 0, 2, dt);
    this.look.y = damp(this.look.y, 2, 2, dt);
    this.look.z = damp(this.look.z, 0, 2, dt);
    this.fov = damp(this.fov, 58, 3, dt);
    this.apply(dt);
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(1.2, this.shakeAmt + amount);
  }

  private apply(dt: number): void {
    const c = this.cam;
    c.position.copy(this.pos);
    if (this.shakeAmt > 0.002) {
      c.position.x += (Math.random() - 0.5) * this.shakeAmt;
      c.position.y += (Math.random() - 0.5) * this.shakeAmt;
      c.position.z += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-9 * dt);
    }
    c.lookAt(this.look);
    if (Math.abs(c.fov - this.fov) > 0.01) {
      c.fov = this.fov;
      c.updateProjectionMatrix();
    }
  }

  resize(w: number, h: number): void {
    this.cam.aspect = w / Math.max(1, h);
    this.cam.updateProjectionMatrix();
  }
}
