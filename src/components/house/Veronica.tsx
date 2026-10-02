"use client";

import { useId } from "react";

/**
 * Veronica, the figure skater who lives in the backyard.
 *
 * Drawn from her photo: a deep magenta competition dress with rhinestone
 * lines on the bodice and sheer sleeves, a brown ponytail tied with a bow,
 * tan tights, white figure skates. Her own design, kept as it has always
 * been (round face, dot eyes, a smile, rosy cheeks); only the rendering is
 * richer: light from the upper left on every shape, a cool rim light on the
 * shadow side, soft shadows where things meet, sparkle on the stones.
 *
 * She is one SVG with her limbs in groups, so skating is CSS rotating the
 * groups about their joints (`.v-leg-*` at the hips, `.v-arm-*` at the
 * shoulders, `.v-body`, and `.v-skirt` for the skirt, which hangs over both
 * legs and moves with the body), with the stride's speed set from how fast
 * she is moving. Facing left is a mirror. The drawing is 100 wide and 160
 * tall, blades at the bottom. Every number is written out or plain
 * arithmetic, so the server and the browser draw the same picture.
 */

export type VeronicaPose = "idle" | "skate" | "spin";

const P = {
  skin: "#f4d5c0",
  skinShade: "#e1b79c",
  skinLight: "#fde8da",
  skinDeep: "#c99a7d",
  hair: "#6b4426",
  hairShade: "#4e2f18",
  hairLight: "#9a6a42",
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
  lip: "#c0264f",
  silver: "#cbd5e1",
  rim: "#eaf2ff",
};

/** A sparkle on a rhinestone: a small cross of light. */
function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x - 1.4 * s} ${y} L${x + 1.4 * s} ${y} M${x} ${y - 1.4 * s} L${x} ${y + 1.4 * s}`} stroke="#ffffff" strokeWidth="0.35" strokeLinecap="round" opacity="0.9" />;
}

/** A leg in tights from the hip at (x, 98), knee and calf shaped, to the skate. */
function Leg({ cls, x, id, back }: { cls: string; x: number; id: string; back: boolean }) {
  const X = (dx: number) => Math.round((x + dx) * 100) / 100;
  return (
    <g className={cls} style={{ transformOrigin: `${x}px 100px` }}>
      <path
        d={`M${X(-6)} 97 L${X(6)} 97 C${X(6.4)} 105 ${X(5.6)} 112 ${X(4.6)} 118 C${X(4.4)} 122 ${X(4.6)} 126 ${X(4)} 132 L${X(3.4)} 140 L${X(-3.4)} 140 L${X(-4.2)} 132 C${X(-5.2)} 126 ${X(-5.4)} 121 ${X(-4.8)} 118 C${X(-5.6)} 112 ${X(-6.4)} 105 ${X(-6)} 97Z`}
        fill={back ? `url(#${id}-tightsBack)` : `url(#${id}-tights)`}
      />
      {/* The knee catches the light; the shin runs light down the front. */}
      <ellipse cx={X(-0.2)} cy="118" rx="3.2" ry="2.6" fill={P.tightsLight} opacity={back ? 0.12 : 0.4} />
      <path d={`M${X(-1.2)} 121.6 Q${X(0.2)} 122.8 ${X(1.8)} 121.4`} stroke={P.tightsShade} strokeWidth="0.6" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d={`M${X(1)} 124 C${X(1)} 129 ${X(0.8)} 133 ${X(0.6)} 137`} stroke={P.tightsLight} strokeWidth="0.8" fill="none" opacity={back ? 0.15 : 0.45} strokeLinecap="round" />
      {!back && <path d={`M${X(5.4)} 103 C${X(5.2)} 110 ${X(4.6)} 116 ${X(4.3)} 121`} stroke={P.rim} strokeWidth="0.6" fill="none" opacity="0.6" strokeLinecap="round" />}
      <Skate x={x - 8} y={136} shade={back} id={id} />
    </g>
  );
}

/** An arm from the shoulder at (x, 62): sheer over the shoulder, magenta to the wrist, the hand bare. */
function Arm({ cls, x, id, back }: { cls: string; x: number; id: string; back: boolean }) {
  const X = (dx: number) => Math.round((x + dx) * 100) / 100;
  const sleeve = back ? P.dressShade : `url(#${id}-dress)`;
  return (
    <g className={cls} style={{ transformOrigin: `${x}px 62px` }}>
      {/* The shoulder, under the sheer fabric. */}
      <path d={`M${X(-5.8)} 66 C${X(-6.2)} 60.4 ${X(-3)} 57 ${X(0)} 57 C${X(3)} 57 ${X(6.2)} 60.4 ${X(5.8)} 66Z`} fill={back ? P.skinShade : `url(#${id}-skin)`} />
      <path d={`M${X(-5.8)} 66 C${X(-6.2)} 60.4 ${X(-3)} 57 ${X(0)} 57 C${X(3)} 57 ${X(6.2)} 60.4 ${X(5.8)} 66Z`} fill={P.dressLight} opacity="0.16" />
      {/* The sleeve, tapering to the wrist, a soft fold at the elbow. */}
      <path d={`M${X(-5.6)} 64.6 C${X(-2)} 63.2 ${X(2)} 63.2 ${X(5.6)} 64.6 C${X(5.8)} 72 ${X(5)} 80 ${X(4.4)} 86 C${X(4.2)} 90 ${X(4)} 93.6 ${X(3.8)} 96.6 C${X(1.4)} 97.6 ${X(-1.4)} 97.6 ${X(-3.8)} 96.6 C${X(-4.2)} 92 ${X(-4.8)} 86 ${X(-5.2)} 80 C${X(-5.8)} 74 ${X(-5.8)} 68 ${X(-5.6)} 64.6Z`} fill={sleeve} />
      <path d={`M${X(-5.4)} 64.8 C${X(-2)} 63.4 ${X(2)} 63.4 ${X(5.4)} 64.8`} stroke={P.stone} strokeWidth="0.7" fill="none" strokeDasharray="0.1 1.3" strokeLinecap="round" />
      <path d={`M${X(-3.4)} 80.4 Q${X(-0.4)} 82.4 ${X(2.8)} 80.2 M${X(-2.6)} 83 Q${X(0)} 84.4 ${X(2.2)} 82.8`} stroke={P.dressDeep} strokeWidth="0.55" fill="none" opacity={back ? 0.4 : 0.6} strokeLinecap="round" />
      {!back && <path d={`M${X(-4.6)} 68 C${X(-4.8)} 76 ${X(-4.2)} 86 ${X(-3.2)} 95`} stroke="#ffffff" strokeWidth="0.9" fill="none" opacity="0.18" strokeLinecap="round" />}
      {!back && <path d={`M${X(5.4)} 68 C${X(5.3)} 76 ${X(4.6)} 86 ${X(3.9)} 95`} stroke={P.rim} strokeWidth="0.6" fill="none" opacity="0.45" strokeLinecap="round" />}
      {/* The hand: the back of it, fingers together and curled a little, the thumb forward. */}
      <path d={`M${X(-3.4)} 96.2 C${X(-1.2)} 95.6 ${X(1.4)} 95.6 ${X(3.4)} 96.2 C${X(4.2)} 99 ${X(3.8)} 102.6 ${X(2.6)} 104.4 C${X(1.2)} 105.6 ${X(-1.2)} 105.6 ${X(-2.6)} 104.4 C${X(-3.8)} 102.6 ${X(-4.2)} 99 ${X(-3.4)} 96.2Z`} fill={back ? P.skinShade : `url(#${id}-skin)`} />
      <path d={`M${X(2.8)} 97.6 C${X(5)} 98.4 ${X(5.6)} 100.6 ${X(4.6)} 102.4 C${X(4)} 103.2 ${X(3.2)} 102.6 ${X(3.4)} 101.6 C${X(3.6)} 100.4 ${X(3.2)} 99.4 ${X(2.4)} 98.8Z`} fill={back ? P.skinDeep : P.skinShade} />
      <path d={`M${X(-1.4)} 101.2 L${X(-1.2)} 104.6 M${X(0.4)} 101.4 L${X(0.5)} 105 M${X(2)} 101.2 L${X(1.9)} 104.4`} stroke={P.skinDeep} strokeWidth="0.35" opacity="0.55" strokeLinecap="round" />
    </g>
  );
}

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
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stride = pose === "skate" && speed > 0.05 ? `${Math.max(0.28, 0.9 - speed * 0.6)}s` : undefined;
  return (
    <svg
      viewBox="0 0 100 160"
      className={`veronica veronica-${pose} ${stride ? "veronica-moving" : ""} ${className}`}
      style={{
        transform: facing === -1 ? "scaleX(-1)" : undefined,
        ["--stride" as string]: stride ?? "0s",
      }}
      aria-label="Veronica"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.skinLight} />
          <stop offset="0.45" stopColor={P.skin} />
          <stop offset="1" stopColor={P.skinShade} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.38" cy="0.36" r="0.72">
          <stop offset="0" stopColor={P.skinLight} />
          <stop offset="0.55" stopColor={P.skin} />
          <stop offset="1" stopColor={P.skinShade} />
        </radialGradient>
        <linearGradient id={`${id}-dress`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.dressLight} />
          <stop offset="0.45" stopColor={P.dress} />
          <stop offset="1" stopColor={P.dressShade} />
        </linearGradient>
        <linearGradient id={`${id}-tights`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.tightsLight} />
          <stop offset="0.45" stopColor={P.tights} />
          <stop offset="1" stopColor={P.tightsShade} />
        </linearGradient>
        <linearGradient id={`${id}-tightsBack`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.tights} />
          <stop offset="1" stopColor={P.skinDeep} />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.hairLight} />
          <stop offset="0.5" stopColor={P.hair} />
          <stop offset="1" stopColor={P.hairShade} />
        </linearGradient>
        <linearGradient id={`${id}-boot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor={P.boot} />
          <stop offset="1" stopColor={P.bootShade} />
        </linearGradient>
        <radialGradient id={`${id}-soft`}>
          <stop offset="0" stopColor="#5c2a1c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5c2a1c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-blush`}>
          <stop offset="0" stopColor="#f9a8d4" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f9a8d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-ice`}>
          <stop offset="0" stopColor="#0f172a" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#0f172a" stopOpacity="0.14" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Shadow on the ice. */}
      <ellipse cx="51" cy="155" rx="27" ry="4.6" fill={`url(#${id}-ice)`} />

      {/* Back leg, then the body, then the front leg, the skirt over both, and the near arm last. */}
      <Leg cls="v-leg v-leg-back" x={53} id={id} back />

      <g className="v-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Ponytail, behind her: the shade, the lit side, strands, and the tip. */}
        <path d="M40 34 Q20 46 24 78 Q27 86 33 82 Q29 60 44 44Z" fill={P.hairShade} />
        <path d="M40 34 Q26 48 28 72 Q31 64 44 44Z" fill={`url(#${id}-hair)`} />
        <path d="M38.6 37 Q27 49 27.4 68 M40.4 39 Q31 51 30.4 66 M37 40 Q25.6 54 26.6 76" stroke={P.hairLight} strokeWidth="0.55" fill="none" opacity="0.6" strokeLinecap="round" />
        <path d="M41 38.4 Q33 47 31.6 58" stroke={P.hairShade} strokeWidth="0.7" fill="none" opacity="0.6" strokeLinecap="round" />

        <Arm cls="v-arm v-arm-back" x={36} id={id} back />

        {/* Neck, in the chin's shadow. */}
        <path d="M46 44 L54 44 L54.4 56.6 L45.6 56.6Z" fill={P.skinShade} />
        <path d="M46 44 L54 44 L54 49.4 Q50 51.4 46 49.2Z" fill={P.skinDeep} opacity="0.55" />
        <path d="M47 51 L47.2 56" stroke={P.skinLight} strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />

        {/* Sheer top: skin shows through above the bodice, a fine edge at the neckline. */}
        <path d="M35 58 Q50 54 65 58 L66 68 L34 68Z" fill={`url(#${id}-skin)`} />
        <path d="M35 58 Q50 54 65 58 L66 68 L34 68Z" fill={P.dressLight} opacity="0.14" />
        <path d="M41.6 57.6 Q45.6 59.4 49 59 M51.4 59 Q55 59.6 58.6 57.8" stroke={P.skinDeep} strokeWidth="0.45" fill="none" opacity="0.45" strokeLinecap="round" />
        <path d="M35 58 Q50 54 65 58" stroke={P.dressLight} strokeWidth="0.6" fill="none" opacity="0.5" />

        {/* Bodice, sweetheart, shaded to the right, with the rhinestone lines fanning from the waist. */}
        <path d="M34 68 Q42 61 50 69 Q58 61 66 68 L64 94 L36 94Z" fill={`url(#${id}-dress)`} />
        <path d="M34 68 Q42 61 50 69 Q58 61 66 68" stroke={P.dressDeep} strokeWidth="0.8" fill="none" opacity="0.55" />
        <path d="M40.2 70 C41.6 78 41.8 86 40.6 93.6 M59.8 70 C58.4 78 58.2 86 59.4 93.6" stroke={P.dressDeep} strokeWidth="0.55" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M36 72 C36.6 80 36.8 87 36.4 93" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.2" strokeLinecap="round" />
        <path d="M65.2 70 C64.6 79 64.2 87 64 93.6" stroke={P.rim} strokeWidth="0.6" fill="none" opacity="0.45" strokeLinecap="round" />
        {[
          [50, 93, 38, 70],
          [50, 93, 44, 68],
          [50, 93, 56, 68],
          [50, 93, 62, 70],
        ].map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            {[0.25, 0.5, 0.75, 0.95].map((t) => (
              <circle key={t} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="1" fill={P.stone} />
            ))}
          </g>
        ))}
        {[36, 42, 50, 58, 64].map((x, i) => (
          <circle key={x} cx={x} cy={[67, 63, 68, 63, 67][i]} r="1.1" fill={P.stone} />
        ))}
        <Sparkle x={44} y={68} />
        <Sparkle x={56} y={86.5} s={0.8} />
        <Sparkle x={42} y={63} s={0.9} />
        {/* Necklace, round the base of her neck. */}
        <path d="M45.6 56 Q50 61 54.4 56" fill="none" stroke={P.silver} strokeWidth="1" />
        <path d="M46 56.6 Q47.6 58.4 49 58.9" fill="none" stroke="#ffffff" strokeWidth="0.4" opacity="0.8" />
        <circle cx="50" cy="60" r="1.4" fill={P.silver} />
        <circle cx="49.6" cy="59.6" r="0.5" fill="#ffffff" />


        {/* Head: the shade, then the lit face a touch up and to the left. */}
        <circle cx="50" cy="34" r="16" fill={P.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={`url(#${id}-face)`} />
        <path d="M61.4 25 A16 16 0 0 1 60 45" stroke={P.rim} strokeWidth="0.9" fill="none" opacity="0.2" strokeLinecap="round" />
        {/* The hair's soft shadow along the hairline. */}
        <ellipse cx="50.4" cy="27.4" rx="13.4" ry="3" fill={`url(#${id}-soft)`} opacity="0.6" />
        {/* Hair, swept back into the tail; a bow where it gathers. */}
        <path d="M34 32 Q36 14 51 15 Q66 16 66 32 Q59 25 50 27 Q41 28 34 36Z" fill={`url(#${id}-hair)`} />
        <path d="M51 15 Q66 16 66 32 Q60 26 52 26Z" fill={P.hairShade} />
        <path d="M58 18.4 Q48 18.6 38.4 27.6 M62.6 22 Q52 21 41 30 M54 16.4 Q44 17.6 36.6 25" stroke={P.hairLight} strokeWidth="0.6" fill="none" opacity="0.65" strokeLinecap="round" />
        <path d="M41.4 21 Q47 16.8 54.6 16.8" stroke="#c49a74" strokeWidth="1.8" fill="none" opacity="0.4" strokeLinecap="round" />
        <path d="M60.6 23.4 Q55.6 22.4 49.8 24" stroke={P.hairShade} strokeWidth="0.6" fill="none" opacity="0.6" strokeLinecap="round" />
        {/* The bow: two loops with their folds, the knot, two short tails. */}
        <path d="M39.5 32.5 L36.4 38.4 L38.4 38.2 L39.6 36.6Z M39.5 32.5 L42.4 37.8 L40.6 38.2 L39.8 36.4Z" fill={P.dressShade} />
        <ellipse cx="40" cy="35" rx="4.5" ry="3" fill={P.dressLight} transform="rotate(-30 40 35)" />
        <ellipse cx="38" cy="30" rx="4.5" ry="3" fill={P.dressLight} transform="rotate(35 38 30)" />
        <path d="M37 31.6 Q35.4 30 35.8 28.2 M41.6 34.4 Q42.6 36 41.6 37.2" stroke={P.dressShade} strokeWidth="0.6" fill="none" opacity="0.8" strokeLinecap="round" />
        <path d="M36.2 28.6 Q37.4 27.4 38.8 27.8" stroke="#ffffff" strokeWidth="0.5" fill="none" opacity="0.6" strokeLinecap="round" />
        <circle cx="39.5" cy="32.5" r="1.8" fill={P.dressShade} />
        <circle cx="39" cy="32" r="0.6" fill={P.dressLight} opacity="0.8" />
        {/* Face: dark eyes with a catch of light and a lash line, rosy cheeks, the smile. */}
        <circle cx="46" cy="35" r="2" fill={P.hairShade} />
        <circle cx="56" cy="35" r="2" fill={P.hairShade} />
        <circle cx="46" cy="35.2" r="1.15" fill="#1c0f08" />
        <circle cx="56" cy="35.2" r="1.15" fill="#1c0f08" />
        <circle cx="45.3" cy="34.2" r="0.6" fill="#ffffff" />
        <circle cx="55.3" cy="34.2" r="0.6" fill="#ffffff" />
        <path d="M43.6 34.2 Q45.6 32.2 48.2 33.6 M53.8 33.6 Q56.4 32.2 58.4 34.2" stroke="#2a160c" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M48.8 39.4 Q50.2 40.2 51.4 39.4" stroke={P.skinDeep} strokeWidth="0.6" fill="none" opacity="0.6" strokeLinecap="round" />
        <ellipse cx="43" cy="39" rx="3.4" ry="2.6" fill={`url(#${id}-blush)`} />
        <ellipse cx="59" cy="39" rx="3.2" ry="2.5" fill={`url(#${id}-blush)`} />
        <path d="M45 41.5 Q50 45 55 41.5 Q50 46.6 45 41.5Z" fill={P.lip} />
        <path d="M45 41.5 Q50 45 55 41.5" stroke={P.lip} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="35" cy="37" r="1.3" fill={P.silver} />
        <circle cx="34.6" cy="36.6" r="0.45" fill="#ffffff" />
      </g>

      <Leg cls="v-leg v-leg-front" x={47} id={id} back={false} />

      {/* Skirt, flared over both legs, folds falling from the waist, the hem catching the light. */}
      <g className="v-skirt" style={{ transformOrigin: "50px 100px" }}>
        <path d="M37 92 L63 92 L77 119 Q70 124 63 120 Q56 126 50 120 Q44 126 37 120 Q30 124 23 119Z" fill={`url(#${id}-dress)`} />
        <path d="M63 92 L77 119 Q70 124 63 120 Q56 126 50 120 L52 92Z" fill={P.dressShade} opacity="0.5" />
        <path d="M40 94 L47 94 L36 118 Q30 121 28 117Z" fill={P.dressLight} opacity="0.7" />
        <path d="M43 94 L37 120 M50 94 L50 120 M57 94 L63 120" stroke={P.dressDeep} strokeWidth="0.7" fill="none" opacity="0.45" strokeLinecap="round" />
        <path d="M23 119 Q30 124 37 120 Q44 126 50 120 Q56 126 63 120 Q70 124 77 119" stroke={P.dressLight} strokeWidth="0.7" fill="none" opacity="0.6" />
        <path d="M37 92 L63 92 L62.4 95 L37.6 95Z" fill={P.dressDeep} opacity="0.3" />
        <path d="M63.6 94 L76.4 118.6" stroke={P.rim} strokeWidth="0.6" fill="none" opacity="0.45" strokeLinecap="round" />
        {[30, 41, 55, 68].map((x, i) => (
          <circle key={x} cx={x} cy={[112, 116, 114, 111][i]} r="1.1" fill={P.stone} />
        ))}
        <Sparkle x={41} y={116} s={0.9} />
      </g>

      {/* The near arm, over the skirt; it moves with the body. */}
      <g className="v-body v-front" style={{ transformOrigin: "50px 100px" }}>
        <Arm cls="v-arm v-arm-front" x={64} id={id} back={false} />
      </g>
    </svg>
  );
}

/** A figure skate: white boot with crossed laces and a heel, the blade on its holder, the toe pick. */
function Skate({ x, y, shade = false, id }: { x: number; y: number; shade?: boolean; id: string }) {
  const boot = shade ? P.bootShade : `url(#${id}-boot)`;
  return (
    <g>
      <path d={`M${x + 2} ${y - 4} L${x + 14} ${y - 4} L${x + 15} ${y + 2} Q${x + 22} ${y + 3} ${x + 26} ${y + 8} Q${x + 27} ${y + 13} ${x + 22} ${y + 13} L${x + 1} ${y + 13} Q${x - 1} ${y + 13} ${x - 1} ${y + 10}Z`} fill={boot} />
      <path d={`M${x + 15} ${y + 2} Q${x + 22} ${y + 3} ${x + 26} ${y + 8} Q${x + 27} ${y + 13} ${x + 22} ${y + 13} L${x + 12} ${y + 13}Z`} fill={shade ? "#c4c4c9" : P.bootShade} opacity="0.7" />
      {/* The padded collar, the crossed laces, the heel. */}
      <path d={`M${x + 2} ${y - 4} L${x + 14} ${y - 4} L${x + 14.1} ${y - 2.6} L${x + 1.8} ${y - 2.6}Z`} fill={shade ? "#babac0" : "#e4e4e7"} />
      <path d={`M${x + 5} ${y - 1} L${x + 11} ${y + 1.6} M${x + 11} ${y - 1} L${x + 5} ${y + 1.6} M${x + 5} ${y + 2.6} L${x + 11} ${y + 5.2} M${x + 11} ${y + 2.6} L${x + 5} ${y + 5.2} M${x + 12} ${y + 5.6} L${x + 16} ${y + 7.6}`} stroke={P.blade} strokeWidth="0.6" opacity="0.85" strokeLinecap="round" />
      <path d={`M${x - 1} ${y + 10} Q${x - 1} ${y + 13} ${x + 1} ${y + 13} L${x + 6} ${y + 13} L${x + 6} ${y + 9.6} Z`} fill={shade ? "#a1a1aa" : P.bootShade} />
      <path d={`M${x + 17} ${y + 4.4} Q${x + 21.6} ${y + 5} ${x + 24.4} ${y + 7.6}`} stroke="#ffffff" strokeWidth="0.8" fill="none" opacity={shade ? 0.2 : 0.9} strokeLinecap="round" />
      <path d={`M${x - 1} ${y + 12.4} L${x + 25} ${y + 12.4}`} stroke={shade ? "#a1a1aa" : P.bootShade} strokeWidth="0.6" />
      {/* The holder's two posts, the blade with its light edge, the toe pick. */}
      <path d={`M${x + 2} ${y + 13} L${x + 5} ${y + 13} L${x + 4.4} ${y + 14.2} L${x + 2.6} ${y + 14.2}Z M${x + 18} ${y + 13} L${x + 22} ${y + 13} L${x + 21.2} ${y + 14.2} L${x + 18.8} ${y + 14.2}Z`} fill={P.blade} />
      <rect x={x + 1} y={y + 14} width="25" height="2.4" rx="1" fill={P.blade} />
      <path d={`M${x + 1.6} ${y + 14.6} L${x + 25.2} ${y + 14.6}`} stroke={P.bladeLight} strokeWidth="0.5" opacity={shade ? 0.4 : 0.9} />
      <path d={`M${x + 26} ${y + 14} l2.5 -3 l0 3Z`} fill={P.blade} />
    </g>
  );
}
