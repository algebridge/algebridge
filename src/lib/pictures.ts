/**
 * Pictures for problems: a graph, a number line, a bar model, an area model,
 * a table, a dot plot, a row of terms, a rectangle, a chain of conversion
 * factors, or growth bars, read from the problem as it is written.
 *
 * Built from the prompt rather than stored with each problem, so the seeds,
 * every generator kind and a problem rewritten into a story (which keeps its
 * numbers) all get one, and a prompt this cannot read simply gets none.
 *
 * `reveals` marks a picture that shows the answer: a graph of y = 3x - 4
 * shows its y-intercept, a number line of the solution set is the solution.
 * The practice card holds those back until the first try has been made. A
 * picture of the givens alone (a bar model, the survey as a table, the data
 * as dots) is there from the start.
 *
 * Pure: nothing here touches the page.
 */

import { evalSafe, extractMath, holds, isConstant, scanRoots, variablesOf, type Node, type RelOp } from "@/lib/mathexpr";

// ---------------------------------------------------------------------------
// What a picture is
// ---------------------------------------------------------------------------

/** One of a few distinct inks a picture uses: 0 is the problem's own line, 1 a second line, 2 a highlight. */
export type Tone = 0 | 1 | 2;

export interface PlanePoint {
  x: number;
  y: number;
  label?: string;
  open?: boolean;
  tone?: Tone;
}

export interface PlaneCurve {
  f: (x: number) => number;
  label?: string;
  tone?: Tone;
  dashed?: boolean;
  /** For an inequality: the side of the curve that is shaded. */
  shade?: "above" | "below";
  /** Only drawn on this stretch of x, for a piece of a piecewise function or a restricted domain. */
  from?: number;
  to?: number;
}

export interface PlaneVLine {
  x: number;
  label?: string;
  tone?: Tone;
  dashed?: boolean;
  shade?: "left" | "right";
}

export interface PlaneSegment {
  from: [number, number];
  to: [number, number];
  label?: string;
  tone?: Tone;
  dashed?: boolean;
}

export interface NumberLineMark {
  x: number;
  open?: boolean;
  label?: string;
  tone?: Tone;
}

export interface NumberLineSpan {
  from: number;
  to: number;
  tone?: Tone;
}

export interface NumberLineArc {
  from: number;
  to: number;
  label: string;
}

export interface TapePart {
  label: string;
  size: number;
  kind: "unknown" | "known" | "taken";
}

export interface TapeRow {
  parts: TapePart[];
  /** A brace under the row with what it adds up to. */
  total?: string;
}

interface Base {
  /** What the picture shows, read out to a screen reader and shown under it. */
  title: string;
  reveals: boolean;
}

export type Picture =
  | (Base & {
      kind: "plane";
      x: [number, number];
      y: [number, number];
      curves: PlaneCurve[];
      vlines: PlaneVLine[];
      points: PlanePoint[];
      segments: PlaneSegment[];
      /** Names for the axes when they are not x and y. */
      axes?: [string, string];
    })
  | (Base & { kind: "numberline"; min: number; max: number; marks: NumberLineMark[]; spans: NumberLineSpan[]; arcs: NumberLineArc[] })
  | (Base & { kind: "tape"; rows: TapeRow[] })
  | (Base & { kind: "area"; cols: string[]; rows: string[]; cells: (string | null)[][] })
  | (Base & { kind: "table"; corner: string; cols: string[]; rows: string[]; cells: (string | null)[][] })
  | (Base & { kind: "dots"; values: number[] })
  | (Base & { kind: "terms"; terms: { label: string; value: string | null }[]; steps: (string | null)[] })
  | (Base & { kind: "rect"; width: string; height: string; inside: string })
  | (Base & { kind: "chain"; start: string; factors: { top: string; bottom: string }[]; result: string })
  | (Base & { kind: "bars"; labels: string[]; values: number[]; money: boolean });

// ---------------------------------------------------------------------------
// Reading numbers and points
// ---------------------------------------------------------------------------

/** One spelling for minus signs, so "−3" reads like "-3". */
const plain = (s: string) => s.replace(/[−–]/g, "-");
const toNum = (s: string) => Number(plain(s).replace(/,/g, ""));
const N = String.raw`-?\d[\d,]*(?:\.\d+)?`;
const SUP: Record<string, string> = { "²": "2", "³": "3", "⁴": "4" };

/** Every "(a, b)" point written in the text, in order. */
export function pointsIn(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of plain(text).matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

/** "3, 7, 11, 15" after a marker, as numbers. */
function listAfter(text: string, marker: RegExp): number[] | null {
  const m = plain(text).match(new RegExp(marker.source + String.raw`\s*((?:-?\d+(?:\.\d+)?\s*,\s*)+(?:and\s+)?-?\d+(?:\.\d+)?)`, "i"));
  if (!m) return null;
  return m[m.length - 1]
    .replace(/\band\b/g, "")
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((v) => Number.isFinite(v));
}

/** A number written for people: 1,250 and 3.5, never 3.4999999, with a printed minus sign. */
export { pretty };

export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "";
  const r = Math.round(v * 100) / 100;
  return (Math.abs(r) >= 1000 ? r.toLocaleString("en-US") : String(r)).replace("-", "−");
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function niceStep(span: number): number {
  const raw = span / 8;
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}

/** A range that holds every value with room around it, on round numbers, and holds 0 when 0 is near. */
export function niceRange(values: number[], minSpan = 8): [number, number] {
  const vals = values.filter((v) => Number.isFinite(v));
  if (!vals.length) return [-10, 10];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  // Keep the axis in view when it is near the action.
  if (lo > 0 && lo < (hi - lo) * 1.5 + 2) lo = 0;
  if (hi < 0 && -hi < (hi - lo) * 1.5 + 2) hi = 0;
  const pad = Math.max((hi - lo) * 0.18, 1);
  lo -= pad;
  hi += pad;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const step = niceStep(hi - lo);
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/**
 * The window for a graph. Small problems get the classroom grid, -10 to 10
 * on both axes with equal units, so a slope looks like its number. Anything
 * bigger fits each axis to what is there.
 */
function planeWindow(xs: number[], ys: number[]): { x: [number, number]; y: [number, number] } {
  const fx = xs.filter(Number.isFinite);
  const fy = ys.filter(Number.isFinite);
  const all = [...fx, ...fy];
  const reach = all.length ? Math.max(...all.map(Math.abs)) : 0;
  if (reach <= 8) return { x: [-10, 10], y: [-10, 10] };
  if (reach <= 13) return { x: [-15, 15], y: [-15, 15] };
  return { x: niceRange(fx, 6), y: niceRange(fy, 6) };
}

// ---------------------------------------------------------------------------
// Relations as curves
// ---------------------------------------------------------------------------

interface Rel {
  lhs: Node;
  rhs: Node;
  op: RelOp;
  text: string;
}

function relationsOf(prompt: string): Rel[] {
  const out: Rel[] = [];
  for (const { chain, text } of extractMath(prompt).chains) {
    if (chain.exprs.length === 2) out.push({ lhs: chain.exprs[0], rhs: chain.exprs[1], op: chain.ops[0], text });
  }
  return out;
}

const SAMPLE_X = [-3.3, -1.7, 0.4, 1.9, 3.6];

interface CurveRead {
  f?: (x: number) => number;
  vertical?: number;
  shade?: "above" | "below" | "left" | "right";
  strict: boolean;
}

/** A relation in two variables as y = f(x), or a vertical line; with the side an inequality shades. */
function asCurve(r: Rel, xv: string, yv: string): CurveRead | null {
  const F = (x: number, y: number) => evalSafe(r.lhs, { [xv]: x, [yv]: y }) - evalSafe(r.rhs, { [xv]: x, [yv]: y });
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  // Linear in y: the second difference in y is zero.
  const linearInY = SAMPLE_X.every((x) => {
    const [a, b, c] = [F(x, 0), F(x, 1), F(x, 2)];
    return [a, b, c].every(Number.isFinite) && near(c - 2 * b + a, 0);
  });
  if (!linearInY) return null;
  const strict = r.op === "<" || r.op === ">";
  const inequality = r.op !== "=";
  const slopeY = (x: number) => F(x, 1) - F(x, 0);
  if (SAMPLE_X.every((x) => near(slopeY(x), 0))) {
    // No y at all: a vertical line, x = c.
    const g = (x: number) => F(x, 0);
    const k = g(1) - g(0);
    if (!Number.isFinite(k) || near(k, 0)) return null;
    const c = -g(0) / k;
    const read: CurveRead = { vertical: c, strict };
    if (inequality) read.shade = holds(r.op, evalSafe(r.lhs, { [xv]: c + 1, [yv]: 0 }), evalSafe(r.rhs, { [xv]: c + 1, [yv]: 0 })) ? "right" : "left";
    return read;
  }
  const f = (x: number) => -F(x, 0) / slopeY(x);
  const read: CurveRead = { f, strict };
  if (inequality) {
    const x0 = 0.37;
    const y0 = f(x0) + 1;
    read.shade = holds(r.op, evalSafe(r.lhs, { [xv]: x0, [yv]: y0 }), evalSafe(r.rhs, { [xv]: x0, [yv]: y0 })) ? "above" : "below";
  }
  return read;
}

/** The two variables of a graphed relation: x and y, or a story's own pair like t and h. */
function axesOf(rels: Rel[]): [string, string] | null {
  const vars = new Set(rels.flatMap((r) => [...variablesOf(r.lhs), ...variablesOf(r.rhs)]));
  if ([...vars].every((v) => v === "x" || v === "y") && vars.has("x") && vars.has("y")) return ["x", "y"];
  if (vars.size === 2) {
    // The one standing alone on the left is the output: "h = -16t² + 32t".
    const lone = rels.map((r) => (r.lhs.t === "var" ? r.lhs.name : null)).find((v) => v && vars.has(v));
    if (lone) {
      const other = [...vars].find((v) => v !== lone)!;
      return [other, lone];
    }
  }
  return null;
}

/**
 * Where a curve crosses the x-axis, turns, breaks (an asymptote, where the
 * sign flips through a huge value) and starts or stops (the edge of a square
 * root's domain), for fitting the window and marking. Values near a break
 * are left out of `ys`, or 1/(x − 2) would ask for a window a billion tall.
 */
function features(
  f: (x: number) => number,
  lo = -12,
  hi = 12
): { xs: number[]; ys: number[]; turns: [number, number][]; poles: number[]; edges: number[]; roots: number[] } {
  const roots: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const turns: [number, number][] = [];
  const poles: number[] = [];
  const edges: number[] = [];
  const y0 = f(0);
  if (Number.isFinite(y0) && Math.abs(y0) < 1e4) ys.push(y0);
  let prev = f(lo);
  let prevX = lo;
  const step = (hi - lo) / 480;
  let slopePrev = NaN;
  for (let x = lo + step; x <= hi + 1e-9; x += step) {
    const y = f(x);
    if (Number.isFinite(y) !== Number.isFinite(prev)) {
      // Defined on one side only: the edge of the domain, found to the grid.
      let a = prevX;
      let b = x;
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2;
        if (Number.isFinite(f(m)) === Number.isFinite(prev)) a = m;
        else b = m;
      }
      const edge = snap(Number.isFinite(prev) ? a : b);
      edges.push(edge);
      xs.push(edge);
    }
    if (Number.isFinite(y) && Number.isFinite(prev)) {
      if (y === 0 || Math.sign(y) !== Math.sign(prev)) {
        // Narrow the flip down: through zero the values shrink to nothing, through a break they grow without end.
        let a = prevX;
        let b = x;
        for (let k = 0; k < 50; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(f(a))) a = m;
          else b = m;
        }
        const at = (a + b) / 2;
        const size = Math.min(Math.abs(f(a)), Math.abs(f(b)));
        if (Number.isFinite(size) && size > 1e3) {
          poles.push(snap(at));
          xs.push(at);
        } else {
          // A crossing sits on the x-axis, so the window has to hold y = 0 too.
          xs.push(at);
          ys.push(0);
          roots.push(snap(at));
        }
      }
      const slope = y - prev;
      // A real turn has the curve on one side of it both ways; a jump across a break does not.
      const h = step * 2;
      const sameSide = Math.sign(f(prevX - h) - prev) === Math.sign(f(prevX + h) - prev);
      if (Number.isFinite(slopePrev) && Math.sign(slope) !== Math.sign(slopePrev) && slope !== 0 && Math.abs(prev) < 1e4 && sameSide) {
        xs.push(prevX);
        ys.push(prev);
        turns.push([prevX, prev]);
      }
      slopePrev = slope;
    } else {
      slopePrev = NaN;
    }
    prev = y;
    prevX = x;
  }
  // A gap of a single point with the curve on both sides is a break, not an edge: 1/(x − 2) at 2.
  const isolated = (e: number) => Number.isFinite(f(e - 0.01)) && Number.isFinite(f(e + 0.01));
  const realEdges = [...new Set(edges)].filter((e) => !isolated(e));
  for (const e of new Set(edges)) if (isolated(e) && !poles.some((q) => Math.abs(q - e) < 0.01)) poles.push(e);
  return { xs, ys, turns, poles: [...new Set(poles.map((q) => Math.round(q * 1e6) / 1e6))], edges: realEdges, roots: [...new Set(roots)] };
}

/** Round a found crossing to the grid when it is on it: scanning lands a hair off. */
const snap = (v: number) => (Math.abs(v - Math.round(v * 4) / 4) < 0.02 ? Math.round(v * 4) / 4 : v);

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function plane(
  title: string,
  reveals: boolean,
  parts: { curves?: PlaneCurve[]; vlines?: PlaneVLine[]; points?: PlanePoint[]; segments?: PlaneSegment[]; axes?: [string, string] },
  fit: { xs: number[]; ys: number[] }
): Picture {
  const w = planeWindow(fit.xs, fit.ys);
  return {
    kind: "plane",
    title,
    reveals,
    x: w.x,
    y: w.y,
    curves: parts.curves ?? [],
    vlines: parts.vlines ?? [],
    points: parts.points ?? [],
    segments: parts.segments ?? [],
    axes: parts.axes,
  };
}

/** "y = -(1/2)x + 1" as printed. */
const pretty = (text: string) => text.replace(/\^2(?![\d.])/g, "²").replace(/\^3(?![\d.])/g, "³").replace(/-/g, "−").replace(/\*/g, "·");

/** What a graph shows, when the caller has nothing more particular to say. */
function graphTitle(curves: PlaneCurve[], vlines: PlaneVLine[]): string {
  const shaded = [...curves, ...vlines].filter((c) => c.shade);
  if (shaded.length >= 2) return "Each inequality shaded on its true side. The points in the overlap make both true.";
  if (shaded.length === 1) return `${pretty(shaded[0].label ?? "The inequality")}, shaded on its true side. A dashed line is left out; a solid one is included.`;
  const labeled = curves.filter((c) => c.label);
  if (labeled.length === 2) return `${pretty(labeled[0].label!)} and ${pretty(labeled[1].label!)}. The solution is where they cross.`;
  if (labeled.length === 1) return `The graph of ${pretty(labeled[0].label!)}.`;
  return "The graph.";
}

/** Graphs every two-variable relation in the prompt: lines, systems, parabolas, inequalities. */
function graphRelations(prompt: string, title?: string, opts: { reveals?: boolean; marks?: boolean } = {}): Picture | null {
  const rels = relationsOf(prompt);
  const two = rels.filter((r) => new Set([...variablesOf(r.lhs), ...variablesOf(r.rhs)]).size === 2);
  if (!two.length || two.length > 3) return null;
  const axes = axesOf(two);
  if (!axes) return null;
  const [xv, yv] = axes;
  const curves: PlaneCurve[] = [];
  const vlines: PlaneVLine[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const reads: CurveRead[] = [];
  for (const [i, r] of two.entries()) {
    const read = asCurve(r, xv, yv);
    if (!read) return null;
    reads.push(read);
    const tone = (i % 3) as Tone;
    if (read.vertical !== undefined) {
      vlines.push({ x: read.vertical, tone, dashed: read.strict, shade: read.shade === "left" || read.shade === "right" ? read.shade : undefined, label: r.text });
      xs.push(read.vertical);
    } else if (read.f) {
      const f = read.f;
      curves.push({ f, tone, dashed: read.strict, shade: read.shade === "above" || read.shade === "below" ? read.shade : undefined, label: r.text });
      const feat = features(f);
      xs.push(...feat.xs);
      ys.push(...feat.ys);
    }
  }
  // A relation in y alone is a horizontal line (y > -1); in x alone, a vertical one, or a place to read the graph ("when x = 8").
  const guides: number[] = [];
  if (xv === "x" && yv === "y") {
    for (const r of rels) {
      const vars = new Set([...variablesOf(r.lhs), ...variablesOf(r.rhs)]);
      if (vars.size !== 1) continue;
      const only = [...vars][0];
      if (only !== "x" && only !== "y") continue;
      const g = (v: number) => evalSafe(r.lhs, { [only]: v }) - evalSafe(r.rhs, { [only]: v });
      const k = g(1) - g(0);
      if (!Number.isFinite(k) || Math.abs(k) < 1e-12 || Math.abs(g(2) - 2 * g(1) + g(0)) > 1e-9) continue;
      const c = snap(-g(0) / k);
      const strict = r.op === "<" || r.op === ">";
      const side = r.op === "=" ? undefined : holds(r.op, evalSafe(r.lhs, { [only]: c + 1 }), evalSafe(r.rhs, { [only]: c + 1 }));
      const tone = (curves.length + vlines.length) % 3 as Tone;
      if (only === "y") {
        curves.push({ f: () => c, tone, dashed: strict, shade: side === undefined ? undefined : side ? "above" : "below", label: r.text });
        ys.push(c);
      } else if (r.op === "=") {
        if (curves.length) guides.push(c);
        xs.push(c);
      } else {
        vlines.push({ x: c, tone, dashed: strict, shade: side ? "right" : "left", label: r.text });
        xs.push(c);
      }
    }
  }
  const points: PlanePoint[] = [];
  for (const gx of guides) {
    vlines.push({ x: gx, tone: 2, dashed: true });
    for (const c of curves) {
      const y = c.f(gx);
      if (Number.isFinite(y)) {
        points.push({ x: gx, y: snap(y), tone: 2 });
        ys.push(y);
      }
    }
  }
  // Where two curves meet.
  if (curves.length === 2 && opts.marks !== false && !curves.some((c) => c.shade)) {
    const [a, b] = curves;
    const d = (x: number) => a.f(x) - b.f(x);
    for (let x = -40; x < 40; x += 0.05) {
      const y1 = d(x);
      const y2 = d(x + 0.05);
      if (Number.isFinite(y1) && Number.isFinite(y2) && (y1 === 0 || Math.sign(y1) !== Math.sign(y2))) {
        let lo = x;
        let hi = x + 0.05;
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2;
          if (Math.sign(d(mid)) === Math.sign(d(lo))) lo = mid;
          else hi = mid;
        }
        const px = snap((lo + hi) / 2);
        points.push({ x: px, y: snap(a.f(px)), tone: 2 });
        xs.push(px);
        ys.push(a.f(px));
        break;
      }
    }
  }
  if (curves.length === 1 && opts.marks !== false && !curves[0].shade) {
    // A single line or curve: where it crosses the y-axis, and the turn of a parabola.
    const f = curves[0].f;
    const y0 = f(0);
    if (Number.isFinite(y0)) points.push({ x: 0, y: snap(y0), tone: 2 });
    const feat = features(f, -30, 30);
    // Where it crosses the x-axis.
    for (const r of feat.roots.slice(0, 2)) if (Math.abs(r) > 1e-9 || !Number.isFinite(y0) || Math.abs(y0) > 1e-9) points.push({ x: r, y: 0, tone: 2 });
    for (const [tx] of feat.turns.slice(0, 1)) {
      // The turn, found on a grid of steps, refined to where the slope is level.
      let a = tx - 0.2;
      let b = tx + 0.2;
      for (let k = 0; k < 60; k++) {
        const m1 = a + (b - a) / 3;
        const m2 = b - (b - a) / 3;
        const up = f(m1) < f(m2) === f(tx - 0.2) > f(tx);
        if (up) b = m2;
        else a = m1;
      }
      const vx = snap((a + b) / 2);
      if (Math.abs(vx) > 1e-9) points.push({ x: vx, y: snap(f(vx)), tone: 2 });
      // Show both sides of the turn: the y-axis, mirrored across it.
      xs.push(2 * vx);
    }
  }
  for (const [px, py] of pointsIn(prompt)) {
    points.push({ x: px, y: py, tone: 1 });
    xs.push(px);
    ys.push(py);
  }
  // Every marked point is in view.
  for (const pt of points) {
    xs.push(pt.x);
    ys.push(pt.y);
  }
  if (!xs.length) xs.push(0);
  if (!ys.length) ys.push(0);
  const axisNames: [string, string] | undefined = xv === "x" ? undefined : [xv, yv];
  return plane(title ?? graphTitle(curves, vlines), opts.reveals ?? true, { curves, vlines, points, axes: axisNames }, { xs, ys });
}

/** A one-variable equation or inequality, or a chain like -3 < 2x + 1 < 9, as a number line of its solutions. */
function numberLineOf(prompt: string, title: string): Picture | null {
  const ex = extractMath(prompt);
  const chains = ex.chains.filter((c) => {
    const vars = new Set(c.chain.exprs.flatMap((e) => variablesOf(e)));
    return vars.size === 1;
  });
  if (!chains.length || chains.length > 2) return null;
  const v = variablesOf(chains[0].chain.exprs.find((e) => !isConstant(e))!)[0];
  // Every chain's truth as a function of v.
  const test = (x: number) => {
    const results = chains.map(({ chain }) => chain.ops.every((op, i) => holds(op, evalSafe(chain.exprs[i], { [v]: x }), evalSafe(chain.exprs[i + 1], { [v]: x })) === true));
    return ex.hasOr || chains.length === 1 ? results.some(Boolean) : results.every(Boolean);
  };
  // Boundaries: where any two neighbors in a chain are equal.
  const bounds: number[] = [];
  for (const { chain } of chains) {
    for (let i = 0; i < chain.ops.length; i++) {
      const scan = scanRoots({ lhs: chain.exprs[i], rhs: chain.exprs[i + 1] }, v);
      for (const root of scan.roots) if (Math.abs(root) < 1e4) bounds.push(snap(root));
    }
  }
  const uniq = [...new Set(bounds.map((b) => Math.round(b * 1e6) / 1e6))].sort((a, b) => a - b);
  if (!uniq.length || uniq.length > 4) return null;
  const [min, max] = niceRange(uniq, 10);
  const marks: NumberLineMark[] = uniq.map((b) => ({ x: b, open: !test(b), label: fmt(b), tone: 0 as Tone }));
  const spans: NumberLineSpan[] = [];
  const cuts = [-Infinity, ...uniq, Infinity];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const mid = !Number.isFinite(a) ? b - 1 : !Number.isFinite(b) ? a + 1 : (a + b) / 2;
    if (test(mid)) spans.push({ from: a, to: b, tone: 0 });
  }
  const anyEquation = chains.every(({ chain }) => chain.ops.every((op) => op === "="));
  return { kind: "numberline", title, reveals: true, min, max, marks: anyEquation ? marks.filter((m) => !m.open) : marks, spans: anyEquation ? [] : spans, arcs: [] };
}

// ---------------------------------------------------------------------------
// Per skill
// ---------------------------------------------------------------------------

/** "Solve for x: 3x + 5 = 20", and the money stories that are the same shape, as a bar model. */
function tapeFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^Solve for x: (\d*)x \+ (\d+) = (\d+)$/))) {
    const a = Number(m[1] || 1);
    const b = Number(m[2]);
    const c = Number(m[3]);
    if (a > 8 || c <= b) return null;
    const x = (c - b) / a;
    return {
      kind: "tape",
      title: `A bar of ${c}: ${a === 1 ? "one x" : `${a} equal pieces of x`} and ${b}.`,
      reveals: false,
      rows: [{ parts: [...Array.from({ length: a }, () => ({ label: "x", size: x, kind: "unknown" as const })), { label: String(b), size: b, kind: "known" }], total: String(c) }],
    };
  }
  if ((m = p.match(/^Solve for x: (\d*)x = (\d+)$/))) {
    const a = Number(m[1] || 1);
    const c = Number(m[2]);
    if (a < 2 || a > 10) return null;
    return {
      kind: "tape",
      title: `A bar of ${c} cut into ${a} equal pieces, each one x.`,
      reveals: false,
      rows: [{ parts: Array.from({ length: a }, () => ({ label: "x", size: c / a, kind: "unknown" as const })), total: String(c) }],
    };
  }
  if ((m = p.match(/^Solve for x: x\/(\d+) = (\d+)$/))) {
    const a = Number(m[1]);
    const c = Number(m[2]);
    if (a < 2 || a > 10) return null;
    return {
      kind: "tape",
      title: `x cut into ${a} equal pieces, each ${c}.`,
      reveals: false,
      rows: [{ parts: Array.from({ length: a }, () => ({ label: String(c), size: c, kind: "known" as const })), total: "x" }],
    };
  }
  if ((m = p.match(/^Solve for x: (\d*)x - (\d+) = (\d+)$/))) {
    const a = Number(m[1] || 1);
    const b = Number(m[2]);
    const c = Number(m[3]);
    if (a > 8) return null;
    const x = (c + b) / a;
    return {
      kind: "tape",
      title: `${a === 1 ? "x" : `${a} pieces of x`}, with ${b} taken away, leaves ${c}.`,
      reveals: false,
      rows: [
        { parts: Array.from({ length: a }, () => ({ label: "x", size: x, kind: "unknown" as const })) },
        { parts: [{ label: String(c), size: c, kind: "known" }, { label: `${b} taken away`, size: b, kind: "taken" }] },
      ],
    };
  }
  if ((m = p.match(/^Solve for x: (\d*)x \+ (\d+) = (\d*)x \+ (\d+)$/))) {
    const a = Number(m[1] || 1);
    const b = Number(m[2]);
    const c = Number(m[3] || 1);
    const d = Number(m[4]);
    if (a <= c || a > 8 || d <= b) return null;
    const x = (d - b) / (a - c);
    return {
      kind: "tape",
      title: "Two bars of the same length. Take the same pieces off both and what is left still matches.",
      reveals: false,
      rows: [
        { parts: [...Array.from({ length: a }, () => ({ label: "x", size: x, kind: "unknown" as const })), { label: String(b), size: b, kind: "known" }] },
        { parts: [...Array.from({ length: c }, () => ({ label: "x", size: x, kind: "unknown" as const })), { label: String(d), size: d, kind: "known" }] },
      ],
    };
  }
  if ((m = p.match(/^Solve for x: (\d+)\(x \+ (\d+)\) = (\d+)$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    if (a > 6 || c <= a * b) return null;
    const x = c / a - b;
    return {
      kind: "tape",
      title: `${a} equal groups of x and ${b} make ${c}.`,
      reveals: false,
      rows: [{ parts: Array.from({ length: a }, () => [{ label: "x", size: x, kind: "unknown" as const }, { label: String(b), size: b, kind: "known" as const }]).flat(), total: String(c) }],
    };
  }
  // A video game, snacks and money left: how much at the start?
  if ((m = p.match(/bought a .+? for \$(\d+) and .+? for \$(\d+), and has \$(\d+) left/))) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return {
      kind: "tape",
      title: "Everything at the start is what was spent plus what is left.",
      reveals: false,
      rows: [{ parts: [{ label: `$${a}`, size: a, kind: "known" }, { label: `$${b}`, size: b, kind: "known" }, { label: `$${c} left`, size: c, kind: "known" }], total: "? at the start" }],
    };
  }
  if ((m = p.match(/^(\d+) friends split a .+? evenly\. Each of them paid \$(\d+)/))) {
    const k = Number(m[1]);
    const each = Number(m[2]);
    if (k > 12) return null;
    return {
      kind: "tape",
      title: `${k} equal shares of $${each}.`,
      reveals: false,
      rows: [{ parts: Array.from({ length: k }, () => ({ label: `$${each}`, size: each, kind: "known" as const })), total: "? the whole bill" }],
    };
  }
  // A fee to start plus a rate: "$40 sign-up fee plus $35 a month ... paid $320".
  if ((m = p.match(/\$(\d+) (?:sign-up fee|to start) plus \$(\d+) (?:a|for each) (month|mile)\b.*?\$(\d+)/))) {
    const [fee, rate, unit, total] = [Number(m[1]), Number(m[2]), m[3], Number(m[4])];
    if (total <= fee) return null;
    return {
      kind: "tape",
      title: `$${total} in all: the $${fee} to start, and $${rate} for each ${unit}.`,
      reveals: false,
      rows: [{ parts: [{ label: `$${fee}`, size: fee, kind: "known" }, { label: `$${rate} × ${unit}s`, size: total - fee, kind: "unknown" }], total: `$${total}` }],
    };
  }
  if ((m = p.match(/^The sum of three consecutive integers is (\d+)/))) {
    const s = Number(m[1]);
    const n = (s - 3) / 3;
    return {
      kind: "tape",
      title: "Three numbers in a row: n, one more, and two more.",
      reveals: false,
      rows: [{ parts: [{ label: "n", size: n, kind: "unknown" }, { label: "n + 1", size: n + 1, kind: "unknown" }, { label: "n + 2", size: n + 2, kind: "unknown" }], total: String(s) }],
    };
  }
  return null;
}

/** A rectangle problem: its sides as the problem names them, and its area or perimeter. */
function rectFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/rectangle's length is (\d+) (\w+) more than (twice )?its width\. Its (perimeter|area) is (\d+)/))) {
    const [k, unit, twice, what, total] = [m[1], m[2], !!m[3], m[4], m[5]];
    return {
      kind: "rect",
      title: `A rectangle w wide and ${twice ? "2w" : "w"} + ${k} long.`,
      reveals: false,
      width: `${twice ? "2w" : "w"} + ${k}`,
      height: "w",
      inside: `${what === "area" ? "Area" : "Perimeter"} = ${total} ${what === "area" ? `square ${unit}` : unit}`,
    };
  }
  if ((m = p.match(/rectangle has area (.+?) and width \((.+?)\)/))) {
    return { kind: "rect", title: "The rectangle, one side known.", reveals: false, width: "?", height: m[2], inside: `Area = ${m[1]}` };
  }
  if ((m = p.match(/A (?:garden|rectangle) is \((.+?)\) feet long and \((.+?)\) feet wide/))) {
    return { kind: "rect", title: "The garden as a rectangle.", reveals: false, width: m[1], height: m[2], inside: "Area = length × width" };
  }
  if ((m = p.match(/A rug is (\d+) feet long and (\d+) feet wide/))) {
    return { kind: "rect", title: "The rug, in feet.", reveals: false, width: `${m[1]} ft`, height: `${m[2]} ft`, inside: "1 yd = 3 ft along each side" };
  }
  return null;
}

/** "(x + 3)(x + 5)" as a box of four products, and "x² + 7x + 12" as one with the middle left to find. */
function areaFor(skillId: string, prompt: string): Picture | null {
  const p = plain(prompt).replace(/[²³]/g, (c) => `^${SUP[c]}`);
  const lin = String.raw`\((\d*)x ([+-]) (\d+)\)`;
  const m = p.match(new RegExp(String.raw`(?:Expand|multiplied out|feet long and)\D*?${lin}\s*(?:feet wide and\s*)?\(?(\d*)x ([+-]) (\d+)\)`));
  const two = p.match(new RegExp(`${lin}${lin}`)) ?? p.match(new RegExp(`${lin} feet long and ${lin} feet wide`));
  const square = p.match(/Expand \((\d*)x ([+-]) (\d+)\)\^2/);
  const term = (c: number, x: string) => (c === 1 ? x : c === -1 ? `-${x}` : `${c}${x}`);
  const sgn = (s: string, v: number) => (s === "-" ? -v : v);
  if (two || square || m) {
    let a1: number, b1: number, a2: number, b2: number;
    if (square) {
      a1 = a2 = Number(square[1] || 1);
      b1 = b2 = sgn(square[2], Number(square[3]));
    } else {
      const g = (two ?? m)!;
      a1 = Number(g[1] || 1);
      b1 = sgn(g[2], Number(g[3]));
      a2 = Number(g[4] || 1);
      b2 = sgn(g[5], Number(g[6]));
    }
    return {
      kind: "area",
      title: "Each part of one factor times each part of the other: four boxes, then add them up.",
      reveals: true,
      cols: [term(a2, "x"), String(b2)],
      rows: [term(a1, "x"), String(b1)],
      cells: [
        [term(a1 * a2, "x²"), term(a1 * b2, "x")],
        [term(b1 * a2, "x"), String(b1 * b2)],
      ],
    };
  }
  // Factoring: the corners are known, the sides are what is asked.
  const f = p.match(/^Factor (?:completely: )?(\d*)x\^2 ([+-]) (\d*)x ([+-]) (\d+)$/);
  if (f && (skillId === "factoring-trinomials" || skillId === "factoring-special")) {
    const a = Number(f[1] || 1);
    const c = sgn(f[4], Number(f[5]));
    const b = sgn(f[2], Number(f[3] || 1));
    return {
      kind: "area",
      title: `Find two sides whose four boxes are ${term(a, "x²")} and ${c} in the corners, and two x boxes that add to ${term(b, "x")}.`,
      reveals: false,
      cols: ["?", "?"],
      rows: ["?", "?"],
      cells: [
        [term(a, "x²"), null],
        [null, String(c)],
      ],
    };
  }
  return null;
}

/** x² + bx as a square and two strips, with the corner that completes it left open. */
function tilesFor(prompt: string): Picture | null {
  const p = plain(prompt).replace(/²/g, "^2");
  const m = p.match(/x\^2 ([+-]) (\d+)x/);
  if (!m) return null;
  const b = Number(m[2]);
  if (b % 2 !== 0 || b > 24) return null;
  const h = b / 2;
  const minus = m[1] === "-";
  return {
    kind: "area",
    title: minus
      ? `x² − ${b}x as a square and two strips of −${h}x. The missing corner, −${h} times −${h}, completes the square.`
      : `x² + ${b}x as a square and two strips of ${h}x. The missing corner, ${h} by ${h}, completes the square.`,
    reveals: false,
    cols: ["x", minus ? `-${h}` : String(h)],
    rows: ["x", minus ? `-${h}` : String(h)],
    cells: [
      ["x²", `${minus ? "-" : ""}${h}x`],
      [`${minus ? "-" : ""}${h}x`, null],
    ],
  };
}

/** The survey written out as a two-way table, totals left to fill in. */
function tableFor(prompt: string): Picture | null {
  const p = plain(prompt);
  const m = p.match(/asked (.+?) and (.+?) whether they (.+?) or (.+?)\. (\d+) of the .+? (?:[a-z ]+?) and (\d+) [^;]+; (\d+) of the .+? (?:[a-z ]+?) and (\d+) /i);
  if (!m) return null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const g1 = cap(m[1]);
  const g2 = cap(m[2]);
  const [a, b, c, d] = [m[5], m[6], m[7], m[8]].map(Number);
  // The column names: the two answers, cut to their verbs' objects where they are long.
  const short = (s: string) => cap(s.replace(/^(prefer|picked|read|walk to school|ride the bus)\s*/i, (w) => (/walk|ride/i.test(w) ? w : "")).trim() || s);
  return {
    kind: "table",
    title: "The survey as a table. Rows are the groups, columns the answers.",
    reveals: false,
    corner: "",
    cols: [short(m[3]), short(m[4]), "Total"],
    rows: [g1, g2, "Total"],
    cells: [
      [String(a), String(b), null],
      [String(c), String(d), null],
      [null, null, null],
    ],
  };
}

/** A data set as a dot plot. */
function dotsFor(prompt: string): Picture | null {
  const values =
    listAfter(prompt, /(?:median of|range \(IQR\) of|range of|For the data|The data set is|scores are)/) ??
    listAfter(prompt, /(?:data)/);
  if (!values || values.length < 3 || values.length > 16) return null;
  return { kind: "dots", title: `The ${values.length} values as dots on a number line.`, reveals: false, values };
}

/** A sequence's terms in a row, with the step between them. */
function termsFor(skillId: string, prompt: string): Picture | null {
  const p = plain(prompt);
  const m = p.match(/((?:-?\d+(?:\.\d+)?, ){2,}-?\d+(?:\.\d+)?)(?:, \.\.\.|,? \.\.\.)/);
  if (!m) return null;
  const vals = m[1].split(",").map((s) => Number(s.trim()));
  if (vals.length < 3 || vals.some((v) => !Number.isFinite(v))) return null;
  const geometric = skillId === "geometric-sequences";
  const asksStep = /common (difference|ratio)/i.test(p);
  const nth = p.match(/(\d+)(?:st|nd|rd|th) term/);
  const steps: (string | null)[] = vals.slice(1).map((v, i) => {
    if (asksStep) return null;
    if (geometric) {
      const r = v / vals[i];
      return Number.isFinite(r) ? `× ${fmt(r)}` : null;
    }
    const d = v - vals[i];
    return d >= 0 ? `+ ${fmt(d)}` : `− ${fmt(-d)}`;
  });
  const terms: { label: string; value: string | null }[] = vals.map((v, i) => ({ label: `term ${i + 1}`, value: fmt(v) }));
  if (nth) {
    const n = Number(nth[1]);
    if (n > vals.length) {
      if (n > vals.length + 1) {
        terms.push({ label: "...", value: "..." });
        steps.push(null);
      }
      terms.push({ label: `term ${n}`, value: null });
      steps.push(null);
    }
  }
  return {
    kind: "terms",
    title: asksStep ? "The terms in a row. What gets you from one to the next?" : "The terms in a row, and the step from each one to the next.",
    reveals: false,
    terms,
    steps,
  };
}

/** Growth or decay year by year, as bars. */
function barsFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  let start: number | null = null;
  let factor: number | null = null;
  let steps = 0;
  let label = "Year";
  let money = false;
  if ((m = p.match(/\$([\d,]+(?:\.\d+)?) (?:is )?invested at (\d+(?:\.\d+)?)% .*?(\d+) years/))) {
    start = toNum(m[1]);
    factor = 1 + Number(m[2]) / 100;
    steps = Number(m[3]);
    money = true;
  } else if ((m = p.match(/(?:worth|cost) \$([\d,]+) (?:depreciates|loses) (\d+)% .*?(\d+) years?/))) {
    start = toNum(m[1]);
    factor = 1 - Number(m[2]) / 100;
    steps = Number(m[3]);
    money = true;
  } else if ((m = p.match(/(?:worth|cost) \$([\d,]+) (?:loses|depreciates) (\d+)% of its value each year/))) {
    start = toNum(m[1]);
    factor = 1 - Number(m[2]) / 100;
    steps = 6;
    money = true;
  } else if ((m = p.match(/A town of ([\d,]+) people grows by (\d+(?:\.\d+)?)% each year\. .*?after (\d+) years/))) {
    start = toNum(m[1]);
    factor = 1 + Number(m[2]) / 100;
    steps = Number(m[3]);
  } else if ((m = p.match(/A colony of (\d+) bacteria doubles every (\d+) minutes\. .*?after (\d+) hours?/))) {
    start = Number(m[1]);
    factor = 2;
    steps = Math.round((Number(m[3]) * 60) / Number(m[2]));
    label = `${m[2]} min`;
  } else if ((m = p.match(/A (\d+) mg dose of medicine is half gone every (\d+) hours\. .*?after (\d+) hours/))) {
    start = Number(m[1]);
    factor = 0.5;
    steps = Math.round(Number(m[3]) / Number(m[2]));
    label = `${m[2]} h`;
  }
  if (start === null || factor === null || steps < 1 || steps > 10) return null;
  const values = Array.from({ length: steps + 1 }, (_, i) => start! * Math.pow(factor!, i));
  const labels = values.map((_, i) => (label === "Year" ? `Year ${i}` : i === 0 ? "Start" : `${i} × ${label}`));
  return {
    kind: "bars",
    title: `Each bar is the one before it times ${fmt(factor)}.`,
    reveals: true,
    labels,
    values,
    money,
  };
}

/** Known conversions, each unit to a bigger neighbor. */
const UNIT_LINKS: [string, string, number][] = [
  ["ms", "s", 1000],
  ["s", "min", 60],
  ["min", "h", 60],
  ["h", "day", 24],
  ["day", "week", 7],
  ["mm", "cm", 10],
  ["cm", "m", 100],
  ["m", "km", 1000],
  ["in", "ft", 12],
  ["ft", "yd", 3],
  ["ft", "mi", 5280],
  ["mg", "g", 1000],
  ["g", "kg", 1000],
  ["oz", "lb", 16],
  ["mL", "L", 1000],
];
const UNIT_NAMES: Record<string, string> = {
  milliseconds: "ms", millisecond: "ms", seconds: "s", second: "s", minutes: "min", minute: "min", hours: "h", hour: "h", days: "day", day: "day", weeks: "week", week: "week",
  millimeters: "mm", centimeters: "cm", meters: "m", kilometers: "km", inches: "in", feet: "ft", yards: "yd", miles: "mi",
  milligrams: "mg", grams: "g", kilograms: "kg", ounces: "oz", pounds: "lb", milliliters: "mL", liters: "L",
};

/** "7 days", "1 day": the two units that read as words take an s. */
function qty(n: string | number, unit: string): string {
  const plural = (unit === "day" || unit === "week") && Number(String(n).replace(/,/g, "")) !== 1;
  return `${typeof n === "number" ? n.toLocaleString("en-US") : n} ${unit}${plural ? "s" : ""}`;
}

/** The chain of factors from one unit to another, each one equal to 1. */
function conversionPath(from: string, to: string): { top: string; bottom: string }[] | null {
  const edges = new Map<string, { to: string; top: string; bottom: string }[]>();
  const add = (a: string, b: string, top: string, bottom: string) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a)!.push({ to: b, top, bottom });
  };
  for (const [small, big, k] of UNIT_LINKS) {
    add(big, small, qty(k, small), qty(1, big));
    add(small, big, qty(1, big), qty(k, small));
  }
  const queue: { at: string; path: { top: string; bottom: string }[] }[] = [{ at: from, path: [] }];
  const seen = new Set([from]);
  while (queue.length) {
    const { at, path } = queue.shift()!;
    if (at === to) return path;
    for (const e of edges.get(at) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      queue.push({ at: e.to, path: [...path, { top: e.top, bottom: e.bottom }] });
    }
  }
  return null;
}

function chainFor(prompt: string): Picture | null {
  const m = plain(prompt).match(/^Convert ([\d.,]+) (\w+) to (\w+)\./);
  if (!m) return null;
  const from = UNIT_NAMES[m[2]];
  const to = UNIT_NAMES[m[3]];
  if (!from || !to) return null;
  const path = conversionPath(from, to);
  if (!path || !path.length || path.length > 4) return null;
  return {
    kind: "chain",
    title: `${qty(m[1], from)} times factors that each equal 1. Each unit on top cancels the same unit underneath.`,
    reveals: false,
    start: qty(m[1], from),
    factors: path,
    result: `? ${to === "day" || to === "week" ? `${to}s` : to}`,
  };
}

/** The points a coordinate problem names, plotted, and nothing more. */
function pointsPicture(prompt: string, title: string, opts: { segment?: boolean; reveals?: boolean } = {}): Picture | null {
  const pts = pointsIn(prompt);
  if (!pts.length || pts.length > 4) return null;
  const letters = ["A", "B", "C", "D"];
  const points: PlanePoint[] = pts.map(([x, y], i) => ({ x, y, label: pts.length > 1 ? letters[i] : undefined, tone: 0 }));
  const segments: PlaneSegment[] = opts.segment && pts.length === 2 ? [{ from: pts[0], to: pts[1], tone: 0 }] : [];
  return plane(title, opts.reveals ?? false, { points, segments }, { xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]) });
}

/** Two points and the rise and run between them, as a slope triangle. */
function slopeFor(prompt: string): Picture | null {
  const pts = pointsIn(prompt);
  if (pts.length === 2) {
    const [[x1, y1], [x2, y2]] = pts;
    if (x1 === x2) return pointsPicture(prompt, "The two points, one straight above the other.", { segment: true });
    const segments: PlaneSegment[] = [
      { from: [x1, y1], to: [x2, y2], tone: 0 },
      { from: [x1, y1], to: [x2, y1], tone: 2, dashed: true, label: "run" },
      { from: [x2, y1], to: [x2, y2], tone: 2, dashed: true, label: "rise" },
    ];
    return plane("The two points, with the run across and the rise up between them.", false, { points: pts.map(([x, y], i) => ({ x, y, label: i ? "B" : "A", tone: 0 as Tone })), segments }, { xs: [x1, x2], ys: [y1, y2] });
  }
  // A point and a second one with an unknown coordinate: draw the first and the line the second sits on.
  const k = plain(prompt).match(/through \((-?\d+), (-?\d+)\) and \((-?\d+|k), (-?\d+|k)\)/);
  if (k) {
    const [x1, y1] = [Number(k[1]), Number(k[2])];
    const vlines: PlaneVLine[] = [];
    if (k[3] !== "k") vlines.push({ x: Number(k[3]), dashed: true, tone: 2, label: `x = ${k[3]}` });
    return plane("The known point, and where the second point has to be.", false, { points: [{ x: x1, y: y1, label: "A", tone: 0 }], vlines }, { xs: [x1, k[3] === "k" ? 0 : Number(k[3])], ys: [y1, k[4] === "k" ? 0 : Number(k[4])] });
  }
  // A table of points, or a story with two readings.
  const xsList = listAfter(prompt, /When x is/);
  const ysList = listAfter(prompt, /y is/);
  if (xsList && ysList && xsList.length === ysList.length && xsList.length >= 2) {
    return plane("The table's points.", false, { points: xsList.map((x, i) => ({ x, y: ysList[i], tone: 0 as Tone })) }, { xs: xsList, ys: ysList });
  }
  return null;
}

/** A piecewise function, each piece on its own stretch. */
function piecewiseFor(prompt: string): Picture | null {
  const body = plain(prompt).match(/\{(.+?)\}/);
  if (!body) return null;
  const pieces = body[1].split(";").map((s) => s.trim());
  const curves: PlaneCurve[] = [];
  const points: PlanePoint[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const piece of pieces) {
    const m = piece.match(/^(.+?) if (.+)$/);
    if (!m) return null;
    const expr = extractMath(`y = ${m[1]}`).chains[0]?.chain.exprs[1];
    if (!expr) return null;
    const f = (x: number) => evalSafe(expr, { x });
    const cond = m[2].replace(/\s+/g, " ");
    let from = -Infinity;
    let to = Infinity;
    let c: RegExpMatchArray | null;
    if ((c = cond.match(/^x (<|≤) (-?\d+)$/))) to = Number(c[2]);
    else if ((c = cond.match(/^x (>|≥) (-?\d+)$/))) from = Number(c[2]);
    else if ((c = cond.match(/^(-?\d+) (<|≤) x (<|≤) (-?\d+)$/))) {
      from = Number(c[1]);
      to = Number(c[4]);
    } else return null;
    curves.push({ f, tone: 0, from, to });
    for (const edge of [from, to]) {
      if (!Number.isFinite(edge)) continue;
      const closed = cond.includes("≤") || cond.includes("≥");
      const inclusiveHere = (edge === from && /(≥ -?\d+$)|(^-?\d+ ≤)/.test(cond)) || (edge === to && /(≤ -?\d+$)/.test(cond));
      points.push({ x: edge, y: f(edge), open: !(closed && inclusiveHere), tone: 0 });
      xs.push(edge);
      ys.push(f(edge));
    }
  }
  // The x it asks about, marked on the piece that rules there.
  const at = (x: number) => curves.find((cv) => x >= (cv.from ?? -Infinity) && x <= (cv.to ?? Infinity) && Number.isFinite(cv.f(x)));
  // The braces keep "f(x) = { ... }" from reading as a definition, so its calls are read here.
  const after = plain(prompt).slice(plain(prompt).indexOf("}") + 1);
  for (const m of after.matchAll(/\b[a-z]\((-?\d+(?:\.\d+)?)\)/g)) {
    const x = Number(m[1]);
    const piece = Number.isFinite(x) ? at(x) : undefined;
    if (piece) {
      points.push({ x, y: piece.f(x), tone: 2 });
      xs.push(x);
    }
  }
  // Fit x to the breaks and the asked points, then y to what the pieces do across that stretch.
  const x: [number, number] = niceRange([...xs, 0], 10);
  for (let k = 0; k <= 40; k++) {
    const vx = x[0] + ((x[1] - x[0]) * k) / 40;
    const piece = at(vx);
    if (piece) ys.push(piece.f(vx));
  }
  return { kind: "plane", title: "Each piece drawn only where its rule applies. An open dot is left out; a filled one is included.", reveals: true, x, y: niceRange(ys, 6), curves, vlines: [], points, segments: [] };
}

/** Two lines from a story: candles burning down, or two phone plans. */
function storyLinesFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/Candle A is (\d+) cm tall and burns down (\d+) cm an hour\. Candle B is (\d+) cm tall and burns down (\d+) cm an hour/))) {
    const [a, ra, b, rb] = m.slice(1, 5).map(Number);
    const fa = (x: number) => a - ra * x;
    const fb = (x: number) => b - rb * x;
    const meet = (a - b) / (ra - rb);
    return {
      kind: "plane",
      title: "Height over time for each candle. They are the same height where the lines cross.",
      reveals: true,
      x: [0, niceRange([meet * 1.6, a / ra], 4)[1]],
      y: [0, niceRange([a, b], 4)[1]],
      curves: [
        { f: fa, tone: 0, label: "Candle A", from: 0 },
        { f: fb, tone: 1, label: "Candle B", from: 0 },
      ],
      vlines: [],
      points: [{ x: meet, y: fa(meet), tone: 2 }],
      segments: [],
      axes: ["hours", "cm"],
    };
  }
  if ((m = p.match(/Plan A costs \$(\d+) a month plus \$(\d+) per GB.*?Plan B costs \$(\d+) a month plus \$(\d+) per GB/))) {
    const [a, ra, b, rb] = m.slice(1, 5).map(Number);
    const fa = (x: number) => a + ra * x;
    const fb = (x: number) => b + rb * x;
    const meet = (b - a) / (ra - rb);
    return {
      kind: "plane",
      title: "The monthly cost of each plan. They cost the same where the lines cross.",
      reveals: true,
      x: [0, niceRange([meet * 1.6], 4)[1]],
      y: [0, niceRange([fa(meet * 1.6), fb(meet * 1.6)], 4)[1]],
      curves: [
        { f: fa, tone: 0, label: "Plan A", from: 0 },
        { f: fb, tone: 1, label: "Plan B", from: 0 },
      ],
      vlines: [],
      points: [{ x: meet, y: fa(meet), tone: 2 }],
      segments: [],
      axes: ["GB", "$"],
    };
  }
  return null;
}

/** y = x² or y = |x| dashed, and the moved copy solid. */
function transformFor(prompt: string): Picture | null {
  const g = graphRelations(prompt, "", { marks: false });
  const parentAbs = /\|x\|/.test(prompt) && !/\|x [+−-]/.test(prompt.replace(/y = \|x\|/g, ""));
  const parent: PlaneCurve = { f: parentAbs || /y = \|x\|/.test(prompt) ? (x) => Math.abs(x) : (x) => x * x, tone: 1, dashed: true, label: /\|x\|/.test(prompt) ? "y = |x|" : "y = x²" };
  if (g && g.kind === "plane") {
    const moved = g.curves.filter((c) => !/^y = (\|x\||x\^?2|x²)$/.test((c.label ?? "").replace(/\s/g, " ")));
    if (!moved.length) return null;
    return { ...g, title: "The parent graph dashed, and the moved one solid.", reveals: true, curves: [parent, ...moved.map((c) => ({ ...c, tone: 0 as Tone }))] };
  }
  return null;
}

/** "Solve x² − 5x + 6 = 0": the parabola y = left side − right side, which crosses the x-axis at the roots. */
function parabolaOfEquation(prompt: string): Picture | null {
  const rels = relationsOf(prompt).filter((r) => r.op === "=");
  for (const r of rels) {
    const vars = new Set([...variablesOf(r.lhs), ...variablesOf(r.rhs)]);
    if (vars.size !== 1) continue;
    const v = [...vars][0];
    const f = (x: number) => evalSafe(r.lhs, { [v]: x }) - evalSafe(r.rhs, { [v]: x });
    // Quadratic: constant second differences.
    const d2 = [0, 1, 2].map((k) => f(k + 2) - 2 * f(k + 1) + f(k));
    if (!d2.every((d) => Number.isFinite(d) && Math.abs(d - d2[0]) < 1e-6) || Math.abs(d2[0]) < 1e-9) continue;
    const a = d2[0] / 2;
    const b = f(1) - f(0) - a;
    const vx = -b / (2 * a);
    const feat = features(f, vx - 30, vx + 30);
    const roots = feat.xs.filter((x) => Math.abs(f(x)) < 1e-3 * Math.max(1, Math.abs(f(vx)))).map(snap);
    const points: PlanePoint[] = roots.map((x) => ({ x, y: 0, tone: 2 as Tone }));
    return plane(
      "The parabola y = left side − right side. It crosses the x-axis at the solutions.",
      true,
      { curves: [{ f, tone: 0, label: `y = ${r.text.replace(/\s*=\s*0$/, "")}` }], points, axes: v === "x" ? undefined : [v, "y"] },
      { xs: [...roots, vx, 2 * vx], ys: [f(vx), f(0), ...(roots.length ? [0] : [])] }
    );
  }
  return null;
}

/** Every f(x) = ... in the prompt, graphed, with any f(3) it asks about marked. */
function graphDefs(prompt: string, title: string): Picture | null {
  const ex = extractMath(prompt);
  if (!ex.defs.length || ex.defs.length > 2) return null;
  const curves: PlaneCurve[] = [];
  const points: PlanePoint[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [i, d] of ex.defs.entries()) {
    const f = (x: number) => evalSafe(d.body, { [d.arg]: x });
    curves.push({ f, tone: (i % 2) as Tone, label: `${d.name}(${d.arg})` });
    const feat = features(f, -8, 8);
    xs.push(...feat.xs);
    ys.push(...feat.ys);
    for (const call of ex.calls.filter((c) => c.name === d.name)) {
      const x = evalSafe(call.arg);
      if (Number.isFinite(x) && Number.isFinite(f(x))) {
        points.push({ x, y: f(x), tone: 2 });
        xs.push(x);
        ys.push(f(x));
      }
    }
    // "from x = 0 to x = 2": the two ends of an average rate of change, and the line between them.
    const span = plain(prompt).match(/from [a-z] = (-?\d+) to [a-z] = (-?\d+)/);
    if (span && i === 0) {
      const [a, b] = [Number(span[1]), Number(span[2])];
      points.push({ x: a, y: f(a), tone: 2 }, { x: b, y: f(b), tone: 2 });
      xs.push(a, b);
      ys.push(f(a), f(b));
    }
  }
  const span = plain(prompt).match(/from [a-z] = (-?\d+) to [a-z] = (-?\d+)/);
  const segments: PlaneSegment[] = [];
  if (span && curves.length) {
    const f = curves[0].f;
    const [a, b] = [Number(span[1]), Number(span[2])];
    segments.push({ from: [a, f(a)], to: [b, f(b)], tone: 2, dashed: true });
  }
  const arg = ex.defs[0].arg;
  return plane(title, true, { curves, points, segments, axes: arg === "x" ? undefined : [arg, ex.defs[0].name] }, { xs: xs.length ? xs : [0], ys: ys.length ? ys : [0] });
}

/** "slope 3 and passes through (3, 2)", or "slope 3 and y-intercept −2": the line itself. */
function slopePointLine(prompt: string): Picture | null {
  const p = plain(prompt);
  const m = p.match(/slope (-?\d+(?:\/\d+)?)/);
  if (!m) return null;
  const [top, bottom] = m[1].split("/").map(Number);
  const slope = bottom ? top / bottom : top;
  const pts = pointsIn(p);
  const b = p.match(/y-intercept (-?\d+)/);
  let x0: number, y0: number;
  if (pts.length === 1) [x0, y0] = pts[0];
  else if (b) [x0, y0] = [0, Number(b[1])];
  else return null;
  const f = (x: number) => slope * (x - x0) + y0;
  return plane("The line with that slope through that point.", true, { curves: [{ f, tone: 0 }], points: [{ x: x0, y: y0, tone: 2 }] }, { xs: [x0, -f(0) / slope], ys: [y0, f(0)] });
}

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

const LINE_SKILLS = new Set([
  "graphing-lines",
  "intercepts",
  "slope-intercept",
  "point-slope",
  "standard-form",
  "parallel-perpendicular",
  "graphing-systems",
  "substitution",
  "elimination",
  "graphing-inequalities",
  "systems-inequalities",
  "function-graphs",
  "trend-lines",
  "exponential-functions",
  "graphing-parabolas",
  "solving-by-factoring",
  "quadratic-formula",
]);

function build(skillId: string, prompt: string): Picture | null {
  switch (skillId) {
    case "unit-basics":
    case "dimensional-analysis":
      return chainFor(prompt) ?? rectFor(prompt);
    case "one-step-equations":
    case "two-step-equations":
    case "multi-step-equations":
      return tapeFor(prompt) ?? rectFor(prompt) ?? storyLinesFor(prompt);
    case "linear-inequalities":
    case "compound-inequalities":
    case "absolute-value-inequalities":
      return numberLineOf(prompt, "The numbers that make it true, on a number line.");
    case "absolute-value": {
      const nl = numberLineOf(prompt, "Absolute value is distance: both answers sit the same distance from the center.");
      if (nl && nl.kind === "numberline" && nl.marks.length === 2) {
        const [a, b] = nl.marks.map((mk) => mk.x).sort((u, v) => u - v);
        const c = (a + b) / 2;
        nl.marks.push({ x: c, label: fmt(c), tone: 1 });
        nl.arcs.push({ from: c, to: a, label: fmt(c - a) }, { from: c, to: b, label: fmt(b - c) });
      }
      return nl;
    }
    case "coordinate-plane": {
      if (/quadrant|y-coordinate|x-coordinate/i.test(prompt)) return pointsPicture(prompt, "The point on the grid.", { reveals: true });
      if (/How far apart|midpoint/i.test(prompt)) return pointsPicture(prompt, "The two points, joined.", { segment: true });
      if (/^Start at/i.test(prompt)) return pointsPicture(prompt, "Where you start.");
      if (/Reflect/i.test(prompt)) return pointsPicture(prompt, "The point before it is reflected.");
      return pointsPicture(prompt, "The points on the grid.");
    }
    case "slope":
      return slopeFor(prompt);
    case "graphing-systems":
      return storyLinesFor(prompt) ?? graphRelations(prompt);
    case "function-graphs":
      return graphDefs(prompt, "The function, with the two points the rate of change runs between.") ?? graphRelations(prompt, "The graph.");
    case "exponential-functions":
      return graphDefs(prompt, "The exponential function.") ?? graphRelations(prompt, "The exponential function.");
    case "solving-by-factoring":
    case "quadratic-formula":
      return parabolaOfEquation(prompt) ?? graphRelations(prompt, "The parabola.") ?? rectFor(prompt);
    case "slope-intercept":
    case "point-slope":
    case "parallel-perpendicular":
      return graphRelations(prompt) ?? slopePointLine(prompt);
    case "function-notation":
    case "domain-range": {
      const defs = extractMath(prompt).defs;
      if (defs.length === 1) {
        const d = defs[0];
        const f = (x: number) => evalSafe(d.body, { [d.arg]: x });
        const range = plain(prompt).match(/for (-?\d+) ≤ x ≤ (-?\d+)/);
        const from = range ? Number(range[1]) : undefined;
        const to = range ? Number(range[2]) : undefined;
        const feat = features(f, from ?? -30, to ?? 30);
        const curve: PlaneCurve = { f, tone: 0, from, to };
        const points: PlanePoint[] = [];
        for (const call of extractMath(prompt).calls) {
          const x = evalSafe(call.arg);
          if (Number.isFinite(x)) points.push({ x, y: f(x), tone: 2 });
        }
        const discrete = plain(prompt).match(/domain \{(.+?)\}/);
        if (discrete) {
          const xs = discrete[1].split(",").map((s) => Number(s.trim()));
          return plane("The function's points at each x in its domain.", true, { points: xs.map((x) => ({ x, y: f(x), tone: 0 as Tone })) }, { xs, ys: xs.map(f) });
        }
        const vlines: PlaneVLine[] = feat.poles.map((x) => ({ x, tone: 1 as Tone, dashed: true, label: `x = ${fmt(x)}` }));
        for (const e of feat.edges) if (Number.isFinite(f(e))) points.push({ x: e, y: f(e), tone: 0 });
        if (from !== undefined && to !== undefined) points.push({ x: from, y: f(from), tone: 0 }, { x: to, y: f(to), tone: 0 });
        const title = feat.poles.length
          ? `The graph of ${d.name}(${d.arg}). It breaks at the dashed line${feat.poles.length > 1 ? "s" : ""}, where it is undefined.`
          : `The graph of ${d.name}(${d.arg}).`;
        return plane(title, true, { curves: [curve], points, vlines }, { xs: [...feat.xs, ...points.map((pt) => pt.x), from ?? 0, to ?? 0], ys: [...feat.ys, ...points.map((pt) => pt.y), ...(from !== undefined && to !== undefined ? [f(from), f(to)] : [])] });
      }
      return null;
    }
    case "piecewise-functions":
      return piecewiseFor(prompt);
    case "arithmetic-sequences":
    case "geometric-sequences":
      return termsFor(skillId, prompt);
    case "exponential-growth":
    case "exponential-decay":
      return barsFor(prompt);
    case "multiplying-binomials":
    case "special-products":
    case "factoring-trinomials":
    case "factoring-special":
      return areaFor(skillId, prompt) ?? rectFor(prompt);
    case "completing-square":
      return /Complete the square|Write x|vertex form/i.test(prompt) ? tilesFor(prompt) : graphRelations(prompt, "The parabola.") ?? parabolaOfEquation(prompt) ?? tilesFor(prompt);
    case "center-spread":
      return dotsFor(prompt);
    case "two-way-tables":
      return tableFor(prompt);
    case "function-transformations":
      return transformFor(prompt);
    case "linear-vs-exponential": {
      const xs = listAfter(prompt, /When x is/);
      const ys = listAfter(prompt, /y is/);
      if (xs && ys && xs.length === ys.length) return plane("The table's points.", false, { points: xs.map((x, i) => ({ x, y: ys[i], tone: 0 as Tone })) }, { xs, ys });
      return null;
    }
    default:
      if (LINE_SKILLS.has(skillId)) {
        const solving = /solving-by-factoring|quadratic-formula/.test(skillId);
        return graphRelations(prompt, solving ? "The parabola. Its roots are where it crosses the x-axis." : undefined) ?? rectFor(prompt);
      }
      return null;
  }
}

/** A picture for a problem, or null when there is none to draw. */
export function pictureFor(skillId: string, prompt: string): Picture | null {
  try {
    const pic = build(skillId, prompt);
    if (!pic) return null;
    if (pic.kind === "plane") {
      const ok = [...pic.x, ...pic.y].every(Number.isFinite) && pic.x[1] > pic.x[0] && pic.y[1] > pic.y[0];
      if (!ok || (!pic.curves.length && !pic.points.length && !pic.vlines.length)) return null;
    }
    if (pic.kind === "numberline" && !(pic.max > pic.min)) return null;
    return pic;
  } catch {
    return null;
  }
}
