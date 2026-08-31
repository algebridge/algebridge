"use client";

import { Dollhouse } from "@/components/house/Dollhouse";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
}

/**
 * Inside and outside are one flat picture now, so there is nothing left to
 * switch between, the front of the house opens where it stands.
 */
export function HouseRoom({ progress, onUpdate }: HouseRoomProps) {
  return <Dollhouse progress={progress} onUpdate={onUpdate} />;
}
