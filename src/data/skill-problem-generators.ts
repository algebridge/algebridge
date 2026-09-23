import type { PracticeProblem } from "@/types";
import {
  coef,
  fillToCount,
  fmtNum,
  frac,
  hashString,
  lin,
  mcChoices,
  plusTerm,
  PROBLEMS_PER_SKILL,
  quad,
  randInt,
  seededShuffle,
  twoVar,
  withSeededGeneration,
  withUniqueChoices,
} from "@/lib/problem-utils";

/*
 * Every generator draws its numbers from the seeded random source (randInt),
 * never Math.random: the server rebuilds a student's bank from its seed to
 * write stories for it, and the two must agree problem for problem.
 *
 * Rules every problem here keeps (and practice.test.ts checks):
 *  - exactly one choice is right, and no two choices are the same answer
 *    written differently;
 *  - the answer is something the box can take: one number, or one choice;
 *  - a non-whole answer says how to write it (a fraction, or a rounding place);
 *  - equations print the way a textbook prints them: "x", never "1x";
 *    "x − 3", never "x + -3"; nothing added or multiplied by zero.
 */

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** One of these, chosen with the seeded generator. */
function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

/** A whole number in [lo, hi] other than 0. */
function nonZero(lo: number, hi: number): number {
  let v = 0;
  while (v === 0) v = randInt(lo, hi);
  return v;
}

/** Numbers written the American way whatever the browser's language: 42,240. */
function usNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** Dollars and cents: 1,157.63. */
function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A number inside an expression, bracketed when negative: -2 → "(-2)". */
function par(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

/** A shift inside a bracket or a point-slope side: ("x", 3) → "x − 3", ("x", -3) → "x + 3". */
function shift(v: string, h: number): string {
  if (h === 0) return v;
  return h > 0 ? `${v} − ${h}` : `${v} + ${-h}`;
}

/** A factor (x + u), with its sign right: 3 → "(x + 3)", -3 → "(x − 3)". */
function factor(u: number, v = "x"): string {
  return `(${shift(v, -u)})`;
}

/** m times a bracket: (1, "x − 2") → "x − 2", (-1, ...) → "-(x − 2)", (3, ...) → "3(x − 2)". */
function times(m: number, inner: string): string {
  if (m === 1) return inner;
  if (m === -1) return `-(${inner})`;
  return `${m}(${inner})`;
}

/** m(x) + b worked out for a student: (2, -3, 4) → "2(4) − 3 = 5". */
function evalLin(m: number, b: number, x: number): string {
  const mult = m === 1 ? `(${x})` : m === -1 ? `-(${x})` : `${m}(${x})`;
  if (b === 0) return `${mult} = ${m * x}`;
  return `${mult}${plusTerm(b)} = ${m * x}${plusTerm(b)} = ${m * x + b}`;
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
function sub(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)])
    .join("");
}

function ordinal(n: number): string {
  const teen = n % 100;
  if (teen >= 11 && teen <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "1/2 and 1/3", "1/2, 1/3, and 1/6". */
function listOf(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** A radical k√f, with k = 1 written as √f. */
function rad(k: number, f: number): string {
  return k === 1 ? `√${f}` : `${k}√${f}`;
}

/** Everyday unit pairs for "which conversion factor" cards: the right one has the old unit on the bottom. */
const CONVERSION_FACTORS = [
  { from: "pounds", to: "ounces", fact: "1 lb = 16 oz", right: "16 oz / 1 lb", wrong: ["1 lb / 16 oz", "16 lb / 1 oz", "1 oz / 16 lb"] },
  { from: "feet", to: "inches", fact: "1 ft = 12 in", right: "12 in / 1 ft", wrong: ["1 ft / 12 in", "12 ft / 1 in", "1 in / 12 ft"] },
  { from: "hours", to: "minutes", fact: "1 h = 60 min", right: "60 min / 1 h", wrong: ["1 h / 60 min", "60 h / 1 min", "1 min / 60 h"] },
  { from: "minutes", to: "hours", fact: "1 h = 60 min", right: "1 h / 60 min", wrong: ["60 min / 1 h", "60 h / 1 min", "1 min / 60 h"] },
  { from: "meters", to: "centimeters", fact: "1 m = 100 cm", right: "100 cm / 1 m", wrong: ["1 m / 100 cm", "100 m / 1 cm", "1 cm / 100 m"] },
  { from: "kilograms", to: "grams", fact: "1 kg = 1000 g", right: "1000 g / 1 kg", wrong: ["1 kg / 1000 g", "1000 kg / 1 g", "1 g / 1000 kg"] },
  { from: "yards", to: "feet", fact: "1 yd = 3 ft", right: "3 ft / 1 yd", wrong: ["1 yd / 3 ft", "3 yd / 1 ft", "1 ft / 3 yd"] },
  { from: "gallons", to: "quarts", fact: "1 gal = 4 qt", right: "4 qt / 1 gal", wrong: ["1 gal / 4 qt", "4 gal / 1 qt", "1 qt / 4 gal"] },
] as const;

type SkillGenerator = (seeds: PracticeProblem[]) => PracticeProblem[];

const generators: Record<string, SkillGenerator> = {
  "unit-basics": (seeds) =>
    fillToCount("unit-basics", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const miles = randInt(2, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${miles} miles to feet. (1 mile = 5280 ft)`,
          hint: `Multiply ${miles} × 5280.`,
          answer: miles * 5280,
          explanation: `${miles} × 5280 = ${usNum(miles * 5280)} feet`,
        };
      }
      if (kind === 1) {
        const inches = randInt(12, 240);
        const feet = inches / 12;
        const even = Number.isInteger(feet);
        const rounded = Math.round(feet * 100) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: even
            ? `Convert ${inches} inches to feet.`
            : `Convert ${inches} inches to feet. (round to the hundredths place)`,
          hint: "Divide by 12, since 12 inches make 1 foot.",
          answer: even ? feet : rounded,
          decimalPlaces: even ? undefined : 2,
          explanation: even ? `${inches} ÷ 12 = ${feet} feet` : `${inches} ÷ 12 ≈ ${rounded.toFixed(2)} feet`,
        };
      }
      if (kind === 2) {
        const km = randInt(2, 15);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${km} kilometers to meters.`,
          hint: "Multiply by 1000.",
          answer: km * 1000,
          explanation: `${km} × 1000 = ${usNum(km * 1000)} meters`,
        };
      }
      // A conversion factor, from everyday pairs: the one with the old unit on the bottom.
      const f = pick(CONVERSION_FACTORS);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which conversion factor converts ${f.from} to ${f.to}? (${f.fact})`,
        hint: `Put ${f.from} on the bottom so they cancel, and ${f.to} on top.`,
        answer: f.right,
        choices: mcChoices(f.right, [...f.wrong]),
        explanation: `Multiply by ${f.right}: the ${f.from} cancel and ${f.to} are left.`,
      };
    }),

  "dimensional-analysis": (seeds) =>
    fillToCount("dimensional-analysis", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        const hours = randInt(2, 24);
        const half = randInt(0, 1) === 1;
        const total = half ? hours + 0.5 : hours;
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${total} hours to seconds.`,
          hint: "1 hour = 3600 seconds.",
          answer: total * 3600,
          explanation: `${total} × 3600 = ${usNum(total * 3600)} seconds`,
        };
      }
      if (kind === 1) {
        const days = randInt(2, 30);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${days} days to hours.`,
          hint: "Multiply by 24.",
          answer: days * 24,
          explanation: `${days} × 24 = ${days * 24} hours`,
        };
      }
      if (kind === 2) {
        // A real mistake, every time: a factor upside down, or the wrong power of ten.
        const km = randInt(2, 9);
        const m = km * 1000;
        const mistake = pick([
          { step: `${usNum(m)} m × 1 m/100 cm = ${usNum(m / 100)} cm`, why: "The factor is upside down: meters must be on the bottom to cancel." },
          { step: `${usNum(m)} m × 10 cm/m = ${usNum(m * 10)} cm`, why: "A meter is 100 centimeters, not 10." },
          { step: `${usNum(m)} m × 1000 cm/m = ${usNum(m * 1000)} cm`, why: "A meter is 100 centimeters, not 1000." },
        ]);
        return {
          id: "",
          type: "error-analysis",
          prompt: `Find the error in this conversion of ${km} km to centimeters.`,
          hint: "Check each conversion factor: is it right side up, and is its number right?",
          wrongStepIndex: 2,
          steps: [`Start with ${km} km.`, `${km} km × 1000 m/km = ${usNum(m)} m`, mistake.step],
          explanation: `${mistake.why} ${usNum(m)} m × 100 cm/m = ${usNum(m * 100)} cm.`,
        };
      }
      if (kind === 3) {
        const kg = randInt(2, 25);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${kg} kilograms to grams.`,
          hint: "1 kg = 1000 g.",
          answer: kg * 1000,
          explanation: `${kg} × 1000 = ${usNum(kg * 1000)} grams`,
        };
      }
      const minutes = randInt(2, 20);
      return {
        id: "",
        type: "numeric",
        prompt: `Convert ${minutes} minutes to milliseconds.`,
        hint: "1 minute = 60 seconds = 60,000 milliseconds.",
        answer: minutes * 60000,
        explanation: `${minutes} × 60,000 = ${usNum(minutes * 60000)} milliseconds`,
      };
    }),

  "unit-word-problems": (seeds) =>
    fillToCount("unit-word-problems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const ml = randInt(2, 9) * 250;
        return {
          id: "",
          type: "numeric",
          prompt: `A recipe needs ${ml} mL of water. How many liters is that?`,
          hint: "1000 mL = 1 L",
          answer: ml / 1000,
          explanation: `${ml} ÷ 1000 = ${ml / 1000} liters`,
        };
      }
      if (kind === 1) {
        // Built from a real mileage, so the answer comes out whole.
        const mpg = randInt(18, 40);
        let gallons = randInt(2, 12);
        if (mpg === 30 && gallons === 5) gallons = 6; // the hand-written card is 150 miles on 5 gallons
        const miles = mpg * gallons;
        return {
          id: "",
          type: "numeric",
          prompt: `You drive ${miles} miles using ${gallons} gallons of gas. How many miles per gallon?`,
          hint: "Divide miles by gallons.",
          answer: mpg,
          explanation: `${miles} ÷ ${gallons} = ${mpg} miles per gallon`,
        };
      }
      const speed = randInt(40, 70);
      const hours = randInt(2, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `A train travels ${speed} mph for ${hours} hours. How many miles?`,
        hint: "Distance = rate × time.",
        answer: speed * hours,
        explanation: `${speed} × ${hours} = ${speed * hours} miles`,
      };
    }),

  "one-step-equations": (seeds) =>
    fillToCount("one-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const x = randInt(2, 25);
        const a = randInt(3, 15);
        const c = x + a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x + ${a} = ${c}`,
          hint: `Subtract ${a} from both sides.`,
          answer: x,
          explanation: `x = ${c} − ${a} = ${x}`,
        };
      }
      if (kind === 1) {
        const x = randInt(2, 20);
        const a = randInt(3, 12);
        const c = x - a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x − ${a} = ${c}`,
          hint: `Add ${a} to both sides.`,
          answer: x,
          explanation: `x = ${c} + ${a} = ${x}`,
        };
      }
      if (kind === 2) {
        const x = randInt(2, 15);
        const a = randInt(2, 9);
        const c = a * x;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}x = ${c}`,
          hint: `Divide both sides by ${a}.`,
          answer: x,
          explanation: `x = ${c} ÷ ${a} = ${x}`,
        };
      }
      const x = randInt(2, 12);
      const a = randInt(2, 8);
      const c = a * x;
      const wrong = c + a;
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this solution of ${a}x = ${c}.`,
        hint: "Check whether the right inverse operation was used.",
        wrongStepIndex: 1,
        steps: [`${a}x = ${c}`, `x = ${c} + ${a}`, `x = ${wrong}`],
        explanation: `Step 2 adds ${a}, but ${a}x means ${a} times x, so divide instead: x = ${c} ÷ ${a} = ${x}.`,
      };
    }),

  "two-step-equations": (seeds) =>
    fillToCount("two-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(2, 6);
      const x = randInt(2, 12);
      const b = randInt(1, 10);
      const minusB = i % 3 === 2;
      const c = minusB ? a * x - b : a * x + b;
      const op = minusB ? "−" : "+";
      if (i % 5 === 0) {
        return {
          id: "",
          type: "step-order",
          prompt: `Order the steps to solve ${a}x ${op} ${b} = ${c}:`,
          hint: "Undo the adding or subtracting before the multiplying.",
          correctOrder: [0, 1, 2],
          steps: [
            `${minusB ? "Add" : "Subtract"} ${b}: ${a}x = ${a * x}`,
            `Divide by ${a}: x = ${x}`,
            `Check: ${a}(${x}) ${op} ${b} = ${c} ✓`,
          ],
          explanation: `${minusB ? "Add" : "Subtract"} ${b} first, then divide by ${a}, then check by putting x = ${x} back in.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: ${a}x ${op} ${b} = ${c}`,
        hint: `${minusB ? "Add" : "Subtract"} ${b}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}x ${op} ${b} = ${c} → ${a}x = ${a * x} → x = ${x}`,
      };
    }),

  "multi-step-equations": (seeds) =>
    fillToCount("multi-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(1, 8);
        const c = a * (x + b);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}(x + ${b}) = ${c}`,
          hint: "Divide both sides by the number outside first, or distribute.",
          answer: x,
          explanation: `Divide by ${a}: x + ${b} = ${x + b} → x = ${x}`,
        };
      }
      if (kind === 1) {
        // x on both sides.
        const x = randInt(-4, 9);
        const p = randInt(3, 7);
        const r = randInt(1, p - 1);
        const q = randInt(-8, 8);
        const s = (p - r) * x + q;
        const k = p - r;
        const steps = [`${lin(k, q)} = ${s}`];
        if (q !== 0) steps.push(`${coef(k)} = ${s - q}`);
        if (k !== 1) steps.push(`x = ${x}`);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${lin(p, q)} = ${lin(r, s)}`,
          hint: `Get the x terms on one side: subtract ${coef(r)} from both sides.`,
          answer: x,
          explanation: `Subtract ${coef(r)} from both sides: ${steps.join(" → ")}`,
        };
      }
      const x = randInt(3, 12);
      const a = randInt(2, 5);
      const b = randInt(1, 6);
      const d = randInt(1, 9);
      const c = a * (x - b) + d;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: ${a}(x − ${b}) + ${d} = ${c}`,
        hint: `Subtract ${d}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}(x − ${b}) = ${c - d} → x − ${b} = ${(c - d) / a} → x = ${x}`,
      };
    }),

  "equations-with-fractions": (seeds) =>
    fillToCount("equations-with-fractions", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 4 === 3) {
        const set = pick([[2, 3], [3, 4], [4, 6], [2, 5], [3, 5], [4, 5], [6, 8], [2, 3, 6], [3, 9], [4, 10], [2, 5, 10], [6, 9], [2, 7], [3, 8]]);
        const lcd = set.reduce((acc, d) => lcm(acc, d), 1);
        const product = set.reduce((acc, d) => acc * d, 1);
        const wrong = [product, Math.max(...set), lcd * 2, lcd + Math.min(...set), lcd * 3].filter((w) => w !== lcd);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the least common denominator of ${listOf(set.map((d) => `1/${d}`))}?`,
          hint: "Find the smallest number that every denominator divides into evenly.",
          answer: `${lcd}`,
          choices: mcChoices(`${lcd}`, wrong.map(String)),
          explanation: `${lcd} is the smallest number that ${listOf(set.map(String))} all divide into.`,
        };
      }
      // The answer is a multiple of the denominator, so the right side comes out whole.
      const d = pick([2, 3, 4, 5, 6]);
      const x = d * randInt(1, 8);
      const b = randInt(1, 8);
      const c = x / d + b;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: x/${d} + ${b} = ${c}`,
        hint: `Subtract ${b}, then multiply by ${d}.`,
        answer: x,
        explanation: `x/${d} = ${c - b} → x = ${c - b} × ${d} = ${x}`,
      };
    }),

  "linear-inequalities": (seeds) =>
    fillToCount("linear-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: "When do you flip the inequality sign?",
          hint: "Think about multiplying or dividing by a negative.",
          answer: "When multiplying or dividing by a negative",
          choices: mcChoices("When multiplying or dividing by a negative", ["When adding a negative", "When subtracting", "Never"]),
          explanation: "Multiplying or dividing both sides by a negative number reverses the inequality.",
        };
      }
      const kind = i % 4;
      if (kind === 0 || kind === 2) {
        // The key idea, practiced: a negative coefficient, so the sign flips.
        const a = randInt(2, 6);
        const x0 = nonZero(-8, 8);
        const b = randInt(-9, 9);
        const sym = pick([">", "<", "≥", "≤"] as const);
        const flip = ({ ">": "<", "<": ">", "≥": "≤", "≤": "≥" } as const)[sym];
        const c = -a * x0 + b;
        const left = lin(-a, b);
        const answer = `x ${flip} ${x0}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${left} ${sym} ${c}`,
          hint: "You will divide by a negative number. What does that do to the inequality sign?",
          answer,
          choices: mcChoices(answer, [`x ${sym} ${x0}`, `x ${flip} ${-x0}`, `x ${sym} ${-x0}`]),
          explanation: `${left} ${sym} ${c} → ${coef(-a)} ${sym} ${c - b} → divide by ${-a} and flip the sign: ${answer}`,
        };
      }
      const a = randInt(2, 5);
      const x = randInt(2, 12);
      const b = randInt(1, 8);
      if (kind === 1) {
        const boundary = a * x + b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}x + ${b} > ${boundary}. What number does x have to be greater than? Type just the number.`,
          hint: `Subtract ${b}, then divide by ${a}.`,
          answer: x,
          explanation: `${a}x > ${a * x} → x > ${x}`,
        };
      }
      const boundary = a * x - b;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: ${a}x − ${b} < ${boundary}. What number does x have to be less than? Type just the number.`,
        hint: `Add ${b}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}x < ${a * x} → x < ${x}`,
      };
    }),

  "coordinate-plane": (seeds) =>
    fillToCount("coordinate-plane", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = nonZero(-8, 8);
      const y = nonZero(-8, 8);
      if (i % 2 === 0) {
        const quadrant =
          x > 0 && y > 0 ? "Quadrant I" : x < 0 && y > 0 ? "Quadrant II" : x < 0 && y < 0 ? "Quadrant III" : "Quadrant IV";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `In which quadrant is the point (${x}, ${y})?`,
          hint: "Check the signs of x and y: Quadrant I is (+, +), then count counterclockwise.",
          answer: quadrant,
          choices: mcChoices(quadrant, ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"]),
          explanation: `x is ${x > 0 ? "positive" : "negative"} and y is ${y > 0 ? "positive" : "negative"}, so (${x}, ${y}) is in ${quadrant}.`,
        };
      }
      const askX = i % 4 === 1;
      return {
        id: "",
        type: "numeric",
        prompt: askX ? `What is the x-coordinate of (${x}, ${y})?` : `What is the y-coordinate of (${x}, ${y})?`,
        hint: askX ? "x comes first in (x, y)." : "y comes second in (x, y).",
        answer: askX ? x : y,
        explanation: askX ? `The x-coordinate is ${x}.` : `The y-coordinate is ${y}.`,
      };
    }),

  slope: (seeds) =>
    fillToCount("slope", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 5) {
        // Vertical and horizontal lines, from points, so every one is a new card.
        const a = randInt(-5, 6);
        const b = randInt(-5, 5);
        const step = randInt(2, 7);
        if (i % 12 === 5) {
          return {
            id: "",
            type: "multiple-choice",
            prompt: `What is the slope of the line through (${a}, ${b}) and (${a}, ${b + step})?`,
            hint: "Look at the x-values. What is the run?",
            answer: "Undefined",
            choices: mcChoices("Undefined", ["0", `${step}`, `1/${step}`]),
            explanation: `The x-values match, so the run is 0. Dividing by 0 is undefined: the line is vertical.`,
          };
        }
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the slope of the line through (${b}, ${a}) and (${b + step}, ${a})?`,
          hint: "Look at the y-values. What is the rise?",
          answer: "0",
          choices: mcChoices("0", ["Undefined", `${step}`, `${-step}`]),
          explanation: `The y-values match, so the rise is 0 and the slope is 0/${step} = 0: the line is horizontal.`,
        };
      }
      const x1 = randInt(-4, 4);
      const y1 = randInt(-5, 5);
      const run = randInt(1, 6);
      const rise = nonZero(-6, 6);
      const [p, q] = randInt(0, 1) === 0 ? [[x1, y1], [x1 + run, y1 + rise]] : [[x1 + run, y1 + rise], [x1, y1]];
      return {
        id: "",
        type: "numeric",
        prompt: `Find the slope between (${p[0]}, ${p[1]}) and (${q[0]}, ${q[1]}). Give it as a whole number or a fraction.`,
        hint: "m = (y₂ − y₁) / (x₂ − x₁). A fraction like 2/3 is a fine answer.",
        answer: rise / run,
        explanation: `m = (${q[1]} − ${par(p[1])}) / (${q[0]} − ${par(p[0])}) = ${q[1] - p[1]}/${q[0] - p[0]}${`${q[1] - p[1]}/${q[0] - p[0]}` === frac(rise, run) ? "" : ` = ${frac(rise, run)}`}`,
      };
    }),

  "graphing-lines": (seeds) =>
    fillToCount("graphing-lines", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = nonZero(-4, 4);
      const b = randInt(-6, 6);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the y-intercept of y = ${lin(m, b)}?`,
          hint: "In y = mx + b, the y-intercept is b.",
          answer: `${b}`,
          choices: mcChoices(`${b}`, [`${m}`, `${-b}`, `${m + b}`, `${b + 1}`]),
          explanation: `b = ${b}, so the line crosses the y-axis at (0, ${b}).`,
        };
      }
      const x = randInt(-4, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `For y = ${lin(m, b)}, what is y when x = ${x}?`,
        hint: `Put ${x} in for x.`,
        answer: m * x + b,
        explanation: `y = ${evalLin(m, b, x)}`,
      };
    }),

  intercepts: (seeds) =>
    fillToCount("intercepts", seeds, PROBLEMS_PER_SKILL, (i) => {
      const k = nonZero(-8, 8);
      if (i % 2 === 0) {
        let a = nonZero(-5, 5);
        let b = pick([1, 2, 3, -1, -2]);
        let c = a * k;
        if (a < 0) [a, b, c] = [-a, -b, -c];
        return {
          id: "",
          type: "numeric",
          prompt: `Find the x-intercept of ${twoVar(a, b)} = ${c}. Type its x-value.`,
          hint: "At the x-intercept, y = 0.",
          answer: k,
          explanation: `Set y = 0: ${coef(a)} = ${c}, so x = ${k}. The x-intercept is (${k}, 0).`,
        };
      }
      let a = nonZero(-5, 5);
      let b = nonZero(-5, 5);
      let c = b * k;
      if (a < 0) [a, b, c] = [-a, -b, -c];
      return {
        id: "",
        type: "numeric",
        prompt: `Find the y-intercept of ${twoVar(a, b)} = ${c}. Type its y-value.`,
        hint: "At the y-intercept, x = 0.",
        answer: k,
        explanation: `Set x = 0: ${coef(b, "y")} = ${c}, so y = ${k}. The y-intercept is (0, ${k}).`,
      };
    }),

  "slope-intercept": (seeds) =>
    fillToCount("slope-intercept", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = nonZero(-5, 5);
      const b = randInt(-6, 6);
      const kind = i % 3;
      if (kind === 0) {
        const eq = `y = ${lin(m, b)}`;
        // Wrong lines as (slope, intercept) pairs, so none can be the right line written differently.
        const pairs: [number, number][] = [[b, m], [-m, b], [m, -b], [m, b + 2], [-m, -b], [m, b - 3]];
        const wrong = pairs.filter(([pm, pb]) => !(pm === m && pb === b)).map(([pm, pb]) => `y = ${lin(pm, pb)}`);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which equation has slope ${m} and y-intercept ${b}?`,
          hint: "Use y = mx + b: m is the slope, b is the y-intercept.",
          answer: eq,
          choices: mcChoices(eq, wrong),
          explanation: `Put m = ${m} and b = ${b} into y = mx + b: ${eq}.`,
        };
      }
      if (kind === 1) {
        return {
          id: "",
          type: "numeric",
          prompt: `In y = ${lin(m, b)}, what is the slope?`,
          hint: "The slope is the number multiplying x.",
          answer: m,
          explanation: `y = ${lin(m, b)} is y = mx + b with m = ${m}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `In y = ${lin(m, b)}, what is the y-intercept?`,
        hint: "The y-intercept is the number added on at the end (0 when there is none).",
        answer: b,
        explanation: `y = ${lin(m, b)} is y = mx + b with b = ${b}.`,
      };
    }),

  "point-slope": (seeds) =>
    fillToCount("point-slope", seeds, PROBLEMS_PER_SKILL, () => {
      const x1 = nonZero(-5, 6);
      const y1 = nonZero(-6, 9);
      const m = nonZero(-4, 4);
      const ps = (s: number, px: number, py: number) => `${shift("y", py)} = ${times(s, shift("x", px))}`;
      const answer = ps(m, x1, y1);
      const intercept = y1 - m * x1;
      // Each wrong option with the line it really is, so none can be the right line in disguise.
      const candidates: { text: string; slope: number; b: number }[] = [
        { text: ps(m, y1, x1), slope: m, b: x1 - m * y1 },
        { text: ps(-m, x1, y1), slope: -m, b: y1 + m * x1 },
        { text: ps(m, -x1, -y1), slope: m, b: -y1 + m * x1 },
        { text: `y = ${lin(m, y1)}`, slope: m, b: y1 },
        { text: `y = ${lin(m, -x1)}`, slope: m, b: -x1 },
      ];
      const wrong = candidates.filter((c) => !(c.slope === m && c.b === intercept)).map((c) => c.text);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which equation is the line through (${x1}, ${y1}) with slope ${m}, written in point-slope form?`,
        hint: "Use y − y₁ = m(x − x₁), with the point's x and y in their own places.",
        answer,
        choices: mcChoices(answer, wrong),
        explanation: `Put the point (${x1}, ${y1}) and the slope ${m} into y − y₁ = m(x − x₁): ${answer}.`,
      };
    }),

  "standard-form": (seeds) =>
    fillToCount("standard-form", seeds, PROBLEMS_PER_SKILL, () => {
      const m = nonZero(-4, 4);
      const b = randInt(-6, 6);
      // Ax + By = C with a whole slope and intercept once it is solved for y.
      let B = pick([1, 1, 2, 3, -1]);
      let A = -m * B;
      let C = b * B;
      if (A < 0) [A, B, C] = [-A, -B, -C];
      const answer = `y = ${lin(m, b)}`;
      const pairs: [number, number][] = [[-m, b], [m, -b], [m, C], [b, m], [-m, -b]];
      const wrong = pairs.filter(([pm, pb]) => !(pm === m && pb === b)).map(([pm, pb]) => `y = ${lin(pm, pb)}`);
      const moved = `${coef(B, "y")} = ${lin(-A, C)}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Convert ${twoVar(A, B)} = ${C} to slope-intercept form.`,
        hint: B === 1 ? `Get y by itself: move the x term to the other side.` : `Move the x term to the other side, then divide every term by ${B}.`,
        answer,
        choices: mcChoices(answer, wrong),
        explanation:
          B === 1
            ? `Subtract ${coef(A)} from both sides: ${answer}.`
            : `Subtract ${coef(A)} from both sides: ${moved}. Then divide every term by ${B}: ${answer}.`,
      };
    }),

  "parallel-perpendicular": (seeds) =>
    fillToCount("parallel-perpendicular", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        // A whole slope or a fraction; the answer is its negative reciprocal.
        let top: number;
        let bottom: number;
        if (randInt(0, 2) === 0) {
          bottom = randInt(2, 7);
          top = nonZero(-6, 6);
          while (gcd(top, bottom) !== 1 || Math.abs(top) === bottom) {
            bottom = randInt(2, 7);
            top = nonZero(-6, 6);
          }
        } else {
          top = nonZero(-9, 9);
          bottom = 1;
        }
        const given = frac(top, bottom);
        const answer = frac(-bottom, top);
        return {
          id: "",
          type: "numeric",
          prompt: `Line A has slope ${given}. What is the slope of a line perpendicular to line A? Give it as a whole number or a fraction.`,
          hint: "Flip the slope and change its sign: the negative reciprocal. A fraction like -1/3 is a fine answer.",
          answer: -bottom / top,
          explanation: `The negative reciprocal of ${given} is ${answer}, and ${given} × ${answer} = -1.`,
        };
      }
      if (kind === 1) {
        let m = nonZero(-6, 6);
        while (Math.abs(m) === 1) m = nonZero(-6, 6);
        const b = nonZero(-9, 9);
        let b2 = nonZero(-9, 9);
        while (b2 === b) b2 = nonZero(-9, 9);
        const parallel = `y = ${lin(m, b2)}`;
        const recip = (n: number, d: number, c: number) => `y = (${frac(n, d)})x${plusTerm(c)}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which line is parallel to y = ${lin(m, b)}?`,
          hint: "Parallel lines have the same slope.",
          answer: parallel,
          choices: mcChoices(parallel, [`y = ${lin(-m, b)}`, recip(1, m, nonZero(-9, 9)), recip(-1, m, b), `y = ${lin(m + 1, b2)}`]),
          explanation: `${parallel} has the same slope, ${m}, and a different y-intercept, so it never meets y = ${lin(m, b)}.`,
        };
      }
      let m1 = nonZero(-9, 9);
      while (Math.abs(m1) === 1) m1 = nonZero(-9, 9);
      const answer = frac(-1, m1);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `A line has slope ${m1}. Which slope makes a line perpendicular to it?`,
        hint: "Perpendicular slopes are negative reciprocals: flip it and change its sign.",
        answer,
        choices: mcChoices(answer, [frac(1, m1), `${-m1}`, `${m1}`]),
        explanation: `Perpendicular slopes multiply to -1: ${m1} × ${answer} = -1.`,
      };
    }),

  "graphing-systems": (seeds) =>
    fillToCount("graphing-systems", seeds, PROBLEMS_PER_SKILL, () => {
      const x = nonZero(-4, 6);
      const y = randInt(-5, 8);
      const m1 = nonZero(-3, 3);
      let m2 = nonZero(-3, 3);
      while (m2 === m1) m2 = nonZero(-3, 3);
      const b1 = y - m1 * x;
      const b2 = y - m2 * x;
      const answer = `(${x}, ${y})`;
      // Points on one line only, so none of them is where the lines cross.
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Where do y = ${lin(m1, b1)} and y = ${lin(m2, b2)} intersect?`,
        hint: "Set the two right sides equal, solve for x, then find y.",
        answer,
        choices: mcChoices(answer, [
          `(${y}, ${x})`,
          `(${x + 1}, ${m1 * (x + 1) + b1})`,
          `(${x - 1}, ${m2 * (x - 1) + b2})`,
          `(0, ${b2})`,
          `(0, ${b1})`,
        ]),
        explanation: `${lin(m1, b1)} = ${lin(m2, b2)} → x = ${x}, and then y = ${evalLin(m1, b1, x)}. They cross at ${answer}.`,
      };
    }),

  substitution: (seeds) =>
    fillToCount("substitution", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(-3, 8);
      const m = randInt(1, 4);
      const b = randInt(-5, 6);
      const a = pick([1, 1, 2, 3]);
      const y = m * x + b;
      const total = a * x + y;
      const askX = i % 2 === 0;
      const system = `y = ${lin(m, b)} and ${coef(a)} + y = ${total}`;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve: ${system}. What is ${askX ? "x" : "y"}?`,
        hint: askX ? `Swap ${lin(m, b)} in for y in the second equation.` : "Find x first, then put it into y = ...",
        answer: askX ? x : y,
        explanation: askX
          ? `${coef(a)} + (${lin(m, b)}) = ${total} → ${lin(a + m, b)} = ${total} → x = ${x}`
          : `x = ${x}, so y = ${evalLin(m, b, x)}`,
      };
    }),

  elimination: (seeds) =>
    fillToCount("elimination", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(1, 10);
      const y = randInt(-4, 9);
      if (i % 5 === 0) {
        const sum = x + y;
        const diff = x - y;
        return {
          id: "",
          type: "step-order",
          prompt: `Order the steps to solve: x + y = ${sum} and x − y = ${diff}`,
          hint: "Adding the equations cancels y.",
          correctOrder: [0, 1, 2, 3],
          steps: [`Add the equations: 2x = ${2 * x}`, `Solve: x = ${x}`, "Put x into the first equation", `Solve for y: y = ${y}`],
          explanation: "Adding the equations cancels y straight away; then x goes back in to find y.",
        };
      }
      // Two coefficients on x, and y cancelling: ax + y and cx − y.
      const a = pick([1, 1, 2, 3]);
      const c = pick([1, 2, 3]);
      const s1 = a * x + y;
      const s2 = c * x - y;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve: ${coef(a)} + y = ${s1} and ${coef(c)} − y = ${s2}. What is x?`,
        hint: "Add the two equations: the y terms cancel.",
        answer: x,
        explanation: `Add them: ${coef(a + c)} = ${s1 + s2} → x = ${x}`,
      };
    }),

  "systems-word-problems": (seeds) =>
    fillToCount("systems-word-problems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const adultPrice = randInt(6, 12);
        const childPrice = adultPrice - randInt(2, 4);
        const adults = randInt(3, 10);
        const children = randInt(3, 10);
        const total = adults + children;
        const cost = adultPrice * adults + childPrice * children;
        return {
          id: "",
          type: "numeric",
          prompt: `Tickets cost $${adultPrice} (adult) and $${childPrice} (child). ${total} tickets sold for $${cost}. How many adult tickets?`,
          hint: "Let a + c = the number of tickets, and write a second equation for the money.",
          answer: adults,
          explanation: `a + c = ${total} and ${adultPrice}a + ${childPrice}c = ${cost}. Put c = ${total} − a in: ${adultPrice}a + ${childPrice}(${total} − a) = ${cost} → ${adultPrice - childPrice}a = ${cost - childPrice * total} → a = ${adults}.`,
        };
      }
      if (kind === 1) {
        const twos = randInt(3, 12);
        const threes = randInt(2, 8);
        const shots = twos + threes;
        const points = 2 * twos + 3 * threes;
        return {
          id: "",
          type: "numeric",
          prompt: `A player made ${shots} baskets, all 2-pointers and 3-pointers, for ${points} points. How many 3-pointers?`,
          hint: "Let t + h = the baskets and write a second equation for the points.",
          answer: threes,
          explanation: `t + h = ${shots} and 2t + 3h = ${points}. Put t = ${shots} − h in: 2(${shots} − h) + 3h = ${points} → h = ${points - 2 * shots}.`,
        };
      }
      const quarters = randInt(2, 12);
      const dimes = randInt(2, 12);
      const coins = quarters + dimes;
      const cents = 25 * quarters + 10 * dimes;
      return {
        id: "",
        type: "numeric",
        prompt: `You have ${coins} coins, all quarters and dimes, worth $${money(cents / 100)}. How many quarters?`,
        hint: "Work in cents: a quarter is 25 and a dime is 10.",
        answer: quarters,
        explanation: `q + d = ${coins} and 25q + 10d = ${cents}. Put d = ${coins} − q in: 25q + 10(${coins} − q) = ${cents} → 15q = ${cents - 10 * coins} → q = ${quarters}.`,
      };
    }),

  "graphing-inequalities": (seeds) =>
    fillToCount("graphing-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = nonZero(-4, 4);
      const b = randInt(-6, 6);
      const sym = pick(["<", ">", "≤", "≥"] as const);
      const strict = sym === "<" || sym === ">";
      const above = sym === ">" || sym === "≥";
      const ineq = `y ${sym} ${lin(m, b)}`;
      if (i % 2 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `${ineq}: solid or dashed boundary line?`,
          hint: strict ? "< and > leave the line itself out." : "≤ and ≥ include the line itself.",
          answer: strict ? "Dashed" : "Solid",
          choices: mcChoices(strict ? "Dashed" : "Solid", ["Solid", "Dashed", "No line"]),
          explanation: `${sym} ${strict ? "leaves out" : "includes"} the points on the line, so the boundary is ${strict ? "dashed" : "solid"}.`,
        };
      }
      return {
        id: "",
        type: "multiple-choice",
        prompt: `To graph ${ineq}, which side of the line do you shade?`,
        hint: "With y by itself, > and ≥ mean above the line, < and ≤ mean below.",
        answer: above ? "Above the line" : "Below the line",
        choices: mcChoices(above ? "Above the line" : "Below the line", ["Above the line", "Below the line", "Only the line itself"]),
        explanation: `The solutions have y-values ${above ? "greater" : "less"} than the line's, so shade ${above ? "above" : "below"} it.`,
      };
    }),

  "compound-inequalities": (seeds) =>
    fillToCount("compound-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const a = randInt(2, 6);
      const c = randInt(1, 10);
      if (kind === 0) {
        const left = randInt(1, 6);
        const right = left + randInt(2, 8);
        const low = a * left + c;
        const high = a * right + c;
        const correct = `${left} < x < ${right}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${low} < ${a}x + ${c} < ${high}`,
          hint: "Subtract the constant from all three parts, then divide all three by the coefficient.",
          answer: correct,
          choices: mcChoices(correct, [`${left - 1} < x < ${right + 1}`, `${left} < x < ${right + 2}`, `x < ${right}`, `${low - c} < x < ${high - c}`]),
          explanation: `${low} < ${a}x + ${c} < ${high} → ${low - c} < ${a}x < ${high - c} → ${correct}`,
        };
      }
      if (kind === 1) {
        // An OR to solve, not one to read back.
        const lo = randInt(-6, -1);
        const hi = randInt(1, 6);
        const correct = `x < ${lo} or x > ${hi}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${a}x + ${c} < ${a * lo + c} OR ${a}x + ${c} > ${a * hi + c}`,
          hint: "Solve each inequality on its own. OR keeps every x that works for either one.",
          answer: correct,
          choices: mcChoices(correct, [`${lo} < x < ${hi}`, `x < ${a * lo} or x > ${a * hi}`, `x > ${hi}`, `x < ${lo}`]),
          explanation: `${a}x < ${a * lo} gives x < ${lo}, and ${a}x > ${a * hi} gives x > ${hi}. OR keeps both: ${correct}.`,
        };
      }
      const left = randInt(-8, 0);
      const right = left + randInt(3, 10);
      const correct = `${left} ≤ x ≤ ${right}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which compound inequality matches: x is between ${left} and ${right}, inclusive?`,
        hint: "Inclusive means use ≤ on both sides.",
        answer: correct,
        choices: mcChoices(correct, [`${left} < x < ${right}`, `x ≤ ${left}`, `x ≥ ${right}`]),
        explanation: `Inclusive between ${left} and ${right} is written ${correct}.`,
      };
    }),

  "systems-inequalities": (seeds) =>
    fillToCount("systems-inequalities", seeds, PROBLEMS_PER_SKILL, () => {
      const m = randInt(1, 6);
      const b = randInt(-6, 8);
      const px = randInt(-3, 4);
      const line = m * px + b;
      // The floor always sits under the line at px, so a point between them exists.
      const floor = Math.min(randInt(-6, 2), line - 1);
      const vy = Math.max(floor + 1, line - randInt(0, 3));
      const valid = `(${px}, ${vy})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which point satisfies y ≤ ${lin(m, b)} AND y > ${floor}?`,
        hint: "Put each point's x and y into both inequalities; it has to pass both.",
        answer: valid,
        choices: mcChoices(valid, [
          `(${px}, ${line + randInt(1, 5)})`,
          `(${px + randInt(1, 4)}, ${floor})`,
          `(${px - randInt(1, 4)}, ${floor - randInt(1, 3)})`,
        ]),
        explanation: `${valid}: ${vy} ≤ ${evalLin(m, b, px)} ✓ and ${vy} > ${floor} ✓`,
      };
    }),

  "function-notation": (seeds) =>
    fillToCount("function-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(1, 5);
      const b = randInt(-6, 8);
      const x = randInt(-4, 6);
      const lead = a === 1 ? "" : `${a}`;
      if (i % 3 === 0) {
        const result = a * x * x + b;
        const worked = b === 0 ? `${lead}(${x})² = ${result}` : `${lead}(${x})²${plusTerm(b)} = ${a * x * x}${plusTerm(b)} = ${result}`;
        return {
          id: "",
          type: "numeric",
          prompt: `If g(x) = ${quad(a, 0, b)}, find g(${x}).`,
          hint: `Put ${x} in for x, in brackets. Square first, then multiply.`,
          answer: result,
          explanation: `g(${x}) = ${worked}`,
        };
      }
      const result = a * x + b;
      return {
        id: "",
        type: "numeric",
        prompt: `If f(x) = ${lin(a, b)}, find f(${x}).`,
        hint: `Put ${x} in for x.`,
        answer: result,
        explanation: `f(${x}) = ${evalLin(a, b, x)}`,
      };
    }),

  "domain-range": (seeds) =>
    fillToCount("domain-range", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const excluded = randInt(1, 20);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = 1/(x − ${excluded})?`,
          hint: "The denominator can never be zero.",
          answer: `All real numbers except ${excluded}`,
          choices: mcChoices(`All real numbers except ${excluded}`, ["All real numbers", `x > ${excluded}`, `x ≥ ${excluded}`]),
          explanation: `x = ${excluded} makes the denominator 0, so it is left out.`,
        };
      }
      if (kind === 1) {
        const excluded = randInt(1, 20);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = 1/(x + ${excluded})?`,
          hint: "Set the denominator equal to zero; that x-value is left out.",
          answer: `All real numbers except ${-excluded}`,
          choices: mcChoices(`All real numbers except ${-excluded}`, [`All real numbers except ${excluded}`, "All real numbers", "x ≠ 0"]),
          explanation: `x = ${-excluded} makes the denominator 0, so it is left out.`,
        };
      }
      if (kind === 2) {
        const boundary = randInt(1, 15);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = √(x − ${boundary})?`,
          hint: "The expression under a square root must be ≥ 0.",
          answer: `x ≥ ${boundary}`,
          choices: mcChoices(`x ≥ ${boundary}`, [`x ≤ ${boundary}`, `x > ${boundary}`, "All real numbers"]),
          explanation: `x − ${boundary} ≥ 0 means x ≥ ${boundary}.`,
        };
      }
      const a = randInt(2, 9);
      const b = randInt(2, 9) + a;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `What is the domain of f(x) = 1/((x − ${a})(x − ${b}))?`,
        hint: "Leave out every x-value that makes any factor of the denominator zero.",
        answer: `All real numbers except ${a} and ${b}`,
        choices: mcChoices(`All real numbers except ${a} and ${b}`, [`All real numbers except ${a}`, `All real numbers except ${b}`, "All real numbers"]),
        explanation: `Both x = ${a} and x = ${b} make a factor of the denominator zero.`,
      };
    }),

  "function-graphs": (seeds) =>
    fillToCount("function-graphs", seeds, PROBLEMS_PER_SKILL, () => {
      const x1 = randInt(-2, 3);
      const dx = randInt(2, 6);
      const x2 = x1 + dx;
      const y1 = randInt(-3, 6);
      const dy = nonZero(-6, 8);
      const y2 = y1 + dy;
      const rate = frac(dy, dx);
      // Wrong answers from real slips: flipped, forgot to subtract, forgot to divide.
      const slips = [frac(dx, dy), x2 !== 0 ? frac(y2, x2) : frac(dy + 1, dx), `${dy}`, `${y2}`, frac(dy + 2, dx), `${y1 + y2}`];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `The graph of a function passes through (${x1}, ${y1}) and (${x2}, ${y2}). What is its average rate of change from x = ${x1} to x = ${x2}?`,
        hint: "Change in y divided by change in x.",
        answer: rate,
        choices: mcChoices(rate, slips),
        explanation: `(${y2} − ${par(y1)}) / (${x2} − ${par(x1)}) = ${dy}/${dx}${`${dy}/${dx}` === rate ? "" : ` = ${rate}`}`,
      };
    }),

  "arithmetic-sequences": (seeds) =>
    fillToCount("arithmetic-sequences", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a1 = randInt(-10, 12);
      const d = pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
      const n = randInt(5, 12);
      const shown = `${a1}, ${a1 + d}, ${a1 + 2 * d}, ${a1 + 3 * d}, ...`;
      if (i % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${shown} What is the ${ordinal(n)} term?`,
          hint: "aₙ = a₁ + (n − 1)d",
          answer: a1 + (n - 1) * d,
          explanation: `a${sub(n)} = ${a1} + ${n - 1}(${d}) = ${a1} ${d < 0 ? "−" : "+"} ${Math.abs((n - 1) * d)} = ${a1 + (n - 1) * d}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `What is the common difference in ${shown}?`,
        hint: "Subtract any term from the one after it.",
        answer: d,
        explanation: `Each term ${d > 0 ? "goes up" : "goes down"} by ${Math.abs(d)}, so d = ${d}.`,
      };
    }),

  "geometric-sequences": (seeds) =>
    fillToCount("geometric-sequences", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 2) {
        // A ratio below 1: each term is half the one before.
        const start = pick([32, 48, 64, 80, 96, 128, 160, 192]);
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${start}, ${start / 2}, ${start / 4}, ${start / 8}, ... What is the common ratio? Give it as a fraction or a decimal.`,
          hint: "Divide any term by the one before it. A fraction like 1/2 is a fine answer.",
          answer: 0.5,
          explanation: `${start / 2} ÷ ${start} = 1/2: each term is half the one before.`,
        };
      }
      const a1 = randInt(1, 6);
      const r = randInt(2, 4);
      const shown = `${a1}, ${a1 * r}, ${a1 * r * r}`;
      if (kind === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${shown}, ... What is the common ratio?`,
          hint: "Divide any term by the one before it.",
          answer: r,
          explanation: `${a1 * r} ÷ ${a1} = ${r}`,
        };
      }
      // A term past the ones shown, so the answer is worked out, not read off.
      const n = r === 4 ? randInt(5, 6) : randInt(5, 7);
      return {
        id: "",
        type: "numeric",
        prompt: `What is the ${ordinal(n)} term of ${shown}, ${a1 * r ** 3}, ...?`,
        hint: "Keep multiplying by the ratio, or use aₙ = a₁ × rⁿ⁻¹.",
        answer: a1 * r ** (n - 1),
        explanation: `a${sub(n)} = ${a1} × ${r}^${n - 1} = ${a1} × ${r ** (n - 1)} = ${a1 * r ** (n - 1)}`,
      };
    }),

  "exponent-rules": (seeds) =>
    fillToCount("exponent-rules", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const base = pick([2, 3, 5, 7, 10, 11]);
      if (kind === 0) {
        let e1 = randInt(2, 9);
        let e2 = randInt(2, 9);
        if (e1 === 2 && e2 === 2) e2 = 3; // 2 + 2 and 2 × 2 are both 4: the wrong rule would pass
        return {
          id: "",
          type: "numeric",
          prompt: `${base}^${e1} × ${base}^${e2} = ${base}^n. What is n?`,
          hint: "Same base, multiplying: add the exponents.",
          answer: e1 + e2,
          explanation: `Same base, so add the exponents: ${e1} + ${e2} = ${e1 + e2}.`,
        };
      }
      if (kind === 1) {
        let exp = randInt(2, 5);
        let outer = randInt(2, 4);
        if (exp === 2 && outer === 2) outer = 3;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify: (x^${exp})^${outer}`,
          hint: "A power of a power: multiply the exponents.",
          answer: `x^${exp * outer}`,
          choices: mcChoices(`x^${exp * outer}`, [`x^${exp + outer}`, `x^${exp}`, `${outer}x^${exp}`, `x^${exp ** outer}`]),
          explanation: `(x^${exp})^${outer} = x^(${exp} × ${outer}) = x^${exp * outer}`,
        };
      }
      if (kind === 2) {
        const e2 = randInt(2, 6);
        const e1 = e2 + randInt(1, 6);
        return {
          id: "",
          type: "numeric",
          prompt: `${base}^${e1} ÷ ${base}^${e2} = ${base}^n. What is n?`,
          hint: "Same base, dividing: subtract the exponents.",
          answer: e1 - e2,
          explanation: `Same base, so subtract the exponents: ${e1} − ${e2} = ${e1 - e2}.`,
        };
      }
      if (kind === 3) {
        const b = randInt(2, 15);
        const withX = randInt(0, 1) === 1;
        return {
          id: "",
          type: "numeric",
          prompt: withX ? `Simplify: (${b}x)^0, for any x other than 0` : `Simplify: ${b}^0`,
          hint: "Any nonzero number to the 0 power equals 1.",
          answer: 1,
          explanation: `${withX ? `(${b}x)` : b}^0 = 1`,
        };
      }
      // A product small enough to work out: the answer stays at or under 1000.
      const small = pick([
        [2, 2, 3], [2, 3, 4], [2, 4, 5], [2, 3, 5], [2, 2, 6], [2, 4, 4], [3, 2, 3], [3, 1, 4], [3, 2, 2], [5, 1, 2], [4, 2, 2], [10, 1, 2],
      ]);
      const [b, e1, e2] = small;
      return {
        id: "",
        type: "numeric",
        prompt: `Simplify ${b}^${e1} × ${b}^${e2}, then write the answer as a number.`,
        hint: "Add the exponents first, then work out the power.",
        answer: b ** (e1 + e2),
        explanation: `${b}^${e1} × ${b}^${e2} = ${b}^${e1 + e2} = ${b ** (e1 + e2)}`,
      };
    }),

  "negative-fractional-exponents": (seeds) =>
    fillToCount("negative-fractional-exponents", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const round = Math.floor(i / 4);
      if (kind === 0) {
        // Small enough to write as a fraction by hand: the denominator stays at or under 1000.
        const [base, exp] = pick([
          [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 1], [3, 2], [3, 3], [4, 1], [4, 2], [4, 3], [5, 1], [5, 2], [5, 3],
          [6, 2], [7, 2], [8, 2], [9, 2], [10, 1], [10, 2], [10, 3], [6, 1], [7, 1], [8, 1], [9, 1], [12, 2],
        ]);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${base}^(-${exp}). Write it as a fraction.`,
          hint: `A negative exponent means one over the power: 1/${base}^${exp}.`,
          answer: 1 / base ** exp,
          explanation: `${base}^(-${exp}) = 1/${base}^${exp} = 1/${base ** exp}`,
        };
      }
      if (kind === 1) {
        const n = [2, 3, 4, 5][round % 4];
        const root = n === 2 ? "√x" : n === 3 ? "³√x" : n === 4 ? "⁴√x" : "⁵√x";
        if (Math.floor(round / 4) % 2 === 0) {
          return {
            id: "",
            type: "multiple-choice",
            prompt: `Rewrite ${root} using a fractional exponent.`,
            hint: "The index of the root becomes the denominator of the exponent.",
            answer: `x^(1/${n})`,
            choices: mcChoices(`x^(1/${n})`, [`x^${n}`, `x^(-${n})`, `${n}x`, `x^(-1/${n})`]),
            explanation: `The index of the root becomes the denominator: ${root} = x^(1/${n}).`,
          };
        }
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Rewrite x^(1/${n}) as a root.`,
          hint: "The denominator of the exponent is the index of the root.",
          answer: root,
          choices: mcChoices(root, ["√x", "³√x", "⁴√x", "⁵√x", `${n}x`, `x^${n}`]),
          explanation: `An exponent of 1/${n} is the ${n === 2 ? "square" : n === 3 ? "cube" : `${ordinal(n)}`} root: x^(1/${n}) = ${root}.`,
        };
      }
      if (kind === 2) {
        const r = randInt(2, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${r * r}^(1/2).`,
          hint: "A power of 1/2 means the square root.",
          answer: r,
          explanation: `${r * r}^(1/2) = √${r * r} = ${r}`,
        };
      }
      const r = randInt(2, 6);
      const cube = r ** 3;
      if (round % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${cube}^(-1/3). Write it as a fraction.`,
          hint: "Take the cube root, then flip it.",
          answer: 1 / r,
          explanation: `${cube}^(-1/3) = 1/³√${cube} = 1/${r}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Evaluate ${cube}^(1/3).`,
        hint: "A power of 1/3 means the cube root.",
        answer: r,
        explanation: `${cube}^(1/3) = ³√${cube} = ${r}`,
      };
    }),

  "scientific-notation": (seeds) =>
    fillToCount("scientific-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      // The coefficient in tenths, so every number here is exact.
      let tenths = randInt(11, 99);
      if (tenths % 10 === 0) tenths += 1;
      const c = fmtNum(tenths / 10);
      if (kind === 0) {
        const exp = randInt(3, 8);
        const number = tenths * 10 ** (exp - 1);
        const correct = `${c} × 10^${exp}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${usNum(number)} in scientific notation.`,
          hint: "Move the decimal point until the number in front is at least 1 and less than 10.",
          answer: correct,
          // Every wrong choice is a different number, not the right one written unscientifically.
          choices: mcChoices(correct, [`${c} × 10^${exp + 1}`, `${c} × 10^${exp - 1}`, `${fmtNum(tenths / 100)} × 10^${exp}`, `${tenths} × 10^${exp}`]),
          explanation: `The decimal point moves ${exp} places left: ${usNum(number)} = ${correct}`,
        };
      }
      if (kind === 1) {
        const exp = randInt(2, 5);
        const digits = String(tenths).replace(/0$/, "");
        const small = `0.${"0".repeat(exp - 1)}${digits}`;
        const correct = `${c} × 10^-${exp}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${small} in scientific notation.`,
          hint: "A number less than 1 gets a negative power of 10: count the places the decimal point moves right.",
          answer: correct,
          choices: mcChoices(correct, [`${c} × 10^${exp}`, `${c} × 10^-${exp + 1}`, `${c} × 10^-${exp - 1}`, `${tenths} × 10^-${exp}`]),
          explanation: `The decimal point moves ${exp} places right: ${small} = ${correct}`,
        };
      }
      const exp = randInt(2, 6);
      const number = tenths * 10 ** (exp - 1);
      return {
        id: "",
        type: "numeric",
        prompt: `Write ${c} × 10^${exp} as a regular number.`,
        hint: `Move the decimal point ${exp} places to the right.`,
        answer: number,
        explanation: `${c} × 10^${exp} = ${usNum(number)}`,
      };
    }),

  "simplifying-radicals": (seeds) =>
    fillToCount("simplifying-radicals", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 3 !== 0) {
        const square = pick([4, 9, 16, 25, 36, 49, 64, 81, 100]);
        const root = Math.sqrt(square);
        // The leftover factor has no square in it, so root√f is fully simplified.
        const f = pick([2, 3, 5, 6, 7, 10, 11, 13, 14, 15]);
        const inside = square * f;
        const answer = rad(root, f);
        // Every wrong choice has a different value from √inside.
        const wrong = [`${square}√${f}`, rad(root + 1, f), rad(root > 2 ? root - 1 : root + 2, f), f !== root ? rad(f, root) : `${root}√${f + 1}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write √${inside} in simplest radical form.`,
          hint: `Find the largest perfect square that divides ${inside}.`,
          answer,
          choices: mcChoices(answer, wrong),
          explanation: `√${inside} = √(${square} × ${f}) = √${square} × √${f} = ${answer}`,
        };
      }
      const r = randInt(2, 15);
      return {
        id: "",
        type: "numeric",
        prompt: `Simplify √${r * r}`,
        hint: "What number times itself gives this?",
        answer: r,
        explanation: `${r} × ${r} = ${r * r}, so √${r * r} = ${r}`,
      };
    }),

  "exponential-functions": (seeds) =>
    fillToCount("exponential-functions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const a = randInt(2, 6);
      let b = randInt(2, 5);
      if (b === a) b = a === 5 ? 3 : a + 1;
      if (kind === 0) {
        const answer = `y = ${a}(${b})^x`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which function starts at ${a} and multiplies by ${b} each time x goes up by 1?`,
          hint: "In y = a(b)^x, a is the starting value and b is what you multiply by.",
          answer,
          choices: mcChoices(answer, [`y = ${b}(${a})^x`, `y = ${lin(a, b)}`, `y = ${lin(b, a)}`, `y = ${a}x^${b}`]),
          explanation: `Start at ${a} and multiply by ${b} each step: ${answer}.`,
        };
      }
      if (kind === 1) {
        const decay = randInt(0, 1) === 1;
        const base = decay ? pick(["0.5", "0.8", "0.25", "0.9"]) : pick(["1.5", "2", "3", "1.2"]);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Is y = ${a}(${base})^x exponential growth or decay?`,
          hint: "Look at the base: more than 1 grows, between 0 and 1 decays.",
          answer: decay ? "Decay" : "Growth",
          choices: mcChoices(decay ? "Decay" : "Growth", ["Growth", "Decay", "Neither"]),
          explanation: `The base is ${base}, which is ${decay ? "between 0 and 1, so it decays" : "more than 1, so it grows"}.`,
        };
      }
      if (kind === 2) {
        return {
          id: "",
          type: "numeric",
          prompt: `What is the starting value (the y-intercept) of y = ${a}(${b})^x?`,
          hint: "Put in x = 0: any base to the 0 power is 1.",
          answer: a,
          explanation: `At x = 0, ${b}^0 = 1, so y = ${a} × 1 = ${a}.`,
        };
      }
      const x = randInt(1, 4);
      return {
        id: "",
        type: "numeric",
        prompt: `Evaluate f(x) = ${a}(${b})^x at x = ${x}.`,
        hint: `Work out ${b}^${x} first, then multiply by ${a}.`,
        answer: a * b ** x,
        explanation: `${a} × ${b}^${x} = ${a} × ${b ** x} = ${a * b ** x}`,
      };
    }),

  "exponential-growth": (seeds) =>
    fillToCount("exponential-growth", seeds, PROBLEMS_PER_SKILL, (i) => {
      const principal = randInt(5, 20) * 100;
      const pct = [3, 4, 5, 6][i % 4];
      const years = randInt(2, 4);
      // Whole-number arithmetic in cents, so a value that ends in half a cent rounds up as it should.
      const cents = Math.round((principal * (100 + pct) ** years) / 100 ** (years - 1));
      const value = cents / 100;
      const factor = (100 + pct) / 100;
      return {
        id: "",
        type: "numeric",
        prompt: `$${principal} invested at ${pct}% annual interest compounded annually. Value after ${years} years? (round to the hundredths place, the nearest cent)`,
        hint: `Use ${principal}(${factor})^${years}`,
        answer: value,
        decimalPlaces: 2,
        explanation: `$${principal} × ${factor}^${years} ≈ $${money(value)}`,
      };
    }),

  "exponential-decay": (seeds) =>
    fillToCount("exponential-decay", seeds, PROBLEMS_PER_SKILL, (i) => {
      const value0 = randInt(10, 30) * 1000;
      const pct = [10, 12, 15, 20][i % 4];
      const years = randInt(1, 3);
      // Exact: whole numbers until the one division, so a value ending in .50 rounds up.
      const exact = (value0 * (100 - pct) ** years) / 100 ** years;
      const rounded = Math.round(exact);
      const factor = (100 - pct) / 100;
      return {
        id: "",
        type: "numeric",
        prompt: `A car worth $${usNum(value0)} loses ${pct}% of its value each year. What is it worth after ${years} ${years === 1 ? "year" : "years"}? (round to the nearest whole dollar)`,
        hint: `Multiply by ${factor} once for each year.`,
        answer: rounded,
        decimalPlaces: 0,
        explanation: `$${usNum(value0)} × ${factor}^${years} = $${money(exact)}, which rounds to $${usNum(rounded)}`,
      };
    }),

  "multiplying-binomials": (seeds) =>
    fillToCount("multiplying-binomials", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const b = randInt(2, 12);
      let c = randInt(2, 12);
      if (b === 2 && c === 2) c = 3; // 2 × 2 = 2 + 2 would turn two wrong choices into the answer
      if (kind === 0) {
        const answer = quad(1, b + c, b * c);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${b})(x + ${c})`,
          hint: "Multiply each term in the first bracket by each term in the second (FOIL).",
          answer,
          choices: mcChoices(answer, [quad(1, b * c, b + c), quad(1, 0, b * c), quad(1, b + c, b + c), quad(1, b * c, b * c)]),
          explanation: `(x + ${b})(x + ${c}) = x² + ${c}x + ${b}x + ${b * c} = ${answer}`,
        };
      }
      if (kind === 1) {
        const answer = quad(1, b - c, -b * c);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${b})(x − ${c})`,
          hint: "FOIL: the last term is a positive times a negative.",
          answer,
          choices: mcChoices(answer, [quad(1, b + c, -b * c), quad(1, b - c, b * c), quad(1, c - b, -b * c), quad(1, 0, -b * c), quad(1, 0, b * c)]),
          explanation: `(x + ${b})(x − ${c}) = x² − ${c}x + ${b}x − ${b * c} = ${answer}`,
        };
      }
      if (kind === 2) {
        const answer = quad(1, -(b + c), b * c);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x − ${b})(x − ${c})`,
          hint: "FOIL: a negative times a negative is positive.",
          answer,
          choices: mcChoices(answer, [quad(1, b + c, b * c), quad(1, -(b + c), -b * c), quad(1, 0, b * c), quad(1, -b * c, b + c)]),
          explanation: `(x − ${b})(x − ${c}) = x² − ${c}x − ${b}x + ${b * c} = ${answer}`,
        };
      }
      const a = randInt(2, 5);
      const answer = quad(a, a * c + b, b * c);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Expand (${a}x + ${b})(x + ${c})`,
        hint: "Multiply each term of the first bracket by each term of the second.",
        answer,
        choices: mcChoices(answer, [quad(a, b + c, b * c), quad(1, a * c + b, b * c), quad(a, a * c + b, b + c), quad(a, a * b + c, b * c)]),
        explanation: `(${a}x + ${b})(x + ${c}) = ${a}x² + ${a * c}x + ${b}x + ${b * c} = ${answer}`,
      };
    }),

  "special-products": (seeds) =>
    fillToCount("special-products", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const n = randInt(3, 16);
      if (kind === 0) {
        const answer = quad(1, 2 * n, n * n);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${n})²`,
          hint: "(a + b)² = a² + 2ab + b²: keep the middle term.",
          answer,
          choices: mcChoices(answer, [quad(1, 0, n * n), quad(1, n, n * n), quad(1, 2 * n, 2 * n), quad(1, n * n, 2 * n)]),
          explanation: `(x + ${n})² = x² + 2(${n})x + ${n}² = ${answer}`,
        };
      }
      if (kind === 1) {
        const answer = quad(1, -2 * n, n * n);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x − ${n})²`,
          hint: "(a − b)² = a² − 2ab + b²: the middle term is negative, the last is positive.",
          answer,
          choices: mcChoices(answer, [quad(1, 0, -n * n), quad(1, -n, n * n), quad(1, 2 * n, n * n), quad(1, -2 * n, -n * n)]),
          explanation: `(x − ${n})² = x² − 2(${n})x + ${n}² = ${answer}`,
        };
      }
      if (kind === 2) {
        const answer = quad(1, 0, -n * n);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${n})(x − ${n})`,
          hint: "A sum times a difference: the middle terms cancel.",
          answer,
          choices: mcChoices(answer, [quad(1, 0, n * n), quad(1, 0, -2 * n), quad(1, 2 * n, -n * n), quad(1, -2 * n, -n * n)]),
          explanation: `(x + ${n})(x − ${n}) = x² − ${n}x + ${n}x − ${n * n} = ${answer}`,
        };
      }
      const a = randInt(2, 5);
      const answer = quad(a * a, 0, -n * n);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Expand (${a}x + ${n})(${a}x − ${n})`,
        hint: "A sum times a difference: square each term and subtract.",
        answer,
        choices: mcChoices(answer, [quad(a, 0, -n * n), quad(a * a, 0, n * n), quad(a * a, 0, -2 * n), quad(a * a, -2 * a * n, -n * n)]),
        explanation: `(${a}x + ${n})(${a}x − ${n}) = (${a}x)² − ${n}² = ${answer}`,
      };
    }),

  "factoring-trinomials": (seeds) =>
    fillToCount("factoring-trinomials", seeds, PROBLEMS_PER_SKILL, (i) => {
      // Roots of either sign; the middle term is never zero (that is a difference of squares).
      let p = i % 2 === 0 ? randInt(1, 12) : nonZero(-9, 9);
      let q = i % 2 === 0 ? randInt(2, 12) : nonZero(-9, 9);
      while (p + q === 0 || p === q) q = q + 1 === 0 ? 2 : q + 1;
      if (p > q) [p, q] = [q, p];
      const b = p + q;
      const c = p * q;
      const answer = `${factor(p)}${factor(q)}`;
      // Wrong pairs, none of which multiplies back out to the trinomial.
      const pairs: [number, number][] = [[-p, -q], [p - 1, q + 1], [p + 1, q - 1], [1, c], [p, -q], [-p, q]];
      const wrong = pairs
        .filter(([u, v]) => u !== 0 && v !== 0 && !(u + v === b && u * v === c))
        .map(([u, v]) => `${factor(Math.min(u, v))}${factor(Math.max(u, v))}`);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Factor ${quad(1, b, c)}`,
        hint: `Find two numbers that multiply to ${c} and add to ${b}.`,
        answer,
        choices: mcChoices(answer, wrong),
        explanation: `${p} × ${par(q)} = ${c} and ${p} + ${par(q)} = ${b}, so ${quad(1, b, c)} = ${answer}.`,
      };
    }),

  "factoring-special": (seeds) =>
    fillToCount("factoring-special", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const n = randInt(2, 20);
      if (kind === 0) {
        const answer = `(x + ${n})(x − ${n})`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor x² − ${n * n}`,
          hint: "A difference of squares: A² − B² = (A + B)(A − B).",
          answer,
          choices: mcChoices(answer, [`(x − ${n})²`, `(x + ${n})²`, `(x + ${n * n})(x − 1)`, "Cannot factor"]),
          explanation: `x² − ${n * n} = x² − ${n}² = ${answer}`,
        };
      }
      if (kind === 1) {
        const answer = `(x + ${n})²`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor x² + ${2 * n}x + ${n * n}`,
          hint: "A perfect square trinomial: A² + 2AB + B² = (A + B)².",
          answer,
          choices: mcChoices(answer, [`(x − ${n})²`, `(x + ${n})(x − ${n})`, `(x + ${2 * n})(x + 1)`]),
          explanation: `${n * n} = ${n}² and ${2 * n} = 2 × ${n}, so x² + ${2 * n}x + ${n * n} = ${answer}`,
        };
      }
      if (kind === 2) {
        const answer = `(x − ${n})²`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor x² − ${2 * n}x + ${n * n}`,
          hint: "A perfect square trinomial: A² − 2AB + B² = (A − B)².",
          answer,
          choices: mcChoices(answer, [`(x + ${n})²`, `(x + ${n})(x − ${n})`, `(x − ${2 * n})(x − 1)`]),
          explanation: `${n * n} = ${n}² and ${2 * n} = 2 × ${n}, with a minus in the middle, so it is ${answer}`,
        };
      }
      const a = randInt(2, 4);
      // a and m share no factor, so the answer is factored all the way.
      let m = n;
      while (gcd(a, m) > 1) m += 1;
      const answer = `(${a}x + ${m})(${a}x − ${m})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Factor ${a * a}x² − ${m * m}`,
        hint: `Write each term as a square: ${a * a}x² = (${a}x)² and ${m * m} = ${m}². Then A² − B² = (A + B)(A − B).`,
        answer,
        choices: mcChoices(answer, [`(${a}x − ${m})²`, `(${a}x + ${m})²`, `(${a * a}x + ${m})(x − ${m})`, "Cannot factor"]),
        explanation: `${a * a}x² − ${m * m} = (${a}x)² − ${m}² = ${answer}`,
      };
    }),

  "graphing-parabolas": (seeds) =>
    fillToCount("graphing-parabolas", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const a = randInt(1, 4) * (randInt(0, 1) === 0 ? -1 : 1);
        const k = randInt(-8, 8);
        const up = a > 0;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Does y = ${quad(a, 0, k)} open up or down?`,
          hint: "Check the sign of a, the number in front of x².",
          answer: up ? "Up" : "Down",
          choices: mcChoices(up ? "Up" : "Down", ["Up", "Down", "Left", "Right"]),
          explanation: `a = ${a} is ${up ? "positive, so it opens up" : "negative, so it opens down"}.`,
        };
      }
      const h = nonZero(-6, 6);
      const k = randInt(-8, 8);
      const vertexForm = `y = (${shift("x", h)})²${plusTerm(k)}`;
      if (kind === 1 || kind === 2) {
        const askX = kind === 1;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the ${askX ? "x" : "y"}-coordinate of the vertex of ${vertexForm}?`,
          hint: "In y = (x − h)² + k the vertex is (h, k). Watch the sign of h.",
          answer: askX ? h : k,
          explanation: `${vertexForm} has vertex (${h}, ${k}).`,
        };
      }
      const b = 2 * nonZero(-6, 6);
      const c = randInt(-9, 9);
      return {
        id: "",
        type: "numeric",
        prompt: `The axis of symmetry of y = ${quad(1, b, c)} is the line x = k. What is k?`,
        hint: "The axis of symmetry is x = −b / (2a).",
        answer: -b / 2,
        explanation: `x = −b / (2a) = −(${b}) / 2 = ${-b / 2}`,
      };
    }),

  "solving-by-factoring": (seeds) =>
    fillToCount("solving-by-factoring", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const r = nonZero(-9, 12);
        let s = nonZero(-9, 12);
        while (s === r || s === -r) s = s + 1 === 0 ? 2 : s + 1;
        const bigger = i % 2 === 0;
        const want = bigger ? Math.max(r, s) : Math.min(r, s);
        const eq = `${quad(1, -(r + s), r * s)} = 0`;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${eq}. What is the ${bigger ? "larger" : "smaller"} root?`,
          hint: `Factor it into two brackets, then set each one equal to 0.`,
          answer: want,
          explanation: `${factor(-r)}${factor(-s)} = 0, so x = ${r} or x = ${s}. The ${bigger ? "larger" : "smaller"} root is ${want}.`,
        };
      }
      if (kind === 1) {
        const n = randInt(2, 15);
        const positive = i % 2 === 1;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve x² − ${n * n} = 0. What is the ${positive ? "positive" : "negative"} root?`,
          hint: "A difference of squares, or add the number to both sides and take the square root.",
          answer: positive ? n : -n,
          explanation: `(x + ${n})(x − ${n}) = 0, so x = ${n} or x = ${-n}.`,
        };
      }
      const r = randInt(1, 10);
      const a = randInt(2, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `Solve x(${a}x − ${a * r}) = 0. What is the nonzero root?`,
        hint: `Set each factor equal to zero: x = 0 or ${a}x − ${a * r} = 0.`,
        answer: r,
        explanation: `x = 0 or ${a}x = ${a * r}, so the nonzero root is ${r}.`,
      };
    }),

  "completing-square": (seeds) =>
    fillToCount("completing-square", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 2;
      const b = randInt(2, 40) * 2;
      const square = (b / 2) ** 2;
      if (kind === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Complete the square: x² + ${b}x + ___ = (x + ${b / 2})²`,
          hint: "Take half of the x coefficient, then square it: (b/2)².",
          answer: `${square}`,
          choices: mcChoices(`${square}`, [`${b}`, `${b / 2}`, `${b * b}`]),
          explanation: `(${b}/2)² = ${b / 2}² = ${square}`,
        };
      }
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Complete the square: x² − ${b}x + ___ = (x − ${b / 2})²`,
        hint: "Take half of the x coefficient, then square it. A square is never negative.",
        answer: `${square}`,
        choices: mcChoices(`${square}`, [`${-b}`, `${b / 2}`, `${b * b}`, `${-square}`]),
        explanation: `(−${b}/2)² = (−${b / 2})² = ${square}`,
      };
    }),

  "quadratic-formula": (seeds) =>
    fillToCount("quadratic-formula", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 3 === 0) {
        // The outcome is chosen first, so 2, 1 and 0 each come up.
        const outcome = pick(["2", "1", "0"] as const);
        let b: number;
        let c: number;
        if (outcome === "2") {
          const r = nonZero(-9, 9);
          let s = nonZero(-9, 9);
          while (s === r) s = nonZero(-9, 9);
          b = -(r + s);
          c = r * s;
        } else if (outcome === "1") {
          const r = nonZero(-9, 9);
          b = -2 * r;
          c = r * r;
        } else {
          b = randInt(-6, 6);
          c = Math.floor((b * b) / 4) + randInt(1, 8);
        }
        const disc = b * b - 4 * c;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `For ${quad(1, b, c)} = 0, how many real solutions?`,
          hint: "Work out the discriminant, b² − 4ac: positive means 2, zero means 1, negative means 0.",
          answer: outcome,
          choices: mcChoices(outcome, ["0", "1", "2", "Infinitely many"]),
          explanation: `b² − 4ac = ${par(b)}² − 4(1)(${c}) = ${disc}, which is ${disc > 0 ? "positive, so there are 2 real solutions" : disc === 0 ? "zero, so there is exactly 1 real solution" : "negative, so there are 0 real solutions"}.`,
        };
      }
      const r = nonZero(-9, 11);
      let s = nonZero(-9, 11);
      while (s === r) s = nonZero(-9, 11);
      const bigger = i % 2 === 0;
      const want = bigger ? Math.max(r, s) : Math.min(r, s);
      return {
        id: "",
        type: "numeric",
        prompt: `Solve ${quad(1, -(r + s), r * s)} = 0. What is the ${bigger ? "larger" : "smaller"} root?`,
        hint: "Factor it, or use x = (−b ± √(b² − 4ac)) / 2a.",
        answer: want,
        explanation: `The roots are x = ${r} and x = ${s}, so the ${bigger ? "larger" : "smaller"} one is ${want}.`,
      };
    }),

  "absolute-value": (seeds) =>
    fillToCount("absolute-value", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const a = randInt(2, 25);
        const positive = i % 8 === 0;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve |x| = ${a}. What is the ${positive ? "positive" : "negative"} solution?`,
          hint: "|x| = a means x = a or x = −a.",
          answer: positive ? a : -a,
          explanation: `x = ${a} or x = ${-a}.`,
        };
      }
      if (kind === 3) {
        // Sometimes there is no solution at all, and sometimes exactly one.
        const h = nonZero(-6, 6);
        const none = i % 8 === 3;
        const rhs = none ? -randInt(1, 9) : 0;
        const answer = none ? "0" : "1";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `How many solutions does |${shift("x", h)}| = ${rhs} have?`,
          hint: "An absolute value is a distance: it can be 0, and it is never negative.",
          answer,
          choices: mcChoices(answer, ["0", "1", "2", "Infinitely many"]),
          explanation: none
            ? `An absolute value can never equal ${rhs}, so there are 0 solutions.`
            : `|${shift("x", h)}| = 0 only when ${shift("x", h)} = 0, so there is exactly 1 solution: x = ${h}.`,
        };
      }
      const h = nonZero(-6, 6);
      const a = randInt(2, 9);
      const x1 = h + a;
      const x2 = h - a;
      const larger = kind === 2;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve |${shift("x", h)}| = ${a}. What is the ${larger ? "larger" : "smaller"} solution?`,
        hint: `Split it: ${shift("x", h)} = ${a} or ${shift("x", h)} = ${-a}.`,
        answer: larger ? x1 : x2,
        explanation: `${shift("x", h)} = ${a} gives x = ${x1}, and ${shift("x", h)} = ${-a} gives x = ${x2}.`,
      };
    }),

  "absolute-value-inequalities": (seeds) =>
    fillToCount("absolute-value-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const a = randInt(3, 20);
      if (kind === 0) {
        const answer = `−${a} < x < ${a}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |x| < ${a}`,
          hint: "Less than a distance means between −a and a.",
          answer,
          choices: mcChoices(answer, [`x < ${a}`, `x > −${a}`, `x < −${a} or x > ${a}`]),
          explanation: `|x| < ${a} means x is within ${a} of 0: ${answer}.`,
        };
      }
      if (kind === 1) {
        const answer = `x < −${a} or x > ${a}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |x| > ${a}`,
          hint: "More than a distance splits into two rays.",
          answer,
          choices: mcChoices(answer, [`−${a} < x < ${a}`, `x > ${a}`, `x < −${a}`]),
          explanation: `|x| > ${a} means x is more than ${a} from 0: ${answer}.`,
        };
      }
      const h = nonZero(-8, 10);
      const x1 = h - a;
      const x2 = h + a;
      const answer = `${x1} ≤ x ≤ ${x2}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Solve |${shift("x", h)}| ≤ ${a}`,
        hint: `Rewrite as −${a} ≤ ${shift("x", h)} ≤ ${a}, then ${h > 0 ? "add" : "subtract"} ${Math.abs(h)} in all three parts.`,
        answer,
        choices: mcChoices(answer, [`${x1 - 1} ≤ x ≤ ${x2 + 1}`, `x ≤ ${x1}`, `x ≥ ${x2}`, `${-a} ≤ x ≤ ${a}`]),
        explanation: `−${a} ≤ ${shift("x", h)} ≤ ${a} → ${answer}`,
      };
    }),

  "piecewise-functions": (seeds) =>
    fillToCount("piecewise-functions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const c = randInt(1, 8);
        const x = randInt(-12, 6);
        const first = x < 0;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { x + ${c} if x < 0; x² if x ≥ 0 }. Find f(${x}).`,
          hint: first ? `${x} < 0, so use the first rule.` : `${x} ≥ 0, so use the second rule.`,
          answer: first ? x + c : x * x,
          explanation: first ? `${x} < 0: f(${x}) = ${x} + ${c} = ${x + c}` : `${x} ≥ 0: f(${x}) = ${par(x)}² = ${x * x}`,
        };
      }
      if (kind === 1) {
        const m = randInt(2, 5);
        const x = randInt(-8, 12);
        const first = x < 0;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { −x if x < 0; ${coef(m)} if x ≥ 0 }. Find f(${x}).`,
          hint: first ? `${x} < 0, so use the first rule.` : `${x} ≥ 0, so use the second rule.`,
          answer: first ? -x : m * x,
          explanation: first ? `${x} < 0: f(${x}) = −(${x}) = ${-x}` : `${x} ≥ 0: f(${x}) = ${m}(${x}) = ${m * x}`,
        };
      }
      const boundary = randInt(1, 6);
      const x = randInt(-6, 10);
      const first = x < boundary;
      const a = randInt(2, 6);
      const b = randInt(1, 10);
      return {
        id: "",
        type: "numeric",
        prompt: `f(x) = { ${a}x if x < ${boundary}; x + ${b} if x ≥ ${boundary} }. Find f(${x}).`,
        hint: first ? `${x} < ${boundary}, so use the first rule.` : `${x} ≥ ${boundary}, so use the second rule.`,
        answer: first ? a * x : x + b,
        explanation: first ? `f(${x}) = ${a}(${x}) = ${a * x}` : `f(${x}) = ${x} + ${b} = ${x + b}`,
      };
    }),
};

function genericNumericGenerator(skillId: string, seeds: PracticeProblem[]): PracticeProblem[] {
  return fillToCount(skillId, seeds, PROBLEMS_PER_SKILL, () => {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const x = randInt(2, 12);
    return {
      id: "",
      type: "numeric",
      prompt: `Solve for x: ${a}x + ${b} = ${a * x + b}`,
      hint: `Subtract ${b}, then divide by ${a}.`,
      answer: x,
      explanation: `${a}x = ${a * x} → x = ${x}`,
    };
  });
}

export function generateProblemBank(
  skillId: string,
  seedProblems: PracticeProblem[] = [],
  /** Vary this to get a different set of problems for the same skill. */
  seed = 0
): PracticeProblem[] {
  return withSeededGeneration((hashString(skillId) ^ seed) >>> 0, () => {
    const generator = generators[skillId];
    const bank = generator ? generator(seedProblems) : genericNumericGenerator(skillId, seedProblems);
    // Hand-written problems keep the order their choices were typed in, which
    // put the answer first on most of them. Shuffled here, from the same seed,
    // so the server rebuilding this bank sees the same order.
    return bank.map((p) =>
      withUniqueChoices(p.type === "multiple-choice" && p.choices ? { ...p, choices: seededShuffle(p.choices) } : p)
    );
  });
}

export function getAllGeneratorSkillIds(): string[] {
  return Object.keys(generators);
}
