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

export function getProblemBankSize(skillId: string): number {
  return getProblemBank(skillId).length;
}
