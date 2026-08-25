/**
 * The yard camera, shared between the renderer and the browser.
 *
 * Every number here is a copy of one in scripts/gen-turntable.ts. They have to
 * agree exactly, because this is what projects an ornament you place in the
 * yard onto a frame that was rendered offline — get one of them wrong and the
 * decorations sit beside the house rather than on it.
 *
 * Decorations are stored in WORLD coordinates around the pad, not as screen
 * percentages. That is the whole trick: a screen position is only true for one
 * camera angle, so anything stored that way would slide off the moment the
 * view is spun. Stored in the world, an ornament is re-projected per frame and
 * orbits with everything else.
 */

export const TURNTABLE_FRAMES = 12;

const CAM_Y = 1.85;
const HORIZON = 0.6;
const PITCH_SCALE = 1.02;
const FOV = 0.66;
const PAD_Z = 15.5;
/** The pad is levelled to this height, and ornaments stand on it. */
const PAD_Y = 0.14;
/** How far from the pad centre something may be placed. */
export const PAD_LIMIT = 6.4;

export interface Placed {
  /** Metres east of the pad centre. */
  x: number;
  /** Metres north of the pad centre. */
  z: number;
}

export interface Projected {
  /** Percent across the frame. */
  left: number;
  /** Percent down the frame, at the object's feet. */
  top: number;
  /** Size multiplier from perspective alone. 1 at the pad centre. */
  scale: number;
  /** Forward distance, for painter's-order sorting. */
  depth: number;
  /** False when the point is behind the camera. */
  visible: boolean;
}

function basis(frame: number) {
  const theta = (frame / TURNTABLE_FRAMES) * Math.PI * 2;
  const fwd = { x: Math.sin(theta), z: Math.cos(theta) };
  const right = { x: Math.cos(theta), z: -Math.sin(theta) };
  // The eye sits one pad-radius back along the view axis, so the pad centre is
  // always exactly PAD_Z in front of it whatever the angle.
  const eye = { x: -fwd.x * PAD_Z, z: PAD_Z - fwd.z * PAD_Z };
  return { fwd, right, eye };
}

/** World position around the pad → where it lands on the rendered frame. */
export function project(p: Placed, frame: number): Projected {
  const { fwd, right, eye } = basis(frame);
  const rx = p.x - eye.x;
  const rz = p.z + PAD_Z - eye.z;

  const depth = rx * fwd.x + rz * fwd.z;
  if (depth <= 0.5) {
    return { left: 0, top: 0, scale: 0, depth, visible: false };
  }
  const lateral = rx * right.x + rz * right.z;

  const dirX = lateral / depth;
  const left = (dirX / (2 * FOV) + 0.5) * 100;
  const top = (HORIZON + ((CAM_Y - PAD_Y) / depth) * PITCH_SCALE) * 100;
  // Objects halve in size as they double in distance, like everything else.
  const scale = PAD_Z / depth;

  return { left, top, scale, depth, visible: left > -20 && left < 120 };
}

/** A point on the frame → where it lands on the pad, for click-to-place. */
export function unproject(leftPct: number, topPct: number, frame: number): Placed | null {
  const { fwd, right, eye } = basis(frame);
  const yFrac = topPct / 100 - HORIZON;
  // Above the horizon there is no ground to put anything on.
  if (yFrac <= 0.001) return null;

  const depth = ((CAM_Y - PAD_Y) * PITCH_SCALE) / yFrac;
  if (depth <= 0.5 || depth > 80) return null;

  const dirX = (leftPct / 100 - 0.5) * 2 * FOV;
  const lateral = dirX * depth;

  const wx = eye.x + fwd.x * depth + right.x * lateral;
  const wz = eye.z + fwd.z * depth + right.z * lateral;
  return { x: wx, z: wz - PAD_Z };
}

/** Placement has to stay on the levelled ground, or ornaments float. */
export function onPad(p: Placed): boolean {
  return Math.sqrt(p.x * p.x + p.z * p.z) <= PAD_LIMIT;
}

export function clampToPad(p: Placed): Placed {
  const r = Math.sqrt(p.x * p.x + p.z * p.z);
  if (r <= PAD_LIMIT) return p;
  const k = PAD_LIMIT / r;
  return { x: p.x * k, z: p.z * k };
}
