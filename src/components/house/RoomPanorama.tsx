"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameHud } from "@/components/house/GameHud";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { getFurnitureItem, getHouseStyle, getUnplacedFurnitureIds } from "@/data/house-catalog";
import { placeFurnitureAt, removePlacedFurniture } from "@/lib/bridgeys";
import { showToast } from "@/lib/notify";
import type { OnStrip } from "@/lib/room-camera";
import {
  V_HALF,
  VIEW_TURNS,
  insideRoom,
  projectRoom,
  toPercent,
  toRoom,
  unprojectRoom,
} from "@/lib/room-camera";
import type { UserProgress } from "@/types";

interface RoomPanoramaProps {
  progress: UserProgress;
  onUpdate: () => void;
  onExit: () => void;
}

/**
 * Height of the panorama as a fraction of its width. Fixed by the projection:
 * a full turn across the width and 2 * V_HALF down the height, at the same
 * pixels per radian.
 */
const STRIP_RATIO = (2 * V_HALF) / (Math.PI * 2);

/** Pointer travel for a full turn of the head. */
const DRAG_PER_TURN = 900;
const DRAG_SLOP = 6;

/**
 * The inside of the house, as somewhere you stand and look around.
 *
 * The room is one cylindrical panorama rendered from standing height in the
 * middle — see scripts/gen-interiors.ts. A panorama rather than a turntable
 * because the two problems are different shapes: outside you walk around an
 * object so the camera orbits it, inside you stand still and turn your head so
 * the camera stays put and the ray sweeps. One image covers every heading.
 *
 * Looking around is therefore just sliding a wide strip sideways. Furniture is
 * positioned ON the strip rather than on the screen, so it travels with the
 * walls without any per-frame work — and it is stored in the same floor
 * percentages the flat explorer used, so nothing anyone already placed is lost.
 */
export function RoomPanorama({ progress, onUpdate, onExit }: RoomPanoramaProps) {
  const house = getHouseStyle(progress.houseStyleId) ?? getHouseStyle("cottage")!;

  const [heading, setHeading] = useState(0.5);
  const [placing, setPlacing] = useState<string | null>(null);
  const [hover, setHover] = useState<OnStrip | null>(null);

  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number; moved: number } | null>(null);
  const dragged = useRef(false);

  const placed = useMemo(
    () => progress.placedFurnitureItems ?? [],
    [progress.placedFurnitureItems]
  );
  const unplaced = getUnplacedFurnitureIds(progress.ownedFurniture, placed);

  const turn = useCallback((by: number) => setHeading((h) => h + by), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") turn(-0.06);
      else if (e.key === "ArrowRight") turn(0.06);
      else if (e.key === "Escape") setPlacing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  /** Pointer → position on the strip, in turns and in strip fraction. */
  function pointerToStrip(clientX: number, clientY: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    // The visible slice is VIEW_TURNS of the full circle, centred on heading.
    const acrossView = (clientX - box.left) / box.width;
    const u = heading + (acrossView - 0.5) * VIEW_TURNS;
    // The strip is taller than the viewport and vertically centred in it.
    const stripH = (box.width / VIEW_TURNS) * STRIP_RATIO;
    const top = (box.height - stripH) / 2;
    const v = (clientY - box.top - top) / stripH;
    return { u: u - Math.floor(u), v };
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, start: heading, moved: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      d.moved = Math.max(d.moved, Math.abs(dx));
      if (d.moved > DRAG_SLOP) {
        // Drag right, the room slides right, so you turn left. Same as
        // dragging a photo around under a window.
        setHeading(d.start - dx / DRAG_PER_TURN);
        return;
      }
    }
    if (placing) {
      const pt = pointerToStrip(e.clientX, e.clientY);
      if (!pt) return;
      const room = unprojectRoom(pt.u, pt.v);
      setHover(room && insideRoom(room) ? projectRoom(room) : null);
    }
  }

  function onPointerUp() {
    dragged.current = (drag.current?.moved ?? 0) > DRAG_SLOP;
    drag.current = null;
  }

  function onStageClick(e: React.MouseEvent) {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (!placing) return;
    const pt = pointerToStrip(e.clientX, e.clientY);
    if (!pt) return;
    const room = unprojectRoom(pt.u, pt.v);
    if (!room) {
      showToast({ emoji: "🙃", title: "Aim at the floor to put it down." });
      return;
    }
    const pct = toPercent(room);
    const res = placeFurnitureAt(placing, pct.x, pct.y);
    showToast({ emoji: res.ok ? "🛋️" : "😅", title: res.message });
    if (res.ok) {
      setPlacing(null);
      setHover(null);
      onUpdate();
    }
  }

  function pickUp(instanceId: string) {
    removePlacedFurniture(instanceId);
    onUpdate();
    showToast({ emoji: "📦", title: "Picked up. Choose it below to place again." });
  }

  // Far things first, so a chair in front of a bookshelf covers it.
  const drawn = useMemo(
    () =>
      placed
        .map((entry) => ({ entry, at: projectRoom(toRoom(entry.x, entry.y)) }))
        .sort((a, b) => b.at.depth - a.at.depth),
    [placed]
  );

  const ghostItem = placing ? getFurnitureItem(placing) : null;

  // The strip is a full turn wide, drawn twice so panning past the seam wraps.
  const stripWidth = 100 / VIEW_TURNS;
  const offset = -(heading - Math.floor(heading)) * stripWidth;

  return (
    <div className="panel">
      <GameHud
        houseStyleId={progress.houseStyleId}
        onExit={onExit}
        mode="inside"
        hint="Drag to look around"
      />

      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onStageClick}
        className={`relative aspect-[3/2] w-full touch-none overflow-hidden select-none bg-slate-900 ${
          placing ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${offset + copy * stripWidth}%`,
              width: `${stripWidth}%`,
              aspectRatio: `1 / ${STRIP_RATIO}`,
            }}
          >
            <Image
              src={`/house/interiors/${house.id}.webp`}
              alt={copy === 0 ? `Inside the ${house.name}` : ""}
              fill
              priority={copy === 0}
              sizes="300vw"
              className="object-cover"
            />

            {drawn.map(({ entry, at }) => {
              const item = getFurnitureItem(entry.itemId);
              if (!item) return null;
              return (
                <button
                  key={`${copy}-${entry.instanceId}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickUp(entry.instanceId);
                  }}
                  title={`${item.name} — click to pick up`}
                  className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-105"
                  style={{
                    left: `${at.u * 100}%`,
                    top: `${at.v * 100}%`,
                    width: `${at.scale * 3.4}%`,
                    aspectRatio: "1 / 1",
                    zIndex: Math.round(500 - at.depth * 10),
                  }}
                >
                  <CartoonFurnitureArt
                    itemId={entry.itemId}
                    size={120}
                    variant="room"
                    className="h-full w-full drop-shadow-[0_5px_6px_rgba(0,0,0,0.4)]"
                  />
                </button>
              );
            })}

            {ghostItem && hover && (
              <div
                aria-hidden
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full opacity-70"
                style={{
                  left: `${hover.u * 100}%`,
                  top: `${hover.v * 100}%`,
                  width: `${hover.scale * 3.4}%`,
                  aspectRatio: "1 / 1",
                  zIndex: 600,
                }}
              >
                <CartoonFurnitureArt
                  itemId={ghostItem.id}
                  size={120}
                  variant="room"
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); turn(-0.06); }}
              className="btn-secondary btn-sm"
              aria-label="Look left"
            >
              ←
            </button>
            {placing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPlacing(null); setHover(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); turn(0.06); }}
              className="btn-secondary btn-sm"
              aria-label="Look right"
            >
              →
            </button>
          </div>
        </div>

        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
          {placing ? "Click the floor to put it down" : "Drag to look around"}
        </p>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Inventory</p>
          <p className="text-xs text-slate-500">
            {placing
              ? "Click the floor to put it down. Esc to cancel."
              : "Pick something to place it. Click furniture in the room to take it back."}
          </p>
        </div>

        {unplaced.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            {placed.length === 0
              ? "Nothing to place yet. Buy furniture in the Shop with the Bridgeys you have earned."
              : "Everything you own is placed. Click a piece to pick it up again."}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {unplaced.map((id) => {
              const item = getFurnitureItem(id);
              if (!item) return null;
              const active = placing === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setPlacing(active ? null : id); setHover(null); }}
                  className={`flex w-24 flex-col items-center gap-1 rounded-xl border bg-white p-2 transition ${
                    active
                      ? "border-bridge-500 ring-2 ring-bridge-200"
                      : "border-slate-200 hover:border-bridge-300 hover:shadow-panel"
                  }`}
                >
                  <CartoonFurnitureArt itemId={id} size={52} variant="room" />
                  <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
