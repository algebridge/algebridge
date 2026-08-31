"use client";

import Image from "next/image";
import { getFurnitureImageSrc, getFurnitureItem } from "@/data/house-catalog";

interface CartoonFurnitureArtProps {
  itemId: string;
  className?: string;
  size?: number;
  /** room = bare transparent PNG. shop = neutral tile behind it. */
  variant?: "room" | "shop";
}

/** Transparent PNG furniture sprites, no white backgrounds. */
export function CartoonFurnitureArt({
  itemId,
  className = "",
  size = 80,
  variant = "room",
}: CartoonFurnitureArtProps) {
  const item = getFurnitureItem(itemId);
  if (!item) return null;

  const img = (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={getFurnitureImageSrc(itemId)}
        alt={item.name}
        fill
        className="object-contain drop-shadow-md"
        sizes={`${size}px`}
      />
    </div>
  );

  if (variant === "room") {
    return (
      <div className={className} style={{ width: size, height: size }}>
        {img}
      </div>
    );
  }

  // The tile is deliberately neutral. Rarity is carried by the dot-and-label
  // in the card's meta row, so putting a coloured ring here as well would say
  // the same thing twice and read as a focus state on the wrong element.
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-slate-50 p-2 ring-1 ring-inset ring-slate-200 ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {img}
    </div>
  );
}
