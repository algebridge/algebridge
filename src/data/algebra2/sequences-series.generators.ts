import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, fmtNum, frac, fractionText, lin, mcChoices, randInt, trapsFor } from "@/lib/problem-utils";

/** A ratio as a student writes it: 2/3 stays a fraction, 1.5 stays a decimal. */
const ratioText = (r: number) => fractionText(r) ?? fmtNum(r);

function trap(value: number | string, why: string, step?: number): Trap {
  return step === undefined ? { value, why } : { value, why, step };
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

/** "3 + 7 + 11 + ... + 43" style listing of an arithmetic run. */
function listedSum(terms: number[]): string {
  return terms.length <= 4 ? terms.map(fmtNum).join(" + ") : `${terms.slice(0, 3).map(fmtNum).join(" + ")} + ... + ${fmtNum(terms[terms.length - 1])}`;
}

/** A term k-th of a geometric series as "a + ar + ar² + ..." with the signs right. */
function joinSigned(values: number[], tail = ""): string {
  return values.map((v, k) => (k === 0 ? fmtNum(v) : v < 0 ? ` − ${fmtNum(-v)}` : ` + ${fmtNum(v)}`)).join("") + tail;
}

/** "a + b" with the sign of b written as a textbook does: (4, -23) → "4 − 23". */
function plus(a: number, b: number): string {
  return b < 0 ? `${fmtNum(a)} − ${fmtNum(-b)}` : `${fmtNum(a)} + ${fmtNum(b)}`;
}

/** A number with a true minus sign: -3 → "−3". */
function sn(v: number): string {
  return v < 0 ? `−${fmtNum(-v)}` : fmtNum(v);
}
/** A number ready to multiply: negatives in parentheses, (−3). */
function par(v: number): string {
  return v < 0 ? `(${sn(v)})` : fmtNum(v);
}

const NAMES = ["Maya", "Jordan", "Kai", "Ava", "Leo", "Zoe", "Sam", "Nia", "Eli", "Rosa", "Omar", "Lena"] as const;

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "arithmetic-series": (seeds) =>
    fillToCount("arithmetic-series", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // First n terms from a1 and d.
        const a1 = randInt(-6, 12);
        const d = pick([-4, -3, -2, 2, 3, 4, 5, 6, 7]);
        const n = randInt(8, 25);
        const an = a1 + (n - 1) * d;
        const S = (n * (a1 + an)) / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `An arithmetic sequence has first term ${a1} and common difference ${d}. Find the sum of its first ${n} terms.`,
          hint: `Find the last term first: aₙ = a₁ + (n − 1)d with n = ${n}. Then S = n(a₁ + aₙ)/2.`,
          answer: S,
          traps: trapsFor(S, [
            trap(an, `That is the ${n}th term alone. The sum adds all ${n} terms.`, 2),
            trap(n * (a1 + an), "n(a₁ + aₙ) counts every pair twice. Divide by 2.", 2),
            trap((n * (a1 + a1 + n * d)) / 2, `The last term is a₁ + (n − 1)d: there are ${n - 1} jumps, not ${n}.`, 0),
            trap(((n - 1) * (a1 + an)) / 2, `Multiply by the number of terms, ${n}, not ${n - 1}.`, 2),
          ]),
          explanation: [
            `last term: aₙ = a₁ + (n − 1)d = ${sn(a1)} + ${n - 1} × ${par(d)} = ${sn(an)}`,
            `first plus last: ${plus(a1, an).replace(/^-/, "−")} = ${sn(a1 + an)}`,
            `S = n(a₁ + aₙ)/2 = ${n} × ${par(a1 + an)}/2 = ${sn(S)}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // A listed finite sum.
        const a1 = randInt(1, 9);
        const d = randInt(2, 9);
        const n = randInt(7, 18);
        const terms = Array.from({ length: n }, (_, k) => a1 + k * d);
        const last = terms[n - 1];
        const S = (n * (a1 + last)) / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `Find the sum ${listedSum(terms)}.`,
          hint: `The terms go up by ${d}. Count them with n = (last − first)/${d} + 1, then use S = n(first + last)/2.`,
          answer: S,
          traps: trapsFor(S, [
            trap(((n - 1) * (a1 + last)) / 2, `n = (last − first)/d + 1. The + 1 counts the first term, so there are ${n} terms.`, 0),
            trap(n * (a1 + last), "n(first + last) counts every pair twice. Divide by 2.", 2),
            trap(a1 + last, "That is one pair. Multiply the pair sum by n/2.", 2),
          ]),
          explanation: [
            `the terms go up by ${d}, so n = (${last} − ${a1})/${d} + 1 = ${n - 1} + 1 = ${n}`,
            `first plus last: ${a1} + ${last} = ${a1 + last}`,
            `S = n(first + last)/2 = ${n} × ${a1 + last}/2 = ${S}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Seats in rows.
        const a1 = pick([12, 14, 15, 16, 18, 20, 22, 24, 25, 30]);
        const d = randInt(2, 6);
        const n = randInt(8, 30);
        const an = a1 + (n - 1) * d;
        const S = (n * (a1 + an)) / 2;
        const place = pick(["theater", "stadium section", "lecture hall", "concert hall", "auditorium"]);
        return {
          id: "",
          type: "numeric",
          prompt: `A ${place} has ${a1} seats in the first row, and each row has ${d} more seats than the row in front of it. How many seats are in the first ${n} rows altogether?`,
          hint: `Row ${n} has ${a1} + ${n - 1} × ${d} seats. The total is n(first row + last row)/2.`,
          answer: S,
          traps: trapsFor(S, [
            trap(an, `That is how many seats are in row ${n} alone. The question asks for all ${n} rows.`, 2),
            trap(n * (a1 + an), "n(first + last) counts every row twice. Divide by 2.", 2),
            trap(n * a1, `Rows grow by ${d} seats each, so they do not all hold ${a1}.`, 0),
            trap((n * (a1 + a1 + n * d)) / 2, `Row ${n} is ${n - 1} rows behind row 1, so add ${d} a total of ${n - 1} times.`, 0),
          ]),
          explanation: [
            `row ${n}: ${a1} + ${n - 1} × ${d} = ${an} seats`,
            `first row plus last row: ${a1} + ${an} = ${a1 + an}`,
            `total = n(first + last)/2 = ${n} × ${a1 + an}/2 = ${S} seats`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // Error analysis: the last term or the sum formula.
        const a1 = randInt(2, 9);
        const d = randInt(2, 6);
        const n = randInt(10, 20);
        const an = a1 + (n - 1) * d;
        const S = (n * (a1 + an)) / 2;
        const slip = randInt(0, 1);
        const badAn = a1 + n * d;
        const steps =
          slip === 0
            ? [`aₙ = a₁ + (n − 1)d = ${a1} + ${n} × ${d} = ${badAn}`, `S = n(a₁ + aₙ)/2 = ${n}(${a1} + ${badAn})/2 = ${(n * (a1 + badAn)) / 2}`, `The sum of the first ${n} terms is ${(n * (a1 + badAn)) / 2}.`]
            : [`aₙ = a₁ + (n − 1)d = ${a1} + ${n - 1} × ${d} = ${an}`, `S = n(a₁ + aₙ)/2 = ${n}(${a1} + ${an}) = ${n * (a1 + an)}`, `The sum of the first ${n} terms is ${n * (a1 + an)}.`];
        return {
          id: "",
          type: "error-analysis",
          prompt: `Find the error in this sum of the first ${n} terms of an arithmetic sequence with first term ${a1} and common difference ${d}.`,
          hint: "Check the last term: n − 1 jumps of d. Then check that the pair sum is halved.",
          wrongStepIndex: slip,
          steps,
          explanation: slip === 0 ? `Term ${n} is ${n - 1} jumps past the first, so aₙ = ${a1} + ${n - 1} × ${d} = ${an}, and S = ${n}(${a1} + ${an})/2 = ${S}.` : `n(a₁ + aₙ) counts each pair twice; halve it: S = ${n} × ${a1 + an}/2 = ${S}.`,
        };
      }
      if (kind === 4) {
        // Rows of logs: how many rows add to S?
        const a1 = randInt(1, 8);
        const n = randInt(5, 16);
        const S = n * a1 + (n * (n - 1)) / 2;
        const thing = pick(["logs", "pipes", "cans", "bricks", "boxes"]);
        return {
          id: "",
          type: "numeric",
          prompt: `A stack of ${thing} has ${a1} in the top row, and each row below has one more than the row above it. The stack holds ${S} ${thing} in all. How many rows are there?`,
          hint: `With n rows the bottom row has ${a1} + (n − 1), so n(${a1} + ${a1} + n − 1)/2 = ${S}. Try values of n, or solve the quadratic.`,
          answer: n,
          traps: trapsFor(n, [
            trap(n - 1, `Check: ${n - 1} rows hold ${(n - 1) * a1 + ((n - 1) * (n - 2)) / 2}, which is short of ${S}.`, 1),
            trap(n + 1, `Check: ${n + 1} rows hold ${(n + 1) * a1 + ((n + 1) * n) / 2}, which is past ${S}.`, 2),
            trap(a1 + n - 1, "That is how many are in the bottom row, not how many rows there are.", 3),
          ]),
          explanation: [
            `with n rows the bottom row holds ${a1} + (n − 1), so n(${a1} + ${a1} + n − 1)/2 = ${S}`,
            `try n = ${n - 1}: ${n - 1}(${a1} + ${a1 + n - 2})/2 = ${(n - 1) * a1 + ((n - 1) * (n - 2)) / 2}, short of ${S}`,
            `try n = ${n}: ${n}(${a1} + ${a1 + n - 1})/2 = ${n} × ${2 * a1 + n - 1}/2 = ${S}`,
            `so there are ${n} rows`,
          ].join(" → "),
        };
      }
      // Multiples of k in a range.
      const k = pick([3, 4, 5, 6, 7, 8, 9, 11, 12]);
      const m1 = randInt(1, 6);
      const m2 = m1 + randInt(6, 24);
      const first = k * m1;
      const last = k * m2;
      const n = m2 - m1 + 1;
      const S = (n * (first + last)) / 2;
      return {
        id: "",
        type: "numeric",
        prompt: `Find the sum of the multiples of ${k} from ${first} to ${last}, including both.`,
        hint: `The multiples form an arithmetic sequence with d = ${k}. Count them: (${last} − ${first})/${k} + 1. Then S = n(first + last)/2.`,
        answer: S,
        traps: trapsFor(S, [
          trap(((n - 1) * (first + last)) / 2, `(${last} − ${first})/${k} counts the jumps. Add 1 for the number of terms.`, 0),
          trap(n * (first + last), "n(first + last) counts every pair twice. Divide by 2.", 2),
          trap((m2 * (k + last)) / 2, `The sum starts at ${first}, not at ${k}.`, 0),
        ]),
        explanation: [
          `count the multiples: n = (${last} − ${first})/${k} + 1 = ${n - 1} + 1 = ${n}`,
          `first plus last: ${first} + ${last} = ${first + last}`,
          `S = n(first + last)/2 = ${n} × ${first + last}/2 = ${S}`,
        ].join(" → "),
      };
    }),

  "geometric-series": (seeds) =>
    fillToCount("geometric-series", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // First n terms from a1 and r.
        const a1 = randInt(1, 9);
        const r = pick([2, 3, 4, 5, -2, -3]);
        const n = randInt(4, 7);
        const S = (a1 * (1 - r ** n)) / (1 - r);
        const an = a1 * r ** (n - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `A geometric sequence has first term ${a1} and common ratio ${r}. Find the sum of its first ${n} terms.`,
          hint: `S = a₁(1 − rⁿ)/(1 − r) with r = ${r} and n = ${n}. Or write the ${n} terms and add them.`,
          answer: S,
          traps: trapsFor(S, [
            trap(an, `That is the ${n}th term alone. The sum needs all ${n} terms.`, 0),
            trap((a1 * (1 - r ** (n - 1))) / (1 - r), `There are ${n} terms, so the formula uses r^${n}, not r^${n - 1}.`, 1),
            trap(a1 * r ** n, `a₁rⁿ is a single term. Add the ${n} terms or use S = a₁(1 − rⁿ)/(1 − r).`, 0),
            trap((a1 * (r ** n - 1)) / (1 + r), "The formula divides by 1 − r, not 1 + r.", 2),
          ]),
          explanation: [
            `use S = a₁(1 − rⁿ)/(1 − r) with a₁ = ${a1}, r = ${sn(r)}, n = ${n}`,
            `rⁿ = ${par(r)}^${n} = ${sn(r ** n)}`,
            `1 − ${par(r ** n)} = ${sn(1 - r ** n)} and 1 − ${par(r)} = ${sn(1 - r)}`,
            `S = ${a1} × ${par(1 - r ** n)}/${par(1 - r)} = ${sn(S)}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // An infinite sum with a fraction ratio.
        const [p, q] = pick([
          [1, 2],
          [1, 3],
          [2, 3],
          [1, 4],
          [3, 4],
          [1, 5],
          [2, 5],
          [3, 5],
          [-1, 2],
          [-1, 3],
          [-1, 4],
          [-2, 3],
        ]);
        const a1 = randInt(1, 15);
        const S = a1 / (1 - p / q);
        const rText = frac(p, q);
        return {
          id: "",
          type: "numeric",
          prompt: `An infinite geometric series has first term ${a1} and common ratio ${rText}. Find its sum. (write as a fraction or decimal)`,
          hint: `|${rText}| < 1, so the series converges and S = a₁/(1 − r). Subtract the fraction from 1 first.`,
          answer: S,
          traps: trapsFor(S, [
            trap(a1 / (1 + p / q), "The formula divides by 1 − r, not 1 + r.", 1),
            trap(a1 * (1 - p / q), "Divide a₁ by 1 − r; the formula is a₁/(1 − r), not a₁(1 − r).", 2),
            trap((a1 * q) / p, "Dividing by r is a different operation. Divide by 1 − r.", 0),
          ]),
          explanation: [
            `|r| < 1, so the series converges and S = a₁/(1 − r)`,
            `1 − ${p < 0 ? `(${sn(p)}/${q})` : rText} = ${frac(q - p, q)}`,
            `S = ${a1} ÷ ${frac(q - p, q)} = ${a1} × ${q}/${q - p} = ${frac(a1 * q, q - p)}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Which series converges (or diverges)?
        const wantConverge = randInt(0, 1) === 0;
        const conv = [
          [16, 1 / 2],
          [27, 1 / 3],
          [8, -1 / 2],
          [81, 2 / 3],
          [64, 3 / 4],
          [125, -2 / 5],
        ] as const;
        const div = [
          [1, 2],
          [3, -2],
          [5, 1],
          [2, 3],
          [4, -1],
          [6, 3 / 2],
        ] as const;
        const series = ([a, r]: readonly [number, number]) => joinSigned([a, a * r, a * r * r, a * r * r * r], " + ...");
        const rightPool = wantConverge ? conv : div;
        const wrongPool = wantConverge ? div : conv;
        const right = rightPool[randInt(0, rightPool.length - 1)];
        const w0 = randInt(0, wrongPool.length - 1);
        const wrong = [wrongPool[w0], wrongPool[(w0 + 1 + randInt(0, 1)) % wrongPool.length], wrongPool[(w0 + 3 + randInt(0, 1)) % wrongPool.length]];
        const answer = series(right);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which infinite geometric series ${wantConverge ? "converges" : "diverges"}?`,
          hint: "Divide the second term by the first to get r. The series converges when |r| < 1 and diverges when |r| ≥ 1.",
          answer,
          choices: mcChoices(answer, wrong.map(series)),
          traps: trapsFor(answer, wrong.map((w) => trap(series(w), wantConverge ? `Its ratio is ${ratioText(w[1])}, and |r| ≥ 1 means the terms never shrink, so the sum diverges.` : `Its ratio is ${ratioText(w[1])}, and |r| < 1 means the terms shrink toward 0, so the sum converges.`, 1))),
          explanation: [
            `find each ratio as second term ÷ first term; for ${answer}: r = ${sn(right[0] * right[1])}/${right[0]} = ${ratioText(right[1]).replace("-", "−")}`,
            `the series converges only when |r| < 1, and here |r| ${Math.abs(right[1]) < 1 ? "< 1" : "≥ 1"}`,
            `so ${answer} ${wantConverge ? "converges" : "diverges"}`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // A listed finite geometric sum.
        const a1 = randInt(1, 6);
        const r = pick([2, 3, 4, -2]);
        const n = randInt(5, 8);
        const terms = Array.from({ length: n }, (_, k) => a1 * r ** k);
        const S = terms.reduce((s, t) => s + t, 0);
        const shown = n <= 5 ? joinSigned(terms) : `${joinSigned(terms.slice(0, 3))} + ... ${terms[n - 1] < 0 ? "− " + fmtNum(-terms[n - 1]) : "+ " + fmtNum(terms[n - 1])}`;
        return {
          id: "",
          type: "numeric",
          prompt: `Find the sum of the geometric series ${shown}.`,
          hint: `r = ${r}. Count the terms from ${a1} to ${terms[n - 1]} (each is r times the last), then use S = a₁(1 − rⁿ)/(1 − r).`,
          answer: S,
          traps: trapsFor(S, [
            trap(S - terms[n - 1], `Keep going: the series runs through ${terms[n - 1]}, which is term ${n}.`, 1),
            trap(S + terms[n - 1] * r, `The series stops at ${terms[n - 1]}; there are ${n} terms, not ${n + 1}.`, 1),
            trap(terms[n - 1], "That is only the last term. Add every term.", 2),
          ]),
          explanation: [
            `r = ${sn(terms[1])}/${a1} = ${sn(r)}`,
            `count the terms: ${a1} × ${par(r)}^${n - 1} = ${sn(terms[n - 1])}, so n = ${n}`,
            `S = a₁(1 − rⁿ)/(1 − r) = ${a1} × (1 − ${par(r ** n)})/(1 − ${par(r)}) = ${a1} × ${par(1 - r ** n)}/${par(1 - r)}`,
            `S = ${sn(S)}`,
          ].join(" → "),
        };
      }
      if (kind === 4) {
        // Savings that multiply each week.
        const name = pick(NAMES);
        const a1 = pick([2, 3, 4, 5, 6, 8, 10]);
        const r = randInt(2, 3);
        const n = randInt(4, 7);
        const S = (a1 * (r ** n - 1)) / (r - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `${name} saves $${a1} in week 1 and each week saves ${r === 2 ? "twice" : "three times"} as much as the week before. How much has ${name} saved in total after ${n} weeks?`,
          hint: `The weekly amounts are a geometric sequence with a₁ = ${a1} and r = ${r}. Add ${n} terms: S = a₁(rⁿ − 1)/(r − 1).`,
          answer: S,
          traps: trapsFor(S, [
            trap(a1 * r ** (n - 1), `That is week ${n} alone. The total adds all ${n} weeks.`, 2),
            trap(a1 * r ** n, `That is what week ${n + 1} would be. Add weeks 1 through ${n}.`, 2),
            trap((a1 * (r ** (n - 1) - 1)) / (r - 1), `Week ${n} counts too: that total stops after ${n - 1} weeks.`, 1),
            trap(a1 * r * n, `The savings multiply by ${r} each week; they do not add ${a1 * r} each week.`, 0),
          ]),
          explanation: [
            `the weekly amounts are geometric: a₁ = ${a1}, r = ${r}, n = ${n} weeks`,
            `${r}^${n} = ${r ** n}`,
            `S = a₁(rⁿ − 1)/(r − 1) = ${a1} × (${r ** n} − 1)/(${r} − 1) = ${a1} × ${r ** n - 1}/${r - 1}`,
            `S = ${S}`,
          ].join(" → "),
        };
      }
      // Error analysis: an infinite sum.
      const [p, q] = pick([
        [1, 2],
        [1, 3],
        [1, 4],
        [2, 3],
        [3, 4],
        [1, 5],
      ]);
      const a = q * q * randInt(1, 4);
      const t2 = (a * p) / q;
      const t3 = (a * p * p) / (q * q);
      const S = (a * q) / (q - p);
      const slip = randInt(0, 1);
      const rText = frac(p, q);
      const steps =
        slip === 0
          ? [`r = ${a}/${t2} = ${frac(a, t2)}`, `|r| < 1, so the series converges.`, `S = a₁/(1 − r) = ${a}/(1 − ${frac(a, t2)}) = ${frac(a * t2, t2 - a)}`]
          : [`r = ${t2}/${a} = ${rText}`, `|r| < 1, so the series converges.`, `S = a₁/(1 + r) = ${a}/(1 + ${rText}) = ${frac(a * q, q + p)}`];
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this sum of the infinite geometric series ${a} + ${t2} + ${t3} + ...`,
        hint: "r is the second term divided by the first. The sum formula divides a₁ by 1 − r.",
        wrongStepIndex: slip === 0 ? 0 : 2,
        steps,
        explanation: slip === 0 ? `r is the next term divided by the one before: ${t2}/${a} = ${rText}. Then S = ${a}/(1 − ${rText}) = ${fmtNum(S)}.` : `The formula is S = a₁/(1 − r): ${a}/(1 − ${rText}) = ${a}/(${frac(q - p, q)}) = ${fmtNum(S)}.`,
      };
    }),

  "sigma-notation": (seeds) =>
    fillToCount("sigma-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // Evaluate a linear sigma.
        const a = pick([1, 2, 3, 4, 5, 6, -2, -3]);
        let b = randInt(-5, 9);
        const n = randInt(4, 10);
        // A zero term reads as "+ 0" in the worked sum; nudge b off it.
        while (Array.from({ length: n }, (_, k) => a * (k + 1) + b).some((v) => v === 0)) b += 1;
        const S = (a * n * (n + 1)) / 2 + b * n;
        const vals = Array.from({ length: n }, (_, k) => a * (k + 1) + b);
        const signed = (v: number) => (v < 0 ? `− ${fmtNum(-v)}` : `+ ${fmtNum(v)}`);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate Σ from k = 1 to ${n} of (${lin(a, b, "k")}).`,
          hint: `Plug in k = 1, 2, ..., ${n} to get ${n} terms and add them. Or add ${a} × (1 + 2 + ... + ${n}) and ${n} copies of ${b}.`,
          answer: S,
          traps: trapsFor(S, [
            trap(a * n + b, `That is the last term only (k = ${n}). Add all ${n} terms.`, 0),
            trap((a * n * (n + 1)) / 2, `Each of the ${n} terms also carries the constant ${b}.`, 2),
            trap((a * n * (n + 1)) / 2 + b, `The constant ${b} appears in every term, so it is added ${n} times, not once.`, 2),
            trap((a * n * (n - 1)) / 2 + b * (n - 1), `k runs from 1 through ${n}: that is ${n} terms, including k = ${n}.`, 1),
          ]),
          explanation: [
            `k = 1, 2, ..., ${n} gives ${n} terms: ${joinSigned(vals.slice(0, 4)).replace(/^-/, "−")}${n > 4 ? ` ${signed(vals[n - 1]).slice(0, 1)} ... ${signed(vals[n - 1])}` : ""}`,
            `the k parts: ${par(a)} × (1 + 2 + ... + ${n}) = ${par(a)} × ${(n * (n + 1)) / 2} = ${sn((a * n * (n + 1)) / 2)}`,
            ...(b === 0
              ? [`there is no constant, so S = ${sn(S)}`]
              : [`the constant is in every term: ${n} × ${par(b)} = ${sn(b * n)}`, `S = ${sn((a * n * (n + 1)) / 2)} ${b * n < 0 ? "−" : "+"} ${Math.abs(b * n)} = ${sn(S)}`]),
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // Write a listed sum in sigma notation.
        const a = randInt(2, 7);
        const b = randInt(1 - a, 8);
        const n = randInt(4, 6);
        const terms = Array.from({ length: n }, (_, k) => a * (k + 1) + b);
        const sig = (lo: number, hi: number, m: number, c: number) => `Σ from k = ${lo} to ${hi} of (${lin(m, c, "k")})`;
        const answer = sig(1, n, a, b);
        const wrong = [sig(1, n, a, a + b), sig(1, n - 1, a, b), sig(1, n, a + 1, b)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which sigma notation represents ${terms.join(" + ")}?`,
          hint: `The terms go up by ${a}, so the rule is ${a}k + something. Check that k = 1 gives ${terms[0]} and count the terms for the top number.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Plug in k = 1: that rule gives ${a + a + b}, but the first term is ${terms[0]}.`, 1),
            trap(wrong[1], `There are ${n} terms, so k runs to ${n}.`, 2),
            trap(wrong[2], `The terms go up by ${a} each time, not ${a + 1}, so the coefficient of k is ${a}.`, 0),
          ]),
          explanation: [
            `the terms go up by ${a}, so the rule is ${a}k + c`,
            `k = 1 must give ${terms[0]}: ${a} + c = ${terms[0]}, so c = ${sn(b)}`,
            `there are ${n} terms, so k runs from 1 to ${n}`,
            answer,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Count the terms.
        const m = randInt(2, 9);
        const n = m + randInt(4, 30);
        const rule = pick(["k²", "2k − 1", "k(k + 1)", "3k", "k² + 1", "5 − k", "2^k", "k³"]);
        const count = n - m + 1;
        return {
          id: "",
          type: "numeric",
          prompt: `How many terms are in Σ from k = ${m} to ${n} of ${rule.length > 2 ? `(${rule})` : rule}?`,
          hint: `Count every whole number from ${m} to ${n}, with both ends included.`,
          answer: count,
          traps: trapsFor(count, [
            trap(n - m, `${n} − ${m} counts the jumps between terms. Both k = ${m} and k = ${n} are terms, so add 1.`, 1),
            trap(n, `The index starts at ${m}, not at 1.`, 0),
            trap(n - m + 2, `${n} − ${m} + 1 counts both ends exactly once.`, 1),
          ]),
          explanation: [
            `k takes every whole number from ${m} to ${n}: ${m}, ${m + 1}, ..., ${n}`,
            `count with both ends included: ${n} − ${m} + 1 = ${count} terms`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // Evaluate a sum of squares or a shifted start.
        const m = randInt(1, 4);
        const n = m + randInt(2, 4);
        const rule = pick(["k²", "k² − 1", "k(k + 1)", "2k − 1", "k² + k"] as const);
        const f = (k: number) => (rule === "k²" ? k * k : rule === "k² − 1" ? k * k - 1 : rule === "k(k + 1)" ? k * (k + 1) : rule === "2k − 1" ? 2 * k - 1 : k * k + k);
        const ks = Array.from({ length: n - m + 1 }, (_, j) => m + j);
        const vals = ks.map(f);
        const S = vals.reduce((s, v) => s + v, 0);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate Σ from k = ${m} to ${n} of ${rule.length > 2 ? `(${rule})` : rule}.`,
          hint: `Plug in k = ${ks.join(", ")} one at a time, then add the ${ks.length} results.`,
          answer: S,
          traps: trapsFor(S, [
            trap(S - vals[0], `The sum starts at k = ${m}, so the k = ${m} term is included.`, 0),
            trap(vals[vals.length - 1], `That is the last term only. Add all ${ks.length} terms.`, 1),
            trap(S + (m > 1 ? Array.from({ length: m - 1 }, (_, j) => f(j + 1)).reduce((s, v) => s + v, 0) : f(n + 1)), m > 1 ? `The index starts at ${m}, not at 1.` : `The index stops at ${n}; the k = ${n + 1} term is not in the sum.`, 0),
          ]),
          explanation: [
            `plug in each k from ${m} to ${n}: ${ks.map((k, j) => `k = ${k} gives ${vals[j]}`).join(", ")}`,
            `add the ${ks.length} terms: ${vals.map(fmtNum).join(" + ")} = ${S}`,
          ].join(" → "),
        };
      }
      if (kind === 4) {
        // A geometric sigma.
        const c = randInt(1, 6);
        const r = pick([2, 3, 4]);
        const n = randInt(3, 6);
        const vals = Array.from({ length: n + 1 }, (_, k) => c * r ** k);
        const S = vals.reduce((s, v) => s + v, 0);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate Σ from k = 0 to ${n} of ${c === 1 ? "" : c + " × "}${r}^k.`,
          hint: `k starts at 0, so the first term is ${c === 1 ? "" : c + " × "}${r}^0 = ${c}. There are ${n + 1} terms; add them or use the geometric sum formula.`,
          answer: S,
          traps: trapsFor(S, [
            trap(S - c, `k starts at 0, and ${r}^0 = 1, so the first term is ${c}.`, 0),
            trap(vals[n], `That is the last term alone. Add all ${n + 1} terms.`, 2),
            trap(vals.slice(0, n).reduce((s, v) => s + v, 0), `k runs through ${n}, which makes ${n + 1} terms, not ${n}.`, 0),
          ]),
          explanation: [
            `k runs 0, 1, ..., ${n}, which is ${n + 1} terms; k = 0 gives ${c === 1 ? "" : c + " × "}${r}^0 = ${c}`,
            `each next term is ${r} times the last: ${vals.map(fmtNum).join(", ")}`,
            `add them: ${vals.map(fmtNum).join(" + ")} = ${S}`,
          ].join(" → "),
        };
      }
      // Error analysis: expanding a sigma term by term.
      const a = randInt(2, 6);
      const b = randInt(1 - a, 7);
      const n = randInt(3, 4);
      const vals = Array.from({ length: n }, (_, k) => a * (k + 1) + b);
      const S = vals.reduce((s, v) => s + v, 0);
      const slip = randInt(0, n);
      const badK = slip < n ? slip : -1;
      const steps = vals.map((v, k) => `k = ${k + 1}: ${a}(${k + 1})${b === 0 ? "" : b > 0 ? ` + ${b}` : ` − ${-b}`} = ${k === badK ? v + a : v}`);
      const shownVals = vals.map((v, k) => (k === badK ? v + a : v));
      const shownSum = shownVals.reduce((s, v) => s + v, 0);
      // The last slip leaves the final term out of the addition.
      steps.push(slip === n ? `Sum: ${vals.slice(0, n - 1).map(fmtNum).join(" + ")} = ${S - vals[n - 1]}` : `Sum: ${shownVals.map(fmtNum).join(" + ")} = ${shownSum}`);
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this evaluation of Σ from k = 1 to ${n} of (${lin(a, b, "k")}).`,
        hint: "Recompute each term by plugging in its k, then check that every term made it into the final addition.",
        wrongStepIndex: slip,
        steps,
        explanation: slip < n ? `For k = ${slip + 1}, ${a} × ${slip + 1}${b === 0 ? "" : b > 0 ? ` + ${b}` : ` − ${-b}`} = ${vals[slip]}, not ${vals[slip] + a}. The sum is ${S}.` : `The k = ${n} term, ${vals[n - 1]}, was left out. All ${n} terms must be added: ${vals.map(fmtNum).join(" + ")} = ${S}.`,
      };
    }),
};
