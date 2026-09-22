"use client";

import { Dollhouse } from "@/components/house/Dollhouse";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
  /** Open on the backyard with Veronica already skating, from a "Play" link. */
  autoSkate?: boolean;
}

/**
 * Inside and outside are one flat picture now, so there is nothing left to
 * switch between, the front of the house opens where it stands.
 */
export function HouseRoom({ progress, onUpdate, autoSkate = false }: HouseRoomProps) {
  return <Dollhouse progress={progress} onUpdate={onUpdate} autoSkate={autoSkate} />;
}
