"use client";

/**
 * Veronica, who lives in the backyard and skates the rink.
 *
 * Drawn flat like everything else in the House: no outlines, two tones per
 * surface. She is one SVG with her limbs in groups, so skating is CSS
 * rotating the groups about their joints, with the stride's speed set from
 * how fast she is moving. Facing left is a mirror.
 *
 * The drawing is 100 wide and 160 tall, feet at the bottom.
 */

export type VeronicaPose = "idle" | "skate" | "spin";

const P = {
  skin: "#f1c3a0",
  skinShade: "#d9a380",
  hair: "#3b2418",
  hairShade: "#2a1810",
  beanie: "#f43f5e",
  beanieShade: "#be123c",
  pom: "#fff1f2",
  jacket: "#14b8a6",
  jacketShade: "#0f766e",
  zip: "#ccfbf1",
  leggings: "#1e293b",
  leggingsShade: "#0f172a",
  skate: "#f8fafc",
  skateShade: "#cbd5e1",
  wheel: "#f59e0b",
  wheelShade: "#b45309",
  lip: "#e11d48",
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
      {/* Shadow on the ground. */}
      <ellipse cx="50" cy="154" rx="26" ry="5" fill="#0f172a" opacity="0.18" />

      {/* Back leg, then the body, then the front leg, so the stride overlaps right. */}
      <g className="v-leg v-leg-back" style={{ transformOrigin: "52px 98px" }}>
        <rect x="46" y="96" width="14" height="42" rx="6" fill={P.leggingsShade} />
        <Skate x={44} y={136} shade />
      </g>

      <g className="v-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Ponytail behind the head. */}
        <path d="M34 44 Q18 58 26 84 Q30 88 34 82 Q30 62 42 52Z" fill={P.hairShade} />
        {/* Jacket. */}
        <path d="M32 62 Q32 52 50 52 Q68 52 68 62 L70 104 Q50 110 30 104Z" fill={P.jacket} />
        <path d="M60 54 Q68 54 68 62 L70 104 Q60 106 58 104Z" fill={P.jacketShade} />
        <rect x="48.5" y="58" width="3" height="42" rx="1.5" fill={P.zip} />
        {/* Arms: the back one pumps, the front one swings. */}
        <g className="v-arm v-arm-back" style={{ transformOrigin: "36px 66px" }}>
          <rect x="30" y="62" width="11" height="34" rx="5.5" fill={P.jacketShade} />
          <circle cx="35.5" cy="97" r="6" fill={P.skinShade} />
        </g>
        <g className="v-arm v-arm-front" style={{ transformOrigin: "64px 66px" }}>
          <rect x="59" y="62" width="11" height="34" rx="5.5" fill={P.jacket} />
          <circle cx="64.5" cy="97" r="6" fill={P.skin} />
        </g>
        {/* Head. */}
        <rect x="46" y="44" width="8" height="12" fill={P.skinShade} />
        <circle cx="50" cy="34" r="17" fill={P.skinShade} />
        <circle cx="48" cy="32.5" r="15.5" fill={P.skin} />
        <path d="M33 30 Q40 12 58 16 Q68 20 67 32 Q60 26 50 28 Q42 30 33 34Z" fill={P.hair} />
        <circle cx="45" cy="35" r="2.2" fill={P.leggings} />
        <circle cx="56" cy="35" r="2.2" fill={P.leggings} />
        <path d="M46 42 Q50 45 54 42" stroke={P.lip} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="42" cy="39" r="2.6" fill="#fda4af" opacity="0.7" />
        <circle cx="59" cy="39" r="2.6" fill="#fda4af" opacity="0.7" />
        {/* Beanie. */}
        <path d="M32 30 Q34 8 50 8 Q66 8 68 30 Q50 22 32 30Z" fill={P.beanie} />
        <path d="M50 8 Q66 8 68 30 Q60 26 52 26Z" fill={P.beanieShade} />
        <rect x="31" y="26" width="38" height="8" rx="4" fill={P.beanieShade} />
        <circle cx="50" cy="7" r="5" fill={P.pom} />
      </g>

      <g className="v-leg v-leg-front" style={{ transformOrigin: "48px 98px" }}>
        <rect x="40" y="96" width="14" height="42" rx="6" fill={P.leggings} />
        <Skate x={38} y={136} />
      </g>
    </svg>
  );
}

function Skate({ x, y, shade = false }: { x: number; y: number; shade?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width="24" height="12" rx="5" fill={shade ? P.skateShade : P.skate} />
      <rect x={x + 2} y={y + 12} width="20" height="3" rx="1.5" fill={P.skateShade} />
      <circle cx={x + 6} cy={y + 17} r="3.5" fill={shade ? P.wheelShade : P.wheel} />
      <circle cx={x + 18} cy={y + 17} r="3.5" fill={shade ? P.wheelShade : P.wheel} />
    </g>
  );
}
