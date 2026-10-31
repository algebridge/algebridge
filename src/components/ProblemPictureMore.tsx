"use client";

import { Fragment } from "react";
import type { Picture } from "@/lib/pictures";

/**
 * The drawings for lib/pictures-more.ts: a balance, fraction strips, factor
 * groups, a ladder of powers, the decimal point hopping, squares inside a
 * radical, scatter plots and a board of givens. The inks and paper match
 * ProblemPicture.tsx, which imports them from here.
 */

export type Tone = 0 | 1 | 2;
export const INK: Record<Tone, string> = { 0: "#2563eb", 1: "#ea580c", 2: "#059669" };
export const TINT: Record<Tone, string> = { 0: "rgba(37, 99, 235, 0.13)", 1: "rgba(234, 88, 12, 0.12)", 2: "rgba(5, 150, 105, 0.12)" };
export const GRID = "#e2e8f0";
export const AXIS = "#64748b";
export const TEXT = "#334155";
export const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

export function Missing() {
  return <span className="font-bold text-bridge-700">?</span>;
}

/** A typed minus as the printed one. */
export const minus = (s: string) => s.replace(/-/g, "−");

// ---------------------------------------------------------------------------

function Pan({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[3rem] flex-wrap items-center justify-center gap-1.5 rounded-b-xl border-b-4 border-slate-400 px-2 pb-2 pt-1">{children}</div>;
}

export function Balance({ p }: { p: Extract<Picture, { kind: "balance" }> }) {
  const chip = (t: string, i: number) => {
    const hit = !!p.focus && new RegExp(`(^|[^a-zA-Z])${p.focus}([^a-zA-Z]|$)`).test(t);
    return (
      <span key={i} className={`rounded-lg border px-2.5 py-1 text-[15px] font-semibold tabular-nums ${hit ? "border-bridge-300 bg-bridge-50 text-bridge-900" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
        {minus(t)}
      </span>
    );
  };
  return (
    <div role="img" aria-label={p.title} className="max-w-[460px]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Pan>{p.left.map(chip)}</Pan>
        <span className="pb-2 text-xl font-bold text-slate-400">=</span>
        <Pan>{p.right.map(chip)}</Pan>
      </div>
      <svg viewBox="0 0 340 30" className="h-auto w-full" aria-hidden style={{ fontFamily: FONT }}>
        <line x1="40" y1="2" x2="40" y2="10" stroke={AXIS} strokeWidth="2" />
        <line x1="300" y1="2" x2="300" y2="10" stroke={AXIS} strokeWidth="2" />
        <line x1="30" y1="10" x2="310" y2="10" stroke={TEXT} strokeWidth="3" strokeLinecap="round" />
        <path d="M170 10 L158 28 H182 Z" fill={TEXT} />
      </svg>
    </div>
  );
}

export function Strips({ p }: { p: Extract<Picture, { kind: "strips" }> }) {
  return (
    <div role="img" aria-label={p.title} className="max-w-[460px] space-y-2">
      {p.denominators.map((d) => (
        <div key={d} className="flex items-center gap-3">
          <span className="w-9 text-right text-sm font-semibold tabular-nums text-slate-700">1/{d}</span>
          <div className="flex flex-1 overflow-hidden rounded-md border border-slate-300 bg-surface">
            {Array.from({ length: d }, (_, i) => (
              <span key={i} className={`h-7 flex-1 ${i === 0 ? "bg-bridge-200" : ""} ${i ? "border-l border-slate-300" : ""}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupRow({ groups }: { groups: Extract<Picture, { kind: "factors" }>["top"] }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="pt-2.5 text-slate-400">×</span>}
          <span className="flex flex-col items-center">
            <span className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              {g.items.map((it, j) => (
                <span
                  key={j}
                  className={`rounded px-1.5 py-0.5 text-[15px] font-semibold tabular-nums ${
                    it.struck ? "text-slate-400 line-through decoration-rose-500 decoration-2" : "bg-surface text-slate-900 ring-1 ring-slate-200"
                  }`}
                >
                  {it.text}
                </span>
              ))}
            </span>
            <span className="mt-1 text-[11px] text-slate-500">{g.label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function Factors({ p }: { p: Extract<Picture, { kind: "factors" }> }) {
  return (
    <div role="img" aria-label={p.title} className="inline-flex flex-col items-start gap-2">
      <GroupRow groups={p.top} />
      {p.bottom && (
        <>
          <span className="h-0.5 w-full min-w-[8rem] rounded bg-slate-400" />
          <GroupRow groups={p.bottom} />
        </>
      )}
    </div>
  );
}

export function Ladder({ p }: { p: Extract<Picture, { kind: "ladder" }> }) {
  return (
    <div role="img" aria-label={p.title} className="inline-flex items-start gap-4">
      <div className="inline-grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1.5 text-[15px]">
        {p.rows.map((r, i) => (
          <Fragment key={i}>
            <span className="font-semibold tabular-nums text-slate-800">{r.power}</span>
            <span className="text-slate-400">=</span>
            <span className={`rounded-md px-2 py-0.5 font-semibold tabular-nums ${r.value === null ? "border border-dashed border-bridge-300 bg-surface" : "bg-slate-50 text-slate-900"}`}>
              {r.value === null ? <Missing /> : r.value}
            </span>
          </Fragment>
        ))}
      </div>
      <div className="flex flex-col items-center self-stretch justify-center text-emerald-700">
        <svg width="14" height="60" aria-hidden>
          <path d="M7 2v50M2 46l5 8 5-8" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mt-1 whitespace-nowrap text-xs font-semibold">{p.step}</span>
      </div>
    </div>
  );
}

export function Digits({ p }: { p: Extract<Picture, { kind: "digits" }> }) {
  const cell = 30;
  const x0 = 24;
  const W = Math.max(220, p.digits.length * cell + 2 * x0);
  const H = 96;
  const Y = 66;
  const gap = (i: number) => x0 + i * cell;
  const hops = Math.abs(p.to - p.from);
  const dir = Math.sign(p.to - p.from);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[460px]" role="img" aria-label={p.title} style={{ fontFamily: FONT }}>
      {[...p.digits].map((d, i) => (
        <text key={i} x={gap(i) + cell / 2} y={Y} fontSize="28" fontWeight="700" textAnchor="middle" fill={TEXT}>
          {d}
        </text>
      ))}
      <circle cx={gap(p.from)} cy={Y - 2} r="3.5" fill={AXIS} opacity="0.4" />
      <circle cx={gap(p.to)} cy={Y - 2} r="4.5" fill={INK[2]} />
      {Array.from({ length: hops }, (_, k) => {
        const a = gap(p.from + dir * k);
        const b = gap(p.from + dir * (k + 1));
        return <path key={k} d={`M${a} ${Y - 14} Q${(a + b) / 2} ${Y - 34} ${b} ${Y - 14}`} fill="none" stroke={INK[2]} strokeWidth="1.6" strokeDasharray="3 3" />;
      })}
      <text x={(gap(p.from) + gap(p.to)) / 2} y={Y - 40} fontSize="12" fontWeight="700" textAnchor="middle" fill={INK[2]}>
        {hops} hop{hops === 1 ? "" : "s"} {dir > 0 ? "right" : "left"}
      </text>
    </svg>
  );
}

export function Squares({ p }: { p: Extract<Picture, { kind: "squares" }> }) {
  return (
    <div role="img" aria-label={p.title} className="flex flex-wrap items-end gap-3">
      {p.parts.map((q, i) => {
        const s = Math.round(Math.sqrt(q.square));
        const c = Math.min(18, Math.max(6, Math.floor(120 / Math.max(s, 1))));
        const side = s * c;
        const restCells = q.rest > 1 && q.rest <= 12 ? q.rest : 0;
        const restW = restCells ? c + 10 : q.rest > 1 ? 40 : 0;
        const W = side + restW + 8;
        const H = Math.max(side, restCells * c) + 24;
        return (
          <Fragment key={i}>
            {i > 0 && p.op && <span className="pb-6 text-xl font-bold text-slate-400">{p.op}</span>}
            <figure className="m-0 flex flex-col items-center">
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: FONT }} aria-hidden>
                <rect x="1" y={H - side - 20} width={side} height={side} fill={TINT[0]} stroke={INK[0]} strokeWidth="1.5" />
                {s <= 14 &&
                  Array.from({ length: s - 1 }, (_, k) => (
                    <Fragment key={k}>
                      <line x1={1 + (k + 1) * c} y1={H - side - 20} x2={1 + (k + 1) * c} y2={H - 20} stroke={INK[0]} strokeOpacity="0.35" />
                      <line x1="1" y1={H - side - 20 + (k + 1) * c} x2={1 + side} y2={H - side - 20 + (k + 1) * c} stroke={INK[0]} strokeOpacity="0.35" />
                    </Fragment>
                  ))}
                <text x={1 + side / 2} y={H - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill={INK[0]}>
                  {s} × {s} = {q.square}
                </text>
                {restCells > 0 &&
                  Array.from({ length: restCells }, (_, k) => (
                    <rect key={k} x={side + 9} y={H - 20 - (k + 1) * c} width={c} height={c} fill={TINT[1]} stroke={INK[1]} strokeWidth="1.2" />
                  ))}
                {!restCells && q.rest > 1 && <rect x={side + 9} y={H - 20 - Math.min(side, 40)} width="32" height={Math.min(side, 40)} fill={TINT[1]} stroke={INK[1]} strokeWidth="1.2" />}
                {q.rest > 1 && (
                  <text x={side + 9 + (restCells ? c / 2 : 16)} y={H - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill={INK[1]}>
                    {q.rest}
                  </text>
                )}
              </svg>
              <figcaption className="mt-1 text-[13px] font-semibold tabular-nums text-slate-700">
                {q.coef}√{q.extra ? `(${q.n}${q.extra})` : q.n} = {q.coef}√({q.square} · {q.rest}{q.extra ? ` · ${q.extra}` : ""})
              </figcaption>
            </figure>
          </Fragment>
        );
      })}
    </div>
  );
}

function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Scatters({ p }: { p: Extract<Picture, { kind: "scatters" }> }) {
  const single = p.panels.length === 1;
  const W = single ? 300 : 150;
  const H = single ? 220 : 130;
  const PAD = single ? 28 : 14;
  return (
    <div role="img" aria-label={p.title} className="flex flex-wrap gap-3">
      {p.panels.map((panel, i) => {
        const rnd = seeded(Math.round(panel.r * 1000) + 7);
        const noise = 0.5 * Math.sqrt(Math.max(0, 1 - panel.r * panel.r));
        const pts = Array.from({ length: 26 }, () => {
          const x = 0.08 + rnd() * 0.84;
          const y = 0.5 + Math.sign(panel.r || 1) * (x - 0.5) * 0.85 * Math.sqrt(Math.abs(panel.r)) + (rnd() - 0.5) * 2 * noise;
          return [x, Math.min(0.97, Math.max(0.03, y))];
        });
        return (
          <figure key={i} className="m-0">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: FONT }} aria-hidden>
              <rect x={PAD} y={6} width={W - PAD - 6} height={H - PAD - 6} fill="#ffffff" stroke={GRID} />
              <line x1={PAD} y1={H - PAD} x2={W - 6} y2={H - PAD} stroke={AXIS} strokeWidth="1.2" />
              <line x1={PAD} y1={6} x2={PAD} y2={H - PAD} stroke={AXIS} strokeWidth="1.2" />
              {pts.map(([x, y], k) => (
                <circle key={k} cx={PAD + x * (W - PAD - 6)} cy={6 + (1 - y) * (H - PAD - 6)} r={single ? 4 : 2.6} fill={INK[0]} fillOpacity="0.8" />
              ))}
              {panel.axes && single && (
                <>
                  <text x={(PAD + W) / 2} y={H - 8} fontSize="11" textAnchor="middle" fill={TEXT}>
                    {panel.axes[0]}
                  </text>
                  <text x={10} y={(H - PAD) / 2} fontSize="11" textAnchor="middle" fill={TEXT} transform={`rotate(-90 10 ${(H - PAD) / 2})`}>
                    {panel.axes[1]}
                  </text>
                </>
              )}
            </svg>
            <figcaption className="mt-1 text-center text-[13px] font-semibold tabular-nums text-slate-700">{panel.label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function Givens({ p }: { p: Extract<Picture, { kind: "givens" }> }) {
  return (
    <div role="img" aria-label={p.title} className="flex flex-wrap items-center gap-2">
      {p.known.map((k, i) => (
        <span key={i} className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[17px] font-bold tabular-nums text-slate-900">{minus(k.value)}</span>
          <span className="text-[11px] text-slate-500">{k.label}</span>
        </span>
      ))}
      <svg width="28" height="12" aria-hidden>
        <path d="M1 6h23M19 1l5 5-5 5" fill="none" stroke={AXIS} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex flex-col items-center rounded-xl border border-dashed border-bridge-300 bg-surface px-3 py-2">
        <span className="text-[17px] font-bold text-bridge-700">?</span>
        <span className="max-w-[12rem] text-center text-[11px] text-slate-600">{p.want}</span>
      </span>
    </div>
  );
}
