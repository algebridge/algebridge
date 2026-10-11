import type { Unit } from "@/types";
import { videoFor } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "exponential-logarithmic",
  number: 6,
  title: "Exponential & Logarithmic Functions",
  description: "Logarithms undo exponents: evaluate them, use their properties, and solve exponential equations.",
  icon: "",
  skills: [
    {
      id: "log-basics",
      title: "What a Logarithm Is",
      description: "Evaluate logarithms of exact powers, switch between exponential and logarithmic form, and use ln and log as inverses.",
      learningGoal: "Read log_b(n) as the exponent that b needs to make n, and translate any exponential equation into log form and back.",
      keyIdea: "log_b(n) asks one question: b to what power gives n? Answer that question and you have evaluated the logarithm.",
      video: videoFor("log-basics"),
      problems: [
        {
          id: "a2-lb-p1",
          type: "numeric",
          prompt: "Evaluate log₂(32).",
          hint: "2 to what power gives 32? Count the factors of 2.",
          answer: 5,
          traps: [
            { value: 16, why: "A logarithm is an exponent, not half the number. Ask: 2 to what power gives 32?", step: 0 },
            { value: 4, why: "2⁴ = 16, which is not 32. Keep multiplying by 2.", step: 1 },
          ],
          explanation: "log₂(32) asks: 2 to what power gives 32? → 2⁵ = 2 × 2 × 2 × 2 × 2 = 32 → so log₂(32) = 5",
        },
        {
          id: "a2-lb-p2",
          type: "multiple-choice",
          prompt: "Write 3^4 = 81 in logarithmic form.",
          hint: "The base of the power becomes the base of the log, and the exponent is what the log equals.",
          answer: "log₃(81) = 4",
          choices: ["log₃(81) = 4", "log₄(81) = 3", "log₃(4) = 81", "log₈₁(3) = 4"],
          traps: [
            { value: "log₄(81) = 3", why: "The base of the log is the base of the power, 3, not the exponent.", step: 1 },
            { value: "log₃(4) = 81", why: "A log equals the exponent. The number inside the log is the result of the power.", step: 1 },
            { value: "log₈₁(3) = 4", why: "The base of the log is the base of the power, not the result.", step: 1 },
          ],
          explanation: "in 3^4 = 81, the base is 3, the exponent is 4, and the result is 81 → the log has the same base, the result goes inside, and the log equals the exponent → log₃(81) = 4",
        },
      ],
    },
    {
      id: "log-properties",
      title: "Properties of Logarithms",
      description: "Expand a log of a product, quotient or power, condense a sum or difference into one log, and evaluate with given values.",
      learningGoal: "Use the product, quotient and power properties to rewrite and evaluate logarithmic expressions.",
      keyIdea: "A log turns multiplying into adding, dividing into subtracting, and a power into a multiplier out front.",
      video: videoFor("log-properties"),
      problems: [
        {
          id: "a2-lp-p1",
          type: "multiple-choice",
          prompt: "Expand log(x³y²).",
          hint: "Multiplication inside a log becomes addition outside, and a power becomes a coefficient.",
          answer: "3 log x + 2 log y",
          choices: ["3 log x + 2 log y", "3 log x − 2 log y", "3 log x × 2 log y", "log(3x) + log(2y)"],
          traps: [
            { value: "3 log x − 2 log y", why: "x³ and y² are multiplied, and a log turns multiplying into adding, not subtracting.", step: 0 },
            { value: "3 log x × 2 log y", why: "The logs are added, not multiplied. Multiplication inside becomes addition outside.", step: 0 },
            { value: "log(3x) + log(2y)", why: "A power inside the log becomes a coefficient in front of the log, not a factor inside.", step: 1 },
          ],
          explanation: "multiplication inside becomes addition: log(x³y²) = log(x³) + log(y²) → each power comes out front: log(x³) = 3 log x and log(y²) = 2 log y → log(x³y²) = 3 log x + 2 log y",
        },
        {
          id: "a2-lp-p2",
          type: "numeric",
          prompt: "Evaluate log₆(4) + log₆(9).",
          hint: "A sum of logs with the same base is the log of the product.",
          answer: 2,
          traps: [
            { value: 13, why: "Adding logs means multiplying the numbers inside, not adding them. 6 to what power gives 4 × 9?", step: 0 },
            { value: 36, why: "4 × 9 = 36 is what sits inside the log. The log asks: 6 to what power gives 36?", step: 3 },
          ],
          explanation: "same base, so a sum of logs is the log of the product: log₆(4 × 9) → 4 × 9 = 36 → 6² = 36 → so log₆(36) = 2",
        },
      ],
    },
    {
      id: "solve-exponential-equations",
      title: "Solving Exponential Equations",
      description: "Solve by matching bases, by rewriting with a common base, and by taking a logarithm, including doubling-time problems.",
      learningGoal: "Solve exponential equations exactly when the bases match and with logarithms when they do not.",
      keyIdea: "If both sides can be written with the same base, set the exponents equal; if they cannot, take a log of both sides and bring the exponent down.",
      video: videoFor("solve-exponential-equations"),
      problems: [
        {
          id: "a2-se-p1",
          type: "numeric",
          prompt: "Solve 2^(x + 3) = 64.",
          hint: "Write 64 as a power of 2, then set the exponents equal.",
          answer: 3,
          traps: [
            { value: 6, why: "2⁶ = 64, so the whole exponent x + 3 is 6. Finish by solving for x.", step: 2 },
            { value: 61, why: "Match the bases first: 64 is a power of 2, so compare exponents, not 64 itself.", step: 1 },
          ],
          explanation: "write 64 as a power of 2: 64 = 2⁶ → same base, so the exponents match: x + 3 = 6 → subtract 3: x = 6 − 3 = 3",
        },
        {
          id: "a2-se-p2",
          type: "numeric",
          prompt: "Solve 3^x = 50 for x. (round to the nearest hundredth)",
          hint: "50 is not a power of 3. Take the log of both sides: x = log(50)/log(3).",
          answer: 3.56,
          decimalPlaces: 2,
          traps: [
            { value: 16.67, why: "Dividing 50 by 3 is not the same as asking 3 to what power gives 50. Use a logarithm.", step: 0 },
            { value: 0.28, why: "That is log(3)/log(50), upside down. x = log(50) ÷ log(3).", step: 1 },
          ],
          explanation: "take the log of both sides: x · log(3) = log(50) → divide by log(3): x = log(50)/log(3) → ≈ 1.699/0.4771 → x ≈ 3.56",
        },
      ],
    },
  ],
};
