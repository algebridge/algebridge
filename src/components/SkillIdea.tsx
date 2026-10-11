"use client";

import type { Curve, Pan, Picture, SkillIdea as Idea } from "@/data/skill-ideas/types";

/**
 * "Get the idea": what a skill means, before any steps. The idea in plain
 * words, a picture of it, where it shows up in real life, and why the
 * method works. Pictures are drawn from data (data/skill-ideas), so each
 * one is the real thing: the balance balances, the line goes through its
 * points.
 */
export function SkillIdea({ idea }: { idea: Idea }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <p className="px-5 pt-5 text-[17px] leading-relaxed text-slate-800 sm:px-6 sm:pt-6">{idea.idea}</p>
      <figure className="mx-5 mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100 sm:mx-6">
        <div className="mx-auto max-w-md">
          <IdeaPicture picture={idea.picture} />
        </div>
        <figcaption className="mx-auto mt-2 max-w-lg text-center text-sm leading-snug text-slate-600">{idea.caption}</figcaption>
      </figure>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">In real life</p>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{idea.everyday}</p>
        </div>
        {idea.why.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it works</p>
            <ul className="mt-1.5 space-y-1.5">
              {idea.why.map((w) => (
                <li key={w} className="flex gap-2 text-[15px] leading-relaxed text-slate-700">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bridge-500" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const INK = "#334155";
const SOFT = "#cbd5e1";
const BLUE = "#2563eb";
const RED = "#dc2626";
const GREEN = "#16a34a";
const PALETTE = [BLUE, "#ea580c", GREEN, "#9333ea"];

export function IdeaPicture({ picture }: { picture: Picture }) {
  switch (picture.kind) {
    case "balance":
      return <Balance left={picture.left} right={picture.right} solution={picture.solution} />;
    case "numberLine":
      return <NumberLine p={picture} />;
    case "graph":
      return <Graph p={picture} />;
    case "area":
      return <Area p={picture} />;
    case "tape":
      return <Tape p={picture} />;
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="mx-auto min-w-[60%] border-collapse text-center text-sm">
            <thead>
              <tr>
                {picture.headers.map((h) => (
                  <th key={h} className="border-b-2 border-slate-300 px-3 py-1.5 font-semibold text-slate-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picture.rows.map((r, i) => (
                <tr key={i} className="odd:bg-white">
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-slate-200 px-3 py-1.5 font-mono text-slate-700">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {picture.note && <p className="mt-2 text-center text-xs text-slate-500">{picture.note}</p>}
        </div>
      );
    case "chain":
      return (
        <div className="flex flex-wrap items-center justify-center gap-1.5 py-2">
          {picture.steps.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
                  <path d="M1 6h14M11 2l4 4-4 4" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">{s}</span>
            </span>
          ))}
        </div>
      );
    case "complexPlane":
      return <ComplexPlane p={picture} />;
    case "unitCircle":
      return <UnitCircle angles={picture.angles} />;
  }
}

/* ── Balance ─────────────────────────────────────────────────── */

function side(p: Pan): string {
  const parts: string[] = [];
  if (p.x) parts.push(`${p.x === 1 ? "" : p.x === -1 ? "−" : String(p.x).replace("-", "−")}x`);
  if (p.ones) parts.push(parts.length ? `${p.ones < 0 ? "− " : "+ "}${Math.abs(p.ones)}` : String(p.ones).replace("-", "−"));
  return parts.join(" ") || "0";
}

function Balance({ left, right, solution }: { left: Pan; right: Pan; solution: number }) {
  const items = (p: Pan) => [
    ...Array.from({ length: Math.min(8, Math.abs(p.x ?? 0)) }, () => ({ kind: "x" as const, neg: (p.x ?? 0) < 0 })),
    ...Array.from({ length: Math.min(12, Math.abs(p.ones ?? 0)) }, () => ({ kind: "1" as const, neg: (p.ones ?? 0) < 0 })),
  ];
  const pan = (cx: number, list: ReturnType<typeof items>, more: number) => (
    <g>
      <line x1={cx} y1={52} x2={cx - 52} y2={112} stroke={SOFT} strokeWidth="1.5" />
      <line x1={cx} y1={52} x2={cx + 52} y2={112} stroke={SOFT} strokeWidth="1.5" />
      <path d={`M${cx - 62} 112 h124 l-10 10 h-104 z`} fill="#e2e8f0" stroke="#94a3b8" />
      {list.map((it, i) => {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = cx - 54 + col * 18;
        const y = 92 - row * 18;
        return it.kind === "x" ? (
          <g key={i}>
            <rect x={x} y={y} width="16" height="16" rx="3" fill={it.neg ? "#fee2e2" : "#dbeafe"} stroke={it.neg ? RED : BLUE} />
            <text x={x + 8} y={y + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={it.neg ? RED : BLUE}>
              {it.neg ? "−x" : "x"}
            </text>
          </g>
        ) : (
          <g key={i}>
            <circle cx={x + 8} cy={y + 9} r="7" fill={it.neg ? "#fee2e2" : "#f1f5f9"} stroke={it.neg ? RED : "#64748b"} />
            <text x={x + 8} y={y + 12.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={it.neg ? RED : INK}>
              {it.neg ? "−1" : "1"}
            </text>
          </g>
        );
      })}
      {more > 0 && (
        <text x={cx} y={140} textAnchor="middle" fontSize="10" fill="#64748b">
          and {more} more
        </text>
      )}
    </g>
  );
  const L = items(left);
  const R = items(right);
  const extra = (p: Pan) => Math.max(0, Math.abs(p.x ?? 0) - 8) + Math.max(0, Math.abs(p.ones ?? 0) - 12);
  return (
    <svg viewBox="0 0 360 190" className="w-full" role="img" aria-label={`A balance: ${side(left)} on one side, ${side(right)} on the other, level when x is ${solution}`}>
      <path d="M180 60 l-16 118 h32 z" fill="#94a3b8" />
      <rect x="60" y="48" width="240" height="7" rx="3.5" fill={INK} />
      <circle cx="180" cy="51" r="6" fill="#0f172a" />
      {pan(90, L, extra(left))}
      {pan(270, R, extra(right))}
      <text x="90" y="160" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK} fontFamily="ui-monospace, monospace">
        {side(left)}
      </text>
      <text x="180" y="160" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>
        =
      </text>
      <text x="270" y="160" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK} fontFamily="ui-monospace, monospace">
        {side(right)}
      </text>
    </svg>
  );
}

/* ── Number line ─────────────────────────────────────────────── */

function NumberLine({ p }: { p: Extract<Picture, { kind: "numberLine" }> }) {
  const W = 360;
  const x0 = 20;
  const x1 = W - 20;
  const at = (v: number) => x0 + ((v - p.min) / (p.max - p.min)) * (x1 - x0);
  const span = p.max - p.min;
  const step = span <= 12 ? 1 : span <= 24 ? 2 : span <= 60 ? 5 : Math.ceil(span / 12);
  const ticks: number[] = [];
  for (let v = Math.ceil(p.min / step) * step; v <= p.max; v += step) ticks.push(v);
  const Y = 110;
  const dot = (v: number, closed: boolean, key: string) => <circle key={key} cx={at(v)} cy={Y} r="6" fill={closed ? BLUE : "#fff"} stroke={BLUE} strokeWidth="2.5" />;
  return (
    <svg viewBox={`0 0 ${W} 150`} className="w-full" role="img" aria-label="A number line">
      <line x1={x0 - 8} y1={Y} x2={x1 + 8} y2={Y} stroke={INK} strokeWidth="1.6" />
      <path d={`M${x1 + 8} ${Y} l-6 -4 v8 z M${x0 - 8} ${Y} l6 -4 v8 z`} fill={INK} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={at(v)} y1={Y - 5} x2={at(v)} y2={Y + 5} stroke={INK} strokeWidth="1.2" />
          <text x={at(v)} y={Y + 22} textAnchor="middle" fontSize="11" fill="#475569">
            {String(v).replace("-", "−")}
          </text>
        </g>
      ))}
      {p.segment && <line x1={at(p.segment.from)} y1={Y} x2={at(p.segment.to)} y2={Y} stroke={BLUE} strokeWidth="6" strokeLinecap="round" opacity="0.85" />}
      {p.ray && (
        <>
          <line x1={at(p.ray.from)} y1={Y} x2={p.ray.dir === "right" ? x1 + 6 : x0 - 6} y2={Y} stroke={BLUE} strokeWidth="6" opacity="0.85" />
          <path d={p.ray.dir === "right" ? `M${x1 + 14} ${Y} l-10 -8 v16 z` : `M${x0 - 14} ${Y} l10 -8 v16 z`} fill={BLUE} />
        </>
      )}
      {p.segment && [dot(p.segment.from, p.segment.closedFrom, "a"), dot(p.segment.to, p.segment.closedTo, "b")]}
      {p.ray && dot(p.ray.from, p.ray.closed, "r")}
      {p.jumps?.map((j, i) => {
        const a = at(j.from);
        const b = at(j.to);
        const h = Math.min(60, 18 + Math.abs(b - a) * 0.35);
        return (
          <g key={i}>
            <path d={`M${a} ${Y - 8} Q${(a + b) / 2} ${Y - 8 - h * 2} ${b} ${Y - 8}`} fill="none" stroke="#ea580c" strokeWidth="2" />
            <path d={`M${b} ${Y - 8} l${b > a ? -7 : 7} -5 l${b > a ? 1 : -1} 8 z`} fill="#ea580c" />
            <text x={(a + b) / 2} y={Y - 14 - h} textAnchor="middle" fontSize="12" fontWeight="700" fill="#c2410c" stroke="#fff" strokeWidth="3" paintOrder="stroke">
              {j.label}
            </text>
          </g>
        );
      })}
      {p.marks?.map((m, i) => (
        <g key={`m${i}`}>
          <circle cx={at(m.at)} cy={Y} r="5" fill={GREEN} />
          {m.label && (
            <text x={at(m.at)} y={Y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#15803d">
              {m.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Graph ───────────────────────────────────────────────────── */

export function curveY(c: Curve, x: number): number {
  switch (c.f) {
    case "linear":
      return c.m * x + c.b;
    case "quadratic":
      return c.a * x * x + c.b * x + c.c;
    case "cubic":
      return c.a * x ** 3 + c.b * x * x + c.c * x + c.d;
    case "exponential":
      return c.a * c.base ** x;
    case "log":
      return x > 0 ? Math.log(x) / Math.log(c.base) : NaN;
    case "abs":
      return c.a * Math.abs(x - c.h) + c.k;
    case "sqrt":
      return x >= c.h ? c.a * Math.sqrt(x - c.h) + c.k : NaN;
    case "reciprocal":
      return x === c.h ? NaN : c.a / (x - c.h) + c.k;
    case "sine":
      return c.a * Math.sin((2 * Math.PI * x) / c.period);
    case "cosine":
      return c.a * Math.cos((2 * Math.PI * x) / c.period);
  }
}

function Graph({ p }: { p: Extract<Picture, { kind: "graph" }> }) {
  const W = 340;
  const H = 250;
  const pad = 28;
  const [xa, xb] = p.x;
  const [ya, yb] = p.y;
  const X = (x: number) => pad + ((x - xa) / (xb - xa)) * (W - 2 * pad);
  const Y = (y: number) => H - pad - ((y - ya) / (yb - ya)) * (H - 2 * pad);
  const step = (a: number, b: number) => {
    const s = b - a;
    return s <= 12 ? 1 : s <= 24 ? 2 : s <= 60 ? 5 : s <= 120 ? 10 : Math.ceil(s / 12 / 10) * 10;
  };
  const sx = step(xa, xb);
  const sy = step(ya, yb);
  const grid: React.ReactElement[] = [];
  const nums: React.ReactElement[] = [];
  // Numbers along the axes (or the edges, when an axis is off the graph), every other line when they would crowd.
  const ax = ya <= 0 && yb >= 0 ? Y(0) : Y(ya);
  const ay = xa <= 0 && xb >= 0 ? X(0) : X(xa);
  const fmt = (v: number) => String(Math.round(v * 100) / 100).replace("-", "−");
  const everyX = (xb - xa) / sx > 8 ? 2 : 1;
  const everyY = (yb - ya) / sy > 8 ? 2 : 1;
  let ix = 0;
  for (let v = Math.ceil(xa / sx) * sx; v <= xb; v += sx, ix += 1) {
    grid.push(<line key={`gx${v}`} x1={X(v)} y1={Y(ya)} x2={X(v)} y2={Y(yb)} stroke="#e2e8f0" />);
    if (v !== 0 && ix % everyX === 0) nums.push(<text key={`nx${v}`} x={X(v)} y={ax + 13} textAnchor="middle" fontSize="9.5" fill="#64748b">{fmt(v)}</text>);
  }
  let iy = 0;
  for (let v = Math.ceil(ya / sy) * sy; v <= yb; v += sy, iy += 1) {
    grid.push(<line key={`gy${v}`} x1={X(xa)} y1={Y(v)} x2={X(xb)} y2={Y(v)} stroke="#e2e8f0" />);
    if (v !== 0 && iy % everyY === 0) nums.push(<text key={`ny${v}`} x={ay - 4} y={Y(v) + 3} textAnchor="end" fontSize="9.5" fill="#64748b">{fmt(v)}</text>);
  }
  const path = (c: Curve) => {
    let d = "";
    let pen = false;
    const N = 240;
    for (let i = 0; i <= N; i += 1) {
      const x = xa + ((xb - xa) * i) / N;
      const y = curveY(c, x);
      const ok = Number.isFinite(y) && y >= ya - (yb - ya) * 0.5 && y <= yb + (yb - ya) * 0.5;
      if (!ok) {
        pen = false;
        continue;
      }
      const yy = Math.max(ya - (yb - ya) * 0.2, Math.min(yb + (yb - ya) * 0.2, y));
      d += `${pen ? "L" : "M"}${X(x).toFixed(1)} ${Y(yy).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const shade = (() => {
    if (!p.shade) return null;
    const c = p.curves[p.shade.curve];
    if (!c) return null;
    const N = 120;
    const pts: string[] = [];
    for (let i = 0; i <= N; i += 1) {
      const x = xa + ((xb - xa) * i) / N;
      const y = Math.max(ya, Math.min(yb, curveY(c, x)));
      pts.push(`${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
    }
    const edge = p.shade.side === "above" ? Y(yb) : Y(ya);
    return `${X(xa)},${edge} ${pts.join(" ")} ${X(xb)},${edge}`;
  })();
  const keyed = p.curves.filter((c) => c.label);
  return (
    <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="A graph">
      <defs>
        <clipPath id="plot">
          <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} />
        </clipPath>
      </defs>
      <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="#fff" />
      {grid}
      {ya <= 0 && yb >= 0 && <line x1={X(xa)} y1={Y(0)} x2={X(xb)} y2={Y(0)} stroke={INK} strokeWidth="1.3" />}
      {xa <= 0 && xb >= 0 && <line x1={X(0)} y1={Y(ya)} x2={X(0)} y2={Y(yb)} stroke={INK} strokeWidth="1.3" />}
      <text x={X(xb) - 2} y={(ya <= 0 && yb >= 0 ? Y(0) : Y(ya)) - 5} textAnchor="end" fontSize="11" fontStyle="italic" fill="#475569">
        x
      </text>
      <text x={(xa <= 0 && xb >= 0 ? X(0) : X(xa)) + 6} y={Y(yb) + 12} fontSize="11" fontStyle="italic" fill="#475569">
        y
      </text>
      <g clipPath="url(#plot)">
        {shade && <polygon points={shade} fill={BLUE} opacity="0.12" />}
        {p.curves.map((c, i) => (
          <path key={i} d={path(c)} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="2.6" strokeLinecap="round" />
        ))}
      </g>
      {nums}
      {p.points?.map((pt, i) => {
        // A label sits on the side of its point with more room, outlined in white so a line under it never hides it.
        const right = X(pt.x) < W * 0.62;
        return (
          <g key={i}>
            <circle cx={X(pt.x)} cy={Y(pt.y)} r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
            {pt.label && (
              <text x={X(pt.x) + (right ? 8 : -8)} y={Y(pt.y) - 8} textAnchor={right ? "start" : "end"} fontSize="11.5" fontWeight="700" fill="#0f172a" stroke="#fff" strokeWidth="3.5" paintOrder="stroke" strokeLinejoin="round">
                {pt.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    {keyed.length > 0 && (
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {p.curves.map((c, i) =>
          c.label ? (
            <li key={i} className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
              <span aria-hidden className="inline-block h-1 w-4 rounded" style={{ background: PALETTE[i % PALETTE.length] }} />
              {c.label}
            </li>
          ) : null,
        )}
      </ul>
    )}
    </div>
  );
}

/* ── Area model ──────────────────────────────────────────────── */

function Area({ p }: { p: Extract<Picture, { kind: "area" }> }) {
  return (
    <div className="mx-auto">
      <table className="mx-auto border-separate border-spacing-0 text-center">
        <thead>
          <tr>
            <th className="w-12" />
            {p.cols.map((c, i) => (
              <th key={i} className="px-2 pb-1 font-mono text-sm font-bold text-orange-700">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={i}>
              <th className="pr-2 font-mono text-sm font-bold text-blue-700">{r}</th>
              {p.cols.map((_, j) => (
                <td key={j} className={`min-w-[4.2rem] border border-slate-300 px-3 py-4 font-mono text-[15px] font-semibold text-slate-800 ${(i + j) % 2 ? "bg-blue-50" : "bg-orange-50"}`}>
                  {p.cells[i]?.[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {p.total && <p className="mt-2 text-center font-mono text-sm font-semibold text-slate-800">{p.total}</p>}
    </div>
  );
}

/* ── Bar model ───────────────────────────────────────────────── */

function Tape({ p }: { p: Extract<Picture, { kind: "tape" }> }) {
  const max = Math.max(...p.bars.map((b) => b.parts.reduce((s, x) => s + Math.abs(x.value), 0)), 1);
  const tones = ["bg-blue-100 text-blue-900 ring-blue-300", "bg-orange-100 text-orange-900 ring-orange-300", "bg-green-100 text-green-900 ring-green-300", "bg-purple-100 text-purple-900 ring-purple-300"];
  return (
    <div className="space-y-3 py-1">
      {p.bars.map((b, i) => (
        <div key={i}>
          <p className="mb-1 text-xs font-semibold text-slate-600">{b.label}</p>
          <div className="flex gap-0.5">
            {b.parts.map((part, j) => (
              <div key={j} style={{ width: `${(Math.abs(part.value) / max) * 100}%` }} className={`flex min-w-[2.2rem] items-center justify-center rounded-md px-1 py-2 text-center font-mono text-[13px] font-semibold ring-1 ${tones[j % tones.length]}`}>
                {part.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Complex plane ───────────────────────────────────────────── */

function ComplexPlane({ p }: { p: Extract<Picture, { kind: "complexPlane" }> }) {
  const S = 240;
  const c = S / 2;
  const k = (S / 2 - 24) / p.max;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[16rem]" role="img" aria-label="The complex plane">
      {Array.from({ length: 2 * p.max + 1 }, (_, i) => i - p.max).map((v) => (
        <g key={v}>
          <line x1={c + v * k} y1={12} x2={c + v * k} y2={S - 12} stroke="#e2e8f0" />
          <line x1={12} y1={c - v * k} x2={S - 12} y2={c - v * k} stroke="#e2e8f0" />
        </g>
      ))}
      <line x1={10} y1={c} x2={S - 10} y2={c} stroke={INK} strokeWidth="1.4" />
      <line x1={c} y1={10} x2={c} y2={S - 10} stroke={INK} strokeWidth="1.4" />
      <text x={S - 12} y={c - 6} textAnchor="end" fontSize="10" fill="#475569">
        real
      </text>
      <text x={c + 5} y={20} fontSize="10" fill="#475569">
        imaginary
      </text>
      {p.points.map((pt, i) => (
        <g key={i}>
          <line x1={c} y1={c} x2={c + pt.re * k} y2={c - pt.im * k} stroke={PALETTE[i % PALETTE.length]} strokeWidth="2" opacity="0.7" />
          <circle cx={c + pt.re * k} cy={c - pt.im * k} r="4.5" fill={PALETTE[i % PALETTE.length]} />
          <text x={c + pt.re * k + 7} y={c - pt.im * k - 6} fontSize="11.5" fontWeight="700" fill="#0f172a" stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {pt.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Unit circle ─────────────────────────────────────────────── */

const EXACT: Record<number, string> = {
  0: "(1, 0)",
  30: "(√3/2, 1/2)",
  45: "(√2/2, √2/2)",
  60: "(1/2, √3/2)",
  90: "(0, 1)",
  120: "(−1/2, √3/2)",
  135: "(−√2/2, √2/2)",
  150: "(−√3/2, 1/2)",
  180: "(−1, 0)",
  210: "(−√3/2, −1/2)",
  225: "(−√2/2, −√2/2)",
  240: "(−1/2, −√3/2)",
  270: "(0, −1)",
  300: "(1/2, −√3/2)",
  315: "(√2/2, −√2/2)",
  330: "(√3/2, −1/2)",
};

function UnitCircle({ angles }: { angles: number[] }) {
  const S = 260;
  const WIDE = 400;
  const cx0 = WIDE / 2;
  const c = S / 2;
  const r = 84;
  return (
    <svg viewBox={`0 0 ${WIDE} ${S}`} className="mx-auto w-full max-w-[25rem]" role="img" aria-label="The unit circle">
      <line x1={cx0 - r - 30} y1={c} x2={cx0 + r + 30} y2={c} stroke={INK} strokeWidth="1.3" />
      <line x1={cx0} y1={10} x2={cx0} y2={S - 10} stroke={INK} strokeWidth="1.3" />
      <circle cx={cx0} cy={c} r={r} fill="none" stroke={BLUE} strokeWidth="2.2" />
      {angles.map((a, i) => {
        const t = (a * Math.PI) / 180;
        const x = cx0 + r * Math.cos(t);
        const y = c - r * Math.sin(t);
        const lx = cx0 + (r + 12) * Math.cos(t);
        const ly = c - (r + 14) * Math.sin(t);
        return (
          <g key={a}>
            <line x1={cx0} y1={c} x2={x} y2={y} stroke={PALETTE[(i + 1) % PALETTE.length]} strokeWidth="1.8" />
            <circle cx={x} cy={y} r="4" fill={PALETTE[(i + 1) % PALETTE.length]} />
            <text x={lx} y={ly + 4} textAnchor={Math.cos(t) > 0.2 ? "start" : Math.cos(t) < -0.2 ? "end" : "middle"} fontSize="10.5" fontWeight="700" fill="#0f172a">
              {a}° {EXACT[((a % 360) + 360) % 360] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
