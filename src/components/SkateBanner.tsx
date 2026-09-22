import Link from "next/link";
import { Veronica } from "@/components/house/Veronica";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { RINK_DAILY_CAP } from "@/lib/rink";

/**
 * The invitation to the rink, on the course page. One picture, one line,
 * one button that lands on the ice with Veronica already skating.
 */
export function SkateBanner() {
  return (
    <section
      aria-labelledby="skate-banner-title"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-700 to-indigo-800 text-white shadow-raised"
    >
      {/* A string of bulbs along the top, from the rink's own light arch. */}
      <svg aria-hidden viewBox="0 0 1200 60" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-10 w-full opacity-90">
        <path d="M0 8 Q150 44 300 8 T600 8 T900 8 T1200 8" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        {[60, 160, 240, 360, 460, 540, 660, 760, 840, 960, 1060, 1140].map((x, i) => {
          const t = (x % 300) / 300;
          const y = 8 + 36 * Math.sin(Math.PI * t) * 0.5;
          const colors = ["#fbbf24", "#fb7185", "#38bdf8", "#4ade80", "#c084fc", "#fb923c"];
          return <circle key={x} cx={x} cy={y + 8} r="5" fill={colors[i % colors.length]} />;
        })}
      </svg>

      <div className="relative flex items-center gap-4 px-6 pb-6 pt-10 sm:gap-8 sm:px-8 sm:pb-7 sm:pt-11">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-100">A game, on the rink behind your house</p>
          <h2 id="skate-banner-title" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Skate with Veronica
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
            Glide around the rink, skate through the ring, and answer a quick head-math question from the unit you are
            on. Every right answer pays.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/house?play=rink"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-teal-800 shadow-sm transition hover:scale-[1.03] hover:bg-teal-50"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8Z" />
              </svg>
              Play now
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80">
              <BridgeysLogo size={14} />
              Up to {RINK_DAILY_CAP} Bridgeys a day
            </span>
          </div>
        </div>

        {/* The rink, with her on it. */}
        <div className="relative w-36 shrink-0 sm:w-56" aria-hidden>
          <svg viewBox="0 0 220 140" className="w-full">
            <ellipse cx="110" cy="112" rx="104" ry="26" fill="#0f172a" opacity="0.25" />
            <ellipse cx="110" cy="104" rx="104" ry="26" fill="#cbd5e1" />
            <ellipse cx="110" cy="101" rx="104" ry="26" fill="#dc2626" />
            <ellipse cx="110" cy="101" rx="99" ry="23" fill="#f1f5f9" />
            <ellipse cx="110" cy="100" rx="94" ry="20" fill="#dbe7f3" />
            <ellipse cx="110" cy="99" rx="90" ry="17" fill="#f4f8fc" />
            <ellipse cx="110" cy="100" rx="34" ry="7" fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.7" />
            <rect x="109" y="84" width="2" height="32" fill="#dc2626" opacity="0.5" />
            <path d="M40 96 Q110 78 180 96 Q110 86 40 96Z" fill="#ffffff" opacity="0.6" />
            {/* Motion, the way a skate leaves a line. */}
            <path d="M24 92 q18 -6 40 2" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <path d="M30 100 q14 -4 30 1" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
          <div className="absolute bottom-6 left-1/2 w-[38%] -translate-x-1/2">
            <Veronica pose="skate" speed={0.55} className="w-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
