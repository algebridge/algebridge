"use client";

import { useState } from "react";
import { ProblemPicture } from "@/components/ProblemPicture";
import type { Picture } from "@/lib/pictures";

/**
 * Visualize it, on the course page: a live line the student can change,
 * standing in for the drawing every practice problem comes with. Two sliders,
 * one graph, and the equation that goes with it.
 */
export function VisualizeIt() {
  const [m, setM] = useState(2);
  const [b, setB] = useState(-1);
  const eq = `y = ${m === 1 ? "" : m === -1 ? "-" : m}x ${b < 0 ? "- " + -b : "+ " + b}`;
  const picture: Picture = {
    kind: "plane",
    title: `The line ${eq}: it crosses the y-axis at ${b} and rises ${m} for every 1 across.`,
    reveals: false,
    x: [-10, 10],
    y: [-10, 10],
    curves: [{ f: (x) => m * x + b, label: eq }],
    vlines: [],
    segments: [],
    points: [
      { x: 0, y: b, label: `(0, ${b})`, tone: 2 },
      { x: 1, y: m + b, label: `(1, ${m + b})`, tone: 2 },
    ],
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Visualize it</h2>
        <span className="text-xs text-slate-500">Every problem draws itself</span>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        <ProblemPicture picture={picture} />
        <div className="space-y-5">
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{eq}</p>
          <Slider label="Slope" value={m} min={-5} max={5} onChange={setM} />
          <Slider label="y-intercept" value={b} min={-8} max={8} onChange={setB} />
          <p className="text-sm text-slate-500">Graphs, number lines, bar models and tables, drawn from the problem. Point at a graph to read it.</p>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-medium text-slate-700">
        {label}
        <span className="tabular-nums text-slate-900">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-bridge-600" />
    </label>
  );
}
