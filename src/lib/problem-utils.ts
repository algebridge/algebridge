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

export function uniqueByPrompt(problems: PracticeProblem[]): PracticeProblem[] {
  const seen = new Set<string>();
  return problems.filter((problem) => {
    if (seen.has(problem.prompt)) return false;
    seen.add(problem.prompt);
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
  for (const c of choices) {
    const k = choiceKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(c);
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
  let attempt = 0;
  const maxAttempts = count * 30;

  while (bank.length < count && attempt < maxAttempts) {
    const candidate = {
      ...factory(bank.length + attempt),
      id: makeId(skillId, bank.length + attempt),
    };
    if (!bank.some((problem) => problem.prompt === candidate.prompt)) {
      bank.push(candidate);
    }
    attempt += 1;
  }

  while (bank.length < count) {
    const i = bank.length;
    const problem = factory(i);
    bank.push({
      ...problem,
      id: makeId(skillId, i),
      prompt: `${problem.prompt} (Set ${Math.floor(i / 10) + 1})`,
    });
  }

  return bank.slice(0, count);
}
