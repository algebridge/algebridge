/**
 * Display settings for this device: text size and motion. A student on a
 * school Chromebook cannot change the operating system's own settings, and
 * a teacher at a projector needs bigger text than a phone does, so both
 * live here, with or without an account, in this browser's localStorage.
 *
 * They are applied as data attributes on <html>. A script in <head>
 * (displayBootScript) sets them before the first paint, so a reload never
 * flashes the default size, and globals.css reads them:
 *   html[data-text="large"]    bumps the root font size (everything in rem grows)
 *   html[data-motion="reduce"] turns animations off, the same rules the
 *                              operating system's reduce-motion setting applies
 *   html[data-theme="dark"]    the dark theme (theme.css); "device" follows the
 *                              operating system's light or dark setting
 * Code that decides about motion itself asks prefersReducedMotion().
 */

export type TextSize = "normal" | "large" | "largest";
export type MotionPref = "auto" | "reduce";
export type ThemePref = "light" | "dark" | "device";

export interface DisplaySettings {
  text: TextSize;
  motion: MotionPref;
  theme: ThemePref;
}

export const DISPLAY_KEY = "ab-display";
/** Fired on window after a change, with the new settings as `detail`. */
export const DISPLAY_EVENT = "ab-display-changed";

export const TEXT_SIZES: { id: TextSize; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "The usual size" },
  { id: "large", label: "Large", hint: "About one size up" },
  { id: "largest", label: "Largest", hint: "For a projector or tired eyes" },
];

export const THEMES: { id: ThemePref; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Light background" },
  { id: "dark", label: "Dark", hint: "Dark background, easier at night" },
  { id: "device", label: "Device", hint: "Follow this device's setting" },
];

export const DEFAULT_DISPLAY: DisplaySettings = { text: "normal", motion: "auto", theme: "light" };
const DEFAULTS = DEFAULT_DISPLAY;

function isTheme(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "device";
}

/** Whether the dark theme is showing for this choice. */
export function isDark(theme: ThemePref): boolean {
  if (theme === "dark") return true;
  if (theme === "light" || typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function isTextSize(v: unknown): v is TextSize {
  return v === "normal" || v === "large" || v === "largest";
}

/** The settings saved on this device, or the defaults. */
export function readDisplay(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}") as Partial<DisplaySettings>;
    return {
      text: isTextSize(raw.text) ? raw.text : "normal",
      motion: raw.motion === "reduce" ? "reduce" : "auto",
      theme: isTheme(raw.theme) ? raw.theme : "light",
    };
  } catch {
    return DEFAULTS;
  }
}

/** Puts the settings on <html>, where the stylesheet reads them. */
export function applyDisplay(s: DisplaySettings): void {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  if (s.text === "normal") d.removeAttribute("data-text");
  else d.setAttribute("data-text", s.text);
  if (s.motion === "reduce") d.setAttribute("data-motion", "reduce");
  else d.removeAttribute("data-motion");
  if (isDark(s.theme)) d.setAttribute("data-theme", "dark");
  else d.removeAttribute("data-theme");
}

/** Keeps "device" in step when the operating system switches. Call once. */
export function watchDeviceTheme(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    const s = readDisplay();
    if (s.theme === "device") applyDisplay(s);
  };
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

/** Saves a change, applies it at once, and tells the page. */
export function writeDisplay(change: Partial<DisplaySettings>): DisplaySettings {
  const next = { ...readDisplay(), ...change };
  try {
    if (next.text === "normal" && next.motion === "auto" && next.theme === "light") localStorage.removeItem(DISPLAY_KEY);
    else localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the setting holds for this page view */
  }
  applyDisplay(next);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DISPLAY_EVENT, { detail: next }));
  return next;
}

/**
 * Whether motion should be kept still: the device's own setting, or the
 * one chosen here. Every piece of code that animates on its own (confetti,
 * the 3D house, the games, the tour) asks this instead of matchMedia, so
 * the in-app switch reaches all of it.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.getAttribute("data-motion") === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Inline in <head>: applies the saved settings to <html> before React runs.
 * Kept tiny and defensive; a parse error or blocked storage changes nothing.
 */
export function displayBootScript(): string {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
    DISPLAY_KEY
  )})||"{}"),d=document.documentElement;if(s.text==="large"||s.text==="largest")d.setAttribute("data-text",s.text);if(s.motion==="reduce")d.setAttribute("data-motion","reduce");if(s.theme==="dark"||(s.theme==="device"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches))d.setAttribute("data-theme","dark")}catch(e){}})();`;
}
