"use client";

import { useEffect } from "react";
import { FURNITURE_ITEMS } from "@/data/house-catalog";
import { ORNAMENTS } from "@/data/ornament-catalog";
import { DEFAULT_LIVE, type LiveData } from "@/lib/house3d/types";
import { THEMES } from "@/lib/house3d/themes";

/**
 * The catalog photographs: every piece as the shop shows it, rendered once
 * ahead of time (scripts/house-pictures.mjs saves them to public/house/),
 * so the shop and the tray show plain pictures and the page does no 3D work.
 * Pieces that show a student's progress are photographed with a sample of it
 * (a shelf with some books), the way a catalog shows a shelf.
 */
const SAMPLE: LiveData = { ...DEFAULT_LIVE, goalRight: 6, streak: 9, unitsDone: 5, skillsDone: 19, growth: 0.6, skillTitle: "Slope from two points", keyIdea: "Slope is rise over run." };

async function asDataUrl(url: string, type: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext("2d")!.drawImage(bitmap, 0, 0);
  return c.toDataURL(type, 0.9);
}

export function PictureStudio() {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__pictureIds = {
      pieces: FURNITURE_ITEMS.map((f) => f.id),
      ornaments: ORNAMENTS.map((o) => o.id),
      rooms: Object.keys(THEMES),
      porches: Object.keys(THEMES),
    };
    w.__shoot = async (kind: "piece" | "ornament" | "room" | "porch", id: string) => {
      const studio = await import("@/lib/house3d/studio");
      const url =
        kind === "porch"
          ? await studio.porchShot(id, { width: 1280, height: 800 })
          : kind === "room"
            ? await studio.roomShot(id, { width: 520, height: 320 })
            : await studio.pieceShot(id, { ornament: kind === "ornament", live: SAMPLE, width: 320, height: 240 });
      return asDataUrl(url, kind === "porch" ? "image/jpeg" : "image/webp");
    };
    w.__picturesReady = true;
  }, []);
  return <p className="p-6 text-sm text-slate-600">Picture studio ready.</p>;
}
