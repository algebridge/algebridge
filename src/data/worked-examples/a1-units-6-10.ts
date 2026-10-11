import type { WorkedExamples } from "./types";

/** Algebra 1, units 6 to 10: inequalities, functions, sequences, exponents and exponential models. */
export const EXAMPLES: WorkedExamples = {
  "graphing-inequalities": [
    {
      kind: "Dashed or solid, shade above or below",
      card: {
        type: "multiple-choice",
        prompt: "How do you graph y ≥ 2x − 3?",
        choices: ["Solid line, shade above", "Solid line, shade below", "Dashed line, shade above", "Dashed line, shade below"],
        answer: "Solid line, shade above",
      },
      steps: [
        { work: "≥ includes the line, so the line is solid", why: "≤ and ≥ count the boundary itself, so draw it solid." },
        { work: "y ≥ means y-values above the line, so shade above", why: "With y alone, greater than means the side above the line." },
      ],
      answer: "Solid line, shade above",
    },
    {
      kind: "Testing which point is a solution",
      card: {
        type: "multiple-choice",
        prompt: "Which point is a solution of y < -x + 4?",
        choices: ["(1, 1)", "(1, 5)", "(2, 2)", "(-1, 6)"],
        answer: "(1, 1)",
      },
      steps: [
        { work: "at x = 1: -(1) + 4 = 3", why: "Put the point's x into the right side first." },
        { work: "1 < 3 is true", why: "Compare the point's y with that value using the sign." },
        { work: "(1, 1) is a solution", why: "A point is a solution when it makes the inequality true." },
      ],
      answer: "(1, 1)",
    },
    {
      kind: "Solving for y with a negative y term",
      card: {
        type: "multiple-choice",
        prompt: "Which inequality is 3x − 2y < 8 solved for y?",
        choices: ["y > (3/2)x − 4", "y < (3/2)x − 4", "y > -(3/2)x − 4", "y > (3/2)x + 4"],
        answer: "y > (3/2)x − 4",
      },
      steps: [
        { work: "-2y < -3x + 8", why: "Subtract 3x from both sides to move the x term across." },
        { work: "y > (3/2)x − 4", why: "Divide every term by -2. Dividing by a negative flips the sign." },
      ],
      answer: "y > (3/2)x − 4",
    },
    {
      kind: "Writing a budget inequality",
      card: {
        type: "multiple-choice",
        prompt: "Maya can spend at most $40 on snacks. Chips cost $3 a bag and drinks cost $2 each. Which inequality shows the bags of chips, x, and drinks, y, that Maya can buy?",
        choices: ["3x + 2y ≤ 40", "3x + 2y ≥ 40", "2x + 3y ≤ 40", "x + y ≤ 40"],
        answer: "3x + 2y ≤ 40",
      },
      steps: [
        { work: "x bags of chips cost 3x, y drinks cost 2y", why: "Each count is multiplied by its own price." },
        { work: "total cost: 3x + 2y", why: "Add the two costs to get what Maya spends." },
        { work: "3x + 2y ≤ 40", why: "At most means the cost stays at or under the budget." },
      ],
      answer: "3x + 2y ≤ 40",
    },
    {
      kind: "The most you can buy on a budget",
      card: {
        type: "numeric",
        prompt: "Maya can spend at most $40 on snacks. Chips cost $3 a bag and drinks cost $2 each. Maya buys 5 bags of chips. What is the greatest number of drinks Maya can also buy?",
        answer: 12,
      },
      steps: [
        { work: "3(5) + 2y ≤ 40", why: "Put the 5 bags in for x." },
        { work: "15 + 2y ≤ 40, so 2y ≤ 25", why: "Subtract the 15 dollars the chips cost from both sides." },
        { work: "y ≤ 12.5", why: "Divide both sides by 2, the price of a drink." },
        { work: "the most is 12 drinks", why: "Only whole drinks count, so round down." },
      ],
      answer: "12",
    },
  ],

  "compound-inequalities": [
    {
      kind: "An AND inequality with three parts",
      card: {
        type: "multiple-choice",
        prompt: "Solve: 7 < 2x + 3 < 15",
        choices: ["2 < x < 6", "1 < x < 7", "2 < x < 8", "4 < x < 12"],
        answer: "2 < x < 6",
      },
      steps: [
        { work: "7 − 3 < 2x < 15 − 3, so 4 < 2x < 12", why: "Subtract 3 from all three parts." },
        { work: "2 < x < 6", why: "Divide all three parts by 2." },
      ],
      answer: "2 < x < 6",
    },
    {
      kind: "An OR inequality",
      card: {
        type: "multiple-choice",
        prompt: "Solve: 3x + 2 < -4 OR 3x + 2 > 14",
        choices: ["x < -2 or x > 4", "-2 < x < 4", "x < -6 or x > 12", "x > 4"],
        answer: "x < -2 or x > 4",
      },
      steps: [
        { work: "3x < -6 or 3x > 12", why: "Subtract 2 from both sides of each inequality." },
        { work: "x < -2 or x > 4", why: "Divide each one by 3." },
        { work: "keep both: x < -2 or x > 4", why: "OR keeps every x that works for either inequality." },
      ],
      answer: "x < -2 or x > 4",
    },
    {
      kind: "A negative x term in the middle",
      card: {
        type: "multiple-choice",
        prompt: "Solve: -1 ≤ 5 − 2x < 7",
        choices: ["-1 < x ≤ 3", "-1 ≤ x < 3", "-3 < x ≤ 1", "-6 ≤ x < 2"],
        answer: "-1 < x ≤ 3",
      },
      steps: [
        { work: "-6 ≤ -2x < 2", why: "Subtract 5 from all three parts." },
        { work: "3 ≥ x > -1", why: "Divide all three by -2, and a negative flips both signs." },
        { work: "-1 < x ≤ 3", why: "Write it again with the smaller number on the left." },
      ],
      answer: "-1 < x ≤ 3",
    },
    {
      kind: "The test score that earns a B",
      card: {
        type: "multiple-choice",
        prompt: "To earn a B, the average of three test scores must be at least 80 and less than 90. You scored 84 and 90 on the first two tests. Which scores x on the third test earn a B?",
        choices: ["66 ≤ x < 96", "80 ≤ x < 90", "66 < x ≤ 96", "x ≥ 66"],
        answer: "66 ≤ x < 96",
      },
      steps: [
        { work: "80 ≤ (84 + 90 + x)/3 < 90, so 80 ≤ (174 + x)/3 < 90", why: "The average is the total of the three scores divided by 3." },
        { work: "240 ≤ 174 + x < 270", why: "Multiply all three parts by 3." },
        { work: "66 ≤ x < 96", why: "Subtract the 174 points already scored from all three parts." },
      ],
      answer: "66 ≤ x < 96",
    },
    {
      kind: "Writing between, inclusive",
      card: {
        type: "multiple-choice",
        prompt: "Which compound inequality matches: x is between -3 and 5, inclusive?",
        choices: ["-3 ≤ x ≤ 5", "-3 < x < 5", "x ≤ -3", "x ≥ 5"],
        answer: "-3 ≤ x ≤ 5",
      },
      steps: [
        { work: "inclusive, so both signs are ≤", why: "Inclusive means the two ends count as solutions." },
        { work: "-3 ≤ x ≤ 5", why: "Between puts x in the middle, smaller end on the left." },
      ],
      answer: "-3 ≤ x ≤ 5",
    },
  ],

  "systems-inequalities": [
    {
      kind: "A point that passes two inequalities",
      card: {
        type: "multiple-choice",
        prompt: "Which point satisfies x + y < 6 AND y ≥ 2x − 1?",
        choices: ["(1, 3)", "(1, 6)", "(1, 0)", "(-1, -4)"],
        answer: "(1, 3)",
      },
      steps: [
        { work: "x + y < 6: 1 + 3 = 4 < 6 ✓", why: "Test the point in the first inequality." },
        { work: "y ≥ 2x − 1: 2(1) − 1 = 1, and 3 ≥ 1 ✓", why: "Test the same point in the second inequality." },
        { work: "(1, 3) passes both", why: "AND means the point has to make both true." },
      ],
      answer: "(1, 3)",
    },
    {
      kind: "A plan that meets two limits",
      card: {
        type: "multiple-choice",
        prompt: "A club sells cookies for $1 and brownies for $3. It wants to raise at least $60 and can bake at most 30 treats. Which plan works?",
        choices: ["10 cookies and 18 brownies", "14 cookies and 22 brownies", "4 cookies and 12 brownies", "24 cookies and 3 brownies"],
        answer: "10 cookies and 18 brownies",
      },
      steps: [
        { work: "treats: 10 + 18 = 28 ≤ 30 ✓", why: "The number of treats must stay at or under 30." },
        { work: "money: 1(10) + 3(18) = 10 + 54 = 64 ≥ 60 ✓", why: "Each count times its price, added up, must reach $60." },
        { work: "10 cookies and 18 brownies passes both", why: "A plan works only when both limits hold." },
      ],
      answer: "10 cookies and 18 brownies",
    },
    {
      kind: "Under a line and above a floor",
      card: {
        type: "multiple-choice",
        prompt: "Which point satisfies y ≤ 2x + 1 AND y > -3?",
        choices: ["(2, 4)", "(2, 7)", "(4, -3)", "(0, -5)"],
        answer: "(2, 4)",
      },
      steps: [
        { work: "y ≤ 2x + 1: 2(2) + 1 = 5, and 4 ≤ 5 ✓", why: "Put the point's x into the line and compare its y." },
        { work: "y > -3: 4 > -3 ✓", why: "The y-value must be above the floor, not on it." },
        { work: "(2, 4) passes both", why: "AND means both inequalities have to be true." },
      ],
      answer: "(2, 4)",
    },
  ],

  "function-notation": [
    {
      kind: "Evaluating a linear function",
      card: { type: "numeric", prompt: "If f(x) = 3x − 5, find f(4).", answer: 7 },
      steps: [
        { work: "f(4) = 3(4) − 5", why: "Put 4 in for x, in brackets." },
        { work: "3 × 4 = 12", why: "Multiply before you subtract." },
        { work: "12 − 5 = 7", why: "Then take away the constant." },
      ],
      answer: "7",
    },
    {
      kind: "A squared term at a negative input",
      card: { type: "numeric", prompt: "If g(x) = 2x² + 3, find g(-3).", answer: 21 },
      steps: [
        { work: "g(-3) = 2(-3)² + 3", why: "Put -3 in for x, inside brackets so the sign stays." },
        { work: "(-3)² = 9", why: "Square first. A negative times a negative is positive." },
        { work: "2 × 9 = 18", why: "Then multiply by the 2 in front." },
        { work: "18 + 3 = 21", why: "Add the constant last." },
      ],
      answer: "21",
    },
    {
      kind: "A whole quadratic at a negative input",
      card: { type: "numeric", prompt: "If h(x) = x² − 4x + 1, find h(-2).", answer: 13 },
      steps: [
        { work: "h(-2) = (-2)² − 4(-2) + 1", why: "Put -2 in for every x." },
        { work: "(-2)² = 4", why: "Square first: a negative squared is positive." },
        { work: "−4(-2) = +8", why: "A negative times a negative is positive." },
        { work: "4 + 8 + 1 = 13", why: "Add the pieces together." },
      ],
      answer: "13",
    },
    {
      kind: "Adding two outputs",
      card: { type: "numeric", prompt: "If f(x) = 2x + 3, find f(1) + f(4).", answer: 16 },
      steps: [
        { work: "f(1) = 2(1) + 3 = 5", why: "Work out the first output on its own." },
        { work: "f(4) = 2(4) + 3 = 11", why: "Then work out the second output." },
        { work: "5 + 11 = 16", why: "Add the two outputs. Each one has its own + 3." },
      ],
      answer: "16",
    },
    {
      kind: "Finding the input for an output",
      card: { type: "numeric", prompt: "If f(x) = 4x − 7, for what value of x is f(x) = 13?", answer: 5 },
      steps: [
        { work: "4x − 7 = 13", why: "Set the rule equal to the output you were given." },
        { work: "4x = 20", why: "Add 7 to both sides." },
        { work: "x = 5", why: "Divide both sides by 4." },
      ],
      answer: "5",
    },
    {
      kind: "Running a cost function backward",
      card: {
        type: "numeric",
        prompt: "Concert tickets cost $25 each, plus a $8 fee for the whole order, so C(n) = 25n + 8. For how many tickets is C(n) = 108?",
        answer: 4,
      },
      steps: [
        { work: "25n + 8 = 108", why: "Set the cost rule equal to the total." },
        { work: "25n = 100", why: "Take off the fee, which is paid only once." },
        { work: "n = 4", why: "Divide by the price of one ticket." },
      ],
      answer: "4 tickets",
    },
  ],

  "domain-range": [
    {
      kind: "A fraction with x in the bottom",
      card: {
        type: "multiple-choice",
        prompt: "What is the domain of f(x) = 1/(x − 4)?",
        choices: ["All real numbers except 4", "All real numbers except -4", "All real numbers", "x ≠ 0"],
        answer: "All real numbers except 4",
      },
      steps: [
        { work: "x − 4 = 0", why: "The bottom of a fraction can never be 0, so find when it is." },
        { work: "x = 4", why: "Add 4 to both sides." },
        { work: "All real numbers except 4", why: "Leave out only the value that makes the bottom 0." },
      ],
      answer: "All real numbers except 4",
    },
    {
      kind: "A square root",
      card: {
        type: "multiple-choice",
        prompt: "What is the domain of f(x) = √(x − 6)?",
        choices: ["x ≥ 6", "x ≤ 6", "x > 6", "All real numbers"],
        answer: "x ≥ 6",
      },
      steps: [
        { work: "x − 6 ≥ 0", why: "The inside of a square root must be 0 or more." },
        { work: "x ≥ 6", why: "Add 6 to both sides. √0 is fine, so 6 is included." },
      ],
      answer: "x ≥ 6",
    },
    {
      kind: "Two factors in the bottom",
      card: {
        type: "multiple-choice",
        prompt: "What is the domain of f(x) = 1/((x − 3)(x − 7))?",
        choices: ["All real numbers except 3 and 7", "All real numbers except 3", "All real numbers except 7", "All real numbers"],
        answer: "All real numbers except 3 and 7",
      },
      steps: [
        { work: "x − 3 = 0 gives x = 3", why: "Either factor being 0 makes the bottom 0." },
        { work: "x − 7 = 0 gives x = 7", why: "Check the other factor too." },
        { work: "All real numbers except 3 and 7", why: "Leave out both values." },
      ],
      answer: "All real numbers except 3 and 7",
    },
    {
      kind: "The range of a line on a stretch of x",
      card: {
        type: "multiple-choice",
        prompt: "f(x) = -2x + 1 for -1 ≤ x ≤ 3. What is the range?",
        choices: ["-5 ≤ y ≤ 3", "-1 ≤ y ≤ 3", "-6 ≤ y ≤ 2", "-5 < y < 3"],
        answer: "-5 ≤ y ≤ 3",
      },
      steps: [
        { work: "f(-1) = -2(-1) + 1 = 3", why: "Put the left end of the domain into the rule." },
        { work: "f(3) = -2(3) + 1 = -5", why: "Put the right end in too." },
        { work: "-5 ≤ y ≤ 3", why: "A line fills every output between, smaller number first." },
      ],
      answer: "-5 ≤ y ≤ 3",
    },
    {
      kind: "The range from a short list of inputs",
      card: {
        type: "multiple-choice",
        prompt: "f(x) = x² − 3 has the domain {-2, -1, 0, 1, 2}. What is its range?",
        choices: ["{-3, -2, 1}", "{-5, -4, -3, -2, -1}", "{-2, -1, 0, 1, 2}", "{-7, -5, -3, -1, 1}"],
        answer: "{-3, -2, 1}",
      },
      steps: [
        { work: "f(2) = f(-2) = 4 − 3 = 1", why: "Squaring makes -2 and 2 give the same output." },
        { work: "f(1) = f(-1) = 1 − 3 = -2", why: "Same for -1 and 1." },
        { work: "f(0) = 0 − 3 = -3", why: "Work out the last input." },
        { work: "{-3, -2, 1}", why: "List each output once, smallest first." },
      ],
      answer: "{-3, -2, 1}",
    },
    {
      kind: "Where a real-life model stops",
      card: {
        type: "numeric",
        prompt: "A phone's battery starts at 100% and drops 8% each hour, so B(t) = 100 − 8t. The model makes sense until the battery is empty. What is the greatest t in its domain, in hours? Write it as a decimal.",
        answer: 12.5,
      },
      steps: [
        { work: "100 − 8t = 0", why: "The battery is empty when B(t) is 0." },
        { work: "8t = 100", why: "Add 8t to both sides." },
        { work: "t = 12.5", why: "Divide by 8. The domain runs from 0 to 12.5 hours." },
      ],
      answer: "12.5 hours",
    },
  ],

  "function-graphs": [
    {
      kind: "Average rate of change from a rule",
      card: { type: "numeric", prompt: "f(x) = x² + 2x − 3. What is the average rate of change of f from x = 1 to x = 4?", answer: 7 },
      steps: [
        { work: "f(4) = 16 + 8 − 3 = 21", why: "Find the output at the right end." },
        { work: "f(1) = 1 + 2 − 3 = 0", why: "Find the output at the left end." },
        { work: "(21 − 0) ÷ (4 − 1) = 21 ÷ 3 = 7", why: "Rate of change is the change in f over the change in x." },
      ],
      answer: "7",
    },
    {
      kind: "Average speed of a thrown ball",
      card: {
        type: "numeric",
        prompt: "A ball's height is h(t) = -16t² + 64t + 4 feet after t seconds. What is its average rate of change from t = 1 to t = 2, in feet per second?",
        answer: 16,
      },
      steps: [
        { work: "h(2) = -16(4) + 64(2) + 4 = -64 + 128 + 4 = 68", why: "Find the height at the later time." },
        { work: "h(1) = -16(1) + 64(1) + 4 = 52", why: "Find the height at the earlier time." },
        { work: "(68 − 52) ÷ (2 − 1) = 16", why: "Change in height over change in time." },
      ],
      answer: "16 feet per second",
    },
    {
      kind: "Which function changes faster",
      card: {
        type: "multiple-choice",
        prompt: "Which function has the greater average rate of change from x = 1 to x = 3: f(x) = 5x − 2 or g(x) = x²?",
        choices: ["f", "g", "They are equal"],
        answer: "f",
      },
      steps: [
        { work: "f: the slope is 5", why: "A line changes by its slope everywhere." },
        { work: "g: (9 − 1) ÷ (3 − 1) = 8 ÷ 2 = 4", why: "Work out g's change over the change in x." },
        { work: "5 > 4, so f is greater", why: "Compare the two rates." },
      ],
      answer: "f",
    },
    {
      kind: "Rate of change from two points",
      card: {
        type: "multiple-choice",
        prompt: "The graph of a function passes through (-1, 2) and (3, 10). What is its average rate of change from x = -1 to x = 3?",
        choices: ["2", "1/2", "10/3", "8"],
        answer: "2",
      },
      steps: [
        { work: "change in y: 10 − 2 = 8", why: "Subtract the y-values, later minus earlier." },
        { work: "change in x: 3 − (-1) = 4", why: "Subtract the x-values in the same order." },
        { work: "8/4 = 2", why: "Rate of change is change in y over change in x." },
      ],
      answer: "2",
    },
  ],

  "arithmetic-sequences": [
    {
      kind: "A term past the ones shown",
      card: { type: "numeric", prompt: "Sequence: 3, 7, 11, 15, ... What is the 10th term?", answer: 39 },
      steps: [
        { work: "d = 7 − 3 = 4", why: "Subtract a term from the one after it." },
        { work: "a₁₀ = 3 + (10 − 1)(4)", why: "The 10th term is 9 steps after the first." },
        { work: "9 × 4 = 36", why: "Nine steps of 4." },
        { work: "3 + 36 = 39", why: "Start from the first term and add the steps." },
      ],
      answer: "39",
    },
    {
      kind: "A term far down the line from a₁ and d",
      card: { type: "numeric", prompt: "An arithmetic sequence has a₁ = 6 and d = -3. What is a₂₀?", answer: -51 },
      steps: [
        { work: "a₂₀ = 6 + (20 − 1)(-3)", why: "Use aₙ = a₁ + (n − 1)d. The 20th term is 19 steps on." },
        { work: "19(-3) = -57", why: "Nineteen steps of -3." },
        { work: "6 + (-57) = -51", why: "Start from the first term and add the steps." },
      ],
      answer: "-51",
    },
    {
      kind: "The difference from two terms",
      card: {
        type: "numeric",
        prompt: "In an arithmetic sequence, the 3rd term is 14 and the 8th term is 39. What is the common difference?",
        answer: 5,
      },
      steps: [
        { work: "39 − 14 = 25", why: "How far the sequence moved between the two terms." },
        { work: "8 − 3 = 5 steps", why: "Count the steps between the positions." },
        { work: "d = 25 ÷ 5 = 5", why: "Split the change evenly over the steps." },
      ],
      answer: "5",
    },
    {
      kind: "The first term from two terms",
      card: {
        type: "numeric",
        prompt: "In an arithmetic sequence, the 4th term is 5 and the 9th term is -15. What is the first term?",
        answer: 17,
      },
      steps: [
        { work: "d = (-15 − 5) ÷ (9 − 4) = -20 ÷ 5 = -4", why: "Find the common difference first." },
        { work: "3 steps back: 3(-4) = -12", why: "The 4th term is 3 steps after the 1st." },
        { work: "a₁ = 5 − (-12) = 17", why: "Stepping back takes the difference away." },
      ],
      answer: "17",
    },
    {
      kind: "Which position a number is in",
      card: { type: "numeric", prompt: "Which term of 2, 5, 8, 11, ... is 62? Type its position n.", answer: 21 },
      steps: [
        { work: "2 + (n − 1)(3) = 62", why: "Use aₙ = a₁ + (n − 1)d with a₁ = 2 and d = 3." },
        { work: "(n − 1)(3) = 60", why: "Subtract the first term from both sides." },
        { work: "n − 1 = 20", why: "Divide by 3 to count the steps." },
        { work: "n = 21", why: "Add 1, because the first term is position 1." },
      ],
      answer: "21",
    },
    {
      kind: "A word problem: seats row by row",
      card: {
        type: "numeric",
        prompt: "Row 1 of a theater has 20 seats, and each row has 3 more seats than the row in front of it. How many seats are in row 15?",
        answer: 62,
      },
      steps: [
        { work: "a₁ = 20, d = 3, and row 15 is 14 rows after row 1", why: "The rows make an arithmetic sequence." },
        { work: "14 × 3 = 42", why: "Fourteen steps of 3 more seats." },
        { work: "20 + 42 = 62", why: "Add the steps to the seats in row 1." },
      ],
      answer: "62 seats",
    },
    {
      kind: "The common difference",
      card: { type: "numeric", prompt: "What is the common difference in 12, 8, 4, 0, ...?", answer: -4 },
      steps: [
        { work: "8 − 12 = -4", why: "Subtract a term from the one after it." },
        { work: "4 − 8 = -4, so d = -4", why: "Check another pair. Going down means d is negative." },
      ],
      answer: "-4",
    },
  ],

  "geometric-sequences": [
    {
      kind: "The common ratio",
      card: { type: "numeric", prompt: "Sequence: 3, 6, 12, ... What is the common ratio?", answer: 2 },
      steps: [
        { work: "6 ÷ 3 = 2", why: "Divide a term by the one before it." },
        { work: "12 ÷ 6 = 2, so r = 2", why: "Check another pair to be sure it multiplies the same way." },
      ],
      answer: "2",
    },
    {
      kind: "A ratio less than 1",
      card: {
        type: "numeric",
        prompt: "Sequence: 64, 32, 16, 8, ... What is the common ratio? Give it as a fraction or a decimal.",
        answer: 0.5,
      },
      steps: [
        { work: "32 ÷ 64 = 1/2", why: "Divide a term by the one before it, later over earlier." },
        { work: "16 ÷ 32 = 1/2, so r = 1/2 = 0.5", why: "Terms shrinking means the ratio is less than 1." },
      ],
      answer: "1/2",
    },
    {
      kind: "A term past the ones shown",
      card: { type: "numeric", prompt: "What is the 6th term of 2, 6, 18, 54, ...?", answer: 486 },
      steps: [
        { work: "r = 6 ÷ 2 = 3", why: "Find the ratio first." },
        { work: "a₆ = 2 × 3^5", why: "The 6th term is 5 multiplications away from the first." },
        { work: "3^5 = 243", why: "Multiply 3 by itself five times." },
        { work: "2 × 243 = 486", why: "Multiply by the first term." },
      ],
      answer: "486",
    },
    {
      kind: "A negative ratio",
      card: { type: "numeric", prompt: "Sequence: 3, -6, 12, -24, ... What is the 6th term?", answer: -96 },
      steps: [
        { work: "r = -6 ÷ 3 = -2", why: "Divide a term by the one before it." },
        { work: "a₆ = 3 × (-2)^5", why: "The 6th term is 5 multiplications from the first." },
        { work: "(-2)^5 = -32", why: "An odd number of negatives multiplied stays negative." },
        { work: "3 × (-32) = -96", why: "Multiply by the first term." },
      ],
      answer: "-96",
    },
    {
      kind: "Which position a number is in",
      card: { type: "numeric", prompt: "A geometric sequence has a₁ = 5 and r = 2. Which term is 320? Type its position n.", answer: 7 },
      steps: [
        { work: "320 ÷ 5 = 64", why: "Divide out the first term to see the growth." },
        { work: "64 = 2^6", why: "Count how many 2s multiply to 64." },
        { work: "n − 1 = 6, so n = 7", why: "Six multiplications after the 1st term is the 7th term." },
      ],
      answer: "7",
    },
    {
      kind: "A word problem: a bouncing ball",
      card: {
        type: "numeric",
        prompt: "A ball is dropped from 64 feet. Each bounce reaches 3/4 of the height before it. How high, in feet, does it go on bounce 3?",
        answer: 27,
      },
      steps: [
        { work: "64 × (3/4)^3", why: "Each bounce multiplies by 3/4, so three bounces means three times." },
        { work: "(3/4)^3 = 27/64", why: "Cube the top and the bottom." },
        { work: "64 × 27/64 = 27", why: "Multiply. The 64s cancel." },
      ],
      answer: "27 feet",
    },
  ],

  "exponent-rules": [
    {
      kind: "A power of a product, then a product",
      card: {
        type: "multiple-choice",
        prompt: "Simplify: (3x^3)^2 · x^4",
        choices: ["9x^10", "3x^10", "9x^9", "6x^10"],
        answer: "9x^10",
      },
      steps: [
        { work: "(3x^3)^2 = 3^2 · x^(3 × 2) = 9x^6", why: "The power applies to all of the bracket. Power of a power multiplies." },
        { work: "9x^6 · x^4 = 9x^(6 + 4) = 9x^10", why: "Same base, multiplying: add the exponents." },
      ],
      answer: "9x^10",
    },
    {
      kind: "A power of a monomial, divided",
      card: {
        type: "multiple-choice",
        prompt: "Simplify: (2x^2y)^3 ÷ (4x^3y)",
        choices: ["2x^3y^2", "8x^3y^2", "2x^3y^3", "2x^9y^4"],
        answer: "2x^3y^2",
      },
      steps: [
        { work: "(2x^2y)^3 = 8x^6y^3", why: "Cube the 2, and multiply each exponent by 3." },
        { work: "8 ÷ 4 = 2", why: "Divide the numbers." },
        { work: "x^(6 − 3) = x^3 and y^(3 − 1) = y^2", why: "Dividing powers of the same letter subtracts the exponents." },
        { work: "2x^3y^2", why: "Put the pieces back together." },
      ],
      answer: "2x^3y^2",
    },
    {
      kind: "A power of a power",
      card: {
        type: "multiple-choice",
        prompt: "Simplify: (x^4)^3",
        choices: ["x^12", "x^7", "3x^4", "x^64"],
        answer: "x^12",
      },
      steps: [
        { work: "4 × 3 = 12", why: "A power of a power multiplies the exponents." },
        { work: "(x^4)^3 = x^12", why: "Three copies of x^4 make twelve x's multiplied." },
      ],
      answer: "x^12",
    },
    {
      kind: "Multiply and divide powers, then find the value",
      card: { type: "numeric", prompt: "Simplify (2^5 × 2^4) ÷ 2^6, then write the answer as a number.", answer: 8 },
      steps: [
        { work: "2^5 × 2^4 = 2^9", why: "Multiplying powers of the same base adds the exponents." },
        { work: "2^9 ÷ 2^6 = 2^3", why: "Dividing subtracts the exponents." },
        { work: "2^3 = 8", why: "Multiply 2 by itself three times." },
      ],
      answer: "8",
    },
    {
      kind: "A power of a power, then a quotient",
      card: { type: "numeric", prompt: "(x^4)^3 ÷ x^5 = x^n. What is n?", answer: 7 },
      steps: [
        { work: "(x^4)^3 = x^12", why: "A power of a power multiplies the exponents: 4 × 3." },
        { work: "x^12 ÷ x^5 = x^7", why: "Dividing subtracts the exponents: 12 − 5." },
        { work: "n = 7", why: "Read off the exponent." },
      ],
      answer: "7",
    },
    {
      kind: "Zero exponents",
      card: { type: "numeric", prompt: "Simplify 7x^0 + (7x)^0, for any x other than 0.", answer: 8 },
      steps: [
        { work: "7x^0 = 7 × 1 = 7", why: "Only the x has the 0 power, so the 7 stays." },
        { work: "(7x)^0 = 1", why: "The whole bracket has the 0 power, and that makes 1." },
        { work: "7 + 1 = 8", why: "Add the two parts." },
      ],
      answer: "8",
    },
    {
      kind: "The product rule",
      card: { type: "numeric", prompt: "3^4 × 3^5 = 3^n. What is n?", answer: 9 },
      steps: [
        { work: "same base, multiplying: add the exponents", why: "Four 3s times five more 3s is a pile of 3s." },
        { work: "4 + 5 = 9", why: "Count all the 3s multiplied together." },
      ],
      answer: "9",
    },
  ],

  "negative-fractional-exponents": [
    {
      kind: "A negative exponent",
      card: { type: "numeric", prompt: "Evaluate 2^(-3). Write it as a fraction.", answer: 0.125 },
      steps: [
        { work: "2^(-3) = 1/2^3", why: "A negative exponent means one over the power." },
        { work: "2^3 = 8, so 1/2^3 = 1/8", why: "Work out the power on the bottom. It stays positive." },
      ],
      answer: "1/8",
    },
    {
      kind: "A root as a fractional exponent",
      card: {
        type: "multiple-choice",
        prompt: "Rewrite ³√x using a fractional exponent.",
        choices: ["x^(1/3)", "x^3", "x^(-3)", "3x"],
        answer: "x^(1/3)",
      },
      steps: [
        { work: "the index of the root is 3", why: "The small 3 on the root says which root it is." },
        { work: "³√x = x^(1/3)", why: "The index becomes the bottom of the exponent." },
      ],
      answer: "x^(1/3)",
    },
    {
      kind: "A fractional exponent as a root",
      card: {
        type: "multiple-choice",
        prompt: "Rewrite x^(1/4) as a root.",
        choices: ["⁴√x", "√x", "4x", "x^4"],
        answer: "⁴√x",
      },
      steps: [
        { work: "the denominator of 1/4 is 4", why: "The bottom of the exponent tells you which root." },
        { work: "x^(1/4) = ⁴√x", why: "A denominator of 4 means the fourth root." },
      ],
      answer: "⁴√x",
    },
    {
      kind: "A fractional exponent: root, then power",
      card: { type: "numeric", prompt: "Evaluate 8^(2/3).", answer: 4 },
      steps: [
        { work: "8^(2/3) = (³√8)^2", why: "The bottom of the exponent is a root, the top is a power." },
        { work: "³√8 = 2", why: "2 × 2 × 2 = 8." },
        { work: "2^2 = 4", why: "Raise the root to the power on top." },
      ],
      answer: "4",
    },
    {
      kind: "A fraction to a negative power",
      card: { type: "numeric", prompt: "Evaluate (1/3)^(-2).", answer: 9 },
      steps: [
        { work: "(1/3)^(-2) = 3^2", why: "A negative exponent flips the fraction over." },
        { work: "3^2 = 9", why: "Square the flipped number." },
      ],
      answer: "9",
    },
    {
      kind: "A negative fractional exponent",
      card: { type: "numeric", prompt: "Evaluate 27^(-2/3). Write it as a fraction.", answer: 1 / 9 },
      steps: [
        { work: "27^(-2/3) = 1/27^(2/3)", why: "The negative sign means one over the power." },
        { work: "³√27 = 3", why: "The 3 on the bottom of the exponent is a cube root." },
        { work: "3^2 = 9, so the answer is 1/9", why: "The 2 on top squares the root." },
      ],
      answer: "1/9",
    },
    {
      kind: "Adding fractional exponents",
      card: { type: "numeric", prompt: "x^(1/4) · x^(7/4) = x^n. What is n?", answer: 2 },
      steps: [
        { work: "1/4 + 7/4 = 8/4", why: "Same base, multiplying: add the exponents, fractions too." },
        { work: "8/4 = 2, so n = 2", why: "Simplify the fraction." },
      ],
      answer: "2",
    },
  ],

  "scientific-notation": [
    {
      kind: "A big number in scientific notation",
      card: {
        type: "multiple-choice",
        prompt: "Write 4,500,000 in scientific notation.",
        choices: ["4.5 × 10^6", "4.5 × 10^7", "4.5 × 10^5", "45 × 10^6"],
        answer: "4.5 × 10^6",
      },
      steps: [
        { work: "front number: 4.5", why: "It must be at least 1 and less than 10." },
        { work: "the decimal point moves 6 places left", why: "Count the places from 4,500,000 to 4.5." },
        { work: "4.5 × 10^6", why: "That count is the power of 10." },
      ],
      answer: "4.5 × 10^6",
    },
    {
      kind: "A small number in scientific notation",
      card: {
        type: "multiple-choice",
        prompt: "Write 0.00072 in scientific notation.",
        choices: ["7.2 × 10^-4", "7.2 × 10^4", "7.2 × 10^-5", "72 × 10^-4"],
        answer: "7.2 × 10^-4",
      },
      steps: [
        { work: "front number: 7.2", why: "It must be at least 1 and less than 10." },
        { work: "the decimal point moves 4 places right", why: "Count the places from 0.00072 to 7.2." },
        { work: "7.2 × 10^-4", why: "A number less than 1 gets a negative power." },
      ],
      answer: "7.2 × 10^-4",
    },
    {
      kind: "Back to a regular number",
      card: { type: "numeric", prompt: "Write 3.6 × 10^4 as a regular number.", answer: 36000 },
      steps: [
        { work: "move the decimal point 4 places right", why: "10^4 multiplies by 10,000." },
        { work: "3.6 → 36,000", why: "Fill the empty places with zeros." },
      ],
      answer: "36,000",
    },
    {
      kind: "Multiplying in scientific notation",
      card: {
        type: "multiple-choice",
        prompt: "Multiply: (6 × 10^3)(4 × 10^5). Write the answer in scientific notation.",
        choices: ["2.4 × 10^9", "2.4 × 10^8", "2.4 × 10^15", "24 × 10^8"],
        answer: "2.4 × 10^9",
      },
      steps: [
        { work: "6 × 4 = 24", why: "Multiply the front numbers." },
        { work: "10^3 × 10^5 = 10^8", why: "Multiplying powers of 10 adds the exponents." },
        { work: "24 × 10^8 = 2.4 × 10^9", why: "24 is 10 or more: move the point and add 1 to the power." },
      ],
      answer: "2.4 × 10^9",
    },
    {
      kind: "A word problem: how far light goes",
      card: {
        type: "multiple-choice",
        prompt: "Light travels about 3 × 10^8 meters per second. How far does it travel in 500 seconds?",
        choices: ["1.5 × 10^11", "1.5 × 10^10", "1.5 × 10^16", "15 × 10^10"],
        answer: "1.5 × 10^11",
      },
      steps: [
        { work: "500 = 5 × 10^2", why: "Write the time in scientific notation too." },
        { work: "3 × 5 = 15 and 10^8 × 10^2 = 10^10", why: "Distance is speed times time: multiply fronts, add powers." },
        { work: "15 × 10^10 = 1.5 × 10^11", why: "Make the front less than 10, and add 1 to the power." },
      ],
      answer: "1.5 × 10^11 meters",
    },
    {
      kind: "Dividing in scientific notation",
      card: {
        type: "multiple-choice",
        prompt: "Divide: (7.5 × 10^9) ÷ (2.5 × 10^4). Write the answer in scientific notation.",
        choices: ["3 × 10^5", "3 × 10^13", "3 × 10^6", "18.75 × 10^5"],
        answer: "3 × 10^5",
      },
      steps: [
        { work: "7.5 ÷ 2.5 = 3", why: "Divide the front numbers." },
        { work: "10^9 ÷ 10^4 = 10^5", why: "Dividing powers of 10 subtracts the exponents." },
        { work: "3 × 10^5", why: "3 is already between 1 and 10, so it is done." },
      ],
      answer: "3 × 10^5",
    },
  ],

  "simplifying-radicals": [
    {
      kind: "Pulling a perfect square out of a root",
      card: {
        type: "multiple-choice",
        prompt: "Write √72 in simplest radical form.",
        choices: ["6√2", "36√2", "7√2", "2√6"],
        answer: "6√2",
      },
      steps: [
        { work: "72 = 36 × 2", why: "Find the largest perfect square that divides 72." },
        { work: "√72 = √36 × √2", why: "A root of a product splits into a product of roots." },
        { work: "√36 = 6, so √72 = 6√2", why: "The perfect square's root comes out in front." },
      ],
      answer: "6√2",
    },
    {
      kind: "A number already in front",
      card: {
        type: "multiple-choice",
        prompt: "Simplify 3√20",
        choices: ["6√5", "5√5", "2√5", "12√5"],
        answer: "6√5",
      },
      steps: [
        { work: "√20 = √4 × √5 = 2√5", why: "Simplify the root first: 20 = 4 × 5." },
        { work: "3 × 2√5 = 6√5", why: "What comes out multiplies the number already in front." },
      ],
      answer: "6√5",
    },
    {
      kind: "Adding radicals that become like terms",
      card: {
        type: "multiple-choice",
        prompt: "Simplify √12 + √27",
        choices: ["5√3", "√39", "6√3", "13√3"],
        answer: "5√3",
      },
      steps: [
        { work: "√12 = √4 × √3 = 2√3", why: "Simplify the first radical." },
        { work: "√27 = √9 × √3 = 3√3", why: "Simplify the second radical." },
        { work: "2√3 + 3√3 = 5√3", why: "Like radicals add their front numbers, like 2x + 3x." },
      ],
      answer: "5√3",
    },
    {
      kind: "Multiplying radicals",
      card: {
        type: "multiple-choice",
        prompt: "Simplify √6 · √15",
        choices: ["3√10", "√21", "6√15", "9√10"],
        answer: "3√10",
      },
      steps: [
        { work: "√6 · √15 = √90", why: "Multiply the numbers under one root." },
        { work: "90 = 9 × 10", why: "Find the largest perfect square in 90." },
        { work: "√90 = 3√10", why: "The root of 9 comes out as 3." },
      ],
      answer: "3√10",
    },
    {
      kind: "A letter under the root",
      card: {
        type: "multiple-choice",
        prompt: "Simplify √(18x²), for x > 0",
        choices: ["3x√2", "3x²√2", "3√2", "9x√2"],
        answer: "3x√2",
      },
      steps: [
        { work: "√(18x²) = √9 · √(x²) · √2", why: "Split it into perfect squares and what is left." },
        { work: "√9 = 3 and √(x²) = x", why: "Each perfect square's root comes out, and x is positive." },
        { work: "3x√2", why: "Put the outside parts in front of the root." },
      ],
      answer: "3x√2",
    },
    {
      kind: "A word problem: a square's side",
      card: {
        type: "multiple-choice",
        prompt: "A square has an area of 50 square inches. How long is each side, in inches? Give it in simplest radical form.",
        choices: ["5√2", "2√5", "12.5", "25√2"],
        answer: "5√2",
      },
      steps: [
        { work: "side = √50", why: "A square's side is the square root of its area." },
        { work: "√50 = √25 × √2", why: "50 = 25 × 2, and 25 is a perfect square." },
        { work: "5√2", why: "The root of 25 comes out as 5." },
      ],
      answer: "5√2 inches",
    },
  ],

  "exponential-functions": [
    {
      kind: "Writing the function from a description",
      card: {
        type: "multiple-choice",
        prompt: "Which function starts at 3 and multiplies by 2 each time x goes up by 1?",
        choices: ["y = 3(2)^x", "y = 2(3)^x", "y = 3x + 2", "y = 3x^2"],
        answer: "y = 3(2)^x",
      },
      steps: [
        { work: "a = 3", why: "In y = a(b)^x, a is the starting value." },
        { work: "b = 2", why: "b is what you multiply by each step." },
        { work: "y = 3(2)^x", why: "Put a in front and b as the base, with x up top." },
      ],
      answer: "y = 3(2)^x",
    },
    {
      kind: "Growth or decay from the base",
      card: {
        type: "multiple-choice",
        prompt: "Is y = 5(0.8)^x exponential growth or decay?",
        choices: ["Growth", "Decay", "Neither"],
        answer: "Decay",
      },
      steps: [
        { work: "the base is 0.8", why: "The base decides the direction, not the number in front." },
        { work: "0 < 0.8 < 1, so it is decay", why: "A base between 0 and 1 makes it shrink." },
      ],
      answer: "Decay",
    },
    {
      kind: "The function through two points",
      card: {
        type: "multiple-choice",
        prompt: "Which exponential function passes through (0, 4) and (1, 12)?",
        choices: ["y = 4(3)^x", "y = 3(4)^x", "y = 4(12)^x", "y = 12(3)^x"],
        answer: "y = 4(3)^x",
      },
      steps: [
        { work: "at x = 0, y = 4, so a = 4", why: "At x = 0 an exponential equals its starting value." },
        { work: "12 ÷ 4 = 3, so b = 3", why: "From x = 0 to x = 1 it multiplies by the base once." },
        { work: "y = 4(3)^x", why: "Put the start and the base together." },
      ],
      answer: "y = 4(3)^x",
    },
    {
      kind: "Which x gives this y",
      card: { type: "numeric", prompt: "For y = 2(3)^x, what value of x gives y = 162?", answer: 4 },
      steps: [
        { work: "2(3)^x = 162", why: "Set the function equal to the y you want." },
        { work: "3^x = 81", why: "Divide both sides by 2." },
        { work: "3 × 3 × 3 × 3 = 81, so x = 4", why: "Count how many 3s multiply to 81." },
      ],
      answer: "4",
    },
    {
      kind: "How many times bigger",
      card: { type: "numeric", prompt: "f(x) = 5(2)^x. How many times bigger is f(6) than f(2)?", answer: 16 },
      steps: [
        { work: "f(6) ÷ f(2) = 2^6 ÷ 2^2", why: "Times bigger means divide. The 5s cancel." },
        { work: "2^(6 − 2) = 2^4", why: "Dividing powers subtracts the exponents." },
        { work: "2^4 = 16", why: "Multiply 2 by itself four times." },
      ],
      answer: "16",
    },
    {
      kind: "Evaluating an exponential function",
      card: { type: "numeric", prompt: "Evaluate f(x) = 4(3)^x at x = 2.", answer: 36 },
      steps: [
        { work: "f(2) = 4(3)^2", why: "Put 2 in for x." },
        { work: "3^2 = 9", why: "Do the power before multiplying." },
        { work: "4 × 9 = 36", why: "Then multiply by the starting value." },
      ],
      answer: "36",
    },
  ],

  "exponential-growth": [
    {
      kind: "Doubling on a schedule",
      card: { type: "numeric", prompt: "A colony of 100 bacteria doubles every 20 minutes. How many bacteria are there after 2 hours?", answer: 6400 },
      steps: [
        { work: "2 hours = 120 minutes, and 120 ÷ 20 = 6 doublings", why: "Count the doublings first." },
        { work: "2^6 = 64", why: "Doubling 6 times multiplies by 2 six times." },
        { work: "100 × 64 = 6,400", why: "Multiply the starting count by the growth." },
      ],
      answer: "6,400",
    },
    {
      kind: "Growing by a percent each year",
      card: {
        type: "numeric",
        prompt: "A town of 12,500 people grows by 4% each year. About how many people live there after 3 years? (round to the nearest whole number)",
        answer: 14061,
        decimalPlaces: 0,
      },
      steps: [
        { work: "growth factor: 1 + 0.04 = 1.04", why: "Each year keeps the whole town and adds 4%." },
        { work: "12,500 × 1.04^3", why: "Multiply by 1.04 once for each of the 3 years." },
        { work: "1.04^3 = 1.124864, and 12,500 × 1.124864 = 14,060.8", why: "Work out the power, then multiply." },
        { work: "about 14,061 people", why: "Round to the nearest whole person." },
      ],
      answer: "14,061",
    },
    {
      kind: "Compound interest earned",
      card: {
        type: "numeric",
        prompt: "$1000 is invested at 5% annual interest compounded annually. How much interest does it earn in 3 years? (round to the hundredths place, the nearest cent)",
        answer: 157.63,
        decimalPlaces: 2,
      },
      steps: [
        { work: "value: 1000 × 1.05^3", why: "Compounding multiplies by 1.05 every year." },
        { work: "1.05^3 = 1.157625, so the value is $1,157.63", why: "Work out the power, multiply, and round to the cent." },
        { work: "1,157.63 − 1,000 = 157.63", why: "The interest is the value minus what was put in." },
      ],
      answer: "$157.63",
    },
    {
      kind: "Compound interest: the value",
      card: {
        type: "numeric",
        prompt: "$800 invested at 4% annual interest compounded annually. Value after 2 years? (round to the hundredths place, the nearest cent)",
        answer: 865.28,
        decimalPlaces: 2,
      },
      steps: [
        { work: "growth factor: 1 + 0.04 = 1.04", why: "The money keeps itself and adds 4% each year." },
        { work: "800 × 1.04^2", why: "Multiply by the factor once for each year." },
        { work: "1.04^2 = 1.0816, and 800 × 1.0816 = 865.28", why: "Work out the power, then multiply." },
      ],
      answer: "$865.28",
    },
  ],

  "exponential-decay": [
    {
      kind: "A half-life",
      card: { type: "numeric", prompt: "A 200 mg dose of medicine is half gone every 6 hours. How many mg are left after 18 hours?", answer: 25 },
      steps: [
        { work: "18 ÷ 6 = 3 halvings", why: "Count how many half-lives pass." },
        { work: "(1/2)^3 = 1/8", why: "Halving 3 times divides by 2 three times." },
        { work: "200 ÷ 8 = 25", why: "Take that fraction of the starting dose." },
      ],
      answer: "25 mg",
    },
    {
      kind: "The value lost",
      card: {
        type: "numeric",
        prompt: "A phone worth $800 loses 20% of its value each year. How much value has it lost after 2 years? (round to the nearest whole dollar)",
        answer: 288,
        decimalPlaces: 0,
      },
      steps: [
        { work: "decay factor: 1 − 0.20 = 0.8", why: "Each year the phone keeps 80% of its value." },
        { work: "800 × 0.8^2 = 800 × 0.64 = 512", why: "Multiply by 0.8 once for each year." },
        { work: "800 − 512 = 288", why: "The loss is the price minus what it is still worth." },
      ],
      answer: "$288",
    },
    {
      kind: "When it first drops under half",
      card: {
        type: "numeric",
        prompt: "A car that cost $20,000 loses 15% of its value each year. After how many full years is it first worth less than half of what it cost?",
        answer: 5,
      },
      steps: [
        { work: "decay factor: 1 − 0.15 = 0.85", why: "Each year the car keeps 85% of its value." },
        { work: "0.85^4 ≈ 0.522", why: "After 4 years it still has half or more." },
        { work: "0.85^5 ≈ 0.444", why: "After 5 years it is under half." },
        { work: "5 years", why: "The first year it dips under half is the answer." },
      ],
      answer: "5 years",
    },
    {
      kind: "The value left",
      card: {
        type: "numeric",
        prompt: "A car worth $24,000 loses 12% of its value each year. What is it worth after 2 years? (round to the nearest whole dollar)",
        answer: 18586,
        decimalPlaces: 0,
      },
      steps: [
        { work: "decay factor: 1 − 0.12 = 0.88", why: "The car keeps 88% of its value each year." },
        { work: "24,000 × 0.88^2", why: "Multiply by the factor once for each year." },
        { work: "0.88^2 = 0.7744, and 24,000 × 0.7744 = 18,585.6", why: "Work out the power, then multiply." },
        { work: "about $18,586", why: "Round to the nearest whole dollar." },
      ],
      answer: "$18,586",
    },
  ],
};
