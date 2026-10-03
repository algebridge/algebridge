"use client";

import { DemoCard } from "@/components/demo/DemoCard";
import { HouseConsole } from "@/components/house/HouseConsole";
import { STARTER_HOUSE_ID } from "@/data/house-catalog";
import { normalizeProgress } from "@/lib/progress";
import { useProgressSandbox } from "@/lib/progress-sandbox";
import type { UserProgress } from "@/types";

/**
 * What a visitor starts with: the free cottage and enough Bridgeys for two
 * or three common pieces, so the loop of buying, placing and painting can be
 * felt rather than read about. The same seed on every visit; nothing from it
 * is saved.
 */
function seed(): UserProgress {
  return normalizeProgress({
    bridgeys: 160,
    bridgeysLifetime: 160,
    houseStyleId: STARTER_HOUSE_ID,
    ownedHouseStyles: [STARTER_HOUSE_ID],
  });
}

/**
 * Bridgey House for algebridge.org: the real house, shop and titles on a
 * progress that lives in memory for as long as the card is on screen.
 */
export function HouseDemo() {
  const { progress, refresh } = useProgressSandbox(seed);
  return (
    <DemoCard>
      <HouseConsole progress={progress} onUpdate={refresh} embedded />
      <p className="mt-4 text-center text-xs text-slate-500">Demo: nothing is saved.</p>
    </DemoCard>
  );
}
