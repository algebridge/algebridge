/**
 * How the players move, as joint angles the game loops write onto the
 * figures every frame.
 *
 * Steps are driven by distance, not by a clock. A stride covers the ground
 * it should, so a planted foot stays planted: running faster lengthens the
 * stride and quickens it together, the way a real runner's does. Swing,
 * bounce and lean all grow with speed, so a jog looks like a jog and a
 * sprint like a sprint. Moving up or down the court (toward or away from the
 * camera) swings the legs less sideways and lifts the knees instead.
 *
 * Skating is different: a skater pushes, then glides. Strokes run while
 * there is a push (an arrow held) and fade into a glide pose when there is
 * not, however fast she is going.
 *
 * Angles follow the figures' CSS: 0 hangs straight, a negative thigh or arm
 * turns forward (the way the figure faces), a positive shin bends the knee,
 * a negative forearm bends the elbow. Lengths are in figure units (a figure
 * is drawn 160 tall).
 */

import type { CourtGameId } from "@/lib/games";

export interface Gait {
  /** Ground one full stride (two steps) covers, in scene units, for a figure 170 tall: at a walk, and at top speed. */
  strideSlow: number;
  strideFast: number;
  /** Thigh swing either side of the base at top speed, degrees. */
  thigh: number;
  /** How far the knee folds as the leg swings through, at top speed. */
  knee: number;
  /** Arm swing either side of the base at top speed. */
  arm: number;
  /** Elbow bend added at a walk and at top speed (negative bends). */
  foreSlow: number;
  foreFast: number;
  /** Body rise and fall at top speed, figure units. */
  bob: number;
  /** Forward lean at top speed, degrees. */
  lean: number;
  /** The pose the motion is added to: the sport's own stance. */
  base: { thighF: number; thighB: number; shinF: number; shinB: number; armF: number; armB: number; foreF: number; foreB: number; body: number };
}

const STAND = { thighF: 0, thighB: 0, shinF: 0, shinB: 0, armF: 0, armB: 0, foreF: 0, foreB: 0, body: 0 };

export const GAITS: Record<CourtGameId, Gait> = {
  // Rayla: a footballer's run, long strides at pace, arms pumping.
  soccer: { strideSlow: 130, strideFast: 300, thigh: 30, knee: 80, arm: 34, foreSlow: -30, foreFast: -72, bob: 3.2, lean: 11, base: STAND },
  // Jordyn: quick, explosive steps, a little shorter, from a soft-armed stance.
  volleyball: {
    strideSlow: 120,
    strideFast: 260,
    thigh: 27,
    knee: 74,
    arm: 28,
    foreSlow: -18,
    foreFast: -48,
    bob: 2.8,
    lean: 9,
    base: { ...STAND, armF: -10, armB: 7, foreF: -22, foreB: -22 },
  },
  // Jo: a bouncy jog, pom-poms held at her sides.
  cheer: {
    strideSlow: 110,
    strideFast: 230,
    thigh: 24,
    knee: 70,
    arm: 12,
    foreSlow: -10,
    foreFast: -26,
    bob: 4.2,
    lean: 6,
    base: { ...STAND, armF: -16, armB: 16, foreF: -14, foreB: -14 },
  },
  // Shaurya: a wrestler's shuffle, low, hands up in a guard, feet never crossing.
  wrestling: {
    strideSlow: 64,
    strideFast: 120,
    thigh: 13,
    knee: 22,
    arm: 5,
    foreSlow: 0,
    foreFast: 0,
    bob: 1.4,
    lean: 3,
    base: { thighF: -3, thighB: 4, shinF: 9, shinB: 4, armF: -25, armB: -17, foreF: -74, foreB: -68, body: 4 },
  },
};

export interface Pose {
  thighF: number;
  thighB: number;
  shinF: number;
  shinB: number;
  armF: number;
  armB: number;
  foreF: number;
  foreB: number;
  /** Body lean, degrees. */
  body: number;
  /** Rise of the whole figure, figure units (negative is up). */
  bob: number;
  /** Leg length kept when a knee comes up toward or away from the camera (1 = full). */
  liftF: number;
  liftB: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The knee through one stride, 0 to 1: bends as the leg leaves the ground, folds most swinging through, reaches out straight to land. */
const KNEE: [number, number][] = [
  [0, 0],
  [0.25, 0.17],
  [0.5, 0.39],
  [0.68, 1],
  [0.86, 0.42],
  [1, 0],
];

function knee(phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  for (let i = 1; i < KNEE.length; i += 1) {
    const [t1, v1] = KNEE[i];
    const [t0, v0] = KNEE[i - 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const e = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * e;
    }
  }
  return 0;
}

/** Ground one stride covers at this speed (0..1) for a figure of `height`, standing at depth scale `depth`. */
export function strideLength(g: Gait, speed: number, height: number, depth: number): number {
  return (g.strideSlow + (g.strideFast - g.strideSlow) * speed) * (height / 170) * depth;
}

/**
 * The pose at `phase` (0..1 through a stride) and `speed` (0..1 of top
 * speed). `side` is how much of the motion is across the court (1) rather
 * than up or down it (0); `push` is the acceleration along the way of
 * travel, -1 (braking) to 1 (driving off).
 */
export function gaitPose(g: Gait, phase: number, speed: number, side: number, push: number): Pose {
  const s = Math.min(1, Math.max(0, speed));
  const a = 0.35 + 0.65 * s;
  const across = 0.4 + 0.6 * Math.min(1, Math.max(0, side));
  const w = 2 * Math.PI * phase;
  const c = Math.cos(w);
  const depthLift = (1 - Math.min(1, Math.max(0, side))) * 0.16 * a;
  const fore = g.foreSlow + (g.foreFast - g.foreSlow) * s;
  const b = g.base;
  return {
    thighF: r3(b.thighF - g.thigh * a * across * c),
    thighB: r3(b.thighB + g.thigh * a * across * c),
    shinF: r3(b.shinF + g.knee * a * knee(phase)),
    shinB: r3(b.shinB + g.knee * a * knee(phase + 0.5)),
    armF: r3(b.armF + g.arm * a * across * c),
    armB: r3(b.armB - g.arm * a * across * c),
    foreF: r3(b.foreF + fore),
    foreB: r3(b.foreB + fore),
    body: r3(b.body + g.lean * s + Math.max(-4, Math.min(6, 6 * push))),
    // Lowest as each foot lands, highest between: twice a stride.
    bob: r3(-g.bob * s * (0.5 - 0.5 * Math.cos(2 * w))),
    liftF: r3(1 - depthLift * (0.5 + 0.5 * c)),
    liftB: r3(1 - depthLift * (0.5 - 0.5 * c)),
  };
}

/* ── Skating ─────────────────────────────────────────────────────── */

export interface SkatePose {
  thighF: number;
  thighB: number;
  shinF: number;
  shinB: number;
  footF: number;
  footB: number;
  armF: number;
  armB: number;
  foreF: number;
  foreB: number;
  body: number;
  bob: number;
}

/** How long one pair of strokes takes, in seconds, at this speed (0..1). */
export function strokePeriod(speed: number): number {
  return 0.95 - 0.35 * Math.min(1, Math.max(0, speed));
}

/**
 * Veronica on the ice at `phase` (0..1 through a pair of strokes), `speed`
 * (0..1) and `push` (0..1, how much she is stroking rather than gliding).
 * Gliding: the front skate under her on a bent knee, the free leg trailing,
 * arms out. Stroking: the legs drive back in turn, the knee straightening as
 * it pushes, the blade kept flat.
 */
export function skatePose(phase: number, speed: number, push: number): SkatePose {
  const s = Math.min(1, Math.max(0, speed));
  const p = Math.min(1, Math.max(0, push));
  const w = 2 * Math.PI * phase;
  const c = Math.cos(w);
  const mix = (glide: number, stroke: number) => r3(glide + (stroke - glide) * p);
  return {
    thighF: mix(-4, -24 * c),
    thighB: mix(16, 24 * c),
    shinF: mix(16, 11 + 9 * c),
    shinB: mix(6, 11 - 9 * c),
    footF: mix(0, -11 * Math.abs(Math.sin(w))),
    footB: mix(-6, -11 * Math.abs(Math.sin(w))),
    armF: r3(-98 + 5 * Math.sin(w) * (0.4 + 0.6 * p)),
    armB: r3(74 + 5 * Math.sin(w) * (0.4 + 0.6 * p)),
    foreF: -12,
    foreB: -8,
    body: r3(5 + 6 * s + 2 * p),
    bob: r3(-1.4 * p * (0.5 - 0.5 * Math.cos(2 * w))),
  };
}

/** Eases `from` toward `to` at `rate` per second: the smoothing every value above goes through. */
export function approach(from: number, to: number, rate: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * dt));
}
