"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { GameChip } from "@/components/games/GameProblemDialog";
import { SIDE_COLORS } from "@/lib/game-session";

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
