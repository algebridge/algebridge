import {
  SCENE_GROUND_Y,
  SCENE_H,
  SCENE_W,
  type CritterKind,
  type ScenePaint,
  type YardScene,
} from "@/data/yard-scenes";

/**
 * The yard, in two halves that the house sits between.
 *
 * <YardBackdrop/> paints sky, weather, distant land and the ground plane.
 * <YardForeground/> paints the terrain nearer than the house, which is what
 * buries the flat bottom edge of the sprite, plus the critter running across
 * in front of it.
 *
 * Both are transparent SVGs filling the same box, so stacking backdrop, house,
 * foreground puts the building genuinely inside the landscape rather than on
 * top of a picture of one.
 *
 * All motion is CSS transforms on groups, and every animation is disabled
 * under prefers-reduced-motion by the rules in globals.css.
 */

const VIEW_BOX = `0 0 ${SCENE_W} ${SCENE_H}`;

function Paint({ d, fill, stroke, opacity }: ScenePaint) {
  return (
    <path
      d={d}
      fill={fill}
      opacity={opacity}
      stroke={stroke}
      strokeWidth={stroke ? 3 : undefined}
      strokeLinejoin="round"
    />
  );
}

/** One puffy cloud, built from overlapping circles so it stays flat-shaded. */
function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={10} rx={78} ry={26} />
      <circle cx={-34} cy={2} r={26} />
      <circle cx={2} cy={-14} r={34} />
      <circle cx={40} cy={0} r={24} />
    </g>
  );
}

/**
 * A drifting band of cloud. The band is drawn twice, one scene-width apart,
 * and slid exactly one scene-width — so the loop has no seam.
 */
function CloudBand({
  clouds,
  fill,
  opacity,
  duration,
}: {
  clouds: { x: number; y: number; s: number }[];
  fill: string;
  opacity: number;
  duration: number;
}) {
  const band = (offset: number) => (
    <g transform={`translate(${offset} 0)`}>
      {clouds.map((c, i) => (
        <Cloud key={i} {...c} />
      ))}
    </g>
  );
  return (
    <g
      fill={fill}
      opacity={opacity}
      className="yard-drift"
      style={{ animationDuration: `${duration}s` }}
    >
      {band(0)}
      {band(SCENE_W)}
    </g>
  );
}

/** A gull shape whose wings flap by squashing vertically. */
function Bird({ scale, fill }: { scale: number; fill: string }) {
  return (
    <g transform={`scale(${scale})`} className="yard-flap">
      <path
        d="M-26,0 q13,-17 26,-2 q13,-15 26,2 q-13,-7 -26,4 q-13,-11 -26,-4 Z"
        fill={fill}
      />
    </g>
  );
}

/**
 * Birds cross the sky on their own schedule. Each is given a hard-coded delay
 * and altitude rather than a random one, so the server and the browser agree
 * on the markup.
 */
const BIRD_PATHS = [
  { y: 172, scale: 1.5, duration: 26, delay: 0 },
  { y: 224, scale: 1.05, duration: 34, delay: -9 },
  { y: 132, scale: 0.78, duration: 42, delay: -19 },
];

function Birds({ fill }: { fill: string }) {
  return (
    <>
      {BIRD_PATHS.map((b, i) => (
        <g
          key={i}
          className="yard-fly"
          style={{ animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}
        >
          <g transform={`translate(0 ${b.y})`}>
            <Bird scale={b.scale} fill={fill} />
          </g>
        </g>
      ))}
    </>
  );
}

/* ── Critters ───────────────────────────────────────────────────
   Three silhouettes, palette-swapped per scene. Each is drawn facing right
   around the origin, standing on y = 0, so the running group can place it on
   the ground without per-animal fudging. */

function Critter({
  kind,
  body,
  accent,
}: {
  kind: CritterKind;
  body: string;
  accent: string;
}) {
  const line = "#2E2118";
  if (kind === "hopper") {
    return (
      <g stroke={line} strokeWidth={3} strokeLinejoin="round">
        <ellipse cx={-16} cy={-6} rx={7} ry={5} fill={body} />
        <path d="M-2,-30 q-5,-22 4,-24 q7,3 3,25 Z" fill={body} />
        <path d="M8,-30 q-2,-23 8,-23 q6,4 -1,24 Z" fill={body} />
        <ellipse cx={0} cy={-14} rx={19} ry={14} fill={body} />
        <circle cx={16} cy={-22} r={11} fill={body} />
        <circle cx={21} cy={-24} r={2.4} fill={line} stroke="none" />
        <path d="M-8,-2 q4,6 10,0" fill="none" />
        <path d="M6,-2 q4,6 10,0" fill="none" />
        <ellipse cx={12} cy={-16} rx={4} ry={3} fill={accent} stroke="none" />
      </g>
    );
  }
  if (kind === "crab") {
    return (
      <g stroke={line} strokeWidth={3} strokeLinejoin="round">
        <path d="M-22,-8 l-9,-9 M-16,-6 l-8,4 M16,-6 l8,4 M22,-8 l9,-9" fill="none" />
        <ellipse cx={0} cy={-13} rx={22} ry={14} fill={body} />
        <path d="M-24,-22 q-11,-3 -12,7 q9,6 13,-1 Z" fill={body} />
        <path d="M24,-22 q11,-3 12,7 q-9,6 -13,-1 Z" fill={body} />
        <circle cx={-8} cy={-22} r={4.5} fill={accent} />
        <circle cx={8} cy={-22} r={4.5} fill={accent} />
        <circle cx={-8} cy={-22} r={2} fill={line} stroke="none" />
        <circle cx={8} cy={-22} r={2} fill={line} stroke="none" />
      </g>
    );
  }
  return (
    <g stroke={line} strokeWidth={3} strokeLinejoin="round">
      <path d="M-20,-16 q-18,-2 -20,-20 q12,4 20,8 Z" fill={body} />
      <ellipse cx={0} cy={-16} rx={22} ry={12} fill={body} />
      <path d="M-12,-6 q3,7 8,0 M4,-6 q3,7 8,0" fill="none" />
      <circle cx={20} cy={-24} r={11} fill={body} />
      <path d="M13,-32 l-2,-11 l10,6 Z" fill={body} />
      <path d="M27,-32 l3,-11 l7,8 Z" fill={body} />
      <circle cx={25} cy={-25} r={2.4} fill={line} stroke="none" />
      <ellipse cx={16} cy={-18} rx={5} ry={3} fill={accent} stroke="none" />
    </g>
  );
}

export function YardBackdrop({ scene }: { scene: YardScene }) {
  const id = "yard";
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.skyTop} />
          <stop offset="100%" stopColor={scene.skyBottom} />
        </linearGradient>
        {scene.orb && (
          <radialGradient id={`${id}-halo`}>
            <stop offset="0%" stopColor={scene.orb.halo} stopOpacity="0.85" />
            <stop offset="100%" stopColor={scene.orb.halo} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-sky)`} />

      {scene.orb && (
        <>
          <circle cx={scene.orb.cx} cy={scene.orb.cy} r={scene.orb.r * 2.6} fill={`url(#${id}-halo)`} />
          <circle cx={scene.orb.cx} cy={scene.orb.cy} r={scene.orb.r} fill={scene.orb.fill} />
        </>
      )}

      {/* Far weather drifts slowly, near weather faster — cheap parallax. */}
      <CloudBand
        clouds={[
          { x: 130, y: 128, s: 0.62 },
          { x: 520, y: 96, s: 0.5 },
          { x: 880, y: 150, s: 0.58 },
        ]}
        fill={scene.cloudFill}
        opacity={scene.cloudOpacity * 0.6}
        duration={150}
      />
      <CloudBand
        clouds={[
          { x: 250, y: 210, s: 1 },
          { x: 720, y: 176, s: 0.86 },
          { x: 1040, y: 236, s: 0.94 },
        ]}
        fill={scene.cloudFill}
        opacity={scene.cloudOpacity}
        duration={92}
      />

      <Birds fill={scene.birdFill} />

      {scene.back.map((p, i) => (
        <Paint key={i} {...p} />
      ))}
    </svg>
  );
}

export function YardForeground({ scene }: { scene: YardScene }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Terrain nearer than the house. The first band's uneven top edge is
          what crosses in front of the sprite's base. */}
      {scene.front.map((p, i) => (
        <Paint key={i} {...p} />
      ))}

      {/* The critter runs across the open ground, in front of the building but
          behind the nearest bank, so it passes into and out of cover. */}
      <g className="yard-dash" style={{ animationDuration: "19s" }}>
        <g transform={`translate(0 ${SCENE_GROUND_Y + 122})`}>
          <g className="yard-hop">
            <Critter kind={scene.critter} body={scene.critterBody} accent={scene.critterAccent} />
          </g>
        </g>
      </g>

      {scene.near.map((p, i) => (
        <Paint key={i} {...p} />
      ))}
    </svg>
  );
}
