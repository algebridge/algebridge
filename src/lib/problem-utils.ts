import type { PracticeProblem } from "@/types";

export const PROBLEMS_PER_SKILL = 50;

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

let generationRng: () => number = Math.random;

export function randInt(min: number, max: number): number {
  return Math.floor(generationRng() * (max - min + 1)) + min;
}

export function withSeededGeneration<T>(seed: number, fn: () => T): T {
  const previous = generationRng;
  generationRng = createSeededRng(seed);
  try {
    return fn();
  } finally {
    generationRng = previous;
  }
}

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "ˣ": "x" };

/**
 * A prompt reduced to what a student sees as "the same card": powers written
 * with carets, one kind of minus, spaces collapsed, and no variant tags. A
 * hand-written "5⁰" and a generated "5^0" were both served in the same bank,
 * as were "(x³)²" and "(x^3)^2", because the old check compared raw text.
 */
export function canonicalPrompt(prompt: string): string {
  return String(prompt ?? "")
    .replace(/\s*\((?:Set|Review|Variant) \d+\)\s*$/i, "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ˣ]+/g, (m) => `^${[...m].map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch).join("")}`)
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function uniqueByPrompt(problems: PracticeProblem[]): PracticeProblem[] {
  const seen = new Set<string>();
  return problems.filter((problem) => {
    const key = canonicalPrompt(problem.prompt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function makeId(skillId: string, index: number): string {
  return `${skillId}-p${index}`;
}

/** "3", " 3" and "−3" vs "-3": the same answer written differently counts once. */
function choiceKey(choice: string): string {
  return choice.replace(/\s+/g, "").replace(/−/g, "-").toLowerCase();
}

/** Writes a number the way the answer is written: same minus sign, same decimals. */
function numberLike(model: string, value: number): string {
  const decimals = (model.split(".")[1] ?? "").length;
  const text = decimals ? value.toFixed(decimals) : String(Math.round(value));
  return model.includes("−") ? text.replace("-", "−") : text;
}

const NUMERIC = /^[−-]?\d+(\.\d+)?$/;

/**
 * Choices with no repeats. A wrong answer that happens to equal the right one
 * (the y-intercept of y = 3x − 3 is −3, and "3" was offered as a wrong answer
 * twice) or another wrong one is dropped, and when the answer is a plain
 * number the card is filled back up with nearby wrong numbers, so a student
 * never sees the same answer twice on one card.
 */
export function dedupeChoices(choices: string[], correct: string): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  const correctKey = choiceKey(correct);
  for (const c of choices) {
    const k = choiceKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    // The answer's own spelling wins: a distractor "-3" sitting ahead of the
    // key "−3" must never be the one that stays, or the right pick grades wrong.
    kept.push(k === correctKey ? correct : c);
  }
  if (!seen.has(choiceKey(correct))) {
    kept.unshift(correct);
    seen.add(choiceKey(correct));
  }
  const model = correct.trim();
  if (kept.length < 4 && NUMERIC.test(model)) {
    const n = Number(model.replace("−", "-"));
    const step = Number.isInteger(n) ? 1 : Math.pow(10, -((model.split(".")[1] ?? "").length));
    for (const cand of [n + step, n - step, n + 2 * step, n - 2 * step, -n, 2 * n, n + 3 * step, n - 3 * step, n + 5 * step, n + 10 * step]) {
      if (kept.length >= 4) break;
      const text = numberLike(model, cand);
      const k = choiceKey(text);
      if (seen.has(k)) continue;
      seen.add(k);
      kept.push(text);
    }
  }
  return kept;
}

export function mcChoices(correct: string, distractors: string[]): string[] {
  return shuffleArray(dedupeChoices([correct, ...distractors], correct).slice(0, 4), generationRng);
}

/** Shuffles with the seeded generator, so a bank rebuilt from its seed comes out the same. */
export function seededShuffle<T>(items: T[]): T[] {
  return shuffleArray(items, generationRng);
}

/** A problem with its answer choices made unique (multiple choice only; anything else passes through). */
export function withUniqueChoices(problem: PracticeProblem): PracticeProblem {
  if (problem.type !== "multiple-choice" || !problem.choices) return problem;
  const correct = String(problem.answer ?? "");
  const choices = dedupeChoices(problem.choices, correct);
  if (choices.length === problem.choices.length && choices.every((c, i) => c === problem.choices![i])) return problem;
  return { ...problem, choices };
}

export function fillToCount(
  skillId: string,
  problems: PracticeProblem[],
  count: number,
  factory: (index: number) => PracticeProblem
): PracticeProblem[] {
  const bank = uniqueByPrompt(problems);
  const seen = new Set(bank.map((p) => canonicalPrompt(p.prompt)));
  // The factory is called with 0, 1, 2, ... in turn. It used to be called with
  // bank.length + attempt, which jumped by two for every problem kept, so a
  // generator choosing its template by i % 2 or i % 4 only ever saw half of
  // them: some skills served one kind of question and never the other.
  const maxAttempts = count * 40;
  for (let attempt = 0; bank.length < count && attempt < maxAttempts; attempt += 1) {
    const made = factory(attempt);
    const key = canonicalPrompt(made.prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push({ ...made, id: makeId(skillId, bank.length) });
  }
  // A skill with fewer distinct problems than `count` ends its bank early.
  // It used to be padded with copies carrying a hidden "(Set 5)" tag, which a
  // student saw as the same card twice.
  return bank;
}

/* ── Writing math the way a textbook does ──────────────────────────────────
   Generators used to build equations by pasting numbers into templates,
   which printed "y = -1x + 0", "y = -2x + -1" and "y = 3x − -1" to students
   (1,800 of them across the course). These build each term with its sign
   and its coefficient right, and drop what should not be there. A negative
   number on its own keeps the hyphen ("-3"), as the rest of the course
   writes it; subtraction between terms is the real minus sign ("−"). */

/** A coefficient on a variable: 3 → "3x", 1 → "x", -1 → "-x", 0 → "". */
export function coef(m: number, v = "x"): string {
  if (m === 0) return "";
  if (m === 1) return v;
  if (m === -1) return `-${v}`;
  return `${fmtNum(m)}${v}`;
}

/** A term appended to an expression, with its operator: 3 → " + 3", -3 → " − 3", 0 → "". */
export function plusTerm(b: number, v = ""): string {
  if (b === 0) return "";
  const size = Math.abs(b);
  const body = v ? (size === 1 ? v : `${fmtNum(size)}${v}`) : fmtNum(size);
  return b > 0 ? ` + ${body}` : ` − ${body}`;
}

/** mx + b, with every sign right: (2, -3) → "2x − 3", (-1, 0) → "-x", (0, 5) → "5", (0, 0) → "0". */
export function lin(m: number, b: number, v = "x"): string {
  if (m === 0) return fmtNum(b);
  return `${coef(m, v)}${plusTerm(b)}`;
}

/** ax + by, for standard form: (4, -1) → "4x − y", (-3, 1) → "-3x + y". */
export function twoVar(a: number, b: number, x = "x", y = "y"): string {
  if (a === 0) return coef(b, y);
  return `${coef(a, x)}${plusTerm(b, y)}`;
}

/** ax² + bx + c: (1, 0, -64) → "x² − 64", (-1, 5, 0) → "-x² + 5x". */
export function quad(a: number, b: number, c: number, v = "x"): string {
  const lead = a === 0 ? "" : coef(a, `${v}²`);
  if (!lead) return lin(b, c, v);
  return `${lead}${plusTerm(b, v)}${plusTerm(c)}`;
}

/** A number as a student writes it: whole, or at most four decimal places, never "0.30000000000000004". */
export function fmtNum(x: number): string {
  if (Number.isInteger(x)) return String(x);
  return String(Math.round(x * 10000) / 10000);
}

function gcdOf(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** An exact fraction, reduced, sign in front: (2, 3) → "2/3", (4, 2) → "2", (1, -11) → "-1/11". */
export function frac(n: number, d: number): string {
  if (d === 0) return "undefined";
  const sign = n * d < 0 ? "-" : "";
  const g = gcdOf(n, d);
  const top = Math.abs(n) / g;
  const bottom = Math.abs(d) / g;
  return bottom === 1 ? `${sign}${top}` : `${sign}${top}/${bottom}`;
}

/** A decimal as the simple fraction it is, when there is one: 0.125 → "1/8", -0.666... → "-2/3". */
export function fractionText(x: number): string | null {
  if (!Number.isFinite(x) || Number.isInteger(x)) return null;
  for (let d = 2; d <= 1000; d += 1) {
    const n = Math.round(x * d);
    if (Math.abs(x * d - n) < 1e-7) return frac(n, d);
  }
  return null;
}
