/** SVG cartoon room interiors — full-bleed, no white boxes, harmonized per house style. */

interface RoomProps {
  className?: string;
}

export function CartoonRoomBackground({ houseId, className = "" }: { houseId: string; className?: string }) {
  switch (houseId) {
    case "treehouse":
      return <TreehouseRoom className={className} />;
    case "loft":
      return <LoftRoom className={className} />;
    case "beach":
      return <BeachRoom className={className} />;
    case "castle":
      return <CastleRoom className={className} />;
    default:
      return <CottageRoom className={className} />;
  }
}

function CottageRoom({ className }: RoomProps) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cottage-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id="cottage-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <rect width="800" height="320" fill="url(#cottage-wall)" />
      <rect y="320" width="800" height="180" fill="url(#cottage-floor)" />
      {/* wood planks */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line key={i} x1={i * 110} y1="320" x2={i * 110 - 40} y2="500" stroke="#78350f" strokeWidth="2" opacity="0.35" />
      ))}
      {/* window */}
      <rect x="300" y="60" width="200" height="140" rx="8" fill="#bae6fd" stroke="#1e293b" strokeWidth="4" />
      <line x1="400" y1="60" x2="400" y2="200" stroke="#1e293b" strokeWidth="3" />
      <line x1="300" y1="130" x2="500" y2="130" stroke="#1e293b" strokeWidth="3" />
      {/* baseboard */}
      <rect y="300" width="800" height="20" fill="#b45309" stroke="#1e293b" strokeWidth="2" />
      {/* cozy rug area hint */}
      <ellipse cx="400" cy="400" rx="180" ry="60" fill="#fbbf24" opacity="0.25" />
    </svg>
  );
}

function TreehouseRoom({ className }: RoomProps) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="tree-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#65a30d" />
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="#365314" />
      <rect width="800" height="500" fill="url(#tree-wall)" opacity="0.85" />
      {/* round treehouse walls */}
      <ellipse cx="400" cy="480" rx="360" ry="80" fill="#78350f" opacity="0.4" />
      <rect y="280" width="800" height="220" fill="#92400e" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <rect key={i} x={i * 95} y="280" width="90" height="220" fill={i % 2 ? "#a16207" : "#92400e"} stroke="#78350f" strokeWidth="1" />
      ))}
      {/* round window */}
      <circle cx="400" cy="120" r="70" fill="#bae6fd" stroke="#1e293b" strokeWidth="4" />
      <circle cx="400" cy="120" r="55" fill="none" stroke="#1e293b" strokeWidth="2" />
      {/* leaves */}
      {[120, 200, 600, 680].map((x, i) => (
        <ellipse key={i} cx={x} cy={40 + (i % 2) * 20} rx="50" ry="30" fill="#22c55e" stroke="#166534" strokeWidth="2" />
      ))}
      <text x="400" y="130" textAnchor="middle" fontSize="14" fill="#166534" fontWeight="bold">🌿</text>
    </svg>
  );
}

function LoftRoom({ className }: RoomProps) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="280" fill="#cbd5e1" />
      <rect y="280" width="800" height="220" fill="#64748b" />
      {/* brick accent */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <rect key={i} x={(i % 5) * 160 + (Math.floor(i / 5) % 2) * 40} y={20 + Math.floor(i / 5) * 30} width="150" height="24" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
      ))}
      {/* big window with city */}
      <rect x="180" y="40" width="440" height="180" rx="4" fill="#38bdf8" stroke="#1e293b" strokeWidth="4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={220 + i * 70} y="80" width="40" height="100" fill="#475569" opacity="0.6" />
      ))}
      {/* modern floor */}
      <rect y="280" width="800" height="220" fill="#334155" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 100} y="280" width="100" height="220" fill={i % 2 ? "#475569" : "#334155"} />
      ))}
    </svg>
  );
}

function BeachRoom({ className }: RoomProps) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="300" fill="#fef08a" />
      <rect y="300" width="800" height="200" fill="#fcd34d" />
      {/* bamboo walls */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
        <rect key={i} x={i * 68} y="0" width="20" height="300" fill="#ca8a04" stroke="#92400e" strokeWidth="1" />
      ))}
      {/* ocean window */}
      <rect x="250" y="50" width="300" height="130" rx="20" fill="#0ea5e9" stroke="#1e293b" strokeWidth="4" />
      <path d="M250 150 Q325 120 400 150 T550 150" fill="none" stroke="#fff" strokeWidth="3" opacity="0.7" />
      <circle cx="480" cy="80" r="25" fill="#fde047" stroke="#f97316" strokeWidth="2" />
      {/* sand floor */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <circle key={i} cx={80 + i * 75} cy={360 + (i % 3) * 40} r="4" fill="#d97706" opacity="0.4" />
      ))}
    </svg>
  );
}

function CastleRoom({ className }: RoomProps) {
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="castle-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#castle-wall)" />
      {/* stone blocks */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
        <rect
          key={i}
          x={(i % 6) * 135 + (Math.floor(i / 6) % 2) * 30}
          y={Math.floor(i / 6) * 45}
          width="125"
          height="38"
          rx="3"
          fill="#a78bfa"
          stroke="#6d28d9"
          strokeWidth="1.5"
          opacity="0.7"
        />
      ))}
      {/* arched window */}
      <path d="M320 60 L320 180 L480 180 L480 60 Q400 10 320 60 Z" fill="#312e81" stroke="#1e293b" strokeWidth="4" />
      <text x="400" y="130" textAnchor="middle" fontSize="28" fill="#fde047">x²</text>
      {/* floor */}
      <rect y="300" width="800" height="200" fill="#5b21b6" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 100} y="300" width="100" height="200" fill={i % 2 ? "#6d28d9" : "#5b21b6"} stroke="#4c1d95" strokeWidth="1" />
      ))}
      {/* torches */}
      <rect x="60" y="200" width="12" height="60" fill="#92400e" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="66" cy="195" rx="14" ry="18" fill="#fbbf24" opacity="0.9" />
      <rect x="728" y="200" width="12" height="60" fill="#92400e" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="734" cy="195" rx="14" ry="18" fill="#fbbf24" opacity="0.9" />
    </svg>
  );
}

/** Cartoon yard / sky scene behind the house exterior. */
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
      {/* clouds */}
      <ellipse cx="150" cy="70" rx="55" ry="28" fill="#fff" opacity="0.9" />
      <ellipse cx="190" cy="65" rx="40" ry="22" fill="#fff" opacity="0.85" />
      <ellipse cx="600" cy="50" rx="60" ry="30" fill="#fff" opacity="0.9" />
      <ellipse cx="650" cy="55" rx="35" ry="20" fill="#fff" opacity="0.8" />
      {/* hills */}
      <ellipse cx="200" cy="380" rx="280" ry="100" fill="url(#hill)" />
      <ellipse cx="600" cy="390" rx="320" ry="110" fill="#22c55e" />
      {/* path */}
      <path d="M400 400 Q380 320 400 260 Q420 320 400 400" fill="#d97706" opacity="0.5" />
      {/* flowers */}
      {[
        [100, 340], [700, 350], [250, 360], [550, 355],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill={["#f472b6", "#fbbf24", "#a78bfa", "#fb7185"][i]} />
          <line x1={x} y1={y} x2={x} y2={y + 12} stroke="#166534" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
