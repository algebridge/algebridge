import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 2, units 5 to 8 (types.ts). */
export const IDEAS: SkillIdeas = {
  "nth-roots": {
    idea: "A cube root runs cubing backward. 4³ means 4 × 4 × 4 = 64, so ∛64 asks: what number, used three times as a factor, makes 64? The answer is 4. An nth root does the same with n equal factors. An odd root of a negative number works too: ∛(−8) = −2, since (−2)³ = −8.",
    everyday: "Sugar cubes packed into one big cube fill a box with 64 of them. The big cube's edge is ∛64 = 4 sugar cubes long, because 4 × 4 × 4 = 64.",
    picture: {
      kind: "table",
      headers: ["number", "cubed", "so the cube root"],
      rows: [
        ["2", "8", "∛8 = 2"],
        ["3", "27", "∛27 = 3"],
        ["4", "64", "∛64 = 4"],
        ["−2", "−8", "∛(−8) = −2"],
      ],
      note: "Read across to cube a number, read back to take its cube root.",
    },
    caption: "Each row reads both ways: left to right is cubing, and right to left is the cube root.",
    why: [
      "Cubing and taking a cube root undo each other, so (∛64)³ = 64.",
      "∛(a × b) = ∛a × ∛b, so ∛54 = ∛27 × ∛2 = 3∛2: the perfect cube comes out and the rest stays in.",
      "Three negative factors multiply to a negative, so odd roots of negative numbers exist.",
    ],
  },

  "rational-exponents-evaluate": {
    idea: "A fraction exponent is two moves in one. In 8^(2/3), the bottom 3 says take the cube root, and the top 2 says square it. So 8^(2/3) = (∛8)² = 2² = 4. The bottom always names the root and the top names the power.",
    everyday: "A video's views grow 8 times in 3 days at a steady rate. In 1 day they grow 8^(1/3) = 2 times, and in 2 days they grow 8^(2/3) = 4 times.",
    picture: { kind: "chain", steps: ["8^(2/3)", "bottom 3: ∛8 = 2", "top 2: 2² = 4", "8^(2/3) = 4"] },
    caption: "Do the root first so the number gets small, then the power, so the arithmetic stays easy.",
    why: [
      "8^(1/3) × 8^(1/3) × 8^(1/3) = 8^(3/3) = 8, so the power 1/3 has to be the cube root.",
      "8^(2/3) = (8^(1/3))², because a power of a power multiplies exponents: 1/3 × 2 = 2/3.",
    ],
  },

  "radical-equations": {
    idea: "To solve √(x + 2) = x − 4, get the root alone, then square both sides to remove it. Squaring is risky: it makes 2 and −2 look the same, since both square to 4. So squaring can invent an answer the original equation rejects, and every answer has to be checked in the original.",
    everyday: "A swing's time grows with the square root of its chain length. A swing on 4 m chains takes about 4 seconds per swing. To double that time you need 4 times the length, 16 m.",
    picture: {
      kind: "graph",
      x: [-3, 10],
      y: [-4, 6],
      curves: [
        { f: "sqrt", a: 1, h: -2, k: 0, label: "y = √(x + 2)" },
        { f: "linear", m: 1, b: -4, label: "y = x − 4" },
      ],
      points: [
        { x: 7, y: 3, label: "x = 7: both sides 3" },
        { x: 2, y: -2, label: "x = 2: line only" },
      ],
    },
    caption: "The curve and the line meet only at x = 7. At x = 2 the line is at −2 while the curve is at 2, so x = 2 came from squaring.",
    why: [
      "Doing the same thing to both sides keeps them equal, so squaring keeps every real solution.",
      "Squaring can also add one: √(x + 2) = 4 − x squares to the same equation, and x = 2 solves that one.",
      "So put each answer back into the original and keep only the ones that work.",
    ],
  },

  "log-basics": {
    idea: "A logarithm is an exponent. log₂(8) asks one question: 2 to what power gives 8? Since 2 × 2 × 2 = 8, the answer is 3. The small number is the base, the number inside is the result, and the log is the power that connects them. A log counts how many times you multiply by the base.",
    everyday: "Phone storage often comes in 64, 128, 256 and 512 GB. Going from 64 GB to 512 GB is 512 ÷ 64 = 8 times as much, which is log₂(8) = 3 doublings.",
    picture: {
      kind: "graph",
      x: [0, 9],
      y: [-2, 4],
      curves: [{ f: "log", base: 2, label: "y = log₂(x)" }],
      points: [
        { x: 1, y: 0, label: "(1, 0)" },
        { x: 2, y: 1, label: "(2, 1)" },
        { x: 4, y: 2, label: "(4, 2)" },
        { x: 8, y: 3, label: "(8, 3)" },
      ],
    },
    caption: "Each time x doubles, from 1 to 2 to 4 to 8, the log goes up by just 1. The log counts the doublings.",
    why: [
      "log_b(n) = k means exactly b^k = n, so every log question can be rewritten as a power question.",
      "Logs and powers undo each other: log₂(2⁵) = 5, and 2^(log₂ 8) = 8.",
    ],
  },

  "log-properties": {
    idea: "Logs are exponents, so they follow the exponent rules. Multiplying powers adds exponents, so log(a × b) = log a + log b. Dividing subtracts them, so log(a ÷ b) = log a − log b. A power multiplies, so log(aⁿ) = n log a. In short, a log turns multiplying into adding.",
    everyday: "Sound in decibels is a log scale. A sound with 10 times the energy is 10 dB louder, and one with 100 = 10 × 10 times the energy is 10 + 10 = 20 dB louder.",
    picture: {
      kind: "table",
      headers: ["inside the log", "log base 10", "rule"],
      rows: [
        ["10 × 1,000 = 10,000", "1 + 3 = 4", "times becomes plus"],
        ["1,000 ÷ 10 = 100", "3 − 1 = 2", "divide becomes minus"],
        ["100³ = 1,000,000", "3 × 2 = 6", "a power becomes a multiplier"],
      ],
      note: "For a power of 10, the log is the count of zeros.",
    },
    caption: "Count zeros: multiplying the numbers adds their zero counts, which is exactly what adding the logs does.",
    why: [
      "10ᵃ × 10ᵇ = 10^(a + b), so the log of a product is the sum of the logs.",
      "10ᵃ ÷ 10ᵇ = 10^(a − b), so the log of a quotient is the difference of the logs.",
      "(10ᵃ)ⁿ = 10^(a × n), so a power inside the log comes out front as a multiplier.",
    ],
  },

  "solve-exponential-equations": {
    idea: "In 2^x = 8 the unknown is the exponent: how many doublings make 8? If both sides can use the same base, compare exponents: 8 = 2³, so x = 3. If they cannot, like 5^x = 40, take the log of both sides. The log rule brings x down in front, and then x = log 40 ÷ log 5 ≈ 2.29.",
    everyday: "A video has 100 views on day 0, and its views double every day. To reach 800 views, 100 × 2^d = 800, so 2^d = 8 = 2³ and d = 3 days.",
    picture: {
      kind: "graph",
      x: [0, 4],
      y: [0, 1000],
      curves: [
        { f: "exponential", a: 100, base: 2, label: "views = 100 × 2^d" },
        { f: "linear", m: 0, b: 800, label: "800 views" },
      ],
      points: [{ x: 3, y: 800, label: "day 3" }],
    },
    caption: "The growth curve crosses the 800 line at d = 3, the exponent that makes 100 × 2^d equal 800.",
    why: [
      "Powers of the same base are equal only when their exponents are equal, since each step up multiplies by the base again.",
      "log(5^x) = x log 5 brings x out of the exponent, so a plain division finishes the job.",
    ],
  },

  "arithmetic-series": {
    idea: "An arithmetic series adds numbers that go up by the same amount each time, like 20 + 23 + 26 + 29 + 32. Pair the first with the last, the second with the second to last, and every pair has the same total. So the sum is the number of terms times the average of the first and last: S = n(a₁ + aₙ)/2.",
    everyday: "You save $5 the first week and $1 more each week after. In week 10 you save $14, and the 10 weeks total 10 × (5 + 14)/2 = $95.",
    picture: {
      kind: "table",
      headers: ["row", "seats", "rows backward", "pair total"],
      rows: [
        ["1", "20", "32", "52"],
        ["2", "23", "29", "52"],
        ["3", "26", "26", "52"],
        ["4", "29", "23", "52"],
        ["5", "32", "20", "52"],
      ],
      note: "Five pairs of 52 count every seat twice, so the total is 5 × 52 ÷ 2 = 130.",
    },
    caption: "Written forward and backward, every row pairs up to 52, so only the first and last terms matter.",
    why: [
      "Going forward the terms rise by 3 and going backward they fall by 3, so each pair total stays the same.",
      "n pairs of (a₁ + aₙ) count every term twice, so divide by 2.",
    ],
  },

  "geometric-series": {
    idea: "A geometric series adds numbers that each get multiplied by the same ratio r, like 1 + 2 + 4 + 8. A finite one sums to a₁(1 − rⁿ)/(1 − r). When the terms shrink, with |r| < 1, even an infinite series has a total: 1/2 + 1/4 + 1/8 + ... fills exactly 1 whole. That total is a₁/(1 − r).",
    everyday: "Eat half a pizza, then half of what is left, then half of that, and keep going. You eat 1/2 + 1/4 + 1/8 + ..., which adds up to (1/2) ÷ (1 − 1/2) = 1 whole pizza.",
    picture: {
      kind: "tape",
      bars: [
        {
          label: "1 whole pizza",
          parts: [
            { label: "1/2", value: 0.5 },
            { label: "1/4", value: 0.25 },
            { label: "1/8", value: 0.125 },
            { label: "1/16", value: 0.0625 },
            { label: "left", value: 0.0625 },
          ],
        },
      ],
    },
    caption: "Each piece is half the one before, and what is left always equals the last piece, so the pieces close in on exactly 1.",
    why: [
      "S − rS cancels every middle term and leaves a₁ − a₁rⁿ, which gives S = a₁(1 − rⁿ)/(1 − r).",
      "When |r| < 1, rⁿ shrinks toward 0 as n grows, so the sum settles at a₁/(1 − r).",
      "When |r| ≥ 1 the terms keep their size or grow, so an infinite sum grows without limit.",
    ],
  },

  "sigma-notation": {
    idea: "Σ is a capital Greek S, for sum. Σ from k = 1 to 6 of (3k − 2) is a short way to write: put k = 1, 2, 3, 4, 5, 6 into 3k − 2, then add the results. The bottom number is where k starts, the top is where it stops, and the rule on the right builds each term.",
    everyday: "A workout plan has you do 3k − 2 push-ups on day k: 1, 4, 7, 10, 13 and 16 over six days. The total is Σ from k = 1 to 6 of (3k − 2) = 51 push-ups.",
    picture: {
      kind: "table",
      headers: ["k", "3k − 2", "running total"],
      rows: [
        ["1", "1", "1"],
        ["2", "4", "5"],
        ["3", "7", "12"],
        ["4", "10", "22"],
        ["5", "13", "35"],
        ["6", "16", "51"],
      ],
      note: "6 − 1 + 1 = 6 terms add up to 51.",
    },
    caption: "The k column is the counter, the middle column is each term, and the last running total is the value of the sigma.",
    why: [
      "Sigma is shorthand: it lists every term from the rule, so writing the terms out is always allowed.",
      "From k = m to k = n there are n − m + 1 terms, because both ends count.",
    ],
  },

  "radians-degrees": {
    idea: "Radians measure an angle by arc length. Lay the circle's radius along its edge: the angle that covers one radius of edge is 1 radian. A half turn covers π radii, so 180° = π radians. To convert, multiply degrees by π/180, or radians by 180/π. Then an arc is just s = rθ.",
    everyday: "A pizza 12 inches across has a 6-inch radius. A 60° slice is π/3 radians, so its crust is 6 × π/3 = 2π ≈ 6.3 inches long.",
    picture: { kind: "chain", steps: ["240°", "× π/180", "240π/180", "÷ 60 top and bottom", "4π/3 radians"] },
    caption: "Multiplying by π/180 changes only the units, since π radians and 180° are the same half turn.",
    why: [
      "π/180° equals 1 because both parts mean a half turn, and multiplying by 1 keeps the angle the same.",
      "An angle of θ radians cuts an arc θ radii long, which is why s = rθ needs the angle in radians.",
    ],
  },

  "unit-circle-values": {
    idea: "The unit circle has radius 1 and its center at (0, 0). Turn θ from the positive x-axis and you land on a point: its x-coordinate is cos θ and its y-coordinate is sin θ. The quadrant tells the signs, since x is negative on the left and y is negative below. The 30°, 45° and 60° triangles give the sizes.",
    everyday: "A Ferris wheel seat 20 m from the center, at 30° above the horizontal, is 20 × sin 30° = 10 m above the center and 20 × cos 30° ≈ 17.3 m to the side.",
    picture: { kind: "unitCircle", angles: [30, 135, 210, 300] },
    caption: "Each marked point is (cos θ, sin θ). The 135° point is (−√2/2, √2/2): negative x on the left side, positive y up top.",
    why: [
      "The radius is 1, so the point's coordinates are the legs of a right triangle: cos θ across and sin θ up.",
      "Points that mirror each other across an axis have the same sizes and opposite signs, so one special triangle covers all four quadrants.",
    ],
  },

  "reference-angles": {
    idea: "A reference angle is the sharp angle between an angle's side and the nearest part of the x-axis. 150°, 210° and 330° each sit 30° from the x-axis, so all three have reference angle 30°. Their sine and cosine have the same sizes as for 30°, and the quadrant decides the signs.",
    everyday: "On a Ferris wheel with a 40-foot radius, seats at 30° and 150° are both 40 × sin 30° = 20 feet above the center: the same height on opposite sides.",
    picture: { kind: "unitCircle", angles: [30, 150, 210, 330] },
    caption: "The four points mirror each other across the axes, so they share the sizes √3/2 and 1/2 and differ only in their signs.",
    why: [
      "Quadrant II: 180° − θ. Quadrant III: θ − 180°. Quadrant IV: 360° − θ. Each one measures the gap to the x-axis.",
      "Reflecting a point across an axis keeps its distances from both axes and flips one sign.",
    ],
  },
};
