import type { PracticeProblem } from "@/types";
import { generators as complex_numbers } from "@/data/algebra2/complex-numbers.generators";
import { generators as polynomial_functions } from "@/data/algebra2/polynomial-functions.generators";
import { generators as quadratics_revisited } from "@/data/algebra2/quadratics-revisited.generators";
import { generators as rational_expressions } from "@/data/algebra2/rational-expressions.generators";
import { generators as radicals_rational_exponents } from "@/data/algebra2/radicals-rational-exponents.generators";
import { generators as exponential_logarithmic } from "@/data/algebra2/exponential-logarithmic.generators";
import { generators as sequences_series } from "@/data/algebra2/sequences-series.generators";
import { generators as trigonometry } from "@/data/algebra2/trigonometry.generators";

/** Every Algebra 2 generator, keyed by skill id, merged into the main registry. */
export const ALGEBRA2_GENERATORS: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  ...complex_numbers,
  ...polynomial_functions,
  ...quadratics_revisited,
  ...rational_expressions,
  ...radicals_rational_exponents,
  ...exponential_logarithmic,
  ...sequences_series,
  ...trigonometry,
};
