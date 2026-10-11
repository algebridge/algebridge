import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

/** "x + 5" / "x − 5" → 5 / -5. */
function offset(t: string): number {
  const m = t.replace(/[−–]/g, "-").match(/^x\s*([+-])\s*(\d+)$/);
  if (!m) throw new Error(`not x ± a: ${t}`);
  return (m[1] === "-" ? -1 : 1) * Number(m[2]);
}
const ROOT: Record<string, number> = { "√": 2, "∛": 3, "⁴√": 4, "⁵√": 5, "⁶√": 6, "⁷√": 7 };
/** A power of x as (numerator, denominator) of its exponent: "x^(2/3)" → [2, 3], "x^4" → [4, 1]. */
function xExponent(c: string): [number, number] | null {
  let m = c.match(/^x\^\((-?\d+)\/(\d+)\)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = c.match(/^x\^(-?\d+)$/);
  if (m) return [Number(m[1]), 1];
  return null;
}

export default function checks(h: CheckHelpers): Checks {
  const num = (t: string) => Number(t.replace(/[−–]/g, "-").replace(/[(),]/g, ""));
  /** The value of a radical expression as these generators print it. */
  const radical = (t: string): number => {
    const s = t.replace(/^=\s*/, "").replace(/∛/g, "³√").replace(/×/g, "*");
    return h.evaluate(s);
  };
  return {
    "nth-roots": (p) => {
      let m;
      if ((m = p.prompt.match(/^Evaluate (∛|⁴√)\(?(-?\d+)\)?\.$/))) {
        const r = m[1] === "∛" ? Math.cbrt(Number(m[2])) : Math.sqrt(Math.sqrt(Number(m[2])));
        const want = Math.round(r);
        if (!h.close(want ** (m[1] === "∛" ? 3 : 4), Number(m[2]))) return "the number is not a perfect power";
        return h.expectAnswer(p, want);
      }
      if ((m = p.prompt.match(/^Simplify ∛(\d+)\.$/))) {
        const n = Number(m[1]);
        // k∛m with m cube-free, as the only right form.
        return h.onlyRight(p, (c) => {
          const mm = c.match(/^(\d+)∛(\d+)$/);
          if (!mm) return false;
          const [k, r] = [Number(mm[1]), Number(mm[2])];
          if (k ** 3 * r !== n) return false;
          for (let d = 2; d ** 3 <= r; d += 1) if (r % d ** 3 === 0) return false;
          return true;
        });
      }
      if ((m = p.prompt.match(/^Simplify (\d+)∛(\d+) \+ (\d+)∛(\d+) − (\d+)∛(\d+)\.$/))) {
        if (m[2] !== m[4] || m[4] !== m[6]) return "the radicands differ";
        const want = Number(m[1]) + Number(m[3]) - Number(m[5]);
        return h.onlyRight(p, (c) => {
          const mm = c.match(/^(\d+)∛(\d+)$/);
          return !!mm && Number(mm[1]) === want && mm[2] === m[2];
        });
      }
      if ((m = p.prompt.match(/^∛(\d+) lies between two consecutive whole numbers\. What is the smaller one\?$/))) {
        return h.expectAnswer(p, Math.floor(Math.cbrt(Number(m[1])) + 1e-9));
      }
      if ((m = p.prompt.match(/^Find the error in this simplification of ∛(\d+)\.$/))) {
        const want = Math.cbrt(Number(m[1]));
        const firstFalse = p.steps.findIndex((s: string) => {
          try {
            // The first step is "∛n = ∛(a × b)"; later steps are "= ...".
            const right = s.includes("=") && !s.startsWith("=") ? s.split("=")[1] : s;
            return !h.close(radical(right), want);
          } catch {
            return true;
          }
        });
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      return "unread";
    },
    "rational-exponents-evaluate": (p) => {
      let m;
      if ((m = p.prompt.match(/^Evaluate (\d+)\^\((−?)(\d+)\/(\d+)\)\.( \(write as a fraction or decimal\))?$/))) {
        const [b, pw, q] = [Number(m[1]), Number(m[3]), Number(m[4])];
        const r = Math.round(b ** (1 / q));
        if (r ** q !== b) return "the base is not a perfect power";
        return h.expectAnswer(p, m[2] ? 1 / r ** pw : r ** pw);
      }
      if ((m = p.prompt.match(/^Write (√|∛|⁴√|⁵√|⁶√|⁷√)\(x\^(\d+)\) using a rational exponent\.$/))) {
        const [q, pw] = [ROOT[m[1]], Number(m[2])];
        return h.onlyRight(p, (c) => {
          const e = xExponent(c);
          return !!e && h.close(e[0] / e[1], pw / q);
        });
      }
      if ((m = p.prompt.match(/^Write x\^\((\d+)\/(\d+)\) as a radical\.$/))) {
        const [pw, q] = [Number(m[1]), Number(m[2])];
        return h.onlyRight(p, (c) => {
          const mm = c.match(/^(√|∛|⁴√|⁵√|⁶√|⁷√)\(x\^(\d+)\)$/);
          return !!mm && h.close(Number(mm[2]) / ROOT[mm[1]], pw / q);
        });
      }
      if ((m = p.prompt.match(/^Simplify x\^\((\d+)\/(\d+)\) · x\^\((\d+)\/(\d+)\)\.$/))) {
        const want = Number(m[1]) / Number(m[2]) + Number(m[3]) / Number(m[4]);
        return h.onlyRight(p, (c) => {
          const e = xExponent(c);
          return !!e && h.close(e[0] / e[1], want);
        });
      }
      if ((m = p.prompt.match(/^Simplify \(x\^\((\d+)\/(\d+)\)\)\^(\d+)\.$/))) {
        const want = (Number(m[1]) / Number(m[2])) * Number(m[3]);
        return h.onlyRight(p, (c) => {
          const e = xExponent(c);
          return !!e && h.close(e[0] / e[1], want);
        });
      }
      return "unread";
    },
    "radical-equations": (p) => {
      let m;
      if ((m = p.prompt.match(/^Solve √\((x [+−] \d+)\) = (\d+)\.$/))) {
        return h.expectAnswer(p, Number(m[2]) ** 2 - offset(m[1]));
      }
      if ((m = p.prompt.match(/^Solve √\((\d+)x ([+−]) (\d+)\) \+ (\d+) = (\d+)\.$/))) {
        const [a, b, d, c] = [Number(m[1]), (m[2] === "−" ? -1 : 1) * Number(m[3]), Number(m[4]), Number(m[5])];
        const r = c - d;
        if (r < 0) return "the radical would be negative";
        return h.expectAnswer(p, (r * r - b) / a);
      }
      if ((m = p.prompt.match(/^Find the error in this solution of √\((x [+−] \d+)\) = (\d+)\.$/))) {
        const x = Number(m[2]) ** 2 - offset(m[1]);
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
      if ((m = p.prompt.match(/^Solving √\((x [+−] \d+)\) = (x [+−] \d+) by squaring gives x = (-?\d+) or x = (-?\d+)\. Which one checks in the original equation\?$/))) {
        const [a, c] = [offset(m[1]), offset(m[2])];
        const checks = [Number(m[3]), Number(m[4])].filter((x) => x + a >= 0 && x + c >= 0 && h.close(Math.sqrt(x + a), x + c));
        if (checks.length !== 1) return `${checks.length} of the two values check`;
        return h.expectAnswer(p, checks[0]);
      }
      if ((m = p.prompt.match(/^Solve ∛\((x [+−] \d+)\) = (−?\d+)\.$/))) {
        return h.expectAnswer(p, num(m[2]) ** 3 - offset(m[1]));
      }
      return "unread";
    },
  };
}
