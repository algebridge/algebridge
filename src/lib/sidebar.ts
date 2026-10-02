/**
 * The AI sidebar's shared state: whether it is open and how wide it is, so the
 * page can make room for it and the calculator can rest beside it instead of
 * under it. Written by StudyHelper, read by the layout and the calculator.
 */

export interface SidebarState {
  /** True when the sidebar is open. */
  open: boolean;
  /** Docked width in px on wide screens; 0 when closed or shown as a bottom sheet. */
  width: number;
}

const SERVER: SidebarState = { open: false, width: 0 };
let state: SidebarState = SERVER;
const listeners = new Set<() => void>();
let openRequests = 0;

export function setSidebarState(next: SidebarState): void {
  if (next.open === state.open && next.width === state.width) return;
  state = next;
  listeners.forEach((fn) => fn());
}

export function getSidebarState(): SidebarState {
  return state;
}

export function getServerSidebarState(): SidebarState {
  return SERVER;
}

export function subscribeSidebar(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Any part of the app can ask the sidebar to open (a button, a shortcut). */
export function requestSidebarOpen(): void {
  openRequests += 1;
  listeners.forEach((fn) => fn());
}

export function getSidebarOpenRequests(): number {
  return openRequests;
}

/**
 * Practice announces each checked answer so Archie can react. Fired on window
 * as "algebridge:practice" with detail { result: "correct" | "wrong" }.
 */
export const PRACTICE_EVENT = "algebridge:practice";
export type PracticeResult = "correct" | "wrong";

export function announcePractice(result: PracticeResult): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRACTICE_EVENT, { detail: { result } }));
}

// ---------------------------------------------------------------------------
// Size and memory
// ---------------------------------------------------------------------------

/** At this width and up the sidebar docks on the right; below it, a bottom sheet. */
export const SIDEBAR_BREAKPOINT = 1024;
export const SIDEBAR_MIN = 340;
export const SIDEBAR_MAX = 520;
export const SIDEBAR_DEFAULT = 400;
/** The left nav (w-60) plus the narrowest the page column should get beside the sidebar. */
const ROOM_FOR_PAGE = 240 + 400;

export const SIDEBAR_OPEN_KEY = "algebridge-helper-open";
export const SIDEBAR_WIDTH_KEY = "algebridge-helper-width";

/**
 * A width the sidebar may have in a window this wide: 340 to 520, and never so
 * wide that the page beside it is squeezed under ROOM_FOR_PAGE (but never
 * under 340 either, so it still fits at exactly 1024).
 */
export function clampSidebarWidth(width: number, viewport: number): number {
  const most = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, viewport - ROOM_FOR_PAGE));
  const w = Number.isFinite(width) ? Math.round(width) : SIDEBAR_DEFAULT;
  return Math.max(SIDEBAR_MIN, Math.min(most, w));
}

/**
 * Runs in <head> before the page paints. When the sidebar was left open on a
 * wide screen, the page is laid out with room for it from the first frame,
 * instead of drawing full width and then sliding over once React starts.
 * Built from the same numbers as clampSidebarWidth so the two cannot drift.
 */
export function sidebarBootScript(): string {
  return `(function(){try{var d=document.documentElement,v=window.innerWidth;if(v<${SIDEBAR_BREAKPOINT}||localStorage.getItem(${JSON.stringify(
    SIDEBAR_OPEN_KEY
  )})!=="1")return;var w=parseInt(localStorage.getItem(${JSON.stringify(SIDEBAR_WIDTH_KEY)})||"",10);if(!isFinite(w))w=${SIDEBAR_DEFAULT};var m=Math.max(${SIDEBAR_MIN},Math.min(${SIDEBAR_MAX},v-${ROOM_FOR_PAGE}));w=Math.max(${SIDEBAR_MIN},Math.min(m,w));d.style.setProperty("--helper-w",w+"px");d.setAttribute("data-helper-dock","");d.setAttribute("data-helper-still","")}catch(e){}})();`;
}
