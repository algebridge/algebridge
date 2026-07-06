"use client";

import Image from "next/image";
import { getFurnitureImageSrc, getFurnitureItem, RARITY_STYLES } from "@/data/house-catalog";

interface CartoonFurnitureArtProps {
  itemId: string;
  className?: string;
  size?: number;
  /** room = bare transparent PNG. shop = styled card frame behind it. */
  variant?: "room" | "shop";
}

/** Transparent PNG furniture sprites — no white backgrounds. */
export function CartoonFurnitureArt({
  itemId,
  className = "",
  size = 80,
  variant = "room",
}: CartoonFurnitureArtProps) {
  const item = getFurnitureItem(itemId);
  if (!item) return null;

  const img = (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <Image
        src={getFurnitureImageSrc(itemId)}
        alt={item.name}
        fill
        className="object-contain drop-shadow-md"
        sizes={`${size}px`}
      />
    </div>
  );

  if (variant === "room") return img;

  const style = RARITY_STYLES[item.rarity];
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100/80 to-slate-200/60 p-2 ring-2 ${style.ring}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {img}
    </div>
  );
}
