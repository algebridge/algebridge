import { BACKDROPS, getHouseArt } from "@/data/house-art";
import { NightSky, nightWash } from "@/components/house/NightSky";
import { HORIZON_Y, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import type { Flower, GardenBed, GardenState } from "@/lib/garden";
import { BACK_HOUSE } from "@/lib/rink";

/**
 * The backyard: the back of the house at the top, a fence either side, and
 * a garden on the lawn that grows as the student learns. One raised bed
 * holds a plant for every unit of the course, each in its unit's colour,
 * coming up as the unit's skills are finished. A tree at the side grows with
 * the whole course: a swing at halfway, a birdhouse at three quarters, and a
 * treehouse when it is done. Answering something today waters the garden.
 *
 * Drawn flat like the front, in the same palette, so it is the same house
 * seen from behind.
 */
export function BackyardScene({ styleId, night = false, garden }: { styleId: string; night?: boolean; garden: GardenState }) {
  const art = getHouseArt(styleId);
  const p = art.palette;
  const back = BACKDROPS[art.backdrop];
  const uid = `by-${styleId}`;
  const H = BACK_HOUSE;
  const eave = 30;
  const glass = night ? "#fde68a" : p.glass;

  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? "#0b1020" : art.sky[0]} />
          <stop offset="100%" stopColor={night ? "#1e2a4a" : art.sky[1]} />
        </linearGradient>
      </defs>

      {/* Sky and the same distance as out front. */}
      <rect x="0" y="0" width={SCENE_W} height={HORIZON_Y} fill={`url(#${uid}-sky)`} />
      {night ? (
        <NightSky uid={uid} moon={{ x: 1040, y: 120 }} />
      ) : (
        <>
          <circle cx="1040" cy="120" r="104" fill="#ffffff" opacity="0.32" />
          <circle cx="1040" cy="120" r="46" fill="#fff6d8" opacity="0.95" />
        </>
      )}
      <path d={back.far} fill={art.far} />
      <path d={back.near} fill={art.near} />

      {/* Lawn. */}
      <rect x="0" y={HORIZON_Y - 40} width={SCENE_W} height={SCENE_H - HORIZON_Y + 40} fill={art.groundFar} />
      <rect x="0" y={H.base + 40} width={SCENE_W} height={SCENE_H - H.base - 40} fill={art.groundNear} />

      {/* Fence, either side of the house. */}
      {[0, 1].map((side) => {
        const x0 = side === 0 ? 0 : H.right + 12;
        const x1 = side === 0 ? H.left - 12 : SCENE_W;
        const n = Math.floor((x1 - x0) / 26);
        return (
          <g key={side}>
            <rect x={x0} y={H.base - 74} width={x1 - x0} height="8" fill="#b98b5a" />
            <rect x={x0} y={H.base - 30} width={x1 - x0} height="8" fill="#b98b5a" />
            {Array.from({ length: n }, (_, i) => (
              <g key={i}>
                <rect x={x0 + 4 + i * 26} y={H.base - 92} width="14" height="92" rx="2" fill="#d5a771" />
                <path d={`M${x0 + 4 + i * 26} ${H.base - 92} l7 -10 l7 10Z`} fill="#d5a771" />
                <rect x={x0 + 14 + i * 26} y={H.base - 92} width="4" height="92" fill="#b98b5a" />
              </g>
            ))}
          </g>
        );
      })}

      {/* The back of the house: shadow, wall, roof, a door and two rows of windows. */}
      <ellipse cx={SCENE_W / 2 + 20} cy={H.base + 6} rx={(H.right - H.left) / 2 + 20} ry="14" fill="#1f2937" opacity="0.16" />
      <rect x={H.left} y={H.wallTop} width={H.right - H.left} height={H.base - H.wallTop} fill={p.wall} />
      <rect x={SCENE_W / 2} y={H.wallTop} width={(H.right - H.left) / 2} height={H.base - H.wallTop} fill={p.wallShade} opacity="0.35" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={H.left} y={H.wallTop + 14 + i * 31} width={H.right - H.left} height="2" fill={p.course} opacity="0.5" />
      ))}
      <rect x={H.left} y={H.wallTop + 138} width={H.right - H.left} height="8" fill={p.trim} opacity="0.55" />
      <path d={`M${H.left - eave} ${H.wallTop} L${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop}Z`} fill={p.roof} />
      <path d={`M${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop} L${SCENE_W / 2} ${H.wallTop}Z`} fill={p.roofShade} />
      <rect x={H.left - eave} y={H.wallTop - 6} width={H.right - H.left + eave * 2} height="12" fill={p.trim} />
      <rect x={SCENE_W / 2 - 40} y={H.base - 120} width="80" height="120" fill={p.door} />
      <rect x={SCENE_W / 2 + 4} y={H.base - 120} width="36" height="120" fill={p.doorShade} opacity="0.4" />
      <rect x={SCENE_W / 2 - 46} y={H.base - 126} width="92" height="7" fill={p.trim} />
      <circle cx={SCENE_W / 2 + 26} cy={H.base - 60} r="4" fill={p.accent} />
      <rect x={SCENE_W / 2 - 60} y={H.base - 4} width="120" height="14" rx="3" fill={p.wallShade} />
      {[H.wallTop + 36, H.wallTop + 166].map((top, row) =>
        [H.left + 70, H.right - 160].map((x, i) => (
          <g key={`${row}-${i}`}>
            <rect x={x - 5} y={top} width="100" height={row === 0 ? 82 : 90} rx="3" fill={p.frame} />
            <rect x={x} y={top + 5} width="90" height={row === 0 ? 72 : 80} fill={glass} />
            {!night && <rect x={x} y={top + 5} width="90" height={row === 0 ? 36 : 40} fill={p.glassShade} opacity="0.55" />}
            <rect x={x + 42} y={top + 5} width="6" height={row === 0 ? 72 : 80} fill={p.frame} />
            <rect x={x} y={top + (row === 0 ? 38 : 42)} width="90" height="6" fill={p.frame} />
          </g>
        ))
      )}

      {/* Stepping stones from the back door down to the bed. */}
      {[
        [600, 428, 17],
        [609, 450, 19],
        [619, 474, 21],
        [628, 500, 23],
        [635, 528, 25],
      ].map(([x, y, r]) => (
        <g key={y}>
          <ellipse cx={x} cy={y + 3} rx={r} ry={r * 0.42} fill={art.groundEdge} />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill="#cbd5e1" />
          <ellipse cx={x - r * 0.2} cy={y - 1} rx={r * 0.55} ry={r * 0.2} fill="#e2e8f0" opacity="0.7" />
        </g>
      ))}

      <Tree garden={garden} night={night} />
      <Bed garden={garden} night={night} />

      {night && (
        <>
          <rect x="0" y="0" width={SCENE_W} height={SCENE_H} fill={nightWash.fill} opacity={nightWash.opacity} style={{ mixBlendMode: "multiply" }} />
          {[H.wallTop + 36, H.wallTop + 166].map((top, row) =>
            [H.left + 70, H.right - 160].map((x, i) => (
              <rect key={`${row}-${i}`} x={x} y={top + 5} width="90" height={row === 0 ? 72 : 80} fill="#fde68a" opacity="0.8" />
            ))
          )}
          <Fireflies />
        </>
      )}
    </svg>
  );
}

/* ── The bed ─────────────────────────────────────────────────────── */

const BED = { x0: 280, x1: 1090, y0: 566, y1: 700 } as const;
const SOIL = { base: "#5e4233", light: "#74553f", dark: "#4a3327" } as const;
const STONE = { base: "#a8a29e", light: "#c7c2bd", dark: "#78716c" } as const;
const LEAF = { base: "#3f9a4a", light: "#66c26f", dark: "#2f7a3a" } as const;

/** Where each unit's plant stands: the odd units in the back row, the even ones in front. */
function bedSpots(): { x: number; y: number; scale: number }[] {
  return Array.from({ length: 13 }, (_, i) => {
    const backRow = i % 2 === 0;
    const k = backRow ? i / 2 : (i - 1) / 2;
    return backRow ? { x: 338 + k * 115, y: 614, scale: 1.04 } : { x: 396 + k * 115, y: 670, scale: 1.2 };
  });
}

function Bed({ garden, night }: { garden: GardenState; night: boolean }) {
  const spots = bedSpots();
  const rx = 70;
  return (
    <g>
      {/* The raised bed: a stone border around dark soil. */}
      <rect x={BED.x0} y={BED.y0 + 10} width={BED.x1 - BED.x0} height={BED.y1 - BED.y0} rx={rx} fill="#1f2937" opacity="0.14" />
      <rect x={BED.x0} y={BED.y0 + 6} width={BED.x1 - BED.x0} height={BED.y1 - BED.y0} rx={rx} fill={STONE.dark} />
      <rect x={BED.x0} y={BED.y0} width={BED.x1 - BED.x0} height={BED.y1 - BED.y0} rx={rx} fill={STONE.base} />
      <rect x={BED.x0 + 4} y={BED.y0 + 2} width={BED.x1 - BED.x0 - 8} height="6" rx="3" fill={STONE.light} opacity="0.7" />
      <rect x={BED.x0 + 14} y={BED.y0 + 12} width={BED.x1 - BED.x0 - 28} height={BED.y1 - BED.y0 - 26} rx={rx - 12} fill={SOIL.base} />
      <rect x={BED.x0 + 14} y={BED.y0 + 12} width={BED.x1 - BED.x0 - 28} height="18" rx="9" fill={SOIL.light} opacity="0.6" />
      {/* Furrows across the soil. */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={BED.x0 + 40} y={BED.y0 + 44 + i * 30} width={BED.x1 - BED.x0 - 80} height="3" rx="1.5" fill={SOIL.dark} opacity="0.5" />
      ))}

      {/* A watering can leaning at the end of the bed. */}
      <g transform="translate(1058 636)">
        <rect x="-16" y="-20" width="30" height="26" rx="4" fill="#64748b" />
        <rect x="-16" y="-20" width="14" height="26" rx="4" fill="#94a3b8" opacity="0.5" />
        <path d="M-12 -20 Q-1 -34 10 -20" fill="none" stroke="#64748b" strokeWidth="4" />
        <path d="M14 -12 L34 -30" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
        <circle cx="35" cy="-31" r="5" fill="#64748b" />
      </g>

      {garden.watered && <Sprinkler />}

      {/* Back row first, so the front row stands in front. */}
      {garden.beds
        .map((bed, i) => ({ bed, spot: spots[i] }))
        .sort((a, b) => a.spot.y - b.spot.y)
        .map(({ bed, spot }) => (
          <Plant key={bed.unitId} bed={bed} x={spot.x} y={spot.y} scale={spot.scale} watered={garden.watered} night={night} />
        ))}
    </g>
  );
}

/** A sprinkler in the bed, on when the garden was watered today. */
function Sprinkler() {
  return (
    <g transform="translate(686 588)">
      <rect x="-3" y="-16" width="6" height="18" fill="#475569" />
      <rect x="-7" y="-19" width="14" height="5" rx="2" fill="#64748b" />
      {[-1, 0, 1].map((k) => (
        <path
          key={k}
          d={`M0 -18 Q${k * 34} -58 ${k * 66} -12`}
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="3"
          strokeLinecap="round"
          className="gd-spray"
          style={{ animationDelay: `${k * 0.35}s` }}
        />
      ))}
      {[
        [-52, -30],
        [-30, -48],
        [22, -50],
        [54, -34],
        [8, -56],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill="#bae6fd" className="gd-spray" />
      ))}
    </g>
  );
}

/* ── A plant ─────────────────────────────────────────────────────── */

function Plant({ bed, x, y, scale, watered, night }: { bed: GardenBed; x: number; y: number; scale: number; watered: boolean; night: boolean }) {
  const { stage, hue } = bed;
  const stemH = { seed: 0, sprout: 18, leaf: 34, bud: 46, bloom: 56 }[stage];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Its patch of soil, and the stake that says which unit it is. */}
      <ellipse cx="0" cy="0" rx="26" ry="7" fill={SOIL.dark} opacity="0.55" />
      <rect x="21" y="-32" width="3" height="32" fill="#a16207" />
      <rect x="11" y="-46" width="23" height="15" rx="3" fill={hue.solid} />
      <text x="22.5" y="-34.6" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={hue.onSolid} fontFamily="ui-sans-serif, system-ui">
        {bed.number}
      </text>

      {stage === "seed" ? (
        <ellipse cx="-2" cy="-3" rx="11" ry="4.5" fill={SOIL.light} />
      ) : (
        <g>
          <path d={`M0 0 Q-2 ${-stemH / 2} 0 ${-stemH}`} fill="none" stroke={LEAF.dark} strokeWidth="3" strokeLinecap="round" />
          <Leaves stemH={stemH} stage={stage} watered={watered} />
          {stage === "bud" && (
            <g transform={`translate(0 ${-stemH})`}>
              <ellipse cx="0" cy="-6" rx="5" ry="8" fill={hue.solid} />
              <path d="M-5 -3 Q0 4 5 -3 Q0 -1 -5 -3Z" fill={LEAF.dark} />
            </g>
          )}
          {stage === "bloom" && (
            <g transform={`translate(0 ${-stemH})`}>
              <Bloom flower={bed.flower} hue={hue} />
            </g>
          )}
          {stage === "bloom" && !night && (
            <g className="gd-flutter" style={{ animationDelay: `${(bed.number % 5) * -1.3}s` }}>
              <Butterfly x={16} y={-stemH - 30} color={hue.solid} dark={hue.deep} />
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function Leaves({ stemH, stage, watered }: { stemH: number; stage: GardenBed["stage"]; watered: boolean }) {
  const n = stage === "sprout" ? 2 : stage === "leaf" ? 4 : 5;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const yy = -stemH * ((i + 1) / (n + 1)) - 2;
        const left = i % 2 === 0;
        const s = 1 - i * 0.08;
        return (
          <g key={i} transform={`translate(0 ${yy}) rotate(${left ? -38 : 38}) scale(${s})`}>
            <ellipse cx={left ? -10 : 10} cy="0" rx="10" ry="4.6" fill={left ? LEAF.base : LEAF.light} />
            <path d={`M0 0 L${left ? -16 : 16} 0`} stroke={LEAF.dark} strokeWidth="0.8" opacity="0.6" />
            {watered && i === 0 && <circle cx={left ? -12 : 12} cy="-1.6" r="1.4" fill="#e0f2fe" opacity="0.9" />}
          </g>
        );
      })}
    </g>
  );
}

/** The flower on top, in the unit's colour. Drawn about (0,0), the top of the stem. */
function Bloom({ flower, hue }: { flower: Flower; hue: GardenBed["hue"] }) {
  const a = hue.solid;
  const d = hue.deep;
  switch (flower) {
    case "daisy":
      return (
        <g>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
            <ellipse key={r} cx="0" cy="-9" rx="3.6" ry="8" fill={r % 90 ? d : a} transform={`rotate(${r})`} />
          ))}
          <circle cx="0" cy="0" r="4.6" fill="#fbbf24" />
          <circle cx="-1.2" cy="-1.2" r="1.6" fill="#fde68a" />
        </g>
      );
    case "tulip":
      return (
        <g>
          <path d="M-8 2 Q-9 -14 0 -18 Q9 -14 8 2 Z" fill={a} />
          <path d="M0 -18 Q9 -14 8 2 L0 2Z" fill={d} opacity="0.55" />
          <path d="M-8 -6 L-4 -14 L0 -6 L4 -14 L8 -6" fill="none" stroke={d} strokeWidth="1.4" strokeLinejoin="round" opacity="0.8" />
        </g>
      );
    case "poppy":
      return (
        <g>
          {[
            [-6, -4],
            [6, -4],
            [-5, 4],
            [5, 4],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="6.8" fill={i % 2 ? d : a} />
          ))}
          <circle cx="0" cy="0" r="3.2" fill="#1c1917" />
        </g>
      );
    case "sunflower":
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-10" rx="2.6" ry="7.5" fill={i % 2 ? d : a} transform={`rotate(${i * 30})`} />
          ))}
          <circle cx="0" cy="0" r="6.4" fill="#7c2d12" />
          <circle cx="0" cy="0" r="3.8" fill="#9a3412" />
        </g>
      );
    case "bell":
      return (
        <g>
          {[
            [-9, -10],
            [0, -2],
            [9, -10],
          ].map(([cx, cy], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <path d="M-5 -6 Q-6 6 -7 8 L7 8 Q6 6 5 -6 Q0 -10 -5 -6Z" fill={i === 1 ? a : d} />
              <circle cx="0" cy="8" r="1.8" fill={hue.onSolid} opacity="0.7" />
            </g>
          ))}
        </g>
      );
    case "lavender":
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={(i % 2 ? 2.6 : -2.6) * (1 - i / 12)} cy={-i * 3.4} r={2.8 - i * 0.12} fill={i % 3 === 1 ? d : a} />
          ))}
        </g>
      );
    case "rose":
    default:
      return (
        <g>
          <circle cx="0" cy="-2" r="8.5" fill={d} />
          <circle cx="0" cy="-2" r="6" fill={a} />
          <path d="M-3 -4 Q1 -7 3 -3 Q3 1 -1 0 Q-3 -1 -2 -3" fill="none" stroke={d} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
  }
}

/** A butterfly in the flower's colour, wings beating. */
function Butterfly({ x, y, color, dark }: { x: number; y: number; color: string; dark: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.3)`}>
      <g className="gd-flap">
        <ellipse cx="-5.5" cy="-2" rx="5.5" ry="4" fill={color} />
        <ellipse cx="5.5" cy="-2" rx="5.5" ry="4" fill={color} />
        <ellipse cx="-4.5" cy="3" rx="3.6" ry="2.6" fill={dark} />
        <ellipse cx="4.5" cy="3" rx="3.6" ry="2.6" fill={dark} />
      </g>
      <rect x="-1" y="-5" width="2" height="10" rx="1" fill="#1c1917" />
    </g>
  );
}

/* ── The tree ────────────────────────────────────────────────────── */

const TREE = { x: 140, base: 690 } as const;

function Tree({ garden, night }: { garden: GardenState; night: boolean }) {
  const stage = garden.tree;
  const trunkH = [36, 74, 112, 148, 178, 200][stage];
  const crown = [20, 38, 56, 74, 90, 106][stage];
  const top = TREE.base - trunkH;
  const wide = [8, 12, 16, 20, 24, 28][stage];
  const green = { base: "#3f8f3f", light: "#5fb35f", dark: "#2c6f2c" };
  return (
    <g>
      <ellipse cx={TREE.x + 6} cy={TREE.base + 4} rx={wide * 2.4} ry="8" fill="#1f2937" opacity="0.16" />
      {/* Trunk, wider at the foot. */}
      <path d={`M${TREE.x - wide * 0.55} ${top + 10} L${TREE.x + wide * 0.55} ${top + 10} L${TREE.x + wide} ${TREE.base} L${TREE.x - wide} ${TREE.base}Z`} fill="#7c5a3a" />
      <path d={`M${TREE.x} ${top + 10} L${TREE.x + wide * 0.55} ${top + 10} L${TREE.x + wide} ${TREE.base} L${TREE.x} ${TREE.base}Z`} fill="#5c4028" opacity="0.6" />
      {stage >= 2 && <path d={`M${TREE.x + 4} ${top + 40} Q${TREE.x + 40} ${top + 26} ${TREE.x + 62} ${top + 12}`} fill="none" stroke="#7c5a3a" strokeWidth={wide * 0.4} strokeLinecap="round" />}
      {stage >= 3 && <path d={`M${TREE.x - 4} ${top + 52} Q${TREE.x - 36} ${top + 40} ${TREE.x - 56} ${top + 20}`} fill="none" stroke="#7c5a3a" strokeWidth={wide * 0.36} strokeLinecap="round" />}

      {garden.birdhouse && (
        <g transform={`translate(${TREE.x - wide - 2} ${TREE.base - 96})`}>
          <rect x="-16" y="-14" width="22" height="24" fill="#f5deb3" />
          <path d="M-19 -13 L-5 -26 L9 -13Z" fill="#b91c1c" />
          <circle cx="-5" cy="-3" r="3.6" fill="#1c1917" />
          <rect x="-8" y="6" width="6" height="2" fill="#a16207" />
        </g>
      )}

      {/* The crown: three rounds of leaves, lit from the upper left. */}
      <g>
        <circle cx={TREE.x + crown * 0.45} cy={top + crown * 0.15} r={crown * 0.78} fill={green.dark} />
        <circle cx={TREE.x - crown * 0.4} cy={top + crown * 0.1} r={crown * 0.8} fill={green.base} />
        <circle cx={TREE.x} cy={top - crown * 0.3} r={crown * 0.86} fill={green.base} />
        <circle cx={TREE.x - crown * 0.32} cy={top - crown * 0.5} r={crown * 0.5} fill={green.light} opacity="0.8" />
        {stage >= 4 &&
          [
            [-0.5, 0.3],
            [0.35, -0.55],
            [0.55, 0.4],
          ].map(([dx, dy]) => (
            <circle key={`${dx}-${dy}`} cx={TREE.x + crown * dx} cy={top + crown * dy} r={crown * 0.22} fill={green.light} opacity="0.45" />
          ))}
      </g>

      {garden.swing && (
        <g className="gd-swing" style={{ transformOrigin: `${TREE.x + 58}px ${top + 14}px` }}>
          <path d={`M${TREE.x + 50} ${top + 14} L${TREE.x + 50} ${TREE.base - 46} M${TREE.x + 66} ${top + 14} L${TREE.x + 66} ${TREE.base - 46}`} stroke="#d6c39a" strokeWidth="2.4" />
          <ellipse cx={TREE.x + 58} cy={TREE.base - 40} rx="15" ry="9" fill="#1f2937" />
          <ellipse cx={TREE.x + 58} cy={TREE.base - 40} rx="8" ry="4.6" fill={night ? "#0b1020" : "#4b5563"} />
        </g>
      )}

      {garden.treehouse && (
        <g transform={`translate(${TREE.x} ${top + 12})`}>
          {/* A wooden house in the branches, a ladder down, a flag on top. */}
          <rect x="-44" y="-30" width="88" height="54" fill="#b98b5a" />
          <rect x="-44" y="-30" width="44" height="54" fill="#d5a771" opacity="0.6" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="-44" y={-24 + i * 16} width="88" height="2" fill="#8b5a2b" opacity="0.6" />
          ))}
          <path d="M-52 -30 L0 -58 L52 -30Z" fill="#b91c1c" />
          <path d="M0 -58 L52 -30 L0 -30Z" fill="#7f1d1d" opacity="0.5" />
          <rect x="-30" y="-18" width="22" height="20" fill="#fde68a" />
          <rect x="-20" y="-18" width="3" height="20" fill="#8b5a2b" />
          <rect x="8" y="-12" width="22" height="36" fill="#5c4028" />
          <rect x="-50" y="24" width="100" height="6" fill="#8b5a2b" />
          {[-2, 2].map((k) => (
            <rect key={k} x={-4 + k * 3} y="30" width="2" height={TREE.base - top - 44} fill="#d6c39a" />
          ))}
          {Array.from({ length: Math.max(1, Math.floor((TREE.base - top - 50) / 16)) }, (_, i) => (
            <rect key={i} x="-12" y={36 + i * 16} width="24" height="3" rx="1.5" fill="#d6c39a" />
          ))}
          <rect x="-1" y="-84" width="2" height="26" fill="#334155" />
          <path d="M1 -84 L22 -78 L1 -72Z" fill="#facc15" />
        </g>
      )}
    </g>
  );
}

/** Fireflies over the garden at night, drifting and blinking. */
function Fireflies() {
  const spots: [number, number][] = [
    [360, 560],
    [470, 610],
    [590, 545],
    [700, 640],
    [820, 590],
    [940, 620],
    [1030, 560],
    [250, 640],
    [880, 530],
  ];
  return (
    <g>
      {spots.map(([x, y], i) => (
        <g key={i} className="gd-firefly" style={{ animationDelay: `${i * -0.7}s`, transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x} cy={y} r="7" fill="#fde047" opacity="0.25" />
          <circle cx={x} cy={y} r="2.4" fill="#fef08a" />
        </g>
      ))}
    </g>
  );
}
