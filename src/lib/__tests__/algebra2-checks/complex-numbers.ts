import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

/** One kind of minus, no spaces. */
const norm = (t: string) => t.replace(/[−–]/g, "-").replace(/\s+/g, "");

/** "3-4i", "-2+i", "5i", "7", "0" → {re, im}; anything else → null. */
function parseComplex(text: string): { re: number; im: number } | null {
  const s = norm(text);
  if (!/^[-+0-9i.]+$/.test(s)) return null;
  if (!s.includes("i")) {
    const n = Number(s);
    return Number.isFinite(n) ? { re: n, im: 0 } : null;
  }
  const m = s.match(/^(-?\d+(?:\.\d+)?(?=[+-]))?([+-]?\d*(?:\.\d+)?)i$/);
  if (!m) return null;
  const re = m[1] ? Number(m[1]) : 0;
  const imText = m[2] ?? "";
  const im = imText === "" || imText === "+" ? 1 : imText === "-" ? -1 : Number(imText);
  return Number.isFinite(re) && Number.isFinite(im) ? { re, im } : null;
}

/** "3i√2", "3i", "i√5", "i" → {k, m}; a real or malformed choice → null. */
function parseImRoot(text: string): { k: number; m: number } | null {
  const m = norm(text).match(/^(\d*)i(?:√(\d+))?$/);
  if (!m) return null;
  return { k: m[1] === "" ? 1 : Number(m[1]), m: m[2] ? Number(m[2]) : 1 };
}

function squareFree(m: number): boolean {
  for (let d = 2; d * d <= m; d++) if (m % (d * d) === 0) return false;
  return true;
}

const I_POWER = ["1", "i", "-1", "-i"];

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight } = h;
  const num = (t: string) => Number(norm(t));
  return {
    "imaginary-unit": (p) => {
      let m;
      if (p.type === "error-analysis") {
        if (!(m = p.prompt.match(/^Find the error in this simplification of √\(−(\d+)\)\.$/))) return "unread";
        const n = Number(m[1]);
        // The true simplification: k²·m = n with m square-free.
        let k = 1;
        for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) k = d;
        const mm = n / (k * k);
        const stepTrue = (s: string, idx: number): boolean => {
          const t = norm(s);
          let x;
          if (idx === 0) return t === `√(-${n})=√${n}·√(-1)`;
          if (idx === 1) {
            if (!(x = t.match(/^=(-?)√\((\d+)·(\d+)\)·?i?$/))) return false;
            // A minus in front, or no i, is only "true" if step 0 already went that way; step 0 is checked first.
            return x[1] === "" && t.endsWith("·i") && Number(x[2]) * Number(x[3]) === n;
          }
          const r = parseImRoot(t.replace(/^=/, ""));
          return !!r && r.k === k && r.m === mm;
        };
        const firstFalse = (p.steps as string[]).findIndex((s, idx) => !stepTrue(s, idx));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Simplify √\(−(\d+)\)\.$/))) {
        const n = Number(m[1]);
        return onlyRight(p, (c) => {
          const r = parseImRoot(c);
          return !!r && r.k * r.k * r.m === n && squareFree(r.m);
        });
      }
      if ((m = p.prompt.match(/^What is i\^(\d+)\?$/))) {
        const want = I_POWER[Number(m[1]) % 4];
        return onlyRight(p, (c) => norm(c) === want);
      }
      if ((m = p.prompt.match(/^Simplify \((\d+)i\)²\. Write a plain number\.$/))) return expectAnswer(p, -(Number(m[1]) ** 2));
      if ((m = p.prompt.match(/^Simplify \((\d+)i\)\((\d+)i\)\. Write a plain number\.$/))) return expectAnswer(p, -Number(m[1]) * Number(m[2]));
      if ((m = p.prompt.match(/^Simplify √\(−(\d+)\) · √\(−(\d+)\)\. Write a plain number\.$/))) {
        const [a, b] = [Math.sqrt(Number(m[1])), Math.sqrt(Number(m[2]))];
        if (!Number.isInteger(a) || !Number.isInteger(b)) return "the radicands are not perfect squares";
        return expectAnswer(p, -a * b);
      }
      return "unread";
    },

    "complex-arithmetic": (p) => {
      let m;
      if ((m = p.prompt.match(/^(Add|Subtract): \((.*)\) (\+|−) \((.*)\)\.$/))) {
        const z = parseComplex(m[2]);
        const w = parseComplex(m[4]);
        if (!z || !w) return "could not read the two numbers";
        const sign = m[1] === "Add" ? 1 : -1;
        const want = { re: z.re + sign * w.re, im: z.im + sign * w.im };
        return onlyRight(p, (c) => {
          const r = parseComplex(c);
          return !!r && r.re === want.re && r.im === want.im;
        });
      }
      if ((m = p.prompt.match(/^Multiply: \((.*)\)\((.*)\)\.$/))) {
        const z = parseComplex(m[1]);
        const w = parseComplex(m[2]);
        if (!z || !w) return "could not read the two numbers";
        const want = { re: z.re * w.re - z.im * w.im, im: z.re * w.im + z.im * w.re };
        return onlyRight(p, (c) => {
          const r = parseComplex(c);
          return !!r && r.re === want.re && r.im === want.im;
        });
      }
      if ((m = p.prompt.match(/^What is the (real|imaginary) part of \((.*)\)\((.*)\)\?$/))) {
        const z = parseComplex(m[2]);
        const w = parseComplex(m[3]);
        if (!z || !w) return "could not read the two numbers";
        return expectAnswer(p, m[1] === "real" ? z.re * w.re - z.im * w.im : z.re * w.im + z.im * w.re);
      }
      if ((m = p.prompt.match(/^Multiply \((.*)\) by its conjugate \((.*)\)\. Write a plain number\.$/))) {
        const z = parseComplex(m[1]);
        const w = parseComplex(m[2]);
        if (!z || !w) return "could not read the two numbers";
        if (z.re !== w.re || z.im !== -w.im) return "the second number is not the conjugate of the first";
        return expectAnswer(p, z.re * z.re + z.im * z.im);
      }
      return "unread";
    },

    "complex-roots": (p) => {
      let m;
      // Solve a·x² + c = 0 or x² = -c: x = ±k i√m.
      if ((m = p.prompt.match(/^Solve (?:(\d*)x² \+ (\d+) = 0|x² = -(\d+))\.$/))) {
        const a = m[1] === undefined ? 1 : m[1] === "" ? 1 : Number(m[1]);
        const c = Number(m[2] ?? m[3]) / a;
        if (!Number.isInteger(c)) return "c/a is not whole";
        return onlyRight(p, (choice) => {
          const t = norm(choice).match(/^x=±(.+)$/);
          if (!t) return false;
          const r = parseImRoot(t[1]);
          return !!r && r.k * r.k * r.m === c && squareFree(r.m);
        });
      }
      // x² + bx + c = 0 with complex roots p ± qi.
      if ((m = p.prompt.match(/^Solve x²( [+−] \d+x)?( [+−] \d+)? = 0\.$/))) {
        const term = (t: string | undefined) => (t ? Number(norm(t).replace("x", "")) : 0);
        const b = term(m[1]);
        const c = term(m[2]);
        const disc = b * b - 4 * c;
        if (disc >= 0) return "the roots are real";
        const re = -b / 2;
        const im = Math.sqrt(-disc) / 2;
        return onlyRight(p, (choice) => {
          const t = norm(choice).match(/^x=(-?\d+)±(\d*)i$/);
          if (!t) return false;
          const q = t[2] === "" ? 1 : Number(t[2]);
          return Number(t[1]) === re && h.close(q, im);
        });
      }
      if ((m = p.prompt.match(/^How many real solutions does (.*) = 0 have\?$/))) {
        const f = (x: number) => h.evaluate(m[1], { x });
        // Three samples pin down a, b, c.
        const [f0, f1, f2] = [f(0), f(1), f(-1)];
        const a = (f1 + f2) / 2 - f0;
        const b = (f1 - f2) / 2;
        const c = f0;
        const disc = b * b - 4 * a * c;
        return expectAnswer(p, disc < 0 ? 0 : disc === 0 ? 1 : 2);
      }
      if ((m = p.prompt.match(/^Find \|(.*)\|, the modulus of (.*)\.$/))) {
        const z = parseComplex(m[1]);
        if (!z || norm(m[1]) !== norm(m[2])) return "could not read the number";
        return expectAnswer(p, Math.sqrt(z.re * z.re + z.im * z.im));
      }
      void num;
      return "unread";
    },
  };
}
