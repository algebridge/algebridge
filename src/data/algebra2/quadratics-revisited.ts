import type { Unit } from "@/types";
import { NO_VIDEO } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "quadratics-revisited",
  number: 3,
  title: "Quadratics Revisited",
  description: "Vertex form, the discriminant, and systems that mix a line with a parabola.",
  icon: "",
  skills: [
    {
      id: "vertex-form",
      title: "Vertex Form",
      description: "Read the vertex and the maximum or minimum straight off y = a(x − h)² + k, and complete the square to get there.",
      learningGoal: "Find the vertex of a quadratic from vertex form, state its maximum or minimum value, and rewrite y = x² + bx + c in vertex form by completing the square.",
      keyIdea: "In y = a(x − h)² + k the vertex is (h, k): flip the sign inside the bracket, keep the sign outside.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-qr-p1",
          type: "multiple-choice",
          prompt: "What is the vertex of y = 2(x − 3)² + 5?",
          hint: "Vertex form is y = a(x − h)² + k with vertex (h, k). The bracket holds x − h, so h is the opposite of what you see.",
          answer: "(3, 5)",
          choices: ["(3, 5)", "(-3, 5)", "(3, -5)", "(-3, -5)"],
          traps: [
            { value: "(-3, 5)", why: "The bracket is x − h. Since it reads x − 3, h is 3, not -3." },
            { value: "(3, -5)", why: "k sits outside the bracket with its own sign: + 5 means k = 5." },
            { value: "(-3, -5)", why: "Flip only the sign inside the bracket; k keeps its sign." },
          ],
          explanation: "y = 2(x − 3)² + 5 matches y = a(x − h)² + k with h = 3 and k = 5, so the vertex is (3, 5).",
        },
        {
          id: "a2-qr-p2",
          type: "numeric",
          prompt: "What is the smallest value y can take for y = 3(x − 2)² − 7?",
          hint: "A square is never negative, so 3(x − 2)² is at least 0. The smallest y happens when the square is 0.",
          answer: -7,
          traps: [
            { value: 2, why: "2 is the x-value where the smallest y happens, not the smallest y itself." },
            { value: 7, why: "The constant is − 7, so the smallest y is negative." },
            { value: -5, why: "The square is 0 at the vertex, so y is just the constant k." },
          ],
          explanation: "3(x − 2)² ≥ 0 and equals 0 at x = 2, so the smallest y is 0 − 7 = -7.",
        },
      ],
    },
    {
      id: "discriminant",
      title: "The Discriminant",
      description: "Use b² − 4ac to tell how many solutions a quadratic has and what kind they are, before solving anything.",
      learningGoal: "Compute the discriminant of ax² + bx + c = 0, read the number and type of solutions from its sign, and choose a constant that makes a quadratic have exactly one real solution.",
      keyIdea: "Compute b² − 4ac first: positive means two real solutions, zero means one, negative means two complex solutions.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-qr-p3",
          type: "numeric",
          prompt: "What is the discriminant of 2x² − 5x + 3 = 0?",
          hint: "The discriminant is b² − 4ac. Here a = 2, b = -5 and c = 3. Square b first, then subtract 4ac.",
          answer: 1,
          traps: [
            { value: -49, why: "(-5)² is positive 25: a negative number squared is positive." },
            { value: 49, why: "4ac is subtracted, not added: 25 − 4(2)(3)." },
            { value: 19, why: "4ac means 4 × a × c, which is 4 × 2 × 3." },
          ],
          explanation: "b² − 4ac = (-5)² − 4(2)(3) = 25 − 24 = 1",
        },
        {
          id: "a2-qr-p4",
          type: "multiple-choice",
          prompt: "How many solutions does x² + 4x + 7 = 0 have, and what kind? Use the discriminant.",
          hint: "Find b² − 4ac. Positive gives two real solutions, zero gives one real solution, negative gives two complex solutions.",
          answer: "Two complex solutions",
          choices: ["Two real solutions", "One real solution", "Two complex solutions", "Infinitely many solutions"],
          traps: [
            { value: "Two real solutions", why: "Two real solutions need a positive discriminant. Check the sign of 16 − 28." },
            { value: "One real solution", why: "One real solution needs the discriminant to be exactly 0." },
            { value: "Infinitely many solutions", why: "A quadratic equation never has more than two solutions." },
          ],
          explanation: "b² − 4ac = 4² − 4(1)(7) = 16 − 28 = -12, which is negative, so there are two complex solutions.",
        },
      ],
    },
    {
      id: "linear-quadratic-systems",
      title: "Linear-Quadratic Systems",
      description: "Find where a line meets a parabola by setting the two rules equal and solving the quadratic that falls out.",
      learningGoal: "Decide how many points a line and a parabola share, find the x-values where they meet, and use a line-parabola system to answer a projectile question.",
      keyIdea: "Set the line equal to the parabola, move everything to one side, and the roots of that quadratic are the x-values where they meet.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-qr-p5",
          type: "numeric",
          prompt: "How many points do y = x² + 2x + 5 and y = 4x + 3 share?",
          hint: "Set x² + 2x + 5 = 4x + 3, bring everything to one side, and check the discriminant of what is left.",
          answer: 0,
          traps: [
            { value: 2, why: "Two shared points need a positive discriminant. Compute it for x² − 2x + 2 = 0 and look again at the sign." },
            { value: 1, why: "One shared point needs the discriminant of x² − 2x + 2 = 0 to be exactly 0. It is not." },
          ],
          explanation: "x² + 2x + 5 = 4x + 3 → x² − 2x + 2 = 0 → discriminant (-2)² − 4(1)(2) = -4 < 0 → no shared points.",
        },
        {
          id: "a2-qr-p6",
          type: "multiple-choice",
          prompt: "At which x-values do y = x² + 3x − 2 and y = x + 6 meet?",
          hint: "Set them equal: x² + 3x − 2 = x + 6. Move everything left and factor.",
          answer: "x = -4 and x = 2",
          choices: ["x = -4 and x = 2", "x = 4 and x = -2", "x = -4 and x = -2", "x = 4 and x = 2"],
          traps: [
            { value: "x = 4 and x = -2", why: "(x + 4)(x − 2) = 0 gives each root as the opposite of the number in its bracket." },
            { value: "x = -4 and x = -2", why: "Check x = -2 in both rules: the parabola gives -4 and the line gives 4, so they do not meet there." },
            { value: "x = 4 and x = 2", why: "Check x = 4 in both rules: the parabola gives 26 and the line gives 10." },
          ],
          explanation: "x² + 3x − 2 = x + 6 → x² + 2x − 8 = 0 → (x + 4)(x − 2) = 0 → x = -4 and x = 2",
        },
      ],
    },
  ],
};
