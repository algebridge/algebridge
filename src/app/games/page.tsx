"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { RinkGame } from "@/components/house/RinkGame";
import { Veronica } from "@/components/house/Veronica";
import { CourtGame } from "@/components/games/CourtGame";
import { Player } from "@/components/games/Players";
import { RinkDecor, RinkTray } from "@/components/games/RinkDecor";
import { CourtScene, RinkScene } from "@/components/games/Scenes";
import { pctX, pctY } from "@/lib/dollhouse";
import { depthScale, GAME_CARDS, getCourtGame, getGameCard, isGameId, type CourtGameId, type GameCard, type GameId } from "@/lib/games";
import { today } from "@/lib/path";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { RINK, RINK_DAILY_CAP, rinkRemainingToday } from "@/lib/rink";
import type { UserProgress } from "@/types";

const LAST_GAME_KEY = "algebridge:last-game";

/**
 * The games: Veronica on her rink, and the team on their courts. Pick a
 * teammate, play here. Every game stops for head math from the unit you are
 * on, and all five pay from the same daily pot. The rink is also where the
 * pieces bought for it stand, and where they are moved around.
 */
export default function GamesPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [picked, setPicked] = useState<GameId>("rink");
  const [playing, setPlaying] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
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
    if (Math.abs(top - window.scrollY) > 4) window.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
  }, []);

  function play() {
    setDecorating(false);
    setPlacing(null);
    setPlaying(true);
    showCourt();
  }

  useEffect(() => {
    refresh();
    // Read here rather than with useSearchParams, which would take this
    // prerendered page out of the static build.
    const asked = new URLSearchParams(window.location.search).get("play");
    if (isGameId(asked)) {
      setPicked(asked);
      setPlaying(true);
      window.history.replaceState(null, "", "/games");
      window.setTimeout(showCourt, 60);
    } else {
      try {
        const last = window.localStorage.getItem(LAST_GAME_KEY);
        if (isGameId(last)) setPicked(last);
      } catch {
        /* Private windows start on the rink. */
      }
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, [refresh, showCourt]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlacing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(id: GameId) {
    setPicked(id);
    setPlaying(false);
    setDecorating(false);
    setPlacing(null);
    try {
      window.localStorage.setItem(LAST_GAME_KEY, id);
    } catch {
      /* Remembering the last game is a nicety. */
    }
  }

  const card = getGameCard(picked)!;
  const remaining = progress ? rinkRemainingToday(progress, today()) : RINK_DAILY_CAP;
  const best = picked === "rink" ? (progress?.rink?.best ?? 0) : (progress?.gameBest?.[picked] ?? 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Games</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Play with the team. Every game stops for a quick head-math question from the unit you are on, and every right answer pays
          Bridgeys, up to {RINK_DAILY_CAP} a day across all five games.
        </p>
      </header>

      {/* The team: pick who to play with. */}
      <nav aria-label="Pick a game" className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {GAME_CARDS.map((g) => (
          <TeamTile key={g.id} card={g} active={g.id === picked} best={g.id === "rink" ? (progress?.rink?.best ?? 0) : (progress?.gameBest?.[g.id] ?? 0)} onPick={() => pick(g.id)} />
        ))}
      </nav>

      <div
        ref={stage}
        className={`relative aspect-[3/2] w-full touch-none select-none overflow-hidden rounded-2xl shadow-raised ring-1 ring-slate-900/5 ${placing ? "cursor-crosshair" : ""}`}
      >
        {picked === "rink" ? (
          <>
            <RinkScene />
            {progress && (
              <RinkDecor
                progress={progress}
                decorating={decorating && !playing}
                placing={placing}
                onChange={() => {
                  setPlacing(null);
                  refresh();
                }}
              />
            )}
            {playing && progress ? (
              <RinkGame key="rink" progress={progress} onExit={() => setPlaying(false)} onUpdate={refresh} />
            ) : (
              <RinkPreview
                card={card}
                decorating={decorating}
                placing={placing}
                onPlay={play}
                onDecorate={() => {
                  setDecorating((d) => !d);
                  setPlacing(null);
                }}
                onCancel={() => setPlacing(null)}
              />
            )}
          </>
        ) : playing && progress ? (
          <CourtGame key={picked} gameId={picked as CourtGameId} progress={progress} onExit={() => setPlaying(false)} onUpdate={refresh} />
        ) : (
          <CourtPreview card={card} onPlay={play} />
        )}
      </div>

      {picked === "rink" && decorating && !playing && progress && (
        <RinkTray progress={progress} placing={placing} onPick={(id) => setPlacing((cur) => (cur === id ? null : id))} />
      )}

      <div className="space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-900">{card.title}.</span> {card.blurb}
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
              Best run with {card.player}: <span className="font-semibold tabular-nums text-slate-900">{best}</span> right in a row
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** One teammate: their picture on their colours, name, sport. */
function TeamTile({ card, active, best, onPick }: { card: GameCard; active: boolean; best: number; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={`flex min-w-0 flex-col items-center rounded-xl border px-1 pb-2 pt-2 text-center transition ${
        active ? "border-transparent bg-white shadow-md" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
      style={active ? { boxShadow: `0 0 0 2px ${card.accent}, 0 6px 16px -6px rgba(15,23,42,0.25)` } : undefined}
      title={best > 0 ? `${card.title}. Best run ${best}.` : card.title}
    >
      <span
        className="flex h-16 w-full items-end justify-center overflow-hidden rounded-lg sm:h-24"
        style={{ background: `linear-gradient(to bottom, ${card.accent}22, ${card.accent}55)` }}
      >
        <span className="block translate-y-1" style={{ width: `${(card.height / 182) * 58}%`, maxWidth: "3.5rem" }}>
          {card.id === "rink" ? <Veronica pose="idle" className="w-full" /> : <Player game={card.id} pose="idle" className="w-full" />}
        </span>
      </span>
      <span className="mt-1.5 w-full truncate text-xs font-semibold text-slate-900 sm:text-sm">{card.player}</span>
      <span className="w-full truncate text-[10px] text-slate-500 sm:text-xs">{card.sport}</span>
    </button>
  );
}

/** The play button and the game's name, over a court before play. */
function StageChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-2.5 sm:pt-4" style={{ zIndex: 360 }}>
        <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-slate-900 shadow-sm backdrop-blur-sm sm:text-base">{title}</p>
      </div>
      <div className="absolute inset-x-0 top-[38%] flex justify-center gap-2 sm:top-[42%]" style={{ zIndex: 360 }}>
        {children}
      </div>
    </>
  );
}

function PlayButton({ onPlay }: { onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="btn-primary inline-flex items-center gap-2 px-7 py-2.5 shadow-lg">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
        <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8Z" />
      </svg>
      Play
    </button>
  );
}

/** A court before play: the player waiting where they start, and the way in. */
function CourtPreview({ card, onPlay }: { card: GameCard; onPlay: () => void }) {
  const game = getCourtGame(card.id)!;
  const scale = depthScale(game.area, game.start.y);
  return (
    <>
      <CourtScene game={game.id} />
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
        style={{ left: pctX(game.start.x), top: pctY(game.start.y), width: pctX(((game.height * 100) / 160) * scale), zIndex: 340 }}
      >
        <Player game={game.id} pose="idle" className="w-full" />
      </div>
      <StageChrome title={card.title}>
        <PlayButton onPlay={onPlay} />
      </StageChrome>
    </>
  );
}

/** The rink before play: Veronica by the boards, the way in, and the way to decorate. */
function RinkPreview({
  card,
  decorating,
  placing,
  onPlay,
  onDecorate,
  onCancel,
}: {
  card: GameCard;
  decorating: boolean;
  placing: string | null;
  onPlay: () => void;
  onDecorate: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
        style={{ left: pctX(RINK.cx + RINK.rx - 30), top: pctY(RINK.cy + 96), width: pctX((card.height * 100) / 160), zIndex: 330 }}
      >
        <Veronica pose="idle" facing={-1} className="w-full" />
      </div>
      <StageChrome title={decorating ? (placing ? "Tap a spot by the boards" : "Decorate the rink") : card.title}>
        {decorating ? (
          placing ? (
            <button type="button" onClick={onCancel} className="btn-secondary shadow-lg">
              Cancel
            </button>
          ) : (
            <button type="button" onClick={onDecorate} className="btn-primary px-6 py-2.5 shadow-lg">
              Done
            </button>
          )
        ) : (
          <>
            <PlayButton onPlay={onPlay} />
            <button type="button" onClick={onDecorate} className="btn-secondary shadow-lg">
              Decorate
            </button>
          </>
        )}
      </StageChrome>
    </>
  );
}
