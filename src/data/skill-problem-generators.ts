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

/** Two different ones of these. */
function pickTwo<T>(items: readonly T[]): [T, T] {
  const first = randInt(0, items.length - 1);
  let second = randInt(0, items.length - 2);
  if (second >= first) second += 1;
  return [items[first], items[second]];
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

/** a − b as a step of working: "5 − (-3)", or just "5" when b is 0. */
function less(a: number, b: number): string {
  return b === 0 ? `${a}` : `${a} − ${par(b)}`;
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

/** A fraction times x, the way a textbook writes it: (−2, 3) → "-(2/3)x", (4, 2) → "2x". */
function fracX(n: number, d: number): string {
  const g = gcd(n, d);
  const [top, bottom] = [n / g, d / g];
  if (bottom === 1 || bottom === -1) return coef(top * bottom);
  const neg = top * bottom < 0;
  return `${neg ? "-" : ""}(${Math.abs(top)}/${Math.abs(bottom)})x`;
}

/** A monomial with caret powers: (4, 10) → "4x^10", (1, 1) → "x", (3, 2, 1) → "3x^2y", (3, 2, 2) → "3x^2y^2". */
function mono(c: number, xe: number, ye = 0): string {
  const x = xe === 0 ? "" : xe === 1 ? "x" : `x^${xe}`;
  const y = ye === 0 ? "" : ye === 1 ? "y" : `y^${ye}`;
  const body = `${x}${y}`;
  if (!body) return `${c}`;
  return `${c === 1 ? "" : c === -1 ? "-" : c}${body}`;
}

/** A polynomial from its coefficients, highest power first: [1, -1, -5, 2] → "x³ − x² − 5x + 2". */
function poly(coeffs: number[]): string {
  const POW = ["", "", "²", "³", "⁴"];
  const top = coeffs.length - 1;
  let out = "";
  coeffs.forEach((c, k) => {
    const deg = top - k;
    if (c === 0) return;
    const v = deg === 0 ? "" : `x${POW[deg]}`;
    if (!out) out = deg === 0 ? fmtNum(c) : coef(c, v);
    else out += plusTerm(c, v);
  });
  return out || "0";
}

/** n whole numbers in [lo, hi], sorted; all different when `distinct`. */
function sortedData(n: number, lo: number, hi: number, distinct = false): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = randInt(lo, hi);
    if (distinct && out.includes(v)) continue;
    out.push(v);
  }
  return out.sort((a, b) => a - b);
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

/** First names for word problems, picked with the seeded generator. */
const NAMES = ["Maya", "Jordan", "Kai", "Ava", "Leo", "Zoe", "Sam", "Nia", "Eli", "Rosa", "Omar", "Lena"] as const;

const generators: Record<string, SkillGenerator> = {
  "unit-basics": (seeds) =>
    fillToCount("unit-basics", seeds, PROBLEMS_PER_SKILL, (i) => {
      // Seven kinds. A quick card on which way a factor goes, a plain
      // conversion, and five that take a conversion and then a question:
      // what is left, how many fit, how fast.
      const kind = i % 7;
      if (kind === 1) {
        // Part of a trail walked, in feet; the rest of it, from miles.
        const quarters = pick([5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19]);
        const miles = quarters / 4;
        const total = quarters * 1320;
        const walked = randInt(4, Math.floor(total / 1000) - 1) * 1000 + pick([0, 250, 500, 750]);
        const left = total - walked;
        return {
          id: "",
          type: "numeric",
          prompt: `A hiking trail is ${fmtNum(miles)} miles long. You have walked ${usNum(walked)} feet of it. How many feet are left? (1 mile = 5,280 ft)`,
          hint: "Change the trail's length to feet first, so both numbers are in the same unit. Then subtract.",
          answer: left,
          traps: trapsFor(left, [
            trap(total, "That is the whole trail in feet. Take away the part already walked."),
            trap(Math.floor(miles) * 5280 - walked, `The part of a mile counts too: ${fmtNum(miles - Math.floor(miles))} of a mile is ${usNum((miles - Math.floor(miles)) * 5280)} feet.`),
            trap(miles - walked, "Miles and feet are different units. Change the miles to feet before subtracting."),
          ]),
          explanation: `${fmtNum(miles)} mi × 5,280 ft/mi = ${usNum(total)} ft → ${usNum(total)} − ${usNum(walked)} = ${usNum(left)} ft left`,
        };
      }
      if (kind === 2) {
        // A rug in feet, its area in square yards: a square yard is 9 square feet.
        const p = randInt(2, 6);
        let q = randInt(2, 7);
        if (q === p) q += 1;
        const [a, b] = [3 * p, 3 * q];
        return {
          id: "",
          type: "numeric",
          prompt: `A rug is ${a} feet long and ${b} feet wide. What is its area in square yards? (1 yard = 3 feet)`,
          hint: "Change each side to yards first, then multiply. Or find the area in square feet and remember a square yard is 3 ft by 3 ft.",
          answer: p * q,
          traps: trapsFor(p * q, [
            trap(a * b, "That is the area in square feet. Each square yard holds 3 × 3 = 9 of them."),
            trap((a * b) / 3, "A square yard is 3 feet by 3 feet, so it holds 9 square feet, not 3."),
            trap((a + b) / 3, "Area multiplies the length by the width. Adding them gives half the distance around the rug."),
          ]),
          explanation: `${a} ft = ${p} yd and ${b} ft = ${q} yd → ${p} × ${q} = ${p * q} square yards`,
        };
      }
      if (kind === 3) {
        const laps = pick([3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17]);
        const km = (laps * 400) / 1000;
        return {
          id: "",
          type: "numeric",
          prompt: `One lap of a running track is 400 meters. You run ${laps} laps. How many kilometers is that? Write your answer as a decimal.`,
          hint: "Find the meters first, then change meters to kilometers: 1 km = 1,000 m.",
          answer: km,
          traps: trapsFor(km, [
            trap(laps * 400, "That is the distance in meters. A kilometer is 1,000 meters, so divide by 1,000."),
            trap((laps * 400) / 100, "A kilometer is 1,000 meters, not 100."),
            trap(laps / 400, `Each lap is 400 meters, so the meters are ${laps} × 400. Then change them to kilometers.`),
          ]),
          explanation: `${laps} × 400 m = ${usNum(laps * 400)} m → ${usNum(laps * 400)} ÷ 1,000 = ${fmtNum(km)} km`,
        };
      }
      if (kind === 4) {
        const mph = randInt(8, 25);
        return {
          id: "",
          type: "numeric",
          prompt: `A cyclist rides at ${mph} miles per hour. How many feet per minute is that? (1 mile = 5,280 ft)`,
          hint: "Two factors: miles to feet on top, then hours to minutes. Multiply by 5,280, then divide by 60.",
          answer: mph * 88,
          traps: trapsFor(mph * 88, [
            trap(mph * 5280, "That is feet per hour. An hour has 60 minutes, so divide by 60 as well."),
            trap(mph * 5280 * 60, "A minute is shorter than an hour, so fewer feet go by in it: divide by 60."),
            trap((mph * 5280) / 3600, "Dividing by 3,600 gives feet per second. A minute is 60 seconds' worth."),
          ]),
          explanation: `${mph} mi/h × 5,280 ft/mi = ${usNum(mph * 5280)} ft/h → ${usNum(mph * 5280)} ÷ 60 = ${usNum(mph * 88)} ft per minute`,
        };
      }
      if (kind === 5) {
        // Bottles filled from a cooler: liters to milliliters, then divide.
        const ml = pick([250, 400, 500, 600, 750]);
        const liters = ml === 750 || ml === 600 ? 3 * randInt(1, 5) : ml === 400 ? 2 * randInt(2, 8) : randInt(3, 15);
        const bottles = (liters * 1000) / ml;
        return {
          id: "",
          type: "numeric",
          prompt: `A cooler holds ${liters} liters of water. How many ${ml}-milliliter bottles can you fill from it? (1 L = 1,000 mL)`,
          hint: "Change the cooler to milliliters first, so both amounts are in the same unit. Then divide by one bottle.",
          answer: bottles,
          traps: trapsFor(bottles, [
            trap(liters * 1000, "That is the whole cooler in milliliters. Divide it by the size of one bottle."),
            trap(liters / ml, "Change liters to milliliters first: the cooler and the bottle have to be in the same unit."),
            trap((liters * 100) / ml, "A liter is 1,000 milliliters, not 100."),
          ]),
          explanation: `${liters} L × 1,000 mL/L = ${usNum(liters * 1000)} mL → ${usNum(liters * 1000)} ÷ ${ml} = ${bottles} bottles`,
        };
      }
      if (kind === 6) {
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
      // Twelve kinds, so a session rarely meets the same one twice (a student
      // wrote in that questions kept coming back with only the numbers changed).
      const kind = i % 12;
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
        const days = randInt(2, 10);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${days} days to minutes.`,
          hint: "Two factors: 1 day = 24 hours, and 1 hour = 60 minutes.",
          answer: days * 1440,
          traps: trapsFor(days * 1440, [
            trap(days * 24, "That is hours. Each hour is 60 minutes, so multiply by 60 too."),
            trap(days * 60, "That skips the hours: a day is 24 hours, and each hour is 60 minutes."),
            trap(days * 12 * 60, "A day has 24 hours, not 12: the clock face goes around twice."),
            trap(days * 86400, "That goes one factor too far, all the way to seconds."),
          ]),
          explanation: `${days} days × 24 h/day = ${days * 24} h → ${days * 24} h × 60 min/h = ${usNum(days * 1440)} minutes`,
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
        const kg = randInt(2, 20);
        const bags = pick([4, 5, 8, 10, 20, 25]);
        const each = (kg * 1000) / bags;
        return {
          id: "",
          type: "numeric",
          prompt: `A ${kg}-kilogram sack of rice is split evenly into ${bags} bags. How many grams go in each bag?`,
          hint: "Change the sack to grams first (1 kg = 1,000 g), then share it out.",
          answer: each,
          traps: trapsFor(each, [
            trap(kg / bags, "That is kilograms per bag. Multiply by 1,000 to get grams."),
            trap(kg * 1000, `That is the whole sack in grams. Share it into ${bags} bags: divide.`),
            trap((kg * 100) / bags, "Kilo means a thousand: 1 kg = 1,000 g, not 100."),
          ]),
          explanation: `${kg} kg × 1,000 g/kg = ${usNum(kg * 1000)} g → ${usNum(kg * 1000)} ÷ ${bags} = ${usNum(each)} grams per bag`,
        };
      }
      if (kind === 5) {
        const cans = randInt(6, 24);
        const grams = pick([250, 300, 400, 425, 450, 500]);
        const kg = (cans * grams) / 1000;
        const whole = Number.isInteger(kg);
        return {
          id: "",
          type: "numeric",
          prompt: `A box holds ${cans} cans of beans, and each can weighs ${grams} grams. How many kilograms of beans are in the box?${whole ? "" : " Write your answer as a decimal."}`,
          hint: "Find the grams in the whole box first, then change grams to kilograms: 1,000 g = 1 kg.",
          answer: kg,
          traps: trapsFor(kg, [
            trap(cans * grams, "That is the box in grams. Divide by 1,000 to get kilograms."),
            trap((cans * grams) / 100, "A kilogram is 1,000 grams, not 100."),
            trap(grams / 1000, "That is one can. The box holds all of them."),
          ]),
          explanation: `${cans} × ${grams} g = ${usNum(cans * grams)} g → ${usNum(cans * grams)} ÷ 1,000 = ${fmtNum(kg)} kilograms`,
        };
      }
      if (kind === 6) {
        const weeks = randInt(2, 8);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${weeks} weeks to hours.`,
          hint: "Two steps: 1 week = 7 days, and 1 day = 24 hours.",
          answer: weeks * 168,
          traps: trapsFor(weeks * 168, [
            trap(weeks * 7, "That is days. Each day has 24 hours, so multiply by 24 too."),
            trap(weeks * 24, "That skips the days: a week is 7 days, and each day is 24 hours."),
          ]),
          explanation: `${weeks} weeks × 7 days/week × 24 hours/day = ${weeks * 168} hours`,
        };
      }
      if (kind === 7) {
        const k = randInt(1, 6);
        const kmh = 18 * k;
        return {
          id: "",
          type: "numeric",
          prompt: `A cyclist rides at ${kmh} kilometers per hour. How many meters per second is that?`,
          hint: "Two factors: 1 km = 1000 m, and 1 hour = 3600 seconds. Multiply by 1000, then divide by 3600.",
          answer: 5 * k,
          traps: trapsFor(5 * k, [
            trap(kmh * 1000, "That is meters per hour. An hour is 3600 seconds, so divide by 3600 as well."),
            trap(300 * k, "That divides by 60, which gives meters per minute. An hour is 3600 seconds."),
          ]),
          explanation: `${kmh} km/h × 1000 m/km ÷ 3600 s/h = ${5 * k} meters per second`,
        };
      }
      if (kind === 8) {
        const cm = 5 * randInt(2, 19);
        const perMinute = (cm * 60) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `A toy car rolls ${cm} centimeters per second. How many meters per minute is that?`,
          hint: "Two factors: 60 seconds in a minute, and 100 centimeters in a meter.",
          answer: perMinute,
          traps: trapsFor(perMinute, [
            trap(cm * 60, "That is centimeters per minute. Divide by 100 to get meters."),
            trap(cm / 100, "That is meters per second. A minute is 60 seconds, so multiply by 60."),
            trap((cm * 60) / 1000, "A meter is 100 centimeters, not 1,000."),
          ]),
          explanation: `${cm} cm/s × 60 s/min = ${usNum(cm * 60)} cm/min → ${usNum(cm * 60)} ÷ 100 = ${fmtNum(perMinute)} meters per minute`,
        };
      }
      if (kind === 9) {
        const step = randInt(1, 8);
        const liters = 3 * step;
        return {
          id: "",
          type: "numeric",
          prompt: `A water tank leaks ${liters} liters per hour. How many milliliters per minute is that?`,
          hint: "Two factors: 1 L = 1000 mL, and 1 hour = 60 minutes. Multiply by 1000, then divide by 60.",
          answer: 50 * step,
          traps: trapsFor(50 * step, [
            trap(liters * 1000, "That is milliliters per hour. An hour is 60 minutes, so divide by 60 as well."),
            trap(liters * 60000, "Minutes are shorter than hours, so less leaks per minute: divide by 60, not multiply."),
          ]),
          explanation: `${liters} L/h × 1000 mL/L ÷ 60 min/h = ${50 * step} milliliters per minute`,
        };
      }
      if (kind === 10) {
        const yards = randInt(2, 30);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${yards} yards to inches.`,
          hint: "Two steps: 1 yard = 3 feet, and 1 foot = 12 inches.",
          answer: yards * 36,
          traps: trapsFor(yards * 36, [
            trap(yards * 3, "That is feet. Each foot is 12 inches, so multiply by 12 too."),
            trap(yards * 12, "That skips the feet: a yard is 3 feet, and each foot is 12 inches."),
          ]),
          explanation: `${yards} yd × 3 ft/yd × 12 in/ft = ${yards * 36} inches`,
        };
      }
      if (kind === 11) {
        const song = pick([150, 180, 200, 225, 240]);
        const hours = randInt(1, 3);
        const songs = (hours * 3600) / song;
        return {
          id: "",
          type: "numeric",
          prompt: `Every song on a playlist is ${song} seconds long. How many songs fit in ${hours === 1 ? "1 hour" : `${hours} hours`}?`,
          hint: "Change the hours to seconds first (1 hour = 3,600 seconds), then divide by one song.",
          answer: songs,
          traps: trapsFor(songs, [
            trap(hours * 3600, "That is the playlist in seconds. Divide by the length of one song."),
            trap(Math.round(((hours * 60) / song) * 100) / 100, "An hour is 3,600 seconds, not 60. Change hours to seconds before dividing."),
            trap((hours * 3600 * song) / 3600, "Count how many songs fit: divide the total time by one song."),
          ]),
          explanation: `${hours} h × 3,600 s/h = ${usNum(hours * 3600)} s → ${usNum(hours * 3600)} ÷ ${song} = ${songs} songs`,
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
      // Real errands, each two or three moves long: find a rate, then use it.
      const kind = i % 7;
      if (kind === 0) {
        // A recipe scaled up: small numbers, so it works in the head too.
        const cups = pick([2, 3, 4]);
        const batch = pick([8, 10, 12, 15]);
        const times = pick([2, 3]);
        const cookies = batch * times;
        return {
          id: "",
          type: "numeric",
          prompt: `A recipe makes ${batch} cookies with ${cups} cups of flour. How many cups of flour do you need for ${cookies} cookies?`,
          hint: `How many batches is ${cookies} cookies? Each batch takes ${cups} cups.`,
          answer: cups * times,
          traps: trapsFor(cups * times, [
            trap(times, `That is the number of batches. Each batch takes ${cups} cups of flour.`),
            trap(cups + times, "Each batch takes the full amount of flour again: multiply, not add."),
            trap(cookies * cups, `${cookies} cookies is ${times} batches, not ${cookies}. Find the batches first.`),
          ]),
          explanation: `${cookies} ÷ ${batch} = ${times} batches → ${times} × ${cups} = ${cups * times} cups of flour`,
        };
      }
      if (kind === 1) {
        // Gas for a trip: miles to gallons, gallons to dollars.
        const mpg = pick([20, 24, 25, 28, 30, 32, 35, 40]);
        const gallons = randInt(4, 15);
        const miles = mpg * gallons;
        const priceCents = pick([299, 315, 325, 340, 359, 375, 389, 405, 419]);
        const cost = (gallons * priceCents) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `You drive ${miles} miles in a car that gets ${mpg} miles per gallon. Gas costs $${money(priceCents / 100)} a gallon. How much does the gas for the trip cost? (round to the nearest cent)`,
          hint: "Two steps: miles ÷ miles per gallon gives the gallons used, and gallons × the price gives the cost.",
          answer: cost,
          decimalPlaces: 2,
          traps: trapsFor(cost, [
            trap(gallons, "That is the gallons of gas used. Multiply by the price of a gallon to get the cost."),
            trap((miles * priceCents) / 100, "That pays for a gallon every mile. Find the gallons first: miles ÷ miles per gallon."),
            trap(Math.round((miles / (priceCents / 100)) * 100) / 100, "Find the gallons first (miles ÷ miles per gallon), then multiply by the price per gallon."),
          ]),
          explanation: `${miles} ÷ ${mpg} = ${gallons} gallons → ${gallons} × $${money(priceCents / 100)} = $${money(cost)}`,
        };
      }
      if (kind === 2) {
        const mph = pick([40, 45, 48, 50, 60, 72, 75, 80]);
        let minutes = 5 * randInt(2, 18);
        while ((mph * minutes) % 60 !== 0) minutes += 5;
        const miles = (mph * minutes) / 60;
        return {
          id: "",
          type: "numeric",
          prompt: `A train travels at ${mph} miles per hour. How many minutes does it take to go ${miles} miles?`,
          hint: "Time = distance ÷ speed gives hours. Then change hours to minutes.",
          answer: minutes,
          traps: trapsFor(minutes, [
            trap(miles / mph, "That is the time in hours. Multiply by 60 for minutes."),
            trap(miles * mph, "Time is distance divided by speed, not times it."),
            trap(Math.round((mph / miles) * 60 * 100) / 100, "Divide the distance by the speed: miles ÷ miles per hour gives hours."),
          ]),
          explanation: `${miles} ÷ ${mph} = ${fmtNum(miles / mph)} hours → ${fmtNum(miles / mph)} × 60 = ${minutes} minutes`,
        };
      }
      if (kind === 3) {
        // A pace, then a longer run at the same pace.
        const pace = randInt(4, 8);
        const km1 = randInt(3, 6);
        let km2 = randInt(7, 15);
        if (km2 === 2 * km1) km2 += 1;
        return {
          id: "",
          type: "numeric",
          prompt: `A runner finishes ${km1} kilometers in ${pace * km1} minutes. At the same pace, how many minutes would ${km2} kilometers take?`,
          hint: "Find the minutes for one kilometer first, then multiply by the new distance.",
          answer: pace * km2,
          traps: trapsFor(pace * km2, [
            trap(pace, "That is the minutes for one kilometer. Multiply by the new distance."),
            trap(pace * km1 * km2, "That multiplies the whole run's time by the new distance. Find the minutes per kilometer first: divide."),
            trap(pace * km1 + km2, "Each extra kilometer adds a full kilometer's worth of minutes, not one minute."),
          ]),
          explanation: `${pace * km1} ÷ ${km1} = ${pace} minutes per km → ${pace} × ${km2} = ${pace * km2} minutes`,
        };
      }
      if (kind === 4) {
        // Which bag is the better deal, in cents per ounce.
        const small = pick([8, 10, 12]);
        const big = pick([16, 20, 24, 32]);
        const bigRate = randInt(18, 35);
        const gap = randInt(2, 8);
        const smallRate = bigRate + gap;
        return {
          id: "",
          type: "numeric",
          prompt: `A ${small}-ounce bag of trail mix costs $${money((small * smallRate) / 100)}. A ${big}-ounce bag costs $${money((big * bigRate) / 100)}. How many cents more per ounce does the small bag cost?`,
          hint: "Find each bag's price for one ounce: divide its price by its ounces. Then subtract.",
          answer: gap,
          traps: trapsFor(gap, [
            trap(smallRate, "That is the small bag's price for one ounce. Subtract the big bag's price per ounce."),
            trap(big * bigRate - small * smallRate, "That compares the bags' prices. Compare one ounce of each: divide each price by its ounces."),
            trap(bigRate, "That is the big bag's price for one ounce. The question asks how much more the small bag's ounce costs."),
          ]),
          explanation: `$${money((small * smallRate) / 100)} ÷ ${small} = ${smallRate}¢ per ounce, $${money((big * bigRate) / 100)} ÷ ${big} = ${bigRate}¢ per ounce → ${smallRate} − ${bigRate} = ${gap} cents`,
        };
      }
      if (kind === 5) {
        const ml = randInt(2, 9);
        const liters = (ml * 60 * 24 * 7) / 1000;
        return {
          id: "",
          type: "numeric",
          prompt: `A leaky faucet drips ${ml} milliliters every minute. How many liters does it waste in one week? Write your answer as a decimal.`,
          hint: "Chain the factors: minutes in an hour, hours in a day, days in a week, then milliliters to liters.",
          answer: liters,
          traps: trapsFor(liters, [
            trap(ml * 60 * 24 * 7, "That is the week in milliliters. Divide by 1,000 for liters."),
            trap((ml * 60 * 24) / 1000, "That is one day. A week is 7 days."),
            trap((ml * 60 * 7) / 1000, "That skips the hours in a day: a day is 24 hours, not one."),
          ]),
          explanation: `${ml} mL/min × 60 min/h × 24 h/day × 7 days = ${usNum(ml * 10080)} mL → ${usNum(ml * 10080)} ÷ 1,000 = ${fmtNum(liters)} L`,
        };
      }
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
    }),

  "one-step-equations": (seeds) =>
    fillToCount("one-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      // One move each, but with the things that make one move hard: negatives,
      // fractions, decimals, and words to turn into an equation first.
      const kind = i % 8;
      if (kind === 0) {
        const x = -randInt(3, 20);
        const a = randInt(5, 25);
        const c = x + a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x + ${a} = ${c}`,
          hint: `Subtract ${a} from both sides. The answer can be negative.`,
          answer: x,
          traps: trapsFor(x, [
            trap(c + a, `The equation adds ${a} to x. To undo adding, subtract ${a} from both sides.`),
            trap(-x, `${c} − ${a} goes below zero: keep the negative sign.`),
            trap(a - c, `x is ${c} take away ${a}, not ${a} take away ${c}.`),
          ]),
          explanation: `x + ${a} = ${c} → x = ${c} − ${a} → x = ${x}`,
        };
      }
      if (kind === 1) {
        const a = -randInt(2, 12);
        const x = nonZero(-12, 12);
        const c = a * x;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${coef(a)} = ${c}`,
          hint: `Divide both sides by ${a}, sign and all.`,
          answer: x,
          traps: trapsFor(x, [
            trap(-x, `Dividing by ${a}, a negative number, changes the sign. Check yours.`),
            trap(c - a, `${coef(a)} means ${a} times x. Undo multiplying by dividing both sides by ${a}.`),
            trap(c * a, `${coef(a)} means ${a} times x, so divide by ${a}. Multiplying again goes the wrong way.`),
          ]),
          explanation: `${coef(a)} = ${c} → x = ${c} ÷ (${a}) → x = ${x}`,
        };
      }
      if (kind === 2) {
        const d = randInt(3, 9);
        const c = nonZero(-12, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x/${d} = ${c}`,
          hint: `x/${d} means x divided by ${d}. Undo it by multiplying both sides by ${d}.`,
          answer: c * d,
          traps: trapsFor(c * d, [
            trap(c / d, `To undo dividing by ${d}, multiply by ${d}. Dividing again goes the wrong way.`),
            trap(c + d, `x/${d} means x divided by ${d}. Undo dividing by multiplying.`),
            trap(-c * d, `${c} times ${d} keeps the sign of ${c}.`),
          ]),
          explanation: `x/${d} = ${c} → x = ${c} × ${d} → x = ${c * d}`,
        };
      }
      if (kind === 3) {
        const [p, q] = pick([[2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [2, 5], [3, 8], [5, 4], [3, 2], [7, 4]]);
        const k = nonZero(-9, 9);
        const c = p * k;
        const x = q * k;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: (${p}/${q})x = ${c}`,
          hint: `Multiply both sides by the reciprocal, ${q}/${p}: it undoes the ${p}/${q}.`,
          answer: x,
          traps: trapsFor(x, [
            trap((c * p) / q, `Multiplying by ${p}/${q} again goes the wrong way. Multiply by its reciprocal, ${q}/${p}.`),
            trap(c * q, `Multiplying by ${q} is half of it: then divide by ${p}.`),
            trap(c / q, `To undo (${p}/${q})x, multiply by ${q}/${p}: times ${q} and divided by ${p}.`),
          ]),
          explanation: `(${p}/${q})x = ${c} → x = ${c} × ${q}/${p} → x = ${x}`,
        };
      }
      if (kind === 4) {
        // Decimals, kept exact by working in hundredths.
        const a = randInt(5, 39) * 25;
        const x = randInt(20, 80) * 25;
        const c = x - a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x − ${fmtNum(a / 100)} = ${fmtNum(c / 100)}`,
          hint: `Add ${fmtNum(a / 100)} to both sides. Line the decimal points up.`,
          answer: x / 100,
          traps: trapsFor(x / 100, [
            trap((c - a) / 100, `The equation subtracts ${fmtNum(a / 100)}. To undo subtracting, add it to both sides.`),
            trap((a - c) / 100, `x is ${fmtNum(c / 100)} with ${fmtNum(a / 100)} put back: add the two.`),
          ]),
          explanation: `x − ${fmtNum(a / 100)} = ${fmtNum(c / 100)} → x = ${fmtNum(c / 100)} + ${fmtNum(a / 100)} → x = ${fmtNum(x / 100)}`,
        };
      }
      if (kind === 5) {
        const who = pick(NAMES);
        const game = randInt(15, 60);
        const snack = randInt(4, 12);
        const spent = game + snack;
        const left = randInt(10, 80);
        return {
          id: "",
          type: "numeric",
          prompt: `${who} bought a video game for $${game} and snacks for $${snack}, and has $${left} left. How many dollars did ${who} have before shopping?`,
          hint: `Call the money before x. Then x − ${spent} = ${left}: undo taking away by adding to both sides.`,
          answer: spent + left,
          traps: trapsFor(spent + left, [
            trap(game + left, `The $${snack} for snacks came out of the money too.`),
            trap(left - spent, `The money before is more than what is left: add what was spent back.`),
            trap(left, "That is what is left after shopping. Add back what was spent."),
          ]),
          explanation: `x − ${game} − ${snack} = ${left} → x − ${spent} = ${left} → x = ${left} + ${spent} → x = ${spent + left} dollars`,
        };
      }
      if (kind === 6) {
        const n = randInt(3, 8);
        const each = randInt(9, 24);
        return {
          id: "",
          type: "numeric",
          prompt: `${n} friends split a dinner bill evenly. Each of them paid $${each}. How many dollars was the whole bill?`,
          hint: `Call the bill x. Then x/${n} = ${each}: undo dividing by multiplying both sides by ${n}.`,
          answer: n * each,
          traps: trapsFor(n * each, [
            trap(each / n, `x/${n} = ${each} means the bill divided by ${n} is ${each}, so the bill is bigger: multiply.`),
            trap(n + each, `Undo dividing by ${n} by multiplying by ${n}, not adding.`),
          ]),
          explanation: `x/${n} = ${each} → x = ${each} × ${n} → x = ${n * each} dollars`,
        };
      }
      const x = randInt(2, 12);
      const a = randInt(2, 8);
      const c = -a * x;
      const wrong = c + a;
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this solution of -${a}x = ${c}.`,
        hint: "Check whether the right inverse operation was used.",
        wrongStepIndex: 1,
        steps: [`-${a}x = ${c}`, `x = ${c} + ${a}`, `x = ${wrong}`],
        explanation: `Step 2 adds ${a}, but -${a}x means -${a} times x, so divide instead: x = ${c} ÷ (-${a}) = ${x}.`,
      };
    }),

  "two-step-equations": (seeds) =>
    fillToCount("two-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 9;
      if (kind === 0) {
        const a = randInt(2, 6);
        const x = randInt(2, 12);
        const b = randInt(1, 10);
        const minusB = randInt(0, 1) === 1;
        const c = minusB ? a * x - b : a * x + b;
        const op = minusB ? "−" : "+";
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
      if (kind === 1) {
        // A negative coefficient.
        const a = -randInt(2, 9);
        const x = nonZero(-10, 10);
        const b = nonZero(-15, 15);
        const c = a * x + b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${lin(a, b)} = ${c}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} first, then divide by ${a}, sign and all.`,
          answer: x,
          traps: trapsFor(x, [
            trap(-x, `Dividing by ${a}, a negative number, changes the sign. Check yours.`),
            trap((c + b) / a, `The ${Math.abs(b)} moves across with its sign changed: ${coef(a)} = ${c} ${b > 0 ? "−" : "+"} ${Math.abs(b)}.`),
            trap(c - b, `That is ${coef(a)}. One step to go: divide by ${a}.`),
          ]),
          explanation: `${lin(a, b)} = ${c} → ${coef(a)} = ${c - b} → x = ${x}`,
        };
      }
      if (kind === 2) {
        const d = randInt(2, 9);
        const c = nonZero(-9, 12);
        const b = nonZero(-12, 12);
        const x = d * (c - b);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x/${d}${plusTerm(b)} = ${c}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} first, then multiply by ${d}.`,
          answer: x,
          traps: trapsFor(x, [
            trap((c - b) / d, `x/${d} means x divided by ${d}. Undo dividing by multiplying by ${d}.`),
            trap(c * d - b, `Move the ${Math.abs(b)} before multiplying: it is outside the fraction.`),
            trap(d * (c + b), `The ${Math.abs(b)} moves across with its sign changed.`),
          ]),
          explanation: `x/${d}${plusTerm(b)} = ${c} → x/${d} = ${c - b} → x = ${c - b} × ${d} → x = ${x}`,
        };
      }
      if (kind === 3) {
        // The constant first and the x term taken away: 15 − 2x = 41.
        const a = randInt(2, 9);
        const x = nonZero(-12, 12);
        const k = randInt(5, 30);
        const c = k - a * x;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${k} − ${a}x = ${c}`,
          hint: `Subtract ${k} from both sides. What is left is -${a}x, so divide by -${a}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(-x, `${k} − ${a}x has a negative x term: you divide by -${a}, and that changes the sign.`),
            trap((c - k) / a, `After subtracting ${k}, the x term is -${a}x, so divide by -${a}, not ${a}.`),
            trap((c + k) / -a, `Subtract ${k} from both sides: ${c} − ${k}, not ${c} + ${k}.`),
          ]),
          explanation: `${k} − ${a}x = ${c} → -${a}x = ${c - k} → x = ${c - k} ÷ (-${a}) → x = ${x}`,
        };
      }
      if (kind === 4) {
        const [p, q] = pick([[2, 3], [3, 4], [3, 5], [2, 5], [4, 3], [5, 2], [3, 2], [5, 6]]);
        const k = nonZero(-6, 8);
        const x = q * k;
        const b = nonZero(-12, 12);
        const c = p * k + b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: (${p}/${q})x${plusTerm(b)} = ${c}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} first. Then multiply by the reciprocal, ${q}/${p}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(((c - b) * p) / q, `Multiplying by ${p}/${q} again goes the wrong way. Multiply by its reciprocal, ${q}/${p}.`),
            trap(c - b, `That is (${p}/${q})x. Multiply by ${q}/${p} to get x.`),
            trap(((c + b) * q) / p, `The ${Math.abs(b)} moves across with its sign changed.`),
          ]),
          explanation: `(${p}/${q})x${plusTerm(b)} = ${c} → (${p}/${q})x = ${c - b} → x = ${c - b} × ${q}/${p} → x = ${x}`,
        };
      }
      if (kind === 5) {
        // Decimal coefficients with whole answers.
        const [a10, x] = pick([[15, 4], [25, 6], [5, 8], [35, 2], [12, 5], [8, 10], [4, 15], [25, 4], [15, 6], [45, 2], [5, 14], [12, 10]]);
        const b = nonZero(-9, 12);
        const c10 = a10 * x + b * 10;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${fmtNum(a10 / 10)}x${plusTerm(b)} = ${fmtNum(c10 / 10)}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}, then divide by ${fmtNum(a10 / 10)}.`,
          answer: x,
          traps: trapsFor(x, [
            trap((c10 / 10 + b) / (a10 / 10), `The ${Math.abs(b)} moves across with its sign changed.`),
            trap(c10 / 10 - b, `That is ${fmtNum(a10 / 10)}x. Divide by ${fmtNum(a10 / 10)} to finish.`),
            trap(Math.round(((c10 / 10 - b) * (a10 / 10)) * 100) / 100, `Undo multiplying by ${fmtNum(a10 / 10)} by dividing by it.`),
          ]),
          explanation: `${fmtNum(a10 / 10)}x${plusTerm(b)} = ${fmtNum(c10 / 10)} → ${fmtNum(a10 / 10)}x = ${fmtNum(c10 / 10 - b)} → x = ${x}`,
        };
      }
      if (kind === 6) {
        const who = pick(NAMES);
        const fee = pick([25, 30, 35, 40, 50, 60, 75]);
        const monthly = pick([15, 18, 20, 22, 25, 29, 30, 35]);
        const months = randInt(3, 14);
        const total = fee + monthly * months;
        return {
          id: "",
          type: "numeric",
          prompt: `A gym charges a $${fee} sign-up fee plus $${monthly} a month. ${who} has paid $${total} in all. How many months has ${who} been a member?`,
          hint: `Write ${monthly}m + ${fee} = ${total}. Take off the sign-up fee first, then divide by the monthly price.`,
          answer: months,
          traps: trapsFor(months, [
            trap(total / monthly, `The $${fee} sign-up fee is paid once. Take it off before dividing by ${monthly}.`),
            trap(total - fee, `That is the money spent on months. Divide by $${monthly} a month to count them.`),
            trap((total + fee) / monthly, `Take the fee off the total: ${total} − ${fee}, not ${total} + ${fee}.`),
          ]),
          explanation: `${monthly}m + ${fee} = ${total} → ${monthly}m = ${total - fee} → m = ${months} months`,
        };
      }
      if (kind === 7) {
        const base = randInt(3, 6);
        const perMile = randInt(2, 4);
        const miles = randInt(4, 18);
        const total = base + perMile * miles;
        return {
          id: "",
          type: "numeric",
          prompt: `A taxi charges $${base} to start plus $${perMile} for each mile. A ride cost $${total}. How many miles long was the ride?`,
          hint: `Write ${perMile}m + ${base} = ${total}. Take off the starting charge, then divide by the price per mile.`,
          answer: miles,
          traps: trapsFor(miles, [
            trap(total / perMile, `The $${base} starting charge is paid once. Take it off before dividing by ${perMile}.`),
            trap(total - base, `That is the money spent on miles. Divide by $${perMile} a mile to count them.`),
          ]),
          explanation: `${perMile}m + ${base} = ${total} → ${perMile}m = ${total - base} → m = ${miles} miles`,
        };
      }
      const a = randInt(2, 6);
      const x = randInt(2, 12);
      const b = randInt(1, 10);
      const minusB = i % 2 === 0;
      const c = minusB ? a * x - b : a * x + b;
      const op = minusB ? "−" : "+";
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
      const kind = i % 9;
      if (kind === 0) {
        // Brackets on both sides and an x term to gather: three or four moves.
        const x = randInt(-6, 10);
        const a = randInt(2, 5);
        const b = randInt(1, 6);
        const c = randInt(1, 4);
        let d = randInt(2, 4);
        if (a + c === d) d += 1;
        const e = randInt(1, 6);
        const f = a * (x - b) + c * x - d * (x + e);
        const k = a + c - d;
        const left = lin(a + c, -a * b);
        const right = lin(d, d * e + f);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}(x − ${b}) + ${coef(c)} = ${d}(x + ${e})${plusTerm(f)}`,
          hint: "Distribute on both sides, combine like terms, then get the x terms on one side.",
          answer: x,
          traps: trapsFor(x, [
            trap((d * e + f + b) / k, `Distribute to every term in the bracket: ${a}(x − ${b}) is ${a}x − ${a * b}.`),
            trap((d * e + f + a * b) / (a + c + d), `Moving ${d}x across the equals sign changes its sign: subtract ${d}x from both sides.`),
            trap((d * e + f - a * b) / k, `The −${a * b} moves across with its sign changed: add ${a * b} to both sides.`),
          ]),
          explanation: [`${lin(a, -a * b)} + ${coef(c)} = ${lin(d, d * e)}${plusTerm(f)}`, `${left} = ${right}`, `${coef(k)} = ${d * e + f + a * b}`, ...(k === 1 ? [] : [`x = ${x}`])].join(" → "),
        };
      }
      if (kind === 1) {
        // Like terms on one side to combine first.
        const x = nonZero(-8, 10);
        const p = randInt(2, 7);
        const r = randInt(1, 5);
        let s = randInt(1, p + r - 1);
        if (s === p + r) s -= 1;
        const q = nonZero(-12, 12);
        const t = (p + r - s) * x + q;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${lin(p, q)} + ${coef(r)} = ${lin(s, t)}`,
          hint: `Combine ${coef(p)} and ${coef(r)} first. Then move the x terms to one side.`,
          answer: x,
          traps: trapsFor(x, [
            trap((t - q) / (p + r), `Get the x terms on one side: subtract ${coef(s)} from both sides too.`),
            trap((t + q) / (p + r - s), `The ${Math.abs(q)} moves across with its sign changed.`),
            trap((t - q) / (p - s), `Combine the like terms first: ${coef(p)} + ${coef(r)} = ${coef(p + r)}.`),
          ]),
          explanation: `${lin(p + r, q)} = ${lin(s, t)} → ${lin(p + r - s, q)} = ${t} → ${coef(p + r - s)} = ${t - q} → x = ${x}`,
        };
      }
      if (kind === 2) {
        // A negative in front of a bracket.
        const a = randInt(2, 4);
        const b = randInt(2, 4);
        const c = randInt(1, 8);
        const d = randInt(1, 6);
        const x = nonZero(-6, 8);
        const e = -a * b * x + a * c - d * x;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: -${a}(${b}x − ${c}) = ${lin(d, e)}`,
          hint: `Distribute -${a} to both terms in the bracket: the sign of each one changes.`,
          answer: x,
          traps: trapsFor(x, [
            trap((a * c + e) / (a * b + d), `-${a} times −${c} is +${a * c}. Distribute the negative to both terms.`),
            trap((a * c - e) / (a * b - d), `Moving ${coef(d)} across changes its sign: -${a * b}x − ${coef(d)}.`),
            trap((c - e) / (b + d), `The -${a} multiplies both terms in the bracket.`),
          ]),
          explanation: `-${a * b}x + ${a * c} = ${lin(d, e)} → ${lin(-a * b - d, a * c)} = ${e} → ${coef(-a * b - d)} = ${e - a * c} → x = ${x}`,
        };
      }
      if (kind === 3) {
        // A rectangle whose length is a rule about its width.
        const w = randInt(3, 15);
        const k = randInt(1, 9);
        const perimeter = 2 * (w + 2 * w + k);
        return {
          id: "",
          type: "numeric",
          prompt: `A rectangle's length is ${k} cm more than twice its width. Its perimeter is ${perimeter} cm. What is its width, in cm?`,
          hint: `Call the width w. The length is 2w + ${k}. Perimeter = 2(length + width).`,
          answer: w,
          traps: trapsFor(w, [
            trap(2 * w + k, "That is the length. The question asks for the width."),
            trap((perimeter - k) / 3, `The perimeter goes around both lengths and both widths: 2(w + 2w + ${k}).`),
            trap((perimeter / 2 - k) / 2, `w + (2w + ${k}) is half the perimeter: the w counts too, so it is 3w + ${k}.`),
          ]),
          explanation: `2(w + 2w + ${k}) = ${perimeter} → 6w + ${2 * k} = ${perimeter} → 6w = ${perimeter - 2 * k} → w = ${w} cm`,
        };
      }
      if (kind === 4) {
        // Three consecutive integers.
        const n = randInt(-20, 60);
        const sum = 3 * n + 3;
        const ask = pick(["smallest", "largest"] as const);
        const want = ask === "smallest" ? n : n + 2;
        return {
          id: "",
          type: "numeric",
          prompt: `The sum of three consecutive integers is ${sum}. What is the ${ask} of the three?`,
          hint: "Call them n, n + 1 and n + 2. Add them, set the sum equal, and solve for n.",
          answer: want,
          traps: trapsFor(want, [
            trap(n + 1, "That is the middle one."),
            trap(ask === "smallest" ? n + 2 : n, `That is the ${ask === "smallest" ? "largest" : "smallest"} one.`),
            trap(sum / 3, "Dividing by 3 gives the middle number. Then step down or up by one."),
          ]),
          explanation: `n + (n + 1) + (n + 2) = ${sum} → 3n + 3 = ${sum} → 3n = ${sum - 3} → n = ${n}, so the numbers are ${n}, ${n + 1} and ${n + 2}`,
        };
      }
      if (kind === 5) {
        // Two plans that cost the same at one point.
        const gb = randInt(2, 12);
        const rateB = randInt(3, 8);
        const rateA = rateB + randInt(2, 6);
        const baseA = randInt(10, 30);
        const baseB = baseA + (rateA - rateB) * gb;
        return {
          id: "",
          type: "numeric",
          prompt: `Phone plan A costs $${baseA} a month plus $${rateA} per GB of data. Plan B costs $${baseB} a month plus $${rateB} per GB. For how many GB do the plans cost the same?`,
          hint: `Write ${baseA} + ${rateA}g = ${baseB} + ${rateB}g, then get g on one side.`,
          answer: gb,
          traps: trapsFor(gb, [
            trap((baseB - baseA) / (rateA + rateB), `Moving ${rateB}g across the equals sign changes its sign: ${rateA}g − ${rateB}g.`),
            trap(baseB - baseA, `That is ${rateA - rateB}g. Divide by ${rateA - rateB} to finish.`),
            trap(baseA + rateA * gb, "That is what each plan costs then. The question asks for the GB."),
          ]),
          explanation: `${baseA} + ${rateA}g = ${baseB} + ${rateB}g → ${rateA - rateB}g = ${baseB - baseA} → g = ${gb} GB`,
        };
      }
      if (kind === 6) {
        const x = nonZero(-8, 10);
        const a = randInt(2, 6);
        const b = nonZero(-8, 8);
        const c = a * (x + b);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}(${shift("x", -b)}) = ${c}`,
          hint: "Divide both sides by the number outside first, or distribute.",
          answer: x,
          traps: trapsFor(x, [
            trap(c / a, `That is ${shift("x", -b)}, after dividing by ${a}. ${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} to finish.`),
            trap((c - b) / a, `The ${a} multiplies the whole bracket, so it comes off first: divide by ${a}, then ${b > 0 ? "subtract" : "add"} ${Math.abs(b)}.`),
            trap(c / a + b, `${shift("x", -b)} = ${c / a}, so the ${Math.abs(b)} moves across with its sign changed.`),
          ]),
          explanation: `${a}(${shift("x", -b)}) = ${c} → ${shift("x", -b)} = ${c / a} → x = ${x}`,
        };
      }
      if (kind === 7) {
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
      const kind = i % 7;
      if (kind === 0) {
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
      if (kind === 1) {
        // Two fractions of x: clear both with the least common denominator.
        const [a, b] = pick([[2, 3], [3, 4], [4, 6], [2, 5], [3, 6], [4, 5], [6, 8], [3, 5], [2, 6], [5, 10]]);
        const L = lcm(a, b);
        const x = L * nonZero(-4, 6);
        const c = x / a + x / b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x/${a} + x/${b} = ${c}`,
          hint: `Multiply every term by ${L}, the least common denominator. The fractions clear.`,
          answer: x,
          traps: trapsFor(x, [
            trap((c * a * b) / (a + b), `Multiply every term by ${L}, the right side too, and divide by the sum of the new coefficients.`),
            trap(c * L, `Multiplying by ${L} clears the fractions on the left: (${L / a})x + (${L / b})x. Combine those before dividing.`),
            trap((c * (a + b)) / 2, `x/${a} + x/${b} is not x/${a + b}. Use a common denominator, ${L}.`),
          ]),
          explanation: `Multiply by ${L}: ${coef(L / a)} + ${coef(L / b)} = ${c * L} → ${coef(L / a + L / b)} = ${c * L} → x = ${x}`,
        };
      }
      if (kind === 2) {
        const [p, q] = pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 3], [5, 2], [5, 6], [3, 2]]);
        const k = nonZero(-5, 8);
        const x = q * k;
        const b = nonZero(-10, 10);
        const c = p * k + b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${p}x/${q}${plusTerm(b)} = ${c}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} first. Then multiply by ${q} and divide by ${p}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(((c - b) * p) / q, `Undo ${p}x/${q} by multiplying by ${q} and dividing by ${p}: the reciprocal.`),
            trap((c - b) * q, `Multiplying by ${q} leaves ${p}x. Divide by ${p} to finish.`),
            trap(((c + b) * q) / p, `The ${Math.abs(b)} moves across with its sign changed.`),
          ]),
          explanation: `${p}x/${q} = ${c - b} → ${p}x = ${(c - b) * q} → x = ${x}`,
        };
      }
      if (kind === 3) {
        // A proportion with a binomial on top of each side.
        const a = randInt(2, 7);
        let b = randInt(2, 7);
        while (b === a) b = randInt(2, 7);
        let k = nonZero(-4, 6);
        let x = randInt(-6, 12);
        while (a * k === x || x === b * k) {
          k = nonZero(-4, 6);
          x = randInt(-6, 12);
        }
        const p = a * k - x;
        const q = x - b * k;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: (${shift("x", -p)})/${a} = (${shift("x", q)})/${b}`,
          hint: `Cross-multiply: ${b}(${shift("x", -p)}) = ${a}(${shift("x", q)}). Then distribute and solve.`,
          answer: x,
          traps: trapsFor(x, [
            trap((-q - p) / (b - a), `Distribute to both terms: ${b}(${shift("x", -p)}) is ${lin(b, b * p)}.`),
            trap(-x, "Check the signs when the x terms and numbers move across."),
            trap((-q * b - a * p) / (a - b), `Cross-multiply: ${b} times the left top and ${a} times the right top.`),
          ]),
          explanation: `${b}(${shift("x", -p)}) = ${a}(${shift("x", q)}) → ${lin(b, b * p)} = ${lin(a, -a * q)} → ${coef(b - a)} = ${-a * q - b * p} → x = ${x}`,
        };
      }
      if (kind === 4) {
        // x over different denominators on both sides.
        const [a, c] = pick([[2, 5], [3, 4], [2, 3], [4, 6], [3, 5], [5, 10], [2, 7], [6, 4]]);
        const L = lcm(a, c);
        const x = L * nonZero(-3, 5);
        let b = randInt(1, 9);
        if (x / a - b - x / c === 0) b += 1;
        const d = x / a - b - x / c;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x/${a} − ${b} = x/${c}${plusTerm(d)}`,
          hint: `Multiply every term by ${L} to clear the fractions, then get the x terms on one side.`,
          answer: x,
          traps: trapsFor(x, [
            trap((d + b) * L, `Multiply every term by ${L}, then combine: (${L / a})x − (${L / c})x.`),
            trap(((d - b) * L) / (L / a - L / c), `The −${b} moves across with its sign changed.`),
            trap(((d + b) * L) / (L / a + L / c), `Moving x/${c} across the equals sign changes its sign.`),
          ]),
          explanation: `Multiply by ${L}: ${lin(L / a, -b * L)} = ${lin(L / c, d * L)} → ${coef(L / a - L / c)} = ${(d + b) * L} → x = ${x}`,
        };
      }
      if (kind === 5) {
        // A fraction times a bracket.
        const [p, q] = pick([[2, 3], [3, 4], [3, 5], [2, 5], [4, 3], [5, 2], [3, 2], [5, 6]]);
        const k = nonZero(-4, 6);
        const c = p * k;
        const r = nonZero(-9, 12);
        const x = q * k + r;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: (${p}/${q})(${shift("x", r)}) = ${c}`,
          hint: `Multiply both sides by ${q}/${p} to free the bracket, then ${r > 0 ? "add" : "subtract"} ${Math.abs(r)}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(q * k, `That is ${shift("x", r)}. ${r > 0 ? "Add" : "Subtract"} ${Math.abs(r)} to get x.`),
            trap((c * p) / q + r, `Undo multiplying by ${p}/${q} with its reciprocal, ${q}/${p}.`),
            trap(q * k - r, `${shift("x", r)} = ${q * k}, so the ${Math.abs(r)} moves across with its sign changed.`),
          ]),
          explanation: `(${p}/${q})(${shift("x", r)}) = ${c} → ${shift("x", r)} = ${c} × ${q}/${p} = ${q * k} → x = ${x}`,
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
      const FLIP = { ">": "<", "<": ">", "≥": "≤", "≤": "≥" } as const;
      const kind = i % 7;
      if (kind === 0) {
        // x on both sides, the x terms ending up negative.
        const x0 = nonZero(-8, 8);
        const a = randInt(1, 5);
        const c = a + randInt(2, 5);
        const b = nonZero(-12, 12);
        const d = (a - c) * x0 + b;
        const sym = pick([">", "<", "≥", "≤"] as const);
        const answer = `x ${FLIP[sym]} ${x0}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${lin(a, b)} ${sym} ${lin(c, d)}`,
          hint: `Subtract ${coef(c)} from both sides. You will divide by a negative number at the end.`,
          answer,
          choices: mcChoices(answer, [`x ${sym} ${x0}`, `x ${FLIP[sym]} ${-x0}`, `x ${sym} ${-x0}`]),
          traps: trapsFor(answer, [
            trap(`x ${sym} ${x0}`, `Collecting the x terms leaves ${coef(a - c)}, and dividing by ${a - c}, a negative, flips the sign.`),
            trap(`x ${FLIP[sym]} ${-x0}`, "The flip is right. Check the boundary's sign: track each term's sign as it moves."),
            trap(`x ${sym} ${-x0}`, `Dividing by ${a - c} does two things: it flips the inequality sign and changes the number's sign.`),
          ]),
          explanation: `${lin(a, b)} ${sym} ${lin(c, d)} → ${coef(a - c)} ${sym} ${d - b} → divide by ${a - c} and flip the sign: ${answer}`,
        };
      }
      if (kind === 1) {
        // A negative in front of a bracket.
        const a = randInt(2, 5);
        const b = nonZero(-6, 6);
        const x0 = nonZero(-6, 6);
        const c = randInt(1, 4);
        const d = -a * (x0 - b) - c * x0;
        const sym = pick([">", "<", "≥", "≤"] as const);
        const answer = `x ${FLIP[sym]} ${x0}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: -${a}(${shift("x", b)}) ${sym} ${lin(c, d)}`,
          hint: `Distribute -${a} first. Then collect the x terms; dividing by a negative flips the sign.`,
          answer,
          choices: mcChoices(answer, [`x ${sym} ${x0}`, `x ${FLIP[sym]} ${-x0}`, `x ${sym} ${-x0}`]),
          traps: trapsFor(answer, [
            trap(`x ${sym} ${x0}`, `The x terms collect to ${coef(-a - c)}, a negative, so dividing by it flips the sign.`),
            trap(`x ${FLIP[sym]} ${-x0}`, `-${a} multiplies both terms in the bracket, the number too: check that sign.`),
            trap(`x ${sym} ${-x0}`, `Dividing by ${-a - c} flips the inequality sign and changes the number's sign.`),
          ]),
          explanation: `${lin(-a, a * b)} ${sym} ${lin(c, d)} → ${coef(-a - c)} ${sym} ${d - a * b} → divide by ${-a - c} and flip: ${answer}`,
        };
      }
      if (kind === 2 || kind === 3) {
        // A budget: the greatest whole number that fits.
        const who = pick(NAMES);
        const budget = pick([40, 45, 50, 60, 75, 80, 100]);
        let fixed = randInt(8, Math.floor(budget / 3));
        const each = randInt(3, 9);
        if ((budget - fixed) % each === 0) fixed += 1;
        const most = Math.floor((budget - fixed) / each);
        const story =
          kind === 2
            ? `${who} has $${budget} to spend on a $${fixed} shirt and some pairs of socks at $${each} a pair. What is the greatest number of pairs of socks ${who} can buy?`
            : `A streaming plan costs $${fixed} a month plus $${each} for each movie rental. ${who} can spend at most $${budget} a month. What is the greatest number of movies ${who} can rent in a month?`;
        return {
          id: "",
          type: "numeric",
          prompt: story,
          hint: `Write ${each}n + ${fixed} ≤ ${budget} and solve it. The answer has to be a whole number that keeps the total at or under $${budget}.`,
          answer: most,
          traps: trapsFor(most, [
            trap(most + 1, `${most + 1} of them would cost ${each * (most + 1) + fixed} dollars, which is over $${budget}. Round down.`),
            trap(Math.floor(budget / each), `Take off the $${fixed} first: it is paid once, before anything else.`),
            trap(Math.round(((budget - fixed) / each) * 100) / 100, "Only whole ones can be bought: take the whole-number part."),
          ]),
          explanation: `${each}n + ${fixed} ≤ ${budget} → ${each}n ≤ ${budget - fixed} → n ≤ ${fmtNum(Math.round(((budget - fixed) / each) * 100) / 100)}, so the most is ${most}`,
        };
      }
      if (kind === 4) {
        // The key idea, practiced: a negative coefficient, so the sign flips.
        const a = randInt(2, 6);
        const x0 = nonZero(-8, 8);
        const b = randInt(-9, 9);
        const sym = pick([">", "<", "≥", "≤"] as const);
        const c = -a * x0 + b;
        const left = lin(-a, b);
        const answer = `x ${FLIP[sym]} ${x0}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${left} ${sym} ${c}`,
          hint: "You will divide by a negative number. What does that do to the inequality sign?",
          answer,
          choices: mcChoices(answer, [`x ${sym} ${x0}`, `x ${FLIP[sym]} ${-x0}`, `x ${sym} ${-x0}`]),
          traps: trapsFor(answer, [
            trap(`x ${sym} ${x0}`, `Both sides get divided by ${-a}, a negative number, and that flips the inequality sign.`),
            trap(`x ${FLIP[sym]} ${-x0}`, `The flip is right. Now check the boundary's sign: it comes from dividing ${c - b} by ${-a}.`),
            trap(`x ${sym} ${-x0}`, `Dividing by ${-a} does two things: it flips the inequality sign, and it changes the sign of the number.`),
          ]),
          explanation: `${left} ${sym} ${c} → ${coef(-a)} ${sym} ${c - b} → divide by ${-a} and flip the sign: ${answer}`,
        };
      }
      if (kind === 5) {
        // A fraction of x, negative: multiply by the negative and flip.
        const k = randInt(2, 6);
        const b = nonZero(-8, 8);
        const m = nonZero(-6, 6);
        const c = m + b;
        const x0 = -k * m;
        const sym = pick([">", "<", "≥", "≤"] as const);
        const answer = `x ${FLIP[sym]} ${x0}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: -x/${k}${plusTerm(b)} ${sym} ${c}`,
          hint: `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} first. Then multiply both sides by -${k}, which flips the sign.`,
          answer,
          choices: mcChoices(answer, [`x ${sym} ${x0}`, `x ${FLIP[sym]} ${-x0}`, `x ${sym} ${-x0}`]),
          traps: trapsFor(answer, [
            trap(`x ${sym} ${x0}`, `Multiplying by -${k}, a negative, flips the inequality sign.`),
            trap(`x ${FLIP[sym]} ${-x0}`, `The flip is right. Multiply ${m} by -${k} and keep track of the sign.`),
            trap(`x ${sym} ${-x0}`, `Multiplying by -${k} flips the sign and changes the number's sign.`),
          ]),
          explanation: `-x/${k}${plusTerm(b)} ${sym} ${c} → -x/${k} ${sym} ${m} → multiply by -${k} and flip: ${answer}`,
        };
      }
      const a = randInt(2, 5);
      const x = randInt(2, 12);
      const b = randInt(1, 8);
      if (i % 2 === 0) {
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
      // Points that get used: how far apart, the middle, a reflection, a
      // slide, a rectangle's missing corner and area. A quadrant card warms up.
      const kind = i % 7;
      if (kind === 1) {
        // Two points on a horizontal or a vertical line: count across zero.
        const across = randInt(0, 1) === 0;
        const fixed = nonZero(-7, 7);
        const a = -randInt(1, 8);
        const b = randInt(1, 9);
        const [p, q] = across ? [`(${a}, ${fixed})`, `(${b}, ${fixed})`] : [`(${fixed}, ${a})`, `(${fixed}, ${b})`];
        return {
          id: "",
          type: "numeric",
          prompt: `How far apart are the points ${p} and ${q}?`,
          hint: `The ${across ? "y" : "x"}-values match, so count along the ${across ? "x" : "y"}-axis: from ${a} up to 0, then on to ${b}.`,
          answer: b - a,
          traps: trapsFor(b - a, [
            trap(b + a, `${a} is ${-a} steps on the other side of zero. Those steps count too: subtract, ${b} − (${a}).`),
            trap(Math.abs(fixed), "That number is the same in both points, so it does not change. Count along the other axis."),
          ]),
          explanation: `${b} − (${a}) = ${b} + ${-a} = ${b - a}`,
        };
      }
      if (kind === 2) {
        // A midpoint, with even sums so it lands on whole numbers.
        const mx = randInt(-5, 5);
        const my = randInt(-5, 5);
        const dx = nonZero(-6, 6);
        const dy = nonZero(-6, 6);
        const [x1, y1, x2, y2] = [mx - dx, my - dy, mx + dx, my + dy];
        const answer = `(${mx}, ${my})`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the midpoint of (${x1}, ${y1}) and (${x2}, ${y2})?`,
          hint: "Average the x-values, and average the y-values: add each pair and divide by 2.",
          answer,
          choices: mcChoices(answer, [`(${my}, ${mx})`, `(${x2 - x1}, ${y2 - y1})`, `(${(x2 - x1) / 2}, ${(y2 - y1) / 2})`, `(${x1 + x2}, ${y1 + y2})`]),
          traps: trapsFor(answer, [
            trap(`(${my}, ${mx})`, "The coordinates are in the wrong order: x first, then y."),
            trap(`(${x2 - x1}, ${y2 - y1})`, "That is how far apart they are, not the middle. Add each pair and divide by 2."),
            trap(`(${(x2 - x1) / 2}, ${(y2 - y1) / 2})`, "That is half the distance between them. The midpoint averages them: add, then divide by 2."),
            trap(`(${x1 + x2}, ${y1 + y2})`, "Those are the sums. Divide each one by 2."),
          ]),
          explanation: `x: (${x1} + ${par(x2)}) ÷ 2 = ${mx} → y: (${y1} + ${par(y2)}) ÷ 2 = ${my} → the midpoint is ${answer}`,
        };
      }
      if (kind === 3) {
        // A reflection over one axis.
        const x = nonZero(-8, 8);
        const y = nonZero(-8, 8);
        const overY = randInt(0, 1) === 0;
        const answer = overY ? `(${-x}, ${y})` : `(${x}, ${-y})`;
        const other = overY ? `(${x}, ${-y})` : `(${-x}, ${y})`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Reflect the point (${x}, ${y}) across the ${overY ? "y" : "x"}-axis. Where does it land?`,
          hint: overY ? "Across the y-axis, the point flips left to right: its x changes sign and its y stays." : "Across the x-axis, the point flips top to bottom: its y changes sign and its x stays.",
          answer,
          choices: mcChoices(answer, [other, `(${-x}, ${-y})`, `(${y}, ${x})`]),
          traps: trapsFor(answer, [
            trap(other, `That reflects across the ${overY ? "x" : "y"}-axis. Across the ${overY ? "y-axis the x" : "x-axis the y"} changes sign.`),
            trap(`(${-x}, ${-y})`, "Both signs changed: that turns the point halfway around the origin. A reflection over one axis changes one sign."),
            trap(`(${y}, ${x})`, "Swapping x and y reflects across the line y = x, not an axis."),
          ]),
          explanation: `Across the ${overY ? "y" : "x"}-axis, ${overY ? "x" : "y"} changes sign: (${x}, ${y}) → ${answer}`,
        };
      }
      if (kind === 4) {
        // A slide right or left, then up or down.
        const x = randInt(-6, 6);
        const y = randInt(-6, 6);
        const dx = nonZero(-8, 8);
        const dy = nonZero(-8, 8);
        const answer = `(${x + dx}, ${y + dy})`;
        const moves = `${Math.abs(dx)} ${Math.abs(dx) === 1 ? "unit" : "units"} ${dx > 0 ? "right" : "left"} and ${Math.abs(dy)} ${Math.abs(dy) === 1 ? "unit" : "units"} ${dy > 0 ? "up" : "down"}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Start at (${x}, ${y}). Move ${moves}. Where do you land?`,
          hint: "Right and left change x; up and down change y. Right and up add, left and down subtract.",
          answer,
          choices: mcChoices(answer, [`(${x + dy}, ${y + dx})`, `(${x - dx}, ${y + dy})`, `(${x + dx}, ${y - dy})`, `(${x - dx}, ${y - dy})`]),
          traps: trapsFor(answer, [
            trap(`(${x + dy}, ${y + dx})`, "The moves went to the wrong coordinates: right and left change x, up and down change y."),
            trap(`(${x - dx}, ${y + dy})`, `Moving ${dx > 0 ? "right adds to" : "left takes away from"} x.`),
            trap(`(${x + dx}, ${y - dy})`, `Moving ${dy > 0 ? "up adds to" : "down takes away from"} y.`),
            trap(`(${x - dx}, ${y - dy})`, "Both moves went the opposite way. Right and up add; left and down subtract."),
          ]),
          explanation: `x: ${x} ${dx > 0 ? "+" : "−"} ${Math.abs(dx)} = ${x + dx} → y: ${y} ${dy > 0 ? "+" : "−"} ${Math.abs(dy)} = ${y + dy} → ${answer}`,
        };
      }
      if (kind === 5 || kind === 6) {
        // A rectangle with sides on grid lines.
        const left = randInt(-8, 2);
        const right = left + randInt(3, 9);
        const bottom = randInt(-8, 1);
        const top = bottom + randInt(2, 8);
        const corners = [`(${left}, ${top})`, `(${right}, ${top})`, `(${right}, ${bottom})`, `(${left}, ${bottom})`];
        const missing = randInt(0, 3);
        const given = corners.filter((_, k) => k !== missing);
        if (kind === 5) {
          const area = (right - left) * (top - bottom);
          return {
            id: "",
            type: "numeric",
            prompt: `Three corners of a rectangle are ${listOf(given)}. What is the rectangle's area?`,
            hint: "Find the width by counting across from the smaller x to the bigger x, and the height the same way with y. Then multiply.",
            answer: area,
            traps: trapsFor(area, [
              trap(2 * (right - left + top - bottom), "That is the perimeter, the distance around. Area is width × height."),
              trap((right + left) * (top + bottom), "Each side's length is a difference: the bigger coordinate minus the smaller one."),
              trap(Math.abs(right * top), "Area needs the side lengths: count from one corner to the next."),
            ]),
            explanation: `width = ${less(right, left)}${left === 0 ? "" : ` = ${right - left}`}, height = ${less(top, bottom)}${bottom === 0 ? "" : ` = ${top - bottom}`} → area = ${right - left} × ${top - bottom} = ${area}`,
          };
        }
        const answer = corners[missing];
        const [mx, my] = [[left, right][missing === 1 || missing === 2 ? 1 : 0], [top, bottom][missing >= 2 ? 1 : 0]];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Three corners of a rectangle are ${listOf(given)}. What is the fourth corner?`,
          hint: "A rectangle's sides here run along the grid: the missing corner shares its x with one corner and its y with another.",
          answer,
          choices: mcChoices(answer, [`(${my}, ${mx})`, `(${left + right - mx}, ${top + bottom - my})`, `(${mx}, ${top + bottom - my})`, `(${left + right - mx}, ${my})`]),
          traps: trapsFor(answer, [
            trap(`(${my}, ${mx})`, "The coordinates are in the wrong order: x first, then y."),
            trap(`(${left + right - mx}, ${top + bottom - my})`, "That is the corner already given across from it. The missing one is the corner nobody has used yet."),
            trap(`(${mx}, ${top + bottom - my})`, "That point is already a corner. Use the x and the y that each appear only once among the three."),
            trap(`(${left + right - mx}, ${my})`, "That point is already a corner. Use the x and the y that each appear only once among the three."),
          ]),
          explanation: `The x-values used are ${left} and ${right}, the y-values ${bottom} and ${top}. The corner still missing is ${answer}.`,
        };
      }
      const x = nonZero(-8, 8);
      const y = nonZero(-8, 8);
      const quadrant = x > 0 && y > 0 ? "Quadrant I" : x < 0 && y > 0 ? "Quadrant II" : x < 0 && y < 0 ? "Quadrant III" : "Quadrant IV";
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
    }),

  slope: (seeds) =>
    fillToCount("slope", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 7;
      if (kind === 1) {
        // Vertical and horizontal lines, from points, so every one is a new card.
        const a = randInt(-5, 6);
        const b = randInt(-5, 5);
        const step = randInt(2, 7);
        if (i % 14 === 1) {
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
      if (kind === 2) {
        // A table of four points on a line.
        const x0 = randInt(-4, 3);
        const dx = randInt(1, 4);
        const rise = nonZero(-7, 7);
        const y0 = randInt(-8, 10);
        const xs = [0, 1, 2, 3].map((k) => x0 + k * dx);
        const ys = [0, 1, 2, 3].map((k) => y0 + k * rise);
        const m = rise / dx;
        return {
          id: "",
          type: "numeric",
          prompt: `A table lists points on a line. When x is ${xs.join(", ")}, y is ${ys.join(", ")}. What is the slope? Give it as a whole number or a fraction.`,
          hint: "Pick two points from the table. Slope = change in y ÷ change in x.",
          answer: m,
          traps: trapsFor(m, [
            trap(rise, `That is how much y changes each time. x changes by ${dx} each time, so divide by ${dx}.`),
            trap(dx / rise, "That is run over rise. Slope is the change in y over the change in x."),
            trap(-m, "Subtract in the same order on top and bottom: later point minus earlier point, both times."),
          ]),
          explanation: `(${ys[1]} − ${par(ys[0])}) ÷ (${xs[1]} − ${par(xs[0])}) = ${rise}/${dx}${`${rise}/${dx}` === frac(rise, dx) ? "" : ` = ${frac(rise, dx)}`}`,
        };
      }
      if (kind === 3) {
        // A rate of change in a story.
        const d1 = randInt(1, 6);
        const days = pick([2, 4, 5, 6, 8, 10]);
        const per2 = randInt(1, 9);
        const h1 = randInt(2, 15);
        const h2 = h1 + (per2 * days) / 2;
        const rate = per2 / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `A plant was ${fmtNum(h1)} cm tall on day ${d1} and ${fmtNum(h2)} cm tall on day ${d1 + days}. How many centimeters did it grow per day?${Number.isInteger(rate) ? "" : " Write your answer as a decimal."}`,
          hint: "Growth per day is a slope: change in height ÷ change in days.",
          answer: rate,
          traps: trapsFor(rate, [
            trap(h2 - h1, `That is the growth over all ${days} days. Divide by the number of days.`),
            trap(Math.round((h2 / (d1 + days)) * 100) / 100, "Use the changes: the height gained over the days that passed."),
            trap(Math.round((days / (h2 - h1)) * 100) / 100, "That is days per centimeter, upside down. Put the change in height on top."),
          ]),
          explanation: `(${fmtNum(h2)} − ${fmtNum(h1)}) ÷ (${d1 + days} − ${d1}) = ${fmtNum(h2 - h1)} ÷ ${days} = ${fmtNum(rate)} cm per day`,
        };
      }
      if (kind === 4) {
        // A missing y-coordinate, from the slope.
        const x1 = randInt(-5, 4);
        const y1 = randInt(-6, 6);
        const [top, bottom] = pick([[2, 1], [3, 1], [-2, 1], [-3, 1], [1, 2], [3, 2], [-1, 2], [-3, 2], [2, 3], [-2, 3], [4, 1], [-4, 1]]);
        const run = bottom * randInt(1, 4);
        const x2 = x1 + run;
        const k = y1 + (top * run) / bottom;
        const m = frac(top, bottom);
        return {
          id: "",
          type: "numeric",
          prompt: `The line through (${x1}, ${y1}) and (${x2}, k) has slope ${m}. What is k?`,
          hint: `From x = ${x1} to x = ${x2} is a run of ${run}. The rise is the slope times the run.`,
          answer: k,
          traps: trapsFor(k, [
            trap((top * run) / bottom, `That is the rise. Add it to the starting y-value, ${y1}.`),
            trap(y1 - (top * run) / bottom, "A positive slope goes up to the right and a negative one down: check the sign of the rise."),
            trap(y1 + top / bottom, `The run is ${run}, so the rise is ${m} times ${run}, not ${m} once.`),
          ]),
          explanation: `run = ${less(x2, x1)}${x1 === 0 ? "" : ` = ${run}`} → rise = ${m} × ${run} = ${(top * run) / bottom} → k = ${y1} + ${par((top * run) / bottom)} = ${k}`,
        };
      }
      if (kind === 5) {
        // A missing x-coordinate, from the slope.
        const x1 = randInt(-5, 5);
        const y1 = randInt(-6, 6);
        const m = nonZero(-4, 4);
        const run = nonZero(-4, 5);
        const y2 = y1 + m * run;
        const k = x1 + run;
        return {
          id: "",
          type: "numeric",
          prompt: `The line through (${x1}, ${y1}) and (k, ${y2}) has slope ${m}. What is k?`,
          hint: `The rise is ${less(y2, y1)}${y1 === 0 ? "" : ` = ${y2 - y1}`}. Since slope = rise ÷ run, the run is the rise ÷ the slope.`,
          answer: k,
          traps: trapsFor(k, [
            trap(run, `That is the run. Add it to the starting x-value, ${x1}.`),
            trap(x1 + (y2 - y1) * m, "The run is the rise divided by the slope, not times it."),
            trap(x1 - run, "Check the sign of the run: the rise and the slope together decide it."),
          ]),
          explanation: `rise = ${less(y2, y1)}${y1 === 0 ? "" : ` = ${y2 - y1}`} → run = ${y2 - y1} ÷ ${par(m)} = ${run} → k = ${x1} + ${par(run)} = ${k}`,
        };
      }
      if (kind === 6) {
        // Gas in a tank as the miles go by: a negative rate, as a fraction.
        const start = randInt(12, 18);
        const used = randInt(2, 6);
        const per = pick([20, 24, 25, 28, 30, 32, 35]);
        const m1 = randInt(0, 3) * 50;
        const m2 = m1 + used * per;
        return {
          id: "",
          type: "numeric",
          prompt: `A car's gas tank held ${start} gallons at mile ${m1} and ${start - used} gallons at mile ${m2}. What is the rate of change of the gas, in gallons per mile? Give it as a fraction.`,
          hint: "Rate of change = change in gallons ÷ change in miles. The tank is emptying, so the rate is negative.",
          answer: -1 / per,
          traps: trapsFor(-1 / per, [
            trap(1 / per, "The gas goes down as the miles go up, so the rate of change is negative."),
            trap(-per, "That is miles per gallon, upside down. Gallons go on top: the change in gallons ÷ the change in miles."),
            trap(-used, `That is the gas used over the whole drive. Divide by the ${used * per} miles driven.`),
          ]),
          explanation: `(${start - used} − ${start}) ÷ (${m2} − ${m1}) = -${used}/${used * per} = -1/${per} gallon per mile`,
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
      const kind = i % 6;
      const m = nonZero(-4, 4);
      const b = randInt(-6, 6);
      if (kind === 0) {
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
      if (kind === 2) {
        // A point on the line with its x missing: work backward from y.
        const a = randInt(-6, 8);
        const y = m * a + b;
        return {
          id: "",
          type: "numeric",
          prompt: `The point (a, ${y}) is on the line y = ${lin(m, b)}. What is a?`,
          hint: `Put ${y} in for y and solve for x: ${y} = ${lin(m, b)}.`,
          answer: a,
          traps: trapsFor(a, [
            trap(m * y + b, `${y} is the y-value. Put it in for y, then solve for x.`),
            trap((y + b) / m, `${b === 0 ? "Divide by the slope" : `The ${Math.abs(b)} moves across with its sign changed`}.`),
            trap(-a, `Dividing by ${m} keeps track of signs: check yours.`),
          ]),
          explanation: `${y} = ${lin(m, b, "a")} → ${y - b} = ${coef(m, "a")} → a = ${a}`,
        };
      }
      if (kind === 3) {
        // Where a line crosses the x-axis.
        const [top, bottom] = pick([[1, 1], [2, 1], [3, 1], [-2, 1], [-3, 1], [2, 3], [-2, 3], [3, 2], [-3, 2], [1, 2], [-1, 2], [4, 3]]);
        const root = bottom * nonZero(-4, 4);
        const intercept = -(top * root) / bottom;
        const slope = bottom === 1 ? coef(top) : `${top < 0 ? "-" : ""}(${Math.abs(top)}/${bottom})x`;
        const line = `y = ${slope}${plusTerm(intercept)}`;
        return {
          id: "",
          type: "numeric",
          prompt: `Where does the line ${line} cross the x-axis? Type the x-value.`,
          hint: "On the x-axis, y = 0. Put 0 in for y and solve for x.",
          answer: root,
          traps: trapsFor(root, [
            trap(intercept, "That is where it crosses the y-axis. On the x-axis it is y that is 0."),
            trap(-root, `Moving the ${Math.abs(intercept)} across changes its sign: check the signs.`),
            trap((-intercept * top) / bottom, `Undo multiplying by ${frac(top, bottom)} with its reciprocal, ${frac(bottom, top)}.`),
          ]),
          explanation: `0 = ${slope}${plusTerm(intercept)} → ${slope} = ${-intercept} → x = ${root}`,
        };
      }
      if (kind === 4) {
        // From the y-intercept, two steps of the slope.
        const [top, bottom] = pick([[1, 2], [2, 3], [3, 2], [-1, 2], [-2, 3], [-3, 2], [3, 4], [-3, 4], [2, 5], [1, 3], [-1, 3], [4, 3]]);
        const slope = `${top < 0 ? "-" : ""}(${Math.abs(top)}/${bottom})x`;
        const answer = `(${2 * bottom}, ${b + 2 * top})`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Start at the y-intercept of y = ${slope}${plusTerm(b)} and follow the slope for two steps, each one ${bottom} to the right and ${top > 0 ? `${top} up` : `${-top} down`}. Where do you end up?`,
          hint: `The y-intercept is (0, ${b}). Two runs of ${bottom} and two rises of ${top} from there.`,
          answer,
          choices: mcChoices(answer, [`(${bottom}, ${b + top})`, `(${2 * top}, ${b + 2 * bottom})`, `(${2 * bottom}, ${2 * top})`, `(${2 * bottom}, ${b - 2 * top})`]),
          traps: trapsFor(answer, [
            trap(`(${bottom}, ${b + top})`, "That is one step of the slope. The question takes two."),
            trap(`(${2 * top}, ${b + 2 * bottom})`, "Rise and run traded places: the run (the bottom of the slope) moves x, the rise moves y."),
            trap(`(${2 * bottom}, ${2 * top})`, `The start is the y-intercept, (0, ${b}), so the rises add on to ${b}.`),
            trap(`(${2 * bottom}, ${b - 2 * top})`, `The slope's sign decides up or down: ${top > 0 ? "positive goes up" : "negative goes down"}.`),
          ]),
          explanation: `Start at (0, ${b}) → (${bottom}, ${b + top}) → (${2 * bottom}, ${b + 2 * top})`,
        };
      }
      if (kind === 5) {
        // Which of these points is on the line?
        const x = nonZero(-5, 5);
        const y = m * x + b;
        const answer = `(${x}, ${y})`;
        // Near misses, none of which happens to sit on the line.
        const near: [number, number, string][] = [
          [y, x, "The coordinates are swapped. Put the x-value, the first number, into the equation."],
          [x, y + 2, "Put the point's x into the equation and compare the y that comes out with this point's y."],
          [-x, y, "Put this point's x into the equation, sign and all, and compare the y that comes out."],
          [x, -m * x + b, `Work out ${coef(m)} for this x carefully: a negative times a positive is negative.`],
          [x + 1, y - m, "Put the point's x into the equation and compare the y that comes out with this point's y."],
        ];
        const off = near.filter(([px, py]) => py !== m * px + b);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which point is on the line y = ${lin(m, b)}?`,
          hint: "Put each point's x into the equation. The right point's y matches what comes out.",
          answer,
          choices: mcChoices(answer, off.map(([px, py]) => `(${px}, ${py})`)),
          traps: trapsFor(answer, off.map(([px, py, why]) => trap(`(${px}, ${py})`, why))),
          explanation: `y = ${evalLin(m, b, x)}, so ${answer} is on the line.`,
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
      const kind = i % 4;
      const k = nonZero(-8, 8);
      if (kind === 2) {
        // The triangle a line cuts off with the two axes.
        const xi = randInt(2, 10);
        let yi = randInt(2, 10);
        if ((xi * yi) % 2 === 1) yi += 1;
        const g = gcd(xi, yi);
        const [a, b, c] = [yi / g, xi / g, (xi * yi) / g];
        const area = (xi * yi) / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `The line ${twoVar(a, b)} = ${c} makes a triangle with the x-axis and the y-axis. What is the triangle's area?`,
          hint: "Find both intercepts first: they are the triangle's base and height. Then area = ½ × base × height.",
          answer: area,
          traps: trapsFor(area, [
            trap(xi * yi, "That is base × height. A triangle is half of that rectangle."),
            trap(xi + yi, "Those are the base and the height. Area multiplies them and takes half."),
            trap(c / 2, `${c} is the constant in the equation. Find where the line meets each axis first.`),
          ]),
          explanation: `x-intercept: ${coef(a)} = ${c} → x = ${xi} → y-intercept: ${coef(b, "y")} = ${c} → y = ${yi} → area = ½ × ${xi} × ${yi} = ${area}`,
        };
      }
      if (kind === 3) {
        // The slope from the two intercepts.
        const p = nonZero(-8, 8);
        const q = nonZero(-8, 8);
        const m = -q / p;
        return {
          id: "",
          type: "numeric",
          prompt: `A line crosses the x-axis at (${p}, 0) and the y-axis at (0, ${q}). What is its slope? Give it as a whole number or a fraction.`,
          hint: "The intercepts are two points on the line. Slope = change in y ÷ change in x.",
          answer: m,
          traps: trapsFor(m, [
            trap(q / p, "Go from one point to the other: (0 − y) on top and (x − 0)... keep the same order on top and bottom."),
            trap(-p / q, "That is run over rise. The change in y goes on top."),
            trap(q, "That is the y-intercept. The slope compares the change in y with the change in x."),
          ]),
          explanation: `m = (${q} − 0) ÷ (0 − ${par(p)}) = ${q}/${-p}${`${q}/${-p}` === frac(q, -p) ? "" : ` = ${frac(q, -p)}`}`,
        };
      }
      if (kind === 0) {
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
      const kind = i % 7;
      const m = nonZero(-5, 5);
      const b = randInt(-6, 6);
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
        // The y-intercept from a slope and a point.
        const x1 = nonZero(-5, 5);
        const y1 = m * x1 + b;
        return {
          id: "",
          type: "numeric",
          prompt: `A line has slope ${m} and passes through (${x1}, ${y1}). What is its y-intercept?`,
          hint: `Put the point and the slope into y = mx + b: ${y1} = ${m}(${x1}) + b. Solve for b.`,
          answer: b,
          traps: trapsFor(b, [
            trap(y1 + m * x1, `${m} times ${x1} is ${m * x1}. Moving it across changes its sign: b = ${y1} − (${m * x1}).`),
            trap(y1, `${y1} is the point's y. The y-intercept is where x = 0.`),
            trap(y1 - m, `Multiply the slope by the point's x, ${x1}, before subtracting.`),
          ]),
          explanation: `${y1} = ${m}(${x1}) + b → ${y1} = ${m * x1} + b → b = ${y1} − ${par(m * x1)} = ${b}`,
        };
      }
      if (kind === 2) {
        // The whole equation from two points.
        const x1 = randInt(-4, 3);
        const run = randInt(1, 4);
        const x2 = x1 + run;
        const y1 = m * x1 + b;
        const y2 = m * x2 + b;
        const eq = `y = ${lin(m, b)}`;
        const cands: [number, number][] = [[m, y1], [-m, b], [m, -b], [1 / m, b], [m, b + m]];
        const wrong = cands.filter(([pm, pb]) => !(pm === m && pb === b) && Number.isInteger(pm)).map(([pm, pb]) => `y = ${lin(pm, pb)}`);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A line passes through (${x1}, ${y1}) and (${x2}, ${y2}). Which equation is it?`,
          hint: "Find the slope from the two points first. Then put one point into y = mx + b to find b.",
          answer: eq,
          choices: mcChoices(eq, wrong),
          traps: trapsFor(eq, [
            trap(`y = ${lin(m, y1)}`, `${y1} is a point's y-value, not the y-intercept (unless x = 0). Solve for b.`),
            trap(`y = ${lin(-m, b)}`, "The slope's sign is off: subtract in the same order on top and bottom."),
            trap(`y = ${lin(m, -b)}`, "The slope is right. Check the sign when you solve for b."),
            trap(`y = ${lin(m, b + m)}`, "The slope is right. Put a point in and solve for b carefully."),
          ]),
          explanation: `m = (${y2} − ${par(y1)}) ÷ (${x2} − ${par(x1)}) = ${m} → ${y1} = ${m}(${x1}) + b → b = ${b} → ${eq}`,
        };
      }
      if (kind === 3) {
        // Standard form to slope-intercept, then read the slope.
        const B = pick([2, 3, 4, -2, -3, 5]);
        const A = nonZero(-9, 9);
        const C = B * randInt(-6, 6);
        let [a2, b2, c2] = [A, B, C];
        if (a2 < 0) [a2, b2, c2] = [-a2, -b2, -c2];
        const slope = -a2 / b2;
        return {
          id: "",
          type: "numeric",
          prompt: `Rewrite ${twoVar(a2, b2)} = ${c2} in slope-intercept form. What is the slope? Give it as a whole number or a fraction.`,
          hint: `Move the x term to the other side, then divide every term by ${b2}.`,
          answer: slope,
          traps: trapsFor(slope, [
            trap(a2 / b2, "Moving the x term across the equals sign changes its sign."),
            trap(-a2, `Every term gets divided by ${b2}, the x term too.`),
            trap(-b2 / a2, `Divide by the number on y, ${b2}: the slope is the x coefficient over it.`),
          ]),
          explanation: `${coef(b2, "y")} = ${lin(-a2, c2)} → y = ${fracX(-a2, b2)}${plusTerm(c2 / b2)} → the slope is ${frac(-a2, b2)}`,
        };
      }
      if (kind === 4) {
        // A tank draining: write the line.
        const start = 10 * randInt(30, 90);
        const rate = pick([15, 20, 25, 30, 40, 50]);
        const eq = `g = -${rate}t + ${start}`;
        const wrong = [`g = ${rate}t + ${start}`, `g = -${start}t + ${rate}`, `g = ${start}t − ${rate}`, `g = ${rate}t − ${start}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A pool holds ${usNum(start)} gallons of water and drains ${rate} gallons each minute. Which equation gives g, the gallons left after t minutes?`,
          hint: "Start with what is there at t = 0. Each minute takes the same amount away.",
          answer: eq,
          choices: mcChoices(eq, wrong),
          traps: trapsFor(eq, [
            trap(wrong[0], "Draining takes water away, so the rate of change is negative."),
            trap(wrong[1], "The starting amount and the rate traded places: the rate goes with t."),
            trap(wrong[2], "The starting amount is the y-intercept, standing on its own. The rate multiplies t."),
            trap(wrong[3], "The pool starts full and loses water each minute: start at the full amount and subtract the rate times t."),
          ]),
          explanation: `At t = 0 the pool holds ${usNum(start)} gallons (the intercept), and it loses ${rate} a minute (the slope, -${rate}): ${eq}.`,
        };
      }
      if (kind === 5) {
        // Two rides, two prices: the flat fee is the intercept.
        const fee = randInt(2, 9);
        const per = randInt(2, 4);
        const d1 = randInt(2, 6);
        const d2 = d1 + randInt(3, 8);
        return {
          id: "",
          type: "numeric",
          prompt: `A ride-share charges a flat fee plus a price per mile. A ${d1}-mile ride costs $${fee + per * d1}, and a ${d2}-mile ride costs $${fee + per * d2}. What is the flat fee, in dollars?`,
          hint: "The price per mile is the slope: change in cost ÷ change in miles. Then work back to 0 miles.",
          answer: fee,
          traps: trapsFor(fee, [
            trap(per, "That is the price per mile, the slope. The flat fee is the cost at 0 miles."),
            trap(fee + per * d1, `That is the whole ${d1}-mile fare. Take off ${d1} miles' worth to get the fee.`),
            trap(Math.round(((fee + per * d1) / d1) * 100) / 100, "Dividing one fare by its miles mixes the fee in with the miles. Use the two rides to find the price per mile first."),
          ]),
          explanation: `per mile = (${fee + per * d2} − ${fee + per * d1}) ÷ (${d2} − ${d1}) = ${per} → ${fee + per * d1} = ${per}(${d1}) + b → b = ${fee}`,
        };
      }
      // The same y-intercept as one line, through a point of another.
      const x0 = nonZero(-4, 4);
      const slope = nonZero(-5, 5);
      let m1 = nonZero(-5, 5);
      if (m1 === slope) m1 = slope === 5 ? 4 : slope + 1;
      const y0 = slope * x0 + b;
      const eq = `y = ${lin(slope, b)}`;
      const wrongs: [number, number][] = [[m1, y0], [m1, b], [-slope, b], [slope, -b], [slope, y0]];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which line has the same y-intercept as y = ${lin(m1, b)} and passes through (${x0}, ${y0})?`,
        hint: `The y-intercept is ${b}, so the line is y = mx${plusTerm(b)}. Put the point in to find m.`,
        answer: eq,
        choices: mcChoices(eq, wrongs.filter(([pm, pb]) => !(pm === slope && pb === b)).map(([pm, pb]) => `y = ${lin(pm, pb)}`)),
        traps: trapsFor(
          eq,
          wrongs.map(([pm, pb]) => trap(`y = ${lin(pm, pb)}`, pm === m1 ? "Only the y-intercept is shared. The slope comes from the point." : pb !== b ? `The y-intercept has to be ${b}, the same as the first line's.` : "Put the point in to find the slope, and check its sign."))
        ),
        explanation: `b = ${b} → ${y0} = m(${x0}) + ${par(b)} → m = ${slope} → ${eq}`,
      };
    }),

  "point-slope": (seeds) =>
    fillToCount("point-slope", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const ps = (s: number, px: number, py: number) => `${shift("y", py)} = ${times(s, shift("x", px))}`;
      if (kind === 1) {
        // From two points: find the slope, then write the form.
        const x1 = nonZero(-5, 5);
        const y1 = nonZero(-6, 8);
        const m = nonZero(-4, 4);
        const run = nonZero(-3, 4);
        const [x2, y2] = [x1 + run, y1 + m * run];
        const answer = ps(m, x1, y1);
        const intercept = y1 - m * x1;
        const candidates: { text: string; slope: number; b: number }[] = [
          { text: ps(-m, x1, y1), slope: -m, b: y1 + m * x1 },
          { text: ps(m, -x1, -y1), slope: m, b: -y1 + m * x1 },
          { text: ps(m, y1, x1), slope: m, b: x1 - m * y1 },
          { text: ps(m + 1, x1, y1), slope: m + 1, b: y1 - (m + 1) * x1 },
        ];
        const keep = candidates.filter((c) => !(c.slope === m && c.b === intercept));
        const whys = [
          "Subtract in the same order on top and bottom when finding the slope: the sign comes out of that.",
          "The form subtracts the point's coordinates: y − y₁ and x − x₁. Subtracting a negative turns into a plus.",
          "The point's x and y are in each other's places: x₁ goes with x, and y₁ with y.",
          "Check the slope: change in y ÷ change in x.",
        ];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which equation is the line through (${x1}, ${y1}) and (${x2}, ${y2}), in point-slope form with the first point?`,
          hint: "Find the slope from the two points. Then use y − y₁ = m(x − x₁) with the first point.",
          answer,
          choices: mcChoices(answer, keep.map((c) => c.text)),
          traps: trapsFor(answer, candidates.map((c, k) => trap(c.text, whys[k]))),
          explanation: `m = (${y2} − ${par(y1)}) ÷ (${x2} − ${par(x1)}) = ${m} → ${answer}`,
        };
      }
      if (kind === 2) {
        // Point-slope to the y-intercept.
        const x1 = nonZero(-6, 6);
        const y1 = nonZero(-8, 8);
        const m = nonZero(-4, 4);
        const b = y1 - m * x1;
        return {
          id: "",
          type: "numeric",
          prompt: `A line is written ${ps(m, x1, y1)}. What is its y-intercept?`,
          hint: "Distribute, then get y by itself. The constant left over is the y-intercept.",
          answer: b,
          traps: trapsFor(b, [
            trap(y1, `${y1} is the point's y-value. The y-intercept is where x = 0.`),
            trap(y1 + m * x1, "Distribute carefully: the slope times −x₁ brings a sign with it."),
            trap(-m * x1, `That is the slope times −${x1}, from distributing. Then move the ${Math.abs(y1)} across too.`),
          ]),
          explanation: `${shift("y", y1)} = ${lin(m, -m * x1)} → y = ${lin(m, b)} → the y-intercept is ${b}`,
        };
      }
      if (kind === 3) {
        // A y-value from point-slope form, with a fraction slope.
        const [top, bottom] = pick([[1, 2], [3, 2], [-1, 2], [-3, 2], [2, 3], [-2, 3], [1, 3], [3, 4], [-3, 4], [4, 3]]);
        const x1 = randInt(-6, 6);
        const y1 = nonZero(-8, 8);
        const x = x1 + bottom * nonZero(-3, 4);
        const y = y1 + (top * (x - x1)) / bottom;
        const slope = `${top < 0 ? "-" : ""}${Math.abs(top)}/${bottom}`;
        const inside = x1 === 0 ? `${x}` : `${x} ${x1 < 0 ? "+" : "−"} ${Math.abs(x1)}`;
        return {
          id: "",
          type: "numeric",
          prompt: `A line is written ${shift("y", y1)} = (${slope})(${shift("x", x1)}). What is y when x = ${x}?`,
          hint: `Put ${x} in for x, work out the right side, then get y by itself.`,
          answer: y,
          traps: trapsFor(y, [
            trap((top * (x - x1)) / bottom, `That is ${shift("y", y1)}. Move the ${Math.abs(y1)} across to get y.`),
            trap(y1 - (top * (x - x1)) / bottom, `${shift("y", y1)} = ${(top * (x - x1)) / bottom}: the ${Math.abs(y1)} moves across with its sign changed.`),
            x1 !== 0 ? trap(y1 + (top * (x + x1)) / bottom, `Inside the bracket it is ${inside}: check that sign.`) : null,
          ]),
          explanation: `${shift("y", y1)} = (${slope})(${inside}) → ${shift("y", y1)} = ${(top * (x - x1)) / bottom} → y = ${y}`,
        };
      }
      if (kind === 4) {
        // Where the line through a point crosses the x-axis.
        const m = nonZero(-4, 4);
        const root = randInt(-6, 8);
        const x1 = root + nonZero(-4, 4);
        const y1 = m * (x1 - root);
        return {
          id: "",
          type: "numeric",
          prompt: `A line passes through (${x1}, ${y1}) with slope ${m}. Where does it cross the x-axis? Type the x-value.`,
          hint: `Write ${shift("y", y1)} = ${m}(${shift("x", x1)}), then put 0 in for y and solve for x.`,
          answer: root,
          traps: trapsFor(root, [
            trap(y1 - m * x1, "That is the y-intercept, where x = 0. On the x-axis it is y that is 0."),
            trap(x1 + y1 / m, `With y = 0 the left side is ${-y1}: keep that sign as you solve.`),
            trap(-root, "Check the signs as each number moves across."),
          ]),
          explanation: `0 − ${par(y1)} = ${m}(${shift("x", x1)}) → ${-y1} = ${lin(m, -m * x1)} → ${coef(m)} = ${m * x1 - y1} → x = ${root}`,
        };
      }
      const x1 = nonZero(-5, 6);
      const y1 = nonZero(-6, 9);
      const m = nonZero(-4, 4);
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
    fillToCount("standard-form", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 1) {
        // The slope, read off by rearranging.
        const B = pick([2, 3, 4, 5, -2, -3]);
        let A = nonZero(-9, 9);
        while (Math.abs(A) === Math.abs(B)) A = nonZero(-9, 9);
        const C = randInt(-20, 20);
        let [a2, b2, c2] = [A, B, C];
        if (a2 < 0) [a2, b2, c2] = [-a2, -b2, -c2];
        const slope = -a2 / b2;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the slope of the line ${twoVar(a2, b2)} = ${c2}? Give it as a whole number or a fraction.`,
          hint: "Get y by itself: move the x term across, then divide every term by the number on y.",
          answer: slope,
          traps: trapsFor(slope, [
            trap(a2 / b2, "Moving the x term across the equals sign changes its sign."),
            trap(-b2 / a2, `That is upside down. Divide by the number on y, ${b2}.`),
            trap(-a2, `Every term gets divided by ${b2}, the x term included.`),
          ]),
          explanation: `${coef(b2, "y")} = ${lin(-a2, c2)} → the x term divided by ${b2} gives a slope of ${frac(-a2, b2)}`,
        };
      }
      if (kind === 2) {
        // Ticket sales: Ax + By = C with one count known.
        const adult = randInt(7, 15);
        const student = randInt(3, adult - 2);
        const a = randInt(8, 40);
        const s = randInt(8, 50);
        const total = adult * a + student * s;
        return {
          id: "",
          type: "numeric",
          prompt: `Adult tickets cost $${adult} and student tickets cost $${student}. Ticket sales came to $${total}, so ${adult}a + ${student}s = ${total}. If ${a} adult tickets were sold, how many student tickets were sold?`,
          hint: `Put ${a} in for a, then solve for s.`,
          answer: s,
          traps: trapsFor(s, [
            trap(Math.round(((total - a) / student) * 100) / 100, `Put ${a} in for a: the adult tickets bring in ${adult} × ${a} dollars.`),
            trap(total - adult * a, `That is the money from student tickets. Divide by $${student} a ticket to count them.`),
            trap(Math.round((total / student) * 100) / 100, `Take the adult money off first: ${adult} × ${a} dollars.`),
          ]),
          explanation: `${adult}(${a}) + ${student}s = ${total} → ${adult * a} + ${student}s = ${total} → ${student}s = ${total - adult * a} → s = ${s}`,
        };
      }
      if (kind === 3) {
        // Slope-intercept with a fraction slope, to standard form with whole numbers.
        const [top, bottom] = pick([[2, 3], [1, 2], [3, 4], [1, 3], [3, 2], [2, 5], [4, 3], [-2, 3], [-1, 2], [-3, 4], [-1, 3], [-3, 2]]);
        const b = nonZero(-6, 6);
        // y = (top/bottom)x + b  →  top·x − bottom·y = −bottom·b, with A > 0.
        let [A, B, C] = [top, -bottom, -bottom * b];
        if (A < 0) [A, B, C] = [-A, -B, -C];
        const answer = `${twoVar(A, B)} = ${C}`;
        const slope = `${top < 0 ? "-" : ""}(${Math.abs(top)}/${bottom})x`;
        const wrong = [`${twoVar(A, -B)} = ${C}`, `${twoVar(A, B)} = ${-C}`, `${twoVar(Math.abs(B), A > 0 ? -A : A)} = ${C}`, `${twoVar(A, B)} = ${b}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write y = ${slope}${plusTerm(b)} in standard form, Ax + By = C, with whole numbers and A positive.`,
          hint: `Multiply every term by ${bottom} to clear the fraction, then move the x term to the left side.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Moving a term across the equals sign changes its sign: check the y term."),
            trap(wrong[1], `Multiply every term by ${bottom}, the constant too, and keep its sign as it moves.`),
            trap(wrong[2], "The numbers on x and y traded places."),
            trap(wrong[3], `Multiply every term by ${bottom}, the constant included.`),
          ]),
          explanation: `Multiply by ${bottom}: ${bottom}y = ${lin(top, bottom * b)} → ${answer}`,
        };
      }
      if (kind === 4) {
        // A missing coordinate on a line in standard form.
        const B = pick([2, 3, 4, 5, -2, -3]);
        const A = nonZero(-6, 6);
        const x0 = randInt(-6, 6);
        const k = randInt(-8, 8);
        let [a2, b2, c2] = [A, B, A * x0 + B * k];
        if (a2 < 0) [a2, b2, c2] = [-a2, -b2, -c2];
        return {
          id: "",
          type: "numeric",
          prompt: `The point (${x0}, k) is on the line ${twoVar(a2, b2)} = ${c2}. What is k?`,
          hint: `Put ${x0} in for x, then solve for y.`,
          answer: k,
          traps: trapsFor(k, [
            trap(c2 - a2 * x0, `That is ${coef(b2, "y")}. Divide by ${b2} to finish.`),
            trap((c2 + a2 * x0) / b2, `${a2} times ${x0} is ${a2 * x0}; moving it across changes its sign.`),
            trap(Math.round(((c2 - x0) / b2) * 100) / 100, `Put ${x0} in for x, then multiply by ${a2}: the x term is ${a2 * x0}.`),
          ]),
          explanation: `${a2}(${x0})${plusTerm(b2, "y")} = ${c2} → ${coef(b2, "y")} = ${c2 - a2 * x0} → y = ${k}`,
        };
      }
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
      const kind = i % 5;
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
        // Parallel to a line in standard form, through a point.
        const B = pick([1, 2, 3, -1, -2]);
        let A = nonZero(-6, 6);
        while ((A / B) % 1 !== 0) A = nonZero(-6, 6);
        const m = -A / B;
        const C = randInt(-12, 12);
        let [a2, b2, c2] = [A, B, C];
        if (a2 < 0) [a2, b2, c2] = [-a2, -b2, -c2];
        const x0 = nonZero(-5, 5);
        const y0 = randInt(-8, 8);
        const b = y0 - m * x0;
        const answer = `y = ${lin(m, b)}`;
        const wrong = [`y = ${lin(-m, y0 + m * x0)}`, `y = ${lin(m, y0)}`, `y = ${lin(m, c2 / b2 === b ? b + 1 : c2 / b2)}`, `y = ${lin(-1 / m === Math.round(-1 / m) ? -1 / m : -m, b)}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which line is parallel to ${twoVar(a2, b2)} = ${c2} and passes through (${x0}, ${y0})?`,
          hint: "Find the given line's slope by getting y by itself. A parallel line has the same slope; use the point to find its b.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Moving the x term across changes its sign: check the slope's sign."),
            trap(wrong[1], `${y0} is the point's y-value. Solve for b with the point.`),
            trap(wrong[2], "That keeps the old line's y-intercept. A parallel line through a new point has its own."),
            trap(wrong[3], "Parallel lines have the same slope, not a flipped one."),
          ]),
          explanation: `${coef(b2, "y")} = ${lin(-a2, c2)} → slope ${m} → ${y0} = ${m}(${x0}) + b → b = ${b} → ${answer}`,
        };
      }
      if (kind === 2) {
        // Perpendicular through a point: the new line's y-intercept.
        let m = nonZero(-5, 5);
        while (Math.abs(m) === 1) m = nonZero(-5, 5);
        const b = randInt(-6, 6);
        const x0 = m * nonZero(-3, 3);
        const y0 = randInt(-8, 8);
        // Perpendicular slope -1/m; b' = y0 + x0/m.
        const b2 = y0 + x0 / m;
        return {
          id: "",
          type: "numeric",
          prompt: `A line passes through (${x0}, ${y0}) and is perpendicular to y = ${lin(m, b)}. What is its y-intercept?`,
          hint: `A perpendicular slope is the negative reciprocal of ${m}. Put it and the point into y = mx + b.`,
          answer: b2,
          traps: trapsFor(b2, [
            trap(y0 - m * x0, `That uses the slope ${m}, which makes a parallel line. Perpendicular takes the negative reciprocal.`),
            trap(y0 - x0 / m, "The perpendicular slope is negative: flip it and change its sign."),
            trap(b, "That is the first line's y-intercept. The new line has its own."),
          ]),
          explanation: `slope = ${frac(-1, m)} → ${y0} = ${frac(-1, m)}(${x0}) + b → ${y0} = ${-x0 / m} + b → b = ${b2}`,
        };
      }
      if (kind === 3) {
        // Parallel, perpendicular or neither, from two different forms.
        const relation = pick(["Parallel", "Perpendicular", "Neither"] as const);
        const [top, bottom] = pick([[2, 3], [1, 2], [3, 4], [3, 2], [2, 5], [1, 3], [4, 3], [5, 2]]);
        const sign = pick([1, -1]);
        const m1 = (sign * top) / bottom;
        const slope1 = `${sign < 0 ? "-" : ""}(${top}/${bottom})x`;
        // The second line in standard form with slope m2 = -A/B.
        const m2 = relation === "Parallel" ? m1 : relation === "Perpendicular" ? -1 / m1 : -m1;
        // m2 = p/q in lowest terms → A = -p, B = q.
        const den = relation === "Parallel" ? bottom : relation === "Perpendicular" ? top : bottom;
        const num = Math.round(m2 * den);
        let [A, B] = [-num, den];
        if (A < 0) [A, B] = [-A, -B];
        const b1 = randInt(-6, 6);
        let C = randInt(-12, 12);
        if (C / B === b1) C += 1;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Are the lines y = ${slope1}${plusTerm(b1)} and ${twoVar(A, B)} = ${C} parallel, perpendicular, or neither?`,
          hint: "Get both slopes. Equal slopes are parallel; slopes that multiply to -1 are perpendicular.",
          answer: relation,
          choices: mcChoices(relation, ["Parallel", "Perpendicular", "Neither", "The same line"]),
          traps: trapsFor(relation, [
            trap("Parallel", "Parallel needs exactly the same slope. Get the second slope by solving for y."),
            trap("Perpendicular", "Perpendicular slopes multiply to -1. Opposite signs alone are not enough."),
            trap("Neither", "Find the second slope by solving for y, then compare: the same slope, or a product of -1?"),
            trap("The same line", "The same line needs the same slope and the same y-intercept."),
          ]),
          explanation: `The first slope is ${frac(sign * top, bottom)}. ${coef(B, "y")} = ${lin(-A, C)} gives a slope of ${frac(-A, B)}. ${relation === "Parallel" ? "They are equal: parallel." : relation === "Perpendicular" ? "They multiply to -1: perpendicular." : "They are neither equal nor multiply to -1: neither."}`,
        };
      }
      // The value that makes two lines perpendicular.
      const [top, bottom] = pick([[1, 4], [1, 3], [1, 2], [2, 3], [3, 2], [1, 5], [3, 4], [2, 5], [4, 3], [1, 6]]);
      const sign = pick([1, -1]);
      const k = (-sign * bottom) / top;
      const given = `${sign < 0 ? "-" : ""}(${top}/${bottom})x`;
      return {
        id: "",
        type: "numeric",
        prompt: `For what value of k is the line y = kx${plusTerm(nonZero(-6, 6))} perpendicular to y = ${given}${plusTerm(randInt(-9, 9))}? Give it as a whole number or a fraction.`,
        hint: "Perpendicular slopes multiply to -1: k is the negative reciprocal.",
        answer: k,
        traps: trapsFor(k, [
          trap((sign * top) / bottom, "That makes the lines parallel. Perpendicular takes the negative reciprocal."),
          trap((sign * bottom) / top, "Flipped, but the sign also has to change."),
          trap((-sign * top) / bottom, "The sign changed, and the fraction also has to flip."),
        ]),
        explanation: `${frac(sign * top, bottom)} × k = -1 → k = ${frac(-sign * bottom, top)}`,
      };
    }),

  "graphing-systems": (seeds) =>
    fillToCount("graphing-systems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 2) {
        // Two candles burning down: when are they the same height?
        const t = randInt(2, 8);
        const r2 = randInt(1, 3);
        const r1 = r2 + randInt(1, 3);
        const h2 = r2 * t + randInt(4, 12);
        const h1 = h2 + (r1 - r2) * t;
        return {
          id: "",
          type: "numeric",
          prompt: `Candle A is ${h1} cm tall and burns down ${r1} cm an hour. Candle B is ${h2} cm tall and burns down ${r2} cm an hour. After how many hours are they the same height?`,
          hint: `Write each height as a line: A = ${h1} − ${r1}t and B = ${h2} − ${r2}t. Where the lines cross, the heights match.`,
          answer: t,
          traps: trapsFor(t, [
            trap(h1 - r1 * t, "That is the height when they match. The question asks how many hours it takes."),
            trap(Math.round(((h1 - h2) / (r1 + r2)) * 100) / 100, `Moving ${r2}t across the equals sign changes its sign: the gap closes by ${r1} − ${r2} cm an hour.`),
            trap(h1 - h2, `That is the head start in cm. It closes by ${r1 - r2} cm each hour.`),
          ]),
          explanation: `${h1} − ${r1}t = ${h2} − ${r2}t → ${h1 - h2} = ${r1 - r2}t → t = ${t} hours`,
        };
      }
      if (kind === 3) {
        // How many solutions: the same line, parallel lines, or crossing lines.
        const outcome = pick(["One", "None", "Infinitely many"] as const);
        const m = nonZero(-4, 4);
        const b = randInt(-6, 6);
        const B = pick([2, 3, -2, -1, 1]);
        const m2 = outcome === "One" ? m + nonZero(-2, 2) : m;
        const b2 = outcome === "Infinitely many" ? b : outcome === "None" ? b + nonZero(-4, 4) : randInt(-6, 6);
        // m2 x − y = −b2, scaled by B: (B m2) x − B y = −B b2, A kept positive.
        let [A, Bv, C] = [B * m2, -B, -B * b2];
        if (A < 0) [A, Bv, C] = [-A, -Bv, -C];
        const second = `${twoVar(A, Bv)} = ${C}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `How many solutions does the system y = ${lin(m, b)} and ${second} have?`,
          hint: "Get the second equation into y = mx + b. Different slopes cross once; the same slope is parallel or the very same line.",
          answer: outcome,
          choices: mcChoices(outcome, ["One", "None", "Infinitely many", "Two"]),
          traps: trapsFor(outcome, [
            trap("One", "Lines with the same slope never cross at a single point: they are parallel, or they are the same line."),
            trap("None", outcome === "Infinitely many" ? "Same slope and the same y-intercept: it is the same line, so every point on it works." : "Different slopes cross exactly once."),
            trap("Infinitely many", "That needs the very same line: the same slope and the same y-intercept."),
            trap("Two", "Two straight lines cross at most once, unless they are the same line."),
          ]),
          explanation: `${coef(Bv, "y")} = ${lin(-A, C)} → y = ${lin(m2, b2)}. ${outcome === "One" ? `Slopes ${m} and ${m2} differ, so the lines cross once.` : outcome === "None" ? `Same slope, ${m}, different y-intercepts: parallel, so no solution.` : "Same slope and same y-intercept: the same line, so infinitely many solutions."}`,
        };
      }
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
      const kind = i % 4;
      if (kind === 1) {
        // x already alone: put it into the other equation.
        const y = nonZero(-6, 8);
        const p = pick([2, 3, -2, 4, -3]);
        const q = randInt(-6, 6);
        const x = p * y + q;
        const a = randInt(2, 5);
        let b = randInt(1, 5);
        if (a * p === b) b += 1;
        const c = a * x - b * y;
        const askY = randInt(0, 2) > 0;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve: x = ${lin(p, q, "y")} and ${a}x − ${coef(b, "y")} = ${c}. What is ${askY ? "y" : "x"}?`,
          hint: `Put ${lin(p, q, "y")} in for x in the second equation, in brackets: ${a}(${lin(p, q, "y")}) − ${coef(b, "y")} = ${c}.`,
          answer: askY ? y : x,
          traps: trapsFor(askY ? y : x, [
            trap(askY ? x : y, askY ? "That is x. The question asks for y." : `That is y. Put it into x = ${lin(p, q, "y")} to get x.`),
            trap(Math.round(((c - q) / (a * p - b)) * 100) / 100, `The ${a} multiplies the whole bracket, the ${Math.abs(q)} too.`),
          ]),
          explanation: `${a}(${lin(p, q, "y")}) − ${coef(b, "y")} = ${c} → ${lin(a * p - b, a * q, "y")} = ${c} → y = ${y}${askY ? "" : ` → x = ${p}(${y})${plusTerm(q)} = ${x}`}`,
        };
      }
      if (kind === 2) {
        // y alone in the first, a coefficient on y in the second.
        const x = nonZero(-5, 7);
        const m = nonZero(-3, 4);
        const b = randInt(-6, 6);
        const y = m * x + b;
        const a = randInt(1, 5);
        let c = pick([2, 3, -2, -3, 4]);
        if (a + c * m === 0) c = c > 0 ? c + 1 : c - 1;
        const d = a * x + c * y;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve: y = ${lin(m, b)} and ${twoVar(a, c)} = ${d}. What is x?`,
          hint: `Put ${lin(m, b)} in for y, in brackets: ${coef(a)}${c < 0 ? " − " : " + "}${Math.abs(c)}(${lin(m, b)}) = ${d}. Distribute, then solve.`,
          answer: x,
          traps: trapsFor(x, [
            trap(y, "That is y. The question asks for x."),
            trap(Math.round(((d - b) / (a + c * m)) * 100) / 100, `The ${c} multiplies the whole bracket, the ${Math.abs(b)} too.`),
            trap(Math.round(((d - c * b) / (a + m)) * 100) / 100, `The ${c} multiplies the x term in the bracket as well.`),
          ]),
          explanation: `${coef(a)}${c < 0 ? " − " : " + "}${Math.abs(c)}(${lin(m, b)}) = ${d} → ${lin(a + c * m, c * b)} = ${d} → ${coef(a + c * m)} = ${d - c * b} → x = ${x}`,
        };
      }
      if (kind === 3) {
        // Ages now and later.
        const [p1, p2] = pickTwo(NAMES);
        const k = randInt(2, 4);
        const young = randInt(3, 12);
        const old = k * young;
        const later = randInt(2, 8);
        const sum = old + young + 2 * later;
        return {
          id: "",
          type: "numeric",
          prompt: `${p1} is ${k} times as old as ${p2}. In ${later} years, their ages will add up to ${sum}. How old is ${p1} now?`,
          hint: `Let ${p2}'s age be a, so ${p1} is ${k}a. In ${later} years: (${k}a + ${later}) + (a + ${later}) = ${sum}.`,
          answer: old,
          traps: trapsFor(old, [
            trap(young, `That is ${p2}'s age. ${p1} is ${k} times as old.`),
            trap(old + later, `That is ${p1}'s age in ${later} years. The question asks about now.`),
            trap((sum - later) / (k + 1) * k, `Both of them get ${later} years older: take off ${2 * later}, not ${later}.`),
          ]),
          explanation: `(${k}a + ${later}) + (a + ${later}) = ${sum} → ${k + 1}a + ${2 * later} = ${sum} → a = ${young} → ${p1} is ${k} × ${young} = ${old}`,
        };
      }
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
          : `${coef(a)} + (${lin(m, b)}) = ${total} → ${lin(a + m, b)} = ${total} → x = ${x} → y = ${evalLin(m, b, x)}`,
      };
    }),

  elimination: (seeds) =>
    fillToCount("elimination", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const x = nonZero(-5, 9);
      const y = nonZero(-6, 8);
      if (kind === 0) {
        const xs = randInt(1, 10);
        const ys = randInt(-4, 9);
        const sum = xs + ys;
        const diff = xs - ys;
        return {
          id: "",
          type: "step-order",
          prompt: `Order the steps to solve: x + y = ${sum} and x − y = ${diff}`,
          hint: "Adding the equations cancels y.",
          correctOrder: [0, 1, 2, 3],
          steps: [`Add the equations: 2x = ${2 * xs}`, `Solve: x = ${xs}`, "Put x into the first equation", `Solve for y: y = ${ys}`],
          explanation: "Adding the equations cancels y straight away; then x goes back in to find y.",
        };
      }
      if (kind === 2) {
        // Multiply one equation so the y terms cancel.
        const a = randInt(1, 4);
        const b = randInt(1, 4);
        const k = randInt(2, 3);
        const d = randInt(1, 5);
        const c = a * x + b * y;
        const f = d * x - k * b * y;
        const askX = randInt(0, 1) === 0;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve: ${twoVar(a, b)} = ${c} and ${twoVar(d, -k * b)} = ${f}. What is ${askX ? "x" : "y"}?`,
          hint: `Multiply the first equation by ${k}, so its y term is ${coef(k * b, "y")}. Then add the equations: the y terms cancel.`,
          answer: askX ? x : y,
          traps: trapsFor(askX ? x : y, [
            trap(askX ? y : x, askX ? "That is y. The question asks for x." : "That is x. Put it back into one equation to find y."),
            trap(Math.round(((c + f) / (a + d)) * 100) / 100, `Adding straight away leaves ${coef(b - k * b, "y")}. Multiply the first equation by ${k} first, every term of it.`),
            trap(Math.round(((k * c + f) / (a + d)) * 100) / 100, `Multiply every term of the first equation by ${k}, the x term too: ${coef(k * a)}.`),
          ]),
          explanation: `×${k}: ${twoVar(k * a, k * b)} = ${k * c} → add: ${coef(k * a + d)} = ${k * c + f} → x = ${x}${askX ? "" : ` → ${a}(${x})${plusTerm(b, "y")} = ${c} → y = ${y}`}`,
        };
      }
      if (kind === 3) {
        // Multiply both equations to line up the x terms.
        const [a1, a2] = pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 2], [4, 3], [5, 2]]);
        const b1 = nonZero(-4, 5);
        let b2 = nonZero(-4, 5);
        while (a1 * b2 - a2 * b1 === 0 || b1 === b2) b2 = nonZero(-4, 5);
        const c1 = a1 * x + b1 * y;
        const c2 = a2 * x + b2 * y;
        const askY = randInt(0, 1) === 0;
        const L = lcm(a1, a2);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve: ${twoVar(a1, b1)} = ${c1} and ${twoVar(a2, b2)} = ${c2}. What is ${askY ? "y" : "x"}?`,
          hint: `Make the x terms match: multiply the first equation by ${L / a1} and the second by ${L / a2}, then subtract.`,
          answer: askY ? y : x,
          traps: trapsFor(askY ? y : x, [
            trap(askY ? x : y, askY ? "That is x. The question asks for y." : "That is y. Put it back into one equation to find x."),
            trap(Math.round(((c1 * (L / a1) + c2 * (L / a2)) / ((L / a1) * b1 + (L / a2) * b2)) * 100) / 100, "With the x terms matching, subtract the equations so they cancel; adding doubles them."),
            trap(Math.round(((c1 * (L / a1) - c2) / ((L / a1) * b1 - b2)) * 100) / 100, `Multiply both equations, every term: the second one by ${L / a2} too.`),
          ]),
          explanation: `×${L / a1} and ×${L / a2}: ${twoVar(L, (L / a1) * b1)} = ${(L / a1) * c1} and ${twoVar(L, (L / a2) * b2)} = ${(L / a2) * c2} → subtract: ${coef((L / a1) * b1 - (L / a2) * b2, "y")} = ${(L / a1) * c1 - (L / a2) * c2} → y = ${y}${askY ? "" : ` → x = ${x}`}`,
        };
      }
      if (kind === 4) {
        // Two receipts: same number of notebooks, so subtracting leaves the pens.
        const pen = randInt(1, 4);
        const book = randInt(2, 9);
        const p1 = randInt(3, 7);
        const p2 = randInt(1, p1 - 1);
        const n = randInt(2, 4);
        const t1 = p1 * pen + n * book;
        const t2 = p2 * pen + n * book;
        const askBook = randInt(0, 1) === 0;
        return {
          id: "",
          type: "numeric",
          prompt: `${p1} pens and ${n} notebooks cost $${t1}. ${p2} ${p2 === 1 ? "pen" : "pens"} and ${n} notebooks cost $${t2}. How many dollars does one ${askBook ? "notebook" : "pen"} cost?`,
          hint: `Write ${p1}p + ${n}n = ${t1} and ${p2 === 1 ? "" : p2}p + ${n}n = ${t2}. Subtract them: the notebooks cancel.`,
          answer: askBook ? book : pen,
          traps: trapsFor(askBook ? book : pen, [
            trap(askBook ? pen : book, askBook ? "That is the price of a pen. Put it back in to find a notebook." : "That is the price of a notebook. The question asks for a pen."),
            trap(t1 - t2, `That is the cost of ${p1 - p2} pens. Divide by ${p1 - p2}.`),
            trap(Math.round((t1 / (p1 + n)) * 100) / 100, "Pens and notebooks cost different amounts, so the total cannot be split evenly. Subtract the receipts first."),
          ]),
          explanation: `(${p1}p + ${n}n) − (${p2 === 1 ? "" : p2}p + ${n}n) = ${t1} − ${t2} → ${coef(p1 - p2, "p")} = ${t1 - t2} → p = ${pen}${askBook ? ` → ${p1}(${pen}) + ${n}n = ${t1} → n = ${book}` : ""}`,
        };
      }
      // Two coefficients on x, and y cancelling: ax + y and cx − y.
      const a = pick([1, 1, 2, 3]);
      const c = pick([1, 2, 3]);
      const xx = randInt(1, 10);
      const yy = randInt(-4, 9);
      const s1 = a * xx + yy;
      const s2 = c * xx - yy;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve: ${coef(a)} + y = ${s1} and ${coef(c)} − y = ${s2}. What is x?`,
        hint: "Add the two equations: the y terms cancel.",
        answer: xx,
        traps: trapsFor(xx, [
          trap(yy, "That is y. The question asks for x."),
          trap(s1 + s2, `Adding the equations gives ${coef(a + c)} on the left. Divide by ${a + c} to get x.`),
          trap((s1 - s2) / (a - c || 1), "Subtracting the equations keeps the y terms (y − (−y) = 2y). Adding them is what makes y cancel."),
        ]),
        explanation: `Add them: ${coef(a + c)} = ${s1 + s2} → x = ${xx}`,
      };
    }),

  "systems-word-problems": (seeds) =>
    fillToCount("systems-word-problems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
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
          explanation: `a + c = ${total} and ${adultPrice}a + ${childPrice}c = ${cost} → ${adultPrice}a + ${childPrice}(${total} − a) = ${cost} → ${adultPrice - childPrice}a = ${cost - childPrice * total} → a = ${adults}`,
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
          explanation: `t + h = ${shots} and 2t + 3h = ${points} → 2(${shots} − h) + 3h = ${points} → h = ${points - 2 * shots}`,
        };
      }
      if (kind === 2) {
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
          explanation: `q + d = ${coins} and 25q + 10d = ${cents} → 25q + 10(${coins} − q) = ${cents} → 15q = ${cents - 10 * coins} → q = ${quarters}`,
        };
      }
      if (kind === 3) {
        // A coffee blend from two prices.
        const cheap = randInt(6, 10);
        const dear = cheap + randInt(3, 6);
        const pounds = pick([10, 20, 25, 50]);
        const a = randInt(1, pounds - 1);
        const value = a * cheap + (pounds - a) * dear;
        return {
          id: "",
          type: "numeric",
          prompt: `A coffee shop mixes beans that cost $${cheap} a pound with beans that cost $${dear} a pound. It makes ${pounds} pounds of a blend worth $${money(value / pounds)} a pound. How many pounds of the $${cheap} beans go in?`,
          hint: `Let c + d = ${pounds}, and the money: ${cheap}c + ${dear}d = ${pounds} × ${money(value / pounds)}.`,
          answer: a,
          traps: trapsFor(a, [
            trap(pounds - a, `That is the pounds of the $${dear} beans. The question asks for the $${cheap} ones.`),
            trap(pounds / 2, "Half and half only works when the blend's price is exactly halfway between the two."),
            trap(value, "That is what the whole blend is worth. Set up the two equations and solve for the pounds."),
          ]),
          explanation: `c + d = ${pounds} and ${cheap}c + ${dear}d = ${value} → ${cheap}c + ${dear}(${pounds} − c) = ${value} → ${dear * pounds} − ${dear - cheap}c = ${value} → c = ${a}`,
        };
      }
      // A boat with and against the current.
      const t1 = randInt(1, 3);
      const t2 = t1 + randInt(1, 3);
      let k = randInt(2, 6);
      if ((k * (t1 + t2)) % 2 === 1) k += 1;
      const down = t2 * k;
      const up = t1 * k;
      const boat = (down + up) / 2;
      const current = (down - up) / 2;
      const miles = t1 * down;
      const askCurrent = randInt(0, 1) === 0;
      return {
        id: "",
        type: "numeric",
        prompt: `A boat travels ${miles} miles downstream in ${t1 === 1 ? "1 hour" : `${t1} hours`} and the same ${miles} miles back upstream in ${t2} hours. What is the speed of the ${askCurrent ? "current" : "boat in still water"}, in miles per hour?`,
        hint: `Downstream the speeds add: b + c = ${miles} ÷ ${t1}. Upstream the current slows it: b − c = ${miles} ÷ ${t2}.`,
        answer: askCurrent ? current : boat,
        traps: trapsFor(askCurrent ? current : boat, [
          trap(askCurrent ? boat : current, askCurrent ? "That is the boat's own speed. Subtract the equations to find the current." : "That is the current. Add the equations to find the boat's speed."),
          trap(down, "That is the speed going downstream, boat and current together."),
          trap(up, "That is the speed going upstream, the current slowing the boat."),
        ]),
        explanation: `b + c = ${down} and b − c = ${up} → ${askCurrent ? `subtract: 2c = ${down - up} → c = ${current}` : `add: 2b = ${down + up} → b = ${boat}`}`,
      };
    }),

  "graphing-inequalities": (seeds) =>
    fillToCount("graphing-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const m = nonZero(-4, 4);
      const b = randInt(-6, 6);
      const sym = pick(["<", ">", "≤", "≥"] as const);
      const strict = sym === "<" || sym === ">";
      const above = sym === ">" || sym === "≥";
      const ineq = `y ${sym} ${lin(m, b)}`;
      if (kind === 1) {
        // Which point is a solution: test each one.
        const holds = (x: number, y: number) => {
          const v = m * x + b;
          return sym === ">" ? y > v : sym === "<" ? y < v : sym === "≥" ? y >= v : y <= v;
        };
        const x0 = randInt(-3, 3);
        const line = m * x0 + b;
        const good = above ? line + randInt(1, 4) : line - randInt(1, 4);
        const answer = `(${x0}, ${good})`;
        const cands: [number, number][] = [
          [x0, above ? line - randInt(1, 4) : line + randInt(1, 4)],
          [x0 + 1, above ? m * (x0 + 1) + b - 2 : m * (x0 + 1) + b + 2],
          [good, x0],
          strict ? [x0 - 1, m * (x0 - 1) + b] : [x0 - 1, above ? m * (x0 - 1) + b - 1 : m * (x0 - 1) + b + 1],
        ];
        const off = cands.filter(([x, y]) => !holds(x, y));
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which point is a solution of ${ineq}?`,
          hint: "Put each point's x into the right side. The point works when its y makes the inequality true.",
          answer,
          choices: mcChoices(answer, off.map(([x, y]) => `(${x}, ${y})`)),
          traps: trapsFor(
            answer,
            off.map(([x, y]) =>
              trap(`(${x}, ${y})`, y === m * x + b ? `That point sits right on the line, and ${sym} leaves the line out.` : `Put that point's x into ${lin(m, b)} and compare: its y makes ${sym} false.`)
            )
          ),
          explanation: `At x = ${x0}, ${lin(m, b)} = ${line}, and ${good} ${sym} ${line} is true, so ${answer} works.`,
        };
      }
      if (kind === 2) {
        // Solving for y flips the sign when y's coefficient is negative.
        const B = randInt(2, 4);
        const A = nonZero(-6, 6);
        const C = B * randInt(-5, 5);
        const FL = { ">": "<", "<": ">", "≥": "≤", "≤": "≥" } as const;
        const slope = fracX(A, B);
        const answer = `y ${FL[sym]} ${slope}${plusTerm(-C / B)}`;
        const wrong = [`y ${sym} ${slope}${plusTerm(-C / B)}`, `y ${FL[sym]} ${fracX(-A, B)}${plusTerm(-C / B)}`, `y ${FL[sym]} ${slope}${plusTerm(C / B)}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which inequality is ${twoVar(A, -B)} ${sym} ${C} solved for y?`,
          hint: `Move the x term across, then divide every term by -${B}. Dividing by a negative flips the sign.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Dividing by -${B}, a negative, flips the inequality sign.`),
            trap(wrong[1], "Moving the x term across changes its sign, and dividing by the negative changes it back."),
            trap(wrong[2], `Divide the constant by -${B} too: its sign changes.`),
          ]),
          explanation: `${coef(-B, "y")} ${sym} ${lin(-A, C)} → divide by -${B} and flip: ${answer}`,
        };
      }
      if (kind === 3 || kind === 4) {
        // A snack budget as an inequality.
        const who = pick(NAMES);
        const chip = randInt(2, 4);
        let drink = randInt(2, 5);
        if (drink === chip) drink += 1;
        const budget = 5 * randInt(6, 12);
        if (kind === 3) {
          const answer = `${chip}x + ${drink}y ≤ ${budget}`;
          const wrong = [`${chip}x + ${drink}y ≥ ${budget}`, `${drink}x + ${chip}y ≤ ${budget}`, `x + y ≤ ${budget}`];
          return {
            id: "",
            type: "multiple-choice",
            prompt: `${who} can spend at most $${budget} on snacks. Chips cost $${chip} a bag and drinks cost $${drink} each. Which inequality shows the bags of chips, x, and drinks, y, that ${who} can buy?`,
            hint: "The cost is the price of each item times how many. At most means the cost is less than or equal to the budget.",
            answer,
            choices: mcChoices(answer, wrong),
            traps: trapsFor(answer, [
              trap(wrong[0], "At most means the cost stays at or under the budget: ≤."),
              trap(wrong[1], "Each price goes with its own item: chips with x, drinks with y."),
              trap(wrong[2], "That counts items. The budget is in dollars, so each count is multiplied by its price."),
            ]),
            explanation: `chips cost ${chip}x and drinks ${drink}y, and together they stay at or under $${budget}: ${answer}`,
          };
        }
        const bags = randInt(2, Math.floor(budget / chip) - 3);
        const most = Math.floor((budget - chip * bags) / drink);
        return {
          id: "",
          type: "numeric",
          prompt: `${who} can spend at most $${budget} on snacks. Chips cost $${chip} a bag and drinks cost $${drink} each. ${who} buys ${bags} bags of chips. What is the greatest number of drinks ${who} can also buy?`,
          hint: `Write ${chip}(${bags}) + ${drink}y ≤ ${budget} and solve for y. Only whole drinks count.`,
          answer: most,
          traps: trapsFor(most, [
            trap(Math.floor(budget / drink), `The chips take ${chip} × ${bags} dollars out of the budget first.`),
            trap(most + 1, `${most + 1} drinks would bring the total over $${budget}.`),
            trap(budget - chip * bags, "That is the money left for drinks. Divide by the price of a drink."),
          ]),
          explanation: `${chip}(${bags}) + ${drink}y ≤ ${budget} → ${drink}y ≤ ${budget - chip * bags} → y ≤ ${fmtNum(Math.round(((budget - chip * bags) / drink) * 100) / 100)} → the most is ${most}`,
        };
      }
      // How the graph looks: the line, and the side.
      const answer = `${strict ? "Dashed" : "Solid"} line, shade ${above ? "above" : "below"}`;
      const all = ["Solid line, shade above", "Solid line, shade below", "Dashed line, shade above", "Dashed line, shade below"];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `How do you graph ${ineq}?`,
        hint: "< and > leave the line out (dashed); ≤ and ≥ include it (solid). With y alone, > and ≥ shade above, < and ≤ below.",
        answer,
        choices: mcChoices(answer, all),
        traps: trapsFor(
          answer,
          all.map((c) =>
            trap(c, c.startsWith(strict ? "Solid" : "Dashed") ? (strict ? "< and > leave the line itself out, so the boundary is dashed." : "≤ and ≥ include the line itself, so the boundary is solid.") : "With y by itself, > and ≥ mean y-values above the line, and < and ≤ below it.")
          )
        ),
        explanation: `${sym} ${strict ? "leaves out" : "includes"} the line, so it is ${strict ? "dashed" : "solid"}; the solutions have y-values ${above ? "above" : "below"} it.`,
      };
    }),

  "compound-inequalities": (seeds) =>
    fillToCount("compound-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
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
      if (kind === 2) {
        // A negative coefficient in the middle: both signs flip.
        const k = nonZero(-4, 9);
        const L = randInt(-6, 3);
        const U = L + randInt(2, 7);
        const hi = k - a * L;
        const lo = k - a * U;
        const correct = `${L} < x ≤ ${U}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${lo} ≤ ${k} − ${a}x < ${hi}`,
          hint: `Subtract ${k} from all three parts, then divide all three by -${a}. Dividing by a negative flips both signs.`,
          answer: correct,
          choices: mcChoices(correct, [`${L} ≤ x < ${U}`, `${-U} < x ≤ ${-L}`, `x ≤ ${L} or x > ${U}`, `${lo - k} ≤ x < ${hi - k}`]),
          traps: trapsFor(correct, [
            trap(`${L} ≤ x < ${U}`, `Dividing by -${a} flips both signs, so the ≤ and the < trade ends.`),
            trap(`${-U} < x ≤ ${-L}`, `Dividing by -${a} changes the signs of the numbers too.`),
            trap(`x ≤ ${L} or x > ${U}`, "Flipping the signs keeps x between two numbers; it does not split it in two."),
            trap(`${lo - k} ≤ x < ${hi - k}`, `That is -${a}x after subtracting ${k}. Divide all three parts by -${a} and flip.`),
          ]),
          explanation: `${lo} ≤ ${k} − ${a}x < ${hi} → ${lo - k} ≤ -${a}x < ${hi - k} → divide by -${a} and flip: ${U} ≥ x > ${L} → ${correct}`,
        };
      }
      if (kind === 3) {
        // The third test score that earns a B.
        let [lo, hi, s1, s2] = [80, 90, 88, 92];
        for (let tries = 0; tries < 30; tries += 1) {
          const l = pick([70, 75, 80]);
          const h = l + pick([5, 10]);
          const a1 = randInt(70, 98);
          const a2 = randInt(70, 98);
          if (3 * h - a1 - a2 <= 100 && 3 * h - 3 * l >= 15) {
            [lo, hi, s1, s2] = [l, h, a1, a2];
            break;
          }
        }
        const L = 3 * lo - s1 - s2;
        const U = 3 * hi - s1 - s2;
        const correct = `${L} ≤ x < ${U}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `To earn a B, the average of three test scores must be at least ${lo} and less than ${hi}. You scored ${s1} and ${s2} on the first two tests. Which scores x on the third test earn a B?`,
          hint: `Write ${lo} ≤ (${s1} + ${s2} + x)/3 < ${hi}. Multiply all three parts by 3, then subtract ${s1 + s2}.`,
          answer: correct,
          choices: mcChoices(correct, [`${lo} ≤ x < ${hi}`, `${L} < x ≤ ${U}`, `${3 * lo} ≤ x < ${3 * hi}`, `x ≥ ${L}`]),
          traps: trapsFor(correct, [
            trap(`${lo} ≤ x < ${hi}`, "Those are the limits for the average. The third score is what pulls the average into that range."),
            trap(`${L} < x ≤ ${U}`, "At least means the low end counts (≤), and less than leaves the high end out (<)."),
            trap(`${3 * lo} ≤ x < ${3 * hi}`, `Those are the totals for all three tests. Take off the ${s1 + s2} already scored.`),
            trap(`x ≥ ${L}`, `There is a ceiling too: the average must stay under ${hi}.`),
          ]),
          explanation: `${lo} ≤ (${s1 + s2} + x)/3 < ${hi} → ${3 * lo} ≤ ${s1 + s2} + x < ${3 * hi} → ${correct}`,
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
    fillToCount("systems-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 1) {
        // One inequality in standard form, one with y alone.
        const s = randInt(2, 9);
        const m = nonZero(-3, 3);
        const b = randInt(-5, 3);
        const ok = (x: number, y: number) => x + y < s && y >= m * x + b;
        const pts: [number, number][] = [];
        for (let x = -4; x <= 6; x += 1) for (let y = -8; y <= 10; y += 1) pts.push([x, y]);
        const good = pts.filter(([x, y]) => ok(x, y));
        const [gx, gy] = good[randInt(0, good.length - 1)] ?? [0, b];
        const answer = `(${gx}, ${gy})`;
        // Near misses: each breaks one of the two.
        const fails: [number, number][] = [
          [gx, s - gx + randInt(0, 2)],
          [gx, m * gx + b - randInt(1, 3)],
          [gx + randInt(1, 3), s - gx],
          [gx - 2, m * (gx - 2) + b - 1],
        ];
        const wrong = fails.filter(([x, y]) => !ok(x, y)).map(([x, y]) => `(${x}, ${y})`);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which point satisfies x + y < ${s} AND y ≥ ${lin(m, b)}?`,
          hint: "Test each point in both inequalities. It has to pass both.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, wrong.map((w) => trap(w, "Put that point into both inequalities: one of them comes out false. AND needs both true."))),
          explanation: `${answer}: ${gy === 0 ? `${gx}` : `${gx} + ${par(gy)}`} = ${gx + gy} < ${s} ✓ and ${gy} ≥ ${evalLin(m, b, gx).split(" = ").pop()} ✓`,
        };
      }
      if (kind === 2) {
        // A bake sale plan that meets both limits.
        const cookie = randInt(1, 2);
        const brownie = cookie + randInt(1, 2);
        const most = 5 * randInt(4, 8);
        const goal = 5 * randInt(Math.ceil((cookie * most * 0.6) / 5), Math.floor((brownie * most * 0.8) / 5));
        const ok = (c: number, b: number) => c + b <= most && cookie * c + brownie * b >= goal;
        const plans: [number, number][] = [];
        for (let c = 0; c <= most; c += 1) for (let b = 0; b <= most; b += 1) if (c + b <= most + 6) plans.push([c, b]);
        const good = plans.filter(([c, b]) => ok(c, b) && c >= 2 && b >= 2);
        const [gc, gb] = good.length ? good[randInt(0, good.length - 1)] : [2, most - 2];
        const answer = `${gc} cookies and ${gb} brownies`;
        const fails: [number, number][] = [
          [gc + 4, gb + 4],
          [Math.max(0, gc - 6), Math.max(0, gb - 6)],
          [gb + 6, gc + 6],
          [most, 3],
          [3, Math.max(0, Math.floor(goal / brownie) - 4)],
        ];
        const wrong = fails.filter(([c, b]) => !ok(c, b)).map(([c, b]) => `${c} cookies and ${b} brownies`);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A club sells cookies for $${cookie} and brownies for $${brownie}. It wants to raise at least $${goal} and can bake at most ${most} treats. Which plan works?`,
          hint: `Write c + b ≤ ${most} and ${cookie === 1 ? "" : cookie}c + ${brownie}b ≥ ${goal}. A plan has to pass both.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, wrong.map((w) => trap(w, `Check both limits for that plan: the number of treats against ${most}, and the money against $${goal}.`))),
          explanation: `${gc} + ${gb} = ${gc + gb} ≤ ${most} ✓ and ${cookie}(${gc}) + ${brownie}(${gb}) = ${cookie * gc + brownie * gb} ≥ ${goal} ✓`,
        };
      }
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
      const kind = i % 6;
      const a = randInt(1, 5);
      const b = randInt(-6, 8);
      const x = randInt(-4, 6);
      const lead = a === 1 ? "" : `${a}`;
      if (kind === 1) {
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
      if (kind === 2) {
        // A whole quadratic, at a negative input.
        const p = randInt(1, 3);
        const q = randInt(1, 7);
        const r = randInt(-8, 9);
        const t = -randInt(1, 4);
        const result = p * t * t - q * t + r;
        return {
          id: "",
          type: "numeric",
          prompt: `If h(x) = ${quad(p, -q, r)}, find h(${t}).`,
          hint: `Put (${t}) in for every x. Square first, and watch the signs: −${q} times ${t} is positive.`,
          answer: result,
          traps: trapsFor(result, [
            trap(-p * t * t - q * t + r, `(${t})² is positive: a negative times a negative.`),
            trap(p * t * t + q * t + r, `−${q}x at x = ${t} is −${q} × (${t}) = +${-q * t}.`),
            trap((p * t) ** 2 - q * t + r, `Square ${t} first, then multiply by ${p}.`),
          ]),
          explanation: `h(${t}) = ${p === 1 ? "" : p}(${t})² − ${q}(${t})${plusTerm(r)} = ${p * t * t} + ${-q * t}${plusTerm(r)} = ${result}`,
        };
      }
      if (kind === 3) {
        // Two outputs added.
        const m = nonZero(-5, 5);
        const k = randInt(-9, 9);
        const u = randInt(-5, 6);
        let v = randInt(-5, 6);
        if (v === u) v += 1;
        const result = m * u + k + m * v + k;
        return {
          id: "",
          type: "numeric",
          prompt: `If f(x) = ${lin(m, k)}, find f(${u}) + f(${v}).`,
          hint: `Work out f(${u}) and f(${v}) one at a time, then add them.`,
          answer: result,
          traps: trapsFor(result, [
            trap(m * (u + v) + k, `Each output brings its own ${k}: the constant is added twice.`),
            trap(m * u + k, `That is f(${u}) alone. Add f(${v}) to it.`),
            trap(m * v + k, `That is f(${v}) alone. Add f(${u}) to it.`),
          ]),
          explanation: `f(${u}) = ${m * u + k} and f(${v}) = ${m * v + k} → ${m * u + k === 0 || m * v + k === 0 ? `the sum is ${result}` : `${m * u + k} + ${par(m * v + k)} = ${result}`}`,
        };
      }
      if (kind === 4) {
        // Working backward: which input gives this output?
        const m = nonZero(-6, 6);
        const k = randInt(-12, 12);
        const input = randInt(-6, 9);
        const out = m * input + k;
        return {
          id: "",
          type: "numeric",
          prompt: `If f(x) = ${lin(m, k)}, for what value of x is f(x) = ${out}?`,
          hint: `Set ${lin(m, k)} equal to ${out} and solve for x.`,
          answer: input,
          traps: trapsFor(input, [
            trap(m * out + k, `${out} is the output. Set f(x) equal to it and solve, rather than putting it in for x.`),
            trap((out + k) / m, `${k === 0 ? "Divide by the slope" : `The ${Math.abs(k)} moves across with its sign changed`}.`),
            trap(-input, `Dividing by ${m} keeps track of signs: check yours.`),
          ]),
          explanation: `${lin(m, k)} = ${out} → ${coef(m)} = ${out - k} → x = ${input}`,
        };
      }
      if (kind === 5) {
        // A cost function, read and run backward.
        const price = randInt(12, 45);
        const fee = randInt(4, 15);
        const n = randInt(2, 9);
        const total = price * n + fee;
        return {
          id: "",
          type: "numeric",
          prompt: `Concert tickets cost $${price} each, plus a $${fee} fee for the whole order, so C(n) = ${price}n + ${fee}. For how many tickets is C(n) = ${total}?`,
          hint: `Set ${price}n + ${fee} equal to ${total} and solve for n.`,
          answer: n,
          traps: trapsFor(n, [
            trap(Math.round((total / price) * 100) / 100, `The $${fee} fee is paid once: take it off before dividing.`),
            trap(price * total + fee, `${total} is C(n), the cost. Solve for n rather than putting ${total} in.`),
            trap(total - fee, `That is the money spent on tickets. Divide by $${price} a ticket.`),
          ]),
          explanation: `${price}n + ${fee} = ${total} → ${price}n = ${total - fee} → n = ${n}`,
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
      const kind = i % 6;
      if (kind === 0) {
        const excluded = nonZero(-20, 20);
        const answer = `All real numbers except ${excluded}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = 1/(${shift("x", excluded)})?`,
          hint: "The denominator can never be zero. Set it equal to zero; that x-value is left out.",
          answer,
          choices: mcChoices(answer, [`All real numbers except ${-excluded}`, "All real numbers", `x > ${excluded}`, "x ≠ 0"]),
          traps: trapsFor(answer, [
            trap(`All real numbers except ${-excluded}`, `${shift("x", excluded)} = 0 has to be solved: the sign flips when ${Math.abs(excluded)} moves across.`),
            trap("All real numbers", "One x-value makes the bottom of the fraction 0, and dividing by 0 is undefined, so that value is out."),
            trap(`x > ${excluded}`, "Only the one value that makes the denominator 0 is left out, not everything below it."),
            trap("x ≠ 0", `It is the whole denominator, ${shift("x", excluded)}, that must not be 0, not x alone.`),
          ]),
          explanation: `${shift("x", excluded)} = 0 → x = ${excluded}, so ${excluded} is left out.`,
        };
      }
      if (kind === 1) {
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
          explanation: `x − ${boundary} ≥ 0 → x ≥ ${boundary}`,
        };
      }
      if (kind === 2) {
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
      }
      if (kind === 3) {
        // The range of a line over a stretch of x.
        const m = nonZero(-4, 4);
        const b = randInt(-6, 6);
        const lo = randInt(-4, 1);
        const hi = lo + randInt(2, 6);
        const [y1, y2] = [m * lo + b, m * hi + b];
        const [ymin, ymax] = [Math.min(y1, y2), Math.max(y1, y2)];
        const answer = `${ymin} ≤ y ≤ ${ymax}`;
        const wrong = [`${lo} ≤ y ≤ ${hi}`, `${Math.min(m * lo, m * hi)} ≤ y ≤ ${Math.max(m * lo, m * hi)}`, `y ≥ ${ymin}`, `${ymin} < y < ${ymax}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `f(x) = ${lin(m, b)} for ${lo} ≤ x ≤ ${hi}. What is the range?`,
          hint: "Find the outputs at both ends of the domain. A line's outputs fill in everything between them.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "That is the domain, the inputs. The range is the outputs: put the ends of the domain into f."),
            trap(wrong[1], `Put each end into the whole rule, the ${b < 0 ? `− ${-b}` : `+ ${b}`} included.`),
            trap(wrong[2], `The domain stops at ${hi}, so the outputs stop too.`),
            trap(wrong[3], "The domain includes its ends (≤), so the range includes the outputs at the ends."),
          ]),
          explanation: `f(${lo}) = ${y1} and f(${hi}) = ${y2} → ${answer}`,
        };
      }
      if (kind === 4) {
        // A small domain, squared: the range has fewer values.
        const c = randInt(-5, 8);
        const xs = [-2, -1, 0, 1, 2];
        const set = (vals: number[]) => `{${Array.from(new Set(vals)).sort((p, q) => p - q).join(", ")}}`;
        const answer = set(xs.map((x) => x * x - c));
        const wrong = [set(xs.map((x) => x - c)), set(xs.map((x) => (x < 0 ? -(x * x) : x * x) - c)), set(xs), set(xs.map((x) => 2 * x - c))];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `f(x) = ${quad(1, 0, -c)} has the domain {-2, -1, 0, 1, 2}. What is its range?`,
          hint: "Put each x into f and list the outputs. Each output only needs listing once.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "x is squared in f(x): square each input before subtracting."),
            trap(wrong[1], "A negative number squared is positive: (−2)² = 4."),
            trap(wrong[2], "That is the domain, the inputs. The range is the outputs."),
            trap(wrong[3], "x² means x times x, not 2 times x."),
          ]),
          explanation: `f(±2) = ${4 - c}, f(±1) = ${1 - c}, f(0) = ${-c} → the range is ${answer}`,
        };
      }
      // A model that only makes sense for part of its inputs.
      const r = pick([4, 5, 8, 10, 16, 20, 25]);
      const hours = 100 / r;
      return {
        id: "",
        type: "numeric",
        prompt: `A phone's battery starts at 100% and drops ${r}% each hour, so B(t) = 100 − ${r}t. The model makes sense until the battery is empty. What is the greatest t in its domain, in hours?${Number.isInteger(hours) ? "" : " Write it as a decimal."}`,
        hint: "The battery is empty when B(t) = 0. Solve 100 − rt = 0 for t.",
        answer: hours,
        traps: trapsFor(hours, [
          trap(100 - r, "That is B(1), the battery after one hour. Find the t that makes B(t) = 0."),
          trap(r, `That is how much it drops each hour. Divide 100 by ${r} to find when it runs out.`),
          trap(100, "That is the starting charge. The domain is the time t, which runs until the charge hits 0."),
        ]),
        explanation: `100 − ${r}t = 0 → ${r}t = 100 → t = ${fmtNum(hours)} hours, so the domain is 0 ≤ t ≤ ${fmtNum(hours)}`,
      };
    }),

  "function-graphs": (seeds) =>
    fillToCount("function-graphs", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 1) {
        // The average rate of change of a quadratic, from its rule.
        const p = randInt(-6, 6);
        const q = randInt(-8, 8);
        const a = randInt(-3, 3);
        const b = a + randInt(1, 4);
        const f = (x: number) => x * x + p * x + q;
        const rate = (f(b) - f(a)) / (b - a);
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = ${quad(1, p, q)}. What is the average rate of change of f from x = ${a} to x = ${b}?`,
          hint: "Find f at both ends, then divide the change in f by the change in x.",
          answer: rate,
          traps: trapsFor(rate, [
            trap(f(b) - f(a), `That is the change in f. Divide it by the change in x, ${b - a}.`),
            trap(Math.round((f(b) / b) * 100) / 100, "Use both ends: (f(b) − f(a)) ÷ (b − a)."),
            trap(2 * a + p, "That is the steepness at one point. The average rate of change uses both ends."),
          ]),
          explanation: `f(${b}) = ${f(b)} and f(${a}) = ${f(a)} → (${f(b)} − ${par(f(a))}) ÷ (${b} − ${par(a)}) = ${f(b) - f(a)}/${b - a} = ${rate}`,
        };
      }
      if (kind === 2) {
        // A thrown ball: average speed over a stretch of time.
        const v = 16 * randInt(3, 6);
        const h0 = randInt(0, 6);
        const a = randInt(0, 2);
        const b = a + randInt(1, 2);
        const h = (t: number) => -16 * t * t + v * t + h0;
        const rate = (h(b) - h(a)) / (b - a);
        return {
          id: "",
          type: "numeric",
          prompt: `A ball's height is h(t) = -16t² + ${v}t${plusTerm(h0)} feet after t seconds. What is its average rate of change from t = ${a} to t = ${b}, in feet per second?`,
          hint: "Find the height at both times, then divide the change in height by the change in time.",
          answer: rate,
          traps: trapsFor(rate, [
            trap(h(b) - h(a), `That is the change in height. Divide by the change in time, ${b - a} seconds.`),
            trap(h(b), `That is the height at t = ${b}. A rate of change compares two heights.`),
            trap(Math.round(((h(b) + h(a)) / (b - a)) * 100) / 100, "Subtract the heights: the change, not the total."),
          ]),
          explanation: `h(${b}) = ${h(b)} and h(${a}) = ${h(a)} → (${h(b)} − ${h(a)}) ÷ (${b} − ${a}) = ${rate} feet per second`,
        };
      }
      if (kind === 3) {
        // Which function changes faster over the same stretch?
        const a = randInt(0, 3);
        const b = a + randInt(1, 3);
        const m = randInt(2, 8);
        const c = randInt(-5, 5);
        const gRate = a + b;
        const answer = m > gRate ? "f" : m < gRate ? "g" : "They are equal";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which function has the greater average rate of change from x = ${a} to x = ${b}: f(x) = ${lin(m, c)} or g(x) = x²?`,
          hint: "Work out each one: (value at the end − value at the start) ÷ (change in x).",
          answer,
          choices: mcChoices(answer, ["f", "g", "They are equal"]),
          traps: trapsFor(answer, [
            trap("f", `f is a line, so its rate is its slope, ${m}. Now work out g's: (${b * b} − ${a * a}) ÷ ${b - a}.`),
            trap("g", `g's rate over this stretch is (${b * b} − ${a * a}) ÷ ${b - a}. Compare it with f's slope, ${m}.`),
            trap("They are equal", "Work out both rates and compare the numbers."),
          ]),
          explanation: `f: slope ${m}. g: (${b * b} − ${a * a}) ÷ (${b} − ${a}) = ${gRate}. ${answer === "They are equal" ? "They are equal." : `${answer} is greater.`}`,
        };
      }
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
      const kind = i % 7;
      const a1 = randInt(-10, 12);
      const d = pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
      const shown = `${a1}, ${a1 + d}, ${a1 + 2 * d}, ${a1 + 3 * d}, ...`;
      if (kind === 0) {
        const n = randInt(8, 15);
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
      if (kind === 2) {
        // A term far down the line, from a₁ and d.
        const n = randInt(15, 40);
        const t = a1 + (n - 1) * d;
        return {
          id: "",
          type: "numeric",
          prompt: `An arithmetic sequence has a₁ = ${a1} and d = ${d}. What is a${sub(n)}?`,
          hint: "aₙ = a₁ + (n − 1)d. Count the steps: n − 1 of them.",
          answer: t,
          traps: trapsFor(t, [
            trap(a1 + n * d, `From the 1st term to the ${ordinal(n)} is ${n - 1} steps, not ${n}.`),
            trap((n - 1) * d, `That is how far it moves. It starts at ${a1}, so add that on.`),
            trap(a1 * n + d, "The first term is added once; the difference is what repeats."),
          ]),
          explanation: `a${sub(n)} = ${a1} + (${n} − 1)(${d}) = ${a1} + ${par((n - 1) * d)} = ${t}`,
        };
      }
      if (kind === 3 || kind === 4) {
        // Two terms given: the difference, then the first term.
        const p = randInt(2, 6);
        const q = p + randInt(3, 7);
        const tp = a1 + (p - 1) * d;
        const tq = a1 + (q - 1) * d;
        if (kind === 3) {
          return {
            id: "",
            type: "numeric",
            prompt: `In an arithmetic sequence, the ${ordinal(p)} term is ${tp} and the ${ordinal(q)} term is ${tq}. What is the common difference?`,
            hint: `From the ${ordinal(p)} term to the ${ordinal(q)} is ${q - p} steps of d.`,
            answer: d,
            traps: trapsFor(d, [
              trap(tq - tp, `That is how far it moved over ${q - p} steps. Divide by ${q - p}.`),
              trap(Math.round(((tq - tp) / (q - p + 1)) * 100) / 100, `From term ${p} to term ${q} is ${q} − ${p} = ${q - p} steps.`),
              trap(-d, "Later term minus earlier term: the sign says up or down."),
            ]),
            explanation: `${tq} − ${par(tp)} = ${tq - tp} over ${q} − ${p} = ${q - p} steps → d = ${tq - tp} ÷ ${q - p} = ${d}`,
          };
        }
        return {
          id: "",
          type: "numeric",
          prompt: `In an arithmetic sequence, the ${ordinal(p)} term is ${tp} and the ${ordinal(q)} term is ${tq}. What is the first term?`,
          hint: `Find d first: ${q - p} steps take it from ${tp} to ${tq}. Then step back from the ${ordinal(p)} term to the 1st.`,
          answer: a1,
          traps: trapsFor(a1, [
            trap(d, "That is the common difference. Now step back to the first term."),
            trap(tp - p * d, `From the 1st term to the ${ordinal(p)} is ${p - 1} steps, not ${p}.`),
            trap(tp + (p - 1) * d, "Stepping back means taking the difference away."),
          ]),
          explanation: `d = (${tq} − ${par(tp)}) ÷ ${q - p} = ${d} → a₁ = ${tp} − ${p - 1}(${d}) = ${a1}`,
        };
      }
      if (kind === 5) {
        // Which term is this number?
        const n = randInt(12, 40);
        const target = a1 + (n - 1) * d;
        return {
          id: "",
          type: "numeric",
          prompt: `Which term of ${shown} is ${target}? Type its position n.`,
          hint: `Solve ${a1} + (n − 1)(${d}) = ${target} for n.`,
          answer: n,
          traps: trapsFor(n, [
            trap(n - 1, `That is the number of steps from the first term. Add 1 for the position.`),
            trap(Math.round(((target - a1) / d) * 100) / 100 === n - 1 ? n + 1 : Math.round(((target - a1) / d) * 100) / 100, "Count the steps first, then add 1 for the first term itself."),
            trap(Math.round((target / d) * 100) / 100, `Start from the first term, ${a1}: subtract it before dividing by ${d}.`),
          ]),
          explanation: `${a1} + (n − 1)(${d}) = ${target} → (n − 1)(${d}) = ${target - a1} → n − 1 = ${n - 1} → n = ${n}`,
        };
      }
      if (kind === 6) {
        // Seats in a theater, row by row.
        const first = randInt(12, 24);
        const more = randInt(2, 4);
        const row = randInt(10, 30);
        const seats = first + (row - 1) * more;
        return {
          id: "",
          type: "numeric",
          prompt: `Row 1 of a theater has ${first} seats, and each row has ${more} more seats than the row in front of it. How many seats are in row ${row}?`,
          hint: `The rows make an arithmetic sequence with a₁ = ${first} and d = ${more}.`,
          answer: seats,
          traps: trapsFor(seats, [
            trap(first + row * more, `Row ${row} is ${row - 1} rows after row 1, not ${row}.`),
            trap(first * row, "Each row adds the same few seats; it does not multiply."),
            trap(row * more, `That leaves out the ${first} seats row 1 starts with.`),
          ]),
          explanation: `a${sub(row)} = ${first} + (${row} − 1)(${more}) = ${first} + ${(row - 1) * more} = ${seats} seats`,
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
      const kind = i % 6;
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
      if (kind === 3) {
        // A negative ratio: the signs take turns.
        const a1 = randInt(1, 5);
        const r = pick([-2, -3]);
        const n = r === -2 ? randInt(5, 8) : randInt(4, 6);
        const t = a1 * r ** (n - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${a1}, ${a1 * r}, ${a1 * r * r}, ${a1 * r ** 3}, ... What is the ${ordinal(n)} term?`,
          hint: `The ratio is ${r}, so the signs take turns. aₙ = a₁ × rⁿ⁻¹.`,
          answer: t,
          traps: trapsFor(t, [
            trap(-t, `The signs take turns: ${n - 1} multiplications by a negative leave the term ${t > 0 ? "positive" : "negative"}.`),
            trap(a1 * r ** n, `From the 1st term to the ${ordinal(n)} is ${n - 1} multiplications, not ${n}.`),
            trap(a1 * r * (n - 1), `Multiply by ${r} once per step, ${n - 1} times over, not by ${r} × ${n - 1}.`),
          ]),
          explanation: `a${sub(n)} = ${a1} × (${r})^${n - 1} = ${a1} × ${par(r ** (n - 1))} = ${t}`,
        };
      }
      if (kind === 4) {
        // Which term reaches this value?
        const a1 = randInt(1, 6);
        const r = randInt(2, 3);
        const n = r === 2 ? randInt(5, 10) : randInt(4, 7);
        const target = a1 * r ** (n - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `A geometric sequence has a₁ = ${a1} and r = ${r}. Which term is ${usNum(target)}? Type its position n.`,
          hint: `Keep multiplying by ${r} and count, or solve ${a1} × ${r}ⁿ⁻¹ = ${usNum(target)}.`,
          answer: n,
          traps: trapsFor(n, [
            trap(n - 1, `That is the number of times ${r} was multiplied in. The position is one more, since the first term counts.`),
            trap(target / a1, `${usNum(target / a1)} is ${r}ⁿ⁻¹, the growth. Count how many ${r}s make it.`),
            trap(n + 1, "Count again: a₁ is the 1st term, a₁ × r the 2nd."),
          ]),
          explanation: `${usNum(target)} ÷ ${a1} = ${usNum(target / a1)} = ${r}^${n - 1} → n − 1 = ${n - 1} → n = ${n}`,
        };
      }
      if (kind === 5) {
        // A bouncing ball.
        const [num, den] = pick([[3, 4], [1, 2], [2, 3]]);
        const bounces = num === 1 ? randInt(3, 5) : 3;
        const h = den ** bounces * randInt(1, 3);
        const height = (h * num ** bounces) / den ** bounces;
        return {
          id: "",
          type: "numeric",
          prompt: `A ball is dropped from ${h} feet. Each bounce reaches ${num}/${den} of the height before it. How high, in feet, does it go on bounce ${bounces}?`,
          hint: `Each bounce multiplies the height by ${num}/${den}. Bounce ${bounces} has been multiplied ${bounces} times.`,
          answer: height,
          traps: trapsFor(height, [
            trap((h * num ** (bounces - 1)) / den ** (bounces - 1), `That is bounce ${bounces - 1}. Bounce ${bounces} takes one more ${num}/${den}.`),
            trap(Math.round((h * num * bounces) / den), `The height is multiplied by ${num}/${den} again each time: (${num}/${den})^${bounces}, not ${num}/${den} × ${bounces}.`),
            trap(h - (bounces * h) / den, "Each bounce keeps a fraction of the last one; it does not lose the same amount each time."),
          ]),
          explanation: `${h} × (${num}/${den})^${bounces} = ${h} × ${num ** bounces}/${den ** bounces} = ${height} feet`,
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
      const kind = i % 6;
      if (kind === 1) {
        // A power of a product, then a product of powers.
        const c = pick([2, 3]);
        const e = randInt(2, 4);
        const p = randInt(2, 3);
        const f = randInt(1, 5);
        const answer = mono(c ** p, e * p + f);
        const wrong = [mono(c, e * p + f), mono(c ** p, e + p + f), mono(c ** p, e * p * f), mono(c * p, e * p + f)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify: (${c}x^${e})^${p} · x^${f}`,
          hint: `Raise everything in the bracket to the power ${p}: the ${c} and the x^${e}. Then multiply by x^${f}: same base, add exponents.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The power ${p} applies to the ${c} too: ${c}^${p} = ${c ** p}.`),
            trap(wrong[1], `A power of a power multiplies: (x^${e})^${p} = x^${e * p}, not x^${e + p}.`),
            trap(wrong[2], `Multiplying x^${e * p} by x^${f} adds the exponents.`),
            trap(wrong[3], `${c}^${p} means ${c} multiplied by itself ${p} times, not ${c} × ${p}.`),
          ]),
          explanation: `(${c}x^${e})^${p} = ${c ** p}x^${e * p} → ${c ** p}x^${e * p} · x^${f} = ${answer}`,
        };
      }
      if (kind === 2) {
        // A power of a monomial, divided by another.
        const c = pick([2, 3]);
        const p = randInt(2, 3);
        const a = randInt(1, 3);
        const b = randInt(1, a * p - 1);
        const d = pick([c, c ** 2].filter((v) => v <= c ** p && (c ** p) % v === 0));
        const k = c ** p / d;
        const answer = mono(k, a * p - b, p - 1);
        const wrong = [mono(c ** p, a * p - b, p - 1), mono(k, a + p - b >= 1 ? a + p - b : a * p + b, p - 1), mono(k, a * p - b, p), mono(k, a * p + b, p + 1)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify: (${mono(c, a, 1)})^${p} ÷ (${mono(d, b, 1)})`,
          hint: `Raise the bracket to the power ${p} first, then divide: numbers divide, and the exponents of each letter subtract.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Divide the numbers too: ${c ** p} ÷ ${d}.`),
            trap(wrong[1], `A power of a power multiplies: (x^${a})^${p} = x^${a * p}.`),
            trap(wrong[2], `The y in the bottom divides one y away: y^${p} ÷ y = y^${p - 1}.`),
            trap(wrong[3], "Dividing powers subtracts the exponents; adding them is for multiplying."),
          ]),
          explanation: `(${mono(c, a, 1)})^${p} = ${mono(c ** p, a * p, p)} → ${mono(c ** p, a * p, p)} ÷ ${mono(d, b, 1)} = ${answer}`,
        };
      }
      if (kind === 3) {
        // Product and quotient of numeric powers, then the value.
        const base = pick([2, 2, 3, 5]);
        const e1 = randInt(3, 8);
        const e2 = randInt(2, 6);
        const most = Math.min(base === 2 ? 6 : base === 3 ? 4 : 3, e1 + e2 - 1);
        const top = randInt(1, most);
        const e3 = e1 + e2 - top;
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify (${base}^${e1} × ${base}^${e2}) ÷ ${base}^${e3}, then write the answer as a number.`,
          hint: "Multiplying adds exponents and dividing subtracts them. Then work out the power that is left.",
          answer: base ** top,
          traps: trapsFor(base ** top, [
            trap(top, `${top} is the exponent left over. Now work out ${base}^${top}.`),
            trap(base ** (e1 * e2 - e3), "Multiplying powers with the same base adds the exponents; it does not multiply them."),
            trap(base * top, `${base}^${top} means ${base} multiplied by itself ${top} times, not ${base} × ${top}.`),
          ]),
          explanation: `${base}^${e1} × ${base}^${e2} = ${base}^${e1 + e2} → ${base}^${e1 + e2} ÷ ${base}^${e3} = ${base}^${top} → ${base}^${top} = ${base ** top}`,
        };
      }
      if (kind === 4) {
        // A power of a power over another power: the exponent left.
        const a = randInt(2, 5);
        const b = randInt(2, 4);
        const c = randInt(1, a * b - 1);
        return {
          id: "",
          type: "numeric",
          prompt: `(x^${a})^${b} ÷ x^${c} = x^n. What is n?`,
          hint: "A power of a power multiplies the exponents. Dividing then subtracts.",
          answer: a * b - c,
          traps: trapsFor(a * b - c, [
            trap(a + b - c, `A power of a power multiplies: (x^${a})^${b} = x^${a * b}.`),
            trap(a * b + c, "Dividing powers subtracts the exponents."),
            trap(a * b, `That is (x^${a})^${b}. Now divide by x^${c}.`),
          ]),
          explanation: `(x^${a})^${b} = x^${a * b} → x^${a * b} ÷ x^${c} = x^${a * b - c} → n = ${a * b - c}`,
        };
      }
      if (kind === 5) {
        // Zero exponents, read carefully: what is inside the power?
        const k = randInt(2, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify ${k}x^0 + (${k}x)^0, for any x other than 0.`,
          hint: `In ${k}x^0 only the x has the 0 power. In (${k}x)^0 the whole bracket does.`,
          answer: k + 1,
          traps: trapsFor(k + 1, [
            trap(2, `In ${k}x^0 only the x is raised to 0, so the ${k} stays: ${k} × 1.`),
            trap(2 * k, `(${k}x)^0 has the whole bracket to the 0 power, so it is 1.`),
            trap(0, "Any nonzero number to the 0 power is 1, not 0."),
            trap(k, `(${k}x)^0 is 1, and it still gets added on.`),
          ]),
          explanation: `${k}x^0 = ${k} × 1 = ${k} and (${k}x)^0 = 1 → ${k} + 1 = ${k + 1}`,
        };
      }
      if (i % 12 === 6) {
        const exp = randInt(2, 5);
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
      const base = pick([2, 3, 5, 7, 10, 11]);
      const e1 = randInt(2, 9);
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
    }),

  "negative-fractional-exponents": (seeds) =>
    fillToCount("negative-fractional-exponents", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      const round = Math.floor(i / 6);
      if (kind === 0) {
        // Small enough to write as a fraction by hand: the denominator stays at or under 1000.
        const [base, exp] = pick([
          [2, 2], [2, 3], [2, 4], [2, 5], [3, 2], [3, 3], [4, 2], [4, 3], [5, 2], [5, 3],
          [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [10, 3], [12, 2],
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
        // A root, then a power: 8^(2/3) is (³√8)².
        const [c, top, bottom] = pick([[8, 2, 3], [27, 2, 3], [64, 2, 3], [125, 2, 3], [16, 3, 4], [81, 3, 4], [32, 2, 5], [4, 3, 2], [9, 3, 2], [25, 3, 2], [16, 3, 2], [36, 3, 2], [8, 4, 3], [27, 4, 3], [16, 5, 4]]);
        const root = Math.round(c ** (1 / bottom));
        const value = root ** top;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${c}^(${top}/${bottom}).`,
          hint: `The bottom of the exponent is a root and the top is a power: take the ${bottom === 2 ? "square" : bottom === 3 ? "cube" : ordinal(bottom)} root of ${c} first, then raise it to the ${top === 2 ? "second" : top === 3 ? "third" : ordinal(top)} power.`,
          answer: value,
          traps: trapsFor(value, [
            trap(root, `That is the root. The ${top} on top still raises it to a power.`),
            trap(Math.round(((c * top) / bottom) * 100) / 100, `A fractional exponent is a root and a power, not a multiplication by ${top}/${bottom}.`),
            trap(Math.round(c ** (bottom / top) * 100) / 100, "The bottom of the exponent is the root and the top is the power: they are the other way round."),
          ]),
          explanation: `${c}^(${top}/${bottom}) = (${bottom === 2 ? "" : bottom === 3 ? "³" : "⁴⁵"[bottom - 4]}√${c})^${top} = ${root}^${top} = ${value}`,
        };
      }
      if (kind === 3) {
        // A fraction to a negative power flips over.
        const b = randInt(2, 6);
        const n = b <= 3 ? randInt(2, 4) : randInt(2, 3);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate (1/${b})^(-${n}).`,
          hint: `A negative exponent flips the fraction: (1/${b})^(-${n}) = ${b}^${n}.`,
          answer: b ** n,
          traps: trapsFor(b ** n, [
            trap(1 / b ** n, "The negative exponent flips the fraction over, so 1/b becomes b."),
            trap(-(b ** n), "A negative exponent flips; it does not make the number negative."),
            trap(b * n, `${b}^${n} means ${b} multiplied by itself ${n} times, not ${b} × ${n}.`),
          ]),
          explanation: `(1/${b})^(-${n}) = ${b}^${n} = ${b ** n}`,
        };
      }
      if (kind === 4) {
        // A root, a power and a flip.
        const [c, top, bottom] = pick([[8, 2, 3], [27, 2, 3], [64, 2, 3], [16, 3, 4], [4, 3, 2], [9, 3, 2], [25, 3, 2], [32, 3, 5], [16, 3, 2], [81, 3, 4]]);
        const root = Math.round(c ** (1 / bottom));
        const den = root ** top;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${c}^(-${top}/${bottom}). Write it as a fraction.`,
          hint: "Three moves: the negative flips it to one over, the bottom of the exponent is a root, and the top is a power.",
          answer: 1 / den,
          traps: trapsFor(1 / den, [
            trap(den, "That is the root and the power. The negative exponent then puts it under 1."),
            trap(-den, "A negative exponent flips the number; it does not make it negative."),
            trap(1 / root, `That is one over the root. The ${top} on top still raises it to a power.`),
          ]),
          explanation: `${c}^(-${top}/${bottom}) = 1/${c}^(${top}/${bottom}) = 1/${root}^${top} = 1/${den}`,
        };
      }
      // Fractional exponents add like any others.
      const d = pick([2, 3, 4, 5]);
      const k = randInt(1, 3);
      let a = randInt(1, d * k - 1);
      if (a % d === 0) a += 1;
      const b = d * k - a;
      return {
        id: "",
        type: "numeric",
        prompt: `x^(${a}/${d}) · x^(${b}/${d}) = x^n. What is n?`,
        hint: "Same base, multiplying: add the exponents, fractions and all.",
        answer: k,
        traps: trapsFor(k, [
          trap(Math.round(((a * b) / (d * d)) * 100) / 100, "Multiplying powers of the same base adds the exponents; it does not multiply them."),
          trap(Math.round(((a + b) / (2 * d)) * 100) / 100, `The denominators stay ${d}: ${a}/${d} + ${b}/${d} = ${a + b}/${d}.`),
          trap(a + b, `That is the top of the sum. Divide by ${d}: ${a + b}/${d}.`),
        ]),
        explanation: `${a}/${d} + ${b}/${d} = ${a + b}/${d} = ${k}, so n = ${k}`,
      };
    }),

  "scientific-notation": (seeds) =>
    fillToCount("scientific-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
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
      if (kind === 3 || kind === 5) {
        // Multiplying: multiply the fronts, add the powers, then tidy the front back under 10.
        const [a10, b10] =
          kind === 5
            ? [30, pick([20, 40, 50, 60, 15, 25, 12, 35, 80, 45])]
            : pick([[60, 40], [25, 80], [50, 30], [35, 40], [45, 20], [80, 15], [75, 40], [12, 50], [24, 50], [30, 70], [90, 30], [16, 25]]);
        const m = kind === 5 ? 8 : randInt(2, 9);
        const n = kind === 5 ? randInt(1, 4) : randInt(-6, 7);
        const prod = (a10 * b10) / 100; // 24, 20, 15, ...
        const bump = prod >= 10 ? 1 : 0;
        const front = fmtNum(bump ? prod / 10 : prod);
        const power = m + n + bump;
        const sci = (f: string, p: number) => `${f} × 10^${p}`;
        const answer = sci(front, power);
        const wrong = [sci(front, m + n + (bump ? 0 : 1)), sci(front, m * n), sci(fmtNum((a10 + b10) / 10), m + n), sci(fmtNum(prod), m + n)];
        const prompt =
          kind === 5
            ? `Light travels about ${fmtNum(a10 / 10)} × 10^${m} meters per second. How far does it travel in ${usNum((b10 / 10) * 10 ** n)} seconds?`
            : `Multiply: (${fmtNum(a10 / 10)} × 10^${m})(${fmtNum(b10 / 10)} × 10^${n}). Write the answer in scientific notation.`;
        return {
          id: "",
          type: "multiple-choice",
          prompt,
          hint: kind === 5 ? `Write the time as ${fmtNum(b10 / 10)} × 10^${n}. Distance = speed × time: multiply the fronts and add the powers.` : "Multiply the numbers in front and add the powers of 10. If the front is 10 or more, move the decimal point and add 1 to the power.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], bump ? `${fmtNum(prod)} is 10 or more, so it becomes ${front} and the power goes up by 1.` : "The front is already between 1 and 10, so the power stays the sum."),
            trap(wrong[1], "Multiplying powers of 10 adds the exponents."),
            trap(wrong[2], "Multiply the numbers in front; adding them is not the same."),
            trap(wrong[3], "Scientific notation needs a front from 1 up to 10. Move the decimal point and fix the power."),
          ]),
          explanation: `${fmtNum(a10 / 10)} × ${fmtNum(b10 / 10)} = ${fmtNum(prod)}, and 10^${m} × 10^${n} = 10^${m + n} → ${fmtNum(prod)} × 10^${m + n}${bump ? ` = ${answer}` : ""}`,
        };
      }
      if (kind === 4) {
        // Dividing: divide the fronts, subtract the powers.
        const [q10, b10] = pick([[40, 21], [20, 32], [30, 25], [15, 40], [25, 30], [50, 16], [35, 20], [12, 75], [60, 15], [24, 30], [45, 20], [5, 80]]);
        const a = (q10 * b10) / 100; // the front of the top number, under 10
        const m = randInt(4, 12);
        const n = randInt(1, m - 1);
        const qv = q10 / 10;
        const dip = qv < 1 ? 1 : 0;
        const front = fmtNum(dip ? qv * 10 : qv);
        const power = m - n - dip;
        const answer = `${front} × 10^${power}`;
        const wrong = [`${front} × 10^${m + n}`, `${front} × 10^${m - n + (dip ? 0 : 1)}`, `${fmtNum(qv)} × 10^${m - n}`, `${fmtNum(a * (b10 / 10))} × 10^${m - n}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Divide: (${fmtNum(a)} × 10^${m}) ÷ (${fmtNum(b10 / 10)} × 10^${n}). Write the answer in scientific notation.`,
          hint: "Divide the numbers in front and subtract the powers of 10. If the front comes out under 1, move the decimal point and take 1 off the power.",
          answer,
          choices: mcChoices(answer, wrong.filter((w) => !(dip === 0 && w === `${fmtNum(qv)} × 10^${m - n}`))),
          traps: trapsFor(answer, [
            trap(wrong[0], "Dividing powers of 10 subtracts the exponents."),
            trap(wrong[1], dip ? `The front, ${fmtNum(qv)}, is under 1: it becomes ${front} and the power goes down by 1.` : "The front is already between 1 and 10, so the power is just the difference."),
            dip ? trap(wrong[2], "Scientific notation needs a front from 1 up to 10. Move the decimal point and fix the power.") : null,
            trap(wrong[3], "Divide the numbers in front; multiplying them goes the wrong way."),
          ]),
          explanation: `${fmtNum(a)} ÷ ${fmtNum(b10 / 10)} = ${fmtNum(qv)}, and 10^${m} ÷ 10^${n} = 10^${m - n} → ${fmtNum(qv)} × 10^${m - n}${dip ? ` = ${answer}` : ""}`,
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
      const kind = i % 6;
      const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
      if (kind === 1) {
        // A number already in front, and more to pull out.
        const k = randInt(2, 5);
        const s = pick([4, 9, 16, 25]);
        const f = pick([2, 3, 5, 6, 7]);
        const root = Math.sqrt(s);
        const answer = rad(k * root, f);
        const wrong = [rad(k + root, f), rad(root, f), rad(k * s, f), rad(root, k * f)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify ${k}√${s * f}`,
          hint: `Simplify √${s * f} first: find the perfect square in ${s * f}. Then multiply what comes out by the ${k} in front.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `What comes out of the root multiplies the ${k} in front; it does not add to it.`),
            trap(wrong[1], `The ${k} in front stays and multiplies what comes out.`),
            trap(wrong[2], `√${s} is ${root}, not ${s}: the square's root comes out.`),
            trap(wrong[3], `The ${k} in front multiplies what comes out of the root; it does not go under it.`),
          ]),
          explanation: `√${s * f} = √${s} × √${f} = ${rad(root, f)} → ${k} × ${rad(root, f)} = ${answer}`,
        };
      }
      if (kind === 2) {
        // Unlike-looking radicals that become like terms.
        const f = pick([2, 3, 5, 6, 7]);
        const [s1, s2] = pickTwo([1, 4, 9, 16, 25]);
        const [r1, r2] = [Math.sqrt(s1), Math.sqrt(s2)];
        const answer = rad(r1 + r2, f);
        const wrong = [`√${s1 * f + s2 * f}`, rad(r1 * r2, f), rad(s1 + s2, f), rad(r1 + r2, 2 * f)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify √${s1 * f} + √${s2 * f}`,
          hint: "Simplify each radical first. If they end up with the same number under the root, they add like terms.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Radicals do not add by adding the numbers inside: √a + √b is not √(a + b). Simplify each one first."),
            trap(wrong[1], "Like radicals add their numbers in front, the way 2x + 3x = 5x; they do not multiply."),
            trap(wrong[2], "Take the square root of each perfect square before adding."),
            trap(wrong[3], `Adding like terms keeps what is under the root: √${f} stays √${f}.`),
          ]),
          explanation: `√${s1 * f} = ${rad(r1, f)} and √${s2 * f} = ${rad(r2, f)} → ${rad(r1, f)} + ${rad(r2, f)} = ${answer}`,
        };
      }
      if (kind === 3) {
        // A product of radicals, then simplified.
        const [p, q] = pick([[6, 15], [2, 18], [3, 12], [10, 15], [6, 10], [5, 15], [2, 14], [3, 15], [6, 21], [2, 10], [3, 6], [7, 14], [5, 10], [6, 8]]);
        const n = p * q;
        let out = 1;
        let inside = n;
        for (let k = 2; k * k <= inside; k += 1) while (inside % (k * k) === 0) {
          inside /= k * k;
          out *= k;
        }
        const answer = inside === 1 ? `${out}` : rad(out, inside);
        const wrong = [`√${p + q}`, `${p}√${q}`, inside === 1 ? `${out + 1}` : rad(out + 1, inside), inside === 1 ? `${n}` : rad(out * out, inside)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify √${p} · √${q}`,
          hint: `Multiply under one root first: √${p} · √${q} = √${n}. Then pull out the biggest perfect square.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Multiplying radicals multiplies the numbers under the roots, not adds them."),
            trap(wrong[1], `√${p} is not ${p}: only a perfect square comes out of the root.`),
            trap(wrong[2], `Check the perfect square in ${n}.`),
            trap(wrong[3], inside === 1 ? `${n} is what is under the root. Take its square root.` : `The perfect square's root comes out: √${out * out} is ${out}, not ${out * out}.`),
          ]),
          explanation: `√${p} · √${q} = √${n} → ${answer}`,
        };
      }
      if (kind === 4) {
        // A letter under the root too.
        const s = pick([4, 9, 16, 25, 36]);
        const f = pick([2, 3, 5, 6, 7]);
        const root = Math.sqrt(s);
        const answer = `${root}x√${f}`;
        const wrong = [`${root}x²√${f}`, `${root}√${f}`, `${s}x√${f}`, `${root * f}x`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify √(${s * f}x²), for x > 0`,
          hint: `Split it: √${s} · √(x²) · √${f}. The square root of x² is x when x is positive.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "√(x²) is x: the root undoes the square."),
            trap(wrong[1], "x² is a perfect square too: its root, x, comes out in front."),
            trap(wrong[2], `√${s} is ${root}: the root of the perfect square comes out, not the square itself.`),
            trap(wrong[3], `Only the perfect square comes out; √${f} stays under the root.`),
          ]),
          explanation: `√(${s * f}x²) = √${s} · √(x²) · √${f} = ${root} · x · √${f} = ${answer}`,
        };
      }
      if (kind === 5) {
        // A square's side from its area.
        const s = pick([4, 9, 16, 25, 36, 49]);
        const f = pick(SQUAREFREE.slice(0, 6));
        const root = Math.sqrt(s);
        const area = s * f;
        const answer = rad(root, f);
        const wrong = [rad(f, root) === answer ? rad(root + 1, f) : rad(f, root), `${area / 4}`, rad(s, f), rad(root, 2 * f)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A square has an area of ${area} square inches. How long is each side, in inches? Give it in simplest radical form.`,
          hint: `A square's side is the square root of its area. Simplify √${area}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "The perfect square's root comes out in front, and the other factor stays under the root."),
            trap(wrong[1], "Dividing by 4 gives the side only for a perimeter. For area, take the square root."),
            trap(wrong[2], `√${s} is ${root}: the square's root comes out.`),
            trap(wrong[3], `Check the factor left under the root: ${area} = ${s} × ${f}.`),
          ]),
          explanation: `side = √${area} = √(${s} × ${f}) = ${answer} inches`,
        };
      }
      const square = pick([4, 9, 16, 25, 36, 49, 64, 81, 100]);
      const root = Math.sqrt(square);
      // The leftover factor has no square in it, so root√f is fully simplified.
      const f = pick(SQUAREFREE);
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
    }),

  "exponential-functions": (seeds) =>
    fillToCount("exponential-functions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
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
      if (kind === 3) {
        // The function through two points: its start and its multiplier.
        const answer = `y = ${a}(${b})^x`;
        const wrong = [`y = ${b}(${a})^x`, `y = ${a}(${a * b})^x`, `y = ${a * b}(${b})^x`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which exponential function passes through (0, ${a}) and (1, ${a * b})?`,
          hint: "At x = 0 an exponential is its starting value. From x = 0 to x = 1 it multiplies once by the base.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `At x = 0 the function equals its starting value, ${a}: that is the number in front.`),
            trap(wrong[1], `${a * b} is the value at x = 1, not the multiplier. Divide: ${a * b} ÷ ${a}.`),
            trap(wrong[2], `The value at x = 0 is the starting value, so the number in front is ${a}.`),
          ]),
          explanation: `At x = 0, y = ${a}, so a = ${a} → ${a * b} ÷ ${a} = ${b}, so b = ${b} → ${answer}`,
        };
      }
      if (kind === 4) {
        // Which x gives this y?
        const x = randInt(2, b <= 3 ? 5 : 4);
        const y = a * b ** x;
        return {
          id: "",
          type: "numeric",
          prompt: `For y = ${a}(${b})^x, what value of x gives y = ${usNum(y)}?`,
          hint: `Divide by ${a} first, then ask how many ${b}s multiply to what is left.`,
          answer: x,
          traps: trapsFor(x, [
            trap(y / a, `${usNum(y / a)} is ${b}^x. The question asks for the exponent x.`),
            trap(Math.round((y / (a * b)) * 100) / 100, `${b}^x is ${b} multiplied by itself x times, not ${b} times x.`),
            trap(x + 1, `Count the ${b}s in ${usNum(y / a)} again.`),
          ]),
          explanation: `${a}(${b})^x = ${usNum(y)} → ${b}^x = ${usNum(y / a)} → x = ${x}`,
        };
      }
      if (kind === 5) {
        // How much bigger, without working out either value.
        const x1 = randInt(0, 3);
        const gap = b === 2 ? randInt(2, 5) : randInt(2, 3);
        const x2 = x1 + gap;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = ${a}(${b})^x. How many times bigger is f(${x2}) than f(${x1})?`,
          hint: `From x = ${x1} to x = ${x2}, the function multiplies by ${b} once for each step.`,
          answer: b ** gap,
          traps: trapsFor(b ** gap, [
            trap(b * gap, `It multiplies by ${b} ${gap} times over: ${b}^${gap}, not ${b} × ${gap}.`),
            trap(a * b ** gap, `The starting value ${a} cancels when you compare the two.`),
            trap(a * b ** x2 - a * b ** x1, "That is how much bigger, as a difference. Times bigger means divide."),
          ]),
          explanation: `f(${x2}) ÷ f(${x1}) = ${b}^${x2} ÷ ${b}^${x1} = ${b}^${gap} = ${b ** gap}`,
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
      const kind = i % 4;
      if (kind === 1) {
        // Bacteria doubling on a schedule.
        const every = pick([15, 20, 30, 60]);
        const hours = every === 60 ? randInt(3, 8) : every === 30 ? randInt(2, 4) : every === 20 ? randInt(1, 2) : 2;
        const doublings = (hours * 60) / every;
        const start = pick([50, 75, 100, 120, 150, 200, 250]);
        const count = start * 2 ** doublings;
        return {
          id: "",
          type: "numeric",
          prompt: `A colony of ${start} bacteria doubles every ${every} minutes. How many bacteria are there after ${hours === 1 ? "1 hour" : `${hours} hours`}?`,
          hint: `Count the doublings first: ${hours * 60} minutes ÷ ${every}. Then multiply ${start} by 2 that many times.`,
          answer: count,
          traps: trapsFor(count, [
            trap(start * 2 * doublings, `Doubling ${doublings} times is × 2^${doublings}, not × (2 × ${doublings}).`),
            trap(start * 2 ** hours, `It doubles every ${every} minutes, not every hour: that is ${doublings} doublings.`),
            trap(start * 2 ** (doublings - 1), "One doubling short: count them again."),
          ]),
          explanation: `${hours * 60} ÷ ${every} = ${doublings} doublings → ${start} × 2^${doublings} = ${start} × ${2 ** doublings} = ${usNum(count)}`,
        };
      }
      if (kind === 2) {
        // A town growing by a percent, rounded to whole people.
        const P = 500 * randInt(10, 40);
        const r = pick([2, 3, 4, 5]);
        const y = randInt(2, 5);
        const num = P * (100 + r) ** y;
        const den = 100 ** y;
        const people = Math.floor((2 * num + den) / (2 * den));
        return {
          id: "",
          type: "numeric",
          prompt: `A town of ${usNum(P)} people grows by ${r}% each year. About how many people live there after ${y} years? (round to the nearest whole number)`,
          hint: `Each year multiplies the population by 1.0${r}. Use ${usNum(P)} × (1.0${r})^${y}.`,
          answer: people,
          decimalPlaces: 0,
          traps: trapsFor(people, [
            trap(Math.round(P * (1 + (r * y) / 100)), `Growth compounds: each year's ${r}% is of the new, bigger total. Multiply by 1.0${r} once a year.`),
            trap(Math.round((P * r * y) / 100), "That is the growth alone, and simple growth at that. The question asks for the whole population."),
            trap(Math.round(P * (1.0 + r / 100) ** (y - 1)), "One year short: count the years again."),
          ]),
          explanation: `${usNum(P)} × 1.0${r}^${y} ≈ ${fmtNum(Math.round((num / den) * 100) / 100)} → about ${usNum(people)} people`,
        };
      }
      const principal = randInt(5, 20) * 100;
      const pct = [3, 4, 5, 6][Math.floor(i / 4) % 4];
      const years = randInt(2, 4);
      // Whole-number arithmetic in cents, so a value that ends in half a cent rounds up as it should.
      const cents = Math.round((principal * (100 + pct) ** years) / 100 ** (years - 1));
      const value = cents / 100;
      const factor = (100 + pct) / 100;
      if (kind === 3) {
        // The interest alone.
        const interest = (cents - principal * 100) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `$${principal} is invested at ${pct}% annual interest compounded annually. How much interest does it earn in ${years} years? (round to the hundredths place, the nearest cent)`,
          hint: `Find the value first, ${principal}(${factor})^${years}, then take off the $${principal} that was put in.`,
          answer: interest,
          decimalPlaces: 2,
          traps: trapsFor(interest, [
            trap(value, `That is the whole value. Take off the $${principal} that was put in to leave the interest.`),
            trap((principal * pct * years) / 100, "That is simple interest. Compounding earns interest on the interest too."),
            trap(Math.round(principal * (factor - 1) * 100) / 100, "That is one year's interest. The money grows for every year."),
          ]),
          explanation: `$${principal} × ${factor}^${years} ≈ $${money(value)} → $${money(value)} − $${principal} = $${money(interest)}`,
        };
      }
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
      const kind = i % 4;
      if (kind === 1) {
        // A half-life.
        const dose = pick([80, 100, 160, 200, 240, 300, 400, 500]);
        const every = pick([4, 6, 8, 12]);
        const halvings = randInt(2, 4);
        const left = dose / 2 ** halvings;
        const whole = Number.isInteger(left);
        return {
          id: "",
          type: "numeric",
          prompt: `A ${dose} mg dose of medicine is half gone every ${every} hours. How many mg are left after ${every * halvings} hours?${whole ? "" : " Write your answer as a decimal."}`,
          hint: `Count the halvings: ${every * halvings} ÷ ${every}. Then halve ${dose} that many times.`,
          answer: left,
          traps: trapsFor(left, [
            trap(dose / (2 * halvings), `Halving ${halvings} times divides by 2^${halvings}, not by 2 × ${halvings}.`),
            trap(dose / 2 ** (halvings - 1), "One halving short: count them again."),
            trap(dose - left, "That is how much is gone. The question asks what is left."),
          ]),
          explanation: `${every * halvings} ÷ ${every} = ${halvings} halvings → ${dose} × (1/2)^${halvings} = ${dose} ÷ ${2 ** halvings} = ${fmtNum(left)} mg`,
        };
      }
      if (kind === 2) {
        // The value lost, not the value left.
        const v = 100 * randInt(4, 15);
        const pct = [10, 15, 20, 25][randInt(0, 3)];
        const y = randInt(2, 3);
        const keptNum = v * (100 - pct) ** y;
        const den = 100 ** y;
        const lostNum = v * den - keptNum;
        const lost = Math.floor((2 * lostNum + den) / (2 * den));
        return {
          id: "",
          type: "numeric",
          prompt: `A phone worth $${usNum(v)} loses ${pct}% of its value each year. How much value has it lost after ${y} years? (round to the nearest whole dollar)`,
          hint: `Find what it is worth first: ${usNum(v)} × ${(100 - pct) / 100}^${y}. The loss is the price minus that.`,
          answer: lost,
          decimalPlaces: 0,
          traps: trapsFor(lost, [
            trap(Math.round(keptNum / den), "That is what the phone is still worth. Subtract it from the price to get the loss."),
            trap(Math.round((v * pct * y) / 100), `Each year takes ${pct}% of what is left, not of the first price.`),
            trap(Math.round((v * pct) / 100), "That is the first year's loss only."),
          ]),
          explanation: `$${usNum(v)} × ${(100 - pct) / 100}^${y} = $${money(keptNum / den)} → $${usNum(v)} − $${money(keptNum / den)} ≈ $${usNum(lost)}`,
        };
      }
      if (kind === 3) {
        // When does it first drop under half?
        const pct = pick([10, 15, 20, 25, 30]);
        const keep = (100 - pct) / 100;
        let n = 1;
        while (keep ** n >= 0.5) n += 1;
        const price = 1000 * randInt(12, 40);
        return {
          id: "",
          type: "numeric",
          prompt: `A car that cost $${usNum(price)} loses ${pct}% of its value each year. After how many full years is it first worth less than half of what it cost?`,
          hint: `Each year multiplies the value by ${keep}. Keep multiplying until you go under $${usNum(price / 2)}.`,
          answer: n,
          traps: trapsFor(n, [
            trap(Math.ceil(50 / pct), `${pct}% a year of the first price would take that long, but each year's loss is of what is left, which shrinks.`),
            trap(n - 1, `After ${n - 1} years it is still worth half or more. Check the year after.`),
            trap(n + 1, `It already dips under half a year earlier. Check year ${n}.`),
          ]),
          explanation: `${keep}^${n - 1} ≈ ${fmtNum(Math.round(keep ** (n - 1) * 1000) / 1000)} (still half or more) → ${keep}^${n} ≈ ${fmtNum(Math.round(keep ** n * 1000) / 1000)} (under half) → ${n} years`,
        };
      }
      const value0 = randInt(10, 30) * 1000;
      const pct = [10, 12, 15, 20][Math.floor(i / 4) % 4];
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
      const kind = i % 6;
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
        // Both leading numbers above 1, and a minus.
        const a = randInt(2, 4);
        const cc = randInt(2, 4);
        const p = randInt(1, 7);
        let q = randInt(1, 7);
        if (p * cc === a * q) q += 1;
        const mid = p * cc - a * q;
        const answer = quad(a * cc, mid, -p * q);
        const wrong = [quad(a * cc, p * cc + a * q, -p * q), quad(a * cc, 0, -p * q), quad(a + cc, mid, -p * q), quad(a * cc, mid, p * q)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (${a}x + ${p})(${cc}x − ${q})`,
          hint: "Four products: first × first, outer, inner, last. Then combine the two x terms.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The outer product is ${a}x × (−${q}) = −${a * q}x: keep its minus sign.`),
            trap(wrong[1], `The outer and inner products make a middle term: −${a * q}x + ${p * cc}x.`),
            trap(wrong[2], `The first terms multiply: ${a}x × ${cc}x = ${a * cc}x².`),
            trap(wrong[3], `The last product is ${p} × (−${q}): negative.`),
          ]),
          explanation: `(${a}x + ${p})(${cc}x − ${q}) = ${a * cc}x² − ${a * q}x + ${p * cc}x − ${p * q} = ${answer}`,
        };
      }
      if (kind === 3) {
        // Just the middle coefficient, worked out.
        const a = randInt(2, 6);
        const cc = randInt(2, 5);
        const p = randInt(1, 9);
        let q = randInt(1, 9);
        if (a * q === p * cc) q += 1;
        const mid = a * q - p * cc;
        return {
          id: "",
          type: "numeric",
          prompt: `When (${a}x − ${p})(${cc}x + ${q}) is multiplied out, what is the coefficient of x?`,
          hint: "The x term comes from the outer and inner products. Work out both and add them.",
          answer: mid,
          traps: trapsFor(mid, [
            trap(a * q + p * cc, `The inner product is −${p} × ${cc}x = −${p * cc}x: it carries the minus sign.`),
            trap(a * cc, "That is the x² coefficient, from the first terms."),
            trap(-p * q, "That is the constant, from the last terms."),
            trap(a * q, `That is only the outer product. Add the inner one, −${p * cc}x.`),
          ]),
          explanation: `outer: ${a}x × ${q} = ${a * q}x → inner: −${p} × ${cc}x = −${p * cc}x → ${a * q}x − ${p * cc}x = ${coef(mid)}`,
        };
      }
      if (kind === 4) {
        // A garden's area as a polynomial.
        const p = randInt(2, 9);
        const q = randInt(1, 6);
        const answer = quad(2, 2 * p - q, -p * q);
        const wrong = [quad(2, 0, -p * q), quad(2, 2 * p + q, -p * q), quad(1, 2 * p - q, -p * q), quad(2, 2 * p - q, p * q)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A garden is (x + ${p}) feet long and (2x − ${q}) feet wide. Which expression gives its area, in square feet?`,
          hint: "Area = length × width. Multiply the two brackets: every term by every term.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Keep the middle term: x × (−${q}) and ${p} × 2x add to ${coef(2 * p - q)}.`),
            trap(wrong[1], `x × (−${q}) is −${q}x: the middle term is ${2 * p}x − ${q}x.`),
            trap(wrong[2], "x × 2x is 2x²."),
            trap(wrong[3], `${p} × (−${q}) is negative.`),
          ]),
          explanation: `(x + ${p})(2x − ${q}) = 2x²${plusTerm(-q, "x")} + ${2 * p}x − ${p * q} = ${answer}`,
        };
      }
      // A binomial times a trinomial.
      const a = randInt(1, 5);
      const bb = randInt(1, 6);
      const cc = nonZero(-6, 8);
      const answer = poly([1, a - bb, cc - a * bb, a * cc]);
      const wrong = [poly([1, -bb, cc, a * cc]), poly([1, a - bb, cc, a * cc]), poly([1, a + bb, cc - a * bb, a * cc]), poly([1, a - bb, cc + a * bb, a * cc])];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Expand (x + ${a})(${quad(1, -bb, cc)})`,
        hint: `Multiply x by each term of the trinomial, then multiply the ${a} by each term. Then combine like terms.`,
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, [
          trap(wrong[0], `The ${a} multiplies every term of the trinomial too, not only the last.`),
          trap(wrong[1], `${a} × (−${bb}x) gives an x term too: combine it with ${coef(cc)}.`),
          trap(wrong[2], `x × (−${bb}x) is −${bb}x²: the x² terms are ${a}x² − ${bb}x².`),
          trap(wrong[3], `${a} × (−${bb}x) is negative.`),
        ]),
        explanation: `x(${quad(1, -bb, cc)}) = ${poly([1, -bb, cc, 0])} → ${a}(${quad(1, -bb, cc)}) = ${quad(a, -a * bb, a * cc)} → together: ${answer}`,
      };
    }),

  "special-products": (seeds) =>
    fillToCount("special-products", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
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
        // A square with a number on x.
        const a = randInt(2, 5);
        const b = randInt(1, 7);
        const answer = quad(a * a, -2 * a * b, b * b);
        const wrong = [quad(a * a, 0, b * b), quad(a * a, -a * b, b * b), quad(a, -2 * a * b, b * b), quad(a * a, -2 * a * b, -b * b)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (${a}x − ${b})²`,
          hint: `(A − B)² = A² − 2AB + B², with A = ${a}x and B = ${b}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Squaring a difference keeps a middle term: −2AB."),
            trap(wrong[1], `The middle term is twice the product: −2 × ${a}x × ${b}.`),
            trap(wrong[2], `(${a}x)² = ${a * a}x²: the ${a} gets squared too.`),
            trap(wrong[3], `(−${b})² is positive.`),
          ]),
          explanation: `(${a}x − ${b})² = (${a}x)² − 2(${a}x)(${b}) + ${b}² = ${answer}`,
        };
      }
      if (kind === 3) {
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
      }
      if (kind === 4) {
        // Mental math with a sum times a difference.
        const k = randInt(3, 9);
        const d = randInt(1, 4);
        const [lo, hi] = [10 * k - d, 10 * k + d];
        return {
          id: "",
          type: "numeric",
          prompt: `Use (a − b)(a + b) = a² − b² to work out ${lo} × ${hi} without a calculator.`,
          hint: `${lo} = ${10 * k} − ${d} and ${hi} = ${10 * k} + ${d}. So the product is ${10 * k}² − ${d}².`,
          answer: lo * hi,
          traps: trapsFor(lo * hi, [
            trap(100 * k * k, `That is ${10 * k}². Take away ${d}² = ${d * d}.`),
            trap(100 * k * k - d, `b² is ${d}², not ${d}.`),
            trap(100 * k * k + d * d, "A sum times a difference subtracts b²."),
          ]),
          explanation: `${lo} × ${hi} = (${10 * k} − ${d})(${10 * k} + ${d}) = ${10 * k}² − ${d}² = ${100 * k * k} − ${d * d} = ${lo * hi}`,
        };
      }
      // Mental math with a square.
      const k = randInt(2, 9);
      const d = randInt(1, 3);
      const plus = randInt(0, 1) === 0;
      const v = plus ? 10 * k + d : 10 * k - d;
      return {
        id: "",
        type: "numeric",
        prompt: `Use (a ${plus ? "+" : "−"} b)² = a² ${plus ? "+" : "−"} 2ab + b² to work out ${v}² without a calculator.`,
        hint: `${v} = ${10 * k} ${plus ? "+" : "−"} ${d}. Square ${10 * k}, ${plus ? "add" : "take away"} 2 × ${10 * k} × ${d}, and add ${d}².`,
        answer: v * v,
        traps: trapsFor(v * v, [
          trap(100 * k * k + d * d, `Keep the middle term: 2 × ${10 * k} × ${d} = ${20 * k * d}.`),
          trap(plus ? 100 * k * k + 20 * k * d - d * d : 100 * k * k - 20 * k * d - d * d, `b² is always added: +${d * d}.`),
          trap(plus ? 100 * k * k + 10 * k * d + d * d : 100 * k * k - 10 * k * d + d * d, `The middle term is twice ab: 2 × ${10 * k} × ${d}.`),
        ]),
        explanation: `${v}² = ${10 * k}² ${plus ? "+" : "−"} 2(${10 * k})(${d}) + ${d}² = ${100 * k * k} ${plus ? "+" : "−"} ${20 * k * d} + ${d * d} = ${v * v}`,
      };
    }),

  "factoring-trinomials": (seeds) =>
    fillToCount("factoring-trinomials", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 2) {
        // A leading number above 1.
        const a = pick([2, 3, 5]);
        let p = nonZero(-7, 7);
        while (gcd(a, Math.abs(p)) !== 1) p = nonZero(-7, 7);
        let q = nonZero(-7, 7);
        if (a * q + p === 0) q = q === 7 ? 6 : q + 1;
        const answer = `(${a}x${plusTerm(p)})(x${plusTerm(q)})`;
        const target: [number, number, number] = [a, a * q + p, p * q];
        const cands = [`(${a}x${plusTerm(q)})(x${plusTerm(p)})`, `(${a}x${plusTerm(-p)})(x${plusTerm(-q)})`, `(${a}x${plusTerm(p)})(x${plusTerm(-q)})`, `(x${plusTerm(p)})(${a}x${plusTerm(q)})`];
        const same = (u: string) => {
          const m = u.match(/^\((\d*)x(?: ([+−]) (\d+))?\)\((\d*)x(?: ([+−]) (\d+))?\)$/);
          if (!m) return false;
          const [l1, c1, l2, c2] = [Number(m[1] || 1), m[2] ? (m[2] === "+" ? 1 : -1) * Number(m[3]) : 0, Number(m[4] || 1), m[5] ? (m[5] === "+" ? 1 : -1) * Number(m[6]) : 0];
          return l1 * l2 === target[0] && l1 * c2 + c1 * l2 === target[1] && c1 * c2 === target[2];
        };
        const wrong = cands.filter((u) => !same(u));
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor ${quad(...target)}`,
          hint: `The first terms must multiply to ${a}x², and the last terms to ${p * q}. Try pairs until the outer and inner products add to ${coef(target[1])}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, wrong.map((w) => trap(w, `Multiply it back out: the middle term comes out different from ${coef(target[1])}. Check which number sits with the ${a}x.`))),
          explanation: `(${a}x${plusTerm(p)})(x${plusTerm(q)}) = ${a}x²${plusTerm(a * q, "x")}${plusTerm(p, "x")}${plusTerm(p * q)} = ${quad(...target)}`,
        };
      }
      if (kind === 3) {
        // A common factor first.
        const g = pick([2, 3, 4, 5]);
        let p = nonZero(-8, 8);
        let q = nonZero(-8, 8);
        while (p + q === 0 || p === q) q = nonZero(-8, 8);
        if (p > q) [p, q] = [q, p];
        const answer = `${g}${factor(p)}${factor(q)}`;
        const wrong = [`${factor(p)}${factor(q)}`, `${g}${factor(-p)}${factor(-q)}`, `${g}${factor(p)}${factor(-q)}`, `(${g}x${plusTerm(p)})(${g}x${plusTerm(q)})`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor completely: ${quad(g, g * (p + q), g * p * q)}`,
          hint: `Every term divides by ${g}: take it out first. Then factor what is left.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The ${g} that came out stays in front: it is part of the factored form.`),
            trap(wrong[1], `After taking out ${g}, find two numbers that multiply to ${p * q} and add to ${p + q}. Check the signs.`),
            trap(wrong[2], "One sign is off: the pair has to multiply and add to the right numbers at the same time."),
            trap(wrong[3], `Take the ${g} out once, in front. Multiplied back out, that gives ${g * g}x², not ${g}x².`),
          ]),
          explanation: `${quad(g, g * (p + q), g * p * q)} = ${g}(${quad(1, p + q, p * q)}) = ${answer}`,
        };
      }
      if (kind === 4) {
        // A rectangle's missing side.
        let p = nonZero(-8, 9);
        let q = nonZero(-8, 9);
        while (p === q || p + q === 0) q = nonZero(-8, 9);
        if (p < 0 && q < 0) p = -p;
        const area = quad(1, p + q, p * q);
        const answer = factor(q);
        const wrong = [factor(-q), factor(q + 1), factor(p * q), factor(p + q)].filter((w) => w !== answer);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A rectangle has area ${area} and width ${factor(p)}. Which expression is its length?`,
          hint: `Area = length × width, so the length is the other factor of ${area}.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(factor(-q), `Multiply it by ${factor(p)}: the constant comes out with the wrong sign.`),
            trap(factor(q + 1), `Check: ${factor(p)} times that gives a different middle term from ${coef(p + q)}.`),
            trap(factor(p * q), `The two numbers multiply to ${p * q}; each factor holds just one of them.`),
            trap(factor(p + q), `The numbers add to ${p + q}; each factor holds just one of them.`),
          ]),
          explanation: `${area} = ${factor(p)}${answer}, so the length is ${answer}.`,
        };
      }
      // Roots of either sign; the middle term is never zero (that is a difference of squares).
      let p = kind === 0 ? randInt(1, 12) : nonZero(-9, 9);
      let q = kind === 0 ? randInt(2, 12) : nonZero(-9, 9);
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
      const kind = i % 6;
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
      if (kind === 4) {
        // A common factor, then a difference of squares.
        const g = pick([2, 3, 5]);
        const m = randInt(2, 9);
        const answer = `${g}(x + ${m})(x − ${m})`;
        const wrong = [`(x + ${m})(x − ${m})`, `${g}(x − ${m})²`, `(${g}x + ${m})(x − ${m})`, `${g}(x + ${m})²`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor completely: ${g}x² − ${g * m * m}`,
          hint: `Both terms divide by ${g}: take it out first. What is left is a difference of squares.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The ${g} taken out stays in front.`),
            trap(wrong[1], "A squared binomial has a middle term when multiplied out. A difference of squares does not."),
            trap(wrong[2], `Multiply it back out: the middle terms do not cancel. Take out the ${g} first.`),
            trap(wrong[3], "A squared binomial has a middle term and a plus at the end. This has neither."),
          ]),
          explanation: `${g}x² − ${g * m * m} = ${g}(x² − ${m * m}) = ${answer}`,
        };
      }
      if (kind === 5) {
        // A difference of squares twice over.
        const m = randInt(1, 3);
        const m2 = m * m;
        const m4 = m2 * m2;
        const answer = `(x² + ${m2})(x + ${m})(x − ${m})`;
        const wrong = [`(x² + ${m2})(x − ${m})²`, `(x + ${m})²(x − ${m})²`, `(x² − ${m2})²`, `(x² + ${m2})²`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor completely: x⁴ − ${m4}`,
          hint: `x⁴ − ${m4} = (x²)² − ${m2}², a difference of squares. Then look at each factor again: one of them factors more.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `x² − ${m2} is a difference of squares: (x + ${m})(x − ${m}), not (x − ${m})².`),
            trap(wrong[1], `x² + ${m2} is a sum of squares, which stays as it is.`),
            trap(wrong[2], "A difference of squares factors into a sum times a difference, not a square."),
            trap(wrong[3], "The two factors are a sum and a difference: x² + and x² −."),
          ]),
          explanation: `x⁴ − ${m4} = (x² + ${m2})(x² − ${m2}) → x² − ${m2} = (x + ${m})(x − ${m}) → ${answer}`,
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
      const kind = i % 7;
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
      if (kind === 1) {
        const h = nonZero(-6, 6);
        const k = randInt(-8, 8);
        const vertexForm = `y = (${shift("x", h)})²${plusTerm(k)}`;
        const askX = randInt(0, 1) === 0;
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
      if (kind === 2) {
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
      }
      const a = pick([1, 1, 2, -1, -2, 3]);
      const h = nonZero(-5, 5);
      const k = randInt(-9, 9);
      const b = -2 * a * h;
      const c = k + a * h * h;
      const std = `y = ${quad(a, b, c)}`;
      if (kind === 3) {
        // The vertex's height, from standard form: two steps.
        return {
          id: "",
          type: "numeric",
          prompt: `What is the y-coordinate of the vertex of ${std}?`,
          hint: `Find the vertex's x first: x = −b / (2a). Then put it into the equation to get y.`,
          answer: k,
          traps: trapsFor(k, [
            trap(h, "That is the vertex's x-coordinate. Put it into the equation to find y."),
            trap(c, "c is where the parabola crosses the y-axis, which is the vertex only when b = 0."),
            trap(a * h * h - b * h + c, `Put x = ${h} in with its sign: ${b}(${h}) is ${b * h}.`),
          ]),
          explanation: `x = −(${b}) / (2 × ${par(a)}) = ${h} → y = ${a === 1 ? "" : a === -1 ? "-" : a}(${h})²${b === 0 ? "" : ` ${b * h < 0 ? "−" : "+"} ${Math.abs(b * h)}`}${plusTerm(c)} = ${k}`,
        };
      }
      if (kind === 4) {
        const answer = `(${h}, ${k})`;
        const wrong = [`(${-h}, ${k})`, `(${h}, ${c})`, `(${k}, ${h})`, `(${-h}, ${a * h * h - b * h + c})`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the vertex of ${std}?`,
          hint: "x = −b / (2a) gives the vertex's x. Put it back in for its y.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "x = −b / (2a): the minus in front of b changes its sign."),
            trap(wrong[1], `${c} is the y-intercept. Put the vertex's x into the equation for its y.`),
            trap(wrong[2], "The coordinates are in the wrong order: x first."),
            trap(wrong[3], "The x-value's sign is off, and the y-value came from it."),
          ]),
          explanation: `x = −(${b}) / (2 × ${par(a)}) = ${h} → y = ${k} → vertex ${answer}`,
        };
      }
      if (kind === 5) {
        // Where it crosses the x-axis: factor and pick one.
        const r = nonZero(-8, 9);
        let s = nonZero(-8, 9);
        while (s === r || s === -r) s = nonZero(-8, 9);
        const larger = randInt(0, 1) === 0;
        const want = larger ? Math.max(r, s) : Math.min(r, s);
        return {
          id: "",
          type: "numeric",
          prompt: `The parabola y = ${quad(1, -(r + s), r * s)} crosses the x-axis twice. What is the ${larger ? "larger" : "smaller"} x-intercept?`,
          hint: "On the x-axis, y = 0. Factor the quadratic and set each factor equal to 0.",
          answer: want,
          traps: trapsFor(want, [
            trap(larger ? Math.min(r, s) : Math.max(r, s), `That is the other x-intercept. The question asks for the ${larger ? "larger" : "smaller"} one.`),
            trap(-want, "A factor (x − r) is 0 when x = r: the opposite sign of the number in the bracket."),
            trap(r * s, "That is the y-intercept, where x = 0."),
          ]),
          explanation: `0 = ${factor(-r)}${factor(-s)} → x = ${r} or x = ${s} → the ${larger ? "larger" : "smaller"} is ${want}`,
        };
      }
      // A thrown ball's highest point.
      const t = randInt(1, 4);
      const v = 32 * t;
      const h0 = randInt(0, 20);
      const top = 16 * t * t + h0;
      return {
        id: "",
        type: "numeric",
        prompt: `A ball's height is h = -16t² + ${v}t${plusTerm(h0)} feet after t seconds. What is its greatest height, in feet?`,
        hint: "The greatest height is at the vertex: t = −b / (2a). Then put that t into the equation.",
        answer: top,
        traps: trapsFor(top, [
          trap(t, "That is the time it reaches the top. Put it into the equation for the height."),
          trap(v * t + h0, `-16t² still counts: at t = ${t} it takes away ${16 * t * t}.`),
          trap(h0, "That is the height it starts from, at t = 0."),
        ]),
        explanation: `t = −${v} / (2 × -16) = ${t} → h = -16(${t})² + ${v}(${t})${plusTerm(h0)} = ${-16 * t * t} + ${v * t}${plusTerm(h0)} = ${top} feet`,
      };
    }),

  "solving-by-factoring": (seeds) =>
    fillToCount("solving-by-factoring", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        const r = nonZero(-9, 12);
        let s = nonZero(-9, 12);
        while (s === r || s === -r) s = s + 1 === 0 ? 2 : s + 1;
        const bigger = randInt(0, 1) === 0;
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
          explanation: `${factor(-r)}${factor(-s)} = 0 → x = ${r} or x = ${s} → the ${bigger ? "larger" : "smaller"} root is ${want}`,
        };
      }
      if (kind === 1) {
        const n = randInt(2, 15);
        const positive = randInt(0, 1) === 1;
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
          explanation: `(x + ${n})(x − ${n}) = 0 → x = ${n} or x = ${-n}`,
        };
      }
      if (kind === 2) {
        // Everything on one side first.
        const r = randInt(2, 11);
        const s = -randInt(2, 11);
        const b = -(r + s);
        const c = -r * s;
        if (b === 0) {
          return {
            id: "",
            type: "numeric",
            prompt: `Solve x² = ${c}. What is the positive root?`,
            hint: "Take the square root of both sides: there is a positive root and a negative one.",
            answer: r,
            traps: trapsFor(r, [trap(-r, "That is the negative root. The question asks for the positive one."), trap(c / 2, "Halving is not a square root.")]),
            explanation: `x² = ${c} → x = ${r} or x = ${-r} → the positive root is ${r}`,
          };
        }
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${quad(1, b, 0)} = ${c}. What is the positive root?`,
          hint: `Get 0 on one side first: ${quad(1, b, -c)} = 0. Then factor.`,
          answer: r,
          traps: trapsFor(r, [
            trap(-s, "That is the negative root with its sign flipped. Factor after moving everything to one side."),
            trap(s, "That is the negative root. The question asks for the positive one."),
            trap(c, `${c} is on the right side. Bring it across so the equation equals 0, then factor.`),
          ]),
          explanation: `${quad(1, b, -c)} = 0 → ${factor(-r)}${factor(-s)} = 0 → x = ${r} or x = ${s} → the positive root is ${r}`,
        };
      }
      if (kind === 3) {
        // A leading number, and one root that is a fraction.
        const a = pick([2, 3]);
        let p = nonZero(-5, 5);
        while (gcd(a, Math.abs(p)) !== 1) p = nonZero(-5, 5);
        let q = nonZero(-6, 6);
        if (a * q + p === 0) q += 1;
        // (ax + p)(x + q) = 0 → x = −p/a or x = −q.
        const fracRoot = -p / a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${quad(a, a * q + p, p * q)} = 0. One root is a fraction. What is that root? Give it as a fraction.`,
          hint: `Factor as (${a}x + ?)(x + ?): the numbers multiply to ${p * q}, and the outer and inner products add to ${coef(a * q + p)}.`,
          answer: fracRoot,
          traps: trapsFor(fracRoot, [
            trap(-q, "That is the whole-number root. The question asks for the fraction."),
            trap(p / a, `${a}x${plusTerm(p)} = 0 gives ${a}x = ${-p}: the sign flips as ${Math.abs(p)} moves across.`),
            trap(-p, `${a}x = ${-p}, so divide by ${a} as well.`),
          ]),
          explanation: `(${a}x${plusTerm(p)})(x${plusTerm(q)}) = 0 → ${a}x = ${-p} or x = ${-q} → x = ${frac(-p, a)}`,
        };
      }
      if (kind === 4) {
        // A rectangle's width from its area.
        const w = randInt(3, 12);
        const d = randInt(2, 7);
        const area = w * (w + d);
        return {
          id: "",
          type: "numeric",
          prompt: `A rectangle's length is ${d} meters more than its width. Its area is ${area} square meters. What is its width, in meters?`,
          hint: `Call the width w. Then w(w + ${d}) = ${area}: move ${area} across, factor, and keep the root that makes sense for a length.`,
          answer: w,
          traps: trapsFor(w, [
            trap(w + d, "That is the length. The question asks for the width."),
            trap(-(w + d), "A width cannot be negative, so that root is set aside."),
            trap(Math.round(Math.sqrt(area) * 100) / 100, "The sides differ, so the area is not a square's: solve w(w + d) = area."),
          ]),
          explanation: `w(w + ${d}) = ${area} → ${quad(1, d, -area, "w")} = 0 → (w − ${w})(w + ${w + d}) = 0 → w = ${w} meters`,
        };
      }
      // x on both sides with no constant: factor out x.
      const k = randInt(2, 6);
      const r = randInt(2, 9);
      return {
        id: "",
        type: "numeric",
        prompt: `Solve ${k}x² = ${k * r}x. What is the nonzero root?`,
        hint: `Move everything to one side and factor out ${k}x: ${k}x(x − ${r}) = 0.`,
        answer: r,
        traps: trapsFor(r, [
          trap(0, "0 is one root, and the question asks for the other one."),
          trap(k * r, `${k}x² = ${k * r}x: divide out ${k} as well.`),
          trap(-r, `${k}x(x − ${r}) = 0 is zero at x = +${r}.`),
        ]),
        explanation: `${k}x² − ${k * r}x = 0 → ${k}x(x − ${r}) = 0 → x = 0 or x = ${r}`,
      };
    }),

  "completing-square": (seeds) =>
    fillToCount("completing-square", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        const b = randInt(2, 40) * 2;
        const square = (b / 2) ** 2;
        const minus = randInt(0, 1) === 1;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Complete the square: x² ${minus ? "−" : "+"} ${b}x + ___ = (x ${minus ? "−" : "+"} ${b / 2})²`,
          hint: minus ? "Take half of the x coefficient, then square it. A square is never negative." : "Take half of the x coefficient, then square it: (b/2)².",
          answer: `${square}`,
          choices: mcChoices(`${square}`, minus ? [`${-b}`, `${b / 2}`, `${b * b}`, `${-square}`] : [`${b}`, `${b / 2}`, `${b * b}`]),
          traps: trapsFor(`${square}`, [
            trap(`${b}`, `Half of ${b} first, then square it: (${b}/2)².`),
            trap(`${-b}`, `Half of −${b}, then squared: (−${b / 2})². A square is never negative.`),
            trap(`${b / 2}`, `Half of ${b} is ${b / 2}. Now square it.`),
            trap(`${b * b}`, `Square half of ${b}, not ${b} itself: (${b}/2)².`),
            trap(`${-square}`, `(−${b / 2})² is positive: a negative times a negative.`),
          ]),
          explanation: `(${minus ? "−" : ""}${b}/2)² = ${minus ? `(−${b / 2})` : b / 2}² = ${square}`,
        };
      }
      if (kind === 1) {
        // Solve by completing the square.
        const r = randInt(-9, 9);
        let s = randInt(-9, 9);
        while (s === r || (r + s) % 2 !== 0) s = randInt(-9, 9);
        const b = -(r + s);
        const c = r * s;
        const h = b / 2;
        const rhs = h * h - c;
        const larger = randInt(0, 1) === 0;
        const want = larger ? Math.max(r, s) : Math.min(r, s);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${quad(1, b, c)} = 0 by completing the square. What is the ${larger ? "larger" : "smaller"} root?`,
          hint: `${c === 0 ? "" : `Move the ${Math.abs(c)} across. `}Add (b/2)² to both sides, write the left side as a square, then take the square root of both sides.`,
          answer: want,
          traps: trapsFor(want, [
            trap(larger ? Math.min(r, s) : Math.max(r, s), `That is the other root. The question asks for the ${larger ? "larger" : "smaller"} one.`),
            trap(-h + rhs, `Take the square root of ${rhs} before moving it: √${rhs} = ${Math.sqrt(rhs)}.`),
            trap(Math.sqrt(rhs), `That is √${rhs}. Then ${h > 0 ? "subtract" : "add"} ${Math.abs(h)} to finish.`),
          ]),
          explanation:
            h === 0
              ? `x² = ${-c} → x = ±${Math.sqrt(rhs)} → x = ${r} or x = ${s}`
              : `${quad(1, b, 0)} = ${-c} → ${quad(1, b, 0)} + ${h * h} = ${-c} + ${h * h} → (${shift("x", -h)})² = ${rhs} → ${shift("x", -h)} = ±${Math.sqrt(rhs)} → x = ${r} or x = ${s}`,
        };
      }
      const half = nonZero(-8, 8);
      const b = 2 * half;
      const c = randInt(-12, 15);
      const k = c - half * half;
      if (kind === 2 || kind === 3) {
        // The k of vertex form, or the lowest value it names.
        const askMin = kind === 3;
        return {
          id: "",
          type: "numeric",
          prompt: askMin ? `What is the minimum value of y = ${quad(1, b, c)}?` : `Write ${quad(1, b, c)} in the form (x − h)² + k. What is k?`,
          hint: `Half of ${b} is ${half}, and ${half}² = ${half * half}. Add it to make a square, and take it away again to keep things balanced.`,
          answer: k,
          traps: trapsFor(k, [
            trap(c + half * half, `Adding ${half * half} to make the square means taking ${half * half} away too.`),
            trap(c - b * b, `Square half of ${b}, not all of it: ${half}² = ${half * half}.`),
            trap(c, `${c} is the constant before completing the square.`),
            askMin ? trap(-half, `That is where the minimum happens, x = ${-half}. The question asks for the minimum value of y.`) : null,
          ]),
          explanation: `${quad(1, b, c)} = (${quad(1, b, 0)} + ${half * half})${plusTerm(c)} − ${half * half} → (${shift("x", -half)})²${plusTerm(k)} → ${askMin ? "the minimum value is" : "k ="} ${k}`,
        };
      }
      // The whole vertex form.
      const answer = `(${shift("x", -half)})²${plusTerm(k)}`;
      const wrong = [`(${shift("x", -half)})²${plusTerm(c)}`, `(${shift("x", -b)})²${plusTerm(c - b * b)}`, `(${shift("x", half)})²${plusTerm(k)}`, `(${shift("x", -half)})²${plusTerm(c + half * half)}`];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which is ${quad(1, b, c)} written in vertex form?`,
        hint: `Half of ${b} is ${half}. (${shift("x", -half)})² makes ${quad(1, b, half * half)}, so take ${half * half} back off.`,
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, [
          trap(wrong[0], `(${shift("x", -half)})² adds ${half * half} that was never there: take it back off.`),
          trap(wrong[1], `Use half of ${b}, not all of it.`),
          trap(wrong[2], `Multiply it out: (${shift("x", half)})² gives ${coef(-b)}, the wrong sign in the middle.`),
          trap(wrong[3], `The ${half * half} added to make the square is taken away, not added again.`),
        ]),
        explanation: `${quad(1, b, c)} = (${quad(1, b, half * half)})${plusTerm(c)} − ${half * half} = ${answer}`,
      };
    }),

  "quadratic-formula": (seeds) =>
    fillToCount("quadratic-formula", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        // The outcome is chosen first, so 2, 1 and 0 each come up.
        const outcome = pick(["2", "1", "0"] as const);
        let b: number;
        let c: number;
        const a = pick([1, 1, 2, 3]);
        if (outcome === "2") {
          b = nonZero(-9, 9);
          c = Math.floor((b * b) / (4 * a)) - randInt(1, 6);
        } else if (outcome === "1") {
          const r = nonZero(-5, 5);
          // a(x − r)² = ax² − 2arx + ar²
          b = -2 * a * r;
          c = a * r * r;
        } else {
          b = randInt(-6, 6);
          c = Math.floor((b * b) / (4 * a)) + randInt(1, 8);
        }
        const disc = b * b - 4 * a * c;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `For ${quad(a, b, c)} = 0, how many real solutions?`,
          hint: "Work out the discriminant, b² − 4ac: positive means 2, zero means 1, negative means 0.",
          answer: outcome,
          choices: mcChoices(outcome, ["0", "1", "2", "Infinitely many"]),
          traps: trapsFor(outcome, [
            trap("Infinitely many", "A quadratic equation has at most 2 real solutions."),
            ...["0", "1", "2"].map((o) => trap(o, `Work out b² − 4ac with a = ${a}, b = ${b} and c = ${c}, then read its sign: negative means 0 solutions, zero means 1, positive means 2.`)),
          ]),
          explanation: `b² − 4ac = ${par(b)}² − 4(${a})(${par(c)}) = ${disc} → ${disc > 0 ? "positive, so 2 real solutions" : disc === 0 ? "zero, so exactly 1 real solution" : "negative, so 0 real solutions"}`,
        };
      }
      if (kind === 2) {
        // Roots that are not whole: the formula, then rounding.
        let a = pick([1, 2, 3]);
        let b = nonZero(-7, 7);
        let c = nonZero(-8, 8);
        let disc = b * b - 4 * a * c;
        for (let t = 0; t < 20 && (disc <= 0 || Number.isInteger(Math.sqrt(disc))); t += 1) {
          a = pick([1, 2, 3]);
          b = nonZero(-7, 7);
          c = nonZero(-8, 8);
          disc = b * b - 4 * a * c;
        }
        if (disc <= 0 || Number.isInteger(Math.sqrt(disc))) [a, b, c, disc] = [2, 3, -4, 41];
        const larger = randInt(0, 1) === 0;
        const root = (-b + (larger ? 1 : -1) * Math.sqrt(disc)) / (2 * a);
        const rounded = Math.round(root * 100) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${quad(a, b, c)} = 0 with the quadratic formula. What is the ${larger ? "larger" : "smaller"} root? (round to the hundredths place)`,
          hint: `x = (−b ± √(b² − 4ac)) / 2a with a = ${a}, b = ${b}, c = ${c}. Work out b² − 4ac first.`,
          answer: rounded,
          decimalPlaces: 2,
          traps: trapsFor(rounded, [
            trap(Math.round(((-b + (larger ? -1 : 1) * Math.sqrt(disc)) / (2 * a)) * 100) / 100, `That is the other root: the ${larger ? "+" : "−"} in ± gives the ${larger ? "larger" : "smaller"} one.`),
            trap(Math.round(((b + (larger ? 1 : -1) * Math.sqrt(disc)) / (2 * a)) * 100) / 100, "The formula starts with −b: the sign of b flips."),
            trap(Math.round((-b + (larger ? 1 : -1) * Math.sqrt(disc)) * 100) / 100, "Divide the whole top by 2a."),
          ]),
          explanation: `b² − 4ac = ${par(b)}² − 4(${a})(${par(c)}) = ${disc} → x = (${-b} ${larger ? "+" : "−"} √${disc}) / ${2 * a} ≈ ${rounded.toFixed(2)}`,
        };
      }
      if (kind === 3) {
        const a = pick([1, 2, 3, -1, -2]);
        const b = randInt(-9, 9);
        const c = nonZero(-9, 9);
        const disc = b * b - 4 * a * c;
        return {
          id: "",
          type: "numeric",
          prompt: `What is the discriminant of ${quad(a, b, c)} = 0?`,
          hint: "The discriminant is b² − 4ac. Watch the signs of a and c.",
          answer: disc,
          traps: trapsFor(disc, [
            trap(b * b + 4 * a * c, `It is b² minus 4ac: with a = ${a} and c = ${c}, 4ac = ${4 * a * c}.`),
            trap(-(b * b) - 4 * a * c, "b² is never negative: square b, sign and all."),
            trap(b - 4 * a * c, "Square b first."),
          ]),
          explanation: `b² − 4ac = ${par(b)}² − 4(${a})(${par(c)}) = ${b * b} − ${par(4 * a * c)} = ${disc}`,
        };
      }
      if (kind === 4) {
        // A ball in the air: when does it land?
        const v = randInt(20, 60);
        const h0 = randInt(3, 40);
        const disc = v * v + 64 * h0;
        const t = (-v - Math.sqrt(disc)) / -32;
        const rounded = Math.round(t * 100) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `A ball is thrown upward from ${h0} feet with a speed of ${v} feet per second, so its height is h = -16t² + ${v}t + ${h0}. After how many seconds does it hit the ground? (round to the hundredths place)`,
          hint: `It hits the ground when h = 0. Use the quadratic formula with a = -16, b = ${v}, c = ${h0}, and keep the positive answer.`,
          answer: rounded,
          decimalPlaces: 2,
          traps: trapsFor(rounded, [
            trap(Math.round(((-v + Math.sqrt(disc)) / -32) * 100) / 100, "Time after the throw is positive: keep the positive root."),
            trap(Math.round((v / 32) * 100) / 100, "That is when it reaches the top. It lands later, when h = 0."),
            trap(Math.round(((v + Math.sqrt(disc)) / 16) * 100) / 100, "The bottom of the formula is 2a = 2 × (-16) = -32."),
          ]),
          explanation: `0 = -16t² + ${v}t + ${h0} → t = (−${v} − √(${v * v} + ${64 * h0})) / (-32) = (−${v} − √${disc}) / (-32) ≈ ${rounded.toFixed(2)} seconds`,
        };
      }
      const r = nonZero(-9, 11);
      let s = nonZero(-9, 11);
      while (s === r) s = nonZero(-9, 11);
      const bigger = randInt(0, 1) === 0;
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
      const kind = i % 6;
      if (kind === 0) {
        const h = nonZero(-6, 6);
        const a = randInt(2, 9);
        const larger = randInt(0, 1) === 0;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve |${shift("x", h)}| = ${a}. What is the ${larger ? "larger" : "smaller"} solution?`,
          hint: `Split it: ${shift("x", h)} = ${a} or ${shift("x", h)} = ${-a}.`,
          answer: larger ? h + a : h - a,
          traps: trapsFor(larger ? h + a : h - a, [
            trap(larger ? h - a : h + a, `That is the other solution. Split it into two equations and pick the ${larger ? "larger" : "smaller"} result.`),
            trap(a, `${a} is the right side. Solve ${shift("x", h)} = ${a} and ${shift("x", h)} = ${-a} for x.`),
            trap(h, `${h} is the number that makes the inside 0, not a solution.`),
            trap(-h + (larger ? a : -a), "The number inside the bracket moves across with its sign changed."),
          ]),
          explanation: `${shift("x", h)} = ${a} gives x = ${h + a} → ${shift("x", h)} = ${-a} gives x = ${h - a}`,
        };
      }
      if (kind === 1 || kind === 2) {
        // Get the absolute value alone first.
        const k = randInt(2, 5);
        const h = nonZero(-6, 6);
        const A = randInt(2, 8);
        const m = randInt(1, 9);
        const flip = kind === 2;
        const n = flip ? m - k * A : k * A - m;
        const larger = randInt(0, 1) === 0;
        const [x1, x2] = [-h + A, -h - A];
        const want = larger ? x1 : x2;
        const left = flip ? `-${k}|${shift("x", -h)}| + ${m}` : `${k}|${shift("x", -h)}| − ${m}`;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${left} = ${n}. What is the ${larger ? "larger" : "smaller"} solution?`,
          hint: flip
            ? `Get the absolute value alone: subtract ${m}, then divide by -${k}. Then split it into two equations.`
            : `Get the absolute value alone: add ${m}, then divide by ${k}. Then split it into two equations.`,
          answer: want,
          traps: trapsFor(want, [
            trap(larger ? x2 : x1, `That is the other solution. The question asks for the ${larger ? "larger" : "smaller"} one.`),
            trap(flip ? -h + (n - m) / k : -h + (n + m), `Divide by ${flip ? `-${k}` : k} to get the absolute value alone before splitting.`),
            trap(larger ? h + A : h - A, `${shift("x", -h)} = ±${A}: the ${Math.abs(h)} moves across with its sign changed.`),
          ]),
          explanation: `${flip ? `-${k}|${shift("x", -h)}| = ${n - m}` : `${k}|${shift("x", -h)}| = ${n + m}`} → |${shift("x", -h)}| = ${A} → ${shift("x", -h)} = ${A} or ${shift("x", -h)} = ${-A} → x = ${x1} or x = ${x2}`,
        };
      }
      if (kind === 3) {
        // A number on x inside the bars: one answer may be a fraction.
        const a = randInt(2, 4);
        const b = randInt(-9, 12);
        const c = randInt(2, 12);
        const [x1, x2] = [(b + c) / a, (b - c) / a];
        const smaller = randInt(0, 1) === 0;
        const want = smaller ? Math.min(x1, x2) : Math.max(x1, x2);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve |${lin(a, -b)}| = ${c}. What is the ${smaller ? "smaller" : "larger"} solution? Give it as a whole number or a fraction.`,
          hint: `Split it: ${lin(a, -b)} = ${c} or ${lin(a, -b)} = ${-c}. Solve each one.`,
          answer: want,
          traps: trapsFor(want, [
            trap(smaller ? Math.max(x1, x2) : Math.min(x1, x2), `That is the other solution. The question asks for the ${smaller ? "smaller" : "larger"} one.`),
            trap(smaller ? Math.min(b + c, b - c) : Math.max(b + c, b - c), `That is ${a}x. Divide by ${a}.`),
            trap(smaller ? -Math.max(x1, x2) : -Math.min(x1, x2), `The ${Math.abs(b)} moves across with its sign changed before you divide.`),
          ]),
          explanation: `${lin(a, -b)} = ${c} → x = ${frac(b + c, a)} → ${lin(a, -b)} = ${-c} → x = ${frac(b - c, a)}`,
        };
      }
      if (kind === 4) {
        const a = randInt(2, 25);
        const positive = randInt(0, 1) === 0;
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
      // How many solutions, once the absolute value is alone.
      const k = randInt(2, 5);
      const h = nonZero(-6, 6);
      const m = randInt(1, 12);
      const outcome = pick(["0", "1", "2"] as const);
      const A = outcome === "0" ? -randInt(1, 6) : outcome === "1" ? 0 : randInt(1, 6);
      const n = k * A + m;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `How many solutions does ${k}|${shift("x", h)}| + ${m} = ${n} have?`,
        hint: `Get the absolute value alone first: subtract ${m}, then divide by ${k}. Then look at the sign of what is left.`,
        answer: outcome,
        choices: mcChoices(outcome, ["0", "1", "2", "Infinitely many"]),
        traps: trapsFor(outcome, [
          trap("Infinitely many", "An absolute value equation has at most two solutions."),
          trap("2", outcome === "1" ? "Only one number has an absolute value of 0." : "An absolute value is never negative, so it cannot equal a negative number."),
          trap("1", outcome === "2" ? "A positive distance can be reached on either side: two solutions." : "An absolute value is never negative, so it cannot equal a negative number."),
          trap("0", outcome === "1" ? `|${shift("x", h)}| = 0 has one solution: the x that makes the inside 0.` : "A positive distance can be reached on either side: two solutions."),
        ]),
        explanation: `${k}|${shift("x", h)}| = ${n - m} → |${shift("x", h)}| = ${A} → ${outcome === "0" ? "an absolute value is never negative: 0 solutions" : outcome === "1" ? "only when the inside is 0: 1 solution" : "two ways to be that far from 0: 2 solutions"}`,
      };
    }),

  "absolute-value-inequalities": (seeds) =>
    fillToCount("absolute-value-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const a = randInt(3, 20);
      if (kind === 0) {
        const less = randInt(0, 1) === 0;
        const answer = less ? `−${a} < x < ${a}` : `x < −${a} or x > ${a}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |x| ${less ? "<" : ">"} ${a}`,
          hint: less ? "Less than a distance means between −a and a." : "More than a distance splits into two rays.",
          answer,
          choices: mcChoices(answer, less ? [`x < ${a}`, `x > −${a}`, `x < −${a} or x > ${a}`] : [`−${a} < x < ${a}`, `x > ${a}`, `x < −${a}`]),
          traps: trapsFor(answer, [
            trap(`x < ${a}`, `That is half of it. |x| < ${a} also rules out the numbers below −${a}: the answer is between two values.`),
            trap(`x > −${a}`, `That is half of it. |x| < ${a} also rules out the numbers above ${a}: the answer is between two values.`),
            trap(`x < −${a} or x > ${a}`, "That is the greater-than case. Less than a distance means between, one stretch with two ends."),
            trap(`−${a} < x < ${a}`, "That is the less-than case. More than a distance means outside: two rays pointing away from each other."),
            trap(`x > ${a}`, `That is one ray. |x| > ${a} is true on both sides of 0, so there are two.`),
            trap(`x < −${a}`, `That is one ray. |x| > ${a} is true on both sides of 0, so there are two.`),
          ]),
          explanation: `|x| ${less ? "<" : ">"} ${a} means x is ${less ? "within" : "more than"} ${a} from 0: ${answer}.`,
        };
      }
      if (kind === 2) {
        // A number on x inside the bars.
        const k = randInt(2, 4);
        const center = randInt(-4, 6);
        const r = randInt(1, 5);
        const b = k * center;
        const c = k * r;
        const [lo, hi] = [center - r, center + r];
        const answer = `${lo} ≤ x ≤ ${hi}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |${lin(k, -b)}| ≤ ${c}`,
          hint: `Rewrite as -${c} ≤ ${lin(k, -b)} ≤ ${c}. Then ${b === 0 ? "" : `${b > 0 ? "add" : "subtract"} ${Math.abs(b)} in all three parts, and `}divide all three by ${k}.`,
          answer,
          choices: mcChoices(answer, [`${-c + b} ≤ x ≤ ${c + b}`, `x ≤ ${lo} or x ≥ ${hi}`, `${lo - 1} ≤ x ≤ ${hi + 1}`, `${-r} ≤ x ≤ ${r}`]),
          traps: trapsFor(answer, [
            trap(`${-c + b} ≤ x ≤ ${c + b}`, `That is ${k}x. Divide all three parts by ${k}.`),
            trap(`x ≤ ${lo} or x ≥ ${hi}`, "Less than or equal to a distance means between: one stretch."),
            trap(`${lo - 1} ≤ x ≤ ${hi + 1}`, `The ends are off: whatever happens to the middle happens to both ends.`),
            trap(`${-r} ≤ x ≤ ${r}`, `The ${Math.abs(b)} moves the middle of the stretch: it centers on ${center}, not 0.`),
          ]),
          explanation: `-${c} ≤ ${lin(k, -b)} ≤ ${c} → ${-c + b} ≤ ${k}x ≤ ${c + b} → ${answer}`,
        };
      }
      if (kind === 3) {
        // The absolute value alone first, then two rays.
        const k = randInt(2, 4);
        const h = nonZero(-6, 6);
        const A = randInt(2, 7);
        const m = randInt(1, 9);
        const n = k * A - m;
        const [lo, hi] = [-h - A, -h + A];
        const answer = `x < ${lo} or x > ${hi}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve ${k}|${shift("x", -h)}| − ${m} > ${n}`,
          hint: `Get the absolute value alone: add ${m}, then divide by ${k}. More than a distance gives two rays.`,
          answer,
          choices: mcChoices(answer, [`${lo} < x < ${hi}`, `x < ${-A} or x > ${A}`, `x < ${h - A} or x > ${h + A}`, `x < ${-h - (n + m)} or x > ${-h + n + m}`]),
          traps: trapsFor(answer, [
            trap(`${lo} < x < ${hi}`, "That is the less-than case. Greater than a distance means outside: two rays."),
            trap(`x < ${-A} or x > ${A}`, `The ${Math.abs(h)} inside the bars shifts both ends.`),
            trap(`x < ${h - A} or x > ${h + A}`, `The ${Math.abs(h)} moves across with its sign changed.`),
            trap(`x < ${-h - (n + m)} or x > ${-h + n + m}`, `Divide by ${k} to get the absolute value alone first.`),
          ]),
          explanation: `${k}|${shift("x", -h)}| > ${n + m} → |${shift("x", -h)}| > ${A} → ${shift("x", -h)} < ${-A} or ${shift("x", -h)} > ${A} → ${answer}`,
        };
      }
      if (kind === 4) {
        // A tolerance, written as an absolute value.
        const target = pick([250, 300, 400, 454, 500, 750, 1000]);
        const tol = pick([2, 3, 4, 5, 8, 10]);
        const answer = `|w − ${target}| ≤ ${tol}`;
        const wrong = [`|w − ${target}| ≥ ${tol}`, `|w + ${target}| ≤ ${tol}`, `|w − ${tol}| ≤ ${target}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `A machine fills bags with ${target} grams of rice, give or take ${tol} grams. Which inequality shows the weights w that pass?`,
          hint: "|w − target| is how far a weight is from the target. That distance can be at most the tolerance.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "≥ keeps the weights far from the target, the ones that fail."),
            trap(wrong[1], "The distance from the target is w minus the target."),
            trap(wrong[2], "The target and the tolerance traded places."),
          ]),
          explanation: `A passing bag is within ${tol} grams of ${target}: ${answer}, so ${target - tol} ≤ w ≤ ${target + tol}`,
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
      const kind = i % 5;
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
          explanation: first ? `${x} < 0 → f(${x}) = ${x} + ${c} = ${x + c}` : `${x} ≥ 0 → f(${x}) = ${par(x)}² = ${x * x}`,
        };
      }
      if (kind === 1) {
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
          explanation: first ? `${x} < ${boundary} → f(${x}) = ${a}(${x}) = ${a * x}` : `${x} ≥ ${boundary} → f(${x}) = ${x} + ${b} = ${x + b}`,
        };
      }
      if (kind === 2) {
        // Three pieces.
        const lo = randInt(-4, -1);
        const hi = randInt(1, 4);
        const m = randInt(2, 4);
        const k = randInt(-3, 6);
        const d = randInt(1, 5);
        const f = (x: number) => (x < lo ? -m * x : x <= hi ? k : x * x - d);
        const x = pick([lo - randInt(1, 4), lo, randInt(lo + 1, hi - 1), hi, hi + randInt(1, 4)]);
        const piece = x < lo ? `-${m}x` : x <= hi ? `${k}` : `x² − ${d}`;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { -${m}x if x < ${lo}; ${k} if ${lo} ≤ x ≤ ${hi}; x² − ${d} if x > ${hi} }. Find f(${x}).`,
          hint: `Find the piece whose condition ${x} meets. Check the ends carefully: ${lo} and ${hi} belong to the middle piece.`,
          answer: f(x),
          traps: trapsFor(f(x), [
            trap(x < lo ? k : x <= hi ? -m * x : k, `Check which condition ${x} meets: ${x < lo ? `${x} < ${lo}` : x <= hi ? `${lo} ≤ ${x} ≤ ${hi}` : `${x} > ${hi}`}.`),
            trap(x * x - d, x > hi ? "" : `x² − ${d} is only for x > ${hi}.`),
            trap(-m * x, x < lo ? "" : `-${m}x is only for x < ${lo}.`),
          ].filter((t) => t.why)),
          explanation: `${x < lo ? `${x} < ${lo}` : x <= hi ? `${lo} ≤ ${x} ≤ ${hi}` : `${x} > ${hi}`} → f(${x}) = ${piece === `${k}` ? k : piece.replace("x", `(${x})`)}${piece === `${k}` ? "" : ` = ${f(x)}`}`,
        };
      }
      if (kind === 3) {
        // Two inputs, two pieces, one sum.
        const c = randInt(-2, 4);
        const a = randInt(2, 4);
        const b = randInt(-5, 5);
        const top = randInt(6, 12);
        const f = (x: number) => (x < c ? a * x + b : top - x);
        const u = c - randInt(1, 5);
        const v = c + randInt(0, 5);
        const total = f(u) + f(v);
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { ${lin(a, b)} if x < ${c}; ${top} − x if x ≥ ${c} }. Find f(${u}) + f(${v}).`,
          hint: `Each input picks its own piece: ${u} < ${c}, and ${v} ≥ ${c}. Work out both, then add.`,
          answer: total,
          traps: trapsFor(total, [
            trap(a * u + b + a * v + b, `${v} is not less than ${c}, so f(${v}) uses ${top} − x.`),
            trap(top - u + top - v, `${u} is less than ${c}, so f(${u}) uses ${lin(a, b)}.`),
            trap(f(u), `That is f(${u}) alone. Add f(${v}).`),
          ]),
          explanation: `f(${u}) = ${a}(${u})${plusTerm(b)} = ${f(u)} → f(${v}) = ${less(top, v)} = ${f(v)} → ${f(u) === 0 || f(v) === 0 ? `the sum is ${total}` : `${f(u)} + ${par(f(v))} = ${total}`}`,
        };
      }
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
        explanation: first ? `${x} < 0 → f(${x}) = −(${x}) = ${-x}` : `${x} ≥ 0 → f(${x}) = ${m}(${x}) = ${m * x}`,
      };
    }),

  // ---- Unit 14: Data & Statistics ----

  "center-spread": (seeds) =>
    fillToCount("center-spread", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // A median, from data in the order it was collected.
        const n = pick([7, 9, 8, 10]);
        const sorted = sortedData(n, 4, 48);
        const shown = seededShuffle(sorted);
        const mid = n / 2;
        const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[mid - 1] + sorted[mid]) / 2;
        const whole = Number.isInteger(median);
        const mean = sorted.reduce((s, v) => s + v, 0) / n;
        return {
          id: "",
          type: "numeric",
          prompt: `Find the median of ${shown.join(", ")}.${whole ? "" : " Write your answer as a decimal."}`,
          hint: n % 2 ? "Put the numbers in order first. The median is the one in the middle." : "Put the numbers in order first. With an even count, the median is halfway between the two middle numbers.",
          answer: median,
          traps: trapsFor(median, [
            trap(shown[Math.floor(n / 2)], "That is the middle of the list as written. Sort the numbers first; the median is the middle of the sorted list."),
            trap(Math.round(mean * 100) / 100, "That is the mean. The median is the middle value once the data is in order."),
            n % 2 ? null : trap(sorted[mid - 1], "With an even count there are two middle numbers. The median is halfway between them."),
          ]),
          explanation: `In order: ${sorted.join(", ")} → ${n % 2 ? `the middle value is ${median}` : `the middle two are ${sorted[mid - 1]} and ${sorted[mid]} → (${sorted[mid - 1]} + ${sorted[mid]}) ÷ 2 = ${fmtNum(median)}`}`,
        };
      }
      if (kind === 1) {
        // A mean that comes out whole.
        const n = randInt(4, 6);
        const target = randInt(72, 92);
        let vals = Array.from({ length: n - 1 }, () => randInt(65, 99));
        let last = n * target - vals.reduce((s, v) => s + v, 0);
        while (last < 55 || last > 100) {
          vals = Array.from({ length: n - 1 }, () => randInt(65, 99));
          last = n * target - vals.reduce((s, v) => s + v, 0);
        }
        vals = seededShuffle([...vals, last]);
        const sum = n * target;
        const sorted = [...vals].sort((a, b) => a - b);
        const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
        return {
          id: "",
          type: "numeric",
          prompt: `${["Four", "Five", "Six"][n - 4]} quiz scores are ${listOf(vals.map(String))}. What is the mean score?`,
          hint: `Add all ${n} scores, then divide by ${n}.`,
          answer: target,
          traps: trapsFor(target, [
            trap(sum, `That is the total. Divide it by the ${n} scores.`),
            trap(Math.round((sum / (n - 1)) * 100) / 100, `There are ${n} scores, so divide by ${n}.`),
            trap(median, "That is the median, the middle score. The mean adds them all and shares the total equally."),
          ]),
          explanation: `${vals.join(" + ")} = ${sum} → ${sum} ÷ ${n} = ${target}`,
        };
      }
      if (kind === 2 || kind === 5) {
        // Quartiles with the middle value left out of both halves.
        const n = pick([7, 11]);
        const sorted = sortedData(n, 2, 60, true);
        const shown = seededShuffle(sorted);
        const q1 = n === 7 ? sorted[1] : sorted[2];
        const q3 = n === 7 ? sorted[5] : sorted[8];
        const median = sorted[(n - 1) / 2];
        const iqr = q3 - q1;
        if (kind === 2) {
          return {
            id: "",
            type: "numeric",
            prompt: `Find the interquartile range (IQR) of ${shown.join(", ")}.`,
            hint: "Order the data and find the median. Q1 is the median of the lower half and Q3 of the upper half (the middle value belongs to neither). IQR = Q3 − Q1.",
            answer: iqr,
            traps: trapsFor(iqr, [
              trap(sorted[n - 1] - sorted[0], "That is the range, the biggest minus the smallest. The IQR is the spread of the middle half: Q3 − Q1."),
              trap(q3 - median, "That is Q3 minus the median. The IQR runs from Q1 to Q3."),
              trap(q3, "That is Q3. Subtract Q1 from it."),
            ]),
            explanation: `In order: ${sorted.join(", ")} → median ${median} → Q1 = ${q1} and Q3 = ${q3} → IQR = ${q3} − ${q1} = ${iqr}`,
          };
        }
        const fence = q3 + 1.5 * iqr;
        const whole = Number.isInteger(fence);
        return {
          id: "",
          type: "numeric",
          prompt: `For the data ${shown.join(", ")}, what is the upper fence: Q3 plus 1.5 times the IQR? Values above it count as outliers.${whole ? "" : " Write your answer as a decimal."}`,
          hint: "Find Q1 and Q3 first (the middle value belongs to neither half), then the IQR, then Q3 + 1.5 × IQR.",
          answer: fence,
          traps: trapsFor(fence, [
            trap(q3 + iqr, "Multiply the IQR by 1.5 before adding it to Q3."),
            trap(1.5 * iqr, "That is 1.5 × IQR. The fence starts at Q3, so add Q3."),
            trap(median + 1.5 * iqr, "The fence is measured from Q3, the top of the middle half, not from the median."),
          ]),
          explanation: `Q1 = ${q1}, Q3 = ${q3} → IQR = ${iqr} → ${q3} + 1.5 × ${iqr} = ${fmtNum(fence)}`,
        };
      }
      if (kind === 3) {
        // How much an outlier pulls the mean.
        let base = Array.from({ length: 6 }, () => randInt(10, 30));
        while (base.reduce((s, v) => s + v, 0) % 6 !== 0) base = Array.from({ length: 6 }, () => randInt(10, 30));
        const s6 = base.reduce((s, v) => s + v, 0);
        let outlier = 3 * Math.max(...base) + randInt(0, 20);
        while ((s6 + outlier) % 7 !== 0) outlier += 1;
        const with7 = (s6 + outlier) / 7;
        const without = s6 / 6;
        const sorted = [...base, outlier].sort((a, b) => a - b);
        const shown = seededShuffle([...base, outlier]);
        return {
          id: "",
          type: "numeric",
          prompt: `The data set is ${shown.join(", ")}. How much does the mean go down when the outlier, ${outlier}, is removed?`,
          hint: "Find the mean with all 7 values, then the mean of the other 6. Subtract.",
          answer: with7 - without,
          traps: trapsFor(with7 - without, [
            trap(with7, "That is the mean with the outlier. Find the mean without it too, then subtract."),
            trap(without, "That is the mean without the outlier. Subtract it from the mean with it."),
            trap(sorted[3] - (sorted[2] + sorted[3]) / 2, "That is how the median moves. The question is about the mean."),
          ]),
          explanation: `With it: ${s6 + outlier} ÷ 7 = ${with7} → without it: ${s6} ÷ 6 = ${without} → ${with7} − ${without} = ${with7 - without}`,
        };
      }
      // The score needed for a target mean.
      const target = randInt(78, 90);
      let four = Array.from({ length: 4 }, () => randInt(70, 98));
      let need = 5 * target - four.reduce((s, v) => s + v, 0);
      while (need < 60 || need > 100) {
        four = Array.from({ length: 4 }, () => randInt(70, 98));
        need = 5 * target - four.reduce((s, v) => s + v, 0);
      }
      const sum4 = four.reduce((s, v) => s + v, 0);
      return {
        id: "",
        type: "numeric",
        prompt: `Four test scores are ${listOf(four.map(String))}. What score on the fifth test makes the mean exactly ${target}?`,
        hint: `For a mean of ${target} over 5 tests, the five scores must add up to 5 × ${target}. Subtract what is already there.`,
        answer: need,
        traps: trapsFor(need, [
          trap(target, "Scoring the target itself only works when the others already average it."),
          trap(4 * target - sum4, "There are five tests, so the total has to be 5 times the target."),
          trap(Math.round(((sum4 + target) / 5) * 100) / 100, "That is the mean if the fifth score were the target. Work backward from the total the five must reach."),
        ]),
        explanation: `5 × ${target} = ${5 * target} → ${four.join(" + ")} = ${sum4} → ${5 * target} − ${sum4} = ${need}`,
      };
    }),

  "trend-lines": (seeds) =>
    fillToCount("trend-lines", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      // Each context: what x and y are, and lines of fit that read sensibly.
      const ctx = pick([
        { x: "hours studied", y: "test score", yn: "test score", xu: "hour", yu: "points", m: pick([4, 5, 6, 7, 8]), b: randInt(48, 62), xs: [1, 6] },
        { x: "weeks since planting", y: "plant height in cm", yn: "plant's height", xu: "week", yu: "cm", m: pick([1.5, 2, 2.5, 3]), b: randInt(3, 12), xs: [2, 10] },
        { x: "age of a car in years", y: "price in dollars", yn: "price", xu: "year", yu: "dollars", m: -pick([1200, 1500, 1800, 2000, 2500]), b: 1000 * randInt(18, 32), xs: [1, 7] },
        { x: "outside temperature in °F", y: "cups of lemonade sold", yn: "number of cups sold", xu: "degree", yu: "cups", m: pick([2, 3, 4]), b: -randInt(80, 140), xs: [60, 95] },
      ] as const);
      const line = `y = ${lin(ctx.m, ctx.b)}`;
      const setup = `A line of fit for ${ctx.x}, x, and ${ctx.y}, y, is ${line}.`;
      if (kind === 0) {
        const x = randInt(ctx.xs[0], ctx.xs[1]);
        const y = ctx.m * x + ctx.b;
        return {
          id: "",
          type: "numeric",
          prompt: `${setup} What does the line predict when x = ${x}?${Number.isInteger(y) ? "" : " Write your answer as a decimal."}`,
          hint: `Put ${x} in for x and work out y.`,
          answer: y,
          traps: trapsFor(y, [
            trap(ctx.m * x, `Add the intercept, ${ctx.b}, after multiplying.`),
            trap(ctx.m + x + ctx.b, `${coef(ctx.m)} means ${ctx.m} times x.`),
          ]),
          explanation: `y = ${ctx.m}(${x})${plusTerm(ctx.b)} = ${fmtNum(ctx.m * x)}${plusTerm(ctx.b)} = ${fmtNum(y)}`,
        };
      }
      if (kind === 1) {
        // Working backward: which x gives this prediction?
        const x = randInt(ctx.xs[0], ctx.xs[1]);
        const y = ctx.m * x + ctx.b;
        return {
          id: "",
          type: "numeric",
          prompt: `${setup} For what value of x does the line predict y = ${usNum(y)}?`,
          hint: `Set ${lin(ctx.m, ctx.b)} equal to ${usNum(y)} and solve for x.`,
          answer: x,
          traps: trapsFor(x, [
            trap(Math.round((y / ctx.m) * 100) / 100, `${ctx.b < 0 ? "Add" : "Subtract"} the intercept before dividing by the slope.`),
            trap(ctx.m * y + ctx.b, `${usNum(y)} is the y-value. Solve for x rather than putting it in.`),
          ]),
          explanation: `${lin(ctx.m, ctx.b)} = ${usNum(y)} → ${coef(ctx.m)} = ${usNum(y - ctx.b)} → x = ${x}`,
        };
      }
      if (kind === 2) {
        // What the slope means in context.
        const up = ctx.m > 0;
        const size = usNum(Math.abs(ctx.m));
        const answer = `The ${ctx.yn} goes ${up ? "up" : "down"} about ${size} ${ctx.yu} for each extra ${ctx.xu}.`;
        const wrong = [
          `The ${ctx.yn} goes ${up ? "down" : "up"} about ${size} ${ctx.yu} for each extra ${ctx.xu}.`,
          `The ${ctx.yn} is about ${size} ${ctx.yu} when x is 0.`,
          `The ${ctx.yn} goes ${up ? "up" : "down"} about ${usNum(Math.abs(ctx.b))} ${ctx.yu} for each extra ${ctx.xu}.`,
        ];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `${setup} What does the slope, ${usNum(ctx.m)}, mean?`,
          hint: "The slope is the change in y for each 1 added to x. Its sign says whether y goes up or down.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The slope is ${up ? "positive, so y goes up" : "negative, so y goes down"} as x grows.`),
            trap(wrong[1], "The value of y when x is 0 is the intercept, not the slope."),
            trap(wrong[2], `That number is the intercept. The slope is ${usNum(ctx.m)}.`),
          ]),
          explanation: `The slope is the change in y for each 1 added to x: ${usNum(ctx.m)}. ${answer}`,
        };
      }
      if (kind === 3) {
        // A residual: actual minus predicted.
        const x = randInt(ctx.xs[0], ctx.xs[1]);
        const predicted = ctx.m * x + ctx.b;
        const step = Math.abs(ctx.m) >= 1000 ? 100 : 1;
        const res = nonZero(-8, 8) * step;
        const actual = predicted + res;
        return {
          id: "",
          type: "numeric",
          prompt: `${setup} When x = ${x}, the actual value was ${usNum(actual)}. What is the residual, actual minus predicted?`,
          hint: "Find the predicted y from the line first. Residual = actual − predicted.",
          answer: res,
          traps: trapsFor(res, [
            trap(-res, "Subtract in the order actual minus predicted: the sign tells whether the point is above or below the line."),
            trap(predicted, "That is the predicted value. Subtract it from the actual value."),
          ]),
          explanation: `predicted = ${ctx.m}(${x})${plusTerm(ctx.b)} = ${usNum(predicted)} → ${usNum(actual)} − ${usNum(predicted)} = ${usNum(res)}`,
        };
      }
      // Correlation: strength, direction, and what it cannot show.
      const variant = randInt(0, 2);
      if (variant === 0) {
        const rs = seededShuffle(pick([
          [-0.91, 0.62, 0.18, -0.45],
          [0.88, -0.35, 0.51, -0.07],
          [-0.79, 0.4, -0.55, 0.12],
          [0.95, -0.6, 0.3, -0.85],
          [-0.97, 0.9, -0.2, 0.44],
        ]));
        const strongest = rs.reduce((best, r) => (Math.abs(r) > Math.abs(best) ? r : best));
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which correlation coefficient shows the strongest linear relationship: ${listOf(rs.map((r) => `r = ${r}`))}?`,
          hint: "Strength is how close r is to 1 or −1. The sign only gives the direction.",
          answer: `r = ${strongest}`,
          choices: mcChoices(`r = ${strongest}`, rs.map((r) => `r = ${r}`)),
          traps: trapsFor(
            `r = ${strongest}`,
            rs.filter((r) => r !== strongest).map((r) => trap(`r = ${r}`, r > 0 && Math.abs(r) < Math.abs(strongest) ? "A positive r is not stronger than a negative one. Compare how far each is from 0." : "Compare how far each r is from 0: the farthest is the strongest."))
          ),
          explanation: `|${strongest}| = ${Math.abs(strongest)} is the farthest from 0, so r = ${strongest} is the strongest.`,
        };
      }
      if (variant === 1) {
        const r = Math.sign(ctx.m) * pick([0.92, 0.86, 0.89, 0.94, 0.28, 0.31, 0.15, 0.12]);
        const strong = Math.abs(r) >= 0.7;
        const answer = `A ${strong ? "strong" : "weak"} ${r > 0 ? "positive" : "negative"} linear relationship`;
        const wrong = [
          `A ${strong ? "strong" : "weak"} ${r > 0 ? "negative" : "positive"} linear relationship`,
          `A ${strong ? "weak" : "strong"} ${r > 0 ? "positive" : "negative"} linear relationship`,
          "Proof that one variable causes the other",
        ];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `The correlation coefficient between ${ctx.x} and ${ctx.y} in a data set is r = ${r}. What does it show?`,
          hint: "The sign gives the direction. Close to 1 or −1 is strong; close to 0 is weak.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The sign of r is the direction: ${r > 0 ? "positive" : "negative"}.`),
            trap(wrong[1], `|r| = ${Math.abs(r)} is ${strong ? "close to 1, so the relationship is strong" : "close to 0, so the relationship is weak"}.`),
            trap(wrong[2], "Correlation measures how well the points follow a line. A cause takes more than that to show."),
          ]),
          explanation: `r = ${r}: the sign is ${r > 0 ? "positive" : "negative"}, and |r| = ${Math.abs(r)} is ${strong ? "close to 1, so strong" : "close to 0, so weak"}.`,
        };
      }
      const pair = pick([
        { a: "ice cream sales", b: "sunburns", c: "hot, sunny weather" },
        { a: "hours of sleep", b: "test scores", c: "students who plan their week" },
        { a: "the number of firefighters at a fire", b: "the damage done", c: "the size of the fire" },
        { a: "shoe size", b: "reading level among children", c: "age" },
      ]);
      const r = pick([0.78, 0.84, 0.81, 0.9]);
      const answer = `They tend to rise together; something else, like ${pair.c}, may drive both.`;
      const wrong = [`Raising ${pair.a} will raise ${pair.b}.`, `${pair.a.charAt(0).toUpperCase()}${pair.a.slice(1)} and ${pair.b} move in opposite directions.`, "The data are too weak to show any pattern."];
      return {
        id: "",
        type: "multiple-choice",
        prompt: `In a data set, ${pair.a} and ${pair.b} have r = ${r}. Which conclusion is sound?`,
        hint: "A strong correlation shows the variables move together. Ask whether a third thing could explain both.",
        answer,
        choices: mcChoices(answer, wrong),
        traps: trapsFor(answer, [
          trap(wrong[0], "Correlation shows a pattern, not a cause. A third factor can move both."),
          trap(wrong[1], `r is positive, so they move in the same direction.`),
          trap(wrong[2], `r = ${r} is close to 1: a strong pattern.`),
        ]),
        explanation: `r = ${r} is a strong positive correlation, and a correlation alone cannot show a cause: ${pair.c} could drive both.`,
      };
    }),

  "two-way-tables": (seeds) =>
    fillToCount("two-way-tables", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      const ctx = pick([
        { g: ["9th graders", "10th graders"], q: "whether they walk to school or ride the bus", c: ["walk", "ride the bus"], ask: "walk to school" },
        { g: ["juniors", "seniors"], q: "whether they prefer morning or evening practice", c: ["prefer morning practice", "prefer evening practice"], ask: "prefer morning practice" },
        { g: ["6th graders", "7th graders"], q: "whether they picked pizza or tacos for the class party", c: ["picked pizza", "picked tacos"], ask: "picked pizza" },
        { g: ["band members", "athletes"], q: "whether they read e-books or paper books", c: ["read e-books", "read paper books"], ask: "read e-books" },
      ] as const);
      // Counts chosen so the fractions asked for reduce cleanly but not always to the same thing.
      let [a, b, c, d] = [randInt(8, 40), randInt(8, 40), randInt(8, 40), randInt(8, 40)];
      if (kind === 4) {
        // Make the raw counts and the rates disagree some of the time.
        if (randInt(0, 1) === 0) {
          a = 5 * randInt(6, 9);
          b = 5 * randInt(8, 11);
          c = 5 * randInt(3, 5);
          d = 5 * randInt(1, 3);
        }
        if (a * (c + d) === c * (a + b)) d += 1;
      }
      const T = a + b + c + d;
      const story = `A survey asked ${ctx.g[0]} and ${ctx.g[1]} ${ctx.q}. ${a} of the ${ctx.g[0]} ${ctx.c[0]} and ${b} ${ctx.c[1]}; ${c} of the ${ctx.g[1]} ${ctx.c[0]} and ${d} ${ctx.c[1]}.`;
      if (kind === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `${story} What fraction of all the students surveyed are ${ctx.g[1]} who ${ctx.c[0]}? Give it as a fraction.`,
          hint: "A joint relative frequency: one cell of the table divided by the grand total.",
          answer: c / T,
          traps: trapsFor(c / T, [
            trap(c / (c + d), `That divides by the ${ctx.g[1]} only. The question asks about all the students surveyed.`),
            trap(c / (a + c), `That divides by the students who ${ctx.c[0]}. The question asks about all the students surveyed.`),
            trap(c, "That is the count. A relative frequency divides it by the total."),
          ]),
          explanation: `total = ${a} + ${b} + ${c} + ${d} = ${T} → ${c}/${T}${frac(c, T) === `${c}/${T}` ? "" : ` = ${frac(c, T)}`}`,
        };
      }
      if (kind === 1) {
        return {
          id: "",
          type: "numeric",
          prompt: `${story} What fraction of all the students surveyed ${ctx.ask}? Give it as a fraction.`,
          hint: "A marginal relative frequency: add the column, then divide by the grand total.",
          answer: (a + c) / T,
          traps: trapsFor((a + c) / T, [
            trap(a / T, `That counts only the ${ctx.g[0]}. Add the ${ctx.g[1]} who ${ctx.c[0]} too.`),
            trap((a + c) / (a + b), `Divide by everyone surveyed, ${ctx.g[1]} included.`),
            trap(a + c, "That is the count. Divide it by the total."),
          ]),
          explanation: `${a} + ${c} = ${a + c} of ${T} → ${a + c}/${T}${frac(a + c, T) === `${a + c}/${T}` ? "" : ` = ${frac(a + c, T)}`}`,
        };
      }
      if (kind === 2) {
        return {
          id: "",
          type: "numeric",
          prompt: `${story} What fraction of the ${ctx.g[0]} ${ctx.ask}? Give it as a fraction.`,
          hint: `A conditional relative frequency: only the ${ctx.g[0]} count, so divide by their total.`,
          answer: a / (a + b),
          traps: trapsFor(a / (a + b), [
            trap(a / T, `That divides by everyone. The question is only about the ${ctx.g[0]}.`),
            trap(a / (a + c), `That divides by the students who ${ctx.c[0]}. The question asks about the ${ctx.g[0]}.`),
            trap(a / b, `Divide by all the ${ctx.g[0]}, both answers together: ${a} + ${b}.`),
          ]),
          explanation: `${ctx.g[0]}: ${a} + ${b} = ${a + b} → ${a}/${a + b}${frac(a, a + b) === `${a}/${a + b}` ? "" : ` = ${frac(a, a + b)}`}`,
        };
      }
      if (kind === 3) {
        return {
          id: "",
          type: "numeric",
          prompt: `${story} Of the students who ${ctx.ask}, what fraction are ${ctx.g[1]}? Give it as a fraction.`,
          hint: `This time the group is the students who ${ctx.ask}: divide by their total.`,
          answer: c / (a + c),
          traps: trapsFor(c / (a + c), [
            trap(c / (c + d), `That is the share of ${ctx.g[1]} who ${ctx.c[0]}. The question starts from the students who ${ctx.ask}.`),
            trap(c / T, "That divides by everyone. Only the students who give that answer count."),
          ]),
          explanation: `who ${ctx.ask}: ${a} + ${c} = ${a + c} → ${c}/${a + c}${frac(c, a + c) === `${c}/${a + c}` ? "" : ` = ${frac(c, a + c)}`}`,
        };
      }
      const r0 = a / (a + b);
      const r1 = c / (c + d);
      const answer = r0 > r1 ? `The ${ctx.g[0]}` : `The ${ctx.g[1]}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `${story} Which group has the greater share of students who ${ctx.ask}?`,
        hint: "Compare rates, not counts: divide each group's count by that group's own total.",
        answer,
        choices: mcChoices(answer, [`The ${ctx.g[0]}`, `The ${ctx.g[1]}`, "They have the same share"]),
        traps: trapsFor(answer, [
          trap(r0 > r1 ? `The ${ctx.g[1]}` : `The ${ctx.g[0]}`, "A bigger count can come from a bigger group. Compare each group's share of its own total."),
          trap("They have the same share", `Work out both: ${a}/${a + b} and ${c}/${c + d} are different.`),
        ]),
        explanation: `${ctx.g[0]}: ${a}/${a + b} ≈ ${Math.round(r0 * 100)}% → ${ctx.g[1]}: ${c}/${c + d} ≈ ${Math.round(r1 * 100)}% → ${answer.toLowerCase()} have the greater share`,
      };
    }),

  // ---- Unit 15: Modeling with Functions ----

  "literal-equations": (seeds) =>
    fillToCount("literal-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // Volume, solved for the height.
        const [l, w, h] = [randInt(3, 12), randInt(2, 9), randInt(2, 15)];
        const V = l * w * h;
        return {
          id: "",
          type: "numeric",
          prompt: `The volume of a box is V = lwh. Solve for h, then find h when V = ${V}, l = ${l} and w = ${w}.`,
          hint: "h is multiplied by both l and w, so divide both sides by lw.",
          answer: h,
          traps: trapsFor(h, [
            trap(V - l * w, "lw multiplies h. Undo multiplying by dividing, not subtracting."),
            trap(V / l, `Divide by w as well: h = V ÷ (l × w).`),
            trap(V * l * w, "Undo multiplying by dividing both sides by lw."),
          ]),
          explanation: `V = lwh → h = V/(lw) → h = ${V} ÷ (${l} × ${w}) = ${V} ÷ ${l * w} = ${h}`,
        };
      }
      if (kind === 1) {
        // Which rearrangement is right?
        const f = pick([
          { prompt: "Solve P = 2l + 2w for w.", answer: "w = (P − 2l)/2", wrong: ["w = (P + 2l)/2", "w = P − 2l", "w = 2(P − l)"], why: ["Moving 2l across the equals sign changes its sign.", "After subtracting 2l, divide by 2: the 2 still multiplies w.", "Subtract 2l first, then divide by 2."] },
          { prompt: "Solve y = mx + b for x.", answer: "x = (y − b)/m", wrong: ["x = (y + b)/m", "x = y − b − m", "x = m(y − b)"], why: ["Moving b across changes its sign.", "m multiplies x, so divide by m.", "To undo multiplying by m, divide by m."] },
          { prompt: "Solve A = (1/2)bh for h.", answer: "h = 2A/b", wrong: ["h = A/(2b)", "h = 2Ab", "h = A − b/2"], why: ["Undo the 1/2 by multiplying by 2: the 2 goes on top.", "b multiplies h, so divide by b.", "The 1/2 and b multiply h, so undo them by multiplying and dividing."] },
          { prompt: "Solve v = u + at for t.", answer: "t = (v − u)/a", wrong: ["t = (v + u)/a", "t = v − u − a", "t = a(v − u)"], why: ["Moving u across changes its sign.", "a multiplies t, so divide by a.", "To undo multiplying by a, divide by a."] },
          { prompt: "Solve ax + by = c for y.", answer: "y = (c − ax)/b", wrong: ["y = (c + ax)/b", "y = c − ax − b", "y = b(c − ax)"], why: ["Moving ax across changes its sign.", "b multiplies y, so divide by b.", "To undo multiplying by b, divide by b."] },
          { prompt: "Solve C = 5(F − 32)/9 for F.", answer: "F = 9C/5 + 32", wrong: ["F = 9C/5 − 32", "F = 5C/9 + 32", "F = 9(C + 32)/5"], why: ["Undo subtracting 32 by adding 32.", "Undo multiplying by 5/9 with its reciprocal, 9/5.", "Undo the fraction first, then add 32 on its own."] },
        ]);
        return {
          id: "",
          type: "multiple-choice",
          prompt: f.prompt,
          hint: "Treat the other letters like numbers and undo what is done to the one you want, in reverse order.",
          answer: f.answer,
          choices: mcChoices(f.answer, f.wrong),
          traps: trapsFor(f.answer, f.wrong.map((w, k) => trap(w, f.why[k]))),
          explanation: `Undo each step in reverse order: ${f.answer}.`,
        };
      }
      if (kind === 2) {
        // Fahrenheit to Celsius, by solving the formula.
        const C = 5 * randInt(-3, 9);
        const F = (9 * C) / 5 + 32;
        return {
          id: "",
          type: "numeric",
          prompt: `F = 1.8C + 32 changes Celsius to Fahrenheit. Solve it for C, then find C when F = ${F}.`,
          hint: "Subtract 32 from both sides first, then divide by 1.8.",
          answer: C,
          traps: trapsFor(C, [
            trap(Math.round(((F + 32) / 1.8) * 100) / 100, "Undo adding 32 by subtracting 32."),
            trap(Math.round((F / 1.8 - 32) * 100) / 100, "Subtract 32 before dividing by 1.8."),
            trap(F - 32, "That is 1.8C. Divide by 1.8 to finish."),
          ]),
          explanation: `C = (F − 32)/1.8 → C = (${F} − 32)/1.8 = ${F - 32}/1.8 = ${C}`,
        };
      }
      if (kind === 3) {
        // Simple interest, solved for the time.
        const P = pick([500, 800, 1000, 1200, 1500, 2000, 2500]);
        const r = pick([2, 3, 4, 5, 6]);
        const t = randInt(2, 6);
        const I = (P * r * t) / 100;
        return {
          id: "",
          type: "numeric",
          prompt: `Simple interest is I = Prt. Solve for t, then find how many years $${usNum(P)} takes to earn $${usNum(I)} at ${r}% simple interest.`,
          hint: `t = I/(Pr). Write the rate as a decimal: ${r}% = ${fmtNum(r / 100)}.`,
          answer: t,
          traps: trapsFor(t, [
            trap(I / (P * r), `Use the rate as a decimal: ${r}% is ${fmtNum(r / 100)}, not ${r}.`),
            trap(I / P, "Divide by the rate too: t = I ÷ (P × r)."),
          ]),
          explanation: `t = I/(Pr) → t = ${usNum(I)} ÷ (${usNum(P)} × ${fmtNum(r / 100)}) = ${usNum(I)} ÷ ${fmtNum((P * r) / 100)} = ${t} years`,
        };
      }
      if (kind === 4) {
        // Speed from distance and time.
        const r = pick([40, 45, 48, 50, 55, 60, 64, 70]);
        const t = pick([1.5, 2, 2.5, 3, 3.5, 4]);
        const d = r * t;
        return {
          id: "",
          type: "numeric",
          prompt: `Distance is d = rt. Solve for r, then find the average speed in miles per hour for ${fmtNum(d)} miles in ${fmtNum(t)} hours.`,
          hint: "r is multiplied by t, so divide both sides by t: r = d/t.",
          answer: r,
          traps: trapsFor(r, [
            trap(d * t, "Undo multiplying by t by dividing, not multiplying."),
            trap(Math.round((t / d) * 1000) / 1000, "That is hours per mile, upside down. Speed is distance ÷ time."),
            trap(d - t, "r is multiplied by t: divide by t."),
          ]),
          explanation: `r = d/t → r = ${fmtNum(d)} ÷ ${fmtNum(t)} = ${r} miles per hour`,
        };
      }
      // Perimeter, solved for the width.
      const l = randInt(5, 30);
      const w = randInt(2, 25);
      const P = 2 * l + 2 * w;
      return {
        id: "",
        type: "numeric",
        prompt: `A rectangle's perimeter is P = 2l + 2w. Solve for w, then find w when P = ${P} and l = ${l}.`,
        hint: "Subtract 2l from both sides, then divide by 2.",
        answer: w,
        traps: trapsFor(w, [
          trap(P - 2 * l, "That is 2w. Divide by 2 to finish."),
          trap(P / 2 + l, "Subtract the lengths: w = (P − 2l)/2."),
          trap((P - l) / 2, "Both lengths come off: subtract 2l, not l."),
        ]),
        explanation: `w = (P − 2l)/2 → w = (${P} − 2 × ${l})/2 = ${P - 2 * l}/2 = ${w}`,
      };
    }),

  "function-transformations": (seeds) =>
    fillToCount("function-transformations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      const square = randInt(0, 1) === 0;
      const parent = square ? "y = x²" : "y = |x|";
      const shape = (inside: string) => (square ? `(${inside})²` : `|${inside}|`);
      const h = nonZero(-6, 6);
      const k = nonZero(-8, 8);
      const units1 = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "unit" : "units"}`;
      const moveWords = `${h > 0 ? "right" : "left"} ${units1(h)} and ${k > 0 ? "up" : "down"} ${units1(k)}`;
      if (kind === 0) {
        const answer = `y = ${shape(shift("x", h))}${plusTerm(k)}`;
        const wrong = [`y = ${shape(shift("x", -h))}${plusTerm(k)}`, `y = ${shape(shift("x", h))}${plusTerm(-k)}`, `y = ${shape(shift("x", k))}${plusTerm(h)}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Move ${parent} ${moveWords}. Which equation is the result?`,
          hint: "A move right or left goes inside, with the opposite sign: right h is x − h. A move up or down is added at the end.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Inside, the sign is the opposite of the move: ${h > 0 ? "right" : "left"} ${Math.abs(h)} is ${shift("x", h)}.`),
            trap(wrong[1], `Up adds and down subtracts at the end: ${k > 0 ? "up" : "down"} ${Math.abs(k)} is ${plusTerm(k).trim()}.`),
            trap(wrong[2], "The left-right move goes inside the function; the up-down move goes at the end."),
          ]),
          explanation: `${h > 0 ? "right" : "left"} ${Math.abs(h)} → x becomes ${shift("x", h)} → ${k > 0 ? "up" : "down"} ${Math.abs(k)} → add ${k} → ${answer}`,
        };
      }
      if (kind === 1) {
        // The turning point after the moves.
        const askX = randInt(0, 1) === 0;
        const eq = `y = ${shape(shift("x", h))}${plusTerm(k)}`;
        return {
          id: "",
          type: "numeric",
          prompt: `${eq} is ${parent} moved. Where is its ${square ? "vertex" : "corner point"}? Type its ${askX ? "x" : "y"}-coordinate.`,
          hint: `${parent} turns at (0, 0). Read the moves from the rule: inside the ${square ? "brackets" : "bars"} is left or right, at the end is up or down.`,
          answer: askX ? h : k,
          traps: trapsFor(askX ? h : k, [
            askX ? trap(-h, `Inside, ${shift("x", h)} is zero when x = ${h}: the opposite sign of the number shown.`) : trap(-k, "The number at the end is the up-down move, sign and all."),
            askX ? trap(k, "That is the y-coordinate, the number at the end.") : trap(h, "That is the x-coordinate, from inside."),
          ]),
          explanation: `${shift("x", h)} = 0 at x = ${h}, and the rule adds ${k} → the turning point is (${h}, ${k})`,
        };
      }
      if (kind === 2) {
        // Describe a reflection and two moves.
        const answer = `Flipped over the x-axis, moved ${moveWords}`;
        const other = `${h > 0 ? "left" : "right"} ${units1(h)} and ${k > 0 ? "up" : "down"} ${units1(k)}`;
        const swapped = `${k > 0 ? "right" : "left"} ${units1(k)} and ${h > 0 ? "up" : "down"} ${units1(h)}`;
        const wrong = [`Flipped over the x-axis, moved ${other}`, `Moved ${moveWords}, the same way up as ${parent}`, `Flipped over the x-axis, moved ${swapped}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `How does y = -${shape(shift("x", h))}${plusTerm(k)} compare with ${parent}?`,
          hint: "A minus in front flips it over the x-axis. Then read the left-right move inside and the up-down move at the end.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `Inside, ${shift("x", h)} means a move ${h > 0 ? "right" : "left"}: the opposite sign of the number shown.`),
            trap(wrong[1], "The minus in front of the function turns it upside down."),
            trap(wrong[2], "The number inside moves it left or right; the number at the end moves it up or down."),
          ]),
          explanation: `-(...) flips it over the x-axis → ${shift("x", h)} inside moves it ${h > 0 ? "right" : "left"} ${Math.abs(h)} → ${plusTerm(k).trim()} moves it ${k > 0 ? "up" : "down"} ${Math.abs(k)}`,
        };
      }
      if (kind === 3) {
        // Evaluate a moved function at a point.
        const c = randInt(-5, 5);
        const f = (x: number) => (square ? x * x : Math.abs(x)) + c;
        const fRule = square ? quad(1, 0, c) : `|x|${plusTerm(c)}`;
        const s = nonZero(-4, 4);
        const t = nonZero(-6, 6);
        const x = randInt(-4, 4);
        const value = f(x + s) + t;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = ${fRule}. If g(x) = f(${shift("x", -s)})${plusTerm(t)}, find g(${x}).`,
          hint: `g(${x}) = f(${x} ${s > 0 ? "+" : "−"} ${Math.abs(s)})${plusTerm(t)}. Work out the input first, then f, then the ${t > 0 ? "addition" : "subtraction"}.`,
          answer: value,
          traps: trapsFor(value, [
            trap(f(x - s) + t, `g uses f(${shift("x", -s)}): at x = ${x} the input is ${x + s}.`),
            trap(f(x) + t, `The input to f is ${x + s}, not ${x}.`),
            trap(f(x + s), `Then ${t > 0 ? "add" : "subtract"} ${Math.abs(t)} at the end.`),
          ]),
          explanation: `g(${x}) = f(${x + s})${plusTerm(t)} → f(${x + s}) = ${f(x + s)} → ${f(x + s)}${plusTerm(t)} = ${value}`,
        };
      }
      if (kind === 4) {
        // A stretch and a move.
        const a = randInt(2, 5);
        const base = square ? "x²" : "|x|";
        const answer = `y = ${a}${base}${plusTerm(-Math.abs(k))}`;
        const wrong = [`y = ${a}${base}${plusTerm(Math.abs(k))}`, `y = ${square ? `(x − ${Math.abs(k)})²` : `|x − ${Math.abs(k)}|`}${a === 1 ? "" : ` + ${a}`}`, `y = (1/${a})${base}${plusTerm(-Math.abs(k))}`, `y = ${base}${plusTerm(a - Math.abs(k))}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which function is ${parent} stretched by a factor of ${a} and then moved down ${units1(k)}?`,
          hint: "A stretch multiplies the whole function by the factor. Down moves subtract at the end.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Down subtracts at the end."),
            trap(wrong[1], "A stretch multiplies the function, and a move down subtracts outside it."),
            trap(wrong[2], `A stretch by ${a} multiplies by ${a}; 1/${a} would squash it.`),
            trap(wrong[3], `The ${a} multiplies; it is not added.`),
          ]),
          explanation: `stretch: ${a}${base} → down ${Math.abs(k)}: ${answer}`,
        };
      }
      // Where a point lands after the moves.
      const p = randInt(-3, 3);
      const yAt = square ? p * p : Math.abs(p);
      const askY = randInt(0, 1) === 0;
      return {
        id: "",
        type: "numeric",
        prompt: `The point (${p}, ${yAt}) is on ${parent}. Where does it land on y = ${shape(shift("x", h))}${plusTerm(k)}? Type its new ${askY ? "y" : "x"}-coordinate.`,
        hint: `Every point moves ${moveWords}: add ${h} to x and ${k} to y.`,
        answer: askY ? yAt + k : p + h,
        traps: trapsFor(askY ? yAt + k : p + h, [
          askY ? trap(yAt - k, `The rule adds ${k} at the end, so every y changes by ${k}.`) : trap(p - h, `${shift("x", h)} inside moves points ${h > 0 ? "right" : "left"}: add ${h} to x.`),
          askY ? trap(yAt + h, "The left-right move changes x; y changes by the number at the end.") : trap(p + k, "The up-down move changes y; x changes by the number inside."),
        ]),
        explanation: `(${p}, ${yAt}) → x: ${p} ${h > 0 ? "+" : "−"} ${Math.abs(h)} = ${p + h} → y: ${yAt} ${k > 0 ? "+" : "−"} ${Math.abs(k)} = ${yAt + k} → (${p + h}, ${yAt + k})`,
      };
    }),

  "linear-vs-exponential": (seeds) =>
    fillToCount("linear-vs-exponential", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // A table: equal differences, equal ratios, or neither.
        const type = pick(["Linear", "Exponential", "Neither"] as const);
        const start = randInt(2, 9);
        const step = randInt(2, 6);
        const ys =
          type === "Linear"
            ? [0, 1, 2, 3].map((x) => start + step * x)
            : type === "Exponential"
              ? [0, 1, 2, 3].map((x) => start * Math.min(step, 4) ** x)
              : [0, 1, 2, 3].map((x) => start + x * x * step);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `When x is 0, 1, 2, 3, y is ${ys.join(", ")}. Is the relationship linear, exponential, or neither?`,
          hint: "Check the differences between y-values, then the ratios. Equal differences mean linear; equal ratios mean exponential.",
          answer: type,
          choices: mcChoices(type, ["Linear", "Exponential", "Neither"]),
          traps: trapsFor(type, [
            trap("Linear", "Linear needs the same difference every step. Subtract each y from the next and compare."),
            trap("Exponential", "Exponential needs the same ratio every step. Divide each y by the one before and compare."),
            trap("Neither", type === "Linear" ? "The differences are all the same, which is linear." : "The ratios are all the same, which is exponential."),
          ]),
          explanation:
            type === "Linear"
              ? `differences: ${ys.slice(1).map((y, k) => y - ys[k]).join(", ")} → all the same → linear`
              : type === "Exponential"
                ? `ratios: ${ys.slice(1).map((y, k) => fmtNum(y / ys[k])).join(", ")} → all the same → exponential`
                : `differences: ${ys.slice(1).map((y, k) => y - ys[k]).join(", ")} and ratios differ too → neither`,
        };
      }
      if (kind === 1) {
        // Continue a table past what is shown.
        const exp = randInt(0, 1) === 0;
        const start = randInt(2, 6);
        const step = exp ? randInt(2, 3) : randInt(3, 9);
        const ys = [0, 1, 2, 3].map((x) => (exp ? start * step ** x : start + step * x));
        const at = randInt(5, exp ? 6 : 12);
        const want = exp ? start * step ** at : start + step * at;
        return {
          id: "",
          type: "numeric",
          prompt: `When x is 0, 1, 2, 3, y is ${ys.join(", ")}. If the pattern continues, what is y when x = ${at}?`,
          hint: "Decide first: the same difference (add) or the same ratio (multiply). Then continue to x = " + at + ".",
          answer: want,
          traps: trapsFor(want, [
            exp ? trap(ys[3] + (ys[3] - ys[2]) * (at - 3), "The differences grow, so the table multiplies: check the ratios.") : trap(Math.round(ys[3] * (ys[3] / ys[2]) ** (at - 3)), "The differences are equal, so the table adds the same amount each step."),
            exp ? trap(start * step * at, `It multiplies by ${step} once per step: ${step}^${at}, not ${step} × ${at}.`) : trap(start * at, `Start at ${start} and add ${step} for each step.`),
          ]),
          explanation: exp ? `ratio ${step} → y = ${start} × ${step}^${at} = ${usNum(want)}` : `difference ${step} → y = ${start} + ${step} × ${at} = ${want}`,
        };
      }
      if (kind === 2) {
        // Which story is exponential (or linear)?
        const wantExp = randInt(0, 1) === 0;
        const linear = seededShuffle([
          "A phone plan adds $15 to the bill each month.",
          "A pool fills by 40 gallons every minute.",
          "A taxi fare rises $2 for every mile.",
          "A candle burns down 3 cm every hour.",
          "A savings jar gets $10 every week.",
        ]);
        const expo = seededShuffle([
          "A town's population grows 4% each year.",
          "A colony of bacteria doubles every hour.",
          "A car loses 15% of its value each year.",
          "A video's views triple every day.",
          "A medicine's amount halves every 6 hours.",
        ]);
        const answer = wantExp ? expo[0] : linear[0];
        const wrong = wantExp ? linear.slice(0, 3) : expo.slice(0, 3);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which situation is modeled by ${wantExp ? "an exponential" : "a linear"} function?`,
          hint: "Linear changes by the same amount each step. Exponential changes by the same factor, or the same percent, each step.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, wrong.map((w) => trap(w, wantExp ? "That changes by the same amount each step, which is linear." : "That changes by the same percent or factor each step, which is exponential."))),
          explanation: `${answer} ${wantExp ? "It changes by the same factor each step." : "It changes by the same amount each step."}`,
        };
      }
      if (kind === 3) {
        // When does doubling pass a steady amount?
        const daily = pick([50, 100, 200, 300, 500, 1000]);
        let day = 1;
        while (2 ** (day - 1) <= daily) day += 1;
        return {
          id: "",
          type: "numeric",
          prompt: `Job A pays $${usNum(daily)} a day. Job B pays $1 on day 1 and doubles its pay each day. On which day does Job B first pay more than Job A?`,
          hint: "Job B pays 2^(n − 1) dollars on day n. Keep doubling until it passes Job A.",
          answer: day,
          traps: trapsFor(day, [
            trap(day - 1, `On day ${day - 1} Job B pays $${usNum(2 ** (day - 2))}, which is still not more.`),
            trap(Math.ceil(Math.log2(daily)), "Count day 1 as $1, day 2 as $2, and so on: day n pays 2^(n − 1)."),
            trap(daily, "Job B is not adding a dollar a day; it doubles."),
          ]),
          explanation: `day ${day - 1}: $${usNum(2 ** (day - 2))} (not more than $${usNum(daily)}) → day ${day}: $${usNum(2 ** (day - 1))} (more)`,
        };
      }
      if (kind === 4) {
        // The same two points, two models.
        const start = 2 * randInt(1, 3);
        const r = randInt(2, 4);
        const y2 = start * r * r;
        const exp = randInt(0, 1) === 0;
        const want = exp ? start * r ** 3 : start + ((y2 - start) / 2) * 3;
        return {
          id: "",
          type: "numeric",
          prompt: `y is ${start} when x = 0 and ${y2} when x = 2. If y grows ${exp ? "exponentially" : "linearly"}, what is y when x = 3?`,
          hint: exp ? `Exponential: two steps multiply by ${y2 / start} in all, so each step multiplies by its square root.` : `Linear: two steps add ${y2 - start} in all, so each step adds half of that.`,
          answer: want,
          traps: trapsFor(want, [
            exp ? trap(start + ((y2 - start) / 2) * 3, "That treats it as linear. Exponential growth multiplies by the same factor each step.") : trap(start * r ** 3, "That treats it as exponential. Linear growth adds the same amount each step."),
            exp ? trap(y2 * (y2 / start), `The factor ${y2 / start} covers two steps. One step multiplies by ${r}.`) : trap(y2 + (y2 - start), `${y2 - start} is the change over two steps. One step adds ${(y2 - start) / 2}.`),
          ]),
          explanation: exp ? `factor per step: √(${y2} ÷ ${start}) = ${r} → y(3) = ${start} × ${r}³ = ${want}` : `change per step: (${y2} − ${start}) ÷ 2 = ${(y2 - start) / 2} → y(3) = ${start} + 3 × ${(y2 - start) / 2} = ${want}`,
        };
      }
      // A steady gain against a percent gain.
      const P = 1000 * randInt(8, 20);
      const pct = pick([4, 5, 6, 8, 10]);
      const add = Math.round((P * pct) / 100);
      // Same first-year gain; compounding pulls ahead after that.
      const years = randInt(3, 5);
      const num = P * (100 + pct) ** years;
      const den = 100 ** years;
      const townB = Math.floor((2 * num + den) / (2 * den));
      const townA = P + add * years;
      return {
        id: "",
        type: "numeric",
        prompt: `Two towns each have ${usNum(P)} people. Town A gains ${usNum(add)} people a year. Town B grows ${pct}% a year. How many more people does Town B have after ${years} years? (round to the nearest whole number)`,
        hint: `Town A is linear: ${usNum(P)} + ${usNum(add)}t. Town B is exponential: ${usNum(P)} × (1.${pct < 10 ? `0${pct}` : pct})^t. Work out both at t = ${years}.`,
        answer: townB - townA,
        decimalPlaces: 0,
        traps: trapsFor(townB - townA, [
          trap(0, `Both gain ${usNum(add)} in the first year, but Town B's ${pct}% is then taken of a bigger number each year.`),
          trap(townB, "That is Town B's population. Subtract Town A's."),
          trap(townA, "That is Town A's population. The question asks for the difference."),
        ]),
        explanation: `A: ${usNum(P)} + ${usNum(add)} × ${years} = ${usNum(townA)} → B: ${usNum(P)} × ${fmtNum((100 + pct) / 100)}^${years} ≈ ${usNum(townB)} → ${usNum(townB)} − ${usNum(townA)} = ${townB - townA}`,
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
