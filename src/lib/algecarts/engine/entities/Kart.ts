import * as THREE from "three";
import type { InputState, KartSetup, WeaponId } from "../types";
import type { Loadout } from "../profile";
import { EMPTY_INPUT } from "../types";
import type { KartView } from "../render/KartMesh";
import { KART } from "../physics/KartPhysics";
import { damp } from "../util";

export class Kart {
  readonly id: string;
  readonly name: string;
  readonly loadout: Loadout;
  readonly color: string;
  readonly bot: boolean;
  readonly skill: number;

  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  /** Signed forward speed after the last step. */
  speed = 0;
  onGround = true;
  groundY = 0;
  /** Vertical speed of the surface under us, for launching off ramps. */
  slopeRate = 0;
  airTime = 0;
  /** Set on touchdown to the landing's strength; the view squashes with it. */
  landed = 0;

  hp = 100;
  alive = true;
  respawnAt = 0;
  protectUntil = 0;
  weapon: { id: WeaponId; ammo: number } | null = null;
  shieldUntil = 0;
  boostUntil = 0;
  fireCooldown = 0;
  /** Waiting on the host to answer a requestBooster. */
  pendingBooster = false;

  kills = 0;
  deaths = 0;
  streak = 0;
  lastKillAt = -100;
  /** Who hurt us last and when, so an explosion that finishes us is credited right. */
  lastHitBy: string | null = null;
  lastHitAt = -100;
  /** Last time our ram hurt a given kart, so a shield deals damage in pulses. */
  readonly bumpAt = new Map<string, number>();

  input: InputState = { ...EMPTY_INPUT };
  /** The pedal and the wheel as they actually sit, trailing the input. */
  throttleS = 0;
  steerS = 0;

  view: KartView | null = null;
  // Visual state the view eases toward.
  steerVis = 0;
  leanVis = 0;
  pitchVis = 0;
  squash = 0;
  wheelSpin = 0;
  flash = 0;
  exhaustTimer = 0;
  skidTimer = 0;
  /** Arms up until then. */
  celebrateUntil = -1;

  constructor(s: KartSetup) {
    this.id = s.id;
    this.name = s.name;
    this.loadout = s.loadout;
    this.color = s.loadout.color;
    this.bot = s.bot;
    this.skill = s.skill;
  }

  get fx(): number {
    return Math.sin(this.yaw);
  }
  get fz(): number {
    return Math.cos(this.yaw);
  }

  isProtected(now: number): boolean {
    return this.protectUntil > now || this.pendingBooster;
  }
  isShielded(now: number): boolean {
    return this.shieldUntil > now;
  }
  isBoosting(now: number): boolean {
    return this.boostUntil > now;
  }
  /** Immune to damage right now. */
  isImmune(now: number): boolean {
    return !this.alive || this.isProtected(now) || this.isShielded(now);
  }

  place(x: number, z: number, yaw: number, y: number): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.onGround = true;
    this.speed = 0;
    this.slopeRate = 0;
    this.airTime = 0;
    this.throttleS = 0;
    this.steerS = 0;
  }

  /** Reset for a respawn or a new match. */
  revive(): void {
    this.hp = 100;
    this.alive = true;
    this.weapon = null;
    this.shieldUntil = 0;
    this.boostUntil = 0;
    this.fireCooldown = 0;
    this.pendingBooster = false;
    this.lastHitBy = null;
    this.streak = 0;
    this.input = { ...EMPTY_INPUT };
  }

  /** Ease the mesh toward the physics state: tilt, wheels, lights, bubbles. */
  syncView(dt: number, now: number): void {
    const v = this.view;
    if (!v) return;
    v.root.visible = this.alive;
    if (!this.alive) return;
    v.root.position.copy(this.pos);
    v.root.rotation.y = this.yaw;

    const frac = this.speed / KART.maxSpeed;
    this.steerVis = damp(this.steerVis, this.steerS * 0.42, 12, dt);
    this.leanVis = damp(this.leanVis, -this.steerS * frac * 0.1, 8, dt);
    // Pitch from the slope under the wheels, the nose lifting under power and dipping under braking.
    const slopePitch = this.onGround ? -Math.atan2(this.slopeRate / Math.max(1, Math.abs(this.speed)), 1) * 0.9 : 0.12 * Math.sign(-this.vel.y) * Math.min(1, Math.abs(this.vel.y) / 10);
    const weight = this.onGround ? -this.throttleS * Math.max(0, 1 - frac) * 0.06 + (this.throttleS < -0.2 && this.speed > 2 ? 0.06 : 0) : 0;
    const targetPitch = slopePitch + weight;
    this.pitchVis = damp(this.pitchVis, targetPitch, 7, dt);
    this.squash = Math.max(0, this.squash - dt * 3.5);
    if (this.landed > 0) {
      this.squash = Math.min(0.5, this.landed * 0.5);
      this.landed = 0;
    }
    v.body.rotation.set(this.pitchVis, 0, this.leanVis);
    v.body.scale.set(1 + this.squash * 0.25, 1 - this.squash * 0.4, 1 + this.squash * 0.1);
    v.body.position.y = -this.squash * 0.1;

    this.wheelSpin += (this.speed / 0.42) * dt;
    for (const w of v.wheels) w.rotation.x = this.wheelSpin;
    for (const p of v.frontPivots) p.rotation.y = -this.steerVis;

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      v.chassisMat.emissive.setRGB(this.flash, this.flash, this.flash);
    }

    const shield = this.isShielded(now);
    const protect = !shield && this.isProtected(now);
    v.shield.visible = shield || protect;
    if (v.shield.visible) {
      const m = v.shield.material as THREE.MeshBasicMaterial;
      m.color.set(shield ? "#6ff6ff" : "#ffe9a8");
      m.opacity = shield ? 0.26 : 0.07 + 0.04 * Math.sin(now * 14);
      const s = (shield ? 1 : 0.86) + 0.03 * Math.sin(now * 9);
      v.shield.scale.setScalar(s);
    }
    const boost = this.isBoosting(now);
    for (const f of v.flames) {
      f.visible = boost;
      if (boost) f.scale.set(0.9 + Math.random() * 0.3, 0.9 + Math.random() * 0.3, 0.8 + Math.random() * 0.6);
    }
    v.brake.visible = this.input.throttle < 0 && this.speed > 0.5;

    // The driver looks into the turn, leans with it, bobs with speed, and throws the arms up after a smash.
    const party = this.celebrateUntil > now;
    v.head.rotation.y = damp(v.head.rotation.y, party ? Math.sin(now * 6) * 0.3 : -this.steerVis * 1.5, 8, dt);
    v.head.rotation.x = damp(v.head.rotation.x, party ? -0.2 : 0, 8, dt);
    v.head.position.y = v.headY + Math.sin(now * 17) * 0.012 * frac + (party ? Math.abs(Math.sin(now * 9)) * 0.05 : 0);
    v.rig.rotation.z = damp(v.rig.rotation.z, party ? 0 : this.steerS * frac * 0.28, 6, dt);
    v.arms.forEach((arm, i) => {
      const side = i === 0 ? 1 : -1;
      const wave = party ? Math.sin(now * 10 + i) * 0.22 : 0;
      arm.rotation.x = damp(arm.rotation.x, party ? -1.75 : 0, 10, dt);
      arm.rotation.z = damp(arm.rotation.z, party ? -side * 0.45 + wave : 0, 10, dt);
    });

    // The ground blob stays on the ground when the kart is in the air.
    const lift = Math.max(0, this.pos.y - this.groundY);
    v.blob.position.y = -lift + 0.03;
    const bs = Math.max(0.35, 1 - lift * 0.12);
    v.blob.scale.set(bs, bs, 1);
  }
}
