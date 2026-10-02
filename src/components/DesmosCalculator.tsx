"use client";

import { useEffect, useRef, useState } from "react";
import {
  DESMOS_MODES,
  GRAPHING_OPTIONS,
  loadDesmos,
  readDesmosState,
  saveDesmosState,
  SCIENTIFIC_OPTIONS,
  type DesmosCalculatorInstance,
  type DesmosMode,
} from "@/lib/desmos";

type Status = "loading" | "ready" | "error";

const titleOf = (mode: DesmosMode) => DESMOS_MODES.find((m) => m.id === mode)?.title ?? "Desmos calculator";

/**
 * Desmos inside the calculator panel, through the official API only (never a
 * frame: see lib/desmos.ts). Fills its parent, which must be positioned.
 * `open` is whether the panel is showing: the calculator is built on open and
 * destroyed on close, with the work saved first and put back next time.
 */
export function DesmosCalculator({
  apiKey,
  mode,
  open,
  onUseKeypad,
}: {
  apiKey: string;
  mode: DesmosMode;
  open: boolean;
  /** When Desmos will not load, the student can switch to the AlgeBridge keypad. */
  onUseKeypad?: () => void;
}) {
  return open ? <ApiCalculator key={mode} apiKey={apiKey} mode={mode} onUseKeypad={onUseKeypad} /> : null;
}

function Loading({ mode }: { mode: DesmosMode }) {
  return (
    <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-bridge-600 motion-reduce:animate-none"
      />
      <p className="text-sm text-slate-500">
        Loading the {mode === "graphing" ? "graphing" : "scientific"} calculator
      </p>
    </div>
  );
}

function LoadFailed({ onRetry, onUseKeypad }: { onRetry: () => void; onUseKeypad?: () => void }) {
  return (
    <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <p className="text-sm font-semibold text-slate-800">The calculator did not load</p>
      <p className="text-sm leading-relaxed text-slate-500">
        It comes from Desmos, so it needs the internet. Check your connection, then try again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm">
          Try again
        </button>
        {onUseKeypad && (
          <button type="button" onClick={onUseKeypad} className="btn-ghost btn-sm">
            Use the AlgeBridge calculator
          </button>
        )}
      </div>
    </div>
  );
}

function ApiCalculator({
  apiKey,
  mode,
  onUseKeypad,
}: {
  apiKey: string;
  mode: DesmosMode;
  onUseKeypad?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculatorInstance | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let live = true;
    let calc: DesmosCalculatorInstance | null = null;
    let saveTimer: number | undefined;
    const save = () => {
      if (!calc) return;
      try {
        saveDesmosState(mode, calc.getState());
      } catch {
        /* the work is still on screen; it just is not remembered */
      }
    };
    setStatus("loading");
    loadDesmos(apiKey).then(
      (Desmos) => {
        const host = hostRef.current;
        if (!live || !host) return;
        try {
          calc =
            mode === "graphing"
              ? Desmos.GraphingCalculator(host, GRAPHING_OPTIONS)
              : Desmos.ScientificCalculator(host, SCIENTIFIC_OPTIONS);
        } catch {
          setStatus("error");
          return;
        }
        calcRef.current = calc;
        const saved = readDesmosState(mode);
        if (saved) {
          try {
            calc.setState(saved);
          } catch {
            /* a state from an older Desmos that will not load starts blank */
          }
        }
        // Saved a moment after each change, so typing is not slowed down.
        calc.observeEvent("change", () => {
          window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(save, 400);
        });
        setStatus("ready");
      },
      () => {
        if (live) setStatus("error");
      }
    );
    return () => {
      live = false;
      window.clearTimeout(saveTimer);
      if (calc) {
        save();
        calc.unobserveEvent("change");
        calc.destroy();
      }
      calcRef.current = null;
    };
  }, [apiKey, mode, attempt]);

  // The panel can be resized and expanded; Desmos is told so it redraws to fit.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => calcRef.current?.resize());
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} role="region" aria-label={titleOf(mode)} className="absolute inset-0" />
      {status === "loading" && <Loading mode={mode} />}
      {status === "error" && <LoadFailed onRetry={() => setAttempt((a) => a + 1)} onUseKeypad={onUseKeypad} />}
    </div>
  );
}
