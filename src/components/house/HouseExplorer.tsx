"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFurnitureItem,
  getHouseStyle,
  getUnplacedFurnitureIds,
  ROOM_HEIGHT,
  ROOM_WIDTH,
} from "@/data/house-catalog";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { CartoonRoomBackground } from "@/components/house/CartoonRoomBackground";
import { GameHud } from "@/components/house/GameHud";
import { placeFurnitureAt, removePlacedFurniture } from "@/lib/bridgeys";
import { showToast } from "@/lib/notify";
import type { UserProgress } from "@/types";

// A noticeably bigger character than before (was 52).
const PLAYER_SIZE = 96;
const WALL_PAD = 6;

// Walk speed in PERCENT of the room per second. The room is wider than it is
// tall, so we scale the vertical speed up by the aspect ratio to make the
// character move at the SAME on-screen pixel speed in every direction.
const SPEED_X = 34;
const SPEED_Y = SPEED_X * (ROOM_WIDTH / ROOM_HEIGHT);

// The sprite is anchored bottom-center, so keep it fully inside the room:
// clamp so half its width never crosses a side wall and its head/feet stay in.
const HALF_W_PCT = (PLAYER_SIZE / ROOM_WIDTH) * 50;
const FULL_H_PCT = (PLAYER_SIZE / ROOM_HEIGHT) * 100;
const X_MIN = WALL_PAD + HALF_W_PCT;
const X_MAX = 100 - WALL_PAD - HALF_W_PCT;
const Y_MIN = FULL_H_PCT + 2;
const Y_MAX = 100 - WALL_PAD;

interface HouseExplorerProps {
  progress: UserProgress;
  onUpdate: () => void;
  onExit: () => void;
}

export function HouseExplorer({ progress, onUpdate, onExit }: HouseExplorerProps) {
  const house = getHouseStyle(progress.houseStyleId) ?? getHouseStyle("cottage")!;
  const roomRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const lastTsRef = useRef<number | null>(null);
  const walkingRef = useRef(false);

  const [player, setPlayer] = useState({ x: 50, y: 72 });
  const [facing, setFacing] = useState<"up" | "down" | "left" | "right">("down");
  const [placingItemId, setPlacingItemId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [walking, setWalking] = useState(false);

  const placed = progress.placedFurnitureItems ?? [];
  const unplaced = getUnplacedFurnitureIds(progress.ownedFurniture, placed);

  const updateScale = useCallback(() => {
    if (!roomRef.current) return;
    setScale(roomRef.current.clientWidth / ROOM_WIDTH);
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
      if (e.key === "Escape") setPlacingItemId(null);
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    function tick(ts: number) {
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      // Seconds since the previous frame, clamped so a background tab (which
      // pauses rAF) doesn't produce one giant jump when it resumes.
      const dt = last == null ? 0 : Math.min((ts - last) / 1000, 0.05);

      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("ArrowUp")) dy -= 1;
      if (keys.has("ArrowDown")) dy += 1;
      if (keys.has("ArrowLeft")) dx -= 1;
      if (keys.has("ArrowRight")) dx += 1;
      const moving = dx !== 0 || dy !== 0;

      if (moving && dt > 0) {
        // Normalize diagonals so moving in two directions isn't ~1.4x faster.
        const norm = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
        // Facing is set once per frame here (not inside the state updater) and
        // only changes on actual horizontal movement, so it never flickers.
        if (dx < 0) setFacing("left");
        else if (dx > 0) setFacing("right");
        setPlayer((p) => {
          const x = Math.max(X_MIN, Math.min(X_MAX, p.x + dx * norm * SPEED_X * dt));
          const y = Math.max(Y_MIN, Math.min(Y_MAX, p.y + dy * norm * SPEED_Y * dt));
          return { x, y };
        });
      }

      if (moving !== walkingRef.current) {
        walkingRef.current = moving;
        setWalking(moving);
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingItemId || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    setCursorPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  function handleRoomClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingItemId || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const result = placeFurnitureAt(placingItemId, x, y);
    if (result.ok) {
      showToast({ emoji: "✨", title: result.message });
      setPlacingItemId(null);
      setCursorPos(null);
      onUpdate();
    } else {
      showToast({ emoji: "😅", title: result.message });
    }
  }

  function handleRemove(instanceId: string) {
    removePlacedFurniture(instanceId);
    onUpdate();
    showToast({ emoji: "📦", title: "Picked up! Select it below to place again." });
  }

  return (
    <div className="panel">
      <GameHud
        houseStyleId={progress.houseStyleId}
        onExit={onExit}
        mode="inside"
        hint="Arrow keys to walk"
      />

      {/* The room fills the panel instead of sitting in a fixed 800px box with
          grey gutters either side, and it no longer carries its own heavy black
          frame — the panel is the frame. */}
      <div
        ref={roomRef}
        role="application"
        aria-label="House interior"
        tabIndex={0}
        onClick={handleRoomClick}
        onMouseMove={handleMouseMove}
        className={`game-room relative w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bridge-500 ${
          placingItemId ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}` }}
      >
        <CartoonRoomBackground houseId={house.id} className="absolute inset-0 h-full w-full" />

        {placingItemId && (
          <div className="pointer-events-none absolute inset-0 bg-bridge-400/15 ring-2 ring-inset ring-bridge-500" />
        )}

        {placed.map((entry) => {
          const item = getFurnitureItem(entry.itemId);
          if (!item) return null;
          const w = (item.displayWidth ?? 70) * scale;
          return (
            <button
              key={entry.instanceId}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(entry.instanceId); }}
              title={`${item.name} — click to pick up`}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:scale-110"
              style={{ left: `${entry.x}%`, top: `${entry.y}%`, width: w, height: w, zIndex: Math.round(entry.y) }}
            >
              <CartoonFurnitureArt itemId={entry.itemId} size={w} variant="room" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]" />
            </button>
          );
        })}

        {placingItemId && cursorPos && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 opacity-60"
            style={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              width: (getFurnitureItem(placingItemId)?.displayWidth ?? 70) * scale,
              height: (getFurnitureItem(placingItemId)?.displayWidth ?? 70) * scale,
              zIndex: 999,
            }}
          >
            <CartoonFurnitureArt itemId={placingItemId} size={(getFurnitureItem(placingItemId)?.displayWidth ?? 70) * scale} variant="room" />
          </div>
        )}

        {/* The character is three nested layers, each owning ONE transform so
            they never clobber each other: (1) outer = position + bottom-center
            anchor, (2) middle = left/right facing flip, (3) inner = walk bob. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            width: PLAYER_SIZE * scale,
            height: PLAYER_SIZE * scale,
            zIndex: Math.round(player.y) + 100,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="h-full w-full"
            style={{
              transform: `scaleX(${facing === "left" ? -1 : 1})`,
              transition: "transform 120ms ease",
            }}
          >
            <div className={`relative h-full w-full ${walking ? "animate-gentle-bounce" : ""}`}>
              <Image
                src="/house/player.png"
                alt="You"
                fill
                className="object-contain drop-shadow-lg"
                sizes={`${Math.round(PLAYER_SIZE)}px`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inventory tray — part of the same panel as the room rather than a
          second dark slab underneath it. The instructions live here, next to
          the thing they describe, at a size you can actually read. */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Inventory</p>
          <p className="text-xs text-slate-500">
            {placingItemId
              ? "Click anywhere on the floor to put it down. Esc to cancel."
              : "Pick an item to place it. Click furniture in the room to pick it back up."}
          </p>
        </div>

        {unplaced.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            {placed.length === 0
              ? "Nothing to place yet. Buy furniture in the Shop with the Bridgeys you have earned."
              : "Everything you own is placed. Click a piece in the room to pick it up again."}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {unplaced.map((id) => {
              const item = getFurnitureItem(id);
              if (!item) return null;
              const active = placingItemId === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setPlacingItemId(active ? null : id); setCursorPos(null); }}
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
