import * as THREE from "three";
import type { WeaponId } from "../types";
import type { Arena } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import { Mine, Projectile } from "../entities/Projectile";
import type { Particles, Shockwaves } from "../render/Particles";
import type { Palette } from "../render/Materials";
import type { SoundName } from "../audio/Audio";
import { pointHitsKart } from "../physics/Collision";
import type { Rng } from "../util";
import { STATS } from "./weapons";

/** What the weapons need from the game: the world, the karts, and the way to hurt them. */
export interface CombatCtx {
  arena: Arena;
  karts: Kart[];
  particles: Particles;
  waves: Shockwaves;
  palette: Palette;
  scene: THREE.Scene;
  rng: Rng;
  now(): number;
  damage(victim: Kart, amount: number, attacker: Kart, weapon: WeaponId | "bump", kx: number, ky: number, kz: number): void;
  explode(x: number, y: number, z: number, radius: number, damage: number, edge: number, knock: number, attacker: Kart, weapon: WeaponId, scale: number): void;
  sound(name: SoundName, x?: number, y?: number, z?: number): void;
}

export class WeaponSystem {
  readonly projectiles: Projectile[] = [];
  readonly mines: Mine[] = [];

  constructor(private readonly ctx: CombatCtx) {}

  /** Read a kart's fire input for this step and act on its weapon. */
  fire(k: Kart, dt: number): void {
    k.fireCooldown = Math.max(0, k.fireCooldown - dt);
    const w = k.weapon;
    if (!w || !k.alive || k.pendingBooster) return;
    const inp = k.input;
    const now = this.ctx.now();
    switch (w.id) {
      case "rockets":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.launch("rocket", k);
          k.fireCooldown = STATS.rocket.cooldown;
          this.consume(k);
        }
        break;
      case "machinegun":
        if (inp.fire && k.fireCooldown <= 0) {
          this.launch("bullet", k);
          k.fireCooldown = STATS.bullet.interval;
          this.consume(k);
        }
        break;
      case "mines":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.dropMine(k);
          k.fireCooldown = STATS.mine.cooldown;
          this.consume(k);
        }
        break;
      case "bomb":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.launch("bomb", k);
          k.fireCooldown = STATS.bomb.cooldown;
          this.consume(k);
        }
        break;
      case "shield":
        if (inp.firePressed) {
          k.shieldUntil = now + STATS.shield.duration;
          k.weapon = null;
          this.ctx.sound("shield", k.pos.x, k.pos.y, k.pos.z);
          this.ctx.waves.burst(k.pos.x, k.pos.y + 0.9, k.pos.z, 3.2, "#6ff6ff", 0.4);
        }
        break;
      case "boost":
        if (inp.firePressed) {
          k.boostUntil = now + STATS.boost.duration;
          k.weapon = null;
          k.celebrateUntil = now + 1.0;
          this.ctx.sound("boost", k.pos.x, k.pos.y, k.pos.z);
          this.ctx.waves.burst(k.pos.x, k.pos.y + 0.7, k.pos.z, 2.4, "#ff8a1f", 0.3);
        }
        break;
    }
  }

  private consume(k: Kart): void {
    if (!k.weapon) return;
    k.weapon.ammo--;
    if (k.weapon.ammo <= 0) k.weapon = null;
  }

  private launch(kind: "rocket" | "bullet" | "bomb", k: Kart): void {
    const { palette, scene, rng } = this.ctx;
    const p = new Projectile(kind, k, palette);
    const fx = k.fx;
    const fz = k.fz;
    const carry = Math.max(0, k.speed);
    p.pos.set(k.pos.x + fx * 1.9, k.pos.y + 0.75, k.pos.z + fz * 1.9);
    if (kind === "rocket") {
      const s = STATS.rocket.speed + carry * 0.3;
      p.vel.set(fx * s, 0, fz * s);
      this.ctx.sound("rocket", p.pos.x, p.pos.y, p.pos.z);
      this.ctx.particles.puff(p.pos.x, p.pos.y, p.pos.z, fx * 3, 1, fz * 3, "#fff2a0", 0.9, 0.25, "#8a8a93");
    } else if (kind === "bullet") {
      const a = k.yaw + (rng.next() - 0.5) * 2 * STATS.bullet.spread;
      const s = STATS.bullet.speed + carry * 0.5;
      p.vel.set(Math.sin(a) * s, 0, Math.cos(a) * s);
      p.pos.x += Math.cos(k.yaw) * (rng.next() > 0.5 ? 0.45 : -0.45);
      p.pos.z -= Math.sin(k.yaw) * (rng.next() > 0.5 ? 0.45 : -0.45);
      this.ctx.sound("mg", p.pos.x, p.pos.y, p.pos.z);
    } else {
      const s = STATS.bomb.speed + carry * 0.5;
      p.vel.set(fx * s, STATS.bomb.up, fz * s);
      p.pos.y += 0.6;
      this.ctx.sound("throw", p.pos.x, p.pos.y, p.pos.z);
    }
    p.sync(0);
    scene.add(p.root);
    this.projectiles.push(p);
  }

  private dropMine(k: Kart): void {
    const x = k.pos.x - k.fx * 2.1;
    const z = k.pos.z - k.fz * 2.1;
    const y = this.ctx.arena.heightAt(x, z, k.pos.y);
    const m = new Mine(k, x, y, z, this.ctx.now(), STATS.mine.arm, STATS.mine.life, this.ctx.palette);
    this.ctx.scene.add(m.root);
    this.mines.push(m);
    this.ctx.sound("mine", x, y, z);
  }

  update(dt: number): void {
    const { arena, karts, particles } = this.ctx;
    const now = this.ctx.now();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      const maxLife = p.kind === "rocket" ? STATS.rocket.life : p.kind === "bullet" ? STATS.bullet.life : STATS.bomb.fuse;
      if (p.kind === "bomb") p.vel.y -= STATS.bomb.gravity * dt;
      const speed = p.vel.length();
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.5));
      const sdt = dt / steps;
      let prevY = p.pos.y;
      for (let s = 0; s < steps && !p.dead; s++) {
        const px = p.pos.x;
        const py = p.pos.y;
        const pz = p.pos.z;
        p.pos.x += p.vel.x * sdt;
        p.pos.y += p.vel.y * sdt;
        p.pos.z += p.vel.z * sdt;
        // Karts.
        for (const k of karts) {
          if (k === p.owner || !k.alive) continue;
          if (!pointHitsKart(k, p.pos.x, p.pos.y, p.pos.z, p.kind === "bullet" ? 0.25 : 0.55)) continue;
          if (p.kind === "rocket") {
            this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.rocket.radius, STATS.rocket.damage, STATS.rocket.edge, STATS.rocket.knock, p.owner, "rockets", 1);
          } else if (p.kind === "bullet") {
            const n = Math.max(1e-3, speed);
            this.ctx.damage(k, STATS.bullet.damage, p.owner, "machinegun", (p.vel.x / n) * STATS.bullet.knock, 0, (p.vel.z / n) * STATS.bullet.knock);
            particles.sparks(p.pos.x, p.pos.y, p.pos.z, "#ffe066", 4, 5, 0.3, "#ff6b2b");
            this.ctx.sound("spark", p.pos.x, p.pos.y, p.pos.z);
          } else {
            this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.bomb.radius, STATS.bomb.damage, STATS.bomb.edge, STATS.bomb.knock, p.owner, "bomb", 1.9);
          }
          p.dead = true;
          break;
        }
        if (p.dead) break;
        // The world.
        if (arena.solidAt(p.pos.x, p.pos.y, p.pos.z)) {
          if (p.kind === "rocket") {
            this.ctx.explode(px, py, pz, STATS.rocket.radius, STATS.rocket.damage, STATS.rocket.edge, STATS.rocket.knock, p.owner, "rockets", 1);
            p.dead = true;
          } else if (p.kind === "bullet") {
            particles.sparks(px, py, pz, "#ffe066", 3, 4, 0.3, "#8a8a93");
            p.dead = true;
          } else {
            const ground = arena.heightAt(px, pz, prevY);
            const onGround = p.pos.y <= ground + 0.42;
            if (p.bounces < 1 && onGround) {
              p.pos.set(px, ground + 0.42, pz);
              p.vel.y = Math.abs(p.vel.y) * 0.45;
              p.vel.x *= 0.55;
              p.vel.z *= 0.55;
              p.bounces++;
              this.ctx.sound("bounce", px, py, pz);
              particles.dust(px, ground, pz, 0.4);
            } else if (onGround || p.bounces >= 2) {
              this.ctx.explode(px, Math.max(py, ground + 0.3), pz, STATS.bomb.radius, STATS.bomb.damage, STATS.bomb.edge, STATS.bomb.knock, p.owner, "bomb", 1.9);
              p.dead = true;
            } else {
              // A wall: bounce back off it.
              p.pos.set(px, py, pz);
              p.vel.x *= -0.5;
              p.vel.z *= -0.5;
              p.bounces++;
              this.ctx.sound("bounce", px, py, pz);
            }
          }
        }
        prevY = p.pos.y;
      }
      if (!p.dead && p.life >= maxLife) {
        if (p.kind === "rocket") {
          this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.rocket.radius, STATS.rocket.damage, STATS.rocket.edge, STATS.rocket.knock, p.owner, "rockets", 1);
        } else if (p.kind === "bomb") {
          this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.bomb.radius, STATS.bomb.damage, STATS.bomb.edge, STATS.bomb.knock, p.owner, "bomb", 1.9);
        }
        p.dead = true;
      }
      if (p.dead) {
        this.ctx.scene.remove(p.root);
        p.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }
      // Trails.
      p.trailTimer += dt;
      if (p.kind === "rocket" && p.trailTimer > 0.022) {
        p.trailTimer = 0;
        const n = Math.max(1e-3, speed);
        const bx = p.pos.x - (p.vel.x / n) * 0.7;
        const by = p.pos.y - (p.vel.y / n) * 0.7;
        const bz = p.pos.z - (p.vel.z / n) * 0.7;
        particles.puff(bx, by, bz, (this.ctx.rng.next() - 0.5) * 1.5, 0.6, (this.ctx.rng.next() - 0.5) * 1.5, "#ffffff", 0.55, 0.45, "#8a8a93");
        if (this.ctx.rng.next() < 0.5) particles.puff(bx, by, bz, 0, 0.3, 0, "#ffb347", 0.35, 0.18, "#ff3d1f");
      } else if (p.kind === "bomb" && p.trailTimer > 0.07) {
        p.trailTimer = 0;
        particles.puff(p.pos.x, p.pos.y + 0.6, p.pos.z, 0, 1.2, 0, "#c8c8d0", 0.3, 0.4, "#6b6b75");
      }
      p.sync(dt);
    }

    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (now >= m.diesAt) {
        particles.puff(m.pos.x, m.pos.y + 0.3, m.pos.z, 0, 1, 0, "#8a8a93", 0.8, 0.5, "#3b3b45");
        m.dead = true;
      } else if (m.armed(now)) {
        for (const k of karts) {
          if (k === m.owner || !k.alive) continue;
          const dx = k.pos.x - m.pos.x;
          const dz = k.pos.z - m.pos.z;
          if (dx * dx + dz * dz > STATS.mine.trigger * STATS.mine.trigger || Math.abs(k.pos.y - m.pos.y) > 1.6) continue;
          this.ctx.explode(m.pos.x, m.pos.y + 0.3, m.pos.z, STATS.mine.radius, STATS.mine.damage, STATS.mine.edge, STATS.mine.knock, m.owner, "mines", 1.5);
          m.dead = true;
          break;
        }
      }
      if (m.dead) {
        this.ctx.scene.remove(m.root);
        m.dispose();
        this.mines.splice(i, 1);
        continue;
      }
      m.sync(now);
    }
  }

  /** Everything in flight goes away (a new match). */
  clear(): void {
    for (const p of this.projectiles) {
      this.ctx.scene.remove(p.root);
      p.dispose();
    }
    this.projectiles.length = 0;
    for (const m of this.mines) {
      this.ctx.scene.remove(m.root);
      m.dispose();
    }
    this.mines.length = 0;
  }
}
