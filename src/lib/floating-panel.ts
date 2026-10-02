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
 * panel as measured while `applied` was its offset. `area` is the room it may
 * use, from the top-left corner: the whole window unless something is docked
 * on the right (the AI sidebar), in which case it is the window less that.
 */
export function keepOnScreen(
  box: Box | null | undefined,
  applied: Offset,
  want: Offset,
  area?: { width: number; height: number }
): Offset {
  if (!box || typeof window === "undefined") return want;
  const left = box.left + (want.x - applied.x);
  const top = box.top + (want.y - applied.y);
  return {
    x: want.x + fitAxis(left, box.width, area?.width ?? window.innerWidth),
    y: want.y + fitAxis(top, box.height, area?.height ?? window.innerHeight),
  };
}

export interface Size {
  width: number;
  height: number;
}

export interface SizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

/**
 * A size inside the limits. On a window smaller than the minimum the maximum
 * wins: a panel that fits the screen beats one that is comfortably big.
 */
export function clampSize(size: Size, limits: SizeLimits): Size {
  const fit = (value: number, min: number, max: number) => Math.round(Math.min(Math.max(value, min), max));
  return {
    width: fit(size.width, limits.minWidth, limits.maxWidth),
    height: fit(size.height, limits.minHeight, limits.maxHeight),
  };
}

/** Where a corner resize started: the panel as measured, and its offset then. */
export interface ResizeStart {
  size: Size;
  offset: Offset;
  rect: { left: number; top: number; right: number; bottom: number };
}

/**
 * Dragging the bottom-left corner of a panel that rests in the bottom-right
 * corner. The right edge is the anchor, so width grows to the left on its
 * own. Height grows downward, which means moving the panel's offset down by
 * the same amount, so the top edge stays put the way a window's does.
 * Never past the window's edges, never under the minimum size.
 */
export function resizeFromBottomLeft(
  start: ResizeStart,
  dx: number,
  dy: number,
  min: { width: number; height: number },
  viewport: { width: number; height: number }
): { size: Size; offset: Offset } {
  const size = clampSize(
    { width: start.size.width - dx, height: start.size.height + dy },
    {
      minWidth: min.width,
      minHeight: min.height,
      maxWidth: Math.max(0, start.rect.right - EDGE),
      maxHeight: Math.max(0, viewport.height - EDGE - start.rect.top),
    }
  );
  return { size, offset: { x: start.offset.x, y: start.offset.y + (size.height - start.size.height) } };
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
