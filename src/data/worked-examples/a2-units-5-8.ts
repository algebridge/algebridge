import type { WorkedExamples } from "./types";

/** Algebra 2, units 5 to 8: radicals, exponentials and logs, sequences and series, trigonometry. */
export const EXAMPLES: WorkedExamples = {
  "nth-roots": [
    {
      kind: "Cube root of a negative number",
      card: { type: "numeric", prompt: "Evaluate ∛(-64).", answer: -4 },
      steps: [
        { work: "∛(−64) asks for the number used as a factor three times to make −64", why: "A cube root undoes cubing, so look for three equal factors." },
        { work: "(−4) × (−4) × (−4) = −64", why: "Three negative factors multiply to a negative number." },
        { work: "∛(−64) = −4", why: "The cube root of a negative number is negative." },
      ],
      answer: "−4",
    },
    {
      kind: "Pulling a perfect cube out of a cube root",
      card: { type: "multiple-choice", prompt: "Simplify ∛54.", answer: "3∛2", choices: ["3∛2", "2∛3", "9∛2", "3√2"] },
      steps: [
        { work: "54 = 27 × 2", why: "27 is the biggest perfect cube that divides 54." },
        { work: "∛54 = ∛27 × ∛2", why: "The root of a product is the product of the roots." },
        { work: "∛27 = 3", why: "3 × 3 × 3 = 27." },
        { work: "∛54 = 3∛2", why: "The 3 comes out front and the 2 stays inside the cube root." },
      ],
      answer: "3∛2",
    },
    {
      kind: "Combining like cube roots",
      card: { type: "multiple-choice", prompt: "Simplify 5∛6 + 4∛6 − 2∛6.", answer: "7∛6", choices: ["7∛6", "7∛18", "18∛6", "11∛6"] },
      steps: [
        { work: "all three terms have index 3 and radicand 6", why: "Same index and same radicand make them like radicals." },
        { work: "5 + 4 − 2 = 7", why: "Like radicals combine by their coefficients, like 5x + 4x − 2x." },
        { work: "7∛6", why: "The radical part stays the same." },
      ],
      answer: "7∛6",
    },
    {
      kind: "Which whole numbers a cube root is between",
      card: { type: "numeric", prompt: "∛100 lies between two consecutive whole numbers. What is the smaller one?", answer: 4 },
      steps: [
        { work: "4³ = 64", why: "List perfect cubes near 100." },
        { work: "5³ = 125", why: "The next perfect cube is past 100." },
        { work: "64 < 100 < 125, so ∛100 is between 4 and 5", why: "A bigger number has a bigger cube root." },
        { work: "the smaller one is 4", why: "The question asks for the lower whole number." },
      ],
      answer: "4",
    },
  ],

  "rational-exponents-evaluate": [
    {
      kind: "A fraction exponent: root, then power",
      card: { type: "numeric", prompt: "Evaluate 16^(3/4).", answer: 8 },
      steps: [
        { work: "16^(3/4) = (⁴√16)^3", why: "The bottom of the exponent is the root; the top is the power." },
        { work: "⁴√16 = 2", why: "2 × 2 × 2 × 2 = 16." },
        { work: "2^3 = 2 × 2 × 2 = 8", why: "Now raise the root to the power 3." },
      ],
      answer: "8",
    },
    {
      kind: "A negative fraction exponent",
      card: { type: "numeric", prompt: "Evaluate 27^(−2/3). (write as a fraction or decimal)", answer: 1 / 9 },
      steps: [
        { work: "27^(−2/3) = 1 / 27^(2/3)", why: "A negative exponent means take the reciprocal." },
        { work: "∛27 = 3", why: "The 3 on the bottom is a cube root." },
        { work: "3^2 = 9", why: "The 2 on top is the power." },
        { work: "1 / 9", why: "Put the result under 1." },
      ],
      answer: "1/9",
    },
    {
      kind: "Radical to rational exponent",
      card: { type: "multiple-choice", prompt: "Write ∛(x^2) using a rational exponent.", answer: "x^(2/3)", choices: ["x^(2/3)", "x^(3/2)", "x^6", "x^5"] },
      steps: [
        { work: "∛(x^2) = (x^2)^(1/3)", why: "A cube root is the same as a power of 1/3." },
        { work: "2 × 1/3 = 2/3", why: "A power of a power multiplies the exponents." },
        { work: "∛(x^2) = x^(2/3)", why: "The power goes on top, the root index on the bottom." },
      ],
      answer: "x^(2/3)",
    },
    {
      kind: "Rational exponent to radical",
      card: { type: "multiple-choice", prompt: "Write x^(3/5) as a radical.", answer: "⁵√(x^3)", choices: ["⁵√(x^3)", "∛(x^5)", "3⁵√x", "x^3⁵√x"] },
      steps: [
        { work: "the bottom 5 is the root index and the top 3 is the power", why: "Denominator means root, numerator means power." },
        { work: "x^(3/5) = (x^3)^(1/5)", why: "Split the exponent into a power and a root." },
        { work: "⁵√(x^3)", why: "A power of 1/5 is a fifth root." },
      ],
      answer: "⁵√(x^3)",
    },
    {
      kind: "Multiplying powers with fraction exponents",
      card: { type: "multiple-choice", prompt: "Simplify x^(1/3) · x^(4/3).", answer: "x^(5/3)", choices: ["x^(5/3)", "x^(4/9)", "x^(5/6)", "x^(4/3)"] },
      steps: [
        { work: "x^(1/3 + 4/3)", why: "Same base multiplied: add the exponents." },
        { work: "1/3 + 4/3 = 5/3", why: "Same denominator, so add the tops and keep the 3." },
        { work: "x^(5/3)", why: "5/3 is already in lowest terms." },
      ],
      answer: "x^(5/3)",
    },
    {
      kind: "A power of a power with a fraction exponent",
      card: { type: "multiple-choice", prompt: "Simplify (x^(2/3))^4.", answer: "x^(8/3)", choices: ["x^(8/3)", "x^(14/3)", "x^(1/6)", "x^(2/3)"] },
      steps: [
        { work: "(x^(2/3))^4 = x^(2/3 × 4)", why: "A power of a power multiplies the exponents." },
        { work: "2/3 × 4 = 8/3", why: "The 4 multiplies the numerator only." },
        { work: "x^(8/3)", why: "8/3 does not reduce." },
      ],
      answer: "x^(8/3)",
    },
  ],

  "radical-equations": [
    {
      kind: "Square root equal to a number",
      card: { type: "numeric", prompt: "Solve √(x − 3) = 6.", answer: 39 },
      steps: [
        { work: "x − 3 = 6² = 36", why: "Squaring both sides undoes the square root." },
        { work: "x = 36 + 3 = 39", why: "Add 3 to both sides to get x alone." },
        { work: "check: √(39 − 3) = √36 = 6", why: "Always check a squared equation in the original." },
      ],
      answer: "39",
    },
    {
      kind: "Isolate the root first, then square",
      card: { type: "numeric", prompt: "Solve √(3x + 1) + 2 = 7.", answer: 8 },
      steps: [
        { work: "√(3x + 1) = 7 − 2 = 5", why: "Get the root alone before squaring." },
        { work: "3x + 1 = 5² = 25", why: "Square both sides to remove the root." },
        { work: "3x = 25 − 1 = 24", why: "Subtract 1 from both sides." },
        { work: "x = 24 / 3 = 8", why: "Divide both sides by 3." },
      ],
      answer: "8",
    },
    {
      kind: "Spotting the extraneous solution",
      card: { type: "numeric", prompt: "Solving √(x + 2) = x − 4 by squaring gives x = 7 or x = 2. Which one checks in the original equation?", answer: 7 },
      steps: [
        { work: "try x = 7: left side √(7 + 2) = √9 = 3", why: "Substitute into the original equation, not the squared one." },
        { work: "right side 7 − 4 = 3; both sides match, so it checks", why: "Equal sides mean the value is a real solution." },
        { work: "try x = 2: right side 2 − 4 = −2, negative, so it fails", why: "A square root is never negative." },
        { work: "only x = 7 checks", why: "Squaring created the extra value x = 2." },
      ],
      answer: "7",
    },
    {
      kind: "Cube root equation",
      card: { type: "numeric", prompt: "Solve ∛(x + 4) = −2.", answer: -12 },
      steps: [
        { work: "x + 4 = (−2)³", why: "Cubing both sides undoes the cube root." },
        { work: "(−2)³ = (−2) × (−2) × (−2) = −8", why: "A negative number cubed stays negative." },
        { work: "x = −8 − 4 = −12", why: "Subtract 4 from both sides." },
      ],
      answer: "−12",
    },
  ],

  "log-basics": [
    {
      kind: "Log of a power, here a fraction",
      card: { type: "numeric", prompt: "Evaluate log₃(1/81).", answer: -4 },
      steps: [
        { work: "log₃(1/81) asks: 3 to what power gives 1/81?", why: "A logarithm is an exponent." },
        { work: "3⁴ = 81", why: "Find 81 as a power of 3 first." },
        { work: "1/81 = 1/3⁴ = 3^(−4)", why: "One over a power is a negative exponent." },
        { work: "log₃(1/81) = −4", why: "The log is that exponent." },
      ],
      answer: "−4",
    },
    {
      kind: "Exponential form to log form",
      card: { type: "multiple-choice", prompt: "Write 2^6 = 64 in logarithmic form.", answer: "log₂(64) = 6", choices: ["log₂(64) = 6", "log₆(64) = 2", "log₂(6) = 64", "log₆₄(2) = 6"] },
      steps: [
        { work: "the base is 2, the exponent is 6, the result is 64", why: "Name each part of the power first." },
        { work: "the log has base 2, 64 goes inside, and it equals 6", why: "A log answers: base to what power gives the result?" },
        { work: "log₂(64) = 6", why: "Write it in that order." },
      ],
      answer: "log₂(64) = 6",
    },
    {
      kind: "Log form to exponential form",
      card: { type: "multiple-choice", prompt: "Write log₅(125) = 3 in exponential form.", answer: "5^3 = 125", choices: ["5^3 = 125", "3^5 = 125", "5^125 = 3", "125^5 = 3"] },
      steps: [
        { work: "the base is 5, the value 3 is the exponent, 125 is the result", why: "The value of a log is always an exponent." },
        { work: "5 to the power 3 is 125", why: "Base to the exponent gives the result." },
        { work: "5^3 = 125", why: "Check: 5 × 5 × 5 = 125." },
      ],
      answer: "5^3 = 125",
    },
    {
      kind: "ln and e undo each other",
      card: { type: "numeric", prompt: "Evaluate ln(e^(−3)).", answer: -3 },
      steps: [
        { work: "ln(e^(−3)) asks: e to what power gives e^(−3)?", why: "ln is the log with base e." },
        { work: "that power is −3", why: "The exponent comes out exactly, sign included." },
        { work: "ln(e^(−3)) = −3", why: "ln undoes e to a power." },
      ],
      answer: "−3",
    },
    {
      kind: "A power of a log undoes the log",
      card: { type: "numeric", prompt: "Evaluate 10^(log 7).", answer: 7 },
      steps: [
        { work: "log 7 is the exponent 10 needs to make 7", why: "log with no base written means base 10." },
        { work: "raising 10 to that exponent gives back 7", why: "10 to a power and log undo each other." },
        { work: "10^(log 7) = 7", why: "The base and its log cancel, leaving the number inside." },
      ],
      answer: "7",
    },
    {
      kind: "Finding the base",
      card: { type: "numeric", prompt: "Solve for the base b: log_b(125) = 3.", answer: 5 },
      steps: [
        { work: "b^3 = 125", why: "Rewrite the log in exponential form." },
        { work: "5 × 5 × 5 = 125", why: "Look for the number used three times as a factor." },
        { work: "b = 5", why: "A log base must be positive." },
      ],
      answer: "5",
    },
    {
      kind: "Solving a log equation for x",
      card: { type: "numeric", prompt: "Solve log₄(x) = 3.", answer: 64 },
      steps: [
        { work: "x = 4^3", why: "The log is the exponent on the base 4." },
        { work: "4^3 = 4 × 4 × 4 = 64", why: "Multiply 4 by itself three times, not 4 × 3." },
        { work: "x = 64", why: "Check: log₄(64) = 3." },
      ],
      answer: "64",
    },
  ],

  "log-properties": [
    {
      kind: "Expanding a log of a quotient",
      card: { type: "multiple-choice", prompt: "Expand log(x⁴/y³).", answer: "4 log x − 3 log y", choices: ["4 log x − 3 log y", "4 log x + 3 log y", "(4 log x)/(3 log y)", "log(4x) − log(3y)"] },
      steps: [
        { work: "log(x⁴/y³) = log(x⁴) − log(y³)", why: "Quotient rule: division inside becomes subtraction outside." },
        { work: "log(x⁴) = 4 log x and log(y³) = 3 log y", why: "Power rule: an exponent comes out front." },
        { work: "4 log x − 3 log y", why: "Put the two pieces back together." },
      ],
      answer: "4 log x − 3 log y",
    },
    {
      kind: "Condensing into one log",
      card: { type: "multiple-choice", prompt: "Write 5 log x + 2 log y as a single logarithm.", answer: "log(x⁵y²)", choices: ["log(x⁵y²)", "log(x⁵ + y²)", "log(5x + 2y)", "log(x²y⁵)"] },
      steps: [
        { work: "5 log x = log(x⁵) and 2 log y = log(y²)", why: "Power rule backward: a coefficient becomes an exponent." },
        { work: "log(x⁵) + log(y²) = log(x⁵y²)", why: "Product rule backward: a sum of logs is the log of a product." },
        { work: "log(x⁵y²)", why: "One log, so it is fully condensed." },
      ],
      answer: "log(x⁵y²)",
    },
    {
      kind: "Using given log values",
      card: { type: "numeric", prompt: "Given log_b(2) ≈ 0.39 and log_b(3) ≈ 0.61, find log_b(12). (round to the nearest hundredth)", answer: 1.39, decimalPlaces: 2 },
      steps: [
        { work: "12 = 2² · 3", why: "Break 12 into the numbers whose logs you know." },
        { work: "log_b(12) = 2 log_b(2) + log_b(3)", why: "Products become sums and powers become coefficients." },
        { work: "2(0.39) + 0.61 = 0.78 + 0.61", why: "Put in the given values." },
        { work: "≈ 1.39", why: "Add, keeping two decimal places." },
      ],
      answer: "1.39",
    },
    {
      kind: "A sum of logs that comes out whole",
      card: { type: "numeric", prompt: "Evaluate log₁₀(4) + log₁₀(25).", answer: 2 },
      steps: [
        { work: "log₁₀(4 × 25)", why: "Same base, so a sum of logs is the log of the product." },
        { work: "4 × 25 = 100", why: "Multiply the numbers inside." },
        { work: "10² = 100", why: "Write 100 as a power of the base." },
        { work: "log₁₀(100) = 2", why: "The log is the exponent." },
      ],
      answer: "2",
    },
    {
      kind: "A difference of logs that comes out whole",
      card: { type: "numeric", prompt: "Evaluate log₂(96) − log₂(3).", answer: 5 },
      steps: [
        { work: "log₂(96 ÷ 3)", why: "Same base, so a difference of logs is the log of the quotient." },
        { work: "96 ÷ 3 = 32", why: "Divide the numbers inside." },
        { work: "2⁵ = 32", why: "Write 32 as a power of 2." },
        { work: "log₂(32) = 5", why: "The log is the exponent." },
      ],
      answer: "5",
    },
    {
      kind: "Log of a root",
      card: { type: "numeric", prompt: "Evaluate log₃(√27). (write as a fraction or decimal)", answer: 1.5 },
      steps: [
        { work: "√27 = 27^(1/2)", why: "A square root is a power of 1/2." },
        { work: "log₃(27^(1/2)) = 1/2 × log₃(27)", why: "Power rule: the 1/2 comes out front." },
        { work: "3³ = 27, so log₃(27) = 3", why: "Find the log of 27 on its own." },
        { work: "1/2 × 3 = 3/2", why: "Multiply to finish." },
      ],
      answer: "3/2",
    },
  ],

  "solve-exponential-equations": [
    {
      kind: "Same base, fraction on the right",
      card: { type: "numeric", prompt: "Solve 4^x = 1/64.", answer: -3 },
      steps: [
        { work: "64 = 4³", why: "Write 64 as a power of 4." },
        { work: "1/64 = 4^(−3)", why: "One over a power is a negative exponent." },
        { work: "4^x = 4^(−3), so x = −3", why: "Same base on both sides means equal exponents." },
      ],
      answer: "−3",
    },
    {
      kind: "Matching exponents with x inside",
      card: { type: "numeric", prompt: "Solve 3^(2x − 1) = 243.", answer: 3 },
      steps: [
        { work: "243 = 3⁵", why: "Write the right side as a power of 3." },
        { work: "2x − 1 = 5", why: "Same base, so set the exponents equal." },
        { work: "2x = 5 + 1 = 6", why: "Add 1 to both sides." },
        { work: "x = 6/2 = 3", why: "Divide both sides by 2." },
      ],
      answer: "3",
    },
    {
      kind: "Different bases with a shared prime",
      card: { type: "numeric", prompt: "Solve 27^x = 9. (write as a fraction or decimal)", answer: 2 / 3 },
      steps: [
        { work: "27 = 3³ and 9 = 3²", why: "Both numbers are powers of 3." },
        { work: "(3³)^x = 3²", why: "Rewrite both sides with base 3." },
        { work: "3^(3x) = 3², so 3x = 2", why: "A power of a power multiplies, then match exponents." },
        { work: "x = 2/3", why: "Divide both sides by 3." },
      ],
      answer: "2/3",
    },
    {
      kind: "No common base: take a log",
      card: { type: "numeric", prompt: "Solve 5^x = 40 for x. (round to the nearest hundredth)", answer: 2.29, decimalPlaces: 2 },
      steps: [
        { work: "x · log(5) = log(40)", why: "Take the log of both sides; the power rule brings x down." },
        { work: "x = log(40)/log(5)", why: "Divide both sides by log(5)." },
        { work: "≈ 1.6021/0.699", why: "Use a calculator for each log." },
        { work: "x ≈ 2.29", why: "Round to the nearest hundredth." },
      ],
      answer: "2.29",
    },
    {
      kind: "A number times a power",
      card: { type: "numeric", prompt: "Solve 4 · 1.2^x = 50 for x. (round to the nearest hundredth)", answer: 13.85, decimalPlaces: 2 },
      steps: [
        { work: "1.2^x = 50/4 = 12.5", why: "Divide by 4 first so the power is alone." },
        { work: "x = log(12.5)/log(1.2)", why: "Take the log of both sides and divide." },
        { work: "≈ 1.0969/0.0792", why: "Use a calculator for each log." },
        { work: "x ≈ 13.85", why: "Round to the nearest hundredth." },
      ],
      answer: "13.85",
    },
    {
      kind: "Doubling time",
      card: { type: "numeric", prompt: "A culture of 300 bacteria doubles every 5 hours. After how many hours will there be 6,000 bacteria? (round to the nearest tenth)", answer: 21.6, decimalPlaces: 1 },
      steps: [
        { work: "300 · 2^(t/5) = 6,000", why: "The count doubles once every 5 hours." },
        { work: "2^(t/5) = 20", why: "Divide both sides by the starting 300." },
        { work: "t/5 = log(20)/log(2) ≈ 4.3219", why: "Take logs to bring the exponent down." },
        { work: "t ≈ 5 × 4.3219 ≈ 21.6 hours", why: "Each doubling takes 5 hours, so multiply by 5." },
      ],
      answer: "21.6",
    },
  ],

  "arithmetic-series": [
    {
      kind: "Sum from the first term and difference",
      card: { type: "numeric", prompt: "An arithmetic sequence has first term 2 and common difference 5. Find the sum of its first 12 terms.", answer: 354 },
      steps: [
        { work: "a₁₂ = 2 + 11 × 5 = 57", why: "The 12th term is 11 jumps of 5 past the first." },
        { work: "2 + 57 = 59", why: "Add the first and last terms." },
        { work: "S = 12 × 59/2 = 354", why: "S = n(a₁ + aₙ)/2 averages the ends and counts the terms." },
      ],
      answer: "354",
    },
    {
      kind: "Sum of a listed run",
      card: { type: "numeric", prompt: "Find the sum 5 + 8 + 11 + ... + 50.", answer: 440 },
      steps: [
        { work: "n = (50 − 5)/3 + 1 = 15 + 1 = 16", why: "Count the jumps of 3, then add 1 for the first term." },
        { work: "5 + 50 = 55", why: "Add the first and last terms." },
        { work: "S = 16 × 55/2 = 440", why: "Use S = n(first + last)/2." },
      ],
      answer: "440",
    },
    {
      kind: "Seats in rows",
      card: { type: "numeric", prompt: "A theater has 20 seats in the first row, and each row has 3 more seats than the row in front of it. How many seats are in the first 15 rows altogether?", answer: 615 },
      steps: [
        { work: "row 15: 20 + 14 × 3 = 62 seats", why: "Row 15 is 14 rows behind row 1." },
        { work: "20 + 62 = 82", why: "Add the first and last rows." },
        { work: "total = 15 × 82/2 = 615 seats", why: "Use S = n(first + last)/2 for all 15 rows." },
      ],
      answer: "615",
    },
    {
      kind: "How many rows make the total",
      card: { type: "numeric", prompt: "A stack of logs has 4 in the top row, and each row below has one more than the row above it. The stack holds 39 logs in all. How many rows are there?", answer: 6 },
      steps: [
        { work: "n rows hold n(4 + 4 + n − 1)/2 = 39", why: "The bottom row has 4 + (n − 1) logs." },
        { work: "try n = 5: 5(4 + 8)/2 = 30, short of 39", why: "Test a value of n to see if it is close." },
        { work: "try n = 6: 6(4 + 9)/2 = 39", why: "One more row reaches the total exactly." },
        { work: "6 rows", why: "That n makes the sum 39." },
      ],
      answer: "6",
    },
    {
      kind: "Sum of multiples in a range",
      card: { type: "numeric", prompt: "Find the sum of the multiples of 7 from 14 to 98, including both.", answer: 728 },
      steps: [
        { work: "n = (98 − 14)/7 + 1 = 12 + 1 = 13", why: "The multiples go up by 7; add 1 to count both ends." },
        { work: "14 + 98 = 112", why: "Add the first and last terms." },
        { work: "S = 13 × 112/2 = 728", why: "Use S = n(first + last)/2." },
      ],
      answer: "728",
    },
  ],

  "geometric-series": [
    {
      kind: "Sum from the first term and ratio",
      card: { type: "numeric", prompt: "A geometric sequence has first term 2 and common ratio 3. Find the sum of its first 5 terms.", answer: 242 },
      steps: [
        { work: "S = a₁(1 − rⁿ)/(1 − r) with a₁ = 2, r = 3, n = 5", why: "This formula adds n terms of a geometric sequence." },
        { work: "3^5 = 243", why: "Work out the power first." },
        { work: "1 − 243 = −242 and 1 − 3 = −2", why: "Find the top and bottom of the fraction." },
        { work: "S = 2 × (−242)/(−2) = 242", why: "A negative over a negative is positive." },
      ],
      answer: "242",
    },
    {
      kind: "Sum of an infinite series",
      card: { type: "numeric", prompt: "An infinite geometric series has first term 10 and common ratio 3/5. Find its sum. (write as a fraction or decimal)", answer: 25 },
      steps: [
        { work: "|3/5| < 1, so S = a₁/(1 − r)", why: "The terms shrink toward 0, so the sum has a limit." },
        { work: "1 − 3/5 = 2/5", why: "Work out the bottom first." },
        { work: "S = 10 ÷ 2/5 = 10 × 5/2 = 25", why: "Dividing by a fraction is multiplying by its reciprocal." },
      ],
      answer: "25",
    },
    {
      kind: "Which series converges",
      card: {
        type: "multiple-choice",
        prompt: "Which infinite geometric series converges?",
        answer: "27 + 9 + 3 + 1 + ...",
        choices: ["27 + 9 + 3 + 1 + ...", "1 + 2 + 4 + 8 + ...", "3 − 6 + 12 − 24 + ...", "5 + 5 + 5 + 5 + ..."],
      },
      steps: [
        { work: "ratios: 9/27 = 1/3, 2/1 = 2, −6/3 = −2, 5/5 = 1", why: "r is the second term divided by the first." },
        { work: "only |1/3| < 1", why: "A series converges only when |r| < 1." },
        { work: "27 + 9 + 3 + 1 + ... converges", why: "Its terms shrink toward 0." },
      ],
      answer: "27 + 9 + 3 + 1 + ...",
    },
    {
      kind: "Sum of a listed geometric series",
      card: { type: "numeric", prompt: "Find the sum of the geometric series 2 + 8 + 32 + 128 + 512.", answer: 682 },
      steps: [
        { work: "r = 8/2 = 4", why: "Divide a term by the one before it." },
        { work: "2 × 4^4 = 512, so n = 5", why: "Count the terms from first to last." },
        { work: "S = 2 × (1 − 1024)/(1 − 4) = 2 × (−1023)/(−3)", why: "Use S = a₁(1 − rⁿ)/(1 − r) with 4^5 = 1024." },
        { work: "S = 682", why: "Check: 2 + 8 + 32 + 128 + 512 = 682." },
      ],
      answer: "682",
    },
    {
      kind: "Savings that double each week",
      card: { type: "numeric", prompt: "Maya saves $5 in week 1 and each week saves twice as much as the week before. How much has Maya saved in total after 6 weeks?", answer: 315 },
      steps: [
        { work: "a₁ = 5, r = 2, n = 6", why: "Doubling each week makes a geometric sequence." },
        { work: "2^6 = 64", why: "Work out the power first." },
        { work: "S = 5 × (64 − 1)/(2 − 1) = 5 × 63/1", why: "Use S = a₁(rⁿ − 1)/(r − 1)." },
        { work: "S = 315", why: "Maya has saved $315." },
      ],
      answer: "315",
    },
  ],

  "sigma-notation": [
    {
      kind: "Evaluating a linear sigma",
      card: { type: "numeric", prompt: "Evaluate Σ from k = 1 to 6 of (3k − 2).", answer: 51 },
      steps: [
        { work: "1 + 4 + 7 + 10 + 13 + 16", why: "Plug in k = 1 through 6 to list the terms." },
        { work: "3 × (1 + 2 + ... + 6) = 3 × 21 = 63", why: "The k parts add up to 3 times the sum of 1 to 6." },
        { work: "6 × (−2) = −12", why: "The −2 is in every one of the 6 terms." },
        { work: "63 − 12 = 51", why: "Combine the two parts." },
      ],
      answer: "51",
    },
    {
      kind: "Writing a sum in sigma notation",
      card: {
        type: "multiple-choice",
        prompt: "Which sigma notation represents 7 + 11 + 15 + 19 + 23?",
        answer: "Σ from k = 1 to 5 of (4k + 3)",
        choices: ["Σ from k = 1 to 5 of (4k + 3)", "Σ from k = 1 to 5 of (4k + 7)", "Σ from k = 1 to 4 of (4k + 3)", "Σ from k = 1 to 5 of (5k + 3)"],
      },
      steps: [
        { work: "the terms go up by 4, so the rule is 4k + c", why: "The common difference is the coefficient of k." },
        { work: "k = 1: 4 + c = 7, so c = 3", why: "The first term fixes the constant." },
        { work: "5 terms, so k runs from 1 to 5", why: "Count the terms for the top number." },
        { work: "Σ from k = 1 to 5 of (4k + 3)", why: "Put the rule and the limits together." },
      ],
      answer: "Σ from k = 1 to 5 of (4k + 3)",
    },
    {
      kind: "Counting the terms",
      card: { type: "numeric", prompt: "How many terms are in Σ from k = 4 to 20 of (2k − 1)?", answer: 17 },
      steps: [
        { work: "k = 4, 5, ..., 20", why: "k takes every whole number between the limits." },
        { work: "20 − 4 + 1 = 17 terms", why: "Subtracting counts the gaps; add 1 to include both ends." },
      ],
      answer: "17",
    },
    {
      kind: "A sum of squares from a later start",
      card: { type: "numeric", prompt: "Evaluate Σ from k = 2 to 5 of k².", answer: 54 },
      steps: [
        { work: "k = 2 gives 4, k = 3 gives 9, k = 4 gives 16, k = 5 gives 25", why: "Start at k = 2, not k = 1." },
        { work: "4 + 9 + 16 + 25 = 54", why: "Add all four terms." },
      ],
      answer: "54",
    },
    {
      kind: "A geometric sigma starting at k = 0",
      card: { type: "numeric", prompt: "Evaluate Σ from k = 0 to 4 of 3 × 2^k.", answer: 93 },
      steps: [
        { work: "k = 0 gives 3 × 2^0 = 3", why: "Any number to the power 0 is 1." },
        { work: "terms: 3, 6, 12, 24, 48", why: "k = 0 to 4 is five terms, each doubling." },
        { work: "3 + 6 + 12 + 24 + 48 = 93", why: "Add all five terms." },
      ],
      answer: "93",
    },
  ],

  "radians-degrees": [
    {
      kind: "Degrees to a multiple of π",
      card: { type: "multiple-choice", prompt: "Convert 240° to radians.", answer: "4π/3", choices: ["4π/3", "4/3", "2π/3", "π/3"] },
      steps: [
        { work: "240 × π/180 = 240π/180", why: "Degrees to radians: multiply by π/180." },
        { work: "the greatest common factor of 240 and 180 is 60", why: "Find what divides both numbers." },
        { work: "240π/180 = 4π/3", why: "Divide top and bottom by 60." },
      ],
      answer: "4π/3",
    },
    {
      kind: "Radians to degrees",
      card: { type: "numeric", prompt: "Convert 7π/4 radians to degrees.", answer: 315 },
      steps: [
        { work: "7π/4 = 7 × 180° ÷ 4", why: "Each π is 180°." },
        { work: "7 × 180° = 1260°", why: "Multiply first." },
        { work: "1260° ÷ 4 = 315°", why: "Then divide by the denominator." },
      ],
      answer: "315",
    },
    {
      kind: "Arc length with a radian angle",
      card: { type: "numeric", prompt: "A circle has radius 8 cm. Find the length of the arc cut off by a central angle of 3π/4 radians. (round to the nearest tenth)", answer: 18.8, decimalPlaces: 1 },
      steps: [
        { work: "s = rθ = 8 × 3π/4", why: "Arc length is radius times the angle in radians." },
        { work: "3π/4 ≈ 2.3562", why: "Keep the π: it is part of the angle." },
        { work: "s ≈ 8 × 2.3562 ≈ 18.8 cm", why: "Multiply and round to the nearest tenth." },
      ],
      answer: "18.8",
    },
    {
      kind: "Arc length with a degree angle",
      card: { type: "numeric", prompt: "A circle has radius 10 inches. Find the length of the arc cut off by a central angle of 72°. (round to the nearest tenth)", answer: 12.6, decimalPlaces: 1 },
      steps: [
        { work: "θ = 72 × π/180 = 72π/180", why: "s = rθ needs the angle in radians." },
        { work: "θ ≈ 1.2566", why: "Work out the radian value." },
        { work: "s ≈ 10 × 1.2566 ≈ 12.6 inches", why: "Multiply by the radius and round." },
      ],
      answer: "12.6",
    },
    {
      kind: "Degrees to a decimal in radians",
      card: { type: "numeric", prompt: "Convert 50° to radians as a decimal. (round to the nearest hundredth)", answer: 0.87, decimalPlaces: 2 },
      steps: [
        { work: "50 × π/180 = 50π/180", why: "Degrees to radians: multiply by π/180." },
        { work: "50 × 3.1416 ÷ 180", why: "Use π ≈ 3.1416." },
        { work: "≈ 0.87", why: "Round to the nearest hundredth." },
      ],
      answer: "0.87",
    },
  ],

  "unit-circle-values": [
    {
      kind: "Exact value in degrees",
      card: { type: "multiple-choice", prompt: "Find the exact value of cos 135°.", answer: "−√2/2", choices: ["−√2/2", "√2/2", "1/2", "−√3/2"] },
      steps: [
        { work: "135° is in Quadrant II, with reference angle 180° − 135° = 45°", why: "The reference angle gives the size of the value." },
        { work: "cos 45° = √2/2", why: "A 45° angle has x = y = √2/2." },
        { work: "cos is negative in Quadrant II", why: "Cosine is the x-coordinate, and x < 0 there." },
        { work: "cos 135° = −√2/2", why: "Size from the reference angle, sign from the quadrant." },
      ],
      answer: "−√2/2",
    },
    {
      kind: "Exact value in radians",
      card: { type: "multiple-choice", prompt: "Find the exact value of tan 5π/3.", answer: "−√3", choices: ["−√3", "√3", "−√3/2", "√3/3"] },
      steps: [
        { work: "5π/3 = 300°", why: "Each π is 180°, so 5 × 180° ÷ 3." },
        { work: "300° is in Quadrant IV, with reference angle 360° − 300° = 60°", why: "Measure to the nearest part of the x-axis." },
        { work: "tan 60° = √3", why: "tan 60° = (√3/2) ÷ (1/2)." },
        { work: "tan is negative in Quadrant IV", why: "Tangent is y/x, and the signs differ there." },
        { work: "tan 5π/3 = −√3", why: "Size from the reference angle, sign from the quadrant." },
      ],
      answer: "−√3",
    },
    {
      kind: "Quadrant of an angle past one turn",
      card: { type: "numeric", prompt: "In which quadrant does an angle of 480° in standard position lie? (answer 1, 2, 3 or 4)", answer: 2 },
      steps: [
        { work: "480° − 1 × 360° = 120°", why: "Take off a full turn to land between 0° and 360°." },
        { work: "90° < 120° < 180°", why: "Compare with the quadrant boundaries." },
        { work: "Quadrant II, so the answer is 2", why: "Angles between 90° and 180° are in Quadrant II." },
      ],
      answer: "2",
    },
    {
      kind: "Quadrant from two signs",
      card: { type: "numeric", prompt: "tan θ < 0 and sin θ > 0. In which quadrant does θ lie? (answer 1, 2, 3 or 4)", answer: 2 },
      steps: [
        { work: "tan θ < 0 in Quadrants II and IV", why: "Tangent is negative where x and y have different signs." },
        { work: "sin θ > 0 in Quadrants I and II", why: "Sine is the y-coordinate, positive above the x-axis." },
        { work: "both hold only in Quadrant II, so the answer is 2", why: "Pick the quadrant on both lists." },
      ],
      answer: "2",
    },
    {
      kind: "Sign of a function in a quadrant",
      card: { type: "multiple-choice", prompt: "What is the sign of cos θ when θ is in Quadrant III?", answer: "Negative", choices: ["Negative", "Positive", "Zero", "It depends on the angle"] },
      steps: [
        { work: "in Quadrant III, x < 0 and y < 0", why: "Quadrant III is left of and below the origin." },
        { work: "cos is the x-coordinate", why: "On the unit circle a point is (cos θ, sin θ)." },
        { work: "so cos θ is negative", why: "x is negative everywhere in Quadrant III." },
      ],
      answer: "Negative",
    },
    {
      kind: "The angle with a given value",
      card: { type: "numeric", prompt: "Find the angle θ with 0° ≤ θ < 360° in Quadrant IV where sin θ = −1/2.", answer: 330 },
      steps: [
        { work: "sin 30° = 1/2, so the reference angle is 30°", why: "The size of the value tells the reference angle." },
        { work: "θ = 360° − 30° = 330°", why: "A Quadrant IV angle is 360° minus its reference angle." },
      ],
      answer: "330",
    },
  ],

  "reference-angles": [
    {
      kind: "Reference angle in Quadrant II",
      card: { type: "numeric", prompt: "Find the reference angle of 155°.", answer: 25 },
      steps: [
        { work: "90° < 155° < 180°, so it is in Quadrant II", why: "The quadrant tells which part of the x-axis is nearest." },
        { work: "180° − 155° = 25°", why: "In Quadrant II, measure back to 180°." },
      ],
      answer: "25",
    },
    {
      kind: "Reference angle of an angle past one turn",
      card: { type: "numeric", prompt: "Find the reference angle of an angle measuring 500°.", answer: 40 },
      steps: [
        { work: "500° − 1 × 360° = 140°", why: "Take off a full turn first." },
        { work: "90° < 140° < 180°, so it is in Quadrant II", why: "Find the quadrant of the coterminal angle." },
        { work: "180° − 140° = 40°", why: "Measure to the x-axis at 180°." },
      ],
      answer: "40",
    },
    {
      kind: "Reference angle in radians",
      card: { type: "multiple-choice", prompt: "Find the reference angle of 7π/6.", answer: "π/6", choices: ["π/6", "7π/6", "π/3", "5π/6"] },
      steps: [
        { work: "7π/6 = 210°", why: "Each π is 180°, so 7 × 180° ÷ 6." },
        { work: "210° is in Quadrant III; 210° − 180° = 30°", why: "In Quadrant III, subtract 180°." },
        { work: "30° = π/6", why: "Write the answer back in radians." },
      ],
      answer: "π/6",
    },
    {
      kind: "Coterminal angle between 0° and 360°",
      card: { type: "numeric", prompt: "Find the angle between 0° and 360° that is coterminal with 850°.", answer: 130 },
      steps: [
        { work: "the angle is past 360°, so subtract full turns of 360°", why: "Coterminal angles differ by whole turns." },
        { work: "850° − 720° = 130°", why: "Two turns, 2 × 360° = 720°, land between 0° and 360°." },
      ],
      answer: "130",
    },
    {
      kind: "One trig value from another",
      card: { type: "multiple-choice", prompt: "cos θ = −5/13 and θ is in Quadrant III. Find sin θ.", answer: "−12/13", choices: ["−12/13", "12/13", "−5/13", "5/13"] },
      steps: [
        { work: "sin²θ = 1 − (5/13)² = 1 − 25/169", why: "Use sin²θ + cos²θ = 1." },
        { work: "1 − 25/169 = 144/169", why: "Write 1 as 169/169 and subtract." },
        { work: "sin θ = ±√(144/169) = ±12/13", why: "Take the square root of both sides." },
        { work: "sin is negative in Quadrant III, so sin θ = −12/13", why: "Sine is the y-coordinate, below the x-axis there." },
      ],
      answer: "−12/13",
    },
  ],
};
