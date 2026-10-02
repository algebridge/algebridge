/**
 * Which Common Core State Standards for Mathematics (CCSS-M) each AlgeBridge
 * skill teaches. Delaware adopted the CCSS-M as its state math standards in
 * 2010, so these are the codes a Delaware district reads.
 *
 * How this was built (Oct 2026): every skill's title, description, seed
 * problems and generator in src/data/skill-problem-generators.ts were read,
 * then matched against the official text of the standards (the CCSS-M
 * document published at thecorestandards.org and by CCSSO). A code is listed
 * only when the skill really teaches it, in whole or in part. When the closest
 * honest match is a grade 6 to 8 standard that Algebra 1 reviews, that is the
 * code listed, rather than a high school standard stretched to fit. Codes we
 * considered and left off are in NOT_CLAIMED with the reason, so nobody has to
 * wonder whether they were missed.
 *
 * Codes use the official dot notation with the high school prefix joined by a
 * hyphen ("HSA-REI.B.3"), and a lettered sub-standard as a last dot part
 * ("HSF-IF.C.7.a", "6.RP.A.3.d"), matching the official identifiers
 * CCSS.Math.Content.HSF.IF.C.7.a. Each summary is our short paraphrase of what
 * the standard asks, not the official wording; the link goes to the official
 * text.
 */

export type StandardLevel = "HS" | "6" | "7" | "8";

export interface Standard {
  /** Official code, e.g. "HSA-REI.B.3". */
  code: string;
  /** Our short paraphrase of what the standard asks. */
  summary: string;
  /** The official page for this standard on thecorestandards.org. */
  url: string;
  /** High school, or the middle school grade the standard belongs to. */
  level: StandardLevel;
  /** The official domain name, e.g. "Reasoning with Equations and Inequalities". */
  domain: string;
}

/**
 * The shape every official CCSS-M content code takes, high school or grades
 * 6 to 8 (the only grades this course reaches back to).
 */
export const STANDARD_CODE_PATTERN =
  /^(?:HS[NAFGS]-[A-Z]{1,3}|[6-8]\.[A-Z]{1,2})\.[A-D]\.\d{1,2}(?:\.[a-e])?$/;

const SITE = "https://www.thecorestandards.org/Math/Content";

/** The official page for a code: /Math/Content/HSA/REI/B/3/, /Math/Content/6/RP/A/3/d/. */
export function officialStandardUrl(code: string): string {
  const hs = /^(HS[NAFGS])-([A-Z]+)\.([A-D])\.(\d+)(?:\.([a-e]))?$/.exec(code);
  if (hs) {
    const [, category, domain, cluster, num, sub] = hs;
    return `${SITE}/${category}/${domain}/${cluster}/${num}/${sub ? `${sub}/` : ""}`;
  }
  const grade = /^([6-8])\.([A-Z]+)\.([A-D])\.(\d+)(?:\.([a-e]))?$/.exec(code);
  if (grade) {
    const [, g, domain, cluster, num, sub] = grade;
    return `${SITE}/${g}/${domain}/${cluster}/${num}/${sub ? `${sub}/` : ""}`;
  }
  return `${SITE}/`;
}

/** Official domain names, keyed by the code's prefix. */
const DOMAINS: Record<string, string> = {
  "HSN-Q": "Quantities",
  "HSN-RN": "The Real Number System",
  "HSA-SSE": "Seeing Structure in Expressions",
  "HSA-APR": "Arithmetic with Polynomials and Rational Expressions",
  "HSA-CED": "Creating Equations",
  "HSA-REI": "Reasoning with Equations and Inequalities",
  "HSF-IF": "Interpreting Functions",
  "HSF-BF": "Building Functions",
  "HSF-LE": "Linear, Quadratic, and Exponential Models",
  "HSG-GPE": "Expressing Geometric Properties with Equations",
  "6.RP": "Ratios and Proportional Relationships",
  "6.NS": "The Number System",
  "6.EE": "Expressions and Equations",
  "7.EE": "Expressions and Equations",
  "8.EE": "Expressions and Equations",
  "8.F": "Functions",
};

function domainPrefix(code: string): string {
  return code.split(".").slice(0, code.startsWith("HS") ? 1 : 2).join(".");
}

function std(code: string, summary: string): Standard {
  const level: StandardLevel = code.startsWith("HS") ? "HS" : (code[0] as StandardLevel);
  return {
    code,
    summary,
    url: officialStandardUrl(code),
    level,
    domain: DOMAINS[domainPrefix(code)] ?? "",
  };
}

/**
 * Every standard any skill cites. Each code and its meaning were checked
 * against the official CCSS-M text.
 */
const STANDARD_LIST: Standard[] = [
  // ---- High school: Number and Quantity ----
  std("HSN-Q.A.1", "Use units to understand and guide the solution of multi-step problems, and use units consistently in formulas."),
  std("HSN-RN.A.2", "Rewrite expressions with radicals and rational exponents using the properties of exponents."),

  // ---- High school: Algebra ----
  std("HSA-SSE.A.2", "Use the structure of an expression to see ways to rewrite it, such as spotting a difference of squares."),
  std("HSA-SSE.B.3.a", "Factor a quadratic expression to reveal the zeros of the function it defines."),
  std("HSA-SSE.B.3.b", "Complete the square in a quadratic expression to reveal the function's maximum or minimum value."),
  std("HSA-APR.A.1", "Add, subtract and multiply polynomials, and see that they stay polynomials, like the integers do."),
  std("HSA-CED.A.3", "Represent constraints with equations, inequalities or systems, and judge which solutions make sense in context."),
  std("HSA-CED.A.4", "Rearrange a formula to solve for a quantity of interest, using the same steps as solving equations."),
  std("HSA-REI.A.1", "Explain each step in solving an equation and justify the method used."),
  std("HSA-REI.B.3", "Solve linear equations and inequalities in one variable."),
  std("HSA-REI.B.4.a", "Use completing the square to rewrite a quadratic equation in the form (x − p)² = q."),
  std("HSA-REI.B.4.b", "Solve quadratic equations by inspection, square roots, completing the square, the quadratic formula or factoring."),
  std("HSA-REI.C.6", "Solve systems of two linear equations exactly and approximately, for example with graphs."),
  std("HSA-REI.D.10", "Understand that the graph of an equation in two variables is the set of all its solutions."),
  std("HSA-REI.D.11", "Explain why the x-values where the graphs of y = f(x) and y = g(x) cross solve f(x) = g(x), and find them approximately."),
  std("HSA-REI.D.12", "Graph a linear inequality in two variables as a half-plane, and a system of them as the region where the half-planes overlap."),

  // ---- High school: Functions ----
  std("HSF-IF.A.1", "A function assigns each input in its domain exactly one output in its range; f(x) names that output."),
  std("HSF-IF.A.2", "Use function notation and evaluate functions for inputs in their domains."),
  std("HSF-IF.B.6", "Calculate and interpret the average rate of change of a function over an interval."),
  std("HSF-IF.C.7.a", "Graph linear and quadratic functions and show intercepts, maximums and minimums."),
  std("HSF-IF.C.8.b", "Use the properties of exponents to read exponential functions, such as their percent rate of change, and classify them as growth or decay."),
  std("HSF-BF.A.2", "Write arithmetic and geometric sequences with a recursive and an explicit formula, and move between the two."),
  std("HSF-LE.A.1.c", "Recognize situations where a quantity grows or decays by a constant percent rate."),
  std("HSF-LE.A.2", "Build linear and exponential functions, including arithmetic and geometric sequences, from a graph, a description or two input-output pairs."),

  // ---- High school: Geometry ----
  std("HSG-GPE.B.5", "Prove the slope rules for parallel and perpendicular lines and use them, for example to write the equation of a parallel or perpendicular line."),

  // ---- Grades 6 to 8, which Algebra 1 reviews ----
  std("6.RP.A.3.b", "Solve unit rate problems, including unit pricing and constant speed."),
  std("6.RP.A.3.d", "Use ratio reasoning to convert measurement units."),
  std("6.NS.C.6.b", "Read the signs in an ordered pair as the quadrant of the coordinate plane the point lies in."),
  std("6.NS.C.6.c", "Find and plot points with integer and rational coordinates on the coordinate plane."),
  std("6.NS.C.7.c", "Understand the absolute value of a number as its distance from 0 on the number line."),
  std("6.EE.B.7", "Solve equations of the form x + p = q and px = q."),
  std("7.EE.B.4.a", "Solve equations of the form px + q = r and p(x + q) = r fluently."),
  std("8.EE.A.1", "Know and apply the properties of integer exponents."),
  std("8.EE.A.2", "Use square root and cube root symbols; evaluate square roots of small perfect squares and cube roots of small perfect cubes."),
  std("8.EE.A.4", "Use, read and compute with numbers in scientific notation, alongside decimal notation."),
  std("8.EE.C.7.b", "Solve linear equations with rational coefficients, including ones that need the distributive property and combining like terms."),
  std("8.EE.C.8.a", "Understand that the solution of a system of two linear equations is where their graphs intersect."),
  std("8.EE.C.8.b", "Solve systems of two linear equations algebraically, and estimate solutions by graphing."),
  std("8.EE.C.8.c", "Solve real-world problems that lead to two linear equations in two variables."),
  std("8.F.A.3", "Interpret y = mx + b as a linear function whose graph is a straight line."),
  std("8.F.B.4", "Find the rate of change and initial value of a linear function from a description or from two (x, y) points."),
];

export const STANDARDS: Record<string, Standard> = Object.fromEntries(
  STANDARD_LIST.map((s) => [s.code, s])
);

/**
 * Skill id (from src/data/curriculum.ts) to the standards it teaches, high
 * school codes first.
 */
export const SKILL_STANDARDS: Record<string, string[]> = {
  // ---- Unit 1: Working with Units ----
  // Conversion factors, miles to feet, km to m. HSN-Q.A.1 is the high school
  // home of unit reasoning; the conversion itself is 6.RP.A.3.d.
  "unit-basics": ["HSN-Q.A.1", "6.RP.A.3.d"],
  // Chained conversions and an error-analysis item about an upside-down factor.
  "dimensional-analysis": ["HSN-Q.A.1", "6.RP.A.3.d"],
  // mL to L, miles per gallon, distance at a constant speed.
  "unit-word-problems": ["HSN-Q.A.1", "6.RP.A.3.b", "6.RP.A.3.d"],

  // ---- Unit 2: Solving Equations & Inequalities ----
  // x + a = c and ax = c with positive numbers, plus find-the-wrong-step items
  // (HSA-REI.A.1 is reasoning about each step).
  "one-step-equations": ["HSA-REI.B.3", "HSA-REI.A.1", "6.EE.B.7"],
  // ax + b = c, and putting the solving steps in order.
  "two-step-equations": ["HSA-REI.B.3", "HSA-REI.A.1", "7.EE.B.4.a"],
  // Distributing, variables on both sides, find-the-wrong-step items.
  "multi-step-equations": ["HSA-REI.B.3", "HSA-REI.A.1", "8.EE.C.7.b"],
  // Linear equations with fractional coefficients. Not HSA-REI.A.2: that
  // standard is rational equations with the variable in a denominator, which
  // this skill does not reach.
  "equations-with-fractions": ["HSA-REI.B.3", "8.EE.C.7.b"],
  "linear-inequalities": ["HSA-REI.B.3"],

  // ---- Unit 3: Linear Equations & Graphs ----
  // Quadrants and reading coordinates. No high school standard covers this;
  // it is grade 6 content that Algebra 1 reviews.
  "coordinate-plane": ["6.NS.C.6.b", "6.NS.C.6.c"],
  // Slope from two points, horizontal and vertical lines. The cleanest match
  // is 8.F.B.4 (rate of change from two points).
  slope: ["8.F.B.4"],
  // y-intercept of y = mx + b and points on the line.
  "graphing-lines": ["HSF-IF.C.7.a", "HSA-REI.D.10", "8.F.A.3"],
  // x- and y-intercepts of Ax + By = C.
  intercepts: ["HSF-IF.C.7.a"],

  // ---- Unit 4: Forms of Linear Equations ----
  // Write y = mx + b from a slope and intercept; read m and b off an equation.
  "slope-intercept": ["HSF-LE.A.2", "8.F.B.4"],
  // Write the line through a point with a given slope.
  "point-slope": ["HSF-LE.A.2"],
  // Solve Ax + By = C for y.
  "standard-form": ["HSA-CED.A.4"],
  // Uses the slope rules. The proof half of HSG-GPE.B.5 is not taught.
  "parallel-perpendicular": ["HSG-GPE.B.5"],

  // ---- Unit 5: Systems of Equations ----
  // Where two lines cross, found by setting the right sides equal.
  "graphing-systems": ["HSA-REI.C.6", "HSA-REI.D.11", "8.EE.C.8.a"],
  substitution: ["HSA-REI.C.6", "8.EE.C.8.b"],
  elimination: ["HSA-REI.C.6", "8.EE.C.8.b"],
  // Tickets, baskets and coins: two constraints, two equations.
  "systems-word-problems": ["HSA-CED.A.3", "HSA-REI.C.6", "8.EE.C.8.c"],

  // ---- Unit 6: Inequalities (Systems & Graphs) ----
  // Solid or dashed boundary, which side to shade.
  "graphing-inequalities": ["HSA-REI.D.12"],
  // The CCSS-M does not name compound inequalities; each part is a linear
  // inequality in one variable.
  "compound-inequalities": ["HSA-REI.B.3"],
  // Which point lies in both half-planes.
  "systems-inequalities": ["HSA-REI.D.12"],

  // ---- Unit 7: Functions ----
  "function-notation": ["HSF-IF.A.2"],
  // Domain of 1/(x − a) and √(x − b), from the equation.
  "domain-range": ["HSF-IF.A.1"],
  // Average rate of change between two points of a function.
  "function-graphs": ["HSF-IF.B.6"],

  // ---- Unit 8: Sequences ----
  // nth term with an explicit formula, common difference.
  "arithmetic-sequences": ["HSF-BF.A.2", "HSF-LE.A.2"],
  // Common ratio, nth term.
  "geometric-sequences": ["HSF-BF.A.2", "HSF-LE.A.2"],

  // ---- Unit 9: Exponents & Radicals ----
  // Product, quotient, power and zero exponent rules. In the CCSS-M these are
  // grade 8; there is no separate high school standard for them.
  "exponent-rules": ["8.EE.A.1"],
  // Negative exponents (8.EE.A.1's own example), and moving between roots
  // and fractional exponents (HSN-RN.A.2).
  "negative-fractional-exponents": ["HSN-RN.A.2", "8.EE.A.1"],
  // Writing numbers in scientific notation and back. Arithmetic with them,
  // the rest of 8.EE.A.4, is not practiced.
  "scientific-notation": ["8.EE.A.4"],
  // √72 = 6√2, and square roots of perfect squares.
  "simplifying-radicals": ["HSN-RN.A.2", "8.EE.A.2"],

  // ---- Unit 10: Exponential Growth & Decay ----
  // "Starts at a and multiplies by b", growth or decay, evaluating a·bˣ.
  "exponential-functions": ["HSF-LE.A.2", "HSF-IF.C.8.b"],
  // Compound interest: a constant percent rate per year.
  "exponential-growth": ["HSF-LE.A.1.c", "HSF-LE.A.2"],
  // Depreciation by a constant percent per year.
  "exponential-decay": ["HSF-LE.A.1.c", "HSF-LE.A.2"],

  // ---- Unit 11: Quadratics: Multiplying & Factoring ----
  "multiplying-binomials": ["HSA-APR.A.1"],
  // (a + b)² and (a + b)(a − b): multiplying, and seeing the pattern.
  "special-products": ["HSA-APR.A.1", "HSA-SSE.A.2"],
  "factoring-trinomials": ["HSA-SSE.A.2"],
  // Difference of squares and perfect square trinomials, the example
  // HSA-SSE.A.2 itself gives.
  "factoring-special": ["HSA-SSE.A.2"],

  // ---- Unit 12: Quadratic Functions & Equations ----
  // Opens up or down, vertex, axis of symmetry.
  "graphing-parabolas": ["HSF-IF.C.7.a"],
  // Zero product property on factored quadratics.
  "solving-by-factoring": ["HSA-REI.B.4.b", "HSA-SSE.B.3.a"],
  // Practice drills the step both standards rest on, finding the (b/2)²
  // that makes a perfect square.
  "completing-square": ["HSA-REI.B.4.a", "HSA-SSE.B.3.b"],
  // Roots by formula, and the discriminant's count of real solutions.
  "quadratic-formula": ["HSA-REI.B.4.b"],

  // ---- Unit 13: Absolute Value & Piecewise Functions ----
  // No CCSS-M high school standard names absolute value equations. The skill
  // rests on absolute value as distance from 0 (6.NS.C.7.c) and then solves
  // the two linear equations that come out of it (HSA-REI.B.3).
  "absolute-value": ["HSA-REI.B.3", "6.NS.C.7.c"],
  // Same footing: |x| < a becomes a compound linear inequality.
  "absolute-value-inequalities": ["HSA-REI.B.3", "6.NS.C.7.c"],
  // Evaluating a piecewise function at an input.
  "piecewise-functions": ["HSF-IF.A.2"],
};

export interface NotClaimed {
  skillId: string;
  code: string;
  /** Why the code is not listed for the skill. */
  reason: string;
}

/**
 * Standards that look like a match from a skill's title but that the skill
 * does not actually teach. Listed so the gap is visible, not hidden.
 */
export const NOT_CLAIMED: NotClaimed[] = [
  {
    skillId: "piecewise-functions",
    code: "HSF-IF.C.7.b",
    reason: "That standard asks students to graph piecewise functions. AlgeBridge practice evaluates them but does not ask for a graph.",
  },
  {
    skillId: "elimination",
    code: "HSA-REI.C.5",
    reason: "That standard asks for a proof of why elimination works. The skill uses the method without the proof.",
  },
  {
    skillId: "negative-fractional-exponents",
    code: "HSN-RN.A.1",
    reason: "That standard asks students to explain why rational exponents are defined the way they are. The skill uses the definition without that explanation.",
  },
  {
    skillId: "equations-with-fractions",
    code: "HSA-REI.A.2",
    reason: "That standard covers rational and radical equations. The skill's equations have fractions as coefficients, not variables in a denominator.",
  },
];

/** The standards a skill teaches, in the order listed. */
export function standardsForSkill(skillId: string): Standard[] {
  return (SKILL_STANDARDS[skillId] ?? [])
    .map((code) => STANDARDS[code])
    .filter((s): s is Standard => Boolean(s));
}

/** Look up one standard by its code. */
export function getStandard(code: string): Standard | undefined {
  return STANDARDS[code];
}

/** Human label for a level: "High school", "Grade 8". */
export function levelLabel(level: StandardLevel): string {
  return level === "HS" ? "High school" : `Grade ${level}`;
}

/** Every code any skill cites, sorted high school first, then by grade. */
export function citedStandards(): Standard[] {
  const cited = new Set(Object.values(SKILL_STANDARDS).flat());
  return STANDARD_LIST.filter((s) => cited.has(s.code));
}
