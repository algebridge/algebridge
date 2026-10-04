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
 * The demo of this page on algebridge.org: the progress it plays on lives in
 * the caller's state (lib/progress-sandbox.ts), where what the games pay and
 * their best runs already land through the progress store. The board then
 * touches no storage of its own: the game picked is not remembered, the
 * ?play link is not read, the page is not scrolled (an iframe sized to its
 * content has no header and nothing to scroll), and the rink is not
 * decorated, since nothing has been bought for it.
 */
export interface GamesDemoStore {
  progress: UserProgress;
  /** Called by a game after each change, as /games calls getProgress. */
  refresh: () => void;
}

/**
 * The games: Veronica on her rink, and the team on their courts. Pick a
 * teammate, play here. Every game stops for head math from the unit you are
 * on, and all five pay from the same daily pot. The rink is also where the
 * pieces bought for it stand, and where they are moved around. /games
 * renders it on the student's save; /demo/games hands it a sandbox (`demo`).
 */
export function GamesBoard({ demo }: { demo?: GamesDemoStore }) {
  const [saved, setSaved] = useState<UserProgress | null>(null);
  const inDemo = !!demo;
  const progress = demo ? demo.progress : saved;
  const [picked, setPicked] = useState<GameId>("rink");
  const [playing, setPlaying] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const demoRefresh = demo?.refresh;
  const refresh = useCallback(() => {
    if (demoRefresh) demoRefresh();
    else setSaved(getProgress());
  }, [demoRefresh]);

  /**
   * Bring the whole court on screen, under the sticky header, before play
   * starts. On a phone it goes to the top, just under the header (the
   * stage's scroll-mt-16): the question comes up as a sheet from the
   * bottom, and a court in the middle of the screen sat under it.
   */
  const showCourt = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const header = 96;
    const room = window.innerHeight - header;
    const phone = window.innerWidth < 640;
    const top = phone
      ? window.scrollY + box.top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 64)
      : window.scrollY + box.top - header - Math.max(0, (room - box.height) / 2);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(top - window.scrollY) > 4) window.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
  }, []);

  function play() {
    setDecorating(false);
    setPlacing(null);
    setPlaying(true);
    if (!inDemo) showCourt();
  }

  useEffect(() => {
    if (inDemo) return;
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
  }, [inDemo, refresh, showCourt]);

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
    if (inDemo) return;
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
        {/* The demo sits under the heading algebridge.org gives it. */}
        {!inDemo && <h1 className="page-title">Games</h1>}
        <p className="page-subtitle">
          Play with the team. Every game stops for a quick head-math question from the unit you are on, and every right answer pays
          Bridgeys, up to {RINK_DAILY_CAP} a day across all five games.
        </p>
      </header>

      {/* The team: pick who to play with. */}
      <nav aria-label="Pick a game" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
        {GAME_CARDS.map((g) => (
          <TeamTile key={g.id} card={g} active={g.id === picked} best={g.id === "rink" ? (progress?.rink?.best ?? 0) : (progress?.gameBest?.[g.id] ?? 0)} onPick={() => pick(g.id)} />
        ))}
      </nav>

      <div
        ref={stage}
        className={`relative aspect-[3/2] w-full scroll-mt-16 touch-none select-none overflow-hidden rounded-2xl shadow-raised ring-1 ring-slate-900/5 ${placing ? "cursor-crosshair" : ""} ${
          // Before play, keep the scene's high z-index controls (Play,
          // Decorate) inside it, so they never paint over the sticky header.
          // During play the question dialog is a fixed overlay inside the
          // stage and must stay above everything, so the stage stays open.
          playing ? "" : "isolate"
        }`}
      >
        {picked === "rink" ? (
          <>
            {/* The scene moves only during play (and on screen); before it, a still picture. */}
            <RinkScene live={playing} />
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
              <RinkGame key="rink" progress={progress} onExit={() => setPlaying(false)} onUpdate={refresh} demo={inDemo} />
            ) : (
              <RinkPreview
                card={card}
                decorating={decorating}
                placing={placing}
                onPlay={play}
                onDecorate={
                  inDemo
                    ? undefined
                    : () => {
                        setDecorating((d) => !d);
                        setPlacing(null);
                      }
                }
                onCancel={() => setPlacing(null)}
              />
            )}
          </>
        ) : playing && progress ? (
          <CourtGame key={picked} gameId={picked as CourtGameId} progress={progress} onExit={() => setPlaying(false)} onUpdate={refresh} demo={inDemo} />
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
        {inDemo && <p className="text-xs text-slate-500">Demo: nothing is saved.</p>}
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
      className={`flex min-w-0 shrink-0 basis-[31%] snap-start flex-col items-center rounded-xl border px-1 pb-2 pt-2 text-center transition duration-150 ease-out active:scale-[0.98] sm:shrink sm:basis-auto ${
        active ? "border-transparent bg-white shadow-md" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-raised"
      }`}
      style={active ? { boxShadow: `0 0 0 2px ${card.accent}, 0 6px 16px -6px rgba(15,23,42,0.25)` } : undefined}
      title={best > 0 ? `${card.title}. Best run ${best}.` : card.title}
    >
      <span
        className="figures-still flex h-20 w-full items-end justify-center overflow-hidden rounded-lg sm:h-28"
        style={{ background: `${card.accent}2e` }}
      >
        {/* Cropped below the knees, like a team card, so the player fills the tile. */}
        <span className="block translate-y-[12%]" style={{ width: `${(card.height / 182) * 58}%`, maxWidth: "5rem" }}>
          {card.id === "rink" ? <Veronica pose="idle" className="w-full" /> : <Player game={card.id} pose="idle" className="w-full" />}
        </span>
      </span>
      <span className="mt-1.5 w-full truncate text-xs font-semibold text-slate-900 sm:text-sm">{card.player}</span>
      <span className="w-full truncate text-[11px] text-slate-500 sm:text-xs">{card.sport}</span>
      <span
        aria-hidden
        className={`mt-1 h-1 w-6 rounded-full transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
        style={{ background: card.accent }}
      />
    </button>
  );
}

/** The play button and the game's name, over a court before play. */
function StageChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-2.5 sm:pt-4" style={{ zIndex: 360 }}>
        <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-slate-900 shadow-sm sm:text-base">{title}</p>
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
      <CourtScene game={game.id} live={false} />
      {/* figures-still: before play the player is a picture, so their idle motion holds. */}
      <div
        className="figures-still pointer-events-none absolute -translate-x-1/2 -translate-y-full"
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

/** The rink before play: Veronica by the boards, the way in, and the way to decorate (none in the demo). */
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
  onDecorate?: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        className="figures-still pointer-events-none absolute -translate-x-1/2 -translate-y-full"
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
            {onDecorate && (
              <button type="button" onClick={onDecorate} className="btn-secondary shadow-lg">
                Decorate
              </button>
            )}
          </>
        )}
      </StageChrome>
    </>
  );
}
