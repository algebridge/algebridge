import type { PracticeProblem } from "@/types";
import { canonicalPrompt, shuffleArray, withUniqueChoices } from "@/lib/problem-utils";
import { interleaveByShape, shapeKey } from "@/lib/problem-order";
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
  seed = Math.floor(Math.random() * 0xffffffff),
  options: { seen?: Set<string> } = {}
): PracticeProblem[] {
  const generated = generateProblemBank(skillId, seedProblems, seed);
  const bank = generated.length ? generated : getProblemBank(skillId, seedProblems);
  // Random, then varied: questions this browser already showed go last, and
  // within each part one of every kind comes before any kind repeats (see
  // src/lib/problem-order.ts). Every card that reaches a student has its
  // choices made unique, whichever bank it came from.
  const seen = options.seen;
  const shuffled = shuffleArray(bank);
  const ordered = seen?.size
    ? [
        ...interleaveByShape(shuffled.filter((p) => !seen.has(canonicalPrompt(p.prompt))), (p) => shapeKey(p.prompt)),
        ...interleaveByShape(shuffled.filter((p) => seen.has(canonicalPrompt(p.prompt))), (p) => shapeKey(p.prompt)),
      ]
    : interleaveByShape(shuffled, (p) => shapeKey(p.prompt));
  return ordered.map(withUniqueChoices);
}

export function getProblemBankSize(skillId: string): number {
  return getProblemBank(skillId).length;
}

/**
 * Share of a skill's problems that earn a calculator before the whole skill
 * gets one. Below it, the calculator is left out of that skill entirely.
 */
const CALCULATOR_SHARE = 0.2;

/**
 * Skills where the arithmetic, or knowing a number by heart, IS the work:
 * inverse operations on small numbers, the slope fraction, exponent and
 * radical rules (a calculator turns "simplify 8^(2/3)" or "√288" into a
 * button press), spotting perfect squares and factor pairs, and the special
 * products a student is asked to work out without one. These never get the
 * calculator, however big their numbers look.
 */
export const CALCULATOR_WITHHELD: ReadonlySet<string> = new Set([
  "one-step-equations",
  "two-step-equations",
  "multi-step-equations",
  "equations-with-fractions",
  "linear-inequalities",
  "slope",
  "exponent-rules",
  "negative-fractional-exponents",
  "simplifying-radicals",
  "multiplying-binomials",
  "special-products",
  "factoring-trinomials",
  "factoring-special",
  "solving-by-factoring",
  "completing-square",
  // Algebra 2: exact values and symbol work, done by hand.
  "imaginary-unit",
  "complex-arithmetic",
  "complex-roots",
  "polynomial-end-behavior",
  "polynomial-division",
  "remainder-factor-theorem",
  "vertex-form",
  "discriminant",
  "simplify-rational",
  "multiply-divide-rational",
  "nth-roots",
  "rational-exponents-evaluate",
  "radical-equations",
  "log-basics",
  "log-properties",
  "sigma-notation",
  "unit-circle-values",
  "reference-angles",
]);

/**
 * Skills where the numbers are bookkeeping around the idea, so the calculator
 * is offered even when most of the bank looks tidy: chaining conversion
 * factors, means and fences, relative frequencies, and evaluating powers in
 * an exponential model.
 */
export const CALCULATOR_OFFERED: ReadonlySet<string> = new Set([
  "dimensional-analysis",
  // Algebra 2: logs to two places, arc lengths, long sums, a work-rate equation.
  "solve-exponential-equations",
  "radians-degrees",
  "arithmetic-series",
  "geometric-series",
  "rational-equations",
  "linear-quadratic-systems",
  "center-spread",
  "two-way-tables",
  "exponential-functions",
]);

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
  if (CALCULATOR_WITHHELD.has(skillId)) return false;
  if (CALCULATOR_OFFERED.has(skillId)) return true;
  const known = calculatorBySkill.get(skillId);
  if (known !== undefined) return known;
  const bank = getProblemBank(skillId, seedProblems);
  // Nothing to judge yet; answer without remembering it.
  if (!bank.length) return false;
  const offered = bank.filter((p) => problemAllowsCalculator(p)).length / bank.length >= CALCULATOR_SHARE;
  calculatorBySkill.set(skillId, offered);
  return offered;
}
