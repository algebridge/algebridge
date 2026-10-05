"use client";

import { TitleEmblem } from "@/components/TitleEmblem";
import { hueVars, topicHue } from "@/lib/hues";
import { resolveTitle, TIER_LABEL, tierOf } from "@/lib/titles";
import type { DisplayTitle } from "@/types";

export type PlateSize = "xs" | "sm" | "md" | "lg";

const EMBLEM_PX: Record<PlateSize, number> = { xs: 12, sm: 14, md: 17, lg: 21 };

/**
 * A title as it is worn next to a name: its emblem and its name on a plate
 * its tier earns (see src/lib/titles.ts and the .tp classes in globals.css).
 * `shine` runs the sweep of light once, for the moment a title goes on.
 */
export function TitlePlate({ title, size = "sm", shine = false, className = "" }: { title: DisplayTitle; size?: PlateSize; shine?: boolean; className?: string }) {
  const tier = tierOf(title);
  const tinted = tier === "common" || tier === "rare";
  return (
    <span
      className={`tp tp-${tier} tp-${size} ${shine ? "tp-shine" : ""} ${className}`}
      style={tinted ? hueVars(topicHue(title.id)) : undefined}
      title={`${TIER_LABEL[tier]} title. ${title.description}`}
    >
      <TitleEmblem id={title.id} size={EMBLEM_PX[size]} className="tp-emblem" />
      <span className="tp-name">{title.name}</span>
    </span>
  );
}

/**
 * A plate from a saved label (an equipped title id, a leaderboard row's
 * text, or an old "<emoji> Name" label). Shows `fallback` when the label
 * names no title.
 */
export function StoredTitlePlate({ stored, size = "sm", fallback = null, className = "" }: { stored: string | null | undefined; size?: PlateSize; fallback?: React.ReactNode; className?: string }) {
  const title = resolveTitle(stored);
  return title ? <TitlePlate title={title} size={size} className={className} /> : <>{fallback}</>;
}
