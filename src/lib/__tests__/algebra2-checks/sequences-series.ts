import type { CheckHelpers, Checks } from "../algebra2-checks.ts";

/** A number as the prompts print it: "-3", "−3", "12". */
const num = (t: string) => Number(t.replace(/[−–]/g, "-").replace(/,/g, ""));

/** "2/3", "-1/4", "5" as a value. */
function fracVal(t: string): number {
  const s = t.replace(/[−–]/g, "-").trim();
  const m = s.match(/^(-?\d+)\/(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : Number(s);
}

/** The terms of a "3 + 7 + 11 + ... + 43" or "3 − 6 + 12 − 24" listing, with the gap filled in when told how. */
function listedTerms(text: string): number[] {
  return text
    .replace(/[−–]/g, "-")
    .replace(/\s*-\s*/g, " + -")
    .split(/\s*\+\s*/)
    .filter((t) => t.trim() !== "")
    .map((t) => Number(t.trim()));
}

/** The value after the last "=" of a step. */
const lastValue = (s: string) => fracVal(s.split("=").pop()!.trim());

export default function checks(h: CheckHelpers): Checks {
  const { expectAnswer, onlyRight, close, evaluate } = h;
  return {
    "arithmetic-series": (p) => {
      let m;
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this sum of the first (\d+) terms of an arithmetic sequence with first term (\d+) and common difference (\d+)\.$/);
        if (!m) return "unread";
        const [n, a1, d] = [+m[1], +m[2], +m[3]];
        const an = a1 + (n - 1) * d;
        const S = (n * (a1 + an)) / 2;
        const want = [an, S, S];
        const firstFalse = (p.steps as string[]).findIndex((s, k) => !close(num(s.match(/(-?\d+)\.?$/)![1]), want[k]));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^An arithmetic sequence has first term (-?\d+) and common difference (-?\d+)\. Find the sum of its first (\d+) terms\.$/))) {
        const [a1, d, n] = [num(m[1]), num(m[2]), +m[3]];
        return expectAnswer(p, (n * (2 * a1 + (n - 1) * d)) / 2);
      }
      if ((m = p.prompt.match(/^Find the sum (\d+) \+ (\d+) \+ (\d+)(?: \+ (\d+))?(?: \+ \.\.\. \+ (\d+))?\.$/))) {
        const a1 = +m[1];
        const d = +m[2] - a1;
        if (+m[3] - +m[2] !== d) return "the terms are not arithmetic";
        const last = m[5] ? +m[5] : m[4] ? +m[4] : +m[3];
        if ((last - a1) % d !== 0) return "the last term is off the sequence";
        const n = (last - a1) / d + 1;
        return expectAnswer(p, (n * (a1 + last)) / 2);
      }
      if ((m = p.prompt.match(/^A [a-z ]+ has (\d+) seats in the first row, and each row has (\d+) more seats than the row in front of it\. How many seats are in the first (\d+) rows altogether\?$/))) {
        const [a1, d, n] = [+m[1], +m[2], +m[3]];
        return expectAnswer(p, (n * (2 * a1 + (n - 1) * d)) / 2);
      }
      if ((m = p.prompt.match(/^A stack of [a-z]+ has (\d+) in the top row, and each row below has one more than the row above it\. The stack holds (\d+) [a-z]+ in all\. How many rows are there\?$/))) {
        const [a1, S] = [+m[1], +m[2]];
        let n = 1;
        let total = a1;
        while (total < S) {
          n++;
          total += a1 + n - 1;
        }
        if (total !== S) return "no whole number of rows gives that total";
        return expectAnswer(p, n);
      }
      if ((m = p.prompt.match(/^Find the sum of the multiples of (\d+) from (\d+) to (\d+), including both\.$/))) {
        const [k, first, last] = [+m[1], +m[2], +m[3]];
        if (first % k || last % k) return "an end is not a multiple";
        let S = 0;
        for (let v = first; v <= last; v += k) S += v;
        return expectAnswer(p, S);
      }
      return "unread";
    },

    "geometric-series": (p) => {
      let m;
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this sum of the infinite geometric series (\d+) \+ (\d+) \+ (\d+) \+ \.\.\.$/);
        if (!m) return "unread";
        const [a, t2, t3] = [+m[1], +m[2], +m[3]];
        const r = t2 / a;
        if (!close(t3 / t2, r) || Math.abs(r) >= 1) return "the series does not converge";
        const S = a / (1 - r);
        const want = [r, null, S];
        const firstFalse = (p.steps as string[]).findIndex((s, k) => want[k] !== null && !close(lastValue(s), want[k] as number));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^A geometric sequence has first term (\d+) and common ratio (-?\d+)\. Find the sum of its first (\d+) terms\.$/))) {
        const [a1, r, n] = [+m[1], num(m[2]), +m[3]];
        let S = 0;
        for (let k = 0; k < n; k++) S += a1 * r ** k;
        return expectAnswer(p, S);
      }
      if ((m = p.prompt.match(/^An infinite geometric series has first term (\d+) and common ratio (-?\d+\/\d+)\. Find its sum\. \(write as a fraction or decimal\)$/))) {
        const r = fracVal(m[2]);
        if (Math.abs(r) >= 1) return "the ratio is not between -1 and 1";
        return expectAnswer(p, +m[1] / (1 - r));
      }
      if ((m = p.prompt.match(/^Which infinite geometric series (converges|diverges)\?$/))) {
        const wantConverge = m[1] === "converges";
        return onlyRight(p, (c) => {
          const t = listedTerms(c.replace(/\s*\+\s*\.\.\.$/, ""));
          if (t.length < 3) return false;
          const r = t[1] / t[0];
          if (!close(t[2] / t[1], r)) return false;
          return Math.abs(r) < 1 === wantConverge;
        });
      }
      if ((m = p.prompt.match(/^Find the sum of the geometric series (.*)\.$/))) {
        const text = m[1];
        const gap = text.match(/^(.*) \+ \.\.\. ([+−-]) (\d+)$/);
        const head = listedTerms(gap ? gap[1] : text);
        const r = head[1] / head[0];
        if (!close(head[2] / head[1], r)) return "the terms are not geometric";
        let last = gap ? (gap[2] === "+" ? +gap[3] : -gap[3]) : head[head.length - 1];
        let S = 0;
        let t = head[0];
        let count = 0;
        while (count < 20) {
          S += t;
          count++;
          if (close(t, last)) break;
          t *= r;
        }
        if (!close(t, last)) return "the last term is off the sequence";
        return expectAnswer(p, S);
      }
      if ((m = p.prompt.match(/^[A-Z][a-z]+ saves \$(\d+) in week 1 and each week saves (twice|three times) as much as the week before\. How much has [A-Z][a-z]+ saved in total after (\d+) weeks\?$/))) {
        const [a1, r, n] = [+m[1], m[2] === "twice" ? 2 : 3, +m[3]];
        let S = 0;
        for (let k = 0; k < n; k++) S += a1 * r ** k;
        return expectAnswer(p, S);
      }
      return "unread";
    },

    "sigma-notation": (p) => {
      let m;
      const termAt = (rule: string, k: number) => evaluate(rule.replace(/^\((.*)\)$/, "$1"), { k });
      if (p.type === "error-analysis") {
        m = p.prompt.match(/^Find the error in this evaluation of Σ from k = 1 to (\d+) of \((.*)\)\.$/);
        if (!m) return "unread";
        const n = +m[1];
        const vals = Array.from({ length: n }, (_, k) => termAt(m![2], k + 1));
        const S = vals.reduce((s, v) => s + v, 0);
        const stepTrue = (s: string, k: number) => {
          if (k < n) {
            const mm = s.match(/^k = (\d+): .* = (-?\d+)$/);
            return !!mm && +mm[1] === k + 1 && close(+mm[2], vals[k]);
          }
          const mm = s.match(/^Sum: (.*) = (-?\d+)$/);
          if (!mm) return false;
          const listed = listedTerms(mm[1]);
          return listed.length === n && listed.every((v, j) => close(v, vals[j])) && close(+mm[2], S);
        };
        const firstFalse = (p.steps as string[]).findIndex((s, k) => !stepTrue(s, k));
        return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
      }
      if ((m = p.prompt.match(/^Evaluate Σ from k = (\d+) to (\d+) of (.+)\.$/))) {
        const [lo, hi] = [+m[1], +m[2]];
        let S = 0;
        for (let k = lo; k <= hi; k++) S += termAt(m[3], k);
        return expectAnswer(p, S);
      }
      if ((m = p.prompt.match(/^Which sigma notation represents (.*)\?$/))) {
        const terms = listedTerms(m[1]);
        return onlyRight(p, (c) => {
          const mm = c.match(/^Σ from k = (\d+) to (\d+) of \((.*)\)$/);
          if (!mm) return false;
          const [lo, hi] = [+mm[1], +mm[2]];
          if (hi - lo + 1 !== terms.length) return false;
          return terms.every((t, j) => close(t, termAt(mm[3], lo + j)));
        });
      }
      if ((m = p.prompt.match(/^How many terms are in Σ from k = (\d+) to (\d+) of .+\?$/))) {
        return expectAnswer(p, +m[2] - +m[1] + 1);
      }
      return "unread";
    },
  };
}
