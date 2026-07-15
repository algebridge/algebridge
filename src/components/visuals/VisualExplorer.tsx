"use client";

import { useMemo, useState } from "react";
import type { Skill } from "@/types";
import { CoordinateGraphDiagram } from "@/components/visuals/CoordinateGraphDiagram";
import { NumberLineDiagram } from "@/components/visuals/NumberLineDiagram";
import { createSeededRng, hashString } from "@/lib/problem-utils";

// ---------------------------------------------------------------------------
// Which hands-on manipulative fits each skill.
// ---------------------------------------------------------------------------
type ExplorerMode =
  | "balance"
  | "line"
  | "inequality"
  | "halfplane"
  | "parabola"
  | "point"
  | "intro";

const MODE_BY_SKILL: Record<string, ExplorerMode> = {
  "one-step-equations": "balance",
  "two-step-equations": "balance",
  "multi-step-equations": "balance",
  "equations-with-fractions": "balance",
  "solving-by-factoring": "balance",
  "completing-square": "balance",
  "quadratic-formula": "balance",
  "linear-inequalities": "inequality",
  "compound-inequalities": "inequality",
  "absolute-value-inequalities": "inequality",
  "coordinate-plane": "point",
  slope: "line",
  "graphing-lines": "line",
  intercepts: "line",
  "slope-intercept": "line",
  "point-slope": "line",
  "standard-form": "line",
  "parallel-perpendicular": "line",
  "graphing-systems": "line",
  substitution: "line",
  elimination: "line",
  "systems-word-problems": "line",
  "domain-range": "line",
  "function-graphs": "line",
  "function-notation": "line",
  "graphing-inequalities": "halfplane",
  "systems-inequalities": "halfplane",
  "graphing-parabolas": "parabola",
};

export function getExplorerMode(skillId: string): ExplorerMode {
  return MODE_BY_SKILL[skillId] ?? "intro";
}

// ---------------------------------------------------------------------------
// Shared little UI pieces
// ---------------------------------------------------------------------------
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium text-slate-700">
        <span>{label}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-900">
          {display ?? value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-bridge-600"
        aria-label={label}
      />
    </label>
  );
}

function ExplorerShell({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {children}
      {caption && (
        <p className="rounded-xl bg-bridge-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {caption}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balance scale — solve a·x + b = c by keeping both sides equal
// ---------------------------------------------------------------------------
interface BalanceStep {
  equation: string;
  xTiles: number;
  leftUnits: number;
  rightUnits: number;
  caption: string;
}

function buildBalance(seed: number) {
  const rng = createSeededRng(hashString(`balance-${seed}`));
  const a = 2 + Math.floor(rng() * 3); // 2..4
  const x = 1 + Math.floor(rng() * 6); // 1..6
  const b = 1 + Math.floor(rng() * 8); // 1..8 (positive keeps the scale physical)
  const c = a * x + b;

  const steps: BalanceStep[] = [
    {
      equation: `${a}x + ${b} = ${c}`,
      xTiles: a,
      leftUnits: b,
      rightUnits: c,
      caption:
        "Each side of the scale weighs the same, so the beam is level. The blue x-boxes each hold the same unknown weight.",
    },
    {
      equation: `${a}x = ${c - b}`,
      xTiles: a,
      leftUnits: 0,
      rightUnits: c - b,
      caption: `Take ${b} unit${b === 1 ? "" : "s"} off BOTH pans. Same change to each side ⟶ still balanced.`,
    },
  ];
  if (a > 1) {
    steps.push({
      equation: `x = ${(c - b) / a}`,
      xTiles: 1,
      leftUnits: 0,
      rightUnits: (c - b) / a,
      caption: `Split both sides into ${a} equal groups. One x balances ${(c - b) / a}. Solved! ✅`,
    });
  }
  return { steps, answer: x };
}

function Chip({ kind }: { kind: "x" | "unit" }) {
  if (kind === "x") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-bridge-600 text-xs font-bold text-white shadow-sm">
        x
      </span>
    );
  }
  return <span className="h-4 w-4 rounded-full bg-amber-400 shadow-sm ring-1 ring-amber-500/40" />;
}

function Pan({ xTiles, units, label }: { xTiles: number; units: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex min-h-[72px] w-full flex-wrap content-center items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-slate-50 p-2">
        {Array.from({ length: xTiles }).map((_, i) => (
          <Chip key={`x${i}`} kind="x" />
        ))}
        {Array.from({ length: units }).map((_, i) => (
          <Chip key={`u${i}`} kind="unit" />
        ))}
        {xTiles === 0 && units === 0 && <span className="text-xs text-slate-400">empty</span>}
      </div>
    </div>
  );
}

function BalanceExplorer() {
  const [seed, setSeed] = useState(1);
  const [stepIdx, setStepIdx] = useState(0);
  const { steps } = useMemo(() => buildBalance(seed), [seed]);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const atEnd = stepIdx >= steps.length - 1;

  return (
    <ExplorerShell caption={step.caption}>
      <div className="text-center font-mono text-xl font-bold text-slate-900">{step.equation}</div>

      {/* Beam */}
      <div className="relative pt-2">
        <div className="mx-auto h-2 w-[86%] rounded-full bg-slate-800" />
        <div className="mx-auto h-3 w-3 rotate-45 bg-slate-800" style={{ marginTop: -2 }} />
        <div className="mx-auto -mt-1 h-0 w-0 border-x-[26px] border-b-[22px] border-x-transparent border-b-slate-700" />
      </div>

      <div className="flex items-start gap-4">
        <Pan xTiles={step.xTiles} units={step.leftUnits} label="Left side" />
        <div className="self-center pt-6 text-2xl font-bold text-slate-400">=</div>
        <Pan xTiles={0} units={step.rightUnits} label="Right side" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="btn-secondary text-sm disabled:opacity-40"
        >
          ← Back
        </button>
        {!atEnd ? (
          <button type="button" onClick={() => setStepIdx((i) => i + 1)} className="btn-primary text-sm">
            Next move →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSeed((s) => s + 1);
              setStepIdx(0);
            }}
            className="btn-primary text-sm"
          >
            ↻ New equation
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full ${i <= stepIdx ? "bg-bridge-600" : "bg-slate-200"}`}
          />
        ))}
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Line grapher — drag slope & intercept, watch the line move
// ---------------------------------------------------------------------------
function LineExplorer() {
  const [m, setM] = useState(1);
  const [b, setB] = useState(2);
  const range = 8;
  const sign = b >= 0 ? "+" : "−";

  return (
    <ExplorerShell
      caption={
        <>
          The <strong>slope</strong> {m} tells you to go{" "}
          {m === 0 ? "flat (no rise)" : `${m > 0 ? "up" : "down"} ${Math.abs(m)} for every 1 step right`}. The{" "}
          <strong>y-intercept</strong> {b} is where the line crosses the y-axis, at the point (0, {b}).
        </>
      }
    >
      <div className="mx-auto aspect-square w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
        <CoordinateGraphDiagram
          spec={{ type: "coordinate", range, lines: [{ slope: m, intercept: b }], points: [{ x: 0, y: b }] }}
          showAxisNumbers
          showRiseRun
        />
      </div>
      <div className="text-center font-mono text-lg font-bold text-slate-900">
        y = {m}x {sign} {Math.abs(b)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Slope (m)" value={m} min={-5} max={5} onChange={setM} />
        <Slider label="y-intercept (b)" value={b} min={-8} max={8} onChange={setB} />
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Inequality number line — pick boundary, direction, open/closed
// ---------------------------------------------------------------------------
function InequalityExplorer() {
  const [boundary, setBoundary] = useState(2);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [inclusive, setInclusive] = useState(false);
  const symbol = direction === "right" ? (inclusive ? "≥" : ">") : inclusive ? "≤" : "<";
  const samples = [boundary - 2, boundary - 1, boundary, boundary + 1, boundary + 2];
  const satisfies = (n: number) =>
    direction === "right" ? (inclusive ? n >= boundary : n > boundary) : inclusive ? n <= boundary : n < boundary;

  return (
    <ExplorerShell
      caption={
        <>
          A <strong>{inclusive ? "closed" : "open"}</strong> circle means {boundary} itself{" "}
          {inclusive ? "IS" : "is NOT"} part of the answer. The shaded arrow shows every number that works.
        </>
      }
    >
      <div className="mx-auto h-24 w-full max-w-[380px] rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
        <NumberLineDiagram
          spec={{
            type: "number-line",
            min: -10,
            max: 10,
            mark: { kind: "ray", boundary, direction, inclusive },
          }}
          showAllNumbers
        />
      </div>
      <div className="text-center font-mono text-lg font-bold text-slate-900">x {symbol} {boundary}</div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {samples.map((n) => (
          <span
            key={n}
            className={`rounded-full px-2.5 py-1 font-mono ${
              satisfies(n) ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500 line-through"
            }`}
          >
            {n} {satisfies(n) ? "✓" : "✗"}
          </span>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Boundary" value={boundary} min={-8} max={8} onChange={setBoundary} />
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("left")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                direction === "left" ? "border-bridge-500 bg-bridge-50 text-bridge-800" : "border-slate-300 text-slate-600"
              }`}
            >
              x is less ◀
            </button>
            <button
              type="button"
              onClick={() => setDirection("right")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                direction === "right" ? "border-bridge-500 bg-bridge-50 text-bridge-800" : "border-slate-300 text-slate-600"
              }`}
            >
              ▶ x is more
            </button>
          </div>
          <button
            type="button"
            onClick={() => setInclusive((v) => !v)}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
              inclusive ? "border-bridge-500 bg-bridge-50 text-bridge-800" : "border-slate-300 text-slate-600"
            }`}
          >
            {inclusive ? "● closed (or equal to)" : "○ open (strictly)"}
          </button>
        </div>
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Half-plane — line + which side is shaded
// ---------------------------------------------------------------------------
function HalfPlaneExplorer() {
  const [m, setM] = useState(1);
  const [b, setB] = useState(1);
  const [shade, setShade] = useState<"above" | "below">("above");
  const range = 8;
  const sign = b >= 0 ? "+" : "−";

  return (
    <ExplorerShell
      caption={
        <>
          Shade <strong>{shade}</strong> the line to show every (x, y) point where y{" "}
          {shade === "above" ? ">" : "<"} {m}x {sign} {Math.abs(b)}. Pick a test point like (0, 0) to check which side wins.
        </>
      }
    >
      <div className="mx-auto aspect-square w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
        <CoordinateGraphDiagram
          spec={{ type: "coordinate", range, lines: [{ slope: m, intercept: b }], shade }}
          showAxisNumbers
        />
      </div>
      <div className="text-center font-mono text-lg font-bold text-slate-900">
        y {shade === "above" ? ">" : "<"} {m}x {sign} {Math.abs(b)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Slope (m)" value={m} min={-4} max={4} onChange={setM} />
        <Slider label="y-intercept (b)" value={b} min={-6} max={6} onChange={setB} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShade("above")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            shade === "above" ? "border-bridge-500 bg-bridge-50 text-bridge-800" : "border-slate-300 text-slate-600"
          }`}
        >
          Shade above (y &gt;)
        </button>
        <button
          type="button"
          onClick={() => setShade("below")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            shade === "below" ? "border-bridge-500 bg-bridge-50 text-bridge-800" : "border-slate-300 text-slate-600"
          }`}
        >
          Shade below (y &lt;)
        </button>
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Parabola — move the vertex, flip it open/down
// ---------------------------------------------------------------------------
function ParabolaExplorer() {
  const [a, setA] = useState(1);
  const [h, setH] = useState(0);
  const [k, setK] = useState(-2);
  const range = 8;
  const safeA = a === 0 ? 0.5 : a;

  return (
    <ExplorerShell
      caption={
        <>
          The vertex is the turning point at <strong>({h}, {k})</strong>. Because a = {safeA} is{" "}
          {safeA > 0 ? "positive, the parabola opens UP (smile)" : "negative, the parabola opens DOWN (frown)"}.
        </>
      }
    >
      <div className="mx-auto aspect-square w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
        <CoordinateGraphDiagram
          spec={{
            type: "coordinate",
            range,
            parabola: { a: safeA, h, k },
            points: [{ x: h, y: k, label: `(${h}, ${k})` }],
          }}
          showAxisNumbers
        />
      </div>
      <div className="text-center font-mono text-lg font-bold text-slate-900">
        y = {safeA === 1 ? "" : safeA === -1 ? "−" : safeA}(x {h >= 0 ? "−" : "+"} {Math.abs(h)})² {k >= 0 ? "+" : "−"}{" "}
        {Math.abs(k)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider label="Stretch (a)" value={a} min={-2} max={2} step={0.5} onChange={setA} display={String(safeA)} />
        <Slider label="Left/right (h)" value={h} min={-5} max={5} onChange={setH} />
        <Slider label="Up/down (k)" value={k} min={-5} max={5} onChange={setK} />
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Point plotter — move a point, name the quadrant
// ---------------------------------------------------------------------------
function PointExplorer() {
  const [x, setX] = useState(3);
  const [y, setY] = useState(2);
  const range = 8;
  const where =
    x === 0 && y === 0
      ? "the origin"
      : x === 0
        ? "on the y-axis"
        : y === 0
          ? "on the x-axis"
          : x > 0 && y > 0
            ? "Quadrant I"
            : x < 0 && y > 0
              ? "Quadrant II"
              : x < 0 && y < 0
                ? "Quadrant III"
                : "Quadrant IV";

  return (
    <ExplorerShell
      caption={
        <>
          Start at the origin. Move <strong>{Math.abs(x)}</strong> {x >= 0 ? "right" : "left"} (the x-coordinate), then{" "}
          <strong>{Math.abs(y)}</strong> {y >= 0 ? "up" : "down"} (the y-coordinate). You land in <strong>{where}</strong>.
        </>
      }
    >
      <div className="mx-auto aspect-square w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
        <CoordinateGraphDiagram
          spec={{ type: "coordinate", range, points: [{ x, y, label: `(${x}, ${y})` }] }}
          showAxisNumbers
        />
      </div>
      <div className="text-center font-mono text-lg font-bold text-slate-900">({x}, {y})</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="x (left / right)" value={x} min={-8} max={8} onChange={setX} />
        <Slider label="y (down / up)" value={y} min={-8} max={8} onChange={setY} />
      </div>
    </ExplorerShell>
  );
}

// ---------------------------------------------------------------------------
// Fallback concept card
// ---------------------------------------------------------------------------
function IntroExplorer({ skill }: { skill: Skill }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
      <div className="text-4xl">💡</div>
      <h4 className="font-bold text-slate-900">The big idea</h4>
      <p className="text-sm leading-relaxed text-slate-600">{skill.keyIdea}</p>
      <p className="text-xs text-slate-400">
        Try the <strong>Quiz</strong> tab to test your visual intuition for this skill.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function VisualExplorer({ skill }: { skill: Skill }) {
  const mode = getExplorerMode(skill.id);
  switch (mode) {
    case "balance":
      return <BalanceExplorer />;
    case "line":
      return <LineExplorer />;
    case "inequality":
      return <InequalityExplorer />;
    case "halfplane":
      return <HalfPlaneExplorer />;
    case "parabola":
      return <ParabolaExplorer />;
    case "point":
      return <PointExplorer />;
    default:
      return <IntroExplorer skill={skill} />;
  }
}
