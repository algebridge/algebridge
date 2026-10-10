/**
 * A student's character in 3D, built from their spec (lib/avatar.ts) with
 * the same kit as the furniture, so it stands in the same light as the
 * house. About 1.7 m tall, standing on the floor at the origin, facing +z.
 * Its joints are groups, so it can be posed: standing, walking, waving.
 *
 * The body is turned (lathes) rather than boxed: a chest that narrows to the
 * waist, shoulders, calves and forearms that taper, a neck, hands with
 * thumbs, shoes with laces. Friendly, but built like a person.
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
const HEAD_R = 0.108;
const UPPER = 0.27;
const FORE = 0.235;

const HEIGHT_SCALE: Record<AvatarSpec["height"], number> = { short: 0.92, medium: 1, tall: 1.08 };
const BUILD_SCALE: Record<AvatarSpec["build"], number> = { slim: 0.9, medium: 1, broad: 1.14 };

/** A hex colour made lighter (f > 1) or darker (f < 1). */
function shade(hex: string, f: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;
}

type Pt = [number, number];

/**
 * A limb hanging from its joint at the origin, turned from a profile of
 * [radius, distance down the limb] pairs: a thigh that narrows to the knee, a
 * calf with its muscle, a forearm to the wrist.
 */
function limb(k: Kit, profile: Pt[], m: THREE.Material): THREE.Mesh {
  // From the bottom up, as the kit's lathe wants it.
  const pts: Pt[] = [...profile].sort((a, b) => b[1] - a[1]).map(([r, d]) => [r, -d]);
  return k.lathe(pts, m, { seg: 16 });
}

export function buildFigure(k: Kit, spec: AvatarSpec): Figure {
  const skin = k.paint(spec.skin, 0.22);
  const hairM = k.paint(spec.hairColor, 0.32);
  const top = k.fabric(spec.topColor);
  const topDark = k.fabric(shade(spec.topColor, 0.78));
  const bottom = k.fabric(spec.bottomColor);
  const shoe = k.plastic(spec.shoes, 0.4);
  const sole = k.plastic("#f3f0ea", 0.3);
  const lace = k.plastic("#f8f6f1", 0.3);
  const dark = k.plastic("#1b1d21", 0.5);
  const white = k.fabric("#f4f1ea");
  const longSleeves = spec.top === "hoodie" || spec.top === "jacket" || spec.top === "sweater";
  const b = BUILD_SCALE[spec.build];
  const skirt = spec.bottom === "skirt";
  const shorts = spec.bottom === "shorts";

  const root = new THREE.Group();
  root.name = "figure";

  // ── Legs, from the hips at the root ──
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const thighM = skirt ? skin : bottom;
  const shinM = shorts || skirt ? skin : bottom;
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.095 * b, HIP_Y, 0);
    hip.add(k.sphere(0.078 * b, thighM, { at: [0, -0.02, 0], scale: [1, 0.9, 1], seg: 14 }));
    hip.add(limb(k, [[0.078 * b, 0.02], [0.074 * b, 0.14], [0.064 * b, 0.3], [0.056, THIGH]], thighM));
    if (shorts) hip.add(k.cyl(0.07 * b, 0.07 * b, 0.035, bottom, { at: [0, -THIGH + 0.02, 0], seg: 16 }));
    if (spec.bottom === "joggers") hip.add(k.box(0.012, THIGH - 0.06, 0.02, white, { at: [sx * 0.062 * b, -THIGH / 2, 0.004] }));
    const knee = new THREE.Group();
    knee.position.set(0, -THIGH, 0);
    knee.add(k.sphere(0.056, shinM, { seg: 14 }));
    knee.add(limb(k, [[0.055, 0.0], [0.06, 0.1], [0.05, 0.24], [0.038, SHIN - 0.03], [0.04, SHIN]], shinM));
    if (spec.bottom === "joggers") knee.add(k.cyl(0.046, 0.046, 0.05, topDark === bottom ? bottom : k.fabric(shade(spec.bottomColor, 0.75)), { at: [0, -SHIN + 0.035, 0], seg: 14 }));
    // The shoe: a rounded upper, a toe cap, a pale sole, laces across the top.
    const fy = -SHIN - 0.03;
    knee.add(k.box(0.1, 0.075, 0.2, shoe, { at: [0, fy - 0.005, 0.02], r: 0.03 }));
    knee.add(k.sphere(0.052, shoe, { at: [0, fy - 0.015, 0.11], scale: [1, 0.72, 1.05], seg: 14 }));
    knee.add(k.box(0.106, 0.024, 0.27, sole, { at: [0, fy - 0.04, 0.045], r: 0.012 }));
    for (let i = 0; i < 3; i += 1) knee.add(k.box(0.05, 0.006, 0.012, lace, { at: [0, fy + 0.032 - i * 0.004, 0.035 + i * 0.03], rot: [0.35, 0, 0] }));
    hip.add(knee);
    root.add(hip);
    hips.push(hip);
    knees.push(knee);
  }

  // ── The body: a turned torso, wider at the chest and shoulders, scaled flatter front to back ──
  const body = new THREE.Group();
  body.position.set(0, HIP_Y, 0);
  root.add(body);
  const W = 0.19 * b;
  const torsoProfile: Pt[] = [[W * 0.9, -0.06], [W * 0.95, 0.0], [W * 0.86, 0.11], [W * 0.88, 0.24], [W * 0.98, 0.36], [W * 1.05, 0.46], [W * 0.95, 0.52], [W * 0.4, TORSO_H]];
  const torso = k.lathe(torsoProfile, top, { seg: 24 });
  torso.scale.z = 0.62;
  body.add(torso);
  // The seat and the waistband.
  const seat = k.lathe([[W * 0.78, -0.16], [W * 0.95, -0.08], [W * 0.95, 0.0]], skirt ? bottom : bottom, { seg: 24 });
  seat.scale.z = 0.66;
  body.add(seat);
  body.add(k.cyl(W * 0.96, W * 0.96, 0.045, bottom, { at: [0, 0.0, 0], scale: [1, 1, 0.66], seg: 24 }));
  if (skirt) {
    const sk = k.lathe([[W * 1.5, -0.34], [W * 1.2, -0.2], [W * 0.98, -0.05], [W * 0.96, 0.02]], bottom, { seg: 28 });
    sk.scale.z = 0.8;
    body.add(sk);
  }
  // Shoulders, and the neck.
  for (const sx of [-1, 1]) body.add(k.sphere(0.058 * b, top, { at: [sx * (W * 0.98), TORSO_H - 0.06, 0], scale: [1.1, 0.85, 0.9], seg: 14 }));
  body.add(k.cyl(0.045, 0.052, NECK + 0.03, skin, { at: [0, TORSO_H + NECK / 2 - 0.01, 0], seg: 14 }));

  // What the top is.
  if (spec.top === "hoodie") {
    body.add(k.sphere(0.11, top, { at: [0, TORSO_H - 0.01, -0.085], scale: [1.05, 0.62, 0.82], seg: 16 }));
    body.add(k.box(W * 1.25, 0.12, 0.02, topDark, { at: [0, 0.13, W * 0.62 + 0.004], r: 0.014 }));
    for (const sx of [-1, 1]) body.add(k.cyl(0.005, 0.005, 0.15, white, { at: [sx * 0.03, TORSO_H - 0.12, W * 0.62 + 0.012], seg: 6 }));
  } else if (spec.top === "jacket") {
    body.add(k.box(W * 0.9, TORSO_H - 0.12, 0.02, white, { at: [0, TORSO_H / 2 - 0.01, W * 0.62 - 0.002], r: 0.01 }));
    for (const sx of [-1, 1]) body.add(k.box(0.07, 0.17, 0.016, topDark, { at: [sx * 0.065, TORSO_H - 0.1, W * 0.62 + 0.006], rot: [0, 0, sx * 0.5], r: 0.004 }));
    body.add(k.box(0.02, TORSO_H - 0.2, 0.012, topDark, { at: [0, TORSO_H / 2 - 0.06, W * 0.62 + 0.012] }));
  } else if (spec.top === "jersey") {
    for (const y of [TORSO_H * 0.64, TORSO_H * 0.52]) {
      const stripe = k.cyl(W * 1.01, W * 1.01, 0.032, white, { at: [0, y, 0], seg: 24 });
      stripe.scale.z = 0.63;
      body.add(stripe);
    }
    for (const sx of [-1, 1]) body.add(k.box(0.06, 0.09, 0.012, white, { at: [sx * 0.04, TORSO_H - 0.03, W * 0.62 + 0.004], rot: [0, 0, sx * -0.6] }));
  } else if (spec.top === "sweater") {
    const rib = k.cyl(W * 0.98, W * 0.98, 0.05, topDark, { at: [0, -0.03, 0], seg: 24 });
    rib.scale.z = 0.66;
    body.add(rib);
    body.add(k.torus(0.07, 0.016, topDark, { at: [0, TORSO_H + 0.01, 0], rot: [Math.PI / 2, 0, 0], seg: 16 }));
  } else {
    body.add(k.torus(0.066, 0.011, topDark, { at: [0, TORSO_H + 0.005, 0], rot: [Math.PI / 2, 0, 0], seg: 16 }));
  }
  if (spec.extras.includes("backpack")) {
    const pack = k.fabric(spec.shoes);
    body.add(k.box(0.26, 0.34, 0.12, pack, { at: [0, TORSO_H / 2 + 0.04, -W * 0.62 - 0.07], r: 0.035 }));
    body.add(k.box(0.2, 0.12, 0.05, pack, { at: [0, TORSO_H / 2 - 0.08, -W * 0.62 - 0.145], r: 0.02 }));
    for (const sx of [-1, 1]) body.add(k.box(0.045, 0.3, 0.02, dark, { at: [sx * 0.085, TORSO_H - 0.14, W * 0.62 - 0.01], r: 0.006 }));
  }

  // ── Arms ──
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  const armM = longSleeves ? top : skin;
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sx * (W * 1.04 + 0.03), TORSO_H - 0.07, 0);
    sh.add(k.sphere(0.05, armM, { seg: 14 }));
    sh.add(limb(k, [[0.05, 0.0], [0.047, 0.12], [0.04, UPPER]], armM));
    if (!longSleeves) sh.add(limb(k, [[0.056, 0.0], [0.054, 0.09], [0.052, 0.13]], top));
    if (spec.top === "jersey") sh.add(k.cyl(0.054, 0.053, 0.022, white, { at: [0, -0.11, 0], seg: 14 }));
    const el = new THREE.Group();
    el.position.set(0, -UPPER, 0);
    el.add(k.sphere(0.041, armM, { seg: 14 }));
    el.add(limb(k, [[0.04, 0.0], [0.043, 0.07], [0.035, 0.18], [0.03, FORE]], armM));
    if (spec.top === "sweater" || spec.top === "hoodie") el.add(k.cyl(0.036, 0.036, 0.04, topDark, { at: [0, -FORE + 0.03, 0], seg: 14 }));
    // A hand: the palm, and a thumb to the inside.
    el.add(k.sphere(0.042, skin, { at: [0, -FORE - 0.035, 0], scale: [0.78, 1.25, 0.5], seg: 14 }));
    el.add(k.sphere(0.016, skin, { at: [-sx * 0.028, -FORE - 0.02, 0.012], scale: [1, 1.6, 1], seg: 10 }));
    sh.add(el);
    body.add(sh);
    shoulders.push(sh);
    elbows.push(el);
  }

  // ── The head: an egg on the neck, ears, a face ──
  const head = new THREE.Group();
  head.position.set(0, TORSO_H + NECK, 0);
  body.add(head);
  const hc = HEAD_R + 0.01;
  head.add(k.sphere(HEAD_R, skin, { at: [0, hc, 0], scale: [1, 1.16, 0.98], seg: 28 }));
  // The jaw, a little narrower than the crown.
  head.add(k.sphere(HEAD_R * 0.86, skin, { at: [0, hc - 0.055, 0.012], scale: [1, 0.8, 0.95], seg: 20 }));
  for (const sx of [-1, 1]) {
    head.add(k.sphere(0.028, skin, { at: [sx * (HEAD_R - 0.004), hc - 0.005, -0.008], scale: [0.5, 1, 0.8], seg: 10 }));
    head.add(k.sphere(0.016, k.paint(shade(spec.skin, 0.82), 0.2), { at: [sx * (HEAD_R + 0.006), hc - 0.005, -0.006], scale: [0.4, 1, 0.7], seg: 8 }));
  }
  const white2 = k.paint("#fbfbfb", 0.3);
  const iris = k.paint(spec.eyes, 0.5);
  const pupil = k.paint("#0d0b0b", 0.6);
  const lid = k.paint(shade(spec.skin, 0.94), 0.2);
  for (const sx of [-1, 1]) {
    const ex = sx * 0.04;
    const ey = hc + 0.012;
    const ez = HEAD_R * 0.86;
    head.add(k.sphere(0.021, white2, { at: [ex, ey, ez], scale: [1, 0.85, 0.5], seg: 12 }));
    head.add(k.sphere(0.0125, iris, { at: [ex, ey, ez + 0.009], scale: [1, 1, 0.5], seg: 10 }));
    head.add(k.sphere(0.0065, pupil, { at: [ex, ey, ez + 0.014], seg: 8 }));
    head.add(k.sphere(0.003, white2, { at: [ex + 0.004, ey + 0.005, ez + 0.017], seg: 6 }));
    // An upper lid over the eye, and the brow above.
    head.add(k.sphere(0.023, lid, { at: [ex, ey + 0.012, ez - 0.004], scale: [1, 0.5, 0.5], seg: 10 }));
    head.add(k.box(0.046, 0.009, 0.012, hairM, { at: [ex, ey + 0.036, HEAD_R * 0.9], rot: [0, 0, sx * 0.15], r: 0.004 }));
  }
  // The nose: a bridge and a tip; the mouth: a smile, and a lower lip.
  head.add(k.box(0.016, 0.04, 0.02, skin, { at: [0, hc - 0.005, HEAD_R * 0.95], rot: [0.35, 0, 0], r: 0.006 }));
  head.add(k.sphere(0.012, skin, { at: [0, hc - 0.022, HEAD_R * 1.0], seg: 10 }));
  const arc = Math.PI * 0.8;
  head.add(k.torus(0.026, 0.0045, k.paint("#8a4040", 0.45), { at: [0, hc - 0.048, HEAD_R * 0.9], rot: [0, 0, 1.5 * Math.PI - arc / 2], arc, seg: 12 }));
  head.add(k.sphere(0.02, k.paint(shade(spec.skin, 0.88), 0.3), { at: [0, hc - 0.058, HEAD_R * 0.9], scale: [1, 0.3, 0.4], seg: 10 }));

  // Hair, with some volume at the back and a hairline at the front.
  const cap = () => k.sphere(HEAD_R + 0.014, hairM, { at: [0, hc + 0.036, -0.018], scale: [1.02, 0.84, 1.04], seg: 22 });
  const fringe = () => {
    const g = new THREE.Group();
    for (const [x, w] of [[-0.05, 0.06], [0.0, 0.065], [0.05, 0.06]] as [number, number][]) g.add(k.sphere(w * 0.6, hairM, { at: [x, hc + 0.085, HEAD_R * 0.74], scale: [1, 0.55, 0.7], seg: 10 }));
    return g;
  };
  const temples = () => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) g.add(k.sphere(0.03, hairM, { at: [sx * (HEAD_R - 0.01), hc + 0.03, -0.01], scale: [0.7, 1.2, 1], seg: 10 }));
    return g;
  };
  switch (spec.hair) {
    case "short":
      head.add(cap(), fringe(), temples());
      break;
    case "buzz":
      head.add(k.sphere(HEAD_R + 0.004, hairM, { at: [0, hc + 0.04, -0.012], scale: [1, 0.82, 1], seg: 22 }));
      break;
    case "curly":
      head.add(cap(), temples());
      for (let i = 0; i < 18; i += 1) {
        const a = i * 2.39996;
        const t = 0.2 + (i % 6) * 0.13;
        const r = HEAD_R + 0.022;
        head.add(k.sphere(0.038, hairM, { at: [Math.cos(a) * r * Math.sin(t), hc + r * Math.cos(t) + 0.02, Math.sin(a) * r * Math.sin(t) - 0.012], seg: 10 }));
      }
      break;
    case "long":
      // A cap, then the hair falling in soft lengths down the sides and the back, past the shoulders.
      head.add(cap(), fringe());
      for (const sx of [-1, 1]) {
        head.add(k.sphere(1, hairM, { at: [sx * (HEAD_R + 0.012), hc - 0.12, -0.02], scale: [0.045, 0.26, 0.07], seg: 14 }));
        head.add(k.sphere(1, hairM, { at: [sx * (HEAD_R + 0.02), hc - 0.3, -0.03], scale: [0.04, 0.14, 0.065], seg: 12 }));
      }
      head.add(k.sphere(1, hairM, { at: [0, hc - 0.1, -HEAD_R - 0.01], scale: [0.11, 0.3, 0.055], seg: 16 }));
      head.add(k.sphere(1, hairM, { at: [0, hc - 0.32, -HEAD_R - 0.02], scale: [0.12, 0.13, 0.05], seg: 14 }));
      break;
    case "ponytail":
      head.add(cap(), fringe(), temples());
      head.add(k.sphere(1, hairM, { at: [0, hc - 0.07, -HEAD_R - 0.05], scale: [0.04, 0.2, 0.045], seg: 12 }));
      head.add(k.torus(0.036, 0.011, k.plastic(spec.topColor, 0.5), { at: [0, hc + 0.07, -HEAD_R - 0.012], rot: [Math.PI / 2, 0, 0], seg: 12 }));
      break;
    case "bun":
      head.add(cap(), fringe(), temples());
      head.add(k.sphere(0.06, hairM, { at: [0, hc + 0.15, -0.065], seg: 14 }));
      break;
    case "braids":
      head.add(cap(), fringe());
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 6; i += 1) head.add(k.sphere(0.03, hairM, { at: [sx * (HEAD_R - 0.008), hc - 0.05 - i * 0.06, HEAD_R * 0.45 + i * 0.012], scale: [1, 1.1, 1], seg: 10 }));
        head.add(k.sphere(0.018, k.plastic(spec.topColor, 0.5), { at: [sx * (HEAD_R - 0.008), hc - 0.4, HEAD_R * 0.52], seg: 8 }));
      }
      break;
    default:
      break;
  }

  // Extras on the head.
  if (spec.extras.includes("cap")) {
    const capM = k.fabric(spec.topColor);
    head.add(k.sphere(HEAD_R + 0.024, capM, { at: [0, hc + 0.05, -0.006], scale: [1, 0.72, 1], seg: 22 }));
    head.add(k.box(0.14, 0.018, 0.1, capM, { at: [0, hc + 0.072, HEAD_R + 0.028], r: 0.01 }));
    head.add(k.sphere(0.011, k.fabric(shade(spec.topColor, 0.7)), { at: [0, hc + HEAD_R + 0.038, -0.006], seg: 8 }));
  }
  if (spec.extras.includes("glasses")) {
    const frame = k.metal("black", 0.35);
    const lens = k.glass("#cfe3ec", 0.22);
    for (const sx of [-1, 1]) {
      head.add(k.torus(0.027, 0.0035, frame, { at: [sx * 0.04, hc + 0.012, HEAD_R * 0.86 + 0.018], seg: 16 }));
      head.add(k.disc(0.025, lens, { at: [sx * 0.04, hc + 0.012, HEAD_R * 0.86 + 0.018], seg: 16 }));
      head.add(k.box(0.007, 0.007, 0.14, frame, { at: [sx * (HEAD_R - 0.002), hc + 0.016, HEAD_R * 0.86 - 0.055] }));
    }
    head.add(k.box(0.026, 0.005, 0.005, frame, { at: [0, hc + 0.017, HEAD_R * 0.86 + 0.018] }));
  }
  if (spec.extras.includes("headphones")) {
    const band = k.plastic("#1b1d21", 0.4);
    head.add(k.torus(HEAD_R + 0.03, 0.01, band, { at: [0, hc, 0], arc: Math.PI, seg: 20 }));
    for (const sx of [-1, 1]) {
      head.add(k.cyl(0.042, 0.042, 0.032, band, { at: [sx * (HEAD_R + 0.018), hc, 0], rot: [0, 0, Math.PI / 2], seg: 16 }));
      head.add(k.cyl(0.027, 0.027, 0.01, k.plastic(spec.topColor, 0.5), { at: [sx * (HEAD_R + 0.036), hc, 0], rot: [0, 0, Math.PI / 2], seg: 16 }));
    }
  }

  root.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  root.scale.setScalar(HEIGHT_SCALE[spec.height]);
  const figure: Figure = {
    root,
    body,
    head,
    shoulders: [shoulders[0], shoulders[1]],
    elbows: [elbows[0], elbows[1]],
    hips: [hips[0], hips[1]],
    knees: [knees[0], knees[1]],
    height: (HIP_Y + TORSO_H + NECK + HEAD_R * 2.16) * HEIGHT_SCALE[spec.height],
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
    shL.rotation.z = 0.06;
    shR.rotation.z = -0.06;
    elL.rotation.x = -0.4;
    elR.rotation.x = -0.4;
    f.body.position.y = HIP_Y + 0.02 * Math.abs(Math.sin(phase * Math.PI * 2));
    f.body.rotation.y = -0.07 * swing;
    f.body.rotation.x = 0.04;
    return;
  }
  shL.rotation.z = 0.05;
  shR.rotation.z = -0.05;
  elL.rotation.x = -0.16;
  elR.rotation.x = -0.16;
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
