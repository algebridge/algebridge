"use client";

/** Transparent-background cartoon player for in-room movement. */
export function CartoonPlayer({ size = 48, facing = "down" }: { size?: number; facing?: "up" | "down" | "left" | "right" }) {
  const flip = facing === "left" ? "scaleX(-1)" : "none";
  const bob = facing === "down" || facing === "up" ? "animate-bob" : "";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`drop-shadow-lg ${bob}`}
      style={{ transform: flip }}
      aria-hidden
    >
      {/* shadow */}
      <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000" opacity="0.2" />
      {/* legs */}
      <rect x="24" y="42" width="7" height="14" rx="3" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <rect x="33" y="42" width="7" height="14" rx="3" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      {/* body / hoodie */}
      <rect x="18" y="26" width="28" height="20" rx="8" fill="#2563eb" stroke="#1e293b" strokeWidth="2.5" />
      {/* backpack */}
      <rect x="40" y="28" width="10" height="16" rx="4" fill="#f97316" stroke="#1e293b" strokeWidth="2" />
      {/* head */}
      <circle cx="32" cy="18" r="14" fill="#fcd34d" stroke="#1e293b" strokeWidth="2.5" />
      {/* hair */}
      <path d="M18 16 Q32 2 46 16 Q40 8 32 10 Q24 8 18 16" fill="#1e293b" />
      {/* face */}
      <circle cx="27" cy="18" r="2.5" fill="#1e293b" />
      <circle cx="37" cy="18" r="2.5" fill="#1e293b" />
      <path d="M28 24 Q32 27 36 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
      {/* arms */}
      <rect x="10" y="30" width="10" height="6" rx="3" fill="#fcd34d" stroke="#1e293b" strokeWidth="2" />
      <rect x="44" y="30" width="10" height="6" rx="3" fill="#fcd34d" stroke="#1e293b" strokeWidth="2" />
    </svg>
  );
}
