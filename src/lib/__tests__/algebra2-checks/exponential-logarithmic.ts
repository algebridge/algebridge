import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** "log₁₀" → 10. */
function baseOf(t: string): number {
  return Number([...t.replace(/^log/, "")].map((ch) => SUBS.indexOf(ch)).join(""));
}
/** "x³y²" → an expression Math can evaluate at x and y. */
function toJs(t: string): string {
  return t
    .replace(/[−–]/g, "-")
    .replace(/×|·/g, "*")
    .replace(/([xy])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, v, e) => `${v}**${[...e].map((ch: string) => SUPS.indexOf(ch)).join("")}`)
    .replace(/log\s*\(/g, "L(")
    .replace(/log\s+([xy])/g, "L($1)")
    .replace(/(\d)\s*([xyL(])/g, "$1*$2")
    .replace(/\)\s*\(/g, ")*(")
    .replace(/([xy])\s*([xy])/g, "$1*$2")
    .replace(/([xy)])\s*L/g, "$1*L");
}
const isPow = (n: number, b: number) => Math.abs(Math.log(n) / Math.log(b) - Math.round(Math.log(n) / Math.log(b))) < 1e-9;

export default function checks(h: CheckHelpers): Checks {
  const n = (t: string) => Number(t.replace(/,/g, "").replace(/[−–]/g, "-"));
  const logIn = (t: string, b: number) => {
    const m = t.match(/^1\/(\d+)$/);
    const v = m ? 1 / Number(m[1]) : Number(t);
    const k = Math.log(v) / Math.log(b);
    if (!h.close(k, Math.round(k))) throw new Error(`${t} is not a power of ${b}`);
    return Math.round(k);
  };
  /** A log expression in x and y evaluated at a point, with L = log base 10. */
  const logExpr = (t: string, x: number, y: number): number => {
    const js = toJs(t);
    if (!/^[\d\sxyL()*+\-/.]*$/.test(js)) return NaN;
    try {
      return new Function("x", "y", "L", `return (${js});`)(x, y, Math.log10) as number;
    } catch {
      return NaN;
    }
  };
  const sameLogExpr = (a: string, b: string) => [[2.3, 1.7], [5.1, 3.9], [1.2, 7.3]].every(([x, y]) => h.close(logExpr(a, x, y), logExpr(b, x, y)));
  return {
    "log-basics": (p) => {
      let m;
      if ((m = p.prompt.match(/^Evaluate (log[₀-₉]+)\((1\/\d+|\d+)\)\.$/))) {
        return h.expectAnswer(p, logIn(m[2], baseOf(m[1])));
      }
      if ((m = p.prompt.match(/^Write (\d+)\^(\d+) = (\d+) in logarithmic form\.$/))) {
        const [b, k, v] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (b ** k !== v) return "the power is wrong";
        return h.onlyRight(p, (c) => {
          const mm = c.match(/^(log[₀-₉]+)\((\d+)\) = (\d+)$/);
          return !!mm && baseOf(mm[1]) === b && Number(mm[2]) === v && Number(mm[3]) === k;
        });
      }
      if ((m = p.prompt.match(/^Write (log[₀-₉]+)\((\d+)\) = (\d+) in exponential form\.$/))) {
        const [b, v, k] = [baseOf(m[1]), Number(m[2]), Number(m[3])];
        if (b ** k !== v) return "the log is wrong";
        return h.onlyRight(p, (c) => {
          const mm = c.match(/^(\d+)\^(\d+) = (\d+)$/);
          return !!mm && Number(mm[1]) === b && Number(mm[2]) === k && Number(mm[3]) === v;
        });
      }
      if ((m = p.prompt.match(/^Evaluate (ln|log)\((e|10)\^\((−?\d+)\)\)\.$/))) {
        if ((m[1] === "ln") !== (m[2] === "e")) return "ln goes with e and log with 10";
        return h.expectAnswer(p, n(m[3]));
      }
      if ((m = p.prompt.match(/^Evaluate (e|10)\^\((ln|log) (\d+)\)\.$/))) {
        if ((m[1] === "e") !== (m[2] === "ln")) return "ln goes with e and log with 10";
        return h.expectAnswer(p, Number(m[3]));
      }
      if ((m = p.prompt.match(/^Solve for the base b: log_b\((\d+)\) = (\d+)\.$/))) {
        const b = Math.round(Number(m[1]) ** (1 / Number(m[2])));
        if (b ** Number(m[2]) !== Number(m[1])) return "no whole base works";
        return h.expectAnswer(p, b);
      }
      if ((m = p.prompt.match(/^Solve (log[₀-₉]+)\(x\) = (\d+)\.$/))) {
        return h.expectAnswer(p, baseOf(m[1]) ** Number(m[2]));
      }
      return "unread";
    },
    "log-properties": (p) => {
      let m;
      if ((m = p.prompt.match(/^Expand log\((x[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:\/|)y[⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)\.$/))) {
        const inside = `log(${m[1]})`;
        return h.onlyRight(p, (c) => !c.includes("(") || /^\d+ log x [+−] \d+ log y$/.test(c) ? sameLogExpr(c, inside) : false);
      }
      if ((m = p.prompt.match(/^Write (\d+ log x [+−] \d+ log y) as a single logarithm\.$/))) {
        const expr = m[1];
        return h.onlyRight(p, (c) => /^log\([^()]*\)$/.test(c) && sameLogExpr(c, expr));
      }
      if ((m = p.prompt.match(/^Given log_b\(2\) ≈ ([\d.]+) and log_b\(3\) ≈ ([\d.]+), find log_b\((\d+|\d+\/\d+)\)\. \(round to the nearest hundredth\)$/))) {
        const [P, Q] = [Number(m[1]), Number(m[2])];
        const [top, bottom] = m[3].includes("/") ? m[3].split("/").map(Number) : [Number(m[3]), 1];
        const count = (v: number, f: number) => {
          let e = 0;
          while (v % f === 0 && v > 1) {
            v /= f;
            e += 1;
          }
          return [e, v] as const;
        };
        let [u, rest] = count(top, 2);
        let [v, rest2] = count(rest, 3);
        if (rest2 !== 1) return "the number is not made of 2s and 3s";
        const [u2, r3] = count(bottom, 2);
        const [v2, r4] = count(r3, 3);
        if (r4 !== 1) return "the denominator is not made of 2s and 3s";
        u -= u2;
        v -= v2;
        return h.expectAnswer(p, u * P + v * Q);
      }
      if ((m = p.prompt.match(/^Evaluate (log[₀-₉]+)\((\d+)\) \+ (log[₀-₉]+)\((\d+)\)\.$/))) {
        const b = baseOf(m[1]);
        if (baseOf(m[3]) !== b) return "the bases differ";
        if (isPow(Number(m[2]), b) || isPow(Number(m[4]), b)) return "one of the numbers is already a power of the base";
        return h.expectAnswer(p, logIn(String(Number(m[2]) * Number(m[4])), b));
      }
      if ((m = p.prompt.match(/^Evaluate (log[₀-₉]+)\((\d+)\) − (log[₀-₉]+)\((\d+)\)\.$/))) {
        const b = baseOf(m[1]);
        if (baseOf(m[3]) !== b) return "the bases differ";
        if (isPow(Number(m[2]), b)) return "the first number is already a power of the base";
        return h.expectAnswer(p, logIn(String(Number(m[2]) / Number(m[4])), b));
      }
      if ((m = p.prompt.match(/^Evaluate (log[₀-₉]+)\((√|∛)(\d+)\)\.( \(write as a fraction or decimal\))?$/))) {
        const k = logIn(m[3], baseOf(m[1]));
        return h.expectAnswer(p, k / (m[2] === "√" ? 2 : 3));
      }
      return "unread";
    },
    "solve-exponential-equations": (p) => {
      let m;
      if ((m = p.prompt.match(/^Solve (\d+)\^x = (1\/\d+|\d+)\.( \(write as a fraction or decimal\))?$/))) {
        const L = Number(m[1]);
        const R = m[2].startsWith("1/") ? 1 / Number(m[2].slice(2)) : Number(m[2]);
        return h.expectAnswer(p, Math.log(R) / Math.log(L));
      }
      if ((m = p.prompt.match(/^Solve (\d+)\^\(([^()]+)\) = (\d+)\.$/))) {
        const b = Number(m[1]);
        const k = logIn(m[3], b);
        const g = (x: number) => h.evaluate(m![2], { x });
        const slope = g(1) - g(0);
        return h.expectAnswer(p, (k - g(0)) / slope);
      }
      if ((m = p.prompt.match(/^Solve (\d+)\^x = (\d+) for x\. \(round to the nearest hundredth\)$/))) {
        return h.expectAnswer(p, Math.log(Number(m[2])) / Math.log(Number(m[1])));
      }
      if ((m = p.prompt.match(/^Solve (\d+) · ([\d.]+)\^x = (\d+) for x\. \(round to the nearest hundredth\)$/))) {
        return h.expectAnswer(p, Math.log(Number(m[3]) / Number(m[1])) / Math.log(Number(m[2])));
      }
      if ((m = p.prompt.match(/^A culture of ([\d,]+) bacteria (doubles|triples) every (\d+) hours\. After how many hours will there be ([\d,]+) bacteria\? \(round to the nearest tenth\)$/))) {
        const f = m[2] === "doubles" ? 2 : 3;
        return h.expectAnswer(p, (Number(m[3]) * Math.log(n(m[4]) / n(m[1]))) / Math.log(f));
      }
      if ((m = p.prompt.match(/^Find the error in this solution of (\d+)\^\(([^()]+)\) = (\d+)\.$/))) {
        const b = Number(m[1]);
        const k = logIn(m[3], b);
        const g = (x: number) => h.evaluate(m![2], { x });
        const x = (k - g(0)) / (g(1) - g(0));
        const stepTrue = (s: string) => {
          const [l, r] = s.split("=");
          try {
            return h.close(h.evaluate(l, { x }), h.evaluate(r, { x }));
          } catch {
            return false;
          }
        };
        const firstFalse = p.steps.findIndex((s: string) => !stepTrue(s));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      return "unread";
    },
  };
}
