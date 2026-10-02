/**
 * The graphing calculator's maths: which rows draw what (y = 2x + 3 is a
 * curve, a = 3 a slider, (2, 7) a point, y > x a shaded region, 2x + 3y = 6
 * a line drawn from the relation itself), and the geometry for drawing it:
 * the view, the grid, curves sampled finely enough to look smooth and broken
 * where they really break (1/x, tan x), roots, extrema and intersections for
 * the gray dots, and regions for inequalities.
 *
 * Rows are read and worked out by lib/calc-engine.ts. The canvas that draws
 * all this is components/calc/GraphCanvas.tsx, which only redraws when
 * something changes.
 */

import { CalcError, Incomplete, isLiteral, Sheet, type Fn2, type Node, type RelOp } from "./calc-engine";
import { formatResult } from "./calculator";

export type Ineq = "<" | "<=" | ">" | ">=";

export interface Pt {
  x: number;
  y: number;
}

/** What a row draws. */
export type Plot =
  /** y = f(x) */
  | { kind: "fx"; f: (x: number) => number }
  /** x = g(y), which is where vertical lines come from */
  | { kind: "fy"; g: (y: number) => number }
  /** y > f(x) and the like: shaded above or below the curve */
  | { kind: "ineq-fx"; f: (x: number) => number; op: Ineq }
  /** x > g(y): shaded right or left */
  | { kind: "ineq-fy"; g: (y: number) => number; op: Ineq }
  /** Anything else in x and y, as F(x, y) op 0: 2x + 3y = 6, x^2 + y^2 < 9 */
  | { kind: "implicit"; F: Fn2; op: RelOp }
  | { kind: "points"; pts: Pt[] };

export interface Slider {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface GraphRow {
  plot: Plot | null;
  /**
   * Everything the plot depends on: the row's text, the rows that define the
   * letters and functions it uses (and theirs), and degrees or radians. The
   * same signature means the same plot, so a slider for m leaves a row
   * without m alone.
   */
  sig?: string;
  /** A constant row's value, shown as "= 5". */
  value?: string;
  slider?: Slider;
  /** Letters with no value yet: the row offers a slider for each. */
  missing: string[];
  error?: string;
  /** Still being typed: nothing to complain about yet. */
  incomplete?: boolean;
}

const FLIP: Record<RelOp, RelOp> = { "=": "=", "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
const isVar = (n: Node, name: string) => n.k === "var" && n.name === name;

export const missingText = (names: string[]) => `${names.join(", ")} ${names.length === 1 ? "has" : "have"} no value yet`;

/** A slider for a = 3: from −10 to 10 unless the number is bigger than that. */
export function makeSlider(name: string, value: number): Slider {
  const span = Math.max(10, Math.ceil(Math.abs(value)));
  return { name, value, min: -span, max: span, step: span > 100 ? 1 : 0.1 };
}

/** The row's text after the slider moves: "m = 1.3". */
export function sliderText(name: string, value: number, step: number): string {
  const places = step >= 1 ? 0 : Math.min(20, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
  const v = Number(value.toFixed(places));
  // Written out in full, never 1e+21: the row is read back, and e there is Euler's number.
  const text = v.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: places });
  return `${name} = ${v === 0 ? "0" : text}`;
}

function explicit(axis: "x" | "y", fn: Fn2, op: RelOp): Plot {
  if (axis === "y") {
    const f = (x: number) => fn(x, NaN);
    return op === "=" ? { kind: "fx", f } : { kind: "ineq-fx", f, op };
  }
  const g = (y: number) => fn(NaN, y);
  return op === "=" ? { kind: "fy", g } : { kind: "ineq-fy", g, op };
}

function graphRow(sheet: Sheet, i: number): GraphRow {
  const none: GraphRow = { plot: null, missing: [] };
  const p = sheet.rows[i];
  if (p.errors.length) return { ...none, error: p.errors[0] };
  const t = p.tree;
  if (t.kind === "empty") return none;
  try {
    if (t.kind === "rel") {
      const named = t.op === "=" && (t.lhs.k === "var" || t.lhs.k === "apply") ? t.lhs.name : null;
      if (named && sheet.dup.has(named)) return { ...none, error: `${named} is defined more than once` };
      if (t.lhs.k === "const") return { ...none, error: `${t.lhs.name === "pi" ? "π" : "e"} already has a value. Pick another letter` };

      const name = sheet.definesConst(i);
      if (name) {
        const c = sheet.compile(i, t.rhs);
        if (c.missing.length) return { ...none, missing: c.missing, error: missingText(c.missing) };
        const value = sheet.valueOf(i);
        return isLiteral(t.rhs) ? { ...none, slider: makeSlider(name, value) } : { ...none, value: formatResult(value) };
      }

      const def = sheet.definesFunc(i);
      if (def) {
        const locals = new Map<string, Fn2>(
          def.params.map((q): [string, Fn2] => [q, q === "x" ? (x) => x : q === "y" ? (_x, y) => y : () => NaN])
        );
        const c = sheet.compile(i, def.body, { locals });
        if (c.missing.length) return { ...none, missing: c.missing, error: missingText(c.missing) };
        // f(x) = x^2 is drawn, as y = f(x) would be.
        if (def.params.length === 1 && def.params[0] === "x" && !c.uses.y) return { ...none, plot: explicit("y", c.fn, "=") };
        return none;
      }

      const L = sheet.compile(i, t.lhs);
      const R = sheet.compile(i, t.rhs);
      const missing = [...new Set([...L.missing, ...R.missing])];
      if (missing.length) return { ...none, missing, error: missingText(missing) };
      if (isVar(t.lhs, "y") && !R.uses.y) return { ...none, plot: explicit("y", R.fn, t.op) };
      if (isVar(t.rhs, "y") && !L.uses.y) return { ...none, plot: explicit("y", L.fn, FLIP[t.op]) };
      if (isVar(t.lhs, "x") && !R.uses.x) return { ...none, plot: explicit("x", R.fn, t.op) };
      if (isVar(t.rhs, "x") && !L.uses.x) return { ...none, plot: explicit("x", L.fn, FLIP[t.op]) };
      if (!L.uses.x && !L.uses.y && !R.uses.x && !R.uses.y) return { ...none, error: "There is no x or y here to graph" };
      const lf = L.fn;
      const rf = R.fn;
      return { ...none, plot: { kind: "implicit", F: (x, y) => lf(x, y) - rf(x, y), op: t.op } };
    }

    const node = t.node;
    const points = node.k === "point" ? [node] : node.k === "list" && node.items.length && node.items.every((it) => it.k === "point") ? node.items : null;
    if (points) {
      const pts: Pt[] = [];
      const missing = new Set<string>();
      for (const pt of points) {
        if (pt.k !== "point") continue;
        const cx = sheet.compile(i, pt.x);
        const cy = sheet.compile(i, pt.y);
        cx.missing.concat(cy.missing).forEach((m) => missing.add(m));
        if (cx.uses.x || cx.uses.y || cy.uses.x || cy.uses.y) return { ...none, error: "A point needs numbers, not x or y" };
        pts.push({ x: cx.fn(NaN, NaN), y: cy.fn(NaN, NaN) });
      }
      if (missing.size) return { ...none, missing: [...missing], error: missingText([...missing]) };
      return { ...none, plot: { kind: "points", pts: pts.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) } };
    }
    if (node.k === "list") return { ...none, error: "Lists of points can be graphed, like (1, 2), (3, 4)" };

    const c = sheet.compile(i, node);
    if (c.missing.length) return { ...none, missing: c.missing, error: missingText(c.missing) };
    if (c.uses.y) return { ...none, error: "To graph this, make it an equation, like y = … or … = 0" };
    if (c.uses.x) return { ...none, plot: explicit("y", c.fn, "=") };
    // A plain number: worked out the way Scientific does, so 1/0 says why.
    const v = sheet.compile(i, node, { strict: true }).fn(NaN, NaN);
    if (Number.isNaN(v)) return { ...none, error: "Undefined" };
    if (!Number.isFinite(v)) return { ...none, error: "Too big to show" };
    return isLiteral(node) ? none : { ...none, value: formatResult(v) };
  } catch (e) {
    return {
      ...none,
      error: e instanceof CalcError ? e.message : "Something went wrong",
      incomplete: e instanceof Incomplete,
    };
  }
}

/** The rows a row's plot depends on, as text: its own and every row defining a letter or function it uses, and theirs. */
function signature(sheet: Sheet, texts: string[], i: number, degrees: boolean): string {
  const seen = new Set<number>([i]);
  const queue = [i];
  while (queue.length) {
    const r = queue.pop()!;
    for (const tok of sheet.rows[r].tokens) {
      // ans reads whichever row is above: anything may change it.
      if (tok.k === "ans") return `${degrees}|all|${texts.join("\n")}`;
      if (tok.k !== "var") continue;
      const def = sheet.consts.get(tok.v) ?? sheet.funcs.get(tok.v)?.row;
      if (def !== undefined && !seen.has(def)) {
        seen.add(def);
        queue.push(def);
      }
    }
  }
  seen.delete(i);
  return `${degrees}|${texts[i]}|${[...seen].map((r) => texts[r]).sort().join("\n")}`;
}

/** Works out every row of the graphing calculator. Radians by default, as graphs of sin x are drawn. */
export function evaluateGraph(texts: string[], degrees = false): GraphRow[] {
  const sheet = new Sheet(texts, { graph: true, degrees });
  return sheet.rows.map((_p, i) => {
    const row = graphRow(sheet, i);
    if (row.plot) row.sig = signature(sheet, texts, i, degrees);
    return row;
  });
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** Where the graph is looking: its centre, pixels per unit, and its size in CSS pixels. */
export interface View {
  cx: number;
  cy: number;
  scale: number;
  w: number;
  h: number;
}

export const toPx = (v: View, x: number) => v.w / 2 + (x - v.cx) * v.scale;
export const toPy = (v: View, y: number) => v.h / 2 - (y - v.cy) * v.scale;
export const fromPx = (v: View, px: number) => v.cx + (px - v.w / 2) / v.scale;
export const fromPy = (v: View, py: number) => v.cy - (py - v.h / 2) / v.scale;

export function viewBounds(v: View) {
  return { x0: fromPx(v, 0), x1: fromPx(v, v.w), y0: fromPy(v, v.h), y1: fromPy(v, 0) };
}

export const MIN_SCALE = 1e-6;
export const MAX_SCALE = 1e7;

/** The view the home button goes back to: the origin in the middle, x from −10 to 10 (or more room for y on a short graph). */
export function homeView(w: number, h: number): View {
  return { cx: 0, cy: 0, scale: Math.max(1, Math.min(w / 20, h / 12)), w, h };
}

/** Zooms by `factor` keeping the point under (px, py) where it is. */
export function zoomAt(v: View, px: number, py: number, factor: number): View {
  const x = fromPx(v, px);
  const y = fromPy(v, py);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  return { ...v, scale, cx: x - (px - v.w / 2) / scale, cy: y + (py - v.h / 2) / scale };
}

/**
 * Grid spacing: major lines 1, 2 or 5 times a power of ten apart, at least
 * `minPx` pixels apart, with 4 minor lines between majors 2 apart and 5
 * otherwise (so a major every 2 has minors every 0.5).
 */
export function gridStep(scale: number, minPx = 40): { major: number; minor: number } {
  const raw = minPx / scale;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw <= p * 1.000001 ? 1 : raw <= 2 * p ? 2 : raw <= 5 * p ? 5 : 10;
  const major = m * p;
  return { major, minor: major / (m === 2 ? 4 : 5) };
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const superscript = (n: number) => [...String(n)].map((c) => SUP[c] ?? c).join("");
const trimZeros = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);

function scientific(a: number, digits: number): string {
  const [m, e] = a.toExponential(digits).split("e");
  return `${trimZeros(m)}×10${superscript(Number(e))}`;
}

/** An axis label: as many decimals as the step needs, big and small numbers as 2×10⁶. */
export function formatTick(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-6) return "0";
  const a = Math.abs(v);
  const s = a >= 1e6 || a < 1e-4 ? scientific(a, 2) : trimZeros(a.toFixed(Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))));
  return (v < 0 ? "−" : "") + s;
}

/**
 * How one axis writes its numbers, decided once for the whole axis so it
 * never mixes 5×10⁻⁵ with 0.0001: ×10ⁿ when the numbers are a million or
 * more, or tiny steps near 0; decimals otherwise, with as many places as
 * the step needs (3.00001 when zoomed in around 3).
 */
export function axisFormat(lo: number, hi: number, step: number): (v: number) => string {
  const big = Math.max(Math.abs(lo), Math.abs(hi));
  const sci = big >= 1e6 || (step < 1e-4 && big < 1e-2);
  const places = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const digits = sci ? Math.min(12, Math.max(0, Math.floor(Math.log10(big)) - Math.floor(Math.log10(step)))) : 0;
  return (v) => {
    if (Math.abs(v) < step * 1e-6) return "0";
    const a = Math.abs(v);
    return (v < 0 ? "−" : "") + (sci ? scientific(a, digits) : trimZeros(a.toFixed(places)));
  };
}

/**
 * Every how-many-th major line gets a number, so labels as wide as
 * "−400000" never run together: 1 when they fit, else the smallest of 2, 5,
 * 10, 20, ... that keeps the labelled lines on round numbers (1, 2 or 5
 * times a power of ten apart).
 */
export function labelEvery(major: number, pxPerMajor: number, widest: number): number {
  const need = widest + 12;
  if (need <= pxPerMajor) return 1;
  for (const m of [2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
    const gap = m * major;
    const lead = gap / Math.pow(10, Math.floor(Math.log10(gap) + 1e-9));
    const round = [1, 2, 5].some((r) => Math.abs(lead - r) < 1e-6);
    if (round && need <= m * pxPerMajor) return m;
  }
  return 1000;
}

/** A coordinate in a label: up to 3 decimals, as (1.732, 0). */
export function formatCoord(v: number): string {
  if (!Number.isFinite(v)) return "undefined";
  if (Math.abs(v) < 5e-10) return "0";
  const a = Math.abs(v);
  const s = a >= 1e6 || a < 1e-4 ? scientific(a, 3) : trimZeros(a.toFixed(3));
  return (v < 0 ? "−" : "") + s;
}

export const formatPoint = (p: Pt) => `(${formatCoord(p.x)}, ${formatCoord(p.y)})`;

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

/**
 * Samples t ↦ f(t) on [a, b] as polylines [t0, v0, t1, v1, ...], `steps`
 * evenly spaced, then more finely where the curve moves more than about two
 * pixels between samples (`unit` is one pixel in the value's units), so
 * steep parts stay smooth. A jump that is still taller than the window
 * (`lo` to `hi`) after the finest step is a real break, like 1/x at 0, and
 * the line stops there instead of drawing a wall. Where f stops being
 * defined (√x at 0) the edge is found exactly.
 */
export function sampleCurve(
  f: (t: number) => number,
  a: number,
  b: number,
  steps: number,
  lo: number,
  hi: number,
  unit: number
): number[][] {
  const segs: number[][] = [];
  let cur: number[] = [];
  let budget = steps * 40;
  const smooth = 2 * unit;
  const wall = Math.max(hi - lo, 1e-12);
  const flush = () => {
    if (cur.length >= 4) segs.push(cur);
    cur = [];
  };
  const edge = (finite: number, broken: number) => {
    for (let k = 0; k < 44; k += 1) {
      const m = (finite + broken) / 2;
      if (Number.isFinite(f(m))) finite = m;
      else broken = m;
    }
    return finite;
  };
  const link = (t0: number, v0: number, t1: number, v1: number, depth: number) => {
    const ok0 = Number.isFinite(v0);
    const ok1 = Number.isFinite(v1);
    if (!ok0 && !ok1) return;
    if (ok0 !== ok1) {
      if (ok0) {
        const e = edge(t0, t1);
        cur.push(e, f(e));
        flush();
      } else {
        flush();
        const e = edge(t1, t0);
        cur.push(e, f(e), t1, v1);
      }
      return;
    }
    const jump = Math.abs(v1 - v0);
    const offscreen = (v0 > hi && v1 > hi) || (v0 < lo && v1 < lo);
    if (jump > smooth && depth < 10 && !offscreen && budget > 0) {
      budget -= 1;
      const tm = (t0 + t1) / 2;
      const vm = f(tm);
      link(t0, v0, tm, vm, depth + 1);
      link(tm, vm, t1, v1, depth + 1);
      return;
    }
    if (jump > wall && (depth >= 10 || budget <= 0)) {
      flush();
      cur.push(t1, v1);
      return;
    }
    cur.push(t1, v1);
  };
  let tPrev = a;
  let vPrev = f(a);
  if (Number.isFinite(vPrev)) cur.push(tPrev, vPrev);
  for (let i = 1; i <= steps; i += 1) {
    const t = a + ((b - a) * i) / steps;
    const v = f(t);
    link(tPrev, vPrev, t, v, 0);
    tPrev = t;
    vPrev = v;
  }
  flush();
  return segs;
}

/** The minimum of g on [a, b] by golden-section search. */
function goldenMin(g: (t: number) => number, a: number, b: number, iters = 90): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  let gc = g(c);
  let gd = g(d);
  for (let k = 0; k < iters; k += 1) {
    if (gc < gd || Number.isNaN(gd)) {
      b = d;
      d = c;
      gd = gc;
      c = b - r * (b - a);
      gc = g(c);
    } else {
      a = c;
      c = d;
      gc = gd;
      d = a + r * (b - a);
      gd = g(d);
    }
  }
  return (a + b) / 2;
}

function samples(f: (t: number) => number, a: number, b: number, n: number) {
  const ts = new Float64Array(n + 1);
  const vs = new Float64Array(n + 1);
  for (let i = 0; i <= n; i += 1) {
    ts[i] = a + ((b - a) * i) / n;
    vs[i] = f(ts[i]);
  }
  return { ts, vs };
}

/**
 * Where f is 0 on [a, b]: every sign change (but not one across a break,
 * like 1/x at 0), and every place the curve just touches 0 (x² at 0). A
 * curve that is 0 everywhere has no roots worth marking.
 */
export function findRoots(f: (t: number) => number, a: number, b: number, n = 500): number[] {
  const { ts, vs } = samples(f, a, b, n);
  const roots: number[] = [];
  const near = (b - a) * 1e-6;
  const add = (r: number) => {
    if (!roots.some((q) => Math.abs(q - r) < near)) roots.push(r);
  };
  let zeros = 0;
  let peak = 0;
  for (let i = 0; i <= n; i += 1) if (Number.isFinite(vs[i])) peak = Math.max(peak, Math.abs(vs[i]));
  for (let i = 0; i < n; i += 1) {
    const v0 = vs[i];
    const v1 = vs[i + 1];
    if (!Number.isFinite(v0) || !Number.isFinite(v1)) continue;
    if (v0 === 0) {
      zeros += 1;
      add(ts[i]);
      continue;
    }
    if (v1 === 0 || v0 < 0 === v1 < 0) continue;
    let l = ts[i];
    let h = ts[i + 1];
    let fl = v0;
    for (let k = 0; k < 70; k += 1) {
      const m = (l + h) / 2;
      const fm = f(m);
      if (!Number.isFinite(fm)) break;
      if (fm < 0 === fl < 0) {
        l = m;
        fl = fm;
      } else {
        h = m;
      }
    }
    const r = (l + h) / 2;
    const fr = f(r);
    if (Number.isFinite(fr) && Math.abs(fr) <= Math.max(Math.abs(v0), Math.abs(v1))) add(r);
  }
  if (Number.isFinite(vs[n]) && vs[n] === 0) {
    zeros += 1;
    add(ts[n]);
  }
  if (zeros > n / 4) return [];
  const touch = 1e-9 * Math.max(1, peak);
  for (let i = 1; i < n; i += 1) {
    const v0 = vs[i - 1];
    const v1 = vs[i];
    const v2 = vs[i + 1];
    if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    if (v0 < 0 !== v2 < 0 || v0 < 0 !== v1 < 0) continue;
    if (Math.abs(v1) > Math.abs(v0) || Math.abs(v1) > Math.abs(v2)) continue;
    const m = goldenMin((t) => Math.abs(f(t)), ts[i - 1], ts[i + 1]);
    if (Math.abs(f(m)) < touch) add(m);
  }
  return roots.sort((p, q) => p - q);
}

/** Local maximums and minimums of f on [a, b] (not the spikes beside a break). */
export function findExtrema(f: (t: number) => number, a: number, b: number, n = 400): Pt[] {
  const { ts, vs } = samples(f, a, b, n);
  const out: Pt[] = [];
  for (let i = 1; i < n; i += 1) {
    const v0 = vs[i - 1];
    const v1 = vs[i];
    const v2 = vs[i + 1];
    if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    const isMax = v1 > v0 && v1 >= v2;
    const isMin = v1 < v0 && v1 <= v2;
    if (!isMax && !isMin) continue;
    const sign = isMax ? -1 : 1;
    const m = goldenMin((t) => sign * f(t), ts[i - 1], ts[i + 1]);
    const fm = f(m);
    const spread = Math.abs(v1 - v0) + Math.abs(v2 - v1);
    if (!Number.isFinite(fm) || Math.abs(fm - v1) > 2 * spread + 1e-12) continue;
    if (!out.some((q) => Math.abs(q.x - m) < (b - a) * 1e-6)) out.push({ x: m, y: fm });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Relations in x and y, and regions
// ---------------------------------------------------------------------------

/** Whether d = lhs − rhs satisfies op. */
export function holds(op: RelOp, d: number): boolean {
  if (!Number.isFinite(d)) return false;
  switch (op) {
    case "<":
      return d < 0;
    case "<=":
      return d <= 0;
    case ">":
      return d > 0;
    case ">=":
      return d >= 0;
    default:
      return Math.abs(d) < 1e-9;
  }
}

/** Whether (x, y) is in a plot's shaded region (or on its curve, for =). */
export function regionContains(plot: Plot, x: number, y: number): boolean {
  switch (plot.kind) {
    case "ineq-fx":
      return holds(plot.op, y - plot.f(x));
    case "ineq-fy":
      return holds(plot.op, x - plot.g(y));
    case "implicit":
      return holds(plot.op, plot.F(x, y));
    case "fx":
      return holds("=", y - plot.f(x));
    case "fy":
      return holds("=", x - plot.g(y));
    default:
      return plot.pts.some((p) => p.x === x && p.y === y);
  }
}

/**
 * F at every corner of an nx by ny grid over the box, row by row. The curve
 * and the shading of an inequality both read it, so it is worked out once.
 */
export function gridValues(F: Fn2, x0: number, x1: number, y0: number, y1: number, nx: number, ny: number): Float64Array {
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  const w = nx + 1;
  const vals = new Float64Array(w * (ny + 1));
  for (let j = 0; j <= ny; j += 1) {
    const y = y0 + j * dy;
    for (let i = 0; i <= nx; i += 1) vals[j * w + i] = F(x0 + i * dx, y);
  }
  return vals;
}

/**
 * The curve F(x, y) = 0 by marching squares on an nx by ny grid over the
 * box, as segments [x1, y1, x2, y2, ...]. Exact for straight lines, since
 * crossings are interpolated, and a sign change across a break is skipped.
 * `vals` is gridValues for the same box, when the caller has it already.
 */
export function contour(
  F: Fn2,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  nx: number,
  ny: number,
  vals: Float64Array = gridValues(F, x0, x1, y0, y1, nx, ny)
): number[] {
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  const w = nx + 1;
  const out: number[] = [];
  const cross = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): [number, number] => {
    const t = va / (va - vb);
    return [xa + (xb - xa) * t, ya + (yb - ya) * t];
  };
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const va = vals[j * w + i];
      const vb = vals[j * w + i + 1];
      const vc = vals[(j + 1) * w + i + 1];
      const vd = vals[(j + 1) * w + i];
      if (!Number.isFinite(va) || !Number.isFinite(vb) || !Number.isFinite(vc) || !Number.isFinite(vd)) continue;
      const xa = x0 + i * dx;
      const ya = y0 + j * dy;
      const xb = xa + dx;
      const yb = ya + dy;
      const pts: [number, number][] = [];
      if (va >= 0 !== vb >= 0) pts.push(cross(xa, ya, va, xb, ya, vb));
      if (vb >= 0 !== vc >= 0) pts.push(cross(xb, ya, vb, xb, yb, vc));
      if (vc >= 0 !== vd >= 0) pts.push(cross(xb, yb, vc, xa, yb, vd));
      if (vd >= 0 !== va >= 0) pts.push(cross(xa, yb, vd, xa, ya, va));
      if (pts.length < 2) continue;
      const big = Math.max(Math.abs(va), Math.abs(vb), Math.abs(vc), Math.abs(vd));
      const pairs: [number, number][] =
        pts.length === 2 ? [[0, 1]] : (F(xa + dx / 2, ya + dy / 2) >= 0) === va >= 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
      for (const [p, q] of pairs) {
        const mx = (pts[p][0] + pts[q][0]) / 2;
        const my = (pts[p][1] + pts[q][1]) / 2;
        const mid = F(mx, my);
        if (!Number.isFinite(mid) || Math.abs(mid) > big) continue;
        out.push(pts[p][0], pts[p][1], pts[q][0], pts[q][1]);
      }
    }
  }
  return out;
}

/**
 * Joins marching-squares segments that share an end into polylines
 * [x0, y0, x1, y1, ...], so a dashed boundary dashes along the curve
 * instead of restarting its pattern in every grid cell. `tol` is how close
 * two ends must be to count as one.
 */
export function chainSegments(segs: number[], tol: number): number[][] {
  const n = segs.length / 4;
  const key = (x: number, y: number) => `${Math.round(x / tol)},${Math.round(y / tol)}`;
  const at = new Map<string, number[]>();
  const note = (k: string, i: number) => {
    const list = at.get(k);
    if (list) list.push(i);
    else at.set(k, [i]);
  };
  for (let i = 0; i < n; i += 1) {
    note(key(segs[4 * i], segs[4 * i + 1]), i);
    note(key(segs[4 * i + 2], segs[4 * i + 3]), i);
  }
  const used = new Uint8Array(n);
  /** The unused segment touching (x, y), and its other end. */
  const next = (x: number, y: number): [number, number] | null => {
    for (const j of at.get(key(x, y)) ?? []) {
      if (used[j]) continue;
      used[j] = 1;
      const startHere = key(segs[4 * j], segs[4 * j + 1]) === key(x, y);
      return startHere ? [segs[4 * j + 2], segs[4 * j + 3]] : [segs[4 * j], segs[4 * j + 1]];
    }
    return null;
  };
  const lines: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (used[i]) continue;
    used[i] = 1;
    const head: number[] = [];
    const tail: number[] = [segs[4 * i + 2], segs[4 * i + 3]];
    let end: [number, number] | null = [segs[4 * i + 2], segs[4 * i + 3]];
    while ((end = next(end[0], end[1]))) tail.push(end[0], end[1]);
    let start: [number, number] | null = [segs[4 * i], segs[4 * i + 1]];
    while ((start = next(start[0], start[1]))) head.unshift(start[0], start[1]);
    lines.push([...head, segs[4 * i], segs[4 * i + 1], ...tail]);
  }
  return lines;
}

/**
 * Where F(x, y) op 0 holds, on an nx by ny grid: runs of whole cells as
 * rectangles [x, y, w, h, ...], and the cut cells along the edge as
 * polygons, so the shading follows the boundary instead of a staircase.
 */
export function region(
  F: Fn2,
  op: RelOp,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  nx: number,
  ny: number,
  vals: Float64Array = gridValues(F, x0, x1, y0, y1, nx, ny)
): { rects: number[]; polys: number[][] } {
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  const w = nx + 1;
  const inside = (v: number) => holds(op, v);
  const rects: number[] = [];
  const polys: number[][] = [];
  for (let j = 0; j < ny; j += 1) {
    let run = -1;
    for (let i = 0; i <= nx; i += 1) {
      let full = false;
      if (i < nx) {
        const v = [vals[j * w + i], vals[j * w + i + 1], vals[(j + 1) * w + i + 1], vals[(j + 1) * w + i]];
        const ins = v.map(inside);
        full = ins.every(Boolean);
        if (!full && ins.some(Boolean)) {
          const xa = x0 + i * dx;
          const ya = y0 + j * dy;
          const corners: [number, number][] = [
            [xa, ya],
            [xa + dx, ya],
            [xa + dx, ya + dy],
            [xa, ya + dy],
          ];
          const poly: number[] = [];
          for (let k = 0; k < 4; k += 1) {
            const k2 = (k + 1) % 4;
            if (ins[k]) poly.push(corners[k][0], corners[k][1]);
            if (ins[k] !== ins[k2] && Number.isFinite(v[k]) && Number.isFinite(v[k2]) && v[k] !== v[k2]) {
              const t = v[k] / (v[k] - v[k2]);
              poly.push(corners[k][0] + (corners[k2][0] - corners[k][0]) * t, corners[k][1] + (corners[k2][1] - corners[k][1]) * t);
            }
          }
          if (poly.length >= 6) polys.push(poly);
        }
      }
      if (full && run < 0) run = i;
      if (!full && run >= 0) {
        rects.push(x0 + run * dx, y0 + j * dy, (i - run) * dx, dy);
        run = -1;
      }
    }
  }
  return { rects, polys };
}

// ---------------------------------------------------------------------------
// Points of interest
// ---------------------------------------------------------------------------

/** A curve as the gray dots see it: y = f(x), x = g(y), or F(x, y) = 0. */
type Curve = { kind: "fx"; f: (x: number) => number } | { kind: "fy"; g: (y: number) => number } | { kind: "imp"; F: Fn2 };

export function curveOf(plot: Plot): Curve | null {
  switch (plot.kind) {
    case "fx":
    case "ineq-fx":
      return { kind: "fx", f: plot.f };
    case "fy":
    case "ineq-fy":
      return { kind: "fy", g: plot.g };
    case "implicit":
      return { kind: "imp", F: plot.F };
    default:
      return null;
  }
}

/**
 * The gray dots a selected curve shows, inside the box: where it crosses
 * the axes, its turning points, and where it meets each of `others`.
 */
export function pointsOfInterest(plot: Plot, others: Plot[], x0: number, x1: number, y0: number, y1: number): Pt[] {
  const c = curveOf(plot);
  if (!c) return [];
  const out: Pt[] = [];
  // A turning point found at x = 1.5×10⁻⁸ is at 0: the search is only that exact.
  const snap = (v: number, span: number) => (Math.abs(v) < span * 1e-6 ? 0 : v);
  const add = (q: Pt) => {
    const p = { x: snap(q.x, x1 - x0), y: snap(q.y, y1 - y0) };
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
    const tol = (x1 - x0) * 1e-5;
    if (!out.some((q) => Math.abs(q.x - p.x) < tol && Math.abs(q.y - p.y) < tol)) out.push(p);
  };
  if (c.kind === "fx") {
    findRoots(c.f, x0, x1).forEach((x) => add({ x, y: 0 }));
    add({ x: 0, y: c.f(0) });
    findExtrema(c.f, x0, x1).forEach(add);
  } else if (c.kind === "fy") {
    findRoots(c.g, y0, y1).forEach((y) => add({ x: 0, y }));
    add({ x: c.g(0), y: 0 });
    findExtrema(c.g, y0, y1).forEach((p) => add({ x: p.y, y: p.x }));
  } else {
    findRoots((x) => c.F(x, 0), x0, x1).forEach((x) => add({ x, y: 0 }));
    findRoots((y) => c.F(0, y), y0, y1).forEach((y) => add({ x: 0, y }));
  }
  for (const other of others) {
    const d = curveOf(other);
    if (!d) continue;
    if (c.kind === "fx" && d.kind === "fx") findRoots((x) => c.f(x) - d.f(x), x0, x1).forEach((x) => add({ x, y: c.f(x) }));
    else if (c.kind === "fx" && d.kind === "fy") findRoots((x) => x - d.g(c.f(x)), x0, x1).forEach((x) => add({ x, y: c.f(x) }));
    else if (c.kind === "fy" && d.kind === "fx") findRoots((y) => y - d.f(c.g(y)), y0, y1).forEach((y) => add({ x: c.g(y), y }));
    else if (c.kind === "fy" && d.kind === "fy") findRoots((y) => c.g(y) - d.g(y), y0, y1).forEach((y) => add({ x: c.g(y), y }));
    else if (c.kind === "fx" && d.kind === "imp") findRoots((x) => d.F(x, c.f(x)), x0, x1).forEach((x) => add({ x, y: c.f(x) }));
    else if (c.kind === "fy" && d.kind === "imp") findRoots((y) => d.F(c.g(y), y), y0, y1).forEach((y) => add({ x: c.g(y), y }));
    else if (c.kind === "imp" && d.kind === "fx") findRoots((x) => c.F(x, d.f(x)), x0, x1).forEach((x) => add({ x, y: d.f(x) }));
    else if (c.kind === "imp" && d.kind === "fy") findRoots((y) => c.F(d.g(y), y), y0, y1).forEach((y) => add({ x: d.g(y), y }));
  }
  return out.slice(0, 60);
}
