"use client";

import { useEffect, useRef, useState } from "react";
import { FURNITURE_ITEMS } from "@/data/house-catalog";

interface Shot {
  id: string;
  name: string;
  url: string | null;
  modelled: boolean;
}

/**
 * The /demo/furniture sheet (see its page for the address options). Sets
 * window.__sheetReady once every picture is in, for scripts that photograph it.
 */
export function FurnitureSheet() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [room, setRoom] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ids = (q.get("ids") ?? "").split(",").filter(Boolean);
    const items = ids.length ? ids.map((id) => FURNITURE_ITEMS.find((f) => f.id === id) ?? { id, name: id }) : FURNITURE_ITEMS;
    const color = q.get("color");
    const on = q.get("off") !== "1";
    const inRoom = q.get("room") === "1";
    setRoom(inRoom);
    let cancelled = false;
    (async () => {
      const { pieceShot } = await import("@/lib/house3d/studio");
      const { hasModel } = await import("@/lib/house3d/registry");
      if (inRoom) return;
      setShots(items.map((i) => ({ id: i.id, name: i.name, url: null, modelled: hasModel(i.id) })));
      // A student partway through, so the pieces that show progress show some.
      const { DEFAULT_LIVE } = await import("@/lib/house3d/types");
      const live = { ...DEFAULT_LIVE, goalRight: 6, streak: 9, unitsDone: 5, skillsDone: 19, growth: 0.6, skillTitle: "Slope from two points", keyIdea: "Slope is rise over run." };
      (window as unknown as { __live?: unknown }).__live = live;
      for (const item of items) {
        const url = await pieceShot(item.id, { color, on, live, width: 360, height: 270 });
        if (cancelled) return;
        setShots((s) => s.map((x) => (x.id === item.id ? { ...x, url } : x)));
      }
      (window as unknown as { __sheetReady?: boolean }).__sheetReady = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room || !canvasRef.current) return;
    const q = new URLSearchParams(window.location.search);
    const ids = (q.get("ids") ?? "desk,chair,bed,bookshelf,lamp,plant,tv,rug,clock").split(",").filter(Boolean);
    let view: import("@/lib/house3d/engine").HouseView | null = null;
    let cancelled = false;
    (async () => {
      const { HouseView, mountOf } = await import("@/lib/house3d/engine");
      const { modelFor } = await import("@/lib/house3d/registry");
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      view = new HouseView(canvas);
      const rect = canvas.getBoundingClientRect();
      view.resize(rect.width, rect.height);
      view.setRoom(q.get("theme") ?? "cottage", q.get("floor") === "up" ? "up" : "down", q.get("night") === "1");
      // Floor pieces in rows across the room, hung pieces along the wall.
      const floorIds = ids.filter((id) => mountOf(modelFor(id)) !== "wall");
      const wallIds = ids.filter((id) => mountOf(modelFor(id)) === "wall");
      const cols = Math.max(1, Math.ceil(Math.sqrt(floorIds.length * 1.6)));
      const rows = Math.max(1, Math.ceil(floorIds.length / cols));
      const pieces = [
        ...floorIds.map((itemId, i) => ({
          instanceId: `f${i}`,
          itemId,
          x: 12 + ((i % cols) + 0.5) * (76 / cols),
          y: 18 + (Math.floor(i / cols) + 0.5) * (70 / rows),
          surface: "floor" as const,
          color: q.get("color"),
          on: q.get("off") !== "1",
        })),
        ...wallIds.map((itemId, i) => ({
          instanceId: `w${i}`,
          itemId,
          x: ((i + 0.5) / wallIds.length) * 100,
          y: 35,
          surface: "wall" as const,
          color: q.get("color"),
          on: q.get("off") !== "1",
        })),
      ];
      view.setPieces(pieces);
      (window as unknown as { __sheetReady?: boolean }).__sheetReady = true;
    })();
    return () => {
      cancelled = true;
      view?.dispose();
    };
  }, [room]);

  if (room) return <canvas ref={canvasRef} className="block h-[100vh] w-full bg-[#eef0f3]" />;
  return (
    <div className="grid grid-cols-2 gap-3 bg-[#eef0f3] p-4 sm:grid-cols-3 lg:grid-cols-4">
      {shots.map((s) => (
        <figure key={s.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100">
            {s.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt={s.name} className="h-full w-full object-contain" />
            )}
          </div>
          <figcaption className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="font-semibold text-slate-800">{s.name}</span>
            <span className={s.modelled ? "text-slate-400" : "font-semibold text-rose-600"}>{s.modelled ? s.id : `${s.id}: crate`}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
