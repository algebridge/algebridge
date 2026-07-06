"use client";

import { useState } from "react";
import { CartoonExterior } from "@/components/house/CartoonExterior";
import { HouseExplorer } from "@/components/house/HouseExplorer";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
}

export function HouseRoom({ progress, onUpdate }: HouseRoomProps) {
  const [inside, setInside] = useState(false);

  if (inside) {
    return (
      <HouseExplorer
        progress={progress}
        onUpdate={onUpdate}
        onExit={() => setInside(false)}
      />
    );
  }

  return (
    <CartoonExterior
      houseStyleId={progress.houseStyleId}
      bridgeys={progress.bridgeys}
      onEnter={() => setInside(true)}
    />
  );
}
