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

export function mcChoices(correct: string, distractors: string[]): string[] {
  return shuffleArray([correct, ...distractors.slice(0, 3)], generationRng);
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
