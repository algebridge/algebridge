// Independent solvers for every Algebra 2 generator, one file per unit.
// Each file exports a function taking the harness helpers and returning
// checks keyed by skill id, the same contract as the Algebra 1 checks.
import complex_numbers from "./algebra2-checks/complex-numbers.ts";
import polynomial_functions from "./algebra2-checks/polynomial-functions.ts";
import quadratics_revisited from "./algebra2-checks/quadratics-revisited.ts";
import rational_expressions from "./algebra2-checks/rational-expressions.ts";
import radicals_rational_exponents from "./algebra2-checks/radicals-rational-exponents.ts";
import exponential_logarithmic from "./algebra2-checks/exponential-logarithmic.ts";
import sequences_series from "./algebra2-checks/sequences-series.ts";
import trigonometry from "./algebra2-checks/trigonometry.ts";

export type Check = (p: any) => string | null | "unread";
export type Checks = Record<string, Check>;
export interface CheckHelpers {
  /** null when right, a message when wrong. */
  expectAnswer: (p: any, want: number) => string | null;
  /** Exactly one choice passes isRight and it is the key. */
  onlyRight: (p: any, isRight: (choice: string) => boolean) => string | null;
  close: (a: number, b: number) => boolean;
  /** A small evaluator: numbers, x and y, + − × ÷ /, brackets, powers, |abs|, roots. */
  evaluate: (source: string, env?: Record<string, number>) => number;
  answerIsRight: (p: any, given: string) => boolean;
}

export function algebra2Checks(h: CheckHelpers): Checks {
  return Object.assign({}, complex_numbers(h), polynomial_functions(h), quadratics_revisited(h), rational_expressions(h), radicals_rational_exponents(h), exponential_logarithmic(h), sequences_series(h), trigonometry(h));
}
