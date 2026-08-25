import Image from "next/image";
import {
  SCENE_GROUND_Y,
  SCENE_H,
  SCENE_W,
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

/**
 * Birds, as a stepped walk along a rendered wingbeat sheet — see
 * scripts/gen-birds.ts. Each has a hard-coded altitude, speed and delay rather
 * than a random one, so server and browser agree on the markup, and each beats
 * at its own rate so a flock never pulses in unison.
 */
const BIRD_PATHS = [
  { top: 16, scale: 1, duration: 30, delay: 0, beat: 0.5 },
  { top: 23, scale: 0.72, duration: 41, delay: -11, beat: 0.58 },
  { top: 11, scale: 0.52, duration: 54, delay: -26, beat: 0.66 },
];

/** The critter, as a stepped walk along a rendered bound — gen-critters.ts. */
function Critter({ coat, top }: { coat: string; top: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className={`yard-critter${coat === "hare" ? "" : ` yard-critter-${coat}`}`}
        style={{ top: `${top}%`, animationDuration: "21s" }}
      >
        <span className="yard-critter-sprite" />
      </span>
    </div>
  );
}

function Birds({ dusk }: { dusk: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BIRD_PATHS.map((b, i) => (
        <span
          key={i}
          className={`yard-bird${dusk ? " yard-bird-dusk" : ""}`}
          style={{
            top: `${b.top}%`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        >
          <span
            className="yard-bird-sprite"
            style={{
              transform: `scale(${b.scale})`,
              transformOrigin: "left top",
              ["--beat" as string]: `${b.beat}s`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

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

/**
 * Cloud shadows crossing the ground.
 *
 * The sky had weather moving across it while the land underneath sat in
 * unchanging light, which is the tell that the ground is a photograph. These
 * drift at the same rate as the cloud band that casts them, are squashed flat
 * because a shadow on the ground is seen at a grazing angle, and are masked to
 * below the horizon so they darken land and never sky.
 */
const SHADOW_BLOBS = [
  { x: 110, y: 600, rx: 260, ry: 44, o: 0.16 },
  { x: 470, y: 660, rx: 200, ry: 34, o: 0.13 },
  { x: 830, y: 578, rx: 300, ry: 40, o: 0.15 },
  { x: 1120, y: 700, rx: 230, ry: 30, o: 0.11 },
];

function CloudShadows({ horizon }: { horizon: number }) {
  const mask = `linear-gradient(to bottom, transparent ${horizon * 100}%, #000 ${
    (horizon + 0.06) * 100
  }%)`;
  const band = (offset: number) => (
    <g transform={`translate(${offset} 0)`}>
      {SHADOW_BLOBS.map((b, i) => (
        <ellipse key={i} cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} fill="#0d2410" opacity={b.o} />
      ))}
    </g>
  );
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      aria-hidden
    >
      <g className="yard-drift" style={{ animationDuration: "92s", filter: "blur(26px)" }}>
        {band(0)}
        {band(SCENE_W)}
      </g>
    </svg>
  );
}

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

    </svg>
  );
}

export function YardBackdrop({ scene }: { scene: YardScene }) {
  return (
    <>
      <SkyLayer scene={scene} />
      <Birds dusk={scene.duskBirds} />

      {scene.image ? (
        /* A rendered heightfield. Its sky is transparent and distance fades to
           alpha, so the animated sky above shows through the far ground and the
           aerial perspective is the render's own rather than painted on. */
        <>
          <Image
            src={scene.image}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 900px) 100vw, 1200px"
          />
          <CloudShadows horizon={0.6} />
        </>
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
  const critter = <Critter coat={scene.critterCoat} top={scene.critterTop} />;

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
    <>
      <svg
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {scene.front.map((p, i) => (
          <Paint key={i} {...p} />
        ))}
      </svg>
      {critter}
      <svg
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {scene.near.map((p, i) => (
          <Paint key={i} {...p} />
        ))}
      </svg>
    </>
  );
}
