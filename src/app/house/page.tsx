"use client";

import { useEffect, useState } from "react";
import { HouseConsole } from "@/components/house/HouseConsole";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { hasUnlimitedBridgeys } from "@/lib/bridgeys";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import type { UserProgress } from "@/types";

/**
 * /house: the student's own Bridgey House. The house itself lives in
 * components/house/HouseConsole.tsx, shared with /demo/house; this page is
 * the part that reads the save and keeps up with it.
 */
export default function HousePage() {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  /** The founder's allowance, handed over with the profile. */
  const [unlimited, setUnlimited] = useState(false);
  // School mode turns the leaderboard and the team games off (src/lib/school-mode.ts),
  // so the house does not point to them or sell pieces for the rink.
  const school = useSchoolMode();

  function refresh() {
    setProgress(getProgress());
    setUnlimited(hasUnlimitedBridgeys());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
    // Read here rather than with useSearchParams, which would take this
    // prerendered page out of the static build.
    // The rink moved to the Games page; an old "Play" link still gets there.
    if (new URLSearchParams(window.location.search).get("play") === "rink") {
      window.location.replace("/games?play=rink");
      return;
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  if (!mounted || !progress) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return <HouseConsole progress={progress} onUpdate={refresh} unlimited={unlimited} school={school} />;
}
