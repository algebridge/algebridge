"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Unit } from "@/types";
import { ARENA_MODES, BOSS_PAY, bestScore, bossBeaten, type ArenaMode } from "@/lib/arena";
import { getProgress, getSimpleStatus, getSkillProgress } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { Icon } from "@/components/Icon";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";

const ORDER: ArenaMode[] = ["speed", "mistakes", "boss"];

/** The unit's arena on its page: a speed round and spot-the-mistake to play any time, and the boss at the end. */
export function UnitArena({ unit }: { unit: Unit }) {
  const { stats, mounted } = useProgress();
  const [state, setState] = useState<{ done: boolean; best: Record<ArenaMode, number>; beaten: boolean; modes: ArenaMode[] } | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const p = getProgress();
    setState({
      done: unit.skills.every((s) => getSimpleStatus(getSkillProgress(s.id).level) === "complete"),
      best: { boss: bestScore(p, unit.id, "boss"), speed: bestScore(p, unit.id, "speed"), mistakes: bestScore(p, unit.id, "mistakes") },
      beaten: bossBeaten(p, unit.id),
      modes: ORDER,
    });
  }, [unit, mounted, stats.completedSkills]);

  if (!state) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {state.modes.map((mode) => {
        const boss = mode === "boss";
        const locked = boss && !state.done;
        return (
          <Link
            key={mode}
            href={`/unit/${unit.id}/arena/${mode}`}
            className={`arena-tile ${boss ? "arena-tile-boss" : ""} ${locked ? "arena-tile-locked" : ""}`}
          >
            <span className="flex items-center gap-2 font-bold">
              <Icon name={boss ? (locked ? "lock" : "trophy") : mode === "speed" ? "clock" : "search"} size={17} />
              {ARENA_MODES[mode].title}
            </span>
            <span className="mt-1 block text-sm opacity-80">{ARENA_MODES[mode].line}</span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
              {boss ? (
                state.beaten ? (
                  "Beaten"
                ) : locked ? (
                  "Finish every skill to face it"
                ) : (
                  <>
                    <BridgeysLogo size={13} />+{BOSS_PAY} for the first win
                  </>
                )
              ) : state.best[mode] > 0 ? (
                `Best: ${state.best[mode]}`
              ) : (
                "No score yet"
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
