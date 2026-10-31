import type { Arena } from "../world/Arena";
import type { Kart } from "../entities/Kart";
import { approach, clamp } from "../util";

/** Arcade tuning. Units are metres and seconds; a kart is about 2.4 m long. */
export const KART = {
  radius: 0.95,
  height: 1.3,
  maxSpeed: 24,
  reverseMax: 9,
  /** Peak push, off the line; it eases toward top speed. */
  accel: 17,
  brake: 26,
  /** Deceleration with no throttle. */
  coast: 4,
  /** How fast sideways slip dies: higher is grippier. Loosens a little at speed. */
  grip: 8.5,
  turnRate: 2.6,
  /** How fast the pedal and the wheel move, per second of full travel. */
  throttleRise: 2.0,
  throttleFall: 5,
  steerRise: 5.5,
  steerFall: 9,
  gravity: 34,
  boostMul: 1.55,
  /** Bounce kept on a wall hit. */
  wallRestitution: 0.3,
  kartRestitution: 0.55,
  /** Drop per step that counts as leaving the ground. */
  dropOff: 0.35,
};

/** One fixed step of kart motion: throttle, steering, slip, gravity and the ground. */
export function stepKart(k: Kart, dt: number, arena: Arena, now: number): void {
  const boosting = k.boostUntil > now;
  const maxSpeed = KART.maxSpeed * (boosting ? KART.boostMul : 1);
  const accel = KART.accel * (boosting ? 1.7 : 1);
  const fx = Math.sin(k.yaw);
  const fz = Math.cos(k.yaw);
  let fwd = k.vel.x * fx + k.vel.z * fz;
  let latX = k.vel.x - fx * fwd;
  let latZ = k.vel.z - fz * fwd;
  const inp = k.input;

  // The pedal and the wheel take time to travel, so nothing happens in a snap.
  // Bots already plan ahead, so theirs move faster; the feel is for the player.
  // You stomp a brake, so it travels faster than the gas.
  const tRise = k.bot ? 8 : inp.throttle < 0 ? KART.throttleRise * 2 : KART.throttleRise;
  const sRise = k.bot ? 9 : KART.steerRise;
  k.throttleS = approach(k.throttleS, inp.throttle, (Math.abs(inp.throttle) > Math.abs(k.throttleS) ? tRise : KART.throttleFall) * dt);
  k.steerS = approach(k.steerS, inp.steer, (Math.abs(inp.steer) > Math.abs(k.steerS) ? sRise : KART.steerFall) * dt);
  const th = k.throttleS;
  const st = k.steerS;

  if (k.onGround) {
    const frac = clamp(Math.abs(fwd) / KART.maxSpeed, 0, 1);
    if (th > 0) {
      // Pulls hard off the line, then eases toward top speed.
      const curve = 0.3 + 0.7 * (1 - Math.pow(frac, 1.5));
      fwd += accel * th * curve * dt;
    } else if (th < 0) fwd -= (fwd > 0.5 ? KART.brake : accel * 0.5) * -th * dt;
    else fwd = approach(fwd, 0, KART.coast * dt);
    if (boosting) fwd = Math.max(fwd, Math.min(maxSpeed, fwd + accel * dt));
    fwd = clamp(fwd, -KART.reverseMax, maxSpeed);
    // Over the top speed (a knockback, a boost that just ended) you bleed off.
    if (fwd > maxSpeed) fwd = approach(fwd, maxSpeed, 12 * dt);
    // Grip loosens with speed, so fast corners slide a little.
    const g = Math.exp(-KART.grip * (1 - 0.35 * frac) * dt);
    latX *= g;
    latZ *= g;
    // Right is clockwise seen from above, which is a negative turn about +y.
    const bite = clamp(fwd / 4, -1, 1);
    const fast = 1 - 0.45 * frac;
    k.yaw -= st * KART.turnRate * bite * fast * dt;
  } else {
    k.yaw -= st * 0.9 * dt;
    k.vel.y -= KART.gravity * dt;
    const g = Math.exp(-0.15 * dt);
    fwd *= g;
    latX *= g;
    latZ *= g;
  }

  const nfx = Math.sin(k.yaw);
  const nfz = Math.cos(k.yaw);
  k.vel.x = nfx * fwd + latX;
  k.vel.z = nfz * fwd + latZ;
  k.pos.x += k.vel.x * dt;
  k.pos.z += k.vel.z * dt;
  if (!k.onGround) k.pos.y += k.vel.y * dt;

  const gy = arena.heightAt(k.pos.x, k.pos.z, k.pos.y);
  if (k.onGround) {
    if (gy < k.pos.y - KART.dropOff) {
      // Off an edge or the lip of a kicker: carry the ramp's climb into the air.
      k.onGround = false;
      k.vel.y = clamp(k.slopeRate, 0, 18);
      k.airTime = 0;
    } else {
      k.slopeRate = (gy - k.pos.y) / dt;
      k.pos.y = gy;
      k.vel.y = 0;
    }
  } else {
    k.airTime += dt;
    if (k.pos.y <= gy) {
      k.pos.y = gy;
      k.landed = Math.max(0.5, -k.vel.y / 10);
      k.vel.y = 0;
      k.onGround = true;
      k.slopeRate = 0;
    }
  }
  k.groundY = gy;
  k.speed = fwd;
}
