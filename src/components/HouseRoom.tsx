"use client";

import { useState } from "react";
import { YardViewer } from "@/components/house/YardViewer";
import { RoomPanorama } from "@/components/house/RoomPanorama";
import type { UserProgress } from "@/types";

interface HouseRoomProps {
  progress: UserProgress;
  onUpdate: () => void;
}

export function HouseRoom({ progress, onUpdate }: HouseRoomProps) {
  const [inside, setInside] = useState(false);

  if (inside) {
    return (
      <RoomPanorama
        progress={progress}
        onUpdate={onUpdate}
        onExit={() => setInside(false)}
      />
    );
  }

  return (
    // Every style has a turntable, so the yard is walk-around-able.
    <YardViewer
      progress={progress}
      onUpdate={onUpdate}
      onEnter={() => setInside(true)}
    />
  );
}
