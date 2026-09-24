"use client";

import Link from "next/link";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { USABLE } from "@/data/furniture-art";
import { getRinkItem } from "@/data/rink-catalog";
import { clearRinkSlot, placeRinkItem, unplacedRinkItems } from "@/lib/bridgeys";
import { pctX, pctY } from "@/lib/dollhouse";
import { showToast } from "@/lib/notify";
import { RINK_SLOTS } from "@/lib/rink";
import type { UserProgress } from "@/types";

/**
 * What stands around Veronica's rink: the pieces a student bought, on the
 * seven spots by the boards. Shown on the rink whether or not they are
 * decorating; while they are, the empty spots light up and a placed piece
 * can be tapped to pick it up.
 */
export function RinkDecor({
  progress,
  decorating,
  placing,
  onChange,
}: {
  progress: UserProgress;
  decorating: boolean;
  /** The piece picked from the tray, waiting for a spot. */
  placing: string | null;
  onChange: () => void;
}) {
  const decor = progress.rinkDecor ?? {};
  const colors = progress.itemColors ?? {};
  return (
    <>
      {RINK_SLOTS.map((slot) => {
        const id = decor[slot.id];
        const item = id ? getRinkItem(id) : undefined;
        if (!item && !placing) return null;
        const live = decorating && (placing || item);
        return (
          <button
            key={slot.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (placing) {
                const res = placeRinkItem(slot.id, placing);
                showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
                if (res.ok) onChange();
                return;
              }
              if (!decorating) return;
              const res = clearRinkSlot(slot.id);
              showToast({ icon: "review", tone: "info", title: res.message });
              if (res.ok) onChange();
            }}
            title={item ? `${item.name}${decorating ? ", tap to pick it up" : ""}` : `Put it ${slot.label}`}
            className={`absolute -translate-x-1/2 -translate-y-full ${
              item ? `dh-piece ${decorating ? "transition-transform hover:scale-105" : ""} ${USABLE.has(item.id) ? "dh-lit" : ""}` : "dh-slot rounded-full ring-2 ring-white ring-offset-2 ring-offset-rose-400/60"
            } ${live ? "" : "pointer-events-none"}`}
            style={{
              left: pctX(slot.x),
              top: pctY(slot.y),
              height: pctY((item?.height ?? 60) * slot.scale),
              aspectRatio: "1 / 1",
              zIndex: 200 + slot.depth * 20,
            }}
          >
            {item ? (
              <CartoonFurnitureArt itemId={item.id} fill color={colors[item.id]} className="drop-shadow-[0_4px_5px_rgba(0,0,0,0.3)]" />
            ) : (
              <span className="sr-only">Empty spot, {slot.label}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

/** The tray under the rink while decorating: the pieces you own that are standing nowhere. */
export function RinkTray({ progress, placing, onPick }: { progress: UserProgress; placing: string | null; onPick: (id: string) => void }) {
  const spare = unplacedRinkItems(progress);
  const standing = Object.keys(progress.rinkDecor ?? {}).length;
  const colors = progress.itemColors ?? {};
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Decorate the rink</p>
        <p className="text-xs text-slate-500 tabular-nums">
          {standing} of {RINK_SLOTS.length} spots taken
        </p>
      </div>
      {spare.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          {standing === 0 ? (
            <>
              Nothing for the rink yet. Rink pieces are in the Shop at{" "}
              <Link href="/house" className="font-semibold text-bridge-700 underline-offset-2 hover:underline">
                your house
              </Link>
              , under Rink.
            </>
          ) : (
            "Everything you own is out by the boards. Tap a piece to pick it up again."
          )}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {spare.map((id) => {
              const name = getRinkItem(id)?.name;
              if (!name) return null;
              const active = placing === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(id)}
                  className={`flex w-24 flex-col items-center gap-1 rounded-xl border bg-white p-2 transition ${
                    active ? "border-bridge-500 ring-2 ring-bridge-200" : "border-slate-200 hover:border-bridge-300 hover:shadow-panel"
                  }`}
                >
                  <span className="relative block h-12 w-12">
                    <CartoonFurnitureArt itemId={id} fill color={colors[id]} />
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">{name}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Pick a piece, then tap one of the spots that light up around the rink. Tap a piece on the rink to pick it up.</p>
        </>
      )}
    </div>
  );
}
