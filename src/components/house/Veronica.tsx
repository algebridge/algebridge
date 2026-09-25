"use client";

/**
 * Veronica, the figure skater who lives in the backyard.
 *
 * Drawn from her photo: a deep magenta competition dress with rhinestone
 * lines on the bodice and sheer sleeves, a brown ponytail tied with a bow,
 * tan tights, white figure skates. Flat like everything else in the House:
 * no outlines, two tones per surface.
 *
 * She is one SVG with her limbs in groups, so skating is CSS rotating the
 * groups about their joints, with the stride's speed set from how fast she
 * is moving. Facing left is a mirror. The drawing is 100 wide and 160 tall,
 * blades at the bottom.
 */

export type VeronicaPose = "idle" | "skate" | "spin";

const P = {
  skin: "#f4d5c0",
  skinShade: "#e1b79c",
  hair: "#6b4426",
  hairShade: "#4e2f18",
  dress: "#a8186c",
  dressShade: "#7b0f4e",
  dressLight: "#c6338c",
  stone: "#fbe7f3",
  tights: "#e9c6a6",
  tightsShade: "#d3ac8a",
  boot: "#fafafa",
  bootShade: "#d4d4d8",
  blade: "#9aa3ad",
  lip: "#c0264f",
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
      {/* Shadow on the ice. */}
      <ellipse cx="50" cy="155" rx="24" ry="4" fill="#0f172a" opacity="0.16" />

      {/* Back leg, then the body, then the front leg, so the stride overlaps right. */}
      <g className="v-leg v-leg-back" style={{ transformOrigin: "53px 100px" }}>
        <rect x="47" y="98" width="12" height="42" rx="5" fill={P.tightsShade} />
        <Skate x={45} y={136} shade />
      </g>

      <g className="v-body" style={{ transformOrigin: "50px 100px" }}>
        {/* Ponytail, behind her. */}
        <path d="M40 34 Q20 46 24 78 Q27 86 33 82 Q29 60 44 44Z" fill={P.hairShade} />
        <path d="M40 34 Q26 48 28 72 Q31 64 44 44Z" fill={P.hair} />

        {/* Skirt, flared, the hem catching the light. */}
        <path d="M37 92 L63 92 L77 119 Q70 124 63 120 Q56 126 50 120 Q44 126 37 120 Q30 124 23 119Z" fill={P.dress} />
        <path d="M63 92 L77 119 Q70 124 63 120 Q56 126 50 120 L52 92Z" fill={P.dressShade} />
        <path d="M40 94 L47 94 L36 118 Q30 121 28 117Z" fill={P.dressLight} opacity="0.8" />
        {[30, 41, 55, 68].map((x, i) => (
          <circle key={x} cx={x} cy={[112, 116, 114, 111][i]} r="1.1" fill={P.stone} />
        ))}

        {/* Sheer top: skin shows through above the bodice. */}
        <path d="M35 58 Q50 54 65 58 L66 68 L34 68Z" fill={P.skin} />
        {/* Bodice, sweetheart, with the rhinestone lines fanning from the waist. */}
        <path d="M34 68 Q42 61 50 69 Q58 61 66 68 L64 94 L36 94Z" fill={P.dress} />
        <path d="M50 69 Q58 61 66 68 L64 94 L50 94Z" fill={P.dressShade} opacity="0.55" />
        {[
          [50, 93, 38, 70],
          [50, 93, 44, 68],
          [50, 93, 56, 68],
          [50, 93, 62, 70],
        ].map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            {[0.25, 0.5, 0.75, 0.95].map((t) => (
              <circle key={t} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="1.1" fill={P.stone} />
            ))}
          </g>
        ))}
        {[36, 42, 50, 58, 64].map((x, i) => (
          <circle key={x} cx={x} cy={[67, 63, 68, 63, 67][i]} r="1.2" fill={P.stone} />
        ))}
        {/* Necklace. */}
        <path d="M43 54 Q50 60 57 54" fill="none" stroke={P.silver} strokeWidth="1.2" />
        <circle cx="50" cy="59" r="1.4" fill={P.silver} />

        {/* Arms: sheer at the shoulder, magenta to the wrist, hands bare. */}
        <g className="v-arm v-arm-back" style={{ transformOrigin: "36px 62px" }}>
          <circle cx="36" cy="63" r="6" fill={P.skinShade} />
          <rect x="30.5" y="64" width="11" height="34" rx="5.5" fill={P.dressShade} />
          <circle cx="36" cy="99" r="5.5" fill={P.skinShade} />
        </g>
        <g className="v-arm v-arm-front" style={{ transformOrigin: "64px 62px" }}>
          <circle cx="64" cy="63" r="6" fill={P.skin} />
          <rect x="58.5" y="64" width="11" height="34" rx="5.5" fill={P.dress} />
          <circle cx="64" cy="99" r="5.5" fill={P.skin} />
        </g>

        {/* Neck and head. */}
        <rect x="46" y="44" width="8" height="12" fill={P.skinShade} />
        <circle cx="50" cy="34" r="16" fill={P.skinShade} />
        <circle cx="48.5" cy="32.8" r="14.6" fill={P.skin} />
        {/* Hair, swept back into the tail; a bow where it gathers. */}
        <path d="M34 32 Q36 14 51 15 Q66 16 66 32 Q59 25 50 27 Q41 28 34 36Z" fill={P.hair} />
        <path d="M51 15 Q66 16 66 32 Q60 26 52 26Z" fill={P.hairShade} />
        <ellipse cx="40" cy="35" rx="4.5" ry="3" fill={P.dressLight} transform="rotate(-30 40 35)" />
        <ellipse cx="38" cy="30" rx="4.5" ry="3" fill={P.dressLight} transform="rotate(35 38 30)" />
        <circle cx="39.5" cy="32.5" r="1.8" fill={P.dressShade} />
        {/* Face. */}
        <circle cx="46" cy="35" r="2" fill={P.hairShade} />
        <circle cx="56" cy="35" r="2" fill={P.hairShade} />
        <path d="M45 41.5 Q50 45 55 41.5" stroke={P.lip} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="43" cy="39" r="2.4" fill="#f9a8d4" opacity="0.6" />
        <circle cx="59" cy="39" r="2.4" fill="#f9a8d4" opacity="0.6" />
        <circle cx="35" cy="37" r="1.3" fill={P.silver} />
      </g>

      <g className="v-leg v-leg-front" style={{ transformOrigin: "47px 100px" }}>
        <rect x="41" y="98" width="12" height="42" rx="5" fill={P.tights} />
        <Skate x={39} y={136} />
      </g>
    </svg>
  );
}

/** A figure skate: white boot, laces, and the blade with its toe pick. */
function Skate({ x, y, shade = false }: { x: number; y: number; shade?: boolean }) {
  const boot = shade ? P.bootShade : P.boot;
  return (
    <g>
      <path d={`M${x + 2} ${y - 4} L${x + 14} ${y - 4} L${x + 15} ${y + 2} Q${x + 22} ${y + 3} ${x + 26} ${y + 8} Q${x + 27} ${y + 13} ${x + 22} ${y + 13} L${x + 1} ${y + 13} Q${x - 1} ${y + 13} ${x - 1} ${y + 10}Z`} fill={boot} />
      <path d={`M${x + 15} ${y + 2} Q${x + 22} ${y + 3} ${x + 26} ${y + 8} Q${x + 27} ${y + 13} ${x + 22} ${y + 13} L${x + 12} ${y + 13}Z`} fill={shade ? "#c4c4c9" : P.bootShade} opacity="0.7" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 4} y={y - 1 + i * 3.4} width="7" height="1.2" rx="0.6" fill={P.blade} opacity="0.7" />
      ))}
      <rect x={x + 1} y={y + 14} width="25" height="2.4" rx="1" fill={P.blade} />
      <path d={`M${x + 26} ${y + 14} l2.5 -3 l0 3Z`} fill={P.blade} />
    </g>
  );
}
