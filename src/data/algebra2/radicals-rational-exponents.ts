import type { Unit } from "@/types";
import { videoFor } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "radicals-rational-exponents",
  number: 5,
  title: "Radicals & Rational Exponents",
  description: "Cube roots and beyond, exponents that are fractions, and equations with a root in them.",
  icon: "",
  skills: [
    {
      id: "nth-roots",
      title: "Cube Roots and nth Roots",
      description: "Evaluate cube roots and fourth roots, pull perfect cubes out of a cube root, and combine like radicals.",
      learningGoal: "Evaluate and simplify nth roots of whole numbers and add or subtract radicals with the same index and radicand.",
      keyIdea: "An nth root undoes an nth power: look for the biggest perfect nth power inside, take its root out, and leave the rest under the radical.",
      video: videoFor("nth-roots"),
      problems: [
        {
          id: "a2-nr-p1",
          type: "numeric",
          prompt: "Evaluate ∛343.",
          hint: "Which whole number, multiplied by itself three times, gives 343?",
          answer: 7,
          traps: [
            { value: 114.3333, why: "A cube root is not division by 3. Look for a number that cubes to 343." },
            { value: 49, why: "7 × 7 = 49 is only two factors of 7. A cube root asks for three equal factors." },
          ],
          explanation: "7 × 7 × 7 = 343, so ∛343 = 7.",
        },
        {
          id: "a2-nr-p2",
          type: "multiple-choice",
          prompt: "Simplify ∛40.",
          hint: "Write 40 as a perfect cube times something: 40 = 8 × 5.",
          answer: "2∛5",
          choices: ["2∛5", "5∛2", "4∛5", "2√5"],
          traps: [
            { value: "5∛2", why: "The perfect cube comes out of the radical and its cube root goes in front. The leftover factor stays inside." },
            { value: "4∛5", why: "The cube root of 8 is 2, not 4. Three equal factors of 2 make 8." },
            { value: "2√5", why: "The index stays 3. A cube root does not become a square root." },
          ],
          explanation: "∛40 = ∛(8 × 5) = ∛8 × ∛5 = 2∛5.",
        },
      ],
    },
    {
      id: "rational-exponents-evaluate",
      title: "Rational Exponents",
      description: "Evaluate powers like 8^(2/3) and 16^(−3/4), and move between radical form and exponent form.",
      learningGoal: "Evaluate expressions with fractional and negative fractional exponents and rewrite radicals as rational exponents.",
      keyIdea: "In b^(p/q) the denominator q is the root and the numerator p is the power: take the qth root first, then raise it to the pth power.",
      video: videoFor("rational-exponents-evaluate"),
      problems: [
        {
          id: "a2-re-p1",
          type: "numeric",
          prompt: "Evaluate 8^(2/3).",
          hint: "The 3 on the bottom is a cube root and the 2 on top is a square. Take the cube root of 8 first.",
          answer: 4,
          traps: [
            { value: 5.3333, why: "An exponent of 2/3 is a root and a power, not multiplying 8 by 2/3." },
            { value: 32, why: "You squared 8 and then forgot the cube root, or took no root at all. The denominator 3 is a root." },
          ],
          explanation: "8^(2/3) = (∛8)² = 2² = 4.",
        },
        {
          id: "a2-re-p2",
          type: "multiple-choice",
          prompt: "Write ⁴√(x³) using a rational exponent.",
          hint: "The index of the root becomes the denominator of the exponent.",
          answer: "x^(3/4)",
          choices: ["x^(3/4)", "x^(4/3)", "x^12", "x^7"],
          traps: [
            { value: "x^(4/3)", why: "The root index goes on the bottom of the exponent, and the power goes on top." },
            { value: "x^12", why: "A root divides the exponent; it does not multiply it." },
            { value: "x^7", why: "A root divides the exponent; it does not add to it." },
          ],
          explanation: "⁴√(x³) = x^(3/4): the power 3 goes on top and the root 4 goes on the bottom.",
        },
      ],
    },
    {
      id: "radical-equations",
      title: "Radical Equations",
      description: "Solve equations with a square root or cube root in them, and check for extraneous solutions.",
      learningGoal: "Isolate the radical, raise both sides to the matching power, solve, and check every answer in the original equation.",
      keyIdea: "Get the radical alone, square (or cube) both sides, then always check: squaring can create a solution the original equation rejects.",
      video: videoFor("radical-equations"),
      problems: [
        {
          id: "a2-rq-p1",
          type: "numeric",
          prompt: "Solve √(x + 5) = 4.",
          hint: "Square both sides to remove the square root, then subtract 5.",
          answer: 11,
          traps: [
            { value: -1, why: "Square both sides first: the right side becomes 4², not 4." },
            { value: 21, why: "After squaring, 5 is added to x, so subtract 5 from both sides." },
          ],
          explanation: "√(x + 5) = 4 → x + 5 = 16 → x = 11. Check: √16 = 4.",
        },
        {
          id: "a2-rq-p2",
          type: "numeric",
          prompt: "Solving √(x + 7) = x − 5 by squaring gives x = 9 or x = 2. Which one checks in the original equation?",
          hint: "Put each value back into the original equation. A square root is never negative.",
          answer: 9,
          traps: [{ value: 2, why: "Substitute it: the left side is a positive square root but the right side, x − 5, comes out negative. That value was created by squaring." }],
          explanation: "x = 9: √16 = 4 and 9 − 5 = 4, true. x = 2: √9 = 3 but 2 − 5 = −3, false. Only x = 9 checks.",
        },
      ],
    },
  ],
};
