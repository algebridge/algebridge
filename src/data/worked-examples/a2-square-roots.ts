import type { WorkedExamples } from "./types";

/**
 * Algebra 2, unit 1: square roots, up to i. One example per kind of
 * practice card.
 */
export const EXAMPLES: WorkedExamples = {
  "square-roots": [
    {
      kind: "Square root of a perfect square",
      plan: "We need √196, the number that times itself makes 196. The plan: try whole numbers near the answer until one squares to 196.",
      card: { type: "numeric", prompt: "What is √196?", answer: 14 },
      steps: [
        { work: "10 × 10 = 100 and 15 × 15 = 225", why: "196 sits between 100 and 225, so its square root sits between 10 and 15. That narrows the search." },
        { work: "14 × 14 = 196", why: "196 ends in 6, and only numbers ending in 4 or 6 square to a number ending in 6. 14 is the one in range." },
        { work: "√196 = 14", why: "The √ sign means the positive number whose square is 196, so the answer is 14." },
      ],
      answer: "14",
      check: "Multiply it out: 14 × 14 = 140 + 56 = 196. That is the number under the root, so 14 is right.",
    },
    {
      kind: "Solving x² = n",
      plan: "We have x² = 81, so x is a number whose square is 81. The plan: undo the square with a square root and keep both signs, since a negative squared is positive too.",
      card: { type: "multiple-choice", prompt: "Solve x² = 81.", answer: "x = ±9", choices: ["x = ±9", "x = 9", "x = -9", "x = ±81"] },
      steps: [
        { work: "x = ±√81", why: "Taking the square root undoes the square. Two numbers square to 81, so we write ± to keep both of them." },
        { work: "9² = 81 and (-9)² = 81", why: "A negative times a negative is positive, so -9 works just as well as 9." },
        { work: "x = ±9", why: "Both values make the equation true, so the full answer is x = 9 or x = -9, written x = ±9." },
      ],
      answer: "x = ±9",
      check: "Put each one back: 9² = 81 and (-9)² = (-9)(-9) = 81. Both give 81, so both are solutions.",
    },
    {
      kind: "Estimating a square root",
      plan: "We need to place √50 between two whole numbers. The plan: find the perfect squares just below and just above 50, then take their roots.",
      card: { type: "multiple-choice", prompt: "Between which two whole numbers is √50?", answer: "7 and 8", choices: ["7 and 8", "6 and 7", "8 and 9", "25 and 26"] },
      steps: [
        { work: "49 < 50 < 64", why: "49 = 7² is the largest perfect square below 50, and 64 = 8² is the smallest one above it." },
        { work: "√49 < √50 < √64", why: "A bigger number has a bigger square root, so the order stays the same after taking roots." },
        { work: "7 < √50 < 8", why: "√49 = 7 and √64 = 8, so √50 lands between 7 and 8, very close to 7." },
      ],
      answer: "7 and 8",
      check: "Try the edges: 7 × 7 = 49 is a little under 50, and 8 × 8 = 64 is over 50. So √50 is between them.",
    },
  ],

  "negative-square-roots": [
    {
      kind: "A square root with a minus in front",
      plan: "The minus in −√81 sits outside the root. The plan: take the square root of 81 first, then apply the minus to the result.",
      card: { type: "numeric", prompt: "Simplify −√81.", answer: -9 },
      steps: [
        { work: "√81 = 9", why: "The root is worked first, since the minus is outside it. 9 × 9 = 81, so √81 = 9." },
        { work: "−√81 = −9", why: "The minus in front means the opposite of √81, and the opposite of 9 is −9." },
      ],
      answer: "-9",
      check: "−√81 is a real number, −9, and it is the opposite of √81 = 9. Its square, (−9)² = 81, matches the 81 under the root.",
    },
    {
      kind: "A negative under the root",
      plan: "√(−36) asks for a number whose square is −36. The plan: try the real numbers that could work, 6 and −6, and see what their squares are.",
      card: { type: "multiple-choice", prompt: "What is √(−36) in the real numbers?", answer: "Not a real number", choices: ["Not a real number", "-6", "6", "±6"] },
      steps: [
        { work: "6² = 36", why: "A positive times a positive is positive, so 6 squares to 36, the wrong sign." },
        { work: "(−6)² = 36", why: "A negative times a negative is also positive, so −6 squares to 36 as well." },
        { work: "√(−36) is not a real number", why: "Every real number squared is zero or positive, so no real number squares to −36. The next unit builds the number i to fill that gap." },
      ],
      answer: "Not a real number",
      check: "Try any real number you like: 0² = 0, 2² = 4, (−2)² = 4. Each square is zero or positive, so −36 is out of reach.",
    },
    {
      kind: "Minus outside the square",
      plan: "In −8² the square touches only the 8, and the minus waits. The plan: follow the order of operations, exponent first, then the minus.",
      card: { type: "numeric", prompt: "Evaluate −8².", answer: -64 },
      steps: [
        { work: "8² = 64", why: "Exponents come before the minus sign in front, so the 8 is squared first." },
        { work: "−8² = −64", why: "Now the minus applies to the result, giving −64. To square −8 itself you would write (−8)²." },
      ],
      answer: "-64",
      check: "Compare with (−8)² = (−8)(−8) = 64. The parentheses put the minus inside the square, and the answers differ in sign.",
    },
    {
      kind: "Counting real solutions",
      plan: "x² = −16 asks for a real number whose square is −16. The plan: use the fact that every real square is zero or positive.",
      card: { type: "numeric", prompt: "How many real solutions does x² = −16 have?", answer: 0 },
      steps: [
        { work: "x² ≥ 0 for every real x", why: "A real number times itself is positive, or zero when the number is 0. Squares are never negative." },
        { work: "x² = −16 asks for a negative square", why: "The right side is −16, below zero, so it can only equal a square that is negative." },
        { work: "0 real solutions", why: "No real square is negative, so the equation has no real solution. With i it will have two: 4i and −4i." },
      ],
      answer: "0",
      check: "Try the closest guesses: 4² = 16 and (−4)² = 16. Each gives +16, so neither reaches −16.",
    },
  ],

  "simplify-square-roots": [
    {
      kind: "Simplifying a square root",
      plan: "We want √48 with nothing square left inside. The plan: find the largest perfect square that divides 48 and take its root out front.",
      card: { type: "multiple-choice", prompt: "Simplify √48.", answer: "4√3", choices: ["4√3", "16√3", "2√12", "√48"] },
      steps: [
        { work: "48 = 16 · 3", why: "The perfect squares 4, 9, 16, 25 and 36 are worth trying. 16 is the largest one that divides 48." },
        { work: "√48 = √16 · √3", why: "The square root of a product is the product of the square roots, for numbers 0 or above." },
        { work: "√16 · √3 = 4√3", why: "√16 is 4, a whole number, so it comes out front. 3 has no square factor, so √3 stays." },
      ],
      answer: "4√3",
      check: "Square it back: (4√3)² = 16 · 3 = 48. That matches the number under the root, so 4√3 = √48.",
    },
    {
      kind: "Finding the number out front",
      plan: "We write √98 as a√b with b as small as possible, and report a. The plan: pull out the largest perfect square factor of 98.",
      card: { type: "numeric", prompt: "Write √98 as a√b with b as small as possible. What is a?", answer: 7 },
      steps: [
        { work: "98 = 49 · 2", why: "49 is a perfect square, 7², and it divides 98. Its partner 2 has no square factor left." },
        { work: "√98 = √49 · √2", why: "The root of a product splits into the roots of its factors." },
        { work: "√98 = 7√2, so a = 7", why: "√49 = 7 comes out front, and 2 stays inside as b. So the number in front is 7." },
      ],
      answer: "7",
      check: "Square it back: (7√2)² = 49 · 2 = 98, the number we started with.",
    },
    {
      kind: "Spotting a fully simplified root",
      plan: "Only one choice has nothing square left under its root. The plan: look inside each root for a factor of 4, 9, 25 or another perfect square.",
      card: { type: "multiple-choice", prompt: "Which square root is fully simplified: 3√20, 3√45, 3√5 or √45?", answer: "3√5", choices: ["3√20", "3√45", "3√5", "√45"] },
      steps: [
        { work: "20 = 4 · 5 and 45 = 9 · 5", why: "Both 20 and 45 carry a perfect-square factor, so a 2 or a 3 could still come out of them." },
        { work: "5 has no perfect-square factor above 1", why: "5 is prime, so the only square that divides it is 1. Nothing more can come out." },
        { work: "3√5 is fully simplified", why: "Its inside number, 5, is square free, which is what fully simplified means." },
      ],
      answer: "3√5",
      check: "Simplify the others and compare: √45 = 3√5, so √45 was the same number in longer form, and 3√20 = 6√5.",
    },
  ],

  "operations-square-roots": [
    {
      kind: "Adding like roots",
      plan: "Both terms in 4√3 + 6√3 have √3, so they are like terms. The plan: add the numbers in front and keep √3, the way 4x + 6x = 10x.",
      card: { type: "multiple-choice", prompt: "Simplify 4√3 + 6√3.", answer: "10√3", choices: ["10√3", "10√6", "24√3", "10"] },
      steps: [
        { work: "4√3 + 6√3 = (4 + 6)√3", why: "√3 is a common factor of both terms, so the distributive property lets us pull it out." },
        { work: "(4 + 6)√3 = 10√3", why: "4 + 6 = 10, and the √3 stays as it is, the same way x stays when you add 4x and 6x." },
      ],
      answer: "10√3",
      check: "Use decimals: √3 is about 1.732, so 4√3 + 6√3 is about 6.93 + 10.39 = 17.32, and 10√3 is about 17.32 too.",
    },
    {
      kind: "Multiplying roots",
      plan: "We multiply √6 · √24. The plan: use the product rule to put both numbers under one root, then simplify that root.",
      card: { type: "multiple-choice", prompt: "Multiply: √6 · √24.", answer: "12", choices: ["12", "√144", "√30", "144"] },
      steps: [
        { work: "√6 · √24 = √(6 · 24) = √144", why: "For numbers 0 or above, the product of two square roots is the square root of the product." },
        { work: "144 = 12 × 12, a perfect square", why: "12 times itself is 144, so the root comes out as a whole number." },
        { work: "√144 = 12", why: "The √ sign means the positive root, so the product is 12." },
      ],
      answer: "12",
      check: "Simplify first and multiply after: √24 = 2√6, so √6 · 2√6 = 2 · 6 = 12. Same answer both ways.",
    },
    {
      kind: "Squaring a root term",
      plan: "We square 5√2. The plan: square the 5 and the √2 separately, since a product squared is the product of the squares.",
      card: { type: "numeric", prompt: "Simplify (5√2)². Write a plain number.", answer: 50 },
      steps: [
        { work: "(5√2)² = 5² · (√2)²", why: "Squaring a product squares each factor, the same as (3x)² = 9x²." },
        { work: "5² = 25 and (√2)² = 2", why: "Squaring undoes a square root, so (√2)² gives back the 2 that was inside." },
        { work: "25 × 2 = 50", why: "Multiply the two pieces to finish." },
      ],
      answer: "50",
      check: "Write it out long: 5√2 · 5√2 = 25 · √2 · √2 = 25 · 2 = 50.",
    },
    {
      kind: "Squaring a negative root",
      plan: "We square −√7, a negative number. The plan: write it as −√7 times −√7 and use the sign rule, which leads straight to why i is needed.",
      card: { type: "numeric", prompt: "Evaluate (−√7)². Write a plain number.", answer: 7 },
      steps: [
        { work: "(−√7)² = (−√7) · (−√7)", why: "Squaring means multiplying the number by itself, so write both copies." },
        { work: "negative times negative is positive, and √7 · √7 = 7", why: "The two minus signs cancel, and squaring undoes the root." },
        { work: "(−√7)² = 7", why: "So the square is positive. Real squares always land at 0 or above, which is why a square of −7 needs i." },
      ],
      answer: "7",
      check: "Use a decimal: √7 is about 2.646, and (−2.646)² is about 7.00. The square is positive, as the sign rule says.",
    },
  ],
};
