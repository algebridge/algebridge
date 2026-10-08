"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppNavState } from "@/components/AppNavProvider";
import { Icon, type IconName } from "@/components/Icon";
import { PieceShot } from "@/components/house/PieceShot";
import { ColorDots } from "@/components/house/ColorDots";
import { useHouseLive } from "@/components/house/useHouseLive";
import { useScratchpad } from "@/components/Scratchpad";
import { units } from "@/data/curriculum";
import { USABLE } from "@/data/furniture-art";
import { getFurnitureItem, getUnplacedFurnitureIds } from "@/data/house-catalog";
import { getOrnament, getUnplacedOrnamentIds, ORNAMENTS } from "@/data/ornament-catalog";
import {
  floorOf,
  moveFurniture,
  moveFurnitureToFloor,
  placeFurnitureAt,
  moveOrnament,
  placeOrnamentAt,
  removePlacedFurniture,
  removePlacedOrnament,
  setHouseNight,
  setItemColor,
  surfaceOf,
  toggleFurniture,
  toggleOrnament,
} from "@/lib/bridgeys";
import { gardenState, type GardenState } from "@/lib/garden";
import { PICTURES_VERSION, PORCH_PICTURES } from "@/data/house-pictures";
import { ornamentNote, pieceNote, pieceUse, restDayAvailable, USES, type UseKind } from "@/lib/house-functions";
import { requestHelperOpen } from "@/lib/helper-bridge";
import { showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { setMusicEnabled } from "@/lib/progress";
import { useAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/social";
import type { GardenPick, HouseView, ScenePiece } from "@/lib/house3d/engine";
import type { LiveData } from "@/lib/house3d/types";
import type { HouseFloor, UserProgress } from "@/types";

type View = "front" | "down" | "up" | "garden";

const USE_ICON: Record<UseKind, IconName> = {
  study: "course",
  water: "spark",
  watch: "play",
  play: "versus",
  read: "notebook",
  draw: "pen",
  listen: "music",
  ask: "helper",
  review: "review",
  break: "star",
  certificates: "trophy",
  unit: "flag",
  light: "spark",
  rest: "clock",
};

interface Props {
  progress: UserProgress;
  onUpdate: () => void;
  onShop?: () => void;
  /** In algebridge.org's frame: a piece's job opens the real app, in the whole window. */
  embedded?: boolean;
}

/**
 * The Bridgey House: your rooms and your garden as a real 3D place
 * (lib/house3d). Downstairs, upstairs, the garden; day or night.
 *
 * Every piece has a job (lib/house-functions.ts). Tap one and its card says
 * what it does and what it is showing (today's goal on the clock, a book on
 * the shelf for every skill finished), with the button that does it: Study,
 * Watch, Play, Read, Draw, Music, Ask Archie. Drag a piece to move it; drag
 * the room to look round it.
 */
export function House3D({ progress, onUpdate, onShop, embedded = false }: Props) {
  const router = useRouter();
  const { continueTarget } = useAppNavState();
  const scratchpad = useScratchpad();
  // The porch first; a link can open another place (/house?view=garden).
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "front";
    const asked = new URLSearchParams(window.location.search).get("view");
    return asked === "down" || asked === "up" || asked === "garden" || asked === "front" ? asked : "front";
  });
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useAuth();
  /** Unread messages, for the mailbox's flag out front (null when signed out). */
  const [unread, setUnread] = useState<number | null>(null);
  /** A part of the garden itself that was tapped: a unit's bed, the sprinkler, the tree. */
  const [gardenPick, setGardenPick] = useState<GardenPick | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [ready, setReady] = useState(false);
  /** The first frame is on screen (shaders compile in the background before it). */
  const [drawn, setDrawn] = useState(false);
  /** A new place is being prepared for its first showing (shaders compiling in the background). */
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = useRef<HouseView | null>(null);
  const gesture = useRef<{ id: string | null; x: number; y: number; moved: boolean; stored: { x: number; y: number; surface: "floor" | "wall" } | null } | null>(null);
  const pinch = useRef<{ d: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const night = !!progress.houseNight;
  const furniture = useMemo(() => progress.placedFurnitureItems ?? [], [progress.placedFurnitureItems]);
  const ornaments = useMemo(() => progress.placedOrnaments ?? [], [progress.placedOrnaments]);
  const colors = useMemo(() => progress.itemColors ?? {}, [progress.itemColors]);
  const spareFurniture = useMemo(() => getUnplacedFurnitureIds(progress.ownedFurniture ?? [], furniture), [progress.ownedFurniture, furniture]);
  const spareOrnaments = useMemo(() => getUnplacedOrnamentIds(progress.ownedOrnaments ?? [], ornaments), [progress.ownedOrnaments, ornaments]);
  const garden = useMemo(() => gardenState(progress, today()), [progress]);
  const styleForPicture = progress.houseStyleId ?? "cottage";
  const porchPicture = view === "front" && !drawn && !night && PORCH_PICTURES.has(styleForPicture) ? `/house/pictures/porch-${styleForPicture}.jpg?v=${PICTURES_VERSION}` : null;

  // What the pieces show: the student's real day, refreshed each minute for the clocks.
  const live = useHouseLive(progress, { tick: true });

  // The view: made once the canvas is on the page, in the browser only.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        // The 3D code arrives separately; a load that fails (a deploy just went out, a flaky network) is tried again.
        let engineModule: typeof import("@/lib/house3d/engine") | null = null;
        for (let tries = 0; !engineModule; tries += 1) {
          try {
            engineModule = await import("@/lib/house3d/engine");
          } catch (err) {
            if (tries >= 2 || disposed) throw err;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        const { HouseView } = engineModule;
        if (disposed || !canvasRef.current) return;
        const v = new HouseView(canvasRef.current);
        engine.current = v;
        // For the test scripts: where a piece is on screen.
        if (process.env.NODE_ENV !== "production") (window as unknown as { __houseView?: HouseView }).__houseView = v;
        const fit = () => {
          const r = canvasRef.current?.getBoundingClientRect();
          if (r) v.resize(r.width, r.height);
        };
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(canvasRef.current);
        v.onBusy = (b) => {
          if (!disposed) setPreparing(b);
        };
        setReady(true);
        void v.firstFrame.then(() => {
          if (!disposed) setDrawn(true);
        });
      } catch (err) {
        // No WebGL: the list under the stage still does everything.
        console.error("The 3D house could not start:", err);
        setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  // The room or the garden, kept in step with the save.
  const pieces: ScenePiece[] = useMemo(
    () =>
      view === "garden"
        ? []
        : furniture
            // The porch view's dollhouse shows both floors at once.
            .filter((f) => view === "front" || floorOf(f) === view)
            .map((f) => ({ instanceId: f.instanceId, itemId: f.itemId, x: f.x, y: f.y, surface: surfaceOf(f), color: colors[f.itemId] ?? null, on: !f.off, floor: floorOf(f) })),
    [furniture, colors, view]
  );
  useEffect(() => {
    const v = engine.current;
    if (!ready || !v) return;
    v.setLive(live);
    if (view === "front") {
      v.showFront(progress.houseStyleId, night, unread ?? 0);
      v.setPieces(pieces);
    } else if (view === "garden") {
      v.showGarden(garden, progress.houseStyleId, night, ornaments.map((o) => ({ instanceId: o.instanceId, itemId: o.itemId, x: o.x, z: o.z, on: !o.off })));
    } else {
      v.setRoom(progress.houseStyleId, view, night);
      v.setPieces(pieces);
    }
  }, [ready, view, pieces, live, night, progress.houseStyleId, garden, ornaments, unread]);

  // The mailbox out front reads the inbox when you go out there.
  useEffect(() => {
    if (view !== "front") return;
    if (!user) {
      setUnread(null);
      return;
    }
    let live = true;
    getUnreadCount().then((n) => live && setUnread(n));
    return () => {
      live = false;
    };
  }, [view, user]);

  useEffect(() => {
    engine.current?.select(selected);
  }, [selected, ready]);

  // A piece picked up or moved away underneath the card closes it.
  useEffect(() => {
    if (!selected) return;
    const still = view === "garden" ? ornaments.some((o) => o.instanceId === selected) : furniture.some((f) => f.instanceId === selected && (view === "front" || floorOf(f) === view));
    if (!still) setSelected(null);
  }, [furniture, ornaments, selected, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setGardenPick(null);
        setShowColors(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Pointer: tap a piece for its card, drag it to move it, drag the room to look round ──

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const v = engine.current;
    if (!v) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* still works without capture */
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      gesture.current = null;
      v.endDrag();
      return;
    }
    const id = v.pick(e.clientX, e.clientY);
    gesture.current = { id, x: e.clientX, y: e.clientY, moved: false, stored: null };
    if (id) v.beginDrag(id, e.clientX, e.clientY);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const v = engine.current;
    if (!v || !pointers.current.has(e.pointerId)) return;
    const last = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.d > 0) v.zoom(d / pinch.current.d);
      pinch.current.d = d;
      return;
    }
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
    g.moved = true;
    // In the porch view a drag always turns the house; pieces are moved in their room.
    if (g.id && view !== "front") {
      g.stored = v.dragTo(e.clientX, e.clientY);
      setSelected(null);
    } else {
      v.turn(e.clientX - last.x, e.clientY - last.y);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const v = engine.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const g = gesture.current;
    gesture.current = null;
    if (!v || !g) return;
    v.endDrag();
    if (g.id && g.moved && g.stored) {
      if (view === "garden") {
        // Garden ornaments are moved by the garden view itself (metres, not percentages).
        const at = v.gardenSpotOf(g.id);
        if (at && moveOrnament(g.id, at.x, at.z).ok) onUpdate();
      } else {
        const res = moveFurniture(g.id, g.stored.x, g.stored.y, view as HouseFloor, g.stored.surface);
        if (res.ok) onUpdate();
      }
      return;
    }
    if (!g.moved) {
      setShowColors(false);
      setSelected((s) => (g.id && s !== g.id ? g.id : null));
      // In the garden, a tap on a bed, the sprinkler or the tree opens its card; on the house, it takes you in.
      const part = (view === "garden" || view === "front") && !g.id ? v.pickGarden(e.clientX, e.clientY) : null;
      if (part?.kind === "house") {
        setView("down");
        setGardenPick(null);
      } else setGardenPick(part);
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    // Trackpad pinches arrive as ctrl+wheel; a plain wheel scrolls the page as usual.
    if (!e.ctrlKey) return;
    e.preventDefault();
    engine.current?.zoom(e.deltaY < 0 ? 1.06 : 0.94);
  }

  // ── Doing what a piece is for ──

  const learnHref = continueTarget ? `/learn/${continueTarget.unitId}/${continueTarget.skillId}` : "/";
  const use = useCallback(
    (itemId: string, instanceId: string, what: "furniture" | "ornament" = "furniture") => {
      const kind = pieceUse(itemId, what);
      // In the frame on algebridge.org a page opens the app itself, in the whole window.
      const go = (href: string) => (embedded ? window.open(`https://learn.algebridge.org${href}`, "_top") : router.push(href));
      switch (kind) {
        case "study":
        case "water":
          go(learnHref);
          return;
        case "watch":
          go(`${learnHref}${continueTarget ? "#watch" : ""}`);
          return;
        case "play":
          go("/games");
          return;
        case "read":
          go("/notebook");
          return;
        case "draw":
          scratchpad.toggle();
          return;
        case "listen": {
          if (embedded) {
            showToast({ icon: "music", tone: "info", title: "In the app, this turns the study music on." });
            return;
          }
          const on = !progress.musicEnabled;
          setMusicEnabled(on);
          showToast({ icon: on ? "music" : "speaker-off", tone: "info", title: on ? "Study music on." : "Study music off." });
          onUpdate();
          return;
        }
        case "ask":
        case "break":
          requestHelperOpen();
          return;
        case "review":
          go("/review");
          return;
        case "certificates":
          go("/achievements#certificates");
          return;
        case "unit": {
          const unit = getFurnitureItem(itemId)?.earnedBy;
          go(unit ? `/unit/${unit}` : "/");
          return;
        }
        case "light": {
          const res = what === "ornament" ? toggleOrnament(instanceId) : toggleFurniture(instanceId);
          if (res.ok) onUpdate();
          return;
        }
        case "rest":
          showToast({ icon: "clock", tone: "info", title: pieceNote(itemId, live, { available: restDayAvailable(progress) }) });
          return;
      }
    },
    [router, learnHref, continueTarget, scratchpad, progress, onUpdate, live, embedded]
  );

  function act(fn: () => { ok: boolean; message: string }) {
    const res = fn();
    showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
    if (res.ok) onUpdate();
  }

  /** A piece from the tray goes into the middle of the room you are looking at, ready to drag. */
  function placeFromTray(itemId: string) {
    if (view === "garden") {
      const res = placeOrnamentAt(itemId, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.ok ? `${getOrnament(itemId)?.name ?? "It"} is out in the garden. Drag it where you want it.` : res.message });
      if (res.ok) onUpdate();
      return;
    }
    if (view === "front") return;
    const hangs = getFurnitureItem(itemId)?.mount === "wall";
    placed.current = { itemId, before: new Set(furniture.map((f) => f.instanceId)) };
    const res = placeFurnitureAt(itemId, hangs ? 50 : 40 + Math.random() * 20, hangs ? 40 : 50 + Math.random() * 15, view, hangs ? "wall" : "floor");
    showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.ok ? `${getFurnitureItem(itemId)?.name ?? "It"} is in. Drag it where you want it.` : res.message });
    if (res.ok) onUpdate();
    else placed.current = null;
  }

  // The piece just put in is selected, so its card and its job are right there.
  const placed = useRef<{ itemId: string; before: Set<string> } | null>(null);
  useEffect(() => {
    const p = placed.current;
    if (!p) return;
    const added = furniture.find((f) => f.itemId === p.itemId && !p.before.has(f.instanceId));
    if (added) {
      placed.current = null;
      setSelected(added.instanceId);
    }
  }, [furniture]);

  // ── What is selected ──

  const selFurniture = view !== "garden" && selected ? furniture.find((f) => f.instanceId === selected) ?? null : null;
  const selOrnament = view === "garden" && selected ? ornaments.find((o) => o.instanceId === selected) ?? null : null;
  const onThisFloor = view === "garden" ? [] : furniture.filter((f) => floorOf(f) === view);

  return (
    <div className="panel overflow-hidden">
      {/* Where you are, and day or night. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div role="tablist" aria-label="Where in the house" className="inline-flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ["front", "Porch"],
              ["down", "Downstairs"],
              ["up", "Upstairs"],
              ["garden", "Garden"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => {
                setView(id);
                setSelected(null);
                setGardenPick(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setHouseNight(!night);
              onUpdate();
            }}
            aria-pressed={night}
            className="btn-secondary btn-sm"
          >
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${night ? "bg-indigo-500" : "bg-amber-400"}`} />
            {night ? "Night" : "Day"}
          </button>
          <button type="button" onClick={() => engine.current?.resetView()} className="btn-ghost btn-sm" aria-label="Back to the usual view">
            <Icon name="review" size={15} />
          </button>
        </div>
      </div>

      {/* The room. */}
      <div ref={stageRef} className="relative aspect-[4/5] w-full bg-gradient-to-b from-[#eef1f5] to-[#e3e7ec] sm:aspect-[16/10]">
        {/* The porch at once, as a picture rendered ahead of time, while the 3D view gets ready behind it. */}
        {porchPicture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={porchPicture} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          aria-label={view === "front" ? "The front of your house, in 3D. Tap the door to go in, or the mailbox for your messages." : view === "garden" ? "Your garden, in 3D" : `Your ${view === "up" ? "upstairs" : "downstairs"} room, in 3D. Drag a piece to move it; tap it to use it.`}
          className="absolute inset-0 h-full w-full touch-none select-none"
        />
        {drawn && preparing && (
          <p className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-max rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm" aria-live="polite">
            Getting it ready…
          </p>
        )}
        {!drawn && !failed && (
          <p
            className={porchPicture ? "pointer-events-none absolute inset-x-0 top-14 mx-auto w-max rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm" : "absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-500"}
            aria-live="polite"
          >
            Opening the house…
          </p>
        )}
        {failed && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-slate-600">
            This browser cannot draw the house in 3D. Your pieces and what they do are listed below.
          </p>
        )}
        <p className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
          {view === "front"
            ? unread
              ? `The flag is up: ${unread} new ${unread === 1 ? "message" : "messages"}. Tap the mailbox. Drag to walk round the house, zoom in to see inside.`
              : "Drag to walk round the house. Zoom in to see inside. The mailbox holds your messages."
            : view === "garden"
            ? garden.watered
              ? "Watered today. Tap a plant to open its unit, or the house to go in."
              : "Answer a problem today to water the garden. Tap a plant to open its unit."
            : onThisFloor.length
              ? "Tap a piece to use it. Drag it to move it, or drag the room to look round."
              : "An empty room. Put pieces in from the tray below."}
        </p>
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => engine.current?.zoom(1.15)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-slate-900" aria-label="Zoom in">
            <Icon name="plus" size={16} />
          </button>
          <button type="button" onClick={() => engine.current?.zoom(1 / 1.15)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-slate-900" aria-label="Zoom out">
            <span aria-hidden className="text-lg font-semibold leading-none">-</span>
          </button>
        </div>

        {/* The card for the piece you tapped: what it does, and doing it. */}
        {selFurniture && (
          <PieceCard
            itemId={selFurniture.itemId}
            note={pieceNote(selFurniture.itemId, live, { available: restDayAvailable(progress) })}
            useKind={pieceUse(selFurniture.itemId)}
            onUse={() => use(selFurniture.itemId, selFurniture.instanceId)}
            on={!selFurniture.off}
            switchable={USABLE.has(selFurniture.itemId)}
            onSwitch={() => act(() => toggleFurniture(selFurniture.instanceId))}
            color={colors[selFurniture.itemId] ?? null}
            showColors={showColors}
            onShowColors={() => setShowColors((s) => !s)}
            onColor={(swatch) => act(() => setItemColor(selFurniture.itemId, swatch))}
            floorLabel={floorOf(selFurniture) === "up" ? "Downstairs" : "Upstairs"}
            onFloor={() => act(() => moveFurnitureToFloor(selFurniture.instanceId, floorOf(selFurniture) === "up" ? "down" : "up"))}
            onPutAway={() => {
              const name = getFurnitureItem(selFurniture.itemId)?.name ?? "It";
              removePlacedFurniture(selFurniture.instanceId);
              showToast({ icon: "review", tone: "info", title: `${name} is back in the tray.` });
              setSelected(null);
              onUpdate();
            }}
            onClose={() => setSelected(null)}
            live={live}
          />
        )}
        {selOrnament && (
          <OrnamentCard
            itemId={selOrnament.itemId}
            note={ornamentNote(selOrnament.itemId, live)}
            useKind={pieceUse(selOrnament.itemId, "ornament")}
            on={!selOrnament.off}
            onUse={() => use(selOrnament.itemId, selOrnament.instanceId, "ornament")}
            onPutAway={() => {
              const res = removePlacedOrnament(selOrnament.instanceId);
              showToast({ icon: "review", tone: "info", title: res.message });
              setSelected(null);
              if (res.ok) onUpdate();
            }}
            onClose={() => setSelected(null)}
          />
        )}
        {(view === "garden" || view === "front") && gardenPick && !selOrnament && (
          <GardenCard
            pick={gardenPick}
            garden={garden}
            unread={unread}
            onGo={(href) => {
              setGardenPick(null);
              if (embedded) window.open(`https://learn.algebridge.org${href}`, "_top");
              else router.push(href);
            }}
            learnHref={learnHref}
            onClose={() => setGardenPick(null)}
          />
        )}
      </div>

      {/* The pieces in this room, as buttons: the same cards without a mouse. */}
      {view !== "garden" && onThisFloor.length > 0 && (
        <div className="sr-only focus-within:not-sr-only focus-within:border-t focus-within:border-slate-200 focus-within:px-4 focus-within:py-3">
          <p className="text-xs font-semibold text-slate-600">In this room</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {onThisFloor.map((f) => (
              <button key={f.instanceId} type="button" onClick={() => setSelected(f.instanceId)} aria-pressed={selected === f.instanceId} className="btn-secondary btn-sm">
                {getFurnitureItem(f.itemId)?.name ?? f.itemId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The tray: what you own and have not put out yet. */}
      {view !== "front" && (
      <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">{view === "garden" ? "Garden ornaments" : "Your pieces"}</p>
          {onShop && (
            <button
              type="button"
              onClick={() => {
                onShop();
                const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
              }}
              className="btn-primary btn-sm"
            >
              Open the shop
            </button>
          )}
        </div>
        {view === "garden" && (
          <p className="mt-2 text-sm text-slate-600">
            {garden.treehouse
              ? `Every flower is open and the treehouse is up: all ${garden.total} skills finished.`
              : `${garden.blooms} of ${garden.beds.length} flowers in bloom, ${garden.done} of ${garden.total} skills finished. A bed for every unit: finish the unit and its flower opens.`}
          </p>
        )}
        {(view === "garden" ? spareOrnaments : spareFurniture).length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            {view === "garden"
              ? `Every ornament you own is out. ${ORNAMENTS.length} are in the Shop.`
              : furniture.length
                ? "Everything you own is in the house. Tap a piece and Put away to bring it back here."
                : "Your pieces wait here once you buy them in the Shop."}
          </p>
        ) : (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(view === "garden" ? spareOrnaments : spareFurniture).map((id, i) => {
              const name = view === "garden" ? getOrnament(id)?.name : getFurnitureItem(id)?.name;
              if (!name) return null;
              return (
                <button
                  key={`${id}-${i}`}
                  type="button"
                  onClick={() => placeFromTray(id)}
                  className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 transition hover:border-bridge-300 hover:shadow-panel"
                >
                  <PieceShot itemId={id} color={colors[id] ?? null} alt="" ornament={view === "garden"} className="h-14 w-full" />
                  <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function PieceCard({
  itemId,
  note,
  useKind,
  onUse,
  on,
  switchable,
  onSwitch,
  color,
  showColors,
  onShowColors,
  onColor,
  floorLabel,
  onFloor,
  onPutAway,
  onClose,
  live,
}: {
  itemId: string;
  note: string;
  useKind: UseKind;
  onUse: () => void;
  on: boolean;
  switchable: boolean;
  onSwitch: () => void;
  color: string | null;
  showColors: boolean;
  onShowColors: () => void;
  onColor: (swatch: string | null) => void;
  floorLabel: string;
  onFloor: () => void;
  onPutAway: () => void;
  onClose: () => void;
  live: LiveData;
}) {
  const item = getFurnitureItem(itemId);
  if (!item) return null;
  const spec = USES[useKind];
  const useLabel = useKind === "unit" && item.earnedBy ? `Revisit Unit ${units.find((u) => u.id === item.earnedBy)?.number ?? ""}` : useKind === "light" ? (on ? "Turn off" : "Turn on") : spec.verb;
  return (
    <div
      role="group"
      aria-label={`${item.name}: what it does`}
      onPointerDown={(e) => e.stopPropagation()}
      className="animate-pop-in absolute inset-x-3 bottom-3 z-10 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg sm:inset-x-auto sm:left-3"
    >
      <div className="flex items-start gap-3">
        <PieceShot itemId={itemId} color={color} on={on} live={live} alt="" className="h-14 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
            <button type="button" onClick={onClose} className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">{note}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onUse} className="btn-primary btn-sm">
          <Icon name={USE_ICON[useKind]} size={15} />
          {useLabel}
        </button>
        <button type="button" onClick={onShowColors} aria-pressed={showColors} className="btn-secondary btn-sm">
          Color
        </button>
        {switchable && useKind !== "light" && (
          <button type="button" onClick={onSwitch} className="btn-secondary btn-sm">
            {on ? "Turn off" : "Turn on"}
          </button>
        )}
        <button type="button" onClick={onFloor} className="btn-secondary btn-sm">
          {floorLabel}
        </button>
        <button type="button" onClick={onPutAway} className="btn-ghost btn-sm">
          Put away
        </button>
      </div>
      {showColors && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <ColorDots itemId={itemId} value={color} onPick={onColor} />
        </div>
      )}
    </div>
  );
}

const CARD = "animate-pop-in absolute inset-x-3 bottom-3 z-10 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg sm:inset-x-auto sm:left-3";

function OrnamentCard({ itemId, note, useKind, on, onUse, onPutAway, onClose }: { itemId: string; note: string; useKind: UseKind; on: boolean; onUse: () => void; onPutAway: () => void; onClose: () => void }) {
  const item = getOrnament(itemId);
  if (!item) return null;
  const label = useKind === "light" ? (on ? "Turn off" : "Turn on") : USES[useKind].verb;
  return (
    <div role="group" aria-label={`${item.name}: what it does`} onPointerDown={(e) => e.stopPropagation()} className={CARD}>
      <div className="flex items-start gap-3">
        <PieceShot itemId={itemId} on={on} alt="" ornament className="h-14 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
            <button type="button" onClick={onClose} className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">{note}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onUse} className="btn-primary btn-sm">
          <Icon name={USE_ICON[useKind]} size={15} />
          {label}
        </button>
        <button type="button" onClick={onPutAway} className="btn-ghost btn-sm">
          Put away
        </button>
      </div>
    </div>
  );
}

const STAGE_WORDS: Record<GardenState["beds"][number]["stage"], string> = {
  seed: "Just planted",
  sprout: "Sprouting",
  leaf: "Leafing out",
  bud: "In bud",
  bloom: "In bloom",
};

/** The card for a part of the garden: a unit's bed opens the unit, the sprinkler and the tree the next skill. */
function GardenCard({ pick, garden, unread, learnHref, onGo, onClose }: { pick: GardenPick; garden: GardenState; unread: number | null; learnHref: string; onGo: (href: string) => void; onClose: () => void }) {
  let title: string;
  let note: string;
  let action: { label: string; icon: IconName; href: string };
  if (pick.kind === "bed") {
    const bed = garden.beds.find((b) => b.number === pick.unit);
    if (!bed) return null;
    title = `Unit ${bed.number}: ${bed.title}`;
    note = `${STAGE_WORDS[bed.stage]}: ${bed.done} of ${bed.total} skills finished.${bed.stage === "bloom" ? " This unit is done." : " Finish the unit and its flower opens."}`;
    action = { label: `Open Unit ${bed.number}`, icon: "flag", href: `/unit/${bed.unitId}` };
  } else if (pick.kind === "sprinkler") {
    title = "Sprinkler";
    note = garden.watered ? "Watered today: you answered a problem right." : "Answer one problem right today and it waters the whole garden.";
    action = { label: USES.water.verb, icon: USE_ICON.water, href: learnHref };
  } else if (pick.kind === "mailbox") {
    title = "Mailbox";
    note =
      unread === null
        ? "Sign in, and messages from your tutors arrive here. The flag goes up when one is waiting."
        : unread > 0
          ? `The flag is up: ${unread} new ${unread === 1 ? "message" : "messages"} waiting.`
          : "All caught up. The flag goes up when a tutor writes to you.";
    action = { label: "Open messages", icon: "messages", href: unread === null ? "/login" : "/messages" };
  } else if (pick.kind === "tree") {
    title = "The tree";
    const next = !garden.swing ? " A tire swing goes up halfway through the course." : !garden.birdhouse ? " A birdhouse comes at three quarters." : !garden.treehouse ? " The treehouse goes up when every skill is finished." : " The treehouse is up.";
    note = `It grows with the whole course: ${garden.done} of ${garden.total} skills finished.${next}`;
    action = { label: USES.study.verb, icon: USE_ICON.study, href: learnHref };
  } else return null;
  return (
    <div role="group" aria-label={title} onPointerDown={(e) => e.stopPropagation()} className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
      <p className="mt-0.5 text-xs leading-snug text-slate-600">{note}</p>
      <div className="mt-3">
        <button type="button" onClick={() => onGo(action.href)} className="btn-primary btn-sm">
          <Icon name={action.icon} size={15} />
          {action.label}
        </button>
      </div>
    </div>
  );
}
