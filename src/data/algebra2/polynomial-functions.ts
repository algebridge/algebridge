import type { Unit } from "@/types";
import { NO_VIDEO } from "@/data/algebra2/shared";

export const unit: Unit = {
  id: "polynomial-functions",
  number: 2,
  title: "Polynomial Functions",
  description: "Read a polynomial's degree and end behavior, divide polynomials, and use the remainder and factor theorems.",
  icon: "",
  skills: [
    {
      id: "polynomial-end-behavior",
      title: "Degree and End Behavior",
      description: "Read the degree, leading coefficient and number of terms of a polynomial, and predict what y does as x grows very large or very negative.",
      learningGoal: "Classify a polynomial by degree and term count and state its end behavior from the degree and the sign of the leading coefficient.",
      keyIdea: "Only the leading term matters far out: an even degree sends both ends the same way, an odd degree sends them opposite ways, and a negative leading coefficient flips the picture.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-pf-p1",
          type: "numeric",
          prompt: "P(x) = 4x − 2x⁵ + 7x³ − 1. What is the degree of P(x)?",
          hint: "The degree is the largest exponent on x, wherever that term sits.",
          answer: 5,
          traps: [
            { value: 1, why: "The degree is the largest exponent, not the exponent of the first term written." },
            { value: 4, why: "4 is a coefficient. Look at the exponents on x." },
            { value: 3, why: "There is a term with a larger exponent than 3." },
          ],
          explanation: "The exponents are 1, 5, 3 and 0. The largest is 5, so the degree is 5.",
        },
        {
          id: "a2-pf-p2",
          type: "multiple-choice",
          prompt: "Describe the end behavior of P(x) = -3x⁴ + 2x² − 9.",
          hint: "Even degree: both ends go the same way. A negative leading coefficient sends them down.",
          answer: "as x → ∞, y → −∞ and as x → −∞, y → −∞",
          choices: ["as x → ∞, y → −∞ and as x → −∞, y → −∞", "as x → ∞, y → ∞ and as x → −∞, y → ∞", "as x → ∞, y → ∞ and as x → −∞, y → −∞", "as x → ∞, y → −∞ and as x → −∞, y → ∞"],
          traps: [
            { value: "as x → ∞, y → ∞ and as x → −∞, y → ∞", why: "The leading coefficient is negative, which flips both ends." },
            { value: "as x → ∞, y → ∞ and as x → −∞, y → −∞", why: "Degree 4 is even, so both ends go the same way." },
            { value: "as x → ∞, y → −∞ and as x → −∞, y → ∞", why: "Degree 4 is even, so both ends go the same way." },
          ],
          explanation: "The leading term -3x⁴ has even degree and a negative coefficient, so both ends fall: y → −∞ on both sides.",
        },
      ],
    },
    {
      id: "polynomial-division",
      title: "Synthetic Division",
      description: "Divide a polynomial by x − k with synthetic division, read off the quotient and the remainder, and evaluate P(k) the fast way.",
      learningGoal: "Carry out synthetic division of a cubic by a linear factor and name the quotient and remainder.",
      keyIdea: "Bring down the first coefficient, then multiply by k and add, over and over; the last number is the remainder and it equals P(k).",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-pf-p3",
          type: "numeric",
          prompt: "Use synthetic division to divide P(x) = x³ − 2x² + 3x − 5 by (x − 2). What is the remainder?",
          hint: "Use 2 in the box. Bring down 1, multiply by 2, add to the next coefficient, and repeat. The last number is the remainder.",
          answer: 1,
          traps: [
            { value: -23, why: "The divisor x − 2 means the number in the box is 2, not −2." },
            { value: -5, why: "The remainder is the last number after all the multiply-and-add steps, not the original constant term." },
          ],
          explanation: "Coefficients 1, −2, 3, −5 with k = 2: bring down 1; 1·2 = 2, −2 + 2 = 0; 0·2 = 0, 3 + 0 = 3; 3·2 = 6, −5 + 6 = 1. The remainder is 1.",
        },
        {
          id: "a2-pf-p4",
          type: "multiple-choice",
          prompt: "Divide P(x) = x³ + 4x² + x − 6 by (x + 3). What is the quotient (ignore the remainder)?",
          hint: "The divisor x + 3 means k = −3. The numbers in the bottom row, except the last, are the quotient's coefficients, one degree lower.",
          answer: "x² + x − 2",
          choices: ["x² + x − 2", "x² + 7x + 22", "x² + 4x + 1", "x² − x + 2"],
          traps: [
            { value: "x² + 7x + 22", why: "For the divisor x + 3 the number in the box is −3, since x + 3 = x − (−3)." },
            { value: "x² + 4x + 1", why: "The quotient's coefficients come from the bottom row after multiplying and adding, not from the original polynomial." },
            { value: "x² − x + 2", why: "Add each product to the next coefficient, keeping the signs." },
          ],
          explanation: "k = −3: bring down 1; 1·(−3) = −3, 4 − 3 = 1; 1·(−3) = −3, 1 − 3 = −2; −2·(−3) = 6, −6 + 6 = 0. Quotient x² + x − 2, remainder 0.",
        },
      ],
    },
    {
      id: "remainder-factor-theorem",
      title: "Remainder and Factor Theorems",
      description: "Use P(k) to decide whether x − k is a factor, find missing factors and zeros of a cubic, and finish factoring once one factor is known.",
      learningGoal: "Apply the remainder theorem and the factor theorem to test factors, find zeros and write a cubic in factored form.",
      keyIdea: "P(k) is the remainder when you divide by x − k, so x − k is a factor exactly when P(k) = 0.",
      video: NO_VIDEO,
      problems: [
        {
          id: "a2-pf-p5",
          type: "multiple-choice",
          prompt: "Is (x − 2) a factor of P(x) = x³ − 3x² + 4? Use the remainder theorem.",
          hint: "Find P(2). By the factor theorem, x − 2 is a factor exactly when P(2) = 0.",
          answer: "Yes, the remainder is 0",
          choices: ["Yes, the remainder is 0", "No, the remainder is 4", "No, the remainder is -16", "No, the remainder is 8"],
          traps: [
            { value: "No, the remainder is 4", why: "Substitute x = 2 into every term, not just the constant." },
            { value: "No, the remainder is -16", why: "The divisor x − 2 means you evaluate P(2), not P(−2)." },
            { value: "No, the remainder is 8", why: "Compute P(2) = 8 − 12 + 4 and check whether it comes out to 0." },
          ],
          explanation: "P(2) = 8 − 12 + 4 = 0, so by the factor theorem x − 2 is a factor.",
        },
        {
          id: "a2-pf-p6",
          type: "numeric",
          prompt: "P(x) = x³ − 2x² − 5x + 6 has factors (x − 1) and (x + 2). Find k so that (x − k) is the third factor.",
          hint: "The three factors multiply to P(x). Their constants multiply to give the constant term 6, and the three zeros add up to 2 (the opposite of the x² coefficient).",
          answer: 3,
          traps: [
            { value: -3, why: "The constants of (x − 1)(x + 2)(x − k) multiply to 6, so −1 × 2 × (−k) = 6. Solve for k." },
            { value: 6, why: "6 is the constant term of P(x), the product of all three factors' constants." },
          ],
          explanation: "(x − 1)(x + 2) = x² + x − 2. Divide: (x³ − 2x² − 5x + 6) ÷ (x² + x − 2) = x − 3. So k = 3.",
        },
      ],
    },
  ],
};
