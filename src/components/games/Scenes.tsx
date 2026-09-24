import { GOAL, NET_Y, type CourtGameId } from "@/lib/games";
import { BOARD, RINK } from "@/lib/rink";

/**
 * The four courts, drawn flat on the same 1200 × 800 plane as the House, in
 * its hand: no outlines, two tones per surface, detail from repetition. The
 * play areas in src/lib/games.ts sit on these surfaces.
 */

const W = 1200;
const H = 800;

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <title>{label}</title>
      {children}
    </svg>
  );
}

/** A crowd in rows: heads and shirts in team colors, placed by a fixed pattern so the server and the browser agree. */
function Crowd({ x0, x1, y0, rows, gap, size }: { x0: number; x1: number; y0: number; rows: number; gap: number; size: number }) {
  const shirts = ["#1d4ed8", "#facc15", "#ef4444", "#f8fafc", "#22c55e", "#7c3aed", "#f97316", "#0ea5e9"];
  const skins = ["#f1c7a5", "#b07a55", "#6f432a", "#8d5a3b", "#e0ac86", "#4b2d1c"];
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + r * gap;
    for (let x = x0 + (r % 2) * (size * 1.1); x < x1; x += size * 2.3) {
      const k = Math.round(x * 7 + r * 13);
      out.push(
        <g key={`${r}-${x}`}>
          <rect x={x - size * 0.9} y={y} width={size * 1.8} height={size * 1.6} rx={size * 0.6} fill={shirts[k % shirts.length]} />
          <circle cx={x} cy={y - size * 0.35} r={size * 0.7} fill={skins[(k >> 2) % skins.length]} />
        </g>
      );
    }
  }
  return <g>{out}</g>;
}

/* ── Shaurya: a school gym and a wrestling mat ───────────────────── */

export function WrestlingScene() {
  return (
    <Svg label="Wrestling mat">
      <rect x="0" y="0" width={W} height="385" fill="#ece4d4" />
      <rect x="0" y="300" width={W} height="85" fill="#ddd0b8" />
      <rect x="0" y="294" width={W} height="7" fill="#1d4ed8" />
      {/* Pennants on a line. */}
      <path d={`M0 38 Q${W / 2} 78 ${W} 38`} fill="none" stroke="#94a3b8" strokeWidth="2" />
      {Array.from({ length: 14 }, (_, i) => {
        const x = 30 + i * 82;
        const t = x / W;
        const y = 38 + 160 * t * (1 - t);
        return <path key={i} d={`M${x} ${y} L${x + 40} ${y + 2} L${x + 20} ${y + 42}Z`} fill={["#1d4ed8", "#facc15", "#dc2626"][i % 3]} />;
      })}
      {/* The team banner. */}
      <rect x="430" y="112" width="340" height="86" rx="8" fill="#1e3a8a" />
      <rect x="430" y="186" width="340" height="12" rx="4" fill="#172554" />
      <text x="600" y="156" textAnchor="middle" fontSize="36" fontWeight="800" fill="#facc15" fontFamily="ui-sans-serif, system-ui">ALGEBRIDGE</text>
      <text x="600" y="182" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="6" fill="#ffffff" fontFamily="ui-sans-serif, system-ui">WRESTLING</text>
      {/* Bleachers, with a few people. */}
      {[0, 1].map((side) => {
        const x0 = side ? 850 : 30;
        return (
          <g key={side}>
            {Array.from({ length: 4 }, (_, i) => (
              <g key={i}>
                <rect x={x0} y={236 + i * 36} width="320" height="14" fill="#b45309" />
                <rect x={x0} y={250 + i * 36} width="320" height="22" fill="#92400e" />
              </g>
            ))}
            <Crowd x0={x0 + 20} x1={x0 + 300} y0={214} rows={2} gap={36} size={11} />
          </g>
        );
      })}
      {/* Wood floor. */}
      <rect x="0" y="385" width={W} height={H - 385} fill="#d9a066" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x="0" y={398 + i * 26} width={W} height="2" fill="#c68a52" opacity="0.7" />
      ))}
      {/* The mat, the red circle, the starting lines. */}
      <path d="M130 405 L1070 405 L1195 795 L5 795Z" fill="#1e3a8a" />
      <path d="M130 405 L1070 405 L1074 418 L126 418Z" fill="#172554" />
      <ellipse cx="600" cy="592" rx="480" ry="188" fill="#dc2626" />
      <ellipse cx="600" cy="592" rx="462" ry="178" fill="#2563eb" />
      <ellipse cx="600" cy="600" rx="420" ry="150" fill="#1d4ed8" opacity="0.35" />
      <ellipse cx="600" cy="592" rx="78" ry="28" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.9" />
      <rect x="570" y="588" width="24" height="6" rx="2" fill="#22c55e" />
      <rect x="606" y="588" width="24" height="6" rx="2" fill="#ef4444" />
    </Svg>
  );
}

/* ── Jo: a stadium sideline and a cheer mat ──────────────────────── */

export function CheerScene() {
  return (
    <Svg label="Cheer mat">
      <defs>
        <linearGradient id="cheer-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height="200" fill="url(#cheer-sky)" />
      {/* Stadium lights. */}
      {[140, 1060].map((x) => (
        <g key={x}>
          <rect x={x - 5} y="40" width="10" height="130" fill="#64748b" />
          <rect x={x - 46} y="24" width="92" height="34" rx="4" fill="#334155" />
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={x - 36 + (i % 4) * 24} cy={34 + Math.floor(i / 4) * 14} r="6" fill="#fef9c3" />
          ))}
        </g>
      ))}
      {/* The stands, full. */}
      <path d="M0 150 L1200 150 L1200 400 L0 400Z" fill="#475569" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x="0" y={160 + i * 34} width={W} height="4" fill="#334155" />
      ))}
      <Crowd x0={10} x1={1195} y0={178} rows={7} gap={32} size={10} />
      <rect x="0" y="392" width={W} height="12" fill="#e2e8f0" />
      <rect x="400" y="352" width="400" height="44" rx="6" fill="#1d4ed8" />
      <text x="600" y="383" textAnchor="middle" fontSize="26" fontWeight="800" fill="#facc15" fontFamily="ui-sans-serif, system-ui">GO ALGEBRIDGE!</text>
      {/* Track, then turf with mowing stripes. */}
      <rect x="0" y="404" width={W} height="40" fill="#c2410c" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="0" y={414 + i * 11} width={W} height="1.6" fill="#fed7aa" opacity="0.8" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x="0" y={444 + i * 40} width={W} height="40" fill={i % 2 ? "#46a74f" : "#3f9b47"} />
      ))}
      <rect x="0" y="452" width={W} height="4" fill="#f8fafc" />
      {/* The cheer mat: panels, seams, a star in the middle. */}
      <path d="M190 480 L1010 480 L1150 795 L50 795Z" fill="#1e40af" />
      <path d="M190 480 L1010 480 L1016 492 L184 492Z" fill="#1e3a8a" />
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 1) / 8;
        return <path key={i} d={`M${190 + 820 * t} 480 L${50 + 1100 * t} 795`} stroke="#93c5fd" strokeWidth="2" opacity="0.35" />;
      })}
      {[560, 650, 740].map((y) => {
        const t = (y - 480) / 315;
        return <rect key={y} x={190 - 140 * t} y={y} width={820 + 280 * t} height="2" fill="#93c5fd" opacity="0.35" />;
      })}
      <ellipse cx="600" cy="640" rx="120" ry="44" fill="#facc15" opacity="0.9" />
      <ellipse cx="600" cy="640" rx="100" ry="34" fill="#1d4ed8" />
      <text x="600" y="652" textAnchor="middle" fontSize="36" fontWeight="900" fill="#facc15" fontFamily="ui-sans-serif, system-ui">A</text>
    </Svg>
  );
}

/* ── Jordyn: an indoor volleyball court ──────────────────────────── */

/** The near and far edges of the court, for the lines. */
const COURT = { farY: 350, nearY: 792, farL: 330, farR: 870, nearL: 80, nearR: 1120 };
function courtX(y: number, side: "l" | "r") {
  const t = (y - COURT.farY) / (COURT.nearY - COURT.farY);
  return side === "l" ? COURT.farL + (COURT.nearL - COURT.farL) * t : COURT.farR + (COURT.nearR - COURT.farR) * t;
}

export function VolleyballScene() {
  const line = (y: number) => <rect key={y} x={courtX(y, "l")} y={y - 2} width={courtX(y, "r") - courtX(y, "l")} height="4" fill="#ffffff" />;
  return (
    <Svg label="Volleyball court">
      <rect x="0" y="0" width={W} height="335" fill="#e2e8f0" />
      <rect x="0" y="280" width={W} height="55" fill="#cbd5e1" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <rect x={60 + i * 190} y="36" width="130" height="92" rx="4" fill="#94a3b8" />
          <rect x={66 + i * 190} y="42" width="118" height="80" fill="#bae6fd" />
          <rect x={66 + i * 190} y="42" width="118" height="30" fill="#e0f2fe" opacity="0.8" />
          <rect x={123 + i * 190} y="42" width="4" height="80" fill="#94a3b8" />
        </g>
      ))}
      {/* Scoreboard. */}
      <rect x="490" y="150" width="220" height="92" rx="8" fill="#111827" />
      <rect x="506" y="166" width="84" height="60" rx="4" fill="#0b1220" />
      <rect x="610" y="166" width="84" height="60" rx="4" fill="#0b1220" />
      <text x="548" y="211" textAnchor="middle" fontSize="42" fontWeight="800" fill="#f97316" fontFamily="ui-monospace, monospace">24</text>
      <text x="652" y="211" textAnchor="middle" fontSize="42" fontWeight="800" fill="#22c55e" fontFamily="ui-monospace, monospace">23</text>
      {/* Free zone, then the court and its lines. */}
      <rect x="0" y="335" width={W} height={H - 335} fill="#2563eb" />
      <path d={`M${COURT.farL} ${COURT.farY} L${COURT.farR} ${COURT.farY} L${COURT.nearR} ${COURT.nearY} L${COURT.nearL} ${COURT.nearY}Z`} fill="#f97316" />
      <path d={`M${COURT.farL} ${COURT.farY} L${COURT.farR} ${COURT.farY} L${COURT.nearR} ${COURT.nearY} L${COURT.nearL} ${COURT.nearY}Z`} fill="none" stroke="#ffffff" strokeWidth="5" />
      {line(NET_Y)}
      {line(470)}
      {line(640)}
      {/* The net: posts, antennae, mesh, tapes. */}
      {[196, 1004].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="392" width="12" height={NET_Y - 392 + 6} fill="#e5e7eb" />
          <rect x={x + 6} y="392" width="4" height={NET_Y - 392 + 6} fill="#94a3b8" />
        </g>
      ))}
      <rect x="202" y="404" width="796" height="66" fill="#0f172a" opacity="0.45" />
      {Array.from({ length: 57 }, (_, i) => (
        <rect key={i} x={204 + i * 14} y="404" width="1.2" height="66" fill="#ffffff" opacity="0.28" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="202" y={410 + i * 11} width="796" height="1.2" fill="#ffffff" opacity="0.28" />
      ))}
      <rect x="202" y="398" width="796" height="9" fill="#ffffff" />
      <rect x="202" y="468" width="796" height="4" fill="#ffffff" opacity="0.85" />
      {[214, 986].map((x) => (
        <g key={x}>
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={x - 2} y={350 + i * 10} width="4" height="10" fill={i % 2 ? "#ffffff" : "#ef4444"} />
          ))}
        </g>
      ))}
    </Svg>
  );
}

/* ── Rayla: a soccer pitch and a goal ────────────────────────────── */


export function SoccerScene({ netHit = false }: { netHit?: boolean }) {
  // Mowing stripes that widen toward the viewer.
  const bands: { y: number; h: number }[] = [];
  let y = 170;
  for (let i = 0; y < H; i += 1) {
    const h = 34 + i * 9;
    bands.push({ y, h });
    y += h;
  }
  return (
    <Svg label="Soccer pitch">
      <defs>
        <linearGradient id="soccer-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height="175" fill="url(#soccer-sky)" />
      <circle cx="1030" cy="70" r="34" fill="#fff6d8" opacity="0.95" />
      {/* Trees and a small stand behind the goal. */}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={i * 80 + 20} cy={150 - (i % 3) * 10} r={42 + (i % 2) * 10} fill={i % 2 ? "#15803d" : "#166534"} />
      ))}
      <rect x="360" y="118" width="480" height="56" fill="#64748b" />
      <Crowd x0={372} x1={832} y0={132} rows={2} gap={18} size={6.5} />
      {bands.map((b, i) => (
        <rect key={i} x="0" y={b.y} width={W} height={b.h} fill={i % 2 ? "#4aa853" : "#3f9b47"} />
      ))}
      {/* Lines: the end line, the penalty box, the goal box, the spot, the arc. */}
      <rect x="40" y={GOAL.line - 2} width="1120" height="4" fill="#f8fafc" />
      <path d={`M320 ${GOAL.line} L880 ${GOAL.line} L935 410 L265 410Z`} fill="none" stroke="#f8fafc" strokeWidth="4" />
      <path d={`M430 ${GOAL.line} L770 ${GOAL.line} L786 332 L414 332Z`} fill="none" stroke="#f8fafc" strokeWidth="4" />
      <ellipse cx="600" cy="372" rx="6" ry="3" fill="#f8fafc" />
      <path d="M520 410 Q600 452 680 410" fill="none" stroke="#f8fafc" strokeWidth="4" />
      <ellipse cx="600" cy="870" rx="240" ry="80" fill="none" stroke="#f8fafc" strokeWidth="5" />
      {[40, 1160].map((x) => (
        <g key={x}>
          <rect x={x - 2} y={GOAL.line - 46} width="4" height="46" fill="#e5e7eb" />
          <path d={`M${x + 2} ${GOAL.line - 46} l18 7 l-18 7Z`} fill="#facc15" />
        </g>
      ))}
      {/* The goal. */}
      <g className={netHit ? "net-hit" : ""} style={{ transformOrigin: `600px ${GOAL.line}px`, transformBox: "view-box" }}>
        <rect x={GOAL.x0 + 6} y={GOAL.top + 8} width={GOAL.x1 - GOAL.x0 - 12} height={GOAL.line - GOAL.top - 8} fill="#e2e8f0" opacity="0.28" />
        {Array.from({ length: 19 }, (_, i) => (
          <rect key={i} x={GOAL.x0 + 8 + i * 13.5} y={GOAL.top + 8} width="1.2" height={GOAL.line - GOAL.top - 8} fill="#f8fafc" opacity="0.55" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={GOAL.x0 + 6} y={GOAL.top + 18 + i * 13} width={GOAL.x1 - GOAL.x0 - 12} height="1.2" fill="#f8fafc" opacity="0.55" />
        ))}
      </g>
      <rect x={GOAL.x0} y={GOAL.top} width="9" height={GOAL.line - GOAL.top + 2} fill="#ffffff" />
      <rect x={GOAL.x1 - 9} y={GOAL.top} width="9" height={GOAL.line - GOAL.top + 2} fill="#ffffff" />
      <rect x={GOAL.x0} y={GOAL.top} width={GOAL.x1 - GOAL.x0} height="9" fill="#ffffff" />
    </Svg>
  );
}

export function CourtScene({ game, netHit }: { game: CourtGameId; netHit?: boolean }) {
  if (game === "wrestling") return <WrestlingScene />;
  if (game === "cheer") return <CheerScene />;
  if (game === "volleyball") return <VolleyballScene />;
  return <SoccerScene netHit={netHit} />;
}

/* ── Veronica: an outdoor rink in winter ─────────────────────────── */

/**
 * The rink she skates on, out on its own in the snow: boards with a red
 * rail, evergreens behind, stands either side, a warming hut, a string of
 * bulbs over it all. The ice is the same ellipse the game has always used
 * (`RINK` in lib/rink.ts), so her skating and the seven decoration spots
 * around the boards are unchanged.
 */
export function RinkScene() {
  const R = RINK;
  const trees = [40, 130, 215, 300, 380, 470, 560, 650, 740, 830, 920, 1010, 1100, 1180];
  const bulbs = ["#fbbf24", "#fb7185", "#38bdf8", "#4ade80", "#c084fc", "#fb923c"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="rink-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#eff6ff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height="440" fill="url(#rink-sky)" />
      <circle cx="960" cy="150" r="120" fill="#ffffff" opacity="0.4" />
      <circle cx="960" cy="150" r="52" fill="#fff7e0" />
      {/* Snowy hills, far off. */}
      <path d="M0 330 Q200 250 420 300 Q600 340 800 280 Q1000 230 1200 300 L1200 460 L0 460Z" fill="#e2e8f0" />
      <path d="M0 360 Q260 300 520 340 Q760 370 1000 320 Q1120 300 1200 330 L1200 460 L0 460Z" fill="#f1f5f9" />
      {/* Evergreens in a row, snow on their tips. */}
      {trees.map((x, i) => {
        const h = 120 + ((i * 37) % 60);
        const base = 430;
        return (
          <g key={x}>
            <rect x={x - 6} y={base - 18} width="12" height="22" fill="#5b3a21" />
            <path d={`M${x} ${base - h} L${x + 42} ${base - 10} L${x - 42} ${base - 10}Z`} fill="#1f5a3a" />
            <path d={`M${x} ${base - h + 26} L${x + 32} ${base - 42} L${x - 32} ${base - 42}Z`} fill="#2f7a4d" />
            <path d={`M${x} ${base - h} L${x + 10} ${base - h + 22} L${x - 10} ${base - h + 22}Z`} fill="#f8fafc" opacity="0.9" />
            <path d={`M${x - 14} ${base - h + 46} q14 -6 28 0 l-4 6 q-10 -4 -20 0Z`} fill="#f8fafc" opacity="0.8" />
          </g>
        );
      })}
      {/* Snow on the ground. */}
      <rect x="0" y="420" width={W} height={H - 420} fill="#f1f5f9" />
      <rect x="0" y="420" width={W} height="60" fill="#dbe7f3" opacity="0.6" />
      {/* Stands either side, with a crowd in coats. */}
      {[
        [60, 380],
        [820, 1140],
      ].map(([x0, x1]) => (
        <g key={x0}>
          <rect x={x0} y="352" width={x1 - x0} height="96" fill="#8b5a2b" />
          <rect x={x0} y="352" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0} y="392" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0 - 6} y="440" width={x1 - x0 + 12} height="12" fill="#f8fafc" />
          <Crowd x0={x0 + 14} x1={x1 - 8} y0={360} rows={2} gap={40} size={12} />
        </g>
      ))}
      {/* The warming hut, with its window lit. */}
      <rect x="520" y="322" width="160" height="112" fill="#7c4a2a" />
      <rect x="520" y="322" width="80" height="112" fill="#8f5a35" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="520" y={330 + i * 20} width="160" height="2" fill="#5b3a21" opacity="0.6" />
      ))}
      <path d="M506 326 L600 268 L694 326Z" fill="#334155" />
      <path d="M512 320 L600 266 L688 320 L680 320 L600 276 L520 320Z" fill="#f8fafc" />
      <rect x="546" y="356" width="40" height="34" rx="2" fill="#fde68a" />
      <rect x="564" y="356" width="4" height="34" fill="#5b3a21" />
      <rect x="546" y="371" width="40" height="4" fill="#5b3a21" />
      <rect x="614" y="366" width="42" height="68" fill="#3f2a1a" />
      <circle cx="648" cy="402" r="3" fill="#facc15" />
      <rect x="536" y="292" width="128" height="26" rx="4" fill="#1e3a8a" />
      <text x="600" y="311" textAnchor="middle" fontSize="17" fontWeight="800" fill="#facc15" fontFamily="ui-sans-serif, system-ui" letterSpacing="3">
        ALGEBRIDGE RINK
      </text>
      {/* A string of bulbs over everything. */}
      <path d="M0 140 Q300 250 600 190 T1200 140" fill="none" stroke="#475569" strokeWidth="3" />
      {[50, 130, 210, 290, 370, 450, 530, 610, 690, 770, 850, 930, 1010, 1090, 1170].map((x, i) => {
        const t = x / 1200;
        const y = 140 + 90 * Math.sin(Math.PI * (t < 0.5 ? t * 2 : (t - 0.5) * 2)) * (t < 0.5 ? 1 : 0.55) + 6;
        return (
          <g key={x}>
            <rect x={x - 2} y={y} width="4" height="8" fill="#475569" />
            <circle cx={x} cy={y + 14} r="7" fill={bulbs[i % bulbs.length]} />
            <circle cx={x} cy={y + 14} r="12" fill={bulbs[i % bulbs.length]} opacity="0.25" />
          </g>
        );
      })}
      {/* Snowbanks pushed up against the boards. */}
      <ellipse cx={R.cx} cy={R.cy + 8} rx={R.rx + 62} ry={R.ry + 52} fill="#ffffff" />
      <ellipse cx={R.cx} cy={R.cy + 16} rx={R.rx + 62} ry={R.ry + 48} fill="#e2e8f0" opacity="0.7" />
      <ellipse cx={R.cx} cy={R.cy + 8} rx={R.rx + 62} ry={R.ry + 52} fill="#ffffff" opacity="0.6" />
      {/* The rink: boards with a red rail, then the ice, then its lines. */}
      <ellipse cx={R.cx} cy={R.cy + 10} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#1f2937" opacity="0.14" />
      <ellipse cx={R.cx} cy={R.cy + 4} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#cbd5e1" />
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#f1f5f9" />
      <ellipse cx={R.cx} cy={R.cy - 3} rx={R.rx + BOARD} ry={R.ry + BOARD} fill="#dc2626" />
      <ellipse cx={R.cx} cy={R.cy - 3} rx={R.rx + 4} ry={R.ry + 4} fill="#f1f5f9" />
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx} ry={R.ry} fill="#dbe7f3" />
      <ellipse cx={R.cx} cy={R.cy - 2} rx={R.rx - 4} ry={R.ry - 4} fill="#f4f8fc" />
      <ellipse cx={R.cx} cy={R.cy} rx={R.rx * 0.36} ry={R.ry * 0.36} fill="none" stroke="#3b82f6" strokeWidth="4" opacity="0.8" />
      <circle cx={R.cx} cy={R.cy} r="5" fill="#3b82f6" opacity="0.8" />
      <rect x={R.cx - 2} y={R.cy - R.ry + 8} width="4" height={R.ry * 2 - 16} fill="#dc2626" opacity="0.55" />
      <rect x={R.cx - R.rx * 0.55 - 2} y={R.cy - R.ry * 0.83} width="4" height={R.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      <rect x={R.cx + R.rx * 0.55 - 2} y={R.cy - R.ry * 0.83} width="4" height={R.ry * 1.66} fill="#3b82f6" opacity="0.5" />
      <path
        d={`M${R.cx - R.rx * 0.9} ${R.cy - 10} Q${R.cx} ${R.cy - R.ry * 0.9} ${R.cx + R.rx * 0.9} ${R.cy - 10} Q${R.cx} ${R.cy - R.ry * 0.55} ${R.cx - R.rx * 0.9} ${R.cy - 10}Z`}
        fill="#ffffff"
        opacity="0.55"
      />
      <path d={`M${R.cx - 260} ${R.cy + 40} q60 -30 130 -6`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d={`M${R.cx + 40} ${R.cy + 70} q80 -40 170 -20`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
