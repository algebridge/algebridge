"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DEFAULT_DISPLAY, DISPLAY_EVENT, readDisplay, TEXT_SIZES, THEMES, watchDeviceTheme, writeDisplay, type DisplaySettings } from "@/lib/display";

/** The display settings saved on this device, kept current across the page. */
export function useDisplaySettings(): [DisplaySettings, (change: Partial<DisplaySettings>) => void] {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  useEffect(() => {
    setSettings(readDisplay());
    const onChange = (e: Event) => setSettings((e as CustomEvent<DisplaySettings>).detail ?? readDisplay());
    window.addEventListener(DISPLAY_EVENT, onChange);
    const unwatch = watchDeviceTheme();
    return () => {
      window.removeEventListener(DISPLAY_EVENT, onChange);
      unwatch();
    };
  }, []);
  return [settings, (change) => setSettings(writeDisplay(change))];
}

/** The letter each size button shows, growing with the size it sets. */
const SAMPLE = ["text-[15px]", "text-[19px]", "text-[23px]"];

/**
 * The controls: text size as three buttons, motion as a switch. Used inside
 * the header's Display menu, in the phone menu, and on the account page.
 */
export function DisplayControls() {
  const [settings, set] = useDisplaySettings();
  const sizeId = useId();
  const motionId = useId();
  const themeId = useId();
  const motionHintId = useId();
  const reduce = settings.motion === "reduce";
  return (
    <div className="space-y-4">
      <div>
        <p id={themeId} className="text-sm font-semibold text-slate-900">
          Theme
        </p>
        <div role="group" aria-labelledby={themeId} className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {THEMES.map((t) => {
            const on = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                title={t.hint}
                onClick={() => set({ theme: t.id })}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                  on ? "bg-surface text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name={t.id === "light" ? "sun" : t.id === "dark" ? "moon" : "monitor"} size={16} />
                <span className="text-[11px] font-semibold leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p id={sizeId} className="text-sm font-semibold text-slate-900">
          Text size
        </p>
        <div role="group" aria-labelledby={sizeId} className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {TEXT_SIZES.map((t, i) => {
            const on = settings.text === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                title={t.hint}
                onClick={() => set({ text: t.id })}
                className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                  on ? "bg-surface text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span aria-hidden className={`font-display leading-none ${SAMPLE[i]}`}>
                  A
                </span>
                <span className="mt-1 text-[11px] font-semibold leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span id={motionId} className="block text-sm font-semibold text-slate-900">
            Reduce motion
          </span>
          <span id={motionHintId} className="block text-xs text-slate-500">
            Stops animations, like your device&apos;s own setting.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reduce}
          aria-labelledby={motionId}
          aria-describedby={motionHintId}
          onClick={() => set({ motion: reduce ? "auto" : "reduce" })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 focus-visible:ring-offset-2 ${
            reduce ? "bg-bridge-600" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow transition-[left] ${
              reduce ? "left-6 text-bridge-600" : "left-1 text-transparent"
            }`}
          >
            <Icon name="check" size={12} />
          </span>
        </button>
      </div>

      <p className="text-xs text-slate-500">Saved on this device, with or without an account.</p>
    </div>
  );
}

/**
 * The header's Display button: text size and motion in a small panel. A
 * disclosure like the account menu: Escape and a click outside close it,
 * and the keyboard comes back to the button.
 */
export function DisplayMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Display: theme, text size and motion"
        title="Theme, text size and motion"
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-slate-100 ${
          open ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <Icon name="text-size" size={18} />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Display settings"
          className="animate-pop-in absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-surface p-4 shadow-raised"
        >
          <DisplayControls />
        </div>
      )}
    </div>
  );
}
