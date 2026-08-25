"use client";

import { getHouseStyle } from "@/data/house-catalog";

interface GameHudProps {
  houseStyleId: string;
  onExit?: () => void;
  mode: "outside" | "inside";
  hint?: string;
}

/**
 * The strip that labels the game view. It used to be a dark navy slab with a
 * gold balance chip, which fought the bright room art below it and repeated a
 * balance the page header already shows much larger. It is now the same
 * header strip every other panel on the platform uses, so the only saturated
 * thing on screen is the game world itself.
 */
export function GameHud({ houseStyleId, onExit, mode, hint }: GameHudProps) {
  const house = getHouseStyle(houseStyleId);

  return (
    <div className="panel-head">
      <div className="flex min-w-0 items-center gap-3">
        {onExit && (
          <button type="button" onClick={onExit} className="btn-secondary btn-sm">
            ← {mode === "inside" ? "Step outside" : "Back"}
          </button>
        )}
        <p className="panel-title truncate">
          <span aria-hidden className="mr-1.5">{house?.emoji}</span>
          {house?.name}
        </p>
      </div>

      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
