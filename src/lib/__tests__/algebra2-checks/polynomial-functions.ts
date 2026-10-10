import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

const SUPS: Record<string, string> = { "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** One kind of minus, carets for superscripts, no spaces. */
const norm = (t: string) =>
  t
    .replace(/[−–]/g, "-")
    .replace(/[²³⁴⁵⁶⁷⁸⁹]/g, (ch) => `^${SUPS[ch]}`)
    .replace(/\s+/g, "");

/** "x^3-2x^2+5" → coefficients by power, [5, 0, -2, 1]; null when it is not a polynomial in x. */
function parsePoly(text: string): number[] | null {
  let s = norm(text);
  if (s === "") return null;
  if (!/^[+-]/.test(s)) s = `+${s}`;
  const terms = s.match(/[+-][^+-]+/g);
  if (!terms || terms.join("") !== s) return null;
  const coeffs: number[] = [];
  for (const t of terms) {
    const m = t.match(/^([+-])(\d+(?:\.\d+)?)?(?:(x)(?:\^(\d+))?)?$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const size = m[2] === undefined ? (m[3] ? 1 : NaN) : Number(m[2]);
    if (!Number.isFinite(size)) return null;
    const power = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
    while (coeffs.length <= power) coeffs.push(0);
    coeffs[power] += sign * size;
  }
  while (coeffs.length > 1 && coeffs[coeffs.length - 1] === 0) coeffs.pop();
  return coeffs;
}

const degreeOf = (c: number[]) => c.length - 1;
const leadOf = (c: number[]) => c[c.length - 1];
const at = (c: number[], x: number) => c.reduce((acc, v, idx) => acc + v * x ** idx, 0);
const samePoly = (a: number[], b: number[]) => a.length === b.length && a.every((v, idx) => v === b[idx]);

/** "x − 3" → 3, "x + 3" → -3 (the k of x − k). */
function kOf(div: string): number | null {
  const m = norm(div).match(/^x([+-]\d+)$/);
  return m ? -Number(m[1]) : null;
}

/** Synthetic division of a polynomial (by power) by x − k: quotient (by power) and remainder. */
function divide(c: number[], k: number): { q: number[]; r: number } {
  const high = [...c].reverse();
  const row: number[] = [];
  let carry = 0;
  for (const v of high) {
    carry = v + carry * k;
    row.push(carry);
  }
  return { q: row.slice(0, -1).reverse(), r: row[row.length - 1] };
}

/** Integer roots of a polynomial, each listed once, from a search of -20..20. */
function intRoots(c: number[]): number[] {
  const out: number[] = [];
  for (let x = -20; x <= 20; x++) if (at(c, x) === 0) out.push(x);
  return out;
}

const END = {
  upUp: "as x → ∞, y → ∞ and as x → −∞, y → ∞",
  downDown: "as x → ∞, y → −∞ and as x → −∞, y → −∞",
  upDown: "as x → ∞, y → ∞ and as x → −∞, y → −∞",
  downUp: "as x → ∞, y → −∞ and as x → −∞, y → ∞",
};
const DEGREE_NAME = ["constant", "linear", "quadratic", "cubic", "quartic", "quintic"];
const TERMS_NAME = ["", "monomial", "binomial", "trinomial", "polynomial with 4 terms"];

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight } = h;
  return {
    "polynomial-end-behavior": (p) => {
      let m;
      if ((m = p.prompt.match(/^P\(x\) = (.*)\. What is the (degree|leading coefficient) of P\(x\)\?$/))) {
        const text = m[1];
        if (/^\(/.test(text)) {
          // A product of factors: the degree is the sum of the exponents.
          const factors = text.match(/\(x [+−] \d+\)[²³⁴⁵⁶⁷]?/g);
          if (!factors || factors.join("") !== text) return "could not read the factors";
          const deg = factors.reduce((s, f) => s + (f.endsWith(")") ? 1 : Number(SUPS[f[f.length - 1]])), 0);
          return m[2] === "degree" ? expectAnswer(p, deg) : "a factored polynomial asks for its degree only";
        }
        const c = parsePoly(text);
        if (!c) return "could not read the polynomial";
        return expectAnswer(p, m[2] === "degree" ? degreeOf(c) : leadOf(c));
      }
      if ((m = p.prompt.match(/^Describe the end behavior of P\(x\) = (.*)\.$/))) {
        const c = parsePoly(m[1]);
        if (!c) return "could not read the polynomial";
        const even = degreeOf(c) % 2 === 0;
        const up = leadOf(c) > 0;
        const want = even ? (up ? END.upUp : END.downDown) : up ? END.upDown : END.downUp;
        return onlyRight(p, (choice) => norm(choice) === norm(want));
      }
      if ((m = p.prompt.match(/^Classify P\(x\) = (.*) by its degree and its number of terms\.$/))) {
        const c = parsePoly(m[1]);
        if (!c) return "could not read the polynomial";
        const terms = c.filter((v) => v !== 0).length;
        const want = `${DEGREE_NAME[degreeOf(c)]} ${TERMS_NAME[terms]}`;
        return onlyRight(p, (choice) => choice.trim() === want);
      }
      if ((m = p.prompt.match(/^A polynomial has degree (\d+) and leading coefficient (-?\d+)\. As x → (−∞|∞), what happens to y\?$/))) {
        const deg = Number(m[1]);
        const lead = Number(m[2]);
        const left = m[3] === "−∞";
        const up = left ? (deg % 2 === 0 ? lead > 0 : lead < 0) : lead > 0;
        return onlyRight(p, (choice) => norm(choice) === (up ? "y→∞" : "y→-∞"));
      }
      return "unread";
    },

    "polynomial-division": (p) => {
      let m;
      if (p.type === "error-analysis") {
        if (!(m = p.prompt.match(/^Find the error in this synthetic division of P\(x\) = (.*) by \((.*)\)\.$/))) return "unread";
        const c = parsePoly(m[1]);
        const k = kOf(m[2]);
        if (!c || k === null) return "could not read the division";
        const high = [...c].reverse();
        const stepTrue = (s: string, idx: number): boolean => {
          const t = norm(s);
          let x;
          if (idx === 0) {
            x = t.match(/^Coefficients(-?\d+),(-?\d+),(-?\d+),(-?\d+);thedivisorx[+-]\d+puts(-?\d+)inthebox\.$/);
            return !!x && [1, 2, 3, 4].every((g) => Number(x![g]) === high[g - 1]) && Number(x[5]) === k;
          }
          // "<left> × k = <prod>; <coef> ± |prod| = <sum>" with the step's own numbers checked against each other and the coefficients.
          x = t.replace(/^Bringdown(-?\d+)\./, "").match(/^(-?\d+)×(-?\d+)=(-?\d+);(-?\d+)([+-]\d+)=(-?\d+)(,theremainder\.)?$/);
          if (!x) return false;
          const [left, box, prod, coefficient, added, sum] = [1, 2, 3, 4, 5, 6].map((g) => Number(x![g]));
          const expectedLeft = idx === 1 ? high[0] : divide(c, k).q.slice().reverse()[idx - 1];
          return box === k && left === expectedLeft && prod === left * k && coefficient === high[idx] && added === prod && sum === coefficient + prod;
        };
        const firstFalse = (p.steps as string[]).findIndex((s, idx) => !stepTrue(s, idx));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Use synthetic division to divide P\(x\) = (.*) by \((.*)\)\. What is the remainder\?$/))) {
        const c = parsePoly(m[1]);
        const k = kOf(m[2]);
        if (!c || k === null) return "could not read the division";
        return expectAnswer(p, at(c, k));
      }
      if ((m = p.prompt.match(/^Divide P\(x\) = (.*) by \((.*)\)\. What is the quotient \(ignore the remainder\)\?$/))) {
        const c = parsePoly(m[1]);
        const k = kOf(m[2]);
        if (!c || k === null) return "could not read the division";
        const { q } = divide(c, k);
        return onlyRight(p, (choice) => {
          const got = parsePoly(choice);
          return !!got && samePoly(got, q);
        });
      }
      if ((m = p.prompt.match(/^P\(x\) = (.*)\. Find P\((-?\d+)\)\.$/))) {
        const c = parsePoly(m[1]);
        if (!c) return "could not read the polynomial";
        return expectAnswer(p, at(c, Number(m[2])));
      }
      return "unread";
    },

    "remainder-factor-theorem": (p) => {
      let m;
      if ((m = p.prompt.match(/^Is \((.*)\) a factor of P\(x\) = (.*)\? Use the remainder theorem\.$/))) {
        const k = kOf(m[1]);
        const c = parsePoly(m[2]);
        if (!c || k === null) return "could not read the question";
        const r = at(c, k);
        return onlyRight(p, (choice) => {
          const t = choice.replace(/[−–]/g, "-").match(/^(Yes|No), the remainder is (-?\d+)$/);
          if (!t) return false;
          return r === 0 ? t[1] === "Yes" && Number(t[2]) === 0 : t[1] === "No" && Number(t[2]) === r;
        });
      }
      if ((m = p.prompt.match(/^P\(x\) = (.*) has factors \((.*)\) and \((.*)\)\. Find k so that \(x − k\) is the third factor\.$/))) {
        const c = parsePoly(m[1]);
        const [k1, k2] = [kOf(m[2]), kOf(m[3])];
        if (!c || k1 === null || k2 === null) return "could not read the question";
        if (at(c, k1) !== 0 || at(c, k2) !== 0) return "a given factor is not a factor";
        const rest = divide(divide(c, k1).q, k2).q;
        if (rest.length !== 2 || rest[1] !== 1) return "the leftover factor is not x − k";
        return expectAnswer(p, -rest[0]);
      }
      if ((m = p.prompt.match(/^One zero of P\(x\) = (.*) is x = (-?\d+)\. What are the other two zeros\?$/))) {
        const c = parsePoly(m[1]);
        const given = Number(m[2]);
        if (!c) return "could not read the polynomial";
        if (at(c, given) !== 0) return "the given zero is not a zero";
        const others = intRoots(c).filter((r) => r !== given);
        if (others.length !== 2) return "the other zeros are not two distinct integers";
        return onlyRight(p, (choice) => {
          const t = choice.replace(/[−–]/g, "-").match(/^x = (-?\d+) and x = (-?\d+)$/);
          if (!t) return false;
          const got = [Number(t[1]), Number(t[2])].sort((a, b) => a - b);
          return got[0] === others[0] && got[1] === others[1];
        });
      }
      if ((m = p.prompt.match(/^P\(x\) = (.*) \+ m\. Find the value of m that makes \((.*)\) a factor of P\(x\)\.$/))) {
        const c = parsePoly(m[1]);
        const k = kOf(m[2]);
        if (!c || k === null) return "could not read the question";
        return expectAnswer(p, -at(c, k));
      }
      if ((m = p.prompt.match(/^\((.*)\) is a factor of P\(x\) = (.*)\. Write P\(x\) in fully factored form\.$/))) {
        const k = kOf(m[1]);
        const c = parsePoly(m[2]);
        if (!c || k === null) return "could not read the question";
        if (at(c, k) !== 0) return "the given factor is not a factor";
        return onlyRight(p, (choice) => {
          const parts = choice.match(/\([^)]*\)/g);
          if (!parts || parts.join("") !== choice.trim() || parts.length !== degreeOf(c)) return false;
          const ks = parts.map((f) => kOf(f.slice(1, -1)));
          if (ks.some((v) => v === null)) return false;
          // Expand the factors and compare to P(x) exactly.
          let poly = [1];
          for (const root of ks as number[]) {
            const next = new Array(poly.length + 1).fill(0);
            poly.forEach((v, idx) => {
              next[idx] += -root * v;
              next[idx + 1] += v;
            });
            poly = next;
          }
          return samePoly(poly, c);
        });
      }
      return "unread";
    },
  };
}
