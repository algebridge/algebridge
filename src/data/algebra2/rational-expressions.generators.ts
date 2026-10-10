import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, PROBLEM_NAMES, fillToCount, lin, mcChoices, plusTerm, quad, randInt, trapsFor } from "@/lib/problem-utils";

const trap = (value: string | number, why: string): Trap => ({ value, why });
const pick = <T>(items: readonly T[]): T => items[randInt(0, items.length - 1)];
/** A nonzero integer in [-n, n]. */
const nz = (n: number) => {
  const v = randInt(1, n);
  return randInt(0, 1) ? v : -v;
};
/** A nonzero integer in [-n, n] that is none of the given values (or their negatives when `noNeg`). */
function nzNot(n: number, avoid: number[], noNeg = false): number {
  for (let k = 0; k < 40; k += 1) {
    const v = nz(n);
    if (avoid.includes(v)) continue;
    if (noNeg && avoid.includes(-v)) continue;
    return v;
  }
  return n + 1;
}
/** "(x + 3)" style factor. */
const f = (k: number) => `(${lin(1, k)})`;
/** A fraction of two factors: "(x + 3)/(x − 2)". */
const over = (top: string, bottom: string) => `${top}/${bottom}`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "simplify-rational": (seeds) =>
    fillToCount("simplify-rational", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // Excluded values, difference of squares on the bottom.
        const n = randInt(1, 9);
        const a = nzNot(9, [n, -n]);
        const answer = `x = ${-n} and x = ${n}`;
        const wrong = [`x = ${n}`, `x = ${-a}`, `x = ${-a}, x = ${-n} and x = ${n}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which values of x are excluded from the domain of ${f(a)}/(${quad(1, 0, -n * n)})?`,
          hint: `A fraction is undefined when its bottom is 0. Factor x² − ${n * n} as a difference of squares and set each factor to 0.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `x² − ${n * n} = (x − ${n})(x + ${n}) has two factors, and each one can be 0.`),
            trap(wrong[1], `x = ${-a} makes the top 0, which is allowed: the fraction is just 0 there. Look at the bottom.`),
            trap(wrong[2], "Only values that make the bottom 0 are excluded. The top being 0 is fine."),
          ]),
          explanation: `x² − ${n * n} = (x − ${n})(x + ${n}) = 0 when x = ${n} or x = ${-n}, so those are excluded.`,
        };
      }
      if (kind === 1) {
        // Excluded values, a factorable trinomial on the bottom.
        const r1 = nz(7);
        const r2 = nzNot(7, [r1, -r1]);
        const [lo, hi] = r1 < r2 ? [r1, r2] : [r2, r1];
        const a = nzNot(9, [lo, hi]);
        const b = -(lo + hi);
        const c = lo * hi;
        const answer = `x = ${lo} and x = ${hi}`;
        const wrong = [`x = ${-lo} and x = ${-hi}`, `x = ${-a}`, `x = ${lo}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which values of x are excluded from the domain of ${f(a)}/(${quad(1, b, c)})?`,
          hint: `Factor the bottom: find two numbers that multiply to ${c} and add to ${b}. Each factor set to 0 gives an excluded value.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `${quad(1, b, c)} = ${f(-lo)}${f(-hi)}: each factor is 0 at the opposite of the number in it.`),
            trap(wrong[1], `x = ${-a} makes the top 0, which is allowed. Only the bottom matters.`),
            trap(wrong[2], "The bottom has two factors, so two values make it 0."),
          ]),
          explanation: `${quad(1, b, c)} = ${f(-lo)}${f(-hi)} = 0 when x = ${lo} or x = ${hi}.`,
        };
      }
      if (kind === 2) {
        // Simplify a trinomial over a linear factor.
        const r = nz(8);
        const s = nzNot(8, [r]);
        const b = r + s;
        const c = r * s;
        const answer = lin(1, s);
        const wrong = [lin(1, -s), lin(1, b), lin(1, r)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify (${quad(1, b, c)})/${f(r)}.`,
          hint: `Factor the top: two numbers that multiply to ${c} and add to ${b}. One factor is ${f(r)}; cancel it.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The top factors as ${f(r)}${f(s)}. Check the sign of the factor that remains.`),
            trap(wrong[1], "You cannot cancel x² against x. Factor the top first, then cancel a whole factor."),
            trap(wrong[2], `${f(r)} is the factor that cancels with the bottom. The other factor remains.`),
          ]),
          explanation: `(${quad(1, b, c)})/${f(r)} = ${f(r)}${f(s)}/${f(r)} = ${answer}`,
        };
      }
      if (kind === 3) {
        // Difference of squares over a trinomial.
        const n = randInt(1, 7);
        const fac = randInt(0, 1) ? n : -n; // the shared factor is (x − fac)
        const g = nzNot(8, [n, -n]);
        const top = quad(1, 0, -n * n);
        const bottom = quad(1, -(fac + g), fac * g);
        const answer = over(f(fac), f(-g));
        const wrong = [over(f(-fac), f(-g)), over(f(fac), f(g)), over(f(-fac), f(g))];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify (${top})/(${bottom}).`,
          hint: `Top: x² − ${n * n} = (x − ${n})(x + ${n}). Bottom: two numbers that multiply to ${fac * g} and add to ${-(fac + g)}. Cancel the factor they share.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `${f(-fac)} is the factor that cancels. The top keeps its other factor.`),
            trap(wrong[1], `The bottom factors as ${f(-fac)}${f(-g)}; check the sign of the factor that stays.`),
            trap(wrong[2], "Both the factor kept on top and the one kept on the bottom have the wrong sign."),
          ]),
          explanation: `(${top})/(${bottom}) = (x − ${n})(x + ${n})/(${f(-fac)}${f(-g)}) = ${answer}`,
        };
      }
      if (kind === 4) {
        // Simplify, then evaluate.
        const r = nz(8);
        const s = nzNot(8, [r]);
        const b = r + s;
        const c = r * s;
        let v = randInt(-9, 9);
        if (v === -r) v += 1;
        const want = v + s;
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify (${quad(1, b, c)})/${f(r)}, then find its value when x = ${v}.`,
          hint: `The top factors as ${f(r)}${f(s)}. Cancel ${f(r)}, then put x = ${v} into what is left.`,
          answer: want,
          traps: trapsFor(want, [
            trap(v - s, `After canceling, the expression is ${lin(1, s)}. Check the sign when you substitute.`),
            trap(v * v + b * v + c, `That is the top alone. Divide by the bottom, ${v}${plusTerm(r)} = ${v + r}, as well.`),
            trap(v + r, `${f(r)} is the factor that cancels. Substitute into the factor that remains.`),
          ]),
          explanation: `(${quad(1, b, c)})/${f(r)} = ${lin(1, s)}, and at x = ${v} that is ${v}${plusTerm(s)} = ${want}`,
        };
      }
      // Error analysis: simplifying by canceling.
      const r = nz(7);
      const s = nzNot(7, [r]);
      const b = r + s;
      const c = r * s;
      const s2 = nzNot(9, [s, r]);
      const head = `(${quad(1, b, c)})/${f(r)} =`;
      const slip = pick([
        { at: 0, steps: [`${head} ${f(r)}${f(s2)}/${f(r)}`, `= ${lin(1, s2)}`], why: `${f(r)}${f(s2)} multiplies out to ${quad(1, r + s2, r * s2)}, not ${quad(1, b, c)}.` },
        { at: 1, steps: [`${head} ${f(r)}${f(s)}/${f(r)}`, `= ${lin(1, -s)}`], why: `After canceling ${f(r)}, the factor left is ${f(s)} exactly as written; its sign does not flip.` },
        { at: 1, steps: [`${head} ${f(r)}${f(s)}/${f(r)}`, `= ${lin(1, r)}`], why: `${f(r)} is the factor that cancels with the bottom. What remains is the other factor.` },
      ]);
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this simplification of (${quad(1, b, c)})/${f(r)}.`,
        hint: "Multiply the factors back out to check the factoring, then check which factor should remain after canceling.",
        wrongStepIndex: slip.at,
        steps: slip.steps,
        explanation: `${slip.why} Correct: ${head} ${f(r)}${f(s)}/${f(r)} = ${lin(1, s)}.`,
      };
    }),

  "multiply-divide-rational": (seeds) =>
    fillToCount("multiply-divide-rational", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // A product with one factor canceling.
        const a = nz(8);
        const b = nzNot(8, [a]);
        const c = nzNot(8, [a, b]);
        const shape = randInt(0, 1);
        // Shape 0: (a/b) × (b/c) → a/c. Shape 1: (a/b) × (c/a) → c/b.
        const expr = shape === 0 ? `${over(f(a), f(b))} × ${over(f(b), f(c))}` : `${over(f(a), f(b))} × ${over(f(c), f(a))}`;
        const answer = shape === 0 ? over(f(a), f(c)) : over(f(c), f(b));
        const cancel = shape === 0 ? f(b) : f(a);
        const wrong = shape === 0 ? [over(f(c), f(a)), over(f(a), f(b)), over(f(b), f(c))] : [over(f(b), f(c)), over(f(a), f(b)), over(f(c), f(a))];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Multiply and simplify: ${expr}`,
          hint: `Tops multiply together and bottoms multiply together. ${cancel} appears on a top and on a bottom, so it cancels.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Multiplying keeps tops on top and bottoms on the bottom; nothing flips."),
            trap(wrong[1], `${cancel} appears once on a top and once on a bottom, so it cancels out.`),
            trap(wrong[2], `${cancel} cancels. What stays is the factor that did not match.`),
          ]),
          explanation: `${expr}: cancel ${cancel} to get ${answer}.`,
        };
      }
      if (kind === 1) {
        // A quotient: flip, then cancel.
        const a = nz(8);
        const b = nzNot(8, [a]);
        const c = nzNot(8, [a, b]);
        const shape = randInt(0, 1);
        // Shape 0: (a/b) ÷ (a/c) → c/b. Shape 1: (a/b) ÷ (c/b) → a/c.
        const expr = shape === 0 ? `${over(f(a), f(b))} ÷ ${over(f(a), f(c))}` : `${over(f(a), f(b))} ÷ ${over(f(c), f(b))}`;
        const answer = shape === 0 ? over(f(c), f(b)) : over(f(a), f(c));
        const flipped = shape === 0 ? over(f(c), f(a)) : over(f(b), f(c));
        const wrong = shape === 0 ? [over(f(b), f(c)), over(f(a), f(b)), over(f(c), f(a))] : [over(f(c), f(a)), over(f(a), f(b)), over(f(b), f(c))];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Divide and simplify: ${expr}`,
          hint: `Dividing by a fraction is multiplying by its flip: multiply by ${flipped}, then cancel the factor that matches.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "That is the flip of the answer. Flip only the second fraction, then multiply."),
            trap(wrong[1], "The first fraction changes once you multiply by the flip of the second; something cancels."),
            trap(wrong[2], `Flip the second fraction to ${flipped} before multiplying.`),
          ]),
          explanation: `${expr} = ${over(f(a), f(b))} × ${flipped} = ${answer}`,
        };
      }
      if (kind === 2) {
        // A product that needs factoring first.
        const n = randInt(1, 7);
        const a = nzNot(8, [n, -n]);
        const keep = randInt(0, 1) ? n : -n; // the answer is x + keep
        const top = quad(1, 0, -n * n);
        const expr = `(${top})/${f(a)} × ${f(a)}/${f(-keep)}`;
        const answer = lin(1, keep);
        const wrong = [lin(1, -keep), lin(1, a), lin(1, -a)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Multiply and simplify: ${expr}`,
          hint: `Factor x² − ${n * n} as (x − ${n})(x + ${n}). Then cancel ${f(a)} and ${f(-keep)}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `${f(-keep)} is the factor that cancels with the bottom. The other factor of x² − ${n * n} stays.`),
            trap(wrong[1], `${f(a)} appears on a top and a bottom, so it cancels out.`),
            trap(wrong[2], `${f(a)} cancels, and nothing changes its sign.`),
          ]),
          explanation: `${expr} = (x − ${n})(x + ${n})${f(a)} over ${f(a)}${f(-keep)} = ${answer}`,
        };
      }
      if (kind === 3) {
        // Monomial fractions, then a value.
        const k = randInt(2, 6);
        const q = randInt(2, 5);
        const s = randInt(2, 4);
        const p = k * s;
        const rr = q;
        const v = nz(9);
        const want = k * v;
        const expr = `(${p}x²/${q}) × (${rr}/(${s}x))`;
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify ${expr}, then find its value when x = ${v}.`,
          hint: `Multiply across: ${p * rr}x² over ${q * s}x. Cancel the numbers and one x, then substitute x = ${v}.`,
          answer: want,
          traps: trapsFor(want, [
            trap(k, `${k}x is the simplified expression. The question asks for its value at x = ${v}.`),
            trap(k * v * v, "One x on top cancels with the x on the bottom, so only one x is left."),
            trap(-k * v, "Check the sign of x when you substitute."),
            trap((p * rr * v * v) / (q * s * v) + (q * s), "Simplify the coefficient by dividing: " + p * rr + " ÷ " + q * s + "."),
          ]),
          explanation: `${expr} = ${p * rr}x²/(${q * s}x) = ${k}x, and ${k} × (${v}) = ${want}`,
        };
      }
      // A product with canceling, then a value (a fraction answer).
      const a = nz(8);
      const b = nzNot(8, [a]);
      const c = nzNot(8, [a, b]);
      const v = nzNot(9, [-b, -c, -a]);
      const expr = `${over(f(a), f(b))} × ${over(f(b), f(c))}`;
      const want = (v + a) / (v + c);
      return {
        id: "",
        type: "numeric",
        prompt: `Simplify ${expr}, then find its value when x = ${v}. (write as a fraction or decimal)`,
        hint: `${f(b)} cancels, leaving ${over(f(a), f(c))}. Put x = ${v} into the top and the bottom.`,
        answer: want,
        traps: trapsFor(want, [
          trap((v + c) / (v + a), "That is the simplified fraction upside down."),
          trap((v + a) / (v + b), `${f(b)} cancels; the bottom that stays is ${f(c)}.`),
          trap(v + a - (v + c), "The simplified expression is a fraction: divide the top by the bottom."),
        ]),
        explanation: `${expr} = ${over(f(a), f(c))}, and at x = ${v} that is ${v + a}/${v + c}`,
      };
    }),

  "rational-equations": (seeds) =>
    fillToCount("rational-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // a/x + b = c.
        const x = nz(12);
        const k = nz(5);
        const a = x * k;
        const b = randInt(-9, 9);
        const c = b + k;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${a}/x${plusTerm(b)} = ${c}.`,
          hint: `Get the fraction alone: ${a}/x = ${k}. Then multiply both sides by x and divide.`,
          answer: x,
          traps: trapsFor(x, [
            trap(a * k, `${a}/x = ${k} means ${a} ÷ x = ${k}. Divide ${a} by ${k}; do not multiply.`),
            trap(a / c, `Move the ${b} across first: the fraction equals ${c} − (${b}), not ${c}.`),
            trap(k / a, `That is ${k}/${a}, upside down. x = ${a} ÷ ${k}.`),
            trap(a / (c + b), `Subtract ${b} from both sides, do not add it.`),
          ]),
          explanation: `${a}/x${plusTerm(b)} = ${c} → ${a}/x = ${k} → ${a} = ${k}x → x = ${x}`,
        };
      }
      if (kind === 1) {
        // A proportion.
        const d = randInt(2, 6);
        const kk = randInt(1, 4);
        const b = d * kk;
        let c = randInt(1, 9);
        while (gcd(c, d) !== 1) c += 1;
        const a = nz(9);
        const x = kk * c - a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve (x${plusTerm(a)})/${b} = ${c}/${d}.`,
          hint: `Cross-multiply: ${d}(x${plusTerm(a)}) = ${b} × ${c}. Divide by ${d}, then move the ${a} across.`,
          answer: x,
          traps: trapsFor(x, [
            trap(kk * c + a, `After x${plusTerm(a)} = ${kk * c}, undo the ${a} by doing the opposite.`),
            trap(b * c - a, `${b} × ${c} is ${b * c}, but it must still be divided by ${d}.`),
            trap(c / d - a, `Multiply by ${b} first: the whole fraction (x${plusTerm(a)})/${b} equals ${c}/${d}.`),
          ]),
          explanation: `(x${plusTerm(a)})/${b} = ${c}/${d} → x${plusTerm(a)} = ${b} × ${c} ÷ ${d} = ${kk * c} → x = ${x}`,
        };
      }
      if (kind === 2) {
        // Which solution is extraneous?
        const r = nz(6);
        const s = nzNot(8, [r, -r]);
        const d = randInt(1, 9);
        const b = -(r + s);
        const c = r * s + d;
        const den = f(-r);
        const answer = `x = ${r}`;
        const wrong = [`x = ${s}`, `x = ${-r}`, `x = ${-s}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve (${quad(1, b, c)})/${den} = ${d}/${den}. Which solution of the cleared equation must be rejected as extraneous?`,
          hint: `Multiply both sides by ${den}: ${quad(1, b, c)} = ${d}, so ${quad(1, b, r * s)} = 0. Then check each root against the bottom ${den}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `x = ${s} keeps the bottom ${den} away from 0, so it is a true solution.`),
            trap(wrong[1], `x = ${-r} does not even solve the cleared equation; find the root that makes ${den} zero.`),
            trap(wrong[2], `x = ${-s} is not a root of ${quad(1, b, r * s)} = 0.`),
          ]),
          explanation: `${quad(1, b, r * s)} = 0 → (x${plusTerm(-r)})(x${plusTerm(-s)}) = 0 → x = ${r} or x = ${s}. x = ${r} makes ${den} zero, so it is extraneous.`,
        };
      }
      if (kind === 3) {
        // Working together.
        const n1 = pick(PROBLEM_NAMES);
        let n2 = pick(PROBLEM_NAMES);
        if (n2 === n1) n2 = PROBLEM_NAMES[(PROBLEM_NAMES.indexOf(n1) + 1) % PROBLEM_NAMES.length];
        const job = pick(["paint a room", "mow a lawn", "wash the windows", "rake the yard", "clean the garage", "tile a floor"]);
        const a = randInt(2, 9);
        let b = randInt(2, 12);
        if (b === a) b += 1;
        const exact = (a * b) / (a + b);
        const want = Math.round(exact * 10 + 1e-9) / 10;
        return {
          id: "",
          type: "numeric",
          prompt: `${n1} can ${job} in ${a} hours and ${n2} can do it in ${b} hours. Working together, how many hours do they need? (round to the nearest tenth)`,
          hint: `In one hour ${n1} does 1/${a} of the job and ${n2} does 1/${b}. Add those for the share done per hour; the time is 1 over that.`,
          answer: want,
          decimalPlaces: 1,
          traps: trapsFor(want, [
            trap(Math.round(((a + b) / 2) * 10) / 10, "Averaging the two times ignores that both work at once; together they are faster than either alone."),
            trap(a + b, "Working together takes less time than either person alone, not more."),
            trap(Math.round(((a + b) / (a * b)) * 10) / 10, `1/${a} + 1/${b} is the share of the job per hour. The time is 1 divided by that.`),
          ]),
          explanation: `1/${a} + 1/${b} = ${a + b}/${a * b} of the job per hour → time = ${a * b}/${a + b} ≈ ${want} hours`,
        };
      }
      // a/(x + p) = b/(x + q).
      let a = 2;
      let b = 1;
      let p = 1;
      let q = 4;
      let x = -7;
      for (let t = 0; t < 60; t += 1) {
        const bb = randInt(1, 6);
        const dlt = pick([1, -1, 2, -2]);
        const aa = bb + dlt;
        if (aa < 1) continue;
        const pp = nz(8);
        const qq = dlt % 2 === 0 ? pp + 2 * nz(3) : nzNot(8, [pp]);
        if (qq === 0) continue;
        const num = bb * pp - aa * qq;
        if (num % (aa - bb) !== 0) continue;
        const xx = num / (aa - bb);
        if (xx + pp === 0 || xx + qq === 0 || Math.abs(xx) > 40) continue;
        [a, b, p, q, x] = [aa, bb, pp, qq, xx];
        break;
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve ${a}/${f(p)} = ${b}/${f(q)}.`,
        hint: `Cross-multiply: ${a}${f(q)} = ${b}${f(p)}. Expand both sides, collect the x terms, and solve.`,
        answer: x,
        traps: trapsFor(x, [
          trap(-x, "Check the signs when you move the x terms to one side."),
          trap((b * q - a * p) / (a - b), `Cross-multiplying pairs ${a} with ${f(q)} and ${b} with ${f(p)}.`),
          trap(p - q, "Expand both sides before collecting terms; the constants multiply too."),
        ]),
        explanation: `${a}${f(q)} = ${b}${f(p)} → ${a}x${plusTerm(a * q)} = ${b}x${plusTerm(b * p)} → ${a - b}x = ${b * p - a * q} → x = ${x}`,
      };
    }),
};
