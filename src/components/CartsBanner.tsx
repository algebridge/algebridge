import Link from "next/link";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { RINK_DAILY_CAP } from "@/lib/rink";
import { HideInSchoolMode } from "@/components/SchoolModePanel";

/**
 * The announcement on the course page: Alge Carts is open to everyone
 * (Nov 2026). One line on how it works, one button in. Not shown in school
 * mode, which turns the games off (src/lib/school-mode.ts); the arena lives
 * under /games.
 */
export function CartsBanner() {
  return (
    <HideInSchoolMode>
      <section
        aria-labelledby="carts-banner-title"
        className="relative overflow-hidden rounded-2xl bg-slate-950 text-white shadow-panel"
      >
        {/* Neon Harbor at night: a glow on the water line, behind everything. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 85% 70%, rgba(34,211,238,0.28), transparent 70%), radial-gradient(50% 70% at 20% 20%, rgba(217,70,239,0.22), transparent 70%)",
          }}
        />

        <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300">New on AlgeBridge</p>
            <h2 id="carts-banner-title" className="mt-1.5 font-display text-[28px] font-normal leading-[1.05] tracking-[0.01em] sm:text-[34px]">
              Alge Carts is open
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90">
              Eight karts, one arena, three minutes. Drive into a question box and answer it to load the booster: rockets, mines, turbo and
              more. Other students are on the track with you, and every right answer pays.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/games/carts"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:-translate-y-px hover:bg-amber-300"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8Z" />
                </svg>
                Play Alge Carts
              </Link>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                <BridgeysLogo size={14} />
                Up to {RINK_DAILY_CAP} Bridgeys a day
              </span>
            </div>
          </div>

          <KartScene />
        </div>
      </section>
    </HideInSchoolMode>
  );
}

/** A kart at speed and the question box ahead of it, drawn in lines. */
function KartScene() {
  return (
    <svg
      viewBox="0 0 360 200"
      className="mx-auto h-36 w-full max-w-[22rem] shrink-0 sm:mx-0 sm:h-44 sm:w-[22rem]"
      aria-hidden
    >
      {/* The track. */}
      <rect x="0" y="150" width="360" height="26" fill="#1e293b" />
      <path d="M0 163h360" stroke="#f8fafc" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="22 16" />
      <path d="M0 176h360" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="2" />

      {/* Speed lines behind the kart. */}
      <g stroke="#f8fafc" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round">
        <path d="M18 112h40M8 126h34M24 140h30" />
      </g>

      {/* The kart, side on, nose to the right. */}
      <g>
        <rect x="84" y="86" width="22" height="7" rx="2" fill="#f472b6" />
        <path d="M95 93v14" stroke="#f472b6" strokeWidth="4" />
        <path d="M86 132c0-8 6-14 14-14h18l10-16h30l12 16h38c8 0 14 6 14 14v6H86Z" fill="#fbbf24" />
        <path d="M118 118h18l10-16h30l12 16" fill="none" stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />
        <rect x="130" y="110" width="28" height="12" rx="3" fill="#0f172a" />
        <ellipse cx="190" cy="108" rx="10" ry="4" fill="none" stroke="#0f172a" strokeWidth="3" />
        <path d="M188 112v8" stroke="#0f172a" strokeWidth="3" />
        {/* The driver. */}
        <path d="M150 112c0-10 8-16 18-16s18 6 18 16v4h-36Z" fill="#7c3aed" />
        <circle cx="168" cy="84" r="17" fill="#f8fafc" />
        <path d="M172 76a12 12 0 0 1 10 12v4h-14v-8a4 4 0 0 1 4-8Z" fill="#22d3ee" />
        <path d="M176 100l12 6" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
        {/* Wheels. */}
        <circle cx="118" cy="148" r="19" fill="#0f172a" />
        <circle cx="118" cy="148" r="8" fill="#94a3b8" />
        <circle cx="208" cy="148" r="19" fill="#0f172a" />
        <circle cx="208" cy="148" r="8" fill="#94a3b8" />
      </g>

      {/* The question box ahead, with its glow. */}
      <g transform="translate(300 96)">
        <circle r="38" fill="#facc15" fillOpacity="0.18" />
        <rect x="-24" y="-24" width="48" height="48" rx="8" fill="#facc15" transform="rotate(12)" />
        <text x="0" y="12" textAnchor="middle" fontSize="36" fontWeight="800" fill="#0f172a" fontFamily="inherit">
          ?
        </text>
      </g>
    </svg>
  );
}
