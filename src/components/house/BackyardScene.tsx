import { BACKDROPS, getHouseArt } from "@/data/house-art";
import { NightSky, nightWash } from "@/components/house/NightSky";
import { HORIZON_Y, SCENE_H, SCENE_W } from "@/lib/dollhouse";
import { BACK_HOUSE, BOARD, RINK } from "@/lib/rink";

/**
 * The backyard, drawn flat on the same plane as the front. The back of the
 * house stands at the top, two storeys like the front, a fence runs either
 * side of it, and the ice rink takes the lawn, boards with a red rail around
 * white ice. The same palette as the front, so it is the same house seen
 * from behind rather than a second house. At night the rink is lit from the
 * house and the moon.
 */
export function BackyardScene({ styleId, night = false }: { styleId: string; night?: boolean }) {
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
      {/* The band where the upstairs floor is. */}
      <rect x={H.left} y={H.wallTop + 138} width={H.right - H.left} height="8" fill={p.trim} opacity="0.55" />
      <path d={`M${H.left - eave} ${H.wallTop} L${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop}Z`} fill={p.roof} />
      <path d={`M${SCENE_W / 2} ${H.apex} L${H.right + eave} ${H.wallTop} L${SCENE_W / 2} ${H.wallTop}Z`} fill={p.roofShade} />
      <rect x={H.left - eave} y={H.wallTop - 6} width={H.right - H.left + eave * 2} height="12" fill={p.trim} />
      {/* Back door with a step. */}
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

      {/* A path from the back door to the rink. */}
      <path
        d={`M${SCENE_W / 2 - 34} ${H.base + 10} L${SCENE_W / 2 + 34} ${H.base + 10} L${SCENE_W / 2 + 48} ${RINK.cy - RINK.ry - 8} L${SCENE_W / 2 - 48} ${RINK.cy - RINK.ry - 8}Z`}
        fill={art.groundEdge}
        opacity="0.8"
      />

      {/* The rink: boards with a red rail, then the ice, then its lines. */}
      <ellipse cx={RINK.cx} cy={RINK.cy + 10} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#1f2937" opacity="0.14" />
      <ellipse cx={RINK.cx} cy={RINK.cy + 4} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#cbd5e1" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#f1f5f9" />
      <ellipse cx={RINK.cx} cy={RINK.cy - 3} rx={RINK.rx + BOARD} ry={RINK.ry + BOARD} fill="#dc2626" />
      <ellipse cx={RINK.cx} cy={RINK.cy - 3} rx={RINK.rx + 4} ry={RINK.ry + 4} fill="#f1f5f9" />
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx} ry={RINK.ry} fill="#dbe7f3" />
      <ellipse cx={RINK.cx} cy={RINK.cy - 2} rx={RINK.rx - 4} ry={RINK.ry - 4} fill="#f4f8fc" />
      {/* Hockey lines: the blue circle at centre and a red line across. */}
      <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx * 0.36} ry={RINK.ry * 0.36} fill="none" stroke="#3b82f6" strokeWidth="4" opacity="0.8" />
      <circle cx={RINK.cx} cy={RINK.cy} r="5" fill="#3b82f6" opacity="0.8" />
      <rect x={RINK.cx - 2} y={RINK.cy - RINK.ry + 8} width="4" height={RINK.ry * 2 - 16} fill="#dc2626" opacity="0.55" />
      <rect x={RINK.cx - RINK.rx * 0.55 - 2} y={RINK.cy - RINK.ry * 0.83} width="4" height={RINK.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      <rect x={RINK.cx + RINK.rx * 0.55 - 2} y={RINK.cy - RINK.ry * 0.83} width="4" height={RINK.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      {/* Skate marks and sheen: flat, the way ice catches the light. */}
      <path
        d={`M${RINK.cx - RINK.rx * 0.9} ${RINK.cy - 10} Q${RINK.cx} ${RINK.cy - RINK.ry * 0.9} ${RINK.cx + RINK.rx * 0.9} ${RINK.cy - 10} Q${RINK.cx} ${RINK.cy - RINK.ry * 0.55} ${RINK.cx - RINK.rx * 0.9} ${RINK.cy - 10}Z`}
        fill="#ffffff"
        opacity="0.55"
      />
      <path d={`M${RINK.cx - 260} ${RINK.cy + 40} q60 -30 130 -6`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d={`M${RINK.cx + 40} ${RINK.cy + 70} q80 -40 170 -20`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {night && (
        <>
          <rect x="0" y="0" width={SCENE_W} height={SCENE_H} fill={nightWash.fill} opacity={nightWash.opacity} style={{ mixBlendMode: "multiply" }} />
          {/* The ice keeps a glow of its own under the moon. */}
          <ellipse cx={RINK.cx} cy={RINK.cy} rx={RINK.rx} ry={RINK.ry} fill="#dbe7f3" opacity="0.35" />
          {[H.wallTop + 36, H.wallTop + 166].map((top, row) =>
            [H.left + 70, H.right - 160].map((x, i) => (
              <rect key={`${row}-${i}`} x={x} y={top + 5} width="90" height={row === 0 ? 72 : 80} fill="#fde68a" opacity="0.8" />
            ))
          )}
        </>
      )}
    </svg>
  );
}
