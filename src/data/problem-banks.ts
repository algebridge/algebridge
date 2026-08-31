import type { PracticeProblem } from "@/types";
import { shuffleArray } from "@/lib/problem-utils";
import { generateProblemBank } from "@/data/skill-problem-generators";

const problemBanks = new Map<string, PracticeProblem[]>();

export function buildProblemBankForSkill(
  skillId: string,
  seedProblems: PracticeProblem[] = []
): PracticeProblem[] {
  const existing = problemBanks.get(skillId);
  if (existing?.length) return existing;

  const bank = generateProblemBank(skillId, seedProblems);
  problemBanks.set(skillId, bank);
  return bank;
}

export function getProblemBank(skillId: string, seedProblems: PracticeProblem[] = []): PracticeProblem[] {
  const existing = problemBanks.get(skillId);
  if (existing?.length) return existing;
  if (seedProblems.length > 0) {
    return buildProblemBankForSkill(skillId, seedProblems);
  }
  return [];
}

/** Returns a new shuffled copy of the lesson problem bank for each practice session. */
export function getShuffledProblemsForSkill(
  skillId: string,
  seedProblems: PracticeProblem[] = []
): PracticeProblem[] {
  return shuffleArray(getProblemBank(skillId, seedProblems));
}

/**
 * A genuinely new set of problems for this session.
 *
 * The cached bank above is generated from `hashString(skillId)`, which is the
 * same number for every student on every visit, so shuffling it only ever
 * changed the ORDER of the same fifty problems. Practise a skill twice and
 * you met the identical numbers again, which is how a student ends up
 * recognising an answer instead of working it out.
 *
 * This regenerates with a seed that varies, and deliberately skips the cache.
 * Call it from the client only: the seed differs between server and browser
 * by design, and rendering it during SSR would be a hydration mismatch.
 */
export function getFreshProblemsForSkill(
  skillId: string,
  seedProblems: PracticeProblem[] = [],
  seed = Math.floor(Math.random() * 0xffffffff)
): PracticeProblem[] {
  const bank = generateProblemBank(skillId, seedProblems, seed);
  if (bank.length === 0) return shuffleArray(getProblemBank(skillId, seedProblems));
  return shuffleArray(bank);
}

export function getProblemBankSize(skillId: string): number {
  return getProblemBank(skillId).length;
}
