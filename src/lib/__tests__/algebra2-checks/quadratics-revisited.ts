import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight, close, evaluate } = h;
  const ev = (expr: string, x: number) => evaluate(expr, { x });
  /** ax² + bx + c from any expression in x that is a quadratic (or linear). */
  const coeffs = (expr: string): [number, number, number] => {
    const c = ev(expr, 0);
    const a = (ev(expr, 1) + ev(expr, -1) - 2 * c) / 2;
    const b = (ev(expr, 1) - ev(expr, -1)) / 2;
    if (!close(ev(expr, 2), 4 * a + 2 * b + c) || !close(ev(expr, -3), 9 * a - 3 * b + c)) throw new Error(`not a quadratic: ${expr}`);
    return [a, b, c];
  };
  const samePoly = (p: string, q: string) => [-3, -1, 0, 1, 2, 5, 7].every((x) => close(ev(p, x), ev(q, x)));
  const rhs = (step: string) => step.slice(step.lastIndexOf("=") + 1).trim();
  const vertexShape = /^y = -?\d*\(x [+−] \d+\)²( [+−] \d+)?$/;
  const n = (t: string) => Number(t.replace(/[−–]/g, "-"));

  return {
    "vertex-form": (p) => {
      let m;
      if ((m = p.prompt.match(/^What is the vertex of y = (.*)\?$/))) {
        const [a, b] = coeffs(m[1]);
        const hx = -b / (2 * a);
        const k = ev(m[1], hx);
        return onlyRight(p, (c) => {
          const mm = c.replace(/[−–]/g, "-").match(/^\((-?[\d.]+), (-?[\d.]+)\)$/);
          return !!mm && close(Number(mm[1]), hx) && close(Number(mm[2]), k);
        });
      }
      if ((m = p.prompt.match(/^What is the (smallest|largest) value y can take for y = (.*)\?$/))) {
        const [a, b] = coeffs(m[2]);
        if ((m[1] === "smallest") !== a > 0) return "the word does not match the sign of a";
        return expectAnswer(p, ev(m[2], -b / (2 * a)));
      }
      if ((m = p.prompt.match(/^Write y = (.*) in vertex form\.$/))) {
        const src = m[1];
        return onlyRight(p, (c) => vertexShape.test(c) && samePoly(c.slice(4), src));
      }
      if ((m = p.prompt.match(/^For y = (.*), what is y when x = (-?\d+)\?$/))) {
        return expectAnswer(p, ev(m[1], n(m[2])));
      }
      if (p.type === "error-analysis" && (m = p.prompt.match(/^Find the error in this rewriting of y = (.*) in vertex form\.$/))) {
        const src = m[1];
        const firstFalse = p.steps.findIndex((s: string) => {
          try {
            return !samePoly(rhs(s), src);
          } catch {
            return true;
          }
        });
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      return "unread";
    },

    discriminant: (p) => {
      let m;
      const disc = (expr: string) => {
        const [a, b, c] = coeffs(expr);
        return b * b - 4 * a * c;
      };
      if ((m = p.prompt.match(/^What is the discriminant of (.*) = 0\?$/))) return expectAnswer(p, disc(m[1]));
      if ((m = p.prompt.match(/^How many solutions does (.*) = 0 have, and what kind\? Use the discriminant\.$/))) {
        const D = disc(m[1]);
        const want = D > 0 ? "Two real solutions" : D === 0 ? "One real solution" : "Two complex solutions";
        return onlyRight(p, (c) => c === want);
      }
      if ((m = p.prompt.match(/^For what value of c does (.*) \+ c = 0 have exactly one real solution\?$/))) {
        const [a, b, c0] = coeffs(m[1]);
        if (!close(c0, 0)) return "the shown part already has a constant";
        return expectAnswer(p, (b * b) / (4 * a));
      }
      if (p.prompt === "Which equation has exactly one real solution?") {
        return onlyRight(p, (c) => {
          const mm = c.match(/^(.*) = 0$/);
          return !!mm && close(disc(mm[1]), 0);
        });
      }
      if (p.type === "error-analysis" && (m = p.prompt.match(/^Find the error in this computation of the discriminant of (.*) = 0\.$/))) {
        const [a, b, c] = coeffs(m[1]);
        const D = b * b - 4 * a * c;
        const stepTrue = (s: string, k: number) => {
          try {
            if (k === 0) {
              const mm = s.replace(/[−–]/g, "-").match(/^a = (-?\d+), b = (-?\d+), c = (-?\d+)$/);
              return !!mm && Number(mm[1]) === a && Number(mm[2]) === b && Number(mm[3]) === c;
            }
            return close(evaluate(rhs(s)), D);
          } catch {
            return false;
          }
        };
        const firstFalse = p.steps.findIndex((s: string, k: number) => !stepTrue(s, k));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      return "unread";
    },

    "linear-quadratic-systems": (p) => {
      let m;
      /** The quadratic P(x) − L(x) as coefficients and its whole roots. */
      const diff = (P: string, L: string) => {
        const [a1, b1, c1] = coeffs(P);
        const [a2, b2, c2] = coeffs(L);
        const [A, B, C] = [a1 - a2, b1 - b2, c1 - c2];
        const D = B * B - 4 * A * C;
        const roots: number[] = [];
        for (let x = -80; x <= 80; x++) if (close(A * x * x + B * x + C, 0)) roots.push(x);
        return { A, B, C, D, roots };
      };
      if ((m = p.prompt.match(/^How many points do y = (.*) and y = (.*) share\?$/))) {
        const { D } = diff(m[1], m[2]);
        return expectAnswer(p, D > 0 ? 2 : D === 0 ? 1 : 0);
      }
      if ((m = p.prompt.match(/^At which x-values do y = (.*) and y = (.*) meet\?$/))) {
        const [P, L] = [m[1], m[2]];
        return onlyRight(p, (c) => {
          const mm = c.replace(/[−–]/g, "-").match(/^x = (-?\d+) and x = (-?\d+)$/);
          if (!mm) return false;
          const [x1, x2] = [Number(mm[1]), Number(mm[2])];
          return x1 !== x2 && close(ev(P, x1), ev(L, x1)) && close(ev(P, x2), ev(L, x2));
        });
      }
      if ((m = p.prompt.match(/^A ball is thrown up\. Its height after t seconds is h = -16t² \+ (\d+)t feet\. After how many seconds does it first reach (\d+) feet\?$/))) {
        const [v, H] = [Number(m[1]), Number(m[2])];
        const D = v * v - 64 * H;
        if (D < 0) return "the ball never reaches that height";
        return expectAnswer(p, (v - Math.sqrt(D)) / 32);
      }
      if ((m = p.prompt.match(/^The line y = (.*) touches y = (.*) at exactly one point\. What is the x-coordinate of that point\?$/))) {
        const { A, B, D } = diff(m[2], m[1]);
        if (!close(D, 0)) return "the line is not tangent";
        return expectAnswer(p, -B / (2 * A));
      }
      if ((m = p.prompt.match(/^y = (.*) and y = (.*) meet at two points\. What is the larger of the two y-values\?$/))) {
        const { roots } = diff(m[1], m[2]);
        if (roots.length !== 2) return `${roots.length} whole meeting points`;
        return expectAnswer(p, Math.max(...roots.map((x) => ev(m[2], x))));
      }
      return "unread";
    },
  };
}
