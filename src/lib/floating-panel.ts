/**
 * The calculator and the study helper float over the page, each positioned by
 * a translate from its resting corner. These keep either one fully on screen,
 * measured from where it really is rather than from assumed sizes and gaps:
 * both used to assume a 24px gap under panels that sit 96px up, so a panel
 * could be dragged half off the top, and a phone held sideways opened one
 * with its display off-screen.
 */

export interface Offset {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How close to the edge of the window a panel may go. */
export const EDGE = 8;

/** Moves one axis back inside [EDGE, total - EDGE]; a panel too big to fit keeps its start edge visible. */
function fitAxis(start: number, size: number, total: number): number {
  if (size > total - 2 * EDGE || start < EDGE) return EDGE - start;
  if (start + size > total - EDGE) return total - EDGE - (start + size);
  return 0;
}

/**
 * The offset nearest to `want` that keeps the panel on screen. `box` is the
 * panel as measured while `applied` was its offset.
 */
export function keepOnScreen(box: Box | null | undefined, applied: Offset, want: Offset): Offset {
  if (!box || typeof window === "undefined") return want;
  const left = box.left + (want.x - applied.x);
  const top = box.top + (want.y - applied.y);
  return {
    x: want.x + fitAxis(left, box.width, window.innerWidth),
    y: want.y + fitAxis(top, box.height, window.innerHeight),
  };
}

export function readOffset(key: string): Offset | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as Offset | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch {
    /* a blocked or corrupt store just means it opens in the corner */
  }
  return null;
}

export function saveOffset(key: string, offset: Offset): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(offset));
  } catch {
    /* not remembering where it was put is not worth an error */
  }
}
