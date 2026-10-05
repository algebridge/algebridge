import type { ReactNode } from "react";
import { fmt, niceRange, pretty, type NumberLineArc, type NumberLineMark, type NumberLineSpan, type Picture, type PlaneCurve, type Tone } from "@/lib/pictures";

/**
 * Draws a picture from lib/pictures.ts. Graphs, number lines, bar models,
 * dot plots, rectangles and growth bars are SVG; the area model, the table,
 * the row of terms and the conversion chain are HTML, which keeps their text
 * crisp and lets it wrap on a phone.
 *
 * Three inks: the problem's own line in the app's blue, a second line in
 * orange, and the points that matter (an intersection, an intercept) in
 * green. Everything else is the gray of graph paper.
 */

const INK: Record<Tone, string> = { 0: "#2563eb", 1: "#ea580c", 2: "#059669" };
const TINT: Record<Tone, string> = { 0: "rgba(37, 99, 235, 0.13)", 1: "rgba(234, 88, 12, 0.12)", 2: "rgba(5, 150, 105, 0.12)" };
const GRID = "#e2e8f0";
const AXIS = "#64748b";
const TEXT = "#334155";
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function tickStep(span: number): number {
  const target = span / 10;
  for (const s of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]) if (s >= target) return s;
  return Math.pow(10, Math.ceil(Math.log10(target)));
}

function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** A curve as path data, broken wherever it leaves the plane by a long way or is undefined (an asymptote). */
function curvePath(c: PlaneCurve, x0: number, x1: number, y0: number, y1: number, sx: (x: number) => number, sy: (y: number) => number): string {
  const from = Math.max(x0, c.from ?? -Infinity);
  const to = Math.min(x1, c.to ?? Infinity);
  if (!(to > from)) return "";
  const n = 260;
  const span = y1 - y0;
  let d = "";
  let pen = false;
  let prevY = NaN;
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    const y = c.f(x);
    const ok = Number.isFinite(y) && y > y0 - span * 3 && y < y1 + span * 3;
    const jump = Number.isFinite(prevY) && Math.abs(y - prevY) > span * 1.5;
    if (!ok || jump) {
      pen = false;
      prevY = ok ? y : NaN;
      if (!ok) continue;
    }
    d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
    pen = true;
    prevY = y;
  }
  return d;
}

function Plane({ p }: { p: Extract<Picture, { kind: "plane" }> }) {
  const W = 340;
  const H = 300;
  const L = 34;
  const R = 12;
  const T = 12;
  const B = 28;
  const [x0, x1] = p.x;
  const [y0, y1] = p.y;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const gx = tickStep(x1 - x0);
  const gy = tickStep(y1 - y0);
  // Labels on every other grid line once the grid is dense.
  const lx = (x1 - x0) / gx > 12 ? gx * 2 : gx;
  const ly = (y1 - y0) / gy > 12 ? gy * 2 : gy;
  const axisY = y0 <= 0 && y1 >= 0 ? sy(0) : sy(y0);
  const axisX = x0 <= 0 && x1 >= 0 ? sx(0) : sx(x0);
  const clip = `plot-${Math.round(x0 * 7 + x1 * 13 + y0 * 17 + y1 * 19)}`;
  const legend = p.curves.filter((c) => c.label).length + p.vlines.filter((v) => v.label).length > 1;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[420px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
        <defs>
          <clipPath id={clip}>
            <rect x={L} y={T} width={W - L - R} height={H - T - B} />
          </clipPath>
        </defs>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#ffffff" />
        <g stroke={GRID} strokeWidth="1">
          {ticks(x0, x1, gx).map((x) => (
            <line key={`gx${x}`} x1={sx(x)} y1={T} x2={sx(x)} y2={H - B} />
          ))}
          {ticks(y0, y1, gy).map((y) => (
            <line key={`gy${y}`} x1={L} y1={sy(y)} x2={W - R} y2={sy(y)} />
          ))}
        </g>
        <g stroke={AXIS} strokeWidth="1.4">
          <line x1={L} y1={axisY} x2={W - R} y2={axisY} />
          <line x1={axisX} y1={T} x2={axisX} y2={H - B} />
        </g>
        <g fontSize="10" fill={AXIS}>
          {ticks(x0, x1, lx)
            .filter((x) => x !== 0)
            .map((x) => (
              <text key={`lx${x}`} x={sx(x)} y={Math.min(H - B, axisY) + 13} textAnchor="middle">
                {fmt(x)}
              </text>
            ))}
          {ticks(y0, y1, ly)
            .filter((y) => y !== 0)
            .map((y) => (
              <text key={`ly${y}`} x={Math.max(L, axisX) - 4} y={sy(y) + 3.5} textAnchor="end">
                {fmt(y)}
              </text>
            ))}
          {p.axes && (
            <>
              <text x={W - R} y={axisY - 5} textAnchor="end" fontStyle="italic" fill={TEXT}>
                {p.axes[0]}
              </text>
              <text x={axisX + 5} y={T + 10} fontStyle="italic" fill={TEXT}>
                {p.axes[1]}
              </text>
            </>
          )}
        </g>
        <g clipPath={`url(#${clip})`}>
          {p.curves.map((c, i) => {
            if (!c.shade) return null;
            const line = curvePath(c, x0, x1, y0, y1, sx, sy);
            if (!line) return null;
            const edge = c.shade === "above" ? T - 400 : H + 400;
            const startX = sx(Math.max(x0, c.from ?? -Infinity));
            const endX = sx(Math.min(x1, c.to ?? Infinity));
            return <path key={`s${i}`} d={`${line}L${endX} ${edge}L${startX} ${edge}Z`} fill={TINT[c.tone ?? 0]} />;
          })}
          {p.vlines.map((v, i) =>
            v.shade ? (
              <rect
                key={`vs${i}`}
                x={v.shade === "right" ? sx(v.x) : L}
                y={T}
                width={v.shade === "right" ? W - R - sx(v.x) : sx(v.x) - L}
                height={H - T - B}
                fill={TINT[v.tone ?? 0]}
              />
            ) : null
          )}
          {p.curves.map((c, i) => (
            <path
              key={`c${i}`}
              d={curvePath(c, x0, x1, y0, y1, sx, sy)}
              fill="none"
              stroke={INK[c.tone ?? 0]}
              strokeWidth="2.4"
              strokeDasharray={c.dashed ? "7 5" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {p.vlines.map((v, i) => (
            <line key={`v${i}`} x1={sx(v.x)} y1={T} x2={sx(v.x)} y2={H - B} stroke={INK[v.tone ?? 0]} strokeWidth="2.2" strokeDasharray={v.dashed ? "7 5" : undefined} />
          ))}
          {p.segments.map((sg, i) => (
            <g key={`g${i}`}>
              <line
                x1={sx(sg.from[0])}
                y1={sy(sg.from[1])}
                x2={sx(sg.to[0])}
                y2={sy(sg.to[1])}
                stroke={INK[sg.tone ?? 0]}
                strokeWidth={sg.dashed ? 1.8 : 2.4}
                strokeDasharray={sg.dashed ? "5 4" : undefined}
              />
              {sg.label && (
                <text
                  x={(sx(sg.from[0]) + sx(sg.to[0])) / 2 + (sg.from[1] === sg.to[1] ? 0 : 8)}
                  y={(sy(sg.from[1]) + sy(sg.to[1])) / 2 + (sg.from[1] === sg.to[1] ? 15 : 4)}
                  fontSize="11"
                  fontWeight="600"
                  fill={INK[sg.tone ?? 0]}
                  textAnchor={sg.from[1] === sg.to[1] ? "middle" : "start"}
                >
                  {sg.label}
                </text>
              )}
            </g>
          ))}
          {p.points.map((pt, i) => (
            <g key={`p${i}`}>
              <circle cx={sx(pt.x)} cy={sy(pt.y)} r="4.6" fill={pt.open ? "#ffffff" : INK[pt.tone ?? 0]} stroke={INK[pt.tone ?? 0]} strokeWidth="2" />
              {pt.label && (
                <text x={sx(pt.x) + 7} y={sy(pt.y) - 7} fontSize="11" fontWeight="700" fill={TEXT}>
                  {pt.label}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
      {legend && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-700">
          {[...p.curves, ...p.vlines]
            .filter((c) => c.label)
            .map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <svg width="22" height="8" aria-hidden>
                  <line x1="1" y1="4" x2="21" y2="4" stroke={INK[c.tone ?? 0]} strokeWidth="2.6" strokeDasharray={c.dashed ? "5 3" : undefined} />
                </svg>
                <span className="font-medium tabular-nums">{pretty(c.label ?? "")}</span>
              </span>
            ))}
        </figcaption>
      )}
    </figure>
  );
}

function NumberLine({ min, max, marks, spans, arcs, title }: { min: number; max: number; marks: NumberLineMark[]; spans: NumberLineSpan[]; arcs: NumberLineArc[]; title: string }) {
  const W = 340;
  const H = arcs.length ? 110 : 80;
  const PAD = 18;
  const Y = H - 34;
  const sx = (x: number) => PAD + ((x - min) / (max - min)) * (W - 2 * PAD);
  const step = tickStep(max - min);
  const all = ticks(min, max, step);
  const labelEvery = all.length > 14 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[460px]" role="img" aria-label={title} style={{ fontFamily: FONT }}>
      <defs>
        <marker id="nl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10Z" fill={AXIS} />
        </marker>
        <marker id="nl-ray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10Z" fill={INK[0]} />
        </marker>
      </defs>
      <line x1={PAD - 12} y1={Y} x2={W - PAD + 12} y2={Y} stroke={AXIS} strokeWidth="1.4" markerStart="url(#nl-arrow)" markerEnd="url(#nl-arrow)" />
      {all.map((t, i) => (
        <g key={t}>
          <line x1={sx(t)} y1={Y - 5} x2={sx(t)} y2={Y + 5} stroke={AXIS} strokeWidth="1" />
          {i % labelEvery === 0 && (
            <text x={sx(t)} y={Y + 19} fontSize="10" fill={AXIS} textAnchor="middle">
              {fmt(t)}
            </text>
          )}
        </g>
      ))}
      {spans.map((s, i) => {
        const a = Math.max(min, s.from);
        const b = Math.min(max, s.to);
        const left = !Number.isFinite(s.from);
        const right = !Number.isFinite(s.to);
        return (
          <line
            key={i}
            x1={left ? sx(a) - 10 : sx(a)}
            y1={Y}
            x2={right ? sx(b) + 10 : sx(b)}
            y2={Y}
            stroke={INK[s.tone ?? 0]}
            strokeWidth="5"
            strokeLinecap="round"
            markerStart={left ? "url(#nl-ray)" : undefined}
            markerEnd={right ? "url(#nl-ray)" : undefined}
          />
        );
      })}
      {arcs.map((a, i) => {
        const x1 = sx(a.from);
        const x2 = sx(a.to);
        const mid = (x1 + x2) / 2;
        const lift = Math.min(36, Math.abs(x2 - x1) * 0.5 + 8);
        return (
          <g key={i}>
            <path d={`M${x1} ${Y - 8} Q${mid} ${Y - 8 - lift * 1.6} ${x2} ${Y - 8}`} fill="none" stroke={INK[2]} strokeWidth="1.6" strokeDasharray="4 3" />
            <text x={mid} y={Y - 12 - lift * 0.8} fontSize="11" fontWeight="700" fill={INK[2]} textAnchor="middle">
              {a.label}
            </text>
          </g>
        );
      })}
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={sx(m.x)} cy={Y} r="5.5" fill={m.open ? "#ffffff" : INK[m.tone ?? 0]} stroke={INK[m.tone ?? 0]} strokeWidth="2.2" />
          {m.label !== undefined && (
            <text x={sx(m.x)} y={Y - 12} fontSize="11" fontWeight="700" fill={INK[m.tone ?? 0]} textAnchor="middle">
              {m.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Tape({ p }: { p: Extract<Picture, { kind: "tape" }> }) {
  const W = 340;
  const PAD = 6;
  const ROW = 38;
  const GAP = p.rows.some((r) => r.total) ? 40 : 14;
  const longest = Math.max(...p.rows.map((r) => r.parts.reduce((n, part) => n + Math.max(part.size, 0), 0)));
  const scale = (W - 2 * PAD) / (longest || 1);
  const H = p.rows.length * (ROW + GAP) + 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[460px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
      <defs>
        <pattern id="tape-taken" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" strokeWidth="2" />
        </pattern>
      </defs>
      {p.rows.map((row, r) => {
        const y = 2 + r * (ROW + GAP);
        let x = PAD;
        const total = row.parts.reduce((n, part) => n + Math.max(part.size, 0), 0) * scale;
        return (
          <g key={r}>
            {row.parts.map((part, i) => {
              const w = Math.max(part.size, 0) * scale;
              const at = x;
              x += w;
              const fill = part.kind === "unknown" ? "rgba(37, 99, 235, 0.1)" : part.kind === "taken" ? "url(#tape-taken)" : "#f1f5f9";
              const stroke = part.kind === "unknown" ? INK[0] : "#94a3b8";
              const small = w < 28;
              return (
                <g key={i}>
                  <rect x={at} y={y} width={w} height={ROW} fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray={part.kind === "taken" ? "4 3" : undefined} rx="3" />
                  <text
                    x={at + w / 2}
                    y={y + ROW / 2 + 4.5}
                    fontSize={small ? 10 : 13}
                    fontWeight="700"
                    fontStyle={part.kind === "unknown" && /^[a-z]$/.test(part.label) ? "italic" : undefined}
                    fill={part.kind === "unknown" ? INK[0] : TEXT}
                    textAnchor="middle"
                  >
                    {part.label}
                  </text>
                </g>
              );
            })}
            {row.total && (
              <g>
                <path
                  d={`M${PAD} ${y + ROW + 6} q0 7 7 7 H${PAD + total / 2 - 6} q6 0 6 6 q0 -6 6 -6 H${PAD + total - 7} q7 0 7 -7`}
                  fill="none"
                  stroke={AXIS}
                  strokeWidth="1.4"
                />
                <text x={PAD + total / 2} y={y + ROW + 33} fontSize="13" fontWeight="700" fill={TEXT} textAnchor="middle">
                  {row.total}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Missing() {
  return <span className="font-bold text-bridge-700">?</span>;
}

/** A typed minus as the printed one. */
const minus = (s: string) => s.replace(/-/g, "−");

function AreaModel({ p }: { p: Extract<Picture, { kind: "area" }> }) {
  return (
    <div className="inline-grid gap-1 text-[15px]" style={{ gridTemplateColumns: `auto repeat(${p.cols.length}, minmax(3.5rem, auto))` }} role="table" aria-label={p.title}>
      <span role="columnheader" />
      {p.cols.map((c, i) => (
        <span key={`c${i}`} role="columnheader" className="px-2 pb-1 text-center font-semibold italic text-slate-600">
          {c === "?" ? <Missing /> : minus(c)}
        </span>
      ))}
      {p.rows.map((r, i) => (
        <div key={`r${i}`} role="row" className="contents">
          <span role="rowheader" className="flex items-center justify-end pr-2 font-semibold italic text-slate-600">
            {r === "?" ? <Missing /> : minus(r)}
          </span>
          {p.cells[i].map((cell, j) => (
            <span
              key={j}
              role="cell"
              className={`flex min-h-[3.25rem] items-center justify-center rounded-lg border px-3 font-semibold tabular-nums ${
                cell === null ? "border-dashed border-bridge-300 bg-white" : i === 0 && j === 0 ? "border-bridge-200 bg-bridge-50 text-bridge-900" : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {cell === null ? <Missing /> : minus(cell)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Table({ p }: { p: Extract<Picture, { kind: "table" }> }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse text-[14px]" aria-label={p.title}>
        <thead>
          <tr>
            <th className="p-2" />
            {p.cols.map((c) => (
              <th key={c} scope="col" className="border-b-2 border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={r} className={i === p.rows.length - 1 ? "border-t-2 border-slate-300" : ""}>
              <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-700">
                {r}
              </th>
              {p.cells[i].map((cell, j) => (
                <td key={j} className={`border border-slate-200 px-4 py-2 text-center tabular-nums ${cell === null ? "bg-white" : "bg-slate-50 font-semibold text-slate-900"}`}>
                  {cell === null ? <Missing /> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dots({ p }: { p: Extract<Picture, { kind: "dots" }> }) {
  const W = 340;
  const [min, max] = niceRange(p.values, 4);
  const PAD = 16;
  const sx = (x: number) => PAD + ((x - min) / (max - min)) * (W - 2 * PAD);
  const counts = new Map<number, number>();
  const stacks = p.values.map((v) => {
    const k = (counts.get(v) ?? 0) + 1;
    counts.set(v, k);
    return k;
  });
  const tallest = Math.max(...counts.values());
  const Y = 26 + tallest * 15;
  const H = Y + 30;
  const step = tickStep(max - min);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[460px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
      <line x1={PAD - 6} y1={Y} x2={W - PAD + 6} y2={Y} stroke={AXIS} strokeWidth="1.4" />
      {ticks(min, max, step).map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={Y - 4} x2={sx(t)} y2={Y + 4} stroke={AXIS} />
          <text x={sx(t)} y={Y + 18} fontSize="10" fill={AXIS} textAnchor="middle">
            {fmt(t)}
          </text>
        </g>
      ))}
      {p.values.map((v, i) => (
        <circle key={i} cx={sx(v)} cy={Y - 8 - (stacks[i] - 1) * 15} r="6" fill={INK[0]} fillOpacity="0.85" />
      ))}
    </svg>
  );
}

function Terms({ p }: { p: Extract<Picture, { kind: "terms" }> }) {
  const items: ReactNode[] = [];
  p.terms.forEach((t, i) => {
    if (i > 0) {
      const step = p.steps[i - 1];
      items.push(
        <span key={`s${i}`} className="flex flex-col items-center px-0.5 text-[12px] font-semibold text-emerald-700">
          <span className="min-h-[1rem]">{step ?? (t.value === "..." ? "" : "?")}</span>
          <svg width="26" height="10" aria-hidden>
            <path d="M1 5h21M17 1l5 4-5 4" fill="none" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    }
    items.push(
      <span key={`t${i}`} className="flex flex-col items-center">
        <span
          className={`flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg border px-2 text-[15px] font-bold tabular-nums ${
            t.value === null ? "border-dashed border-bridge-300 bg-white" : t.value === "..." ? "border-transparent text-slate-400" : "border-slate-200 bg-slate-50 text-slate-900"
          }`}
        >
          {t.value === null ? <Missing /> : t.value}
        </span>
        <span className="mt-1 text-[11px] text-slate-500">{t.value === "..." ? "" : t.label}</span>
      </span>
    );
  });
  return (
    <div className="flex flex-wrap items-start gap-y-2" role="img" aria-label={p.title}>
      {items}
    </div>
  );
}

function Rect({ p }: { p: Extract<Picture, { kind: "rect" }> }) {
  const W = 340;
  const H = 200;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[400px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
      <rect x="70" y="34" width="230" height="130" rx="4" fill="rgba(37, 99, 235, 0.08)" stroke={INK[0]} strokeWidth="2.2" />
      <text x="185" y="24" fontSize="14" fontWeight="700" fill={INK[0]} textAnchor="middle" fontStyle="italic">
        {p.width}
      </text>
      <text x="60" y="104" fontSize="14" fontWeight="700" fill={INK[0]} textAnchor="end" fontStyle="italic">
        {p.height}
      </text>
      <text x="185" y="104" fontSize="13" fontWeight="600" fill={TEXT} textAnchor="middle">
        {p.inside}
      </text>
    </svg>
  );
}

/** "60 min": the number, and the unit, which is struck through when it cancels. */
function Quantity({ text, struck }: { text: string; struck: boolean }) {
  const m = text.match(/^([\d.,?]+)\s*(.*)$/);
  const [n, u] = m ? [m[1], m[2]] : [text, ""];
  return (
    <span className="whitespace-nowrap tabular-nums">
      {n}{" "}
      <span className={struck ? "text-slate-400 line-through decoration-rose-500 decoration-2" : "font-semibold text-bridge-700"}>{u}</span>
    </span>
  );
}

function Chain({ p }: { p: Extract<Picture, { kind: "chain" }> }) {
  const unit = (s: string) => s.replace(/^[\d.,?]+\s*/, "").replace(/^(day|week)s$/, "$1");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-[15px] text-slate-800" role="img" aria-label={p.title}>
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <Quantity text={p.start} struck />
      </span>
      {p.factors.map((f, i) => (
        <span key={i} className="flex items-center gap-2">
          <span aria-hidden className="text-slate-400">
            ×
          </span>
          <span className="inline-flex flex-col items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1">
            <Quantity text={f.top} struck={i < p.factors.length - 1 || unit(f.top) !== unit(p.result)} />
            <span className="my-0.5 h-px w-full bg-slate-400" />
            <Quantity text={f.bottom} struck />
          </span>
        </span>
      ))}
      <span aria-hidden className="text-slate-400">
        =
      </span>
      <span className="rounded-lg border border-dashed border-bridge-300 bg-white px-2.5 py-1.5">
        <Quantity text={p.result} struck={false} />
      </span>
    </div>
  );
}

function Bars({ p }: { p: Extract<Picture, { kind: "bars" }> }) {
  const W = 340;
  const H = 210;
  const L = 8;
  const B = 34;
  const T = 26;
  const top = Math.max(...p.values) * 1.08;
  const n = p.values.length;
  const slot = (W - 2 * L) / n;
  const bw = Math.min(34, slot * 0.66);
  const label = (v: number) => (p.money ? `$${fmt(v)}` : fmt(v));
  const compact = n > 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[460px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
      <line x1={L} y1={H - B} x2={W - L} y2={H - B} stroke={AXIS} strokeWidth="1.4" />
      {p.values.map((v, i) => {
        const h = (v / top) * (H - B - T);
        const x = L + slot * i + (slot - bw) / 2;
        return (
          <g key={i}>
            <rect x={x} y={H - B - h} width={bw} height={h} rx="3" fill={i === n - 1 ? INK[2] : INK[0]} fillOpacity={i === n - 1 ? 0.85 : 0.7} />
            <text
              x={x + bw / 2}
              y={H - B - h - 5}
              fontSize={compact ? 8.5 : 10}
              fontWeight="600"
              fill={TEXT}
              textAnchor="middle"
              transform={compact ? `rotate(-35 ${x + bw / 2} ${H - B - h - 5})` : undefined}
            >
              {label(v)}
            </text>
            <text x={x + bw / 2} y={H - B + 14} fontSize="10" fill={AXIS} textAnchor="middle">
              {p.labels[i].replace(/^Year /, "")}
            </text>
          </g>
        );
      })}
      {p.labels[0]?.startsWith("Year") && (
        <text x={W / 2} y={H - 4} fontSize="10" fill={AXIS} textAnchor="middle">
          years
        </text>
      )}
    </svg>
  );
}

export function ProblemPicture({ picture }: { picture: Picture }) {
  let body: ReactNode;
  switch (picture.kind) {
    case "plane":
      body = <Plane p={picture} />;
      break;
    case "numberline":
      body = <NumberLine {...picture} />;
      break;
    case "tape":
      body = <Tape p={picture} />;
      break;
    case "area":
      body = <AreaModel p={picture} />;
      break;
    case "table":
      body = <Table p={picture} />;
      break;
    case "dots":
      body = <Dots p={picture} />;
      break;
    case "terms":
      body = <Terms p={picture} />;
      break;
    case "rect":
      body = <Rect p={picture} />;
      break;
    case "chain":
      body = <Chain p={picture} />;
      break;
    case "bars":
      body = <Bars p={picture} />;
      break;
  }
  return (
    <div className="space-y-2">
      {body}
      <p className="text-[13px] leading-snug text-slate-600">{picture.title}</p>
    </div>
  );
}
