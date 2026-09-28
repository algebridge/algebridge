"use client";

import { useId, type ReactNode } from "react";

/**
 * The parts every drawn person shares: Veronica, Shaurya, Jo, Jordyn and
 * Rayla are all built from these. One figure is 100 wide and 160 tall, feet
 * at the bottom, facing a little to the right; light comes from the upper
 * left. The head is about a sixth of the height, the way a teenager's is.
 *
 * Faces are the simple ones the House has always had: two tones of skin, dot
 * eyes with a catch of light, a stroke for each brow, a stroke for the nose,
 * a smile. Ivan asked for exactly these after seeing a more detailed face,
 * so keep them. Limbs carry a soft gradient for a little form.
 *
 * Joints are fixed so the CSS that animates a walk, a kick or a glide works
 * for everyone: shoulders at (37.5, 55) and (62.5, 55), hips at (53, 100)
 * and (47, 100). Each limb is a group rotated about its joint.
 */

export interface Look {
  skin: string;
  skinShade: string;
  skinLight: string;
  hair: string;
  hairLight: string;
  iris: string;
  lip: string;
  lipLight: string;
}

export const JOINT = {
  shoulderY: 55,
  backArmX: 37.5,
  frontArmX: 62.5,
  hipY: 100,
  backLegX: 53,
  frontLegX: 47,
  ankleY: 143,
} as const;

/** A id for this drawing's gradients, so two people on one page never share one. */
export function useArtId(): string {
  return useId().replace(/[^a-zA-Z0-9]/g, "");
}

/** The gradients a figure's skin uses: a soft light on the face, a roll across each limb. */
export function SkinDefs({ id, look }: { id: string; look: Look }) {
  return (
    <defs>
      <linearGradient id={`${id}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={look.skinLight} />
        <stop offset="0.38" stopColor={look.skin} />
        <stop offset="1" stopColor={look.skinShade} />
      </linearGradient>
    </defs>
  );
}

export const limbFill = (id: string) => `url(#${id}-limb)`;

/* ── Head and face ─────────────────────────────────────────────── */

const FACE_SHAPES = {
  /** A rounder, fuller face. */
  round: "M50 11.6 C58.6 11.6 63.6 18.2 63.4 25.8 C63.2 32.8 58.8 39 50 39.5 C41.2 39 36.8 32.8 36.6 25.8 C36.4 18.2 41.4 11.6 50 11.6Z",
  /** Longer, with a little more chin. */
  oval: "M50 11.4 C57.8 11.4 62.6 17.4 62.6 25.2 C62.6 31.8 58.4 38.8 50 39.4 C41.6 38.8 37.4 31.8 37.4 25.2 C37.4 17.4 42.2 11.4 50 11.4Z",
  /** A squarer jaw. */
  square: "M50 11.4 C57.6 11.4 62.4 17 62.4 24.6 C62.6 31.2 60.4 37.6 52 39.3 L48 39.3 C39.6 37.6 37.4 31.2 37.6 24.6 C37.6 17 42.4 11.4 50 11.4Z",
  /** Narrow and long, the chin coming to a point. */
  long: "M50 11 C57.2 11 61.9 17.2 61.9 25.4 C61.9 32.6 57.8 40 50 40.6 C42.2 40 38.1 32.6 38.1 25.4 C38.1 17.2 42.8 11 50 11Z",
} as const;

export type Jaw = keyof typeof FACE_SHAPES;

/**
 * Neck, ears and the face itself. Whatever is drawn on the face (features,
 * hair, glasses) comes in as children, over it.
 */
export function Head({ look, jaw = "oval", children }: { id?: string; look: Look; jaw?: Jaw; children?: ReactNode }) {
  return (
    <g>
      <ellipse cx="37.1" cy="27.2" rx="2.6" ry="3.6" fill={look.skinShade} />
      {/* The neck sits in the chin's shadow. */}
      <path d="M46.2 32 L53.8 32 L54.2 52 L45.8 52Z" fill={look.skinShade} />
      <path d="M46.2 32 L53.8 32 L53.6 38 Q50 41.5 46.4 38Z" fill={look.skinShade} />
      {/* Two tones: the shade, then the lit face a touch up and to the left. */}
      <path d={FACE_SHAPES[jaw]} fill={look.skinShade} />
      <path d={FACE_SHAPES[jaw]} fill={look.skin} transform="translate(1.7 0.3) scale(0.945)" style={{ transformOrigin: "50px 25.5px" }} />
      {/* Form, in flat layers: light on the forehead and the near cheekbone, shade at the jaw and the far temple. */}
      <ellipse cx="46.5" cy="18.6" rx="6.4" ry="3.4" fill={look.skinLight} opacity="0.2" />
      <ellipse cx="43.4" cy="29" rx="3.8" ry="2.3" fill={look.skinLight} opacity="0.16" />
      <path d="M52.6 34 Q59 36.4 61.6 30.4 Q60.8 37.2 52.4 39.2Z" fill={look.skinShade} opacity="0.2" />
      <path d="M38.2 25.6 Q38.6 32 41.2 35.2 Q39.4 31.6 39.6 25.2Z" fill={look.skinShade} opacity="0.14" />
      <ellipse cx="62.9" cy="27.2" rx="2.6" ry="3.6" fill={look.skin} />
      <path d="M62.2 25.4 Q64.2 27.2 62.8 29.4" stroke={look.skinShade} strokeWidth="0.8" fill="none" opacity="0.7" strokeLinecap="round" />
      {children}
    </g>
  );
}

export type EyeKind = "almond" | "round" | "narrow";
export type BrowKind = "soft" | "thin-arched" | "straight-thick";
export type NoseKind = "narrow" | "medium" | "wide";
export type LipKind = "thin" | "medium" | "full";
export type MouthKind = "soft" | "closed-smile" | "smile";

/** What makes a face this person's: the shape of each feature, and the expression. */
export interface FaceSpec {
  eye?: EyeKind;
  /** 1 is the usual size. */
  eyeSize?: number;
  brow?: BrowKind;
  nose?: NoseKind;
  lips?: LipKind;
  mouth?: MouthKind;
}

function Eye({ id, cx, cy, look, kind, size, tag }: { id?: string; cx: number; cy: number; look: Look; kind: EyeKind; size: number; tag: string }) {
  const w = 3.5 * size;
  const up = (kind === "round" ? 3.6 : kind === "narrow" ? 2.3 : 3.0) * size;
  const down = (kind === "round" ? 2.4 : kind === "narrow" ? 1.5 : 2.0) * size;
  const white = `M${cx - w} ${cy} Q${cx} ${cy - up * 1.4} ${cx + w} ${cy} Q${cx} ${cy + down * 1.35} ${cx - w} ${cy}Z`;
  const r = 2.2 * size;
  const ix = cx + 0.35;
  const iy = cy + 0.15;
  const clip = id ? `${id}-${tag}` : undefined;
  return (
    <g>
      {clip && (
        <clipPath id={clip}>
          <path d={white} />
        </clipPath>
      )}
      <path d={white} fill="#f6efe9" />
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        <circle cx={ix} cy={iy} r={r} fill={look.iris} />
        <circle cx={ix} cy={iy} r={r * 0.5} fill="#070402" />
        <circle cx={ix + 0.7} cy={iy - 0.8} r="0.55" fill="#ffffff" opacity="0.92" />
        {/* The lid's shadow across the top of the eye. */}
        <path d={`M${cx - w} ${cy} Q${cx} ${cy - up * 1.4} ${cx + w} ${cy} Q${cx} ${cy - up * 0.6} ${cx - w} ${cy}Z`} fill="#000000" opacity="0.13" />
      </g>
      {/* The lash line, a flick at the outer corner, the lower lid, and the crease above. */}
      <path d={`M${cx - w} ${cy + 0.1} Q${cx} ${cy - up * 1.4} ${cx + w} ${cy}`} stroke={look.hair} strokeWidth="1.25" fill="none" strokeLinecap="round" />
      <path d={`M${cx + w} ${cy} l1.1 -1`} stroke={look.hair} strokeWidth="1" strokeLinecap="round" />
      <path d={`M${cx - w + 0.5} ${cy + 0.5} Q${cx} ${cy + down * 1.35} ${cx + w - 0.3} ${cy + 0.3}`} stroke={look.skinShade} strokeWidth="0.75" fill="none" opacity="0.6" />
      <path d={`M${cx - w + 0.3} ${cy - 1.3} Q${cx} ${cy - up * 2} ${cx + w} ${cy - 1}`} stroke={look.skinShade} strokeWidth="0.6" fill="none" opacity="0.3" />
    </g>
  );
}

/** A brow, drawn for the left eye; the right one is its mirror about the nose. */
function Brow({ kind, color, right }: { kind: BrowKind; color: string; right?: boolean }) {
  const d =
    kind === "thin-arched"
      ? "M49.6 22.2 Q45.2 18.9 41 22.2 Q45.2 20.6 49.4 23.3Z"
      : kind === "straight-thick"
        ? "M49.8 21.6 Q45.4 20.4 41 21.8 Q45.2 22.9 49.6 23.8Z"
        : "M49.6 21.8 Q45.6 19.9 41.2 22.4 Q45.4 21.8 49.4 23.6Z";
  return <path d={d} fill={color} transform={right ? "translate(101.6 0) scale(-1 1)" : undefined} />;
}

function Nose({ kind, look }: { kind: NoseKind; look: Look }) {
  const tip = kind === "wide" ? 3 : kind === "medium" ? 2.4 : 1.9;
  const nostril = kind === "wide" ? 1.3 : kind === "medium" ? 1.05 : 0.85;
  const spread = kind === "wide" ? 2.3 : kind === "medium" ? 1.9 : 1.6;
  return (
    <g>
      <path d="M51.4 26.4 Q52.9 30 52 33" stroke={look.skinShade} strokeWidth="1" fill="none" opacity="0.45" strokeLinecap="round" />
      <ellipse cx="50.9" cy="33.1" rx={tip} ry={tip * 0.55} fill={look.skinShade} opacity="0.22" />
      <ellipse cx={50.9 - spread} cy="33.9" rx={nostril} ry={nostril * 0.5} fill={look.skinShade} opacity="0.7" />
      <ellipse cx={50.9 + spread} cy="33.8" rx={nostril} ry={nostril * 0.5} fill={look.skinShade} opacity="0.7" />
      <path d={`M${50.9 - spread - 0.9} 33.4 q-0.8 -1.6 0.6 -2.4 M${50.9 + spread + 0.9} 33.4 q0.8 -1.6 -0.6 -2.4`} stroke={look.skinShade} strokeWidth="0.7" fill="none" opacity="0.5" strokeLinecap="round" />
      <ellipse cx="50.6" cy="32.3" rx={tip * 0.42} ry="0.6" fill={look.skinLight} opacity="0.35" />
    </g>
  );
}

function Mouth({ lips, mouth, look }: { lips: LipKind; mouth: MouthKind; look: Look }) {
  const Y = 36.9;
  const lift = mouth === "smile" ? 1.5 : mouth === "closed-smile" ? 0.75 : 0.15;
  const uh = lips === "full" ? 1.9 : lips === "medium" ? 1.4 : 1.0;
  const lh = lips === "full" ? 3.2 : lips === "medium" ? 2.4 : 1.8;
  const Yc = Y - lift;
  return (
    <g>
      <path d={`M46 ${Yc + 0.2} Q50.7 ${Y + lh + lift * 0.6} 55.4 ${Yc + 0.2} Q50.7 ${Y + 1.2} 46 ${Yc + 0.2}Z`} fill={look.lipLight} />
      {mouth === "smile" && <path d={`M46.8 ${Yc + 0.3} Q50.7 ${Y + 1.7} 54.6 ${Yc + 0.3} Q50.7 ${Y + 0.9} 46.8 ${Yc + 0.3}Z`} fill="#fbf7f2" opacity="0.95" />}
      <path d={`M45.6 ${Yc} Q47.6 ${Y - uh} 49.6 ${Y - uh * 0.6} Q50.7 ${Y - uh - 0.3} 51.8 ${Y - uh * 0.6} Q53.8 ${Y - uh} 55.8 ${Yc} Q50.7 ${Y + 0.9} 45.6 ${Yc}Z`} fill={look.lip} />
      <path d={`M45.6 ${Yc} Q50.7 ${Y + 1.1 + lift * 0.3} 55.8 ${Yc}`} stroke={look.lip} strokeWidth="0.6" fill="none" opacity="0.85" strokeLinecap="round" />
      {lips !== "thin" && <ellipse cx="50.7" cy={Y + lh * 0.55} rx="1.6" ry="0.5" fill="#ffffff" opacity="0.16" />}
    </g>
  );
}

/**
 * A face drawn to its person: each feature's shape comes from `spec`, with
 * the older `smile`, `blush` and `young` still honoured for anyone without
 * one. `id` lets the irises sit inside the eyes.
 */
export function Face({ id, look, smile = 0.6, blush, young = false, spec = {} }: { id?: string; look: Look; smile?: number; blush?: string; young?: boolean; spec?: FaceSpec }) {
  const eye = spec.eye ?? "almond";
  const size = spec.eyeSize ?? (young ? 1.08 : 1);
  const brow = spec.brow ?? "soft";
  const nose = spec.nose ?? "medium";
  const lips = spec.lips ?? "medium";
  const mouth = spec.mouth ?? (smile >= 0.8 ? "smile" : smile >= 0.3 ? "closed-smile" : "soft");
  return (
    <g>
      <Brow kind={brow} color={look.hair} />
      <Brow kind={brow} color={look.hair} right />
      <Eye id={id} cx={45.2} cy={27} look={look} kind={eye} size={size} tag="eyeL" />
      <Eye id={id} cx={56.4} cy={27} look={look} kind={eye} size={size} tag="eyeR" />
      <Nose kind={nose} look={look} />
      <ellipse cx="43" cy="31.8" rx="3.4" ry="2" fill={look.skinShade} opacity="0.1" />
      <ellipse cx="58.6" cy="32" rx="3.4" ry="2" fill={look.skinShade} opacity="0.1" />
      {blush && (
        <g>
          <circle cx="43" cy="31.6" r="2.6" fill={blush} opacity="0.45" />
          <circle cx="58.6" cy="31.6" r="2.6" fill={blush} opacity="0.45" />
        </g>
      )}
      <Mouth lips={lips} mouth={mouth} look={look} />
    </g>
  );
}

/* ── Hair ──────────────────────────────────────────────────────── */

/** A braid: a rope of hair with the plait picked out in a lighter tone. */
export function Braid({ d, color, tint, width = 3.2 }: { d: string; color: string; tint: string; width?: number }) {
  return (
    <g>
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
      <path d={d} stroke={tint} strokeWidth={width * 0.42} strokeDasharray="2.2 3.2" fill="none" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

/* ── Torso ─────────────────────────────────────────────────────── */

/** The body from the shoulders to the hips, as one shape everyone's clothes are cut to. */
export const TORSO = "M36.6 51.6 C42 49.6 58 49.6 63.4 51.6 L65 61 C65.7 76 64.2 89 63.6 100 L36.4 100 C35.8 89 34.3 76 35 61Z";
/** The right-hand side of the torso, in shadow. */
export const TORSO_SHADE = "M51.5 50.3 C56.8 50.1 61.4 50.6 63.4 51.6 L65 61 C65.7 76 64.2 89 63.6 100 L51.5 100Z";
/** The same, cut slim. */
export const TORSO_SLIM = "M37.8 51.6 C42.6 49.8 57.4 49.8 62.2 51.6 L63.6 61 C64.2 76 62.9 89 62.5 100 L37.5 100 C37.1 89 35.8 76 36.4 61Z";
export const TORSO_SLIM_SHADE = "M51.4 50.4 C56.2 50.2 60.4 50.7 62.2 51.6 L63.6 61 C64.2 76 62.9 89 62.5 100 L51.4 100Z";

/* ── Arms and hands ────────────────────────────────────────────── */

export function Hand({ x, y, fill, look }: { x: number; y: number; fill: string; look: Look }) {
  return (
    <g>
      <path d={`M${x - 3.4} ${y} L${x + 3.4} ${y} Q${x + 4.7} ${y + 5} ${x + 3} ${y + 9.6} Q${x} ${y + 11.2} ${x - 3} ${y + 9.6} Q${x - 4.7} ${y + 5} ${x - 3.4} ${y}Z`} fill={fill} />
      <ellipse cx={x + 3.9} cy={y + 3.6} rx="1.5" ry="2.7" fill={fill} transform={`rotate(-22 ${x + 3.9} ${y + 3.6})`} />
      <path d={`M${x - 1.3} ${y + 5.2} L${x - 1.3} ${y + 9.4} M${x + 0.9} ${y + 5.2} L${x + 0.9} ${y + 9.4}`} stroke={look.skinShade} strokeWidth="0.6" opacity="0.45" />
    </g>
  );
}

/**
 * An arm hanging from the shoulder, tapered to the wrist, with a hand.
 * `sleeve` covers the shoulder and upper arm; `long` runs it to the wrist;
 * `cuff` dresses the forearm only. `w` scales the arm's width for a slim
 * or a solid build.
 */
export function Arm({
  cls,
  side,
  look,
  id,
  sleeve,
  long = false,
  cuff,
  w = 1,
  extra,
  hand,
}: {
  cls: string;
  side: "front" | "back";
  look: Look;
  id: string;
  /** A sheer sleeve has an `opacity` below 1. */
  sleeve?: { base: string; shade: string; opacity?: number };
  long?: boolean;
  cuff?: { base: string; shade: string; from: number };
  w?: number;
  extra?: ReactNode;
  hand?: ReactNode;
}) {
  const x = side === "front" ? JOINT.frontArmX : JOINT.backArmX;
  const back = side === "back";
  const skin = back ? look.skinShade : limbFill(id);
  const sleeveTo = long ? 95 : 69.5;
  const top = 4.9 * w;
  const elbow = 4.1 * w;
  const wrist = 3.4 * w;
  return (
    <g className={cls} style={{ transformOrigin: `${x}px ${JOINT.shoulderY}px` }}>
      <path d={`M${x - top} 55 Q${x} 53.2 ${x + top} 55 L${x + elbow} 78 L${x + wrist} 98 Q${x} 99.8 ${x - wrist} 98 L${x - elbow} 78Z`} fill={skin} />
      <path d={`M${x - 3 * w} 78.6 Q${x} 79.9 ${x + 3 * w} 78.6`} stroke={look.skinShade} strokeWidth="0.8" opacity="0.5" fill="none" strokeLinecap="round" />
      {sleeve && (
        <g opacity={sleeve.opacity ?? 1}>
          <path d={`M${x - top - 1.4} 55 Q${x} 52.4 ${x + top + 1.4} 55 L${x + (long ? wrist + 0.8 : elbow + 1.4)} ${sleeveTo} Q${x} ${sleeveTo + 1.6} ${x - (long ? wrist + 0.8 : elbow + 1.4)} ${sleeveTo}Z`} fill={back ? sleeve.shade : sleeve.base} />
          <path d={`M${x + 1} 53.4 Q${x + 4.6 * w} 53.3 ${x + top + 1.4} 55 L${x + (long ? wrist + 0.8 : elbow + 1.4)} ${sleeveTo} Q${x + 2.8} ${sleeveTo + 1.4} ${x + 1} ${sleeveTo + 1.4}Z`} fill={sleeve.shade} opacity={back ? 0.4 : 0.6} />
        </g>
      )}
      {cuff && (
        <g>
          <path d={`M${x - elbow - 0.6} ${cuff.from} L${x + elbow + 0.6} ${cuff.from} L${x + wrist + 0.6} 98.5 Q${x} 100.2 ${x - wrist - 0.6} 98.5Z`} fill={back ? cuff.shade : cuff.base} />
          <path d={`M${x + 1} ${cuff.from} L${x + elbow + 0.6} ${cuff.from} L${x + wrist + 0.6} 98.5 Q${x + 2.6} 99.8 ${x + 1} 99.8Z`} fill={cuff.shade} opacity={back ? 0.4 : 0.55} />
        </g>
      )}
      {extra}
      <Hand x={x} y={98} fill={skin} look={look} />
      {hand}
    </g>
  );
}

/* ── Legs and shoes ────────────────────────────────────────────── */

/**
 * A shoe, toe to the right. Sits with its top at `y` (the ankle). `high`
 * adds a high top; `laces` and `detail` are drawn over it.
 */
export function Shoe({
  x,
  y = JOINT.ankleY,
  fill,
  shade,
  sole,
  high = false,
  laces = false,
  detail,
}: {
  x: number;
  y?: number;
  fill: string;
  shade: string;
  sole: string;
  high?: boolean;
  laces?: boolean;
  detail?: ReactNode;
}) {
  return (
    <g>
      {high && <path d={`M${x - 5} ${y - 11} L${x + 5} ${y - 11} L${x + 5.3} ${y + 0.5} L${x - 5.3} ${y + 0.5}Z`} fill={fill} />}
      <path
        d={`M${x - 5.2} ${y} L${x + 5.2} ${y} L${x + 6} ${y + 3.6} Q${x + 11.6} ${y + 3.7} ${x + 13.6} ${y + 7.3} L${x + 13.6} ${y + 8.6} L${x - 5.9} ${y + 8.6} Q${x - 6.5} ${y + 4} ${x - 5.2} ${y}Z`}
        fill={fill}
      />
      <path d={`M${x + 6} ${y + 3.6} Q${x + 11.6} ${y + 3.7} ${x + 13.6} ${y + 7.3} L${x + 13.6} ${y + 8.6} L${x + 3} ${y + 8.6}Z`} fill={shade} opacity="0.55" />
      <rect x={x - 6.2} y={y + 8.2} width="20.2" height="2.7" rx="1.2" fill={sole} />
      {laces &&
        [0, 1, 2].map((i) => (
          <rect key={i} x={x - 2.6} y={y + (high ? -8.5 : 1) + i * 2.8} width="5.4" height="1" rx="0.5" fill="#f8fafc" opacity="0.85" />
        ))}
      {detail}
    </g>
  );
}

/**
 * A leg from the hip, tapered to the ankle. Shorts, socks and knee pads are
 * cut to it; the shoe goes on last.
 */
export function Leg({
  cls,
  side,
  look,
  id,
  shorts,
  sock,
  kneePad,
  tights,
  w = 1,
  shoe,
}: {
  cls: string;
  side: "front" | "back";
  look: Look;
  id: string;
  /** Shorts (or a skirt's underside) from the hip to `to`. */
  shorts?: { base: string; shade: string; to: number };
  /** A sock from `from` down to the shoe, with an optional stripe at the top. */
  sock?: { base: string; shade: string; from: number; stripe?: string };
  kneePad?: { base: string; shade: string };
  /** Tights colour the whole leg instead of skin. */
  tights?: { base: string; shade: string };
  /** Scales the leg's width for a slim or a solid build. */
  w?: number;
  shoe: ReactNode;
}) {
  const x = side === "front" ? JOINT.frontLegX : JOINT.backLegX;
  const back = side === "back";
  const skin = tights ? (back ? tights.shade : tights.base) : back ? look.skinShade : limbFill(id);
  const hip = 6.8 * w;
  const knee = 5.4 * w;
  const ankle = 4.2 * w;
  /** Half the leg's width at a height, for cloth cut to it. */
  const at = (y: number) => (y <= 122 ? hip + ((knee - hip) * (y - 97)) / 25 : knee + ((ankle - knee) * (y - 122)) / 21.5);
  return (
    <g className={cls} style={{ transformOrigin: `${x}px ${JOINT.hipY}px` }}>
      <path d={`M${x - hip} 97 L${x + hip} 97 L${x + knee} 122 L${x + ankle} 143.5 L${x - ankle} 143.5 L${x - knee} 122Z`} fill={skin} />
      <ellipse cx={x + 0.6} cy="122.8" rx={3.4 * w} ry="2" fill={tights ? tights.shade : look.skinShade} opacity="0.3" />
      {shorts && (
        <g>
          <path d={`M${x - hip - 1.4} 96 L${x + hip + 1.4} 96 L${x + at(shorts.to) + 1.6} ${shorts.to} Q${x} ${shorts.to + 1.8} ${x - at(shorts.to) - 1.6} ${shorts.to}Z`} fill={back ? shorts.shade : shorts.base} />
          <path d={`M${x + 1.5} 96 L${x + hip + 1.4} 96 L${x + at(shorts.to) + 1.6} ${shorts.to} Q${x + 4} ${shorts.to + 1.4} ${x + 1.5} ${shorts.to + 1.2}Z`} fill={shorts.shade} opacity={back ? 0.35 : 0.55} />
        </g>
      )}
      {kneePad && (
        <g>
          <path d={`M${x - at(116) - 0.6} 116 Q${x} 114.4 ${x + at(116) + 0.6} 116 L${x + at(129) + 0.6} 129 Q${x} 130.6 ${x - at(129) - 0.6} 129Z`} fill={back ? kneePad.shade : kneePad.base} />
          <path d={`M${x - 4 * w} 121.5 Q${x} 120.5 ${x + 4 * w} 121.5`} stroke={kneePad.shade} strokeWidth="0.9" fill="none" opacity="0.6" />
        </g>
      )}
      {sock && (
        <g>
          <path d={`M${x - at(sock.from) - 0.3} ${sock.from} L${x + at(sock.from) + 0.3} ${sock.from} L${x + ankle + 0.3} 144.5 L${x - ankle - 0.3} 144.5Z`} fill={back ? sock.shade : sock.base} />
          {sock.stripe && <rect x={x - at(sock.from)} y={sock.from + 1.2} width={at(sock.from) * 2} height="2.2" fill={sock.stripe} opacity="0.9" />}
        </g>
      )}
      {shoe}
    </g>
  );
}
