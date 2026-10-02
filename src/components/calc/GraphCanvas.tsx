"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  axisFormat,
  chainSegments,
  contour,
  formatPoint,
  fromPx,
  fromPy,
  gridStep,
  gridValues,
  homeView,
  labelEvery,
  pointsOfInterest,
  region,
  sampleCurve,
  toPx,
  toPy,
  viewBounds,
  zoomAt,
  type Plot,
  type Pt,
  type View,
} from "@/lib/calc-graph";

/**
 * Graph paper on a canvas: grid, axes and their numbers, then every visible
 * row's curve, region or points in its colour.
 *
 * It draws only when something changes (a row, the view, the size, a
 * selection), never on a timer or an animation loop, so an open graph that
 * nobody touches costs nothing. Lines are drawn at the screen's real pixel
 * density, so they stay sharp on a retina display.
 *
 * Drag to move, scroll or pinch to zoom, or use the buttons. A click on a
 * curve shows a point on it with its coordinates and the curve's gray dots:
 * where it crosses the axes, turns, and meets the other curves.
 */

export interface GraphItem {
  row: number;
  plot: Plot;
  color: string;
}

/** The point being looked at, on row `row`'s curve as it was when marked (`plot`). */
type Mark = { pt: Pt; row: number | null; plot?: Plot };

type Gesture =
  | { kind: "pan"; x: number; y: number; from: View; moved: boolean }
  | { kind: "trace"; row: number }
  | { kind: "pinch"; dist: number; mid: { x: number; y: number }; from: View }
  | { kind: "none" };

const FONT = "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const HIT = { mouse: 9, touch: 18 };

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Canvas coordinates far off screen are pulled in: a canvas path with a point at 10^300 draws nothing. */
const clampPx = (p: number) => Math.max(-1e5, Math.min(1e5, p));

/** What a plot looks like in one view. */
interface Shape {
  /** Sampled curve pieces, as [t, value, ...] along x (fx) or y (fy). */
  segs?: number[][];
  /** Implicit curves: polylines in graph units. */
  lines?: number[][];
  shade?: { rects: number[]; polys: number[][] };
}

interface Drawn extends Shape {
  item: GraphItem;
}

/** The shapes worked out for each plot, and the view they are for. */
type ShapeCache = WeakMap<Plot, { view: string; shape: Shape }>;

function shapeOf(p: Plot, v: View): Shape {
  const b = viewBounds(v);
  const unit = 1 / v.scale;
  switch (p.kind) {
    case "fx":
    case "ineq-fx": {
      const spanY = b.y1 - b.y0;
      return { segs: sampleCurve(p.f, b.x0, b.x1, Math.max(200, Math.ceil(v.w)), b.y0 - spanY, b.y1 + spanY, unit) };
    }
    case "fy":
    case "ineq-fy": {
      const spanX = b.x1 - b.x0;
      return { segs: sampleCurve(p.g, b.y0, b.y1, Math.max(200, Math.ceil(v.h)), b.x0 - spanX, b.x1 + spanX, unit) };
    }
    case "implicit": {
      const nx = Math.max(20, Math.ceil(v.w / 4));
      const ny = Math.max(20, Math.ceil(v.h / 4));
      // One pass over the grid serves both the boundary and the shading.
      const vals = gridValues(p.F, b.x0, b.x1, b.y0, b.y1, nx, ny);
      const lines = chainSegments(contour(p.F, b.x0, b.x1, b.y0, b.y1, nx, ny, vals), unit * 0.01);
      const shade = p.op === "=" ? undefined : region(p.F, p.op, b.x0, b.x1, b.y0, b.y1, nx, ny, vals);
      return { lines, shade };
    }
    default:
      return {};
  }
}

/**
 * Works out what each item looks like in this view: sampled curves,
 * contours and regions. A plot already worked out for this same view is
 * taken from the cache, so a change to one row resamples only that row.
 */
function prepare(v: View, items: GraphItem[], cache: ShapeCache): Drawn[] {
  const key = `${v.cx},${v.cy},${v.scale},${v.w},${v.h}`;
  return items.map((item) => {
    const hit = cache.get(item.plot);
    if (hit && hit.view === key) return { item, ...hit.shape };
    const shape = shapeOf(item.plot, v);
    cache.set(item.plot, { view: key, shape });
    return { item, ...shape };
  });
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  v: View,
  drawn: Drawn[],
  selected: number | null,
  pois: Pt[],
  mark: Mark | null
) {
  const { w, h } = v;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Grid and axes, on whole device pixels so 1px lines stay 1px.
  const b = viewBounds(v);
  const { major, minor } = gridStep(v.scale);
  const thin = Math.max(1, Math.round(dpr));
  const crisp = (p: number, width: number) => Math.round(p * dpr) + (width % 2 ? 0.5 : 0);
  const grid = (step: number, color: string, skip: number | null) => {
    ctx.beginPath();
    for (let k = Math.ceil(b.x0 / step); k <= Math.floor(b.x1 / step); k += 1) {
      const x = k * step;
      if (skip && Math.abs(x / skip - Math.round(x / skip)) < 1e-6) continue;
      const X = crisp(toPx(v, x), thin);
      ctx.moveTo(X, 0);
      ctx.lineTo(X, H);
    }
    for (let k = Math.ceil(b.y0 / step); k <= Math.floor(b.y1 / step); k += 1) {
      const y = k * step;
      if (skip && Math.abs(y / skip - Math.round(y / skip)) < 1e-6) continue;
      const Y = crisp(toPy(v, y), thin);
      ctx.moveTo(0, Y);
      ctx.lineTo(W, Y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = thin;
    ctx.stroke();
  };
  grid(minor, "rgba(15, 23, 42, 0.06)", major);
  grid(major, "rgba(15, 23, 42, 0.17)", null);
  const ox = toPx(v, 0);
  const oy = toPy(v, 0);
  const axisW = Math.max(1, Math.round(1.4 * dpr));
  ctx.beginPath();
  if (ox >= 0 && ox <= w) {
    const X = crisp(ox, axisW);
    ctx.moveTo(X, 0);
    ctx.lineTo(X, H);
  }
  if (oy >= 0 && oy <= h) {
    const Y = crisp(oy, axisW);
    ctx.moveTo(0, Y);
    ctx.lineTo(W, Y);
  }
  ctx.strokeStyle = "rgba(15, 23, 42, 0.78)";
  ctx.lineWidth = axisW;
  ctx.stroke();

  // Numbers on the axes, pinned to an edge when the axis is off screen.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = FONT;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillStyle = "#3a3f47";
  const label = (text: string, x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  const xRow = Math.min(h - 16, Math.max(3, oy + 4));
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  // One format per axis, and only as many numbers as fit side by side.
  const kx0 = Math.ceil(b.x0 / major);
  const kx1 = Math.floor(b.x1 / major);
  const fmtX = axisFormat(kx0 * major, kx1 * major, major);
  let widest = 0;
  for (const k of [kx0, kx1, kx0 + 1, kx1 - 1]) if (k !== 0) widest = Math.max(widest, ctx.measureText(fmtX(k * major)).width);
  const every = labelEvery(major, major * v.scale, widest);
  for (let k = kx0; k <= kx1; k += 1) {
    if (k === 0 || k % every !== 0) continue;
    const px = toPx(v, k * major);
    // Whole numbers only: one that would be cut by the edge is left off.
    const text = fmtX(k * major);
    const half = ctx.measureText(text).width / 2 + 2;
    if (px - half < 0 || px + half > w) continue;
    label(text, px, xRow);
  }
  ctx.textBaseline = "middle";
  const yLeft = ox - 6 > 24;
  const yCol = yLeft ? Math.min(w - 4, ox - 6) : Math.max(4, ox + 6);
  ctx.textAlign = yLeft ? "right" : "left";
  const ky0 = Math.ceil(b.y0 / major);
  const ky1 = Math.floor(b.y1 / major);
  const fmtY = axisFormat(ky0 * major, ky1 * major, major);
  for (let k = ky0; k <= ky1; k += 1) {
    if (k === 0) continue;
    const py = toPy(v, k * major);
    if (py < 8 || py > h - 8) continue;
    label(fmtY(k * major), yCol, py);
  }
  if (ox > 8 && ox < w - 8 && oy > 4 && oy < h - 16) {
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    label("0", ox - 5, oy + 4);
  }

  const path = (seg: number[], axis: "x" | "y") => {
    for (let i = 0; i < seg.length; i += 2) {
      const X = axis === "x" ? toPx(v, seg[i]) : clampPx(toPx(v, seg[i + 1]));
      const Y = axis === "x" ? clampPx(toPy(v, seg[i + 1])) : toPy(v, seg[i]);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
  };

  // Shading first, so every curve sits on top of every region.
  for (const d of drawn) {
    const p = d.item.plot;
    ctx.fillStyle = rgba(d.item.color, 0.2);
    if ((p.kind === "ineq-fx" || p.kind === "ineq-fy") && d.segs) {
      const axis = p.kind === "ineq-fx" ? "x" : "y";
      const up = p.op === ">" || p.op === ">=";
      ctx.beginPath();
      for (const seg of d.segs) {
        path(seg, axis);
        const n = seg.length;
        if (axis === "x") {
          const edge = up ? -4 : h + 4;
          ctx.lineTo(toPx(v, seg[n - 2]), edge);
          ctx.lineTo(toPx(v, seg[0]), edge);
        } else {
          const edge = up ? w + 4 : -4;
          ctx.lineTo(edge, toPy(v, seg[n - 2]));
          ctx.lineTo(edge, toPy(v, seg[0]));
        }
        ctx.closePath();
      }
      ctx.fill();
    } else if (d.shade) {
      ctx.beginPath();
      const r = d.shade.rects;
      for (let i = 0; i < r.length; i += 4) {
        const X0 = toPx(v, r[i]);
        const X1 = toPx(v, r[i] + r[i + 2]);
        const Y0 = toPy(v, r[i + 1] + r[i + 3]);
        const Y1 = toPy(v, r[i + 1]);
        ctx.rect(X0, Y0, X1 - X0, Y1 - Y0);
      }
      for (const poly of d.shade.polys) {
        for (let i = 0; i < poly.length; i += 2) {
          if (i === 0) ctx.moveTo(toPx(v, poly[i]), toPy(v, poly[i + 1]));
          else ctx.lineTo(toPx(v, poly[i]), toPy(v, poly[i + 1]));
        }
        ctx.closePath();
      }
      ctx.fill();
    }
  }

  // Curves.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of drawn) {
    const p = d.item.plot;
    if (p.kind === "points") continue;
    const strict = (p.kind === "ineq-fx" || p.kind === "ineq-fy" || p.kind === "implicit") && (p.op === "<" || p.op === ">");
    ctx.setLineDash(strict ? [9, 7] : []);
    ctx.strokeStyle = d.item.color;
    ctx.lineWidth = d.item.row === selected ? 3.6 : 2.6;
    ctx.beginPath();
    if (d.segs) for (const seg of d.segs) path(seg, p.kind === "fx" || p.kind === "ineq-fx" ? "x" : "y");
    if (d.lines) {
      for (const line of d.lines) {
        for (let i = 0; i < line.length; i += 2) {
          if (i === 0) ctx.moveTo(toPx(v, line[i]), toPy(v, line[i + 1]));
          else ctx.lineTo(toPx(v, line[i]), toPy(v, line[i + 1]));
        }
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Points.
  for (const d of drawn) {
    const p = d.item.plot;
    if (p.kind !== "points") continue;
    ctx.fillStyle = d.item.color;
    for (const pt of p.pts) {
      const X = toPx(v, pt.x);
      const Y = toPy(v, pt.y);
      if (X < -10 || X > w + 10 || Y < -10 || Y > h + 10) continue;
      ctx.beginPath();
      ctx.arc(X, Y, d.item.row === selected ? 5.5 : 4.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gray dots for the selected curve, and the point being looked at.
  const dot = (pt: Pt, r: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(toPx(v, pt.x), toPy(v, pt.y), r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  };
  for (const pt of pois) dot(pt, 4.2, "#6b7079");
  if (mark) dot(mark.pt, 5.6, "#3d424a");
}

/** The nearest point to (px, py) on a segment, in screen pixels. */
function nearestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return { x: ax + dx * t, y: ay + dy * t };
}

export function GraphCanvas({
  items,
  selected,
  onSelect,
}: {
  items: GraphItem[];
  selected: number | null;
  onSelect: (row: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  /** null is the home view, worked out from the size. */
  const [moved, setMoved] = useState<{ cx: number; cy: number; scale: number } | null>(null);
  const [mark, setMark] = useState<Mark | null>(null);
  /** A drag or pinch is moving the view: the gray dots wait until it ends. */
  const [moving, setMoving] = useState(false);
  const gesture = useRef<Gesture>({ kind: "none" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const shapes = useRef<ShapeCache>(new WeakMap());

  const view: View | null = useMemo(() => {
    if (!size || size.w < 2 || size.h < 2) return null;
    return moved ? { ...moved, w: size.w, h: size.h } : homeView(size.w, size.h);
  }, [size, moved]);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawn = useMemo(() => (view ? prepare(view, items, shapes.current) : []), [view, items]);
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;

  // The gray dots depend on the plots, not on the item objects around them,
  // which are new on every keystroke: keyed on the plots, they are found
  // again only when a curve really changes.
  const selectedPlot = items.find((it) => it.row === selected)?.plot ?? null;
  const othersKey = useRef<{ list: Plot[] }>({ list: [] });
  const otherPlots = items.filter((it) => it.plot !== selectedPlot).map((it) => it.plot);
  if (otherPlots.length !== othersKey.current.list.length || otherPlots.some((p, i) => p !== othersKey.current.list[i])) {
    othersKey.current = { list: otherPlots };
  }
  const others = othersKey.current;
  const lastPois = useRef<Pt[]>([]);
  const pois = useMemo(() => {
    // While the view is being dragged the dots found last stay (they are in
    // graph units, so they move with the paper); they are looked for again
    // once it is let go.
    if (moving) return lastPois.current;
    if (!view || !selectedPlot) return (lastPois.current = []);
    const b = viewBounds(view);
    return (lastPois.current = pointsOfInterest(selectedPlot, others.list, b.x0, b.x1, b.y0, b.y1));
  }, [view, selectedPlot, others, moving]);

  // A mark on a row that is gone, hidden or changed goes with it.
  useEffect(() => {
    // A plot is only replaced when its row really changed (a slider moved, a
    // number was typed), so a mark on an old plot is a mark on a curve that is gone.
    setMark((m) => (m && m.row !== null && !items.some((it) => it.row === m.row && (!m.plot || it.plot === m.plot)) ? null : m));
  }, [items]);

  // Draw, once per change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(view.w * dpr);
    const H = Math.round(view.h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) drawGraph(ctx, dpr, view, drawn, selected, pois, mark);
  }, [view, drawn, selected, pois, mark]);

  const setView = useCallback((v: View) => setMoved({ cx: v.cx, cy: v.cy, scale: v.scale }), []);

  /**
   * Drags, pinches and the wheel can send several moves per frame. Each one
   * only notes the view it wants; one animation frame, asked for only while
   * moves are arriving, draws the latest. Nothing runs while the graph is
   * left alone.
   */
  const pendingView = useRef<View | null>(null);
  const frame = useRef(0);
  const queueView = useCallback(
    (v: View) => {
      pendingView.current = v;
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const next = pendingView.current;
        pendingView.current = null;
        if (next) setView(next);
      });
    },
    [setView]
  );
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  /** The view as it will be once the frame asked for has drawn. */
  const latestView = () => pendingView.current ?? viewRef.current;

  // The wheel zooms around the pointer. Not passive, so the page does not scroll too.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const v = pendingView.current ?? viewRef.current;
      if (!v) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      queueView(zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-delta * 0.0018)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [queueView]);

  /** The curve point nearest (px, py) within `tol` pixels. */
  const hitTest = useCallback(
    (px: number, py: number, tol: number): Mark | null => {
      const v = viewRef.current;
      if (!v) return null;
      let best: Mark | null = null;
      let bestD = tol;
      for (const d of drawnRef.current) {
        const p = d.item.plot;
        const consider = (pt: Pt) => {
          const dist = Math.hypot(toPx(v, pt.x) - px, toPy(v, pt.y) - py);
          if (dist <= bestD) {
            bestD = dist;
            best = { pt, row: d.item.row, plot: d.item.plot };
          }
        };
        if (p.kind === "fx" || p.kind === "ineq-fx" || p.kind === "fy" || p.kind === "ineq-fy") {
          const alongX = p.kind === "fx" || p.kind === "ineq-fx";
          const fn = alongX ? (p as { f: (t: number) => number }).f : (p as { g: (t: number) => number }).g;
          const at = (t: number): Pt => (alongX ? { x: t, y: fn(t) } : { x: fn(t), y: t });
          // Step a pixel at a time across the pointer, and catch a steep curve between steps.
          let prevOff: number | null = null;
          let prevT = 0;
          for (let o = -tol; o <= tol; o += 1) {
            const t = alongX ? fromPx(v, px + o) : fromPy(v, py + o);
            const pt = at(t);
            if (!Number.isFinite(alongX ? pt.y : pt.x)) {
              prevOff = null;
              continue;
            }
            consider(pt);
            const off = alongX ? toPy(v, pt.y) - py : toPx(v, pt.x) - px;
            if (prevOff !== null && prevOff < 0 !== off < 0 && Math.abs(prevOff - off) < 4 * v.h) {
              const tc = prevT + ((t - prevT) * prevOff) / (prevOff - off);
              const pc = at(tc);
              if (Number.isFinite(pc.x) && Number.isFinite(pc.y)) consider(pc);
            }
            prevOff = off;
            prevT = t;
          }
        } else if (d.lines) {
          for (const line of d.lines) {
            for (let i = 0; i + 3 < line.length; i += 2) {
              const q = nearestOnSegment(px, py, toPx(v, line[i]), toPy(v, line[i + 1]), toPx(v, line[i + 2]), toPy(v, line[i + 3]));
              const dist = Math.hypot(q.x - px, q.y - py);
              if (dist <= bestD) {
                bestD = dist;
                best = { pt: { x: fromPx(v, q.x), y: fromPy(v, q.y) }, row: d.item.row, plot: d.item.plot };
              }
            }
          }
        } else if (p.kind === "points") {
          p.pts.forEach(consider);
        }
      }
      return best;
    },
    []
  );

  const nearPoi = useCallback(
    (px: number, py: number, tol: number): Pt | null => {
      const v = viewRef.current;
      if (!v) return null;
      let best: Pt | null = null;
      let bestD = tol;
      for (const p of pois) {
        const dist = Math.hypot(toPx(v, p.x) - px, toPy(v, p.y) - py);
        if (dist <= bestD) {
          bestD = dist;
          best = p;
        }
      }
      return best;
    },
    [pois]
  );

  const local = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = viewRef.current;
    if (!v || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, from: latestView() ?? v };
      // The first finger may have landed on a curve and marked a point: a pinch is not a tap, so the mark goes.
      setMark(null);
      setMoving(true);
      return;
    }
    const tol = e.pointerType === "mouse" ? HIT.mouse : HIT.touch;
    const poi = nearPoi(p.x, p.y, tol + 2);
    if (poi) {
      setMark({ pt: poi, row: selected, plot: selectedPlot ?? undefined });
      gesture.current = { kind: "none" };
      return;
    }
    const hit = hitTest(p.x, p.y, tol);
    if (hit) {
      onSelect(hit.row);
      setMark(hit);
      gesture.current = { kind: "trace", row: hit.row! };
      return;
    }
    gesture.current = { kind: "pan", x: p.x, y: p.y, from: v, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    const v = viewRef.current;
    if (!v) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(g.from, g.mid.x, g.mid.y, dist / g.dist);
      queueView({ ...zoomed, cx: zoomed.cx - (mid.x - g.mid.x) / zoomed.scale, cy: zoomed.cy + (mid.y - g.mid.y) / zoomed.scale });
    } else if (g.kind === "pan") {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      if (!g.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!g.moved) setMoving(true);
      g.moved = true;
      queueView({ ...g.from, cx: g.from.cx - dx / g.from.scale, cy: g.from.cy + dy / g.from.scale });
    } else if (g.kind === "trace") {
      // Follow the curve with the pointer, snapping to a gray dot when close.
      const poi = nearPoi(p.x, p.y, 8);
      if (poi) {
        setMark({ pt: poi, row: g.row, plot: selectedPlot ?? undefined });
        return;
      }
      const d = drawnRef.current.find((it) => it.item.row === g.row);
      const plot = d?.item.plot;
      if (!plot) return;
      if (plot.kind === "fx" || plot.kind === "ineq-fx") {
        const x = fromPx(v, p.x);
        const y = plot.f(x);
        if (Number.isFinite(y)) setMark({ pt: { x, y }, row: g.row, plot });
      } else if (plot.kind === "fy" || plot.kind === "ineq-fy") {
        const y = fromPy(v, p.y);
        const x = plot.g(y);
        if (Number.isFinite(x)) setMark({ pt: { x, y }, row: g.row, plot });
      } else {
        const hit = hitTest(p.x, p.y, 40);
        if (hit && hit.row === g.row) setMark(hit);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g.kind === "pan" && !g.moved) {
      // A plain click on empty paper puts the selection away.
      setMark(null);
      onSelect(null);
    }
    if (g.kind === "pinch" && pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      const v = latestView();
      gesture.current = v ? { kind: "pan", x: rest.x, y: rest.y, from: v, moved: true } : { kind: "none" };
      return;
    }
    if (!pointers.current.size) {
      gesture.current = { kind: "none" };
      setMoving(false);
    }
  };

  const zoomBy = (factor: number) => {
    const v = latestView();
    if (v) queueView(zoomAt(v, v.w / 2, v.h / 2, factor));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = latestView();
    if (!v || e.target !== e.currentTarget) return;
    const step = Math.min(v.w, v.h) * 0.1;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (pan[e.key]) {
      e.preventDefault();
      const [dx, dy] = pan[e.key];
      queueView({ ...v, cx: v.cx + dx / v.scale, cy: v.cy - dy / v.scale });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.5);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1 / 1.5);
    } else if (e.key === "0" || e.key === "Home") {
      e.preventDefault();
      pendingView.current = null;
      setMoved(null);
    }
  };

  const markPx = view && mark ? { x: toPx(view, mark.pt.x), y: toPy(view, mark.pt.y) } : null;
  const markText = mark ? formatPoint(mark.pt) : "";
  const tool =
    "flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-[0_1px_2px_rgb(15_23_42/0.08)] transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]";

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-roledescription="graph"
      aria-label={`Graph${items.length ? ` of ${items.length} ${items.length === 1 ? "expression" : "expressions"}` : ""}. Drag or use the arrow keys to move it, plus and minus to zoom.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="absolute inset-0 touch-none select-none overflow-hidden bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2f6bd8]"
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {markPx && markPx.x > -20 && markPx.x < (view?.w ?? 0) + 20 && markPx.y > -20 && markPx.y < (view?.h ?? 0) + 20 && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[13px] font-medium tabular-nums text-slate-700 shadow-[0_1px_3px_rgb(15_23_42/0.18)] ring-1 ring-slate-200"
          style={{
            left: Math.min(Math.max(4, markPx.x + 10), (view?.w ?? 0) - 8 * markText.length - 12),
            top: Math.max(4, markPx.y - 32),
          }}
        >
          {markText}
        </div>
      )}
      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in" className={tool}>
          <Icon name="plus" size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out" title="Zoom out" className={tool}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        {moved && (
          <button
            type="button"
            onClick={() => {
              // The button goes once the view is home: the keyboard stays on the graph, not lost to the page.
              wrapRef.current?.focus({ preventScroll: true });
              pendingView.current = null;
              setMoved(null);
            }}
            aria-label="Back to the starting view"
            title="Back to the starting view"
            className={tool}
          >
            <Icon name="house" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
