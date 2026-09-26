import { GOAL, NET_Y, type CourtGameId } from "@/lib/games";
import { BOARD, RINK } from "@/lib/rink";

/**
 * The four courts and the rink, drawn flat on the same 1200 × 800 plane as
 * the House, in its hand: no outlines, two tones per surface, detail from
 * repetition. The play areas in src/lib/games.ts sit on these surfaces, so
 * everything drawn here stays clear of where the players run.
 */

const W = 1200;
const H = 800;
const FONT = "ui-sans-serif, system-ui";

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <title>{label}</title>
      {children}
    </svg>
  );
}

const SHIRTS = ["#1d4ed8", "#facc15", "#ef4444", "#f8fafc", "#22c55e", "#7c3aed", "#f97316", "#0ea5e9"];
const SKINS = ["#f1c7a5", "#b07a55", "#6f432a", "#8d5a3b", "#e0ac86", "#4b2d1c"];
const HAIRS = ["#1c1210", "#4a2c17", "#c9a24a", "#2b1b12", "#6b4426", "#111111"];

/**
 * A crowd in rows: heads with hair, shirts in team colours, a few arms up,
 * placed by a fixed pattern so the server and the browser agree.
 */
function Crowd({ x0, x1, y0, rows, gap, size, colors = SHIRTS }: { x0: number; x1: number; y0: number; rows: number; gap: number; size: number; colors?: string[] }) {
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + r * gap;
    const row: React.ReactNode[] = [];
    for (let x = x0 + (r % 2) * (size * 1.1); x < x1; x += size * 2.3) {
      const k = Math.round(x * 7 + r * 13);
      const up = k % 9 === 0;
      row.push(
        <g key={`${r}-${x}`}>
          <rect x={x - size * 0.9} y={y} width={size * 1.8} height={size * 1.6} rx={size * 0.6} fill={colors[k % colors.length]} />
          {up && <rect x={x + size * 0.7} y={y - size * 1.4} width={size * 0.5} height={size * 1.8} rx={size * 0.25} fill={SKINS[(k >> 2) % SKINS.length]} />}
          <circle cx={x} cy={y - size * 0.35} r={size * 0.7} fill={SKINS[(k >> 2) % SKINS.length]} />
          <path d={`M${x - size * 0.7} ${y - size * 0.5} Q${x} ${y - size * 1.35} ${x + size * 0.7} ${y - size * 0.5}`} fill={HAIRS[(k >> 3) % HAIRS.length]} />
        </g>
      );
    }
    // Each row sways on its own beat, so the stand looks alive without a thousand animations.
    out.push(
      <g key={r} className="sc-bob" style={{ animationDelay: `${r * -0.7}s` }}>
        {row}
      </g>
    );
  }
  return <g>{out}</g>;
}

/** Text that always fits the sign it is on. */
function Fit({ x, y, w, size, fill, children, weight = 800, spacing }: { x: number; y: number; w: number; size: number; fill: string; children: string; weight?: number; spacing?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} fontFamily={FONT} letterSpacing={spacing} textLength={w} lengthAdjust="spacingAndGlyphs">
      {children}
    </text>
  );
}

/** A small person standing or sitting: a coach, an official, a substitute. */
function Person({ x, y, h, shirt, skin = "#b07a55", hair = "#1c1210", stripes = false }: { x: number; y: number; h: number; shirt: string; skin?: string; hair?: string; stripes?: boolean }) {
  const head = h * 0.2;
  return (
    <g>
      <rect x={x - h * 0.16} y={y - h * 0.62} width={h * 0.32} height={h * 0.4} rx={h * 0.06} fill={shirt} />
      {stripes &&
        [0, 1, 2].map((i) => <rect key={i} x={x - h * 0.16 + i * h * 0.11 + h * 0.03} y={y - h * 0.62} width={h * 0.05} height={h * 0.4} fill="#111827" />)}
      <rect x={x - h * 0.14} y={y - h * 0.24} width={h * 0.12} height={h * 0.24} fill="#1f2937" />
      <rect x={x + h * 0.02} y={y - h * 0.24} width={h * 0.12} height={h * 0.24} fill="#1f2937" />
      <circle cx={x} cy={y - h * 0.74} r={head} fill={skin} />
      <path d={`M${x - head} ${y - h * 0.76} Q${x} ${y - h * 1.0} ${x + head} ${y - h * 0.76}`} fill={hair} />
    </g>
  );
}

/** A hanging light fixture with its glow. */
function Lamp({ x, y, w = 60 }: { x: number; y: number; w?: number }) {
  return (
    <g>
      <rect x={x - 1.5} y="0" width="3" height={y} fill="#64748b" />
      <rect x={x - w / 2} y={y} width={w} height="10" rx="3" fill="#475569" />
      <rect x={x - w / 2 + 4} y={y + 8} width={w - 8} height="4" rx="2" fill="#fef3c7" />
      <path d={`M${x - w / 2} ${y + 12} L${x + w / 2} ${y + 12} L${x + w * 1.1} ${y + 130} L${x - w * 1.1} ${y + 130}Z`} fill="#ffffff" opacity="0.06" />
    </g>
  );
}

/** A felt pennant hanging on a wall. */
function Pennant({ x, y, color, text }: { x: number; y: number; color: string; text: string }) {
  return (
    <g>
      <rect x={x - 2} y={y} width="72" height="6" rx="2" fill="#a16207" />
      <g className="sc-sway" style={{ transformOrigin: `${x + 34}px ${y + 6}px`, animationDelay: `${(x % 7) * -0.4}s` }}>
        <path d={`M${x} ${y + 6} L${x + 68} ${y + 6} L${x + 34} ${y + 96}Z`} fill={color} />
        <Fit x={x + 34} y={y + 34} w={48} size={10} fill="#ffffff">
          {text}
        </Fit>
      </g>
    </g>
  );
}

/* ── Shaurya: a school gym and a wrestling mat ───────────────────── */

export function WrestlingScene() {
  return (
    <Svg label="Wrestling mat">
      {/* Cinder-block wall, a painted band, the courses of blocks. */}
      <rect x="0" y="0" width={W} height="385" fill="#ece4d4" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={22 + i * 22} width={W} height="1.5" fill="#d9cdb6" />
      ))}
      {Array.from({ length: 13 }, (_, r) =>
        Array.from({ length: 21 }, (_, c) => (
          <rect key={`${r}-${c}`} x={c * 60 + (r % 2) * 30} y={22 + r * 22} width="1.5" height="22" fill="#d9cdb6" />
        ))
      )}
      <rect x="0" y="300" width={W} height="85" fill="#ddd0b8" />
      <rect x="0" y="294" width={W} height="7" fill="#1d4ed8" />
      <rect x="0" y="301" width={W} height="3" fill="#facc15" />
      {/* Lights along the ceiling. */}
      {[120, 360, 840, 1080].map((x) => (
        <Lamp key={x} x={x} y={14} />
      ))}
      {/* Doors out to the hall, with the exit sign; a clock and an extinguisher on the far wall. */}
      <rect x="352" y="196" width="72" height="104" fill="#64748b" />
      <rect x="356" y="200" width="30" height="100" fill="#94a3b8" />
      <rect x="390" y="200" width="30" height="100" fill="#94a3b8" />
      <rect x="360" y="246" width="22" height="4" rx="2" fill="#e2e8f0" />
      <rect x="394" y="246" width="22" height="4" rx="2" fill="#e2e8f0" />
      <rect x="362" y="206" width="18" height="24" fill="#bae6fd" />
      <rect x="396" y="206" width="18" height="24" fill="#bae6fd" />
      <rect x="366" y="176" width="44" height="14" rx="2" fill="#166534" />
      <text x="388" y="187" textAnchor="middle" fontSize="9" fontWeight="800" fill="#bbf7d0" fontFamily={FONT} letterSpacing="1">
        EXIT
      </text>
      <circle cx="806" cy="222" r="20" fill="#f8fafc" />
      <circle cx="806" cy="222" r="17" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M806 222 L806 210 M806 222 L814 226" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <rect x="796" y="256" width="20" height="36" rx="4" fill="#dc2626" />
      <rect x="800" y="250" width="12" height="8" fill="#1f2937" />
      {/* Pennants over the wall. */}
      <path d={`M0 38 Q${W / 2} 78 ${W} 38`} fill="none" stroke="#94a3b8" strokeWidth="2" />
      {Array.from({ length: 14 }, (_, i) => {
        const x = 30 + i * 82;
        const t = x / W;
        const y = 38 + 160 * t * (1 - t);
        return (
          <g key={i} className="sc-sway" style={{ transformOrigin: `${x + 20}px ${y}px`, animationDelay: `${i * -0.3}s` }}>
            <path d={`M${x} ${y} L${x + 40} ${y + 2} L${x + 20} ${y + 42}Z`} fill={["#1d4ed8", "#facc15", "#dc2626"][i % 3]} />
          </g>
        );
      })}
      {[40, 130, 220].map((x, i) => (
        <Pennant key={x} x={x} y={100} color={["#1e3a8a", "#b91c1c", "#1e3a8a"][i]} text={["BRIDGES", "GO TEAM", "WRESTLE"][i]} />
      ))}
      {[900, 990, 1080].map((x, i) => (
        <Pennant key={x} x={x} y={100} color={["#1e3a8a", "#b91c1c", "#1e3a8a"][i]} text={["VARSITY", "PIN IT", "BRIDGES"][i]} />
      ))}
      {/* The team banner. */}
      <rect x="430" y="112" width="340" height="86" rx="8" fill="#1e3a8a" />
      <rect x="430" y="186" width="340" height="12" rx="4" fill="#172554" />
      <Fit x={600} y={156} w={250} size={36} fill="#facc15">
        ALGEBRIDGE
      </Fit>
      <Fit x={600} y={182} w={150} size={15} fill="#ffffff" weight={700}>
        WRESTLING
      </Fit>
      {/* Bleachers, full, with a rail along the top. */}
      {[0, 1].map((side) => {
        const x0 = side ? 850 : 30;
        return (
          <g key={side}>
            <rect x={x0 - 4} y="222" width="328" height="4" fill="#64748b" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={x0} y={236 + i * 36} width="320" height="14" fill="#b45309" />
                <rect x={x0} y={250 + i * 36} width="320" height="22" fill="#92400e" />
                <rect x={x0 + 154} y={236 + i * 36} width="12" height="36" fill="#78350f" />
              </g>
            ))}
            <Crowd x0={x0 + 20} x1={x0 + 300} y0={214} rows={3} gap={36} size={11} />
          </g>
        );
      })}
      {/* The scorer's table under the banner: a flip board, two officials. */}
      <rect x="510" y="344" width="180" height="40" rx="3" fill="#7c4a2a" />
      <rect x="510" y="344" width="180" height="6" fill="#a9703a" />
      <rect x="546" y="306" width="108" height="34" rx="3" fill="#111827" />
      <text x="576" y="330" textAnchor="middle" fontSize="20" fontWeight="800" fill="#22c55e" fontFamily="ui-monospace, monospace">
        0
      </text>
      <text x="624" y="330" textAnchor="middle" fontSize="20" fontWeight="800" fill="#ef4444" fontFamily="ui-monospace, monospace">
        0
      </text>
      <rect x="598" y="312" width="4" height="22" fill="#475569" />
      <Person x={540} y={344} h={44} shirt="#f8fafc" skin="#e0ac86" hair="#6b4426" />
      <Person x={662} y={344} h={44} shirt="#1f2937" skin="#6f432a" />
      {/* Wood floor with its lines showing beside the mat. */}
      <rect x="0" y="385" width={W} height={H - 385} fill="#d9a066" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x="0" y={398 + i * 26} width={W} height="2" fill="#c68a52" opacity="0.7" />
      ))}
      <path d="M0 470 Q60 440 130 445" fill="none" stroke="#f8fafc" strokeWidth="4" opacity="0.6" />
      <path d="M1200 470 Q1140 440 1070 445" fill="none" stroke="#f8fafc" strokeWidth="4" opacity="0.6" />
      {/* Team corners: a bench, water, headgear, a towel. */}
      {[0, 1].map((side) => {
        const x = side ? 1088 : 8;
        return (
          <g key={side}>
            <rect x={x} y="404" width="104" height="10" rx="3" fill="#94a3b8" />
            <rect x={x + 8} y="414" width="6" height="18" fill="#64748b" />
            <rect x={x + 90} y="414" width="6" height="18" fill="#64748b" />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={x + 18 + i * 14} y="388" width="8" height="16" rx="3" fill={side ? "#dc2626" : "#1d4ed8"} />
            ))}
            <ellipse cx={x + 76} cy="398" rx="10" ry="7" fill={side ? "#dc2626" : "#1d4ed8"} />
            <rect x={x + 62} y="392" width="4" height="12" rx="2" fill="#f8fafc" opacity="0.9" />
            <rect x={x + 20} y="434" width="60" height="8" rx="4" fill="#f8fafc" />
          </g>
        );
      })}
      {/* The mat: its border, the red circle, the seams, the starting lines. */}
      <path d="M130 405 L1070 405 L1195 795 L5 795Z" fill="#1e3a8a" />
      <path d="M130 405 L1070 405 L1074 418 L126 418Z" fill="#172554" />
      <ellipse cx="600" cy="592" rx="480" ry="188" fill="#dc2626" />
      <ellipse cx="600" cy="592" rx="462" ry="178" fill="#2563eb" />
      <ellipse cx="600" cy="600" rx="420" ry="150" fill="#1d4ed8" opacity="0.35" />
      {[380, 820].map((x) => (
        <path key={x} d={`M${x - 20} 414 L${x + 20} 780`} stroke="#1e40af" strokeWidth="2" opacity="0.5" />
      ))}
      <ellipse cx="600" cy="592" rx="78" ry="28" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.9" />
      <rect x="570" y="588" width="24" height="6" rx="2" fill="#22c55e" />
      <rect x="606" y="588" width="24" height="6" rx="2" fill="#ef4444" />
      {/* The referee, at the edge of the mat. */}
      <Person x={1010} y={486} h={64} shirt="#f8fafc" skin="#f1c7a5" hair="#4a2c17" stripes />
    </Svg>
  );
}

/* ── Jo: a cheer competition ────────────────────────────────────── */

/**
 * A cheer competition: a blue spring floor under arena lights, the judges'
 * table at the back with a video board over it, stands either side, an
 * announcer and the trophies, and a banner over the lot. Jo throws her
 * passes for the judges, not a crowd on a sideline.
 */
export function CheerScene() {
  return (
    <Svg label="Cheer competition floor">
      {/* The arena: a dark upper wall, trusses, spotlights, a lit band, and the floor. */}
      <rect x="0" y="0" width={W} height={H} fill="#1e293b" />
      <rect x="0" y="0" width={W} height="240" fill="#0f172a" />
      {[26, 52].map((y) => (
        <rect key={y} x="0" y={y} width={W} height="3" fill="#334155" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${i * 100 + 20} 26 L${i * 100 + 70} 52 M${i * 100 + 70} 26 L${i * 100 + 120} 52`} stroke="#334155" strokeWidth="2" />
      ))}
      {[180, 420, 660, 900].map((x, i) => (
        <g key={x}>
          <rect x={x - 12} y="54" width="24" height="16" rx="3" fill="#475569" />
          <rect x={x - 8} y="68" width="16" height="6" rx="2" fill="#fef3c7" />
          <g className="sc-sweep" style={{ transformOrigin: `${x}px 74px`, animationDelay: `${i * -2.3}s` }}>
            <path d={`M${x - 10} 74 L${x + 10} 74 L${x + 300} 470 L${x - 140} 470Z`} fill="#ffffff" opacity="0.06" />
          </g>
        </g>
      ))}
      {/* The banner. */}
      <rect x="240" y="62" width="720" height="66" rx="8" fill="#1d4ed8" />
      <rect x="240" y="62" width="720" height="10" rx="4" fill="#facc15" />
      <Fit x={600} y={108} w={520} size={30} fill="#ffffff">
        CHEER CHAMPIONSHIP
      </Fit>
      {/* A video board over the judges. */}
      <rect x="440" y="140" width="320" height="94" rx="6" fill="#0b1220" />
      <rect x="446" y="146" width="308" height="82" rx="4" fill="#1e3a8a" />
      <Fit x={600} y={176} w={180} size={13} fill="#93c5fd" weight={700}>
        NOW ON THE FLOOR
      </Fit>
      <Fit x={600} y={210} w={190} size={24} fill="#ffffff">
        ALGEBRIDGE
      </Fit>
      {/* Flags at the back corners. */}
      {[60, 1140].map((x, i) => (
        <g key={x}>
          <rect x={x - 2} y="130" width="4" height="120" fill="#94a3b8" />
          <g className="sc-sway" style={{ transformOrigin: `${x}px 132px`, animationDelay: `${i * -1.1}s` }}>
            <path d={`M${x + 2} 132 l${i ? -50 : 50} 12 l${i ? 50 : -50} 12Z`} fill={i ? "#dc2626" : "#1d4ed8"} />
          </g>
        </g>
      ))}
      {/* Stands either side, full, with rails. */}
      {[
        [40, 400],
        [800, 1160],
      ].map(([x0, x1]) => (
        <g key={x0}>
          <rect x={x0} y="250" width={x1 - x0} height="200" fill="#334155" />
          {[0, 1, 2, 3].map((r) => (
            <rect key={r} x={x0} y={250 + r * 50} width={x1 - x0} height="8" fill="#475569" />
          ))}
          <rect x={x0 - 4} y="244" width={x1 - x0 + 8} height="4" fill="#94a3b8" />
          <rect x={x0 + (x1 - x0) / 2 - 8} y="250" width="16" height="200" fill="#1e293b" />
          <Crowd x0={x0 + 14} x1={x1 - 8} y0={262} rows={4} gap={48} size={12} colors={["#1d4ed8", "#facc15", "#f8fafc", "#dc2626", "#7c3aed", "#f97316"]} />
        </g>
      ))}
      {/* The announcer's table with speakers, the judges, the trophies. */}
      <rect x="230" y="392" width="150" height="56" rx="5" fill="#111827" />
      <rect x="230" y="392" width="150" height="6" fill="#334155" />
      <rect x="254" y="372" width="40" height="24" rx="3" fill="#475569" />
      <rect x="258" y="376" width="32" height="16" fill="#93c5fd" />
      <Person x={330} y={392} h={46} shirt="#0f766e" skin="#e0ac86" hair="#111111" />
      {[200, 400].map((x) => (
        <g key={x}>
          <rect x={x - 16} y="380" width="32" height="68" rx="3" fill="#0b1220" />
          <circle cx={x} cy="402" r="9" fill="#1e293b" />
          <circle cx={x} cy="430" r="7" fill="#1e293b" />
        </g>
      ))}
      <rect x="440" y="378" width="320" height="70" rx="6" fill="#1e40af" />
      <rect x="440" y="378" width="320" height="8" rx="3" fill="#60a5fa" />
      <Fit x={600} y={432} w={110} size={20} fill="#ffffff">
        JUDGES
      </Fit>
      {[500, 600, 700].map((x, i) => (
        <g key={x}>
          <Person x={x} y={382} h={54} shirt={["#7c3aed", "#0f766e", "#b91c1c"][i]} skin={["#f1c7a5", "#6f432a", "#e0ac86"][i]} hair={["#4a2c17", "#111111", "#c9a24a"][i]} />
          <rect x={x - 14} y="368" width="28" height="14" rx="2" fill="#f8fafc" />
        </g>
      ))}
      <rect x="820" y="400" width="160" height="48" rx="5" fill="#f8fafc" />
      <rect x="820" y="400" width="160" height="6" fill="#cbd5e1" />
      {[850, 900, 950].map((x, i) => (
        <g key={x}>
          <rect x={x - 10} y={392 - i * 4} width="20" height="8" fill="#a16207" />
          <path d={`M${x - 8} ${392 - i * 4} L${x + 8} ${392 - i * 4} L${x + 10} ${368 - i * 8} Q${x} ${358 - i * 8} ${x - 10} ${368 - i * 8}Z`} fill="#facc15" />
          <path d={`M${x - 12} ${376 - i * 8} q-8 -4 -2 -10 M${x + 12} ${376 - i * 8} q8 -4 2 -10`} stroke="#facc15" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* The wood floor, then the spring floor: nine blue panels under white tape. */}
      <rect x="0" y="450" width={W} height={H - 450} fill="#c9a46b" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x="0" y={456 + i * 26} width={W} height="2" fill="#a67f4a" opacity="0.5" />
      ))}
      {/* Gym bags and water along the front edge of the stands. */}
      {[60, 110, 1090, 1140].map((x, i) => (
        <g key={x}>
          <rect x={x - 22} y="462" width="44" height="22" rx="7" fill={i % 2 ? "#1d4ed8" : "#dc2626"} />
          <rect x={x - 10} y="456" width="20" height="8" rx="4" fill="#0f172a" />
        </g>
      ))}
      <rect x="140" y="486" width="920" height="292" rx="10" fill="#0f172a" opacity="0.22" />
      <rect x="130" y="478" width="940" height="292" rx="10" fill="#f8fafc" />
      <rect x="140" y="488" width="920" height="272" rx="6" fill="#1d4ed8" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={140 + (i + 1) * 102.2} y="488" width="3" height="272" fill="#3b82f6" opacity="0.7" />
      ))}
      <rect x="140" y="488" width="920" height="272" rx="6" fill="#ffffff" opacity="0.06" />
      {/* Centre mark, and the team's name on the mat. */}
      <ellipse cx="600" cy="624" rx="80" ry="30" fill="none" stroke="#facc15" strokeWidth="5" opacity="0.9" />
      <text x="600" y="636" textAnchor="middle" fontSize="34" fontWeight="800" fill="#facc15" fontFamily={FONT} opacity="0.9">
        A
      </text>
      <g opacity="0.28">
        <Fit x={600} y={742} w={440} size={22} fill="#ffffff">
          ALGEBRIDGE ALLSTARS
        </Fit>
      </g>
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
      <rect x="0" y="276" width={W} height="6" fill="#7c3aed" />
      {/* Lights and the windows. */}
      {[130, 1070].map((x) => (
        <Lamp key={x} x={x} y={10} w={70} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <rect x={60 + i * 190} y="36" width="130" height="92" rx="4" fill="#94a3b8" />
          <rect x={66 + i * 190} y="42" width="118" height="80" fill="#bae6fd" />
          <rect x={66 + i * 190} y="42" width="118" height="30" fill="#e0f2fe" opacity="0.8" />
          <rect x={123 + i * 190} y="42" width="4" height="80" fill="#94a3b8" />
          <rect x={66 + i * 190} y="80" width="118" height="3" fill="#94a3b8" />
        </g>
      ))}
      {/* Pennants along the wall, the school crest, a clock. */}
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} className="sc-sway" style={{ transformOrigin: `${40 + i * 124}px 140px`, animationDelay: `${i * -0.35}s` }}>
          <path d={`M${20 + i * 124} 140 L${60 + i * 124} 140 L${40 + i * 124} 176Z`} fill={["#7c3aed", "#facc15", "#0d9488"][i % 3]} />
        </g>
      ))}
      <circle cx="300" cy="212" r="36" fill="#7c3aed" />
      <circle cx="300" cy="212" r="28" fill="#5b21b6" />
      <text x="300" y="222" textAnchor="middle" fontSize="28" fontWeight="800" fill="#facc15" fontFamily={FONT}>
        B
      </text>
      <circle cx="900" cy="206" r="22" fill="#f8fafc" />
      <circle cx="900" cy="206" r="19" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M900 206 L900 192 M900 206 L910 210" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      {/* Scoreboard. */}
      <rect x="490" y="150" width="220" height="92" rx="8" fill="#111827" />
      <rect x="506" y="166" width="84" height="60" rx="4" fill="#0b1220" />
      <rect x="610" y="166" width="84" height="60" rx="4" fill="#0b1220" />
      <text x="548" y="211" textAnchor="middle" fontSize="42" fontWeight="800" fill="#f97316" fontFamily="ui-monospace, monospace">
        24
      </text>
      <text x="652" y="211" textAnchor="middle" fontSize="42" fontWeight="800" fill="#22c55e" fontFamily="ui-monospace, monospace">
        23
      </text>
      <Fit x={548} y={158} w={44} size={9} fill="#94a3b8" weight={700}>
        HOME
      </Fit>
      <Fit x={652} y={158} w={48} size={9} fill="#94a3b8" weight={700}>
        GUEST
      </Fit>
      {/* Wall pads at the ends, the scorer's table in the middle. */}
      <rect x="0" y="286" width="230" height="49" fill="#7c3aed" />
      <rect x="970" y="286" width="230" height="49" fill="#7c3aed" />
      {[40, 100, 160, 1010, 1070, 1130].map((x) => (
        <rect key={x} x={x} y="290" width="2" height="41" fill="#5b21b6" />
      ))}
      <rect x="500" y="296" width="200" height="40" rx="3" fill="#7c4a2a" />
      <rect x="500" y="296" width="200" height="6" fill="#a9703a" />
      <Person x={548} y={296} h={46} shirt="#f8fafc" skin="#e0ac86" hair="#c9a24a" />
      <Person x={652} y={296} h={46} shirt="#1f2937" skin="#6f432a" />
      <rect x="590" y="282" width="22" height="14" rx="2" fill="#93c5fd" />
      {/* Free zone, then the court and its lines. */}
      <rect x="0" y="335" width={W} height={H - 335} fill="#2563eb" />
      <path d={`M${COURT.farL} ${COURT.farY} L${COURT.farR} ${COURT.farY} L${COURT.nearR} ${COURT.nearY} L${COURT.nearL} ${COURT.nearY}Z`} fill="#f97316" />
      <path d={`M${COURT.farL} ${COURT.farY} L${COURT.farR} ${COURT.farY} L${COURT.nearR} ${COURT.nearY} L${COURT.nearL} ${COURT.nearY}Z`} fill="none" stroke="#ffffff" strokeWidth="5" />
      {line(NET_Y)}
      {line(470)}
      {line(640)}
      {/* Team benches in the free zone, a ball cart, water. */}
      {[0, 1].map((side) => {
        const x = side ? 1062 : 16;
        const shirt = side ? "#0d9488" : "#7c3aed";
        return (
          <g key={side}>
            <rect x={x} y="612" width="120" height="10" rx="3" fill="#94a3b8" />
            <rect x={x + 8} y="622" width="6" height="16" fill="#64748b" />
            <rect x={x + 106} y="622" width="6" height="16" fill="#64748b" />
            {[0, 1, 2].map((i) => (
              <Person key={i} x={x + 24 + i * 36} y={612} h={52} shirt={shirt} skin={SKINS[(i + side * 2) % SKINS.length]} hair={HAIRS[(i + side) % HAIRS.length]} />
            ))}
            {[0, 1, 2].map((i) => (
              <rect key={i} x={x + 14 + i * 30} y="640" width="7" height="14" rx="3" fill="#f8fafc" />
            ))}
          </g>
        );
      })}
      <rect x="1070" y="520" width="96" height="46" rx="4" fill="#475569" />
      <rect x="1074" y="512" width="88" height="12" rx="3" fill="#64748b" />
      {[1086, 1108, 1130, 1152].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 522 : 524} r="9" fill={i % 2 ? "#f8fafc" : "#facc15"} />
      ))}
      <rect x="1078" y="566" width="6" height="10" fill="#1f2937" />
      <rect x="1152" y="566" width="6" height="10" fill="#1f2937" />
      {/* The net: posts, antennae, mesh, tapes, and the referee on the stand. */}
      {[196, 1004].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="392" width="12" height={NET_Y - 392 + 6} fill="#e5e7eb" />
          <rect x={x + 6} y="392" width="4" height={NET_Y - 392 + 6} fill="#94a3b8" />
        </g>
      ))}
      <rect x="1018" y="360" width="36" height="8" rx="2" fill="#94a3b8" />
      <rect x="1022" y="368" width="4" height="180" fill="#64748b" />
      <rect x="1046" y="368" width="4" height="180" fill="#64748b" />
      {[400, 440, 480, 520].map((y) => (
        <rect key={y} x="1022" y={y} width="28" height="3" fill="#94a3b8" />
      ))}
      <Person x={1036} y={362} h={70} shirt="#f8fafc" skin="#b07a55" hair="#1c1210" stripes />
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
      {/* Clouds, far hills, floodlights. */}
      {[
        [150, 50],
        [520, 34],
        [820, 62],
      ].map(([x, cy], i) => (
        <g key={x} opacity="0.9" className="sc-drift" style={{ animationDelay: `${i * -13}s` }}>
          <ellipse cx={x} cy={cy} rx="46" ry="14" fill="#ffffff" />
          <ellipse cx={x - 22} cy={cy + 4} rx="26" ry="12" fill="#ffffff" />
          <ellipse cx={x + 26} cy={cy + 5} rx="30" ry="12" fill="#ffffff" />
        </g>
      ))}
      <path d="M0 140 Q200 90 420 130 Q640 160 860 110 Q1040 80 1200 130 L1200 180 L0 180Z" fill="#86c98a" />
      {[90, 1110].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="20" width="6" height="150" fill="#94a3b8" />
          <rect x={x - 24} y="12" width="48" height="16" rx="3" fill="#475569" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={x - 20 + i * 11} y="15" width="8" height="10" rx="2" fill="#fef3c7" />
          ))}
        </g>
      ))}
      {/* Trees and the stand behind the goal, under a roof, with the scoreboard. */}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={i * 80 + 20} cy={150 - (i % 3) * 10} r={42 + (i % 2) * 10} fill={i % 2 ? "#15803d" : "#166534"} />
      ))}
      <rect x="300" y="86" width="600" height="12" fill="#334155" />
      <rect x="306" y="98" width="588" height="76" fill="#64748b" />
      {[0, 1, 2].map((r) => (
        <rect key={r} x="306" y={104 + r * 22} width="588" height="3" fill="#475569" />
      ))}
      <Crowd x0={318} x1={882} y0={110} rows={3} gap={20} size={6.5} colors={["#22c55e", "#f8fafc", "#facc15", "#dc2626", "#1d4ed8"]} />
      <rect x="180" y="96" width="112" height="70" rx="5" fill="#111827" />
      <Fit x={236} y={120} w={92} size={12} fill="#f8fafc">
        CITY UNITED
      </Fit>
      <text x="212" y="152" textAnchor="middle" fontSize="26" fontWeight="800" fill="#22c55e" fontFamily="ui-monospace, monospace">
        0
      </text>
      <text x="260" y="152" textAnchor="middle" fontSize="26" fontWeight="800" fill="#facc15" fontFamily="ui-monospace, monospace">
        0
      </text>
      {/* Boards along the back, plain, in the club's colours. */}
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={20 + i * 116} y="174" width="112" height="16" fill={i % 2 ? "#f8fafc" : "#15803d"} />
          <Fit x={76 + i * 116} y={186} w={i % 2 ? 60 : 84} size={9} fill={i % 2 ? "#15803d" : "#f8fafc"}>
            {i % 2 ? "GO CITY" : "ALGEBRIDGE"}
          </Fit>
        </g>
      ))}
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
      {[40, 1160].map((x, i) => (
        <g key={x}>
          <rect x={x - 2} y={GOAL.line - 46} width="4" height="46" fill="#e5e7eb" />
          <g className="sc-sway" style={{ transformOrigin: `${x + 2}px ${GOAL.line - 46}px`, animationDelay: `${i * -1.6}s` }}>
            <path d={`M${x + 2} ${GOAL.line - 46} l18 7 l-18 7Z`} fill="#facc15" />
          </g>
        </g>
      ))}
      {/* Dugouts on both sides: a shelter, the substitutes, a ball bag and cones. */}
      {[0, 1].map((side) => {
        const x = side ? 1010 : 30;
        const shirt = side ? "#facc15" : "#22c55e";
        return (
          <g key={side}>
            <rect x={x} y="306" width="160" height="10" rx="3" fill="#475569" />
            <rect x={x + 4} y="316" width="152" height="52" fill="#93c5fd" opacity="0.45" />
            <rect x={x} y="316" width="6" height="66" fill="#475569" />
            <rect x={x + 154} y="316" width="6" height="66" fill="#475569" />
            <rect x={x + 10} y="366" width="140" height="8" rx="3" fill="#64748b" />
            {[0, 1, 2].map((i) => (
              <Person key={i} x={x + 36 + i * 44} y={366} h={50} shirt={shirt} skin={SKINS[(i + side * 3) % SKINS.length]} hair={HAIRS[(i + 2 + side) % HAIRS.length]} />
            ))}
            {[0, 1, 2].map((i) => (
              <rect key={i} x={x + 20 + i * 44} y="376" width="6" height="12" rx="2" fill="#f8fafc" />
            ))}
          </g>
        );
      })}
      <ellipse cx="220" cy="392" rx="26" ry="12" fill="#1f2937" />
      {[204, 220, 236].map((x, i) => (
        <circle key={x} cx={x} cy={386 - (i % 2) * 4} r="7" fill="#f8fafc" />
      ))}
      {[960, 980, 1000].map((x) => (
        <path key={x} d={`M${x} 396 l6 -18 l6 18Z`} fill="#f97316" />
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

/** The bulbs strung over the rink: where each hangs, from the sag of the line. */
const BULBS = [50, 130, 210, 290, 370, 450, 530, 610, 690, 770, 850, 930, 1010, 1090, 1170].map((x, i) => {
  const t = x / 1200;
  const y = 140 + 90 * Math.sin(Math.PI * (t < 0.5 ? t * 2 : (t - 0.5) * 2)) * (t < 0.5 ? 1 : 0.55) + 20;
  return { x, y: Math.round(y * 10) / 10, color: ["#fbbf24", "#fb7185", "#38bdf8", "#4ade80", "#c084fc", "#fb923c"][i % 6] };
});

/** Snow, in three sheets that fall at their own speeds; each is drawn twice so the loop is seamless. */
function Snow({ seed, fall, r }: { seed: number; fall: string; r: number }) {
  const flakes = Array.from({ length: 24 }, (_, i) => ({ x: (i * 173 + seed * 61) % 1200, y: (i * 97 + seed * 37) % 440 }));
  return (
    <g className="sc-snow" style={{ ["--fall" as string]: fall }}>
      {[0, -440].map((dy) =>
        flakes.map((f, i) => <circle key={`${dy}-${i}`} cx={f.x} cy={f.y + dy} r={r} fill="#ffffff" opacity="0.85" />)
      )}
    </g>
  );
}

/**
 * The rink she skates on, out on its own in the snow: boards with a red
 * rail, mountains and evergreens behind (the end trees strung with lights),
 * stands either side, a skate booth, a warming hut with smoke from its
 * chimney, a Zamboni, lamp posts, a cocoa stand and a fire to warm up at,
 * a snowman, bulbs twinkling over it all and snow coming down. The ice is
 * the same ellipse the game has always used (`RINK` in lib/rink.ts), so her
 * skating and the seven decoration spots around the boards are unchanged.
 */
export function RinkScene() {
  const R = RINK;
  const trees = [40, 130, 215, 300, 380, 470, 560, 650, 740, 830, 920, 1010, 1100, 1180];
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
      {/* Mountains, then snowy hills. */}
      <path d="M0 300 L120 180 L220 250 L340 150 L460 260 L560 200 L660 290 L780 170 L900 260 L1010 190 L1120 280 L1200 230 L1200 340 L0 340Z" fill="#cbd5e1" />
      <path d="M340 150 L380 190 L300 200Z M780 170 L820 208 L740 214Z M1010 190 L1040 222 L980 226Z M120 180 L150 214 L96 218Z" fill="#f8fafc" />
      <path d="M0 330 Q200 250 420 300 Q600 340 800 280 Q1000 230 1200 300 L1200 460 L0 460Z" fill="#e2e8f0" />
      <path d="M0 360 Q260 300 520 340 Q760 370 1000 320 Q1120 300 1200 330 L1200 460 L0 460Z" fill="#f1f5f9" />
      {/* Birds, far off. */}
      {[[260, 120], [300, 108], [340, 124]].map(([x, y]) => (
        <path key={x} d={`M${x - 8} ${y} q8 -6 16 0`} fill="none" stroke="#64748b" strokeWidth="1.5" />
      ))}
      {/* Evergreens in a row, snow on their tips, lights on the two at the ends. */}
      {trees.map((x, i) => {
        const h = 120 + ((i * 37) % 60);
        const base = 430;
        const lit = i === 0 || i === trees.length - 1;
        return (
          <g key={x}>
            <rect x={x - 6} y={base - 18} width="12" height="22" fill="#5b3a21" />
            <path d={`M${x} ${base - h} L${x + 42} ${base - 10} L${x - 42} ${base - 10}Z`} fill="#1f5a3a" />
            <path d={`M${x} ${base - h + 26} L${x + 32} ${base - 42} L${x - 32} ${base - 42}Z`} fill="#2f7a4d" />
            <path d={`M${x} ${base - h} L${x + 10} ${base - h + 22} L${x - 10} ${base - h + 22}Z`} fill="#f8fafc" opacity="0.9" />
            <path d={`M${x - 14} ${base - h + 46} q14 -6 28 0 l-4 6 q-10 -4 -20 0Z`} fill="#f8fafc" opacity="0.8" />
            {lit &&
              [[-6, 40], [8, 54], [-16, 70], [14, 84], [-24, 98], [4, 108], [22, 116], [-10, 122]].map(([dx, dy], j) => (
                <circle key={j} cx={x + dx} cy={base - h + dy} r="4" fill={["#fbbf24", "#fb7185", "#38bdf8", "#4ade80"][j % 4]} className="sc-twinkle" style={{ animationDelay: `${j * -0.45}s` }} />
              ))}
          </g>
        );
      })}
      {/* Snow on the ground. */}
      <rect x="0" y="420" width={W} height={H - 420} fill="#f1f5f9" />
      <rect x="0" y="420" width={W} height="60" fill="#dbe7f3" opacity="0.6" />
      {/* Stands either side, with a crowd in coats and a rail. */}
      {[
        [60, 380],
        [820, 1140],
      ].map(([x0, x1]) => (
        <g key={x0}>
          <rect x={x0} y="352" width={x1 - x0} height="96" fill="#8b5a2b" />
          <rect x={x0} y="352" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0} y="392" width={x1 - x0} height="10" fill="#a9703a" />
          <rect x={x0 - 4} y="346" width={x1 - x0 + 8} height="4" fill="#64748b" />
          <rect x={x0 - 6} y="440" width={x1 - x0 + 12} height="12" fill="#f8fafc" />
          <Crowd x0={x0 + 14} x1={x1 - 8} y0={360} rows={2} gap={40} size={12} colors={["#1d4ed8", "#dc2626", "#0f766e", "#f8fafc", "#7c3aed", "#f97316"]} />
        </g>
      ))}
      {/* The skate booth, the warming hut with its chimney going, the Zamboni: one tidy row. */}
      <rect x="404" y="368" width="104" height="80" fill="#1e40af" />
      <rect x="404" y="368" width="52" height="80" fill="#2563eb" />
      <path d="M396 370 L456 340 L516 370Z" fill="#f8fafc" />
      <rect x="418" y="392" width="76" height="30" fill="#0b1220" />
      <rect x="418" y="392" width="76" height="4" fill="#facc15" />
      <Fit x={456} y={414} w={56} size={13} fill="#facc15">
        SKATES
      </Fit>
      {[428, 448, 468, 488].map((x, i) => (
        <g key={x}>
          <rect x={x - 6} y="430" width="12" height="9" rx="2" fill={i % 2 ? "#f8fafc" : "#1f2937"} />
          <rect x={x - 7} y="438" width="14" height="2" fill="#94a3b8" />
        </g>
      ))}
      <rect x="520" y="322" width="160" height="112" fill="#7c4a2a" />
      <rect x="520" y="322" width="80" height="112" fill="#8f5a35" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="520" y={330 + i * 20} width="160" height="2" fill="#5b3a21" opacity="0.6" />
      ))}
      <path d="M506 326 L600 268 L694 326Z" fill="#334155" />
      <path d="M512 320 L600 266 L688 320 L680 320 L600 276 L520 320Z" fill="#f8fafc" />
      <rect x="640" y="272" width="14" height="30" fill="#475569" />
      <rect x="638" y="268" width="18" height="6" fill="#64748b" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="647" cy="262" r={5 + i} fill="#e2e8f0" className="sc-smoke" style={{ animationDelay: `${i * -1.3}s` }} />
      ))}
      <rect x="546" y="356" width="40" height="34" rx="2" fill="#fde68a" />
      <rect x="564" y="356" width="4" height="34" fill="#5b3a21" />
      <rect x="546" y="371" width="40" height="4" fill="#5b3a21" />
      <rect x="614" y="366" width="42" height="68" fill="#3f2a1a" />
      <circle cx="648" cy="402" r="3" fill="#facc15" />
      <rect x="536" y="292" width="128" height="26" rx="4" fill="#1e3a8a" />
      <Fit x={600} y={311} w={112} size={15} fill="#facc15">
        ALGEBRIDGE RINK
      </Fit>
      <rect x="700" y="392" width="100" height="44" rx="6" fill="#1d4ed8" />
      <rect x="700" y="380" width="44" height="20" rx="4" fill="#1e40af" />
      <rect x="708" y="384" width="28" height="12" fill="#bae6fd" />
      <rect x="760" y="400" width="34" height="22" rx="3" fill="#facc15" />
      <circle cx="722" cy="378" r="4" fill="#f97316" className="sc-blink" />
      {[716, 782].map((x) => (
        <circle key={x} cx={x} cy="438" r="9" fill="#1f2937" />
      ))}
      <rect x="700" y="428" width="100" height="6" fill="#0f172a" opacity="0.3" />
      {/* Lamp posts either side, lit. */}
      {[36, 1164].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="500" width="6" height="200" fill="#334155" />
          <rect x={x - 14} y="488" width="28" height="18" rx="4" fill="#475569" />
          <rect x={x - 10} y="504" width="20" height="5" rx="2" fill="#fef3c7" />
          <circle cx={x} cy="512" r="30" fill="#fde68a" opacity="0.16" />
        </g>
      ))}
      {/* A cocoa stand at the front left, a cup steaming on the counter. */}
      <rect x="70" y="704" width="120" height="66" fill="#9a3412" />
      <rect x="70" y="704" width="60" height="66" fill="#b45309" />
      <rect x="66" y="698" width="128" height="10" rx="3" fill="#f8fafc" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${64 + i * 22} 684 L${86 + i * 22} 684 L${86 + i * 22} 698 L${64 + i * 22} 698Z`} fill={i % 2 ? "#f8fafc" : "#dc2626"} />
      ))}
      <rect x="82" y="716" width="96" height="22" rx="3" fill="#1f2937" />
      <Fit x={130} y={732} w={76} size={12} fill="#fde68a">
        HOT COCOA
      </Fit>
      <rect x="108" y="746" width="14" height="14" rx="2" fill="#f8fafc" />
      <rect x="140" y="746" width="14" height="14" rx="2" fill="#f8fafc" />
      {[0, 1].map((i) => (
        <circle key={i} cx={115 + i * 32} cy="742" r="3" fill="#e2e8f0" className="sc-smoke" style={{ animationDelay: `${i * -1.7}s` }} />
      ))}
      {/* A fire to warm up at, at the front right, two people with their hands out. */}
      <ellipse cx="1080" cy="764" rx="34" ry="12" fill="#94a3b8" />
      <ellipse cx="1080" cy="760" rx="26" ry="8" fill="#475569" />
      <rect x="1064" y="750" width="32" height="6" rx="2" fill="#5b3a21" transform="rotate(-18 1080 753)" />
      <rect x="1064" y="750" width="32" height="6" rx="2" fill="#7c4a2a" transform="rotate(20 1080 753)" />
      <g className="sc-flame">
        <path d="M1066 754 Q1070 728 1080 722 Q1090 728 1094 754Z" fill="#f97316" />
        <path d="M1072 754 Q1076 736 1080 732 Q1084 736 1088 754Z" fill="#fde047" />
      </g>
      <circle cx="1080" cy="746" r="34" fill="#fb923c" opacity="0.14" />
      <Person x={1032} y={768} h={56} shirt="#1d4ed8" skin="#e0ac86" hair="#6b4426" />
      <Person x={1128} y={768} h={56} shirt="#dc2626" skin="#6f432a" hair="#111111" />
      {/* A snowman by the boards, footprints to the hut. */}
      <circle cx="52" cy="640" r="20" fill="#ffffff" />
      <circle cx="52" cy="608" r="15" fill="#ffffff" />
      <circle cx="52" cy="582" r="11" fill="#ffffff" />
      <rect x="44" y="565" width="16" height="10" fill="#1f2937" />
      <rect x="40" y="573" width="24" height="3" fill="#1f2937" />
      <path d="M52 582 l10 2 l-10 2Z" fill="#f97316" />
      {[[49, 579], [56, 579], [52, 603], [52, 612]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#1f2937" />
      ))}
      <path d="M40 594 q-14 -8 -22 -18 M64 594 q14 -8 22 -18" stroke="#5b3a21" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="38" y="596" width="28" height="5" rx="2" fill="#dc2626" />
      {[[590, 468], [604, 480], [592, 492], [606, 504]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="2.4" fill="#cbd5e1" />
      ))}
      {/* A string of bulbs over everything, each twinkling on its own. */}
      <path d="M0 140 Q300 250 600 190 T1200 140" fill="none" stroke="#475569" strokeWidth="3" />
      {BULBS.map((b, i) => (
        <g key={b.x}>
          <rect x={b.x - 2} y={b.y - 14} width="4" height="8" fill="#475569" />
          <g className="sc-twinkle" style={{ animationDelay: `${i * -0.37}s` }}>
            <circle cx={b.x} cy={b.y} r="7" fill={b.color} />
            <circle cx={b.x} cy={b.y} r="12" fill={b.color} opacity="0.25" />
          </g>
        </g>
      ))}
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
      {/* The bulbs' colours, caught in the ice. */}
      {BULBS.filter((b) => b.x > 260 && b.x < 940).map((b, i) => (
        <ellipse key={b.x} cx={b.x} cy={R.cy - R.ry + 34} rx="40" ry="9" fill={b.color} opacity="0.09" className="sc-twinkle" style={{ animationDelay: `${(i + 3) * -0.37}s` }} />
      ))}
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
      {/* Snow coming down. */}
      <Snow seed={1} fall="18s" r={2.2} />
      <Snow seed={2} fall="26s" r={1.6} />
      <Snow seed={3} fall="36s" r={1.2} />
    </svg>
  );
}
