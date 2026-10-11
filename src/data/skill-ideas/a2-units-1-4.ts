import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 2, units 1 to 4 (types.ts). */
export const IDEAS: SkillIdeas = {
  "imaginary-unit": {
    idea: "Every real number squared comes out zero or positive: 3² and (−3)² are both 9. So the square root of a negative needs a new kind of number. That number is i, defined so that i² = −1. With it, √(−9) has an answer: 3i, because (3i)² = 9 · i² = −9.",
    everyday: "Engineers who design phone chargers, speakers and Wi-Fi use i every day: it keeps track of electricity and radio waves that swing back and forth.",
    picture: {
      kind: "complexPlane",
      max: 2,
      points: [
        { re: 1, im: 0, label: "1" },
        { re: 0, im: 1, label: "i" },
        { re: -1, im: 0, label: "i² = −1" },
        { re: 0, im: -1, label: "i³ = −i" },
      ],
    },
    caption: "Each time you multiply by i you turn a quarter turn: 1, i, −1, −i, and back to 1. That is why the powers of i repeat every four.",
    why: [
      "i² = −1 is the definition, so every i² in your work becomes −1.",
      "√(−n) = √n · √(−1) = i√n: pull the negative out as i first, then simplify the square root that is left.",
    ],
  },

  "complex-arithmetic": {
    idea: "A complex number like 3 + 2i has two parts: a real part, 3, and an imaginary part, 2i. They are two different kinds of things, like dollars and data on a phone plan, so you add dollars to dollars and data to data. To multiply, treat i like x and FOIL, then swap every i² for −1, which turns that piece back into a plain number.",
    everyday: "Think of 3 + 2i as a game move: 3 steps right and 2 steps up. Do that move, then −5 + 4i (5 left and 4 up), and you end 2 left and 6 up, the point −2 + 6i.",
    picture: {
      kind: "complexPlane",
      max: 7,
      points: [
        { re: 3, im: 2, label: "3 + 2i" },
        { re: -5, im: 4, label: "−5 + 4i" },
        { re: -2, im: 6, label: "sum: −2 + 6i" },
      ],
    },
    caption: "Adding moves across and up separately: from 3 + 2i, go 5 left and 4 up, and you land on −2 + 6i.",
    why: [
      "i acts like a variable, so 2i + 4i = 6i just as 2x + 4x = 6x.",
      "i² = −1, so after FOIL every i² term becomes a plain number and joins the real part.",
    ],
  },

  "complex-roots": {
    idea: "Solving x² = −4 asks for a number whose square is −4. Real squares are always 0 or more, so the answer has to use i: (2i)² = 4 · i² = −4, and (−2i)² = −4 too. When a negative lands under the square root, the solutions come as a pair like 3 + 2i and 3 − 2i, and the parabola stays off the x-axis.",
    everyday: "A game jump follows h = −16t² + 32t and peaks at 16 feet. Asking when it reaches a 20-foot ledge gives 16t² − 32t + 20 = 0, with discriminant 1024 − 1280 = −256. The answers are complex, so the jump falls short.",
    picture: {
      kind: "complexPlane",
      max: 4,
      points: [
        { re: 3, im: 2, label: "3 + 2i" },
        { re: 3, im: -2, label: "3 − 2i" },
      ],
    },
    caption: "The two solutions of x² − 6x + 13 = 0 are mirror images across the real line, because the ± only changes the sign of the i part.",
    why: [
      "√(−n) = i√n, so the quadratic formula still works when b² − 4ac is negative.",
      "The ± sits in front of the i part, so complex solutions always come in a pair a + bi and a − bi.",
    ],
  },

  "polynomial-end-behavior": {
    idea: "End behavior is what a graph does far to the left and far to the right. Out there, the term with the biggest power is so much larger than the rest that it alone decides. An even degree, like x², sends both ends the same way; an odd degree, like x³, sends them opposite ways. A negative number in front flips the picture upside down.",
    everyday: "Zoom far out on y = x³ − 4x in a graphing app and it looks just like y = x³. At x = 100, x³ is 1,000,000 while 4x is only 400.",
    picture: {
      kind: "graph",
      x: [-3, 3],
      y: [-8, 8],
      curves: [{ f: "cubic", a: 1, b: 0, c: -4, d: 0, label: "y = x³ − 4x" }],
      points: [
        { x: -2, y: 0, label: "−2" },
        { x: 0, y: 0, label: "0" },
        { x: 2, y: 0, label: "2" },
      ],
    },
    caption: "Near the middle, x³ − 4x wiggles through −2, 0 and 2. Far out, the x³ wins: the left end falls and the right end rises.",
    why: [
      "For big x the highest power grows fastest, so the other terms hardly matter.",
      "An even power turns a negative x positive, so both ends match; an odd power keeps the sign, so the ends split.",
      "A negative leading coefficient multiplies everything by a negative, which flips both ends.",
    ],
  },

  "polynomial-division": {
    idea: "Dividing a polynomial by x − 3 asks the same thing as 17 ÷ 5: how many times does it go in, and what is left over? Synthetic division is a shortcut that keeps only the numbers in front of each power. Bring the first one down, multiply by 3, add it to the next, and repeat. The last number is the leftover, and it always equals P(3).",
    everyday: "Share 17 slices of pizza among 5 friends: each gets 3 and 2 are left, because 5 × 3 + 2 = 17. Polynomials split the same way: x³ − 4x² + 2x + 5 = (x − 3)(x² − x − 1) + 2.",
    picture: {
      kind: "table",
      headers: ["box: 3", "x³", "x²", "x", "number"],
      rows: [
        ["coefficients", "1", "−4", "2", "5"],
        ["× 3, written under", "", "3", "−3", "−3"],
        ["add down", "1", "−1", "−1", "2"],
      ],
      note: "Bottom row: quotient x² − x − 1 and remainder 2, which equals P(3).",
    },
    caption: "In each column, multiply the bottom number by 3, write it under the next coefficient, and add. The last number, 2, is the remainder.",
    why: [
      "Each multiply-and-add step is long division with the x's left out: the powers stay lined up in their columns.",
      "P(x) = (x − 3) · quotient + remainder. At x = 3 the first part is 0, so P(3) is the remainder.",
    ],
  },

  "remainder-factor-theorem": {
    idea: "When you divide P(x) by x − k, the remainder is simply P(k), the value of the polynomial at x = k. So x − k divides evenly, and is a factor, exactly when P(k) = 0. On the graph, that means the curve crosses the x-axis at k: every x-intercept gives a factor, and every factor gives an x-intercept.",
    everyday: "Can 6 friends split 42 stickers evenly? 42 = 6 × 7 + 0, remainder 0, so 6 is a factor of 42. For P(x) = x³ − 2x² − 5x + 6, P(3) = 27 − 18 − 15 + 6 = 0, so x − 3 is a factor.",
    picture: {
      kind: "graph",
      x: [-3, 4],
      y: [-10, 10],
      curves: [{ f: "cubic", a: 1, b: -2, c: -5, d: 6, label: "P(x) = x³ − 2x² − 5x + 6" }],
      points: [
        { x: -2, y: 0, label: "−2" },
        { x: 1, y: 0, label: "1" },
        { x: 3, y: 0, label: "3" },
      ],
    },
    caption: "The curve crosses the x-axis at −2, 1 and 3, so P(x) = (x + 2)(x − 1)(x − 3): one factor for each crossing.",
    why: [
      "P(x) = (x − k) · Q(x) + R. Put in x = k and the first part is 0, so P(k) = R.",
      "A remainder of 0 means x − k divides evenly, which is exactly what being a factor means.",
    ],
  },

  "vertex-form": {
    idea: "Vertex form y = a(x − h)² + k is a recipe for moving the basic parabola y = x². Slide it h steps right and k steps up, and let a stretch or flip it. The turning point, the vertex, lands at (h, k). The bracket reads x − h, so y = (x − 2)² − 3 has h = 2: the sign inside flips, the sign outside stays.",
    everyday: "A ball tossed up follows h = −16(t − 1)² + 20 feet. It leaves your hand at 4 feet, peaks at 20 feet after 1 second, and the vertex (1, 20) reads straight off the equation.",
    picture: {
      kind: "graph",
      x: [-2, 6],
      y: [-4, 8],
      curves: [{ f: "quadratic", a: 1, b: -4, c: 1, label: "y = (x − 2)² − 3" }],
      points: [{ x: 2, y: -3, label: "vertex (2, −3)" }],
    },
    caption: "y = (x − 2)² − 3 is y = x² slid 2 right and 3 down, so its lowest point is the vertex (2, −3).",
    why: [
      "(x − h)² is smallest, 0, exactly at x = h, so the parabola turns at x = h.",
      "At x = h the square is 0, so y = a · 0 + k = k: the vertex is (h, k).",
    ],
  },

  discriminant: {
    idea: "The quadratic formula has √(b² − 4ac) inside it, and that one number, the discriminant, tells you what kind of answers are coming before you solve. Positive: the ± gives two different real solutions, and the parabola crosses the x-axis twice. Zero: the ± adds nothing, so there is one solution and the parabola just touches. Negative: the root is imaginary, so two complex solutions.",
    everyday: "A ball thrown up follows h = −16t² + 48t and peaks at 36 feet. When does it hit 32 feet? Discriminant 256, two times. 36 feet: discriminant 0, once, at the top. 40 feet: discriminant −256, never.",
    picture: {
      kind: "graph",
      x: [-3, 5],
      y: [-5, 8],
      curves: [
        { f: "quadratic", a: 1, b: -2, c: -3, label: "x² − 2x − 3: 16" },
        { f: "quadratic", a: 1, b: -2, c: 1, label: "x² − 2x + 1: 0" },
        { f: "quadratic", a: 1, b: -2, c: 3, label: "x² − 2x + 3: −8" },
      ],
      points: [
        { x: -1, y: 0, label: "−1" },
        { x: 1, y: 0, label: "1" },
        { x: 3, y: 0, label: "3" },
      ],
    },
    caption: "Same b, bigger c: discriminant 16 crosses the x-axis twice, discriminant 0 touches once at x = 1, and discriminant −8 floats above the axis.",
    why: [
      "The discriminant sits under the square root in x = (−b ± √(b² − 4ac)) / 2a.",
      "Adding and taking away √(positive) gives two values, √0 adds nothing, and √(negative) brings in i.",
    ],
  },

  "linear-quadratic-systems": {
    idea: "A line and a parabola can cross twice, touch once, or pass each other by. Where they meet, both rules give the same y for the same x. So set the two rules equal, move everything to one side, and solve the quadratic you get. Its roots are the x-values of the meeting points.",
    everyday: "A ball follows h = −16t² + 64t while a drone rises at h = 16t. Setting them equal gives 16t² − 48t = 0, so t = 0 or t = 3: they meet at launch and again after 3 seconds, 48 feet up.",
    picture: {
      kind: "graph",
      x: [-4, 4],
      y: [-6, 10],
      curves: [
        { f: "quadratic", a: 1, b: 1, c: -4, label: "y = x² + x − 4" },
        { f: "linear", m: 2, b: 2, label: "y = 2x + 2" },
      ],
      points: [
        { x: -2, y: -2, label: "(−2, −2)" },
        { x: 3, y: 8, label: "(3, 8)" },
      ],
    },
    caption: "The line y = 2x + 2 crosses the parabola at (−2, −2) and (3, 8), and −2 and 3 are the roots of x² − x − 6 = 0.",
    why: [
      "A meeting point is on both graphs, so either rule gives the same y there.",
      "Subtracting the line from the parabola leaves a quadratic that is 0 exactly where the two are equal.",
    ],
  },

  "simplify-rational": {
    idea: "A rational expression is a fraction with x in it, like (x² + 7x + 10)/(x + 2). Simplifying works like 12/18 = 2/3: write the top and the bottom as products, then cancel a factor they share, since a factor over itself is 1. Only whole factors cancel, never pieces of a sum. Any x that makes the original bottom 0 stays off limits.",
    everyday: "Eating 12 of 18 pizza slices is eating 2/3 of the pizza: 12/18 = (6 × 2)/(6 × 3), and the shared 6 cancels. With x, (x + 2)(x + 5)/(x + 2) = x + 5 the same way.",
    picture: {
      kind: "table",
      headers: ["x", "(x² + 7x + 10)/(x + 2)", "x + 5"],
      rows: [
        ["0", "10/2 = 5", "5"],
        ["1", "18/3 = 6", "6"],
        ["3", "40/5 = 8", "8"],
        ["−2", "0/0, undefined", "3"],
      ],
      note: "The two columns agree at every x other than −2, where the original divides by 0.",
    },
    caption: "Both columns match for every x you try, apart from x = −2, which stays excluded because it makes the original bottom 0.",
    why: [
      "(x + 2)/(x + 2) is 1, and multiplying by 1 changes nothing.",
      "Canceling needs whole factors: in (x + 5)/(x + 2) the x's are parts of sums, so they stay.",
    ],
  },

  "multiply-divide-rational": {
    idea: "Multiplying fractions with x in them works like 2/3 × 3/5: tops times tops, bottoms times bottoms, and a factor on both a top and a bottom cancels. Dividing asks how many of the second fraction fit into the first, which is the same as multiplying by its flip. So flip the second fraction, multiply, then cancel.",
    everyday: "How many 3/4-cup servings are in 6 cups of popcorn? 6 ÷ 3/4 = 6 × 4/3 = 24/3 = 8 servings. Flipping 3/4 to 4/3 turns the division into a multiplication.",
    picture: {
      kind: "chain",
      steps: [
        "(x + 2)/(x − 1) ÷ (x + 2)/(x + 4)",
        "(x + 2)/(x − 1) × (x + 4)/(x + 2)",
        "((x + 2)(x + 4))/((x − 1)(x + 2))",
        "(x + 4)/(x − 1)",
      ],
    },
    caption: "Flip the second fraction, multiply across, and the (x + 2) on top cancels the (x + 2) on the bottom.",
    why: [
      "Dividing by a fraction equals multiplying by its flip, because a fraction times its flip is 1.",
      "A factor on a top and a bottom divides to 1, so canceling before multiplying keeps the work small.",
    ],
  },

  "rational-equations": {
    idea: "A rational equation has x in a bottom, like 12/x + 3 = 7. Multiply every term by the common denominator and the bottoms cancel, leaving an ordinary equation. Multiplying by something with x in it can sneak in a fake answer, so put each answer back into the original and throw out any that makes a bottom 0.",
    everyday: "Sam paints a room in 4 hours and Lee in 6. Each hour they paint 1/4 + 1/6 = 5/12 of it together, so 1/x = 5/12 and they need 12/5 = 2.4 hours.",
    picture: {
      kind: "tape",
      bars: [
        {
          label: "one hour of work",
          parts: [
            { label: "Sam 1/4", value: 3 },
            { label: "Lee 1/6", value: 2 },
            { label: "left 7/12", value: 7 },
          ],
        },
        {
          label: "2.4 hours of work",
          parts: [
            { label: "Sam 0.6", value: 7.2 },
            { label: "Lee 0.4", value: 4.8 },
          ],
        },
      ],
    },
    caption: "In one hour they cover 5/12 of the room. In 2.4 hours Sam paints 0.6 and Lee paints 0.4, which fill exactly one whole room.",
    why: [
      "Multiplying both sides by the same nonzero number keeps them equal, and the common denominator cancels every bottom.",
      "Clearing bottoms can add an answer that makes a bottom 0, so every answer goes back into the original to be checked.",
    ],
  },
};
