"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveData } from "@/lib/house3d/types";

/**
 * A piece of furniture as a picture: the same 3D model, materials and light
 * as the room, photographed on its own (lib/house3d/studio.ts). Taken when
 * the card scrolls near the screen, one at a time, and kept, so the shop and
 * the tray show exactly the thing that will stand in the room.
 */
export function PieceShot({
  itemId,
  color,
  on = true,
  alt,
  className = "",
  ornament = false,
  live,
}: {
  itemId: string;
  color?: string | null;
  on?: boolean;
  alt: string;
  className?: string;
  /** A garden ornament rather than a piece of furniture. */
  ornament?: boolean;
  /** The student's own numbers, so the shelf shows their books and the clock their goal. */
  live?: LiveData;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    const el = holder.current;
    if (!el) return;
    const take = async () => {
      const { pieceShot, cachedShot } = await import("@/lib/house3d/studio");
      const opts = { color: color ?? null, on, ornament, live };
      const have = cachedShot(itemId, opts);
      if (have) {
        if (!cancelled) setUrl(have);
        return;
      }
      const shot = await pieceShot(itemId, opts);
      if (!cancelled) setUrl(shot);
    };
    // Off screen, nothing is drawn until the card comes near.
    if (typeof IntersectionObserver === "undefined") {
      void take();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void take();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [itemId, color, on, ornament, live]);

  return (
    <span ref={holder} className={`relative block ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <span aria-hidden className="absolute inset-[18%] animate-pulse rounded-full bg-slate-200/60" />
      )}
    </span>
  );
}
