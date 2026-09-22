import { BACKDROPS, getHouseArt } from "@/data/house-art";
import { HORIZON_Y, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import { BACK_HOUSE, BOARD, RINK } from "@/lib/rink";

/**
 * The backyard, drawn flat on the same plane as the front. The back of the
 * house stands at the top, a fence runs either side of it, and the rink
 * takes the lawn. The same palette as the front, so it is the same house
 * seen from behind rather than a second house.
 */
export function BackyardScene({ styleId }: { styleId: string }) {
  const art = getHouseArt(styleId);
  const p = art.palette;
  const back = BACKDROPS[art.backdrop];
  const uid = `by-${styleId}`;
  const H = BACK_HOUSE;
  const eave = 30;

  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={art.sky[0]} />
          <stop offset="100%" stopColor={art.sky[1]} />
        </linearGradient>
      </defs>

      {/* Sky and the same distance as out front. */}
      <rect x="0" y="0" width={SCENE_W} height={HORIZON_Y} fill={`url(#${uid}-sky)`} />
      <circle cx="1040" cy="120" r="104" fill="#ffffff" opacity="0.32" />
      <circle cx="1040" cy="120" r="46" fill="#fff6d8" opacity="0.95" />
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

      {/* The back of the house: shadow, wall, roof, a door and two windows. */}
      <ellipse cx={SCENE_W / 2 + 20} cy={H.base + 6} rx={(H.right - H.left) / 2 + 20} ry="14" fill="#1f2937" opacity="0.16" />
      <rect x={H.left} y={H.wallTop} width={H.right - H.left} height={H.base - H.wallTop} fill={p.wall} />
      <rect x={SCENE_W / 2} y={H.wallTop} width={(H.right - H.left) / 2} height={H.base - H.wallTop} fill={p.wallShade} opacity="0.35" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={H.left} y={H.wallTop + 14 + i * 31} width={H.right - H.left} height="2" fill={p.course} opacity="0.5" />
      ))}
      <path d={`M${H.left - eave} ${H.wallTop} L${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop}Z`} fill={p.roof} />
      <path d={`M${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop} L${SCENE_W / 2} ${H.wallTop}Z`} fill={p.roofShade} />
      <rect x={H.left - eave} y={H.wallTop - 6} width={H.right - H.left + eave * 2} height="12" fill={p.trim} />
      {/* Back door with a step. */}
      <rect x={SCENE_W / 2 - 40} y={H.base - 120} width="80" height="120" fill={p.door} />
      <rect x={SCENE_W / 2 + 4} y={H.base - 120} width="36" height="120" fill={p.doorShade} opacity="0.4" />
      <rect x={SCENE_W / 2 - 46} y={H.base - 126} width="92" height="7" fill={p.trim} />
      <circle cx={SCENE_W / 2 + 26} cy={H.base - 60} r="4" fill={p.accent} />
      <rect x={SCENE_W / 2 - 60} y={H.base - 4} width="120" height="14" rx="3" fill={p.wallShade} />
      {[H.left + 70, H.right - 160].map((x, i) => (
        <g key={i}>
          <rect x={x - 5} y={H.wallTop + 44} width="100" height="90" rx="3" fill={p.frame} />
          <rect x={x} y={H.wallTop + 49} width="90" height="80" fill={p.glass} />
          <rect x={x} y={H.wallTop + 49} width="90" height="40" fill={p.glassShade} opacity="0.55" />
          <rect x={x + 42} y={H.wallTop + 49} width="6" height="80" fill={p.frame} />
          <rect x={x} y={H.wallTop + 86} width="90" height="6" fill={p.frame} />
        </g>
      ))}

      {/* A path from the back door to the rink. */}
      <path
        d={`M${SCENE_W / 2 - 34} ${H.base + 10} L${SCENE_W / 2 + 34} ${H.base + 10} L${SCENE_W / 2 + 48} ${RINK.cy - RINK.ry - 8} L${SCENE_W / 2 - 48} ${RINK.cy - RINK.ry - 8}Z`}
        fill={art.groundEdge}
        opacity="0.8"
      />

      {/* The rink: boards, then the floor, then its markings. */}
      <ellipse cx={RINK.cx} cy={RINK.cy + 10} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#1f2937" opacity="0.14" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#94a3b8" />
      <ellipse cx={RINK.cx} cy={RINK.cy - 4} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#e2e8f0" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx} ry={RINK.ry} fill="#93c5fd" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx - 6} ry={RINK.ry - 6} fill="#bfdbfe" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx * 0.62} ry={RINK.ry * 0.62} fill="none" stroke="#93c5fd" strokeWidth="5" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx="40" ry="14" fill="#93c5fd" />
      <rect x={RINK.cx - 2.5} y={RINK.cy - RINK.ry + 6} width="5" height={RINK.ry * 2 - 12} fill="#93c5fd" opacity="0.7" />
      {/* Sheen: a flat lighter band, the way the floor catches the light. */}
      <path
        d={`M${RINK.cx - RINK.rx * 0.9} ${RINK.cy - 10} Q${RINK.cx} ${RINK.cy - RINK.ry * 0.9} ${RINK.cx + RINK.rx * 0.9} ${RINK.cy - 10} Q${RINK.cx} ${RINK.cy - RINK.ry * 0.55} ${RINK.cx - RINK.rx * 0.9} ${RINK.cy - 10}Z`}
        fill="#ffffff"
        opacity="0.35"
      />
    </svg>
  );
}
