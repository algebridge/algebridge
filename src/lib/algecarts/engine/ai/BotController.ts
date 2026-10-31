import type { InputState } from "../types";
import type { Arena } from "../world/Arena";
import { STEP } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import type { ItemBox } from "../entities/ItemBox";
import type { NavGrid } from "./NavGrid";
import { angleDelta, clamp, type Rng } from "../util";
import { STATS } from "../weapons/weapons";

export interface BotWorld {
  arena: Arena;
  nav: NavGrid;
  karts: Kart[];
  boxes: ItemBox[];
}

/**
 * A bot driver. With no weapon it routes to an item box; with one it hunts
 * the nearest kart, leads its shots and fires when lined up. Routes come from
 * the nav grid, so bots take ramps up to boxes on platforms instead of
 * grinding into the wall below. Feelers and a stuck timer cover the rest.
 * Skill (0..1) sets aim error, reaction time and how eagerly it fires.
 */
export class BotBrain {
  private think = 0;
  private target: Kart | null = null;
  private box: ItemBox | null = null;
  private wp: { x: number; z: number } | null = null;
  private path: { x: number; z: number }[] = [];
  private pathIdx = 0;
  private replanAt = -1;
  private goalX = 0;
  private goalZ = 0;
  private stuck = 0;
  private reverseUntil = -1;
  private reverseSteer = 1;
  private wobble = Math.random() * 100;
  private readonly out: InputState = { throttle: 0, steer: 0, fire: false, firePressed: false };

  constructor(
    private readonly k: Kart,
    private readonly rng: Rng,
  ) {}

  reset(): void {
    this.target = null;
    this.box = null;
    this.wp = null;
    this.path = [];
    this.replanAt = -1;
    this.stuck = 0;
    this.reverseUntil = -1;
  }

  update(dt: number, now: number, w: BotWorld): InputState {
    const k = this.k;
    const o = this.out;
    o.fire = false;
    o.firePressed = false;
    if (!k.alive) {
      o.throttle = 0;
      o.steer = 0;
      return o;
    }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.2 + (1 - k.skill) * 0.25;
      this.decide(w, now);
    }

    // Where we are ultimately going, and whether to aim straight at it.
    let gx: number;
    let gz: number;
    let direct = false;
    const t = this.target;
    if (t && t.alive) {
      const dist = Math.hypot(t.pos.x - k.pos.x, t.pos.z - k.pos.z);
      gx = t.pos.x;
      gz = t.pos.z;
      if (dist < 16 && Math.abs(t.pos.y - k.pos.y) < 1.2) {
        direct = true;
        const lead = k.weapon ? dist / this.projSpeed() : 0;
        gx = t.pos.x + t.vel.x * lead;
        gz = t.pos.z + t.vel.z * lead;
        if (dist < 5 && k.weapon && k.weapon.id !== "shield" && k.weapon.id !== "boost") {
          gx += (k.pos.x - t.pos.x) * 0.8;
          gz += (k.pos.z - t.pos.z) * 0.8;
        }
      }
    } else if (this.box && this.box.active) {
      gx = this.box.x;
      gz = this.box.z;
      if (Math.hypot(gx - k.pos.x, gz - k.pos.z) < 7 && Math.abs(this.box.y - 1.25 - k.pos.y) < STEP) direct = true;
    } else {
      if (!this.wp || Math.hypot(this.wp.x - k.pos.x, this.wp.z - k.pos.z) < 5) this.wp = this.rng.pick(w.arena.def.waypoints);
      gx = this.wp.x;
      gz = this.wp.z;
    }

    // The next point to steer at: straight at the goal, or along the route.
    let sx = gx;
    let sz = gz;
    if (!direct) {
      const moved = Math.hypot(gx - this.goalX, gz - this.goalZ) > 3;
      if (now >= this.replanAt || moved || this.pathIdx >= this.path.length) {
        this.goalX = gx;
        this.goalZ = gz;
        this.path = w.nav.findPath(k.pos.x, k.pos.z, gx, gz) ?? [];
        this.pathIdx = 0;
        this.replanAt = now + 0.6 + this.rng.next() * 0.4;
      }
      while (this.pathIdx < this.path.length && Math.hypot(this.path[this.pathIdx].x - k.pos.x, this.path[this.pathIdx].z - k.pos.z) < 2.3) this.pathIdx++;
      if (this.pathIdx < this.path.length) {
        const look = Math.min(this.path.length - 1, this.pathIdx + 1);
        sx = this.path[look].x;
        sz = this.path[look].z;
      }
    }

    const desired = Math.atan2(sx - k.pos.x, sz - k.pos.z);
    let d = angleDelta(k.yaw, desired);
    d += Math.sin(now * 1.7 + this.wobble) * (1 - k.skill) * 0.06;
    let steer = clamp(-d * 2.6, -1, 1);
    let throttle = 1;
    if (Math.abs(d) > 1.6 && k.speed > 8) throttle = 0.3;

    // Feelers: a wall ahead on one side pushes the steering to the other.
    const ahead = 2.6 + Math.abs(k.speed) * 0.14;
    const rx = Math.cos(k.yaw);
    const rz = -Math.sin(k.yaw);
    const bl = w.arena.blockedAt(k.pos.x + k.fx * ahead - rx * 1.1, k.pos.z + k.fz * ahead - rz * 1.1, k.pos.y);
    const br = w.arena.blockedAt(k.pos.x + k.fx * ahead + rx * 1.1, k.pos.z + k.fz * ahead + rz * 1.1, k.pos.y);
    const bc = w.arena.blockedAt(k.pos.x + k.fx * (ahead + 1.2), k.pos.z + k.fz * (ahead + 1.2), k.pos.y);
    if (bl && !br) steer = clamp(steer + 0.7, -1, 1);
    else if (br && !bl) steer = clamp(steer - 0.7, -1, 1);
    else if (bc || (bl && br)) {
      steer = steer >= 0 ? 1 : -1;
      throttle = 0.55;
    }

    // Stuck against something: back out, turning the other way, and replan.
    if (Math.abs(k.speed) < 1.3 && throttle > 0 && k.onGround) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 0.8) {
      this.stuck = 0;
      this.reverseUntil = now + 0.6 + this.rng.next() * 0.5;
      this.reverseSteer = steer >= 0 ? -1 : 1;
      this.replanAt = -1;
      this.think = 0;
    }
    if (now < this.reverseUntil) {
      throttle = -1;
      steer = this.reverseSteer;
    }

    o.throttle = throttle;
    o.steer = steer;
    this.aim(now, w);
    return o;
  }

  private decide(w: BotWorld, now: number): void {
    const k = this.k;
    let best: Kart | null = null;
    let bestScore = Infinity;
    for (const other of w.karts) {
      if (other === k || !other.alive || other.pendingBooster || other.protectUntil > now) continue;
      const dx = other.pos.x - k.pos.x;
      const dz = other.pos.z - k.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 90) continue;
      const dot = (dx * k.fx + dz * k.fz) / Math.max(1e-3, dist);
      const score = dist - dot * 10 + (Math.abs(other.pos.y - k.pos.y) > 1.2 ? 8 : 0) + this.rng.next() * 5;
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    if (k.weapon) {
      this.target = best;
      this.box = best ? null : this.nearestBox(w);
    } else {
      this.target = null;
      this.box = this.nearestBox(w);
      if (!this.box) this.target = best;
    }
  }

  private nearestBox(w: BotWorld): ItemBox | null {
    const k = this.k;
    let best: ItemBox | null = null;
    let bd = Infinity;
    for (const b of w.boxes) {
      if (!b.active) continue;
      const level = Math.abs(b.y - 1.25 - k.pos.y) > STEP ? 9 : 0;
      const d = Math.hypot(b.x - k.pos.x, b.z - k.pos.z) + level + this.rng.next() * 6;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private projSpeed(): number {
    const id = this.k.weapon?.id;
    if (id === "machinegun") return STATS.bullet.speed;
    if (id === "bomb") return STATS.bomb.speed * 1.2;
    return STATS.rocket.speed;
  }

  private aim(now: number, w: BotWorld): void {
    const k = this.k;
    const o = this.out;
    const wpn = k.weapon;
    if (!wpn) return;
    const t = this.target;
    const err = (1 - k.skill) * 0.14;
    let d = Math.PI;
    let dist = Infinity;
    let canHurt = false;
    if (t && t.alive) {
      dist = Math.hypot(t.pos.x - k.pos.x, t.pos.z - k.pos.z);
      const lead = dist / this.projSpeed();
      const ax = t.pos.x + t.vel.x * lead;
      const az = t.pos.z + t.vel.z * lead;
      d = angleDelta(k.yaw, Math.atan2(ax - k.pos.x, az - k.pos.z));
      canHurt = !t.isImmune(now) && Math.abs(t.pos.y - k.pos.y) < 2.5;
    }
    switch (wpn.id) {
      case "rockets":
        if (canHurt && Math.abs(d) < 0.15 + err && dist < 38 && dist > 2.5) o.firePressed = true;
        break;
      case "machinegun":
        if (canHurt && Math.abs(d) < 0.3 + err && dist < 32) o.fire = true;
        break;
      case "bomb":
        if (canHurt && Math.abs(d) < 0.3 + err && dist < 26 && dist > 4) o.firePressed = true;
        break;
      case "mines": {
        let behind = false;
        for (const other of w.karts) {
          if (other === k || !other.alive) continue;
          const dx = other.pos.x - k.pos.x;
          const dz = other.pos.z - k.pos.z;
          const dd = Math.hypot(dx, dz);
          if (dd < 14 && (dx * k.fx + dz * k.fz) / Math.max(1e-3, dd) < -0.3) behind = true;
        }
        if (behind || (k.speed > 8 && this.rng.next() < 0.006)) o.firePressed = true;
        break;
      }
      case "shield":
        if (k.hp < 50 || (canHurt && dist < 9) || this.rng.next() < 0.002) o.firePressed = true;
        break;
      case "boost":
        if ((canHurt && Math.abs(d) < 0.5 && dist < 22 && dist > 3) || k.hp < 35 || this.rng.next() < 0.003) o.firePressed = true;
        break;
    }
  }
}
