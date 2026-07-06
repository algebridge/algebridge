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

const PLAYER_SIZE = 52;
const MOVE_SPEED = 5;
const WALL_PAD = 8;

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
    function tick() {
      const keys = keysRef.current;
      if (keys.size > 0) {
        setWalking(true);
        setPlayer((p) => {
          let { x, y } = p;
          const step = MOVE_SPEED * 0.14;
          if (keys.has("ArrowUp")) { y -= step; setFacing("up"); }
          if (keys.has("ArrowDown")) { y += step; setFacing("down"); }
          if (keys.has("ArrowLeft")) { x -= step; setFacing("left"); }
          if (keys.has("ArrowRight")) { x += step; setFacing("right"); }
          x = Math.max(WALL_PAD, Math.min(100 - WALL_PAD, x));
          y = Math.max(WALL_PAD + 8, Math.min(100 - WALL_PAD, y));
          return { x, y };
        });
      } else {
        setWalking(false);
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
    <div className="space-y-3">
      <GameHud
        houseStyleId={progress.houseStyleId}
        bridgeys={progress.bridgeys}
        onExit={onExit}
        mode="inside"
        hint="⬆️⬇️⬅️➡️ walk · click inventory item · click floor to place · click furniture to pick up"
      />

      <div
        ref={roomRef}
        role="application"
        aria-label="House interior"
        tabIndex={0}
        onClick={handleRoomClick}
        onMouseMove={handleMouseMove}
        className={`game-room relative mx-auto w-full overflow-hidden rounded-2xl border-4 border-slate-900 shadow-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 ${
          placingItemId ? "cursor-crosshair ring-2 ring-amber-400" : "cursor-default"
        }`}
        style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}`, maxWidth: ROOM_WIDTH }}
      >
        <CartoonRoomBackground houseId={house.id} className="absolute inset-0 h-full w-full" />

        {placingItemId && (
          <div className="pointer-events-none absolute inset-0 bg-amber-300/10" />
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

        <div
          className={`absolute pointer-events-none -translate-x-1/2 -translate-y-full ${walking ? "animate-gentle-bounce" : ""}`}
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            width: PLAYER_SIZE * scale,
            height: PLAYER_SIZE * scale,
            zIndex: Math.round(player.y) + 100,
            transform: `translate(-50%, -100%) scaleX(${facing === "left" ? -1 : 1})`,
          }}
        >
          <Image
            src="/house/player.png"
            alt="You"
            fill
            className="object-contain drop-shadow-lg"
            sizes={`${PLAYER_SIZE}px`}
          />
        </div>
      </div>

      {/* Game hotbar */}
      <div className="game-hotbar rounded-2xl border-2 border-slate-800 bg-gradient-to-b from-slate-800 to-slate-900 p-3 shadow-lg">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-amber-400">
          🎒 Inventory {placingItemId ? "— click the floor!" : ""}
        </p>
        {unplaced.length === 0 && placed.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            Empty! Hit the Shop tab to buy furniture with Bridgeys.
          </p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {unplaced.map((id) => {
              const item = getFurnitureItem(id);
              if (!item) return null;
              const active = placingItemId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setPlacingItemId(active ? null : id); setCursorPos(null); }}
                  className={`flex flex-col items-center rounded-xl border-2 p-1.5 transition ${
                    active
                      ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400 scale-105"
                      : "border-slate-600 bg-slate-700/50 hover:border-amber-500/50 hover:bg-slate-700"
                  }`}
                >
                  <CartoonFurnitureArt itemId={id} size={48} variant="room" />
                  <span className="mt-0.5 max-w-[64px] truncate text-[9px] font-medium text-slate-300">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
