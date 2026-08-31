import type { GeneratedProblem, PracticeProblem } from "@/types";

/**
 * Whether the calculator is offered right now.
 *
 * It used to be mounted globally and shown on every screen, which meant it sat
 * beside "solve x + 3 = 7", a problem where reaching for a calculator is the
 * student skipping the exact thing the problem is asking them to do. Practice
 * now says, per problem, whether it is offered.
 *
 * `null` means nothing has an opinion (any page that is not practice), and the
 * calculator stays available there as a general tool.
 */
type Access = boolean | null;

let access: Access = null;
const listeners = new Set<() => void>();

export function setCalculatorAccess(next: Access): void {
  if (access === next) return;
  access = next;
  listeners.forEach((fn) => fn());
}

export function getCalculatorAccess(): Access {
  return access;
}

/** Server renders have no opinion, which keeps the first paint stable. */
export function getServerCalculatorAccess(): Access {
  return null;
}

export function subscribeCalculatorAccess(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Any number in the text, including decimals and negatives. */
const NUMBER = /-?\d+(?:\.\d+)?/g;

/**
 * Does this problem earn a calculator?
 *
 * The test is whether the arithmetic is incidental to the skill or is the
 * skill. Small whole numbers are the skill, that is mental arithmetic a
 * student is meant to be building. Decimals, percentages and anything in the
 * hundreds are bookkeeping wrapped around the algebra, and making a student
 * long-divide by hand there tests handwriting, not method.
 *
 * A problem can always overrule this by setting `allowCalculator` itself.
 */
export function problemAllowsCalculator(
  problem: Pick<PracticeProblem | GeneratedProblem, "prompt"> & {
    allowCalculator?: boolean;
    decimalPlaces?: number;
  }
): boolean {
  if (typeof problem.allowCalculator === "boolean") return problem.allowCalculator;

  // Being asked to round to a place means the answer is a real division, and
  // doing that by hand tests long division rather than the skill on the page.
  if (typeof problem.decimalPlaces === "number") return true;

  // Judged on the QUESTION only. An earlier version read the answer too, which
  // got it backwards on a whole class of skills: "simplify 2^10" and "simplify
  // √288" both produce a big number, and both are asking the student to
  // produce exactly that number without one. What matters is whether the
  // numbers you are HANDED are messy.
  const text = problem.prompt ?? "";
  if (text.includes("%")) return true;

  for (const match of text.match(NUMBER) ?? []) {
    if (match.includes(".")) return true;
    if (Math.abs(Number(match)) >= 100) return true;
  }
  return false;
}
