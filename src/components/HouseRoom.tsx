"use client";

import { Dollhouse } from "@/components/house/Dollhouse";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
  /** Switches the page to the Shop. */
  onShop?: () => void;
}

/**
 * Inside and outside are one flat picture now, so there is nothing left to
 * switch between, the front of the house opens where it stands.
 */
export function HouseRoom({ progress, onUpdate, onShop }: HouseRoomProps) {
  return <Dollhouse progress={progress} onUpdate={onUpdate} onShop={onShop} />;
}
