"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { GameChip } from "@/components/games/GameProblemDialog";
import { Athlete } from "@/components/games/Players";
import { MATCH_LENGTHS, SIDE_COLORS, type GameSetup, type PlayerKind } from "@/lib/game-session";
import type { CourtGameId } from "@/lib/games";

/**
 * The pieces of a two-player match that sit on the court: the score, a name
 * tag and a ring of each side's color at each player's feet, and the end.
 */

/** The score, in each side's color: "Maya 3 · Leo 2 · first to 5". */
export function MatchScore({ names, score, toWin }: { names: [string, string]; score: [number, number]; toWin: number }) {
  return (
    <GameChip>
      {([0, 1] as const).map((side) => (
        <span key={side} className="inline-flex items-center gap-1">
          {side === 1 && (
            <span aria-hidden className="mx-0.5 text-slate-300">
              ·
            </span>
          )}
          <span className="h-2 w-2 rounded-full" style={{ background: SIDE_COLORS[side] }} aria-hidden />
          <span className="max-w-[6rem] truncate">{names[side]}</span>
          <span className="tabular-nums text-slate-900">{score[side]}</span>
        </span>
      ))}
      <span aria-hidden className="text-slate-300">
        ·
      </span>
      <span className="text-slate-500">first to {toWin}</span>
    </GameChip>
  );
}

/** Over a player's head and under their feet, in their side's color. */
export function SideMarks({ side, name }: { side: 0 | 1; name: string }) {
  const color = SIDE_COLORS[side];
  return (
    <>
      <span
        aria-hidden
        className="absolute bottom-0 left-1/2 h-[9%] w-[78%] -translate-x-1/2 translate-y-1/2 rounded-[50%]"
        style={{ border: `3px solid ${color}`, background: `${color}22`, zIndex: -1 }}
      />
      <span
        className="absolute -top-1 left-1/2 max-w-[9rem] -translate-x-1/2 -translate-y-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow-sm sm:text-xs"
        style={{ background: color }}
      >
        {name}
      </span>
    </>
  );
}

/** The end of a match: who won, the score, and the ways on. */
export function MatchEnd({ winner, names, score, onRematch, onLeave }: { winner: 0 | 1; names: [string, string]; score: [number, number]; onRematch: () => void; onLeave: () => void }) {
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    again.current?.focus({ preventScroll: true });
  }, []);
  const loser = winner === 0 ? 1 : 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 p-4" style={{ zIndex: 950 }} role="dialog" aria-modal="true" aria-labelledby="match-end-title">
      <div className="animate-pop-in w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-2xl">
        <div className="px-5 py-4 text-white" style={{ background: SIDE_COLORS[winner] }}>
          <Icon name="trophy" size={28} className="mx-auto" />
          <p id="match-end-title" className="mt-1 text-2xl font-black tracking-tight">
            {names[winner]} wins
          </p>
          <p className="text-sm font-semibold opacity-90 tabular-nums">
            {score[winner]} to {score[loser]}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 p-4">
          <button ref={again} type="button" onClick={onRematch} className="btn-primary">
            <Icon name="review" size={16} />
            Rematch
          </button>
          <button type="button" onClick={onLeave} className="btn-secondary">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Before a match: each player types their name and picks a boy or a girl to
 * play as, and the match length is set. On the court itself, where the two
 * players are looking, rather than in the settings under it.
 */
export function MatchSetupCard({
  setup,
  onChange,
  onStart,
  onCancel,
  game,
}: {
  setup: GameSetup;
  onChange: (patch: Partial<GameSetup>) => void;
  onStart: () => void;
  onCancel: () => void;
  /** The court's sport, for the way the players stand in the pictures. */
  game: CourtGameId;
}) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const setName = (side: 0 | 1, value: string) => {
    const names: [string, string] = [...setup.names];
    names[side] = value.slice(0, 14);
    onChange({ names });
  };
  const setKind = (side: 0 | 1, kind: PlayerKind) => {
    const kinds: [PlayerKind, PlayerKind] = [...setup.kinds];
    kinds[side] = kind;
    onChange({ kinds });
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center overflow-y-auto bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="match-setup-title">
      <form
        className="animate-pop-in w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <h2 id="match-setup-title" className="text-lg font-bold text-slate-900">
          Who is playing?
        </h2>
        <p className="text-sm text-slate-600">Type your names and pick who you play as.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([0, 1] as const).map((side) => (
            <fieldset key={side} className="overflow-hidden rounded-xl border-2" style={{ borderColor: SIDE_COLORS[side] }}>
              <legend className="sr-only">Player {side + 1}</legend>
              <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white" style={{ background: SIDE_COLORS[side] }}>
                Player {side + 1} <span className="font-semibold normal-case opacity-90">· {side === 0 ? "W A S D or the left half" : "arrow keys or the right half"}</span>
              </p>
              <div className="space-y-2 p-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Name</span>
                  <input
                    ref={side === 0 ? first : undefined}
                    value={setup.names[side]}
                    onChange={(e) => setName(side, e.target.value)}
                    placeholder={`Player ${side + 1}`}
                    maxLength={14}
                    autoComplete="off"
                    className="mt-0.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-[15px] font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
                  />
                </label>
                <div role="radiogroup" aria-label={`Player ${side + 1} plays as`} className="grid grid-cols-2 gap-2">
                  {(["boy", "girl"] as const).map((kind) => {
                    const on = setup.kinds[side] === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setKind(side, kind)}
                        className={`flex flex-col items-center rounded-lg border-2 px-2 pb-1.5 pt-1 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                          on ? "bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                        style={on ? { borderColor: SIDE_COLORS[side] } : undefined}
                      >
                        <span className="figures-still block h-24 w-[3.75rem] overflow-hidden">
                          <Athlete kind={kind} side={side} game={game} name={kind === "boy" ? "Boy" : "Girl"} className="w-full" />
                        </span>
                        {kind === "boy" ? "Boy" : "Girl"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">First to</span>
            <div role="radiogroup" aria-label="Points to win" className="inline-flex rounded-xl bg-slate-100 p-1">
              {MATCH_LENGTHS.map((nToWin) => (
                <button
                  key={nToWin}
                  type="button"
                  role="radio"
                  aria-checked={setup.toWin === nToWin}
                  onClick={() => onChange({ toWin: nToWin })}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${setup.toWin === nToWin ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {nToWin}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Back
            </button>
            <button type="submit" className="btn-primary">
              <Icon name="play" size={16} />
              Start match
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
