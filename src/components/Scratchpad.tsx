"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Draw on the screen while solving.
 *
 * One drawing layer for the whole app, mounted at the root so it sits over
 * everything and answers to nothing else's layout. Any page with a problem
 * on it (a lesson, the rink, the check) registers itself, which puts a pen
 * button in the corner; the problem cards carry a Draw button too, and all
 * of them drive this one layer. Press Draw and the screen is paper: scribble
 * next to the problem with a finger, a pen or the mouse, press Done and the
 * marks stay while you type the answer. A new problem, or a new page, is
 * clean paper.
 */

type Tool = "ink" | "blue" | "rose" | "eraser";

const TOOLS: { id: Tool; color: string; label: string }[] = [
  { id: "ink", color: "#1e293b", label: "Black pen" },
  { id: "blue", color: "#2563eb", label: "Blue pen" },
  { id: "rose", color: "#e11d48", label: "Red pen" },
  { id: "eraser", color: "", label: "Eraser" },
];

interface Stroke {
  tool: Tool;
  points: { x: number; y: number }[];
}

interface ScratchpadApi {
  drawing: boolean;
  hasMarks: boolean;
  toggle: () => void;
  stop: () => void;
  clear: () => void;
  /** A page with a problem on it says so, which shows the corner button. */
  register: () => () => void;
}

const Ctx = createContext<ScratchpadApi | null>(null);

export function useScratchpad(): ScratchpadApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useScratchpad needs ScratchpadProvider");
  return api;
}

/**
 * For a component that shows problems: puts the pen button in the corner
 * while it is mounted, and clears the paper whenever `key` changes.
 */
export function useScratchpadSurface(key: string) {
  const { register, clear } = useScratchpad();
  useEffect(() => register(), [register]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clear();
  }, [key, clear]);
}

export function ScratchpadProvider({ children }: { children: React.ReactNode }) {
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("ink");
  const [hasMarks, setHasMarks] = useState(false);
  const [surfaces, setSurfaces] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const pathname = usePathname();

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of [...strokes.current, ...(live.current ? [live.current] : [])]) {
      if (s.points.length === 0) continue;
      ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = TOOLS.find((t) => t.id === s.tool)?.color || "#000";
      ctx.lineWidth = s.tool === "eraser" ? 28 : 3.5;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const clear = useCallback(() => {
    strokes.current = [];
    live.current = null;
    setHasMarks(false);
    setDrawing(false);
    paint();
  }, [paint]);

  const stop = useCallback(() => setDrawing(false), []);
  const toggle = useCallback(() => setDrawing((d) => !d), []);
  const register = useCallback(() => {
    setSurfaces((n) => n + 1);
    return () => setSurfaces((n) => Math.max(0, n - 1));
  }, []);

  // A new page is clean paper.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    clear();
  }, [pathname, clear]);

  // The canvas is the viewport, at device resolution.
  const active = drawing || hasMarks;
  useEffect(() => {
    if (!active) return;
    const size = () => {
      const c = canvas.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      paint();
    };
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, [active, paint]);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDrawing(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [drawing]);

  const point = (e: React.PointerEvent) => ({ x: e.clientX, y: e.clientY });

  function down(e: React.PointerEvent) {
    if (!drawing) return;
    e.preventDefault();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* a pointer the browser will not capture still draws */
    }
    live.current = { tool, points: [point(e)] };
    paint();
  }
  function move(e: React.PointerEvent) {
    if (!live.current) return;
    live.current.points.push(point(e));
    paint();
  }
  function up() {
    if (!live.current) return;
    strokes.current.push(live.current);
    live.current = null;
    setHasMarks(true);
    paint();
  }

  const api = useMemo<ScratchpadApi>(
    () => ({ drawing, hasMarks, toggle, stop, clear, register }),
    [drawing, hasMarks, toggle, stop, clear, register]
  );

  return (
    <Ctx.Provider value={api}>
      {children}

      {/* The corner pen, on any page with a problem on it. */}
      {surfaces > 0 && !drawing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Draw on the screen"
          title="Draw on the screen"
          className={`fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-bridge-500 focus:ring-offset-2 ${
            hasMarks ? "bg-bridge-600 text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200"
          }`}
        >
          <Icon name="pen" size={22} />
        </button>
      )}

      {active && (
        <canvas
          ref={canvas}
          aria-hidden
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={`fixed inset-0 z-[700] ${drawing ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
        />
      )}
      {drawing && (
        <div
          role="toolbar"
          aria-label="Drawing tools"
          className="fixed left-1/2 top-3 z-[710] flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm"
        >
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              aria-pressed={tool === t.id}
              aria-label={t.label}
              title={t.label}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                tool === t.id ? "ring-2 ring-bridge-500 ring-offset-1" : "hover:bg-slate-100"
              }`}
            >
              {t.id === "eraser" ? (
                <Icon name="eraser" size={18} className="text-slate-600" />
              ) : (
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: t.color }} />
              )}
            </button>
          ))}
          <span aria-hidden className="mx-0.5 h-6 w-px bg-slate-200" />
          <button type="button" onClick={clear} className="btn-ghost h-9 px-2.5 text-xs">
            Clear
          </button>
          <button type="button" onClick={stop} className="btn-primary h-9 px-3 py-0 text-xs">
            Done
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** A Draw button for a problem card. */
export function ScratchpadButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { drawing, toggle } = useScratchpad();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={drawing}
      title={drawing ? "Stop drawing" : "Draw on the screen"}
      aria-label={drawing ? "Stop drawing" : "Draw on the screen"}
      className={
        compact
          ? `flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 ${
              drawing ? "bg-bridge-50 text-bridge-700" : "text-slate-400 hover:text-slate-600"
            } ${className}`
          : `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              drawing ? "border-bridge-300 bg-bridge-50 text-bridge-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            } ${className}`
      }
    >
      <Icon name="pen" size={compact ? 19 : 15} />
      {!compact && (drawing ? "Drawing" : "Draw")}
    </button>
  );
}
