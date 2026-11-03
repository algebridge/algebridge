/**
 * Where a wrong answer went wrong.
 *
 * A student who types 19 for x + 7 = 12 did something specific: they added
 * the 7 instead of taking it away. "Try again" tells them nothing they can
 * use. This reads the answer they gave against the key and the numbers in
 * the question, and names the slip when it fits a pattern: the sign, an
 * upside-down fraction, a number moved the wrong way, a factor multiplied
 * where it should have divided, a decimal point off by a place, one end of
 * an inequality, a step in the wrong spot. A generator can also name its own
 * traps (the classic wrong answer for its shape, and why it comes up), and
 * those are checked first.
 *
 * Every note here is written to be shown while the student can still try
 * again: none of them says the answer.
 */

import type { PracticeProblem, Trap } from "@/types";
import { numericAnswerMatches, parseNumericAnswer } from "@/lib/grading";
import { fractionText } from "@/lib/problem-utils";
import { stripVariantTag } from "@/lib/personalize";

export type MistakeKind =
  | "trap"
  | "sign"
  | "reciprocal"
  | "tens"
  | "offby"
  | "factor"
  | "square"
  | "close"
  | "combo"
  | "flip"
  | "boundary"
  | "half"
  | "step"
  | "order"
  | "unread"
  | "none";

export interface Diagnosis {
  kind: MistakeKind;
  /** What the answer shows, in the student's own numbers. Empty when no pattern fits. */
  note: string;
  /** What to do about it. */
  fix?: string;
  /** The step of the worked answer (explanationSteps) where this slip happens, when known. */
  step?: number;
}

/** What the student did on the card. */
export interface Attempt {
  /** What was typed or picked. */
  given: string;
  /** On an error-analysis card, the step that was picked. */
  step?: number | null;
  /** On a step-order card, the order the steps were left in. */
  order?: number[];
}

const NONE: Diagnosis = { kind: "none", note: "" };

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** A number the way a student would read it back: 4, -3, 2/3, 1.25. */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return fractionText(n) ?? String(Math.round(n * 10000) / 10000);
}

function placeName(places: number): string {
  return ["the nearest whole number", "the tenths place", "the hundredths place", "the thousandths place"][places] ?? `${places} decimal places`;
}

/**
 * The numbers a question is built from, each once, zero left out. "Convert
 * 2.5 hours to seconds" gives [2.5]; "Solve 3x − 4 = 11" gives [3, 4, 11]. A
 * digit after a caret is an exponent, not a number of its own.
 */
export function promptNumbers(prompt: string): number[] {
  const text = stripVariantTag(prompt).replace(/[−–]/g, "-");
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\w.^])-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.^])-?\d+(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n) && n !== 0 && !out.some((v) => near(v, n))) out.push(n);
  }
  return out;
}

/**
 * A unit fact the question hands over, "(1 L = 1,000 mL)" or "(1 mile =
 * 5,280 ft)": a conversion to use, not an equation to solve, and its numbers
 * are factors to multiply or divide by, never amounts to add or take away.
 */
const UNIT_FACT = /\(\s*[\d.,]+\s*[a-z][a-z. ]*=\s*[\d.,]+\s*[a-z][a-z. ]*\)/gi;

/** Skills whose cards are equations to solve, even when a card does not say "solve". */
const EQUATION_SKILL = /^(?:one-step|two-step|multi-step)-equations|^literal-equations|^equations-with-fractions/;

/**
 * Adding or taking away, in the question or in its worked answer: "x + 7",
 * "45 − 12", "plus a $10 fee", "how many are left". A hyphen counts only with
 * a space on each side, so "500-milliliter" and "-16t²" do not.
 */
const ADDS =
  /[\w)\]²³|%]\s*[+−]\s*[\w(\[√|$.]|\s-\s|\b(?:plus|minus|sum|difference|more than|less than|fewer|add|added|adding|subtract|subtracted|subtracting|left|remain|remains|remaining)\b/i;

/** A square or a square root, in the question or in its worked answer, or a distance, which the Pythagorean theorem squares. */
const SQUARES = /[²√]|\^\s*\(?\s*2(?![\d.])|\^\s*\(\s*1\s*\/\s*2\s*\)|\bsquared?\b|\broots?\b|\bdistance\b|\bfar apart\b|hypotenuse|pythag/i;

/** What the question says, and how the worked answer gets there, for checking which moves this problem has in it. */
function problemText(problem: PracticeProblem): string {
  return `${stripVariantTag(problem.prompt)} ${problem.explanation ?? ""}`;
}

/** 4 → "4", 27878400 → "27,878,400": the way the cards write a big number. */
function grouped(n: number): string {
  return Number.isInteger(n) && Math.abs(n) >= 10000 ? n.toLocaleString("en-US") : fmt(n);
}

/** How big an answer is next to the key, when it is n times too big: "twice the size". */
function timesTheSize(n: number): string {
  if (near(n, 2)) return "twice the size";
  if (near(n, 3)) return "three times the size";
  return `${grouped(n)} times the size`;
}

/** How big an answer is next to the key, when it is 1/n of it: "half the size", "1/12 the size". */
function partOfTheSize(n: number): string {
  if (near(n, 2)) return "half the size";
  if (near(n, 3)) return "a third of the size";
  if (near(n, 4)) return "a quarter of the size";
  if (Number.isInteger(n)) return `1/${grouped(n)} the size`;
  return `${fractionText(1 / n) ?? `1/${fmt(n)}`} the size`;
}

function matchTrap(traps: Trap[] | undefined, given: string, value: number | null, decimalPlaces?: number): Diagnosis | null {
  for (const t of traps ?? []) {
    if (typeof t.value === "number") {
      if (value !== null && (near(value, t.value) || numericAnswerMatches(t.value, given, decimalPlaces))) {
        return { kind: "trap", note: t.why, step: t.step };
      }
      continue;
    }
    if (norm(t.value) === norm(given)) return { kind: "trap", note: t.why, step: t.step };
    if (value !== null) {
      const tv = parseNumericAnswer(t.value);
      if (tv !== null && near(tv, value)) return { kind: "trap", note: t.why, step: t.step };
    }
  }
  return null;
}

/** Magnitudes of the question's numbers, largest first, each once. */
function magnitudes(nums: number[]): number[] {
  const out: number[] = [];
  for (const n of nums.map(Math.abs).sort((a, b) => b - a)) if (!out.some((v) => near(v, n))) out.push(n);
  return out;
}

function diagnoseNumeric(problem: PracticeProblem, given: string): Diagnosis {
  const value = parseNumericAnswer(given);
  const trap = matchTrap(problem.traps, given, value, problem.decimalPlaces);
  if (trap) return trap;
  if (value === null) {
    return {
      kind: "unread",
      note: `“${given.trim()}” could not be read as a number.`,
      fix: "Type just the number. A fraction like 2/3, a decimal, or a negative like -4 all work.",
    };
  }
  const ans = Number(problem.answer);
  if (!Number.isFinite(ans)) return NONE;
  const prompt = stripVariantTag(problem.prompt);
  const ownWords = prompt.replace(UNIT_FACT, " ");
  // The amounts in the question, then the factors its unit facts hand over:
  // "(1 L = 1,000 mL)" brings the 1,000, and its 1 is no amount at all.
  const amounts = promptNumbers(ownWords);
  const conversions = promptNumbers((prompt.match(UNIT_FACT) ?? []).join(" ")).filter((n) => !near(Math.abs(n), 1));
  const nums = [...amounts, ...conversions.filter((n) => !amounts.some((m) => near(m, n)))];
  // An equation to solve: the card says so, or it comes from a skill of
  // equations. A unit fact's "=" is no equation.
  const equation = /\bsolve\b/i.test(ownWords) || EQUATION_SKILL.test(problem.id ?? "");
  // A slip has to be a move the problem has in it. Landing exactly 12 from
  // the key is a 12 added or dropped only where something is added or taken
  // away; on a card that only multiplies and divides it is chance.
  const additive = ADDS.test(`${ownWords} ${problem.explanation ?? ""}`);
  const squares = SQUARES.test(problemText(problem));

  if (ans !== 0 && near(value, -ans)) {
    return { kind: "sign", note: "Right size, wrong sign.", fix: "Follow the minus sign through each step: it decides which side of zero the answer lands on." };
  }
  if (ans !== 0 && value !== 0 && !near(Math.abs(ans), 1) && near(value * ans, 1)) {
    return { kind: "reciprocal", note: "That is the answer turned upside down: the top and the bottom traded places.", fix: "Check which number belongs on top." };
  }
  for (const k of [1, 2, 3]) {
    const places = `${k} place${k > 1 ? "s" : ""}`;
    if (ans !== 0 && near(value, ans * 10 ** k)) {
      return { kind: "tens", note: `The digits are right and the decimal point sits ${places} too far to the right.`, fix: "Count the zeros once more." };
    }
    if (ans !== 0 && near(value, ans / 10 ** k)) {
      return { kind: "tens", note: `The digits are right and the decimal point sits ${places} too far to the left.`, fix: "Count the zeros once more." };
    }
  }
  const diff = value - ans;
  if (additive) {
    // Off by the number itself: it never came in, or came in twice.
    for (const n of magnitudes(amounts)) {
      if (n >= 1 && near(Math.abs(diff), n)) {
        return {
          kind: "offby",
          note: `Your answer is exactly ${fmt(n)} ${diff > 0 ? "more" : "less"} than it should be.`,
          fix: `Check the step where ${fmt(n)} comes in.`,
        };
      }
    }
    // Off by twice the number: it went the wrong way. Undoing "+ 7" by adding 7
    // again lands 14 from the mark, on the far side of it.
    for (const n of magnitudes(amounts)) {
      if (n >= 1 && near(Math.abs(diff), 2 * n)) {
        return {
          kind: "offby",
          note: `Your answer is ${fmt(2 * n)} off, twice the ${fmt(n)} in the question. That is what happens when ${fmt(n)} goes the wrong way: added where it should be subtracted, or the reverse.`,
          fix: equation ? `To undo adding ${fmt(n)}, subtract it from both sides; to undo subtracting ${fmt(n)}, add it.` : undefined,
        };
      }
    }
  }
  const sameSide = Math.sign(value) === Math.sign(ans);
  // Doubling and halving are slips of their own, so 2 is tried on every card;
  // any other factor has to be one of the question's numbers. A step is named
  // ("the step with 12 in it") only by a number the question has in it.
  const own = magnitudes(nums).filter((n) => n >= 2);
  const factors = [...own, 2].filter((n, i, arr) => arr.findIndex((m) => near(m, n)) === i);
  for (const n of factors) {
    const fix = own.some((m) => near(m, n))
      ? `Look at the step with ${fmt(n)} in it: multiplying by it and dividing by it are the two ways that step can go.`
      : undefined;
    if (ans !== 0 && sameSide && near(Math.abs(value), Math.abs(ans) * n)) {
      return { kind: "factor", note: `Your answer is ${timesTheSize(n)} it should be.`, fix };
    }
    if (value !== 0 && sameSide && near(Math.abs(value) * n, Math.abs(ans))) {
      return { kind: "factor", note: `Your answer is ${partOfTheSize(n)} it should be.`, fix };
    }
  }
  // Off by the number squared: multiplied where it should have divided, which
  // swaps ÷n for ×n, a factor of n twice over. Only for the question's own
  // numbers: a 2 that is not in it was never multiplied or divided by.
  for (const n of own) {
    if (ans !== 0 && sameSide && near(Math.abs(value), Math.abs(ans) * n * n)) {
      return {
        kind: "factor",
        note: `Your answer is ${fmt(n)} times ${fmt(n)} the size it should be, which is what multiplying by ${fmt(n)} instead of dividing by it does.`,
        fix: equation ? `${fmt(n)}x means ${fmt(n)} times x, so it is undone by dividing both sides by ${fmt(n)}.` : `Where ${fmt(n)} comes in, divide instead of multiplying.`,
      };
    }
    if (value !== 0 && sameSide && near(Math.abs(value) * n * n, Math.abs(ans))) {
      return {
        kind: "factor",
        note: `Your answer is ${partOfTheSize(n * n)} it should be, which is what dividing by ${fmt(n)} instead of multiplying by it does.`,
        fix: `Where ${fmt(n)} comes in, multiply instead of dividing.`,
      };
    }
  }
  // Squared or rooted: only where the problem squares or takes a root.
  if (squares && Math.abs(ans) > 1 && near(value, ans * ans)) {
    return { kind: "square", note: "That is the answer squared.", fix: "One squaring too many: check whether the last step is a square or a square root." };
  }
  if (squares && value > 0 && Math.abs(ans) > 1 && near(value * value, ans)) {
    return { kind: "square", note: "That is the square root of the answer.", fix: "Check whether the last step is a square root or a square." };
  }
  const rel = Math.abs(diff) / Math.max(1, Math.abs(ans));
  if (rel < 0.02) {
    // Rounding advice only where there is rounding: a whole-number key typed
    // as a whole number was not rounded on the way.
    const whole = Number.isInteger(ans) && Number.isInteger(value);
    return {
      kind: "close",
      note: "Close, but not exact.",
      fix:
        typeof problem.decimalPlaces === "number"
          ? `Keep every digit until the last step, then round once, to ${placeName(problem.decimalPlaces)}.`
          : whole
            ? "Redo the arithmetic one step at a time: one of the steps is a little off."
            : "Keep exact values until the last step, then round once, to the place the question asks for.",
    };
  }
  const isOne = (n: number) => near(Math.abs(n), 1);
  const factorOnly = (n: number) => !amounts.some((m) => near(m, n));
  for (let i = 0; i < nums.length; i += 1) {
    for (let j = i + 1; j < nums.length; j += 1) {
      const a = nums[i];
      const b = nums[j];
      // Only steps someone could take: a unit fact's factor is multiplied or
      // divided by, never added; times 1 or over 1 changes nothing; and on a
      // card with no adding in it, a 1 ("in 1 hour") is not added either.
      const adds = !factorOnly(a) && !factorOnly(b) && (additive || (!isOne(a) && !isOne(b)));
      const tries: [number, string][] = [];
      if (adds) tries.push([a + b, `${fmt(a)} + ${fmt(b)}`], [a - b, `${fmt(a)} − ${fmt(b)}`], [b - a, `${fmt(b)} − ${fmt(a)}`]);
      if (!isOne(a) && !isOne(b)) tries.push([a * b, `${fmt(a)} × ${fmt(b)}`]);
      if (!isOne(b)) tries.push([a / b, `${fmt(a)} ÷ ${fmt(b)}`]);
      if (!isOne(a)) tries.push([b / a, `${fmt(b)} ÷ ${fmt(a)}`]);
      for (const [r, text] of tries) {
        if (near(value, r)) return { kind: "combo", note: `${text} = ${fmt(value)} is a step, and not the one this question needs.` };
      }
    }
  }
  return NONE;
}

const SIMPLE = /^x ?([<>≤≥]) ?(-?\d+(?:\.\d+)?)$/;
const BETWEEN = /^(-?\d+(?:\.\d+)?) ?([<≤]) ?x ?([<≤]) ?(-?\d+(?:\.\d+)?)$/;
const EITHER = /^x ?[<≤] ?(-?\d+(?:\.\d+)?) or x ?[>≥] ?(-?\d+(?:\.\d+)?)$/;

function direction(sym: string): "less" | "greater" {
  return sym === "<" || sym === "≤" ? "less" : "greater";
}

/** Two inequalities, the one picked and the right one, compared end for end. */
function compareInequalities(given: string, answer: string): Diagnosis | null {
  const g = norm(given);
  const a = norm(answer);
  const gs = g.match(SIMPLE);
  const as = a.match(SIMPLE);
  const gb = g.match(BETWEEN);
  const ab = a.match(BETWEEN);
  const ge = g.match(EITHER);
  const ae = a.match(EITHER);
  if (gs && as) {
    const gDir = direction(gs[1]);
    const aDir = direction(as[1]);
    const gB = Number(gs[2]);
    const aB = Number(as[2]);
    if (near(gB, aB) && gDir !== aDir) {
      return {
        kind: "flip",
        note: "Right boundary, opposite direction.",
        fix: "The sign flips only when both sides are multiplied or divided by a negative number. Check whether that happened here.",
      };
    }
    if (near(gB, aB)) {
      return { kind: "boundary", note: "Right boundary and direction. The difference is whether the boundary itself counts.", fix: "≤ and ≥ include the boundary; < and > leave it out." };
    }
    if (aB !== 0 && near(gB, -aB) && gDir === aDir) {
      return { kind: "boundary", note: "Right direction, and the boundary has the wrong sign.", fix: "Check the sign of what you divided by, and of the number you moved across." };
    }
    if (aB !== 0 && near(gB, -aB)) {
      return { kind: "flip", note: "The direction and the boundary's sign are both the other way.", fix: "Dividing by a negative flips the inequality, and the boundary is the right side divided by that negative." };
    }
    return null;
  }
  if (ab && gs) return { kind: "half", note: "That keeps one end. This answer has two ends.", fix: "Solve for both ends and keep them together: low < x < high." };
  if (ab && gb) {
    if (near(Number(gb[1]), Number(ab[1])) && near(Number(gb[4]), Number(ab[4]))) {
      return { kind: "boundary", note: "Right ends. The difference is whether the ends themselves count.", fix: "≤ includes the end; < leaves it out. Inclusive means ≤." };
    }
    return { kind: "boundary", note: "The ends are off.", fix: "Whatever is done to the middle is done to both ends." };
  }
  if (ae && gb) return { kind: "half", note: "That is the between case. This answer keeps what lies outside: two rays, joined by or.", fix: "Solve each part on its own, then keep both." };
  if (ab && ge) return { kind: "half", note: "That is the outside case, two rays. This answer is between: one stretch with both ends.", fix: "Both conditions have to hold at once, so the answer is where they overlap." };
  if (ae && gs) return { kind: "half", note: "That is one of the two rays. Or keeps both.", fix: "Solve each inequality on its own and keep both answers." };
  return null;
}

const PLAIN_NUMBER = /^[−-]?[\d.,]+(?: ?\/ ?[−-]?\d+)?$/;

function diagnoseChoice(problem: PracticeProblem, given: string): Diagnosis {
  const value = parseNumericAnswer(given);
  const trap = matchTrap(problem.traps, given, value, problem.decimalPlaces);
  if (trap) return trap;
  const answer = String(problem.answer ?? "");
  const ansValue = parseNumericAnswer(answer);
  if (value !== null && ansValue !== null && PLAIN_NUMBER.test(given.trim()) && PLAIN_NUMBER.test(answer.trim())) {
    // Two plain numbers: the same slips as a typed answer.
    return diagnoseNumeric({ ...problem, type: "numeric", answer: ansValue, traps: [] }, given);
  }
  return compareInequalities(given, answer) ?? NONE;
}

function diagnoseStepPick(problem: PracticeProblem, picked: number | null): Diagnosis {
  if (picked === null || picked === problem.wrongStepIndex) return NONE;
  return {
    kind: "step",
    note: picked === 0 ? "Step 1 is right: it is the starting point." : `Step ${picked + 1} is right: it follows from the line above it.`,
    fix: "Check each line against the one above it. Which one changes something it should not?",
  };
}

function diagnoseOrder(problem: PracticeProblem, order: number[]): Diagnosis {
  const correct = problem.correctOrder ?? [];
  const at = order.findIndex((s, i) => s !== correct[i]);
  if (at < 0) return NONE;
  if (at === 0) {
    return { kind: "order", note: "The first step is not the one to start with.", fix: "Whatever was done last to build the expression is undone first." };
  }
  return {
    kind: "order",
    note: `The first ${at === 1 ? "step is" : `${at} steps are`} in the right place. The order goes wrong at step ${at + 1}.`,
    fix: "Each step has to use what the step before it produced.",
  };
}

/** What a wrong attempt shows about where it went wrong. */
export function diagnoseMistake(problem: PracticeProblem, attempt: Attempt): Diagnosis {
  switch (problem.type) {
    case "numeric":
      return diagnoseNumeric(problem, attempt.given ?? "");
    case "multiple-choice":
      return diagnoseChoice(problem, attempt.given ?? "");
    case "error-analysis":
      return diagnoseStepPick(problem, attempt.step ?? null);
    case "step-order":
      return diagnoseOrder(problem, attempt.order ?? []);
    default:
      return NONE;
  }
}

/**
 * The worked answer as steps. Generators write "3x + 4 = 19 → 3x = 15 →
 * x = 5"; each arrow is a line of working. A sentence with no arrows is one
 * step.
 */
export function explanationSteps(explanation: string): string[] {
  return String(explanation ?? "")
    .split(/\s*→\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
