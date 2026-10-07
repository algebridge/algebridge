"use client";

import { useEffect, useRef, useState } from "react";

/** A house style's room as a picture, the real 3D room (lib/house3d/studio.ts roomShot). */
export function RoomShot({ styleId, alt, className = "" }: { styleId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const holder = useRef<HTMLSpanElement>(null);
  useEffect(() => {
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
  }, [styleId]);
  return (
    <span ref={holder} className={`relative block ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden className="absolute inset-0 animate-pulse bg-slate-100" />
      )}
    </span>
  );
}
