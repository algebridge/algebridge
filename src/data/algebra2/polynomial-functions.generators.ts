import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, coef, fillToCount, fmtNum, mcChoices, plusTerm, randInt, seededShuffle, trapsFor } from "@/lib/problem-utils";

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

const SUP = ["", "", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const xpow = (n: number) => (n === 0 ? "" : n === 1 ? "x" : `x${SUP[n]}`);

/** One term of a polynomial, as the first term or as a later one: (−3, 2, false) → " − 3x²". */
function term(c: number, n: number, first: boolean): string {
  if (c === 0) return "";
  if (n === 0) return first ? fmtNum(c) : plusTerm(c);
  return first ? coef(c, xpow(n)) : plusTerm(c, xpow(n));
}

/** Terms [coefficient, power] printed in the order given, zeros skipped. */
function polyFrom(terms: [number, number][]): string {
  let out = "";
  for (const [c, n] of terms) {
    if (c === 0) continue;
    out += term(c, n, out === "");
  }
  return out || "0";
}

/** Coefficients from the highest power down, printed in standard form: [1, -2, 0, 5] → "x³ − 2x² + 5". */
function polyText(high: number[]): string {
  const deg = high.length - 1;
  return polyFrom(high.map((c, idx) => [c, deg - idx] as [number, number]));
}

/** Synthetic division of the coefficients (highest first) by x − k: the bottom row, remainder last. */
function synth(high: number[], k: number): number[] {
  const row: number[] = [];
  let carry = 0;
  for (const c of high) {
    carry = c + carry * k;
    row.push(carry);
  }
  return row;
}

function polyAt(high: number[], x: number): number {
  return high.reduce((acc, c) => acc * x + c, 0);
}

/** The divisor x − k, printed: 3 → "x − 3", -3 → "x + 3". */
const divisor = (k: number) => `x${plusTerm(-k)}`;

/** (x − r1)(x − r2)(x − r3) expanded, highest first. */
function fromRoots(roots: number[]): number[] {
  let high = [1];
  for (const r of roots) {
    const next = new Array(high.length + 1).fill(0);
    for (let idx = 0; idx < high.length; idx++) {
      next[idx] += high[idx];
      next[idx + 1] -= r * high[idx];
    }
    high = next;
  }
  return high;
}

const sameChoice = (a: string, b: string) => a.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase() === b.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();

type Wrong = { value: string; why: string; step?: number };

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

const END = {
  upUp: "as x → ∞, y → ∞ and as x → −∞, y → ∞",
  downDown: "as x → ∞, y → −∞ and as x → −∞, y → −∞",
  upDown: "as x → ∞, y → ∞ and as x → −∞, y → −∞",
  downUp: "as x → ∞, y → −∞ and as x → −∞, y → ∞",
};

function endBehavior(deg: number, lead: number): string {
  if (deg % 2 === 0) return lead > 0 ? END.upUp : END.downDown;
  return lead > 0 ? END.upDown : END.downUp;
}

const DEGREE_NAME = ["constant", "linear", "quadratic", "cubic", "quartic", "quintic"];
const TERMS_NAME = ["", "monomial", "binomial", "trinomial", "polynomial with 4 terms"];

/** A random polynomial of the given degree with the given number of nonzero terms, highest first. */
function randomPoly(deg: number, terms: number): number[] {
  const high = new Array(deg + 1).fill(0);
  high[0] = nz(5);
  const lower = seededShuffle(Array.from({ length: deg }, (_, idx) => idx + 1)).slice(0, terms - 1);
  for (const idx of lower) high[idx] = nz(9);
  return high;
}

/** Three distinct integer roots in [-6, 6], none zero, no pair of opposites (so sign-flipped distractors stay wrong). */
function threeRoots(): number[] {
  for (;;) {
    const roots = [nz(6), nz(6), nz(6)];
    const abs = new Set(roots.map(Math.abs));
    if (abs.size === 3) return roots.sort((a, b) => a - b);
  }
}

const factored = (roots: number[]) => roots.map((r) => `(${divisor(r)})`).join("");

/** An end behavior written for an explanation step, with words instead of arrows. */
const endWords = (text: string) => text.replace(/→/g, "goes to");

/** A number written after an operator: 4 → "4", -4 → "(-4)". */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/** a + p written out, keeping a zero visible: (5, -6) → "5 − 6", (5, 0) → "5 + 0". */
const addLine = (a: number, p: number) => (p === 0 ? `${a} + 0` : `${a}${plusTerm(p)}`);

/** The multiply-and-add lines of synthetic division of `high` by x − k, one per column after the first. */
function synthLines(high: number[], k: number): string[] {
  const row = synth(high, k);
  const out: string[] = [];
  for (let idx = 1; idx < high.length; idx++) {
    const prod = row[idx - 1] * k;
    const sum = prod === 0 ? `adding 0 leaves ${row[idx]}` : `${addLine(high[idx], prod)} = ${row[idx]}`;
    out.push(`${idx === 1 ? `bring down ${row[0]}; ` : ""}${row[idx - 1]} × ${par(k)} = ${prod}, and ${sum}`);
  }
  return out;
}

/** P(k) written two ways: with k substituted, and with each term worked out. */
function substitute(high: number[], k: number): [string, string] {
  const deg = high.length - 1;
  let shown = "";
  let worked = "";
  high.forEach((c, idx) => {
    const n = deg - idx;
    if (c === 0) return;
    const v = n === 0 ? "" : `(${k})${SUP[n]}`;
    if (n === 0) shown += shown === "" ? fmtNum(c) : plusTerm(c);
    else shown += shown === "" ? coef(c, v) : plusTerm(c, v);
    const val = c * k ** n;
    worked += worked === "" ? fmtNum(val) : plusTerm(val) || " + 0";
  });
  return [shown || "0", worked || "0"];
}

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "polynomial-end-behavior": (seeds) =>
    fillToCount("polynomial-end-behavior", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0 || kind === 1) {
        // Degree or leading coefficient of a polynomial printed out of order.
        const deg = randInt(3, 6);
        const terms = randInt(3, 4);
        const high = randomPoly(deg, terms);
        const list = seededShuffle(high.map((c, idx) => [c, deg - idx] as [number, number]).filter(([c]) => c !== 0));
        // Keep the leading term off the front so the order has to be read.
        if (list[0][1] === deg) [list[0], list[1]] = [list[1], list[0]];
        const text = polyFrom(list);
        const lead = high[0];
        const firstC = list[0][0];
        const firstN = list[0][1];
        const termsLine = `the terms are ${list.map(([c, n]) => term(c, n, true)).join(", ")}`;
        const expLine = `their exponents on x are ${list.map(([, n]) => n).join(", ")} (a plain number has exponent 0)`;
        if (kind === 0) {
          return {
            id: "",
            type: "numeric",
            prompt: `P(x) = ${text}. What is the degree of P(x)?`,
            hint: "The degree is the largest exponent on x, wherever that term is written.",
            answer: deg,
            traps: trapsFor(deg, [
              trap(firstN, "The degree is the largest exponent, not the exponent of the first term written.", 2),
              trap(Math.abs(lead), "That is a coefficient. Look at the exponents on x.", 1),
              trap(terms, "That is how many terms there are. The degree is the largest exponent.", 1),
            ]),
            explanation: [termsLine, expLine, `the largest exponent is ${deg}, so the degree is ${deg}`].join(" → "),
          };
        }
        return {
          id: "",
          type: "numeric",
          prompt: `P(x) = ${text}. What is the leading coefficient of P(x)?`,
          hint: "Find the term with the largest exponent first. Its coefficient, with its sign, is the leading coefficient.",
          answer: lead,
          traps: trapsFor(lead, [
            trap(firstC, "The leading coefficient belongs to the term with the largest exponent, not the first term written.", 1),
            trap(-lead, "Keep the sign of the leading term.", 2),
            trap(deg, "That is the degree. The leading coefficient is the number in front of the highest-power term.", 2),
          ]),
          explanation: [expLine, `the largest exponent is ${deg}, on the term ${term(lead, deg, true)}`, `its coefficient, with its sign, is ${lead}`].join(" → "),
        };
      }
      if (kind === 2) {
        // End behavior from the printed polynomial.
        const deg = randInt(2, 6);
        const high = randomPoly(deg, randInt(2, 4));
        const lead = high[0];
        const answer = endBehavior(deg, lead);
        const even = deg % 2 === 0;
        const steps = [
          `the leading term is ${term(lead, deg, true)}`,
          `degree ${deg} is ${even ? "even, so both ends go the same way" : "odd, so the ends go opposite ways"}`,
          `the leading coefficient ${lead} is ${lead > 0 ? "positive, so the right end goes up" : "negative, so the right end goes down"}`,
          endWords(answer),
        ];
        return mcCard(
          `Describe the end behavior of P(x) = ${polyText(high)}.`,
          even ? "Even degree: both ends go the same way. A positive leading coefficient sends them up, a negative one sends them down." : "Odd degree: the ends go opposite ways. A positive leading coefficient means up on the right, a negative one means down on the right.",
          answer,
          [
            { value: endBehavior(deg, -lead), why: `The leading coefficient is ${lead}: its sign decides which way the right end goes.`, step: 2 },
            { value: endBehavior(deg + 1, lead), why: even ? `Degree ${deg} is even, so both ends go the same way.` : `Degree ${deg} is odd, so the two ends go opposite ways.`, step: 1 },
            { value: endBehavior(deg + 1, -lead), why: even ? `Degree ${deg} is even, so both ends go the same way.` : `Degree ${deg} is odd, so the two ends go opposite ways.`, step: 1 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 3) {
        // Classify by degree and number of terms.
        const deg = randInt(1, 5);
        const terms = randInt(1, Math.min(4, deg + 1));
        const high = randomPoly(deg, terms);
        const answer = `${DEGREE_NAME[deg]} ${TERMS_NAME[terms]}`;
        const otherDeg = deg === 5 ? 4 : deg + 1;
        const otherTerms = terms === 4 ? 3 : terms + 1;
        const steps = [
          `the largest exponent is ${deg}, so it is ${DEGREE_NAME[deg]}`,
          `it has ${terms} term${terms === 1 ? "" : "s"}, so it is a ${TERMS_NAME[terms]}`,
          answer,
        ];
        return mcCard(
          `Classify P(x) = ${polyText(high)} by its degree and its number of terms.`,
          "The degree names it (linear, quadratic, cubic, quartic, quintic); the count of terms names it too (monomial, binomial, trinomial).",
          answer,
          [
            { value: `${DEGREE_NAME[otherDeg]} ${TERMS_NAME[terms]}`, why: `The degree is the largest exponent on x, which is ${deg}.`, step: 0 },
            { value: `${DEGREE_NAME[deg]} ${TERMS_NAME[otherTerms]}`, why: `Count the terms separated by + and −: there are ${terms}.`, step: 1 },
            { value: `${DEGREE_NAME[otherDeg]} ${TERMS_NAME[otherTerms]}`, why: `Check both: the largest exponent is ${deg}, and the terms separated by + and − number ${terms}.`, step: 0 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 4) {
        // One end from the degree and the leading coefficient alone.
        const deg = randInt(2, 9);
        const lead = nz(9);
        const left = randInt(0, 1) === 0;
        const up = left ? (deg % 2 === 0 ? lead > 0 : lead < 0) : lead > 0;
        const answer = up ? "y → ∞" : "y → −∞";
        const steps = [
          `the leading term is ${term(lead, deg, true)}`,
          `the right end follows the sign of ${lead}, so on the right y goes ${lead > 0 ? "up" : "down"}`,
          ...(left ? [`degree ${deg} is ${deg % 2 === 0 ? "even, so the left end matches the right end" : "odd, so the left end is opposite to the right end"}: on the left y goes ${up ? "up" : "down"}`] : []),
          `as x goes to ${left ? "−∞" : "∞"}, y goes to ${up ? "∞" : "−∞"}`,
        ];
        return mcCard(
          `A polynomial has degree ${deg} and leading coefficient ${lead}. As x → ${left ? "−∞" : "∞"}, what happens to y?`,
          left ? "On the left, an even degree matches the right end and an odd degree does the opposite of the right end. The right end follows the sign of the leading coefficient." : "On the right, y follows the sign of the leading coefficient: positive goes up, negative goes down.",
          answer,
          [
            { value: up ? "y → −∞" : "y → ∞", why: left ? `Degree ${deg} is ${deg % 2 === 0 ? "even, so the left end matches the right end" : "odd, so the left end is opposite to the right end"}, and the right end follows the sign of ${lead}.` : `The right end follows the sign of the leading coefficient, ${lead}.`, step: left ? 2 : 1 },
            { value: "y → 0", why: "A polynomial of degree 1 or more never levels off; its leading term grows without bound.", step: steps.length - 1 },
            { value: `y → ${lead}`, why: "The leading coefficient sets the direction, not a value y settles at.", step: 1 },
          ],
          steps.join(" → ")
        );
      }
      // Degree of a product of factors.
      const count = randInt(2, 3);
      const factors: [number, number][] = [];
      const used = new Set<number>();
      while (factors.length < count) {
        const r = nz(5);
        if (used.has(r)) continue;
        used.add(r);
        factors.push([r, randInt(1, 3)]);
      }
      const deg = factors.reduce((s, [, m]) => s + m, 0);
      const text = factors.map(([r, m]) => `(${divisor(r)})${m > 1 ? SUP[m] : ""}`).join("");
      return {
        id: "",
        type: "numeric",
        prompt: `P(x) = ${text}. What is the degree of P(x)?`,
        hint: "Each factor (x − r) contributes degree 1, and a power on a factor multiplies that. Add the degrees of all the factors.",
        answer: deg,
        traps: trapsFor(deg, [
          trap(count, "A squared or cubed factor counts more than once. Add the exponents on the factors.", 0),
          trap(factors.reduce((s, [, m]) => s * m, 1), "Degrees of multiplied factors add; they are not multiplied together.", 1),
          trap(Math.max(...factors.map(([, m]) => m)), "Every factor adds to the degree, not just the one with the biggest exponent.", 1),
        ]),
        explanation: [
          `degree of each factor: ${factors.map(([r, m]) => `(${divisor(r)})${m > 1 ? SUP[m] : ""} has degree ${m}`).join(", ")}`,
          `multiplying adds degrees: ${factors.map(([, m]) => m).join(" + ")} = ${deg}`,
        ].join(" → "),
      };
    }),

  "polynomial-division": (seeds) =>
    fillToCount("polynomial-division", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      const boxLine = (high: number[], k: number) => `${k > 0 ? `${divisor(k)} puts ${k}` : `${divisor(k)} = x − (${k}), so ${k} goes`} in the box; the coefficients are ${high.join(", ")}`;
      if (kind === 0 || kind === 4) {
        // The remainder of a cubic divided by x − k (kind 0) or x + k (kind 4).
        const high = [pick([1, 1, 2, -1]), nz(6), nz(8), nz(9)];
        const k = kind === 0 ? randInt(1, 4) : -randInt(1, 4);
        const row = synth(high, k);
        const r = row[3];
        const steps = [boxLine(high, k), ...synthLines(high, k), `the last number in the bottom row is the remainder: ${r}`];
        return {
          id: "",
          type: "numeric",
          prompt: `Use synthetic division to divide P(x) = ${polyText(high)} by (${divisor(k)}). What is the remainder?`,
          hint: `Put ${k} in the box (the divisor is x − (${k})). Bring down ${high[0]}, multiply by ${k}, add to the next coefficient, and repeat. The last number is the remainder.`,
          answer: r,
          traps: trapsFor(r, [
            trap(synth(high, -k)[3], `The divisor ${divisor(k)} means the number in the box is ${k}, not ${-k}.`, 0),
            trap(high[3], "The remainder is the last number after all the multiply-and-add steps, not the original constant term.", 4),
            trap(row[2], "Keep going: the remainder is the very last number in the bottom row.", 4),
          ]),
          explanation: steps.join(" → "),
        };
      }
      if (kind === 1) {
        // The quotient.
        const high = [pick([1, 1, 2, -1]), nz(6), nz(8), nz(9)];
        const k = nz(4);
        const row = synth(high, k);
        const answer = polyText(row.slice(0, 3));
        const wrongK = synth(high, -k);
        const steps = [boxLine(high, k), ...synthLines(high, k), `bottom row ${row.join(", ")}: the quotient is ${answer}, remainder ${row[3]}`];
        return mcCard(
          `Divide P(x) = ${polyText(high)} by (${divisor(k)}). What is the quotient (ignore the remainder)?`,
          `Use ${k} in the box. The bottom row, except its last number, gives the quotient's coefficients, one degree lower than P(x).`,
          answer,
          [
            { value: polyText(wrongK.slice(0, 3)), why: `The divisor ${divisor(k)} means the number in the box is ${k}, since ${divisor(k)} = x − (${k}).`, step: 0 },
            { value: polyText(high.slice(0, 3)), why: "The quotient's coefficients come from the bottom row after multiplying and adding, not from the original polynomial.", step: 4 },
            { value: polyText(row.slice(1, 4)), why: "The first coefficient is brought down as is, and the last number of the row is the remainder, not part of the quotient.", step: 4 },
            { value: polyText([row[0], -row[1], row[2]]), why: "Add each product to the next coefficient, keeping the signs.", step: 1 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 2) {
        // P(k) by synthetic division or substitution.
        const high = [pick([1, 2, -1, 3]), nz(7), nz(9), nz(9)];
        const k = nz(4);
        const value = polyAt(high, k);
        const [shown, worked] = substitute(high, k);
        const steps = [`P(${k}) = ${shown}`, `(${k})³ = ${k ** 3} and (${k})² = ${k * k}`, `= ${worked}`, `= ${value}`];
        return {
          id: "",
          type: "numeric",
          prompt: `P(x) = ${polyText(high)}. Find P(${k}).`,
          hint: `Substitute x = ${k} into every term, or run synthetic division with ${k}: the remainder is P(${k}).`,
          answer: value,
          traps: trapsFor(value, [
            trap(polyAt(high, -k), `Use x = ${k}, with its sign, in every term.`, 0),
            trap(high[0] * k * k * k + high[1] * k * k + high[2] * k + high[3] * k, "The constant term is not multiplied by x.", 2),
            trap(high[0] * k * 3 + high[1] * k * 2 + high[2] * k + high[3], "x³ means x × x × x, not 3x.", 1),
          ]),
          explanation: steps.join(" → "),
        };
      }
      if (kind === 3) {
        // Error analysis: a synthetic division with one slip.
        let high: number[];
        let k: number;
        let row: number[];
        do {
          high = [pick([1, 1, 2, -1]), nz(6), nz(8), nz(9)];
          k = nz(4);
          row = synth(high, k);
        } while (row.slice(0, 3).some((v) => v === 0) || row.some((v) => v * k === 0));
        const [a, b, c, d] = high;
        const [q2, q1, q0, r] = row;
        const slip = randInt(0, 2);
        const line = (left: number, prod: number, sum: string) => `${left} × ${k} = ${prod}; ${sum}`;
        const steps = [
          `Coefficients ${a}, ${b}, ${c}, ${d}; the divisor ${divisor(k)} puts ${slip === 0 ? -k : k} in the box.`,
          `Bring down ${q2}. ${line(q2, q2 * k, `${b}${plusTerm(q2 * k)} = ${slip === 1 ? b - q2 * k : q1}`)}`,
          `${line(q1, q1 * k, `${c}${plusTerm(q1 * k)} = ${slip === 2 ? c - q1 * k : q0}`)}`,
          `${line(q0, q0 * k, `${d}${plusTerm(q0 * k)} = ${r}`)}, the remainder.`,
        ];
        return {
          id: "",
          type: "error-analysis",
          prompt: `Find the error in this synthetic division of P(x) = ${polyText(high)} by (${divisor(k)}).`,
          hint: "Check the number in the box first (x − k puts k in the box), then check each multiply-and-add against the coefficient it lands on.",
          wrongStepIndex: slip,
          steps,
          explanation:
            slip === 0
              ? `The divisor ${divisor(k)} is x − (${k}), so the box holds ${k}. With ${k} the bottom row is ${row.join(", ")}.`
              : slip === 1
                ? `The product ${q2 * k} is added to ${b}: ${b}${plusTerm(q2 * k)} = ${q1}. The bottom row is ${row.join(", ")}.`
                : `The product ${q1 * k} is added to ${c}: ${c}${plusTerm(q1 * k)} = ${q0}. The bottom row is ${row.join(", ")}.`,
        };
      }
      // A quadratic divided by a linear factor: the quotient.
      const high = [pick([1, 1, 2, 3]), nz(7), nz(9)];
      const k = nz(5);
      const row = synth(high, k);
      const answer = polyText(row.slice(0, 2));
      const steps = [boxLine(high, k), ...synthLines(high, k), `bottom row ${row.join(", ")}: the quotient is ${answer}, remainder ${row[2]}`];
      return mcCard(
        `Divide P(x) = ${polyText(high)} by (${divisor(k)}). What is the quotient (ignore the remainder)?`,
        `Use ${k} in the box. Bring down ${high[0]}, multiply by ${k}, add to ${high[1]}. The two numbers you get are the quotient's coefficients.`,
        answer,
        [
          { value: polyText(synth(high, -k).slice(0, 2)), why: `The divisor ${divisor(k)} means the number in the box is ${k}.`, step: 0 },
          { value: polyText(high.slice(0, 2)), why: "The quotient's coefficients come from the bottom row after multiplying and adding.", step: 3 },
          { value: polyText([row[0], -row[1]]), why: "Add the product to the next coefficient, keeping the signs.", step: 1 },
          { value: polyText(row.slice(1, 3)), why: "The first coefficient is brought down as is, and the last number of the row is the remainder.", step: 3 },
        ],
        steps.join(" → ")
      );
    }),

  "remainder-factor-theorem": (seeds) =>
    fillToCount("remainder-factor-theorem", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // Is x − k a factor?
        const roots = threeRoots();
        const isFactor = randInt(0, 2) > 0;
        let high = isFactor ? fromRoots(roots) : [1, nz(5), nz(9), nz(9)];
        let k = isFactor ? pick(roots) : nz(4);
        while (!isFactor && polyAt(high, k) === 0) {
          high = [1, nz(5), nz(9), nz(9)];
          k = nz(4);
        }
        const r = polyAt(high, k);
        const answer = r === 0 ? "Yes, the remainder is 0" : `No, the remainder is ${r}`;
        const other = polyAt(high, -k);
        const wrongs = [other, r === 0 ? high[3] : -r, r === 0 ? k * k : high[3], r + 2 * k, r === 0 ? 1 : 0];
        const wrongSteps = [1, r === 0 ? 1 : 2, r === 0 ? 2 : 1, 2, r === 0 ? 2 : 3];
        const [shown, worked] = substitute(high, k);
        const steps = [
          `the remainder when dividing by ${divisor(k)} is P(${k})`,
          `P(${k}) = ${shown}`,
          `= ${worked}`,
          `= ${r}`,
          r === 0 ? `the remainder is 0, so ${divisor(k)} is a factor` : `${r} is not 0, so ${divisor(k)} is not a factor; the remainder is ${r}`,
        ];
        return mcCard(
          `Is (${divisor(k)}) a factor of P(x) = ${polyText(high)}? Use the remainder theorem.`,
          `Find P(${k}). By the factor theorem, ${divisor(k)} is a factor exactly when P(${k}) = 0; otherwise P(${k}) is the remainder.`,
          answer,
          [
            { value: r === 0 ? `No, the remainder is ${other === 0 ? high[3] : other}` : "Yes, the remainder is 0", why: r === 0 ? `Evaluate P(${k}), with the sign of ${k} in every term.` : `A factor needs a remainder of exactly 0. Compute P(${k}) carefully.`, step: r === 0 ? 1 : 3 },
            ...wrongs.map((w, idx) => ({ value: w === 0 ? "Yes, the remainder is 0" : `No, the remainder is ${w}`, why: `The remainder when dividing by ${divisor(k)} is P(${k}). Substitute x = ${k} into every term.`, step: wrongSteps[idx] })),
          ],
          steps.join(" → ")
        );
      }
      if (kind === 1) {
        // The third factor.
        const roots = threeRoots();
        const high = fromRoots(roots);
        const shown = seededShuffle(roots);
        const [r1, r2, want] = shown;
        const c2 = r1 * r2;
        const steps = [
          `multiply the known factors: (${divisor(r1)})(${divisor(r2)}) = ${polyText(fromRoots([r1, r2]))}`,
          `the constants of all three factors multiply to ${high[3]}: ${c2} · (−k) = ${high[3]}`,
          `−k = ${high[3]} ÷ ${par(c2)} = ${-want}`,
          `k = ${want}, so the third factor is ${divisor(want)}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: `P(x) = ${polyText(high)} has factors (${divisor(r1)}) and (${divisor(r2)}). Find k so that (x − k) is the third factor.`,
          hint: `Multiply the two known factors, then divide P(x) by that quadratic; or use that the constants of the three factors multiply to ${high[3]}.`,
          answer: want,
          traps: trapsFor(want, [
            trap(-want, `The third factor is x − k, so k is the zero of that factor, with its sign: the constants multiply to ${high[3]}.`, 3),
            trap(high[3], `${high[3]} is the constant term of P(x), the product of all three factors' constants.`, 2),
            trap(r1 * r2, "That is the product of the two known zeros. Divide the constant term by it, watching the signs.", 2),
          ]),
          explanation: steps.join(" → "),
        };
      }
      if (kind === 2) {
        // The other two zeros.
        const roots = threeRoots();
        const high = fromRoots(roots);
        const given = pick(roots);
        const rest = roots.filter((r) => r !== given);
        const pair = (a: number, b: number) => `x = ${Math.min(a, b)} and x = ${Math.max(a, b)}`;
        const answer = pair(rest[0], rest[1]);
        const steps = [
          `divide by ${divisor(given)} with ${given} in the box: bottom row ${synth(high, given).join(", ")}`,
          `the quotient is ${polyText(fromRoots(rest))}`,
          `factor it: (${divisor(rest[0])})(${divisor(rest[1])})`,
          `set each factor to 0: ${answer}`,
        ];
        return mcCard(
          `One zero of P(x) = ${polyText(high)} is x = ${given}. What are the other two zeros?`,
          `Divide P(x) by (${divisor(given)}) with synthetic division, then factor or solve the quadratic quotient.`,
          answer,
          [
            { value: pair(-rest[0], -rest[1]), why: `The zeros of the quotient are where each factor equals 0: x − r = 0 gives x = r, with the sign of r.`, step: 3 },
            { value: pair(given, rest[0]), why: `x = ${given} is the zero you were given. The question asks for the two others.`, step: 3 },
            { value: pair(given, rest[1]), why: `x = ${given} is the zero you were given. The question asks for the two others.`, step: 3 },
            { value: pair(rest[0], -rest[1]), why: "Check the sign of each zero against its factor.", step: 3 },
            { value: pair(-rest[0], rest[1]), why: "Check the sign of each zero against its factor.", step: 3 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 3) {
        // The constant that makes x − k a factor.
        const b = nz(5);
        const c = nz(9);
        const k = nz(4);
        const m = -(k * k * k + b * k * k + c * k);
        const body = polyText([1, b, c, 0]);
        const [shown] = substitute([1, b, c, 0], k);
        const steps = [
          `factor theorem: ${divisor(k)} is a factor when P(${k}) = 0`,
          `P(${k}) = ${shown} + m`,
          `= ${k ** 3}${plusTerm(b * k * k)}${plusTerm(c * k)} + m = ${-m} + m`,
          `${-m} + m = 0, so m = ${m}`,
        ];
        return {
          id: "",
          type: "numeric",
          prompt: `P(x) = ${body} + m. Find the value of m that makes (${divisor(k)}) a factor of P(x).`,
          hint: `By the factor theorem P(${k}) must be 0. Substitute x = ${k} into the known terms, then choose m to cancel the total.`,
          answer: m,
          traps: trapsFor(m, [
            trap(-m, `P(${k}) must equal 0, so m is the opposite of what the other terms add up to at x = ${k}.`, 3),
            trap(-(-k * k * k + b * k * k - c * k), `Substitute x = ${k}, with its sign, into every term.`, 1),
            trap(-(k * k * k + b * k * k), "The x term contributes too when x is substituted.", 2),
          ]),
          explanation: steps.join(" → "),
        };
      }
      // Fully factored form, given one factor.
      const roots = threeRoots();
      const high = fromRoots(roots);
      const given = pick(roots);
      const answer = factored(roots);
      const rest = roots.filter((r) => r !== given);
      const steps = [
        `divide by ${divisor(given)} with ${given} in the box: bottom row ${synth(high, given).join(", ")}`,
        `the quotient is ${polyText(fromRoots(rest))}`,
        `factor the quotient: (${divisor(rest[0])})(${divisor(rest[1])})`,
        `P(x) = ${answer}`,
      ];
      return mcCard(
        `(${divisor(given)}) is a factor of P(x) = ${polyText(high)}. Write P(x) in fully factored form.`,
        `Divide P(x) by (${divisor(given)}) with synthetic division, then factor the quadratic quotient into two linear factors.`,
        answer,
        [
          { value: factored(roots.map((r) => -r)), why: "A zero r gives the factor x − r: the sign inside each factor is the opposite of the zero.", step: 3 },
          { value: factored(roots.map((r) => (r === given ? r : -r))), why: `The quotient's factors follow the same rule as the given one: a zero r gives the factor x − r.`, step: 2 },
          { value: factored(roots.map((r, idx) => (idx === roots.indexOf(given) || idx === 0 ? r : -r))), why: "Check the sign inside each factor by multiplying the constants: they must give the constant term of P(x).", step: 2 },
          { value: factored(roots.map((r, idx) => (idx === roots.indexOf(given) || idx === 2 ? r : -r))), why: "Check the sign inside each factor by multiplying the constants: they must give the constant term of P(x).", step: 2 },
        ],
        steps.join(" → ")
      );
    }),
};
