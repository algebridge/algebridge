/**
 * Which of the student's live numbers a piece shows. A model is built with a
 * live object that notes every field it reads, so the clock is redrawn for a
 * new minute and the shelf for a new book, and nothing else is redrawn at all.
 */

import type { LiveData } from "./types";

/** The live data, watched: `reads` fills with each field the model looks at. */
export function watchReads(live: LiveData): { live: LiveData; reads: Set<string> } {
  const reads = new Set<string>();
  const watched = new Proxy(live, {
    get(t, k, r) {
      if (typeof k === "string") reads.add(k);
      return Reflect.get(t, k, r);
    },
  });
  return { live: watched, reads };
}

/** The part of the live data a piece reads, as a key: the clock's minute, the shelf's count. */
export function liveSlice(live: LiveData, reads: Set<string>): string {
  return [...reads]
    .sort()
    .map((f) => {
      const v = (live as unknown as Record<string, unknown>)[f];
      if (v instanceof Date) return `${v.getHours()}:${v.getMinutes()}`;
      if (typeof v === "number") return v.toFixed(3);
      return String(v);
    })
    .join("/");
}
