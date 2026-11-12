"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { applyTextOp, mathShortcuts, MATH_KEYS, MAX_TEXT, type WbText, type WbTextOp } from "@/lib/wb-text";

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
  /** A text box op from the other side (already checked with parseTextOp). */
  applyText: (op: WbTextOp) => void;
}

interface WhiteboardProps {
  onSegment: (seg: WbSegment) => void;
  onClear: () => void;
  /** Optional: the demo board has no one to send to. */
  onText?: (op: WbTextOp) => void;
}

const COLORS = ["#0f172a", "#2563eb", "#dc2626", "#16a34a", "#d97706"];
/** Said instead of the hex code. */
const COLOR_NAMES: Record<string, string> = { "#0f172a": "black", "#2563eb": "blue", "#dc2626": "red", "#16a34a": "green", "#d97706": "orange" };

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(
  function Whiteboard({ onSegment, onClear, onText }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [width, setWidth] = useState(3);
    /** Pen draws; Text puts a text box where you click. */
    const [tool, setTool] = useState<"pen" | "text">("pen");
    const [boxes, setBoxes] = useState<WbText[]>([]);
    const [focusId, setFocusId] = useState<string | null>(null);
    const areaRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

    // A new box takes the focus once it is on the page.
    useEffect(() => {
      if (focusId) document.getElementById(`wb-text-${focusId}`)?.focus();
    }, [focusId]);

    /** A change made here: shown at once and sent to the other side. */
    function localText(op: WbTextOp) {
      setBoxes((b) => applyTextOp(b, op));
      onText?.(op);
    }
    function setBox(box: WbText) {
      localText({ op: "set", box });
    }

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
        setBoxes([]);
      },
      applyText: (op) => setBoxes((b) => applyTextOp(b, op)),
    }));

    // Keep the canvas backing store sized to its display box (crisp lines).
    // A ResizeObserver also fires when the canvas goes from hidden (0x0, e.g.
    // while the Notebook tab is showing) back to visible, so switching tabs
    // never leaves the board blank.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        // Skip while hidden (0x0) so we never wipe the drawing, and skip
        // no-op resizes so we don't snapshot/redraw on every observer tick.
        if (w === 0 || h === 0) return;
        if (canvas.width === w && canvas.height === h) return;
        // Preserve the drawing across the resize by snapshotting first.
        const snapshot = canvas.toDataURL();
        canvas.width = w;
        canvas.height = h;
        const img = new Image();
        img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        img.src = snapshot;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      window.addEventListener("resize", resize);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", resize);
      };
    }, []);

    function pos(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }

    function down(e: React.PointerEvent<HTMLCanvasElement>) {
      if (tool === "text") {
        // Keep the click from moving focus to the page, which would blur the
        // new box and, empty, remove it.
        e.preventDefault();
        const p = pos(e);
        const box: WbText = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, x: p.x, y: p.y, text: "", color };
        setBox(box);
        setFocusId(box.id);
        return;
      }
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
      setBoxes([]);
      onClear();
    }

    /** A math key goes into the box being edited, at its caret. */
    function insertKey(ch: string) {
      const box = boxes.find((b) => b.id === focusId);
      const el = box ? document.getElementById(`wb-text-${box.id}`) as HTMLTextAreaElement | null : null;
      if (!box || !el) return;
      const start = el.selectionStart ?? box.text.length;
      const end = el.selectionEnd ?? start;
      const text = (box.text.slice(0, start) + ch + box.text.slice(end)).slice(0, MAX_TEXT);
      setBox({ ...box, text });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + ch.length, start + ch.length);
      });
    }

    // Moving a box: drag its handle; the box follows the pointer over the board.
    function dragStart(e: React.PointerEvent, box: WbText) {
      const area = areaRef.current?.getBoundingClientRect();
      if (!area) return;
      dragRef.current = { id: box.id, dx: (e.clientX - area.left) / area.width - box.x, dy: (e.clientY - area.top) / area.height - box.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
    function dragMove(e: React.PointerEvent, box: WbText) {
      const d = dragRef.current;
      const area = areaRef.current?.getBoundingClientRect();
      if (!d || d.id !== box.id || !area) return;
      const x = Math.min(0.97, Math.max(0, (e.clientX - area.left) / area.width - d.dx));
      const y = Math.min(0.97, Math.max(0, (e.clientY - area.top) / area.height - d.dy));
      setBox({ ...box, x, y });
    }

    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Pen color ${COLOR_NAMES[c] ?? c}`}
              aria-pressed={color === c}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border-2 ${
                color === c ? "border-slate-900 ring-2 ring-offset-1 ring-slate-300" : "border-white"
              }`}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => setTool((t) => (t === "text" ? "pen" : "text"))}
            aria-pressed={tool === "text"}
            title="Text: click the board to add a text box"
            className={`h-7 rounded-lg px-2.5 text-xs font-semibold ${tool === "text" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            T Text
          </button>
          {tool === "text" &&
            MATH_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insertKey(k)}
                aria-label={`Insert ${k}`}
                className="h-7 min-w-7 rounded-lg bg-slate-100 px-1.5 text-sm text-slate-700 hover:bg-slate-200"
              >
                {k}
              </button>
            ))}
          {tool === "pen" && [2, 4, 8].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              aria-label={`Pen width ${w}`}
              aria-pressed={width === w}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                width === w ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600"
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
        <div ref={areaRef} className="relative flex flex-1 flex-col">
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className={`w-full flex-1 touch-none rounded-xl border border-slate-300 bg-surface ${tool === "text" ? "cursor-text" : ""}`}
            style={{ minHeight: 320 }}
          />
          {boxes.map((box) => (
            <div
              key={box.id}
              className="group absolute flex max-w-[60%] items-start rounded-md border border-transparent bg-surface/80 focus-within:border-bridge-400 hover:border-slate-300"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%` }}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label="Move text box"
                title="Drag to move"
                onPointerDown={(e) => dragStart(e, box)}
                onPointerMove={(e) => dragMove(e, box)}
                onPointerUp={() => (dragRef.current = null)}
                className="cursor-move touch-none select-none px-1 py-1 text-xs leading-none text-slate-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                ⠿
              </span>
              <textarea
                id={`wb-text-${box.id}`}
                value={box.text}
                onFocus={() => setFocusId(box.id)}
                onChange={(e) => setBox({ ...box, text: mathShortcuts(e.target.value).slice(0, MAX_TEXT) })}
                onBlur={() => {
                  if (!box.text.trim()) localText({ op: "del", id: box.id });
                }}
                rows={Math.max(1, box.text.split("\n").length)}
                placeholder="Type here"
                aria-label="Text box"
                style={{ color: box.color, width: `${Math.max(6, Math.min(40, Math.max(...box.text.split("\n").map((l) => l.length)) + 2))}ch` }}
                className="resize-none bg-transparent px-1 py-0.5 text-base font-medium leading-snug outline-none"
              />
              <button
                type="button"
                onClick={() => localText({ op: "del", id: box.id })}
                aria-label="Delete text box"
                className="px-1 text-sm leading-none text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
