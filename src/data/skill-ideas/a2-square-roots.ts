import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 2, unit 1: square roots, up to i (types.ts). */
export const IDEAS: SkillIdeas = {
  "square-roots": {
    idea: "Squaring a number multiplies it by itself: 7² = 49. A square root runs that backwards and asks which number times itself makes 49. The √ sign means the positive answer, so √49 = 7. An equation like x² = 49 wants every answer, and −7 works too, so x = ±7.",
    everyday: "A square garden bed covers 49 square feet. How long is each side? √49 = 7 feet. The negative answer, −7, makes no sense for a length, which is why √ means the positive root.",
    picture: {
      kind: "table",
      headers: ["n", "n²", "√(n²)"],
      rows: [
        ["5", "25", "5"],
        ["6", "36", "6"],
        ["7", "49", "7"],
        ["−7", "49", "7"],
      ],
      note: "7 and −7 both square to 49, and √49 picks the positive one.",
    },
    caption: "Squaring and square roots undo each other. Two numbers square to 49, so x² = 49 has two solutions.",
    why: [
      "√n is the positive number whose square is n, so √49 = 7.",
      "x² = n with n positive has two solutions, x = √n and x = −√n, because (−√n)² = n as well.",
    ],
  },

  "negative-square-roots": {
    idea: "Where the minus sits changes everything. −√49 means take √49 = 7 and then make it negative: −7, a real number. √(−49) asks for a number whose square is −49, and every real number squared is zero or positive. So no real number works. Mathematicians invented a new number, i, exactly to answer it.",
    everyday: "Think of a calculator. Type −√49 and it shows −7. Type √(−49) and it shows an error, since a real calculator has no number to give. The next unit is the upgrade that removes that error.",
    picture: {
      kind: "numberLine",
      min: -8,
      max: 8,
      marks: [
        { at: -7, label: "−√49" },
        { at: 0, label: "0" },
        { at: 7, label: "√49" },
      ],
      segment: { from: 0, to: 8, closedFrom: true, closedTo: false },
    },
    caption: "Every real square lands on the shaded part, 0 or above. A square of −49 would need a spot off this line, which is where i lives.",
    why: [
      "A positive times a positive is positive, and a negative times a negative is positive, so x² ≥ 0 for every real x.",
      "That makes x² = −49 impossible with real numbers. The number i, with i² = −1, is built to solve it: x = ±7i.",
    ],
  },

  "simplify-square-roots": {
    idea: "√72 is a perfectly good number, and it can be written more simply. Split 72 into a perfect square times what is left: 72 = 36 · 2. The root of 36 is 6, a whole number, so it comes out front, and √2 stays inside. √72 = 6√2, same value, smaller root.",
    everyday: "It is like reducing a fraction: 18/24 and 3/4 are the same amount, and 3/4 is easier to read. 6√2 and √72 are the same length, and 6√2 shows its size at a glance.",
    picture: {
      kind: "chain",
      steps: ["√72", "√(36 · 2)", "√36 · √2", "6√2"],
    },
    caption: "Pull out the largest perfect square. Its root moves out front, and only the square-free part stays under the root.",
    why: [
      "√(ab) = √a · √b for a and b at least 0, so a perfect-square factor can be rooted on its own.",
      "Use the largest perfect square, or you will need a second pass: √72 = 2√18 = 2 · 3√2 = 6√2.",
    ],
  },

  "operations-square-roots": {
    idea: "Roots follow the rules you already know. Like roots add like like terms: 3√2 + 5√2 = 8√2, just as 3x + 5x = 8x. To multiply, put both numbers under one root: √3 · √12 = √36 = 6. And squaring undoes a root, so a real number squared always lands at zero or above. That last fact is the wall that i climbs over.",
    everyday: "Square tiles 3√2 inches wide are about 4.24 inches. Lay three of them and then five more in a row and the row is 8√2 inches, about 11.3 inches. You count tiles, the √2 is the tile size.",
    picture: {
      kind: "area",
      rows: ["√3"],
      cols: ["√12"],
      cells: [["√36 = 6"]],
      total: "√3 · √12 = 6",
    },
    caption: "A rectangle √3 wide and √12 long has area √36, which is exactly 6 square units.",
    why: [
      "√a · √b = √(ab) holds when a and b are 0 or above. With negatives it breaks: √(−4) · √(−9) is −6, not √36 = 6.",
      "(√n)² = n and (−√n)² = n, so every real square is positive or zero.",
    ],
  },
};
