"use client";

import { useEffect, useRef, useState } from "react";
import { ORNAMENT_PICTURES, PICTURES_VERSION, PIECE_PICTURES } from "@/data/house-pictures";
import type { LiveData } from "@/lib/house3d/types";

/**
 * A piece of furniture as a picture.
 *
 * Usually it is a picture rendered ahead of time (scripts/house-pictures.mjs,
 * public/house/pictures): the shop and the tray show plain images and the
 * page does no 3D work at all. It is drawn live (lib/house3d/studio.ts), on a
 * quiet moment, only when that picture would be wrong: a color picked for
 * it, a lamp switched off, or `live`, the student's own numbers (the card of
 * the piece they tapped, showing their books and their clock).
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
  /** The student's own numbers, drawn live (the shelf with their books, the clock with their goal). */
  live?: LiveData;
}) {
  const ready = !color && on && !live && (ornament ? ORNAMENT_PICTURES : PIECE_PICTURES).has(itemId);
  const [url, setUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const drawLive = !ready || fallback;

  useEffect(() => {
    if (!drawLive) return;
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
  }, [drawLive, itemId, color, on, ornament, live]);

  const src = drawLive ? url : `/house/pictures/${ornament ? "ornament-" : ""}${itemId}.webp?v=${PICTURES_VERSION}`;
  return (
    <span ref={holder} className={`relative block ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-contain" draggable={false} onError={() => !drawLive && setFallback(true)} />
      ) : (
        <span aria-hidden className="absolute inset-[18%] animate-pulse rounded-full bg-slate-200/60" />
      )}
    </span>
  );
}
