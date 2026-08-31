"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { DollhouseScene } from "@/components/house/DollhouseScene";
import { GameHud } from "@/components/house/GameHud";
import { getFurnitureItem, getHouseStyle, getUnplacedFurnitureIds } from "@/data/house-catalog";
import { ORNAMENTS, getOrnament, getUnplacedOrnamentIds, ornamentImage } from "@/data/ornament-catalog";
import {
  placeFurnitureAt,
  placeOrnamentAt,
  removePlacedFurniture,
  removePlacedOrnament,
} from "@/lib/bridgeys";
import {
  PAD_LIMIT,
  SCENE_H,
  SCENE_W,
  clampToYard,
  onFloor,
  onYard,
  pctX,
  pctY,
  roomPoint,
  roomSpot,
  yardPoint,
  yardSpot,
} from "@/lib/dollhouse";
import { showToast } from "@/lib/notify";
import type { UserProgress } from "@/types";

interface DollhouseProps {
  progress: UserProgress;
  onUpdate: () => void;
}

type Mode = "off" | "yard" | "room";

/**
 * The House, as one flat picture.
 *
 * It used to be two places you travelled between: a twelve-angle turntable
 * outside and a 360 panorama inside, each with its own camera, its own
 * offline renders and its own way of putting a thing down. Both were 3D
 * pretending to be cheap. This is 2D that means it, the front of the house
 * opens, and the room you decorate is in the same frame as the garden you
 * decorate, at the same time.
 *
 * What that buys, beyond the look: placing something is arithmetic you can
 * read, a new house style is a palette rather than sixty renders, and nothing
 * in the browser has to agree to six decimal places with a build script.
 */
export function Dollhouse({ progress, onUpdate }: DollhouseProps) {
  const house = getHouseStyle(progress.houseStyleId) ?? getHouseStyle("cottage")!;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("off");
  const [placing, setPlacing] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const stage = useRef<HTMLDivElement>(null);

  const ornaments = useMemo(() => progress.placedOrnaments ?? [], [progress.placedOrnaments]);
  const furniture = useMemo(
    () => progress.placedFurnitureItems ?? [],
    [progress.placedFurnitureItems]
  );

  const spareOrnaments = useMemo(
    () => getUnplacedOrnamentIds(progress.ownedOrnaments ?? [], ornaments),
    [progress.ownedOrnaments, ornaments]
  );
  const spareFurniture = useMemo(
    () => getUnplacedFurnitureIds(progress.ownedFurniture ?? [], furniture),
    [progress.ownedFurniture, furniture]
  );

  const stopPlacing = useCallback(() => {
    setPlacing(null);
    setHover(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") stopPlacing();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopPlacing]);

  // Closing the house while placing furniture would leave a ghost on a wall.
  useEffect(() => {
    if (!open && mode === "room") {
      setMode("off");
      stopPlacing();
    }
  }, [open, mode, stopPlacing]);

  /** Pointer position in scene units, whatever the stage is scaled to. */
  function scenePoint(clientX: number, clientY: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: ((clientX - box.left) / box.width) * SCENE_W,
      y: ((clientY - box.top) / box.height) * SCENE_H,
    };
  }

  function onMove(e: React.PointerEvent) {
    if (!placing) return;
    const pt = scenePoint(e.clientX, e.clientY);
    if (!pt) return;
    const valid = mode === "room" ? onFloor(pt.x, pt.y) : onYard(pt.y);
    setHover(valid ? pt : null);
  }

  function onStageClick(e: React.MouseEvent) {
    if (!placing) return;
    const pt = scenePoint(e.clientX, e.clientY);
    if (!pt) return;

    if (mode === "room") {
      if (!onFloor(pt.x, pt.y)) {
        showToast({ emoji: "🙃", title: "Put it down on the floor inside the house." });
        return;
      }
      const at = roomPoint(pt.x, pt.y);
      const res = placeFurnitureAt(placing, at.x, at.y);
      showToast({ emoji: res.ok ? "🪑" : "😅", title: res.message });
      if (res.ok) {
        stopPlacing();
        onUpdate();
      }
      return;
    }

    if (!onYard(pt.y)) {
      showToast({ emoji: "🚧", title: "Ornaments go on the lawn in front of the house." });
      return;
    }
    const world = clampToYard(yardPoint(pt.x, pt.y));
    const res = placeOrnamentAt(placing, world.x, world.z);
    showToast({ emoji: res.ok ? "🌿" : "😅", title: res.message });
    if (res.ok) {
      stopPlacing();
      onUpdate();
    }
  }

  // Painter's order in a flat scene is just "further back is drawn first".
  const drawnOrnaments = useMemo(
    () =>
      ornaments
        .map((entry) => ({ entry, at: yardSpot({ x: entry.x, z: entry.z }) }))
        .sort((a, b) => a.at.depth - b.at.depth),
    [ornaments]
  );

  const drawnFurniture = useMemo(
    () =>
      furniture
        .map((entry) => ({ entry, at: roomSpot(entry.x, entry.y) }))
        .sort((a, b) => a.at.depth - b.at.depth),
    [furniture]
  );

  const ghostOrnament = mode === "yard" && placing ? getOrnament(placing) : null;
  const ghostFurniture = mode === "room" && placing ? getFurnitureItem(placing) : null;
  const ghostAt = hover
    ? mode === "room"
      ? roomSpot(roomPoint(hover.x, hover.y).x, roomPoint(hover.x, hover.y).y)
      : yardSpot(clampToYard(yardPoint(hover.x, hover.y)))
    : null;

  const hint = placing
    ? mode === "room"
      ? "Click the floor to put it down"
      : "Click the lawn to place it"
    : open
      ? "The house is open"
      : "Click the house to open it";

  return (
    <div className="panel">
      <GameHud houseStyleId={progress.houseStyleId} mode={open ? "inside" : "outside"} hint={house.description} />

      <div
        ref={stage}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={onStageClick}
        className={`relative aspect-[3/2] w-full touch-none overflow-hidden select-none ${
          placing ? "cursor-crosshair" : ""
        }`}
      >
        <DollhouseScene styleId={house.id} open={open} />

        {/* The whole building is the control that opens it, a house you can
            click is more obvious than a button captioned "go inside". */}
        {!placing && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-pressed={open}
            className="absolute rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
            style={{ left: pctX(340), top: pctY(150), width: pctX(520), height: pctY(502) }}
          >
            <span className="sr-only">
              {open ? `Close the ${house.name}` : `Open the ${house.name}`}
            </span>
          </button>
        )}

        {/* ── Inside ─────────────────────────────────────────────── */}
        {open &&
          drawnFurniture.map(({ entry, at }) => {
            const item = getFurnitureItem(entry.itemId);
            if (!item) return null;
            const w = (item.displayWidth ?? 110) * 0.92 * at.scale;
            return (
              <button
                key={entry.instanceId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePlacedFurniture(entry.instanceId);
                  showToast({ emoji: "📦", title: `${item.name} is back in the Shop tray.` });
                  onUpdate();
                }}
                title={`${item.name}, click to pick up`}
                className="dh-piece absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-105"
                style={{
                  left: pctX(at.x),
                  top: pctY(at.y),
                  width: pctX(w),
                  aspectRatio: "1 / 1",
                  zIndex: 200 + Math.round(at.depth * 100),
                }}
              >
                <CartoonFurnitureArt
                  itemId={entry.itemId}
                  size={120}
                  variant="room"
                  className="h-full w-full drop-shadow-[0_5px_6px_rgba(0,0,0,0.35)]"
                />
              </button>
            );
          })}

        {/* ── Outside ────────────────────────────────────────────── */}
        {drawnOrnaments.map(({ entry, at }) => {
          const item = getOrnament(entry.itemId);
          if (!item) return null;
          return (
            <button
              key={entry.instanceId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const res = removePlacedOrnament(entry.instanceId);
                showToast({ emoji: "📦", title: res.message });
                if (res.ok) onUpdate();
              }}
              title={`${item.name}, click to pick up`}
              className="dh-piece absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-105"
              style={{
                left: pctX(at.x),
                top: pctY(at.y),
                height: pctY(item.height * 46 * at.scale),
                aspectRatio: "1 / 1",
                zIndex: 400 + Math.round(at.depth * 100),
              }}
            >
              <Image
                src={ornamentImage(item.id)}
                alt={item.name}
                fill
                sizes="200px"
                className="object-contain object-bottom drop-shadow-[0_4px_5px_rgba(0,0,0,0.3)]"
              />
            </button>
          );
        })}

        {/* ── What you are about to put down ─────────────────────── */}
        {ghostAt && ghostOrnament && (
          <div
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full opacity-70"
            style={{
              left: pctX(ghostAt.x),
              top: pctY(ghostAt.y),
              height: pctY(ghostOrnament.height * 46 * ghostAt.scale),
              aspectRatio: "1 / 1",
              zIndex: 700,
            }}
          >
            <Image src={ornamentImage(ghostOrnament.id)} alt="" fill sizes="200px" className="object-contain object-bottom" />
          </div>
        )}
        {ghostAt && ghostFurniture && (
          <div
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full opacity-70"
            style={{
              left: pctX(ghostAt.x),
              top: pctY(ghostAt.y),
              width: pctX((ghostFurniture.displayWidth ?? 110) * 0.92 * ghostAt.scale),
              aspectRatio: "1 / 1",
              zIndex: 700,
            }}
          >
            <CartoonFurnitureArt itemId={ghostFurniture.id} size={120} variant="room" className="h-full w-full" />
          </div>
        )}

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
          {placing ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); stopPlacing(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
              className="btn-primary px-7 py-2.5"
            >
              {open ? "Close the house" : "Open the house"}
            </button>
          )}
        </div>

        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
          {hint}
        </p>
      </div>

      {/* ── Decorating tray ──────────────────────────────────────── */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Decorate</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "yard" ? "off" : "yard"));
                stopPlacing();
              }}
              aria-pressed={mode === "yard"}
              className={mode === "yard" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            >
              Garden
            </button>
            <button
              type="button"
              onClick={() => {
                // Furniture only makes sense once you can see the room.
                setOpen(true);
                setMode((m) => (m === "room" ? "off" : "room"));
                stopPlacing();
              }}
              aria-pressed={mode === "room"}
              className={mode === "room" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            >
              Inside
            </button>
          </div>
        </div>

        {mode === "off" && (
          <p className="mt-2 text-sm text-slate-600">
            {ornaments.length + furniture.length === 0
              ? `Furniture and ${ORNAMENTS.length} garden ornaments are in the Shop. Open the house to see inside.`
              : `${furniture.length} inside, ${ornaments.length} out in the garden. Click any piece to pick it up.`}
          </p>
        )}

        {mode !== "off" && (
          <Tray
            items={mode === "yard" ? spareOrnaments : spareFurniture}
            kind={mode}
            placing={placing}
            onPick={(id) => {
              setPlacing((cur) => (cur === id ? null : id));
              setHover(null);
            }}
            placedCount={mode === "yard" ? ornaments.length : furniture.length}
          />
        )}
      </div>
    </div>
  );
}

function Tray({
  items,
  kind,
  placing,
  onPick,
  placedCount,
}: {
  items: string[];
  kind: "yard" | "room";
  placing: string | null;
  onPick: (id: string) => void;
  placedCount: number;
}) {
  if (items.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        {placedCount === 0
          ? kind === "yard"
            ? "Nothing to put out yet. Ornaments are in the Shop, under Garden."
            : "Nothing to put in yet. Furniture is in the Shop."
          : "Everything you own is out. Click a piece to pick it up again."}
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((id, i) => {
          const name =
            kind === "yard" ? getOrnament(id)?.name : getFurnitureItem(id)?.name;
          if (!name) return null;
          const active = placing === id;
          return (
            <button
              key={`${id}-${i}`}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(id)}
              className={`flex w-24 flex-col items-center gap-1 rounded-xl border bg-white p-2 transition ${
                active
                  ? "border-bridge-500 ring-2 ring-bridge-200"
                  : "border-slate-200 hover:border-bridge-300 hover:shadow-panel"
              }`}
            >
              <span className="relative block h-12 w-12">
                {kind === "yard" ? (
                  <Image src={ornamentImage(id)} alt={name} fill sizes="60px" className="object-contain object-bottom" />
                ) : (
                  <CartoonFurnitureArt itemId={id} size={48} variant="room" />
                )}
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">{name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {kind === "yard"
          ? `Ornaments stand on the lawn within ${PAD_LIMIT} m of the house.`
          : "Furniture stands on the floor. Nearer the front means larger."}
      </p>
    </>
  );
}
