"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppNavState } from "@/components/AppNavProvider";
import { units } from "@/data/curriculum";
import { liveFromProgress } from "@/lib/house-functions";
import type { LiveData } from "@/lib/house3d/types";
import type { UserProgress } from "@/types";

/**
 * What the pieces show for this student: today's goal, the streak, the books
 * and trophies earned, the skill they are on. `tick` keeps the clocks on the
 * minute (the house itself); the shop's pictures need only the numbers.
 */
export function useHouseLive(progress: UserProgress, { tick = false }: { tick?: boolean } = {}): LiveData {
  const { continueTarget } = useAppNavState();
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    if (!tick) return;
    const id = window.setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 30000);
    return () => window.clearInterval(id);
  }, [tick]);
  const next = useMemo(() => {
    if (!continueTarget) return null;
    const skill = units.flatMap((u) => u.skills).find((s) => s.id === continueTarget.skillId);
    return skill ? { title: skill.title, keyIdea: skill.keyIdea } : { title: continueTarget.skillTitle, keyIdea: "" };
  }, [continueTarget]);
  return useMemo(() => liveFromProgress(progress, next, new Date(minute * 60000)), [progress, next, minute]);
}
