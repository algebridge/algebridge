"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Veronica } from "@/components/house/Veronica";
import { CourtGame } from "@/components/games/CourtGame";
import { Player } from "@/components/games/Players";
import { CourtScene } from "@/components/games/Scenes";
import { pctX, pctY } from "@/lib/dollhouse";
import { COURT_GAMES, depthScale, getCourtGame, type CourtGame as CourtGameConfig, type CourtGameId } from "@/lib/games";
import { today } from "@/lib/path";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { RINK_DAILY_CAP, rinkRemainingToday } from "@/lib/rink";
import type { UserProgress } from "@/types";

const LAST_GAME_KEY = "algebridge:last-game";

/**
 * The games: Veronica on the rink behind your house, and the team on their
 * courts. Pick a teammate, play here. Every game stops for head math from the
 * unit you are on, and all five pay from the same daily pot.
 */
export default function GamesPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [picked, setPicked] = useState<CourtGameId>("wrestling");
  const [playing, setPlaying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => setProgress(getProgress()), []);

  /** Bring the whole court on screen, under the sticky header, before play starts. */
  const showCourt = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const header = 96;
    const room = window.innerHeight - header;
    const top = window.scrollY + box.top - header - Math.max(0, (room - box.height) / 2);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(top - window.scrollY) > 4)
      window.scrollTo({
        top: Math.max(0, top),
        behavior: still ? "auto" : "smooth",
      });
  }, []);

  function play() {
    setPlaying(true);
    showCourt();
  }

  useEffect(() => {
    refresh();
    // Read here rather than with useSearchParams, which would take this
    // prerendered page out of the static build.
    const asked = new URLSearchParams(window.location.search).get("play");
    if (asked && getCourtGame(asked)) {
      setPicked(asked as CourtGameId);
      setPlaying(true);
      window.history.replaceState(null, "", "/games");
      window.setTimeout(showCourt, 60);
    } else {
      try {
        const last = window.localStorage.getItem(LAST_GAME_KEY);
        if (last && getCourtGame(last)) setPicked(last as CourtGameId);
      } catch {
        /* Private windows start on Shaurya. */
      }
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, [refresh, showCourt]);

  function pick(id: CourtGameId) {
    setPicked(id);
    setPlaying(false);
    try {
      window.localStorage.setItem(LAST_GAME_KEY, id);
    } catch {
      /* Remembering the last game is a nicety. */
    }
  }

  const game = getCourtGame(picked)!;
  const remaining = progress ? rinkRemainingToday(progress, today()) : RINK_DAILY_CAP;
  const best = progress?.gameBest?.[picked] ?? 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Games</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Play with the team. Every game stops for a quick head-math question from the unit you are on, and every right answer pays
          Bridgeys, up to {RINK_DAILY_CAP} a day across all five games.
        </p>
      </header>

      {/* The team: pick who to play with. Veronica skates at your house. */}
      <nav aria-label="Pick a game" className="grid grid-cols-5 gap-1.5 sm:gap-3">
        <Link
          href="/house?play=rink"
          className="group flex min-w-0 flex-col items-center rounded-xl border border-slate-200 bg-white px-1 pb-2 pt-2 text-center transition hover:border-teal-300 hover:bg-teal-50/60"
        >
          <span className="flex h-16 w-full items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-sky-100 to-teal-100 sm:h-24">
            <span className="block w-9 translate-y-1 sm:w-14">
              <Veronica pose="idle" className="w-full" />
            </span>
          </span>
          <span className="mt-1.5 w-full truncate text-xs font-semibold text-slate-900 sm:text-sm">Veronica</span>
          <span className="w-full truncate text-[10px] text-slate-500 sm:text-xs">Skating</span>
        </Link>
        {COURT_GAMES.map((g) => (
          <TeamTile key={g.id} game={g} active={g.id === picked} best={progress?.gameBest?.[g.id] ?? 0} onPick={() => pick(g.id)} />
        ))}
      </nav>

      <div
        ref={stage}
        className="relative aspect-[3/2] w-full touch-none select-none overflow-hidden rounded-2xl shadow-raised ring-1 ring-slate-900/5"
      >
        {playing && progress ? (
          <CourtGame key={picked} gameId={picked} progress={progress} onExit={() => setPlaying(false)} onUpdate={refresh} />
        ) : (
          <CourtPreview game={game} onPlay={play} />
        )}
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-900">{game.title}.</span> {game.blurb}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <BridgeysLogo size={15} />
            <span>
              <span className="font-semibold tabular-nums text-slate-900">{remaining}</span> of {RINK_DAILY_CAP} left today, shared by all
              five games
            </span>
          </span>
          {best > 0 && (
            <span>
              Best run with {game.player}: <span className="font-semibold tabular-nums text-slate-900">{best}</span> right in a row
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** One teammate: their picture on their colours, name, sport. */
function TeamTile({ game, active, best, onPick }: { game: CourtGameConfig; active: boolean; best: number; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={`flex min-w-0 flex-col items-center rounded-xl border px-1 pb-2 pt-2 text-center transition ${
        active ? "border-transparent bg-white shadow-md" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
      style={
        active
          ? {
              boxShadow: `0 0 0 2px ${game.accent}, 0 6px 16px -6px rgba(15,23,42,0.25)`,
            }
          : undefined
      }
      title={best > 0 ? `${game.title}. Best run ${best}.` : game.title}
    >
      <span
        className="flex h-16 w-full items-end justify-center overflow-hidden rounded-lg sm:h-24"
        style={{
          background: `linear-gradient(to bottom, ${game.accent}22, ${game.accent}55)`,
        }}
      >
        <span
          className="block translate-y-1"
          style={{
            width: `${(game.height / 182) * 58}%`,
            maxWidth: game.id === "cheer" ? "3rem" : "3.5rem",
          }}
        >
          <Player game={game.id} pose="idle" className="w-full" />
        </span>
      </span>
      <span className="mt-1.5 w-full truncate text-xs font-semibold text-slate-900 sm:text-sm">{game.player}</span>
      <span className="w-full truncate text-[10px] text-slate-500 sm:text-xs">{game.sport}</span>
    </button>
  );
}

/** The court before play: the player waiting where they start, and the way in. */
function CourtPreview({ game, onPlay }: { game: CourtGameConfig; onPlay: () => void }) {
  const scale = depthScale(game.area, game.start.y);
  return (
    <>
      <CourtScene game={game.id} />
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
        style={{
          left: pctX(game.start.x),
          top: pctY(game.start.y),
          width: pctX(((game.height * 100) / 160) * scale),
          zIndex: 340,
        }}
      >
        <Player game={game.id} pose="idle" className="w-full" />
      </div>
      {/* Over the court, clear of the player: the name up top, the way in above their head. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-2.5 sm:pt-4" style={{ zIndex: 360 }}>
        <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-slate-900 shadow-sm backdrop-blur-sm sm:text-base">
          {game.title}
        </p>
      </div>
      <div className="absolute inset-x-0 top-[38%] flex justify-center sm:top-[42%]" style={{ zIndex: 360 }}>
        <button type="button" onClick={onPlay} className="btn-primary inline-flex items-center gap-2 px-7 py-2.5 shadow-lg">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
            <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8Z" />
          </svg>
          Play
        </button>
      </div>
    </>
  );
}
