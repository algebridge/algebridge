"use client";

import { getHouseStyle } from "@/data/house-catalog";

interface GameHudProps {
  houseStyleId: string;
  onExit?: () => void;
  mode: "outside" | "inside";
  hint?: string;
  /** Which side of the house is showing, and the switch between them. */
  view?: "front" | "back";
  onView?: (view: "front" | "back") => void;
}

/**
 * The strip that labels the game view. It used to be a dark navy slab with a
 * gold balance chip, which fought the bright room art below it and repeated a
 * balance the page header already shows much larger. It is now the same
 * header strip every other panel on the platform uses, so the only saturated
 * thing on screen is the game world itself.
 */
export function GameHud({ houseStyleId, onExit, mode, hint, view, onView }: GameHudProps) {
  const house = getHouseStyle(houseStyleId);

  return (
    <div className="panel-head">
      <div className="flex min-w-0 items-center gap-3">
        {onExit && (
          <button type="button" onClick={onExit} className="btn-secondary btn-sm">
            ← {mode === "inside" ? "Step outside" : "Back"}
          </button>
        )}
        <p className="panel-title truncate">{house?.name}</p>
        {view && onView && (
          <div role="tablist" aria-label="Which side of the house" className="inline-flex gap-0.5 rounded-lg bg-slate-200/70 p-0.5">
            {(["front", "back"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => onView(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {v === "front" ? "Front" : "Backyard"}
              </button>
            ))}
          </div>
        )}
      </div>

      {hint && <p className="hidden text-xs text-slate-500 sm:block">{hint}</p>}
    </div>
  );
}
