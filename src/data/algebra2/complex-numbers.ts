import type { Unit } from "@/types";
import { NO_VIDEO } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "complex-numbers",
  number: 1,
  title: "Complex Numbers",
  description: "Meet i, the square root of −1, and do arithmetic with numbers that have a real and an imaginary part.",
  icon: "",
  skills: [
    {
      id: "imaginary-unit",
      title: "The Imaginary Unit",
      description: "Define i as √(−1), simplify square roots of negative numbers, and find powers of i.",
      learningGoal: "Simplify √(−n) as a multiple of i and evaluate any power of i.",
      keyIdea: "Pull √(−1) out as i first, then simplify the square root that is left; powers of i repeat every four: i, −1, −i, 1.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-cn-p1",
          type: "multiple-choice",
          prompt: "Simplify √(−36).",
          hint: "Write √(−36) as √36 · √(−1), and √(−1) is i.",
          answer: "6i",
          choices: ["6i", "6", "-6", "36i"],
          traps: [
            { value: "6", why: "The minus sign under the root cannot vanish. √(−1) is i, and it stays in the answer." },
            { value: "-6", why: "A negative under a square root does not become a negative in front. √(−1) is i." },
            { value: "36i", why: "Take the square root of 36 as well as pulling out i." },
          ],
          explanation: "√(−36) = √36 · √(−1) = 6i",
        },
        {
          id: "a2-cn-p2",
          type: "multiple-choice",
          prompt: "What is i^7?",
          hint: "i² = −1, i³ = −i, i⁴ = 1, and then the pattern repeats. Divide the exponent by 4 and use the remainder.",
          answer: "-i",
          choices: ["-i", "i", "-1", "1"],
          traps: [
            { value: "i", why: "7 ÷ 4 leaves remainder 3, so i^7 matches i³, which is i² × i." },
            { value: "-1", why: "i² is −1, but 7 leaves remainder 3 when divided by 4, so i^7 matches i³." },
            { value: "1", why: "i⁴ is 1, but 7 is not a multiple of 4. Use the remainder after dividing by 4." },
          ],
          explanation: "7 = 4 + 3, so i^7 = i⁴ · i³ = 1 · (−i) = −i",
        },
      ],
    },
    {
      id: "complex-arithmetic",
      title: "Complex Arithmetic",
      description: "Add, subtract and multiply complex numbers, keeping the real and imaginary parts straight.",
      learningGoal: "Add, subtract and multiply numbers of the form a + bi and write the result in standard form.",
      keyIdea: "Treat i like a variable when you add, subtract and FOIL, then replace every i² with −1 and collect real and imaginary parts.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-cn-p3",
          type: "multiple-choice",
          prompt: "Add: (3 + 2i) + (5 − 7i).",
          hint: "Add the real parts together and the imaginary parts together.",
          answer: "8 − 5i",
          choices: ["8 − 5i", "8 + 9i", "-2 − 5i", "3i"],
          traps: [
            { value: "8 + 9i", why: "The second number's imaginary part is −7i, so the imaginary parts are 2 and −7." },
            { value: "-2 − 5i", why: "This is an addition: the real parts 3 and 5 are added, not subtracted." },
            { value: "3i", why: "Real parts stay real and imaginary parts stay imaginary; they never merge into one term." },
          ],
          explanation: "(3 + 5) + (2 − 7)i = 8 − 5i",
        },
        {
          id: "a2-cn-p4",
          type: "numeric",
          prompt: "What is the real part of (2 + 3i)(4 − i)?",
          hint: "FOIL, then remember that i² = −1, which turns the last product into a real number.",
          answer: 11,
          traps: [
            { value: 8, why: "The product of the two imaginary parts, 3i × (−i) = −3i² = 3, is real and joins the real part." },
            { value: 5, why: "i² is −1, so 3i × (−i) = −3i² comes out positive." },
          ],
          explanation: "(2)(4) + (2)(−i) + (3i)(4) + (3i)(−i) = 8 − 2i + 12i − 3i² = 8 + 10i + 3 = 11 + 10i, so the real part is 11",
        },
      ],
    },
    {
      id: "complex-roots",
      title: "Complex Roots of Quadratics",
      description: "Solve quadratics whose solutions are not real, count real solutions with the discriminant, and find the modulus of a complex number.",
      learningGoal: "Solve x² + c = 0 and completed-square quadratics with complex answers, use b² − 4ac to count real solutions, and compute |a + bi|.",
      keyIdea: "A negative under the square root means the solutions are complex: write √(−n) as i√n, and a negative discriminant means no real solutions at all.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-cn-p5",
          type: "multiple-choice",
          prompt: "Solve x² + 25 = 0.",
          hint: "Get x² alone: x² = −25. Then take the square root of both sides, remembering the ± and that √(−1) = i.",
          answer: "x = ±5i",
          choices: ["x = ±5i", "x = ±5", "x = 5i", "x = ±25i"],
          traps: [
            { value: "x = ±5", why: "x² = −25 has no real solutions. The square root of a negative brings in i." },
            { value: "x = 5i", why: "A square root has two values. Keep the ±." },
            { value: "x = ±25i", why: "Take the square root of 25 as well as pulling out i." },
          ],
          explanation: "x² = −25 → x = ±√(−25) = ±5i",
        },
        {
          id: "a2-cn-p6",
          type: "numeric",
          prompt: "How many real solutions does x² − 4x + 7 = 0 have?",
          hint: "Compute the discriminant b² − 4ac. Negative means no real solutions, zero means one, positive means two.",
          answer: 0,
          traps: [
            { value: 2, why: "Two real solutions need a positive discriminant. Compute (−4)² − 4(1)(7) and check its sign." },
            { value: 1, why: "One real solution needs the discriminant to be exactly 0. Compute (−4)² − 4(1)(7)." },
          ],
          explanation: "b² − 4ac = 16 − 28 = −12 < 0, so there are 0 real solutions (two complex ones)",
        },
      ],
    },
  ],
};
