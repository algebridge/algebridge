import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight, close, evaluate } = h;
  const SAMPLES = [-11, -7, -3.5, -1, 0.5, 2, 4.5, 9, 13];
  /** An expression that may hold one "÷": each side is a fraction, so divide the sides. */
  const ev = (expr: string, x: number): number => {
    const parts = expr.split("÷");
    let v = evaluate(parts[0], { x });
    for (const part of parts.slice(1)) v /= evaluate(part, { x });
    return v;
  };
  /** Two rational expressions agree wherever both are finite (at least 5 sample points). */
  const sameRational = (p: string, q: string): boolean => {
    let agreed = 0;
    for (const x of SAMPLES) {
      let a: number;
      let b: number;
      try {
        a = ev(p, x);
        b = ev(q, x);
      } catch {
        return false;
      }
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (!close(a, b)) return false;
      agreed++;
    }
    return agreed >= 5;
  };
  const zerosOf = (expr: string): number[] => {
    const out: number[] = [];
    for (let x = -60; x <= 60; x++) if (close(evaluate(expr, { x }), 0)) out.push(x);
    return out;
  };
  const valuesIn = (choice: string): number[] => [...choice.replace(/[−–]/g, "-").matchAll(/x = (-?\d+)/g)].map((mm) => Number(mm[1]));
  const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, k) => v === [...b].sort((x, y) => x - y)[k]);
  /** "x − 3" → the number that makes it zero (3). */
  const zeroOf = (sign: string, digits: string) => (sign === "−" ? Number(digits) : -Number(digits));
  const rhs = (step: string) => step.slice(step.lastIndexOf("=") + 1).trim();
  const n = (t: string) => Number(t.replace(/[−–]/g, "-"));

  return {
    "simplify-rational": (p) => {
      let m;
      if ((m = p.prompt.match(/^Which values of x are excluded from the domain of \((.*)\)\/\((.*)\)\?$/))) {
        const zeros = zerosOf(m[2]);
        if (zeros.length === 0) return "the bottom has no whole zeros";
        return onlyRight(p, (c) => sameSet(valuesIn(c), zeros));
      }
      if ((m = p.prompt.match(/^Simplify \((.*)\)\/\((.*)\), then find its value when x = (-?\d+)\.$/))) {
        const x = n(m[3]);
        const bottom = evaluate(m[2], { x });
        if (close(bottom, 0)) return "the value is undefined there";
        return expectAnswer(p, evaluate(m[1], { x }) / bottom);
      }
      if ((m = p.prompt.match(/^Simplify \((.*)\)\/\((.*)\)\.$/))) {
        const src = `(${m[1]})/(${m[2]})`;
        return onlyRight(p, (c) => sameRational(c, src));
      }
      if (p.type === "error-analysis" && (m = p.prompt.match(/^Find the error in this simplification of \((.*)\)\/\((.*)\)\.$/))) {
        const src = `(${m[1]})/(${m[2]})`;
        const firstFalse = p.steps.findIndex((s: string) => !sameRational(rhs(s), src));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      return "unread";
    },

    "multiply-divide-rational": (p) => {
      let m;
      if ((m = p.prompt.match(/^Simplify (.*), then find its value when x = (-?\d+)\.(?: \(write as a fraction or decimal\))?$/))) {
        const v = ev(m[1], n(m[2]));
        if (!Number.isFinite(v)) return "the value is undefined there";
        return expectAnswer(p, v);
      }
      if ((m = p.prompt.match(/^(?:Multiply|Divide) and simplify: (.*)$/))) {
        const src = m[1];
        return onlyRight(p, (c) => sameRational(c, src));
      }
      return "unread";
    },

    "rational-equations": (p) => {
      let m;
      if ((m = p.prompt.match(/^Solve (-?\d+)\/x(?: ([+−]) (\d+))? = (-?\d+)\.$/))) {
        const a = n(m[1]);
        const b = m[2] ? (m[2] === "−" ? -Number(m[3]) : Number(m[3])) : 0;
        const c = n(m[4]);
        if (c === b) return "the fraction would have to be 0";
        return expectAnswer(p, a / (c - b));
      }
      if ((m = p.prompt.match(/^Solve \(x ([+−]) (\d+)\)\/(\d+) = (\d+)\/(\d+)\.$/))) {
        const a = m[1] === "−" ? -Number(m[2]) : Number(m[2]);
        const [b, c, d] = [Number(m[3]), Number(m[4]), Number(m[5])];
        return expectAnswer(p, (b * c) / d - a);
      }
      if ((m = p.prompt.match(/^Solve \((.*)\)\/\(x ([+−]) (\d+)\) = (\d+)\/\(x ([+−]) (\d+)\)\. Which solution of the cleared equation must be rejected as extraneous\?$/))) {
        const r = zeroOf(m[2], m[3]);
        if (r !== zeroOf(m[5], m[6])) return "the two bottoms differ";
        // The cleared equation must actually have r as a root, or there is nothing to reject.
        if (!close(evaluate(m[1], { x: r }) - Number(m[4]), 0)) return "the excluded value is not a root of the cleared equation";
        return onlyRight(p, (c) => {
          const vals = valuesIn(c);
          return vals.length === 1 && vals[0] === r;
        });
      }
      if ((m = p.prompt.match(/^\w+ can .+ in (\d+) hours and \w+ can do it in (\d+) hours\. Working together, how many hours do they need\? \(round to the nearest tenth\)$/))) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        return expectAnswer(p, (a * b) / (a + b));
      }
      if ((m = p.prompt.match(/^Solve (\d+)\/\(x ([+−]) (\d+)\) = (\d+)\/\(x ([+−]) (\d+)\)\.$/))) {
        const [a, b] = [Number(m[1]), Number(m[4])];
        const pp = m[2] === "−" ? -Number(m[3]) : Number(m[3]);
        const q = m[5] === "−" ? -Number(m[6]) : Number(m[6]);
        if (a === b) return "no single solution";
        const x = (b * pp - a * q) / (a - b);
        if (x + pp === 0 || x + q === 0) return "the solution makes a bottom zero";
        return expectAnswer(p, x);
      }
      return "unread";
    },
  };
}
