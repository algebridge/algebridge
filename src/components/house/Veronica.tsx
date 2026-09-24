"use client";

import { Arm, Braid, Face, Head, JOINT, Leg, SkinDefs, limbFill, useArtId, type Look } from "@/components/games/figure";

/**
 * Veronica, the figure skater.
 *
 * Drawn from her photo: a deep magenta competition dress with rhinestone
 * lines on the bodice and sheer sleeves, a brown ponytail tied with a bow,
 * tan tights, white figure skates. Built from the same figure as the rest of
 * the team (see games/figure.tsx), so she stands in the same line-up.
 *
 * She is one SVG with her limbs in groups, so skating is CSS rotating the
 * groups about their joints, with the stride's speed set from how fast she
 * is moving. Facing left is a mirror. The drawing is 100 wide and 160 tall,
 * blades at the bottom.
 */

export type VeronicaPose = "idle" | "skate" | "spin";

const V: Look = {
  skin: "#f2d2bd",
  skinShade: "#dcb094",
  skinLight: "#fbe7d9",
  hair: "#6b4426",
  hairLight: "#8f5f36",
  iris: "#5b3b22",
  lip: "#b8365e",
  lipLight: "#d9647f",
};
const P = {
  dress: "#9d1560",
  dressShade: "#6e0c42",
  dressLight: "#c02f84",
  stone: "#fbe7f3",
  tights: "#e9c6a6",
  tightsShade: "#d3ac8a",
  boot: "#fafafa",
  bootShade: "#d4d4d8",
  blade: "#9aa3ad",
  silver: "#cbd5e1",
};

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
  const tights = { base: P.tights, shade: P.tightsShade };
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
      <SkinDefs id={id} look={V} />
      {/* Shadow on the ice. */}
      <ellipse cx="50" cy="155" rx="24" ry="4" fill="#0f172a" opacity="0.16" />

      {/* Back leg, then the body, then the front leg, so the stride overlaps right. */}
      <Leg cls="v-leg v-leg-back" side="back" look={V} id={id} tights={tights} shoe={<Skate x={JOINT.backLegX} shade />} />

      <g className="v-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Her hair pulled back low, the tail hanging behind her neck. */}
        <path d="M43 20 Q33 30 31 46 Q30 58 34.5 66 Q38 64 37.5 56 Q37 42 46 30Z" fill={V.hair} />
        <path d="M43 20 Q35 30 34 46 Q34 56 36 62 Q36 44 46 30Z" fill={V.hairLight} opacity="0.5" />

        {/* The illusion neckline: mesh you cannot see, so skin to the bodice, with a few stones on it. */}
        <path d="M36.6 51.6 C42 49.6 58 49.6 63.4 51.6 L65 61 L64.6 66 L35.4 66 L35 61Z" fill={limbFill(id)} />
        <Arm cls="v-arm v-arm-back" side="back" look={V} id={id} cuff={{ base: P.dressShade, shade: P.dressShade, from: 76 }} />
        {/* The bodice: a corset cut straight across, its lines of stones fanning up from the waist. */}
        <path d="M35.2 64.5 Q42.5 62.4 50 64.8 Q57.5 62.4 64.8 64.5 L64.4 92 L35.6 92Z" fill={P.dress} />
        <path d="M50 64.8 Q57.5 62.4 64.8 64.5 L64.4 92 L50 92Z" fill={P.dressShade} opacity="0.55" />
        {[
          [50, 91, 37.5, 66],
          [50, 91, 43.5, 65],
          [50, 91, 50, 65.5],
          [50, 91, 56.5, 65],
          [50, 91, 62.5, 66],
        ].map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            {[0.2, 0.4, 0.6, 0.8, 0.97].map((t) => (
              <circle key={t} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="1" fill={P.stone} />
            ))}
          </g>
        ))}
        {[36.5, 41, 45.5, 50, 54.5, 59, 63.5].map((x) => (
          <circle key={x} cx={x} cy={x === 50 ? 65.2 : 64.4} r="1.1" fill={P.stone} />
        ))}
        {[
          [41, 60],
          [59, 60],
          [44.5, 56.5],
          [55.5, 56.5],
          [38.5, 63],
          [61.5, 63],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.8" fill={P.stone} opacity="0.9" />
        ))}
        {/* A silver necklace at the collarbone. */}
        <path d="M44.8 51.6 Q50 57 55.2 51.6" fill="none" stroke={P.silver} strokeWidth="1.1" />
        <circle cx="50" cy="56.6" r="1.4" fill={P.silver} />

        <Arm cls="v-arm v-arm-front" side="front" look={V} id={id} cuff={{ base: P.dress, shade: P.dressShade, from: 76 }} />

        <Head id={id} look={V} jaw="long">
          {/* Hair smoothed back from her face to the low tail, a magenta scrunchie at the nape. */}
          <path d="M37.6 26 C37 12.6 43.6 8.6 50 8.6 C56.8 8.6 63.2 12.8 62.6 27 C61.2 18.6 55.8 15.2 50 15.4 C44.2 15.6 39.4 19.2 37.6 26Z" fill={V.hair} />
          <path d="M40.8 15.6 Q46 10.8 53.2 11" stroke={V.hairLight} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M54.8 11.6 Q59.6 13.8 61.6 19.4" stroke={V.hairLight} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d="M40.4 17.6 Q38.4 22 39.6 27.4 M60 17.2 Q62 21.4 61.2 26.2" stroke={V.hair} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
          <ellipse cx="36.8" cy="30.8" rx="3.3" ry="2.4" fill={P.dressLight} />
          <ellipse cx="36.8" cy="30.8" rx="1.5" ry="1" fill={P.dressShade} />
          <Face look={V} smile={0.95} blush="#f9a8d4" />
          <circle cx="63.1" cy="31.4" r="1.1" fill={P.silver} />
        </Head>
      </g>

      <Leg cls="v-leg v-leg-front" side="front" look={V} id={id} tights={tights} shoe={<Skate x={JOINT.frontLegX} />} />

      {/* The skirt, flared, over both legs; it moves with the body. */}
      <g className="v-skirt" style={{ transformOrigin: "50px 100px" }}>
        <path d="M36.4 90 L63.6 90 L77 118 Q70 123 63 119 Q56.5 125 50 119 Q43.5 125 37 119 Q30 123 23 118Z" fill={P.dress} />
        <path d="M63.6 90 L77 118 Q70 123 63 119 Q56.5 125 50 119 L51.5 90Z" fill={P.dressShade} opacity="0.7" />
        <path d="M40 92 L46.5 92 L36 117 Q30.6 120 28.8 116Z" fill={P.dressLight} opacity="0.8" />
        {[30, 41, 55, 68].map((x, i) => (
          <circle key={x} cx={x} cy={[111, 115, 113, 110][i]} r="1.1" fill={P.stone} />
        ))}
      </g>
    </svg>
  );
}

/** A figure skate: white boot laced up the ankle, and the blade with its toe pick. */
function Skate({ x, shade = false }: { x: number; shade?: boolean }) {
  const y = JOINT.ankleY;
  const boot = shade ? P.bootShade : P.boot;
  return (
    <g>
      <path d={`M${x - 5} ${y - 10} L${x + 5} ${y - 10} L${x + 5.4} ${y + 0.5} L${x - 5.4} ${y + 0.5}Z`} fill={boot} />
      <path
        d={`M${x - 5.2} ${y} L${x + 5.2} ${y} L${x + 6} ${y + 3.6} Q${x + 11.6} ${y + 3.7} ${x + 13.8} ${y + 7.4} L${x + 13.8} ${y + 9} L${x - 5.9} ${y + 9} Q${x - 6.5} ${y + 4} ${x - 5.2} ${y}Z`}
        fill={boot}
      />
      <path d={`M${x + 6} ${y + 3.6} Q${x + 11.6} ${y + 3.7} ${x + 13.8} ${y + 7.4} L${x + 13.8} ${y + 9} L${x + 3} ${y + 9}Z`} fill={shade ? "#c4c4c9" : P.bootShade} opacity="0.7" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x - 2.8} y={y - 8.4 + i * 2.7} width="5.6" height="1.05" rx="0.5" fill={P.blade} opacity="0.7" />
      ))}
      <rect x={x - 6} y={y + 9.6} width="20" height="2.3" rx="1" fill={P.blade} />
      <path d={`M${x + 14} ${y + 9.6} l2.4 -2.8 l0 2.8Z`} fill={P.blade} />
    </g>
  );
}
