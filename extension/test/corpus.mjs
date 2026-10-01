// Test corpus for extension/src/detect.js.
// Positives are written the way school sites show them. Each base problem is
// expanded into several renderings: ASCII, unicode (superscripts, real minus
// signs, <= as a single symbol), TeX run through texToText, and a bare form
// without the instruction when the math alone is a complete problem.
// Labels: k = expected kind, l = expected level (1 = Algebra 1, 2 = Algebra 2).

/** @typedef {{ i?: string, q: string, tex?: string, k: string, l: 1|2, bare?: boolean }} Base */

/** @type {Base[]} */
export const BASES = [
  // ---------------- Algebra 1: linear equations ----------------
  { i: "Solve for x:", q: "3x + 5 = 20", tex: "3x + 5 = 20", k: "linear-equation", l: 1, bare: true },
  { i: "Solve:", q: "2(x - 4) = 3x + 1", tex: "2(x-4)=3x+1", k: "linear-equation", l: 1, bare: true },
  { i: "Solve the equation.", q: "x/4 + 3 = 7", tex: "\\frac{x}{4} + 3 = 7", k: "linear-equation", l: 1, bare: true },
  { i: "Solve for n:", q: "-5n + 8 = -12", tex: "-5n+8=-12", k: "linear-equation", l: 1, bare: true },
  { i: "Solve.", q: "0.4x - 1.2 = 2", tex: "0.4x - 1.2 = 2", k: "linear-equation", l: 1 },
  { i: "Solve for y:", q: "(2/3)y - 4 = 10", tex: "\\frac{2}{3}y - 4 = 10", k: "linear-equation", l: 1, bare: true },
  { i: "Solve the multi-step equation:", q: "6x - 2(x + 3) = 10", tex: "6x-2\\left(x+3\\right)=10", k: "linear-equation", l: 1, bare: true },
  { i: "Solve for x:", q: "(x + 3)/5 = (x - 1)/3", tex: "\\frac{x+3}{5}=\\frac{x-1}{3}", k: "linear-equation", l: 1, bare: true },
  { i: "Solve.", q: "7 - x = 2x + 13", tex: "7 - x = 2x + 13", k: "linear-equation", l: 1, bare: true },
  { i: "Solve for k:", q: "12 = 4(k - 2)", tex: "12 = 4(k - 2)", k: "linear-equation", l: 1, bare: true },
  { i: "Solve for m:", q: "3(m + 2) - 4 = 2(m - 1)", k: "linear-equation", l: 1, bare: true },
  { i: "What value of x makes the equation true?", q: "5x - 9 = 3x + 7", k: "linear-equation", l: 1 },
  // literal equations
  { i: "Solve for h:", q: "A = (1/2)bh", tex: "A = \\frac{1}{2}bh", k: "linear-equation", l: 1 },
  { i: "Solve for w:", q: "P = 2l + 2w", tex: "P = 2l + 2w", k: "linear-equation", l: 1 },
  { i: "Solve for y:", q: "3x + 2y = 12", tex: "3x+2y=12", k: "linear-equation", l: 1 },
  { i: "Solve for t:", q: "d = rt", k: "linear-equation", l: 1 },
  { i: "Solve for r:", q: "C = 2*pi*r", tex: "C = 2\\pi r", k: "linear-equation", l: 1 },
  { i: "Solve the formula for b:", q: "y = mx + b", k: "linear-equation", l: 1 },
  // ---------------- inequalities ----------------
  { i: "Solve the inequality:", q: "3x - 7 < 11", tex: "3x - 7 < 11", k: "linear-inequality", l: 1, bare: true },
  { i: "Solve and graph:", q: "-2x + 5 >= 13", tex: "-2x + 5 \\ge 13", k: "linear-inequality", l: 1, bare: true },
  { i: "Solve:", q: "4(x + 1) <= 2x - 6", tex: "4(x+1) \\le 2x - 6", k: "linear-inequality", l: 1, bare: true },
  { i: "Solve the compound inequality:", q: "-3 < 2x + 1 <= 7", tex: "-3 < 2x + 1 \\leq 7", k: "linear-inequality", l: 1, bare: true },
  { i: "Solve:", q: "2x + 1 < -3 or 3x - 2 > 7", tex: "2x+1<-3 \\text{ or } 3x-2>7", k: "linear-inequality", l: 1, bare: true },
  { i: "Solve the inequality.", q: "x/3 - 2 > 4", tex: "\\frac{x}{3} - 2 > 4", k: "linear-inequality", l: 1, bare: true },
  // ---------------- absolute value ----------------
  { i: "Solve:", q: "|x - 4| <= 6", tex: "\\left| x - 4 \\right| \\le 6", k: "absolute-value", l: 1, bare: true },
  { i: "Solve for x:", q: "|2x + 1| = 9", tex: "|2x+1| = 9", k: "absolute-value", l: 1, bare: true },
  { i: "Solve:", q: "3|x - 2| + 4 = 19", tex: "3\\left|x-2\\right|+4=19", k: "absolute-value", l: 1, bare: true },
  // ---------------- slope and lines ----------------
  { q: "Find the slope of the line that passes through (-2, 5) and (4, -7).", k: "linear-equation", l: 1 },
  { q: "Find the slope between the points (1, 3) and (6, 13).", k: "linear-equation", l: 1 },
  { q: "Write an equation in point-slope form for the line through (2, -1) with slope 3.", k: "linear-equation", l: 1 },
  { i: "Write the equation in slope-intercept form:", q: "4x - 2y = 8", tex: "4x - 2y = 8", k: "linear-equation", l: 1 },
  { i: "Find the slope and y-intercept of", q: "y = -3x + 5", tex: "y = -3x + 5", k: "linear-equation", l: 1 },
  { i: "Graph the line", q: "y - 4 = 2(x + 1)", tex: "y - 4 = 2(x + 1)", k: "linear-equation", l: 1 },
  { i: "Convert to standard form:", q: "y = (2/3)x - 4", tex: "y = \\frac{2}{3}x - 4", k: "linear-equation", l: 1 },
  // ---------------- systems ----------------
  { i: "Solve the system of equations:", q: "2x + y = 7 and x - y = 2", tex: "\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}", k: "system", l: 1, bare: true },
  { i: "Solve the system by substitution:", q: "y = 3x - 1\n2x + y = 9", tex: "\\begin{aligned} y &= 3x - 1 \\\\ 2x + y &= 9 \\end{aligned}", k: "system", l: 1, bare: true },
  { i: "Use elimination to solve.", q: "3x + 2y = 16, 5x - 2y = 0", tex: "3x + 2y = 16,\\quad 5x - 2y = 0", k: "system", l: 1 },
  { i: "Solve the system of inequalities:", q: "y > 2x - 1 and y <= -x + 5", tex: "y > 2x - 1 \\text{ and } y \\le -x + 5", k: "system", l: 1 },
  { i: "Solve by graphing:", q: "y = x + 2\ny = -2x + 5", k: "system", l: 1, bare: true },
  // ---------------- functions ----------------
  { i: "Evaluate f(3) for", q: "f(x) = 2x^2 - x + 4", tex: "f(x) = 2x^{2} - x + 4", k: "function", l: 1 },
  { q: "If g(x) = 5 - 3x, find g(-2).", k: "function", l: 1 },
  { i: "Find the domain and range of", q: "f(x) = sqrt(x - 3)", tex: "f(x) = \\sqrt{x - 3}", k: "function", l: 1 },
  { q: "Given h(t) = -16t^2 + 64t, find h(2).", k: "function", l: 1 },
  { q: "Find the range of f(x) = x^2 + 1.", k: "function", l: 1 },
  { i: "Evaluate f(-2) when", q: "f(x) = 3x^2 - 2x + 1", tex: "f(x)=3x^2-2x+1", k: "function", l: 1 },
  { i: "Evaluate f(-1) and f(3) for", q: "f(x) = { x^2 if x < 0; 2x + 1 if x >= 0 }", tex: "f(x) = \\begin{cases} x^2, & x < 0 \\\\ 2x + 1, & x \\ge 0 \\end{cases}", k: "function", l: 1 },
  // ---------------- sequences ----------------
  { q: "Find the next three terms of the arithmetic sequence 5, 9, 13, 17, ...", k: "sequence", l: 1 },
  { q: "Write an explicit formula for the arithmetic sequence 2, 8, 14, 20, ...", k: "sequence", l: 1 },
  { q: "Find the 10th term of the geometric sequence 3, 6, 12, 24, ...", k: "sequence", l: 1 },
  { i: "Find the first four terms of the sequence", q: "a_n = 3n + 2", tex: "a_{n} = 3n + 2", k: "sequence", l: 1 },
  { q: "Find the 5th term of the sequence defined by a_1 = 2 and a_n = 3a_(n-1).", k: "sequence", l: 1 },
  { q: "Find the 12th term of the geometric sequence with a_1 = 3 and r = 2.", k: "sequence", l: 1 },
  // ---------------- exponents and scientific notation ----------------
  { i: "Simplify.", q: "(3x^2 y^3)(4x^5 y)", tex: "(3x^{2}y^{3})(4x^{5}y)", k: "expression", l: 1 },
  { i: "Simplify:", q: "(2a^3)^4", tex: "(2a^{3})^{4}", k: "expression", l: 1 },
  { i: "Simplify and write with positive exponents:", q: "x^-3 * x^7", tex: "x^{-3} \\cdot x^{7}", k: "expression", l: 1 },
  { i: "Simplify.", q: "(5m^4 n^-2)^2", tex: "(5m^{4}n^{-2})^{2}", k: "expression", l: 1 },
  { i: "Simplify and write in scientific notation:", q: "(4 x 10^3)(2.5 x 10^5)", tex: "(4 \\times 10^{3})(2.5 \\times 10^{5})", k: "expression", l: 1 },
  { i: "Simplify:", q: "(6.4 x 10^5 y^3)(2 x 10^-2 y)", tex: "(6.4 \\times 10^{5} y^{3})(2 \\times 10^{-2} y)", k: "expression", l: 1 },
  { i: "Evaluate", q: "3a + 2b when a = 4 and b = -1", k: "expression", l: 1 },
  { i: "Simplify the expression:", q: "3(x + 4) - 2(x - 1)", tex: "3(x+4)-2(x-1)", k: "expression", l: 1 },
  // ---------------- radicals ----------------
  { i: "Simplify:", q: "sqrt(72)", tex: "\\sqrt{72}", k: "radical", l: 1 },
  { i: "Simplify.", q: "sqrt(50x^3 y^4)", tex: "\\sqrt{50x^{3}y^{4}}", k: "radical", l: 1 },
  { i: "Simplify:", q: "3sqrt(12) + 5sqrt(27)", tex: "3\\sqrt{12} + 5\\sqrt{27}", k: "radical", l: 1 },
  { i: "Rationalize the denominator:", q: "6/sqrt(3)", tex: "\\frac{6}{\\sqrt{3}}", k: "radical", l: 1 },
  // ---------------- polynomials ----------------
  { i: "Simplify:", q: "(3x^2 + 2x - 5) + (x^2 - 4x + 7)", tex: "(3x^2+2x-5)+(x^2-4x+7)", k: "polynomial", l: 1 },
  { i: "Subtract:", q: "(5x^2 - 3x + 2) - (2x^2 + x - 6)", tex: "(5x^{2}-3x+2)-(2x^{2}+x-6)", k: "polynomial", l: 1 },
  { i: "Multiply:", q: "(x + 5)(x - 3)", tex: "(x+5)(x-3)", k: "polynomial", l: 1 },
  { i: "Use FOIL to multiply", q: "(2x - 3)(x + 4)", tex: "(2x-3)(x+4)", k: "polynomial", l: 1 },
  { i: "Expand:", q: "(3x - 2)^2", tex: "\\left(3x-2\\right)^{2}", k: "polynomial", l: 1 },
  { i: "Multiply:", q: "2x(3x^2 - 5x + 1)", tex: "2x(3x^2-5x+1)", k: "polynomial", l: 1 },
  { i: "Combine like terms:", q: "4x^2 + 3x - 2x^2 + 7 - x", tex: "4x^2+3x-2x^2+7-x", k: "polynomial", l: 1 },
  // ---------------- factoring ----------------
  { i: "Factor completely:", q: "x^2 + 7x + 12", tex: "x^{2}+7x+12", k: "factoring", l: 1 },
  { i: "Factor:", q: "x^2 - 49", tex: "x^2 - 49", k: "factoring", l: 1 },
  { i: "Factor completely.", q: "6x^2 + 11x - 4", tex: "6x^2 + 11x - 4", k: "factoring", l: 1 },
  { i: "Factor out the GCF:", q: "12x^3 - 18x^2", tex: "12x^3-18x^2", k: "factoring", l: 1 },
  { i: "Factor the trinomial:", q: "2x^2 - 7x + 3", tex: "2x^{2} - 7x + 3", k: "factoring", l: 1 },
  // ---------------- quadratics ----------------
  { i: "Solve by factoring:", q: "x^2 - 5x + 6 = 0", tex: "x^2 - 5x + 6 = 0", k: "quadratic", l: 1, bare: true },
  { i: "Use the quadratic formula to solve", q: "2x^2 + 3x - 5 = 0", tex: "2x^{2}+3x-5=0", k: "quadratic", l: 1, bare: true },
  { i: "Solve by completing the square:", q: "x^2 + 6x - 7 = 0", tex: "x^2+6x-7=0", k: "quadratic", l: 1, bare: true },
  { i: "Solve.", q: "3x^2 = 48", tex: "3x^{2} = 48", k: "quadratic", l: 1, bare: true },
  { i: "Find the vertex of", q: "y = x^2 - 4x + 3", tex: "y = x^2 - 4x + 3", k: "quadratic", l: 1 },
  { i: "Write in vertex form:", q: "y = x^2 + 8x + 10", tex: "y=x^{2}+8x+10", k: "quadratic", l: 1 },
  { i: "Find the axis of symmetry and vertex of", q: "f(x) = -2x^2 + 8x - 1", tex: "f(x) = -2x^{2} + 8x - 1", k: "quadratic", l: 1 },
  { i: "Solve:", q: "(x - 3)^2 = 25", tex: "(x-3)^{2} = 25", k: "quadratic", l: 1, bare: true },
  { i: "Find the zeros of", q: "f(x) = x^2 - 2x - 15", tex: "f(x) = x^2 - 2x - 15", k: "quadratic", l: 1 },
  { i: "Solve the quadratic equation", q: "x^2 + 4x - 21 = 0", tex: "x^{2} + 4x - 21 = 0", k: "quadratic", l: 1, bare: true },
  { i: "Write in vertex form by completing the square:", q: "x^2 + 6x + 5", k: "quadratic", l: 1 },
  // ---------------- exponential (Algebra 1) ----------------
  { i: "Identify growth or decay:", q: "y = 250(0.85)^x", tex: "y = 250(0.85)^{x}", k: "exponential", l: 1 },
  { i: "Solve:", q: "3^(x + 1) = 81", tex: "3^{x+1} = 81", k: "exponential", l: 1, bare: true },
  { i: "Evaluate the function", q: "y = 2(3)^x when x = 4", k: "exponential", l: 1 },
  { i: "Solve for x:", q: "4^(2x - 1) = 64", tex: "4^{2x-1} = 64", k: "exponential", l: 1, bare: true },
  // ---------------- word problems (Algebra 1) ----------------
  { q: "A town of 4,500 people grows 3% each year. The population after t years is P = 4500(1.03)^t. What is the population after 10 years?", k: "word-problem", l: 1 },
  { q: "A gym charges a $50 sign-up fee plus $25 per month. The equation C = 25m + 50 gives the total cost. After how many months will the total cost be $200?", k: "word-problem", l: 1 },
  { q: "Maria has $120 and saves $15 each week. Write and solve the equation 120 + 15w = 300 to find how many weeks it takes her to reach $300.", k: "word-problem", l: 1 },
  { q: "The length of a rectangle is 3 more than twice its width. If 2(2w + 3) + 2w = 54 gives the perimeter in inches, find the width.", k: "word-problem", l: 1 },
  { q: "A ball is thrown upward and its height is h = -16t^2 + 48t + 4 feet after t seconds. When does the ball hit the ground?", k: "word-problem", l: 1 },
  { q: "Tickets to the school play cost $8 for students and $12 for adults. The club sold 150 tickets and made $1,400, so x + y = 150 and 8x + 12y = 1400. How many student tickets were sold?", k: "word-problem", l: 1 },
  { q: "A phone plan costs $35 per month plus $0.10 per text message. The monthly cost is 35 + 0.10t dollars for t texts. What is the cost if you send 200 texts?", k: "word-problem", l: 1 },
  { q: "Jake is 4 years older than his sister. If s + (s + 4) = 30 represents the sum of their ages, how old is his sister?", k: "word-problem", l: 1 },

  // ================= Algebra 2 =================
  // logarithms
  { i: "Solve for x:", q: "log_2(x + 3) = 5", tex: "\\log_{2}(x+3) = 5", k: "logarithmic", l: 2, bare: true },
  { i: "Evaluate", q: "log_3 81", tex: "\\log_{3} 81", k: "logarithmic", l: 2 },
  { i: "Condense into a single logarithm:", q: "2log(x) + 3log(y) - log(z)", tex: "2\\log x + 3\\log y - \\log z", k: "logarithmic", l: 2 },
  { i: "Expand the logarithm:", q: "ln(x^3 y / z^2)", tex: "\\ln\\left(\\frac{x^{3}y}{z^{2}}\\right)", k: "logarithmic", l: 2 },
  { i: "Solve:", q: "ln(x) + ln(x - 2) = ln(8)", tex: "\\ln x + \\ln(x-2) = \\ln 8", k: "logarithmic", l: 2, bare: true },
  { i: "Solve.", q: "log(x) + log(x - 3) = 1", tex: "\\log x + \\log(x - 3) = 1", k: "logarithmic", l: 2, bare: true },
  { i: "Solve for x:", q: "ln(2x - 1) = 3", tex: "\\ln(2x-1)=3", k: "logarithmic", l: 2, bare: true },
  { i: "Evaluate", q: "log_5(1/25)", tex: "\\log_{5}\\left(\\frac{1}{25}\\right)", k: "logarithmic", l: 2 },
  { i: "Write as a single logarithm:", q: "log_4(x) + log_4(x + 2)", tex: "\\log_{4} x + \\log_{4}(x+2)", k: "logarithmic", l: 2 },
  { i: "Find the domain of", q: "f(x) = log(x - 5)", tex: "f(x) = \\log(x-5)", k: "function", l: 2 },
  // exponential with e
  { i: "Solve for x:", q: "e^(2x) = 15", tex: "e^{2x} = 15", k: "exponential", l: 2, bare: true },
  { i: "Solve:", q: "5e^(x - 1) + 2 = 22", tex: "5e^{x-1} + 2 = 22", k: "exponential", l: 2, bare: true },
  { q: "An account earns interest compounded continuously, so the balance is A = 2000e^(0.05t). How many years until the balance reaches $5,000?", k: "word-problem", l: 2 },
  { q: "A radioactive substance decays according to A = 500e^(-0.03t), where t is in years. After how many years will 200 grams remain?", k: "word-problem", l: 2 },
  { i: "Graph and state the asymptote of", q: "y = e^(x) - 3", tex: "y = e^{x} - 3", k: "exponential", l: 2 },
  // rational
  { i: "Solve:", q: "3/x + 1/2 = 5/(2x)", tex: "\\frac{3}{x} + \\frac{1}{2} = \\frac{5}{2x}", k: "rational", l: 2, bare: true },
  { i: "Simplify:", q: "(x^2 - 9)/(x^2 + 5x + 6)", tex: "\\frac{x^2-9}{x^2+5x+6}", k: "rational", l: 2 },
  { i: "Solve for x:", q: "x/(x - 2) = 4/(x - 2) + 3", tex: "\\frac{x}{x-2} = \\frac{4}{x-2} + 3", k: "rational", l: 2, bare: true },
  { i: "Multiply and simplify:", q: "(x + 2)/(x - 3) * (x^2 - 9)/(x^2 - 4)", tex: "\\frac{x+2}{x-3} \\cdot \\frac{x^2-9}{x^2-4}", k: "rational", l: 2 },
  { i: "Find the vertical asymptote of", q: "f(x) = 2/(x + 4)", tex: "f(x) = \\frac{2}{x+4}", k: "rational", l: 2 },
  { i: "Solve:", q: "(x + 1)/(x - 1) >= 0", tex: "\\frac{x+1}{x-1} \\geq 0", k: "rational", l: 2, bare: true },
  { i: "Simplify the complex fraction:", q: "(1/x + 1/y)/(1/x - 1/y)", tex: "\\dfrac{\\frac{1}{x}+\\frac{1}{y}}{\\frac{1}{x}-\\frac{1}{y}}", k: "rational", l: 2 },
  { i: "Solve the rational equation:", q: "2/(x + 1) = 1/(x - 2)", tex: "\\frac{2}{x+1}=\\frac{1}{x-2}", k: "rational", l: 2, bare: true },
  { i: "Divide:", q: "(6x^3 - 4x^2 + 2x)/(2x)", tex: "\\frac{6x^3-4x^2+2x}{2x}", k: "rational", l: 2 },
  // radical equations
  { i: "Solve:", q: "sqrt(2x + 3) = 5", tex: "\\sqrt{2x+3} = 5", k: "radical", l: 2, bare: true },
  { i: "Solve for x:", q: "sqrt(x + 7) = x - 5", tex: "\\sqrt{x+7} = x - 5", k: "radical", l: 2, bare: true },
  { i: "Solve.", q: "(x - 2)^(1/3) = 3", tex: "\\sqrt[3]{x-2} = 3", k: "radical", l: 2, bare: true },
  { i: "Solve and check for extraneous solutions:", q: "sqrt(3x - 2) + 4 = x", tex: "\\sqrt{3x-2}+4=x", k: "radical", l: 2, bare: true },
  // complex numbers
  { i: "Simplify:", q: "(3 + 2i)(4 - i)", tex: "(3+2i)(4-i)", k: "complex", l: 2 },
  { i: "Simplify.", q: "i^23", tex: "i^{23}", k: "complex", l: 2 },
  { i: "Write in standard form:", q: "(5 - 3i)/(2 + i)", tex: "\\frac{5-3i}{2+i}", k: "complex", l: 2 },
  { i: "Simplify:", q: "sqrt(-48)", tex: "\\sqrt{-48}", k: "complex", l: 2 },
  { i: "Solve over the complex numbers:", q: "x^2 + 4x + 13 = 0", tex: "x^2+4x+13=0", k: "complex", l: 2 },
  { i: "Simplify:", q: "(2 - 5i) - (3 + 4i)", tex: "(2-5i)-(3+4i)", k: "complex", l: 2 },
  // polynomials of degree 3+
  { i: "Solve:", q: "x^3 - 6x^2 + 11x - 6 = 0", tex: "x^{3} - 6x^{2} + 11x - 6 = 0", k: "polynomial", l: 2, bare: true },
  { i: "Find all real zeros of", q: "p(x) = x^4 - 5x^2 + 4", tex: "p(x) = x^4 - 5x^2 + 4", k: "polynomial", l: 2 },
  { i: "Divide using long division:", q: "(x^3 + 2x^2 - 5x - 6) / (x + 3)", tex: "(x^3+2x^2-5x-6) \\div (x+3)", k: "polynomial", l: 2 },
  { i: "Use synthetic division to divide", q: "x^3 - 4x^2 + x + 6 by x - 2", k: "polynomial", l: 2 },
  { i: "Factor completely:", q: "x^3 - 27", tex: "x^{3} - 27", k: "factoring", l: 2 },
  { i: "Factor:", q: "8x^3 + 125", tex: "8x^3+125", k: "factoring", l: 2 },
  { i: "Factor by grouping:", q: "x^3 + 3x^2 + 2x + 6", tex: "x^3+3x^2+2x+6", k: "factoring", l: 2 },
  { i: "Solve by factoring:", q: "x^3 - 9x = 0", tex: "x^3 - 9x = 0", k: "polynomial", l: 2, bare: true },
  { i: "Solve:", q: "x^4 - 13x^2 + 36 = 0", tex: "x^4-13x^2+36=0", k: "polynomial", l: 2, bare: true },
  { i: "Find all solutions:", q: "2x^3 + x^2 - 8x - 4 = 0", tex: "2x^3+x^2-8x-4=0", k: "polynomial", l: 2, bare: true },
  { i: "Expand using the Binomial Theorem:", q: "(x + 2)^4", tex: "(x+2)^{4}", k: "polynomial", l: 2 },
  // inverse and composite functions
  { i: "Find the inverse of", q: "f(x) = (2x + 1)/3", tex: "f(x) = \\frac{2x+1}{3}", k: "function", l: 2 },
  { i: "Find f^-1(x) if", q: "f(x) = x^3 - 4", tex: "f(x) = x^{3} - 4", k: "function", l: 2 },
  { q: "If f(x) = 2x + 3 and g(x) = x^2 - 1, find (f o g)(x).", k: "function", l: 2 },
  { q: "Given f(x) = 3x - 5 and g(x) = x^2, find f(g(2)).", k: "function", l: 2 },
  { i: "Find the inverse function of", q: "y = 4x - 9", tex: "y = 4x - 9", k: "function", l: 2 },
  // sequences and series
  { i: "Evaluate the sum:", q: "\u03A3_(k=1)^5 (2k + 1)", tex: "\\sum_{k=1}^{5} (2k+1)", k: "sequence", l: 2 },
  { q: "Find the sum of the first 20 terms of the arithmetic series 4 + 9 + 14 + 19 + ...", k: "sequence", l: 2 },
  { q: "Find the sum of the infinite geometric series 8 + 4 + 2 + 1 + ...", k: "sequence", l: 2 },
  { q: "Write the series 3 + 6 + 9 + ... + 30 in sigma notation.", k: "sequence", l: 2 },
  { i: "Find the sum:", q: "\u03A3_(n=1)^10 3(2)^(n-1)", tex: "\\displaystyle\\sum_{n=1}^{10} 3(2)^{n-1}", k: "sequence", l: 2 },
  // conic sections
  { i: "Find the center and radius of the circle", q: "(x - 2)^2 + (y + 3)^2 = 16", tex: "(x-2)^{2} + (y+3)^{2} = 16", k: "quadratic", l: 2 },
  { i: "Identify the conic section:", q: "x^2/9 + y^2/4 = 1", tex: "\\frac{x^2}{9} + \\frac{y^2}{4} = 1", k: "quadratic", l: 2 },
  { i: "Write in standard form:", q: "x^2 + y^2 - 6x + 4y - 12 = 0", tex: "x^2+y^2-6x+4y-12=0", k: "quadratic", l: 2 },
  { i: "Graph the hyperbola", q: "y^2/16 - x^2/9 = 1", tex: "\\frac{y^{2}}{16} - \\frac{x^{2}}{9} = 1", k: "quadratic", l: 2 },
  // systems (Algebra 2)
  { i: "Solve the system:", q: "x + y + z = 6, 2x - y + z = 3, x + 2y - z = 2", tex: "\\begin{cases} x+y+z=6 \\\\ 2x-y+z=3 \\\\ x+2y-z=2 \\end{cases}", k: "system", l: 2 },
  { i: "Solve the nonlinear system:", q: "y = x^2 - 4 and y = 2x - 1", tex: "\\begin{cases} y = x^2 - 4 \\\\ y = 2x - 1 \\end{cases}", k: "system", l: 2 },
  // misc Algebra 2
  { q: "The pH of a solution is pH = -log(H). Solve -log(x) = 3.2 to find the hydrogen ion concentration.", k: "logarithmic", l: 2 }
];

const SUPER = { "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079", "-": "\u207B" };
const HYPHEN_WORDS = /\b(slope-intercept|point-slope|y-intercept|x-intercept|sign-up|multi-step|half-life|n-th)\b/gi;

/** Unicode rendering: superscript digits, real minus signs, single-symbol relations, root sign, middle dot. */
export function toUnicode(s) {
  const saved = [];
  let t = s.replace(HYPHEN_WORDS, (m) => { saved.push(m); return "\u0001" + (saved.length - 1) + "\u0001"; });
  t = t.replace(/<=/g, "\u2264").replace(/>=/g, "\u2265").replace(/!=/g, "\u2260");
  t = t.replace(/\^(-?\d+)(?![\d.])/g, (m, e) => e.split("").map((c) => SUPER[c]).join(""));
  t = t.replace(/sqrt\(/g, "\u221A(").replace(/\bpi\b/g, "\u03C0").replace(/\*/g, "\u00B7");
  t = t.replace(/ o g\)/g, " \u2218 g)");
  t = t.replace(/-/g, "\u2212");
  t = t.replace(/\u0001(\d+)\u0001/g, (m, n) => saved[Number(n)]);
  return t;
}

/**
 * Expand the bases into positive test cases.
 * @param {(tex: string) => string} texToText
 */
export function buildPositives(texToText) {
  const out = [];
  BASES.forEach((b, idx) => {
    const pre = b.i ? b.i + " " : "";
    const seen = new Set();
    const add = (render, text) => {
      if (seen.has(text)) return;
      seen.add(text);
      out.push({ id: idx + ":" + render, base: idx, render, text, kind: b.k, level: b.l });
    };
    add("ascii", pre + b.q);
    const uni = pre + toUnicode(b.q);
    if (uni !== pre + b.q) add("unicode", uni);
    if (b.tex) add("tex", pre + texToText(b.tex));
    if (b.bare) add("bare", b.q);
  });
  return out;
}

// Negatives: text that real pages contain and that must NOT be flagged.
// [category, text]
export const NEGATIVES = [
  // JavaScript / TypeScript
  ["code", "let y = x * 2;"],
  ["code", "const total = price * qty + tax;"],
  ["code", "for (let i = 0; i < n; i++) {"],
  ["code", "if (a == b) return true;"],
  ["code", "x = x + 1;"],
  ["code", "i++"],
  ["code", "while (count < 10) { count += 2; }"],
  ["code", "function area(r) { return Math.PI * r * r; }"],
  ["code", "const y = m * x + b;"],
  ["code", "arr[i] = arr[i - 1] + 2"],
  ["code", "console.log(x + y);"],
  ["code", "export default function App() { return null; }"],
  ["code", "if (score >= 90 && score <= 100) grade = 'A';"],
  ["code", "const f = (x) => x * x + 1;"],
  ["code", "document.getElementById(\"answer\").value = 42;"],
  ["code", "var n = parseInt(input, 10);"],
  ["code", "x += 5"],
  ["code", "a != b"],
  ["code", "const ratio = width / height;"],
  ["code", "return a * b - c;"],
  // Python
  ["code", "def f(x): return x**2 + 1"],
  ["code", "print(x + y)"],
  ["code", "for i in range(10): total = total + i"],
  ["code", "y = x ** 2 - 3 * x"],
  ["code", "import numpy as np"],
  ["code", "from math import sqrt"],
  ["code", "if x == 3: print('three')"],
  ["code", "elif n % 2 == 0:"],
  ["code", "result = [x * 2 for x in nums]"],
  ["code", "lambda x: x + 1"],
  // C / Java
  ["code", "int y = 3 * x + 2;"],
  ["code", "#include <stdio.h>"],
  ["code", "printf(\"%d\", a + b);"],
  ["code", "public static void main(String[] args) {"],
  ["code", "System.out.println(x * x);"],
  ["code", "float avg = sum / count;"],
  // CSS
  ["code", "width: calc(100% - 2rem);"],
  ["code", "h1 { font-size: 2em; margin: 0 auto; }"],
  ["code", ".grid { grid-template-columns: 1fr 2fr; gap: 16px; }"],
  ["code", "@media (max-width: 768px) { .card { padding: 8px; } }"],
  ["code", "transform: translate(-50%, -50%) rotate(45deg);"],
  // JSON / data
  ["code", "{\"x\": 3, \"y\": -2, \"label\": \"Point A\"}"],
  ["code", "{\"score\": 92, \"total\": 100}"],
  // SQL
  ["code", "SELECT name FROM students WHERE grade >= 90;"],
  ["code", "UPDATE scores SET points = points + 5 WHERE id = 12"],
  ["code", "INSERT INTO grades (student, score) VALUES ('Ana', 88)"],
  // spreadsheet formulas
  ["code", "=SUM(A1:A5)"],
  ["code", "=B2*C2"],
  ["code", "=IF(A1>10,\"Yes\",\"No\")"],
  ["code", "=AVERAGE(B2:B30)/2"],
  ["code", "=VLOOKUP(D2, A:B, 2, FALSE)"],
  // URLs and query strings
  ["url", "https://example.com/search?q=x+y&page=2"],
  ["url", "www.mathsite.org/algebra?x=5&y=10"],
  ["url", "https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?usp=sf_link"],
  ["url", "Visit khanacademy.org/math/algebra for more practice."],
  ["url", "?id=123&ref=home&utm_source=newsletter"],
  ["url", "Email me at teacher@school.org with questions."],
  ["url", "Download worksheet-3.pdf before class."],
  // dates and times
  ["date", "2026-09-30"],
  ["date", "Due 9/30/2026"],
  ["date", "Posted on Sep 30, 2026 at 10:45 AM"],
  ["date", "Quiz moved to 10/14 - study chapters 3-4"],
  ["date", "Updated: 03.15.2025"],
  ["date", "Class runs 8:15-9:05 a.m. Monday through Friday."],
  ["time", "Meeting at 3:30 p.m. in Room 204"],
  ["time", "Practice is 4-6pm on weekdays."],
  ["time", "Video length 12:34"],
  ["time", "The bus leaves at 7:05 and arrives at 7:50."],
  // phone numbers
  ["phone", "Call (555) 123-4567 for details."],
  ["phone", "+1 302-555-0199"],
  ["phone", "Office: 302.555.0142 ext. 4"],
  // sports scores
  ["sports", "Eagles win 24-17 over the Giants"],
  ["sports", "Final score: Lakers 102, Celtics 99"],
  ["sports", "We lost 3-2 in overtime."],
  ["sports", "The team is 8-1 this season."],
  ["sports", "Set scores: 25-21, 23-25, 15-12"],
  // prices and tax math in prose
  ["price", "Total: $12.50 + 8% tax = $13.50"],
  ["price", "3 x $4.99 = $14.97"],
  ["price", "The jacket was $80, now 25% off, so you pay $60 plus 6% tax."],
  ["price", "Buy 2, get 1 free!"],
  ["price", "Subtotal $45.00, shipping $5.99, total $50.99"],
  ["price", "Price per unit = $2.50"],
  ["price", "Save 20% when you spend $100 or more."],
  ["price", "Lunch costs $3.25 a day, which is $16.25 a week."],
  // version numbers
  ["version", "Version 2.3.1 released"],
  ["version", "Requires Node 18.x or later"],
  ["version", "iOS 17.4 update fixes bugs"],
  ["version", "Python 3.12 is now available"],
  ["version", "v1.0.0-beta.2"],
  ["version", "Chrome 154.0.8037.58"],
  // screen resolutions
  ["resolution", "Screen resolution: 1920x1080"],
  ["resolution", "Supports 4K at 3840 x 2160, 60 fps"],
  ["resolution", "Upload a 1080p video, max 2560x1440."],
  ["resolution", "Image size 800 x 600 px"],
  // product and model codes
  ["product", "Model X-200 = best seller"],
  ["product", "A4 = 210 x 297 mm"],
  ["product", "SKU: AB-1234-XL"],
  ["product", "Samsung SM-G991B"],
  ["product", "Order the TI-84 Plus CE calculator"],
  ["product", "Use a 2x4 board and #8 screws."],
  ["product", "Part number B12-77, size M"],
  ["product", "F-150 towing capacity 13,500 lbs"],
  // chemistry
  ["chemistry", "2H2 + O2 = 2H2O"],
  ["chemistry", "CO2 + H2O = H2CO3"],
  ["chemistry", "NaCl dissolves in H2O"],
  ["chemistry", "CH4 + 2O2 = CO2 + 2H2O"],
  ["chemistry", "Fe2O3 + 3CO = 2Fe + 3CO2"],
  ["chemistry", "C6H12O6 + 6O2 = 6CO2 + 6H2O + energy"],
  ["chemistry", "The pH of 7 is neutral."],
  // physics units prose
  ["physics", "The car travels at 20 m/s for 5 s."],
  ["physics", "A force of 12 N acts on a 3 kg mass."],
  ["physics", "Gravity is about 9.8 m/s^2 near Earth."],
  ["physics", "The speed of light is 3.0 x 10^8 m/s."],
  ["physics", "E = mc^2 is the most famous equation in physics."],
  ["physics", "Newton's second law, F = ma, links force and acceleration."],
  ["physics", "The bulb uses 60 W at 120 V."],
  ["physics", "Water boils at 100 \u00B0C at sea level."],
  ["physics", "Ohm's law: V = IR"],
  // plain English with single letters
  ["prose", "Plan A = the safe option"],
  ["prose", "I = me"],
  ["prose", "Option B is better than option C."],
  ["prose", "Vitamin C + zinc = immune support"],
  ["prose", "Grade A = 90-100, B = 80-89"],
  ["prose", "Is x > y? Yes."],
  ["prose", "Team A vs Team B: who wins?"],
  ["prose", "Let x = the number of apples."],
  ["prose", "Row F, Seat 12"],
  ["prose", "I think I can, I think I can."],
  ["prose", "Press A to jump and B to run."],
  ["prose", "Exit 4B, then turn left."],
  ["prose", "Our plan: step 1 = research, step 2 = build."],
  ["prose", "Watch at 2x speed to save time."],
  ["prose", "She got a B+ on the test and an A- on the project."],
  ["prose", "Group A has 5 students; group B has 7."],
  ["prose", "p < 0.05 means the result is significant."],
  ["prose", "R^2 = 0.87 for the trend line."],
  ["prose", "n = 30 students took the survey"],
  ["prose", "Me + you = best friends forever"],
  ["prose", "Hard work + practice = success"],
  ["prose", "Love > hate"],
  ["prose", "The 1990s and 2000s were very different."],
  ["prose", "Wait 2-3 business days for delivery."],
  ["prose", "Mix 1 cup flour + 2 eggs = batter"],
  // section headings alone
  ["heading", "Chapter 3: Linear Functions"],
  ["heading", "Unit 5 - Quadratic Equations"],
  ["heading", "Lesson 2.4: Solving Inequalities"],
  ["heading", "Section 7.1 Exponential Growth and Decay"],
  ["heading", "Algebra 2 Honors - Period 3"],
  ["heading", "Module 4 Review: Systems of Equations"],
  ["heading", "Topic 9: Logarithms"],
  ["heading", "Part B"],
  // grade reports
  ["grade", "Grade: 92/100"],
  ["grade", "Score: 18/20 = 90%"],
  ["grade", "Quiz 4: 7 out of 10"],
  ["grade", "Current average 88.5%"],
  ["grade", "GPA 3.8 / 4.0"],
  ["grade", "Points earned 45 / 50"],
  // seat numbers and locations
  ["seat", "Seat 14C, Row 22"],
  ["seat", "Gate B12 boards at noon"],
  ["seat", "Room 3-105, Building A"],
  ["seat", "Locker #214"],
  ["seat", "Section 112, Row K, Seat 9"],
  // keyboard shortcuts
  ["shortcut", "Ctrl+C to copy, Ctrl+V to paste"],
  ["shortcut", "Press Cmd + Shift + P"],
  ["shortcut", "Alt+F4 closes the window"],
  ["shortcut", "Use Ctrl + Z to undo."],
  ["shortcut", "Shift+Enter adds a new line"],
  // hashtags and social
  ["hashtag", "#Algebra2 #mathlife"],
  ["hashtag", "#x2 challenge accepted"],
  ["hashtag", "@mathteacher thanks for the help!"],
  ["hashtag", "Day 3 of #100DaysOfCode"],
  // math-free text that mentions algebra
  ["mentions", "I love Algebra 1 class!"],
  ["mentions", "Algebra 2 test tomorrow, wish me luck"],
  ["mentions", "Our algebra teacher is the best."],
  ["mentions", "Sign up for Algebra 1 tutoring on Tuesdays."],
  ["mentions", "Quadratic equations are my favorite topic."],
  ["mentions", "Bring a calculator and a pencil to the algebra final."],
  ["mentions", "This unit covers slope, systems, and functions."],
  ["mentions", "Homework: page 214, problems 1-15 odd"],
  ["mentions", "Read pages 45-60 before Friday."],
  ["mentions", "Questions 1 through 10 are multiple choice."],
  // misc numeric noise
  ["noise", "Population: 8,045,311 (2024 estimate)"],
  ["noise", "Temperature: 72\u00B0F, wind 5-10 mph"],
  ["noise", "Serving size 2/3 cup (55g)"],
  ["noise", "Ratio 16:9 widescreen"],
  ["noise", "Battery 85% - 3h 20m remaining"],
  ["noise", "1 in = 2.54 cm"],
  ["noise", "1 mile = 5,280 feet"],
  ["noise", "10 + 5 = 15"],
  ["noise", "7 x 8 = 56"],
  ["noise", "Step 1 of 3"],
  ["noise", "Page 2 of 10"],
  ["noise", "ISBN 978-0-13-468599-1"],
  ["noise", "Flight UA 1234 departs 6:40 AM"],
  ["noise", "Track 7 - 3:45"],
  ["noise", "Bus route 12A runs every 15 min"],
  ["noise", "Highway I-95 North, Exit 7A"],
  ["noise", "Zip code 19702-1234"],
  ["noise", "Interest rate 4.5% APR"],
  ["noise", "Download speed 250 Mbps, upload 20 Mbps"],
  ["noise", "Apartment 5B, 123 Main St."],
  ["noise", "Size 10.5 W shoes"],
  ["noise", "COVID-19 update for families"],
  ["noise", "Ages 12+ only"],
  ["noise", "Win 3 out of 5 games to advance."],
  ["noise", "Final Jeopardy: $2,000 x 2"],
  ["noise", "1st place: Maya, 2nd place: Leo, 3rd place: Ana"]
];

// ---------------------------------------------------------------------------
// Real-web cases. Each one was found by extension/test/realweb.mjs on a real
// public page (Oct 2026): text a page really shows, as detect.js reads it.
// REAL_NEGATIVES were flagged before and must stay quiet; REAL_POSITIVES were
// missed before and must be found with the kind and level given.
// [source, text]
export const REAL_NEGATIVES = [
  // W3Schools JavaScript operators table
  ["w3schools", "x = x + y"],
  ["w3schools", "x = x % y"],
  ["w3schools", "x = x / y"],
  // Wikipedia: densities, citations, superscript reference marks
  ["wikipedia", "11,936.9/sq mi (4,608.86/km^2)"],
  ["wikipedia", "3,001/sq mi (1,158.6/km^2)"],
  ["wikipedia", "Spiegel, Murray R.; Moyer, R.E. (2006), Schaum's outline of college algebra, Schaum's outline series, New York: McGraw-Hill, ISBN 978-0-07-145227-4, p. 264"],
  ["wikipedia", "Maas, U.; Pope, S.B. (1992). \"Simplifying chemical kinetics: intrinsic low-dimensional manifolds in composition space\". Combust. Flame. 88 (3-4): 239-264. Bibcode:1992CoFl...88..239M. doi:10.1016/0010-2180(92)90034-m."],
  ["wikipedia", "Kline, Morris (1998), Calculus: an intuitive and physical approach, Dover books on mathematics, New York: Dover Publications, ISBN 978-0-486-40453-0, p. 386"],
  // Wikipedia physics and chemistry formulas
  ["wikipedia", "I = (V)/(R) or V = IR or R = (V)/(I)."],
  ["wikipedia", "V = Z I or I = Y V"],
  ["wikipedia", "a = (E)/(R), b = (r)/(R)."],
  ["wikipedia", "g = (GM)/(r^2) \u2248 9.8 m/s^2."],
  ["wikipedia", "v = (1)/(m)\u2207 S."],
  ["wikipedia", "G(x) = (1)/(T)\u222B_Tq'(x,t)p'(x,t)dt"],
  ["wikipedia", "C:s_1 = s_3; H:4s_1 = 2s_4; O:2s_2 = 2s_3 + s_4"],
  ["wikipedia", "\u03A3_(j = 1)^Ja_(ij)\u03BD_j = 0"],
  // Wikipedia math articles: formulas, identities, worked algorithm lines
  ["wikipedia", "x = (-b \u00B1 \u221A(b^2 - 4ac))/(2a)"],
  ["wikipedia", "x^2 + 2hx + h^2 = (x + h)^2,"],
  ["wikipedia", "log a = 0.6192290, log b = 0.9618637, log c = 1.0576927"],
  ["wikipedia", "log \u221A(c/a) = (1.0576927 - 0.6192290)/2 = 0.2192318"],
  ["wikipedia", "1 + (1)/(2) + (1)/(3) + ... + (1)/(n) = \u03A3_(k = 1)^n(1)/(k),"],
  ["wikipedia", "For the quadratic function y = x^2 - x - 2, the points where the graph crosses the x-axis, x = -1 and x = 2, are the solutions of the quadratic equation x^2 - x - 2 = 0."],
  ["wikipedia", "Solve each of the two linear equations.\nx + 1 = \u00B1 \u221A(3)"],
  ["wikipedia", "The natural logarithm of t is the shaded area underneath the graph of the function f(x) = 1/x."],
  ["wikipedia", "log_2(x^2) = 2log_2|x|."],
  ["wikipedia", "(c)/(d) = cd^-1 = 10^(log_10 c - log_10 d)."],
  ["wikipedia", "log_10(10x) = log_10 10 + log_10 x = 1 + log_10 x."],
  ["wikipedia", "cd = 10^(log_10 c) 10^(log_10 d) = 10^(log_10 c + log_10 d)"],
  ["wikipedia", "c^d = (10^(log_10 c))^d = 10^(d log_10 c)"],
  ["wikipedia", "root(d, c) = c^((1)/(d)) = 10^((1)/(d) log_10 c)."],
  ["wikipedia", "x = -(p)/(2) \u00B1 \u221A(((p)/(2))^2 - q)."],
  // Math is Fun lessons: identities, worked steps, answers
  ["mathsisfun", "(a+b)(a-b) = a^2 - b^2"],
  ["mathsisfun", "a^2 + 2ab + b^2"],
  ["mathsisfun", "ax^2 + bx + c = 0"],
  ["mathsisfun", "Add 6 to both sides:3x = 9+6"],
  ["mathsisfun", "Start with:5x = 2x + 9Subtract 2x from both sides:3x = 9Divide by 3:x = 3"],
  ["mathsisfun", "Use the Quadratic Formula:\nAnswer: x = -0.2 \u00B1 0.4i"],
  ["mathsisfun", "Use the Quadratic Formula:\n\u221A(-16) = 4i (i is the imaginary number \u221A-1)"],
  ["mathsisfun", "Quadratic Formula:\n(-6 \u00B1 \u221A(6^2- 4*5*1))/(2*5)"],
  ["mathsisfun", "Both 2y and 6 have a common factor of 2:"],
  ["mathsisfun", "So we can factor the whole expression into:\n2y+6 = 2(y+3)"],
  ["mathsisfun", "So we can factor the whole expression into:\nCheck: 3y(y+4) = 3y * y + 3y * 4 = 3y^2 + 12y"],
  ["mathsisfun", "w^4 - 16 = (w^2+ 4)(w+ 2)(w- 2)"],
  ["mathsisfun", "Answer: 2 * 2 * 2 = 8, so we had to multiply 3 of the 2s to get 8"],
  ["mathsisfun", "We are asking \"how many 5s need to be multiplied together to get 625?\""],
  ["mathsisfun", "Example: ln(7.389) = log_e(7.389) \u2248 2"],
  ["mathsisfun", "Example: sin(-\u03B8) = -sin(\u03B8) is one of the Trigonometric Identities"],
  ["mathsisfun", "Calculate 3^2 = 9:x/2 = 9"],
  // Paul's Online Math Notes lesson text
  ["lamar", "If a = b then a + c = b + c for any c. All this is saying is that we can add a number, c, to both sides of the equation and not change the equation."],
  // OpenStax lesson text and worked solutions
  ["openstax", "5x + 2 = 3x - 6; 2x = -8; x = -4"],
  ["openstax", "y - (- 3) = (7)/(3)(x - 0); y + 3 = (7)/(3)x; y = (7)/(3)x - 3"],
  ["openstax", "m = (y_2 - y_1)/(x_2 - x_1)"],
  ["openstax", "x(x - 1)3 = 3x(x - 1)"],
  ["openstax", "How do we recognize when an equation, for example y = 4x + 3, will be a straight line (linear) when graphed?"],
  ["openstax", "You may have noticed that all of the equations we have solved so far have been of the form x + a = b or x - a = b. We were able to isolate the variable by adding or subtracting the constant term on the side of the equation with the variable. Now we will see how to solve equations that have a variable multiplied by a constant and so will require division to isolate the variable."],
  ["openstax", "Subtraction Property of Equality Addition Property of Equality; For any real numbers a,b, and c, For any real numbers a,b, and c,; if a = b,; then a - c = b - c. if a = b,; then a + c = b + c."],
  ["openstax", "A common mistake made when solving rational equations involves finding the LCD when one of the denominators is a binomial-two terms added or subtracted-such as (x + 1). Always consider a binomial as an individual factor-the terms cannot be separated. For example, suppose a problem has three terms and the denominators are x, x - 1, and 3x - 3. First, factor all denominators. We then have x, (x - 1), and 3(x - 1) as the denominators. (Note the parentheses placed around the second denominator.) Only the last two denominators have a common factor of (x - 1)."],
  // Purplemath worked examples told in the first person
  ["purplemath", "So the first thing I have to do is factor:\nx^2 + 5x + 6 = (x + 2)(x + 3)"],
  ["purplemath", "Now I can solve each factor by setting each one equal to zero and solving the resulting linear equations:\nx + 2 = 0 or x + 3 = 0"],
  ["purplemath", "x = 0, x + 5 = 0"],
  ["purplemath", "A very common mistake that students make at this stage is to \"solve\" the equation for \"x + 5 = 0\" by dividing through by the x. But that's an invalid step. Why? Because we can't divide by zero. How does that come into play here?"],
  // Khan Academy video page: comments and transcript lines
  ["khan", "Can't we just -10/x^x, do we have to multiply the 7 too?"],
  ["khan", "the right-hand side by x. And so what will that give us? Well, we distribute the x. We get x times 7 is 7x. And then x times"],
  ["khan", "It is completely normal to feel frustrated by old, forgotten material, but the key to solving equations with a variable in the denominator is simply to \"clear the fractions\" immediately to make it look like a standard equation. The fastest way is to find the Least Common Denominator (LCD) of all terms and multiply every single term on both sides by that denominator. This action causes the variables in the denominator to cancel out, removing them from the bottom and bringing them to the top (e.g., if you have 10/x, multiplying by x turns it into 10). Once the fractions are gone, you solve the remaining linear or quadratic equation as usual, with one crucial extra step: check your answers to ensure they don't make the original denominator zero, as that is not a valid solution"],
  // onemathematicalcat graph caption
  ["onemathcat", "graph of y = (2)/(3)x + 6 (the left side of the equation, dashed green)"]
];

/** @type {Array<{ src: string, text: string, k: string, l: 1|2 }>} */
export const REAL_POSITIVES = [
  { src: "mathsisfun", text: "Example: What is log_5(625) ... ?", k: "logarithmic", l: 2 },
  { src: "mathsisfun", text: "Example: What is log_8(0.125) ... ?", k: "logarithmic", l: 2 },
  { src: "mathsisfun", text: "Example: solve for x:\n(2x)/(x - 3) + 3 = (6)/(x - 3) (x\u22603)", k: "rational", l: 2 },
  { src: "lamar", text: "Solve each of the following equations.\nlog (6x) - log (4 - x) = log (3)", k: "logarithmic", l: 2 },
  { src: "lamar", text: "\u221B(x - 2) = 3", k: "radical", l: 2 },
  { src: "openstax", text: "Translate and solve: n divided by 8 is -32.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Translate and solve: Three-fourths of p is 18.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Translate and solve: The number 143 is the product of -11 and y.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Find the equation of the line with m = -6 and passing through the point ((1)/(4),-2). Write the equation in standard form.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Find the equation of the line in standard form with slope m = - (1)/(3) and passing through the point (1,(1)/(3)).", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Starting with the standard form of an equation Ax + By = C solve this expression for y in terms of A,B,C and x. Then put the expression in slope-intercept form.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Given that the following coordinates are the vertices of a rectangle, prove that this truly is a rectangle by showing the slopes of the sides that meet are perpendicular.\n(-1,1),(2,0),(3,3) and (0,4)", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Starting with the point-slope formula y - y_1 = m(x - x_1), solve this expression for x in terms of x_1,y,y_1, and m.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "Frida started to solve the equation -3x = 36 by adding 3 to both sides. Explain why Frida's method will not solve the equation.", k: "linear-equation", l: 1 },
  { src: "openstax", text: "For problems 1 - 3 use the Method of Substitution to find the solution to the given system or to determine if the system is inconsistent or dependent.\n3x + 9y = -6\n-4x - 12y = 8", k: "system", l: 1 },
  { src: "purplemath", text: "Solve (x + 2)(x + 3) = 12.", k: "quadratic", l: 1 },
  { src: "khan", text: "Solve for w.\n-2(w - 7) = 18", k: "linear-equation", l: 1 },
  { src: "ncl", text: "Solve (3)/(3 - a) + (4)/(2a + 1) = 0.", k: "rational", l: 2 },
  { src: "wikipedia", text: "The golden ratio is found as the positive solution of the quadratic equation x^2 - x - 1 = 0.", k: "quadratic", l: 1 },
  { src: "wikipedia", text: "We illustrate use of this algorithm by solving 2x^2 + 4x - 4 = 0", k: "quadratic", l: 1 }
];
