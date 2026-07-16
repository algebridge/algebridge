"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/** A drawn line segment in NORMALIZED (0..1) coordinates so it maps across
 *  differently-sized canvases on each participant's screen. */
export interface WbSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

export interface WhiteboardHandle {
  applySegment: (seg: WbSegment) => void;
  applyClear: () => void;
}

interface WhiteboardProps {
  onSegment: (seg: WbSegment) => void;
  onClear: () => void;
}

const COLORS = ["#0f172a", "#2563eb", "#dc2626", "#16a34a", "#d97706"];

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(
  function Whiteboard({ onSegment, onClear }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [width, setWidth] = useState(3);

    // Draw a segment given normalized coords.
    function paint(seg: WbSegment) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(seg.x0 * canvas.width, seg.y0 * canvas.height);
      ctx.lineTo(seg.x1 * canvas.width, seg.y1 * canvas.height);
      ctx.stroke();
    }

    useImperativeHandle(ref, () => ({
      applySegment: (seg) => paint(seg),
      applyClear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    // Keep the canvas backing store sized to its display box (crisp lines).
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        // Preserve drawing across resize by snapshotting.
        const snapshot = canvas.toDataURL();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const img = new Image();
        img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = snapshot;
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    function pos(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }

    function down(e: React.PointerEvent<HTMLCanvasElement>) {
      drawing.current = true;
      last.current = pos(e);
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || !last.current) return;
      const p = pos(e);
      const seg: WbSegment = {
        x0: last.current.x,
        y0: last.current.y,
        x1: p.x,
        y1: p.y,
        color,
        width,
      };
      paint(seg);
      onSegment(seg);
      last.current = p;
    }
    function up() {
      drawing.current = false;
      last.current = null;
    }

    function clearAll() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      onClear();
    }

    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Pen color ${c}`}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border-2 ${
                color === c ? "border-slate-900 ring-2 ring-offset-1 ring-slate-300" : "border-white"
              }`}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {[2, 4, 8].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              aria-label={`Pen width ${w}`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                width === w ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <span className="rounded-full bg-current" style={{ width: w, height: w }} />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="w-full flex-1 touch-none rounded-xl border border-slate-300 bg-white"
          style={{ minHeight: 320 }}
        />
      </div>
    );
  }
);
