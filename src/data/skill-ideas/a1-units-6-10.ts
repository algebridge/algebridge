import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 1, units 6 to 10 (types.ts). */
export const IDEAS: SkillIdeas = {
  "graphing-inequalities": {
    idea: "A line like y = 2x − 3 splits the graph into two sides. An inequality such as y ≥ 2x − 3 asks for every point on one side, so the answer is a whole shaded region instead of one line. Draw the line solid when points on it count (≤ or ≥) and dashed for < or >, where the line itself is left out. Test one point to see which side to shade.",
    everyday: "With $40 for snacks, chips at $3 a bag and drinks at $2 each, every plan has to fit 3x + 2y ≤ 40. Buying 5 bags and 12 drinks costs 15 + 24 = $39, so the point (5, 12) sits inside the shaded region.",
    picture: {
      kind: "graph",
      x: [0, 15],
      y: [0, 22],
      curves: [{ f: "linear", m: -1.5, b: 20, label: "3x + 2y = 40" }],
      points: [
        { x: 0, y: 20, label: "(0, 20)" },
        { x: 40 / 3, y: 0, label: "(13⅓, 0)" },
        { x: 5, y: 12, label: "5 chips, 12 drinks" },
      ],
      shade: { curve: 0, side: "below" },
    },
    caption: "The line is every plan that costs exactly $40. Everything below it costs less, and the point (5, 12) lands in that shaded side.",
    why: [
      "Every point on one side of a line gives the same answer to the test, so checking one point tells you about the whole side.",
      "Solving for y first makes it easy to read: y ≥ means shade above the line, y ≤ means shade below it.",
      "Dividing by a negative to get y alone flips the sign, and that flips the side you shade.",
    ],
  },

  "compound-inequalities": {
    idea: "A compound inequality is two conditions on the same number. AND means both have to be true, so the answer is the overlap: the stretch of the number line where the two pieces meet. OR means either one is enough, so the answer is both pieces together, often two rays heading in opposite directions.",
    everyday: "A teen league is open to players at least 13 and under 18 years old: 13 ≤ age < 18. A 13-year-old can join, a 17-year-old can join, and an 18-year-old is too old.",
    picture: {
      kind: "numberLine",
      min: 10,
      max: 20,
      marks: [
        { at: 13, label: "13" },
        { at: 18, label: "18" },
      ],
      segment: { from: 13, to: 18, closedFrom: true, closedTo: false },
    },
    caption: "The filled dot at 13 means 13 counts. The open dot at 18 means 18 is left out. Every age on the stretch between is allowed.",
    why: [
      "A three-part inequality is two inequalities at once, so whatever you do to the middle you also do to both outside parts.",
      "Multiplying or dividing all three parts by a negative flips both signs.",
      "AND keeps only the numbers that pass both tests. OR keeps any number that passes at least one.",
    ],
  },

  "systems-inequalities": {
    idea: "Each inequality shades one side of its own line. A system asks for points that obey every inequality at once, so the answer is where the shadings overlap. Any point in that overlap works for all of them, and a point outside it breaks at least one rule.",
    everyday: "A club sells cookies for $1 and brownies for $3, can bake at most 30 treats, and wants at least $60. A plan of 10 cookies and 18 brownies is 28 treats and $64, so it meets both goals.",
    picture: {
      kind: "graph",
      x: [0, 32],
      y: [0, 32],
      curves: [
        { f: "linear", m: -1, b: 30, label: "x + y = 30" },
        { f: "linear", m: -1 / 3, b: 20, label: "x + 3y = 60" },
      ],
      points: [
        { x: 15, y: 15, label: "(15, 15)" },
        { x: 10, y: 18, label: "10 cookies, 18 brownies" },
      ],
      shade: { curve: 0, side: "below" },
    },
    caption: "The shading is the side with at most 30 treats. Plans that also raise $60 sit above the flatter line, so the answers are the wedge between the lines left of (15, 15), where (10, 18) sits.",
    why: [
      "A point is a solution only when it passes every inequality, so test it in each one.",
      "The overlap of the shaded sides is exactly the set of points that pass all the tests.",
      "Where the lines cross, both rules are met with nothing to spare: 15 cookies and 15 brownies use 30 treats and raise exactly $60.",
    ],
  },

  "function-notation": {
    idea: "A function is a machine: put a number in, and its rule gives exactly one number out. f(x) is the name for the output when the input is x, so f(4) means put 4 into the rule and see what comes out. The f is the machine's name and the 4 is what goes in. Nothing is multiplied by f.",
    everyday: "A pizza costs $10 plus $2 per topping, so C(t) = 10 + 2t. C(3) = 10 + 2(3) = 16 means a pizza with 3 toppings costs $16.",
    picture: { kind: "chain", steps: ["input x = 4", "times 3: 12", "minus 5: 7", "f(4) = 7"] },
    caption: "The rule f(x) = 3x − 5 runs the input through its moves in order: 4 is tripled to 12, then 5 is taken away, leaving 7.",
    why: [
      "Put the input in for every x, in brackets, so its sign stays attached: f(-2) squares all of -2.",
      "Order of operations still holds inside the rule: powers, then multiplying, then adding and subtracting.",
      "Going backward, f(x) = 13 asks which input gives 13, so set the rule equal to 13 and solve.",
    ],
  },

  "domain-range": {
    idea: "The domain is every input a function can take, and the range is every output it can give back. Some inputs break the rule: dividing by 0 and square roots of negatives have no real answer. Real situations add limits too: time starts at 0, and a phone battery stops at empty.",
    everyday: "A phone at 100% that drops 8% an hour follows B(t) = 100 − 8t. It works from t = 0 to t = 12.5 hours, when it hits 0%, so the domain is 0 ≤ t ≤ 12.5 and the range is 0 ≤ B ≤ 100.",
    picture: {
      kind: "graph",
      x: [0, 14],
      y: [0, 110],
      curves: [{ f: "linear", m: -8, b: 100, label: "B(t) = 100 − 8t" }],
      points: [
        { x: 0, y: 100, label: "full: (0, 100)" },
        { x: 12.5, y: 0, label: "empty: (12.5, 0)" },
      ],
    },
    caption: "The domain is the stretch of inputs along the bottom, from 0 to 12.5 hours. The range is the stretch of outputs up the side, from 0% to 100%.",
    why: [
      "Find the inputs that break the rule: set a fraction's bottom equal to 0, or make a square root's inside at least 0.",
      "For a line on a stretch of inputs, the outputs at the two ends mark the edges of the range.",
      "In a real model, ask where it stops making sense, like a battery that would go below 0%.",
    ],
  },

  "function-graphs": {
    idea: "A function's graph is a picture of a story: across is the input, like time, and up is the output, like height. Reading left to right, a rising graph means the output is growing and a falling one means it is shrinking. The average rate of change is how steeply it climbs between two points: the change in output over the change in input.",
    everyday: "A ball thrown up from 4 feet follows h(t) = -16t² + 64t + 4. It is at 52 feet after 1 second and 68 feet after 2, so it climbed 16 feet per second on average during that second.",
    picture: {
      kind: "graph",
      x: [0, 4.2],
      y: [0, 75],
      curves: [{ f: "quadratic", a: -16, b: 64, c: 4, label: "h(t) = -16t² + 64t + 4" }],
      points: [
        { x: 0, y: 4, label: "(0, 4)" },
        { x: 1, y: 52, label: "(1, 52)" },
        { x: 2, y: 68, label: "top: (2, 68)" },
      ],
    },
    caption: "The curve climbs to its top at 2 seconds and then falls. Between t = 1 and t = 2 it rises from 52 to 68 feet, 16 feet in 1 second.",
    why: [
      "Average rate of change is slope: rise over run, measured between the two points you pick.",
      "A line has the same rate everywhere. A curve's rate changes, so the stretch you measure matters.",
      "Subtract in the same order on top and bottom, later minus earlier, so the sign tells you up or down.",
    ],
  },

  "arithmetic-sequences": {
    idea: "An arithmetic sequence is a list of numbers that goes up, or down, by the same amount each step, like a staircase with equal steps. That amount is the common difference d. To jump to a far term, start at the first term and add d once for each step: the nth term is n − 1 steps past the first.",
    everyday: "A theater's first row has 20 seats and each row has 3 more: 20, 23, 26, 29, and so on. Row 15 is 14 steps past row 1, so it has 20 + 14 × 3 = 62 seats.",
    picture: {
      kind: "table",
      headers: ["Row", "Seats"],
      rows: [
        ["1", "20"],
        ["2", "23"],
        ["3", "26"],
        ["4", "29"],
        ["15", "20 + 14 × 3 = 62"],
      ],
      note: "Each row adds 3 seats, so row n has 20 + (n − 1) × 3.",
    },
    caption: "Going down the table, the seats grow by the same 3 every row. Row 15 takes 14 of those steps, since row 1 is where you start.",
    why: [
      "The common difference is any term minus the one before it, and it is the same for every pair.",
      "The nth term is n − 1 steps after the first, so aₙ = a₁ + (n − 1)d.",
      "Between any two terms, the change divided by the number of steps gives d.",
    ],
  },

  "geometric-sequences": {
    idea: "A geometric sequence multiplies by the same number each step instead of adding. That number is the common ratio r. A ratio above 1 makes the terms grow faster and faster, a ratio between 0 and 1 makes them shrink, and a negative ratio flips the sign every step. The nth term is the first term multiplied by r, n − 1 times.",
    everyday: "You post a meme and 2 friends share it. Each sharer gets 3 new people to share it, and so on: 2, 6, 18, 54, 162 sharers. Each round is 3 times the one before.",
    picture: {
      kind: "table",
      headers: ["Round", "Sharers"],
      rows: [
        ["1", "2"],
        ["2", "6"],
        ["3", "18"],
        ["4", "54"],
        ["5", "162"],
      ],
      note: "Each round is 3 times the one before, so round n has 2 × 3^(n − 1).",
    },
    caption: "The numbers multiply by 3 each round, so the jumps keep getting bigger: +4, then +12, then +36, then +108.",
    why: [
      "The ratio is any term divided by the one before it, and it stays the same all along.",
      "The nth term is n − 1 multiplications after the first, so aₙ = a₁ × r^(n − 1).",
      "An odd number of negative ratios multiplied gives a negative. An even number gives a positive.",
    ],
  },

  "exponent-rules": {
    idea: "An exponent counts how many times a number is multiplied by itself: x³ is x · x · x. Every exponent rule is counting. Multiplying x³ by x⁴ puts 3 + 4 = 7 x's in a row. Dividing cancels matching x's, so subtract. A power of a power, (x⁴)³, is three groups of four x's, so multiply.",
    everyday: "A video's views double every day. After 3 days it has 2³ = 8 times its starting views, and 4 days after that it has doubled 4 more times, so 2³ · 2⁴ = 2⁷ = 128 times where it started.",
    picture: { kind: "chain", steps: ["x³ · x⁴", "(x · x · x)(x · x · x · x)", "7 x's multiplied", "x⁷"] },
    caption: "Writing the powers out shows why the exponents add: three x's and four more x's make seven.",
    why: [
      "Same base, multiplying: add the exponents, because you are counting all the copies.",
      "Same base, dividing: subtract the exponents, because each x on the bottom cancels one on top.",
      "Any base other than 0 to the power 0 is 1: x³ ÷ x³ is 1, and it is also x^(3 − 3) = x⁰.",
    ],
  },

  "negative-fractional-exponents": {
    idea: "Going down one in the exponent divides by the base: 2³ = 8, 2² = 4, 2¹ = 2, 2⁰ = 1. Keep going and 2^(-1) = 1/2, 2^(-2) = 1/4. So a negative exponent means one over the power. A fraction exponent is a root: x^(1/2) is the number that times itself makes x, so 9^(1/2) = √9 = 3.",
    everyday: "Fold a sheet of paper in half 3 times and unfold it: there are 8 rectangles, each 2^(-3) = 1/8 of the sheet. A square sticker with an area of 16 square cm has a side of 16^(1/2) = √16 = 4 cm.",
    picture: {
      kind: "table",
      headers: ["Power", "Value"],
      rows: [
        ["2³", "8"],
        ["2²", "4"],
        ["2¹", "2"],
        ["2⁰", "1"],
        ["2^(-1)", "1/2"],
        ["2^(-2)", "1/4"],
        ["2^(-3)", "1/8"],
      ],
      note: "Each row down divides by 2.",
    },
    caption: "The halving pattern keeps going past 2⁰ = 1, so the negative powers land on 1/2, 1/4 and 1/8.",
    why: [
      "x^(-n) = 1/xⁿ keeps the rules working: xⁿ · x^(-n) = x⁰ = 1.",
      "x^(1/n) multiplied by itself n times gives x^(n/n) = x, so it is the nth root of x.",
      "In x^(m/n), the bottom n is a root and the top m is a power. Take the root first to keep the numbers small.",
    ],
  },

  "scientific-notation": {
    idea: "Scientific notation writes very big or very small numbers as a short front number, at least 1 and less than 10, times a power of 10. The power counts how many places the decimal point moved: 4,500,000 is 4.5 × 10^6, six places. A negative power means a small number: 0.00072 is 7.2 × 10^-4.",
    everyday: "A video with 4,500,000 views has 4.5 × 10^6 views. A 128 GB phone holds about 128,000,000,000 bytes, which is 1.28 × 10^11.",
    picture: { kind: "chain", steps: ["4,500,000", "4.5 × 1,000,000", "4.5 × 10^6"] },
    caption: "Moving the point 6 places left makes 4.5, and 10^6 = 1,000,000 puts back what that move took out.",
    why: [
      "The front number stays at least 1 and less than 10, so each number has exactly one way to be written.",
      "Multiplying: multiply the fronts and add the powers. Dividing: divide the fronts and subtract the powers.",
      "If the front ends up 10 or more, move the point one place left and add 1 to the power.",
    ],
  },

  "simplifying-radicals": {
    idea: "√50 asks: what number times itself makes 50? Many numbers hide a perfect square inside them: 50 = 25 × 2. The square root of 25 is exactly 5, so that part comes out of the root, and the 2 stays inside: √50 = 5√2. Simplest form means no perfect square is left under the root.",
    everyday: "A square garden bed has an area of 50 square feet. Its side is √50 = 5√2 feet, which is about 7.07 feet, a little over 7.",
    picture: { kind: "chain", steps: ["√50", "√(25 × 2)", "√25 × √2", "5√2 ≈ 7.07"] },
    caption: "Splitting 50 into 25 × 2 lets the perfect square leave the root as 5, while the 2 stays under it.",
    why: [
      "√(a × b) = √a × √b, so a perfect square factor can be split off and taken out.",
      "Pick the biggest perfect square factor so the job is done in one move.",
      "Only roots with the same number inside add together: 2√3 + 3√3 = 5√3, like 2x + 3x = 5x.",
    ],
  },

  "exponential-functions": {
    idea: "An exponential function multiplies by the same number every time x goes up by 1. In y = a(b)^x, a is the starting value at x = 0 and b is the multiplier. A base above 1 grows, slowly at first and then faster and faster. A base between 0 and 1 shrinks. A line adds the same amount each step; an exponential multiplies.",
    everyday: "A meme starts with 3 sharers, and the number of sharers doubles every hour: 3, 6, 12, 24, 48. That is y = 3(2)^x after x hours.",
    picture: {
      kind: "graph",
      x: [0, 4.5],
      y: [0, 55],
      curves: [{ f: "exponential", a: 3, base: 2, label: "y = 3(2)^x" }],
      points: [
        { x: 0, y: 3, label: "(0, 3)" },
        { x: 1, y: 6 },
        { x: 2, y: 12, label: "(2, 12)" },
        { x: 3, y: 24, label: "(3, 24)" },
        { x: 4, y: 48, label: "(4, 48)" },
      ],
    },
    caption: "Each step right doubles the height: 3, 6, 12, 24, 48. The curve starts flat and then shoots up, since each jump is bigger than the last.",
    why: [
      "At x = 0, b⁰ = 1, so y = a: the number in front is where the graph crosses the y-axis.",
      "Each time x goes up 1, y is multiplied by b once more, so b = next y ÷ this y.",
      "A base above 1 means growth. A base between 0 and 1 means decay.",
    ],
  },

  "exponential-growth": {
    idea: "Growth by a percent means each step keeps everything there was and adds a slice on top. Growing 5% means multiplying by 1.05 every year, so after t years the start a becomes a(1 + r)^t. Each year's 5% is taken of a bigger amount, so the growth itself grows: interest earns interest.",
    everyday: "Put $1000 in a savings account that pays 5% a year, compounded yearly. It becomes $1,050, then $1,102.50, then $1,157.63 after 3 years, so the 3 years earn $157.63 in interest.",
    picture: {
      kind: "table",
      headers: ["Year", "Value", "Interest that year"],
      rows: [
        ["0", "$1,000.00", "start"],
        ["1", "$1,050.00", "$50.00"],
        ["2", "$1,102.50", "$52.50"],
        ["3", "$1,157.63", "$55.13"],
      ],
      note: "Each year the value is multiplied by 1.05.",
    },
    caption: "The interest grows each year, from $50 to $52.50 to $55.13, because each year's 5% is taken of a bigger balance.",
    why: [
      "1 + r keeps the whole amount (the 1) and adds the growth (the r), so 4% growth is a factor of 1.04.",
      "The exponent t counts how many times the factor is applied, once for each year or period.",
      "To find only what was added, subtract the start from the final value.",
    ],
  },

  "exponential-decay": {
    idea: "Decay by a percent means each step loses a slice and keeps the rest. Losing 20% a year means keeping 80%, so the value is multiplied by 0.8 each year: after t years, a becomes a(1 − r)^t. The value drops fast at first and then more slowly, because each year's 20% is taken of a smaller amount.",
    everyday: "An $800 phone that loses 20% of its value each year is worth $640 after 1 year and $512 after 2. It lost $160 the first year and $128 the second.",
    picture: {
      kind: "graph",
      x: [0, 6],
      y: [0, 850],
      curves: [{ f: "exponential", a: 800, base: 0.8, label: "y = 800(0.8)^t" }],
      points: [
        { x: 0, y: 800, label: "(0, 800)" },
        { x: 1, y: 640, label: "(1, 640)" },
        { x: 2, y: 512, label: "(2, 512)" },
      ],
    },
    caption: "The curve drops $160 in the first year and $128 in the second. Each year's loss is smaller, since 20% of a smaller value is less.",
    why: [
      "1 − r is the part that is kept: losing 12% keeps 88%, a factor of 0.88.",
      "A half-life is decay with a factor of 1/2: count the halvings, then multiply by 1/2 that many times.",
      "To find the amount lost, subtract the value left from the starting value.",
    ],
  },
};
