"use client";

/**
 * The season, in a component (lib/season.ts for the calendar and the override).
 * Kept apart from season.ts because API routes import that file and must not
 * pull in React's client hooks.
 */

import { useSyncExternalStore } from "react";
import { currentSeason, SEASON_OVERRIDE_KEY, type Season } from "@/lib/season";

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

/** Set the season for this browser (null clears the override). */
export function setSeasonOverride(value: "halloween" | "off" | null) {
  try {
    if (value) window.localStorage.setItem(SEASON_OVERRIDE_KEY, value);
    else window.localStorage.removeItem(SEASON_OVERRIDE_KEY);
  } catch {
    // ignore
  }
  const s = currentSeason();
  if (s) document.documentElement.setAttribute("data-season", s);
  else document.documentElement.removeAttribute("data-season");
  for (const fn of listeners) fn();
}

/**
 * The server (and the first client render) see no season, so the HTML
 * matches; the dressing comes in right after, and the boot script in
 * season.ts has already set the styles so nothing visibly changes.
 */
export function useSeason(): Season {
  return useSyncExternalStore(subscribe, () => currentSeason(), () => null);
}
