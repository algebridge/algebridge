"use client";

import {
  Arm,
  ClothGradient,
  Face,
  GroundShadow,
  Head,
  JOINT,
  Leg,
  Neck,
  RIM,
  SkinDefs,
  aoFill,
  mix,
  n,
  useArtId,
  type Look,
} from "@/components/games/figure";

/**
 * Veronica, the figure skater.
 *
 * Drawn from her photo: a deep magenta competition dress with rhinestone
 * lines fanning from the waist, a sheer top over the shoulders, long
 * magenta sleeves, a brown ponytail tied with a magenta bow, a small silver
 * necklace, tan tights and white figure skates.
 *
 * She is built from the same figure as the team (src/components/games/
 * figure.tsx), so she looks as real as they do: a teenager's proportions
 * (the head about a seventh of her height), a face drawn through a
 * `FaceSpec` (eyes with whites, irises and lids, a shaped nose, two-tone
 * lips), skin lit from the upper left, and knees and elbows that bend.
 *
 * Her rig is her own, so the rink's CSS can move her: `.v-leg-*` turns at
 * the hip, `.v-shin-*` at the knee, `.v-foot-*` at the ankle, `.v-arm-*` at
 * the shoulder, `.v-fore-*` at the elbow, `.v-body` and `.v-skirt` (the
 * skirt hangs over both legs and moves with the body) about the hips; inside
 * the skirt, `.v-drape` lets the hem swing forward with the waistband held.
 * Both legs are drawn before the body, so the bodice stays over a thigh
 * lifted to the waist. The near arm is a second `.v-body` group
 * (`.v-front`), drawn last so it stays over the skirt. The stride's speed
 * comes from how fast she is moving.
 * Facing left is a mirror. The drawing is 100 wide and 160 tall, blades on
 * the ice at 154. Every number is written out or plain arithmetic, so the
 * server and the browser draw the same picture.
 */

export type VeronicaPose = "idle" | "skate" | "spin";

const VR: Look = {
  skin: "#f4d5c0",
  skinShade: "#dcae93",
  skinLight: "#fde8da",
  hair: "#6b4426",
  hairLight: "#9a6a42",
  iris: "#4a2e1c",
  lip: "#b52a55",
  lipLight: "#d65a7a",
};

const HAIR_SHADE = "#4e2f18";

const KIT = {
  dress: "#a8186c",
  dressShade: "#7b0f4e",
  dressLight: "#c6338c",
  dressDeep: "#5c0a3a",
  stone: "#fbe7f3",
  tights: "#e9c6a6",
  tightsShade: "#d3ac8a",
  tightsLight: "#f6dcc4",
  boot: "#fafafa",
  bootShade: "#d4d4d8",
  blade: "#9aa3ad",
  bladeLight: "#eef2f6",
  silver: "#cbd5e1",
};

/** She is slim: narrow limbs. */
const BUILD = 0.9;
const LEG_W = 0.92;
const BODY = { transformOrigin: `50px ${JOINT.hipY}px` };

/** A sparkle on a rhinestone: a small cross of light. */
function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${n(x - 1.1 * s)} ${y} L${n(x + 1.1 * s)} ${y} M${x} ${n(y - 1.1 * s)} L${x} ${n(y + 1.1 * s)}`} stroke="#ffffff" strokeWidth="0.22" strokeLinecap="round" opacity="0.9" />;
}

/** Rhinestones along a line from (x1, y1) to (x2, y2), at the given fractions of the way. */
function StoneLine({ x1, y1, x2, y2, at, r = 0.45 }: { x1: number; y1: number; x2: number; y2: number; at: number[]; r?: number }) {
  return (
    <g>
      {at.map((t) => (
        <circle key={t} cx={n(x1 + (x2 - x1) * t)} cy={n(y1 + (y2 - y1) * t)} r={r} fill={KIT.stone} />
      ))}
    </g>
  );
}

/**
 * The sleeve on the upper arm: the sheer cap over the shoulder (skin with a
 * blush of the dress through the mesh), then magenta from under the cap to
 * below the elbow, with rhinestones along its top edge.
 */
function SleeveUpper({ x, id, back }: { x: number; id: string; back: boolean }) {
  const p = (dx: number) => n(x + dx * BUILD);
  const fill = back ? `url(#${id}-dressB)` : `url(#${id}-dress)`;
  return (
    <g>
      <path d={`M${p(-3.5)} 40.4 C${p(-3.7)} 37.6 ${p(-1.8)} 36 ${p(0.2)} 36 C${p(2.2)} 36 ${p(3.9)} 37.6 ${p(3.7)} 40.6 L${p(3.8)} 43 L${p(-3.65)} 43Z`} fill={KIT.dressLight} opacity="0.16" />
      <path d={`M${p(-3.85)} 42.2 Q${p(0)} 41 ${p(3.95)} 42.2 C${p(3.9)} 47 ${p(3.6)} 54 ${p(3.1)} 61.6 C${p(2.8)} 65.2 ${p(-2.95)} 65.2 ${p(-3.2)} 61.6 C${p(-3.65)} 54 ${p(-4.15)} 47 ${p(-3.85)} 42.2Z`} fill={fill} />
      <path d={`M${p(-3.6)} 42.2 Q${p(0)} 41.1 ${p(3.7)} 42.2`} stroke={KIT.stone} strokeWidth="0.7" fill="none" strokeDasharray="0.1 1.15" strokeLinecap="round" />
      {/* Folds at the inside of the elbow, a light run down the lit side, the rim on the shadow side. */}
      <path d={`M${p(-2.8)} 57.6 Q${p(-0.4)} 59.4 ${p(2.4)} 57.4 M${p(-2.4)} 60.2 Q${p(0)} 61.4 ${p(2)} 60`} stroke={KIT.dressDeep} strokeWidth="0.45" fill="none" opacity={back ? 0.35 : 0.55} strokeLinecap="round" />
      {!back && <path d={`M${p(-3)} 45 C${p(-3.2)} 50 ${p(-2.8)} 56 ${p(-2.2)} 61`} stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.18" strokeLinecap="round" />}
      {!back && <path d={`M${p(3.6)} 45 C${p(3.5)} 51 ${p(3.2)} 56 ${p(2.8)} 61`} stroke={RIM} strokeWidth="0.5" fill="none" opacity="0.4" strokeLinecap="round" />}
    </g>
  );
}

/** The sleeve on the forearm, magenta to the wrist. */
function SleeveFore({ x, id, back }: { x: number; id: string; back: boolean }) {
  const p = (dx: number) => n(x + dx * BUILD);
  const fill = back ? `url(#${id}-dressB)` : `url(#${id}-dress)`;
  return (
    <g>
      <path d={`M${p(-3.1)} 61 C${p(-3.1)} 58.8 ${p(3)} 58.8 ${p(3)} 61 C${p(3.4)} 66 ${p(2.85)} 74 ${p(2.2)} 82.6 Q${p(0)} 83.6 ${p(-2.2)} 82.6 C${p(-2.75)} 75 ${p(-3.5)} 67 ${p(-3.1)} 61Z`} fill={fill} />
      {!back && <path d={`M${p(-2.4)} 65 C${p(-2.4)} 70 ${p(-2)} 76 ${p(-1.6)} 81`} stroke="#ffffff" strokeWidth="0.7" fill="none" opacity="0.16" strokeLinecap="round" />}
      {!back && <path d={`M${p(2.9)} 64 C${p(2.8)} 70 ${p(2.5)} 76 ${p(2)} 81.6`} stroke={RIM} strokeWidth="0.45" fill="none" opacity="0.38" strokeLinecap="round" />}
    </g>
  );
}

/** The cuff's edge of rhinestones, drawn over the top of the hand. */
function Cuff({ x }: { x: number }) {
  const p = (dx: number) => n(x + dx * BUILD);
  return <path d={`M${p(-2.1)} 82.6 Q${p(0)} 83.5 ${p(2.1)} 82.6`} stroke={KIT.stone} strokeWidth="0.65" fill="none" strokeDasharray="0.1 1.05" strokeLinecap="round" />;
}

/**
 * A figure skate on the ankle at (x, 146), toe to the right: a high white
 * boot with a padded collar, crossed laces up the front and a stacked heel,
 * the blade on its holder, the toe pick at the front.
 */
function Skate({ x, id, back }: { x: number; id: string; back: boolean }) {
  const X = (dx: number) => n(x + dx);
  return (
    <g>
      {/* The tongue, standing up out of the boot at the front. */}
      <path d={`M${X(1.2)} 135.6 C${X(2.2)} 133.8 ${X(4.4)} 133.6 ${X(5.1)} 135.4 L${X(4.4)} 137Z`} fill={back ? KIT.bootShade : "#f1f2f4"} />
      <path
        d={`M${X(-4.4)} 135.4 C${X(-1.4)} 134.8 ${X(1.6)} 134.8 ${X(4.3)} 135.4 C${X(4.4)} 139 ${X(4.9)} 141.6 ${X(6.2)} 143.4 C${X(8.6)} 144.8 ${X(12)} 146.2 ${X(13.6)} 147.8 C${X(14.8)} 149 ${X(14.6)} 150.6 ${X(13.4)} 150.8 L${X(-4.8)} 150.8 C${X(-6.2)} 150.6 ${X(-6.6)} 148.4 ${X(-6.2)} 145.6 C${X(-5.8)} 142.6 ${X(-4.8)} 139.4 ${X(-4.4)} 135.4Z`}
        fill={back ? `url(#${id}-bootB)` : `url(#${id}-boot)`}
      />
      {/* The sole's side in shadow, the heel counter's seam, the padded collar. */}
      <path d={`M${X(-6.2)} 147.6 C${X(0)} 149 ${X(8)} 149.2 ${X(14.4)} 149.4 L${X(13.4)} 150.8 L${X(-4.8)} 150.8 C${X(-6.2)} 150.6 ${X(-6.6)} 149 ${X(-6.2)} 147.6Z`} fill={KIT.bootShade} opacity={back ? 0.7 : 0.5} />
      <path d={`M${X(-5.6)} 146.4 C${X(-3.6)} 145.6 ${X(-1.6)} 146.2 ${X(-0.6)} 148 L${X(-0.4)} 150.6`} stroke="#b4b8c0" strokeWidth="0.42" fill="none" opacity="0.8" />
      <path d={`M${X(-4.4)} 135.4 C${X(-1.4)} 134.8 ${X(1.6)} 134.8 ${X(4.3)} 135.4 L${X(4.35)} 136.8 C${X(1.6)} 136.2 ${X(-1.4)} 136.2 ${X(-4.45)} 136.8Z`} fill={back ? "#c4c7cd" : "#e4e6ea"} />
      {/* Laces crossing up the front. */}
      <path
        d={`M${X(2.2)} 137.6 L${X(4.6)} 139 M${X(4.6)} 137.6 L${X(2.2)} 139 M${X(2.8)} 140 L${X(5.2)} 141.4 M${X(5.2)} 140 L${X(2.8)} 141.4 M${X(3.8)} 142.2 L${X(6.4)} 143.6 M${X(6.4)} 142.2 L${X(3.8)} 143.6 M${X(5.8)} 144 L${X(8.4)} 145.4 M${X(8.4)} 144 L${X(5.8)} 145.4`}
        stroke={back ? "#a3a9b3" : "#b8bec8"}
        strokeWidth="0.48"
        strokeLinecap="round"
      />
      <path d={`M${X(8.8)} 145.6 C${X(10.8)} 146.2 ${X(12.4)} 147 ${X(13.4)} 148.2`} stroke="#ffffff" strokeWidth="0.7" fill="none" opacity={back ? 0.2 : 0.9} strokeLinecap="round" />
      {!back && <path d={`M${X(-5.4)} 140 C${X(-5.8)} 143 ${X(-6)} 145.6 ${X(-5.8)} 148`} stroke="#ffffff" strokeWidth="0.6" fill="none" opacity="0.7" strokeLinecap="round" />}
      {/* The stacked heel, the sole's edge. */}
      <path d={`M${X(-5.8)} 150.6 L${X(-0.8)} 150.6 L${X(-1.2)} 152.4 L${X(-5.4)} 152.4Z`} fill={back ? "#b9b4ae" : "#d6d1cb"} />
      <path d={`M${X(-5.4)} 150.7 L${X(13.4)} 150.7`} stroke="#a8a29e" strokeWidth="0.45" />
      {/* The holder's two mounts, the blade with its light edge, the toe pick. */}
      <path d={`M${X(-5)} 152.2 L${X(-1.6)} 152.2 L${X(-2.4)} 153 L${X(-4.4)} 153Z M${X(6.4)} 150.8 L${X(12.6)} 150.8 L${X(11.6)} 153 L${X(7.6)} 153Z`} fill={back ? "#858d97" : "#a1a9b3"} />
      <path d={`M${X(-6.6)} 152.8 L${X(13.2)} 152.8 C${X(14.8)} 152.8 ${X(15.4)} 153.6 ${X(14.6)} 154.2 L${X(-5.8)} 154.2 C${X(-6.8)} 154.2 ${X(-7)} 153.2 ${X(-6.6)} 152.8Z`} fill={KIT.blade} />
      <path d={`M${X(-6)} 153.2 L${X(13.6)} 153.2`} stroke={KIT.bladeLight} strokeWidth="0.45" opacity={back ? 0.4 : 0.9} />
      <path d={`M${X(13.2)} 150.6 L${X(15.4)} 151 L${X(16.2)} 151.8 L${X(15.4)} 152.2 L${X(16)} 152.8 L${X(14.8)} 153.2Z`} fill={KIT.blade} />
    </g>
  );
}

/** Her hair, swept back off the face to the ponytail behind her near ear: the cap, in head space. */
const HAIR_CAP =
  "M39.2 25.2 C38.2 20.4 38.6 14.6 42 11 C44.6 8.4 47.6 7.4 50.8 7.4 C55 7.4 58.6 9 60.6 12 C62.6 15 62.8 19 62 23.4 C61.4 21 60.6 19 59.4 17.6 C57.2 15.2 54 14 50.6 14 C47.2 14 44.2 15.2 42.2 17.4 C40.8 19.2 40 21.8 39.2 25.2Z";

export function Veronica({
  pose = "idle",
  facing = 1,
  /** 0 standing, 1 flat out. Sets how fast the legs go. */
  speed = 0,
  className = "",
}: {
  pose?: VeronicaPose;
  facing?: 1 | -1;
  speed?: number;
  className?: string;
}) {
  const id = useArtId();
  const stride = pose === "skate" && speed > 0.05 ? `${Math.max(0.28, 0.9 - speed * 0.6)}s` : undefined;
  const tights = (side: "F" | "B") => ({ fill: `url(#${id}-tights${side})`, shade: KIT.tightsShade, light: mix(KIT.tights, KIT.tightsLight, 0.45) });
  const fx = JOINT.frontLegX;
  const bx = JOINT.backLegX;
  return (
    <svg
      viewBox="0 0 100 160"
      className={`veronica veronica-${pose} ${pose === "spin" ? "veronica-skate" : ""} ${stride ? "veronica-moving" : ""} ${className}`}
      style={{
        transform: facing === -1 ? "scaleX(-1)" : undefined,
        ["--stride" as string]: stride ?? "0s",
      }}
      aria-label="Veronica"
      role="img"
    >
      <SkinDefs id={id} look={VR} />
      <defs>
        <ClothGradient id={`${id}-dress`} base={KIT.dress} light={KIT.dressLight} shade={KIT.dressShade} />
        <ClothGradient id={`${id}-dressB`} base={KIT.dressShade} light={KIT.dress} shade={KIT.dressDeep} />
        <ClothGradient id={`${id}-dressBody`} base={KIT.dress} light={KIT.dressLight} shade={KIT.dressShade} from={30} to={72} />
        {/* Each leg's tights get their own roll of light in the leg's space, so thigh and shin meet without a seam. */}
        <linearGradient id={`${id}-tightsF`} gradientUnits="userSpaceOnUse" x1={n(fx - 7)} y1="0" x2={n(fx + 7)} y2="0">
          <stop offset="0" stopColor={KIT.tightsLight} />
          <stop offset="0.42" stopColor={KIT.tights} />
          <stop offset="0.8" stopColor={KIT.tightsShade} />
          <stop offset="1" stopColor={mix(KIT.tightsShade, "#000000", 0.14)} />
        </linearGradient>
        <linearGradient id={`${id}-tightsB`} gradientUnits="userSpaceOnUse" x1={n(bx - 7)} y1="0" x2={n(bx + 7)} y2="0">
          <stop offset="0" stopColor={KIT.tights} />
          <stop offset="0.5" stopColor={KIT.tightsShade} />
          <stop offset="1" stopColor={mix(KIT.tightsShade, "#000000", 0.24)} />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={VR.hairLight} />
          <stop offset="0.45" stopColor={VR.hair} />
          <stop offset="1" stopColor={HAIR_SHADE} />
        </linearGradient>
        <linearGradient id={`${id}-boot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f5f5f7" />
          <stop offset="1" stopColor="#c8ccd3" />
        </linearGradient>
        <linearGradient id={`${id}-bootB`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#eef0f3" />
          <stop offset="1" stopColor="#b7bcc5" />
        </linearGradient>
      </defs>

      <GroundShadow id={id} />

      {/* Both legs, then the body (so the bodice stays over a thigh lifted to the waist), the skirt over all of it, and the near arm last. */}
      <Leg cls="v-leg v-leg-back" side="back" look={VR} id={id} w={LEG_W} tights={tights("B")} shoe={<Skate x={bx} id={id} back />} />
      <Leg cls="v-leg v-leg-front" side="front" look={VR} id={id} w={LEG_W} tights={tights("F")} shoe={<Skate x={fx} id={id} back={false} />} />

      <g className="v-body" style={BODY}>
        {/* The ponytail, falling from the bow behind her near ear down her back: lit on the outside, strands, a tapered tip. */}
        <path d="M42.8 11.2 C36.6 11.8 31.8 16.6 29.8 23.4 C28 29.6 27.8 36.6 28.6 43 C29.2 48 30.4 52.6 32.6 57.4 C32.8 52.6 33.2 48.4 33.8 44 C34.6 37.6 35.8 31.4 37.8 26.6 C39.4 22.6 41.4 19.4 44 17.4Z" fill={`url(#${id}-hair)`} />
        <path d="M43 13.6 C38 15 34.6 20 33 26.6 C31.8 32.6 31.6 39 32 45 C32.2 49 32.4 53 32.4 56.6 C32.9 52.6 33.2 48.4 33.8 44 C34.6 37.6 35.8 31.4 37.8 26.6 C39.4 22.6 41.4 19.4 44 17.4Z" fill={HAIR_SHADE} opacity="0.5" />
        <path d="M40.6 12.4 C34.6 15.2 31 21.6 29.6 29.4 C28.6 35.6 28.8 42.4 29.8 49 M42 13.6 C36.6 16.8 33.4 23 32 30.4 C31 36.6 31 43.6 31.6 50.4 M38.4 13 C33 16.2 29.8 22.4 28.8 30.6 C28.2 36.4 28.6 42.6 29.4 47.6" stroke={VR.hairLight} strokeWidth="0.42" fill="none" opacity="0.75" strokeLinecap="round" />
        <path d="M30.4 51 C30.6 54 31.4 56.4 32.4 58.4 M31.8 52 C32 54.6 32.4 56.4 33 57.6" stroke={VR.hair} strokeWidth="0.4" fill="none" opacity="0.9" strokeLinecap="round" />

        <Arm
          cls="v-arm v-arm-back"
          side="back"
          look={VR}
          id={id}
          w={BUILD}
          upper={<SleeveUpper x={JOINT.backArmX} id={id} back />}
          fore={<SleeveFore x={JOINT.backArmX} id={id} back />}
          hand={<Cuff x={JOINT.backArmX} />}
        />

        <Neck id={id} look={VR} w={0.92} chest />
        {/* The sheer top over her shoulders and chest: skin through the mesh, a breath of the dress, a fine edge round the neck. */}
        <path d="M45.6 33 C47.8 35 53.4 35 55.6 33 C59 33.6 62.8 34.4 65.2 35.4 C67 36.4 67.4 38.6 67 41 L65.6 44 C64.6 48 63.2 50.4 62 51 L39.2 51 C38 50.4 36.4 48 35 44 L33 41 C32.6 38.6 33 36.4 34.8 35.4 C37.2 34.2 41.6 33.6 45.6 33Z" fill={KIT.dressLight} opacity="0.16" />
        <path d="M45.6 33 C47.8 35 53.4 35 55.6 33" stroke={KIT.dressLight} strokeWidth="0.45" fill="none" opacity="0.45" />
        {/* The necklace: a fine silver chain and a small drop. */}
        <path d="M46.3 33.6 Q50.6 39.4 54.9 33.6" stroke={KIT.silver} strokeWidth="0.45" fill="none" />
        <circle cx="50.6" cy="36.9" r="0.85" fill={KIT.silver} />
        <circle cx="50.35" cy="36.65" r="0.3" fill="#ffffff" />

        {/* The bodice: a sweetheart neckline, princess seams, a basque point at the waist, lit from the left. */}
        <path d="M35.8 46.6 C37.8 44 41.2 42.6 44.6 43 C47.4 43.3 49.6 44.8 50.6 47.2 C51.6 44.8 53.8 43.3 56.6 43 C60 42.6 63.4 44 65.4 46.6 L63.6 48.2 C62.6 52 61.6 57 61.4 62 C61.5 66 61.8 69.4 62.2 72.4 L50.6 75.2 L39 72.4 C39.4 69.4 39.7 66 39.6 62 C39.4 57 38.4 52 37.2 48.2Z" fill={`url(#${id}-dressBody)`} />
        <path d="M35.8 46.6 C37.8 44 41.2 42.6 44.6 43 C47.4 43.3 49.6 44.8 50.6 47.2 C51.6 44.8 53.8 43.3 56.6 43 C60 42.6 63.4 44 65.4 46.6" stroke={KIT.dressDeep} strokeWidth="0.6" fill="none" opacity="0.5" />
        <path d="M41.4 52 C43.6 53.6 46.8 53.8 49.2 52.8 M52.2 52.8 C54.6 53.8 57.6 53.6 59.8 51.8" stroke={KIT.dressDeep} strokeWidth="0.45" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M41.6 50 C42.8 57 43 65 42.2 72.8 M59.6 50 C58.4 57 58.2 65 59 72.8" stroke={KIT.dressDeep} strokeWidth="0.45" fill="none" opacity="0.45" strokeLinecap="round" />
        <path d="M38.4 50 C39.6 56 40.4 64 40.4 71" stroke="#ffffff" strokeWidth="0.9" fill="none" opacity="0.2" strokeLinecap="round" />
        <path d="M63.2 50 C62.4 57 61.8 64 62 71.6" stroke={RIM} strokeWidth="0.5" fill="none" opacity="0.4" strokeLinecap="round" />
        {/* Rhinestones: lines fanning up from the waist, and along the neckline. */}
        <StoneLine x1={50.6} y1={74.4} x2={40.4} y2={47.4} at={[0.2, 0.42, 0.64, 0.86]} />
        <StoneLine x1={50.6} y1={74.4} x2={45.4} y2={45} at={[0.24, 0.48, 0.72, 0.94]} />
        <StoneLine x1={50.6} y1={74.4} x2={55.8} y2={45} at={[0.24, 0.48, 0.72, 0.94]} />
        <StoneLine x1={50.6} y1={74.4} x2={60.8} y2={47.4} at={[0.2, 0.42, 0.64, 0.86]} />
        {[
          [37, 45.6],
          [42.6, 43.1],
          [50.6, 46.6],
          [58.6, 43.1],
          [64.2, 45.6],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="0.55" fill={KIT.stone} />
        ))}
        <Sparkle x={42.6} y={43.1} s={0.7} />
        <Sparkle x={53.7} y={58.6} s={0.56} />
        <Sparkle x={45.4} y={64.4} s={0.49} />
        {/* Soft shade where the near arm meets the body. */}
        <ellipse cx={n(JOINT.frontArmX - 3.4)} cy="47" rx="2.4" ry="6.5" fill={aoFill(id)} />

        <Head
          id={id}
          look={VR}
          jaw="round"
          back={<path d="M38.8 24.4 C37.6 13.6 43 7.6 50.6 7.6 C58.4 7.6 63.6 13.4 62.6 24.2 L60.6 19 L40.6 19Z" fill={HAIR_SHADE} />}
          shade={<path d="M39.2 25.6 C40.2 21.4 41.8 18.6 44.2 17 C46.2 15.7 48.4 15.1 50.6 15.1 C53.2 15.1 55.8 15.8 58 17.4 C60 19 61.2 21.4 61.9 24.4 L62.4 12 L38.6 12Z" fill={VR.skinShade} opacity="0.45" />}
        >
          <Face
            id={id}
            look={VR}
            blush="#f08fa8"
            spec={{ eye: "almond", eyeSize: 1.06, brow: "soft", nose: "narrow", lips: "medium", mouth: "smile", lashes: true }}
          />
          {/* Hair: swept back off the forehead toward the bow, darker on the far side, strands and a shine across the crown. */}
          <path d={HAIR_CAP} fill={`url(#${id}-hair)`} />
          <path d="M58.6 9.6 C61.8 12.6 62.8 17.4 62 23.4 C61.4 21 60.6 19 59.4 17.6 C58.6 16.4 57.6 15.6 56.6 15 C58.2 13.6 58.8 11.6 58.6 9.6Z" fill={HAIR_SHADE} opacity="0.55" />
          {["M57.6 15.8 C55.4 11.6 49.4 9.6 43.4 11.6", "M53.4 14.2 C50.6 11 46 10.6 41.6 13.8", "M60.4 19.4 C59.4 13.4 52.6 9 45.8 9.6", "M47.6 14.6 C45.2 13.8 42.4 15.2 40.4 18.4"].map((d) => (
            <path key={d} d={d} stroke={VR.hairLight} strokeWidth="0.45" fill="none" opacity="0.7" strokeLinecap="round" />
          ))}
          {["M61.2 21.6 C61.4 15 57.2 10.4 51.6 9", "M55.6 14.8 C52.6 12.6 47.6 12.2 43 15"].map((d) => (
            <path key={d} d={d} stroke={HAIR_SHADE} strokeWidth="0.5" fill="none" opacity="0.6" strokeLinecap="round" />
          ))}
          <path d="M42.6 12.8 C45.6 9.8 49.6 8.6 54 9.2" stroke="#c49a74" strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round" strokeDasharray="3.4 0.8 2.6 1 4" />
          {/* The bow where the hair gathers: two loops with their folds, the knot, two short tails. */}
          <path d="M37.6 19.8 L35.2 24.8 L36.7 24.6 L37.8 23 Z M37.6 19.8 L39.6 24.4 L38.2 24.7 L37.4 22.9Z" fill={KIT.dressShade} />
          <ellipse cx="35.4" cy="17.4" rx="3.4" ry="2.2" fill={KIT.dressLight} transform="rotate(32 35.4 17.4)" />
          <ellipse cx="35.8" cy="21.6" rx="3.1" ry="2" fill={KIT.dress} transform="rotate(-28 35.8 21.6)" />
          <path d="M34.4 18.6 Q33 17.4 33.4 15.8 M36.4 21 Q34.6 21.6 33.6 22.8" stroke={KIT.dressDeep} strokeWidth="0.45" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M33.6 16.2 Q34.6 15 36 15.4" stroke="#ffffff" strokeWidth="0.45" fill="none" opacity="0.6" strokeLinecap="round" />
          <circle cx="37.6" cy="19.6" r="1.4" fill={KIT.dressShade} />
          <circle cx="37.2" cy="19.2" r="0.45" fill={KIT.dressLight} opacity="0.9" />
          {/* A small silver stud in the near ear. */}
          <circle cx="38.5" cy="30.7" r="0.75" fill={KIT.silver} />
          <circle cx="38.3" cy="30.5" r="0.28" fill="#ffffff" />
        </Head>
      </g>

      {/* The skirt, flared over both legs: a sheer chiffon layer, then the skirt with its folds, the hem scalloped and catching the light. */}
      <g className="v-skirt" style={BODY}>
        {/* The drape: in the kneel it swings forward over the lifted thigh, the waistband held where it is. */}
        <g className="v-drape" style={{ transformOrigin: "50.6px 73px" }}>
          <path d="M39 71.4 L50.6 73.4 L62.2 71.4 C64.8 78 69 88.4 75.8 100.2 Q70.8 103.4 66 101.2 Q61.2 104.8 56 102.2 Q50.6 105.6 45.2 102.2 Q40 104.8 35.2 101.2 Q30.4 103.4 25.4 100.2 C32.2 88.4 36.4 78 39 72Z" fill={KIT.dressLight} opacity="0.35" />
          <path d="M39 71.4 L50.6 73.4 L62.2 71.4 C64.6 78 68.6 88 74.6 98.6 Q70.4 101.6 66 99.4 Q61.4 103 56.2 100.4 Q50.8 103.6 45.4 100.4 Q40.2 103 35.4 99.4 Q30.8 101.6 26.6 98.6 C32.4 88 36.6 78 39 72Z" fill={`url(#${id}-dressBody)`} />
          <path d="M62.2 72 C64.6 78 68.6 88 74.6 98.6 Q70.4 101.6 66 99.4 Q61.4 103 56.2 100.4 L53.4 74.2Z" fill={KIT.dressShade} opacity="0.45" />
          <path d="M41.8 73 L46.4 74.1 L36.6 100.6 Q32 101.4 29 99.6Z" fill={KIT.dressLight} opacity="0.55" />
          <path d="M44.6 74.2 L36.8 100 M50.6 75 L50.6 102.4 M56.6 74.4 L62.8 101.2 M60.6 73.6 L69.6 99.6" stroke={KIT.dressDeep} strokeWidth="0.55" fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M26.6 98.6 Q30.8 101.6 35.4 99.4 Q40.2 103 45.4 100.4 Q50.8 103.6 56.2 100.4 Q61.4 103 66 99.4 Q70.4 101.6 74.6 98.6" stroke={KIT.dressLight} strokeWidth="0.6" fill="none" opacity="0.6" />
          <path d="M39 72 L50.6 74.8 L62.2 72 L62.6 74.4 L50.6 77.2 L38.6 74.4Z" fill={KIT.dressDeep} opacity="0.3" />
          <path d="M39 72.4 L50.6 75.2 L62.2 72.4" stroke={KIT.stone} strokeWidth="0.6" fill="none" strokeDasharray="0.1 1.2" strokeLinecap="round" />
          <path d="M63.2 74.4 C65.6 80.4 69.4 89 74.2 97.6" stroke={RIM} strokeWidth="0.5" fill="none" opacity="0.4" strokeLinecap="round" />
          {[
            [31, 95.8],
            [38.8, 94.4],
            [47, 97.4],
            [55.4, 95.6],
            [64.2, 97],
            [70.4, 95.2],
            [43.8, 86.2],
            [58.2, 85.6],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="0.5" fill={KIT.stone} />
          ))}
          <Sparkle x={38.8} y={94.4} s={0.56} />
          <Sparkle x={58.2} y={85.6} s={0.42} />
        </g>
      </g>

      {/* The near arm, over the skirt; it moves with the body. */}
      <g className="v-body v-front" style={BODY}>
        <Arm
          cls="v-arm v-arm-front"
          side="front"
          look={VR}
          id={id}
          w={BUILD}
          upper={<SleeveUpper x={JOINT.frontArmX} id={id} back={false} />}
          fore={<SleeveFore x={JOINT.frontArmX} id={id} back={false} />}
          hand={<Cuff x={JOINT.frontArmX} />}
        />
      </g>
    </svg>
  );
}
