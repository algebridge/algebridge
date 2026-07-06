"use client";

import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { getHouseStyle } from "@/data/house-catalog";

interface GameHudProps {
  houseStyleId: string;
  bridgeys: number;
  onExit?: () => void;
  mode: "outside" | "inside";
  hint?: string;
}

export function GameHud({ houseStyleId, bridgeys, onExit, mode, hint }: GameHudProps) {
  const house = getHouseStyle(houseStyleId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white shadow-lg sm:px-4">
      <div className="flex items-center gap-3">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20"
          >
            ← {mode === "inside" ? "Outside" : "Back"}
          </button>
        )}
        <BridgeysLogo size={28} />
        <span className="hidden text-sm font-bold text-amber-300 sm:inline">Bridgeys</span>
      </div>

      <div className="flex items-center gap-2 text-center">
        <span className="text-lg">{house?.emoji}</span>
        <span className="font-display text-sm tracking-wide sm:text-base">{house?.name}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-full bg-amber-500/20 px-3 py-1 ring-1 ring-amber-400/50">
          <span className="text-sm font-bold text-amber-300">{bridgeys.toLocaleString()}</span>
        </div>
      </div>

      {hint && (
        <p className="w-full text-center text-[10px] text-slate-400 sm:text-xs">{hint}</p>
      )}
    </div>
  );
}
