import type { PracticeProblem, Trap } from "@/types";
import { fillToCount, frac, mcChoices, PROBLEMS_PER_SKILL, randInt, trapsFor } from "@/lib/problem-utils";

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}
function trap(value: number | string, why: string, step?: number): Trap {
  return step === undefined ? { value, why } : { value, why, step };
}
/** The root sign for an index: 2 → √, 3 → ∛, 4 → ⁴√, 5 → ⁵√. */
function rootSym(q: number): string {
  return q === 2 ? "√" : q === 3 ? "∛" : `${"⁰¹²³⁴⁵⁶⁷⁸⁹"[q]}√`;
}
/** A number with a true minus sign: -3 → "−3". */
function sn(v: number): string {
  return v < 0 ? `−${-v}` : String(v);
}
/** "x + 5" or "x − 5", the way a textbook writes it. */
function xPlus(a: number): string {
  return a < 0 ? `x − ${-a}` : `x + ${a}`;
}
/** x^(n/d) reduced: x^(2/3), x^4. */
function xPow(n: number, d: number): string {
  const f = frac(n, d);
  return f.includes("/") ? `x^(${f})` : `x^${f}`;
}

// Non-cubes that keep ∛(k³·m) in lowest terms.
const CUBE_FREE = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

// Every (base, power, root) whose value is a whole number, for b^(p/q).
const RATIONAL_POWERS: { b: number; p: number; q: number; r: number }[] = [];
for (const [r, q] of [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [10, 2], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [2, 5]]) {
  for (const p of [2, 3, 5]) {
    if (p === q || (p === 2 && q % 2 === 0)) continue;
    const v = r ** p;
    if (v <= 1000) RATIONAL_POWERS.push({ b: r ** q, p, q, r });
  }
}

// √(x + a) = x + c, where squaring makes two roots and only one checks.
const EXTRANEOUS: { a: number; c: number; good: number; bad: number }[] = [];
for (let c = -6; c <= 6; c += 1) {
  for (let good = -8; good <= 12; good += 1) {
    const bad = 1 - 2 * c - good;
    if (bad >= good) continue;
    const a = c * c - good * bad;
    if (a === 0 || c === 0 || Math.abs(a) > 20) continue;
    if (good + c < 0 || good + a < 0 || bad + c >= 0 || bad + a < 0) continue;
    EXTRANEOUS.push({ a, c, good, bad });
  }
}

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "nth-roots": (seeds) =>
    fillToCount("nth-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // A perfect power under a cube or fourth root, sometimes negative.
        const fourth = randInt(0, 2) === 0;
        const k = fourth ? randInt(2, 6) : randInt(2, 10);
        const neg = !fourth && randInt(0, 2) === 0;
        const n = (neg ? -1 : 1) * k ** (fourth ? 4 : 3);
        const sym = fourth ? "⁴√" : "∛";
        const want = neg ? -k : k;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${sym}${neg ? `(${n})` : n}.`,
          hint: fourth ? "Which whole number, multiplied by itself four times, gives this?" : neg ? "A negative number has a negative cube root: (−2)³ = −8." : "Which whole number, multiplied by itself three times, gives this?",
          answer: want,
          traps: trapsFor(want, [
            trap(fourth ? n / 4 : n / 3, `A root is not division by ${fourth ? 4 : 3}. Look for ${fourth ? "four" : "three"} equal factors.`, 0),
            trap(fourth ? k * k : k * k, fourth ? `${k * k} × ${k * k} is only two factors. A fourth root asks for four equal factors.` : `${k} × ${k} is only two factors. A cube root asks for three equal factors.`, 1),
            neg ? trap(k, "The cube of a negative number is negative, so the cube root of a negative number is negative too.", 1) : null,
          ]),
          explanation: [
            `${sym}${neg ? `(${sn(n)})` : n} asks for the number used as a factor ${fourth ? "four" : "three"} times to make ${sn(n)}`,
            `${Array(fourth ? 4 : 3).fill(neg ? `(${sn(want)})` : want).join(" × ")} = ${sn(n)}`,
            `so ${sym}${neg ? `(${sn(n)})` : n} = ${sn(want)}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // Pull the perfect cube out.
        const k = randInt(2, 5);
        const m = pick(CUBE_FREE.filter((v) => v !== k));
        const n = k ** 3 * m;
        const answer = `${k}∛${m}`;
        const wrong = [`${m}∛${k}`, `${k * k}∛${m}`, `${k}√${m}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify ∛${n}.`,
          hint: `Find the biggest perfect cube that divides ${n}: ${n} = ${k ** 3} × ${m}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "The cube root of the perfect cube goes in front. The leftover factor stays inside the radical.", 3),
            trap(wrong[1], `∛${k ** 3} is ${k}, since ${k} × ${k} × ${k} = ${k ** 3}. Only the cube root comes out.`, 2),
            trap(wrong[2], "The index stays 3. A cube root does not turn into a square root.", 3),
          ]),
          explanation: [
            `find the biggest perfect cube factor: ${n} = ${k ** 3} × ${m}`,
            `split the root: ∛${n} = ∛${k ** 3} × ∛${m}`,
            `∛${k ** 3} = ${k}, since ${k} × ${k} × ${k} = ${k ** 3}`,
            `∛${n} = ${answer}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Like radicals, three terms.
        const m = pick(CUBE_FREE);
        const a = randInt(2, 7);
        const b = randInt(2, 7);
        // From 2, so no term prints a coefficient of 1 ("1∛6").
        const c = randInt(2, a + b - 2);
        const s = a + b - c;
        const answer = `${s}∛${m}`;
        const wrong = [`${s}∛${3 * m}`, `${a * b - c}∛${m}`, `${a + b + c}∛${m}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify ${a}∛${m} + ${b}∛${m} − ${c}∛${m}.`,
          hint: "All three terms have the same index and the same radicand, so combine the coefficients and keep ∛" + m + ".",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "The radicand does not change when like radicals are combined. Only the coefficients add and subtract.", 2),
            trap(wrong[1], "Like radicals combine by adding their coefficients, not multiplying them.", 1),
            trap(wrong[2], `The last term is subtracted: ${a} + ${b} − ${c}.`, 1),
          ]),
          explanation: [
            `all three terms have index 3 and radicand ${m}, so they are like radicals`,
            `combine the coefficients: ${a} + ${b} − ${c} = ${s}`,
            `keep ∛${m}: ${answer}`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // Which two whole numbers is a cube root between?
        const k = randInt(2, 9);
        const n = randInt(k ** 3 + 1, (k + 1) ** 3 - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `∛${n} lies between two consecutive whole numbers. What is the smaller one?`,
          hint: "List the perfect cubes: 8, 27, 64, 125, ... Which two is " + n + " between?",
          answer: k,
          traps: trapsFor(k, [
            trap(k + 1, `${(k + 1) ** 3} is bigger than ${n}, so that is the larger of the two whole numbers.`, 3),
            trap(Math.floor(Math.sqrt(n)), "That compares with perfect squares. A cube root sits between perfect cubes.", 0),
            trap(Math.floor(n / 3), "A cube root is not division by 3.", 0),
          ]),
          explanation: [
            `list perfect cubes: ${k}³ = ${k ** 3}`,
            `${k + 1}³ = ${(k + 1) ** 3}`,
            `${k ** 3} < ${n} < ${(k + 1) ** 3}, so ∛${n} is between ${k} and ${k + 1}`,
            `the smaller one is ${k}`,
          ].join(" → "),
        };
      }
      // Error analysis: simplifying a cube root.
      const k = randInt(2, 5);
      const m = pick(CUBE_FREE);
      const n = k ** 3 * m;
      const slip = randInt(0, 2);
      const steps =
        slip === 0
          ? [`∛${n} = ∛(${k ** 3} × ${m})`, `= ∛${k ** 3} + ∛${m}`, `= ${k} + ∛${m}`]
          : slip === 1
            ? [`∛${n} = ∛(${k ** 3} × ${m})`, `= ∛${k ** 3} × ∛${m}`, `= ${k * k}∛${m}`]
            : [`∛${n} = ∛(${k ** 3} × ${m})`, `= ∛${k ** 3} × ∛${m}`, `= ${k}√${m}`];
      const why =
        slip === 0
          ? "A root of a product is the product of the roots, not a sum: ∛(ab) = ∛a × ∛b."
          : slip === 1
            ? `∛${k ** 3} = ${k}, because ${k} × ${k} × ${k} = ${k ** 3}.`
            : "The index stays 3 all the way through: the leftover factor is under a cube root, not a square root.";
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this simplification of ∛${n}.`,
        hint: "Check each step: does the product rule apply, is the cube root of the perfect cube right, and does the index stay 3?",
        wrongStepIndex: slip === 0 ? 1 : 2,
        steps,
        explanation: `${why} The right simplification is ∛${n} = ${k}∛${m}.`,
      };
    }),

  "rational-exponents-evaluate": (seeds) =>
    fillToCount("rational-exponents-evaluate", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // b^(p/q): root first, then power.
        const { b, p, q, r } = pick(RATIONAL_POWERS);
        const want = r ** p;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${b}^(${p}/${q}).`,
          hint: `The ${q} on the bottom is a root: ${rootSym(q)}${b} = ${r}. Then raise that to the ${p}${p === 2 ? "nd" : p === 3 ? "rd" : "th"} power.`,
          answer: want,
          traps: trapsFor(want, [
            trap(Math.round(((b * p) / q) * 10000) / 10000, `An exponent of ${p}/${q} is a root and a power, not multiplying by ${p}/${q}.`, 0),
            trap(r * p, `The ${p} is a power, not a multiplier: raise ${r} to the ${p}${p === 2 ? "nd" : p === 3 ? "rd" : "th"} power.`, 2),
            trap(Math.round((b ** p / q) * 10000) / 10000, `The ${q} in the denominator means a ${rootSym(q)} root, not division by ${q}.`, 0),
          ]),
          explanation: [
            `the bottom ${q} is a root and the top ${p} is a power: ${b}^(${p}/${q}) = (${rootSym(q)}${b})^${p}`,
            `${rootSym(q)}${b} = ${r}`,
            `${r}^${p} = ${Array(p).fill(r).join(" × ")} = ${want}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // A negative rational exponent: a fraction.
        const { b, p, q, r } = pick(RATIONAL_POWERS);
        const v = r ** p;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${b}^(−${p}/${q}). (write as a fraction or decimal)`,
          hint: `A negative exponent means a reciprocal: ${b}^(−${p}/${q}) = 1 / ${b}^(${p}/${q}). Work out ${b}^(${p}/${q}) first.`,
          answer: 1 / v,
          traps: trapsFor(1 / v, [
            trap(-v, "A negative exponent does not make the answer negative. It flips the base into a reciprocal.", 0),
            trap(v, "The minus sign in the exponent was dropped. A negative exponent means 1 over the power.", 0),
            trap(-1 / v, "The negative exponent is used up by taking the reciprocal; the result stays positive.", 0),
          ]),
          explanation: [
            `a negative exponent means a reciprocal: ${b}^(−${p}/${q}) = 1 / ${b}^(${p}/${q})`,
            `${rootSym(q)}${b} = ${r}`,
            `${r}^${p} = ${v}`,
            `1 / ${v} = ${frac(1, v)}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Radical to rational exponent.
        const q = randInt(2, 5);
        const p = pick([2, 3, 5, 7].filter((x) => x !== q && (x !== 2 || q % 2 !== 0)));
        const answer = `x^(${p}/${q})`;
        const wrong = [`x^(${q}/${p})`, `x^${p * q}`, `x^${p + q}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${rootSym(q)}(x^${p}) using a rational exponent.`,
          hint: "The index of the root goes on the bottom of the exponent and the power goes on top.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "The root index is the denominator and the power is the numerator, not the other way round.", 0),
            trap(wrong[1], "A root divides the exponent; it does not multiply it.", 1),
            trap(wrong[2], "A root divides the exponent; it does not add to it.", 1),
          ]),
          explanation: [
            `a ${rootSym(q)} root is a power of 1/${q}: ${rootSym(q)}(x^${p}) = (x^${p})^(1/${q})`,
            `a power of a power multiplies the exponents: ${p} × 1/${q} = ${p}/${q}`,
            `${rootSym(q)}(x^${p}) = ${answer}`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // Rational exponent to radical.
        const q = randInt(2, 5);
        const p = pick([2, 3, 5, 7].filter((x) => x !== q && (x !== 2 || q % 2 !== 0)));
        const answer = `${rootSym(q)}(x^${p})`;
        const wrong = [`${rootSym(p)}(x^${q})`, `${p}${rootSym(q)}x`, `x^${p}${rootSym(q)}x`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write x^(${p}/${q}) as a radical.`,
          hint: "The denominator of the exponent is the index of the root; the numerator is the power under it.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "The denominator of the exponent is the root index, and the numerator is the power.", 0),
            trap(wrong[1], `The ${p} is a power on x, not a coefficient in front.`, 0),
            trap(wrong[2], `x^(${p}/${q}) is one power of x: a ${rootSym(q)} root of x^${p}, nothing multiplied on.`, 1),
          ]),
          explanation: [
            `the bottom ${q} is the root index and the top ${p} is the power`,
            `x^(${p}/${q}) = (x^${p})^(1/${q})`,
            `a power of 1/${q} is a ${rootSym(q)} root: ${answer}`,
          ].join(" → "),
        };
      }
      // Power of a power, or a product, with rational exponents.
      const product = randInt(0, 1) === 0;
      if (product) {
        const q = pick([2, 3, 4, 5]);
        const a = randInt(1, 2 * q);
        let b = randInt(1, 2 * q);
        while (b === a || a + b === q) b = randInt(1, 2 * q);
        const answer = xPow(a + b, q);
        const slips = [
          trap(xPow(a * b, q * q), "Multiplying powers of the same base adds the exponents; it does not multiply them.", 0),
          trap(xPow(a + b, 2 * q), `Add the numerators and keep the denominator ${q}: fractions with the same denominator add that way.`, 1),
          trap(xPow(a * b, q), "Add the exponents. Multiplying them is the rule for a power of a power.", 0),
          trap(xPow(Math.abs(a - b), q), "Multiplying powers adds the exponents. Subtracting is the rule for dividing.", 0),
        ].filter((t) => t.value !== answer && t.value !== "x^1" && t.value !== "x^0");
        const kept = slips.filter((t, k) => slips.findIndex((o) => o.value === t.value) === k).slice(0, 3);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify x^(${a}/${q}) · x^(${b}/${q}).`,
          hint: "Same base, multiplied: add the exponents. The denominators already match.",
          answer,
          choices: mcChoices(answer, kept.map((t) => String(t.value))),
          traps: trapsFor(answer, kept),
          explanation: [
            `same base multiplied, so add the exponents: x^(${a}/${q} + ${b}/${q})`,
            `same denominator, so add the tops: ${a}/${q} + ${b}/${q} = ${a + b}/${q}`,
            answer === `x^(${a + b}/${q})` ? `x^(${a}/${q}) · x^(${b}/${q}) = ${answer}` : `${a + b}/${q} reduces, so x^(${a}/${q}) · x^(${b}/${q}) = ${answer}`,
          ].join(" → "),
        };
      }
      const q = pick([2, 3, 4]);
      const p = pick([1, 2, 3].filter((x) => x !== q));
      const c = pick([2, 3, 4, 6, 8].filter((x) => (x * p) % q !== 0 || x * p !== q));
      const answer = xPow(p * c, q);
      const wrong = [xPow(p + c * q, q), xPow(p, q * c), xPow(p * c, q * c)];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Simplify (x^(${p}/${q}))^${c}.`,
        hint: `A power of a power multiplies the exponents: ${p}/${q} × ${c}.`,
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, [
          trap(wrong[0], "A power of a power multiplies the exponents; it does not add them.", 0),
          trap(wrong[1], `Multiply the fraction by ${c}: the ${c} goes on the numerator, not the denominator.`, 1),
          trap(wrong[2], `Multiplying ${p}/${q} by ${c} scales only the numerator. That choice left the exponent unchanged.`, 1),
        ]),
        explanation: [
          `a power of a power multiplies the exponents: (x^(${p}/${q}))^${c} = x^(${p}/${q} × ${c})`,
          `${p}/${q} × ${c} = ${p * c}/${q}`,
          `(x^(${p}/${q}))^${c} = ${answer}`,
        ].join(" → "),
      };
    }),

  "radical-equations": (seeds) =>
    fillToCount("radical-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // √(x + a) = b.
        const b = randInt(2, 9);
        const a = pick([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const x = b * b - a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve √(${xPlus(a)}) = ${b}.`,
          hint: `Square both sides: ${xPlus(a)} = ${b}². Then undo the ${a < 0 ? "subtraction" : "addition"}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(b - a, `Square both sides first: the right side becomes ${b}², not ${b}.`, 0),
            trap(b * b + a, a < 0 ? `${-a} is subtracted from x, so add ${-a} to both sides after squaring.` : `${a} is added to x, so subtract ${a} from both sides after squaring.`, 1),
            trap(2 * b - a, `Squaring ${b} gives ${b * b}, not ${2 * b}.`, 0),
          ]),
          explanation: [
            `square both sides: ${xPlus(a)} = ${b}² = ${b * b}`,
            `${a < 0 ? `add ${-a}` : `subtract ${a}`}: x = ${b * b} ${a < 0 ? "+" : "−"} ${Math.abs(a)} = ${sn(x)}`,
            `check: √(${sn(x)} ${a < 0 ? "−" : "+"} ${Math.abs(a)}) = √${b * b} = ${b}, so x = ${sn(x)}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // √(ax + b) + d = c: isolate the radical first.
        const m = randInt(2, 5);
        let x = randInt(-4, 9);
        const r = randInt(2, 8);
        const d = randInt(1, 6);
        const c = r + d;
        if (r * r === m * x) x += 1;
        const b = r * r - m * x;
        const inside = `${m}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve √(${inside}) + ${d} = ${c}.`,
          hint: `Subtract ${d} first so the radical is alone: √(${inside}) = ${r}. Then square both sides.`,
          answer: x,
          traps: trapsFor(x, [
            trap((c * c - b) / m, `Isolate the radical before squaring: subtract ${d} from both sides first.`, 0),
            trap((r - b) / m, `After isolating, square both sides: ${inside} = ${r}², not ${r}.`, 1),
            trap((c * c - d * d - b) / m, `Squaring is not done term by term. Move the ${d} across first, then square the whole side.`, 0),
          ]),
          explanation: [
            `subtract ${d} to get the root alone: √(${inside}) = ${c} − ${d} = ${r}`,
            `square both sides: ${inside} = ${r}² = ${r * r}`,
            `${b < 0 ? `add ${-b}` : `subtract ${b}`}: ${m}x = ${r * r} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${sn(r * r - b)}`,
            `divide by ${m}: x = ${sn(r * r - b)} / ${m} = ${sn(x)}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Error analysis: solving √(x + a) = b (b = 2 is left out: 2b and b² agree there).
        const b = randInt(3, 9);
        const a = pick([-9, -7, -6, -5, -3, -2, 2, 3, 4, 5, 6, 7, 8, 10]);
        const x = b * b - a;
        const slip = randInt(0, 2);
        const steps =
          slip === 0
            ? [`√(${xPlus(a)}) = ${b}`, `${xPlus(a)} = ${b}`, `x = ${b - a}`]
            : slip === 1
              ? [`√(${xPlus(a)}) = ${b}`, `${xPlus(a)} = ${2 * b}`, `x = ${2 * b - a}`]
              : [`√(${xPlus(a)}) = ${b}`, `${xPlus(a)} = ${b * b}`, `x = ${b * b + a}`];
        const why =
          slip === 0
            ? `Squaring both sides squares the ${b} too: the right side should be ${b * b}.`
            : slip === 1
              ? `Squaring ${b} means ${b} × ${b} = ${b * b}, not ${2 * b}.`
              : a < 0
                ? `To undo subtracting ${-a}, add ${-a} to both sides.`
                : `To undo adding ${a}, subtract ${a} from both sides.`;
        return {
          id: "",
          type: "error-analysis",
          prompt: `Find the error in this solution of √(${xPlus(a)}) = ${b}.`,
          hint: "Check the squaring step first, then the last step that isolates x.",
          wrongStepIndex: slip === 2 ? 2 : 1,
          steps,
          explanation: `${why} The solution is x = ${x}.`,
        };
      }
      if (kind === 3) {
        // Two candidates from squaring; one is extraneous.
        const { a, c, good, bad } = pick(EXTRANEOUS);
        const first = randInt(0, 1) === 0;
        const [v1, v2] = first ? [good, bad] : [bad, good];
        return {
          id: "",
          type: "numeric",
          prompt: `Solving √(${xPlus(a)}) = ${xPlus(c)} by squaring gives x = ${v1} or x = ${v2}. Which one checks in the original equation?`,
          hint: "Substitute each value into the original equation. A square root is never negative, so the right side must be 0 or more.",
          answer: good,
          traps: trapsFor(good, [
            trap(bad, `Substitute it: the right side ${xPlus(c)} comes out negative, but a square root is never negative. Squaring created that value.`, 2),
            trap(good + bad, "The question asks which single value satisfies the original equation, not a sum.", 3),
          ]),
          explanation: [
            `try x = ${sn(good)}: left side √(${sn(good)} ${a < 0 ? "−" : "+"} ${Math.abs(a)}) = √${good + a} = ${Math.sqrt(good + a)}`,
            `right side ${sn(good)} ${c < 0 ? "−" : "+"} ${Math.abs(c)} = ${good + c}; both sides match, so it checks`,
            `try x = ${sn(bad)}: right side ${sn(bad)} ${c < 0 ? "−" : "+"} ${Math.abs(c)} = ${sn(bad + c)}, negative, but a square root is never negative, so it fails`,
            `only x = ${sn(good)} checks`,
          ].join(" → "),
        };
      }
      // A cube root equation: cube both sides, negatives allowed.
      const b = pick([-4, -3, -2, -1, 2, 3, 4, 5]);
      const a = pick([-9, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const x = b ** 3 - a;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve ∛(${xPlus(a)}) = ${b < 0 ? `−${-b}` : b}.`,
        hint: `Cube both sides: ${xPlus(a)} = (${b})³. A cube root can equal a negative number.`,
        answer: x,
        traps: trapsFor(x, [
          trap(b * b - a, "Undo a cube root by cubing, not squaring.", 0),
          trap(b ** 3 + a, a < 0 ? `To undo subtracting ${-a}, add ${-a} to both sides.` : `To undo adding ${a}, subtract ${a} from both sides.`, 2),
          trap(b - a, `Cube both sides first: the right side becomes ${b}³.`, 0),
          b < 0 ? trap(-(b ** 3) - a, `(${b})³ is negative: a negative number cubed stays negative.`, 1) : null,
        ]),
        explanation: [
          `cube both sides: ${xPlus(a)} = ${b < 0 ? `(${sn(b)})` : b}³`,
          `${b < 0 ? `(${sn(b)})` : b}³ = ${Array(3).fill(b < 0 ? `(${sn(b)})` : b).join(" × ")} = ${sn(b ** 3)}`,
          `${a < 0 ? `add ${-a}` : `subtract ${a}`}: x = ${sn(b ** 3)} ${a < 0 ? "+" : "−"} ${Math.abs(a)} = ${sn(x)}`,
        ].join(" → "),
      };
    }),
};
