"use client";

import { useEffect, useRef, useState } from "react";
import { PICTURES_VERSION, ROOM_PICTURES } from "@/data/house-pictures";

/**
 * A house style's room as a picture: rendered ahead of time
 * (scripts/house-pictures.mjs), or drawn live for a style without one yet.
 */
export function RoomShot({ styleId, alt, className = "" }: { styleId: string; alt: string; className?: string }) {
  const ready = ROOM_PICTURES.has(styleId);
  const [url, setUrl] = useState<string | null>(null);
  const holder = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const { roomShot } = await import("@/lib/house3d/studio");
        const shot = await roomShot(styleId);
        if (!cancelled) setUrl(shot);
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [styleId, ready]);
  const src = ready ? `/house/pictures/room-${styleId}.webp?v=${PICTURES_VERSION}` : url;
  return (
    <span ref={holder} className={`relative block ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden className="absolute inset-0 animate-pulse bg-slate-100" />
      )}
    </span>
  );
}
