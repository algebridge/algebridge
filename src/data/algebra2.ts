import type { Unit } from "@/types";
import { unit as complex_numbers } from "@/data/algebra2/complex-numbers";
import { unit as polynomial_functions } from "@/data/algebra2/polynomial-functions";
import { unit as quadratics_revisited } from "@/data/algebra2/quadratics-revisited";
import { unit as rational_expressions } from "@/data/algebra2/rational-expressions";
import { unit as radicals_rational_exponents } from "@/data/algebra2/radicals-rational-exponents";
import { unit as exponential_logarithmic } from "@/data/algebra2/exponential-logarithmic";
import { unit as sequences_series } from "@/data/algebra2/sequences-series";
import { unit as trigonometry } from "@/data/algebra2/trigonometry";

/**
 * Algebra 2: a second course beside Algebra 1. Its units live one per file
 * under src/data/algebra2/, each with its generators next to it, so a unit
 * can be worked on alone. Everything keyed to the Algebra 1 unit count
 * (house prizes, garden beds, unit marks) still sees only Algebra 1.
 */
export const algebra2Units: Unit[] = [complex_numbers, polynomial_functions, quadratics_revisited, rational_expressions, radicals_rational_exponents, exponential_logarithmic, sequences_series, trigonometry];
