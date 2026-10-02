import { EDGE, type Size } from "./floating-panel";

/**
 * Desmos in the calculator panel, the calculator many students already use
 * in class.
 *
 * Desmos's Terms of Service (section 5) say its tools may not be framed or
 * mirrored without their consent, so there is no iframe anywhere: Desmos runs
 * only through its official API, which needs a key.
 *
 * - With a key (NEXT_PUBLIC_DESMOS_API_KEY, or in development only the
 *   localStorage override below), Desmos's own script draws the calculator
 *   straight into our panel. Work is saved with getState and comes back when
 *   the panel opens again.
 * - With no key, the panel is AlgeBridge's own keypad calculator
 *   (lib/calculator.ts), and "Open Desmos" opens desmos.com in a small window
 *   of its own. Linking is fine; framing is not.
 *
 * Nothing here touches the network until the calculator is first opened.
 */

export type DesmosMode = "scientific" | "graphing";

/** Scientific first: it is what the panel opens on, and the one most problems need. */
export const DESMOS_MODES: { id: DesmosMode; label: string; title: string }[] = [
  { id: "scientific", label: "Scientific", title: "Desmos scientific calculator" },
  { id: "graphing", label: "Graphing", title: "Desmos graphing calculator" },
];

/**
 * What every fresh open starts on. A switch to Graphing lasts for the rest of
 * the visit (it lives in component state), never across a reload.
 */
export const DEFAULT_MODE: DesmosMode = "scientific";

export const DESMOS_ORIGIN = "https://www.desmos.com";
/** The version desmos.com/api documents today. Pinned, so a new major release cannot change the panel under us. */
export const DESMOS_API_VERSION = "v1.12";
/** Where the "Calculator by Desmos" credit points. Desmos's terms also ask that its own branding is never hidden. */
export const DESMOS_CREDIT_URL = DESMOS_ORIGIN;

/**
 * The size each calculator opens at. Graphing is wide because Desmos keeps
 * its equation list 320px wide at any panel under about 800px (measured in
 * Chrome; the API has no option to narrow it), so every extra pixel goes to
 * the graph: at 720 the graph gets about 380px, more than the list.
 */
export const DEFAULT_SIZES: Record<DesmosMode, Size> = {
  scientific: { width: 400, height: 560 },
  graphing: { width: 720, height: 600 },
};
/** The smallest the corner can drag it to. */
export const MIN_SIZE: Size = { width: 320, height: 380 };
/** Expand: this share of the space it has (the window, less an open AI sidebar). */
export const EXPANDED_SHARE = { width: 0.8, height: 0.82 };

/**
 * Saved sizes. "-v2" because the first Desmos build saved its smaller
 * defaults, which would otherwise keep a tester's panel at the old size.
 */
const SIZE_KEY = "algebridge-calculator-size-v2";
const STATE_KEY = (mode: DesmosMode) => `algebridge-desmos-state-${mode}`;
/** Development only: lets API mode be tried without restarting the dev server. */
export const DEV_KEY_STORAGE = "algebridge-desmos-dev-key";
/** A saved graph bigger than this is not worth risking the storage quota for. */
const MAX_STATE_CHARS = 200_000;

/** Desmos keys are 32 hex characters. Anything that is not letters and digits is no key and never reaches a URL. */
export function cleanApiKey(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim();
  return /^[A-Za-z0-9]{8,64}$/.test(key) ? key : null;
}

/** The API key when there is one, which turns on API mode. */
export function desmosApiKey(): string | null {
  // Written out in full so Next inlines it into the browser bundle.
  const fromEnv = cleanApiKey(process.env.NEXT_PUBLIC_DESMOS_API_KEY);
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    try {
      return cleanApiKey(window.localStorage.getItem(DEV_KEY_STORAGE));
    } catch {
      return null;
    }
  }
  return null;
}

export function desmosScriptUrl(key: string): string {
  return `${DESMOS_ORIGIN}/api/${DESMOS_API_VERSION}/calculator.js?apiKey=${encodeURIComponent(key)}`;
}

/** The desmos.com page "Open Desmos" goes to: a link, never a frame. */
export function desmosAppUrl(mode: DesmosMode): string {
  return mode === "graphing" ? `${DESMOS_ORIGIN}/calculator` : `${DESMOS_ORIGIN}/scientific`;
}

/** A small window beside the lesson, about the size of the panel. */
export const DESMOS_WINDOW_NAME = "desmos";
export const DESMOS_WINDOW_FEATURES = "width=440,height=680";

/**
 * Opens Desmos in its own small window and says whether one opened. When it
 * did not (a popup blocker), the caller lets its link open a normal new tab.
 *
 * "noopener" is left out of the features on purpose: with it, window.open
 * always returns null, so a blocked popup and an open one look the same. The
 * opener is cut by hand instead, while the new window is still on about:blank
 * and that is allowed, so desmos.com never gets a handle back to AlgeBridge.
 */
export function openDesmosWindow(mode: DesmosMode): boolean {
  if (typeof window === "undefined" || typeof window.open !== "function") return false;
  let win: Window | null = null;
  try {
    win = window.open(desmosAppUrl(mode), DESMOS_WINDOW_NAME, DESMOS_WINDOW_FEATURES);
  } catch {
    win = null;
  }
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    /* a Desmos window that was already open, cut off when it first opened */
  }
  try {
    win.focus();
  } catch {
    /* bringing it to the front is a nicety */
  }
  return true;
}

/** Sizes as saved, each one checked; anything missing or odd is the default. */
export function parseSizes(raw: string | null | undefined): Record<DesmosMode, Size> {
  let saved: unknown = null;
  try {
    saved = JSON.parse(raw ?? "null");
  } catch {
    saved = null;
  }
  const out = { ...DEFAULT_SIZES };
  if (!saved || typeof saved !== "object") return out;
  for (const mode of ["scientific", "graphing"] as DesmosMode[]) {
    const s = (saved as Record<string, Partial<Size> | undefined>)[mode];
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width! > 0 && s.height! > 0) {
      out[mode] = { width: Math.round(s.width!), height: Math.round(s.height!) };
    }
  }
  return out;
}

/**
 * A size that fits in `area` (the window, less an open AI sidebar) with the
 * usual margin. On a small window the window wins over the size asked for.
 */
export function fitSize(size: Size, area: Size): Size {
  return {
    width: Math.round(Math.max(0, Math.min(size.width, area.width - 2 * EDGE))),
    height: Math.round(Math.max(0, Math.min(size.height, area.height - 2 * EDGE))),
  };
}

/**
 * The Expand size: most of the space it has, never under the minimum unless
 * the window is smaller still. Given the usual size, it never shrinks the
 * panel: on a side where the usual size is already that big (a small window
 * beside the sidebar), Expand takes all the room there is.
 */
export function expandedSize(area: Size, usual?: Size): Size {
  const share = fitSize(
    {
      width: Math.max(Math.round(area.width * EXPANDED_SHARE.width), MIN_SIZE.width),
      height: Math.max(Math.round(area.height * EXPANDED_SHARE.height), MIN_SIZE.height),
    },
    area
  );
  if (!usual) return share;
  const now = fitSize(usual, area);
  return fitSize(
    {
      width: now.width >= share.width ? area.width : share.width,
      height: now.height >= share.height ? area.height : share.height,
    },
    area
  );
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* a blocked or full store only means it is not remembered */
  }
}

export const readCalculatorSizes = (): Record<DesmosMode, Size> => parseSizes(read(SIZE_KEY));
export const saveCalculatorSizes = (sizes: Record<DesmosMode, Size>): void => write(SIZE_KEY, JSON.stringify(sizes));

/** A student's graph or scientific history from last time (API mode). */
export function readDesmosState(mode: DesmosMode): unknown {
  try {
    return JSON.parse(read(STATE_KEY(mode)) ?? "null");
  } catch {
    return null;
  }
}

export function saveDesmosState(mode: DesmosMode, state: unknown): void {
  let text: string;
  try {
    text = JSON.stringify(state);
  } catch {
    return;
  }
  if (text && text.length <= MAX_STATE_CHARS) write(STATE_KEY(mode), text);
}

// --- The Desmos API script ---------------------------------------------------

/** What the panel uses of a Desmos calculator. */
export interface DesmosCalculatorInstance {
  resize(): void;
  destroy(): void;
  getState(): unknown;
  setState(state: unknown, options?: { allowUndo?: boolean }): void;
  observeEvent(event: "change", fn: () => void): void;
  unobserveEvent(event: "change"): void;
}

export interface DesmosApi {
  GraphingCalculator(el: HTMLElement, options?: Record<string, unknown>): DesmosCalculatorInstance;
  ScientificCalculator(el: HTMLElement, options?: Record<string, unknown>): DesmosCalculatorInstance;
}

/**
 * The graphing calculator as a student needs it in a panel: the list open,
 * the keypad and zoom buttons there, the settings wrench kept because it
 * holds the text size and reverse contrast controls (Desmos's accessibility
 * notes ask embedders to think twice before hiding it). The API has no
 * option for the list's width, so the panel's larger size gives the graph
 * its room.
 */
export const GRAPHING_OPTIONS: Record<string, unknown> = {
  expressionsCollapsed: false,
  settingsMenu: true,
  border: false,
  keypad: true,
  zoomButtons: true,
  expressionsTopbar: true,
  autosize: true,
  pasteGraphLink: false,
};

/** Degrees, as on desmos.com/scientific. */
export const SCIENTIFIC_OPTIONS: Record<string, unknown> = { border: false, degreeMode: true };

export class DesmosLoadError extends Error {
  reason: "offline" | "timeout" | "failed";
  constructor(reason: "offline" | "timeout" | "failed") {
    super(`Desmos did not load (${reason})`);
    this.reason = reason;
  }
}

let loading: Promise<DesmosApi> | null = null;

function loadedApi(): DesmosApi | null {
  const api = (window as unknown as { Desmos?: Partial<DesmosApi> }).Desmos;
  return api?.GraphingCalculator && api.ScientificCalculator ? (api as DesmosApi) : null;
}

/**
 * Loads calculator.js once. Every caller shares the one script; a failure
 * forgets it, so "Try again" really tries again.
 */
export function loadDesmos(key: string, timeoutMs = 15_000): Promise<DesmosApi> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new DesmosLoadError("failed"));
  }
  const ready = loadedApi();
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;
  if (navigator.onLine === false) return Promise.reject(new DesmosLoadError("offline"));

  loading = new Promise<DesmosApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = desmosScriptUrl(key);
    script.async = true;
    script.dataset.desmos = DESMOS_API_VERSION;
    const fail = (reason: DesmosLoadError["reason"]) => {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new DesmosLoadError(reason));
    };
    const timer = window.setTimeout(() => fail("timeout"), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      const api = loadedApi();
      if (api) resolve(api);
      else fail("failed");
    };
    script.onerror = () => fail(navigator.onLine === false ? "offline" : "failed");
    document.head.appendChild(script);
  });
  return loading;
}
