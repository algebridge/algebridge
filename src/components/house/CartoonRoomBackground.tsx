/** SVG cartoon room interiors — cozy, themed per house style. Full-bleed
 *  backdrop that the walking player and furniture render on top of. */

type ViewKind = "day" | "forest" | "city" | "ocean" | "night";

interface RoomTheme {
  id: string;
  wallTop: string;
  wallBottom: string;
  wallStripe: string;
  molding: string;
  floorTop: string;
  floorBottom: string;
  plank: string;
  baseboard: string;
  baseboardHi: string;
  accent: string;
  rugOuter: string;
  rugInner: string;
  frame: string;
  view: ViewKind;
}

const THEMES: Record<string, RoomTheme> = {
  cottage: {
    id: "cottage", wallTop: "#fff8e1", wallBottom: "#fde8ad", wallStripe: "#fef0c4",
    molding: "#eab308", floorTop: "#e2952f", floorBottom: "#9a5312", plank: "#7c3d10",
    baseboard: "#c2731d", baseboardHi: "#f6c667", accent: "#e07b39",
    rugOuter: "#dc2626", rugInner: "#fca5a5", frame: "#8b5a2b", view: "day",
  },
  treehouse: {
    id: "treehouse", wallTop: "#dcfce7", wallBottom: "#86efac", wallStripe: "#bbf7d0",
    molding: "#15803d", floorTop: "#a16207", floorBottom: "#5c3310", plank: "#3f230b",
    baseboard: "#78450a", baseboardHi: "#ca9a4a", accent: "#22c55e",
    rugOuter: "#16a34a", rugInner: "#bbf7d0", frame: "#5c3310", view: "forest",
  },
  loft: {
    id: "loft", wallTop: "#e5e9f0", wallBottom: "#c3cbd9", wallStripe: "#d5dbe6",
    molding: "#64748b", floorTop: "#8a94a6", floorBottom: "#3f4756", plank: "#2b313c",
    baseboard: "#5b6472", baseboardHi: "#aab3c2", accent: "#38bdf8",
    rugOuter: "#0ea5e9", rugInner: "#bae6fd", frame: "#475569", view: "city",
  },
  beach: {
    id: "beach", wallTop: "#e0f2fe", wallBottom: "#fde68a", wallStripe: "#fef3c7",
    molding: "#0284c7", floorTop: "#fcd34d", floorBottom: "#d99327", plank: "#a1690f",
    baseboard: "#eab308", baseboardHi: "#fef08a", accent: "#06b6d4",
    rugOuter: "#0891b2", rugInner: "#a5f3fc", frame: "#0e7490", view: "ocean",
  },
  castle: {
    id: "castle", wallTop: "#ddd6fe", wallBottom: "#a78bfa", wallStripe: "#c4b5fd",
    molding: "#6d28d9", floorTop: "#7c3aed", floorBottom: "#3b0764", plank: "#2e1065",
    baseboard: "#5b21b6", baseboardHi: "#a78bfa", accent: "#c084fc",
    rugOuter: "#7c3aed", rugInner: "#ddd6fe", frame: "#4c1d95", view: "night",
  },
};

const WALL_H = 330; // floor starts here (of 500)

export function CartoonRoomBackground({ houseId, className = "" }: { houseId: string; className?: string }) {
  const t = THEMES[houseId] ?? THEMES.cottage;
  return <Room t={t} className={className} />;
}

/** The scene visible through the window, clipped to it. */
function WindowView({ view, id }: { view: ViewKind; id: string }) {
  const clip = `url(#winclip-${id})`;
  if (view === "night") {
    return (
      <g clipPath={clip}>
        <rect x="330" y="70" width="140" height="150" fill="#1e1b4b" />
        <circle cx="430" cy="110" r="20" fill="#fde68a" />
        <circle cx="422" cy="104" r="20" fill="#1e1b4b" />
        {[[350, 100], [380, 150], [345, 175], [455, 190], [410, 200], [360, 130]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#fef9c3" />
        ))}
      </g>
    );
  }
  if (view === "ocean") {
    return (
      <g clipPath={clip}>
        <rect x="330" y="70" width="140" height="80" fill="#7dd3fc" />
        <rect x="330" y="150" width="140" height="70" fill="#0891b2" />
        <circle cx="440" cy="110" r="16" fill="#fde68a" />
        <path d="M330 165 q35 -12 70 0 t70 0" fill="none" stroke="#e0f7ff" strokeWidth="2.5" opacity="0.7" />
        <path d="M330 190 q35 -12 70 0 t70 0" fill="none" stroke="#e0f7ff" strokeWidth="2.5" opacity="0.5" />
      </g>
    );
  }
  if (view === "city") {
    return (
      <g clipPath={clip}>
        <rect x="330" y="70" width="140" height="150" fill="#94b8e0" />
        {[[338, 150, 22, 70], [364, 120, 26, 100], [396, 140, 20, 80], [420, 105, 28, 115], [452, 135, 18, 85]].map(
          ([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#475569" opacity="0.85" />
              {[0, 1, 2].map((r) =>
                [0, 1].map((c) => (
                  <rect key={`${r}-${c}`} x={x + 4 + c * 9} y={y + 8 + r * 16} width="4" height="6" fill="#fde68a" opacity="0.8" />
                ))
              )}
            </g>
          )
        )}
      </g>
    );
  }
  if (view === "forest") {
    return (
      <g clipPath={clip}>
        <rect x="330" y="70" width="140" height="150" fill="#bbf7d0" />
        {[[345, 130, 34], [400, 110, 44], [450, 140, 30], [375, 175, 30], [430, 185, 34]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#22c55e" : "#16a34a"} opacity="0.9" />
        ))}
        <circle cx="345" cy="100" r="15" fill="#fde68a" opacity="0.8" />
      </g>
    );
  }
  // day
  return (
    <g clipPath={clip}>
      <rect x="330" y="70" width="140" height="150" fill="#8ecdf5" />
      <rect x="330" y="70" width="140" height="150" fill="url(#sky-in)" />
      <circle cx="440" cy="108" r="18" fill="#fde047" />
      <circle cx="440" cy="108" r="26" fill="#fde047" opacity="0.35" />
      <ellipse cx="368" cy="120" rx="26" ry="13" fill="#fff" opacity="0.95" />
      <ellipse cx="388" cy="115" rx="18" ry="10" fill="#fff" opacity="0.9" />
      <ellipse cx="360" cy="185" rx="30" ry="15" fill="#fff" opacity="0.85" />
      <ellipse cx="470" cy="205" rx="90" ry="34" fill="#86efac" />
      <ellipse cx="330" cy="212" rx="70" ry="26" fill="#4ade80" />
    </g>
  );
}

function Room({ t, className }: { t: RoomTheme; className?: string }) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`wall-${t.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.wallTop} />
          <stop offset="100%" stopColor={t.wallBottom} />
        </linearGradient>
        <linearGradient id={`floor-${t.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.floorTop} />
          <stop offset="100%" stopColor={t.floorBottom} />
        </linearGradient>
        <linearGradient id="sky-in" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="70%" stopColor="#cdeeff" />
        </linearGradient>
        <linearGradient id={`beam-${t.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fffbe6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`vign-${t.id}`} cx="50%" cy="46%" r="72%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <clipPath id={`winclip-${t.id}`}>
          <rect x="330" y="70" width="140" height="150" rx="6" />
        </clipPath>
      </defs>

      {/* ---- Wall ---- */}
      <rect width="800" height={WALL_H} fill={`url(#wall-${t.id})`} />
      {/* faint wallpaper stripes */}
      {[70, 190, 310, 430, 550, 670, 790].map((x) => (
        <rect key={x} x={x} y="0" width="34" height={WALL_H} fill={t.wallStripe} opacity="0.5" />
      ))}
      {/* crown molding */}
      <rect x="0" y="30" width="800" height="10" fill={t.molding} opacity="0.55" />

      {/* ---- Window ---- */}
      <g>
        {/* outer frame + sill */}
        <rect x="318" y="58" width="164" height="176" rx="12" fill={t.frame} />
        <rect x="326" y="66" width="148" height="160" rx="8" fill="#e6f4ff" />
        <WindowView view={t.view} id={t.id} />
        {/* muntins */}
        <line x1="400" y1="70" x2="400" y2="220" stroke={t.frame} strokeWidth="6" />
        <line x1="330" y1="145" x2="470" y2="145" stroke={t.frame} strokeWidth="6" />
        <rect x="326" y="66" width="148" height="160" rx="8" fill="none" stroke={t.frame} strokeWidth="3" />
        {/* sill */}
        <rect x="308" y="230" width="184" height="12" rx="4" fill={t.frame} />
        {/* curtains */}
        <path d="M318 56 q-26 90 -6 178 q20 -14 22 -60 q-14 -60 -16 -118 Z" fill={t.accent} opacity="0.85" />
        <path d="M482 56 q26 90 6 178 q-20 -14 -22 -60 q14 -60 16 -118 Z" fill={t.accent} opacity="0.85" />
        <path d="M318 56 q-16 90 -6 178" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="4" />
        <path d="M482 56 q16 90 6 178" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="4" />
      </g>

      {/* sunbeam onto the floor */}
      <path d="M338 234 L462 234 L560 360 L250 360 Z" fill={`url(#beam-${t.id})`} />

      {/* ---- Wall decor ---- */}
      {/* framed art left */}
      <g>
        <rect x="110" y="96" width="96" height="76" rx="4" fill={t.frame} />
        <rect x="118" y="104" width="80" height="60" fill="#fef9f0" />
        <path d="M118 150 l22 -26 16 16 20 -28 22 38 Z" fill={t.accent} opacity="0.55" />
        <circle cx="176" cy="120" r="8" fill="#fbbf24" />
      </g>
      {/* framed art right (a little math) */}
      <g>
        <rect x="600" y="104" width="90" height="66" rx="4" fill={t.frame} />
        <rect x="607" y="111" width="76" height="52" fill="#fef9f0" />
        <text x="645" y="145" textAnchor="middle" fontSize="26" fontWeight="bold" fill={t.frame}>x²</text>
      </g>
      {/* wall shelf with items */}
      <g>
        <rect x="560" y="220" width="150" height="9" rx="3" fill={t.frame} />
        <rect x="575" y="196" width="16" height="24" rx="2" fill={t.accent} />
        <rect x="596" y="188" width="16" height="32" rx="2" fill={t.molding} />
        <rect x="617" y="200" width="16" height="20" rx="2" fill={t.accent} opacity="0.7" />
        <circle cx="660" cy="210" r="10" fill="#22c55e" />
        <rect x="656" y="210" width="8" height="12" fill="#a16207" />
      </g>
      {/* hanging plant left */}
      <g>
        <line x1="270" y1="40" x2="270" y2="86" stroke={t.frame} strokeWidth="2" />
        <path d="M250 86 h40 l-6 26 h-28 Z" fill="#c2731d" />
        <ellipse cx="270" cy="86" rx="26" ry="14" fill="#22c55e" />
        <path d="M258 92 q-8 30 -2 48" fill="none" stroke="#16a34a" strokeWidth="3" />
        <path d="M282 92 q8 26 3 44" fill="none" stroke="#16a34a" strokeWidth="3" />
      </g>

      {/* ---- Floor ---- */}
      <rect y={WALL_H} width="800" height={500 - WALL_H} fill={`url(#floor-${t.id})`} />
      {/* perspective planks fanning from a vanishing point */}
      {Array.from({ length: 11 }).map((_, i) => {
        const xTop = 400 + (i - 5) * 58;
        const xBot = 400 + (i - 5) * 128;
        return <line key={i} x1={xTop} y1={WALL_H} x2={xBot} y2="500" stroke={t.plank} strokeWidth="2" opacity="0.4" />;
      })}
      {/* horizontal plank seams (closer near the back) */}
      {[WALL_H + 18, WALL_H + 46, WALL_H + 84, WALL_H + 134].map((y, i) => (
        <line key={i} x1="0" y1={y} x2="800" y2={y} stroke={t.plank} strokeWidth="1.5" opacity="0.25" />
      ))}

      {/* ---- Rug ---- */}
      <g>
        <ellipse cx="400" cy="428" rx="210" ry="66" fill={t.rugOuter} opacity="0.92" />
        <ellipse cx="400" cy="428" rx="176" ry="52" fill={t.rugInner} opacity="0.9" />
        <ellipse cx="400" cy="428" rx="176" ry="52" fill="none" stroke={t.rugOuter} strokeWidth="4" opacity="0.7" />
        <ellipse cx="400" cy="428" rx="120" ry="34" fill="none" stroke={t.rugOuter} strokeWidth="3" strokeDasharray="8 8" opacity="0.6" />
      </g>

      {/* ---- Baseboard + ambient shadow at the wall/floor seam ---- */}
      <rect x="0" y={WALL_H - 16} width="800" height="16" fill={t.baseboard} />
      <rect x="0" y={WALL_H - 16} width="800" height="3" fill={t.baseboardHi} opacity="0.8" />
      <rect x="0" y={WALL_H} width="800" height="22" fill="#000" opacity="0.14" />

      {/* ---- Vignette for depth ---- */}
      <rect width="800" height="500" fill={`url(#vign-${t.id})`} />
    </svg>
  );
}

/** Cartoon yard / sky scene behind the house exterior (SVG fallback). */
export function CartoonYardBackground({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 400" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#sky)" />
      <ellipse cx="150" cy="70" rx="55" ry="28" fill="#fff" opacity="0.9" />
      <ellipse cx="190" cy="65" rx="40" ry="22" fill="#fff" opacity="0.85" />
      <ellipse cx="600" cy="50" rx="60" ry="30" fill="#fff" opacity="0.9" />
      <ellipse cx="650" cy="55" rx="35" ry="20" fill="#fff" opacity="0.8" />
      <ellipse cx="200" cy="380" rx="280" ry="100" fill="url(#hill)" />
      <ellipse cx="600" cy="390" rx="320" ry="110" fill="#22c55e" />
      <path d="M400 400 Q380 320 400 260 Q420 320 400 400" fill="#d97706" opacity="0.5" />
      {[[100, 340], [700, 350], [250, 360], [550, 355]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill={["#f472b6", "#fbbf24", "#a78bfa", "#fb7185"][i]} />
          <line x1={x} y1={y} x2={x} y2={y + 12} stroke="#166534" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
