/**
 * The golden rules and patterns of each skill, shown beside the problem as
 * notes: the thing a teacher would write in the margin. Each rule is one
 * sentence a student can act on, with a tiny worked example in numbers no
 * generated problem uses as its question.
 *
 * Every skill in both courses has an entry (tested in practice.test.ts).
 */

export interface SkillRule {
  rule: string;
  /** A one-line worked example. */
  example?: string;
}

export const SKILL_RULES: Record<string, SkillRule[]> = {
  // ===================== Algebra 1 =====================
  "unit-basics": [
    { rule: "Multiply by a conversion fraction equal to 1, with the unit you want on top.", example: "2 mi × (5,280 ft / 1 mi) = 10,560 ft" },
    { rule: "Big unit to small unit: the number gets bigger. Small to big: it gets smaller.", example: "3 m = 300 cm, but 300 cm = 3 m" },
  ],
  "dimensional-analysis": [
    { rule: "Units cancel like numbers: a unit on top cancels the same unit on the bottom.", example: "(km / h) × (h / 60 min) = km / min" },
    { rule: "Chain one fraction per step until only the unit you want is left.", example: "1 h × (60 min / 1 h) × (60 s / 1 min) = 3,600 s" },
  ],
  "unit-word-problems": [
    { rule: "Write down the unit you start with and the unit you need before any math.", example: "Have: mL. Need: L. So divide by 1,000." },
    { rule: "A rate is a fraction: miles per gallon means miles ÷ gallons.", example: "240 mi on 8 gal = 240 ÷ 8 = 30 mpg" },
  ],

  "one-step-equations": [
    { rule: "Do the opposite operation to both sides: add undoes subtract, multiply undoes divide.", example: "x − 9 = 4 → x = 4 + 9 = 13" },
    { rule: "Check by putting your answer back in.", example: "13 − 9 = 4 ✓" },
  ],
  "two-step-equations": [
    { rule: "Undo in reverse order: first the adding or subtracting, then the multiplying or dividing.", example: "3x + 5 = 26 → 3x = 21 → x = 7" },
    { rule: "Whatever you do to one side, do to the other.", example: "3x = 21 → divide both sides by 3" },
  ],
  "multi-step-equations": [
    { rule: "Clean up each side first: distribute, then combine like terms.", example: "2(x + 3) + x = 3x + 6" },
    { rule: "Get the x terms on one side by subtracting the smaller one.", example: "5x + 2 = 2x + 11 → 3x = 9 → x = 3" },
  ],
  "equations-with-fractions": [
    { rule: "Multiply every term by the common denominator and the fractions disappear.", example: "x/3 + 1/2 = 5/6 → × 6 → 2x + 3 = 5" },
    { rule: "Multiply every term, including the ones with no fraction.", example: "x/4 + 2 = 5 → × 4 → x + 8 = 20" },
  ],
  "linear-inequalities": [
    { rule: "Solve it like an equation.", example: "2x + 1 < 9 → 2x < 8 → x < 4" },
    { rule: "Multiplying or dividing by a negative flips the sign.", example: "−3x > 12 → x < −4" },
  ],

  "coordinate-plane": [
    { rule: "(x, y): x goes right or left first, then y goes up or down.", example: "(3, −2): right 3, down 2" },
    { rule: "Quadrants count counterclockwise from the top right.", example: "I (+, +), II (−, +), III (−, −), IV (+, −)" },
    { rule: "Same x: the distance is the gap in y. Same y: the gap in x.", example: "(4, 1) to (4, 7) is 7 − 1 = 6 apart" },
  ],
  slope: [
    { rule: "Slope = rise over run = (y₂ − y₁) / (x₂ − x₁). Subtract in the same order on top and bottom.", example: "(1, 2) and (3, 8): (8 − 2) / (3 − 1) = 3" },
    { rule: "Up to the right is positive, down to the right is negative.", example: "Flat line: slope 0. Vertical line: undefined." },
  ],
  "graphing-lines": [
    { rule: "In y = mx + b, start at b on the y-axis.", example: "y = 2x − 1 crosses at (0, −1)" },
    { rule: "Then use the slope as rise over run to find the next point.", example: "m = 2 = 2/1: up 2, right 1 → (1, 1)" },
  ],
  intercepts: [
    { rule: "y-intercept: set x = 0. x-intercept: set y = 0.", example: "2x + 3y = 12: y-int 4, x-int 6" },
    { rule: "An intercept is a point on an axis, so one coordinate is always 0.", example: "x-intercept (6, 0), y-intercept (0, 4)" },
  ],
  "slope-intercept": [
    { rule: "y = mx + b: m is the slope, b is where it crosses the y-axis.", example: "y = −3x + 5: slope −3, crosses at 5" },
    { rule: "Get y alone to read m and b.", example: "2y = 4x + 6 → y = 2x + 3" },
  ],
  "point-slope": [
    { rule: "y − y₁ = m(x − x₁) uses one point and the slope.", example: "Through (2, 5), slope 3: y − 5 = 3(x − 2)" },
    { rule: "A negative coordinate turns into a plus.", example: "Through (−4, 1): y − 1 = m(x + 4)" },
  ],
  "standard-form": [
    { rule: "Standard form is Ax + By = C with whole numbers and A not negative.", example: "y = 2x + 3 → −2x + y = 3 → 2x − y = −3" },
    { rule: "Solve for y to read the slope: m = −A/B.", example: "3x + 4y = 8 → slope −3/4" },
  ],
  "parallel-perpendicular": [
    { rule: "Parallel lines have the same slope.", example: "y = 2x + 1 and y = 2x − 7" },
    { rule: "Perpendicular slopes are negative reciprocals: flip the fraction, change the sign.", example: "2/3 → −3/2, and −4 → 1/4" },
  ],

  "graphing-systems": [
    { rule: "The solution is the point where the lines cross.", example: "y = x + 1 and y = −x + 5 meet at (2, 3)" },
    { rule: "Same slope, different intercepts: parallel, no solution. Same line: infinitely many.", example: "y = 2x + 1 and y = 2x + 4: no solution" },
  ],
  substitution: [
    { rule: "Get one variable alone, then put that expression into the other equation.", example: "y = x + 2 into 3x + y = 10 → 3x + x + 2 = 10" },
    { rule: "Solve for one variable, then plug it back in to get the other.", example: "x = 2 → y = 2 + 2 = 4" },
  ],
  elimination: [
    { rule: "Add or subtract the equations so one variable cancels.", example: "(x + y = 7) + (x − y = 1) → 2x = 8" },
    { rule: "Multiply one equation first if no variable cancels yet.", example: "2x + y = 5 and x + 3y = 10: multiply the first by 3" },
  ],
  "systems-word-problems": [
    { rule: "Name two unknowns, then write one equation per fact in the story.", example: "a adults, k kids: a + k = 9 people, 8a + 5k = $57" },
    { rule: "One equation usually counts things; the other counts their cost or value.", example: "how many tickets, and how much money" },
  ],

  "graphing-inequalities": [
    { rule: "Dashed line for < or >; solid line for ≤ or ≥.", example: "y < 2x + 1: dashed" },
    { rule: "With y alone: shade above for >, below for <. Test (0, 0) if unsure.", example: "y > x − 3: 0 > −3 is true, so shade the side with (0, 0)" },
  ],
  "compound-inequalities": [
    { rule: "AND means both are true at once: the overlap.", example: "x > 2 AND x < 6 → 2 < x < 6" },
    { rule: "OR means either one: both pieces.", example: "x < −1 OR x > 4" },
    { rule: "Do the same step to all three parts of a sandwich.", example: "1 < x + 3 < 8 → −2 < x < 5" },
  ],
  "systems-inequalities": [
    { rule: "A solution has to make every inequality true.", example: "(1, 1) in y > x − 2 and y < 3: 1 > −1 ✓, 1 < 3 ✓" },
    { rule: "The answer region is where the shadings overlap.", example: "Above one line and below the other" },
  ],

  "function-notation": [
    { rule: "f(x) is the output when the input is x. Swap x for the number in brackets.", example: "f(x) = 3x − 1, f(4) = 3(4) − 1 = 11" },
    { rule: "Put a negative input in brackets.", example: "f(−2) = 3(−2) − 1 = −7" },
  ],
  "domain-range": [
    { rule: "Domain = the inputs allowed. Range = the outputs you get.", example: "{(1, 4), (2, 6)}: domain {1, 2}, range {4, 6}" },
    { rule: "No dividing by zero: an x that makes the bottom 0 is left out.", example: "1/(x − 5): x ≠ 5" },
  ],
  "function-graphs": [
    { rule: "Average rate of change = change in output ÷ change in input.", example: "From (1, 3) to (4, 12): (12 − 3) / (4 − 1) = 3" },
    { rule: "Read the graph left to right: going up means increasing.", example: "Flat means the output is not changing" },
  ],

  "arithmetic-sequences": [
    { rule: "Arithmetic: add the same number d each time.", example: "4, 7, 10, 13 → d = 3" },
    { rule: "aₙ = a₁ + (n − 1)d: you add d one time fewer than the term number.", example: "10th term: 4 + 9 × 3 = 31" },
  ],
  "geometric-sequences": [
    { rule: "Geometric: multiply by the same ratio r each time. r = any term ÷ the one before it.", example: "3, 6, 12, 24 → r = 2" },
    { rule: "aₙ = a₁ × r^(n − 1).", example: "6th term: 3 × 2⁵ = 96" },
  ],

  "exponent-rules": [
    { rule: "Multiply with the same base: add the exponents.", example: "x³ · x⁴ = x⁷" },
    { rule: "Divide with the same base: subtract the exponents.", example: "x⁸ / x² = x⁶" },
    { rule: "Power of a power: multiply the exponents. Anything (not 0) to the 0 is 1.", example: "(x²)⁵ = x¹⁰, 7⁰ = 1" },
  ],
  "negative-fractional-exponents": [
    { rule: "A negative exponent means flip it: one over the positive power.", example: "2^(−3) = 1/2³ = 1/8" },
    { rule: "A fraction exponent is a root: the bottom is the root, the top is the power.", example: "27^(1/3) = ∛27 = 3, 8^(2/3) = 4" },
  ],
  "scientific-notation": [
    { rule: "a × 10ⁿ with 1 ≤ a < 10. Count how far the decimal moves.", example: "45,000 = 4.5 × 10⁴" },
    { rule: "Small numbers get a negative power.", example: "0.0032 = 3.2 × 10^(−3)" },
    { rule: "Multiply: multiply the fronts, add the powers.", example: "(2 × 10³)(4 × 10⁵) = 8 × 10⁸" },
  ],
  "simplifying-radicals": [
    { rule: "Pull out the biggest perfect square inside.", example: "√72 = √(36 · 2) = 6√2" },
    { rule: "Know your squares: 4, 9, 16, 25, 36, 49, 64, 81, 100.", example: "√50 = √(25 · 2) = 5√2" },
  ],

  "exponential-functions": [
    { rule: "y = a · bˣ: a is the start, b is what it multiplies by each step.", example: "y = 5 · 2ˣ starts at 5 and doubles" },
    { rule: "b > 1 grows; 0 < b < 1 shrinks.", example: "0.5 halves each step" },
  ],
  "exponential-growth": [
    { rule: "Growth by r percent: multiply by (1 + r) each period.", example: "Grows 6% a year: × 1.06" },
    { rule: "y = a(1 + r)ᵗ, with t the number of periods.", example: "$500 at 4% for 3 years: 500 × 1.04³" },
  ],
  "exponential-decay": [
    { rule: "Decay by r percent: multiply by (1 − r) each period.", example: "Loses 20% a year: × 0.8" },
    { rule: "y = a(1 − r)ᵗ. It never reaches 0.", example: "$1,000 losing 10% for 2 years: 1,000 × 0.9² = 810" },
  ],

  "multiplying-binomials": [
    { rule: "FOIL: First, Outer, Inner, Last, then combine the middle.", example: "(x + 3)(x + 5) = x² + 5x + 3x + 15 = x² + 8x + 15" },
    { rule: "Keep each sign with its term.", example: "(x − 2)(x + 4) = x² + 2x − 8" },
  ],
  "special-products": [
    { rule: "(a + b)² = a² + 2ab + b². The middle term is not optional.", example: "(x + 4)² = x² + 8x + 16, not x² + 16" },
    { rule: "(a + b)(a − b) = a² − b²: the middle cancels.", example: "(x + 6)(x − 6) = x² − 36" },
  ],
  "factoring-trinomials": [
    { rule: "x² + bx + c: find two numbers that multiply to c and add to b.", example: "x² + 7x + 12: 3 and 4 → (x + 3)(x + 4)" },
    { rule: "c negative: the signs differ. c positive: both signs match b.", example: "x² − x − 12 = (x − 4)(x + 3)" },
  ],
  "factoring-special": [
    { rule: "Difference of squares: a² − b² = (a + b)(a − b).", example: "x² − 49 = (x + 7)(x − 7)" },
    { rule: "Perfect square: a² + 2ab + b² = (a + b)².", example: "x² + 10x + 25 = (x + 5)²" },
    { rule: "A sum of squares does not factor.", example: "x² + 9 stays as it is" },
  ],

  "graphing-parabolas": [
    { rule: "y = ax² + bx + c opens up when a > 0, down when a < 0.", example: "y = −2x² + 3 opens down" },
    { rule: "The vertex is at x = −b / (2a).", example: "y = x² − 6x + 1: x = 3" },
  ],
  "solving-by-factoring": [
    { rule: "Get 0 on one side, factor, then set each factor to 0.", example: "x² − 5x + 6 = 0 → (x − 2)(x − 3) = 0 → x = 2 or 3" },
    { rule: "Each factor gives the opposite sign.", example: "(x + 4) = 0 → x = −4" },
  ],
  "completing-square": [
    { rule: "Move c across, then add (b/2)² to both sides.", example: "x² + 6x = 7 → add 9 → (x + 3)² = 16" },
    { rule: "Take the square root with ± and solve both.", example: "x + 3 = ±4 → x = 1 or x = −7" },
  ],
  "quadratic-formula": [
    { rule: "x = (−b ± √(b² − 4ac)) / (2a) for ax² + bx + c = 0.", example: "x² − 2x − 3 = 0: (2 ± √16)/2 = 3 or −1" },
    { rule: "b² − 4ac decides: positive two solutions, 0 one, negative none that are real.", example: "x² + x + 5: 1 − 20 = −19 → no real solution" },
  ],

  "absolute-value": [
    { rule: "Get the absolute value alone, then split: |stuff| = a means stuff = a or stuff = −a.", example: "|x − 2| = 5 → x = 7 or x = −3" },
    { rule: "Absolute value is never negative.", example: "|x| = −4 has no solution" },
  ],
  "absolute-value-inequalities": [
    { rule: "Less than: one sandwich (AND).", example: "|x| < 3 → −3 < x < 3" },
    { rule: "Greater than: two pieces (OR).", example: "|x| > 3 → x < −3 or x > 3" },
  ],
  "piecewise-functions": [
    { rule: "First find which piece's condition your input meets, then use only that piece.", example: "f(x) = x + 1 if x < 2; 3x if x ≥ 2. f(2) uses 3x = 6" },
    { rule: "Watch the edges: ≤ and ≥ include the endpoint.", example: "x ≥ 2 includes 2" },
  ],

  "center-spread": [
    { rule: "Mean = sum ÷ count. Median = the middle of the sorted list.", example: "2, 3, 9: mean 14/3 ≈ 4.7, median 3" },
    { rule: "IQR = Q3 − Q1. An outlier pulls the mean, barely the median.", example: "Outlier if below Q1 − 1.5·IQR or above Q3 + 1.5·IQR" },
  ],
  "trend-lines": [
    { rule: "The slope is how much y changes when x goes up by 1.", example: "y = 3x + 20: each extra hour adds 3" },
    { rule: "r close to 1 or −1 is a strong line; close to 0 is weak. Correlation is not cause.", example: "r = −0.92: strong, going down" },
  ],
  "two-way-tables": [
    { rule: "Joint = cell ÷ grand total. Marginal = row or column total ÷ grand total.", example: "12 of 80 = 0.15" },
    { rule: "Conditional: divide by the total of the group you are told about.", example: "Of the 30 who play sports, 12 → 12/30 = 0.4" },
  ],

  "literal-equations": [
    { rule: "Treat every other letter like a number and undo operations in reverse.", example: "P = 2l + 2w → P − 2l = 2w → w = (P − 2l)/2" },
    { rule: "Whatever you divide by goes under the whole other side.", example: "A = bh → h = A / b" },
  ],
  "function-transformations": [
    { rule: "Outside the bracket moves up and down: f(x) + 3 is up 3.", example: "f(x) − 2 is down 2" },
    { rule: "Inside the bracket does the opposite of the sign: f(x − 4) is right 4.", example: "f(x + 1) is left 1" },
    { rule: "A minus in front flips it over the x-axis.", example: "−f(x) turns an up-parabola into a down one" },
  ],
  "linear-vs-exponential": [
    { rule: "Linear adds the same amount each step: check the differences.", example: "5, 8, 11, 14: + 3 each time" },
    { rule: "Exponential multiplies by the same factor: check the ratios.", example: "5, 10, 20, 40: × 2 each time" },
    { rule: "Exponential always wins in the long run.", example: "2ˣ passes 100x by x = 10" },
  ],

  // ===================== Algebra 2 =====================
  "imaginary-unit": [
    { rule: "i = √(−1), and i² = −1. That one fact does all the work.", example: "i² = −1, so 5i · 2i = 10i² = −10" },
    { rule: "Pull the i out of a negative root before you do anything else.", example: "√(−36) = √36 · i = 6i" },
    { rule: "Never multiply two negative roots under one root: take out the i's first.", example: "√(−4) · √(−9) = 2i · 3i = 6i² = −6, not √36 = 6" },
    { rule: "Powers of i repeat every 4: i, −1, −i, 1. Divide the power by 4 and use the remainder.", example: "i¹⁰: 10 ÷ 4 leaves 2 → i² = −1" },
  ],
  "complex-arithmetic": [
    { rule: "Add and subtract: real with real, i with i.", example: "(3 + 2i) + (1 − 5i) = 4 − 3i" },
    { rule: "Multiply with FOIL, then turn every i² into −1.", example: "(2 + i)(3 + i) = 6 + 5i + i² = 5 + 5i" },
    { rule: "A number times its conjugate is a real number: (a + bi)(a − bi) = a² + b².", example: "(3 + 4i)(3 − 4i) = 9 + 16 = 25" },
  ],
  "complex-roots": [
    { rule: "x² = −n gives x = ±i√n.", example: "x² = −25 → x = ±5i" },
    { rule: "b² − 4ac < 0 means no real solutions: the two solutions are complex.", example: "x² + 2x + 5: 4 − 20 = −16 → x = −1 ± 2i" },
    { rule: "Modulus |a + bi| = √(a² + b²), the distance from 0.", example: "|6 + 8i| = √(36 + 64) = 10" },
  ],

  "polynomial-end-behavior": [
    { rule: "Degree = the highest power. Leading coefficient = the number in front of it, wherever the term is written.", example: "4 + x − 2x³: degree 3, leading coefficient −2" },
    { rule: "Even degree: both ends point the same way. Odd degree: opposite ways.", example: "x⁴ both up; x³ down on the left, up on the right" },
    { rule: "A negative leading coefficient flips the picture.", example: "−x⁴: both ends down" },
  ],
  "polynomial-division": [
    { rule: "Dividing by x − k: use k in synthetic division. By x + k: use −k.", example: "÷ (x + 2) → use −2" },
    { rule: "Bring down, multiply by k, add. Repeat. The last number is the remainder.", example: "x² + 3x + 5 ÷ (x − 1): 1, 4, 9 → x + 4, remainder 9" },
    { rule: "Write a 0 for every missing power.", example: "x³ + 2 → coefficients 1, 0, 0, 2" },
  ],
  "remainder-factor-theorem": [
    { rule: "The remainder after dividing by x − k equals P(k).", example: "P(x) = x² + 1 ÷ (x − 3): remainder P(3) = 10" },
    { rule: "x − k is a factor exactly when P(k) = 0.", example: "P(x) = x² − 9: P(3) = 0, so x − 3 is a factor" },
    { rule: "Once you know one factor, divide it out and factor what is left.", example: "x³ − 7x + 6 ÷ (x − 1) = x² + x − 6 = (x + 3)(x − 2)" },
  ],

  "vertex-form": [
    { rule: "y = a(x − h)² + k has vertex (h, k): flip the sign inside, keep the sign outside.", example: "y = (x + 2)² − 5 → vertex (−2, −5)" },
    { rule: "a > 0: k is the minimum. a < 0: k is the maximum.", example: "y = −3(x − 1)² + 4: max 4" },
    { rule: "To get there, complete the square: x² + bx + (b/2)² − (b/2)².", example: "x² + 4x + 1 = (x + 2)² − 3" },
  ],
  discriminant: [
    { rule: "Discriminant D = b² − 4ac. Square b first; a negative b squares to positive.", example: "2x² − 5x + 1: D = 25 − 8 = 17" },
    { rule: "D > 0: two real solutions. D = 0: one. D < 0: two complex.", example: "x² + 4x + 4: D = 0, one solution" },
    { rule: "For exactly one solution, set b² − 4ac = 0 and solve.", example: "x² + 6x + c: 36 − 4c = 0 → c = 9" },
  ],
  "linear-quadratic-systems": [
    { rule: "Set the line equal to the parabola and move everything to one side.", example: "x² + 1 = 2x + 4 → x² − 2x − 3 = 0" },
    { rule: "The number of real roots is the number of meeting points: 0, 1 or 2.", example: "(x − 3)(x + 1) = 0 → two points" },
    { rule: "Plug each x into the line to get its y.", example: "x = 3 → y = 2(3) + 4 = 10" },
  ],

  "simplify-rational": [
    { rule: "Factor the top and the bottom first. Only whole factors cancel, never single terms.", example: "(x² − 9)/(x + 3) = (x + 3)(x − 3)/(x + 3) = x − 3" },
    { rule: "Excluded values make the original bottom 0, even after canceling.", example: "(x + 1)/(x² − 4): x ≠ 2, x ≠ −2" },
  ],
  "multiply-divide-rational": [
    { rule: "Factor everything, cancel any factor on a top with the same factor on a bottom, then multiply.", example: "(x + 2)/(x − 1) × (x − 1)/5 = (x + 2)/5" },
    { rule: "Dividing: flip the second fraction and multiply.", example: "a/b ÷ c/d = a/b × d/c" },
  ],
  "rational-equations": [
    { rule: "Multiply every term by the common denominator to clear the fractions.", example: "6/x + 1 = 4 → 6 + x = 4x → x = 2" },
    { rule: "Check every answer: one that makes a bottom 0 is extraneous and gets thrown out.", example: "If x = 3 makes x − 3 = 0, reject it" },
    { rule: "Working together: add the rates. 1/a + 1/b = 1/t.", example: "3 h and 6 h: 1/3 + 1/6 = 1/2 → 2 h together" },
  ],

  "nth-roots": [
    { rule: "ⁿ√ undoes an nth power. Know the cubes: 8, 27, 64, 125, 216, 343.", example: "∛64 = 4 because 4³ = 64" },
    { rule: "Odd roots of negatives are fine; even roots of negatives are not real.", example: "∛(−27) = −3, but ⁴√(−16) is not real" },
    { rule: "Pull out the biggest perfect cube. Add only like radicals.", example: "∛54 = ∛(27 · 2) = 3∛2; 2∛5 + 4∛5 = 6∛5" },
  ],
  "rational-exponents-evaluate": [
    { rule: "b^(p/q): the bottom q is the root, the top p is the power. Root first, it keeps the numbers small.", example: "8^(2/3) = (∛8)² = 2² = 4" },
    { rule: "A negative exponent flips it into a fraction.", example: "16^(−1/2) = 1/√16 = 1/4" },
    { rule: "Exponent rules still work: multiply the fractions for a power of a power.", example: "(x^(1/3))⁶ = x²" },
  ],
  "radical-equations": [
    { rule: "Get the radical alone first, then square both sides (cube for ∛).", example: "√(x + 1) − 2 = 3 → √(x + 1) = 5 → x + 1 = 25" },
    { rule: "Always check in the original: squaring can create a fake solution.", example: "√x = −3 has no solution, even though 9 squares to it" },
  ],

  "log-basics": [
    { rule: "log_b(n) asks: b to what power gives n?", example: "log₂(32) = 5 because 2⁵ = 32" },
    { rule: "log_b(n) = k is the same fact as bᵏ = n.", example: "log₃(81) = 4 ⟷ 3⁴ = 81" },
    { rule: "log_b(1) = 0 and log_b(b) = 1. log with no base is base 10; ln is base e.", example: "log(1,000) = 3, ln(e⁵) = 5" },
  ],
  "log-properties": [
    { rule: "Product: log(ab) = log a + log b.", example: "log(5) + log(20) = log(100) = 2" },
    { rule: "Quotient: log(a/b) = log a − log b.", example: "log₂(48) − log₂(3) = log₂(16) = 4" },
    { rule: "Power: log(aⁿ) = n · log a. The exponent comes down in front.", example: "log(x³) = 3 log x" },
  ],
  "solve-exponential-equations": [
    { rule: "Same base on both sides? Set the exponents equal.", example: "2^(x + 1) = 2⁵ → x + 1 = 5 → x = 4" },
    { rule: "Rewrite with a shared base when you can.", example: "4ˣ = 8 → 2^(2x) = 2³ → x = 3/2" },
    { rule: "No shared base: get the power alone, take a log, bring the exponent down.", example: "3ˣ = 20 → x = log 20 / log 3 ≈ 2.73" },
  ],

  "arithmetic-series": [
    { rule: "Sum = number of terms × average of the first and last: Sₙ = n(a₁ + aₙ)/2.", example: "2 + 5 + 8 + 11 + 14: 5 × (2 + 14)/2 = 40" },
    { rule: "Need the last term? aₙ = a₁ + (n − 1)d.", example: "a₁ = 2, d = 3, 20th term = 2 + 19 × 3 = 59" },
    { rule: "Number of terms = (last − first) / d + 1.", example: "4, 7, ..., 40: (40 − 4)/3 + 1 = 13 terms" },
  ],
  "geometric-series": [
    { rule: "Finite: Sₙ = a₁(1 − rⁿ)/(1 − r).", example: "1 + 3 + 9 + 27: (1 − 81)/(1 − 3) = 40" },
    { rule: "Infinite: only when |r| < 1, and then S = a₁/(1 − r).", example: "8 + 4 + 2 + ...: 8/(1 − 1/2) = 16" },
    { rule: "|r| ≥ 1: the infinite sum has no limit.", example: "3 + 6 + 12 + ... diverges" },
  ],
  "sigma-notation": [
    { rule: "Σ from k = m to n: plug in every whole number from m to n, then add.", example: "Σ k=1 to 3 of (2k) = 2 + 4 + 6 = 12" },
    { rule: "Count the terms: n − m + 1.", example: "k = 4 to 10: 7 terms" },
    { rule: "Σ of (ak + b) is an arithmetic series, so use n × (first + last)/2.", example: "Σ k=1 to 10 of (3k): 10 × (3 + 30)/2 = 165" },
  ],

  "radians-degrees": [
    { rule: "180° = π radians.", example: "90° = π/2, 60° = π/3, 45° = π/4" },
    { rule: "Degrees to radians: × π/180. Radians to degrees: × 180/π.", example: "150° × π/180 = 5π/6" },
    { rule: "Arc length s = rθ, with θ in radians.", example: "r = 4, θ = π/2 → s = 2π ≈ 6.28" },
  ],
  "unit-circle-values": [
    { rule: "On the unit circle, cos θ is x and sin θ is y. tan θ = sin θ / cos θ.", example: "90° is (0, 1): cos 0, sin 1" },
    { rule: "Special values: 30° (√3/2, 1/2), 45° (√2/2, √2/2), 60° (1/2, √3/2).", example: "sin 60° = √3/2" },
    { rule: "All Students Take Calculus: in Quadrant I all are positive, II sin, III tan, IV cos.", example: "cos 150° is negative (Quadrant II)" },
  ],
  "reference-angles": [
    { rule: "Reference angle = the acute angle to the x-axis.", example: "QII: 180° − θ. QIII: θ − 180°. QIV: 360° − θ" },
    { rule: "Coterminal: add or subtract 360° until it lands between 0° and 360°.", example: "−60° + 360° = 300°" },
    { rule: "The size comes from the reference angle; the sign comes from the quadrant.", example: "sin 210° = −sin 30° = −1/2" },
    { rule: "sin²θ + cos²θ = 1 finds one from the other.", example: "sin θ = 3/5 → cos θ = ±4/5, sign by quadrant" },
  ],
};

export function rulesForSkill(skillId: string): SkillRule[] {
  return SKILL_RULES[skillId] ?? [];
}
