import type { PracticeProblem } from "@/types";
import { shuffleArray } from "@/lib/problem-utils";
import { generateProblemBank } from "@/data/skill-problem-generators";
import { problemAllowsCalculator } from "@/lib/calculator-access";

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

/**
 * Share of a skill's problems that earn a calculator before the whole skill
 * gets one. Below it, the calculator is left out of that skill entirely.
 */
const CALCULATOR_SHARE = 0.3;
const calculatorBySkill = new Map<string, boolean>();

/**
 * Whether practice for this skill offers the calculator, decided once for the
 * whole skill rather than problem by problem.
 *
 * The per-problem version was the "calculator keeps popping out" bug. Banks
 * mix messy and tidy numbers, so on skills like unit word problems or
 * scientific notation the calculator's availability flipped on roughly every
 * other problem: an open calculator snapped shut and its button vanished,
 * then came back closed a problem later. Within one skill the problems are
 * the same kind of work, so one answer per skill is also the honest one.
 *
 * Judged on the fixed, seeded bank so a skill never changes its mind between
 * visits.
 */
export function skillOffersCalculator(skillId: string, seedProblems: PracticeProblem[] = []): boolean {
  const known = calculatorBySkill.get(skillId);
  if (known !== undefined) return known;
  const bank = getProblemBank(skillId, seedProblems);
  // Nothing to judge yet; answer without remembering it.
  if (!bank.length) return false;
  const offered = bank.filter((p) => problemAllowsCalculator(p)).length / bank.length >= CALCULATOR_SHARE;
  calculatorBySkill.set(skillId, offered);
  return offered;
}
