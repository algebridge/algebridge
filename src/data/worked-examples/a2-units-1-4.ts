import type { WorkedExamples } from "./types";

/**
 * Algebra 2, units 1 to 4: complex numbers, polynomial functions, quadratics
 * revisited, rational expressions. One example per kind of practice card.
 */
export const EXAMPLES: WorkedExamples = {
  "imaginary-unit": [
    {
      kind: "Square root of a negative number",
      card: { type: "multiple-choice", prompt: "Simplify √(−50).", answer: "5i√2", choices: ["5i√2", "5√2", "-5√2", "50i"] },
      steps: [
        { work: "√(−50) = √50 · √(−1)", why: "Split the negative off as √(−1), so the rest is a positive root." },
        { work: "√(−1) = i, so √(−50) = √50 · i", why: "i is defined as √(−1). It stays in the answer." },
        { work: "√50 = √(25 · 2) = 5√2", why: "Pull the biggest perfect square, 25, out of the root." },
        { work: "√(−50) = 5i√2", why: "Put the pieces together: 5, then i, then √2." },
      ],
      answer: "5i√2",
    },
    {
      kind: "A power of i",
      card: { type: "multiple-choice", prompt: "What is i^38?", answer: "-1", choices: ["1", "i", "-1", "-i"] },
      steps: [
        { work: "38 ÷ 4 = 9 remainder 2, so 38 = 4 × 9 + 2", why: "Powers of i repeat every 4, so only the remainder matters." },
        { work: "i^38 = (i⁴)^9 · i² = 1 · i²", why: "i⁴ = 1, and 1 to any power is still 1." },
        { work: "i² = −1, so i^38 = -1", why: "The cycle is i, −1, −i, 1; remainder 2 lands on −1." },
      ],
      answer: "-1",
    },
    {
      kind: "Squaring an imaginary number",
      card: { type: "numeric", prompt: "Simplify (6i)². Write a plain number.", answer: -36 },
      steps: [
        { work: "(6i)² = 6² · i² = 36i²", why: "Squaring squares both the number and the i." },
        { work: "i² = −1, so 36i² = 36 · (−1)", why: "Swap i² for −1. That is what i means." },
        { work: "36 · (−1) = -36", why: "A positive times a negative is negative." },
      ],
      answer: "-36",
    },
    {
      kind: "Multiplying two imaginary numbers",
      card: { type: "numeric", prompt: "Simplify (3i)(5i). Write a plain number.", answer: -15 },
      steps: [
        { work: "(3i)(5i) = 3 · 5 · i · i = 15i²", why: "Multiply the numbers together and the i's together." },
        { work: "i² = −1, so 15i² = 15 · (−1)", why: "i times i is i², which equals −1." },
        { work: "15 · (−1) = -15", why: "The i² flips the sign of the product." },
      ],
      answer: "-15",
    },
    {
      kind: "Multiplying two negative roots",
      card: { type: "numeric", prompt: "Simplify √(−81) · √(−49). Write a plain number.", answer: -63 },
      steps: [
        { work: "√(−81) = √81 · √(−1) = 9i", why: "Take the i out of each root before multiplying anything." },
        { work: "√(−49) = √49 · √(−1) = 7i", why: "Same move for the second root: √49 is 7, √(−1) is i." },
        { work: "9i · 7i = 63i²", why: "Multiply the numbers, 9 · 7 = 63, and the i's, i · i = i²." },
        { work: "i² = −1, so 63i² = −63", why: "Replace i² with −1. Skipping the i's would wrongly give 63." },
      ],
      answer: "-63",
    },
  ],

  "complex-arithmetic": [
    {
      kind: "Adding complex numbers",
      card: { type: "multiple-choice", prompt: "Add: (3 + 2i) + (-5 + 4i).", answer: "-2 + 6i", choices: ["-2 + 6i", "-2 − 2i", "8 + 6i", "4"] },
      steps: [
        { work: "real parts: 3 − 5 = -2", why: "Real parts combine only with real parts." },
        { work: "imaginary parts: 2 + 4 = 6, so 6i", why: "The i terms combine like x terms do." },
        { work: "-2 + 6i", why: "Write the real part first, then the imaginary part." },
      ],
      answer: "-2 + 6i",
    },
    {
      kind: "Subtracting complex numbers",
      card: { type: "multiple-choice", prompt: "Subtract: (6 − 2i) − (1 + 5i).", answer: "5 − 7i", choices: ["5 − 7i", "5 + 3i", "7 − 7i", "-2"] },
      steps: [
        { work: "real parts: 6 − 1 = 5", why: "The minus sign applies to the real part of the second number." },
        { work: "imaginary parts: -2 − 5 = -7, so -7i", why: "The minus sign applies to the imaginary part too." },
        { work: "5 − 7i", why: "Keep the real and imaginary parts as two separate terms." },
      ],
      answer: "5 − 7i",
    },
    {
      kind: "Multiplying complex numbers",
      card: { type: "multiple-choice", prompt: "Multiply: (2 + 3i)(4 − i).", answer: "11 + 10i", choices: ["11 + 10i", "5 + 10i", "8 − 3i", "11 − 14i"] },
      steps: [
        { work: "FOIL: (2 + 3i)(4 − i) = 8 − 2i + 12i − 3i²", why: "Multiply all four pairs, treating i like a variable." },
        { work: "i² = −1, so -3i² = 3", why: "The i² term turns into a plain number with its sign flipped." },
        { work: "real part: 8 + 3 = 11; imaginary part: -2 + 12 = 10", why: "Collect the plain numbers, then collect the i terms." },
        { work: "11 + 10i", why: "Write the result as real part plus imaginary part." },
      ],
      answer: "11 + 10i",
    },
    {
      kind: "One part of a product",
      card: { type: "numeric", prompt: "What is the real part of (1 + 2i)(3 + 4i)?", answer: -5 },
      steps: [
        { work: "FOIL: (1 + 2i)(3 + 4i) = 3 + 4i + 6i + 8i²", why: "Multiply every term of the first by every term of the second." },
        { work: "i² = −1, so 8i² = -8", why: "The last product has i², so it becomes real." },
        { work: "real part: 3 − 8 = -5; imaginary part: 4 + 6 = 10", why: "The real part has no i in it." },
        { work: "-5 + 10i, so the real part is -5", why: "The real part is the number without the i." },
      ],
      answer: "-5",
    },
    {
      kind: "A number times its conjugate",
      card: { type: "numeric", prompt: "Multiply (3 + 4i) by its conjugate (3 − 4i). Write a plain number.", answer: 25 },
      steps: [
        { work: "FOIL: (3 + 4i)(3 − 4i) = 9 − 12i + 12i − 16i²", why: "Multiply all four pairs." },
        { work: "the two i terms cancel, leaving 9 − 16i²", why: "−12i and +12i add to zero. Conjugates always do this." },
        { work: "i² = −1, so -16i² = +16", why: "Minus times minus makes plus." },
        { work: "9 + 16 = 25", why: "A number times its conjugate is a² + b², a plain number." },
      ],
      answer: "25",
    },
    {
      kind: "The imaginary part of a product",
      card: { type: "numeric", prompt: "What is the imaginary part of (2 − i)(3 + 5i)?", answer: 7 },
      steps: [
        { work: "FOIL: (2 − i)(3 + 5i) = 6 + 10i − 3i − 5i²", why: "Multiply every term of the first by every term of the second." },
        { work: "i² = −1, so -5i² = 5", why: "The i² term is real, so it carries no i." },
        { work: "real part: 6 + 5 = 11; imaginary part: 10 − 3 = 7", why: "The imaginary part adds the coefficients of i." },
        { work: "11 + 7i, so the imaginary part is 7", why: "The imaginary part is the number in front of i." },
      ],
      answer: "7",
    },
  ],

  "complex-roots": [
    {
      kind: "x² equals a negative number",
      card: { type: "multiple-choice", prompt: "Solve x² + 18 = 0.", answer: "x = ±3i√2", choices: ["x = ±3i√2", "x = ±3√2", "x = 3i√2", "x = ±18i"] },
      steps: [
        { work: "subtract 18: x² = −18", why: "Get x² alone first." },
        { work: "x = ±√(−18)", why: "A square root has two answers, so keep the ±." },
        { work: "√(−18) = √18 · √(−1) = √18 · i", why: "The root of a negative brings in i." },
        { work: "√18 = √(9 · 2) = 3√2", why: "Pull the perfect square 9 out of the root." },
        { work: "x = ±3i√2", why: "Put the number, the i and the root back together." },
      ],
      answer: "x = ±3i√2",
    },
    {
      kind: "ax² + c = 0 with a number in front",
      card: { type: "multiple-choice", prompt: "Solve 3x² + 75 = 0.", answer: "x = ±5i", choices: ["x = ±5i", "x = ±5", "x = 5i", "x = ±75i"] },
      steps: [
        { work: "subtract 75: 3x² = −75", why: "Move the plain number to the other side." },
        { work: "divide by 3: x² = −25", why: "Divide before taking the root, so x² is alone." },
        { work: "x = ±√(−25)", why: "Take the square root of both sides and keep the ±." },
        { work: "√(−25) = √25 · √(−1) = 5i", why: "√25 is 5 and √(−1) is i." },
        { work: "x = ±5i", why: "Both 5i and −5i square to −25." },
      ],
      answer: "x = ±5i",
    },
    {
      kind: "Counting real solutions",
      card: { type: "numeric", prompt: "How many real solutions does x² + 2x + 5 = 0 have?", answer: 0 },
      steps: [
        { work: "a = 1, b = 2, c = 5: b² − 4ac = (2)² − 4(1)(5)", why: "The discriminant b² − 4ac tells how many real solutions." },
        { work: "= 4 − 20 = -16", why: "Square b first, then subtract 4 times a times c." },
        { work: "-16 is negative, so 0 real solutions", why: "A negative discriminant means both solutions are complex." },
      ],
      answer: "0",
    },
    {
      kind: "The modulus of a complex number",
      card: { type: "numeric", prompt: "Find |5 − 12i|, the modulus of 5 − 12i.", answer: 13 },
      steps: [
        { work: "|5 − 12i| = √((5)² + (-12)²)", why: "The modulus is √(a² + b²), the distance from 0." },
        { work: "square each part: (5)² = 25, (-12)² = 144", why: "A negative squared is positive." },
        { work: "add: √(25 + 144) = √169", why: "Add the two squares under one root." },
        { work: "√169 = 13", why: "13 × 13 = 169." },
      ],
      answer: "13",
    },
    {
      kind: "Completing the square to complex roots",
      card: { type: "multiple-choice", prompt: "Solve x² − 6x + 13 = 0.", answer: "x = 3 ± 2i", choices: ["x = 3 ± 2i", "x = -3 ± 2i", "x = 3 ± 2", "x = 3 ± 4i"] },
      steps: [
        { work: "move 13 across: x² − 6x = −13", why: "Leave only the x terms on the left." },
        { work: "add (-6 ÷ 2)² = 9 to both sides: x² − 6x + 9 = −13 + 9", why: "Half the x-coefficient, squared, completes the square." },
        { work: "(x − 3)² = −4", why: "The left side is now a perfect square." },
        { work: "x − 3 = ±√(−4) = ±2i", why: "The root of a negative brings in i; keep the ±." },
        { work: "x = 3 ± 2i", why: "Add 3 to both sides." },
      ],
      answer: "x = 3 ± 2i",
    },
    {
      kind: "x² already alone and negative",
      card: { type: "multiple-choice", prompt: "Solve x² = -12.", answer: "x = ±2i√3", choices: ["x = ±2i√3", "x = ±2√3", "x = 2i√3", "x = ±12i"] },
      steps: [
        { work: "x² is already alone: x² = −12", why: "Nothing to move; take the root next." },
        { work: "x = ±√(−12)", why: "Keep the ±: both roots square to −12." },
        { work: "√(−12) = √12 · √(−1) = √12 · i", why: "The root of a negative brings in i." },
        { work: "√12 = √(4 · 3) = 2√3", why: "Pull the perfect square 4 out of the root." },
        { work: "x = ±2i√3", why: "Put the number, the i and the root together." },
      ],
      answer: "x = ±2i√3",
    },
  ],

  "polynomial-end-behavior": [
    {
      kind: "Degree of a polynomial out of order",
      card: { type: "numeric", prompt: "P(x) = 4x² − 3x⁵ + 7. What is the degree of P(x)?", answer: 5 },
      steps: [
        { work: "the terms are 4x², -3x⁵, 7", why: "Read every term, wherever it is written." },
        { work: "their exponents on x are 2, 5, 0", why: "A plain number has exponent 0." },
        { work: "the largest exponent is 5, so the degree is 5", why: "The degree is the biggest exponent, not the first one." },
      ],
      answer: "5",
    },
    {
      kind: "Leading coefficient",
      card: { type: "numeric", prompt: "P(x) = 6x − 2x⁴ + x³. What is the leading coefficient of P(x)?", answer: -2 },
      steps: [
        { work: "the exponents on x are 1, 4, 3", why: "Find the highest power first." },
        { work: "the largest exponent is 4, on the term -2x⁴", why: "The leading term has the highest power." },
        { work: "its coefficient, with its sign, is -2", why: "Keep the minus sign; it is part of the coefficient." },
      ],
      answer: "-2",
    },
    {
      kind: "End behavior of a polynomial",
      card: {
        type: "multiple-choice",
        prompt: "Describe the end behavior of P(x) = -2x³ + 5x − 1.",
        answer: "as x → ∞, y → −∞ and as x → −∞, y → ∞",
        choices: [
          "as x → ∞, y → −∞ and as x → −∞, y → ∞",
          "as x → ∞, y → ∞ and as x → −∞, y → −∞",
          "as x → ∞, y → ∞ and as x → −∞, y → ∞",
          "as x → ∞, y → −∞ and as x → −∞, y → −∞",
        ],
      },
      steps: [
        { work: "the leading term is -2x³", why: "Far out, the leading term decides everything." },
        { work: "degree 3 is odd, so the ends go opposite ways", why: "Odd degree: one end up, the other end down." },
        { work: "the leading coefficient -2 is negative, so the right end goes down", why: "The sign of the leading coefficient sets the right end." },
        { work: "as x goes to ∞, y goes to −∞ and as x goes to −∞, y goes to ∞", why: "Right end down, so the left end is up." },
      ],
      answer: "as x → ∞, y → −∞ and as x → −∞, y → ∞",
    },
    {
      kind: "Classifying a polynomial",
      card: {
        type: "multiple-choice",
        prompt: "Classify P(x) = 3x² − 7 by its degree and its number of terms.",
        answer: "quadratic binomial",
        choices: ["quadratic binomial", "cubic binomial", "quadratic trinomial", "cubic trinomial"],
      },
      steps: [
        { work: "the largest exponent is 2, so it is quadratic", why: "Degree 2 is called quadratic." },
        { work: "it has 2 terms, so it is a binomial", why: "Count the pieces separated by + and −." },
        { work: "quadratic binomial", why: "Say the degree name first, then the term count name." },
      ],
      answer: "quadratic binomial",
    },
    {
      kind: "One end from degree and sign",
      card: {
        type: "multiple-choice",
        prompt: "A polynomial has degree 4 and leading coefficient -3. As x → −∞, what happens to y?",
        answer: "y → −∞",
        choices: ["y → −∞", "y → ∞", "y → 0", "y → -3"],
      },
      steps: [
        { work: "the leading term is -3x⁴", why: "Only the leading term matters at the ends." },
        { work: "the right end follows the sign of -3, so on the right y goes down", why: "Negative leading coefficient: the right end falls." },
        { work: "degree 4 is even, so the left end matches the right end: on the left y goes down", why: "Even degree: both ends go the same way." },
        { work: "as x goes to −∞, y goes to −∞", why: "Both ends fall for this polynomial." },
      ],
      answer: "y → −∞",
    },
    {
      kind: "Degree of a product of factors",
      card: { type: "numeric", prompt: "P(x) = (x − 2)²(x + 1)³. What is the degree of P(x)?", answer: 5 },
      steps: [
        { work: "degree of each factor: (x − 2)² has degree 2, (x + 1)³ has degree 3", why: "A power on a factor counts it that many times." },
        { work: "multiplying adds degrees: 2 + 3 = 5", why: "When you multiply, the exponents on x add." },
      ],
      answer: "5",
    },
  ],

  "polynomial-division": [
    {
      kind: "Remainder when dividing by x − k",
      card: { type: "numeric", prompt: "Use synthetic division to divide P(x) = x³ − 4x² + 2x + 5 by (x − 3). What is the remainder?", answer: 2 },
      steps: [
        { work: "x − 3 puts 3 in the box; the coefficients are 1, -4, 2, 5", why: "Dividing by x − k uses k in the box." },
        { work: "bring down 1; 1 × 3 = 3, and -4 + 3 = -1", why: "Multiply by the box number, add to the next coefficient." },
        { work: "-1 × 3 = -3, and 2 − 3 = -1", why: "Repeat the same multiply and add." },
        { work: "-1 × 3 = -3, and 5 − 3 = 2", why: "One more time, on the last coefficient." },
        { work: "the last number in the bottom row is the remainder: 2", why: "The final number is always the remainder." },
      ],
      answer: "2",
    },
    {
      kind: "Remainder when dividing by x + k",
      card: { type: "numeric", prompt: "Use synthetic division to divide P(x) = 2x³ + 3x² − 5x + 4 by (x + 2). What is the remainder?", answer: 10 },
      steps: [
        { work: "x + 2 = x − (-2), so -2 goes in the box; the coefficients are 2, 3, -5, 4", why: "x + 2 is x minus negative 2, so the box gets −2." },
        { work: "bring down 2; 2 × (-2) = -4, and 3 − 4 = -1", why: "Multiply by −2, then add to the next coefficient." },
        { work: "-1 × (-2) = 2, and -5 + 2 = -3", why: "A negative times a negative is positive." },
        { work: "-3 × (-2) = 6, and 4 + 6 = 10", why: "Finish the last column the same way." },
        { work: "the last number in the bottom row is the remainder: 10", why: "The final number is the remainder." },
      ],
      answer: "10",
    },
    {
      kind: "Quotient of a cubic",
      card: {
        type: "multiple-choice",
        prompt: "Divide P(x) = x³ + 2x² − 5x − 6 by (x − 2). What is the quotient (ignore the remainder)?",
        answer: "x² + 4x + 3",
        choices: ["x² + 4x + 3", "x² − 5", "x² + 2x − 5", "x² − 4x + 3"],
      },
      steps: [
        { work: "x − 2 puts 2 in the box; the coefficients are 1, 2, -5, -6", why: "Dividing by x − k uses k in the box." },
        { work: "bring down 1; 1 × 2 = 2, and 2 + 2 = 4", why: "Multiply by 2, add to the next coefficient." },
        { work: "4 × 2 = 8, and -5 + 8 = 3", why: "Repeat the multiply and add." },
        { work: "3 × 2 = 6, and -6 + 6 = 0", why: "The last sum is the remainder, here 0." },
        { work: "bottom row 1, 4, 3, 0: the quotient is x² + 4x + 3", why: "The other numbers are the quotient, one degree lower." },
      ],
      answer: "x² + 4x + 3",
    },
    {
      kind: "Evaluating P(k)",
      card: { type: "numeric", prompt: "P(x) = 2x³ − x² + 3x − 4. Find P(-2).", answer: -30 },
      steps: [
        { work: "P(-2) = 2(-2)³ − (-2)² + 3(-2) − 4", why: "Put −2, in brackets, in place of every x." },
        { work: "(-2)³ = -8 and (-2)² = 4", why: "Work the powers first: odd powers of a negative stay negative." },
        { work: "= -16 − 4 − 6 − 4", why: "Multiply each power by its coefficient." },
        { work: "= -30", why: "Add the four numbers left to right." },
      ],
      answer: "-30",
    },
    {
      kind: "Quotient of a quadratic",
      card: {
        type: "multiple-choice",
        prompt: "Divide P(x) = x² + 5x − 3 by (x + 1). What is the quotient (ignore the remainder)?",
        answer: "x + 4",
        choices: ["x + 4", "x + 6", "x + 5", "x − 4"],
      },
      steps: [
        { work: "x + 1 = x − (-1), so -1 goes in the box; the coefficients are 1, 5, -3", why: "x + 1 is x minus negative 1." },
        { work: "bring down 1; 1 × (-1) = -1, and 5 − 1 = 4", why: "Multiply by −1, add to the next coefficient." },
        { work: "4 × (-1) = -4, and -3 − 4 = -7", why: "The last sum is the remainder." },
        { work: "bottom row 1, 4, -7: the quotient is x + 4, remainder -7", why: "The numbers before the remainder make the quotient." },
      ],
      answer: "x + 4",
    },
  ],

  "remainder-factor-theorem": [
    {
      kind: "Is it a factor?",
      card: {
        type: "multiple-choice",
        prompt: "Is (x + 1) a factor of P(x) = x³ + 2x² − 5x + 3? Use the remainder theorem.",
        answer: "No, the remainder is 9",
        choices: ["No, the remainder is 9", "Yes, the remainder is 0", "No, the remainder is 1", "No, the remainder is -9"],
      },
      steps: [
        { work: "the remainder when dividing by x + 1 is P(-1)", why: "Remainder theorem: dividing by x − k leaves P(k)." },
        { work: "P(-1) = (-1)³ + 2(-1)² − 5(-1) + 3", why: "Put −1 in place of every x." },
        { work: "= -1 + 2 + 5 + 3", why: "Work each term, minding the signs." },
        { work: "= 9", why: "Add them up." },
        { work: "9 is not 0, so x + 1 is not a factor; the remainder is 9", why: "Factor theorem: a factor needs a remainder of exactly 0." },
      ],
      answer: "No, the remainder is 9",
    },
    {
      kind: "Finding the third factor",
      card: { type: "numeric", prompt: "P(x) = x³ − 2x² − 5x + 6 has factors (x − 1) and (x + 2). Find k so that (x − k) is the third factor.", answer: 3 },
      steps: [
        { work: "multiply the known factors: (x − 1)(x + 2) = x² + x − 2", why: "Combine the two factors you already have." },
        { work: "the constants of all three factors multiply to 6: -2 · (−k) = 6", why: "The constant terms multiply to P's constant term." },
        { work: "−k = 6 ÷ (-2) = -3", why: "Divide both sides by −2." },
        { work: "k = 3, so the third factor is x − 3", why: "Flip the sign of −k to get k." },
      ],
      answer: "3",
    },
    {
      kind: "The other two zeros",
      card: {
        type: "multiple-choice",
        prompt: "One zero of P(x) = x³ − 2x² − 5x + 6 is x = 1. What are the other two zeros?",
        answer: "x = -2 and x = 3",
        choices: ["x = -2 and x = 3", "x = -3 and x = 2", "x = 1 and x = 3", "x = 1 and x = -2"],
      },
      steps: [
        { work: "divide by x − 1 with 1 in the box: bottom row 1, -1, -6, 0", why: "A zero x = 1 means x − 1 divides evenly." },
        { work: "the quotient is x² − x − 6", why: "The bottom row before the 0 gives the quotient." },
        { work: "factor it: (x − 3)(x + 2)", why: "Two numbers that multiply to −6 and add to −1." },
        { work: "set each factor to 0: x = -2 and x = 3", why: "Each factor is 0 at the opposite of its number." },
      ],
      answer: "x = -2 and x = 3",
    },
    {
      kind: "The constant that makes a factor",
      card: { type: "numeric", prompt: "P(x) = x³ − 4x² + 2x + m. Find the value of m that makes (x − 3) a factor of P(x).", answer: 3 },
      steps: [
        { work: "factor theorem: x − 3 is a factor when P(3) = 0", why: "A factor leaves remainder 0." },
        { work: "P(3) = (3)³ − 4(3)² + 2(3) + m", why: "Put 3 in place of every x." },
        { work: "= 27 − 36 + 6 + m = -3 + m", why: "Work out the known terms." },
        { work: "-3 + m = 0, so m = 3", why: "Choose m to cancel the rest." },
      ],
      answer: "3",
    },
    {
      kind: "Fully factored form",
      card: {
        type: "multiple-choice",
        prompt: "(x + 1) is a factor of P(x) = x³ − 7x − 6. Write P(x) in fully factored form.",
        answer: "(x + 1)(x + 2)(x − 3)",
        choices: ["(x + 1)(x + 2)(x − 3)", "(x − 1)(x − 2)(x + 3)", "(x + 1)(x − 2)(x + 3)", "(x + 1)(x + 2)(x + 3)"],
      },
      steps: [
        { work: "divide by x + 1 with -1 in the box: bottom row 1, -1, -6, 0", why: "Write 0 for the missing x² term before dividing." },
        { work: "the quotient is x² − x − 6", why: "The numbers before the remainder 0 give the quotient." },
        { work: "factor the quotient: (x − 3)(x + 2)", why: "Two numbers that multiply to −6 and add to −1." },
        { work: "P(x) = (x + 1)(x + 2)(x − 3)", why: "Write the given factor with the two new ones." },
      ],
      answer: "(x + 1)(x + 2)(x − 3)",
    },
    {
      kind: "It is a factor",
      card: {
        type: "multiple-choice",
        prompt: "Is (x − 2) a factor of P(x) = x³ − 3x² + 4x − 4? Use the remainder theorem.",
        answer: "Yes, the remainder is 0",
        choices: ["Yes, the remainder is 0", "No, the remainder is -4", "No, the remainder is -32", "No, the remainder is 4"],
      },
      steps: [
        { work: "the remainder when dividing by x − 2 is P(2)", why: "Remainder theorem: dividing by x − k leaves P(k)." },
        { work: "P(2) = (2)³ − 3(2)² + 4(2) − 4", why: "Put 2 in place of every x." },
        { work: "= 8 − 12 + 8 − 4", why: "Work each term." },
        { work: "= 0", why: "Add them up." },
        { work: "the remainder is 0, so x − 2 is a factor", why: "Factor theorem: remainder 0 means it divides evenly." },
      ],
      answer: "Yes, the remainder is 0",
    },
  ],

  "vertex-form": [
    {
      kind: "Reading the vertex",
      card: { type: "multiple-choice", prompt: "What is the vertex of y = 3(x + 2)² − 5?", answer: "(-2, -5)", choices: ["(-2, -5)", "(2, -5)", "(-2, 5)", "(2, 5)"] },
      steps: [
        { work: "match y = a(x − h)² + k: the bracket is x + 2 = x − (-2), so h = -2", why: "The bracket shows x − h, so h is the opposite of +2." },
        { work: "the number outside the bracket is k, with its sign: k = -5", why: "k keeps its own sign; only h flips." },
        { work: "the vertex (h, k) is (-2, -5)", why: "The vertex is the point (h, k)." },
      ],
      answer: "(-2, -5)",
    },
    {
      kind: "Smallest or largest value",
      card: { type: "numeric", prompt: "What is the smallest value y can take for y = 2(x − 1)² + 7?", answer: 7 },
      steps: [
        { work: "a = 2 is positive, so the vertex is the lowest point", why: "A positive a opens the parabola upward." },
        { work: "at the vertex x = 1, so the bracket x − 1 is 0 and its square is 0", why: "A square is never negative; its smallest value is 0." },
        { work: "y = 2 · 0 + 7 = 7", why: "With the square at 0, only k is left." },
      ],
      answer: "7",
    },
    {
      kind: "Completing the square",
      card: {
        type: "multiple-choice",
        prompt: "Write y = x² + 6x + 2 in vertex form.",
        answer: "y = (x + 3)² − 7",
        choices: ["y = (x + 3)² − 7", "y = (x − 3)² − 7", "y = (x + 3)² + 2", "y = (x + 3)² + 11"],
      },
      steps: [
        { work: "half of 6 is 3, and (3)² = 9", why: "Half the x-coefficient, squared, completes the square." },
        { work: "add and subtract 9: y = (x² + 6x + 9) + 2 − 9", why: "Adding and subtracting 9 keeps the function the same." },
        { work: "x² + 6x + 9 = (x + 3)², so y = (x + 3)² + 2 − 9", why: "The bracket is now a perfect square." },
        { work: "2 − 9 = -7, so y = (x + 3)² − 7", why: "Combine the plain numbers outside the bracket." },
      ],
      answer: "y = (x + 3)² − 7",
    },
    {
      kind: "Evaluating vertex form",
      card: { type: "numeric", prompt: "For y = -2(x − 3)² + 4, what is y when x = 5?", answer: -4 },
      steps: [
        { work: "the bracket first: x − 3 with x = 5 is 5 − 3 = 2", why: "Order of operations: brackets first." },
        { work: "square it: (2)² = 4", why: "Powers come before multiplying." },
        { work: "multiply by -2: -2 × 4 = -8", why: "Now multiply by the number in front." },
        { work: "add the constant: -8 + 4 = -4", why: "Add k last, with its own sign." },
      ],
      answer: "-4",
    },
    {
      kind: "Largest value when a is negative",
      card: { type: "numeric", prompt: "What is the largest value y can take for y = -3(x + 4)² − 2?", answer: -2 },
      steps: [
        { work: "a = -3 is negative, so the vertex is the highest point", why: "A negative a opens the parabola downward." },
        { work: "at the vertex x = -4, so the bracket x + 4 is 0 and its square is 0", why: "The square is smallest, 0, at the vertex." },
        { work: "y = -3 · 0 − 2 = -2", why: "With the square at 0, only k is left." },
      ],
      answer: "-2",
    },
  ],

  discriminant: [
    {
      kind: "Computing the discriminant",
      card: { type: "numeric", prompt: "What is the discriminant of 2x² − 3x − 5 = 0?", answer: 49 },
      steps: [
        { work: "a = 2, b = -3, c = -5", why: "Read a, b and c with their signs." },
        { work: "b² = (-3)² = 9", why: "A negative squared is positive." },
        { work: "4ac = 4(2)(-5) = -40", why: "Multiply 4 by a and by c, keeping signs." },
        { work: "b² − 4ac = 9 − (-40) = 49", why: "Subtracting a negative adds." },
      ],
      answer: "49",
    },
    {
      kind: "Number and kind of solutions",
      card: {
        type: "multiple-choice",
        prompt: "How many solutions does x² + 4x + 7 = 0 have, and what kind? Use the discriminant.",
        answer: "Two complex solutions",
        choices: ["Two complex solutions", "Two real solutions", "One real solution", "Infinitely many solutions"],
      },
      steps: [
        { work: "a = 1, b = 4, c = 7", why: "Read the coefficients from the equation." },
        { work: "b² − 4ac = (4)² − 4(1)(7) = 16 − 28", why: "Square b, then subtract 4ac." },
        { work: "= -12", why: "16 − 28 is negative." },
        { work: "negative, so two complex solutions", why: "Negative: complex. Zero: one real. Positive: two real." },
      ],
      answer: "Two complex solutions",
    },
    {
      kind: "c for exactly one solution",
      card: { type: "numeric", prompt: "For what value of c does 3x² − 12x + c = 0 have exactly one real solution?", answer: 12 },
      steps: [
        { work: "exactly one real solution means b² − 4ac = 0, so b² = 4ac", why: "One real solution happens when the discriminant is 0." },
        { work: "(-12)² = 4(3)c", why: "Put in a = 3 and b = −12." },
        { work: "144 = 12c", why: "Square −12 and multiply 4 × 3." },
        { work: "c = 144 ÷ 12 = 12", why: "Divide both sides by 12." },
      ],
      answer: "12",
    },
    {
      kind: "Which equation has one solution",
      card: {
        type: "multiple-choice",
        prompt: "Which equation has exactly one real solution?",
        answer: "x² − 10x + 25 = 0",
        choices: ["x² − 10x + 25 = 0", "x² − 10x + 27 = 0", "x² − 10x + 22 = 0", "x² + 10x + 26 = 0"],
      },
      steps: [
        { work: "exactly one real solution means the discriminant b² − 4ac is 0", why: "Zero discriminant: the two roots are the same number." },
        { work: "x² − 10x + 25 = 0: (-10)² − 4(1)(25) = 100 − 100 = 0", why: "Check each choice's discriminant." },
        { work: "the other three give -8, 12, -4, none of them 0", why: "Nonzero discriminants give two solutions, real or complex." },
        { work: "so x² − 10x + 25 = 0 has exactly one real solution", why: "It is (x − 5)², a perfect square." },
      ],
      answer: "x² − 10x + 25 = 0",
    },
  ],

  "linear-quadratic-systems": [
    {
      kind: "How many shared points",
      card: { type: "numeric", prompt: "How many points do y = x² + 5x + 2 and y = x − 1 share?", answer: 2 },
      steps: [
        { work: "set them equal: x² + 5x + 2 = x − 1", why: "Shared points have the same y for the same x." },
        { work: "subtract x − 1 from both sides: x² + 4x + 3 = 0", why: "Get one side equal to 0." },
        { work: "discriminant: (4)² − 4(1)(3) = 16 − 12 = 4", why: "b² − 4ac counts the real solutions." },
        { work: "positive, so two shared points", why: "Each real x gives one meeting point." },
      ],
      answer: "2",
    },
    {
      kind: "Where they meet",
      card: {
        type: "multiple-choice",
        prompt: "At which x-values do y = x² + x − 4 and y = 2x + 2 meet?",
        answer: "x = -2 and x = 3",
        choices: ["x = -2 and x = 3", "x = 2 and x = -3", "x = -2 and x = -3", "x = 2 and x = 3"],
      },
      steps: [
        { work: "set them equal: x² + x − 4 = 2x + 2", why: "Where they meet, both rules give the same y." },
        { work: "subtract 2x + 2 from both sides: x² − x − 6 = 0", why: "Move everything to one side." },
        { work: "factor: (x − 3)(x + 2) = 0", why: "Two numbers that multiply to −6 and add to −1." },
        { work: "each bracket is 0: x = -2 and x = 3", why: "Each root is the opposite of the number in its bracket." },
      ],
      answer: "x = -2 and x = 3",
    },
    {
      kind: "A ball reaching a height",
      card: { type: "numeric", prompt: "A ball is thrown up. Its height after t seconds is h = -16t² + 64t feet. After how many seconds does it first reach 48 feet?", answer: 1 },
      steps: [
        { work: "-16t² + 64t = 48", why: "Set the height rule equal to the height you want." },
        { work: "move everything to one side: 16t² − 64t + 48 = 0", why: "A quadratic is solved with 0 on one side." },
        { work: "divide by 16: t² − 4t + 3 = 0", why: "Smaller numbers are easier to factor." },
        { work: "factor: (t − 1)(t − 3) = 0, so t = 1 or t = 3", why: "Two numbers that multiply to 3 and add to −4." },
        { work: "the first time is the smaller one: t = 1", why: "It passes 48 feet going up, then again coming down." },
      ],
      answer: "1",
    },
    {
      kind: "A tangent line",
      card: { type: "numeric", prompt: "The line y = 2x − 3 touches y = x² − 4x + 6 at exactly one point. What is the x-coordinate of that point?", answer: 3 },
      steps: [
        { work: "set them equal: x² − 4x + 6 = 2x − 3", why: "The touching point is on both graphs." },
        { work: "subtract 2x − 3 from both sides: x² − 6x + 9 = 0", why: "Get 0 on one side." },
        { work: "it is a perfect square: (x − 3)² = 0", why: "Exactly one meeting point means a perfect square." },
        { work: "x − 3 = 0, so x = 3", why: "The only x that makes the square 0." },
      ],
      answer: "3",
    },
    {
      kind: "The larger y-value",
      card: { type: "numeric", prompt: "y = x² − x − 5 and y = 2x − 1 meet at two points. What is the larger of the two y-values?", answer: 7 },
      steps: [
        { work: "set them equal and subtract 2x − 1: x² − 3x − 4 = 0", why: "The meeting x-values solve this equation." },
        { work: "factor: (x − 4)(x + 1) = 0, so x = 4 or x = -1", why: "Two numbers that multiply to −4 and add to −3." },
        { work: "put each into the line: 2(4) − 1 = 7 and 2(-1) − 1 = -3", why: "The line is the easier rule for finding y." },
        { work: "the larger y-value is 7", why: "Compare the two y-values, not the x-values." },
      ],
      answer: "7",
    },
  ],

  "simplify-rational": [
    {
      kind: "Excluded values, difference of squares",
      card: {
        type: "multiple-choice",
        prompt: "Which values of x are excluded from the domain of (x + 2)/(x² − 16)?",
        answer: "x = -4 and x = 4",
        choices: ["x = -4 and x = 4", "x = 4", "x = -2", "x = -2, x = -4 and x = 4"],
      },
      steps: [
        { work: "only the bottom matters: set x² − 16 = 0", why: "A fraction breaks only when its bottom is 0." },
        { work: "difference of squares: (x − 4)(x + 4) = 0", why: "a² − b² = (a − b)(a + b)." },
        { work: "x − 4 = 0 gives x = 4, and x + 4 = 0 gives x = -4", why: "Each factor can be zero on its own." },
        { work: "excluded: x = -4 and x = 4", why: "The top being 0 at x = −2 is allowed." },
      ],
      answer: "x = -4 and x = 4",
    },
    {
      kind: "Excluded values, trinomial bottom",
      card: {
        type: "multiple-choice",
        prompt: "Which values of x are excluded from the domain of (x − 1)/(x² + x − 12)?",
        answer: "x = -4 and x = 3",
        choices: ["x = -4 and x = 3", "x = 4 and x = -3", "x = 1", "x = -4"],
      },
      steps: [
        { work: "only the bottom matters: set x² + x − 12 = 0", why: "Excluded values make the bottom 0." },
        { work: "two numbers that multiply to -12 and add to 1: 4 and -3", why: "That is how a trinomial with x² factors." },
        { work: "(x + 4)(x − 3) = 0", why: "Write the factors using those two numbers." },
        { work: "each factor is 0 at x = -4 or x = 3, so the excluded values are x = -4 and x = 3", why: "Each root is the opposite of the number in its factor." },
      ],
      answer: "x = -4 and x = 3",
    },
    {
      kind: "Canceling a common factor",
      card: { type: "multiple-choice", prompt: "Simplify (x² + 7x + 10)/(x + 2).", answer: "x + 5", choices: ["x + 5", "x − 5", "x + 7", "x + 2"] },
      steps: [
        { work: "factor the top: two numbers that multiply to 10 and add to 7 are 2 and 5", why: "Factor first; only whole factors can cancel." },
        { work: "x² + 7x + 10 = (x + 2)(x + 5)", why: "Write the top as a product." },
        { work: "cancel the shared factor (x + 2): (x + 2)(x + 5)/(x + 2) = x + 5", why: "A factor over itself is 1." },
      ],
      answer: "x + 5",
    },
    {
      kind: "Factoring top and bottom",
      card: {
        type: "multiple-choice",
        prompt: "Simplify (x² − 9)/(x² − x − 6).",
        answer: "(x + 3)/(x + 2)",
        choices: ["(x + 3)/(x + 2)", "(x − 3)/(x + 2)", "(x + 3)/(x − 2)", "(x − 3)/(x − 2)"],
      },
      steps: [
        { work: "factor the top: x² − 9 = (x − 3)(x + 3)", why: "Difference of squares." },
        { work: "factor the bottom: two numbers that multiply to -6 and add to -1, so x² − x − 6 = (x − 3)(x + 2)", why: "Find the pair, then write the factors." },
        { work: "cancel the shared factor (x − 3)", why: "It is on the top and on the bottom." },
        { work: "(x + 3)/(x + 2)", why: "What is left stays exactly as written." },
      ],
      answer: "(x + 3)/(x + 2)",
    },
    {
      kind: "Simplify, then evaluate",
      card: { type: "numeric", prompt: "Simplify (x² + x − 12)/(x + 4), then find its value when x = 6.", answer: 3 },
      steps: [
        { work: "factor the top: two numbers that multiply to -12 and add to 1 are 4 and -3", why: "Factor before canceling." },
        { work: "x² + x − 12 = (x + 4)(x − 3)", why: "Write the top as a product." },
        { work: "cancel the shared factor (x + 4): (x + 4)(x − 3)/(x + 4) = x − 3", why: "The matching factor divides out." },
        { work: "at x = 6: 6 − 3 = 3", why: "Substitute into the simpler expression." },
      ],
      answer: "3",
    },
  ],

  "multiply-divide-rational": [
    {
      kind: "Multiplying with a factor that cancels",
      card: {
        type: "multiple-choice",
        prompt: "Multiply and simplify: (x + 1)/(x − 3) × (x − 3)/(x + 5)",
        answer: "(x + 1)/(x + 5)",
        choices: ["(x + 1)/(x + 5)", "(x + 5)/(x + 1)", "(x + 1)/(x − 3)", "(x − 3)/(x + 5)"],
      },
      steps: [
        { work: "tops times tops, bottoms times bottoms: ((x + 1)(x − 3))/((x − 3)(x + 5))", why: "Multiplying fractions: top times top, bottom times bottom." },
        { work: "(x − 3) is on the top and on the bottom, so it cancels", why: "A factor over itself is 1." },
        { work: "(x + 1)/(x + 5)", why: "The factors that did not match stay." },
      ],
      answer: "(x + 1)/(x + 5)",
    },
    {
      kind: "Dividing by flipping",
      card: {
        type: "multiple-choice",
        prompt: "Divide and simplify: (x + 2)/(x − 1) ÷ (x + 2)/(x + 4)",
        answer: "(x + 4)/(x − 1)",
        choices: ["(x + 4)/(x − 1)", "(x − 1)/(x + 4)", "(x + 2)/(x − 1)", "(x + 4)/(x + 2)"],
      },
      steps: [
        { work: "dividing is multiplying by the flip: (x + 2)/(x − 1) × (x + 4)/(x + 2)", why: "Flip only the second fraction." },
        { work: "multiply across: ((x + 2)(x + 4))/((x − 1)(x + 2))", why: "Tops together, bottoms together." },
        { work: "(x + 2) is on the top and on the bottom, so it cancels", why: "Matching factors divide out to 1." },
        { work: "(x + 4)/(x − 1)", why: "Write what is left." },
      ],
      answer: "(x + 4)/(x − 1)",
    },
    {
      kind: "Factoring before multiplying",
      card: {
        type: "multiple-choice",
        prompt: "Multiply and simplify: (x² − 25)/(x + 3) × (x + 3)/(x − 5)",
        answer: "x + 5",
        choices: ["x + 5", "x − 5", "x + 3", "x − 3"],
      },
      steps: [
        { work: "factor: x² − 25 = (x − 5)(x + 5)", why: "Difference of squares shows the hidden factors." },
        { work: "multiply across: ((x − 5)(x + 5)(x + 3))/((x + 3)(x − 5))", why: "Put every factor on its own side." },
        { work: "cancel (x + 3) and (x − 5), which are on the top and on the bottom", why: "Each matching pair divides out to 1." },
        { work: "x + 5", why: "Only one factor is left." },
      ],
      answer: "x + 5",
    },
    {
      kind: "Monomial fractions, then a value",
      card: { type: "numeric", prompt: "Simplify (6x²/4) × (4/(3x)), then find its value when x = -3.", answer: -6 },
      steps: [
        { work: "multiply across: 24x²/(12x)", why: "6 × 4 = 24 on top, 4 × 3x = 12x on the bottom." },
        { work: "divide the numbers: 24 ÷ 12 = 2", why: "Numbers cancel like any common factor." },
        { work: "cancel one x: x²/x = x, so it is 2x", why: "One x on the bottom cancels one x on top." },
        { work: "at x = -3: 2 × (-3) = -6", why: "Substitute into the simple form." },
      ],
      answer: "-6",
    },
    {
      kind: "Canceling, then a fraction value",
      card: {
        type: "numeric",
        prompt: "Simplify (x − 2)/(x + 3) × (x + 3)/(x + 1), then find its value when x = 4. (write as a fraction or decimal)",
        answer: 0.4,
      },
      steps: [
        { work: "multiply across: ((x − 2)(x + 3))/((x + 3)(x + 1))", why: "Top times top, bottom times bottom." },
        { work: "cancel (x + 3): (x − 2)/(x + 1)", why: "It is on the top and on the bottom." },
        { work: "at x = 4: (4 − 2)/(4 + 1) = 2/5", why: "Work the top and the bottom, then divide." },
      ],
      answer: "2/5",
    },
  ],

  "rational-equations": [
    {
      kind: "A fraction plus a number",
      card: { type: "numeric", prompt: "Solve 12/x + 3 = 7.", answer: 3 },
      steps: [
        { work: "12/x + 3 = 7", why: "Start from the equation as given." },
        { work: "subtract 3 on both sides: 12/x = 7 − 3 = 4", why: "Get the fraction alone first." },
        { work: "multiply both sides by x: 12 = 4x", why: "This clears x out of the bottom." },
        { work: "divide by 4: x = 12 ÷ 4 = 3", why: "Undo the multiplication by 4." },
      ],
      answer: "3",
    },
    {
      kind: "A proportion",
      card: { type: "numeric", prompt: "Solve (x + 4)/6 = 5/3.", answer: 6 },
      steps: [
        { work: "cross-multiply: 3(x + 4) = 6 × 5 = 30", why: "In a proportion, the cross products are equal." },
        { work: "divide by 3: x + 4 = 30 ÷ 3 = 10", why: "Undo the 3 in front of the bracket." },
        { work: "subtract 4: x = 10 − 4 = 6", why: "Undo the +4 by subtracting it." },
      ],
      answer: "6",
    },
    {
      kind: "Spotting an extraneous solution",
      card: {
        type: "multiple-choice",
        prompt: "Solve (x² − 6x + 11)/(x − 1) = 6/(x − 1). Which solution of the cleared equation must be rejected as extraneous?",
        answer: "x = 1",
        choices: ["x = 1", "x = 5", "x = -1", "x = -5"],
      },
      steps: [
        { work: "multiply both sides by (x − 1): x² − 6x + 11 = 6", why: "Clearing the bottom gives an ordinary equation." },
        { work: "subtract 6: x² − 6x + 5 = 0", why: "Get 0 on one side to factor." },
        { work: "factor: (x − 1)(x − 5) = 0, so x = 1 or x = 5", why: "Two numbers that multiply to 5 and add to −6." },
        { work: "x = 1 makes the bottom (x − 1) equal 0, so x = 1 is extraneous", why: "A solution can never make a bottom 0." },
      ],
      answer: "x = 1",
    },
    {
      kind: "Working together",
      card: {
        type: "numeric",
        prompt: "Sam can paint a room in 4 hours and Lee can do it in 6 hours. Working together, how many hours do they need? (round to the nearest tenth)",
        answer: 2.4,
        decimalPlaces: 1,
      },
      steps: [
        { work: "in one hour they do 1/4 + 1/6 of the job", why: "Each person's rate is 1 job over their time." },
        { work: "common bottom 24: 6/24 + 4/24 = 10/24 of the job per hour", why: "Fractions add once the bottoms match." },
        { work: "time = 1 ÷ (10/24) = 24/10 hours", why: "Time is one whole job divided by the rate." },
        { work: "24 ÷ 10 = 2.4 hours", why: "Together they beat the faster person alone." },
      ],
      answer: "2.4",
    },
    {
      kind: "Two fractions equal",
      card: { type: "numeric", prompt: "Solve 3/(x + 2) = 2/(x − 1).", answer: 7 },
      steps: [
        { work: "cross-multiply: 3(x − 1) = 2(x + 2)", why: "Each top multiplies the other side's bottom." },
        { work: "expand: 3x − 3 = 2x + 4", why: "Multiply into each bracket." },
        { work: "collect x on the left and numbers on the right: x = 4 + 3 = 7", why: "Subtract 2x and add 3 on both sides." },
        { work: "x = 7 keeps both bottoms away from 0, so x = 7", why: "Always check the answer does not make a bottom 0." },
      ],
      answer: "7",
    },
  ],
};
