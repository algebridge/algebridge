"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackyardScene } from "@/components/house/BackyardScene";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { DollhouseScene } from "@/components/house/DollhouseScene";
import { GameHud } from "@/components/house/GameHud";
import { RinkGame } from "@/components/house/RinkGame";
import { Veronica } from "@/components/house/Veronica";
import { getRinkItem } from "@/data/rink-catalog";
import { primaryHex, SWATCHES, swatchHex, USABLE } from "@/data/furniture-art";
import { RINK, RINK_SLOTS } from "@/lib/rink";
import { canHang, getFurnitureItem, getHouseStyle, getUnplacedFurnitureIds } from "@/data/house-catalog";
import { ORNAMENTS, getOrnament, getUnplacedOrnamentIds, ornamentImage } from "@/data/ornament-catalog";
import {
  clearRinkSlot,
  floorOf,
  moveFurniture,
  moveFurnitureToFloor,
  moveFurnitureToSurface,
  placeFurnitureAt,
  placeOrnamentAt,
  placeRinkItem,
  removePlacedFurniture,
  removePlacedOrnament,
  setHouseNight,
  setItemColor,
  surfaceOf,
  toggleFurniture,
  unplacedRinkItems,
} from "@/lib/bridgeys";
import {
  FLOOR_LABEL,
  HOUSE,
  PAD_LIMIT,
  ROOF_APEX,
  SCENE_H,
  SCENE_W,
  clampToYard,
  floorAt,
  onYard,
  pctX,
  pctY,
  placedSpot,
  roomPoint,
  surfaceAt,
  wallPoint,
  yardPoint,
  yardSpot,
} from "@/lib/dollhouse";
import { showToast } from "@/lib/notify";
import type { HouseFloor, HouseSurface, PlacedFurnitureEntry, UserProgress } from "@/types";

interface DollhouseProps {
  progress: UserProgress;
  onUpdate: () => void;
  /** Start in the backyard with the rink game running. */
  autoSkate?: boolean;
}

type Mode = "off" | "yard" | "room" | "rink";
type View = "front" | "back";

/** A piece being dragged: where it is right now. */
interface Dragging {
  id: string;
  x: number;
  y: number;
  floor: HouseFloor;
  surface: HouseSurface;
}

/** Where a point inside the house would put a piece: a floor, or a wall if the piece can hang. */
function placementFor(itemId: string, sx: number, sy: number): { x: number; y: number; floor: HouseFloor; surface: HouseSurface } | null {
  const s = surfaceAt(sx, sy);
  if (!s) return null;
  if (s.surface === "wall" && canHang(itemId)) return { ...wallPoint(sx, sy, s.floor), floor: s.floor, surface: "wall" };
  if (s.surface === "wall") return null;
  return { ...roomPoint(sx, sy, s.floor), floor: s.floor, surface: "floor" };
}

/**
 * The House, as one flat picture.
 *
 * It used to be two places you travelled between: a twelve-angle turntable
 * outside and a 360 panorama inside, each with its own camera, its own
 * offline renders and its own way of putting a thing down. Both were 3D
 * pretending to be cheap. This is 2D that means it, the front of the house
 * opens, and the rooms you decorate are in the same frame as the garden you
 * decorate, at the same time.
 *
 * Two floors now, and the pieces in them are things rather than stickers:
 * drag one to move it, tap it for its colours, its switch, the stairs, or
 * to pick it up; and at night the ones that are on are the ones giving
 * light.
 */
export function Dollhouse({ progress, onUpdate, autoSkate = false }: DollhouseProps) {
  const house = getHouseStyle(progress.houseStyleId) ?? getHouseStyle("cottage")!;

  // Open from the start: arriving at your house should mean being in it.
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("off");
  const [placing, setPlacing] = useState<string | null>(null);
  /** Front of the house, or the backyard with the rink. */
  const [view, setView] = useState<View>(autoSkate ? "back" : "front");
  const [skating, setSkating] = useState(autoSkate);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  /** The piece whose actions are showing. */
  const [selected, setSelected] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const dragStart = useRef<{ id: string; x0: number; y0: number; moved: boolean } | null>(null);
  const dragLatest = useRef<Dragging | null>(null);

  const stage = useRef<HTMLDivElement>(null);
  const night = !!progress.houseNight;
  const colors = useMemo(() => progress.itemColors ?? {}, [progress.itemColors]);

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
  const spareRink = useMemo(() => unplacedRinkItems(progress), [progress]);
  const rinkDecor = useMemo(() => progress.rinkDecor ?? {}, [progress.rinkDecor]);

  const stopPlacing = useCallback(() => {
    setPlacing(null);
    setHover(null);
  }, []);

  const closeActions = useCallback(() => {
    setSelected(null);
    setShowColors(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stopPlacing();
        closeActions();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopPlacing, closeActions]);

  // Closing the house while placing furniture would leave a ghost on a wall.
  useEffect(() => {
    if (!open && mode === "room") {
      setMode("off");
      stopPlacing();
    }
    if (!open) closeActions();
  }, [open, mode, stopPlacing, closeActions]);

  // Each side of the house has its own decorating modes.
  useEffect(() => {
    if (view === "back" && (mode === "yard" || mode === "room")) setMode("off");
    if (view === "front" && mode === "rink") setMode("off");
    if (view === "front") setSkating(false);
    stopPlacing();
    closeActions();
  }, [view, mode, stopPlacing, closeActions]);

  // The selected piece may have been picked up or moved away underneath us.
  useEffect(() => {
    if (selected && !furniture.some((f) => f.instanceId === selected)) closeActions();
  }, [furniture, selected, closeActions]);

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
    const valid = mode === "room" ? placementFor(placing, pt.x, pt.y) !== null : onYard(pt.y);
    setHover(valid ? pt : null);
  }

  function onStageClick(e: React.MouseEvent) {
    if (!placing) {
      closeActions();
      return;
    }
    if (view === "back") return;
    const pt = scenePoint(e.clientX, e.clientY);
    if (!pt) return;

    if (mode === "room") {
      const at = placementFor(placing, pt.x, pt.y);
      if (!at) {
        const onWall = surfaceAt(pt.x, pt.y)?.surface === "wall";
        showToast({
          icon: "x-circle",
          tone: "info",
          title: onWall
            ? `The ${getFurnitureItem(placing)?.name ?? "piece"} stands on the floor. Click a floor, upstairs or down.`
            : "Put it down on a floor inside the house, or on a wall if it hangs.",
        });
        return;
      }
      const res = placeFurnitureAt(placing, at.x, at.y, at.floor, at.surface);
      showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
      if (res.ok) {
        stopPlacing();
        onUpdate();
      }
      return;
    }

    if (!onYard(pt.y)) {
      showToast({ icon: "x-circle", tone: "info", title: "Ornaments go on the lawn in front of the house." });
      return;
    }
    const world = clampToYard(yardPoint(pt.x, pt.y));
    const res = placeOrnamentAt(placing, world.x, world.z);
    showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
    if (res.ok) {
      stopPlacing();
      onUpdate();
    }
  }

  /* ── Dragging a piece around the rooms ───────────────────────── */

  function pieceDown(e: React.PointerEvent, entry: PlacedFurnitureEntry) {
    if (placing) return;
    e.stopPropagation();
    dragStart.current = { id: entry.instanceId, x0: e.clientX, y0: e.clientY, moved: false };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser will not capture still drags */
    }
  }

  function pieceMove(e: React.PointerEvent, entry: PlacedFurnitureEntry) {
    const d = dragStart.current;
    if (!d || d.id !== entry.instanceId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.moved = true;
    const pt = scenePoint(e.clientX, e.clientY);
    if (!pt) return;
    // Over a wall, a piece that hangs goes on it; anything else stays on the
    // floor of whichever room the pointer is in.
    const at =
      placementFor(entry.itemId, pt.x, pt.y) ??
      (() => {
        const floor = surfaceAt(pt.x, pt.y)?.floor ?? floorAt(pt.x, pt.y) ?? floorOf(entry);
        return { ...roomPoint(pt.x, pt.y, floor), floor, surface: "floor" as HouseSurface };
      })();
    const next = { id: d.id, x: at.x, y: at.y, floor: at.floor, surface: at.surface };
    dragLatest.current = next;
    setDragging(next);
    closeActions();
  }

  function pieceUp(e: React.PointerEvent, entry: PlacedFurnitureEntry) {
    const d = dragStart.current;
    if (!d || d.id !== entry.instanceId) return;
    e.stopPropagation();
    dragStart.current = null;
    const latest = dragLatest.current;
    dragLatest.current = null;
    setDragging(null);
    if (d.moved && latest) {
      const res = moveFurniture(latest.id, latest.x, latest.y, latest.floor, latest.surface);
      if (res.ok && (latest.floor !== floorOf(entry) || latest.surface !== surfaceOf(entry))) showToast({ icon: "check", tone: "success", title: res.message });
      if (res.ok) onUpdate();
      return;
    }
    // A tap: its actions.
    setShowColors(false);
    setSelected((s) => (s === entry.instanceId ? null : entry.instanceId));
  }

  /* ── The actions on a tapped piece ───────────────────────────── */

  function act(fn: () => { ok: boolean; message: string }, keepOpen = true) {
    const res = fn();
    showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
    if (res.ok) onUpdate();
    if (!keepOpen) closeActions();
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
        .map((entry) => {
          const live = dragging && dragging.id === entry.instanceId ? dragging : null;
          const floor = live ? live.floor : floorOf(entry);
          const surface = live ? live.surface : surfaceOf(entry);
          const at = live ? placedSpot(live.x, live.y, floor, surface) : placedSpot(entry.x, entry.y, floor, surface);
          return { entry, at, floor, surface, live: !!live };
        })
        .sort((a, b) => a.at.depth - b.at.depth),
    [furniture, dragging]
  );

  const selectedPiece = selected ? drawnFurniture.find((f) => f.entry.instanceId === selected) ?? null : null;

  const ghostOrnament = mode === "yard" && placing ? getOrnament(placing) : null;
  const ghostFurniture = mode === "room" && placing ? getFurnitureItem(placing) : null;
  const hoverPlace = hover && mode === "room" && placing ? placementFor(placing, hover.x, hover.y) : null;
  const hoverFloor = hoverPlace?.floor ?? null;
  const ghostAt = hover
    ? mode === "room"
      ? hoverPlace
        ? placedSpot(hoverPlace.x, hoverPlace.y, hoverPlace.floor, hoverPlace.surface)
        : null
      : yardSpot(clampToYard(yardPoint(hover.x, hover.y)))
    : null;

  const hint =
    view === "back"
      ? placing
        ? "Click a spot by the rink to put it there"
        : skating
          ? "Skate through the ring"
          : "Veronica is by the rink"
      : placing
        ? mode === "room"
          ? hoverFloor
            ? hoverPlace?.surface === "wall"
              ? `Click to hang it on the wall ${FLOOR_LABEL[hoverFloor]}`
              : `Click to put it down ${FLOOR_LABEL[hoverFloor]}`
            : placing && canHang(placing)
              ? "Click a floor or a wall"
              : "Click a floor to put it down"
          : "Click the lawn to place it"
        : open
          ? furniture.length
            ? "Drag a piece to move it. Tap it for more."
            : "The house is open"
          : "Click the house to open it";

  return (
    <div className="panel">
      <GameHud
        houseStyleId={progress.houseStyleId}
        mode={open ? "inside" : "outside"}
        hint={view === "back" ? "The backyard, with the rink." : house.description}
        view={view}
        onView={(v) => setView(v)}
        night={night}
        onNight={(n) => {
          setHouseNight(n);
          onUpdate();
        }}
      />

      <div
        ref={stage}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={onStageClick}
        className={`relative aspect-[3/2] w-full touch-none overflow-hidden select-none ${night ? "dh-night" : ""} ${
          placing && view === "front" ? "cursor-crosshair" : ""
        }`}
      >
        {view === "back" ? <BackyardScene styleId={house.id} night={night} /> : <DollhouseScene styleId={house.id} open={open} night={night} />}

        {/* ── The backyard ───────────────────────────────────────── */}
        {view === "back" && (
          <>
            {RINK_SLOTS.map((slot) => {
              const id = rinkDecor[slot.id];
              const item = id ? getRinkItem(id) : undefined;
              const empty = !item;
              if (empty && !placing) return null;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (placing) {
                      const res = placeRinkItem(slot.id, placing);
                      showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
                      if (res.ok) {
                        stopPlacing();
                        onUpdate();
                      }
                      return;
                    }
                    if (mode !== "rink") return;
                    const res = clearRinkSlot(slot.id);
                    showToast({ icon: "review", tone: "info", title: res.message });
                    if (res.ok) onUpdate();
                  }}
                  title={item ? `${item.name}${mode === "rink" ? ", click to pick up" : ""}` : `Put it ${slot.label}`}
                  className={`absolute -translate-x-1/2 -translate-y-full ${
                    empty ? "dh-slot rounded-full ring-2 ring-white ring-offset-2 ring-offset-rose-400/60" : `dh-piece transition-transform hover:scale-105 ${USABLE.has(item.id) ? "dh-lit" : ""}`
                  } ${mode === "rink" || placing ? "" : "pointer-events-none"}`}
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

            {skating ? (
              <RinkGame progress={progress} onExit={() => setSkating(false)} onUpdate={onUpdate} />
            ) : (
              <>
                <div
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: pctX(RINK.cx + RINK.rx - 30), top: pctY(RINK.cy + 96), width: pctX(108), zIndex: 330 }}
                >
                  <Veronica pose="idle" facing={-1} className="w-full" />
                </div>
                {!placing && mode !== "rink" && (
                  <div className="absolute inset-x-0 bottom-0 flex justify-center p-4" style={{ zIndex: 360 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSkating(true);
                      }}
                      className="btn-primary px-7 py-2.5"
                    >
                      Skate with Veronica
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* The whole building is the control that opens it, a house you can
            click is more obvious than a button captioned "go inside". Once it
            is open the rooms take the clicks instead. */}
        {view === "front" && !placing && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="absolute rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
            style={{
              left: pctX(HOUSE.left),
              top: pctY(ROOF_APEX - 10),
              width: pctX(HOUSE.right - HOUSE.left),
              height: pctY(HOUSE.base - ROOF_APEX + 10),
            }}
          >
            <span className="sr-only">Open the {house.name}</span>
          </button>
        )}

        {/* ── Inside ─────────────────────────────────────────────── */}
        {view === "front" &&
          open &&
          drawnFurniture.map(({ entry, at, surface, live }) => {
            const item = getFurnitureItem(entry.itemId);
            if (!item) return null;
            const w = (item.displayWidth ?? 110) * 0.92 * at.scale;
            const lit = USABLE.has(entry.itemId) && !entry.off;
            const isSelected = selected === entry.instanceId;
            const onWall = surface === "wall";
            return (
              <button
                key={entry.instanceId}
                type="button"
                onPointerDown={(e) => pieceDown(e, entry)}
                onPointerMove={(e) => pieceMove(e, entry)}
                onPointerUp={(e) => pieceUp(e, entry)}
                onPointerCancel={() => {
                  dragStart.current = null;
                  dragLatest.current = null;
                  setDragging(null);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-pressed={isSelected}
                title={`${item.name}: drag to move, tap for more`}
                className={`dh-piece absolute -translate-x-1/2 -translate-y-full cursor-grab ${live ? "dh-dragging" : "transition-transform hover:scale-105"} ${
                  lit ? "dh-lit" : ""
                } ${isSelected ? "rounded-lg ring-2 ring-bridge-500 ring-offset-2" : ""}`}
                style={{
                  left: pctX(at.x),
                  top: pctY(at.y),
                  width: pctX(w),
                  aspectRatio: "1 / 1",
                  // Wall pieces hang behind whatever stands on the floor.
                  zIndex: live ? 800 : onWall ? 150 : 200 + Math.round(at.depth * 100),
                }}
              >
                <CartoonFurnitureArt
                  itemId={entry.itemId}
                  fill
                  color={colors[entry.itemId]}
                  off={!!entry.off}
                  className={onWall ? "drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]" : "drop-shadow-[0_5px_6px_rgba(0,0,0,0.35)]"}
                />
              </button>
            );
          })}

        {/* ── What you can do with the piece you tapped ──────────── */}
        {view === "front" && open && selectedPiece && !dragging && (
          <PieceActions
            piece={selectedPiece.entry}
            floor={selectedPiece.floor}
            surface={selectedPiece.surface}
            at={{ x: selectedPiece.at.x, top: selectedPiece.at.y - (getFurnitureItem(selectedPiece.entry.itemId)?.displayWidth ?? 110) * 0.92 * selectedPiece.at.scale }}
            color={colors[selectedPiece.entry.itemId] ?? null}
            showColors={showColors}
            onShowColors={() => setShowColors((s) => !s)}
            onColor={(swatch) => act(() => setItemColor(selectedPiece.entry.itemId, swatch))}
            onToggle={() => act(() => toggleFurniture(selectedPiece.entry.instanceId))}
            onFloor={(floor) => act(() => moveFurnitureToFloor(selectedPiece.entry.instanceId, floor))}
            onSurface={(surface) => act(() => moveFurnitureToSurface(selectedPiece.entry.instanceId, surface))}
            onPickUp={() => {
              const name = getFurnitureItem(selectedPiece.entry.itemId)?.name ?? "It";
              removePlacedFurniture(selectedPiece.entry.instanceId);
              showToast({ icon: "review", tone: "info", title: `${name} is back in the tray.` });
              closeActions();
              onUpdate();
            }}
            onClose={closeActions}
          />
        )}

        {/* ── Outside ────────────────────────────────────────────── */}
        {view === "front" &&
          drawnOrnaments.map(({ entry, at }) => {
          const item = getOrnament(entry.itemId);
          if (!item) return null;
          return (
            <button
              key={entry.instanceId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const res = removePlacedOrnament(entry.instanceId);
                showToast({ icon: "review", tone: "info", title: res.message });
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
            <CartoonFurnitureArt itemId={ghostFurniture.id} fill color={colors[ghostFurniture.id]} />
          </div>
        )}

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4" style={{ zIndex: 360 }}>
          {view === "back" && !placing ? null : placing ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); stopPlacing(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          ) : view === "front" ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
              className="btn-primary px-7 py-2.5"
            >
              {open ? "Close the house" : "Open the house"}
            </button>
          ) : null}
        </div>

        {!skating && (
          <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
            {hint}
          </p>
        )}
      </div>

      {/* ── Decorating tray ──────────────────────────────────────── */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Decorate</p>
          <div className="flex gap-2">
            {view === "front" ? (
              <>
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
                    // Furniture only makes sense once you can see the rooms.
                    setOpen(true);
                    setMode((m) => (m === "room" ? "off" : "room"));
                    stopPlacing();
                  }}
                  aria-pressed={mode === "room"}
                  className={mode === "room" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                >
                  Inside
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSkating(false);
                  setMode((m) => (m === "rink" ? "off" : "rink"));
                  stopPlacing();
                }}
                aria-pressed={mode === "rink"}
                className={mode === "rink" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                Rink
              </button>
            )}
          </div>
        </div>

        {mode === "off" && view === "front" && (
          <p className="mt-2 text-sm text-slate-600">
            {ornaments.length + furniture.length === 0
              ? `Furniture and ${ORNAMENTS.length} garden ornaments are in the Shop. Two floors to fill.`
              : `${furniture.length} inside (${furniture.filter((f) => floorOf(f) === "up").length} upstairs, ${furniture.filter((f) => surfaceOf(f) === "wall").length} on the walls), ${ornaments.length} out in the garden. Drag a piece to move it; tap it to paint it, switch it, hang it, send it up the stairs, or pick it up.`}
          </p>
        )}
        {mode === "off" && view === "back" && (
          <p className="mt-2 text-sm text-slate-600">
            {Object.keys(rinkDecor).length === 0
              ? "Rink pieces are in the Shop, under Rink. Veronica skates whenever you like."
              : `${Object.keys(rinkDecor).length} of ${RINK_SLOTS.length} spots by the rink are taken. Press Rink to move things.`}
          </p>
        )}

        {mode !== "off" && (
          <Tray
            items={mode === "yard" ? spareOrnaments : mode === "rink" ? spareRink : spareFurniture}
            kind={mode}
            placing={placing}
            colors={colors}
            onPick={(id) => {
              setPlacing((cur) => (cur === id ? null : id));
              setHover(null);
            }}
            placedCount={mode === "yard" ? ornaments.length : mode === "rink" ? Object.keys(rinkDecor).length : furniture.length}
          />
        )}
      </div>
    </div>
  );
}

/** The little bar over a tapped piece: paint it, switch it, hang it, move floors, pick it up. */
function PieceActions({
  piece,
  floor,
  surface,
  at,
  color,
  showColors,
  onShowColors,
  onColor,
  onToggle,
  onFloor,
  onSurface,
  onPickUp,
  onClose,
}: {
  piece: PlacedFurnitureEntry;
  floor: HouseFloor;
  surface: HouseSurface;
  at: { x: number; top: number };
  color: string | null;
  showColors: boolean;
  onShowColors: () => void;
  onColor: (swatch: string | null) => void;
  onToggle: () => void;
  onFloor: (floor: HouseFloor) => void;
  onSurface: (surface: HouseSurface) => void;
  onPickUp: () => void;
  onClose: () => void;
}) {
  const item = getFurnitureItem(piece.itemId);
  if (!item) return null;
  const usable = USABLE.has(piece.itemId);
  const hangs = canHang(piece.itemId);
  const other: HouseFloor = floor === "up" ? "down" : "up";
  // Kept inside the stage: the bar is centred on the piece unless that would
  // push it off an edge.
  const left = Math.max(14, Math.min(86, (at.x / SCENE_W) * 100));
  const top = Math.max(2, (at.top / SCENE_H) * 100 - 1.5);
  return (
    <div
      role="group"
      aria-label={`${item.name} actions`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="dh-actions absolute -translate-x-1/2 -translate-y-full"
      style={{ left: `${left}%`, top: `${top}%`, zIndex: 900 }}
    >
      <div className="rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <span className="max-w-[9rem] truncate px-1.5 text-xs font-semibold text-slate-800">{item.name}</span>
          <ActionButton label={showColors ? "Colours, hide" : "Colour"} pressed={showColors} onClick={onShowColors}>
            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ background: color ? swatchHex(color) : primaryHex(piece.itemId) }} />
          </ActionButton>
          {usable && (
            <ActionButton label={piece.off ? "Turn on" : "Turn off"} onClick={onToggle}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0" />
              </svg>
            </ActionButton>
          )}
          {hangs && (
            <ActionButton label={surface === "wall" ? "To the floor" : "On the wall"} onClick={() => onSurface(surface === "wall" ? "floor" : "wall")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {surface === "wall" ? <path d="M4 20h16M6 20V9l6-5 6 5v11" /> : <path d="M4 4h16v12H4zM9 20h6M12 16v4" />}
              </svg>
            </ActionButton>
          )}
          <ActionButton label={other === "up" ? "Upstairs" : "Downstairs"} onClick={() => onFloor(other)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {other === "up" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
            </svg>
          </ActionButton>
          <ActionButton label="Pick up" onClick={onPickUp}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
          </ActionButton>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {showColors && (
          <div className="mt-1.5 border-t border-slate-100 pt-1.5">
            <ColorDots itemId={piece.itemId} value={color} onPick={onColor} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition ${
        pressed ? "bg-bridge-50 text-bridge-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

/** The swatches a piece can be painted in, its own colour first. */
export function ColorDots({ itemId, value, onPick, size = 18 }: { itemId: string; value: string | null | undefined; onPick: (swatch: string | null) => void; size?: number }) {
  const dot = (hex: string, selected: boolean, title: string, pick: () => void) => (
    <button
      key={title}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={title}
      title={title}
      onClick={pick}
      className={`rounded-full ring-2 ring-offset-1 transition hover:scale-110 ${selected ? "ring-slate-800" : "ring-transparent hover:ring-slate-300"}`}
      style={{ width: size, height: size, background: hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
    />
  );
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-1.5">
      {dot(primaryHex(itemId), !value, "Its own colour", () => onPick(null))}
      {SWATCHES.map((s) => dot(swatchHex(s.id), value === s.id, s.name, () => onPick(s.id)))}
    </div>
  );
}

function Tray({
  items,
  kind,
  placing,
  colors,
  onPick,
  placedCount,
}: {
  items: string[];
  kind: "yard" | "room" | "rink";
  placing: string | null;
  colors: Record<string, string>;
  onPick: (id: string) => void;
  placedCount: number;
}) {
  if (items.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        {placedCount === 0
          ? kind === "yard"
            ? "Nothing to put out yet. Ornaments are in the Shop, under Garden."
            : kind === "rink"
              ? "Nothing for the rink yet. Rink pieces are in the Shop, under Rink."
              : "Nothing to put in yet. Furniture is in the Shop."
          : kind === "room"
            ? "Everything you own is in the house. Tap a piece to pick it up again."
            : "Everything you own is out. Click a piece to pick it up again."}
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((id, i) => {
          const name =
            kind === "yard" ? getOrnament(id)?.name : kind === "rink" ? getRinkItem(id)?.name : getFurnitureItem(id)?.name;
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
                  <CartoonFurnitureArt itemId={id} fill color={colors[id]} />
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
          : kind === "rink"
            ? "Pick a piece, then click one of the spots that light up around the rink."
            : "Pick a piece, then click a floor, upstairs or down. Pictures, shelves and lights can go on a wall too. Nearer the front means larger."}
      </p>
    </>
  );
}
