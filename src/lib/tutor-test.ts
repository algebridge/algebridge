import { gradeTyped } from "@/lib/grading";

/**
 * The Algebra 1 tutor check: a fixed set of questions every AlgeBridge tutor
 * takes, so the team knows each tutor has the course down before they help a
 * student. Most sections test the math; the last one tests the tutoring job
 * itself, which is spotting where a student went wrong.
 *
 * Saving and reading results is in tutor-test-store.ts.
 */

export type SectionId = "expressions" | "equations" | "functions" | "systems" | "exponents" | "polynomials" | "quadratics" | "mistakes";

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: "expressions", title: "Expressions" },
  { id: "equations", title: "Equations and inequalities" },
  { id: "functions", title: "Linear functions" },
  { id: "systems", title: "Systems" },
  { id: "exponents", title: "Exponents and radicals" },
  { id: "polynomials", title: "Polynomials and factoring" },
  { id: "quadratics", title: "Quadratics" },
  { id: "mistakes", title: "Find the student's mistake" },
];

interface Base {
  id: string;
  section: SectionId;
  prompt: string;
  /** Lines shown under the prompt, like a student's worked steps. */
  work?: string[];
  /** Why the answer is the answer, shown after grading. */
  why: string;
}
export interface ChoiceQuestion extends Base {
  kind: "choice";
  choices: string[];
  /** Index into choices. */
  answer: number;
}
export interface NumberQuestion extends Base {
  kind: "number";
  answer: number;
}
export type TutorQuestion = ChoiceQuestion | NumberQuestion;

/** Score needed to pass, as a share of all questions. */
export const PASS_SHARE = 0.85;
/** A section below this share gets flagged to review. */
export const SECTION_REVIEW_SHARE = 0.75;

export const QUESTIONS: TutorQuestion[] = [
  // Expressions
  {
    id: "ex-distribute",
    section: "expressions",
    kind: "choice",
    prompt: "Simplify 3(2x − 4) − 2(x − 5).",
    choices: ["4x − 22", "4x − 2", "4x + 2", "8x − 2"],
    answer: 1,
    why: "6x − 12 − 2x + 10 = 4x − 2. The −2 multiplies the −5 too, giving +10.",
  },
  {
    id: "ex-negative-square",
    section: "expressions",
    kind: "number",
    prompt: "Evaluate −x² + 3x when x = −2.",
    answer: -10,
    why: "−(−2)² + 3(−2) = −4 − 6 = −10. The square applies to x first, then the negative.",
  },
  {
    id: "ex-order",
    section: "expressions",
    kind: "number",
    prompt: "Evaluate 18 ÷ 3 · 2 − 4².",
    answer: -4,
    why: "Power first: 4² = 16. Then left to right: 18 ÷ 3 = 6, 6 · 2 = 12. 12 − 16 = −4.",
  },

  // Equations and inequalities
  {
    id: "eq-both-sides",
    section: "equations",
    kind: "number",
    prompt: "Solve 5 − 2(x − 3) = 3x − 9. Type x.",
    answer: 4,
    why: "5 − 2x + 6 = 3x − 9, so 11 − 2x = 3x − 9, 20 = 5x, x = 4.",
  },
  {
    id: "eq-fractions",
    section: "equations",
    kind: "number",
    prompt: "Solve (2/3)x − 1/2 = 5/6. Type x.",
    answer: 2,
    why: "Multiply every term by 6: 4x − 3 = 5, so 4x = 8 and x = 2.",
  },
  {
    id: "eq-inequality-flip",
    section: "equations",
    kind: "choice",
    prompt: "Solve −3x + 7 > 19.",
    choices: ["x > −4", "x < −4", "x < −26/3", "x > 4"],
    answer: 1,
    why: "−3x > 12. Dividing by −3 flips the sign: x < −4.",
  },
  {
    id: "eq-identity",
    section: "equations",
    kind: "choice",
    prompt: "How many solutions does 4(x − 2) = 4x − 8 have?",
    choices: ["None", "Exactly one", "Exactly two", "Infinitely many"],
    answer: 3,
    why: "Both sides are 4x − 8, so every x works.",
  },
  {
    id: "eq-absolute",
    section: "equations",
    kind: "choice",
    prompt: "Solve |2x − 3| = 7.",
    choices: ["x = 5 only", "x = 5 or x = 2", "x = 5 or x = −2", "x = −5 or x = 2"],
    answer: 2,
    why: "2x − 3 = 7 gives x = 5; 2x − 3 = −7 gives x = −2.",
  },
  {
    id: "eq-literal",
    section: "equations",
    kind: "choice",
    prompt: "Solve A = ½h(b₁ + b₂) for h.",
    choices: ["h = 2A − (b₁ + b₂)", "h = A / (2(b₁ + b₂))", "h = 2A / (b₁ + b₂)", "h = (b₁ + b₂) / 2A"],
    answer: 2,
    why: "Multiply by 2: 2A = h(b₁ + b₂). Divide by (b₁ + b₂).",
  },

  // Linear functions
  {
    id: "fn-slope",
    section: "functions",
    kind: "number",
    prompt: "What is the slope of the line through (−2, 5) and (4, −7)?",
    answer: -2,
    why: "(−7 − 5) / (4 − (−2)) = −12 / 6 = −2.",
  },
  {
    id: "fn-intercept",
    section: "functions",
    kind: "number",
    prompt: "A line has slope 2/3 and passes through (3, 1). What is its y-intercept?",
    answer: -1,
    why: "1 = (2/3)(3) + b, so 1 = 2 + b and b = −1.",
  },
  {
    id: "fn-perpendicular",
    section: "functions",
    kind: "choice",
    prompt: "Which line is perpendicular to y = 4x − 1 and passes through (8, 3)?",
    choices: ["y = 4x − 29", "y = −¼x + 5", "y = −¼x + 1", "y = ¼x + 1"],
    answer: 1,
    why: "Perpendicular slope is −¼. 3 = −¼(8) + b = −2 + b, so b = 5.",
  },
  {
    id: "fn-input",
    section: "functions",
    kind: "number",
    prompt: "f(x) = 3x − 7. For what x is f(x) = 11?",
    answer: 6,
    why: "3x − 7 = 11, so 3x = 18 and x = 6.",
  },
  {
    id: "fn-not-function",
    section: "functions",
    kind: "choice",
    prompt: "Which of these is NOT a function?",
    choices: ["{(1, 2), (2, 2), (3, 4)}", "{(2, 1), (2, 5), (3, 0)}", "y = x²", "y = |x|"],
    answer: 1,
    why: "The input 2 goes to two outputs, 1 and 5. Repeated outputs, as in the first set, are fine.",
  },

  // Systems
  {
    id: "sys-solve",
    section: "systems",
    kind: "choice",
    prompt: "Solve the system: 2x + y = 7 and x − y = 2.",
    choices: ["(1, 3)", "(3, −1)", "(3, 1)", "(2, 3)"],
    answer: 2,
    why: "Adding the equations: 3x = 9, x = 3. Then 3 − y = 2, y = 1.",
  },
  {
    id: "sys-tickets",
    section: "systems",
    kind: "number",
    prompt: "Adult tickets cost $8 and student tickets cost $5. 40 tickets sold for $260. How many adult tickets were sold?",
    answer: 20,
    why: "a + s = 40 and 8a + 5s = 260. Substitute s = 40 − a: 8a + 200 − 5a = 260, so 3a = 60 and a = 20.",
  },

  // Exponents and radicals
  {
    id: "exp-rules",
    section: "exponents",
    kind: "choice",
    prompt: "Simplify (2x³)² · x⁻⁴.",
    choices: ["2x²", "4x²", "4x¹⁰", "4x⁵"],
    answer: 1,
    why: "(2x³)² = 4x⁶. Then x⁶ · x⁻⁴ = x². The 2 is squared too.",
  },
  {
    id: "exp-rational",
    section: "exponents",
    kind: "number",
    prompt: "Evaluate 16^(3/4).",
    answer: 8,
    why: "The fourth root of 16 is 2, and 2³ = 8.",
  },
  {
    id: "exp-growth",
    section: "exponents",
    kind: "choice",
    prompt: "A town of 500 people grows 6% per year. Which models the population after t years?",
    choices: ["500 + 1.06t", "500(0.06)ᵗ", "500(1.6)ᵗ", "500(1.06)ᵗ"],
    answer: 3,
    why: "Each year keeps 100% and adds 6%, a factor of 1.06 per year.",
  },
  {
    id: "exp-radical",
    section: "exponents",
    kind: "choice",
    prompt: "Write √72 in simplest radical form.",
    choices: ["6√2", "4√3", "2√6", "36√2"],
    answer: 0,
    why: "72 = 36 · 2, and √36 = 6.",
  },

  // Polynomials and factoring
  {
    id: "poly-multiply",
    section: "polynomials",
    kind: "choice",
    prompt: "Multiply (x + 5)(2x − 3).",
    choices: ["2x² − 15", "2x² + 7x − 15", "2x² + 13x − 15", "2x² − 7x − 15"],
    answer: 1,
    why: "2x² − 3x + 10x − 15 = 2x² + 7x − 15.",
  },
  {
    id: "poly-factor-simple",
    section: "polynomials",
    kind: "choice",
    prompt: "Factor x² − x − 12.",
    choices: ["(x − 4)(x + 3)", "(x + 4)(x − 3)", "(x − 6)(x + 2)", "(x − 12)(x + 1)"],
    answer: 0,
    why: "Two numbers that multiply to −12 and add to −1: −4 and 3.",
  },
  {
    id: "poly-factor-gcf",
    section: "polynomials",
    kind: "choice",
    prompt: "Factor 3x² − 48 completely.",
    choices: ["3(x² − 16)", "3(x − 4)²", "3(x − 4)(x + 4)", "(3x − 12)(x + 4)"],
    answer: 2,
    why: "Take out 3, then x² − 16 is a difference of squares. 3(x² − 16) is not finished.",
  },
  {
    id: "poly-factor-ac",
    section: "polynomials",
    kind: "choice",
    prompt: "Factor 6x² + 7x − 3.",
    choices: ["(3x + 1)(2x − 3)", "(6x − 1)(x + 3)", "(3x − 1)(2x + 3)", "(2x − 1)(3x + 3)"],
    answer: 2,
    why: "ac = −18; 9 and −2 multiply to −18 and add to 7. 6x² + 9x − 2x − 3 = 3x(2x + 3) − 1(2x + 3).",
  },

  // Quadratics
  {
    id: "quad-factor-solve",
    section: "quadratics",
    kind: "choice",
    prompt: "Solve x² + 2x − 15 = 0.",
    choices: ["x = 5 or x = −3", "x = 3 or x = −5", "x = 3 or x = 5", "x = −3 or x = −5"],
    answer: 1,
    why: "(x + 5)(x − 3) = 0, so x = −5 or x = 3.",
  },
  {
    id: "quad-vertex",
    section: "quadratics",
    kind: "choice",
    prompt: "What is the vertex of y = x² − 6x + 5?",
    choices: ["(3, −4)", "(−3, 32)", "(3, 4)", "(−3, −4)"],
    answer: 0,
    why: "x = −b/2a = 6/2 = 3. y = 9 − 18 + 5 = −4.",
  },
  {
    id: "quad-discriminant",
    section: "quadratics",
    kind: "number",
    prompt: "How many real solutions does 2x² − 4x + 5 = 0 have?",
    answer: 0,
    why: "b² − 4ac = 16 − 40 = −24, which is negative, so there are no real solutions.",
  },
  {
    id: "quad-formula",
    section: "quadratics",
    kind: "choice",
    prompt: "Solve x² − 4x − 1 = 0.",
    choices: ["x = −2 ± √5", "x = 2 ± √3", "x = 4 ± √5", "x = 2 ± √5"],
    answer: 3,
    why: "x = (4 ± √(16 + 4)) / 2 = (4 ± 2√5) / 2 = 2 ± √5.",
  },
  {
    id: "quad-max",
    section: "quadratics",
    kind: "number",
    prompt: "A ball's height in feet is h(t) = −16t² + 64t. What is its greatest height, in feet?",
    answer: 64,
    why: "The vertex is at t = −64 / (2 · −16) = 2. h(2) = −64 + 128 = 64.",
  },

  // Find the student's mistake
  {
    id: "mis-step",
    section: "mistakes",
    kind: "choice",
    prompt: "A student solved 3x − 5 = 2x + 7 like this. Which step has the first mistake?",
    work: ["Step 1: 3x − 2x − 5 = 7", "Step 2: x − 5 = 7", "Step 3: x = 2"],
    choices: ["Step 1", "Step 2", "Step 3", "There is no mistake"],
    answer: 2,
    why: "To undo − 5 you add 5: x = 12. The student subtracted.",
  },
  {
    id: "mis-square",
    section: "mistakes",
    kind: "choice",
    prompt: "A student writes (x + 4)² = x² + 16. What is the best way to name the mistake?",
    choices: [
      "It is correct",
      "They squared each term and lost the middle term: (x + 4)(x + 4) = x² + 8x + 16",
      "It should be x² + 4x + 16",
      "It should be 2x + 8",
    ],
    answer: 1,
    why: "Squaring a sum is not squaring each part. Writing it as (x + 4)(x + 4) shows the 8x.",
  },
  {
    id: "mis-flip",
    section: "mistakes",
    kind: "choice",
    prompt: "A student solves −2x < 10 and writes x < −5. What went wrong?",
    choices: [
      "Nothing, x < −5 is right",
      "They should have added 2 instead of dividing",
      "They divided by a negative and did not flip the sign; it should be x > −5",
      "The answer should be x < 5",
    ],
    answer: 2,
    why: "Dividing both sides by −2 reverses the inequality: x > −5. Testing x = 0 shows it: −2(0) < 10 is true.",
  },
  {
    id: "mis-slope",
    section: "mistakes",
    kind: "choice",
    prompt: "A student says the slope through (1, 4) and (3, 10) is 1/3. What did they most likely do?",
    choices: [
      "Put the change in x over the change in y",
      "Subtracted the points in different orders",
      "Used the y-intercept instead of the slope",
      "Nothing, 1/3 is right",
    ],
    answer: 0,
    why: "Run over rise is 2/6 = 1/3. Rise over run is 6/2 = 3.",
  },
  {
    id: "mis-neg-power",
    section: "mistakes",
    kind: "choice",
    prompt: "A student writes −3² = 9. What should you tell them?",
    choices: [
      "That is right",
      "The square applies only to 3, so −3² = −9. (−3)² would be 9",
      "−3² = −6",
      "−3² = 6",
    ],
    answer: 1,
    why: "Exponents come before the negative sign unless parentheses say otherwise.",
  },
  {
    id: "mis-first-move",
    section: "mistakes",
    kind: "choice",
    prompt: "A student is stuck on 4x + 3 = 19 and says \"I don't even know where to start.\" What is the best first move?",
    choices: [
      "Tell them x = 4 so they can see how it ends",
      "Ask what is being done to x, and what would undo the last thing",
      "Give them ten more problems like it",
      "Send them back to rewatch the lesson video",
    ],
    answer: 1,
    why: "A question that points at the next step keeps the thinking theirs. Giving the answer or more of the same skips the part they are stuck on.",
  },
];

export type Answers = Record<string, string>;

export function isRight(q: TutorQuestion, given: string | undefined): boolean {
  if (given === undefined || given === "") return false;
  if (q.kind === "choice") return Number(given) === q.answer;
  return gradeTyped(q.answer, given) === "right";
}

export interface SectionScore {
  id: SectionId;
  title: string;
  right: number;
  total: number;
}

export interface TestResult {
  score: number;
  total: number;
  passed: boolean;
  sections: SectionScore[];
}

export function scoreTest(answers: Answers): TestResult {
  const sections = SECTIONS.map((s) => {
    const qs = QUESTIONS.filter((q) => q.section === s.id);
    return { id: s.id, title: s.title, right: qs.filter((q) => isRight(q, answers[q.id])).length, total: qs.length };
  });
  const score = sections.reduce((n, s) => n + s.right, 0);
  const total = QUESTIONS.length;
  return { score, total, passed: score >= Math.ceil(total * PASS_SHARE), sections };
}

export function passMark(): number {
  return Math.ceil(QUESTIONS.length * PASS_SHARE);
}
