"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Draw on the screen while solving. Press Draw and the whole page becomes
 * paper: scribble the working next to the problem with a finger, a pen or
 * the mouse, then press Done and the marks stay where they are while you
 * type the answer. Marks clear when the problem changes.
 *
 * The canvas covers the viewport but only takes the pointer while drawing,
 * so nothing underneath is ever blocked for long.
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

export function Scratchpad({
  resetKey,
  compact = false,
  className = "",
}: {
  /** Marks are cleared whenever this changes, e.g. the problem's id. */
  resetKey: string;
  /** An icon-only trigger, for a crowded toolbar. */
  compact?: boolean;
  className?: string;
}) {
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("ink");
  const [hasMarks, setHasMarks] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);

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

  // The canvas is the viewport, at device resolution.
  useEffect(() => {
    if (!drawing && !hasMarks) return;
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
  }, [drawing, hasMarks, paint]);

  // A new problem is clean paper.
  useEffect(() => {
    strokes.current = [];
    live.current = null;
    setHasMarks(false);
    setDrawing(false);
  }, [resetKey]);

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
  function clear() {
    strokes.current = [];
    live.current = null;
    setHasMarks(false);
    paint();
  }

  const active = drawing || hasMarks;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawing((d) => !d)}
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

      {active && (
        <>
          <canvas
            ref={canvas}
            aria-hidden
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className={`fixed inset-0 z-[700] ${drawing ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
          />
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
              <button type="button" onClick={() => setDrawing(false)} className="btn-primary h-9 px-3 py-0 text-xs">
                Done
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
