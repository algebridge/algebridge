import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, fmtNum, mcChoices, plusTerm, quad, randInt, trapsFor } from "@/lib/problem-utils";

function trap(value: number | string, why: string, step?: number): Trap {
  return step === undefined ? { value, why } : { value, why, step };
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

type Wrong = { value: string; why: string; step?: number };

/** The first three candidate wrong answers that are distinct and differ from the key. */
function wrongThree(answer: string, candidates: Wrong[]): Wrong[] {
  const out: Wrong[] = [];
  for (const c of candidates) {
    if (sameChoice(c.value, answer)) continue;
    if (out.some((o) => sameChoice(o.value, c.value))) continue;
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

function mcCard(prompt: string, hint: string, answer: string, wrong: Wrong[], explanation: string): PracticeProblem {
  const three = wrongThree(answer, wrong);
  return {
    id: "",
    type: "multiple-choice",
    prompt,
    hint,
    answer,
    choices: mcChoices(answer, three.map((w) => w.value)),
    traps: trapsFor(answer, three.map((w) => trap(w.value, w.why, w.step))),
    explanation,
  };
}

/** A term with its number in front: (3, "i²") → "3i²", (1, "i²") → "i²", (-1, "i²") → "-i²". */
function term(n: number, v: string): string {
  return n === 1 ? v : n === -1 ? `-${v}` : `${fmtNum(n)}${v}`;
}

/** A number written after an operator: 4 → "4", -4 → "(-4)". */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);

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
        const steps = [
          `split off the −1: √(−${n}) = √${n} · √(−1)`,
          `√(−1) = i, so √(−${n}) = √${n} · i`,
          m === 1 ? `${n} = ${k}², so √${n} = ${k}` : `√${n} = √(${k * k} · ${m}) = ${realRoot(k, m)}`,
          `√(−${n}) = ${answer}`,
        ];
        return mcCard(
          `Simplify √(−${n}).`,
          `Write √(−${n}) as √${n} · √(−1). Then √(−1) = i, and simplify √${n} by pulling out its largest perfect-square factor.`,
          answer,
          [
            { value: realRoot(k, m), why: "The minus sign under the root cannot vanish. √(−1) is i, and it stays in the answer.", step: 1 },
            { value: `-${realRoot(k, m)}`, why: "A negative under a square root does not become a negative in front. √(−1) is i.", step: 0 },
            { value: `${n}i`, why: `Pulling out i leaves √${n} still to be simplified.`, step: 2 },
            { value: imRoot(k * k, m), why: `√${k * k} is ${k}, so the number in front of i is ${k}.`, step: 2 },
            { value: m === 1 ? imRoot(k, 2) : imRoot(1, n), why: m === 1 ? `${n} is a perfect square, so nothing stays under the root.` : `Pull the perfect-square factor ${k * k} out of √${n}.`, step: 2 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 1) {
        // A power of i.
        const n = randInt(5, 99);
        const answer = I_POWER[n % 4];
        const r = n % 4;
        const q = Math.floor(n / 4);
        const ir = `i${["", "", "²", "³"][r]}`;
        const steps = [
          `${n} ÷ 4 = ${q} remainder ${r}, so ${n} = 4 × ${q}${r ? ` + ${r}` : ""}`,
          r ? `i^${n} = (i⁴)^${q} · ${ir} = 1 · ${ir}, since i⁴ = 1` : `i^${n} = (i⁴)^${q} = 1^${q}, since i⁴ = 1`,
          r ? `the cycle i, i² = −1, i³ = −i, i⁴ = 1 gives ${ir} = ${answer}` : `1^${q} = 1`,
        ];
        const offByOne = [I_POWER[(r + 1) % 4], I_POWER[(r + 3) % 4]];
        const others = I_POWER.filter((v) => v !== answer);
        return mcCard(
          `What is i^${n}?`,
          "i, i² = −1, i³ = −i, i⁴ = 1, then the cycle repeats. Divide the exponent by 4 and use the remainder.",
          answer,
          others.map((v) =>
            offByOne.includes(v)
              ? { value: v, why: `${n} ÷ 4 leaves remainder ${r}, so i^${n} matches i^${r === 0 ? 4 : r}.`, step: 0 }
              : { value: v, why: "Check the sign in the cycle: i¹ = i, i² = −1, i³ = −i, i⁴ = 1.", step: 2 }
          ),
          steps.join(" → ")
        );
      }
      if (kind === 2) {
        // (ai)² or (ai)(bi): a plain number.
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        const square = randInt(0, 1) === 0;
        const prod = square ? a * a : a * b;
        const answer = -prod;
        const steps = [
          square ? `(${a}i)² = ${a}² · i² = ${prod}i²` : `(${a}i)(${b}i) = ${a} · ${b} · i · i = ${prod}i²`,
          `i² = −1, so ${prod}i² = ${prod} · (−1)`,
          `${prod} · (−1) = ${answer}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: square ? `Simplify (${a}i)². Write a plain number.` : `Simplify (${a}i)(${b}i). Write a plain number.`,
          hint: "Multiply the numbers, multiply the i's to get i², and replace i² with −1.",
          answer,
          traps: trapsFor(answer, [
            trap(-answer, "i² is −1, not 1. The product of two imaginary numbers flips sign.", 1),
            trap(square ? 2 * a : a + b, square ? "Squaring multiplies the number by itself, not by 2." : "The numbers multiply, they are not added.", 0),
            trap(square ? -2 * a : -(a + b), square ? "Squaring multiplies the number by itself, not by 2." : "The numbers multiply, they are not added.", 0),
          ]),
          explanation: steps.join(" → "),
        };
      }
      if (kind === 3) {
        // √(−a) · √(−b) with perfect squares: convert first, then multiply.
        const p = randInt(2, 9);
        const q = randInt(2, 9);
        const answer = -p * q;
        const steps = [
          `take the i out first: √(−${p * p}) = √${p * p} · √(−1) = ${p}i`,
          `√(−${q * q}) = √${q * q} · √(−1) = ${q}i`,
          `${p}i · ${q}i = ${p * q}i²`,
          `i² = −1, so ${p * q}i² = −${p * q}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify √(−${p * p}) · √(−${q * q}). Write a plain number.`,
          hint: `Rewrite each root with i first: √(−${p * p}) = ${p}i. Then multiply and use i² = −1.`,
          answer,
          traps: trapsFor(answer, [
            trap(p * q, `The rule √a · √b = √(ab) only works for nonnegative a and b. Convert to ${p}i and ${q}i first, then i² = −1.`, 0),
            trap(-(p + q), "The two imaginary numbers multiply; their coefficients are not added.", 2),
            trap(p * p * q * q, "Take the square roots before multiplying.", 0),
          ]),
          explanation: steps.join(" → "),
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
        const steps = add
          ? [`real parts: ${a}${plusTerm(c)} = ${re}`, `imaginary parts: ${b}${plusTerm(d)} = ${im}, so ${term(im, "i")}`, `${answer}`]
          : [`real parts: ${a} − ${par(c)} = ${re}`, `imaginary parts: ${b} − ${par(d)} = ${im}, so ${term(im, "i")}`, `${answer}`];
        if (im === 0) steps[1] = add ? `imaginary parts: ${b}${plusTerm(d)} = 0, so the i term drops out` : `imaginary parts: ${b} − ${par(d)} = 0, so the i term drops out`;
        return mcCard(
          add ? `Add: (${cx(a, b)}) + (${cx(c, d)}).` : `Subtract: (${cx(a, b)}) − (${cx(c, d)}).`,
          add ? "Add the real parts together and the imaginary parts together." : "Subtract both parts of the second number: its real part from the real part, its imaginary part from the imaginary part.",
          answer,
          [
            { value: cx(add ? a + c : a - c, add ? b - d : b + d), why: add ? "Add the imaginary parts with their signs." : "The minus applies to the imaginary part of the second number too.", step: 1 },
            { value: cx(add ? a - c : a + c, add ? b + d : b - d), why: add ? "This is an addition: the real parts are added." : "This is a subtraction: the real parts are subtracted.", step: 0 },
            { value: cx(re + im, 0), why: "Real parts stay real and imaginary parts stay imaginary; they never merge into one term.", step: 2 },
            { value: cx(re, -im), why: "Check the sign of the imaginary part.", step: 1 },
            { value: cx(-re, im), why: "Check the sign of the real part.", step: 0 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 2 || kind === 3) {
        // Multiply (a + bi)(c + di), or name one part of the product.
        const r = kind === 2 ? 6 : 7;
        const [a, b, c, d] = [nz(r), nz(r), nz(r), nz(r)];
        const re = a * c - b * d;
        const im = a * d + b * c;
        const steps = [
          `FOIL: (${cx(a, b)})(${cx(c, d)}) = ${a * c}${plusTerm(a * d, "i")}${plusTerm(b * c, "i")}${plusTerm(b * d, "i²")}`,
          `i² = −1, so ${term(b * d, "i²")} = ${-b * d}`,
          `real part: ${a * c}${plusTerm(-b * d)} = ${re}; imaginary part: ${a * d}${plusTerm(b * c)} = ${im}`,
          `${cx(re, im)}`,
        ];
        if (kind === 2) {
          const answer = cx(re, im);
          return mcCard(
            `Multiply: (${cx(a, b)})(${cx(c, d)}).`,
            "FOIL as if i were a variable, replace i² with −1, then collect the real and imaginary parts.",
            answer,
            [
              { value: cx(a * c + b * d, im), why: "The last product has i², which is −1, so it flips sign before joining the real part.", step: 1 },
              { value: cx(a * c, b * d), why: "Multiply all four pairs, not just first and last. The outer and inner products give the imaginary part.", step: 0 },
              { value: cx(re, a * d - b * c), why: "The outer and inner products are added.", step: 2 },
              { value: cx(a * c, a * d + b * c), why: "The product of the two imaginary parts is real, because i² = −1, and joins the real part.", step: 2 },
            ],
            steps.join(" → ")
          );
        }
        // The real or imaginary part of a product: a plain number.
        const wantReal = randInt(0, 1) === 0;
        const answer = wantReal ? re : im;
        steps[3] = `${cx(re, im)}, so the ${wantReal ? "real" : "imaginary"} part is ${answer}`;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the ${wantReal ? "real" : "imaginary"} part of (${cx(a, b)})(${cx(c, d)})?`,
          hint: wantReal ? "FOIL. The first product and the last product (after i² = −1) are the real part." : "FOIL. The outer and inner products carry the i; add their coefficients.",
          answer,
          traps: trapsFor(answer, [
            wantReal ? trap(a * c + b * d, "i² is −1, so the product of the two imaginary parts flips sign.", 1) : trap(a * d - b * c, "The outer and inner products are added.", 2),
            wantReal ? trap(a * c, "The product of the imaginary parts is real too, because i² = −1.", 2) : trap(b * d, "The product of the two imaginary parts is real, because i² = −1. It does not carry an i.", 1),
            wantReal ? trap(im, "That is the coefficient of i. The real part has no i.", 3) : trap(re, "That is the real part. The imaginary part is the coefficient of i.", 3),
          ]),
          explanation: steps.join(" → "),
        };
      }
      // A number times its conjugate.
      const a = nz(9);
      const b = nz(9);
      const answer = a * a + b * b;
      const steps = [
        `FOIL: (${cx(a, b)})(${cx(a, -b)}) = ${a * a}${plusTerm(-a * b, "i")}${plusTerm(a * b, "i")}${plusTerm(-b * b, "i²")}`,
        `the two i terms cancel, leaving ${a * a}${plusTerm(-b * b, "i²")}`,
        `i² = −1, so ${term(-b * b, "i²")} = +${b * b}`,
        `${a * a} + ${b * b} = ${answer}`,
      ];
      return {
        id: "",
        type: "numeric",
        prompt: `Multiply (${cx(a, b)}) by its conjugate (${cx(a, -b)}). Write a plain number.`,
        hint: "FOIL. The two middle terms cancel, and the last product has i² = −1.",
        answer,
        traps: trapsFor(answer, [
          trap(a * a - b * b, "The last product is −b²i², and i² = −1 makes it +b².", 2),
          trap(a * a, "The product of the imaginary parts is real (i² = −1) and must be included.", 1),
          trap(2 * a, "FOIL all four pairs: the i terms cancel, but the real products remain.", 0),
        ]),
        explanation: steps.join(" → "),
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
        const alone = kind === 0 && randInt(0, 1) === 1;
        const eq = kind === 0 ? (alone ? `x² = -${c}` : `x² + ${c} = 0`) : `${a}x² + ${a * c} = 0`;
        const iso =
          kind === 1
            ? [`subtract ${a * c}: ${a}x² = −${a * c}`, `divide by ${a}: x² = −${c}`]
            : alone
              ? [`x² is already alone: x² = −${c}`]
              : [`subtract ${c}: x² = −${c}`];
        const R = iso.length;
        const steps = [
          ...iso,
          `take the square root of both sides, keeping ±: x = ±√(−${c})`,
          `√(−${c}) = √${c} · √(−1) = √${c} · i`,
          m === 1 ? `√${c} = ${k}` : `√${c} = √(${k * k} · ${m}) = ${realRoot(k, m)}`,
          answer,
        ];
        return mcCard(
          `Solve ${eq}.`,
          kind === 0 ? `Get x² alone: x² = −${c}. Take the square root of both sides, keep the ±, and write √(−1) as i.` : `Divide by ${a} first so x² is alone, then take the square root of both sides with ±, writing √(−1) as i.`,
          answer,
          [
            { value: `x = ±${realRoot(k, m)}`, why: "x² equals a negative number, so no real number works. The square root of a negative brings in i.", step: R + 1 },
            { value: `x = ${imRoot(k, m)}`, why: "A square root has two values. Keep the ±.", step: R },
            { value: `x = ±${a * c}i`, why: kind === 0 ? `Take the square root of ${c} as well as pulling out i.` : `Divide by ${a} first, then take the square root of what is left.`, step: kind === 0 ? R + 2 : 1 },
            { value: `x = ±${imRoot(k * k, m)}`, why: `√${k * k} is ${k}.`, step: R + 2 },
            { value: `x = ±${m === 1 ? imRoot(k, 2) : imRoot(1, c)}`, why: m === 1 ? `${c} is a perfect square.` : `Pull the perfect-square factor ${k * k} out of √${c}.`, step: R + 2 },
          ],
          steps.join(" → ")
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
        const steps = [
          `a = ${a}, b = ${b}, c = ${c}: b² − 4ac = (${b})² − 4(${a})(${c})`,
          `= ${b * b}${plusTerm(-4 * a * c)} = ${disc}`,
          `${disc} is ${disc < 0 ? "negative, so 0 real solutions (both are complex)" : disc === 0 ? "zero, so exactly 1 real solution" : "positive, so 2 real solutions"}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: `How many real solutions does ${quad(a, b, c)} = 0 have?`,
          hint: "Compute the discriminant b² − 4ac. Negative means no real solutions, zero means exactly one, positive means two.",
          answer,
          traps: trapsFor(answer, [
            trap(2, disc < 0 ? "Two real solutions need a positive discriminant. Check the sign of b² − 4ac." : "Two real solutions need a positive discriminant, and this one is exactly zero.", 2),
            trap(0, "No real solutions needs a negative discriminant. Compute b² − 4ac carefully, with 4ac subtracted.", 1),
            trap(1, disc < 0 ? "One real solution needs the discriminant to be exactly 0. Compute b² − 4ac." : "One real solution needs the discriminant to be exactly 0, and this one is positive.", 2),
            trap(disc, "That is the discriminant itself. The question asks how many real solutions its sign allows.", 2),
          ]),
          explanation: steps.join(" → "),
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
        const steps = [
          `|${cx(a, b)}| = √((${a})² + (${b})²)`,
          `square each part: (${a})² = ${a * a}, (${b})² = ${b * b}`,
          `add: √(${a * a} + ${b * b}) = √${a * a + b * b}`,
          `√${a * a + b * b} = ${answer}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: `Find |${cx(a, b)}|, the modulus of ${cx(a, b)}.`,
          hint: "The modulus is √(a² + b²), the distance from 0 in the complex plane.",
          answer,
          traps: trapsFor(answer, [
            trap(a * a + b * b, "That is a² + b². The modulus is its square root.", 3),
            trap(Math.abs(a) + Math.abs(b), "The parts are not added. Square each, add, then take the square root.", 0),
            trap(Math.abs(a * a - b * b), "Both squares are added: |a + bi| = √(a² + b²).", 2),
          ]),
          explanation: steps.join(" → "),
        };
      }
      // x² + bx + c = 0 with complex solutions p ± qi.
      const p = nz(5);
      const q = randInt(1, 6);
      const b = -2 * p;
      const c = p * p + q * q;
      const qi = q === 1 ? "i" : `${q}i`;
      const answer = `x = ${p} ± ${q === 1 ? "" : q}i`;
      const steps = [
        `move ${c} across: ${quad(1, b, 0)} = −${c}`,
        `add (${b} ÷ 2)² = ${p * p} to both sides: ${quad(1, b, p * p)} = −${c} + ${p * p}`,
        `(x${plusTerm(-p)})² = −${q * q}`,
        `x${plusTerm(-p)} = ±√(−${q * q}) = ±${qi}`,
        answer,
      ];
      return mcCard(
        `Solve ${quad(1, b, c)} = 0.`,
        `Complete the square: (x${plusTerm(-p)})² = -${q * q}. Then take the square root of both sides, keeping the ± and writing √(−1) as i.`,
        answer,
        [
          { value: `x = ${-p} ± ${q === 1 ? "" : q}i`, why: `After completing the square the equation is (x${plusTerm(-p)})² = -${q * q}. Solve that for x.`, step: 4 },
          { value: `x = ${p} ± ${q}`, why: `(x${plusTerm(-p)})² equals a negative number, so the square root brings in i.`, step: 3 },
          { value: `x = ${2 * p} ± ${q === 1 ? "" : q}i`, why: "Half of the x-coefficient, with its sign flipped, is the real part.", step: 2 },
          { value: `x = ${p} ± ${q * q}i`, why: `Take the square root of ${q * q}.`, step: 3 },
        ],
        steps.join(" → ")
      );
    }),
};
