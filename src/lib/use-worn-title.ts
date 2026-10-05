"use client";

import { useEffect, useState } from "react";
import { getDisplayTitle } from "@/data/titles-catalog";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import type { DisplayTitle } from "@/types";

/** The title this browser's student is wearing, kept current as progress saves (here or in another tab). */
export function useWornTitle(): DisplayTitle | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setId(getProgress().equippedTitleId ?? null);
    read();
    window.addEventListener(PROGRESS_UPDATED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return id ? getDisplayTitle(id) ?? null : null;
}
