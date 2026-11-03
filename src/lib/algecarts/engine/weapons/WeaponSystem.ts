import * as THREE from "three";
import type { WeaponId } from "../types";
import type { Arena } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import { Mine, Projectile, Slick } from "../entities/Projectile";
import type { Particles, Shockwaves } from "../render/Particles";
import type { Palette } from "../render/Materials";
import type { SoundName } from "../audio/Audio";
import { pointHitsKart } from "../physics/Collision";
import { KART } from "../physics/KartPhysics";
import { angleDelta, clamp, type Rng } from "../util";
import { STATS } from "./weapons";
import type { SnapMine, SnapProjectile, SnapSlick } from "../types";

let UID = 0;

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
  readonly slicks: Slick[] = [];
  /** Laser beams on show, fading. */
  private readonly beams: { mesh: THREE.Mesh; life: number }[] = [];

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
      case "seeker":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.launch("seeker", k);
          k.fireCooldown = STATS.seeker.cooldown;
          this.consume(k);
        }
        break;
      case "laser":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.fireLaser(k);
          k.fireCooldown = STATS.laser.cooldown;
          this.consume(k);
        }
        break;
      case "ice":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.launch("ice", k);
          k.fireCooldown = STATS.ice.cooldown;
          this.consume(k);
        }
        break;
      case "slick":
        if (inp.firePressed && k.fireCooldown <= 0) {
          this.dropSlick(k);
          k.fireCooldown = STATS.slick.cooldown;
          this.consume(k);
        }
        break;
      case "shock":
        if (inp.firePressed) {
          k.weapon = null;
          this.ctx.sound("shock", k.pos.x, k.pos.y, k.pos.z);
          this.ctx.waves.burst(k.pos.x, k.pos.y + 0.8, k.pos.z, STATS.shock.radius, "#b388ff", 0.5);
          this.ctx.explode(k.pos.x, k.pos.y + 0.6, k.pos.z, STATS.shock.radius, STATS.shock.damage, STATS.shock.edge, STATS.shock.knock, k, "shock", 1.2);
        }
        break;
    }
  }

  private consume(k: Kart): void {
    if (!k.weapon) return;
    k.weapon.ammo--;
    if (k.weapon.ammo <= 0) k.weapon = null;
  }

  private launch(kind: "rocket" | "bullet" | "bomb" | "seeker" | "ice", k: Kart): void {
    const { palette, scene, rng } = this.ctx;
    const p = new Projectile(kind, k, palette);
    p.uid = ++UID;
    const fx = k.fx;
    const fz = k.fz;
    const carry = Math.max(0, k.speed);
    p.pos.set(k.pos.x + fx * 1.9, k.pos.y + 0.75, k.pos.z + fz * 1.9);
    if (kind === "rocket") {
      const s = STATS.rocket.speed + carry * 0.3;
      p.vel.set(fx * s, 0, fz * s);
      this.ctx.sound("rocket", p.pos.x, p.pos.y, p.pos.z);
      this.ctx.particles.puff(p.pos.x, p.pos.y, p.pos.z, fx * 3, 1, fz * 3, "#fff2a0", 0.9, 0.25, "#8a8a93");
    } else if (kind === "seeker") {
      const s = STATS.seeker.speed + carry * 0.3;
      p.vel.set(fx * s, 0, fz * s);
      this.ctx.sound("rocket", p.pos.x, p.pos.y, p.pos.z);
      this.ctx.particles.puff(p.pos.x, p.pos.y, p.pos.z, fx * 3, 1, fz * 3, "#ffd6fb", 0.9, 0.25, "#8a8a93");
    } else if (kind === "ice") {
      const s = STATS.ice.speed + carry * 0.4;
      p.vel.set(fx * s, 0, fz * s);
      this.ctx.sound("freeze", p.pos.x, p.pos.y, p.pos.z);
      this.ctx.particles.puff(p.pos.x, p.pos.y, p.pos.z, fx * 2, 1, fz * 2, "#ffffff", 0.6, 0.2, "#9be7ff");
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
    m.uid = ++UID;
    this.ctx.scene.add(m.root);
    this.mines.push(m);
    this.ctx.sound("mine", x, y, z);
  }

  /** The first kart on the beam, within range, takes the laser; the beam stops at a wall. */
  private fireLaser(k: Kart): void {
    const { arena, karts, particles } = this.ctx;
    const fx = k.fx;
    const fz = k.fz;
    const ox = k.pos.x + fx * 1.6;
    const oy = k.pos.y + 0.8;
    const oz = k.pos.z + fz * 1.6;
    let reach: number = STATS.laser.range;
    for (let d = 0.5; d < STATS.laser.range; d += 0.5) {
      if (arena.solidAt(ox + fx * d, oy, oz + fz * d)) {
        reach = d;
        break;
      }
    }
    let hit: Kart | null = null;
    let hitD: number = reach;
    for (const o of karts) {
      if (o === k || !o.alive || o.hidden) continue;
      const dx = o.pos.x - ox;
      const dz = o.pos.z - oz;
      const along = dx * fx + dz * fz;
      if (along < 0.5 || along > hitD) continue;
      const perp = Math.abs(dx * fz - dz * fx);
      if (perp > KART.radius + 0.3 || Math.abs(o.pos.y + 0.6 - oy) > 1.8) continue;
      hit = o;
      hitD = along;
    }
    if (hit) {
      this.ctx.damage(hit, STATS.laser.damage, k, "laser", fx * STATS.laser.knock, 2, fz * STATS.laser.knock);
      particles.sparks(ox + fx * hitD, oy, oz + fz * hitD, "#ff2d55", 10, 7, 0.4, "#ffffff");
    }
    const geo = new THREE.BoxGeometry(0.16, 0.16, hitD);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#ff2d55", transparent: true, opacity: 1, toneMapped: false }));
    mesh.position.set(ox + (fx * hitD) / 2, oy, oz + (fz * hitD) / 2);
    mesh.rotation.y = Math.atan2(fx, fz);
    this.ctx.scene.add(mesh);
    this.beams.push({ mesh, life: 0 });
    this.ctx.sound("laser", ox, oy, oz);
    this.ctx.waves.burst(ox, oy, oz, 1.2, "#ff2d55", 0.12);
  }

  private dropSlick(k: Kart): void {
    const x = k.pos.x - k.fx * 2.2;
    const z = k.pos.z - k.fz * 2.2;
    const y = this.ctx.arena.heightAt(x, z, k.pos.y);
    const s = new Slick(k, x, y, z, this.ctx.now(), STATS.slick.life, STATS.slick.radius, this.ctx.palette);
    s.uid = ++UID;
    this.ctx.scene.add(s.root);
    this.slicks.push(s);
    this.ctx.sound("slick", x, y, z);
  }

  /** The nearest kart a seeker can turn toward: alive, hittable, inside its cone and range. */
  private seekTarget(p: Projectile): Kart | null {
    const now = this.ctx.now();
    const heading = Math.atan2(p.vel.x, p.vel.z);
    let best: Kart | null = null;
    let bd: number = STATS.seeker.range;
    for (const k of this.ctx.karts) {
      if (k === p.owner || !k.alive || k.isImmune(now)) continue;
      const dx = k.pos.x - p.pos.x;
      const dz = k.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(angleDelta(heading, Math.atan2(dx, dz))) > STATS.seeker.cone) continue;
      best = k;
      bd = d;
    }
    return best;
  }

  update(dt: number): void {
    const { arena, karts, particles } = this.ctx;
    const now = this.ctx.now();

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life += dt;
      const t = b.life / STATS.laser.hold;
      if (t >= 1) {
        this.ctx.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
        continue;
      }
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      b.mesh.scale.set(1 + t * 2, 1 - t * 0.8, 1);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      const maxLife = p.kind === "rocket" ? STATS.rocket.life : p.kind === "bullet" ? STATS.bullet.life : p.kind === "seeker" ? STATS.seeker.life : p.kind === "ice" ? STATS.ice.life : STATS.bomb.fuse;
      if (p.kind === "bomb") p.vel.y -= STATS.bomb.gravity * dt;
      if (p.kind === "seeker") {
        const t = this.seekTarget(p);
        if (t) {
          const have = Math.atan2(p.vel.x, p.vel.z);
          const want = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
          const a = have + clamp(angleDelta(have, want), -STATS.seeker.turn * dt, STATS.seeker.turn * dt);
          const s = Math.hypot(p.vel.x, p.vel.z);
          p.vel.x = Math.sin(a) * s;
          p.vel.z = Math.cos(a) * s;
        }
      }
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
          // A kart answering a question is off the track: shots fly through where it stands.
          if (k === p.owner || !k.alive || k.hidden) continue;
          if (!pointHitsKart(k, p.pos.x, p.pos.y, p.pos.z, p.kind === "bullet" ? 0.25 : 0.55)) continue;
          if (p.kind === "seeker") {
            this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.seeker.radius, STATS.seeker.damage, STATS.seeker.edge, STATS.seeker.knock, p.owner, "seeker", 1);
          } else if (p.kind === "ice") {
            const n = Math.max(1e-3, speed);
            if (!k.isImmune(now)) k.frozenUntil = now + STATS.ice.freeze;
            this.ctx.damage(k, STATS.ice.damage, p.owner, "ice", (p.vel.x / n) * STATS.ice.knock, 0, (p.vel.z / n) * STATS.ice.knock);
            particles.puff(p.pos.x, p.pos.y, p.pos.z, 0, 2, 0, "#ffffff", 1.4, 0.5, "#9be7ff");
            particles.sparks(p.pos.x, p.pos.y, p.pos.z, "#dff6ff", 8, 5, 0.4, "#9be7ff");
            this.ctx.sound("freeze", p.pos.x, p.pos.y, p.pos.z);
          } else if (p.kind === "rocket") {
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
          if (p.kind === "seeker") {
            this.ctx.explode(px, py, pz, STATS.seeker.radius, STATS.seeker.damage, STATS.seeker.edge, STATS.seeker.knock, p.owner, "seeker", 1);
            p.dead = true;
          } else if (p.kind === "ice") {
            particles.sparks(px, py, pz, "#dff6ff", 6, 4, 0.3, "#9be7ff");
            p.dead = true;
          } else if (p.kind === "rocket") {
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
        if (p.kind === "seeker") {
          this.ctx.explode(p.pos.x, p.pos.y, p.pos.z, STATS.seeker.radius, STATS.seeker.damage, STATS.seeker.edge, STATS.seeker.knock, p.owner, "seeker", 1);
        } else if (p.kind === "rocket") {
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
      } else if (p.kind === "seeker" && p.trailTimer > 0.03) {
        p.trailTimer = 0;
        const n = Math.max(1e-3, speed);
        particles.puff(p.pos.x - (p.vel.x / n) * 0.7, p.pos.y, p.pos.z - (p.vel.z / n) * 0.7, (this.ctx.rng.next() - 0.5) * 1.2, 0.5, (this.ctx.rng.next() - 0.5) * 1.2, "#ffd6fb", 0.5, 0.4, "#ff3df2");
      } else if (p.kind === "ice" && p.trailTimer > 0.05) {
        p.trailTimer = 0;
        particles.puff(p.pos.x, p.pos.y, p.pos.z, 0, 0.4, 0, "#ffffff", 0.3, 0.3, "#9be7ff");
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
          if (k === m.owner || !k.alive || k.hidden) continue;
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
    this.updateSlicks(now);
  }

  private updateSlicks(now: number): void {
    const { karts, particles } = this.ctx;
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const s = this.slicks[i];
      if (now >= s.diesAt) s.dead = true;
      else {
        for (const k of karts) {
          if (k === s.owner || !k.alive || k.isSpinning(now) || k.isImmune(now)) continue;
          const dx = k.pos.x - s.pos.x;
          const dz = k.pos.z - s.pos.z;
          if (dx * dx + dz * dz > STATS.slick.radius * STATS.slick.radius || Math.abs(k.pos.y - s.pos.y) > 1.2) continue;
          k.spinUntil = now + STATS.slick.spin;
          this.ctx.damage(k, STATS.slick.damage, s.owner, "slick", 0, 0, 0);
          particles.dust(k.pos.x, k.pos.y, k.pos.z, 1.2);
          this.ctx.sound("slick", k.pos.x, k.pos.y, k.pos.z);
        }
      }
      if (s.dead) {
        this.ctx.scene.remove(s.root);
        s.dispose();
        this.slicks.splice(i, 1);
        continue;
      }
      s.sync(now);
    }
  }

  /**
   * Guest: make what is in flight match the host's snapshot. Shots are created
   * and removed by id; positions and velocities are taken as they come.
   */
  mirror(pr: SnapProjectile[], mn: SnapMine[], sl: SnapSlick[]): void {
    const { karts, palette, scene } = this.ctx;
    const now = this.ctx.now();
    const owner = (o: number) => karts[o] ?? karts[0];
    const seenP = new Set<number>();
    for (const s of pr) {
      seenP.add(s.id);
      let p = this.projectiles.find((q) => q.uid === s.id);
      if (!p) {
        p = new Projectile(s.k, owner(s.o), palette);
        p.uid = s.id;
        scene.add(p.root);
        this.projectiles.push(p);
      }
      p.pos.set(s.x, s.y, s.z);
      p.vel.set(s.vx, s.vy, s.vz);
      p.sync(0);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (seenP.has(p.uid)) continue;
      scene.remove(p.root);
      p.dispose();
      this.projectiles.splice(i, 1);
    }
    const seenM = new Set<number>();
    for (const s of mn) {
      seenM.add(s.id);
      let m = this.mines.find((q) => q.uid === s.id);
      if (!m) {
        m = new Mine(owner(s.o), s.x, s.y, s.z, now, s.ar ? 0 : STATS.mine.arm, STATS.mine.life, palette);
        m.uid = s.id;
        scene.add(m.root);
        this.mines.push(m);
      }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (seenM.has(m.uid)) continue;
      scene.remove(m.root);
      m.dispose();
      this.mines.splice(i, 1);
    }
    const seenS = new Set<number>();
    for (const s of sl) {
      seenS.add(s.id);
      let k = this.slicks.find((q) => q.uid === s.id);
      if (!k) {
        k = new Slick(owner(s.o), s.x, s.y, s.z, now, STATS.slick.life, STATS.slick.radius, palette);
        k.uid = s.id;
        scene.add(k.root);
        this.slicks.push(k);
      }
    }
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const k = this.slicks[i];
      if (seenS.has(k.uid)) continue;
      scene.remove(k.root);
      k.dispose();
      this.slicks.splice(i, 1);
    }
  }

  /** Guest: carry mirrored shots forward between snapshots, and keep the lamps blinking. */
  drift(dt: number): void {
    const now = this.ctx.now();
    for (const p of this.projectiles) {
      if (p.kind === "bomb") p.vel.y -= STATS.bomb.gravity * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
      p.sync(dt);
    }
    for (const m of this.mines) m.sync(now);
    for (const s of this.slicks) s.sync(now);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life += dt;
      if (b.life >= STATS.laser.hold) {
        this.ctx.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
      } else (b.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - b.life / STATS.laser.hold;
    }
  }

  /** The snapshot view of what is in flight. */
  snapshot(karts: Kart[]): { pr: SnapProjectile[]; mn: SnapMine[]; sl: SnapSlick[] } {
    const now = this.ctx.now();
    const idx = (k: Kart) => Math.max(0, karts.indexOf(k));
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      pr: this.projectiles.map((p) => ({ id: p.uid, k: p.kind, o: idx(p.owner), x: r(p.pos.x), y: r(p.pos.y), z: r(p.pos.z), vx: r(p.vel.x), vy: r(p.vel.y), vz: r(p.vel.z) })),
      mn: this.mines.map((m) => ({ id: m.uid, o: idx(m.owner), x: r(m.pos.x), y: r(m.pos.y), z: r(m.pos.z), ar: m.armed(now) ? 1 : 0 })),
      sl: this.slicks.map((s) => ({ id: s.uid, o: idx(s.owner), x: r(s.pos.x), y: r(s.pos.y), z: r(s.pos.z) })),
    };
  }

  /** Everything in flight goes away (a new match). */
  clear(): void {
    for (const s of this.slicks) {
      this.ctx.scene.remove(s.root);
      s.dispose();
    }
    this.slicks.length = 0;
    for (const b of this.beams) {
      this.ctx.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.beams.length = 0;
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
