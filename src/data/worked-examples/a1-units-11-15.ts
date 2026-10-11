import type { WorkedExamples } from "./types";

/**
 * Units 11 to 15: polynomials, quadratics, absolute value and piecewise,
 * data and statistics, modeling with functions. One worked example per kind
 * of problem each skill's practice deals, each card written the way its
 * generator writes it so the same solver checks it.
 */
export const EXAMPLES: WorkedExamples = {
  "multiplying-binomials": [
    {
      kind: "Two sums",
      card: {
        type: "multiple-choice",
        prompt: "Expand (x + 3)(x + 5)",
        choices: ["x² + 8x + 15", "x² + 15x + 8", "x² + 15", "x² + 8x + 8"],
        answer: "x² + 8x + 15",
      },
      steps: [
        { work: "first: x × x = x²", why: "FOIL starts with the first term of each bracket." },
        { work: "outer + inner: 5x + 3x = 8x", why: "The outer and inner products are both x terms, so they add." },
        { work: "last: 3 × 5 = 15", why: "The last terms multiply to give the constant." },
        { work: "x² + 8x + 15", why: "Write the terms from the highest power down." },
      ],
      answer: "x² + 8x + 15",
    },
    {
      kind: "A sum times a difference of different numbers",
      card: {
        type: "multiple-choice",
        prompt: "Expand (x + 6)(x − 4)",
        choices: ["x² + 2x − 24", "x² + 10x − 24", "x² + 2x + 24", "x² − 2x − 24"],
        answer: "x² + 2x − 24",
      },
      steps: [
        { work: "first: x × x = x²", why: "Multiply the first terms." },
        { work: "outer: x × (−4) = −4x, inner: 6 × x = 6x", why: "Each product keeps the sign of its number." },
        { work: "−4x + 6x = 2x", why: "Like terms combine into one middle term." },
        { work: "last: 6 × (−4) = −24", why: "A positive times a negative is negative." },
        { work: "x² + 2x − 24", why: "Put the terms together." },
      ],
      answer: "x² + 2x − 24",
    },
    {
      kind: "Numbers in front of both x terms",
      card: {
        type: "multiple-choice",
        prompt: "Expand (2x + 3)(4x − 5)",
        choices: ["8x² + 2x − 15", "8x² + 22x − 15", "8x² − 15", "8x² + 2x + 15"],
        answer: "8x² + 2x − 15",
      },
      steps: [
        { work: "first: 2x × 4x = 8x²", why: "Multiply the numbers and the x's: x times x is x²." },
        { work: "outer: 2x × (−5) = −10x", why: "The minus sign stays with the 5." },
        { work: "inner: 3 × 4x = 12x", why: "Multiply the inside terms." },
        { work: "−10x + 12x = 2x", why: "Combine the two x terms." },
        { work: "last: 3 × (−5) = −15", why: "Positive times negative is negative." },
        { work: "8x² + 2x − 15", why: "Put the terms together." },
      ],
      answer: "8x² + 2x − 15",
    },
    {
      kind: "Only the x coefficient",
      card: {
        type: "numeric",
        prompt: "When (3x − 2)(4x + 5) is multiplied out, what is the coefficient of x?",
        answer: 7,
      },
      steps: [
        { work: "the x term comes from the outer and inner products only", why: "First gives x², last gives the constant." },
        { work: "outer: 3x × 5 = 15x", why: "Multiply the outside terms." },
        { work: "inner: −2 × 4x = −8x", why: "The −2 brings its minus sign along." },
        { work: "15x − 8x = 7x", why: "Combine the x terms; the number in front is the coefficient." },
      ],
      answer: "7",
    },
    {
      kind: "Area of a rectangle",
      card: {
        type: "multiple-choice",
        prompt: "A garden is (x + 4) feet long and (2x − 3) feet wide. Which expression gives its area, in square feet?",
        choices: ["2x² + 5x − 12", "2x² − 12", "2x² + 11x − 12", "2x² + 5x + 12"],
        answer: "2x² + 5x − 12",
      },
      steps: [
        { work: "area = (x + 4)(2x − 3), first: x × 2x = 2x²", why: "Area is length times width, so multiply the brackets." },
        { work: "outer: x × (−3) = −3x", why: "The minus sign stays with the 3." },
        { work: "inner: 4 × 2x = 8x", why: "Multiply the inside terms." },
        { work: "8x − 3x = 5x", why: "Combine the two x terms." },
        { work: "last: 4 × (−3) = −12", why: "Positive times negative is negative." },
        { work: "2x² + 5x − 12", why: "Put the terms together." },
      ],
      answer: "2x² + 5x − 12",
    },
    {
      kind: "A binomial times a trinomial",
      card: {
        type: "multiple-choice",
        prompt: "Expand (x + 2)(x² − 3x + 4)",
        choices: ["x³ − x² − 2x + 8", "x³ − 3x² + 4x + 8", "x³ − x² + 4x + 8", "x³ + 5x² − 2x + 8"],
        answer: "x³ − x² − 2x + 8",
      },
      steps: [
        { work: "x(x² − 3x + 4) = x³ − 3x² + 4x", why: "x multiplies every term of the trinomial." },
        { work: "2(x² − 3x + 4) = 2x² − 6x + 8", why: "The 2 multiplies every term too." },
        { work: "x² terms: 2x² − 3x² = -x²", why: "Combine terms with the same power." },
        { work: "x terms: 4x − 6x = -2x", why: "Combine the x terms the same way." },
        { work: "x³ − x² − 2x + 8", why: "Put the terms together, highest power first." },
      ],
      answer: "x³ − x² − 2x + 8",
    },
  ],

  "special-products": [
    {
      kind: "Squaring a sum",
      card: {
        type: "multiple-choice",
        prompt: "Expand (x + 7)²",
        choices: ["x² + 14x + 49", "x² + 49", "x² + 7x + 49", "x² + 14x + 14"],
        answer: "x² + 14x + 49",
      },
      steps: [
        { work: "(a + b)² = a² + 2ab + b², with a = x and b = 7", why: "Squaring a sum always has a middle term." },
        { work: "a² = x²", why: "Square the first term." },
        { work: "2ab = 2(x)(7) = 14x", why: "The middle term is twice the product of the two terms." },
        { work: "b² = 7² = 49", why: "Square the last term." },
        { work: "x² + 14x + 49", why: "Put the terms together." },
      ],
      answer: "x² + 14x + 49",
    },
    {
      kind: "Squaring a difference",
      card: {
        type: "multiple-choice",
        prompt: "Expand (x − 5)²",
        choices: ["x² − 10x + 25", "x² − 25", "x² + 10x + 25", "x² − 10x − 25"],
        answer: "x² − 10x + 25",
      },
      steps: [
        { work: "(a − b)² = a² − 2ab + b², with a = x and b = 5", why: "Squaring a difference has a minus middle term." },
        { work: "a² = x²", why: "Square the first term." },
        { work: "−2ab = −2(x)(5) = −10x", why: "Twice the product, with the minus sign." },
        { work: "b² = 5² = 25", why: "(−5)² is positive, so the last term is added." },
        { work: "x² − 10x + 25", why: "Put the terms together." },
      ],
      answer: "x² − 10x + 25",
    },
    {
      kind: "Squaring with a number on x",
      card: {
        type: "multiple-choice",
        prompt: "Expand (3x − 4)²",
        choices: ["9x² − 24x + 16", "9x² + 16", "9x² − 12x + 16", "3x² − 24x + 16"],
        answer: "9x² − 24x + 16",
      },
      steps: [
        { work: "(A − B)² = A² − 2AB + B², with A = 3x and B = 4", why: "The whole 3x is the first term." },
        { work: "A² = (3x)² = 9x²", why: "The 3 gets squared along with the x." },
        { work: "−2AB = −2(3x)(4) = −24x", why: "Twice the product, with the minus sign." },
        { work: "B² = 4² = 16", why: "A square is never negative." },
        { work: "9x² − 24x + 16", why: "Put the terms together." },
      ],
      answer: "9x² − 24x + 16",
    },
    {
      kind: "A sum times a difference",
      card: {
        type: "multiple-choice",
        prompt: "Expand (2x + 9)(2x − 9)",
        choices: ["4x² − 81", "2x² − 81", "4x² + 81", "4x² − 18"],
        answer: "4x² − 81",
      },
      steps: [
        { work: "(A + B)(A − B) = A² − B², with A = 2x and B = 9", why: "The middle terms cancel: +18x and −18x." },
        { work: "A² = (2x)² = 4x²", why: "Square the whole first term." },
        { work: "B² = 9² = 81", why: "Square the second term." },
        { work: "4x² − 81", why: "Subtract the squares." },
      ],
      answer: "4x² − 81",
    },
    {
      kind: "Mental math with a sum times a difference",
      card: {
        type: "numeric",
        prompt: "Use (a − b)(a + b) = a² − b² to work out 47 × 53 without a calculator.",
        answer: 2491,
      },
      steps: [
        { work: "47 × 53 = (50 − 3)(50 + 3)", why: "Both numbers are 3 away from 50." },
        { work: "= 50² − 3²", why: "A sum times a difference is a difference of squares." },
        { work: "50² = 2500 and 3² = 9", why: "Round numbers are easy to square." },
        { work: "2500 − 9 = 2491", why: "Subtract the smaller square." },
      ],
      answer: "2491",
    },
    {
      kind: "Mental math with a square",
      card: {
        type: "numeric",
        prompt: "Use (a + b)² = a² + 2ab + b² to work out 62² without a calculator.",
        answer: 3844,
      },
      steps: [
        { work: "62 = 60 + 2, so a = 60 and b = 2", why: "Split the number into a round part and a small part." },
        { work: "62² = 60² + 2(60)(2) + 2²", why: "Use the square of a sum." },
        { work: "= 3600 + 240 + 4", why: "Work out each piece." },
        { work: "= 3844", why: "Add them up." },
      ],
      answer: "3844",
    },
  ],

  "factoring-trinomials": [
    {
      kind: "Two positive numbers",
      card: {
        type: "multiple-choice",
        prompt: "Factor x² + 7x + 12",
        choices: ["(x + 3)(x + 4)", "(x − 4)(x − 3)", "(x + 2)(x + 6)", "(x + 1)(x + 12)"],
        answer: "(x + 3)(x + 4)",
      },
      steps: [
        { work: "find two numbers that multiply to 12 and add to 7", why: "Their product is the constant and their sum the middle number." },
        { work: "3 × 4 = 12", why: "Check the product first." },
        { work: "3 + 4 = 7", why: "Then check the sum; both must work." },
        { work: "x² + 7x + 12 = (x + 3)(x + 4)", why: "Each number goes in its own bracket." },
      ],
      answer: "(x + 3)(x + 4)",
    },
    {
      kind: "Numbers with different signs",
      card: {
        type: "multiple-choice",
        prompt: "Factor x² − 2x − 15",
        choices: ["(x − 5)(x + 3)", "(x − 3)(x + 5)", "(x − 6)(x + 4)", "(x − 15)(x + 1)"],
        answer: "(x − 5)(x + 3)",
      },
      steps: [
        { work: "find two numbers that multiply to −15 and add to −2", why: "A negative product means the signs differ." },
        { work: "-5 × 3 = −15", why: "Check the product." },
        { work: "-5 + 3 = −2", why: "The bigger number takes the minus, so the sum is negative." },
        { work: "x² − 2x − 15 = (x − 5)(x + 3)", why: "Each number goes in its own bracket." },
      ],
      answer: "(x − 5)(x + 3)",
    },
    {
      kind: "A number in front of x²",
      card: {
        type: "multiple-choice",
        prompt: "Factor 3x² + 10x − 8",
        choices: ["(3x − 2)(x + 4)", "(3x + 4)(x − 2)", "(3x + 2)(x − 4)", "(3x − 2)(x − 4)"],
        answer: "(3x − 2)(x + 4)",
      },
      steps: [
        { work: "the first terms must be 3x and x, and the last numbers must multiply to −8", why: "First terms make 3x²; last terms make the constant." },
        { work: "try 3x with -2 and x with 4: outer 3x × 4 = 12x, inner (-2) × x = -2x", why: "Test a pair by finding the outer and inner products." },
        { work: "12x − 2x = 10x, the middle term we need", why: "The pair works when the middle term matches." },
        { work: "so 3x² + 10x − 8 = (3x − 2)(x + 4)", why: "Write the pair that worked." },
      ],
      answer: "(3x − 2)(x + 4)",
    },
    {
      kind: "A common factor first",
      card: {
        type: "multiple-choice",
        prompt: "Factor completely: 2x² + 2x − 24",
        choices: ["2(x − 3)(x + 4)", "(x − 3)(x + 4)", "2(x + 3)(x − 4)", "(2x − 3)(2x + 4)"],
        answer: "2(x − 3)(x + 4)",
      },
      steps: [
        { work: "every term divides by 2: 2x² + 2x − 24 = 2(x² + x − 12)", why: "Always take out a common factor first." },
        { work: "two numbers that multiply to −12 and add to 1: -3 and 4", why: "Factor what is left inside the bracket." },
        { work: "x² + x − 12 = (x − 3)(x + 4)", why: "Each number goes in its own bracket." },
        { work: "keep the 2 in front: 2(x − 3)(x + 4)", why: "The common factor is part of the answer." },
      ],
      answer: "2(x − 3)(x + 4)",
    },
    {
      kind: "A missing side of a rectangle",
      card: {
        type: "multiple-choice",
        prompt: "A rectangle has area x² + 2x − 15 and width (x + 5). Which expression is its length?",
        choices: ["(x − 3)", "(x + 3)", "(x − 2)", "(x − 15)"],
        answer: "(x − 3)",
      },
      steps: [
        { work: "area = length × width, so x² + 2x − 15 = (x + 5) × length", why: "The length is the other factor of the area." },
        { work: "two numbers that multiply to −15 and add to 2: 5 and (-3)", why: "One of them, 5, is already in the width." },
        { work: "x² + 2x − 15 = (x + 5)(x − 3)", why: "Write the full factored form." },
        { work: "the length is the other factor: (x − 3)", why: "Take away the width's factor." },
      ],
      answer: "(x − 3)",
    },
  ],

  "factoring-special": [
    {
      kind: "A difference of squares",
      card: {
        type: "multiple-choice",
        prompt: "Factor x² − 49",
        choices: ["(x + 7)(x − 7)", "(x − 7)²", "(x + 7)²", "Cannot factor"],
        answer: "(x + 7)(x − 7)",
      },
      steps: [
        { work: "x² = (x)² and 49 = 7²", why: "Both terms are perfect squares." },
        { work: "a difference of squares: A² − B² = (A + B)(A − B), with A = x and B = 7", why: "A square minus a square always factors this way." },
        { work: "x² − 49 = (x + 7)(x − 7)", why: "One bracket adds, the other subtracts." },
      ],
      answer: "(x + 7)(x − 7)",
    },
    {
      kind: "A perfect square with a plus",
      card: {
        type: "multiple-choice",
        prompt: "Factor x² + 12x + 36",
        choices: ["(x + 6)²", "(x − 6)²", "(x + 6)(x − 6)", "(x + 12)(x + 1)"],
        answer: "(x + 6)²",
      },
      steps: [
        { work: "x² = (x)² and 36 = 6²", why: "The first and last terms are squares." },
        { work: "the middle term checks: 2 × x × 6 = 12x, with a plus", why: "A perfect square's middle is twice the product." },
        { work: "A² + 2AB + B² = (A + B)², so x² + 12x + 36 = (x + 6)²", why: "A plus in the middle means a sum is squared." },
      ],
      answer: "(x + 6)²",
    },
    {
      kind: "A perfect square with a minus",
      card: {
        type: "multiple-choice",
        prompt: "Factor x² − 10x + 25",
        choices: ["(x − 5)²", "(x + 5)²", "(x + 5)(x − 5)", "(x − 10)(x − 1)"],
        answer: "(x − 5)²",
      },
      steps: [
        { work: "x² = (x)² and 25 = 5²", why: "The first and last terms are squares." },
        { work: "the middle term checks: 2 × x × 5 = 10x, with a minus", why: "A perfect square's middle is twice the product." },
        { work: "A² − 2AB + B² = (A − B)², so x² − 10x + 25 = (x − 5)²", why: "A minus in the middle means a difference is squared." },
      ],
      answer: "(x − 5)²",
    },
    {
      kind: "A difference of squares with a number on x",
      card: {
        type: "multiple-choice",
        prompt: "Factor 9x² − 16",
        choices: ["(3x + 4)(3x − 4)", "(3x − 4)²", "(9x + 4)(x − 4)", "Cannot factor"],
        answer: "(3x + 4)(3x − 4)",
      },
      steps: [
        { work: "9x² = (3x)² and 16 = 4²", why: "Take the square root of each term." },
        { work: "A² − B² = (A + B)(A − B), with A = 3x and B = 4", why: "A square minus a square factors into a sum and a difference." },
        { work: "9x² − 16 = (3x + 4)(3x − 4)", why: "Write both brackets." },
      ],
      answer: "(3x + 4)(3x − 4)",
    },
    {
      kind: "A common factor, then a difference of squares",
      card: {
        type: "multiple-choice",
        prompt: "Factor completely: 3x² − 75",
        choices: ["3(x + 5)(x − 5)", "(x + 5)(x − 5)", "3(x − 5)²", "3(x + 5)²"],
        answer: "3(x + 5)(x − 5)",
      },
      steps: [
        { work: "both terms divide by 3: 3x² − 75 = 3(x² − 25)", why: "Take out the common factor first." },
        { work: "25 = 5², so x² − 25 = (x + 5)(x − 5)", why: "What is left is a difference of squares." },
        { work: "keep the 3 in front: 3(x + 5)(x − 5)", why: "The common factor stays in the answer." },
      ],
      answer: "3(x + 5)(x − 5)",
    },
    {
      kind: "A difference of squares twice over",
      card: {
        type: "multiple-choice",
        prompt: "Factor completely: x⁴ − 16",
        choices: ["(x² + 4)(x + 2)(x − 2)", "(x² + 4)(x − 2)²", "(x² − 4)²", "(x² + 4)²"],
        answer: "(x² + 4)(x + 2)(x − 2)",
      },
      steps: [
        { work: "x⁴ = (x²)² and 16 = 4²", why: "Both terms are squares." },
        { work: "x⁴ − 16 = (x² + 4)(x² − 4)", why: "Factor the difference of squares once." },
        { work: "x² − 4 = (x + 2)(x − 2), and x² + 4 stays", why: "One factor is a difference of squares again; a sum is not." },
        { work: "(x² + 4)(x + 2)(x − 2)", why: "Factored completely means nothing left will factor." },
      ],
      answer: "(x² + 4)(x + 2)(x − 2)",
    },
  ],

  "graphing-parabolas": [
    {
      kind: "Which way it opens",
      card: {
        type: "multiple-choice",
        prompt: "Does y = -2x² + 5 open up or down?",
        choices: ["Up", "Down", "Left", "Right"],
        answer: "Down",
      },
      steps: [
        { work: "a = -2, the number in front of x²", why: "The sign of a decides the direction." },
        { work: "a is negative, so it opens down", why: "Positive a opens up; negative a opens down." },
      ],
      answer: "Down",
    },
    {
      kind: "Vertex from vertex form",
      card: {
        type: "numeric",
        prompt: "What is the x-coordinate of the vertex of y = (x + 3)² − 4?",
        answer: -3,
      },
      steps: [
        { work: "y = (x − h)² + k has vertex (h, k)", why: "Vertex form shows the vertex directly." },
        { work: "x + 3 = x − (−3), so h = −3", why: "The sign inside the bracket is the opposite of h." },
        { work: "the vertex is (−3, −4), so x = −3", why: "Read the x-coordinate from h." },
      ],
      answer: "-3",
    },
    {
      kind: "Axis of symmetry",
      card: {
        type: "numeric",
        prompt: "The axis of symmetry of y = x² − 8x + 3 is the line x = k. What is k?",
        answer: 4,
      },
      steps: [
        { work: "a = 1 and b = −8", why: "Read a and b from the equation." },
        { work: "x = −b / (2a) = −(−8) / (2 × 1)", why: "This rule gives the axis of symmetry." },
        { work: "= 8 / 2 = 4", why: "Minus a negative is a positive." },
      ],
      answer: "4",
    },
    {
      kind: "Height of the vertex from standard form",
      card: {
        type: "numeric",
        prompt: "What is the y-coordinate of the vertex of y = 2x² − 12x + 13?",
        answer: -5,
      },
      steps: [
        { work: "x = −(−12) / (2 × 2) = 3", why: "The vertex's x comes from −b / (2a)." },
        { work: "y = 2(3)² − 36 + 13 = 18 − 36 + 13 = -5", why: "Put that x into the equation for the height." },
      ],
      answer: "-5",
    },
    {
      kind: "Vertex from standard form",
      card: {
        type: "multiple-choice",
        prompt: "What is the vertex of y = x² + 4x + 1?",
        choices: ["(-2, -3)", "(2, -3)", "(-2, 1)", "(-3, -2)"],
        answer: "(-2, -3)",
      },
      steps: [
        { work: "x = −(4) / (2 × 1) = -2", why: "The vertex's x comes from −b / (2a)." },
        { work: "y = (-2)² + 4(-2) + 1 = 4 − 8 + 1 = -3", why: "Put that x back in to find the height." },
        { work: "vertex (-2, -3)", why: "Write x first, then y." },
      ],
      answer: "(-2, -3)",
    },
    {
      kind: "Where it crosses the x-axis",
      card: {
        type: "numeric",
        prompt: "The parabola y = x² − 2x − 8 crosses the x-axis twice. What is the larger x-intercept?",
        answer: 4,
      },
      steps: [
        { work: "0 = x² − 2x − 8", why: "On the x-axis, y is 0." },
        { work: "0 = (x − 4)(x + 2)", why: "−4 and 2 multiply to −8 and add to −2." },
        { work: "x = 4 or x = −2", why: "Each bracket can be zero." },
        { work: "the larger is 4", why: "Pick the one the question asks for." },
      ],
      answer: "4",
    },
    {
      kind: "Highest point of a thrown ball",
      card: {
        type: "numeric",
        prompt: "A ball's height is h = -16t² + 64t + 5 feet after t seconds. What is its greatest height, in feet?",
        answer: 69,
      },
      steps: [
        { work: "t = −64 / (2 × -16) = 2", why: "The top is at the vertex, t = −b / (2a)." },
        { work: "h = -16(2)² + 64(2) + 5", why: "Put that time into the height rule." },
        { work: "= -64 + 128 + 5 = 69 feet", why: "Square first, then multiply, then add." },
      ],
      answer: "69",
    },
  ],

  "solving-by-factoring": [
    {
      kind: "Factor and pick a root",
      card: {
        type: "numeric",
        prompt: "Solve x² − 3x − 10 = 0. What is the larger root?",
        answer: 5,
      },
      steps: [
        { work: "two numbers that multiply to −10 and add to −3: −5 and 2", why: "Factor the left side first." },
        { work: "(x − 5)(x + 2) = 0", why: "Write it as two brackets." },
        { work: "x − 5 = 0 or x + 2 = 0", why: "A product is zero only when a factor is zero." },
        { work: "x = 5 or x = −2, so the larger root is 5", why: "Solve each and pick the larger." },
      ],
      answer: "5",
    },
    {
      kind: "A difference of squares",
      card: {
        type: "numeric",
        prompt: "Solve x² − 64 = 0. What is the positive root?",
        answer: 8,
      },
      steps: [
        { work: "x² − 64 = (x + 8)(x − 8)", why: "64 is 8², so it is a difference of squares." },
        { work: "(x + 8)(x − 8) = 0", why: "Set the factored form equal to zero." },
        { work: "x = −8 or x = 8, so the positive root is 8", why: "Each factor gives one root." },
      ],
      answer: "8",
    },
    {
      kind: "Move everything to one side first",
      card: {
        type: "numeric",
        prompt: "Solve x² + 2x = 24. What is the positive root?",
        answer: 4,
      },
      steps: [
        { work: "x² + 2x − 24 = 0", why: "Subtract 24 so one side is zero." },
        { work: "(x − 4)(x + 6) = 0", why: "−4 and 6 multiply to −24 and add to 2." },
        { work: "x = 4 or x = −6", why: "Set each factor equal to zero." },
        { work: "the positive root is 4", why: "Pick the one the question asks for." },
      ],
      answer: "4",
    },
    {
      kind: "A square equal to a number",
      card: {
        type: "numeric",
        prompt: "Solve x² = 36. What is the positive root?",
        answer: 6,
      },
      steps: [
        { work: "x² = 36", why: "x times itself is 36." },
        { work: "x = 6 or x = −6", why: "Both 6 × 6 and (−6) × (−6) make 36." },
        { work: "the positive root is 6", why: "Pick the one the question asks for." },
      ],
      answer: "6",
    },
    {
      kind: "A root that is a fraction",
      card: {
        type: "numeric",
        prompt: "Solve 2x² + 7x + 3 = 0. One root is a fraction. What is that root? Give it as a fraction.",
        answer: -0.5,
      },
      steps: [
        { work: "(2x + 1)(x + 3) = 0", why: "Outer 6x plus inner x gives 7x." },
        { work: "2x + 1 = 0 or x + 3 = 0", why: "Set each factor equal to zero." },
        { work: "2x = −1, so x = −1/2", why: "Move the 1 across, then divide by 2." },
      ],
      answer: "-1/2",
    },
    {
      kind: "A rectangle's width from its area",
      card: {
        type: "numeric",
        prompt: "A rectangle's length is 3 meters more than its width. Its area is 40 square meters. What is its width, in meters?",
        answer: 5,
      },
      steps: [
        { work: "w(w + 3) = 40", why: "Width times length is the area." },
        { work: "w² + 3w − 40 = 0", why: "Multiply out and move 40 across." },
        { work: "(w − 5)(w + 8) = 0", why: "−5 and 8 multiply to −40 and add to 3." },
        { work: "w = 5 or w = −8, so w = 5 meters", why: "A width cannot be negative." },
      ],
      answer: "5",
    },
    {
      kind: "Factor out x",
      card: {
        type: "numeric",
        prompt: "Solve 3x² = 12x. What is the nonzero root?",
        answer: 4,
      },
      steps: [
        { work: "3x² − 12x = 0", why: "Move everything to one side; never divide by x." },
        { work: "3x(x − 4) = 0", why: "Both terms share 3x." },
        { work: "x = 0 or x = 4, so the nonzero root is 4", why: "Set each factor equal to zero." },
      ],
      answer: "4",
    },
  ],

  "completing-square": [
    {
      kind: "The number that completes the square",
      card: {
        type: "multiple-choice",
        prompt: "Complete the square: x² + 10x + ___ = (x + 5)²",
        choices: ["25", "10", "5", "100"],
        answer: "25",
      },
      steps: [
        { work: "half of 10 is 5", why: "Take half of the x coefficient." },
        { work: "5² = 25", why: "Square it to get the missing number." },
      ],
      answer: "25",
    },
    {
      kind: "Solving by completing the square",
      card: {
        type: "numeric",
        prompt: "Solve x² + 6x − 16 = 0 by completing the square. What is the larger root?",
        answer: 2,
      },
      steps: [
        { work: "x² + 6x = 16", why: "Move the constant to the right side." },
        { work: "x² + 6x + 9 = 16 + 9", why: "Add (6/2)² = 9 to both sides." },
        { work: "(x + 3)² = 25", why: "The left side is now a perfect square." },
        { work: "x + 3 = ±5", why: "Take the square root of both sides, both signs." },
        { work: "x = 2 or x = −8, so the larger root is 2", why: "Subtract 3 from each." },
      ],
      answer: "2",
    },
    {
      kind: "The k in vertex form",
      card: {
        type: "numeric",
        prompt: "Write x² − 8x + 5 in the form (x − h)² + k. What is k?",
        answer: -11,
      },
      steps: [
        { work: "half of −8 is −4, and (−4)² = 16", why: "This is the number that makes a square." },
        { work: "x² − 8x + 5 = (x² − 8x + 16) + 5 − 16", why: "Add 16 and take it away, so nothing changes." },
        { work: "= (x − 4)² − 11, so k = −11", why: "5 − 16 = −11 is left outside the square." },
      ],
      answer: "-11",
    },
    {
      kind: "The minimum value",
      card: {
        type: "numeric",
        prompt: "What is the minimum value of y = x² + 6x + 2?",
        answer: -7,
      },
      steps: [
        { work: "half of 6 is 3, and 3² = 9", why: "Find the number that completes the square." },
        { work: "y = (x² + 6x + 9) + 2 − 9 = (x + 3)² − 7", why: "Add 9 and take it away again." },
        { work: "(x + 3)² is never below 0, so the minimum value is −7", why: "The smallest a square can be is 0." },
      ],
      answer: "-7",
    },
    {
      kind: "The whole vertex form",
      card: {
        type: "multiple-choice",
        prompt: "Which is x² − 4x + 7 written in vertex form?",
        choices: ["(x − 2)² + 3", "(x − 2)² + 7", "(x + 2)² + 3", "(x − 2)² + 11"],
        answer: "(x − 2)² + 3",
      },
      steps: [
        { work: "half of −4 is −2, and (−2)² = 4", why: "Find the number that completes the square." },
        { work: "x² − 4x + 7 = (x² − 4x + 4) + 7 − 4", why: "Add 4 and take it away again." },
        { work: "= (x − 2)² + 3", why: "Write the square and what is left over." },
      ],
      answer: "(x − 2)² + 3",
    },
  ],

  "quadratic-formula": [
    {
      kind: "How many real solutions",
      card: {
        type: "multiple-choice",
        prompt: "For x² + 4x + 7 = 0, how many real solutions?",
        choices: ["0", "1", "2", "Infinitely many"],
        answer: "0",
      },
      steps: [
        { work: "a = 1, b = 4, c = 7", why: "Read the three numbers from the equation." },
        { work: "b² − 4ac = 4² − 4(1)(7) = 16 − 28 = −12", why: "The discriminant tells how many solutions." },
        { work: "negative, so 0 real solutions", why: "No real number squares to a negative." },
      ],
      answer: "0",
    },
    {
      kind: "Whole-number roots",
      card: {
        type: "numeric",
        prompt: "Solve x² − 2x − 15 = 0. What is the smaller root?",
        answer: -3,
      },
      steps: [
        { work: "a = 1, b = −2, c = −15", why: "Read the numbers from the equation." },
        { work: "b² − 4ac = 4 + 60 = 64, and √64 = 8", why: "Work out the discriminant first." },
        { work: "x = (2 ± 8) / 2", why: "The formula starts with −b, which is 2." },
        { work: "x = 5 or x = −3, so the smaller root is −3", why: "The minus sign gives the smaller root." },
      ],
      answer: "-3",
    },
    {
      kind: "Roots that need rounding",
      card: {
        type: "numeric",
        prompt: "Solve x² + 3x − 5 = 0 with the quadratic formula. What is the larger root? (round to the hundredths place)",
        answer: 1.19,
        decimalPlaces: 2,
      },
      steps: [
        { work: "a = 1, b = 3, c = −5", why: "Read the numbers from the equation." },
        { work: "b² − 4ac = 9 + 20 = 29", why: "Minus 4 times a negative adds." },
        { work: "x = (−3 + √29) / 2", why: "The plus sign gives the larger root." },
        { work: "≈ (−3 + 5.385) / 2 ≈ 1.19", why: "Round only at the end." },
      ],
      answer: "1.19",
    },
    {
      kind: "The discriminant",
      card: {
        type: "numeric",
        prompt: "What is the discriminant of 2x² − 5x − 3 = 0?",
        answer: 49,
      },
      steps: [
        { work: "a = 2, b = −5, c = −3", why: "Read the numbers with their signs." },
        { work: "b² − 4ac = (-5)² − 4(2)(-3)", why: "Put them into the discriminant." },
        { work: "= 25 − (-24) = 49", why: "Subtracting a negative adds." },
      ],
      answer: "49",
    },
    {
      kind: "When a thrown ball lands",
      card: {
        type: "numeric",
        prompt: "A ball is thrown upward from 6 feet with a speed of 40 feet per second, so its height is h = -16t² + 40t + 6. After how many seconds does it hit the ground? (round to the hundredths place)",
        answer: 2.64,
        decimalPlaces: 2,
      },
      steps: [
        { work: "0 = -16t² + 40t + 6, with a = -16, b = 40, c = 6", why: "It hits the ground when the height is 0." },
        { work: "b² − 4ac = 1600 + 384 = 1984", why: "Minus 4 times a negative adds." },
        { work: "t = (−40 − √1984) / (-32)", why: "This root gives a positive time." },
        { work: "≈ (−40 − 44.54) / (-32) ≈ 2.64 seconds", why: "Round only at the end." },
      ],
      answer: "2.64",
    },
  ],

  "absolute-value": [
    {
      kind: "Two solutions from one equation",
      card: {
        type: "numeric",
        prompt: "Solve |x − 3| = 7. What is the smaller solution?",
        answer: -4,
      },
      steps: [
        { work: "x − 3 = 7 or x − 3 = −7", why: "The inside is 7 away from zero, either way." },
        { work: "x = 10 or x = −4", why: "Add 3 to both sides of each." },
        { work: "the smaller solution is −4", why: "Pick the one the question asks for." },
      ],
      answer: "-4",
    },
    {
      kind: "Get the absolute value alone first",
      card: {
        type: "numeric",
        prompt: "Solve 3|x + 2| − 4 = 11. What is the larger solution?",
        answer: 3,
      },
      steps: [
        { work: "3|x + 2| = 15", why: "Add 4 to both sides." },
        { work: "|x + 2| = 5", why: "Divide by 3 so the absolute value is alone." },
        { work: "x + 2 = 5 or x + 2 = −5", why: "Split into two equations." },
        { work: "x = 3 or x = −7, so the larger is 3", why: "Subtract 2 from each." },
      ],
      answer: "3",
    },
    {
      kind: "A negative number in front",
      card: {
        type: "numeric",
        prompt: "Solve -2|x − 1| + 9 = 1. What is the smaller solution?",
        answer: -3,
      },
      steps: [
        { work: "-2|x − 1| = −8", why: "Subtract 9 from both sides." },
        { work: "|x − 1| = 4", why: "Divide by -2; a negative over a negative is positive." },
        { work: "x − 1 = 4 or x − 1 = −4", why: "Split into two equations." },
        { work: "x = 5 or x = −3, so the smaller is −3", why: "Add 1 to each." },
      ],
      answer: "-3",
    },
    {
      kind: "A number on x inside the bars",
      card: {
        type: "numeric",
        prompt: "Solve |2x − 3| = 6. What is the larger solution? Give it as a whole number or a fraction.",
        answer: 4.5,
      },
      steps: [
        { work: "2x − 3 = 6 or 2x − 3 = −6", why: "Split into two equations." },
        { work: "2x = 9 or 2x = −3", why: "Add 3 to both sides of each." },
        { work: "x = 9/2 or x = −3/2", why: "Divide each by 2." },
        { work: "the larger solution is 9/2", why: "9/2 is positive, so it is larger." },
      ],
      answer: "9/2",
    },
    {
      kind: "Just |x|",
      card: {
        type: "numeric",
        prompt: "Solve |x| = 12. What is the negative solution?",
        answer: -12,
      },
      steps: [
        { work: "|x| = 12 means x = 12 or x = −12", why: "Both numbers are 12 away from zero." },
        { work: "the negative solution is −12", why: "Pick the one the question asks for." },
      ],
      answer: "-12",
    },
    {
      kind: "How many solutions",
      card: {
        type: "multiple-choice",
        prompt: "How many solutions does 2|x − 4| + 7 = 3 have?",
        choices: ["0", "1", "2", "Infinitely many"],
        answer: "0",
      },
      steps: [
        { work: "2|x − 4| = −4", why: "Subtract 7 from both sides." },
        { work: "|x − 4| = −2", why: "Divide by 2 so the absolute value is alone." },
        { work: "an absolute value is never negative: 0 solutions", why: "A distance from zero cannot be negative." },
      ],
      answer: "0",
    },
  ],

  "absolute-value-inequalities": [
    {
      kind: "Greater than a distance",
      card: {
        type: "multiple-choice",
        prompt: "Solve |x| > 6",
        choices: ["x < −6 or x > 6", "−6 < x < 6", "x > 6", "x < −6"],
        answer: "x < −6 or x > 6",
      },
      steps: [
        { work: "|x| > 6 means x is more than 6 away from 0", why: "Absolute value is distance from zero." },
        { work: "x < −6 or x > 6", why: "Far from zero happens on both sides: two rays." },
      ],
      answer: "x < −6 or x > 6",
    },
    {
      kind: "Within a distance of a center",
      card: {
        type: "multiple-choice",
        prompt: "Solve |x − 2| ≤ 5",
        choices: ["-3 ≤ x ≤ 7", "-4 ≤ x ≤ 8", "x ≤ -3", "-5 ≤ x ≤ 5"],
        answer: "-3 ≤ x ≤ 7",
      },
      steps: [
        { work: "−5 ≤ x − 2 ≤ 5", why: "Less than a distance means between two values." },
        { work: "add 2 in all three parts: −3 ≤ x ≤ 7", why: "Whatever happens to the middle happens to both ends." },
      ],
      answer: "-3 ≤ x ≤ 7",
    },
    {
      kind: "A number on x inside the bars",
      card: {
        type: "multiple-choice",
        prompt: "Solve |2x − 6| ≤ 4",
        choices: ["1 ≤ x ≤ 5", "2 ≤ x ≤ 10", "x ≤ 1 or x ≥ 5", "-2 ≤ x ≤ 2"],
        answer: "1 ≤ x ≤ 5",
      },
      steps: [
        { work: "-4 ≤ 2x − 6 ≤ 4", why: "Rewrite as a between statement." },
        { work: "2 ≤ 2x ≤ 10", why: "Add 6 in all three parts." },
        { work: "1 ≤ x ≤ 5", why: "Divide all three parts by 2." },
      ],
      answer: "1 ≤ x ≤ 5",
    },
    {
      kind: "Get the absolute value alone, then two rays",
      card: {
        type: "multiple-choice",
        prompt: "Solve 2|x + 1| − 3 > 7",
        choices: ["x < -6 or x > 4", "-6 < x < 4", "x < -5 or x > 5", "x < -4 or x > 6"],
        answer: "x < -6 or x > 4",
      },
      steps: [
        { work: "2|x + 1| > 10", why: "Add 3 to both sides." },
        { work: "|x + 1| > 5", why: "Divide by 2 so the absolute value is alone." },
        { work: "x + 1 < −5 or x + 1 > 5", why: "Greater than a distance gives two rays." },
        { work: "x < -6 or x > 4", why: "Subtract 1 from each." },
      ],
      answer: "x < -6 or x > 4",
    },
    {
      kind: "A tolerance as an absolute value",
      card: {
        type: "multiple-choice",
        prompt: "A machine fills bags with 500 grams of rice, give or take 5 grams. Which inequality shows the weights w that pass?",
        choices: ["|w − 500| ≤ 5", "|w − 500| ≥ 5", "|w + 500| ≤ 5", "|w − 5| ≤ 500"],
        answer: "|w − 500| ≤ 5",
      },
      steps: [
        { work: "|w − 500| is how far a bag is from 500 grams", why: "Distance from the target is an absolute value." },
        { work: "a passing bag is at most 5 away: |w − 500| ≤ 5", why: "At most means less than or equal to." },
        { work: "so 495 ≤ w ≤ 505", why: "Check: those are the weights within 5 grams." },
      ],
      answer: "|w − 500| ≤ 5",
    },
  ],

  "piecewise-functions": [
    {
      kind: "Two pieces split at 0",
      card: {
        type: "numeric",
        prompt: "f(x) = { x + 4 if x < 0; x² if x ≥ 0 }. Find f(-3).",
        answer: 1,
      },
      steps: [
        { work: "-3 < 0", why: "Check which condition the input meets." },
        { work: "f(-3) = -3 + 4 = 1", why: "Use only the piece whose condition is true." },
      ],
      answer: "1",
    },
    {
      kind: "Two pieces split at another number",
      card: {
        type: "numeric",
        prompt: "f(x) = { 3x if x < 2; x + 5 if x ≥ 2 }. Find f(4).",
        answer: 9,
      },
      steps: [
        { work: "4 ≥ 2", why: "4 is not less than 2, so the second rule applies." },
        { work: "f(4) = 4 + 5 = 9", why: "Put the input into that rule." },
      ],
      answer: "9",
    },
    {
      kind: "Three pieces, an input on a boundary",
      card: {
        type: "numeric",
        prompt: "f(x) = { -2x if x < -1; 4 if -1 ≤ x ≤ 3; x² − 2 if x > 3 }. Find f(-1).",
        answer: 4,
      },
      steps: [
        { work: "-1 ≤ -1 ≤ 3", why: "The ≤ signs include the ends, so −1 is in the middle piece." },
        { work: "f(-1) = 4", why: "The middle piece is the constant 4." },
      ],
      answer: "4",
    },
    {
      kind: "Two inputs added",
      card: {
        type: "numeric",
        prompt: "f(x) = { 2x + 1 if x < 1; 8 − x if x ≥ 1 }. Find f(-2) + f(3).",
        answer: 2,
      },
      steps: [
        { work: "f(-2) = 2(-2) + 1 = -3", why: "-2 is less than 1, so use 2x + 1." },
        { work: "f(3) = 8 − 3 = 5", why: "3 is at least 1, so use 8 − x." },
        { work: "-3 + 5 = 2", why: "Add the two outputs." },
      ],
      answer: "2",
    },
    {
      kind: "The opposite of a negative input",
      card: {
        type: "numeric",
        prompt: "f(x) = { −x if x < 0; 3x if x ≥ 0 }. Find f(-5).",
        answer: 5,
      },
      steps: [
        { work: "-5 < 0", why: "The input meets the first condition." },
        { work: "f(-5) = −(-5) = 5", why: "The opposite of a negative is positive." },
      ],
      answer: "5",
    },
  ],

  "center-spread": [
    {
      kind: "Median of an even count",
      card: {
        type: "numeric",
        prompt: "Find the median of 12, 5, 9, 20, 7, 15. Write your answer as a decimal.",
        answer: 10.5,
      },
      steps: [
        { work: "In order: 5, 7, 9, 12, 15, 20", why: "Sort the data before looking for the middle." },
        { work: "the middle two are 9 and 12", why: "Six values have two in the middle." },
        { work: "(9 + 12) ÷ 2 = 10.5", why: "The median is halfway between them." },
      ],
      answer: "10.5",
    },
    {
      kind: "Mean",
      card: {
        type: "numeric",
        prompt: "Four quiz scores are 82, 90, 75, and 89. What is the mean score?",
        answer: 84,
      },
      steps: [
        { work: "82 + 90 + 75 + 89 = 336", why: "Add all the scores." },
        { work: "336 ÷ 4 = 84", why: "Divide by how many scores there are." },
      ],
      answer: "84",
    },
    {
      kind: "Interquartile range",
      card: {
        type: "numeric",
        prompt: "Find the interquartile range (IQR) of 14, 3, 22, 8, 30, 11, 17.",
        answer: 14,
      },
      steps: [
        { work: "In order: 3, 8, 11, 14, 17, 22, 30", why: "Sort the data first." },
        { work: "median 14", why: "The middle value splits the data in halves." },
        { work: "Q1 = 8 and Q3 = 22", why: "Each quartile is the middle of its half, without the median." },
        { work: "IQR = 22 − 8 = 14", why: "The IQR is Q3 minus Q1." },
      ],
      answer: "14",
    },
    {
      kind: "How much an outlier moves the mean",
      card: {
        type: "numeric",
        prompt: "The data set is 12, 18, 15, 66, 20, 14, 23. How much does the mean go down when the outlier, 66, is removed?",
        answer: 7,
      },
      steps: [
        { work: "With it: 168 ÷ 7 = 24", why: "Mean of all seven values." },
        { work: "without it: 102 ÷ 6 = 17", why: "Take 66 off the total and divide by six." },
        { work: "24 − 17 = 7", why: "The difference is how far the mean drops." },
      ],
      answer: "7",
    },
    {
      kind: "The score needed for a target mean",
      card: {
        type: "numeric",
        prompt: "Four test scores are 80, 92, 77, and 85. What score on the fifth test makes the mean exactly 84?",
        answer: 86,
      },
      steps: [
        { work: "5 × 84 = 420", why: "Five tests averaging 84 must total 420." },
        { work: "80 + 92 + 77 + 85 = 334", why: "Add the scores already there." },
        { work: "420 − 334 = 86", why: "The fifth score makes up the rest." },
      ],
      answer: "86",
    },
    {
      kind: "The upper fence for outliers",
      card: {
        type: "numeric",
        prompt: "For the data 18, 5, 24, 9, 15, 20, 12, what is the upper fence: Q3 plus 1.5 times the IQR? Values above it count as outliers. Write your answer as a decimal.",
        answer: 36.5,
      },
      steps: [
        { work: "In order: 5, 9, 12, 15, 18, 20, 24", why: "Sort the data first." },
        { work: "Q1 = 9 and Q3 = 20", why: "Middles of the lower and upper halves, median left out." },
        { work: "IQR = 20 − 9 = 11", why: "Q3 minus Q1." },
        { work: "20 + 1.5 × 11 = 20 + 16.5 = 36.5", why: "Multiply before adding." },
      ],
      answer: "36.5",
    },
  ],

  "trend-lines": [
    {
      kind: "A prediction from the line",
      card: {
        type: "numeric",
        prompt: "A line of fit for hours studied, x, and test score, y, is y = 5x + 55. What does the line predict when x = 4?",
        answer: 75,
      },
      steps: [
        { work: "y = 5(4) + 55", why: "Put the x-value into the line." },
        { work: "= 20 + 55 = 75", why: "Multiply first, then add the intercept." },
      ],
      answer: "75",
    },
    {
      kind: "Working backward to x",
      card: {
        type: "numeric",
        prompt: "A line of fit for weeks since planting, x, and plant height in cm, y, is y = 2.5x + 4. For what value of x does the line predict y = 19?",
        answer: 6,
      },
      steps: [
        { work: "2.5x + 4 = 19", why: "Set the line equal to the y-value." },
        { work: "2.5x = 15", why: "Subtract the intercept from both sides." },
        { work: "x = 15 ÷ 2.5 = 6", why: "Divide by the slope." },
      ],
      answer: "6",
    },
    {
      kind: "What the slope means",
      card: {
        type: "multiple-choice",
        prompt: "A line of fit for age of a car in years, x, and price in dollars, y, is y = -1500x + 24000. What does the slope, -1,500, mean?",
        choices: [
          "The price goes down about 1,500 dollars for each extra year.",
          "The price goes up about 1,500 dollars for each extra year.",
          "The price is about 1,500 dollars when x is 0.",
          "The price goes down about 24,000 dollars for each extra year.",
        ],
        answer: "The price goes down about 1,500 dollars for each extra year.",
      },
      steps: [
        { work: "slope = change in y for each 1 added to x = -1,500", why: "Slope is the change per unit of x." },
        { work: "negative, so the price goes down about 1,500 dollars each extra year", why: "A negative slope means y falls as x grows." },
      ],
      answer: "The price goes down about 1,500 dollars for each extra year.",
    },
    {
      kind: "A residual",
      card: {
        type: "numeric",
        prompt: "A line of fit for hours studied, x, and test score, y, is y = 6x + 50. When x = 5, the actual value was 76. What is the residual, actual minus predicted?",
        answer: -4,
      },
      steps: [
        { work: "predicted = 6(5) + 50 = 80", why: "Find what the line says first." },
        { work: "76 − 80 = -4", why: "Residual is actual minus predicted." },
      ],
      answer: "-4",
    },
    {
      kind: "The strongest correlation",
      card: {
        type: "multiple-choice",
        prompt: "Which correlation coefficient shows the strongest linear relationship: r = -0.91, r = 0.62, r = 0.18, and r = -0.45?",
        choices: ["r = -0.91", "r = 0.62", "r = 0.18", "r = -0.45"],
        answer: "r = -0.91",
      },
      steps: [
        { work: "strength is the distance from 0: |-0.91| = 0.91, |0.62| = 0.62, |0.18| = 0.18, |-0.45| = 0.45", why: "The sign only gives the direction." },
        { work: "0.91 is the farthest from 0, so r = -0.91 is the strongest", why: "Closest to 1 or −1 is strongest." },
      ],
      answer: "r = -0.91",
    },
    {
      kind: "Reading a correlation coefficient",
      card: {
        type: "multiple-choice",
        prompt: "The correlation coefficient between outside temperature in °F and cups of lemonade sold in a data set is r = 0.89. What does it show?",
        choices: [
          "A strong positive linear relationship",
          "A strong negative linear relationship",
          "A weak positive linear relationship",
          "Proof that one variable causes the other",
        ],
        answer: "A strong positive linear relationship",
      },
      steps: [
        { work: "r = 0.89 is positive", why: "The sign of r gives the direction." },
        { work: "|r| = 0.89 is close to 1, so strong", why: "Close to 1 or −1 means the points hug a line." },
      ],
      answer: "A strong positive linear relationship",
    },
    {
      kind: "Correlation is not a cause",
      card: {
        type: "multiple-choice",
        prompt: "In a data set, ice cream sales and sunburns have r = 0.84. Which conclusion is sound?",
        choices: [
          "They tend to rise together; something else, like hot, sunny weather, may drive both.",
          "Raising ice cream sales will raise sunburns.",
          "Ice cream sales and sunburns move in opposite directions.",
          "The data are too weak to show any pattern.",
        ],
        answer: "They tend to rise together; something else, like hot, sunny weather, may drive both.",
      },
      steps: [
        { work: "r = 0.84: a strong positive correlation", why: "Close to 1 and positive." },
        { work: "a correlation alone cannot show a cause", why: "A third thing, like hot weather, can move both." },
      ],
      answer: "They tend to rise together; something else, like hot, sunny weather, may drive both.",
    },
  ],

  "two-way-tables": [
    {
      kind: "Joint relative frequency",
      card: {
        type: "numeric",
        prompt: "A survey asked 9th graders and 10th graders whether they walk to school or ride the bus. 18 of the 9th graders walk and 22 ride the bus; 12 of the 10th graders walk and 28 ride the bus. What fraction of all the students surveyed are 10th graders who walk? Give it as a fraction.",
        answer: 0.15,
      },
      steps: [
        { work: "total = 18 + 22 + 12 + 28 = 80", why: "All the students surveyed." },
        { work: "12/80 = 3/20", why: "One cell over the grand total, then simplify." },
      ],
      answer: "3/20",
    },
    {
      kind: "Marginal relative frequency",
      card: {
        type: "numeric",
        prompt: "A survey asked 9th graders and 10th graders whether they walk to school or ride the bus. 18 of the 9th graders walk and 22 ride the bus; 12 of the 10th graders walk and 28 ride the bus. What fraction of all the students surveyed walk to school? Give it as a fraction.",
        answer: 0.375,
      },
      steps: [
        { work: "18 + 12 = 30 walk", why: "Add the walkers from both grades." },
        { work: "total = 18 + 22 + 12 + 28 = 80", why: "Everyone surveyed." },
        { work: "30/80 = 3/8", why: "Divide and simplify." },
      ],
      answer: "3/8",
    },
    {
      kind: "Conditional relative frequency within a group",
      card: {
        type: "numeric",
        prompt: "A survey asked juniors and seniors whether they prefer morning or evening practice. 24 of the juniors prefer morning practice and 16 prefer evening practice; 15 of the seniors prefer morning practice and 25 prefer evening practice. What fraction of the juniors prefer morning practice? Give it as a fraction.",
        answer: 0.6,
      },
      steps: [
        { work: "juniors: 24 + 16 = 40", why: "Only the juniors count here." },
        { work: "24/40 = 3/5", why: "Divide by the juniors' total, then simplify." },
      ],
      answer: "3/5",
    },
    {
      kind: "Conditional relative frequency within an answer",
      card: {
        type: "numeric",
        prompt: "A survey asked juniors and seniors whether they prefer morning or evening practice. 24 of the juniors prefer morning practice and 16 prefer evening practice; 15 of the seniors prefer morning practice and 25 prefer evening practice. Of the students who prefer morning practice, what fraction are seniors? Give it as a fraction.",
        answer: 15 / 39,
      },
      steps: [
        { work: "who prefer morning practice: 24 + 15 = 39", why: "The group is everyone who gave that answer." },
        { work: "15/39 = 5/13", why: "Seniors in that group over the group's total." },
      ],
      answer: "5/13",
    },
    {
      kind: "Comparing two groups' shares",
      card: {
        type: "multiple-choice",
        prompt: "A survey asked 9th graders and 10th graders whether they walk to school or ride the bus. 18 of the 9th graders walk and 22 ride the bus; 12 of the 10th graders walk and 28 ride the bus. Which group has the greater share of students who walk to school?",
        choices: ["The 9th graders", "The 10th graders", "They have the same share"],
        answer: "The 9th graders",
      },
      steps: [
        { work: "9th graders: 18/40 = 45%", why: "Each group's count over its own total." },
        { work: "10th graders: 12/40 = 30%", why: "Compare rates, not raw counts." },
        { work: "45% > 30%, so the 9th graders", why: "The bigger rate is the greater share." },
      ],
      answer: "The 9th graders",
    },
  ],

  "literal-equations": [
    {
      kind: "Volume, solved for the height",
      card: {
        type: "numeric",
        prompt: "The volume of a box is V = lwh. Solve for h, then find h when V = 120, l = 6 and w = 4.",
        answer: 5,
      },
      steps: [
        { work: "h = V/(lw)", why: "h is multiplied by l and w, so divide by both." },
        { work: "h = 120 ÷ (6 × 4) = 120 ÷ 24", why: "Put in the numbers." },
        { work: "= 5", why: "Divide." },
      ],
      answer: "5",
    },
    {
      kind: "Rearranging a formula",
      card: {
        type: "multiple-choice",
        prompt: "Solve y = mx + b for x.",
        choices: ["x = (y − b)/m", "x = (y + b)/m", "x = y − b − m", "x = m(y − b)"],
        answer: "x = (y − b)/m",
      },
      steps: [
        { work: "subtract b from both sides: y − b = mx", why: "Undo the adding first; the last step done is the first undone." },
        { work: "divide both sides by m: x = (y − b)/m", why: "m multiplies x, so divide both sides by m." },
      ],
      answer: "x = (y − b)/m",
    },
    {
      kind: "Fahrenheit to Celsius",
      card: {
        type: "numeric",
        prompt: "F = 1.8C + 32 changes Celsius to Fahrenheit. Solve it for C, then find C when F = 77.",
        answer: 25,
      },
      steps: [
        { work: "C = (F − 32)/1.8", why: "Subtract 32 first, then divide by 1.8." },
        { work: "C = (77 − 32)/1.8 = 45/1.8", why: "Put in the Fahrenheit value." },
        { work: "= 25", why: "Divide." },
      ],
      answer: "25",
    },
    {
      kind: "Simple interest, solved for time",
      card: {
        type: "numeric",
        prompt: "Simple interest is I = Prt. Solve for t, then find how many years $1,000 takes to earn $150 at 5% simple interest.",
        answer: 3,
      },
      steps: [
        { work: "t = I/(Pr)", why: "t is multiplied by P and r, so divide by both." },
        { work: "5% = 0.05", why: "Write the rate as a decimal." },
        { work: "t = 150 ÷ (1,000 × 0.05) = 150 ÷ 50 = 3 years", why: "Put in the numbers and divide." },
      ],
      answer: "3",
    },
    {
      kind: "Speed from distance and time",
      card: {
        type: "numeric",
        prompt: "Distance is d = rt. Solve for r, then find the average speed in miles per hour for 135 miles in 2.5 hours.",
        answer: 54,
      },
      steps: [
        { work: "r = d/t", why: "r is multiplied by t, so divide by t." },
        { work: "r = 135 ÷ 2.5 = 54 miles per hour", why: "Distance divided by time." },
      ],
      answer: "54",
    },
    {
      kind: "Perimeter, solved for the width",
      card: {
        type: "numeric",
        prompt: "A rectangle's perimeter is P = 2l + 2w. Solve for w, then find w when P = 46 and l = 15.",
        answer: 8,
      },
      steps: [
        { work: "w = (P − 2l)/2", why: "Subtract 2l, then divide by 2." },
        { work: "w = (46 − 2 × 15)/2 = 16/2", why: "Put in the numbers." },
        { work: "= 8", why: "Divide." },
      ],
      answer: "8",
    },
  ],

  "function-transformations": [
    {
      kind: "Writing the moved equation",
      card: {
        type: "multiple-choice",
        prompt: "Move y = x² right 3 units and down 2 units. Which equation is the result?",
        choices: ["y = (x − 3)² − 2", "y = (x + 3)² − 2", "y = (x − 3)² + 2", "y = (x + 2)² + 3"],
        answer: "y = (x − 3)² − 2",
      },
      steps: [
        { work: "right 3: x becomes x − 3", why: "A sideways move goes inside, with the opposite sign." },
        { work: "down 2: subtract 2 at the end", why: "Up or down moves are added outside." },
        { work: "y = (x − 3)² − 2", why: "Put both moves in." },
      ],
      answer: "y = (x − 3)² − 2",
    },
    {
      kind: "Finding the turning point",
      card: {
        type: "numeric",
        prompt: "y = |x + 4| − 1 is y = |x| moved. Where is its corner point? Type its x-coordinate.",
        answer: -4,
      },
      steps: [
        { work: "x + 4 = 0 at x = -4", why: "The corner is where the inside is zero." },
        { work: "the rule subtracts 1, so the corner is (-4, -1)", why: "The number at the end moves it down." },
        { work: "x = -4", why: "Read the x-coordinate." },
      ],
      answer: "-4",
    },
    {
      kind: "Describing a flip and two moves",
      card: {
        type: "multiple-choice",
        prompt: "How does y = -(x − 2)² + 5 compare with y = x²?",
        choices: [
          "Flipped over the x-axis, moved right 2 units and up 5 units",
          "Flipped over the x-axis, moved left 2 units and up 5 units",
          "Moved right 2 units and up 5 units, the same way up as y = x²",
          "Flipped over the x-axis, moved right 5 units and up 2 units",
        ],
        answer: "Flipped over the x-axis, moved right 2 units and up 5 units",
      },
      steps: [
        { work: "the minus in front flips it over the x-axis", why: "Every y-value changes sign." },
        { work: "x − 2 inside moves it right 2", why: "Inside, the sign is the opposite of the move." },
        { work: "+ 5 at the end moves it up 5", why: "A number added outside moves it up." },
      ],
      answer: "Flipped over the x-axis, moved right 2 units and up 5 units",
    },
    {
      kind: "Evaluating a moved function",
      card: {
        type: "numeric",
        prompt: "f(x) = x² − 3. If g(x) = f(x + 2) + 4, find g(1).",
        answer: 10,
      },
      steps: [
        { work: "g(1) = f(3) + 4", why: "The input to f is 1 + 2 = 3." },
        { work: "f(3) = 3² − 3 = 6", why: "Work out f at that input." },
        { work: "6 + 4 = 10", why: "Then add 4 at the end." },
      ],
      answer: "10",
    },
    {
      kind: "A stretch and a move",
      card: {
        type: "multiple-choice",
        prompt: "Which function is y = |x| stretched by a factor of 3 and then moved down 4 units?",
        choices: ["y = 3|x| − 4", "y = 3|x| + 4", "y = |x − 4| + 3", "y = (1/3)|x| − 4"],
        answer: "y = 3|x| − 4",
      },
      steps: [
        { work: "stretch by 3: y = 3|x|", why: "A stretch multiplies the whole function." },
        { work: "down 4: y = 3|x| − 4", why: "Moving down subtracts at the end." },
      ],
      answer: "y = 3|x| − 4",
    },
    {
      kind: "Where a point lands",
      card: {
        type: "numeric",
        prompt: "The point (2, 4) is on y = x². Where does it land on y = (x + 1)² + 3? Type its new y-coordinate.",
        answer: 7,
      },
      steps: [
        { work: "x + 1 inside moves points left 1: x = 2 − 1 = 1", why: "Inside, the sign is the opposite of the move." },
        { work: "+ 3 at the end moves points up 3: y = 4 + 3 = 7", why: "Every y goes up by the number at the end." },
        { work: "(1, 7), so the new y is 7", why: "Read the coordinate asked for." },
      ],
      answer: "7",
    },
  ],

  "linear-vs-exponential": [
    {
      kind: "Linear, exponential, or neither from a table",
      card: {
        type: "multiple-choice",
        prompt: "When x is 0, 1, 2, 3, y is 3, 6, 12, 24. Is the relationship linear, exponential, or neither?",
        choices: ["Linear", "Exponential", "Neither"],
        answer: "Exponential",
      },
      steps: [
        { work: "differences: 3, 6, 12, not the same", why: "Equal differences would mean linear." },
        { work: "ratios: 2, 2, 2, all the same", why: "Divide each y by the one before." },
        { work: "equal ratios, so exponential", why: "Multiplying by the same factor is exponential." },
      ],
      answer: "Exponential",
    },
    {
      kind: "Continuing a table",
      card: {
        type: "numeric",
        prompt: "When x is 0, 1, 2, 3, y is 5, 9, 13, 17. If the pattern continues, what is y when x = 8?",
        answer: 37,
      },
      steps: [
        { work: "differences: 4, 4, 4, so it is linear", why: "The same amount is added each step." },
        { work: "y = 5 + 4 × 8", why: "Start at 5 and add 4 for each step." },
        { work: "= 5 + 32 = 37", why: "Multiply first, then add." },
      ],
      answer: "37",
    },
    {
      kind: "Which story is exponential",
      card: {
        type: "multiple-choice",
        prompt: "Which situation is modeled by an exponential function?",
        choices: [
          "A colony of bacteria doubles every hour.",
          "A pool fills by 40 gallons every minute.",
          "A taxi fare rises $2 for every mile.",
          "A savings jar gets $10 every week.",
        ],
        answer: "A colony of bacteria doubles every hour.",
      },
      steps: [
        { work: "gallons, dollars per mile, dollars per week: the same amount each step", why: "Adding a fixed amount is linear." },
        { work: "doubling multiplies by 2 each hour, so it is exponential", why: "The same factor each step is exponential." },
      ],
      answer: "A colony of bacteria doubles every hour.",
    },
    {
      kind: "Which story is linear",
      card: {
        type: "multiple-choice",
        prompt: "Which situation is modeled by a linear function?",
        choices: [
          "A candle burns down 3 cm every hour.",
          "A town's population grows 4% each year.",
          "A video's views triple every day.",
          "A medicine's amount halves every 6 hours.",
        ],
        answer: "A candle burns down 3 cm every hour.",
      },
      steps: [
        { work: "4% each year, triple, halves: the same factor each step", why: "Multiplying by a fixed factor is exponential." },
        { work: "3 cm every hour is the same amount each step, so it is linear", why: "Adding or subtracting a fixed amount is linear." },
      ],
      answer: "A candle burns down 3 cm every hour.",
    },
    {
      kind: "When doubling passes a steady amount",
      card: {
        type: "numeric",
        prompt: "Job A pays $100 a day. Job B pays $1 on day 1 and doubles its pay each day. On which day does Job B first pay more than Job A?",
        answer: 8,
      },
      steps: [
        { work: "day n pays 2^(n − 1) dollars", why: "Day 1 is $1, and each day doubles." },
        { work: "day 7: $64, not more than $100", why: "Keep doubling and compare." },
        { work: "day 8: $128, more than $100", why: "The first day it passes is the answer." },
      ],
      answer: "8",
    },
    {
      kind: "Two points, an exponential model",
      card: {
        type: "numeric",
        prompt: "y is 4 when x = 0 and 36 when x = 2. If y grows exponentially, what is y when x = 3?",
        answer: 108,
      },
      steps: [
        { work: "36 ÷ 4 = 9 over two steps", why: "Two steps multiply by 9 in all." },
        { work: "factor per step: √9 = 3", why: "The same factor twice gives 9." },
        { work: "y(3) = 4 × 3³ = 4 × 27 = 108", why: "Multiply by 3 three times." },
      ],
      answer: "108",
    },
    {
      kind: "Two points, a linear model",
      card: {
        type: "numeric",
        prompt: "y is 4 when x = 0 and 36 when x = 2. If y grows linearly, what is y when x = 3?",
        answer: 52,
      },
      steps: [
        { work: "36 − 4 = 32 over two steps", why: "Two steps add 32 in all." },
        { work: "change per step: 32 ÷ 2 = 16", why: "Linear growth adds the same amount each step." },
        { work: "y(3) = 4 + 3 × 16 = 4 + 48 = 52", why: "Start at 4 and add 16 three times." },
      ],
      answer: "52",
    },
    {
      kind: "A steady gain against a percent gain",
      card: {
        type: "numeric",
        prompt: "Two towns each have 10,000 people. Town A gains 500 people a year. Town B grows 5% a year. How many more people does Town B have after 3 years? (round to the nearest whole number)",
        answer: 76,
        decimalPlaces: 0,
      },
      steps: [
        { work: "A: 10,000 + 500 × 3 = 11,500", why: "Linear growth adds the same amount each year." },
        { work: "B: 10,000 × 1.05³ ≈ 11,576", why: "Exponential growth multiplies by 1.05 each year." },
        { work: "11,576 − 11,500 = 76", why: "Subtract to compare." },
      ],
      answer: "76",
    },
  ],
};
