import Link from "next/link";
import type { ReactNode } from "react";
import { Player } from "@/components/games/Players";
import { Veronica } from "@/components/house/Veronica";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { COURT_GAMES } from "@/lib/games";
import { RINK_DAILY_CAP } from "@/lib/rink";

/**
 * The invitation to the games, on the course page: the whole team in a row,
 * one line on how it works, one button in.
 */
export function GamesBanner() {
  return (
    <section
      aria-labelledby="games-banner-title"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-teal-700 text-white shadow-raised"
    >
      {/* Court lines, faint, behind everything. */}
      <svg aria-hidden viewBox="0 0 1200 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-[0.12]">
        <path d="M0 250 L1200 250 M600 0 L600 300" stroke="#ffffff" strokeWidth="4" />
        <circle cx="600" cy="250" r="90" fill="none" stroke="#ffffff" strokeWidth="4" />
        <rect x="-10" y="120" width="170" height="260" fill="none" stroke="#ffffff" strokeWidth="4" />
        <rect x="1040" y="120" width="170" height="260" fill="none" stroke="#ffffff" strokeWidth="4" />
      </svg>

      <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-7">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-100">Five games, one team</p>
          <h2 id="games-banner-title" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Play with the team
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
            Skate with Veronica, wrestle with Shaurya, cheer with Jo, spike with Jordyn, or score with Rayla. Each game
            stops for a quick head-math question from the unit you are on, and every right answer pays.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition hover:scale-[1.03] hover:bg-violet-50"
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

        {/* The team, standing together, heights true to life. */}
        <div className="relative mx-auto flex h-32 w-full max-w-[20rem] shrink-0 items-end justify-center sm:mx-0 sm:h-40 sm:w-80" aria-hidden>
          <div className="absolute inset-x-2 bottom-1 h-3 rounded-full bg-slate-950/25 blur-[2px]" />
          <TeamMember height={168}>
            <Veronica pose="idle" className="w-full" />
          </TeamMember>
          {COURT_GAMES.map((g, i) => (
            <TeamMember key={g.id} height={g.height}>
              <Player game={g.id} pose="idle" facing={i >= 2 ? -1 : 1} className="w-full" />
            </TeamMember>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamMember({ height, children }: { height: number; children: ReactNode }) {
  // Heights are in the games' units, where the tallest is 182; the row is 100% tall at 190.
  return (
    <div className="-mx-1.5 min-w-0 drop-shadow-[0_6px_8px_rgba(0,0,0,0.3)]" style={{ height: `${(height / 190) * 100}%`, aspectRatio: "100 / 160" }}>
      {children}
    </div>
  );
}
