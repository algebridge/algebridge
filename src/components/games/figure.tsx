"use client";

import { useId, type ReactNode } from "react";

/**
 * The parts the team shares: Shaurya, Jo, Jordyn and Rayla are all built
 * from these (Veronica keeps her own drawing and rig, in
 * src/components/house/Veronica.tsx). One figure is 100 wide and 160 tall, feet
 * on the ground at 154, facing a little to the right; light comes from the
 * upper left, with a rim light on the shadow side (cool on cloth, the skin's
 * own warm light on skin).
 *
 * Proportions are a teenager's: the head is about a seventh of the height,
 * the neck shows, the legs are about half the height, the hands reach mid
 * thigh. Each limb is two groups, so knees and elbows bend: the thigh turns
 * about the hip and the shin about the knee, the upper arm about the
 * shoulder and the forearm about the elbow; the foot turns about the ankle. The CSS that runs, kicks and
 * skates rotates those groups; at rest they hang straight.
 *
 * The head is drawn in its own space (30 tall, skull top at 10, chin at 40,
 * middle at x 50) and scaled onto the neck by `HEAD`, so a face has room
 * for its features. Faces are drawn to the person through a `FaceSpec`:
 * the eye, brow, nose and lip shapes, and the expression.
 *
 * Everything here is literal or plain arithmetic (no sines), so the server
 * and the browser draw the same SVG to the last digit.
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
  shoulderY: 38,
  backArmX: 35.8,
  frontArmX: 64.2,
  elbowY: 62,
  wristY: 83,
  hipY: 79,
  backLegX: 55,
  frontLegX: 45,
  kneeY: 113,
  ankleY: 146,
  groundY: 154,
} as const;

/** Rounds to hundredths, so a computed coordinate prints the same everywhere. */
export const n = (v: number) => Math.round(v * 100) / 100;

/** Mixes two #rrggbb colors, `t` of the way from a to b. Integer math, so it is the same on server and client. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >> s) & 255;
    const y = (pb >> s) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** An id for this drawing's gradients, so two people on one page never share one. */
export function useArtId(): string {
  return useId().replace(/[^a-zA-Z0-9]/g, "");
}

/** The cool light that edges the shadow side of cloth. */
export const RIM = "#eaf2ff";

/**
 * The light that edges the shadow side of skin: the skin's own light, a
 * little paler. A cool grey-blue rim on darker skin reads as a cut-out
 * outline, so skin keeps its own warmth at the edge.
 */
export const skinRim = (look: Look) => mix(look.skinLight, "#ffffff", 0.3);

/**
 * The gradients a figure's skin uses, defined once per drawing: a roll of
 * light across each near limb, a deeper one for the far limbs, a soft
 * light on the face, the turn into shadow, the soft dark where limbs meet
 * the body, and the shadow on the ground.
 */
export function SkinDefs({ id, look }: { id: string; look: Look }) {
  const deep = mix(look.skinShade, "#000000", 0.22);
  return (
    <defs>
      <linearGradient id={`${id}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={look.skinLight} />
        <stop offset="0.4" stopColor={look.skin} />
        <stop offset="0.78" stopColor={look.skinShade} />
        <stop offset="1" stopColor={deep} />
      </linearGradient>
      <linearGradient id={`${id}-limbBack`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={look.skin} />
        <stop offset="0.5" stopColor={look.skinShade} />
        <stop offset="1" stopColor={deep} />
      </linearGradient>
      <radialGradient id={`${id}-face`} cx="0.36" cy="0.38" r="0.74">
        <stop offset="0" stopColor={look.skinLight} />
        <stop offset="0.5" stopColor={look.skin} />
        <stop offset="1" stopColor={look.skinShade} />
      </radialGradient>
      <linearGradient id={`${id}-turn`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={deep} stopOpacity="0" />
        <stop offset="0.3" stopColor={deep} stopOpacity="0.32" />
        <stop offset="1" stopColor={deep} stopOpacity="0.55" />
      </linearGradient>
      <radialGradient id={`${id}-ao`}>
        <stop offset="0" stopColor="#000000" stopOpacity="0.34" />
        <stop offset="1" stopColor="#000000" stopOpacity="0" />
      </radialGradient>
      {/* Soft light and soft dark, for highlights and hollows without a hard edge. */}
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor={look.skinLight} stopOpacity="0.85" />
        <stop offset="1" stopColor={look.skinLight} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-dim`}>
        <stop offset="0" stopColor={deep} stopOpacity="0.55" />
        <stop offset="1" stopColor={deep} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0.7" stopColor={skinRim(look)} stopOpacity="0" />
        <stop offset="1" stopColor={skinRim(look)} stopOpacity="0.22" />
      </linearGradient>
      <radialGradient id={`${id}-ground`}>
        <stop offset="0" stopColor="#0f172a" stopOpacity="0.34" />
        <stop offset="0.6" stopColor="#0f172a" stopOpacity="0.16" />
        <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export const limbFill = (id: string) => `url(#${id}-limb)`;
export const limbBackFill = (id: string) => `url(#${id}-limbBack)`;
export const aoFill = (id: string) => `url(#${id}-ao)`;
export const glowFill = (id: string) => `url(#${id}-glow)`;
export const dimFill = (id: string) => `url(#${id}-dim)`;

/**
 * A cloth's gradient: lit on the left, its own shade on the right, a little
 * deeper at the edge. By default it spans each shape it fills; with `from`
 * and `to` it spans those x positions in the figure instead, so two pieces
 * of one garment (a top and the hem that hangs over the shorts) share one
 * ramp and meet without a seam.
 */
export function ClothGradient({ id, base, light, shade, from, to }: { id: string; base: string; light?: string; shade: string; from?: number; to?: number }) {
  const span = from !== undefined && to !== undefined ? { gradientUnits: "userSpaceOnUse" as const, x1: from, x2: to } : { x1: 0, x2: 1 };
  return (
    <linearGradient id={id} y1="0" y2="0" {...span}>
      <stop offset="0" stopColor={light ?? mix(base, "#ffffff", 0.16)} />
      <stop offset="0.42" stopColor={base} />
      <stop offset="0.8" stopColor={shade} />
      <stop offset="1" stopColor={mix(shade, "#000000", 0.18)} />
    </linearGradient>
  );
}

/** A soft round shadow on the ground under the feet. */
export function GroundShadow({ id }: { id: string }) {
  return <ellipse cx="50" cy="154.4" rx="27" ry="4.6" fill={`url(#${id}-ground)`} />;
}

/* ── Head and face ─────────────────────────────────────────────── */

/** Places the head, drawn in its own 30-tall space, on the neck: chin at (51, 28). */
export const HEAD = "translate(16.1 0.4) scale(0.69)";

const FACE_SHAPES = {
  /** Oval, the usual. */
  oval: "M50.4 10 C57 10 61.4 14.6 61.2 21.4 C61.1 25 60.9 28.6 60.2 31.2 C59.4 34.4 57.4 37.4 54.6 39.2 C53.2 40.1 48.6 40.2 47.2 39.2 C44.2 37.2 41.8 34.2 40.8 31 C39.8 28 39.3 25 39.4 21.4 C39.6 14.6 43.8 10 50.4 10Z",
  /** Rounder and full in the cheeks, a softer jaw. */
  round: "M50.4 10 C57.4 10 61.9 14.6 61.8 21.6 C62.6 25.6 62.4 29 60.8 31.8 C59.8 35.2 57.4 38.2 54.4 39.3 C52.6 39.9 49 40 47.2 39.3 C44 38.1 41.4 35.2 40.2 31.6 C38.4 28.8 38 25.4 38.9 21.6 C39 14.6 43.4 10 50.4 10Z",
  /** A squarer jaw. */
  square: "M50.4 10 C57 10 61.4 14.6 61.2 21.4 C61.2 25.4 61.2 29.4 60.6 32.2 C60 35.6 57.8 38 54.8 39.4 C53 40.1 48.6 40.1 47 39.4 C43.8 38 41.2 35.4 40.4 32 C39.6 29 39.4 25.4 39.4 21.4 C39.6 14.6 43.8 10 50.4 10Z",
  /** Narrow and long, the chin a little longer. */
  long: "M50.4 9.8 C56.8 9.8 61 14.4 60.9 21.2 C60.8 25.4 60.6 29.4 59.8 32.2 C59 35.4 57.2 38.4 54.4 40.1 C52.8 41 48.8 41 47.4 40.1 C44.4 38.4 42.2 35.4 41.2 32 C40.2 29 39.6 25.4 39.7 21.2 C39.8 14.4 44 9.8 50.4 9.8Z",
} as const;

export type Jaw = keyof typeof FACE_SHAPES;

/**
 * The neck, in the figure's own space: a column into the collar and the
 * chin's shadow across the top of it. With `chest`, the shoulders and the
 * top of the chest in skin too, for a neckline that shows them, curving up
 * into the armpits so no edge of it shows beside the arms.
 */
export function Neck({ id, look, w = 1, chest = false }: { id: string; look: Look; w?: number; chest?: boolean }) {
  const l = n(50.6 - 3.3 * w);
  const r = n(50.6 + 3.3 * w);
  const deep = mix(look.skinShade, "#000000", 0.2);
  return (
    <g>
      {chest && (
        <g>
          <path d="M46.6 31.4 C42.4 33.2 37.6 34 34.8 35.4 C33 36.4 32.6 38.6 33 41 L35 44 C36.4 48 38 50.4 39.2 51 L62 51 C63.2 50.4 64.6 48 65.6 44 L67 41 C67.4 38.6 67 36.4 65.2 35.4 C62.4 34 58 33.2 54.6 31.4Z" fill={limbFill(id)} />
          <path d="M37.6 37.8 C41.4 36.4 45.2 36 49.4 36.6 M51.8 36.6 C55.6 36 59.2 36.4 62.6 37.8" stroke={look.skinShade} strokeWidth="0.55" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d="M38 36.9 C41.6 35.6 45.4 35.2 49 35.8" stroke={look.skinLight} strokeWidth="0.5" fill="none" opacity="0.5" strokeLinecap="round" />
        </g>
      )}
      <path d={`M${l} 20 L${r} 20 C${n(r - 0.2)} 26 ${n(r + 0.3)} 30 ${n(r + 1.6)} 34 L${n(l - 1.6)} 34 C${n(l - 0.3)} 30 ${n(l + 0.2)} 26 ${l} 20Z`} fill={limbFill(id)} />
      {/* The chin's shadow falls down and to the right across the neck. */}
      <path d={`M${l} 20 L${r} 20 L${r} 27.6 C${n(r - 1.8)} 29.8 ${n(l + 2)} 30 ${l} 27.4Z`} fill={deep} opacity="0.62" />
    </g>
  );
}

/**
 * The head: ears, the face with its light and shade, and whatever is drawn
 * over it (features, hair, glasses) as children, all in head space. `back`
 * goes behind the face (hair that falls behind it); `shade` is drawn inside
 * the face only (the hair's shadow on the forehead).
 */
export function Head({
  id,
  look,
  jaw = "oval",
  back,
  shade,
  children,
}: {
  id: string;
  look: Look;
  jaw?: Jaw;
  back?: ReactNode;
  shade?: ReactNode;
  children?: ReactNode;
}) {
  const face = FACE_SHAPES[jaw];
  const deep = mix(look.skinShade, "#000000", 0.2);
  return (
    <g transform={HEAD}>
      {back}
      {/* Ears: the near one lit, the far one mostly turned away. */}
      <path d="M40.2 22.2 C38 21 36.4 23 36.7 26 C37 28.8 38 31 40.4 31.4Z" fill={look.skin} />
      <path d="M39.6 23.6 C38.3 23.4 37.8 25.2 38.1 26.9 C38.3 28.3 38.9 29.3 39.8 29.6" stroke={deep} strokeWidth="0.55" fill="none" opacity="0.7" strokeLinecap="round" />
      <ellipse cx="39.3" cy="27" rx="0.75" ry="1.3" fill={look.skinShade} opacity="0.8" />
      <path d="M60.6 22.4 C62.6 21.8 63.5 24 63.2 26.4 C63 28.6 62.2 30.4 60.4 30.9Z" fill={look.skinShade} />
      <path d="M61.2 24 C62.4 24.2 62.6 26 62.3 27.6" stroke={deep} strokeWidth="0.5" fill="none" opacity="0.7" strokeLinecap="round" />
      {/* The face, lit from the upper left. */}
      <clipPath id={`${id}-faceclip`}>
        <path d={face} />
      </clipPath>
      <clipPath id={`${id}-jawclip`}>
        <rect x="30" y="24" width="40" height="24" />
      </clipPath>
      <path d={face} fill={`url(#${id}-face)`} />
      <g clipPath={`url(#${id}-faceclip)`}>
        {/* The turn of the form into shadow, down the right side of the face and under the jaw. */}
        <path d="M56.8 9 C60.6 15 60.2 23 58.6 28.8 C57.4 33.4 55.2 37.4 51.4 41.4 L66 42 L66 9Z" fill={`url(#${id}-turn)`} />
        <ellipse cx="51" cy="42.4" rx="10" ry="4.4" fill={dimFill(id)} />
        {/* Soft light on the forehead, the near cheekbone, the bridge of the nose and the chin. */}
        <ellipse cx="47" cy="16.4" rx="7" ry="4" fill={glowFill(id)} opacity="0.7" />
        <ellipse cx="44.6" cy="29.6" rx="4.4" ry="2.8" fill={glowFill(id)} opacity="0.75" />
        <ellipse cx="50.2" cy="38.2" rx="2.8" ry="1.6" fill={glowFill(id)} opacity="0.7" />
        {/* The eye sockets sit a little in shadow, the far one more; the far cheek hollows under its bone. */}
        <ellipse cx="46.6" cy="24.6" rx="4" ry="2.4" fill={dimFill(id)} opacity="0.55" />
        <ellipse cx="55.6" cy="24.6" rx="3.8" ry="2.4" fill={dimFill(id)} opacity="0.75" />
        <ellipse cx="58.2" cy="32" rx="2.6" ry="3.4" fill={dimFill(id)} opacity="0.5" />
        {shade}
        {/* The rim light: the face's own edge, caught on the shadow side of the cheek and jaw only. */}
        <path d={face} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="0.9" clipPath={`url(#${id}-jawclip)`} />
      </g>
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
  /** A flick of lashes at the outer corner. */
  lashes?: boolean;
}

const EYE_Y = 25.6;
const EYE_KINDS: Record<EyeKind, { up: number; down: number; tilt: number }> = {
  almond: { up: 1.25, down: 0.8, tilt: 0.35 },
  round: { up: 1.55, down: 1.05, tilt: 0.1 },
  narrow: { up: 0.98, down: 0.6, tilt: 0.3 },
};

/**
 * One eye, in head space. `dir` is -1 for the near eye (its outer corner to
 * the left) and 1 for the far one. The white, an iris clipped inside it with
 * a pupil and a catch of light, the lid's shadow, the lash line, the crease.
 */
function Eye({ id, cx, hw, look, kind, size, dir, lashes, tag }: { id: string; cx: number; hw: number; look: Look; kind: EyeKind; size: number; dir: 1 | -1; lashes: boolean; tag: string }) {
  const k = EYE_KINDS[kind];
  const w = hw * size;
  const up = k.up * size;
  const down = k.down * size;
  const cy = EYE_Y;
  const ix = n(cx - dir * w);
  const iy = n(cy + 0.15);
  const ox = n(cx + dir * w);
  const oy = n(cy - k.tilt);
  const upper = `M${ix} ${iy} C${n(ix + dir * w * 0.62)} ${n(cy - up * 1.38)} ${n(ox - dir * w * 1.05)} ${n(cy - up * 1.42)} ${ox} ${oy}`;
  const white = `${upper} C${n(ox - dir * w * 0.75)} ${n(cy + down * 1.3)} ${n(ix + dir * w * 1.1)} ${n(cy + down * 1.22)} ${ix} ${iy}Z`;
  const r = n(w * 0.56);
  const gx = n(cx + 0.32 * size);
  const gy = n(cy + 0.05);
  const clip = `${id}-${tag}`;
  const lash = mix(look.hair, "#000000", 0.45);
  const crease = mix(look.skinShade, "#000000", 0.25);
  return (
    <g>
      <clipPath id={clip}>
        <path d={white} />
      </clipPath>
      <path d={white} fill="#efe7e1" />
      <g clipPath={`url(#${clip})`}>
        <circle cx={gx} cy={gy} r={r} fill={look.iris} stroke="#000000" strokeOpacity="0.45" strokeWidth="0.28" />
        <circle cx={n(gx + 0.15)} cy={n(gy + r * 0.35)} r={n(r * 0.55)} fill="#ffffff" opacity="0.1" />
        <circle cx={gx} cy={gy} r={n(r * 0.46)} fill="#0a0605" />
        <circle cx={n(gx - r * 0.36)} cy={n(gy - r * 0.4)} r={n(0.3 * size)} fill="#ffffff" />
        {/* The upper lid casts a shadow across the top of the eye. */}
        <ellipse cx={cx} cy={n(cy - up * 1.15)} rx={n(w * 1.2)} ry={n(up * 0.85)} fill="#2a1712" opacity="0.28" />
      </g>
      <path d={upper} stroke={lash} strokeWidth={n(0.62 * size)} fill="none" strokeLinecap="round" />
      {lashes && <path d={`M${n(ox - dir * 0.5)} ${n(oy - 0.2)} q${n(dir * 0.7)} -0.1 ${n(dir * 1.05)} -0.85`} stroke={lash} strokeWidth="0.45" fill="none" strokeLinecap="round" />}
      <path d={`M${n(ix + dir * w * 0.3)} ${n(cy - up * 0.95)} Q${n(cx + dir * 0.2)} ${n(cy - up * 1.95 - 0.45)} ${n(ox - dir * w * 0.12)} ${n(oy - up * 0.82)}`} stroke={crease} strokeWidth="0.32" fill="none" opacity="0.75" strokeLinecap="round" />
      <path d={`M${n(ox - dir * w * 0.15)} ${n(oy + 0.35)} C${n(ox - dir * w * 0.75)} ${n(cy + down * 1.35)} ${n(ix + dir * w * 1.0)} ${n(cy + down * 1.3)} ${n(ix + dir * 0.2)} ${n(iy + 0.25)}`} stroke={look.skinShade} strokeWidth="0.32" fill="none" opacity="0.7" />
      <ellipse cx={n(ix + dir * 0.25)} cy={n(iy + 0.05)} rx="0.32" ry="0.26" fill="#c98f86" opacity="0.8" />
    </g>
  );
}

const BROWS: Record<BrowKind, { ti: number; to: number; a: number }> = {
  "thin-arched": { ti: 0.62, to: 0.24, a: 1.2 },
  "straight-thick": { ti: 1.15, to: 0.62, a: 0.3 },
  soft: { ti: 0.85, to: 0.36, a: 0.72 },
};

/** A brow with weight at the inner end, tapering to the outer, arched by kind. */
function Brow({ cx, hw, dir, kind, color }: { cx: number; hw: number; dir: 1 | -1; kind: BrowKind; color: string }) {
  const b = BROWS[kind];
  const y = 22.4;
  const xi = n(cx - dir * (hw - 0.05));
  const xo = n(cx + dir * (hw + 1.05));
  const len = xo - xi;
  const d = `M${xi} ${n(y + 0.55)} L${n(xi + dir * 0.15)} ${n(y + 0.55 - b.ti)} C${n(xi + len * 0.38)} ${n(y - b.a - b.ti * 0.55)} ${n(xi + len * 0.72)} ${n(y - b.a - b.to * 0.4)} ${xo} ${n(y + 0.85)} C${n(xi + len * 0.72)} ${n(y - b.a * 0.55 + b.to * 0.5)} ${n(xi + len * 0.4)} ${n(y - b.a * 0.4 + 0.35)} ${xi} ${n(y + 0.55)}Z`;
  return (
    <g>
      <path d={d} fill={color} />
      <path d={d} fill="none" stroke={color} strokeWidth="0.18" opacity="0.6" />
    </g>
  );
}

const NOSES: Record<NoseKind, { s: number; ns: number }> = {
  narrow: { s: 1.3, ns: 0.42 },
  medium: { s: 1.6, ns: 0.52 },
  wide: { s: 2.05, ns: 0.66 },
};

/** The nose: a lit bridge, the shaded side plane, wings round the nostrils, a shadow under it. */
function Nose({ kind, look }: { kind: NoseKind; look: Look }) {
  const { s, ns } = NOSES[kind];
  const tx = 51.5;
  const deep = mix(look.skinShade, "#000000", 0.35);
  return (
    <g transform="translate(0 0.6)">
      <path d={`M51.9 24.4 C52.5 26.6 53.1 28.4 ${n(tx + s + 0.2)} 30.2 L${n(tx + s - 0.1)} 31.3 C52.8 30.4 52.2 28 51.4 25Z`} fill={look.skinShade} opacity="0.45" />
      <path d="M50.4 25.2 C50.6 26.8 50.8 28.3 51 29.5" stroke={look.skinLight} strokeWidth="0.55" fill="none" opacity="0.6" strokeLinecap="round" />
      <ellipse cx={n(tx - 0.25)} cy="29.95" rx="0.5" ry="0.36" fill={look.skinLight} opacity="0.75" />
      <path d={`M${n(tx - s + 0.1)} 29.7 C${n(tx - s - 0.8)} 30.1 ${n(tx - s - 0.6)} 31.4 ${n(tx - s + 0.45)} 31.45 M${n(tx + s - 0.1)} 29.8 C${n(tx + s + 0.7)} 30.2 ${n(tx + s + 0.5)} 31.4 ${n(tx + s - 0.4)} 31.45`} stroke={deep} strokeWidth="0.42" fill="none" opacity="0.7" strokeLinecap="round" />
      <ellipse cx={n(tx - s * 0.5)} cy="31.25" rx={ns} ry={n(ns * 0.48)} fill={deep} opacity="0.85" />
      <ellipse cx={n(tx + s * 0.55)} cy="31.25" rx={n(ns * 0.9)} ry={n(ns * 0.45)} fill={deep} opacity="0.85" />
      <ellipse cx={n(tx + 0.5)} cy="32.3" rx={n(s + 0.3)} ry="0.42" fill={look.skinShade} opacity="0.32" />
    </g>
  );
}

const LIPS: Record<LipKind, { hw: number; uh: number; lh: number }> = {
  thin: { hw: 3.15, uh: 0.62, lh: 0.88 },
  medium: { hw: 3.35, uh: 0.82, lh: 1.12 },
  full: { hw: 3.6, uh: 1.08, lh: 1.5 },
};

/** Two-tone lips: the upper lip turned from the light, the lower lit, the line between them. */
function Mouth({ lips, mouth, look }: { lips: LipKind; mouth: MouthKind; look: Look }) {
  const { hw, uh, lh } = LIPS[lips];
  const cx = 51.1;
  const y = 35.3;
  const lift = mouth === "smile" ? 0.75 : mouth === "closed-smile" ? 0.38 : 0.05;
  const lx = n(cx - hw * 1.05);
  const rx = n(cx + hw * 0.93);
  const cyc = n(y - lift);
  const line = mix(look.lip, "#000000", 0.5);
  const upper = `M${lx} ${cyc} C${n(cx - hw * 0.6)} ${n(y - uh * 0.55)} ${n(cx - 0.95)} ${n(y - uh * 1.12)} ${n(cx - 0.45)} ${n(y - uh)} Q${cx} ${n(y - uh + 0.3)} ${n(cx + 0.45)} ${n(y - uh)} C${n(cx + 0.95)} ${n(y - uh * 1.12)} ${n(cx + hw * 0.55)} ${n(y - uh * 0.55)} ${rx} ${cyc} C${n(cx + hw * 0.45)} ${n(y + 0.2)} ${n(cx - hw * 0.5)} ${n(y + 0.2)} ${lx} ${cyc}Z`;
  const lower = `M${rx} ${cyc} C${n(cx + hw * 0.62)} ${n(y + lh * 0.95 - lift * 0.2)} ${n(cx - hw * 0.66)} ${n(y + lh * 1.0 - lift * 0.2)} ${lx} ${cyc} C${n(cx - hw * 0.5)} ${n(y + 0.25)} ${n(cx + hw * 0.45)} ${n(y + 0.25)} ${rx} ${cyc}Z`;
  return (
    <g>
      <path d={lower} fill={look.lipLight} />
      <path d={upper} fill={look.lip} />
      {mouth === "smile" && <path d={`M${n(lx + 0.6)} ${n(cyc + 0.1)} Q${cx} ${n(y + 0.95)} ${n(rx - 0.5)} ${n(cyc + 0.1)} Q${cx} ${n(y + 0.25)} ${n(lx + 0.6)} ${n(cyc + 0.1)}Z`} fill="#f6f1ea" />}
      <path d={`M${lx} ${cyc} Q${cx} ${n(y + 0.32 + lift * 0.55)} ${rx} ${cyc}`} stroke={line} strokeWidth="0.36" fill="none" strokeLinecap="round" opacity="0.85" />
      <ellipse cx={n(cx - 0.45)} cy={n(y + lh * 0.48)} rx={n(hw * 0.3)} ry="0.26" fill="#ffffff" opacity="0.16" />
      <ellipse cx={n(cx + 0.3)} cy={n(y + lh + 0.85)} rx="1.7" ry="0.5" fill={look.skinShade} opacity="0.4" />
      {/* The groove from the nose down to the lip. */}
      <path d={`M${n(cx - 0.55)} ${n(y - uh - 1.6)} Q${n(cx - 0.4)} ${n(y - uh - 0.8)} ${n(cx - 0.5)} ${n(y - uh - 0.1)} M${n(cx + 0.6)} ${n(y - uh - 1.6)} Q${n(cx + 0.5)} ${n(y - uh - 0.8)} ${n(cx + 0.6)} ${n(y - uh - 0.1)}`} stroke={look.skinShade} strokeWidth="0.3" fill="none" opacity="0.3" strokeLinecap="round" />
      {mouth !== "soft" && <path d={`M${n(lx - 0.25)} ${n(cyc - 0.35)} q-0.3 0.45 0.05 0.95 M${n(rx + 0.2)} ${n(cyc - 0.35)} q0.3 0.45 -0.05 0.95`} stroke={look.skinShade} strokeWidth="0.32" fill="none" opacity="0.6" strokeLinecap="round" />}
    </g>
  );
}

/**
 * A face drawn to its person, in head space: each feature's shape comes
 * from `spec`; `smile` and `young` still set the expression and the eyes'
 * size for anyone without one. `blush` warms the cheeks.
 */
export function Face({ id, look, smile = 0.6, blush, young = false, spec = {} }: { id: string; look: Look; smile?: number; blush?: string; young?: boolean; spec?: FaceSpec }) {
  const eye = spec.eye ?? "almond";
  const size = spec.eyeSize ?? (young ? 1.08 : 1);
  const brow = spec.brow ?? "soft";
  const nose = spec.nose ?? "medium";
  const lips = spec.lips ?? "medium";
  const mouth = spec.mouth ?? (smile >= 0.8 ? "smile" : smile >= 0.3 ? "closed-smile" : "soft");
  const lashes = spec.lashes ?? false;
  return (
    <g>
      {blush && (
        <g>
          {/* A soft warmth that fades out at the edges, not a flat disc. */}
          <defs>
            <radialGradient id={`${id}-blush`}>
              <stop offset="0" stopColor={blush} stopOpacity="0.5" />
              <stop offset="1" stopColor={blush} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="44.4" cy="30.6" rx="3.9" ry="2.3" fill={`url(#${id}-blush)`} opacity="0.9" />
          <ellipse cx="57.6" cy="30.6" rx="3" ry="2.2" fill={`url(#${id}-blush)`} opacity="0.9" />
        </g>
      )}
      <Brow cx={46.4} hw={2.15} dir={-1} kind={brow} color={look.hair} />
      <Brow cx={55.6} hw={2.0} dir={1} kind={brow} color={look.hair} />
      <Eye id={id} cx={46.4} hw={2.15} look={look} kind={eye} size={size} dir={-1} lashes={lashes} tag="eyeL" />
      <Eye id={id} cx={55.6} hw={2.0} look={look} kind={eye} size={size} dir={1} lashes={lashes} tag="eyeR" />
      <Nose kind={nose} look={look} />
      <Mouth lips={lips} mouth={mouth} look={look} />
    </g>
  );
}

/* ── Hair ──────────────────────────────────────────────────────── */

/**
 * A braid: a rope of hair with each plait picked out, a darker edge on the
 * shadow side and a light run down the lit side. The plaits are long dashes
 * with square ends, the two sides offset so they interlock rather than sit
 * in a row like treads. `cap` ends the rope square, for rows that start
 * inside the hairline.
 */
export function Braid({ d, color, tint, width = 3.2, cap = "round" }: { d: string; color: string; tint: string; width?: number; cap?: "round" | "butt" }) {
  const dash = `${n(width * 0.7)} ${n(width * 0.35)}`;
  return (
    <g>
      <path d={d} stroke={mix(color, "#000000", 0.45)} strokeWidth={n(width + 0.4)} fill="none" strokeLinecap={cap} />
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap={cap} />
      {/* The plait: strands crossing from one side to the other in turn, the near ones lit. */}
      <path d={d} stroke={tint} strokeWidth={n(width * 0.36)} strokeDasharray={dash} strokeLinecap="butt" fill="none" opacity="0.45" transform={`translate(${n(-width * 0.17)} 0)`} />
      <path d={d} stroke={tint} strokeWidth={n(width * 0.36)} strokeDasharray={dash} strokeDashoffset={n(width * 0.7)} strokeLinecap="butt" fill="none" opacity="0.25" transform={`translate(${n(width * 0.17)} 0)`} />
    </g>
  );
}

/**
 * A limb's own roll of light, laid across the limb in its own space, so the
 * upper and lower halves (thigh and shin, upper arm and forearm) meet at the
 * joint without a seam in the shading.
 */
function LimbGradient({ gid, look, back, from, to }: { gid: string; look: Look; back: boolean; from: number; to: number }) {
  const deep = mix(look.skinShade, "#000000", 0.22);
  return (
    <defs>
      <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={from} y1="0" x2={to} y2="0">
        <stop offset="0" stopColor={back ? look.skin : look.skinLight} />
        <stop offset={back ? "0.5" : "0.4"} stopColor={back ? look.skinShade : look.skin} />
        {!back && <stop offset="0.78" stopColor={look.skinShade} />}
        <stop offset="1" stopColor={deep} />
      </linearGradient>
    </defs>
  );
}

/* ── Hands ─────────────────────────────────────────────────────── */

/**
 * A relaxed hand hanging from the wrist at (x, y): the back of the hand,
 * four fingers together and a little curled, the thumb on the forward side.
 */
export function Hand({ x, y, id, look, back = false, w = 1 }: { x: number; y: number; id: string; look: Look; back?: boolean; w?: number }) {
  const fill = back ? limbBackFill(id) : limbFill(id);
  const crease = mix(look.skinShade, "#000000", 0.25);
  return (
    <g transform={`translate(${n(x)} ${n(y)}) scale(${n(w)})`}>
      <path d="M1.3 1.2 C2.9 1.8 3.9 3.5 3.9 6 C3.9 7.4 2.6 7.7 2.4 6.4 C2.2 4.9 1.7 4 0.9 3.5Z" fill={fill} />
      <rect x="-2.45" y="5.4" width="1.2" height="4.4" rx="0.5" fill={fill} transform="rotate(1.5 -1.85 5.6)" />
      <rect x="-1.3" y="5.8" width="1.35" height="5.5" rx="0.5" fill={fill} transform="rotate(0.6 -0.62 6)" />
      <rect x="-0.05" y="6" width="1.4" height="5.9" rx="0.5" fill={fill} />
      <rect x="1.15" y="5.6" width="1.35" height="5.3" rx="0.5" fill={fill} transform="rotate(-1.2 1.82 5.8)" />
      <path d="M-1.95 -0.4 L1.95 -0.4 C2.4 2.2 2.6 4.6 2.5 6.9 C0.9 7.5 -0.9 7.5 -2.5 6.7 C-2.6 4.6 -2.4 2.2 -1.95 -0.4Z" fill={fill} />
      {/* Where the fingers lie against each other. */}
      <path d="M-1.3 7.6 L-1.25 10.4 M0 7.8 L0 11.3 M1.3 7.6 L1.28 10.6" stroke={crease} strokeWidth="0.22" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M-2.2 6.5 C-0.8 7.1 0.9 7.2 2.4 6.6" stroke={crease} strokeWidth="0.32" fill="none" opacity="0.55" />
      <path d="M-1.2 1.2 C-1.3 3 -1.2 4.6 -0.9 6" stroke={look.skinLight} strokeWidth="0.45" fill="none" opacity="0.4" strokeLinecap="round" />
    </g>
  );
}

/* ── Arms ──────────────────────────────────────────────────────── */

/**
 * An arm from the shoulder at (x, 38): the upper arm turns about the
 * shoulder and the forearm, with the hand, about the elbow at 62. `upper`
 * dresses the upper arm (a sleeve) and is drawn over the elbow; `fore`
 * dresses the forearm (a long sleeve, a bangle); `hand` is drawn after the
 * hand (a pom-pom). `w` scales the arm's width for a slim or a solid build.
 * The forearm's class is the arm's with "arm" turned to "fore".
 */
export function Arm({
  cls,
  side,
  look,
  id,
  x,
  w = 1,
  upper,
  fore,
  hand,
  hideHand = false,
}: {
  cls: string;
  side: "front" | "back";
  look: Look;
  id: string;
  x?: number;
  w?: number;
  upper?: ReactNode;
  fore?: ReactNode;
  hand?: ReactNode;
  hideHand?: boolean;
}) {
  const back = side === "back";
  const ax = x ?? (back ? JOINT.backArmX : JOINT.frontArmX);
  const p = (dx: number) => n(ax + dx * w);
  const gid = `${id}-arm${side}`;
  const fill = `url(#${gid})`;
  const foreCls = cls.replace(/arm/g, "fore");
  return (
    <g className={cls} style={{ transformOrigin: `${n(ax)}px ${JOINT.shoulderY}px` }}>
      <LimbGradient gid={gid} look={look} back={back} from={p(-4.2)} to={p(4.2)} />
      <path
        d={`M${p(-3.5)} 40.4 C${p(-3.7)} 37.6 ${p(-1.8)} 36 ${p(0.2)} 36 C${p(2.2)} 36 ${p(3.9)} 37.6 ${p(3.7)} 40.6 C${p(3.6)} 46 ${p(3.3)} 53 ${p(2.75)} 61.5 C${p(2.5)} 64.6 ${p(-2.6)} 64.6 ${p(-2.85)} 61.5 C${p(-3.3)} 54 ${p(-3.9)} 46 ${p(-3.5)} 40.4Z`}
        fill={fill}
      />
      {!back && <path d={`M${p(3.3)} 41 C${p(3.4)} 47 ${p(3.1)} 54 ${p(2.6)} 61`} stroke={skinRim(look)} strokeWidth="0.5" fill="none" opacity="0.35" strokeLinecap="round" />}
      <g className={foreCls} style={{ transformOrigin: `${n(ax)}px ${JOINT.elbowY}px` }}>
        <path d={`M${p(-2.85)} 61.4 C${p(-2.85)} 59.2 ${p(2.75)} 59.2 ${p(2.75)} 61.4 C${p(3.15)} 66 ${p(2.6)} 74 ${p(1.95)} 83.6 L${p(-1.95)} 83.6 C${p(-2.5)} 75 ${p(-3.25)} 67 ${p(-2.85)} 61.4Z`} fill={fill} />
        <path d={`M${p(-0.9)} 61.6 Q${p(0.4)} 62.8 ${p(1.6)} 61.8`} stroke={look.skinShade} strokeWidth="0.45" fill="none" opacity="0.55" strokeLinecap="round" />
        {!back && <path d={`M${p(2.85)} 64 C${p(2.8)} 70 ${p(2.4)} 76 ${p(1.9)} 82`} stroke={skinRim(look)} strokeWidth="0.45" fill="none" opacity="0.33" strokeLinecap="round" />}
        {fore}
        {!hideHand && <Hand x={ax} y={83} id={id} look={look} back={back} w={w} />}
        {hand}
      </g>
      {upper}
    </g>
  );
}

/* ── Legs and shoes ────────────────────────────────────────────── */

/**
 * A sneaker, toe to the right, its collar at the ankle (x, 146): the upper,
 * a white midsole and a darker outsole, laces, a toe that catches the light.
 */
export function Sneaker({
  x,
  upper,
  shade,
  midsole = "#f8fafc",
  outsole = "#94a3b8",
  accent,
  lace = "#f8fafc",
  back = false,
}: {
  x: number;
  upper: string;
  shade: string;
  midsole?: string;
  outsole?: string;
  accent?: string;
  lace?: string;
  back?: boolean;
}) {
  const y = JOINT.ankleY;
  const X = (dx: number) => n(x + dx);
  return (
    <g>
      <path d={`M${X(-5.4)} ${y - 1.6} C${X(-3)} ${y - 2.6} ${X(1.6)} ${y - 2.4} ${X(3.6)} ${y - 1} C${X(6.8)} ${y + 1} ${X(11.2)} ${y + 2.6} ${X(13.2)} ${y + 5.4} L${X(13.4)} ${y + 6.4} L${X(-6.2)} ${y + 6.4} C${X(-6.6)} ${y + 3} ${X(-6.2)} ${y} ${X(-5.4)} ${y - 1.6}Z`} fill={back ? shade : upper} />
      <path d={`M${X(4)} ${y + 1.6} C${X(8)} ${y + 2.6} ${X(11.6)} ${y + 3.6} ${X(13.2)} ${y + 5.4} L${X(13.4)} ${y + 6.4} L${X(1.4)} ${y + 6.4}Z`} fill={shade} opacity={back ? 0.4 : 0.55} />
      <path d={`M${X(7.4)} ${y + 2.2} C${X(9.6)} ${y + 2.6} ${X(11.4)} ${y + 3.4} ${X(12.4)} ${y + 4.4}`} stroke="#ffffff" strokeWidth="0.7" fill="none" opacity={back ? 0.15 : 0.5} strokeLinecap="round" />
      {accent && <path d={`M${X(-3.4)} ${y + 4.2} C${X(0)} ${y + 2.6} ${X(4)} ${y + 2.8} ${X(8.6)} ${y + 4.4}`} stroke={accent} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity={back ? 0.6 : 1} />}
      <path d={`M${X(0.4)} ${y - 1.4} L${X(2.6)} ${y - 0.2} M${X(1.8)} ${y - 1.6} L${X(-0.2)} ${y + 0.2} M${X(2.6)} ${y + 0.2} L${X(4.8)} ${y + 1.4} M${X(4)} ${y} L${X(2.2)} ${y + 1.8}`} stroke={lace} strokeWidth="0.55" strokeLinecap="round" opacity={back ? 0.55 : 0.95} />
      <path d={`M${X(-6.5)} ${y + 6} L${X(13.6)} ${y + 6} C${X(14.2)} ${y + 6.4} ${X(14.2)} ${y + 7.4} ${X(13.6)} ${y + 7.6} L${X(-6.3)} ${y + 7.6} C${X(-6.9)} ${y + 7.4} ${X(-7)} ${y + 6.4} ${X(-6.5)} ${y + 6}Z`} fill={back ? mix(midsole, "#000000", 0.12) : midsole} />
      <path d={`M${X(-6.3)} ${y + 7.5} L${X(13.6)} ${y + 7.5} C${X(13.6)} ${y + 8.2} ${X(13.2)} ${y + 8.4} ${X(12.8)} ${y + 8.4} L${X(-5.8)} ${y + 8.4} C${X(-6.2)} ${y + 8.4} ${X(-6.4)} ${y + 8} ${X(-6.3)} ${y + 7.5}Z`} fill={outsole} />
    </g>
  );
}

/**
 * A leg from the hip at (x, 79): the thigh turns about the hip and the shin,
 * with the foot, about the knee at 113. Shorts dress the thigh; socks, knee
 * pads and the shoe go on the shin. `tights` color the whole leg instead
 * of skin. The shin's class is the leg's with "leg" turned to "shin", and
 * the shoe sits in a foot group ("leg" turned to "foot") that turns about
 * the ankle.
 */
export function Leg({
  cls,
  side,
  look,
  id,
  x,
  shorts,
  sock,
  kneePad,
  tights,
  w = 1,
  shoe,
  thigh,
}: {
  cls: string;
  side: "front" | "back";
  look: Look;
  id: string;
  x?: number;
  /** Shorts from the waist to `to`; `fill` may be a gradient. */
  shorts?: { fill: string; shade: string; to: number; hem?: string };
  /** A sock from `from` down to the shoe, with an optional stripe at the top. */
  sock?: { fill: string; shade: string; from: number; stripe?: string };
  kneePad?: { fill: string; shade: string };
  /** Tights color the whole leg instead of skin; `fill` may be a gradient. */
  tights?: { fill: string; shade: string; light: string };
  /** Scales the leg's width for a slim or a solid build. */
  w?: number;
  shoe: ReactNode;
  /** Drawn over the thigh, after the shorts. */
  thigh?: ReactNode;
}) {
  const back = side === "back";
  const lx = x ?? (back ? JOINT.backLegX : JOINT.frontLegX);
  const gid = `${id}-leg${side}`;
  const fill = tights ? tights.fill : `url(#${gid})`;
  const shadeTone = tights ? tights.shade : look.skinShade;
  const lightTone = tights ? tights.light : look.skinLight;
  const rim = tights ? tights.light : skinRim(look);
  const p = (dx: number) => n(lx + dx * w);
  /** The thigh's half-widths at a height, left and right, for cloth cut to it. */
  const thL = (y: number) => (y <= 86 ? 7.3 : 7.3 - ((y - 86) * 2.65) / 26) * w;
  const thR = (y: number) => (y <= 86 ? 6.9 : 6.9 - ((y - 86) * 2.3) / 26) * w;
  /** The shin's, below the calf. */
  const shL = (y: number) => (y <= 120 ? 5.2 : 5.2 - ((y - 120) * 2.2) / 26) * w;
  const shR = (y: number) => (4.6 - ((y - 112) * 1.65) / 34) * w;
  const at = (dx: number) => n(lx + dx);
  return (
    <g className={cls} style={{ transformOrigin: `${n(lx)}px ${JOINT.hipY}px` }}>
      {!tights && <LimbGradient gid={gid} look={look} back={back} from={p(-7.6)} to={p(7.4)} />}
      <path d={`M${p(-7.3)} 74 L${p(7)} 74 C${p(7.2)} 88 ${p(6)} 101 ${p(4.6)} 112 C${p(4.2)} 115.6 ${p(-4.4)} 115.6 ${p(-4.7)} 112 C${p(-6.4)} 102 ${p(-7.7)} 88 ${p(-7.3)} 74Z`} fill={fill} />
      {/* The rim light on the far leg's outer edge, the figure's silhouette (the near leg's outer edge lies over the far leg). */}
      {back && <path d={`M${p(6.5)} 80 C${p(6.55)} 90 ${p(5.6)} 101 ${p(4.25)} 111`} stroke={rim} strokeWidth="0.55" fill="none" opacity="0.35" strokeLinecap="round" />}
      {shorts && (
        <g>
          <path d={`M${at(-thL(74) - 0.2)} 72 L${at(thR(74) + 0.2)} 72 L${at(thR(shorts.to) + 1.5)} ${shorts.to} Q${n(lx)} ${n(shorts.to + 1.6)} ${at(-thL(shorts.to) - 1.5)} ${shorts.to}Z`} fill={shorts.fill} />
          <path d={`M${at(-thL(shorts.to) - 1.3)} ${n(shorts.to - 1.2)} Q${n(lx)} ${n(shorts.to + 0.4)} ${at(thR(shorts.to) + 1.3)} ${n(shorts.to - 1.2)}`} stroke={shorts.hem ?? shorts.shade} strokeWidth="0.6" fill="none" opacity="0.8" />
          <path d={`M${at(-2.4)} ${n(shorts.to - 12)} Q${at(0.2)} ${n(shorts.to - 7)} ${at(3.6)} ${n(shorts.to - 3.6)} M${at(-thL(shorts.to) + 0.4)} ${n(shorts.to - 3.6)} L${at(-thL(shorts.to) + 3)} ${n(shorts.to - 2.2)}`} stroke={shorts.shade} strokeWidth="0.5" fill="none" opacity="0.55" strokeLinecap="round" />
        </g>
      )}
      {thigh}
      <g className={cls.replace(/leg/g, "shin")} style={{ transformOrigin: `${n(lx)}px ${JOINT.kneeY}px` }}>
        <path d={`M${p(-4.6)} 112 C${p(-4.4)} 109.6 ${p(4.5)} 109.6 ${p(4.6)} 112 C${p(4.7)} 121 ${p(3.6)} 134 ${p(2.9)} 146 L${p(-3)} 146 C${p(-3.6)} 138 ${p(-5.9)} 127 ${p(-5.2)} 119 C${p(-5.1)} 116 ${p(-4.8)} 114 ${p(-4.6)} 112Z`} fill={fill} />
        {/* The kneecap catches the light softly; a faint crease under it; the shin bone runs light down the front. */}
        <ellipse cx={p(0.2)} cy="112.4" rx={n(2.2 * w)} ry="2.8" fill={glowFill(id)} opacity={back ? 0.15 : 0.35} />
        <path d={`M${p(-2.4)} 117 Q${p(0.4)} 118.6 ${p(2.8)} 116.8`} stroke={shadeTone} strokeWidth="0.5" fill="none" opacity="0.22" strokeLinecap="round" />
        {back && <path d={`M${p(4.2)} 116 C${p(4.1)} 124 ${p(3.3)} 135 ${p(2.6)} 145`} stroke={rim} strokeWidth="0.5" fill="none" opacity="0.35" strokeLinecap="round" />}
        <path d={`M${p(1.6)} 120 C${p(1.6)} 128 ${p(1.2)} 136 ${p(0.8)} 143`} stroke={lightTone} strokeWidth="1.3" fill="none" opacity={back ? 0.06 : 0.16} strokeLinecap="round" />
        {kneePad && (
          <g>
            <path d={`M${p(-5.4)} 106.6 C${p(-5)} 104.6 ${p(5)} 104.6 ${p(5.3)} 106.6 L${p(5.5)} 119.4 C${p(4.6)} 121.2 ${p(-4.8)} 121.4 ${p(-5.8)} 119.6Z`} fill={back ? kneePad.shade : kneePad.fill} />
            <path d={`M${p(-4.8)} 112.4 Q${p(0.2)} 110.8 ${p(5.1)} 112.4 M${p(-4.6)} 109 Q${p(0.2)} 107.6 ${p(5)} 109`} stroke={kneePad.shade} strokeWidth="0.5" fill="none" opacity="0.8" />
            <path d={`M${p(2.6)} 106.2 L${p(5.4)} 106.4 L${p(5.5)} 119.4 C${p(4.6)} 120.6 ${p(3.6)} 121 ${p(2.6)} 121.1Z`} fill={kneePad.shade} opacity={back ? 0.3 : 0.55} />
          </g>
        )}
        {sock && (
          <g>
            <path d={`M${at(-shL(sock.from) - 0.35)} ${sock.from} L${at(shR(sock.from) + 0.35)} ${sock.from} L${p(3.3)} 147 L${p(-3.4)} 147Z`} fill={back ? sock.shade : sock.fill} />
            <path d={`M${at(1.2)} ${sock.from} L${at(shR(sock.from) + 0.35)} ${sock.from} L${p(3.3)} 147 L${p(0.9)} 147Z`} fill={sock.shade} opacity={back ? 0.3 : 0.6} />
            <path d={`M${at(-shL(sock.from))} ${n(sock.from + 2.4)} L${at(shR(sock.from))} ${n(sock.from + 2.4)}`} stroke={sock.shade} strokeWidth="0.45" opacity="0.8" />
            {sock.stripe && <path d={`M${at(-shL(sock.from + 3.6))} ${n(sock.from + 3.6)} L${at(shR(sock.from + 3.6))} ${n(sock.from + 3.6)}`} stroke={sock.stripe} strokeWidth="1.6" opacity="0.95" />}
          </g>
        )}
        {/* The foot turns about the ankle, so a crouch can keep the sole flat on the floor. */}
        <g className={cls.replace(/leg/g, "foot")} style={{ transformOrigin: `${n(lx)}px ${JOINT.ankleY}px` }}>
          {shoe}
        </g>
      </g>
    </g>
  );
}
