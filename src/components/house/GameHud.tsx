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
  /** Night over the house, and the switch for it. */
  night?: boolean;
  onNight?: (night: boolean) => void;
}

/**
 * The strip that labels the game view. It used to be a dark navy slab with a
 * gold balance chip, which fought the bright room art below it and repeated a
 * balance the page header already shows much larger. It is now the same
 * header strip every other panel on the platform uses, so the only saturated
 * thing on screen is the game world itself.
 */
export function GameHud({ houseStyleId, onExit, mode, hint, view, onView, night = false, onNight }: GameHudProps) {
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

      <div className="flex items-center gap-3">
        {hint && <p className="hidden text-xs text-slate-500 sm:block">{hint}</p>}
        {onNight && (
          <button
            type="button"
            onClick={() => onNight(!night)}
            aria-pressed={night}
            title={night ? "Morning" : "Night"}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              night ? "border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {night ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              )}
            </svg>
            {night ? "Morning" : "Night"}
          </button>
        )}
      </div>
    </div>
  );
}
