/**
 * Checks every "Get the idea" (types.ts): the words within their limits and
 * the copy rules, and every picture true to itself. Pure; the practice
 * tests run it, and so can anyone writing ideas:
 *   node --no-warnings --experimental-strip-types --import ./src/lib/__tests__/alias.mjs scripts/check-skill-ideas.ts
 */
import type { Curve, Pan, SkillIdea } from "./types";

const EXACT_ANGLES = new Set([0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]);

function y(c: Curve, x: number): number {
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

const weigh = (p: Pan, x: number) => (p.x ?? 0) * x + (p.ones ?? 0);

export function checkIdea(id: string, s: SkillIdea): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(`${id}: ${m}`);
  const texts = [s.idea, s.everyday, s.caption, ...s.why];
  for (const t of texts) {
    if (/[—–]/.test(t)) bad(`a dash (— or –) in "${t.slice(0, 40)}..."; use a period, comma or colon`);
    if (/\bbut\b/i.test(t)) bad(`"but" in "${t.slice(0, 40)}..."; say what is true instead`);
    if (/\s{2,}/.test(t) || t !== t.trim()) bad(`stray spaces in "${t.slice(0, 40)}..."`);
  }
  if (s.idea.length < 120 || s.idea.length > 520) bad(`idea is ${s.idea.length} characters; keep it 120 to 520`);
  if (s.everyday.length < 50 || s.everyday.length > 300) bad(`everyday is ${s.everyday.length} characters; keep it 50 to 300`);
  if (s.caption.length < 30 || s.caption.length > 240) bad(`caption is ${s.caption.length} characters; keep it 30 to 240`);
  if (s.why.length < 1 || s.why.length > 3) bad("why needs one to three points");
  for (const w of s.why) if (w.length > 220) bad(`a why point is ${w.length} characters; keep each under 220`);
  const p = s.picture;
  const fin = (...n: number[]) => n.every((v) => Number.isFinite(v));
  switch (p.kind) {
    case "balance": {
      if (!fin(p.solution, p.left.x ?? 0, p.left.ones ?? 0, p.right.x ?? 0, p.right.ones ?? 0)) bad("balance numbers must be finite");
      if (Math.abs(weigh(p.left, p.solution) - weigh(p.right, p.solution)) > 1e-9) bad(`balance is uneven at x = ${p.solution}: ${weigh(p.left, p.solution)} vs ${weigh(p.right, p.solution)}`);
      if (Math.abs(p.left.x ?? 0) + Math.abs(p.right.x ?? 0) === 0) bad("balance needs at least one x box");
      if (Math.abs(p.left.x ?? 0) > 8 || Math.abs(p.right.x ?? 0) > 8 || Math.abs(p.left.ones ?? 0) > 24 || Math.abs(p.right.ones ?? 0) > 24) bad("balance is too full to draw: at most 8 boxes and 24 ones a side");
      break;
    }
    case "numberLine": {
      if (!(p.min < p.max)) bad("number line needs min < max");
      const inside = (v: number) => v >= p.min && v <= p.max;
      for (const m of p.marks ?? []) if (!inside(m.at)) bad(`mark ${m.at} is off the line`);
      if (p.ray && !inside(p.ray.from)) bad("ray starts off the line");
      if (p.segment && (!inside(p.segment.from) || !inside(p.segment.to) || p.segment.from >= p.segment.to)) bad("segment must run from a smaller to a bigger number on the line");
      for (const j of p.jumps ?? []) if (!inside(j.from) || !inside(j.to)) bad("a jump runs off the line");
      if (!p.marks?.length && !p.ray && !p.segment && !p.jumps?.length) bad("number line shows nothing");
      break;
    }
    case "graph": {
      if (!(p.x[0] < p.x[1] && p.y[0] < p.y[1])) bad("graph ranges must go from small to big");
      if (!p.curves.length && !p.points?.length) bad("graph shows nothing");
      for (const c of p.curves) {
        const nums = Object.values(c).filter((v) => typeof v === "number") as number[];
        if (!fin(...nums)) bad("a curve has a number that is not finite");
        if (c.f === "exponential" && !(c.base > 0)) bad("exponential base must be positive");
        if (c.f === "log" && !(c.base > 0 && c.base !== 1)) bad("log base must be positive and other than 1");
        if ((c.f === "sine" || c.f === "cosine") && !(c.period > 0)) bad("period must be positive");
        // Some of the curve must be on the graph.
        let seen = false;
        for (let i = 0; i <= 200 && !seen; i += 1) {
          const x = p.x[0] + ((p.x[1] - p.x[0]) * i) / 200;
          const v = y(c, x);
          if (Number.isFinite(v) && v >= p.y[0] && v <= p.y[1]) seen = true;
        }
        if (!seen) bad(`curve ${c.f} never appears inside the graph's window`);
      }
      for (const pt of p.points ?? []) if (pt.x < p.x[0] || pt.x > p.x[1] || pt.y < p.y[0] || pt.y > p.y[1]) bad(`point (${pt.x}, ${pt.y}) is outside the graph`);
      if (p.shade && !p.curves[p.shade.curve]) bad("shade names a curve that is missing");
      break;
    }
    case "area": {
      if (!p.rows.length || !p.cols.length) bad("area model needs rows and columns");
      if (p.cells.length !== p.rows.length || p.cells.some((r) => r.length !== p.cols.length)) bad("area cells must fill every row and column");
      break;
    }
    case "tape": {
      if (!p.bars.length) bad("bar model needs a bar");
      for (const b of p.bars) {
        if (!b.parts.length) bad(`bar "${b.label}" has no parts`);
        for (const x of b.parts) if (!(Number.isFinite(x.value) && x.value > 0)) bad(`part "${x.label}" needs a positive width`);
      }
      break;
    }
    case "table": {
      if (p.headers.length < 2 || p.rows.length < 2) bad("table needs two columns and two rows at least");
      if (p.rows.some((r) => r.length !== p.headers.length)) bad("every table row needs one cell per header");
      break;
    }
    case "chain": {
      if (p.steps.length < 2 || p.steps.length > 6) bad("chain needs two to six steps");
      break;
    }
    case "complexPlane": {
      if (!(p.max >= 1 && p.max <= 8)) bad("complex plane max must be 1 to 8");
      for (const pt of p.points) if (Math.abs(pt.re) > p.max || Math.abs(pt.im) > p.max) bad(`point ${pt.label} is off the plane`);
      break;
    }
    case "unitCircle": {
      if (!p.angles.length) bad("unit circle needs an angle");
      for (const a of p.angles) if (!EXACT_ANGLES.has(((a % 360) + 360) % 360)) bad(`angle ${a} has no exact point (use multiples of 30 or 45)`);
      break;
    }
  }
  return out;
}

export function checkAll(ideas: Record<string, SkillIdea>, skillIds: string[]): string[] {
  const out: string[] = [];
  for (const id of skillIds) if (!ideas[id]) out.push(`${id}: no idea written yet`);
  for (const id of Object.keys(ideas)) if (!skillIds.includes(id)) out.push(`${id}: no skill has this id`);
  for (const [id, s] of Object.entries(ideas)) out.push(...checkIdea(id, s));
  return out;
}

/** Checks one skill's worked examples: a plan and a check on each, reasons written out, the copy rules. */
export function checkExamples(id: string, list: { kind: string; plan?: string; check?: string; steps: { work: string; why: string }[] }[]): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(`${id}: ${m}`);
  list.forEach((ex, i) => {
    const at = `example ${i + 1} (${ex.kind})`;
    if (!ex.plan) bad(`${at} needs a plan`);
    else if (ex.plan.length < 50 || ex.plan.length > 320) bad(`${at} plan is ${ex.plan.length} characters; keep it 50 to 320`);
    if (!ex.check) bad(`${at} needs a check`);
    else if (ex.check.length < 30 || ex.check.length > 300) bad(`${at} check is ${ex.check.length} characters; keep it 30 to 300`);
    if (ex.steps.length < 2) bad(`${at} needs at least two steps`);
    for (const s of ex.steps) {
      if (s.why.length < 25) bad(`${at}: the why "${s.why}" is too short to explain anything (25 characters at least)`);
      if (s.why.length > 260) bad(`${at}: a why is ${s.why.length} characters; keep it under 260`);
    }
    for (const t of [ex.plan ?? "", ex.check ?? "", ...ex.steps.map((s) => s.why)]) {
      if (/[—–]/.test(t)) bad(`${at}: a dash (— or –) in "${t.slice(0, 40)}..."`);
      if (/\bbut\b/i.test(t)) bad(`${at}: "but" in "${t.slice(0, 40)}..."`);
    }
  });
  return out;
}

