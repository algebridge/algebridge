import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, lin, mcChoices, plusTerm, quad, randInt, trapsFor } from "@/lib/problem-utils";

const trap = (value: string | number, why: string): Trap => ({ value, why });
const pick = <T>(items: readonly T[]): T => items[randInt(0, items.length - 1)];
/** A nonzero integer in [-n, n]. */
const nz = (n: number) => {
  const v = randInt(1, n);
  return randInt(0, 1) ? v : -v;
};

/** y = a(x − h)² + k, every sign right: (1, 3, -2) → "(x − 3)² − 2", (-2, -1, 0) → "-2(x + 1)²". */
function vf(a: number, h: number, k: number): string {
  const lead = a === 1 ? "" : a === -1 ? "-" : String(a);
  return `${lead}(x${plusTerm(-h)})²${plusTerm(k)}`;
}
const pt = (x: number, y: number) => `(${x}, ${y})`;

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "vertex-form": (seeds) =>
    fillToCount("vertex-form", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // Read the vertex off vertex form.
        const a = pick([1, 2, 3, -1, -2, 4, -3]);
        const h = nz(9);
        const k = nz(12);
        const answer = pt(h, k);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the vertex of y = ${vf(a, h, k)}?`,
          hint: "Match it to y = a(x − h)² + k. The vertex is (h, k): the bracket shows x − h, so h is the opposite of the number inside.",
          answer,
          choices: mcChoices(answer, [pt(-h, k), pt(h, -k), pt(-h, -k)]),
          traps: trapsFor(answer, [
            trap(pt(-h, k), `The bracket is x − h. It reads x${plusTerm(-h)}, so h is the opposite of ${-h}.`),
            trap(pt(h, -k), "k sits outside the bracket and keeps its own sign."),
            trap(pt(-h, -k), "Flip only the sign inside the bracket; the constant outside keeps its sign."),
          ]),
          explanation: `y = ${vf(a, h, k)} has h = ${h} and k = ${k}, so the vertex is ${answer}.`,
        };
      }
      if (kind === 1) {
        // The maximum or minimum value.
        const a = pick([1, 2, 3, 5, -1, -2, -3, -4]);
        const h = nz(8);
        const k = nz(15);
        const word = a > 0 ? "smallest" : "largest";
        return {
          id: "",
          type: "numeric",
          prompt: `What is the ${word} value y can take for y = ${vf(a, h, k)}?`,
          hint: `A square is never negative, so ${a > 0 ? "the squared part is at least 0 and y is smallest" : "the squared part times a negative number is at most 0 and y is largest"} when the square is 0, at x = ${h}.`,
          answer: k,
          traps: trapsFor(k, [
            trap(h, `${h} is the x-value of the vertex. The question asks for the y-value there.`),
            trap(-k, "The constant outside the bracket keeps its sign; y equals it at the vertex."),
            trap(a + k, "At the vertex the bracket is 0, so the a in front multiplies 0."),
            trap(a * h * h + k, "The square is (x − h)², which is 0 at the vertex, not h²."),
          ]),
          explanation: `${a > 0 ? "a > 0, so the vertex is the lowest point" : "a < 0, so the vertex is the highest point"}. At x = ${h} the bracket is 0 and y = ${k}.`,
        };
      }
      if (kind === 2) {
        // Complete the square on x² + bx + c.
        const m = nz(6);
        const b = 2 * m;
        const c = randInt(-12, 12);
        const h = -m;
        const k = c - m * m;
        const answer = `y = ${vf(1, h, k)}`;
        const wrong = [`y = ${vf(1, -h, k)}`, `y = ${vf(1, h, c)}`, `y = ${vf(1, h, c + m * m)}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write y = ${quad(1, b, c)} in vertex form.`,
          hint: `Half of ${b} is ${m}, and ${m}² = ${m * m}. Add and subtract ${m * m}: y = (x² ${b > 0 ? "+" : "−"} ${Math.abs(b)}x + ${m * m})${plusTerm(c)} − ${m * m}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `x² ${b > 0 ? "+" : "−"} ${Math.abs(b)}x + ${m * m} factors as (x${plusTerm(m)})². Check the sign inside the bracket.`),
            trap(wrong[1], `You added ${m * m} to complete the square, so you must also subtract ${m * m}.`),
            trap(wrong[2], `The ${m * m} you added inside the bracket has to be taken away again, not added twice.`),
          ]),
          explanation: `y = ${quad(1, b, c)} = (x² ${b > 0 ? "+" : "−"} ${Math.abs(b)}x + ${m * m})${plusTerm(c)} − ${m * m} = ${vf(1, h, k)}`,
        };
      }
      if (kind === 3) {
        // Evaluate from vertex form.
        const a = pick([1, 2, 3, -1, -2, 4]);
        const h = nz(7);
        const k = nz(10);
        let x = randInt(-8, 8);
        if (x === h) x += 1;
        const d = x - h;
        const y = a * d * d + k;
        return {
          id: "",
          type: "numeric",
          prompt: `For y = ${vf(a, h, k)}, what is y when x = ${x}?`,
          hint: `Work the bracket first: x − h = ${x} − (${h}) = ${d}. Square it, multiply by ${a}, then add the constant.`,
          answer: y,
          traps: trapsFor(y, [
            trap(a * (x + h) * (x + h) + k, `The bracket reads x${plusTerm(-h)}: with x = ${x} it is ${d}.`),
            trap(a * d + k, "Square the bracket before multiplying by the number in front."),
            trap((a * d) * (a * d) + k, `Square the bracket first, then multiply by ${a}; do not square the ${a}.`),
            trap(a * d * d - k, "The constant keeps its own sign when you add it on at the end."),
          ]),
          explanation: `y = ${a === 1 ? "" : a === -1 ? "-" : a}(${x}${plusTerm(-h)})²${plusTerm(k)} = ${a === 1 ? "" : a === -1 ? "-" : a + " × "}(${d})²${plusTerm(k)} = ${a * d * d}${plusTerm(k)} = ${y}`,
        };
      }
      // Error analysis: completing the square.
      const m = nz(6);
      const b = 2 * m;
      const c = randInt(-10, 12);
      const h = -m;
      const k = c - m * m;
      const sq = m * m;
      const inside = `x² ${b > 0 ? "+" : "−"} ${Math.abs(b)}x + ${sq}`;
      const right1 = `y = (${inside})${plusTerm(c)} − ${sq}`;
      const right2 = `y = ${vf(1, h, k)}`;
      const slip = pick([
        { at: 1, steps: [`y = (${inside})${plusTerm(c)}`, `y = ${vf(1, h, c)}`], why: `Adding ${sq} inside the bracket changes the function unless the same ${sq} is subtracted outside.` },
        { at: 1, steps: [`y = (${inside})${plusTerm(c)} + ${sq}`, `y = ${vf(1, h, c + sq)}`], why: `The ${sq} added inside the bracket must be subtracted outside, not added again.` },
        { at: 2, steps: [right1, `y = ${vf(1, -h, k)}`], why: `${inside} is (x${plusTerm(m)})²: the sign in the bracket matches the sign of the x-term.` },
      ]);
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this rewriting of y = ${quad(1, b, c)} in vertex form.`,
        hint: "Each line must equal the one before it. Check that what was added is also taken away, and the sign inside the bracket.",
        wrongStepIndex: slip.at,
        steps: [`y = ${quad(1, b, c)}`, ...slip.steps],
        explanation: `${slip.why} Correct: ${right1}, so ${right2}.`,
      };
    }),

  discriminant: (seeds) =>
    fillToCount("discriminant", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // Compute it.
        const a = pick([1, 2, 3, -1, -2, 4, 5]);
        const b = nz(9);
        const c = nz(8);
        const D = b * b - 4 * a * c;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the discriminant of ${quad(a, b, c)} = 0?`,
          hint: `The discriminant is b² − 4ac with a = ${a}, b = ${b}, c = ${c}. Square b first, then subtract 4 × a × c.`,
          answer: D,
          traps: trapsFor(D, [
            trap(-b * b - 4 * a * c, `b² is (${b})², which is positive.`),
            trap(b * b + 4 * a * c, "4ac is subtracted from b², and 4ac carries the signs of a and c."),
            trap(b * b - a * c, "Multiply a × c by 4 before subtracting."),
            trap(b * b - 4 * c, `a is ${a}, not 1: 4ac means 4 × ${a} × ${c}.`),
          ]),
          explanation: `b² − 4ac = (${b})² − 4(${a})(${c}) = ${b * b} − (${4 * a * c}) = ${D}`,
        };
      }
      if (kind === 1) {
        // Number and type of solutions.
        const want = pick(["Two real solutions", "One real solution", "Two complex solutions"] as const);
        const a = pick([1, 1, 2, 3]);
        const b = nz(8);
        let c: number;
        if (want === "One real solution") {
          // b² = 4ac: make b even, a dividing b²/4.
          const m = randInt(1, 4);
          const bb = 2 * m * a;
          c = m * m * a;
          const sign = randInt(0, 1) ? 1 : -1;
          return mk(a, sign * bb, c, want);
        }
        if (want === "Two real solutions") {
          c = -randInt(1, 9);
          if (randInt(0, 1)) c = Math.floor((b * b) / (4 * a)) - randInt(1, 3);
          return mk(a, b, c, want);
        }
        c = Math.floor((b * b) / (4 * a)) + randInt(1, 6);
        return mk(a, b, c, want);
      }
      if (kind === 2) {
        // Find c for exactly one real solution.
        const a = pick([1, 1, 2, 3, 4]);
        const m = randInt(1, 5);
        const b = (randInt(0, 1) ? 1 : -1) * 2 * m * a;
        const c = m * m * a;
        return {
          id: "",
          type: "numeric",
          prompt: `For what value of c does ${quad(a, b, 0)} + c = 0 have exactly one real solution?`,
          hint: "Exactly one real solution means b² − 4ac = 0. Solve that for c.",
          answer: c,
          traps: trapsFor(c, [
            trap(-c, "b² − 4ac = 0 gives 4ac = b², and b² is positive, so c has the same sign as a."),
            trap((b * b) / 4, `Divide b² by 4a, and a is ${a}.`),
            trap((b * b) / (2 * a), "The 4 in 4ac is a 4, not a 2."),
            trap(b * b, "That is b². Set b² equal to 4ac and divide."),
          ]),
          explanation: `b² − 4ac = 0 → (${b})² = 4(${a})c → ${b * b} = ${4 * a}c → c = ${c}`,
        };
      }
      if (kind === 3) {
        // Which quadratic has exactly one real solution?
        const m = nz(6);
        const a = pick([1, 1, 2, 3]);
        const b = 2 * m * a;
        const c = m * m * a;
        const answer = `${quad(a, b, c)} = 0`;
        const wrong = [`${quad(a, b, c + randInt(1, 5))} = 0`, `${quad(a, b, c - randInt(1, 5))} = 0`, `${quad(a, -b, c + randInt(1, 3))} = 0`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: "Which equation has exactly one real solution?",
          hint: "Find b² − 4ac for each one. Exactly one real solution means the discriminant is 0.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Its discriminant is negative, so it has two complex solutions."),
            trap(wrong[1], "Its discriminant is positive, so it has two real solutions."),
            trap(wrong[2], "Its discriminant is negative, so it has two complex solutions."),
          ]),
          explanation: `${quad(a, b, c)}: b² − 4ac = ${b * b} − ${4 * a * c} = 0, so it has exactly one real solution.`,
        };
      }
      // Error analysis: computing the discriminant.
      const a = pick([1, 2, 3, -1, -2]);
      const b = nz(7);
      const c = nz(6);
      const D = b * b - 4 * a * c;
      const p4 = 4 * a * c;
      const line2 = p4 < 0 ? `= ${b * b} + ${-p4}` : `= ${b * b} − ${p4}`;
      const slips = [
        { at: 2, steps: [p4 < 0 ? `= -${b * b} + ${-p4}` : `= -${b * b} − ${p4}`, `= ${-b * b - p4}`], why: `(${b})² is ${b * b}: a squared number is never negative.` },
        { at: 2, steps: [p4 < 0 ? `= ${b * b} − ${-p4}` : `= ${b * b} + ${p4}`, `= ${b * b + p4}`], why: `4ac is 4(${a})(${c}) = ${p4}, and it is subtracted from b².` },
        { at: 3, steps: [line2, `= ${-D}`], why: `${b * b} − (${p4}) is ${D}, not ${-D}: subtract in the order written.` },
      ].filter((s) => s.steps[1] !== `= ${D}`);
      const slip = pick(slips);
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this computation of the discriminant of ${quad(a, b, c)} = 0.`,
        hint: "Check the square of b (a negative squared is positive), the sign of 4ac, and the final subtraction.",
        wrongStepIndex: slip.at,
        steps: [`a = ${a}, b = ${b}, c = ${c}`, `b² − 4ac = (${b})² − 4(${a})(${c})`, ...slip.steps],
        explanation: `${slip.why} Correct: (${b})² − 4(${a})(${c}) ${line2} = ${D}.`,
      };
    }),

  "linear-quadratic-systems": (seeds) =>
    fillToCount("linear-quadratic-systems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // How many shared points?
        const want = randInt(0, 2);
        const B = 2 * nz(4);
        const C = want === 1 ? (B * B) / 4 : want === 2 ? (B * B) / 4 - randInt(1, 6) : (B * B) / 4 + randInt(1, 6);
        const m = nz(5);
        const d = randInt(-9, 9);
        const b = B + m;
        const c = C + d;
        const D = B * B - 4 * C;
        return {
          id: "",
          type: "numeric",
          prompt: `How many points do y = ${quad(1, b, c)} and y = ${lin(m, d)} share?`,
          hint: `Set ${quad(1, b, c)} = ${lin(m, d)}, move everything to the left, and look at the sign of the discriminant of ${quad(1, B, C)}.`,
          answer: want,
          traps: trapsFor(want, [
            trap(want === 2 ? 1 : 2, want === 2 ? "A positive discriminant means two different x-values where they meet." : "Two shared points need a positive discriminant for " + quad(1, B, C) + " = 0."),
            trap(want === 0 ? 1 : 0, want === 0 ? "A negative discriminant means no real x solves it, so no shared points." : "Compute the discriminant of " + quad(1, B, C) + " = 0 again: it is not negative."),
          ]),
          explanation: `${quad(1, b, c)} = ${lin(m, d)} → ${quad(1, B, C)} = 0 → discriminant (${B})² − 4(1)(${C}) = ${D} → ${want === 2 ? "positive, two points" : want === 1 ? "zero, one point" : "negative, no points"}`,
        };
      }
      if (kind === 1) {
        // Where do they meet?
        let r1 = randInt(-7, 6);
        let r2 = randInt(-7, 7);
        if (r1 === 0) r1 = 1;
        if (r2 === 0) r2 = -1;
        if (r2 === r1 || r2 === -r1) r2 = r1 + (r1 > 0 ? 1 : -1) * 2;
        if (r2 === 0) r2 = r1 + 3;
        const [lo, hi] = r1 < r2 ? [r1, r2] : [r2, r1];
        const B = -(lo + hi);
        const C = lo * hi;
        const m = nz(5);
        const d = randInt(-9, 9);
        const b = B + m;
        const c = C + d;
        const answer = `x = ${lo} and x = ${hi}`;
        const wrong = [`x = ${-lo} and x = ${-hi}`, `x = ${lo} and x = ${-hi}`, `x = ${-lo} and x = ${hi}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `At which x-values do y = ${quad(1, b, c)} and y = ${lin(m, d)} meet?`,
          hint: `Set them equal and move everything left: ${quad(1, B, C)} = 0. Factor it.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `(x${plusTerm(-lo)})(x${plusTerm(-hi)}) = 0: each root is the opposite of the number in its bracket.`),
            trap(wrong[1], `Try x = ${-hi} in both rules; they give different y-values.`),
            trap(wrong[2], `Try x = ${-lo} in both rules; they give different y-values.`),
          ]),
          explanation: `${quad(1, b, c)} = ${lin(m, d)} → ${quad(1, B, C)} = 0 → (x${plusTerm(-lo)})(x${plusTerm(-hi)}) = 0 → ${answer}`,
        };
      }
      if (kind === 2) {
        // A ball reaching a height.
        const t1 = randInt(1, 3);
        const t2 = t1 + randInt(1, 4);
        const v = 16 * (t1 + t2);
        const H = 16 * t1 * t2;
        return {
          id: "",
          type: "numeric",
          prompt: `A ball is thrown up. Its height after t seconds is h = -16t² + ${v}t feet. After how many seconds does it first reach ${H} feet?`,
          hint: `Set -16t² + ${v}t = ${H}, move everything to one side and divide by 16: t² − ${t1 + t2}t + ${t1 * t2} = 0. The smaller root is the first time.`,
          answer: t1,
          traps: trapsFor(t1, [
            trap(t2, `That is the second time it is at ${H} feet, on the way down. The question asks for the first.`),
            trap((t1 + t2) / 2, "That is when the ball is highest, not when it first passes this height."),
            trap(t1 + t2, `${t1 + t2} is the sum of the two times, not either time.`),
          ]),
          explanation: `-16t² + ${v}t = ${H} → 16t² − ${v}t + ${H} = 0 → t² − ${t1 + t2}t + ${t1 * t2} = 0 → (t − ${t1})(t − ${t2}) = 0 → first at t = ${t1}`,
        };
      }
      if (kind === 3) {
        // A tangent line: the one shared x.
        const B = 2 * nz(5);
        const C = (B * B) / 4;
        const m = nz(6);
        const d = randInt(-8, 8);
        const b = B + m;
        const c = C + d;
        const x = -B / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `The line y = ${lin(m, d)} touches y = ${quad(1, b, c)} at exactly one point. What is the x-coordinate of that point?`,
          hint: `Set them equal: ${quad(1, B, C)} = 0 is a perfect square. Its one root is the x you want.`,
          answer: x,
          traps: trapsFor(x, [
            trap(-x, `${quad(1, B, C)} = (x${plusTerm(B / 2)})², so the root is the opposite of ${B / 2}.`),
            trap(C, `${C} is the constant term, not the root.`),
            trap(m * x + d, "That is the y-coordinate of the point. The question asks for x."),
          ]),
          explanation: `${quad(1, b, c)} = ${lin(m, d)} → ${quad(1, B, C)} = 0 → (x${plusTerm(B / 2)})² = 0 → x = ${x}`,
        };
      }
      // The larger y at the two meeting points.
      let r1 = randInt(-6, 5);
      let r2 = r1 + randInt(1, 6);
      if (r1 === 0) r1 = -1;
      if (r2 === 0) r2 = 1;
      const B = -(r1 + r2);
      const C = r1 * r2;
      const m = nz(4);
      const d = randInt(-6, 6);
      const b = B + m;
      const c = C + d;
      const y1 = m * r1 + d;
      const y2 = m * r2 + d;
      const want = Math.max(y1, y2);
      return {
        id: "",
        type: "numeric",
        prompt: `y = ${quad(1, b, c)} and y = ${lin(m, d)} meet at two points. What is the larger of the two y-values?`,
        hint: `Solve ${quad(1, B, C)} = 0 for the two x-values, then put each into the line y = ${lin(m, d)}.`,
        answer: want,
        traps: trapsFor(want, [
          trap(Math.min(y1, y2), "That is the smaller y-value of the two meeting points."),
          trap(Math.max(r1, r2), "That is the larger x-value. Put it into the line to get y."),
          trap(y1 + y2, "That is the two y-values added together. The question asks for the larger one."),
        ]),
        explanation: `${quad(1, B, C)} = 0 → x = ${r1} or x = ${r2} → y = ${lin(m, d)} gives ${y1} and ${y2} → larger is ${want}`,
      };
    }),
};

/** A how-many-solutions card for ax² + bx + c = 0. */
function mk(a: number, b: number, c: number, want: string): PracticeProblem {
  const D = b * b - 4 * a * c;
  const all = ["Two real solutions", "One real solution", "Two complex solutions", "Infinitely many solutions"];
  return {
    id: "",
    type: "multiple-choice",
    prompt: `How many solutions does ${quad(a, b, c)} = 0 have, and what kind? Use the discriminant.`,
    hint: `Compute b² − 4ac with a = ${a}, b = ${b}, c = ${c}. Positive: two real. Zero: one real. Negative: two complex.`,
    answer: want,
    choices: mcChoices(want, all.filter((w) => w !== want)),
    traps: trapsFor(want, [
      trap("Two real solutions", "Two real solutions need a positive discriminant. Check the sign of b² − 4ac."),
      trap("One real solution", "One real solution needs b² − 4ac to be exactly 0."),
      trap("Two complex solutions", "Two complex solutions need a negative discriminant. Check the sign of b² − 4ac."),
      trap("Infinitely many solutions", "A quadratic equation never has more than two solutions."),
    ]),
    explanation: `b² − 4ac = (${b})² − 4(${a})(${c}) = ${b * b} − (${4 * a * c}) = ${D}, which is ${D > 0 ? "positive: two real solutions" : D === 0 ? "zero: one real solution" : "negative: two complex solutions"}.`,
  };
}
