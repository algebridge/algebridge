"use client";

import { useId, type ReactNode } from "react";

/**
 * The parts every drawn person shares: Veronica, Shaurya, Jo, Jordyn and
 * Rayla are all built from these. One figure is 100 wide and 160 tall, feet
 * at the bottom, facing a little to the right; light comes from the upper
 * left. The head is about a sixth of the height, the way a teenager's is.
 *
 * Skin is shaded with a soft gradient (the one place the House's flat rule
 * bends, because a face without form reads as a sticker), and every feature
 * is a shape rather than a line: eyes with a white, an iris and a lid;
 * a nose with a bridge and nostrils; lips in two tones.
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
      <radialGradient id={`${id}-face`} cx="0.4" cy="0.3" r="0.78">
        <stop offset="0" stopColor={look.skinLight} />
        <stop offset="0.42" stopColor={look.skin} />
        <stop offset="1" stopColor={look.skinShade} />
      </radialGradient>
      <linearGradient id={`${id}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={look.skinLight} />
        <stop offset="0.38" stopColor={look.skin} />
        <stop offset="1" stopColor={look.skinShade} />
      </linearGradient>
    </defs>
  );
}

export const faceFill = (id: string) => `url(#${id}-face)`;
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
export function Head({ id, look, jaw = "oval", children }: { id: string; look: Look; jaw?: Jaw; children?: ReactNode }) {
  return (
    <g>
      <ellipse cx="37.1" cy="27.2" rx="2.6" ry="3.6" fill={look.skinShade} />
      {/* The neck sits in the chin's shadow. */}
      <path d="M46.2 32 L53.8 32 L54.2 52 L45.8 52Z" fill={look.skinShade} />
      <path d="M46.2 32 L53.8 32 L53.6 38 Q50 41.5 46.4 38Z" fill={look.skinShade} />
      <path d={FACE_SHAPES[jaw]} fill={faceFill(id)} />
      {/* Under the jaw. */}
      <path d="M40.5 33.5 Q50 42 59.5 33.5 Q56.5 39.6 50 39.6 Q43.5 39.6 40.5 33.5Z" fill={look.skinShade} opacity="0.26" />
      <ellipse cx="62.9" cy="27.2" rx="2.6" ry="3.6" fill={look.skin} />
      <path d="M62.2 25.4 Q64.2 27.2 62.8 29.4" stroke={look.skinShade} strokeWidth="0.8" fill="none" opacity="0.7" strokeLinecap="round" />
      {children}
    </g>
  );
}

function Eye({ cx, cy, look }: { cx: number; cy: number; look: Look }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="3.4" ry="2.25" fill="#fbf6f1" />
      <circle cx={cx + 0.6} cy={cy + 0.1} r="2" fill={look.iris} />
      <circle cx={cx + 0.6} cy={cy + 0.1} r="1.05" fill="#0a0604" />
      <circle cx={cx + 1.3} cy={cy - 0.7} r="0.6" fill="#ffffff" opacity="0.9" />
      {/* The upper lid and its lashes, the lower lid, and the crease above. */}
      <path d={`M${cx - 3.5} ${cy - 0.5} Q${cx} ${cy - 3.7} ${cx + 3.6} ${cy - 0.3}`} stroke={look.hair} strokeWidth="1.15" fill="none" strokeLinecap="round" />
      <path d={`M${cx - 3} ${cy + 1.6} Q${cx} ${cy + 2.9} ${cx + 3.2} ${cy + 1.5}`} stroke={look.skinShade} strokeWidth="0.7" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d={`M${cx - 3.9} ${cy - 1.3} Q${cx} ${cy - 4.8} ${cx + 4} ${cy - 1.1}`} stroke={look.skinShade} strokeWidth="0.7" fill="none" opacity="0.4" strokeLinecap="round" />
    </g>
  );
}

/**
 * Brows, eyes, nose, cheeks and mouth. `smile` runs from 0 (lips together,
 * level) to 1 (a real smile). `browGap` moves the brows up a little.
 */
export function Face({ look, smile = 0.6, browGap = 0 }: { look: Look; smile?: number; browGap?: number }) {
  const lift = 1.9 * smile;
  /** Where the corners of the mouth sit, and where the line between the lips dips to. */
  const corner = 37.4 - lift;
  const mid = 37.8 + lift * 0.45;
  const by = 1.1 - browGap;
  return (
    <g>
      <ellipse cx="46" cy="18" rx="5.6" ry="3.2" fill={look.skinLight} opacity="0.3" />
      {/* Brows: fuller toward the nose, tapering out. */}
      <path d={`M41.2 ${22.8 + by} Q45.2 ${19.9 + by} 49.5 ${21.6 + by} Q49.3 ${22.7 + by} 45.3 ${21.9 + by} Q43 ${22.3 + by} 41.5 ${23.7 + by}Z`} fill={look.hair} />
      <path d={`M52.1 ${21.6 + by} Q56.4 ${19.9 + by} 60.4 ${22.8 + by} Q60.1 ${23.7 + by} 58.6 ${22.3 + by} Q56.3 ${21.9 + by} 52.3 ${22.7 + by}Z`} fill={look.hair} />
      <Eye cx={45.2} cy={26.7} look={look} />
      <Eye cx={56.3} cy={26.7} look={look} />
      {/* Nose: the bridge's shadow on the right, the nostrils, a catch of light on the tip. */}
      <path d="M51 27.6 Q53.2 30.6 52.4 33.4" stroke={look.skinShade} strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M48.3 33.6 Q50.6 35.3 53.3 33.5" stroke={look.skinShade} strokeWidth="1.15" fill="none" strokeLinecap="round" opacity="0.85" />
      <ellipse cx="50.5" cy="32.3" rx="1.3" ry="0.8" fill={look.skinLight} opacity="0.35" />
      <circle cx="43.2" cy="31.4" r="3.1" fill={look.lipLight} opacity="0.15" />
      <circle cx="58.8" cy="31.6" r="3.1" fill={look.lipLight} opacity="0.15" />
      {/* Lips: the upper one darker, the lower one catching light. The corners rise with the smile. */}
      <path d={`M45.4 ${corner} Q47.8 35.6 50.6 36.1 Q53.4 35.6 55.8 ${corner} Q50.6 ${mid + 0.2} 45.4 ${corner}Z`} fill={look.lip} />
      <path d={`M45.7 ${corner + 0.2} Q50.6 ${39.2 + lift * 0.8} 55.5 ${corner + 0.2} Q50.6 ${mid + 0.4} 45.7 ${corner + 0.2}Z`} fill={look.lipLight} />
      <path d={`M45.4 ${corner} Q50.6 ${mid + 0.5} 55.8 ${corner}`} stroke={look.lip} strokeWidth="0.6" fill="none" opacity="0.75" strokeLinecap="round" />
      {smile > 0.6 && <path d={`M44.6 ${corner - 0.4} l-0.9 -0.7 M56.6 ${corner - 0.4} l0.9 -0.7`} stroke={look.skinShade} strokeWidth="0.7" fill="none" opacity="0.6" strokeLinecap="round" />}
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
