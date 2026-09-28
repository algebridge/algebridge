import type { PracticeProblem, Trap } from "@/types";
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
  trapsFor,
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

/**
 * A wrong answer this shape invites, and the slip behind it, written to the
 * student without the right answer in it. Listed on each problem as `traps`
 * (see lib/diagnose.ts); trapsFor drops any that land on the key.
 */
function trap(value: number | string, why: string): Trap {
  return { value, why };
}

/** Why each wrong conversion factor is wrong, in the order the table lists them: upside down, numbers on the wrong units, both. */
const FACTOR_WHY = [
  "That factor is upside down. The unit you are leaving goes on the bottom so it cancels, and the unit you want goes on top.",
  "The numbers are on the wrong units: the bigger number goes with the smaller unit, since it takes many of them to make one of the other.",
  "Both the numbers and the units are switched. The unit you are leaving goes on the bottom, and the bigger number goes with the smaller unit.",
];

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
          traps: trapsFor(miles * 5280, [
            trap(miles / 5280, "Miles are the bigger unit, so the number of feet is bigger, not smaller: each mile holds 5280 feet, so multiply."),
            trap(miles + 5280, "Adding puts miles and feet together as if they were the same unit. Each mile is 5280 feet, so multiply."),
          ]),
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
          traps: trapsFor(even ? feet : rounded, [
            trap(inches * 12, "Inches are the smaller unit, so the number of feet is smaller: every 12 inches make one foot, so divide by 12."),
            trap(inches - 12, "Subtracting 12 takes away one foot's worth of inches. Every 12 inches is a foot, so divide by 12."),
          ]),
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
          traps: trapsFor(km * 1000, [
            trap(km / 1000, "A kilometer is the bigger unit, so there are more meters, not fewer: 1 km = 1000 m, so multiply."),
            trap(km * 100, "Kilo means a thousand. 100 goes with centi: 100 cm in a meter."),
          ]),
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
        traps: trapsFor(f.right, f.wrong.map((w, k) => trap(w, FACTOR_WHY[k]))),
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
          traps: trapsFor(total * 3600, [
            trap(total * 60, "Multiplying by 60 turns hours into minutes. Seconds take another 60: 1 hour = 60 × 60 = 3600 seconds."),
            trap(total / 3600, "Hours are the bigger unit, so the number of seconds is bigger: multiply by 3600."),
          ]),
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
          traps: trapsFor(days * 24, [
            trap(days * 12, "A day has 24 hours, not 12: the clock face goes around twice."),
            trap(days * 60, "60 is minutes in an hour. A day has 24 hours."),
            trap(days * 7, "7 is days in a week. A day has 24 hours."),
            trap(days / 24, "Days are the bigger unit, so the number of hours is bigger: multiply by 24."),
          ]),
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
          traps: trapsFor(kg * 1000, [
            trap(kg * 100, "Kilo means a thousand: 1 kg = 1000 g. 100 goes with centi."),
            trap(kg / 1000, "Kilograms are the bigger unit, so there are more grams, not fewer: multiply by 1000."),
          ]),
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
        traps: trapsFor(minutes * 60000, [
          trap(minutes * 60, "That is seconds. Each second is 1000 milliseconds, so keep going."),
          trap(minutes * 1000, "1000 milliseconds make one second, and a minute is 60 seconds: 60 × 1000 milliseconds per minute."),
        ]),
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
          traps: trapsFor(ml / 1000, [
            trap(ml * 1000, "Milliliters are the smaller unit, so the number of liters is smaller: divide by 1000."),
            trap(ml / 100, "A liter is 1000 mL, not 100."),
          ]),
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
          traps: trapsFor(mpg, [
            trap(gallons / miles, "That is gallons per mile, upside down. Miles per gallon is miles divided by gallons."),
            trap(miles * gallons, "Per means divide: miles per gallon is the miles divided by the gallons."),
            trap(miles - gallons, "Per means divide, not subtract."),
          ]),
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
        traps: trapsFor(speed * hours, [
          trap(speed / hours, "Distance = rate × time. Dividing gives a rate, not a distance."),
          trap(speed + hours, "Distance = rate × time: multiply the speed by the hours."),
        ]),
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
          traps: trapsFor(x, [
            trap(c + a, `The equation adds ${a} to x. To undo adding, subtract ${a} from both sides.`),
            trap(a - c, `x + ${a} = ${c} means x is ${c} with the ${a} taken away, not the other way round.`),
          ]),
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
          traps: trapsFor(x, [
            trap(c - a, `The equation subtracts ${a} from x. To undo subtracting, add ${a} to both sides.`),
            trap(a - c, `x − ${a} = ${c} means x is ${c} with the ${a} put back, so the two are added.`),
          ]),
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
          traps: trapsFor(x, [
            trap(c - a, `${a}x means ${a} times x. Undo multiplying by dividing: ${c} ÷ ${a}.`),
            trap(c + a, `${a}x means ${a} times x, not ${a} plus x. Undo multiplying by dividing both sides by ${a}.`),
            trap(c * a, `${a}x means ${a} times x, so divide by ${a}. Multiplying again goes the wrong way.`),
          ]),
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
        traps: trapsFor(x, [
          trap(
            minusB ? (c - b) / a : (c + b) / a,
            minusB
              ? `The equation subtracts ${b}, so undo it by adding ${b} to both sides first: ${a}x = ${c} + ${b}.`
              : `The equation adds ${b}, so undo it by subtracting ${b} from both sides first: ${a}x = ${c} − ${b}.`
          ),
          trap(a * x, `That is ${a}x, after the ${b} is moved. One step to go: divide both sides by ${a}.`),
          trap(c / a, `Move the ${b} first. Dividing straight away divides only part of the left side.`),
          trap(minusB ? c / a + b : c / a - b, `The ${b} comes off before the dividing: ${a} multiplies only the x, so ${minusB ? "add" : "subtract"} ${b} first and then divide everything by ${a}.`),
        ]),
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
          traps: trapsFor(x, [
            trap(c / a, `That is x + ${b}, after dividing by ${a}. Subtract ${b} to finish.`),
            trap((c - b) / a, `The ${a} multiplies the whole bracket, so it comes off first: divide by ${a}, then subtract ${b}. Or distribute: ${a}x + ${a * b} = ${c}.`),
            trap(c - b, `The ${a} multiplies the whole bracket, so divide by ${a} first, then subtract ${b}. Or distribute: ${a}x + ${a * b} = ${c}.`),
            trap(c / a + b, `x + ${b} = ${c / a}, so x is that with ${b} taken away, not added.`),
          ]),
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
          traps: trapsFor(x, [
            trap((s + q) / k, `Subtracting ${coef(r)} from both sides is right. The ${q} then moves across with its sign changed.`),
            trap((s - q) / (p + r), `Moving ${coef(r)} across the equals sign changes its sign: ${coef(p)} − ${coef(r)}, not ${coef(p)} + ${coef(r)}.`),
          ]),
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
        traps: trapsFor(x, [
          trap((c - d) / a, `That is x − ${b}. Add ${b} to finish.`),
          trap((c - d) / a - b, `x − ${b} = ${(c - d) / a}, so x is that with ${b} added, not taken away.`),
          trap(c - d, `That is ${a}(x − ${b}). Divide by ${a}, then add ${b}.`),
          trap((c + d) / a + b, `The equation adds ${d}, so it is subtracted from both sides first.`),
        ]),
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
        const lcdWhy = (w: number) =>
          w === product
            ? "That is a common denominator, but not the least. Look for the smallest number every denominator divides into."
            : w === Math.max(...set)
              ? "The biggest denominator only works when all the others divide into it evenly. Check each one."
              : w === lcd * 2 || w === lcd * 3
                ? "That is a common denominator, but a smaller one works too. The least common denominator is the smallest."
                : "Check that every denominator divides into it evenly, then look for a smaller one that also works.";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the least common denominator of ${listOf(set.map((d) => `1/${d}`))}?`,
          hint: "Find the smallest number that every denominator divides into evenly.",
          answer: `${lcd}`,
          choices: mcChoices(`${lcd}`, wrong.map(String)),
          traps: trapsFor(`${lcd}`, wrong.map((w) => trap(String(w), lcdWhy(w)))),
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
        traps: trapsFor(x, [
          trap((c - b) / d, `x/${d} means x divided by ${d}. To undo dividing, multiply by ${d}.`),
          trap(c * d - b, `Subtract ${b} before multiplying: the ${b} is not part of the fraction.`),
          trap(c - b, `That is x/${d}. Multiply by ${d} to finish.`),
          trap((c + b) * d, `The equation adds ${b}, so ${b} is subtracted first, then the result is multiplied by ${d}.`),
        ]),
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
          traps: trapsFor(answer, [
            trap(`x ${sym} ${x0}`, `Both sides get divided by ${-a}, a negative number, and that flips the inequality sign.`),
            trap(`x ${flip} ${-x0}`, `The flip is right. Now check the boundary's sign: it comes from dividing ${c - b} by ${-a}.`),
            trap(`x ${sym} ${-x0}`, `Dividing by ${-a} does two things: it flips the inequality sign, and it changes the sign of the number.`),
          ]),
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
          traps: trapsFor(x, [
            trap((boundary + b) / a, `The left side adds ${b}, so undo it by subtracting ${b} from both sides first.`),
            trap(a * x, `That is ${a}x after the ${b} is moved. Divide both sides by ${a}.`),
          ]),
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
        traps: trapsFor(x, [
          trap((boundary - b) / a, `The left side subtracts ${b}, so undo it by adding ${b} to both sides first.`),
          trap(a * x, `That is ${a}x after the ${b} is moved. Divide both sides by ${a}.`),
        ]),
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
          traps: trapsFor(quadrant, [
            trap("Quadrant I", "Quadrant I is where x and y are both positive. Check the signs of this point against that."),
            trap("Quadrant II", "Quadrant II is where x is negative and y is positive. Check the signs of this point against that."),
            trap("Quadrant III", "Quadrant III is where x and y are both negative. Check the signs of this point against that."),
            trap("Quadrant IV", "Quadrant IV is where x is positive and y is negative. Check the signs of this point against that."),
          ]),
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
        traps: trapsFor(askX ? x : y, [
          trap(askX ? y : x, askX ? "That is the second number, the y-coordinate. x comes first in (x, y)." : "That is the first number, the x-coordinate. y comes second in (x, y)."),
        ]),
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
            traps: trapsFor("Undefined", [
              trap("0", "The x-values match, so the run is 0, and the slope is rise ÷ 0. Dividing by 0 is undefined, not 0."),
              trap(`${step}`, "That is the rise on its own. Slope is rise over run, and here the run is 0."),
              trap(`1/${step}`, "Slope is rise over run. The run here is 0, so 0 sits on the bottom of the fraction."),
            ]),
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
          traps: trapsFor("0", [
            trap("Undefined", "Undefined is for a run of 0, a vertical line. Here the y-values match, so it is the rise that is 0, and 0 divided by anything is 0."),
            trap(`${step}`, "That is the run on its own. Slope is rise over run, and the rise here is 0."),
            trap(`${-step}`, "That is the run with a sign on it. Slope is rise over run, and the rise here is 0."),
          ]),
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
        traps: trapsFor(rise / run, [
          trap(run / rise, "That is run over rise. Slope is rise over run: the change in y goes on top."),
          trap(-rise / run, "Subtract in the same order on top and bottom: (y₂ − y₁) over (x₂ − x₁), second point minus first both times."),
          trap(rise, "That is the rise. Divide it by the run."),
          trap(run, "That is the run. Slope is rise over run."),
        ]),
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
          traps: trapsFor(`${b}`, [
            trap(`${m}`, "That is the slope, the number multiplying x. The y-intercept is the number standing on its own."),
            trap(`${-b}`, "Right number, wrong sign. The y-intercept is the constant with the sign it is written with."),
            trap(`${m + b}`, "Adding the slope and the constant mixes two different things. The y-intercept is the constant alone."),
          ]),
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
        traps: trapsFor(m * x + b, [
          trap(m * x, `That is ${m} times ${x}. The ${b < 0 ? `− ${-b}` : `+ ${b}`} still has to go on.`),
          trap(m + x + b, `${coef(m)} means ${m} times x, not ${m} plus x.`),
          x < 0 ? trap(m * -x + b, `x = ${x} is negative: ${m} times ${x} keeps the minus sign.`) : null,
        ]),
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
          traps: trapsFor(k, [
            trap(c, `That is ${coef(a)} after setting y = 0. Divide by ${a}.`),
            trap(c / b, "That is the y-intercept, where x = 0. For the x-intercept, set y = 0 and solve for x."),
          ]),
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
        traps: trapsFor(k, [
          trap(c, `That is ${coef(b, "y")} after setting x = 0. Divide by ${b}.`),
          trap(c / a, "That is the x-intercept, where y = 0. For the y-intercept, set x = 0 and solve for y."),
        ]),
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
        const pairWhy = (pm: number, pb: number) =>
          pm === b && pb === m
            ? "Slope and y-intercept traded places: the slope is the number multiplying x, and the y-intercept stands on its own."
            : pm === -m && pb === -b
              ? "Both signs are off. y = mx + b takes m and b exactly as given."
              : pm === -m
                ? "The slope's sign is off. Keep m exactly as given."
                : pb === -b
                  ? "The y-intercept's sign is off. Keep b exactly as given."
                  : "The slope is right; the constant on the end is not the y-intercept that was given.";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which equation has slope ${m} and y-intercept ${b}?`,
          hint: "Use y = mx + b: m is the slope, b is the y-intercept.",
          answer: eq,
          choices: mcChoices(eq, wrong),
          traps: trapsFor(eq, pairs.map(([pm, pb]) => trap(`y = ${lin(pm, pb)}`, pairWhy(pm, pb)))),
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
          traps: trapsFor(m, [
            trap(b, "That is the y-intercept, the constant standing on its own. The slope is the number multiplying x."),
          ]),
          explanation: `y = ${lin(m, b)} is y = mx + b with m = ${m}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `In y = ${lin(m, b)}, what is the y-intercept?`,
        hint: "The y-intercept is the number added on at the end (0 when there is none).",
        answer: b,
        traps: trapsFor(b, [
          trap(m, "That is the slope, the number multiplying x. The y-intercept is the constant standing on its own."),
        ]),
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
      const whys = [
        "The point's x and y are in each other's places: x₁ goes with x, and y₁ with y.",
        "The slope keeps its sign: y − y₁ = m(x − x₁) with m exactly as given.",
        "The form subtracts the point's coordinates: y − y₁ and x − x₁. Subtracting a negative coordinate turns into a plus.",
        "That treats y₁ as the y-intercept. The point is on the y-axis only when x₁ = 0.",
        "That is slope-intercept form with a number from the point in the wrong place. Point-slope form keeps the point in it.",
      ];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which equation is the line through (${x1}, ${y1}) with slope ${m}, written in point-slope form?`,
        hint: "Use y − y₁ = m(x − x₁), with the point's x and y in their own places.",
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, candidates.map((c, k) => trap(c.text, whys[k]))),
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
      const whys = [
        "When the x term moves across the equals sign, its sign changes.",
        `Dividing every term by ${B} keeps the constant's sign. Check the sign on the constant.`,
        `Every term gets divided by ${B}, the constant ${C} included.`,
        "Slope and y-intercept traded places: the slope is what multiplies x.",
        "Both signs are off: moving the x term across changes its sign, and the constant keeps its own.",
      ];
      const moved = `${coef(B, "y")} = ${lin(-A, C)}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Convert ${twoVar(A, B)} = ${C} to slope-intercept form.`,
        hint: B === 1 ? `Get y by itself: move the x term to the other side.` : `Move the x term to the other side, then divide every term by ${B}.`,
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, pairs.map(([pm, pb], k) => trap(`y = ${lin(pm, pb)}`, whys[k]))),
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
          traps: trapsFor(-bottom / top, [
            trap(top / bottom, "That is the same slope, which makes a parallel line. Perpendicular takes the negative reciprocal: flip it and change its sign."),
            trap(-top / bottom, "The sign changed but the fraction did not flip. Perpendicular slopes are negative reciprocals: both."),
            trap(bottom / top, "The fraction flipped but the sign did not change. Perpendicular slopes are negative reciprocals: both."),
          ]),
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
        const flipped = recip(1, m, nonZero(-9, 9));
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which line is parallel to y = ${lin(m, b)}?`,
          hint: "Parallel lines have the same slope.",
          answer: parallel,
          choices: mcChoices(parallel, [`y = ${lin(-m, b)}`, flipped, recip(-1, m, b), `y = ${lin(m + 1, b2)}`]),
          traps: trapsFor(parallel, [
            trap(`y = ${lin(-m, b)}`, "Opposite slopes are not parallel. Parallel lines have exactly the same slope."),
            trap(flipped, "That slope is the reciprocal, flipped over. Parallel lines have the same slope, not a flipped one."),
            trap(recip(-1, m, b), "That slope is the negative reciprocal, which makes a perpendicular line. Parallel lines have the same slope."),
            trap(`y = ${lin(m + 1, b2)}`, "The slope is off by one. Parallel means exactly the same slope."),
          ]),
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
        traps: trapsFor(answer, [
          trap(frac(1, m1), "Flipped, but the sign did not change. Perpendicular slopes multiply to −1, so the sign changes too."),
          trap(`${-m1}`, "The sign changed, but the slope did not flip. Perpendicular slopes are negative reciprocals: both."),
          trap(`${m1}`, "That is the same slope: parallel, not perpendicular."),
        ]),
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
      const onLine = "That point is on one of the two lines only. The intersection has to satisfy both equations.";
      const onAxis = "That is where one line crosses the y-axis, not where the two lines cross each other.";
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
        traps: trapsFor(answer, [
          trap(`(${y}, ${x})`, "The coordinates are in the wrong order. A point is (x, y): x first."),
          trap(`(${x + 1}, ${m1 * (x + 1) + b1})`, onLine),
          trap(`(${x - 1}, ${m2 * (x - 1) + b2})`, onLine),
          trap(`(0, ${b2})`, onAxis),
          trap(`(0, ${b1})`, onAxis),
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
        traps: trapsFor(askX ? x : y, [
          trap(askX ? y : x, askX ? "That is y. The question asks for x." : `That is x. Put it into y = ${lin(m, b)} to get y.`),
          askX ? trap(total - b, `After swapping ${lin(m, b)} in for y, the x terms combine to ${coef(a + m)}: divide by ${a + m} at the end.`) : null,
        ]),
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
        traps: trapsFor(x, [
          trap(y, "That is y. The question asks for x."),
          trap(s1 + s2, `Adding the equations gives ${coef(a + c)} on the left. Divide by ${a + c} to get x.`),
          trap((s1 - s2) / (a - c || 1), "Subtracting the equations keeps the y terms (y − (−y) = 2y). Adding them is what makes y cancel."),
        ]),
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
          traps: trapsFor(adults, [
            trap(children, "That is the number of child tickets. The question asks for the adult tickets."),
            trap(total, "That is every ticket sold. The question asks for the adults only."),
          ]),
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
          traps: trapsFor(threes, [
            trap(twos, "That is the number of 2-pointers. The question asks for the 3-pointers."),
            trap(shots, "That is every basket. The question asks for the 3-pointers only."),
          ]),
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
        traps: trapsFor(quarters, [
          trap(dimes, "That is the number of dimes. The question asks for the quarters."),
          trap(coins, "That is every coin. The question asks for the quarters only."),
        ]),
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
          traps: trapsFor(strict ? "Dashed" : "Solid", [
            trap("Solid", "< and > leave the line itself out, so their boundary is dashed. Solid is for ≤ and ≥, which include the line."),
            trap("Dashed", "≤ and ≥ include the line itself, so their boundary is solid. Dashed is for < and >."),
            trap("No line", "Every linear inequality has a boundary line. The question is whether it is solid or dashed."),
          ]),
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
        traps: trapsFor(above ? "Above the line" : "Below the line", [
          trap(above ? "Below the line" : "Above the line", "With y alone on the left, > and ≥ mean y-values bigger than the line's, which sit above it; < and ≤ mean below. Read the sign again."),
          trap("Only the line itself", "The line is only the boundary. An inequality's solutions fill a whole side of it."),
        ]),
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
          traps: trapsFor(correct, [
            trap(`${low - c} < x < ${high - c}`, `That is after subtracting ${c} from all three parts. Divide all three parts by ${a} to finish.`),
            trap(`x < ${right}`, "That keeps one end. Both ends of a compound inequality stay."),
            trap(`${left - 1} < x < ${right + 1}`, `The ends are off. Subtract ${c} from all three parts, then divide all three by ${a}.`),
            trap(`${left} < x < ${right + 2}`, `One end is off. Whatever is done to the middle is done to both ends: subtract ${c}, then divide by ${a}.`),
          ]),
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
          traps: trapsFor(correct, [
            trap(`${lo} < x < ${hi}`, "That is the between case. OR keeps everything that works for either inequality: two rays pointing away from each other."),
            trap(`x < ${a * lo} or x > ${a * hi}`, `The ${a} was never divided out: ${a}x < ${a * lo} gives x < ${lo}.`),
            trap(`x > ${hi}`, "That is one of the two. OR keeps both."),
            trap(`x < ${lo}`, "That is one of the two. OR keeps both."),
          ]),
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
        traps: trapsFor(correct, [
          trap(`${left} < x < ${right}`, "Inclusive means the ends themselves count: ≤, not <."),
          trap(`x ≤ ${left}`, "Between two numbers takes both ends: low ≤ x ≤ high."),
          trap(`x ≥ ${right}`, "Between two numbers takes both ends: low ≤ x ≤ high."),
        ]),
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
      const over = `(${px}, ${line + randInt(1, 5)})`;
      const onFloor = `(${px + randInt(1, 4)}, ${floor})`;
      const under = `(${px - randInt(1, 4)}, ${floor - randInt(1, 3)})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which point satisfies y ≤ ${lin(m, b)} AND y > ${floor}?`,
        hint: "Put each point's x and y into both inequalities; it has to pass both.",
        answer: valid,
        choices: mcChoices(valid, [over, onFloor, under]),
        traps: trapsFor(valid, [
          trap(over, `Put its x into ${lin(m, b)}: that point's y comes out bigger than the line's value, so it fails y ≤ ${lin(m, b)}.`),
          trap(onFloor, `y = ${floor} is not greater than ${floor}. The second inequality is strict, so the floor itself is out.`),
          trap(under, `That point's y is below ${floor}, so it fails y > ${floor}. AND means both have to hold.`),
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
          traps: trapsFor(result, [
            trap((a * x) ** 2 + b, `Square x first, then multiply by ${a}: ${lead}(${x})² is ${a} times ${x}², not (${a} × ${x})².`),
            trap(a * x + b, `x is squared in g(x): work out ${par(x)}² before multiplying by ${a}.`),
            x < 0 ? trap(-(a * x * x) + b, `A negative number squared is positive: ${par(x)}² = ${x * x}.`) : null,
            b !== 0 ? trap(a * x * x - b, "The constant keeps the sign it has in g(x).") : null,
          ]),
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
        traps: trapsFor(result, [
          trap(a + x + b, `${coef(a)} means ${a} times x, not ${a} plus x.`),
          trap(a * x, `Add the constant at the end: f(x) = ${lin(a, b)}, the ${b < 0 ? `− ${-b}` : `+ ${b}`} included.`),
          b !== 0 ? trap(a * x - b, "The constant keeps the sign it has in f(x).") : null,
          x < 0 ? trap(a * -x + b, `x = ${x} is negative: ${a} times ${x} is negative.`) : null,
        ]),
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
          traps: trapsFor(`All real numbers except ${excluded}`, [
            trap("All real numbers", "One x-value makes the bottom of the fraction 0, and dividing by 0 is undefined, so that value is out."),
            trap(`x > ${excluded}`, "Only the one value that makes the denominator 0 is left out, not everything below it."),
            trap(`x ≥ ${excluded}`, "A fraction is fine with negative values on the bottom. Only the one value that makes the denominator 0 is out."),
          ]),
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
          traps: trapsFor(`All real numbers except ${-excluded}`, [
            trap(`All real numbers except ${excluded}`, `x + ${excluded} = 0 has to be solved: the sign flips when ${excluded} moves across.`),
            trap("All real numbers", "One x-value makes the bottom of the fraction 0, and dividing by 0 is undefined, so that value is out."),
            trap("x ≠ 0", `It is the whole denominator, x + ${excluded}, that must not be 0, not x alone.`),
          ]),
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
          traps: trapsFor(`x ≥ ${boundary}`, [
            trap(`x ≤ ${boundary}`, `Under a square root the expression must be at least 0: x − ${boundary} ≥ 0 keeps the values on the big side of ${boundary}.`),
            trap(`x > ${boundary}`, `x = ${boundary} makes the inside 0, and √0 = 0 is a fine number, so the boundary itself is included.`),
            trap("All real numbers", "The square root of a negative number is not a real number, so x is limited."),
          ]),
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
        traps: trapsFor(`All real numbers except ${a} and ${b}`, [
          trap(`All real numbers except ${a}`, "Either factor can be 0, and each one gives a value to leave out. That is only one of them."),
          trap(`All real numbers except ${b}`, "Either factor can be 0, and each one gives a value to leave out. That is only one of them."),
          trap("All real numbers", "Each factor of the denominator can be 0, and dividing by 0 is undefined."),
        ]),
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
      const offY = "The change in y is off. Subtract the y-values carefully, keeping the same order as the x-values.";
      const slipWhys = [
        "That is run over rise. A rate of change is the change in y over the change in x.",
        x2 !== 0 ? `Subtract first: (${y2} − ${par(y1)}) over (${x2} − ${par(x1)}), not ${y2} over ${x2}.` : offY,
        "That is the change in y. Divide it by the change in x.",
        "That is a y-value, not a change. Subtract the two y-values, then divide by the change in x.",
        offY,
        "Adding the y-values is not a change. Subtract them, then divide by the change in x.",
      ];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `The graph of a function passes through (${x1}, ${y1}) and (${x2}, ${y2}). What is its average rate of change from x = ${x1} to x = ${x2}?`,
        hint: "Change in y divided by change in x.",
        answer: rate,
        choices: mcChoices(rate, slips),
        traps: trapsFor(rate, slips.map((w, k) => trap(w, slipWhys[k]))),
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
          traps: trapsFor(a1 + (n - 1) * d, [
            trap(a1 + n * d, `The ${ordinal(n)} term is ${n - 1} steps from the first term, not ${n}: the first term already counts as one.`),
            trap(a1 + (n - 2) * d, `One step short: from the 1st term to the ${ordinal(n)} is ${n - 1} steps of ${d}.`),
            trap(a1 + (n - 1) * -d, `The terms ${d > 0 ? "go up" : "go down"} by ${Math.abs(d)} each time, so d is ${d}. Check the sign of d.`),
            trap((n - 1) * d, `${(n - 1) * d} is how far the sequence moves in ${n - 1} steps. It moves from the first term, ${a1}, so add that on.`),
          ]),
          explanation: `a${sub(n)} = ${a1} + ${n - 1}(${d}) = ${a1} ${d < 0 ? "−" : "+"} ${Math.abs((n - 1) * d)} = ${a1 + (n - 1) * d}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `What is the common difference in ${shown}?`,
        hint: "Subtract any term from the one after it.",
        answer: d,
        traps: trapsFor(d, [
          trap(-d, "Subtract the earlier term from the later one: second minus first. The sign says whether the terms go up or down."),
          trap(a1 + d, "That is the second term. The common difference is what gets added to reach it from the first term."),
          trap(a1, "That is the first term, not the gap between terms."),
        ]),
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
          traps: trapsFor(0.5, [
            trap(2, "Divide a term by the one before it: the later term over the earlier one. Each term here is smaller than the last, so the ratio is less than 1."),
            trap(start / 2, "That is the second term. The ratio is what the first term is multiplied by to reach it."),
            trap(start - start / 2, "That is the difference between two terms. A geometric sequence multiplies: divide a term by the one before it."),
          ]),
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
          traps: trapsFor(r, [
            trap(a1 * r - a1, "That is the difference between terms. A geometric sequence multiplies: divide a term by the one before it."),
            trap(a1, "That is the first term, not the ratio between terms."),
            trap(a1 * r, "That is the second term. The ratio is what the first term is multiplied by to reach it."),
          ]),
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
        traps: trapsFor(a1 * r ** (n - 1), [
          trap(a1 * r ** n, `aₙ = a₁ × rⁿ⁻¹: from the first term to the ${ordinal(n)} is ${n - 1} multiplications by ${r}, not ${n}.`),
          trap(a1 * r ** (n - 2), `One multiplication short: the ${ordinal(n)} term is ${n - 1} steps from the first.`),
          trap(a1 * r * (n - 1), `Multiply by ${r} once per step, ${n - 1} times over, not by ${r} × ${n - 1}.`),
          trap(r ** (n - 1), `${r}^${n - 1} is the growth over ${n - 1} steps. The sequence starts at ${a1}, so multiply that by it.`),
        ]),
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
          traps: trapsFor(e1 + e2, [
            trap(e1 * e2, "Multiplying powers of the same base adds the exponents. Multiplying the exponents is for a power of a power."),
            trap(base ** e1 * base ** e2, "The question asks for the exponent n, not the whole product."),
          ]),
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
          traps: trapsFor(`x^${exp * outer}`, [
            trap(`x^${exp + outer}`, "A power of a power multiplies the exponents. Adding them is for a product of powers with the same base."),
            trap(`x^${exp}`, `The outer exponent ${outer} still has to be applied: it multiplies the inner exponent.`),
            trap(`${outer}x^${exp}`, "The outer exponent is not a coefficient in front. It multiplies the inner exponent."),
            trap(`x^${exp ** outer}`, "Multiply the two exponents; do not raise one to the other."),
          ]),
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
          traps: trapsFor(e1 - e2, [
            trap(e1 + e2, "Dividing powers of the same base subtracts the exponents. Adding is for multiplying."),
            trap(e1 / e2, "Subtract the exponents when dividing powers; do not divide the exponents themselves."),
            trap(e2 - e1, "Top exponent minus bottom exponent: the order matters."),
          ]),
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
          traps: trapsFor(1, [
            trap(0, "Any nonzero number to the 0 power is 1, not 0."),
            trap(b, `${b}⁰ is not ${b}. A power of 0 gives 1, whatever the base (as long as it is not 0).`),
          ]),
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
        traps: trapsFor(b ** (e1 + e2), [
          trap(b ** (e1 * e2), "Same base, multiplying: add the exponents, then work out the power. Multiplying the exponents is for a power of a power."),
          trap(e1 + e2, `${e1 + e2} is the new exponent. Now work out ${b}^${e1 + e2} as a number.`),
          trap(b * (e1 + e2), `${b}^${e1 + e2} means ${b} multiplied by itself ${e1 + e2} times, not ${b} × ${e1 + e2}.`),
        ]),
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
          traps: trapsFor(1 / base ** exp, [
            trap(-(base ** exp), "A negative exponent does not make a negative number. It means one over the power: 1/bⁿ."),
            trap(-1 / base ** exp, "A negative exponent flips the power into a fraction, and the fraction stays positive."),
            trap(base * exp, `${base}^${exp} means ${base} multiplied by itself ${exp} times, not ${base} × ${exp}.`),
            trap(base ** exp, "That is the power itself. The negative exponent puts it under 1: one over the power."),
          ]),
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
            traps: trapsFor(`x^(1/${n})`, [
              trap(`x^${n}`, `The index of the root goes in the denominator of the exponent: a ${n} on the bottom, not on top.`),
              trap(`x^(-${n})`, "A root is a fractional exponent, not a negative one. Negative exponents mean one over a power."),
              trap(`${n}x`, "The index of a root is not a coefficient. It becomes the denominator of the exponent."),
              trap(`x^(-1/${n})`, "The exponent is positive. A negative one would mean one over the root."),
            ]),
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
          traps: trapsFor(root, [
            trap(`${n}x`, `An exponent of 1/${n} is a root, not a multiple. The ${n} is the index of the root.`),
            trap(`x^${n}`, `An exponent of 1/${n} is a root, not a power. The denominator ${n} is the index of the root.`),
            ...["√x", "³√x", "⁴√x", "⁵√x"].map((r) => trap(r, `The denominator of the exponent is the index of the root: 1/${n} means the ${n === 2 ? "square" : n === 3 ? "cube" : ordinal(n)} root.`)),
          ]),
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
          traps: trapsFor(r, [
            trap((r * r) / 2, "A power of 1/2 is the square root, not half."),
            trap(r * r * r * r, "A power of 1/2 is the square root, not the square."),
          ]),
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
          traps: trapsFor(1 / r, [
            trap(r, "That is the cube root. The negative exponent then flips it: one over that."),
            trap(-r, "A negative exponent flips the number; it does not make it negative."),
            trap(cube / 3, "A power of 1/3 is the cube root, not a third."),
            trap(-1 / r, "The flip is right, and the fraction stays positive: a negative exponent never adds a minus sign."),
          ]),
          explanation: `${cube}^(-1/3) = 1/³√${cube} = 1/${r}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Evaluate ${cube}^(1/3).`,
        hint: "A power of 1/3 means the cube root.",
        answer: r,
        traps: trapsFor(r, [
          trap(cube / 3, "A power of 1/3 is the cube root, not a third."),
          trap(1 / r, "That is one over the cube root, which a negative exponent would give. This exponent is positive."),
          trap(Math.sqrt(cube), "1/3 is the cube root: the number that multiplies by itself three times to give the base."),
        ]),
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
          traps: trapsFor(correct, [
            trap(`${c} × 10^${exp + 1}`, `The number in front is right. Count the places the decimal point moves to get from ${usNum(number)} to ${c}: that count is the power.`),
            trap(`${c} × 10^${exp - 1}`, `The number in front is right. Count the places the decimal point moves to get from ${usNum(number)} to ${c}: that count is the power.`),
            trap(`${fmtNum(tenths / 100)} × 10^${exp}`, "The number in front has to be at least 1 and less than 10."),
            trap(`${tenths} × 10^${exp}`, "The number in front has to be at least 1 and less than 10."),
          ]),
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
          traps: trapsFor(correct, [
            trap(`${c} × 10^${exp}`, "A number less than 1 takes a negative power of 10: the decimal point moves to the right."),
            trap(`${c} × 10^-${exp + 1}`, `The number in front is right. Count the places the decimal point moves to get from ${small} to ${c}.`),
            trap(`${c} × 10^-${exp - 1}`, `The number in front is right. Count the places the decimal point moves to get from ${small} to ${c}.`),
            trap(`${tenths} × 10^-${exp}`, "The number in front has to be at least 1 and less than 10."),
          ]),
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
        const wrongSquare = `Check the perfect square: ${inside} = (a square number) × ${f}, and the root of that square number comes outside.`;
        const whys = [
          `√(${square} × ${f}) = √${square} × √${f}, and √${square} is the root of ${square}, not ${square} itself.`,
          wrongSquare,
          wrongSquare,
          f !== root ? "The two factors traded places: the perfect square's root comes outside, and the other factor stays inside." : wrongSquare,
        ];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write √${inside} in simplest radical form.`,
          hint: `Find the largest perfect square that divides ${inside}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, wrong.map((w, k) => trap(w, whys[k]))),
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
        traps: trapsFor(r, [
          trap((r * r) / 2, "A square root is not half. It is the number that, times itself, gives what is under the root."),
          trap(r * r * r * r, "That squares the number again. A square root goes the other way."),
        ]),
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
          traps: trapsFor(answer, [
            trap(`y = ${b}(${a})^x`, "The starting value and the multiplier traded places. In y = a(b)^x, a is where it starts and b is what it multiplies by."),
            trap(`y = ${lin(a, b)}`, "That is a line: it adds the same amount each step. This function multiplies each step, so x belongs in the exponent."),
            trap(`y = ${lin(b, a)}`, "That is a line: it adds the same amount each step. This function multiplies each step, so x belongs in the exponent."),
            trap(`y = ${a}x^${b}`, `Multiplying by ${b} each time x goes up by 1 is ${b}^x: x is the exponent, not the base.`),
          ]),
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
          traps: trapsFor(decay ? "Decay" : "Growth", [
            trap(decay ? "Growth" : "Decay", `Look at the base, ${base}: a base more than 1 grows, a base between 0 and 1 decays.`),
            trap("Neither", "A base other than 1 always does one or the other: more than 1 grows, between 0 and 1 decays."),
          ]),
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
          traps: trapsFor(a, [
            trap(a * b, `At x = 0 the power is ${b}⁰ = 1, not ${b}. Multiply ${a} by 1.`),
            trap(b, `${b} is the multiplier. The starting value is the number in front, since ${b}⁰ = 1.`),
            trap(0, "y is never 0 for an exponential function: at x = 0 the power is 1, and the number in front is what is left."),
          ]),
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
        traps: trapsFor(a * b ** x, [
          trap((a * b) ** x, `Only the base ${b} is raised to the power: ${a} × ${b}^${x}, not (${a} × ${b})^${x}.`),
          trap(a * b * x, `${b}^${x} is ${b} multiplied by itself ${x} times, not ${b} × ${x}.`),
          trap(a + b ** x, `The ${a} multiplies ${b}^${x}; it is not added on.`),
        ]),
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
        traps: trapsFor(value, [
          trap(principal * (1 + (pct * years) / 100), `Compound interest multiplies by ${factor} every year: ${factor}^${years}, not ${factor} × ${years} or ${pct}% × ${years}.`),
          trap((principal * pct * years) / 100, "That is interest only, and simple interest at that. The value keeps the principal, and each year's interest is on the new total."),
          trap(principal * (pct / 100) ** years, `The factor is 1 + the rate, ${factor}: the money keeps its whole self and adds ${pct}%.`),
          trap(value - principal, "That is the interest earned. The question asks for the value, principal included."),
        ]),
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
        traps: trapsFor(rounded, [
          trap(Math.round(value0 * (pct / 100) ** years), `The car keeps ${100 - pct}% of its value each year, so the factor is ${factor}, not the ${pct}% it loses.`),
          trap(Math.round(value0 * (1 - (pct * years) / 100)), `Each year takes ${pct}% of what is left, not of the original price: multiply by ${factor} once per year.`),
          trap(Math.round((value0 * pct * years) / 100), "That is what was lost. The question asks what the car is still worth."),
          trap(Math.round(value0 - exact), "That is the value lost. The question asks what is left."),
        ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, b * c, b + c), `The middle and last terms traded places: the outer and inner products (${c}x + ${b}x) make the x term, and ${b} × ${c} is the constant.`),
            trap(quad(1, 0, b * c), `The middle terms got dropped. Outer gives ${c}x and inner gives ${b}x, and they add up.`),
            trap(quad(1, b + c, b + c), `The last term is ${b} times ${c}, not ${b} plus ${c}.`),
            trap(quad(1, b * c, b * c), `The middle term comes from ${c}x + ${b}x. Only the constant is ${b} × ${c}.`),
          ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, b + c, -b * c), `The second bracket subtracts ${c}, so the outer product is −${c}x. The middle term is ${b}x − ${c}x.`),
            trap(quad(1, b - c, b * c), `${b} times −${c} is negative: the constant is −${b * c}.`),
            trap(quad(1, c - b, -b * c), `The middle term's sign: +${b}x from the first bracket's ${b}, and −${c}x from the second's −${c}.`),
            trap(quad(1, 0, -b * c), `The middle terms only cancel when the two numbers match, as in (x + n)(x − n). Here they are ${b}x and −${c}x.`),
            trap(quad(1, 0, b * c), `The middle terms only cancel when the two numbers match. Here they are ${b}x and −${c}x, and the constant is ${b} × (−${c}).`),
          ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, b + c, b * c), `Both brackets subtract, so the middle term is negative: −${c}x − ${b}x.`),
            trap(quad(1, -(b + c), -b * c), `A negative times a negative is positive: (−${b})(−${c}) = +${b * c}.`),
            trap(quad(1, 0, b * c), `The middle terms do not cancel: −${c}x and −${b}x add up.`),
            trap(quad(1, -b * c, b + c), `Middle and last traded places: the x term is −${c}x − ${b}x, and the constant is (−${b})(−${c}).`),
          ]),
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
        traps: trapsFor(answer, [
          trap(quad(a, b + c, b * c), `The outer product is ${a}x × ${c} = ${a * c}x, so the ${a} comes into the middle term: ${a * c}x + ${b}x.`),
          trap(quad(1, a * c + b, b * c), `The first product is ${a}x × x = ${a}x², so the ${a} stays on x².`),
          trap(quad(a, a * c + b, b + c), `The last term is ${b} times ${c}.`),
          trap(quad(a, a * b + c, b * c), `Outer is (${a}x)(${c}) = ${a * c}x and inner is (${b})(x) = ${b}x. The middle term adds those two.`),
        ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, 0, n * n), `(x + ${n})² is not x² + ${n}². Squaring a sum keeps a middle term: 2 × ${n} × x.`),
            trap(quad(1, n, n * n), `The middle term is twice the product: 2 × ${n} × x.`),
            trap(quad(1, 2 * n, 2 * n), `The last term is ${n}², the square of ${n}.`),
            trap(quad(1, n * n, 2 * n), `Middle and last traded places: 2(${n})x in the middle, ${n}² at the end.`),
          ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, 0, -n * n), `(x − ${n})² is not x² − ${n}². It has a middle term, and (−${n})² at the end is positive.`),
            trap(quad(1, -n, n * n), `The middle term is twice the product: −2 × ${n} × x.`),
            trap(quad(1, 2 * n, n * n), `The middle term is negative, from the −${n}: −2(${n})x.`),
            trap(quad(1, -2 * n, -n * n), `(−${n})² is positive: the last term is +${n * n}.`),
          ]),
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
          traps: trapsFor(answer, [
            trap(quad(1, 0, n * n), `A sum times a difference gives x² − ${n}²: the last term is negative, from (${n})(−${n}).`),
            trap(quad(1, 0, -2 * n), `The last term is ${n} × ${n} = ${n}², not 2 × ${n}.`),
            trap(quad(1, 2 * n, -n * n), `The middle terms cancel here: −${n}x + ${n}x = 0.`),
            trap(quad(1, -2 * n, -n * n), `The middle terms cancel here: −${n}x + ${n}x = 0.`),
          ]),
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
        traps: trapsFor(answer, [
          trap(quad(a, 0, -n * n), `(${a}x)² = ${a * a}x²: the ${a} gets squared too.`),
          trap(quad(a * a, 0, n * n), "A sum times a difference: the last term is negative."),
          trap(quad(a * a, 0, -2 * n), `The last term is ${n}², the square of ${n}.`),
          trap(quad(a * a, -2 * a * n, -n * n), `The middle terms cancel: (${a}x)(−${n}) + (${n})(${a}x) = 0.`),
        ]),
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
      const pairWhy = (u: number, v: number) =>
        u === -p && v === -q
          ? `Those two numbers multiply to ${c} but add to ${-b}, not ${b}: the signs are the other way round.`
          : u === 1 && v === c
            ? `1 and ${c} multiply to ${c} but add to ${c + 1}, not ${b}.`
            : (u === p && v === -q) || (u === -p && v === q)
              ? `One sign is off. The pair has to multiply to ${c} and add to ${b} at the same time; check both.`
              : `Those add to ${b} but do not multiply to ${c}. Both conditions have to hold.`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Factor ${quad(1, b, c)}`,
        hint: `Find two numbers that multiply to ${c} and add to ${b}.`,
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(
          answer,
          pairs.filter(([u, v]) => u !== 0 && v !== 0).map(([u, v]) => trap(`${factor(Math.min(u, v))}${factor(Math.max(u, v))}`, pairWhy(u, v)))
        ),
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
          traps: trapsFor(answer, [
            trap(`(x − ${n})²`, `(x − ${n})² multiplies out to x² − ${2 * n}x + ${n * n}: a middle term, and a plus at the end. A difference of squares has neither.`),
            trap(`(x + ${n})²`, `(x + ${n})² multiplies out to x² + ${2 * n}x + ${n * n}: a middle term, and a plus at the end. A difference of squares has neither.`),
            trap(`(x + ${n * n})(x − 1)`, `Multiply that out and the middle terms do not cancel. Take the square root of each term instead: √x² and √${n * n}.`),
            trap("Cannot factor", "Every difference of squares factors: A² − B² = (A + B)(A − B)."),
          ]),
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
          traps: trapsFor(answer, [
            trap(`(x − ${n})²`, `The middle term is +${2 * n}x, so both signs inside the square are plus.`),
            trap(`(x + ${n})(x − ${n})`, `That multiplies out to x² − ${n * n}: no middle term, and a minus. This trinomial has a middle term and +${n * n}.`),
            trap(`(x + ${2 * n})(x + 1)`, `Those numbers add to ${2 * n + 1}, not ${2 * n}, and multiply to ${2 * n}, not ${n * n}.`),
          ]),
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
          traps: trapsFor(answer, [
            trap(`(x + ${n})²`, `The middle term is −${2 * n}x, so the square is of a difference: (x − ${n}).`),
            trap(`(x + ${n})(x − ${n})`, `That has no middle term and a negative constant. This trinomial has a middle term and +${n * n}.`),
            trap(`(x − ${2 * n})(x − 1)`, `Those numbers add to ${2 * n + 1}, not ${2 * n}, and multiply to ${2 * n}, not ${n * n}.`),
          ]),
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
        traps: trapsFor(answer, [
          trap(`(${a}x − ${m})²`, "A squared binomial has a middle term when multiplied out. A difference of squares does not."),
          trap(`(${a}x + ${m})²`, "A squared binomial has a middle term when multiplied out. A difference of squares does not."),
          trap(`(${a * a}x + ${m})(x − ${m})`, `Take the square root of each term: √(${a * a}x²) = ${a}x, not ${a * a}x.`),
          trap("Cannot factor", `It factors: ${a * a}x² − ${m * m} = (${a}x)² − ${m}², a difference of squares.`),
        ]),
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
          traps: trapsFor(up ? "Up" : "Down", [
            trap(up ? "Down" : "Up", "The sign of a, the number in front of x², decides: positive opens up, negative opens down. Check its sign."),
            trap("Left", "A parabola written as y = ... opens up or down. Left and right are for x = ... shapes."),
            trap("Right", "A parabola written as y = ... opens up or down. Left and right are for x = ... shapes."),
          ]),
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
          traps: trapsFor(askX ? h : k, [
            askX
              ? trap(-h, `In y = (x − h)² + k the vertex's x is h, and the sign inside the bracket is the opposite of h: (x + 3)² has h = −3.`)
              : trap(-k, "The vertex's y is k, the number added at the end, with the sign it is written with."),
            askX ? trap(k, "That is the y-coordinate of the vertex, the number added at the end. The x-coordinate comes from inside the bracket.") : trap(h, "That comes from inside the bracket, which gives the x-coordinate. The vertex's y is the number added at the end."),
            askX ? trap(-k, "That is the y-coordinate of the vertex with its sign flipped. The x-coordinate comes from inside the bracket.") : trap(-h, "That comes from inside the bracket, which gives the x-coordinate. The vertex's y is the number added at the end."),
          ]),
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
        traps: trapsFor(-b / 2, [
          trap(b / 2, "x = −b / (2a): the minus sign in front of b matters."),
          trap(-b, "That is −b. Divide it by 2a, which is 2 here."),
          trap(b, "That is b itself. The axis is at x = −b / (2a)."),
          trap(c, "c is where the parabola crosses the y-axis, not its axis of symmetry."),
        ]),
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
          traps: trapsFor(want, [
            trap(bigger ? Math.min(r, s) : Math.max(r, s), `That is the other root. The question asks for the ${bigger ? "larger" : "smaller"} one.`),
            trap(-want, "A factor (x − r) is 0 when x = r: the root has the opposite sign from the number inside the bracket."),
            trap(bigger ? -Math.min(r, s) : -Math.max(r, s), "That is the other root with its sign flipped. A factor (x − r) is 0 when x = r."),
          ]),
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
          traps: trapsFor(positive ? n : -n, [
            trap(positive ? -n : n, `That is the other root. The question asks for the ${positive ? "positive" : "negative"} one.`),
            trap(n * n, `That is x². Take the square root: x² = ${n * n} has two roots, one of each sign.`),
            trap((n * n) / 2, "Halving is not a square root. Which number times itself gives the constant?"),
          ]),
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
        traps: trapsFor(r, [
          trap(0, "0 is one root, and the question asks for the other one: set the bracket equal to 0."),
          trap(a * r, `${a}x − ${a * r} = 0 gives ${a}x = ${a * r}. Divide by ${a} to finish.`),
          trap(-r, `${a}x − ${a * r} = 0 means ${a}x = +${a * r}, so the root is positive.`),
        ]),
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
          traps: trapsFor(`${square}`, [
            trap(`${b}`, `Half of ${b} first, then square it: (${b}/2)².`),
            trap(`${b / 2}`, `Half of ${b} is ${b / 2}. Now square it.`),
            trap(`${b * b}`, `Square half of ${b}, not ${b} itself: (${b}/2)².`),
          ]),
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
        traps: trapsFor(`${square}`, [
          trap(`${-b}`, `Half of −${b}, then squared: (−${b / 2})². A square is never negative.`),
          trap(`${b / 2}`, `Half of ${b} is ${b / 2}. Now square it.`),
          trap(`${b * b}`, `Square half of the coefficient, not the whole thing: (−${b}/2)².`),
          trap(`${-square}`, `(−${b / 2})² is positive: a negative times a negative.`),
        ]),
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
          traps: trapsFor(outcome, [
            trap("Infinitely many", "A quadratic equation has at most 2 real solutions."),
            ...["0", "1", "2"].map((o) => trap(o, `Work out b² − 4ac with b = ${b} and c = ${c}, then read its sign: negative means 0 solutions, zero means 1, positive means 2.`)),
          ]),
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
        traps: trapsFor(want, [
          trap(bigger ? Math.min(r, s) : Math.max(r, s), `That is the other root. The question asks for the ${bigger ? "larger" : "smaller"} one.`),
          trap(-want, "A factor (x − r) is 0 when x = r: the root has the opposite sign from the number inside the bracket."),
          trap(r + s, `${r + s} is the sum of the two roots (that is −b). The question asks for one root.`),
        ]),
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
          traps: trapsFor(positive ? a : -a, [
            trap(positive ? -a : a, `That is the other solution. |x| = ${a} has two, one of each sign, and the question asks for the ${positive ? "positive" : "negative"} one.`),
          ]),
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
          traps: trapsFor(answer, [
            trap("Infinitely many", "An absolute value equation has at most two solutions."),
            ...(none
              ? [
                  trap("1", "An absolute value is a distance, so it is never negative. Can it equal the number on the right?"),
                  trap("2", "Two solutions is for a positive right side. Here the right side is negative, and an absolute value is never negative."),
                ]
              : [
                  trap("0", `|${shift("x", h)}| = 0 does have a solution: the one x that makes the inside 0.`),
                  trap("2", "Only one number has an absolute value of 0, so a right side of 0 gives one solution, not two."),
                ]),
          ]),
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
        traps: trapsFor(larger ? x1 : x2, [
          trap(larger ? x2 : x1, `That is the other solution. Split it into two equations and pick the ${larger ? "larger" : "smaller"} result.`),
          trap(a, `${a} is the right side. Solve ${shift("x", h)} = ${a} and ${shift("x", h)} = ${-a} for x.`),
          trap(-a, `${-a} is one right side. Solve ${shift("x", h)} = ${-a} for x.`),
          trap(h, `${h} is the number that makes the inside 0, not a solution. Solve ${shift("x", h)} = ${a} and ${shift("x", h)} = ${-a}.`),
          trap(-h, `Solve ${shift("x", h)} = ${a} and ${shift("x", h)} = ${-a}: the number inside the bracket moves across with its sign changed.`),
        ]),
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
          traps: trapsFor(answer, [
            trap(`x < ${a}`, `That is half of it. |x| < ${a} also rules out the numbers below −${a}: the answer is between two values.`),
            trap(`x > −${a}`, `That is half of it. |x| < ${a} also rules out the numbers above ${a}: the answer is between two values.`),
            trap(`x < −${a} or x > ${a}`, "That is the greater-than case. Less than a distance means between, one stretch with two ends."),
          ]),
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
          traps: trapsFor(answer, [
            trap(`−${a} < x < ${a}`, "That is the less-than case. More than a distance means outside: two rays pointing away from each other."),
            trap(`x > ${a}`, `That is one ray. |x| > ${a} is true on both sides of 0, so there are two.`),
            trap(`x < −${a}`, `That is one ray. |x| > ${a} is true on both sides of 0, so there are two.`),
          ]),
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
        traps: trapsFor(answer, [
          trap(`${-a} ≤ x ≤ ${a}`, `That is −${a} ≤ ${shift("x", h)} ≤ ${a} with the ${Math.abs(h)} never moved across. ${h > 0 ? "Add" : "Subtract"} ${Math.abs(h)} in all three parts.`),
          trap(`x ≤ ${x1}`, "That is one end. Keep both."),
          trap(`x ≥ ${x2}`, "That is one end. Keep both."),
          trap(`${x1 - 1} ≤ x ≤ ${x2 + 1}`, `The ends are off by one. Rewrite as −${a} ≤ ${shift("x", h)} ≤ ${a}, then ${h > 0 ? "add" : "subtract"} ${Math.abs(h)} in all three parts.`),
        ]),
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
          traps: trapsFor(first ? x + c : x * x, [
            trap(first ? x * x : x + c, first ? `${x} is less than 0, so the first rule (x + ${c}) is the one to use, not x².` : `${x} is not less than 0, so the second rule (x²) is the one to use, not x + ${c}.`),
            first ? null : trap(2 * x, "x² is x times x, not 2x."),
          ]),
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
          traps: trapsFor(first ? -x : m * x, [
            trap(first ? m * x : -x, first ? `${x} is less than 0, so the first rule (−x) is the one to use, not ${coef(m)}.` : `${x} is not less than 0, so the second rule (${coef(m)}) is the one to use, not −x.`),
            first ? trap(x, `−x with x = ${x} is −(${x}), which flips the sign.`) : null,
          ]),
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
        traps: trapsFor(first ? a * x : x + b, [
          trap(first ? x + b : a * x, first ? `${x} is less than ${boundary}, so the first rule (${coef(a)}) is the one to use, not x + ${b}.` : `${x} is not less than ${boundary}, so the second rule (x + ${b}) is the one to use, not ${coef(a)}.`),
          first ? trap(a + x, `${coef(a)} means ${a} times x, not ${a} plus x.`) : null,
        ]),
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
