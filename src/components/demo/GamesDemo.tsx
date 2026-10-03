"use client";

import { DemoCard } from "@/components/demo/DemoCard";
import { GamesBoard } from "@/components/games/GamesBoard";
import { units } from "@/data/curriculum";
import { normalizeProgress } from "@/lib/progress";
import { useProgressSandbox } from "@/lib/progress-sandbox";
import type { SkillProgress, UserProgress } from "@/types";

/**
 * The student the demo plays as: Unit 1 finished, so every game draws its
 * head math from Unit 2 (rinkSkillIds in lib/rink.ts), and nothing earned
 * today, so the day's shared pot is full. The same seed on every visit.
 */
function seed(): UserProgress {
  const skills: Record<string, SkillProgress> = {};
  for (const s of units[0].skills) {
    skills[s.id] = { skillId: s.id, level: "mastered", problemsAttempted: 5, problemsCorrect: 5, solved: 5, videoWatched: true, videoWatchedVerified: true };
  }
  return normalizeProgress({ skills });
}

/**
 * The Games page for algebridge.org: all five games, playable, on a progress
 * that lives in memory for as long as the card is on screen. What an answer
 * pays goes through the sandbox's store (lib/progress-sandbox.ts) and shows
 * in the HUD; none of it is saved.
 */
export function GamesDemo() {
  const { progress, refresh } = useProgressSandbox(seed);
  return (
    // Capped near the width /games gives the court, so the scene keeps its size on a wide frame.
    <DemoCard className="mx-auto max-w-5xl">
      <GamesBoard demo={{ progress, refresh }} />
    </DemoCard>
  );
}
