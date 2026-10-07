"use client";

import { House3D } from "@/components/house/House3D";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
  /** Switches the page to the Shop. */
  onShop?: () => void;
  /** Inside algebridge.org's frame (/demo/house): what a piece opens, opens in the app. */
  embedded?: boolean;
}

/**
 * The house as a real 3D place: your rooms, upstairs and down, and your
 * garden, where every piece has a job (components/house/House3D.tsx).
 */
export function HouseRoom({ progress, onUpdate, onShop, embedded = false }: HouseRoomProps) {
  return <House3D progress={progress} onUpdate={onUpdate} onShop={onShop} embedded={embedded} />;
}
