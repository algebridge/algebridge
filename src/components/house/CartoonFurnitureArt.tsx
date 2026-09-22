"use client";

import { useMemo } from "react";
import { furnitureSvg } from "@/data/furniture-art";
import { getFurnitureItem } from "@/data/house-catalog";
import { getRinkItem } from "@/data/rink-catalog";

interface CartoonFurnitureArtProps {
  itemId: string;
  className?: string;
  size?: number;
  /** room = bare art. shop = neutral tile behind it. */
  variant?: "room" | "shop";
  /** A swatch id the student painted it, if any. */
  color?: string | null;
  /** Switched off: a lamp dark, a screen blank. */
  off?: boolean;
  /** Fill the parent instead of taking a fixed size. */
  fill?: boolean;
}

/**
 * A piece of furniture (or a rink piece), drawn live.
 *
 * The art is generated SVG, so it goes straight into the page rather than
 * through a PNG: that is what lets a student repaint a piece and see the
 * shades follow, lets a lamp go dark when it is switched off, and lets the
 * parts that move (a fan, a flame, a fish) move, since CSS reaches inside an
 * inline SVG and never inside an image.
 */
export function CartoonFurnitureArt({
  itemId,
  className = "",
  size = 80,
  variant = "room",
  color = null,
  off = false,
  fill = false,
}: CartoonFurnitureArtProps) {
  const name = getFurnitureItem(itemId)?.name ?? getRinkItem(itemId)?.name;
  // The art is our own generated markup, with only a swatch id and a flag
  // from outside, both checked before they touch anything.
  const svg = useMemo(() => furnitureSvg(itemId, { color, off }), [itemId, color, off]);
  if (!name || !svg) return null;

  const img = (
    <span
      role="img"
      aria-label={name}
      className="block h-full w-full drop-shadow-md [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  if (fill) {
    return <div className={`h-full w-full ${className}`}>{img}</div>;
  }

  if (variant === "room") {
    return (
      <div className={className} style={{ width: size, height: size }}>
        {img}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-slate-50 p-2 ring-1 ring-inset ring-slate-200 ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {img}
    </div>
  );
}
