import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, fmtNum, mcChoices, plusTerm, quad, randInt, trapsFor } from "@/lib/problem-utils";

function trap(value: number | string, why: string): Trap {
  return { value, why };
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

/** A nonzero integer in [-max, max]. */
function nz(max: number): number {
  const v = randInt(1, max);
  return randInt(0, 1) === 0 ? v : -v;
}

/** A complex number a + bi as a student writes it: "3 − 4i", "-2 + i", "5i", "7", "0". */
function cx(re: number, im: number): string {
  if (re === 0 && im === 0) return "0";
  if (re === 0) return im === 1 ? "i" : im === -1 ? "-i" : `${fmtNum(im)}i`;
  return `${fmtNum(re)}${plusTerm(im, "i")}`;
}

/** k·i·√m, simplified: (3, 2) → "3i√2", (3, 1) → "3i", (1, 5) → "i√5". */
function imRoot(k: number, m: number): string {
  const head = k === 1 ? "i" : `${k}i`;
  return m === 1 ? head : `${head}√${m}`;
}

/** k√m with no i: (3, 2) → "3√2", (3, 1) → "3", (1, 5) → "√5". */
function realRoot(k: number, m: number): string {
  if (m === 1) return String(k);
  return k === 1 ? `√${m}` : `${k}√${m}`;
}

const SQUARE_FREE = [1, 2, 3, 5, 6, 7, 10] as const;

const sameChoice = (a: string, b: string) => a.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase() === b.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();

/** The first three candidate wrong answers that are distinct and differ from the key. */
function wrongThree(answer: string, candidates: { value: string; why: string }[]): { value: string; why: string }[] {
  const out: { value: string; why: string }[] = [];
  for (const c of candidates) {
    if (sameChoice(c.value, answer)) continue;
    if (out.some((o) => sameChoice(o.value, c.value))) continue;
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

function mcCard(prompt: string, hint: string, answer: string, wrong: { value: string; why: string }[], explanation: string): PracticeProblem {
  const three = wrongThree(answer, wrong);
  return {
    id: "",
    type: "multiple-choice",
    prompt,
    hint,
    answer,
    choices: mcChoices(answer, three.map((w) => w.value)),
    traps: trapsFor(answer, three.map((w) => trap(w.value, w.why))),
    explanation,
  };
}

const I_POWER = ["1", "i", "-1", "-i"] as const;

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "imaginary-unit": (seeds) =>
    fillToCount("imaginary-unit", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // Simplify √(−n).
        let k = randInt(1, 9);
        let m: number = pick(SQUARE_FREE);
        if (k === 1 && m === 1) k = randInt(2, 9);
        if (k > 6) m = 1;
        const n = k * k * m;
        const answer = imRoot(k, m);
        return mcCard(
          `Simplify √(−${n}).`,
          `Write √(−${n}) as √${n} · √(−1). Then √(−1) = i, and simplify √${n} by pulling out its largest perfect-square factor.`,
          answer,
          [
            { value: realRoot(k, m), why: "The minus sign under the root cannot vanish. √(−1) is i, and it stays in the answer." },
            { value: `-${realRoot(k, m)}`, why: "A negative under a square root does not become a negative in front. √(−1) is i." },
            { value: `${n}i`, why: `Pulling out i leaves √${n} still to be simplified.` },
            { value: imRoot(k * k, m), why: `√${k * k} is ${k}, so the number in front of i is ${k}.` },
            { value: m === 1 ? imRoot(k, 2) : imRoot(1, n), why: m === 1 ? `${n} is a perfect square, so nothing stays under the root.` : `Pull the perfect-square factor ${k * k} out of √${n}.` },
          ],
          m === 1 ? `√(−${n}) = √${n} · √(−1) = ${k}i` : `√(−${n}) = √(${k * k} · ${m}) · √(−1) = ${answer}`
        );
      }
      if (kind === 1) {
        // A power of i.
        const n = randInt(5, 99);
        const answer = I_POWER[n % 4];
        const r = n % 4;
        const others = I_POWER.filter((v) => v !== answer);
        return mcCard(
          `What is i^${n}?`,
          "i, i² = −1, i³ = −i, i⁴ = 1, then the cycle repeats. Divide the exponent by 4 and use the remainder.",
          answer,
          others.map((v) => ({ value: v, why: `${n} ÷ 4 leaves remainder ${r}, so i^${n} matches i^${r === 0 ? 4 : r}.` })),
          `${n} = 4 × ${Math.floor(n / 4)}${r ? ` + ${r}` : ""}, so i^${n} = (i⁴)^${Math.floor(n / 4)}${r ? ` · i^${r}` : ""} = ${answer}`
        );
      }
      if (kind === 2) {
        // (ai)² or (ai)(bi): a plain number.
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        const square = randInt(0, 1) === 0;
        const answer = square ? -a * a : -a * b;
        return {
          id: "",
          type: "numeric",
          prompt: square ? `Simplify (${a}i)². Write a plain number.` : `Simplify (${a}i)(${b}i). Write a plain number.`,
          hint: "Multiply the numbers, multiply the i's to get i², and replace i² with −1.",
          answer,
          traps: trapsFor(answer, [
            trap(-answer, "i² is −1, not 1. The product of two imaginary numbers flips sign."),
            trap(square ? 2 * a : a + b, square ? "Squaring multiplies the number by itself, not by 2." : "The numbers multiply, they are not added."),
            trap(square ? -2 * a : -(a + b), square ? "Squaring multiplies the number by itself, not by 2." : "The numbers multiply, they are not added."),
          ]),
          explanation: square ? `(${a}i)² = ${a}² · i² = ${a * a} · (−1) = ${answer}` : `(${a}i)(${b}i) = ${a * b} · i² = ${a * b} · (−1) = ${answer}`,
        };
      }
      if (kind === 3) {
        // √(−a) · √(−b) with perfect squares: convert first, then multiply.
        const p = randInt(2, 9);
        const q = randInt(2, 9);
        const answer = -p * q;
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify √(−${p * p}) · √(−${q * q}). Write a plain number.`,
          hint: `Rewrite each root with i first: √(−${p * p}) = ${p}i. Then multiply and use i² = −1.`,
          answer,
          traps: trapsFor(answer, [
            trap(p * q, `The rule √a · √b = √(ab) only works for nonnegative a and b. Convert to ${p}i and ${q}i first, then i² = −1.`),
            trap(-(p + q), "The two imaginary numbers multiply; their coefficients are not added."),
            trap(p * p * q * q, "Take the square roots before multiplying."),
          ]),
          explanation: `√(−${p * p}) · √(−${q * q}) = (${p}i)(${q}i) = ${p * q}i² = ${answer}`,
        };
      }
      // Error analysis: a simplification of √(−n) with one slip.
      const k = randInt(2, 6);
      const m: number = pick([2, 3, 5, 6, 7]);
      const n = k * k * m;
      const slip = randInt(0, 2);
      const steps =
        slip === 0
          ? [`√(−${n}) = -√${n}`, `= -√(${k * k} · ${m})`, `= -${k}√${m}`]
          : slip === 1
            ? [`√(−${n}) = √${n} · √(−1)`, `= √(${k * k} · ${m}) · i`, `= ${k * k}i√${m}`]
            : [`√(−${n}) = √${n} · √(−1)`, `= √(${k * k} · ${m}) · i`, `= ${k}√${m}`];
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this simplification of √(−${n}).`,
        hint: "Check the first step: a negative under the root becomes i, not a minus sign. Then check that the perfect square is rooted and that i is kept.",
        wrongStepIndex: slip === 0 ? 0 : 2,
        steps,
        explanation:
          slip === 0
            ? `A negative under a square root becomes √(−1) = i, not a minus in front. √(−${n}) = √${n} · i = ${imRoot(k, m)}.`
            : slip === 1
              ? `√${k * k} = ${k}, so the number in front is ${k}, not ${k * k}: √(−${n}) = ${imRoot(k, m)}.`
              : `The i from √(−1) must stay: √(−${n}) = ${imRoot(k, m)}.`,
      };
    }),

  "complex-arithmetic": (seeds) =>
    fillToCount("complex-arithmetic", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0 || kind === 1) {
        // Add or subtract two complex numbers.
        const [a, b, c, d] = [nz(9), nz(9), nz(9), nz(9)];
        const add = kind === 0;
        const re = add ? a + c : a - c;
        const im = add ? b + d : b - d;
        const answer = cx(re, im);
        return mcCard(
          add ? `Add: (${cx(a, b)}) + (${cx(c, d)}).` : `Subtract: (${cx(a, b)}) − (${cx(c, d)}).`,
          add ? "Add the real parts together and the imaginary parts together." : "Subtract both parts of the second number: its real part from the real part, its imaginary part from the imaginary part.",
          answer,
          [
            { value: cx(add ? a + c : a - c, add ? b - d : b + d), why: add ? "Add the imaginary parts with their signs." : "The minus applies to the imaginary part of the second number too." },
            { value: cx(add ? a - c : a + c, add ? b + d : b - d), why: add ? "This is an addition: the real parts are added." : "This is a subtraction: the real parts are subtracted." },
            { value: cx(re + im, 0), why: "Real parts stay real and imaginary parts stay imaginary; they never merge into one term." },
            { value: cx(re, -im), why: "Check the sign of the imaginary part." },
            { value: cx(-re, im), why: "Check the sign of the real part." },
          ],
          add ? `(${a}${plusTerm(c)}) + (${b}${plusTerm(d)})i = ${answer}` : `(${a}${plusTerm(-c)}) + (${b}${plusTerm(-d)})i = ${answer}`
        );
      }
      if (kind === 2) {
        // Multiply (a + bi)(c + di).
        const [a, b, c, d] = [nz(6), nz(6), nz(6), nz(6)];
        const re = a * c - b * d;
        const im = a * d + b * c;
        const answer = cx(re, im);
        return mcCard(
          `Multiply: (${cx(a, b)})(${cx(c, d)}).`,
          "FOIL as if i were a variable, replace i² with −1, then collect the real and imaginary parts.",
          answer,
          [
            { value: cx(a * c + b * d, im), why: "The last product has i², which is −1, so it flips sign before joining the real part." },
            { value: cx(a * c, b * d), why: "Multiply all four pairs, not just first and last. The outer and inner products give the imaginary part." },
            { value: cx(re, a * d - b * c), why: "The outer and inner products are added." },
            { value: cx(a * c, a * d + b * c), why: "The product of the two imaginary parts is real, because i² = −1, and joins the real part." },
          ],
          `${a * c}${plusTerm(a * d, "i")}${plusTerm(b * c, "i")}${plusTerm(b * d, "i²")} = ${a * c}${plusTerm(im, "i")}${plusTerm(-b * d)} = ${answer}`
        );
      }
      if (kind === 3) {
        // The real or imaginary part of a product: a plain number.
        const [a, b, c, d] = [nz(7), nz(7), nz(7), nz(7)];
        const wantReal = randInt(0, 1) === 0;
        const re = a * c - b * d;
        const im = a * d + b * c;
        const answer = wantReal ? re : im;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the ${wantReal ? "real" : "imaginary"} part of (${cx(a, b)})(${cx(c, d)})?`,
          hint: wantReal ? "FOIL. The first product and the last product (after i² = −1) are the real part." : "FOIL. The outer and inner products carry the i; add their coefficients.",
          answer,
          traps: trapsFor(answer, [
            wantReal ? trap(a * c + b * d, "i² is −1, so the product of the two imaginary parts flips sign.") : trap(a * d - b * c, "The outer and inner products are added."),
            wantReal ? trap(a * c, "The product of the imaginary parts is real too, because i² = −1.") : trap(b * d, "The product of the two imaginary parts is real, because i² = −1. It does not carry an i."),
            wantReal ? trap(im, "That is the coefficient of i. The real part has no i.") : trap(re, "That is the real part. The imaginary part is the coefficient of i."),
          ]),
          explanation: `(${cx(a, b)})(${cx(c, d)}) = ${a * c}${plusTerm(a * d, "i")}${plusTerm(b * c, "i")}${plusTerm(b * d, "i²")} = ${cx(re, im)}, so the ${wantReal ? "real" : "imaginary"} part is ${answer}`,
        };
      }
      // A number times its conjugate.
      const a = nz(9);
      const b = nz(9);
      const answer = a * a + b * b;
      return {
        id: "",
        type: "numeric",
        prompt: `Multiply (${cx(a, b)}) by its conjugate (${cx(a, -b)}). Write a plain number.`,
        hint: "FOIL. The two middle terms cancel, and the last product has i² = −1.",
        answer,
        traps: trapsFor(answer, [
          trap(a * a - b * b, "The last product is −b²i², and i² = −1 makes it +b²."),
          trap(a * a, "The product of the imaginary parts is real (i² = −1) and must be included."),
          trap(2 * a, "FOIL all four pairs: the i terms cancel, but the real products remain."),
        ]),
        explanation: `(${cx(a, b)})(${cx(a, -b)}) = ${a * a}${plusTerm(-a * b, "i")}${plusTerm(a * b, "i")}${plusTerm(-b * b, "i²")} = ${a * a} + ${b * b} = ${answer}`,
      };
    }),

  "complex-roots": (seeds) =>
    fillToCount("complex-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0 || kind === 1) {
        // x² + c = 0, or a·x² + c = 0, with no real solutions.
        let k = randInt(1, 7);
        let m: number = pick(SQUARE_FREE);
        if (k === 1 && m === 1) k = randInt(2, 7);
        if (k > 5) m = 1;
        const c = k * k * m;
        const a = kind === 0 ? 1 : randInt(2, 4);
        const answer = `x = ±${imRoot(k, m)}`;
        const eq = kind === 0 ? (randInt(0, 1) === 0 ? `x² + ${c} = 0` : `x² = -${c}`) : `${a}x² + ${a * c} = 0`;
        return mcCard(
          `Solve ${eq}.`,
          kind === 0 ? `Get x² alone: x² = −${c}. Take the square root of both sides, keep the ±, and write √(−1) as i.` : `Divide by ${a} first so x² is alone, then take the square root of both sides with ±, writing √(−1) as i.`,
          answer,
          [
            { value: `x = ±${realRoot(k, m)}`, why: "x² equals a negative number, so no real number works. The square root of a negative brings in i." },
            { value: `x = ${imRoot(k, m)}`, why: "A square root has two values. Keep the ±." },
            { value: `x = ±${a * c}i`, why: kind === 0 ? `Take the square root of ${c} as well as pulling out i.` : `Divide by ${a} first, then take the square root of what is left.` },
            { value: `x = ±${imRoot(k * k, m)}`, why: `√${k * k} is ${k}.` },
            { value: `x = ±${m === 1 ? imRoot(k, 2) : imRoot(1, c)}`, why: m === 1 ? `${c} is a perfect square.` : `Pull the perfect-square factor ${k * k} out of √${c}.` },
          ],
          `x² = −${c} → x = ±√(−${c}) = ${answer}`
        );
      }
      if (kind === 2) {
        // Count the real solutions with the discriminant.
        const a = randInt(1, 3);
        const b = nz(8);
        let c: number;
        const want = randInt(0, 9);
        if (want < 6) {
          // Negative discriminant: c > b²/4a.
          c = Math.floor((b * b) / (4 * a)) + randInt(1, 6);
        } else if (want < 8) {
          c = -randInt(1, 9);
        } else {
          // Zero discriminant when b² is divisible by 4a; otherwise positive.
          c = (b * b) % (4 * a) === 0 ? (b * b) / (4 * a) : Math.max(1, Math.floor((b * b) / (4 * a)) - 1);
        }
        const disc = b * b - 4 * a * c;
        const answer = disc < 0 ? 0 : disc === 0 ? 1 : 2;
        return {
          id: "",
          type: "numeric",
          prompt: `How many real solutions does ${quad(a, b, c)} = 0 have?`,
          hint: "Compute the discriminant b² − 4ac. Negative means no real solutions, zero means exactly one, positive means two.",
          answer,
          traps: trapsFor(answer, [
            trap(2, disc < 0 ? "Two real solutions need a positive discriminant. Check the sign of b² − 4ac." : "Two real solutions need a positive discriminant, and this one is exactly zero."),
            trap(0, "No real solutions needs a negative discriminant. Compute b² − 4ac carefully, with 4ac subtracted."),
            trap(1, disc < 0 ? "One real solution needs the discriminant to be exactly 0. Compute b² − 4ac." : "One real solution needs the discriminant to be exactly 0, and this one is positive."),
            trap(disc, "That is the discriminant itself. The question asks how many real solutions its sign allows."),
          ]),
          explanation: `b² − 4ac = (${b})² − 4(${a})(${c}) = ${b * b}${plusTerm(-4 * a * c)} = ${disc}, which is ${disc < 0 ? "negative, so 0 real solutions (both are complex)" : disc === 0 ? "zero, so exactly 1 real solution" : "positive, so 2 real solutions"}`,
        };
      }
      if (kind === 3) {
        // The modulus of a + bi, with a Pythagorean triple.
        const triple = pick([
          [3, 4, 5],
          [6, 8, 10],
          [5, 12, 13],
          [8, 15, 17],
          [9, 12, 15],
          [12, 16, 20],
          [7, 24, 25],
          [15, 20, 25],
          [20, 21, 29],
          [10, 24, 26],
        ]);
        const flip = randInt(0, 1) === 0;
        const a = (flip ? triple[1] : triple[0]) * (randInt(0, 1) === 0 ? 1 : -1);
        const b = (flip ? triple[0] : triple[1]) * (randInt(0, 1) === 0 ? 1 : -1);
        const answer = triple[2];
        return {
          id: "",
          type: "numeric",
          prompt: `Find |${cx(a, b)}|, the modulus of ${cx(a, b)}.`,
          hint: "The modulus is √(a² + b²), the distance from 0 in the complex plane.",
          answer,
          traps: trapsFor(answer, [
            trap(a * a + b * b, "That is a² + b². The modulus is its square root."),
            trap(Math.abs(a) + Math.abs(b), "The parts are not added. Square each, add, then take the square root."),
            trap(Math.abs(a * a - b * b), "Both squares are added: |a + bi| = √(a² + b²)."),
          ]),
          explanation: `|${cx(a, b)}| = √((${a})² + (${b})²) = √(${a * a} + ${b * b}) = √${a * a + b * b} = ${answer}`,
        };
      }
      // x² + bx + c = 0 with complex solutions p ± qi.
      const p = nz(5);
      const q = randInt(1, 6);
      const b = -2 * p;
      const c = p * p + q * q;
      const answer = `x = ${p} ± ${q === 1 ? "" : q}i`;
      return mcCard(
        `Solve ${quad(1, b, c)} = 0.`,
        `Complete the square: (x${plusTerm(-p)})² = -${q * q}. Then take the square root of both sides, keeping the ± and writing √(−1) as i.`,
        answer,
        [
          { value: `x = ${-p} ± ${q === 1 ? "" : q}i`, why: `After completing the square the equation is (x${plusTerm(-p)})² = -${q * q}. Solve that for x.` },
          { value: `x = ${p} ± ${q}`, why: `(x${plusTerm(-p)})² equals a negative number, so the square root brings in i.` },
          { value: `x = ${2 * p} ± ${q === 1 ? "" : q}i`, why: "Half of the x-coefficient, with its sign flipped, is the real part." },
          { value: `x = ${p} ± ${q * q}i`, why: `Take the square root of ${q * q}.` },
        ],
        `${quad(1, b, c)} = 0 → (x${plusTerm(-p)})² = -${q * q} → x${plusTerm(-p)} = ±${q === 1 ? "" : q}i → ${answer}`
      );
    }),
};
