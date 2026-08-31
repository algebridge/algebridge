import { BACKDROPS, getHouseArt } from "@/data/house-art";
import type { HousePalette } from "@/data/house-art";
import { FLOOR_TOP, HOUSE, HORIZON_Y, ROOM, SCENE_H, SCENE_W, YARD_TOP } from "@/lib/dollhouse";

interface DollhouseSceneProps {
  styleId: string;
  /** Whether the front of the house has been opened. */
  open: boolean;
  /** Crop, for places too small to carry the whole landscape. */
  frame?: "scene" | "house";
}

/** Tight on the building, in the aspect a shop card actually is. */
const HOUSE_FRAME = "60 140 1080 560";

/** The seam the front wall splits along when the house opens. */
const SPLIT = (HOUSE.left + HOUSE.right) / 2;
const ROOF_APEX = 154;
const EAVE = 34;

/**
 * The house, drawn flat.
 *
 * It is one picture with the interior underneath and the front wall on top,
 * so opening the house is two halves of that wall sliding apart, the same
 * gesture as a real dollhouse, and the reason nothing here needs a camera.
 * Inside and outside are the same view, which is what the turntable and the
 * panorama could never be: those were two places, and you travelled between
 * them.
 */
export function DollhouseScene({ styleId, open, frame = "scene" }: DollhouseSceneProps) {
  const art = getHouseArt(styleId);
  const p = art.palette;
  const r = art.room;
  const back = BACKDROPS[art.backdrop];
  const uid = `dh-${styleId}`;

  return (
    <svg
      viewBox={frame === "house" ? HOUSE_FRAME : `0 0 ${SCENE_W} ${SCENE_H}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={art.sky[0]} />
          <stop offset="100%" stopColor={art.sky[1]} />
        </linearGradient>
        {/* The only gradients in the scene are atmosphere: sky, and the wash
            that fades the far lawn into the horizon. Every surface is flat. */}
        <linearGradient id={`${uid}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={art.sky[1]} stopOpacity="0.55" />
          <stop offset="100%" stopColor={art.sky[1]} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-room`}>
          <rect x={ROOM.left} y={ROOM.ceiling} width={ROOM.right - ROOM.left} height={ROOM.floor - ROOM.ceiling} />
        </clipPath>
      </defs>

      {/* ── Sky and distance ───────────────────────────────────── */}
      <rect x="0" y="0" width={SCENE_W} height={HORIZON_Y + 2} fill={`url(#${uid}-sky)`} />
      <Sun uid={uid} kind={art.backdrop} />
      <path d={back.far} fill={art.far} />
      <path d={back.near} fill={art.near} />
      <rect x="0" y={HORIZON_Y - 90} width={SCENE_W} height="92" fill={`url(#${uid}-haze)`} />

      {/* ── Ground ─────────────────────────────────────────────── */}
      <rect x="0" y={HORIZON_Y} width={SCENE_W} height={YARD_TOP - HORIZON_Y + 2} fill={art.groundFar} />
      <rect x="0" y={YARD_TOP} width={SCENE_W} height={SCENE_H - YARD_TOP} fill={art.groundNear} />
      <rect x="0" y={YARD_TOP - 3} width={SCENE_W} height="3" fill={art.groundEdge} opacity="0.6" />
      <MidGround art={art} />
      <Path uid={uid} art={art} />

      <Clouds art={art} />

      {/* ── The house ──────────────────────────────────────────── */}
      {/* Its shadow on the lawn, flat and offset the way the light is. */}
      <ellipse
        cx={SCENE_W / 2 + 26}
        cy={HOUSE.base + 8}
        rx={(HOUSE.right - HOUSE.left) / 2 + 26}
        ry="17"
        fill="#1f2937"
        opacity="0.16"
      />

      {/* The shell stays whatever the front wall does, so an open house reads
          as a section through a building rather than a hole in one. */}
      <rect
        x={HOUSE.left}
        y={HOUSE.wallTop}
        width={HOUSE.right - HOUSE.left}
        height={HOUSE.base - HOUSE.wallTop}
        fill={p.wallShade}
      />
      <Interior uid={uid} room={r} palette={p} />
      <Roof art={art} uid={uid} />
      <FrontWall art={art} open={open} />
      <Extras art={art} styleId={styleId} open={open} />
    </svg>
  );
}

/* ── Sky furniture ─────────────────────────────────────────────── */

function Sun({ uid, kind }: { uid: string; kind: string }) {
  // The city keeps a hazy glow rather than a disc; a hard sun over a skyline
  // reads as a sticker.
  const soft = kind === "skyline";
  return (
    <g>
      <circle cx="196" cy="150" r={soft ? 150 : 118} fill="#ffffff" opacity={soft ? 0.5 : 0.34} />
      {!soft && <circle cx="196" cy="150" r="52" fill="#fff6d8" opacity="0.95" />}
      <title>{uid}</title>
    </g>
  );
}

function Clouds({ art }: { art: ReturnType<typeof getHouseArt> }) {
  // Two depths, moving at their own speeds. Both stop under
  // prefers-reduced-motion, which the keyframe class handles.
  return (
    <g>
      <g className="dh-cloud dh-cloud-far" opacity="0.55">
        <Cloud x="120" y="118" s="1" fill="#ffffff" />
        <Cloud x="720" y="86" s="0.8" fill="#ffffff" />
        <Cloud x="1320" y="124" s="0.92" fill="#ffffff" />
      </g>
      <g className="dh-cloud dh-cloud-near" opacity="0.82">
        <Cloud x="420" y="196" s="1.28" fill="#ffffff" />
        <Cloud x="1120" y="168" s="1.1" fill="#ffffff" />
        <Cloud x="1820" y="200" s="1.2" fill="#ffffff" />
      </g>
      <title>{art.backdrop}</title>
    </g>
  );
}

function Cloud({ x, y, s, fill }: { x: string; y: string; s: string; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="62" ry="26" fill={fill} />
      <ellipse cx="-38" cy="8" rx="40" ry="20" fill={fill} />
      <ellipse cx="34" cy="10" rx="46" ry="21" fill={fill} />
      <ellipse cx="-6" cy="-18" rx="34" ry="24" fill={fill} />
    </g>
  );
}

/**
 * The band between the horizon and the lawn.
 *
 * Without it the middle distance is a flat field of one colour, and the house
 * reads as a sticker on a swatch, which is the single thing that made the
 * old painted yard look pasted together. What goes here is set by the
 * backdrop, because a hedgerow on a beach is worse than nothing.
 */
function MidGround({ art }: { art: ReturnType<typeof getHouseArt> }) {
  const y = 556;

  if (art.backdrop === "sea") {
    // Dunes, drawn as overlapping humps in the sand's own shade.
    return (
      <g opacity="0.75">
        {[80, 250, 430, 960, 1120].map((x, i) => (
          <ellipse key={i} cx={x} cy={y + 26} rx={110 + i * 9} ry="34" fill={art.mid} />
        ))}
        {[150, 340, 1020].map((x, i) => (
          <g key={i} stroke={art.midLight} strokeWidth="3" strokeLinecap="round" opacity="0.9">
            <path d={`M${x} ${y + 16} q-9 -26 -21 -38`} fill="none" />
            <path d={`M${x} ${y + 16} q3 -30 0 -44`} fill="none" />
            <path d={`M${x} ${y + 16} q11 -25 25 -35`} fill="none" />
          </g>
        ))}
      </g>
    );
  }

  if (art.backdrop === "skyline") {
    // A low wall and lamp posts: the street the loft sits on.
    return (
      <g>
        <rect x="0" y={y} width={SCENE_W} height="26" fill={art.mid} />
        <rect x="0" y={y} width={SCENE_W} height="6" fill={art.midLight} />
        {[92, 288, 912, 1108].map((x, i) => (
          <g key={i}>
            <rect x={x} y={y - 92} width="7" height="92" fill={art.mid} />
            <rect x={x - 16} y={y - 100} width="39" height="12" rx="5" fill={art.mid} />
          </g>
        ))}
      </g>
    );
  }

  // Hedgerow and trees. The first pass drew these at half opacity in the
  // backdrop's own green, which put ghosts in the field rather than depth:
  // in flat art a shape either reads or it should not be drawn. They are now
  // a committed tone darker than the lawn, with trunks that are actually wood.
  return (
    <g>
      {[40, 132, 224, 316, 884, 976, 1068, 1160].map((x, i) => (
        <ellipse key={i} cx={x} cy={y + 14} rx="62" ry="27" fill={art.mid} />
      ))}
      <rect x="0" y={y + 12} width={SCENE_W} height="4" fill={art.mid} opacity="0.6" />
      {[
        { x: 146, r: 62 },
        { x: 1062, r: 54 },
      ].map((t, i) => (
        <g key={i}>
          <rect x={t.x - 10} y={y - t.r + 6} width="20" height={t.r + 16} fill="#7b5535" />
          <circle cx={t.x} cy={y - t.r - 12} r={t.r} fill={art.mid} />
          <circle cx={t.x - t.r * 0.44} cy={y - t.r + 14} r={t.r * 0.6} fill={art.mid} />
          <circle cx={t.x + t.r * 0.46} cy={y - t.r + 10} r={t.r * 0.56} fill={art.mid} />
          <circle cx={t.x + t.r * 0.26} cy={y - t.r - 30} r={t.r * 0.52} fill={art.midLight} />
        </g>
      ))}
    </g>
  );
}

/** A path from the door to the front of the yard, so the house is arrived at. */
function Path({ uid, art }: { uid: string; art: ReturnType<typeof getHouseArt> }) {
  return (
    <g opacity="0.9">
      <path
        d={`M${SCENE_W / 2 - 46} ${HOUSE.base} L${SCENE_W / 2 + 46} ${HOUSE.base} L${SCENE_W / 2 + 86} ${SCENE_H} L${SCENE_W / 2 - 86} ${SCENE_H} Z`}
        fill={art.groundEdge}
        opacity="0.85"
      />
      <title>{uid}</title>
    </g>
  );
}

/* ── Inside ────────────────────────────────────────────────────── */

function Interior({
  uid,
  room,
  palette,
}: {
  uid: string;
  room: ReturnType<typeof getHouseArt>["room"];
  palette: ReturnType<typeof getHouseArt>["palette"];
}) {
  const w = ROOM.right - ROOM.left;
  return (
    <g clipPath={`url(#${uid}-room)`}>
      {/* Back wall, then the floor it meets. */}
      <rect x={ROOM.left} y={ROOM.ceiling} width={w} height={FLOOR_TOP - ROOM.ceiling} fill={room.wall} />
      <rect x={ROOM.left} y={FLOOR_TOP - 46} width={w} height="46" fill={room.wallShade} opacity="0.55" />
      <rect x={ROOM.left} y={FLOOR_TOP} width={w} height={ROOM.floor - FLOOR_TOP} fill={room.floor} />

      {/* Floorboards run away from the viewer, which is what tells you the
          floor is a floor and not a wall of the same colour. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path
          key={i}
          d={`M${ROOM.left + (i * w) / 8} ${ROOM.floor} L${ROOM.left + w * 0.12 + (i * w * 0.76) / 8} ${FLOOR_TOP}`}
          stroke={room.floorShade}
          strokeWidth="2.5"
          opacity="0.55"
        />
      ))}
      <rect x={ROOM.left} y={FLOOR_TOP} width={w} height="5" fill={room.skirting} opacity="0.9" />
      <rect x={ROOM.left} y={FLOOR_TOP - 16} width={w} height="16" fill={room.skirting} />

      {/* A rug, so the middle of the floor is not a flat plain. */}
      <ellipse cx={ROOM.left + w / 2} cy={FLOOR_TOP + (ROOM.floor - FLOOR_TOP) * 0.62} rx={w * 0.29} ry="34" fill={room.rug} opacity="0.85" />
      <ellipse cx={ROOM.left + w / 2} cy={FLOOR_TOP + (ROOM.floor - FLOOR_TOP) * 0.62} rx={w * 0.22} ry="24" fill={room.rugShade} opacity="0.7" />

      {/* Back-wall dressing: a window that looks out, and a picture. */}
      <g>
        <rect x={ROOM.left + w * 0.62} y={ROOM.ceiling + 54} width="132" height="104" rx="4" fill={palette.frame} />
        <rect x={ROOM.left + w * 0.62 + 8} y={ROOM.ceiling + 62} width="116" height="88" fill={palette.glass} />
        <rect x={ROOM.left + w * 0.62 + 8} y={ROOM.ceiling + 62} width="116" height="44" fill={palette.glassShade} opacity="0.5" />
        <rect x={ROOM.left + w * 0.62 + 62} y={ROOM.ceiling + 62} width="6" height="88" fill={palette.frame} />
      </g>
      <g>
        <rect x={ROOM.left + w * 0.16} y={ROOM.ceiling + 62} width="96" height="72" rx="3" fill={palette.trim} />
        <rect x={ROOM.left + w * 0.16 + 7} y={ROOM.ceiling + 69} width="82" height="58" fill={room.rug} opacity="0.75" />
        <path
          d={`M${ROOM.left + w * 0.16 + 7} ${ROOM.ceiling + 127} L${ROOM.left + w * 0.16 + 34} ${ROOM.ceiling + 92} L${ROOM.left + w * 0.16 + 56} ${ROOM.ceiling + 112} L${ROOM.left + w * 0.16 + 78} ${ROOM.ceiling + 84} L${ROOM.left + w * 0.16 + 89} ${ROOM.ceiling + 127} Z`}
          fill={room.rugShade}
        />
      </g>
    </g>
  );
}

/* ── The front wall, in two halves ─────────────────────────────── */

function FrontWall({ art, open }: { art: ReturnType<typeof getHouseArt>; open: boolean }) {
  const p = art.palette;
  const w = HOUSE.right - HOUSE.left;
  const h = HOUSE.base - HOUSE.wallTop;

  return (
    <g>
      {[-1, 1].map((side) => {
        const isLeft = side === -1;
        const x = isLeft ? HOUSE.left : SPLIT;
        const half = w / 2;
        return (
          <g
            key={side}
            className="dh-shutter"
            style={{
              transform: open ? `translateX(${side * 190}px)` : "translateX(0px)",
              opacity: open ? 0 : 1,
            }}
          >
            <g clipPath="none">
              <rect x={x} y={HOUSE.wallTop} width={half} height={h} fill={p.wall} />
              <rect x={x} y={HOUSE.wallTop} width={half} height="13" fill={p.wallShade} opacity="0.6" />
              {/* Light from the upper left, so the right half carries the shade. */}
              {!isLeft && <rect x={x} y={HOUSE.wallTop} width={half} height={h} fill={p.wallShade} opacity="0.35" />}

              {/* Courses. Repetition is where the detail lives in flat art. */}
              {Array.from({ length: 11 }, (_, i) => (
                <rect
                  key={i}
                  x={x}
                  y={HOUSE.wallTop + 14 + i * 31}
                  width={half}
                  height="2"
                  fill={p.course}
                  opacity="0.5"
                />
              ))}

              {/* Two windows on each half, mirrored about the seam so the
                  pairs sit the same distance from the door. */}
              <Window p={p} x={winX(isLeft, x, half, 92)} y={HOUSE.wallTop + 48} w="92" h="98" />
              <Window p={p} x={winX(isLeft, x, half, 92)} y={HOUSE.wallTop + 196} w="92" h="86" />

              {/* Half a door each, meeting at the seam, so opening the house
                  splits the door, which is the whole point of the gesture. */}
              <rect
                x={isLeft ? SPLIT - 46 : SPLIT}
                y={HOUSE.base - 156}
                width="46"
                height="156"
                fill={p.door}
              />
              {!isLeft && <rect x={SPLIT} y={HOUSE.base - 156} width="46" height="156" fill={p.doorShade} opacity="0.4" />}
              <rect x={isLeft ? SPLIT - 52 : SPLIT + 46} y={HOUSE.base - 164} width="6" height="164" fill={p.trim} />
              <rect x={isLeft ? SPLIT - 52 : SPLIT} y={HOUSE.base - 170} width="52" height="8" fill={p.trim} />
              {isLeft && <circle cx={SPLIT - 14} cy={HOUSE.base - 74} r="5" fill={p.accent} />}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Mirrored about the seam: 22% in from whichever edge faces outward. */
function winX(isLeft: boolean, x: number, half: number, w: number): number {
  return isLeft ? x + half * 0.22 : x + half - half * 0.22 - w;
}

function Window({
  p,
  x,
  y,
  w,
  h,
}: {
  p: ReturnType<typeof getHouseArt>["palette"];
  x: number;
  y: number;
  w: string;
  h: string;
}) {
  const ww = Number(w);
  const hh = Number(h);
  return (
    <g>
      <rect x={x - 5} y={y - 5} width={ww + 10} height={hh + 10} rx="3" fill={p.frame} />
      <rect x={x} y={y} width={ww} height={hh} fill={p.glass} />
      {/* A flat highlight across the top half reads as glass without a gradient. */}
      <rect x={x} y={y} width={ww} height={hh / 2} fill={p.glassShade} opacity="0.55" />
      <rect x={x + ww / 2 - 3} y={y} width="6" height={hh} fill={p.frame} />
      <rect x={x} y={y + hh / 2 - 3} width={ww} height="6" fill={p.frame} />
      <rect x={x - 8} y={y + hh + 5} width={ww + 16} height="7" rx="2" fill={p.trim} />
    </g>
  );
}

/* ── Roofs ─────────────────────────────────────────────────────── */

function Roof({ art, uid }: { art: ReturnType<typeof getHouseArt>; uid: string }) {
  const p = art.palette;
  const L = HOUSE.left - EAVE;
  const R = HOUSE.right + EAVE;
  const T = HOUSE.wallTop;

  if (art.roof === "flat") {
    return (
      <g>
        <rect x={L} y={T - 30} width={R - L} height="30" fill={p.roof} />
        <rect x={L} y={T - 30} width={R - L} height="11" fill={p.roofShade} />
        <rect x={L + 22} y={T - 52} width={R - L - 44} height="22" fill={p.roofShade} opacity="0.75" />
        {/* A roof garden, because a flat roof with nothing on it reads unfinished. */}
        <circle cx={L + 76} cy={T - 62} r="17" fill="#5f8f57" />
        <circle cx={R - 88} cy={T - 60} r="14" fill="#6c9c62" />
        <rect x={SCENE_W / 2 - 44} y={T - 74} width="88" height="22" rx="4" fill={p.accent} opacity="0.9" />
      </g>
    );
  }

  if (art.roof === "turret") {
    return (
      <g>
        {/* Crenellations: the merlons are literal, so the wall reads as stone
            cut rather than a texture pretending to be. */}
        <rect x={L} y={T - 34} width={R - L} height="34" fill={p.wall} />
        <rect x={L} y={T - 34} width={R - L} height="12" fill={p.wallShade} opacity="0.6" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={L + 10 + i * 66} width="40" y={T - 60} height="26" fill={p.wall} />
        ))}
        {[L + 6, R - 82].map((tx, i) => (
          <g key={i}>
            <rect x={tx} y={T - 118} width="76" height={HOUSE.base - T + 118} fill={p.wall} />
            <rect x={tx + 50} y={T - 118} width="26" height={HOUSE.base - T + 118} fill={p.wallShade} opacity="0.45" />
            <path d={`M${tx - 12} ${T - 118} L${tx + 38} ${T - 214} L${tx + 88} ${T - 118} Z`} fill={p.roof} />
            <path d={`M${tx + 38} ${T - 214} L${tx + 88} ${T - 118} L${tx + 38} ${T - 118} Z`} fill={p.roofShade} />
            <rect x={tx + 22} y={T - 46} width="32" height="44" rx="16" fill={p.glass} />
          </g>
        ))}
        <rect x={SCENE_W / 2 - 5} y={T - 132} width="6" height="76" fill={p.trim} />
        <path d={`M${SCENE_W / 2 + 1} ${T - 132} L${SCENE_W / 2 + 74} ${T - 116} L${SCENE_W / 2 + 1} ${T - 100} Z`} fill={p.accent} />
        <title>{uid}</title>
      </g>
    );
  }

  const apex = art.roof === "thatch" ? ROOF_APEX + 44 : ROOF_APEX;
  const thick = art.roof === "thatch" ? 30 : art.roof === "canopy" ? 22 : 16;

  return (
    <g>
      {art.chimney && <Chimney p={p} apex={apex} />}
      <path d={`M${L} ${T} L${SCENE_W / 2} ${apex} L${R} ${T} Z`} fill={p.roof} />
      {/* The far slope is the shaded one, which is the only thing telling you
          this is a ridge and not a flat triangle. */}
      <path d={`M${SCENE_W / 2} ${apex} L${R} ${T} L${SCENE_W / 2} ${T} Z`} fill={p.roofShade} />
      {/* Courses parallel to the eaves. */}
      {Array.from({ length: 5 }, (_, i) => {
        const f = (i + 1) / 6;
        const y = apex + (T - apex) * f;
        const dx = ((R - L) / 2) * f;
        return (
          <path
            key={i}
            d={`M${SCENE_W / 2 - dx} ${y} L${SCENE_W / 2 + dx} ${y}`}
            stroke={p.roofShade}
            strokeWidth="3"
            opacity="0.45"
          />
        );
      })}
      <rect x={L - 10} y={T} width={R - L + 20} height={thick} rx={art.roof === "thatch" ? 14 : 3} fill={p.roofShade} />
      <rect x={L - 10} y={T} width={R - L + 20} height={thick / 2} rx="3" fill={p.roof} opacity="0.55" />

      {/* An attic light in the gable. */}
      <circle cx={SCENE_W / 2} cy={T - 62} r="30" fill={p.frame} />
      <circle cx={SCENE_W / 2} cy={T - 62} r="23" fill={p.glass} />
      <path d={`M${SCENE_W / 2 - 23} ${T - 62} a23 23 0 0 1 46 0 Z`} fill={p.glassShade} opacity="0.6" />
      <rect x={SCENE_W / 2 - 23} y={T - 64} width="46" height="4" fill={p.frame} />
      <rect x={SCENE_W / 2 - 2} y={T - 85} width="4" height="46" fill={p.frame} />

      <title>{uid}</title>
    </g>
  );
}

/**
 * A chimney has to break the roof line, which means it is drawn before the
 * roof and left to be covered, and it has to stand where the slope actually
 * is. Placed by eye against the wall instead, it floats in the sky beside the
 * roof, which is exactly what the first version of this did.
 */
function Chimney({ p, apex }: { p: HousePalette; apex: number }) {
  const x = HOUSE.right - 168;
  const w = 56;
  // Where the far slope passes under the middle of the stack.
  const slopeY = HOUSE.wallTop - ((HOUSE.right + EAVE - (x + w / 2)) / ((HOUSE.right + EAVE - HOUSE.left + EAVE) / 2)) * (HOUSE.wallTop - apex);
  return (
    <g>
      <rect x={x} y={slopeY - 78} width={w} height={HOUSE.wallTop - slopeY + 86} fill={p.wallShade} />
      <rect x={x + w - 18} y={slopeY - 78} width="18" height={HOUSE.wallTop - slopeY + 86} fill={p.course} opacity="0.6" />
      <rect x={x - 7} y={slopeY - 92} width={w + 14} height="16" rx="3" fill={p.trim} />
      <rect x={x} y={slopeY - 46} width={w} height="3" fill={p.course} opacity="0.8" />
      <rect x={x} y={slopeY - 20} width={w} height="3" fill={p.course} opacity="0.8" />
    </g>
  );
}

/* ── Per-house extras ──────────────────────────────────────────── */

function Extras({
  art,
  styleId,
  open,
}: {
  art: ReturnType<typeof getHouseArt>;
  styleId: string;
  open: boolean;
}) {
  const p = art.palette;

  if (styleId === "treehouse") {
    // The house keeps the shared footprint so a saved room survives a style
    // change; the tree goes around it rather than under it.
    return (
      <g>
        <g opacity={open ? 0.35 : 1} className="dh-shutter">
          <rect x={HOUSE.left - 96} y={HOUSE.wallTop + 40} width="54" height={HOUSE.base - HOUSE.wallTop - 40} fill="#8a5a34" />
          <rect x={HOUSE.right + 42} y={HOUSE.wallTop + 40} width="54" height={HOUSE.base - HOUSE.wallTop - 40} fill="#7a4e2c" />
        </g>
        <g>
          <rect x={HOUSE.left - 92} y={HOUSE.base - 200} width="46" height="9" fill="#a9713f" />
          <rect x={HOUSE.left - 92} y={HOUSE.base - 148} width="46" height="9" fill="#a9713f" />
          <rect x={HOUSE.left - 92} y={HOUSE.base - 96} width="46" height="9" fill="#a9713f" />
          <rect x={HOUSE.left - 92} y={HOUSE.base - 44} width="46" height="9" fill="#a9713f" />
        </g>
        <circle cx={HOUSE.left - 108} cy={ROOF_APEX + 56} r="86" fill="#4f7d5c" />
        <circle cx={HOUSE.right + 118} cy={ROOF_APEX + 34} r="98" fill="#456f52" />
        <circle cx={HOUSE.right + 46} cy={ROOF_APEX - 6} r="66" fill="#5b8c66" />
        <circle cx={HOUSE.left - 30} cy={ROOF_APEX + 4} r="58" fill="#548360" />
      </g>
    );
  }

  if (styleId === "beach") {
    return (
      <g>
        <rect x={HOUSE.left - 58} y={HOUSE.base - 26} width={HOUSE.right - HOUSE.left + 116} height="26" fill={p.wallShade} />
        <rect x={HOUSE.left - 58} y={HOUSE.base - 26} width={HOUSE.right - HOUSE.left + 116} height="8" fill={p.trim} opacity="0.8" />
        {/* A palm, leaning the way the light comes from. */}
        <path d={`M${HOUSE.right + 150} ${HOUSE.base} q22 -120 -8 -206`} stroke="#a97f4b" strokeWidth="17" fill="none" strokeLinecap="round" />
        {[-1, 1].map((s) => (
          <g key={s}>
            <path d={`M${HOUSE.right + 142} ${HOUSE.base - 206} q${s * 84} -46 ${s * 122} 16`} stroke="#4f9d6a" strokeWidth="20" fill="none" strokeLinecap="round" />
            <path d={`M${HOUSE.right + 142} ${HOUSE.base - 206} q${s * 62} -74 ${s * 60} -34`} stroke="#57ab74" strokeWidth="18" fill="none" strokeLinecap="round" />
          </g>
        ))}
        <circle cx={HOUSE.right + 142} cy={HOUSE.base - 208} r="12" fill={p.accent} />
      </g>
    );
  }

  if (styleId === "loft") {
    return (
      <g>
        <rect x={HOUSE.left - 44} y={HOUSE.base - 12} width={HOUSE.right - HOUSE.left + 88} height="12" fill="#9aa2ac" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={HOUSE.left - 30 + i * 92} y={HOUSE.base - 96} width="6" height="84" fill={p.frame} opacity="0.85" />
        ))}
        <rect x={HOUSE.left - 36} y={HOUSE.base - 100} width={HOUSE.right - HOUSE.left + 72} height="7" rx="3" fill={p.frame} />
      </g>
    );
  }

  if (styleId === "castle") {
    return (
      <g>
        <path d={`M${SCENE_W / 2 - 120} ${HOUSE.base} L${SCENE_W / 2 - 120} ${HOUSE.base - 22} L${SCENE_W / 2 + 120} ${HOUSE.base - 22} L${SCENE_W / 2 + 120} ${HOUSE.base} Z`} fill={p.wallShade} />
        {[HOUSE.left - 118, HOUSE.right + 62].map((x, i) => (
          <g key={i}>
            <rect x={x} y={HOUSE.base - 128} width="14" height="128" fill="#6b5a48" />
            <path d={`M${x + 14} ${HOUSE.base - 128} L${x + 96} ${HOUSE.base - 112} L${x + 14} ${HOUSE.base - 96} Z`} fill={p.roof} />
          </g>
        ))}
      </g>
    );
  }

  // Cottage: a flower bed under each front window and a low hedge.
  return (
    <g>
      {[HOUSE.left + 44, HOUSE.right - 116].map((x, i) => (
        <g key={i}>
          <rect x={x} y={HOUSE.base - 34} width="72" height="34" rx="6" fill="#8d6a45" />
          <circle cx={x + 16} cy={HOUSE.base - 38} r="11" fill="#e8657f" />
          <circle cx={x + 38} cy={HOUSE.base - 44} r="12" fill={p.accent} />
          <circle cx={x + 58} cy={HOUSE.base - 36} r="10" fill="#c65fa8" />
        </g>
      ))}
    </g>
  );
}
