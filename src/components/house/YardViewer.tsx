"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameHud } from "@/components/house/GameHud";
import { getHouseStyle } from "@/data/house-catalog";
import {
  ORNAMENTS,
  getOrnament,
  getUnplacedOrnamentIds,
  ornamentImage,
} from "@/data/ornament-catalog";
import { getYardScene } from "@/data/yard-scenes";
import { placeOrnamentAt, removePlacedOrnament } from "@/lib/bridgeys";
import { showToast } from "@/lib/notify";
import {
  PAD_LIMIT,
  TURNTABLE_FRAMES,
  onPad,
  project,
  unproject,
} from "@/lib/yard-camera";
import type { UserProgress } from "@/types";

interface YardViewerProps {
  progress: UserProgress;
  onUpdate: () => void;
  onEnter: () => void;
}

/** How far a pointer travels to turn the yard a full circle. */
const DRAG_PER_TURN = 620;
/** Movement under this is a tap, not a spin. */
const DRAG_SLOP = 6;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;

/**
 * The yard, as something you can walk around.
 *
 * The scene was rendered offline from twelve angles on a circle around the
 * pad, so spinning is a frame swap rather than any live 3D. The camera always
 * looks at the pad, which is what makes a drag feel like turning one object
 * instead of cutting between photographs.
 *
 * Ornaments are stored in world metres around the pad and re-projected for
 * whichever frame is showing. That is the part that makes decorating work at
 * all: a screen position is only true for one angle, so anything stored that
 * way would slide off the moment you spun the view.
 */
export function YardViewer({ progress, onUpdate, onEnter }: YardViewerProps) {
  const house = getHouseStyle(progress.houseStyleId) ?? getHouseStyle("cottage")!;
  const scene = getYardScene(house.id);

  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [placing, setPlacing] = useState<string | null>(null);
  const [decorating, setDecorating] = useState(false);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);

  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; startAngle: number; moved: number } | null>(null);
  const dragged = useRef(false);

  const placed = useMemo(() => progress.placedOrnaments ?? [], [progress.placedOrnaments]);
  const spare = useMemo(
    () => getUnplacedOrnamentIds(progress.ownedOrnaments ?? [], placed),
    [progress.ownedOrnaments, placed]
  );

  // Whole frames for the image, but the angle itself stays continuous so a
  // drag does not stutter between quantised steps.
  const frame = ((Math.round(angle) % TURNTABLE_FRAMES) + TURNTABLE_FRAMES) % TURNTABLE_FRAMES;

  const turn = useCallback((by: number) => setAngle((a) => a + by), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "ArrowRight") turn(1);
      else if (e.key === "Escape") setPlacing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  /** Pointer position as a percentage of the stage, undoing the zoom. */
  function stagePercent(clientX: number, clientY: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    const cx = (clientX - box.left) / box.width;
    const cy = (clientY - box.top) / box.height;
    // The stage is scaled about its centre, so undo that to get scene coords.
    return { x: ((cx - 0.5) / zoom + 0.5) * 100, y: ((cy - 0.5) / zoom + 0.5) * 100 };
  }

  function onPointerDown(e: React.PointerEvent) {
    // Spinning stays available while placing, so you can walk round to find
    // the spot you want before putting the thing down.
    drag.current = { x: e.clientX, startAngle: angle, moved: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      d.moved = Math.max(d.moved, Math.abs(dx));
      if (d.moved > DRAG_SLOP) {
        // Drag right, world turns right — the scene follows your hand.
        setAngle(d.startAngle - (dx / DRAG_PER_TURN) * TURNTABLE_FRAMES);
        return;
      }
    }
    if (placing) {
      const pt = stagePercent(e.clientX, e.clientY);
      if (!pt) return;
      const world = unproject(pt.x, pt.y, frame);
      setHover(world && onPad(world) ? world : null);
    }
  }

  function onPointerUp() {
    // Remember how far this gesture travelled so the click that follows can
    // tell a tap from the end of a spin.
    dragged.current = (drag.current?.moved ?? 0) > DRAG_SLOP;
    drag.current = null;
  }

  function onStageClick(e: React.MouseEvent) {
    // A click always follows a drag, so a spin must not also place something.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (!placing) return;
    const pt = stagePercent(e.clientX, e.clientY);
    if (!pt) return;
    const world = unproject(pt.x, pt.y, frame);
    if (!world || !onPad(world)) {
      showToast({ emoji: "🚧", title: "Place it on the level ground near the house." });
      return;
    }
    const res = placeOrnamentAt(placing, world.x, world.z);
    showToast({ emoji: res.ok ? "🌿" : "😅", title: res.message });
    if (res.ok) {
      setPlacing(null);
      setHover(null);
      onUpdate();
    }
  }

  function pickUp(instanceId: string) {
    const res = removePlacedOrnament(instanceId);
    showToast({ emoji: "📦", title: res.message });
    if (res.ok) onUpdate();
  }

  // Painter's order: whatever is further away is drawn first, so a bench in
  // front of a tree actually covers it.
  const drawn = useMemo(() => {
    return placed
      .map((entry) => ({ entry, at: project({ x: entry.x, z: entry.z }, frame) }))
      .filter((d) => d.at.visible)
      .sort((a, b) => b.at.depth - a.at.depth);
  }, [placed, frame]);

  const ghost = placing ? getOrnament(placing) : null;
  const ghostAt = hover && ghost ? project(hover, frame) : null;

  return (
    <div className="panel">
      <GameHud houseStyleId={progress.houseStyleId} mode="outside" hint={house.description} />

      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onStageClick}
        className={`relative aspect-[3/2] w-full touch-none overflow-hidden select-none ${
          placing ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Sky and weather stay behind whichever frame is showing. */}
          <YardSky scene={scene} />

          {/* Every frame is mounted and only one is shown, so spinning never
              waits on a network request part-way round the circle. */}
          {Array.from({ length: TURNTABLE_FRAMES }, (_, i) => (
            <Image
              key={i}
              src={`/house/turntable/${house.id}-${i}.webp`}
              alt={i === 0 ? `${house.name} and its yard` : ""}
              fill
              priority={i === 0}
              sizes="(max-width: 900px) 100vw, 1200px"
              className="object-cover"
              style={{ opacity: i === frame ? 1 : 0 }}
            />
          ))}

          {drawn.map(({ entry, at }) => {
            const item = getOrnament(entry.itemId);
            if (!item) return null;
            return (
              <button
                key={entry.instanceId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pickUp(entry.instanceId);
                }}
                title={`${item.name} — click to pick up`}
                className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-105"
                style={{
                  left: `${at.left}%`,
                  top: `${at.top}%`,
                  height: `${item.height * at.scale * 6.4}%`,
                  aspectRatio: "1 / 1",
                  zIndex: Math.round(1000 - at.depth * 10),
                }}
              >
                <Image
                  src={ornamentImage(item.id)}
                  alt={item.name}
                  fill
                  sizes="200px"
                  className="object-contain object-bottom drop-shadow-[0_4px_5px_rgba(0,0,0,0.35)]"
                />
              </button>
            );
          })}

          {ghost && ghostAt && (
            <div
              aria-hidden
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full opacity-70"
              style={{
                left: `${ghostAt.left}%`,
                top: `${ghostAt.top}%`,
                height: `${ghost.height * ghostAt.scale * 6.4}%`,
                aspectRatio: "1 / 1",
                zIndex: 999,
              }}
            >
              <Image
                src={ornamentImage(ghost.id)}
                alt=""
                fill
                sizes="200px"
                className="object-contain object-bottom"
              />
            </div>
          )}
        </div>

        {/* Controls sit outside the zoomed layer so they stay put. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); turn(-1); }}
              className="btn-secondary btn-sm"
              aria-label="Turn left"
            >
              ←
            </button>
            {!placing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEnter(); }}
                className="btn-primary px-7 py-2.5"
              >
                Step inside
              </button>
            )}
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
              onClick={(e) => { e.stopPropagation(); turn(1); }}
              className="btn-secondary btn-sm"
              aria-label="Turn right"
            >
              →
            </button>
          </div>
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(ZOOM_MAX, z + 0.35)); }}
            disabled={zoom >= ZOOM_MAX}
            className="btn-secondary btn-sm w-9"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(ZOOM_MIN, z - 0.35)); }}
            disabled={zoom <= ZOOM_MIN}
            className="btn-secondary btn-sm w-9"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
          {placing ? "Click the ground to place it" : "Drag to walk around"}
        </p>
      </div>

      {/* ── Decorating tray ─────────────────────────────────────── */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Your garden</p>
          <button
            type="button"
            onClick={() => setDecorating((d) => !d)}
            className="btn-secondary btn-sm"
          >
            {decorating ? "Done" : "Decorate outside"}
          </button>
        </div>

        {decorating && (
          <>
            {spare.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                {placed.length === 0
                  ? "Nothing to put out yet. Ornaments are in the Shop, under Garden."
                  : "Everything you own is out. Click a piece in the yard to pick it up again."}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {spare.map((id, i) => {
                  const item = getOrnament(id);
                  if (!item) return null;
                  const active = placing === id;
                  return (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setPlacing(active ? null : id); setHover(null); }}
                      className={`flex w-24 flex-col items-center gap-1 rounded-xl border bg-white p-2 transition ${
                        active
                          ? "border-bridge-500 ring-2 ring-bridge-200"
                          : "border-slate-200 hover:border-bridge-300 hover:shadow-panel"
                      }`}
                    >
                      <span className="relative block h-12 w-12">
                        <Image
                          src={ornamentImage(id)}
                          alt={item.name}
                          fill
                          sizes="60px"
                          className="object-contain object-bottom"
                        />
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Ornaments stand on the level ground within {PAD_LIMIT} m of the house, and they
              stay where you put them as you walk around.
            </p>
          </>
        )}

        {!decorating && (
          <p className="mt-2 text-sm text-slate-600">
            {placed.length === 0
              ? `${ORNAMENTS.length} ornaments in the Shop, under Garden. Drag the yard to look around.`
              : `${placed.length} ${placed.length === 1 ? "ornament" : "ornaments"} out in the yard.`}
          </p>
        )}
      </div>
    </div>
  );
}

/** The sky sits behind the render, whose distance already fades to alpha. */
function YardSky({ scene }: { scene: ReturnType<typeof getYardScene> }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(to bottom, ${scene.sky.join(", ")})`,
      }}
    />
  );
}
