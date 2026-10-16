/**
 * A student's character in 3D, built from their spec (lib/avatar.ts) with
 * the same kit as the furniture, so it stands in the same light as the
 * house. About 1.7 m tall, standing on the floor at the origin, facing +z.
 * Its joints are groups, so it can be posed: standing, walking, waving.
 *
 * Two figures, a girl and a boy, from one set of measurements each
 * (SHAPES): the breadth of the shoulders against the hips, the waist, the
 * neck, the limbs, the jaw, the eyes. Everything else, hair, clothes and
 * extras, is open to both. The body is turned (lathes) so every joint is
 * tangent to the limb it joins, with nothing bolted on, and the hair stops
 * at a hairline above the brows instead of sitting on the face.
 */

import * as THREE from "three";
import type { Kit } from "./kit";
import type { AvatarSpec } from "@/types";

export interface Figure {
  /** At the feet, facing +z. Turn it to walk another way. */
  root: THREE.Group;
  /** The hips: the torso, arms and head hang from it, and it bobs with each step. */
  body: THREE.Group;
  head: THREE.Group;
  shoulders: [THREE.Group, THREE.Group];
  elbows: [THREE.Group, THREE.Group];
  hips: [THREE.Group, THREE.Group];
  knees: [THREE.Group, THREE.Group];
  /** Standing height in metres, as built (before any scaling). */
  height: number;
}

/** Proportions at medium height, in metres: about seven heads tall. */
const HIP_Y = 0.88;
const THIGH = 0.43;
const SHIN = 0.39;
const TORSO_H = 0.56;
const NECK = 0.07;
const UPPER = 0.27;
const FORE = 0.235;

const HEIGHT_SCALE: Record<AvatarSpec["height"], number> = { short: 0.92, medium: 1, tall: 1.08 };
const BUILD_SCALE: Record<AvatarSpec["build"], number> = { slim: 0.91, medium: 1, broad: 1.12 };

/** What makes the two figures: half-widths in metres, and the face. */
interface Shape {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  /** The torso's depth against its width. */
  depth: number;
  neck: number;
  arm: number;
  leg: number;
  knee: number;
  /** Where the hips are, either side of the middle. */
  hipX: number;
  hand: number;
  foot: number;
  head: number;
  jaw: [number, number, number];
  eye: number;
  lashes: boolean;
  lips: boolean;
  brow: number;
  browArc: number;
  /** The whole figure, against the boy's 1.74 m. */
  scale: number;
}

const SHAPES: Record<AvatarSpec["figure"], Shape> = {
  boy: { shoulder: 0.2, chest: 0.176, waist: 0.16, hip: 0.168, depth: 0.62, neck: 0.047, arm: 0.046, leg: 0.076, knee: 0.056, hipX: 0.095, hand: 1, foot: 1, head: 0.108, jaw: [1, 0.82, 0.96], eye: 1, lashes: false, lips: false, brow: 0.0038, browArc: 0.66, scale: 1 },
  girl: { shoulder: 0.168, chest: 0.158, waist: 0.122, hip: 0.178, depth: 0.6, neck: 0.04, arm: 0.04, leg: 0.072, knee: 0.052, hipX: 0.1, hand: 0.9, foot: 0.9, head: 0.106, jaw: [0.92, 0.78, 0.95], eye: 1.12, lashes: true, lips: true, brow: 0.0028, browArc: 0.78, scale: 0.955 },
};

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** A hex colour made lighter (f > 1) or darker (f < 1). */
function shade(hex: string, f: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;
}

/** A colour part of the way (t) to another. */
function mix(hex: string, to: string, t: number): string {
  return `#${new THREE.Color(hex).lerp(new THREE.Color(to), t).getHexString()}`;
}

type Pt = [number, number];
type V3 = [number, number, number];

/**
 * A limb hanging from its joint at the origin, turned from a profile of
 * [radius, distance down the limb] pairs: a thigh that narrows to the knee, a
 * calf with its muscle, a forearm to the wrist.
 */
function limb(k: Kit, profile: Pt[], m: THREE.Material): THREE.Mesh {
  // From the bottom up, as the kit's lathe wants it.
  const pts: Pt[] = [...profile].sort((a, b) => b[1] - a[1]).map(([r, d]) => [r, -d]);
  return k.lathe(pts, m, { seg: 18 });
}

/** A point along a Catmull-Rom curve through `pts` (the curve a tube follows), for beads on a braid. */
function along(pts: V3[], t: number): V3 {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const p = c.getPoint(t);
  return [p.x, p.y, p.z];
}

/** Turns a ring (a torus, whose hole runs along its own z) so the hole runs along `dir`. */
function aim<T extends THREE.Object3D>(o: T, dir: V3): T {
  o.quaternion.setFromUnitVectors(Z_AXIS, new THREE.Vector3(dir[0], dir[1], dir[2]).normalize());
  return o;
}

export function buildFigure(k: Kit, spec: AvatarSpec): Figure {
  const S = SHAPES[spec.figure];
  const b = BUILD_SCALE[spec.build];
  const skin = k.paint(spec.skin, 0.24);
  const hairM = k.plastic(spec.hairColor, 0.28);
  const top = k.fabric(spec.topColor);
  const topDark = k.fabric(shade(spec.topColor, 0.76));
  const bottom = k.fabric(spec.bottomColor);
  const bottomDark = k.fabric(shade(spec.bottomColor, 0.72));
  const shoe = k.plastic(spec.shoes, 0.4);
  const sole = k.plastic("#f3f0ea", 0.3);
  const lace = k.plastic("#f8f6f1", 0.3);
  const dark = k.plastic("#1b1d21", 0.5);
  const white = k.fabric("#f4f1ea");
  const gold = k.metal("gold", 0.25);
  const accent = k.plastic(spec.topColor, 0.5);
  const longSleeves = ["hoodie", "jacket", "sweater", "cardigan"].includes(spec.top);
  const shortSleeves = ["tee", "jersey"].includes(spec.top);
  const dress = spec.top === "dress";
  const skirt = dress || spec.bottom === "skirt";
  const shorts = spec.bottom === "shorts";
  const legsBare = skirt || shorts;

  // Widths, with the build.
  const shoulder = S.shoulder * b;
  const chest = S.chest * b;
  const waist = S.waist * b;
  const hip = S.hip * b;
  const arm = S.arm * Math.sqrt(b);
  const leg = S.leg * Math.sqrt(b);
  const knee = S.knee;
  const R = S.head;
  const D = S.depth;

  const root = new THREE.Group();
  root.name = "figure";

  // ── Legs, from the hips at the root ──
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const legM = legsBare ? skin : bottom;
  const thighProfile: Pt[] = [[leg, 0.0], [leg * 0.97, 0.12], [leg * 0.86, 0.3], [knee, THIGH]];
  const shinProfile: Pt[] = [[knee, 0.0], [knee * 1.05, 0.1], [knee * 0.86, 0.24], [knee * 0.66, SHIN - 0.03], [knee * 0.7, SHIN]];
  for (const sx of [-1, 1]) {
    const hipJ = new THREE.Group();
    hipJ.position.set(sx * S.hipX * b, HIP_Y, 0);
    hipJ.add(k.sphere(leg, legM, { at: [0, -0.01, 0], scale: [1, 0.85, 1], seg: 16 }));
    hipJ.add(limb(k, thighProfile, legM));
    if (shorts) {
      // Shorts over a bare leg: a little wider than the thigh, to mid-thigh, with a hem.
      hipJ.add(limb(k, [[leg + 0.005, 0.0], [leg * 0.98 + 0.005, 0.11], [leg * 0.91 + 0.005, 0.22]], bottom));
      hipJ.add(k.cyl(leg * 0.91 + 0.007, leg * 0.91 + 0.007, 0.014, bottomDark, { at: [0, -0.22, 0], seg: 18 }));
    }
    if (spec.bottom === "joggers") hipJ.add(k.box(0.014, THIGH - 0.08, 0.03, white, { at: [sx * (leg * 0.9 - 0.006), -THIGH / 2 + 0.01, 0.0], rot: [0, 0, sx * 0.045] }));
    const kneeJ = new THREE.Group();
    kneeJ.position.set(0, -THIGH, 0);
    kneeJ.add(k.sphere(knee, legM, { seg: 16 }));
    kneeJ.add(limb(k, shinProfile, legM));
    if (spec.bottom === "joggers") kneeJ.add(k.cyl(knee * 0.78, knee * 0.78, 0.05, bottomDark, { at: [0, -SHIN + 0.035, 0], seg: 16 }));
    if (spec.bottom === "jeans") kneeJ.add(k.cyl(knee * 0.72, knee * 0.72, 0.022, k.fabric(shade(spec.bottomColor, 1.25)), { at: [0, -SHIN + 0.02, 0], seg: 16 }));
    // The shoe: a low sneaker, a toe cap, a pale sole, laces across the top, a heel tab.
    const fy = -SHIN - 0.012;
    const fl = S.foot;
    kneeJ.add(k.box(0.088 * fl, 0.068, 0.17 * fl, shoe, { at: [0, fy, 0.02], r: 0.028 }));
    kneeJ.add(k.sphere(0.045 * fl, shoe, { at: [0, fy - 0.012, 0.1 * fl], scale: [1, 0.66, 1.15], seg: 16 }));
    kneeJ.add(k.sphere(0.04 * fl, shoe, { at: [0, fy - 0.004, -0.045], scale: [1, 0.95, 0.85], seg: 14 }));
    kneeJ.add(k.box(0.096 * fl, 0.022, 0.25 * fl, sole, { at: [0, fy - 0.036, 0.045 * fl], r: 0.011 }));
    kneeJ.add(k.box(0.05 * fl, 0.012, 0.07, lace, { at: [0, fy + 0.03, 0.06 * fl], rot: [0.5, 0, 0], r: 0.004 }));
    for (let i = 0; i < 3; i += 1) kneeJ.add(k.box(0.046 * fl, 0.005, 0.01, lace, { at: [0, fy + 0.03 - i * 0.006, 0.035 + i * 0.026], rot: [0.4, 0, 0] }));
    kneeJ.add(k.box(0.03, 0.03, 0.008, lace, { at: [0, fy + 0.02, -0.065], r: 0.003 }));
    hipJ.add(kneeJ);
    root.add(hipJ);
    hips.push(hipJ);
    knees.push(kneeJ);
  }

  // ── The body: a turned torso, wider at the chest and shoulders, flatter front to back ──
  const body = new THREE.Group();
  body.position.set(0, HIP_Y, 0);
  root.add(body);
  // The seat and waistband, in the trousers' colour (the dress's own below the waist).
  const seatM = dress ? top : bottom;
  const seat = k.lathe([[hip * 0.76, -0.18], [hip * 0.94, -0.1], [hip, -0.03], [hip * 0.99, 0.02]], seatM, { seg: 28 });
  seat.scale.z = D + 0.05;
  body.add(seat);
  if (spec.bottom === "jeans" && !dress) {
    body.add(k.torus(hip * 0.995, 0.006, bottomDark, { at: [0, 0.015, 0], rot: [Math.PI / 2, 0, 0], scale: [1, D + 0.05, 1], seg: 28 }));
    body.add(k.box(0.006, 0.1, 0.008, bottomDark, { at: [0, -0.08, hip * (D + 0.05) - 0.002] }));
    for (const sx of [-1, 1]) body.add(k.box(0.058, 0.06, 0.008, bottomDark, { at: [sx * 0.052, -0.1, -hip * (D + 0.05) + 0.001], rot: [0.12, 0, 0], r: 0.004 }));
  }
  // The top, from a hem over the waistband up to the neck. The shoulders are
  // part of the same turning, rounding off where the arms join.
  const torsoProfile: Pt[] = [[hip * 0.97, -0.035], [hip * 0.99, 0.0], [waist, 0.16], [chest * 0.97, 0.3], [chest, 0.4], [shoulder * 0.96, 0.455], [shoulder, 0.49], [shoulder * 0.93, 0.52], [shoulder * 0.72, 0.545], [S.neck * 1.5, TORSO_H]];
  const torso = k.lathe(torsoProfile, top, { seg: 28 });
  torso.scale.z = D;
  body.add(torso);
  /** The torso's radius at a height, read off its profile. */
  const radiusAt = (y: number): number => {
    const p = torsoProfile;
    for (let i = 1; i < p.length; i += 1) {
      if (y <= p[i][1]) {
        const [r0, y0] = p[i - 1];
        const [r1, y1] = p[i];
        return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
    }
    return p[p.length - 1][0];
  };
  /** Where the torso's surface is (its z) at a height and an x, for anything sewn on the front (or, negated, the back). */
  const surfZ = (y: number, x = 0): number => D * Math.sqrt(Math.max(0, radiusAt(y) ** 2 - x * x));
  if (skirt) {
    // A skirt (or the dress below its waist) flares from the waist; the dress's to the knee.
    const sk = dress
      ? k.lathe([[hip * 1.62, -0.42], [hip * 1.4, -0.3], [hip * 1.14, -0.15], [hip * 1.0, -0.03], [hip * 0.985, 0.02]], top, { seg: 32 })
      : k.lathe([[hip * 1.45, -0.3], [hip * 1.26, -0.2], [hip * 1.05, -0.08], [hip * 0.985, 0.02]], bottom, { seg: 32 });
    sk.scale.z = D + 0.08;
    body.add(sk);
    if (dress) body.add(k.torus(hip * 0.995, 0.006, topDark, { at: [0, 0.0, 0], rot: [Math.PI / 2, 0, 0], scale: [1, D + 0.02, 1], seg: 28 }));
  }
  // The neck.
  body.add(k.cyl(S.neck, S.neck * 1.12, NECK + 0.04, skin, { at: [0, TORSO_H + NECK / 2 - 0.01, 0], seg: 16 }));

  // A ring round the neck, open at the front: a rolled hood, a jacket's collar. Flat, then spun so the gap faces +z.
  const collar = (ringR: number, tubeR: number, m: THREE.Material, y: number, arc: number) => k.torus(ringR, tubeR, m, { at: [0, y, -0.006], rot: [Math.PI / 2, 0, 1.5 * Math.PI - arc / 2], arc, seg: 20 });

  // What the top is.
  if (spec.top === "hoodie") {
    // The hood, down at the back; its opening rolled round the neck; a pocket; drawstrings.
    body.add(k.sphere(0.1, top, { at: [0, TORSO_H - 0.035, -0.085], scale: [1.1, 0.55, 0.85], seg: 18 }));
    body.add(collar(S.neck + 0.03, 0.028, top, TORSO_H - 0.005, Math.PI * 1.35));
    body.add(k.box(chest * 1.2, 0.12, 0.022, top, { at: [0, 0.1, surfZ(0.1) + 0.004], r: 0.014 }));
    body.add(k.box(chest * 1.2, 0.008, 0.014, topDark, { at: [0, 0.158, surfZ(0.16) + 0.01], r: 0.003 }));
    for (const sx of [-1, 1]) {
      body.add(k.cyl(0.004, 0.004, 0.14, white, { at: [sx * 0.03, 0.44, surfZ(0.44) + 0.006], seg: 6 }));
      body.add(k.cyl(0.005, 0.005, 0.012, dark, { at: [sx * 0.03, 0.365, surfZ(0.37) + 0.006], seg: 6 }));
    }
  } else if (spec.top === "jacket") {
    // Open over a white tee: two fronts with lapels, a collar, a zip line.
    // The tee shows in a narrow strip down the middle, inside the torso's curve; the lapels fold out from its edges.
    body.add(k.box(chest * 0.5, TORSO_H - 0.12, 0.03, white, { at: [0, TORSO_H / 2 - 0.02, surfZ(0.3) - 0.012], r: 0.006 }));
    for (const sx of [-1, 1]) {
      body.add(k.box(0.05, 0.12, 0.012, topDark, { at: [sx * 0.05, TORSO_H - 0.1, surfZ(0.46, 0.05) + 0.002], rot: [0.1, sx * 0.3, sx * 0.55], r: 0.004 }));
      body.add(k.box(0.014, TORSO_H - 0.22, 0.012, topDark, { at: [sx * 0.045, TORSO_H / 2 - 0.07, surfZ(0.24, 0.045) + 0.004] }));
    }
    body.add(collar(S.neck + 0.022, 0.016, topDark, TORSO_H - 0.005, Math.PI * 1.2));
  } else if (spec.top === "cardigan") {
    // Over a white tee: two soft fronts, buttons down one of them, a ribbed edge.
    body.add(k.box(chest * 0.84, TORSO_H - 0.14, 0.016, white, { at: [0, TORSO_H / 2 - 0.02, surfZ(0.3) - 0.004], r: 0.008 }));
    for (const sx of [-1, 1]) body.add(k.box(0.02, TORSO_H - 0.16, 0.014, topDark, { at: [sx * 0.03, TORSO_H / 2 - 0.045, surfZ(0.28, 0.03) + 0.005], r: 0.004 }));
    for (let i = 0; i < 4; i += 1) body.add(k.sphere(0.007, k.plastic(shade(spec.topColor, 0.55), 0.6), { at: [0.03, 0.12 + i * 0.09, surfZ(0.12 + i * 0.09, 0.03) + 0.012], seg: 8 }));
    body.add(collar(S.neck + 0.02, 0.012, topDark, TORSO_H - 0.01, Math.PI * 1.3));
  } else if (spec.top === "jersey") {
    for (const y of [TORSO_H * 0.66, TORSO_H * 0.54]) {
      const stripe = k.cyl(radiusAt(y) + 0.003, radiusAt(y) + 0.003, 0.03, white, { at: [0, y, 0], seg: 28 });
      stripe.scale.z = D + 0.01;
      body.add(stripe);
    }
    for (const sx of [-1, 1]) body.add(k.box(0.05, 0.07, 0.008, white, { at: [sx * 0.03, TORSO_H - 0.05, surfZ(0.51, 0.03) + 0.002], rot: [-0.35, 0, sx * -0.6] }));
  } else if (spec.top === "sweater") {
    const rib = k.cyl(hip * 0.995, hip * 0.995, 0.05, topDark, { at: [0, -0.015, 0], seg: 28 });
    rib.scale.z = D + 0.01;
    body.add(rib);
    body.add(k.torus(S.neck + 0.024, 0.016, topDark, { at: [0, TORSO_H + 0.005, 0], rot: [Math.PI / 2, 0, 0], seg: 20 }));
  } else if (spec.top === "tank") {
    // Bare shoulders: the top stops at the chest, two straps go over them.
    const skinTop: Pt[] = torsoProfile.filter((p) => p[1] >= 0.4).map(([r, y]) => [r + 0.003, y]);
    body.add(k.lathe(skinTop, skin, { seg: 28, scale: [1, 1, D] }));
    body.add(k.torus(chest + 0.004, 0.008, topDark, { at: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0], scale: [1, D, 1], seg: 28 }));
    for (const sx of [-1, 1]) {
      const x = shoulder * 0.52;
      body.add(k.box(0.028, 0.12, 0.012, top, { at: [sx * x, 0.46, surfZ(0.46, x) - 0.012], rot: [0.42, 0, sx * 0.12], r: 0.004 }));
      body.add(k.box(0.028, 0.12, 0.012, top, { at: [sx * x, 0.46, -(surfZ(0.46, x) - 0.012)], rot: [-0.42, 0, sx * -0.12], r: 0.004 }));
    }
  } else if (dress) {
    body.add(k.torus(S.neck + 0.02, 0.01, topDark, { at: [0, TORSO_H - 0.002, 0], rot: [Math.PI / 2, 0, 0], seg: 20 }));
  } else {
    body.add(k.torus(S.neck + 0.022, 0.012, topDark, { at: [0, TORSO_H - 0.002, 0], rot: [Math.PI / 2, 0, 0], seg: 20 }));
  }
  if (spec.extras.includes("backpack")) {
    const pack = k.fabric(spec.shoes);
    const backZ = -surfZ(0.3);
    body.add(k.box(0.25, 0.33, 0.12, pack, { at: [0, TORSO_H / 2 + 0.04, backZ - 0.065], r: 0.035 }));
    body.add(k.box(0.19, 0.12, 0.05, pack, { at: [0, TORSO_H / 2 - 0.08, backZ - 0.14], r: 0.02 }));
    for (const sx of [-1, 1]) body.add(k.box(0.042, 0.3, 0.018, dark, { at: [sx * 0.08, TORSO_H - 0.15, surfZ(0.41, 0.08) - 0.002], r: 0.006 }));
  }
  if (spec.extras.includes("necklace")) {
    const rn = S.neck + 0.03;
    body.add(k.torus(rn, 0.0022, gold, { at: [0, TORSO_H - 0.008, 0.012], rot: [Math.PI / 2 + 0.35, 0, 0], seg: 28 }));
    body.add(k.sphere(0.007, gold, { at: [0, TORSO_H - 0.008 - rn * 0.34, 0.012 + rn * 0.94 + 0.004], seg: 10 }));
  }

  // ── Arms ──
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  const armM = longSleeves ? top : skin;
  const capM = longSleeves || shortSleeves || dress ? top : skin;
  const upperProfile: Pt[] = [[arm, 0.0], [arm * 0.95, 0.1], [arm * 0.84, UPPER]];
  const foreProfile: Pt[] = [[arm * 0.84, 0.0], [arm * 0.9, 0.06], [arm * 0.74, 0.17], [arm * 0.62, FORE]];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sx * (shoulder + 0.004), 0.495, 0);
    sh.add(k.sphere(arm, capM, { scale: [1, 0.9, 0.92], seg: 16 }));
    sh.add(limb(k, upperProfile, armM));
    if (shortSleeves) sh.add(limb(k, [[arm + 0.009, 0.0], [arm + 0.008, 0.08], [arm * 0.95 + 0.007, 0.125]], top));
    if (dress) sh.add(limb(k, [[arm + 0.008, 0.0], [arm + 0.006, 0.04], [arm * 0.97 + 0.004, 0.065]], top));
    if (spec.top === "jersey") sh.add(k.cyl(arm * 0.95 + 0.009, arm * 0.95 + 0.009, 0.02, white, { at: [0, -0.112, 0], seg: 16 }));
    const el = new THREE.Group();
    el.position.set(0, -UPPER, 0);
    el.add(k.sphere(arm * 0.84, armM, { seg: 16 }));
    el.add(limb(k, foreProfile, armM));
    if (spec.top === "sweater" || spec.top === "hoodie" || spec.top === "cardigan") el.add(k.cyl(arm * 0.66, arm * 0.66, 0.04, topDark, { at: [0, -FORE + 0.028, 0], seg: 16 }));
    // A hand: a soft palm, fingers together, a thumb to the inside.
    const hs = S.hand;
    el.add(k.sphere(arm * 0.62, skin, { at: [0, -FORE - 0.002, 0], seg: 12 }));
    el.add(k.box(0.058 * hs, 0.074 * hs, 0.03 * hs, skin, { at: [0, -FORE - 0.04, 0.0], r: 0.013 }));
    el.add(k.box(0.054 * hs, 0.032, 0.027 * hs, skin, { at: [0, -FORE - 0.074, 0.0], r: 0.012 }));
    el.add(k.box(0.016, 0.036, 0.017, skin, { at: [-sx * 0.03 * hs, -FORE - 0.03, 0.01], rot: [0, 0, sx * 0.55], r: 0.007 }));
    sh.add(el);
    body.add(sh);
    shoulders.push(sh);
    elbows.push(el);
  }

  // ── The head: an egg on the neck, ears, a face ──
  const head = new THREE.Group();
  head.position.set(0, TORSO_H + NECK, 0);
  body.add(head);
  const hc = R + 0.01;
  head.add(k.sphere(R, skin, { at: [0, hc, 0], scale: [1, 1.14, 0.98], seg: 30 }));
  // The jaw, narrower than the crown; the girl's softer.
  head.add(k.sphere(R * 0.86, skin, { at: [0, hc - 0.055, 0.012], scale: S.jaw, seg: 22 }));
  for (const sx of [-1, 1]) {
    head.add(k.sphere(0.027, skin, { at: [sx * (R - 0.004), hc - 0.006, -0.008], scale: [0.5, 1, 0.8], seg: 10 }));
    head.add(k.sphere(0.015, k.paint(shade(spec.skin, 0.82), 0.2), { at: [sx * (R + 0.006), hc - 0.006, -0.006], scale: [0.4, 1, 0.7], seg: 8 }));
  }
  const white2 = k.paint("#fbfbfb", 0.3);
  const iris = k.paint(spec.eyes, 0.5);
  const pupil = k.paint("#0d0b0b", 0.6);
  const lid = k.paint(shade(spec.skin, 0.94), 0.2);
  const line = k.paint("#2a1b16", 0.3);
  const browM = k.paint(shade(spec.hairColor, 0.8), 0.25);
  const E = S.eye;
  for (const sx of [-1, 1]) {
    const ex = sx * 0.041;
    const ey = hc + 0.012;
    const ez = R * 0.86;
    head.add(k.sphere(0.021 * E, white2, { at: [ex, ey, ez], scale: [1, 0.82, 0.45], seg: 14 }));
    head.add(k.sphere(0.0125 * E, iris, { at: [ex, ey - 0.001, ez + 0.0085], scale: [1, 1, 0.45], seg: 12 }));
    head.add(k.sphere(0.0066 * E, pupil, { at: [ex, ey - 0.001, ez + 0.0125], scale: [1, 1, 0.6], seg: 10 }));
    head.add(k.sphere(0.0032, white2, { at: [ex + 0.0045, ey + 0.004, ez + 0.0155], seg: 6 }));
    // An upper lid over the eye, the lash line along it, and the brow above.
    head.add(k.sphere(0.0225 * E, lid, { at: [ex, ey + 0.011, ez - 0.005], scale: [1, 0.5, 0.5], seg: 12 }));
    head.add(k.torus(0.0205 * E, S.lashes ? 0.0026 : 0.0014, line, { at: [ex, ey + 0.001, ez + 0.0105], scale: [1, 0.85, 1], arc: Math.PI, seg: 14 }));
    if (S.lashes) for (const [a, dy] of [[0.95, 0.004], [0.6, 0.008]] as [number, number][]) head.add(k.box(0.009, 0.002, 0.002, line, { at: [ex + sx * (0.02 * E + 0.002), ey + dy, ez + 0.012], rot: [0, 0, sx * a] }));
    head.add(k.torus(0.028, S.brow, browM, { at: [ex, ey + 0.028, R * 0.905], rot: [0, sx * 0.28, Math.PI / 2 - (S.browArc * Math.PI) / 2 + sx * 0.06], arc: S.browArc * Math.PI, seg: 14 }));
  }
  // The nose: a bridge and a tip; cheeks with a little colour; the mouth: a smile, and a lower lip.
  const ns = S.lips ? 0.9 : 1;
  head.add(k.sphere(0.011 * ns, skin, { at: [0, hc - 0.004, R * 0.92], scale: [0.6, 1.6, 0.8], seg: 10 }));
  head.add(k.sphere(0.0105 * ns, skin, { at: [0, hc - 0.021, R * 0.99], scale: [0.85, 1, 0.8], seg: 10 }));
  const blush = k.paint(mix(spec.skin, "#e07a7a", 0.2), 0.2);
  for (const sx of [-1, 1]) head.add(k.sphere(0.02, blush, { at: [sx * 0.056, hc - 0.022, R * 0.8], scale: [1, 0.55, 0.3], seg: 10 }));
  const lipTone = k.paint(mix(spec.skin, "#c0505c", S.lips ? 0.55 : 0.35), 0.4);
  const smileArc = Math.PI * 0.75;
  head.add(k.torus(0.023, 0.0036, lipTone, { at: [0, hc - 0.049, R * 0.9], rot: [0, 0, 1.5 * Math.PI - smileArc / 2], scale: [1, 0.7, 1], arc: smileArc, seg: 14 }));
  head.add(k.sphere(0.015, S.lips ? lipTone : k.paint(shade(spec.skin, 0.9), 0.3), { at: [0, hc - 0.057, R * 0.925], scale: [1.25, 0.42, 0.5], seg: 10 }));

  // ── Hair ──
  // The cap of hair is three pieces: the crown, a flat dome whose front ends
  // at a hairline above the brows; the sides, over the ears; and the back,
  // down to the nape. Styles add to it: a fall down the back, tails, a bun.
  const crown = (grow = 0.01, lift = 0, sz = 1) => k.sphere(R + grow, hairM, { at: [0, hc + 0.075 + lift, -0.015], scale: [1.0, 0.62 + lift * 1.5, sz], seg: 26 });
  const sides = () => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) g.add(k.sphere(0.05, hairM, { at: [sx * (R - 0.022), hc + 0.015, -0.03], scale: [0.62, 1.1, 1.0], seg: 14 }));
    return g;
  };
  const back = () => k.sphere(R * 0.75, hairM, { at: [0, hc + 0.01, -R * 0.45], scale: [1.25, 1.1, 0.85], seg: 20 });
  const cap = (grow = 0.01, lift = 0, sz = 1) => k.group([crown(grow, lift, sz), sides(), back()]);
  const bangs = (kind: "full" | "side") => {
    if (kind === "full") return k.sphere(1, hairM, { at: [0, hc + 0.058, R * 0.86], scale: [R * 0.85, 0.02, 0.02], seg: 14 });
    return k.sphere(1, hairM, { at: [0.03, hc + 0.06, R * 0.85], scale: [0.065, 0.02, 0.02], rot: [0, 0, -0.25], seg: 14 });
  };
  /** Hair falling down the back, turned from a profile ([radius, y below the head's centre]). */
  const fall = (profile: Pt[], z = -0.04, sz = 0.72) => k.lathe(profile, hairM, { at: [0, hc, z], scale: [1, 1, sz], seg: 28 });
  /** A tie (a scrunchie in the top's colour) ringing a tail that runs along `dir`. */
  const tie = (at: V3, r: number, dir: V3) => aim(k.torus(r, 0.01, accent, { at, seg: 14 }), dir);
  const tail = (pts: V3[], r: number, end: number) => {
    const g = new THREE.Group();
    g.add(k.tube(pts, r, hairM, { seg: 14 }));
    const last = pts[pts.length - 1];
    g.add(k.sphere(end, hairM, { at: [last[0], last[1] - end * 0.6, last[2]], scale: [1, 1.5, 1], seg: 12 }));
    return g;
  };
  const sideLocks = (wavy: boolean) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      if (wavy) {
        for (let i = 0; i < 3; i += 1) g.add(k.sphere(1, hairM, { at: [sx * (R + 0.004 + (i % 2) * 0.012), hc - 0.1 - i * 0.1, -0.005 + i * 0.008], scale: [0.042, 0.085, 0.062], seg: 12 }));
      } else {
        g.add(k.sphere(1, hairM, { at: [sx * (R + 0.006), hc - 0.12, -0.012], scale: [0.04, 0.2, 0.06], seg: 14 }));
        g.add(k.sphere(1, hairM, { at: [sx * (R + 0.014), hc - 0.3, 0.0], scale: [0.036, 0.14, 0.055], seg: 12 }));
      }
    }
    return g;
  };
  switch (spec.hair) {
    case "short":
      head.add(cap(0.012, 0.008), bangs("side"));
      for (let i = 0; i < 10; i += 1) {
        const a = i * 2.39996 + 0.6;
        const t = 0.25 + (i % 4) * 0.14;
        const r = R + 0.02;
        head.add(k.sphere(0.03, hairM, { at: [Math.cos(a) * r * Math.sin(t), hc + 0.075 + r * Math.cos(t) * 0.62, Math.sin(a) * r * Math.sin(t) - 0.015], scale: [1, 0.55, 1], seg: 10 }));
      }
      break;
    case "buzz":
      head.add(crown(0.003, -0.004), k.sphere(R * 0.75, hairM, { at: [0, hc + 0.01, -R * 0.45], scale: [1.2, 1.05, 0.8], seg: 20 }));
      break;
    case "curly":
      head.add(cap(0.012, 0.01));
      for (let i = 0; i < 30; i += 1) {
        const a = i * 2.39996;
        const t = 0.15 + (i % 7) * 0.15;
        const r = R + 0.03;
        head.add(k.sphere(0.034, hairM, { at: [Math.cos(a) * r * Math.sin(t), hc + 0.02 + r * Math.cos(t) * 0.95, Math.sin(a) * r * Math.sin(t) - 0.02], seg: 10 }));
      }
      break;
    case "afro": {
      head.add(k.sphere(R + 0.062, hairM, { at: [0, hc + 0.045, -0.02], scale: [1.06, 1.0, 1.0], seg: 28 }));
      for (let i = 0; i < 20; i += 1) {
        const a = i * 2.39996;
        const t = 0.1 + (i % 5) * 0.32;
        const r = R + 0.062;
        head.add(k.sphere(0.048, hairM, { at: [Math.cos(a) * r * 1.06 * Math.sin(t), hc + 0.045 + r * Math.cos(t), Math.sin(a) * r * Math.sin(t) - 0.02], seg: 10 }));
      }
      break;
    }
    case "long":
      head.add(cap(0.012, 0.006, 0.9), bangs("full"), fall([[0.07, -0.38], [0.105, -0.33], [0.125, -0.22], [0.128, -0.1], [0.122, 0.0], [0.118, 0.075], [0.09, 0.115], [0.0001, 0.13]]), sideLocks(false));
      break;
    case "wavy":
      head.add(cap(0.014, 0.01, 0.9), bangs("side"), fall([[0.085, -0.4], [0.12, -0.36], [0.1, -0.3], [0.13, -0.24], [0.11, -0.17], [0.135, -0.1], [0.122, -0.02], [0.12, 0.075], [0.09, 0.118], [0.0001, 0.135]]), sideLocks(true));
      break;
    case "bob":
      head.add(cap(0.014, 0.008), bangs("full"));
      for (const sx of [-1, 1]) head.add(k.sphere(1, hairM, { at: [sx * (R + 0.004), hc - 0.07, -0.03], scale: [0.046, 0.13, 0.082], seg: 14 }));
      head.add(k.sphere(1, hairM, { at: [0, hc - 0.06, -R * 0.62], scale: [0.115, 0.15, 0.07], seg: 16 }));
      break;
    case "ponytail":
      head.add(cap(0.01, 0.004), bangs("side"));
      head.add(tail([[0, hc + 0.06, -R - 0.01], [0, hc + 0.02, -R - 0.07], [0, hc - 0.12, -R - 0.075], [0, hc - 0.26, -R - 0.05]], 0.028, 0.034));
      head.add(tie([0, hc + 0.05, -R - 0.025], 0.03, [0, -0.6, -1]));
      break;
    case "bun":
      head.add(cap(0.01, 0.004), bangs("side"));
      head.add(k.sphere(0.056, hairM, { at: [0, hc + 0.11, -0.07], seg: 16 }));
      head.add(k.torus(0.046, 0.011, hairM, { at: [0, hc + 0.11, -0.07], rot: [0.9, 0, 0], seg: 18 }));
      break;
    case "braids": {
      head.add(cap(0.012, 0.006), bangs("full"));
      for (const sx of [-1, 1]) {
        const pts: V3[] = [[sx * (R - 0.015), hc, -0.01], [sx * (R + 0.012), hc - 0.12, 0.05], [sx * (R + 0.01), hc - 0.26, 0.085], [sx * R * 0.95, hc - 0.4, 0.1]];
        head.add(k.tube(pts, 0.024, hairM, { seg: 16 }));
        for (let i = 0; i < 6; i += 1) {
          const p = along(pts, 0.2 + i * 0.14);
          head.add(k.sphere(0.028, hairM, { at: [p[0] + sx * (i % 2 ? 0.006 : -0.006), p[1], p[2] + (i % 2 ? 0.006 : -0.006)], scale: [1, 1.15, 1], seg: 10 }));
        }
        head.add(tie([sx * R * 0.95, hc - 0.4, 0.1], 0.02, [0, -1, 0]));
      }
      break;
    }
    case "pigtails":
      head.add(cap(0.012, 0.006), bangs("full"));
      for (const sx of [-1, 1]) {
        head.add(tail([[sx * R, hc + 0.035, -0.03], [sx * (R + 0.05), hc - 0.04, -0.03], [sx * (R + 0.06), hc - 0.2, -0.02]], 0.03, 0.036));
        head.add(tie([sx * (R + 0.026), hc + 0.008, -0.03], 0.032, [sx, -0.7, 0]));
      }
      break;
    case "puffs":
      head.add(cap(0.01, 0.004), bangs("side"));
      for (const sx of [-1, 1]) {
        head.add(k.sphere(0.052, hairM, { at: [sx * R * 0.72, hc + 0.105, -0.035], seg: 16 }));
        head.add(tie([sx * R * 0.58, hc + 0.072, -0.035], 0.026, [sx * 0.7, 0.7, 0]));
      }
      break;
    default:
      break;
  }

  // Extras on the head.
  if (spec.extras.includes("bow")) {
    const bowM = k.fabric(spec.topColor);
    const at: V3 = [0.096, hc + 0.088, -0.035];
    head.add(k.sphere(0.014, bowM, { at, seg: 10 }));
    for (const s of [-1, 1]) head.add(k.sphere(1, bowM, { at: [at[0] + s * 0.012, at[1] + 0.006 + s * 0.004, at[2] + s * 0.036], scale: [0.016, 0.022, 0.036], rot: [s * 0.35, 0, 0], seg: 12 }));
  }
  if (spec.extras.includes("cap")) {
    const capM = k.fabric(spec.topColor);
    head.add(k.lathe([[R + 0.02, 0], [R + 0.021, 0.02], [R + 0.012, 0.055], [0.06, 0.08], [0.0001, 0.088]], capM, { at: [0, hc + 0.042, -0.004], seg: 24 }));
    head.add(k.box(0.14, 0.016, 0.1, capM, { at: [0, hc + 0.05, R + 0.03], rot: [0.15, 0, 0], r: 0.008 }));
    head.add(k.sphere(0.011, k.fabric(shade(spec.topColor, 0.7)), { at: [0, hc + 0.132, -0.004], seg: 8 }));
  }
  if (spec.extras.includes("beanie")) {
    const knit = k.fabric(spec.topColor, { repeat: [6, 6] });
    head.add(k.lathe([[R + 0.016, 0], [R + 0.02, 0.025], [R + 0.012, 0.065], [0.07, 0.098], [0.0001, 0.11]], knit, { at: [0, hc + 0.052, -0.004], seg: 24 }));
    head.add(k.torus(R + 0.018, 0.013, k.fabric(shade(spec.topColor, 0.8), { repeat: [6, 6] }), { at: [0, hc + 0.056, -0.004], rot: [Math.PI / 2, 0, 0], seg: 24 }));
    head.add(k.sphere(0.028, white, { at: [0, hc + 0.176, -0.004], seg: 12 }));
  }
  if (spec.extras.includes("glasses")) {
    const frame = k.metal("black", 0.35);
    const lens = k.glass("#cfe3ec", 0.22);
    for (const sx of [-1, 1]) {
      head.add(k.torus(0.027, 0.0032, frame, { at: [sx * 0.041, hc + 0.012, R * 0.86 + 0.018], seg: 18 }));
      head.add(k.disc(0.025, lens, { at: [sx * 0.041, hc + 0.012, R * 0.86 + 0.018], seg: 18 }));
      head.add(k.box(0.006, 0.006, 0.14, frame, { at: [sx * (R - 0.002), hc + 0.016, R * 0.86 - 0.055] }));
    }
    head.add(k.box(0.026, 0.005, 0.005, frame, { at: [0, hc + 0.017, R * 0.86 + 0.018] }));
  }
  if (spec.extras.includes("headphones")) {
    const band = k.plastic("#1b1d21", 0.4);
    head.add(k.torus(R + 0.03, 0.01, band, { at: [0, hc, 0], arc: Math.PI, seg: 20 }));
    for (const sx of [-1, 1]) {
      head.add(k.cyl(0.042, 0.042, 0.032, band, { at: [sx * (R + 0.018), hc, 0], rot: [0, 0, Math.PI / 2], seg: 16 }));
      head.add(k.cyl(0.027, 0.027, 0.01, accent, { at: [sx * (R + 0.036), hc, 0], rot: [0, 0, Math.PI / 2], seg: 16 }));
    }
  }
  if (spec.extras.includes("earrings")) {
    for (const sx of [-1, 1]) {
      head.add(k.sphere(0.004, gold, { at: [sx * (R + 0.004), hc - 0.028, -0.006], seg: 8 }));
      head.add(k.torus(0.009, 0.0016, gold, { at: [sx * (R + 0.004), hc - 0.04, -0.006], rot: [0, Math.PI / 2, 0], seg: 14 }));
    }
  }

  root.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  const scale = HEIGHT_SCALE[spec.height] * S.scale;
  root.scale.setScalar(scale);
  const figure: Figure = {
    root,
    body,
    head,
    shoulders: [shoulders[0], shoulders[1]],
    elbows: [elbows[0], elbows[1]],
    hips: [hips[0], hips[1]],
    knees: [knees[0], knees[1]],
    height: (HIP_Y + TORSO_H + NECK + hc + R * 1.14) * scale,
  };
  poseFigure(figure, "stand");
  return figure;
}

export type Pose = "stand" | "walk" | "wave";

/**
 * Puts the figure in a pose. `phase` is where a walk is in its stride (0 to
 * 1, one full stride); `t` is time, for the small life in a standing pose.
 */
export function poseFigure(f: Figure, pose: Pose, phase = 0, t = 0): void {
  const [shL, shR] = f.shoulders;
  const [elL, elR] = f.elbows;
  const [hipL, hipR] = f.hips;
  const [kneeL, kneeR] = f.knees;
  for (const j of [shL, shR, elL, elR, hipL, hipR, kneeL, kneeR, f.head]) j.rotation.set(0, 0, 0);
  f.body.position.y = HIP_Y;
  f.body.rotation.set(0, 0, 0);
  if (pose === "walk") {
    const swing = Math.sin(phase * Math.PI * 2);
    // Legs swing from the hips (forward is a turn towards -x), knees bend as a leg comes through.
    hipL.rotation.x = -0.5 * swing;
    hipR.rotation.x = 0.5 * swing;
    kneeL.rotation.x = 0.75 * Math.max(0, -swing);
    kneeR.rotation.x = 0.75 * Math.max(0, swing);
    // Arms swing against the legs, a little bent.
    shL.rotation.x = 0.42 * swing;
    shR.rotation.x = -0.42 * swing;
    shL.rotation.z = 0.12;
    shR.rotation.z = -0.12;
    elL.rotation.x = -0.4;
    elR.rotation.x = -0.4;
    f.body.position.y = HIP_Y + 0.02 * Math.abs(Math.sin(phase * Math.PI * 2));
    f.body.rotation.y = -0.07 * swing;
    f.body.rotation.x = 0.04;
    return;
  }
  // At ease: arms a little away from the body and bent, the hands turned in.
  shL.rotation.z = 0.14;
  shR.rotation.z = -0.14;
  shL.rotation.x = 0.04;
  shR.rotation.x = 0.04;
  elL.rotation.x = -0.22;
  elR.rotation.x = -0.22;
  elL.rotation.z = 0.1;
  elR.rotation.z = -0.1;
  if (pose === "wave") {
    // The right arm up, the hand turned out, and a nod.
    shR.rotation.z = -2.5;
    shR.rotation.x = 0.2;
    elR.rotation.z = -0.5;
    elR.rotation.x = 0;
    f.head.rotation.z = 0.08;
    return;
  }
  // Standing: a slow breath.
  f.body.position.y = HIP_Y + 0.006 * Math.sin(t * 1.6);
}
