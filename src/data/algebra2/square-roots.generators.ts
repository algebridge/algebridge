import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, mcChoices, randInt, trapsFor } from "@/lib/problem-utils";

function trap(value: number | string, why: string, step?: number): Trap {
  return step === undefined ? { value, why } : { value, why, step };
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

/** k√m with the perfect square already out: (3, 2) → "3√2", (3, 1) → "3", (1, 5) → "√5". */
function root(k: number, m: number): string {
  if (m === 1) return String(k);
  return k === 1 ? `√${m}` : `${k}√${m}`;
}

const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));

/** Numbers with no perfect-square factor above 1, the ones left under a simplified root. */
const SQUARE_FREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15] as const;

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

function numeric(prompt: string, hint: string, answer: number, traps: (Trap | null | false)[], steps: string[]): PracticeProblem {
  return { id: "", type: "numeric", prompt, hint, answer, traps: trapsFor(answer, traps), explanation: steps.join(" → ") };
}

/** A non-square whole number in [lo, hi]. */
function nonSquare(lo: number, hi: number): number {
  let n = randInt(lo, hi);
  while (isSquare(n)) n = randInt(lo, hi);
  return n;
}

const UNITS = ["feet", "meters", "inches", "yards"] as const;

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "square-roots": (seeds) =>
    fillToCount("square-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // √N for a perfect square.
        const k = randInt(2, 20);
        const n = k * k;
        return numeric(
          `What is √${n}?`,
          `Ask which number times itself makes ${n}.`,
          k,
          [
            n % 2 === 0 && trap(n / 2, `A square root is the number that times itself makes ${n}. Half of ${n} is a different question.`, 0),
            trap(-k, "The √ sign by itself means the positive root, called the principal root.", 2),
            trap(n * n, "That is squaring. A square root goes the other way.", 0),
          ],
          [`ask: which number times itself makes ${n}?`, `${k} × ${k} = ${n}`, `√${n} = ${k}`]
        );
      }
      if (kind === 1) {
        // x² = N has two solutions.
        const k = randInt(2, 15);
        const n = k * k;
        return mcCard(
          `Solve x² = ${n}.`,
          "Two numbers square to the same positive number: one positive, one negative.",
          `x = ±${k}`,
          [
            { value: `x = ${k}`, why: `(-${k})² is ${n} too, so -${k} is also a solution.`, step: 1 },
            { value: `x = -${k}`, why: `${k}² is ${n} too, so ${k} is also a solution.`, step: 1 },
            { value: `x = ±${n}`, why: `Undo the square with a square root: √${n} = ${k}.`, step: 0 },
            { value: `x = ±${n / 2}`, why: `Undo the square with a square root, which is different from halving.`, step: 0 },
          ],
          [`undo the square with a square root, keeping both signs: x = ±√${n}`, `${k}² = ${n} and (-${k})² = ${n}, so both signs work`, `x = ±${k}`].join(" → ")
        );
      }
      if (kind === 2) {
        // Estimate √N between two whole numbers.
        const n = nonSquare(5, 200);
        const a = Math.floor(Math.sqrt(n));
        const h = Math.floor(n / 2);
        return mcCard(
          `Between which two whole numbers is √${n}?`,
          `Find the perfect squares just below and just above ${n}.`,
          `${a} and ${a + 1}`,
          [
            { value: `${a - 1} and ${a}`, why: `${a}² = ${a * a}, which is already below ${n}, so √${n} is above ${a}.`, step: 1 },
            { value: `${a + 1} and ${a + 2}`, why: `${a + 1}² = ${(a + 1) ** 2}, which is above ${n}, so √${n} is below ${a + 1}.`, step: 1 },
            { value: `${h} and ${h + 1}`, why: `That is about half of ${n}. A square root asks which number times itself makes ${n}.`, step: 0 },
            { value: `${a + 2} and ${a + 3}`, why: `${a + 2}² = ${(a + 2) ** 2}, far above ${n}.`, step: 1 },
          ],
          [`the perfect squares around ${n} are ${a * a} and ${(a + 1) ** 2}`, `${a * a} < ${n} < ${(a + 1) ** 2}, so √${a * a} < √${n} < √${(a + 1) ** 2}`, `√${n} is between ${a} and ${a + 1}`].join(" → ")
        );
      }
      if (kind === 3) {
        // A square's side from its area.
        const k = randInt(3, 25);
        const n = k * k;
        const unit = pick(UNITS);
        return numeric(
          `A square has an area of ${n} square ${unit}. How long is one side, in ${unit}?`,
          "The area of a square is side × side. Which number times itself makes the area?",
          k,
          [
            n % 4 === 0 && trap(n / 4, "Dividing by 4 finds a side from the perimeter. The area is side × side.", 0),
            n % 2 === 0 && trap(n / 2, "The area is side × side, so take the square root of the area.", 0),
          ],
          [`the area of a square is side × side, so side² = ${n}`, `side = √${n}, the positive root, since a length is positive`, `${k} × ${k} = ${n}, so one side is ${k} ${unit}`]
        );
      }
      // Spot the perfect square.
      const k = randInt(4, 15);
      const sq = k * k;
      const others = [sq + 1, sq - 1, sq + k, sq - k + 1, 2 * sq].filter((v) => !isSquare(v));
      const three = [...new Set(others)].slice(0, 3);
      const list = [sq, ...three].sort((x, y) => x - y);
      return mcCard(
        `Which number is a perfect square: ${list.slice(0, 3).join(", ")} or ${list[3]}?`,
        "A perfect square is a whole number times itself. Try the whole numbers near each one's square root.",
        String(sq),
        three.map((v) => {
          const a = Math.floor(Math.sqrt(v));
          return { value: String(v), why: `${a}² = ${a * a} and ${a + 1}² = ${(a + 1) ** 2}, so ${v} falls between two perfect squares.`, step: 1 };
        }),
        [`a perfect square is a whole number times itself`, `${k} × ${k} = ${sq}`, `${sq} is the perfect square`].join(" → ")
      );
    }),

  "negative-square-roots": (seeds) =>
    fillToCount("negative-square-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // −√N: a real number with a minus in front.
        const k = randInt(2, 15);
        const n = k * k;
        return numeric(
          `Simplify −√${n}.`,
          "Take the square root first. The minus sits outside the root, so it comes after.",
          -k,
          [trap(k, "The minus sign in front is outside the root, so the answer is negative.", 1)],
          [`the root goes first: √${n} = ${k}`, `the minus sits outside the root, so it applies next: −√${n} = −${k}`]
        );
      }
      if (kind === 1) {
        // √(−N) has no real value.
        const k = randInt(2, 15);
        const n = k * k;
        return mcCard(
          `What is √(−${n}) in the real numbers?`,
          `Look for a real number whose square is −${n}. Try ${k} and -${k}.`,
          "Not a real number",
          [
            { value: `-${k}`, why: `(-${k})² = ${n}, a positive number. Squaring a negative gives a positive.`, step: 1 },
            { value: String(k), why: `${k}² = ${n}, a positive number, so √${n} is ${k}. The minus under the root is the hard part.`, step: 1 },
            { value: `±${k}`, why: `Both ${k}² and (-${k})² equal ${n}, a positive number, so neither one squares to −${n}.`, step: 1 },
          ],
          [`√(−${n}) asks for a number whose square is −${n}`, `real numbers square to zero or a positive: ${k}² = ${n} and (-${k})² = ${n}`, `so √(−${n}) is not a real number`].join(" → ")
        );
      }
      if (kind === 2) {
        // −k² against (−k)².
        const k = randInt(2, 12);
        if (randInt(0, 1) === 0) {
          return numeric(
            `Evaluate −${k}².`,
            "Exponents come before the minus sign in front.",
            -k * k,
            [trap(k * k, `The square applies to ${k} only. The minus in front applies after.`, 0), trap(-2 * k, "Squaring multiplies a number by itself, which is different from doubling.", 0)],
            [`exponents come first: ${k}² = ${k * k}`, `then the minus in front: −${k}² = −${k * k}`]
          );
        }
        return numeric(
          `Evaluate (−${k})².`,
          "The parentheses put the minus inside the square, so the negative is multiplied by itself.",
          k * k,
          [trap(-k * k, "Negative times negative is positive.", 1), trap(-2 * k, "Squaring multiplies a number by itself, which is different from doubling.", 0)],
          [`the square covers everything in the parentheses: (−${k})² = (−${k}) × (−${k})`, `negative times negative is positive: ${k * k}`]
        );
      }
      if (kind === 3) {
        // How many real solutions x² = c has.
        const sign = i % 15 === 3 ? 0 : randInt(0, 1) === 0 ? 1 : -1;
        const c = sign === 0 ? 0 : sign * randInt(1, 120);
        const shown = c < 0 ? `−${-c}` : String(c);
        const answer = sign === 0 ? 1 : sign > 0 ? 2 : 0;
        const steps =
          sign > 0
            ? [`a positive number has two square roots, one positive and one negative`, `x = √${c} or x = −√${c}`, `2 real solutions`]
            : sign < 0
              ? [`x² is a real number times itself, which is zero or positive`, `x² = ${shown} asks for a square that is negative`, `0 real solutions`]
              : [`x² = 0 only when x itself is 0`, `+0 and −0 are the same number`, `1 real solution`];
        return numeric(
          `How many real solutions does x² = ${shown} have?`,
          "Ask which real numbers square to the right side. A square is zero or positive.",
          answer,
          sign > 0
            ? [trap(1, `-√${c} squares to ${c} as well, so there are two.`, 0)]
            : sign < 0
              ? [trap(2, `±√${-c} squares to ${-c}, a positive number, so neither one gives ${shown}.`, 1), trap(1, "Every real number squared is zero or positive.", 0)]
              : [trap(2, "+0 and −0 are the same number, so there is only one solution.", 1)],
          steps
        );
      }
      // Which one is outside the real numbers.
      const k = randInt(2, 12);
      const n = k * k;
      const answer = `√(−${n})`;
      return mcCard(
        `Which one is not a real number: √(−${n}), −√${n}, (−${k})² or −${k}²?`,
        "Work out each one that you can. The one with a negative under the root has no real value.",
        answer,
        [
          { value: `−√${n}`, why: `−√${n} = −${k}: the root is real, and the minus comes after it.`, step: 0 },
          { value: `(−${k})²`, why: `(−${k})² = ${n}, a real number.`, step: 1 },
          { value: `−${k}²`, why: `−${k}² = −${k * k}, a real number.`, step: 1 },
        ],
        [`−√${n} = −${k}, a real number`, `(−${k})² = ${n} and −${k}² = −${k * k}, both real`, `√(−${n}) asks for a square equal to −${n}, and every real square is zero or positive, so it is the one`].join(" → ")
      );
    }),

  "simplify-square-roots": (seeds) =>
    fillToCount("simplify-square-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      let k = randInt(2, 9);
      const m: number = pick(SQUARE_FREE);
      if (k * k * m > 400) k = randInt(2, 4);
      const n = k * k * m;
      const ans = root(k, m);
      const d = [2, 3].find((x) => x < k && k % x === 0);
      const steps = [`find the largest perfect square that divides ${n}: ${k * k}`, `√${n} = √(${k * k} · ${m}) = √${k * k} · √${m}`, `√${k * k} = ${k}, so √${n} = ${ans}`];
      if (kind === 0) {
        return mcCard(
          `Simplify √${n}.`,
          `Find the largest perfect square that divides ${n}, take its root out front, and leave the rest inside.`,
          ans,
          [
            { value: root(k * k, m), why: `√${k * k} is ${k}. The perfect square comes out as its root.`, step: 2 },
            d ? { value: root(d, (k / d) ** 2 * m), why: `${(k / d) ** 2 * m} still has a perfect-square factor. Use the largest one, ${k * k}.`, step: 0 } : { value: root(k + 1, m), why: `√${k * k} is ${k}, so ${k} comes out front.`, step: 2 },
            { value: `${m}√${k * k}`, why: "The root of the perfect square comes out front, and the leftover factor stays inside.", step: 1 },
            { value: `√${n}`, why: `${n} has the perfect-square factor ${k * k}, so the root can still be simplified.`, step: 0 },
          ],
          steps.join(" → ")
        );
      }
      if (kind === 1) {
        return numeric(
          `Write √${n} as a√b with b as small as possible. What is a?`,
          `Find the largest perfect square that divides ${n}. a is its square root.`,
          k,
          [trap(k * k, `a is the root of the perfect square: √${k * k} = ${k}.`, 2), trap(m, `${m} is what stays inside the root, the b.`, 1), d ? trap(d, `${(k / d) ** 2 * m} still has a perfect-square factor. Use the largest one, ${k * k}.`, 0) : null],
          steps
        );
      }
      // Pick the fully simplified root.
      const a = [`${k}√${4 * m}`, `${k}√${9 * m}`, `√${n}`];
      const list = [ans, ...a].sort();
      return mcCard(
        `Which square root is fully simplified: ${list.slice(0, 3).join(", ")} or ${list[3]}?`,
        "A root is fully simplified when the number inside has no perfect-square factor except 1.",
        ans,
        [
          { value: a[0], why: `${4 * m} = 4 · ${m}, and 4 is a perfect square, so a 2 can still come out.`, step: 1 },
          { value: a[1], why: `${9 * m} = 9 · ${m}, and 9 is a perfect square, so a 3 can still come out.`, step: 1 },
          { value: a[2], why: `${n} = ${k * k} · ${m}, so ${k} can still come out.`, step: 1 },
        ],
        [`fully simplified means the number under the root has no perfect-square factor except 1`, `${4 * m}, ${9 * m} and ${n} each have one; ${m} has none`, `${ans} is fully simplified`].join(" → ")
      );
    }),

  "operations-square-roots": (seeds) =>
    fillToCount("operations-square-roots", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        // Add or subtract like roots.
        const m: number = pick(SQUARE_FREE);
        const a = randInt(2, 9);
        let b = randInt(1, 9);
        const add = randInt(0, 1) === 0;
        if (!add && b >= a) b = randInt(1, a - 1);
        const c = add ? a + b : a - b;
        const op = add ? "+" : "−";
        const bTerm = b === 1 ? `√${m}` : `${b}√${m}`;
        return mcCard(
          `Simplify ${a}√${m} ${op} ${bTerm}.`,
          `Both terms have √${m}, so they are like terms. Combine the numbers in front and keep √${m}.`,
          root(c, m),
          [
            { value: root(c, 2 * m), why: `Like terms keep their root, the way 2x + 3x = 5x keeps x. The √${m} stays √${m}.`, step: 1 },
            { value: root(a * b, m), why: `This is ${add ? "an addition" : "a subtraction"}. The numbers in front are ${add ? "added" : "subtracted"}.`, step: 1 },
            { value: String(c), why: `The √${m} stays in the answer.`, step: 2 },
            { value: root(add ? Math.abs(a - b) || a + b + 1 : a + b, m), why: `Check the sign: this is ${add ? "an addition" : "a subtraction"}.`, step: 1 },
          ],
          [`√${m} is in both terms, so they are like terms, as in ${a}x ${op} ${b === 1 ? "" : b}x`, `combine the numbers in front: ${a} ${op} ${b} = ${c}`, `${root(c, m)}`].join(" → ")
        );
      }
      if (kind === 1) {
        // √a · √b with the product rule, then simplify.
        const k = randInt(2, 6);
        const m: number = pick([1, 2, 3, 5, 6, 7]);
        const p = k * k * m;
        const divs: number[] = [];
        for (let x = 2; x < p; x++) if (p % x === 0 && !isSquare(x) && !isSquare(p / x) && x <= p / x) divs.push(x);
        if (!divs.length) {
          const x = m === 1 ? 2 : m;
          return mcCard(
            `Multiply: √${x} · √${2 * x}.`,
            "Multiply the numbers under one root, then simplify.",
            root(x, 2),
            [
              { value: `√${2 * x * x}`, why: `√${2 * x * x} can still be simplified: ${x * x} is a perfect square.`, step: 2 },
              { value: `√${3 * x}`, why: "√a · √b multiplies the numbers inside. Adding them is a different rule.", step: 0 },
              { value: root(x * x, 2), why: `√${x * x} is ${x}, so ${x} comes out front.`, step: 2 },
            ],
            [`product rule: √${x} · √${2 * x} = √(${x} · ${2 * x}) = √${2 * x * x}`, `√${2 * x * x} = √(${x * x} · 2) = √${x * x} · √2`, `√${x * x} = ${x}, so the product is ${root(x, 2)}`].join(" → ")
          );
        }
        const a = pick(divs);
        const b = p / a;
        const ans = root(k, m);
        return mcCard(
          `Multiply: √${a} · √${b}.`,
          "Multiply the numbers under one root, then simplify.",
          ans,
          [
            { value: `√${p}`, why: `√${p} can still be simplified: ${k * k} is a perfect square.`, step: 2 },
            { value: `√${a + b}`, why: "√a · √b multiplies the numbers inside. Adding them is a different rule.", step: 0 },
            { value: root(k * k, m), why: `√${k * k} is ${k}, so ${k} comes out front.`, step: 2 },
            { value: String(p), why: `Multiplying gives √${p}. Then take the root.`, step: 1 },
          ],
          [
            `product rule: √${a} · √${b} = √(${a} · ${b}) = √${p}`,
            m === 1 ? `${p} = ${k} × ${k}, a perfect square` : `√${p} = √(${k * k} · ${m}) = √${k * k} · √${m}`,
            `√${p} = ${ans}`,
          ].join(" → ")
        );
      }
      if (kind === 2) {
        // (a√m)²: squaring undoes the root.
        const a = randInt(2, 9);
        const m: number = pick(SQUARE_FREE);
        return numeric(
          `Simplify (${a}√${m})². Write a plain number.`,
          `Square the ${a} and square the √${m} separately. Squaring a square root gives back the number inside.`,
          a * a * m,
          [trap(a * a * m * m, `(√${m})² = ${m}: squaring undoes the root.`, 1), trap(2 * a * m, "Squaring multiplies by itself, which is different from doubling.", 0), trap(a * m, `The ${a} gets squared too.`, 1)],
          [`(${a}√${m})² = ${a}² · (√${m})²`, `${a}² = ${a * a} and (√${m})² = ${m}`, `${a * a} × ${m} = ${a * a * m}`]
        );
      }
      // (−√m)²: a negative squared is positive, the step before i.
      const m = nonSquare(2, 60);
      return numeric(
        `Evaluate (−√${m})². Write a plain number.`,
        "Write it as (−√m) times (−√m). Negative times negative is positive, and √m · √m = m.",
        m,
        [trap(-m, "Negative times negative is positive, so a square is never below 0.", 1), trap(m * m, `√${m} · √${m} = ${m}: squaring undoes the root.`, 1)],
        [`(−√${m})² = (−√${m}) · (−√${m})`, `negative times negative is positive, and √${m} · √${m} = ${m}`, `(−√${m})² = ${m}`]
      );
    }),
};
