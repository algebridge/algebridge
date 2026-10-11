import type { SkillIdeas } from "./types";

/** "Get the idea" for Algebra 1, units 11 to 15 (types.ts). */
export const IDEAS: SkillIdeas = {
  "multiplying-binomials": {
    idea: "(x + 3)(x + 5) is the area of a rectangle with sides x + 3 and x + 5. Cut each side into its two parts and the rectangle splits into four smaller boxes. Multiplying the binomials means finding all four boxes and adding them up. FOIL is just a way to remember to visit every box once.",
    everyday: "A square garden is x feet on a side. You make it 3 feet longer one way and 5 feet longer the other. With x = 10 that is 13 × 15 = 195 square feet, and x² + 8x + 15 = 100 + 80 + 15 = 195 too.",
    picture: { kind: "area", rows: ["x", "3"], cols: ["x", "5"], cells: [["x²", "5x"], ["3x", "15"]], total: "x² + 8x + 15" },
    caption: "The four boxes are x², 5x, 3x and 15. The two x boxes join into 8x, so the whole area is x² + 8x + 15.",
    why: [
      "Every part of the first bracket has to multiply every part of the second. Four parts times four boxes means nothing is skipped.",
      "The outer and inner products are both x terms, so they combine into one middle term.",
    ],
  },
  "special-products": {
    idea: "(x + 4)² is a square with side x + 4. Cut it up and you get a big x² square, a small 4² = 16 square, and two matching strips of 4x. So (x + 4)² = x² + 8x + 16, and the middle term is always twice the product. A sum times a difference, like (x + 4)(x − 4), loses its middle: +4x and −4x cancel, leaving x² − 16.",
    everyday: "A 6-inch square photo gets a 2-inch border on every side, so the frame is 10 by 10 = 100 square inches. With x = 6: (6 + 4)² = 36 + 48 + 16 = 100, which matches.",
    picture: { kind: "area", rows: ["x", "4"], cols: ["x", "4"], cells: [["x²", "4x"], ["4x", "16"]], total: "x² + 8x + 16" },
    caption: "Two strips of 4x sit beside the x² square. Forgetting them is why (x + 4)² is more than x² + 16.",
    why: [
      "(a + b)² means (a + b)(a + b), so the two middle boxes are both ab. Together they make 2ab.",
      "In (a + b)(a − b) the middle boxes are +ab and −ab, which add to zero. Only a² − b² is left.",
    ],
  },
  "factoring-trinomials": {
    idea: "Factoring is multiplying run backwards. x² + 7x + 12 is the area of a rectangle, and you want its two sides. The corner box is 12 and the two side strips add to 7x, so you need two numbers that multiply to 12 and add to 7. Those are 3 and 4, so the sides are x + 3 and x + 4.",
    everyday: "A patio has area x² + 7x + 12 square feet. Its sides are x + 3 and x + 4. When x = 6 the sides are 9 and 10, and 9 × 10 = 90 matches 36 + 42 + 12 = 90.",
    picture: { kind: "area", rows: ["x", "3"], cols: ["x", "4"], cells: [["x²", "4x"], ["3x", "12"]], total: "x² + 7x + 12" },
    caption: "The corner 3 × 4 = 12 gives the last term, and the strips 3x + 4x = 7x give the middle term.",
    why: [
      "When (x + p)(x + q) is multiplied out, the last term is p × q and the middle term is (p + q)x. So p and q must multiply to c and add to b.",
      "You can always check by multiplying your answer back out with FOIL.",
    ],
  },
  "factoring-special": {
    idea: "Some expressions have a pattern you can spot at a glance. x² − 25 is one square minus another (x² and 5²), and that always factors as (x + 5)(x − 5), because the middle terms +5x and −5x cancel. x² + 10x + 25 is a perfect square: the first and last terms are squares, and the middle is twice x times 5, so it is (x + 5)².",
    everyday: "To find 21 × 19 in your head, write it as (20 + 1)(20 − 1) = 20² − 1² = 400 − 1 = 399. That is the difference of squares at work.",
    picture: { kind: "area", rows: ["x", "5"], cols: ["x", "−5"], cells: [["x²", "−5x"], ["5x", "−25"]], total: "x² − 25" },
    caption: "The two middle boxes, −5x and 5x, cancel each other out, so only x² and −25 are left.",
    why: [
      "(a + b)(a − b) multiplies out to a² − ab + ab − b² = a² − b², so any square minus a square factors this way.",
      "A trinomial is a perfect square when its first and last terms are squares and its middle term is twice their roots multiplied.",
    ],
  },
  "graphing-parabolas": {
    idea: "A quadratic like y = x² − 4x + 3 draws a U shape called a parabola. It goes down, turns at one lowest point called the vertex, and comes back up, the same on both sides. The vertex sits at x = −b/2a, here 4/2 = 2. The places it crosses the x-axis are where y is 0.",
    everyday: "A ball tossed up follows a parabola. If its height is h = −5t² + 20t meters, it peaks at t = 2 seconds at 20 meters and lands at t = 4. The negative 5 makes the U open down.",
    picture: {
      kind: "graph",
      x: [-2, 6],
      y: [-2, 8],
      curves: [{ f: "quadratic", a: 1, b: -4, c: 3, label: "y = x² − 4x + 3" }],
      points: [
        { x: 2, y: -1, label: "vertex (2, −1)" },
        { x: 1, y: 0, label: "(1, 0)" },
        { x: 3, y: 0, label: "(3, 0)" },
        { x: 0, y: 3, label: "(0, 3)" },
      ],
    },
    caption: "The vertex (2, −1) is the turning point, and the two x-intercepts 1 and 3 sit the same distance from it on either side.",
    why: [
      "A parabola is symmetric, so the vertex is exactly halfway between the two x-intercepts.",
      "When a is positive the U opens up; when a is negative it opens down. The y-intercept is c, because x = 0 leaves only c.",
    ],
  },
  "solving-by-factoring": {
    idea: "If two numbers multiply to zero, one of them has to be zero. So once x² − x − 6 = 0 is written as (x − 3)(x + 2) = 0, either x − 3 = 0 or x + 2 = 0. That gives x = 3 or x = −2. On the graph these are the two places the parabola touches zero height.",
    everyday: "A poster is 2 inches longer than it is wide and covers 24 square inches: w(w + 2) = 24, so w² + 2w − 24 = 0, which is (w + 6)(w − 4) = 0. A width can only be positive, so it is 4 inches wide and 6 long.",
    picture: {
      kind: "graph",
      x: [-4, 5],
      y: [-7, 8],
      curves: [{ f: "quadratic", a: 1, b: -1, c: -6, label: "y = (x − 3)(x + 2)" }],
      points: [
        { x: -2, y: 0, label: "x = −2" },
        { x: 3, y: 0, label: "x = 3" },
      ],
    },
    caption: "The curve crosses the x-axis at −2 and 3, the two values that make one bracket zero.",
    why: [
      "Zero times anything is zero, and two numbers other than zero always multiply to something other than zero. So a product of zero needs a zero factor.",
      "The equation has to equal 0 first. (x − 3)(x + 2) = 5 says nothing about either bracket.",
    ],
  },
  "completing-square": {
    idea: "x² + 6x is a square with a corner missing. Split the 6x into two strips of 3x and lay them along two sides of the x² square. The gap in the corner is 3 × 3 = 9. Add 9 and you have a full square, (x + 3)², which you can undo with a square root. That 9 is (b/2)², half of 6, squared.",
    everyday: "A square garden x feet wide plus a 6-by-x strip covers 16 square feet. Add a 3-by-3 corner of 9 square feet and it is a 25 square foot square with side 5, so x + 3 = 5 and x = 2.",
    picture: { kind: "area", rows: ["x", "3"], cols: ["x", "3"], cells: [["x²", "3x"], ["3x", "9"]], total: "(x + 3)² = x² + 6x + 9" },
    caption: "The x² square and two 3x strips are x² + 6x. The 9 in the corner is the piece that completes the square.",
    why: [
      "(x + 3)² = x² + 6x + 9, so adding (6/2)² = 9 turns x² + 6x into a perfect square.",
      "Adding 9 to both sides keeps the equation balanced.",
      "Once one side is a square, a square root undoes it. Keep both + and −, since 5² and (−5)² are both 25.",
    ],
  },
  "quadratic-formula": {
    idea: "The quadratic formula is completing the square done once, for every equation ax² + bx + c = 0. Read it in two parts: −b/2a is the middle of the parabola, the x of its vertex. ±√(b² − 4ac)/2a is how far each root sits to the left and right of that middle. The part under the root tells you how many real answers there are.",
    everyday: "A ball thrown up from 2 meters has height h = −5t² + 10t + 2. Setting h = 0, the formula gives t = (−10 − √140) ÷ (−10), about 2.18 seconds until it hits the ground.",
    picture: {
      kind: "graph",
      x: [-1, 5],
      y: [-4, 6],
      curves: [{ f: "quadratic", a: 1, b: -4, c: 1, label: "y = x² − 4x + 1" }],
      points: [
        { x: 2, y: -3, label: "middle x = 2" },
        { x: 0.27, y: 0, label: "2 − √3 ≈ 0.27" },
        { x: 3.73, y: 0, label: "2 + √3 ≈ 3.73" },
      ],
    },
    caption: "For x² − 4x + 1, −b/2a = 2 is the middle, and √12/2 = √3 ≈ 1.73 is how far each root sits from it.",
    why: [
      "Completing the square on ax² + bx + c = 0 step by step gives exactly this formula, so it works for every quadratic.",
      "If b² − 4ac is positive there are two roots, if it is 0 there is one, and if it is negative the parabola never reaches the x-axis.",
    ],
  },
  "absolute-value": {
    idea: "Absolute value is distance from zero, so it is never negative: |5| and |−5| are both 5. |x − 2| = 5 asks which numbers are 5 steps away from 2. You can walk 5 steps right or 5 steps left, so there are two answers: 7 and −3.",
    everyday: "Your thermostat is set to 70°F, and the room is 3 degrees off. That means the room is 73°F or 67°F: |t − 70| = 3 has two answers, one on each side.",
    picture: {
      kind: "numberLine",
      min: -5,
      max: 9,
      marks: [{ at: -3, label: "−3" }, { at: 2, label: "2" }, { at: 7, label: "7" }],
      jumps: [
        { from: 2, to: 7, label: "+5" },
        { from: 2, to: -3, label: "−5" },
      ],
    },
    caption: "Starting at 2 and stepping 5 either way lands on 7 and −3, the two solutions of |x − 2| = 5.",
    why: [
      "The inside can be 5 or −5, since both have distance 5 from zero. So split into x − 2 = 5 and x − 2 = −5.",
      "An absolute value can never equal a negative number, so |x| = −4 has no solution.",
    ],
  },
  "absolute-value-inequalities": {
    idea: "|x − 2| < 3 means x is less than 3 steps from 2. That is every number between −1 and 5, one stretch on the number line. |x − 2| > 3 means more than 3 steps away, which is two separate pieces: everything left of −1 and everything right of 5.",
    everyday: "A bag of chips labeled 50 grams is allowed to be off by at most 2 grams: |w − 50| ≤ 2, so every bag weighs from 48 to 52 grams.",
    picture: {
      kind: "numberLine",
      min: -3,
      max: 7,
      marks: [{ at: -1, label: "−1" }, { at: 2, label: "2" }, { at: 5, label: "5" }],
      segment: { from: -1, to: 5, closedFrom: false, closedTo: false },
    },
    caption: "The stretch from −1 to 5 is every number within 3 of 2. The ends are open because exactly 3 away does not count for <.",
    why: [
      "Less than means close to the center, so the answer is one stretch: −3 < x − 2 < 3, then add 2 to all three parts.",
      "Greater than means far from the center, so the answer splits into two rays: x − 2 < −3 or x − 2 > 3.",
    ],
  },
  "piecewise-functions": {
    idea: "A piecewise function has different rules for different inputs, like a price list that changes after a cutoff. To find an output, first check which range the input falls in, and only then use that range's rule. The cutoff points matter: each input belongs to exactly one piece.",
    everyday: "A phone plan costs $30 a month for up to 5 GB of data, then $10 for each GB over 5. Using 7 GB costs 30 + 10 × 2 = $50, and using 3 GB costs just $30.",
    picture: {
      kind: "table",
      headers: ["Data used", "Which rule", "Monthly cost"],
      rows: [
        ["3 GB", "up to 5 GB: $30", "$30"],
        ["5 GB", "up to 5 GB: $30", "$30"],
        ["7 GB", "over 5 GB: 30 + 10(7 − 5)", "$50"],
        ["9 GB", "over 5 GB: 30 + 10(9 − 5)", "$70"],
      ],
      note: "Pick the rule from the input first, then do the math.",
    },
    caption: "At 5 GB and below every row costs $30. Past 5 GB the second rule takes over and adds $10 per extra GB.",
    why: [
      "Each rule only applies on its own range, so using the wrong rule gives the wrong output even when the arithmetic is perfect.",
      "Watch the cutoff signs: ≤ 5 includes 5 in the first piece, so 5 GB uses the $30 rule.",
    ],
  },
  "center-spread": {
    idea: "The center is a typical value, and the spread is how far the values stray from it. The mean adds every value, so one extreme value drags it toward itself. The median is just the middle value in order, and the IQR is the width of the middle half. One outlier at the far end barely moves them, because they only look at the order.",
    everyday: "Five friends score 70, 72, 75, 78 and 80 on a quiz: mean 75, median 75. A sixth friend who skipped studying scores 20. The mean falls to about 65.8, and the median only slips to 73.5.",
    picture: {
      kind: "table",
      headers: ["Scores", "Mean", "Median", "IQR", "Range"],
      rows: [
        ["70, 72, 75, 78, 80", "75", "75", "8", "10"],
        ["20, 70, 72, 75, 78, 80", "about 65.8", "73.5", "8", "60"],
      ],
      note: "Adding the outlier 20 drags the mean and the range; the median and IQR barely move.",
    },
    caption: "The mean drops almost 10 points and the range jumps from 10 to 60, while the IQR stays at 8.",
    why: [
      "The mean uses the size of every value, so a far-off 20 pulls the total, and the mean, down.",
      "The median and IQR use positions in order, and an outlier only adds one value at the end.",
      "So with an outlier, report the median and IQR; without one, the mean and standard deviation work well.",
    ],
  },
  "trend-lines": {
    idea: "A trend line is the straight line that runs through the middle of a cloud of points. Its slope says how much y changes, on average, for each 1 added to x. The correlation r says how tightly the points hug a line: close to 1 or −1 is tight, close to 0 is scattered. A strong pattern still does not prove that x causes y.",
    everyday: "Ice cream sales and sunburns both rise in summer, so they correlate strongly. Ice cream does not cause sunburn: hot sunny days cause both.",
    picture: {
      kind: "graph",
      x: [0, 6],
      y: [55, 95],
      curves: [{ f: "linear", m: 5, b: 60, label: "score = 5 × hours + 60" }],
      points: [
        { x: 1, y: 66 },
        { x: 2, y: 69 },
        { x: 3, y: 75 },
        { x: 4, y: 81 },
        { x: 5, y: 84 },
      ],
    },
    caption: "The points sit close to a line rising 5 points for each extra hour studied, so r is close to 1.",
    why: [
      "Slope is change in y over change in x, so on y = 5x + 60 each extra hour adds 5 points to the predicted score.",
      "r only measures how close the points are to a line. A cause needs an experiment or a reason, not just a pattern.",
    ],
  },
  "two-way-tables": {
    idea: "A two-way table counts people by two questions at once, like grade and whether they play a sport. Each cell is one combination. When a question says \"of the 9th graders\", you only look at the 9th grade row, so you divide by that row's total. The grand total is only for questions about everyone.",
    everyday: "In a survey of 100 students, 30 of the 50 ninth graders play a sport. Of the 9th graders, 30 ÷ 50 = 60% play. Out of everyone, 9th graders who play are only 30 ÷ 100 = 30%.",
    picture: {
      kind: "table",
      headers: ["", "Plays a sport", "No sport", "Total"],
      rows: [
        ["Grade 9", "30", "20", "50"],
        ["Grade 10", "15", "35", "50"],
        ["Total", "45", "55", "100"],
      ],
      note: "Of the 9th graders: 30 ÷ 50 = 60%. Of the sports players: 30 ÷ 45 ≈ 66.7%.",
    },
    caption: "The same 30 students give 60%, 66.7% or 30% depending on which total you divide by.",
    why: [
      "\"Of the 9th graders\" shrinks the group to 50 people, so 50 is the bottom of the fraction.",
      "Rows and columns each add up to their totals, which is a quick way to check the table or fill in a missing count.",
    ],
  },
  "literal-equations": {
    idea: "A literal equation is a formula with several letters, like P = 2l + 2w for the distance around a rectangle. Solving for w means getting w alone, exactly the way you would get x alone. The other letters act like numbers you do not know yet, so you undo what was done to w in reverse order.",
    everyday: "You have 30 feet of fence for a rectangular dog pen 9 feet long. w = (P − 2l) ÷ 2 = (30 − 18) ÷ 2 = 6, so the pen is 6 feet wide.",
    picture: { kind: "chain", steps: ["P = 2l + 2w", "subtract 2l from both sides", "P − 2l = 2w", "divide both sides by 2", "w = (P − 2l)/2"] },
    caption: "w was doubled and then had 2l added, so take away 2l first and divide by 2 last.",
    why: [
      "Doing the same thing to both sides keeps the formula true, with letters just as with numbers.",
      "Solving once for w gives a shortcut: plug in any perimeter and length and get the width right away.",
    ],
  },
  "function-transformations": {
    idea: "Transforming a function moves or reshapes its whole graph. Adding outside, f(x) + k, lifts every point up k. Changing the input, f(x − h), slides the graph right h, the opposite of the sign you see. A minus in front, −f(x), flips it upside down, and a·f(x) stretches it taller by a.",
    everyday: "In a game level editor, dragging a jump arc 2 tiles right and 1 tile up moves every point of the arc the same way, so y = x² becomes y = (x − 2)² + 1.",
    picture: {
      kind: "graph",
      x: [-3, 5],
      y: [-1, 8],
      curves: [
        { f: "quadratic", a: 1, b: 0, c: 0, label: "y = x²" },
        { f: "quadratic", a: 1, b: -4, c: 5, label: "y = (x − 2)² + 1" },
      ],
      points: [
        { x: 0, y: 0, label: "(0, 0)" },
        { x: 2, y: 1, label: "(2, 1)" },
      ],
    },
    caption: "The vertex moves from (0, 0) to (2, 1): 2 right from the x − 2 and 1 up from the + 1, with the same shape.",
    why: [
      "In f(x − 2) you need x to be 2 bigger to get the same input as before, so every point shows up 2 to the right.",
      "A change outside f acts on the outputs (up, down, flip, stretch); a change inside acts on the inputs (left, right).",
    ],
  },
  "linear-vs-exponential": {
    idea: "Linear change adds the same amount each step, so it climbs like stairs of equal height. Exponential change multiplies by the same factor each step, so each jump is bigger than the one before. Exponential can start slower, and it always overtakes linear in the end.",
    everyday: "Plan A gives you $10 and adds $10 each day. Plan B gives you $1 and doubles it each day. Plan A leads for a week, and on day 7 Plan B has $128 against Plan A's $80.",
    picture: {
      kind: "table",
      headers: ["Day", "Plan A (+$10)", "Plan B (×2)"],
      rows: [
        ["0", "$10", "$1"],
        ["1", "$20", "$2"],
        ["2", "$30", "$4"],
        ["3", "$40", "$8"],
        ["4", "$50", "$16"],
        ["5", "$60", "$32"],
        ["6", "$70", "$64"],
        ["7", "$80", "$128"],
      ],
      note: "Plan A goes up by 10 each row; Plan B is multiplied by 2 each row.",
    },
    caption: "Plan A's column has equal differences and Plan B's has equal ratios, which is how you tell the two apart in a table.",
    why: [
      "Equal differences between steps mean linear, y = mx + b. Equal ratios mean exponential, y = a · bˣ.",
      "Multiplying grows by more each step, since every doubling acts on a bigger amount, so it passes any adding pattern eventually.",
    ],
  },
};
