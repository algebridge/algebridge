import Image from "next/image";
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
 * <YardForeground/> paints the terrain nearer than the house, which buries the
 * flat bottom edge of the sprite, plus the critter running across in front.
 *
 * Both are transparent SVGs filling the same box, so stacking backdrop, house,
 * foreground puts the building genuinely inside the landscape rather than on
 * top of a picture of one.
 *
 * Depth comes from four things a flat fill cannot do: every terrain band is a
 * gradient, the horizon washes toward a haze colour so distance desaturates,
 * cloud is shaded from lit top to shadowed base, and the nearest bank is blurred.
 *
 * If a scene has `image`, it is a real render and every vector layer is
 * skipped — only the sky animation and critter draw on top.
 */

const VIEW_BOX = `0 0 ${SCENE_W} ${SCENE_H}`;

function Paint({ d, fill, opacity, blur }: ScenePaint) {
  return (
    <path
      d={d}
      fill={fill}
      opacity={opacity}
      filter={blur ? `blur(${blur}px)` : undefined}
    />
  );
}

/**
 * A cloud, shaded rather than flat: a radial gradient lights the crown and
 * lets the underside fall into shadow, which is most of what separates a cloud
 * from a white blob.
 */
function Cloud({ x, y, s, grad }: { x: number; y: number; s: number; grad: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={`url(#${grad})`}>
      <ellipse cx={0} cy={12} rx={82} ry={24} />
      <circle cx={-38} cy={2} r={26} />
      <circle cx={-6} cy={-16} r={35} />
      <circle cx={30} cy={-6} r={27} />
      <circle cx={58} cy={6} r={19} />
    </g>
  );
}

/**
 * A drifting band of cloud. The band is drawn twice, one scene-width apart,
 * and slid exactly one scene-width — so the loop has no seam.
 */
function CloudBand({
  clouds,
  grad,
  opacity,
  duration,
  blur,
}: {
  clouds: { x: number; y: number; s: number }[];
  grad: string;
  opacity: number;
  duration: number;
  blur?: number;
}) {
  const band = (offset: number) => (
    <g transform={`translate(${offset} 0)`}>
      {clouds.map((c, i) => (
        <Cloud key={i} {...c} grad={grad} />
      ))}
    </g>
  );
  return (
    <g
      opacity={opacity}
      filter={blur ? `blur(${blur}px)` : undefined}
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
      <path d="M-26,0 q13,-17 26,-2 q13,-15 26,2 q-13,-7 -26,4 q-13,-11 -26,-4 Z" fill={fill} />
    </g>
  );
}

/**
 * Birds cross the sky on their own schedule. Each has a hard-coded delay and
 * altitude rather than a random one, so server and browser agree on the markup.
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

function Critter({ kind, body, accent }: { kind: CritterKind; body: string; accent: string }) {
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

/** Fine blade strokes so mid-ground grass is not one flat wash. */
function GrassTexture({ fill, opacity }: { fill: string; opacity: number }) {
  return (
    <g opacity={opacity} stroke={fill} strokeWidth={2} strokeLinecap="round" fill="none">
      {Array.from({ length: 90 }, (_, i) => {
        const x = ((i * 149) % 1196) + 2;
        const y = 546 + ((i * 37) % 150);
        const lean = ((i * 23) % 7) - 3;
        const len = 9 + ((i * 13) % 7);
        return <path key={i} d={`M${x},${y} q${lean},${-len / 2} ${lean * 2},${-len}`} />;
      })}
    </g>
  );
}

/** Terrain gradients, declared once per scene and referenced from both SVGs. */
function TerrainGrads({ scene }: { scene: YardScene }) {
  return (
    <>
      {scene.grads.map((g) => (
        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={g.from} />
          <stop offset="100%" stopColor={g.to} />
        </linearGradient>
      ))}
    </>
  );
}

/**
 * The pad's position on screen, derived from the renderer's own camera rather
 * than eyeballed: horizon 0.60, camera height 1.85, pad levelled to 0.14 at
 * depth 15.5, pitch 1.02. So 0.60 + ((1.85 - 0.14) / 15.5) * 1.02 = 0.7125.
 * Keep this in step with scripts/gen-yards.ts or the house floats.
 */
export const PAD_SCREEN_Y = 0.723;

/** Terrain fades in front of the house across this band, dissolving its base. */
const GROUND_MASK = `linear-gradient(to bottom, transparent ${
  (PAD_SCREEN_Y - 0.028) * 100
}%, rgba(0,0,0,0.55) ${PAD_SCREEN_Y * 100}%, #000 ${(PAD_SCREEN_Y + 0.05) * 100}%)`;

/** Sky, sun and weather. Always drawn, whether the ground is rendered or drawn. */
function SkyLayer({ scene }: { scene: YardScene }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          {scene.sky.map((c, i) => (
            <stop key={i} offset={`${(i / (scene.sky.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id="cloud" cx="42%" cy="26%" r="78%">
          <stop offset="0%" stopColor={scene.cloudTop} />
          <stop offset="62%" stopColor={scene.cloudTop} />
          <stop offset="100%" stopColor={scene.cloudBottom} />
        </radialGradient>
        {scene.orb && (
          <radialGradient id="glow">
            <stop offset="0%" stopColor={scene.orb.glow} stopOpacity="0.75" />
            <stop offset="45%" stopColor={scene.orb.glow} stopOpacity="0.22" />
            <stop offset="100%" stopColor={scene.orb.glow} stopOpacity="0" />
          </radialGradient>
        )}
        <TerrainGrads scene={scene} />
      </defs>

      <rect width={SCENE_W} height={SCENE_H} fill="url(#sky)" />

      {scene.orb && (
        <>
          <circle cx={scene.orb.cx} cy={scene.orb.cy} r={scene.orb.r * 4.2} fill="url(#glow)" />
          <circle cx={scene.orb.cx} cy={scene.orb.cy} r={scene.orb.r} fill={scene.orb.core} />
        </>
      )}

      {/* Far weather is smaller, paler and blurred; near weather is sharp. */}
      <CloudBand
        clouds={[
          { x: 130, y: 128, s: 0.6 },
          { x: 520, y: 96, s: 0.48 },
          { x: 880, y: 150, s: 0.56 },
        ]}
        grad="cloud"
        opacity={scene.cloudOpacity * 0.55}
        duration={150}
        blur={2}
      />
      <CloudBand
        clouds={[
          { x: 250, y: 214, s: 1 },
          { x: 720, y: 178, s: 0.86 },
          { x: 1040, y: 240, s: 0.94 },
        ]}
        grad="cloud"
        opacity={scene.cloudOpacity}
        duration={92}
      />

      <Birds fill={scene.birdFill} />
    </svg>
  );
}

export function YardBackdrop({ scene }: { scene: YardScene }) {
  return (
    <>
      <SkyLayer scene={scene} />

      {scene.image ? (
        /* A rendered heightfield. Its sky is transparent and distance fades to
           alpha, so the animated sky above shows through the far ground and the
           aerial perspective is the render's own rather than painted on. */
        <Image
          src={scene.image}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="(max-width: 900px) 100vw, 1200px"
        />
      ) : (
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset={`${scene.hazeTop * 100}%`} stopColor={scene.haze} stopOpacity="0" />
              <stop offset={`${(scene.hazeTop + 0.12) * 100}%`} stopColor={scene.haze} stopOpacity="0.3" />
              <stop offset={`${(scene.hazeTop + 0.22) * 100}%`} stopColor={scene.haze} stopOpacity="0" />
            </linearGradient>
          </defs>
          {scene.back.map((p, i) => (
            <Paint key={i} {...p} />
          ))}
          <rect width={SCENE_W} height={SCENE_H} fill="url(#haze)" />
          {scene.texture && <GrassTexture {...scene.texture} />}
        </svg>
      )}
    </>
  );
}

export function YardForeground({ scene }: { scene: YardScene }) {
  const critter = (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g className="yard-dash" style={{ animationDuration: "19s" }}>
        <g transform={`translate(0 ${SCENE_GROUND_Y + 122})`}>
          <g className="yard-hop">
            <Critter kind={scene.critter} body={scene.critterBody} accent={scene.critterAccent} />
          </g>
        </g>
      </g>
    </svg>
  );

  if (scene.image) {
    return (
      <>
        {/* The same render again, faded in across the pad, so real ground
            passes in front of the sprite's flat base. Because the occluder is
            the identical image there is no seam to hide. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ WebkitMaskImage: GROUND_MASK, maskImage: GROUND_MASK }}
        >
          <Image
            src={scene.image}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 900px) 100vw, 1200px"
          />
        </div>
        {critter}
      </>
    );
  }

  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {scene.front.map((p, i) => (
        <Paint key={i} {...p} />
      ))}
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
